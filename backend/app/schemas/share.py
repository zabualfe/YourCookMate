from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.recipe import ParsedRecipe


class ShareRequest(BaseModel):
    enabled: bool = True


class ShareResponse(BaseModel):
    is_public: bool
    shared_to_community: bool = False
    share_slug: Optional[str] = None
    share_url: Optional[str] = None


class SharedRecipeResponse(BaseModel):
    slug: str
    title: str
    recipe: ParsedRecipe
    author_name: str
    author_username: Optional[str] = None
    author_avatar_url: Optional[str] = None
    is_following: bool = False
    is_self: bool = False
    step_count: int
    used_ai: bool
    source_type: str = "text"
    source_url: Optional[str] = None
    icon_url: Optional[str] = None
    locked: bool = False
    visible_until: Optional[str] = None


class CommunityRecipeSummary(BaseModel):
    slug: str
    title: str
    author_name: str
    author_username: Optional[str] = None
    author_avatar_url: Optional[str] = None
    step_count: int
    used_ai: bool
    created_at: str
    icon_url: Optional[str] = None
    id: Optional[str] = None
    pinned_rank: Optional[int] = None


class CommunityRecipeListResponse(BaseModel):
    items: list[CommunityRecipeSummary]
    total: int
