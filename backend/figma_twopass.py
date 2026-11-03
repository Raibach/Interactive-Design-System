"""THE SECOND READING — the same node, over the other channel, reconciled fact by fact.

WHY THIS EXISTS. The ingest has always read the submitted node over REST. Figma's desktop MCP
(`get_design_context`) was then called for annotations, reference code and assets, and merged
INTO the REST tree by overwriting fields. An overwrite is not a second opinion: it is one
channel answering for the other, and once the asset or the annotation arrives the pipeline has
no record that the two could have disagreed. So a fact the second channel lost, or moved, or
rounded, reached the drawing with nobody's name on it.

WHAT THIS MODULE DOES, and only this. It asks the desktop MCP for the same node's metadata
(`get_metadata`, the channel that carries numbers rather than generated code), parses it, and
compares it with the REST tree the ingest already holds. Every compared fact gets one of four
outcomes, and each is written down:

  agree      both channels carry the same value            → the fact is read
  differ     the two values are named, which channel said what → the fact is named
  rest-only  the second channel does not carry it           → named as single-channel
  mcp-only   the design's channel does not carry it         → named as single-channel

Nothing is merged, nothing is preferred, and nothing is dropped. This module never draws: it
reports, and the ingest attaches the report to its answer.

MEASURED BEFORE IT WAS WRITTEN — node 40001283:2791 in file 20UPR2KQMsbAxlo5NJb1se,
2026-11-01:

  * name, size and the accumulated position agree on all 14 shared layers, to four decimals;
  * `get_metadata` does NOT carry the three VECTOR layers under `chat history`, so the artwork
    that a mark is drawn from exists on one channel only;
  * REST's `absoluteBoundingBox` is the box AFTER the layer's transform, so on a flipped layer
    it does not equal the layer's own offset. `get_metadata` carries no transform at all. The
    comparable position is therefore the ACCUMULATED TRANSLATION — MCP's own x/y sums against
    REST's `relativeTransform` chain — and the flip is reported as a fact only REST carries.
    Comparing the two without that distinction reported 17 false differences on this node
    before the distinction was measured.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from typing import Any

from figma_mcp import DEFAULT_MCP_URL, DEFAULT_TIMEOUT, _post

METADATA_TOOL = "get_metadata"

#: The REST node type against the element name `get_metadata` writes for it. A name outside this
#: map is reported by its own two words rather than guessed into a match.
TYPE_TAGS = {
    "FRAME": "frame",
    "GROUP": "group",
    "ELLIPSE": "ellipse",
    "RECTANGLE": "rectangle",
    "VECTOR": "vector",
    "TEXT": "text",
    "COMPONENT": "component",
    "COMPONENT_SET": "componentSet",
    "INSTANCE": "instance",
    "BOOLEAN_OPERATION": "booleanOperation",
    "LINE": "line",
    "STAR": "star",
    "REGULAR_POLYGON": "regularPolygon",
    "SLICE": "slice",
}

#: Four decimals, and no rounding below it. The ingest's own placement proof already speaks to
#: four decimals; a tolerance finer than the channel's own float noise would report a difference
#: nobody can act on.
TOLERANCE = 1e-4


def _num(value: float | None) -> str:
    """A number as the answer prints it: exact, never rounded. `262.3243103027344` stays whole."""
    if value is None:
        return ""
    text = repr(float(value))
    return text[:-2] if text.endswith(".0") else text


def _same(left: float | None, right: float | None) -> bool:
    if left is None or right is None:
        return False
    return abs(float(left) - float(right)) <= TOLERANCE


def read_metadata(
    node_id: str,
    file_key: str | None = None,
    url: str | None = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> tuple[list[dict[str, Any]], str | None]:
    """`get_metadata` for one node. Returns (layers in document order, error).

    An empty list beside an error is a read that did not happen, never a design with no layers —
    the two are the pair this whole application keeps apart. The caller states which one it got.
    """
    url = (url or DEFAULT_MCP_URL).rstrip("/")
    init, session, err = _post(
        url,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "raibach-twopass", "version": "1"},
            },
        },
        None,
        timeout,
    )
    if err:
        return [], err

    server = ((init or {}).get("result") or {}).get("serverInfo") or {}
    who = f"{server.get('name', 'Figma MCP')} v{server.get('version', '?')}"

    _post(url, {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}}, session, timeout)

    arguments: dict[str, Any] = {"nodeId": node_id}
    if file_key:
        arguments["fileKey"] = file_key
    res, _, err = _post(
        url,
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {"name": METADATA_TOOL, "arguments": arguments},
        },
        session,
        timeout,
    )
    if err:
        return [], err

    result = (res or {}).get("result") or {}
    if result.get("isError"):
        return [], f"{who} reported an error for node {node_id}: {str(result.get('content'))[:300]}"

    parts = [
        part.get("text", "")
        for part in (result.get("content") or [])
        if part.get("type") == "text"
    ]
    text = "\n".join(parts).strip()
    xml = _element_from(parts)
    if not xml:
        return [], (
            f"{who} answered for node {node_id} with no layer tree. The reply said: "
            f"{text[:200] or 'nothing'}"
        )

    try:
        root = ET.fromstring(xml)
    except ET.ParseError as error:
        return [], f"{who} returned a layer tree that could not be read ({error})."

    return parse_layers(root), None


def _element_from(parts: list[str]) -> str:
    """The layer tree out of the reply.

    The reply is several parts: prose about the selection, then the XML tree, then prose about
    which tool to call next. Joining them and cutting at the first `<` left the trailing prose
    inside the document and the reader refused it ("junk after document element", measured
    2026-11-01). So each part is tried on its own and the walk stops at the element's own closing
    tag; the joined text is only a fallback for a tree the server split across parts.
    """
    for part in parts:
        found = _outer_element(part)
        if found:
            return found
    return _outer_element("\n".join(parts))


def _outer_element(text: str) -> str:
    """The first complete XML element in `text`, from its opening tag to its matching close."""
    start = text.find("<")
    while start >= 0:
        depth = 0
        cursor = start
        while cursor < len(text):
            if text[cursor] != "<":
                cursor += 1
                continue
            end = text.find(">", cursor)
            if end < 0:
                break
            tag = text[cursor:end + 1]
            if tag.startswith("</"):
                depth -= 1
                if depth == 0:
                    return text[start:end + 1]
            elif tag.startswith("<!"):
                pass
            elif tag.endswith("/>"):
                if depth == 0:
                    return text[start:end + 1]
            else:
                depth += 1
            cursor = end + 1
        start = text.find("<", start + 1)
    return ""


def parse_layers(root: ET.Element) -> list[dict[str, Any]]:
    """Every element of the tree, in document order, with its position accumulated from its parents.

    `get_metadata` writes each layer's x and y relative to its parent and carries no transform,
    so the only position it can be compared on is the sum down the chain. A layer's own size and
    name travel as written.
    """
    layers: list[dict[str, Any]] = []

    def walk(element: ET.Element, parent_x: float, parent_y: float) -> None:
        x = parent_x + _float(element.get("x"))
        y = parent_y + _float(element.get("y"))
        layers.append({
            "id": (element.get("id") or "").replace("-", ":"),
            "name": element.get("name"),
            "tag": element.tag,
            "x": x,
            "y": y,
            "width": _float(element.get("width")),
            "height": _float(element.get("height")),
            "characters": element.get("text") or element.get("characters"),
        })
        for child in list(element):
            walk(child, x, y)

    walk(root, 0.0, 0.0)
    return layers


def _float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _multiply(left: list[list[float]], right: list[list[float]]) -> list[list[float]]:
    """Two 2×3 affine transforms, the child applied in the parent's space."""
    a, b, c = left[0][0], left[1][0], left[0][2]
    d, e, f = left[0][1], left[1][1], left[1][2]
    A, B, C = right[0][0], right[1][0], right[0][2]
    D, E, F = right[0][1], right[1][1], right[1][2]
    return [
        [a * A + b * D, a * B + b * E, a * C + b * F + c],
        [d * A + e * D, d * B + e * E, d * C + e * F + f],
    ]


def rest_layers(document: dict[str, Any]) -> list[dict[str, Any]]:
    """Every layer of the REST tree, in document order, with its accumulated translation.

    THE TRANSLATION, NOT THE BOX. `absoluteBoundingBox` is the box after the layer's own
    transform; on a flipped layer it is not the layer's offset, and Figma stores a negative scale
    on the flip and the negation of the offset on each child inside it. The translation is what
    survives that, and it is the only position figure both channels can be asked for.
    """
    layers: list[dict[str, Any]] = []

    def walk(node: dict[str, Any], chain: list[list[float]],
             any_flip_x: bool, any_flip_y: bool,
             group_offset: tuple[float, float] | None) -> None:
        transform = node.get("relativeTransform")
        here = _multiply(chain, transform) if transform else chain
        box = node.get("absoluteBoundingBox") or {}
        layers.append({
            "id": (node.get("id") or "").replace("-", ":"),
            "name": node.get("name"),
            "type": node.get("type"),
            "x": here[0][2],
            "y": here[1][2],
            "width": box.get("width"),
            "height": box.get("height"),
            "characters": node.get("characters"),
            "absoluteX": box.get("x"),
            "absoluteY": box.get("y"),
            "scaleX": here[0][0],
            "scaleY": here[1][1],
            # A FLIP ABOVE THIS LAYER, ON EACH AXIS. A frame flipped on an axis stores its
            # children's offset on that axis NEGATED — measured on node 40001283:2791: the three
            # ellipses sit at x 2, 8.16 and 14.32 in the MCP and at −2, −8.16 and −14.32 in REST,
            # inside a frame whose own scale is −1 on x and −1 on y. The negation happens at the
            # one level, and every layer beneath it inherits the difference, so the mark travels
            # down the chain rather than being read from the direct parent alone. Reading only the
            # direct parent left three layers with a difference and no cause (measured).
            "flipAboveX": any_flip_x,
            "flipAboveY": any_flip_y,
            # A FIGMA GROUP IS NOT A COORDINATE SPACE, and the two channels disagree about that.
            # Measured on node 40001421:5467: every child of `figma-ingest-results-footer` differs
            # from the MCP by exactly the group's own offset — 642 on x, 13 on y — because the
            # MCP adds the group's offset to each child and REST does not. The group's offset is
            # carried here so the fact can say what the size of the difference is.
            "groupOffset": group_offset,
            "flipped": (here[0][0] < 0) or (here[1][1] < 0),
        })
        own_x = transform[0][0] if transform else 1.0
        own_y = transform[1][1] if transform else 1.0
        under_group = group_offset
        if node.get("type") == "GROUP" and transform:
            under_group = (transform[0][2], transform[1][2])
        for child in node.get("children") or []:
            walk(child, here, any_flip_x or own_x < 0, any_flip_y or own_y < 0, under_group)

    walk(document, [[1.0, 0.0, 0.0], [0.0, 1.0, 0.0]], False, False, None)
    return layers


def reconcile(
    document: dict[str, Any],
    mcp_layers: list[dict[str, Any]],
    *,
    mcp_error: str | None = None,
    mcp_assets: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """The two readings, fact by fact. Returns the table, the counts and the sentence to print.

    `mcp_assets` is what the SAME channel carried in its other answer. This matters because the
    layer list and the artwork are asked of one channel through two tools: `get_metadata`
    enumerates layers and returns no vectors at all, and `get_design_context` returns the vector
    artwork for the design without enumerating the layers. Reporting the vectors as "the second
    channel does not see them" was therefore too broad and was corrected on 2026-11-01: the
    LAYERS are absent from one answer, their ARTWORK is present in the other.
    """
    assets = mcp_assets or []
    rest = {layer["id"]: layer for layer in rest_layers(document)}
    mcp = {layer["id"]: layer for layer in mcp_layers}

    rows: list[dict[str, Any]] = []

    def row(layer: dict[str, Any], fact: str, outcome: str, rest_value: Any, mcp_value: Any,
            cause: str = "", cause_kind: str = "", chosen: str = "") -> None:
        rows.append({
            "id": layer.get("id"),
            "layer": layer.get("name"),
            "fact": fact,
            "outcome": outcome,
            "rest": "" if rest_value is None else str(rest_value),
            "mcp": "" if mcp_value is None else str(mcp_value),
            "cause": cause,
            "causeKind": cause_kind,
            # WHICH CHANNEL THE DRAWING TAKES THIS FACT FROM (owner, 2026-11-02: *"the AI has to
            # read every single spec … assemble it according to that Figma file"*). Both agreeing
            # means either channel carries it; one channel carrying it means that one; a
            # disagreement carries the channel the drawn value comes from, and the cause above
            # already says why. `apply` writes these choices into the document the renderer reads,
            # so the drawing follows this column and not a second opinion of its own.
            "chosen": chosen or ("both" if outcome == "agree" else
                                 "rest" if outcome == "rest-only" else
                                 "mcp" if outcome == "mcp-only" else "rest"),
        })

    # A VALUE THAT ONE CHANNEL DOES NOT CARRY IS NOT A DISAGREEMENT. Calling an absent value a
    # difference reads as "the two channels contradict each other" when the truth is "one of them
    # was never asked". It is named as single-channel instead, which is a different sentence and
    # a different thing for the designer to do.
    def compare(layer: dict[str, Any], fact: str, rest_value: Any, mcp_value: Any,
                cause: str = "", cause_kind: str = "") -> None:
        if rest_value in (None, "") and mcp_value in (None, ""):
            return
        if mcp_value in (None, ""):
            row(layer, fact, "rest-only", rest_value, "", cause, cause_kind)
            return
        if rest_value in (None, ""):
            row(layer, fact, "mcp-only", "", mcp_value, cause, cause_kind)
            return
        row(layer, fact, "agree" if rest_value == mcp_value else "differ",
            rest_value, mcp_value, cause, cause_kind)

    for node_id, mcp_layer in mcp.items():
        rest_layer = rest.get(node_id)
        if rest_layer is None:
            row(mcp_layer, "layer", "mcp-only", "", mcp_layer.get("tag"))
            continue
        compare(rest_layer, "name", rest_layer.get("name"), mcp_layer.get("name"))
        expected_tag = TYPE_TAGS.get(str(rest_layer.get("type")), None)
        type_matches = expected_tag == mcp_layer.get("tag")
        row(rest_layer, "type", "agree" if type_matches else "differ",
            rest_layer.get("type"), mcp_layer.get("tag"),
            "" if type_matches else (
                "the MCP names a Figma group a frame; REST tells a group and a frame apart. "
                "The type is REST's, and nothing about the drawing changes."
                if rest_layer.get("type") == "GROUP" else
                "the two channels name this layer's kind differently; REST's name is the one drawn."
            ),
            "" if type_matches else "naming")
        compare(rest_layer, "width", _num(rest_layer.get("width")), _num(mcp_layer.get("width")))
        compare(rest_layer, "height", _num(rest_layer.get("height")), _num(mcp_layer.get("height")))
        for fact in ("x", "y"):
            left, right = rest_layer.get(fact), mcp_layer.get(fact)
            same = left is not None and right is not None and _same(left, right)
            # THE FRAME'S OWN FLIP IS THE CAUSE, AND IT IS NAMED AS THE CAUSE. A frame flipped on
            # an axis stores its children's offsets on that axis negated; the MCP adds them as
            # written. Saying only "they differ" would send the designer looking for a fault in a
            # file that is right, so the row carries the reason and the frame it belongs to.
            cause = ""
            kind = ""
            if not same:
                group = rest_layer.get("groupOffset")
                above = rest_layer.get("flipAboveX" if fact == "x" else "flipAboveY")
                if group is not None:
                    kind = "group"
                    cause = (
                        "a Figma group sits above this layer. The MCP adds the group's own offset "
                        f"({_num(group[0])}, {_num(group[1])}) to every child and REST does not, "
                        "because a group is not a coordinate space of its own. The drawn position "
                        "is REST's."
                    )
                elif above:
                    kind = "flip"
                    cause = (
                        "a frame above this layer is flipped on this axis: REST stores the offset "
                        "negated from that frame down and the MCP adds it as written, so the two "
                        "numbers are the same place from two origins. The drawn position is REST's, "
                        "and the flip itself is a fact only REST carries."
                    )
            compare(rest_layer, fact,
                    "" if left is None else _num(left),
                    "" if right is None else _num(right),
                    cause, kind)
        compare(rest_layer, "text",
                (rest_layer.get("characters") or "").strip(),
                (mcp_layer.get("characters") or "").strip())
        # THE FLIP IS A FACT ONE CHANNEL CARRIES. `get_metadata` has no transform, so a design
        # drawn without it draws a mirrored layer the right way round. Only a FLIP is reported:
        # an unflipped layer's identity transform changes no drawing, and counting it as an
        # agreement would inflate the count with a fact nobody compared.
        if rest_layer.get("flipped"):
            scale = f"{_num(rest_layer.get('scaleX'))}, {_num(rest_layer.get('scaleY'))}"
            row(rest_layer, "transform", "rest-only", scale, "")

    for node_id, rest_layer in rest.items():
        if node_id not in mcp:
            cause = ""
            kind = ""
            if rest_layer.get("type") in ("VECTOR", "BOOLEAN_OPERATION", "STAR", "LINE",
                                          "REGULAR_POLYGON"):
                kind = "artwork"
                if assets:
                    cause = (
                        "the layer list of the second answer does not enumerate vectors, and the "
                        f"same channel's design-context answer supplied {len(assets)} artwork "
                        "asset(s) for this design. The shape is read twice; the layer is named once."
                    )
                else:
                    cause = (
                        "the layer list of the second answer does not enumerate vectors, and its "
                        "design-context answer supplied no artwork for this design. The shape is "
                        "read once, and that is a fact about the second channel, not about your file."
                    )
            row(rest_layer, "layer", "rest-only", rest_layer.get("type"), "", cause, kind)

    counts: dict[str, int] = {"agree": 0, "differ": 0, "rest-only": 0, "mcp-only": 0}
    for item in rows:
        counts[item["outcome"]] = counts.get(item["outcome"], 0) + 1

    layering = {
        "rest": len(rest),
        "mcp": len(mcp),
        "both": len(set(rest) & set(mcp)),
        "restOnly": sorted(set(rest) - set(mcp)),
        "mcpOnly": sorted(set(mcp) - set(rest)),
    }

    return {
        "mcpError": mcp_error,
        "counts": counts,
        "layers": layering,
        # WHAT THE SECOND CHANNEL SUPPLIED AS ARTWORK, counted here so the vector rows and the
        # summary can name it instead of saying the channel was blind.
        "assets": {
            "count": len(assets),
            "kinds": sorted({str(asset.get("kind")) for asset in assets if asset.get("kind")}),
        },
        "rows": rows,
        "summary": _summary(counts, layering, rows, mcp_error, assets),
        "divergences": [item for item in rows if item["outcome"] != "agree"],
    }


def _summary(
    counts: dict[str, int],
    layering: dict[str, Any],
    rows: list[dict[str, Any]],
    mcp_error: str | None,
    assets: list[dict[str, Any]],
) -> str:
    """One sentence, in the system's own voice, that a designer can check against Figma."""
    if mcp_error:
        return (
            "This design was read once, over REST. The second reading did not happen: "
            f"{mcp_error} Until Figma Desktop is open with this file, no fact has a second "
            "opinion and the whole answer rests on one channel."
        )
    compared = counts["agree"] + counts["differ"]
    parts = [
        f"Read twice: {layering['both']} of {layering['rest']} layers were measured over REST and "
        f"over Figma's desktop MCP, {counts['agree']} of {compared} facts carrying the same value."
    ]

    differing = [item for item in rows if item["outcome"] == "differ"]
    by_kind: dict[str, int] = {}
    for item in differing:
        by_kind[item.get("causeKind") or ""] = by_kind.get(item.get("causeKind") or "", 0) + 1
    if by_kind.get("flip"):
        parts.append(
            f"{by_kind['flip']} fact(s) differ inside a mirrored frame: REST stores a child's "
            "offset negated from a flipped frame down and the MCP adds it as written, so the two "
            "numbers are the same place from two origins. The drawn position is REST's, and the "
            "flip itself is a fact only REST carries."
        )
    if by_kind.get("group"):
        parts.append(
            f"{by_kind['group']} fact(s) differ inside a Figma group: the MCP adds the group's own "
            "offset to every child and REST does not, because a group is not a coordinate space of "
            "its own. The drawn position is REST's."
        )
    if by_kind.get("naming"):
        parts.append(
            f"{by_kind['naming']} fact(s) differ in name only: the MCP calls a Figma group a frame "
            "and REST tells the two apart. Nothing about the drawing changes."
        )
    unexplained = [item for item in differing if not item.get("cause")]
    if unexplained:
        named = [
            f"{item['layer']} {item['fact']} (REST {item['rest'] or 'nothing'}, "
            f"MCP {item['mcp'] or 'nothing'})"
            for item in unexplained
        ]
        parts.append(
            f"{len(unexplained)} fact(s) differ with no shared cause: {', '.join(named[:12])}"
            f"{' …' if len(named) > 12 else ''}."
        )

    only_rest = [item for item in rows if item["outcome"] == "rest-only"]
    if only_rest:
        artwork = [item for item in only_rest if item.get("causeKind") == "artwork"]
        other = [item for item in only_rest if item.get("causeKind") != "artwork"]
        kinds: dict[str, int] = {}
        for item in other:
            label = item["fact"] if item["fact"] != "layer" else f"layer ({item['rest']})"
            kinds[label] = kinds.get(label, 0) + 1
        if artwork:
            shapes = len(artwork)
            if assets:
                parts.append(
                    f"{shapes} vector layer(s) are named by one channel only, and the second "
                    f"channel carried their artwork in its other answer — {len(assets)} asset(s) "
                    "for this design. The shapes were read twice; the layer names once."
                )
            else:
                parts.append(
                    f"{shapes} vector layer(s) were read once: the second channel enumerates no "
                    "vectors and supplied no artwork for this design."
                )
        if other:
            named = ", ".join(f"{count} {kind}" for kind, count in sorted(kinds.items()))
            parts.append(
                f"{len(other)} other fact(s) exist only over REST ({named}); the second channel "
                "does not carry them, so it cannot confirm them."
            )
    if layering["mcpOnly"]:
        parts.append(
            f"{len(layering['mcpOnly'])} layer(s) exist only over MCP, which REST did not return; "
            f"nothing is drawn from them: {', '.join(layering['mcpOnly'][:6])}."
        )
    if not differing and not only_rest and not layering["mcpOnly"]:
        parts.append("The two channels agree on every layer and every value they both carry.")
    return " ".join(parts)


def apply(document: dict[str, Any], result: dict[str, Any]) -> dict[str, int]:
    """WRITE THE RECONCILIATION'S CHOICE INTO THE DOCUMENT THE RENDERER READS.

    The two readings are compared above; this is the half that makes the comparison drive the
    drawing. A fact the second channel alone carried is written into the document, so the renderer
    draws what was READ rather than dropping a value because it arrived on the other channel.

    WHAT IT DELIBERATELY DOES NOT DO: it writes no value for a fact the two channels agree on (there
    is nothing to choose), and it writes none for a disagreement, because every disagreement this
    docuent records is one where REST is the drawn value and the cause column already says why —
    a flip, a group's offset, a kind Figma names twice. Turning any of those into an MCP override
    would be a number with no coordinate space behind it.

    Fields are written where the renderer reads them: the name and the words on the node, the size
    and position on `absoluteBoundingBox`.
    """
    wanted: dict[str, dict[str, str]] = {}
    for row in result.get("rows", []):
        if row.get("chosen") != "mcp":
            continue
        wanted.setdefault(str(row.get("id") or ""), {})[str(row.get("fact") or "")] = str(
            row.get("mcp") or ""
        )
    if not wanted:
        return {"applied": 0}

    applied = 0

    def set_fact(node: dict[str, Any], fact: str, value: str) -> bool:
        nonlocal applied
        if fact == "name":
            node["name"] = value
        elif fact == "text":
            node["characters"] = value
        elif fact in ("width", "height", "x", "y"):
            try:
                number = float(value)
            except (TypeError, ValueError):
                return False
            box = node.setdefault("absoluteBoundingBox", {})
            box[fact] = number
        else:
            return False
        applied += 1
        return True

    def walk(node: dict[str, Any]) -> None:
        node_id = str(node.get("id") or "").replace("-", ":")
        for fact, value in wanted.get(node_id, {}).items():
            set_fact(node, fact, value)
        for child in node.get("children") or []:
            walk(child)

    walk(document)
    return {"applied": applied}
