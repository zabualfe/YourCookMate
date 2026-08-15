"""Vision quality presets — accuracy vs cost for video frame analysis."""

from __future__ import annotations

from dataclasses import dataclass

from app.config import settings


@dataclass(frozen=True)
class VisionQualityProfile:
    name: str
    sample_fps: float
    max_frames: int
    vision_max_frames: int
    max_segments: int
    segment_frames: int
    segment_overlap: int
    max_workers: int
    scene_threshold: float


_PRESETS: dict[str, VisionQualityProfile] = {
    # ~half the vision cost of accurate; good default for production.
    "balanced": VisionQualityProfile(
        name="balanced",
        sample_fps=1.0,
        max_frames=60,
        vision_max_frames=24,
        max_segments=6,
        segment_frames=6,
        segment_overlap=1,
        max_workers=4,
        scene_threshold=0.28,
    ),
    # Dense sampling for hardest short-form edits.
    "accurate": VisionQualityProfile(
        name="accurate",
        sample_fps=2.0,
        max_frames=120,
        vision_max_frames=48,
        max_segments=12,
        segment_frames=8,
        segment_overlap=2,
        max_workers=4,
        scene_threshold=0.25,
    ),
    # Cheap preview / fallback.
    "fast": VisionQualityProfile(
        name="fast",
        sample_fps=0.5,
        max_frames=24,
        vision_max_frames=16,
        max_segments=4,
        segment_frames=5,
        segment_overlap=1,
        max_workers=3,
        scene_threshold=0.3,
    ),
}


def resolve_vision_quality() -> VisionQualityProfile:
    raw = (getattr(settings, "social_vision_quality", None) or "balanced").strip().lower()
    if raw in _PRESETS:
        return _PRESETS[raw]
    return _PRESETS["balanced"]
