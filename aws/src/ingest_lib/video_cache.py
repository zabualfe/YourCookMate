from __future__ import annotations

import hashlib
import json
import shutil
import tempfile
from pathlib import Path
from typing import Callable, Optional

from ingest_lib.config import settings
from ingest_lib.video_frames import download_video, extract_evenly_spaced_frames

_VIDEO_SUFFIXES = {".mp4", ".webm", ".mkv", ".mov"}
_META_FILE = "meta.json"
_FRAMES_DIR = "frames"
_CACHE_ROOT = Path("/tmp/yourcookmate-video-cache")


def cache_key(source_url: str) -> str:
    return hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:20]


def get_cache_dir(source_url: str) -> Path:
    return _CACHE_ROOT / cache_key(source_url)


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


def ensure_video_cached(
    source_url: str,
    ytdlp_options: Callable[..., dict],
    *,
    duration: Optional[float] = None,
    frame_count: Optional[int] = None,
) -> Optional[Path]:
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

    cache_dir.mkdir(parents=True, exist_ok=True)
    (cache_dir / _META_FILE).write_text(
        json.dumps({"duration": duration, "frame_count": target_frames}),
        encoding="utf-8",
    )
    return video_path
