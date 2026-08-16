from __future__ import annotations

from uuid import UUID

from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user, get_optional_user, require_verified_email
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
from app.services.collections import collections_for_recipe, collections_for_recipe_ids
from app.services.feature_flags import require_community_enabled
from app.services.instacart import clear_instacart_cache, get_or_create_instacart_link
from app.services.recipe_icons import delete_icon_file, enrich_recipe_step_urls, icon_public_url, save_recipe_icon
from app.services.share import generate_share_slug
from app.services.billing import (
    assert_can_upload,
    assert_recipe_unlocked,
    assert_video_duration_allowed,
    counts_as_upload,
    record_upload,
    recipe_is_locked,
    recipe_visible_until,
)

router = APIRouter(prefix="/recipes", tags=["recipes"])


def _share_url(slug: str | None) -> str | None:
    if not slug:
        return None
    return f"{settings.frontend_url.rstrip('/')}/r/{slug}"


def _link_sharing_enabled(row: Recipe) -> bool:
    return bool(row.share_slug)


def _share_response(row: Recipe) -> ShareResponse:
    link_on = _link_sharing_enabled(row)
    return ShareResponse(
        # is_public means "unlisted link is active" for API/UI compatibility — not community listing.
        is_public=link_on,
        shared_to_community=row.shared_to_community,
        share_slug=row.share_slug if link_on else None,
        share_url=_share_url(row.share_slug) if link_on else None,
    )


def _visibility(row: Recipe, owner: User) -> tuple[bool, str | None]:
    locked = recipe_is_locked(owner, row)
    until = recipe_visible_until(owner, row)
    return locked, until.isoformat() if until else None


def _recipe_to_detail(row: Recipe, db: Session, owner: User | None = None) -> RecipeDetailResponse:
    owner = owner or row.user
    locked, visible_until = _visibility(row, owner)
    if locked:
        parsed = ParsedRecipe(title=row.title, ingredients=[], steps=[])
        raw_text = ""
    else:
        parsed = ParsedRecipe.model_validate(row.parsed_json)
        parsed = enrich_recipe_step_urls(parsed)
        raw_text = row.raw_text
    link_on = _link_sharing_enabled(row)
    return RecipeDetailResponse(
        id=str(row.id),
        title=row.title,
        raw_text=raw_text,
        source_type=row.source_type,
        source_url=row.source_url if not locked else None,
        used_ai=row.used_ai,
        recipe=parsed,
        created_at=row.created_at.isoformat(),
        is_public=link_on,
        shared_to_community=row.shared_to_community,
        share_slug=row.share_slug if link_on else None,
        share_url=_share_url(row.share_slug) if link_on else None,
        collections=collections_for_recipe(db, row.id),
        icon_url=icon_public_url(row.icon_path),
        locked=locked,
        visible_until=visible_until,
    )


@router.post("/parse", response_model=ParseRecipeResponse)
def parse_recipe_endpoint(
    body: ParseRecipeRequest,
    db: Session = Depends(get_db),
    user: Optional[User] = Depends(get_optional_user),
) -> ParseRecipeResponse:
    from app.services.ai_parser import parse_recipe
    from app.services.step_images import create_pending_step_images
    from app.services.recipe_icons import enrich_recipe_step_urls
    from app.services.video_cache import get_cached_frames
    from app.services.source_lookup import lookup_cached_source, persist_generated_source, remember_ingest_result

    if user is not None:
        assert_can_upload(db, user)
        assert_video_duration_allowed(user, body.video_duration)

    if body.source_url and not body.force:
        cached = lookup_cached_source(db, body.source_url)
        if cached and cached.parsed:
            from app.schemas.recipe import ParsedRecipe as StoredRecipe

            try:
                recipe = StoredRecipe.model_validate(cached.parsed)
            except Exception:
                recipe = None
            else:
                if recipe.steps:
                    return ParseRecipeResponse(
                        recipe=recipe,
                        used_ai=cached.used_ai,
                        step_image_notes=["Reused a previous parse of this video."],
                    )

    try:
        recipe, used_ai = parse_recipe(body.raw_text, video_duration=body.video_duration)
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

    if body.source_url:
        from app.services.source_key import all_source_lookup_keys, classify_host

        source_type = classify_host(body.source_url)
        extra_keys = all_source_lookup_keys(body.source_url, source_type)
        payload = remember_ingest_result(
            {
                "source_url": body.source_url,
                "source_type": source_type,
                "raw_text": body.raw_text,
                "title": recipe.title,
            },
            extra_keys=extra_keys,
            parsed=recipe.model_dump(),
        )
        if payload is not None:
            persist_generated_source(db, payload, extra_keys=extra_keys)
            db.commit()

    if body.force and user is not None:
        record_upload(db, user)
        db.commit()

    return ParseRecipeResponse(recipe=recipe, used_ai=used_ai, step_image_notes=step_image_notes)


@router.post("", response_model=RecipeDetailResponse, status_code=status.HTTP_201_CREATED)
def create_recipe(
    body: CreateRecipeRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_verified_email),
) -> RecipeDetailResponse:
    from app.services.step_images import finalize_step_images, normalize_step_image_paths
    from app.services.source_key import canonical_source_key
    from app.services.source_lookup import find_user_recipe_id

    counted = counts_as_upload(body.used_ai, body.source_type)
    if counted and not body.usage_already_recorded:
        assert_can_upload(db, user)

    if body.source_url and not body.allow_duplicate:
        existing_id = find_user_recipe_id(db, user.id, body.source_url, body.source_type)
        if existing_id:
            row = db.query(Recipe).filter(Recipe.id == existing_id, Recipe.user_id == user.id).first()
            if row is not None:
                return _recipe_to_detail(row, db, user)

    recipe = normalize_step_image_paths(body.recipe)
    row = Recipe(
        user_id=user.id,
        title=recipe.title,
        raw_text=body.raw_text,
        source_type=body.source_type,
        source_url=body.source_url,
        source_key=canonical_source_key(body.source_url, body.source_type) if body.source_url else None,
        parsed_json=recipe.model_dump(),
        used_ai=body.used_ai,
    )
    db.add(row)
    db.flush()
    if counted and not body.usage_already_recorded:
        record_upload(db, user, row)
    db.commit()
    db.refresh(row)

    stored = ParsedRecipe.model_validate(row.parsed_json)
    if any(step.image_url or step.clip_url for step in stored.steps):
        stored = finalize_step_images(row.id, stored)
        row.parsed_json = stored.model_dump()
        db.commit()
        db.refresh(row)

    return _recipe_to_detail(row, db, user)


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
            locked=recipe_is_locked(user, r),
            visible_until=(until.isoformat() if (until := recipe_visible_until(user, r)) else None),
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
    return _recipe_to_detail(row, db, user)


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

    assert_recipe_unlocked(user, row)

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
    return _recipe_to_detail(row, db, user)


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
    return _recipe_to_detail(row, db, user)


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
    return _recipe_to_detail(row, db, user)


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
        assert_recipe_unlocked(user, row)
        # Unlisted link — knowing the slug is enough to view. Does not list in Community.
        if not row.share_slug:
            row.share_slug = generate_share_slug(db)
        row.is_public = False
    else:
        # Invalidate the link; community cards would 404 without it.
        row.share_slug = None
        row.is_public = False
        row.shared_to_community = False

    db.commit()
    db.refresh(row)
    return _share_response(row)


@router.post("/{recipe_id}/community", response_model=ShareResponse)
def update_recipe_community(
    recipe_id: UUID,
    body: ShareRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> ShareResponse:
    require_community_enabled()
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    assert_recipe_unlocked(user, row)

    if body.enabled:
        # Community cards open /r/{slug}, so publishing mints an unlisted link if needed.
        if not row.share_slug:
            row.share_slug = generate_share_slug(db)
        row.shared_to_community = True
    else:
        row.shared_to_community = False

    db.commit()
    db.refresh(row)
    return _share_response(row)


@router.post("/{recipe_id}/instacart-link", response_model=InstacartLinkResponse)
def create_instacart_link(
    recipe_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InstacartLinkResponse:
    row = db.query(Recipe).filter(Recipe.id == recipe_id, Recipe.user_id == user.id).first()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Recipe not found")

    assert_recipe_unlocked(user, row)

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
