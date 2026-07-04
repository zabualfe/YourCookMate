from __future__ import annotations

from fastapi import HTTPException, status

from app.config import settings
from app.schemas.features import FeaturesResponse
from app.services.feature_flag_store import get_flag_values, is_feature_enabled
from app.services.instacart import instacart_shopping_available
from app.services.instacart_connect import connect_is_configured


def build_features_response() -> FeaturesResponse:
    flags = get_flag_values()
    instacart_on = settings.instacart_enabled and flags.get("instacart", False)
    return FeaturesResponse(
        auth=flags.get("auth", True),
        registration=flags.get("registration", True),
        ai=flags.get("ai", True),
        social_ingest=flags.get("social_ingest", True),
        community=flags.get("community", True),
        instacart=instacart_on,
        instacart_shopping=instacart_on and instacart_shopping_available(),
        instacart_connect=instacart_on and connect_is_configured(),
    )


def _disabled(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=detail)


def require_auth_enabled() -> None:
    if not is_feature_enabled("auth"):
        raise _disabled("Sign-in is temporarily disabled.")


def require_registration_enabled() -> None:
    require_auth_enabled()
    if not is_feature_enabled("registration"):
        raise _disabled("New account registration is temporarily disabled.")


def require_ai_enabled() -> None:
    if not is_feature_enabled("ai"):
        raise _disabled("AI features are temporarily disabled.")


def require_social_ingest_enabled() -> None:
    if not is_feature_enabled("social_ingest"):
        raise _disabled("Video link import is temporarily disabled.")


def require_community_enabled() -> None:
    if not is_feature_enabled("community"):
        raise _disabled("Community recipes are temporarily disabled.")


def ai_allowed() -> bool:
    return is_feature_enabled("ai")
