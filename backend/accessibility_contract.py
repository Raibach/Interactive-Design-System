"""The accessibility contract a component carries, and the gate that refuses an incomplete one.

THE RULE, IN ONE SENTENCE: a component may be drawn and previewed without an accessibility
contract, and it may not be approved into the catalogue until the contract declares its role,
its label, its keyboard behaviour and its screen-reader announcement.

WHERE THE DECLARATIONS COME FROM. The ingest already reads Figma annotations for `Data: name`.
The same annotation channel carries four declarations under an `A11y:` prefix:

    A11y: role=button
    A11y: label=Submit
    A11y: keyboard=Enter and Space activate
    A11y: announce=state changes are announced

The role may be derived from the component type when the type is unambiguous, and the label may
be read from a text layer, because both are facts the file states. Keyboard behaviour and
screen-reader announcement are never guessed: a value the file does not state is reported
missing, not invented.

WHAT THIS MODULE DOES NOT DO. It does not measure the design, render the component, write a file,
or read a database. It reads the node the ingest already read and returns a contract with its
findings. The caller decides where to report and where to refuse.

THE STANDARD. `standards/wcag-2.2.jsonld` is the machine-readable WCAG 2.2 standard. Every
identifier in a criterion is checked against it, so a criterion the standard does not contain is
a finding rather than a silent pass. If the file is absent this module raises: a missing standard
must never become an empty set that passes every claim.
"""
from __future__ import annotations

import json
import os
import re
from functools import lru_cache
from typing import Any, Iterator

STANDARD_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "standards", "wcag-2.2.jsonld"
)

# THE FOUR DECLARATIONS, IN THE ORDER THE ERROR NAMES THEM.
DECLARATIONS = ("role", "label", "keyboard", "announcement")

# A DECLARATION IS ONLY A DECLARATION IF THE CONTRACT CAN SAY WHERE IT CAME FROM. `inferred` is
# deliberately absent: a value the pipeline guessed is not a value the file stated.
DECLARATION_SOURCES = (
    "figma-annotation",
    "figma-text-layer",
    "derived-component-type",
    "ingest-request",
    "catalog-entry",
)

VERIFICATION_MODES = ("automated", "manual", "unverified")

# A COMPONENT THAT GENUINELY HAS NO LABEL OR NO KEYBOARD BEHAVIOUR DECLARES THAT FACT EXPLICITLY.
# Silence is not the same answer.
NOT_APPLICABLE = {
    "not-applicable",
    "not applicable",
    "none",
    "none required",
    "decorative",
    "presentational",
}

_ROLE_BY_TYPE = {
    "button": "button",
    "textfield": "textbox",
    "text": "text",
    "image": "img",
    "card": "group",
    "row": "group",
    "column": "group",
    "generic": "group",
}

_INTERACTIVE_TYPES = {
    "button",
    "textfield",
    "link",
    "checkbox",
    "radio",
    "switch",
    "slider",
    "tab",
    "menu",
    "combobox",
}

_TEXT_TYPES = {"text", "button", "textfield"}

_STATEFUL_TYPES = {"button", "textfield", "checkbox", "radio", "switch", "slider", "tab"}

_A11Y_RE = re.compile(
    r"^\s*A11y\s*:\s*(role|label|keyboard|announcement|announce)\s*=\s*(.+?)\s*$",
    re.IGNORECASE,
)


@lru_cache(maxsize=1)
def load_standard() -> dict[str, dict[str, Any]]:
    """The standard's success criteria, keyed by identifier.

    THE FILE IS REQUIRED. A missing standard raises rather than returning an empty map, because
    an empty map would make every criterion unrecognised and every unknown criterion a pass.
    """
    try:
        with open(STANDARD_PATH, encoding="utf-8") as standard_file:
            document = json.load(standard_file)
    except FileNotFoundError as missing:
        raise RuntimeError(
            f"the WCAG standard is missing at {STANDARD_PATH}; the accessibility gate cannot "
            "check a criterion without it"
        ) from missing
    except json.JSONDecodeError as broken:
        raise RuntimeError(
            f"the WCAG standard at {STANDARD_PATH} is not valid JSON: {broken}"
        ) from broken

    criteria: dict[str, dict[str, Any]] = {}
    for principle in document.get("principles") or []:
        if not isinstance(principle, dict):
            continue
        for guideline in principle.get("guidelines") or []:
            if not isinstance(guideline, dict):
                continue
            for criterion in guideline.get("successCriteria") or []:
                if not isinstance(criterion, dict):
                    continue
                identifier = str(criterion.get("identifier") or "").strip()
                if identifier:
                    criteria[identifier] = {
                        "level": criterion.get("level"),
                        "name": criterion.get("name"),
                        "url": criterion.get("url"),
                    }
    if not criteria:
        raise RuntimeError(
            f"the WCAG standard at {STANDARD_PATH} states no success criteria"
        )
    return criteria


def wcag_ids() -> set[str]:
    """Every identifier the standard holds, for a caller that wants to show the vocabulary."""
    return set(load_standard())


def _walk(node: Any) -> Iterator[dict[str, Any]]:
    if not isinstance(node, dict):
        return
    yield node
    for child in node.get("children") or []:
        if isinstance(child, dict):
            yield from _walk(child)


def _annotation_texts(node: Any) -> Iterator[tuple[dict[str, Any], str]]:
    """Every annotation on the node and its children, in the order the file states them."""
    for current in _walk(node):
        for annotation in current.get("annotations") or []:
            if isinstance(annotation, dict):
                text = annotation.get("labelMarkdown") or annotation.get("label") or ""
            else:
                text = annotation
            text = str(text).strip()
            if text:
                yield current, text


def _first_text(node: Any) -> tuple[str, str] | None:
    """The first text layer's words and node id, or None when the design states no words."""
    for current in _walk(node):
        if str(current.get("type", "")).upper() != "TEXT":
            continue
        text = str(current.get("characters") or "").strip()
        if text:
            return text, str(current.get("id") or "")
    return None


def _declarations(node: Any, supplied: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    """The declarations the file and the caller state, with their sources.

    THE FIRST STATEMENT OF A KEY WINS. A later annotation does not overwrite an earlier one,
    because the file's order is the designer's order and the contract is a record of what the
    file said, not a merge that silently chooses.
    """
    found: dict[str, dict[str, Any]] = {}

    if isinstance(supplied, dict):
        for key in DECLARATIONS:
            raw = supplied.get(key)
            if isinstance(raw, dict):
                value = str(raw.get("value") or "").strip()
                source = str(raw.get("source") or "ingest-request").strip()
                if value:
                    found[key] = {"value": value, "source": source}
            elif isinstance(raw, str) and raw.strip():
                found[key] = {"value": raw.strip(), "source": "ingest-request"}

    for current, text in _annotation_texts(node):
        match = _A11Y_RE.match(text)
        if not match:
            continue
        key = match.group(1).lower()
        if key == "announce":
            key = "announcement"
        if key in found:
            continue
        found[key] = {
            "value": match.group(2).strip(),
            "source": "figma-annotation",
            "nodeId": str(current.get("id") or ""),
        }

    return found


def _criteria(component_type: str) -> list[dict[str, Any]]:
    """The WCAG 2.2 criteria this component's role makes applicable.

    THESE ARE CLAIMS, NOT TEST RESULTS. The verification mode says how the claim is checked: the
    structure and the declared name are read from the component; keyboard behaviour and focus are
    manual reviews of the declaration; target size is measured from the node.
    """
    component = str(component_type or "").strip().lower()
    criteria: list[dict[str, Any]] = [
        {
            "id": "name-role-value",
            "statement": "The component exposes its name, role and value to assistive technology.",
            "verification": "automated",
            "wcag": ["4.1.2"],
        },
        {
            "id": "info-and-relationships",
            "statement": "The component's structure is programmatically determinable.",
            "verification": "automated",
            "wcag": ["1.3.1"],
        },
    ]
    if component in _INTERACTIVE_TYPES:
        criteria.extend(
            [
                {
                    "id": "keyboard",
                    "statement": "The declared keyboard behaviour is the component's own.",
                    "verification": "manual",
                    "wcag": ["2.1.1"],
                },
                {
                    "id": "focus-visible",
                    "statement": "The component carries a visible focus indicator.",
                    "verification": "manual",
                    "wcag": ["2.4.7"],
                },
                {
                    "id": "target-size",
                    "statement": "The component's target meets the minimum size.",
                    "verification": "automated",
                    "wcag": ["2.5.8"],
                },
            ]
        )
    if component in _TEXT_TYPES:
        criteria.append(
            {
                "id": "contrast",
                "statement": "Text meets the minimum contrast against its surface.",
                "verification": "automated",
                "wcag": ["1.4.3"],
            }
        )
    if component in _STATEFUL_TYPES:
        criteria.append(
            {
                "id": "state-not-by-colour-alone",
                "statement": "A state change is carried by more than colour.",
                "verification": "manual",
                "wcag": ["1.4.1"],
            }
        )
    return criteria


def _label_properties(props: Any) -> list[str]:
    """The declared properties that can carry an accessible name, in the contract's order."""
    names: list[str] = []
    for prop in props or []:
        name = prop.get("name") if isinstance(prop, dict) else prop
        name = str(name or "").strip()
        if name and name.lower() in {
            "label",
            "description",
            "alt",
            "accessibleName",
            "accessible_name",
            "aria-label",
            "arialabel",
        }:
            if name not in names:
                names.append(name)
    return names


def _rules(component_type: str, props: Any) -> list[dict[str, Any]]:
    """The payload rules the catalogue can check when the agent composes the component.

    A FIGMA-INGESTED COMPONENT carries its accessible name in its own text, so the rule that
    matters is the one for a component whose name arrives as a payload property. The rule is
    written only when such a property exists; a rule naming a property the element does not have
    would refuse every payload for no reason.
    """
    label_property = next(iter(_label_properties(props)), "")
    if not label_property:
        return []
    return [
        {
            "id": "accessible-name-required",
            "when": {"component": {"equals": str(component_type or "")}},
            "requireAllOf": [label_property],
            "reason": "A component with no accessible name is silent to a screen reader.",
            "severity": "error",
        }
    ]


def derive_contract(
    node: Any,
    component_type: str,
    props: Any = None,
    supplied: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the contract for one Figma node, with its findings already decided.

    THE FUNCTION IS PURE: same node, same contract. It reads annotations and text, applies the
    fixed role table, and returns the four declarations, the criteria the role makes applicable,
    and the rules a payload will be checked against. It never changes the node.
    """
    declarations = _declarations(node, supplied)
    component = str(component_type or "").strip().lower()

    if "role" not in declarations:
        role = _ROLE_BY_TYPE.get(component)
        if role:
            declarations["role"] = {
                "value": role,
                "source": "derived-component-type",
            }

    if "label" not in declarations:
        words = _first_text(node)
        if words:
            text, node_id = words
            declarations["label"] = {
                "value": text,
                "source": "figma-text-layer",
                "nodeId": node_id,
            }

    contract = {
        "version": "1.0",
        "level": "AA",
        "componentType": component_type,
        "declarations": {
            key: declarations.get(key)
            for key in DECLARATIONS
        },
        "criteria": _criteria(component),
        "rules": _rules(component, props),
        "requiredProperties": _label_properties(props),
        "governance": {
            "owner": "the approving designer",
            "lastReviewed": "",
        },
    }
    verdict = validate_contract(contract)
    contract["complete"] = verdict["complete"]
    contract["missing"] = verdict["missing"]
    contract["findings"] = verdict["findings"]
    contract["summary"] = _summary(contract, verdict)
    return contract


def validate_contract(contract: Any) -> dict[str, Any]:
    """Decide whether the contract declares everything the four checks need.

    Findings are errors or warnings. Only an error keeps `complete` false: a warning is a
    statement the record should carry, not a reason to refuse the component.
    """
    findings: list[dict[str, Any]] = []
    missing: list[str] = []

    if not isinstance(contract, dict):
        for key in DECLARATIONS:
            missing.append(key)
            findings.append(
                {
                    "path": f"declarations.{key}",
                    "code": "MISSING_DECLARATION",
                    "severity": "error",
                    "message": f"the contract is absent, so {key} is not declared",
                }
            )
        return {
            "complete": False,
            "missing": missing,
            "findings": sorted(findings, key=lambda row: (row["path"], row["code"])),
        }

    declarations = contract.get("declarations")
    if not isinstance(declarations, dict):
        declarations = {}

    for key in DECLARATIONS:
        declaration = declarations.get(key)
        if declaration is None:
            missing.append(key)
            findings.append(
                {
                    "path": f"declarations.{key}",
                    "code": "MISSING_DECLARATION",
                    "severity": "error",
                    "message": f"{key} is not declared",
                }
            )
            continue
        if not isinstance(declaration, dict):
            findings.append(
                {
                    "path": f"declarations.{key}",
                    "code": "INVALID_DECLARATION",
                    "severity": "error",
                    "message": f"{key} must be an object with a value and a source",
                }
            )
            continue
        value = declaration.get("value")
        if not isinstance(value, str) or not value.strip():
            missing.append(key)
            findings.append(
                {
                    "path": f"declarations.{key}.value",
                    "code": "EMPTY_DECLARATION",
                    "severity": "error",
                    "message": f"{key} is declared with no value",
                }
            )
        source = declaration.get("source")
        if source not in DECLARATION_SOURCES:
            findings.append(
                {
                    "path": f"declarations.{key}.source",
                    "code": "UNSOURCED_DECLARATION",
                    "severity": "error",
                    "message": (
                        f"{key} states source {source!r}; a declaration must name one of "
                        f"{', '.join(DECLARATION_SOURCES)}"
                    ),
                }
            )

    criteria = contract.get("criteria")
    if not isinstance(criteria, list) or not criteria:
        findings.append(
            {
                "path": "criteria",
                "code": "MISSING_CRITERIA",
                "severity": "error",
                "message": "the contract states no WCAG criteria",
            }
        )
    else:
        known = load_standard()
        for index, criterion in enumerate(criteria):
            if not isinstance(criterion, dict):
                findings.append(
                    {
                        "path": f"criteria[{index}]",
                        "code": "INVALID_CRITERION",
                        "severity": "error",
                        "message": "a criterion must be an object",
                    }
                )
                continue
            identifiers = criterion.get("wcag")
            if not isinstance(identifiers, list) or not identifiers:
                findings.append(
                    {
                        "path": f"criteria[{index}].wcag",
                        "code": "MISSING_WCAG_IDENTIFIER",
                        "severity": "error",
                        "message": "the criterion names no WCAG identifier",
                    }
                )
                continue
            for identifier in identifiers:
                if str(identifier) not in known:
                    findings.append(
                        {
                            "path": f"criteria[{index}].wcag",
                            "code": "UNKNOWN_WCAG_CRITERION",
                            "severity": "error",
                            "message": (
                                f"the standard does not contain WCAG {identifier}; the claim "
                                "cannot be checked against it"
                            ),
                        }
                    )
            mode = criterion.get("verification")
            if mode not in VERIFICATION_MODES:
                findings.append(
                    {
                        "path": f"criteria[{index}].verification",
                        "code": "INVALID_VERIFICATION_MODE",
                        "severity": "error",
                        "message": (
                            f"verification {mode!r} is not one of "
                            f"{', '.join(VERIFICATION_MODES)}"
                        ),
                    }
                )

    rules = contract.get("rules")
    if rules is not None and not isinstance(rules, list):
        findings.append(
            {
                "path": "rules",
                "code": "INVALID_RULES",
                "severity": "error",
                "message": "rules must be a list",
            }
        )

    return {
        "complete": not any(row["severity"] == "error" for row in findings),
        "missing": missing,
        "findings": sorted(findings, key=lambda row: (row["path"], row["code"])),
    }


def _summary(contract: dict[str, Any], verdict: dict[str, Any]) -> str:
    """One sentence the preview and the chat can show without re-deriving the findings."""
    declarations = contract.get("declarations") or {}
    present = [
        f"{key} ({declaration.get('source')})"
        for key, declaration in declarations.items()
        if isinstance(declaration, dict) and declaration.get("value")
    ]
    if verdict["complete"]:
        return "Accessibility contract complete: " + ", ".join(present) + "."
    missing = verdict["missing"]
    return (
        "Accessibility contract incomplete. Present: "
        + (", ".join(present) if present else "none")
        + ". Missing: "
        + ", ".join(missing)
        + "."
    )


def gate(contract: Any) -> dict[str, Any]:
    """The refusal the approval boundary raises, with everything the designer needs to repair it.

    A COMPLETE CONTRACT IS NOT A WARNING. The caller receives `ok: True` and the contract, and
    writes nothing itself. An incomplete contract returns the exact detail body: the missing
    keys, every declaration with its source (or null), the findings, and the next step.
    """
    verdict = validate_contract(contract)
    if verdict["complete"]:
        return {"ok": True, "contract": contract, "findings": []}

    declarations = {}
    for key in DECLARATIONS:
        raw = (contract or {}).get("declarations", {}).get(key) if isinstance(contract, dict) else None
        declarations[key] = raw if isinstance(raw, dict) else None

    missing = verdict["missing"]
    message = (
        "Nothing was written. The component's accessibility contract is incomplete. "
        "Missing: " + ", ".join(missing) + "."
        if missing
        else "Nothing was written. The component's accessibility contract has errors."
    )
    next_step = (
        "Add the missing declarations to the Figma layer as A11y annotations "
        "(A11y: keyboard=<behaviour>, A11y: announce=<announcement>), then ingest again. "
        "The catalogue was not changed."
    )
    return {
        "ok": False,
        "contract": contract,
        "missing": missing,
        "findings": verdict["findings"],
        "detail": {
            "error": "ACCESSIBILITY_CONTRACT_INCOMPLETE",
            "message": message,
            "missing": missing,
            "declarations": declarations,
            "findings": verdict["findings"],
            "summary": (
                "Accessibility contract incomplete. Missing: " + ", ".join(missing) + "."
            ),
            "nextStep": next_step,
        },
    }


def check_instance(
    entry: Any,
    component: dict[str, Any],
    index: int = 0,
) -> dict[str, Any] | None:
    """The per-payload refusal, or None when the component may be composed.

    ONLY AN ENTRY THAT CARRIES THE BLOCK IS CHECKED. The hand-written entries predate the
    contract, and refusing them would break the running application; the approval and accept
    gates are what keep a new entry from arriving without the block. An entry that carries the
    block must be complete, and every property the block marks as required must be present in
    the payload.
    """
    if not isinstance(entry, dict):
        return None
    accessibility = entry.get("accessibility")
    if not isinstance(accessibility, dict):
        return None

    name = str(component.get("component") or "")
    if accessibility.get("complete") is not True:
        missing = accessibility.get("missing") or []
        stated = ", ".join(str(item) for item in missing) if missing else "an incomplete declaration"
        return {
            "error": {
                "code": "ACCESSIBILITY_NOT_CERTIFIED",
                "surfaceId": "main",
                "path": f"/components/{index}/component",
                "message": (
                    f"Component '{name}' is in the catalogue but its accessibility contract is "
                    f"not complete. Missing: {stated}. The surface was not composed."
                ),
            }
        }

    for prop in accessibility.get("requiredProperties") or []:
        if prop not in component:
            return {
                "error": {
                    "code": "ACCESSIBILITY_PROPERTY_MISSING",
                    "surfaceId": "main",
                    "path": f"/components/{index}/{prop}",
                    "message": (
                        f"Component '{name}' requires the property '{prop}' under its "
                        "accessibility contract. The payload does not carry it, so the surface "
                        "was not composed."
                    ),
                }
            }
        value = component.get(prop)
        if isinstance(value, str) and not value.strip():
            return {
                "error": {
                    "code": "ACCESSIBILITY_PROPERTY_MISSING",
                    "surfaceId": "main",
                    "path": f"/components/{index}/{prop}",
                    "message": (
                        f"Component '{name}' requires the property '{prop}' under its "
                        "accessibility contract, and the payload carries an empty value. "
                        "The surface was not composed."
                    ),
                }
            }
    return None
