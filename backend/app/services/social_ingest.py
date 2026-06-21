from __future__ import annotations

import re
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.services.video_cache import (
    ensure_video_cached,
    get_cached_frames,
    get_cached_video,
    transcribe_cached_video,
)
from app.services.video_vision import analyze_frames_for_recipe

MIN_USEFUL_TEXT = 80
_WHISPER_EXTENSIONS = {".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".wav", ".webm"}
# Short-form platforms: silent reels with on-screen text are common — always analyze video.
SHORT_FORM_PLATFORMS = frozenset({"instagram", "tiktok", "facebook", "pinterest"})


def _normalize_url(url: str) -> str:
    cleaned = url.strip()
    if not cleaned:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="URL is required.")
    parsed = urlparse(cleaned if "://" in cleaned else f"https://{cleaned}")
    if parsed.scheme not in {"http", "https"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="URL must start with http:// or https://")
    if not parsed.netloc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid URL.")
    return parsed.geturl()


def classify_video_url(url: str) -> str:
    """Detect platform from URL. Any http(s) link is accepted as a generic video."""
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")

    if host in {"instagram.com", "instagr.am"}:
        return "instagram"
    if host.endswith("tiktok.com") or host in {"vm.tiktok.com", "vt.tiktok.com"}:
        return "tiktok"
    if host in {"youtube.com", "m.youtube.com", "music.youtube.com"} or host == "youtu.be":
        return "youtube"
    if host in {"facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch", "fb.com"}:
        return "facebook"
    if "pinterest.com" in host or host == "pin.it":
        return "pinterest"
    if host in {"vimeo.com", "player.vimeo.com"}:
        return "vimeo"

    return "video"


def _content_words(text: str) -> list[str]:
    without_tags = re.sub(r"[@#]\w+", " ", text)
    return re.findall(r"[a-zA-Z']+", without_tags)


def _looks_like_recipe(text: str) -> bool:
    lowered = text.lower()
    signals = (
        "ingredient",
        "step",
        "tbsp",
        "tsp",
        "cup",
        "cook",
        "bake",
        "mix",
        "serve",
        "oven",
        "minute",
        "you need",
        "add ",
        "heat ",
        "boil",
        "stir",
        "chop",
        "tablespoon",
        "teaspoon",
        "sauté",
        "saute",
        "visual observations",
        "from the video",
    )
    word_count = len(_content_words(text))
    return any(word in lowered for word in signals) or word_count >= 35


def _confidence_for_text(text: str, had_transcript: bool, had_vision: bool) -> float:
    score = 0.35
    if len(text) >= MIN_USEFUL_TEXT:
        score += 0.25
    if _looks_like_recipe(text):
        score += 0.25
    if had_transcript:
        score += 0.1
    if had_vision:
        score += 0.15
    return min(score, 1.0)


def _ytdlp_options(**extra: object) -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 45,
        **extra,
    }
    if settings.ytdlp_cookies_file:
        opts["cookiefile"] = settings.ytdlp_cookies_file
    return opts


def _extract_with_ytdlp(url: str) -> dict:
    try:
        import yt_dlp
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Video import is not available (yt-dlp missing on server).",
        ) from exc

    try:
        with yt_dlp.YoutubeDL(_ytdlp_options()) as ydl:
            return ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        message = str(exc)
        if "login" in message.lower() or "cookies" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Could not access this post automatically. "
                    "Paste the caption below, or set YTDLP_COOKIES_FILE in backend/.env for Instagram/Facebook."
                ),
            ) from exc
        if "blocked" in message.lower() or "ip address" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="This platform blocked automatic fetch. Paste the video caption below and try again.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not fetch this link. Check the URL or paste the caption manually.",
        ) from exc
    except Exception as exc:
        message = str(exc).lower()
        if "login" in message or "cookies" in message:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=(
                    "Could not access this post automatically. "
                    "Paste the caption below, or set YTDLP_COOKIES_FILE in backend/.env for Instagram/Facebook."
                ),
            ) from exc
        if "blocked" in message or "ip address" in message:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="This platform blocked automatic fetch. Paste the video caption below and try again.",
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Could not fetch this link. Paste the caption manually if the video is private or region-locked.",
        ) from exc


def _parse_vtt(content: str) -> str:
    lines: list[str] = []
    for line in content.splitlines():
        line = line.strip()
        if not line or line.startswith("WEBVTT") or "-->" in line or line.isdigit():
            continue
        if line.startswith("NOTE"):
            continue
        cleaned = re.sub(r"<[^>]+>", "", line).strip()
        if cleaned:
            lines.append(cleaned)
    return " ".join(lines).strip()


def _fetch_subtitle_text(info: dict) -> Optional[str]:
    tracks = {}
    tracks.update(info.get("automatic_captions") or {})
    tracks.update(info.get("subtitles") or {})

    preferred = ["en", "en-US", "en-orig", "en-US-orig", "a.en", "en-GB"]
    ordered_keys = preferred + [key for key in tracks if key not in preferred]

    for key in ordered_keys:
        entries = tracks.get(key) or []
        for entry in entries:
            url = entry.get("url")
            if not url:
                continue
            try:
                response = httpx.get(url, timeout=20, follow_redirects=True)
                response.raise_for_status()
                text = _parse_vtt(response.text)
                if len(text) >= 20:
                    return text
            except Exception:
                continue
    return None


def _description_from_info(info: dict) -> str:
    for key in ("description", "caption", "alt_title", "fulltitle"):
        value = info.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _transcribe_audio(url: str) -> Optional[str]:
    if not settings.openai_api_key:
        return None

    try:
        import yt_dlp
        from openai import OpenAI
    except ImportError:
        return None

    with tempfile.TemporaryDirectory() as tmp:
        out_path = str(Path(tmp) / "audio.%(ext)s")
        opts = _ytdlp_options(
            skip_download=False,
            format="bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio/best",
            outtmpl=out_path,
            postprocessors=[],
        )
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
        except Exception:
            return None

        audio_files = [
            path
            for path in Path(tmp).glob("audio.*")
            if path.suffix.lower() in _WHISPER_EXTENSIONS and path.stat().st_size > 0
        ]
        if not audio_files:
            return None

        client = OpenAI(api_key=settings.openai_api_key)
        with audio_files[0].open("rb") as audio_file:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )
        text = (result if isinstance(result, str) else getattr(result, "text", "")).strip()
        if len(text) < 12:
            return None
        return text


def _dedupe_title_description(title: Optional[str], description: Optional[str]) -> tuple[Optional[str], Optional[str]]:
    if not title or not description:
        return title, description

    t = title.strip()
    d = description.strip()
    if not t or not d:
        return title, description
    if t == d:
        return None, d
    if d.startswith(t) and len(d) > len(t) + 10:
        return None, d
    if t in d and len(d) > len(t) + 10:
        return None, d
    return t, d


def _merge_text_parts(
    title: Optional[str],
    description: Optional[str],
    subtitle: Optional[str],
    transcript: Optional[str],
    visual: Optional[str],
) -> str:
    title, description = _dedupe_title_description(title, description)
    parts: list[str] = []
    generic_titles = {"video", "instagram reel", "tiktok", "untitled", "reel", "instagram"}

    if title and title.lower() not in generic_titles:
        parts.append(title.strip())
    if description and description.strip():
        parts.append(description.strip())
    if subtitle and subtitle.strip():
        parts.append("On-screen captions:\n" + subtitle.strip())
    if transcript and transcript.strip():
        parts.append("Spoken instructions:\n" + transcript.strip())
    if visual and visual.strip():
        parts.append("From the video (visual analysis):\n" + visual.strip())
    return "\n\n".join(parts).strip()


def _needs_enrichment(merged: str, transcript: Optional[str]) -> bool:
    if len(merged) < MIN_USEFUL_TEXT:
        return True
    if not _looks_like_recipe(merged):
        return True
    if transcript is not None and len(transcript) < 20:
        return True
    return False


def _should_run_audio(source_type: str, merged: str, transcript: Optional[str]) -> bool:
    if transcript is not None:
        return False
    if source_type in SHORT_FORM_PLATFORMS:
        return True
    return _needs_enrichment(merged, None)


def _should_run_visual(source_type: str, merged: str, transcript: Optional[str]) -> bool:
    if source_type in SHORT_FORM_PLATFORMS:
        return True
    return _needs_enrichment(merged, transcript)


def _needs_video_processing(source_type: str, merged: str, transcript: Optional[str]) -> bool:
    return _should_run_audio(source_type, merged, transcript) or _should_run_visual(
        source_type, merged, transcript
    )


def _prepare_video_cache(
    source_url: str,
    source_type: str,
    merged: str,
    transcript: Optional[str],
    duration: Optional[float],
    notes: list[str],
) -> None:
    if not _needs_video_processing(source_type, merged, transcript):
        return
    if get_cached_video(source_url):
        notes.append("Using cached video from this import session.")
    else:
        notes.append("Downloading video once for transcription and visual analysis…")
    ensure_video_cached(
        source_url,
        _ytdlp_options,
        duration=duration,
        frame_count=settings.social_step_max_frames,
    )


def _run_audio_step(
    source_url: str,
    notes: list[str],
    *,
    video_path: Optional[Path] = None,
) -> Optional[str]:
    notes.append("Trying audio transcription from the video…")
    if video_path and video_path.is_file():
        transcript = transcribe_cached_video(video_path)
    else:
        transcript = _transcribe_audio(source_url)
    if transcript:
        notes.append("Added spoken audio transcript.")
    elif not settings.openai_api_key:
        notes.append("Audio transcription skipped (OPENAI_API_KEY not set).")
    else:
        notes.append("No speech detected or could not transcribe audio.")
    return transcript


def _run_visual_step(
    source_url: str,
    notes: list[str],
    duration: Optional[float] = None,
) -> Optional[str]:
    notes.append("Analyzing video frames for on-screen text and cooking steps…")
    frames = get_cached_frames(source_url)
    if frames:
        visual_text = analyze_frames_for_recipe(frames)
    else:
        cached = ensure_video_cached(
            source_url,
            _ytdlp_options,
            duration=duration,
            frame_count=settings.social_step_max_frames,
        )
        if cached:
            frames = get_cached_frames(source_url)
            visual_text = analyze_frames_for_recipe(frames) if frames else None
        else:
            visual_text = None
    if visual_text:
        notes.append("Added visual analysis from the video (text overlays and actions).")
    elif not settings.openai_api_key:
        notes.append("Video analysis skipped (OPENAI_API_KEY not set).")
    else:
        notes.append("Could not analyze video frames — paste the caption manually if needed.")
    return visual_text


def ingest_social_link(url: str, manual_caption: Optional[str] = None) -> dict:
    source_url = _normalize_url(url)
    source_type = classify_video_url(source_url)
    notes: list[str] = []

    if manual_caption and manual_caption.strip():
        raw_text = manual_caption.strip()
        notes.append("Used caption you provided.")
        return {
            "raw_text": raw_text,
            "source_type": source_type,
            "source_url": source_url,
            "title": None,
            "author": None,
            "thumbnail_url": None,
            "video_duration": None,
            "extraction_notes": notes,
            "confidence": _confidence_for_text(raw_text, had_transcript=False, had_vision=False),
        }

    info: Optional[dict] = None
    metadata_error: Optional[HTTPException] = None
    try:
        info = _extract_with_ytdlp(source_url)
    except HTTPException as exc:
        metadata_error = exc
        notes.append("Could not read link metadata — trying direct video download instead.")

    title: Optional[str] = None
    description = ""
    author: Optional[str] = None
    thumbnail_url: Optional[str] = None
    duration: Optional[float] = None

    if info:
        title = info.get("title") or info.get("fulltitle")
        description = _description_from_info(info)
        author = info.get("uploader") or info.get("channel") or info.get("creator")
        thumbnail_url = info.get("thumbnail")
        duration = info.get("duration")
        if isinstance(duration, (int, float)):
            duration = float(duration)
        else:
            duration = None

    subtitle_text = _fetch_subtitle_text(info) if info else None
    if subtitle_text:
        notes.append("Added on-screen captions from the video.")

    transcript: Optional[str] = None
    visual_text: Optional[str] = None
    merged = _merge_text_parts(title, description, subtitle_text, None, None)

    _prepare_video_cache(source_url, source_type, merged, None, duration, notes)
    cached_video = get_cached_video(source_url)

    if _should_run_audio(source_type, merged, None):
        if not subtitle_text and not description:
            notes.append("Caption looks incomplete — trying audio transcription…")
        transcript = _run_audio_step(source_url, notes, video_path=cached_video)

    merged = _merge_text_parts(title, description, subtitle_text, transcript, None)

    if _should_run_visual(source_type, merged, transcript):
        visual_text = _run_visual_step(source_url, notes, duration)

    raw_text = _merge_text_parts(title, description, subtitle_text, transcript, visual_text)
    if not raw_text and metadata_error is not None:
        raise metadata_error

    if not raw_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No caption or transcript found. Paste the recipe caption below and try again.",
        )

    if not _looks_like_recipe(raw_text):
        notes.append(
            "Extracted text may not contain a full recipe — edit it or paste the caption before parsing."
        )

    return {
        "raw_text": raw_text,
        "source_type": source_type,
        "source_url": source_url,
        "title": title,
        "author": author,
        "thumbnail_url": thumbnail_url,
        "video_duration": duration,
        "extraction_notes": notes,
        "confidence": _confidence_for_text(
            raw_text,
            had_transcript=bool(transcript),
            had_vision=bool(visual_text),
        ),
    }


# Backwards-compatible alias
classify_social_url = classify_video_url
