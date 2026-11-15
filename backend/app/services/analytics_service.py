import calendar
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal, ROUND_HALF_UP

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.local_transaction import LocalTransaction
from app.models.product import Product
from app.schemas.analytics import (
    AnalyticsWindow,
    BrandBreakdown,
    BrandPerformance,
    DailyPoint,
    MonthlyMdaPoint,
    NonDigitalAnalyticsResponse,
    NonDigitalKpis,
    NonDigitalMda,
    TopProduct,
    TopProductsResponse,
    TransactionTypePerformance,
)


NON_DIGITAL_TRANSACTION_TYPES = (
    "buy_pulsa",
    "buy_data_package",
    "package_injection",
    "cocktail_sf",
)

RANGE_DAYS = {"7d": 7, "30d": 30, "90d": 90}
MDA_MONTHS = 6

RATE_PLACES = Decimal("0.0001")
SHARE_PLACES = Decimal("0.0001")
MONEY_PLACES = Decimal("0.01")

UNKNOWN_BRAND = "Unknown"
UNKNOWN_PRODUCT = "Unknown product"


def _money(value) -> Decimal:
    return Decimal(str(value or 0)).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP)


def _rate(part: int, whole: int) -> Decimal | None:
    if whole <= 0:
        return None
    return (Decimal(part) / Decimal(whole)).quantize(
        RATE_PLACES, rounding=ROUND_HALF_UP
    )


def _as_date(value) -> date:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return date.fromisoformat(str(value)[:10])


def _add_months(month_start: date, delta: int) -> date:
    index = month_start.year * 12 + (month_start.month - 1) + delta
    return date(index // 12, index % 12 + 1, 1)


class AnalyticsService:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def resolve_window(range_key: str, now: datetime | None = None) -> AnalyticsWindow:
        """Return the inclusive start and exclusive end of a dashboard range.

        Day buckets are UTC calendar days. The current day is always included
        in full, so `end` is the start of tomorrow.
        """
        if range_key not in RANGE_DAYS and range_key != "month":
            raise ValueError(f"Rentang analitik tidak didukung: {range_key}")

        current = now or datetime.now(timezone.utc)
        if current.tzinfo is None:
            current = current.replace(tzinfo=timezone.utc)
        today = current.astimezone(timezone.utc).date()

        if range_key == "month":
            start_date = today.replace(day=1)
            elapsed_days = today.day
        else:
            elapsed_days = RANGE_DAYS[range_key]
            start_date = today - timedelta(days=elapsed_days - 1)

        start = datetime.combine(start_date, time.min, tzinfo=timezone.utc)
        end = datetime.combine(today + timedelta(days=1), time.min, tzinfo=timezone.utc)

        return AnalyticsWindow(
            key=range_key,
            start=start,
            end=end,
            elapsed_days=elapsed_days,
        )

    async def get_non_digital(
        self, user_id: int, range_key: str, now: datetime | None = None
    ) -> NonDigitalAnalyticsResponse:
        current = now or datetime.now(timezone.utc)
        window = self.resolve_window(range_key, current)
        kpis = await self._kpis(user_id, window)
        daily = await self._daily(user_id, window)
        mda = await self._mda(user_id, current)
        brands = await self._brands(user_id, window)
        transaction_types = await self._transaction_types(user_id, window)
        return NonDigitalAnalyticsResponse(
            range=window,
            kpis=kpis,
            daily=daily,
            mda=mda,
            brands=brands,
            transaction_types=transaction_types,
        )

    async def get_top_products(
        self,
        user_id: int,
        range_key: str,
        transaction_type: str | None = None,
        brand: str | None = None,
        limit: int = 5,
        now: datetime | None = None,
    ) -> TopProductsResponse:
        current = now or datetime.now(timezone.utc)
        window = self.resolve_window(range_key, current)
        brand_expr = self._brand_expr()

        conditions = self._base_conditions(user_id, window.start, window.end)
        if transaction_type and transaction_type != "all":
            conditions.append(
                LocalTransaction.transaction_type == transaction_type
            )
        if brand and brand.lower() != "all":
            conditions.append(brand_expr == brand.strip())

        count_expr = func.count(LocalTransaction.id)
        amount_expr = self._amount_expr()
        product_name_expr = func.coalesce(LocalTransaction.product_name, "")
        product_code_expr = func.coalesce(LocalTransaction.product_code, "")

        stmt = (
            select(
                LocalTransaction.transaction_type.label("transaction_type"),
                LocalTransaction.product_code.label("product_code"),
                LocalTransaction.product_name.label("product_name"),
                brand_expr.label("brand"),
                count_expr.label("transaction_count"),
                amount_expr.label("transaction_amount"),
            )
            .select_from(LocalTransaction)
            .outerjoin(Product, self._product_join_condition())
            .where(*conditions)
            .group_by(
                LocalTransaction.transaction_type,
                LocalTransaction.product_code,
                LocalTransaction.product_name,
                brand_expr,
            )
            .order_by(
                count_expr.desc(),
                amount_expr.desc(),
                product_name_expr.asc(),
                product_code_expr.asc(),
            )
            .limit(limit)
        )

        rows = (await self.db.execute(stmt)).all()
        items: list[TopProduct] = []
        for row in rows:
            name = (row.product_name or "").strip() or None
            code = (row.product_code or "").strip() or None
            items.append(
                TopProduct(
                    transaction_type=row.transaction_type,
                    product_code=code,
                    product_name=name,
                    display_name=name or code or UNKNOWN_PRODUCT,
                    brand=row.brand,
                    transaction_count=int(row.transaction_count or 0),
                    transaction_amount=_money(row.transaction_amount),
                )
            )

        return TopProductsResponse(
            range=window,
            transaction_type=transaction_type,
            brand=brand,
            items=items,
        )

    def _base_conditions(self, user_id: int, start: datetime, end: datetime) -> list:
        return [
            LocalTransaction.user_id == user_id,
            LocalTransaction.transaction_type.in_(NON_DIGITAL_TRANSACTION_TYPES),
            LocalTransaction.created_at >= start,
            LocalTransaction.created_at < end,
        ]

    @staticmethod
    def _product_join_condition():
        return and_(
            Product.user_id == LocalTransaction.user_id,
            Product.product_code == LocalTransaction.product_code,
        )

    @staticmethod
    def _brand_expr():
        return func.coalesce(
            func.nullif(func.trim(LocalTransaction.brand), ""),
            func.nullif(func.trim(Product.owner), ""),
            UNKNOWN_BRAND,
        )

    @staticmethod
    def _amount_expr():
        counted_amount = and_(
            LocalTransaction.status == "SUCCESS",
            LocalTransaction.amount.isnot(None),
        )
        return func.coalesce(
            func.sum(case((counted_amount, LocalTransaction.amount), else_=0)),
            0,
        )

    def _day_bucket_expr(self):
        dialect = self.db.get_bind().dialect.name
        if dialect == "sqlite":
            return func.date(LocalTransaction.created_at)
        return func.date_trunc("day", LocalTransaction.created_at)

    def _month_bucket_expr(self):
        dialect = self.db.get_bind().dialect.name
        if dialect == "sqlite":
            return func.strftime("%Y-%m-01", LocalTransaction.created_at)
        return func.date_trunc("month", LocalTransaction.created_at)

    async def _kpis(self, user_id: int, window: AnalyticsWindow) -> NonDigitalKpis:
        success = LocalTransaction.status == "SUCCESS"
        failed = LocalTransaction.status == "FAILED"
        processing = LocalTransaction.status == "PROCESSING"
        counted_amount = and_(success, LocalTransaction.amount.isnot(None))

        stmt = (
            select(
                func.count(LocalTransaction.id).label("total"),
                func.coalesce(
                    func.sum(case((success, 1), else_=0)), 0
                ).label("success"),
                func.coalesce(
                    func.sum(case((failed, 1), else_=0)), 0
                ).label("failed"),
                func.coalesce(
                    func.sum(case((processing, 1), else_=0)), 0
                ).label("processing"),
                func.coalesce(
                    func.sum(
                        case((counted_amount, LocalTransaction.amount), else_=0)
                    ),
                    0,
                ).label("transaction_amount"),
                func.coalesce(
                    func.sum(case((counted_amount, 1), else_=0)), 0
                ).label("successful_with_amount"),
            ).where(*self._base_conditions(user_id, window.start, window.end))
        )

        row = (await self.db.execute(stmt)).one()

        total = int(row.total or 0)
        success_count = int(row.success or 0)
        failed_count = int(row.failed or 0)
        processing_count = int(row.processing or 0)
        transaction_amount = _money(row.transaction_amount)
        successful_with_amount = int(row.successful_with_amount or 0)
        terminal = success_count + failed_count

        return NonDigitalKpis(
            total=total,
            success=success_count,
            failed=failed_count,
            processing=processing_count,
            transaction_amount=transaction_amount,
            successful_with_amount=successful_with_amount,
            average_successful_amount=(
                (transaction_amount / Decimal(successful_with_amount)).quantize(
                    MONEY_PLACES, rounding=ROUND_HALF_UP
                )
                if successful_with_amount
                else None
            ),
            success_rate=_rate(success_count, terminal),
            error_rate=_rate(failed_count, terminal),
            transactions_per_day=(
                Decimal(total) / Decimal(window.elapsed_days)
            ).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP),
        )

    async def _daily(
        self, user_id: int, window: AnalyticsWindow
    ) -> list[DailyPoint]:
        success = LocalTransaction.status == "SUCCESS"
        failed = LocalTransaction.status == "FAILED"
        processing = LocalTransaction.status == "PROCESSING"
        counted_amount = and_(success, LocalTransaction.amount.isnot(None))
        day = self._day_bucket_expr()

        stmt = (
            select(
                day.label("day"),
                func.count(LocalTransaction.id).label("total"),
                func.coalesce(
                    func.sum(case((success, 1), else_=0)), 0
                ).label("success"),
                func.coalesce(
                    func.sum(case((failed, 1), else_=0)), 0
                ).label("failed"),
                func.coalesce(
                    func.sum(case((processing, 1), else_=0)), 0
                ).label("processing"),
                func.coalesce(
                    func.sum(
                        case((counted_amount, LocalTransaction.amount), else_=0)
                    ),
                    0,
                ).label("transaction_amount"),
            )
            .where(*self._base_conditions(user_id, window.start, window.end))
            .group_by(day)
            .order_by(day)
        )

        rows = (await self.db.execute(stmt)).all()
        by_day = {_as_date(row.day): row for row in rows}

        first_day = window.start.date()
        last_day = (window.end - timedelta(microseconds=1)).date()
        points: list[DailyPoint] = []
        current_day = first_day

        while current_day <= last_day:
            row = by_day.get(current_day)
            points.append(
                DailyPoint(
                    date=current_day,
                    total=int(row.total or 0) if row else 0,
                    success=int(row.success or 0) if row else 0,
                    failed=int(row.failed or 0) if row else 0,
                    processing=int(row.processing or 0) if row else 0,
                    transaction_amount=(
                        _money(row.transaction_amount)
                        if row
                        else Decimal("0.00")
                    ),
                )
            )
            current_day += timedelta(days=1)

        return points

    async def _mda(self, user_id: int, now: datetime) -> NonDigitalMda:
        if now.tzinfo is None:
            now = now.replace(tzinfo=timezone.utc)
        today = now.astimezone(timezone.utc).date()
        current_month = today.replace(day=1)
        first_month = _add_months(current_month, -(MDA_MONTHS - 1))
        next_month = _add_months(current_month, 1)

        start = datetime.combine(first_month, time.min, tzinfo=timezone.utc)
        end = datetime.combine(next_month, time.min, tzinfo=timezone.utc)
        month = self._month_bucket_expr()
        counted_amount = and_(
            LocalTransaction.status == "SUCCESS",
            LocalTransaction.amount.isnot(None),
        )

        stmt = (
            select(
                month.label("month"),
                func.count(LocalTransaction.id).label("transaction_count"),
                func.coalesce(
                    func.sum(
                        case((counted_amount, LocalTransaction.amount), else_=0)
                    ),
                    0,
                ).label("transaction_amount"),
            )
            .where(*self._base_conditions(user_id, start, end))
            .group_by(month)
            .order_by(month)
        )

        rows = (await self.db.execute(stmt)).all()
        by_month = {
            _as_date(row.month).replace(day=1): row
            for row in rows
        }

        points: list[MonthlyMdaPoint] = []
        for offset in range(-(MDA_MONTHS - 1), 1):
            month_start = _add_months(current_month, offset)
            row = by_month.get(month_start)
            transaction_count = int(row.transaction_count or 0) if row else 0
            transaction_amount = (
                _money(row.transaction_amount) if row else Decimal("0.00")
            )
            elapsed_days = (
                today.day
                if month_start == current_month
                else calendar.monthrange(month_start.year, month_start.month)[1]
            )
            points.append(
                MonthlyMdaPoint(
                    month=month_start,
                    elapsed_days=elapsed_days,
                    is_current_month=month_start == current_month,
                    transaction_count=transaction_count,
                    transaction_amount=transaction_amount,
                    transactions_per_day=(
                        Decimal(transaction_count) / Decimal(elapsed_days)
                    ).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP),
                    amount_per_day=(
                        transaction_amount / Decimal(elapsed_days)
                    ).quantize(MONEY_PLACES, rounding=ROUND_HALF_UP),
                )
            )

        return NonDigitalMda(
            current=points[-1],
            previous=points[-2] if len(points) > 1 else None,
            months=points,
        )

    async def _brands(
        self, user_id: int, window: AnalyticsWindow
    ) -> list[BrandPerformance]:
        brand_expr = self._brand_expr()
        count_expr = func.count(LocalTransaction.id)
        amount_expr = self._amount_expr()

        stmt = (
            select(
                brand_expr.label("brand"),
                count_expr.label("transaction_count"),
                amount_expr.label("transaction_amount"),
            )
            .select_from(LocalTransaction)
            .outerjoin(Product, self._product_join_condition())
            .where(*self._base_conditions(user_id, window.start, window.end))
            .group_by(brand_expr)
            .order_by(
                count_expr.desc(),
                amount_expr.desc(),
                brand_expr.asc(),
            )
        )

        rows = (await self.db.execute(stmt)).all()
        if not rows:
            return []

        total_count = sum(int(row.transaction_count or 0) for row in rows)
        total_amount = sum(
            (_money(row.transaction_amount) for row in rows), Decimal("0")
        )

        performance: list[BrandPerformance] = []
        for row in rows:
            count_value = int(row.transaction_count or 0)
            amount_value = _money(row.transaction_amount)
            performance.append(
                BrandPerformance(
                    brand=row.brand,
                    transaction_count=count_value,
                    transaction_amount=amount_value,
                    count_share=(
                        (Decimal(count_value) / Decimal(total_count)).quantize(
                            SHARE_PLACES, rounding=ROUND_HALF_UP
                        )
                        if total_count
                        else Decimal("0.0000")
                    ),
                    amount_share=(
                        (amount_value / total_amount).quantize(
                            SHARE_PLACES, rounding=ROUND_HALF_UP
                        )
                        if total_amount
                        else Decimal("0.0000")
                    ),
                )
            )
        return performance

    async def _transaction_types(
        self, user_id: int, window: AnalyticsWindow
    ) -> list[TransactionTypePerformance]:
        brand_expr = self._brand_expr()
        count_expr = func.count(LocalTransaction.id)
        amount_expr = self._amount_expr()

        stmt = (
            select(
                LocalTransaction.transaction_type.label("transaction_type"),
                brand_expr.label("brand"),
                count_expr.label("transaction_count"),
                amount_expr.label("transaction_amount"),
            )
            .select_from(LocalTransaction)
            .outerjoin(Product, self._product_join_condition())
            .where(*self._base_conditions(user_id, window.start, window.end))
            .group_by(LocalTransaction.transaction_type, brand_expr)
        )

        rows = (await self.db.execute(stmt)).all()
        by_type: dict[str, list] = {}
        for row in rows:
            by_type.setdefault(row.transaction_type, []).append(row)

        performance: list[TransactionTypePerformance] = []
        for transaction_type in NON_DIGITAL_TRANSACTION_TYPES:
            brand_rows = sorted(
                by_type.get(transaction_type, []),
                key=lambda row: (
                    -int(row.transaction_count or 0),
                    -_money(row.transaction_amount),
                    row.brand,
                ),
            )
            brands = [
                BrandBreakdown(
                    brand=row.brand,
                    transaction_count=int(row.transaction_count or 0),
                    transaction_amount=_money(row.transaction_amount),
                )
                for row in brand_rows
            ]
            performance.append(
                TransactionTypePerformance(
                    transaction_type=transaction_type,
                    transaction_count=sum(
                        brand.transaction_count for brand in brands
                    ),
                    transaction_amount=sum(
                        (brand.transaction_amount for brand in brands),
                        Decimal("0"),
                    ),
                    brands=brands,
                )
            )

        return performance
