from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.recipe import ParsedRecipe


class ShareRequest(BaseModel):
    enabled: bool = True


class ShareResponse(BaseModel):
    is_public: bool
    share_slug: Optional[str] = None
    share_url: Optional[str] = None


class SharedRecipeResponse(BaseModel):
    slug: str
    title: str
    recipe: ParsedRecipe
    author_name: str
    step_count: int
    used_ai: bool
    source_type: str = "text"
    source_url: Optional[str] = None
    icon_url: Optional[str] = None


class CommunityRecipeSummary(BaseModel):
    slug: str
    title: str
    author_name: str
    step_count: int
    used_ai: bool
    created_at: str
    icon_url: Optional[str] = None


class CommunityRecipeListResponse(BaseModel):
    items: list[CommunityRecipeSummary]
    total: int
