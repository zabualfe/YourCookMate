"""Normalize regional grocery wording to widely understood US cookbook English."""

from __future__ import annotations

import re

# Longest phrases first. Prefer US supermarket / cookbook names.
_PHRASE_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("beef mince", "ground beef"),
    ("minced beef", "ground beef"),
    ("pork mince", "ground pork"),
    ("minced pork", "ground pork"),
    ("chicken mince", "ground chicken"),
    ("minced chicken", "ground chicken"),
    ("turkey mince", "ground turkey"),
    ("minced turkey", "ground turkey"),
    ("lamb mince", "ground lamb"),
    ("minced lamb", "ground lamb"),
    ("veal mince", "ground veal"),
    ("minced veal", "ground veal"),
    ("meat mince", "ground meat"),
    ("minced meat", "ground meat"),
    ("caster sugar", "superfine sugar"),
    ("castor sugar", "superfine sugar"),
    ("icing sugar", "powdered sugar"),
    ("confectioners sugar", "powdered sugar"),
    ("plain flour", "all-purpose flour"),
    ("cornflour", "cornstarch"),
    ("bicarbonate of soda", "baking soda"),
    ("bicarb soda", "baking soda"),
    ("bicarb", "baking soda"),
    ("double cream", "heavy cream"),
    ("single cream", "light cream"),
    ("thickened cream", "heavy cream"),
    ("courgette", "zucchini"),
    ("courgettes", "zucchini"),
    ("aubergine", "eggplant"),
    ("aubergines", "eggplant"),
    ("capsicum", "bell pepper"),
    ("capsicums", "bell peppers"),
    ("spring onion", "green onion"),
    ("spring onions", "green onions"),
    ("coriander leaves", "cilantro"),
    ("fresh coriander", "cilantro"),
    ("coriander leaf", "cilantro"),
    ("rocket", "arugula"),
    ("swede", "rutabaga"),
    ("manage tout", "snow peas"),  # rare typo
    ("mangetout", "snow peas"),
    ("mange tout", "snow peas"),
    ("prawns", "shrimp"),
    ("prawn", "shrimp"),
    ("mince", "ground meat"),  # bare "mince" only — after meat-specific phrases
)

# Do not rewrite these "minced …" prep phrases.
_MINCED_PREP = re.compile(
    r"\bminced\s+(garlic|onion|ginger|shallot|shallots|chili|chilli|chile|herbs?|parsley)\b",
    re.I,
)


def normalize_grocery_english(text: str) -> str:
    """Rewrite regional ingredient wording to clear US grocery English."""
    if not text or not text.strip():
        return text

    # Protect minced-garlic style phrases from the bare "mince" rule.
    placeholders: list[str] = []

    def _stash(match: re.Match[str]) -> str:
        placeholders.append(match.group(0))
        return f"__MINCED_PREP_{len(placeholders) - 1}__"

    protected = _MINCED_PREP.sub(_stash, text)

    out = protected
    for src, dst in _PHRASE_REPLACEMENTS:
        out = re.sub(rf"\b{re.escape(src)}\b", dst, out, flags=re.IGNORECASE)

    for i, original in enumerate(placeholders):
        out = out.replace(f"__MINCED_PREP_{i}__", original)

    # Preserve original casing lightly: if whole input was Title Case-ish, leave replacements as written.
    return out
