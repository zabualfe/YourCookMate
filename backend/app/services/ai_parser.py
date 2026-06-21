from __future__ import annotations

import json
import re
from typing import List, Optional, Tuple

from openai import OpenAI

from app.config import settings
from app.schemas.recipe import Ingredient, ParsedRecipe, RecipeStep

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


def _heuristic_parse(raw_text: str) -> ParsedRecipe:
    """Fallback parser when OpenAI is unavailable or returns empty output."""
    text = _preprocess_raw_text(raw_text)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    title = lines[0][:80] if lines else "Untitled Recipe"

    ingredients: List[Ingredient] = []
    steps: List[RecipeStep] = []
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
        for i, chunk in enumerate(_sentence_steps(spoken_text), start=1):
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
            steps.append(RecipeStep(order=i, instruction=chunk, duration_minutes=_extract_duration(chunk)))

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


def _extract_duration(text: str) -> Optional[int]:
    match = re.search(r"(\d+)\s*(?:minute|min)", text, re.I)
    return int(match.group(1)) if match else None


def _recipe_is_usable(recipe: ParsedRecipe) -> bool:
    if not recipe.steps:
        return False
    if len(recipe.steps) == 1 and recipe.steps[0].instruction.startswith("Review the full recipe"):
        return False
    return True


def parse_recipe(raw_text: str) -> Tuple[ParsedRecipe, bool]:
    cleaned = _preprocess_raw_text(raw_text)
    if not cleaned:
        return _heuristic_parse(raw_text), False

    if not settings.openai_api_key:
        return _heuristic_parse(cleaned), False

    try:
        client = OpenAI(api_key=settings.openai_api_key)
        response = client.chat.completions.create(
            model=settings.openai_model,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": cleaned},
            ],
            temperature=0.3,
        )

        content = response.choices[0].message.content
        if not content:
            return _heuristic_parse(cleaned), False

        data = json.loads(content)
        recipe = ParsedRecipe.model_validate(data)
        recipe.steps.sort(key=lambda s: s.order)
        for i, step in enumerate(recipe.steps, start=1):
            step.order = i

        if not _recipe_is_usable(recipe):
            return _heuristic_parse(cleaned), False

        return _normalize_nutrition(recipe), True
    except Exception:
        return _heuristic_parse(cleaned), False
