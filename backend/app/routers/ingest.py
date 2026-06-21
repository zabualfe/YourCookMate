from __future__ import annotations

from fastapi import APIRouter

from app.schemas.ingest import IngestLinkRequest, IngestLinkResponse
from app.services.social_ingest import ingest_social_link

router = APIRouter(prefix="/ingest", tags=["ingest"])


@router.post("/link", response_model=IngestLinkResponse)
def ingest_link(body: IngestLinkRequest) -> IngestLinkResponse:
    result = ingest_social_link(body.url, body.caption)
    return IngestLinkResponse(**result)
