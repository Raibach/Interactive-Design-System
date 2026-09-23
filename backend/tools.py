"""
tools.py — the tools the system can use.

A tool is work the system can do. There are two kinds, and they differ in one
place: what happens at the moment one is used.

    read   the system reads it and follows it. Nothing is called, nothing
           comes back. The rules for laying out the composer are one.
    call   the system asks another program for something and it answers.
           Looking something up on the internet is one.

Everything before that moment is the same for both, which is why they live in
one table and are handed out by one module. A tool has a name, one line saying
what it is for, the text, a category, and the sections of a prompt it belongs
in.

WHERE THEY LIVE. The `tools` table. Not a folder — a folder is a developer's
place, and this system does not assume anyone edits files to change what the
system can do. A tool is a row, and a row can be written from a screen.

WHAT REACHES A PROMPT. Only the name and the one line. The body is delivered
when something asks for it by name. That is the whole mechanism: a tool costs
nothing on the calls that never use it, and costs one read on the calls that
do. The alternative — every body in every prompt — is what makes long
instructions expensive.

AN UNKNOWN NAME IS A REFUSAL, NOT AN EMPTY ANSWER. When a tool is named that is
not in the table, the answer says so and lists what exists. An empty result and
a missing tool look identical from the outside, and only one of them is a
mistake.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from database_pool import DatabasePoolManager

# The seats of a prompt, as the prompt itself spells them. Used to check a
# section name before it is trusted in a filter, so a typo narrows to nothing
# instead of silently matching everything.
PROMPT_SECTIONS = (
    "system-role",
    "user-role",
    "agent-role",
    "tool-call",
    "custom-data",
    "few-shot",
    "constraints",
    "context",
)

# The seat a tool lands in when nothing else is said. It is the shared one.
DEFAULT_SECTION = "tool-call"


class ToolError(Exception):
    """A tool problem with a reason a person can read."""


def _pool() -> DatabasePoolManager:
    # Resolved per call rather than at import: this module is imported by route
    # modules that load before the pool exists.
    return DatabasePoolManager.get_instance()


def _row_to_tool(row: Dict[str, Any], with_body: bool = False) -> Dict[str, Any]:
    tool = {
        "name": row["name"],
        "summary": row["summary"],
        "category": row["category"],
        "sections": list(row["sections"] or [DEFAULT_SECTION]),
        "kind": row["kind"],
        "source": row["source"],
    }
    if with_body:
        tool["body"] = row["body"]
    return tool


def list_tools(section: Optional[str] = None) -> List[Dict[str, Any]]:
    """Every tool, or only those belonging to one section of a prompt.

    A tool can belong to more than one section and appears in each. No section
    given means every tool.
    """
    if section is not None and section not in PROMPT_SECTIONS:
        raise ToolError(
            f"Unknown prompt section {section!r}. Sections are: "
            + ", ".join(PROMPT_SECTIONS)
            + "."
        )

    sql = "SELECT name, summary, category, sections, kind, source FROM tools"
    params: tuple = ()
    if section is not None:
        sql += " WHERE %s = ANY(sections)"
        params = (section,)
    sql += " ORDER BY category, name"

    try:
        with _pool().get_connection() as conn:
            cur = conn.cursor()
            cur.execute(sql, params)
            rows = cur.fetchall()
            cur.close()
    except Exception as error:
        raise ToolError(f"The tools could not be read: {error}") from error

    return [_row_to_tool(r) for r in rows]


def categories() -> List[Dict[str, Any]]:
    """The categories, each with the number of tools in it.

    This is what the first list shows: the shape of what is available, not
    every tool at once.
    """
    try:
        with _pool().get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT category, count(*) AS n FROM tools "
                "GROUP BY category ORDER BY category"
            )
            rows = cur.fetchall()
            cur.close()
    except Exception as error:
        raise ToolError(f"The tool categories could not be read: {error}") from error

    return [{"category": r["category"], "count": r["n"]} for r in rows]


def get_tool(name: str) -> Dict[str, Any]:
    """One tool, body included. Raises when the name is not in the table."""
    try:
        with _pool().get_connection() as conn:
            cur = conn.cursor()
            cur.execute(
                "SELECT name, summary, body, category, sections, kind, source "
                "FROM tools WHERE name = %s",
                (name,),
            )
            row = cur.fetchone()
            cur.close()
    except Exception as error:
        raise ToolError(f"The tool could not be read: {error}") from error

    if row is None:
        raise ToolError(
            f"No tool called {name!r}. "
            f"{len(list_tools())} tools exist; call the list to see them."
        )

    return _row_to_tool(row, with_body=True)


def render_tools_block() -> str:
    """The list a prompt carries: names and one line each, never bodies.

    Empty when the table has nothing, because a prompt that announces the
    absence of something teaches the model to look for it.
    """
    try:
        tools = list_tools()
    except ToolError:
        # A prompt is never blocked by the tool list being unreadable. The
        # assembly continues without it and the failure is visible on the
        # screen that reads the table, not silently on every call.
        return ""

    if not tools:
        return ""

    lines = ["<tools>"]
    for tool in tools:
        lines.append(f"{tool['name']} — {tool['summary']}")
    lines.append("</tools>")
    return "\n".join(lines)
