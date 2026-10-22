"""Create the event store's schema in ClickHouse.

Run from `backend/`:

    .venv/bin/python init_clickhouse.py

Reads `backend/.env` itself (CLICKHOUSE_URL / CLICKHOUSE_USER / CLICKHOUSE_PASSWORD /
CLICKHOUSE_EVENTS_DB), creates the database if missing and the `events` table if missing, and
prints where it landed. Idempotent: running it twice changes nothing. It creates no data and drops
nothing.
"""

from __future__ import annotations

from dotenv import load_dotenv

load_dotenv(".env")

from clickhouse_events import ensure_schema  # noqa: E402 — after the env is loaded, on purpose

if __name__ == "__main__":
    print(ensure_schema())
