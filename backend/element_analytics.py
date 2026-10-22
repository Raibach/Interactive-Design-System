"""THE HUMAN-INTERACTION MATHS — funnels, pacing and friction, over OUR rows.

WHERE THIS COMES FROM. The owner, 2026-10-18: *"the only specific things we kept … were the
underlying mathematical formulas and query layouts for human interaction analytics. We are not
using their tracking code … we are borrowing their open-source math blueprints."*

So this module is the blueprints, written again over `design_element_activity` — not their services,
not their ClickHouse, not their scripts. What is taken, and from where in `design/posthog-master`
(MIT outside `ee/`, read as a textbook, never imported):

  funnel semantics   `posthog/user_scripts/v8/aggregate_funnel.py` (+ its array/trends variants):
                     steps are matched IN ORDER; step N matches the FIRST event of that step at or
                     after step N-1's matched event; a person converts when the LAST step is
                     reached inside the conversion window; drop-off is previous minus current; the
                     time to convert is last step minus first step. Their ClickHouse UDF does this
                     in one pass over a per-person array; the same rule is a greedy walk here.
  pacing             the same conversion-time idea, reported per STEP instead of once per person:
                     how long a person sat between two consecutive steps — the hesitation between
                     two decisions, which is what a designer can act on.
  friction           `posthog/temporal/session_replay/surfacing_scoring_sweep/features.py`, whose
                     rates are `rage_click_rate` and `dead_click_rate`: a person hitting the SAME
                     control repeatedly inside a short window is a design failure, not engagement.
                     Theirs is scored on replay events; ours is counted on the trail, which is why
                     it can name the element and the flow rather than only the session.

WHY THIS IS PYTHON OVER A SINGLE ORDERED READ. The rule is a sequential match with a state (the
previous step's time). Expressing it in one SQL statement needs a recursive CTE or a stack of
laterals, and both make it harder to read than it is hard to compute. One indexed read
(`session_id, at`) plus a greedy walk is exact, debuggable, and holds the whole dataset's rule in
six lines a designer can follow. The reads are the database's; the rule is here.

WHAT THESE FUNCTIONS DO NOT DO: they never write, never guess a step that was not recorded, and
never fill a missing step with zero — a session that skipped a step is a REAL drop-off and is
reported as one.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from statistics import median

from clickhouse_events import events_table, fetch


@dataclass
class StepMatch:
    """One step, matched or not, with the moment it was reached."""

    step: str
    reached: int = 0
    at: list[datetime] = field(default_factory=list)


def _step_rows(flow: str | None) -> list[dict]:
    """The ordered trail these rules reason about: one row per recorded step, oldest first.

    Only TRAIL-class `step` events carry the order a funnel needs. `flow is None` means every
    flow; `flow == ''` is the honest "no package was open" group. The store returns epoch
    milliseconds, which are converted here so the rule above deals in datetimes only.
    """
    conditions = ["kind = 'trail'", "metric = 'step'"]
    params: dict = {}
    if flow is not None:
        conditions.append("flow = {flow:String}")
        params["flow"] = flow
    rows = fetch(
        f"""SELECT session_id,
                   toUnixTimestamp64Milli(at) AS at_ms,
                   JSONExtractString(dimensions, 'step') AS step
              FROM {events_table()}
             WHERE {' AND '.join(conditions)}
             ORDER BY session_id, at""",
        params,
    )
    return [
        {
            "session_id": row["session_id"],
            "step": row["step"],
            "at": datetime.fromtimestamp(int(row["at_ms"]) / 1000, tz=timezone.utc),
        }
        for row in rows
    ]


def funnel(steps: list[str], flow: str | None = None, window_minutes: int | None = None) -> dict:
    """Ordered funnel counts, drop-off per step, and the median time to convert.

    `steps` is the funnel in the order a person is expected to walk it. `window_minutes` bounds the
    whole journey (None = no bound), measured from the FIRST step's matched moment — their
    conversion-window rule.

    Returns {steps: [...], sessions: n, converted: n, conversion_rate, median_seconds_to_convert,
    window_minutes} — every number read from the trail, none inferred.
    """
    if not steps:
        raise ValueError("a funnel needs at least one step")

    rows = _step_rows(flow)

    by_session: dict[str, list[dict]] = {}
    for row in rows:
        by_session.setdefault(row["session_id"], []).append(row)

    counts = [0] * len(steps)
    times_to_convert: list[float] = []

    for session_rows in by_session.values():
        index = 0
        started_at: datetime | None = None
        previous_at: datetime | None = None
        for row in session_rows:  # already oldest-first
            if index >= len(steps):
                break
            if row["step"] != steps[index]:
                continue
            # THEIR RULE: step N matches only at or after step N-1's match (ordered, no rewind).
            if previous_at is not None and row["at"] < previous_at:
                continue
            if index == 0:
                started_at = row["at"]
            if (
                window_minutes is not None
                and started_at is not None
                and (row["at"] - started_at).total_seconds() > window_minutes * 60
            ):
                break  # outside the conversion window: this person did not convert in time
            counts[index] += 1
            previous_at = row["at"]
            index += 1
            if index == len(steps):
                times_to_convert.append((row["at"] - started_at).total_seconds())

    sessions = len(by_session)
    converted = counts[-1] if counts else 0
    return {
        "steps": [
            {
                "step": name,
                "reached": counts[i],
                "drop_off": (counts[i - 1] - counts[i]) if i else 0,
            }
            for i, name in enumerate(steps)
        ],
        "sessions": sessions,
        "converted": converted,
        "conversion_rate": (converted / sessions) if sessions else None,
        "median_seconds_to_convert": median(times_to_convert) if times_to_convert else None,
        "window_minutes": window_minutes,
        "flow": flow if flow is not None else "(all flows)",
    }


def pacing(steps: list[str], flow: str | None = None) -> dict:
    """How long people sat between consecutive steps — the hesitation, per transition.

    For every session that reached two consecutive steps in order, the gap between their moments
    is recorded; each transition reports count, median and mean seconds. A LONG median on one
    transition is where a person stopped understanding the design, which is the only kind of
    finding this data can produce on its own.
    """
    if len(steps) < 2:
        raise ValueError("pacing needs at least two steps")

    rows = _step_rows(flow)

    by_session: dict[str, list[dict]] = {}
    for row in rows:
        by_session.setdefault(row["session_id"], []).append(row)

    gaps: list[list[float]] = [[] for _ in range(len(steps) - 1)]
    for session_rows in by_session.values():
        index = 0
        matched: list[datetime] = []
        for row in session_rows:
            if index >= len(steps):
                break
            if row["step"] != steps[index]:
                continue
            if matched and row["at"] < matched[-1]:
                continue
            matched.append(row["at"])
            index += 1
        for i in range(min(len(matched) - 1, len(gaps))):
            gaps[i].append((matched[i + 1] - matched[i]).total_seconds())

    return {
        "transitions": [
            {
                "from": steps[i],
                "to": steps[i + 1],
                "sessions": len(gaps[i]),
                "median_seconds": median(gaps[i]) if gaps[i] else None,
                "mean_seconds": (sum(gaps[i]) / len(gaps[i])) if gaps[i] else None,
            }
            for i in range(len(gaps))
        ],
        "flow": flow if flow is not None else "(all flows)",
    }


def friction(
    element_key: str | None = None,
    flow: str | None = None,
    window_seconds: int = 2,
    min_repeats: int = 3,
) -> dict:
    """REPEATED HITS ON THE SAME CONTROL — a person pressing something again and again.

    Their heuristic (`rage_click_rate` in the session-replay scoring sweep) treats a burst of
    clicks on one target as frustration. Ours is counted on the event store: within one session,
    the same metric on the SAME element at least `min_repeats` times inside `window_seconds`.

    THIS READ IS WHY THE EVENT STORE MATTERS: the old Postgres counter table kept ONE row per
    element, metric, day and dimensions, so a person hammering a button was invisible by
    construction. The store keeps one row per EVENT, so the burst is right there — and it arrives
    with the element's name and the flow it served, which replay alone cannot give.
    """
    conditions = ["session_id != ''", "element_key != ''"]
    params: dict = {}
    if element_key:
        conditions.append("element_key = {element_key:String}")
        params["element_key"] = element_key
    if flow is not None:
        conditions.append("flow = {flow:String}")
        params["flow"] = flow
    rows = [
        {
            "session_id": row["session_id"],
            "element_id": row["element_id"],
            "action": row["metric"],
            "at": datetime.fromtimestamp(int(row["at_ms"]) / 1000, tz=timezone.utc),
        }
        for row in fetch(
            f"""SELECT session_id, element_id, metric, toUnixTimestamp64Milli(at) AS at_ms
                  FROM {events_table()}
                 WHERE {' AND '.join(conditions)}
                 ORDER BY session_id, element_id, metric, at""",
            params,
        )
    ]

    bursts: list[dict] = []
    current: list[dict] = []
    for row in rows:
        same = (
            current
            and row["session_id"] == current[-1]["session_id"]
            and row["element_id"] == current[-1]["element_id"]
            and row["action"] == current[-1]["action"]
            and (row["at"] - current[-1]["at"]).total_seconds() <= window_seconds
        )
        if same:
            current.append(row)
            continue
        if len(current) >= min_repeats:
            bursts.append(
                {
                    "session_id": current[0]["session_id"],
                    "element_id": str(current[0]["element_id"]),
                    "action": current[0]["action"],
                    "repeats": len(current),
                    "seconds": (current[-1]["at"] - current[0]["at"]).total_seconds(),
                    "at": current[0]["at"].isoformat(),
                }
            )
        current = [row]
    if len(current) >= min_repeats:
        bursts.append(
            {
                "session_id": current[0]["session_id"],
                "element_id": str(current[0]["element_id"]),
                "action": current[0]["action"],
                "repeats": len(current),
                "seconds": (current[-1]["at"] - current[0]["at"]).total_seconds(),
                "at": current[0]["at"].isoformat(),
            }
        )

    return {
        "window_seconds": window_seconds,
        "min_repeats": min_repeats,
        "bursts": bursts,
        "flow": flow if flow is not None else "(all flows)",
        "note": (
            "Every event row is a row in the store — a burst is real evidence, and no burst is "
            "a real answer, not an empty state."
        ),
    }
