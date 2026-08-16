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
    from ingest_lib.link_metadata import download_direct_mp4, prefers_direct_download

    dest = tmp_dir / "clip.mp4"
    if prefers_direct_download(url) and download_direct_mp4(url, dest):
        return dest

    try:
        import yt_dlp
    except ImportError:
        yt_dlp = None

    if yt_dlp is not None:
        out_path = str(tmp_dir / "clip.%(ext)s")
        opts = ytdlp_options(
            skip_download=False,
            format="best[height<=480][ext=mp4]/best[height<=480]/best[height<=720]/best",
            outtmpl=out_path,
            postprocessors=[],
            retries=0,
            fragment_retries=0,
            extractor_retries=0,
            socket_timeout=12,
        )
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
        except Exception:
            pass

        videos = [
            path
            for path in tmp_dir.glob("clip.*")
            if path.suffix.lower() in {".mp4", ".webm", ".mkv", ".mov"} and path.stat().st_size > 0
        ]
        if videos:
            return videos[0]

    if dest.is_file() and dest.stat().st_size > 64:
        return dest
    if download_direct_mp4(url, dest):
        return dest
    return None


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


def extract_audio_from_video(
    video_path: Path,
    output_path: Path,
    *,
    max_seconds: Optional[float] = None,
) -> bool:
    ffmpeg = ffmpeg_executable()
    if not ffmpeg:
        return False

    cmd = [
        ffmpeg,
        "-y",
        "-i",
        str(video_path),
    ]
    if max_seconds and max_seconds > 0:
        cmd.extend(["-t", str(max_seconds)])
    cmd.extend(
        [
            "-vn",
            "-acodec",
            "aac",
            "-b:a",
            "128k",
            str(output_path),
        ]
    )

    result = subprocess.run(
        cmd,
        capture_output=True,
        check=False,
    )
    return result.returncode == 0 and output_path.is_file() and output_path.stat().st_size > 0
