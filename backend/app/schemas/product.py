from pydantic import BaseModel, Field
from decimal import Decimal
from datetime import datetime
from typing import Optional


class ProductOut(BaseModel):
    id: int
    product_code: str
    product_name: Optional[str] = None
    product_type: Optional[str] = None
    owner: Optional[str] = None
    price: Optional[Decimal] = None
    active: bool
    last_synced_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProductListResponse(BaseModel):
    products: list[ProductOut]
    total: int
    page: int
    per_page: int
    total_pages: int
    active_count: int
    inactive_count: int
    brands: list[str]
    product_types: list[str]


class SyncProductResult(BaseModel):
    success: bool
    inserted: int = 0
    updated: int = 0
    deactivated: int = 0
    total_active: int = 0
    synced_at: Optional[datetime] = None
    error: Optional[str] = None