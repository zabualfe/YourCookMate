from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user, require_admin
from app.models.user import User
from app.schemas.admin import (
    AdminFeatureFlagsResponse,
    AdminFeatureFlagsUpdate,
    AdminStatusResponse,
    FeatureFlagItem,
)
from app.schemas.features import FeaturesResponse
from app.services.admin import FLAG_METADATA, is_admin_user
from app.services.feature_flag_store import get_admin_flag_rows, update_flags
from app.services.feature_flags import build_features_response

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/status", response_model=AdminStatusResponse)
def admin_status(user: User = Depends(get_current_user)) -> AdminStatusResponse:
    return AdminStatusResponse(is_admin=is_admin_user(user))


@router.get("/feature-flags", response_model=AdminFeatureFlagsResponse)
def get_admin_feature_flags(
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> AdminFeatureFlagsResponse:
    rows = get_admin_flag_rows(db)
    latest = max((row.updated_at for row in rows), default=None)
    return AdminFeatureFlagsResponse(
        flags=[
            FeatureFlagItem(
                key=row.key,
                enabled=row.enabled,
                label=FLAG_METADATA[row.key]["label"],
                description=FLAG_METADATA[row.key]["description"],
            )
            for row in rows
        ],
        updated_at=latest.isoformat() if latest else None,
    )


@router.put("/feature-flags", response_model=FeaturesResponse)
def put_admin_feature_flags(
    body: AdminFeatureFlagsUpdate,
    db: Session = Depends(get_db),
    _admin: User = Depends(require_admin),
) -> FeaturesResponse:
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    update_flags(db, updates)
    return build_features_response()
