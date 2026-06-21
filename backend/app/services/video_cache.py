from __future__ import annotations

import hashlib
import json
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Callable, Optional

from app.config import settings
from app.services.recipe_icons import uploads_root
from app.services.video_frames import download_video, extract_evenly_spaced_frames, ffmpeg_executable

_VIDEO_SUFFIXES = {".mp4", ".webm", ".mkv", ".mov"}
_META_FILE = "meta.json"
_FRAMES_DIR = "frames"


def cache_key(source_url: str) -> str:
    return hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:20]


def get_cache_dir(source_url: str) -> Path:
    return uploads_root() / "video_cache" / cache_key(source_url)


def _find_cached_video(cache_dir: Path) -> Optional[Path]:
    if not cache_dir.is_dir():
        return None
    for path in sorted(cache_dir.iterdir()):
        if path.is_file() and path.suffix.lower() in _VIDEO_SUFFIXES and path.name.startswith("video"):
            return path
    return None


def get_cached_video(source_url: str) -> Optional[Path]:
    return _find_cached_video(get_cache_dir(source_url))


def get_cached_frames(source_url: str) -> list[Path]:
    frames_dir = get_cache_dir(source_url) / _FRAMES_DIR
    if not frames_dir.is_dir():
        return []
    return sorted(frames_dir.glob("frame_*.jpg"))


def _write_meta(cache_dir: Path, *, duration: Optional[float], frame_count: int) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / _META_FILE).write_text(
        json.dumps({"duration": duration, "frame_count": frame_count}),
        encoding="utf-8",
    )


def get_cached_duration(source_url: str) -> Optional[float]:
    meta_path = get_cache_dir(source_url) / _META_FILE
    if not meta_path.is_file():
        return None
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        duration = data.get("duration")
        if isinstance(duration, (int, float)) and duration > 0:
            return float(duration)
    except Exception:
        return None
    return None


def ensure_video_cached(
    source_url: str,
    ytdlp_options: Callable[..., dict],
    *,
    duration: Optional[float] = None,
    frame_count: Optional[int] = None,
) -> Optional[Path]:
    """Download the video once per URL and cache extracted frames for reuse."""
    cache_dir = get_cache_dir(source_url)
    video_path = _find_cached_video(cache_dir)

    if video_path is None:
        with tempfile.TemporaryDirectory() as tmp:
            tmp_dir = Path(tmp)
            downloaded = download_video(source_url, tmp_dir, ytdlp_options)
            if downloaded is None:
                return None
            cache_dir.mkdir(parents=True, exist_ok=True)
            video_path = cache_dir / f"video{downloaded.suffix.lower()}"
            shutil.copy2(downloaded, video_path)

    target_frames = frame_count or settings.social_step_max_frames
    existing_frames = get_cached_frames(source_url)
    if len(existing_frames) < target_frames:
        frames_dir = cache_dir / _FRAMES_DIR
        frames_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            extracted = extract_evenly_spaced_frames(
                video_path,
                Path(tmp),
                target_frames,
                duration,
            )
            for index, frame in enumerate(extracted, start=1):
                shutil.copy2(frame, frames_dir / f"frame_{index:03d}.jpg")

    _write_meta(cache_dir, duration=duration, frame_count=target_frames)
    return video_path


def extract_audio_from_video(video_path: Path, output_path: Path) -> bool:
    ffmpeg = ffmpeg_executable()
    if not ffmpeg:
        return False

    result = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(video_path),
            "-vn",
            "-acodec",
            "aac",
            "-b:a",
            "128k",
            str(output_path),
        ],
        capture_output=True,
        check=False,
    )
    return result.returncode == 0 and output_path.is_file() and output_path.stat().st_size > 0


def transcribe_cached_video(video_path: Path) -> Optional[str]:
    if not settings.openai_api_key:
        return None

    try:
        from openai import OpenAI
    except ImportError:
        return None

    with tempfile.TemporaryDirectory() as tmp:
        audio_path = Path(tmp) / "audio.m4a"
        if not extract_audio_from_video(video_path, audio_path):
            return None

        client = OpenAI(api_key=settings.openai_api_key)
        with audio_path.open("rb") as audio_file:
            result = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
            )
        text = (result if isinstance(result, str) else getattr(result, "text", "")).strip()
        if len(text) < 12:
            return None
        return text
