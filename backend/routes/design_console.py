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
from datetime import datetime
from typing import Any

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Header, HTTPException
from pydantic import BaseModel

import services as state
from card_lifecycle import LOCKED_STATES, CardState, card_state_of, is_card_locked, locked_state_message
from deps import A2UI_CATALOG_ID, a2ui_catalog_for, validate_a2ui_components
from grace_gui import LAST_USAGE, query_llm
from prompt_sessions_api import DESIGN_SYSTEM_DESCRIPTION
from tools import render_tools_block

router = APIRouter()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")

# The one category the design cards carry, in both consoles (the design console and the primary
# console's category row). Read from the registry, never invented here.
DESIGN_CONSOLE_CATEGORY = "Design System"

# ── THE CARD'S STATE IS THE RECORD'S OWN ───────────────────────────────────────────────────────
# The lifecycle is `card_lifecycle.CardState`: Open, Closed, Pending_Approval, Queued_For_Share.
# The review stage adds the words the footer shows for a completed card. The label and its colour
# travel with the state, so the card draws what the record says and the card element never learns
# a state's name. A state that carries no colour keeps the card's own resting treatment.
def _card_status(row: dict[str, Any], state: CardState | None) -> tuple[str, str]:
    """The footer's word and colour for a card's lifecycle and review stage."""
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta) if meta.strip() else {}
        except (json.JSONDecodeError, ValueError):
            meta = {}
    stage = str((meta if isinstance(meta, dict) else {}).get("review_stage") or "")
    if state == CardState.PENDING_APPROVAL:
        return "Pending Approval", "#8BE0A4"
    if state == CardState.QUEUED_FOR_SHARE:
        return "Queued for Share", "#8BE0A4"
    if stage == "approved":
        return "Approved", "#5FD688"
    if stage == "changes-requested":
        return "Changes Requested", "#8BE0A4"
    if state == CardState.OPEN:
        return "Open", ""
    if state == CardState.CLOSED:
        return "Closed", ""
    return str(row.get("status") or "Saved"), ""


def design_card(
    *,
    card_id: str,
    element_key: str,
    title: str,
    description: str,
    status: str,
    created_at: Any,
    last_used: Any,
    status_color: str = "",
    state: str = "",
    locked: bool = False,
    routing: dict[str, Any] | None = None,
    reviewer: str = "",
    category_color: str = "",
    category_title_color: str = "",
    category_text_color: str = "",
    surface: str = "",
) -> dict[str, Any]:
    """One card in the Design console's shape. THE ONLY BUILDER OF THIS SHAPE.

    The console's grid, the single-card read and the save's answer all call this one function, so
    a card cannot wear one state and one set of colours on the grid and another after a save. The
    card's state is the record's own; the colour travels with it, and the card knows no name for
    either. `state` is the lifecycle enum; `locked` is the state machine's own answer, so no
    surface has to re-derive whether a card may be changed.
    """
    return {
        "id": card_id,
        "element_key": element_key,
        "title": title,
        "description": description,
        # THE STATE, DRAWN IN THE FOOTER BESIDE THE VERSION. It is the record's own state;
        # `status_color` travels with it so the card is not asked to know what a state means.
        "status": status,
        "status_color": status_color,
        # THE LIFECYCLE, IN THE STATE MACHINE'S OWN WORD. `status` is the footer's label; this
        # is the exact state the console filters, the queues route on, and the lockout reads.
        "state": state,
        "locked": locked,
        "routing": routing or {},
        "reviewer": reviewer,
        # THE SEAT THE SESSION'S FUNCTION BELONGS TO. A kept UX visit is a design session like
        # the Tools visits, and its card must be able to say which tab reopens it. Empty for
        # every card that is not a kept session of a bespoke tab.
        "surface": surface,
        "category": DESIGN_CONSOLE_CATEGORY,
        # THE LABEL EVERY SURFACE SHOWS. The category above is the palette key; this is what
        # the card says, so the console and this room draw the same words over the same record.
        "headerLabel": "Design Tools",
        "subcategory": "Figma",
        # THE CARD'S AREA (owner, 2026-10-27): every card this console lists is the design
        # seat's, so it wears the design seat's mark.
        "seat": "design",
        "category_color": category_color,
        "category_title_color": category_title_color,
        "category_text_color": category_text_color,
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

# THE DESIGN CHAT TAB'S OWN WORDS — not the console's, and not the design system's. The Chat tab is
# the room's conversation: the person talks with Grace here about the design work and the cards the
# console lists. It answers in prose and asks for no surface command; the console's script belongs
# to the console's own seat.
DESIGN_CHAT_TAB_GRACE_INSTRUCTIONS = """\
You are Grace, in the Design room's Chat tab. This is the room's own conversation: the person
talks with you here about the design work and the cards on the left. Answer in prose, in the
person's own terms, and answer only what they asked. The cards and the packages are the room's;
speak about them from what they hold. Do not answer as the console operator, do not emit surface
commands, and do not invent actions.
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

    # ── THE TOOLS TAB IS A TAB TOO, AND IT IS RESOLVED HERE LIKE THE OTHER TWO ─────────────────
    #
    # The map above is read from whatever rows exist, so the Tools tab has no entry whenever its
    # row was a kept session (a save relabels it) or had been discarded. The snapshot is a READ
    # of the Tools tab's own session file — it never creates a visit, and a discarded visit is
    # absent, not hidden.
    from routes.tools_session import read_tools_working_session

    try:
        design_tools_tab = read_tools_working_session(x_user_id)
    except Exception as e:  # noqa: BLE001 — a failure to resolve is stated with its cause
        raise HTTPException(
            status_code=503,
            detail=f"DESIGN CONSOLE FAILURE: the Tools tab's package could not be resolved — {e}",
        ) from e
    if design_tools_tab:
        design_packages["tools"] = {
            "packageId": design_tools_tab["packageId"],
            "conversationId": design_tools_tab["conversationId"],
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
                     ORDER BY updated_at DESC NULLS LAST, created_at DESC
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
                    SELECT ps.id::text AS id, ps.title, ps.description, ps.status,
                           ps.is_archived, ps.metadata, ps.created_at, ps.last_accessed_at,
                           ps.updated_at
                      FROM prompt_sessions ps
                     WHERE (
                            ps.user_id = %s
                         OR EXISTS (
                                SELECT 1 FROM session_permissions sp
                                WHERE sp.session_id = ps.id AND sp.user_id = %s
                            )
                       )
                       AND (
                            ps.metadata->>'session_type' = 'design_session'
                         OR (
                                ps.metadata->>'session_type' = 'design_tab'
                            AND ps.metadata->>'design_tab' = 'tools'
                            )
                       )
                       AND ps.is_archived IS NOT TRUE
                     ORDER BY ps.updated_at DESC
                    """,
                    (x_user_id, x_user_id),
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


    def _design_card(**card: Any) -> dict[str, Any]:
        """The console's own call of the one card builder, with this console's category colours."""
        return design_card(
            **card,
            category_color=cat.get("color") or "",
            category_title_color=cat.get("title_color") or "",
            category_text_color=cat.get("text_color") or "",
        )

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
                # THE RECORD'S OWN STATE. "catalogue" described the card's kind, not its state,
                # and the footer is the state.
                status=str(_system_row.get("status") or "Active"),
                created_at=_system_row.get("created_at"),
                last_used=_system_row.get("created_at"),
            )
        )

    for _row in session_rows:
        _meta = _row.get("metadata") or {}
        if isinstance(_meta, str):
            _meta = json.loads(_meta) if _meta.strip() else {}
        _card_state = card_state_of(_row)
        # ── EVERY SAVED CARD IS DRAWN, INCLUDING ONE IN THE SUPERVISOR QUEUE ─────────────────────
        # A queued card is still the person's card. It is drawn here with its state and its lock,
        # so the work never vanishes from the room that made it; the lock, not the list, is what
        # stops it being changed. The queue read remains the supervisor's own view.
        _state_word, _state_color = _card_status(_row, _card_state)
        _routing = _meta.get("routing") if isinstance(_meta.get("routing"), dict) else {}
        cards.append(
            _design_card(
                card_id=str(_row.get("id") or ""),
                element_key="",
                # A SESSION IS NEVER WITHOUT A NAME ON SCREEN: an untitled one is drawn as
                # Untitled, which is a true statement about it rather than a blank card.
                title=(_row.get("title") or "").strip() or "Untitled",
                description=(_row.get("description") or "").strip(),
                status=_state_word,
                status_color=_state_color,
                state=_card_state.value if _card_state else "",
                locked=is_card_locked(_row),
                routing=_routing,
                reviewer=str(_meta.get("reviewer") or ""),
                created_at=_row.get("created_at"),
                last_used=_row.get("updated_at") or _row.get("last_accessed_at"),
                # WHICH TAB'S SESSION THIS CARD REOPENS. The save writes `surface: 'ux'`; every
                # other kept session has no surface and opens the Tools tab as before.
                surface=str(_meta.get("surface") or ""),
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
                        "chat_tab_grace_instructions": DESIGN_CHAT_TAB_GRACE_INSTRUCTIONS,
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


@router.get("/api/design/cards/{session_id}")
def design_card_read(
    session_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict[str, Any]:
    """ONE SAVED CARD, IN THE CONSOLE'S OWN SHAPE, READ BY ITS RECORD'S ID.

    The save's answer is not a second card shape. After a save the page asks this door for the
    card the console itself would draw, and places exactly that card; the browser invents no
    state and no colour. A row that is not this person's kept session is refused with the reason,
    because a working visit is not a card and must never be drawn as one.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=400, detail="X-User-ID is required: the card is the user's own."
        )
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503, detail="DESIGN CARD FAILURE: Database not available"
        )
    row = state.prompt_sessions_api.get_session(session_id=session_id, user_id=x_user_id)
    if not row:
        raise HTTPException(
            status_code=404,
            detail=f"No card {session_id} exists for this person.",
        )
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta) if meta.strip() else {}
        except (json.JSONDecodeError, ValueError):
            meta = {}
    if not isinstance(meta, dict):
        meta = {}
    if str(meta.get("session_type") or "") != "design_session":
        raise HTTPException(
            status_code=404,
            detail=(
                f"Session {session_id} is not a saved card; it is a working visit. "
                "A working visit is not drawn as a card."
            ),
        )
    # THE STATE IS THE RECORD'S OWN, exactly as the console's grid reads it. The read is also
    # how the save learns that the card it just wrote is now in the Supervisor Queue: `locked`
    # is the state machine's answer, not the save's assumption.
    card_state = card_state_of(row)
    state_word, state_color = _card_status(row, card_state)
    routing = meta.get("routing") if isinstance(meta.get("routing"), dict) else {}
    return {
        "card": design_card(
            card_id=str(row.get("id") or ""),
            element_key="",
            # A SESSION IS NEVER WITHOUT A NAME ON SCREEN: an untitled one is drawn as Untitled.
            title=(row.get("title") or "").strip() or "Untitled",
            description=(row.get("description") or "").strip(),
            status=state_word,
            status_color=state_color,
            state=card_state.value if card_state else "",
            locked=is_card_locked(row),
            routing=routing,
            reviewer=str(meta.get("reviewer") or ""),
            created_at=row.get("created_at"),
            last_used=row.get("updated_at") or row.get("last_accessed_at"),
            # THE SAVED CARD KEEPS THE TAB IT BELONGS TO. The console's grid and the single-card
            # read answer with the same field, so a save's own answer cannot route differently
            # from the card the next console load draws.
            surface=str(meta.get("surface") or ""),
            # THE CATEGORY'S COLOURS COME FROM THE RECORD'S OWN JOIN, not a second read.
            category_color=row.get("category_color") or "",
            category_title_color=row.get("category_title_color") or "",
            category_text_color=row.get("category_text_color") or "",
        )
    }


@router.get("/api/design/queue")
def design_queue(
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict[str, Any]:
    """THE SUPERVISOR QUEUE — the cards the designer's workspace must not draw.

    A card in Pending_Approval or Queued_For_Share is read here, and only here. The read is
    permission-aware the same way every other card read is: the owner, or a person holding a
    `session_permissions` row (the reviewer a card was addressed to). The row is not deactivated
    and nothing is purged; the queue is a routing fact, not a second copy of the card.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=400, detail="X-User-ID is required: the queue belongs to a person."
        )
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503, detail="DESIGN QUEUE FAILURE: Database not available"
        )
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("SET app.current_user_id = %s", (x_user_id,))
                cur.execute(
                    """
                    SELECT ps.id::text AS id, ps.title, ps.description, ps.status,
                           ps.is_archived, ps.metadata, ps.created_at, ps.last_accessed_at,
                           ps.updated_at, ps.user_id::text AS owner_id,
                           u.full_name AS owner_name, u.email AS owner_email
                      FROM prompt_sessions ps
                      LEFT JOIN users u ON u.id = ps.user_id
                     WHERE ps.metadata->>'session_type' = 'design_session'
                       AND ps.is_archived IS NOT TRUE
                       AND (
                            ps.user_id = %s
                         OR EXISTS (
                                SELECT 1 FROM session_permissions sp
                                WHERE sp.session_id = ps.id AND sp.user_id = %s
                            )
                       )
                     ORDER BY ps.updated_at DESC
                    """,
                    (x_user_id, x_user_id),
                )
                rows = cur.fetchall()
                cur.execute(
                    "SELECT color, title_color, text_color FROM categories WHERE name = %s",
                    (DESIGN_CONSOLE_CATEGORY,),
                )
                cat = cur.fetchone() or {}
    except Exception as e:  # noqa: BLE001 — the refusal carries its reason
        raise HTTPException(
            status_code=503,
            detail=f"DESIGN QUEUE FAILURE: the queue could not be read — {type(e).__name__}: {e}",
        ) from e

    cards: list[dict[str, Any]] = []
    for _row in rows:
        _meta = _row.get("metadata") or {}
        if isinstance(_meta, str):
            try:
                _meta = json.loads(_meta) if _meta.strip() else {}
            except (json.JSONDecodeError, ValueError):
                _meta = {}
        if not isinstance(_meta, dict):
            _meta = {}
        _card_state = card_state_of(_row)
        if _card_state not in LOCKED_STATES:
            continue
        _state_word, _state_color = _card_status(_row, _card_state)
        _routing = _meta.get("routing") if isinstance(_meta.get("routing"), dict) else {}
        _owner_id = str(_row.get("owner_id") or "")
        _card = design_card(
            card_id=str(_row.get("id") or ""),
            element_key="",
            title=(_row.get("title") or "").strip() or "Untitled",
            description=(_row.get("description") or "").strip(),
            status=_state_word,
            status_color=_state_color,
            state=_card_state.value,
            locked=True,
            routing=_routing,
            reviewer=str(_meta.get("reviewer") or ""),
            created_at=_row.get("created_at"),
            last_used=_row.get("updated_at") or _row.get("last_accessed_at"),
            surface=str(_meta.get("surface") or ""),
            category_color=cat.get("color") or "",
            category_title_color=cat.get("title_color") or "",
            category_text_color=cat.get("text_color") or "",
        )
        _card.update({
            "owner_id": _owner_id,
            "owner_name": str(_row.get("owner_name") or _row.get("owner_email") or ""),
            "permission": "owner" if _owner_id == x_user_id else "shared",
            "queue": "approval" if _card_state == CardState.PENDING_APPROVAL else "share",
        })
        cards.append(_card)
    return {"cards": cards, "count": len(cards)}


class CardQueueRequest(BaseModel):
    destination: str


@router.post("/api/design/sessions/{session_id}/queue")
def queue_design_session(
    session_id: str,
    body: CardQueueRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict[str, Any]:
    """ROUTE A CARD INTO THE APPROVAL OR SHARING QUEUE. NOTHING IS PURGED.

    The row keeps its conversation, its activity and its saved preview. What changes is its state
    and its routing mask: the card leaves the designer's workspace list and appears in the
    supervisor's queue. From that moment the state machine locks it for its owner.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=400, detail="X-User-ID is required: the card is the user's own."
        )
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503, detail="DESIGN QUEUE FAILURE: Database not available"
        )
    destination = str(body.destination or "").strip().lower()
    if destination not in ("approval", "share"):
        raise HTTPException(
            status_code=422, detail="destination must be 'approval' or 'share'."
        )
    row = state.prompt_sessions_api.get_session(session_id=session_id, user_id=x_user_id)
    if not row:
        raise HTTPException(
            status_code=404, detail=f"No session {session_id} exists for this person."
        )
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta) if meta.strip() else {}
        except (json.JSONDecodeError, ValueError):
            meta = {}
    if not isinstance(meta, dict):
        meta = {}
    kind = str(meta.get("session_type") or "")
    if kind != "design_session":
        raise HTTPException(
            status_code=409,
            detail=(
                f"Session {session_id} is a live Tools visit. A queue holds cards; "
                "close the visit before submitting it."
            ),
        )
    current_state = card_state_of(row)
    if current_state in LOCKED_STATES:
        raise HTTPException(status_code=409, detail=locked_state_message(current_state))
    if (
        destination == "approval"
        and str(meta.get("review_stage") or "") == "approved"
    ):
        raise HTTPException(
            status_code=409, detail="This card is already approved; it is not pending again."
        )

    routing = meta.get("routing") if isinstance(meta.get("routing"), dict) else {}
    routing = dict(routing)
    routing.update({
        "destination": destination,
        "approval": destination == "approval" or bool(routing.get("approval")),
        "share": destination == "share" or bool(routing.get("share")),
        "queued_at": datetime.now().isoformat(),
        "queued_by": x_user_id,
    })
    if destination == "approval":
        stage_metadata = {"review_stage": "in-review", "routing": routing}
        status_word = "Pending Approval"
        line = "Card submitted to the Supervisor Queue for approval."
        session_state = "pending_approval"
    else:
        stage_metadata = {"share_stage": "queued", "routing": routing}
        status_word = "Queued for Share"
        line = "Card queued for sharing. Its record is read-only until the share is answered."
        session_state = "queued_for_share"

    updated = state.prompt_sessions_api.update_session(
        user_id=x_user_id,
        session_id=session_id,
        status=status_word,
        metadata=stage_metadata,
    )
    if not updated:
        raise HTTPException(
            status_code=403,
            detail="This card could not be written by you, so the queue was not changed.",
        )

    conversation_id = str(row.get("conversation_id") or "")
    if state.conversation_api:
        try:
            if not conversation_id:
                conversations = state.conversation_api.get_conversations_by_session(
                    session_id, x_user_id
                )
                if conversations:
                    conversation_id = str(conversations[0].get("id") or "")
            if conversation_id:
                state.conversation_api.add_message(
                    conversation_id,
                    x_user_id,
                    "assistant",
                    line,
                    metadata={
                        "source": "host",
                        "session_state": session_state,
                        "at": datetime.now().isoformat(),
                    },
                    save_to_memory=False,
                )
        except Exception as e:  # noqa: BLE001 — stated, never hidden
            print(f"[design-queue] the queue line could not be written: {e}")

    new_state = card_state_of(updated or row)
    return {
        "action": "queued",
        "destination": destination,
        "state": new_state.value if new_state else "",
        "session": updated or row,
        "conversation_id": conversation_id,
    }


@router.post("/api/design/sessions/{session_id}/close")
def close_design_session(
    session_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict[str, Any]:
    """AN UNKEPT TOOLS VISIT IS DISCARDED — A CARD IS MADE BY THE SAVE, NOT BY LEAVING.

    Every leave used to turn the visit into a `design_session` titled "Design — Tools", so the
    console's dashboard accumulated one generic card per visit (owner, 2026-11-09: *"it keeps
    creating a design – tools card on the dashboard"*). A card is the person's explicit Save, and
    the seat does not call this route when the visit was kept (`keptThisVisitRef`). So a visit that
    reaches here was never kept: its row is removed, the row's FKs cascade its conversation and
    messages, and the next press of the tab resolves a fresh working row. The ingest activity rows
    are the ingest's own record, not a card, and they stay.
    """
    if not x_user_id:
        raise HTTPException(
            status_code=400, detail="X-User-ID is required: the session is the user's own."
        )
    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503, detail="DESIGN SESSION FAILURE: Database not available"
        )
    row = state.prompt_sessions_api.get_session(session_id=session_id, user_id=x_user_id)
    if not row:
        raise HTTPException(
            status_code=404, detail=f"No session {session_id} exists for this person."
        )
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta) if meta.strip() else {}
        except (json.JSONDecodeError, ValueError):
            meta = {}
    if not isinstance(meta, dict):
        meta = {}
    # THE VAULT LOCK. A card in a supervisor queue is not the designer's to close, edit or
    # re-enter. Its conversation and activity remain readable; its state does not change here.
    if is_card_locked(row):
        raise HTTPException(
            status_code=423, detail=locked_state_message(card_state_of(row))
        )
    kind = str(meta.get("session_type") or "")
    if kind == "design_session":
        # A CARD IS NOT CLOSED BY A VISIT'S LEAVE. Its record and activity stand as they are.
        return {
            "action": "kept",
            "session": row,
            "reason": "This session is already a card; leaving the visit does not change it.",
        }
    if kind != "design_tab" or str(meta.get("design_tab") or "") != "tools":
        raise HTTPException(
            status_code=404,
            detail=f"Session {session_id} is not a Tools visit, so it has no visit to close.",
        )

    # ── THE UNKEPT VISIT IS DISCARDED, NOT CARDED ────────────────────────────────────────────
    # The row is the visit; a card is the explicit Save. `keptThisVisitRef` in the seat already
    # keeps a saved visit from reaching this route, so reaching it means nothing was kept. The
    # delete cascades: conversations hang off `prompt_sessions.session_id` and messages off
    # `conversations.id`, both ON DELETE CASCADE (measured on this database).
    conversation_id = str(row.get("conversation_id") or "")
    if not conversation_id and state.conversation_api:
        try:
            conversations = state.conversation_api.get_conversations_by_session(
                session_id, x_user_id
            )
            if conversations:
                conversation_id = str(conversations[0].get("id") or "")
        except Exception as e:
            # A conversation that cannot be read does not block the discard; it is named.
            print(f"[design-close] the visit's conversation could not be read: {e}")

    deleted = state.prompt_sessions_api.delete_session(
        session_id=session_id, user_id=x_user_id, permanent=True
    )
    print(
        f"[design-close] the unkept Tools visit {session_id} "
        f"{'was discarded' if deleted else 'could NOT be discarded'}"
    )
    return {
        "action": "discarded" if deleted else "kept",
        "session_id": session_id,
        "conversation_id": conversation_id,
        "reason": (
            "Leaving without a save discards the visit; a card is made by Save."
            if deleted
            else "The visit could not be removed; its record stands."
        ),
    }


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
