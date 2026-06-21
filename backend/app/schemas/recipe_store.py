from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.collection import RecipeCollectionTag
from app.schemas.recipe import ParsedRecipe


class CreateRecipeRequest(BaseModel):
    raw_text: str = Field(min_length=1)
    recipe: ParsedRecipe
    used_ai: bool = False
    source_type: str = "text"
    source_url: Optional[str] = None


class UpdateRecipeRequest(BaseModel):
    recipe: ParsedRecipe


class RecipeSummary(BaseModel):
    id: str
    title: str
    step_count: int
    used_ai: bool
    created_at: str
    collections: list[RecipeCollectionTag] = []
    icon_url: Optional[str] = None


class RecipeDetailResponse(BaseModel):
    id: str
    title: str
    raw_text: str
    source_type: str
    source_url: Optional[str] = None
    used_ai: bool
    recipe: ParsedRecipe
    created_at: str
    is_public: bool = False
    share_slug: Optional[str] = None
    share_url: Optional[str] = None
    collections: list[RecipeCollectionTag] = []
    icon_url: Optional[str] = None


class RecipeListResponse(BaseModel):
    items: list[RecipeSummary]
    total: int
