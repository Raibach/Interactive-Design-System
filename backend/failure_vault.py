"""THE FAILURE VAULT — one row per wall the system actually hit.

Owner, 2026-10-17: *"Let's lay down the foundational, zero-telemetry schema for that Next-Day
Failure Summary … capture only the raw infrastructure fractures … so your AI can manufacture
your morning report, allowing you to delete Langfuse permanently."*

THE RULE THIS FILE OBEYS: it records CONTRACTS BROKEN, never activity.
  — a provider that dropped the connection, timed out, or refused the request,
  — a model that answered with something the registry cannot accept.
Those are walls. A slow call, a successful call, a retry, a prompt, an answer, a token count,
a latency, a trace id: none of them are walls, and none of them are stored here.

One row is a confession, not a log line. That is why the table is five facts wide and why
`purge()` can drop the whole vault without losing any operational truth: the machine does not
depend on this table to run, and the report reads it, not the other way round.

Storage: the studio's own Postgres (`DATABASE_URL`), beside `usage_metrics` — never Langfuse.
A vault write that fails is printed, and never breaks the call it was reporting on.
"""

from __future__ import annotations

import os
import re
from datetime import datetime, timezone
from typing import Any


def _connect():
    """A short-lived connection to the studio's own database (same DSN as the pool)."""
    import psycopg2

    dsn = os.getenv("DATABASE_URL") or os.getenv("DATABASE_PUBLIC_URL") or ""
    if not dsn:
        raise RuntimeError("DATABASE_URL is not set — the failure vault has nowhere to write.")
    return psycopg2.connect(dsn, connect_timeout=3)


def failure_code(exc: BaseException | str) -> str:
    """The machine's own word for what broke — never a paraphrase.

    `HTTP_502` comes from the provider's own error text; `TIMEOUT` is the socket saying it
    gave up; anything else is the exception's type name. This is the `raw_code` the report
    prints, and it is copied, not interpreted.
    """
    text = str(exc)
    match = re.search(r"(?:Error code|status_code)[:= ]+(\d{3})", text)
    if match:
        return f"HTTP_{match.group(1)}"
    if "timed out" in text.lower() or "timeout" in text.lower():
        return "TIMEOUT"
    lowered = text.lower()
    if "connection" in lowered and ("refused" in lowered or "reset" in lowered or "error" in lowered):
        return "CONNECTION_DROPPED"
    return type(exc).__name__ if isinstance(exc, BaseException) else "UNCLASSIFIED"


def record_failure(
    component_id: str,
    error_type: str,
    raw_code: str | None = None,
    detail: str | None = None,
    user_id: str | None = None,
) -> None:
    """Write ONE confession. Never raises into the caller; a failed write is printed."""
    try:
        conn = _connect()
    except Exception as exc:  # noqa: BLE001 — the call that hit the wall must still return
        print(f"[vault] failure not recorded ({type(exc).__name__}: {exc}) — {component_id}")
        return
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO failure_snapshots
                       (component_id, error_type, raw_code, detail, user_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (component_id, error_type, raw_code, (detail or "")[:500] or None, user_id),
            )
    except Exception as exc:  # noqa: BLE001 — say it, never hide it
        print(f"[vault] failure not recorded ({type(exc).__name__}: {exc}) — {component_id}")
    finally:
        conn.close()


def morning_brief(since: datetime | None = None) -> dict[str, Any]:
    """The facts for the morning report — counts per wall, never a narrative.

    Grouped by (component, error type, raw code) so a repeated fracture reads as a count.
    `outcomes` counts what people did after the wall (only when a surface recorded it); an
    outcome nobody observed stays absent rather than being guessed.
    """
    try:
        conn = _connect()
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    try:
        with conn, conn.cursor() as cur:
            window_sql = "WHERE occurred_at >= %s" if since else ""
            params: tuple = (since,) if since else ()
            cur.execute(
                f"""
                SELECT component_id, error_type, raw_code,
                       COUNT(*)                        AS events,
                       MIN(occurred_at)                AS first_at,
                       MAX(occurred_at)                AS last_at,
                       COUNT(*) FILTER (WHERE outcome = 'retry_ok')     AS retry_ok,
                       COUNT(*) FILTER (WHERE outcome = 'retry_failed') AS retry_failed,
                       COUNT(*) FILTER (WHERE outcome = 'abandoned')    AS abandoned
                  FROM failure_snapshots
                  {window_sql}
                 GROUP BY component_id, error_type, raw_code
                 ORDER BY events DESC, last_at DESC
                """,
                params,
            )
            rows = cur.fetchall()
            cur.execute(f"SELECT COUNT(*) FROM failure_snapshots {window_sql}", params)
            total = int(cur.fetchone()[0])
        fractures = [
            {
                "component": r[0],
                "errorType": r[1],
                "rawCode": r[2],
                "events": int(r[3]),
                "firstAt": r[4].isoformat() if r[4] else None,
                "lastAt": r[5].isoformat() if r[5] else None,
                "outcomes": {
                    key: int(value)
                    for key, value in (("retry_ok", r[6]), ("retry_failed", r[7]), ("abandoned", r[8]))
                    if value
                },
            }
            for r in rows
        ]
        return {
            "status": "ok",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "totals": {"events": total, "fractures": len(fractures)},
            "fractures": fractures,
        }
    except Exception as exc:  # noqa: BLE001 — the real reason travels
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    finally:
        conn.close()


def purge() -> int:
    """Empty the vault. Returns how many confessions were dropped (the receipt for the purge)."""
    conn = _connect()
    try:
        with conn, conn.cursor() as cur:
            cur.execute("DELETE FROM failure_snapshots")
            return int(cur.rowcount or 0)
    finally:
        conn.close()
