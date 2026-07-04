from __future__ import annotations

import io
import time
import uuid
from pathlib import Path
from typing import Optional

import boto3
import httpx

from ingest_lib.config import settings

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


def _frame_bytes(path: Path, max_width: int = 768) -> bytes:
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


def analyze_frames_for_recipe(frames: list[Path], *, max_frames: Optional[int] = None) -> Optional[str]:
    if not settings.feature_ai_enabled or not frames:
        return None

    selected = frames[: max_frames or settings.social_vision_max_frames]
    if not selected:
        return None

    content: list[dict] = [{"text": VISION_PROMPT}]
    for frame in selected:
        content.append(
            {
                "image": {
                    "format": "jpeg",
                    "source": {"bytes": _frame_bytes(frame)},
                }
            }
        )

    try:
        client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
        response = client.converse(
            modelId=settings.bedrock_vision_model,
            messages=[{"role": "user", "content": content}],
            inferenceConfig={"maxTokens": 1500, "temperature": 0.2},
        )
        text_parts: list[str] = []
        for block in response.get("output", {}).get("message", {}).get("content", []):
            if isinstance(block, dict) and block.get("text"):
                text_parts.append(str(block["text"]))
        text = "\n".join(text_parts).strip()
    except Exception:
        return None

    if not text or "no recipe content detected" in text.lower():
        return None
    return text


def transcribe_audio_file(audio_path: Path) -> Optional[str]:
    bucket = settings.ingest_temp_bucket
    if not bucket or not settings.feature_ai_enabled or not audio_path.is_file():
        return None

    key = f"transcribe/{uuid.uuid4()}{audio_path.suffix.lower() or '.m4a'}"
    s3 = boto3.client("s3", region_name=settings.aws_region)
    transcribe = boto3.client("transcribe", region_name=settings.aws_region)
    job_name = f"ycm-{uuid.uuid4().hex[:16]}"

    try:
        s3.upload_file(str(audio_path), bucket, key)
        media_uri = f"s3://{bucket}/{key}"
        transcribe.start_transcription_job(
            TranscriptionJobName=job_name,
            Media={"MediaFileUri": media_uri},
            MediaFormat=audio_path.suffix.lower().lstrip(".") or "mp4",
            LanguageCode="en-US",
        )

        for _ in range(120):
            job = transcribe.get_transcription_job(TranscriptionJobName=job_name)
            status = job["TranscriptionJob"]["TranscriptionJobStatus"]
            if status == "COMPLETED":
                transcript_uri = job["TranscriptionJob"]["Transcript"]["TranscriptFileUri"]
                payload = httpx.get(transcript_uri, timeout=30).json()
                text = (
                    payload.get("results", {})
                    .get("transcripts", [{}])[0]
                    .get("transcript", "")
                    .strip()
                )
                return text if len(text) >= 12 else None
            if status == "FAILED":
                return None
            time.sleep(2)
    except Exception:
        return None
    finally:
        try:
            s3.delete_object(Bucket=bucket, Key=key)
            transcribe.delete_transcription_job(TranscriptionJobName=job_name)
        except Exception:
            pass
    return None
