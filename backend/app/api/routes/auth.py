from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import ACCESS_TOKEN_COOKIE, get_current_user, get_session_context
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.schemas.token import TokenStatus, TokenRefreshResponse
from app.schemas.user import LoginRequest, RegisterRequest, SessionInfo
from app.services.session_service import SessionService
from app.services.token_service import TokenService, TokenFetchError

router = APIRouter()

# --- Auth ---

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    # Check if user exists
    result = await db.execute(select(User).where(User.username == payload.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Nama pengguna sudah digunakan")

    hashed = hash_password(payload.password)
    user = User(username=payload.username, password_hash=hashed)
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {"message": "User registered", "user_id": user.id}

@router.post("/login")
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalar_one_or_none()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Nama pengguna atau kata sandi salah",
        )

    session_svc = SessionService(db)
    raw_token = await session_svc.create(
        user,
        user_agent=request.headers.get("user-agent"),
        ip_address=request.client.host if request.client else None,
    )
    await session_svc.prune(user.id)

    expires_at = datetime.now(timezone.utc) + timedelta(
        hours=settings.session_absolute_hours
    )
    response = JSONResponse(
        content={
            "message": "Logged in",
            "username": user.username,
            "expires_at": expires_at.isoformat(),
        }
    )
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=raw_token,
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
        max_age=settings.session_absolute_hours * 3600,
        path="/",
    )
    return response

@router.post("/logout")
async def logout(
    access_token: Optional[str] = Cookie(None, alias=ACCESS_TOKEN_COOKIE),
    db: AsyncSession = Depends(get_db),
):
    await SessionService(db).revoke(access_token)

    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie(
        key=ACCESS_TOKEN_COOKIE,
        path="/",
        httponly=True,
        samesite="lax",
        secure=settings.session_cookie_secure,
    )
    return response

@router.get("/me", response_model=SessionInfo)
async def me(context=Depends(get_session_context)):
    user, session = context
    return SessionInfo(
        username=user.username,
        idle_expires_at=session.last_seen_at
        + timedelta(minutes=settings.session_idle_minutes),
        session_expires_at=session.expires_at,
    )

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
