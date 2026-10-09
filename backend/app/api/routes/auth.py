from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.responses import JSONResponse

from app.api.deps import get_current_user
from app.core.security import hash_password, verify_password, create_access_token, encrypt_value
from app.models.user import User
from app.models.api_credential import ApiCredential
from app.schemas.user import RegisterRequest, LoginRequest, TokenResponse
from app.schemas.credential import CredentialInput, CredentialStatus
from app.schemas.token import TokenStatus, TokenRefreshResponse
from app.services.token_service import TokenService, TokenFetchError
from app.db.session import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

router = APIRouter()

# --- Auth ---

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already taken")

    hashed = hash_password(payload.password)
    user = User(username=payload.username, password_hash=hashed)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"message": "User registered", "user_id": user.id}

@router.post("/login")
async def login(
    payload: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
        )

    token = create_access_token(subject=user.username)
    response = JSONResponse(content=TokenResponse(access_token=token, token_type="bearer").dict())
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        samesite="lax",
    )
    return response

@router.post("/logout")
async def logout():
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(key="access_token")
    return response

# --- Token Service ---

@router.get("/token/status")
async def token_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_svc = TokenService(db)
    stored = await token_svc.get_stored_token(current_user.id)
    if not stored:
        return TokenStatus(has_token=False)

    expires_at = stored.expires_at
    is_valid = await token_svc.is_token_valid(stored)
    return TokenStatus(has_token=True, expires_at=expires_at, is_valid=is_valid)

@router.post("/token/refresh")
async def refresh_token(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    token_svc = TokenService(db)
    try:
        new_token = await token_svc.force_refresh(current_user.id)
    except TokenFetchError as e:
        return TokenRefreshResponse(success=False, error=str(e))

    if not new_token:
        return TokenRefreshResponse(success=False, error="Failed to fetch token")

    return TokenRefreshResponse(success=True, expires_at=new_token.expires_at)
