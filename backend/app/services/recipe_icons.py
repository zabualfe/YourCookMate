from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

ALLOWED_ICON_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def uploads_root() -> Path:
    root = Path(settings.uploads_dir)
    root.mkdir(parents=True, exist_ok=True)
    (root / "recipes").mkdir(parents=True, exist_ok=True)
    return root


def icon_public_url(icon_path: str | None) -> str | None:
    if not icon_path:
        return None
    return f"/uploads/{icon_path.lstrip('/')}"


def _icon_file_path(icon_path: str) -> Path:
    return uploads_root() / icon_path


def delete_icon_file(icon_path: str | None) -> None:
    if not icon_path:
        return
    path = _icon_file_path(icon_path)
    if path.is_file():
        path.unlink()


async def save_recipe_icon(recipe_id: uuid.UUID, upload: UploadFile) -> str:
    content_type = upload.content_type or ""
    if content_type not in ALLOWED_ICON_TYPES:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Icon must be JPEG, PNG, WebP, or GIF.",
        )

    data = await upload.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file.")
    if len(data) > settings.max_icon_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Icon must be 2 MB or smaller.",
        )

    ext = ALLOWED_ICON_TYPES[content_type]
    relative = f"recipes/{recipe_id}{ext}"
    path = _icon_file_path(relative)
    path.write_bytes(data)
    return relative
