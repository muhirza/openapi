from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import encrypt_value, decrypt_value
from app.models.user_pin import UserPin


class PinNotFoundError(Exception):
    pass


class PinService:
    """Static transaction PIN management.

    PIN is encrypted at rest, never returned to the frontend,
    and never logged.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_pin_record(self, user_id: int) -> Optional[UserPin]:
        result = await self.db.execute(
            select(UserPin).where(UserPin.user_id == user_id)
        )
        return result.scalar_one_or_none()

    async def has_pin(self, user_id: int) -> bool:
        return await self.get_pin_record(user_id) is not None

    async def set_pin(self, user_id: int, pin: str) -> UserPin:
        """Create or update the user's PIN (stored encrypted)."""
        record = await self.get_pin_record(user_id)
        now = datetime.now(timezone.utc)
        if record:
            record.pin_encrypted = encrypt_value(pin)
            record.updated_at = now
        else:
            record = UserPin(
                user_id=user_id,
                pin_encrypted=encrypt_value(pin),
            )
            self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return record

    async def get_pin(self, user_id: int) -> str:
        """Decrypt and return the PIN (in-memory use only)."""
        record = await self.get_pin_record(user_id)
        if not record:
            raise PinNotFoundError("No PIN configured")
        return decrypt_value(record.pin_encrypted)
