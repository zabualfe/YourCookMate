from __future__ import annotations

import base64
import io
from pathlib import Path
from typing import Optional

from openai import OpenAI

from app.config import settings

VISION_PROMPT = """These images are frames from a cooking video (Instagram reel, TikTok, YouTube, or similar).
The creator may not speak — the recipe might only appear as on-screen text or be shown visually.

Extract everything useful for a recipe:
1. Transcribe ANY on-screen text exactly (ingredient lists, measurements, step overlays, titles).
2. Describe cooking actions you see in order (e.g. "chop onions", "sauté in pan", "bake at 350°F").
3. List visible ingredients and amounts when shown or labeled.

Return plain text only — no JSON. Use sections if helpful:
- Title (if visible)
- Ingredients
- Steps / what happens in the video

If no recipe content is visible, say "No recipe content detected in video frames." """


def _frame_to_data_url(path: Path, max_width: int = 768) -> str:
    try:
        from PIL import Image
    except ImportError:
        data = path.read_bytes()
        encoded = base64.b64encode(data).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"

    with Image.open(path) as img:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((max_width, max(1, int(img.height * ratio))), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        encoded = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:image/jpeg;base64,{encoded}"


def analyze_frames_for_recipe(frames: list[Path], *, max_frames: Optional[int] = None) -> Optional[str]:
    """Run vision on already-extracted frame files."""
    if not settings.openai_api_key or not frames:
        return None

    selected = frames[: max_frames or settings.social_vision_max_frames]
    if not selected:
        return None

    content: list[dict] = [{"type": "text", "text": VISION_PROMPT}]
    for frame in selected:
        content.append(
            {
                "type": "image_url",
                "image_url": {"url": _frame_to_data_url(frame), "detail": "low"},
            }
        )

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_vision_model,
            messages=[{"role": "user", "content": content}],
            temperature=0.2,
            max_tokens=1500,
        )
    except Exception:
        return None

    text = (response.choices[0].message.content or "").strip()
    if not text or "no recipe content detected" in text.lower():
        return None
    return text
