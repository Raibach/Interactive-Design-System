"""
THE CONSOLE'S OWN QUERY LANE — the model's plan for the cards, validated and applied here.

The console's input is a directive: the person tells the AI what the surface should show, and the
AI answers with a small, fixed-shape plan — a filter, a sort and one line saying what it applied.
This module owns that contract end to end:

    plan_for()   the model call, the strict-JSON parse, the validation, the small cache
    apply_plan() the plan executed against the console's own card list
    build_question() the exact question the model answers (fields, real values, the clock)

WHY ITS OWN FILE. The console is a seat, and a seat owns its process (AGENTS-instructions,
"Where the code lives"): the governance rooms keep their lanes, this is the console's. Nothing
here is imported by the design room or the shell.

THE SEAM. `apply_plan` runs over the session rows the console already read, because that list is
already authorized and already shaped like a card. When the index work lands (Milvus ranking,
push-down SQL), it replaces the body of this one function; the plan, the validation and the
surface contract do not change.
"""
from __future__ import annotations

import json
import os
import re
from datetime import UTC, datetime, timedelta

from console_scope import ELIGIBILITY_SQL
from typing import Any

import psycopg2
import psycopg2.extras

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://localhost:5432/railway")

# THE VECTOR STORE IS NOT IN THE LIVE REQUEST PATH UNTIL IT IS STABLE. Milvus lite in this
# environment has crashed the process (SIGSEGV) on search after repeated reloads. The index stays
# built for later; the console answers with an exact text match and says which one it used.
SEMANTIC_SEARCH_ENABLED = os.getenv("CONSOLE_SEMANTIC_SEARCH", "0") == "1"
MAX_FILTERS = 10
MAX_LIST = 50
SORTS = ("newest", "oldest", "recent_activity", "title")

# The fields the model may name. Anything else is refused, never guessed.
FIELDS: dict[str, dict[str, Any]] = {
    "room": {
        "kind": "text",
        "operators": ["eq", "neq", "in", "not_in"],
        "values": ["design", "product", "composer", "governance", "console"],
        "note": "the area a card came from",
    },
    "type": {
        "kind": "text",
        "operators": ["eq", "neq", "in", "not_in", "contains"],
        "note": "the record type (session_type), e.g. design_session",
    },
    "category": {
        "kind": "text",
        "operators": ["eq", "neq", "in", "contains"],
        "note": "the card's category column",
    },
    "status": {
        "kind": "text",
        "operators": ["eq", "neq", "in"],
        "note": "the record's status word",
    },
    "title": {
        "kind": "text",
        "operators": ["contains", "eq"],
        "note": "the card's title",
    },
    "updated": {
        "kind": "datetime",
        "operators": ["gte", "lt"],
        "note": "the record's last update instant (ISO 8601 with timezone)",
    },
    "created": {
        "kind": "datetime",
        "operators": ["gte", "lt"],
        "note": "the record's creation instant (ISO 8601 with timezone)",
    },
}

_plan_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_CACHE_TTL = 600.0


class LaneError(Exception):
    """A plan that cannot be expressed or applied. The message is the reason shown to the person."""


# ── the model's question ────────────────────────────────────────────────────────────────────

def build_question(text: str) -> str:
    now = datetime.now(UTC)
    clock = {
        "nowUtc": now.isoformat(),
        "todayUtc": now.strftime("%Y-%m-%dT00:00:00Z"),
        "yesterdayUtc": (now - timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z"),
        "lastWeekStartUtc": (now - timedelta(days=7)).strftime("%Y-%m-%dT00:00:00Z"),
    }
    return (
        "You are the operator of a CONSOLE that lists a person's work cards. "
        "Answer with ONE JSON object and nothing else.\n\n"
        f"The person typed this directive: \"{text}\"\n\n"
        f"THE CLOCK (use it; you have no other sense of now): {json.dumps(clock)}\n\n"
        "THE FIELDS — the only ones that exist, with their kind and the operators each takes:\n"
        f"{json.dumps(FIELDS)}\n\n"
        f"THE SORTS: {', '.join(SORTS)}\n\n"
        "ANSWER EXACTLY THIS SHAPE, IN THIS KEY ORDER. text is MANDATORY in every answer — "
        "an empty string only when the directive names no content at all:\n"
        '{"text": "<the person\'s words for the content, or empty>", '
        '"sort": "<one of the sorts>", '
        '"filter": [{"field": "<a field>", "op": "<one of its operators>", "value": <value>}], '
        '"explain": "<one short line, under 90 characters, saying what you applied>"}\n\n"'
        "RULES:\n"
        "- Naming a category, a room, a state or a date is a FILTER, not a sort.\n"
        "- 'design work' is room eq design. 'the tools' is type eq design_session. "
        "'recent'/'latest' is sort newest; 'oldest' is sort oldest; 'by name' is sort title.\n"
        "- A date range is two filters: updated gte <start> and updated lt <end>, ISO 8601 with Z.\n"
        "- value is a JSON number/string/bool, or an array for in/not_in.\n"
        "- text is REQUIRED whenever the person refers to work by describing it. Copy their "
        "words into it: \"where is the work about the input form\" -> text \"input form\"; "
        "\"that card hover thing\" -> text \"card hover\"; \"the figma file with tokens\" -> "
        "text \"figma tokens\". A description NEVER goes in a filter.\n"
        "- text is empty ONLY when the directive names no content at all — just a room, a state, "
        "a date or an order. If you can not decide whether the person named content, put it in "
        "text: a similarity match costs nothing, a wrong filter loses the work.\n"
        "- title contains is a LITERAL substring of a known title. Never use it for a description: "
        "\"the input form\" is text, not title contains \"input form\" (no title contains that).\n"
        "- explain is ONE line in the person's words, e.g. \"design work · newest first · 4 cards\".\n"
        "- filter must be [] only when the directive asks for no narrowing.\n"
        "If the directive cannot be expressed with these fields, do NOT return an empty filter: "
        'answer exactly {"unexpressible": "<one line saying why>"}.\n'
        "Never invent a field, an operator or a value."
    )


# ── the model call ─────────────────────────────────────────────────────────────────────────

def _json_object(answer: str) -> dict[str, Any] | None:
    if not answer:
        return None
    cleaned = re.sub(r"^```(?:json)?|```$", "", answer.strip(), flags=re.MULTILINE).strip()
    try:
        obj = json.loads(cleaned)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        start, end = cleaned.find("{"), cleaned.rfind("}")
        if start == -1 or end <= start:
            return None
        try:
            obj = json.loads(cleaned[start : end + 1])
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None


def plan_for(text: str, cache_key: str = "") -> dict[str, Any]:
    """The directive in; a validated plan out. The model is called at most once per key."""
    text = str(text or "").strip()
    if not text:
        return {"sort": "newest", "filter": [], "explain": "everything, newest first"}

    key = f"{cache_key}|{text}"
    cached = _plan_cache.get(key)
    if cached and (datetime.now(UTC).timestamp() - cached[0]) < _CACHE_TTL:
        return cached[1]

    from grace_gui import query_llm

    answer = query_llm(question=build_question(text), mode="sessions_query")
    obj = _json_object(answer)
    if obj is None:
        raise LaneError(f"the model's answer was not a plan: {str(answer)[:160]}")

    cannot = str(obj.get("unexpressible") or "").strip()
    if cannot:
        raise LaneError(cannot)

    plan = validate_plan(obj)
    _plan_cache[key] = (datetime.now(UTC).timestamp(), plan)
    return plan


def validate_plan(obj: dict[str, Any]) -> dict[str, Any]:
    """Only the fields, operators and shapes this lane can execute survive."""
    sort = str(obj.get("sort") or "newest").strip().lower()
    if sort not in SORTS:
        raise LaneError(f"unknown sort '{sort}'; this lane has {', '.join(SORTS)}")

    raw = obj.get("filter") or []
    if not isinstance(raw, list):
        raise LaneError("filter must be a list")
    if len(raw) > MAX_FILTERS:
        raise LaneError(f"too many filters ({len(raw)} > {MAX_FILTERS})")

    filters: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            raise LaneError("each filter must be an object")
        field = str(item.get("field") or "").strip()
        op = str(item.get("op") or "").strip().lower()
        spec = FIELDS.get(field)
        if spec is None:
            raise LaneError(f"unknown field '{field}'")
        if op not in spec["operators"]:
            raise LaneError(f"'{field}' does not take '{op}'")
        value = item.get("value")
        if op in ("in", "not_in"):
            if not isinstance(value, list) or not value or len(value) > MAX_LIST:
                raise LaneError(f"'{field}' {op} takes a non-empty list (max {MAX_LIST})")
        if spec["kind"] == "datetime":
            value = _iso(value)
        filters.append({"field": field, "op": op, "value": value})

    text = str(obj.get("text") or "").strip()[:500]
    explain = str(obj.get("explain") or "").strip()[:120]
    return {"sort": sort, "filter": filters, "text": text, "explain": explain}


def _iso(value: Any) -> str:
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError as exc:
        raise LaneError(f"'{value}' is not an ISO 8601 instant") from exc
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=UTC)
    return parsed.isoformat()


# ── the plan applied to the cards ──────────────────────────────────────────────────────────

def _room_of(session: dict[str, Any]) -> str:
    meta = session.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {}
    room = str(meta.get("room_domain") or "")
    if room:
        return room
    session_type = str(meta.get("session_type") or "")
    if session_type.startswith("design"):
        return "design"
    if session_type == "governance":
        return "governance"
    if session_type == "console":
        return "console"
    return "composer"


def _value_of(session: dict[str, Any], field: str) -> Any:
    meta = session.get("metadata") or {}
    if not isinstance(meta, dict):
        meta = {}
    if field == "room":
        return _room_of(session)
    if field == "type":
        return str(meta.get("session_type") or "")
    if field == "category":
        return str(session.get("category") or "")
    if field == "status":
        return str(session.get("status") or "").lower()
    if field == "title":
        return str(session.get("title") or "")
    if field == "updated":
        return session.get("updated_at")
    if field == "created":
        return session.get("created_at")
    return ""


def _as_utc(value: Any) -> datetime | None:
    """Postgres rows arrive naive; plans carry ISO instants with a zone. One space only."""
    if not isinstance(value, datetime):
        return None
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _matches(session: dict[str, Any], flt: dict[str, Any]) -> bool:
    actual = _value_of(session, flt["field"])
    op = flt["op"]
    value = flt["value"]

    if flt["field"] in ("updated", "created"):
        actual_dt = _as_utc(actual)
        if actual_dt is None:
            return False
        bound = datetime.fromisoformat(str(value))
        if bound.tzinfo is None:
            bound = bound.replace(tzinfo=UTC)
        return actual_dt >= bound if op == "gte" else actual_dt < bound

    actual_s = str(actual).lower()
    if op == "eq":
        return actual_s == str(value).lower()
    if op == "neq":
        return actual_s != str(value).lower()
    if op == "in":
        return actual_s in {str(v).lower() for v in value}
    if op == "not_in":
        return actual_s not in {str(v).lower() for v in value}
    if op == "contains":
        return str(value).lower() in actual_s
    return False


def apply_plan(
    sessions: list[dict[str, Any]],
    plan: dict[str, Any],
    user_id: str = "",
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """The plan executed over the console's own authorized rows.

    Filters narrow first (SQL facts). When the directive names content, the console's memory
    ranks what remains by similarity, so "the input form" finds the work instead of the date.
    """
    kept = [s for s in sessions if all(_matches(s, f) for f in plan.get("filter") or [])]

    ranked_ids: list[str] = []
    similarity: dict[str, float] = {}
    if plan.get("text") and user_id and SEMANTIC_SEARCH_ENABLED:
        try:
            from console_memory import search_cards

            for hit in search_cards(str(plan["text"]), user_id, limit=max(len(kept), 1)):
                ranked_ids.append(hit["card_id"])
                similarity[hit["card_id"]] = hit["score"]
        except Exception as _memory_error:  # noqa: BLE001 — the reason travels in the note
            plan = {**plan, "memory_error": f"{type(_memory_error).__name__}: {_memory_error}"}

    if plan.get("text") and not ranked_ids:
        # FIRST-CLASS DEGRADED MODE, STATED. The words the person used are matched against the
        # card's own title and description; nothing is invented, and the surface says "text match"
        # so a weaker order is never mistaken for the index.
        _words = [w for w in re.findall(r"[a-z0-9]{3,}", str(plan["text"]).lower())]
        def _score(card: dict[str, Any]) -> int:
            hay = f"{card.get('title') or ''} {card.get('description') or ''}".lower()
            return sum(1 for word in _words if word in hay)
        if _words:
            scored = [(s, _score(s)) for s in kept]
            hits = [s for s, n in scored if n > 0]
            kept = hits or kept
            kept.sort(key=lambda s: _score(s), reverse=True)
            plan = {**plan, "degraded": "text match (the vector index is offline)"}

    if ranked_ids:
        order = {cid: index for index, cid in enumerate(ranked_ids)}
        kept.sort(key=lambda s: order.get(str(s.get("id")), len(order)))

    sort = plan.get("sort") or "newest"
    floor = datetime.min.replace(tzinfo=UTC)
    if sort == "oldest":
        kept.sort(key=lambda s: _as_utc(s.get("created_at")) or floor)
    elif sort == "recent_activity":
        kept.sort(
            key=lambda s: _as_utc(s.get("last_accessed_at")) or _as_utc(s.get("updated_at")) or floor,
            reverse=True,
        )
    elif sort == "title":
        kept.sort(key=lambda s: str(s.get("title") or "").lower())
    else:  # newest
        kept.sort(key=lambda s: _as_utc(s.get("created_at")) or floor, reverse=True)

    note = {
        "text": plan.get("explain") or "",
        "sort": sort,
        "filters": plan.get("filter") or [],
        "count": len(kept),
        "ranked": bool(ranked_ids),
    }
    if plan.get("memory_error"):
        note["error"] = plan["memory_error"]
    if plan.get("degraded"):
        note["mode"] = plan["degraded"]
    return kept, note

def fetch_cards_by_ids(ids: list[str], user_id: str) -> list[dict[str, Any]]:
    """The rows Milvus found, read in ONE query, in the order memory ranked them.

    One round trip, not one per id. The authorization predicate is the same one every console
    read uses: owner, or a row in session_permissions.
    """
    if not ids:
        return []
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET app.current_user_id = %s", (user_id,))
            cur.execute(
                f"""
                SELECT ps.id, ps.user_id, ps.conversation_id, ps.title, ps.description,
                       ps.is_active, ps.is_archived, ps.current_version,
                       ps.created_at, ps.updated_at, ps.last_accessed_at, ps.metadata, ps.category,
                       ps.status, ps.likes, ps.model_name, ps.team_name, ps.avatar_url,
                       cat.color AS category_color,
                       cat.title_color AS category_title_color,
                       cat.text_color AS category_text_color,
                       u.email AS author_email, u.full_name AS author_name,
                       (SELECT COUNT(*) FROM prompt_versions pv WHERE pv.session_id = ps.id) AS version_count
                  FROM prompt_sessions ps
                  LEFT JOIN categories cat ON cat.name = ps.category
                  LEFT JOIN users u ON u.id = ps.user_id
                 WHERE ps.id::text = ANY(%s)
                   AND {ELIGIBILITY_SQL}
                   AND (
                        ps.user_id = %s
                     OR EXISTS (SELECT 1 FROM session_permissions sp
                                 WHERE sp.session_id = ps.id AND sp.user_id = %s)
                   )
                """,
                (ids, user_id, user_id),
            )
            rows = [dict(row) for row in cur.fetchall()]
    order = {card_id: index for index, card_id in enumerate(ids)}
    rows.sort(key=lambda row: order.get(str(row["id"]), len(order)))
    return rows

_ROOM_SQL = """CASE
    WHEN COALESCE(ps.metadata->>'room_domain', '') <> '' THEN ps.metadata->>'room_domain'
    WHEN COALESCE(ps.metadata->>'session_type', '') LIKE 'design%%' THEN 'design'
    WHEN COALESCE(ps.metadata->>'session_type', '') = 'governance' THEN 'governance'
    WHEN COALESCE(ps.metadata->>'session_type', '') = 'console' THEN 'console'
    ELSE 'composer' END"""

_COLUMN_SQL = {
    "room": _ROOM_SQL,
    "type": "COALESCE(ps.metadata->>'session_type', '')",
    "category": "COALESCE(ps.category, '')",
    "status": "LOWER(COALESCE(ps.status, ''))",
    "title": "COALESCE(ps.title, '')",
    "updated": "ps.updated_at",
    "created": "ps.created_at",
}

_SORT_SQL = {
    "newest": "ps.created_at DESC",
    "oldest": "ps.created_at ASC",
    "recent_activity": "COALESCE(ps.last_accessed_at, ps.updated_at) DESC",
    "title": "LOWER(COALESCE(ps.title, '')) ASC",
}


def _where_for(flt: dict[str, Any], params: list[Any]) -> str:
    column = _COLUMN_SQL[flt["field"]]
    op, value = flt["op"], flt["value"]
    if flt["field"] in ("updated", "created"):
        params.append(value)
        return f"{column} {'>=' if op == 'gte' else '<'} %s"
    if op == "in" or op == "not_in":
        params.append([str(v).lower() for v in value])
        return f"LOWER({column}) {'NOT IN' if op == 'not_in' else 'IN'} (SELECT unnest(%s::text[]))"
    params.append(str(value).lower())
    if op == "eq":
        return f"LOWER({column}) = %s"
    if op == "neq":
        return f"LOWER({column}) <> %s"
    if op == "contains":
        return f"LOWER({column}) LIKE '%%' || %s || '%%'"
    raise LaneError(f"'{flt['field']}' does not take '{op}'")


def fetch_cards_by_plan(plan: dict[str, Any], user_id: str, limit: int = 50) -> list[dict[str, Any]]:
    """A structured plan executed in ONE query: filters pushed down, one page returned.

    This is the path that replaces reading the console's list and filtering it in Python.
    """
    params: list[Any] = []
    clauses = [ELIGIBILITY_SQL]
    for flt in plan.get("filter") or []:
        clauses.append(_where_for(flt, params))

    sql = f"""
        SELECT ps.id, ps.user_id, ps.conversation_id, ps.title, ps.description,
               ps.is_active, ps.is_archived, ps.current_version,
               ps.created_at, ps.updated_at, ps.last_accessed_at, ps.metadata, ps.category,
               ps.status, ps.likes, ps.model_name, ps.team_name, ps.avatar_url,
               cat.color AS category_color,
               cat.title_color AS category_title_color,
               cat.text_color AS category_text_color,
               u.email AS author_email, u.full_name AS author_name,
               (SELECT COUNT(*) FROM prompt_versions pv WHERE pv.session_id = ps.id) AS version_count
          FROM prompt_sessions ps
          LEFT JOIN categories cat ON cat.name = ps.category
          LEFT JOIN users u ON u.id = ps.user_id
         WHERE {' AND '.join(clauses)}
           AND (ps.user_id = %s OR EXISTS (
                    SELECT 1 FROM session_permissions sp
                     WHERE sp.session_id = ps.id AND sp.user_id = %s))
         ORDER BY {_SORT_SQL[plan.get('sort') or 'newest']}
         LIMIT {int(limit)}
    """
    params.extend([user_id, user_id])
    with psycopg2.connect(DATABASE_URL) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("SET app.current_user_id = %s", (user_id,))
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]
