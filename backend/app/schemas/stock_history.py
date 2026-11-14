from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class StockHistoryItem(BaseModel):
    id: int
    family: str
    servicetype: str
    master_trx_id: str
    type: Optional[str] = None
    status: str
    status_raw: Optional[str] = None
    description: Optional[str] = None
    voucher_price: Optional[Decimal] = None
    price_normal: Optional[Decimal] = None
    voucher_type_code: Optional[str] = None
    source_msisdn: Optional[str] = None
    destination_msisdn: Optional[str] = None
    created_dtm: Optional[date] = None
    synced_at: Optional[datetime] = None
    detail_status: Optional[str] = None
    detail_fetched_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class StockHistoryDetailOut(StockHistoryItem):
    detail: Optional[list] = None
    raw_response: Optional[dict] = None
    raw_response_unmasked: Optional[dict] = None


class StockHistorySummary(BaseModel):
    total: int = 0
    success: int = 0
    failed: int = 0
    processing: int = 0


class StockHistoryListResponse(BaseModel):
    items: List[StockHistoryItem]
    total: int
    page: int
    per_page: int
    total_pages: int
    summary: Optional[StockHistorySummary] = None


# ---------- Provider lookup (Transaction Info page) ----------


class StockTransactionInfoRequest(BaseModel):
    """Lookup parameters mirroring the Info Transaction Detail API."""

    servicetype: str
    master_trx_id: str = Field(..., min_length=1, max_length=100)


class StockTransactionInfoRow(BaseModel):
    bMsisdn: Optional[str] = None
    status: Optional[str] = None
    statusDetail: Optional[str] = None


class StockTransactionInfoResponse(BaseModel):
    family: str
    servicetype: str
    master_trx_id: str
    status: Optional[str] = None
    rows: List[StockTransactionInfoRow] = []
    raw_response: Optional[dict] = None
