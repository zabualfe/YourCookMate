from __future__ import annotations

from pydantic import BaseModel, Field


class FeaturesResponse(BaseModel):
    auth: bool = True
    registration: bool = True
    ai: bool = True
    social_ingest: bool = True
    community: bool = True
    instacart: bool = False
    instacart_shopping: bool = False
    instacart_connect: bool = False

    model_config = {"extra": "ignore"}
