from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class CreateCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class UpdateCollectionRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class CollectionSummary(BaseModel):
    id: str
    name: str
    recipe_count: int
    created_at: str
    contains_recipe: Optional[bool] = None


class CollectionListResponse(BaseModel):
    items: list[CollectionSummary]
    total: int


class CollectionRecipeSummary(BaseModel):
    id: str
    title: str
    step_count: int
    used_ai: bool
    created_at: str


class CollectionDetailResponse(BaseModel):
    id: str
    name: str
    created_at: str
    recipes: list[CollectionRecipeSummary]


class RecipeCollectionTag(BaseModel):
    id: str
    name: str
