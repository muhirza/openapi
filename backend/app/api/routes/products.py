from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.models.user import User
from app.db.session import get_db
from app.schemas.product import ProductListResponse, SyncProductResult
from app.services.product_service import ProductService

router = APIRouter()


@router.get("/products")
async def list_products(
    active: bool | None = Query(None, description="Filter by active status"),
    search: str | None = Query(None, description="Search in code/name/type"),
    brand: str | None = Query(None, description="Filter by brand (owner)"),
    name: str | None = Query(None, description="Filter by product name"),
    product_type: str | None = Query(None, description="Filter by product type"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    per_page: int = Query(25, ge=1, le=100, description="Items per page"),
    sort_by: str | None = Query(None, description="Sort field: product_code, product_name, product_type, owner, price, active, last_synced_at"),
    sort_dir: str = Query("asc", description="Sort direction: asc or desc"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProductListResponse:
    """List cached products for the current user."""
    svc = ProductService(db)
    return await svc.list_products(
        current_user.id,
        active=active,
        search=search,
        brand=brand,
        name=name,
        product_type=product_type,
        page=page,
        per_page=per_page,
        sort_by=sort_by,
        sort_dir=sort_dir,
    )


@router.get("/products/status")
async def get_products_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get product catalog sync status."""
    svc = ProductService(db)
    return await svc.get_status(current_user.id)


@router.post("/products/sync")
async def sync_products(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SyncProductResult:
    """Trigger product catalog sync from provider.

    - New products -> inserted
    - Existing products -> updated
    - Products no longer returned -> marked inactive
    """
    svc = ProductService(db)
    return await svc.sync_products(current_user.id)