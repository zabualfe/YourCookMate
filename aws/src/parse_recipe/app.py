from __future__ import annotations

import json
from typing import Any

from parse_lib.recipe_parser import parse_recipe
from shared.http_response import json_response

NO_STEPS_DETAIL = (
    "Could not extract cooking steps from this text. "
    "TikTok and Instagram often put the recipe in the caption or spoken audio — "
    "edit the extracted text, paste the caption, or add steps manually on the review screen."
)


def handler(event, context):
    try:
        payload = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return json_response(400, {"detail": "Invalid JSON body"})

    raw_text = payload.get("raw_text")
    if not isinstance(raw_text, str):
        return json_response(422, {"detail": "raw_text is required"})
    if len(raw_text) < 10:
        return json_response(422, {"detail": "raw_text must be at least 10 characters"})
    if len(raw_text) > 50000:
        return json_response(422, {"detail": "raw_text is too long"})

    source_url = payload.get("source_url")
    if source_url is not None and not isinstance(source_url, str):
        return json_response(422, {"detail": "source_url must be a string"})
    if isinstance(source_url, str) and len(source_url) > 2048:
        return json_response(422, {"detail": "source_url is too long"})

    video_duration = payload.get("video_duration")
    if video_duration is not None and not isinstance(video_duration, (int, float)):
        return json_response(422, {"detail": "video_duration must be a number"})
    if isinstance(video_duration, (int, float)) and video_duration < 0:
        return json_response(422, {"detail": "video_duration must be non-negative"})

    try:
        recipe, used_ai = parse_recipe(raw_text)
    except Exception as exc:
        return json_response(502, {"detail": f"Failed to parse recipe: {exc}"})

    if not recipe.steps:
        return json_response(422, {"detail": NO_STEPS_DETAIL})

    body: dict[str, Any] = {
        "recipe": recipe.to_dict(),
        "used_ai": used_ai,
        "step_image_notes": [],
    }
    return json_response(200, body)
