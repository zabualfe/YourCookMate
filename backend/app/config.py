from __future__ import annotations

from typing import Optional

from pydantic import field_validator
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


def normalize_database_url(url: str) -> str:
    """Accept Supabase-style postgres:// URLs and normalize for SQLAlchemy."""
    if url.startswith("postgres://"):
        return "postgresql://" + url[len("postgres://") :]
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = "sqlite:///./yourcookmate.db"
    jwt_secret: str = "dev-change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24 * 7  # 7 days

    openai_api_key: Optional[str] = None
    openai_model: str = "gpt-4o-mini"
    openai_vision_model: str = "gpt-4o-mini"
    social_vision_max_frames: int = 8
    social_step_max_frames: int = 24
    step_clip_seconds: float = 3.5
    ytdlp_cookies_file: Optional[str] = None
    # Netscape-format cookies (for Render/cloud when a file path is not available).
    ytdlp_cookies: Optional[str] = None
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    google_ios_client_id: Optional[str] = None
    apple_client_id: Optional[str] = None
    # iOS native Sign in with Apple uses the app bundle ID as token audience.
    apple_ios_client_id: Optional[str] = None

    frontend_url: str = "http://localhost:5173"
    api_base_url: str = "http://127.0.0.1:8000"

    resend_api_key: Optional[str] = None

    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: str = "noreply@yourcookmate.com"
    smtp_use_tls: bool = True
    smtp_use_ssl: bool = False

    uploads_dir: str = "./uploads"
    max_icon_bytes: int = 2 * 1024 * 1024

    instacart_enabled: bool = False
    feature_auth_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("FEATURE_AUTH", "FEATURE_AUTH_ENABLED"),
    )
    feature_registration_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("FEATURE_REGISTRATION", "FEATURE_REGISTRATION_ENABLED"),
    )
    feature_ai_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("FEATURE_AI", "FEATURE_AI_ENABLED"),
    )
    feature_social_ingest_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("FEATURE_SOCIAL_INGEST", "FEATURE_SOCIAL_INGEST_ENABLED"),
    )
    feature_community_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("FEATURE_COMMUNITY", "FEATURE_COMMUNITY_ENABLED"),
    )
    feature_instacart_enabled: bool = Field(
        default=True,
        validation_alias=AliasChoices("FEATURE_INSTACART", "FEATURE_INSTACART_ENABLED"),
    )
    instacart_api_key: Optional[str] = None
    instacart_api_base: str = "https://connect.dev.instacart.tools"
    instacart_link_expires_days: int = 30

    # Instacart Connect OAuth (account linking — separate from IDP API key)
    instacart_connect_client_id: Optional[str] = None
    instacart_connect_client_secret: Optional[str] = None
    instacart_connect_api_base: str = "https://connect.dev.instacart.tools"
    instacart_connect_authorize_url: Optional[str] = None

    admin_emails: str = "zabualfe@gmail.com"

    @field_validator(
        "openai_api_key",
        "resend_api_key",
        "google_client_secret",
        mode="before",
    )
    @classmethod
    def strip_secret(cls, value: object) -> object:
        if isinstance(value, str):
            cleaned = value.strip()
            return cleaned or None
        return value

    @property
    def smtp_pass(self) -> Optional[str]:
        return self.smtp_password or self.resend_api_key

    @property
    def resolved_database_url(self) -> str:
        return normalize_database_url(self.database_url)

    @property
    def uses_sqlite(self) -> bool:
        return self.resolved_database_url.startswith("sqlite")

    @property
    def uses_supabase(self) -> bool:
        url = self.resolved_database_url
        return "supabase.co" in url or "supabase.com" in url


settings = Settings()
