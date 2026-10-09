"""Masking helpers for sensitive values before logging/storing."""

import copy

SENSITIVE_KEYS = {
    "pin",
    "encryptedpin",
    "encrypted_pin",
    "api_key",
    "apikey",
    "client_secret",
    "clientsecret",
    "access_token",
    "accesstoken",
    "authorization",
    "password",
    "secret",
}

MASK = "***MASKED***"


def _is_sensitive(key: str) -> bool:
    return key.lower().replace("-", "_") in SENSITIVE_KEYS


def mask_sensitive(value, parent_key: str | None = None):
    """Recursively mask sensitive values in dicts/lists/strings.

    Returns a deep copy; input is not mutated.
    """
    if isinstance(value, dict):
        masked = {}
        for k, v in value.items():
            if _is_sensitive(k):
                masked[k] = MASK
            else:
                masked[k] = mask_sensitive(v, parent_key=k)
        return masked
    if isinstance(value, list):
        return [mask_sensitive(item, parent_key=parent_key) for item in value]
    if parent_key and _is_sensitive(parent_key):
        return MASK
    return value


def mask_payload(payload: dict) -> dict:
    """Mask a request payload before persisting it."""
    return copy.deepcopy(mask_sensitive(payload))
