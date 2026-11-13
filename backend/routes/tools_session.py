"""THE TOOLS TAB'S OWN SESSION LIFECYCLE — its own file, not the shared read.

WHY THIS FILE EXISTS. Every design tab used to resolve its working row through one
shared read (`prompt_sessions_api.get_or_create_design_tab`). That read now serves
the tabs whose rule is "leave and return to the same row" — the UX tab — and its
wording says so. The Tools tab's rule is the opposite, and it is the owner's own
(2026-11-07): a press IS a new session; the seat greets once; an unkept visit
disappears; a kept visit is a card, opened only by the card. One rule written over
the shared read broke the other, so the Tools tab owns its two doors here, and
nothing else reads or writes its working row through the shared path.

THE TWO DOORS.
  open_tools_working_session — a press. It removes every leftover working row first
      (an abandoned visit disappears, and its conversation and messages go with it),
      then creates a fresh session with a fresh, empty conversation and returns the
      pair.
  read_tools_working_session — a read (the console's snapshot). It never creates,
      and it never returns a discarded row: an abandoned visit is gone, so the
      snapshot says so by returning nothing.

WHAT MUST NEVER MOVE IN HERE. The greeting, the ingest, the acceptance question and
the conversation turns are the seat's own process (the tools folder's own files) —
this module only owns which row a visit is.
"""
from __future__ import annotations

import json
import os
from typing import Any

import psycopg2
import psycopg2.extras

import services as state
from prompt_sessions_api import (
    DESIGN_TAB_PACKAGE_DESCRIPTIONS,
    DESIGN_TAB_PACKAGE_TITLES,
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")

TOOLS_TAB = "tools"


def _leftover_ids(user_id: str) -> list[str]:
    """Every working row this person's Tools tab still holds — kept or archived. A press
    starts over, so every one of them is a leftover and none of them may stand."""
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text
                  FROM prompt_sessions
                 WHERE user_id = %s
                   AND metadata->>'session_type' = 'design_tab'
                   AND metadata->>'design_tab' = %s
                """,
                (user_id, TOOLS_TAB),
            )
            return [str(row[0]) for row in cur.fetchall()]


def open_tools_working_session(user_id: str) -> dict[str, Any] | None:
    """A PRESS IS A NEW SESSION. The previous visit's row is removed outright — its
    conversation and messages cascade with it, which is what "an abandoned session
    disappears" means — and a fresh session with a fresh, empty conversation is made
    for this press alone."""
    if not state.prompt_sessions_api:
        raise RuntimeError("the session store is not available")
    for leftover in _leftover_ids(user_id):
        state.prompt_sessions_api.delete_session(leftover, user_id, permanent=True)
    title = DESIGN_TAB_PACKAGE_TITLES.get(TOOLS_TAB, "Design — Tools")
    description = DESIGN_TAB_PACKAGE_DESCRIPTIONS.get(TOOLS_TAB)
    created = state.prompt_sessions_api.create_session(
        user_id,
        title=title,
        description=description,
    )
    if not created or not created.get("id"):
        return None
    session_id = str(created["id"])
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                UPDATE prompt_sessions
                   SET metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb
                 WHERE id = %s
                """,
                (
                    json.dumps({"session_type": "design_tab", "design_tab": TOOLS_TAB}),
                    session_id,
                ),
            )
            conn.commit()
    conversation_id = str(created.get("conversation_id") or "")
    if not conversation_id:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id::text
                      FROM conversations
                     WHERE session_id = %s
                     ORDER BY created_at
                     LIMIT 1
                    """,
                    (session_id,),
                )
                row = cur.fetchone()
                conversation_id = str(row[0]) if row else ""
    return {"packageId": session_id, "conversationId": conversation_id}


def read_tools_working_session(user_id: str) -> dict[str, Any] | None:
    """THE CONSOLE'S READ of the tab's current working row. It never creates, and it
    never answers with a discarded row: a discarded visit is removed, not hidden."""
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT ps.id::text AS id, c.id::text AS conversation_id
                  FROM prompt_sessions ps
                  LEFT JOIN conversations c
                    ON ps.conversation_id = c.id
                   AND c.session_id = ps.id
                 WHERE ps.user_id = %s
                   AND ps.metadata->>'session_type' = 'design_tab'
                   AND ps.metadata->>'design_tab' = %s
                   AND COALESCE(ps.is_archived, false) = false
                 ORDER BY ps.updated_at DESC
                 LIMIT 1
                """,
                (user_id, TOOLS_TAB),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "packageId": str(row["id"]),
                "conversationId": str(row["conversation_id"] or ""),
            }
