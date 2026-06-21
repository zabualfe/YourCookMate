from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path
from typing import Callable, Optional
from uuid import UUID

from openai import OpenAI

from app.config import settings
from app.schemas.recipe import ParsedRecipe, RecipeStep
from app.services.recipe_icons import uploads_root
from app.services.social_ingest import _ytdlp_options
from app.services.video_cache import (
    ensure_video_cached,
    get_cached_duration,
    get_cached_frames,
    get_cached_video,
)
from app.services.video_frames import extract_video_clip, frame_index_to_clip_range, probe_video_duration, save_frame_copy

MATCH_PROMPT = """You are matching screenshots from a cooking video to recipe steps.
Images are sent in chronological order as Frame 1, Frame 2, etc.

Recipe steps:
{steps_text}

For each step, pick the frame that best shows how the food should look when that step is COMPLETE.

Return ONLY valid JSON:
{{"matches": [{{"step": 1, "frame": 2}}]}}

Every step must appear exactly once. Frame numbers are 1-indexed."""


def public_upload_url(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    if relative_path.startswith("/uploads/"):
        return relative_path
    return f"/uploads/{relative_path.lstrip('/')}"


def enrich_recipe_step_urls(recipe: ParsedRecipe) -> ParsedRecipe:
    for step in recipe.steps:
        if step.image_url:
            step.image_url = public_upload_url(step.image_url)
        if step.clip_url:
            step.clip_url = public_upload_url(step.clip_url)
    return recipe


def _temporal_frame_indices(frame_count: int, step_count: int) -> list[int]:
    if frame_count <= 0 or step_count <= 0:
        return []
    if frame_count == 1:
        return [0] * step_count
    indices: list[int] = []
    for i in range(step_count):
        position = (i + 1) / step_count
        idx = min(frame_count - 1, max(0, int(position * frame_count) - 1))
        indices.append(idx)
    return indices


def _match_frames_with_vision(frames: list[Path], steps: list[RecipeStep]) -> Optional[list[int]]:
    if not settings.openai_api_key or not frames or not steps:
        return None

    steps_text = "\n".join(f"{step.order}. {step.instruction}" for step in steps)
    content: list[dict] = [
        {"type": "text", "text": MATCH_PROMPT.format(steps_text=steps_text)},
    ]

    for index, frame in enumerate(frames, start=1):
        content.append({"type": "text", "text": f"Frame {index}"})
        data = frame.read_bytes()
        import base64

        encoded = base64.b64encode(data).decode("ascii")
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": f"data:image/jpeg;base64,{encoded}", "detail": "low"},
            }
        )

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_vision_model,
            response_format={"type": "json_object"},
            messages=[{"role": "user", "content": content}],
            temperature=0.1,
            max_tokens=600,
        )
        raw = response.choices[0].message.content
        if not raw:
            return None
        payload = json.loads(raw)
        matches = payload.get("matches") or []
        by_step: dict[int, int] = {}
        for item in matches:
            step_num = int(item.get("step", 0))
            frame_num = int(item.get("frame", 1))
            if step_num > 0:
                by_step[step_num] = max(0, min(len(frames) - 1, frame_num - 1))

        indices: list[int] = []
        for step in steps:
            indices.append(by_step.get(step.order, 0))
        if len(indices) == len(steps):
            return indices
    except Exception:
        return None
    return None


def attach_step_images_from_frames(
    recipe: ParsedRecipe,
    frames: list[Path],
    storage_dir: str,
) -> tuple[ParsedRecipe, list[str]]:
    notes: list[str] = []
    step_count = len(recipe.steps)
    if step_count == 0 or not frames:
        return recipe, notes

    dest_root = uploads_root() / storage_dir
    dest_root.mkdir(parents=True, exist_ok=True)

    indices = _match_frames_with_vision(frames, recipe.steps)
    if indices is None:
        indices = _temporal_frame_indices(len(frames), step_count)
        notes.append("Matched step images by timing in the video.")
    else:
        notes.append("Matched step images to cooking steps with AI.")

    for step, frame_idx in zip(recipe.steps, indices):
        frame = frames[frame_idx]
        rel = f"{storage_dir}/{step.order:02d}.jpg"
        save_frame_copy(frame, uploads_root() / rel)
        step.image_url = rel

    notes.append(f"Saved reference images for {step_count} steps (from cached video).")
    return recipe, notes


def attach_step_media_from_cache(
    recipe: ParsedRecipe,
    frames: list[Path],
    video_path: Path,
    duration: float,
    storage_dir: str,
) -> tuple[ParsedRecipe, list[str]]:
    notes: list[str] = []
    step_count = len(recipe.steps)
    if step_count == 0 or not frames:
        return recipe, notes

    dest_root = uploads_root() / storage_dir
    dest_root.mkdir(parents=True, exist_ok=True)

    indices = _match_frames_with_vision(frames, recipe.steps)
    if indices is None:
        indices = _temporal_frame_indices(len(frames), step_count)
        notes.append("Matched step clips by timing in the video.")
    else:
        notes.append("Matched step clips to cooking steps with AI.")

    clip_len = settings.step_clip_seconds
    clip_count = 0

    for step, frame_idx in zip(recipe.steps, indices):
        frame = frames[frame_idx]
        image_rel = f"{storage_dir}/{step.order:02d}.jpg"
        save_frame_copy(frame, uploads_root() / image_rel)
        step.image_url = image_rel

        start, clip_duration = frame_index_to_clip_range(
            frame_idx,
            len(frames),
            duration,
            clip_len,
        )
        clip_rel = f"{storage_dir}/{step.order:02d}.mp4"
        clip_path = uploads_root() / clip_rel
        if extract_video_clip(video_path, clip_path, start, clip_duration):
            step.clip_url = clip_rel
            clip_count += 1

    if clip_count:
        notes.append(f"Saved {clip_count} short step clips (from cached video).")
    else:
        notes.append("Saved step poster images; clip extraction failed.")
    return recipe, notes


def _resolve_video_duration(
    source_url: str,
    video_path: Optional[Path],
    duration: Optional[float],
) -> Optional[float]:
    if duration and duration > 0:
        return duration
    cached = get_cached_duration(source_url)
    if cached and cached > 0:
        return cached
    if video_path:
        return probe_video_duration(video_path)
    return None


def attach_step_images(
    recipe: ParsedRecipe,
    source_url: str,
    *,
    storage_dir: str,
    duration: Optional[float] = None,
    ytdlp_options: Callable[..., dict] = _ytdlp_options,
) -> tuple[ParsedRecipe, list[str]]:
    """Pick reference frames and short clips per step, reusing cached video when available."""
    cached_frames = get_cached_frames(source_url)
    video_path = get_cached_video(source_url)
    video_duration = _resolve_video_duration(source_url, video_path, duration)

    if cached_frames and video_path and video_duration:
        return attach_step_media_from_cache(
            recipe,
            cached_frames,
            video_path,
            video_duration,
            storage_dir,
        )

    if cached_frames:
        return attach_step_images_from_frames(recipe, cached_frames, storage_dir)

    notes: list[str] = []
    step_count = len(recipe.steps)
    if step_count == 0:
        return recipe, notes

    ensure_video_cached(
        source_url,
        ytdlp_options,
        duration=duration,
        frame_count=min(max(step_count * 2, step_count), settings.social_step_max_frames),
    )
    cached_frames = get_cached_frames(source_url)
    video_path = get_cached_video(source_url)
    video_duration = _resolve_video_duration(source_url, video_path, duration)

    if cached_frames and video_path and video_duration:
        return attach_step_media_from_cache(
            recipe,
            cached_frames,
            video_path,
            video_duration,
            storage_dir,
        )

    if cached_frames:
        return attach_step_images_from_frames(recipe, cached_frames, storage_dir)

    notes.append("Could not load cached video for step reference media.")
    return recipe, notes


def create_pending_step_images(
    recipe: ParsedRecipe,
    source_url: str,
    duration: Optional[float] = None,
) -> tuple[ParsedRecipe, str, list[str]]:
    pending_id = str(uuid.uuid4())
    storage_dir = f"pending/{pending_id}"
    recipe, notes = attach_step_images(
        recipe,
        source_url,
        storage_dir=storage_dir,
        duration=duration,
    )
    return recipe, pending_id, notes


def _normalize_step_media_path(url: Optional[str]) -> Optional[str]:
    if url and url.startswith("/uploads/"):
        return url.removeprefix("/uploads/").lstrip("/")
    return url


def normalize_step_image_paths(recipe: ParsedRecipe) -> ParsedRecipe:
    for step in recipe.steps:
        step.image_url = _normalize_step_media_path(step.image_url)
        step.clip_url = _normalize_step_media_path(step.clip_url)
    return recipe


def _copy_step_media_file(
    root: Path,
    rel: str,
    target_recipe_id: UUID,
    step_order: int,
    ext: str,
) -> Optional[str]:
    src = root / rel
    if not src.is_file():
        return None
    dest_rel = f"recipes/{target_recipe_id}/steps/{step_order:02d}{ext}"
    dest = root / dest_rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(src, dest)
    return dest_rel


def copy_step_images(source_recipe_id: UUID, target_recipe_id: UUID, recipe: ParsedRecipe) -> ParsedRecipe:
    root = uploads_root()
    for step in recipe.steps:
        for attr, ext in (("image_url", ".jpg"), ("clip_url", ".mp4")):
            url = getattr(step, attr)
            if not url:
                continue
            rel = url.removeprefix("/uploads/").lstrip("/")
            dest_rel = _copy_step_media_file(root, rel, target_recipe_id, step.order, ext)
            setattr(step, attr, dest_rel)
    return recipe


def finalize_step_images(recipe_id: UUID, recipe: ParsedRecipe) -> ParsedRecipe:
    root = uploads_root()
    dest_dir = root / "recipes" / str(recipe_id) / "steps"
    dest_dir.mkdir(parents=True, exist_ok=True)

    for step in recipe.steps:
        for attr, ext in (("image_url", ".jpg"), ("clip_url", ".mp4")):
            url = getattr(step, attr)
            if not url:
                continue
            rel = url.removeprefix("/uploads/").lstrip("/")
            src = root / rel
            if not src.is_file():
                setattr(step, attr, None)
                continue
            dest_rel = f"recipes/{recipe_id}/steps/{step.order:02d}{ext}"
            dest = root / dest_rel
            shutil.move(str(src), str(dest))
            setattr(step, attr, dest_rel)

    pending_root = root / "pending"
    if pending_root.is_dir():
        for folder in pending_root.iterdir():
            if folder.is_dir() and not any(folder.iterdir()):
                folder.rmdir()

    return recipe
