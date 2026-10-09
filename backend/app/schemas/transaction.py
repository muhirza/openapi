from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Literal

from pydantic import BaseModel, Field


# Status values used across local transaction records
TransactionStatus = Literal["SUCCESS", "FAILED", "PROCESSING"]


class BuyPulsaRequest(BaseModel):
    msisdn: str = Field(..., min_length=1, description="Customer MSISDN")
    denom: int = Field(..., description="Pulsa denomination (integer, e.g. 5000)")


class BuyDataPackageRequest(BaseModel):
    msisdn: str = Field(..., min_length=1, description="Customer MSISDN")
    product_code: str = Field(..., min_length=1, description="Provider product code")


class CocktailSFRequest(BaseModel):
    product_code: str = Field(..., min_length=1, description="VD SF product code")
    targets: List[str] = Field(..., min_length=1, description="SN list to inject")


class PackageInjectionRequest(BaseModel):
    msisdn: str = Field(..., min_length=1, description="Customer MSISDN")
    product_code: str = Field(..., min_length=1, description="Product code to inject")


class TransactionResult(BaseModel):
    transaction_ref: str
    transaction_type: str
    status: TransactionStatus
    provider_reference: Optional[str] = None
    message: Optional[str] = None
    amount: Optional[Decimal] = None
    destination: Optional[str] = None
    created_at: Optional[datetime] = None


class LocalTransactionOut(BaseModel):
    id: int
    transaction_ref: str
    transaction_type: str
    product_code: Optional[str] = None
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    amount: Optional[Decimal] = None
    status: str
    provider_reference: Optional[str] = None
    destination: Optional[str] = None
    payment_method: Optional[str] = None
    request_timestamp: Optional[datetime] = None
    provider_response_timestamp: Optional[datetime] = None
    http_status_code: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Optional[dict] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LocalTransactionDetailOut(LocalTransactionOut):
    raw_response: Optional[dict] = None


class LocalTransactionListResponse(BaseModel):
    items: List[LocalTransactionOut]
    total: int
    page: int
    per_page: int
    total_pages: int
