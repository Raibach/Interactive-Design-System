"""A MEASURED FIGS DESIGN, RENDERED TO A LIT COMPONENT — deterministically.

WHY THIS EXISTS. The ingest measured a design exactly and then handed the measurements to a
language model with the instruction "build this". A model asked to build from numbers will
sometimes be faithful and sometimes not: it drops a 1px border because it judges it decoration,
draws an icon by hand instead of using the artwork it was given, writes padding on one shape and
not on the next. That is not a bug to be prompted away — it is interpretation, and a design system
cannot contain it (owner, 2026-09-29: *"the model shouldn't be telling you — the model should be
following the specs. If the model is interpreting designs from Figma then we have failed. This is
a deterministic system… that 10% that the AI loses with drifting and inconsistent interpretation
of my design costs millions of dollars on an enterprise level."*).

So the file is written by a function, not a model:

    measured spec  ──>  render_spec()  ──>  Lit component source

Pure: the same spec produces byte-identical source, every run, forever. Every value that goes into
the emitted CSS comes from the spec, and anything the spec carries that this renderer does not yet
know how to place is REPORTED rather than dropped (see `unrendered_keys`) — an omission must be a
visible defect in this file, not a silent loss in a component.

WHAT IT DOES NOT DO:
  * it never invents a value — a missing measurement produces no declaration, not a plausible one;
  * it never renames or reinterprets — layer names are kept, and the class name is derived from the
    name by the same rule everywhere;
  * it is unaware of the model. Nothing in this module imports, calls or waits for one.
"""

from __future__ import annotations

import html as _html
import re
from typing import Any

# The spec keys this renderer knows how to place. Anything outside this set that turns up in a
# spec is a key the two halves of the contract disagree about, and the ingest REFUSES on it — a
# measurement nobody can place is not something to render "well enough".
#
# ── AND TRUNCATION IS NOT IN HERE, ON PURPOSE (owner, 2026-09-30/10-01) ──────────────────────
# Figma's text truncation came through this file twice, both times as a way of making it LOOK
# right: first a line clamp, which buys its ellipsis by forcing the box into `display: -webkit-box`
# — a display mode a second rule then overwrote, so the ellipsis silently vanished — and then a
# runtime pass that measured the box in a hidden mirror and cut the text itself, which is
# arithmetic invented on top of the design and was wrong twice before it was abandoned. The owner:
# *"a clamp is a way of circumventing honesty… zero trust means it should fail… you can't break the
# protocol to get it to work. Honesty is the true objective."* Then he ruled again, on the
# measurement itself: *"We're not using clamps. Remove the clamps. We have to find a different
# solution."*
#
# AND THE MEASUREMENT VINDICATES IT, which is why there is no third attempt. Measured 2026-09-30 in
# the desktop browser, `-webkit-line-clamp` is accepted, computes to the stated number, and DRAWS
# NOTHING: the engine rewrites the box's `display` to `flow-root` and renders every line anyway
# (three lines at 14.5227px line height in a 43px box, no ellipsis). The longhands that do the
# clipping are absent — `CSS.supports('block-ellipsis','auto')` and `CSS.supports('line-clamp','2')`
# are both false — and six spellings of the same intent were tried on a live page, every one of
# which drew three lines and no ellipsis. So there is no faithful rule to write in that engine, and
# the clamp was not merely a shortcut: it broke the design's own textAlignVertical as well.
#
# A design that truncates is therefore DRAWN as far as it can be — the box, its type, its measured
# height, the wrapping, the clip — and the missing ellipsis is REPORTED as a finding against the
# draft (ACCEPTED_UNRENDERED below), by layer, with its line count. Reported, not faked, and not
# refused: the ingest does not ask the design to change.
RENDERED_KEYS = {
    "id", "name", "type", "size", "position", "layout", "fill", "fills", "stroke", "radius",
    "radii", "effects", "text", "type_style", "runs", "textAutoResize",
    "path", "paths", "windingRule", "svg", "componentId", "annotation", "children",
    "opacity", "visible", "clips", "rotation", "sizing", "counterAxisSpacing",
    "strokeAlign", "strokeWeights", "strokeCap", "strokeJoin", "dashPattern", "constraints",
    # ── WHAT FIGMA STATED AND NOBODY PLACES YET ───────────────────────────────────────────────
    # `stated` is the carrier for every key Figma sent that this renderer has no mapping for
    # (see `_CONSUMED_KEYS` in routes/figma.py). It is named here so the ingest does NOT refuse a
    # design over it — refusing was the old behaviour for an unknown key, and it would now refuse
    # every design, since every design states something with no mapping yet. Carried here, reported
    # by name and counted by `backend/figma_fidelity.py`, which is where a person sees it.
    #
    # IT IS NOT A CLAIM THAT ANY OF IT IS DRAWN. Nothing in this file reads `stated`, and nothing
    # may start to without a mapping written for the fact it names.
    "stated",
}

# Measured, and deliberately NOT emitted yet — with the reason. These are reported as findings
# against the draft (so the gap is visible and countable, and the preview says it in words) rather
# than refused, because each one is a decision about what the element is allowed to do, not a value
# being dropped in silence.
ACCEPTED_UNRENDERED = {
    "constraints": "Figma resizing constraints govern how a layer behaves when its frame is "
                   "resized; an element fixed at its measured size has nothing to obey them.",
    "strokeCap": "applies to an open path's ends; a border has no ends.",
    "strokeJoin": "applies to a path's corners; a border's corners are covered by radius.",
    "dashPattern": "a dashed stroke is a Figma stroke style, and a CSS border cannot take a dash "
                   "pattern without a drawn path.",
    "textAutoResize": "Figma's name for whether a text box hugs its words; the measured size is "
                      "already the result of that rule.",
    "truncation": "the design ends its text in an ellipsis and THIS ENGINE CANNOT DRAW ONE. Measured "
                  "2026-09-30 in the desktop browser: `-webkit-line-clamp` is accepted, computes to "
                  "the stated count, and draws nothing — the engine rewrites the box's display to "
                  "`flow-root` and renders every line (three lines at 14.5227px in a 43px box, no "
                  "ellipsis), and the longhands that clip are absent (`CSS.supports("
                  "'block-ellipsis','auto')` and `CSS.supports('line-clamp','2')` are both false). "
                  "Six spellings were tried; none drew. So the box, its type, its measured height, "
                  "the wrapping and the clip ARE drawn, and the ellipsis is reported here as the one "
                  "fact that is missing and why. No clamp is used (owner, 2026-09-30) and no "
                  "run-time text cutting either — both were tried and both were wrong.",
    "maxLines": "how many lines the design keeps before its ellipsis. The count is measured and "
                "reported with `truncation`, and it is what the box's own measured height already "
                "expresses once the ellipsis cannot be drawn.",
    # ── AUTO-LAYOUT SIZING MODES: THE MEASURED SIZE IS THE RESULT OF THE RULE ──────────────────
    # `primaryAxisSizingMode` (HUG or FIXED along the layout axis) and `counterAxisSizingMode` (the
    # same across it) say how a frame decides its own size. A HUG frame's size IS the sum of its
    # children and gaps — the number Figma measured and the number this renderer emits as
    # width/height. A FIXED frame's size is the number the design states, which is the same
    # measured number. Both modes are therefore already drawn, exactly as `textAutoResize` is: the
    # rule's RESULT is what a fixed drawing needs, and re-deriving it in the browser would make the
    # size depend on Chrome's text metrics rather than on Figma's measurement. What is NOT carried
    # is the behaviour under a later resize — an element drawn at its measured size has nothing to
    # re-hug — which is the same trade-off `constraints` states above.
    "primaryAxisSizingMode": "Figma's rule for how a frame sizes itself along its layout axis. A "
                             "HUG frame's measured size IS the sum of its children and gaps, and a "
                             "FIXED frame's is the size the design states — both of which are the "
                             "number rendered here, so the rule's result is drawn and only its "
                             "re-derivation on a future resize is not.",
    "counterAxisSizingMode": "the same rule across the layout axis, and the same answer: the "
                             "measured size is what the rule produced.",
}

_LAYOUT_PROPERTIES = {
    "layoutMode": "flex-direction",
    "itemSpacing": "gap",
    "paddingLeft": "padding-left",
    "paddingRight": "padding-right",
    "paddingTop": "padding-top",
    "paddingBottom": "padding-bottom",
}

_ALIGNMENTS = {
    "MIN": "flex-start",
    "CENTER": "center",
    "MAX": "flex-end",
    "SPACE_BETWEEN": "space-between",
    "BASELINE": "baseline",
}

_TEXT_CASE = {
    "UPPER": "uppercase",
    "LOWER": "lowercase",
    "TITLE": "capitalize",
    "SMALL_CAPS": "lowercase",
}

_TEXT_DECORATION = {
    "UNDERLINE": "underline",
    "STRIKETHROUGH": "line-through",
}


def unrendered_keys(spec: dict[str, Any]) -> list[str]:
    """Spec keys this renderer does not know how to place — reported, never dropped in silence.

    A KEY THAT IS NAMED IN `ACCEPTED_UNRENDERED` IS NOT ONE OF THESE. Those are measured facts this
    renderer deliberately does not draw, each with its reason written down, and they are reported as
    findings against the draft instead — so truncation, for one, is DRAWN as far as it can be (the
    box, its type, its measured height, its clip) and the missing ellipsis is SAID rather than the
    whole component refused. A key outside both sets is a real disagreement between the measurement
    and this renderer, and the ingest refuses on it.
    """
    found: list[str] = []
    seen: set = set()

    def walk(node: dict[str, Any]) -> None:
        for key in node:
            if key not in RENDERED_KEYS and key not in ACCEPTED_UNRENDERED and key not in seen:
                seen.add(key)
                found.append(key)
        for child in node.get("children") or []:
            walk(child)

    walk(spec)
    return sorted(found)


def accepted_unrendered(spec: dict[str, Any]) -> list[str]:
    """Measured keys that are known and deliberately not emitted — named, with the reason."""
    out: dict[str, str] = {}

    def walk(node: dict[str, Any]) -> None:
        for key in node:
            if key in ACCEPTED_UNRENDERED and key not in out:
                out[key] = ACCEPTED_UNRENDERED[key]
        for child in node.get("children") or []:
            walk(child)

    walk(spec)
    return [f"{key}: {reason}" for key, reason in sorted(out.items())]


def _class_name(name: str, fallback: str) -> str:
    """A CSS class from a layer name. Deterministic, and the same rule for every layer."""
    slug = re.sub(r"[^a-z0-9]+", "-", (name or "").strip().lower()).strip("-")
    if not slug:
        slug = fallback
    if slug[0].isdigit():
        slug = "n-" + slug
    return slug


def _component_class(name: str, tag: str) -> str:
    """The element's own class name: the layer name in PascalCase, never a decorator."""
    parts = re.split(r"[^A-Za-z0-9]+", name or "")
    pascal = "".join(p[:1].upper() + p[1:] for p in parts if p)
    if not pascal:
        pascal = "".join(p[:1].upper() + p[1:] for p in re.split(r"[^A-Za-z0-9]+", tag) if p)
    if not pascal or not pascal[0].isalpha():
        pascal = "C" + pascal
    return pascal


def _css_string(value: str) -> str:
    """A CSS string literal that cannot break out of the declaration it is written into."""
    return '"' + str(value).replace("\\", "\\\\").replace('"', '\\"') + '"'


def _css_string_in_attr(value: str) -> str:
    """The same, for a declaration written inside an HTML attribute.

    `style="font-family: "Inter", sans-serif"` is not a font — the attribute ends at the second
    quote and the rest becomes garbage attributes. Inside an attribute the family is quoted with
    single quotes, which is what CSS allows and what the HTML wrapper tolerates.
    """
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def _lines_in_box(node):
    """How many lines the design's box holds — ITS OWN NUMBER when it states one.

    `maxLines` IS FIGMA'S ANSWER TO THIS QUESTION. On a truncating text layer it is the count the
    designer set, and where the design states one it is the count the drawing obeys, whatever the
    measured box divides to. It was measured into the spec and read by NOTHING — the count came
    from height / lineHeightPx alone — so a design stating `maxLines: 2` inside a box that divides
    to three kept three, and the fact that decided the drawing was the one fact nothing looked at.

    THE DIVISION IS THE FALLBACK, for the ordinary case where a design states truncation and no
    line count: a truncating box's own measured height is still that design's statement of how
    much room the layer has, and it is the only statement there is.
    """
    stated = node.get("maxLines")
    try:
        if stated is not None:
            count = int(stated)
            if count > 0:
                return count
    except (TypeError, ValueError):
        pass
    size = node.get("size") or []
    height = size[1] if isinstance(size, (list, tuple)) and len(size) > 1 else None
    line_height = (node.get("type_style") or {}).get("lineHeightPx")
    try:
        height_px, line_px = float(height), float(line_height)
    except (TypeError, ValueError):
        return None
    return max(1, int(height_px // line_px)) if height_px > 0 and line_px > 0 else None


def _data_field(node: dict[str, Any]) -> str | None:
    """The prop a text layer is bound to, from the designer's own annotation — or None.

    THE GRAMMAR IS THE REPOSITORY'S OWN (AGENTS-instructions/Core-Concept.md names the dev-mode
    annotations "Data:/On click:/Failure:"). A text layer annotated

        Data: name

    is not copy: it is where the component's NAME goes, so the element takes a `name` prop and
    renders the value instead of the placeholder words that happen to be typed in Figma. The
    annotation is the instruction; the text is only what the designer needed to see while drawing.

    THE SPEC CARRIES THEM AS TEXTS (`spec["annotation"]`, built in routes/figma.py), and the raw
    node carries them as objects with a label — this reads the SPEC's form. The other reader
    (`_annotated_fields` in routes/figma.py, which declares the same props in the catalogue) reads
    the raw form, and the two must agree about the grammar; the pattern is written the same in both
    places, deliberately, so the pairing is visible rather than implied.

    A name that cannot be a JavaScript property is refused rather than mangled: emitting
    `${this.2nd-name}` would not compile, and the ingest refuses what it cannot place.
    """
    for annotation in node.get("annotation") or []:
        match = re.match(r"^\s*Data\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*$", str(annotation))
        if match:
            return match.group(1)
    return None


def _data_fields(spec: dict[str, Any]) -> list[str]:
    """Every field this component binds, in tree order, first occurrence wins."""
    found: list[str] = []

    def walk(node: dict[str, Any]) -> None:
        field = _data_field(node)
        if field and field not in found:
            found.append(field)
        for child in node.get("children") or []:
            walk(child)

    walk(spec)
    return found


# The designer's own words for the three things a design can state that its measurements cannot —
# `Data` / `On click` / `State` — are the repository's, not this module's: the four field names and
# what each is for are written out in `frontend/src/shared/repairMaterial.ts`
# (`ANNOTATION_LINE_MEANING`: *'On click': "the event fired and its payload (e.g. dispatch
# role-select { role: <tile label> })"*). The pattern here reads that form and nothing else.
_ON_CLICK_RE = re.compile(r"^\s*On\s+click\s*:\s*(.+?)\s*$", re.IGNORECASE)
_DISPATCH_RE = re.compile(r"\bdispatch\s+([A-Za-z][A-Za-z0-9_:.-]*)")
_EVENT_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_:.-]*$")


def _on_click_event(node: dict[str, Any]) -> str | None:
    """The event a layer fires when it is clicked, from the designer's own annotation — or None.

    THE GRAMMAR IS THE REPOSITORY'S (see the note above): `On click: dispatch <event> { … }`. The
    event NAME is what an element can carry — it dispatches it and knows nothing else, because the
    payload is the consumer's business and the annotation's payload is prose (`{ role: <tile label> }`
    has a placeholder in it, which is not a value any element could send).

    THE BARE FORM IS READ TOO — `On click: chevron-toggle` — because a value that is one token IS a
    name. A SENTENCE IS NOT: `On click: show this chevrons annotation` matches nothing here and the
    layer is left unclickable, which is the honest result of a design that has not said which event
    it means. Nothing is guessed from the layer's name or from the letters of the sentence.
    """
    for annotation in node.get("annotation") or []:
        match = _ON_CLICK_RE.match(str(annotation))
        if not match:
            continue
        rest = match.group(1)
        dispatched = _DISPATCH_RE.search(rest)
        if dispatched:
            return dispatched.group(1)
        if _EVENT_NAME_RE.match(rest):
            return rest
    return None


def _on_click_events(spec: dict[str, Any]) -> list[str]:
    """Every event the design says its layers fire, in tree order, first occurrence wins."""
    found: list[str] = []

    def walk(node: dict[str, Any]) -> None:
        event = _on_click_event(node)
        if event and event not in found:
            found.append(event)
        for child in node.get("children") or []:
            walk(child)

    walk(spec)
    return found


def _text_html(node: dict[str, Any]) -> str:
    """A measured text layer, as markup: the runs styled as measured, the words escaped.

    THE RUNS ARE THE POINT. A layer styled in ranges — a bold title over a grey subtitle in the
    same text box — is one layer to Figma and several styles to the eye; `runs` carries them and
    each one is emitted as a span with its own font, size, weight, colour and line height. Without
    this the whole layer rendered in the primary style, which is where the missing line heights
    came from.

    Newlines are kept as text rather than turned into paragraphs, and the box is told to preserve
    them (`white-space: pre-wrap`): the measured offsets are character offsets into the layer's
    own string, so splitting it would move every run after the first line break.
    """
    text = str(node.get("text") or "")
    # A LAYER THE DESIGNER ANNOTATED AS DATA RENDERS ITS DATA, NOT THE PLACEHOLDER'S WORDS. The
    # runs are the placeholder's styling for the placeholder's text, so they are not carried with a
    # bound value: what arrives is not the string they were measured against. The box's own type
    # (font, size, weight, alignment, line height) still applies — that is the box the data goes in.
    field = _data_field(node)
    if field:
        return "${this." + field + "}"
    runs = [r for r in (node.get("runs") or []) if r.get("start") is not None and r.get("end") is not None]
    if not runs:
        return _html.escape(text).replace("\n", "<br/>")

    out: list[str] = []
    cursor = 0
    for run in sorted(runs, key=lambda r: r["start"]):
        start, end = int(run["start"]), int(run["end"])
        if start > cursor:
            out.append(_html.escape(text[cursor:start]).replace("\n", "<br/>"))
        style = run.get("style") or {}
        declarations = []
        if style.get("fontFamily"):
            declarations.append(f"font-family: {_css_string_in_attr(style['fontFamily'])}, sans-serif")
        if style.get("fontWeight"):
            declarations.append(f"font-weight: {style['fontWeight']}")
        if style.get("fontSize") is not None:
            declarations.append(f"font-size: {_px(style['fontSize'])}")
        if style.get("lineHeightPx") is not None:
            declarations.append(f"line-height: {_px(style['lineHeightPx'])}")
        if style.get("letterSpacing") is not None and float(style["letterSpacing"]) != 0:
            declarations.append(f"letter-spacing: {_px(style['letterSpacing'])}")
        if style.get("textCase") in _TEXT_CASE:
            declarations.append(f"text-transform: {_TEXT_CASE[style['textCase']]}")
        if style.get("textDecoration") in _TEXT_DECORATION:
            declarations.append(f"text-decoration: {_TEXT_DECORATION[style['textDecoration']]}")
        if style.get("fill"):
            declarations.append(f"color: {style['fill']}")
        inner = _html.escape(text[start:end]).replace("\n", "<br/>")
        if declarations:
            out.append(f'<span style="{"; ".join(declarations)}">{inner}</span>')
        else:
            out.append(inner)
        cursor = end
    if cursor < len(text):
        out.append(_html.escape(text[cursor:]).replace("\n", "<br/>"))
    return "".join(out)


def _truncation_frame(node: dict[str, Any]) -> list[str] | None:
    """The declarations that hold a truncating text layer to the whole lines that fit — or None.

    THE DESIGN'S OWN ARITHMETIC, ONCE. `_lines_in_box` answers how many lines the design keeps
    (its `maxLines` when it states one, its box height over its line height otherwise), and that
    count times the measured line height is the height of the lines that wholly fit. The box keeps
    its measured size — this constrains the TEXT inside it, not the layer — so the design's box,
    padding and alignment are untouched and only what overflows the last whole line is clipped.

    Nothing here invents a number: both factors are measurements, and the multiplication is what
    "show the lines that fit" means. It is NOT a clamp, NOT a runtime pass, and it draws no
    ellipsis — the design's ellipsis stays a reported defect (ACCEPTED_UNRENDERED) because no
    mechanism in this engine can draw one.
    """
    if node.get("truncation") != "ENDING":
        return None
    lines = _lines_in_box(node)
    line_height = (node.get("type_style") or {}).get("lineHeightPx")
    if not lines or line_height is None:
        return None
    try:
        height = float(line_height) * int(lines)
    except (TypeError, ValueError):
        return None
    if height <= 0:
        return None
    return ["display: block", f"max-height: {_px(height)}", "overflow: hidden"]


def _declarations(node: dict[str, Any], place: dict[str, float] | None = None) -> list[str]:
    """The CSS this layer's own measurements produce, in a fixed order.

    Fixed order matters: the same spec must produce the same bytes, or a diff between two runs of
    the same design is noise and nobody can tell a change from a reshuffle.

    `place` is where the design says this layer sits inside a parent that does not lay it out —
    see `_child_offset`. When it is given, this layer is positioned at that offset and nothing
    else decides where it goes.
    """
    out: list[str] = []
    layout = node.get("layout") or {}
    size = node.get("size") or []

    if layout.get("layoutMode") in ("HORIZONTAL", "VERTICAL"):
        out.append("display: flex")
        out.append(f"flex-direction: {'row' if layout['layoutMode'] == 'HORIZONTAL' else 'column'}")
        for key, css in _LAYOUT_PROPERTIES.items():
            if key in ("layoutMode", "itemSpacing"):
                continue
            if layout.get(key) is not None:
                out.append(f"{css}: {_px(layout[key])}")
        if layout.get("itemSpacing") is not None:
            out.append(f"gap: {_px(layout['itemSpacing'])}")
        # See the root's note: a value this file does not know gets NO declaration, never a
        # substituted alignment.
        primary = layout.get("primaryAxisAlignItems")
        if primary in _ALIGNMENTS:
            out.append(f"justify-content: {_ALIGNMENTS[primary]}")
        counter = layout.get("counterAxisAlignItems")
        if counter in _ALIGNMENTS:
            out.append(f"align-items: {_ALIGNMENTS[counter]}")
        if layout.get("layoutWrap") == "WRAP":
            out.append("flex-wrap: wrap")
    else:
        # ── A FRAME WITH NO AUTO-LAYOUT IS A CANVAS, NOT A FLOW ─────────────────
        # Its children sit at the offsets the design gives them — the offset is in the design and
        # nothing about it is a layout rule CSS could infer. So this box establishes a coordinate
        # space for its children to be positioned against, and does NOT lay them out itself.
        #
        # IT USED TO CENTRE THEM, and that is the half pixel. `Arrow_drop_down` is a 14×13 box
        # with a 1px border and a 10×6 arrow: centred in the 12×11 content box the arrow lands at
        # 2.5px from the top, where the design says 3. A half pixel is not a rounding of the right
        # answer, it is a different position — and the browser renders it by blurring two rows of
        # pixels, which is what "two hours for a two pixel padding" was looking at (owner,
        # 2026-09-29: *"Two hours for a two pixel padding… is it still serving half percentages?"*).
        out.append("position: absolute" if place is not None else "position: relative")
        if place is not None:
            out.append(f"left: {_px(place['left'])}")
            out.append(f"top: {_px(place['top'])}")

    if len(size) == 2:
        out.append(f"width: {_px(size[0])}")
        out.append(f"height: {_px(size[1])}")
        out.append("box-sizing: border-box")

    # A FILL MEANS TWO DIFFERENT THINGS, and getting them the same way round is what painted a
    # text layer as a solid box: on a shape it is the BACKGROUND, on a TEXT layer it is the COLOUR
    # OF THE WORDS. A text layer never gets a background from its fill.
    is_text = node.get("type", "").upper() == "TEXT" or node.get("text") is not None
    if node.get("fill") and not is_text:
        out.append(f"background: {node['fill']}")
    # SEVERAL FILLS ARE A STACK, and Figma lists them top-first — the same order CSS layers
    # backgrounds in. Only the first was read before, so everything under it was invisible.
    elif node.get("fills") and not is_text:
        out.append(f"background: {', '.join(node['fills'])}")
    if node.get("radius") is not None:
        out.append(f"border-radius: {_px(node['radius'])}")
    elif node.get("radii"):
        corners = " ".join(_px(v) for v in node["radii"])
        out.append(f"border-radius: {corners}")

    stroke = node.get("stroke") or {}
    if stroke.get("color"):
        weight = stroke.get("weight")
        weights = node.get("strokeWeights") or {}
        if weights:
            parts = " ".join(_px(weights.get(side, weight or 1)) for side in ("top", "right", "bottom", "left"))
            out.append(f"border-width: {parts}")
            out.append("border-style: solid")
            out.append(f"border-color: {stroke['color']}")
        elif node.get("strokeAlign") == "OUTSIDE":
            # A stroke drawn OUTSIDE the box is not a border: a border lives inside the box and
            # would change the layout. An outline draws outside and costs no layout, which is what
            # Figma's OUTSIDE alignment means.
            out.append(f"outline: {_px(weight) if weight is not None else '1px'} solid {stroke['color']}")
            out.append("outline-offset: 0")
        else:
            out.append(
                f"border: {_px(weight) if weight is not None else '1px'} solid {stroke['color']}"
                if weight is not None
                else f"border: 1px solid {stroke['color']}"
            )

    # WHAT THE LAYER DOES TO THE SPACE IT SITS IN, and to what it draws.
    if node.get("opacity") is not None:
        out.append(f"opacity: {node['opacity']}")
    if node.get("visible") is False:
        out.append("display: none")
    if node.get("clips"):
        # A frame that clips lets nothing spill; without this a child larger than its box draws
        # over whatever is beside it.
        out.append("overflow: hidden")
    if node.get("rotation") is not None:
        # Figma's rotation is degrees counter-clockwise; CSS rotates clockwise, so the sign
        # inverts. A rotated vector is placed by its own svg transform and never reaches here.
        out.append(f"transform: rotate({round(-float(node['rotation']), 3)}deg)")
    sizing = node.get("sizing") or {}
    if sizing.get("layoutGrow"):
        out.append("flex-grow: 1")
    if sizing.get("layoutSizingHorizontal") == "FILL" or sizing.get("layoutSizingVertical") == "FILL":
        out.append("align-self: stretch")
    align = sizing.get("layoutAlign")
    if align in ("STRETCH", "MIN", "CENTER", "MAX"):
        out.append(f"align-self: {'stretch' if align == 'STRETCH' else _ALIGNMENTS.get(align, 'auto')}")

    for effect in node.get("effects") or []:
        shadow = _shadow(effect)
        if shadow:
            out.append(f"box-shadow: {shadow}")

    style = node.get("type_style") or {}
    if style.get("fontFamily"):
        out.append(f"font-family: {_css_string(style['fontFamily'])}, sans-serif")
    if style.get("fontWeight"):
        out.append(f"font-weight: {style['fontWeight']}")
    if style.get("fontSize") is not None:
        out.append(f"font-size: {_px(style['fontSize'])}")
    if style.get("lineHeightPx") is not None:
        out.append(f"line-height: {_px(style['lineHeightPx'])}")
    if style.get("letterSpacing") is not None and float(style["letterSpacing"]) != 0:
        out.append(f"letter-spacing: {_px(style['letterSpacing'])}")
    if style.get("textAlignHorizontal"):
        out.append(f"text-align: {str(style['textAlignHorizontal']).lower()}")
    if style.get("textCase") in _TEXT_CASE:
        out.append(f"text-transform: {_TEXT_CASE[style['textCase']]}")
    if style.get("textDecoration") in _TEXT_DECORATION:
        out.append(f"text-decoration: {_TEXT_DECORATION[style['textDecoration']]}")
    if is_text:
        # THE LAYER'S OWN LINE BREAKS ARE PRESERVED, because the run offsets are character
        # offsets into the layer's string: turning newlines into separate paragraphs would move
        # every run after the first break.
        out.append("white-space: pre-wrap")
        if node.get("fill"):
            out.append(f"color: {node['fill']}")
        # ── THE WORDS WRAP INSIDE THE BOX THE DESIGN MEASURED, AND THE BOX CLIPS ────────────────
        # NO CLAMP. There was one here — `display: -webkit-box` + `-webkit-line-clamp` — and it was
        # MEASURED on 2026-09-30 to do nothing at all: the engine accepts the declaration, computes
        # it to the stated number, rewrites the box's `display` to `flow-root`, and draws every
        # line anyway (three lines at 14.5227px line height in a 43px box, no ellipsis). The
        # longhands that perform the clipping do not exist in that engine — `CSS.supports(
        # 'block-ellipsis','auto')` is false and `CSS.supports('line-clamp','2')` is false — so no
        # spelling of a multi-line ellipsis draws one, and six spellings were tried on a live page
        # to be sure. Worse than doing nothing: the rewrite it forces cost the DESIGN'S OWN
        # alignment, because a box whose display changes under it can no longer be centred by the
        # design's `textAlignVertical` (measured: text starting at -1px from the box's top edge
        # where the design's own rule puts it at +4px).
        #
        # So the clamp is gone and what remains is what the design itself says: the box, its type,
        # its measured height, the words wrapping inside it, and the clip at its own edge. The
        # ellipsis Figma draws is a fact this renderer CANNOT draw in that engine, and it is
        # REPORTED as a finding against the draft rather than faked here — see ACCEPTED_UNRENDERED,
        # where `truncation` now lives with that measurement written beside it.
        out.append("white-space: pre-wrap")
        out.append("word-break: break-word")
        # Vertical alignment inside the measured box: where the words sit when the box is taller than
        # they are. THE DESIGN'S OWN RULE, emitted as it stands — and it is emitted for a truncating
        # box too, because with no clamp in the way there is nothing left for it to fight with.
        align_vertical = style.get("textAlignVertical")
        if align_vertical in ("CENTER", "BOTTOM"):
            placement = "center" if align_vertical == "CENTER" else "flex-end"
            out.append("display: flex")
            out.append("flex-direction: column")
            out.append(f"justify-content: {placement}")

    return _settled(out)


def _settled(declarations: list[str]) -> list[str]:
    """The declaration list with its duplicates removed and its CONFLICTS named.

    WHY THIS EXISTS. Two branches of `_declarations` can state the same thing — measured on node
    40001207:3497, `data-tree-spacer` is `layoutAlign: STRETCH` AND `layoutSizingVertical: FILL`,
    and each one emitted `align-self: stretch`, so the box carried the declaration twice. A repeat
    of the same value is noise in a file whose whole promise is that every line is the design's.

    A repeat with a DIFFERENT value is worse than noise: CSS keeps the last one and says nothing,
    so the design's first statement is discarded at render time with no record of it. That is the
    same signature as the truncation fault — a declaration that is present, correct-looking, and
    not in force — so it is made visible instead of resolved in silence: the later value stands,
    which is what CSS would do anyway, and a comment naming both is written into the stylesheet.
    """
    out: list[str] = []
    seen: dict[str, int] = {}
    for declaration in declarations:
        prop = declaration.split(":", 1)[0].strip()
        if prop in seen:
            previous = out[seen[prop]]
            if previous.split(":", 1)[1].strip() == declaration.split(":", 1)[1].strip():
                continue  # the same thing twice: emit it once
            out.append(f"/* CONFLICT: {prop} stated as {previous.split(':', 1)[1].strip()!r} then "
                       f"{declaration.split(':', 1)[1].strip()!r} — CSS keeps the last */")
        seen[prop] = len(out)
        out.append(declaration)
    return out


def _px(value: Any) -> str:
    """A measured number as CSS pixels. Trailing zeros are trimmed so the output is stable."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return str(value)
    if number == int(number):
        return f"{int(number)}px"
    return f"{round(number, 4)}px".replace(".0px", "px")


def _shadow(effect: dict[str, Any]) -> str | None:
    """One measured effect as CSS. Reads the spec's own effect shape; invents nothing.

    `DROP_SHADOW` and `INNER_SHADOW` are box-shadows, with the spread Figma states — a spread was
    never read before, so a shadow that grew or shrank was drawn at its blur radius alone. Anything
    else (a layer blur, a background blur) is not a box-shadow and is not invented as one: it
    returns None and the caller emits nothing rather than something wrong.
    """
    if not isinstance(effect, dict):
        return None
    kind = str(effect.get("type") or "").upper()
    if kind not in ("DROP_SHADOW", "INNER_SHADOW"):
        return None
    dx = _px(effect.get("x") or 0)
    dy = _px(effect.get("y") or 0)
    blur = _px(effect.get("radius") or 0)
    spread = effect.get("spread")
    colour = effect.get("color") or "rgba(0, 0, 0, 0.25)"
    parts = [dx, dy, blur] + ([_px(spread)] if spread is not None else []) + [colour]
    return ("inset " if kind == "INNER_SHADOW" else "") + " ".join(parts)


def _child_offset(node: dict[str, Any], parent: dict[str, Any] | None) -> dict[str, float] | None:
    """Where a child sits inside a parent that does not lay it out — the measured offset.

    ONE RULE, ONE PLACE. This existed twice and the two copies disagreed: the vector's copy
    omitted the border inset, so the chevron's arrow landed a pixel into its frame while every
    other child landed correctly, and the render gate measured that as 54.6% of the arrow's own
    box. Two implementations of one rule is the defect; this is the single one.

    INSIDE A BORDER, CSS COUNTS FROM THE PADDING EDGE. An absolutely positioned child is placed
    relative to the box inside its parent's border, while Figma's offsets are from the frame's
    outer corner — so a parent with a stroke has its border width taken off the offset.
    """
    if parent is None or (parent.get("layout") or {}).get("layoutMode"):
        return None
    pos, parent_pos = node.get("position"), parent.get("position")
    if not (pos and parent_pos and len(pos) == 2 and len(parent_pos) == 2):
        return None
    inset = float(((parent.get("stroke") or {}).get("weight")) or 0)
    return {
        "left": round(pos[0] - parent_pos[0] - inset, 2),
        "top": round(pos[1] - parent_pos[1] - inset, 2),
    }

def render_spec(spec: dict[str, Any], tag: str, catalog: dict[str, str] | None = None) -> str:
    """The Lit component for a measured design. Pure: same spec, same source.

    THE CATALOGUE IS CONSULTED FIRST — `catalog` maps a component reference (the part of a node id
    before the last `;`) to the tag this repository already draws for it. A layer that is an
    instance of such a component is COMPOSED — the element is emitted — instead of being redrawn:
    the design system is not a picture of itself, and a component that already exists must not be
    built a second time inside the thing that uses it (owner, 2026-09-29: *"if that renderer is
    interpreting specs on its own then it's not reading the lit catalogue"*).

    The ordering inside is the design's own: the layer tree is walked once to assign class names
    (so they are stable and unique per layer), then once to emit the CSS and the markup, in tree
    order. A layer the catalogue supplies carries no CSS from the design at all — its size and
    layout belong to the component that already owns them.
    """
    catalog = catalog or {}
    class_names: dict[int, str] = {}
    used: dict[str, int] = {}

    def assign(node: dict[str, Any]) -> None:
        base = _class_name(node.get("name") or "", "layer")
        count = used.get(base, 0) + 1
        used[base] = count
        class_names[id(node)] = base if count == 1 else f"{base}-{count}"
        for child in node.get("children") or []:
            assign(child)

    assign(spec)

    def supplied_tag(node: dict[str, Any]) -> str | None:
        """The catalogue's tag for this layer, when it is an instance of one of its components."""
        if not catalog:
            return None
        reference = node.get("componentId")
        if not reference:
            # A layer can BE a component's own node rather than an instance of it.
            reference = node.get("id")
        if not reference:
            return None
        raw = str(reference).strip().lower()
        identity = raw if ";" not in raw else raw.rpartition(";")[0]
        return catalog.get(identity) or catalog.get(raw)

    # ── THE ROOT IS DRAWN BY THE SAME FUNCTION AS EVERY OTHER LAYER ─────────────────────────
    # It used to be hand-built here: a `display: flex` + `flex-direction` when the design stated
    # a layout mode, `position: relative` when it did not, then padding, gap, the two alignments
    # and the size — and NOTHING ELSE. So every other measurement the design made of its own
    # root frame was dropped on the floor: the fill, the stroke, the radius, the effects, the
    # opacity, the clipping and the sizing facts. Measured on node 40001207:3497 the root's
    # `fills` is `[{SOLID, #ffffff}]` and the emitted `:host` carried no `background` at all —
    # the design's white frame was drawn as whatever happened to be behind it, which is a pixel
    # that does not match, from a fact the ingest had measured correctly.
    #
    # The cause was not a missing line; it was that this layer had a SECOND PATH. `_declarations`
    # is what turns a measurement into CSS, and a root that does not go through it is a root
    # whose every future fact is forgotten by default. So there is no second path: the root is
    # handed to the same function as a child, and the one thing that is special about a root —
    # that a frame with no auto-layout establishes a coordinate space for children placed by
    # offset — is the `position: relative` that `_declarations` already emits for exactly that
    # case (owner, 2026-09-29: *"this is not AI right… how can a Turing process invent
    # something?"* — it cannot; a second code path can).
    root_decls: list[str] = _declarations(spec)

    rules: list[str] = []
    markup: list[str] = []  # noqa: F841 — declared beside `rules` and never written to; likely a leftover from an earlier shape

    def emit_class(selector: str, declarations: list[str]) -> None:
        # A comment is emitted as a comment: a trailing `;` after one would be an empty
        # declaration, which is valid CSS and still nobody's measurement.
        body = "".join(
            f"      {d}\n" if d.startswith("/*") else f"      {d};\n" for d in declarations
        )
        rules.append(f"    {selector} {{\n{body}    }}")

    # ── AN ANNOTATED LAYER IS A CONTROL, AND ALL IT KNOWS IS THE EVENT'S NAME ────────────────────
    # `On click: dispatch chevron-toggle` on a layer means that layer fires that event. The element
    # dispatches it — bubbling and composed, so the consumer that places this component hears it —
    # and knows nothing else: not what it means, not what should happen, not who listens. The
    # payload the annotation may describe travels no further than this line, because the annotation's
    # payload is prose (`{ role: <tile label> }`) and prose is not a value an element can send.
    #
    # A LAYER WHOSE ANNOTATION NAMES NO EVENT GETS NO LISTENER. The tile's chevron carries the prose
    # note "show this chevrons annotaitons", and a reader that turned that sentence into a click
    # would be inventing the design's behaviour — which is the failure this whole file exists to
    # refuse. `_on_click_event` returns None for it and the layer stays a drawing.
    def click_attr(node: dict[str, Any]) -> str:
        event = _on_click_event(node)
        return f" @click=${{() => this._fire('{event}')}}" if event else ""

    def with_click(svg: str, node: dict[str, Any]) -> str:
        """The same listener for artwork: a bare `<svg>` is an element too, so the attribute goes
        on it — a control drawn as a single vector (an icon button) would otherwise be a layer the
        design annotated and nothing could click."""
        event = _on_click_event(node)
        if not event:
            return svg
        return svg.replace("<svg", f"<svg @click=${{() => this._fire('{event}')}}", 1)

    def emit_node(node: dict[str, Any], depth: int, parent: dict[str, Any] | None = None) -> str:
        cls = class_names[id(node)]
        node_type = (node.get("type") or "").upper()
        kids = node.get("children") or []
        declarations = _declarations(node)
        # ── WHERE THE CHILD SITS, WHEN THE PARENT DOES NOT LAY IT OUT ──
        # A frame with no auto-layout is a canvas: its children sit at the offsets the design
        # gives them, and nothing about those offsets is a layout rule that CSS could infer.
        # THE OFFSET IS THE DESIGN'S, read by `_child_offset` — including the parent's border, so
        # the child lands where Figma says it does rather than a border's width inside it.
        place = _child_offset(node, parent)
        declarations = _declarations(node, place)

        # THE CATALOGUE FIRST. A layer that is an instance of a component this repository already
        # draws is composed, not redrawn — and carries no measured CSS, because its box, its
        # padding and its artwork belong to the component that owns them. This is the same element
        # the rest of the application uses; the design does not get a private copy of it.
        supplied = supplied_tag(node)
        if supplied:
            # An annotated instance still fires: the listener goes on the composed element itself,
            # and a click inside its shadow tree is retargeted to it, so the consumer hears the
            # event exactly as it would from any other layer. What the composed element DOES with
            # the click is its own business and not this file's.
            return f"<{supplied}{click_attr(node)}></{supplied}>"

        # A vector is the artwork the measurement produced — the finished svg, never a redraw.
        if node_type == "VECTOR" and (node.get("svg") or node.get("paths") or node.get("path")):
            svg = node.get("svg")
            if not svg:
                # EVERY PATH THE VECTOR HAS, for the same reason the svg above carries them: a
                # glyph is often several paths that only read as the design together, and the
                # first of them on its own is half a parenthesis.
                box = node.get("size") or [0, 0]
                drawn = node.get("paths") or [node.get("path")]
                paths = "".join(
                    f'<path d="{one}" fill="{node.get("fill") or "none"}"/>' for one in drawn if one
                )
                svg = (
                    f'<svg width="{box[0]}" height="{box[1]}" viewBox="0 0 {box[0]} {box[1]}" '
                    f'fill="none" xmlns="http://www.w3.org/2000/svg">{paths}</svg>'
                )
            if kids:
                inner = "".join(emit_node(child, depth + 1, node) for child in kids)
                return f'<div class="{cls}"{click_attr(node)}>{svg}{inner}</div>'
            # WHERE THE DESIGN SAYS THE ARTWORK SITS. A bare svg cannot carry a position, so a
            # vector placed by its own offset is wrapped in its element — and THE WRAPPER CARRIES
            # THE POSITION AND NOTHING ELSE. The artwork's paint is the svg path's own `fill`, and
            # its rotation is already in that path's coordinates (see _transform_path), so a
            # wrapper that repeated either would paint a filled rectangle behind the arrow and
            # turn it a second time. That is what this rule is: where it sits, and how big it is.
            if place is not None:
                box_decls = [
                    "position: absolute",
                    f"left: {_px(place['left'])}",
                    f"top: {_px(place['top'])}",
                ]
                box = node.get("size") or []
                if len(box) == 2:
                    box_decls.append(f"width: {_px(box[0])}")
                    box_decls.append(f"height: {_px(box[1])}")
                emit_class(f".{cls}", box_decls)
                return f'<div class="{cls}"{click_attr(node)}>{svg}</div>'
            return with_click(svg, node)

        inner = ""
        if kids:
            inner += "".join(emit_node(child, depth + 1, node) for child in kids)

        # A TEXT LAYER IS A CONTAINER WITH THE MEASURED RUNS INSIDE IT — never a paragraph inside
        # a paragraph. `_text_html` returns <p> runs, so wrapping them in another <p> made the
        # browser close the outer element immediately and drop the measured font and size onto an
        # empty box: the words then rendered at the browser's own defaults, which is what a preview
        # of measured text looked broken for.
        if node.get("text") is not None:
            emit_class(f".{cls}", declarations)
            truncated = _truncation_frame(node)
            if truncated:
                # ── THE WHOLE LINES THAT FIT, AND NOTHING BEYOND THEM ────────────────────────
                # Figma's ENDING truncation means: show the whole lines that fit in the box, then
                # end the text. The design states the box's height and the line height, so the
                # count is the design's own arithmetic — `_lines_in_box`, which takes the design's
                # `maxLines` outright when it states one. That count times the line height is the
                # height of the lines that wholly fit, and a wrapper carrying exactly that much
                # with `overflow: hidden` clips at the line boundary: no half line, no clamp, no
                # runtime pass.
                #
                # MEASURED, this is what puts the text where Figma puts it. On node 40001207:3497
                # the description box is 43px with a 14.5227px line height, so two lines fit
                # (29.0454px) and the design's own CENTER aligns them: Figma's ink for that layer
                # sits at y 7–33, and two centred lines land at exactly y 7–33. The previous
                # drawing let the third line overflow the box and its ink ran y 0–39 — the one
                # structural difference in a 622x40 row whose every other layer measures within a
                # pixel (verified 2026-09-30 by an origin-aligned pixel diff of the rendered
                # element against Figma's own scale-1 export).
                #
                # THE ELLIPSIS IS STILL NOT DRAWN, and this does not pretend otherwise: the last
                # visible line simply ends. That remains a reported defect per layer
                # (ACCEPTED_UNRENDERED), because no mechanism in this engine draws a multi-line
                # ellipsis — six spellings were measured and none drew one.
                emit_class(f".{cls}-lines", truncated)
                return (
                    f'<div class="{cls}"{click_attr(node)}>'
                    f'<span class="{cls}-lines">{_text_html(node)}</span>{inner}</div>'
                )
            return f'<div class="{cls}"{click_attr(node)}>{_text_html(node)}{inner}</div>'

        emit_class(f".{cls}", declarations)
        return f'<div class="{cls}"{click_attr(node)}>{inner}</div>'

    emit_class(":host", root_decls)
    body = "".join(emit_node(child, 2, spec) for child in spec.get("children") or [])

    class_name = _component_class(spec.get("name") or "", tag)
    styles = "\n".join(rules)
    # ── THE PROPS THE ELEMENT ACTUALLY IMPLEMENTS ────────────────────────────────────────────────
    # One per layer the designer annotated `Data: <field>`, because those are the layers whose text
    # is a value and not copy. Empty when the design annotates none — an empty object, not a
    # placeholder list, because a declared prop the element does not read is the class of untruth
    # this repository keeps finding (a generated element was registered with `content`, `justify`
    # and `align` while its own `static properties` was empty).
    #
    # THE DEFAULTS ARE EMPTY STRINGS, and that is the same rule the preview runs on: nothing is
    # handed to the element, so a field with no data draws nothing. Painting the placeholder's words
    # in as a default would put words on screen that no data ever said.
    #
    # AND ONE SPREAD, WHICH IS NOT THE DESIGN'S: `behaviourProperties('<tag>')` adds the props the
    # hand-written behaviour for this tag declares, so they are REACTIVE — Lit reads
    # `static properties` once, at `customElements.define`, and a prop declared after that is a
    # plain field whose change never re-renders. It is still derivable (a pure lookup into a file
    # that is never generated), so this file's invariant — re-ingesting the same node produces this
    # same file — holds, and the design's own fields are written LAST so a design field wins.
    fields = _data_fields(spec)
    props_lines = "".join(f"    {f}: {{ type: String }},\n" for f in fields)
    props_js = "{\n" f"    ...behaviourProperties('{tag}'),\n" f"{props_lines}" "  }"
    if fields:
        ctor = (
            "\n  constructor() {\n    super();\n"
            + "".join(f"    this.{f} = '';\n" for f in fields)
            + "  }\n"
        )
    else:
        ctor = ""

    # ── THE EVENTS THE DESIGN SAYS ITS LAYERS FIRE ───────────────────────────────────────────────
    # One dispatcher, emitted only when the design annotates a layer `On click:`, and it is
    # deliberately the whole of this element's knowledge: a name, dispatched. What the event means
    # and who answers it belongs to whoever places the component — the same division that keeps the
    # element from needing a listener, a handler or an opinion.
    events = _on_click_events(spec)
    fire = (
        "\n  /**\n"
        "   * THE EVENT THE DESIGN SAID THIS COMPONENT FIRES, and nothing beyond it: the name is the\n"
        "   * annotation's, the meaning is the consumer's. Bubbling and composed, so a consumer that\n"
        "   * places this element hears it wherever it sits.\n"
        "   */\n"
        "  private _fire(name: string) {\n"
        "    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true }));\n"
        "  }\n"
        if events
        else ""
    )
    return f"""import {{ LitElement, html, css }} from 'lit';
// THE SEAM. A hand-written loader, never generated — see connectedCallback below.
//
// IT IS A RELATIVE PATH ON PURPOSE, and it resolves in the two places this file is ever loaded:
// in the catalogue, `src/components/lit/behaviour/attach.ts` (the real loader, beside this file);
// in a PREVIEW, the inert copy the ingest writes into `.preview/<jobId>/behaviour/attach.ts`, so a
// preview resolves locally and never imports anything the application ships — a preview is blind to
// the catalogue (owner, 2026-09-30: *"whenever it's in the preview it should be blind to the lit
// catalogue… It shouldn't have any idea"*; see vite-plugin-figma-preview.ts). The file this
// generates is therefore byte-identical to the file that will be committed, and which loader it
// reaches is decided by where it is read from.
import {{ attachBehaviour, detachBehaviour, behaviourProperties }} from './behaviour/attach';

/**
 * {spec.get('name') or 'Component'} — measured from Figma node {spec.get('id') or '(unknown)'}
 * and rendered from the measurements. Every declaration below comes from the design; there is no
 * interpretation in this file, and re-ingesting the same node produces this same file.
 *
 * THE ONE THING HERE THAT IS NOT THE DESIGN'S is the seam: `behaviourProperties` on the line above
 * the styles, and the two lifecycle calls under it. They are the same bytes in every generated
 * element, and they hand this instance to the behaviour written for `{tag}` — a hand-written file no
 * ingest can write. Everything that is not a drawing lives there: extra props, listeners,
 * dispatched events, slot fills. This file holds the drawing and the opening.
 */
export class {class_name} extends LitElement {{
  static properties = {props_js};
{ctor}{fire}
  /**
   * THE OPENING. Not a declaration of what this component does — a call to the file that says it.
   * That split is the whole reason a re-ingest of this node cannot take the component's props,
   * listeners or dispatch away: none of them are in this file to be taken.
   */
  connectedCallback() {{
    super.connectedCallback();
    attachBehaviour(this, '{tag}');
  }}

  disconnectedCallback() {{
    super.disconnectedCallback();
    detachBehaviour(this, '{tag}');
  }}

  static styles = css`
{styles}
  `;

  render() {{
    return html`
      {body.strip()}
    `;
  }}
}}

if (!customElements.get('{tag}')) {{
  customElements.define('{tag}', {class_name});
}}
"""
