"""THE GOVERNANCE ROUTES — the manual trigger for one inspection, and the evaluators index.

The scheduled runs live in the app's lifespan (`governance_inspector.daily_loop`); this is the
same run, on demand. It is report-only by the owner's decision (2026-09-18): an inspection
writes findings into the console's own conversation and the trace, and opens no repairs.

THE EVALUATORS INDEX (2026-10-17, owner: *"Add the index for evaluators to the chat output
under the appropriate tab and all of its features that includes its filtering options rules
is a tab on that same index"*). The studio's chat column draws the SAME index the governance
app's Evaluators page draws: the evaluators with their status, and the rules as a second
view of that one index. The app computes its list from ITS OWN database — this route reads
the same tables, read-only, so the two lists can never disagree about what exists.

WHAT THIS ROUTE DOES NOT DO: it does not judge, write, or trigger anything. Every query
runs in a read-only session. `cost7d` IS READ, NOT INVENTED (2026-10-17, owner: *"fix your
evals and your clickhouse stuff postgres that's not working"*): the app's Cost (7d) columns
are computed from its analytics store, not from Postgres — the same aggregation is run here
against the same local ClickHouse (group the execution events by trace, keep each trace's
cost against the rule or evaluator that ran it, skip test runs, sum seven days). The query
carries `SETTINGS readonly=1`, so the analytics read cannot write either. If ClickHouse is
unreachable the figure stays null AND the reason travels in `costErrors` — a dash with a
reason, never a fabricated number.
"""

from fastapi import APIRouter, Header
import json
import os

from governance_inspector import run_inspection
from deps import get_user_id_from_header

router = APIRouter()


@router.post("/api/governance/inspect")
async def inspect_now():
    """Run one inspection now, in the same shape a scheduled run takes.

    Returns the verdict (or the reason the run did NOT happen — a local model that is not
    answering is never substituted by another one).
    """
    try:
        return await run_inspection("manual")
    except Exception as exc:  # noqa: BLE001 — a failed run is SAYS so, never an empty 500
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}


# THE STATUS WORDS ARE THE APP'S OWN, MEASURED (2026-10-17): both evaluators carried
# blocked_at + EVAL_MODEL_CONFIG_INVALID until the DeepSeek fallback cleared it; with no rule
# attached the app's list read "Inactive"; with one ACTIVE rule each it reads "Healthy".
# So: blocked_at set → Blocked; else an ACTIVE rule's assignment → Healthy; else Inactive.
# (The app may also weigh execution outcomes it keeps in its analytics store; this route
# reports the database facts it can prove and never guesses beyond them.)
def _status_of(blocked: bool, active_rules: int) -> str:
    if blocked:
        return "Blocked"
    if active_rules > 0:
        return "Healthy"
    return "Inactive"


def _connect():
    """A read-only psycopg2 connection to the governance app's own Postgres.

    The DSN lives in backend/.env (GOVERNANCE_DB_URL) — the app's database, reached on its
    published local port. Missing DSN = an honest error, never invented rows.
    """
    import psycopg2
    import psycopg2.extras

    dsn = os.getenv("GOVERNANCE_DB_URL", "").strip()
    if not dsn:
        raise RuntimeError(
            "GOVERNANCE_DB_URL is not set — the evaluators index cannot read the "
            "governance database (backend/.env)."
        )
    conn = psycopg2.connect(dsn, connect_timeout=3)
    conn.set_session(readonly=True)
    return conn


def _connect_write():
    """A WRITABLE psycopg2 connection — used by ONE route and nothing else.

    The owner requires the Enabled control to be real (2026-10-17: *"It's got an enabled
    button in it all of that has to be there"*). It writes one column of one table for one
    row: evaluation_rules.status. Every read path stays on _connect(), which is read-only on
    purpose — a read route must never be able to write by accident.
    """
    import psycopg2

    dsn = os.getenv("GOVERNANCE_DB_URL", "").strip()
    if not dsn:
        raise RuntimeError(
            "GOVERNANCE_DB_URL is not set — the rule switch cannot write to the "
            "governance database (backend/.env)."
        )
    return psycopg2.connect(dsn, connect_timeout=3)


def _iso(ts) -> str | None:
    # The app's Postgres runs in UTC (compose: TZ=UTC); the suffix is what JS Date reads.
    return ts.isoformat(timespec="seconds") + "Z" if ts is not None else None


# ── THE 7-DAY COST, FROM THE APP'S OWN ANALYTICS STORE ────────────────────────────────────
# Measured from the app's source, not guessed (packages/shared/src/server/repositories/
# events.ts → getCostMetricsByIdentifierIds): per TRACE, take the id of the rule/evaluator
# that ran it (anyIf over the non-empty id), sum the trace's own cost, drop traces that are
# evaluator test runs, then sum per id over the last seven days. The iOS default ports are
# the compose file's own published pair (127.0.0.1:8123), user/password are its defaults.

def _clickhouse_rows(query: str) -> list[dict]:
    """Run ONE read-only query against the governance app's ClickHouse and return its rows."""
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


def _costs_7d(project_id: str, identifier: str, ids: list[str]) -> dict[str, float]:
    """Total seven-day cost per rule/evaluator id. Raises on a real read failure."""
    column = "e.evaluator_id" if identifier == "evaluator" else "e.evaluation_rule_id"
    literal = ", ".join("'" + str(i).replace("'", "''") + "'" for i in ids if i)
    if not literal:
        return {}
    safe_project = project_id.replace("'", "''")
    query = f"""
        SELECT identifier_id, sum(trace_total_cost) AS total_cost
          FROM (
                SELECT e.trace_id AS trace_id,
                       anyIf({column}, notEmpty({column})) AS identifier_id,
                       sum(e.total_cost) AS trace_total_cost,
                       countIf(e.evaluator_execution_is_test
                               OR startsWith(e.trace_name, 'Test evaluator')) AS test_event_count
                  FROM events_core AS e
                 WHERE e.project_id = '{safe_project}'
                   AND e.start_time > now() - INTERVAL 7 DAY
                   AND e.is_deleted = 0
                 GROUP BY e.trace_id
                HAVING test_event_count = 0
          )
         WHERE identifier_id IN ({literal})
         GROUP BY identifier_id
         SETTINGS readonly=1
    """
    out: dict[str, float] = {}
    for row in _clickhouse_rows(query):
        try:
            out[str(row["identifier_id"])] = float(row["total_cost"])
        except (KeyError, TypeError, ValueError):
            continue
    return out


@router.get("/api/governance/evaluators")
def evaluators_index(project_id: str):
    """The Evaluators index for one project: evaluators + rules, read from the app's DB.

    Shape: {projectId, evaluators: [...], rules: [...]}. Newest first on both lists — the
    newest EVALUATOR is what the room loads in the middle by default (owner, 2026-10-17:
    *"the first one that loads in the middle is the one that's the last one created by
    default. That's the selected one that loads in the middle"*).
    """
    try:
        conn = _connect()
    except Exception as exc:  # noqa: BLE001 — SAYS the failure, never a fake list
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}

    try:
        import psycopg2.extras

        with conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                """
                SELECT e.id, e.name, e.type::text AS type, e.description,
                       (e.blocked_at IS NOT NULL) AS blocked,
                       e.block_reason::text AS block_reason, e.block_message,
                       e.created_at, e.updated_at,
                       u.name AS created_by_name, u.email AS created_by_email,
                       v.model, v.provider,
                       (SELECT count(*) FROM evaluation_rule_evaluator_assignments a
                          JOIN evaluation_rules r ON r.id = a.evaluation_rule_id
                         WHERE a.evaluator_id = e.id AND r.status = 'ACTIVE') AS active_rules
                  FROM evaluators e
                  LEFT JOIN users u ON u.id = e.created_by_user_id
                  LEFT JOIN LATERAL (
                       SELECT model, provider FROM evaluator_versions ve
                        WHERE ve.evaluator_id = e.id
                        ORDER BY ve.version DESC LIMIT 1
                  ) v ON true
                 WHERE e.project_id = %s
                 ORDER BY e.created_at DESC, e.id
                """,
                (project_id,),
            )
            evaluators = [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "type": r["type"],
                    "status": _status_of(bool(r["blocked"]), int(r["active_rules"])),
                    "blockReason": r["block_reason"],
                    "blockMessage": r["block_message"],
                    "model": r["model"],
                    "provider": r["provider"],
                    "createdBy": r["created_by_name"] or r["created_by_email"],
                    "createdAt": _iso(r["created_at"]),
                    "updatedAt": _iso(r["updated_at"]),
                    # Filled below from the analytics store — null only if that read failed.
                    "cost7d": None,
                    "activeRules": int(r["active_rules"]),
                }
                for r in cur.fetchall()
            ]

            cur.execute(
                """
                SELECT r.id, r.name, r.status::text AS status,
                       r.sampling, r.filter,
                       r.created_at, r.updated_at,
                       COALESCE(
                         array_agg(ev.name ORDER BY ev.name)
                           FILTER (WHERE ev.name IS NOT NULL),
                         '{}'
                       ) AS evaluator_names
                  FROM evaluation_rules r
                  LEFT JOIN evaluation_rule_evaluator_assignments a
                         ON a.evaluation_rule_id = r.id
                  LEFT JOIN evaluators ev ON ev.id = a.evaluator_id
                 WHERE r.project_id = %s
                 GROUP BY r.id
                 ORDER BY r.created_at DESC, r.id
                """,
                (project_id,),
            )
            rules = [
                {
                    "id": r["id"],
                    "name": r["name"],
                    "status": r["status"],
                    "sampling": float(r["sampling"]),
                    "filter": r["filter"],
                    "evaluators": list(r["evaluator_names"]),
                    "createdAt": _iso(r["created_at"]),
                    "updatedAt": _iso(r["updated_at"]),
                    # Filled below from the analytics store — the app's own Cost (7d).
                    "cost7d": None,
                }
                for r in cur.fetchall()
            ]

        # THE COST PASS — outside the Postgres session, so an analytics outage can never
        # hold a read-only DB transaction open, and its failure is reported rather than
        # swallowed: the numbers stay null and `costErrors` says why.
        cost_errors: list[str] = []
        try:
            evaluator_costs = _costs_7d(project_id, "evaluator", [e["id"] for e in evaluators])
        except Exception as exc:  # noqa: BLE001 — the reason travels
            evaluator_costs = {}
            cost_errors.append(f"evaluator cost: {type(exc).__name__}: {exc}")
        try:
            rule_costs = _costs_7d(project_id, "rule", [r["id"] for r in rules])
        except Exception as exc:  # noqa: BLE001 — the reason travels
            rule_costs = {}
            cost_errors.append(f"rule cost: {type(exc).__name__}: {exc}")
        for evaluator in evaluators:
            evaluator["cost7d"] = evaluator_costs.get(evaluator["id"])
        for rule in rules:
            rule["cost7d"] = rule_costs.get(rule["id"])

        payload = {"projectId": project_id, "evaluators": evaluators, "rules": rules}
        if cost_errors:
            payload["costErrors"] = cost_errors
        return payload
    except Exception as exc:  # noqa: BLE001 — SAYS the failure, never an empty list
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    finally:
        conn.close()


# ── THE EVALS INDEX'S ONE QUERY, ANSWERED BY THE MODEL — SILENTLY ────────────────────────────
# Owner, 2026-10-17: *"no filtering needed … All filtering happens in the chat. Users just ask
# the model for newest or to resort, surely it can handle sorting without speaking back. pin it
# if we need more work on that interaction with the model."* — PINNED AND BUILT THE SAME DAY.
#
# THE CONTRACT: the person's words in, ONE small directive out —
#   {"action": "sort",   "sort": "newest" | "oldest" | "name" | "critical", "text": ""}
#   {"action": "search", "sort": "<unchanged>", "text": "<what to look for>"}
# Nothing else. No prose reaches the chat column: the room applies the directive to the index
# and writes NO turn. A model failure is returned as the real reason — the shell says it in the
# column's own line; it is never dressed up as an empty result.
#
# WHY THE MODEL AT ALL: "newest" and "resort" are two examples of a request shape, not a
# command grammar — a person will type "put the blocked ones on top" or "alphabetical" and
# mean the same contract. The model reads the intent; the view only ever sorts and filters.
_EVALS_QUERY_SORTS = ("newest", "oldest", "name", "type", "critical")


def _json_object_from_answer(answer: str) -> dict | None:
    """The first JSON object in the model's answer — fences or stray prose chopped off.

    The strict system prompt asks for bare JSON; providers still occasionally wrap it, and a
    wrapper must not turn a valid directive into a failure. No object found = None (the caller
    says the model answered something unreadable, verbatim).
    """
    import json

    text = (answer or "").strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        value = json.loads(text[start:end + 1])
    except Exception:  # noqa: BLE001 — unreadable is a real outcome, reported below
        return None
    return value if isinstance(value, dict) else None


_FILTERS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "runtime",
    "governance",
    "filters",
)


def _filter_catalogue(project_id: str) -> dict:
    """THE FILTER CATALOGUE — the fields and the REAL values Grace may filter by.

    Owner, 2026-10-17: *"All of these filters need to be in someplace on a file or wherever
    they're stored … Grace needs to be able to access them because she's gonna use them to
    filter these rules in the LLM chat output."* So the catalogue is a real artefact: built
    from the same read the lists draw (never invented), and written to a file under
    runtime/governance/filters/ so it can be inspected and so Grace reads ONE source. The
    file is a snapshot of what the database said on this read — it is not consulted when the
    database fails; the failure is returned instead.
    """
    source = evaluators_index(project_id)
    if source.get("status") == "error":
        return source

    def _distinct(rows: list, key: str) -> list[str]:
        seen: list[str] = []
        for row in rows:
            value = row.get(key)
            if isinstance(value, list):
                for item in value:
                    text = str(item or "").strip()
                    if text and text.lower() not in [v.lower() for v in seen]:
                        seen.append(text)
                continue
            text = str(value or "").strip()
            if text and text.lower() not in [v.lower() for v in seen]:
                seen.append(text)
        return sorted(seen)

    evaluators = list(source.get("evaluators") or [])
    rules = list(source.get("rules") or [])
    # KINDS, NOT JUST LISTS (owner, 2026-10-17: *"the LLM model is handling the sorting and
    # the searching and the priority arranging and structuring it by type and structuring it
    # by cost and being able to bring up elements by model and being able to bring up elements
    # by created by, able to sort and present items over a certain date range"*). Each field
    # says what it IS, so Grace can compare numbers and dates instead of only matching words.
    catalogue = {
        "projectId": project_id,
        "evaluators": {
            "name": {"kind": "text"},
            "status": {
                "kind": "values",
                "values": _distinct(evaluators, "status"),
                "domain": ["Healthy", "Blocked", "Inactive"],
            },
            "type": {
                "kind": "values",
                "values": _distinct(evaluators, "type"),
                "domain": ["LLM_AS_JUDGE", "CODE", "DECISION_MODEL", "FACET"],
            },
            "model": {"kind": "values", "values": _distinct(evaluators, "model")},
            "createdBy": {"kind": "values", "values": _distinct(evaluators, "createdBy")},
            "createdAt": {"kind": "datetime"},
            "updatedAt": {"kind": "datetime"},
        },
        "rules": {
            "name": {"kind": "text"},
            "status": {
                "kind": "values",
                "values": _distinct(rules, "status"),
                "domain": ["ACTIVE", "INACTIVE"],
            },
            "evaluators": {"kind": "values", "values": _distinct(rules, "evaluators"),
                            "list": True},
            "sampling": {"kind": "number"},
            "createdAt": {"kind": "datetime"},
            "updatedAt": {"kind": "datetime"},
        },
    }
    # THE FILE — a real path in the workspace, one per project, rewritten as the data moves.
    # A failed write is reported, never swallowed: Grace would otherwise read a stale snapshot.
    try:
        os.makedirs(_FILTERS_DIR, exist_ok=True)
        with open(os.path.join(_FILTERS_DIR, f"{project_id}.json"), "w", encoding="utf-8") as fh:
            json.dump(catalogue, fh, ensure_ascii=False, indent=2)
    except Exception as exc:  # noqa: BLE001 — the real reason travels with the catalogue
        catalogue["writeError"] = f"{type(exc).__name__}: {exc}"
    return catalogue


@router.post("/api/governance/rules/enabled")
def rule_set_enabled(payload: dict):
    """Enable or disable ONE rule — a real write to the governance database.

    The owner requires the Enabled control to be real (2026-10-17: *"It's got an enabled
    button in it all of that has to be there"*). This writes evaluation_rules.status, the
    same column the app's own switch writes; it does not touch anything else, and a missing
    rule is SAID, never treated as success.
    """
    project_id = str(payload.get("project_id") or "").strip()
    rule_id = str(payload.get("rule_id") or "").strip()
    enabled = bool(payload.get("enabled"))
    if not project_id or not rule_id:
        return {"status": "error", "error": "missing project_id or rule_id"}
    try:
        conn = _connect_write()
    except Exception as exc:  # noqa: BLE001 — the real reason travels
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    try:
        with conn, conn.cursor() as cur:
            cur.execute(
                """
                UPDATE evaluation_rules
                   SET status = %s, updated_at = now()
                 WHERE id = %s AND project_id = %s
             RETURNING id
                """,
                ("ACTIVE" if enabled else "INACTIVE", rule_id, project_id),
            )
            if cur.fetchone() is None:
                return {"status": "error", "error": "rule not found in this project"}
    except Exception as exc:  # noqa: BLE001 — the real reason travels
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    finally:
        conn.close()
    return {"status": "ok", "enabled": enabled}


@router.get("/api/governance/filters")
def governance_filters(project_id: str):
    """The stored filter catalogue for one project — what Grace filters the lists by."""
    return _filter_catalogue(project_id)


# ── THE FAILURE VAULT'S TWO DOORS (owner, 2026-10-17) ────────────────────────────────────
# The morning brief reads it; the purge empties it. There is no third route on purpose: the
# vault is not browsable history, it is a confession book with a retention window.

@router.get("/api/governance/failures/brief")
def failures_brief(days: int = 7):
    """The facts for the morning report — counts per wall inside the retention window."""
    from datetime import datetime, timedelta, timezone

    from failure_vault import morning_brief

    window = max(1, min(int(days or 7), 365))
    since = datetime.now(timezone.utc) - timedelta(days=window)
    brief = morning_brief(since)
    brief["windowDays"] = window
    return brief


@router.post("/api/governance/failures/purge")
def failures_purge():
    """Empty the vault. Returns what it deleted — a purge that cannot say is a suppression."""
    from failure_vault import purge

    try:
        deleted = purge()
    except Exception as exc:  # noqa: BLE001 — the real reason travels
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    return {"status": "ok", "deleted": deleted}


@router.post("/api/governance/evals/query")
def evals_query(payload: dict):
    """Read one request from her input box on the Evals tab and answer with a directive.

    `mode` scopes the words ("evaluators" or "rules") so the model knows which list the
    person is looking at. The directive is applied by the shell; this route reads and writes
    nothing in the database.
    """
    text = str(payload.get("text") or "").strip()
    mode = str(payload.get("mode") or "evaluators")
    if mode not in ("evaluators", "rules"):
        mode = "evaluators"
    project_id = str(payload.get("project_id") or "").strip()
    if not text:
        return {"status": "error", "error": "empty query"}
    if not project_id:
        return {"status": "error", "error": "missing project_id"}

    # THE MODEL'S FOLDER IS THE CATALOGUE (owner, 2026-10-17: *"All of these filters need to
    # be in someplace on a file … Grace needs to be able to access them because she's gonna
    # use them to filter these rules in the LLM chat output"*). One artefact, built from the
    # same read the lists draw and written to runtime/governance/filters/ — the model can only
    # ever ask for a field and a value that exist in it.
    catalogue = _filter_catalogue(project_id)
    if catalogue.get("status") == "error":
        return catalogue
    folder = catalogue.get(mode) or {}
    folder_fields = tuple(field for field in folder if field != "name")

    question = (
        f'The person is looking at the "{mode}" list in an evaluation index. '
        f'Their words: "{text}"\n\n'
        "THE CATALOGUE — every field this list carries, what kind it is, and the REAL values "
        f"present right now:\n{json.dumps(folder, ensure_ascii=False)}\n\n"
        "Answer with ONE JSON object, nothing else:\n"
        '{"sort": "newest" | "oldest" | "name" | "type" | "critical", '
        '"text": "<words to find by name, empty for all>", '
        '"filters": [{"field": "<a field above>", "op": "eq" | "contains" | "gte" | "lte", '
        '"value": "<exact value / number / ISO date>"}]}\n'
        "Rules:\n"
        '- "sort" answers ORDER ONLY: last modified first = "newest"; oldest first = "oldest"; '
        'by name = "name"; grouped by type = "type"; most urgent first = "critical".\n'
        '- WHEN THEY NAME A STATE, THAT IS A FILTER ON status, NOT AN ORDER — "show me the '
        'blocked ones" / "failing" / "only healthy" / "active rules" go in "filters". "Most '
        'urgent first" or "put the blocked on top" is "sort": "critical" and does NOT narrow.\n'
        '- "text" matches the NAME partially; keep it empty when they did not name one.\n'
        "- \"filters\": kind=values fields take one of their listed values (eq); a field marked "
        "list=True matches when it CONTAINS the value; kind=number and kind=datetime take "
        "gte / lte for ranges and eq for exact. Use [] when nothing narrows.\n"
        "- Always include all three keys. Never invent a field or a value that is not above."
    )
    try:
        from grace_gui import query_llm

        answer = query_llm(question=question, mode="evals_query")
    except Exception as exc:  # noqa: BLE001 — the real reason travels, never a fake empty list
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}

    obj = _json_object_from_answer(answer)
    if obj is None:
        # The model answered, but not in the contract — say exactly that, and confess the wall
        # to the vault so the morning brief can count it without a trace tree.
        try:
            from failure_vault import record_failure

            record_failure(
                component_id=f"Registry.Evals.{mode}.Directive",
                error_type="Model_Contract_Violation",
                raw_code="MALFORMED_DIRECTIVE",
                detail=str(answer)[:300],
            )
        except Exception as _vault_exc:  # noqa: BLE001 — a vault miss never masks the wall
            print(f"[vault] wall not recorded: {_vault_exc}")
        return {"status": "error", "error": f"unreadable model answer: {str(answer)[:200]}"}

    sort = str(obj.get("sort") or "").strip().lower()
    if sort not in _EVALS_QUERY_SORTS:
        sort = "newest"
    # THE FOLDER IS THE BOUNDARY — a filter is accepted only when its field exists and its
    # value is one the folder lists. A value the model invented is SAID, never silently
    # dropped: the person sees the real reason instead of a mysteriously empty list.
    filters: list[dict] = []
    filters_in = obj.get("filters")
    if isinstance(filters_in, list):
        for item in filters_in:
            if not isinstance(item, dict):
                continue
            field = str(item.get("field") or "").strip()
            value = str(item.get("value") or "").strip()
            op = str(item.get("op") or "eq").strip().lower()
            if not field or not value:
                continue
            spec = folder.get(field)
            if field not in folder_fields or not isinstance(spec, dict):
                try:
                    from failure_vault import record_failure

                    record_failure(
                        component_id=f"Registry.Evals.{mode}.Directive",
                        error_type="Model_Contract_Violation",
                        raw_code="UNKNOWN_FIELD",
                        detail=f"asked for field '{field}' — not in the catalogue",
                    )
                except Exception as _vault_exc:  # noqa: BLE001
                    print(f"[vault] wall not recorded: {_vault_exc}")
                return {"status": "error", "error": f"model asked to filter by unknown field: {field}"}
            kind = spec.get("kind")
            if kind == "values":
                # PRESENT VALUES AND THE FIELD'S OWN VOCABULARY ARE DIFFERENT THINGS. "Show me
                # the blocked ones" is a legitimate ask even when nothing is blocked today —
                # the answer is an honest empty list, not an error. Only a value outside the
                # vocabulary is refused, and then it is SAID.
                vocabulary = list(spec.get("values") or []) + list(spec.get("domain") or [])
                canonical = next((v for v in vocabulary if str(v).lower() == value.lower()), None)
                if canonical is None:
                    try:
                        from failure_vault import record_failure

                        record_failure(
                            component_id=f"Registry.Evals.{mode}.Directive",
                            error_type="Model_Contract_Violation",
                            raw_code="UNKNOWN_VALUE",
                            detail=f"{field}={value!r} is outside the field's vocabulary",
                        )
                    except Exception as _vault_exc:  # noqa: BLE001
                        print(f"[vault] wall not recorded: {_vault_exc}")
                    return {
                        "status": "error",
                        "error": f"model asked for {field}={value!r}, which is not a value of this field",
                    }
                filters.append({"field": field, "op": "eq", "value": canonical})
                continue
            if kind == "number":
                if op not in ("eq", "gte", "lte"):
                    return {"status": "error", "error": f"{field} takes eq / gte / lte, not {op!r}"}
                try:
                    number = float(value)
                except ValueError:
                    try:
                        from failure_vault import record_failure

                        record_failure(
                            component_id=f"Registry.Evals.{mode}.Directive",
                            error_type="Model_Contract_Violation",
                            raw_code="NOT_A_NUMBER",
                            detail=f"{field}={value!r} asked as a {op} range",
                        )
                    except Exception as _vault_exc:  # noqa: BLE001
                        print(f"[vault] wall not recorded: {_vault_exc}")
                    return {"status": "error", "error": f"{field}={value!r} is not a number"}
                filters.append({"field": field, "op": op, "value": number})
                continue
            if kind == "datetime":
                if op not in ("eq", "gte", "lte"):
                    return {"status": "error", "error": f"{field} takes eq / gte / lte, not {op!r}"}
                filters.append({"field": field, "op": op, "value": value})
                continue
            filters.append({"field": field, "op": op, "value": value})
    return {
        "status": "ok",
        "sort": sort,
        "text": str(obj.get("text") or "").strip(),
        "filters": filters,
    }


# ── THE SESSIONS INDEX, FROM THE APP'S OWN ANALYTICS STORE ───────────────────────────────
# A SESSION in the governance app is a GROUPING LABEL on trace rows and nothing else: every
# row carrying the same session_id is one session, and the app's Sessions page is that column
# grouped, totalled and listed. This route reads the same column from the same store
# (`events_core`, the table the app's own aggregates run on) and returns the same grouping,
# so the room's view and the app's page cannot disagree about which sessions exist.
#
# NOTHING IS INVENTED. A row with an empty session_id belongs to no session and is not
# counted; a window with no labelled rows returns an empty list, which is the claim "no
# session grouping was recorded in these days" — a real answer, not a blank.
#
# AND NO PROJECT FILTER IS APPLIED: this store holds one project (the compose file's own),
# and filtering by an id the caller guessed would silently hide every row. The day a second
# project exists is the day this takes a project_id parameter.

@router.get("/api/governance/sessions")
def sessions_index(days: int = 30):
    """The session groups recorded in the governance store, newest activity first.

    Shape: {status, days, sessions: [{session, events, traces, firstSeen, lastSeen,
    users, cost}]}. A real read failure comes back as {status: "error", error: "<reason>"}
    — never as an empty list that would read as "there are no sessions".
    """
    # `days` arrives as an int (FastAPI refuses anything else with a 422), so this is a CLAMP,
    # not a repair: an out-of-range window is answered with the nearest legal one and reported
    # in `days`. There is no substituted default here — that would answer a question nobody asked.
    window = max(1, min(days, 365))
    query = f"""
        SELECT session_id,
               count() AS events,
               uniqExact(trace_id) AS traces,
               toString(toStartOfMinute(min(start_time))) AS first_seen,
               toString(toStartOfMinute(max(start_time))) AS last_seen,
               arraySlice(groupUniqArray(user_id), 1, 3) AS users,
               sum(total_cost) AS cost
          FROM events_core
         WHERE session_id != ''
           AND start_time > now() - INTERVAL {window} DAY
           AND is_deleted = 0
         GROUP BY session_id
         ORDER BY last_seen DESC
         LIMIT 200
         SETTINGS readonly=1
    """
    try:
        rows = _clickhouse_rows(query)
    except Exception as exc:  # noqa: BLE001 — the reason travels; never a fake empty list
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}

    sessions: list[dict] = []
    for row in rows:
        try:
            sessions.append(
                {
                    "session": str(row["session_id"]),
                    "events": int(row["events"]),
                    "traces": int(row["traces"]),
                    "firstSeen": str(row["first_seen"]),
                    "lastSeen": str(row["last_seen"]),
                    "users": [str(u) for u in (row.get("users") or []) if str(u)],
                    "cost": float(row["cost"]),
                }
            )
        except (KeyError, TypeError, ValueError) as exc:
            # A ROW THAT CANNOT BE READ IS NOT A ROW TO SKIP. Skipping it would return a list
            # that looks complete and is not — the same lie as an empty list for a failed read.
            # The answer says which row failed and what the row actually carried.
            return {
                "status": "error",
                "error": (
                    f"a session row could not be read ({type(exc).__name__}: {exc}) — "
                    f"columns: {sorted(row) if hasattr(row, 'keys') else type(row).__name__}"
                ),
            }
    return {"status": "ok", "days": window, "sessions": sessions}


# ── THE SESSIONS QUERY LANE (owner, 2026-10-18) ─────────────────────────────────────
# *"there's only one chat interface inside of governance … The rest of them are model based
# queries for sorting filtering"*. This route is the Sessions tab's lane: the person's words
# become a LANGFUSE filter (the app's own JSON shape), it is validated against a catalogue
# generated from the app's own filter config, executed over `events_core`, and the rows come
# back. No prose reply, no chat turn, and NO silent empty list: every wall is the reason.

def _lane_failure(component: str, raw: str, detail: str) -> None:
    """Record a wall in the vault. A vault miss never masks the wall itself."""
    try:
        from failure_vault import record_failure

        record_failure(
            component_id=component,
            error_type="Model_Contract_Violation",
            raw_code=raw,
            detail=detail[:300],
        )
    except Exception as _vault_exc:  # noqa: BLE001 — a vault miss is printed, never fatal
        print(f"[vault] wall not recorded: {_vault_exc}")


@router.get("/api/governance/sessions/catalogue")
def sessions_catalogue():
    """The catalogue the lane's model reads — fields, operators, real values, and the clock.

    Read-only. It is also written to runtime/governance/filters/sessions.json so it can be
    inspected on disk, the same way the evaluators catalogue already is.
    """
    try:
        import governance_lanes as lanes

        return {"status": "ok", "catalogue": lanes.build_catalogue(write=True)}
    except Exception as exc:  # noqa: BLE001 — the real reason travels
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}


@router.post("/api/governance/sessions/query")
def sessions_query(
    payload: dict,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """One instruction in; a validated Langfuse filter, and the rows it matches, out.

    THE QUERY IS ALSO CAPTURED AS A CONVERSATION (owner, 2026-10-18): *"we need to make the
    conversations capture the query. So if I say I want three, then that gets added to the
    conversation ID for the session seat. So I can go back as a user and select that
    conversation in sessions, and it will reload my exact query."* A successful query therefore
    writes one conversation row on the session seat (title = the person's words, `tab =
    "sessions"`, the whole validated query in `metadata.query`) plus the words as its user
    message. A capture that fails is REPORTED in the answer — never swallowed — because a lost
    record is a query the person cannot go back to.
    """
    text = str(payload.get("text") or "").strip()
    if not text:
        return {"status": "error", "error": "empty query"}

    try:
        import governance_lanes as lanes

        catalogue = lanes.build_catalogue(write=True)
    except Exception as exc:  # noqa: BLE001 — a catalogue that cannot be built is said
        return {
            "status": "error",
            "error": f"the sessions catalogue could not be built — {type(exc).__name__}: {exc}",
        }

    question = lanes.build_question(catalogue, text)
    try:
        from grace_gui import query_llm

        answer = query_llm(question=question, mode="sessions_query")
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}

    obj = _json_object_from_answer(answer)
    if obj is None:
        _lane_failure(
            "Registry.Sessions.Query.Directive",
            "MALFORMED_DIRECTIVE",
            str(answer),
        )
        return {"status": "error", "error": f"unreadable model answer: {str(answer)[:200]}"}

    # A REQUEST THE LANE CANNOT EXPRESS IS A REFUSAL, NOT AN EMPTY FILTER. Measured 2026-10-18:
    # asked for "sessions with a score below 0.5", the model correctly said it could not — and
    # the route handed back all 23 sessions, which reads as an answer. The model now says so in
    # its own key, and this returns that reason.
    cannot = str(obj.get("unexpressible") or "").strip()
    if cannot:
        _lane_failure("Registry.Sessions.Query.Directive", "UNEXPRESSIBLE", cannot)
        return {"status": "error", "error": cannot}

    sort = str(obj.get("sort") or "newest").strip().lower()
    try:
        filters = lanes.validate_filters(obj.get("filter"), catalogue)
        rows = lanes.execute(filters, sort)
    except lanes.LaneError as exc:
        _lane_failure("Registry.Sessions.Query.Directive", "REFUSED_BY_CATALOGUE", str(exc))
        return {"status": "error", "error": str(exc)}
    except Exception as exc:  # noqa: BLE001 — a failed read is a reason, not an empty list
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}

    answer = {
        "status": "ok",
        "lane": "sessions",
        "sort": sort,
        "filter": filters,
        "explain": str(obj.get("explain") or "").strip()[:120],
        "count": len(rows),
        "sessions": rows,
        "catalogue": catalogue.get("writtenTo") or "not written",
    }
    # THE RECORD IS PART OF THE ANSWER. If it cannot be written, the answer says so.
    answer["capture"] = _capture_query(
        user_id=get_user_id_from_header(x_user_id),
        session_id=str(payload.get("session_id") or "").strip(),
        project_id=str(payload.get("project_id") or "").strip() or None,
        text=text,
        query={
            "lane": "sessions",
            "text": text,
            "sort": answer["sort"],
            "filter": answer["filter"],
            "explain": answer["explain"],
            "count": answer["count"],
        },
    )
    return answer


def _capture_query(
    user_id: str,
    session_id: str,
    project_id: str | None,
    text: str,
    query: dict,
) -> dict:
    """Write the query onto the session seat as a conversation. Never swallows a failure."""
    if not session_id:
        return {
            "captured": False,
            "error": "no session_id was supplied, so there is no seat to file this query under",
        }
    try:
        import services as state

        api = getattr(state, "conversation_api", None)
        if api is None:
            return {"captured": False, "error": "the conversation store is not available"}
        conversation_id = api.create_conversation(
            user_id,
            project_id=project_id,
            title=text[:200],
            metadata={"lane": "sessions", "query": query},
            session_id=session_id,
            tab="sessions",
        )
        # THE WORDS, NOT A REPLY. A lane writes no assistant turn; the conversation exists so the
        # person can find the query again, and its one message is what they actually asked.
        api.add_message(
            conversation_id,
            user_id,
            "user",
            text,
            metadata={"lane": "sessions", "query": query},
            save_to_memory=False,
        )
        return {"captured": True, "conversationId": conversation_id}
    except Exception as exc:  # noqa: BLE001 — a lost record is stated, never hidden
        return {"captured": False, "error": f"{type(exc).__name__}: {exc}"}


@router.get("/api/governance/sessions/query/{conversation_id}")
def sessions_query_load(
    conversation_id: str,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """The stored query behind one conversation on the session seat — for reloading it."""
    try:
        import services as state

        api = getattr(state, "conversation_api", None)
        if api is None:
            return {"status": "error", "error": "the conversation store is not available"}
        conversation = api.get_conversation(conversation_id, get_user_id_from_header(x_user_id))
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    if not conversation:
        return {"status": "error", "error": "no such conversation for this user"}
    metadata = conversation.get("metadata") or {}
    query = metadata.get("query") if isinstance(metadata, dict) else None
    if not isinstance(query, dict) or "filter" not in query:
        return {
            "status": "error",
            "error": "this conversation holds no lane query (it is a chat, not a query record)",
        }
    return {
        "status": "ok",
        "conversationId": conversation_id,
        "title": conversation.get("title") or "",
        "query": query,
    }


@router.post("/api/governance/sessions/query/replay")
def sessions_query_replay(
    payload: dict,
    x_user_id: str | None = Header(None, alias="X-User-ID"),
):
    """Run a stored query again, exactly as it was recorded — no model call, no re-interpretation."""
    conversation_id = str(payload.get("conversation_id") or "").strip()
    if not conversation_id:
        return {"status": "error", "error": "missing conversation_id"}
    stored = sessions_query_load(conversation_id, x_user_id)
    if stored.get("status") != "ok":
        return stored
    query = stored["query"]
    import governance_lanes as lanes

    try:
        catalogue = lanes.build_catalogue(write=False)
        filters = lanes.validate_filters(query.get("filter"), catalogue)
        rows = lanes.execute(filters, str(query.get("sort") or "newest"))
    except lanes.LaneError as exc:
        return {"status": "error", "error": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"status": "error", "error": f"{type(exc).__name__}: {exc}"}
    return {
        "status": "ok",
        "lane": "sessions",
        "conversationId": conversation_id,
        "sort": query.get("sort") or "newest",
        "filter": filters,
        "explain": query.get("explain") or "",
        "count": len(rows),
        "sessions": rows,
    }
