"""THE UX CHAT DOOR — POST /api/ux/posthog-chat, GET /api/ux/chat/thread.

WHAT THIS IS. The Design room's UX tab is where the analytics application (the PostHog code we
took over) works. The person talks to it through the room's own chat output — the seat's thread
is the conversation surface — and this route is what that conversation calls. The answer comes
from OUR model: `query_llm`, the same one model every mode of this application runs on, with its
key in `.env`. It does not call the analytics application's own assistant, and it never will:
that agent lives in the application's enterprise-licensed code (hardwired to a model we do not
use) and is not ours to reuse.

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
tool call in front of the same `query_llm` — not a second endpoint.

NO FALLBACK, NO SUPPRESSION. A model failure is a 502 with the real reason in `error`, which the
seat draws as the reply — never a canned sentence standing in for the answer. Nothing here
catches an error to make the turn look fine.
"""

from __future__ import annotations

import json
import logging
import os
import uuid
from typing import Any

import psycopg2
import psycopg2.extras
import requests
from fastapi import APIRouter, Header, Query, Request
from fastapi.responses import JSONResponse

import services as state
from deps import get_user_id_from_header

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
# and that row owns the tab's conversation. This is the writer for the UX tab's row — the same
# shape, nothing new. The thread's row therefore lives under the tab's package, NOT under the
# Design container, which is why it never appears in the Design room's own conversation list.
_UX_TAB = "ux"
_UX_PACKAGE_TITLE = "Design — UX"
_UX_PACKAGE_DESCRIPTION = (
    "The Design room's UX tab — the analytics application's conversation, saved under its own tab."
)


def _ux_tab_package(user_id: str) -> dict[str, Any] | None:
    """The UX tab's package row, or None when it has never been used."""
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


def _create_ux_package(user_id: str) -> dict[str, Any] | None:
    """Create the UX tab's package through the application's own session path."""
    if not state.prompt_sessions_api:
        return None
    created = state.prompt_sessions_api.create_session(
        user_id,
        title=_UX_PACKAGE_TITLE,
        description=_UX_PACKAGE_DESCRIPTION,
    )
    if not created or not created.get("id"):
        return None
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE prompt_sessions
                   SET metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb
                 WHERE id = %s
                """,
                (json.dumps({"session_type": "design_tab", "design_tab": _UX_TAB}), created["id"]),
            )
        conn.commit()
    return {
        "id": str(created["id"]),
        "conversation_id": str(created["conversation_id"]) if created.get("conversation_id") else None,
    }


def _ensure_ux_thread(user_id: str, question: str) -> tuple[str, str]:
    """(package id, conversation id) for the UX tab, created on the first turn that needs it."""
    package = _ux_tab_package(user_id)
    if not package:
        try:
            package = _create_ux_package(user_id)
        except Exception:
            # The partial unique index holds "one design_tab row per user per tab", so a second
            # creator loses the insert — re-read the winner instead of reporting a failure.
            package = _ux_tab_package(user_id)
            if not package:
                raise
    if not package:
        raise RuntimeError("the UX tab's package could not be created")
    conversation_id = package.get("conversation_id") or ""
    if not conversation_id:
        if not state.conversation_api:
            raise RuntimeError("the conversation store is not available")
        conversation_id = state.conversation_api.create_conversation(
            user_id,
            session_id=package["id"],
            title=(question[:80] or "Design — UX Chat"),
            metadata={"kind": "ux-chat", "tab": _UX_TAB},
            tab=_UX_TAB,
        )
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s",
                    (conversation_id, package["id"]),
                )
            conn.commit()
    return package["id"], conversation_id


def _name_thread(user_id: str, conversation_id: str, question: str) -> None:
    """Name the thread from its first question — the same rule the teacher route uses."""
    if not state.conversation_api:
        return
    try:
        row = state.conversation_api.get_conversation(conversation_id, user_id) or {}
        if int(row.get("message_count") or 0) == 0:
            state.conversation_api.update_conversation(conversation_id, user_id, title=question[:80])
    except Exception:
        # Naming is not the turn. It is logged where the app's logger reads, never swallowed.
        logger.exception("the UX thread could not be named from its first question")


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
            package = _ux_tab_package(uid)
            target = str(package.get("conversation_id") or "") if package else ""
    except Exception as exc:  # noqa: BLE001 — the reason goes to the seat, never a blank thread
        logger.exception("the UX thread could not be read")
        return JSONResponse({"error": f"The UX thread could not be read: {exc}"}, status_code=503)
    if not target:
        return {"conversation_id": None, "messages": []}
    try:
        rows = state.conversation_api.get_messages(target, uid, limit=200)
    except Exception as exc:  # noqa: BLE001
        logger.exception("the UX thread's messages could not be read")
        return JSONResponse({"error": f"The UX thread could not be read: {exc}"}, status_code=503)
    return {
        "conversation_id": target,
        "messages": [
            {"role": str(row.get("role") or ""), "content": str(row.get("content") or "")}
            for row in (rows or [])
        ],
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
            _, conversation_id = _ensure_ux_thread(uid, question)
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

