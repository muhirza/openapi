from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.security import encrypt_value, decrypt_value
from app.models.user import User
from app.models.api_credential import ApiCredential
from app.schemas.credential import (
    CredentialInput, CredentialStatus, CredentialItemStatus, CredentialListStatus,
    CREDENTIAL_API_NAMES, CREDENTIAL_LABELS,
)
from app.schemas.pin import PinInput, PinStatus
from app.services.pin_service import PinService
from app.db.session import get_db

router = APIRouter()


@router.get("/profile/credentials")
async def get_all_credential_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiCredential).where(ApiCredential.user_id == current_user.id)
    )
    creds_list = result.scalars().all()
    creds_map = {c.api_name: c for c in creds_list}

    items: List[CredentialItemStatus] = []
    for api_name in CREDENTIAL_API_NAMES:
        cred = creds_map.get(api_name)
        item = CredentialItemStatus(
            api_name=api_name,
            label=CREDENTIAL_LABELS.get(api_name, api_name),
            has_credentials=bool(cred),
        )
        if cred:
            item.client_id_masked = cred.client_id_encrypted[:4] + "****"
            item.saved_at = cred.created_at.isoformat() if cred.created_at else None
        items.append(item)

    return CredentialListStatus(items=items)


@router.get("/profile/credentials/{api_name}")
async def get_credential_status(
    api_name: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if api_name not in CREDENTIAL_API_NAMES:
        raise HTTPException(status_code=404, detail="Unknown api_name")

    result = await db.execute(
        select(ApiCredential).where(
            ApiCredential.user_id == current_user.id,
            ApiCredential.api_name == api_name,
        )
    )
    credential = result.scalar_one_or_none()

    status_resp = CredentialStatus(has_credentials=bool(credential), api_name=api_name)
    if credential:
        status_resp.client_id_masked = credential.client_id_encrypted[:4] + "****"
        status_resp.saved_at = credential.created_at.isoformat() if credential.created_at else None
    return status_resp


@router.put("/profile/credentials/{api_name}")
async def save_credentials(
    api_name: str,
    payload: CredentialInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if api_name not in CREDENTIAL_API_NAMES:
        raise HTTPException(status_code=400, detail="Invalid api_name")

    existing = await db.execute(
        select(ApiCredential).where(
            ApiCredential.user_id == current_user.id,
            ApiCredential.api_name == api_name,
        )
    )
    credential = existing.scalar_one_or_none()

    if credential:
        credential.client_id_encrypted = encrypt_value(payload.client_id)
        credential.client_secret_encrypted = encrypt_value(payload.client_secret)
        credential.updated_at = datetime.now(timezone.utc)
    else:
        credential = ApiCredential(
            user_id=current_user.id,
            api_name=api_name,
            client_id_encrypted=encrypt_value(payload.client_id),
            client_secret_encrypted=encrypt_value(payload.client_secret),
        )
        db.add(credential)

    await db.commit()
    await db.refresh(credential)

    return {"message": "Credentials saved", "api_name": api_name, "id": credential.id}


# ---------- PIN (MVP2) ----------

@router.get("/profile/pin/status")
async def get_pin_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return whether a PIN is configured. Never returns the PIN itself."""
    svc = PinService(db)
    return PinStatus(has_pin=await svc.has_pin(current_user.id))


@router.put("/profile/pin")
async def set_pin(
    payload: PinInput,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or update the static transaction PIN (stored encrypted)."""
    svc = PinService(db)
    record = await svc.set_pin(current_user.id, payload.pin)
    return {"message": "PIN saved", "id": record.id}
