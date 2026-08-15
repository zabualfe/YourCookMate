from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Optional

from app.config import settings
from app.services.llm import bedrock_vision_text, resolve_ai_provider
from app.services.transcript_format import format_mmss
from app.services.video_frames import sample_times_across_duration

# Kept for fallback single-pass analysis.
VISION_PROMPT = """These images are frames from a cooking video (Instagram reel, TikTok, YouTube, or similar).
Each frame is labeled with its EXACT seek time in the video — treat those times as ground truth for sequencing and timestamps.

Act like a cookbook researcher watching the video. Be exhaustive and accurate.

Extract:
1. On-screen text EXACTLY (ingredient lists, measurements, temperatures, step overlays, titles). Prefer OCR text over guesses.
2. A complete ingredient list with amounts whenever shown or spoken on-screen.
3. Chronological cooking actions — one action per line, each starting with the frame timestamp like [0:12]. Use the labeled frame time for that still. Include technique, heat, and doneness when visible.
4. Note any quantities that appear only briefly on screen.

Return plain text only — no JSON. Use sections:
- Title
- Ingredients (name + quantity; include [m:ss] when first shown)
- Timed method (one action per line, each starting with [m:ss] using the frame's labeled time)

If no recipe content is visible, say "No recipe content detected in video frames." """


def frame_jpeg_bytes(path: Path, max_width: int = 768) -> bytes:
    try:
        from PIL import Image
    except ImportError:
        return path.read_bytes()

    with Image.open(path) as img:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((max_width, max(1, int(img.height * ratio))), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue()


def _frame_to_data_url(path: Path, max_width: int = 768) -> str:
    encoded = base64.b64encode(frame_jpeg_bytes(path, max_width=max_width)).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def resolve_frame_times(
    count: int,
    duration: Optional[float],
    frame_times: Optional[list[float]],
) -> list[Optional[float]]:
    if frame_times and len(frame_times) >= count:
        return [float(t) for t in frame_times[:count]]
    if duration and duration > 0 and count > 0:
        return sample_times_across_duration(float(duration), count)
    return [None] * count


def run_vision_prompt(
    frames: list[Path],
    times: list[Optional[float]],
    prompt: str,
    *,
    max_tokens: int = 1800,
) -> Optional[str]:
    """Run a custom vision prompt against labeled frames (Bedrock or OpenAI)."""
    if not frames:
        return None

    preferred = resolve_ai_provider()
    if preferred is None:
        return None

    order: list[str] = [preferred]
    for candidate in ("openai", "bedrock"):
        if candidate not in order:
            order.append(candidate)

    # Pad / trim times to match frames.
    aligned: list[Optional[float]] = []
    for i in range(len(frames)):
        aligned.append(times[i] if i < len(times) else None)

    for name in order:
        try:
            if name == "bedrock":
                from app.services.llm import _bedrock_usable

                if not _bedrock_usable():
                    continue
                images = [frame_jpeg_bytes(frame) for frame in frames]
                labels = [prompt, ""]
                for index, t in enumerate(aligned):
                    if t is not None:
                        labels.append(
                            f"Frame {index + 1} (EXACT time {format_mmss(t)} / {t:.1f}s) follows."
                        )
                    else:
                        labels.append(f"Frame {index + 1} follows.")
                text = bedrock_vision_text(
                    prompt="\n".join(labels),
                    images_jpeg=images,
                    max_tokens=max_tokens,
                )
                if text:
                    return text
                continue

            if name == "openai":
                from app.services.llm import _openai_usable

                if not _openai_usable():
                    continue
                from openai import OpenAI

                content: list[dict] = [{"type": "text", "text": prompt}]
                for index, (frame, t) in enumerate(zip(frames, aligned)):
                    label = (
                        f"Frame {index + 1} (EXACT time {format_mmss(t)} / {t:.1f}s):"
                        if t is not None
                        else f"Frame {index + 1}:"
                    )
                    content.append({"type": "text", "text": label})
                    content.append(
                        {
                            "type": "image_url",
                            "image_url": {"url": _frame_to_data_url(frame), "detail": "high"},
                        }
                    )
                client = OpenAI(api_key=settings.openai_api_key)
                response = client.chat.completions.create(
                    model=settings.openai_vision_model,
                    messages=[{"role": "user", "content": content}],
                    temperature=0,
                    max_tokens=max_tokens,
                )
                text = (response.choices[0].message.content or "").strip()
                if text:
                    return text
        except Exception:
            continue
    return None


def analyze_frames_single_pass(
    frames: list[Path],
    *,
    max_frames: Optional[int] = None,
    duration: Optional[float] = None,
    frame_times: Optional[list[float]] = None,
    caption: Optional[str] = None,
) -> Optional[str]:
    """Legacy single-model vision pass over the whole strip of frames."""
    from app.services.vision_quality import resolve_vision_quality

    profile = resolve_vision_quality()
    limit = max_frames or profile.vision_max_frames
    selected = frames[:limit]
    if not selected:
        return None
    times = resolve_frame_times(len(selected), duration, frame_times)
    prompt = VISION_PROMPT
    if caption and caption.strip():
        prompt = (
            VISION_PROMPT
            + "\n\nCREATOR CAPTION (cross-check reference — WATCH the frames first):\n"
            + caption.strip()[:3500]
        )
    text = run_vision_prompt(selected, times, prompt, max_tokens=2500)
    if not text or "no recipe content detected" in text.lower():
        return None
    return text


def analyze_frames_for_recipe(
    frames: list[Path],
    *,
    max_frames: Optional[int] = None,
    duration: Optional[float] = None,
    frame_times: Optional[list[float]] = None,
    caption: Optional[str] = None,
) -> Optional[str]:
    """Analyze cooking-video frames. Prefers multi-agent pipeline when enabled."""
    if not frames:
        return None

    from app.services.feature_flags import ai_allowed

    if not ai_allowed():
        return None

    if resolve_ai_provider() is None:
        return None

    if settings.social_vision_multi_agent:
        from app.services.video_agents import analyze_frames_multi_agent

        multi = analyze_frames_multi_agent(
            frames,
            duration=duration,
            frame_times=frame_times,
            max_frames=max_frames,
            caption=caption,
        )
        if multi:
            return multi

    return analyze_frames_single_pass(
        frames,
        max_frames=max_frames,
        duration=duration,
        frame_times=frame_times,
        caption=caption,
    )
