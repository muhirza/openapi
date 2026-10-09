import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.local_transaction import LocalTransaction
from app.models.product import Product
from app.schemas.transaction import TransactionStatus
from app.services.token_service import TokenService, TokenFetchError
from app.services.provider_client import provider_client, ProviderResult
from app.services.pin_service import PinService, PinNotFoundError
from app.services.transaction.masking import mask_sensitive, mask_payload


class TransactionServiceBase:
    """Common flow for all transaction types.

    1. Validate request
    2. Get valid access token
    3. Get transaction API credentials
    4. Decrypt stored PIN
    5. Call Encrypt PIN API
    6. Call transaction API
    7. Determine status
    8. Persist LocalTransaction (masked raw response)
    9. Return result
    """

    # Override in subclasses
    api_name: str = ""
    encrypt_pin_api_name: str = "encrypt_pin"
    transaction_endpoint_setting: str = ""
    transaction_headers_setting: str = ""
    history_detail_required: bool = False  # if True, run check-history + detail flow

    def __init__(self, db: AsyncSession):
        self.db = db
        self.token_svc = TokenService(db)
        self.pin_svc = PinService(db)

    async def _get_token_and_creds(self, user_id: int, api_name: str) -> tuple[str, str, str]:
        """Return (token, api_id, api_key) for the given api_name."""
        token_obj = await self.token_svc.get_valid_token(user_id)
        if not token_obj:
            raise TokenFetchError("No valid provider token. Configure Get Token first.")
        token = token_obj.access_token_encrypted
        from app.core.security import decrypt_value
        token = decrypt_value(token)

        creds = await self.token_svc.get_credentials_by_name(user_id, api_name)
        if not creds:
            raise TokenFetchError(f"No credentials configured for {api_name}.")
        api_id, api_key = await self.token_svc.decrypt_credentials(creds)
        return token, api_id, api_key

    async def _encrypt_pin(self, user_id: int, plain_pin: str) -> tuple[str, ProviderResult]:
        """Call provider Encrypt PIN API and return (encrypted_pin, full_result)."""
        token, api_id, api_key = await self._get_token_and_creds(user_id, self.encrypt_pin_api_name)

        endpoint = getattr(settings, "provider_encrypt_pin_endpoint")
        header_template = getattr(settings, "provider_encrypt_pin_headers")

        req_body = {"data": plain_pin}
        result = await provider_client.post_json(endpoint, header_template, token, api_id, api_key, req_body)
        if not result.ok:
            raise TokenFetchError(f"Encrypt PIN failed: {result.error_code} - {result.error_message}")
        return result.data, result

    def _build_tx_record(
        self,
        user_id: int,
        transaction_type: str,
        provider_result: ProviderResult,
        request_payload: Dict[str, Any],
        extra: Dict[str, Any] | None = None,
    ) -> LocalTransaction:
        """Create LocalTransaction row (not committed)."""
        ref = str(uuid.uuid4())
        request_ts = datetime.now(timezone.utc)
        response_ts = datetime.now(timezone.utc)

        # Mask sensitive fields before persisting
        masked_request = mask_payload(request_payload)
        masked_raw = mask_sensitive(provider_result.raw) if provider_result.raw else None

        # Determine status
        status: TransactionStatus = self._map_status(provider_result)

        extra = extra or {}
        metadata = dict(extra.get("metadata") or {})
        metadata["request"] = masked_request

        provider_reference = None
        if isinstance(provider_result.data, dict):
            provider_reference = provider_result.data.get("transactionId")
        elif isinstance(provider_result.data, str):
            provider_reference = provider_result.data

        record = LocalTransaction(
            user_id=user_id,
            transaction_ref=ref,
            transaction_type=transaction_type,
            product_code=extra.get("product_code"),
            product_name=extra.get("product_name"),
            product_type=extra.get("product_type"),
            amount=extra.get("amount"),
            status=status,
            provider_reference=provider_reference,
            destination=extra.get("destination"),
            payment_method=extra.get("payment_method"),
            raw_response=masked_raw,
            metadata_=metadata,
            request_timestamp=request_ts,
            provider_response_timestamp=response_ts,
            http_status_code=provider_result.http_status,
            error_code=provider_result.error_code,
            error_message=provider_result.error_message,
        )
        return record

    def _map_status(self, result: ProviderResult) -> TransactionStatus:
        """Map provider result to local status. Override in subclasses for special logic."""
        if not result.ok:
            return "FAILED"
        if isinstance(result.data, dict):
            desc = str(result.data.get("description", "")).lower()
            if "sedang di proses" in desc or "proses" in desc:
                return "PROCESSING"
            if "berhasil" in desc or "sukses" in desc or "success" in desc:
                return "SUCCESS"
        # Cocktail SF returns string reference on success
        if result.ok and isinstance(result.data, str):
            return "SUCCESS"
        return "PROCESSING"

    async def execute(self, user_id: int, **kwargs) -> LocalTransaction:
        """Execute the transaction. Subclasses should override to build request."""
        raise NotImplementedError