from __future__ import annotations

import json
import re
from typing import Any, Literal, Optional

from app.config import settings

AiProvider = Literal["bedrock", "openai", "auto"]

_JSON_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.I | re.M)


def resolve_ai_provider() -> Optional[str]:
    """Return 'bedrock' or 'openai', or None if neither is usable."""
    preferred = (settings.ai_provider or "auto").strip().lower()

    if preferred == "bedrock":
        return "bedrock" if _bedrock_usable() else ("openai" if _openai_usable() else None)
    if preferred == "openai":
        return "openai" if _openai_usable() else ("bedrock" if _bedrock_usable() else None)

    # auto: prefer Bedrock (local AWS creds), then OpenAI
    if _bedrock_usable():
        return "bedrock"
    if _openai_usable():
        return "openai"
    return None


def _openai_usable() -> bool:
    return bool(settings.openai_api_key and settings.feature_ai_enabled)


def _bedrock_usable() -> bool:
    if not settings.feature_ai_enabled:
        return False
    try:
        import boto3

        session = boto3.Session(region_name=settings.aws_region)
        creds = session.get_credentials()
        return creds is not None
    except Exception:
        return False


def extract_json_object(text: str) -> dict[str, Any]:
    cleaned = _JSON_FENCE.sub("", text.strip()).strip()
    try:
        data = json.loads(cleaned)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass

    start = cleaned.find("{")
    end = cleaned.rfind("}")
    if start >= 0 and end > start:
        data = json.loads(cleaned[start : end + 1])
        if isinstance(data, dict):
            return data
    raise ValueError("Model response was not valid JSON")


def chat_json(*, system: str, user: str, max_tokens: int = 4096) -> dict[str, Any]:
    provider = resolve_ai_provider()
    errors: list[str] = []

    order: list[str] = []
    if provider:
        order.append(provider)
    for candidate in ("openai", "bedrock"):
        if candidate not in order:
            if candidate == "openai" and _openai_usable():
                order.append(candidate)
            elif candidate == "bedrock" and _bedrock_usable():
                order.append(candidate)

    for name in order:
        try:
            if name == "bedrock":
                return _bedrock_chat_json(system=system, user=user, max_tokens=max_tokens)
            if name == "openai":
                return _openai_chat_json(system=system, user=user, max_tokens=max_tokens)
        except Exception as exc:
            errors.append(f"{name}: {exc}")
            # Expired AWS login / bad Bedrock session → try the other provider.
            continue

    detail = "; ".join(errors) if errors else "no provider configured"
    raise RuntimeError(f"No AI provider available ({detail})")


def _openai_chat_json(*, system: str, user: str, max_tokens: int) -> dict[str, Any]:
    from openai import OpenAI

    client = OpenAI(api_key=settings.openai_api_key)
    response = client.chat.completions.create(
        model=settings.openai_model,
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        temperature=0,
        max_tokens=max_tokens,
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("Empty OpenAI response")
    return extract_json_object(content)


def _bedrock_chat_json(*, system: str, user: str, max_tokens: int) -> dict[str, Any]:
    import boto3

    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    # Ask explicitly for JSON — Bedrock Converse has no response_format=json_object.
    system_text = (
        system
        + "\n\nRespond with a single JSON object only. No markdown fences, no commentary."
    )
    response = client.converse(
        modelId=settings.bedrock_parse_model,
        system=[{"text": system_text}],
        messages=[{"role": "user", "content": [{"text": user}]}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": 0},
    )
    text_parts: list[str] = []
    for block in response.get("output", {}).get("message", {}).get("content", []):
        if isinstance(block, dict) and block.get("text"):
            text_parts.append(str(block["text"]))
    content = "\n".join(text_parts).strip()
    if not content:
        raise ValueError("Empty Bedrock response")
    return extract_json_object(content)


def bedrock_vision_text(
    *,
    prompt: str,
    images_jpeg: list[bytes],
    max_tokens: int = 2500,
) -> Optional[str]:
    """Multimodal Bedrock converse for frame analysis. Returns plain text or None."""
    if not images_jpeg:
        return None
    import boto3

    content: list[dict] = [{"text": prompt}]
    for data in images_jpeg:
        content.append(
            {
                "image": {
                    "format": "jpeg",
                    "source": {"bytes": data},
                }
            }
        )

    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    response = client.converse(
        modelId=settings.bedrock_vision_model,
        messages=[{"role": "user", "content": content}],
        inferenceConfig={"maxTokens": max_tokens, "temperature": 0},
    )
    text_parts: list[str] = []
    for block in response.get("output", {}).get("message", {}).get("content", []):
        if isinstance(block, dict) and block.get("text"):
            text_parts.append(str(block["text"]))
    text = "\n".join(text_parts).strip()
    return text or None
