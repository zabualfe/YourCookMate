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
        yt_dlp = None

    if yt_dlp is not None:
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
            pass

        videos = [
            path
            for path in tmp_dir.glob("clip.*")
            if path.suffix.lower() in {".mp4", ".webm", ".mkv", ".mov"} and path.stat().st_size > 0
        ]
        if videos:
            return videos[0]

    from app.services.link_metadata import download_direct_mp4

    dest = tmp_dir / "clip.mp4"
    if download_direct_mp4(url, dest):
        return dest
    return None


def sample_times_across_duration(duration: float, count: int) -> list[float]:
    """Evenly spaced seek times across [0, duration], avoiding the exact end."""
    count = max(1, count)
    if duration <= 0:
        return [0.0] * count
    if count == 1:
        return [round(duration / 2, 3)]
    usable = max(0.0, duration - 0.05)
    return [round((i / (count - 1)) * usable, 3) for i in range(count)]


def target_sample_count(
    duration: Optional[float],
    *,
    fps: float,
    max_frames: int,
    min_frames: int = 24,
) -> int:
    """How many stills to keep for a video of this length."""
    max_frames = max(8, int(max_frames))
    min_frames = max(8, min(int(min_frames), max_frames))
    if not duration or duration <= 0:
        return max_frames
    by_fps = int(round(float(duration) * max(0.5, float(fps)))) + 1
    return max(min_frames, min(max_frames, by_fps))


_PTS_RE = re.compile(r"pts_time:(-?\d+(?:\.\d+)?)")


def _parse_showinfo_pts(stderr: str) -> list[float]:
    """Parse presentation timestamps from ffmpeg showinfo lines, in order."""
    times: list[float] = []
    for line in stderr.splitlines():
        if "pts_time:" not in line:
            continue
        m = _PTS_RE.search(line)
        if not m:
            continue
        try:
            times.append(max(0.0, float(m.group(1))))
        except ValueError:
            continue
    return times


def detect_scene_change_times(
    video_path: Path,
    *,
    threshold: float = 0.28,
    duration: Optional[float] = None,
) -> list[float]:
    """Return PTS times where ffmpeg detects a scene cut."""
    ffmpeg = ffmpeg_executable()
    if not ffmpeg or not video_path.is_file():
        return []

    thresh = max(0.05, min(0.9, float(threshold)))
    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-i",
            str(video_path),
            "-vf",
            f"select='gt(scene\\,{thresh})',showinfo",
            "-vsync",
            "vfr",
            "-f",
            "null",
            "-",
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    times = _parse_showinfo_pts(result.stderr or "")
    if duration and duration > 0:
        times = [t for t in times if t <= float(duration) + 0.05]
    cleaned: list[float] = []
    for t in times:
        if not cleaned or abs(t - cleaned[-1]) >= 0.35:
            cleaned.append(round(t, 3))
    return cleaned


def _extract_at_fps_with_pts(
    video_path: Path,
    tmp_dir: Path,
    *,
    fps: float,
    max_frames: int,
) -> list[tuple[Path, float]]:
    """Decode at a steady fps and capture real presentation timestamps via showinfo."""
    ffmpeg = ffmpeg_executable()
    if not ffmpeg or max_frames <= 0:
        return []

    fps = max(0.5, float(fps))
    out_pattern = str(tmp_dir / "dense_%04d.jpg")
    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-y",
            "-i",
            str(video_path),
            "-vf",
            f"fps={fps:.3f},scale='min(768\\,iw)':-2,showinfo",
            "-frames:v",
            str(max_frames),
            "-q:v",
            "3",
            out_pattern,
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    paths = sorted(tmp_dir.glob("dense_*.jpg"))
    if not paths:
        return []

    pts = _parse_showinfo_pts(result.stderr or "")
    pairs: list[tuple[Path, float]] = []
    for index, path in enumerate(paths):
        if index < len(pts):
            t = pts[index]
        else:
            t = round(index / fps, 3)
        pairs.append((path, float(t)))
    return pairs


def _extract_frame_at_time(video_path: Path, dest: Path, seek_at: float) -> bool:
    """Frame-accurate single still: -ss after -i (slower, precise)."""
    ffmpeg = ffmpeg_executable()
    if not ffmpeg:
        return False
    result = subprocess.run(
        [
            ffmpeg,
            "-hide_banner",
            "-y",
            "-i",
            str(video_path),
            "-ss",
            f"{max(0.0, seek_at):.3f}",
            "-frames:v",
            "1",
            "-q:v",
            "3",
            str(dest),
        ],
        capture_output=True,
        check=False,
    )
    return result.returncode == 0 and dest.is_file() and dest.stat().st_size > 0


def _merge_scene_and_dense(
    dense: list[tuple[Path, float]],
    scene_times: list[float],
    video_path: Path,
    tmp_dir: Path,
    max_frames: int,
) -> list[tuple[Path, float]]:
    """Keep dense coverage, force-include scene-change moments, cap at max_frames."""
    if not dense and not scene_times:
        return []

    by_time: dict[float, Path] = {}
    for path, t in dense:
        key = round(float(t), 3)
        by_time[key] = path

    for scene_t in scene_times:
        key = round(float(scene_t), 3)
        nearby = any(abs(key - existing) < 0.4 for existing in by_time)
        if nearby:
            continue
        dest = tmp_dir / f"scene_{str(key).replace('.', '_')}.jpg"
        if _extract_frame_at_time(video_path, dest, key):
            by_time[key] = dest

    ordered = sorted(by_time.items(), key=lambda item: item[0])
    if len(ordered) <= max_frames:
        return [(path, t) for t, path in ordered]

    scene_keys = {round(float(t), 3) for t in scene_times}
    selected: dict[float, Path] = {}
    for t, path in ordered:
        if t in scene_keys or any(abs(t - s) < 0.4 for s in scene_keys):
            selected[t] = path

    remaining_slots = max_frames - len(selected)
    if remaining_slots > 0:
        candidates = [(t, path) for t, path in ordered if t not in selected]
        if candidates:
            if remaining_slots >= len(candidates):
                for t, path in candidates:
                    selected[t] = path
            else:
                for i in range(remaining_slots):
                    idx = int(round(i * (len(candidates) - 1) / max(remaining_slots - 1, 1)))
                    t, path = candidates[idx]
                    selected[t] = path

    final = sorted(selected.items(), key=lambda item: item[0])
    if len(final) > max_frames:
        keep = []
        for i in range(max_frames):
            idx = int(round(i * (len(final) - 1) / max(max_frames - 1, 1)))
            keep.append(final[idx])
        seen: set[float] = set()
        uniq = []
        for t, path in keep:
            if t not in seen:
                seen.add(t)
                uniq.append((t, path))
        final = uniq

    return [(path, t) for t, path in final]


def extract_cooking_frames(
    video_path: Path,
    tmp_dir: Path,
    *,
    duration: Optional[float] = None,
    fps: float = 2.0,
    max_frames: int = 120,
    scene_threshold: float = 0.28,
) -> list[tuple[Path, float]]:
    """Dense, scene-aware stills with real presentation timestamps.

    1) Sample ~fps frames/sec via decoded fps filter + showinfo PTS
    2) Detect scene cuts and force-include those moments
    3) Cap at max_frames while keeping chronological order
    """
    if duration is None or duration <= 0:
        duration = probe_video_duration(video_path)

    count = target_sample_count(duration, fps=fps, max_frames=max_frames)
    dense = _extract_at_fps_with_pts(
        video_path,
        tmp_dir,
        fps=fps,
        max_frames=max(count, max_frames),
    )
    scenes = detect_scene_change_times(
        video_path,
        threshold=scene_threshold,
        duration=duration,
    )
    merged = _merge_scene_and_dense(dense, scenes, video_path, tmp_dir, count)
    if merged:
        return merged

    return extract_evenly_spaced_frames(video_path, tmp_dir, count, duration)


def extract_evenly_spaced_frames(
    video_path: Path,
    tmp_dir: Path,
    count: int,
    duration: Optional[float] = None,
) -> list[tuple[Path, float]]:
    """Legacy even seeks. Prefer extract_cooking_frames for accuracy."""
    ffmpeg = ffmpeg_executable()
    if not ffmpeg or count <= 0:
        return []

    count = max(1, count)
    if duration is None or duration <= 0:
        duration = probe_video_duration(video_path) or float(count * 2)

    times = sample_times_across_duration(float(duration), count)
    extracted: list[tuple[Path, float]] = []

    for index, seek_at in enumerate(times, start=1):
        out_path = tmp_dir / f"frame_{index:03d}.jpg"
        # -ss after -i is slower but closer to the requested time than keyframe seek.
        result = subprocess.run(
            [
                ffmpeg,
                "-y",
                "-i",
                str(video_path),
                "-ss",
                f"{seek_at:.3f}",
                "-frames:v",
                "1",
                "-q:v",
                "3",
                str(out_path),
            ],
            capture_output=True,
            check=False,
        )
        if result.returncode == 0 and out_path.is_file() and out_path.stat().st_size > 0:
            extracted.append((out_path, float(seek_at)))

    if extracted:
        return extracted

    interval = max(0.5, float(duration) / count) if duration and duration > 0 else 2.0
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
    paths = sorted(tmp_dir.glob("frame_*.jpg"))[:count]
    fallback_times = sample_times_across_duration(float(duration), len(paths))
    return list(zip(paths, fallback_times))


def clip_range_around(
    center: float,
    duration: float,
    clip_len: float,
) -> tuple[float, float]:
    """Return (start, clip_duration) for a short clip centered on `center`."""
    if duration <= 0:
        return 0.0, clip_len
    start = max(0.0, center - clip_len / 2)
    end = min(duration, start + clip_len)
    if end - start < min(clip_len, duration) and end == duration:
        start = max(0.0, duration - clip_len)
    return start, max(0.5, end - start)


def frame_index_to_clip_range(
    frame_idx: int,
    frame_count: int,
    duration: float,
    clip_len: float,
    *,
    center_seconds: Optional[float] = None,
) -> tuple[float, float]:
    if center_seconds is not None:
        return clip_range_around(float(center_seconds), duration, clip_len)
    if duration <= 0:
        return 0.0, clip_len
    if frame_count <= 1:
        center = duration / 2
    else:
        center = (frame_idx / (frame_count - 1)) * duration
    return clip_range_around(center, duration, clip_len)


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
