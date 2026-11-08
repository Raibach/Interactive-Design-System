"""CREATE THE DESIGN DATABASE AND ITS OWN ROLE.

The application's identity database and the Design database are separate on purpose. This
script creates the second one: a role that owns only the Design database, a database owned by
that role, and no connection from the public role. The password comes from the environment;
it is never written into this file.

Run from `backend/` with the application's own connection in `DATABASE_URL`:

    DESIGN_DB_PASSWORD=... python3 -m design_db.create

The role and database are created only if they are absent, so a second run changes nothing.
"""
from __future__ import annotations

import os
import sys

import psycopg2
from dotenv import load_dotenv

load_dotenv()

ADMIN_URL = os.getenv("DESIGN_DB_ADMIN_URL", os.getenv("DATABASE_URL", "")).strip()
DB_NAME = os.getenv("DESIGN_DB_NAME", "raibach_design").strip()
DB_ROLE = os.getenv("DESIGN_DB_ROLE", "design_app").strip()
DB_PASSWORD = os.getenv("DESIGN_DB_PASSWORD", "").strip()


def main() -> int:
    if not ADMIN_URL:
        print("DATABASE_URL is not set: the admin connection is not known", file=sys.stderr)
        return 1
    if not DB_PASSWORD:
        print("DESIGN_DB_PASSWORD is not set: the Design role cannot be given a password", file=sys.stderr)
        return 1

    # A PLAIN CONNECTION, NOT A `with` BLOCK. `CREATE DATABASE` cannot run inside a
    # transaction, and the context manager's connection can already hold one open on the
    # first cursor use; autocommit set on a connection that has begun is too late.
    conn = psycopg2.connect(ADMIN_URL)
    conn.autocommit = True
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname = %s", (DB_ROLE,))
            if cur.fetchone():
                cur.execute(f'ALTER ROLE "{DB_ROLE}" WITH LOGIN PASSWORD %s', (DB_PASSWORD,))
                print(f"role {DB_ROLE} already exists — password restated")
            else:
                cur.execute(f'CREATE ROLE "{DB_ROLE}" WITH LOGIN PASSWORD %s', (DB_PASSWORD,))
                print(f"role {DB_ROLE} created")

            cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (DB_NAME,))
            if cur.fetchone():
                print(f"database {DB_NAME} already exists — left in place")
            else:
                cur.execute(f'CREATE DATABASE "{DB_NAME}" OWNER "{DB_ROLE}"')
                print(f"database {DB_NAME} created and owned by {DB_ROLE}")

            cur.execute(f'REVOKE CONNECT ON DATABASE "{DB_NAME}" FROM PUBLIC')
            cur.execute(f'GRANT CONNECT ON DATABASE "{DB_NAME}" TO "{DB_ROLE}"')
            print(f"{DB_NAME}: PUBLIC cannot connect; {DB_ROLE} can")
    finally:
        conn.close()

    print(f"DESIGN_DATABASE_URL=postgresql://{DB_ROLE}:<password>@localhost:5432/{DB_NAME}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
