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
    # Cookbook-quality parsing. Prefer Bedrock locally via AI_PROVIDER=bedrock|auto.
    openai_model: str = "gpt-4o"
    openai_vision_model: str = "gpt-4o"
    ai_provider: str = Field(
        default="auto",
        validation_alias=AliasChoices("AI_PROVIDER", "ai_provider"),
    )
    aws_region: str = Field(
        default="us-east-1",
        validation_alias=AliasChoices("AWS_REGION", "aws_region"),
    )
    bedrock_parse_model: str = Field(
        default="amazon.nova-pro-v1:0",
        validation_alias=AliasChoices("BEDROCK_PARSE_MODEL", "bedrock_parse_model"),
    )
    bedrock_vision_model: str = Field(
        default="amazon.nova-pro-v1:0",
        validation_alias=AliasChoices("BEDROCK_VISION_MODEL", "bedrock_vision_model"),
    )
    # Gemini / Vertex native video understanding (preferred for social ingest when set).
    # Use GEMINI_API_KEY for Google AI Studio, or Vertex via GOOGLE_CLOUD_PROJECT + ADC.
    gemini_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("GEMINI_API_KEY", "gemini_api_key"),
    )
    # Alias used by some Vertex setups (project id). Prefer GOOGLE_CLOUD_PROJECT.
    google_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("GOOGLE_KEY", "google_key"),
    )
    google_cloud_project: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("GOOGLE_CLOUD_PROJECT", "google_cloud_project"),
    )
    vertex_location: str = Field(
        default="us-central1",
        validation_alias=AliasChoices("VERTEX_LOCATION", "vertex_location"),
    )
    gemini_vision_model: str = Field(
        default="gemini-3.5-flash",
        validation_alias=AliasChoices("GEMINI_VISION_MODEL", "gemini_vision_model"),
    )
    # How to watch cooking videos: gemini (native mp4) | frames (JPEG multi-agent) | auto
    social_vision_provider: str = Field(
        default="auto",
        validation_alias=AliasChoices("SOCIAL_VISION_PROVIDER", "social_vision_provider"),
    )
    # Speech-to-text: auto (AWS when bucket+creds, else OpenAI), aws, or openai.
    transcribe_provider: str = Field(
        default="auto",
        validation_alias=AliasChoices("TRANSCRIBE_PROVIDER", "transcribe_provider"),
    )
    # "auto" enables Amazon Transcribe language identification; else a code like "en-US".
    transcribe_language: str = Field(
        default="auto",
        validation_alias=AliasChoices("TRANSCRIBE_LANGUAGE", "transcribe_language"),
    )
    transcribe_max_wait_seconds: float = Field(
        default=90.0,
        validation_alias=AliasChoices("TRANSCRIBE_MAX_WAIT_SECONDS", "transcribe_max_wait_seconds"),
    )
    # S3 bucket for Amazon Transcribe temp audio (required for aws provider).
    ingest_temp_bucket: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("INGEST_TEMP_BUCKET", "ingest_temp_bucket"),
    )
    # accurate | balanced | fast — balanced is ~half the vision cost of accurate.
    social_vision_quality: str = Field(
        default="balanced",
        validation_alias=AliasChoices("SOCIAL_VISION_QUALITY", "social_vision_quality"),
    )
    # Dense sampling overrides (used when quality preset doesn't apply / legacy).
    social_frame_sample_fps: float = Field(
        default=1.0,
        validation_alias=AliasChoices("SOCIAL_FRAME_SAMPLE_FPS", "social_frame_sample_fps"),
    )
    social_scene_threshold: float = Field(
        default=0.28,
        validation_alias=AliasChoices("SOCIAL_SCENE_THRESHOLD", "social_scene_threshold"),
    )
    # Max stills kept in cache after dense+scene merge.
    social_step_max_frames: int = Field(
        default=60,
        validation_alias=AliasChoices("SOCIAL_STEP_MAX_FRAMES", "social_step_max_frames"),
    )
    # Specialist vision calls subsample to this many frames.
    social_vision_max_frames: int = Field(
        default=24,
        validation_alias=AliasChoices("SOCIAL_VISION_MAX_FRAMES", "social_vision_max_frames"),
    )
    # Multi-agent video analysis: segment observers + OCR/ingredient/action specialists.
    social_vision_multi_agent: bool = Field(
        default=True,
        validation_alias=AliasChoices("SOCIAL_VISION_MULTI_AGENT", "social_vision_multi_agent"),
    )
    social_vision_segment_frames: int = Field(
        default=6,
        validation_alias=AliasChoices("SOCIAL_VISION_SEGMENT_FRAMES", "social_vision_segment_frames"),
    )
    social_vision_segment_overlap: int = Field(
        default=1,
        validation_alias=AliasChoices(
            "SOCIAL_VISION_SEGMENT_OVERLAP", "social_vision_segment_overlap"
        ),
    )
    social_vision_max_segments: int = Field(
        default=6,
        validation_alias=AliasChoices("SOCIAL_VISION_MAX_SEGMENTS", "social_vision_max_segments"),
    )
    social_vision_max_workers: int = Field(
        default=4,
        validation_alias=AliasChoices("SOCIAL_VISION_MAX_WORKERS", "social_vision_max_workers"),
    )
    # How step video timestamps are assigned:
    #   none — off (default). Steps are a plain ordered list; no video-time syncing.
    #   deterministic — frame clock / scene cuts / transcript keyword match (no LLM times)
    #   ai — allow vision/LLM timeline cues (drifts badly on silent short-form video)
    social_timestamp_mode: str = Field(
        default="none",
        validation_alias=AliasChoices("SOCIAL_TIMESTAMP_MODE", "social_timestamp_mode"),
    )
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

    uploads_bucket: Optional[str] = None
    uploads_public_base_url: Optional[str] = None

    resend_api_key: Optional[str] = None
    # AWS API Gateway base (async ingest/parse). Exposed to clients via GET /features.
    aws_api_url: Optional[str] = None
    # AWS API Gateway email endpoint (same HttpApi as ingest). Preferred on Render.
    email_api_url: Optional[str] = None
    email_api_secret: Optional[str] = None

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
    # Opt-in: Amazon Transcribe for speech-to-text (requires INGEST_TEMP_BUCKET).
    feature_aws_transcribe_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices("FEATURE_AWS_TRANSCRIBE", "FEATURE_AWS_TRANSCRIBE_ENABLED"),
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
        "gemini_api_key",
        "resend_api_key",
        "email_api_secret",
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
