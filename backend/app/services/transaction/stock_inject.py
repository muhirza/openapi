import asyncio
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.stock_transaction import StockTransaction
from app.schemas.transaction import TransactionStatus
from app.services.provider_client import provider_client
from app.services.stock_history_service import StockHistoryService
from app.services.token_service import TokenFetchError
from app.services.transaction.base import (
    VERIFY_RETRY_ATTEMPTS,
    VERIFY_RETRY_DELAY_SECONDS,
    TransactionServiceBase,
)
from app.services.transaction.masking import mask_sensitive


class StockInjectService(TransactionServiceBase):
    """Inject AWG/XWG stock vouchers, verified via the family's Info Transaction Detail API.

    Stock operations are recorded in `stock_transactions` (the digital stock
    history), not in `local_transactions`. The row starts as PROCESSING and is
    resolved by the short in-request retry, the background re-check loop, or a
    manual status check on the Stock History detail page.
    """

    INJECT_COMMANDS = {"awg": "tembak-paket-ir", "xwg": "sell-voucher"}
    INJECT_API_NAMES = {"awg": "awg_stock_inject", "xwg": "xwg_stock_inject"}
    SERVICETYPE = "SELLVOUCHER"

    def __init__(self, db: AsyncSession, family: str = "awg"):
        super().__init__(db)
        if family not in ("awg", "xwg"):
            raise ValueError(f"Keluarga stok tidak didukung: {family}")
        self.family = family

    @property
    def transaction_type(self) -> str:
        return f"inject_{self.family}"

    async def _get_inject_creds(self, user_id: int) -> tuple[str, str, str]:
        """Return (token, api_id, api_key) for this family's inject API.

        The inject endpoints have their own credentials; the stock-list
        credentials are intentionally not used as a fallback.
        """
        api_name = self.INJECT_API_NAMES[self.family]
        creds = await self.token_svc.get_credentials_by_name(user_id, api_name)
        if not creds:
            raise TokenFetchError(
                f"Belum ada kredensial untuk Injeksi Stok {self.family.upper()}. "
                "Tambahkan di Konfigurasi API."
            )
        return await self._get_token_and_creds(user_id, api_name)

    async def execute(
        self,
        user_id: int,
        targets: list[str],
        voucher_id: str,
        allow_type: str,
        voucher_type_code: str,
        description: str | None = None,
        price: Decimal | None = None,
    ) -> StockTransaction:
        clean_targets = [t.strip() for t in targets if t and t.strip()]
        if not clean_targets:
            raise ValueError("Setidaknya satu MSISDN tujuan diperlukan")

        # 1. Inject credentials -> 2. PIN (stored encrypted) -> 3. encrypt via provider
        token, api_id, api_key = await self._get_inject_creds(user_id)
        plain_pin = await self.pin_svc.get_pin(user_id)
        enc_pin, _ = await self._encrypt_pin(user_id, plain_pin)

        endpoint = getattr(settings, f"provider_{self.family}_stock_inject_endpoint")
        header_template = getattr(settings, f"provider_{self.family}_stock_inject_headers")
        req_body = {
            "target": clean_targets,
            "pin": enc_pin,
            "vId": voucher_id,
            "command": self.INJECT_COMMANDS[self.family],
            "allowType": allow_type,
        }

        tx_result = await provider_client.post_json(
            endpoint, header_template, token, api_id, api_key, req_body
        )

        master_trx_id = None
        if isinstance(tx_result.data, dict):
            master_trx_id = tx_result.data.get("transactionId") or tx_result.data.get(
                "masterTrxId"
            )
        elif isinstance(tx_result.data, str):
            master_trx_id = tx_result.data

        status: TransactionStatus = "PROCESSING" if tx_result.ok else "FAILED"

        record = StockTransaction(
            user_id=user_id,
            family=self.family,
            servicetype=self.SERVICETYPE,
            master_trx_id=str(master_trx_id) if master_trx_id else f"local-{uuid.uuid4()}",
            status=status,
            description=str(description)[:500] if description else None,
            voucher_price=price,
            voucher_type_code=str(voucher_type_code)[:255] if voucher_type_code else None,
            destination_msisdn=",".join(clean_targets)[:500],
            created_dtm=datetime.now(timezone.utc).date(),
            raw_response=mask_sensitive(tx_result.raw) if tx_result.raw else None,
            raw_response_unmasked=tx_result.raw,
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)

        # provider masterTrxId is returned as result.data
        if tx_result.ok and master_trx_id:
            await self._verify_with_retry(record)
        return record

    async def _verify_with_retry(self, record: StockTransaction) -> None:
        """Immediate post-submit verification with a short retry window.

        Provider fulfillment is asynchronous, so the first detail lookups often
        return nothing conclusive yet. Retry a few times within ~15s; if it is
        still inconclusive the record stays PROCESSING and the background loop
        keeps checking.
        """
        service = StockHistoryService(self.db)
        for attempt in range(VERIFY_RETRY_ATTEMPTS):
            try:
                record = await service.refresh_record(record)
            except Exception:  # provider/credential trouble: leave the record open
                return
            if record.status in ("SUCCESS", "FAILED"):
                return
            if attempt < VERIFY_RETRY_ATTEMPTS - 1:
                await asyncio.sleep(VERIFY_RETRY_DELAY_SECONDS)

    async def refresh_status(
        self, user_id: int, stock_tx_id: int
    ) -> StockTransaction | None:
        """Manual / background status check via the Info Transaction Detail API."""
        stmt = select(StockTransaction).where(
            StockTransaction.id == stock_tx_id,
            StockTransaction.user_id == user_id,
            StockTransaction.family == self.family,
        )
        record = (await self.db.execute(stmt)).scalar_one_or_none()
        if not record:
            return None
        return await StockHistoryService(self.db).refresh_record(record)
