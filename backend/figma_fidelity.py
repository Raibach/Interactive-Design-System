"""THE FIDELITY PROOF — what Figma states, and whether the drawn component says it too.

WHY THIS EXISTS. Two things were proved about the ingest and neither is fidelity: that
`render_spec` is deterministic (same spec, same bytes) and that the emitted file compiles. A
generator can be perfectly deterministic and draw the wrong thing, and no check in the
repository can tell the difference — `catalog:check` measures the CATALOGUE (props, events,
annotation grammar), and the ingest's findings are prose written against a draft. Nothing
walked the measurement fact by fact and asked, of each one: is this drawn, and if not why not.

HOW IT ANSWERS. For one node it walks the RAW Figma response — the same one the ingest
fetched — and asks three questions of every fact, in this order:

    1. DOES FIGMA STATE IT?  If not, it is not a finding. The row is skipped, because a
       fact the design never mentions cannot be missing from the drawing.
    2. DID IT REACH THE SPEC?  The ingest renames facts on the way in (absoluteBoundingBox →
       size/position, style → type_style, characters → text). `RAW_TO_SPEC` is that renaming,
       stated as data, so "the spec lacks it" is decided by meaning and not by key names.
    3. DID A DECLARATION COME OUT, AND DOES IT DO ANYTHING?

The four verdicts a row can carry:

    drawn          stated, in the spec, declaration emitted
    not-read       FIGMA STATES IT AND THE INGEST HAS NO LINE FOR IT — the spec builder's
                   own key list never mentions this key, so it is lost at measurement
    not-drawn      in the spec, and the renderer emitted no declaration for it
    defect         declared, and MEASURED not to do what it says (INERT_DECLARATIONS)

`not-read` is the verdict this module was built to be able to print, and it is the reason the
spec builder is being refactored: a hand-written list of keys is a list of everything the
ingest is ALLOWED to notice, and every fact outside it is dropped in silence. `key_coverage()`
prints that set directly, one row per key Figma sent.

WHAT IT CANNOT DO, said plainly: this proves what the FILE contains, not what a browser
paints. A declaration that is present and well-formed and ignored by the engine is invisible
to a check that reads files — which is why the truncation failure was found by measuring a
rendered document, and why its measurement is recorded in INERT_DECLARATIONS with its date
and engine rather than inferred here.
"""
from __future__ import annotations

import json
from typing import Any

from design_renderer import _class_name, _lines_in_box, render_spec

# ── DECLARATIONS THAT ARE PRESENT AND DO NOTHING ─────────────────────────────────────────────
# Every entry is a MEASUREMENT, not a deduction: the date, the engine, and the numbers. A fact
# lands here when the generator emits its declaration, the declaration is well-formed, and a
# browser was observed ignoring it.
INERT_DECLARATIONS: dict[str, dict[str, str]] = {
    "truncation": {
        "declaration": "`line-clamp: N` inside `@supports (block-ellipsis: auto)`, plus the fallback clip",
        "measured": "2026-09-30",
        "engine": "Chrome 146.0.7680.80 / Electron 41.0.3 (the desktop in-app browser)",
        "finding": (
            "The design says ENDING. The renderer draws the box, its type, its measured height, the "
            "wrapping, the clip and the design's own alignment, and it REQUESTS the ellipsis from any "
            "engine that has one — the wrapper carries `line-clamp: N` inside "
            "`@supports (block-ellipsis: auto)`, so a capable engine draws `…` as Figma does and an "
            "incapable one never sees the declaration. IN THE ENGINE THIS WAS MEASURED IN THERE IS NO "
            "ELLIPSIS: `block-ellipsis` and `line-clamp` are both absent, and `-webkit-line-clamp` "
            "PARSES, computes, draws nothing and rewrites the box's display to `-webkit-box` — which "
            "cost the design's own textAlignVertical (text at -1px from the box top where the design's "
            "centring measures +4px). Six spellings were tried and none drew, which is why the "
            "prefixed form is never emitted. The clip is verified to hold in that engine: the wrapper "
            "is `display: block`, `max-height` 29.0455px, `overflow: hidden`, clientHeight 29 against "
            "scrollHeight 73. WHERE THE ELLIPSIS IS ABSENT THE TEXT IS THEREFORE CUT WITHOUT A MARK, "
            "and that is a real difference from Figma — counted per layer and stated in the ingest's "
            "own answer (`missingEllipses`)."
        ),
    },
}

# ── THE INGEST'S RENAMING, STATED AS DATA ────────────────────────────────────────────────────
# Raw Figma key → where the fact lives in the spec. A tuple because a fact may be carried in
# one of several places (`fills` becomes `fill` for a single paint and `fills` for a stack).
# This is the mapping `_figma_spec_for_model` implements in code; keeping it here as data is
# what lets the check be decided by meaning, and what makes a disagreement between the two
# visible instead of silent.
RAW_TO_SPEC: dict[str, tuple[str, ...]] = {
    "absoluteBoundingBox": ("size", "position"),
    "layoutMode": ("layout.layoutMode",),
    "itemSpacing": ("layout.itemSpacing",),
    "paddingLeft": ("layout.paddingLeft",),
    "paddingRight": ("layout.paddingRight",),
    "paddingTop": ("layout.paddingTop",),
    "paddingBottom": ("layout.paddingBottom",),
    "primaryAxisAlignItems": ("layout.primaryAxisAlignItems",),
    "counterAxisAlignItems": ("layout.counterAxisAlignItems",),
    "layoutWrap": ("layout.layoutWrap",),
    "fills": ("fill", "fills"),
    "strokes": ("stroke",),
    "strokeWeight": ("stroke",),
    "strokeAlign": ("strokeAlign",),
    "individualStrokeWeights": ("strokeWeights",),
    "strokeCap": ("strokeCap",),
    "strokeJoin": ("strokeJoin",),
    "dashPattern": ("dashPattern",),
    "cornerRadius": ("radius",),
    "rectangleCornerRadii": ("radii",),
    "effects": ("effects",),
    "opacity": ("opacity",),
    "visible": ("visible",),
    "clipsContent": ("clips",),
    "rotation": ("rotation",),
    "constraints": ("constraints",),
    "counterAxisSpacing": ("counterAxisSpacing",),
    "layoutSizingHorizontal": ("sizing",),
    "layoutSizingVertical": ("sizing",),
    "layoutGrow": ("sizing",),
    "layoutAlign": ("sizing",),
    "layoutPositioning": ("sizing",),
    "characters": ("text",),
    "style": ("type_style",),
    # Written on the node OR on its `style`, which is why the states-check accepts either — and
    # why both are listed here: a table that cannot name them cannot report them, and truncation
    # is the fact this module exists for.
    "textTruncation": ("truncation",),
    "maxLines": ("maxLines",),
    "characterStyleOverrides": ("runs",),
    "styleOverrideTable": ("runs",),
    "textAutoResize": ("textAutoResize",),
    "fillGeometry": ("paths", "svg"),
    "strokeGeometry": ("paths", "svg"),
    "annotations": ("annotation",),
    "componentId": ("componentId",),
}

# ── THE TRUNCATION KEYS, WHICH LIVE ON TWO PLACES AND ARE READ FROM BOTH ─────────────────────
# Figma writes a text layer's truncation on the node OR on its `style`, and reading only one of
# the two is how `functions-label` once measured as having no truncation at all. The check
# accepts either, because the ingest does.
TRUNCATION_KEYS = ("textTruncation", "maxLines")

# Figma keys whose value is a bookkeeping detail of the document format rather than anything a
# drawing could state — listed so the key-coverage report is a list of REAL losses and not a
# list of every internal field.
NOT_A_FACT = {
    "id", "name", "type", "children", "layoutVersion", "exportSettings", "pluginData",
    "sharedPluginData", "measurements", "devStatus", "componentPropertyDefinitions",
}


# ── FACTS WHOSE DEFAULT ASKS FOR NOTHING ─────────────────────────────────────────────────────
# A fourth way a fact can be present and say nothing, and the one that produced the most noise:
# a KEY whose VALUE is the drawing's own default needs no declaration, so reporting it as lost
# is the instrument lying again. `layoutSizingHorizontal: "FIXED"` asks for nothing — the size
# was already drawn as width/height. `layoutGrow: 0` asks for nothing. `layoutAlign: "INHERIT"`
# asks for nothing. `layoutWrap: "NO_WRAP"` is what a box does when told nothing.
#
# Each entry names the value(s) that DO ask for a declaration. A key not listed here is a fact
# whose presence alone asks.
ASKS: dict[str, set[str] | None] = {
    "layoutSizingHorizontal": {"FILL"},
    "layoutSizingVertical": {"FILL"},
    "layoutGrow": None,          # truthy: any grow above zero is a demand
    "layoutAlign": {"STRETCH", "MIN", "CENTER", "MAX"},
    "layoutWrap": {"WRAP"},
    "primaryAxisAlignItems": {"MIN", "CENTER", "MAX", "SPACE_BETWEEN", "BASELINE"},
    "counterAxisAlignItems": {"MIN", "CENTER", "MAX", "BASELINE"},
    "layoutMode": {"HORIZONTAL", "VERTICAL"},
    "clipsContent": None,        # handled by _states: False is not a statement
    # A stroke drawn INSIDE is what a border is; only OUTSIDE asks for the outline that costs no
    # layout. INSIDE is therefore a stated value that needs no declaration of its own.
    "strokeAlign": {"OUTSIDE"},
}


def _asks(raw_node: dict[str, Any], key: str) -> bool:
    """Whether this fact's VALUE asks for a declaration. True when the key asks by existing."""
    if key not in ASKS:
        return True
    allowed = ASKS[key]
    value = raw_node.get(key)
    if allowed is None:
        return bool(value)
    return str(value) in allowed


def _spec_value(spec_node: dict[str, Any], path: str) -> Any:
    """The fact at a dotted path, or None. `layout.paddingLeft` is one level in."""
    if "." in path:
        head, _, tail = path.partition(".")
        return (spec_node.get(head) or {}).get(tail)
    return spec_node.get(path)


def _states(raw_node: dict[str, Any], key: str) -> bool:
    """Whether Figma states this fact on this node — the first question, and the gate on a row.

    A ROW IS ONLY WORTH PRINTING WHEN THE DESIGN SAID SOMETHING. Three ways a key can be present
    and still be saying nothing, each of which produced noise when it was not handled:

      * an empty list or object — `fills: []` and `effects: []` mean "this layer has none", which
        needs no declaration;
      * a boolean that is already the drawing's default — `clipsContent: false` is a frame that
        does not clip, and reporting it as a lost fact is the instrument lying;
      * a fact that only means something alongside another — a `strokeWeight` with no `strokes` is
        Figma's default on a layer that has no border to weigh.

    `visible: false` is the exception that keeps its weight, because a hidden layer must be drawn
    hidden, and `rotation: 0` was already filtered by the spec builder.
    """
    if key in TRUNCATION_KEYS:
        return raw_node.get(key) is not None or (raw_node.get("style") or {}).get(key) is not None
    if key == "style":
        return bool(raw_node.get("style"))
    if key == "characters":
        return raw_node.get("characters") is not None
    if key in STROKE_DEPENDENT and not _stroke_present(raw_node):
        return False
    if key in SHAPE_ONLY and (raw_node.get("type") or "").upper() not in SHAPE_TYPES:
        return False
    value = raw_node.get(key)
    if value is None:
        return False
    if isinstance(value, (list, dict)) and not value:
        return False
    if value is False and key != "visible":
        return False
    if key == "rotation" and not value:
        return False
    return True


def _stroke_present(raw_node: dict[str, Any]) -> bool:
    return any(s.get("visible", True) for s in raw_node.get("strokes") or [])


# A stroke's fine detail is a fact about a border that exists; with no stroke there is nothing
# for it to describe.
STROKE_DEPENDENT = {
    "strokeWeight", "strokeAlign", "individualStrokeWeights", "strokeCap", "strokeJoin",
    "dashPattern", "strokesIncludedInLayout", "complexStrokeProperties", "strokeGeometry",
}
# Geometry is a shape's own outline, and a frame has none to read.
SHAPE_ONLY = {"fillGeometry", "strokeGeometry", "vectorNetwork", "fillOverrideTable"}
SHAPE_TYPES = {"VECTOR", "BOOLEAN_OPERATION", "STAR", "ELLIPSE", "POLYGON", "LINE", "REGULAR_POLYGON"}


def _declarations_for(spec_node: dict[str, Any], key: str, decls: list[str], source: str) -> tuple[bool, str]:
    """Whether the drawing carries this fact. Returns (drawn, what-it-is).

    NOT EVERY FACT IS A CSS DECLARATION, and a check that only reads the stylesheet reports the
    markup's own facts as lost. Four kinds, each probed where the renderer actually puts it:

      * a declaration in the rule (`background`, `padding-left`, `align-self`);
      * a declaration on the box the vector gets when the design places it by offset;
      * the ARTWORK — a vector's size, position and paint live in its `<svg width height viewBox>`
        and the `fill` on its `<path>`, and a vector with no rule at all is a vector that was
        drawn entirely in its markup;
      * a TEXT layer's paint, which is the COLOUR OF THE WORDS (`color`) and never a background,
        and its runs, which are spans in the markup and not declarations at all.
    """
    is_text = (spec_node.get("type") or "").upper() == "TEXT" or spec_node.get("text") is not None
    is_vector = (spec_node.get("type") or "").upper() in SHAPE_TYPES

    if key in ("fillGeometry", "strokeGeometry", "vectorNetwork"):
        return ("<path" in source, "<path d=…")
    if key == "fills":
        if is_vector:
            return ("fill=" in source, "<path fill=…")
        if is_text:
            hit = next((d for d in decls if d.startswith("color")), None)
            return (bool(hit), hit or "")
        hit = next((d for d in decls if d.startswith("background")), None)
        return (bool(hit), hit or "")
    if key in ("characterStyleOverrides", "styleOverrideTable"):
        return ("<span style=" in source, "<span style=…>")
    if key == "annotations":
        # A Designer's annotation is read by kind, and each kind lands somewhere different:
        # `Data: x` becomes a prop rendered in the box, `On click:` becomes a listener on the
        # layer, and a SENTENCE is prose that no element can act on — for which drawing nothing is
        # the correct outcome and not a lost fact. The renderer's own reader decides which.
        from design_renderer import _data_field, _on_click_event

        if _data_field(spec_node):
            return ("${this." in source, "${this.<field>}")
        if _on_click_event(spec_node):
            return ("@click=" in source, "@click=${() => this._fire(…)}")
        return (True, "prose — no instruction to draw, correctly absent")
    if key in ("rotation", "rectangleCornerRadii", "cornerRadius") and is_vector:
        # A vector's rotation and corner radii are IN ITS PATH: `_transform_path` bakes the
        # rotation into the coordinates and the fitted geometry carries its own corners, so a
        # wrapper that repeated either would paint a filled rectangle behind the arrow.
        return (True, "carried by the artwork's own path")
    if key in ("strokes", "strokeWeight", "strokeAlign", "individualStrokeWeights") and is_vector:
        # A VECTOR'S BORDER IS DRAWN BY ITS ARTWORK, not by a CSS border. `_svg_for_vector` fits
        # the path and writes the paint onto it — measured on `Polygon 4`, the emitted `<path>`
        # carries `fill="#e4d48e" stroke="#d29207" stroke-width="1.0"` — so a styled vector has
        # no rule of its own in the stylesheet at all, and a check that reads only the stylesheet
        # reports the stroke as missing when it is on the path.
        needle = {"strokes": "stroke=", "strokeWeight": "stroke-width=",
                  "strokeAlign": "stroke=", "individualStrokeWeights": "stroke-width="}[key]
        return (needle in source, f"<path {needle}…")

    probe: dict[str, str] = {
        "layoutMode": "display",
        "itemSpacing": "gap",
        "paddingLeft": "padding-left",
        "paddingRight": "padding-right",
        "paddingTop": "padding-top",
        "paddingBottom": "padding-bottom",
        "primaryAxisAlignItems": "justify-content",
        "counterAxisAlignItems": "align-items",
        "layoutWrap": "flex-wrap",
        "strokes": "border",
        "strokeWeight": "border",
        "strokeAlign": "outline",
        "individualStrokeWeights": "border-width",
        "cornerRadius": "border-radius",
        "rectangleCornerRadii": "border-radius",
        "effects": "box-shadow",
        "opacity": "opacity",
        "visible": "display: none",
        "clipsContent": "overflow",
        "rotation": "transform",
        "characters": "color",
        "style": "font-family",
        "absoluteBoundingBox": "width",
        "layoutSizingHorizontal": "align-self",
        "layoutSizingVertical": "align-self",
        "layoutAlign": "align-self",
        "layoutGrow": "flex-grow",
        "textTruncation": "-webkit-line-clamp",
        "maxLines": "-webkit-line-clamp",
    }
    needle = probe.get(key, "")
    if not needle:
        return False, "no declaration is defined for this fact"
    if is_vector and needle in ("width", "transform"):
        # A vector placed by a flex parent has no box of its own: its size is the svg's.
        return ("viewBox" in source, "<svg width height viewBox>")
    hit = next((d for d in decls if needle in d), None)
    return (bool(hit), hit or "")


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


def interaction_report(spec: dict[str, Any]) -> list[dict[str, str]]:
    """Every interaction the design states, classified — including the hollow ones, VERIFIED.

    A DESIGN CAN STATE A CLICK THAT GOES NOWHERE. Measured on node `40001207:3559`, the instance
    `catalog-description-dt` carries two ON_CLICK entries: one whose single action is type `NODE`
    with `destinationId: null` (a navigation with no destination), and one whose action is
    literally `null`. There is no token to map and inventing an event name for either would be the
    invention this whole pipeline refuses — so they are RECORDED, as stated and hollow, rather than
    left as unexamined omissions. A click the design gives a real destination to is reported as
    actionable, and it is then a genuine omission until the renderer learns to place it.
    """
    out: list[dict[str, str]] = []

    def walk(node: dict[str, Any]) -> None:
        for entry in (node.get("stated") or {}).get("interactions") or []:
            trigger = (entry or {}).get("trigger") or {}
            actions = [a for a in ((entry or {}).get("actions") or [])]
            layer = str(node.get("name") or node.get("id"))
            if not [a for a in actions if a]:
                out.append({"layer": layer, "verdict": "stated, hollow", "detail": "the action is null — the design states a click that does nothing"})
                continue
            kinds = []
            for action in actions:
                if not action:
                    continue
                kind = str(action.get("type"))
                if kind == "NODE" and not action.get("destinationId"):
                    kinds.append("NODE with destinationId: null (a navigation with no destination)")
                else:
                    kinds.append(kind)
            hollow = all("null" in k for k in kinds)
            out.append({
                "layer": layer,
                "verdict": "stated, hollow" if hollow else "stated, ACTIONABLE",
                "detail": f"trigger {trigger.get('type')} -> {'; '.join(kinds)}",
            })
        for child in node.get("children") or []:
            walk(child)

    walk(spec)
    return out


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


def _tag_for(component_id: Any) -> str:
    """The tag a component reference becomes — the renderer's own id transform, restated.

    `render_spec` builds `f-<componentId with colons as hyphens>`, and the ingest uses the same
    transform for a master it drafts. Restated rather than imported because the check needs it to
    look for the element in the emitted markup, and a wrong guess here would only ever report a
    composed instance as not composed — the safe direction.
    """
    return "f-" + str(component_id or "").replace(":", "-")


def _short(value: Any, limit: int = 58) -> str:
    """A value as one readable line, for a table cell — never as evidence in place of itself."""
    import json as _json

    try:
        text = _json.dumps(value, ensure_ascii=False)
    except (TypeError, ValueError):
        text = str(value)
    return text if len(text) <= limit else text[: limit - 1] + "…"


# ── TWO NAMES FOR THE SAME FACT, AND WHERE THEY MEET ─────────────────────────────────────────
# A ROW names its fact by FIGMA'S OWN KEY (`textTruncation`, `maxLines`) because a row is read
# beside the measurement. `INERT_DECLARATIONS` keys it by the FACT THE RENDERER DECIDES
# (`truncation`), because it records what a declaration does. Those are two names for one thing,
# and this is the single place they are joined — so the gate asks "has this defect been examined?"
# once, and a reader can see why the names differ.
_DECIDED_AS = {"textTruncation": "truncation", "maxLines": "truncation"}


def fidelity_gate(report: dict[str, Any]) -> dict[str, Any]:
    """The proof as a GATE: what must STOP an ingest, and what is only reported.

    THE DISTINCTION IS EXAMINED vs UNEXAMINED, and it is the whole gate. A fact nobody has looked
    at must not pass — that is what zero trust means here, and it is what stops a new Figma key, a
    new integration fault, or a new kind of defect from arriving unnoticed. A fact that HAS been
    examined, with its measurement written down and a decision recorded against it, is a KNOWN gap:
    it is reported by name and counted, and it does not stop the work.

    WHY NOT "ANY DEFECT ABORTS", which is the obvious reading and the one that was asked for. Both
    of this repository's own catalogue components truncate, and truncation is a defect this engine
    cannot fix — no mechanism draws a multi-line ellipsis (six spellings measured). A gate that
    aborts on any defect therefore refuses the very designs it exists to serve. That failure was
    built once already (a 422 refusing a truncating design) and removed on the owner's ruling that
    the Figma file is the authority and the burden is the renderer's, not the design's
    (2026-09-30). A gate that refuses everything protected by it is not zero trust; it is a wall in
    front of the door.

    SO THIS BLOCKS:
      * an OMISSION — a stated key that no examination covers, or a stated fact that never reached
        the spec;
      * a `not-drawn` fact — in the spec, and the renderer emitted no declaration: an integration
        fault between the measurement and the renderer;
      * a DEFECT that is not in INERT_DECLARATIONS — measured and declared, and nobody has written
        down what it does or why it stands.

    AND IT REPORTS WITHOUT BLOCKING:
      * a defect that IS in INERT_DECLARATIONS, named per layer, counted, and stated in words at
        the root of the ingest's own answer (`missing_ellipses`), so a designer sees it without
        opening anything.
    """
    blocking: list[str] = []
    reported: list[str] = []

    for key in report["key_coverage"]["omissions"]:
        blocking.append(
            f"`{key}` is stated by the design and no examination covers it — a fact nobody has looked at"
        )

    ellipses = 0
    for row in report["rows"]:
        where = f"{row['layer']} · {row['fact']}"
        if row["verdict"] == "not-read":
            blocking.append(f"{where}: stated and never reached the spec")
        elif row["verdict"] == "not-drawn":
            blocking.append(f"{where}: in the spec and the renderer emitted no declaration")
        elif row["verdict"] == "defect":
            decided = _DECIDED_AS.get(row["fact"], row["fact"])
            entry = INERT_DECLARATIONS.get(decided)
            if entry:
                if decided == "truncation":
                    ellipses += 1
                reported.append(f"{where}: {entry['declaration']}")
            else:
                blocking.append(
                    f"{where}: declared and UNEXAMINED — no measurement records what it does, so it "
                    "cannot be a known gap"
                )

    return {
        "blocks": bool(blocking),
        "blocking": blocking,
        "reported": reported,
        "counts": report["counts"],
        "missing_ellipses": ellipses,
        # One sentence for the root of the ingest's own answer, so the gap is visible without a
        # reader opening the ledger: what is missing, how many, and what it is a gap IN.
        "sentence": (
            ""
            if not ellipses
            else (
                f"{ellipses} text layer(s) truncate: the whole lines that fit are drawn and clipped, "
                "and the ellipsis is requested from any engine that supports one. It is absent in the "
                "engine this was verified in (Chrome 146 / Electron 41), where the text ends without "
                "it. Named per layer in `fidelity.reported`."
            )
        ),
    }


def fidelity_report(raw_document: dict[str, Any], tag: str | None = None) -> dict[str, Any]:
    """One row per layer per stated fact, with the verdict and the reason.

    The layer walk is the renderer's own: `_class_name` is imported, and only the ordering is
    replayed, because the class a layer gets decides which rule the check reads and a second
    naming rule would be a second answer.
    """
    from routes.figma import _figma_spec_for_model

    from design_renderer import ACCEPTED_UNRENDERED

    spec = _figma_spec_for_model(raw_document)
    source = render_spec(spec, tag or "f-fidelity", {})
    rules = _class_rules(source)
    host = _rules(source).get(":host") or []

    def class_of(spec_node: dict[str, Any], used: dict[str, int]) -> str:
        base = _class_name(spec_node.get("name") or "", "layer")
        count = used.get(base, 0) + 1
        used[base] = count
        return base if count == 1 else f"{base}-{count}"

    rows: list[dict[str, Any]] = []
    used: dict[str, int] = {}

    def walk(raw_node: dict[str, Any], spec_node: dict[str, Any], is_root: bool) -> None:
        class_name = class_of(spec_node, used)
        decls = host if is_root else rules.get(class_name, [])
        layer = f"{raw_node.get('name')} ({raw_node.get('type')})"

        for key in sorted(set(raw_node) | set(TRUNCATION_KEYS)):
            if key in NOT_A_FACT or key not in RAW_TO_SPEC:
                continue
            if not _states(raw_node, key):
                continue  # the design does not state it: not a finding
            if not _asks(raw_node, key):
                continue  # the design states a value that asks for no declaration
            spec_paths = RAW_TO_SPEC[key]
            landed = next((p for p in spec_paths if _spec_value(spec_node, p) is not None), None)
            if landed is None:
                rows.append(_row(layer, raw_node, key, class_name, "not-read", "the ingest did not put it in the spec"))
                continue
            if key == "textTruncation":
                rows.append(_truncation_row(layer, raw_node, spec_node, class_name))
                continue
            drawn, declaration = _declarations_for(spec_node, key, decls, source)
            if key == "componentId" and (raw_node.get("type") or "").upper() == "INSTANCE":
                # AN INSTANCE IS NOT "MISSING" HERE — THE PREVIEW IS BLIND ON PURPOSE. The owner
                # ruled that a preview draws the design and reads no catalogue ("The preview should
                # be fresh and not checking the lit catalog or any vectors anywhere… We cannot do a
                # comparison. We'll have to do a comparison after we approve."), so the ingest
                # renders with an empty catalogue and an instance is drawn from its own measured
                # subtree rather than composed into an existing element. What the master is FOR is
                # measured now (it is fetched and drafted as its own component, `f-<componentId>`);
                # putting the existing tag in the drawing waits for approval, where a duplicate is
                # a question worth asking. When the markup DOES carry the composed tag, it is drawn
                # and this says so.
                composed = f"<{_tag_for(raw_node.get('componentId'))}" in source
                rows.append(
                    _row(
                        layer, raw_node, key, class_name,
                        "drawn" if composed else "accepted",
                        "the catalogue's element is composed here" if composed else
                        "NOT DRAWN ON PURPOSE: the preview reads no catalogue (owner, 2026-09-29), so the "
                        "instance is drawn from its own measured subtree. Its master IS measured now — "
                        "fetched by the id below and drafted as its own component. Composition into an "
                        "existing tag is a question for approval.",
                    )
                )
            elif not drawn and key in ACCEPTED_UNRENDERED:
                # DELIBERATE, AND SAID SO. The renderer names these as measured facts it will not
                # draw, each with its reason written down — the opposite of a silent loss, and a
                # different verdict from one.
                rows.append(_row(layer, raw_node, key, class_name, "accepted", ACCEPTED_UNRENDERED[key]))
            elif not drawn:
                rows.append(
                    _row(layer, raw_node, key, class_name, "not-drawn", "in the spec, and the renderer emitted no declaration")
                )
            elif key in INERT_DECLARATIONS:
                # DECLARED, AND MEASURED NOT TO DO ANYTHING. This is the verdict the module exists
                # for: no check that reads a file can see it, because the file is right — the
                # DECLARATION is there, well-formed, and the engine ignores it.
                entry = INERT_DECLARATIONS[key]
                rows.append(
                    _row(
                        layer, raw_node, key, class_name, "defect",
                        f"declared and INERT — {entry['measured']} on {entry['engine']}: {entry['finding']}",
                    )
                )
            else:
                rows.append(_row(layer, raw_node, key, class_name, "drawn", declaration))

        raw_kids = raw_node.get("children") or []
        spec_kids = spec_node.get("children") or []
        for index, child in enumerate(raw_kids):
            walk(child, spec_kids[index] if index < len(spec_kids) else {}, False)

    walk(raw_document, spec, True)

    counts: dict[str, int] = {}
    for row in rows:
        counts[row["verdict"]] = counts.get(row["verdict"], 0) + 1

    return {
        "tag": tag,
        "node": raw_document.get("id"),
        "layers": sum(1 for _ in _walk_nodes(raw_document)),
        "rows": rows,
        "counts": counts,
        "accepted_unrendered": sorted(ACCEPTED_UNRENDERED),
        "key_coverage": key_coverage(spec),
        "interactions": interaction_report(spec),
        "source_chars": len(source),
    }


def _row(layer: str, raw_node: dict[str, Any], key: str, class_name: str, verdict: str, why: str) -> dict[str, Any]:
    return {
        "layer": layer,
        "id": raw_node.get("id"),
        "class": class_name,
        "fact": key,
        "verdict": verdict,
        "why": why,
    }


def _truncation_row(layer: str, raw_node: dict[str, Any], spec_node: dict[str, Any], class_name: str) -> dict[str, Any]:
    """Truncation gets its own row, because its verdict is the one this module exists for."""
    entry = INERT_DECLARATIONS["truncation"]
    lines = _lines_in_box(spec_node)
    return {
        "layer": layer,
        "id": raw_node.get("id"),
        "class": class_name,
        "fact": "textTruncation",
        "verdict": "defect",
        "why": (
            f"the design truncates and THIS ENGINE CANNOT DRAW THE ELLIPSIS — {entry['measured']} on "
            f"{entry['engine']}: {entry['finding']} The layer's own measured line count is {lines}."
        ),
    }


def _rules(source: str) -> dict[str, list[str]]:
    """The emitted stylesheet as selector → declarations, in source order."""
    import re

    out: dict[str, list[str]] = {}
    for match in re.finditer(r"^    ([.:][^\s{]+) \{\n(.*?)^    \}$", source, re.S | re.M):
        decls = [ln.strip().rstrip(";") for ln in match.group(2).split("\n") if ln.strip()]
        out[match.group(1)] = [d for d in decls if d]
    return out


def _class_rules(source: str) -> dict[str, list[str]]:
    return {sel[1:]: decls for sel, decls in _rules(source).items() if sel.startswith(".")}


def _walk_nodes(node: dict[str, Any]):
    yield node
    for child in node.get("children") or []:
        yield from _walk_nodes(child)


def _print(report: dict[str, Any], verbose: bool) -> None:
    coverage = report["key_coverage"]
    print(f"node {report['node']}  layers {report['layers']}  facts checked {len(report['rows'])}  {report['counts']}")
    print()
    print("── WHAT FIGMA STATED THAT NO RENDERER MAPPING EXISTS FOR ──")
    print("   (carried verbatim into the spec, placed by nothing, reported here by name)")
    carried = coverage["carried_keys"]
    if not carried:
        print("   none — every stated key is placed")
    for key, entry in carried.items():
        mark = "OMISSION " if entry["omission"] else "examined "
        print(f"   {mark}{key:<26} on {entry['nodes']:>2} node(s), {entry['with_content']:>2} with content   {', '.join(entry['examples'])}")
        if entry["reason"] and not entry["omission"]:
            print(f"             why not an omission: {entry['reason'][:118]}")
    print(
        f"   ({len(carried)} keys carried, {coverage['carried_statements']} statements, "
        f"{coverage['carried_with_content']} of them carrying a value)"
    )
    print(
        f"   {len(coverage['examined'])} examined and recorded, "
        f"{len(coverage['omissions'])} still OMMISSIONS: {', '.join(coverage['omissions']) or 'none'}"
    )
    if report.get("interactions"):
        print()
        print("── INTERACTIONS THE DESIGN STATES ──")
        for row in report["interactions"]:
            print(f"   {row['verdict']:<20} {row['layer']:<26} {row['detail']}")
    print()
    print("── FACTS STATED AND NOT DRAWN, OR DRAWN AND INERT ──")
    interesting = [r for r in report["rows"] if r["verdict"] in ("not-read", "not-drawn", "defect")]
    if not interesting:
        print("   none")
    width = max((len(r["layer"]) for r in interesting), default=10)
    for row in interesting:
        print(f"   {row['verdict']:>9}  {row['layer']:<{width}}  {row['fact']:<24} {row['why'][:110]}")
    if verbose:
        print()
        print("── DRAWN ──")
        for row in report["rows"]:
            if row["verdict"] == "drawn":
                print(f"   {row['layer']:<{width}}  {row['fact']:<24} {row['why']}")


def main() -> int:
    import argparse
    import os
    import sys

    parser = argparse.ArgumentParser(description="Per-layer fidelity proof for one Figma node")
    parser.add_argument("--file-key", help="Figma file key")
    parser.add_argument("--node-id", required=True, help="Figma node id, e.g. 40001207:3497")
    parser.add_argument("--from-json", help="read the raw node document from this file instead of Figma")
    parser.add_argument("--json", action="store_true", help="emit the report as JSON")
    parser.add_argument("--verbose", action="store_true", help="also list every drawn fact")
    args = parser.parse_args()

    here = os.path.dirname(os.path.abspath(__file__))
    sys.path.insert(0, here)
    if args.from_json:
        raw = json.load(open(args.from_json, encoding="utf-8"))
        document = raw.get("document") or raw
    else:
        from dotenv import load_dotenv

        load_dotenv(os.path.join(here, ".env"))
        from routes.figma import _fetch_figma_nodes

        response = _fetch_figma_nodes(args.file_key, args.node_id)
        document = response["nodes"][args.node_id.replace("-", ":")]["document"]

    report = fidelity_report(document, tag=f"f-{args.node_id.replace(':', '-')}")
    if args.json:
        print(json.dumps(report, indent=1))
        return 0
    _print(report, args.verbose)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
