"""The ingest's stated-fact gate: what was examined, what was not, and the findings the designer reads.

THE RULE, IN ONE SENTENCE: the gate reports what it examined and what it did not, the only refusal is
size (the route's character and node limits, which run before this module), and the designer judges
correctness.

THE THREE NAMED KEYS: `arcData`, `componentProperties` and `maxWidth` are carried as named spec fields,
not under `stated` (routes/figma.py:3351-3353, :3443-3458), so the coverage walk names them as carried
but not examined. This module does not rewrite the coverage walk to force them in.

THIS MODULE READS THE DESIGN AND NOTHING ELSE. The coverage reads `stated`; the fidelity report renders
with an empty catalogue map (`render_spec(spec, tag, {})`, figma_fidelity.py) and its composed check
searches the rendered source string, not the catalogue. No query, no comparison and no catalogue read
appears in this file.
"""
from __future__ import annotations

import asyncio
from typing import Any, Callable

from figma_fidelity import fidelity_gate, fidelity_report
from figma_key_coverage import key_coverage


async def check_stated_keys(
    spec_for_model: dict[str, Any],
    target_node: dict[str, Any],
    node_id: str | None,
    step: Callable[[str], None],
) -> dict[str, Any] | None:
    """Report the stated keys with no examination. None means every stated key is covered."""
    coverage = await asyncio.to_thread(key_coverage, spec_for_model)
    unparsed = list(coverage.get("omissions") or [])
    if not unparsed:
        return None
    failed_node = str(
        target_node.get("id") or node_id or target_node.get("name") or "unnamed"
    )
    profile = (
        "[ERROR_TYPE]: INGEST_VALIDATION_FAILURE\n"
        f"[FAILED_NODE]: {failed_node}\n"
        f"[MISSING_OR_UNPARSED_KEYS]: [{', '.join(unparsed)}]\n"
        "[STATUS]: Pipeline incomplete. Representation accuracy is below 100%."
    )
    step(
        "Validation findings: "
        + ", ".join(unparsed)
        + ". The ingest continues; the designer reads them in the preview."
    )
    return {"profile": profile, "keys": unparsed}


async def check_fidelity(
    target_node: dict[str, Any],
    target_tag: str,
    step: Callable[[str], None],
) -> tuple[dict[str, Any], dict[str, Any]]:
    """Return the report and the gate's findings. A blocking finding is reported, never raised."""
    step("Checking every stated fact against the component, layer by layer…")
    fidelity = await asyncio.to_thread(
        fidelity_report, target_node, target_tag,
        on_layer=lambda path, count: step(f"Checked layer: {path} ({count} fact(s))"),
    )
    step(
        f"Checked {len(fidelity['rows'])} rows: {fidelity['exactness']['exact']} exact, "
        f"{fidelity['exactness']['compared'] - fidelity['exactness']['exact']} not exact, "
        f"{fidelity['exactness'].get('unexamined', 0)} stated key(s) with no examination, "
        f"{fidelity['counts'].get('accepted', 0)} ask for no drawing.",
    )
    gate = await asyncio.to_thread(fidelity_gate, fidelity)
    if gate.get("blocks"):
        step(
            "The fidelity findings are reported; the ingest continues. "
            "The designer judges the drawing."
        )
    return fidelity, gate
