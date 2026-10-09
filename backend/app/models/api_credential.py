from sqlalchemy import Integer, String, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class ApiCredential(Base):
    __tablename__ = "api_credentials"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    api_name: Mapped[str] = mapped_column(String(100), nullable=False, default="get_token")
    client_id_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    client_secret_encrypted: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[bool] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[bool] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
