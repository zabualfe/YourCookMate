from __future__ import annotations

import hashlib
import json
import re
from fractions import Fraction
from typing import Any, Optional

import httpx
from fastapi import HTTPException, status

from app.config import settings
from app.schemas.recipe import Ingredient, ParsedRecipe


def instacart_shopping_available() -> bool:
    return bool(settings.instacart_enabled and settings.instacart_api_key)


def require_instacart_shopping() -> None:
    if not settings.instacart_enabled:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Instacart integration is disabled.",
        )
    if not settings.instacart_api_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Instacart shopping is not configured. Set INSTACART_API_KEY in backend .env.",
        )

# Instacart-supported units (subset; unknown units fall back to "each").
UNIT_ALIASES: dict[str, str] = {
    "each": "each",
    "ea": "each",
    "piece": "each",
    "pieces": "each",
    "clove": "clove",
    "cloves": "clove",
    "cup": "cup",
    "cups": "cup",
    "c": "cup",
    "tablespoon": "tablespoon",
    "tablespoons": "tablespoon",
    "tbsp": "tablespoon",
    "tbs": "tablespoon",
    "tb": "tablespoon",
    "teaspoon": "teaspoon",
    "teaspoons": "teaspoon",
    "tsp": "teaspoon",
    "ounce": "ounce",
    "ounces": "ounce",
    "oz": "ounce",
    "pound": "pound",
    "pounds": "pound",
    "lb": "pound",
    "lbs": "pound",
    "gram": "gram",
    "grams": "gram",
    "g": "gram",
    "kilogram": "kilogram",
    "kilograms": "kilogram",
    "kg": "kilogram",
    "milliliter": "milliliter",
    "milliliters": "milliliter",
    "ml": "milliliter",
    "liter": "liter",
    "liters": "liter",
    "l": "liter",
    "fluid ounce": "fluid ounce",
    "fluid ounces": "fluid ounce",
    "fl oz": "fluid ounce",
    "floz": "fluid ounce",
    "pinch": "pinch",
    "pinches": "pinch",
    "bunch": "bunch",
    "bunches": "bunch",
    "slice": "slice",
    "slices": "slice",
    "can": "can",
    "cans": "can",
    "package": "package",
    "packages": "package",
    "pkg": "package",
    "bottle": "bottle",
    "bottles": "bottle",
    "bag": "package",
    "bags": "package",
    "stick": "each",
    "sticks": "each",
    "head": "each",
    "heads": "each",
    "sprig": "each",
    "sprigs": "each",
}

_QUANTITY_RE = re.compile(
    r"^\s*"
    r"(?P<qty>(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?))"
    r"(?:\s*[-–]\s*(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?))?"
    r"\s*"
    r"(?P<unit>[\w][\w\s.]*)?"
    r"\s*$",
    re.IGNORECASE,
)


def _parse_quantity_number(raw: str) -> float:
    cleaned = raw.strip()
    if " " in cleaned and "/" in cleaned:
        parts = cleaned.split()
        if len(parts) == 2 and "/" in parts[1]:
            return float(Fraction(int(parts[0]), 1) + Fraction(parts[1]))
    if "/" in cleaned:
        return float(Fraction(cleaned))
    return float(cleaned)


def parse_quantity_string(quantity: str) -> tuple[float, str]:
    """Parse a recipe quantity string into (amount, instacart_unit)."""
    text = (quantity or "").strip()
    if not text:
        return 1.0, "each"

    glued = re.match(r"^(\d+(?:\.\d+)?)(g|kg|ml|oz|lb)s?$", text, re.IGNORECASE)
    if glued:
        num = float(glued.group(1))
        unit_key = glued.group(2).lower()
        return num, UNIT_ALIASES.get(unit_key, "each")

    match = _QUANTITY_RE.match(text)
    if not match:
        return 1.0, "each"

    qty_raw = match.group("qty")
    unit_raw = (match.group("unit") or "").strip().lower().rstrip(".")

    try:
        qty = _parse_quantity_number(qty_raw)
    except (ValueError, ZeroDivisionError):
        return 1.0, "each"

    if qty <= 0:
        qty = 1.0

    if not unit_raw:
        return qty, "each"

    unit = UNIT_ALIASES.get(unit_raw)
    if unit:
        return qty, unit

    # Multi-word units (e.g. "fl oz")
    for alias, normalized in sorted(UNIT_ALIASES.items(), key=lambda x: -len(x[0])):
        if unit_raw == alias or unit_raw.endswith(f" {alias}"):
            return qty, normalized

    return qty, "each"


def ingredients_fingerprint(ingredients: list[Ingredient]) -> str:
    payload = [
        {"name": ing.name.strip().lower(), "quantity": ing.quantity.strip()}
        for ing in ingredients
        if ing.name.strip()
    ]
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def ingredients_to_line_items(ingredients: list[Ingredient]) -> list[dict[str, Any]]:
    line_items: list[dict[str, Any]] = []
    for ing in ingredients:
        name = ing.name.strip()
        if not name:
            continue
        qty_str = ing.quantity.strip()
        quantity, unit = parse_quantity_string(qty_str)
        display = f"{qty_str} {name}".strip() if qty_str else name
        line_items.append(
            {
                "name": name,
                "display_text": display,
                "line_item_measurements": [{"quantity": quantity, "unit": unit}],
            }
        )
    return line_items


def absolute_icon_url(icon_path: str | None) -> str | None:
    rel = icon_path
    if not rel:
        return None
    if rel.startswith("http://") or rel.startswith("https://"):
        return rel
    path = rel if rel.startswith("/uploads/") else f"/uploads/{rel.lstrip('/')}"
    return f"{settings.api_base_url.rstrip('/')}{path}"


def create_recipe_link(
    recipe: ParsedRecipe,
    *,
    partner_linkback_url: str,
    image_url: str | None = None,
) -> str:
    require_instacart_shopping()

    line_items = ingredients_to_line_items(recipe.ingredients)
    if not line_items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="This recipe has no ingredients to shop for.",
        )

    payload: dict[str, Any] = {
        "title": recipe.title.strip() or "Recipe",
        "link_type": "recipe",
        "expires_in": settings.instacart_link_expires_days,
        "instructions": [step.instruction.strip() for step in recipe.steps if step.instruction.strip()],
        "line_items": line_items,
        "landing_page_configuration": {
            "partner_linkback_url": partner_linkback_url,
            "enable_pantry_items": True,
        },
    }
    if image_url:
        payload["image_url"] = image_url

    url = f"{settings.instacart_api_base.rstrip('/')}/idp/v1/products/recipe"
    headers = {
        "Authorization": f"Bearer {settings.instacart_api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }

    try:
        with httpx.Client(timeout=15.0) as client:
            response = client.post(url, json=payload, headers=headers)
    except httpx.HTTPError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not reach Instacart: {exc}",
        ) from exc

    if response.status_code >= 400:
        detail = "Instacart rejected the shopping list request."
        try:
            body = response.json()
            if isinstance(body, dict) and body.get("error"):
                detail = str(body["error"])
            elif isinstance(body, dict) and body.get("message"):
                detail = str(body["message"])
        except Exception:
            if response.text:
                detail = response.text[:300]
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    data = response.json()
    products_url = data.get("products_link_url")
    if not products_url:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Instacart did not return a shopping link.",
        )
    return str(products_url)


def get_or_create_instacart_link(
    row: Any,
    recipe: ParsedRecipe,
    *,
    partner_linkback_url: str,
) -> tuple[str, bool]:
    fingerprint = ingredients_fingerprint(recipe.ingredients)
    cached_url = getattr(row, "instacart_link_url", None)
    cached_hash = getattr(row, "instacart_ingredients_hash", None)

    if cached_url and cached_hash == fingerprint:
        return cached_url, True

    image_url = absolute_icon_url(getattr(row, "icon_path", None))
    url = create_recipe_link(recipe, partner_linkback_url=partner_linkback_url, image_url=image_url)

    row.instacart_link_url = url
    row.instacart_ingredients_hash = fingerprint
    return url, False


def clear_instacart_cache(row: Any) -> None:
    row.instacart_link_url = None
    row.instacart_ingredients_hash = None
