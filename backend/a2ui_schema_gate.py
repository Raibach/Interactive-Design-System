"""THE RUNTIME SCHEMA GATE — what "A2UI compliant" means, enforced instead of asserted.

`validate_a2ui_components` used to check two things: that a component carried an `id`, and that its
name was a key in the catalogue. That is a name allowlist. It let any payload through whose words
were spelled right, whatever its props, children or bindings looked like, so nothing that reached a
surface had been structurally checked by the backend.

This module is the structural check. It asks the standard's own schema, for the named component,
with the catalogue the surface resolved — and the answer is the standard's, not a second opinion:

  * the shared types are the VENDORED copy at `standards/a2ui-common-types-v0_9.json`, not the live
    URL, so a network failure cannot change what the product accepts;
  * the sibling document those types reach through `FunctionCall` is vendored at
    `standards/a2ui-function-catalog-v0_9.json`. The published address answers HTTP 404, and its
    absence is what stopped every entry with a text, number or true/false property from compiling.
    The definition matches nothing, because no catalogue here declares a function vocabulary;
  * the validator is Ajv 2020-12, called through `a2ui_schema_validate.mjs`, which is the same
    library and settings as `design_A2UI/tests/step0-verify.mjs`. One question, one answer.

NOTHING IS SUBSTITUTED AND NOTHING FALLS BACK. A `$ref` whose document does not exist is reported as
a compilation failure for that component, by name, with Ajv's own words. A missing vendored file, a
broken helper, or an unparsable answer raises: the gate cannot say "fine" when it did not look.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from typing import Any

HERE = os.path.dirname(os.path.abspath(__file__))
HELPER = os.path.join(HERE, "a2ui_schema_validate.mjs")
COMMON_TYPES = os.path.join(HERE, "standards", "a2ui-common-types-v0_9.json")
FUNCTION_TYPES = os.path.join(HERE, "standards", "a2ui-function-catalog-v0_9.json")

# A payload is small and the helper is a process; this is the ceiling for one call, not a retry.
HELPER_TIMEOUT_S = 20


class SchemaGateFailure(RuntimeError):
    """The gate could not run. Not the payload's fault, and never treated as a pass."""


def _node() -> str:
    node = shutil.which("node")
    if not node:
        raise SchemaGateFailure(
            "the schema gate could not run: node is not on PATH, and the standard's reference "
            "validator is Ajv, which needs it."
        )
    return node


def _common_types_path() -> str:
    if not os.path.isfile(COMMON_TYPES):
        raise SchemaGateFailure(
            f"the schema gate has no shared types: {COMMON_TYPES} is missing. The gate does not "
            f"fall back to the live specification address; restore the vendored copy."
        )
    return COMMON_TYPES


def _function_types_path() -> str:
    if not os.path.isfile(FUNCTION_TYPES):
        raise SchemaGateFailure(
            f"the schema gate has no function vocabulary: {FUNCTION_TYPES} is missing. The shared "
            f"types reach it through FunctionCall, so without it nothing with a text, number or "
            f"true/false property can be compiled. Restore the vendored copy."
        )
    return FUNCTION_TYPES


def _run(request: dict[str, Any]) -> dict[str, Any]:
    try:
        completed = subprocess.run(
            [_node(), HELPER],
            input=json.dumps(request),
            capture_output=True,
            text=True,
            timeout=HELPER_TIMEOUT_S,
            check=False,
        )
    except subprocess.TimeoutExpired as error:
        raise SchemaGateFailure(
            f"the schema gate did not answer within {HELPER_TIMEOUT_S}s; nothing was validated."
        ) from error
    if completed.returncode != 0:
        raise SchemaGateFailure(
            "the schema gate exited with "
            f"{completed.returncode}: {(completed.stderr or completed.stdout or '').strip()[:800]}"
        )
    try:
        answer = json.loads(completed.stdout)
    except (json.JSONDecodeError, ValueError) as error:
        raise SchemaGateFailure(
            f"the schema gate answered something that is not JSON: {completed.stdout[:400]!r}"
        ) from error
    if answer.get("fatal"):
        raise SchemaGateFailure(str(answer["fatal"]))
    return answer


def survey(catalogue: dict[str, Any], names: list[str]) -> dict[str, Any]:
    """How many of a catalogue's components this standard can describe at all."""
    return _run({
        "catalogue": catalogue,
        "commonTypesPath": _common_types_path(),
        "functionTypesPath": _function_types_path(),
        "mode": "survey",
        "components": names,
    })


def validate(components: list[dict[str, Any]], catalogue: dict[str, Any]) -> list[dict[str, Any]]:
    """One answer per payload component: compiled, then accepted or refused with its own errors.

    An empty payload is answered without a process: there is nothing to ask about.
    """
    if not components:
        return []
    answer = _run({
        "catalogue": catalogue,
        "commonTypesPath": _common_types_path(),
        "functionTypesPath": _function_types_path(),
        "mode": "validate",
        "components": components,
    })
    results = answer.get("results")
    if not isinstance(results, list) or len(results) != len(components):
        raise SchemaGateFailure(
            "the schema gate answered for a different number of components than it was given."
        )
    return results
