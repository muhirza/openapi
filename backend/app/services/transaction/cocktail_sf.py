from typing import Dict, Any, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.local_transaction import LocalTransaction
from app.schemas.transaction import TransactionStatus
from app.services.token_service import TokenService
from app.services.provider_client import provider_client, ProviderResult
from app.services.transaction.base import TransactionServiceBase


class CocktailSFService(TransactionServiceBase):
    """Cocktail SF — /post-xwg-tembak with target array."""

    api_name = "cocktail_sf"
    transaction_endpoint_setting = "provider_cocktail_sf_endpoint"
    transaction_headers_setting = "provider_cocktail_sf_headers"

    def _map_status(self, result: ProviderResult) -> TransactionStatus:
        if not result.ok:
            return "FAILED"
        # Success returns a string reference
        if isinstance(result.data, str):
            return "SUCCESS"
        return "FAILED"

    async def execute(
        self,
        user_id: int,
        product_code: str,
        targets: list[str],
    ) -> LocalTransaction:
        # 1. Get PIN
        plain_pin = await self.pin_svc.get_pin(user_id)

        # 2. Encrypt PIN
        enc_pin, _ = await self._encrypt_pin(user_id, plain_pin)

        # 3. Transaction API creds
        token, api_id, api_key = await self._get_token_and_creds(user_id, self.api_name)

        # 4. Call Cocktail SF
        endpoint = getattr(settings, "provider_cocktail_sf_endpoint")
        header_template = getattr(settings, "provider_cocktail_sf_headers")
        req_body = {
            "productCode": product_code,
            "command": "cocktail-vd",
            "pin": enc_pin,
            "target": targets,
        }
        tx_result = await provider_client.post_json(endpoint, header_template, token, api_id, api_key, req_body)

        # 5. Build record
        request_payload = {
            "productCode": product_code,
            "command": "cocktail-vd",
            "pin": "[ENCRYPTED]",
            "target": targets,
        }
        record = self._build_tx_record(
            user_id=user_id,
            transaction_type="cocktail_sf",
            provider_result=tx_result,
            request_payload=request_payload,
            extra={
                "product_code": product_code,
                "metadata": {"targets": targets},
            },
            endpoint=endpoint,
            unmasked_request=req_body,
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return record