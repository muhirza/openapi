from typing import Dict, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.local_transaction import LocalTransaction
from app.services.brand_service import resolve_brand
from app.services.provider_client import provider_client
from app.services.transaction.base import TransactionServiceBase


class BuyPulsaService(TransactionServiceBase):
    """Buy Pulsa (W2P) — /post-w2p with free-text denom."""

    api_name = "buy_pulsa"
    transaction_endpoint_setting = "provider_buy_pulsa_endpoint"
    transaction_headers_setting = "provider_buy_pulsa_headers"

    async def execute(
        self,
        user_id: int,
        msisdn: str,
        denom: int,
    ) -> LocalTransaction:
        # 1. Get PIN
        plain_pin = await self.pin_svc.get_pin(user_id)

        # 2. Encrypt PIN
        enc_pin, encrypt_result = await self._encrypt_pin(user_id, plain_pin)

        # 3. Transaction API creds
        token, api_id, api_key = await self._get_token_and_creds(user_id, self.api_name)

        # 4. Call W2P
        endpoint = getattr(settings, "provider_buy_pulsa_endpoint")
        header_template = getattr(settings, "provider_buy_pulsa_headers")
        req_body = {"msisdn": msisdn, "pin": enc_pin, "denom": denom}
        tx_result = await provider_client.post_json(endpoint, header_template, token, api_id, api_key, req_body)

        # 5. Build record
        request_payload = {"msisdn": msisdn, "pin": "[ENCRYPTED]", "denom": denom}
        denom_int = int(denom)
        denom_label = f"{denom_int:,}".replace(",", ".")
        record = self._build_tx_record(
            user_id=user_id,
            transaction_type="buy_pulsa",
            provider_result=tx_result,
            request_payload=request_payload,
            extra={
                "product_code": f"PULSA_{denom_int}",
                "product_name": f"Pulsa {denom_label}",
                "product_type": "pulsa",
                "brand": resolve_brand(msisdn),
                "destination": msisdn,
                "amount": float(denom),
                "metadata": {"denom": denom},
            },
            endpoint=endpoint,
            unmasked_request=req_body,
        )
        self.db.add(record)
        await self.db.commit()
        await self.db.refresh(record)
        return record