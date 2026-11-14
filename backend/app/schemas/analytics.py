from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, Field


AnalyticsRange = Literal["7d", "30d", "90d", "month"]

NonDigitalTransactionType = Literal[
    "buy_pulsa",
    "buy_data_package",
    "package_injection",
    "cocktail_sf",
]

TopProductsTypeFilter = Literal[
    "buy_pulsa",
    "buy_data_package",
    "package_injection",
    "cocktail_sf",
    "all",
]


class AnalyticsWindow(BaseModel):
    key: AnalyticsRange
    start: datetime = Field(..., description="Inclusive UTC window start")
    end: datetime = Field(..., description="Exclusive UTC window end")
    elapsed_days: int = Field(..., ge=1)


class NonDigitalKpis(BaseModel):
    total: int = 0
    success: int = 0
    failed: int = 0
    processing: int = 0
    transaction_amount: Decimal = Decimal("0")
    successful_with_amount: int = 0
    average_successful_amount: Decimal | None = None
    success_rate: Decimal | None = Field(
        None, description="0-1 fraction; null when there are no terminal transactions"
    )
    error_rate: Decimal | None = Field(
        None, description="0-1 fraction; null when there are no terminal transactions"
    )
    transactions_per_day: Decimal = Decimal("0")


class DailyPoint(BaseModel):
    date: date
    total: int = 0
    success: int = 0
    failed: int = 0
    processing: int = 0
    transaction_amount: Decimal = Decimal("0")


class MdaValues(BaseModel):
    transaction_count: int = 0
    transaction_amount: Decimal = Decimal("0")
    transactions_per_day: Decimal = Decimal("0")
    amount_per_day: Decimal = Decimal("0")


class MonthlyMdaPoint(MdaValues):
    month: date
    elapsed_days: int = Field(..., ge=1)
    is_current_month: bool


class NonDigitalMda(BaseModel):
    current: MonthlyMdaPoint
    previous: MonthlyMdaPoint | None = None
    months: list[MonthlyMdaPoint] = Field(default_factory=list)


class BrandBreakdown(BaseModel):
    brand: str
    transaction_count: int = 0
    transaction_amount: Decimal = Decimal("0")


class BrandPerformance(BrandBreakdown):
    count_share: Decimal = Field(
        Decimal("0"), description="0-1 fraction of transactions"
    )
    amount_share: Decimal = Field(
        Decimal("0"), description="0-1 fraction of transaction amount"
    )


class TransactionTypePerformance(BaseModel):
    transaction_type: str
    transaction_count: int = 0
    transaction_amount: Decimal = Decimal("0")
    brands: list[BrandBreakdown] = Field(default_factory=list)


class TopProduct(BaseModel):
    transaction_type: str
    product_code: str | None = None
    product_name: str | None = None
    display_name: str
    brand: str
    transaction_count: int = 0
    transaction_amount: Decimal = Decimal("0")


class TopProductsResponse(BaseModel):
    range: AnalyticsWindow
    transaction_type: str | None = None
    brand: str | None = None
    items: list[TopProduct] = Field(default_factory=list)


class NonDigitalAnalyticsResponse(BaseModel):
    range: AnalyticsWindow
    kpis: NonDigitalKpis
    daily: list[DailyPoint] = Field(default_factory=list)
    mda: NonDigitalMda
    brands: list[BrandPerformance] = Field(default_factory=list)
    transaction_types: list[TransactionTypePerformance] = Field(default_factory=list)
