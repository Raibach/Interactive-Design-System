"""The console's tool inventory — the small registry of programs a person can open here.

This is NOT the prompt-tools table (`tools`), which names tools a PROMPT can call. This is the
console's own inventory: name, one line, status, entry point. The plan expects 15 tools; only
Figma ingest is built today, so the registry names what exists and carries the expected count for
the unbuilt remainder. The unbuilt NAMES are not invented here; they come in as entries when the
tool exists or when the design inventory supplies them.
"""
from __future__ import annotations

from typing import Any

EXPECTED_TOOL_COUNT = 15


CONSOLE_TOOLS: dict[str, dict[str, Any]] = {
    "figma-ingest": {
        "label": "Figma ingest",
        "description": "Pulls a Figma frame into the console's design work, newest activity first.",
        "status": "available",
        "entry": "tools/figma-ingest",
        "plan": {
            "sort": "recent_activity",
            "filter": [{"field": "room", "op": "eq", "value": "design"}],
            "text": "",
            "explain": "Figma ingest · recent activity",
        },
    },
}


def tool_inventory() -> list[dict[str, str]]:
    """The tools as data for the seat: token is the wire, label is the button."""
    return [
        {
            "token": token,
            "label": str(tool.get("label") or token),
            "description": str(tool.get("description") or ""),
            "status": str(tool.get("status") or "not built"),
            "entry": str(tool.get("entry") or ""),
        }
        for token, tool in CONSOLE_TOOLS.items()
    ]


def available_tool(token: str) -> dict[str, Any] | None:
    tool = CONSOLE_TOOLS.get(str(token or ""))
    return tool if tool and tool.get("status") == "available" else None


def resolve_tool_selection(text: str) -> dict[str, Any]:
    """Resolve a name or description to a tool, or refuse in words.

    A selection never returns an empty tool. An available match returns the tool; a matching
    unbuilt entry returns `status: refused` with its reason; an unknown phrase returns a refusal
    that lists only the real entries.
    """
    query = " ".join(str(text or "").lower().split())
    if not query:
        return {"status": "refused", "reason": "Say which tool you mean.", "tool": None}
    available_labels = [
        str(tool.get("label") or token)
        for token, tool in CONSOLE_TOOLS.items()
        if tool.get("status") == "available"
    ]
    for token, tool in CONSOLE_TOOLS.items():
        label = str(tool.get("label") or token)
        entry = str(tool.get("entry") or "")
        haystack = " ".join((token, label, str(tool.get("description") or ""), entry)).lower()
        matched = query in {token.lower(), label.lower(), entry.lower()} or all(
            word in haystack for word in query.split()
        )
        if not matched:
            continue
        if tool.get("status") != "available":
            return {
                "status": "refused",
                "reason": f"{label} is {str(tool.get('status') or 'not built')}; it is not built yet.",
                "tool": None,
            }
        return {"status": "available", "reason": "", "tool": {**tool, "token": token}}
    return {
        "status": "refused",
        "reason": "No built tool matches that. The inventory has: "
        + (", ".join(available_labels) if available_labels else "nothing available"),
        "tool": None,
    }
