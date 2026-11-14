import os
import sys
from decimal import Decimal
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.api.deps import get_current_user
from app.db.session import get_db
from app.main import app


@pytest_asyncio.fixture
async def client(db_session):
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as http_client:
            yield http_client
    finally:
        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def anonymous_client():
    app.dependency_overrides.clear()
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as http_client:
        yield http_client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_requires_authentication(anonymous_client):
    response = await anonymous_client.get("/api/analytics/non-digital?range=30d")
    assert response.status_code == 401

    response = await anonymous_client.get(
        "/api/analytics/non-digital/top-products?range=30d"
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_returns_non_digital_kpis(client, db_session, users, tx_factory, now):
    user, other = users
    db_session.add_all(
        [
            tx_factory(101, user.id, created_at=now),
            tx_factory(
                102,
                user.id,
                status="FAILED",
                amount=Decimal("500.00"),
                created_at=now,
            ),
            tx_factory(103, other.id, created_at=now),
        ]
    )
    await db_session.flush()
    app.dependency_overrides[get_current_user] = lambda: user

    response = await client.get("/api/analytics/non-digital?range=30d")

    assert response.status_code == 200
    body = response.json()
    assert body["range"]["key"] == "30d"
    assert body["range"]["elapsed_days"] == 30
    assert body["kpis"]["total"] == 2
    assert body["kpis"]["success"] == 1
    assert body["kpis"]["failed"] == 1
    assert Decimal(str(body["kpis"]["success_rate"])) == Decimal("0.5000")
    assert Decimal(str(body["kpis"]["transaction_amount"])) == Decimal("1000.00")
    assert len(body["daily"]) == 30
    assert len(body["mda"]["months"]) == 6
    assert body["mda"]["current"]["is_current_month"] is True
    assert body["mda"]["previous"] is not None
    assert body["brands"][0]["brand"] == "Unknown"
    assert body["brands"][0]["transaction_count"] == 2
    assert len(body["transaction_types"]) == 4
    assert body["transaction_types"][0]["transaction_type"] == "buy_pulsa"


@pytest.mark.asyncio
async def test_empty_account_returns_zeroed_kpis(client, users):
    user, _ = users
    app.dependency_overrides[get_current_user] = lambda: user

    response = await client.get("/api/analytics/non-digital?range=month")

    assert response.status_code == 200
    body = response.json()
    assert body["kpis"]["total"] == 0
    assert body["kpis"]["success_rate"] is None
    assert body["kpis"]["error_rate"] is None
    assert len(body["daily"]) == body["range"]["elapsed_days"]
    assert all(point["total"] == 0 for point in body["daily"])
    assert len(body["mda"]["months"]) == 6


@pytest.mark.asyncio
async def test_defaults_to_thirty_days(client, users):
    user, _ = users
    app.dependency_overrides[get_current_user] = lambda: user

    response = await client.get("/api/analytics/non-digital")

    assert response.status_code == 200
    assert response.json()["range"]["key"] == "30d"


@pytest.mark.asyncio
async def test_rejects_unsupported_range(client, users):
    user, _ = users
    app.dependency_overrides[get_current_user] = lambda: user

    response = await client.get("/api/analytics/non-digital?range=45d")

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_top_products_route_filters_and_serializes(
    client, db_session, users, tx_factory, product_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            product_factory(
                1, user.id, "P1", owner="SF", product_name="Pulsa 10.000"
            ),
            tx_factory(
                1,
                user.id,
                transaction_type="buy_pulsa",
                product_code="P1",
                product_name="Pulsa 10.000",
                amount=Decimal("1000.00"),
                created_at=now,
            ),
            tx_factory(
                2,
                user.id,
                transaction_type="buy_pulsa",
                product_code="P1",
                product_name="Pulsa 10.000",
                amount=Decimal("1000.00"),
                created_at=now,
            ),
            tx_factory(
                3,
                user.id,
                transaction_type="buy_data_package",
                product_code="P1",
                amount=Decimal("2000.00"),
                created_at=now,
            ),
        ]
    )
    await db_session.flush()
    app.dependency_overrides[get_current_user] = lambda: user

    response = await client.get(
        "/api/analytics/non-digital/top-products"
        "?range=30d&transaction_type=buy_pulsa&brand=all&limit=5"
    )

    assert response.status_code == 200
    body = response.json()
    assert body["transaction_type"] == "buy_pulsa"
    assert body["brand"] == "all"
    assert len(body["items"]) == 1

    item = body["items"][0]
    assert item["brand"] == "SF"
    assert item["display_name"] == "Pulsa 10.000"
    assert item["transaction_count"] == 2
    assert Decimal(str(item["transaction_amount"])) == Decimal("2000.00")

    single_brand = await client.get(
        "/api/analytics/non-digital/top-products"
        "?range=30d&transaction_type=buy_pulsa&brand=SF"
    )
    assert single_brand.status_code == 200
    assert len(single_brand.json()["items"]) == 1

    empty_brand = await client.get(
        "/api/analytics/non-digital/top-products"
        "?range=30d&transaction_type=buy_pulsa&brand=AXIS"
    )
    assert empty_brand.status_code == 200
    assert empty_brand.json()["items"] == []


@pytest.mark.asyncio
async def test_top_products_route_validates_filters(client, users):
    user, _ = users
    app.dependency_overrides[get_current_user] = lambda: user

    invalid_type = await client.get(
        "/api/analytics/non-digital/top-products"
        "?range=30d&transaction_type=topup_wallet"
    )
    assert invalid_type.status_code == 422

    invalid_limit = await client.get(
        "/api/analytics/non-digital/top-products?range=30d&limit=100"
    )
    assert invalid_limit.status_code == 422
