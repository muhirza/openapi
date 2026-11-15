from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_user
from app.core.security import encrypt_value, decrypt_value
from app.models.user import User
from app.models.api_credential import ApiCredential
from app.models.user_sync_setting import UserSyncSetting
from app.schemas.credential import (
    CredentialInput, CredentialStatus, CredentialItemStatus, CredentialListStatus,
    CREDENTIAL_API_NAMES, CREDENTIAL_LABELS,
)
from app.schemas.pin import PinInput, PinStatus
from app.schemas.sync_settings import SyncSettingsOut, SyncSettingsUpdate, SyncRunResult
from app.services.pin_service import PinService
from app.services.history_sync_service import HistorySyncService
from app.services.token_service import TokenFetchError
from app.services.provider_client import ProviderAPIError
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
        raise HTTPException(status_code=404, detail="api_name tidak dikenal")

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
        raise HTTPException(status_code=400, detail="api_name tidak valid")

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


# ---------- Provider history auto-sync ----------

def _sync_settings_out(setting: UserSyncSetting | None) -> SyncSettingsOut:
    if setting is None:
        return SyncSettingsOut(enabled=False, interval_minutes=60)
    next_sync_at = None
    if setting.enabled and setting.last_sync_at is not None:
        next_sync_at = setting.last_sync_at + timedelta(minutes=setting.interval_minutes)
    return SyncSettingsOut(
        enabled=setting.enabled,
        interval_minutes=setting.interval_minutes,
        last_sync_at=setting.last_sync_at,
        last_sync_status=setting.last_sync_status,
        last_sync_error=setting.last_sync_error,
        last_sync_count=setting.last_sync_count,
        next_sync_at=next_sync_at,
    )


@router.get("/profile/sync-settings")
async def get_sync_settings(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return this user's provider history auto-sync configuration and status."""
    result = await db.execute(
        select(UserSyncSetting).where(UserSyncSetting.user_id == current_user.id)
    )
    return _sync_settings_out(result.scalar_one_or_none())


@router.put("/profile/sync-settings")
async def update_sync_settings(
    payload: SyncSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Enable/disable auto-sync or change its interval. The background loop
    performs the first backfill within a minute once enabled."""
    result = await db.execute(
        select(UserSyncSetting).where(UserSyncSetting.user_id == current_user.id)
    )
    setting = result.scalar_one_or_none()
    if setting is None:
        setting = UserSyncSetting(user_id=current_user.id)
        db.add(setting)

    if payload.enabled is not None:
        setting.enabled = payload.enabled
    if payload.interval_minutes is not None:
        setting.interval_minutes = payload.interval_minutes

    await db.commit()
    await db.refresh(setting)
    return _sync_settings_out(setting)


@router.post("/profile/sync-settings/run-now", response_model=SyncRunResult)
async def run_sync_now(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run one provider history sync immediately."""
    try:
        added = await HistorySyncService(db).sync_user(current_user.id)
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return SyncRunResult(added=added, synced_at=datetime.now(timezone.utc))
