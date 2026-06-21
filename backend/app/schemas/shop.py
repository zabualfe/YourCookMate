from __future__ import annotations

from pydantic import BaseModel


class InstacartLinkResponse(BaseModel):
    url: str
    cached: bool
