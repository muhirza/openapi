from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime
from typing import Optional


class BalanceResponse(BaseModel):
    balance_type: str
    balance: Decimal
    currency: str = "IDR"
    fetched_at: datetime


class BalanceSummary(BaseModel):
    eload: Optional[BalanceResponse] = None
    dompul: Optional[BalanceResponse] = None