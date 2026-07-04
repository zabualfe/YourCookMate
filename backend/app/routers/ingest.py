from __future__ import annotations

from fastapi import APIRouter

from app.schemas.ingest import IngestLinkRequest, IngestLinkResponse, LinkPreviewRequest, LinkPreviewResponse
from app.services.feature_flags import require_social_ingest_enabled
from app.services.social_ingest import ingest_social_link, preview_social_link

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/link", response_model=IngestLinkResponse)
def ingest_link(body: IngestLinkRequest) -> IngestLinkResponse:
    require_social_ingest_enabled()
    result = ingest_social_link(body.url, body.caption)
    return IngestLinkResponse(**result)


@router.post("/preview", response_model=LinkPreviewResponse)
def preview_link(body: LinkPreviewRequest) -> LinkPreviewResponse:
    require_social_ingest_enabled()
    result = preview_social_link(body.url)
    return LinkPreviewResponse(**result)
