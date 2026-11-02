from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Date,
    DateTime,
    Index,
    JSON,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class StockTransaction(Base):
    """Digital stock transaction history pulled from the AWG/XWG provider.

    Kept separate from `local_transactions` (non-stock transaction history):
    this table holds provider-side stock operations (inject SP, inject voucher,
    transfer stock, buy stock, extend stock, ...) synced through the
    get-(awg|xwg)transactioninfo endpoints.
    """

    __tablename__ = "stock_transactions"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "master_trx_id", name="uq_stock_transactions_user_master"
        ),
        Index(
            "idx_stock_transactions_user_family_date",
            "user_id",
            "family",
            "created_dtm",
        ),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    family: Mapped[str] = mapped_column(String(10), nullable=False)
    servicetype: Mapped[str] = mapped_column(String(30), nullable=False)
    master_trx_id: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(50), nullable=False)
    status_raw: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    voucher_price: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    price_normal: Mapped[Decimal | None] = mapped_column(Numeric(18, 2), nullable=True)
    voucher_type_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    source_msisdn: Mapped[str | None] = mapped_column(String(50), nullable=True)
    destination_msisdn: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_dtm: Mapped[date | None] = mapped_column(Date, nullable=True)
    detail_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    detail: Mapped[list | None] = mapped_column(JSON, nullable=True)
    detail_fetched_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    raw_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    raw_response_unmasked: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
