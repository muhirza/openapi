import httpx
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional, Any

from app.core.config import settings
from app.core.security import decrypt_value


class ProviderAPIError(Exception):
    """Raised when provider returns non-200 or result.errorCode != '00'."""

    def __init__(self, message: str, status_code: int | None = None, raw: dict | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.raw = raw


@dataclass
class ProviderResult:
    """Non-raising provider response wrapper (MVP2 transactions).

    Holds the parsed envelope plus the raw response for audit trails.
    """
    ok: bool
    data: Any = None
    raw: dict | None = None
    http_status: int | None = None
    error_code: str | None = None
    error_message: str | None = None
    network_error: str | None = None


class ProviderClient:
    """Async HTTP client for XL Gateway provider APIs.

    Handles:
    - Building full URL from base + prefix + endpoint
    - Building headers from template with placeholders
    - Injecting Authorization: Bearer {token}
    - Parsing the standard envelope: {statusCode, statusMessage, result: {errorCode, errorMessage, data}}
    """

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout

    def build_url(self, endpoint: str) -> str:
        base = settings.provider_base_url.rstrip("/")
        prefix = settings.provider_api_prefix.rstrip("/")
        return f"{base}{prefix}{endpoint}"

    def _build_headers(
        self,
        template: str,
        token: str,
        api_id: str,
        api_key: str,
    ) -> dict:
        """Replace placeholders in header template and return dict."""
        subs = {
            "{token}": token,
            "{api_id}": api_id,
            "{api_key}": api_key,
        }
        headers_str = template
        for placeholder, value in subs.items():
            headers_str = headers_str.replace(placeholder, value)

        headers = {}
        for part in headers_str.split(","):
            part = part.strip()
            if ":" in part:
                k, v = part.split(":", 1)
                headers[k.strip()] = v.strip()
        return headers

    async def _request(
        self,
        method: str,
        url: str,
        headers: dict,
        params: dict | None = None,
    ) -> dict:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            try:
                resp = await client.request(
                    method.upper(),
                    url,
                    headers=headers,
                    params=params,
                )
            except httpx.HTTPError as e:
                raise ProviderAPIError(
                    f"Network error calling provider: {type(e).__name__}: {e}"
                ) from e

        if resp.status_code != 200:
            raise ProviderAPIError(
                f"Provider returned HTTP {resp.status_code}",
                status_code=resp.status_code,
                raw=resp.json() if resp.headers.get("content-type", "").startswith("application/json") else None,
            )

        try:
            data = resp.json()
        except Exception as e:
            raise ProviderAPIError(f"Invalid JSON from provider: {e}") from e

        # Parse standard envelope
        result = data.get("result", {})
        error_code = result.get("errorCode")
        error_message = result.get("errorMessage", "Unknown error")

        if error_code != "00":
            raise ProviderAPIError(
                f"Provider error {error_code}: {error_message}",
                status_code=resp.status_code,
                raw=data,
            )

        return result.get("data", {})

    async def get(
        self,
        endpoint: str,
        header_template: str,
        token: str,
        api_id: str,
        api_key: str,
        params: dict | None = None,
    ) -> dict:
        headers = self._build_headers(header_template, token, api_id, api_key)
        return await self._request("GET", self.build_url(endpoint), headers, params)

    async def post(
        self,
        endpoint: str,
        header_template: str,
        token: str,
        api_id: str,
        api_key: str,
        data: dict | None = None,
    ) -> dict:
        url = self.build_url(endpoint)
        headers = self._build_headers(header_template, token, api_id, api_key)
        return await self._request("POST", url, headers, params=data)

    # --- MVP2 non-raising methods (existing methods above unchanged) ---

    def _parse_envelope(self, http_status: int, data: dict | None) -> ProviderResult:
        """Parse standard envelope into ProviderResult without raising."""
        if not isinstance(data, dict):
            return ProviderResult(
                ok=False,
                data=data,
                raw=None,
                http_status=http_status,
                error_code="INVALID_RESPONSE",
                error_message="Non-JSON or non-object response",
            )
        result = data.get("result", {}) if isinstance(data.get("result"), dict) else {}
        error_code = result.get("errorCode")
        error_message = result.get("errorMessage", "Unknown error")
        return ProviderResult(
            ok=error_code == "00",
            data=result.get("data"),
            raw=data,
            http_status=http_status,
            error_code=error_code,
            error_message=None if error_code == "00" else error_message,
        )

    async def post_json(
        self,
        endpoint: str,
        header_template: str,
        token: str,
        api_id: str,
        api_key: str,
        json_body: dict | list | None = None,
    ) -> ProviderResult:
        """POST with JSON body; returns full envelope; does NOT raise."""
        url = self.build_url(endpoint)
        headers = self._build_headers(header_template, token, api_id, api_key)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.post(url, json=json_body, headers=headers)
        except httpx.HTTPError as e:
            return ProviderResult(
                ok=False,
                network_error=f"{type(e).__name__}: {e}",
            )
        try:
            data = resp.json()
        except Exception:
            return ProviderResult(
                ok=False,
                http_status=resp.status_code,
                error_code="INVALID_JSON",
                error_message="Invalid JSON from provider",
            )
        return self._parse_envelope(resp.status_code, data)

    async def get_full(
        self,
        endpoint: str,
        header_template: str,
        token: str,
        api_id: str,
        api_key: str,
        params: dict | None = None,
    ) -> ProviderResult:
        """GET returning full envelope; does NOT raise."""
        url = self.build_url(endpoint)
        headers = self._build_headers(header_template, token, api_id, api_key)
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(url, params=params, headers=headers)
        except httpx.HTTPError as e:
            return ProviderResult(
                ok=False,
                network_error=f"{type(e).__name__}: {e}",
            )
        try:
            data = resp.json()
        except Exception:
            return ProviderResult(
                ok=False,
                http_status=resp.status_code,
                error_code="INVALID_JSON",
                error_message="Invalid JSON from provider",
            )
        return self._parse_envelope(resp.status_code, data)


# Global instance
provider_client = ProviderClient()