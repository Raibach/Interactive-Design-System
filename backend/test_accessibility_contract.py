"""The dry run for the approval gate: one component missing two declarations, then complete.

Run it from anywhere:

    python3 backend/test_accessibility_contract.py

It uses the real contract module and the real WCAG 2.2 standard. It writes no file and touches no
catalogue entry; the 503 body it prints is the body the approval route raises.
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import accessibility_contract as contract_module


NODE = {
    "id": "40001010:25768",
    "name": "Submit Button",
    "type": "INSTANCE",
    "componentId": "1:2",
    "children": [
        {
            "id": "40001010:25769",
            "name": "Label",
            "type": "TEXT",
            "characters": "Submit",
        }
    ],
}


def main() -> int:
    print("WCAG standard:", contract_module.STANDARD_PATH)
    print("criteria in the standard:", len(contract_module.wcag_ids()))
    print()

    component_type = "button"
    first = contract_module.derive_contract(NODE, component_type, props=[])
    print("FIRST INGEST — no A11y annotations")
    print("  summary:", first["summary"])
    print("  complete:", first["complete"])
    print("  missing:", first["missing"])
    print()

    refusal = contract_module.gate(first)
    print("APPROVAL REFUSAL — HTTP 503 body")
    print(json.dumps(refusal["detail"], indent=2))
    print()

    if first["complete"]:
        print("FAIL: the contract without keyboard and announcement was called complete")
        return 1
    if first["missing"] != ["keyboard", "announcement"]:
        print(f"FAIL: expected ['keyboard', 'announcement'], got {first['missing']}")
        return 1
    if refusal["ok"]:
        print("FAIL: the gate passed an incomplete contract")
        return 1

    NODE["annotations"] = [
        {"labelMarkdown": "A11y: keyboard=Enter and Space activate"},
        {"labelMarkdown": "A11y: announce=state changes are announced"},
    ]
    second = contract_module.derive_contract(NODE, component_type, props=[])
    print("SECOND INGEST — A11y annotations added")
    print("  summary:", second["summary"])
    print("  complete:", second["complete"])
    print()

    verdict = contract_module.gate(second)
    if not second["complete"] or not verdict["ok"]:
        print("FAIL: the annotated contract did not pass")
        print(json.dumps(verdict.get("detail"), indent=2))
        return 1

    print("APPROVED CONTRACT")
    print(json.dumps(second, indent=2))
    print()

    print("COMPOSITION GATE")
    certified = dict(second)
    certified["requiredProperties"] = ["description"]
    entry = {"accessibility": certified}
    missing_property = contract_module.check_instance(
        entry, {"component": "Image"}, 3
    )
    print("  payload without the required property:")
    print(json.dumps(missing_property, indent=2))
    if missing_property is None or missing_property["error"]["code"] != "ACCESSIBILITY_PROPERTY_MISSING":
        print("FAIL: the composition gate passed a payload missing a required property")
        return 1

    present_property = contract_module.check_instance(
        entry, {"component": "Image", "description": "A chart of quarterly revenue"}, 3
    )
    if present_property is not None:
        print("FAIL: the composition gate refused a payload that carried the property")
        return 1

    uncertified = contract_module.check_instance(
        {"accessibility": first}, {"component": "Image"}, 4
    )
    print("  payload naming an uncertified component:")
    print(json.dumps(uncertified, indent=2))
    if uncertified is None or uncertified["error"]["code"] != "ACCESSIBILITY_NOT_CERTIFIED":
        print("FAIL: the composition gate passed an uncertified component")
        return 1

    legacy = contract_module.check_instance({}, {"component": "Image"}, 5)
    if legacy is not None:
        print("FAIL: a pre-contract entry was refused by the composition gate")
        return 1

    print()
    print("PASS: incomplete refused in detail, complete approved, composition enforced.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
