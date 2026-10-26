# What the query lanes are — the short version

The full plan is archived at [`archive/QUERY-LANES-PLAN.md`](archive/QUERY-LANES-PLAN.md); the lanes
are built now, and this file is the spine.

## The law (owner, 2026-10-18)

- **One chat:** the tab that says **chat**. Conversation, history, assistant voice.
- **Every other tab is a query lane:** you type an instruction; the model turns it into a
  **Langfuse filter**; the filter is validated, executed, and the rows are drawn in the output
  column. No reply is written.
- **Seat = tab**, and each seat carries **its own criteria** for searching its own data
  (*"when I say seats I mean, the individual tabs will have their own criteria for searching that
  particular tab's data"*).

## The lanes

| Lane | Store | The criteria |
|---|---|---|
| sessions | `events_core` (+ `scores`) | Langfuse's 21 session facets |
| eval (evaluators / rules) | governance Postgres | the existing `_filter_catalogue()` |
| **conversations** | studio Postgres `conversations` | id, title, summary, tab, project, message count, created/updated, archived |
| tools · approvals · states · repair | the failure vault, the approvals queue | their own catalogues, criticality first |

## The language

Langfuse's own `FilterState` — the JSON array its filter builder produces and its server accepts.
Schema: `packages/shared/src/interfaces/filters.ts`. Twelve filter types, each with its own
operator set (`string`, `number`, `datetime`, `stringOptions`, `arrayOptions`, `categoryOptions`,
`numberObject`, `booleanObject`, `stringObject`, `boolean`, `null`).

We do **not** invent a dialect. The model's output is the array the app itself would send.

## The vocabulary

Generated, never hand-written, from:

- `web/src/features/filters/config/sessions-config.ts` (the facets)
- `packages/shared/src/tableDefinitions/sessionsView.ts` (`sessionsViewCols`,
  `sessionsEventsViewCols`)
- `web/src/features/filters/lib/filter-transform.ts` (`{ tags: "traceTags" }`)

→ `runtime/governance/filters/<lane>.json`. The same mechanism covers every `*Config` in the app.

## The execution

Our own translator over `events_core` (+ `scores` join), because:

- the app's tRPC procedures need a NextAuth session (our backend has none),
- `/api/public/sessions` has **no** `filter` parameter and is deprecated (sunset 2026-11-16),
- `events_core` is the same table the app's v4 path reads, so both surfaces agree.

Unknown field or value → refused **by name** in the UI. Never a silent empty list.

## The first fix, before any of it

The app's Sessions list is on the **v3 path** (`users.v4_beta_enabled = false`), and the legacy
stores are empty: `traces` 0, `observations` 0, `trace_sessions` 0, while `events_core` holds 1,404
rows across 23 sessions. One statement flips it:

```sql
UPDATE users SET v4_beta_enabled = true WHERE email = 'admin@raibach.local';
```

## The saved conversation is the preset (owner, 2026-10-24)

The chat is the primary filter now. A saved conversation under the Sessions tab **is** the preset:
its ID is the key, its title is the person's words, and its stored filter is the view. Selecting it
replays the stored query and draws the same rows. There is no separate preset store and no second
Sessions interface — the left navigation's Sessions entry is removed.

The target is the application's **full** sessions filter vocabulary, not a simplified subset. The
app's Columns, Filters and sort controls leave the interface only once the chat lane draws
everything they can express (Phase 3b); the data, facets and operators stay as the vocabulary. The
exploration is `frontend/src/rooms/governance/PLAN-chat-as-filter.md`.

## The reference

`eval` is the reference implementation: `POST /api/governance/evals/query` +
`_filter_catalogue()` + `_runEvalsQuery()`. It already does words → directive → applied list →
no chat turn. Sessions copies it; the remaining lanes copy it after that.

**Sessions is now built** (2026-10-18): `backend/governance_lanes.py` +
`POST /api/governance/sessions/query`, catalogue at `runtime/governance/filters/sessions.json`,
contract `{sort, filter[], explain}` or `{unexpressible}`.

## What the model may use (sessions)

`environment` · `id` · `userIds` · `sessionDuration` · `inputTokens` · `outputTokens` ·
`totalTokens` · `inputCost` · `outputCost` · `totalCost` · `createdAt` · `lastSeen` · `events`

**Excluded on the owner's word (2026-10-18):** `tags` (Trace Tags), `countTraces`, `toolCalls`,
`calledToolNames`, `toolNames`, `metadata` — trace-tethered — and all score and comment fields
(*"We don't use scores … scores are trace related"*). Excluded fields are still checked against the
app's config, recorded with their reason, and refused by name if asked for.

## The manual controls leave the interface, not the application

Owner: *"remove it from the interface not remove it from the application."* The Columns picker, the
Filters sidebar and the sort dropdowns come out of the app's list pages (Phase 3b) — once the lane
renders results. The config, the facets and the operators **stay**, because they are the vocabulary
the catalogue is generated from.

## Milvus, in one line

A lane has **two passes**: the filter first (exact, deterministic, auditable), semantic recall
second (a ranked shortlist — *"the conversation where we argued about the gripper"*). Milvus is the
second pass and never a substitute for the first. It is wired in code and **cold**: `MILVUS_MODE =
"lite"` points at `./milvus.db`, and that file does not exist yet. Its `search()` currently swallows
failures into `[]` — that must be fixed before it is switched on. Full reasoning: §7b of the plan.
