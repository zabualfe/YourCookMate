from __future__ import annotations

import os

from mangum import Mangum

from app.config import settings
from app.database import init_db
from app.main import app

_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    init_db()
    _initialized = True


def _apply_request_base_url(event: dict) -> None:
    """Set API_BASE_URL from API Gateway Host when ApiBaseUrl param was not provided."""
    if settings.api_base_url and settings.api_base_url != "http://127.0.0.1:8000":
        return
    raw_headers = event.get("headers") or {}
    headers = {str(k).lower(): str(v) for k, v in raw_headers.items()}
    host = headers.get("host")
    if host:
        settings.api_base_url = f"https://{host}"


_stage = os.environ.get("STAGE", "prod").strip("/")
_asgi = Mangum(
    app,
    lifespan="off",
    api_gateway_base_path=f"/{_stage}" if _stage else None,
)


def handler(event, context):
    _ensure_initialized()
    _apply_request_base_url(event)
    return _asgi(event, context)
