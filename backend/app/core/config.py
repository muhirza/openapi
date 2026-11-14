from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_secret_key: str = "change-me"
    encryption_key: str = ""

    # Database
    database_url: str = "postgresql+asyncpg://dashboard:dashboard@db:5432/dashboard"
    postgres_host: str = "db"
    postgres_port: int = 5432

    # Provider API (Get Token)
    provider_base_url: str = "https://gateway.egw.xl.co.id"
    provider_token_endpoint: str = "/token"
    provider_token_method: str = "POST"
    provider_token_content_type: str = "application/x-www-form-urlencoded"
    provider_token_grant_type: str = "client_credentials"
    provider_token_lifetime_seconds: int = 3600
    provider_token_extra_fields: str = ""

    # Provider API prefix (shared path segment before endpoints)
    provider_api_prefix: str = "/sidompul/openapi/v1"

    # Per-API endpoints + headers (placeholders: {token} {api_id} {api_key})
    provider_balance_eload_endpoint: str = "/get-dompul-balance"
    provider_balance_eload_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Type: eload"
    )
    provider_balance_dompul_endpoint: str = "/get-dompul-balance"
    provider_balance_dompul_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, language: ID"
    )
    provider_history_endpoint: str = "/get-transaction-history"
    provider_history_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, language: ID"
    )
    provider_history_default_days: int = 30
    provider_history_max_days: int = 90
    provider_product_endpoint: str = "/get-product-list"
    provider_product_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, language: ID"
    )

    # Provider API (Transaction - MVP2)
    # Encrypt PIN
    provider_encrypt_pin_endpoint: str = "/post-encrypt"
    provider_encrypt_pin_headers: str = (
        "Authorization: Bearer {token}, apiId: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Buy Pulsa (W2P)
    provider_buy_pulsa_endpoint: str = "/post-w2p"
    provider_buy_pulsa_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Buy Data Package
    provider_buy_data_package_endpoint: str = "/post-package"
    provider_buy_data_package_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Cocktail SF
    provider_cocktail_sf_endpoint: str = "/post-xwg-tembak"
    provider_cocktail_sf_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Package Injection
    provider_package_injection_endpoint: str = "/post-package"
    provider_package_injection_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Transaction History Detail
    provider_history_detail_endpoint: str = "/get-transaction-history-detail"
    provider_history_detail_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Digital Stock (MVP2)
    # AWG stock
    provider_awg_stock_endpoint: str = "/get-awg-stock"
    provider_awg_stock_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, language: ID"
    )

    # XWG stock (roType query param, default MINI-GROSIR)
    provider_xwg_stock_endpoint: str = "/get-xwg-stock"
    provider_xwg_stock_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "Content-Type: application/json, language: ID"
    )
    provider_xwg_stock_default_ro_type: str = "MINI-GROSIR"

    # Stock injection
    provider_awg_stock_inject_endpoint: str = "/post-awg-tembak"
    provider_awg_stock_inject_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "Content-Type: application/json, language: ID"
    )
    provider_xwg_stock_inject_endpoint: str = "/post-xwg-tembak"
    provider_xwg_stock_inject_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Stock transaction info detail (verification source for injections)
    provider_awg_stock_info_detail_endpoint: str = "/post-awg-transaction-info-detail"
    provider_awg_stock_info_detail_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "Content-Type: application/json, language: ID"
    )
    provider_xwg_stock_info_detail_endpoint: str = "/post-xwg-transaction-info-detail"
    provider_xwg_stock_info_detail_headers: str = (
        "Authorization: Bearer {token}, apiid: {api_id}, apikey: {api_key}, "
        "language: ID, Content-Type: application/json"
    )

    # Sessions
    session_idle_minutes: int = 120
    session_absolute_hours: int = 12
    session_cookie_secure: bool = False

    # Comma-separated list of allowed browser origins
    allowed_origins: str = "http://localhost:3000"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
