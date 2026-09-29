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
from typing import Any, Optional

# The spec keys this renderer knows how to place. Anything outside this set that turns up in a
# spec is a key the two halves of the contract disagree about, and the ingest REFUSES on it — a
# measurement nobody can place is not something to render "well enough".
RENDERED_KEYS = {
    "id", "name", "type", "size", "position", "layout", "fill", "fills", "stroke", "radius",
    "radii", "effects", "text", "type_style", "runs", "truncation", "maxLines", "textAutoResize",
    "path", "paths", "windingRule", "svg", "componentId", "annotation", "children",
    "opacity", "visible", "clips", "rotation", "sizing", "counterAxisSpacing",
    "strokeAlign", "strokeWeights", "strokeCap", "strokeJoin", "dashPattern", "constraints",
}

# Measured, and deliberately NOT emitted yet — with the reason. These are reported as findings
# against the draft (so the gap is visible and countable) rather than refused, because each one is
# a decision about what the element is allowed to do, not a value being dropped in silence.
ACCEPTED_UNRENDERED = {
    "constraints": "Figma resizing constraints govern how a layer behaves when its frame is "
                   "resized; an element fixed at its measured size has nothing to obey them.",
    "strokeCap": "applies to an open path's ends; a border has no ends.",
    "strokeJoin": "applies to a path's corners; a border's corners are covered by radius.",
    "dashPattern": "a dashed stroke is a Figma stroke style, and a CSS border cannot take a dash "
                   "pattern without a drawn path.",
    "textAutoResize": "Figma's name for whether a text box hugs its words; the measured size is "
                      "already the result of that rule.",
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
    """Spec keys this renderer does not know how to place — reported, never dropped in silence."""
    found: list[str] = []
    seen: set = set()

    def walk(node: dict[str, Any]) -> None:
        for key in node:
            if key not in RENDERED_KEYS and key not in seen:
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


def _declarations(node: dict[str, Any], place: Optional[dict[str, float]] = None) -> list[str]:
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
        # ── A TEXT BOX IS A BOX, AND FIGMA SAYS WHAT IT DOES WITH WHAT DOES NOT FIT ──
        # `textTruncation: ENDING` is the ellipsis the designer chose; `maxLines` is how many
        # lines it keeps before the ellipsis. Neither was read before, so a truncated label
        # rendered as overflowing text — the same words, spilling out of their box.
        max_lines = node.get("maxLines")
        if node.get("truncation") == "ENDING":
            if max_lines and int(max_lines) > 1:
                out.append("display: -webkit-box")
                out.append("-webkit-box-orient: vertical")
                out.append(f"-webkit-line-clamp: {int(max_lines)}")
                out.append("overflow: hidden")
            else:
                out.append("overflow: hidden")
                out.append("text-overflow: ellipsis")
                out.append("white-space: nowrap")
        else:
            out.append("word-break: break-word")
        # Vertical alignment inside the measured box: where the words sit when the box is taller
        # than they are.
        align_vertical = style.get("textAlignVertical")
        if align_vertical in ("CENTER", "BOTTOM"):
            out.append("display: flex")
            out.append("flex-direction: column")
            out.append(f"justify-content: {'center' if align_vertical == 'CENTER' else 'flex-end'}")

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


def _shadow(effect: dict[str, Any]) -> Optional[str]:
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


def _child_offset(node: dict[str, Any], parent: Optional[dict[str, Any]]) -> Optional[dict[str, float]]:
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

def render_spec(spec: dict[str, Any], tag: str, catalog: Optional[dict[str, str]] = None) -> str:
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

    def supplied_tag(node: dict[str, Any]) -> Optional[str]:
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

    # ── THE ROOT IS WHAT THE DESIGN SAYS IT IS, AND NOTHING ELSE ────────────
    # Its own layout when the design states one; a box its children can be positioned against
    # when it does not. It was declared a flex row either way, and that is the shape of the
    # defect this file keeps having: `display: flex` + `flex-direction: row` on a frame the
    # design gave no layout is a rule a PERSON wrote, and a rule like that is where a number the
    # design never mentions comes from. The chevron's arrow landed at 2.5px because a line said
    # "centre it" while the design said 4 from the top (owner, 2026-09-29: *"this is not AI right…
    # how can a Turing process invent something?"* — it cannot; a constant in this file did).
    root_decls: list[str] = []
    layout = spec.get("layout") or {}
    mode = layout.get("layoutMode")
    if mode in ("HORIZONTAL", "VERTICAL"):
        root_decls.append("display: flex")
        root_decls.append(f"flex-direction: {'row' if mode == 'HORIZONTAL' else 'column'}")
    else:
        root_decls.append("position: relative")
    for key, css in _LAYOUT_PROPERTIES.items():
        if key in ("layoutMode", "itemSpacing"):
            continue
        if layout.get(key) is not None:
            root_decls.append(f"{css}: {_px(layout[key])}")
    if layout.get("itemSpacing") is not None:
        root_decls.append(f"gap: {_px(layout['itemSpacing'])}")
    # AN ALIGNMENT THE DESIGN STATES IS EMITTED; ONE THIS FILE DOES NOT KNOW IS NOT REPLACED BY
    # `flex-start`. That default was a stand-in value wearing the design's clothes — the same
    # class of thing as the centring. Every value Figma emits is in `_ALIGNMENTS`, so the gap is
    # a design stating something this renderer has never been taught, and the honest output for
    # that is no declaration at all rather than a different alignment than the design asked for.
    primary = layout.get("primaryAxisAlignItems")
    if primary in _ALIGNMENTS:
        root_decls.append(f"justify-content: {_ALIGNMENTS[primary]}")
    counter = layout.get("counterAxisAlignItems")
    if counter in _ALIGNMENTS:
        root_decls.append(f"align-items: {_ALIGNMENTS[counter]}")
    size = spec.get("size") or []
    if len(size) == 2:
        root_decls.append(f"width: {_px(size[0])}")
        root_decls.append(f"height: {_px(size[1])}")
    root_decls.append("box-sizing: border-box")

    rules: list[str] = []
    markup: list[str] = []

    def emit_class(selector: str, declarations: list[str]) -> None:
        body = "".join(f"      {d};\n" for d in declarations)
        rules.append(f"    {selector} {{\n{body}    }}")

    def emit_node(node: dict[str, Any], depth: int, parent: Optional[dict[str, Any]] = None) -> str:
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
            return f"<{supplied}></{supplied}>"

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
                return f'<div class="{cls}">{svg}{inner}</div>'
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
                return f'<div class="{cls}">{svg}</div>'
            return svg

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
            return f'<div class="{cls}">{_text_html(node)}{inner}</div>'

        emit_class(f".{cls}", declarations)
        return f'<div class="{cls}">{inner}</div>'

    emit_class(":host", root_decls)
    body = "".join(emit_node(child, 2, spec) for child in spec.get("children") or [])

    class_name = _component_class(spec.get("name") or "", tag)
    styles = "\n".join(rules)
    return f"""import {{ LitElement, html, css }} from 'lit';

/**
 * {spec.get('name') or 'Component'} — measured from Figma node {spec.get('id') or '(unknown)'}
 * and rendered from the measurements. Every declaration below comes from the design; there is no
 * interpretation in this file, and re-ingesting the same node produces this same file.
 */
export class {class_name} extends LitElement {{
  static properties = {{}};

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
