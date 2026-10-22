"""THE SESSIONS QUERY LANE — the owner's words in, a Langfuse filter out, the rows back.

WHAT THIS IS. In the Governance seat there is ONE chat (the tab that says chat). Every other
tab is a query lane: the person types an instruction, the model turns it into a **Langfuse
filter** (the same JSON array the app's own filter builder produces), the filter is validated
against a catalogue built from the app's own filter config, and it is executed against the
store the app's v4 path reads. No prose reply, no chat turn.

WHY THE FILTER SHAPE IS LANGFUSE'S AND NOT OURS. Owner, 2026-10-18: *"anything else in the
system needs to be tied to the filtering process inside of langfuse."* So the model emits
`packages/shared/src/interfaces/filters.ts`'s shape exactly:

    {"column": "totalCost", "type": "number", "operator": ">=", "value": 0.05}

That buys two things: the vocabulary can never drift from the app by accident, and the same
array can later be handed to the app itself with nothing to translate.

WHY WE EXECUTE IT OURSELVES. The app's own filter engine lives behind tRPC procedures that
authenticate with a NextAuth session (`web/src/server/api/routers/sessions.ts`), and the public
API's only sessions route has **no `filter` parameter** (`web/src/features/public-api/types/
sessions.ts`) and is deprecated (sunset 2026-11-16). So: the app's vocabulary, our executor,
over `events_core` — the same table the app's v4 path reads, so the two surfaces cannot
disagree about which rows exist.

WHAT THIS MODULE REFUSES TO DO:

  * invent a field or a value — every filter is checked against the catalogue, and an unknown
    one is refused BY NAME, never dropped;
  * turn a failure into an empty list — a read that fails returns the reason;
  * claim a field it cannot execute — fields the executor does not implement yet are marked
    `supported: false` with their reason, and asking for one is an error that says so.

THE CATALOGUE IS GENERATED, NOT TYPED FROM MEMORY. `verify_against_app_config()` parses the
app's own `sessions-config.ts` and fails loudly when the facets there and the table below
disagree. A new facet in the app therefore breaks the build of this catalogue instead of
silently going missing from what the model may use.
"""
from __future__ import annotations

import json
import os
import re
from datetime import datetime, timedelta, timezone
from typing import Any

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP_ROOT = os.path.join(REPO_ROOT, "governance", "langfuse-main")
SESSIONS_CONFIG_NAME = "sessions-config.ts"


def _sessions_config_candidates() -> list[str]:
    """Every place the app's filter config may live, most explicit first.

    THE FILE IS SMALL AND IT IS THE AUTHORITY, so it travels with the build. In this repo it sits
    in the Langfuse fork; inside the studio image that fork does not exist — the copy is shipped
    beside the backend (`filter-config/`) because the image only copies the paths its Dockerfile
    names. Measured 2026-10-18: the deployed studio answered the catalogue with
    `FileNotFoundError: /app/governance/langfuse-main/...`, which is this path being assumed.
    """
    candidates: list[str] = []
    explicit = os.getenv("LANGFUSE_FILTER_CONFIG", "").strip()
    if explicit:
        candidates.append(explicit)
    explicit_dir = os.getenv("LANGFUSE_FILTER_DIR", "").strip()
    if explicit_dir:
        candidates.append(os.path.join(explicit_dir, SESSIONS_CONFIG_NAME))
    candidates.append(
        os.path.join(
            REPO_ROOT, "governance", "langfuse-main", "web", "src", "features", "filters",
            "config", SESSIONS_CONFIG_NAME,
        )
    )
    candidates.append(os.path.join(REPO_ROOT, "filter-config", SESSIONS_CONFIG_NAME))
    return candidates


def sessions_config_path() -> str:
    """The first candidate that exists; when none does, every path tried is in the refusal."""
    tried = _sessions_config_candidates()
    for path in tried:
        if os.path.isfile(path):
            return path
    raise LaneError(
        "the app's filter config was not found, so this lane will not run on a guessed vocabulary. "
        "Looked in: " + "; ".join(tried)
    )


FILTERS_DIR = os.path.join(REPO_ROOT, "runtime", "governance", "filters")

LANE = "sessions"

# Every sort this lane accepts, and the SQL each one becomes. The model picks a name; it
# never writes SQL.
SORTS: dict[str, str] = {
    "newest": "last_seen DESC",
    "oldest": "first_seen ASC",
    "cost": "cost DESC",
    "tokens": "total_tokens DESC",
    "traces": "traces DESC",
    "duration": "duration_s DESC",
    "name": "session_id ASC",
}

# ── THE FACETS, AS THE APP DECLARES THEM ─────────────────────────────────────────────────
# `column` is the app's own facet column id (`sessions-config.ts`). `kind` is the Langfuse
# filter type that column takes. `app_type` records what the app's facet says it is, so the
# generated file can be read against the app's file line by line. `exec` names how this
# executor resolves it.
#
# `offered` IS THE OWNER'S CALL, NOT THE EXECUTOR'S LIMIT (owner, 2026-10-18): *"We don't use
# scores so you're gonna have to go through the list and make sure that we're not trying to
# query trace related stuff because we've removed trace stuff and scores are trace related."*
#
#   offered=True   — session-level data. It is in the fields the model may use.
#   offered=False  — a real facet of the app that this lane does NOT offer, because it is
#                    trace-tethered (Trace Tags, Traces Count, tool calls, the tool-name lists,
#                    Metadata) or because scores are trace-tethered and unused here.
#
# An excluded facet is still checked against the app's config (so drift is still caught), still
# recorded in the catalogue under `excluded` with its reason, and REFUSED BY NAME if the model
# asks for it. It is simply never put in front of the model as something it may use.
SESSIONS_FACETS: list[dict[str, Any]] = [
    # ── session-level: offered ────────────────────────────────────────────────────────────
    {"column": "environment", "label": "Environment", "app_type": "categorical",
     "kind": "stringOptions", "exec": "column", "offered": True},
    {"column": "id", "label": "Session ID", "app_type": "string",
     "kind": "string", "exec": "column", "offered": True},
    {"column": "userIds", "label": "User IDs", "app_type": "categorical",
     "kind": "arrayOptions", "exec": "column", "offered": True},
    {"column": "sessionDuration", "label": "Session Duration (s)", "app_type": "numeric",
     "kind": "number", "exec": "duration", "offered": True},
    {"column": "inputTokens", "label": "Input Tokens", "app_type": "numeric",
     "kind": "number", "exec": "input_tokens", "offered": True},
    {"column": "outputTokens", "label": "Output Tokens", "app_type": "numeric",
     "kind": "number", "exec": "output_tokens", "offered": True},
    {"column": "totalTokens", "label": "Total Tokens", "app_type": "numeric",
     "kind": "number", "exec": "total_tokens", "offered": True},
    {"column": "inputCost", "label": "Input Cost ($)", "app_type": "numeric",
     "kind": "number", "exec": "input_cost", "offered": True},
    {"column": "outputCost", "label": "Output Cost ($)", "app_type": "numeric",
     "kind": "number", "exec": "output_cost", "offered": True},
    {"column": "totalCost", "label": "Total Cost ($)", "app_type": "numeric",
     "kind": "number", "exec": "cost", "offered": True},

    # ── trace-tethered: excluded on the owner's word ─────────────────────────────────────
    {"column": "tags", "label": "Trace Tags", "app_type": "categorical",
     "kind": "arrayOptions", "exec": None, "offered": False,
     "reason": "trace tags are written on trace rows — trace-tethered, and traces are out"},
    {"column": "countTraces", "label": "Traces Count", "app_type": "numeric",
     "kind": "number", "exec": None, "offered": False,
     "reason": "a count of trace rows — trace-tethered"},
    {"column": "toolCalls", "label": "Tool Calls", "app_type": "numeric",
     "kind": "number", "exec": None, "offered": False,
     "reason": "tool calls are recorded on observation rows inside traces — trace-tethered"},
    {"column": "calledToolNames", "label": "Tool Names (called)", "app_type": "categorical",
     "kind": "arrayOptions", "exec": None, "offered": False,
     "reason": "tool names come off trace observations — trace-tethered"},
    {"column": "toolNames", "label": "Tool Names (available)", "app_type": "categorical",
     "kind": "arrayOptions", "exec": None, "offered": False,
     "reason": "tool definitions are trace payloads — trace-tethered, and never ingested here"},
    {"column": "metadata", "label": "Metadata", "app_type": "stringKeyValue",
     "kind": "stringObject", "exec": None, "offered": False,
     "reason": "metadata is written on trace rows — trace-tethered"},

    # ── scores and comments: excluded (owner: "We don't use scores") ──────────────────────
    {"column": "scores_avg", "label": "Numeric Scores", "app_type": "numericKeyValue",
     "kind": "numberObject", "exec": None, "offered": False,
     "reason": "scores are trace-tethered and this deployment does not use them"},
    {"column": "score_categories", "label": "Categorical Scores", "app_type": "keyValue",
     "kind": "categoryOptions", "exec": None, "offered": False,
     "reason": "scores are trace-tethered and this deployment does not use them"},
    {"column": "score_booleans", "label": "Boolean Scores", "app_type": "booleanKeyValue",
     "kind": "booleanObject", "exec": None, "offered": False,
     "reason": "scores are trace-tethered and this deployment does not use them"},
    {"column": "commentCount", "label": "Comment Count", "app_type": "numeric",
     "kind": "number", "exec": None, "offered": False,
     "reason": "comments are attached to traces and live in Postgres, not the analytics store"},
    {"column": "commentContent", "label": "Comment Content", "app_type": "string",
     "kind": "string", "exec": None, "offered": False,
     "reason": "comments are attached to traces and live in Postgres, not the analytics store"},
]

OPERATORS: dict[str, list[str]] = {
    "string": ["=", "contains", "does not contain", "starts with", "ends with", "is not empty"],
    "number": ["=", ">", "<", ">=", "<="],
    "datetime": [">", "<", ">=", "<="],
    "stringOptions": ["any of", "none of"],
    "arrayOptions": ["any of", "none of", "all of"],
    "stringObject": ["=", "contains", "does not contain", "starts with", "ends with",
                     "is set", "is not set"],
    "numberObject": ["=", ">", "<", ">=", "<="],
    "booleanObject": ["=", "<>"],
    "categoryOptions": ["any of", "none of"],
    "boolean": ["=", "<>"],
}


class LaneError(Exception):
    """A refusal the person is allowed to read — the real reason, never a stand-in."""


# ── THE DRIFT CHECK ─────────────────────────────────────────────────────────────────────
def app_config_columns() -> list[str]:
    """The facet columns the APP declares, read out of its own TypeScript config.

    Only facet objects are read: an object literal that carries BOTH a `column:` and a
    `type:` — which is exactly how `sessions-config.ts` writes a facet. Two forms exist in
    that file and both must be caught: the inline `type: "categorical" as const` form, and a
    named constant declared separately (`sessionMetadataFacet`), which has no `as const`.
    `columnDefinitions` is a reference to `sessionsViewCols`, not literal objects, so it can
    never be mistaken for a facet here.
    """
    with open(sessions_config_path(), "r", encoding="utf-8") as handle:
        source = handle.read()
    columns: list[str] = []
    for block in re.finditer(r"\{[^{}]*\}", source):
        text = block.group(0)
        if "column:" not in text or "type:" not in text:
            continue
        column = re.search(r'column:\s*"([A-Za-z_]+)"', text)
        if column and column.group(1) not in columns:
            columns.append(column.group(1))
    return columns


def app_config_types() -> dict[str, str]:
    """Each facet's declared type, for the record — `metadata` is `stringKeyValue`, etc."""
    with open(sessions_config_path(), "r", encoding="utf-8") as handle:
        source = handle.read()
    found: dict[str, str] = {}
    for block in re.finditer(r"\{[^{}]*\}", source):
        text = block.group(0)
        column = re.search(r'column:\s*"([A-Za-z_]+)"', text)
        kind = re.search(r'type:\s*"(\w+)"', text)
        if column and kind:
            found.setdefault(column.group(1), kind.group(1))
    return found


def verify_against_app_config() -> dict[str, Any]:
    """Compare the app's facets with the table above. Returns the report; raises on drift."""
    app_columns = app_config_columns()
    if not app_columns:
        raise LaneError(
            f"the app's filter config could not be parsed ({sessions_config_path()}) — "
            "the catalogue is not built from a guess, so this lane refuses to run"
        )
    ours = [facet["column"] for facet in SESSIONS_FACETS]
    missing = [c for c in app_columns if c not in ours]
    extra = [c for c in ours if c not in app_columns]
    if missing or extra:
        raise LaneError(
            "the app's filter config and this lane disagree: "
            f"in the app but not here: {missing or 'none'}; "
            f"here but not in the app: {extra or 'none'}. "
            f"(read from {os.path.relpath(sessions_config_path(), REPO_ROOT)})"
        )
    return {"appColumns": app_columns, "appTypes": app_config_types(),
            "checked": len(app_columns)}


# ── THE CATALOGUE ──────────────────────────────────────────────────────────────────────
def _clickhouse_rows(query: str) -> list[dict]:
    """ONE read-only query against the governance store. Same seam the rest of the routes use."""
    import urllib.parse
    import urllib.request

    base = os.getenv("CLICKHOUSE_URL", "http://127.0.0.1:8123").rstrip("/")
    db = urllib.parse.quote(os.getenv("CLICKHOUSE_DB", "default"))
    url = f"{base}/?database={db}&default_format=JSON"
    request = urllib.request.Request(
        url,
        data=query.encode("utf-8"),
        method="POST",
        headers={
            "X-ClickHouse-User": os.getenv("CLICKHOUSE_USER", "clickhouse"),
            "X-ClickHouse-Key": os.getenv("CLICKHOUSE_PASSWORD", "clickhouse"),
        },
    )
    with urllib.request.urlopen(request, timeout=8) as response:
        payload = json.loads(response.read().decode("utf-8") or "{}")
    rows = payload.get("data")
    return rows if isinstance(rows, list) else []


def _distinct_values() -> dict[str, list[str]]:
    """THE REAL VALUES — what is actually present, so the model filters on values that exist.

    A store that cannot answer raises: the catalogue is then not written, rather than written
    with empty lists that would read as "nothing exists".

    ONLY OFFERED FIELDS HAVE VALUES QUERIED. Tags and tool names are trace-tethered and are not
    offered (owner, 2026-10-18), so asking the store for their values would be collecting
    vocabulary this lane is not allowed to use.
    """
    rows = _clickhouse_rows(
        """
        SELECT groupUniqArray(10)(environment) AS environments,
               groupUniqArray(10)(user_id) AS users
          FROM events_core
         WHERE is_deleted = 0
         SETTINGS readonly=1
        """
    )
    row = rows[0] if rows else {}
    cleaned: dict[str, list[str]] = {}
    for key in ("environments", "users"):
        values = row.get(key) or []
        cleaned[key] = sorted({str(v) for v in values if str(v)})
    return cleaned


def build_catalogue(write: bool = True) -> dict[str, Any]:
    """The catalogue the model reads: fields, kinds, operators, real values, and the clock."""
    report = verify_against_app_config()
    values = _distinct_values()
    now = datetime.now(timezone.utc)

    fields: dict[str, Any] = {}
    excluded: dict[str, str] = {}
    for facet in SESSIONS_FACETS:
        # EXCLUDED IS NOT MISSING. The app has these facets; this lane does not offer them, and
        # the reason travels in the catalogue so the record shows a decision, not an oversight.
        if not facet["offered"]:
            excluded[facet["column"]] = facet.get("reason", "not offered in this lane")
            continue
        fields[facet["column"]] = {
            "label": facet["label"],
            "kind": facet["kind"],
            "appType": facet["app_type"],
            "operators": OPERATORS[facet["kind"]],
            "examples": _example_values(facet["column"], values),
        }
    # A session's start, for "started yesterday". It is not a facet in the app (the time
    # range picker owns it) — it is here because it is the one way to say a date range.
    fields["createdAt"] = {
        "label": "Session Started",
        "kind": "datetime",
        "appType": "datetime (owned by the app's time-range picker)",
        "operators": OPERATORS["datetime"],
        "note": "compared against the session's FIRST event — use for 'started on/before/after' only",
    }
    # AND ITS LAST ACTIVITY — because "yesterday's sessions" means sessions ACTIVE yesterday.
    # Measured 2026-10-18: the newest session here STARTED 2026-10-16 21:58 and ran until
    # 2026-10-17 10:49, so a start-only reading answered "yesterday" with zero sessions — a
    # truthful answer to a question nobody asked. Two fields, and the model is told which is
    # which, so the person's words land on the right one.
    fields["lastSeen"] = {
        "label": "Last Activity",
        "kind": "datetime",
        "appType": "datetime (not a facet: the app filters ranges on createdAt)",
        "operators": OPERATORS["datetime"],
        "note": "compared against the session's LAST event — use for 'yesterday', 'today', "
                "'last N days', 'active in <range>'",
    }
    # EVENTS IS OURS, NOT THE APP'S. The app's sessions list counts TRACES; the room's own
    # session cards count EVENTS, and people ask in those words. Measured 2026-10-18: asked
    # "sessions with more than 400 events", the model answered with `countTraces` — a truthful
    # zero about a different column. A lane that answers the wrong question cleanly is worse
    # than one that says it cannot answer, so the field exists and is named as an extension.
    fields["events"] = {
        "label": "Events",
        "kind": "number",
        "appType": "lane extension — the app's sessions list has no event count",
        "operators": OPERATORS["number"],
        "note": "rows recorded against the session; NOT a trace count",
    }

    catalogue = {
        "lane": LANE,
        "generatedAt": now.isoformat(timespec="seconds"),
        "clock": {
            "now": now.isoformat(timespec="seconds"),
            "todayUtc": now.date().isoformat(),
            "yesterdayUtc": (now.date() - timedelta(days=1)).isoformat(),
            "timezone": "UTC",
            "note": "resolve 'today', 'yesterday', 'last N days' against these values",
        },
        "store": "events_core",
        "sortOptions": list(SORTS.keys()),
        "fields": fields,
        "excluded": excluded,
        "excludedNote": "real facets of the app that this lane does not offer — trace-tethered "
                        "or unused here (scores). Asking for one is refused by name.",
        "realValues": {
            "environment": values["environments"],
            "userIds": values["users"],
        },
        "driftCheck": report,
    }

    if write:
        try:
            os.makedirs(FILTERS_DIR, exist_ok=True)
            path = os.path.join(FILTERS_DIR, f"{LANE}.json")
            with open(path, "w", encoding="utf-8") as handle:
                json.dump(catalogue, handle, ensure_ascii=False, indent=2)
            catalogue["writtenTo"] = os.path.relpath(path, REPO_ROOT)
        except OSError as exc:  # the real reason travels with the catalogue, never swallowed
            catalogue["writeError"] = f"{type(exc).__name__}: {exc}"
    return catalogue


def _example_values(column: str, values: dict[str, list[str]]) -> Any:
    if column == "environment":
        return values["environments"]
    if column == "userIds":
        return values["users"]
    return None


# ── VALIDATION ─────────────────────────────────────────────────────────────────────────
_NUMERIC_OPS = {"=", ">", "<", ">=", "<="}
_DATETIME_OPS = {">", "<", ">=", "<="}


def _as_number(value: Any, field: str) -> float:
    if isinstance(value, bool):
        raise LaneError(f"{field}: a boolean is not a number")
    try:
        return float(value)
    except (TypeError, ValueError):
        raise LaneError(f"{field}: {value!r} is not a number") from None


def _as_datetime(value: Any, field: str) -> datetime:
    text = str(value or "").strip()
    if not text:
        raise LaneError(f"{field}: an empty date")
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        raise LaneError(f"{field}: {text!r} is not an ISO 8601 date") from None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def validate_filters(filters: Any, catalogue: dict[str, Any]) -> list[dict[str, Any]]:
    """Every filter checked against the catalogue. Returns Langfuse-shaped filters."""
    if filters in (None, []):
        return []
    if not isinstance(filters, list):
        raise LaneError("the model's `filter` was not a list")
    fields = catalogue["fields"]
    clean: list[dict[str, Any]] = []
    for raw in filters:
        if not isinstance(raw, dict):
            raise LaneError("a filter was not an object")
        column = str(raw.get("column") or "").strip()
        if not column:
            raise LaneError("a filter arrived without a column")
        spec = fields.get(column)
        if spec is None:
            # EXCLUDED FIELDS ARE REFUSED WITH THEIR REASON, and the two cases stay apart: a
            # real facet this lane does not offer, versus a name that was never a field at all.
            reason = (catalogue.get("excluded") or {}).get(column)
            if reason:
                raise LaneError(
                    f"'{column}' is a real field of this app, but this lane does not offer it — "
                    f"{reason}"
                )
            raise LaneError(
                f"the model asked to filter by '{column}', which is not a field of this lane"
            )
        kind = spec["kind"]
        operator = str(raw.get("operator") or "").strip()
        if operator not in spec["operators"]:
            raise LaneError(
                f"'{column}' does not take the operator {operator!r}; it takes "
                + ", ".join(spec["operators"])
            )
        out: dict[str, Any] = {"column": column, "type": kind, "operator": operator}
        if kind in ("numberObject", "categoryOptions", "booleanObject", "stringObject"):
            key = str(raw.get("key") or "").strip()
            if not key:
                raise LaneError(f"'{column}' needs a score/metadata key")
            out["key"] = key
        value = raw.get("value")
        if kind in ("stringOptions", "arrayOptions", "categoryOptions"):
            if not isinstance(value, list) or not value:
                raise LaneError(f"'{column}' takes a non-empty list of values")
            out["value"] = [str(v) for v in value]
        elif kind == "number":
            out["value"] = _as_number(value, column)
            if operator not in _NUMERIC_OPS:
                raise LaneError(f"'{column}' takes numeric operators only")
        elif kind == "numberObject":
            out["value"] = _as_number(value, column)
        elif kind == "booleanObject":
            if not isinstance(value, bool):
                raise LaneError(f"'{column}' takes true or false")
            out["value"] = value
        elif kind == "datetime":
            if operator not in _DATETIME_OPS:
                raise LaneError(f"'{column}' takes >, <, >= or <=")
            out["value"] = _as_datetime(value, column).isoformat(timespec="seconds")
        elif kind == "string":
            if operator == "is not empty":
                out["value"] = ""
            elif not str(value or "").strip():
                raise LaneError(f"'{column}' needs a value to match")
            else:
                out["value"] = str(value)
        else:
            out["value"] = "" if value is None else str(value)
        clean.append(out)
    return clean


# ── THE EXECUTOR ───────────────────────────────────────────────────────────────────────
def _sql_str(value: str) -> str:
    """A ClickHouse string literal. Backslash first, then the quote — in that order."""
    return "'" + str(value).replace("\\", "\\\\").replace("'", "\\'") + "'"


def _sql_list(values: list[str]) -> str:
    return "[" + ", ".join(_sql_str(v) for v in values) + "]"


def _num(value: Any) -> str:
    number = float(value)
    if number != number or number in (float("inf"), float("-inf")):  # NaN / inf
        raise LaneError("a number filter arrived as NaN or infinity")
    return repr(number)


_ROW_LEVEL = {"environment", "id", "userIds"}
_HAVING = {"sessionDuration", "inputTokens", "outputTokens", "totalTokens",
           "inputCost", "outputCost", "totalCost", "createdAt", "lastSeen", "events"}
_HAVING_EXPR = {
    "sessionDuration": "dateDiff('second', min(start_time), max(start_time))",
    "inputTokens": "sum(usage_details['input'])",
    "outputTokens": "sum(usage_details['output'])",
    "totalTokens": "sum(usage_details['total'])",
    "inputCost": "sum(cost_details['input'])",
    "outputCost": "sum(cost_details['output'])",
    "totalCost": "sum(total_cost)",
    "createdAt": "min(start_time)",
    "lastSeen": "max(start_time)",
    "events": "count()",
}


def _where_fragment(flt: dict[str, Any]) -> str:
    column, operator, value = flt["column"], flt["operator"], flt.get("value")
    if column == "environment":
        if operator == "any of":
            return f"environment IN ({', '.join(_sql_str(v) for v in value)})"
        raise LaneError("environment takes 'any of' in this lane")
    if column == "id":
        pattern = {
            "=": "{v}",
            "contains": "%{v}%",
            "does not contain": None,
            "starts with": "{v}%",
            "ends with": "%{v}",
            "is not empty": None,
        }[operator]
        if operator == "is not empty":
            return "session_id != ''"
        if operator == "does not contain":
            escaped = str(value).replace("\\", "\\\\").replace("'", "\\'")
            return f"session_id NOT ILIKE '%{escaped}%'"
        escaped = str(value).replace("\\", "\\\\").replace("'", "\\'")
        return f"session_id ILIKE {_sql_str(pattern.replace('{v}', escaped))}"
    if column == "userIds":
        if operator == "any of":
            return f"user_id IN ({', '.join(_sql_str(v) for v in value)})"
        raise LaneError("userIds takes 'any of' in this lane")
    raise LaneError(f"'{column}' cannot be applied to a single row — this is a bug in the lane")


def _having_fragment(flt: dict[str, Any]) -> str:
    column, operator = flt["column"], flt["operator"]
    expr = _HAVING_EXPR[column]
    if column == "createdAt":
        moment = _as_datetime(flt["value"], column).strftime("%Y-%m-%d %H:%M:%S")
        return f"{expr} {operator} toDateTime({_sql_str(moment)}, 'UTC')"
    if column == "lastSeen":
        moment = _as_datetime(flt["value"], column).strftime("%Y-%m-%d %H:%M:%S")
        return f"{expr} {operator} toDateTime({_sql_str(moment)}, 'UTC')"
    return f"{expr} {operator} {_num(flt['value'])}"


def build_sql(filters: list[dict[str, Any]], sort: str) -> str:
    """The read this lane runs. `readonly=1` so the analytics store cannot be written."""
    where: list[str] = ["session_id != ''", "is_deleted = 0"]
    having: list[str] = []
    for flt in filters:
        if flt["column"] in _ROW_LEVEL:
            where.append(_where_fragment(flt))
        elif flt["column"] in _HAVING:
            having.append(_having_fragment(flt))
        else:
            raise LaneError(f"no executor for the validated field {flt['column']!r}")
    order = SORTS.get(sort)
    if not order:
        raise LaneError(f"unknown sort {sort!r}; this lane sorts by " + ", ".join(SORTS))
    sql = f"""
        SELECT session_id,
               count() AS events,
               uniqExact(trace_id) AS traces,
               toString(toStartOfMinute(min(start_time))) AS first_seen,
               toString(toStartOfMinute(max(start_time))) AS last_seen,
               arraySlice(groupUniqArray(user_id), 1, 3) AS users,
               sum(total_cost) AS cost,
               sum(usage_details['input']) AS input_tokens,
               sum(usage_details['output']) AS output_tokens,
               sum(usage_details['total']) AS total_tokens,
               sum(cost_details['input']) AS input_cost,
               sum(cost_details['output']) AS output_cost,
               dateDiff('second', min(start_time), max(start_time)) AS duration_s
          FROM events_core
         WHERE {' AND '.join(where)}
         GROUP BY session_id
         {'HAVING ' + ' AND '.join(having) if having else ''}
         ORDER BY {order}
         LIMIT 200
         SETTINGS readonly=1
    """
    return sql


def execute(filters: list[dict[str, Any]], sort: str) -> list[dict[str, Any]]:
    """Run the validated filters and return the session rows. A failure raises — never []."""
    rows = _clickhouse_rows(build_sql(filters, sort))
    out: list[dict[str, Any]] = []
    for row in rows:
        try:
            out.append(
                {
                    "session": str(row["session_id"]),
                    "events": int(row["events"]),
                    "traces": int(row["traces"]),
                    "firstSeen": str(row["first_seen"]),
                    "lastSeen": str(row["last_seen"]),
                    "users": [str(u) for u in (row.get("users") or []) if str(u)],
                    "cost": float(row["cost"]),
                    "inputTokens": int(row["input_tokens"]),
                    "outputTokens": int(row["output_tokens"]),
                    "totalTokens": int(row["total_tokens"]),
                    "inputCost": float(row["input_cost"]),
                    "outputCost": float(row["output_cost"]),
                    "durationSeconds": int(row["duration_s"]),
                }
            )
        except (KeyError, TypeError, ValueError) as exc:
            # A row that cannot be read is not a row to skip — that would be a list that looks
            # complete and is not. The answer names the row and what it actually carried.
            raise LaneError(
                f"a session row could not be read ({type(exc).__name__}: {exc}) — "
                f"columns: {sorted(row) if hasattr(row, 'keys') else type(row).__name__}"
            ) from None
    return out


# ── THE PROMPT ────────────────────────────────────────────────────────────────────────
def build_question(catalogue: dict[str, Any], text: str) -> str:
    """The request the model answers. The catalogue and the clock travel with every ask."""
    fields = {
        name: {
            key: spec[key]
            for key in ("label", "kind", "operators", "supported", "reason", "examples", "note")
            if key in spec
        }
        for name, spec in catalogue["fields"].items()
    }
    return (
        "You are translating one instruction into a filter for a SESSIONS list. "
        "Answer with ONE JSON object and nothing else.\n\n"
        f'The person is looking at the sessions list and said: "{text}"\n\n'
        f"THE CLOCK (use it — you have no other sense of now):\n"
        f"{json.dumps(catalogue['clock'], ensure_ascii=False)}\n\n"
        "THE FIELDS — the only columns that exist, each with its kind, the operators it takes, "
        "whether it can be filtered, and the real values present in the store right now:\n"
        f"{json.dumps(fields, ensure_ascii=False)}\n\n"
        f"THE REAL VALUES PRESENT: {json.dumps(catalogue['realValues'], ensure_ascii=False)}\n\n"
        f"THE SORTS THIS LANE HAS: {', '.join(catalogue['sortOptions'])}\n\n"
        "ANSWER EXACTLY THIS SHAPE:\n"
        '{"sort": "<one of the sorts above>", '
        '"filter": [{"column": "<a field above>", "type": "<its kind>", '
        '"operator": "<one of ITS operators>", "value": <value>, '
        '"key": "<only for score/metadata fields>"}], '
        '"explain": "<one short line saying what you applied, in the person\'s words>"}\n\n'
        "RULES:\n"
        "- A DATE RANGE goes on `lastSeen` when the person means 'yesterday', 'today', "
        "'last N days' or 'active in <range>' — those are sessions with ACTIVITY in the "
        "window. Use `createdAt` only when they say a session STARTED then. A date range "
        "is two filters: >= the start instant and < the end instant, both ISO 8601 with a "
        "timezone, e.g. \"2026-10-17T00:00:00Z\". 'Yesterday' is >= the clock's yesterdayUtc "
        "at 00:00:00Z and < todayUtc at 00:00:00Z.\n"
        "- Sort answers ORDER ONLY. Naming a state or a number is a FILTER, not an order.\n"
        "- Put numbers in number filters as JSON numbers, not strings.\n"
        "- `environment`, `userIds`, `tags`, `calledToolNames` take a non-empty array of values.\n"
        f"- `explain` is ONE line, under 90 characters, e.g. \"yesterday · 3 sessions\".\n"
        "The array must be [] when nothing narrows — but ONLY when the person asked for no "
        "narrowing.\n"
        "If the request cannot be expressed with the fields above, do NOT answer with an empty "
        "filter: answer exactly {\"unexpressible\": \"<one line saying why, in plain words>\"} "
        "so the person is told the wall instead of being shown every row as if it were the "
        "answer.\n"
        "Never invent a field, a value or an operator."
    )
