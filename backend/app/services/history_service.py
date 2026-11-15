from datetime import datetime, timezone, timedelta
from decimal import Decimal, InvalidOperation
from typing import Optional, List

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.history import TransactionItem, HistoryResponse, HistoryStatus
from app.services.token_service import TokenService, TokenFetchError
from app.services.provider_client import provider_client, ProviderAPIError


class HistoryService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_api_history(
        self, user_id: int, days: int | None = None, startdate: str | None = None, enddate: str | None = None
    ) -> HistoryResponse:
        """Fetch transaction history from provider with date range."""
        endpoint = settings.provider_history_endpoint
        header_template = settings.provider_history_headers
        cred_api_name = "history_api"

        token_svc = TokenService(self.db)

        # Get token
        token_obj = await token_svc.get_valid_token(user_id)
        if not token_obj:
            raise TokenFetchError("Tidak ada token penyedia yang valid.")
        from app.core.security import decrypt_value
        token = decrypt_value(token_obj.access_token_encrypted)

        # Get credentials
        creds = await token_svc.get_credentials_by_name(user_id, cred_api_name)
        if not creds:
            raise TokenFetchError(f"Belum ada kredensial yang dikonfigurasi untuk {cred_api_name}.")
        api_id, api_key = await token_svc.decrypt_credentials(creds)

        # Build date range
        if not startdate or not enddate:
            if days is None:
                days = settings.provider_history_default_days
            days = min(days, settings.provider_history_max_days)
            end = datetime.now(timezone.utc)
            start = end - timedelta(days=days)
            startdate = start.strftime("%Y-%m-%d")
            enddate = end.strftime("%Y-%m-%d")

        params = {"startdate": startdate, "enddate": enddate}

        data = await provider_client.get(
            endpoint=endpoint,
            header_template=header_template,
            token=token,
            api_id=api_id,
            api_key=api_key,
            params=params,
        )

        items = self._parse_history(data)
        return HistoryResponse(
            items=items,
            total=len(items),
            source="api",
            date_range=f"{startdate} to {enddate}",
        )

    @staticmethod
    def _parse_history(data) -> List[TransactionItem]:
        # data should be a list of transaction objects
        items = []
        if not isinstance(data, list):
            # maybe wrapped
            if isinstance(data, dict):
                for key in ("data", "transactions", "items"):
                    if key in data and isinstance(data[key], list):
                        data = data[key]
                        break
            else:
                return items

        for row in data:
            if not isinstance(row, dict):
                continue
            try:
                amount = None
                raw_amount = row.get("amount") or row.get("Amount")
                if raw_amount is not None:
                    try:
                        amount = Decimal(str(raw_amount))
                    except InvalidOperation:
                        amount = None

                # Parse date
                raw_date = row.get("date") or row.get("Date") or row.get("transactionDate") or row.get("created_at")
                if isinstance(raw_date, str):
                    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d"):
                        try:
                            raw_date = datetime.strptime(raw_date, fmt)
                            break
                        except (ValueError, TypeError):
                            continue
                    else:
                        raw_date = None
                if raw_date is None:
                    raw_date = datetime.now(timezone.utc)

                items.append(TransactionItem(
                    transaction_ref=str(row.get("serial_number") or row.get("ref") or row.get("id") or ""),
                    date=raw_date,
                    transaction_type=str(row.get("service_type") or row.get("type") or "transaction"),
                    product=row.get("product"),
                    amount=amount,
                    status=str(row.get("status") or "unknown"),
                    destination=row.get("dest_number") or row.get("destination"),
                    payment_method=row.get("payment_method"),
                    provider_reference=row.get("serial_number"),
                    raw=row,
                ))
            except Exception:
                continue

        return items