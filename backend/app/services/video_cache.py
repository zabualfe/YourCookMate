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
from app.services.video_frames import (
    download_video,
    extract_cooking_frames,
    ffmpeg_executable,
    probe_video_duration,
    sample_times_across_duration,
    target_sample_count,
)

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


def _write_meta(
    cache_dir: Path,
    *,
    duration: Optional[float],
    frame_count: int,
    frame_times: Optional[list[float]] = None,
    sample_fps: Optional[float] = None,
    sample_mode: str = "dense_scene",
    quality: Optional[str] = None,
) -> None:
    cache_dir.mkdir(parents=True, exist_ok=True)
    payload: dict = {
        "duration": duration,
        "frame_count": frame_count,
        "sample_mode": sample_mode,
    }
    if sample_fps is not None:
        payload["sample_fps"] = float(sample_fps)
    if quality:
        payload["quality"] = quality
    if frame_times is not None:
        payload["frame_times"] = [round(float(t), 3) for t in frame_times]
    (cache_dir / _META_FILE).write_text(json.dumps(payload), encoding="utf-8")


def _read_meta(source_url: str) -> dict:
    meta_path = get_cache_dir(source_url) / _META_FILE
    if not meta_path.is_file():
        return {}
    try:
        data = json.loads(meta_path.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def get_cached_duration(source_url: str) -> Optional[float]:
    duration = _read_meta(source_url).get("duration")
    if isinstance(duration, (int, float)) and duration > 0:
        return float(duration)
    return None


def get_cached_frame_times(source_url: str) -> list[float]:
    """Return seek times aligned with get_cached_frames(), or synthesize if missing."""
    frames = get_cached_frames(source_url)
    if not frames:
        return []

    meta = _read_meta(source_url)
    raw_times = meta.get("frame_times")
    times: list[float] = []
    if isinstance(raw_times, list):
        for value in raw_times:
            try:
                times.append(float(value))
            except (TypeError, ValueError):
                continue

    if len(times) == len(frames):
        return times

    duration = meta.get("duration")
    if not isinstance(duration, (int, float)) or duration <= 0:
        video = get_cached_video(source_url)
        duration = probe_video_duration(video) if video else None
    if not isinstance(duration, (int, float)) or duration <= 0:
        duration = float(len(frames) * 2)
    return sample_times_across_duration(float(duration), len(frames))


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

    if duration is None or duration <= 0:
        duration = probe_video_duration(video_path)

    from app.services.vision_quality import resolve_vision_quality

    profile = resolve_vision_quality()
    sample_fps = float(profile.sample_fps)
    target_frames = frame_count or target_sample_count(
        duration,
        fps=sample_fps,
        max_frames=profile.max_frames,
    )
    existing_frames = get_cached_frames(source_url)
    meta = _read_meta(source_url)
    existing_times = meta.get("frame_times") if isinstance(meta.get("frame_times"), list) else []
    existing_mode = str(meta.get("sample_mode") or "")
    existing_quality = str(meta.get("quality") or "")
    # Re-extract when short/outdated or quality preset changed.
    needs_extract = (
        len(existing_frames) < target_frames
        or len(existing_times) != len(existing_frames)
        or existing_mode not in {"dense_scene", "dense"}
        or float(meta.get("sample_fps") or 0) + 1e-6 < sample_fps
        or existing_quality != profile.name
    )

    frame_times: list[float] = []
    if needs_extract:
        frames_dir = cache_dir / _FRAMES_DIR
        if frames_dir.exists():
            shutil.rmtree(frames_dir)
        frames_dir.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory() as tmp:
            extracted = extract_cooking_frames(
                video_path,
                Path(tmp),
                duration=duration,
                fps=sample_fps,
                max_frames=target_frames,
                scene_threshold=float(profile.scene_threshold),
            )
            for index, (frame, pts) in enumerate(extracted, start=1):
                shutil.copy2(frame, frames_dir / f"frame_{index:03d}.jpg")
                frame_times.append(float(pts))
    else:
        frame_times = [float(t) for t in existing_times]

    _write_meta(
        cache_dir,
        duration=duration,
        frame_count=len(frame_times) or target_frames,
        frame_times=frame_times or None,
        sample_fps=sample_fps,
        sample_mode="dense_scene",
        quality=profile.name,
    )
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
    from app.services.feature_flags import ai_allowed
    from app.services.transcription import resolve_transcribe_provider, transcribe_audio_file

    if not ai_allowed() or resolve_transcribe_provider() is None:
        return None

    with tempfile.TemporaryDirectory() as tmp:
        audio_path = Path(tmp) / "audio.m4a"
        if not extract_audio_from_video(video_path, audio_path):
            return None
        return transcribe_audio_file(audio_path)
