"""Tests for the design identity key: joining, normalization, sibling collisions, and the shape check."""
import unittest

from design_identity import (
    SEPARATOR,
    KeyCollision,
    is_valid_key,
    name_key,
    normalize_name,
    sibling_keys,
)


class NameKeyTests(unittest.TestCase):
    def test_plain_name(self) -> None:
        self.assertEqual(name_key([], "Button"), "button")

    def test_nested_parent_path(self) -> None:
        self.assertEqual(
            name_key(["Header", "Card"], "Button"),
            "header" + SEPARATOR + "card" + SEPARATOR + "button",
        )

    def test_siblings_with_the_same_name_collide(self) -> None:
        with self.assertRaises(KeyCollision) as caught:
            sibling_keys([], ["Button", "  button  "])
        self.assertEqual(caught.exception.first, "Button")
        self.assertEqual(caught.exception.second, "  button  ")
        self.assertEqual(caught.exception.key, "button")

    def test_same_name_under_different_parents_does_not_collide(self) -> None:
        self.assertNotEqual(name_key(["A"], "Button"), name_key(["B"], "Button"))

    def test_normalization_collapses_whitespace_and_case(self) -> None:
        self.assertEqual(normalize_name("  Card \n  Title  "), "card title")
        self.assertEqual(
            name_key(["  Header  "], "  Card\n Title "),
            "header" + SEPARATOR + "card title",
        )

    def test_unicode_is_preserved(self) -> None:
        self.assertEqual(name_key([], "Café"), "café")

    def test_a_produced_key_is_valid(self) -> None:
        self.assertTrue(is_valid_key(name_key(["Header"], "Card")))

    def test_an_invalid_key_is_rejected(self) -> None:
        self.assertFalse(is_valid_key("Header" + SEPARATOR + "Card"))
        self.assertFalse(is_valid_key(""))
        self.assertFalse(is_valid_key("header" + SEPARATOR + SEPARATOR + "card"))
        self.assertFalse(is_valid_key("header" + SEPARATOR + "card "))

    def test_a_control_character_is_rejected(self) -> None:
        with self.assertRaises(ValueError):
            name_key([], "Bad" + SEPARATOR + "Name")
        with self.assertRaises(ValueError):
            name_key([], "Bad\x00Name")

    def test_a_single_string_parent_is_rejected(self) -> None:
        with self.assertRaises(TypeError):
            name_key("Header", "Card")


if __name__ == "__main__":
    unittest.main()
