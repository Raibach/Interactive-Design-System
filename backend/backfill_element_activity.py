"""Bring the ingest's existing events into the design section's trail.

WHAT WAS ALREADY TRUE. Every ingest event has been recorded since the tool was built, in
`figma_ingest_activity` — the node, the tag, what was written, the verdict and the reason. What had
never happened is the MATCH: those events sat in their own log while the design section had no
element for them to belong to. Now that every catalogue component has a row
(`sync_design_elements.py`), 68 of those events name a component we hold, and this copies them into
that component's trail.

WHY A COPY AND NOT A VIEW. The ingest's log is the tool's own record of its work — its jobs, its
failures, its retries. The design section's trail is what a person reads when they open a component:
what happened to THIS element, when, and how it ended. They answer different questions, so the
element's trail is written in the element's terms (an action, a verdict, what changed) and keeps a
pointer back to the event it came from.

IDEMPOTENT. Each copied entry records the ingest event's id in its own detail, so running this again
adds nothing.

Usage:  .venv/bin/python backfill_element_activity.py
"""
from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from prompt_sessions_api import PromptSessionsAPI  # noqa: E402

DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")


def database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    for line in open(env_path):
        if line.startswith("DATABASE_URL="):
            return line.split("=", 1)[1].strip().strip('"')
    raise SystemExit("DATABASE_URL is not set and backend/.env has none")


def main() -> None:
    api = PromptSessionsAPI(database_url())
    copied = skipped = unmatched = 0
    with api.get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT id, at, kind, actor, tag, node_id, node_name, job_id, verdict, reason,
                      written, rejected, error, note
                 FROM figma_ingest_activity
                WHERE tag IS NOT NULL
                ORDER BY at"""
        )
        events = cur.fetchall()
        for event in events:
            if isinstance(event, dict):
                e = event
            else:
                keys = ("id", "at", "kind", "actor", "tag", "node_id", "node_name", "job_id",
                        "verdict", "reason", "written", "rejected", "error", "note")
                e = dict(zip(keys, event))
            cur.execute(
                """SELECT id FROM prompt_sessions
                    WHERE user_id = %s AND metadata->>'session_type' = 'design_master'
                      AND metadata->>'element_key' = %s LIMIT 1""",
                (DEFAULT_USER_ID, e["tag"]),
            )
            element = cur.fetchone()
            if not element:
                unmatched += 1
                continue
            element_id = element["id"] if isinstance(element, dict) else element[0]
            cur.execute(
                """SELECT 1 FROM design_element_activity
                    WHERE element_id = %s AND detail->>'ingest_event_id' = %s LIMIT 1""",
                (element_id, str(e["id"])),
            )
            if cur.fetchone():
                skipped += 1
                continue
            detail = {
                "ingest_event_id": str(e["id"]),
                # The ingest's own actor string, kept whole here rather than in the trail's column:
                # that column says what KIND of actor (ingest, user, catalogue-sync) and is short by
                # design, and the original is a label — it was long enough to overflow it once.
                "actor": e.get("actor"),
                "node_id": e.get("node_id"),
                "node_name": e.get("node_name"),
                "job_id": e.get("job_id"),
                "verdict": e.get("verdict"),
                "reason": e.get("reason"),
                "written": e.get("written"),
                "rejected": e.get("rejected"),
                "error": e.get("error"),
                "note": e.get("note"),
            }
            cur.execute(
                """INSERT INTO design_element_activity (element_id, user_id, actor, action, detail, at)
                   VALUES (%s, NULL, %s, %s, %s::jsonb, %s)""",
                (element_id, "ingest", str(e.get("kind") or "ingested"),
                 json.dumps(detail), e.get("at")),
            )
            copied += 1
        conn.commit()
        cur.close()
    print(f"  events copied into element trails: {copied}")
    print(f"  already present (skipped):        {skipped}")
    print(f"  events naming no element we hold: {unmatched}")


if __name__ == "__main__":
    main()
