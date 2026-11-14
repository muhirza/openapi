import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.user import User
from app.models.user_session import UserSession

LAST_SEEN_THROTTLE_SECONDS = 60
PRUNE_AFTER_DAYS = 7


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class SessionService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self, user: User, user_agent: str | None = None, ip_address: str | None = None
    ) -> str:
        raw_token = secrets.token_urlsafe(32)
        now = _now()
        self.db.add(
            UserSession(
                user_id=user.id,
                token_hash=_hash_token(raw_token),
                last_seen_at=now,
                expires_at=now + timedelta(hours=settings.session_absolute_hours),
                user_agent=(user_agent or "")[:255] or None,
                ip_address=ip_address,
            )
        )
        await self.db.commit()
        return raw_token

    async def resolve(self, raw_token: str) -> tuple[User, UserSession] | None:
        """Return the user and session for a valid, unexpired, unrevoked token."""
        row = (
            await self.db.execute(
                select(UserSession, User)
                .join(User, User.id == UserSession.user_id)
                .where(UserSession.token_hash == _hash_token(raw_token))
            )
        ).first()
        if not row:
            return None

        session, user = row
        now = _now()

        if session.revoked_at is not None:
            return None
        if session.expires_at <= now:
            return None
        if session.last_seen_at + timedelta(
            minutes=settings.session_idle_minutes
        ) <= now:
            return None
        if not user.is_active:
            return None

        if (now - session.last_seen_at).total_seconds() >= LAST_SEEN_THROTTLE_SECONDS:
            session.last_seen_at = now
            await self.db.commit()

        return user, session

    async def revoke(self, raw_token: str | None) -> None:
        if not raw_token:
            return
        await self.db.execute(
            update(UserSession)
            .where(
                UserSession.token_hash == _hash_token(raw_token),
                UserSession.revoked_at.is_(None),
            )
            .values(revoked_at=_now())
        )
        await self.db.commit()

    async def prune(self, user_id: int) -> None:
        cutoff = _now() - timedelta(days=PRUNE_AFTER_DAYS)
        await self.db.execute(
            delete(UserSession).where(
                UserSession.user_id == user_id,
                or_(
                    UserSession.expires_at < cutoff,
                    UserSession.revoked_at < cutoff,
                ),
            )
        )
        await self.db.commit()
