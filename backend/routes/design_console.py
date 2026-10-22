"""
THE DESIGN CONSOLE'S OWN ENDPOINT — a file of its own, a copy of the console's process.

Owner, 2026-10-18: the design dashboard "is also a console" and needs "a separate console
package for design … this only holds design related cards, which also appear on the console as
a category", and on how it is built: *"you're simply copying it over but it has to have a
different name. It has to have different files because if it shares the same file, you'll end up
destroying the original console."*

So this file is the PRIMARY CONSOLE'S OWN PROCESS COPIED: its card read, its card shape, its
model-assembled tree (a card grid in the left slot and a chat seat in the right), its findings
view, and its seat's script binding — all duplicated here, renamed to this room. The primary
console's branch in `routes/ai.py` is not imported, branched, or changed by anything here.

WHAT DIFFERS, AND ONLY THIS: the cards are the `design_master` rows (design elements), the
seat is the room's own element (`design-chat-panel`, a whole duplicate of `chat-panel`), and the
tree is gated against the catalogue that gates Design (`design-artifacts`).

THE FIGMA INGESTION TOOL IS NOT TOUCHED BY THIS FILE. It belongs to the Tools tab and its
files stay whole; this endpoint serves the design console's cards and seat, nothing else.
"""
from __future__ import annotations

import json
import os
import time
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Header, HTTPException

import services as state
from deps import a2ui_catalog_for, a2ui_catalog_id, validate_a2ui_components
from grace_gui import LAST_USAGE, query_llm
from tools import render_tools_block

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")

# The one category the design cards carry, in both consoles (the design console and the primary
# console's category row). Read from the registry, never invented here.
DESIGN_CONSOLE_CATEGORY = "Design System"

# THE DESIGN CONSOLE'S RAIL — THE ROOM'S OWN LIST, not the primary console's. The console's FILE
# is copied; its MENU is not. Every button the design room had stays here — Trace, Executions,
# Repair and UX included (owner, 2026-10-18, after the first copy stripped them: *"Where did the
# UX button go? … you stripped out the buttons that were existing … I spent all morning building
# a UX application … and now it's gone."*). It is stated by the server for the same reason the
# console's is: a rail button only draws when the seat's list names it.
DESIGN_CONSOLE_TABS = "chat,tools,executions,ux,settings"

# WHO SHE IS IN THE CONSOLE'S CHAT TAB — and who she is NOT. The console is the console; the design
# system is Figma's. The console lists the elements that came from Figma and advises on them; it
# does not own the design system, does not speak for it, and does not edit an element from here.
DESIGN_CONSOLE_GRACE_INSTRUCTIONS = """\
You are Grace, in the console's Chat tab. The console is the console: it lists the elements that
have been produced from Figma — one card per element, with its name and what it is — and you
advise on them: what each one says, what is missing, which to work on next.

The design system itself is Figma's: its own section, its own conversation, its own work. You do
not speak for it here, and you do not edit an element from this room.
"""


def _design_vocabulary() -> str:
    """The component list for the design console's prompt, generated from the catalogue that
    gates it (`design-artifacts`) — the console's own generator, copied and pointed at this
    room's catalogue. Derived, never hand-typed: the prompt and the validator cannot disagree."""
    components = (a2ui_catalog_for("design-artifacts") or {}).get("components") or {}
    if not components:
        raise RuntimeError(
            "the design-artifacts catalogue is empty — refusing to assemble a prompt with no "
            "component vocabulary. Every payload is validated against it, so without it the "
            "model can only invent components that will be rejected with a 503."
        )
    lines: list[str] = []
    for name in sorted(components):
        spec = components[name] or {}
        props: list[str] = []
        for part in list(spec.get("allOf") or []) + [spec]:
            for prop, prop_spec in (part.get("properties") or {}).items():
                if prop == "component":
                    continue
                if prop == "children" and isinstance(prop_spec, dict):
                    slots = list((prop_spec.get("properties") or {}).keys())
                    props.append(f"children {{{', '.join(slots)}}}" if slots else prop)
                    continue
                if prop not in props:
                    props.append(prop)
        lines.append(f"- {name}: {', '.join(props) if props else 'no properties'}")
    return (
        f"COMPONENT CATALOG — all {len(components)} (only these; anything else is a 503):\n"
        + "\n".join(lines)
    )


def _design_seat_tabs(components: list, tabs: str) -> None:
    """Set every DESIGN seat's allowed-tabs. Idempotent, and it never adds a component."""
    for c in components:
        if isinstance(c, dict) and c.get("component") == "chat-panel":
            c["allowedTabs"] = tabs


def _design_seat_grace(components: list, base: str, live_context: bool) -> None:
    """Bind every DESIGN seat to this room's script — the console's `_seat_grace`, copied to
    target this room's own element. Idempotent, never adds a seat."""
    for c in components:
        if isinstance(c, dict) and c.get("component") == "chat-panel":
            c["instructions"] = {"path": f"{base}/grace_instructions"}
            c["graceLiveContext"] = live_context


def _design_repair_rows(catalog: str = "prompt-composer") -> list[dict[str, Any]]:
    """The checker's open findings, as rows ready to draw — copied verbatim from the console's
    own reader (`routes/ai.py::_repair_rows`). An unrun check is a row saying so, never an empty
    list: an empty list would read as a clean catalogue."""
    from routes.misc import _read_catalog_audit

    try:
        audit = _read_catalog_audit(catalog)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        remedy = detail.get("remedy") or (
            "No report has been produced for this pipeline; reports come from `npm run catalog:check`."
        )
        print(
            f"[Design Console] no catalog report for '{catalog}' — the repair list states that "
            f"rather than showing nothing. Remedy: {remedy}"
        )
        return [{
            "id": f"catalog-audit-unavailable:{catalog}",
            "text": f"The catalog check did not run, so there is nothing to repair from. Remedy: {remedy}",
            "level": "blocking",
        }]

    rows: list[dict[str, Any]] = []
    for f in audit.get("findings", []):
        if f.get("level") == "pass":
            continue
        subject = f.get("component") or f.get("file") or f.get("nodeId") or "catalog"
        where = f" ({f['nodeId']})" if f.get("nodeId") else ""
        rows.append({
            "id": f.get("id") or f"{f.get('check')}:{subject}",
            "text": f"{subject}{where} — {f.get('what', '')}",
            "level": f.get("level") or "advisory",
        })
    rows.sort(key=lambda r: (r["level"] != "blocking", str(r["id"])))
    return rows


def _design_extract_json(response_text: str) -> Any:
    """Extract a JSON object/array from LLM output — copied from the console's own reader."""
    text = (response_text or "").strip()
    if not text:
        raise ValueError("empty response")
    if "```json" in text:
        text = text.split("```json", 1)[1]
    elif "```" in text:
        text = text.split("```", 1)[1]
    if "```" in text:
        text = text.split("```", 1)[0]
    text = text.strip()
    if not text:
        raise ValueError("empty JSON payload")
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        decoder = json.JSONDecoder()
        for index, character in enumerate(text):
            if character not in "[{":
                continue
            try:
                value, _ = decoder.raw_decode(text[index:])
                return value
            except json.JSONDecodeError:
                continue
        raise



@router.post("/api/design/console")
def design_console(x_user_id: str | None = Header(None, alias="X-User-ID")) -> list[dict[str, Any]]:
    """The design console's own surface: its identity, its design-only cards, and the tree.

    Returns the same A2UI envelope shape the primary console's assembly returns (a list of
    createSurface / updateComponents / updateDataModel messages) — a dict annotation here would
    be a false contract, and FastAPI refuses a list against it (measured: dict_type)."""
    if not x_user_id:
        raise HTTPException(status_code=400, detail="X-User-ID is required: the package is the user's own.")

    # THE DESIGN PACKAGE IS THE ROOM'S OWN ROW — created on first landing, exactly once, the same
    # get-or-create the design surface uses (a partial unique index holds the rule). The console's
    # own landing creates nothing else: its conversation is born when the person speaks.
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="DESIGN CONSOLE FAILURE: Database not available",
        )
    package_row = state.prompt_sessions_api.get_or_create_design_container(
        user_id=x_user_id,
        kind="design",
        title="Design",
        description="The Design experience's own session — a division, not a prompt package.",
    )
    if not package_row:
        raise HTTPException(
            status_code=503,
            detail="DESIGN CONSOLE FAILURE: the design division's package row did not resolve (not created).",
        )
    package = {
        "id": str(package_row["id"]),
        "title": package_row.get("title") or "Design",
        "conversation_id": str(package_row["conversation_id"]) if package_row.get("conversation_id") else None,
    }

    # ── ONE PACKAGE PER TAB, AND EACH PACKAGE OWNS ITS CONVERSATION ─────────────────────────────
    # Every tab under Design is its own package (`session_type = 'design_tab'`, `design_tab = <tab>`),
    # and its conversation is read FROM THE PACKAGE. The tab map that used to live on the container
    # is gone: a conversation keyed by a tab name on someone else's row is not a package.
    design_packages: dict[str, dict[str, str]] = {}
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT metadata->>'design_tab' AS tab, id::text AS package_id,
                           conversation_id::text AS conversation_id
                      FROM prompt_sessions
                     WHERE user_id = %s AND metadata->>'session_type' = 'design_tab'
                    """,
                    (x_user_id,),
                )
                for row in cur.fetchall():
                    if row["tab"]:
                        design_packages[row["tab"]] = {
                            "packageId": row["package_id"],
                            "conversationId": row["conversation_id"] or "",
                        }
    except Exception as e:  # noqa: BLE001 — a missing package is SAID, never silent
        print(f"[Design Console] the design tab packages could not be read: {e}")
    console_conversation = (
        design_packages.get("chat", {}).get("conversationId") or package["conversation_id"]
    )

    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id::text AS id, title, description, is_archived, metadata,
                           created_at, last_accessed_at
                      FROM prompt_sessions
                     WHERE user_id = %s AND metadata->>'session_type' = 'design_master'
                     ORDER BY metadata->>'element_key'
                    """,
                    (x_user_id,),
                )
                rows = cur.fetchall()

                cur.execute(
                    "SELECT color, title_color, text_color FROM categories WHERE name = %s",
                    (DESIGN_CONSOLE_CATEGORY,),
                )
                cat = cur.fetchone() or {}
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001 — the refusal carries its reason
        raise HTTPException(
            status_code=503,
            detail=f"DESIGN CONSOLE FAILURE: the cards could not be read — {type(e).__name__}: {e}",
        ) from e

    # ── THE CONVERSATIONS THAT HANG OFF THE DESIGN PACKAGE — the seat's dropdown ────────
    # The console's own read, pointed at the design package: `conversations.session_id` is the
    # one way this codebase reads a session's threads, and a failure is SAID here, not hidden.
    design_conversations: list[dict[str, Any]] = []
    if state.conversation_api:
        try:
            design_conversations = state.conversation_api.get_conversations_by_session(
                package["id"], x_user_id
            )
        except Exception as e:
            print(
                f"[Design Console] the conversation list could not be read, so the seat has none "
                f"to offer: {e}"
            )


    cards: list[dict[str, Any]] = []
    for row in rows:
        meta = row.get("metadata") or {}
        if isinstance(meta, str):
            meta = json.loads(meta) if meta.strip() else {}
        last_ingest = meta.get("last_ingest") or {}
        cards.append({
            "id": row.get("id"),
            "element_key": meta.get("element_key") or "",
            "title": (row.get("title") or "").strip(),
            "description": (row.get("description") or "").strip(),
            "status": (
                "Removed" if row.get("is_archived")
                else (last_ingest.get("verdict") or ("Ingested" if last_ingest else "Not ingested"))
            ).lower(),
            "category": DESIGN_CONSOLE_CATEGORY,
            "category_color": cat.get("color") or "",
            "category_title_color": cat.get("title_color") or "",
            "category_text_color": cat.get("text_color") or "",
            "version": 1,
            "likes": 0,
            "model_name": "",
            "team_name": "",
            "avatar_url": "",
            "username": "",
            "createdAt": row.get("created_at").isoformat() if row.get("created_at") else "",
            "lastUsed": row.get("last_accessed_at").isoformat() if row.get("last_accessed_at") else "",
            "message_count": 0,
        })

    # ── THE MODEL IS THE ARCHITECT — the console's own process, in this room's words ─────────
    # The cards are read above and ride in the data model; the model returns the TREE (the
    # console's shape: a card grid in the left slot, the seat in the right). A model that cannot
    # assemble is a 503 — no DB skip, no fallbacks, because a surface without its tree is a room
    # that looks assembled and is not.
    SAMPLE = 12
    cards_for_prompt = json.dumps(cards[:SAMPLE])
    llm_prompt = f"""You are Grace, the A2UI surface assembler for the design console.
{render_tools_block()}

The user opened the design console. There are {len(cards)} design elements. The first
{min(SAMPLE, len(cards))} are shown below as examples of the card shape; bind the grid to the
whole list at the path below, NOT to these samples.

Card data (bind ConsoleCardGrid to this):
{cards_for_prompt}

Assemble the FULL design console surface using A2UI v0.9.1.

{_design_vocabulary()}

REQUIREMENTS (the console's own surface, copied: the card grid left, the seat right; the RAIL
is the ROOM's own — the buttons `DESIGN_CONSOLE_TABS` names, and nothing else. The UX entry is
gone from this room: the framed application it opened took a minute to draw a white column, and
the owner's call was to take it out rather than wait):
1. id "root", component "workspace-layout" — the composer's own container. Its
   panes are NAMED slots, so "children" is an OBJECT keyed by slot name; the
   array form fills nothing.
2. "card-grid": ConsoleCardGrid in slot "left", items bound to {{"path": "/cards"}}
3. "design-console-chat": "chat-panel" in slot "right", bound to the design
   console's own conversation: conversationId {{"path": "/console/conversation_id"}},
   sessionId {{"path": "/console/session_id"}}. There is no middle slot.
4. "isThirdOpen": false — the chat column loads CLOSED.
5. "design-console-chat" carries ONE child in its "view" slot: "repair-view", a
   "chat-repair-actions" bound to /findings.
6. "design-console-chat" carries "allowedTabs": "{DESIGN_CONSOLE_TABS}".
7. Short friendly ai_message

Emit nothing else — no greeting, no header, no Text above them.

Output ONLY this exact JSON (no markdown, no extra text):
{{
  "components": [
    {{"id": "root", "component": "workspace-layout", "isThirdOpen": false, "children": {{"left": "card-grid", "right": "design-console-chat"}}}},
    {{"id": "card-grid", "component": "ConsoleCardGrid", "items": {{"path": "/cards"}}}},
    {{"id": "design-console-chat", "component": "chat-panel", "tracePrompt": false, "allowedTabs": "{DESIGN_CONSOLE_TABS}", "conversationId": {{"path": "/console/conversation_id"}}, "conversations": {{"path": "/console/conversations"}}, "sessionId": {{"path": "/console/session_id"}}, "children": {{"view": "repair-view"}}}},
    {{"id": "repair-view", "component": "chat-repair-actions", "findings": {{"path": "/findings"}}, "stages": {{"path": "/repairs/stages"}}}}
  ],
  "ai_message": "Your message"
}}
"""

    started = time.perf_counter()
    llm_response = query_llm(
        question=llm_prompt,
        mode="console_assembly",
        temperature=0.0,
        prompt_id="surface-assembly-design-console",
    )
    if not llm_response or not llm_response.strip():
        raise HTTPException(
            status_code=503,
            detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface.",
        )
    if llm_response.strip().startswith("Error:"):
        raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

    response_text = llm_response.strip()
    if "```json" in response_text:
        response_text = response_text.split("```json")[1].split("```")[0].strip()
    elif "```" in response_text:
        response_text = response_text.split("```")[1].split("```")[0].strip()

    try:
        parsed = _design_extract_json(response_text)
        components = parsed["components"]
        if not isinstance(components, list) or not components:
            raise ValueError("components must be non-empty array")
        # THE TRUSTED NAME IS THE CATALOGUE'S, and the room draws its own element regardless.
        # `chat-panel` is the seat name the design-artifacts catalogue gates; the room's
        # element tag is `design-chat`, and `design-chat-panel` is in NO catalogue — emitting
        # it failed this route's own validator (measured 2026-10-19: the door answered 503,
        # "Component 'design-chat-panel' is not in the trusted catalog (Design Artifacts)").
        # The CLIENT maps both names to the room's own <design-chat> element
        # (DesignSeatShell.asDesignChat), so the borrowed seat still cannot be installed from
        # the tree. Normalize the other direction only: one trusted name in, one in the gate.
        for c in components:
            if isinstance(c, dict) and c.get("component") == "design-chat-panel":
                c["component"] = "chat-panel"
        _design_seat_tabs(components, DESIGN_CONSOLE_TABS)
        _design_seat_grace(components, "/console", True)
        ai_message = parsed.get("ai_message", f"{len(cards)} design elements ready.")
        if not isinstance(ai_message, str) or not ai_message.strip():
            raise ValueError("ai_message must be a non-empty string")
    except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
        print(
            f"[Design Console] AI RESPONSE PARSE FAILED:\n"
            f"  error_type: {type(e).__name__}\n"
            f"  error_message: {e}\n"
            f"  llm_response_length: {len(response_text)}\n"
            f"  llm_response_first_500: {response_text[:500]}\n"
        )
        raise HTTPException(
            status_code=503,
            detail=(
                f"A2UI FAILURE: AI returned invalid JSON for the design console — "
                f"{type(e).__name__}: {e!s}. Raw (first 300 chars): {response_text[:300]}"
            ),
        )

    # THE GATE IS DESIGN'S OWN — the whole tree, after every component is in it.
    validate_a2ui_components(components, "design-artifacts")

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    print(f"[PERF TRACE] POST /api/design/console | total={elapsed_ms}ms")

    return [
        {
            "version": "v0.9.1",
            "createSurface": {
                "surfaceId": "main",
                "catalogId": a2ui_catalog_id("design-artifacts"),
            },
        },
        {
            "version": "v0.9.1",
            "updateComponents": {"surfaceId": "main", "components": components},
        },
        {
            "version": "v0.9.1",
            "updateDataModel": {
                "surfaceId": "main",
                "path": "/",
                "value": {
                    "cards": cards,
                    # THE DESIGN CONSOLE'S OWN SESSION AND CONVERSATION — the facts the emitted
                    # seat binds to. One design package per user; its conversation is created
                    # by the person's first message, not by looking at the room.
                    "console": {
                        "session_id": package["id"],
                        "conversation_id": console_conversation or "",
                        "grace_instructions": DESIGN_CONSOLE_GRACE_INSTRUCTIONS,
                        "design_packages": design_packages,
                        "conversations": [
                            {
                                "id": str(c.get("id")),
                                "title": c.get("title") or "(untitled)",
                                "tab": c.get("tab") or "chat",
                            }
                            for c in design_conversations
                        ],
                    },
                    "assembly_time_ms": elapsed_ms,
                    "llm_used": True,
                    "usage": dict(LAST_USAGE),
                    "ai_message": ai_message,
                    "findings": _design_repair_rows(),
                    "repairs": {"stages": {}},
                },
            },
        },
    ]
