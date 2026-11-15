from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, or_
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
    StockInjectRequest,
    TransactionResult,
    LocalTransactionOut,
    LocalTransactionDetailOut,
    LocalTransactionListResponse,
    LocalTransactionSummary,
)
from app.services.transaction.buy_pulsa import BuyPulsaService
from app.services.transaction.buy_data_package import BuyDataPackageService
from app.services.transaction.cocktail_sf import CocktailSFService
from app.services.transaction.package_injection import PackageInjectionService
from app.services.transaction.stock_inject import StockInjectService
from app.services.pin_service import PinService, PinNotFoundError
from app.services.token_service import TokenFetchError
from app.services.provider_client import ProviderAPIError
from app.services.history_export_service import (
    MAX_EXPORT_ROWS,
    export_filename,
    export_transactions_xlsx,
)

router = APIRouter()


async def _require_pin(user_id: int, db: AsyncSession) -> None:
    svc = PinService(db)
    if not await svc.has_pin(user_id):
        raise HTTPException(status_code=400, detail="PIN transaksi belum dikonfigurasi")


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


@router.post("/transactions/stock-inject", response_model=TransactionResult)
async def stock_inject(
    payload: StockInjectRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Inject AWG/XWG stock vouchers — recorded in the digital stock history."""
    await _require_pin(current_user.id, db)
    svc = StockInjectService(db, family=payload.family)
    try:
        record = await svc.execute(
            current_user.id,
            targets=payload.targets,
            voucher_id=payload.voucher_id,
            allow_type=payload.allow_type,
            voucher_type_code=payload.voucher_type_code,
            description=payload.description,
            price=payload.price,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except TokenFetchError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ProviderAPIError as e:
        raise HTTPException(status_code=502, detail=str(e))

    total = payload.price * len(payload.targets) if payload.price is not None else None
    return TransactionResult(
        transaction_ref=record.master_trx_id,
        transaction_type=svc.transaction_type,
        status=record.status,
        provider_reference=record.master_trx_id,
        message="Injection submitted; verification running" if record.status == "PROCESSING" else "Transaction completed",
        amount=total,
        destination=record.destination_msisdn,
        created_at=record.created_at,
    )


# ---------- Local Transaction History ----------

XLSX_MEDIA_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _local_history_conditions(
    user_id: int,
    type: Optional[str],
    status: Optional[str],
    source: Optional[str],
    search: Optional[str],
    start_date: Optional[str],
    end_date: Optional[str],
) -> tuple[list, list]:
    """Filters shared by the history list and its Excel export.

    Returns (conditions, facet_conditions). The facet copy excludes the status
    filter, so quick-filter counts stay accurate while one is applied.
    """
    conditions = [LocalTransaction.user_id == user_id]
    if type:
        conditions.append(LocalTransaction.transaction_type == type)
    if source:
        conditions.append(LocalTransaction.source == source)
    if search:
        pattern = f"%{search}%"
        conditions.append(
            or_(
                LocalTransaction.transaction_ref.ilike(pattern),
                LocalTransaction.provider_reference.ilike(pattern),
                LocalTransaction.destination.ilike(pattern),
                LocalTransaction.product_name.ilike(pattern),
                LocalTransaction.product_code.ilike(pattern),
            )
        )
    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
        conditions.append(LocalTransaction.created_at >= start)
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d").replace(hour=23, minute=59, second=59, tzinfo=timezone.utc)
        conditions.append(LocalTransaction.created_at <= end)

    facet_conditions = list(conditions)
    if status:
        conditions.append(LocalTransaction.status == status)
    return conditions, facet_conditions


@router.get("/transactions/local", response_model=LocalTransactionListResponse)
async def get_local_transactions(
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None, pattern=r"^(app|synced)$"),
    search: Optional[str] = Query(None, description="Search refs, destination, product"),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Paginated local transaction history with filters and a filtered summary."""
    conditions, facet_conditions = _local_history_conditions(
        current_user.id, type, status, source, search, start_date, end_date
    )

    total = (await db.execute(
        select(func.count()).select_from(select(LocalTransaction).where(*conditions).subquery())
    )).scalar_one()
    total_pages = max(1, (total + per_page - 1) // per_page) if total > 0 else 1
    page = max(1, min(page, total_pages))

    rows = await db.execute(
        select(LocalTransaction)
        .where(*conditions)
        .order_by(desc(LocalTransaction.created_at))
        .offset((page - 1) * per_page)
        .limit(per_page)
    )
    items = [LocalTransactionOut.model_validate(r) for r in rows.scalars().all()]

    # Facet counts across the whole filtered set (excluding the status filter itself)
    status_rows = (await db.execute(
        select(LocalTransaction.status, func.count(LocalTransaction.id))
        .where(*facet_conditions)
        .group_by(LocalTransaction.status)
    )).all()
    success_amount = (await db.execute(
        select(func.coalesce(func.sum(LocalTransaction.amount), 0))
        .where(*facet_conditions, LocalTransaction.status == "SUCCESS")
    )).scalar_one()

    counts = {str(s).upper(): c for s, c in status_rows}
    summary = LocalTransactionSummary(
        total=sum(counts.values()),
        success=counts.get("SUCCESS", 0),
        failed=counts.get("FAILED", 0),
        processing=counts.get("PROCESSING", 0),
        success_amount=success_amount,
    )

    return LocalTransactionListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
        summary=summary,
    )


@router.get("/transactions/local/export")
async def export_local_transactions(
    type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    source: Optional[str] = Query(None, pattern=r"^(app|synced)$"),
    search: Optional[str] = Query(None, description="Search refs, destination, product"),
    start_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    end_date: Optional[str] = Query(None, pattern=r"^\d{4}-\d{2}-\d{2}$"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export the currently filtered history as .xlsx.

    Only the filtered view is exportable (there is no dump-all path), and the
    result set is capped at MAX_EXPORT_ROWS to bound memory and download size.
    """
    conditions, _facet = _local_history_conditions(
        current_user.id, type, status, source, search, start_date, end_date
    )

    total = (await db.execute(
        select(func.count()).select_from(select(LocalTransaction).where(*conditions).subquery())
    )).scalar_one()

    if total == 0:
        raise HTTPException(status_code=404, detail="Tidak ada transaksi yang cocok dengan filter ini.")
    if total > MAX_EXPORT_ROWS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Ekspor dibatasi {MAX_EXPORT_ROWS:,} baris; filter ini cocok dengan "
                f"{total:,}. Persempit rentang tanggal atau tambahkan filter."
            ),
        )

    buffer = await export_transactions_xlsx(
        db, user_id=current_user.id, conditions=conditions, total=total
    )

    return Response(
        content=buffer.getvalue(),
        media_type=XLSX_MEDIA_TYPE,
        headers={
            "Content-Disposition": (
                f'attachment; filename="{export_filename(start_date, end_date)}"'
            ),
            "X-Export-Row-Count": str(total),
        },
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
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")
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
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan")

    if record.transaction_type == "buy_data_package":
        svc = BuyDataPackageService(db)
        updated = await svc.refresh_status(current_user.id, tx_id)
    elif record.transaction_type == "package_injection":
        svc = PackageInjectionService(db)
        updated = await svc.refresh_status(current_user.id, tx_id)
    else:
        raise HTTPException(status_code=400, detail="Tipe transaksi ini tidak mendukung pemuatan ulang")

    if not updated:
        raise HTTPException(status_code=404, detail="Transaksi tidak ditemukan setelah dimuat ulang")

    return TransactionResult(
        transaction_ref=updated.transaction_ref,
        transaction_type=updated.transaction_type,
        status=updated.status,
        provider_reference=updated.provider_reference,
        message="Status refreshed",
        destination=updated.destination,
        created_at=updated.created_at,
    )