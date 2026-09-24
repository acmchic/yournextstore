from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

try:
    from dotenv import load_dotenv

    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except ImportError:
    pass


def _int_env(name: str, default: int) -> int:
    value = os.getenv(name)
    if not value:
        return default
    return int(value)


def _float_env(name: str, default: float) -> float:
    value = os.getenv(name)
    if not value:
        return default
    return float(value)


def _bool_env(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _env(primary: str, fallback: str, default: str) -> str:
    return os.getenv(primary) or os.getenv(fallback) or default


@dataclass(frozen=True)
class Settings:
    mysql_host: str = _env("DB_HOST", "MYSQL_HOST", "127.0.0.1")
    mysql_port: int = _int_env("DB_PORT", _int_env("MYSQL_PORT", 3306))
    mysql_user: str = _env("DB_USER", "MYSQL_USER", "root")
    mysql_password: str = _env("DB_PASSWORD", "MYSQL_PASSWORD", "")
    mysql_database: str = _env("DB_NAME", "MYSQL_DATABASE", "pod_store")
    # Keep pooled connections younger than the usual MySQL idle timeout and
    # retry only read queries after a transient connection drop.
    mysql_connect_timeout: float = _float_env("DB_CONNECT_TIMEOUT", 5.0)
    mysql_pool_recycle: int = _int_env("DB_POOL_RECYCLE", 1800)
    mysql_read_retries: int = _int_env("DB_READ_RETRIES", 2)
    mysql_retry_backoff_ms: int = _int_env("DB_RETRY_BACKOFF_MS", 100)

    asset_root: Path = field(
        default_factory=lambda: Path(os.getenv("MOCKUP_ASSET_ROOT", "./public")).resolve()
    )
    cache_dir: Path = field(
        default_factory=lambda: Path(os.getenv("MOCKUP_CACHE_DIR", "./.cache/mockups")).resolve()
    )
    default_width: int = _int_env("MOCKUP_DEFAULT_WIDTH", 1200)
    max_width: int = _int_env("MOCKUP_MAX_WIDTH", 2400)
    default_format: str = os.getenv("MOCKUP_DEFAULT_FORMAT", "webp")
    webp_quality: int = _int_env("MOCKUP_WEBP_QUALITY", 94)
    jpeg_quality: int = _int_env("MOCKUP_JPEG_QUALITY", 90)
    url_signing_secret: str = os.getenv("MOCKUP_URL_SECRET") or mysql_password
    allow_unsigned_urls: bool = _bool_env("MOCKUP_ALLOW_UNSIGNED_URLS", False)
    signing_admin_key: str = os.getenv("MOCKUP_SIGNING_ADMIN_KEY", "")
    gearment_client_key: str = _env("GEARMENT_CLIENT_KEY", "GEARMENT_API_KEY", "") or os.getenv(
        "X-Gearment-Client-Key", ""
    )
    gearment_client_secret: str = _env(
        "GEARMENT_CLIENT_SECRET", "GEARMENT_API_SECRET", ""
    ) or os.getenv("X-Gearment-Client-Secret", "")
    gearment_api_base_url: str = os.getenv(
        "GEARMENT_API_BASE_URL", "https://apiv2.gearment.com/integration-handler"
    ).rstrip("/")
    gearment_import_limit: int = _int_env("GEARMENT_IMPORT_LIMIT", 40)
    stripe_secret_key: str = os.getenv("STRIPE_SECRET_KEY", "")
    stripe_webhook_secret: str = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    stripe_automatic_tax: bool = _bool_env("STRIPE_AUTOMATIC_TAX", False)
    storefront_public_url: str = (
        os.getenv("STOREFRONT_PUBLIC_URL") or "https://teebravo.com"
    ).rstrip("/")
    checkout_success_url: str = os.getenv("CHECKOUT_SUCCESS_URL") or (
        storefront_public_url + "/checkout/success?session_id={CHECKOUT_SESSION_ID}"
    )
    checkout_cancel_url: str = (
        os.getenv("CHECKOUT_CANCEL_URL") or storefront_public_url + "/checkout"
    )
    contact_email_to: str = os.getenv("CONTACT_EMAIL_TO", "help@teebravo.com")
    smtp_host: str = os.getenv("SMTP_HOST", "")
    smtp_port: int = _int_env("SMTP_PORT", 587)
    smtp_username: str = os.getenv("SMTP_USERNAME", "")
    smtp_password: str = os.getenv("SMTP_PASSWORD", "")
    smtp_from_email: str = os.getenv("SMTP_FROM_EMAIL", "")
    smtp_use_ssl: bool = _bool_env("SMTP_USE_SSL", False)
    smtp_starttls: bool = _bool_env("SMTP_STARTTLS", True)


settings = Settings()
