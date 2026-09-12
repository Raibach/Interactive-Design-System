"""figma_mcp.py — the Figma MCP, as a TOOL a prompt can actually call.

Two Figma channels exist in this repository, and they differ in REACHABILITY rather
than in whether the design's annotations come through — both carry those:

  this module's MCP call   get_design_context over MCP. No token. Carries the Dev Mode
                           annotations AND Figma's rendered reference code. Needs a
                           running MCP: the desktop app on 127.0.0.1:3845, or the
                           OAuth-interactive remote — neither of which exists on a
                           server.
  _rest_design_block       REST + token through figma_service, cached in Postgres
                           `figma_specs` — the DESIGNER/MCP read path behind
                           `/api/figma/spec/{key}/{node}`. Carries the same annotations
                           (`nodes[].annotations[]`), and no generated code.

So run_tool_calls asks the MCP first and falls back to REST. The MCP is the richer
channel when it is running, and on a deployed server it never is; treating "no MCP" as
"no design" would make the repair prompt design-blind in production for a reason that
has nothing to do with the design.

The repair prompt asks for the design. That ask is worth nothing unless something
actually CALLS Figma when Run is pressed, so the call happens here, on the server,
BEFORE the model is called: the model then receives the design instead of being asked
to imagine it. A browser cannot make this call — the desktop MCP listens on
127.0.0.1:3845 with a session handshake and no CORS — which is why this is server-side
even though the person pressing Run is in the browser.

FAIL LOUD. Every entry point returns (ok, payload, error), and the failure text says
what a person must DO. "The file is not open in Figma Desktop" and "there is nothing
to see" must never look like each other; silencing either is how a design-blind answer
comes back looking authoritative.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple

import requests

DEFAULT_MCP_URL = os.environ.get("FIGMA_MCP_URL", "http://127.0.0.1:3845/mcp")
DEFAULT_FILE_KEY = os.environ.get("FIGMA_DEFAULT_FILE_KEY", "20UPR2KQMsbAxlo5NJb1se")
DESIGN_CONTEXT_TOOL = "get_design_context"

#: Tool names a prompt is allowed to ask for. A name outside this set is reported,
#: never silently skipped — an unexecuted tool call reads as a successful one.
SUPPORTED_TOOLS = {"figma.get_design_context"}

DEFAULT_TIMEOUT = 15.0


def _post(
    url: str,
    payload: Dict[str, Any],
    session: Optional[str],
    timeout: float,
) -> Tuple[Optional[dict], Optional[str], Optional[str]]:
    """One JSON-RPC POST to the streamable-HTTP MCP. Returns (json, session, error)."""
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream",
    }
    if session:
        headers["Mcp-Session-Id"] = session

    try:
        r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=timeout)
    except requests.exceptions.ConnectionError as e:
        return None, None, (
            f"Figma's MCP is not answering on {url}. The desktop MCP server only runs "
            f"while Figma Desktop is OPEN with this file loaded — open it, then press Run "
            f"again. Until then the design cannot be checked. ({type(e).__name__})"
        )
    except requests.exceptions.Timeout:
        return None, None, (
            f"Figma's MCP did not answer within {timeout:g}s ({url}). "
            f"It may be busy, or the file may be syncing."
        )
    except Exception as e:  # noqa: BLE001 — the reason IS the payload here
        return None, None, f"Figma MCP request failed: {type(e).__name__}: {e}"

    session_out = r.headers.get("Mcp-Session-Id") or session
    body = r.text or ""
    # streamable-HTTP replies as SSE; take the `data:` lines and parse them.
    data = "\n".join(line[6:] for line in body.splitlines() if line.startswith("data: "))
    if data:
        try:
            return json.loads(data), session_out, None
        except json.JSONDecodeError as e:
            return None, session_out, f"Figma MCP returned unparseable data ({e})"

    if not r.ok:
        return None, session_out, f"Figma MCP answered HTTP {r.status_code}: {body[:200]}"
    return {}, session_out, None


def call_design_context(
    node_id: str,
    file_key: Optional[str] = None,
    url: Optional[str] = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> Tuple[bool, str, Optional[str]]:
    """`get_design_context` for one node. Returns (ok, text, error)."""
    url = (url or DEFAULT_MCP_URL).rstrip("/")
    file_key = file_key or DEFAULT_FILE_KEY

    init, session, err = _post(
        url,
        {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "raibach-backend", "version": "1"},
            },
        },
        None,
        timeout,
    )
    if err:
        return False, "", err

    server = ((init or {}).get("result") or {}).get("serverInfo") or {}
    who = f"{server.get('name', 'Figma MCP')} v{server.get('version', '?')}"

    # Notifications expect no reply; a failure here does not fail the call.
    _post(
        url,
        {"jsonrpc": "2.0", "method": "notifications/initialized", "params": {}},
        session,
        timeout,
    )

    res, _, err = _post(
        url,
        {
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/call",
            "params": {
                "name": DESIGN_CONTEXT_TOOL,
                "arguments": {"fileKey": file_key, "nodeId": node_id},
            },
        },
        session,
        timeout,
    )
    if err:
        return False, "", err

    result = (res or {}).get("result") or {}
    if result.get("isError"):
        return False, "", (
            f"{who} reported an error for node {node_id}: {json.dumps(result)[:300]}"
        )

    content = result.get("content") or []
    text = "\n".join(c.get("text", "") for c in content if c.get("type") == "text").strip()
    if not text:
        return False, "", (
            f"{who} returned nothing for node {node_id}. Either the node id is stale "
            f"(the design moved and the address was never updated) or the file open in "
            f"Figma Desktop is not the one this address belongs to."
        )
    return True, text, None


def _rest_design_block(
    node_id: str,
    file_key: str,
) -> Tuple[bool, str, Optional[str]]:
    """Second channel: REST + token, through figma_service (cache-backed).

    This exists because the MCP cannot answer on a deployed server. The MCP is either
    a DESKTOP process on 127.0.0.1 — which is exactly why it needs no auth, and why it
    is never present on a server — or the OAuth-interactive remote at mcp.figma.com,
    which cannot complete a browser handshake from inside a request handler. The REST
    channel needs neither: it needs the token that the deployment already holds, the
    same one behind `/api/figma/spec/{key}/{node}`.

    The same Dev Mode annotations arrive here (`nodes[].annotations[]` →
    extract_node_spec → the Postgres cache), so the BEHAVIOURAL spec survives the
    fallback. What does not survive is the MCP's rendered reference code — a caller
    reading a "via the REST channel" block is reading the design's annotations and
    structure, not generated code. The block says which channel answered for exactly
    that reason.
    """
    try:
        from figma_service import get_cached_spec, get_component_descriptions
    except Exception as e:  # noqa: BLE001 — degrade loudly, never silently
        return False, "", f"REST channel unavailable ({type(e).__name__}: {e})"

    # refresh=True on purpose. The cached rows were written by an extractor that
    # dropped annotations entirely, so a cache-first read here would serve a spec
    # that cannot answer the one question this call exists to ask. The upsert
    # refreshes the row as it goes.
    spec, detail, source = get_cached_spec(file_key, node_id, refresh=True)
    if not spec:
        return False, "", (
            f"figma_service has no spec for node {node_id} "
            f"(source={source}{'; ' + detail if detail else ''})"
        )

    # The written intent. Separate channel from the annotation, same reason Dev Mode
    # shows both: one says what it is FOR, the other what it DOES.
    try:
        descriptions = get_component_descriptions(file_key)
    except Exception:
        descriptions = {}

    def _hexes(paints: List[Dict[str, Any]]) -> str:
        out = []
        for p in paints:
            c = (p.get("color") or {}) if isinstance(p, dict) else {}
            hexv = c.get("hex") or p.get("type", "?") if isinstance(p, dict) else "?"
            op = c.get("alpha")
            out.append(f"{hexv}{'' if op in (None, 1) else f' @{op}'}")
        return ", ".join(out)

    lines: List[str] = []

    def walk(n: Dict[str, Any], depth: int = 0) -> None:
        pad = "  " * depth
        b = n.get("bounds") or {}
        size = f"  {b['width']:g}×{b['height']:g}" if b.get("width") else ""
        lines.append(
            f"{pad}{n.get('type', '?')} \"{n.get('name', '?')}\" [{n.get('id', '')}]{size}"
        )

        # The point of the whole call: the designer's own words.
        for a in n.get("annotations") or []:
            text = (a.get("labelMarkdown") or a.get("label") or "").strip()
            if text:
                lines.append(
                    f"{pad}  ANNOTATION: "
                    + text.replace("\n", "\n" + pad + "              ")
                )

        desc = descriptions.get(n.get("id"))
        if desc:
            lines.append(
                f"{pad}  DESCRIPTION (what it is for): "
                + desc.replace("\n", "\n" + pad + "                              ")
            )

        lay = n.get("layout") or {}
        if lay:
            bits = []
            for k, v in lay.items():
                if k in ("paddingLeft", "paddingRight"):
                    continue
                bits.append(f"{k}={v}")
            lines.append(f"{pad}  layout: {', '.join(bits)}")

        if n.get("cornerRadius") is not None:
            lines.append(f"{pad}  radius: {n['cornerRadius']:g}")

        if n.get("fills"):
            lines.append(f"{pad}  fill: {_hexes(n['fills'])}")

        t = n.get("text")
        if t:
            face = " ".join(
                str(t.get(k)) for k in ("fontFamily", "fontWeight", "fontSize") if t.get(k)
            )
            extra = ", ".join(
                f"{k}={t[k]}" for k in ("lineHeightPx", "letterSpacing") if t.get(k)
            )
            lines.append(f"{pad}  text: {face}{' (' + extra + ')' if extra else ''}")
            if t.get("characters") is not None:
                lines.append(f"{pad}  characters: {t['characters']!r}")

        for c in n.get("children") or []:
            walk(c, depth + 1)

    walk(spec)
    return True, "\n".join(lines), None


def run_tool_calls(
    tool_calls: Optional[List[Dict[str, Any]]],
    file_key: Optional[str] = None,
    timeout: float = DEFAULT_TIMEOUT,
) -> Tuple[List[str], List[str]]:
    """Execute a prompt's tool calls.

    Returns (blocks, warnings):
      blocks    — what the model should READ, headed so its provenance is obvious
      warnings  — what FAILED, in words a person can act on

    Both are always returned. A caller that reads only `blocks` cannot tell a tool
    that returned nothing from one that never ran, so it must read both.
    """
    blocks: List[str] = []
    warnings: List[str] = []

    for call in tool_calls or []:
        name = (call or {}).get("name")
        node = (call or {}).get("nodeId")

        if name not in SUPPORTED_TOOLS:
            warnings.append(f'Unknown tool "{name}" — nothing was executed for it.')
            continue
        if not node:
            warnings.append(f'Tool "{name}" was called without a nodeId — nothing to check.')
            continue

        ok, text, err = call_design_context(
            node,
            file_key=(call or {}).get("fileKey") or file_key,
            timeout=timeout,
        )
        channel = "MCP"
        if not ok:
            # The MCP is absent on any deployed server BY NATURE — it is a desktop
            # process, or an OAuth-interactive remote. That is not the same thing as
            # the design being unavailable, so the REST channel gets the question
            # before the model is told the design could not be read.
            r_ok, r_text, r_err = _rest_design_block(
                node, (call or {}).get("fileKey") or file_key or DEFAULT_FILE_KEY
            )
            if r_ok:
                print(
                    f"ℹ️  [tool_calls] MCP unavailable for node {node}; the REST "
                    f"channel answered ({len(r_text)} chars) — MCP said: {err}"
                )
                ok, text, channel = True, r_text, "REST"
            else:
                warnings.append(
                    f"{name} on node {node} FAILED on both channels. "
                    f"MCP: {err} REST: {r_err}"
                )
                print(f"⚠️  [tool_calls] {name} node {node}: no channel answered")
                continue

        if ok:
            blocks.append(
                f"=== FIGMA DESIGN — {name} — node {node} — via the {channel} channel ===\n"
                f"Read from Figma at run time. This is the design itself, not a summary."
                + (
                    "\n(Fetched over the REST channel because the Figma MCP is not "
                    "reachable from this machine — on a deployed server it never is. "
                    "The annotations and descriptions below are the designer's own, "
                    "read verbatim. Two things this channel does NOT carry, so do not "
                    "report either as missing from the design: the generated reference "
                    "code, and any description belonging to a component that lives in "
                    "a LIBRARY file rather than in this one.)"
                    if channel == "REST"
                    else ""
                )
                + f"\n\n{text}"
            )
            print(f"✅ [tool_calls] {name} node {node} via {channel} → {len(text)} chars")

    return blocks, warnings
