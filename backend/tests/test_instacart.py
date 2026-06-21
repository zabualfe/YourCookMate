"""Unit tests for Instacart ingredient parsing."""

from __future__ import annotations

import unittest

from app.schemas.recipe import Ingredient
from app.services.instacart import (
    ingredients_fingerprint,
    ingredients_to_line_items,
    parse_quantity_string,
)


class ParseQuantityTests(unittest.TestCase):
    def test_cups(self) -> None:
        self.assertEqual(parse_quantity_string("2 cups"), (2.0, "cup"))

    def test_half_teaspoon(self) -> None:
        self.assertEqual(parse_quantity_string("1/2 tsp"), (0.5, "teaspoon"))

    def test_mixed_fraction(self) -> None:
        self.assertEqual(parse_quantity_string("1 1/2 tbsp"), (1.5, "tablespoon"))

    def test_empty_defaults_to_each(self) -> None:
        self.assertEqual(parse_quantity_string(""), (1.0, "each"))

    def test_count_only(self) -> None:
        self.assertEqual(parse_quantity_string("3"), (3.0, "each"))

    def test_glued_grams(self) -> None:
        self.assertEqual(parse_quantity_string("400g"), (400.0, "gram"))

    def test_ounces(self) -> None:
        self.assertEqual(parse_quantity_string("8 oz"), (8.0, "ounce"))


class LineItemsTests(unittest.TestCase):
    def test_maps_ingredients(self) -> None:
        items = ingredients_to_line_items(
            [
                Ingredient(name="flour", quantity="2 cups", group="Main"),
                Ingredient(name="salt", quantity="1 tsp", group="Main"),
            ]
        )
        self.assertEqual(len(items), 2)
        self.assertEqual(items[0]["name"], "flour")
        self.assertEqual(items[0]["line_item_measurements"][0]["unit"], "cup")
        self.assertEqual(items[0]["line_item_measurements"][0]["quantity"], 2.0)
        self.assertIn("2 cups", items[0]["display_text"])

    def test_skips_blank_names(self) -> None:
        items = ingredients_to_line_items([Ingredient(name="  ", quantity="1 cup", group="Main")])
        self.assertEqual(items, [])


class FingerprintTests(unittest.TestCase):
    def test_stable_for_same_ingredients(self) -> None:
        ings = [Ingredient(name="Eggs", quantity="3", group="Main")]
        self.assertEqual(ingredients_fingerprint(ings), ingredients_fingerprint(ings))

    def test_changes_when_ingredient_changes(self) -> None:
        a = [Ingredient(name="milk", quantity="1 cup", group="Main")]
        b = [Ingredient(name="milk", quantity="2 cups", group="Main")]
        self.assertNotEqual(ingredients_fingerprint(a), ingredients_fingerprint(b))


if __name__ == "__main__":
    unittest.main()
