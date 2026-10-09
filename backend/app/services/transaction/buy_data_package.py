from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.local_transaction import LocalTransaction
from app.schemas.transaction import TransactionStatus
from app.services.token_service import TokenService
from app.services.provider_client import provider_client, ProviderResult
from app.services.transaction.base import TransactionServiceBase


class BuyDataPackageService(TransactionServiceBase):
    """Buy Data Package — /post-package.

    Initial call returns PROCESSING. Then run Check History + Detail flow
    to determine final status (SUCCESS/FAILED).
    """

    api_name = "buy_data_package"
    transaction_endpoint_setting = "provider_buy_data_package_endpoint"
    transaction_headers_setting = "provider_buy_data_package_headers"
    history_detail_required = True

    def _map_status(self, result: ProviderResult) -> TransactionStatus:
        if not result.ok:
            return "FAILED"
        # Initial response is usually "Transaksi sedang di proses"
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

        # 4. Call transaction
        endpoint = getattr(settings, "provider_buy_data_package_endpoint")
        header_template = getattr(settings, "provider_buy_data_package_headers")
        req_body = {"msisdn": msisdn, "pin": enc_pin, "productCode": product_code}
        tx_result = await provider_client.post_json(endpoint, header_template, token, api_id, api_key, req_body)

        # 5. Build initial record
        request_payload = {"msisdn": msisdn, "pin": "[ENCRYPTED]", "productCode": product_code}
        provider_ref = None
        if isinstance(tx_result.data, dict):
            provider_ref = tx_result.data.get("transactionId")

        record = self._build_tx_record(
            user_id=user_id,
            transaction_type="buy_data_package",
            provider_result=tx_result,
            request_payload=request_payload,
            extra={
                "product_code": product_code,
                "destination": msisdn,
                "metadata": {"product_code": product_code},
            },
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)

        # 6. Run verification flow if provider reference exists
        if provider_ref:
            await self._verify_and_update(user_id, record.id, provider_ref, msisdn, token)

        return record

    async def _verify_and_update(
        self,
        user_id: int,
        local_tx_id: int,
        transaction_id: str,
        msisdn: str,
        token: str,
    ) -> None:
        """Run Check History + Detail flow and update local record."""
        # Use history_api credentials for the check endpoints
        token_svc = TokenService(self.db)
        creds = await token_svc.get_credentials_by_name(user_id, "history_api")
        if not creds:
            return  # silently skip if no history creds
        api_id, api_key = await token_svc.decrypt_credentials(creds)

        # Step 1: Check History (GET /get-transaction-history) — optional, just to warm up
        # (MVP1 history service uses same endpoint; we can skip if not needed)

        # Step 2: Check History Detail (GET /get-transaction-historydetail)
        detail_endpoint = getattr(settings, "provider_history_detail_endpoint")
        detail_headers = getattr(settings, "provider_history_detail_headers")
        params = {
            "transactionId": transaction_id,
            "msisdnB": msisdn,
            "orderStatus": "SUCCESS",
        }
        detail_result = await provider_client.get_full(detail_endpoint, detail_headers, token, api_id, api_key, params)

        # Update status based on detail result
        final_status: TransactionStatus = "FAILED"
        if detail_result.ok and isinstance(detail_result.data, list):
            # Look for our transaction in the list
            for item in detail_result.data:
                if isinstance(item, dict) and item.get("transactionId") == transaction_id:
                    status = str(item.get("status", "")).upper()
                    if status == "SUCCESS":
                        final_status = "SUCCESS"
                    else:
                        final_status = "FAILED"
                    break

        # Update local record
        from sqlalchemy import select
        stmt = select(LocalTransaction).where(LocalTransaction.id == local_tx_id)
        res = await self.db.execute(stmt)
        record = res.scalar_one_or_none()
        if record:
            record.status = final_status
            # Merge raw response with detail result
            if detail_result.raw:
                masked_detail = {k: v for k, v in detail_result.raw.items()}
                # We'll just add the detail list to existing raw_response
                if record.raw_response and isinstance(record.raw_response, dict):
                    record.raw_response["check_history_detail"] = detail_result.data
                else:
                    record.raw_response = {"check_history_detail": detail_result.data}
            record.updated_at = __import__('datetime').datetime.now(__import__('datetime').timezone.utc)
            await self.db.commit()

    async def refresh_status(self, user_id: int, local_tx_id: int) -> Optional[LocalTransaction]:
        """Manual refresh: re-run verification flow."""
        from sqlalchemy import select
        stmt = select(LocalTransaction).where(LocalTransaction.id == local_tx_id, LocalTransaction.user_id == user_id)
        res = await self.db.execute(stmt)
        record = res.scalar_one_or_none()
        if not record or record.transaction_type != "buy_data_package":
            return None
        provider_ref = record.provider_reference
        msisdn = record.destination
        if not provider_ref or not msisdn:
            return record

        token, _, _ = await self._get_token_and_creds(user_id, self.api_name)
        await self._verify_and_update(user_id, local_tx_id, provider_ref, msisdn, token)
        await self.db.refresh(record)
        return record