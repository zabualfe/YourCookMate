from __future__ import annotations

from typing import Any, Optional


def format_mmss(seconds: float) -> str:
    total = max(0, int(round(float(seconds))))
    minutes, secs = divmod(total, 60)
    return f"{minutes}:{secs:02d}"


def parse_mmss(value: str | float | int | None) -> Optional[float]:
    """Parse `m:ss`, `mm:ss`, bare seconds, or null-ish into float seconds."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return max(0.0, float(value))
    text = str(value).strip().lower()
    if not text or text in {"null", "none", "n/a", "-"}:
        return None
    if text.startswith("[") and "]" in text:
        text = text.strip("[]")
    if ":" in text:
        parts = text.split(":")
        try:
            if len(parts) == 2:
                return max(0.0, int(parts[0]) * 60 + float(parts[1]))
            if len(parts) == 3:
                return max(
                    0.0,
                    int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2]),
                )
        except ValueError:
            return None
    try:
        return max(0.0, float(text))
    except ValueError:
        return None


def snap_to_nearest(seconds: float, anchors: list[float]) -> float:
    """Snap a time onto the nearest real frame PTS / anchor."""
    if not anchors:
        return round(float(seconds), 3)
    best = anchors[0]
    best_dist = abs(best - seconds)
    for t in anchors[1:]:
        dist = abs(t - seconds)
        if dist < best_dist:
            best = t
            best_dist = dist
    return round(float(best), 3)


def is_suspiciously_even(times: list[float]) -> bool:
    """True when times look like an invented evenly spaced grid (e.g. 15,18,21,23…)."""
    if len(times) < 5:
        return False
    ordered = sorted(float(t) for t in times)
    deltas = [ordered[i + 1] - ordered[i] for i in range(len(ordered) - 1)]
    deltas = [d for d in deltas if d > 0.05]
    if len(deltas) < 4:
        return False
    # Median gap is robust to one big outlier (e.g. hook at 0 then jump to prep).
    deltas_sorted = sorted(deltas)
    median = deltas_sorted[len(deltas_sorted) // 2]
    if median < 1.2 or median > 8.0:
        return False
    close = sum(1 for d in deltas if abs(d - median) <= max(0.75, 0.45 * median))
    return close >= max(4, int(0.65 * len(deltas)))


def format_timestamped_transcript(result: Any) -> Optional[str]:
    """Turn a Whisper verbose_json result into `[m:ss] line` transcript text."""
    segments = getattr(result, "segments", None)
    if segments is None and isinstance(result, dict):
        segments = result.get("segments")

    lines: list[str] = []
    if segments:
        for seg in segments:
            if isinstance(seg, dict):
                start = float(seg.get("start") or 0)
                text = str(seg.get("text") or "").strip()
            else:
                start = float(getattr(seg, "start", 0) or 0)
                text = str(getattr(seg, "text", "") or "").strip()
            if not text:
                continue
            lines.append(f"[{format_mmss(start)}] {text}")

    if lines:
        return "\n".join(lines)

    text = getattr(result, "text", None)
    if text is None and isinstance(result, dict):
        text = result.get("text")
    if isinstance(text, str) and text.strip():
        return text.strip()
    if isinstance(result, str) and result.strip():
        return result.strip()
    return None


def format_transcribe_payload(payload: Any, *, window_seconds: float = 8.0) -> Optional[str]:
    """Turn an Amazon Transcribe result JSON into `[m:ss] line` transcript text.

    Groups word-level items into sentences (on punctuation) or fixed time windows so we
    get precise start timestamps for step syncing.
    """
    if not isinstance(payload, dict):
        return None
    results = payload.get("results") or {}
    items = results.get("items") or []

    lines: list[str] = []
    current_words: list[str] = []
    segment_start: Optional[float] = None
    last_start: float = 0.0

    def flush() -> None:
        nonlocal current_words, segment_start
        if current_words and segment_start is not None:
            text = " ".join(current_words).strip()
            text = text.replace(" ,", ",").replace(" .", ".").replace(" ?", "?").replace(" !", "!")
            if text:
                lines.append(f"[{format_mmss(segment_start)}] {text}")
        current_words = []
        segment_start = None

    for item in items:
        if not isinstance(item, dict):
            continue
        alt = (item.get("alternatives") or [{}])[0]
        content = str(alt.get("content") or "").strip()
        if not content:
            continue

        if item.get("type") == "punctuation":
            if current_words:
                current_words[-1] = current_words[-1] + content
            if content in {".", "?", "!"}:
                flush()
            continue

        start_raw = item.get("start_time")
        try:
            start = float(start_raw) if start_raw is not None else last_start
        except (TypeError, ValueError):
            start = last_start
        last_start = start

        if segment_start is None:
            segment_start = start
        # Break long run-ons into time windows so timestamps stay useful.
        if start - segment_start >= window_seconds and current_words:
            flush()
            segment_start = start

        current_words.append(content)

    flush()

    if lines:
        return "\n".join(lines)

    transcripts = results.get("transcripts") or []
    if transcripts:
        text = str(transcripts[0].get("transcript") or "").strip()
        if text:
            return text
    return None
