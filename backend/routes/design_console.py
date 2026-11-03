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
tree is gated against the one catalogue.

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
from deps import A2UI_CATALOG_ID, a2ui_catalog_for, validate_a2ui_components
from grace_gui import LAST_USAGE, query_llm
from prompt_sessions_api import DESIGN_SYSTEM_DESCRIPTION
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
DESIGN_CONSOLE_TABS = "chat,tools,executions,ux,approvals,settings"

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
    gates it (the official catalogue) — the console's own generator, copied and pointed at this
    room's catalogue. Derived, never hand-typed: the prompt and the validator cannot disagree."""
    components = (a2ui_catalog_for("prompt-composer") or {}).get("components") or {}
    if not components:
        raise RuntimeError(
            "the catalogue is empty — refusing to assemble a prompt with no "
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

    # THE CHAT TAB'S OWN PACKAGE — created by the one writer every conversation tab uses, so a
    # missing row is repaired here rather than silently falling back to the Design container.
    # The fallback was the old shape: a conversation keyed by a tab name on the container's own
    # row. The console now reads the Chat package's conversation and nothing else.
    try:
        design_chat_tab = state.prompt_sessions_api.get_or_create_design_tab(
            user_id=x_user_id, tab="chat"
        )
    except Exception as e:  # noqa: BLE001 — a failure to resolve is stated with its cause
        raise HTTPException(
            status_code=503,
            detail=f"DESIGN CONSOLE FAILURE: the Chat tab's package could not be resolved — {e}",
        ) from e
    if not design_chat_tab:
        raise HTTPException(
            status_code=503,
            detail="DESIGN CONSOLE FAILURE: the Chat tab's package did not resolve (not created).",
        )
    design_packages["chat"] = {
        "packageId": design_chat_tab["packageId"],
        "conversationId": design_chat_tab["conversationId"],
    }

    # ── THE CONSOLE TAB IS A TAB, AND A TAB IS A PACKAGE ────────────────────────────────────────
    #
    # Owner, 2026-11-02: *"The console for design should have its own package just like the global
    # console with a conversation tied to it — currently it says zero conversations and she's
    # speaking… this is the foundational structure and architecture of the application: it's
    # database-tied… two hollow empty containers injected with information from a database."*
    #
    # HE WAS RIGHT, AND THE DEFECT WAS MEASURABLE. The seat read the CHAT tab's conversation while
    # the list read the Design CONTAINER's row — one package answering for another, and a list that
    # could never show what the seat was showing, because the container owns no conversations.
    # `design_tab | console` already existed and was used by nothing.
    try:
        design_console_tab = state.prompt_sessions_api.get_or_create_design_tab(
            user_id=x_user_id, tab="console"
        )
    except Exception as e:  # noqa: BLE001 — a failure to resolve is stated with its cause
        raise HTTPException(
            status_code=503,
            detail=f"DESIGN CONSOLE FAILURE: the Console tab's package could not be resolved — {e}",
        ) from e
    if not design_console_tab:
        raise HTTPException(
            status_code=503,
            detail="DESIGN CONSOLE FAILURE: the Console tab's package did not resolve (not created).",
        )
    design_packages["console"] = {
        "packageId": design_console_tab["packageId"],
        "conversationId": design_console_tab["conversationId"],
    }

    # ── THE DESIGN SYSTEMS ARE ROWS, AND THEIR CARDS ARE READ LIKE EVERY OTHER CARD ────────────
    #
    # One row per design system per person: `metadata.session_type = 'design_catalogue'` with
    # `metadata.design_system = <id>`, and the partial unique index in `init_db.py` holds the rule.
    # They are created on first landing by the same get-or-create every other level uses, so the
    # console and any later screen read one row and never two. The two names are the two catalogues
    # this application actually carries (`frontend/src/components/A2UI/catalogs/`): Carbon, and the
    # Raibach Prompt Composer catalogue, which is this room's own elements.
    design_systems: list[tuple[str, dict[str, Any]]] = []
    # THE CARD SAYS WHAT THE SYSTEM IS (owner, 2026-11-02): the sentence is written once, in
    # `prompt_sessions_api.DESIGN_SYSTEM_DESCRIPTION`, and the assembly writes the same one on
    # first use — so the card and the row cannot say different things.
    _system_sentence = DESIGN_SYSTEM_DESCRIPTION
    for _system_id, _system_title, _system_description in (
        ("carbon", "Carbon", _system_sentence),
        ("prompt-composer", "Raibach Prompt Composer", _system_sentence),
    ):
        _row = state.prompt_sessions_api.get_or_create_design_container(
            user_id=x_user_id,
            kind="design_catalogue",
            title=_system_title,
            description=_system_description,
            keys={"design_system": _system_id},
        )
        # ONLY WHEN IT DIFFERS, so a console load writes nothing and the row stays the record.
        if _row and str(_row.get("description") or "") != _system_description:
            try:
                state.prompt_sessions_api.set_session_description(
                    str(_row.get("id") or ""), _system_description
                )
                _row = {**_row, "description": _system_description}
            except Exception as e:  # noqa: BLE001 — stated, never hidden
                print(f"[Design Console] the system card's description was not written: {e}")
        if _row:
            design_systems.append((_system_id, _row))

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

                # ── THE KEPT VISITS: ONE CARD PER SAVED SESSION, NEWEST FIRST ─────────────────────
                # A session is a visit to Tools that the person kept. It is a prompt session row and
                # its card is read here the same way the element cards are — no second table and no
                # second list, because a session that appeared in one console and not another would
                # be two answers to "what am I working on".
                cur.execute(
                    """
                    SELECT id::text AS id, title, description, is_archived, metadata,
                           created_at, last_accessed_at, updated_at
                      FROM prompt_sessions
                     WHERE user_id = %s
                       AND metadata->>'session_type' = 'design_session'
                       AND is_archived IS NOT TRUE
                     ORDER BY updated_at DESC
                    """,
                    (x_user_id,),
                )
                session_rows = cur.fetchall()

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

    # ── THE CONVERSATIONS THAT HANG OFF THE CONSOLE TAB'S OWN PACKAGE — the seat's dropdown ────
    # Read from the CONSOLE package, which is the package the seat is bound to. `updated_at DESC`
    # is the list's own order, so the first entry is the last modified thread — the one that opens.
    # A package with no thread gets one here, because a console with nowhere to write is not a
    # console, and because a seat that shows a message over a list claiming zero conversations is
    # the contradiction the owner reported.
    design_conversations: list[dict[str, Any]] = []
    if state.conversation_api:
        try:
            design_conversations = state.conversation_api.get_conversations_by_session(
                design_console_tab["packageId"], x_user_id
            )
        except Exception as e:
            print(
                f"[Design Console] the conversation list could not be read, so the seat has none "
                f"to offer: {e}"
            )
        if not design_conversations:
            try:
                state.conversation_api.create_conversation(
                    user_id=x_user_id,
                    title="Design console",
                    session_id=design_console_tab["packageId"],
                    tab="design",
                )
                design_conversations = state.conversation_api.get_conversations_by_session(
                    design_console_tab["packageId"], x_user_id
                )
            except Exception as e:  # noqa: BLE001 — stated, never silent
                print(f"[Design Console] the console's conversation was not created: {e}")

    # ── A CONVERSATION A PERSON USED IS FINISHED; THE NEXT PRESS OPENS A NEW ONE ───────────────
    #
    # Owner, 2026-11-02: *"when I click on design console that's a session … it doesn't hold anything
    # unless there's a change"*, and on a console conversation that was used: *"it gets saved as
    # part of the Console package and now the Console has a new conversation in it until it's
    # removed."*
    #
    # So the default conversation is REUSED while it holds nothing the person said — pressing Design
    # twice with no work does not pile up empty rows — and once it holds a person's turn it stays in
    # the list, where it can be reopened or removed, and a new empty one becomes the thread that
    # opens. Her greeting alone does not count: the app asked for it, nobody typed.
    if state.conversation_api and design_conversations:
        newest_id = str(design_conversations[0].get("id") or "")
        used = False
        if newest_id:
            try:
                thread = state.conversation_api.get_messages(newest_id, x_user_id)
                used = any(str(m.get("role") or "") == "user" for m in (thread or []))
            except Exception as e:  # noqa: BLE001 — an unread thread is kept, not rotated
                print(
                    "[Design Console] the open conversation could not be read, so it is kept as "
                    f"the one that opens: {e}"
                )
        if used:
            try:
                fresh = state.conversation_api.create_conversation(
                    user_id=x_user_id,
                    title="Design console",
                    session_id=design_console_tab["packageId"],
                    tab="design",
                )
                if fresh:
                    state.prompt_sessions_api.update_session(
                        user_id=x_user_id,
                        session_id=design_console_tab["packageId"],
                        conversation_id=str(fresh),
                    )
                design_conversations = state.conversation_api.get_conversations_by_session(
                    design_console_tab["packageId"], x_user_id
                )
            except Exception as e:  # noqa: BLE001 — stated; the used thread stays open
                print(f"[Design Console] a new console conversation could not be started: {e}")

    console_conversation = str((design_conversations[0] if design_conversations else {}).get("id") or "")


    def _design_card(
        *,
        card_id: str,
        element_key: str,
        title: str,
        description: str,
        status: str,
        created_at: Any,
        last_used: Any,
    ) -> dict[str, Any]:
        """One card in this console's shape. The grid reads these fields and nothing else."""
        return {
            "id": card_id,
            "element_key": element_key,
            "title": title,
            "description": description,
            "status": status,
            "category": DESIGN_CONSOLE_CATEGORY,
            # THE CARD'S AREA (owner, 2026-10-27): every card this console lists is the design
            # seat's, so it wears the design seat's mark.
            "seat": "design",
            "category_color": cat.get("color") or "",
            "category_title_color": cat.get("title_color") or "",
            "category_text_color": cat.get("text_color") or "",
            "version": 1,
            "likes": 0,
            "model_name": "",
            "team_name": "",
            "avatar_url": "",
            "username": "",
            "createdAt": created_at.isoformat() if created_at else "",
            "lastUsed": last_used.isoformat() if last_used else "",
            "message_count": 0,
        }

    cards: list[dict[str, Any]] = []

    # ── THE DESIGN SYSTEMS FIRST, THEN THE SESSIONS, THEN THE ELEMENTS ──────────────────────────
    #
    # Owner, 2026-10-31: the two design systems stand as cards of their own; a session is a card
    # once it is kept. The order is the plan's own: the systems are what the room works in, a
    # session is what a visit produced, and the elements are the catalogue's contents.
    for _system_id, _system_row in design_systems:
        cards.append(
            _design_card(
                card_id=str(_system_row.get("id") or ""),
                element_key=f"system:{_system_id}",
                title=(_system_row.get("title") or _system_id).strip(),
                description=(_system_row.get("description") or "").strip(),
                status="catalogue",
                created_at=_system_row.get("created_at"),
                last_used=_system_row.get("created_at"),
            )
        )

    for _row in session_rows:
        _meta = _row.get("metadata") or {}
        if isinstance(_meta, str):
            _meta = json.loads(_meta) if _meta.strip() else {}
        _kept = str(_meta.get("kept_at") or "")
        cards.append(
            _design_card(
                card_id=str(_row.get("id") or ""),
                element_key="",
                # A SESSION IS NEVER WITHOUT A NAME ON SCREEN: an untitled one is drawn as
                # Untitled, which is a true statement about it rather than a blank card.
                title=(_row.get("title") or "").strip() or "Untitled",
                description=(_row.get("description") or "").strip(),
                status="saved" if _kept else "open",
                created_at=_row.get("created_at"),
                last_used=_row.get("updated_at") or _row.get("last_accessed_at"),
            )
        )

    # ── NO CARD FOR A CATALOGUE ELEMENT ────────────────────────────────────────────────────────
    # Owner, 2026-11-02: *"each of those cards represents a package with its own conversation…
    # We can get rid of the other cards for design because they're not tied to any database
    # structure they're just filler or stubs."*
    #
    # The cards above are PACKAGES: a design system's row and a kept session's row, each with its
    # own conversation. The cards that stood here were one per catalogue ELEMENT, generated from
    # the catalogue file by `sync_design_elements.py` — no package, no conversation, nothing a
    # person made. They are no longer drawn. Nothing is deleted: the `design_master` rows are
    # still in the database and the elements are still in the catalogue; they are simply not
    # cards, because a card is a package.

    # ── THE MODEL IS THE ARCHITECT — the console's own process, in this room's words ─────────
    # The cards are read above and ride in the data model; the model returns the TREE (the
    # console's shape: a card grid in the left slot, the seat in the right). A model that cannot
    # assemble is a 503 — no DB skip, no fallbacks, because a surface without its tree is a room
    # that looks assembled and is not.
    SAMPLE = 12
    cards_for_prompt = json.dumps(cards[:SAMPLE])
    llm_prompt = f"""You are Grace, the A2UI surface assembler for the design console.
{render_tools_block()}

The user opened the design console. There are {len(cards)} cards: the design systems and the
sessions kept under them, each its own package with its own conversation. The first
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
1. id "root", component "design-workspace" — the Design room's own frame. Its
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
    {{"id": "root", "component": "design-workspace", "isThirdOpen": false, "children": {{"left": "card-grid", "right": "design-console-chat"}}}},
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
        # `chat-panel` is the seat name the catalogue gates; the room's
        # element tag is `design-chat`, and `design-chat-panel` is in NO catalogue — emitting
        # it failed this route's own validator (measured 2026-10-19: the door answered 503,
        # "Component 'design-chat-panel' is not in the trusted catalog (Design Artifacts)").
        # The CLIENT maps both names to the room's own <design-chat> element
        # (DesignSeatShell.asDesignChat), so the borrowed seat still cannot be installed from
        # the tree. Normalize the other direction only: one trusted name in, one in the gate.
        for c in components:
            if isinstance(c, dict) and c.get("component") == "design-chat-panel":
                c["component"] = "chat-panel"
        # THE CONSOLE HAS NO COLUMN FOOTER. Owner, 2026-10-25: the footer is *"a footer for
        # tools … that does not show on the console"*, and the controls are *"only served in to
        # tools"*. The plate is the TOOLS container's control, named where that container is
        # composed; this surface carries none — not even one the model named. It is REMOVED, not
        # ignored: leaving the root pointing at it would be a reference to something not sent.
        _footers = {
            _c.get("id")
            for _c in components
            if isinstance(_c, dict)
            and (_c.get("component") == "design-left-footer" or _c.get("id") == "left-footer")
        }
        if _footers:
            components = [
                _c for _c in components
                if not (isinstance(_c, dict) and _c.get("id") in _footers)
            ]
            for _c in components:
                if isinstance(_c, dict) and _c.get("id") == "root":
                    _kids = _c.get("children") if isinstance(_c.get("children"), dict) else {}
                    _kids.pop("left-footer", None)
                    _c["children"] = _kids
                    break
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
    validate_a2ui_components(components)

    elapsed_ms = int((time.perf_counter() - started) * 1000)
    print(f"[PERF TRACE] POST /api/design/console | total={elapsed_ms}ms")

    return [
        {
            "version": "v0.9.1",
            "createSurface": {
                "surfaceId": "main",
                "catalogId": A2UI_CATALOG_ID,
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
                    # seat binds to. The session is the CONSOLE TAB'S PACKAGE, which is where its
                    # conversation lives; the conversation is that package's last modified thread.
                    "console": {
                        "session_id": design_console_tab["packageId"],
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


@router.post("/api/design/apply-carbon")
async def apply_carbon(x_user_id: str | None = Header(None, alias="X-User-ID")):
    """THE DESIGNER'S OWN BUTTON (2026-10-25): applies Carbon as a dedicated design system and
    IBM Plex as the application's face, by running the repository's own script
    (`frontend/scripts/apply-carbon-system.mjs`). The script is idempotent — a second run
    writes nothing that already stands. The button in the Design seat calls this door; nothing
    here changes any room's running surface by itself."""
    import subprocess

    try:
        repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        frontend_dir = os.path.join(repo_root, "frontend")
        proc = subprocess.run(
            ["node", "scripts/apply-carbon-system.mjs"],
            cwd=frontend_dir,
            capture_output=True,
            text=True,
            timeout=600,
        )
        stdout_tail = "\n".join((proc.stdout or "").strip().splitlines()[-60:])
        if proc.returncode != 0:
            detail = (proc.stderr or stdout_tail or "no output").strip()[-800:]
            raise HTTPException(status_code=500, detail=f"apply-carbon failed ({proc.returncode}): {detail}")
        return {"ok": True, "output": stdout_tail}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"apply-carbon could not run: {e}")
