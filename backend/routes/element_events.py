"""THE ELEMENT CAPTURE DOOR — POST /api/elements/events.

WHAT THIS IS. The one door every interaction inside an assembled surface arrives at. It records
facts against ELEMENTS — a component's own row in `prompt_sessions`, resolved through
`metadata->>'element_key'` — and against nothing else. A metric hangs off an element or it is not
recorded: an unknown element is refused, never invented.

THE INGESTION ORDER, AND WHY IT IS THIS ORDER: shape -> vocabulary -> element resolution -> write.
Nothing is written until EVERY event in the batch has passed all four. ALL-OR-NOTHING IS
DELIBERATE: a refused event means an emitter sent something our vocabulary does not name — a bug
in our code, not a fact about a person. Accepting the neighbours would hide that bug behind a
partial success, and a partially-ingested stream is worse than a missing one because the gap looks
like a drop-off in a funnel. The emitter's duty on a 422: say so on the console, never retry
silently.

THE TWO WRITE CLASSES (split by the vocabulary, never mixed):
  counter -> one event row, kept as an event. A person clicking forty times is forty rows in the
             store, which is what makes a burst (friction) visible at all.
  trail   -> one event row, with the visitor and the moment, so ORDER can be read from rows.

BOTH LAND IN THE SAME STORE (ClickHouse, `ux_analytics.events`), and NOWHERE ELSE. There is no
second copy in Postgres and no reconciliation between two homes: an event has one home, and a
store that cannot accept it is a refusal with a reason, never a silent alternate path.

THE SECOND KIND OF RECORD: a SURFACE fact — a screen opened — has no element to hang from. It is
the same table with `kind = 'surface'` and an empty element: one shape, one writer, one place to
look. An event is ONE kind or the other: a component names an element event, a surface names a
surface event, and one claiming both is refused by name.

THE STORE'S OWN TIME. `at` is the CLIENT's instant, kept to the millisecond — a batch arriving
after midnight belongs to the moment it happened, not to the moment it arrived.

WHAT IS STORED AND WHAT IS NOT, STATED SO NO ONE ASSUMES IT. The counter's bucket is
(element_id, metric, day, dimensions, FLOW) — `flow` is the composer package's session id when the
emitting surface belongs to one, and '' otherwise, so an element's performance is attributable to
the business process it served. `instance_id`, `conversation_id` and `surface` are validated and
then not written by the counter path: the A2UI surface label is 'main' for every surface
(a2ui-envelope.ts), so it cannot identify a screen, and none of the three has a column; folding a
session into `dimensions` would make every session its own bucket. The trail path stores the
session in `actor`.

THIS PATH CALLS NO VENDOR. No token, no egress, no SDK: the emitter posts same-origin to this
route and the rows land in the studio's own Postgres (`DATABASE_URL`). It runs locally and on the
remote server without a configuration fork.
"""

from __future__ import annotations

import hashlib
import json
import os
import threading
import time
from datetime import datetime, timezone

import psycopg2
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from database_pool import DatabasePoolManager
from clickhouse_events import ch_time, events_table, fetch, insert_events
from element_metrics_vocabulary import (
    COUNTER,
    METRICS,
    TRAIL,
    VOCABULARY_VERSION,
    validate_metric,
    validate_surface_metric,
)

router = APIRouter()

MAX_BATCH = 100
RATE_LIMIT_PER_MINUTE = 300

# The fields an event may carry. Anything else is refused by name: a closed vocabulary is also a
# closed shape, and an unlisted field would be data accepted and never written — silent by design.
EVENT_FIELDS = {
    "session_id",
    "metric",
    "component",
    "instance_id",
    "dimensions",
    "at",
    "conversation_id",
    "surface",
    "flow",
}

# Caps for the envelope strings. Anonymous ids and tags are short by construction; a cap is what
# stops a caller from using an identity field as a payload field.
_LENGTH_CAPS = {
    "session_id": 128,
    "metric": 64,
    "component": 200,
    "instance_id": 200,
    "conversation_id": 64,
    "surface": 200,
    "flow": 200,
}

_REQUIRED_STRINGS = ("session_id", "metric", "at")
_OPTIONAL_STRINGS = ("component", "instance_id", "conversation_id", "surface", "flow")

# Rate limiter state. IN-PROCESS AND HONEST ABOUT IT: it resets on restart and does not span
# processes. When the door needs to span processes it moves to a table, not to a vendor.
_rate_lock = threading.Lock()
_rate_windows: dict[str, tuple[int, int]] = {}  # session_id -> (minute_epoch, used)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _refused(refusals: list[dict], status_code: int = 422) -> JSONResponse:
    """The door's refusal: every refusal in one body, each a sentence with its index."""
    return JSONResponse(
        status_code=status_code,
        content={
            "status": "refused",
            "vocabulary": VOCABULARY_VERSION,
            "refusals": refusals,
            "at": _now_iso(),
        },
    )


def _parse_at(text: str) -> datetime | None:
    """An ISO-8601 timestamp, or None. A value without a zone is read as UTC, like the rest of
    this backend; the emitter always sends `toISOString()` (which carries Z)."""
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _shape_refusals(events: list) -> list[dict]:
    """Shape and identity for every event. Sentences, each carrying the event's index."""
    refusals: list[dict] = []
    for index, event in enumerate(events):
        if not isinstance(event, dict):
            refusals.append({
                "index": index,
                "field": "event",
                "error": "the event is not an object",
            })
            continue

        for key in sorted(event):
            if key not in EVENT_FIELDS:
                refusals.append({
                    "index": index,
                    "field": key,
                    "error": (
                        f'unknown event field "{key}" '
                        f'(vocabulary {VOCABULARY_VERSION})'
                    ),
                })

        for key in _REQUIRED_STRINGS:
            value = event.get(key)
            if not isinstance(value, str) or not value.strip():
                refusals.append({
                    "index": index,
                    "field": key,
                    "error": f'"{key}" is required and must be a non-empty string',
                })

        for key in _OPTIONAL_STRINGS:
            value = event.get(key)
            if value is not None and not isinstance(value, str):
                refusals.append({
                    "index": index,
                    "field": key,
                    "error": f'"{key}" must be a string when present',
                })

        # THE METRIC DECIDES THE KIND; THE FIELDS MUST MATCH IT. An element event names its
        # element (component) and MAY also name the screen it happened on (surface) — a button
        # inside a composer flow is exactly that. A surface event names the screen and no
        # element. So the only shape rule here is that SOME record is named; the vocabulary
        # pass then checks that the metric belongs to the class the fields describe.
        component = event.get("component")
        surface = event.get("surface")
        if not component and not surface:
            refusals.append({
                "index": index,
                "field": "component",
                "error": (
                    "an event needs a component (element record) or a surface "
                    "(screen record)"
                ),
            })

        for key, cap in _LENGTH_CAPS.items():
            value = event.get(key)
            if isinstance(value, str) and len(value) > cap:
                refusals.append({
                    "index": index,
                    "field": key,
                    "error": f'"{key}" exceeds its {cap}-character cap (received {len(value)})',
                })

        if "dimensions" in event and event["dimensions"] is not None:
            if not isinstance(event["dimensions"], dict):
                refusals.append({
                    "index": index,
                    "field": "dimensions",
                    "error": '"dimensions" must be an object when present',
                })

        at = event.get("at")
        if isinstance(at, str) and at.strip() and _parse_at(at) is None:
            refusals.append({
                "index": index,
                "field": "at",
                "error": f'"{at}" is not an ISO-8601 timestamp',
            })
    return refusals


def _vocabulary_refusals(events: list) -> list[dict]:
    """Every metric, scope and dimension fact, against the closed vocabularies."""
    refusals: list[dict] = []
    for index, event in enumerate(events):
        dimensions = event.get("dimensions") or {}
        if not isinstance(dimensions, dict):
            continue  # the shape pass already refused it
        if event.get("component"):
            for refusal in validate_metric(event["metric"], event["component"], dimensions):
                refusals.append({**refusal, "index": index})
        else:
            for refusal in validate_surface_metric(event["metric"], dimensions):
                refusals.append({**refusal, "index": index})
    return refusals


def _rate_refusals(events: list) -> list[dict]:
    """300 events per minute per session id, counted when the batch is validated."""
    now_minute = int(time.time() // 60)
    counts: dict[str, int] = {}
    first_index: dict[str, int] = {}
    for index, event in enumerate(events):
        session = event["session_id"]
        counts[session] = counts.get(session, 0) + 1
        first_index.setdefault(session, index)

    refusals: list[dict] = []
    with _rate_lock:
        # Forget windows that can no longer be hit, so the dict is a per-minute map, not a leak.
        stale = [s for s, (minute, _) in _rate_windows.items() if minute != now_minute]
        for session in stale:
            del _rate_windows[session]

        for session, wanted in counts.items():
            minute, used = _rate_windows.get(session, (now_minute, 0))
            if minute != now_minute:
                used = 0
            if used + wanted > RATE_LIMIT_PER_MINUTE:
                refusals.append({
                    "index": first_index[session],
                    "field": "session_id",
                    "error": (
                        f'session "{session}" exceeds the rate limit of '
                        f'{RATE_LIMIT_PER_MINUTE} events per minute'
                    ),
                })
                continue
            _rate_windows[session] = (now_minute, used + wanted)
    return refusals


def _resolve_elements(cur, components: set[str]) -> dict[str, str]:
    """One round trip: element_key -> the element's own `prompt_sessions.id`.

    AN ELEMENT'S IDENTITY FOR THIS DOOR IS ITS CATALOGUE TAG. A tag can exist in more than one
    catalogue, and the door's event carries the tag, not the catalogue — so the pick is stated
    rather than left to row order: a `design_master` row wins over a `design_child`, then the
    oldest row wins. Deterministic; if per-catalogue separation is ever needed, the event grows
    a catalogue field and THIS rule is the thing to revisit.
    """
    cur.execute(
        """SELECT DISTINCT ON (metadata->>'element_key')
                  metadata->>'element_key' AS element_key,
                  id
             FROM prompt_sessions
            WHERE metadata->>'element_key' = ANY(%s)
              AND metadata->>'session_type' IN ('design_master', 'design_child')
            ORDER BY metadata->>'element_key',
                     (metadata->>'session_type' = 'design_master') DESC,
                     created_at ASC,
                     id ASC""",
        (sorted(components),),
    )
    # The pool's cursors are RealDictCursor (database_pool.py registers it), so rows are read
    # by alias, never by position — `row[0]` is a KeyError on this cursor, measured 2026-10-18.
    return {row["element_key"]: row["id"] for row in cur.fetchall()}


def _iso(ts) -> str:
    return ts.isoformat(timespec="seconds") if ts is not None else ""


@router.get("/api/elements/summary")
async def elements_summary():
    """What the event store holds — READ-ONLY, and read from the ONE store.

    Two questions of the store itself: counters grouped by element + metric + flow (so the same
    element in two processes stays two rows), and the screens that opened. ClickHouse answers
    both; Postgres holds records of meaning and never events, so there is nothing to join here.
    """
    try:
        elements = [
            {
                "element_key": row["element_key"],
                "metric": row["metric"],
                "flow": row["flow"],
                "total": int(row["total"]),
                "last_at": row["last_at"],
            }
            for row in fetch(
                f"""SELECT element_key, metric, flow, count() AS total,
                           formatDateTime(max(at), '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS last_at
                      FROM {events_table()}
                     WHERE kind = 'counter'
                     GROUP BY element_key, metric, flow
                     ORDER BY total DESC
                     LIMIT 200"""
            )
        ]
        surfaces = [
            {
                "surface": row["surface"],
                "event": row["metric"],
                "opens": int(row["opens"]),
                "last_at": row["last_at"],
            }
            for row in fetch(
                f"""SELECT surface, metric, count() AS opens,
                           formatDateTime(max(at), '%Y-%m-%dT%H:%i:%SZ', 'UTC') AS last_at
                      FROM {events_table()}
                     WHERE kind = 'surface'
                     GROUP BY surface, metric
                     ORDER BY opens DESC
                     LIMIT 100"""
            )
        ]
    except Exception as exc:
        # A store that cannot answer is SAID OUT LOUD with its reason — never an empty summary
        # that reads like "no activity".
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "error": f"{type(exc).__name__}: {exc}",
                "at": _now_iso(),
            },
        )
    return JSONResponse(
        status_code=200,
        content={"status": "ok", "elements": elements, "surfaces": surfaces, "at": _now_iso()},
    )


@router.post("/api/elements/events")
async def capture_events(request: Request):
    """Receive one batch of interaction events. All-or-nothing; refusals are sentences."""
    try:
        body = await request.json()
    except Exception:  # noqa: BLE001 — an unreadable body is a refusal with a reason
        return _refused([{
            "index": None,
            "field": "batch",
            "error": "the request body is not valid JSON",
        }])

    if not isinstance(body, list):
        return _refused([{
            "index": None,
            "field": "batch",
            "error": "the batch must be a JSON array of events",
        }])
    if len(body) > MAX_BATCH:
        return _refused([{
            "index": None,
            "field": "batch",
            "error": f'the batch exceeds {MAX_BATCH} events (received {len(body)})',
        }])

    # 1. Shape and identity.
    refusals = _shape_refusals(body)
    if refusals:
        return _refused(refusals)

    # 2. Vocabulary.
    refusals = _vocabulary_refusals(body)
    if refusals:
        return _refused(refusals)

    # 3. Rate limit (in-process; see the note on _rate_windows). Counted here, so a batch that
    #    passes shape and vocabulary has spent its window even if a later gate refuses it.
    refusals = _rate_refusals(body)
    if refusals:
        return _refused(refusals, status_code=429)

    if not body:
        return JSONResponse(
            status_code=200,
            content={
                "status": "accepted",
                "vocabulary": VOCABULARY_VERSION,
                "accepted": 0,
                "counters": 0,
                "trail": 0,
                "surfaces": 0,
                "at": _now_iso(),
            },
        )

    counters = [event for event in body if event.get("component") and METRICS[event["metric"]]["class"] == COUNTER]
    trails = [event for event in body if event.get("component") and METRICS[event["metric"]]["class"] == TRAIL]
    surface_events = [event for event in body if not event.get("component")]

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "error": "DATABASE_URL is not set — the capture door cannot reach the studio database",
                "at": _now_iso(),
            },
        )

    try:
        manager = DatabasePoolManager.get_instance(database_url)
        with manager.get_connection() as conn:
            cur = conn.cursor()
            try:
                # 4a. Element resolution — the same round trip for every distinct component.
                #     A batch of surface events alone skips it: there is no element to resolve.
                components = {event["component"] for event in body if event.get("component")}
                element_ids = _resolve_elements(cur, components) if components else {}
                missing = sorted(components - set(element_ids))
                if missing:
                    conn.rollback()
                    # One refusal per event whose component did not resolve, in batch order.
                    return _refused([
                        {
                            "index": index,
                            "field": "component",
                            "error": (
                                f'"{event["component"]}" has no catalogue element record — '
                                f"the door records against elements"
                            ),
                        }
                        for index, event in enumerate(body)
                        if event.get("component") in missing
                    ])

                # 4b. THE WRITE — one batch to the EVENT STORE (ClickHouse), and nowhere else.
                #     Counters, trail rows and surface facts are the same kind of fact in
                #     different shapes; the store holds all three and `kind` tells them apart.
                #     NOTHING is also written to Postgres: a second copy of an event is bloat,
                #     and two copies of one fact will disagree eventually (owner, 2026-10-18).
                rows = []
                for event in body:
                    component = event.get("component")
                    if component:
                        kind = "counter" if METRICS[event["metric"]]["class"] == COUNTER else "trail"
                    else:
                        kind = "surface"
                    rows.append({
                        "at": ch_time(_parse_at(event["at"])),
                        "kind": kind,
                        "metric": event["metric"],
                        "element_key": component or "",
                        "element_id": str(element_ids[component]) if component else "",
                        "flow": event.get("flow") or "",
                        "session_id": event["session_id"],
                        "surface": event.get("surface") or "",
                        "instance_id": event.get("instance_id") or "",
                        "conversation_id": event.get("conversation_id") or "",
                        "dimensions": json.dumps(event.get("dimensions") or {}, sort_keys=True),
                    })
                insert_events(rows)
                # The Postgres connection did no writes; release it clean rather than commit an
                # empty transaction.
                conn.rollback()
            except Exception:
                conn.rollback()
                raise
    except (ConnectionError, psycopg2.Error) as exc:
        # A failed write is SAID OUT LOUD, with its type — never an empty 500.
        return JSONResponse(
            status_code=503,
            content={
                "status": "error",
                "error": f"{type(exc).__name__}: {exc}",
                "at": _now_iso(),
            },
        )

    return JSONResponse(
        status_code=200,
        content={
            "status": "accepted",
            "vocabulary": VOCABULARY_VERSION,
            "accepted": len(body),
            "counters": len(counters),
            "trail": len(trails),
            "surfaces": len(surface_events),
            "at": _now_iso(),
        },
    )
