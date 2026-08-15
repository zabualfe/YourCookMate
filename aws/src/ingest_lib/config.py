from __future__ import annotations

import base64
import binascii
import os


def env_bool(name: str, default: bool = True) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes"}


def _load_ytdlp_cookies() -> str | None:
    b64 = (os.environ.get("YTDLP_COOKIES_B64") or "").strip()
    if b64:
        try:
            return base64.b64decode(b64).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError):
            pass
    raw = (os.environ.get("YTDLP_COOKIES") or "").strip()
    return raw or None


class Settings:
    ytdlp_cookies: str | None = _load_ytdlp_cookies()
    bedrock_vision_model: str = os.environ.get("BEDROCK_VISION_MODEL", "amazon.nova-lite-v1:0")
    bedrock_parse_model: str = os.environ.get(
        "BEDROCK_PARSE_MODEL",
        os.environ.get("BEDROCK_VISION_MODEL", "amazon.nova-lite-v1:0"),
    )
    aws_region: str = os.environ.get("AWS_REGION", "us-east-1")
    ingest_temp_bucket: str | None = os.environ.get("INGEST_TEMP_BUCKET") or None
    social_vision_max_frames: int = int(os.environ.get("SOCIAL_VISION_MAX_FRAMES", "8"))
    social_step_max_frames: int = int(os.environ.get("SOCIAL_STEP_MAX_FRAMES", "24"))
    social_vision_provider: str = (
        os.environ.get("SOCIAL_VISION_PROVIDER") or "auto"
    ).strip().lower()
    gemini_api_key: str | None = (os.environ.get("GEMINI_API_KEY") or "").strip() or None
    gemini_vision_model: str = (
        os.environ.get("GEMINI_VISION_MODEL") or "gemini-3.5-flash"
    ).strip()
    feature_ai_enabled: bool = env_bool("FEATURE_AI_ENABLED", True)


settings = Settings()
