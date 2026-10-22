"""THE EVENT STORE — every interaction fact, in ClickHouse, in one place.

WHY CLICKHOUSE AND NOT POSTGRES (owner, 2026-10-18: *"I want the best build for the best
performance … if it interferes with something or doubles something or duplicates the process then
that's not lean, that's bloat."*). Interaction events are append-only, unbounded and only ever read
as counts, groups and ordered sequences — the shape a columnar store is built for and a relational
one is not. So events live here, and ONLY here: the capture door writes to this module and to
nothing else, and no copy of an event is kept in Postgres. Records of meaning — elements,
annotations, versions, the catalogue — stay in Postgres, where relations and edits belong.

THE DATABASE IS OURS. `ux_analytics` sits inside the ClickHouse server that already runs for
Langfuse; a separate database, nothing of theirs touched. The engine is already running on this
machine and on the box, which is why this adds no service.

NO ALTERNATE PATH. If ClickHouse cannot be reached or refuses a row, the door refuses the event and
says why. Nothing is written elsewhere and nothing is retried in the background.

THE SCHEMA, and why the sort key is what it is:

  ORDER BY (kind, metric, element_key, flow, toDate(at), at)

The three questions this table answers, in order: counters grouped by element/metric/flow; trail
rows for one flow and session in time order; surface opens grouped by surface. The first and third
read the key directly. The second is a ranged scan of one flow's rows — correct and cheap at any
volume this product produces.

`dimensions` is a JSON String column, declared-dimension-only by the vocabulary. It is intentionally
NOT a nested structure: the closed vocabulary is the schema, and a new dimension is a code change,
not a shape migration.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone

import requests

EVENTS_TABLE = "events"

_SCHEMA = f"""
CREATE TABLE IF NOT EXISTS {{db}}.{EVENTS_TABLE}
(
    at              DateTime64(3, 'UTC'),
    kind            LowCardinality(String),
    metric          LowCardinality(String),
    element_key     LowCardinality(String),
    element_id      String,
    flow            LowCardinality(String),
    session_id      String,
    surface         LowCardinality(String),
    instance_id     String,
    conversation_id String,
    dimensions      String
)
ENGINE = MergeTree
PARTITION BY toYYYYMM(at)
ORDER BY (kind, metric, element_key, flow, toDate(at), at)
SETTINGS index_granularity = 8192
"""


def _config() -> dict:
    return {
        "url": os.getenv("CLICKHOUSE_URL", "http://127.0.0.1:8123"),
        "user": os.getenv("CLICKHOUSE_USER", "clickhouse"),
        "password": os.getenv("CLICKHOUSE_PASSWORD", "clickhouse"),
        "db": os.getenv("CLICKHOUSE_EVENTS_DB", "ux_analytics"),
    }


def _headers(config: dict) -> dict:
    return {
        "X-ClickHouse-User": config["user"],
        "X-ClickHouse-Key": config["password"],
    }


def _raise_for(response: requests.Response) -> None:
    if response.status_code >= 400:
        # ClickHouse answers errors as text; the caller needs the reason, not a status code.
        raise RuntimeError(f"ClickHouse refused ({response.status_code}): {response.text.strip()[:400]}")


def ensure_schema() -> str:
    """Create the database and the events table if they are not there. Idempotent."""
    config = _config()
    response = requests.post(
        config["url"],
        params={"query": f"CREATE DATABASE IF NOT EXISTS {config['db']}"},
        headers=_headers(config),
        timeout=10,
    )
    _raise_for(response)
    response = requests.post(
        config["url"],
        params={"query": _SCHEMA.format(db=config["db"])},
        headers=_headers(config),
        timeout=10,
    )
    _raise_for(response)
    return f"{config['db']}.{EVENTS_TABLE} ready at {config['url']}"


def events_table() -> str:
    """The fully-qualified events table, from configuration — never hardcoded in a query."""
    return f"{_config()['db']}.{EVENTS_TABLE}"


def insert_events(rows: list[dict]) -> int:
    """ONE batch insert, one statement. A row that fails takes the batch with it — all or nothing,
    the same law the door applies to validation. Returns the number of rows written."""
    if not rows:
        return 0
    config = _config()
    body = "\n".join(json.dumps(row, ensure_ascii=False) for row in rows)
    response = requests.post(
        config["url"],
        params={"query": f"INSERT INTO {config['db']}.{EVENTS_TABLE} FORMAT JSONEachRow"},
        headers={**_headers(config), "Content-Type": "application/json"},
        data=body.encode("utf-8"),
        timeout=15,
    )
    _raise_for(response)
    return len(rows)


def fetch(sql: str, params: dict | None = None) -> list[dict]:
    """A read, as rows. `{name:Type}` placeholders are filled from `params` by ClickHouse itself
    (`param_name`), so no string interpolation of caller input happens here."""
    config = _config()
    query = f"{sql.strip().rstrip(';')} FORMAT JSONEachRow"
    request_params: dict = {"query": query}
    for key, value in (params or {}).items():
        request_params[f"param_{key}"] = value
    response = requests.post(
        config["url"],
        params=request_params,
        headers=_headers(config),
        timeout=15,
    )
    _raise_for(response)
    text = response.text.strip()
    if not text:
        return []
    return [json.loads(line) for line in text.splitlines() if line.strip()]


def ch_time(moment: datetime) -> str:
    """The client's instant in ClickHouse's own text form, UTC, milliseconds kept."""
    if moment.tzinfo is None:
        moment = moment.replace(tzinfo=timezone.utc)
    return moment.astimezone(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
