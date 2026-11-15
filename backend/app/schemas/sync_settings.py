from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

# Interval choices exposed in the UI: 15 min, 1 h, 6 h, 24 h.
SYNC_INTERVALS = (15, 60, 360, 1440)


class SyncSettingsOut(BaseModel):
    enabled: bool
    interval_minutes: int
    last_sync_at: Optional[datetime] = None
    last_sync_status: Optional[str] = None
    last_sync_error: Optional[str] = None
    last_sync_count: Optional[int] = None
    next_sync_at: Optional[datetime] = None


class SyncSettingsUpdate(BaseModel):
    enabled: Optional[bool] = None
    interval_minutes: Optional[int] = None

    @field_validator("interval_minutes")
    @classmethod
    def _validate_interval(cls, value: Optional[int]) -> Optional[int]:
        if value is not None and value not in SYNC_INTERVALS:
            raise ValueError(f"interval_minutes harus salah satu dari {list(SYNC_INTERVALS)}")
        return value


class SyncRunResult(BaseModel):
    added: int
    synced_at: datetime
