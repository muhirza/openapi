from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime
from typing import Optional, List


class TransactionItem(BaseModel):
    transaction_ref: str
    date: datetime
    transaction_type: str
    product: Optional[str] = None
    amount: Optional[Decimal] = None
    status: str
    destination: Optional[str] = None
    payment_method: Optional[str] = None
    provider_reference: Optional[str] = None
    raw: dict


class HistoryResponse(BaseModel):
    items: List[TransactionItem]
    total: int
    source: str
    date_range: str


class HistoryStatus(BaseModel):
    last_api_sync: Optional[datetime] = None
    last_local_sync: Optional[datetime] = None
    total_local: int = 0