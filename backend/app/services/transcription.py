from __future__ import annotations

import time
import uuid
from pathlib import Path
from typing import Optional

import httpx

from app.config import settings
from app.services.transcript_format import (
    format_timestamped_transcript,
    format_transcribe_payload,
)

_WHISPER_PROMPT = (
    "Cooking recipe video. Transcribe ingredients, quantities, temperatures, "
    "and step-by-step cooking instructions clearly."
)


def resolve_transcribe_provider() -> Optional[str]:
    """Return 'aws' or 'openai' for speech-to-text, or None if unavailable."""
    from app.services.feature_flags import ai_allowed, aws_transcribe_allowed

    if not ai_allowed():
        return None

    preferred = (settings.transcribe_provider or "auto").strip().lower()
    aws_ok = aws_transcribe_allowed() and _aws_transcribe_ready()
    openai_ok = _openai_ready()

    if preferred == "aws":
        return "aws" if aws_ok else ("openai" if openai_ok else None)
    if preferred == "openai":
        return "openai" if openai_ok else ("aws" if aws_ok else None)

    # auto: use AWS when the feature flag is on and bucket+creds exist, else OpenAI
    if aws_ok:
        return "aws"
    if openai_ok:
        return "openai"
    return None


def _openai_ready() -> bool:
    return bool(settings.openai_api_key)


def _aws_transcribe_ready() -> bool:
    if not settings.ingest_temp_bucket:
        return False
    try:
        import boto3

        session = boto3.Session(region_name=settings.aws_region)
        return session.get_credentials() is not None
    except Exception:
        return False


def transcribe_audio_file(audio_path: Path) -> Optional[str]:
    """Transcribe a local audio file into a `[m:ss] line` transcript."""
    from app.services.feature_flags import ai_allowed

    if not ai_allowed() or not audio_path.is_file():
        return None

    provider = resolve_transcribe_provider()
    if provider == "aws":
        text = _aws_transcribe(audio_path)
        if text:
            return text
        # Fall back to OpenAI if AWS failed but a key is present.
        if _openai_ready():
            return _openai_transcribe(audio_path)
        return None
    if provider == "openai":
        return _openai_transcribe(audio_path)
    return None


def _openai_transcribe(audio_path: Path) -> Optional[str]:
    if not settings.openai_api_key:
        return None
    try:
        from openai import OpenAI
    except ImportError:
        return None

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        with audio_path.open("rb") as audio_file:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="verbose_json",
                prompt=_WHISPER_PROMPT,
            )
    except Exception:
        return None

    text = format_timestamped_transcript(result)
    if not text or len(text) < 12:
        return None
    return text


def _aws_transcribe(audio_path: Path) -> Optional[str]:
    """Upload to S3, run Amazon Transcribe with language ID, return timestamped text."""
    bucket = settings.ingest_temp_bucket
    if not bucket:
        return None

    try:
        import boto3
    except ImportError:
        return None

    suffix = audio_path.suffix.lower() or ".m4a"
    media_format = suffix.lstrip(".") or "mp4"
    key = f"transcribe/{uuid.uuid4()}{suffix}"
    job_name = f"ycm-{uuid.uuid4().hex[:16]}"

    s3 = boto3.client("s3", region_name=settings.aws_region)
    transcribe = boto3.client("transcribe", region_name=settings.aws_region)

    job_kwargs: dict = {
        "TranscriptionJobName": job_name,
        "Media": {"MediaFileUri": f"s3://{bucket}/{key}"},
        "MediaFormat": media_format,
    }
    configured_lang = (settings.transcribe_language or "").strip()
    if configured_lang and configured_lang.lower() != "auto":
        job_kwargs["LanguageCode"] = configured_lang
    else:
        # Auto-detect; restrict to likely recipe languages to reduce mis-ID.
        job_kwargs["IdentifyLanguage"] = True
        job_kwargs["LanguageOptions"] = [
            "en-US",
            "es-US",
            "fr-FR",
            "it-IT",
            "de-DE",
            "pt-BR",
        ]

    try:
        s3.upload_file(str(audio_path), bucket, key)
        transcribe.start_transcription_job(**job_kwargs)

        max_attempts = int(settings.transcribe_max_wait_seconds / 1.5) + 1
        for attempt in range(max_attempts):
            job = transcribe.get_transcription_job(TranscriptionJobName=job_name)
            info = job["TranscriptionJob"]
            status = info["TranscriptionJobStatus"]
            if status == "COMPLETED":
                transcript_uri = info["Transcript"]["TranscriptFileUri"]
                payload = httpx.get(transcript_uri, timeout=30).json()
                text = format_transcribe_payload(payload)
                if text and len(text) >= 12:
                    return text
                return None
            if status == "FAILED":
                return None
            time.sleep(0.75 if attempt < 8 else 1.5)
    except Exception:
        return None
    finally:
        try:
            s3.delete_object(Bucket=bucket, Key=key)
        except Exception:
            pass
        try:
            transcribe.delete_transcription_job(TranscriptionJobName=job_name)
        except Exception:
            pass
    return None
