"""surface_turns — the record of what a turn showed, and the replay path over it.

Phase 4 (see MILVUS-notes/phase-4-results-as-turns.md). Three jobs:

  record()          write the set a turn showed, asserting every id is eligible first
  replay()          reopen: the active set, its cards, and the missing rows with reasons
  resolve_ordinal() "number two" against the active set, or a refusal

NO MODEL CALL on the replay path. The active set is the newest row with a non-null message_id;
ties break on id DESC. A refresh writes a new row; nothing is ever mutated.
"""
from __future__ import annotations

import os
from typing import Any

import psycopg2
import psycopg2.extras

from console_lanes import fetch_cards_by_ids
from console_scope import ELIGIBILITY_VERSION

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")
DEFAULT_RETENTION = 50


class Refusal(Exception):
    """A reference that cannot be resolved. The message is what the person is told."""


def _conn():
    return psycopg2.connect(DATABASE_URL)


def record(
    *,
    conversation_id: str,
    user_id: str,
    message_id: str | None,
    plan: dict[str, Any],
    shown_ids: list[str],
    model_version: str,
    origin: str = "turn",
    namespace: str = "console",
) -> dict[str, Any]:
    """Write the set. Every id is checked against the predicate being recorded.

    A shown id that is not eligible under the recording version is a writer bug, not drift:
    it is refused here so a read-time "no longer eligible" can only mean the predicate moved.
    """
    ids = [str(i) for i in shown_ids]
    if ids:
        found = {str(row["id"]) for row in fetch_cards_by_ids(ids, user_id)}
        missing = [i for i in ids if i not in found]
        if missing:
            raise Refusal(
                "refusing to record a set with rows this console cannot draw: "
                + ", ".join(missing[:5])
            )

    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET app.current_user_id = %s", (user_id,))
            try:
                cur.execute(
                    """
                    INSERT INTO surface_turns
                        (message_id, conversation_id, plan, shown_ids, namespace,
                         model_version, eligibility_version, origin)
                    VALUES (%s, %s, %s::jsonb, %s, %s, %s, %s, %s)
                    RETURNING *
                    """,
                    (message_id, conversation_id, psycopg2.extras.Json(plan), ids,
                     namespace, model_version, ELIGIBILITY_VERSION, origin),
                )
                row = dict(cur.fetchone())
                conn.commit()
                return row
            except psycopg2.errors.UniqueViolation:
                # The turn already recorded its set. Idempotent: return the existing one.
                conn.rollback()
                cur.execute("SET app.current_user_id = %s", (user_id,))
                cur.execute(
                    "SELECT * FROM surface_turns WHERE message_id = %s AND namespace = %s AND origin = 'turn'",
                    (message_id, namespace),
                )
                return dict(cur.fetchone())


def active_set(conversation_id: str, namespace: str = "console") -> dict[str, Any] | None:
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT * FROM surface_turns
                 WHERE conversation_id = %s AND namespace = %s AND message_id IS NOT NULL
                 ORDER BY shown_at DESC, id DESC
                 LIMIT 1
                """,
                (conversation_id, namespace),
            )
            row = cur.fetchone()
            return dict(row) if row else None


def _classify_missing(ids: list[str], user_id: str) -> list[dict[str, str]]:
    """Why each id in the set is no longer on the surface. Never drops one silently."""
    if not ids:
        return []
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET app.current_user_id = %s", (user_id,))
            cur.execute(
                """
                SELECT ps.id::text AS id, ps.is_archived, ps.user_id::text AS owner_id,
                       EXISTS (SELECT 1 FROM session_permissions sp
                                WHERE sp.session_id = ps.id AND sp.user_id = %s) AS permitted
                  FROM prompt_sessions ps
                 WHERE ps.id::text = ANY(%s)
                """,
                (user_id, ids),
            )
            rows = {str(r["id"]): dict(r) for r in cur.fetchall()}

    out: list[dict[str, str]] = []
    for card_id in ids:
        row = rows.get(card_id)
        if row is None:
            reason = "deleted"
        elif row["owner_id"] != user_id and not row["permitted"]:
            reason = "not permitted"
        elif row["is_archived"]:
            reason = "archived"
        else:
            reason = "no longer eligible"
        out.append({"id": card_id, "reason": reason})
    return out


def replay(conversation_id: str, user_id: str, namespace: str = "console") -> dict[str, Any]:
    """Reopen: the active set restored, with the missing rows said, not drawn."""
    active = active_set(conversation_id, namespace)
    if not active:
        return {"active_turn_id": None, "unrecorded": True, "cards": [], "missing": [],
                "eligibility_drift": None}

    shown = [str(i) for i in (active.get("shown_ids") or [])]
    cards = fetch_cards_by_ids(shown, user_id)
    found = {str(c["id"]) for c in cards}
    missing_ids = [i for i in shown if i not in found]

    drift = None
    if str(active.get("eligibility_version") or "") != ELIGIBILITY_VERSION:
        drift = {"from": str(active.get("eligibility_version") or ""), "to": ELIGIBILITY_VERSION}

    return {
        "active_turn_id": str(active["id"]),
        "unrecorded": False,
        "cards": cards,
        "missing": _classify_missing(missing_ids, user_id),
        "eligibility_drift": drift,
        "origin": str(active.get("origin") or ""),
        "namespace": str(active.get("namespace") or "console"),
        "plan": active.get("plan") or {},
        "shown_ids": shown,
    }


def resolve_ordinal(
    conversation_id: str,
    user_id: str,
    ordinal: int,
    namespace: str = "console",
) -> dict[str, Any]:
    """'Number two' against the active set. Out of range is a refusal, never a clamp."""
    active = active_set(conversation_id, namespace)
    if not active:
        raise Refusal("there is no recorded set in this conversation yet")
    shown = [str(i) for i in (active.get("shown_ids") or [])]
    if ordinal < 1 or ordinal > len(shown):
        raise Refusal(f"the active set has {len(shown)} item(s); {ordinal} is not one of them")
    card_id = shown[ordinal - 1]
    cards = fetch_cards_by_ids([card_id], user_id)
    if not cards:
        raise Refusal("that item is no longer on the surface")
    return {
        "active_turn_id": str(active["id"]),
        "item_id": card_id,
        "card": cards[0],
        "ordinal": ordinal,
    }

def prune(conversation_id: str, keep: int | None = None, namespace: str = "console") -> dict[str, Any]:
    """Trim the conversation's recorded sets to its retention, never the active set.

    The invariant is "the active set always survives", not "this SQL deletes row N": a pruner
    rewrite that breaks it must fail the test, not pass a different implementation.
    """
    with _conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if keep is None:
                cur.execute(
                    "SELECT retention FROM surface_settings WHERE conversation_id = %s",
                    (conversation_id,),
                )
                row = cur.fetchone()
                keep = int(row["retention"]) if row else DEFAULT_RETENTION
            cur.execute(
                """
                WITH ranked AS (
                    SELECT id,
                           row_number() OVER (ORDER BY shown_at DESC, id DESC) AS rn,
                           (message_id IS NOT NULL) AS is_turn
                      FROM surface_turns
                     WHERE conversation_id = %s AND namespace = %s
                ),
                active AS (
                    SELECT id FROM ranked WHERE is_turn ORDER BY rn LIMIT 1
                )
                DELETE FROM surface_turns st
                 USING ranked r
                 WHERE st.id = r.id
                   AND r.rn > %s
                   AND st.id NOT IN (SELECT id FROM active)
                RETURNING st.id
                """,
                (conversation_id, namespace, int(keep)),
            )
            deleted = len(cur.fetchall())
            conn.commit()
            cur.execute(
                "SELECT count(*) AS n FROM surface_turns WHERE conversation_id = %s AND namespace = %s",
                (conversation_id, namespace),
            )
            return {"deleted": deleted, "remaining": int(cur.fetchone()["n"])}
