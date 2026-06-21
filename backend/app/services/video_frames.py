from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path
from typing import Callable, Optional


def ffmpeg_executable() -> Optional[str]:
    try:
        import imageio_ffmpeg

        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        pass
    return shutil.which("ffmpeg")


def probe_video_duration(video_path: Path) -> Optional[float]:
    ffmpeg = ffmpeg_executable()
    if not ffmpeg or not video_path.is_file():
        return None

    result = subprocess.run(
        [ffmpeg, "-i", str(video_path)],
        capture_output=True,
        text=True,
        check=False,
    )
    for line in (result.stderr or "").splitlines():
        match = re.search(r"Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)", line)
        if match:
            hours, minutes, seconds = match.groups()
            return int(hours) * 3600 + int(minutes) * 60 + float(seconds)
    return None


def download_video(url: str, tmp_dir: Path, ytdlp_options: Callable[..., dict]) -> Optional[Path]:
    try:
        import yt_dlp
    except ImportError:
        return None

    out_path = str(tmp_dir / "clip.%(ext)s")
    opts = ytdlp_options(
        skip_download=False,
        format="best[height<=720][filesize<25M]/best[height<=720]/best",
        outtmpl=out_path,
        postprocessors=[],
    )
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
    except Exception:
        return None

    videos = [
        path
        for path in tmp_dir.glob("clip.*")
        if path.suffix.lower() in {".mp4", ".webm", ".mkv", ".mov"} and path.stat().st_size > 0
    ]
    if not videos:
        return None
    return videos[0]


def extract_evenly_spaced_frames(
    video_path: Path,
    tmp_dir: Path,
    count: int,
    duration: Optional[float] = None,
) -> list[Path]:
    ffmpeg = ffmpeg_executable()
    if not ffmpeg or count <= 0:
        return []

    count = max(1, count)
    if duration and duration > 0:
        interval = max(0.5, duration / count)
    else:
        interval = 2.0

    out_pattern = str(tmp_dir / "frame_%03d.jpg")
    result = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-i",
            str(video_path),
            "-vf",
            f"fps=1/{interval}",
            "-frames:v",
            str(count),
            "-q:v",
            "3",
            out_pattern,
        ],
        capture_output=True,
        check=False,
    )
    if result.returncode != 0:
        return []

    return sorted(tmp_dir.glob("frame_*.jpg"))[:count]


def frame_index_to_clip_range(
    frame_idx: int,
    frame_count: int,
    duration: float,
    clip_len: float,
) -> tuple[float, float]:
    if duration <= 0:
        return 0.0, clip_len
    if frame_count <= 1:
        center = duration / 2
    else:
        center = (frame_idx / (frame_count - 1)) * duration
    start = max(0.0, center - clip_len / 2)
    end = min(duration, start + clip_len)
    if end - start < min(clip_len, duration) and end == duration:
        start = max(0.0, duration - clip_len)
    return start, max(0.5, end - start)


def extract_video_clip(video_path: Path, dest: Path, start: float, duration: float) -> bool:
    ffmpeg = ffmpeg_executable()
    if not ffmpeg:
        return False

    dest.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            ffmpeg,
            "-y",
            "-ss",
            f"{start:.3f}",
            "-i",
            str(video_path),
            "-t",
            f"{duration:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "fast",
            "-crf",
            "28",
            "-movflags",
            "+faststart",
            str(dest),
        ],
        capture_output=True,
        check=False,
    )
    return result.returncode == 0 and dest.is_file() and dest.stat().st_size > 0


def save_frame_copy(src: Path, dest: Path, max_width: int = 1024) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        from PIL import Image
    except ImportError:
        dest.write_bytes(src.read_bytes())
        return

    with Image.open(src) as img:
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")
        if img.width > max_width:
            ratio = max_width / img.width
            img = img.resize((max_width, max(1, int(img.height * ratio))), Image.LANCZOS)
        img.save(dest, format="JPEG", quality=85)
