from typing import Optional
from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.user_session import UserSession
from app.services.session_service import SessionService

ACCESS_TOKEN_COOKIE = "access_token"


async def get_session_context(
    db: AsyncSession = Depends(get_db),
    access_token: Optional[str] = Cookie(None, alias=ACCESS_TOKEN_COOKIE),
) -> tuple[User, UserSession]:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Belum terautentikasi",
        )

    context = await SessionService(db).resolve(access_token)
    if not context:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesi berakhir",
        )

    return context


async def get_current_user(
    context: tuple[User, UserSession] = Depends(get_session_context),
) -> User:
    return context[0]
