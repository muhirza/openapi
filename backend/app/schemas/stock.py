from datetime import datetime
from decimal import Decimal
from typing import List, Literal, Optional

from pydantic import BaseModel


StockFamily = Literal["awg", "xwg"]


class StockItemOut(BaseModel):
    """One stock (voucher) row, normalised across AWG and XWG."""

    voucher_type_code: str
    description: Optional[str] = None
    voucher_price: Optional[Decimal] = None
    voucher_balance: int = 0
    effective_date: Optional[str] = None
    expiration_date: Optional[str] = None
    voucher_exp_date: Optional[str] = None
    allow_type: Optional[str] = None
    voucher_id: Optional[str] = None


class StockListResponse(BaseModel):
    family: str
    items: List[StockItemOut]
    total: int
    stock_value: Decimal = Decimal("0")
    total_vouchers: int = 0
    ro_type: Optional[str] = None
    fetched_at: datetime
