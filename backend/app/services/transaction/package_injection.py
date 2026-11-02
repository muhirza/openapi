from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.local_transaction import LocalTransaction
from app.schemas.transaction import TransactionStatus
from app.services.provider_client import provider_client, ProviderResult
from app.services.transaction.base import TransactionServiceBase


class PackageInjectionService(TransactionServiceBase):
    """Package Injection — /post-package with command: inject-package.

    Same verification flow as Data Package: auto check-history-detail
    after initial PROCESSING response, plus manual Refresh.
    """

    api_name = "package_injection"
    transaction_endpoint_setting = "provider_package_injection_endpoint"
    transaction_headers_setting = "provider_package_injection_headers"
    history_detail_required = True

    def _map_status(self, result: ProviderResult) -> TransactionStatus:
        if not result.ok:
            return "FAILED"
        if isinstance(result.data, dict):
            desc = str(result.data.get("description", "")).lower()
            if "sedang di proses" in desc or "proses" in desc:
                return "PROCESSING"
        return "PROCESSING"

    async def execute(
        self,
        user_id: int,
        msisdn: str,
        product_code: str,
    ) -> LocalTransaction:
        # 1. Get PIN
        plain_pin = await self.pin_svc.get_pin(user_id)

        # 2. Encrypt PIN
        enc_pin, _ = await self._encrypt_pin(user_id, plain_pin)

        # 3. Transaction API creds
        token, api_id, api_key = await self._get_token_and_creds(user_id, self.api_name)

        # 4. Call Package Injection
        endpoint = getattr(settings, "provider_package_injection_endpoint")
        header_template = getattr(settings, "provider_package_injection_headers")
        req_body = {
            "msisdn": msisdn,
            "pin": enc_pin,
            "productCode": product_code,
            "command": "inject-package",
        }
        tx_result = await provider_client.post_json(endpoint, header_template, token, api_id, api_key, req_body)

        # 5. Build initial record
        request_payload = {
            "msisdn": msisdn,
            "pin": "[ENCRYPTED]",
            "productCode": product_code,
            "command": "inject-package",
        }
        provider_ref = None
        if isinstance(tx_result.data, dict):
            provider_ref = tx_result.data.get("transactionId")

        record = self._build_tx_record(
            user_id=user_id,
            transaction_type="package_injection",
            provider_result=tx_result,
            request_payload=request_payload,
            extra={
                "product_code": product_code,
                "destination": msisdn,
                "metadata": {"product_code": product_code},
            },
            endpoint=endpoint,
            unmasked_request=req_body,
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)

        # 6. Verify with a short retry window (provider fulfillment is asynchronous)
        if provider_ref:
            await self._verify_and_update_with_retry(user_id, record.id, provider_ref, msisdn, token)

        return record

    async def _verify_and_update(
        self,
        user_id: int,
        local_tx_id: int,
        transaction_id: str,
        msisdn: str,
        token: str,
    ) -> None:
        """Re-check the provider's transaction-history-detail and update the record.

        Never infers FAILED: an inconclusive response leaves the record open
        (PROCESSING) so it can be re-checked later.
        """
        status, detail_row, raw = await self._verify_via_history_detail(
            user_id, transaction_id, msisdn, token
        )
        if status is None and detail_row is None and raw is None:
            return  # no usable credentials — leave the record for the re-check loop
        await self._apply_verification(user_id, local_tx_id, status, detail_row, raw)

    async def refresh_status(self, user_id: int, local_tx_id: int) -> Optional[LocalTransaction]:
        """Manual refresh: re-run verification flow."""
        from sqlalchemy import select
        stmt = select(LocalTransaction).where(LocalTransaction.id == local_tx_id, LocalTransaction.user_id == user_id)
        res = await self.db.execute(stmt)
        record = res.scalar_one_or_none()
        if not record or record.transaction_type != "package_injection":
            return None
        provider_ref = record.provider_reference
        msisdn = record.destination
        if not provider_ref or not msisdn:
            return record

        token, _, _ = await self._get_token_and_creds(user_id, self.api_name)
        await self._verify_and_update(user_id, local_tx_id, provider_ref, msisdn, token)
        await self.db.refresh(record)
        return record