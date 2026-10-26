# PLAN — Wiring the studio into the Governance room (Langfuse)

**Status: EXECUTING — Step 1 (traces) LIVE; Step 2 (scores) LIVE; model prices stated; the studio's
exact costs LIVE (all 2026-10-09). All studio-side work COMMITTED AND PUSHED to `main`
(production, 2026-10-09). Wires 3–5 await the owner's word.**
Filed 2026-10-09. Scope chosen by the owner: **all five wires**. First emitter: **Composer runs**.
Wires 3–5 await their turns.

---

## What "wiring" means here

The studio becomes the thing the room watches. Langfuse receives; we decide what we feed it —
runs, judgments, prompts, datasets — and later whether our agents read back from it.
Everything stays local: this is the same localhost Langfuse (frame-proxy `:3100`) the room
already embeds. Nothing leaves the machine.

## Receipts (what already exists)

- ✅ Project API key **`raibach-ids`** created via the room (Settings → API Keys; no expiration;
  admin). Secret is shown once by Langfuse — the record lives in `Keys/langfuse-governance-api-key.txt`
  (includes the ready `.env` block).
- ✅ Key verified against the room: `GET /api/public/projects` → 200 (`Governance` / `Raibach Studio`);
  negative control (wrong secret) → 401.
- ✅ The seam: **every studio model call goes through `query_llm()`** — `backend/grace_gui.py:423`.
  Modes: `console_assembly`, `surface_assembly` (the Composer's assembly), `prompt_output` (RUN),
  `figma_ingest`, `chat`, `writer`. The module already hard-fails per model — no hidden fallback exists
  to accidentally trace.
- ✅ The single call line: `response = client.chat.completions.create(**payload, model=model_name)`
  — `grace_gui.py:657` (client built at `:646`). Usage + a monotonic call id are already tracked
  in-module (`LAST_USAGE`).
- ✅ `langfuse` SDK **4.17.0** installed into `backend/.venv` (uv — the venv is uv-managed) and recorded in `backend/requirements.txt`.
- ✅ Env: the three `LANGFUSE_*` lines added to `backend/.env` (values from the Keys file; host = localhost:3100; server telemetry verified OFF in both containers).
- ✅ Instrumented: `grace_gui.py` imports the drop-in client + `propagate_attributes`; the single `create()` call is wrapped; trace name `query_llm.<mode>`, `user_id` = studio identity, `session_id` = prompt_id, tags/metadata = mode/model/temperature. Backend restarted onto the new code.
- ✅ FIRST TRACES LANDED AND SEEN IN THE ROOM: 6 observations in the room's Tracing (4 GENERATION + 2 SPAN); the `query_llm.chat` rows in the v4 event store (`events_core`) carry the chosen user/session; the room's "Waiting for first trace" onboarding is gone. Screenshot on record. (Trigger basis: engineer-side calls through the SAME production path — `query_llm` — not yet a click in the UI; the next room action stamps its own.)
- ⚠️ WORKER FIX (found + resolved during Step 1): the langfuse-worker had been holding dead ClickHouse sockets since the ClickHouse container restarted (~4h earlier) — ingestion jobs began ("Starting ClickhouseWriter") then hung silently; the tell was the batch-export queue logging a socket timeout every 30s. Worker restarted, ingestion flows. If ClickHouse restarts again, restart the worker.
- ⚠️ API NOTE (updated during Wire 2): this deployment runs v4 in **events_only mode** — the legacy public API (`/api/public/traces`, `/api/public/scores`, …) answers **404** by design ("This endpoint is not available on deployments running in Langfuse v4 events_only mode"). Ingestion flows through `/api/public/ingestion`; storage = ClickHouse (`events_core` / `events_full` / `scores`). The v4 UI (the room) reads the event store directly. **Verify in the room or in ClickHouse — never via the legacy public API.**

---

## The five wires, in the recommended order

### 1. Traces — Composer first
Instrument `query_llm()` once; every mode is then traced, and the Composer's assembly
(`surface_assembly` / `console_assembly`, plus `prompt_output` for RUN) is the first visible traffic.

- **Install:** `backend/.venv/bin/pip install langfuse`
- **Env:** add to `backend/.env` (values in the Keys file):
  `LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASE_URL=http://localhost:3100`
- **Instrument:** at the client construction (`grace_gui.py:646`), swap the import to
  `langfuse.openai.OpenAI` — a drop-in for the same API that captures each `chat.completions.create`
  automatically: full input messages, output, model, token usage, latency.
- **Tag:** trace name `query_llm.<mode>`; metadata = mode, `prompt_id`, call id; `session_id` / `user_id`
  per the open questions below.
- **Behavior guarantee (honest):** tracing is a **tap, not a dependency**. The SDK batches in the
  background; if the room is down, the studio keeps working, traces drop, and the SDK writes the
  failure to our backend log. The room itself shows its own liveness ("Waiting for first trace" /
  stale data) — no fake anything, ever.
- **Verify (in-room law):** run the Composer in the room → the assembly call appears in Tracing
  within seconds; screenshot receipt. Then one chat turn → `query_llm.chat` trace.
- **NOT doing:** no demo data, no synthetic traces, no fallbacks.

### 2. Scores — our judgments post onto runs
Sources, in likely order: the engine's judge verdicts (`run_process_bind` / `run_report` — already
structured as task verdicts), `demo_policy` checks, `role_caps`, `figma_fidelity` pixel results.
Langfuse score API: name + value + comment, attached to a trace or session id.
Open for the owner: which judgments post first (recommendation: the engine judge verdicts).

## Step 2 — EXECUTED (2026-10-09): studio judge verdicts post as scores onto the run's own trace

Chosen first source (default taken): the STUDIO's judge — every evaluation recorded by
`POST /api/prompt-sessions/{id}/evaluations` (both branches: judged-now and verdict-supplied)
posts a Langfuse score: **name `judge`, CATEGORICAL value = the verdict word exactly
(`cleared` / `failed` / `error`), comment = the judge's sentence. No invented numbers.**

How the score finds the run's trace — no lookup, no race:

- `query_llm()` now takes an optional `trace_session`; the teacher RUN passes
  `request.session_id` (the package), so a run's trace carries the session in the room.
- The trace id is **made first** (`create_trace_id()`) and the call is **pinned** onto it by an
  outer span (`start_as_current_observation(trace_context={"trace_id": …})`). Reading
  `get_current_trace_id()` back after the call returns **None** — the drop-in's generation span
  has already ended (the SDK says so itself: "No active span in current context"; measured on
  4.17.0). Result: root SPAN `query_llm.<mode>` → GENERATION child; the id is owned, so it is
  written to the in-process ledger `LAST_RUN_TRACE[session_id]` (`grace_gui.py`) — only
  `prompt_output` runs write it (a judge/tag writer call must never overwrite a run's entry).
- The evaluate endpoint reads the ledger and posts `create_score(trace_id=…)`; a session with no
  run on record falls back to `create_score(session_id=…)` — **which target was used is printed,
  never implied**. A score-post failure is printed and never fails the evaluation (the
  `run_evaluations` row is the record; the score is its mirror — tap, not dependency).
- Trace-io follow-up: the pinned root's preview read "didn't receive an input or output" (our
  span was empty; the generation child held both). `set_current_trace_io` wrote **nothing** the
  preview reads (root io stayed 0/0 in `events_full` — measured). `update_current_span(input=…,
  output=…)` on the pinned root fills it — proved with a probe trace, then live on run four
  (root io 151/9).

RECEIPTS (all local, 2026-10-09):

- Live smoke through the production paths (labeled session `WIRE2 SMOKE — safe to delete`,
  id `c1433fde-7359-43be-a9ca-b79b924a7979`): run via `POST /api/teacher/query` → verdict via
  `POST …/evaluations` → server log line: `[langfuse] verdict 'cleared' posted to the run's
  trace 49a18d39… (session c1433fde…)`.
- ClickHouse `scores`: `judge = cleared`, CATEGORICAL,
  `trace_id = 49a18d39adff80b6f2b9a866a1a5fac2`, comment = "The run's answer exactly matches the
  requested output \"run four\"." (plus one earlier session-level row from the pre-fix attempt,
  also `cleared`, comment "…run one." — the honest pre-fix artifact).
- In-room (screenshots on record): the trace page shows the `judge: cleared` chip, the session
  chip, the pinned tree (`query_llm.prompt_output` → `OpenAI-generation`), the assembled prompt
  (System / User / Assistant), and the comment popover with the judge's sentence.
- Traces pinned BEFORE the io fix keep empty root io (0/0) — recorded, not corrected.

Artifacts of the smoke (labeled; safe to delete on the owner's word — NOTHING deleted yet):
studio session `c1433fde-…` ("WIRE2 SMOKE — safe to delete") + its conversations/evaluations
rows; Langfuse probe traces `wire2-probe` and `io-probe-span`.

Not yet wired (later wires / v1.1): the ENGINE's standalone verdicts (`run_process_bind` /
`run_report` judge ledger) — they post through their own runner when the owner takes that step.

## Room-side — MODEL PRICES STATED (2026-10-09): the "Model costs" widget calculates by date

The owner asked the room's Home dashboard to show real costs, date-based ("I imagine the system
here will calculate that and base it on dates"). The prices were already on record — **the
owner's price sheet (2026-10-03) inside `grace_gui.py` (`_DEEPSEEK_PRICING`)** — so no number was
invented. Stated as Langfuse model definitions via the room's own Settings → Models form:

- `deepseek-flash` — input **$0.15** / cached-input **$0.003** / output **$0.60** per 1M (off-peak side)
- `deepseek-v4-pro` — input **$0.66** / cached-input **$0.022** / output **$1.98** per 1M (off-peak side)

Mechanics verified in Langfuse's own code (v4.55.0, local image): prices are stored per single
token (the form's preview shows per-unit / per-1K / per-1M); the ingestion processor **subtracts
cached tokens from input before storing** (so a cached-input price is exact, never double-billed);
the worker enriches cost **at ingestion** (`matchPricingTier` + `calculateUsageCosts`), so:

- NEW traffic prices automatically; **old traces keep their stored empty cost** (no fabricated
  retro numbers — recorded, accepted).
- Measured live on run five (trace `57305185…`): usage `{input:23, output:3}` →
  `cost_details {input:0.00000345, output:0.0000018, total:0.00000525}`, tier `Standard` — exactly
  23 × $0.15/1M + 3 × $0.60/1M.
- The Home widgets are date-scoped by their range filter ("Past 1 day" etc.); per-event
  timestamps carry the dates.

**Displays honestly:** the observation row in the trace tree shows `$0.000005`; the dashboard's
"Model costs" table and the trace header use Langfuse's `costFormatter` = 2 decimals **exactly**
(`usdFormatter(value, 2, 2)`), so sub-half-cent totals read `$0.00` until they accumulate (≈66K
input tokens per cent at flash off-peak). The "Cost by model" chart already plots the micro
values. The studio's own ledger (`/api/governance/usage`) remains the exact per-call view
(peak/off-peak windows + measured cache split); Langfuse's static definition bills at off-peak
rates (the window all studio traffic has used) and cannot vary price by hour.
Open option (owner's word): patch the house image's `costFormatter` to show micro-dollars
(one-line change + image rebuild, as done for F1b), or leave the vendor display as-is.

## Optional upgrade + display patches — EXECUTED (2026-10-09)

### (a) Display precision (house patches; image rebuilt twice; both verified in-room)

- `web/src/utils/numbers.ts` — `costFormatter` was `usdFormatter(v, 2, 2)` (EXACTLY two
decimals; every sub-half-cent cost read "$0.00"). Now `(v, 2, 6)` — the app's own
`usdFormatter` default. The dashboard's Model costs table went from `$0.00` to the true
total the moment it rebuilt (`$0.000246` over the day's range).
- `web/src/features/traces/components/ObservationMetadataBadgesTooltip.tsx` —
  `formatMetricCost` was `(v, 2, 3)`; now `(v, 2, 6)` — the trace header chip reads
  `$0.000005` like the tree row.
- `web/src/utils/numbers.clienttest.ts` — expectations updated WITH the patch (dated
  comment says both revert together). The vendor tests do not run in the image build.
- Mechanism (same as F1b): `colima ssh -- docker buildx build … -t langfuse-web:gov-embed`
  → `docker compose up -d langfuse-web`. Both builds exit 0; room verified after each.

### (b) The studio now sends its OWN exact cost — provided cost_details, used verbatim

- `grace_gui.py`: the drop-in `langfuse.openai.OpenAI` is replaced by the RAW client; the
  call runs inside OUR generation observation (`completion`, child of the pinned root
  span) and carries `usage_details` (input EXCLUDING cached, per Langfuse's own
  convention) + `cost_details` from `_estimate_cost_details` — a twin of the ledger's
  `_estimate_cost` reading the same sheet table and the same clock (the original
  `_estimate_cost` is untouched; both derive identical totals) — plus
  `metadata.cost_basis`. A drop-in call under our generation would log a SECOND
  generation and double-count: one client, one generation.
- PROOF (A/B, the decisive one): a probe call with `DEEPSEEK_PRICING=peak` stored input
  cost `366 × $0.30/1M = $0.0001098` (PEAK) — not the `$0.0000549` the static off-peak
  definition can ever produce. **Provided cost wins.**
- Run six receipt (trace `e705bc08…`): generation `completion` → usage
  `{input:23, output:3, total:26, cached:0}`, cost
  `{input:3.45e-6, cached:0, output:1.8e-6, total:5.25e-6}`, basis
  "DeepSeek off-peak rates, measured cache split" — the ledger's own arithmetic (its row
  DISPLAYS 0.000005 because the ledger rounds to 6 dp by its original contract; the
  underlying number is the same 0.00000525).
- Consequence on the room's static model definitions: they remain as the FALLBACK for any
  call the studio cannot price (unknown model) and for non-studio traffic; provided
  costs override them per call.

### 3. Prompts — Composer packages ↔ Prompt Management
`prompt_sessions` rows become versioned Langfuse prompts with labels
(production / latest / experiment). One-way first (studio → Langfuse), pull direction later.

### 4. Datasets & experiments
`prompt_sessions` rows + the engine's task sets (round 1 / round 2) become dataset items;
batch runs (the engine runner) post experiments in the same pass that writes `bind_runs`,
so a run's results are comparable in the room.

### 5. MCP back-channel
Langfuse's MCP/CLI + the `raibach-ids` key (Basic auth = base64(pk:sk), shown at creation —
derivable from the Keys file). Our agents (Grace included) gain read access to the room's
own traces and scores.

---

## Ground rules (standing house law)

- Everything local; failures surface with real reasons; blank beats fake.
- Verification happens **in the room** (the react frame), not on raw ports.
- `governance/` is gitignored (local-only); studio-side edits are repo files — commits only on the
  owner's word.
- The wiring must never degrade a Composer or chat run. If it would, it doesn't ship.

## Decisions taken for Step 1 (defaults from the questions above — one-liners to change)

1. **Trace names:** `query_llm.<mode>` + tags ✅ (live).
2. **Identity:** the studio's active identity `00000000-0000-0000-0000-000000000001` as `user_id` ✅ (live; `_STUDIO_USER_ID` in grace_gui.py).
3. **Payload capture:** full prompt + response text, nothing excluded ✅ (it is the room's value; all local).

## Step 1 — EXECUTED (2026-10-09)

Install the SDK → env lines → instrument the one seam → real calls → the first traces visible in the
room's Tracing (screenshot: 6 observations; onboarding retired). The remaining legs happen the moment
the room is used: a chat turn stamps `query_llm.chat`; a Composer RUN stamps `query_llm.prompt_output`
— same seam, same wire.
