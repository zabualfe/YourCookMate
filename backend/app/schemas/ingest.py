from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class IngestLinkRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2048)
    caption: Optional[str] = Field(default=None, max_length=50000)


class IngestLinkResponse(BaseModel):
    raw_text: str
    source_type: str
    source_url: str
    title: Optional[str] = None
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_duration: Optional[float] = None
    extraction_notes: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0.0, le=1.0)
