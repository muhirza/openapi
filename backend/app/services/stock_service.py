from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Optional
from urllib.parse import unquote

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import decrypt_value
from app.schemas.stock import StockItemOut, StockListResponse
from app.services.provider_client import provider_client
from app.services.token_service import TokenFetchError, TokenService

SUPPORTED_FAMILIES = ("awg", "xwg")


def _normalise_date(value: Any) -> Optional[str]:
    """Provider stock dates are DD-MM-YYYY; normalise to ISO for the UI."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    try:
        return datetime.strptime(text, "%d-%m-%Y").date().isoformat()
    except ValueError:
        return text


def _to_decimal(value: Any) -> Optional[Decimal]:
    if value is None or value == "":
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError):
        return None


def _to_int(value: Any) -> int:
    try:
        return int(str(value).strip())
    except (TypeError, ValueError):
        return 0


class StockService:
    """Digital stock lookups for the AWG and XWG families."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.token_svc = TokenService(db)

    async def get_stock(
        self,
        user_id: int,
        family: str,
        ro_type: Optional[str] = None,
    ) -> StockListResponse:
        if family not in SUPPORTED_FAMILIES:
            raise ValueError(f"Keluarga stok tidak didukung: {family}")

        token_obj = await self.token_svc.get_valid_token(user_id)
        if not token_obj:
            raise TokenFetchError("Tidak ada token penyedia yang valid. Konfigurasikan Get Token terlebih dahulu.")
        token = decrypt_value(token_obj.access_token_encrypted)

        creds = await self.token_svc.get_credentials_by_name(user_id, family)
        if not creds:
            raise TokenFetchError(
                f"Belum ada kredensial untuk API {family.upper()}. "
                "Tambahkan di Konfigurasi API."
            )
        api_id, api_key = await self.token_svc.decrypt_credentials(creds)

        params: Optional[dict] = None
        if family == "xwg":
            params = {"roType": ro_type or settings.provider_xwg_stock_default_ro_type}

        data = await provider_client.get(
            endpoint=getattr(settings, f"provider_{family}_stock_endpoint"),
            header_template=getattr(settings, f"provider_{family}_stock_headers"),
            token=token,
            api_id=api_id,
            api_key=api_key,
            params=params,
        )

        items = self._parse_items(data)
        stock_value = sum(
            (item.voucher_price or Decimal("0")) * item.voucher_balance for item in items
        )
        total_vouchers = sum(item.voucher_balance for item in items)

        return StockListResponse(
            family=family,
            items=items,
            total=len(items),
            stock_value=stock_value,
            total_vouchers=total_vouchers,
            ro_type=params["roType"] if params else None,
            fetched_at=datetime.now(timezone.utc),
        )

    @staticmethod
    def _parse_items(data: Any) -> list[StockItemOut]:
        if isinstance(data, list):
            rows = data
        elif isinstance(data, dict):
            rows = [data]
        else:
            return []

        items: list[StockItemOut] = []
        for row in rows:
            if not isinstance(row, dict):
                continue
            code = str(row.get("voucherTypeCode") or "").strip()
            if not code:
                continue
            description = str(row.get("description") or "").strip()
            allow_type = str(row.get("allowType") or "").strip()
            voucher_id = str(row.get("vId") or "").strip()
            items.append(
                StockItemOut(
                    voucher_type_code=code,
                    description=description or None,
                    voucher_price=_to_decimal(row.get("voucherPrice")),
                    voucher_balance=_to_int(row.get("voucherBalance")),
                    effective_date=_normalise_date(row.get("effectiveDate")),
                    expiration_date=_normalise_date(row.get("expirationDate")),
                    voucher_exp_date=_normalise_date(row.get("vouExpDate")),
                    allow_type=allow_type or None,
                    # vId arrives URL-encoded and is long; decode for storage/copy
                    voucher_id=unquote(voucher_id) if voucher_id else None,
                )
            )
        return items
