"""MOVE THE DESIGN ENTRIES INTO THE DESIGN DATABASE, ONE BY ONE.

The source is the application's identity database (`DATABASE_URL`). The target is the Design
database (`DESIGN_DATABASE_URL`), whose hierarchy was created by `design_db.seed`.

The move is a copy. No source row is deleted, changed, or re-pointed. Every copied row is
recorded in `design_moves`, so the ledger is both the proof and the list of what remains:

    python3 -m design_db.move            # read and report; writes nothing
    python3 -m design_db.move --apply    # copy the entries and record each one

The mapping is the structure the owner named:
  * the old console and chat tab packages both feed the Chat room;
  * the old tools tab package and the saved Tools sessions feed the Tools room;
  * the old UX tab package feeds the UX room;
  * the approval requests and the review of a saved session feed the Approve room;
  * the design systems (the catalogues) stay at the Design package, not at a room;
  * element masters and their children are Tools cards.

The source comes with its own timestamps and its own ids. A conversation keeps its id, and
each message keeps its id, so the copied thread is the same thread, not a lookalike.
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid
from datetime import date, datetime
from decimal import Decimal

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from .seed import design_url, ensure_hierarchy, identity_url, read_user

load_dotenv()

DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")

# THE OLD LABELS, IN THE NEW ROOMS' WORDS. "console" and "chat" are two names for the Chat
# room; "approvals" and "approve" are the same door. A conversation under a saved Tools
# session carries design_tab="tools" and therefore lands in Tools.
TAB_ALIASES = {
    "console": "chat",
    "chat": "chat",
    "tools": "tools",
    "ux": "ux",
    "approve": "approve",
    "approvals": "approve",
}


def jsonable(value):
    """A row's value as JSON can carry it — the source datetime becomes its own stamp."""
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {k: jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [jsonable(v) for v in value]
    return value


def payload_of(row: dict, skip: tuple[str, ...] = ("id", "user_id")) -> dict:
    return {key: jsonable(value) for key, value in row.items() if key not in skip}


def tab_for(design_tab: str | None, conversation_tab: str | None) -> str:
    for candidate in (design_tab, conversation_tab):
        key = str(candidate or "").strip().lower()
        if key in TAB_ALIASES:
            return TAB_ALIASES[key]
    return "chat"


def ledger(cur, source_table: str, source_id, target_table: str, target_id, status: str, detail: dict) -> None:
    cur.execute(
        """
        INSERT INTO design_moves (source_table, source_id, target_table, target_id, status, detail)
        VALUES (%s, %s, %s, %s, %s, %s)
        ON CONFLICT (source_table, source_id) DO NOTHING
        """,
        (source_table, str(source_id), target_table, str(target_id), status, psycopg2.extras.Json(jsonable(detail))),
    )


def already_moved(cur, source_table: str, source_id) -> bool:
    """The ledger is the list of what is done. An event has no id of its own to collide on."""
    cur.execute(
        "SELECT 1 FROM design_moves WHERE source_table = %s AND source_id = %s",
        (source_table, str(source_id)),
    )
    return cur.fetchone() is not None


def source_design_tables(source_cur, user_id: str) -> list[dict]:
    """The old tab packages and saved sessions, with the room each one feeds."""
    source_cur.execute(
        """
        SELECT id::text AS id, title, metadata->>'session_type' AS kind,
               metadata->>'design_tab' AS design_tab
          FROM prompt_sessions
         WHERE user_id = %s
           AND metadata->>'session_type' IN ('design', 'design_tab', 'design_session')
         ORDER BY created_at
        """,
        (user_id,),
    )
    return [dict(row) for row in source_cur.fetchall()]


def source_conversations(source_cur, user_id: str) -> list[dict]:
    source_cur.execute(
        """
        SELECT c.id::text AS id, c.session_id::text AS session_id, c.title,
               c.is_archived, c.metadata, c.surface_state_json, c.surface_updated_at,
               c.created_at, c.updated_at, c.message_count, c.tab,
               ps.title AS package_title,
               ps.metadata->>'session_type' AS package_kind,
               ps.metadata->>'design_tab' AS package_tab
          FROM conversations c
          JOIN prompt_sessions ps ON ps.id = c.session_id
         WHERE (c.user_id = %s OR c.session_id IN (
                   SELECT session_id FROM session_permissions WHERE user_id = %s))
           AND ps.metadata->>'session_type' IN ('design_tab', 'design_session')
         ORDER BY c.updated_at DESC
        """,
        (user_id, user_id),
    )
    return [dict(row) for row in source_cur.fetchall()]


def messages_of(source_cur, conversation_id: str) -> list[dict]:
    source_cur.execute(
        """
        SELECT id::text AS id, role, content, metadata, created_at
          FROM conversation_messages
         WHERE conversation_id = %s
         ORDER BY created_at, id
        """,
        (conversation_id,),
    )
    return [dict(row) for row in source_cur.fetchall()]


def source_records(source_cur, user_id: str) -> list[dict]:
    source_cur.execute(
        """
        SELECT id::text AS id, title, description, category, status, is_archived,
               metadata, left_column_content, compiled_output, created_at, updated_at,
               last_accessed_at,
               metadata->>'session_type' AS kind, metadata->>'design_tab' AS design_tab
          FROM prompt_sessions
         WHERE user_id = %s
           AND metadata->>'session_type' IN
               ('design_session', 'design_master', 'design_child', 'design_catalogue')
         ORDER BY created_at
        """,
        (user_id,),
    )
    return [dict(row) for row in source_cur.fetchall()]


def source_requests(source_cur, user_id: str) -> list[dict]:
    source_cur.execute(
        """
        SELECT id, session_id, kind, subject, reason, requested_by::text AS requested_by,
               decision, decided_by::text AS decided_by, decided_at, note, at
          FROM design_requests
         WHERE requested_by = %s OR decided_by = %s OR requested_by IS NULL
         ORDER BY at
        """,
        (user_id, user_id),
    )
    return [dict(row) for row in source_cur.fetchall()]


def source_events(source_cur, element_ids: list[str]) -> dict[str, list[dict]]:
    """The element's own history, as it happened — activity, notes, versions, metrics."""
    out: dict[str, list[dict]] = {}
    if not element_ids:
        return out
    queries = {
        "design_element_activity": """
            SELECT id, element_id::text AS element_id, user_id::text AS user_id,
                   package_id::text AS package_id, session_id, actor, action, flow, detail, at
              FROM design_element_activity
             WHERE element_id = ANY(%s::uuid[])
             ORDER BY at
        """,
        "design_element_annotations": """
            SELECT id::text AS id, element_id::text AS element_id, kind, target, body,
                   author_user_id::text AS author_user_id, metadata, resolved_at,
                   created_at, updated_at
              FROM design_element_annotations
             WHERE element_id = ANY(%s::uuid[])
             ORDER BY created_at
        """,
        "design_element_versions": """
            SELECT id::text AS id, element_id::text AS element_id, version_number,
                   change_type, change_description, commit_hash, snapshot,
                   created_by_user_id::text AS created_by_user_id, created_at
              FROM design_element_versions
             WHERE element_id = ANY(%s::uuid[])
             ORDER BY version_number
        """,
        "design_element_metrics": """
            SELECT id, element_id::text AS element_id, metric, value, dimensions,
                   at, bucket_date, dims_hash, flow
              FROM design_element_metrics
             WHERE element_id = ANY(%s::uuid[])
             ORDER BY at
        """,
    }
    for table, query in queries.items():
        source_cur.execute(query, (element_ids,))
        out[table] = [dict(row) for row in source_cur.fetchall()]
    return out


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Move the Design entries into the Design database.")
    parser.add_argument("--user-id", default=DEFAULT_USER_ID)
    parser.add_argument("--apply", action="store_true", help="write the copy and the ledger")
    args = parser.parse_args(argv)

    with psycopg2.connect(identity_url()) as source_conn:
        source_conn.set_session(isolation_level="REPEATABLE READ", readonly=True)
        source = source_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        user = read_user(source_conn, args.user_id)
        if not user:
            print(f"user {args.user_id} is not in the identity database", file=sys.stderr)
            return 1

        packages = source_design_tables(source, args.user_id)
        conversations = source_conversations(source, args.user_id)
        records = source_records(source, args.user_id)
        requests = source_requests(source, args.user_id)
        element_ids = [r["id"] for r in records if r["kind"] in ("design_master", "design_child")]
        events = source_events(source, element_ids)

        # A ROOM FOR EVERY OLD PACKAGE. A conversation sits under its old package; the package's
        # label is the room. The old console and chat packages both name Chat.
        package_room = {
            row["id"]: tab_for(row["design_tab"], None)
            for row in packages
            if row["kind"] in ("design_tab", "design_session")
        }

        print(f"user: {user['display_name']} ({user['id']})")
        print(f"old design rows: {len(packages)}  conversations: {len(conversations)}  "
              f"records: {len(records)}  requests: {len(requests)}")
        for row in packages:
            print(f"  package {row['id'][:8]}  {row['kind']:<14} {row['design_tab'] or '':<8} "
                  f"{row['title']}")
        for row in conversations:
            room = package_room.get(row["session_id"]) or tab_for(row["package_tab"], row.get("tab"))
            print(f"  conversation {row['id'][:8]}  room={room:<8} messages={row['message_count']}  "
                  f"{row['title']}")
        for row in records:
            print(f"  record {row['id'][:8]}  {row['kind']:<16} {row['title']}")
        for row in requests:
            print(f"  request {row['id']}  {row['kind']:<12} {row['subject']}")
        for table, rows in events.items():
            if rows:
                print(f"  {table}: {len(rows)}")

        if not args.apply:
            print("\nread only. run with --apply to copy the entries.")
            return 0

        with psycopg2.connect(design_url()) as design_conn:
            made = ensure_hierarchy(design_conn, user["id"], user["display_name"])
            room_ids = {room["key"]: room["id"] for room in made["rooms"]}
            design = design_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

            # THE OLD STRUCTURE IS ACCOUNTED FOR TOO. The container is the section; the old tab
            # packages are the rooms. Their conversations follow.
            for row in packages:
                if row["kind"] == "design":
                    ledger(design, "prompt_sessions", row["id"], "design_sections",
                           made["section"]["id"], "structure", {"kind": "design"})
                elif row["kind"] == "design_tab":
                    room = package_room.get(row["id"]) or "chat"
                    ledger(design, "prompt_sessions", row["id"], "design_tabs",
                           room_ids[room], "structure",
                           {"kind": row["kind"], "design_tab": row["design_tab"]})
                # A `design_session` is a saved card, not a tab package. Its row is written to
                # design_records below; its conversations still travel through package_room.

            conversation_count = 0
            message_count = 0
            for row in conversations:
                room = package_room.get(row["session_id"]) or tab_for(row["package_tab"], row.get("tab"))
                tab_id = room_ids[room]
                design.execute(
                    """
                    INSERT INTO design_conversations
                        (id, tab_id, user_id, title, is_archived, metadata,
                         surface_state_json, surface_updated_at, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        row["id"], tab_id, user["id"], row["title"] or "(untitled)",
                        bool(row["is_archived"]),
                        psycopg2.extras.Json(jsonable(row.get("metadata") or {})),
                        row.get("surface_state_json"), row.get("surface_updated_at"),
                        row.get("created_at"), row.get("updated_at"),
                    ),
                )
                rows = messages_of(source, row["id"])
                for message in rows:
                    design.execute(
                        """
                        INSERT INTO design_messages
                            (id, conversation_id, role, content, metadata, created_at)
                        VALUES (%s, %s, %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (
                            message["id"], row["id"], message["role"], message["content"],
                            psycopg2.extras.Json(jsonable(message.get("metadata") or {})),
                            message.get("created_at"),
                        ),
                    )
                ledger(
                    design, "conversations", row["id"], "design_conversations", row["id"],
                    "moved",
                    {
                        "room": room,
                        "source_package": row["session_id"],
                        "source_package_title": row["package_title"],
                        "messages": len(rows),
                    },
                )
                conversation_count += 1
                message_count += len(rows)

            record_count = 0
            package_record_count = 0
            for row in records:
                kind = row["kind"]
                if kind == "design_catalogue":
                    design.execute(
                        """
                        INSERT INTO design_package_records
                            (id, package_id, user_id, kind, title, payload, created_at, updated_at)
                        VALUES (%s, %s, %s, 'system', %s, %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (
                            row["id"], made["package"]["id"], user["id"],
                            row["title"] or "(untitled)",
                            psycopg2.extras.Json(payload_of(row)),
                            row.get("created_at"), row.get("updated_at"),
                        ),
                    )
                    ledger(design, "prompt_sessions", row["id"], "design_package_records",
                           row["id"], "moved", {"kind": "system"})
                    package_record_count += 1
                    continue

                room = "tools" if kind in ("design_master", "design_child") else tab_for(row["design_tab"], None)
                tab_id = room_ids[room]
                record_kind = "session" if kind == "design_session" else "element"
                if kind == "design_child":
                    record_kind = "element-child"
                design.execute(
                    """
                    INSERT INTO design_records
                        (id, tab_id, user_id, kind, title, state, payload, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        row["id"], tab_id, user["id"], record_kind,
                        row["title"] or "(untitled)",
                        "archived" if row["is_archived"] else "open",
                        psycopg2.extras.Json(payload_of(row)),
                        row.get("created_at"), row.get("updated_at"),
                    ),
                )
                ledger(design, "prompt_sessions", row["id"], "design_records", row["id"],
                       "moved", {"kind": record_kind, "room": room})
                record_count += 1

                # THE APPROVE ROOM CARRIES THE REVIEW OF A SAVED SESSION. The session is Tools
                # work; its review is the approval. One record in each room, two different facts.
                if kind == "design_session":
                    review_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"design-review:{row['id']}"))
                    design.execute(
                        """
                        INSERT INTO design_records
                            (id, tab_id, user_id, kind, title, state, payload, created_at, updated_at)
                        VALUES (%s, %s, %s, 'review', %s, 'saved', %s, %s, %s)
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (
                            review_id, room_ids["approve"], user["id"],
                            row["title"] or "(untitled)",
                            psycopg2.extras.Json({
                                "session_id": row["id"],
                                "stage": "saved",
                                "stage_word": "not sent",
                                "owner_id": user["id"],
                            }),
                            row.get("created_at"), row.get("updated_at"),
                        ),
                    )
                    ledger(design, "prompt_sessions", f"review:{row['id']}",
                           "design_records", review_id, "moved",
                           {"kind": "review", "room": "approve", "session_id": row["id"]})

            request_count = 0
            for row in requests:
                target_id = str(uuid.uuid5(uuid.NAMESPACE_URL, f"design-request:{row['id']}"))
                design.execute(
                    """
                    INSERT INTO design_records
                        (id, tab_id, user_id, kind, title, state, payload, created_at, updated_at)
                    VALUES (%s, %s, %s, 'approval', %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO NOTHING
                    """,
                    (
                        target_id, room_ids["approve"], user["id"],
                        row["subject"] or "(untitled)", row["decision"] or "pending",
                        psycopg2.extras.Json(payload_of(row)),
                        row.get("at"), row.get("decided_at") or row.get("at"),
                    ),
                )
                ledger(design, "design_requests", row["id"], "design_records", target_id,
                       "moved", {"kind": "approval", "room": "approve"})
                request_count += 1

            event_count = 0
            for table, rows in events.items():
                kind = table.replace("design_element_", "")
                for row in rows:
                    element_id = row.get("element_id")
                    if already_moved(design, table, row.get("id")):
                        continue
                    design.execute(
                        """
                        INSERT INTO design_events (tab_id, user_id, kind, detail, at)
                        VALUES (%s, %s, %s, %s, COALESCE(%s, NOW()))
                        """,
                        (
                            room_ids["tools"], user["id"], kind,
                            psycopg2.extras.Json(payload_of(row)),
                            row.get("at") or row.get("created_at") or row.get("updated_at"),
                        ),
                    )
                    ledger(design, table, row.get("id"), "design_events", "",
                           "moved", {"element_id": element_id, "kind": kind})
                    event_count += 1

            design_conn.commit()

            # THE COPY IS CHECKED AGAINST THE SNAPSHOT IT WAS TAKEN FROM.
            design.execute("SELECT tab_id::text, count(*) FROM design_conversations "
                           "WHERE user_id = %s GROUP BY tab_id", (user["id"],))
            by_tab = {row["tab_id"]: row["count"] for row in design.fetchall()}
            print("\napplied:")
            print(f"  conversations: {conversation_count}  messages: {message_count}")
            print(f"  records: {record_count}  package records: {package_record_count}  "
                  f"requests: {request_count}  events: {event_count}")
            for key, tab_id in room_ids.items():
                print(f"  room {key:<8} conversations={by_tab.get(tab_id, 0)}")

        return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
