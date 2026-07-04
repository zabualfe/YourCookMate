from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db
from app.schemas.features import FeaturesResponse
from app.services.feature_flags import build_features_response
from app.routers import admin, auth, collections, community, ingest, recipes, share
from app.services.recipe_icons import uploads_root


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    uploads_root()
    yield


def _allowed_cors_origins() -> list[str]:
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    frontend = settings.frontend_url.strip().rstrip("/")
    if frontend and frontend not in origins:
        origins.append(frontend)
    return origins


app = FastAPI(title="Your Cook Mate API", version="0.3.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(ingest.router)
app.include_router(recipes.router)
app.include_router(share.router)
app.include_router(community.router)
app.include_router(collections.router)

uploads_path = uploads_root()
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "smtp_configured": bool(settings.smtp_host and settings.smtp_pass),
        "smtp_from": settings.smtp_from,
    }


@app.get("/features", response_model=FeaturesResponse)
def features() -> FeaturesResponse:
    return build_features_response()
