from __future__ import annotations

import os


def env_bool(name: str, default: bool = True) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes"}


class Settings:
    ytdlp_cookies: str | None = os.environ.get("YTDLP_COOKIES") or None
    bedrock_vision_model: str = os.environ.get("BEDROCK_VISION_MODEL", "amazon.nova-lite-v1:0")
    aws_region: str = os.environ.get("AWS_REGION", "us-east-1")
    ingest_temp_bucket: str | None = os.environ.get("INGEST_TEMP_BUCKET") or None
    social_vision_max_frames: int = int(os.environ.get("SOCIAL_VISION_MAX_FRAMES", "8"))
    social_step_max_frames: int = int(os.environ.get("SOCIAL_STEP_MAX_FRAMES", "24"))
    feature_ai_enabled: bool = env_bool("FEATURE_AI_ENABLED", True)


settings = Settings()
