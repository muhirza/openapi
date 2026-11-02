from datetime import datetime, timedelta, timezone
from typing import Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.local_transaction import LocalTransaction
from app.models.user_sync_setting import UserSyncSetting
from app.services.history_service import HistoryService
from app.services.transaction.base import classify_provider_status
from app.services.transaction.masking import mask_sensitive


class HistorySyncService:
    """Pull provider transaction history into the local ledger.

    The provider caps its history response (~2500 rows), so syncing periodically
    and persisting locally accumulates history past that cap. Rows land in
    `local_transactions` with source="synced"; records already known to the app
    (source="app") are never duplicated or overwritten.
    """

    # Re-read a little behind the last sync so late-appearing rows are not missed.
    OVERLAP = timedelta(days=1)

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_or_create_setting(self, user_id: int) -> UserSyncSetting:
        result = await self.db.execute(
            select(UserSyncSetting).where(UserSyncSetting.user_id == user_id)
        )
        setting = result.scalar_one_or_none()
        if setting is None:
            setting = UserSyncSetting(user_id=user_id)
            self.db.add(setting)
            await self.db.commit()
            await self.db.refresh(setting)
        return setting

    def _sync_window(self, last_sync_at: datetime | None, now: datetime) -> tuple[datetime, datetime]:
        max_days = settings.provider_history_max_days
        earliest = now - timedelta(days=max_days)
        if last_sync_at is None:
            return earliest, now
        if last_sync_at.tzinfo is None:
            last_sync_at = last_sync_at.replace(tzinfo=timezone.utc)
        start = max(last_sync_at - self.OVERLAP, earliest)
        return start, now

    @staticmethod
    def _candidate_keys(item) -> Set[str]:
        """Provider identifiers this history row may be known by locally."""
        keys: Set[str] = set()
        if item.provider_reference:
            keys.add(str(item.provider_reference))
        if item.transaction_ref:
            keys.add(str(item.transaction_ref))
        raw = item.raw if isinstance(item.raw, dict) else {}
        for field in ("serial_number", "transactionId", "transaction_id", "ref", "id"):
            value = raw.get(field)
            if value not in (None, ""):
                keys.add(str(value))
        return keys

    async def _existing_keys(self, user_id: int) -> Set[str]:
        rows = await self.db.execute(
            select(
                LocalTransaction.provider_transaction_id,
                LocalTransaction.provider_reference,
                LocalTransaction.transaction_ref,
            ).where(LocalTransaction.user_id == user_id)
        )
        keys: Set[str] = set()
        for provider_tx_id, provider_ref, tx_ref in rows.all():
            for value in (provider_tx_id, provider_ref, tx_ref):
                if value:
                    keys.add(str(value))
        return keys

    @staticmethod
    def _aware(value: datetime | None, fallback: datetime) -> datetime:
        if value is None:
            return fallback
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    async def sync_user(self, user_id: int) -> int:
        """Sync one user's provider history. Returns the number of rows added.

        Raises on provider/auth failures after recording the failure on the
        settings row, so callers (loop/route) can log or surface it.
        """
        setting = await self._get_or_create_setting(user_id)
        now = datetime.now(timezone.utc)
        start, end = self._sync_window(setting.last_sync_at, now)

        setting.last_sync_status = "RUNNING"
        setting.last_sync_error = None
        await self.db.commit()

        try:
            history = await HistoryService(self.db).fetch_api_history(
                user_id,
                startdate=start.strftime("%Y-%m-%d"),
                enddate=end.strftime("%Y-%m-%d"),
            )
        except Exception as e:
            setting.last_sync_status = "FAILED"
            setting.last_sync_error = str(e)[:500]
            await self.db.commit()
            raise

        known = await self._existing_keys(user_id)
        added = 0

        for item in history.items:
            keys = self._candidate_keys(item)
            if not keys or keys & known:
                continue

            raw = item.raw if isinstance(item.raw, dict) else {}
            occurred_at = self._aware(item.date, now)
            primary_key = (
                raw.get("serial_number")
                or raw.get("transactionId")
                or item.provider_reference
                or item.transaction_ref
            )
            product_code = raw.get("productCode") or raw.get("product_code")

            self.db.add(
                LocalTransaction(
                    user_id=user_id,
                    transaction_ref=item.transaction_ref or str(primary_key),
                    transaction_type=str(item.transaction_type)[:50],
                    product_code=str(product_code)[:255] if product_code else None,
                    product_name=str(item.product)[:500] if item.product else None,
                    amount=item.amount,
                    status=(
                        classify_provider_status(item.status)
                        or str(item.status or "UNKNOWN").upper()[:50]
                    ),
                    provider_reference=item.provider_reference,
                    provider_transaction_id=str(primary_key) if primary_key else None,
                    destination=str(item.destination)[:50] if item.destination else None,
                    payment_method=str(item.payment_method)[:50] if item.payment_method else None,
                    source="synced",
                    synced_at=now,
                    raw_response=mask_sensitive(item.raw),
                    raw_response_unmasked=item.raw,
                    metadata_={"source": "provider_history"},
                    request_timestamp=occurred_at,
                    provider_response_timestamp=occurred_at,
                    created_at=occurred_at,
                )
            )
            known.update(keys)
            added += 1

        setting.last_sync_at = now
        setting.last_sync_status = "SUCCESS"
        setting.last_sync_count = added
        setting.last_sync_error = None
        await self.db.commit()

        return added
