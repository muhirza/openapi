from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decrypt_value
from app.models.stock_transaction import StockTransaction
from app.services.provider_client import ProviderAPIError, ProviderResult, provider_client
from app.services.token_service import TokenFetchError, TokenService
from app.services.transaction.base import classify_provider_status


class StockHistoryService:
    """Digital stock history: system-generated records checked against the provider.

    The provider's stock transaction-list endpoints no longer exist, so stock
    history is kept locally: rows are created when stock operations run in this
    system (e.g. stock inject) and their outcome is checked through the
    AWG/XWG Info Transaction Detail endpoints.
    """

    # Detail lookup commands exposed only for the two injection operations.
    DETAIL_COMMANDS = {
        "awg": {
            "SELLVOUCHER": "info-detail-voucher",
            "PHYSICALVOUCHER": "info-detail-pv",
        },
        "xwg": {
            "SELLVOUCHER": "sellvoucher-detail",
            "PHYSICALVOUCHER": "physicalvoucherdetail",
        },
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _auth(
        self,
        user_id: int,
        api_name: str,
        fallback_api_name: str | None = None,
    ) -> tuple[str, str, str]:
        token_svc = TokenService(self.db)
        token_obj = await token_svc.get_valid_token(user_id)
        if not token_obj:
            raise TokenFetchError("No valid provider token.")
        token = decrypt_value(token_obj.access_token_encrypted)

        creds = await token_svc.get_credentials_by_name(user_id, api_name)
        if creds is None and fallback_api_name:
            creds = await token_svc.get_credentials_by_name(user_id, fallback_api_name)
        if not creds:
            raise TokenFetchError(
                f"No credentials configured for {api_name}. Add them in API Config."
            )
        api_id, api_key = await token_svc.decrypt_credentials(creds)
        return token, api_id, api_key

    async def fetch_detail(
        self,
        user_id: int,
        family: str,
        master_trx_id: str,
        servicetype: str,
    ) -> ProviderResult:
        """POST the family's Info Transaction Detail lookup for one stock transaction."""
        command = self.DETAIL_COMMANDS.get(family, {}).get(servicetype)
        if not command:
            raise ValueError(
                f"Detail lookup is not supported for {family} service type {servicetype}"
            )

        token, api_id, api_key = await self._auth(
            user_id, f"{family}_transaction_info_detail", fallback_api_name=family
        )
        endpoint = getattr(settings, f"provider_{family}_stock_info_detail_endpoint")
        header_template = getattr(settings, f"provider_{family}_stock_info_detail_headers")
        body = {"command": command, "masterTrxId": master_trx_id}
        return await provider_client.post_json(
            endpoint, header_template, token, api_id, api_key, body
        )

    async def refresh_record(self, record: StockTransaction) -> StockTransaction:
        """Check one stock transaction via the detail API and cache the outcome.

        Stores the per-target rows and their aggregate status on the record. The
        row's raw inject response is preserved; an inconclusive lookup leaves the
        current status untouched so the record stays open. Raises on provider or
        credential errors so callers can surface them.
        """
        result = await self.fetch_detail(
            record.user_id, record.family, record.master_trx_id, record.servicetype
        )
        if not result.ok:
            parts = [result.error_code, result.error_message]
            detail = " ".join(str(p) for p in parts if p and p != "Unknown error")
            raise ProviderAPIError(detail or "Provider detail lookup failed")

        detail_rows = self.parse_detail_rows(result.data, record.master_trx_id)
        aggregate = self.aggregate_detail_status(detail_rows)

        record.detail = detail_rows
        record.detail_fetched_at = datetime.now(timezone.utc)
        if aggregate is not None:
            record.detail_status = aggregate
            record.status = aggregate

        await self.db.commit()
        await self.db.refresh(record)
        return record

    @staticmethod
    def parse_detail_rows(data, master_trx_id: str) -> list[dict]:
        """Normalize Info Transaction Detail rows belonging to one masterTrxId."""
        rows = data if isinstance(data, list) else []
        matched: list[dict] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            if str(row.get("masterTrxId")) != str(master_trx_id):
                continue
            matched.append(
                {
                    "bMsisdn": StockHistoryService._clean(row.get("bMsisdn"), 50),
                    "status": StockHistoryService._clean(row.get("status"), 50),
                    "statusDetail": StockHistoryService._clean(row.get("statusDetail"), 255),
                }
            )
        return matched

    @staticmethod
    def aggregate_detail_status(rows: list[dict]) -> Optional[str]:
        statuses = [classify_provider_status(r.get("status")) for r in rows]
        if not statuses or all(s is None for s in statuses):
            return None
        if any(s == "FAILED" for s in statuses):
            return "FAILED"
        if all(s == "SUCCESS" for s in statuses):
            return "SUCCESS"
        return "PROCESSING"

    @staticmethod
    def _clean(value, limit: int) -> Optional[str]:
        if value in (None, ""):
            return None
        return str(value)[:limit]
