"""The design identity key: a layer's parent path plus its name, normalized, with the uniqueness rule and no node-ID dependency."""
from __future__ import annotations

import unicodedata
from collections.abc import Sequence

# THE JOIN RULE. Components are joined with U+001F, the ASCII unit separator. A slash or a double
# colon can appear inside a Figma layer name, and two different paths would then produce one key;
# U+001F is not printable, and `normalize_name` rejects it explicitly (and rejects every other
# non-whitespace control character), so no component can contain the separator and the key is
# unambiguous. Components are outermost first, the order the design tree walks them:
# ("Header", "Card") + "Button" -> "header\x1fcard\x1fbutton".
SEPARATOR = "\x1f"

# THE NORMALIZATION RULE. Each component is Unicode NFC, casefolded, then NFC again; runs of
# whitespace become one space and the ends are stripped. Casefold, not lower(), because it is the
# Unicode case-insensitive form and handles scripts where lower() is insufficient. Unicode is
# preserved, not folded or transliterated: an accented or non-Latin name keeps its characters, so
# two different names cannot become one key. Control characters are not preserved: the separator
# is rejected even though Python classifies U+001F as whitespace, and every other non-whitespace
# control character is rejected; tab, newline and the other whitespace controls are collapsed.
#
# NO EXISTING NORMALIZER FITS. `design_renderer._class_name` is a CSS class-name slug: it
# ASCII-folds and collapses every run of non-alphanumerics, so "Card Title", "card-title" and
# "Card/Title" become one string. Reusing it here would merge layers this module must keep apart.
_MAX_KEY_LENGTH = 512


def normalize_name(name: str) -> str:
    """The one canonical form of a layer name. Every later step calls this, not its own copy."""
    if not isinstance(name, str):
        raise TypeError("a layer name must be a string")
    for character in name:
        if character == SEPARATOR:
            raise ValueError(
                f"a layer name cannot contain the separator U+{ord(character):04X}"
            )
        if unicodedata.category(character) == "Cc" and not character.isspace():
            raise ValueError(
                f"a layer name cannot contain the control character U+{ord(character):04X}"
            )
    folded = unicodedata.normalize("NFC", name).casefold()
    canonical = unicodedata.normalize("NFC", folded)
    collapsed = " ".join(canonical.split())
    if not collapsed:
        raise ValueError("a layer name cannot be empty after normalization")
    return collapsed


def name_key(parent_path: Sequence[str], layer_name: str) -> str:
    """The deterministic key for one layer: its parent path and its name, normalized and joined."""
    if isinstance(parent_path, str):
        raise TypeError("parent_path must be a sequence of layer names, not one string")
    parts = [normalize_name(component) for component in parent_path]
    parts.append(normalize_name(layer_name))
    return SEPARATOR.join(parts)


class KeyCollision(ValueError):
    """Two siblings normalize to one name key; the design cannot tell them apart by name."""

    def __init__(self, key: str, first: str, second: str) -> None:
        self.key = key
        self.first = first
        self.second = second
        super().__init__(
            f"two siblings share the name key {key!r}: {first!r} and {second!r}"
        )


def sibling_keys(parent_path: Sequence[str], layer_names: Sequence[str]) -> list[str]:
    """The keys for one parent's children. A duplicate key raises KeyCollision, never merges.

    Sibling uniqueness is an exception rather than a returned flag because a collision is not a
    result a caller may ignore: two layers with one key would be written as one identity. Layers
    with the same name under different parents do not collide; their parent paths differ.
    """
    if isinstance(layer_names, str):
        raise TypeError("layer_names must be a sequence of names, not one string")
    seen: dict[str, str] = {}
    keys: list[str] = []
    for layer_name in layer_names:
        key = name_key(parent_path, layer_name)
        if key in seen:
            raise KeyCollision(key, seen[key], layer_name)
        seen[key] = layer_name
        keys.append(key)
    return keys


def is_valid_key(key: str) -> bool:
    """True when the string is already a key this module would produce.

    THIS REPLACES THE TAG SHAPE CHECK. The old check constrained a file-name-shaped tag; this key
    is not a file name, and the tag remains only as a location field in the later steps. The
    512-character bound is a storage guard, not the tag's 120-character file-name limit.
    """
    if not isinstance(key, str) or not key or len(key) > _MAX_KEY_LENGTH:
        return False
    parts = key.split(SEPARATOR)
    if any(not part for part in parts):
        return False
    for part in parts:
        try:
            if normalize_name(part) != part:
                return False
        except (TypeError, ValueError):
            return False
    return True
