import pytest

from app.services.brand_service import normalize_msisdn, resolve_brand


@pytest.mark.parametrize(
    "value,expected",
    [
        ("6288989493439", "SMARTFREN"),
        ("088989493439", "SMARTFREN"),
        ("+62 889-8949-3439", "SMARTFREN"),
        ("6287780490505", "XL"),
        ("087780490505", "XL"),
        ("6281780490505", "XL"),
        ("6285923456789", "XL"),
        ("6283123456789", "AXIS"),
        ("6283876543210", "AXIS"),
        ("083812345678", "AXIS"),
        ("6281112345678", None),
        ("", None),
        (None, None),
        ("12345", None),
    ],
)
def test_resolve_brand(value, expected):
    assert resolve_brand(value) == expected


def test_normalize_msisdn_variants():
    assert normalize_msisdn("+62 877-8049-0505") == "6287780490505"
    assert normalize_msisdn("087780490505") == "6287780490505"
    assert normalize_msisdn("87780490505") == "6287780490505"
    assert normalize_msisdn("6288989493439") == "6288989493439"
    assert normalize_msisdn("12345") is None
