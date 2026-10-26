# The query lanes — one chat, every other tab is a query

**Status: PLAN. Nothing here is built yet except what the "already built" column says.**
Written 2026-10-18 on the owner's word:

> "both eval's and sessions and anything else in the system needs to be tied to the filtering
> process inside of langfuse. And there's only one chat interface inside of governance that is the
> one that says chat on the tab. The rest of them are model based queries for sorting filtering,
> checking everything that the langfuse filtering system provides I can prioritize by criticality
> I assume other things so if if eval is your primary reference then yes let's begin that process."

Read it as one law and one build:

1. **The law.** The `chat` tab is the only place a conversation happens. Every other tab is a
   *query lane*: you type an instruction, the model turns it into a structured query, the query
   is validated and executed, and the rows come back in the output column. No prose reply, no
   chat turn written.
2. **The build.** The vocabulary and the query shape are **Langfuse's own** — not something we
   invent. `eval` is the reference implementation and is already half-built.

### Seats are tabs (the owner's definition, 2026-10-18)

> "when I say seats I mean, the individual tabs will have their own criteria for searching that
> particular tab's data."

So "seat" and "tab" are the same thing in this plan, and each seat carries **its own criteria** —
its own catalogue, its own sort vocabulary, its own store. A lane is not a generic search box
pointed at everything; it is the search for *that tab's* data.

The owner's brief also carries one lane this plan had not named: **conversations**. She must be
able to query conversation IDs the same way she queries sessions — see §5b.

---

## 1. What exists today, measured

| Thing | State | Where |
|---|---|---|
| Evals lane: words → directive | **built** | `POST /api/governance/evals/query` (`backend/routes/governance.py`) |
| Evals catalogue: fields, kinds, real values | **built** | `_filter_catalogue()` → `runtime/governance/filters/<project>.json` |
| Evals seat applies the directive, writes no turn | **built** | `_runEvalsQuery()` in `frontend/src/components/lit/evals-chat-panel.ts` |
| Sessions lane: words → query | **not built** | — |
| Sessions read | partial: one parameter (`days`), seven fields | `GET /api/governance/sessions` |
| Sessions tab input | **still a chat turn** | `chat-panel.ts` → `_onMessageSent` → `_send` |
| Any other lane (tools, approvals, states, repair) | chat turn | same |

### The store question, settled with numbers

| Store | Rows | Who reads it |
|---|---|---|
| `default.traces` (legacy traces) | **0** | the app's **v3** Sessions list |
| `default.observations` (legacy) | **0** | the app's v3 trace detail |
| `postgres.trace_sessions` | **0** | the app's v3 Sessions list |
| `default.events_core` | **1,404** (23 sessions, 1 environment, 1 user) | the room's feed, the app's v4 path, the receipts |
| `default.scores` | **300** | scores, evaluator results |

And the app's own read path, from the database: `users.v4_beta_enabled = false` for the one
account (`admin@raibach.local`). `useReadPath()` turns that into `"v3"`, so the app's **Sessions
list page** (`SessionsPage.tsx` → `SessionsTable isV4={false}`) is reading the empty legacy store.

**This is the first thing to fix, and it is one statement:**

```sql
UPDATE users SET v4_beta_enabled = true WHERE email = 'admin@raibach.local';
```

*(Shown, not run. It flips the app's Sessions and Trace lists onto the events path — the same rows
the room's feed already reads — and it unlocks the events-only filter facets: Metadata, Tool Names
(available/called), Tool Calls. It touches one row, in the local governance Postgres. Nothing else
changes: the flag is what the V4 Preview toggle writes.)*

---

## 2. The language we speak: Langfuse's `FilterState`

The whole plan rests on this one fact: **Langfuse's filter is a JSON array**, and it is the same
array the app's own filter builder produces and its server accepts.

Schema: `packages/shared/src/interfaces/filters.ts` (`singleFilter`, `filterOperators`).

| `type` | Operators | Shape |
|---|---|---|
| `string` | `=`, `contains`, `does not contain`, `starts with`, `ends with`, `is not empty` | `{column, type, operator, value}` |
| `number` | `=`, `>`, `<`, `>=`, `<=` | same |
| `datetime` | `>`, `<`, `>=`, `<=` | `value` is an ISO date |
| `stringOptions` | `any of`, `none of` | `value` is a non-empty array |
| `arrayOptions` | `any of`, `none of`, `all of` | `value` is an array |
| `categoryOptions` | `any of`, `none of` | `{…, key, value: string[]}` |
| `numberObject` | `=`, `>`, `<`, `>=`, `<=` | `{…, key, value: number}` |
| `booleanObject` | `=`, `<>` | `{…, key, value: boolean}` |
| `stringObject` | `=`, `contains`, `starts with`, `ends with`, `is set`, `is not set` | `{…, key, value}` |
| `boolean` | `=`, `<>` | `{column, type, operator, value}` |
| `null` | `is null`, `is not null` | — |

A real example, exactly as the app would send it:

```json
[
  {"column":"environment","type":"stringOptions","operator":"any of","value":["default"]},
  {"column":"traceTags","type":"arrayOptions","operator":"any of","value":["billing"]},
  {"column":"totalCost","type":"number","operator":">=","value":0.05},
  {"column":"scores_avg","type":"numberObject","operator":">=","key":"helpfulness","value":0.8},
  {"column":"createdAt","type":"datetime","operator":">=","value":"2026-10-17T00:00:00.000Z"}
]
```

**So the model's job is to produce that array.** Not our own filter dialect — Langfuse's. If we
later hand the array to the app itself, nothing changes on our side.

---

## 3. Where the vocabulary comes from (never hand-written)

Two files in the app are the single source of truth for what can be filtered:

| Source | Gives |
|---|---|
| `web/src/features/filters/config/sessions-config.ts` — `sessionFilterConfig`, `sessionEventsFilterConfig`, `getSessionFilterConfig()` | the facets: label, column id, type, min/max/unit |
| `packages/shared/src/tableDefinitions/sessionsView.ts` — `sessionsViewCols` (20), `sessionsEventsViewCols` (24) | every column id, its `type`, its internal expression |
| `web/src/features/filters/lib/filter-transform.ts` — `SESSION_COLUMN_TO_BACKEND_KEY = { tags: "traceTags" }` | the frontend-id → backend-key remap |

A generator reads those and writes `runtime/governance/filters/sessions.json`:

- **sessions (v3 set, 17 facets):** `environment`, `id`, `userIds`, `tags`, `sessionDuration`,
  `countTraces`, `inputTokens`, `outputTokens`, `totalTokens`, `inputCost`, `outputCost`,
  `totalCost`, `score_categories`, `scores_avg`, `score_booleans`, `commentCount`, `commentContent`
- **sessions (events set, +4):** `metadata`, `toolNames`, `calledToolNames`, `toolCalls`
- **not facets, owned elsewhere:** `createdAt` (the time-range picker), `usage` (duplicate of
  `totalTokens`), `bookmarked` (removed from the UI on purpose)

Same mechanism for the other configs — `traces-config.ts`, `observations-config.ts`,
`scores-config.ts`, `evaluators-config.ts`, `prompts-config.ts` all follow the same
`FilterConfig`/facets shape, so **one generator covers every lane**.

Rewritten on every query, so it can never go stale. A failed write is reported, never swallowed —
the same rule `_filter_catalogue()` already follows.

---

## 4. How a lane executes

Two candidate paths; I recommend the second, and here is why with the evidence.

**Path A — call the app's own server (tRPC).** `sessions.allFromEvents` accepts exactly this
`FilterState` (`web/src/server/api/routers/sessions.ts`), and behind it sits Langfuse's real
filter→SQL builder (`createFilterFromFilterState`, `FilterList`, `eventsSessionsAggregation`).
**Blocked:** those procedures authenticate with a NextAuth session, not an API key. Our FastAPI
backend has no session, so it cannot call them. Forging one is not a thing I will build.

**Path B — the public HTTP API.** `GET /api/public/sessions` is the only public sessions route and
it **has no `filter` parameter** (`web/src/features/public-api/types/sessions.ts`), it reads Prisma
rather than ClickHouse, and it is deprecated with a sunset of **2026-11-16**. `GET /api/public/traces`
and `/api/public/v2/observations` do accept `filter`, but neither returns sessions as sessions.
**Blocked as insufficient.**

**Path C — our own translator, speaking the same language (recommended).** The room already reads
`events_core` directly, read-only, for the sessions feed and the usage ledger. A translator takes
the validated `FilterState` array and produces SQL over `events_core` (+ a join to `scores` for the
score facets), using the app's own column meanings from the generated catalogue. Nothing about the
*wire format* is ours; only the SQL generation is, and it runs against the same table the app's v4
path reads — so the two surfaces cannot disagree about which rows exist.

The one honest cost: if Langfuse changes a column's meaning in a future upgrade, our generator picks
up the new facet but our executor must learn it. That is a reviewable diff in one file, and the
alternative (Path A) is not available. **Every field the executor does not support is refused by
name, in the UI — never silently dropped.**

---

## 5. The lane contract (one shape, every lane)

Each lane declares four things and nothing else:

| Part | What it is | Example (sessions) |
|---|---|---|
| **Catalogue** | the fields, kinds, operators and real values | `runtime/governance/filters/sessions.json` |
| **Contract** | the JSON the model must return | `{"sort": "<lane sort>", "filter": [ <langfuse filters> ], "window": {"from": "...", "to": "..."}, "explain": "<one line>"}` |
| **Executor** | validated filters → rows, from a named store | `events_core` + `scores` |
| **Renderer** | how the rows are drawn, and the receipt line | session cards + "yesterday · 3 sessions · totalCost ≥ $0.05" |

**Sort vocabularies differ per lane** — this is what "prioritize by criticality" means in code:

| Lane | Sorts |
|---|---|
| sessions | newest · oldest · cost · tokens · traces · duration · name |
| evaluators | newest · oldest · name · type · critical (blocked first) |
| rules | newest · oldest · name · sampling · status |
| traces | newest · oldest · duration · cost · tokens |
| scores | newest · oldest · value · name |
| **conversations** | newest · oldest · messages · title |
| tools / approvals / states / repair | newest · oldest · critical (the failure vault's own severity) |

**The clock is part of every prompt.** The model has no clock, so each request carries today's date,
the timezone and the wall-clock time; "yesterday", "today", "last 3 days", "this week" resolve to
explicit ISO bounds that appear in the receipt line, so the person can see what was actually asked.

### 5b. The conversation lane (owner, 2026-10-18)

> "she should be able to do the same thing with conversation IDs"

The chat's own history is a table, and it gets a lane like every other seat. Store: the studio's
Postgres `conversations` table (`backend/init_db.py`), whose real columns are the criteria:
`id` · `session_id` · `project_id` · `created_by` · `user_id` · `title` · `summary` ·
`message_count` · `tab` · `is_archived` · `deleted_at` · `metadata` · timestamps.

Its catalogue, therefore: **id** (text), **title** (text), **summary** (text), **tab**
(values: `chat`, `approvals`, …), **project** (values), **messages** (number), **created / updated**
(datetime), **archived** (boolean). Its sorts: newest, oldest, most messages, title.

What this buys, in the owner's terms: *"show me the conversation where we discussed the gripper"*
— a title/summary hit — and *"open conversation 4f2c…"* — an id hit. Both are filters, not chat.

**This lane is also the natural first Milvus consumer** (see §7b): an id or a title is a structured
lookup; "the one where we argued about the gripper" is a semantic one.

---

## 6. What the person sees

- **Output column:** the rows the query returned, drawn the way that lane already draws rows
  (session cards, evaluator rows, and so on), plus **one receipt line** naming what was applied.
- **Nothing is written to a conversation.** The lane has no thread, no history, no assistant voice.
- **Three failures are said, never dressed up:** the model answered something unreadable; the model
  asked for a field or value not in the catalogue; the read failed. Each is the real reason in the
  lane's own line, in the red the seat already uses. Same rule as `evals/query` today.
- **A way back:** the receipt line carries a "clear" affordance so the lane returns to its
  unfiltered list.

---

## 6b. The manual sorting and filtering comes OUT of the interface (owner, 2026-10-18)

> "I want to remove the manual sorting and filtering process that's in the application now so I
> just mean remove it from the interface not remove it from the application we make that clear"

**What leaves: the widgets.** The Columns picker, the Filters sidebar, the sort dropdowns, the
per-column menus — the manual controls a person drives by hand in the embedded app's list pages.
When the lane answers, nobody needs to assemble a filter by clicking.

**What stays: the machinery.** The filter config, the facets, the operators, the query builder and
the columns themselves remain exactly where they are, because they are the vocabulary this lane
generates its catalogue from. Removing them would remove the very thing the model is told to speak.

**Where the change lands:** the app's own list pages, inside `governance/langfuse-main/web/`,
rendered as a house patch with a dated comment and an explicit REVERT line — the same treatment
every other patch in that tree already has. It is a presentation change with no data change.

**Phase:** 3b, after the lane renders results (a control may only disappear once the thing that
replaces it works).

## 6c. ClickHouse, the tracking system, and PostHog

Three strands, deliberately not braided. The owner's words: *"we will come back to breaking away
from clickhouse but maybe clickhouse needs to be done first. I'm not sure I want to build our own
tracking system and totally divorce ourselves from the house in Langfuse core."*

**1. The lane contract does not depend on the store.** Every lane declares an executor, and the
executor names its store. Sessions today: `events_core` (+ `scores`). If a tracking system of our
own replaces ClickHouse, the executor changes and the contract — the Langfuse filter array — does
not. That is why the executor is a named seam and not SQL sprinkled through the route.

**2. Order of work, stated plainly:** the lanes first, because they are the thing the owner asked
for and they are small. The ClickHouse question is a *store* decision and lands underneath a
working lane; doing it first would mean building a tracker with no consumer to prove it right.
The one dependency that is real: **`scores` filtering** needs the `scores` join, and that join is
the same work whether the scores live in ClickHouse or in a store of ours.

**3. PostHog (owner, 2026-10-18).** A partner-analytics and frontend-tracking effort is planned for
the **Design seat**, with a copy of the PostHog tree at `posthog-master` (854 MB, read-only here —
I have not opened it beyond confirming it exists). Its effect on this plan is additive, not
structural:

- it introduces a second analytics source (product events: page views, clicks, funnels) whose
  vocabulary is PostHog's, not Langfuse's — so it gets its **own** catalogue and its **own** lane
  when the Design seat asks, and it does not touch the sessions lane;
- if it ever becomes the system of record for user tracking, the sessions/traces lane is still
  about the studio's model calls, which is a different question from who clicked what;
- the honest risk it brings is **two sources disagreeing about "a user"**. When we get there, one
  identity has to be named as the key, and that is a decision to make with the owner in the room.

## 7. Phases

### Phase 0 — the store points where the data is
- `UPDATE users SET v4_beta_enabled = true WHERE email = 'admin@raibach.local';` (shown, needs the word)
- **Accept:** the app's own Sessions list shows the same 23 sessions the room's feed shows.
- **Effort:** minutes. **Unblocks:** the events-only facets.

### Phase 1 — the generator + the sessions catalogue — **BUILT 2026-10-18**
- `backend/governance_lanes.py`: `SESSIONS_FACETS` (the app's 21 facet columns), `OPERATORS` (per
  kind), `app_config_columns()` / `app_config_types()` (parse `sessions-config.ts`),
  `verify_against_app_config()` (drift check), `build_catalogue()` (fields + real values + clock),
  written to `runtime/governance/filters/sessions.json`.
- **Measured on the first run:** the drift check caught a real gap — the app declares `metadata`
  as a separately-named facet (`sessionMetadataFacet`, no inline `as const`), which the first
  parser missed and the check refused to build past. Parser fixed; **21 facets matched**.
- Catalogue now: **13 offered fields** — `environment`, `id`, `userIds`, `sessionDuration`,
  `inputTokens`, `outputTokens`, `totalTokens`, `inputCost`, `outputCost`, `totalCost` (the app's
  session-level facets) + `createdAt`, `lastSeen`, `events` (lane extensions, labelled as such).
- **11 facets are EXCLUDED, on the owner's word (2026-10-18):** *"We don't use scores so you're
  gonna have to go through the list and make sure that we're not trying to query trace related
  stuff because we've removed trace stuff and scores are trace related."* Excluded, each with its
  reason in the catalogue: `tags` (Trace Tags), `countTraces`, `toolCalls`, `calledToolNames`,
  `toolNames`, `metadata` (all trace-tethered) and `scores_avg`, `score_categories`,
  `score_booleans`, `commentCount`, `commentContent` (scores and comments, trace-tethered and
  unused here).
- Excluded ≠ missing: they are still checked against the app's config (drift still catches a new
  facet), still recorded under `excluded` in the catalogue, and **refused by name** if asked for.
  The executor carries no dead branch for them.
- **Accept:** passed — the file lists every offered facet with kind, operators and real values,
  and every excluded facet with its reason.

### Phase 2 — `POST /api/governance/sessions/query` — **BUILT 2026-10-18**
- Route in `backend/routes/governance.py`; `mode="sessions_query"` added to `query_llm`'s
  strict-JSON modes; filters validated against the catalogue, then executed with `readonly=1`.
- **Measured, five real instructions:**
  - "show me yesterday's sessions" → `lastSeen` ≥ 2026-10-17T00:00Z and < 2026-10-18T00:00Z → **4
    sessions** (first run bound it to `createdAt` and answered 0; a session that STARTED on the
    16th and ran into the 17th proved the field was the wrong one — hence `lastSeen`).
  - "the most expensive sessions first" → `sort: cost`, no filter → 23 sessions, cost descending.
  - "sessions with more than 400 events" → first run mapped it to `countTraces` and answered 0
    (a clean answer about a different column) — the `events` field now exists and it returns the
    one session with 628 events.
  - "sessions with a score below 0.5" → **refused**. After the exclusion it is refused at the
    name: *"the model asked to filter by 'score', which is not a field of this lane"*, and a
    request aimed straight at a facet gives its reason — `tags` answers *"a real field of this
    app, but this lane does not offer it — trace tags are written on trace rows"*.
  - "sessions from the langfuse-llm-as-a-judge environment" → an honest 0 (no session rows in it).
- **Accept:** passed — including the refusals, which is the half that matters.
- **AND THE SCORES JOIN IS CANCELLED.** It was listed as the next executor change; the owner's
  decision removes it from the roadmap rather than deferring it.

### Phase 3 — the tab-aware input and the renderer — **BUILT 2026-10-18**
- `chat-panel.ts`: `_send` branches on `activeTab === 'sessions'` ABOVE the tab flip, so a query
  typed on that tab can never be dragged into the chat; `_runSessionsLane` posts to the route with
  the seat's `session_id`, `project_id` and `X-User-ID` (the capture needs a seat to file under).
- `sessions-feed.ts`: takes `queryRows`, `receipt`, `laneError`, `laneBusy`; draws the receipt line
  + the returned rows, and its `Clear` button raises `sessions-lane-clear`.
- **Measured in the room at :5001:** on the Sessions tab, `show me yesterday's sessions` → receipt
  *"sessions with activity yesterday — lastSeen >= 2026-10-17T00:00:00+00:00 · lastSeen <
  2026-10-18T00:00:00+00:00 · 4 sessions"* and 4 cards; `the most expensive sessions first` →
  *"most expensive sessions first · 23 sessions"* and 23 cards. No chat turn is written either
  time.
- **Accept:** passed.

### Phase 3a — the query is captured as a conversation — **BACKEND BUILT 2026-10-18**

Owner: *"we need to make the conversations capture the query. So if I say I want three, then that
gets added to the conversation ID for the session seat. So I can go back as a user and select that
conversation in sessions, and it will reload my exact query."*

- Every **successful** lane query now writes one conversation on the session seat:
  `tab = "sessions"`, `title` = the person's words, and the whole validated query inside
  `metadata.query` (`lane`, `text`, `sort`, `filter`, `explain`, `count`). One `user` message is
  written — the words themselves, not a reply. `save_to_memory=False`, so a query does not become
  a memory of the conversation.
- A capture that fails is **reported in the answer** (`capture.captured = false` + the reason). A
  lost record is a query the person cannot go back to, so it is never silent.
- `GET /api/governance/sessions/query/{conversation_id}` returns the stored query.
- `POST /api/governance/sessions/query/replay` re-runs it **without a model call** — the recorded
  filter is re-validated and executed, so a reload can never drift from what was asked.
- **Measured:** `show me yesterday's sessions` → conversation `37e260b2-43d7-450e-9499-f5556fb34064`,
  title kept, query reloaded byte-for-byte, replay returned the same **4** sessions.
- **NOW WIRED INTO THE SEAT (Phase 3, same day):** a successful query prepends its record to the
  seat's own conversation list (id, title, `tab: 'sessions'`), so it can be selected at once; a
  capture that FAILED is written onto the receipt line as `NOT RECORDED — <reason>` instead of
  leaving a person believing they can come back.
- **Measured in the room:** `the most expensive sessions first` → record `d5dc5489-c201-459c-919e-377b0c5c0a8b`
  at the top of the list; Clear emptied the lane; selecting that record moved the panel to Sessions,
  bound its id, and restored the receipt and the **same 23 rows** from the record — no model call.


### Phase 4 — the same contract for the remaining lanes
- Evaluators/rules: fold the existing `evals/query` into the shared contract (same validation, same
  receipt line, same renderer rules) — it already works, it just has its own private shape today.
- Tools, approvals, states, repair: our own catalogues (the failure vault, the approvals queue).
- **Accept:** every non-chat tab answers with rows and a receipt line; no tab writes a chat turn.
- **Effort:** half a day per lane.

### Phase 5 — the conversation lane
- Catalogue over the studio's `conversations` table (id, title, summary, tab, project, messages,
  created/updated, archived), executor against Postgres, rows drawn as conversation rows.
- **Accept:** "open conversation 4f2c…" and "conversations with more than 20 messages" both answer
  with the real rows; pressing a row adopts that conversation in the seat.
- **Effort:** half a day.

### Phase 6 — Milvus as the semantic second pass
- Fix the silent `[]` returns, create the collection, index conversations, add the ranked second
  pass to the conversation lane only. Details and cautions in §7b.
- **Effort:** one day, and only after Phase 6 is answering correctly.

### Phase 7 (optional, later) — the middle pane shows the app's own filtered view
- Encode the validated `FilterState` with `encodeFiltersGeneric` (`packages/shared/src/features/filters/filterQueryEncoding.ts`)
  and navigate the embedded app to `/project/<id>/sessions?filter=<encoded>` so the app's own table
  applies the same filter through its own pipeline.
- **Why last:** it proves parity between our executor and the app's, but it needs the URL codec's
  4,000-character cap and the app's sessionStorage behaviour handled honestly.

---

## 7b. The Milvus decision, in full

The owner asked whether this is the moment to hook it up. Here is the state, measured today.

**What exists, and what state it is in**

| Thing | State |
|---|---|
| `backend/milvus_client.py` (348 lines) | written — a wrapper supporting lite / standalone / distributed |
| `backend/governance_vector.py` (137 lines) | written — collection `governance`, local embeddings (`BAAI/bge-small-en`), `index_rows` / `search` / `count` |
| `backend/conversation_api.py` | calls the client for conversation memory |
| `backend/governance_inspector.py` | calls `governance_vector.search(query, k=4)` |
| `config.py` | `MILVUS_MODE = "lite"`, store at `./milvus.db` |
| `pymilvus` in the venv | **installed, 3.0.2** |
| the store file `milvus.db` | **does not exist** — nothing has ever been written |
| a Milvus container | none; lite mode needs none |

**So Milvus is coded and cold.** Two consequences worth stating plainly:

1. `governance_vector.search()` returns `[]` when the store cannot answer (`except Exception: …
   return []`), and `count()` does the same. That is the exact anti-pattern this plan forbids for
   the lanes: **an empty list standing in for a failure.** The inspector asking for 4 relevant rows
   today gets silence, not an error. Fixing that is part of switching it on.
2. With no store file, every semantic recall in the app is currently a no-op.

**Is it time? Not for the filter lanes — yes for the conversation lane, and only as a second pass.**

- **Structured filters do not need it.** "Sessions over 5 cents", "yesterday", "score below 0.5"
  are exact comparisons over columns. A vector index adds nothing and can only add wrongness.
- **Semantic recall needs it.** "The conversation where we argued about the gripper" has no column
  to compare. That is what embeddings are for, and the conversation lane is the smallest, most
  useful first collection: `conversations.id + title + summary + first turns`.
- **The order matters, and it is the owner's rule already:** filter first (deterministic, exact,
  auditable), semantic second (a ranked shortlist the person can see), never semantic *instead of*
  a filter. Every lane therefore has the same two passes, and the second is optional per lane.

**The switch-on, when the word comes:**

1. Remove the silent `return []` paths in `governance_vector.py`; a store that cannot answer says
   so in the lane's line.
2. Create the collection and **index what already exists** — conversations first, then governance
   rows (register, corrections, findings, inspections). Reindex is `reindex_local_vectors.py`.
3. Add the second pass to the conversation lane only: structured filter → if the person's words
   look semantic, ask the store for the top *k* and show the ranked hits with their scores.
4. Only then extend it to sessions/traces, whose text is much larger and needs a chunking rule
   that has not been designed yet.

**One caution, stated because it is real:** lite mode is a single file with no server. It is right
for this local studio and it is not a multi-user store. If the room ever serves more than one
person at a time, lite is the wrong mode — and that is a decision, not a bug.

## 8. Deliberately out of scope

- **Driving the app's modal.** The Columns/Filters panel in the screenshots belongs to the embedded
  app; the room cannot read or write its state. We reuse its **vocabulary**, not its widget.
- **A second chat.** No lane gets a conversation, history or assistant voice.
- **Comments (`commentCount`, `commentContent`).** They live in Postgres and the app intercepts them
  before ClickHouse (`commentFilterService.ts`). Phase 2 accepts the field and returns the honest
  "not supported yet — comments live in Postgres" rather than a silent empty list.
- **Saved views, URL filters, column ordering.** Not part of this.

---

## 9. Risks, stated plainly

| Risk | Answer |
|---|---|
| Catalogue drifts from the app | It is generated from the app's files; a config change is a file change |
| Our SQL disagrees with the app's | Phase 5 makes the disagreement visible; the executor refuses unknown fields rather than guessing |
| The model invents a field or value | Refused by name, and the wall is recorded in the failure vault (same as evals today) |
| "Yesterday" is ambiguous | The clock is injected, the resolved bounds appear in the receipt line |
| The vocabulary is mostly empty in this deployment | 1 environment, 1 user, 0 tool calls today — the lane says "no values present", it does not pretend |
| Cost of a lane query | One small model call per instruction, no conversation growth |

---

## 10. How the owner tests it

1. Open the Governance room at `http://localhost:5001`, go to the Governance tab.
2. Press **Sessions** in the rail.
3. Type into the input at the bottom of the chat column:
   - `show me yesterday's sessions`
   - `the most expensive ones first`
   - `sessions with more than 500 events`
   - `only the ones with a score below 0.5`
4. Expect: the output column replaces the list with the matching sessions and one line saying what
   was applied; the chat column writes nothing; pressing a card opens the real session.

The one thing that must never happen: an empty list that means "the read failed".
