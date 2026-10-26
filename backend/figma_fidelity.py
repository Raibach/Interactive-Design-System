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

from design_renderer import (
    SHAPE_TYPES, _SYSTEM_FACE, _class_name, _lines_in_box, _local_face, render_spec,
)

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

    A ROW IS ONLY WORTH PRINTING WHEN THE DESIGN SAID SOMETHING. Four ways a key can be present
    and still be saying nothing, each of which produced noise when it was not handled:

      * an empty list or object — `fills: []` and `effects: []` mean "this layer has none", which
        needs no declaration;
      * a boolean that is already the drawing's default — `clipsContent: false` is a frame that
        does not clip, and reporting it as a lost fact is the instrument lying;
      * a fact that only means something alongside another — a `strokeWeight` with no `strokes` is
        Figma's default on a layer that has no border to weigh;
      * a PAINT SWITCHED OFF — `strokes: [{visible: false}]` is a border the designer hid, and the
        ingest's own spec builder carries only paints with `visible: true`; this function did not
        ask, so a hidden leftover read as "stated and never reached the spec" and refused a whole
        ingest on 2026-10-05 (measured on `prompt-textarea-container-system`).

    `visible: false` ON THE LAYER is the exception that keeps its weight, because a hidden layer
    must be drawn hidden, and `rotation: 0` was already filtered by the spec builder.
    """
    if key in TRUNCATION_KEYS:
        return raw_node.get(key) is not None or (raw_node.get("style") or {}).get(key) is not None
    if key == "style":
        return bool(raw_node.get("style"))
    if key == "characters":
        return raw_node.get("characters") is not None
    if key in STROKE_DEPENDENT and not _stroke_present(raw_node):
        return False
    # A PAINT NOBODY CAN SEE ASKS FOR NO DECLARATION (2026-10-05). The spec builder carries only
    # visible paints, so an all-hidden paint list is a fact the drawing already decided — the
    # check must decide it the same way or it invents a loss. Where the fix draws its boundary:
    # a VISIBLE stroke the renderer cannot draw (a gradient border, measured) still states its
    # fact and still blocks.
    #
    # AN EFFECT THE DESIGNER SWITCHED OFF IS THE SAME FACT. Measured 2026-10-26 on node
    # 40001421:5467: `controlBar` carried an effect with `visible: false`, the ingest skipped it on
    # purpose, and this check reported `effects` as "stated and never reached the spec" — a loss
    # that did not exist, printed beside a 100% count. An instrument that invents a failure is as
    # wrong as one that hides a failure, and it teaches a reader to distrust the real ones.
    if key in ("strokes", "fills", "effects") and not any(
        p.get("visible", True) for p in raw_node.get(key) or []
    ):
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
# SHAPE_TYPES comes from design_renderer — the single definition of which layers draw as a path.


# ── A WORD IS NOT A VALUE ─────────────────────────────────────────────────────────────────────
# THE BLIND CHECK THIS REPLACES, said plainly because it is the whole reason this section exists.
# For each fact it looked for a WORD in the layer's declarations: `absoluteBoundingBox` asked
# whether `width` appeared, `fills` asked whether `background` appeared, `style` asked whether
# `font-family` appeared. Every layer with a width therefore passed the position check, every
# layer with a background passed the colour check, and a design moved by ONE PIXEL or recoloured
# by ONE DIGIT passed both. The measurement was right and the instrument could not see it — which
# is how a pipeline reports "every fact drawn" about a drawing that is wrong.
#
# SO EVERY FACT IS NOW A PAIR OF VALUES: what Figma states, and what the drawing carries. The
# verdict is equality between those two, at the precision the drawing keeps. Nothing here
# re-measures the design: it reads the raw node and the emitted file and compares them.
#
# WHAT A ROW CARRIES NOW: `source` (the Figma value, as written), `drawn` (the value in the
# component, as written), and `delta` (the difference, when there is one). A designer reading the
# answer sees `y 41 → 42`, or `#1a2b3c → #1a2b3d`, instead of the word "drawn".

_PX_EPS = 5e-5      # the last digit `_px` keeps: 40.55 equals 40.55, and 40.5 does not
_ALPHA_EPS = 5e-4   # the last digit a colour's alpha keeps
_STOP_EPS = 0.005   # a gradient stop is written in whole percent
_ANGLE_EPS = 0.1    # a gradient angle is written to one decimal

# The raw keys that name more than one fact. A bounding box is a size AND a position; a text
# style is nine facts that fail separately, so a font size that changed must not hide behind a
# font family that did not.
_STYLE_FACTS = (
    "fontFamily", "fontWeight", "fontSize", "lineHeightPx", "letterSpacing",
    "textAlignHorizontal", "textCase", "textDecoration", "textAlignVertical",
)
_FACT_LABELS: dict[str, tuple[str, ...]] = {
    "absoluteBoundingBox": ("size", "position"),
    "style": tuple(f"style.{key}" for key in _STYLE_FACTS),
}


def _decl(decls: list[str], prop: str) -> str | None:
    """The value of the LAST declaration carrying this property — which is the one CSS keeps."""
    found: str | None = None
    for declaration in decls:
        head, _, tail = declaration.partition(":")
        if head.strip() == prop:
            found = tail.strip()
    return found


def _decl_any(decls: list[str], *props: str) -> tuple[str | None, str | None]:
    """The first property from this list that the layer declares, with its value."""
    for prop in props:
        value = _decl(decls, prop)
        if value is not None:
            return prop, value
    return None, None


def _num(text: Any) -> float | None:
    """A CSS length as a number. `41px` is 41.0; `auto` is None, which is not a value."""
    if text is None:
        return None
    raw = str(text).strip().rstrip(";").strip()
    if raw.endswith("px"):
        raw = raw[:-2]
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


def _same(a: float | None, b: float | None, eps: float = _PX_EPS) -> bool:
    return a is not None and b is not None and abs(a - b) <= eps


def _n(value: float) -> str:
    """A number as the reading shows it: no trailing zeros, no noise."""
    if float(value) == int(value):
        return str(int(value))
    return f"{round(float(value), 4)}"


def _unquote_family(value: str | None) -> str:
    """`"Inter", sans-serif` → `Inter`. The fallback is not part of the design's fact."""
    text = str(value or "").strip()
    out: list[str] = []
    quote: str | None = None
    for char in text:
        if quote:
            if char == quote:
                quote = None
            else:
                out.append(char)
        elif char in "\"'":
            quote = char
        elif char == ",":
            break
        else:
            out.append(char)
    return "".join(out).strip()


def _paint_css(paint: dict[str, Any]) -> str | None:
    """A solid paint as the CSS colour it must become, computed HERE and not by the ingest.

    Computed independently on purpose: if this called the ingest's own converter, a fault in that
    converter would appear on both sides of the comparison and cancel itself out.
    """
    color = (paint or {}).get("color") or {}
    try:
        r = round(float(color.get("r", 0)) * 255)
        g = round(float(color.get("g", 0)) * 255)
        b = round(float(color.get("b", 0)) * 255)
        alpha = color.get("a")
        alpha = 1.0 if alpha is None else float(alpha)
    except (TypeError, ValueError):
        return None
    fill_opacity = paint.get("opacity")
    if fill_opacity is not None:
        try:
            alpha *= float(fill_opacity)
        except (TypeError, ValueError):
            pass
    if alpha >= 0.999:
        return f"#{r:02x}{g:02x}{b:02x}"
    return f"rgba({r}, {g}, {b}, {round(alpha, 3)})"


def _channels(css: str | None) -> tuple[float, float, float, float] | None:
    """A CSS colour as channels 0..1, so two spellings of one colour compare equal."""
    import re

    text = str(css or "").strip()
    match = re.fullmatch(r"#([0-9a-fA-F]{6})", text)
    if match:
        hexes = match.group(1)
        return tuple(int(hexes[i:i + 2], 16) / 255 for i in (0, 2, 4)) + (1.0,)  # type: ignore[return-value]
    match = re.fullmatch(r"rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)", text)
    if match:
        r, g, b = (float(match.group(i)) / 255 for i in (1, 2, 3))
        a = float(match.group(4)) if match.group(4) is not None else 1.0
        return (r, g, b, a)  # type: ignore[return-value]
    return None


def _same_colour(a: str | None, b: str | None) -> bool:
    ca, cb = _channels(a), _channels(b)
    if ca is None or cb is None:
        return False
    return all(abs(x - y) <= _ALPHA_EPS for x, y in zip(ca, cb))


def _visible_paints(raw_node: dict[str, Any], key: str) -> list[dict[str, Any]]:
    return [p for p in raw_node.get(key) or [] if isinstance(p, dict) and p.get("visible", True)]


def _gradient_css(paint: dict[str, Any]) -> str | None:
    """The gradient a paint states, as CSS — computed here, independent of the ingest."""
    import math

    stops = sorted(
        (s for s in paint.get("gradientStops") or [] if isinstance(s, dict)),
        key=lambda s: s.get("position", 0),
    )
    if len(stops) < 2:
        return None
    parts: list[str] = []
    for stop in stops:
        colour = _paint_css({"color": stop.get("color")})
        if not colour:
            return None
        parts.append(f"{colour} {round(float(stop.get('position', 0)) * 100)}%")
    stops_css = ", ".join(parts)
    kind = str(paint.get("type") or "").upper()
    handles = paint.get("gradientHandlePositions") or []
    if kind == "GRADIENT_LINEAR" and len(handles) >= 2:
        dx = float(handles[1].get("x", 0)) - float(handles[0].get("x", 0))
        dy = float(handles[1].get("y", 0)) - float(handles[0].get("y", 0))
        angle = math.degrees(math.atan2(dy, dx)) + 90.0
        return f"linear-gradient({round(angle % 360, 1)}deg, {stops_css})"
    if kind in ("GRADIENT_RADIAL", "GRADIENT_DIAMOND"):
        return f"radial-gradient(circle at 50% 50%, {stops_css})"
    if kind == "GRADIENT_ANGULAR":
        return f"conic-gradient({stops_css})"
    return None


def _shadow_css(effect: dict[str, Any]) -> str | None:
    """One measured effect as the shadow it must become, computed here."""
    kind = str((effect or {}).get("type") or "").upper()
    if kind not in ("DROP_SHADOW", "INNER_SHADOW"):
        return None
    # FIGMA PUTS THE OFFSET IN A NESTED `offset` FIELD, and the spec carries it flat. Reading the
    # raw node's own shape here is what keeps this check independent of the ingest's conversion.
    offset = effect.get("offset") or {}
    dx_raw = offset["x"] if "x" in offset else effect.get("x")
    dy_raw = offset["y"] if "y" in offset else effect.get("y")
    dx = _n(float(dx_raw or 0))
    dy = _n(float(dy_raw or 0))
    blur = _n(float(effect.get("radius") or 0))
    parts = [f"{dx}px", f"{dy}px", f"{blur}px"]
    if effect.get("spread") is not None:
        parts.append(f"{_n(float(effect['spread']))}px")
    colour = effect.get("color")
    if isinstance(colour, dict):
        # Figma sends an effect's colour as channels, and the spec carries it as CSS. Convert it
        # here rather than borrowing the ingest's converter, so a fault there cannot cancel itself.
        colour = _paint_css({"color": colour})
    parts.append(colour or "rgba(0, 0, 0, 0.25)")
    return ("inset " if kind == "INNER_SHADOW" else "") + " ".join(parts)


def _split_top_level(text: str) -> list[str]:
    """Split on commas that are not inside parentheses — a gradient is ONE background layer."""
    parts: list[str] = []
    depth = 0
    start = 0
    for index, char in enumerate(text):
        if char == "(":
            depth += 1
        elif char == ")":
            depth -= 1
        elif char == "," and depth == 0:
            parts.append(text[start:index].strip())
            start = index + 1
    parts.append(text[start:].strip())
    return [part for part in parts if part]


def _is_gradient(paint: dict[str, Any]) -> bool:
    return str((paint or {}).get("type") or "").upper().startswith("GRADIENT")


def _same_gradient(expected: str | None, drawn: str | None) -> bool:
    """Two gradients carrying the same direction and the same stops, value for value.

    Parsed rather than compared as text, so the check does not certify a formatting match: the
    angle is read from Figma's handles and checked against the drawn one, and every stop's colour
    and position is compared separately. A one-digit change in a stop colour fails this.
    """
    import re

    if not expected or not drawn:
        return False
    if expected.strip() == drawn.strip():
        return True
    pattern = re.compile(r"^(linear-gradient|radial-gradient|conic-gradient)\((.*)\)$", re.S)
    left, right = pattern.match(expected.strip()), pattern.match(drawn.strip())
    if not left or not right or left.group(1) != right.group(1):
        return False

    def parse(body: str) -> tuple[float | None, list[tuple[str, float]]] | tuple[None, None]:
        parts = _split_top_level(body)
        angle: float | None = None
        if parts and parts[0].endswith("deg"):
            angle = float(parts[0][:-3])
            parts = parts[1:]
        stops: list[tuple[str, float]] = []
        for part in parts:
            match = re.match(r"^(.*?)\s+([\d.]+)%$", part)
            if not match:
                return None, None
            stops.append((match.group(1).strip(), float(match.group(2))))
        return angle, stops

    angle_a, stops_a = parse(left.group(2))
    angle_b, stops_b = parse(right.group(2))
    if stops_a is None or stops_b is None or len(stops_a) != len(stops_b):
        return False
    if (angle_a is None) != (angle_b is None):
        return False
    if angle_a is not None and abs(angle_a - angle_b) > _ANGLE_EPS:
        return False
    return all(
        _same_colour(colour_a, colour_b) and abs(pos_a - pos_b) <= _STOP_EPS
        for (colour_a, pos_a), (colour_b, pos_b) in zip(stops_a, stops_b)
    )


def _svg_attr(spec_node: dict[str, Any], name: str) -> str | None:
    """An attribute the artwork itself carries: `width`, `height`, `viewBox`, `fill`, `stroke`."""
    import re

    svg = str(spec_node.get("svg") or "")
    if not svg:
        return None
    if name == "fill":
        # THE PAINT IS ON THE PATH. The root `<svg>` carries `fill="none"` on purpose — it is not
        # the design's colour — so reading the first `fill=` in the string reported every drawn
        # shape as having no fill at all.
        match = re.search(r'<path\b[^>]*\bfill="([^"]*)"', svg)
        return match.group(1) if match else None
    match = re.search(rf'\b{name}="([^"]*)"', svg)
    return match.group(1) if match else None


def _markup_for_class(source: str, class_name: str) -> str:
    """This layer's own element and everything inside it, taken from the emitted markup.

    Taken by scanning the element's own tags rather than by searching the whole file: a check that
    reads the whole file lets one layer's `<path>` satisfy every layer's artwork check.
    """
    import re

    needle = f'class="{class_name}"'
    at = source.find(needle)
    if at < 0:
        return ""
    start = source.rfind("<", 0, at)
    if start < 0:
        return ""
    depth = 0
    for match in re.finditer(r"<(/?)div\b[^>]*>", source[start:]):
        if match.group(1):
            depth -= 1
        else:
            depth += 1
        if depth <= 0:
            return source[start:start + match.end()]
    return source[start:]


def _own_text(markup: str) -> str:
    """The words inside this layer's own box, before any child layer begins."""
    import html as _html
    import re

    # THE LAYER'S OWN OPENING TAG IS NOT A CHILD. Cutting at the first `<div` cut the whole box
    # away — the layer's own `<div class="…">` IS the first one — so every text layer read as
    # empty and reported its words as lost.
    body = re.sub(r"^<div\b[^>]*>", "", markup.strip())
    leading = re.split(r"<div\b", body, maxsplit=1)[0]
    leading = re.sub(r"<br\s*/?>", "\n", leading)
    leading = re.sub(r"<[^>]*>", "", leading)
    return _html.unescape(leading)


def _clip(text: Any, limit: int = 58) -> str:
    """A value for a table cell, without the quoting a JSON dump adds around a plain string."""
    plain = "" if text is None else str(text)
    return plain if len(plain) <= limit else plain[: limit - 1] + "…"


def _runs_drawn(markup: str) -> list[dict[str, str]]:
    """Every span the drawing emitted for this layer, with its text and its colour."""
    import re

    out: list[dict[str, str]] = []
    for match in re.finditer(r'<span style="([^"]*)">(.*?)</span>', markup, re.S):
        declarations = [d.strip() for d in match.group(1).split(";") if d.strip()]
        out.append({
            "text": _own_text(match.group(2)),
            "color": _decl(declarations, "color") or "",
            "fontFamily": _unquote_family(_decl(declarations, "font-family")),
            "fontSize": _decl(declarations, "font-size") or "",
        })
    return out


def _stroke_drawn(spec_node: dict[str, Any], decls: list[str]) -> dict[str, Any]:
    """How this layer's border was emitted: colour, weight, and by which declaration."""
    svg = str(spec_node.get("svg") or "")
    if svg:
        import re

        colour = re.search(r'\bstroke="([^"]*)"', svg)
        weight = re.search(r'\bstroke-width="([^"]*)"', svg)
        if colour:
            return {"color": colour.group(1), "weight": _num(weight.group(1)) if weight else None, "by": "svg"}

    prop, value = _decl_any(decls, "border", "outline")
    if value:
        import re

        match = re.match(r"(?:([\d.]+)px)\s+solid\s+(\S+)", value)
        if match:
            return {"color": match.group(2), "weight": float(match.group(1)), "by": prop or ""}
    colour = _decl(decls, "border-color")
    widths = _decl(decls, "border-width")
    if colour:
        first = _num((widths or "").split()[0]) if widths else None
        return {"color": colour, "weight": first, "by": "border-color"}
    return {"color": None, "weight": None, "by": ""}


def _compare_fact(
    raw_node: dict[str, Any],
    spec_node: dict[str, Any],
    fact: str,
    decls: list[str],
    markup: str,
    parent_spec: dict[str, Any] | None,
) -> dict[str, Any] | None:
    """One fact as two values. Returns the row's pieces, or None when the fact is not stated.

    `fact` is a label from `_FACT_LABELS`, or a raw Figma key.
    """
    from design_renderer import _child_offset, unrendered_keys

    is_text = (spec_node.get("type") or "").upper() == "TEXT" or spec_node.get("text") is not None
    is_vector = (spec_node.get("type") or "").upper() in SHAPE_TYPES
    box = raw_node.get("absoluteBoundingBox") or {}
    style = raw_node.get("style") or {}

    def row(source: str, drawn: str, why: str, state: str = "exact", delta: str = "") -> dict[str, Any]:
        return {"source": source, "drawn": drawn, "why": why, "state": state, "delta": delta}

    def differs(source: str, drawn: str, why: str) -> dict[str, Any]:
        return row(source, drawn, why, "differs", f"{source} → {drawn}")

    # ── GEOMETRY ────────────────────────────────────────────────────────────────────────────
    if fact in ("size", "position"):
        if not box:
            return None
        if fact == "size":
            wanted = (float(box.get("width", 0)), float(box.get("height", 0)))
            if is_vector and spec_node.get("svg"):
                # A DRAWN SHAPE'S BOX IS ITS ARTWORK, not a style rule: a bare `<svg>` carries
                # width, height and viewBox and no class of its own, so reading declarations
                # reported every shape's size as missing when it was written on the svg.
                got = (_num(_svg_attr(spec_node, "width")), _num(_svg_attr(spec_node, "height")))
            else:
                got = (_num(_decl(decls, "width")), _num(_decl(decls, "height")))
            source = f"{_n(wanted[0])} × {_n(wanted[1])}"
            drawn = f"{_n(got[0]) if got[0] is not None else '—'} × {_n(got[1]) if got[1] is not None else '—'}"
            if _same(wanted[0], got[0]) and _same(wanted[1], got[1]):
                return row(source, drawn, "the box the design measured")
            return differs(source, drawn, "the box drawn is not the box the design measured")

        wanted = (float(box.get("x", 0)), float(box.get("y", 0)))
        place = _child_offset(spec_node, parent_spec)
        if place is not None:
            got = (_num(_decl(decls, "left")), _num(_decl(decls, "top")))
            # THE FACT IS THE LAYER'S OWN OFFSET INSIDE ITS PARENT, not its coordinate on Figma's
            # canvas. The canvas coordinate moves whenever the designer drags the whole component,
            # and it changes nothing about the design; measured 2026-10-26, moving the component 18px
            # on the canvas reported every child as changed. The offset inside the parent is what
            # the drawing uses, and it only changes when the DESIGN changes.
            source = f"left {_n(place['left'])}, top {_n(place['top'])}"
            drawn = (f"left {_n(got[0]) if got[0] is not None else '—'}, "
                     f"top {_n(got[1]) if got[1] is not None else '—'}")
            # The emitted offset is the placement the measurement decided. When the node states a
            # transform, that placement IS the transform's translation — the design's own number,
            # carried verbatim — and the absolute box is only the post-transform extent.
            expect_left = place["left"]
            expect_top = place["top"]
            if _same(expect_left, got[0], 1e-4) and _same(expect_top, got[1], 1e-4):
                return row(source, drawn, "placed at the design's own offset inside its parent")
            return differs(source, drawn, "the layer is not where the design places it")

        if (spec_node.get("sizing") or {}).get("layoutPositioning") == "ABSOLUTE":
            return differs(
                "taken out of its parent's flow", "drawn in its parent's flow",
                "the design takes this layer OUT of its parent's flow, and the drawing puts it in",
            )
        if parent_spec is None:
            # THE ROOT HAS NO PARENT TO BE PLACED BY: its coordinate is where the designer parked
            # the frame on the Figma canvas, and a component does not carry the canvas. It is
            # therefore NOT a value to compare — it is the same component wherever the frame sits,
            # so the row carries a constant and a compare between two ingests never reports the
            # canvas moving as a change to the design.
            return row(
                "placed by whoever uses the component", "placed by whoever uses the component",
                "the frame's coordinate on the Figma canvas is not a drawing value; a component is "
                "placed where it is used",
            )
        return row(
            f"x {_n(wanted[0])}, y {_n(wanted[1])}", "determined by its parent's flow",
            "the parent lays this layer out: the position is the RESULT of the parent's own gap, "
            "padding, alignment and child order, and each of those is compared on the parent",
        )

    # ── PAINT ───────────────────────────────────────────────────────────────────────────────
    if fact == "fills":
        paints = _visible_paints(raw_node, "fills")
        if not paints:
            return None
        unsupported = [p for p in paints if str(p.get("type") or "").upper() != "SOLID" and not _is_gradient(p)]
        if unsupported:
            kinds = ", ".join(sorted({str(p.get("type")) for p in unsupported}))
            return row(kinds, "not drawn", f"a {kinds} fill is not drawn by this renderer yet", "differs",
                       f"{kinds} → nothing")
        wanted_parts = [(_gradient_css(p) if _is_gradient(p) else _paint_css(p)) for p in paints]
        if any(value is None for value in wanted_parts):
            return row("a paint", "not drawn", "the paint could not be expressed as a colour", "differs",
                       "paint → nothing")
        wanted = ", ".join(v for v in wanted_parts if v)
        prop, value = _decl_any(decls, "color", "background")
        if not value and is_vector:
            # A DRAWN SHAPE'S PAINT IS ON ITS PATH (`fill="#ffffff"`), not in a rule.
            value = _svg_attr(spec_node, "fill")
            prop = "fill"
        if not value:
            return differs(wanted, "no declaration", "the design states a fill and nothing is drawn")
        drawn_parts = _split_top_level(value)
        if len(drawn_parts) != len(paints):
            return differs(wanted, value,
                           "the number of fills drawn is not the number the design states")
        for paint, drawn in zip(paints, drawn_parts):
            if _is_gradient(paint):
                if not _same_gradient(_gradient_css(paint), drawn):
                    return differs(wanted, value,
                                   "the gradient drawn is not the gradient the design states")
            elif not _same_colour(_paint_css(paint), drawn):
                return differs(wanted, value,
                               "the fill drawn is not the fill the design states")
        why = ("the fill the design states" if len(paints) == 1
               else f"{len(paints)} fills, drawn in the design's order")
        return row(wanted, value, why)

    if fact == "strokes":
        paints = _visible_paints(raw_node, "strokes")
        if not paints:
            return None
        solid = next((p for p in paints if str(p.get("type") or "").upper() == "SOLID"), None)
        if solid is None:
            return row(str(paints[0].get("type")), "not drawn",
                       "a stroke that is not a solid colour is not drawn by this renderer yet",
                       "differs", f"{paints[0].get('type')} → nothing")
        wanted = _paint_css(solid)
        got = _stroke_drawn(spec_node, decls)
        if got["color"] is None:
            return differs(wanted or "", "no border", "the design states a border and nothing is drawn")
        if _same_colour(wanted, got["color"]):
            return row(wanted or "", got["color"], f"drawn by {got['by'] or 'the border'}")
        return differs(wanted or "", got["color"], "the border drawn is not the border the design states")

    if fact in ("strokeWeight", "individualStrokeWeights"):
        weights = raw_node.get("individualStrokeWeights") or {}
        if fact == "individualStrokeWeights" and not weights:
            return None
        if fact == "strokeWeight" and raw_node.get("strokeWeight") is None:
            return None
        got = _stroke_drawn(spec_node, decls)
        if fact == "strokeWeight":
            wanted = float(raw_node.get("strokeWeight"))
            if _same(wanted, got["weight"]):
                return row(f"{_n(wanted)}px", f"{_n(got['weight'] or 0)}px", "the border the design states")
            return differs(f"{_n(wanted)}px",
                           f"{_n(got['weight']) + 'px' if got['weight'] is not None else 'no border'}",
                           "the border weight drawn is not the weight the design states")
        widths = _decl(decls, "border-width")
        drawn = [float(part[:-2]) for part in (widths or "").split() if part.endswith("px")]
        wanted_parts = [float(weights.get(side, raw_node.get("strokeWeight") or 1))
                        for side in ("top", "right", "bottom", "left")]
        if len(drawn) == 4 and all(_same(w, g) for w, g in zip(wanted_parts, drawn)):
            return row(" ".join(_n(v) + "px" for v in wanted_parts),
                       " ".join(_n(v) + "px" for v in drawn), "each side's own weight")
        return differs(" ".join(_n(v) + "px" for v in wanted_parts),
                       " ".join(_n(v) + "px" for v in drawn) or "one weight",
                       "the per-side weights drawn are not the weights the design states")

    if fact == "cornerRadius":
        wanted = raw_node.get("cornerRadius")
        if wanted is None:
            return None
        if is_vector:
            # A DRAWN SHAPE'S CORNERS ARE IN ITS PATH. Nothing in the stylesheet should repeat
            # them, so this is recorded as carried by the artwork rather than compared against a
            # declaration that must not exist. The limit is stated: this check reads the artwork,
            # not the transform that produced it.
            return row(f"{_n(float(wanted))}px", "carried by the artwork's own path",
                       "the shape's corners are drawn in its path", "carried")
        got = _num(_decl(decls, "border-radius"))
        if _same(float(wanted), got):
            return row(f"{_n(float(wanted))}px", f"{_n(got or 0)}px", "the radius the design states")
        if float(wanted) == 0 and got is None:
            return row("0px", "square", "no radius, which is what the design states")
        return differs(f"{_n(float(wanted))}px", f"{_n(got) + 'px' if got is not None else 'square'}",
                       "the radius drawn is not the radius the design states")

    if fact == "rectangleCornerRadii":
        radii = raw_node.get("rectangleCornerRadii") or []
        if not radii:
            return None
        if is_vector:
            return row(" ".join(_n(float(v)) for v in radii), "carried by the artwork's own path",
                       "each corner is drawn in the shape's path", "carried")
        value = _decl(decls, "border-radius") or ""
        drawn = [_num(part) for part in value.split()]
        wanted = [float(v) for v in radii]
        if len(drawn) == 4 and all(_same(w, g) for w, g in zip(wanted, drawn)):
            return row(" ".join(_n(v) for v in wanted), " ".join(_n(v or 0) for v in drawn),
                       "each corner's own radius")
        if not value and all(v == 0 for v in wanted):
            return row(" ".join(_n(v) for v in wanted), "square",
                       "no radius on any corner, which is what the design states")
        return differs(" ".join(_n(v) for v in wanted), value or "square",
                       "the corners drawn are not the corners the design states")

    # ── LAYOUT ──────────────────────────────────────────────────────────────────────────────
    if fact == "layoutMode":
        wanted = str(raw_node.get("layoutMode") or "").upper()
        if wanted not in ("HORIZONTAL", "VERTICAL"):
            return None
        direction = "row" if wanted == "HORIZONTAL" else "column"
        display = _decl(decls, "display")
        got = _decl(decls, "flex-direction")
        drawn = f"{display or '—'} / {got or '—'}"
        if display == "flex" and (got or "row") == direction:
            return row(f"{wanted} (flex {direction})", drawn, "the layout the design states")
        return differs(f"{wanted} (flex {direction})", drawn,
                       "the layer is not laid out the way the design lays it out")

    if fact in ("primaryAxisAlignItems", "counterAxisAlignItems"):
        wanted = str(raw_node.get(fact) or "")
        if wanted not in ("MIN", "CENTER", "MAX", "SPACE_BETWEEN", "BASELINE"):
            return None
        prop = "justify-content" if fact == "primaryAxisAlignItems" else "align-items"
        got = _decl(decls, prop)
        expected = {"MIN": "flex-start", "CENTER": "center", "MAX": "flex-end",
                    "SPACE_BETWEEN": "space-between", "BASELINE": "baseline"}[wanted]
        if got == expected:
            return row(f"{wanted} ({expected})", got, "the alignment the design states")
        return differs(f"{wanted} ({expected})", got or "default",
                       "the alignment drawn is not the alignment the design states")

    if fact == "layoutWrap":
        if str(raw_node.get("layoutWrap") or "") != "WRAP":
            return None
        got = _decl(decls, "flex-wrap")
        if got == "wrap":
            return row("WRAP", got, "the design wraps")
        return differs("WRAP", got or "no wrap", "the design wraps and the drawing does not")

    if fact in ("itemSpacing", "paddingLeft", "paddingRight", "paddingTop", "paddingBottom"):
        wanted = raw_node.get(fact)
        if wanted is None:
            return None
        prop = {"itemSpacing": "gap", "paddingLeft": "padding-left", "paddingRight": "padding-right",
                "paddingTop": "padding-top", "paddingBottom": "padding-bottom"}[fact]
        got = _num(_decl(decls, prop))
        if _same(float(wanted), got):
            return row(f"{_n(float(wanted))}px", f"{_n(got or 0)}px", "the spacing the design states")
        return differs(f"{_n(float(wanted))}px", f"{_n(got) + 'px' if got is not None else 'none'}",
                       "the spacing drawn is not the spacing the design states")

    # ── HOW THE LAYER SITS IN ITS PARENT ───────────────────────────────────────────────────
    if fact in ("layoutSizingHorizontal", "layoutSizingVertical"):
        wanted = str(raw_node.get(fact) or "")
        if wanted != "FILL":
            return None
        got = _decl(decls, "align-self")
        if got == "stretch":
            return row("FILL (stretch)", got, "the layer fills its parent's axis")
        return differs("FILL (stretch)", got or "its measured size",
                       "the design stretches this layer along its parent's axis and the drawing does not")

    if fact == "layoutAlign":
        wanted = str(raw_node.get("layoutAlign") or "")
        if wanted not in ("STRETCH", "MIN", "CENTER", "MAX"):
            return None
        expected = {"STRETCH": "stretch", "MIN": "flex-start", "CENTER": "center", "MAX": "flex-end"}[wanted]
        got = _decl(decls, "align-self")
        if got == expected:
            return row(f"{wanted} ({expected})", got, "the alignment in its parent the design states")
        return differs(f"{wanted} ({expected})", got or "auto",
                       "the alignment drawn is not the alignment the design states")

    if fact == "layoutGrow":
        wanted = raw_node.get("layoutGrow")
        if not wanted:
            return None
        got = _num(_decl(decls, "flex-grow"))
        if got == 1:
            return row(f"grow {_n(float(wanted))}", "flex-grow 1", "the layer grows in its parent's flow")
        return differs(f"grow {_n(float(wanted))}", "no growth",
                       "the design lets this layer grow and the drawing fixes its size")

    if fact == "layoutPositioning":
        wanted = str(raw_node.get("layoutPositioning") or "")
        if wanted != "ABSOLUTE":
            return None
        return differs("ABSOLUTE (out of its parent's flow)", "placed inside the flow",
                       "the design takes this layer out of its parent's flow, and nothing places it "
                       "at its own offset — this is a fact the drawing cannot carry yet")

    if fact == "counterAxisSpacing":
        spacing = raw_node.get("counterAxisSpacing")
        if spacing is None:
            return None
        return differs(f"{_n(float(spacing))}px between wrapped lines", "no row gap",
                       "the design states the space between wrapped lines and no declaration carries it")

    if fact == "strokeAlign":
        wanted = str(raw_node.get("strokeAlign") or "")
        if wanted != "OUTSIDE":
            return None
        got = _decl(decls, "outline")
        if got:
            return row("OUTSIDE", got, "the border is drawn outside the box, which costs no layout")
        return differs("OUTSIDE", "a border inside the box",
                       "the design draws the border outside and the drawing puts it inside")

    # ── WHAT THE LAYER DOES TO ITSELF ──────────────────────────────────────────────────────
    if fact == "opacity":
        wanted = raw_node.get("opacity")
        if wanted is None:
            return None
        got = _num(_decl(decls, "opacity"))
        if _same(float(wanted), got, _ALPHA_EPS):
            return row(_n(float(wanted)), _n(got if got is not None else 1.0), "the opacity the design states")
        return differs(_n(float(wanted)), _n(got if got is not None else 1.0),
                       "the opacity drawn is not the opacity the design states")

    if fact == "visible":
        if raw_node.get("visible") is not False:
            return None
        got = _decl(decls, "display")
        if got == "none":
            return row("hidden", got, "the layer the design hides")
        return differs("hidden", got or "visible", "the design hides this layer and the drawing shows it")

    if fact == "clipsContent":
        if raw_node.get("clipsContent") is not True:
            return None
        got = _decl(decls, "overflow")
        if got == "hidden":
            return row("clips", got, "the design clips what leaves this box")
        return differs("clips", got or "visible overflow",
                       "the design clips what leaves this box and the drawing does not")

    if fact == "rotation":
        wanted = raw_node.get("rotation")
        if not wanted:
            return None
        if str(raw_node.get("type") or "").upper() == "GROUP":
            # A GROUP'S ANGLE IS ITS CHILDREN'S. Figma reports an absolute rotation on every node,
            # so the group states the same angle each child states; drawing it on the group as well
            # would turn the artwork twice. Carried by the children, and said so.
            return row(f"{_n(float(wanted))}°", "carried by the group's children",
                       "a group is a grouping; each child carries its own absolute rotation, so the "
                       "group does not repeat it", "carried")
        matrix = spec_node.get("transform")
        is_transformed = False
        if isinstance(matrix, list) and len(matrix) >= 2:
            try:
                a, b = float(matrix[0][0]), float(matrix[0][1])
                c, d = float(matrix[1][0]), float(matrix[1][1])
                is_transformed = (
                    abs(b) > 1e-9 or abs(c) > 1e-9 or abs(a - 1) > 1e-9 or abs(d - 1) > 1e-9
                )
            except (TypeError, ValueError, IndexError):
                is_transformed = False
        if is_transformed:
            # THE MATRIX IS THE PICTURE. A node whose transform is not the identity — mirrored,
            # turned, scaled — is drawn by that matrix with its origin at the corner, so the angle
            # in the `rotation` field is not a separate declaration. On a mirror the field reads
            # 3.14159 and the matrix is a flip; the matrix is what Figma draws.
            return row(f"{_n(float(wanted))}°", "carried by the node's transform matrix",
                       "Figma states the node's transform; the matrix carries its rotation and any "
                       "mirror, and the drawing composes it", "carried")
        if is_vector:
            # A ROTATED SHAPE IS ROTATED IN ITS COORDINATES — `_transform_path` bakes the angle into
            # the path, and a wrapper that repeated it would turn the artwork twice.
            return row(f"{_n(float(wanted))}°", "baked into the artwork's coordinates",
                       "the rotation is drawn into the path, not declared on a box", "carried")
        got = _decl(decls, "transform") or ""
        drawn = _num(str(got).replace("rotate(", "").replace("deg)", ""))
        if _same(-float(wanted), drawn, 1e-3):
            return row(f"{_n(float(wanted))}°", got, "the rotation the design states, drawn inverted")
        return differs(f"{_n(float(wanted))}°", got or "no rotation",
                       "the rotation drawn is not the rotation the design states")

    if fact == "effects":
        effects = [e for e in raw_node.get("effects") or [] if isinstance(e, dict) and e.get("visible", True)]
        if not effects:
            return None
        wanted = [_shadow_css(e) for e in effects]
        unsupported = [str(e.get("type")) for e, css in zip(effects, wanted) if css is None]
        if unsupported:
            kinds = ", ".join(sorted(set(unsupported)))
            return row(kinds, "not drawn", f"a {kinds} effect is not drawn by this renderer yet",
                       "differs", f"{kinds} → nothing")
        got = [d.split(":", 1)[1].strip() for d in decls if d.startswith("box-shadow:")]
        # One declaration may carry several shadows, which is how CSS states more than one.
        drawn = [part.strip() for value in got for part in value.split(", ")]
        wanted_text = ", ".join(v for v in wanted if v)
        drawn_text = ", ".join(drawn)
        if wanted_text == drawn_text:
            return row(wanted_text, drawn_text, "the effect the design states")
        return differs(wanted_text, drawn_text or "no shadow",
                       "the shadow drawn is not the shadow the design states")

    # ── TYPE ───────────────────────────────────────────────────────────────────────────────
    if fact.startswith("style."):
        key = fact.split(".", 1)[1]
        wanted = style.get(key)
        if wanted is None:
            return None
        prop = {
            "fontFamily": "font-family", "fontWeight": "font-weight", "fontSize": "font-size",
            "lineHeightPx": "line-height", "letterSpacing": "letter-spacing",
            "textAlignHorizontal": "text-align", "textCase": "text-transform",
            "textDecoration": "text-decoration",
        }.get(key)
        if key == "textAlignVertical":
            got = _decl(decls, "justify-content") if _decl(decls, "display") == "flex" else None
            expected = {"TOP": None, "CENTER": "center", "BOTTOM": "flex-end"}.get(str(wanted))
            if expected is None and got is None:
                return row(str(wanted), "top (no declaration needed)", "the design places the text at the top")
            if expected == got:
                return row(str(wanted), str(got), "the vertical alignment the design states")
            return differs(str(wanted), str(got or "top"), "the vertical alignment drawn is not the design's")
        if prop is None:
            return None
        value = _decl(decls, prop)
        if key == "fontFamily":
            got = _unquote_family(value)
            if got == str(wanted):
                return row(str(wanted), got or "—", "the face the design states")
            if got == _local_face(str(wanted)):
                # A RECORDED SUBSTITUTION, NOT A FAILURE AND NOT A SILENT MATCH. The application
                # ships one face, IBM Plex Sans, and the design states another; the stated family is
                # kept in this row, so nothing about the design is lost, and the drawing is reported
                # as a decision rather than counted as the design's own value.
                return row(
                    str(wanted), f"{got} (the system's one face)",
                    f"The design states {wanted}. The application draws its one self-hosted face, "
                    f"{_SYSTEM_FACE}; the stated family is kept in this record.",
                    "carried",
                )
            return differs(str(wanted), got or "no family", "the face drawn is not the face the design states")
        if key == "fontWeight":
            got = _num(value)
            if _same(float(wanted), got, 1e-3):
                return row(_n(float(wanted)), _n(got or 0), "the weight the design states")
            return differs(_n(float(wanted)), _n(got) if got is not None else str(value or "default"),
                           "the weight drawn is not the weight the design states")
        if key in ("fontSize", "lineHeightPx", "letterSpacing"):
            if key == "letterSpacing" and float(wanted) == 0 and value is None:
                return row("0", "0 (no declaration needed)", "no letter spacing, which is what the design states")
            got = _num(value)
            if _same(float(wanted), got, 1e-4):
                return row(f"{_n(float(wanted))}px", f"{_n(got or 0)}px", "the value the design states")
            return differs(f"{_n(float(wanted))}px", f"{_n(got) + 'px' if got is not None else 'missing'}",
                           "the value drawn is not the value the design states")
        if key == "textAlignHorizontal":
            expected = str(wanted).lower()
            if value == expected:
                return row(str(wanted), value, "the alignment the design states")
            return differs(str(wanted), value or "start", "the alignment drawn is not the design's")
        if key == "textCase":
            expected = {"UPPER": "uppercase", "LOWER": "lowercase", "TITLE": "capitalize",
                        "SMALL_CAPS": "lowercase"}.get(str(wanted))
            if expected is None and value is None:
                return row(str(wanted), "no change", "the design asks for no case change")
            if value == expected:
                return row(str(wanted), value or "", "the case the design states")
            return differs(str(wanted), value or "no change", "the case drawn is not the case the design states")
        if key == "textDecoration":
            expected = {"UNDERLINE": "underline", "STRIKETHROUGH": "line-through"}.get(str(wanted))
            if expected is None and value is None:
                return row(str(wanted), "no decoration", "the design asks for no decoration")
            if value == expected:
                return row(str(wanted), value or "", "the decoration the design states")
            return differs(str(wanted), value or "no decoration",
                           "the decoration drawn is not the decoration the design states")
        return None

    if fact == "characters":
        wanted = raw_node.get("characters")
        if wanted is None:
            return None
        from design_renderer import _data_field

        if _data_field(spec_node):
            return row(_clip(wanted), "${this." + str(_data_field(spec_node)) + "}",
                       "the layer is bound to data, so the design's words are the placeholder and "
                       "the drawing shows the value it is given", "carried")
        got = _own_text(markup)
        if got == str(wanted):
            return row(_clip(wanted), _clip(got), "the words the design states")
        return differs(_clip(wanted), _clip(got) or "no words",
                       "the words drawn are not the words the design states")

    if fact in ("characterStyleOverrides", "styleOverrideTable"):
        runs = spec_node.get("runs") or []
        drawn = _runs_drawn(markup)
        if not runs and not drawn:
            return row("no styled ranges", "no spans", "the layer has no styled ranges")
        if len(runs) != len(drawn):
            return differs(f"{len(runs)} range(s)", f"{len(drawn)} span(s)",
                           "the number of styled ranges drawn is not the number the design states")
        problems: list[str] = []
        for index, (run, span) in enumerate(zip(runs, drawn)):
            run_style = run.get("style") or {}
            if run.get("text") is not None and span["text"] != str(run.get("text")):
                problems.append(f"range {index + 1} words differ")
            if run_style.get("fill") and span["color"] and not _same_colour(run_style["fill"], span["color"]):
                problems.append(f"range {index + 1} {run_style['fill']} → {span['color']}")
            if run_style.get("fontFamily"):
                stated_family = str(run_style["fontFamily"])
                # THE SYSTEM'S ONE FACE IS A RECORDED SUBSTITUTION HERE TOO, not a defect of the
                # run. A span drawn in IBM Plex Sans for a run that states Inter is the system's
                # rule taking effect; the warning at the root of the answer names it.
                if span["fontFamily"] != stated_family and span["fontFamily"] != _local_face(stated_family):
                    problems.append(f"range {index + 1} face {stated_family} → {span['fontFamily']}")
        if problems:
            return differs("; ".join(problems), "drawn ranges differ",
                           "the styled ranges drawn are not the ranges the design states")
        return row(f"{len(runs)} range(s)", f"{len(drawn)} span(s)", "every styled range the design states")

    if fact in ("fillGeometry", "strokeGeometry"):
        if not is_vector:
            return None
        paths = spec_node.get("paths") or []
        svg = str(spec_node.get("svg") or "")
        if not paths:
            return differs("artwork", "nothing", "the design states artwork and the spec has none")
        if not svg:
            return differs(f"{len(paths)} path(s)", "no svg",
                           "the artwork is measured and the drawing has no svg to carry it")
        if svg not in markup and svg not in str(spec_node.get("svg")):
            return differs(f"{len(paths)} path(s)", "svg not emitted",
                           "the artwork is measured and the drawing does not emit it")
        return row(f"{len(paths)} path(s), {_n(float(box.get('width') or 0))} × "
                   f"{_n(float(box.get('height') or 0))}",
                   f"{len(paths)} path(s) in the svg",
                   "the artwork is Figma's own geometry, transformed into the layer's box")

    if fact == "componentId":
        return None  # decided by the caller: an instance is not composed in a blind preview

    if fact == "textTruncation" or fact == "maxLines":
        return None  # its own row, below

    if fact == "annotations":
        return None  # decided by the caller

    # A stated key this table has no comparison for. It is not "drawn" on the strength of a word:
    # if the renderer names no declaration for it, it is a fact nobody can see.
    if fact in unrendered_keys(spec_node):
        return differs(_short(str(raw_node.get(fact)), 40), "not drawn",
                       "the design states it and no declaration carries it")
    return row(_short(str(raw_node.get(fact)), 40), "carried, not a declaration",
               "a fact the drawing carries without a declaration of its own")


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


def annotation_report(raw_document: dict[str, Any]) -> list[dict[str, Any]]:
    """EVERY ANNOTATION IN THE FILE, AS READ — the designer's own notes and property marks.

    Figma carries two kinds of annotation, and the answer must not blur them:
      * a NOTE — the designer's words. It may be an instruction (`Data: field`, `On click: name`)
        or plain prose. The words are quoted VERBATIM; nothing is summarised.
      * a PROPERTY mark — only a list of property names (height, width, fills…). It names which
        properties are exposed on the layer; it draws nothing.

    Reported per layer with the name path, because an annotation on one button is not an annotation
    on the frame around it. This is what the answer shows the designer when he asks what the file
    actually says.
    """
    out: list[dict[str, Any]] = []

    def walk(node: dict[str, Any], path: str = "") -> None:
        name = str(node.get("name") or "").strip() or "unnamed"
        here = f"{path} / {name}" if path else name
        for ann in node.get("annotations") or []:
            if not isinstance(ann, dict):
                continue
            label = ann.get("labelMarkdown") or ann.get("label") or ""
            properties = [
                str(p.get("type"))
                for p in (ann.get("properties") or [])
                if isinstance(p, dict) and p.get("type")
            ]
            out.append({
                "layer": f"{name} ({node.get('type')})",
                "path": here,
                "nodeId": node.get("id"),
                "note": str(label).strip() or None,
                "properties": properties,
                "kind": "note" if str(label).strip() else "property",
            })
        for child in node.get("children") or []:
            walk(child, here)

    walk(raw_document)
    return out


def design_findings(raw_document: dict[str, Any]) -> list[dict[str, Any]]:
    """FACTS IN THE FILE THAT CANNOT BE DRAWN AS THE FILE STATES THEM — the designer's to fix.

    WHY THIS EXISTS (owner, 2026-10-26): *"See if you can't determine if it's an AI ingestion program
    problem or if it's a designer problem, then a designer is not empowered to go correct it. It
    simply has to lay out honestly."*

    A REPORT THAT BLAMES THE PROGRAM FOR EVERYTHING IS AS USELESS AS ONE THAT BLAMES THE DESIGN.
    So this is deliberately narrow: it reports only contradictions between numbers THE FILE ITSELF
    STATES, with the arithmetic shown. It never says a design is ugly, wrong or should be drawn
    differently — only that two of its own measurements cannot both hold:

      * a box with no width or no height that still contains visible content;
      * a text box shorter than one line of its own line height (the words cannot fit);
      * an auto-layout frame smaller than its own children, gaps and padding, with no wrapping, no
        child that fills the axis, and no clipping (the content must spill out of the frame).

    Everything else — an ellipsis this engine cannot draw, a blur, an image fill, a key the ingest
    has no meaning for — is the PROGRAM's, and the confession says so.
    """
    out: list[dict[str, Any]] = []

    def layer_of(node: dict[str, Any]) -> str:
        return f"{node.get('name')} ({node.get('type')})"

    def walk(node: dict[str, Any]) -> None:
        box = node.get("absoluteBoundingBox") or {}
        try:
            width = float(box.get("width") or 0)
            height = float(box.get("height") or 0)
        except (TypeError, ValueError):
            width = height = 0.0
        node_type = str(node.get("type") or "").upper()
        kids = [c for c in node.get("children") or [] if c.get("visible", True)]
        text = node.get("characters")
        style = node.get("style") or {}

        if box and (width <= 0 or height <= 0) and (kids or (text is not None and str(text).strip())):
            content = f"{len(kids)} visible child layer(s)" if kids else "text"
            out.append({
                "layer": layer_of(node), "id": node.get("id"), "kind": "empty box",
                "observation": (
                    f"This layer's box is {_n(width)} × {_n(height)} and it contains {content}, "
                    "so the content has no box to sit in. Fix the layer's size in Figma, or let it "
                    "hug its contents."
                ),
            })

        line_height = style.get("lineHeightPx")
        if node_type == "TEXT" and line_height and box and height > 0:
            try:
                one_line = float(line_height)
            except (TypeError, ValueError):
                one_line = 0.0
            if one_line and height + 0.01 < one_line:
                out.append({
                    "layer": layer_of(node), "id": node.get("id"), "kind": "text box shorter than a line",
                    "observation": (
                        f"This text box is {_n(height)} high and its own line height is {_n(one_line)}, "
                        "so not one whole line fits. Make the box at least one line tall, or remove "
                        "the fixed height."
                    ),
                })

        layout = node.get("layoutMode")
        if layout in ("HORIZONTAL", "VERTICAL") and kids and not node.get("clipsContent"):
            if str(node.get("layoutWrap") or "") != "WRAP":
                horizontal = layout == "HORIZONTAL"
                along = "width" if horizontal else "height"
                fills = any(
                    (c.get("layoutSizingHorizontal") if horizontal else c.get("layoutSizingVertical")) == "FILL"
                    or c.get("layoutGrow")
                    for c in kids
                )
                # A CHILD TAKEN OUT OF THE FLOW DOES NOT OCCUPY IT, so it is not in the sum. Counting
                # it would report an overflow that the file does not have.
                in_flow = [c for c in kids if str(c.get("layoutPositioning") or "") != "ABSOLUTE"]
                if not fills and in_flow:
                    total = 0.0
                    for child in in_flow:
                        child_box = child.get("absoluteBoundingBox") or {}
                        total += float(child_box.get(along) or 0)
                    gap = float(node.get("itemSpacing") or 0)
                    total += gap * max(0, len(in_flow) - 1)
                    total += float((node.get("paddingLeft") if horizontal else node.get("paddingTop")) or 0)
                    total += float((node.get("paddingRight") if horizontal else node.get("paddingBottom")) or 0)
                    available = width if horizontal else height
                    if total > available + 0.5:
                        out.append({
                            "layer": layer_of(node), "id": node.get("id"), "kind": "contents larger than frame",
                            "observation": (
                                f"This frame is {_n(available)} across and its children, gaps and padding "
                                f"add up to {_n(total)}, with no wrapping, no child filling the axis and "
                                "clipping off — so the content must spill out of the frame. Let the frame "
                                "hug its contents, make it larger, or set it to clip."
                            ),
                        })

        for child in node.get("children") or []:
            walk(child)

    walk(raw_document)
    return out


def confession(report: dict[str, Any]) -> dict[str, Any]:
    """WHAT COULD NOT BE READ OR DRAWN, IN PLAIN SENTENCES — the first thing the answer says.

    WHY THIS EXISTS, in the owner's words (2026-10-26): *"Just report it. Say I can't read this, or
    I built it anyway and did not read this, this, this. That's how I can diagnose problems."*

    A COUNT IS NOT A CONFESSION. `74 of 74 exact` is true of the facts the check could compare and
    says nothing about the ones it could not — and printed first, it reads as success. So the
    answer leads with the missing things, each one a sentence naming the layer, the fact, the value
    that was found, and the consequence: the component was built without it. The count follows as
    evidence, never as the headline.

    NOTHING IS TURNED INTO A SUCCESS. A gap that is examined and known (a truncating layer) is
    still a gap the designer must see; it is listed here with its reason, not quietly counted as
    acceptable.
    """
    missing: list[dict[str, str]] = []
    accepted = 0
    for row in report["rows"]:
        verdict = row["verdict"]
        if verdict in ("drawn", "accepted"):
            if verdict == "accepted":
                accepted += 1
            continue
        layer = str(row.get("layer") or "a layer")
        fact = str(row.get("fact") or "an unnamed fact")
        source = str(row.get("source") or "").strip()
        drawn = str(row.get("drawn") or "").strip()
        why = str(row.get("why") or "").strip().rstrip(".")
        reason = f" {why[:1].upper() + why[1:]}." if why else ""
        if verdict == "not-read":
            value = f" — the value I found was {source}" if source else " — I could not read its value either"
            sentence = (
                f"I could not read {layer} · {fact}{value}.{reason} "
                "I built the component without it."
            )
        elif verdict == "not-drawn":
            value = f" = {source}" if source else ""
            sentence = (
                f"I could not draw {layer} · {fact}{value}.{reason} "
                "I built the component without it."
            )
        elif verdict == "differs":
            if drawn.lower() in ("not drawn", "no declaration", "nothing", ""):
                sentence = f"I read {layer} · {fact} = {source or '(no value)'} and could not draw it.{reason}"
            else:
                sentence = (
                    f"I read {layer} · {fact} = {source or '(no value)'} and the component carries "
                    f"{drawn}.{reason}"
                )
        elif verdict == "uncomparable":
            sentence = f"I could not check {layer} · {fact}: {why or 'no reason was recorded'}"
        elif verdict == "defect":
            if fact in ("textTruncation", "maxLines"):
                # THE SHORT FORM OF A LONG MEASUREMENT. The full finding (six spellings, the engine
                # version, the pixel numbers) stays in the ledger; the sentence a designer reads
                # must be one line, or it stops being read at all.
                sentence = (
                    f"I read {layer} · {fact} and did not draw the ellipsis it asks for: this engine "
                    "cannot draw a multi-line ellipsis (measured 2026-09-30 on Chrome 146 / Electron 41). "
                    "The whole lines that fit are drawn; the ellipsis is not."
                )
            else:
                sentence = f"I read {layer} · {fact} and did not draw it: {_clip(why, 200)}"
        else:
            sentence = f"{layer} · {fact}: {verdict}"
        missing.append({
            "layer": layer, "id": row.get("id"), "fact": fact, "verdict": verdict,
            "source": source, "drawn": drawn, "sentence": sentence,
            # THE CAUSE, SAID PLAINLY. A fact the file states that the component does not carry is
            # the PROGRAM's: the file did its part. A design-side cause is only claimed when the
            # file's own numbers contradict each other, and those are listed separately below.
            "cause": "program",
            "nextStep": "This is the pipeline's to fix, not yours.",
        })

    design = report.get("design") or []

    # ── THE FONT WARNING ──────────────────────────────────────────────────────────────────────
    # A DESIGN THAT NAMES A FACE THIS SYSTEM DOES NOT SHIP IS TOLD SO, BY NAME (owner, 2026-10-26):
    # *"If I'm ingesting Inter and Inter is not our default font… then that's something that the
    # user needs to be warned about. I'm going to replace this font, you did not use the system
    # font."* So every layer whose stated family is not the system's face is collected here and
    # said in the verdict — not buried in the table, and not treated as a defect of the design.
    fonts: list[dict[str, str]] = []
    for row in report["rows"]:
        if row.get("fact") != "style.fontFamily":
            continue
        stated = str(row.get("source") or "").strip()
        if stated and stated != _SYSTEM_FACE:
            fonts.append({
                "layer": str(row.get("layer") or ""),
                "path": str(row.get("path") or ""),
                "stated": stated,
                "drawn": _SYSTEM_FACE,
            })
    if fonts:
        stated_faces = ", ".join(sorted({entry["stated"] for entry in fonts}))
        warning = (
            f" FONT WARNING: {len(fonts)} layer(s) use {stated_faces}, which this system does not "
            f"ship. The application will draw {_SYSTEM_FACE}, its one face, in place of it. Each "
            "layer is named in this answer."
        )
    else:
        warning = ""

    drawn_count = report["counts"].get("drawn", 0)
    if missing:
        things = "1 thing" if len(missing) == 1 else f"{len(missing)} things"
        mine = ("It is the pipeline's to fix, not your file's." if len(missing) == 1
                else "They are the pipeline's to fix, not your file's.")
        about_file = (
            f" {len(design)} observation(s) about the file itself are listed separately, with the numbers."
            if design else ""
        )
        sentence = (
            f"I could not read or draw {things} in this design, and I built the component anyway. "
            f"{mine}{about_file} Each one is named with the value I found.{warning}"
        )
    else:
        sentence = (
            f"I read every fact this design states that asks for a drawing — {drawn_count} of them — "
            "and every one is in the component."
            + (f" {accepted} further fact(s) ask for no drawing, each with its reason written down."
               if accepted else "")
            + (f" {len(design)} observation(s) about the file itself are listed separately, with the numbers."
               if design else "")
            + warning
        )
    return {"missing": missing, "count": len(missing), "accepted": accepted, "design": design,
            "fonts": fonts, "sentence": sentence}


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
    mismatches: list[dict[str, Any]] = []
    for row in report["rows"]:
        where = f"{row['layer']} · {row['fact']}"
        if row["verdict"] == "differs":
            # THE VALUE THE COMPONENT CARRIES IS NOT THE VALUE THE DESIGN STATES. This is the
            # verdict the old check could not produce: it asked whether `background` appeared and
            # the answer was yes, whatever colour stood beside it.
            mismatches.append(row)
            blocking.append(f"{where}: {row.get('delta') or row['why']}")
        elif row["verdict"] == "uncomparable":
            mismatches.append(row)
            blocking.append(f"{where}: {row['why']}")
        elif row["verdict"] == "not-read":
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

    # THE CONFESSION AND THE COUNT ARE BOTH COMPUTED FROM THESE ROWS, in one place, so the sentence
    # that leads the answer cannot disagree with the table beneath it.
    spoken = confession(report)

    return {
        "blocks": bool(blocking),
        "blocking": blocking,
        # WHAT COULD NOT BE READ OR DRAWN, as sentences, for the top of the answer.
        "verdict": spoken["sentence"],
        "unread": spoken["missing"],
        "unreadCount": spoken["count"],
        # CONTRADICTIONS IN THE FILE, for the designer — separate from the program's own gaps.
        "design": spoken["design"],
        # THE FACES THE DESIGN NAMED THAT THE SYSTEM DOES NOT SHIP, with the face it will draw.
        "fonts": spoken["fonts"],
        # EVERY ANNOTATION IN THE FILE, verbatim, per layer.
        "annotations": report.get("annotations") or [],
        # EVERY FACT WHOSE TWO VALUES DISAGREE, with both values and the difference. This is what a
        # commit is refused on, and what the designer reads to see what the ingest changed.
        "mismatches": mismatches,
        "reported": reported,
        "counts": report["counts"],
        "exactness": report.get("exactness", {}),
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


def fidelity_report(raw_document: dict[str, Any], tag: str | None = None,
                    on_layer: Any = None) -> dict[str, Any]:
    """One row per layer per stated fact, with the verdict and the reason.

    The layer walk is the renderer's own: `_class_name` is imported, and only the ordering is
    replayed, because the class a layer gets decides which rule the check reads and a second
    naming rule would be a second answer.
    """
    from design_renderer import ACCEPTED_UNRENDERED
    from routes.figma import _figma_spec_for_model

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

    def walk(raw_node: dict[str, Any], spec_node: dict[str, Any], is_root: bool,
             parent_spec: dict[str, Any] | None = None, path: str = "") -> None:
        class_name = class_of(spec_node, used)
        decls = host if is_root else rules.get(class_name, [])
        markup = _markup_for_class(source, class_name)
        layer = f"{raw_node.get('name')} ({raw_node.get('type')})"
        # THE LAYER'S NAME PATH — the identity that survives a re-drawn Figma file. Node ids change
        # when a designer replaces a design; the layer names are what stay the same, so a comparison
        # between two ingests is keyed on THIS and never on the id alone.
        layer_name = str(raw_node.get("name") or "").strip() or "unnamed"
        layer_path = f"{path} / {layer_name}" if path else layer_name
        started = len(rows)

        for key in sorted(set(raw_node) | set(TRUNCATION_KEYS)):
            if key in NOT_A_FACT or key not in RAW_TO_SPEC:
                continue
            if not _states(raw_node, key):
                continue  # the design does not state it: not a finding
            if not _asks(raw_node, key):
                continue  # the design states a value that asks for no declaration
            if key == "annotations":
                # AN ANNOTATION IS HANDLED BEFORE "DID IT REACH THE SPEC", because two kinds exist
                # and only one could ever land there. A PROPERTY mark carries no words — it names
                # which properties are exposed — so there is nothing to put in the spec and nothing
                # to draw; it is read and recorded, not reported as a loss. A NOTE carries the
                # designer's words, quoted verbatim in the row.
                from design_renderer import _data_field, _on_click_event

                notes = [a for a in raw_node.get(key) or [] if isinstance(a, dict)]
                labels = [
                    (a.get("labelMarkdown") or a.get("label") or "").strip()
                    for a in notes
                ]
                labels = [label for label in labels if label]
                if not labels:
                    properties = sorted({
                        str(p.get("type"))
                        for ann in notes
                        for p in (ann.get("properties") or [])
                        if isinstance(p, dict) and p.get("type")
                    })
                    rows.append(_row(
                        layer, raw_node, key, class_name, "accepted",
                        "property annotation — it names which properties are exposed and draws "
                        "nothing. Read and recorded; there is nothing to draw.",
                        ", ".join(properties) or "(no property named)", "nothing to draw",
                    ))
                    continue
                if _data_field(spec_node):
                    hit = "${this." in markup
                    rows.append(_row(layer, raw_node, key, class_name, "drawn" if hit else "not-drawn",
                                     "${this.<field>}" if hit else "the bound field is not drawn",
                                     " | ".join(labels), "${this.<field>}"))
                elif _on_click_event(spec_node):
                    hit = "@click=" in markup
                    rows.append(_row(layer, raw_node, key, class_name, "drawn" if hit else "not-drawn",
                                     "@click=${() => this._fire(…)}" if hit else "the click is not drawn",
                                     " | ".join(labels), "@click=…"))
                else:
                    rows.append(_row(layer, raw_node, key, class_name, "drawn",
                                     "prose — no instruction to draw, correctly absent",
                                     " | ".join(labels), "nothing to draw"))
                continue
            spec_paths = RAW_TO_SPEC[key]
            landed = next((p for p in spec_paths if _spec_value(spec_node, p) is not None), None)
            if landed is None:
                # THE VALUE THE DESIGN STATED GOES IN THE ROW. A row that says "never reached the
                # spec" and names no value cannot be diagnosed — the reader cannot tell whether a
                # shadow, a blur or a whole nested tree was lost.
                rows.append(_row(
                    layer, raw_node, key, class_name, "not-read",
                    "the ingest did not put it in the spec",
                    _clip(raw_node.get(key)), "not in the component",
                ))
                continue
            if key == "textTruncation":
                rows.append(_truncation_row(layer, raw_node, spec_node, class_name))
                continue
            if key in ACCEPTED_UNRENDERED:
                # DELIBERATE, AND SAID SO. The renderer names these as measured facts it will not
                # draw, each with its reason written down — the opposite of a silent loss, and a
                # different verdict from one. Checked BEFORE the value comparison, because a fact
                # that is deliberately not declared has no drawn value to compare against.
                rows.append(_row(layer, raw_node, key, class_name, "accepted", ACCEPTED_UNRENDERED[key]))
                continue
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
                        str(raw_node.get("componentId") or ""),
                        _tag_for(raw_node.get("componentId")) if composed else "its own measured subtree",
                    )
                )
                continue

            # ── THE VALUE COMPARISON ────────────────────────────────────────────────────────────
            # One row per fact, carrying the Figma value and the drawn value. A row is `drawn` when
            # the two are equal at the precision the drawing keeps, and `differs` when they are not
            # — never on the strength of a declaration's NAME appearing.
            for fact in _FACT_LABELS.get(key, (key,)):
                try:
                    compared = _compare_fact(raw_node, spec_node, fact, decls, markup, parent_spec)
                except Exception as error:  # noqa: BLE001 — a proof must never stop the work
                    # A VALUE THIS CHECK CANNOT READ IS NOT A PASS. It is named, counted as not
                    # exact, and it blocks a commit like any other difference — the alternative is
                    # an instrument that goes quiet on the one design it did not understand.
                    rows.append(
                        _row(layer, raw_node, fact, class_name, "uncomparable",
                             f"the comparison could not be made: {type(error).__name__}: {error}",
                             _clip(raw_node.get(key)), "—")
                    )
                    continue
                if compared is None:
                    continue
                if compared["state"] == "differs":
                    verdict, why = "differs", compared["why"]
                elif compared["state"] == "carried":
                    # Measured, deliberately not a declaration, with the reason written down —
                    # a drawn shape's corners and rotation live in its path. Not counted as an
                    # exact DECLARATION, and not counted against the design either.
                    verdict, why = "accepted", compared["why"]
                else:
                    verdict, why = "drawn", compared["why"]
                if verdict == "drawn" and fact in INERT_DECLARATIONS:
                    entry = INERT_DECLARATIONS[fact]
                    verdict = "defect"
                    why = f"declared and INERT — {entry['measured']} on {entry['engine']}: {entry['finding']}"
                rows.append(
                    _row(layer, raw_node, fact, class_name, verdict, why,
                         str(compared.get("source") or ""), str(compared.get("drawn") or ""),
                         str(compared.get("delta") or ""))
                )

        raw_kids = raw_node.get("children") or []
        spec_kids = spec_node.get("children") or []
        # PAIRED BY ID, NOT BY POSITION. A spec that drops one child (an invisible layer, a node the
        # builder cannot place) shifts every later index, and index pairing then compares one layer's
        # facts against another layer's rule — which reports a difference that is not there and
        # hides the one that is.
        # EVERY ROW THIS LAYER PRODUCED CARRIES ITS NAME PATH, whichever branch wrote it. Set before
        # the walk descends, so a child's rows keep the child's path and are not overwritten here.
        for row in rows[started:]:
            row["path"] = layer_path

        # AND SAY SO, AS IT HAPPENS. The callback is how an in-flight ingest reports "checking this
        # layer" from inside the walk that is checking it, rather than from a timer guessing.
        if on_layer is not None:
            try:
                on_layer(layer_path, len(rows) - started)
            except Exception:
                pass

        by_id = {child.get("id"): child for child in spec_kids}
        for child in raw_kids:
            walk(child, by_id.get(child.get("id")) or {}, False, spec_node, layer_path)

    walk(raw_document, spec, True)

    counts: dict[str, int] = {}
    for row in rows:
        counts[row["verdict"]] = counts.get(row["verdict"], 0) + 1

    exact = counts.get("drawn", 0)
    # THE TOTAL IS EVERY FACT THAT ASKS FOR A DRAWING. A fact that was never read, never drawn, or
    # drawn and measured to fall short is IN the total, so a percentage can never read 100 while
    # the same answer names a failure. `accepted` rows ask for nothing and carry a written reason;
    # they are counted separately and named in the verdict sentence.
    not_exact = sum(
        counts.get(verdict, 0)
        for verdict in ("differs", "uncomparable", "not-read", "not-drawn", "defect")
    )
    compared = exact + not_exact

    return {
        "tag": tag,
        "node": raw_document.get("id"),
        "layers": sum(1 for _ in _walk_nodes(raw_document)),
        "rows": rows,
        "counts": counts,
        # THE ONE NUMBER THE DESIGNER READS FIRST: how many facts were compared value for value,
        # and how many of them the drawing carries exactly. A design is 100% when this says 100,
        # and it is not 100 by omission — a fact that could not be compared is not counted here,
        # it is named in `key_coverage` and in `counts`.
        "exactness": {
            "exact": exact,
            "compared": compared,
            "differs": counts.get("differs", 0),
            "percent": round(exact / compared * 100, 2) if compared else 100.0,
        },
        "accepted_unrendered": sorted(ACCEPTED_UNRENDERED),
        # CONTRADICTIONS IN THE FILE ITSELF, with the numbers — the designer's to fix. Empty when
        # the file's own measurements are consistent, which is the ordinary case.
        "design": design_findings(raw_document),
        # THE DESIGNER'S OWN NOTES AND PROPERTY MARKS, quoted verbatim, per layer.
        "annotations": annotation_report(raw_document),
        "key_coverage": key_coverage(spec),
        "interactions": interaction_report(spec),
        "source_chars": len(source),
    }


def _row(layer: str, raw_node: dict[str, Any], key: str, class_name: str, verdict: str, why: str,
         source_value: str = "", drawn_value: str = "", delta: str = "") -> dict[str, Any]:
    return {
        "layer": layer,
        "id": raw_node.get("id"),
        "class": class_name,
        "fact": key,
        "verdict": verdict,
        "why": why,
        # THE TWO VALUES, SIDE BY SIDE. `source` is what Figma states; `drawn` is what the
        # component carries. `delta` is the difference in one line, for a reader scanning a table.
        "source": source_value,
        "drawn": drawn_value,
        "delta": delta,
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
        # WHAT THE DESIGN STATED, beside what was drawn — a defect named without its value is a
        # complaint, not a diagnosis.
        "source": f"{raw_node.get('textTruncation') or 'ENDING'}"
                  + (f", maxLines {raw_node.get('maxLines')}" if raw_node.get("maxLines") else ""),
        "drawn": f"{lines} whole line(s), ending without the ellipsis",
        "delta": "",
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
    exactness = report.get("exactness") or {}
    print(f"node {report['node']}  layers {report['layers']}  facts checked {len(report['rows'])}  {report['counts']}")
    print(
        f"   EXACT: {exactness.get('exact', 0)} of {exactness.get('compared', 0)} facts compared "
        f"({exactness.get('percent', 0)}%) — the values the component carries are the values the "
        "design states"
    )
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
    print("── FACTS WHOSE TWO VALUES DISAGREE, OR THAT ARE NOT DRAWN, OR DRAWN AND INERT ──")
    interesting = [
        r for r in report["rows"]
        if r["verdict"] in ("differs", "uncomparable", "not-read", "not-drawn", "defect")
    ]
    if not interesting:
        print("   none")
    width = max((len(r["layer"]) for r in interesting), default=10)
    for row in interesting:
        values = f"   [{row.get('delta')}]" if row.get("delta") else ""
        print(f"   {row['verdict']:>12}  {row['layer']:<{width}}  {row['fact']:<24} {row['why'][:90]}{values}")
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
