"""Auto-extracted route module from main.py — zero behavior change."""
import asyncio
import json
import os
import sys
import time
import traceback
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, File, Header, HTTPException, Query, Request, UploadFile
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

import services as state
from deps import (
    DEFAULT_USER_ID, REASONING_TRACE_PATH, A2UI_CATALOG_ID,
    a2ui_catalog, validate_a2ui_components, user_is_admin,
    get_user_id_from_header,
)
from grace_gui import (
    evaluate_source, query_llm, retrieve_memory_context, search_news,
    summarize_pdfs, milvus_save_version, milvus_get_versions,
    LAST_USAGE,
)
from agent_rpc_handler import AgentRpcHandler
from milvus_rest import MilvusREST
from role_caps import get_filtered_manifest, get_user_role, get_role_capabilities
from tools import render_tools_block, get_tool, list_tools, categories, ToolError

router = APIRouter()

# The prompt block listing the tools is built by render_tools_block() at each
# assembly rather than cached here, so a tool added on screen is offered on the
# very next call instead of after a restart. If the table cannot be read the
# block is empty and the assembly continues — the failure shows on the tools
# screen, not on every prompt.


# ── THE MENU IS THE PLACE, AND THE SERVER WRITES IT ─────────────────────────────
#
# A rail's buttons say what THIS place has. A package offers its own tools, runs
# and evals; the console is the one global seat, and only it offers APPROVALS — the issues
# that span every package. The prompts ask the model for this list and the model drops it:
# measured 2026-09-18 in the running app, a fresh composer's rail drew all EIGHT buttons,
# including the console's Approvals.
#
# So the list is written HERE, onto the components the model returned — for the same reason
# the console's repair rows are composed here: a list like this is not something to be
# paraphrased by a model. The surfaces still decide; the model no longer does.
#
# 2026-09-18, the owner: "remove runs, evals, states and trace from the console chat vertical
# menu… add the repair dropdown and show all repairs." So the console's rail is this seat's
# own four — Chat, Evals, Tools, Approvals — plus REPAIRS, the one item only this seat can
# show: a finding belongs to the catalog, not to a package (the same reason Approvals is here
# and nowhere else). Trace, Runs and Evals leave this menu and stay where they mean something:
# a record of a RUN, which is a package's business.
PACKAGE_TABS = "chat,trace,tools,executions,eval,settings"
# REPAIRS LEFT THIS MENU on the owner's instruction, 2026-09-19: "remove the repairs from
# the tab — repairs live under the approvals." The findings VIEW still draws for the console
# (the repair-view below), but under Approvals, where a finding about the whole catalog
# belongs; the chat tab is the conversation and nothing else.
#
# `settings` joined both lists on the owner's instruction, 2026-09-19: "I'm missing my
# configuration icon." It was DRAWN but filtered out of every seat, because a rail tab only
# draws when the seat's list names it — the pinned foot button was in the rail's TABS and in
# no seat's menu, which is exactly the silent drop the rail's own note warns about ("a typo
# on the server is not an error anywhere — it is a button that quietly is not there"). The
# button is drawn unwired (see chat-navigation-bar: TODO(behavior), node 40001119:6600).
CONSOLE_TABS = "chat,eval,tools,approvals,settings"


def _seat_tabs(components: list, tabs: str) -> None:
    """Set every chat seat's allowed-tabs. Idempotent, and it never adds a component."""
    for c in components:
        if isinstance(c, dict) and c.get("component") == "chat-panel":
            c["allowedTabs"] = tabs


def _catalog_component_vocabulary() -> str:
    """The component list for a prompt, GENERATED from the catalog.

    Hand-typed lists drift, and this one had drifted badly: the prompts named
    three components while the catalog held thirty-five. The model was taught 8%
    of the design system and had no way to reach the rest — and because the same
    short list was maintained by hand in two separate prompts, it could only ever
    agree with the catalog by luck.

    Derived from the schema, the prompt and the validator cannot disagree: the
    model is never told about a component the server will reject, and never kept
    ignorant of one it will accept.

    Loud on an empty catalog rather than degrading to a shorter list. A prompt
    with no vocabulary invites invented components, and every invented component
    is a 503 at validation — a silent truncation here would turn a load failure
    into a stream of rejected surfaces.
    """
    components = (a2ui_catalog or {}).get("components") or {}
    if not components:
        raise RuntimeError(
            "A2UI catalog is empty — refusing to assemble a prompt with no component "
            "vocabulary. Every payload is validated against this catalog, so without it "
            "the model can only invent components that will be rejected with a 503."
        )

    lines: List[str] = []
    for name in sorted(components):
        spec = components[name] or {}
        props: List[str] = []
        # Properties live in the `allOf` branches (the component carries one or
        # more $refs), so walk those as well as the top level.
        for part in list(spec.get("allOf") or []) + [spec]:
            for prop, prop_spec in (part.get("properties") or {}).items():
                if prop == "component":
                    continue  # the discriminator, not an argument
                # A CONTAINER'S SLOTS COME FROM THE CATALOG TOO, and they did not until
                # 2026-09-23: the list named the `children` PROPERTY and nothing about the
                # slots inside it, so a prompt could only guess which names a container
                # fills by. The guess that was made — {flow, seat} for AgentCanvas, whose
                # element renders {header, flow, footer} and no seat at all — is the drift
                # the catalog check reported as blocking. The names are in the schema
                # (`children.properties`), so they are read from it here rather than
                # restated, and a container's slots can no longer be unknown to a prompt.
                if prop == "children" and isinstance(prop_spec, dict):
                    slots = list((prop_spec.get("properties") or {}).keys())
                    props.append(f"children {{{', '.join(slots)}}}" if slots else prop)
                    continue
                if prop not in props:
                    props.append(prop)
        lines.append(f"- {name}: {', '.join(props) if props else 'no properties'}")

    return f"COMPONENT CATALOG — all {len(components)} (only these; anything else is a 503):\n" + "\n".join(lines)

def _repair_rows(catalog: str = "prompt-composer") -> List[Dict[str, Any]]:
    """
    The checker's open findings, as rows that arrive READY TO DRAW.

    `text` and `level` are composed HERE — not by the model, and not by the element that
    draws them. A row is a statement about the catalog, and a view that re-words it is a
    second author of it; the two would disagree the moment either changed. The source is
    the report the checker already wrote (frontend/catalog-audit/<catalog>.json), read
    through GET /api/catalog/audit's own reader. Nothing is inferred, merged or summarised.

    AN UNRUN CHECK IS NOT AN EMPTY LIST. When there is no readable report this returns
    one row that says so, because an empty list is the claim that the checker found
    nothing open — and a checker that never ran must never read as a clean catalog. That
    rule is the checker's own (`check-could-not-run` is blocking there), and it holds here.
    """
    from routes.misc import _read_catalog_audit

    try:
        audit = _read_catalog_audit(catalog)
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {}
        remedy = detail.get("remedy") or "The catalog checker was removed from this project; no report is produced."
        print(
            f"[A2UI Console] no catalog report for '{catalog}' — the repair list states that "
            f"rather than showing nothing. Remedy: {remedy}"
        )
        return [{
            "id": f"catalog-audit-unavailable:{catalog}",
            "text": f"The catalog check did not run, so there is nothing to repair from. Remedy: {remedy}",
            "level": "blocking",
        }]

    rows: List[Dict[str, Any]] = []
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
    # Blocking first, then by id — the order the checker prints, so the list on screen
    # and the list in the report are read the same way.
    rows.sort(key=lambda r: (r["level"] != "blocking", str(r["id"])))
    return rows



def _extract_json_payload(response_text: str) -> Any:
    """Extract a JSON object/array from LLM output without relying on fenced-block parsing."""
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


# Warnings collected while a handler runs, drained into that handler's response. One
# process-wide list on purpose: this server is single-process and every handler drains
# what it collected; a warning that lands in another handler's response is still SAID,
# which is the property that matters (nothing here is dropped silently).
_REQUEST_WARNINGS: List[str] = []


def _warn(message: str) -> None:
    """A DEGRADED RUN SAYS SO — print AND carry, never just print.

    The owner, 2026-09-18: "I need to know when there's a fallback; I need to know when
    there's error suppression — we need to report it in the console trace." Every `except`
    in this file that used to end in a `print` now records the failure here, and the
    handler it belongs to drains the list into its response (`warnings`) or its assembled
    model (`/warnings`); the frontend writes those into the trace (lib/trace-source
    subscribes to the app logger). A `print` alone is a failure nobody is told about —
    check:error-suppression counts what still swallows.
    """
    print(f"⚠️  {message}")
    _REQUEST_WARNINGS.append(message)


def _drain_warnings() -> List[str]:
    """Hand the warnings collected during THIS handler to its response, and reset."""
    out = list(_REQUEST_WARNINGS)
    _REQUEST_WARNINGS.clear()
    return out


def _compose_sections(sections: List[Dict[str, Any]]) -> str:
    """Join a prompt's sections into one piece of text, in order, as written.

    This is what the output column holds when a Save carries no output at all:
    the sections themselves, labelled. It used to be whatever the save-time LLM
    wrote back inside its JSON envelope — a second, invented copy of text the row
    already had, and the field that pushed that reply past the token budget and
    left it unparseable (see the compile call in ai_save_surface).
    """
    parts: List[str] = []
    for s in sections or []:
        content = (s.get("content") or "").strip()
        if not content:
            continue
        name = s.get("section") or s.get("role") or "Section"
        parts.append(f"### {name}:\n{content}")
    return "\n\n".join(parts)


# ============================================
# AI MANIFEST ENDPOINT — P5 (2026-07-26)
# Serves the A2UI component catalog so the Python backend can inject it
# into the DeepSeek system prompt. Reads from frontend/dist/manifest.json.
# ============================================

@router.get("/api/ai/manifest")
async def ai_manifest(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    Serve the AI playground component manifest for system prompt injection.

    FILTERED BY ROLE: The manifest is filtered by the user's departmental role
    (users.prompt_role). The AI literally cannot emit tags that aren't in its
    system prompt — role filtering happens here, before the LLM is called.

    See backend/role_caps.py and frontend/src/shared/role-caps.ts for the
    role-to-capability matrix.
    """
    uid = get_user_id_from_header(x_user_id)
    role = get_user_role(uid)

    manifest_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist", "manifest.json")
    alt_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "src", "shared", "manifest.json")
    for path in [manifest_path, alt_path]:
        if os.path.exists(path):
            with open(path, "r") as f:
                full_manifest = json.load(f)
            filtered = get_filtered_manifest(uid, full_manifest)
            return {
                "manifest": filtered["manifest"],
                "source": path,
                "role": role,
                "tabs": filtered["tabs"],
                "can_author": filtered["can_author"],
                "tag_count": filtered["tag_count"],
            }
    # No manifest file — return role-filtered tag list from role_caps
    caps = get_role_capabilities(role)
    return {
        "manifest": {},
        "source": "not found (role-filtered)",
        "role": role,
        "tabs": caps.get("tabs", ["chat"]),
        "allowed_tags": caps.get("allowed_tags", []),
        "can_author": caps.get("can_author", False),
    }

class AISurfaceContext(BaseModel):
    """Context from the current document state."""
    current_surface: Optional[str] = None
    has_unsaved_changes: Optional[bool] = False
    session_id: Optional[str] = None
    session_title: Optional[str] = None
    # THE RUN'S OWN IDS — see the render-run branch. A Run does not replace the surface;
    # it moves the third column, so the assembly has to land on the components that are
    # on screen: the layout's root and its other slots, and the component the layout
    # currently points at for the middle. A field the model does not declare is dropped
    # in silence, which is why this is written here and not only sent by the shell.
    run: Optional[dict] = None


class AISurfaceRequest(BaseModel):
    """
    A2UI v0.9 Compliant Surface Assembly Request.

    Intents:
    - render-console: AI assembles console with cards
    - render-composer: AI assembles blank composer with greeting
    - render-session:{id}: AI assembles existing session
    - render-run[:{id}]: AI assembles the THIRD COLUMN a Run opens (the canvas)

    Context provides document state so AI can decide how to handle:
    - has_unsaved_changes: If true, AI should prompt user to save/discard
    """
    intent: str
    session_id: Optional[str] = None  # For render-session intent
    context: Optional[AISurfaceContext] = None  # Document state for AI decisions


@router.post("/api/ai/assemble-surface")
def ai_assemble_surface(
    request: AISurfaceRequest,
    # THE CEILING IS THE CONSOLE'S, NOT THE MODEL'S. It used to be 200 with a default of 10,
    # and the default was what a person actually got. The data model can carry a list this
    # size; the prompt no longer grows with it (see the console's sample).
    limit: int = Query(500, ge=1, le=1000),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    A2UI v0.9 Compliant Unified Surface Assembly.

    This is the SINGLE endpoint that controls ALL surface rendering.
    The AI is the Architect - it decides what to show.

    Response follows the A2UI v0.9 envelope structure — an array of
    protocol messages, each carrying exactly one operation key:
    [
        { "version": "v0.9.1", "createSurface": { "surfaceId": "main", "catalogId": "..." } },
        { "version": "v0.9.1", "updateComponents": { "surfaceId": "main", "components": [...] } },
        { "version": "v0.9.1", "updateDataModel": { "surfaceId": "main", "path": "/", "value": {...} } }
    ]
    """
    start_time = time.time()
    intent = request.intent
    context = request.context
    uid = get_user_id_from_header(x_user_id)

    # ═══════════════════════════════════════════════════════════════
    # A2UI v0.9: AI DECIDES HOW TO HANDLE UNSAVED CHANGES
    # If user is navigating away from composer with unsaved changes,
    # return a decision surface instead of the requested surface.
    # ═══════════════════════════════════════════════════════════════
    if context and context.has_unsaved_changes and context.current_surface == "composer":
        elapsed_ms = int((time.time() - start_time) * 1000)
        session_title = context.session_title or "Untitled"
        components = [
            {"id": "root", "component": "DecisionDialog", "children": ["message", "actions"]},
            {"id": "message", "component": "Text", "text": f"You have unsaved changes in \"{session_title}\"."},
            {"id": "actions", "component": "ActionGroup", "items": {"path": "/actions"}}
        ]
        validate_a2ui_components(components)
        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "decision_type": "unsaved_changes",
                        "session_id": context.session_id,
                        "session_title": session_title,
                        "pending_intent": intent,  # What user wanted to do
                        "actions": [
                            {"id": "save", "label": "Save Changes", "variant": "primary"},
                            {"id": "discard", "label": "Discard Changes", "variant": "destructive"},
                            {"id": "cancel", "label": "Cancel", "variant": "secondary"}
                        ],
                        "ai_message": f"Hold on — you have unsaved work in \"{session_title}\". What would you like me to do?",
                        "assembly_time_ms": elapsed_ms
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-console
    # ═══════════════════════════════════════════════════════════════
    if intent == "render-console":
        if not state.prompt_sessions_api:
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: Database not available",
            )

        # ── THE CONSOLE'S OWN SESSION ──────────────────────────────────────────
        # The console chat binds the console's conversation — the one dashboard
        # conversation per user, created on first landing and enforced by
        # idx_prompt_sessions_console_per_user. Same get-or-create the shell's
        # /api/prompt-sessions/console serves, so there is ONE row, not two.
        #
        # NO FALLBACK. A2UI's seat rule (Core-Concept.md) requires a surface seat to
        # carry a conversation id and session id that are present and non-null, so a
        # console assembled without them is a surface whose chat cannot bind —
        # complete-looking output with a required piece missing. That is a 503 here,
        # like every other missing precondition in this branch.
        console_session = state.prompt_sessions_api.get_or_create_console_session(user_id=uid)
        if not console_session:
            raise HTTPException(
                status_code=503,
                detail=(
                    "A2UI FAILURE: the console session did not resolve (not created). "
                    "The console chat binds its conversation, so the surface cannot be "
                    "assembled without it."
                ),
            )
        console_session_id = str(console_session["id"])
        # ── THE CONSOLE'S CONVERSATION IS THE ONE IT ALREADY HAS ────────────────
        #
        # This used to call `open_console_conversation` on every landing, which INSERTS a row ("a
        # landing STARTS A VISIT"). The owner, 2026-09-23, having watched the console's list fill up
        # with threads nobody wrote in: "there's 23 conversations saved. I can't remove any of them.
        # There should not be any conversation saved unless the user saves it just on the console.
        # Just stop the conversations on the console." And, on what starts one: "there is no
        # conversation new until the user engages. The AI is not the conversation — it's a human
        # being that initiates the conversation."
        #
        # The count was in the database: 23 chat rows under the console session, 18 of them with
        # ZERO messages — one per visit, each one a place his history was not.
        #
        # SO A LANDING CREATES NOTHING AT ALL. It binds the conversation the console already owns
        # (the session row's own pointer — the one the chat writes into), or NOTHING, and nothing is
        # a true state: the seat's greeting is never written down (a turn the app asks for never
        # creates a conversation — see `person_turn` in routes/teacher.py), and the first thing the
        # PERSON says is what creates one. That is why this branch no longer refuses to bind an
        # empty id: with no conversation there is nothing to read, which is exactly what an
        # untouched console is.
        console_conversation_id = str(console_session.get("conversation_id") or "")
        if not console_conversation_id:
            print(
                f"[A2UI Console] {console_session_id[:8]}… has no conversation yet — the surface "
                f"binds none. One is created when the person speaks, not by looking."
            )

        # ── THE TABS' OWN CONVERSATIONS — one per process, under the same session ──
        #
        # Approvals is a different process from the chat: it reads what the inspection filed
        # and continues that thread. It hangs off the SAME console session
        # (conversations.tab — the column the schema always had), so a person returning to
        # Approvals lands exactly where that process left off, and the chat never carries its
        # noise. Created here so the binding always resolves; a failure is said, not hidden.
        approvals_conversation_id = ""
        try:
            approvals_conversation_id = state.prompt_sessions_api.get_or_create_console_tab_conversation(
                uid, "approvals"
            ) or ""
        except Exception as e:
            _warn(f"the approvals conversation could not be opened, so that tab has no seat of its own yet: {e}")

        # ── THE CONSOLE'S CONVERSATIONS — the Conversations dropdown's rows here ──
        #
        # Same ownership read the composer's seat uses (`conversations.session_id`),
        # pointed at the console's own package. Without it the console seat's dropdown —
        # the only conversation-reading control on the surface a person lands on —
        # carried nothing, so the console's own conversation could not be opened from
        # anywhere in the app.
        console_conversations = []
        if state.conversation_api:
            try:
                console_conversations = state.conversation_api.get_conversations_by_session(
                    console_session_id, uid
                )
            except Exception as e:
                _warn(f"the console's conversation list could not be read, so the console seat has none to offer: {e}")

        # ── PERFORMANCE TRACE: Milestone A (Database) ──
        t_a_start = time.perf_counter()

        # Fetch the FULL prompt package (not lightweight) so each console card is
        # a true index of its entire prompt — sections, output, versions, chat.
        sessions = state.prompt_sessions_api.get_sessions(
            user_id=uid,
            include_archived=False,
            limit=limit,
            offset=0,
            lightweight=False,
            exclude_drafts=True,  # unsigned composer drafts never litter the console
        )
        ms_a = (time.perf_counter() - t_a_start) * 1000

        # Initial console paint is DB-authoritative and does not block on model
        # inference. The A2UI contract remains intact: the surface still binds a
        # ConsoleCardGrid to /cards, but the card data comes straight from
        # PostgreSQL instead of waiting on an expensive reasoning model.
        # A card is a faithful read of its row. The title and description on the
        # card are the title and description in PostgreSQL, byte for byte. This
        # branch used to rewrite the title when the stored one looked like a
        # placeholder, and to synthesise a description from the first 180 chars
        # of section 1 when the row had none. Both were inventions attributed to
        # the user's own package: a card could carry text that appeared nowhere in
        # the database, and a row with no description could not be told apart from
        # one whose description the assembler had made up. Removed — an empty
        # description now renders as empty.
        cards = []
        for session in sessions:
            title = (session.get("title") or "").strip()
            description = (session.get("description") or "").strip()

            cards.append({
                "id": str(session.get("id")),
                "title": title,
                "description": description,
                "category": session.get("category") or "",
                "status": (session.get("status") or "Active").lower(),
                "version": session.get("current_version") or 1,
                "likes": session.get("likes") or 0,
                "model_name": session.get("model_name") or "",
                "team_name": session.get("team_name") or "",
                "avatar_url": session.get("avatar_url") or "",
                "category_color": session.get("category_color") or "",
                "category_title_color": session.get("category_title_color") or "",
                "category_text_color": session.get("category_text_color") or "",
                "username": session.get("author_name") or session.get("author_email") or "",
                "createdAt": session.get("created_at").isoformat() if session.get("created_at") else "",
                "lastUsed": session.get("last_accessed_at").isoformat() if session.get("last_accessed_at") else "",
                "message_count": session.get("version_count") or 0,
            })

        # ── TRUE A2UI: Model is the architect for the console surface ──
        # DB only supplies raw data. The model MUST return the components.
        # Hard-fail (503) if the model cannot assemble it. No DB skip, no fallbacks.
        # ── THE MODEL SEES A SAMPLE; THE GRID GETS EVERYTHING ──────────────────────
        #
        # The cards were dumped into the prompt whole, which meant the number of packages a
        # person could SEE was decided by what the model could be asked to read: the request's
        # limit, and the limit defaulted to TEN. The owner, looking at a console with 265
        # packages in it: "I don't see the pagination… you have a max count of 10 still in
        # place and I know there's more cards than 10."
        #
        # The model does not need every row — it needs to know the list exists, how big it is,
        # and what a card looks like, because it binds ConsoleCardGrid to /cards and the DATA
        # MODEL carries the list. So the prompt takes a sample and the count; the data model
        # takes everything the request asked for.
        SAMPLE = 12
        cards_for_prompt = json.dumps(cards[:SAMPLE])
        llm_prompt = f"""You are Grace, the A2UI surface assembler for the console.
{render_tools_block()}

The user opened the Console. There are {len(cards)} prompt packages. The first
{min(SAMPLE, len(cards))} are shown below as examples of the card shape; bind the grid to the
whole list at the path below, NOT to these samples.

Card data (bind ConsoleCardGrid to this):
{cards_for_prompt}

Assemble the FULL console surface using A2UI v0.9.1.

{_catalog_component_vocabulary()}

REQUIREMENTS:
1. id "root", component "workspace-layout" — the composer's own container. Its
   panes are NAMED slots, so "children" is an OBJECT keyed by slot name; the
   array form fills nothing.
2. "card-grid": ConsoleCardGrid in slot "left", items bound to {{"path": "/cards"}}
3. "console-chat": "chat-panel" in slot "right", bound to the console's own
   conversation: conversationId {{"path": "/console/conversation_id"}},
   sessionId {{"path": "/console/session_id"}}. There is no middle slot.
4. "isThirdOpen": false — the chat column loads CLOSED. This is the container's
   own state and it owns the column's width, so it is the only flag needed: at
   false the right pane sits at its designed 60px collapsed floor with the rail
   showing, and the container tells the panel it is collapsed so the rail's Chat
   button OPENS it on the first click. Do NOT send "collapsed" or "rightWidth" on
   the panel or the container — a payload flag is re-asserted on every assembly
   and would snap the column shut again after the operator opened it, and a pinned
   width jumped the column from 75px to half the screen. Open or closed belongs to
   the element that owns the width.
5. "console-chat" carries ONE child in its "view" slot: "repair-view". The panel's
   "view" slot is the design's ONE content hole ("chat-output-simple-slot-area"
   #40001085:2373, annotated "holds plain text output and inserted functions") and
   this seat fills it with the one view the console has.
   "repair-view" is "chat-repair-actions" bound to /findings. The repair rows are
   composed by the BACKEND from the report the catalog checker already wrote, and
   written into the data model there — the same reason: a list of what is wrong in
   the catalog is not something to be paraphrased by a model.
   It arrives COLLAPSED — the element's own default, and the owner's rule for the demo he is
   building: "I don't want blank chat to open up, so add it to the chat as well… just make
   sure it's collapsed by default." The panel draws this one view above her THREAD on the
   Chat tab as well as in the hole the rail's tabs use, so the console never opens on a blank
   chat; collapsed it is a header with a count on it, and opening it is one click.
   There is no "trace-view" in this assembly any more: Trace left this menu on the same
   instruction, and a view with no rail button would be a hole nothing can reach.
6. "console-chat" carries "allowedTabs": "chat,eval,tools,approvals,settings".
   THE MENU IS THE PLACE: the console is the ONE global seat, so it is the only one that
   offers APPROVALS — the issues that span every package — and the only one that offers
   REPAIRS, the findings of the catalog check. A package's seat omits both: a package can
   only approve, and only repair, what belongs to it. Emit the list exactly as written;
   an omitted allowedTabs shows every button the rail has.
7. Short friendly ai_message

Emit nothing else — no greeting, no header, no Text above them.

Output ONLY this exact JSON (no markdown, no extra text):
{{
  "components": [
    {{"id": "root", "component": "workspace-layout", "isThirdOpen": false, "children": {{"left": "card-grid", "right": "console-chat"}}}},
    {{"id": "card-grid", "component": "ConsoleCardGrid", "items": {{"path": "/cards"}}}},
    {{"id": "console-chat", "component": "chat-panel", "tracePrompt": false, "allowedTabs": "chat,eval,tools,approvals,settings", "conversationId": {{"path": "/console/conversation_id"}}, "conversations": {{"path": "/console/conversations"}}, "sessionId": {{"path": "/console/session_id"}}, "children": {{"view": "repair-view"}}}},
    {{"id": "repair-view", "component": "chat-repair-actions", "findings": {{"path": "/findings"}}, "stages": {{"path": "/repairs/stages"}}}}
  ],
  "ai_message": "Your message"
}}
"""

        ms_b = 0.0
        ms_c = 0.0
        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=llm_prompt,
            mode="console_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-console"
            # model intentionally omitted — use the enabled provider's default
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        t_c_start = time.perf_counter()
        response_text = llm_response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # The console is the ONE global seat: the only one that offers approvals.
            _seat_tabs(components, CONSOLE_TABS)
            # The console is the ONE global seat, so it is the one that offers approvals.
            ai_message = parsed.get("ai_message", f"{len(cards)} packages ready.")
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
            ms_c = (time.perf_counter() - t_c_start) * 1000
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI Console] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_length: {len(response_text)}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  timestamp: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}\n"
                f"  FIX: The LLM returned something that isn't valid A2UI JSON. Check the prompt or the model."
            )
            raise HTTPException(
                status_code=503, 
                detail=f"A2UI FAILURE: AI returned invalid JSON for render-console — {type(e).__name__}: {str(e)}. Raw (first 300 chars): {response_text[:300]}"
            )

        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=render-console | total={elapsed_ms}ms")
        print(f"  Milestone A (Database): {ms_a:8.1f}ms")
        print(f"  Milestone B (LLM):      {ms_b:8.1f}ms")
        print(f"  Milestone C (Parse):    {ms_c:8.1f}ms")
        print(f"{'='*60}\n")

        # The repair rows — the checker's own findings, composed for the panel's "view"
        # slot. A read of the report, never a model call, and it cannot fail the surface:
        # the report's absence is carried as a row rather than as an empty list.
        repair_rows = _repair_rows()
        validate_a2ui_components(components)
        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "cards": cards,
                        # The console's OWN session and conversation — what the
                        # emitted chat-panel binds to. One console-typed session per
                        # user, one conversation under it.
                        "console": {
                            "session_id": console_session_id,
                            "conversation_id": console_conversation_id,
                            # EACH TAB HAS ITS OWN CONVERSATION — the panel switches between
                            # them by the tab column the dropdown rows carry; no new binding.
                            "tab_conversations": {
                                "chat": console_conversation_id,
                                "approvals": approvals_conversation_id or console_conversation_id,
                            },
                            # The dropdown's rows — same shape as the composer's seat, plus the
                            # tab each conversation belongs to (the label the dropdown shows).
                            "conversations": [
                                {
                                    "id": str(c.get("id")),
                                    "title": c.get("title") or "(untitled)",
                                    "tab": c.get("tab") or "chat",
                                }
                                for c in console_conversations
                            ],
                        },
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "usage": dict(LAST_USAGE),  # measured, straight from the provider
                        "ai_message": ai_message,
                        # Anything this assembly could not read, said out loud — the frontend
                        # writes these into the trace (see _warn at the top of this file).
                        "warnings": _drain_warnings(),
                        # What the panel's "repair-view" draws. Composed by the writer
                        # above from the report the checker wrote — the model is told not
                        # to invent values for it, and the element re-words nothing.
                        "findings": repair_rows,
                        # A row's state while a repair is being made: "repair" (amber,
                        # in repair) and "done" (green, completed). WRITTEN BY THE CLIENT —
                        # a repair is started and settled in the browser — so the path exists
                        # here and holds nothing until a person starts one. A completed row
                        # is then simply absent from the next report: the checker re-derives
                        # the findings, and there is no history of repaired components.
                        "repairs": {"stages": {}}
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: catalog-health[:<index>] — the index's condition, assembled by Grace
    # ═══════════════════════════════════════════════════════════════
    # Grace reads the check HERSELF. The shell sends only the intent; the state is
    # hers to fetch — the same report GET /api/catalog/audit serves. If the shell
    # fetched it and passed it in, the shell would be deciding again.
    elif intent.startswith("catalog-health"):
        from routes.misc import _read_catalog_audit

        catalog = intent.split(":", 1)[1] if ":" in intent else "prompt-composer"
        # _read_catalog_audit raises 503 when the checker has not run, so an unrun
        # check can never be assembled into a surface that looks like a clean one.
        audit = _read_catalog_audit(catalog)
        # Figma is an import tool, not a runtime gate: a "partial" report (the live
        # Figma checks skipped because there is no token) still carries the findings
        # the shell paints, so it assembles like a "complete" one. _read_catalog_audit
        # already 503s when the checker has not run at all.
        if audit.get("status") not in ("complete", "partial"):
            raise HTTPException(
                status_code=503,
                detail=(
                    f"A2UI FAILURE: the catalog check for '{catalog}' reports "
                    f"'{audit.get('status')}' — the findings are not current, so it "
                    f"cannot be assembled as if they were."
                ),
            )

        findings = [f for f in audit.get("findings", []) if f.get("level") != "pass"]
        generated_at = audit.get("generatedAt", "")
        index_name = audit.get("catalog", catalog)
        findings_for_prompt = json.dumps(findings)

        llm_prompt = f"""You are Grace, the A2UI surface assembler for the catalog check.
{render_tools_block()}

The user's index is "{index_name}". The checker ran at {generated_at} and found
{len(findings)} open findings.

Findings — raw, from the checker. Do not invent, merge, reorder or drop any:
{findings_for_prompt}

Assemble the catalog-health surface in A2UI v0.9.1. This is YOUR assembly.

{_catalog_component_vocabulary()}

REQUIREMENTS:
1. One Column with id "root" at the top.
2. A Text header naming the index and the open count.
3. ONE ActionGroup bound to the findings. Do NOT emit a component per finding —
   the surface binds to data, it does not enumerate. The findings ride in the
   data model, where the shell paints them.
4. ai_message is what you SAY. This is the point of the whole thing: greet the
   user by time of day, tell them plainly how many of their Figma components have
   problems, and offer to take care of them. One short, warm paragraph — not a
   list, not a summary of every finding. The surface carries the detail.

Output ONLY JSON in exactly this shape (no markdown fences, no commentary):
{{
  "components": [
    {{"id": "root", "component": "Column", "children": ["header", "findings"]}},
    {{"id": "header", "component": "Text", "text": "Catalog check — {index_name}: {len(findings)} open", "variant": "h2"}},
    {{"id": "findings", "component": "ActionGroup", "items": {{"path": "/findings", "componentId": "finding-action"}}}},
    {{"id": "finding-action", "component": "Button", "child": "finding-action-label", "action": {{"name": "open-repair-composer"}}}},
    {{"id": "finding-action-label", "component": "Text", "text": "Repair"}}
  ],
  "ai_message": "Your greeting"
}}
"""

        llm_response = query_llm(
            question=llm_prompt,
            mode="catalog_health_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-catalog-health",
            # model intentionally omitted — use the enabled provider's default
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
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # This place is a package: its own versions, tools, runs and evals — no approvals.
            _seat_tabs(components, PACKAGE_TABS)
            ai_message = parsed.get("ai_message", f"{len(findings)} open in {index_name}.")
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI CatalogHealth] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  FIX: The LLM returned something that isn't valid A2UI JSON."
            )
            raise HTTPException(
                status_code=503,
                detail=(
                    f"A2UI FAILURE: AI returned invalid JSON for catalog-health — "
                    f"{type(e).__name__}: {str(e)}. Raw (first 300 chars): {response_text[:300]}"
                ),
            )

        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=catalog-health | total={elapsed_ms}ms")

        # What this call ACTUALLY cost, from the provider's own usage report.
        # Measured, never estimated — an invented number above a real action is
        # worse than no number.
        usage = dict(LAST_USAGE)

        validate_a2ui_components(components)
        return [
            {"version": "v0.9.1", "createSurface": {"surfaceId": "main", "catalogId": A2UI_CATALOG_ID}},
            {"version": "v0.9.1", "updateComponents": {"surfaceId": "main", "components": components}},
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "catalog": index_name,
                        "generated_at": generated_at,
                        "counts": audit.get("counts", {}),
                        "findings": findings,
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "ai_message": ai_message,
                        "warnings": _drain_warnings(),
                        "usage": usage,
                    },
                },
            },
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-composer (blank workspace)
    # ═══════════════════════════════════════════════════════════════
    elif intent == "render-composer":
        # ── HONEST STATUS (2026-08-04): ──
        # FIGMA DISABLED — was causing 10s timeouts when the cached spec
        # was empty/stale (node 40000717:17091 deleted in Figma). The LLM
        # would choke on an empty spec and the frontend would abort.
        # Assembly now proceeds WITHOUT Figma. The model derives the
        # surface layout from its own knowledge of the A2UI catalog.
        ms_a = 0.0

        llm_prompt = f"""You are Grace, the A2UI surface assembler for the Composer.
{render_tools_block()}

The user clicked "Composer". Assemble the FULL blank composer surface.

COMPONENT NAMES — use exactly these strings in each object's "component" field:
{json.dumps(list(a2ui_catalog.get("components", {}).keys()))}

LAYOUT CONTRACT — the container's NAMED slots, which you fill:
- left-header: left-column-header, title bound to {{"path": "/session/title"}}
  THE PROMPT'S OWN BAR, above the sections and NOT inside their scroller: it is the
  package's title, its version and its id, so it stays put while the sections scroll
  under it. Emit "left-column-header" (the tag) or "LeftColumnHeader" (the name) —
  both are in the catalog and both resolve to the same element. Bind "title" and
  nothing else: the version and the id come from the host, and the tags, author and
  score are drawn placeholders that take no props.
- left: prompt-section-editor, sections bound to {{"path": "/session/left_column/sections"}}
- left-footer: control-bar
  The design puts the "Left-column-ControlBar" at the BOTTOM of the left column
  (#40000954:23865), as that container's LAST child — it is the CONTAINER's slot, not a
  child of the editor, so the bar stays put while the prompt sections scroll above it.
  Emit it with NO props: the master carries three controls (undo, Save Template, RUN)
  and no version line, so there is no value to bind.
- middle: compiled-output-viewer, content ""
- right: chat-panel, conversationId bound to {{"path": "/session/right_column/conversation_id"}}
  It carries one child in its "view" slot — "trace-view", a TraceFeed bound to
  /trace/entries and /trace/breadcrumbCount — because that slot is the design's
  content hole for every non-chat tab and a panel emitted without it shows the
  Trace tab loading forever. Both paths are written by the client; do not invent
  values for them.

"root" IS "workspace-layout" — do not put a Column above it. Its panes are NAMED
slots, so its "children" is an OBJECT keyed by slot name ({{"left": ...,
"middle": ..., "right": ...}}), not an array: the array form carries no slot and
fills nothing.

REQUIREMENTS:
1. Component objects use key "component" (NOT "type"). Every object needs "id".
2. id "root", component "workspace-layout", children keyed by slot name.
3. initial_sections: exactly 3 starter prompt sections — System, User, Agent — each an object {{"name", "type", "content"}} with short real content (User and Agent may be empty).
4. One short friendly ai_message and one short suggested_title.
   "isThirdOpen": true IS STATED, NOT LEFT OUT — and that is load-bearing. A prop an assembly
   OMITS is not reset: the renderer re-assigns what the tree carries, and the element keeps
   everything else. The console (and a Run's flow view) sets `isThirdOpen: false`, so a
   Composer that said nothing inherited a CLOSED column — measured 2026-09-18, the owner: "I'm
   not sure why the chat's loading collapsed." Two columns means the second one is OPEN, every
   time, so it is written down.
5. THE ROOT HAS NO "middle" CHILD. A prompt that has not been run shows TWO columns:
   the prompt and GRACE. The middle column is the one a Run produces — it holds the flow
   and the run's output, and until there is a run it is not drawn at all (owner,
   2026-09-18: "you should only see two columns. The third column is not visible until the
   user clicks run"; and, on seeing the middle drawn without her: "the middle column is
   open and Grace is gone"). "middle-column" is still EMITTED below — the shell moves the
   flow view into it at Run time — it is simply not in the layout's children yet, so the
   layout does not draw it.
5. "right-column" carries "allowedTabs": "chat,trace,tools,executions,eval,settings".
   THE MENU IS THE PLACE, not a filter over data: a rail button is a request to look at
   something THIS place has, so a package offers its own tools, its own runs and its own
   evals — and NOT approvals, because approvals are the console's job:
   the console approves across every package, and a package can only ever see its own.
   Emit the list EXACTLY as written; a missing allowedTabs shows every button the rail
   has, which is how a package ends up offering the console's global view.

Output ONLY this exact JSON shape — no markdown, no envelope wrapper, no array, no extra keys, no text after the JSON:
{{
  "components": [
    {{"id": "root", "component": "workspace-layout", "isThirdOpen": true, "children": {{"left-header": "left-header", "left": "left-column", "left-footer": "control-bar", "right": "right-column"}}}},
    {{"id": "left-header", "component": "left-column-header", "title": {{"path": "/session/title"}}, "version": {{"path": "/session/version"}}, "promptId": {{"path": "/session/id"}}}},
    {{"id": "left-column", "component": "prompt-section-editor", "sections": {{"path": "/session/left_column/sections"}}}},
    {{"id": "control-bar", "component": "control-bar", "isSaving": {{"path": "/session/left_column/saving"}}, "isRunning": {{"path": "/session/middle_column/running"}}}},
    {{"id": "middle-column", "component": "compiled-output-viewer", "content": ""}},
    {{"id": "right-column", "component": "chat-panel", "allowedTabs": "chat,trace,tools,executions,eval,settings", "conversationId": {{"path": "/session/right_column/conversation_id"}}, "conversations": {{"path": "/session/right_column/conversations"}}, "sessionId": {{"path": "/session/id"}}, "packageTitle": {{"path": "/session/title"}}, "packageDescription": {{"path": "/session/description"}}, "leftColumnContent": {{"path": "/session/left_column/sections"}}, "compiledOutput": {{"path": "/session/middle_column/compiled_output"}}, "children": {{"view": "trace-view"}}}},
    {{"id": "trace-view", "component": "TraceFeed", "entries": {{"path": "/trace/entries"}}, "breadcrumbCount": {{"path": "/trace/breadcrumbCount"}}}}
  ],
  "initial_sections": [
    {{"name": "System", "type": "system", "content": "You are a precise, professional assistant."}},
    {{"name": "User", "type": "user", "content": ""}},
    {{"name": "Agent", "type": "agent", "content": ""}}
  ],
  "suggested_title": "Untitled Prompt",
  "ai_message": "Composer ready. Select a role and enter your prompt."
}}"""

        # ── PERFORMANCE TRACE: Milestone B (Network/LLM) ──
        ms_b = 0.0
        ms_c = 0.0
        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=llm_prompt,
            mode="surface_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-composer"
            # model intentionally omitted — use the enabled provider's default (deepseek-v4-pro)
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        # TRUE A2UI: Hard-fail if AI doesn't respond
        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        # ── PERFORMANCE TRACE: Milestone C (Validation/Parse) ──
        t_c_start = time.perf_counter()
        response_text = llm_response.strip()
        
        # Strip markdown fences if present
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        # Parse and validate AI response - NO fallbacks
        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # This place is a package: its own versions, tools, runs and evals — no approvals.
            _seat_tabs(components, PACKAGE_TABS)
            initial_sections = parsed["initial_sections"]
            ai_message = parsed["ai_message"]
            suggested_title = parsed["suggested_title"]
            
            # Validate required fields
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
            if not isinstance(initial_sections, list):
                raise ValueError("initial_sections must be array")
            if not isinstance(ai_message, str) or not ai_message.strip():
                raise ValueError("ai_message must be non-empty string")
            if not isinstance(suggested_title, str) or not suggested_title.strip():
                raise ValueError("suggested_title must be non-empty string")
                
            ms_c = (time.perf_counter() - t_c_start) * 1000
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI Composer] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_length: {len(response_text)}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  timestamp: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}\n"
                f"  FIX: The LLM returned something that isn't valid A2UI JSON. Check the prompt or the model."
            )
            raise HTTPException(
                status_code=503, 
                detail=f"A2UI FAILURE: AI returned invalid JSON for render-composer — {type(e).__name__}: {str(e)}. Raw (first 300 chars): {response_text[:300]}"
            )

        # No DB update here. suggested_title lives in the in-memory data model only.
        # Real title + session creation happens on explicit Save via /ai/save-surface.

        elapsed_ms = int((time.time() - start_time) * 1000)

        # ── PERFORMANCE TRACE: LOG BREAKDOWN ──
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=render-composer | total={elapsed_ms}ms")
        print(f"  Milestone A (Database - draft create):      {ms_a:8.1f}ms")
        print(f"  Milestone B (Network/LLM - query_llm):     {ms_b:8.1f}ms")
        print(f"  Milestone C (Validation - JSON parse):      {ms_c:8.1f}ms")
        print(f"  Remainder (other):                          {elapsed_ms - ms_a - ms_b - ms_c:8.1f}ms")
        print(f"{'='*60}\n")

        # ═══════════════════════════════════════════════════════════════
        # A2UI v0.9.1 ENVELOPE RESPONSE
        # HONEST STATUS (2026-08-01):
        #   - components list: AI-generated (which prompt blocks, which data)
        #   - Data model SHAPE: slot contract is FIXED (left/middle/right)
        #     because slots are the foundational loading framework.
        #     The AI fills slots; it does not create or remove slots.
        #   - Sections within left_column: AI-generated (the prompt blocks)
        #   - Per owner: slots are pure AI-native loading contract.
        #     Scaling features = slot them in. No visible styling yet.
        # ═══════════════════════════════════════════════════════════════
        
        # Validate AI-generated components against catalog
        validate_a2ui_components(components)
        
        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components  # AI-generated, not hardcoded
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "session": {
                            "id": None,  # in-memory only until explicit Save
                            "title": suggested_title,  # AI-generated
                            # A package being drafted has no description until someone writes
                            # one; stated, so the seat reads "none" from the model rather than
                            # from a missing key it has to interpret.
                            "description": "",
                            "is_unsaved": True,
                            "left_column": {
                                "saving": False,
                                "sections": initial_sections,  # slot contract (fixed), sections are AI-generated
                                # The seat beside this column reads the workspace from
                                # raw_content (chat-panel.leftColumnContent). A fresh
                                # package has no row yet, so the writer supplies the same
                                # JSON shape the database stores — without it Grace is
                                # handed nothing and answers "the workspace is empty".
                                "raw_content": json.dumps({"sections": initial_sections}),
                            },
                            "middle_column": {"compiled_output": "", "running": False},  # slot contract (fixed)
                            "right_column": {"conversation_id": None, "conversations": []},      # slot contract (fixed), chat is mostly static
                        },
                        "ai_message": ai_message,  # AI-generated
                        "grace_greeting": True,
                        "suggested_title": suggested_title,  # AI-generated
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "usage": dict(LAST_USAGE)  # measured, straight from the provider
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-session:{id}
    # ═══════════════════════════════════════════════════════════════
    elif intent.startswith("render-session:"):
        session_id = intent.split(":")[1] if ":" in intent else request.session_id

        if not session_id:
            raise HTTPException(status_code=400, detail="Session ID required for render-session intent")

        if not state.prompt_sessions_api:
            raise HTTPException(status_code=503, detail="A2UI FAILURE: Database not available")

        # ── PERFORMANCE TRACE: Milestone A (Database) ──
        t_a_start = time.perf_counter()

        # Fetch session from PostgreSQL
        session = state.prompt_sessions_api.get_session(user_id=uid, session_id=session_id)

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Fetch Milvus versions
        milvus_versions = []
        try:
            milvus_versions = milvus_get_versions(prompt_id=session_id)
        except Exception as e:
            _warn(f"the version list could not be read from the vector store (the row's own versions are unaffected): {e}")

        ms_a = (time.perf_counter() - t_a_start) * 1000

        # Parse stored data
        sections = []
        try:
            if session.get("left_column_content"):
                parsed = json.loads(session["left_column_content"])
                sections = parsed.get("sections", [])
        except:
            pass

        # Fetch actual conversation messages (for ChatPanel history on mount)
        #
        # ── THE PACKAGE'S CONVERSATION IS FOUND BY ITS OWNER, NOT BY A COPY ────
        # A conversation is owned by the package through `conversations.session_id` —
        # the frontend states the rule outright ("Conversations are package-owned: the
        # conversation row already carries session_id — prompt_sessions.conversation_id
        # was dropped"). This read used the dropped copy instead, so the surface bound
        # whatever that column held. Measured 2026-09-17: 8 conversations owned by 4
        # packages, and only 2 of 265 packages carry conversation_id — so a package with
        # a real conversation was told there was none, and the seat drew "No
        # conversations yet." over it. That is the same severed wire as the output column
        # and the repair list: the data existed, the read looked somewhere else.
        # ── THE PACKAGE'S CONVERSATIONS, AS A LIST — the Conversations dropdown's rows ──
        #
        # The dropdown at the top of the chat column binds its list to the package's
        # conversations (its `Data:` line), the element declares `conversations`, and this
        # payload had no such path — so the closed dropdown drew its empty sentence over a
        # package that owns a conversation with eight turns in it. The lookup below was
        # already being made; its result was used for `conv_id` and then thrown away, and
        # it was only made on the branch where the package had no `conversation_id`, so the
        # list existed as a side effect of a fallback rather than as data.
        #
        # It is one read, the owner's own (`conversations.session_id`), and both facts come
        # out of it: which conversation the seat is in, and the list to choose from.
        conversations_list = []
        if state.conversation_api:
            try:
                conversations_list = state.conversation_api.get_conversations_by_session(session_id, uid)
            except Exception as e:
                _warn(f"package {str(session_id)[:8]}…'s conversation list could not be read, so the seat has none to offer: {e}")

        conv_id = session.get("conversation_id")
        if not conv_id and conversations_list:
            conv_id = conversations_list[0].get("id")
            print(f"[A2UI Surface] {session_id} owns {len(conversations_list)} conversation(s) — "
                  f"bound {str(conv_id)[:8]}… (conversations.session_id, not the dropped column)")
        # NO SECOND FETCH (2026-09-18). Two hundred messages were read here on every assembly
        # to compute ONE number for the assembler's data summary — and then written to
        # /session/right_column/messages, a path NO component binds (the seat loads its own
        # history through _loadHistory). `get_session` above already carries them; the count
        # comes from there, and the catch that swallowed a PermissionError into a print went
        # with the fetch.
        message_count = len(session.get("messages") or [])

        # ── TRUE A2UI: MODEL IS THE ARCHITECT ──
        # DB supplies the data. The model MUST return the components (adjacency list).
        # Hard-fail (503) if the model cannot assemble the surface structure.
        # No hardcoded components. No greeting-only shortcut.
        session_info = {
            "title": session.get("title"),
            "sections_count": len(sections),
            "has_compiled": bool(session.get("compiled_output")),
            "milvus_count": len(milvus_versions),
            "message_count": message_count,
        }
        llm_prompt = f"""You are Grace, the A2UI surface assembler.
{render_tools_block()}

User is loading saved session: "{session.get('title') or 'Untitled'}".

Data summary:
{json.dumps(session_info)}

Assemble the FULL surface with A2UI v0.9.1.

CATALOG (use these):
- left-column-header (title: {{"path": "/session/title"}}) — the prompt's own bar, in the
  container's "left-header" slot, ABOVE the sections and outside their scroller, so the
  title and version stay put while the sections scroll under them
- prompt-section-editor (sections: {{"path": "/session/left_column/sections"}})
- control-bar (no props) — in the container's "left-footer" slot, at the bottom of the left column
- compiled-output-viewer (content: {{"path": "/session/middle_column/compiled_output"}})
- chat-panel (conversationId: {{"path": "/session/right_column/conversation_id"}})
- TraceFeed (entries: {{"path": "/trace/entries"}}, breadcrumbCount: {{"path": "/trace/breadcrumbCount"}}) — the chat panel's "view" slot child, for the rail's Trace tab
- workspace-layout (resizable host for the three panes)

REQUIREMENTS:
1. id "root", component "workspace-layout" — the host IS the root, with no Column
   above it. Its panes are NAMED slots, so "children" is an OBJECT keyed by slot
   name; the array form fills nothing.
2. Bind the panes to the paths above
3. Short ai_message that says what is on screen
4. "right-col" carries "allowedTabs": "chat,trace,tools,executions,eval,settings".
   THE MENU IS THE PLACE: this is a package's own seat, so it offers the tools,
   runs and evals THIS package has — and not approvals, which belong to the
   console, the one seat that sees every package at once. Emit it exactly as written.

The session IS the three panes: do NOT greet. Not "Welcome back", no time of day,
no return salutation — the operator is already in the session they opened.

Output ONLY this JSON (no markdown):
{{
  "components": [
    {{"id": "root", "component": "workspace-layout", "isThirdOpen": true, "children": {{"left-header": "left-hdr", "left": "left-col", "left-footer": "control-bar", "right": "right-col"}}}},
    {{"id": "left-hdr", "component": "left-column-header", "title": {{"path": "/session/title"}}, "version": {{"path": "/session/version"}}, "promptId": {{"path": "/session/id"}}}},
    {{"id": "left-col", "component": "prompt-section-editor", "sections": {{"path": "/session/left_column/sections"}}}},
    {{"id": "control-bar", "component": "control-bar", "isSaving": {{"path": "/session/left_column/saving"}}, "isRunning": {{"path": "/session/middle_column/running"}}}},
    {{"id": "middle-col", "component": "compiled-output-viewer", "content": {{"path": "/session/middle_column/compiled_output"}}}},
    {{"id": "right-col", "component": "chat-panel", "allowedTabs": "chat,trace,tools,executions,eval,settings", "conversationId": {{"path": "/session/right_column/conversation_id"}}, "conversations": {{"path": "/session/right_column/conversations"}}, "sessionId": {{"path": "/session/id"}}, "packageTitle": {{"path": "/session/title"}}, "packageDescription": {{"path": "/session/description"}}, "leftColumnContent": {{"path": "/session/left_column/sections"}}, "compiledOutput": {{"path": "/session/middle_column/compiled_output"}}, "children": {{"view": "trace-view"}}}},
    {{"id": "trace-view", "component": "TraceFeed", "entries": {{"path": "/trace/entries"}}, "breadcrumbCount": {{"path": "/trace/breadcrumbCount"}}}}
  ],
  "ai_message": "Session open — your three panes are loaded."
}}
"""

        # ── PERFORMANCE TRACE: Milestone B (Network/LLM) ──
        ms_b = 0.0
        ms_c = 0.0
        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=llm_prompt,
            mode="surface_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-session"
            # model intentionally omitted — use the enabled provider's default
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        # ── PERFORMANCE TRACE: Milestone C (Validation/Parse) ──
        t_c_start = time.perf_counter()
        response_text = llm_response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            # This place is a package: its own versions, tools, runs and evals — no approvals.
            _seat_tabs(components, PACKAGE_TABS)
            ai_message = parsed.get("ai_message", f"{session.get('title') or 'Untitled'} is open.")
            if not isinstance(components, list) or len(components) == 0:
                raise ValueError("components must be non-empty array")
            ms_c = (time.perf_counter() - t_c_start) * 1000
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(f"[A2UI Session] AI response parse FAILED: {e}")
            print(f"[A2UI Session] Raw response: {response_text[:500]}")
            raise HTTPException(
                status_code=503, 
                detail=f"A2UI FAILURE: AI returned invalid JSON - {str(e)}"
            )

        elapsed_ms = int((time.time() - start_time) * 1000)

        # ── PERFORMANCE TRACE: LOG BREAKDOWN ──
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=render-session | total={elapsed_ms}ms")
        print(f"  Milestone A (Database - get_session+milvus): {ms_a:8.1f}ms")
        print(f"  Milestone B (Network/LLM - query_llm):       {ms_b:8.1f}ms")
        print(f"  Milestone C (Validation - JSON parse):        {ms_c:8.1f}ms")
        print(f"  Remainder (other):                            {elapsed_ms - ms_a - ms_b - ms_c:8.1f}ms")
        print(f"{'='*60}\n")

        # ═══════════════════════════════════════════════════════════════
        # A2UI v0.9.1 ENVELOPE RESPONSE - AI-GENERATED COMPONENTS
        # ═══════════════════════════════════════════════════════════════
        validate_a2ui_components(components)
        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components
                }
            },
            {
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/",
                    "value": {
                        "session": {
                            "id": str(session_id),
                            "title": session.get("title"),
                            # THE VERSION, SO THE BAR CAN STATE IT. The row carries
                            # current_version and nothing was putting it on the data model,
                            # so the prompt's bar had nothing to bind and drew its empty
                            # label. One value, one path, the same as the title.
                            "version": session.get("current_version") or 1,
                            # THE DESCRIPTION, WHICH SHE IS ASKED TO JUDGE. The review before a
                            # Run requires one, so the seat that asks for it has to be able to
                            # READ it — measured 2026-09-23: the description was written and she
                            # went on saying the package had none, because nothing ever put it
                            # in front of her. One value, one path, the same as the title.
                            "description": session.get("description") or "",
                            "is_unsaved": False,
                            "left_column": {
                                "sections": sections,
                                "raw_content": session.get("left_column_content"),
                                # The bottom bar's two busy flags. They start false and the
                                # client owns them from there: pressing Save Template or RUN
                                # sets one, the bar binds it by path, and the spinner the
                                # drawing asks for (state=Compiling / state=Running) appears
                                # on the button that was pressed.
                                "saving": False,
                            },
                            "middle_column": {
                                "compiled_output": session.get("compiled_output"),
                                "running": False,
                            },
                            "right_column": {
                                # THE RESOLVED ID, not the dropped column. Binding
                                # `session.conversation_id` here was why the seat had
                                # history it could not write to: with no id, every send
                                # created ANOTHER conversation for the package — measured
                                # 2026-09-17, this package owned four, two messages each,
                                # and no way to say which one it was looking at.
                                "conversation_id": str(conv_id) if conv_id else None,
                                # The Conversations dropdown's rows. Same read as the id
                                # above — the package's own conversations, newest first —
                                # bound to the element's `conversations` prop by the
                                # assembled surface.
                                "conversations": [
                                    {
                                        "id": str(c.get("id")),
                                        "title": c.get("title") or "(untitled)",
                                    }
                                    for c in conversations_list
                                ],
                                # (The messages themselves are not carried here: nothing binds
                                # /session/right_column/messages — see the note where the
                                # second fetch used to be.)
                            },
                        },
                        "milvus": {
                            "versions": milvus_versions,
                            "version_count": len(milvus_versions),
                        },
                        "metadata": {
                            "version": session.get("current_version"),
                            "created_at": str(session.get("created_at")) if session.get("created_at") else None,
                            "updated_at": str(session.get("updated_at")) if session.get("updated_at") else None,
                            "column_widths": session.get("metadata", {}).get("column_widths") if session.get("metadata") else None,
                            # The place as it was saved — the view applies it on opening a
                            # package (WritingAreaIndex), the same way column_widths is
                            # applied to the columns.
                            "workspace": session.get("metadata", {}).get("workspace") if session.get("metadata") else None,
                        },
                        "ai_message": ai_message,
                        "warnings": _drain_warnings(),
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True
                    }
                }
            }
        ]

    # ═══════════════════════════════════════════════════════════════
    # INTENT: render-run[:{id}] — THE THIRD COLUMN, ASSEMBLED
    # ═══════════════════════════════════════════════════════════════
    #
    # A RUN DOES NOT RESHAPE THE SURFACE BY HAND. The third column is a surface like the
    # console's cards and a package's three panes, so the model assembles it the same way —
    # against this catalog, in this endpoint — and the shell applies what it is given.
    #
    # WHAT THIS REPLACES, MEASURED 2026-09-23 (READ-ME/CONTINUE-HERE.md §00c): the host wrote
    # the components itself. `setOutputColumn('flow')` built `AgentCanvas` with its three
    # slots and pushed `AgentFlow`, `OutputControls` and `CanvasFooter` straight into the
    # live component list, in TypeScript, on the Run — so the one surface a person watches
    # most closely was the one the protocol did not build. The owner's charge: "if those
    # nodes are not being called from the A2UI library by a model, then you've not only
    # violated the protocol, you've created this jarring effect."
    #
    # AN UPDATE, NOT A REPLACEMENT, and that is what makes a Run different from opening a
    # package. `render-session` returns the whole tree and the whole model because the
    # package IS the surface. A Run changes ONE COLUMN of a surface that is already on
    # screen and already carries facts the server does not have — the rows as they stand in
    # the editor, the conversation on screen, the places nodes were dragged to. So the
    # caller states the ids the assembly must land on (`context.run`), the model returns the
    # components to add and update, and the shell applies them as an update. A run that
    # replaced the tree would revert a person's unsaved rows to the last saved ones, which
    # is the second-writer disease this repository has spent the week removing.
    #
    # THE OTHER SLOTS ARE CHECKED, NOT TRUSTED. The layout's left, left-header, left-footer
    # and right slots are stated to the model, and the root it returns must carry them back
    # byte for byte. An assembly that rewrote them would take the prompt or Grace off the
    # screen, and it would do it while a person was watching a Run — so it is a 503 with the
    # difference named, never a silent acceptance.
    elif intent == "render-run" or intent.startswith("render-run:"):
        run = request.context.run if (request.context and request.context.run) else None
        layout_id = str((run or {}).get("layoutId") or "").strip()
        middle_id = str((run or {}).get("middleId") or "").strip()
        slots = (run or {}).get("slots")
        if not layout_id or not isinstance(slots, dict) or not slots:
            raise HTTPException(
                status_code=503,
                detail=(
                    "A2UI FAILURE: a Run must state the surface it is assembling into — the "
                    "layout's root id, its other slots, and the component in the middle today "
                    "(context.run). Without them an assembled third column cannot land on the "
                    "screen that is already there, and the columns beside it would be replaced."
                ),
            )

        package = (run or {}).get("package") or {}
        run_info = {
            "package_title": package.get("title") or "Untitled",
            "package_saved": bool(package.get("id")),
            "rows_about_to_run": package.get("rows") or 0,
            "seats": package.get("seats") or [],
            "middle_component_today": middle_id or None,
        }

        t_b_start = time.perf_counter()
        llm_response = query_llm(
            question=f"""You are Grace, the A2UI surface assembler.

A person pressed RUN. The prompt column has folded back to its rail and the THIRD COLUMN —
the canvas — is opening in the room that appears between the columns. YOU assemble that
column. The renderer draws the components you return and nothing else, so a part you leave
out is a part of the screen that will not exist.

{_catalog_component_vocabulary()}

THE SESSION'S FACTS
{json.dumps(run_info)}

THE SURFACE YOU ARE UPDATING — read this as a fact, not as a suggestion:
- The layout's root is "{layout_id}" (workspace-layout). Its OTHER slots are already filled
  and MUST come back exactly as given here:
{json.dumps(slots, indent=2)}
- The component standing in the middle column today is "{middle_id or '(none yet)'}". It is
  where the canvas goes: keep that id, and give it the canvas's three slots.

REQUIREMENTS (a Run's column, drawn against the catalog):
1. The middle component becomes AgentCanvas with "theme": "dark" — a Run's picture is shown
   dark — and its "children" filled BY NAME: header, flow, footer. Those three slot names
   are the whole of it; this element renders no other slot.
2. header: OutputControls — the column's own controls, with "outputType": "Agent Flow".
3. flow: AgentFlow — THE DRAWING. Bind its "flow" to {{"path": "/session/middle_column/flow"}}
   and set "theme": "dark". THE NODES COME FROM THAT PATH: do not invent nodes, do not send a
   "flow" value, and do not describe the prompt's rows here. The shell derives them from the
   rows the person is running.
4. footer: CanvasFooter — the column's own foot, with "theme": "dark".
5. The first component in your list is the layout root: same id, its other slots EXACTLY as
   given above, plus "middle" pointing at the component from requirement 1.
6. Name the three children "{middle_id}-header", "{middle_id}-flow", "{middle_id}-footer" —
   ids a second Run can land on again.
7. One short ai_message that says the drawing is being assembled, in the app's own voice.
   No greeting, no salutation, no question.

Output ONLY this JSON (no markdown, no envelope wrapper, no text after it):
{{
  "components": [
    {{"id": "{layout_id}", "component": "workspace-layout", "children": {{...the slots above..., "middle": "{middle_id}"}}}},
    {{"id": "{middle_id}", "component": "AgentCanvas", "theme": "dark", "children": {{"header": "{middle_id}-header", "flow": "{middle_id}-flow", "footer": "{middle_id}-footer"}}}},
    {{"id": "{middle_id}-header", "component": "OutputControls", "outputType": "Agent Flow"}},
    {{"id": "{middle_id}-flow", "component": "AgentFlow", "theme": "dark", "flow": {{"path": "/session/middle_column/flow"}}}},
    {{"id": "{middle_id}-footer", "component": "CanvasFooter", "theme": "dark"}}
  ],
  "ai_message": "Assembling the drawing — the picture appears as it is built."
}}""",
            mode="surface_assembly",
            temperature=0.0,
            prompt_id="surface-assembly-run"
            # model intentionally omitted — use the enabled provider's default
        )
        ms_b = (time.perf_counter() - t_b_start) * 1000

        if not llm_response or not llm_response.strip():
            raise HTTPException(
                status_code=503,
                detail="A2UI FAILURE: AI did not respond. The AI must be active to render this surface."
            )
        if llm_response.strip().startswith("Error:"):
            raise HTTPException(status_code=503, detail=f"A2UI FAILURE: {llm_response.strip()}")

        response_text = llm_response.strip()
        if "```json" in response_text:
            response_text = response_text.split("```json")[1].split("```")[0].strip()
        elif "```" in response_text:
            response_text = response_text.split("```")[1].split("```")[0].strip()

        try:
            parsed = _extract_json_payload(response_text)
            components = parsed["components"]
            if not isinstance(components, list) or not components:
                raise ValueError("components must be a non-empty array")

            # THE LAYOUT COMES BACK WHOLE, OR NOTHING DOES. See the note above this branch:
            # the prompt and Grace are in those slots, and a Run may not take them away.
            root = next((c for c in components if isinstance(c, dict) and c.get("id") == layout_id), None)
            if root is None:
                raise ValueError(f"the layout root \"{layout_id}\" is not in the assembly")
            children = root.get("children")
            if not isinstance(children, dict):
                raise ValueError("the layout root came back with no children")
            beside = {k: v for k, v in children.items() if k != "middle"}
            if beside != slots:
                raise ValueError(
                    "the assembly rewrote the layout's other slots, which a Run may not do — "
                    f"given {json.dumps(slots)}, got {json.dumps(beside)}"
                )
            middle_target = children.get("middle")
            if not isinstance(middle_target, str) or not middle_target:
                raise ValueError("the layout root does not point its middle slot at the canvas")
            if not any(isinstance(c, dict) and c.get("id") == middle_target for c in components):
                raise ValueError(f"the middle slot points at \"{middle_target}\", which the assembly did not emit")

            # Every name and id is validated against the catalog with the same gate every
            # other assembly passes. A canvas that is not in the catalog draws an error
            # block in the middle of the picture, so it fails here instead.
            validate_a2ui_components(components)
            ai_message = str(parsed.get("ai_message") or "").strip() or "Assembling the drawing."
        except (json.JSONDecodeError, ValueError, KeyError, TypeError) as e:
            print(
                f"[A2UI Run] AI RESPONSE PARSE FAILED:\n"
                f"  error_type: {type(e).__name__}\n"
                f"  error_message: {e}\n"
                f"  llm_response_length: {len(response_text)}\n"
                f"  llm_response_first_500: {response_text[:500]}\n"
                f"  timestamp: {time.strftime('%Y-%m-%dT%H:%M:%S%z')}"
            )
            raise HTTPException(
                status_code=503,
                detail=f"A2UI FAILURE: AI returned invalid JSON for render-run — {type(e).__name__}: {str(e)}. Raw (first 300 chars): {response_text[:300]}"
            )

        elapsed_ms = int((time.time() - start_time) * 1000)
        print(f"\n{'='*60}")
        print(f"[PERF TRACE] POST /api/ai/assemble-surface | intent=render-run | total={elapsed_ms}ms")
        print(f"  Milestone B (Network/LLM - query_llm):     {ms_b:8.1f}ms")
        print(f"{'='*60}\n")
        print(f"[A2UI Run] assembled the third column: {middle_target} — "
              f"{[c.get('component') for c in components if isinstance(c, dict)]}")

        return [
            {
                "version": "v0.9.1",
                "createSurface": {
                    "surfaceId": "main",
                    "catalogId": A2UI_CATALOG_ID
                }
            },
            {
                "version": "v0.9.1",
                "updateComponents": {
                    "surfaceId": "main",
                    "components": components  # AI-generated, not hardcoded
                }
            },
            {
                # A PATH, NOT THE ROOT. A Run updates a surface that is already carrying the
                # person's rows and their conversation, so the assembly writes only the box
                # it owns: a root write would replace the whole model with these few facts.
                "version": "v0.9.1",
                "updateDataModel": {
                    "surfaceId": "main",
                    "path": "/run",
                    "value": {
                        "ai_message": ai_message,
                        "assembly_time_ms": elapsed_ms,
                        "llm_used": True,
                        "usage": dict(LAST_USAGE),  # measured, straight from the provider
                    }
                }
            }
        ]

    else:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unknown intent: {intent}. Valid intents: render-console, render-composer, "
                f"render-session:{{id}}, render-run[:{{id}}]"
            )
        )


class AIConfirmExitRequest(BaseModel):
    """Request body for Grace's exit confirmation."""
    has_unsaved_changes: bool = True
    session_title: Optional[str] = None
    content_preview: Optional[str] = None  # First ~100 chars of content
    destination: Optional[str] = None  # Where user is trying to go


@router.post("/api/ai/confirm-exit")
async def ai_confirm_exit(
    request: AIConfirmExitRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    STRICT A2UI: Grace asks the user about unsaved changes.

    When the user tries to navigate away from unsaved work,
    Grace speaks to them conversationally in the chat panel.
    """
    start_time = time.time()

    # Build context for Grace
    context = ""
    if request.session_title:
        context += f"Session title: {request.session_title}. "
    if request.content_preview:
        context += f"Content preview: {request.content_preview[:100]}... "
    if request.destination:
        context += f"User wants to go to: {request.destination}. "

    llm_prompt = f"""You are Grace, a friendly AI assistant in a prompt engineering workspace.
The user has unsaved work and is trying to navigate away.

{context}

Generate a warm, conversational message asking if they want to save their work.
Be friendly but not annoying. Keep it to 1-2 sentences.
Sound like a helpful friend, not a robot.

Output ONLY valid JSON:
{{"ai_message": "Your friendly message here"}}"""

    ai_message = "Hold on — you've got unsaved work here. Want me to save it before you go?"

    try:
        # Off the event loop, like the save-time summary call: this route is
        # `async def` and query_llm blocks for up to 10s per attempt, so an
        # inline call stalls every other request in the process behind a
        # sentence asking whether to save.
        llm_response = await asyncio.to_thread(
            query_llm,
            question=llm_prompt,
            mode="console_assembly",
            temperature=0.8,  # More personality
            prompt_id="confirm-exit",
        )

        if llm_response and llm_response.strip():
            response_text = llm_response.strip()
            if "```json" in response_text:
                response_text = response_text.split("```json")[1].split("```")[0].strip()
            elif "```" in response_text:
                response_text = response_text.split("```")[1].split("```")[0].strip()

            try:
                parsed = _extract_json_payload(response_text)
                ai_message = parsed.get("ai_message", ai_message)
            except json.JSONDecodeError:
                ai_message = llm_response.strip()[:150]
    except Exception as e:
        _warn(f"the exit-confirmation sentence fell back to the default — the model did not answer: {e}")

    elapsed_ms = int((time.time() - start_time) * 1000)

    return {
        "status": "ok",
        "assembly_time_ms": elapsed_ms,
        "ai_message": ai_message,
        "warnings": _drain_warnings(),
        "grace_speaking": True,
        "actions": [
            {"label": "Save & Go", "intent": "save-and-navigate", "primary": True},
            {"label": "Don't Save", "intent": "discard-and-navigate", "destructive": True},
            {"label": "Stay Here", "intent": "cancel-navigation"},
        ]
    }


class AISaveSurfaceRequest(BaseModel):
    """Request body for AI-driven surface save."""
    session_id: Optional[str] = None
    title: Optional[str] = None
    left_column: Optional[dict] = None  # sections, positions
    middle_column: Optional[dict] = None  # compiled_output, model_used
    right_column: Optional[dict] = None  # conversation_id, messages
    column_widths: Optional[dict] = None  # { left: number|null, chat: number }
    # THE PLACE AS IT WAS LEFT — the state the ELEMENTS hold and a save reads off them:
    # { leftCollapsed, seat: {open, width}, flow: {zoom, panX, panY} }. Optional on purpose:
    # a save that does not know the arrangement must not erase one that does.
    workspace: Optional[dict] = None


@router.post("/api/ai/save-surface")
async def ai_save_surface(
    request: AISaveSurfaceRequest,
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    AI-driven Surface Save command.

    When the user clicks Save, the AI:
    1. Analyzes the current surface state
    2. Compiles section content into a unified prompt
    3. Generates metadata (description, suggested title)
    4. Persists to PostgreSQL + Milvus atomically

    This is NOT a webpage form submission - it's an AI command.
    The AI captures and compiles the complete surface state before saving.
    """
    start_time = time.time()

    if not state.prompt_sessions_api:
        raise HTTPException(
            status_code=503,
            detail="Database not available. Please check your connection.",
        )

    uid = get_user_id_from_header(x_user_id)

    try:
        # Build left_column_content JSON from sections
        sections = request.left_column.get("sections", []) if request.left_column else []
        left_column_content = json.dumps({
            "sections": sections,
            "metadata": {
                "savedAt": datetime.now().isoformat(),
                "sectionCount": len(sections),
            }
        })

        compiled_output = request.middle_column.get("compiled_output", "") if request.middle_column else ""
        conversation_id = request.right_column.get("conversation_id") if request.right_column else None
        # ══════════════════════════════════════════════════════════════════════
        # A2UI: AI COMPILES THE SURFACE STATE BEFORE SAVING
        # The AI analyzes all sections and generates:
        # - compiled_output: The unified prompt from all sections
        # - description: A semantic summary for search/categorization
        # - suggested_title: A better title if the current one is generic
        # ══════════════════════════════════════════════════════════════════════
        ai_compilation = None
        llm_used = False

        # Only call LLM if we have actual content to compile
        section_contents = [s.get("content", "") for s in sections if s.get("content", "").strip()]
        if section_contents:
            try:
                # Build the sections summary for the LLM
                sections_text = "\n\n".join([
                    f"### {s.get('section', s.get('role', 'Unknown'))}:\n{s.get('content', '')}"
                    for s in sections if s.get("content", "").strip()
                ])

                # What only a model can write is the SUMMARY the semantic index
                # needs. This call used to be asked for the whole compiled prompt
                # inside its JSON envelope as well — a second copy of text the row
                # already holds, produced at a 4000-token budget. It came back 4228
                # characters long and unparseable ("Expecting value: line 1 column
                # 1 (char 0)"), so ai_compilation stayed None and the caller was
                # told "AI compilation FAILED" about a save that had already been
                # written. The row's output column is not this call's business: it
                # is the caller's, or the sections joined (see _compose_sections).
                llm_prompt = f"""You are Grace, the AI assistant for a prompt engineering workspace.
The user is saving their prompt template. Read the sections and write down what the prompt is for.

Generate:

1. description: A 1-2 sentence semantic summary of what this prompt does.
   This will be used for SEMANTIC SEARCH — write it so that searching "prompt about X" will find it.

2. suggested_title: If the current title "{request.title or 'Untitled'}" is generic or doesn't
   describe the prompt well, suggest a better descriptive title (max 6 words). Otherwise, keep the current title.

3. tags: Extract 5-10 semantic keywords/tags that describe this prompt's purpose, domain, and techniques.
   These enable search like "find prompts about customer service" or "prompts using chain-of-thought".

Current sections:
{sections_text}

Output ONLY valid JSON:
{{"description": "Brief summary of the prompt's purpose", "suggested_title": "A descriptive title", "tags": ["tag1", "tag2", "tag3"]}}"""

                # OFF THE EVENT LOOP. `query_llm` is a BLOCKING call — up to 10s
                # per attempt, one retry — and this route is `async def`. Called
                # inline it froze every other request in the process for the whole
                # provider call: the next assemble, the catalog check, the chat,
                # the next Save. That is what "it is still saving, it is still
                # compiling" was, and why the app could not be touched while a
                # description was being written. A database write does not get to
                # hold the server while a model thinks.
                llm_response = await asyncio.to_thread(
                    query_llm,
                    question=llm_prompt,
                    mode="console_assembly",
                    temperature=0.3,  # Low creativity for consistent compilation
                    prompt_id="save-surface-compile",
                )

                if llm_response and llm_response.strip():
                    response_text = llm_response.strip()
                    # Extract JSON from code blocks if present
                    if "```json" in response_text:
                        response_text = response_text.split("```json")[1].split("```")[0].strip()
                    elif "```" in response_text:
                        response_text = response_text.split("```")[1].split("```")[0].strip()

                    try:
                        ai_compilation = _extract_json_payload(response_text)
                        llm_used = True
                        print(
                            f"[AI Save] LLM summary: "
                            f"{len(ai_compilation.get('description', ''))} chars, "
                            f"{len(ai_compilation.get('tags') or [])} tags"
                        )
                    except (json.JSONDecodeError, ValueError) as e:
                        _warn(f"the model's summary was not valid JSON, so the save carries no summary: {e}")
            except Exception as e:
                _warn(f"the save summary could not be written by the model; the save continues without one: {e}")

        # The client's middle_column is authoritative whenever it carries a
        # compiled_output key at all: an explicit value — including an explicitly
        # EMPTY one — is the user's decision and is stored exactly as sent.
        #
        # Clearing the output column and then saving used to be silently undone
        # right here. An intentionally empty value was indistinguishable from
        # "this caller said nothing about output", so freshly compiled text was
        # written over the Clear — and the response still reported the save as a
        # success. The gap-fill below is kept for the case it was written for: a
        # Save that carries no output at all must not blank out the result of a
        # Run. What fills it is now the sections joined in order rather than a
        # model's second copy of them: same text it was written for, no tokens,
        # and no way for a model's formatting to decide what a saved row holds.
        output_was_sent = "compiled_output" in (request.middle_column or {})
        if not output_was_sent and not (compiled_output or "").strip():
            compiled_output = _compose_sections(sections)

        # Update title if AI suggested a better one
        if (ai_compilation and ai_compilation.get("suggested_title")
                and request.title in [None, "", "Untitled", "New Prompt Agent"]):
            request.title = ai_compilation["suggested_title"]

        # The row keeps the model's description, or none at all. There is
        # deliberately no fallback string: the caller used to receive
        # f"Prompt with {len(sections)} sections" whenever the model gave nothing,
        # which reads as a description of the package but describes only how many
        # sections it happens to contain. That literal is now written into no row.
        ai_description = ai_compilation.get("description", "") if ai_compilation else ""
        session_description = ai_description or ""

        # Build metadata including AI compilation info + column widths
        save_metadata = {
            "savedBy": "ai_save_surface",
            "llm_used": llm_used,
            "ai_compiled": ai_compilation is not None,
            "column_widths": request.column_widths,
            # A real Save un-drafts the package. Whole-column replacement used to produce
            # this by accident — the key simply was not in the new dict. update_session now
            # merges (see there), so the save must say it itself or drafts never surface.
            "draft": None,
        }
        if ai_description:
            save_metadata["ai_description"] = ai_description

        # WHERE THE PERSON LEFT OFF, kept with the package. Written ONLY when the caller sent
        # one — a client that cannot see the arrangement (an API caller, an older page) would
        # otherwise blank a stored one on the next save. Same reason the field is optional.
        if request.workspace:
            save_metadata["workspace"] = request.workspace

        # Read what the row holds BEFORE this save, so the version written below
        # can be compared against it. Without this, a Save where nothing changed
        # would manufacture a version recording no change.
        previous_state = None
        if request.session_id:
            try:
                previous_state = state.prompt_sessions_api.get_session(
                    session_id=request.session_id, user_id=uid
                )
            except Exception as e:
                _warn(f"the row could not be read before this save, so no version was written to compare against: {e}")

        if request.session_id:
            # UPDATE existing session
            session = state.prompt_sessions_api.update_session(
                user_id=uid,
                session_id=request.session_id,
                title=request.title,
                description=session_description,
                left_column_content=left_column_content,
                compiled_output=compiled_output,
                conversation_id=conversation_id,
                metadata=save_metadata,
            )
            action = "updated"
        else:
            # CREATE new session (create_session only accepts user_id, title, description)
            title = request.title or f"Prompt - {datetime.now().strftime('%Y-%m-%d %H:%M')}"
            session = state.prompt_sessions_api.create_session(
                user_id=uid,
                title=title,
                description=session_description,
            )
            # Now update with full content
            if session and session.get("id"):
                session = state.prompt_sessions_api.update_session(
                    session_id=session["id"],
                    user_id=uid,
                    left_column_content=left_column_content,
                    compiled_output=compiled_output,
                    conversation_id=conversation_id,
                    metadata=save_metadata,
                )
            action = "created"

        session_id = session.get("id") if session else request.session_id

        # ══════════════════════════════════════════════════════════════════════
        # REAL VERSION HISTORY
        # This endpoint used to update the row in place and write no version at
        # all: nothing in it ever touched prompt_versions, so a Save left no
        # predecessor to diff against and nothing to restore, and the console's
        # version panel only ever had rows written by other code paths to show.
        #
        # One version is now written per Save whose stored content actually
        # differs from what the row held, carrying BOTH columns. The output is
        # included because no row in prompt_versions had ever held any.
        # ══════════════════════════════════════════════════════════════════════
        version_number = None
        version_error = None
        if session_id:
            prev_output = (previous_state or {}).get("compiled_output")
            # Compare the SECTIONS, not the serialized left_column_content. That
            # JSON carries a `savedAt` timestamp which changes on every call, so
            # comparing it verbatim reported "changed" for an identical save and
            # wrote a version that recorded nothing.
            try:
                prev_sections = json.loads(
                    (previous_state or {}).get("left_column_content") or "{}"
                ).get("sections")
            except (json.JSONDecodeError, AttributeError):
                prev_sections = None
            content_changed = (
                previous_state is None
                or prev_sections != sections
                or (prev_output or "") != (compiled_output or "")
            )
            if content_changed:
                reason = [f"{len(sections)} sections"]
                if output_was_sent:
                    reason.append(
                        "output cleared" if not (compiled_output or "").strip()
                        else "output saved"
                    )
                elif (compiled_output or "").strip():
                    # Not the model's doing any more: the sections were joined
                    # into the output column (see the gap-fill above), so the
                    # version says that rather than claiming a compilation.
                    reason.append("output built from the sections")
                try:
                    written = state.prompt_sessions_api.save_version(
                        session_id=session_id,
                        user_id=uid,
                        left_column_content=left_column_content,
                        compiled_output=compiled_output,
                        change_description="Console save — " + ", ".join(reason),
                        change_type="manual",
                    )
                    version_number = (written or {}).get("version_number")
                    print(f"[AI Save] version {version_number} written for {session_id}")
                except Exception as e:
                    version_error = str(e)
                    print(f"[AI Save] VERSION WRITE FAILED: {e}")

        # ══════════════════════════════════════════════════════════════════════
        # A2UI: EMBED THE AI-COMPILED SEMANTIC SUMMARY, NOT RAW JSON
        # This enables semantic search: "find prompts about swimming" will work
        # even if "swimming" isn't a literal key in the JSON structure.
        #
        # We embed: Title + Description + Tags + Compiled Prompt (truncated)
        # This gives Milvus maximum semantic surface area for retrieval.
        # ══════════════════════════════════════════════════════════════════════
        milvus_saved = False
        ai_tags = []
        try:
            # Build semantic content for embedding
            if ai_compilation and ai_compilation.get("description"):
                # Extract tags for embedding and metadata storage
                ai_tags = ai_compilation.get("tags", [])
                tags_str = ", ".join(ai_tags) if ai_tags else ""

                # Best case: embed the AI-generated semantic description + tags
                semantic_content = f"""Title: {request.title or ai_compilation.get('suggested_title', 'Untitled')}

Description: {ai_compilation['description']}

Tags: {tags_str}

Compiled Prompt:
{compiled_output[:2000]}"""  # Truncate for embedding limits
                print(f"[AI Save] Embedding AI-compiled semantic summary ({len(semantic_content)} chars, {len(ai_tags)} tags)")
            else:
                # Fallback: embed a structured summary of the sections
                section_summary = " | ".join([
                    f"{s.get('section', s.get('role', 'Section'))}: {s.get('content', '')[:100]}"
                    for s in sections if s.get("content", "").strip()
                ])
                semantic_content = f"Title: {request.title or 'Untitled'}\nSections: {section_summary}"
                print(f"[AI Save] Embedding section summary (no AI compilation)")

            # Pass AI metadata to Milvus for filtering and retrieval. Off the
            # event loop for the same reason as the summary call above: this is a
            # synchronous network write behind a model load, and the save in front
            # of it has already been written. (When the embedding model is not
            # loaded at all, this is where the "Milvus save warning" comes from.)
            await asyncio.to_thread(
                milvus_save_version, session_id, semantic_content, ai_metadata=ai_compilation
            )
            milvus_saved = True
        except Exception as e:
            _warn(f"the vector index was not written — the row is saved, but semantic search will not find this version: {e}")

        elapsed_ms = int((time.time() - start_time) * 1000)

        # AI confirmation message. It reports what actually happened to the row:
        # a summary that did not arrive says so without calling the SAVE a failure,
        # an emptied output column says so, and a vector index that was NOT written
        # says that too. The message used to read as an unqualified success in all
        # three cases — and then, for the first of them, as "AI compilation FAILED
        # — no compiled prompt was generated" about a row that had been written.
        summary_missing = bool(section_contents) and ai_compilation is None
        ai_message = f"Surface {action} successfully in {elapsed_ms}ms."
        if llm_used:
            ai_message += f" AI summary written for {len(sections)} sections."
        elif summary_missing:
            ai_message += " No AI summary (the compile call returned nothing usable)."
        else:
            ai_message += f" {len(sections)} sections saved."
        # One statement of an explicitly cleared column, whichever branch above
        # was taken: the summary that was written does not live in the output
        # column, so a cleared column is not a discarded summary.
        if output_was_sent and not (compiled_output or "").strip():
            ai_message += " Output column cleared."
        if version_number is not None:
            ai_message += f" Version {version_number} saved."
        elif version_error:
            ai_message += f" VERSION NOT SAVED: {version_error}"
        else:
            ai_message += " No version written (content unchanged)."
        if milvus_saved:
            ai_message += " Vector embeddings updated."
        else:
            ai_message += " Vector index NOT updated (embedding model not loaded)."

        return {
            "status": "ok",
            "action": action,
            "session_id": session_id,
            "save_time_ms": elapsed_ms,
            "sections_saved": len(sections),
            "milvus_saved": milvus_saved,
            "llm_used": llm_used,
            "ai_compiled": ai_compilation is not None,
            "summary_missing": summary_missing,
            "compiled_output_length": len(compiled_output),
            "version_number": version_number,
            "version_error": version_error,
            "ai_message": ai_message,
            "warnings": _drain_warnings(),
            # Include AI-generated data if available (for semantic search & display)
            "ai_description": ai_compilation.get("description") if ai_compilation else None,
            "ai_suggested_title": ai_compilation.get("suggested_title") if ai_compilation else None,
            "ai_tags": ai_tags if ai_tags else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save surface: {str(e)}"
        )


def _tool_refusal(message: str, path: str = "/name") -> HTTPException:
    """The answer to a tool request that cannot be met.

    The same four-field shape the catalog uses for a component that is not in
    it. A tool that does not exist is not an empty result — it is a refusal
    that names what was asked for.
    """
    return HTTPException(status_code=503, detail={
        "error": {
            "code": "VALIDATION_FAILED",
            "surfaceId": "main",
            "path": path,
            "message": message,
        }
    })


@router.get("/api/ai/tools")
async def ai_tools(section: Optional[str] = Query(None)):
    """The tools on offer, optionally narrowed to one section of a prompt.

    Names, one line each, and the category. No bodies — a body is fetched only
    when something asks for that tool by name.

    `section` is one of the prompt's seats. A tool can belong to more than one
    and appears in each, which is what makes a tool show up where the person is
    working rather than in one fixed list.
    """
    try:
        return {"tools": list_tools(section), "section": section}
    except ToolError as e:
        raise _tool_refusal(str(e), path="/section")


@router.get("/api/ai/tool-categories")
async def ai_tool_categories():
    """The categories and how many tools each holds.

    This is what the first list shows when someone presses Tools: the shape of
    what is available, not every tool at once.
    """
    try:
        return {"categories": categories()}
    except ToolError as e:
        raise _tool_refusal(str(e), path="/categories")


@router.post("/api/ai/read-tool")
async def ai_read_tool(request_body: dict):
    """Read one tool's full text.

    A tool is not in the prompt until something asks for it by name, which is
    why one can be long and still cost nothing on the calls that do not use it.

    An unknown name is a refusal that lists what exists, not an empty answer.
    """
    name = (request_body or {}).get("name", "")
    if not name:
        raise _tool_refusal("read-tool needs a 'name'.")
    try:
        return get_tool(name)
    except ToolError as e:
        raise _tool_refusal(str(e))


@router.get("/api/ai/role-capabilities")
async def ai_role_capabilities(
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """
    Return the current user's departmental role and capability set.

    The frontend uses this to:
    - Filter which tabs are visible in <chat-navigation-bar>
    - Decide whether to show the prompt builder vs read-only view
    - Gate governance data views (cost, trace, quality metrics)

    This is the runtime contract between backend role resolution and
    frontend role-based rendering.
    """
    uid = get_user_id_from_header(x_user_id)
    role = get_user_role(uid)
    caps = get_role_capabilities(role)
    return {
        "user_id": uid,
        "role": role,
        "capabilities": caps,
    }


@router.get("/api/admin/audit-logs")
async def api_admin_audit_logs(
    limit: int = Query(50),
    offset: int = Query(0),
    x_user_id: Optional[str] = Header(None, alias="X-User-ID"),
):
    """Admin-only: retrieve audit log entries."""
    uid = get_user_id_from_header(x_user_id)
    if not user_is_admin(uid):
        raise HTTPException(status_code=403, detail="Admin access required")

    if not state.conversation_api:
        raise HTTPException(status_code=503, detail="Database not available")

    try:
        conn = state.conversation_api.get_db()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, user_id, action, resource_type, resource_id, metadata, created_at "
            "FROM audit_logs ORDER BY created_at DESC LIMIT %s OFFSET %s",
            (limit, offset)
        )
        rows = cursor.fetchall()
        logs = [dict(r) for r in rows]
        # Convert datetime to string for JSON
        for log in logs:
            if log.get("created_at"):
                log["created_at"] = log["created_at"].isoformat()
        cursor.close()
        conn.close()
        return {"logs": logs, "count": len(logs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error loading audit logs: {str(e)}")


# ============================================
# PROMPT SESSION + VERSION MANAGEMENT
# ============================================
