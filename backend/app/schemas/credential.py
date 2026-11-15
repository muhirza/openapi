from typing import List, Optional
from pydantic import BaseModel, Field


# All supported api_name values for the credential table
CREDENTIAL_API_NAMES = [
    "get_token",
    "balance_eload",
    "balance_dompul",
    "history_api",
    "history_detail",
    "product_list",
    "encrypt_pin",
    "buy_pulsa",
    "buy_data_package",
    "cocktail_sf",
    "package_injection",
    "awg",
    "xwg",
    "awg_stock_inject",
    "xwg_stock_inject",
    "awg_transaction_info_detail",
    "xwg_transaction_info_detail",
]

CREDENTIAL_LABELS = {
    "get_token": "Dapatkan Token (Client ID / Secret)",
    "balance_eload": "API Saldo Eload",
    "balance_dompul": "API Saldo Dompul",
    "history_api": "API Riwayat Transaksi",
    "history_detail": "API Detail Riwayat Transaksi",
    "product_list": "API Daftar Produk",
    "encrypt_pin": "API Enkripsi PIN",
    "buy_pulsa": "API Pulsa",
    "buy_data_package": "API Beli Paket Data",
    "cocktail_sf": "API Cocktail PV SF",
    "package_injection": "API Cocktail SP",
    "awg": "API Stok AWG",
    "xwg": "API Stok XWG",
    "awg_stock_inject": "API Injeksi Stok AWG",
    "xwg_stock_inject": "API Injeksi Stok XWG",
    "awg_transaction_info_detail": "API Detail Info Transaksi AWG",
    "xwg_transaction_info_detail": "API Detail Info Transaksi XWG",
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
