from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.ingest import (
    IngestLinkRequest,
    IngestLinkResponse,
    IngestLookupRequest,
    LinkPreviewRequest,
    LinkPreviewResponse,
)
from app.services.billing import assert_can_upload, assert_video_duration_allowed
from app.services.feature_flags import require_social_ingest_enabled
from app.services.source_key import classify_host, expand_source_url
from app.services.source_lookup import (
    cached_to_ingest_response,
    find_user_recipe_id,
    lookup_cached_source,
)

lookup_router = APIRouter(prefix="/ingest", tags=["ingest"])
router = APIRouter(prefix="/ingest", tags=["ingest"])


def _cached_ingest_payload(
    db: Session,
    user: User,
    url: str,
    *,
    force: bool,
) -> dict | None:
    if force:
        return None
    source_url = expand_source_url(url)
    source_type = classify_host(source_url)
    existing_id = find_user_recipe_id(
        db, user.id, url, source_type, expanded=source_url,
    )
    cached = lookup_cached_source(db, url, source_type, expanded=source_url)
    if not existing_id and not cached:
        return None
    if cached:
        payload = cached_to_ingest_response(
            cached,
            existing_recipe_id=str(existing_id) if existing_id else None,
        )
        payload["found"] = True
        if cached.video_duration:
            assert_video_duration_allowed(user, cached.video_duration)
        return payload

    row = db.query(Recipe).filter(Recipe.id == existing_id, Recipe.user_id == user.id).first()
    parsed = row.parsed_json if row is not None and isinstance(row.parsed_json, dict) else None
    return {
        "raw_text": (row.raw_text if row and row.raw_text else " "),
        "source_type": source_type,
        "source_url": (row.source_url if row and row.source_url else source_url),
        "title": row.title if row is not None else None,
        "author": None,
        "thumbnail_url": None,
        "video_duration": None,
        "extraction_notes": ["You already saved this video."],
        "confidence": 1.0,
        "from_cache": True,
        "existing_recipe_id": str(existing_id) if existing_id else None,
        "used_ai": row.used_ai if row is not None else None,
        "recipe": parsed,
        "found": True,
    }


@lookup_router.post("/lookup", response_model=IngestLinkResponse)
def lookup_link(
    body: IngestLookupRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IngestLinkResponse:
    require_social_ingest_enabled()
    payload = _cached_ingest_payload(db, user, body.url, force=False)
    if payload is None:
        source_url = expand_source_url(body.url)
        return IngestLinkResponse(
            raw_text="",
            source_type=classify_host(source_url),
            source_url=source_url,
            found=False,
            from_cache=False,
        )
    payload.pop("canonical_id", None)
    try:
        return IngestLinkResponse(**payload)
    except Exception:
        payload.pop("recipe", None)
        return IngestLinkResponse(**payload)


@router.post("/link", response_model=IngestLinkResponse)
def ingest_link(
    body: IngestLinkRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> IngestLinkResponse:
    from app.services.social_ingest import ingest_social_link

    require_social_ingest_enabled()

    payload = _cached_ingest_payload(db, user, body.url, force=body.force)
    if payload is not None:
        payload.pop("canonical_id", None)
        try:
            return IngestLinkResponse(**payload)
        except Exception:
            payload.pop("recipe", None)
            return IngestLinkResponse(**payload)

    assert_can_upload(db, user)
    result = ingest_social_link(body.url, body.caption)
    assert_video_duration_allowed(user, result.get("video_duration"))
    result.pop("canonical_id", None)
    result["from_cache"] = False
    result["found"] = False
    return IngestLinkResponse(**result)


@router.post("/preview", response_model=LinkPreviewResponse)
def preview_link(body: LinkPreviewRequest) -> LinkPreviewResponse:
    from app.services.social_ingest import preview_social_link

    require_social_ingest_enabled()
    result = preview_social_link(body.url)
    return LinkPreviewResponse(**result)
