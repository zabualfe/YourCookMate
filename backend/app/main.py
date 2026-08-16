from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.schemas.features import FeaturesResponse
from app.services.feature_flags import build_features_response
from app.routers import admin, auth, billing, collections, community, ingest, recipes, share
from app.services.recipe_icons import uploads_root

LAMBDA_MODE = bool(os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))


@asynccontextmanager
async def lifespan(app: FastAPI):
    if not LAMBDA_MODE:
        init_db()
        uploads_root()
    yield


def _allowed_cors_origins() -> list[str]:
    origins: list[str] = []
    seen: set[str] = set()

    def add(origin: str) -> None:
        cleaned = origin.strip().rstrip("/")
        if cleaned and cleaned not in seen:
            seen.add(cleaned)
            origins.append(cleaned)

    for part in settings.cors_origins.split(","):
        add(part)

    frontend = settings.frontend_url.strip().rstrip("/")
    add(frontend)

    # Apex ↔ www (e.g. yourcookmate.com and www.yourcookmate.com)
    if frontend.startswith("https://www."):
        add("https://" + frontend.removeprefix("https://www."))
    elif frontend.startswith("https://") and frontend.count(".") >= 1:
        host = frontend.removeprefix("https://")
        if not host.startswith("www."):
            add(f"https://www.{host}")

    return origins


app = FastAPI(title="Your Cook Mate API", version="0.4.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(billing.router)
app.include_router(ingest.lookup_router)
if not LAMBDA_MODE:
    app.include_router(ingest.router)
app.include_router(recipes.router)
app.include_router(share.router)
app.include_router(community.router)
app.include_router(collections.router)

if not LAMBDA_MODE and not settings.uploads_bucket:
    uploads_path = uploads_root()
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/health")
def health() -> dict:
    from app.services.email import _email_configured, email_transport

    return {
        "status": "ok",
        "email_configured": _email_configured(),
        "email_transport": email_transport(),
        "smtp_from": settings.smtp_from,
        "runtime": "lambda" if LAMBDA_MODE else "server",
    }


@app.get("/features", response_model=FeaturesResponse)
def features() -> FeaturesResponse:
    return build_features_response()
