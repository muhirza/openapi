from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from datetime import datetime, timedelta, timezone

from app.api.deps import get_current_user
from app.models.user import User
from app.models.local_transaction import LocalTransaction
from app.models.user_sync_setting import UserSyncSetting
from app.db.session import get_db
from app.schemas.history import HistoryResponse, HistoryStatus, TransactionItem
from app.services.history_service import HistoryService
from app.services.token_service import TokenFetchError
from app.services.provider_client import ProviderAPIError

router = APIRouter()


@router.get("/history/api")
async def get_api_history(
    days: int | None = Query(None, ge=1, le=90, description="Days back from today"),
    startdate: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    enddate: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch transaction history from provider API.

    Can specify either:
    - `days` (1-90) for relative range, OR
    - `startdate` + `enddate` (YYYY-MM-DD) for explicit range.
    """
    svc = HistoryService(db)
    try:
        return await svc.fetch_api_history(
            current_user.id, days=days, startdate=startdate, enddate=enddate
        )
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))


@router.get("/history/local")
async def get_local_history(
    days: int | None = Query(None, ge=1, le=90, description="Days back from today"),
    startdate: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    enddate: str | None = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get local transaction history (MVP2: populated from dashboard transactions)."""
    from datetime import datetime, timedelta, timezone

    query = select(LocalTransaction).where(LocalTransaction.user_id == current_user.id)

    if startdate and enddate:
        start = datetime.strptime(startdate, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        end = datetime.strptime(enddate, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        query = query.where(LocalTransaction.created_at >= start, LocalTransaction.created_at <= end)
    elif days is not None:
        start = datetime.now(timezone.utc) - timedelta(days=days)
        query = query.where(LocalTransaction.created_at >= start)

    query = query.order_by(LocalTransaction.created_at.desc())
    rows = await db.execute(query)
    records = rows.scalars().all()

    items = [
        TransactionItem(
            transaction_ref=r.transaction_ref,
            date=r.created_at,
            transaction_type=r.transaction_type,
            product=r.product_name or r.product_code,
            amount=r.amount,
            status=r.status,
            destination=r.destination,
            payment_method=r.payment_method,
            provider_reference=r.provider_reference,
            raw=r.raw_response or {},
        )
        for r in records
    ]

    return HistoryResponse(
        items=items,
        total=len(items),
        source="local",
        date_range=f"{startdate} to {enddate}" if startdate else (f"last {days} days" if days else "all"),
    )


@router.get("/history/status")
async def get_history_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get sync status for local history."""
    count = (await db.execute(
        select(func.count(LocalTransaction.id)).where(LocalTransaction.user_id == current_user.id)
    )).scalar_one()
    sync_row = (await db.execute(
        select(UserSyncSetting).where(UserSyncSetting.user_id == current_user.id)
    )).scalar_one_or_none()
    return HistoryStatus(
        last_api_sync=None,
        last_local_sync=sync_row.last_sync_at if sync_row else None,
        total_local=count,
    )