"""THE DESIGN DATABASE'S HIERARCHY, CREATED AND SEEDED.

The structure is the application's own: a user at the top, one Design section under the
user, one Design package under the section, and the four rooms under the package — Chat,
Tools, Approve, UX. Every room's content names the room.

This file does two things and nothing else: it creates the hierarchy for the users it is
given, and it prints what it made. The content rows are moved later, one at a time, and each
move is recorded in `design_moves`.

Run from `backend/`:

    python3 -m design_db.seed                 # the default user
    python3 -m design_db.seed --all           # every user with Design rows

The identity database (`DATABASE_URL`) is read for the user's name and for the list of
Design users. The Design database (`DESIGN_DATABASE_URL`) is written. The two credentials
are separate on purpose.
"""
from __future__ import annotations

import argparse
import os
import sys

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv()

DEFAULT_USER_ID = os.getenv("DEFAULT_USER_ID", "00000000-0000-0000-0000-000000000001")

# THE FOUR ROOMS, IN THE ORDER THE RAIL DRAWS THEM. A room's key is the label the content
# carries; its title is what the person reads; its order is its place in the rail.
ROOMS = (
    ("chat", "Chat", 1),
    ("tools", "Tools", 2),
    ("approve", "Approve", 3),
    ("ux", "UX", 4),
)


def identity_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL is not set: the user's name cannot be read")
    return url


def design_url() -> str:
    url = os.getenv("DESIGN_DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DESIGN_DATABASE_URL is not set: the Design database is not known")
    return url


def read_user(identity_conn, user_id: str) -> dict | None:
    with identity_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            "SELECT id::text AS id, COALESCE(full_name, email, id::text) AS display_name "
            "FROM users WHERE id = %s",
            (user_id,),
        )
        row = cur.fetchone()
        return dict(row) if row else None


def design_users(identity_conn) -> list[str]:
    """Every user who owns a Design row today. The design labels are the source."""
    with identity_conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT user_id::text
              FROM prompt_sessions
             WHERE metadata->>'session_type' LIKE 'design%%'
                OR metadata->>'design_tab' IS NOT NULL
             ORDER BY user_id::text
            """
        )
        return [row[0] for row in cur.fetchall()]


def ensure_hierarchy(design_conn, user_id: str, display_name: str) -> dict:
    """Create the user mirror, section, package, and four rooms. Idempotent."""
    with design_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(
            """
            INSERT INTO design_users (id, display_name)
            VALUES (%s, %s)
            ON CONFLICT (id) DO UPDATE SET display_name = EXCLUDED.display_name
            RETURNING id::text AS id, display_name
            """,
            (user_id, display_name),
        )
        user = dict(cur.fetchone())

        cur.execute(
            """
            INSERT INTO design_sections (user_id, key, title)
            VALUES (%s, 'design', 'Design')
            ON CONFLICT (user_id, key) DO UPDATE SET title = EXCLUDED.title
            RETURNING id::text AS id, title
            """,
            (user_id,),
        )
        section = dict(cur.fetchone())

        cur.execute(
            """
            INSERT INTO design_packages (section_id, key, title)
            VALUES (%s, 'design', 'Design')
            ON CONFLICT (section_id, key) DO UPDATE SET title = EXCLUDED.title
            RETURNING id::text AS id, title
            """,
            (section["id"],),
        )
        package = dict(cur.fetchone())

        rooms = []
        for key, title, ordinal in ROOMS:
            cur.execute(
                """
                INSERT INTO design_tabs (package_id, key, title, ordinal)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (package_id, key) DO UPDATE
                    SET title = EXCLUDED.title, ordinal = EXCLUDED.ordinal
                RETURNING id::text AS id, key, title, ordinal
                """,
                (package["id"], key, title, ordinal),
            )
            rooms.append(dict(cur.fetchone()))

    return {"user": user, "section": section, "package": package, "rooms": rooms}


def main(argv: list[str]) -> int:
    parser = argparse.ArgumentParser(description="Create the Design hierarchy and seed it.")
    parser.add_argument("--user-id", default=DEFAULT_USER_ID, help="the user to seed")
    parser.add_argument("--all", action="store_true", help="every user with Design rows today")
    parser.add_argument("--schema", action="store_true", help="apply schema.sql first")
    args = parser.parse_args(argv)

    with psycopg2.connect(identity_url()) as identity_conn:
        users = design_users(identity_conn) if args.all else [args.user_id]
        rows = []
        for user_id in users:
            row = read_user(identity_conn, user_id)
            if not row:
                print(f"user {user_id} is not in the identity database — skipped", file=sys.stderr)
                continue
            rows.append(row)

    if not rows:
        print("no Design users to seed", file=sys.stderr)
        return 1

    with psycopg2.connect(design_url()) as design_conn:
        if args.schema:
            path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")
            with open(path, encoding="utf-8") as handle:
                with design_conn.cursor() as cur:
                    cur.execute(handle.read())
            design_conn.commit()
        for row in rows:
            made = ensure_hierarchy(design_conn, row["id"], row["display_name"])
            print(
                f"{made['user']['display_name']} ({made['user']['id']})\n"
                f"  section {made['section']['id']}\n"
                f"  package {made['package']['id']}\n"
                + "\n".join(
                    f"  room {room['key']:<8} {room['id']}" for room in made["rooms"]
                )
            )
        design_conn.commit()

    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
