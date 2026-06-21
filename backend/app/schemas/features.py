from __future__ import annotations

from pydantic import BaseModel


class FeaturesResponse(BaseModel):
    instacart: bool
    instacart_shopping: bool
    instacart_connect: bool
