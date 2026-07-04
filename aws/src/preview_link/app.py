from __future__ import annotations

import json
from typing import Any

from ingest_lib.social_ingest import preview_link_metadata
from shared.http_response import json_response


def handler(event, context):
    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return json_response(400, {"detail": "Invalid JSON body"})

    url = payload.get("url")
    if not isinstance(url, str):
        return json_response(422, {"detail": "url is required"})
    if len(url.strip()) < 10:
        return json_response(422, {"detail": "url is too short"})
    if len(url) > 2048:
        return json_response(422, {"detail": "url is too long"})

    result: dict[str, Any] = preview_link_metadata(url)
    return json_response(200, result)
