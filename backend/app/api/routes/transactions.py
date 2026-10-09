from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from datetime import datetime, timezone

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.local_transaction import LocalTransaction
from app.schemas.transaction import (
    BuyPulsaRequest,
    BuyDataPackageRequest,
    CocktailSFRequest,
    PackageInjectionRequest,
    TransactionResult,
    LocalTransactionOut,
    LocalTransactionDetailOut,
    LocalTransactionListResponse,
)
from app.services.transaction.buy_pulsa import BuyPulsaService
from app.services.transaction.buy_data_package import BuyDataPackageService
from app.services.transaction.cocktail_sf import CocktailSFService
from app.services.transaction.package_injection import PackageInjectionService
from app.services.pin_service import PinService, PinNotFoundError
from app.services.token_service import TokenFetchError
from app.services.provider_client import ProviderAPIError

router = APIRouter()


async def _require_pin(user_id: int, db: AsyncSession) -> None:
    svc = PinService(db)
    if not await svc.has_pin(user_id):
        raise HTTPException(status_code=400, detail="Transaction PIN not configured")


@router.post("/transactions/buy-pulsa", response_model=TransactionResult)
async def buy_pulsa(
    payload: BuyPulsaRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Buy Pulsa (W2P) — free-text denomination."""
    await _require_pin(current_user.id, db)
    svc = BuyPulsaService(db)
    try:
        record = await svc.execute(current_user.id, msisdn=payload.msisdn, denom=payload.denom)
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return TransactionResult(
        transaction_ref=record.transaction_ref,
        transaction_type=record.transaction_type,
        status=record.status,
        provider_reference=record.provider_reference,
        message="Transaction completed",
        amount=record.amount,
        destination=record.destination,
        created_at=record.created_at,
    )


@router.post("/transactions/buy-data-package", response_model=TransactionResult)
async def buy_data_package(
    payload: BuyDataPackageRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Buy Data Package — initial call + auto verification."""
    await _require_pin(current_user.id, db)
    svc = BuyDataPackageService(db)
    try:
        record = await svc.execute(current_user.id, msisdn=payload.msisdn, product_code=payload.product_code)
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return TransactionResult(
        transaction_ref=record.transaction_ref,
        transaction_type=record.transaction_type,
        status=record.status,
        provider_reference=record.provider_reference,
        message="Transaction submitted; verification running" if record.status == "PROCESSING" else "Transaction completed",
        destination=record.destination,
        created_at=record.created_at,
    )


@router.post("/transactions/cocktail-sf", response_model=TransactionResult)
async def cocktail_sf(
    payload: CocktailSFRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cocktail SF — inject VD SF to multiple SNs."""
    await _require_pin(current_user.id, db)
    svc = CocktailSFService(db)
    try:
        record = await svc.execute(current_user.id, product_code=payload.product_code, targets=payload.targets)
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return TransactionResult(
        transaction_ref=record.transaction_ref,
        transaction_type=record.transaction_type,
        status=record.status,
        provider_reference=record.provider_reference,
        message="Transaction completed",
        destination=",".join(payload.targets),
        created_at=record.created_at,
    )


@router.post("/transactions/package-injection", response_model=TransactionResult)
async def package_injection(
    payload: PackageInjectionRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Package Injection — inject package with verification flow."""
    await _require_pin(current_user.id, db)
    svc = PackageInjectionService(db)
    try:
        record = await svc.execute(current_user.id, msisdn=payload.msisdn, product_code=payload.product_code)
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return TransactionResult(
        transaction_ref=record.transaction_ref,
        transaction_type=record.transaction_type,
        status=record.status,
        provider_reference=record.provider_reference,
        message="Transaction submitted; verification running" if record.status == "PROCESSING" else "Transaction completed",
        destination=payload.msisdn,
        created_at=record.created_at,
    )


# ---------- Local Transaction History ----------

@router.get("/transactions/local", response_model=LocalTransactionListResponse)
async def get_local_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated local transaction history with filters."""
    query = select(LocalTransaction).where(LocalTransaction.user_id == current_user.id)
    if type:
        query = query.where(LocalTransaction.transaction_type == type)
    if status:
        query = query.where(LocalTransaction.status == status)
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        query = query.where(LocalTransaction.created_at >= start)
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        query = query.where(LocalTransaction.created_at <= end)

    query = query.order_by(desc(LocalTransaction.created_at))

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar_one()
    total_pages = max(1, (total + per_page - 1) // per_page) if total > 0 else 1
    page = max(1, min(page, total_pages))

    rows = await db.execute(
        query.offset((page - 1) * per_page).limit(per_page)
    )
    items = [LocalTransactionOut.model_validate(r) for r in rows.scalars().all()]

    return LocalTransactionListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


@router.get("/transactions/local/{tx_id}", response_model=LocalTransactionDetailOut)
async def get_local_transaction_detail(
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Transaction detail with masked raw response."""
    stmt = select(LocalTransaction).where(
        LocalTransaction.id == tx_id,
        LocalTransaction.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return LocalTransactionDetailOut.model_validate(record)


@router.post("/transactions/local/{tx_id}/refresh", response_model=TransactionResult)
async def refresh_transaction_status(
    tx_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Re-run verification flow for Data Package / Package Injection."""
    stmt = select(LocalTransaction).where(
        LocalTransaction.id == tx_id,
        LocalTransaction.user_id == current_user.id,
    )
    result = await db.execute(stmt)
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Transaction not found")

    if record.transaction_type == "buy_data_package":
        svc = BuyDataPackageService(db)
        updated = await svc.refresh_status(current_user.id, tx_id)
    elif record.transaction_type == "package_injection":
        svc = PackageInjectionService(db)
        updated = await svc.refresh_status(current_user.id, tx_id)
    else:
        raise HTTPException(status_code=400, detail="Transaction type does not support refresh")

    if not updated:
        raise HTTPException(status_code=404, detail="Transaction not found after refresh")

    return TransactionResult(
        transaction_ref=updated.transaction_ref,
        transaction_type=updated.transaction_type,
        status=updated.status,
        provider_reference=updated.provider_reference,
        message="Status refreshed",
        destination=updated.destination,
        created_at=updated.created_at,
    )