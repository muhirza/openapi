from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.schemas.balance import BalanceResponse, BalanceSummary
from app.services.token_service import TokenService, TokenFetchError
from app.services.provider_client import provider_client, ProviderAPIError


# Map api_name -> (endpoint_setting, header_setting)
BALANCE_API_CONFIG = {
    "eload": ("balance_eload", "balance_eload"),
    "dompul": ("balance_dompul", "balance_dompul"),
    "pulsa": ("balance_pulsa", "balance_pulsa"),
}


class BalanceService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def fetch_balance(self, user_id: int, balance_type: str) -> BalanceResponse:
        """Fetch a single balance (eload | dompul | pulsa)."""
        if balance_type not in BALANCE_API_CONFIG:
            raise ValueError(f"Invalid balance type: {balance_type}")

        endpoint_key, header_key = BALANCE_API_CONFIG[balance_type]
        endpoint = getattr(settings, f"provider_{endpoint_key}_endpoint")
        header_template = getattr(settings, f"provider_{header_key}_headers")
        cred_api_name = f"balance_{balance_type}"

        token_svc = TokenService(self.db)

        # 1. Get valid token
        token_obj = await token_svc.get_valid_token(user_id)
        if not token_obj:
            raise TokenFetchError("No valid provider token. Configure Get Token credentials first.")
        from app.core.security import decrypt_value
        token = decrypt_value(token_obj.access_token_encrypted)

        # 2. Get API credentials
        creds = await token_svc.get_credentials_by_name(user_id, cred_api_name)
        if not creds:
            raise TokenFetchError(f"No credentials configured for {cred_api_name}.")
        api_id, api_key = await token_svc.decrypt_credentials(creds)

        # 3. Call provider
        data = await provider_client.get(
            endpoint=endpoint,
            header_template=header_template,
            token=token,
            api_id=api_id,
            api_key=api_key,
        )

        # 4. Parse balance
        balance = self._parse_balance(data)
        return BalanceResponse(
            balance_type=balance_type,
            balance=balance,
            fetched_at=datetime.now(timezone.utc),
        )

    async def fetch_all_balances(self, user_id: int) -> BalanceSummary:
        """Fetch all three balances; returns per-type results (errors captured per type)."""
        summary = BalanceSummary()
        for btype in ("eload", "dompul", "pulsa"):
            try:
                resp = await self.fetch_balance(user_id, btype)
                setattr(summary, btype, resp)
            except (TokenFetchError, ProviderAPIError, ValueError):
                setattr(summary, btype, None)  # leave None on error
        return summary

    @staticmethod
    def _parse_balance(data) -> Decimal:
        # data may be number directly, or wrapped in result.data
        if isinstance(data, (int, float, Decimal)):
            return Decimal(str(data))
        if isinstance(data, dict):
            # try common wrappers
            for key in ("data", "balance", "result"):
                if key in data:
                    v = data[key]
                    if isinstance(v, (int, float, Decimal)):
                        return Decimal(str(v))
                    if isinstance(v, dict) and "data" in v:
                        try:
                            return Decimal(str(v["data"]))
                        except InvalidOperation:
                            continue
            # try to convert a numeric string
            for v in data.values():
                if isinstance(v, (int, float)):
                    return Decimal(str(v))
        if isinstance(data, str):
            try:
                return Decimal(data)
            except InvalidOperation:
                pass
        raise ValueError(f"Cannot parse balance from data: {data}")