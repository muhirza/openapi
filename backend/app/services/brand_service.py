"""Resolve Indonesian mobile brands from MSISDN prefixes.

Prefix mapping supplied for this deployment:
- SMARTFREN: 6288...
- XL: 62817, 62818, 62819, 62859, 62877, 62878
- AXIS: 62831, 62832, 62833, 62838

Prefix inference is a heuristic (number portability can move a number between
operators), so the resolved brand is stored once on the transaction as a
snapshot rather than being re-inferred on every analytics query.
"""

import re

SMARTFREN_PREFIX = "6288"
XL_PREFIXES = ("62817", "62818", "62819", "62859", "62877", "62878")
AXIS_PREFIXES = ("62831", "62832", "62833", "62838")


def normalize_msisdn(value: str | None) -> str | None:
    """Normalize +62 / 62 / 0 / 8-prefixed input to a 62-prefixed number."""
    if not value:
        return None

    digits = re.sub(r"\D", "", str(value))
    if digits.startswith("0"):
        digits = "62" + digits[1:]
    elif digits.startswith("8"):
        digits = "62" + digits

    if not digits.startswith("62") or not (10 <= len(digits) <= 15):
        return None
    return digits


def resolve_brand(value: str | None) -> str | None:
    """Return SMARTFREN/XL/AXIS for a known prefix, otherwise None."""
    digits = normalize_msisdn(value)
    if not digits:
        return None

    if digits.startswith(SMARTFREN_PREFIX):
        return "SMARTFREN"
    if any(digits.startswith(prefix) for prefix in XL_PREFIXES):
        return "XL"
    if any(digits.startswith(prefix) for prefix in AXIS_PREFIXES):
        return "AXIS"
    return None
