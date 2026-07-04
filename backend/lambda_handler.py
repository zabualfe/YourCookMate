from __future__ import annotations

import os

from mangum import Mangum

from app.database import init_db
from app.main import app

_initialized = False


def _ensure_initialized() -> None:
    global _initialized
    if _initialized:
        return
    init_db()
    _initialized = True


_asgi = Mangum(app, lifespan="off")


def handler(event, context):
    _ensure_initialized()
    return _asgi(event, context)
