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
import psycopg2.errors
import psycopg2.extras

import services as state
from prompt_sessions_api import (
    DESIGN_TAB_PACKAGE_DESCRIPTIONS,
    DESIGN_TAB_PACKAGE_TITLES,
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")

TOOLS_TAB = "tools"


def _leftover_rows(user_id: str) -> list[tuple[str, str]]:
    """Every working row this person's Tools tab still holds — kept or archived — with the
    press it was made for. A press starts over, so every row is a leftover except the one that
    carries THIS press's own name: that row is the session the press already has."""
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT id::text, COALESCE(metadata->>'press_id', '')
                  FROM prompt_sessions
                 WHERE user_id = %s
                   AND metadata->>'session_type' = 'design_tab'
                   AND metadata->>'design_tab' = %s
                """,
                (user_id, TOOLS_TAB),
            )
            return [(str(row[0]), str(row[1])) for row in cur.fetchall()]


def open_tools_working_session(user_id: str, press_id: str | None = None) -> dict[str, Any] | None:
    """A PRESS IS A NEW SESSION. The previous visit's row is removed outright — its
    conversation and messages cascade with it, which is what "an abandoned session
    disappears" means — and a fresh session with a fresh, empty conversation is made
    for this press alone.

    ONE PRESS ASKS THIS DOOR TWICE. The shell mounts once and the Tools engine assembles beside
    it, and the store allows one working row per person and tab (the index
    `idx_prompt_sessions_design_tab_per_user`). `press_id` is the press's own name, written with
    the marker: a call that finds the row already carrying THIS press's name answers with that
    row and makes nothing, so both calls of one press work in one session. The lock is what makes
    the two calls see each other instead of both sweeping and both creating."""
    if not state.prompt_sessions_api:
        raise RuntimeError("the session store is not available")
    key = f"design_tools:{user_id}"
    lock_conn = psycopg2.connect(DATABASE_URL)
    lock_cur = lock_conn.cursor()
    lock_cur.execute("SELECT pg_advisory_lock(hashtext(%s))", (key,))
    try:
        rows = _leftover_rows(user_id)
        if press_id:
            for _leftover, row_press in rows:
                if row_press == press_id:
                    return read_tools_working_session(user_id)
        for leftover, _row_press in rows:
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
        marker: dict[str, Any] = {"session_type": "design_tab", "design_tab": TOOLS_TAB}
        if press_id:
            marker["press_id"] = press_id
        try:
            with psycopg2.connect(DATABASE_URL) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        """
                        UPDATE prompt_sessions
                           SET metadata = COALESCE(metadata, '{}'::jsonb) || %s::jsonb
                         WHERE id = %s
                        """,
                        (json.dumps(marker), session_id),
                    )
                    conn.commit()
        except psycopg2.errors.UniqueViolation:
            # THE STORE ALREADY HOLDS THIS TAB'S WORKING ROW, and the only call that can have
            # installed it is the other call of this same press: the sweep above removed every
            # other row that held the marker. That row is the press's session, and the row made
            # here is a duplicate of it — nothing has been written to it yet, so it goes.
            state.prompt_sessions_api.delete_session(session_id, user_id, permanent=True)
            return read_tools_working_session(user_id)
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
    finally:
        try:
            lock_cur.execute("SELECT pg_advisory_unlock(hashtext(%s))", (key,))
        finally:
            lock_cur.close()
            lock_conn.close()


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
