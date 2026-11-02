from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.stock_transaction import StockTransaction
from app.models.user import User
from app.schemas.stock_history import (
    StockHistoryDetailOut,
    StockHistoryItem,
    StockHistoryListResponse,
    StockHistorySummary,
)
from app.services.provider_client import ProviderAPIError
from app.services.stock_history_service import StockHistoryService
from app.services.token_service import TokenFetchError

router = APIRouter()

STOCK_FAMILIES = ("awg", "xwg")


def _require_family(family: str) -> None:
    if family not in STOCK_FAMILIES:
        raise HTTPException(status_code=404, detail="Unknown stock family")


async def _get_record(
    db: AsyncSession, user_id: int, family: str, tx_id: int
) -> StockTransaction:
    result = await db.execute(
        select(StockTransaction).where(
            StockTransaction.id == tx_id,
            StockTransaction.user_id == user_id,
            StockTransaction.family == family,
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Stock transaction not found")
    return record


# ---------- Digital stock history ----------


@router.get("/stock/{family}/history", response_model=StockHistoryListResponse)
async def list_stock_history(
    family: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    servicetype: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None, description="Search description, voucher code, masterTrxId"),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated digital stock history (recorded by this system) with filters."""
    _require_family(family)

    conditions = [
        StockTransaction.user_id == current_user.id,
        StockTransaction.family == family,
    ]
    if servicetype:
        conditions.append(StockTransaction.servicetype == servicetype)
    if search:
        pattern = f"%{search}%"
        conditions.append(
            or_(
                StockTransaction.description.ilike(pattern),
                StockTransaction.voucher_type_code.ilike(pattern),
                StockTransaction.master_trx_id.ilike(pattern),
                StockTransaction.destination_msisdn.ilike(pattern),
            )
        )
    if start_date:
        conditions.append(StockTransaction.created_dtm >= date.fromisoformat(start_date))
    if end_date:
        conditions.append(StockTransaction.created_dtm <= date.fromisoformat(end_date))

    # The status filter narrows the list only; summary counts stay a facet of
    # the other filters so quick-filter counts remain accurate while applied.
    facet_conditions = list(conditions)
    if status:
        conditions.append(StockTransaction.status == status)

    total = (
        await db.execute(
            select(func.count()).select_from(
                select(StockTransaction).where(*conditions).subquery()
            )
        )
    ).scalar_one()
    total_pages = max(1, (total + per_page - 1) // per_page) if total > 0 else 1
    page = max(1, min(page, total_pages))

    rows = await db.execute(
        select(StockTransaction)
        .where(*conditions)
        .order_by(desc(StockTransaction.created_dtm), desc(StockTransaction.id))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = [StockHistoryItem.model_validate(r) for r in rows.scalars().all()]

    status_rows = (
        await db.execute(
            select(StockTransaction.status, func.count(StockTransaction.id))
            .where(*facet_conditions)
            .group_by(StockTransaction.status)
        )
    ).all()
    counts = {str(s).upper(): c for s, c in status_rows}
    summary = StockHistorySummary(
        total=sum(counts.values()),
        success=counts.get("SUCCESS", 0),
        failed=counts.get("FAILED", 0),
        processing=counts.get("PROCESSING", 0),
    )

    return StockHistoryListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        summary=summary,
    )


@router.get("/stock/{family}/history/{tx_id}", response_model=StockHistoryDetailOut)
async def get_stock_history_detail(
    family: str,
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stock transaction detail, including the cached provider detail rows."""
    _require_family(family)
    record = await _get_record(db, current_user.id, family, tx_id)
    return StockHistoryDetailOut.model_validate(record)


@router.post(
    "/stock/{family}/history/{tx_id}/refresh-detail",
    response_model=StockHistoryDetailOut,
)
async def refresh_stock_history_detail(
    family: str,
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Check this transaction's status via the Info Transaction Detail API.

    Stores the per-target rows on the record and updates its status.
    """
    _require_family(family)
    record = await _get_record(db, current_user.id, family, tx_id)

    try:
        record = await StockHistoryService(db).refresh_record(record)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return StockHistoryDetailOut.model_validate(record)
