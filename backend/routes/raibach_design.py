"""THE RAIBACH DESIGN API — THE NEW SCHEMA'S OWN DOOR.

Every read here connects only to `DESIGN_DATABASE_URL` and reads only the new relational
tables: `design_packages`, `design_tabs`, `design_records`, `design_conversations` and
`design_messages`. The legacy `prompt_sessions` and `conversations` tables are not named.

There is no factory and no fallback. A tab with no conversation returns `[]`. A tab that does
not exist raises. A database failure is not caught, formatted or replaced with an empty list;
it reaches the route's default error boundary with the raw traceback.
"""
from __future__ import annotations

import os
from typing import Generator

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends, Header
from psycopg2.extras import Json
from pydantic import BaseModel

from deps import get_user_id_from_header

router = APIRouter()

DESIGN_DATABASE_URL = os.getenv("DESIGN_DATABASE_URL", "")

# The URL segment the components use, and the room's key in `design_tabs`.
TAB_KEYS = {
    "design": "chat",
    "tools": "tools",
    "ux": "ux",
    "approve": "approve",
}


def _connect():
    # NO FALLBACK URL. An absent DESIGN_DATABASE_URL is a raw connection failure.
    return psycopg2.connect(DESIGN_DATABASE_URL)


def get_design_db() -> Generator:
    """One connection per request. The close is the only cleanup; no failure is caught."""
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


class CreateConversationRequest(BaseModel):
    """The caller names the new conversation. No system title, no greeting."""
    title: str


class AppendMessageRequest(BaseModel):
    """One turn, verbatim. The role is the caller's; the content is its words."""
    role: str
    content: str
    metadata: dict | None = None


def design_connection():
    """A connection for an internal caller (the teacher branch). The caller closes it."""
    return _connect()


def resolve_tab(tab_segment: str, user_id: str) -> dict:
    return _tab(tab_segment, user_id)


def create_conversation_row(db, tab_segment: str, user_id: str, title: str) -> dict:
    """The one conversation writer. No greeting, no pointer, no fallback row."""
    tab_row = _tab(tab_segment, user_id)
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            INSERT INTO design_conversations
                (tab_id, user_id, title, is_archived, created_at, updated_at)
            VALUES (%s, %s, %s, FALSE, NOW(), NOW())
            RETURNING id::text AS id, title, is_archived, created_at, updated_at
            """,
            (tab_row["id"], user_id, title),
        )
        row = dict(cur.fetchone())
    db.commit()
    row["tab"] = tab_row["key"]
    row["package_id"] = tab_row["id"]
    row["message_count"] = 0
    return row


def append_message_row(
    db,
    tab_segment: str,
    user_id: str,
    conversation_id: str,
    role: str,
    content: str,
    metadata: dict | None = None,
) -> dict:
    """The one message writer. The conversation must belong to this tab and person."""
    tab_row = _tab(tab_segment, user_id)
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            SELECT 1 FROM design_conversations
             WHERE id = %s AND tab_id = %s AND user_id = %s
            """,
            (conversation_id, tab_row["id"], user_id),
        )
        if not cur.fetchone():
            raise LookupError(
                f"conversation {conversation_id} does not belong to the {tab_segment} tab",
            )
        cur.execute(
            """
            INSERT INTO design_messages
                (conversation_id, role, content, metadata, created_at)
            VALUES (%s, %s, %s, %s, NOW())
            RETURNING id::text AS id, role, content, metadata, created_at
            """,
            (conversation_id, role, content, Json(metadata or {})),
        )
        row = dict(cur.fetchone())
        cur.execute(
            "UPDATE design_conversations SET updated_at = NOW() WHERE id = %s",
            (conversation_id,),
        )
    db.commit()
    return row


def erase_conversation_row(
    db,
    tab_segment: str,
    user_id: str,
    conversation_id: str,
) -> dict:
    """The one remove writer. The row and every message are erased — one level, no hidden
    history. A row that is not this tab's raises."""
    tab_row = _tab(tab_segment, user_id)
    with db.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            DELETE FROM design_conversations
             WHERE id = %s AND tab_id = %s AND user_id = %s
            RETURNING id::text AS id
            """,
            (conversation_id, tab_row["id"], user_id),
        )
        row = cur.fetchone()
        if not row:
            raise LookupError(
                f"conversation {conversation_id} does not belong to the {tab_segment} tab",
            )
    db.commit()
    return dict(row)


def _tab(tab_segment: str, user_id: str) -> dict:
    key = TAB_KEYS.get(tab_segment)
    if not key:
        raise LookupError(f"no Design tab is named {tab_segment}")
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT t.id::text AS id, t.key, t.title,
                       p.id::text AS package_id
                  FROM design_tabs t
                  JOIN design_packages p ON p.id = t.package_id
                  JOIN design_sections s ON s.id = p.section_id
                 WHERE s.user_id = %s AND t.key = %s
                """,
                (user_id, key),
            )
            row = cur.fetchone()
    if not row:
        raise LookupError(f"the {tab_segment} tab does not exist for this user")
    return dict(row)


def _conversations(tab_segment: str, user_id: str) -> list[dict]:
    tab = _tab(tab_segment, user_id)
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT c.id::text AS id, c.title, c.is_archived,
                       c.created_at, c.updated_at,
                       (SELECT count(*) FROM design_messages m
                         WHERE m.conversation_id = c.id) AS message_count
                  FROM design_conversations c
                 WHERE c.tab_id = %s AND c.user_id = %s
                 ORDER BY (COALESCE(c.metadata->>'kind', '') = 'ux-discussion'), c.updated_at DESC
                """,
                (tab["id"], user_id),
            )
            rows = [dict(row) for row in cur.fetchall()]
    for row in rows:
        row["tab"] = tab["key"]
        row["package_id"] = tab["id"]
    # ZERO IS A TRUE ANSWER. An empty list is returned; nothing is created to fill it.
    return rows


def _messages(tab_segment: str, conversation_id: str, user_id: str) -> dict:
    tab = _tab(tab_segment, user_id)
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT c.id
                  FROM design_conversations c
                 WHERE c.id = %s AND c.tab_id = %s AND c.user_id = %s
                """,
                (conversation_id, tab["id"], user_id),
            )
            if not cur.fetchone():
                raise LookupError(
                    f"conversation {conversation_id} does not belong to the {tab_segment} tab",
                )
            cur.execute(
                """
                SELECT id::text AS id, role, content, metadata, created_at
                  FROM design_messages
                 WHERE conversation_id = %s
                 ORDER BY created_at, id
                """,
                (conversation_id,),
            )
            messages = [dict(row) for row in cur.fetchall()]
    return {
        "conversation_id": conversation_id,
        "package_id": tab["id"],
        "messages": messages,
    }


@router.get("/api/raibach/{tab}/conversations")
def raibach_conversations(
    tab: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> list[dict]:
    user_id = get_user_id_from_header(x_user_id)
    return _conversations(tab, user_id)


@router.get("/api/raibach/{tab}/conversations/{conversation_id}/messages")
def raibach_messages(
    tab: str,
    conversation_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> dict:
    user_id = get_user_id_from_header(x_user_id)
    return _messages(tab, conversation_id, user_id)


@router.get("/api/raibach/approve/records")
def raibach_approve_records(
    x_user_id: str | None = Header(None, alias="X-User-ID"),
) -> list[dict]:
    """THE APPROVE TAB'S OWN ROWS — the review and approval records under its tab."""
    user_id = get_user_id_from_header(x_user_id)
    tab = _tab("approve", user_id)
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id::text AS id, kind, title, state, payload, created_at, updated_at
                  FROM design_records
                 WHERE tab_id = %s AND user_id = %s
                 ORDER BY updated_at DESC
                """,
                (tab["id"], user_id),
            )
            return [dict(row) for row in cur.fetchall()]


@router.post("/api/raibach/{tab}/conversations")
def create_design_conversation(
    tab: str,
    request: CreateConversationRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
    db=Depends(get_design_db),
) -> dict:
    """CREATE ONE CONVERSATION. The title is the caller's; no greeting is written."""
    user_id = get_user_id_from_header(x_user_id)
    return create_conversation_row(db, tab, user_id, request.title)


@router.post("/api/raibach/{tab}/conversations/{conversation_id}/messages")
def append_design_message(
    tab: str,
    conversation_id: str,
    message: AppendMessageRequest,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
    db=Depends(get_design_db),
) -> dict:
    """APPEND ONE TURN. The conversation must belong to this tab and this person."""
    user_id = get_user_id_from_header(x_user_id)
    return append_message_row(
        db, tab, user_id, conversation_id, message.role, message.content, message.metadata,
    )


@router.delete("/api/raibach/{tab}/conversations/{conversation_id}")
def remove_design_conversation(
    tab: str,
    conversation_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
    db=Depends(get_design_db),
) -> dict:
    """REMOVE ONE CONVERSATION. The row and every message are erased — one level, no hidden
    history. A conversation that does not belong to this tab raises."""
    user_id = get_user_id_from_header(x_user_id)
    return erase_conversation_row(db, tab, user_id, conversation_id)


def tabs_snapshot(user_id: str) -> dict:
    """The four tabs' package ids, conversation ids and the Approve review id."""
    out: dict[str, dict] = {}
    for segment in TAB_KEYS:
        tab = _tab(segment, user_id)
        rows = _conversations(segment, user_id)
        default = next((row for row in rows if row["message_count"] > 0), rows[0] if rows else None)
        out[segment] = {
            "packageId": tab["id"],
            "conversationId": default["id"] if default else "",
            "conversations": rows,
        }
    approve = _tab("approve", user_id)
    with _connect() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT payload->>'session_id' AS record_id
                  FROM design_records
                 WHERE tab_id = %s AND user_id = %s AND kind = 'review'
                 ORDER BY updated_at DESC
                 LIMIT 1
                """,
                (approve["id"], user_id),
            )
            row = cur.fetchone()
    out["approve"]["recordId"] = str(row["record_id"] or "") if row else ""
    return out
