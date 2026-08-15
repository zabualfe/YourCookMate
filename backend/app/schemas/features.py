from __future__ import annotations

from typing import Optional

from pydantic import BaseModel


class FeaturesResponse(BaseModel):
    auth: bool = True
    registration: bool = True
    ai: bool = True
    social_ingest: bool = True
    community: bool = True
    instacart: bool = False
    instacart_shopping: bool = False
    instacart_connect: bool = False
    aws_transcribe: bool = False
    aws_api_url: Optional[str] = None

    model_config = {"extra": "ignore"}
