"""Seed (and reset) the demo user's sandbox — the packages a visitor may play with.

WHY THIS EXISTS
───────────────
DEMO_MODE pins every request on the deployed demo to one identity (deps.DEMO_USER_ID).
That identity starts with nothing, and the demo would open onto an empty room — so this
script gives it copies of the packages the owner chooses to show. A VISITOR'S EDITS LAND
IN THESE COPIES, the ownership predicates keep the originals out of reach, and `--reset`
throws the copies away and makes fresh ones. That is what "the demo cannot damage it"
means in practice: the worst a visitor can do is make clutter this script deletes.

IT CLONES: the package row, its versions (as prompts), its non-archived conversations
and their messages, and the owner permission row. Rows are fetched ORDER BY created_at,
id (versions by version_number) so repeated resets produce the same order, and an
old→new id map carries every child pointer. The clone is MARKED (`metadata.cloned_from`)
so a second run skips what already exists instead of duplicating it.

WHAT IT DOES NOT DO: it does not touch memory rows, Milvus vectors, or the owner's own
data. Milvus has no user field on the version collection, so vectors written by demo
saves are orphaned by a reset rather than deleted — harmless, and named here so nobody
goes looking.

DRY BY DEFAULT, like its sibling scripts. Writing to a database is not something a
script should do because it was run.

    python seed_demo_data.py                    # what it would do
    python seed_demo_data.py --apply            # create the user, clone the sources
    python seed_demo_data.py --reset --apply    # wipe the sandbox, then re-clone

Reads DEMO_USER_ID, DEMO_USER_EMAIL and DEMO_SEED_SESSION_IDS from the environment (or
backend/.env); the defaults mirror deps.py's.

Exit codes: 0 when the dry run reported or the apply finished; 1 when the database could
not be read or a source is unusable — a script that could not look must not report that
there was nothing to see.
"""
from __future__ import annotations

import argparse
import os
import sys
import uuid

import psycopg2
from psycopg2.extras import Json, RealDictCursor

# Mirrors deps.DEMO_USER_ID's default. In a deployment both read the same env var; the
# default only decides local dry-runs.
DEMO_USER_ID_DEFAULT = "00000000-0000-0000-0000-000000000002"
DEMO_USER_EMAIL_DEFAULT = "demo@raibach.net"

# No credential opens this row: the hash is a placeholder, bcrypt refuses it, and the
# demo's door is the browser pin — the server pins identity regardless.
DEMO_PASSWORD_PLACEHOLDER = "demo_no_password_placeholder"

# ── READS ──────────────────────────────────────────────────────────────────────
# Explicit column lists, ordered deterministically. The clone must not depend on
# physical row order, or two resets of the same source produce two different demos.

SOURCE_SESSION = """
SELECT id, user_id, title, description, left_column_content, compiled_output,
       is_active, current_version, category, last_accessed_at, metadata,
       conversation_id, created_at, updated_at
FROM prompt_sessions
WHERE id = %s
"""

SOURCE_VERSIONS = """
SELECT version_number, left_column_content, compiled_output, change_description,
       change_type, overall_score, score_breakdown, created_at
FROM prompt_versions
WHERE session_id = %s
ORDER BY version_number ASC, created_at ASC, id ASC
"""

SOURCE_CONVERSATIONS = """
SELECT id, title, summary, message_count, metadata, surface_state_json,
       surface_updated_at, tab, created_at, updated_at
FROM conversations
WHERE session_id = %s AND COALESCE(deleted_at, '') = '' AND is_archived = FALSE
ORDER BY created_at ASC, id ASC
"""

SOURCE_MESSAGES = """
SELECT role, content, metadata, created_at
FROM conversation_messages
WHERE conversation_id = %s
ORDER BY created_at ASC, id ASC
"""

FIND_CLONE = """
SELECT id FROM prompt_sessions
WHERE user_id = %s AND metadata->>'cloned_from' = %s
LIMIT 1
"""

# ── WRITES ─────────────────────────────────────────────────────────────────────

INSERT_DEMO_USER = """
INSERT INTO users (id, email, password_hash, full_name, status, email_verified, role, prompt_role)
VALUES (%s, %s, %s, 'Demo Visitor', 'active', TRUE, 'student', 'product')
ON CONFLICT (id) DO NOTHING
"""

# The demo's own project. The shell creates a default project when a user has none
# (WritingAreaIndex's createProject path), and on the live demo that POST answered
# 403 on every first load until this row existed — the gate refuses what the
# sandbox never seeded. One row, named for what it is.
INSERT_DEMO_PROJECT = """
INSERT INTO projects (user_id, name, description)
VALUES (%s, 'Demo Workspace', 'The sandbox project the demo shell opens onto. Created by seed_demo_data.py.')
"""

FIND_DEMO_PROJECT = "SELECT id FROM projects WHERE user_id = %s LIMIT 1"

INSERT_SESSION = """
INSERT INTO prompt_sessions (
    id, user_id, title, description, left_column_content, compiled_output,
    is_active, is_archived, current_version, category, last_accessed_at,
    metadata, created_at, updated_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, FALSE, %s, %s, %s, %s, %s, %s)
"""

INSERT_PERMISSION = """
INSERT INTO session_permissions (session_id, user_id, role, granted_by)
VALUES (%s, %s, 'owner', %s)
"""

INSERT_VERSION = """
INSERT INTO prompt_versions (
    session_id, version_number, left_column_content, compiled_output,
    change_description, change_type, created_by_user_id, overall_score,
    score_breakdown, created_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
"""

INSERT_CONVERSATION = """
INSERT INTO conversations (
    id, session_id, created_by, user_id, title, summary, message_count,
    metadata, surface_state_json, surface_updated_at, is_archived, tab,
    created_at, updated_at
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, FALSE, %s, %s, %s)
"""

INSERT_MESSAGE = """
INSERT INTO conversation_messages (
    conversation_id, user_id, created_by, role, content, metadata, created_at
) VALUES (%s, %s, %s, %s, %s, %s, %s)
"""

POINT_SESSION_AT_CONVERSATION = "UPDATE prompt_sessions SET conversation_id = %s WHERE id = %s"


def database_url() -> str:
    """The environment's `DATABASE_URL`, or `backend/.env`'s — the sibling scripts' lookup.

    In a container the variable is simply there; on a workstation it lives in `.env` and
    nothing exports it, so a script that only read the environment would report "nothing
    to look at" on the machine where it is actually run.
    """
    url = os.getenv("DATABASE_URL")
    if url:
        return url
    env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
    if os.path.exists(env_path):
        with open(env_path, encoding="utf-8") as handle:
            for line in handle:
                if line.startswith("DATABASE_URL="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    raise SystemExit("DATABASE_URL is not set and backend/.env has none")


def find_existing_clone(cur, demo_id: str, source_id: str) -> str | None:
    cur.execute(FIND_CLONE, (demo_id, str(source_id)))
    row = cur.fetchone()
    return str(row["id"]) if row else None


def ensure_user(cur, demo_id: str, demo_email: str) -> None:
    cur.execute(INSERT_DEMO_USER, (demo_id, demo_email, DEMO_PASSWORD_PLACEHOLDER))


def ensure_project(cur, demo_id: str) -> bool:
    """True when a project already existed; False when one was created."""
    cur.execute(FIND_DEMO_PROJECT, (demo_id,))
    if cur.fetchone():
        return True
    cur.execute(INSERT_DEMO_PROJECT, (demo_id,))
    return False


def clone_session(cur, demo_id: str, source_id: str) -> tuple[str, dict]:
    """One source package becomes one demo-owned copy. Returns (new id, counts)."""
    cur.execute(SOURCE_SESSION, (source_id,))
    source = cur.fetchone()
    if not source:
        raise SystemExit(f"source package {source_id} does not exist — nothing to clone")
    if str(source["user_id"]) == demo_id:
        raise SystemExit(
            f"source package {source_id} is already owned by the demo user — "
            "DEMO_SEED_SESSION_IDS should name the OWNER's packages to copy, not demo ones"
        )

    new_id = str(uuid.uuid4())
    metadata = dict(source["metadata"] or {})
    metadata["cloned_from"] = str(source_id)
    cur.execute(
        INSERT_SESSION,
        (
            new_id, demo_id, source["title"], source["description"],
            source["left_column_content"], source["compiled_output"],
            source["is_active"], source["current_version"], source["category"],
            source["last_accessed_at"], Json(metadata),
            source["created_at"], source["updated_at"],
        ),
    )
    cur.execute(INSERT_PERMISSION, (new_id, demo_id, demo_id))

    cur.execute(SOURCE_VERSIONS, (source_id,))
    versions = cur.fetchall()
    for version in versions:
        cur.execute(
            INSERT_VERSION,
            (
                new_id, version["version_number"], version["left_column_content"],
                version["compiled_output"], version["change_description"],
                version["change_type"], demo_id, version["overall_score"],
                Json(version["score_breakdown"] or {}), version["created_at"],
            ),
        )

    conversation_map: dict[str, str] = {}
    messages_written = 0
    cur.execute(SOURCE_CONVERSATIONS, (source_id,))
    for conversation in cur.fetchall():
        new_conversation_id = str(uuid.uuid4())
        conversation_map[str(conversation["id"])] = new_conversation_id
        conversation_metadata = dict(conversation["metadata"] or {})
        # The console writes its package pointer into the conversation's metadata; a
        # copy that still pointed at the ORIGINAL would deep-link a visitor's chat
        # into the owner's package.
        if conversation_metadata.get("prompt_session_id"):
            conversation_metadata["prompt_session_id"] = new_id
        cur.execute(
            INSERT_CONVERSATION,
            (
                new_conversation_id, new_id, demo_id, demo_id, conversation["title"],
                conversation["summary"], conversation["message_count"],
                Json(conversation_metadata), conversation["surface_state_json"],
                conversation["surface_updated_at"], conversation["tab"],
                conversation["created_at"], conversation["updated_at"],
            ),
        )
        cur.execute(SOURCE_MESSAGES, (conversation["id"],))
        for message in cur.fetchall():
            cur.execute(
                INSERT_MESSAGE,
                (
                    new_conversation_id, demo_id, demo_id, message["role"],
                    message["content"], Json(message["metadata"] or {}),
                    message["created_at"],
                ),
            )
            messages_written += 1

    # Point the clone at its own conversation, mapped from the source's pointer; if the
    # source pointed at a conversation we did not copy (archived), use the first copy.
    target = None
    if source["conversation_id"]:
        target = conversation_map.get(str(source["conversation_id"]))
    if target is None and conversation_map:
        target = next(iter(conversation_map.values()))
    if target:
        cur.execute(POINT_SESSION_AT_CONVERSATION, (target, new_id))

    return new_id, {
        "versions": len(versions),
        "conversations": len(conversation_map),
        "messages": messages_written,
    }


def reset_sandbox(cur, demo_id: str) -> tuple[int, int]:
    """Throw away every demo-owned package and conversation. Returns (sessions, conversations).

    `prompt_versions` and the other session children cascade via their FKs; conversations
    carry no FK to sessions (the live database's schema is the authority on what exists),
    so they are deleted explicitly, and `session_permissions` rows likewise.

    The `::uuid[]` casts are load-bearing: `session_id = ANY(ARRAY['…'])` is
    `uuid = text` to Postgres (no such operator — measured 2026-10-02, the first real
    reset failed on exactly that), while a cast gives the array a type the column can
    compare against. The ids are stringified for the same reason.
    """
    cur.execute("SELECT id FROM prompt_sessions WHERE user_id = %s", (demo_id,))
    session_ids = [str(row["id"]) for row in cur.fetchall()]

    cur.execute(
        "DELETE FROM conversations WHERE user_id = %s OR session_id = ANY(%s::uuid[])",
        (demo_id, session_ids),
    )
    conversations_deleted = cur.rowcount
    cur.execute("DELETE FROM session_permissions WHERE session_id = ANY(%s::uuid[])", (session_ids,))
    cur.execute("DELETE FROM prompt_sessions WHERE id = ANY(%s::uuid[])", (session_ids,))
    return len(session_ids), conversations_deleted


def main() -> int:
    parser = argparse.ArgumentParser(description="Seed (or reset) the demo user's sandbox packages")
    parser.add_argument("--apply", action="store_true", help="write to the database (default: report only)")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="delete ALL demo-owned packages and conversations first, then re-clone",
    )
    args = parser.parse_args()

    demo_id = os.getenv("DEMO_USER_ID", DEMO_USER_ID_DEFAULT)
    demo_email = os.getenv("DEMO_USER_EMAIL", DEMO_USER_EMAIL_DEFAULT)
    sources = [s.strip() for s in os.getenv("DEMO_SEED_SESSION_IDS", "").split(",") if s.strip()]

    url = database_url()
    try:
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"the database could not be reached: {e}", file=sys.stderr)
        return 1

    try:
        cur = conn.cursor()

        # The demo user's email must not already belong to someone else — two people
        # under one address is how a demo login lands in a real account.
        cur.execute(
            "SELECT id FROM users WHERE lower(email) = %s AND deleted_at IS NULL",
            (demo_email.lower(),),
        )
        holder = cur.fetchone()
        if holder and str(holder["id"]) != demo_id:
            print(
                f"❌ {demo_email} already belongs to user {holder['id']} — refusing to seed. "
                "Pick another DEMO_USER_EMAIL or fix that row first.",
                file=sys.stderr,
            )
            return 1

        cur.execute("SELECT id, title FROM prompt_sessions WHERE user_id = %s", (demo_id,))
        owned = cur.fetchall()
        print(f"demo user: {demo_id} ({demo_email})")
        print(f"demo-owned packages now: {len(owned)}")
        cur.execute(FIND_DEMO_PROJECT, (demo_id,))
        print(
            "demo project: "
            + ("exists" if cur.fetchone() else "will create 'Demo Workspace'")
        )

        if not sources and not args.reset:
            print()
            print(
                "DEMO_SEED_SESSION_IDS is empty — nothing to clone. Set it to a comma-separated "
                "list of the OWNER's package UUIDs the demo should show."
            )
            return 0

        # What would happen, per source — the dry run's whole point is this list.
        print()
        plan: list[tuple[str, str, str]] = []
        for source_id in sources:
            cur.execute("SELECT id, title FROM prompt_sessions WHERE id = %s", (source_id,))
            source = cur.fetchone()
            if not source:
                plan.append((source_id, "(missing)", "MISSING — no such package; fix DEMO_SEED_SESSION_IDS"))
                continue
            existing = find_existing_clone(cur, demo_id, source_id)
            if existing and args.reset:
                verdict = f"already cloned as {existing} — --reset will replace it"
            elif existing:
                verdict = f"already cloned as {existing}"
            else:
                verdict = "will clone"
            plan.append((source_id, source["title"], verdict))
        for source_id, title, verdict in plan:
            print(f"  {source_id}  {title!r} — {verdict}")

        if not args.apply:
            print()
            if args.reset:
                print(
                    f"--reset: would delete {len(owned)} demo-owned package(s) and every demo "
                    "conversation, then re-clone."
                )
            print("dry run: nothing was written. Run again with --apply to do it.")
            return 0

        # ── THE APPLY ──────────────────────────────────────────────────────────
        ensure_user(cur, demo_id, demo_email)
        if not ensure_project(cur, demo_id):
            print("created the demo's project ('Demo Workspace')")

        if args.reset:
            sessions_deleted, conversations_deleted = reset_sandbox(cur, demo_id)
            print(
                f"reset: deleted {sessions_deleted} demo-owned package(s) and "
                f"{conversations_deleted} demo conversation(s)"
            )

        cloned = 0
        for source_id, _title, _verdict in plan:
            if find_existing_clone(cur, demo_id, source_id):
                continue
            try:
                new_id, counts = clone_session(cur, demo_id, source_id)
            except SystemExit as refusal:
                conn.rollback()
                print(f"❌ {refusal}", file=sys.stderr)
                return 1
            cloned += 1
            print(
                f"cloned {source_id} → {new_id} "
                f"({counts['versions']} version(s), {counts['conversations']} conversation(s), "
                f"{counts['messages']} message(s))"
            )

        conn.commit()

        # Read it back rather than trust the counts — the rule the siblings run on.
        cur.execute("SELECT count(*) AS n FROM prompt_sessions WHERE user_id = %s", (demo_id,))
        total = cur.fetchone()["n"]
        print(f"\napplied: {cloned} package(s) cloned. The demo user now owns {total} package(s).")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
