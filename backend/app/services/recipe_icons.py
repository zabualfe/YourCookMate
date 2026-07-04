from __future__ import annotations

import logging
import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.config import settings

logger = logging.getLogger(__name__)

ALLOWED_ICON_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}


def _use_s3() -> bool:
    return bool(settings.uploads_bucket)


def _s3_client():
    import boto3

    return boto3.client("s3")


def uploads_root() -> Path:
    root = Path(settings.uploads_dir)
    root.mkdir(parents=True, exist_ok=True)
    (root / "recipes").mkdir(parents=True, exist_ok=True)
    return root


def media_public_url(relative_path: str | None) -> str | None:
    if not relative_path:
        return None
    rel = relative_path.removeprefix("/uploads/").lstrip("/")
    if _use_s3() and settings.uploads_public_base_url:
        return f"{settings.uploads_public_base_url.rstrip('/')}/{rel}"
    return f"{settings.api_base_url.rstrip('/')}/uploads/{rel}"


def icon_public_url(icon_path: str | None) -> str | None:
    return media_public_url(icon_path)


def _icon_file_path(icon_path: str) -> Path:
    return uploads_root() / icon_path


def delete_icon_file(icon_path: str | None) -> None:
    if not icon_path:
        return
    if _use_s3():
        from botocore.exceptions import ClientError

        try:
            _s3_client().delete_object(Bucket=settings.uploads_bucket, Key=icon_path)
        except ClientError:
            logger.exception("Failed to delete S3 icon %s", icon_path)
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

    if _use_s3():
        _s3_client().put_object(
            Bucket=settings.uploads_bucket,
            Key=relative,
            Body=data,
            ContentType=content_type,
        )
        return relative

    path = _icon_file_path(relative)
    path.write_bytes(data)
    return relative
