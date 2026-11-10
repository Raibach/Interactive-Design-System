"""Which stated keys the ingest examined, and which it did not."""
from __future__ import annotations

from typing import Any

from figma_fidelity import STRUCTURAL_FACTS, _short, _walk_nodes

# ── CARRIED KEYS THAT HAVE BEEN EXAMINED, AND WHAT WAS FOUND ─────────────────────────────────
# A key in `stated` is a fact Figma stated that no renderer mapping exists for. Left alone it is
# an OMISSION — the thing this module exists to count. But some of them are not omissions at all,
# and saying so needs evidence, not a reassuring sentence: each entry records WHAT WAS SEEN, and
# the entry only applies to that value.
#
# `ANY` means the reason covers every value the key can hold (`size` is the same two numbers as
# the bounding box whatever it says). A literal means the reason was written for THAT value and
# the entry stops applying the moment the design states a different one — a real `blendMode`, a
# non-zero `cornerSmoothing`, a `lineIndentations` with a non-zero entry all become omissions
# again, which is the point: this is a record of an examination, not a blanket exemption.
ANY = object()

STATED_REASONS: dict[str, tuple[object, str]] = {
    "primaryAxisSizingMode": (ANY, "the rule's RESULT is drawn: a HUG frame's size is the sum of "
                                   "its children and gaps, which is the measured width/height, and "
                                   "a FIXED frame's is the size the design states. Recorded in "
                                   "design_renderer.ACCEPTED_UNRENDERED with the same reason."),
    "counterAxisSizingMode": (ANY, "the same rule across the layout axis, and the same answer."),
    "size": (ANY, "Figma's own `size` Vector2D — the same two numbers as `absoluteBoundingBox`, "
                  "which is what the measurement uses. Nothing to draw."),
    "absoluteRenderBounds": (ANY, "the EXPORT bounds, not a drawing fact: measured 622x43 against "
                                  "a 622x40 frame, 1px above it, because the design's own text "
                                  "boxes overflow the row. Nothing to draw; it is what makes "
                                  "Figma's own PNG 3px taller than the element."),
    "relativeTransform": (ANY, "the matrix that places a layer, already expressed by the measured "
                               "absolute position this renderer draws as left/top, and composed "
                               "into the artwork for a vector by `_svg_for_vector`."),
    "backgroundColor": (ANY, "Figma's LEGACY background field; `fills` is the modern one and it is "
                             "drawn, on the root as `background`."),
    "background": (ANY, "the same legacy field as `backgroundColor`, superseded by `fills`."),
    "vectorNetwork": (ANY, "the vector's network form. The artwork is drawn from Figma's own "
                           "`fillGeometry` paths through `_svg_for_vector`, which is the same shape "
                           "in the form the renderer can place."),
    "overrides": (ANY, "a record of HOW an instance differs from its master, not a value: the "
                       "overridden fields are on the instance's own nodes, which are what is "
                       "measured and drawn. Verified against the master — the `catalog_icon` "
                       "instance names `Catalog_root` as its component and its `name` is in the "
                       "override list, which is exactly the difference the record describes."),
    "blendMode": ("PASS_THROUGH", "the absence of a blend, which is what PASS_THROUGH means and "
                                  "what every node here states. A real blend mode would need "
                                  "`mix-blend-mode` and would be an omission."),
    "scrollBehavior": ("SCROLLS", "a frame that scrolls its content when it overflows — the "
                                  "default for a frame drawn at a fixed measured size."),
    "cornerSmoothing": (0, "no squircle smoothing, so the measured radius is the whole shape. A "
                           "non-zero smoothing would change the curve and would be an omission."),
    "strokesIncludedInLayout": (True, "whether a stroke adds to the layout size, and the measured "
                                      "size in Figma already includes it — so the width/height "
                                      "drawn here is the size with the stroke already accounted for."),
    "complexStrokeProperties": ({"strokeType": "BASIC"}, "a plain stroke, which is what a CSS "
                                      "border draws. A variable-width or patterned stroke would "
                                      "be an omission."),
    "lineTypes": (ANY, "per-line text overrides. Measured as `NONE` on every line of both text "
                       "layers, which is the absence of an override. A line with a type override "
                       "would be an omission."),
    "lineIndentations": (ANY, "per-line indentation. Measured as `0` on every line of both text "
                              "layers. A non-zero indent would be an omission."),
    "fillOverrideTable": (ANY, "per-path paint overrides inside an instance. Measured as null "
                               "entries, which is the absence of an override."),
    "minWidth": (ANY, "minWidth is a constraint; it affects layout but is not drawn."),
}


def _examined(key: str, value: Any) -> str | None:
    """The reason a carried key is NOT an omission — or None when the examination does not apply.

    The value decides. A reason written for `cornerSmoothing: 0` says nothing about a design that
    states 4, and this returns None for it so the key is counted as the omission it now is.
    """
    if key == "interactions":
        # AN INTERACTION IS EXAMINED ONLY IF EVERY ONE THE DESIGN STATES IS HOLLOW. A navigation
        # with no destination and a `null` action are both statements that nothing can act on, so
        # they are recorded — by `interaction_report`, per layer — instead of sitting in the
        # omissions list for a reason no reader could act on. The moment an interaction names a
        # real destination it stops being hollow and this returns None, which puts it back in the
        # omissions where a fact nobody can place belongs.
        actionable: list[str] = []
        for entry in value or []:
            for action in (entry or {}).get("actions") or []:
                if not action:
                    continue
                if str(action.get("type")) == "NODE" and not action.get("destinationId"):
                    continue
                actionable.append(str(action.get("type")))
        if actionable:
            return None
        return (
            "every ON_CLICK the design states here is HOLLOW — a `NODE` navigation with "
            "`destinationId: null`, or a null action. There is no event name to map, and inventing "
            "one is the invention this pipeline refuses, so each is recorded as stated-and-hollow "
            "by `interaction_report` (layer and trigger included). An interaction with a real "
            "destination is an omission."
        )
    entry = STATED_REASONS.get(key)
    if not entry:
        return None
    recorded, reason = entry
    if recorded is ANY:
        return reason
    # A list of defaults (lineTypes) is examined when EVERY entry is that default.
    if isinstance(value, list) and not isinstance(recorded, list):
        return reason if all(item == recorded or item == [] for item in value) else None
    return reason if value == recorded else None


def key_coverage(spec: dict[str, Any]) -> dict[str, Any]:
    """Every key Figma stated that NO RENDERER MAPPING EXISTS FOR — read from the spec itself.

    THE ONE SOURCE OF TRUTH IS THE SPEC. The ingest decides what it can place (`_CONSUMED_KEYS`,
    routes/figma.py) and carries everything else under `stated`; this function reads those buckets
    rather than keeping a second list of what it thinks is unplaced. A second list is a second
    answer, and the answer that drifts is the one nobody measured — the same reason `_class_name`
    is imported here rather than restated.

    A key with no content (nil, `[]`, `{}`, `false`) is counted separately, because Figma sends
    plenty of those: `lineTypes: ["NONE","NONE"]` and `cornerSmoothing: 0.0` are the defaults a
    design that says nothing about them produces, and reporting them as losses would be this
    instrument lying again.
    """
    carried: dict[str, dict[str, Any]] = {}

    for node in _walk_nodes(spec):
        for key, value in (node.get("stated") or {}).items():
            if key in STRUCTURAL_FACTS:
                continue  # configuration, not a visual fact: no row, no reason, no error
            entry = carried.setdefault(
                key, {"nodes": 0, "with_content": 0, "examples": [], "unexamined": 0, "reason": None}
            )
            entry["nodes"] += 1
            if not (value is None or value == [] or value == {} or value is False):
                entry["with_content"] += 1
                if len(entry["examples"]) < 2:
                    entry["examples"].append(_short(value))
            reason = _examined(key, value)
            if reason is None:
                entry["unexamined"] += 1
            elif entry["reason"] is None:
                entry["reason"] = reason

    for entry in carried.values():
        entry["omission"] = entry["unexamined"] > 0

    return {
        "carried_keys": dict(sorted(carried.items(), key=lambda kv: -kv[1]["unexamined"])),
        "carried_statements": sum(e["nodes"] for e in carried.values()),
        "carried_with_content": sum(e["with_content"] for e in carried.values()),
        "omissions": sorted(k for k, e in carried.items() if e["omission"]),
        "examined": sorted(k for k, e in carried.items() if not e["omission"]),
    }
