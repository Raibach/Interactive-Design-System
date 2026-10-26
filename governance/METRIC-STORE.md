# Our own metric store

**Written 2026-10-18.** The question: *"how do we build our own metric store?"* The short answer
is: **one Postgres table written at the call site we already own, five SQL views shaped like the
dashboard's widgets, and the dashboard reads those views.** ClickHouse then has nothing to do,
because everything it was holding was these five answers.

---

## 1. What the metric store has to answer

These are the dashboard's questions, in the owner's terms — nothing else.

| Question | Shape of the answer |
|---|---|
| What did we spend, by model? | day × model → calls, tokens in/out, cached, cost |
| What did we spend, by call type? | day × mode → cost |
| How much did each model get used? | day × model → calls, tokens |
| How fast does it answer? | mode → p50 / p90 / p95 / p99 latency |
| Who consumed what? | user × day → calls, cost |

Every one of those is a `GROUP BY` over **one row per model call**. That is the whole store.

## 2. The table

The studio already makes every model call through one function (`query_llm` in `backend/grace_gui.py`)
and already knows every number below at the moment the call returns. What it lacks is a row to
write them into — `usage_metrics` is a monthly counter with a `metadata` blob, not a ledger.

```sql
CREATE TABLE IF NOT EXISTS model_calls (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    called_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    mode              VARCHAR(32)  NOT NULL,   -- chat | surface_assembly | console_assembly | prompt_output | evals_query | writer
    model             VARCHAR(64)  NOT NULL,
    provider          VARCHAR(32)  NOT NULL,
    user_id           UUID,
    session_id        TEXT,                    -- the seat's session (what a "session" already means)
    package_id        UUID,                    -- prompt_sessions.id, when the call belongs to a package
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    cached_tokens     INTEGER,
    cost_usd          NUMERIC(12,6),           -- the studio's own exact figure, never an estimate from elsewhere
    latency_ms        INTEGER NOT NULL,
    ok                BOOLEAN NOT NULL,
    error_code        VARCHAR(60)              -- failure_vault's code, when ok = false
);

CREATE INDEX IF NOT EXISTS idx_model_calls_time    ON model_calls (called_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_calls_model   ON model_calls (model, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_calls_mode    ON model_calls (mode, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_calls_session ON model_calls (session_id);
CREATE INDEX IF NOT EXISTS idx_model_calls_package ON model_calls (package_id);
```

**Why one table and not four.** Cost, tokens, latency, model and mode are all facts about *the same
call*. Split across tables they would need a join to answer a single question, and they could drift
apart — one row saying a call succeeded while another says it failed. One row, one truth.

**Not in it, deliberately:** the prompt, the answer, the response body, the user's typing. The
store counts; it does not read. That is the same rule the cost receipt was given.

## 3. The write

One function, at the one place every call already passes through:

- `query_llm()` returns → `_record_call(...)` inserts **one** row: the numbers from the provider's
  own `usage` block, the cost the studio already computes (`_estimate_cost_details`), the wall
  time it already measures (`call_elapsed`), and the failure code when the call raised.
- **The insert never blocks the answer and never hides itself.** A failed write prints
  `[metrics] call not recorded (<reason>)` exactly as the ledger does today — a lost row is stated,
  never swallowed.
- `run_evaluations` and `failure_snapshots` already exist and already carry their facts; they gain
  a `cost_usd` and `latency_ms` column rather than a new table.

## 4. The read — five views, one per widget

```sql
-- Model usage (calls, tokens) and cost by model, per day
CREATE OR REPLACE VIEW v_usage_daily AS
SELECT date_trunc('day', called_at) AS day,
       model,
       count(*)                    AS calls,
       sum(prompt_tokens)          AS tokens_in,
       sum(completion_tokens)      AS tokens_out,
       sum(cached_tokens)          AS tokens_cached,
       sum(cost_usd)               AS cost_usd
  FROM model_calls
 WHERE ok
 GROUP BY 1, 2;

-- Cost by call type, per day
CREATE OR REPLACE VIEW v_cost_by_mode AS
SELECT date_trunc('day', called_at) AS day, mode, sum(cost_usd) AS cost_usd, count(*) AS calls
  FROM model_calls WHERE ok GROUP BY 1, 2;

-- Latency percentiles per mode (Postgres does this natively)
CREATE OR REPLACE VIEW v_latency_percentiles AS
SELECT mode,
       count(*) AS calls,
       percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms) AS p50,
       percentile_cont(0.90) WITHIN GROUP (ORDER BY latency_ms) AS p90,
       percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms) AS p95,
       percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms) AS p99
  FROM model_calls WHERE ok GROUP BY 1;

-- User consumption, per day
CREATE OR REPLACE VIEW v_user_consumption AS
SELECT date_trunc('day', called_at) AS day, user_id, count(*) AS calls, sum(cost_usd) AS cost_usd
  FROM model_calls WHERE ok GROUP BY 1, 2;
```

Each view is the exact shape of one widget. A card is then a single `SELECT … ORDER BY day` — no
aggregation in the browser, no second store, no engine.

## 5. The order of work

1. **Table + write.** `init_db` gains `model_calls`; `query_llm` writes one row per call. Nothing
   reads it yet. Verify by counting rows against calls made in a minute.
2. **Views.** The five above, plus one "are we complete?" check: calls recorded vs. calls made.
3. **Backfill.** One `SELECT` from ClickHouse `events_*` → `INSERT` into `model_calls`, so history
   does not start at zero. One-off, shown as SQL before it runs.
4. **Our own cards.** The room's left space draws the five answers — the UX-metrics surface the
   owner already reserved. This is the piece that makes the dashboard ours.
5. **Cut the app's dashboard.** When the cards stand and the numbers agree for a week, the
   Langfuse dashboards are demoted to reference. Then `clickhouse` and `langfuse-worker` leave
   `docker-compose.yml`: ~480 MiB + 552 MiB back, and one fewer store to keep honest.

Steps 1–3 are ours alone. Step 4 is a surface build. Step 5 is one compose edit plus the
confidence of everything above.

## 6. What this store does not answer yet

The **customer-side** metrics (`USER-FLOW.md`): time-to-intent, click-through latency, task
completion, drop-off. Those are not model calls. They need three things that do not exist — a
served-at timestamp on the assembly, a component identity on each interaction, and a session that
survives the journey — and they become a second table (`surface_interactions`) written by the
served surface, read by the same kind of views.

**The rule holds for both:** the studio writes what it already knows, at the moment it knows it,
and nothing else.
