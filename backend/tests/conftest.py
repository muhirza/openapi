import os
import sys
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

# Keep imports side-effect free: the app must never open a real database
# connection while collecting tests.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.models.local_transaction import LocalTransaction
from app.models.product import Product  # noqa: F401 — registers metadata
from app.models.stock_transaction import StockTransaction  # noqa: F401
from app.models.user import User
from app.models.user_session import UserSession  # noqa: F401
from app.models.user_sync_setting import UserSyncSetting  # noqa: F401

NOW = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
IS_SQLITE = TEST_DATABASE_URL.startswith("sqlite")


@pytest.fixture
def now() -> datetime:
    return NOW


@pytest_asyncio.fixture
async def engine():
    # Phase 1 aggregates are portable. Set TEST_DATABASE_URL to a dedicated
    # PostgreSQL database to exercise the same queries on the production engine;
    # Phase 2's date_trunc-based MDA work should always run there.
    engine_kwargs = {}
    if IS_SQLITE:
        engine_kwargs = {
            "poolclass": StaticPool,
            "connect_args": {"check_same_thread": False},
        }

    engine = create_async_engine(TEST_DATABASE_URL, **engine_kwargs)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        yield engine
    finally:
        await engine.dispose()


@pytest_asyncio.fixture
async def db_session(engine):
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        try:
            yield session
        finally:
            await session.rollback()


@pytest_asyncio.fixture
async def users(db_session):
    first = User(username="pytest-user-a", password_hash="x")
    second = User(username="pytest-user-b", password_hash="x")
    db_session.add_all([first, second])
    await db_session.flush()
    return first, second


@pytest.fixture
def tx_factory():
    def build(
        tx_id: int,
        user_id: int,
        status: str = "SUCCESS",
        amount: Decimal | None = Decimal("1000.00"),
        transaction_type: str = "buy_pulsa",
        created_at: datetime = NOW,
        product_code: str | None = None,
        product_name: str | None = None,
    ) -> LocalTransaction:
        return LocalTransaction(
            id=tx_id,
            user_id=user_id,
            transaction_ref=f"pytest-ref-{tx_id}",
            transaction_type=transaction_type,
            status=status,
            amount=amount,
            product_code=product_code,
            product_name=product_name,
            created_at=created_at,
            source="app",
        )

    return build


@pytest.fixture
def product_factory():
    def build(
        product_id: int,
        user_id: int,
        product_code: str,
        owner: str | None = None,
        product_name: str | None = None,
        active: bool = True,
    ) -> Product:
        return Product(
            id=product_id,
            user_id=user_id,
            product_code=product_code,
            product_name=product_name if product_name is not None else product_code,
            owner=owner,
            active=active,
        )

    return build
