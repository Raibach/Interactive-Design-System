"""Give every package its owner's row in `session_permissions`.

WHY THIS EXISTS. §7 of `THE_PACKAGE_CONTRACT.md`: *"permission is a property of the package.
`session_permissions` holds one row per person per package, with a role. If you may open the package,
you may read and write every conversation inside it."* The row is what a share is, and what every
write check reads.

`create_conversation` did not write it, so a package whose conversation was created through that path
had no row for its own owner. Measured 2026-09-30/10-01, in both databases: 3 of 12 conversations sat
in packages with `perms 0` — `50e0a193` (two conversations) and `1d61cd4c` (one) — and every other
package had exactly one. The code path is fixed in the same change (`conversation_api.create_conversation`
now fills the absence on the way out), so this script is for the rows that already exist, not for the
ones to come.

IT DOES NOT DECIDE ANYTHING. A row is added only where the package has NO row at all for that user —
never where one exists under another role, and never for a user who is not already the owner of the
conversation. It reads the pair from `conversations` itself, which is the same source of truth §7
names, so it cannot invent a share that nobody made.

DRY BY DEFAULT. Writing to a database is not something a script should do because it was run; `--apply`
is the instruction, and the dry run prints exactly the rows the apply would insert.

    python backfill_session_permissions.py              # what it would do
    python backfill_session_permissions.py --apply      # do it

Exit codes: 0 when the database matches what the contract asks, 0 after applying, 1 when the read
itself failed — a script that could not look must not report that there was nothing to see.
"""
from __future__ import annotations

import argparse
import os
import sys

import psycopg2
from psycopg2.extras import RealDictCursor


# The pairs §7 asks about: a package with a conversation, and no row for the conversation's own user.
# Read from `conversations` and NOT from a list of ids, so a package created after this was written is
# included the next time it runs rather than needing an edit here.
GAPS = """
    SELECT cv.session_id, cv.user_id, count(*) AS conversations
    FROM conversations cv
    WHERE NOT EXISTS (
        SELECT 1 FROM session_permissions p
        WHERE p.session_id = cv.session_id AND p.user_id = cv.user_id
    )
    GROUP BY cv.session_id, cv.user_id
    ORDER BY cv.session_id
"""

FILL = """
    INSERT INTO session_permissions (session_id, user_id, role, granted_by)
    VALUES (%s, %s, 'owner', %s)
    ON CONFLICT (session_id, user_id) DO NOTHING
"""


def database_url() -> str:
    """The environment's `DATABASE_URL`, or `backend/.env`'s — the same lookup the sibling scripts use.

    In a container the variable is simply there; on a workstation it lives in `.env` and nothing
    exports it, so a script that only read the environment would report "nothing to look at" on the
    machine where it is actually run. `init_db.py` reads the environment alone and says so; these
    repair scripts are run by a person, so they fall back the way `backfill_element_activity.py` does.
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


def main() -> int:
    parser = argparse.ArgumentParser(description="Give packages their owner's session_permissions row")
    parser.add_argument("--apply", action="store_true", help="write the rows (default: report only)")
    args = parser.parse_args()

    url = database_url()

    try:
        conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
    except Exception as e:
        print(f"the database could not be reached: {e}", file=sys.stderr)
        return 1

    try:
        cur = conn.cursor()
        cur.execute(GAPS)
        gaps = cur.fetchall()

        print(f"packages with a conversation and no row for its own user: {len(gaps)}")
        for row in gaps:
            print(
                f"  session {row['session_id']}  user {row['user_id']}  "
                f"({row['conversations']} conversation(s))"
            )

        if not gaps:
            print("nothing to do — every package holds its owner's row")
            return 0

        if not args.apply:
            print()
            print("dry run: nothing was written. Run again with --apply to insert the rows above.")
            return 0

        written = 0
        for row in gaps:
            cur.execute(FILL, (row["session_id"], row["user_id"], row["user_id"]))
            written += cur.rowcount
        conn.commit()
        print()
        print(f"applied: {written} row(s) inserted (a package that already had a row is untouched)")

        # Read it back rather than trust the count — the same rule the rest of this repository runs on.
        cur.execute(GAPS)
        remaining = cur.fetchall()
        print(f"packages still without their owner's row: {len(remaining)}")
        for row in remaining:
            print(f"  STILL MISSING session {row['session_id']} user {row['user_id']}")
        return 0
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
