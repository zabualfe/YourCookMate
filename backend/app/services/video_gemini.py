"""Native Gemini / Vertex video understanding for cooking-video ingest.

Sends the cached mp4 (not sparse JPEG stills) so the model can watch motion,
heat, pours, and seasoning in context — closer to a human watching the clip.
"""

from __future__ import annotations

import mimetypes
import time
from pathlib import Path
from typing import Optional

from app.config import settings

GEMINI_VIDEO_PROMPT = """You are watching a cooking video (TikTok / Reel / Short / YouTube clip).

Your job is to WATCH the video and write a cookbook research brief.

{caption_block}

Rules:
1. Prefer what you SEE and HEAR in the video over the caption when they describe the same moment.
2. Use the caption to name spices/ingredients you can see and to keep the correct dish identity.
3. DROP TikTok hooks/outros — finished plated food being eaten at the START is NOT step 1 when the caption is a from-scratch cook.
4. Cover early prep through finish. Do not start mid-recipe.
5. One clear action per timed-method line. Split separate seasoning powders when you can see them applied separately.
6. Do not invent foods or moves that are neither visible nor in the caption.
7. Use clear, universal cookbook English for ingredient names and timed-method lines — no slang, dialect, or local-only nicknames. Prefer widely recognized grocery names (e.g. eggplant not aubergine; ground meat not mince; green onion/scallion for spring onion).

Return plain text only — no JSON. Use these sections:

Title
<dish name>

Ingredients
- quantity name
(include [m:ss] when the item is first clearly used/shown, if you can)

Timed method
[m:ss] imperative cooking action
(one action per line, chronological; use approximate video clock times)

Editor notes
<optional tips / doneness cues>

If there is no recipe content, say "No recipe content detected in video." """


def gemini_video_configured() -> bool:
    if not settings.feature_ai_enabled:
        return False
    if (settings.gemini_api_key or "").strip():
        return True
    project = (settings.google_cloud_project or settings.google_key or "").strip()
    return bool(project)


def _caption_block(caption: Optional[str]) -> str:
    text = (caption or "").strip()
    if not text:
        return "No creator caption provided — rely entirely on the video."
    if len(text) > 3500:
        text = text[:3500] + "\n…"
    return (
        "CREATOR CAPTION (cross-check for dish identity, listed spices/quantities):\n"
        f"{text}"
    )


def _mime_for_video(path: Path) -> str:
    guessed, _ = mimetypes.guess_type(str(path))
    if guessed and guessed.startswith("video/"):
        return guessed
    suffix = path.suffix.lower()
    return {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mov": "video/quicktime",
        ".mkv": "video/x-matroska",
    }.get(suffix, "video/mp4")


def _client():
    from google import genai

    api_key = (settings.gemini_api_key or "").strip()
    if api_key:
        return genai.Client(api_key=api_key)

    project = (settings.google_cloud_project or settings.google_key or "").strip()
    location = (settings.vertex_location or "us-central1").strip()
    if not project:
        raise RuntimeError("Gemini video requires GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT")
    return genai.Client(vertexai=True, project=project, location=location)


def _wait_for_file(client, uploaded, *, timeout_seconds: float = 180.0):
    """Poll File API until the uploaded video is ACTIVE."""
    deadline = time.time() + timeout_seconds
    file_obj = uploaded
    name = getattr(file_obj, "name", None)
    while time.time() < deadline:
        state = getattr(file_obj, "state", None)
        state_name = getattr(state, "name", None) or str(state or "")
        if state_name in {"ACTIVE", "FileState.ACTIVE"} or state_name.endswith("ACTIVE"):
            return file_obj
        if state_name in {"FAILED", "FileState.FAILED"} or state_name.endswith("FAILED"):
            raise RuntimeError(f"Gemini file processing failed: {state_name}")
        time.sleep(2.0)
        if not name:
            break
        file_obj = client.files.get(name=name)
    raise TimeoutError("Timed out waiting for Gemini to process the uploaded video")


def analyze_video_with_gemini(
    video_path: Path,
    *,
    duration: Optional[float] = None,
    caption: Optional[str] = None,
) -> Optional[str]:
    """Watch a cooking mp4 with Gemini and return a VIDEO OBSERVATIONS-style brief."""
    if not gemini_video_configured():
        return None
    if not video_path.is_file():
        return None

    from google.genai import types

    client = _client()
    model = (settings.gemini_vision_model or "gemini-3.5-flash").strip()
    prompt = GEMINI_VIDEO_PROMPT.format(caption_block=_caption_block(caption))
    if duration and duration > 0:
        prompt = f"Video duration is about {duration:.1f} seconds.\n\n{prompt}"

    mime = _mime_for_video(video_path)
    size = video_path.stat().st_size
    # Inline is fine for short TikToks; File API for larger downloads.
    use_file_api = size > 15 * 1024 * 1024 or not (settings.gemini_api_key or "").strip()

    uploaded_name: Optional[str] = None
    try:
        if use_file_api and (settings.gemini_api_key or "").strip():
            uploaded = client.files.upload(file=str(video_path))
            uploaded = _wait_for_file(client, uploaded)
            uploaded_name = getattr(uploaded, "name", None)
            video_part = types.Part.from_uri(
                file_uri=uploaded.uri,
                mime_type=getattr(uploaded, "mime_type", None) or mime,
            )
        else:
            video_part = types.Part.from_bytes(
                data=video_path.read_bytes(),
                mime_type=mime,
            )

        response = client.models.generate_content(
            model=model,
            contents=[
                types.Content(
                    role="user",
                    parts=[types.Part.from_text(text=prompt), video_part],
                )
            ],
            config=types.GenerateContentConfig(
                temperature=0.2,
                max_output_tokens=4096,
            ),
        )
    finally:
        if uploaded_name and (settings.gemini_api_key or "").strip():
            try:
                client.files.delete(name=uploaded_name)
            except Exception:
                pass

    text = (getattr(response, "text", None) or "").strip()
    if not text:
        # Some SDK shapes put text only on candidates
        try:
            candidates = getattr(response, "candidates", None) or []
            parts = candidates[0].content.parts if candidates else []
            text = "".join(getattr(p, "text", "") or "" for p in parts).strip()
        except Exception:
            text = ""

    if not text or "no recipe content detected" in text.lower():
        return None
    return text
