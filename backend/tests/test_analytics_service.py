from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.services.analytics_service import AnalyticsService


@pytest.mark.asyncio
async def test_scopes_kpis_to_the_requesting_user(db_session, users, tx_factory, now):
    first, second = users
    db_session.add_all(
        [
            tx_factory(1, first.id, created_at=now),
            tx_factory(2, first.id, created_at=now),
            tx_factory(3, second.id, created_at=now),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        first.id, "30d", now=now
    )

    assert result.kpis.total == 2
    assert result.kpis.success == 2
    assert result.kpis.transaction_amount == Decimal("2000.00")


@pytest.mark.asyncio
async def test_only_non_digital_transaction_types_are_counted(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(1, user.id, transaction_type="buy_pulsa", created_at=now),
            tx_factory(2, user.id, transaction_type="buy_data_package", created_at=now),
            tx_factory(3, user.id, transaction_type="package_injection", created_at=now),
            tx_factory(4, user.id, transaction_type="cocktail_sf", created_at=now),
            tx_factory(5, user.id, transaction_type="inject_awg", created_at=now),
            tx_factory(6, user.id, transaction_type="topup_wallet", created_at=now),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert result.kpis.total == 4


@pytest.mark.asyncio
async def test_range_start_is_inclusive_and_end_is_exclusive(
    db_session, users, tx_factory, now
):
    user, _ = users
    window = AnalyticsService.resolve_window("30d", now)

    db_session.add_all(
        [
            tx_factory(
                1, user.id, created_at=window.start - timedelta(microseconds=1)
            ),
            tx_factory(2, user.id, created_at=window.start),
            tx_factory(
                3, user.id, created_at=window.end - timedelta(microseconds=1)
            ),
            tx_factory(4, user.id, created_at=window.end),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert result.kpis.total == 2


@pytest.mark.asyncio
async def test_processing_is_excluded_from_the_error_denominator(
    db_session, users, tx_factory, now
):
    user, _ = users
    rows = [
        tx_factory(1, user.id, status="SUCCESS", created_at=now),
        tx_factory(2, user.id, status="SUCCESS", created_at=now),
        tx_factory(3, user.id, status="SUCCESS", created_at=now),
        tx_factory(4, user.id, status="FAILED", created_at=now),
    ]
    rows.extend(
        tx_factory(10 + index, user.id, status="PROCESSING", created_at=now)
        for index in range(5)
    )
    db_session.add_all(rows)
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert result.kpis.total == 9
    assert result.kpis.success == 3
    assert result.kpis.failed == 1
    assert result.kpis.processing == 5
    assert result.kpis.success_rate == Decimal("0.7500")
    assert result.kpis.error_rate == Decimal("0.2500")


@pytest.mark.asyncio
async def test_amounts_ignore_failed_and_missing_values(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(
                1, user.id, status="SUCCESS", amount=Decimal("10000.00"), created_at=now
            ),
            tx_factory(2, user.id, status="SUCCESS", amount=None, created_at=now),
            tx_factory(
                3, user.id, status="SUCCESS", amount=Decimal("2500.00"), created_at=now
            ),
            tx_factory(
                4, user.id, status="FAILED", amount=Decimal("5000.00"), created_at=now
            ),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert result.kpis.transaction_amount == Decimal("12500.00")
    assert result.kpis.successful_with_amount == 2
    assert result.kpis.average_successful_amount == Decimal("6250.00")


@pytest.mark.asyncio
async def test_rates_are_null_when_no_terminal_transactions_exist(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(1, user.id, status="PROCESSING", created_at=now),
            tx_factory(2, user.id, status="PROCESSING", created_at=now),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert result.kpis.total == 2
    assert result.kpis.success_rate is None
    assert result.kpis.error_rate is None


@pytest.mark.asyncio
async def test_empty_account_returns_stable_zeroes(db_session, users, now):
    user, _ = users

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert result.kpis.total == 0
    assert result.kpis.success == 0
    assert result.kpis.failed == 0
    assert result.kpis.processing == 0
    assert result.kpis.transaction_amount == Decimal("0.00")
    assert result.kpis.average_successful_amount is None
    assert result.kpis.success_rate is None
    assert result.kpis.error_rate is None
    assert result.kpis.transactions_per_day == Decimal("0.00")


@pytest.mark.asyncio
async def test_transactions_per_day_uses_the_selected_range(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        tx_factory(100 + index, user.id, created_at=now) for index in range(14)
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "7d", now=now
    )

    assert result.range.elapsed_days == 7
    assert result.kpis.transactions_per_day == Decimal("2.00")


@pytest.mark.asyncio
async def test_month_range_uses_elapsed_calendar_days(
    db_session, users, tx_factory, now
):
    user, _ = users
    window = AnalyticsService.resolve_window("month", now)

    assert window.start == datetime(2026, 11, 1, tzinfo=timezone.utc)
    assert window.end == datetime(2026, 11, 15, tzinfo=timezone.utc)
    assert window.elapsed_days == 14

    db_session.add_all(
        [
            tx_factory(
                1,
                user.id,
                created_at=datetime(2026, 10, 31, 23, 59, 59, 999999, tzinfo=timezone.utc),
            ),
            tx_factory(2, user.id, created_at=datetime(2026, 11, 1, tzinfo=timezone.utc)),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "month", now=now
    )

    assert result.kpis.total == 1


@pytest.mark.asyncio
async def test_unknown_status_only_contributes_to_the_total(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add(tx_factory(1, user.id, status="PENDING", created_at=now))
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert result.kpis.total == 1
    assert result.kpis.success == 0
    assert result.kpis.failed == 0
    assert result.kpis.processing == 0
    assert result.kpis.success_rate is None
    assert result.kpis.error_rate is None


def test_resolve_window_rejects_unsupported_ranges(now):
    with pytest.raises(ValueError):
        AnalyticsService.resolve_window("45d", now)


@pytest.mark.asyncio
async def test_daily_series_is_continuous_and_zero_filled(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(
                1,
                user.id,
                amount=Decimal("1000.00"),
                created_at=datetime(2026, 11, 8, 9, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                2,
                user.id,
                amount=Decimal("2000.00"),
                created_at=datetime(2026, 11, 10, 9, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                3,
                user.id,
                status="FAILED",
                amount=Decimal("500.00"),
                created_at=datetime(2026, 11, 10, 10, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                4,
                user.id,
                amount=None,
                created_at=datetime(2026, 11, 14, 9, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                5,
                user.id,
                status="PROCESSING",
                amount=None,
                created_at=datetime(2026, 11, 12, 9, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "7d", now=now
    )

    assert len(result.daily) == 7
    assert result.daily[0].date == date(2026, 11, 8)
    assert result.daily[-1].date == date(2026, 11, 14)

    by_date = {point.date: point for point in result.daily}
    assert by_date[date(2026, 11, 8)].total == 1
    assert by_date[date(2026, 11, 8)].transaction_amount == Decimal("1000.00")
    assert by_date[date(2026, 11, 9)].total == 0
    assert by_date[date(2026, 11, 9)].transaction_amount == Decimal("0.00")
    assert by_date[date(2026, 11, 10)].total == 2
    assert by_date[date(2026, 11, 10)].success == 1
    assert by_date[date(2026, 11, 10)].failed == 1
    assert by_date[date(2026, 11, 10)].transaction_amount == Decimal("2000.00")
    assert by_date[date(2026, 11, 12)].processing == 1
    assert by_date[date(2026, 11, 14)].total == 1
    assert by_date[date(2026, 11, 14)].transaction_amount == Decimal("0.00")


@pytest.mark.asyncio
async def test_mda_returns_six_months_with_current_and_previous(
    db_session, users, now
):
    user, _ = users

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert [point.month for point in result.mda.months] == [
        date(2026, 6, 1),
        date(2026, 7, 1),
        date(2026, 8, 1),
        date(2026, 9, 1),
        date(2026, 10, 1),
        date(2026, 11, 1),
    ]
    assert result.mda.current.month == date(2026, 11, 1)
    assert result.mda.current.is_current_month is True
    assert result.mda.previous.month == date(2026, 10, 1)
    assert result.mda.previous.is_current_month is False


@pytest.mark.asyncio
async def test_mda_uses_elapsed_days_for_current_and_full_days_for_closed_months(
    db_session, users, tx_factory, now
):
    user, _ = users
    rows = [
        tx_factory(
            1000 + index,
            user.id,
            amount=Decimal("1000.00"),
            created_at=datetime(2026, 11, 14, 9, 0, tzinfo=timezone.utc),
        )
        for index in range(28)
    ]
    rows += [
        tx_factory(
            2000 + index,
            user.id,
            amount=Decimal("1000.00"),
            created_at=datetime(2026, 10, 15, 9, 0, tzinfo=timezone.utc),
        )
        for index in range(10)
    ]
    db_session.add_all(rows)
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )
    current = result.mda.current
    previous = result.mda.previous

    assert current.elapsed_days == 14
    assert current.transaction_count == 28
    assert current.transaction_amount == Decimal("28000.00")
    assert current.transactions_per_day == Decimal("2.00")
    assert current.amount_per_day == Decimal("2000.00")

    assert previous.elapsed_days == 31
    assert previous.transaction_count == 10
    assert previous.transactions_per_day == Decimal("0.32")
    assert previous.amount_per_day == Decimal("322.58")


@pytest.mark.asyncio
async def test_mda_counts_all_statuses_but_only_successful_amounts(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(
                1,
                user.id,
                status="SUCCESS",
                amount=Decimal("1000.00"),
                created_at=datetime(2026, 11, 14, 9, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                2,
                user.id,
                status="FAILED",
                amount=Decimal("500.00"),
                created_at=datetime(2026, 11, 14, 10, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                3,
                user.id,
                status="PROCESSING",
                amount=None,
                created_at=datetime(2026, 11, 14, 11, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "month", now=now
    )

    assert result.mda.current.transaction_count == 3
    assert result.mda.current.transaction_amount == Decimal("1000.00")


@pytest.mark.asyncio
async def test_mda_handles_leap_year_february(db_session, users):
    user, _ = users
    leap_now = datetime(2024, 3, 10, 12, 0, tzinfo=timezone.utc)

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "month", now=leap_now
    )

    assert [point.month for point in result.mda.months] == [
        date(2023, 10, 1),
        date(2023, 11, 1),
        date(2023, 12, 1),
        date(2024, 1, 1),
        date(2024, 2, 1),
        date(2024, 3, 1),
    ]
    by_month = {point.month: point for point in result.mda.months}
    assert by_month[date(2024, 2, 1)].elapsed_days == 29
    assert by_month[date(2024, 3, 1)].elapsed_days == 10
    assert result.mda.current.month == date(2024, 3, 1)


@pytest.mark.asyncio
async def test_daily_and_monthly_totals_reconcile_with_kpis(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(
                1,
                user.id,
                amount=Decimal("1000.00"),
                created_at=datetime(2026, 11, 8, 9, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                2,
                user.id,
                status="FAILED",
                amount=Decimal("500.00"),
                created_at=datetime(2026, 11, 10, 9, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                3,
                user.id,
                status="PROCESSING",
                amount=None,
                created_at=datetime(2026, 11, 12, 9, 0, tzinfo=timezone.utc),
            ),
            tx_factory(
                4,
                user.id,
                amount=None,
                created_at=datetime(2026, 11, 14, 9, 0, tzinfo=timezone.utc),
            ),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "month", now=now
    )

    assert sum(point.total for point in result.daily) == result.kpis.total
    assert sum(point.success for point in result.daily) == result.kpis.success
    assert sum(point.failed for point in result.daily) == result.kpis.failed
    assert sum(point.processing for point in result.daily) == result.kpis.processing
    assert sum(
        (point.transaction_amount for point in result.daily), Decimal("0")
    ) == result.kpis.transaction_amount
    assert result.mda.current.transaction_count == result.kpis.total
    assert (
        result.mda.current.transaction_amount
        == result.kpis.transaction_amount
        == Decimal("1000.00")
    )


@pytest.mark.asyncio
async def test_brand_performance_groups_and_falls_back_to_unknown(
    db_session, users, tx_factory, product_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            product_factory(1, user.id, "P1", owner="SF"),
            product_factory(2, user.id, "P2", owner="XL"),
            product_factory(3, user.id, "P3", owner="AXIS"),
            product_factory(4, user.id, "P4", owner=None),
            product_factory(5, user.id, "P5", owner="   "),
        ]
    )
    db_session.add_all(
        [
            tx_factory(
                1, user.id, product_code="P1", amount=Decimal("1000.00"), created_at=now
            ),
            tx_factory(
                2,
                user.id,
                status="FAILED",
                product_code="P1",
                amount=Decimal("500.00"),
                created_at=now,
            ),
            tx_factory(
                3, user.id, product_code="P2", amount=Decimal("2000.00"), created_at=now
            ),
            tx_factory(
                4, user.id, product_code="P3", amount=Decimal("3000.00"), created_at=now
            ),
            tx_factory(
                5, user.id, product_code="P4", amount=Decimal("4000.00"), created_at=now
            ),
            tx_factory(
                6, user.id, product_code="P5", amount=Decimal("5000.00"), created_at=now
            ),
            tx_factory(
                7,
                user.id,
                product_code="MISSING",
                amount=Decimal("6000.00"),
                created_at=now,
            ),
            tx_factory(
                8, user.id, product_code=None, amount=Decimal("7000.00"), created_at=now
            ),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert [
        (item.brand, item.transaction_count, item.transaction_amount)
        for item in result.brands
    ] == [
        ("Unknown", 4, Decimal("22000.00")),
        ("SF", 2, Decimal("1000.00")),
        ("AXIS", 1, Decimal("3000.00")),
        ("XL", 1, Decimal("2000.00")),
    ]
    assert abs(
        sum((item.count_share for item in result.brands), Decimal("0"))
        - Decimal("1")
    ) <= Decimal("0.0001")
    assert abs(
        sum((item.amount_share for item in result.brands), Decimal("0"))
        - Decimal("1")
    ) <= Decimal("0.0002")


@pytest.mark.asyncio
async def test_brand_join_is_scoped_by_user_and_product_code(
    db_session, users, tx_factory, product_factory, now
):
    first, second = users
    db_session.add_all(
        [
            product_factory(1, first.id, "SHARED", owner="A-BRAND"),
            product_factory(2, second.id, "SHARED", owner="B-BRAND"),
            tx_factory(1, first.id, product_code="SHARED", created_at=now),
            tx_factory(2, second.id, product_code="SHARED", created_at=now),
        ]
    )
    await db_session.flush()

    service = AnalyticsService(db_session)
    first_result = await service.get_non_digital(first.id, "30d", now=now)
    second_result = await service.get_non_digital(second.id, "30d", now=now)

    assert [item.brand for item in first_result.brands] == ["A-BRAND"]
    assert [item.brand for item in second_result.brands] == ["B-BRAND"]
    assert first_result.kpis.total == 1
    assert second_result.kpis.total == 1


@pytest.mark.asyncio
async def test_inactive_products_still_resolve_brand(
    db_session, users, tx_factory, product_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            product_factory(1, user.id, "OLD", owner="SF", active=False),
            tx_factory(1, user.id, product_code="OLD", created_at=now),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert [(item.brand, item.transaction_count) for item in result.brands] == [
        ("SF", 1)
    ]


@pytest.mark.asyncio
async def test_transaction_type_performance_includes_all_types_and_brand_mix(
    db_session, users, tx_factory, product_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            product_factory(1, user.id, "P-SF", owner="SF"),
            product_factory(2, user.id, "P-XL", owner="XL"),
            tx_factory(
                1,
                user.id,
                transaction_type="buy_pulsa",
                product_code="P-SF",
                amount=Decimal("1000.00"),
                created_at=now,
            ),
            tx_factory(
                2,
                user.id,
                transaction_type="buy_pulsa",
                product_code="P-XL",
                amount=Decimal("2000.00"),
                created_at=now,
            ),
            tx_factory(
                3,
                user.id,
                transaction_type="buy_data_package",
                product_code="P-SF",
                amount=Decimal("3000.00"),
                created_at=now,
            ),
            tx_factory(
                4,
                user.id,
                transaction_type="cocktail_sf",
                product_code="P-XL",
                amount=Decimal("4000.00"),
                created_at=now,
            ),
        ]
    )
    await db_session.flush()

    result = await AnalyticsService(db_session).get_non_digital(
        user.id, "30d", now=now
    )

    assert [item.transaction_type for item in result.transaction_types] == [
        "buy_pulsa",
        "buy_data_package",
        "package_injection",
        "cocktail_sf",
    ]

    buy_pulsa = result.transaction_types[0]
    assert buy_pulsa.transaction_count == 2
    assert buy_pulsa.transaction_amount == Decimal("3000.00")
    assert [
        (item.brand, item.transaction_count, item.transaction_amount)
        for item in buy_pulsa.brands
    ] == [
        ("XL", 1, Decimal("2000.00")),
        ("SF", 1, Decimal("1000.00")),
    ]

    injection = result.transaction_types[2]
    assert injection.transaction_count == 0
    assert injection.transaction_amount == Decimal("0.00")
    assert injection.brands == []


@pytest.mark.asyncio
async def test_top_products_orders_caps_and_filters_by_brand(
    db_session, users, tx_factory, product_factory, now
):
    user, _ = users
    owners = {1: "SF", 2: "SF", 3: "SF", 4: "XL", 5: "XL", 6: "AXIS"}
    db_session.add_all(
        [
            product_factory(
                product_id,
                user.id,
                f"P{product_id}",
                owner=owner,
                product_name=f"Product {product_id}",
            )
            for product_id, owner in owners.items()
        ]
    )

    rows = []
    tx_id = 100
    for product_id, count in ((1, 6), (2, 5), (3, 4), (4, 3), (5, 2), (6, 1)):
        for _ in range(count):
            rows.append(
                tx_factory(
                    tx_id,
                    user.id,
                    transaction_type="buy_pulsa",
                    product_code=f"P{product_id}",
                    amount=Decimal("1000.00"),
                    created_at=now,
                )
            )
            tx_id += 1
    db_session.add_all(rows)
    await db_session.flush()

    service = AnalyticsService(db_session)
    response = await service.get_top_products(
        user.id, "30d", transaction_type="buy_pulsa", brand="all", limit=5, now=now
    )

    assert [item.product_code for item in response.items] == [
        "P1",
        "P2",
        "P3",
        "P4",
        "P5",
    ]
    assert [item.transaction_count for item in response.items] == [6, 5, 4, 3, 2]
    assert len(response.items) == 5

    sf_response = await service.get_top_products(
        user.id, "30d", transaction_type="buy_pulsa", brand="SF", limit=5, now=now
    )

    assert [item.product_code for item in sf_response.items] == ["P1", "P2", "P3"]
    assert all(item.brand == "SF" for item in sf_response.items)


@pytest.mark.asyncio
async def test_top_products_filters_type_and_uses_display_fallback(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(
                1,
                user.id,
                transaction_type="buy_pulsa",
                product_code="CODE-1",
                product_name=None,
                created_at=now,
            ),
            tx_factory(
                2,
                user.id,
                transaction_type="buy_data_package",
                product_code="CODE-2",
                product_name="Data Product",
                created_at=now,
            ),
            tx_factory(
                3,
                user.id,
                transaction_type="buy_pulsa",
                product_code=None,
                product_name=None,
                created_at=now,
            ),
        ]
    )
    await db_session.flush()

    service = AnalyticsService(db_session)
    response = await service.get_top_products(
        user.id, "30d", transaction_type="buy_pulsa", brand="all", limit=10, now=now
    )

    assert {item.transaction_type for item in response.items} == {"buy_pulsa"}
    assert {item.display_name for item in response.items} == {
        "CODE-1",
        "Unknown product",
    }

    all_types = await service.get_top_products(
        user.id, "30d", transaction_type="all", brand="all", limit=10, now=now
    )

    assert {item.transaction_type for item in all_types.items} == {
        "buy_pulsa",
        "buy_data_package",
    }


@pytest.mark.asyncio
async def test_top_products_breaks_ties_by_amount_then_name(
    db_session, users, tx_factory, now
):
    user, _ = users
    db_session.add_all(
        [
            tx_factory(
                1,
                user.id,
                product_code="A",
                product_name="Alpha",
                amount=Decimal("1000.00"),
                created_at=now,
            ),
            tx_factory(
                2,
                user.id,
                product_code="B",
                product_name="Beta",
                amount=Decimal("2000.00"),
                created_at=now,
            ),
            tx_factory(
                3,
                user.id,
                product_code="C",
                product_name="Gamma",
                amount=Decimal("2000.00"),
                created_at=now,
            ),
        ]
    )
    await db_session.flush()

    response = await AnalyticsService(db_session).get_top_products(
        user.id, "30d", transaction_type="all", brand="all", limit=10, now=now
    )

    assert [item.product_name for item in response.items] == [
        "Beta",
        "Gamma",
        "Alpha",
    ]
