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
    return videos[0] if videos else None


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
    interval = max(0.5, duration / count) if duration and duration > 0 else 2.0
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
