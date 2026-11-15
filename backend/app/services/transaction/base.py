import asyncio
import uuid
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional, Dict, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.local_transaction import LocalTransaction
from app.models.product import Product
from app.schemas.transaction import TransactionStatus
from app.services.token_service import TokenService, TokenFetchError
from app.services.provider_client import provider_client, ProviderResult
from app.services.pin_service import PinService, PinNotFoundError
from app.services.transaction.masking import mask_sensitive, mask_payload


# Status text markers as reported by the provider
_SUCCESS_MARKERS = {"SUCCESS", "SUKSES", "BERHASIL", "DONE", "COMPLETED"}
_FAILURE_MARKERS = {"FAILED", "GAGAL", "CANCELLED", "CANCELED", "REVERSED", "REJECTED", "EXPIRED"}
_PENDING_MARKERS = {"PROCESSING", "PENDING", "IN PROGRESS", "SEDANG DI PROSES", "INPROCESS"}

# Immediate post-submit verification window: 3 looks over ~10s (within ~15s total)
VERIFY_RETRY_ATTEMPTS = 3
VERIFY_RETRY_DELAY_SECONDS = 5.0


def classify_provider_status(value: Any) -> Optional[TransactionStatus]:
    """Map provider status text to a local status.

    Returns None when the text is inconclusive, so callers can keep the record
    open (PROCESSING) instead of assuming failure.
    """
    text = str(value or "").strip().upper()
    if not text:
        return None
    if text in _SUCCESS_MARKERS:
        return "SUCCESS"
    if text in _FAILURE_MARKERS:
        return "FAILED"
    if text in _PENDING_MARKERS or "PROSES" in text:
        return "PROCESSING"
    return None


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
            raise TokenFetchError("Tidak ada token penyedia yang valid. Konfigurasikan Get Token terlebih dahulu.")
        token = token_obj.access_token_encrypted
        from app.core.security import decrypt_value
        token = decrypt_value(token)

        creds = await self.token_svc.get_credentials_by_name(user_id, api_name)
        if not creds:
            raise TokenFetchError(f"Belum ada kredensial yang dikonfigurasi untuk {api_name}.")
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
            raise TokenFetchError(f"Enkripsi PIN gagal: {result.error_code} - {result.error_message}")
        return result.data, result

    async def _verify_via_history_detail(
        self,
        user_id: int,
        transaction_id: str,
        msisdn: str,
        token: str,
    ) -> tuple[Optional[TransactionStatus], Optional[dict], Optional[dict]]:
        """Look up a transaction via the provider's transaction-history-detail API.

        Returns (status, matched_row, raw_response).
        `status` is None when the outcome is inconclusive (no matching row, empty
        list, or a failed request) — callers must keep the record open instead of
        assuming failure.
        """
        creds = await self.token_svc.get_credentials_by_name(user_id, "history_detail")
        if not creds:
            # Backwards compatibility: fall back to the history API credentials
            creds = await self.token_svc.get_credentials_by_name(user_id, "history_api")
        if not creds:
            return None, None, None

        api_id, api_key = await self.token_svc.decrypt_credentials(creds)

        endpoint = getattr(settings, "provider_history_detail_endpoint")
        header_template = getattr(settings, "provider_history_detail_headers")
        # Only transactionId + msisdnB are required (matches provider's sample)
        params = {"transactionId": transaction_id, "msisdnB": msisdn}

        result = await provider_client.get_full(
            endpoint, header_template, token, api_id, api_key, params
        )

        raw = result.raw if isinstance(result.raw, dict) else None
        data = result.data
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = [data]
        else:
            rows = []

        for row in rows:
            if not isinstance(row, dict):
                continue
            if str(row.get("transactionId")) == str(transaction_id):
                return classify_provider_status(row.get("status")), row, raw

        return None, None, raw

    async def _apply_verification(
        self,
        user_id: int,
        local_tx_id: int,
        status: Optional[TransactionStatus],
        detail_row: Optional[dict],
        raw: Optional[dict],
        destination: Optional[str] = None,
    ) -> Optional[LocalTransaction]:
        """Persist a verification outcome and backfill product/amount from the detail row.

        A None status leaves the current status untouched (record stays open).
        """
        stmt = select(LocalTransaction).where(
            LocalTransaction.id == local_tx_id,
            LocalTransaction.user_id == user_id,
        )
        record = (await self.db.execute(stmt)).scalar_one_or_none()
        if not record:
            return None

        if status is not None:
            record.status = status
        if destination:
            record.destination = destination

        if detail_row:
            product_name = detail_row.get("productName")
            if product_name:
                record.product_name = str(product_name)
            product_code = detail_row.get("productCode")
            if product_code:
                record.product_code = str(product_code)
            amount_raw = detail_row.get("amount")
            if amount_raw is not None:
                try:
                    record.amount = Decimal(str(amount_raw))
                except (InvalidOperation, ValueError):
                    pass

        if raw:
            detail_data = raw.get("result", {}).get("data") if isinstance(raw.get("result"), dict) else raw
            merged = dict(record.raw_response or {})
            merged["check_history_detail"] = detail_data
            record.raw_response = merged

        record.updated_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(record)
        return record

    async def _verify_and_update_with_retry(
        self,
        user_id: int,
        local_tx_id: int,
        transaction_id: str,
        msisdn: str,
        token: str,
        attempts: int = VERIFY_RETRY_ATTEMPTS,
        delay_seconds: float = VERIFY_RETRY_DELAY_SECONDS,
        fetch=None,
    ) -> None:
        """Immediate post-submit verification with a short retry window.

        Provider fulfillment is asynchronous, so the first look-ups usually return
        nothing yet. Retry a few times within ~15s; if it's still inconclusive the
        record stays PROCESSING and the background loop keeps checking.

        `fetch` is the verification source: a callable with the same signature as
        `_verify_via_history_detail` returning (status, detail_row, raw_response).
        Defaults to the provider's transaction-history-detail lookup.
        """
        fetch = fetch or self._verify_via_history_detail
        status: Optional[TransactionStatus] = None
        detail_row: Optional[dict] = None
        raw: Optional[dict] = None

        for attempt in range(attempts):
            status, detail_row, raw = await fetch(user_id, transaction_id, msisdn, token)
            if status in ("SUCCESS", "FAILED"):
                break
            if raw is None and detail_row is None:
                return  # no usable credentials — retrying cannot help
            if attempt < attempts - 1:
                await asyncio.sleep(delay_seconds)

        if status is None and detail_row is None and raw is None:
            return
        await self._apply_verification(user_id, local_tx_id, status, detail_row, raw)

    async def _resolve_product_brand(
        self, user_id: int, product_code: str | None
    ) -> str | None:
        """Snapshot the catalog owner (brand) for a product-based transaction."""
        if not product_code:
            return None

        owner = (
            await self.db.execute(
                select(Product.owner).where(
                    Product.user_id == user_id,
                    Product.product_code == product_code,
                )
            )
        ).scalar_one_or_none()

        normalized = (owner or "").strip()
        return normalized or None

    def _build_tx_record(
        self,
        user_id: int,
        transaction_type: str,
        provider_result: ProviderResult,
        request_payload: Dict[str, Any],
        extra: Dict[str, Any] | None = None,
        endpoint: str | None = None,
        unmasked_request: Dict[str, Any] | None = None,
    ) -> LocalTransaction:
        """Create LocalTransaction row (not committed).

        Masked copies (metadata_/raw_response) are for history display.
        Unmasked copies (metadata_unmasked/raw_response_unmasked) capture what was
        actually sent so the detail view can offer a reveal toggle and a cURL
        snippet. The request body never contains the plaintext PIN — only the
        provider-encrypted PIN.
        """
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

        unmasked_metadata: Dict[str, Any] | None = None
        if endpoint is not None or unmasked_request is not None:
            unmasked_metadata = {
                "method": "POST",
                "endpoint": provider_client.build_url(endpoint) if endpoint else None,
                "request": unmasked_request if unmasked_request is not None else {},
            }

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
            brand=extra.get("brand"),
            amount=extra.get("amount"),
            status=status,
            provider_reference=provider_reference,
            destination=extra.get("destination"),
            payment_method=extra.get("payment_method"),
            raw_response=masked_raw,
            raw_response_unmasked=provider_result.raw if provider_result.raw else None,
            metadata_=metadata,
            metadata_unmasked=unmasked_metadata,
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