from decimal import Decimal
from datetime import datetime
from typing import Optional, List, Literal

from pydantic import AliasChoices, BaseModel, Field


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
    msisdn: str = Field(..., min_length=1, description="Destination MSISDN")
    product_code: str = Field(..., min_length=1, description="Product code to inject")


class StockInjectRequest(BaseModel):
    """Inject stock vouchers (AWG / XWG) to one or more targets."""

    family: Literal["awg", "xwg"]
    targets: List[str] = Field(..., min_length=1, description="Destination MSISDNs")
    voucher_id: str = Field(..., min_length=1, description="vId from the stock row")
    allow_type: str = Field(..., min_length=1, description="allowType from the stock row")
    voucher_type_code: str = Field(..., min_length=1, description="Voucher code")
    description: Optional[str] = None
    price: Optional[Decimal] = None


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
    source: str = "app"
    destination: Optional[str] = None
    payment_method: Optional[str] = None
    request_timestamp: Optional[datetime] = None
    provider_response_timestamp: Optional[datetime] = None
    http_status_code: Optional[int] = None
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    metadata: Optional[dict] = Field(
        default=None,
        validation_alias=AliasChoices("metadata_", "metadata"),
    )
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class LocalTransactionDetailOut(LocalTransactionOut):
    raw_response: Optional[dict] = None
    raw_response_unmasked: Optional[dict] = None
    metadata_unmasked: Optional[dict] = None


class LocalTransactionSummary(BaseModel):
    total: int = 0
    success: int = 0
    failed: int = 0
    processing: int = 0
    success_amount: Decimal = Decimal("0")


class LocalTransactionListResponse(BaseModel):
    items: List[LocalTransactionOut]
    total: int
    page: int
    per_page: int
    total_pages: int
    summary: Optional[LocalTransactionSummary] = None
