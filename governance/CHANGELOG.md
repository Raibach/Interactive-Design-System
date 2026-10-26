# Governance room — changelog

Current as of **2026-10-18** (late). The folder was cleaned down to the Langfuse install on
2026-10-09 (owner); the earlier app history (Evidently / OpenMetadata era) is retired —
the Langfuse room **is** the governance room now. This record leads with today.

**Reading this next session:** the seat's anatomy — every rail tab, the file behind it, and the
behaviour each one owns — is in [`SEAT-MAP.md`](SEAT-MAP.md). Read that before touching a tab;
each one has its own personality and its own traps, and that document is the day it cost to
learn them.

---

## 2026-10-24 (later still) — the room owns its box, container and navigation

- `GovernanceBox` owns the wave (cover, centre, over #2b2635); `GovernanceRoomContainer` owns the
  layout, seat, evals seat, embedded application, trace selection and read, grip and assembly door;
  `useGovernanceTrace` owns the trace reads. The shell keeps the left nav and the box mount: the
  path goes up, one navigate ref goes down. The shell is 4,169 lines (4,615 at the start of the
  day; 4,555 after the surface door moved).
- Verified in 5001: wave/box/root; `governance-chat-panel` with no `chat-panel`; the layout closed
  at 650; the rail tabs; the trace views; the embedded app; a Sessions click in the left nav moved
  the frame to `/governance/project/<id>/sessions` and marked the Sessions button active; the box
  sits at z-index 40 beneath the nav at 50. `npm run typecheck` is zero.
- **Sessions leaves the left nav.** It is the chat panel's own tab; a second left-nav door loaded a
  second interface. The direction: navigation is customized per application, and as each tab is
  cleaned the chat panel absorbs most of its functionality.
- **The filter direction.** The chat is the primary filter; a saved conversation is the preset
  (ID, title, stored filter); the target is the application's full sessions filter vocabulary; the
  app's own Columns, Filters and sort controls leave the interface once the chat covers them.
  Exploration: `PLAN-chat-as-filter.md`.
- The telemetry application is untouched.

## 2026-10-24 (later) — the unwired surface door moves into the room

- `assembleGovernanceSurface`, `governanceTree` and the dead governance renderer effect left
  `pages/WritingAreaIndex.tsx` for `rooms/governance/useGovernanceSurface.ts`. The hook is the
  room's own door; it is not called, because the owner took our staged assembly off Governance on
  2026-10-22 and the application's own loader is the room's opening. If the ledger surface returns,
  the room wires this hook; the shell no longer carries it.
- The telemetry application did not move: it already lives in `governance/langfuse-main` and is
  framed by `GovernanceRoom`. The shell mounts the tab, not the monitor.
- The shell is 4,555 lines (was 4,615). `npm run typecheck` is zero.

## 2026-10-24 — the seat is the room's, the sessions path is live, the typecheck is clean

- **The Governance seat is its own element.** `frontend/src/rooms/governance/governance-chat-panel.ts`
  is a whole copy of the shared seat, retagged; the room mounts it and the shared `chat-panel` is no
  longer mounted in this room. This is the protection the room was missing: the sessions path had
  been stripped out of a shared seat by changes made for another room.
- **The room opens like the Console and at home.** Chat is the selected tab, the column is collapsed
  to its rail (the layout's `isThirdOpen = false` moved out of `WritingAreaIndex` into the room's own
  layout effect), and the embedded application is sent to its project home instead of restoring
  whatever page it last showed. Measured: seat tab `chat`, `collapsed` true, third pane 104px, frame
  path `/governance/project/<id>`.
- **Sessions is the evals seat's own tab.** The list draws inside the tab; the first row is selected
  by default with the purple rule; the selected row opens the real session in the middle. The list no
  longer mounts on the shared seat — that second feed loaded at room entry, picked its first row
  before any tab was clicked, and moved the middle off home.
- **Why the app's sessions table read "No results".** Its window is the last seven days measured on
  a session's CREATION, and every session was created before it. Proven against the app's own v4
  reader (`sessions.allFromEvents`): a seven-day cutoff returns 0, a thirty-day cutoff returns 23.
  `sessions.all` (the legacy reader) returns 0 unconditionally because its stores are empty.
- **The evaluators are running again, and the Evals tab draws them.** Langfuse's DeepSeek connection
  now holds the platform's key (decrypt-verified); both evaluators read Healthy; the index draws two
  rows. The `evalsTalk` binding is removed — it had the Evals tab draw an empty conversation instead
  of its index.
- **The receipt carries the session label again — only that.** `query_llm` attaches `trace_session`
  when a caller states it; nothing else returns (no prompt, answer, metadata, user or tags).
- **Typecheck is zero and the build passes.** `ArrivalKind` gained `evaluators`, `TabDef` gained
  `maskSrc`, the UX seat's cast goes through `unknown`, and the two governance boundary names were
  removed from the shell's call. `npm run build` runs end to end; the tunnel serves the new entry and
  room chunk with matching hashes.
- **Open:** the sessions lane (words → `/api/governance/sessions/query` → rows, no reply) and its
  replay are built in the backend but not wired to this seat; the department mapping does not exist.
  The room's own to-do list is `frontend/src/rooms/governance/TODO.md`.

## 2026-10-18 (last) — the lane is LIVE on raibach-cloud-3

Owner: *"let's get it committed to the remote server and make sure things are running properly."*
Two measured failures stood between the lane and the server; both are repaired, in code, not
worked around.

**Failure 1 — the image had no config.** `GET /api/governance/sessions/catalogue` on the server:
`FileNotFoundError: /app/governance/langfuse-main/web/src/features/filters/config/sessions-config.ts`.
The catalogue is generated from the Langfuse fork's own `sessions-config.ts`, and the fork is not
in the studio image (only `backend/`, `frontend/`, `config.py`, catalogs are copied). Repair:
- `backend/governance_lanes.py` resolves the config through `_sessions_config_candidates()` /
  `sessions_config_path()`: `LANGFUSE_FILTER_CONFIG` → `LANGFUSE_FILTER_DIR` →
  `<REPO_ROOT>/governance/langfuse-main/…/sessions-config.ts` → `<REPO_ROOT>/filter-config/sessions-config.ts`.
  When none exists it raises `LaneError` naming **every path it tried** — the error itself is the
  map, which is why the repair was mechanical.
- The repo keeps **one** copy: `filter-config/sessions-config.ts` is a symlink into the fork, so it
  cannot drift. `Dockerfile` copies it (`COPY filter-config ./filter-config`).

**Failure 2 — the container had no ClickHouse address.** Next call:
`URLError: <urlopen error [Errno 111] Connection refused>`. `governance_lanes` defaults to
`http://127.0.0.1:8123`; inside a container that is nothing. `studio.env` on the server carried no
`CLICKHOUSE_*` at all. Repair: four lines added to `/opt/raibach/ids/studio.env`
(`CLICKHOUSE_URL=http://clickhouse:8123`, `_DB=default`, `_USER=clickhouse`, `_PASSWORD=…` taken
from the compose `.env`), then `docker compose up -d studio` — a restart does not re-read env.

**Measured after the repairs (from outside the box, over HTTPS):**
```
GET  /api/governance/sessions/catalogue   → {"status":"ok", clock, 21 fields, 7 sorts}
POST /api/governance/sessions/query       → {"status":"ok","sort":"newest",
     "filter":[lastSeen >= 2026-10-17, lastSeen < 2026-10-18],"explain":"sessions with activity yesterday",
     "count":1, sessions:[…]}
```
All twelve services `Up` (clickhouse, minio, postgres, redis, studio-postgres healthy); disk 43%
used (83 G free — the 74 GB build-cache prune held).

`DEPLOY.md` was re-grounded on the same pass: the runbook still named the retired host
`2.28.109.69` and stack root `/opt/raibach`. It now names **raibach-cloud-3 / 188.245.25.26**,
stack root `/opt/raibach/ids`, compose project `ids`, Caddy as the public door (the `ids`
services publish **no** host ports), and carries §4a — the two build inputs that were missing.

---

## 2026-10-18 (final, later) — States and Repairs leave the governance rail

Owner, with a picture of the two rail buttons: *"remove these from the governance chat panel"*.

- `GOVERNANCE_SEAT_TABS` (`frontend/src/pages/WritingAreaIndex.tsx`) is now
  `'chat,sessions,tools,approvals,eval,settings'` — the two entries are gone.
- **The tab definitions themselves stay** in `chat-navigation-bar.ts`: Development still draws
  the console's rail and keeps both. This is one room's list, not the rail's vocabulary.
- No other wiring referenced them (searched the room's file: no `view-tab="states"`, no
  `activeTab = 'states'`), so nothing is stranded.

**Verified in the room:** `allowedTabs: "chat,sessions,tools,approvals,eval,settings"`, and the
rail draws **Chat · Sessions · Preview · Approve · Evals · Settings** — six buttons, no States, no
Repairs.

---

## 2026-10-18 (final, later) — the conversation selector: the flow is back, the dead click is gone

Owner's report: *"I had some trouble removing one and then when I finally got it removed now I can't.
It doesn't collapse and I can't select the existing the remaining conversation. It's almost as if
there is no conversation."* — and, on what he had liked: *"it would move back-and-forth between chat
and session. If I selected the most expensive session, it would automatically go to sessions and
load that."*

### What was actually wrong (measured in the room, not guessed)

1. **The seat adopted a query record as a chat.** After a removal cleared the binding,
   `_readPackageConversations` auto-selected `rows[0]` with **no tab**. `rows[0]` was the lane
   record, so the panel sat in a stored query while its tab still said **chat** — the thread drew
   the query line as if something had been said. Measured: `activeTab: "chat"`,
   `conversationId: d5dc5489…` whose row carries `tab: "sessions"`.
2. **That made the row a dead click.** `_onConversationSelect` returned early when the picked id
   equalled the current one, so the only visible conversation could not be selected at all.
3. **The row's tab was looked up in the wrong list.** `picked` searched only the surface array; a
   row that existed only in the package's server read resolved `tab` to undefined — which opens as
   a chat.
4. **A chat turn could be written into a query record**, adding prose to a conversation the lane
   owns.
5. **"Removed." never went away** — the note sat above a freshly opened list and read as a state
   of the list.

### Fixed

- Auto-load travels with the row's own tab: `_moveSeatTo(rows[0].id, { tab: rows[0].tab })`.
- Both lists are searched for the row's tab (surface array **and** the server read).
- A query record is a door **even when the seat is already in it**: re-selecting replays the
  recorded filter and moves to Sessions instead of returning silently.
- `_currentRowIsLane()` — a chat turn sent while bound to a query record releases the binding, so
  the turn starts a real conversation.
- The list note clears when the selector is opened or closed.

### Verified in the room

| Action | Result |
|---|---|
| click the lane record from the list | tab → **sessions**, 23 rows, *"most expensive sessions first · 23 sessions"* |
| Chat → re-select the same record | tab → **sessions**, 23 rows again (was a dead click) |
| select the chat record | tab → **chat**, bound to it |
| click the conversations bar | open `true` → `false`, list removed |

The collapse control itself was measured working (`_conversationsOpen: true → false`); what read as
"it doesn't collapse" was the dead row and the stale note above it.

---

## 2026-10-18 (final) — the record for the next phase

### One defect found while explaining the caveat

The owner asked what "the host replaces the list wholesale" actually meant, and checking it rather
than asserting it turned up a real gap: **the conversation list read did not return `tab`.**

- `conversation_api.get_conversations_by_session()` (package-scoped, the read a refresh uses) already
  selected `c.tab` — fine.
- `conversation_api.get_all_conversations()` (everything for the user) did **not**. A stored query
  would come back shorn of the one column that says it is a query, so selecting it would open as an
  empty chat instead of replaying its filter.
- **Fixed:** `tab` added to that SELECT.

**Verified against the local API after restart:** package-scoped → **4 rows**, three of them
`tab: sessions` (`d5dc5489…`, `d265036e…`, `37e260b2…`); unscoped → **24 rows**, **3** of them
`tab: sessions`. A record now survives either read with its identity intact.

Why it matters, in one line: the seat reads `tab` to decide where a selection lands, so a record
without it is a record that cannot say what it is.

### STATE TO START THE NEXT PHASE FROM

Everything below is running locally and was measured in the room at `http://localhost:5001`.
Read this section first next session.

#### What exists now

| Piece | Where | State |
|---|---|---|
| Lane catalogue, validation, executor | `backend/governance_lanes.py` | built |
| Catalogue on disk (inspectable) | `runtime/governance/filters/sessions.json` | written on every query + `GET /api/governance/sessions/catalogue` |
| Sessions query route | `POST /api/governance/sessions/query` | built, captures the record |
| Stored query read | `GET /api/governance/sessions/query/{conversation_id}` | built |
| Replay without the model | `POST /api/governance/sessions/query/replay` | built |
| Seat input branch | `chat-panel.ts` → `_send` → `_runSessionsLane` | built |
| Row + receipt drawing, Clear | `sessions-feed.ts` | built |
| Query records as conversations | `conversations` (`tab='sessions'`, `metadata.query`) | built |
| The app's own Sessions list | `users.v4_beta_enabled = true` for `admin@raibach.local` | flips the app to the events store |

#### What the contract is (do not re-invent it)

The model answers with **Langfuse's `FilterState`**: `{column, type, operator, value}` (plus `key`
for object kinds). It also returns `{sort, explain}` — or `{unexpressible: "<why>"}` when the request
cannot be expressed. Filters are validated against the catalogue, executed with `readonly=1`, and a
failure is always a sentence, never an empty list.

#### What remains, in the order the plan sets

| Phase | What | Note |
|---|---|---|
| **3b** | take the manual Columns/Filters/sort controls OUT of the app's interface | machinery stays — it is what the catalogue is generated from |
| **4** | fold `evals/query` into this contract; then tools, approvals, states, repair | one catalogue + executor per seat |
| **5** | the **conversations** lane (id, title, summary, tab, project, message count, dates, archived) | the owner named this lane |
| **6** | Milvus as the **second pass** only | it is cold today: `./milvus.db` does not exist, and `governance_vector.search()` swallows failures into `[]` — fix that first |
| **7** | the app's own filtered view in the middle pane (URL codec parity check) | optional |

#### Standing constraints carried into every phase

- **One chat.** The tab that says chat. Every other tab is a query lane; no prose reply, no turn.
- **Scores are out** (trace-tethered, unused here) and so is every trace-tethered field.
- **No silent emptiness.** A refused field, a failed read, an unexpressible request and a failed
  capture all reach the person as a sentence.
- **Local only, verified in the room at :5001** — never the raw port, never the live box.
- **The file is the authority.** The catalogue is generated from the app's own config and a drift
  check refuses to build when they disagree.

---

## 2026-10-18 (late) — the Sessions seat answers: type a query, get rows, go back to it later

**Phase 3 wired, verified in the room at :5001.**

- `_send()` branches on `activeTab === 'sessions'` **above** the tab flip, so a query typed on the
  Sessions tab can never be dragged into the chat and turned into a conversation turn.
- `_runSessionsLane()` posts to `/api/governance/sessions/query` with the seat's `session_id`,
  `project_id` and `X-User-ID` — without the session there is no seat to file the record under,
  which is why the first UI run produced no conversation and the receipt now says so.
- `sessions-feed` draws the receipt line and the returned rows, and its **Clear** returns to the
  unfiltered feed.
- A **failed capture is printed on the receipt line** (`NOT RECORDED — <reason>`), never swallowed.
- The new record is prepended to the seat's conversation list at once, so it can be selected
  immediately instead of waiting for a list refresh.
- Selecting a record with `tab: "sessions"` moves the panel to Sessions and **replays the recorded
  filter** — no model call, so an old query can never answer differently from when it was asked.

**Measured:**

| In the Sessions tab | Receipt | Rows |
|---|---|---|
| `show me yesterday's sessions` | *sessions with activity yesterday — lastSeen >= … · 4 sessions* | 4 |
| `the most expensive sessions first` | *most expensive sessions first · 23 sessions* | 23 |

and the round trip: Clear → lane empty; select record `d5dc5489-c201-459c-919e-377b0c5c0a8b` → panel
on Sessions, id bound, receipt and the **same 23 rows** restored from the record.

Three defects found and fixed while wiring it: the lane call carried no `session_id` (so the record
silently failed), the receipt carried no count, and `_moveSeatTo` mapped every non-approvals tab to
`chat`, which would have opened a query record as a thread.

---

## 2026-10-18 (late) — scores and trace-tethered fields OUT; every query captured as a conversation

### The vocabulary shrinks to what this deployment actually uses

Owner: *"We don't use scores so you're gonna have to go through the list and make sure that we're
not trying to query trace related stuff because we've removed trace stuff and scores are trace
related."*

**Offered to the model now (13):** `environment`, `id`, `userIds`, `sessionDuration`,
`inputTokens`, `outputTokens`, `totalTokens`, `inputCost`, `outputCost`, `totalCost`, plus the
three lane fields `createdAt`, `lastSeen`, `events`.

**Excluded, each with its reason in the catalogue (11):** `tags` (Trace Tags), `countTraces`,
`toolCalls`, `calledToolNames`, `toolNames`, `metadata` — trace-tethered — and `scores_avg`,
`score_categories`, `score_booleans`, `commentCount`, `commentContent`.

Excluded is not missing: the drift check still reads all 21 facets out of the app's config (so a
new facet still breaks the build), the excluded ones are recorded under `excluded` with their
reason, and asking for one is **refused by name**. The executor was pruned too — no dead branch
sits behind a field nobody can reach. **The scores join is cancelled**, not deferred.

Measured after the change: `sessions tagged chat` → *"'tags' is a real field of this app, but this
lane does not offer it — trace tags are written on trace rows"*; `sessions with a score below 0.5`
→ *"not a field of this lane"*. The three that should still work do: yesterday (4), most expensive
first (23, cost descending), more than 400 events (1, 628 events).

### Every query is now a conversation you can go back to

Owner: *"we need to make the conversations capture the query … I can go back as a user and select
that conversation in sessions, and it will reload my exact query."*

- A successful lane query writes one conversation: `tab = "sessions"`, title = the person's words,
  the validated query inside `metadata.query`, and one `user` message (the words, not a reply;
  `save_to_memory=False`).
- `GET /api/governance/sessions/query/{conversation_id}` — the stored query.
- `POST /api/governance/sessions/query/replay` — re-runs the **recorded** filter with no model
  call, so a reload cannot drift from what was asked.
- A failed capture is reported in the answer (`capture.captured=false` + reason), never swallowed.
- **Measured:** `show me yesterday's sessions` → conversation `37e260b2-43d7-450e-9499-f5556fb34064`;
  title and query read back exactly; replay returned the same 4 sessions with no model call.
- **Superseded the same day:** the note that stood here said the seat's input and renderer were
  still to wire (Phase 3). They were wired hours later — see the entry above, *"the Sessions seat
  answers"*.

---

## 2026-10-18 (night) — the Sessions lane is real: words in, rows out

**BUILT.** `backend/governance_lanes.py` (the catalogue + validator + executor) and
`POST /api/governance/sessions/query` in `backend/routes/governance.py`. `query_llm`'s strict-JSON
modes now include `sessions_query`. `GET /api/governance/sessions/catalogue` exposes the catalogue
for inspection; it is also written to `runtime/governance/filters/sessions.json`.

**THE MODEL SPEAKS LANGFUSE'S FILTER.** The answer is the app's own `FilterState` array
(`{"column", "type", "operator", "value"}`), validated field by field against a catalogue built
from `sessions-config.ts` — including a **drift check** that parses the app's config and refuses to
build when the two disagree. It earned its keep on the first run: the app declares `metadata` as a
separately-named facet, the first parser missed it, and the check stopped the build rather than
quietly shipping a catalogue without it. **21 facets now match.**

**MEASURED, five instructions:**

| Said | Result |
|---|---|
| show me yesterday's sessions | 4 sessions (bound to `lastSeen`, not `createdAt`) |
| the most expensive sessions first | 23 sessions, cost descending |
| sessions with more than 400 events | 1 session, 628 events |
| sessions with a score below 0.5 | **refused**, in words: the scores table is not joined yet |
| sessions from the langfuse-llm-as-a-judge environment | a real 0 |

**TWO WRONG ANSWERS CAUGHT AND FIXED, both recorded because they are the interesting part:**

1. "yesterday" first bound to `createdAt` and answered **0** — truthful, and about the wrong column:
   the newest session STARTED on the 16th and ran into the 17th. `lastSeen` now exists, and the
   prompt says which field carries which meaning.
2. "more than 400 events" first bound to `countTraces` — a clean zero about traces. The `events`
   field now exists and is labelled a lane extension, because the app's list has no event count.

**AND A THIRD, WHICH CHANGED THE CONTRACT.** Asked for something it cannot express (the score
filter), the model said so honestly — and the route handed back **all 23 sessions**, which reads as
an answer. The contract now has `{"unexpressible": "<why>"}` for exactly that case, and the route
returns it as a refusal. An unfiltered list is never the answer to a question it could not answer.

**Also recorded in the plan:** the manual Columns/Filters/sort controls come **out of the app's
interface** (not out of the application — they are the vocabulary this lane is built from), as
Phase 3b; the ClickHouse/own-tracking question is a *store* decision that the lane's contract is
deliberately independent of; and the PostHog work planned for the Design seat (`posthog-master`,
854 MB, read-only here) gets its own catalogue and its own lane, with "who is the user" named as
the decision it will force.

---

## 2026-10-18 (later) — the query lanes become the official plan

The owner's law, verbatim: *"there's only one chat interface inside of governance that is the one
that says chat on the tab. The rest of them are model based queries for sorting filtering, checking
everything that the langfuse filtering system provides"*. And the definition that fixes the
vocabulary of this folder: *"when I say seats I mean, the individual tabs will have their own
criteria for searching that particular tab's data."* **Seat = tab.**

**Written down, in this folder:** `QUERY-LANES.md` (the spine) and `QUERY-LANES-PLAN.md` (the full
plan — contract, executor, per-lane sorts, phases 0–7 with acceptance tests, risks, and the Milvus
decision). `README_GOVERNANCE.md` now indexes both; `SEAT-MAP.md` carries the law under its
corrected state block.

**What the research established, measured rather than assumed:**

- Langfuse's filter is a JSON array (`packages/shared/src/interfaces/filters.ts`, twelve filter
  types with per-type operators). The model's output will be **that array**, not a dialect of ours.
- The vocabulary's single source of truth is the app's own config: `sessions-config.ts` (17 base
  facets + 4 events-only), `sessionsView.ts` (`sessionsViewCols` 20, `sessionsEventsViewCols` 24),
  and `filter-transform.ts` (`{ tags: "traceTags" }`). One generator covers every `*Config`.
- **We cannot call the app's own filter engine:** its tRPC procedures need a NextAuth session, and
  `/api/public/sessions` has **no `filter` parameter**, reads Prisma, and is deprecated with a
  sunset of 2026-11-16. So: Langfuse's vocabulary, our executor, over `events_core` — the same
  table the app's v4 path reads.
- **The app's Sessions list is pointed at an empty store.** `users.v4_beta_enabled = false` sends
  `useReadPath()` to `"v3"`, and the legacy stores are empty (`traces` 0, `observations` 0,
  `trace_sessions` 0) while `events_core` holds 1,404 rows across 23 sessions. Phase 0 is one
  statement — `UPDATE users SET v4_beta_enabled = true WHERE email = 'admin@raibach.local';` —
  **shown, not run**, waiting on the owner's word.
- **Milvus is coded and cold.** `pymilvus` 3.0.2 is installed and `milvus_client.py` (348 lines),
  `governance_vector.py` (137), `conversation_api.py` and `governance_inspector.py` all reference
  it — but `MILVUS_MODE = "lite"` points at `./milvus.db` and **that file does not exist**, so
  nothing has ever been written. Worse, `governance_vector.search()` and `count()` swallow every
  exception into `[]` / `0` — a silent empty result standing in for a failure, which is exactly
  what the lanes forbid. Decision recorded: Milvus is the **second pass** of a lane, never a
  substitute for a filter, and the conversation lane is its first consumer.

**One lane the plan gained on the owner's word:** conversations. The chat's own history gets the
same treatment as sessions — criteria over the studio's `conversations` table (id, title, summary,
`tab`, project, message count, created/updated, archived), with the semantic second pass ("the
conversation where we discussed the gripper") as the Milvus consumer.

---

## 2026-10-18 — the left navigation, corrected twice in one day

**Nine sections were taken out of both navigations, then five were named back by the owner:**
*"sessions, propmts, database, users, playground need to come back on the left nav."* The lesson
to carry: the two lists must be edited together, and a removal is only finished when the owner
says which ones he means.

**What the navigation reads now, in both places** (`governance/langfuse-main/web/src/components/layouts/routes.tsx`
for the embedded app, `frontend/src/components/navigation/GovernanceNav.tsx` for the studio rail):

| Group | Sections |
|---|---|
| — | Home, Settings |
| Observability | Sessions, Users |
| Prompt Management | Prompts, Playground |
| Evaluation | Evaluators, Datasets |

**Still out:** Alerts, Scores, Human Annotation, Experiments — and the feature-flagged Skills and
Topics, which were never on in this deployment. Traces stays out of the rail (owner, 2026-10-14)
but the route itself is untouched.

**Each rail entry keeps the app's own verb for its address** — `/sessions`, `/users`, `/prompts`,
`/playground`, `/evals`, `/datasets`, `/settings` — and `GovernanceNav`'s `suffixForSeg` maps the
detail routes (`/sessions/<id>`, `/prompts/<name>`, `/datasets/<id>`) back to their parent so the
rail stays lit while you are inside a detail page.

**One vendor banner removed from the app's own surface:** `AgentToolsBanner` ("Langfuse works
great with your AI coding agents…") was rendered on the Organizations page with a link to
langfuse.com. Component and its export deleted; the branch in `ProjectOverview.tsx` that rendered
it is gone, so nothing takes its place.

**Verified in the room at :5001:** the rail draws Home · Sessions · Users · Prompts · Playground ·
Evaluators · Datasets · Settings; the image was rebuilt (`langfuse-web:gov-embed`) and
`http://localhost:3100/governance` answers 200.

---

## 2026-10-17 (night) — Sessions replaces Trace in the rail; the seat's two long-standing jolts fixed

Everything below was verified in the room at :5001, local only.

**SESSIONS IS THE SECOND RAIL BUTTON.** The Trace button's seat now holds Sessions in this room
(the console keeps its own rail). New element `frontend/src/components/lit/sessions-feed.ts`,
registered in `frontend/src/shared/tag-registry.ts`, drawn by `chat-panel.ts` and
`evals-chat-panel.ts` under `tab-sessions`.

- **It reads its own feed:** `GET /api/governance/sessions?days=30` (new,
  `backend/routes/governance.py`) groups `events_core` by `session_id` and returns
  `{session, events, traces, firstSeen, lastSeen, users, cost}`. A real read failure comes back
  as `{status:"error", error}` — never an empty list.
- **A card is a door:** a press raises `session-select`; `WritingAreaIndex.tsx` turns it into the
  app's own address `/project/<id>/sessions/<session>` and the middle loads the REAL session.
  Nothing else moves — no tab change, no pane shown or hidden.
- **First session is the default** on tab open, and the selected card carries the purple
  `#8b5cf6` edge (teal on hover).
- **NO TOTALS LINE** above the list (owner: *"Nobody needs to count the number of sessions …
  Remove it."*) — it was drawn, then deleted along with the three aggregates that fed it.

**A STYLING FAULT, AND ITS CAUSE.** The cards rendered as browser-default `<button>`s — grey
plate, `2px outset` frame, Arial — which reads as black boxes in the dark panel. Measured, not
guessed: the element's own adopted stylesheet had **0 rules**. Two faults in the CSS block, both
mine: a single-backslash escape (`\00b7`) in a tagged template makes the cooked string
undefined, and a comment inside that block contained backtick characters, which closed the
template early. Either empties the whole sheet. Fixed; measured after: background
`rgba(0,0,0,0.12)`, border `1px solid`, radius `6px`, Inter 14px, selected edge `rgb(139,92,246)`.

**THE TRACE FURNITURE CAME OUT OF THE SESSION PAGE** (`governance/langfuse-main/web/src/`):
`SessionPages.tsx` lost the "Total traces" badge, the user chips and both action-button
clusters; `SessionReviewWorkspace.tsx` lost the review panel (its removal also fixed
`Invalid 1 panel layout: 100%, 0%`); `TraceEventsRow.tsx` no longer draws the trace panel. The
dashboards' nine TRACES widget rows were deleted in the governance Postgres (`dashboard_widgets`
+ the `dashboards` definition), leaving Home at six cards.

**THE GRIPPER — measured cause, real fix** (`workspace-layout.ts`). The 30px strip lives
**inside** the column it sizes, but the press sized her from the pointer's **absolute** X, so a
grip at the strip's far side made her 0–30px narrower the instant you pressed and the strip left
the cursor. The release test then closed her on a *click* with no movement at all. Now the press
records the pointer's offset from her measured edge and changes nothing; every move applies it;
the floor test requires the hand to have travelled. Verified: press `1002.5 → 1002.5`, click
`→ 1002.5` still open, drag left `+66.5` (ceiling clamp), drag back restores.

**SHE SPEAKS ONCE PER CONVERSATION** (`chat-panel.ts`, `evals-chat-panel.ts`). The arrival offer
had no once-per-conversation mark, so every rail tap wrote another introduction into the same
thread — ten in the Design conversation. It now uses the same rule and store as the Evals
section (`shared/sectionTeaching`, keyed by conversation id), plus the blank-composer hello.
Verified: Design → Governance → Design added **0 characters**, same conversation `16d9846e…`.
A new (or deleted) conversation has not been taught, so it speaks again.

**HARDENING PASS ON THE SAME CODE.** `sessions-feed` no longer reads its body with
`res.json().catch(() => null)` — a non-JSON or list-less answer used to fall through to "no
sessions recorded", i.e. a failed read wearing the empty state's clothes. The body is parsed
once, a missing `sessions` array throws with the status and the body's first 160 characters, and
per-row counts render as `—` rather than being coercing to a zero nobody measured.

**DOCTRINE (repo root, committed):** `SECURITY-AND-COMPLIANCE.md` (the loop is the AI; humans
are contributors at checkpoints; the gate may check, refuse, route and escalate but never sign
its own assembly) and `USER-FLOW.md` (the mechanical breakdown of the same journey, and what the
customer's interaction makes measurable).

**2026-10-18 (small hours) — the bill for that bug, paid.** The Design conversation `16d9846e…`
held **39 rows and not one of them was a person's** — the pre-fix arrival machinery had written
an introduction per open, 2026-10-05 → 2026-10-16. Deleted 38, kept the newest; verified `39 → 1`.

**2026-10-18 — THE APPLICATION LEFT THE ROOM.** Owner: *"take out Langfuse or anything that says
Langfuse in this application I want it removed and that includes the spinner … that space will be
used for UX design. We're gonna add quantitative metrics in there … and notifications we're gonna
put a notifications block there."*

- **The frame is unmounted**, not hidden: the `<builder-embed>` that carried `/governance/…` is
gone from `WritingAreaIndex.tsx`, and the staged-opening overlay (wave cover, gold ring,
"Standing up the governance workspace…") is **deleted** — it only ever covered the wait for that
frame.
- **The app's section navigation is no longer drawn.** The room's left column was the Langfuse
  section list (Home, Sessions, Users, Alerts, Prompts, Playground, Scores, Evaluators, Human
  Annotation, Datasets, Experiments, Settings) and every item addressed the frame. A column of
  dead links is not shipped; the room keeps the shell rail, its ground and its chat seat.
- **The stack is stopped** (`docker compose stop` in this folder; `up -d` returns it, volumes
  intact). `docker stats` is empty afterwards — the room had no dependency left on it.

**Verified in the room, 2026-10-18:** `iframes: 0`, `builder-embed: 0`, no spinner text, **zero
occurrences of "Langfuse" in the visible document** (measured across every frame; the only frame
left is the app itself), no error boundary, seat rail intact (Chat / Sessions / Preview / Approve /
Evals / States / Repairs / Settings).

**What this costs, stated plainly:** the controls that *addressed* the app now address nothing.
Session cards still mark and still compute `/project/<id>/sessions/<session>`; there is no frame
to load it into. The Evals button still announces its teaching once per conversation; it no
longer navigates. `navigateGovernanceTool` returns early when there is no frame — no crash, no
pretence. The middle is reserved for the owner's own quantitative-metrics and notifications
blocks.

**2026-10-18 — THE TRACES WENT TOO.** Owner: *"we don't need anything related to traces anymore
so if a score in this system is only related to a trace it doesn't need to be offered as an
option on the dashboard"* — and, of the dashboard's own features, *"I don't understand the
dashboard features, they don't look useful"*.

- **Trace is out of the drawable rail list** (`chat-navigation-bar.ts`) and out of the
  **Development** and **Product** seat lists. Verified after: Governance rail = Chat / Sessions /
  Approve / Evals / States / Repairs (+ Settings); Development = Chat / Tools / Approve / Evals /
  States / Repairs; Product = Chat / Tools / Approve / Evals. **No room draws Trace.**
- **Preview (`tools`) is out of this room's list** — it was the trace detail's own door, and it
  was already dark without a trace selection.
- **The room's landing read was stopped.** It asked the stopped app for `events.all` on every
  entry, so each open produced two 500s and a logged failure that described nothing real. The
  call is removed and the reason is written where it stood.
- **The dashboard, its comments, its annotations and its manual scores left with the app.** They
  are all tethered to trace objects; nothing in our own product offers them.

**Still on disk, inert, scheduled for the same removal:** `trace-tree.ts`, `trace-detail.ts`,
`trace-context-header.ts`, `lib/governance-trace-source.ts`, the `TraceExperience` page and its
route, the room's trace effect (header/tree/detail elements and row-click listeners), and the
`trace-*` entries in `tag-registry.ts` and the A2UI catalogues. Unreachable — no rail tab can
select them — but not deleted. That pass needs a build and must remove the room's trace effect
in the same change.

**2026-10-18 — WHY EVERY CHAT TURN WAS 500.** Owner: *"governance is not loading … it doesn't
load at all."* The room was drawing; the SEAT was dying. `backend/grace_gui.py` had
`trace_session: str | None = None,` sitting at the END OF A COMMENT LINE, so `query_llm()`'s
signature no longer accepted it — and both callers pass it (`routes/teacher.py:536`,
`routes/prompt_sessions.py:789`). Result: `TypeError: query_llm() got an unexpected keyword
argument 'trace_session'` on **every chat turn in every room**, answered as a 500. Fixed by
putting the parameter back on its own line. Verified: `query_llm(...)` answers, and in the room a
first turn (`ping`) was answered in 3s (`Pong — I'm here in the Governance room…`).

**THE BACKEND'S LANGFUSE CLIENT — REMOVED, THEN RESTORED (keep this honest).** During the
misreading it was stripped from `grace_gui.py` (client, receipt, OTel span export). It is back:
the owner's order was about the WORD, and the receipt is what feeds this app's cost rows. What
stayed fixed is the real bug found in the same pass — `trace_session` had been swallowed into a
comment, so `query_llm()` rejected it and every chat turn in every room answered 500. That
parameter is a real parameter again, and the room answers (verified: `ping` → a reply in 3s).

**2026-10-18 — THE BRAND IS RAIBACHIDS, AND THE NAVIGATION IS TRIMMED.** The owner's correction:
*"if you think tearing out the dashboard was what I meant when I said remove the words that said
langfuse you got me wrong … I meant the word."* The application stays; the vendor's name does not.

- **Brand, in code:** the sidebar and mobile wordmarks are gone — the **R** mark
  (`/raibach-mark.png`, the studio's own) plus **RaibachIDS** stand in their place. The mark
  component points at the R. Page titles, `og:site_name`, the trace breadcrumb and the sign-in
  copy all read RaibachIDS. Browser tab and touch icon point at the R.
- **The spinner is the house's** — the 26px gold ring, not a logo (owner: *"We already have a
  spinner why would we not use our own spinner the same one we use everywhere"*).
- **Brand, in data:** six dashboards renamed (`Langfuse Home (Clone)` → `RaibachIDS Home`, and
  the five vendor ones → Raibach …). Shown as SQL before it ran, one transaction, verified.
- **Navigation trimmed in BOTH places it is drawn:** the app's `routes.tsx` and the studio's
  `GovernanceNav.tsx`. Users, Alerts, Prompts, Playground, Scores, Human Annotation, Datasets,
  Experiments and Sessions are gone from both; unused imports and icon components removed with
  them. What is left: **Home · Evaluators · Settings**.
- **Verified in the room:** `"langfuse"` = **0** in the shell and in the app frame; title
  `Home | RaibachIDS`; dashboard switcher `RaibachIDS Home`; rail intact.
- **ClickHouse stays.** Measured: it is the store behind the dashboard widgets, the traces page,
  the evaluator score history, and our own sessions/cost/failures reads. ~4 MB of data in a
  container costing ~480 MiB — the trade only becomes possible when the dashboard reads a store
  we own. Details in `REMOVAL-PLAN.md` § E.

---

## 2026-10-13 (night, later) — the trace seat's full face, and ELEMENT TRACKING opens (the next focus)

**The seat (the room's chat column) — every item below verified in-room at :5001, local only:**

- **Selected-row highlight** in the trace table (house patch `data-table.tsx`: the app's own
  `--primary-accent` tint + 3px inset bar; the fork's old colour was measured invisible on
  the dark table).
- **The fly-out KILLED at the source** (`peek.tsx`: the pane's early return gated by the
  governance door) — the row click still writes the selection channel; nothing else changed.
- **Week default** (`date-range-utils.ts`): the dashboard opened on a useless single day —
  "Nobody needs to see dailies" — now `last7Days`.
- **The default chain + cold landing**: clicking Trace with nothing selected loads the **latest**
  trace — by the row's own shown time, never by position (*"you can't just pick an arbitrary
  line in the table and call it default — default has to be the latest one … or else it'll
  eventually get pushed way down"*, owner, same night) — selects and highlights it in the
  table, and opens her with it — the interface teaching by its defaults.
- **Preview gated**: the fourth rail tab deactivates until a trace selection stands.
- **Her column is an OVERLAY** over the app in this room; the app's own containers stepped
  in **90px** right margin with the chat flush right; the grip glyph tucked clear of the
  app's scrollbar. **No drag clamps, ever** (one shipped and was revoked the same evening —
  *"Your clamps are not allowed."*).
- **The facts strip lives IN the seat's readout bar** (the "Analyzing: Session 222…" block):
  id + Download/⋮ on the first line, name/metrics/session/user below, the box grows to hold
  it, the built-in sample line steps aside. The five-dot column-gripper built under it was a
  misunderstanding and is deleted — the bar's own meatballs stand as the future header
  expander (later, on his word).
- **The conversations bar no longer draws on the Trace/Preview tabs** — conversations live in
  the chat; a tab showing a host view shows the view, nothing appended.
- **POP-OUT AT 650**: row clicks bring her out through her own door (`openChat()` — the
  operator-close guard no longer swallows the person's own click); 650 is the room's declared
  standing width for every opener; a hand's drag still wins.
- **THE ASK PIVOTS THE ROOM**: "I want to look at trace" typed to Grace → her reply lands →
  the seat flips to Trace, the app goes to its list, the first trace defaults if none stands.
  (The seat's `a2ui:person-turn` now carries the turn's words; the room answers the ask —
  never fabricated into her reply.)
- Found by the room's own logs and fixed: the Composer-link probe's doubled path
  (`/api/api/…` → 404) corrected.
- **THE GRAPH DRAWS** (owner: *"the graph is not loading … you'll need to fix the graph —
  Langfuse was displaying that graph."*): two measured defects, both fixed in `trace-tree.ts`
  — (1) the nodes/edges were Lit child templates inside `<svg>`, and every child template
  parses in the HTML namespace, so the renderer saw `HTMLUnknownElement`s and painted nothing
  (DOM full, canvas empty — measured live); the svg markup is now ONE string inserted with the
  `unsafeSVG` directive (parsed in svg context — real `SVGGElement`/`SVGPathElement`s that
  paint); (2) a captured pointer retargets the derived click to the capture element, so a
  delegated node `@click` can never fire — the release is now hit-tested (`elementFromPoint`
  → nearest `g.g-node` → its `data-oid`). Verified in-room: nodes+edges paint, node click
  moves the selection (the detail follows), drag pans without selecting, zoom / Fit act.

**ELEMENT TRACKING — the next focus opens** (owner, same night: *"we're gonna be tagging our
Figma elements whenever we put them into the system and this governance layer is gonna be
tracking them … tracking elements in the system needs to be our next focus so that we're not
just tracking assembly and chats."*):

- **`governance/ELEMENT-TRACKING-PLAN.md` written** — the ground is VERIFIED in it: element
  identity = the catalogue tag + its `prompt_sessions` row; the four record tables exist
  (trail / annotations / versions / metrics — the doctrine is in their DDL); the ingest
  already tags (68 events already copied into trails); catalogue-sync writes trails;
  `governance_items` already joins on the component tag. MISSING: runtime writers and any
  trail-reading view.
- **The tool decision, recorded in the plan:** the record of truth stays OURS (the
  portability thesis — elements must be able to leave the cloud); Langfuse is the MODEL lens
  only (build traces carrying element tags → "what the model did with this element");
  PostHog DEFERRED, never the record.
- **The end-user layer recorded** (owner, same night): *"This application is gonna serve a
  front end … those tags will be actively engaged with by users on the front end … but we
  should capture that inside of our application."* — now in the plan as **M4 (the front-end
  door)**: one capture endpoint OF OURS for front-end engagement with tagged components,
  aggregated into `design_element_metrics`; the element view later shows the counts. The
  same tags serve the tagged-analytics direction, collected in our application — no
  third-party pixel.
- **The wiring plan for the next chat: `governance/NEXT-SESSION-PROMPT.md`** (M1 read API →
  M2 writers widen → M3 the governance room's element view → M4/M5 gated).

---

## 2026-10-13 (night) — ONE copy of the application, the twin removed (owner-ordered)

- **Order, verbatim:** *"I want to know how many versions of that application are in
  this repository and I want all extra versions or twins as you call them out."* — the
  owner found the extra tree while reading the row-highlight work and was rightly
  furious that TWO copies existed.
- **Removed:** `wireframe-lab/langfuse-gov-embed/` — 6736 tracked files, deleted from
  the working tree and from git tracking the same night; its untracked leftovers
  (node_modules and build debris) removed wholesale. Verified by searching every
  `package.json` in the repository: exactly ONE tree names the application —
  `governance/langfuse-main` (untracked by design, `.gitignore` line 126).
- **The record that pointed at it is corrected** (README_GOVERNANCE's twin lines) and
  any future box/hosted rebuild sources from the one tree.

---

## 2026-10-09 (night) — the room goes HOSTED (owner-ordered)

- **Order:** the hosting decision reversed ("You were in the process of doing that") —
  the stack stands on Northflank (project `semantic-design-system`), and the room
  serves **our own build**.
- **Our build, not stock:** `langfuse-web-gov` builds from this repo (branch
  `gov-embed-2026-10-09`, `wireframe-lab/langfuse-gov-embed/`): sidebar removed at the
  source, cost precision, settings fix. First cloud build FAILED LOUD — the repo's own
  `.gitignore` (`models/`, line 116) had swallowed 58 source files → module-not-found;
  force-added (`git add -f`), pushed (`5de5dee8`), rebuilt — SUCCESS.
- **No fallbacks:** the stock `langfuse-web` service was DELETED; the vendor-image
  worker was replaced by `langfuse-worker-gov` (built from the same repo tree) and the
  old one DELETED. Telemetry OFF; audit: no vendor hosts; nothing touches their
  servers. The frame proxy's upstream rides service env (the platform does not rename
  services — the address moved by value, not name).
- **Data:** the hosted studio's tap wired (`LANGFUSE_BASE_URL=http://langfuse-web-gov:3000`
  + hosted keys); the hosted room reads its OWN store — first traces (`query_llm.*`)
  and micro-dollar costs verified in-room; the local history stays in the local store
  (no migration performed).
- **Repo record:** `wireframe-lab/langfuse-gov-embed/DEPLOY.md` = the blank-slate
  recipe; branch commits: `e6a6afa` (source), `5de5dee8` (models restore), `778b5bf6`
  (proxy upstream as a service value), `0d77cf00` (DEPLOY.md).

---

## 2026-10-09 — the room gets wired, priced, patched, and shipped

### Wire 1 — TRACES (live)
- `langfuse` SDK **4.17.0** installed (uv-managed venv; `backend/requirements.txt`);
  `LANGFUSE_*` block in `backend/.env` (key from `Keys/langfuse-governance-api-key.txt`).
- The single seam: `backend/grace_gui.py → query_llm()`. Every mode traced
  (`query_llm.<mode>`); user = studio identity `00000000-…-0001`; session = the prompt
  package on runs. One client, one generation — no second logger.
- First traces verified in-room; "Waiting for first trace" retired.
- Lessons: worker dead-socket stall after ClickHouse restarts (restart the worker);
  v4 event store = `events_core` / `events_full`.

### F1a / F1b — the in-embed settings-subnav 404 (fixed, verified with the old trigger)
- F1a: `builder-embed` honors `no-embedded-params`; the governance embed loads clean
  (builders keep their params byte-for-byte). `frontend/src/components/lit/builder-embed.ts`.
- F1b: vendor `PagedSettingsContainer.onChange` split `asPath` on `/` while the path
  carried `?embedded=…` — fixed with `split(/[?#]/)[0]` (house comment; image rebuilt);
  verified in-room: `/settings` + query → click API Keys → lands `/settings/api-keys`.

### Wire 2 — SCORES (live)
- A run's judge verdict posts as Langfuse score **`judge`** — CATEGORICAL, value = the
  verdict word exactly, comment = the judge's sentence — onto **the run's own trace**.
- How: the teacher RUN passes `trace_session=request.session_id`; `query_llm` **makes**
  the trace id (`create_trace_id()`) and **pins** the call onto it
  (`start_as_current_observation(trace_context=…)`) — a read-back of
  `get_current_trace_id()` returns None (the generation span has already ended);
  the id lands in the in-process ledger `LAST_RUN_TRACE`; the evaluate endpoint posts
  `create_score(trace_id=…)` (session-level fallback when no run is on record — the
  chosen target is always printed; a score failure never fails the evaluation).
- Root-span io filled with `update_current_span` (`set_current_trace_io` writes nothing
  the preview reads — measured).
- Receipts: trace `49a18d39…` carries `judge: cleared` + the judge's sentence
  (comment popover, screenshots on record).

### Costs — the room calculates, then carries OUR arithmetic
- Prices stated through the room's own Settings → Models from **the owner's price sheet
  (2026-10-03, `_DEEPSEEK_PRICING`)** — no invented numbers:
  `deepseek-flash` in $0.15 / cached $0.003 / out $0.60 per 1M; `deepseek-v4-pro`
  in $0.66 / cached $0.022 / out $1.98 per 1M (off-peak side; start 2010-01-01).
- Langfuse facts verified in its source: prices stored per single token; ingestion
  **subtracts cached from input** (cached pricing is exact, never double-billed); cost
  enrichment runs in the worker **at ingestion** — new traffic prices, old traces keep
  their honest empty cost (no retro numbers).
- Run five receipt: `{input:23, output:3}` → `total: 0.00000525` — exactly the sheet math.
- **Exact-cost upgrade (owner-ordered):** the studio now owns the generation
  (`completion` under the pinned root span) and sends its own `cost_details` — same
  estimator as the ledger (peak/off-peak window + measured cache split) plus
  `metadata.cost_basis`. Langfuse uses provided cost verbatim — proven A/B: a probe
  with `DEEPSEEK_PRICING=peak` stored `366 × $0.30/1M = $0.0001098` (peak), not the
  `$0.0000549` the static off-peak definition can compute. Run six: `total 5.25e-6`,
  basis "DeepSeek off-peak rates, measured cache split".

### Display precision (house patches; image rebuilt twice; verified in-room)
- `web/src/utils/numbers.ts` — `costFormatter` (2,2) → (2,6): the dashboard Model
  costs table went from `$0.00` to the true total (`$0.000246` with the day's traffic).
- `ObservationMetadataBadgesTooltip.tsx` — `formatMetricCost` (2,3) → (2,6): the trace
  header chip reads `$0.000005` like the tree row.
- `numbers.clienttest.ts` updated WITH the patch (revert together).

### Verification-surface law
- v4 **events_only mode**: the legacy public API is 404 by design — verify in the room
  or ClickHouse. Smoke artifacts stay (owner: demo data).

### Ship (owner-ordered: "let's ship this whole thing")
- Studio-side changes committed and pushed: branch `pre-removal-build` + fast-forward
  to `origin/main` → Northflank production build. The governance folder itself stays
  local (gitignored).

### The Langfuse-hosting decision + the Northflank audit (2026-10-09, evening)
- **No hosting relationship (owner's decision).** Owner reviewed the self-hosting docs
  himself: they confirm the stack Langfuse requires (web + worker + Postgres +
  ClickHouse + Redis + blob storage). His call, verbatim: *"I don't want any
  relationship whatsoever for this company… the option for clients to wire up an API
  from Langfuse or OpenHands or any of them is always there. This is a demo."* — none
  of it gets deployed; the room stays local-first; the address-driven architecture
  (`GOVERNANCE_TOOL_URL` / `LANGFUSE_*`) is what lets a client wire their own instance
  later with no code changes. Production's Governance room intentionally shows
  "not connected" (the `appConfig` loopback law).
- **Northflank audit (CLI, read-only; project `semantic-design-system`, nf-europe-west):**
  - studio `semantic-design-systems` (nf-compute-20 = 0.2 vCPU/512 MB ≈ $5.40/mo) —
    **deployedSHA `4f95b45` = the ship is LIVE**;
  - `builder-engine` (nf-compute-50) and `dev-workspace` (nf-compute-100-2) — also on
    `4f95b45`;
  - `builder` (nf-compute-100-1) — running its **Oct 7 image `85efcd1`**; its last TWO
    builds failed (Oct 8 `8a464dd`, Oct 9 `4f95b45`);
  - addon: Postgres `SDSManager` (running, 6 GB disk); volume: `builder-engine-store`
    (6 GB nvme); jobs: none; pipelines: none; **LLM model deployments: none — no
    leftover "tensor" resource**; nothing stray; **no extra space needed**.
- **Builder build failure — ROOT CAUSE + FIXED (2026-10-09, evening):** `npm run
  build` → "Failed to collect page data" ← "VCAAS_BASE_URL is not set". The Next build
  evaluates the routes at BUILD time; the env existed only at runtime. Fix executed:
  (1) the value set as a **build argument** on the `builder` service
  (`http://builder-engine:4000/api/v1/vcaas` — the hosted engine's address, never
  localhost); (2) the first test build (triggered via the API,
  `POST …/services/builder/build {"buildSource":"latest"}`) proved Northflank passes
  build arguments as **Docker build args** — the Dockerfile never declared `ARG`, so
  Docker dropped the value → a two-line, **value-free wire** (`ARG VCAAS_BASE_URL` +
  `ENV VCAAS_BASE_URL=${VCAAS_BASE_URL}`) added to the builder Dockerfile with the
  note inline; committed `0bb7921`, pushed; (3) CI build `dazzling-glass-6079`
  **SUCCESS** → deployed `0bb7921`; the hosted `/api/config` — the exact route that
  killed the build — answers `{"ok":true,"data":{"configured":true}}` **HTTP 200**.
  Fleet: studio / builder-engine / builder on `0bb7921`; `dev-workspace`'s heavy image
  building at write time (content identical between the two SHAs).
- **THE CONFIG RULE (owner, 2026-10-09: *"we're gonna have to make a note that we need
  to switch it over when we commit files"*)** — recorded at
  `wireframe-lab/HOST-THE-TOOLS.md` → "THE CONFIG RULE": values live on the services
  (env + build arguments), never in committed files; a table of where every value
  actually lives (VCAAS_BASE_URL, the tool URLs, keys, LANGFUSE_*); the VCAAS case as
  the pattern; and the before-every-push checklist.

---

## 2026-10-08 — the room becomes Langfuse (condensed)
- The governance room was settled as **self-hosted Langfuse OSS v4.55.0**
  (`governance/langfuse-main/`, docker compose + nginx **frame proxy :3100**).
- House-ground styling via the frame proxy (token re-hue; transparency; the room's
  wave background lives in the shell). An in-iframe `color-scheme: dark` mount flag is
  load-bearing (keep it).
- Sign-in removed permanently (seed env + injected session cookie; boot-hold).
- Navigation: Langfuse's own collapsible sidebar first (commit `6a5af64`), then the
  shell-level **GovernanceNav** with deep-linking (commits `1c8713d`, `c4dffe6`).
- Project API key **`raibach-ids`** created via the room; secret saved once
  (`Keys/langfuse-governance-api-key.txt`); verified 200 / 401.
- Server telemetry OFF (compose `.env`, web + worker).

---

## 2026-10-11 — the sign-in regression, fixed in the frame proxy (condensed)
- A regression of our own: the `/governance/api/auth/` pass-through (added so a session could
  be minted for the demo) had disabled the proxy's session-cookie injection — Langfuse's
  client-side session check received `{}` and showed the stock vendor sign-in screen. The owner
  saw it and said it flat: *"There shouldn't be a login it's it's a demo site."*
- Fix (deployed, verified): the proxy now sends a COMBINED cookie header in BOTH locations
  (`/governance/api/auth/` and `/`) — the client's own cookies plus the injected
  `next-auth.session-token` / `__Secure-next-auth.session-token` (the `__Secure-` variant is
  what the app reads over TLS). Empty-cookie safety via `map $http_cookie`.
- Verified live: `api/auth/session` → Admin session; the dashboard renders with live traces and
  costs; zero password fields on any screen.
- Lesson (same night): session minting must go over real https — `__Secure-` cookies cannot be
  stored from plain http (curl refuses); the working session value lives in
  `governance/ids-box.env` and the box's `/opt/raibach/ids/.env`.
