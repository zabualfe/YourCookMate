from __future__ import annotations

import json
import shutil
import uuid
from pathlib import Path
from typing import Callable, Optional
from uuid import UUID

from app.config import settings
from app.schemas.recipe import ParsedRecipe, RecipeStep
from app.services.recipe_icons import media_public_url, uploads_root
from app.services.video_cache import (
    ensure_video_cached,
    get_cached_duration,
    get_cached_frame_times,
    get_cached_frames,
    get_cached_video,
)
from app.services.video_frames import (
    clip_range_around,
    extract_video_clip,
    probe_video_duration,
    save_frame_copy,
)
from app.services.transcript_format import format_mmss


def timestamps_enabled() -> bool:
    from app.services.ai_parser import timestamps_enabled as _enabled

    return _enabled()

MATCH_PROMPT = """You are matching screenshots from a cooking video to recipe steps.
Images are sent in chronological order. Each frame is labeled with its EXACT seek time in the video.

Recipe steps:
{steps_text}

For each step, pick the frame that best shows when that action BEGINS (the moment the cook starts doing it), not after it is finished.

Return ONLY valid JSON:
{{"matches": [{{"step": 1, "frame": 2}}]}}

Every step must appear exactly once. Frame numbers are 1-indexed. Prefer later frames only when earlier ones clearly show a different earlier step."""


def enrich_recipe_step_urls(recipe: ParsedRecipe) -> ParsedRecipe:
    """Re-export for callers that already import from step_images (parse/create flows)."""
    from app.services.recipe_icons import enrich_recipe_step_urls as _enrich

    return _enrich(recipe)


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


def _nearest_frame_index(target: float, frame_times: list[float]) -> int:
    if not frame_times:
        return 0
    best = 0
    best_dist = abs(frame_times[0] - target)
    for i, t in enumerate(frame_times):
        dist = abs(t - target)
        if dist < best_dist:
            best = i
            best_dist = dist
    return best


def _indices_from_parser_times(
    steps: list[RecipeStep],
    frame_times: list[float],
) -> Optional[list[int]]:
    """Snap steps that already have video_start_seconds onto nearest real frames."""
    if not frame_times or not steps:
        return None
    known = [s for s in steps if s.video_start_seconds is not None]
    if len(known) < max(1, len(steps) // 2):
        return None
    indices: list[int] = []
    prev = 0
    for step in steps:
        if step.video_start_seconds is not None:
            idx = _nearest_frame_index(float(step.video_start_seconds), frame_times)
        else:
            idx = prev
        idx = max(prev, idx)  # keep chronological
        indices.append(idx)
        prev = idx
    return indices


def _frame_label(index: int, frame_times: Optional[list[float]]) -> str:
    if frame_times and 0 <= index < len(frame_times):
        t = frame_times[index]
        return f"Frame {index + 1} (EXACT time {format_mmss(t)} / {t:.1f}s)"
    return f"Frame {index + 1}"


def _match_frames_with_vision(
    frames: list[Path],
    steps: list[RecipeStep],
    frame_times: Optional[list[float]] = None,
) -> Optional[list[int]]:
    from app.services.llm import extract_json_object, resolve_ai_provider

    if not frames or not steps:
        return None
    provider = resolve_ai_provider()
    if provider is None:
        return None

    steps_text = "\n".join(
        (
            f"{step.order}. {step.instruction}"
            + (
                f" (hint ~{format_mmss(float(step.video_start_seconds))})"
                if step.video_start_seconds is not None
                else ""
            )
        )
        for step in steps
    )
    prompt = MATCH_PROMPT.format(steps_text=steps_text)

    try:
        if provider == "bedrock":
            import boto3

            content: list[dict] = [{"text": prompt + "\nRespond with JSON only."}]
            for index, frame in enumerate(frames):
                content.append({"text": _frame_label(index, frame_times)})
                content.append(
                    {
                        "image": {
                            "format": "jpeg",
                            "source": {"bytes": frame.read_bytes()},
                        }
                    }
                )
            client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
            response = client.converse(
                modelId=settings.bedrock_vision_model,
                messages=[{"role": "user", "content": content}],
                inferenceConfig={"maxTokens": 800, "temperature": 0},
            )
            text_parts: list[str] = []
            for block in response.get("output", {}).get("message", {}).get("content", []):
                if isinstance(block, dict) and block.get("text"):
                    text_parts.append(str(block["text"]))
            raw = "\n".join(text_parts).strip()
            if not raw:
                return None
            payload = extract_json_object(raw)
        else:
            import base64

            from openai import OpenAI

            if not settings.openai_api_key:
                return None
            content_oa: list[dict] = [{"type": "text", "text": prompt}]
            for index, frame in enumerate(frames):
                content_oa.append({"type": "text", "text": _frame_label(index, frame_times)})
                encoded = base64.b64encode(frame.read_bytes()).decode("ascii")
                content_oa.append(
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{encoded}",
                            "detail": "high",
                        },
                    }
                )
            client = OpenAI(api_key=settings.openai_api_key)
            response = client.chat.completions.create(
                model=settings.openai_vision_model,
                response_format={"type": "json_object"},
                messages=[{"role": "user", "content": content_oa}],
                temperature=0,
                max_tokens=800,
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
            # Enforce non-decreasing frame order so timeline stays chronological.
            prev = 0
            ordered: list[int] = []
            for idx in indices:
                idx = max(prev, idx)
                ordered.append(idx)
                prev = idx
            return ordered
    except Exception:
        return None
    return None


def attach_step_images_from_frames(
    recipe: ParsedRecipe,
    frames: list[Path],
    storage_dir: str,
    frame_times: Optional[list[float]] = None,
) -> tuple[ParsedRecipe, list[str]]:
    notes: list[str] = []
    step_count = len(recipe.steps)
    if step_count == 0 or not frames:
        return recipe, notes

    dest_root = uploads_root() / storage_dir
    dest_root.mkdir(parents=True, exist_ok=True)

    indices = _match_frames_with_vision(frames, recipe.steps, frame_times)
    if indices is None:
        indices = _indices_from_parser_times(recipe.steps, frame_times or [])
    if indices is None:
        indices = _temporal_frame_indices(len(frames), step_count)
        notes.append("Matched step images by timing in the video.")
    else:
        notes.append("Matched step images to cooking steps with AI.")

    keep_times = timestamps_enabled()
    for step, frame_idx in zip(recipe.steps, indices):
        frame = frames[frame_idx]
        rel = f"{storage_dir}/{step.order:02d}.jpg"
        save_frame_copy(frame, uploads_root() / rel)
        step.image_url = rel
        # Only fill missing times — do not overwrite parser/vision timestamps.
        if (
            keep_times
            and step.video_start_seconds is None
            and frame_times
            and 0 <= frame_idx < len(frame_times)
        ):
            step.video_start_seconds = round(float(frame_times[frame_idx]), 2)

    notes.append(f"Saved reference images for {step_count} steps (from cached video).")
    return recipe, notes


def attach_step_media_from_cache(
    recipe: ParsedRecipe,
    frames: list[Path],
    video_path: Path,
    duration: float,
    storage_dir: str,
    frame_times: Optional[list[float]] = None,
) -> tuple[ParsedRecipe, list[str]]:
    notes: list[str] = []
    step_count = len(recipe.steps)
    if step_count == 0 or not frames:
        return recipe, notes

    if not frame_times or len(frame_times) != len(frames):
        from app.services.video_frames import sample_times_across_duration

        frame_times = sample_times_across_duration(duration, len(frames))

    dest_root = uploads_root() / storage_dir
    dest_root.mkdir(parents=True, exist_ok=True)

    matched = _match_frames_with_vision(frames, recipe.steps, frame_times)
    if matched is not None:
        indices = matched
        notes.append("Matched step clips to cooking steps with AI (dense frame PTS).")
    else:
        snapped = _indices_from_parser_times(recipe.steps, frame_times)
        if snapped is not None:
            indices = snapped
            notes.append("Anchored step media to nearest dense frames from parser timestamps.")
        else:
            indices = _temporal_frame_indices(len(frames), step_count)
            notes.append("Matched step clips by sampling dense frame PTS.")

    clip_len = settings.step_clip_seconds
    clip_count = 0
    keep_times = timestamps_enabled()
    # Preserve parser/vision timestamps when present — only fill gaps from matched frames.
    had_parser_times = sum(1 for s in recipe.steps if s.video_start_seconds is not None)

    for step, frame_idx in zip(recipe.steps, indices):
        frame = frames[frame_idx]
        image_rel = f"{storage_dir}/{step.order:02d}.jpg"
        save_frame_copy(frame, uploads_root() / image_rel)
        step.image_url = image_rel

        action_at = float(frame_times[frame_idx])
        if step.video_start_seconds is not None:
            # Keep parser time; use matched frame only for the visual clip center.
            action_at = float(step.video_start_seconds)
        elif keep_times:
            step.video_start_seconds = round(action_at, 2)

        clip_start, clip_duration = clip_range_around(action_at, duration, clip_len)
        if keep_times and step.video_end_seconds is None:
            step.video_end_seconds = round(min(duration, action_at + clip_duration), 2)

        clip_rel = f"{storage_dir}/{step.order:02d}.mp4"
        clip_path = uploads_root() / clip_rel
        if extract_video_clip(video_path, clip_path, clip_start, clip_duration):
            step.clip_url = clip_rel
            clip_count += 1

    if keep_times:
        # Contiguous ends: each step ends when the next begins.
        for i, step in enumerate(recipe.steps):
            if i + 1 < len(recipe.steps):
                nxt = recipe.steps[i + 1].video_start_seconds
                if nxt is not None:
                    step.video_end_seconds = float(nxt)
            elif duration:
                step.video_end_seconds = round(float(duration), 2)

        if had_parser_times:
            notes.append(
                "Kept parser/vision step timestamps; matched frames only for posters/clips."
            )

    # Fill ingredient appears_at from step timeline after media matching.
    from app.services.ai_parser import _fill_ingredient_timestamps, _normalize_ingredients_used

    _normalize_ingredients_used(recipe)
    if keep_times:
        _fill_ingredient_timestamps(recipe)
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
    ytdlp_options: Callable[..., dict] | None = None,
) -> tuple[ParsedRecipe, list[str]]:
    """Pick reference frames and short clips per step, reusing cached video when available."""
    if ytdlp_options is None:
        from app.services.social_ingest import _ytdlp_options

        ytdlp_options = _ytdlp_options
    cached_frames = get_cached_frames(source_url)
    video_path = get_cached_video(source_url)
    video_duration = _resolve_video_duration(source_url, video_path, duration)
    frame_times = get_cached_frame_times(source_url) if cached_frames else []

    if cached_frames and video_path and video_duration:
        return attach_step_media_from_cache(
            recipe,
            cached_frames,
            video_path,
            video_duration,
            storage_dir,
            frame_times=frame_times,
        )

    if cached_frames:
        return attach_step_images_from_frames(
            recipe,
            cached_frames,
            storage_dir,
            frame_times=frame_times,
        )

    notes: list[str] = []
    step_count = len(recipe.steps)
    if step_count == 0:
        return recipe, notes

    ensure_video_cached(
        source_url,
        ytdlp_options,
        duration=duration,
        frame_count=None,  # dense scene-aware count from settings / duration
    )
    cached_frames = get_cached_frames(source_url)
    video_path = get_cached_video(source_url)
    video_duration = _resolve_video_duration(source_url, video_path, duration)
    frame_times = get_cached_frame_times(source_url) if cached_frames else []

    if cached_frames and video_path and video_duration:
        return attach_step_media_from_cache(
            recipe,
            cached_frames,
            video_path,
            video_duration,
            storage_dir,
            frame_times=frame_times,
        )

    if cached_frames:
        return attach_step_images_from_frames(
            recipe,
            cached_frames,
            storage_dir,
            frame_times=frame_times,
        )

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
