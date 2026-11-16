"""THE CATALOG WRITE — an approved element replaces the element it is a new version of.

THE PROCESS IT SERVES (owner, 2026-11-16): a person takes a component that is already in the
library — the composer's text area, say — changes its drop shadow, ingests it, and it lands as a
pending card. Approving that card REPLACES the element in the Lit catalogue, so the composer draws
the new version. It is not a new name beside the old one, and it is not a copy: one element, one
entry, the newest definition.

WHAT THAT MEANS FOR THE RULES
  * a name that already exists is a REPLACEMENT, not a conflict. The old entry is traded for the
    new one in a single file operation, so nothing ever observes two definitions of one name;
  * a name that does not exist is an ADD, and it joins `$defs/anyComponent` as well, because a
    component the union does not reference cannot be named in a payload;
  * both cases are gated by the card's accessibility contract first; an incomplete contract
    refuses and nothing is written.

NOTHING IS WRITTEN IN PLACE. The catalogue is written to a temporary file beside it and renamed
over the target, so a half-written file never exists at the path. The acceptance receipt is a
separate act, recorded afterwards by the caller, which is what makes the receipt a claim about work
already done.
"""
from __future__ import annotations

import json
import os
import tempfile
from typing import Any

COMMON = "https://a2ui.org/specification/v0_9/common_types.json"

# THE PROP KINDS, and the schema each one carries. A raw string for a component reference or for
# children is the defect the standard refuses, so the kind decides the type and there is no default
# that guesses.
_PROP_SCHEMA: dict[str, dict[str, Any]] = {
    "text": {"$ref": f"{COMMON}#/$defs/DynamicString"},
    "number": {"$ref": f"{COMMON}#/$defs/DynamicNumber"},
    "boolean": {"$ref": f"{COMMON}#/$defs/DynamicBoolean"},
    "componentRef": {"$ref": f"{COMMON}#/$defs/ComponentId"},
    "children": {"$ref": f"{COMMON}#/$defs/ChildList"},
    "array": {"oneOf": [{"type": "array"}, {"$ref": f"{COMMON}#/$defs/DataBinding"}]},
    "object": {"type": "object"},
}


class CatalogWriteRefused(RuntimeError):
    """The entry was not written, and this is why. The caller states it; nothing is substituted."""

    def __init__(self, code: str, message: str, detail: dict[str, Any] | None = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.detail = detail or {}


def build_entry(card: dict[str, Any]) -> dict[str, Any]:
    """The catalogue entry for an approved element, from the card's own record.

    The name, the description, the props and the required list come from the card, because the card
    is what the person approved. The accessibility declarations travel under `x-a11y` — the record
    of why the element is allowed to exist — and never under `accessibility`, which the published
    types already use for an instance's own attributes.
    """
    name = str(card.get("element_name") or "").strip()
    if not name:
        raise CatalogWriteRefused("CATALOG_NAME_INVALID", "the card names no element")
    for char in name:
        if char.isspace() or ord(char) < 32:
            raise CatalogWriteRefused(
                "CATALOG_NAME_INVALID",
                f"the element name {name!r} contains whitespace or a control character",
            )
    description = str(card.get("description") or "").strip()
    if not description:
        raise CatalogWriteRefused(
            "CATALOG_DESCRIPTION_MISSING",
            f"the card for {name} carries no description; a component the model cannot read is not "
            f"usable, so nothing was written",
        )

    props = card.get("props") or {}
    if not isinstance(props, dict):
        raise CatalogWriteRefused("CATALOG_PROPS_INVALID", f"the card for {name} has no prop map")
    properties: dict[str, Any] = {"component": {"const": name}}
    for prop_name, declared in props.items():
        kind = str((declared or {}).get("kind") or "")
        if kind not in _PROP_SCHEMA:
            raise CatalogWriteRefused(
                "CATALOG_PROP_KIND_UNKNOWN",
                f"the prop {prop_name!r} on {name} is declared as {kind!r}; the catalogue has no "
                f"type for that kind",
            )
        properties[str(prop_name)] = dict(_PROP_SCHEMA[kind])

    required = [str(item) for item in (card.get("required") or []) if str(item)]
    if "component" not in required:
        required.insert(0, "component")
    for item in required:
        if item != "component" and item not in properties:
            raise CatalogWriteRefused(
                "CATALOG_REQUIRED_UNKNOWN",
                f"{name} requires {item!r}, which its prop map does not declare",
            )

    entry: dict[str, Any] = {
        "type": "object",
        "allOf": [
            {"$ref": f"{COMMON}#/$defs/ComponentCommon"},
            {"$ref": "#/$defs/CatalogComponentCommon"},
            {
                "type": "object",
                "description": description,
                "properties": properties,
                "required": required,
            },
        ],
        "unevaluatedProperties": False,
    }
    declarations = card.get("x_a11y") or card.get("x-a11y")
    if isinstance(declarations, dict) and declarations:
        entry["x-a11y"] = declarations
    return entry


def apply(catalogue: dict[str, Any], name: str, entry: dict[str, Any]) -> dict[str, Any]:
    """The catalogue with this element's entry replaced, or added. The input is not modified.

    A name that already exists is a NEW VERSION of that element: its entry is replaced and the
    union is left alone. A name that does not exist is added, and its union reference is appended,
    because an entry the union does not name cannot be used in a payload.
    """
    updated = json.loads(json.dumps(catalogue))
    components = updated.setdefault("components", {})
    existed = name in components
    components[name] = entry
    if not existed:
        union = updated.setdefault("$defs", {}).setdefault("anyComponent", {}).setdefault("oneOf", [])
        reference = f"#/components/{name}"
        if not any(isinstance(row, dict) and row.get("$ref") == reference for row in union):
            union.append({"$ref": reference})
    return updated


def write(catalogue_path: str, catalogue: dict[str, Any]) -> None:
    """Write the whole catalogue, once, by replacing the file in a single rename.

    A reader either sees the previous file or the new one. There is no moment at which the path
    holds half a catalogue.
    """
    directory = os.path.dirname(os.path.abspath(catalogue_path))
    handle, temporary = tempfile.mkstemp(prefix=".catalog-", suffix=".json", dir=directory)
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as stream:
            json.dump(catalogue, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, catalogue_path)
    except BaseException:
        if os.path.exists(temporary):
            os.unlink(temporary)
        raise
