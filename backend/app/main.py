import os
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, func, or_, and_

from app.api.routes import (
    analytics,
    auth,
    profile,
    balance,
    history,
    products,
    stock,
    stock_history,
    transactions,
)
from app.core.security import hash_password
from app.db.session import engine, AsyncSessionLocal
from app.models.base import Base
from app.models.user import User
from app.models.local_transaction import LocalTransaction
from app.models.stock_transaction import StockTransaction
from app.models.user_sync_setting import UserSyncSetting
from app.models.user_session import UserSession  # noqa: F401 — registered for create_all

logger = logging.getLogger("uvicorn.error")

app = FastAPI(title="Transaction Dashboard API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "X-Export-Row-Count"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(analytics.router, prefix="/api")
app.include_router(profile.router, prefix="/api")
app.include_router(balance.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(stock.router, prefix="/api")
app.include_router(stock_history.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")


RECHECK_INTERVAL_SECONDS = 60
RECHECK_BATCH_SIZE = 25
RECHECK_FAILED_LOOKBACK_DAYS = 7

SYNC_TICK_SECONDS = 60


async def recheck_open_transactions() -> int:
    """Re-verify async transactions (data package / package injection).

    Covers records still PROCESSING plus recent FAILED ones, so a transaction that
    was mis-classified before its provider result was available self-heals.
    """
    from app.services.transaction.buy_data_package import BuyDataPackageService
    from app.services.transaction.package_injection import PackageInjectionService

    cutoff = datetime.now(timezone.utc) - timedelta(days=RECHECK_FAILED_LOOKBACK_DAYS)
    updated = 0

    async with AsyncSessionLocal() as db:
        stmt = (
            select(
                LocalTransaction.id,
                LocalTransaction.user_id,
                LocalTransaction.transaction_type,
            )
            .where(
                LocalTransaction.transaction_type.in_(
                    ("buy_data_package", "package_injection")
                ),
                LocalTransaction.provider_reference.isnot(None),
                LocalTransaction.destination.isnot(None),
                or_(
                    LocalTransaction.status == "PROCESSING",
                    and_(
                        LocalTransaction.status == "FAILED",
                        LocalTransaction.created_at >= cutoff,
                    ),
                ),
            )
            .order_by(LocalTransaction.id.desc())
            .limit(RECHECK_BATCH_SIZE)
        )
        rows = (await db.execute(stmt)).all()

        for tx_id, user_id, tx_type in rows:
            try:
                if tx_type == "buy_data_package":
                    svc = BuyDataPackageService(db)
                else:
                    svc = PackageInjectionService(db)
                if await svc.refresh_status(user_id, tx_id):
                    updated += 1
            except Exception as e:  # keep the loop alive on any single failure
                logger.warning("Re-check failed for transaction %s: %s", tx_id, e)

    if updated:
        logger.info("Re-checked %s open transaction(s)", updated)
    return updated


async def _recheck_loop() -> None:
    while True:
        await asyncio.sleep(RECHECK_INTERVAL_SECONDS)
        try:
            await recheck_open_transactions()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("Re-check loop error: %s", e)
        try:
            await recheck_open_stock_transactions()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("Stock re-check loop error: %s", e)


_recheck_task: asyncio.Task | None = None


async def sync_due_history() -> int:
    """Run history sync for every user whose configured interval has elapsed.

    Users are synced one at a time so a provider call for one account never
    blocks or rate-limits another. Failures are logged and retried on the next
    tick; a single bad account cannot stop the loop.
    """
    from app.services.history_sync_service import HistorySyncService

    now = datetime.now(timezone.utc)

    async with AsyncSessionLocal() as db:
        settings_rows = (
            await db.execute(
                select(UserSyncSetting).where(UserSyncSetting.enabled.is_(True))
            )
        ).scalars().all()
        due_user_ids = [
            row.user_id
            for row in settings_rows
            if row.last_sync_at is None
            or row.last_sync_at + timedelta(minutes=row.interval_minutes) <= now
        ]

    synced = 0
    for user_id in due_user_ids:
        async with AsyncSessionLocal() as db:
            try:
                added = await HistorySyncService(db).sync_user(user_id)
                synced += 1
                if added:
                    logger.info("History sync: user %s added %s transaction(s)", user_id, added)
            except Exception as e:  # keep the loop alive on any single failure
                logger.warning("History sync failed for user %s: %s", user_id, e)

    return synced


async def _history_sync_loop() -> None:
    while True:
        await asyncio.sleep(SYNC_TICK_SECONDS)
        try:
            await sync_due_history()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning("History sync loop error: %s", e)


_history_sync_task: asyncio.Task | None = None


async def recheck_open_stock_transactions() -> int:
    """Re-check open digital stock transactions via the Info Transaction Detail API.

    Covers rows still PROCESSING plus recent FAILED ones, so an outcome that was
    inconclusive when the inject finished is picked up as soon as the provider
    reports it. This is the continuous status check for stock injections.
    """
    from app.services.stock_history_service import StockHistoryService

    cutoff = datetime.now(timezone.utc) - timedelta(days=RECHECK_FAILED_LOOKBACK_DAYS)
    updated = 0

    async with AsyncSessionLocal() as db:
        stmt = (
            select(StockTransaction.id)
            .where(
                StockTransaction.servicetype.in_(("SELLVOUCHER", "PHYSICALVOUCHER")),
                or_(
                    StockTransaction.status == "PROCESSING",
                    and_(
                        StockTransaction.status == "FAILED",
                        StockTransaction.created_at >= cutoff,
                    ),
                ),
            )
            .order_by(StockTransaction.id.desc())
            .limit(RECHECK_BATCH_SIZE)
        )
        tx_ids = (await db.execute(stmt)).scalars().all()

        service = StockHistoryService(db)
        for tx_id in tx_ids:
            record = (
                await db.execute(
                    select(StockTransaction).where(StockTransaction.id == tx_id)
                )
            ).scalar_one_or_none()
            if not record:
                continue
            try:
                await service.refresh_record(record)
                updated += 1
            except Exception as e:  # keep the loop alive on any single failure
                logger.warning("Stock re-check failed for transaction %s: %s", tx_id, e)

    if updated:
        logger.info("Re-checked %s open stock transaction(s)", updated)
    return updated


async def seed_first_user():
    async with AsyncSessionLocal() as db:
        count = (await db.execute(select(func.count(User.id)))).scalar_one()
        if count > 0:
            return
        username = os.getenv("SEED_USERNAME", "admin")
        password = os.getenv("SEED_PASSWORD", "admin12345")
        db.add(User(username=username, password_hash=hash_password(password)))
        await db.commit()
        logger.warning("Seeded first user '%s' (change via SEED_USERNAME/SEED_PASSWORD)", username)


@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_first_user()

    global _recheck_task, _history_sync_task
    if _recheck_task is None or _recheck_task.done():
        _recheck_task = asyncio.create_task(_recheck_loop())
    if _history_sync_task is None or _history_sync_task.done():
        _history_sync_task = asyncio.create_task(_history_sync_loop())

@app.get("/health")
async def health():
    return {"status": "ok"}
