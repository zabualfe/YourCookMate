from __future__ import annotations

import json
import re
from typing import List, Optional, Tuple

from app.config import settings
from app.schemas.recipe import Ingredient, ParsedRecipe, RecipeStep
from app.services.llm import chat_json, resolve_ai_provider
from app.services.transcript_format import is_suspiciously_even, parse_mmss, snap_to_nearest

INGREDIENTS_SYSTEM = """You are a professional cookbook editor extracting a mise en place list.

You will receive a creator CAPTION and/or VIDEO OBSERVATIONS from agents who watched the cooking video.

PRIORITY:
1. Fuse BOTH sources. Agents watched the frames — trust foods they saw being used, with their [m:ss] times.
2. Caption supplies dish identity, written quantities, and listed spices/powders (paprika, garlic powder, onion powder, bouillon, herbs, pepper, etc.). Missing a listed spice the cook uses is a failure.
3. If caption and video conflict on the DISH (wrong-track audio/visual), keep the caption's dish; still use video for timing of matching cooking actions.
4. Do not invent ingredients that appear in neither caption nor video observations.

Rules:
- Every distinct edible ingredient exactly once
- Keep seasoning powders separate when listed/seen separately
- Quantities from caption or on-screen text when available; "" if unknown — never invent precise amounts
- Group: Chicken, Sauce, Pasta, Garnish, Main, etc. when clear; else "Main"
- appears_at_seconds: from VIDEO OBSERVATIONS [m:ss] when the item is first seen/used
- No equipment as ingredients

Return ONLY valid JSON:
{
  "title": "string",
  "servings": number or null,
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "calories_per_serving": number or null,
  "allergens": ["string"],
  "ingredients": [{"name": "string", "quantity": "string", "group": "string", "appears_at_seconds": number or null}]
}

allergens: lowercase from dairy, eggs, fish, shellfish, tree nuts, peanuts, wheat, gluten, soy, sesame — only when present; else [].
calories_per_serving: integer estimate or null if too vague."""

STEPS_SYSTEM = """You are a professional cookbook editor writing method steps for a step-by-step cooking app.

You receive SOURCE TEXT (caption + VIDEO OBSERVATIONS from agents who WATCHED the frames) and a LOCKED ingredient list.
Do not add new ingredients; only use locked names in ingredients_used.

PRIORITY:
1. Cover the FULL cook from early prep through finish. Do not start mid-recipe.
2. DROP TikTok hooks/outros — twirling/eating finished pasta at the start is NOT step 1 when the caption starts with raw chicken / sauce prep.
3. Caption early prep is required even if video observations start later: slice/prep proteins, season with EACH locked chicken spice separately when the caption lists them, heat the pan, then sear.
4. Step actions/technique should also reflect what was WATCHED on screen after prep.
5. video_start_seconds / video_end_seconds from [m:ss] in VIDEO OBSERVATIONS (preferred). Early caption-only prep with no matching cue → null (do NOT invent evenly spaced times like 1, 3, 6, 9).
6. If caption and video conflict on the dish, keep caption dish identity.
7. Prefer FRAME CLOCK values when present — never invent times between labeled frames.

Write steps as if for a trusted cookbook:
- One clear action per step; split compound actions
- Seasoning: EACH locked spice/powder for chicken AND for sauce gets applied in a step (bouillon, garlic powder, paprika, onion powder, Italian herbs, pepper, etc.) — do not silently drop any
- Finish steps that must appear when in the locked list / caption / video: add cooked pasta to the sauce and toss/coat; melt cheese into the sauce; garnish (parsley). Never stop the method before pasta is combined.
- Imperative voice with technique, heat, timing, doneness when observed
- Cap ~2 sentences per step
- duration_minutes = cook/wait minutes for THAT step, not video clock time
- ingredients_used: EXACT locked names used in that step
- Every locked ingredient appears in at least one step's ingredients_used
- Contiguous timeline within video duration; short-form actions typically 2–12 seconds
- Do not invent wrong techniques (e.g. boiling chicken in pasta water) when the caption/video show searing in a pan with oil/butter

Return ONLY valid JSON:
{
  "steps": [{"order": 1, "instruction": "string", "duration_minutes": number or null, "ingredients_used": ["string"], "equipment": ["string"], "video_start_seconds": number or null, "video_end_seconds": number or null}]
}"""

REFINE_SYSTEM = """You are a meticulous cookbook proofreader. Compare the DRAFT recipe JSON to the SOURCE TEXT.

Fix only real problems:
- Missing EARLY prep from the caption (slice chicken, season with each listed spice, heat pan) when the draft jumps into mid-cook
- Missing FINISH steps: adding cooked pasta to the sauce, melting cheese, garnish — if caption/video include them
- Hook/outro steps that show finished plated food being eaten while the caption is a from-scratch cook — remove them
- Missing ingredients listed in the caption OR clearly seen in VIDEO OBSERVATIONS — especially spices/powders (onion powder, garlic powder, Italian herbs, etc.)
- Wrong/missing quantities when caption or on-screen text states them
- Steps that ignore watched technique/heat/timing from VIDEO OBSERVATIONS
- Wrong technique vs caption/video (e.g. boiling chicken when the cook sears it in a skillet)
- Combined actions that should be split based on what was watched
- Seasonings never used in any step — attach them as their own steps when possible
- ingredients_used that do not match locked names
- Timestamps that contradict VIDEO OBSERVATIONS [m:ss] cues (except early caption prep placed just before first sear)
- Remove ingredients that belong only to a conflicting wrong-dish audio track
- Do not invent flourishes neither watched nor captioned

Return the COMPLETE corrected recipe as ONLY valid JSON:
{
  "title": "string",
  "servings": number or null,
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "calories_per_serving": number or null,
  "allergens": ["string"],
  "ingredients": [{"name": "string", "quantity": "string", "group": "string", "appears_at_seconds": number or null}],
  "steps": [{"order": 1, "instruction": "string", "duration_minutes": number or null, "ingredients_used": ["string"], "equipment": ["string"], "video_start_seconds": number or null, "video_end_seconds": number or null}]
}"""

TIMELINE_ALIGN_SYSTEM = """You assign video timestamps to recipe steps using cues from agents who WATCHED the video.

You will receive:
- LOCKED steps (keep instruction text and order unless a timestamp-only tweak is needed)
- VIDEO OBSERVATIONS / spoken [m:ss] cues
- FRAME CLOCK — the only valid timestamps (snap every assignment to one of these)

Return ONLY JSON:
{
  "steps": [{"order": 1, "video_start_seconds": number or null, "video_end_seconds": number or null}]
}

Rules:
- Match each step to the best [m:ss] when that action BEGINS on screen
- Contiguous, non-decreasing starts; end of step i ≈ start of step i+1
- Stay within video duration when given
- Prefer watched action times over evenly spaced guesses
- If a step is caption-only prep with no matching cue, return null (do NOT invent 1,3,6,9…)
- video_start_seconds MUST be one of the FRAME CLOCK values (or null)"""

_HASHTAG_ONLY = re.compile(r"^(?:#\w+\s*)+$")
_MENTION_OR_TAG = re.compile(r"[@#]\w+")
_INGREDIENT_LINE = re.compile(
    r"^(?:you need|what you need|ingredients?|grocery list)\s*:?\s*(.+)$",
    re.I,
)
_STEP_PREFIX = re.compile(r"^(?:step\s*)?\d+[.)]\s*", re.I)
_BULLET = re.compile(r"^[-•*▪→]\s*")
_SPOKEN_HEADER = re.compile(r"^spoken instructions?\s*:?\s*$", re.I)
_PRIMARY_HEADER = re.compile(r"^PRIMARY RECIPE SOURCE\b.*$", re.I)
_VIDEO_TIMELINE_HEADER = re.compile(r"^VIDEO (?:TIMELINE|OBSERVATIONS)\b.*$", re.I)
_SPOKEN_SECTION_HEADER = re.compile(r"^Spoken instructions\b.*$", re.I)
_LEGACY_VISUAL_HEADER = re.compile(r"^From the video\b.*$", re.I)


def _preprocess_raw_text(raw_text: str) -> str:
    lines: list[str] = []
    in_spoken = False

    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            if in_spoken and lines and lines[-1] != "":
                lines.append("")
            continue

        if _SPOKEN_HEADER.match(stripped):
            in_spoken = True
            lines.append(stripped)
            continue

        if _HASHTAG_ONLY.match(stripped):
            continue
        if re.match(r"^original sound\b", stripped, re.I):
            continue

        cleaned = _MENTION_OR_TAG.sub("", stripped).strip()
        cleaned = re.sub(r"\s{2,}", " ", cleaned)
        if cleaned:
            lines.append(cleaned)

    return "\n".join(lines).strip()


def _split_ingredient_items(text: str) -> list[str]:
    parts = re.split(r",|\band\b", text, flags=re.I)
    return [p.strip(" .-") for p in parts if p.strip(" .-")]


def _sentence_steps(text: str) -> list[str]:
    chunks = re.split(r"(?<=[.!?])\s+|\n+", text)
    steps: list[str] = []
    for chunk in chunks:
        cleaned = chunk.strip(" .-")
        if len(cleaned) < 8:
            continue
        if _HASHTAG_ONLY.match(cleaned):
            continue
        steps.append(cleaned[0].upper() + cleaned[1:] if cleaned else cleaned)
    return steps


def _heuristic_parse(raw_text: str) -> ParsedRecipe:
    """Fallback parser when OpenAI is unavailable or returns empty output."""
    text = _preprocess_raw_text(raw_text)
    # Prefer the caption body when our merge headers are present.
    sections = _split_source_sections(text)
    if sections.get("caption"):
        text = sections["caption"]
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    # Skip our own section headers if they leaked in.
    while lines and (
        _PRIMARY_HEADER.match(lines[0])
        or _VIDEO_TIMELINE_HEADER.match(lines[0])
        or _SPOKEN_SECTION_HEADER.match(lines[0])
        or _LEGACY_VISUAL_HEADER.match(lines[0])
        or lines[0].lower().startswith("primary recipe source")
    ):
        lines = lines[1:]

    title = lines[0][:80] if lines else "Untitled Recipe"
    if title.lower().startswith("primary recipe") or title.lower().startswith("video observation"):
        title = "Untitled Recipe"

    ingredients: List[Ingredient] = []
    steps: List[RecipeStep] = []
    in_ingredients = False
    in_steps = False
    in_spoken = False
    step_order = 0
    spoken_buffer: list[str] = []

    for line in lines[1:]:
        lower = line.lower()

        if (
            _PRIMARY_HEADER.match(line)
            or _VIDEO_TIMELINE_HEADER.match(line)
            or _SPOKEN_SECTION_HEADER.match(line)
            or _LEGACY_VISUAL_HEADER.match(line)
        ):
            break

        if _SPOKEN_HEADER.match(line):
            in_spoken = True
            in_ingredients = False
            in_steps = False
            continue

        if in_spoken:
            spoken_buffer.append(line)
            continue

        if re.match(r"^(ingredients?|what you need|you need|grocery list)", lower):
            in_ingredients = True
            in_steps = False
            match = _INGREDIENT_LINE.match(line)
            if match:
                for item in _split_ingredient_items(match.group(1)):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
            continue

        if re.match(r"^(instructions?|directions?|method|steps?)\b", lower):
            in_ingredients = False
            in_steps = True
            continue

        if in_ingredients and not in_steps:
            cleaned = _BULLET.sub("", line)
            if cleaned:
                for item in _split_ingredient_items(cleaned):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
        elif in_steps:
            cleaned = _STEP_PREFIX.sub("", _BULLET.sub("", line))
            if cleaned:
                step_order += 1
                steps.append(
                    RecipeStep(
                        order=step_order,
                        instruction=cleaned,
                        duration_minutes=_extract_duration(cleaned),
                    )
                )
        else:
            need_match = _INGREDIENT_LINE.match(line)
            if need_match:
                for item in _split_ingredient_items(need_match.group(1)):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
                continue

            cleaned = _STEP_PREFIX.sub("", _BULLET.sub("", line))
            if cleaned and len(cleaned) > 10:
                step_order += 1
                steps.append(
                    RecipeStep(
                        order=step_order,
                        instruction=cleaned,
                        duration_minutes=_extract_duration(cleaned),
                    )
                )

    if spoken_buffer:
        spoken_text = " ".join(spoken_buffer)
        for i, chunk in enumerate(_sentence_steps(spoken_text), start=1):
            steps.append(
                RecipeStep(
                    order=len(steps) + 1,
                    instruction=chunk,
                    duration_minutes=_extract_duration(chunk),
                )
            )

    if not ingredients and not steps:
        chunks = [line for line in lines[1:] if len(line) > 12 and not _HASHTAG_ONLY.match(line)]
        for chunk in chunks[:12]:
            need_match = _INGREDIENT_LINE.match(chunk)
            if need_match:
                for item in _split_ingredient_items(need_match.group(1)):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
                continue
            step_order += 1
            steps.append(
                RecipeStep(
                    order=step_order,
                    instruction=chunk,
                    duration_minutes=_extract_duration(chunk),
                )
            )

    if not steps and text:
        for i, chunk in enumerate(_sentence_steps(text), start=1):
            steps.append(RecipeStep(order=i, instruction=chunk, duration_minutes=_extract_duration(chunk)))

    if not steps:
        steps = [
            RecipeStep(order=1, instruction="Review the full recipe text and cook as described."),
        ]

    return ParsedRecipe(
        title=title,
        ingredients=ingredients or [Ingredient(name="See recipe text", quantity="", group="Main")],
        steps=steps,
    )


def _normalize_nutrition(recipe: ParsedRecipe) -> ParsedRecipe:
    if recipe.calories_per_serving is not None and recipe.calories_per_serving <= 0:
        recipe.calories_per_serving = None
    recipe.allergens = sorted({a.strip().lower() for a in recipe.allergens if a and a.strip()})
    return recipe


def _clamp_seconds(value: Optional[float], duration: Optional[float]) -> Optional[float]:
    if value is None:
        return None
    try:
        seconds = float(value)
    except (TypeError, ValueError):
        return None
    if seconds < 0:
        seconds = 0.0
    if duration is not None and duration > 0:
        seconds = min(seconds, float(duration))
    return round(seconds, 2)


def _fill_missing_step_timeline(
    steps: List[RecipeStep],
    video_duration: Optional[float],
) -> None:
    """Fill gaps by interpolating between known anchors (never blindly overwrite known times)."""
    if not steps:
        return

    duration = float(video_duration) if video_duration and video_duration > 0 else None
    n = len(steps)

    for step in steps:
        step.video_start_seconds = _clamp_seconds(step.video_start_seconds, duration)
        step.video_end_seconds = _clamp_seconds(step.video_end_seconds, duration)

    known = [
        (i, float(steps[i].video_start_seconds))
        for i in range(n)
        if steps[i].video_start_seconds is not None
    ]

    if not known:
        # No visual anchors — leave nulls. Inventing an even grid is worse than no sync.
        return
    else:
        # Before first visual anchor → cluster just before it (caption-only prep).
        # Do NOT invent evenly spaced fake times like 1,3,6,9.
        first_i, first_t = known[0]
        if first_i > 0:
            prep_t = round(max(0.0, first_t - 0.5), 2)
            for k in range(first_i):
                steps[k].video_start_seconds = prep_t

        # Between anchors → linear interpolate.
        for (i_a, t_a), (i_b, t_b) in zip(known, known[1:]):
            gap = i_b - i_a
            if gap <= 1:
                continue
            for offset in range(1, gap):
                frac = offset / gap
                steps[i_a + offset].video_start_seconds = round(t_a + (t_b - t_a) * frac, 2)

        # After last anchor → hold last time (do not invent a ramp to the end).
        last_i, last_t = known[-1]
        if last_i < n - 1:
            for offset in range(1, n - last_i):
                steps[last_i + offset].video_start_seconds = last_t

    # Ends: always snap to next start (or duration) so the cook timeline is contiguous.
    for i, step in enumerate(steps):
        next_start = steps[i + 1].video_start_seconds if i + 1 < n else duration
        if next_start is not None:
            step.video_end_seconds = next_start
        step.video_end_seconds = _clamp_seconds(step.video_end_seconds, duration)
        if (
            step.video_start_seconds is not None
            and step.video_end_seconds is not None
            and step.video_end_seconds < step.video_start_seconds
        ):
            step.video_end_seconds = step.video_start_seconds

    # Enforce non-decreasing starts, then re-snap ends.
    prev = 0.0
    for step in steps:
        if step.video_start_seconds is None:
            continue
        if step.video_start_seconds < prev:
            step.video_start_seconds = prev
        prev = step.video_start_seconds

    for i, step in enumerate(steps):
        next_start = steps[i + 1].video_start_seconds if i + 1 < n else duration
        if next_start is not None and step.video_start_seconds is not None:
            step.video_end_seconds = max(float(step.video_start_seconds), float(next_start))
        step.video_end_seconds = _clamp_seconds(step.video_end_seconds, duration)


def _normalize_ingredients_used(recipe: ParsedRecipe) -> None:
    """Map ingredients_used onto exact ingredient names from the list."""
    by_key = {ing.name.strip().lower(): ing.name for ing in recipe.ingredients if ing.name.strip()}
    keys = list(by_key.keys())

    for step in recipe.steps:
        resolved: list[str] = []
        seen: set[str] = set()
        for raw in step.ingredients_used:
            key = raw.strip().lower()
            if not key:
                continue
            name = by_key.get(key)
            if name is None:
                name = next(
                    (
                        by_key[k]
                        for k in keys
                        if k in key or key in k
                    ),
                    None,
                )
            if name and name not in seen:
                resolved.append(name)
                seen.add(name)

        # Also pick up ingredients clearly named in the instruction.
        instruction = step.instruction.lower()
        for k, name in by_key.items():
            if name in seen or len(k) < 3:
                continue
            if k in instruction:
                resolved.append(name)
                seen.add(name)

        step.ingredients_used = resolved


def _fill_ingredient_timestamps(recipe: ParsedRecipe) -> None:
    """Default appears_at_seconds from the first step that uses each ingredient."""
    name_to_start: dict[str, float] = {}
    for step in recipe.steps:
        if step.video_start_seconds is None:
            continue
        for name in step.ingredients_used:
            key = name.strip().lower()
            if key and key not in name_to_start:
                name_to_start[key] = float(step.video_start_seconds)

    for ing in recipe.ingredients:
        if ing.appears_at_seconds is not None:
            continue
        start = name_to_start.get(ing.name.strip().lower())
        if start is not None:
            ing.appears_at_seconds = start


def timestamps_enabled() -> bool:
    """Whether step video timestamps are produced at all (SOCIAL_TIMESTAMP_MODE)."""
    mode = (getattr(settings, "social_timestamp_mode", None) or "none").strip().lower()
    return mode not in {"none", "off", "null", "false", "0"}


def _apply_video_timeline(
    recipe: ParsedRecipe,
    video_duration: Optional[float],
    *,
    frame_anchors: Optional[list[float]] = None,
) -> ParsedRecipe:
    _normalize_ingredients_used(recipe)

    if not timestamps_enabled():
        _clear_step_times(recipe)
        for ing in recipe.ingredients:
            ing.appears_at_seconds = None
        return recipe

    for step in recipe.steps:
        step.video_start_seconds = _clamp_seconds(step.video_start_seconds, video_duration)
        step.video_end_seconds = _clamp_seconds(step.video_end_seconds, video_duration)
    for ing in recipe.ingredients:
        ing.appears_at_seconds = _clamp_seconds(ing.appears_at_seconds, video_duration)

    _fill_missing_step_timeline(recipe.steps, video_duration)
    _spread_piled_step_times(recipe.steps, video_duration, frame_anchors)
    _fill_ingredient_timestamps(recipe)
    return recipe


def _spread_piled_step_times(
    steps: List[RecipeStep],
    video_duration: Optional[float],
    frame_anchors: Optional[list[float]] = None,
) -> None:
    """Give each step a distinct start when many share the same second (e.g. all at 43)."""
    if len(steps) < 2:
        return

    anchors = [float(a) for a in (frame_anchors or []) if a is not None]
    duration = float(video_duration) if video_duration and video_duration > 0 else None

    # Walk chronologically; bump duplicates onto the next unused anchor / +1s slot.
    used: set[float] = set()
    prev = -1.0
    for step in steps:
        if step.video_start_seconds is None:
            continue
        t = float(step.video_start_seconds)
        if t < prev:
            t = prev
        # Already taken by an earlier step → find next free slot
        while round(t, 2) in used or (prev >= 0 and abs(t - prev) < 0.05):
            nxt = None
            if anchors:
                later = [a for a in anchors if a > t + 0.15]
                if later:
                    nxt = later[0]
            if nxt is None:
                nxt = t + 1.0
            if duration is not None:
                nxt = min(nxt, duration)
            if nxt <= t + 1e-6:
                break
            t = nxt
        t = round(t, 2)
        step.video_start_seconds = t
        used.add(t)
        prev = t

    n = len(steps)
    for i, step in enumerate(steps):
        if step.video_start_seconds is None:
            continue
        nxt = None
        for j in range(i + 1, n):
            if steps[j].video_start_seconds is not None:
                nxt = float(steps[j].video_start_seconds)
                break
        if nxt is None:
            nxt = duration if duration is not None else float(step.video_start_seconds) + 2.0
        step.video_end_seconds = max(float(step.video_start_seconds), nxt)
        step.video_end_seconds = _clamp_seconds(step.video_end_seconds, duration)


def _extract_duration(text: str) -> Optional[int]:
    match = re.search(r"(\d+)\s*(?:minute|min)", text, re.I)
    return int(match.group(1)) if match else None


def _recipe_is_usable(recipe: ParsedRecipe) -> bool:
    if not recipe.steps:
        return False
    if len(recipe.steps) == 1 and recipe.steps[0].instruction.startswith("Review the full recipe"):
        return False
    return True


def _chat_json(*, system: str, user: str) -> dict:
    return chat_json(system=system, user=user)


def _source_preamble(video_duration: Optional[float]) -> str:
    if video_duration and video_duration > 0:
        return (
            f"Source video duration: {video_duration:.1f} seconds "
            f"({int(video_duration // 60)}:{int(video_duration % 60):02d}).\n"
            "Prefer [m:ss] cues in VIDEO OBSERVATIONS / Spoken instructions over guessing.\n\n"
        )
    return (
        "If this is not a video source, leave video timeline fields null.\n\n"
    )


def _split_source_sections(cleaned: str) -> dict[str, str]:
    """Split merged ingest text into caption / spoken / timeline sections."""
    sections = {"caption": "", "spoken": "", "timeline": "", "other": ""}
    current = "other"
    buckets: dict[str, list[str]] = {k: [] for k in sections}

    for line in cleaned.splitlines():
        stripped = line.strip()
        if _PRIMARY_HEADER.match(stripped):
            current = "caption"
            continue
        if _SPOKEN_SECTION_HEADER.match(stripped):
            current = "spoken"
            continue
        if _VIDEO_TIMELINE_HEADER.match(stripped) or _LEGACY_VISUAL_HEADER.match(stripped):
            current = "timeline"
            continue
        buckets[current].append(line)

    for key, lines in buckets.items():
        sections[key] = "\n".join(lines).strip()
    return sections


_HOOK_ACTION = re.compile(
    r"\b(fork|twirl|plated|plating|eat|eating|bite|serve|serving|garnish with|lift the fork|"
    r"portion of .+ pasta from the pot|finished dish|final dish)\b",
    re.I,
)
_RAW_PREP = re.compile(
    r"\b(chicken breast|raw|season|sprinkle|bouillon|paprika|garlic powder|slice|sliced|"
    r"heat (the )?pan|sear|oil|butter)\b",
    re.I,
)


def _filter_hook_timeline(timeline: str, caption: str) -> str:
    """Drop finished-dish hook lines when the caption is a from-scratch cook."""
    if not timeline or not caption:
        return timeline
    if not _RAW_PREP.search(caption):
        return timeline

    lines = timeline.splitlines()
    kept: list[str] = []
    timed_seen = 0
    for line in lines:
        m = re.match(r"^\[(\d+):(\d{2})\]\s*(.*)$", line.strip())
        if not m:
            kept.append(line)
            continue
        minutes, secs, instruction = int(m.group(1)), int(m.group(2)), m.group(3)
        total = minutes * 60 + secs
        # Early hook: finished food action in the first ~8s before raw prep shows up.
        if total <= 8 and _HOOK_ACTION.search(instruction) and not _RAW_PREP.search(instruction):
            continue
        if instruction.upper().startswith("HOOK/OUTRO"):
            continue
        kept.append(line)
        timed_seen += 1
    return "\n".join(kept).strip() if timed_seen or kept else timeline


def _build_parser_user_text(cleaned: str, *, for_content: bool) -> str:
    """Build parser input that fuses caption with watched video observations."""
    parts = _split_source_sections(cleaned)
    if not parts["caption"] and not parts["timeline"] and not parts["spoken"]:
        return cleaned

    timeline = _filter_hook_timeline(parts["timeline"], parts["caption"])

    blocks: list[str] = []
    if parts["caption"]:
        blocks.append(
            "PRIMARY RECIPE SOURCE (creator caption — dish identity, listed ingredients/quantities):\n"
            + parts["caption"]
        )
    if timeline:
        label = (
            "VIDEO OBSERVATIONS (agents WATCHED the frames — actions, foods seen, technique, [m:ss]; "
            "finished-dish hooks already filtered):\n"
            if for_content
            else "VIDEO OBSERVATIONS:\n"
        )
        blocks.append(label + timeline)
    if parts["spoken"]:
        blocks.append("Spoken instructions:\n" + parts["spoken"])
    if parts["other"] and not parts["caption"] and not parts["timeline"]:
        blocks.append(parts["other"])
    return "\n\n".join(blocks).strip() or cleaned


def _parse_frame_clock(timeline: str) -> list[float]:
    """Extract FRAME CLOCK anchors from VIDEO OBSERVATIONS if present."""
    if not timeline:
        return []
    lines = timeline.splitlines()
    for i, line in enumerate(lines):
        if "FRAME CLOCK" not in line.upper():
            continue
        # Times may be on the same line after ":" or on the next non-empty line.
        candidates = []
        if ":" in line:
            after = line.split(":", 1)[1].strip()
            if after and not after.startswith("("):
                candidates.append(after)
            # Also try after the closing paren on same line
            if ")" in line:
                after_paren = line.split(")", 1)[-1].lstrip(": ").strip()
                if after_paren:
                    candidates.append(after_paren)
        for j in range(i + 1, min(i + 3, len(lines))):
            nxt = lines[j].strip()
            if not nxt or nxt.lower().startswith("title"):
                continue
            if "," in nxt or re.search(r"\d+:\d{2}", nxt):
                candidates.append(nxt)
                break
        for blob in candidates:
            anchors: list[float] = []
            for part in blob.split(","):
                sec = parse_mmss(part.strip())
                if sec is not None:
                    anchors.append(sec)
            if len(anchors) >= 3:
                return anchors
    return []


def _parse_timed_cues(timeline: str) -> list[tuple[Optional[float], str]]:
    cues: list[tuple[Optional[float], str]] = []
    for raw in (timeline or "").splitlines():
        line = raw.strip()
        m = re.match(r"^\[([^\]]+)\]\s*(.+)$", line)
        if not m:
            continue
        at = parse_mmss(m.group(1))
        instruction = m.group(2).strip()
        if instruction:
            cues.append((at, instruction))
    return cues


def _scene_cut_times(anchors: list[float], *, nominal_gap: float = 1.0) -> list[float]:
    """Pick frame PTS that look like scene changes (irregular gaps vs sample fps)."""
    if not anchors:
        return []
    if len(anchors) <= 3:
        return list(anchors)
    cuts = [float(anchors[0])]
    for i in range(1, len(anchors)):
        gap = float(anchors[i]) - float(anchors[i - 1])
        if gap > nominal_gap + 0.3 or gap < max(0.15, nominal_gap - 0.3):
            cuts.append(float(anchors[i]))
    last = float(anchors[-1])
    if abs(cuts[-1] - last) > 0.05:
        cuts.append(last)
    # Too few cuts → thin the full clock so steps still land on real PTS.
    if len(cuts) < 4:
        step = max(1, len(anchors) // 10)
        cuts = [float(anchors[i]) for i in range(0, len(anchors), step)]
        if cuts[-1] != last:
            cuts.append(last)
    return cuts


def _spread_across_anchors(
    n: int,
    anchors: list[float],
    *,
    prefer: Optional[list[float]] = None,
) -> list[float]:
    """Spread n step starts across real frame PTS, snapping toward scene cuts when close."""
    if n <= 0:
        return []
    if not anchors:
        return [0.0] * n
    prefer = prefer or []
    start, end = float(anchors[0]), float(anchors[-1])
    chosen: list[float] = []
    for i in range(n):
        frac = i / max(1, n - 1)
        ideal = start + frac * (end - start)
        # Prefer a nearby scene cut; otherwise nearest dense PTS.
        if prefer:
            cut = snap_to_nearest(ideal, prefer)
            if abs(cut - ideal) <= 3.0:
                t = cut
            else:
                t = snap_to_nearest(ideal, anchors)
        else:
            t = snap_to_nearest(ideal, anchors)
        if chosen and t < chosen[-1]:
            t = chosen[-1]
        if chosen and abs(t - chosen[-1]) < 0.05:
            later = [a for a in anchors if a > chosen[-1] + 0.2]
            t = float(later[0]) if later else t
        chosen.append(float(t))
    return chosen


def _token_overlap(a: str, b: str) -> float:
    ta = {t for t in a.lower().split() if len(t) > 2}
    tb = {t for t in b.lower().split() if len(t) > 2}
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _clear_step_times(recipe: ParsedRecipe) -> None:
    for step in recipe.steps:
        step.video_start_seconds = None
        step.video_end_seconds = None


def _set_step_ends(recipe: ParsedRecipe, video_duration: Optional[float]) -> None:
    n = len(recipe.steps)
    for i, step in enumerate(recipe.steps):
        if step.video_start_seconds is None:
            continue
        nxt = None
        for j in range(i + 1, n):
            if recipe.steps[j].video_start_seconds is not None:
                nxt = recipe.steps[j].video_start_seconds
                break
        if nxt is None:
            nxt = video_duration
        if nxt is not None:
            step.video_end_seconds = max(float(step.video_start_seconds), float(nxt))


def _match_steps_to_cues(
    recipe: ParsedRecipe,
    timed_cues: list[tuple[float, str]],
    anchors: list[float],
    video_duration: Optional[float],
    *,
    min_score: float = 0.28,
) -> int:
    """Greedy chronological keyword match. Returns number of matched steps."""
    if not timed_cues or not recipe.steps:
        return 0
    used: set[int] = set()
    matched = 0
    last_t = 0.0
    for step in recipe.steps:
        best_j = -1
        best_score = 0.0
        for j, (t, instruction) in enumerate(timed_cues):
            if j in used:
                continue
            if t + 0.05 < last_t:
                continue
            score = _token_overlap(step.instruction, instruction)
            if score > best_score:
                best_score = score
                best_j = j
        if best_j < 0 or best_score < min_score:
            continue
        t, _ = timed_cues[best_j]
        used.add(best_j)
        if anchors:
            t = snap_to_nearest(t, anchors)
        t = _clamp_seconds(t, video_duration) or t
        if t < last_t:
            t = last_t
        step.video_start_seconds = round(float(t), 2)
        last_t = float(step.video_start_seconds)
        matched += 1
    return matched


def _assign_clock_spread(
    recipe: ParsedRecipe,
    anchors: list[float],
    video_duration: Optional[float],
) -> bool:
    """Spread steps across the full frame clock (scene cuts preferred). No AI."""
    if not recipe.steps or len(anchors) < 4:
        return False
    cuts = _scene_cut_times(anchors)
    chosen = _spread_across_anchors(len(recipe.steps), anchors, prefer=cuts)
    for step, t in zip(recipe.steps, chosen):
        clamped = _clamp_seconds(t, video_duration)
        step.video_start_seconds = round(float(clamped if clamped is not None else t), 2)
    _set_step_ends(recipe, video_duration)
    return True


def _assign_deterministic_timestamps(
    recipe: ParsedRecipe,
    cleaned: str,
    video_duration: Optional[float],
) -> bool:
    """Assign step times without LLM — transcript keywords, else full frame-clock spread.

    Vision/LLM [m:ss] cues are ignored when sparse or evenly invented; silent TikToks
    get an honest 0→duration mapping onto real PTS instead of clustering near a late cue.
    """
    if not recipe.steps:
        return False

    parts = _split_source_sections(cleaned)
    timeline = _filter_hook_timeline(parts["timeline"], parts["caption"]) or ""
    spoken = parts.get("spoken") or ""
    anchors = _parse_frame_clock(timeline) or _parse_frame_clock(cleaned)

    _clear_step_times(recipe)

    # 1) Spoken transcript cues (Whisper/Transcribe) — real audio times, no vision LLM.
    spoken_cues = [(t, i) for t, i in _parse_timed_cues(spoken) if t is not None]
    matched = 0
    if len(spoken_cues) >= 3:
        matched = _match_steps_to_cues(
            recipe, spoken_cues, anchors, video_duration, min_score=0.22
        )

    # 2) Dense visual cues only when they look real (not null-heavy / even grids).
    visual_cues = [(t, i) for t, i in _parse_timed_cues(timeline) if t is not None]
    visual_ok = (
        len(visual_cues) >= max(4, len(recipe.steps) // 3)
        and not is_suspiciously_even([float(t) for t, _ in visual_cues])
        and (max(t for t, _ in visual_cues) - min(t for t, _ in visual_cues))
        >= max(8.0, 0.25 * (video_duration or 60.0))
    )
    if visual_ok and matched < max(3, len(recipe.steps) // 2):
        # Fill only still-null steps from visual cues
        matched += _match_steps_to_cues(
            recipe, visual_cues, anchors, video_duration, min_score=0.3
        )

    coverage = matched / max(1, len(recipe.steps))
    if coverage >= 0.5:
        # Fill remaining gaps by interpolating across the matched anchors — but if the
        # first match is absurdly late (>35% into the video) while we have early prep
        # steps, prefer a full clock spread so prep isn't stuck at mid-video.
        known = [
            float(s.video_start_seconds)
            for s in recipe.steps
            if s.video_start_seconds is not None
        ]
        first_known = min(known) if known else 0.0
        late_cluster = (
            video_duration
            and video_duration > 0
            and first_known > 0.35 * float(video_duration)
            and any(s.video_start_seconds is None for s in recipe.steps[:3])
        )
        if not late_cluster:
            _set_step_ends(recipe, video_duration)
            return True

    # 3) Default: honest spread across the full sampled clock (0 → end).
    _clear_step_times(recipe)
    if _assign_clock_spread(recipe, anchors, video_duration):
        return True

    # No frame clock — even spacing across duration (still non-AI).
    if video_duration and video_duration > 0 and recipe.steps:
        n = len(recipe.steps)
        for i, step in enumerate(recipe.steps):
            step.video_start_seconds = round((i / n) * float(video_duration), 2)
        _set_step_ends(recipe, video_duration)
        return True
    return False


def _align_steps_deterministic(
    recipe: ParsedRecipe,
    timeline: str,
    video_duration: Optional[float],
) -> bool:
    """Match locked steps to [m:ss] cues by text overlap; snap to FRAME CLOCK.

    Returns True when at least half the steps got a timed cue (skip LLM align).
    """
    cues = _parse_timed_cues(timeline)
    timed_cues = [(t, i) for t, i in cues if t is not None]
    if len(timed_cues) < 3 or not recipe.steps:
        return False

    # Reject invented evenly spaced timelines — remap onto real FRAME CLOCK PTS
    # (preferring scene-cut times) instead of trusting the metronome grid.
    if is_suspiciously_even([float(t) for t, _ in timed_cues]):
        anchors = _parse_frame_clock(timeline)
        if len(anchors) >= 4:
            return _assign_clock_spread(recipe, anchors, video_duration)
        _clear_step_times(recipe)
        return True  # skip LLM align which would re-invent the same grid

    anchors = _parse_frame_clock(timeline)
    matched = _match_steps_to_cues(recipe, timed_cues, anchors, video_duration)
    _set_step_ends(recipe, video_duration)
    return matched >= max(3, len(recipe.steps) // 2)


def _align_step_timestamps(
    recipe: ParsedRecipe,
    cleaned: str,
    video_duration: Optional[float],
) -> ParsedRecipe:
    """Assign step times. Default is deterministic (no LLM timeline inventing)."""
    mode = (getattr(settings, "social_timestamp_mode", None) or "deterministic").strip().lower()
    if mode in {"none", "off", "null"}:
        _clear_step_times(recipe)
        return recipe

    if mode in {"deterministic", "clock", "scene"}:
        _assign_deterministic_timestamps(recipe, cleaned, video_duration)
        return recipe

    # mode == "ai" — legacy: try cue match, then LLM timeline align
    parts = _split_source_sections(cleaned)
    timeline = _filter_hook_timeline(parts["timeline"], parts["caption"]) or parts["spoken"]
    if not timeline or not recipe.steps:
        return recipe

    if _align_steps_deterministic(recipe, timeline, video_duration):
        return recipe

    locked_steps = [
        {"order": step.order, "instruction": step.instruction}
        for step in recipe.steps
    ]
    preamble = _source_preamble(video_duration)
    clock = ""
    anchors = _parse_frame_clock(timeline)
    if anchors:
        clock = (
            "FRAME CLOCK (snap every video_start_seconds to one of these): "
            + ", ".join(str(round(a, 2)) for a in anchors)
            + "\n\n"
        )
    try:
        data = _chat_json(
            system=TIMELINE_ALIGN_SYSTEM,
            user=(
                f"{preamble}"
                f"{clock}"
                f"LOCKED STEPS:\n{json.dumps(locked_steps, ensure_ascii=False)}\n\n"
                f"TIMING CUES:\n{timeline}"
            ),
        )
    except Exception:
        return recipe

    by_order: dict[int, dict] = {}
    for item in data.get("steps") or []:
        try:
            order = int(item.get("order"))
        except (TypeError, ValueError):
            continue
        by_order[order] = item

    last_t = 0.0
    for step in recipe.steps:
        item = by_order.get(step.order)
        if not item:
            continue
        start = item.get("video_start_seconds")
        if start is not None:
            sec = parse_mmss(start)
            if sec is not None:
                if anchors:
                    sec = snap_to_nearest(sec, anchors)
                sec = _clamp_seconds(sec, video_duration) or sec
                if sec < last_t:
                    sec = last_t
                step.video_start_seconds = round(float(sec), 2)
                last_t = float(step.video_start_seconds)
        end = item.get("video_end_seconds")
        if end is not None:
            end_sec = parse_mmss(end)
            if end_sec is not None:
                if anchors:
                    end_sec = snap_to_nearest(end_sec, anchors)
                step.video_end_seconds = _clamp_seconds(end_sec, video_duration)
    return recipe


def _finalize_recipe(recipe: ParsedRecipe) -> ParsedRecipe:
    recipe.steps.sort(key=lambda s: s.order)
    for i, step in enumerate(recipe.steps, start=1):
        step.order = i
        step.instruction = step.instruction.strip()
        step.ingredients_used = [x.strip() for x in step.ingredients_used if x and str(x).strip()]
        step.equipment = [x.strip() for x in step.equipment if x and str(x).strip()]

    cleaned_ingredients: list[Ingredient] = []
    seen: set[str] = set()
    for ing in recipe.ingredients:
        name = ing.name.strip()
        if not name:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        ing.name = name
        ing.quantity = (ing.quantity or "").strip()
        ing.group = (ing.group or "Main").strip() or "Main"
        cleaned_ingredients.append(ing)
    recipe.ingredients = cleaned_ingredients
    recipe.title = (recipe.title or "").strip() or "Untitled Recipe"
    return recipe


def _ensure_all_ingredients_linked(recipe: ParsedRecipe) -> None:
    """Attach any unused ingredients to the most relevant step (or step 1)."""
    used: set[str] = set()
    for step in recipe.steps:
        for name in step.ingredients_used:
            used.add(name.strip().lower())

    for ing in recipe.ingredients:
        key = ing.name.strip().lower()
        if not key or key in used:
            continue
        target = None
        for step in recipe.steps:
            if key in step.instruction.lower():
                target = step
                break
        if target is None:
            target = recipe.steps[0] if recipe.steps else None
        if target is not None:
            target.ingredients_used.append(ing.name)
            used.add(key)


def _parse_with_cookbook_passes(
    cleaned: str,
    video_duration: Optional[float],
) -> ParsedRecipe:
    preamble = _source_preamble(video_duration)
    content_text = _build_parser_user_text(cleaned, for_content=True)

    # Pass 1 — mise en place (caption + watched video)
    ingredients_data = _chat_json(
        system=INGREDIENTS_SYSTEM,
        user=f"{preamble}SOURCE TEXT:\n{content_text}",
    )
    base = ParsedRecipe.model_validate(
        {
            **ingredients_data,
            "steps": ingredients_data.get("steps")
            or [{"order": 1, "instruction": "Prepare the ingredients as described.", "ingredients_used": []}],
        }
    )
    if not base.ingredients:
        raise ValueError("No ingredients extracted")

    locked = [
        {"name": ing.name, "quantity": ing.quantity, "group": ing.group}
        for ing in base.ingredients
    ]

    # Pass 2 — method from watched actions + caption, with locked ingredients
    steps_data = _chat_json(
        system=STEPS_SYSTEM,
        user=(
            f"{preamble}"
            f"LOCKED INGREDIENTS (use these exact names in ingredients_used):\n"
            f"{json.dumps(locked, ensure_ascii=False)}\n\n"
            f"SOURCE TEXT:\n{content_text}"
        ),
    )
    steps = [
        RecipeStep.model_validate(step)
        for step in (steps_data.get("steps") or [])
        if str(step.get("instruction", "")).strip()
    ]
    if not steps:
        raise ValueError("No steps extracted")

    draft = ParsedRecipe(
        title=base.title,
        servings=base.servings,
        prep_time_minutes=base.prep_time_minutes,
        cook_time_minutes=base.cook_time_minutes,
        calories_per_serving=base.calories_per_serving,
        allergens=base.allergens,
        ingredients=base.ingredients,
        steps=steps,
    )
    draft = _finalize_recipe(draft)

    # Pass 3 — proofread against caption + watched observations
    refined_data = _chat_json(
        system=REFINE_SYSTEM,
        user=(
            f"{preamble}"
            f"SOURCE TEXT:\n{content_text}\n\n"
            f"DRAFT RECIPE JSON:\n{json.dumps(draft.model_dump(), ensure_ascii=False)}"
        ),
    )
    recipe = _finalize_recipe(ParsedRecipe.model_validate(refined_data))
    if not recipe.ingredients:
        recipe.ingredients = draft.ingredients
    if not recipe.steps:
        recipe.steps = draft.steps
        recipe = _finalize_recipe(recipe)

    # Pass 4 — align timestamps without rewriting step text
    recipe = _align_step_timestamps(recipe, cleaned, video_duration)
    _ensure_finish_steps(recipe, cleaned)

    _ensure_all_ingredients_linked(recipe)
    return recipe


def _ensure_finish_steps(recipe: ParsedRecipe, cleaned: str) -> None:
    """Guarantee pasta/cheese/garnish finish steps when locked ingredients require them."""
    if not recipe.steps:
        return
    blob = " ".join(s.instruction.lower() for s in recipe.steps)
    names = {ing.name.strip().lower(): ing.name for ing in recipe.ingredients if ing.name.strip()}
    additions: list[RecipeStep] = []

    def has_action(*needles: str) -> bool:
        return any(n in blob for n in needles)

    pasta_key = next((k for k in names if "pasta" in k), None)
    if pasta_key and not has_action("add cooked pasta", "pasta to the sauce", "toss the pasta", "mix the pasta"):
        additions.append(
            RecipeStep(
                order=0,
                instruction=f"Add {names[pasta_key]} to the sauce and toss until coated.",
                ingredients_used=[names[pasta_key]],
                equipment=["pan"],
            )
        )

    cheese_key = next((k for k in names if "mozzarella" in k or "parmesan" in k or k.endswith(" cheese")), None)
    if cheese_key and not has_action("cheese", "mozzarella", "parmesan"):
        additions.append(
            RecipeStep(
                order=0,
                instruction=f"Stir in {names[cheese_key]} until melted and the sauce is smooth.",
                ingredients_used=[names[cheese_key]],
                equipment=["pan"],
            )
        )

    onion_key = next((k for k in names if "onion powder" in k), None)
    if onion_key and not has_action("onion powder"):
        # Insert before cheese/pasta if possible — append near sauce seasoning
        additions.insert(
            0,
            RecipeStep(
                order=0,
                instruction=f"Season the sauce with {names[onion_key]}.",
                ingredients_used=[names[onion_key]],
                equipment=["pan"],
            ),
        )

    parsley_key = next((k for k in names if "parsley" in k), None)
    if parsley_key and not has_action("parsley", "garnish"):
        additions.append(
            RecipeStep(
                order=0,
                instruction=f"Garnish with {names[parsley_key]}.",
                ingredients_used=[names[parsley_key]],
                equipment=[],
            )
        )

    if not additions:
        return

    # Place finish steps before a trailing garnish if present, else at end.
    insert_at = len(recipe.steps)
    for i, step in enumerate(recipe.steps):
        low = step.instruction.lower()
        if "garnish" in low or "parsley" in low:
            insert_at = i
            break
    for offset, step in enumerate(additions):
        recipe.steps.insert(insert_at + offset, step)
    for i, step in enumerate(recipe.steps, start=1):
        step.order = i


def parse_recipe(
    raw_text: str,
    *,
    video_duration: Optional[float] = None,
) -> Tuple[ParsedRecipe, bool]:
    cleaned = _preprocess_raw_text(raw_text)
    parts = _split_source_sections(cleaned) if cleaned else {}
    timeline = (parts.get("timeline") or "") if parts else ""
    anchors = _parse_frame_clock(timeline) or _parse_frame_clock(cleaned or "")

    def _finish(recipe: ParsedRecipe, used_ai: bool) -> Tuple[ParsedRecipe, bool]:
        return (
            _apply_video_timeline(recipe, video_duration, frame_anchors=anchors or None),
            used_ai,
        )

    if not cleaned:
        return _finish(_heuristic_parse(raw_text), False)

    if not settings.feature_ai_enabled:
        return _finish(_heuristic_parse(cleaned), False)

    if resolve_ai_provider() is None:
        return _finish(_heuristic_parse(cleaned), False)

    try:
        recipe = _parse_with_cookbook_passes(cleaned, video_duration)

        if not _recipe_is_usable(recipe):
            return _finish(_heuristic_parse(cleaned), False)

        return _finish(_normalize_nutrition(recipe), True)
    except Exception:
        return _finish(_heuristic_parse(cleaned), False)
