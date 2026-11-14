from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.analytics import (
    AnalyticsRange,
    NonDigitalAnalyticsResponse,
    TopProductsResponse,
    TopProductsTypeFilter,
)
from app.services.analytics_service import AnalyticsService


router = APIRouter()


@router.get(
    "/analytics/non-digital",
    response_model=NonDigitalAnalyticsResponse,
)
async def get_non_digital_analytics(
    range_key: AnalyticsRange = Query(
        "30d",
        alias="range",
        description="Reporting window: 7d, 30d, 90d, or month",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Core KPIs and breakdowns for non-digital (MVP1) transactions."""
    return await AnalyticsService(db).get_non_digital(current_user.id, range_key)


@router.get(
    "/analytics/non-digital/top-products",
    response_model=TopProductsResponse,
)
async def get_non_digital_top_products(
    range_key: AnalyticsRange = Query(
        "30d",
        alias="range",
        description="Reporting window: 7d, 30d, 90d, or month",
    ),
    transaction_type: TopProductsTypeFilter | None = Query(
        None,
        description="Transaction type filter; use 'all' or omit for every MVP1 type",
    ),
    brand: str | None = Query(
        None,
        min_length=1,
        max_length=100,
        description="Brand filter; use 'all' or omit for every brand",
    ),
    limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Bounded top-product ranking for a type and brand within the range."""
    return await AnalyticsService(db).get_top_products(
        current_user.id,
        range_key,
        transaction_type=transaction_type,
        brand=brand,
        limit=limit,
    )
