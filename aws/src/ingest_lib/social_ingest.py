from __future__ import annotations

import re
import tempfile
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx

from ingest_lib.bedrock_vision import analyze_frames_for_recipe, transcribe_audio_file
from ingest_lib.config import settings
from ingest_lib.errors import IngestError
from ingest_lib.video_cache import (
    ensure_video_cached,
    get_cached_frames,
    get_cached_video,
)
from ingest_lib.video_frames import extract_audio_from_video

MIN_USEFUL_TEXT = 80
SHORT_FORM_PLATFORMS = frozenset({"instagram", "tiktok", "facebook", "pinterest"})
_LOGIN_REQUIRED_DETAIL = (
    "Could not access this post automatically. "
    "Paste the caption in the optional Caption field, then click Import again. "
    "For automatic fetch on the server, set YTDLP_COOKIES."
)

_ytdlp_cookies_cache_path: Optional[str] = None


def _ytdlp_cookie_file() -> Optional[str]:
    global _ytdlp_cookies_cache_path
    if not settings.ytdlp_cookies or not settings.ytdlp_cookies.strip():
        return None
    if _ytdlp_cookies_cache_path is None:
        path = Path(tempfile.gettempdir()) / "ytdlp_cookies.txt"
        path.write_text(settings.ytdlp_cookies.strip() + "\n", encoding="utf-8")
        _ytdlp_cookies_cache_path = str(path)
    return _ytdlp_cookies_cache_path


def _normalize_url(url: str) -> str:
    cleaned = url.strip()
    if not cleaned:
        raise IngestError("URL is required.")
    parsed = urlparse(cleaned if "://" in cleaned else f"https://{cleaned}")
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise IngestError("URL must start with http:// or https://")
    return parsed.geturl()


def classify_video_url(url: str) -> str:
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
    cookie_file = _ytdlp_cookie_file()
    if cookie_file:
        opts["cookiefile"] = cookie_file
    return opts


def _extract_with_ytdlp(url: str) -> dict:
    try:
        import yt_dlp
    except ImportError as exc:
        raise IngestError(
            "Video import is not available (yt-dlp missing on worker). "
            "Redeploy the AWS stack so the ingest worker includes requirements-worker.txt."
        ) from exc

    try:
        with yt_dlp.YoutubeDL(_ytdlp_options()) as ydl:
            return ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as exc:
        message = str(exc).lower()
        if "login" in message or "cookies" in message:
            raise IngestError(_LOGIN_REQUIRED_DETAIL) from exc
        if "blocked" in message or "ip address" in message:
            raise IngestError(
                "This platform blocked automatic fetch. Paste the video caption below and try again."
            ) from exc
        raise IngestError("Could not fetch this link. Check the URL or paste the caption manually.") from exc
    except IngestError:
        raise
    except Exception as exc:
        message = str(exc).lower()
        if "login" in message or "cookies" in message:
            raise IngestError(_LOGIN_REQUIRED_DETAIL) from exc
        if "blocked" in message or "ip address" in message:
            raise IngestError(
                "This platform blocked automatic fetch. Paste the video caption below and try again."
            ) from exc
        raise IngestError(
            "Could not fetch this link. Paste the caption manually if the video is private or region-locked."
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
        for entry in tracks.get(key) or []:
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


def _dedupe_title_description(
    title: Optional[str], description: Optional[str]
) -> tuple[Optional[str], Optional[str]]:
    if not title or not description:
        return title, description
    t, d = title.strip(), description.strip()
    if not t or not d:
        return title, description
    if t == d or (d.startswith(t) and len(d) > len(t) + 10) or (t in d and len(d) > len(t) + 10):
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


def _should_run_audio(
    source_type: str,
    merged: str,
    transcript: Optional[str],
    subtitle: Optional[str] = None,
) -> bool:
    if transcript is not None:
        return False
    if subtitle and len(subtitle.strip()) >= 20:
        return False
    return _needs_enrichment(merged, None)


def _should_run_visual(
    source_type: str,
    merged: str,
    transcript: Optional[str],
    subtitle: Optional[str] = None,
) -> bool:
    effective_transcript = transcript
    if not effective_transcript and subtitle and len(subtitle.strip()) >= 20:
        effective_transcript = subtitle
    return _needs_enrichment(merged, effective_transcript)


def _needs_video_processing(
    source_type: str,
    merged: str,
    transcript: Optional[str],
    subtitle: Optional[str] = None,
) -> bool:
    return _should_run_audio(source_type, merged, transcript, subtitle) or _should_run_visual(
        source_type, merged, transcript, subtitle
    )


def _ingest_frame_count() -> int:
    return max(1, settings.social_vision_max_frames)


def _run_audio_step(
    source_url: str,
    notes: list[str],
    *,
    video_path: Optional[Path] = None,
    max_audio_seconds: Optional[float] = None,
) -> Optional[str]:
    notes.append("Trying audio transcription (Amazon Transcribe)…")
    if video_path and video_path.is_file():
        with tempfile.TemporaryDirectory() as tmp:
            audio_path = Path(tmp) / "audio.m4a"
            if not extract_audio_from_video(video_path, audio_path, max_seconds=max_audio_seconds):
                notes.append("Could not extract audio from video.")
                return None
            transcript = transcribe_audio_file(audio_path)
    else:
        transcript = None

    if transcript:
        notes.append("Added spoken audio transcript.")
    elif not settings.feature_ai_enabled:
        notes.append("Audio transcription skipped (AI disabled).")
    elif not settings.ingest_temp_bucket:
        notes.append("Audio transcription skipped (temp bucket not configured).")
    else:
        notes.append("No speech detected or transcription failed.")
    return transcript


def _run_visual_step(source_url: str, notes: list[str], duration: Optional[float] = None) -> Optional[str]:
    notes.append("Analyzing video frames with Amazon Nova…")
    frames = get_cached_frames(source_url)
    if not frames:
        ensure_video_cached(
            source_url,
            _ytdlp_options,
            duration=duration,
            frame_count=_ingest_frame_count(),
        )
        frames = get_cached_frames(source_url)
    visual_text = analyze_frames_for_recipe(frames) if frames else None
    if visual_text:
        notes.append("Added visual analysis from the video.")
    elif not settings.feature_ai_enabled:
        notes.append("Video analysis skipped (AI disabled).")
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
    metadata_error: Optional[IngestError] = None
    try:
        info = _extract_with_ytdlp(source_url)
    except IngestError as exc:
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
        raw_duration = info.get("duration")
        duration = float(raw_duration) if isinstance(raw_duration, (int, float)) else None

    subtitle_text = _fetch_subtitle_text(info) if info else None
    if subtitle_text:
        notes.append("Added on-screen captions from the video.")

    merged = _merge_text_parts(title, description, subtitle_text, None, None)

    need_audio = _should_run_audio(source_type, merged, None, subtitle_text)
    need_visual = _should_run_visual(source_type, merged, None, subtitle_text)
    need_video = need_audio or need_visual

    if not need_video:
        notes.append("Caption looks complete — skipped video download and AI enrichment.")
    elif need_video:
        if get_cached_video(source_url):
            notes.append("Using cached video from this import session.")
        else:
            notes.append("Downloading video for transcription and visual analysis…")
        ensure_video_cached(
            source_url,
            _ytdlp_options,
            duration=duration,
            frame_count=_ingest_frame_count(),
        )

    cached_video = get_cached_video(source_url)
    transcript: Optional[str] = None
    visual_text: Optional[str] = None
    max_audio = 90.0 if source_type in SHORT_FORM_PLATFORMS else None

    if need_audio and need_visual:
        audio_notes: list[str] = []
        visual_notes: list[str] = []
        with ThreadPoolExecutor(max_workers=2) as pool:
            audio_future = pool.submit(
                _run_audio_step,
                source_url,
                audio_notes,
                video_path=cached_video,
                max_audio_seconds=max_audio,
            )
            visual_future = pool.submit(_run_visual_step, source_url, visual_notes, duration)
            transcript = audio_future.result()
            visual_text = visual_future.result()
        notes.extend(audio_notes)
        notes.extend(visual_notes)
    elif need_audio:
        if not subtitle_text and not description:
            notes.append("Caption looks incomplete — trying audio transcription…")
        transcript = _run_audio_step(
            source_url,
            notes,
            video_path=cached_video,
            max_audio_seconds=max_audio,
        )
    elif need_visual:
        visual_text = _run_visual_step(source_url, notes, duration)

    raw_text = _merge_text_parts(title, description, subtitle_text, transcript, visual_text)
    if not raw_text and metadata_error is not None:
        raise metadata_error

    if not raw_text:
        raise IngestError("No caption or transcript found. Paste the recipe caption below and try again.")

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
