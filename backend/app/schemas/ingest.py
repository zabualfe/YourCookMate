from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.recipe import ParsedRecipe


class IngestLinkRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2048)
    caption: Optional[str] = Field(default=None, max_length=50000)
    force: bool = False


class IngestLookupRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2048)


class LinkPreviewRequest(BaseModel):
    url: str = Field(min_length=10, max_length=2048)


class IngestLinkResponse(BaseModel):
    raw_text: str
    source_type: str
    source_url: str
    title: Optional[str] = None
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_duration: Optional[float] = None
    extraction_notes: list[str] = Field(default_factory=list)
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    from_cache: bool = False
    existing_recipe_id: Optional[str] = None
    used_ai: Optional[bool] = None
    recipe: Optional[ParsedRecipe] = None
    found: bool = False


class LinkPreviewResponse(BaseModel):
    valid: bool
    source_type: str
    source_url: str
    title: Optional[str] = None
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    video_duration: Optional[float] = None
    message: Optional[str] = None
