"""Multi-agent video analysis — watch the cook, cross-check the caption.

Agents' primary job is to observe what is happening in the frames (actions, foods,
technique, on-screen text). The creator caption is a reference to cross-check names
and fill listed spices — not a substitute for watching the video.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import re
from typing import Optional

from app.services.llm import chat_json
from app.services.transcript_format import format_mmss, is_suspiciously_even, parse_mmss, snap_to_nearest
from app.services.video_vision import resolve_frame_times, run_vision_prompt
from app.services.vision_quality import resolve_vision_quality

_SEGMENT_PROMPT = """You are Segment Observer #{seg_id}. Your job is to WATCH this cooking-video window
({t_start} → {t_end}) like a sous-chef standing over the stove.

{caption_block}

Describe ONLY what you see in THESE frames:
1) Actions — what the cook's hands/pan/food are doing when the action BEGINS. One line per action:
   [m:ss] technique + heat + what is added/mixed/flipped (use EXACT labeled frame times)
2) Foods — every edible item / spice jar / liquid / cheese first visible or poured in this window, with [m:ss]
3) OCR — any readable on-screen text/measurements with [m:ss]

Rules:
- Prefer what you SEE over what the caption says when they describe the same moment
- Use the caption only to name spices/ingredients you can see (e.g. a red powder the caption calls paprika)
- If the caption lists something but it is NOT visible in this window, do not pretend it happens here
- If you see an action the caption omitted, still report it
- Do not invent foods or moves that are not in the frames
- If the window is only a title/logo, say so briefly"""

_OCR_PROMPT = """You are the OCR Agent. Read text on screen carefully.

{caption_block}

For EVERY frame with readable text, list:
[m:ss] <exact text>

Capture titles, ingredient lists, quantities, temperatures, step overlays, package labels.
Prefer exact on-screen spelling. The caption is a spelling/name hint only — never invent text that is not visible."""

_INGREDIENT_PROMPT = """You are the Ingredient Scout. WATCH the frames for every food that appears or is used.

{caption_block}

Primary task — from the VIDEO:
- List every edible item / spice / powder / herb / liquid / cheese / sauce you can SEE being used or shown
- Note the EXACT [m:ss] when it FIRST appears or is poured/sprinkled
- Include quantity if shown on screen or packaging

Then cross-check the caption:
- If the caption lists spices (paprika, garlic powder, onion powder, bouillon, etc.) and you see matching jars/powders being used, use the caption names
- Add any caption ingredients you confidently see, even if briefly
- Under "Caption-only (not clearly visible):" list caption items you could not spot — do not invent sightings

Format:
[m:ss] quantity name

Use clear, universal grocery names (no slang). Prefer widely recognized forms (eggplant, zucchini, ground meat, bell pepper, cilantro / fresh coriander, green onion / scallion).

Never invent items that are neither visible nor in the caption. Never write cooking steps."""

_ACTION_PROMPT = """You are the Action Timeline Agent. WATCH the cooking video and narrate what the cook does.

{caption_block}

Primary task — from the VIDEO:
- Chronological cooking actions as they happen on screen
- Each line MUST start with the EXACT [m:ss] printed on the frame where that action BEGINS
- You may ONLY use frame labels you were actually shown — never invent times, never evenly space (0:15, 0:20, 0:25…)
- If you are unsure which labeled frame matches, pick the closest labeled frame — do not guess a time between labels
- Include technique, heat, and what is added when visible
- Split seasoning with multiple powders into separate lines when you can see them applied separately

TikTok/Reel hooks:
- Many videos OPEN with the finished plated dish or someone eating. Do NOT treat that as step 1.
- Mark hook/outro shots as "HOOK/OUTRO (not a cooking step): …" so the editor can drop them.
- Real cooking usually starts when raw ingredients are prepped/seasoned or a cold pan is heated.

Caption cross-check:
- Use caption wording to clarify names (e.g. which powder is paprika)
- If the caption lists early prep (slice chicken, season with each spice) and you never see it, still note "CAPTION PREP (not clearly timed): …"
- If the video shows an action the caption skipped, still include it with its [m:ss]

Format:
[m:ss] imperative instruction in clear universal cookbook English (no slang or dialect)"""

_RECONCILE_SYSTEM = """You are the Lead Cookbook Editor. Merge reports from agents who WATCHED the video.

Your brief must reflect the full cook from raw ingredients to finish.

FUSION RULES:
1. VIDEO OBSERVATIONS are primary for: what actions occur, when they start, technique, and foods visibly used.
2. CREATOR CAPTION is a cross-check for: ingredient names, quantities, spices, early prep the edit may have cut, and dish identity.
3. DROP TikTok hooks/outros: finished plated pasta being twirled/eaten at the START of the video is NOT a cooking step when the caption starts with seasoning raw chicken / making sauce.
4. Early prep from the caption MAY appear in timed_method even if agents only caught mid-cook frames — e.g. slice chicken, season with EACH listed chicken spice. For those caption-only prep lines set "at" to null (do NOT invent evenly spaced fake times like 0:01, 0:03, 0:06…).
5. Include EVERY caption spice/powder for both chicken and sauce when listed.
6. If caption and video conflict on the DISH, trust the caption for dish identity.
7. Timed method: one action per line. For watched actions, copy the agent's [m:ss] EXACTLY from the action/segment reports — never invent or evenly redistribute times. Prefer the Action Timeline agent's times when present.
8. You may ONLY use timestamps that appear in the FRAME CLOCK list (or null for caption-only prep).
9. Ingredient names and timed_method instructions must use clear, universal cookbook English — rewrite slang/regional wording while keeping the same meaning and dish identity.

Return ONLY JSON:
{
  "title": "string or null",
  "ingredients": [{"name": "string", "quantity": "string", "appears_at": "m:ss or null"}],
  "timed_method": [{"at": "m:ss or null", "instruction": "string"}],
  "notes": "string or null"
}"""


def _caption_block(caption: Optional[str]) -> str:
    text = (caption or "").strip()
    if not text:
        return (
            "No creator caption provided — rely entirely on what you WATCH in the frames "
            "(actions, foods, OCR)."
        )
    if len(text) > 3500:
        text = text[:3500] + "\n…"
    return (
        "CREATOR CAPTION (cross-check reference — WATCH the frames first; use this to name "
        "foods you see and to keep the correct dish identity):\n"
        f"{text}"
    )


def _chunk_indices(n: int, size: int, overlap: int) -> list[tuple[int, int]]:
    if n <= 0:
        return []
    size = max(2, size)
    overlap = max(0, min(overlap, size - 1))
    step = max(1, size - overlap)
    chunks: list[tuple[int, int]] = []
    start = 0
    while start < n:
        end = min(n, start + size)
        chunks.append((start, end))
        if end >= n:
            break
        start += step
    return chunks


def _window_label(times: list[Optional[float]], start: int, end: int) -> tuple[str, str]:
    t0 = times[start] if start < len(times) else None
    t1 = times[end - 1] if end - 1 < len(times) else None
    a = format_mmss(t0) if t0 is not None else "?"
    b = format_mmss(t1) if t1 is not None else "?"
    return a, b


def _extract_timed_cues(
    text: Optional[str],
    anchors: list[float],
    *,
    window: Optional[tuple[float, float]] = None,
) -> list[tuple[Optional[float], str]]:
    """Pull `[m:ss] instruction` lines and snap times onto real frame PTS."""
    if not text:
        return []
    cues: list[tuple[Optional[float], str]] = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            continue
        lower = line.lower()
        if lower.startswith("hook") or "hook/outro" in lower or lower.startswith("###"):
            continue
        if "exact labeled frame" in lower or "use exact labeled" in lower:
            continue
        if lower.startswith("caption prep"):
            instruction = line.split(":", 1)[-1].strip() if ":" in line else line
            if instruction:
                cues.append((None, instruction))
            continue
        m = re.match(r"^\[([^\]]+)\]\s*(.+)$", line)
        if not m:
            continue
        at = parse_mmss(m.group(1))
        instruction = m.group(2).strip()
        if not instruction:
            continue
        if at is not None and window is not None:
            lo, hi = window
            # Reject times clearly outside this observer's window (hallucinated).
            if at < lo - 1.5 or at > hi + 1.5:
                continue
            at = min(max(at, lo), hi)
        if at is not None and anchors:
            at = snap_to_nearest(at, anchors)
        cues.append((at, instruction))
    return cues


def _segment_window(seg_text: str) -> Optional[tuple[float, float]]:
    """Parse `### Segment N (m:ss–m:ss)` header into a time window."""
    m = re.search(r"###\s*Segment\s*\d+\s*\(([^–\-]+)[–\-]([^)]+)\)", seg_text)
    if not m:
        return None
    a = parse_mmss(m.group(1).strip())
    b = parse_mmss(m.group(2).strip())
    if a is None or b is None:
        return None
    return (min(a, b), max(a, b))


def _dedupe_cues(
    cues: list[tuple[Optional[float], str]],
) -> list[tuple[Optional[float], str]]:
    """Keep chronological unique instructions (prefer earlier timed sightings)."""
    seen: set[str] = set()
    out: list[tuple[Optional[float], str]] = []
    # Sort: timed first by time, then untimed at front (prep)
    timed = [(t, i) for t, i in cues if t is not None]
    untimed = [(t, i) for t, i in cues if t is None]
    timed.sort(key=lambda x: x[0] or 0.0)
    for t, instruction in untimed + timed:
        key = " ".join(instruction.lower().split())
        if len(key) < 4 or key in seen:
            continue
        seen.add(key)
        out.append((t, instruction))
    return out


def _frame_clock_block(anchors: list[float]) -> str:
    if not anchors:
        return ""
    labels = [format_mmss(t) for t in anchors]
    # Keep brief readable — sample if huge
    if len(labels) > 40:
        step = max(1, len(labels) // 36)
        labels = labels[::step]
        if format_mmss(anchors[-1]) not in labels:
            labels.append(format_mmss(anchors[-1]))
    return "FRAME CLOCK (only valid timestamps — snap every [m:ss] to one of these):\n" + ", ".join(
        labels
    )


def _run_segment(
    seg_id: int,
    frames: list[Path],
    times: list[Optional[float]],
    caption: Optional[str],
) -> Optional[str]:
    a, b = _window_label(times, 0, len(frames))
    prompt = _SEGMENT_PROMPT.format(
        seg_id=seg_id,
        t_start=a,
        t_end=b,
        caption_block=_caption_block(caption),
    )
    text = run_vision_prompt(frames, times, prompt, max_tokens=1200)
    if not text:
        return None
    return f"### Segment {seg_id} ({a}–{b})\n{text.strip()}"


def _run_ocr(frames: list[Path], times: list[Optional[float]], caption: Optional[str]) -> Optional[str]:
    prompt = _OCR_PROMPT.format(caption_block=_caption_block(caption))
    text = run_vision_prompt(frames, times, prompt, max_tokens=1500)
    return text.strip() if text else None


def _run_ingredient_scout(
    frames: list[Path],
    times: list[Optional[float]],
    caption: Optional[str],
) -> Optional[str]:
    prompt = _INGREDIENT_PROMPT.format(caption_block=_caption_block(caption))
    text = run_vision_prompt(frames, times, prompt, max_tokens=1200)
    return text.strip() if text else None


def _run_action_timeline(
    frames: list[Path],
    times: list[Optional[float]],
    caption: Optional[str],
) -> Optional[str]:
    prompt = _ACTION_PROMPT.format(caption_block=_caption_block(caption))
    text = run_vision_prompt(frames, times, prompt, max_tokens=1500)
    return text.strip() if text else None


def _format_reconciled(payload: dict, *, anchors: Optional[list[float]] = None) -> str:
    lines: list[str] = []
    if anchors:
        clock = _frame_clock_block(anchors)
        if clock:
            lines.append(clock)

    title = payload.get("title")
    if isinstance(title, str) and title.strip():
        lines.append(f"Title\n{title.strip()}")

    ingredients = payload.get("ingredients") or []
    if ingredients:
        lines.append("Ingredients")
        for item in ingredients:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if not name:
                continue
            qty = str(item.get("quantity") or "").strip()
            at_raw = item.get("appears_at")
            at_sec = parse_mmss(at_raw)
            if at_sec is not None and anchors:
                at_sec = snap_to_nearest(at_sec, anchors)
            at_s = f" [{format_mmss(at_sec)}]" if at_sec is not None else ""
            if qty:
                lines.append(f"- {qty} {name}{at_s}")
            else:
                lines.append(f"- {name}{at_s}")

    method = payload.get("timed_method") or []
    if method:
        lines.append("Timed method")
        for item in method:
            if not isinstance(item, dict):
                continue
            instruction = str(item.get("instruction") or "").strip()
            if not instruction:
                continue
            at_sec = parse_mmss(item.get("at"))
            if at_sec is not None and anchors:
                at_sec = snap_to_nearest(at_sec, anchors)
            if at_sec is not None:
                lines.append(f"[{format_mmss(at_sec)}] {instruction}")
            else:
                lines.append(f"[null] {instruction}")

    notes = payload.get("notes")
    if isinstance(notes, str) and notes.strip():
        lines.append(f"Editor notes\n{notes.strip()}")

    return "\n".join(lines).strip()


def _is_suspiciously_even(times: list[float]) -> bool:
    return is_suspiciously_even(times)


def _looks_like_hook(instruction: str) -> bool:
    lower = instruction.lower()
    hooks = (
        "finished",
        "plated",
        "display the finished",
        "twirl",
        "eating",
        "hook/outro",
        "final dish",
        "show the completed",
    )
    return any(h in lower for h in hooks)


def _apply_authoritative_times(
    payload: dict,
    *,
    actions: Optional[str],
    segments: list[str],
    anchors: list[float],
) -> dict:
    """Prefer snapped Action/Segment [m:ss] cues; never keep LLM-invented even grids."""
    action_cues = [
        c for c in _extract_timed_cues(actions, anchors) if not _looks_like_hook(c[1])
    ]
    segment_cues: list[tuple[Optional[float], str]] = []
    for seg in segments:
        window = _segment_window(seg)
        segment_cues.extend(
            c
            for c in _extract_timed_cues(seg, anchors, window=window)
            if not _looks_like_hook(c[1])
        )

    action_auth = _dedupe_cues(action_cues)
    segment_auth = _dedupe_cues(segment_cues)
    action_timed = [t for t, _ in action_auth if t is not None]
    segment_timed = [t for t, _ in segment_auth if t is not None]

    # Prefer window-validated segment cues when the global action timeline looks invented.
    if (
        len(segment_timed) >= 3
        and not _is_suspiciously_even(segment_timed)
        and (len(action_timed) < 3 or _is_suspiciously_even(action_timed))
    ):
        authoritative = segment_auth
        timed = segment_timed
    elif len(action_timed) >= 3 and not _is_suspiciously_even(action_timed):
        authoritative = action_auth
        timed = action_timed
    else:
        merged_src = _dedupe_cues(action_cues + segment_cues)
        authoritative = merged_src
        timed = [t for t, _ in authoritative if t is not None]
        if _is_suspiciously_even(timed):
            # Keep instructions, drop fake times — better null than a metronome timeline.
            authoritative = [(None, inst) for _, inst in authoritative]
            timed = []

    llm_method = [
        item
        for item in (payload.get("timed_method") or [])
        if isinstance(item, dict)
        and str(item.get("instruction") or "").strip()
        and not _looks_like_hook(str(item.get("instruction") or ""))
    ]

    if len(timed) >= 3 and not _is_suspiciously_even(timed):
        covered: set[str] = set()
        merged: list[dict] = []
        used_times: set[float] = set()
        for at, instruction in authoritative:
            if at is not None:
                if at in used_times:
                    continue
                used_times.add(at)
            key = " ".join(instruction.lower().split())
            covered.add(key)
            merged.append(
                {
                    "at": format_mmss(at) if at is not None else None,
                    "instruction": instruction,
                }
            )
        for item in llm_method:
            inst = str(item.get("instruction") or "").strip()
            key = " ".join(inst.lower().split())
            if any(key in c or c in key or _token_overlap(inst, c) > 0.45 for c in covered):
                continue
            merged.append({"at": None, "instruction": inst})
            covered.add(key)

        def sort_key(item: dict) -> tuple[int, float]:
            at = parse_mmss(item.get("at"))
            if at is None:
                return (0, 0.0)
            return (1, at)

        merged.sort(key=sort_key)
        payload["timed_method"] = merged
    else:
        snapped: list[dict] = []
        used_times: set[float] = set()
        llm_times = []
        for item in llm_method:
            at = parse_mmss(item.get("at"))
            if at is not None:
                llm_times.append(at)
        drop_times = _is_suspiciously_even(sorted(llm_times))
        for item in llm_method:
            instruction = str(item.get("instruction") or "").strip()
            at = parse_mmss(item.get("at"))
            if drop_times:
                at = None
            elif at is not None and anchors:
                at = snap_to_nearest(at, anchors)
                if at in used_times:
                    at = None
                else:
                    used_times.add(at)
            snapped.append(
                {
                    "at": format_mmss(at) if at is not None else None,
                    "instruction": instruction,
                }
            )
        payload["timed_method"] = snapped

    # Final safety: drop invented even grids from the emitted timeline.
    method = payload.get("timed_method") or []
    method_times = []
    for item in method:
        if isinstance(item, dict):
            at = parse_mmss(item.get("at"))
            if at is not None:
                method_times.append(at)
    if _is_suspiciously_even(method_times):
        for item in method:
            if isinstance(item, dict):
                item["at"] = None
        payload["timed_method"] = method

    ingredients = payload.get("ingredients") or []
    for item in ingredients:
        if not isinstance(item, dict):
            continue
        at = parse_mmss(item.get("appears_at"))
        if at is not None and anchors:
            item["appears_at"] = format_mmss(snap_to_nearest(at, anchors))
    return payload


def _token_overlap(a: str, b: str) -> float:
    ta = {t for t in a.lower().split() if len(t) > 2}
    tb = {t for t in b.lower().split() if len(t) > 2}
    if not ta or not tb:
        return 0.0
    return len(ta & tb) / len(ta | tb)


def _reconcile(
    *,
    duration: Optional[float],
    caption: Optional[str],
    segments: list[str],
    ocr: Optional[str],
    ingredients: Optional[str],
    actions: Optional[str],
    anchors: list[float],
) -> Optional[str]:
    if not any([segments, ocr, ingredients, actions, caption]):
        return None

    duration_line = ""
    if duration and duration > 0:
        duration_line = f"Video duration: {duration:.1f}s ({format_mmss(duration)}).\n"
    clock = _frame_clock_block(anchors)

    user_parts = [
        duration_line,
        clock,
        "## Creator caption (cross-check — dish identity, listed spices/quantities)",
        (caption.strip() if caption and caption.strip() else "(none — rely on what agents watched)"),
        "## Segment observers (WATCHED the video windows)",
        "\n\n".join(segments) if segments else "(none)",
        "## OCR agent (on-screen text)",
        ocr or "(none)",
        "## Ingredient scout (foods seen in frames)",
        ingredients or "(none)",
        "## Action timeline agent (cook moves watched on screen)",
        actions or "(none)",
    ]
    try:
        payload = chat_json(
            system=_RECONCILE_SYSTEM,
            user="\n\n".join(p for p in user_parts if p is not None),
            max_tokens=3500,
        )
    except Exception:
        # Deterministic fallback from action cues
        cues = _dedupe_cues(
            _extract_timed_cues(actions, anchors)
            + [c for seg in segments for c in _extract_timed_cues(seg, anchors)]
        )
        payload = {
            "title": None,
            "ingredients": [],
            "timed_method": [
                {"at": format_mmss(t) if t is not None else None, "instruction": i}
                for t, i in cues
            ],
            "notes": None,
        }
        if ingredients:
            payload["notes"] = f"Ingredient scout:\n{ingredients}"

    if not isinstance(payload, dict):
        return None

    payload = _apply_authoritative_times(
        payload, actions=actions, segments=segments, anchors=anchors
    )
    formatted = _format_reconciled(payload, anchors=anchors)
    return formatted or None


def analyze_frames_multi_agent(
    frames: list[Path],
    *,
    duration: Optional[float] = None,
    frame_times: Optional[list[float]] = None,
    max_frames: Optional[int] = None,
    caption: Optional[str] = None,
) -> Optional[str]:
    """Run multi-agent vision that watches the video; caption is a cross-check."""
    profile = resolve_vision_quality()
    limit = max_frames or profile.max_frames
    selected = frames[:limit]
    if not selected:
        return None

    times = resolve_frame_times(len(selected), duration, frame_times)
    anchors = [float(t) for t in times if t is not None]
    seg_size = max(2, int(profile.segment_frames))
    overlap = max(0, int(profile.segment_overlap))
    chunks = _chunk_indices(len(selected), seg_size, overlap)
    max_segments = max(2, int(profile.max_segments))
    if len(chunks) > max_segments:
        step = len(chunks) / max_segments
        chunks = [chunks[int(i * step)] for i in range(max_segments)]

    workers = max(1, int(profile.max_workers))
    segment_notes: list[Optional[str]] = [None] * len(chunks)
    ocr_text: Optional[str] = None
    ingredient_text: Optional[str] = None
    action_text: Optional[str] = None

    def _segment_job(i: int, start: int, end: int) -> tuple[str, int, Optional[str]]:
        return (
            "segment",
            i,
            _run_segment(i + 1, selected[start:end], times[start:end], caption),
        )

    specialist_cap = max(4, int(profile.vision_max_frames))
    if len(selected) <= specialist_cap:
        specialist_frames = selected
        specialist_times = times
    else:
        idxs = [
            int(round(i * (len(selected) - 1) / (specialist_cap - 1)))
            for i in range(specialist_cap)
        ]
        seen: set[int] = set()
        uniq: list[int] = []
        for i in idxs:
            if i not in seen:
                seen.add(i)
                uniq.append(i)
        specialist_frames = [selected[i] for i in uniq]
        specialist_times = [times[i] for i in uniq]

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [
            pool.submit(_segment_job, i, start, end) for i, (start, end) in enumerate(chunks)
        ]
        futures.append(
            pool.submit(lambda: ("ocr", -1, _run_ocr(specialist_frames, specialist_times, caption)))
        )
        futures.append(
            pool.submit(
                lambda: (
                    "ingredients",
                    -1,
                    _run_ingredient_scout(specialist_frames, specialist_times, caption),
                )
            )
        )
        futures.append(
            pool.submit(
                lambda: (
                    "actions",
                    -1,
                    _run_action_timeline(specialist_frames, specialist_times, caption),
                )
            )
        )

        for fut in as_completed(futures):
            try:
                kind, idx, text = fut.result()
            except Exception:
                continue
            if kind == "segment" and 0 <= idx < len(segment_notes):
                segment_notes[idx] = text
            elif kind == "ocr":
                ocr_text = text
            elif kind == "ingredients":
                ingredient_text = text
            elif kind == "actions":
                action_text = text

    segments = [s for s in segment_notes if s]
    reconciled = _reconcile(
        duration=duration,
        caption=caption,
        segments=segments,
        ocr=ocr_text,
        ingredients=ingredient_text,
        actions=action_text,
        anchors=anchors,
    )
    if reconciled and "no recipe content detected" not in reconciled.lower():
        return reconciled
    return None
