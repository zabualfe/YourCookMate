from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from typing import Any, Optional

import boto3

from ingest_lib.config import settings

SYSTEM_PROMPT = """You are a recipe parser for Your Cook Mate. Convert raw recipe text into structured JSON for a step-by-step cooking app with one clear action per step.

Input may come from TikTok, Instagram, YouTube, or other cooking videos: informal captions, hashtags, emoji, or spoken audio transcripts. Ignore hashtags, @mentions, and social noise. Infer ingredients and cooking steps even when sections are not explicitly labeled (e.g. "you need:" or a list of actions without headers).

Rules for steps:
- One clear action per step; break compound instructions apart
- Use short imperative sentences ("Dice the onion into ½-inch pieces")
- Include implicit steps (preheat oven, rest meat, etc.)
- Cap each step at ~2 sentences
- Add duration_minutes when the step mentions time
- Link ingredients_used to ingredient names from the list
- List equipment when relevant
- Always return at least one step when any cooking action is present

Nutrition and allergens (estimates only — infer from ingredients and typical portions):
- calories_per_serving: estimated kcal for one serving (integer). Use null if servings or ingredients are too vague to estimate reasonably.
- allergens: list likely allergens present in the recipe. Use lowercase canonical names from this set only when applicable: dairy, eggs, fish, shellfish, tree nuts, peanuts, wheat, gluten, soy, sesame. Omit items that are not present; use [] when none are likely.

Return ONLY valid JSON matching this schema:
{
  "title": "string",
  "servings": number or null,
  "prep_time_minutes": number or null,
  "cook_time_minutes": number or null,
  "calories_per_serving": number or null,
  "allergens": ["string"],
  "ingredients": [{"name": "string", "quantity": "string", "group": "string"}],
  "steps": [{"order": 1, "instruction": "string", "duration_minutes": number or null, "ingredients_used": ["string"], "equipment": ["string"]}]
}"""

_HASHTAG_ONLY = re.compile(r"^(?:#\w+\s*)+$")
_MENTION_OR_TAG = re.compile(r"[@#]\w+")
_INGREDIENT_LINE = re.compile(
    r"^(?:you need|what you need|ingredients?|grocery list)\s*:?\s*(.+)$",
    re.I,
)
_STEP_PREFIX = re.compile(r"^(?:step\s*)?\d+[.)]\s*", re.I)
_BULLET = re.compile(r"^[-•*▪→]\s*")
_SPOKEN_HEADER = re.compile(r"^spoken instructions?\s*:?\s*$", re.I)


@dataclass
class Ingredient:
    name: str
    quantity: str = ""
    group: str = "Main"

    def to_dict(self) -> dict[str, Any]:
        return {"name": self.name, "quantity": self.quantity, "group": self.group}


@dataclass
class RecipeStep:
    order: int
    instruction: str
    duration_minutes: Optional[int] = None
    ingredients_used: list[str] = field(default_factory=list)
    equipment: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "order": self.order,
            "instruction": self.instruction,
            "duration_minutes": self.duration_minutes,
            "ingredients_used": self.ingredients_used,
            "equipment": self.equipment,
            "image_url": None,
            "clip_url": None,
        }


@dataclass
class ParsedRecipe:
    title: str
    ingredients: list[Ingredient]
    steps: list[RecipeStep]
    servings: Optional[int] = None
    prep_time_minutes: Optional[int] = None
    cook_time_minutes: Optional[int] = None
    calories_per_serving: Optional[int] = None
    allergens: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "title": self.title,
            "servings": self.servings,
            "prep_time_minutes": self.prep_time_minutes,
            "cook_time_minutes": self.cook_time_minutes,
            "calories_per_serving": self.calories_per_serving,
            "allergens": self.allergens,
            "ingredients": [i.to_dict() for i in self.ingredients],
            "steps": [s.to_dict() for s in self.steps],
        }


def _preprocess_raw_text(raw_text: str) -> str:
    lines: list[str] = []
    in_spoken = False

    for line in raw_text.splitlines():
        stripped = line.strip()
        if not stripped:
            if in_spoken and lines and lines[-1] != "":
                lines.append("")
            continue

        if _SPOKEN_HEADER.match(stripped):
            in_spoken = True
            lines.append(stripped)
            continue

        if _HASHTAG_ONLY.match(stripped):
            continue
        if re.match(r"^original sound\b", stripped, re.I):
            continue

        cleaned = _MENTION_OR_TAG.sub("", stripped).strip()
        cleaned = re.sub(r"\s{2,}", " ", cleaned)
        if cleaned:
            lines.append(cleaned)

    return "\n".join(lines).strip()


def _split_ingredient_items(text: str) -> list[str]:
    parts = re.split(r",|\band\b", text, flags=re.I)
    return [p.strip(" .-") for p in parts if p.strip(" .-")]


def _sentence_steps(text: str) -> list[str]:
    chunks = re.split(r"(?<=[.!?])\s+|\n+", text)
    steps: list[str] = []
    for chunk in chunks:
        cleaned = chunk.strip(" .-")
        if len(cleaned) < 8:
            continue
        if _HASHTAG_ONLY.match(cleaned):
            continue
        steps.append(cleaned[0].upper() + cleaned[1:] if cleaned else cleaned)
    return steps


def _extract_duration(text: str) -> Optional[int]:
    match = re.search(r"(\d+)\s*(?:minute|min)", text, re.I)
    return int(match.group(1)) if match else None


def _heuristic_parse(raw_text: str) -> ParsedRecipe:
    text = _preprocess_raw_text(raw_text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0][:80] if lines else "Untitled Recipe"

    ingredients: list[Ingredient] = []
    steps: list[RecipeStep] = []
    in_ingredients = False
    in_steps = False
    in_spoken = False
    step_order = 0
    spoken_buffer: list[str] = []

    for line in lines[1:]:
        lower = line.lower()

        if _SPOKEN_HEADER.match(line):
            in_spoken = True
            in_ingredients = False
            in_steps = False
            continue

        if in_spoken:
            spoken_buffer.append(line)
            continue

        if re.match(r"^(ingredients?|what you need|you need|grocery list)", lower):
            in_ingredients = True
            in_steps = False
            match = _INGREDIENT_LINE.match(line)
            if match:
                for item in _split_ingredient_items(match.group(1)):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
            continue

        if re.match(r"^(instructions?|directions?|method|steps?)\b", lower):
            in_ingredients = False
            in_steps = True
            continue

        if in_ingredients and not in_steps:
            cleaned = _BULLET.sub("", line)
            if cleaned:
                for item in _split_ingredient_items(cleaned):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
        elif in_steps:
            cleaned = _STEP_PREFIX.sub("", _BULLET.sub("", line))
            if cleaned:
                step_order += 1
                steps.append(
                    RecipeStep(
                        order=step_order,
                        instruction=cleaned,
                        duration_minutes=_extract_duration(cleaned),
                    )
                )
        else:
            need_match = _INGREDIENT_LINE.match(line)
            if need_match:
                for item in _split_ingredient_items(need_match.group(1)):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
                continue

            cleaned = _STEP_PREFIX.sub("", _BULLET.sub("", line))
            if cleaned and len(cleaned) > 10:
                step_order += 1
                steps.append(
                    RecipeStep(
                        order=step_order,
                        instruction=cleaned,
                        duration_minutes=_extract_duration(cleaned),
                    )
                )

    if spoken_buffer:
        spoken_text = " ".join(spoken_buffer)
        for chunk in _sentence_steps(spoken_text):
            steps.append(
                RecipeStep(
                    order=len(steps) + 1,
                    instruction=chunk,
                    duration_minutes=_extract_duration(chunk),
                )
            )

    if not ingredients and not steps:
        chunks = [line for line in lines[1:] if len(line) > 12 and not _HASHTAG_ONLY.match(line)]
        for chunk in chunks[:12]:
            need_match = _INGREDIENT_LINE.match(chunk)
            if need_match:
                for item in _split_ingredient_items(need_match.group(1)):
                    ingredients.append(Ingredient(name=item, quantity="", group="Main"))
                continue
            step_order += 1
            steps.append(
                RecipeStep(
                    order=step_order,
                    instruction=chunk,
                    duration_minutes=_extract_duration(chunk),
                )
            )

    if not steps and text:
        for i, chunk in enumerate(_sentence_steps(text), start=1):
            steps.append(
                RecipeStep(order=i, instruction=chunk, duration_minutes=_extract_duration(chunk))
            )

    if not steps:
        steps = [
            RecipeStep(order=1, instruction="Review the full recipe text and cook as described."),
        ]

    return ParsedRecipe(
        title=title,
        ingredients=ingredients or [Ingredient(name="See recipe text", quantity="", group="Main")],
        steps=steps,
    )


def _normalize_nutrition(recipe: ParsedRecipe) -> ParsedRecipe:
    if recipe.calories_per_serving is not None and recipe.calories_per_serving <= 0:
        recipe.calories_per_serving = None
    recipe.allergens = sorted({a.strip().lower() for a in recipe.allergens if a and a.strip()})
    return recipe


def _recipe_is_usable(recipe: ParsedRecipe) -> bool:
    if not recipe.steps:
        return False
    if len(recipe.steps) == 1 and recipe.steps[0].instruction.startswith("Review the full recipe"):
        return False
    return True


def _optional_int(value: Any) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _recipe_from_dict(data: dict[str, Any]) -> ParsedRecipe:
    ingredients = [
        Ingredient(
            name=str(item.get("name", "")).strip(),
            quantity=str(item.get("quantity", "")),
            group=str(item.get("group", "Main") or "Main"),
        )
        for item in (data.get("ingredients") or [])
        if str(item.get("name", "")).strip()
    ]
    steps = [
        RecipeStep(
            order=_optional_int(step.get("order")) or idx,
            instruction=str(step.get("instruction", "")).strip(),
            duration_minutes=_optional_int(step.get("duration_minutes")),
            ingredients_used=[str(x) for x in (step.get("ingredients_used") or []) if x],
            equipment=[str(x) for x in (step.get("equipment") or []) if x],
        )
        for idx, step in enumerate(data.get("steps") or [], start=1)
        if str(step.get("instruction", "")).strip()
    ]
    steps.sort(key=lambda s: s.order)
    for i, step in enumerate(steps, start=1):
        step.order = i

    return ParsedRecipe(
        title=str(data.get("title", "Untitled Recipe")).strip() or "Untitled Recipe",
        servings=_optional_int(data.get("servings")),
        prep_time_minutes=_optional_int(data.get("prep_time_minutes")),
        cook_time_minutes=_optional_int(data.get("cook_time_minutes")),
        calories_per_serving=_optional_int(data.get("calories_per_serving")),
        allergens=[str(a) for a in (data.get("allergens") or []) if a],
        ingredients=ingredients,
        steps=steps,
    )


def _extract_json(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned, flags=re.I)
        cleaned = re.sub(r"\s*```$", "", cleaned)
    return json.loads(cleaned)


def _bedrock_parse(cleaned: str) -> Optional[ParsedRecipe]:
    client = boto3.client("bedrock-runtime", region_name=settings.aws_region)
    response = client.converse(
        modelId=settings.bedrock_parse_model,
        system=[{"text": SYSTEM_PROMPT}],
        messages=[{"role": "user", "content": [{"text": cleaned}]}],
        inferenceConfig={"maxTokens": 4096, "temperature": 0.3},
    )
    text_parts: list[str] = []
    for block in response.get("output", {}).get("message", {}).get("content", []):
        if isinstance(block, dict) and block.get("text"):
            text_parts.append(str(block["text"]))
    content = "\n".join(text_parts).strip()
    if not content:
        return None
    data = _extract_json(content)
    return _recipe_from_dict(data)


def parse_recipe(raw_text: str) -> tuple[ParsedRecipe, bool]:
    cleaned = _preprocess_raw_text(raw_text)
    if not cleaned:
        return _heuristic_parse(raw_text), False

    if not settings.feature_ai_enabled:
        return _heuristic_parse(cleaned), False

    try:
        recipe = _bedrock_parse(cleaned)
        if recipe is None or not _recipe_is_usable(recipe):
            return _heuristic_parse(cleaned), False
        return _normalize_nutrition(recipe), True
    except Exception:
        return _heuristic_parse(cleaned), False
