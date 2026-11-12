"""THE UX CHAT DOOR — POST /api/ux/posthog-chat, GET /api/ux/chat/thread.

WHAT THIS IS. The Design room's UX tab is where the analytics application (the PostHog code we
took over) works. The person talks to it through the room's own chat output — the seat's thread
is the conversation surface — and this route is what that conversation calls. The turn is handed
to the analytics application's own conversation pipeline (their endpoint, their agent workflow,
their tools), which runs on OUR model via the env-gated factory patch (RAIBACH_IDS_CHAT_MODEL).
Our chat input and output are the UI; their wiring — the conversation id, the thread, the agent —
is the engine. Nothing of their UI is copied into the seat.

WHERE THE THREAD LIVES (owner, 2026-10-19: *"I noticed that the conversations went away … are we
not saving these conversations what happened to conversation ID? … make a slot in the database to
put these chat outputs, we already do it for the other tabs inside of design"*). The UX tab is
its own package — `prompt_sessions.metadata.session_type = 'design_tab'`, `design_tab = 'ux'` —
which is exactly the shape `design_console` already reads for every tab. The thread is one
conversation under that package (`conversations.session_id` = the package, `tab = 'ux'`), the way
Chat and Tools keep their own. That is why a UX conversation is absent from the Design
container's list: the row lives under the tab's package, not under the room's.

THE CONVERSATION ID IS THE SAME ON BOTH SIDES. The application is handed OUR conversation id as
its own `conversation`, so its thread and ours are one id — its memory of the previous turns
survives, ours survives, and neither is a second copy with a different name. (Before this the id
was derived from a session key the view never had, so every turn opened a NEW application thread
and the app answered each one with no history — measured 2026-10-19.)

A FAILURE IS WRITTEN DOWN TOO. The person's words are saved before the call, and any refusal —
their endpoint's status, an unreachable app, no words — is saved as the reply it was shown as, so
a reload never draws a question with an unexplained empty space under it.

WHAT IT STILL DOES NOT DO, STATED PLAINLY: it reads no analytics data. The local application has
no completed first-run credential to query it with; when it does, the read joins THIS route — a
a tool call in front of the same pipeline — not a second endpoint.

NO FALLBACK, NO SUPPRESSION. A model failure is a 502 with the real reason in `error`, which the
seat draws as the reply — never a canned sentence standing in for the answer. Nothing here
catches an error to make the turn look fine.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import Any

import psycopg2
import psycopg2.extras
import requests
from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import services as state
from deps import get_user_id_from_header
from posthog_read import (
    PostHogReadError,
    get_conversation,
    list_conversations,
    remove_conversation,
    send_turn,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["ux"])

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")

# THE PRODUCT HAS NO ACCOUNT CREATION AT THE SEAT LEVEL (owner, 2026-10-18): accounts are
# created at the top of the organization, and a person takes on a team — there is no login
# screen inside the room. The demo account is seeded inside the local install (organization
# "Raibach IDS", team 1); this route signs it in SERVER-SIDE and hands the browser the
# session cookie for host `localhost`, which every port of the local install shares. The
# password lives in the backend's own env — never in the page, never in a reply.
_POSTHOG_URL = os.environ.get("POSTHOG_URL", "http://localhost:8200").rstrip("/")
_POSTHOG_DEMO_EMAIL = os.environ.get("POSTHOG_DEMO_EMAIL", "demo@raibach.net")
_POSTHOG_DEMO_PASSWORD = os.environ.get("POSTHOG_DEMO_PASSWORD", "")
# The team the demo account owns (seeded headlessly; TEAM 1 in the local install).
_POSTHOG_PROJECT_ID = os.environ.get("POSTHOG_PROJECT_ID", "1")


@router.post("/api/ux/posthog-login")
async def posthog_login():
    if not _POSTHOG_DEMO_PASSWORD:
        return JSONResponse(
            {"error": "POSTHOG_DEMO_PASSWORD is not set in the backend env — the seat cannot be signed in."},
            status_code=500,
        )
    try:
        resp = requests.post(
            f"{_POSTHOG_URL}/api/login",
            json={"email": _POSTHOG_DEMO_EMAIL, "password": _POSTHOG_DEMO_PASSWORD},
            timeout=15,
        )
    except Exception as exc:  # noqa: BLE001 — the real reason goes back, never a canned answer
        logger.exception("the analytics application's login endpoint was unreachable")
        return JSONResponse({"error": f"The sign-in call failed: {exc}"}, status_code=502)

    if resp.status_code != 200:
        return JSONResponse(
            {"error": f"The sign-in was refused ({resp.status_code}): {resp.text[:300]}"},
            status_code=502,
        )

    session_key = resp.cookies.get("sessionid")
    if not session_key:
        return JSONResponse(
            {"error": "The sign-in answered 200 but set no sessionid cookie — nothing to hand the frames."},
            status_code=502,
        )

    ## The cookie is scoped to the HOST, not the port: setting it from :8000 makes it present at
    # :8200 too, which is what signs the framed application in. HttpOnly keeps it out of page
    # scripts; SameSite=Lax is enough because all local ports are the same site.
    out = JSONResponse({"ok": True})
    out.headers.append("Set-Cookie", f"sessionid={session_key}; Path=/; HttpOnly; SameSite=Lax")
    return out


# ── THE UX TAB'S OWN THREAD ───────────────────────────────────────────────────────────────────
# ONE PACKAGE PER TAB IS THE DESIGN ROOM'S OWN ARCHITECTURE: `design_console` reads every tab as
# a `prompt_sessions` row with `metadata.session_type = 'design_tab'` and `design_tab = <tab>`,
# and that row owns the tab's conversation. The WRITER is
# `PromptSessionsAPI.get_or_create_design_tab` — the same helper the Tools route uses — so the
# three conversation tabs cannot drift apart again. This module keeps only the READ below.
_UX_TAB = "ux"


def _ux_tab_package(user_id: str) -> dict[str, Any] | None:
    """The UX tab's package row, or None when it has never been used. READ ONLY."""
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id::text AS id, conversation_id::text AS conversation_id
                  FROM prompt_sessions
                 WHERE user_id = %s
                   AND metadata->>'session_type' = 'design_tab'
                   AND metadata->>'design_tab' = %s
                 LIMIT 1
                """,
                (user_id, _UX_TAB),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def _is_seeded_intro(row: dict[str, Any]) -> bool:
    """A stored greeting from the old tab helper is not part of the conversation the welcome owns."""
    meta = row.get("metadata")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    return isinstance(meta, dict) and meta.get("kind") == "intro"


def _name_thread(user_id: str, conversation_id: str, question: str) -> None:
    """Name the thread from its first question — the same rule the teacher route uses.

    THE INTRODUCTION IS ALREADY THE FIRST MESSAGE, so the old empty-thread test
    (`message_count == 0`) can never be true for a tab with a seeded greeting. The title is
    renamed while it is still the tab's placeholder; once the first question has named it, a
    later turn leaves it alone.
    """
    if not state.conversation_api:
        return
    try:
        row = state.conversation_api.get_conversation(conversation_id, user_id) or {}
        title = str(row.get("title") or "")
        if title in ("New Chat", "Untitled Conversation", "Design — UX") or title.endswith(" - Chat"):
            state.conversation_api.update_conversation(conversation_id, user_id, title=question[:80])
    except Exception:
        # Naming is not the turn. It is logged where the app's logger reads, never swallowed.
        logger.exception("the UX thread could not be named from its first question")


def _ensure_ux_tab(user_id: str) -> dict[str, Any]:
    """The UX tab's package and primary conversation, created by the one Design-tab writer."""
    if not state.prompt_sessions_api:
        raise RuntimeError("the session store is not available")
    tab = state.prompt_sessions_api.get_or_create_design_tab(user_id=user_id, tab=_UX_TAB)
    if not tab:
        raise RuntimeError("the UX tab's package did not resolve (not created)")
    return tab


def _metadata_of(row: dict[str, Any]) -> dict[str, Any]:
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta) if meta.strip() else {}
        except (json.JSONDecodeError, ValueError):
            meta = {}
    return meta if isinstance(meta, dict) else {}


def _is_ux_session(row: dict[str, Any]) -> bool:
    """A row this door may read or point: the working UX tab or a kept UX visit.

    The working row is `design_tab | ux`. A save relabels it `design_session` and writes
    `surface: 'ux'` in the same act, so the kept card still says which tab reopens it. No
    other design row is a UX session.
    """
    meta = _metadata_of(row)
    return meta.get("design_tab") == _UX_TAB or meta.get("surface") == _UX_TAB


def _ux_session_row(user_id: str, session_id: str) -> dict[str, Any] | None:
    """One prompt session by id, read as its owner and only when it is a UX session."""
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id::text AS id, metadata
                  FROM prompt_sessions
                 WHERE id = %s AND user_id = %s
                 LIMIT 1
                """,
                (session_id, user_id),
            )
            row = cur.fetchone()
    if not row:
        return None
    row = dict(row)
    return row if _is_ux_session(row) else None


def _resolve_ux_session(user_id: str, session_id: str = "") -> str:
    """The session this request is about — named by the card, or the tab's working row.

    A named session that is not this person's UX session is refused; it is never silently
    replaced by the working row, which would draw one session's pointer under another's card.
    """
    wanted = str(session_id or "").strip()
    if wanted:
        row = _ux_session_row(user_id, wanted)
        if not row:
            raise LookupError("That session is not this person's UX session.")
        return str(row["id"])
    return str(_ensure_ux_tab(user_id)["packageId"])


def _read_design_conversation(user_id: str, conversation_id: str) -> dict[str, Any] | None:
    from routes.raibach_design import design_connection, resolve_tab

    tab = resolve_tab("ux", user_id)
    with design_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id::text AS id, title
                  FROM design_conversations
                 WHERE id = %s AND tab_id = %s AND user_id = %s
                """,
                (conversation_id, tab["id"], user_id),
            )
            row = cur.fetchone()
            if not row:
                return None
            cur.execute(
                "SELECT role, content FROM design_messages WHERE conversation_id = %s "
                "ORDER BY created_at, id",
                (conversation_id,),
            )
            messages = [
                {"role": str(message.get("role") or ""), "content": str(message.get("content") or "")}
                for message in cur.fetchall()
            ]
    return {"id": str(row["id"]), "title": str(row.get("title") or ""), "messages": messages}


def _delete_design_conversation(user_id: str, conversation_id: str) -> bool:
    from routes.raibach_design import design_connection, erase_conversation_row

    with design_connection() as conn:
        try:
            erase_conversation_row(conn, "ux", user_id, conversation_id)
            return True
        except LookupError:
            return False



class UxNotebookSave(BaseModel):
    title: str | None = None
    content: str = ""


# ── THE NOTEBOOK, SAVED ON THE UX CONVERSATION ────────────────────────────────────────────────
# The PostHog notebook is a document beside the chat. Our first form keeps that relationship in
# the UX conversation's own metadata: `ux_notebook` holds the title and the words. It is not a
# second chat and it is not a browser-only scratchpad; the conversation row is the proper place,
# and a reload reads the same notebook back.
@router.get("/api/ux/chat/notebook")
async def ux_notebook_get(x_user_id: str | None = Header(None, alias="X-User-ID")):
    uid = get_user_id_from_header(x_user_id)
    try:
        tab = _ensure_ux_tab(uid)
        conversation_id = tab["conversationId"]
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    "SELECT metadata->'ux_notebook' AS notebook FROM conversations WHERE id = %s",
                    (conversation_id,),
                )
                row = cur.fetchone()
        notebook = (row or {}).get("notebook") or {}
        if not isinstance(notebook, dict):
            notebook = {}
        return {
            "title": str(notebook.get("title") or "Untitled notebook"),
            "content": str(notebook.get("content") or ""),
            "updated_at": str(notebook.get("updated_at") or ""),
            "conversation_id": conversation_id,
        }
    except Exception as exc:  # noqa: BLE001 — the reason goes to the panel
        logger.exception("the UX notebook could not be read")
        return JSONResponse({"error": f"The notebook could not be read: {exc}"}, status_code=503)


@router.put("/api/ux/chat/notebook")
async def ux_notebook_save(
    request: UxNotebookSave,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    uid = get_user_id_from_header(x_user_id)
    try:
        tab = _ensure_ux_tab(uid)
        conversation_id = tab["conversationId"]
        title = (request.title or "Untitled notebook").strip() or "Untitled notebook"
        notebook = {
            "title": title,
            "content": request.content or "",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    UPDATE conversations
                       SET metadata = COALESCE(metadata, '{}'::jsonb)
                                      || jsonb_build_object('ux_notebook', %s::jsonb),
                           updated_at = NOW()
                     WHERE id = %s
                    """,
                    (json.dumps(notebook), conversation_id),
                )
            conn.commit()
        return {**notebook, "conversation_id": conversation_id}
    except Exception as exc:  # noqa: BLE001 — the reason goes to the panel
        logger.exception("the UX notebook could not be saved")
        return JSONResponse({"error": f"The notebook could not be saved: {exc}"}, status_code=503)


# ── THE DISCUSSION THREAD, UNDER THE UX PACKAGE ────────────────────────────────────────────────
# The discussion is a conversation of its own, hanging off the SAME UX package as the chat. It is
# not mixed into the chat thread, and it is not a browser-only panel: its messages are rows under
# the UX package, so a reload reads them back. The existing `/api/ux/posthog-chat` door carries
# the turns; this route only opens (or finds) the thread.
@router.post("/api/ux/chat/discussion")
async def ux_discussion_open(x_user_id: str | None = Header(None, alias="X-User-ID")):
    uid = get_user_id_from_header(x_user_id)
    if not state.conversation_api:
        return JSONResponse(
            {"error": "Database not available — the discussion cannot be opened."},
            status_code=503,
        )
    try:
        tab = _ensure_ux_tab(uid)
        package_id = tab["packageId"]
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(
                    """
                    SELECT id::text AS id
                      FROM conversations
                     WHERE session_id = %s AND user_id = %s
                       AND tab = 'discussion' AND (is_archived IS NOT TRUE)
                     ORDER BY updated_at DESC
                     LIMIT 1
                    """,
                    (package_id, uid),
                )
                row = cur.fetchone()
        if row and row.get("id"):
            return {
                "package_id": package_id,
                "conversation_id": str(row["id"]),
                "title": "Discussion about Product analytics",
            }
        conversation_id = state.conversation_api.create_conversation(
            uid,
            session_id=package_id,
            title="Discussion about Product analytics",
            metadata={"kind": "ux-discussion", "tab": "discussion"},
            tab="discussion",
        )
        return {
            "package_id": package_id,
            "conversation_id": str(conversation_id),
            "title": "Discussion about Product analytics",
        }
    except Exception as exc:  # noqa: BLE001 — the reason goes to the panel
        logger.exception("the UX discussion could not be opened")
        return JSONResponse({"error": f"The discussion could not be opened: {exc}"}, status_code=503)


@router.post("/api/ux/chat/new")
async def ux_chat_new(x_user_id: str | None = Header(None, alias="X-User-ID")):
    """A NEW UX CONVERSATION UNDER THE SAME UX PACKAGE.

    The package's primary pointer moves to the new conversation, so a reload opens the chat the
    person just started rather than the one it replaced. The discussion is a separate thread and
    is untouched.
    """
    uid = get_user_id_from_header(x_user_id)
    if not state.conversation_api:
        return JSONResponse({"error": "Database not available — a new chat cannot be opened."}, status_code=503)
    try:
        tab = _ensure_ux_tab(uid)
        package_id = tab["packageId"]
        conversation_id = state.conversation_api.create_conversation(
            uid,
            session_id=package_id,
            title="Product analytics chat",
            metadata={"kind": "ux-chat", "tab": "ux"},
            tab="ux",
        )
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s",
                    (conversation_id, package_id),
                )
            conn.commit()
        return {
            "package_id": package_id,
            "conversation_id": str(conversation_id),
        }
    except Exception as exc:  # noqa: BLE001 — the reason goes to the view
        logger.exception("a new UX conversation could not be opened")
        return JSONResponse({"error": f"A new chat could not be opened: {exc}"}, status_code=503)


@router.get("/api/ux/chat/thread")
async def ux_chat_thread(
    conversation_id: str | None = Query(None),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """THE SAVED UX THREAD — what this tab said last time, drawn again on load.

    `conversation_id` picks one of the tab's threads (the Recent-chats list opens them);
    without it, the newest one is answered. `conversation_id` null when the tab has never
    been spoken in: an empty thread with no id is the truth for a tab nobody has talked to
    yet, and the seat draws an empty output — not an error and not a stand-in sentence.
    """
    uid = get_user_id_from_header(x_user_id)
    if not state.conversation_api:
        return JSONResponse({"error": "Database not available — the UX thread cannot be read."}, status_code=503)
    picked = str(conversation_id or "").strip()
    try:
        # THE UX PACKAGE IS THE TURN'S PACKAGE. It is resolved by the one Design-tab writer,
        # so the thread read and the direct teacher turn name the same package. The UX tab's
        # own conversation is the package's primary conversation when no named one is asked.
        tab = _ensure_ux_tab(uid)
        package_id = tab["packageId"]
        if picked:
            # A NAMED THREAD MUST BE THIS USER'S — the same predicate every read uses.
            known = state.conversation_api.get_conversation(picked, uid)
            if not known:
                return JSONResponse(
                    {"error": "That conversation does not exist, or you may not read it."},
                    status_code=404,
                )
            target = picked
        else:
            target = str(tab.get("conversationId") or "")
    except Exception as exc:  # noqa: BLE001 — the reason goes to the seat, never a blank thread
        logger.exception("the UX thread could not be read")
        return JSONResponse({"error": f"The UX thread could not be read: {exc}"}, status_code=503)
    if not target:
        return {"package_id": package_id, "conversation_id": None, "messages": []}
    try:
        rows = state.conversation_api.get_messages(target, uid, limit=200)
    except Exception as exc:  # noqa: BLE001
        logger.exception("the UX thread's messages could not be read")
        return JSONResponse({"error": f"The UX thread could not be read: {exc}"}, status_code=503)
    return {
        "package_id": package_id,
        "conversation_id": target,
        "messages": [
            {"role": str(row.get("role") or ""), "content": str(row.get("content") or "")}
            for row in (rows or [])
            if not _is_seeded_intro(row)
        ],
    }


def _session_pointer(session_id: str) -> str:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute("select posthog_conversation_id from prompt_sessions where id=%s", (session_id,))
            row = cur.fetchone()
    return str(row[0]) if row and row[0] else ""


def _clear_session_pointer(session_id: str, conversation_id: str) -> None:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update prompt_sessions set posthog_conversation_id=null "
                "where id=%s and posthog_conversation_id=%s",
                (session_id, conversation_id),
            )
        conn.commit()


def _set_session_pointer(session_id: str, conversation_id: str) -> None:
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update prompt_sessions set posthog_conversation_id=%s, updated_at=now() where id=%s",
                (conversation_id, session_id),
            )
        conn.commit()


def _link_posthog_conversation(uid: str, data: dict[str, Any]) -> None:
    """THE SESSION POINTS AT THE APPLICATION'S CONVERSATION. It does not copy it.

    The conversation and its messages live in the vendor application (`ee_conversation` and its
    LangGraph checkpoints). The UI makes them look like this seat's; the session records the id
    it is showing so the card can name it. Nothing is mirrored, and nothing is restructured.
    """
    package = _ensure_ux_tab(uid)
    link = {
        "posthog_conversation_id": str(data.get("id") or ""),
        "posthog_conversation_title": str(data.get("title") or ""),
    }
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "update prompt_sessions set metadata = coalesce(metadata,'{}'::jsonb) || %s where id=%s",
                (psycopg2.extras.Json(link), package["packageId"]),
            )
        conn.commit()


@router.get("/api/ux/posthog/conversations")
async def posthog_conversations(x_user_id: str | None = Header(None, alias="X-User-ID")):
    """THE SESSION'S CONVERSATIONS — the ids this session owns, titled by the application."""
    get_user_id_from_header(x_user_id)
    try:
        return {"conversations": list_conversations()}
    except PostHogReadError as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)


@router.delete("/api/ux/posthog/conversations/{conversation_id}")
async def posthog_conversation_remove(
    conversation_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """REMOVE THE APPLICATION'S CONVERSATION — the vendor's own delete, at its own door."""
    uid = get_user_id_from_header(x_user_id)
    removed_design = await asyncio.to_thread(_delete_design_conversation, uid, conversation_id)
    if not removed_design:
        try:
            remove_conversation(conversation_id)
        except PostHogReadError as exc:
            return JSONResponse({"error": str(exc)}, status_code=502)
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "update prompt_sessions set posthog_conversation_id=null "
                    "where user_id=%s and posthog_conversation_id=%s",
                    (uid, conversation_id),
                )
            conn.commit()
    except Exception as exc:  # noqa: BLE001
        logger.exception("the removed conversation's pointer could not be cleared")
        return JSONResponse(
            {"error": f"The conversation was removed but the session still points at it: {exc}"},
            status_code=503,
        )
    return {"removed": conversation_id}


@router.get("/api/ux/session/conversation")
async def ux_session_conversation(
    session_id: str | None = Query(None),
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """THE SESSION'S CONVERSATION, READ FRESH FROM THE APPLICATION ON EVERY OPEN.

    `session_id` names the card being reopened. With none, the tab's working row is the
    session — that is the leave-and-return default. The row stores one pointer and nothing
    else: the application owns the thread.
    """
    uid = get_user_id_from_header(x_user_id)
    try:
        target = await asyncio.to_thread(_resolve_ux_session, uid, str(session_id or ""))
        pointer = await asyncio.to_thread(_session_pointer, target)
    except LookupError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": f"The session could not be read: {exc}"}, status_code=503)
    if not pointer:
        return {"session_id": target, "source": "", "conversation": None}
    design = await asyncio.to_thread(_read_design_conversation, uid, pointer)
    if design:
        return {"session_id": target, "source": "design", "conversation": design}
    try:
        data = await asyncio.to_thread(get_conversation, pointer)
    except PostHogReadError as exc:
        if "404" in str(exc) or "not_found" in str(exc):
            return {
                "session_id": target,
                "source": "posthog",
                "conversation": None,
                "unavailable": (
                    "PostHog has this conversation but its API will not return it yet: "
                    "an untitled conversation is filtered out of the retrieve door."
                ),
            }
        return JSONResponse({"error": str(exc)}, status_code=502)
    messages = [
        {
            "role": "user" if message.get("type") == "human" else "assistant",
            "content": str(message.get("content") or ""),
        }
        for message in data.get("messages", [])
        if str(message.get("content") or "").strip()
    ]
    return {
        "session_id": target,
        "source": "posthog",
        "conversation": {
            "id": data.get("id") or pointer,
            "title": data.get("title") or "",
            "messages": messages,
        },
    }


@router.post("/api/ux/session/conversation")
async def ux_session_conversation_set(request: Request, x_user_id: str | None = Header(None, alias="X-User-ID")):
    """POINT THE SESSION AT THE CONVERSATION THE PERSON IS LOOKING AT."""
    uid = get_user_id_from_header(x_user_id)
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse({"error": "The body is not valid JSON."}, status_code=400)
    conversation_id = str((body or {}).get("conversation_id") or "").strip()
    if not conversation_id:
        return JSONResponse({"error": "No conversation was given."}, status_code=400)
    try:
        target = await asyncio.to_thread(
            _resolve_ux_session, uid, str((body or {}).get("session_id") or "")
        )
        await asyncio.to_thread(_set_session_pointer, target, conversation_id)
    except LookupError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": f"The session could not be pointed at it: {exc}"}, status_code=503)
    return {"session_id": target, "conversation_id": conversation_id}


@router.post("/api/ux/session/save")
async def ux_session_save(request: Request, x_user_id: str | None = Header(None, alias="X-User-ID")):
    """KEEP THE SESSION AS ITS OWN CARD — the UX card, not the design tool's.

    The card is the session row: its pointer to PostHog's conversation, its own fields, and the
    console's card furniture. No conversation text is copied; the card names the session and the
    conversation is read from PostHog when the card is opened.
    """
    uid = get_user_id_from_header(x_user_id)
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse({"error": "The body is not valid JSON."}, status_code=400)
    session_id = str((body or {}).get("session_id") or "").strip()
    conversation_id = str((body or {}).get("conversation_id") or "").strip()
    try:
        target = await asyncio.to_thread(_resolve_ux_session, uid, session_id)
    except LookupError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": f"The session could not be read: {exc}"}, status_code=503)
    pointer = await asyncio.to_thread(_session_pointer, target)
    if not pointer and conversation_id:
        await asyncio.to_thread(_set_session_pointer, target, conversation_id)
        pointer = conversation_id
    if not pointer:
        return JSONResponse(
            {"error": "This session has no conversation yet. Open or start a conversation first."},
            status_code=409,
        )
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "update prompt_sessions set "
                    "title = coalesce(nullif(title,''), 'UX session'), "
                    "category = 'UX', status = 'Active', is_active = true, is_archived = false, "
                    "metadata = coalesce(metadata,'{}'::jsonb) || "
                    "jsonb_build_object('session_type','design_session','surface','ux'), "
                    "updated_at = now() where id=%s",
                    (target,),
                )
            conn.commit()
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": f"The card could not be created: {exc}"}, status_code=503)
    return {"saved": True, "session_id": target, "posthog_conversation_id": pointer}


@router.post("/api/ux/posthog/turn")
async def posthog_turn(request: Request, x_user_id: str | None = Header(None, alias="X-User-ID")):
    """ONE TURN ON THE APPLICATION'S CHAT. Our id is handed over; the application stores it."""
    uid = get_user_id_from_header(x_user_id)
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001
        return JSONResponse({"error": "The turn body is not valid JSON."}, status_code=400)
    question = str((body or {}).get("question") or "").strip()
    if not question:
        return JSONResponse({"error": "The turn has no question."}, status_code=400)
    session_id = str((body or {}).get("session_id") or "").strip()
    conversation_id = str((body or {}).get("conversation_id") or "").strip()
    try:
        target = await asyncio.to_thread(_resolve_ux_session, uid, session_id)
        if not conversation_id:
            conversation_id = await asyncio.to_thread(_session_pointer, target)
        if not conversation_id:
            conversation_id = str(uuid.uuid4())
        await asyncio.to_thread(_set_session_pointer, target, conversation_id)
    except LookupError as exc:
        return JSONResponse({"error": str(exc)}, status_code=404)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse({"error": f"The session could not record its conversation: {exc}"}, status_code=503)
    try:
        answer = await asyncio.to_thread(send_turn, conversation_id, question)
    except PostHogReadError as exc:
        return JSONResponse(
            {"error": str(exc), "conversation_id": conversation_id, "session_id": target},
            status_code=502,
        )
    return {"conversation_id": conversation_id, "session_id": target, "content": answer}


@router.get("/api/ux/posthog/conversations/{conversation_id}")
async def posthog_conversation(
    conversation_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """ONE CONVERSATION, LINKED TO THIS USER'S UX SESSION AND RETURNED FROM OUR OWN ROW."""
    uid = get_user_id_from_header(x_user_id)
    design = await asyncio.to_thread(_read_design_conversation, uid, conversation_id)
    if design:
        return {
            "conversation_id": design["id"],
            "title": design["title"],
            "messages": design["messages"],
            "source": "design",
        }
    try:
        data = get_conversation(conversation_id)
    except PostHogReadError as exc:
        return JSONResponse({"error": str(exc)}, status_code=502)
    messages = [
        {
            "role": "user" if message.get("type") == "human" else "assistant",
            "content": str(message.get("content") or ""),
        }
        for message in data.get("messages", [])
        if str(message.get("content") or "").strip()
    ]
    return {
        "conversation_id": data.get("id") or conversation_id,
        "title": data.get("title") or "",
        "messages": messages,
        "source": "posthog",
    }


@router.get("/api/ux/conversations")
async def ux_conversations(x_user_id: str | None = Header(None, alias="X-User-ID")):
    """THE TAB'S RECENT CHATS — the list their own chat draws under the composer.

    Read from the UX tab's package, newest first, with the title and the last-saved time the
    row already carries. Archived rows are left out: the list is what a person was just doing.
    """
    uid = get_user_id_from_header(x_user_id)
    if not state.conversation_api:
        return JSONResponse({"error": "Database not available — the chats cannot be listed."}, status_code=503)
    try:
        package = _ux_tab_package(uid)
        if not package:
            return {"conversations": []}
        rows = state.conversation_api.get_conversations_by_session(package["id"], uid, include_archived=False)
    except Exception as exc:  # noqa: BLE001
        logger.exception("the UX chats could not be listed")
        return JSONResponse({"error": f"The UX chats could not be listed: {exc}"}, status_code=503)
    return {
        "conversations": [
            {
                "id": str(row.get("id") or ""),
                "title": str(row.get("title") or "(untitled)"),
                "updated_at": str(row.get("updated_at") or ""),
            }
            for row in (rows or [])
            if str(row.get("id") or "")
        ]
    }


@router.post("/api/ux/posthog-chat")
async def posthog_chat(request: Request, x_user_id: str | None = Header(None, alias="X-User-ID")):
    """THE SEAT'S TURN GOES THROUGH THEIR OWN CHAT, AND ITS ANSWER COMES BACK AS OURS.

    The person types in OUR chat output; this route hands the words to the analytics
    application's own conversation pipeline — their endpoint, their agent workflow, their
    tools — and returns the assembled reply in the same `{content}` shape the seat already
    reads. That pipeline runs on OUR model today (the mounted factory patch, env-gated), so
    this is their chat, on our model, drawn by our chat output. No second application frame
    is mounted for it, and nothing of their UI is duplicated into the seat.

    THE TURN IS SAVED BEFORE IT IS SENT, AND THE REPLY AFTER IT ARRIVES. The conversation is
    ours (see the helpers above) and its id is the id the application is given, so both sides
    keep one thread and the app's own memory of the previous turns survives.

    A FAILURE IS SAID IN FULL. Their endpoint's status and words, a model return with no
    words, or an unreachable app all come back as `error` — the seat draws it as the reply,
    AND it is written into the thread so a reload shows what happened. Nothing here catches a
    failure to make the turn look fine.
    """
    try:
        body: dict[str, Any] = await request.json()
    except Exception:
        return JSONResponse({"error": "The request body was not JSON."}, status_code=400)

    question = str(body.get("question") or "").strip()
    if not question:
        return JSONResponse({"error": "A question is required."}, status_code=400)

    session_id = body.get("session_id")
    if not isinstance(session_id, str) or not session_id:
        session_id = None

    # THE CONTEXT THE PERSON ATTACHED (their own composer's "Add context" pill). It rides the
    # turn as one plain line in front of the question — the app's agent reads it as part of what
    # was said. Our stored copy of the turn keeps the question as typed; the context is metadata.
    context = str(body.get("context") or "").strip()
    turn_text = f"[Context: {context}]\n\n{question}" if context else question

    uid = get_user_id_from_header(x_user_id)
    if not state.conversation_api:
        return JSONResponse(
            {"error": "Database not available — the turn was not sent, because it could not be saved."},
            status_code=503,
        )

    def fail(conversation_id: str, said: str, status_code: int) -> JSONResponse:
        """A REFUSAL IS WRITTEN WHERE THE THREAD LIVES — a reload must not show a bare question."""
        try:
            state.conversation_api.add_message(
                conversation_id,
                uid,
                "assistant",
                said,
                {"kind": "ux-chat-error"},
                save_to_memory=False,
            )
        except Exception:
            logger.exception("a refused UX turn could not be written down")
        return JSONResponse({"error": said, "conversation_id": conversation_id}, status_code=status_code)

    conversation_id = str(body.get("conversation_id") or "").strip()
    if conversation_id:
        try:
            known = state.conversation_api.get_conversation(conversation_id, uid)
        except Exception as exc:  # noqa: BLE001
            logger.exception("the named UX conversation could not be read")
            return JSONResponse({"error": f"The conversation could not be read: {exc}"}, status_code=503)
        if not known:
            return JSONResponse(
                {"error": "That conversation does not exist, or you may not write to it."},
                status_code=404,
            )
    else:
        try:
            if not state.prompt_sessions_api:
                raise RuntimeError("the session store is not available")
            ux_tab = state.prompt_sessions_api.get_or_create_design_tab(user_id=uid, tab=_UX_TAB)
            if not ux_tab:
                raise RuntimeError("the UX tab's package did not resolve (not created)")
            conversation_id = ux_tab["conversationId"]
        except Exception as exc:  # noqa: BLE001
            logger.exception("the UX tab's thread could not be created")
            return JSONResponse({"error": f"The UX thread could not be created: {exc}"}, status_code=503)

    _name_thread(uid, conversation_id, question)

    # THE PERSON'S WORDS ARE SAVED BEFORE THE CALL — they said them, and a reload must show them.
    try:
        state.conversation_api.add_message(
            conversation_id,
            uid,
            "user",
            question,
            {"kind": "ux-chat", **(({"context": context}) if context else {})},
            save_to_memory=False,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("the UX turn could not be saved")
        return JSONResponse(
            {
                "error": f"The turn was not sent, because it could not be saved: {exc}",
                "conversation_id": conversation_id,
            },
            status_code=503,
        )

    try:
        http = requests.Session()
        login = http.post(
            f"{_POSTHOG_URL}/api/login",
            json={"email": _POSTHOG_DEMO_EMAIL, "password": _POSTHOG_DEMO_PASSWORD},
            timeout=15,
        )
        if login.status_code != 200:
            return fail(
                conversation_id,
                f"The application refused the session ({login.status_code}): {login.text[:200]}",
                502,
            )
        # THEIR COOKIES ARE `Secure` AND DOMAIN-SCOPED (measured: `localhost.local`). A browser
        # special-cases http://localhost and accepts them; an HTTP client correctly refuses to
        # replay them over plain http — which read as `401 not_authenticated` here. So the two
        # values are taken from the login response and presented EXPLICITLY on the request.
        session_key = login.cookies.get("sessionid") or http.cookies.get("sessionid")
        if not session_key:
            return fail(
                conversation_id,
                "The application's login answered 200 but set no session cookie.",
                502,
            )
        http.get(f"{_POSTHOG_URL}/", timeout=15)
        csrf = login.cookies.get("posthog_csrftoken") or http.cookies.get("posthog_csrftoken") or ""
        headers = {
            "Content-Type": "application/json",
            "Referer": f"{_POSTHOG_URL}/",
            "X-POSTHOG-SESSION-ID": session_id or conversation_id,
            "Cookie": f"sessionid={session_key}; posthog_csrftoken={csrf}",
        }
        if csrf:
            headers["X-CSRFToken"] = csrf

        # ONE ID, BOTH SIDES: the application is handed OUR conversation id, so its thread and
        # ours are the same thread — its memory of the previous turns survives, and a reload
        # neither starts a new application thread nor loses the app's own history.
        stream = http.post(
            f"{_POSTHOG_URL}/api/projects/{_POSTHOG_PROJECT_ID}/conversations/",
            json={"conversation": conversation_id, "content": turn_text, "trace_id": str(uuid.uuid4())},
            headers=headers,
            stream=True,
            timeout=150,
        )
        if stream.status_code != 200:
            return fail(
                conversation_id,
                f"Their chat refused the turn ({stream.status_code}): {stream.text[:300]}",
                502,
            )

        # THEIR STREAM DOES NOT DECLARE A CHARSET, and requests' guess turned an em dash into
        # `â€”` in the first wired reply (measured). The stream is UTF-8; say so explicitly.
        stream.encoding = "utf-8"

        # THE STREAM IS SSE: `event:` names and `data:` JSON lines. AI events carry a
        # CUMULATIVE snapshot of the assistant message (measured: "Hello", "Hello there",
        # "Hello there, welcome...") — so the LAST `ai` content is the finished reply, not a
        # concatenation of deltas. `event: conversation` lines carry ids/title/status and are
        # ignored here. AN ERROR EVENT IS NOT IGNORED: when the application's own agent fails
        # (measured 2026-10-19: `NotImplementedError` in `ee.hogai.core.runner`, an app-side
        # defect) the stream carries no `ai` content, and the reply must say WHAT the app said
        # rather than a blanket "no words".
        answer = ""
        current_event = ""
        last_event = ""
        app_error = ""
        for line in stream.iter_lines(decode_unicode=True):
            if not line:
                continue
            if line.startswith("event:"):
                current_event = line[len("event:"):].strip()
                continue
            if not line.startswith("data:"):
                continue
            payload = line[len("data:"):].strip()
            if not payload or not payload.startswith("{"):
                continue
            try:
                event = json.loads(payload)
            except Exception:
                continue
            kind = str(event.get("type") or current_event or "")
            if kind:
                last_event = kind
            if kind == "ai" and isinstance(event.get("content"), str):
                answer = event["content"]
            elif kind in ("error", "ai/failure") or current_event in ("error", "ai/failure"):
                said = event.get("content") or event.get("error") or event.get("message") or ""
                if isinstance(said, str) and said.strip():
                    app_error = said.strip()
    except Exception as exc:  # noqa: BLE001 — the real reason goes back to the seat, not away
        logger.exception("the UX chat door could not complete the application's turn")
        return fail(conversation_id, f"Their chat call failed: {exc}", 502)

    if not answer.strip():
        # AN EMPTY RETURN IS A REFUSAL, NOT AN ANSWER — the seat shows this sentence as the
        # reply; a canned response here would be error suppression.
        detail = ""
        if app_error:
            detail = f" — the application's agent said: {app_error[:400]}"
        elif last_event:
            detail = f" (the last event the application sent was `{last_event}`)"
        return fail(
            conversation_id,
            f"The application's chat finished with no words for this turn{detail}.",
            502,
        )

    saved = True
    save_error = ""
    try:
        state.conversation_api.add_message(
            conversation_id,
            uid,
            "assistant",
            answer,
            {"kind": "ux-chat"},
            save_to_memory=False,
        )
    except Exception as exc:  # noqa: BLE001 — the answer is real; its loss is said beside it
        saved = False
        save_error = str(exc)
        logger.exception("the UX reply could not be saved")

    response: dict[str, Any] = {"content": answer, "conversation_id": conversation_id, "saved": saved}
    if not saved:
        response["save_error"] = save_error
    return JSONResponse(response)

