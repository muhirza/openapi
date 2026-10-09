from sqlalchemy import Integer, String, DateTime, func, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ApiToken(Base):
    __tablename__ = "api_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    api_name: Mapped[str] = mapped_column(String(100), nullable=False, default="get_token")
    access_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    expires_at: Mapped[bool] = mapped_column(DateTime(timezone=True), nullable=False)
    scope: Mapped[str | None] = mapped_column(Text, nullable=True)
    token_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[bool] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[bool] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
