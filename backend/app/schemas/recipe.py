from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel, Field


class Ingredient(BaseModel):
    name: str
    quantity: str = ""
    group: str = "Main"


class RecipeStep(BaseModel):
    order: int
    instruction: str
    duration_minutes: Optional[int] = None
    ingredients_used: List[str] = Field(default_factory=list)
    equipment: List[str] = Field(default_factory=list)
    image_url: Optional[str] = None
    clip_url: Optional[str] = None


class ParsedRecipe(BaseModel):
    title: str
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    calories_per_serving: Optional[int] = None
    allergens: List[str] = Field(default_factory=list)
    ingredients: List[Ingredient]
    steps: List[RecipeStep]


class ParseRecipeRequest(BaseModel):
    raw_text: str = Field(min_length=10, max_length=50000)
    source_url: Optional[str] = Field(default=None, max_length=2048)
    video_duration: Optional[float] = Field(default=None, ge=0)


class ParseRecipeResponse(BaseModel):
    recipe: ParsedRecipe
    used_ai: bool
    step_image_notes: List[str] = Field(default_factory=list)
