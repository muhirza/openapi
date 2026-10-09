import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import encrypt_value, decrypt_value
from app.models.api_credential import ApiCredential
from app.models.api_token import ApiToken


class TokenFetchError(Exception):
    pass


class TokenService:
    def __init__(self, db: AsyncSession):
        self.db = db

    def _build_token_url(self) -> str:
        return f"{settings.provider_base_url.rstrip('/')}{settings.provider_token_endpoint}"

    def _build_token_request(self, client_id: str, client_secret: str) -> tuple[dict, dict]:
        headers = {}
        data = {}

        if settings.provider_token_content_type == "application/json":
            headers["Content-Type"] = "application/json"
            data = {
                "grant_type": settings.provider_token_grant_type,
                "client_id": client_id,
                "client_secret": client_secret,
            }
        else:
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            data = {
                "grant_type": settings.provider_token_grant_type,
                "client_id": client_id,
                "client_secret": client_secret,
            }

        if settings.provider_token_extra_fields:
            for pair in settings.provider_token_extra_fields.split(","):
                if "=" in pair:
                    k, v = pair.split("=", 1)
                    data[k.strip()] = v.strip()

        return headers, data

    async def get_stored_token(self, user_id: int, api_name: str = "get_token") -> Optional[ApiToken]:
        result = await self.db.execute(
            select(ApiToken).where(
                ApiToken.user_id == user_id,
                ApiToken.api_name == api_name
            )
        )
        return result.scalar_one_or_none()

    async def get_credentials(self, user_id: int) -> Optional[ApiCredential]:
        """Deprecated: use get_credentials_by_name instead (supports multiple credentials)."""
        return await self.get_credentials_by_name(user_id, "get_token")

    async def get_credentials_by_name(self, user_id: int, api_name: str) -> Optional[ApiCredential]:
        result = await self.db.execute(
            select(ApiCredential).where(
                ApiCredential.user_id == user_id,
                ApiCredential.api_name == api_name
            )
        )
        return result.scalar_one_or_none()

    async def decrypt_credentials(self, cred: ApiCredential) -> tuple[str, str]:
        """Return (client_id, client_secret) plaintext pair."""
        client_id = decrypt_value(cred.client_id_encrypted)
        client_secret = decrypt_value(cred.client_secret_encrypted)
        return client_id, client_secret

    async def is_token_valid(self, token: ApiToken) -> bool:
        return token.expires_at > datetime.now(timezone.utc)

    async def fetch_new_token(self, user_id: int) -> Optional[ApiToken]:
        creds = await self.get_credentials(user_id)
        if not creds:
            raise TokenFetchError("No credentials configured")

        client_id = decrypt_value(creds.client_id_encrypted)
        client_secret = decrypt_value(creds.client_secret_encrypted)

        url = self._build_token_url()
        headers, data = self._build_token_request(client_id, client_secret)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                if settings.provider_token_method.upper() == "POST":
                    if settings.provider_token_content_type == "application/json":
                        resp = await client.post(url, json=data, headers=headers)
                    else:
                        resp = await client.post(url, data=data, headers=headers)
                else:
                    resp = await client.get(url, params=data, headers=headers)
        except httpx.HTTPError as e:
            raise TokenFetchError(f"Provider API error: {type(e).__name__}: {str(e)}")

        if resp.status_code != 200:
            raise TokenFetchError(f"Provider returned status {resp.status_code}: {resp.text}")

        token_data = resp.json()
        access_token = token_data.get("access_token")
        if not access_token:
            return None

        expires_in = token_data.get("expires_in", settings.provider_token_lifetime_seconds)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=expires_in)
        scope = token_data.get("scope")
        token_type = token_data.get("token_type")

        # Upsert token
        existing = await self.get_stored_token(user_id)
        if existing:
            existing.access_token_encrypted = encrypt_value(access_token)
            existing.expires_at = expires_at
            existing.scope = scope
            existing.token_type = token_type
            existing.updated_at = datetime.now(timezone.utc)
            await self.db.commit()
            return existing
        else:
            new_token = ApiToken(
                user_id=user_id,
                api_name="get_token",
                access_token_encrypted=encrypt_value(access_token),
                expires_at=expires_at,
                scope=scope,
                token_type=token_type,
            )
            self.db.add(new_token)
            await self.db.commit()
            await self.db.refresh(new_token)
            return new_token

    async def get_valid_token(self, user_id: int) -> Optional[ApiToken]:
        """Get valid token, fetching new one if needed."""
        stored = await self.get_stored_token(user_id)
        if stored and await self.is_token_valid(stored):
            return stored
        return await self.fetch_new_token(user_id)

    async def force_refresh(self, user_id: int) -> Optional[ApiToken]:
        """Force refresh token even if current is valid."""
        return await self.fetch_new_token(user_id)