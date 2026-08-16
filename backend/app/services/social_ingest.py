from __future__ import annotations

import logging
import re
import tempfile
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.services.feature_flags import ai_allowed
from app.services.link_metadata import resolve_public_url, webpage_fallback_info
from app.services.video_cache import (
    ensure_video_cached,
    get_cached_frames,
    get_cached_frame_times,
    get_cached_video,
    transcribe_cached_video,
)
from app.services.video_vision import analyze_frames_for_recipe

logger = logging.getLogger(__name__)

MIN_USEFUL_TEXT = 80
_WHISPER_EXTENSIONS = {".m4a", ".mp3", ".mp4", ".mpeg", ".mpga", ".wav", ".webm"}
# Short-form platforms: silent reels with on-screen text are common — always analyze video.
SHORT_FORM_PLATFORMS = frozenset({"instagram", "tiktok", "facebook", "pinterest"})

_LOGIN_REQUIRED_DETAIL = (
    "Could not access this post automatically (login/cookies required). "
    "Paste the caption in the Caption field above, then try again. "
    "To refresh automatic fetch locally, run: npm run export:cookies"
)

_ytdlp_cookies_cache_path: Optional[str] = None
_BACKEND_DIR = Path(__file__).resolve().parents[2]


def _short_vision_error(exc: BaseException) -> str:
    """Keep import notes readable (429 payloads are huge)."""
    text = str(exc)
    if "429" in text or "RESOURCE_EXHAUSTED" in text or "quota" in text.lower():
        return (
            "quota exceeded for this Gemini model/key (free tier). "
            "Link a billing account in Google AI Studio / Cloud, then restart the backend."
        )
    if "404" in text or "no longer available" in text.lower() or "NOT_FOUND" in text:
        return (
            "this Gemini model id is retired. "
            "Set GEMINI_VISION_MODEL=gemini-3.5-flash in backend/.env and restart."
        )
    if len(text) > 180:
        return text[:177] + "…"
    return text


def _ytdlp_cookie_file() -> Optional[str]:
    global _ytdlp_cookies_cache_path
    if settings.ytdlp_cookies_file:
        raw = Path(settings.ytdlp_cookies_file).expanduser()
        path = raw if raw.is_absolute() else (_BACKEND_DIR / raw).resolve()
        if path.is_file():
            return str(path)
        logger.warning("YTDLP_COOKIES_FILE not found: %s", path)
        return None
    if not settings.ytdlp_cookies or not settings.ytdlp_cookies.strip():
        return None
    if _ytdlp_cookies_cache_path is None:
        path = Path(tempfile.gettempdir()) / "ytdlp_cookies.txt"
        path.write_text(settings.ytdlp_cookies.strip() + "\n", encoding="utf-8")
        _ytdlp_cookies_cache_path = str(path)
    return _ytdlp_cookies_cache_path


def _ytdlp_impersonate():
    """Browser TLS impersonation — required for TikTok and helps Instagram."""
    try:
        from yt_dlp.networking.impersonate import ImpersonateTarget
    except Exception:
        return None
    try:
        probe = __import__("yt_dlp").YoutubeDL({"quiet": True})
        available = probe._get_available_impersonate_targets()
    except Exception:
        available = []
    preferred = (
        ImpersonateTarget("chrome", "131", None, None),
        ImpersonateTarget("chrome", "124", None, None),
        ImpersonateTarget("chrome", "136", None, None),
        ImpersonateTarget("chrome", None, "windows", None),
        ImpersonateTarget("safari", None, "ios", None),
        ImpersonateTarget("chrome", None, "macos", None),
        ImpersonateTarget("chrome", None, None, None),
        ImpersonateTarget("safari", None, "macos", None),
    )
    for want in preferred:
        for target, _rh in available:
            if want in target or target in want:
                return target
    if available:
        return available[0][0]
    return None


def _friendly_fetch_error(exc: BaseException, url: str) -> str:
    message = str(exc)
    lower = message.lower()
    platform = classify_video_url(url)

    if "login" in lower or "cookies" in lower or "empty media response" in lower:
        return _LOGIN_REQUIRED_DETAIL
    if "blocked" in lower or "ip address" in lower:
        return (
            f"{platform.title()} blocked automatic fetch from this server. "
            "Paste the video caption in the Caption field above, then try again."
        )
    if "400" in lower or "bad request" in lower:
        return (
            f"Could not fetch this {platform} link automatically "
            "(the platform blocked the request). "
            "Paste the caption in the Caption field above, then try again."
        )
    if "private" in lower or "unavailable" in lower or "not available" in lower:
        return (
            "This post looks private or unavailable to automatic fetch. "
            "Paste the caption in the Caption field above, then try again."
        )
    return (
        "Could not fetch this link automatically. "
        "Paste the caption in the Caption field above, then try again."
    )


def _ytdlp_options(
    *,
    use_cookies: bool = True,
    use_impersonate: bool = True,
    **extra: object,
) -> dict:
    opts: dict = {
        "quiet": True,
        "no_warnings": True,
        "skip_download": True,
        "noplaylist": True,
        "socket_timeout": 12,
        "retries": 0,
        "fragment_retries": 0,
        "extractor_retries": 0,
        **extra,
    }
    if use_cookies:
        cookie_file = _ytdlp_cookie_file()
        if cookie_file:
            opts["cookiefile"] = cookie_file
    if use_impersonate:
        impersonate = _ytdlp_impersonate()
        if impersonate is not None and "impersonate" not in opts:
            opts["impersonate"] = impersonate
    return opts


def _extract_with_ytdlp(url: str) -> dict:
    try:
        import yt_dlp
    except ImportError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Video import is not available (yt-dlp missing on server).",
        ) from exc

    source_url = resolve_public_url(url)
    source_type = classify_video_url(source_url)

    # TikTok oembed is ~400ms; yt-dlp retries can stall for minutes on a blocked IP.
    if source_type in {"tiktok", "instagram"}:
        fallback = webpage_fallback_info(source_url, source_type)
        if fallback:
            logger.info("Using webpage/oembed metadata for %s", source_url)
            return fallback

    last_exc: Optional[BaseException] = None
    cookie_file = _ytdlp_cookie_file()
    try:
        with yt_dlp.YoutubeDL(
            _ytdlp_options(use_cookies=bool(cookie_file), use_impersonate=True)
        ) as ydl:
            return ydl.extract_info(source_url, download=False)
    except Exception as exc:
        last_exc = exc
        logger.warning("yt-dlp extract failed for %s: %s", source_url, exc)

    fallback = webpage_fallback_info(source_url, source_type)
    if fallback:
        logger.info("Using webpage/oembed metadata for %s", source_url)
        return fallback

    raise HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=_friendly_fetch_error(last_exc or RuntimeError("extract failed"), source_url),
    ) from last_exc


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

    if host in {"instagram.com", "instagr.am", "l.instagram.com"}:
        return "instagram"
    if host.endswith("tiktok.com") or host in {"vm.tiktok.com", "vt.tiktok.com"}:
        return "tiktok"
    if host in {"youtube.com", "m.youtube.com", "music.youtube.com"} or host == "youtu.be":
        return "youtube"
    if host in {"facebook.com", "m.facebook.com", "web.facebook.com", "fb.watch", "fb.com", "l.facebook.com"}:
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
    from app.services.transcription import resolve_transcribe_provider, transcribe_audio_file

    if not ai_allowed() or resolve_transcribe_provider() is None:
        return None

    try:
        import yt_dlp
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

        return transcribe_audio_file(audio_files[0])


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


def _food_tokens(text: str) -> set[str]:
    """Rough food/ingredient tokens for caption-vs-transcript conflict checks."""
    stop = {
        "the", "and", "for", "with", "from", "this", "that", "into", "over", "onto",
        "cup", "cups", "tablespoon", "tablespoons", "teaspoon", "teaspoons", "tbsp",
        "tsp", "gram", "grams", "ml", "oz", "make", "recipe", "need", "add", "cook",
        "cooked", "fresh", "minced", "sliced", "powder", "you", "your", "video",
        "spoken", "instructions", "timestamps", "seconds", "frame", "visual",
    }
    tokens = set()
    for raw in re.findall(r"[a-zA-Z][a-zA-Z&']{2,}", text.lower()):
        word = raw.strip("'")
        if word in stop or len(word) < 3:
            continue
        tokens.add(word)
    return tokens


_CYRILLIC_OR_CJK = re.compile(r"[\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]")


def _transcript_looks_wrong_language(caption: str, transcript: str) -> bool:
    """Drop transcripts that are mostly a different script than the caption."""
    if not transcript.strip():
        return False
    letters = re.findall(r"[A-Za-z\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]", transcript)
    if len(letters) < 12:
        return False
    foreign = sum(1 for ch in letters if _CYRILLIC_OR_CJK.match(ch))
    foreign_ratio = foreign / max(len(letters), 1)
    caption_latin = len(re.findall(r"[A-Za-z]", caption or ""))
    # Caption is English-ish but transcript is mostly Cyrillic/CJK → wrong track.
    return foreign_ratio >= 0.35 and caption_latin >= 40


def _transcript_conflicts_with_caption(caption: str, transcript: str) -> bool:
    """True when spoken audio looks like a different dish than the caption recipe."""
    if not caption.strip() or not transcript.strip():
        return False
    if _transcript_looks_wrong_language(caption, transcript):
        return True
    if not _looks_like_recipe(caption):
        return False
    cap = _food_tokens(caption)
    spoken = _food_tokens(transcript)
    # Foreign-script transcript often yields almost no Latin food tokens.
    if len(cap) >= 4 and len(spoken) < 2:
        return True
    if len(cap) < 4 or len(spoken) < 3:
        return False
    overlap = len(cap & spoken) / max(len(cap), 1)
    # Caption has a real recipe but spoken barely shares food words → wrong audio.
    return overlap < 0.2


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

    caption_body = "\n\n".join(
        p for p in [
            title.strip() if title and title.lower() not in generic_titles else "",
            description.strip() if description else "",
            ("On-screen captions:\n" + subtitle.strip()) if subtitle and subtitle.strip() else "",
        ]
        if p
    )

    if caption_body:
        parts.append(
            "PRIMARY RECIPE SOURCE (creator caption — dish identity, listed ingredients/quantities, "
            "and written method. Extract EVERY listed spice/powder. Cross-check against what was "
            "watched in the video; do not invent a different dish):\n"
            + caption_body
        )

    usable_transcript = transcript.strip() if transcript and transcript.strip() else ""
    if usable_transcript and caption_body and _transcript_conflicts_with_caption(caption_body, usable_transcript):
        # Wrong-language / wrong-track audio is common on social downloads — do not let it invent ingredients.
        usable_transcript = ""

    if usable_transcript:
        parts.append(
            "Spoken instructions (what was heard — use for timing and technique; "
            "do not invent a different dish than the caption):\n"
            + usable_transcript
        )
    if visual and visual.strip():
        parts.append(
            "VIDEO OBSERVATIONS (multi-agent agents WATCHED the frames — primary source for "
            "what the cook actually does, technique, foods seen being used, and [m:ss] times. "
            "Merge with the caption: keep caption dish identity and listed spices; prefer "
            "watched actions for step detail and timestamps):\n"
            + visual.strip()
        )
    return "\n\n".join(parts).strip()


def _caption_body_for_vision(
    title: Optional[str],
    description: Optional[str],
    subtitle: Optional[str],
) -> Optional[str]:
    generic_titles = {"video", "instagram reel", "tiktok", "untitled", "reel", "instagram"}
    parts = [
        title.strip() if title and title.lower() not in generic_titles else "",
        description.strip() if description else "",
        subtitle.strip() if subtitle and subtitle.strip() else "",
    ]
    text = "\n\n".join(p for p in parts if p).strip()
    return text or None


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


_VIDEO_PLATFORMS = frozenset({"youtube", "facebook", "vimeo", "pinterest"}) | SHORT_FORM_PLATFORMS


def _should_run_visual(source_type: str, merged: str, transcript: Optional[str]) -> bool:
    # Always analyze frames for video platforms — step timestamps need visual grounding.
    if source_type in _VIDEO_PLATFORMS:
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
        frame_count=None,
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
    elif not settings.openai_api_key or not ai_allowed():
        notes.append("Audio transcription skipped (AI disabled or OPENAI_API_KEY not set).")
    else:
        notes.append(
            "No speech detected, could not transcribe audio, or OPENAI_API_KEY is invalid on the server."
        )
    return transcript


def _run_visual_step(
    source_url: str,
    notes: list[str],
    duration: Optional[float] = None,
    caption: Optional[str] = None,
) -> Optional[str]:
    # Ensure the mp4 (and optional JPEG stills for step thumbnails) are cached.
    cached = get_cached_video(source_url)
    if not cached:
        cached = ensure_video_cached(
            source_url,
            _ytdlp_options,
            duration=duration,
            frame_count=None,
        )

    vision_provider = (settings.social_vision_provider or "auto").strip().lower()
    visual_text: Optional[str] = None

    # Prefer Gemini native video when configured — model watches the full mp4.
    from app.services.video_gemini import analyze_video_with_gemini, gemini_video_configured

    gemini_ready = gemini_video_configured()
    try_gemini = vision_provider in {"gemini", "auto"} and gemini_ready
    notes.append(
        f"Vision provider={vision_provider}; Gemini configured={gemini_ready}; "
        f"cached video={'yes' if cached else 'no'}."
    )

    if try_gemini and cached:
        notes.append(
            f"Vision: Gemini ({settings.gemini_vision_model}) — watching the full mp4…"
        )
        try:
            visual_text = analyze_video_with_gemini(
                cached,
                duration=duration,
                caption=caption,
            )
        except Exception as exc:
            notes.append(f"Vision: Gemini failed — {_short_vision_error(exc)}")
            visual_text = None
        if visual_text:
            notes.append("Vision: Gemini succeeded — brief added from the full video.")
            return visual_text
        notes.append("Vision: Gemini produced no recipe content.")

    if vision_provider == "gemini" and not gemini_ready:
        notes.append(
            "Vision: Gemini unavailable — set GEMINI_API_KEY (or Vertex project) and restart the backend."
        )
        # Still try frame stills so import is not empty.
    if try_gemini and not cached:
        notes.append("Vision: Gemini skipped — no cached video file to analyze.")

    notes.append(
        "Vision: frame stills (Bedrock/OpenAI multi-agent) — used because Gemini did not return a brief."
        if try_gemini
        else "Vision: frame stills (Bedrock/OpenAI multi-agent)."
    )
    frames = get_cached_frames(source_url)
    if not frames and cached:
        # Re-run cache helper so stills exist for the frame fallback.
        ensure_video_cached(
            source_url,
            _ytdlp_options,
            duration=duration,
            frame_count=None,
        )
        frames = get_cached_frames(source_url)

    if frames:
        visual_text = analyze_frames_for_recipe(
            frames,
            duration=duration,
            frame_times=get_cached_frame_times(source_url),
            caption=caption,
        )

    if visual_text:
        notes.append(
            "Added multi-agent visual brief from watching the video (actions, foods, timestamps)."
        )
    elif not ai_allowed():
        notes.append("Video analysis skipped (AI disabled).")
    else:
        notes.append("Could not analyze video frames — paste the caption manually if needed.")
    return visual_text


def ingest_social_link(url: str, manual_caption: Optional[str] = None) -> dict:
    source_url = _normalize_url(url)
    source_type = classify_video_url(source_url)
    notes: list[str] = []
    provided_caption = (manual_caption or "").strip() or None
    if provided_caption:
        notes.append("Used caption you provided.")

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
        webpage = info.get("webpage_url")
        if isinstance(webpage, str) and webpage.startswith("http"):
            try:
                source_url = _normalize_url(webpage)
                source_type = classify_video_url(source_url)
            except HTTPException:
                pass
        canonical_id = info.get("id")
        if isinstance(canonical_id, (int, float)):
            canonical_id = str(int(canonical_id))
        if not isinstance(canonical_id, str) or not canonical_id.strip():
            canonical_id = None
        else:
            canonical_id = canonical_id.strip()
    else:
        canonical_id = None

    # Prefer the user's pasted caption when automatic description is missing/weak.
    if provided_caption:
        if not description or len(description) < len(provided_caption):
            description = provided_caption

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
        caption_for_vision = _caption_body_for_vision(title, description, subtitle_text)
        visual_text = _run_visual_step(
            source_url,
            notes,
            duration,
            caption=caption_for_vision,
        )

    raw_text = _merge_text_parts(title, description, subtitle_text, transcript, visual_text)
    if not raw_text and provided_caption:
        raw_text = provided_caption
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
        "canonical_id": canonical_id,
    }


_GENERIC_PREVIEW_TITLES = frozenset(
    {"video", "instagram reel", "tiktok", "untitled", "reel", "instagram", "shorts", "facebook watch"}
)


def _preview_display_title(title: Optional[str], source_type: str) -> str:
    if title and title.strip().lower() not in _GENERIC_PREVIEW_TITLES:
        cleaned = title.strip()
        if len(cleaned) > 120:
            return cleaned[:117] + "…"
        return cleaned
    labels = {
        "instagram": "Instagram reel",
        "tiktok": "TikTok video",
        "youtube": "YouTube video",
        "facebook": "Facebook video",
        "pinterest": "Pinterest video",
        "vimeo": "Vimeo video",
    }
    return labels.get(source_type, "Video")


def preview_social_link(url: str) -> dict:
    """Fast metadata-only lookup (yt-dlp extract_info, no download)."""
    try:
        source_url = _normalize_url(url)
    except HTTPException as exc:
        return {
            "valid": False,
            "source_url": url.strip(),
            "source_type": "video",
            "message": str(exc.detail),
        }

    source_type = classify_video_url(source_url)
    try:
        info = _extract_with_ytdlp(source_url)
    except HTTPException as exc:
        return {
            "valid": False,
            "source_url": source_url,
            "source_type": source_type,
            "message": str(exc.detail),
        }

    title = info.get("title") or info.get("fulltitle")
    author = info.get("uploader") or info.get("channel") or info.get("creator")
    thumbnail_url = info.get("thumbnail")
    raw_duration = info.get("duration")
    duration = float(raw_duration) if isinstance(raw_duration, (int, float)) else None

    return {
        "valid": True,
        "source_type": source_type,
        "source_url": source_url,
        "title": _preview_display_title(title if isinstance(title, str) else None, source_type),
        "author": author.strip() if isinstance(author, str) and author.strip() else None,
        "thumbnail_url": thumbnail_url if isinstance(thumbnail_url, str) else None,
        "video_duration": duration,
    }


# Backwards-compatible alias
classify_social_url = classify_video_url
