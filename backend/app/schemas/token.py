from pydantic import BaseModel
from datetime import datetime


class TokenStatus(BaseModel):
    has_token: bool
    expires_at: datetime | None = None
    is_valid: bool = False


class TokenRefreshResponse(BaseModel):
    success: bool
    expires_at: datetime | None = None
    error: str | None = None
