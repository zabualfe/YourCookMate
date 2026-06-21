from __future__ import annotations

from uuid import UUID

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, require_verified_email
from app.models.recipe import Recipe
from app.models.user import User
from app.schemas.recipe import ParseRecipeRequest, ParseRecipeResponse, ParsedRecipe
from app.schemas.recipe_store import (
    CreateRecipeRequest,
    RecipeDetailResponse,
    RecipeListResponse,
    RecipeSummary,
    UpdateRecipeRequest,
)
from app.schemas.share import ShareRequest, ShareResponse
from app.schemas.shop import InstacartLinkResponse
from app.services.ai_parser import parse_recipe
from app.services.collections import collections_for_recipe, collections_for_recipe_ids
from app.services.instacart import clear_instacart_cache, get_or_create_instacart_link
from app.services.recipe_icons import delete_icon_file, icon_public_url, save_recipe_icon
from app.services.share import generate_share_slug
from app.services.step_images import (
    copy_step_images,
    create_pending_step_images,
    enrich_recipe_step_urls,
    finalize_step_images,
    normalize_step_image_paths,
)
from app.services.video_cache import get_cached_frames

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _share_url(slug: str | None) -> str | None:
    if not slug:
        return None
    return f"{settings.frontend_url.rstrip('/')}/r/{slug}"


def _recipe_to_detail(row: Recipe, db: Session) -> RecipeDetailResponse:
    parsed = ParsedRecipe.model_validate(row.parsed_json)
    parsed = enrich_recipe_step_urls(parsed)
    return RecipeDetailResponse(
        id=str(row.id),
        title=row.title,
        raw_text=row.raw_text,
        source_type=row.source_type,
        source_url=row.source_url,
        used_ai=row.used_ai,
        recipe=parsed,
        created_at=row.created_at.isoformat(),
        is_public=row.is_public,
        share_slug=row.share_slug,
        share_url=_share_url(row.share_slug) if row.is_public else None,
        collections=collections_for_recipe(db, row.id),
        icon_url=icon_public_url(row.icon_path),
    )


@router.post("/parse", response_model=ParseRecipeResponse)
def parse_recipe_endpoint(body: ParseRecipeRequest) -> ParseRecipeResponse:
    try:
        recipe, used_ai = parse_recipe(body.raw_text)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Failed to parse recipe: {exc}") from exc

    if not recipe.steps:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "Could not extract cooking steps from this text. "
                "TikTok and Instagram often put the recipe in the caption or spoken audio — "
                "edit the extracted text, paste the caption, or add steps manually on the review screen."
            ),
        )

    step_image_notes: list[str] = []
    if body.source_url:
        try:
            recipe, _pending_id, step_image_notes = create_pending_step_images(
                recipe,
                body.source_url,
                duration=body.video_duration,
            )
            if get_cached_frames(body.source_url):
                step_image_notes.insert(0, "Reused cached video from import — no re-download.")
            recipe = enrich_recipe_step_urls(recipe)
        except Exception:
            step_image_notes = ["Could not extract step reference images from the video."]

    return ParseRecipeResponse(recipe=recipe, used_ai=used_ai, step_image_notes=step_image_notes)


@router.post("", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    body: CreateRecipeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_email),
) -> RecipeDetailResponse:
    recipe = normalize_step_image_paths(body.recipe)
    row = Recipe(
        user_id=user.id,
        title=recipe.title,
        raw_text=body.raw_text,
        source_type=body.source_type,
        source_url=body.source_url,
        parsed_json=recipe.model_dump(),
        used_ai=body.used_ai,
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    stored = ParsedRecipe.model_validate(row.parsed_json)
    if any(step.image_url or step.clip_url for step in stored.steps):
        stored = finalize_step_images(row.id, stored)
        row.parsed_json = stored.model_dump()
        db.commit()
        db.refresh(row)

    return _recipe_to_detail(row, db)


@router.get("", response_model=RecipeListResponse)
def list_recipes(
    q: Optional[str] = Query(default=None, max_length=200),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecipeListResponse:
    query = db.query(Recipe).filter(Recipe.user_id == user.id)
    if q:
        query = query.filter(Recipe.title.ilike(f"%{q}%"))
    query = query.order_by(Recipe.created_at.desc())
    rows = query.all()
    recipe_ids = [r.id for r in rows]
    collection_map = collections_for_recipe_ids(db, recipe_ids)

    items = [
        RecipeSummary(
            id=str(r.id),
            title=r.title,
            step_count=len(r.parsed_json.get("steps", [])),
            used_ai=r.used_ai,
            created_at=r.created_at.isoformat(),
            collections=collection_map.get(r.id, []),
            icon_url=icon_public_url(r.icon_path),
        )
        for r in rows
    ]
    return RecipeListResponse(items=items, total=len(items))


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
def get_recipe(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecipeDetailResponse:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return _recipe_to_detail(row, db)


@router.get("/{recipe_id}/cook", response_model=RecipeDetailResponse)
def get_recipe_cook_mode(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecipeDetailResponse:
    return get_recipe(recipe_id, db, user)


@router.patch("/{recipe_id}", response_model=RecipeDetailResponse)
def update_recipe(
    recipe_id: UUID,
    body: UpdateRecipeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecipeDetailResponse:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    recipe = body.recipe
    if not recipe.title.strip():
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title is required")

    ingredients = [ing for ing in recipe.ingredients if ing.name.strip()]
    steps = [step for step in recipe.steps if step.instruction.strip()]
    if not steps:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="At least one step is required")

    for index, step in enumerate(steps, start=1):
        step.order = index

    recipe.ingredients = ingredients
    recipe.steps = steps
    recipe.title = recipe.title.strip()

    row.title = recipe.title
    row.parsed_json = recipe.model_dump()
    clear_instacart_cache(row)
    db.commit()
    db.refresh(row)
    return _recipe_to_detail(row, db)


def _get_owned_recipe(db: Session, user: User, recipe_id: UUID) -> Recipe:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    return row


@router.post("/{recipe_id}/icon", response_model=RecipeDetailResponse)
async def upload_recipe_icon(
    recipe_id: UUID,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecipeDetailResponse:
    row = _get_owned_recipe(db, user, recipe_id)
    delete_icon_file(row.icon_path)
    row.icon_path = await save_recipe_icon(recipe_id, file)
    db.commit()
    db.refresh(row)
    return _recipe_to_detail(row, db)


@router.delete("/{recipe_id}/icon", response_model=RecipeDetailResponse)
def delete_recipe_icon(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> RecipeDetailResponse:
    row = _get_owned_recipe(db, user, recipe_id)
    delete_icon_file(row.icon_path)
    row.icon_path = None
    db.commit()
    db.refresh(row)
    return _recipe_to_detail(row, db)


@router.post("/{recipe_id}/share", response_model=ShareResponse)
def update_recipe_share(
    recipe_id: UUID,
    body: ShareRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareResponse:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    if body.enabled:
        if not row.share_slug:
            row.share_slug = generate_share_slug(db)
        row.is_public = True
    else:
        row.is_public = False

    db.commit()
    db.refresh(row)
    return ShareResponse(
        is_public=row.is_public,
        share_slug=row.share_slug if row.is_public else None,
        share_url=_share_url(row.share_slug) if row.is_public else None,
    )


@router.post("/{recipe_id}/instacart-link", response_model=InstacartLinkResponse)
def create_instacart_link(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InstacartLinkResponse:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    recipe = ParsedRecipe.model_validate(row.parsed_json)
    partner_url = f"{settings.frontend_url.rstrip('/')}/recipes/{row.id}"
    url, cached = get_or_create_instacart_link(row, recipe, partner_linkback_url=partner_url)
    if not cached:
        db.commit()
    return InstacartLinkResponse(url=url, cached=cached)


@router.delete("/{recipe_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recipe(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")
    delete_icon_file(row.icon_path)
    db.delete(row)
    db.commit()
