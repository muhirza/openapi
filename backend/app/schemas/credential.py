from typing import List, Optional
from pydantic import BaseModel, Field


# All supported api_name values for the credential table
CREDENTIAL_API_NAMES = [
    "get_token",
    "balance_eload",
    "balance_dompul",
    "balance_pulsa",
    "history_api",
    "product_list",
    "encrypt_pin",
    "buy_pulsa",
    "buy_data_package",
    "cocktail_sf",
    "package_injection",
]

CREDENTIAL_LABELS = {
    "get_token": "Get Token (Client ID / Secret)",
    "balance_eload": "Eload Balance API",
    "balance_dompul": "Dompul Balance API",
    "balance_pulsa": "Pulsa Balance API",
    "history_api": "Transaction History API",
    "product_list": "Product List API",
    "encrypt_pin": "Encrypt PIN API",
    "buy_pulsa": "Buy Pulsa API",
    "buy_data_package": "Buy Data Package API",
    "cocktail_sf": "Cocktail SF API",
    "package_injection": "Package Injection API",
}


class CredentialInput(BaseModel):
    api_name: str = Field(default="get_token")
    client_id: str = Field(..., min_length=1)
    client_secret: str = Field(..., min_length=1)


class CredentialStatus(BaseModel):
    has_credentials: bool
    api_name: str = "get_token"
    client_id_masked: str | None = None
    saved_at: str | None = None


class CredentialItemStatus(BaseModel):
    api_name: str
    label: str
    has_credentials: bool
    client_id_masked: str | None = None
    saved_at: str | None = None


class CredentialListStatus(BaseModel):
    items: List[CredentialItemStatus] = []
