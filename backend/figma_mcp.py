"""figma_mcp.py — the Figma MCP, as a TOOL a prompt can actually call.

Two Figma channels exist in this repository and they are NOT interchangeable:

  figma_service.py   REST + token, cached in Postgres `figma_specs`. The render-time
                     path behind `/api/figma/spec/{key}/{node}`.
  this module        the MCP. No token, and it is the only channel that carries the
                     Dev Mode ANNOTATION attributes — the behavioural spec itself.

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
        if ok:
            blocks.append(
                f"=== FIGMA DESIGN — {name} — node {node} ===\n"
                f"Read from Figma at run time. This is the design itself, not a summary.\n\n{text}"
            )
            print(f"✅ [tool_calls] {name} node {node} → {len(text)} chars")
        else:
            warnings.append(f"{name} on node {node} FAILED: {err}")
            print(f"⚠️  [tool_calls] {name} node {node} failed: {err}")

    return blocks, warnings
