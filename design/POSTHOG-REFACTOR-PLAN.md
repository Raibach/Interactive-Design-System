# PostHog Refactor Plan — running update

Status: **the UX tab is the design seat, copied, with only its function wired (2026-11-12).**
`rooms/design/ux/chat.ts` is a line-for-line copy of `design-chat.ts` (5,639 lines), retagged
`<ux-chat>`; `rooms/design/ux/chat/styles.ts` is the design's stylesheet, copied. The template,
classes and layout are the design's. The UX function — its store, its turn, its place — is wired
behind that seat; selecting the tab changes the function and never the interface. PostHog's own
pre-chat content shows by default in the seat's output, and a suggestion sent through the same
composer produced the same thread card with the reads' answer (measured). The turn's transport is
`shared/ai-engine/chatTurn.ts`; `backend/posthog_read.py` reads the app's lists before the model.
The numbers inside an insight are not read yet; the vendor agent is out of credit (HTTP 402). This
file is the living plan; it changes as we discover.

## Goal

Absorb PostHog (MIT) into the studio as a tool in the Design tab: take
over its functionality, untangle the vendor (Anthropic, PostHog Cloud,
login, telemetry), and rewire each piece to ours.

The absorbed PostHog must be **session-based**, like the Figma tools —
not a click-through website inside a tab. Every use of PostHog is a
session: a `design_tab` row (one per person per tab) that records the
conversation and activity as an audit log, and on save becomes a
`design_session` card on the Console. That card captures the work the
user did and distributes it, exactly as the Figma tools cards do.

The approval queue is not built yet — do not plan around it. The
session → card → activity-ledger pattern is what must be replicated for
PostHog.

## The shape — the UX session lifecycle (verified in code)

**The Figma tool is the template.** Its lifecycle is already built and
is what UX/PostHog replicate, not re-invent:

1. Work → a session starts: a `design_tab` row (Open, one per person per
   tab). Private — nothing is shared.
2. **SAVE** — `design-left-footer.ts` dispatches `design-left-save`;
   the `design_tab` is snapshotted into a `design_session` card
   (`routes/ai.py:5988`).
3. **Create new** — `design-left-footer.ts` dispatches
   `design-left-new`: "the seat asks the same Save or Discard question
   the tab's leave asks, then builds the next Tools session"
   (design-left-footer.ts:150-157).
4. **Leave without saving** → the seat asks Save or Discard
   (design-left-footer.ts:151). A typed filter counts as work, so the
   question is asked instead of a silent discard (`tools-chat.ts:4518`).
5. The chat presents the choice as buttons:
   `"[Accept](action:preview-accept) or [Discard](action:preview-discard)"`
   (`ingest-summary.ts:91`) — the chat-drives-the-workflow pattern.
6. Approval queues stand on this shape and are out of scope.

PostHog's session must match this lifecycle exactly: private work →
SAVE (card) or Discard, with the leave question.

## Verified discoveries

1. **PostHog auth is a fork.** `AUTO_LOGIN=True`
   (`posthog/settings/__init__.py:142`) signs every unauthenticated
   request in as the first active user (`posthog/views.py:94-96`).
   Login page deleted; `Scene.Login` removed from routes.

2. **Studio identity is an `X-User-ID` header** resolved by
   `get_user_id_from_header` (`backend/deps.py:305`) to a real UUID or
   `DEFAULT_USER_ID` (`0000…0001`). The `users` table EXISTS (15 rows,
   email + password_hash + role + login tracking); the gap is that
   `getStoredUserId()` hardcodes the default instead of resolving the
   logged-in user.

3. **Two databases.**
   - PostHog analytics → **ClickHouse**.
   - Studio data (sessions, cards, conversations,
     `design_element_activity`) → **Postgres**.
   - The studio already reimplements PostHog's funnel/pacing/friction
     math in `backend/element_analytics.py`, over
     `design_element_activity` in Postgres.

4. **Chat model already rewired.** `ee/hogai` routes chat to DeepSeek;
   the availability gate (`posthog/views.py:256`) now checks
   `RAIBACH_IDS_CHAT_MODEL`; the placeholder Anthropic key is removed
   from the compose.

5. **The studio already has its own analytics, separate from PostHog.**
   - `element_metrics_vocabulary.py` — the closed metric vocabulary
     (counter/trail), scoped by element key. This is the "tag" concept.
   - `clickhouse_events.py` — interaction events go to our own
     ClickHouse (`ux_analytics`), never PostHog's.
   - `element_analytics.py` — funnel/pacing/friction math, reimplemented
     from PostHog's MIT blueprints, over our rows.
   - Postgres holds `design_element_metrics` (counters) and
     `design_element_activity` (trails).

6. **The A2UI → analytics pipeline already exists, end to end.**
   - Catalog (`catalogs/<pipeline>/catalog.json`) → tag registry
     (`tag-registry.ts`, the allowlist) → Lit renderer
     (`a2ui-renderer.ts`).
   - The renderer forwards `a2ui-action` with `comp.id` + `comp.component`
     — "the tag must travel with the event" (a2ui-renderer.ts:447).
   - `uxCapture` sends it to the capture door → vocabulary validation →
     our ClickHouse → `element_analytics`.
   - The Figma map (`components/registry.json`) records which Figma node
     each component came from — so "tag at ingest" = register the
     component there + in the tag registry under its element key.

7. **The application's core is the package model** — user → package →
   work → distribution.
   - A card is a `prompt_sessions` row (`card_lifecycle.py`).
   - The working session is a `design_tab` row — one per person per tab
     (`routes/ai.py:5891`). The conversation and activity are recorded
     in it as the audit log.
   - On save, the `design_tab` is snapshotted into a `design_session`
     card ("a design_tab becoming a card is snapshotted", ai.py:5988).
   - The Figma tools already work this way. PostHog must replicate the
     same session → card → activity-ledger pattern.
   - Approval queue is not built — exclude from scope.

## Method — surgical, not sweeping

The work is surgical: one wire at a time, verified as it lands. No
sweeping cut-over, no deadline. Each piece is untangled from the
existing UI, moved to our file, and checked against the running app
before the next piece starts. A failure is reported, never hidden.

## The teacher chat — ours, not the vendor's

**Direction (owner):** the vendor is the recurring problem. The teacher
chat is OUR chat: it may need its own file (it cannot be repurposed
from another `.ts`), and the Figma tool is its foundation.

**The vendor's path, as it stands.**
- `ux_chat.py` still DOCUMENTS the turn as handed to the vendor's conversation
  pipeline — "their endpoint, their agent workflow, their tools" — but no caller
  reaches it: `/api/ux/posthog-chat` is dead. The docstring is the old design,
  not the running one.
- The UX tab's chat is `ux/chat.ts` with its own `ux/chat/` folder (about 2,900
  lines including the tab's prechat, chips and panels), and it owns its seat.
  The other tabs still carry their own copies (`chat/design-chat.ts` 5,390,
  `chat/chat-tab.ts` 5,396, `tools/tools-chat.ts` 5,669). The vendor's UI is not
  among them; its *tool capability* is the piece not yet ours.

**The task.**
1. **Untangle the wiring from the existing PostHog UI** — its native
   chat's conversation, tools and interaction — and **move it to OUR
   `chat.ts`**. The existing UI is the source of the logic, never the
   destination.
2. A separate chat file for PostHog may be needed: the sovereign chat
   container has its own file, and PostHog's wiring is what fills it.
3. The chat container is SOVEREIGN — not the React shell. The container
   (the element that holds the chat) starts as an empty shell; the
   moved wiring is inserted INTO that container and replaces it. Not
   repurposed from another `.ts`, not rebuilt from history, not
   overridden from a remote pattern. (sovereign-workspace: forward
   only, local context is truth, fail loudly.)
4. It is wired into OUR system — our session, our conversation, our
   pipeline — not the vendor's conversation endpoint.
5. The vendor's conversation pipeline (ee/hogai, the conversation
   endpoint) is what gets removed from this path.
6. **It must operate the application like the native chat does.** The
   teacher chat has to interact with the PostHog application the way
   the vendor's native chat does — driving it, navigating it, running
   its tools. That tool capability is moved with the wiring; the native
   chat's interaction model is the reference.

**Verified: the sovereign seat is built.**
`frontend/src/rooms/design/ux/chat.ts` — `<ux-chat>`, the tab's own seat, with its own
`ux/chat/` folder (owner, 2026-10-18: "you will have to have a dedicated file for UX
chat. You cannot repurpose a 7000 line page of an app and inject every
single aspect of this application"). `DesignSeatShell` mounts it directly for `ux`; there is
no `design-chat` and no view slot (measured 2026-11-12). Its turn goes to OUR door:
`/api/teacher/query` with `design_tab: 'ux'`.

**Verified: the vendor's door is unused — and its engine is dead.** Nothing in `frontend/src`
calls `/api/ux/posthog-chat` (the route in `routes/ux_chat.py` that hands the turn to the vendor's
pipeline). Measured 2026-11-12: the route answers "The application's agent said: I'm unable to
respond right now", because the container's model endpoint returned **HTTP 402
`insufficient_balance_error`** for `deepseek-chat`. The vendor's tools cannot be inherited until
that key is funded or replaced; the capability moves to our engine.

**The gap: the chat's tools do not operate PostHog.** The register
(`backend/tool_run.py`) offers only `search_the_internet`,
`read_a_wiki`, `research_a_topic`, `query_a_database`. The Figma MCP
tools (`figma_mcp.run_tool_calls`) are design tools. So the chat cannot
yet drive or measure the analytics application.

**Correction — "operate the app" is an OPERATION, not a data read.**
The first shape proposed was an analytics-read tool
(`element_analytics` → string). That does not operate the app. The app
is framed SAME-ORIGIN — `ux-app-frame.ts` points the iframe at
`/posthog` on our origin ("a same-origin frame's pathname, read once per
change"). Same origin means the studio's own code can reach into the
frame: change its location (navigate), interact with its DOM. That is
the mechanism a chat uses to operate an app, and it is what our chat's
tools must drive. The native chat's tools are the reference; a data-read
tool is not it.

## Chat — current wiring (verified in the running app, 2026-11-12)

**The UX tab is the same seat, not a new one.** `rooms/design/ux/chat.ts` is a line-for-line copy of
`design-chat.ts` (5,639 lines), retagged `<ux-chat>`; `rooms/design/ux/chat/styles.ts` is the design's
stylesheet, copied. The template, classes and layout are the design's. `DesignSeatShell` creates
`<ux-chat>` for the ux tab directly; there is no `<design-chat>` and no slot. Measured: 840×944 at
x 840, `activeTab="ux"`, and the navigation bar, conversations bar, `design-chat-messages` and
composer are the design's. No bespoke UI remains.

**What is wired behind it.** `_showsThread` includes ux; `_loadUxStore` reads
`/api/raibach/ux/conversations`; `_uxOpen` feeds the seat's own `messages`; `_uxSend` goes through
`sendChatTurn` with `design_tab: 'ux'`; `_uxNew` and `_uxRemove` use the tab's store; the legacy
conversation module returns early for ux; `ux-nav:` actions move the framed app. PostHog's own
pre-chat (`ux/chat/prechat.ts`) shows in the output by default while the thread is empty.

**One turn door, one store.** The turn is POSTed to `/api/teacher/query` with `design_tab: 'ux'`,
so `_design_turn` writes `design_conversations` / `design_messages` in `DESIGN_DATABASE_URL` — the
same store `/api/raibach/ux/conversations` returns. Measured: a turn answered, both turns were read
back and drawn, and the scratch conversation was removed. The earlier split (read door 2, write
door 1) was real and is gone.

**What the tab's tool does.** The chips above the field are the application's screens — Insights,
Funnels, Dashboards, Session replay, Events, Flags — built from the project the frame itself reports.
A press dispatches `ux-app-navigate`; `ux-app-frame.ts` refuses any path outside `/posthog` and moves
the same-origin frame. Measured: `/posthog/project/1/insights` → `/funnels`, and the header followed.
A reply may move it too with `[label](action:ux-nav:/posthog/…)`.

**The PostHog chat's own engine is out of credit.** `/api/ux/posthog-chat` answers "The
application's agent said: I'm unable to respond right now." The cause is not the UI: the container's
model endpoint returned **HTTP 402 `insufficient_balance_error`** for `deepseek-chat`; the web door's
POST returns 200 and the Max worker logs nothing because the model call has no credit. Our teacher
door answered the same hour. So their agent and tools cannot run until that key is funded or
replaced, and moving their UI would move a face onto a dead engine.

**Sign-in — there is none to rebuild.** `AUTO_LOGIN` is ON by default
(`posthog/settings/__init__.py:142`) and the compose sets `AUTO_LOGIN: "1"`; every unauthenticated
request is signed in as the first active user. Measured: `GET /project/1/insights` on :8200 answers
**200 with no cookie**, so the framed app needs no seat-level login. `/api/ux/posthog-login`
(`ux_chat.py:77`) has no frontend caller and is dead.

**Activity recording (already works).** The old view recorded `uxCaptureSurfaceOpen('chat-seat')`,
`uxCapture('message_sent', …)` and `uxCapture('action', …)`; the path is `uxCapture` → capture door
(`routes/element_events.py`, closed vocabulary) → **our ClickHouse only**
(`ux_analytics.events`). The capture door's own comment says "NOTHING is also written to Postgres".
The new seat does not yet record its own opens and turns; that is a known gap, not a claim.

**What the chat does NOT do yet.**
- **Reads the app's lists, not its numbers.** `posthog_read.py` reads the project, insights,
  dashboards, event definitions and feature flags before the model; it does not run a trend, funnel
  or retention query. The block says so.
- **`_design_turn` still bypasses the `tool_run` register.** The reads run before it, but a named
  `{{tool:…}}` token is not executed on this path yet.
- **The vendor's tool capability is not fully ported.** Its list is real
  (`ee/hogai/chat_agent/toolkit.py` and the mode toolkits), but its engine is the 402 above. The
  capability runs on our engine, not their key.

## The merge — the seat stands; the capability is next (2026-11-12)

**What stands.** The UX tab is the design seat — copied line-for-line into `ux/chat.ts`, with the
design's stylesheet — mounted directly for `ux` with no `design-chat` and no slot. The UX function is
wired behind it: the new store, the turn, the place. A suggestion sent through the design composer
produced the seat's thread card, and the answer used the reads (measured). `tsc -b --noEmit` is zero.
The tab's prompts, store and context live in `rooms/design/ux/`; the model engine and shared
transport stay outside it.

**What is not done, named.**
- The legacy UX thread (`92c2e95e`, 2 turns) was **not** migrated into the new store. The new
  conversations are empty, so the tab opens on its welcome. That is a real gap, not a hidden one.
- The discussion panel and the notebook door still read/write the legacy store.
- The chat reads the app's lists but not its numbers; `_design_turn` runs those reads before the
  model, but it still bypasses the `tool_run` register for named tools.
- PostHog's own agent cannot run: its container key is out of credit (**402**). The capability must
  be ported onto our engine, not inherited from that key.

**1. One store — the new schema, in use.** The chat reads `/api/raibach/ux/conversations` and its
turn names `design_tab: 'ux'`, so `_design_turn` writes the same tables. For the record, the legacy
`conversations` store was the other candidate: it holds every other chat, the package model and the
cards, and the one real UX thread — but it also carries two UX packages (`fd0f66f8` empty,
`25d6c28e` with the history) and a resolver that reads `LIMIT 1` with no `ORDER BY`
(`prompt_sessions_api.py:620-635`). It was not chosen; the stranded thread is still there and
invisible here, which is the migration item above.

**The cost that remains:** the new schema has no `prompt_sessions` row, so the "session → card" save
(`routes/ai.py:5988`) has nothing to snapshot for UX yet. That card story is how this choice gets
finished.

**2. One turn path.** `_ask` already goes to the teacher, and the UX turn now names its tab. What
remains on this wire: the discussion panel and the notebook door still read/write the legacy store
(`/api/ux/chat/discussion`, `/api/ux/chat/notebook`), and the vendor routes
(`/api/ux/posthog-chat`, `/api/ux/posthog-login`) come out of `ux_chat.py` — dead, never called,
and now the only thing keeping `POSTHOG_DEMO_*` in the stack.

**3. One capability set — on our engine.** The vendor's tool list is the reference
(`ee/hogai/chat_agent/toolkit.py:42-53` and the mode toolkits: read taxonomy and data, search, list
data and flags; trends, funnels, retention, SQL; dashboards, notebooks), but its agent cannot run:
the container key is out of credit (**402**), measured. Port the capability server-side into
`tool_run.py`'s register, and run it before `_design_turn` calls the model, or inside that branch —
today the branch bypasses the tool block entirely.
- **Two channels, not one.** A read is a `tool_run` string folded into the prompt. A *place change* is
  a client-side action: the UX thread draws `[label](action:ux-nav:/posthog/…)`, and `ux-app-frame.ts`
  moves the same-origin frame.
- **The app's session.** A tool that calls the application's own API needs that session; `AUTO_LOGIN`
  signs every request in as the first active user, and the demo login route is dead. That is an
  app-credential decision, not a chat one.

## The bridge — studio user → PostHog user (verified against code)

**Studio side (as it is).**
- `frontend/src/services/authService.ts:64` — `getStoredUserId()`
  ALWAYS returns `DEFAULT_USER_ID` (`0000…0001`). Storage keys
  `grace_user_id` / `grace_user_role` exist but are not the identity.
  Comment: "there is ONE user — the owner (DEFAULT_USER_ID)".
- `frontend/src/shared/apiFetch.ts:17` — every call sends
  `X-User-ID: getStoredUserId()`.
- `backend/deps.py:305` — `get_user_id_from_header`: DEMO_MODE →
  DEMO_USER_ID; else header; else DEFAULT_USER_ID. Comment: "For now,
  use a default user ID (will be replaced with real auth)".

**PostHog side (as it is).**
- `design/posthog-master/posthog/models/user.py:122+` — Django `User`:
  `email` (unique, normalized), `distinct_id` (random token), password.
  `UserManager.create_user(email, password, first_name, distinct_id)`.
- **Nobody signs in at the seat.** `AUTO_LOGIN` is ON
  (`posthog/settings/__init__.py:142`; compose `AUTO_LOGIN: "1"`), so every request is the
  first active user. Measured: `/project/1/insights` answers **200 with no cookie**.
  `ux_chat.py:77`'s demo login has no caller; the account it names does not reach the running
  app.
- Consequence for the bridge: multi-user PostHog first means turning `AUTO_LOGIN` OFF and
  giving each studio user a real PostHog session. The email-keyed bridge below is that
  replacement, not a fix on top of the demo account.

**The bridge.**
1. The studio user record EXISTS: the `users` table with
   `email`, `password_hash`, `full_name`, `role`, `status`,
   `failed_login_attempts`, `locked_until`, `last_login_at`. Verified:
   `DEFAULT_USER_ID` is a real row — `dev@local`, "Grace Dev (owner)".
   The 15 rows on this machine are seed/test data; the table scales to
   any team size.
2. The gap is the WIRING, not the schema: two functions in
   `frontend/src/services/authService.ts` hardcode the default —
   `getStoredUserId()` (line 64) always returns `DEFAULT_USER_ID`, and
   `storeUserId(_userId)` (line 87) ignores its argument and stores
   `DEFAULT_USER_ID`. The login (`authService.login`, line 334) already
   calls `storeUserId(userId)` with the real id; the functions override
   it.
3. The bridge: studio user (email) ↔ PostHog `User` (email). Find or
   create the PostHog user by the studio user's email, sign in, hand
   the `sessionid` cookie.
4. THE DATA RECONCILIATION is the real work. The packages belong to
   `DEFAULT_USER_ID`; when a different id was stored, the console
   assembled ZERO packages ("every package belongs to the owner, not
   that row" — authService.ts:76). So the wiring has two parts:
   (a) make `storeUserId`/`getStoredUserId` use the real id, and
   (b) decide whether the packages move to the real user or the owner
   stays the default and the login maps onto it.

**Blocker.** None in the schema — the users table is complete. The
first piece is the identity wiring (resolve the logged-in user at the
seat), then the email-keyed PostHog bridge.

**Correction — there is NO login process.** The user is already logged
in by the time the session/chat work begins. The door is a PIN with no
memory (`frontend/index.html:169-174`: "no sessionStorage, no
localStorage, no cookie… the pin is asked for on EVERY page load"); the
app runs as the owner identity (`DEFAULT_USER_ID`). Do not build or test
a login. The multi-user seat is a future shape; today the identity is
established before the session starts.

**Correction — leverage the existing theme.** Do not reinvent button
styling from PostHog. The chat's buttons use the existing theme.

## Technical directions (the chat roadmap)

1. **The store — decided: the new schema.** The seat reads and writes `design_conversations`, and a
   turn persists (measured). The open store work is the legacy thread's migration and the
   discussion/notebook doors.
2. **The shared turn engine — built.** `frontend/src/shared/ai-engine/chatTurn.ts` owns transport,
   response parsing and failure classification; a tab's slice keeps its prompt, context and UI.
   Callers use `isChatTurnError`, because the project compiles with `strict: false` and TS 5.9 does
   not narrow a literal discriminant there.
3. **Chat reads analytics — the lists are built, the numbers are next.** `posthog_read.py` reads the
   app's own lists before the turn; the numbers inside an insight (a trend, a funnel, retention) are
   the next tool. These are two different datasets and must not be conflated with the studio's own
   `ux_analytics`.
4. **Chat manages PostHog.** The chat acts on the app — open insights, run funnels — as the session
   manager. Two channels: server-side API tools for reads and writes, client-side `action:` links
   that navigate the same-origin frame.
5. **Hide PostHog's built-in Max chat.** Only the seat's chat remains. The gate is NOT a sufficient
   mechanism: `isMaxAvailable` is `!preflight || isCloudOrDev || anthropic_available`
   (`maxGlobalLogic.tsx:470-473`) and `isCloudOrDev` is `cloud || is_debug`
   (`preflightLogic.tsx:356-359`) — measured `cloud: false` on this instance, so an authenticated
   `is_debug` can hold Max on with no key. And `anthropic_available` is the same
   `RAIBACH_IDS_CHAT_MODEL` switch that patches the vendor model, so unsetting it to hide Max also
   reverts the patch. Hiding is a source/flag decision (remove the panel, like the login page), not
   an env toggle.

## Open questions (these block the plan until answered)

1. **Database conflict — restated with the measured topology.** There are THREE stores, not two:
   the studio's Postgres (`DATABASE_URL`, legacy chat), the new design Postgres
   (`DESIGN_DATABASE_URL`, new chat), and ClickHouse. And there are TWO ClickHouse servers:
   PostHog's own container (`posthog-master-clickhouse-1`, no host port) and the Langfuse one our
   events live in (`127.0.0.1:8123`, db `ux_analytics`). PostHog's insights/funnel UI queries its own
   ClickHouse schema. So "PostHog's UI reads OUR store" cannot be a config change in either
   direction: either its query layer is re-pointed at our `ux_analytics` schema, or our events are
   copied into its ClickHouse. Pitfall 3 is that cost. The question that still needs the owner:
   which of the two is the target?

1b. **RESOLVED (2026-11-12) — the event read path.** `clickhouse_events.py` is right; the vocabulary
   docstring is wrong as a storage statement. The capture door (`routes/element_events.py`, step
   "4b. THE WRITE") sends ONE batch to ClickHouse and says "NOTHING is also written to Postgres";
   `element_analytics.py` reads through `clickhouse_events.fetch`. The Postgres tables
   `design_element_metrics` and `design_element_activity` exist and are still written by
   `routes/figma.py`, `sync_design_elements.py` and `backfill_element_activity.py`, but they are not
   the capture door's store. Interaction events live in `ux_analytics.events` and only there.

2. **Cross-app analytics.** PostHog must read the performance of the
   studio app it is embedded in (console, composer, other seats). How do
   the studio's events reach PostHog's analytics, and which database
   holds them?

3. **Action measurement.** Measuring a user's actions on the console
   (and another user's actions) — clicks, opens — where do those events
   land, and how are they counted across ClickHouse and Postgres?

4. **Conversation IDs as templates.** Conversation IDs are saved in the
   studio's tools as a template for how other chats act. How does the
   chat stay bound to the studio's conversation data, not PostHog's?

5. **Auth bridge — must be multi-user by design.** A team logs into the
   studio, then uses PostHog (15 was an example of the scale, not a
   number to build to). The seat must resolve the logged-in user's
   identity (not `DEFAULT_USER_ID`), and adding users later must not
   refactor the system. The `users` table already scales; the gap is the
   identity wiring, not the schema.

## Rewire pieces (the order, now that the wiring is traced)

- **Store → the new schema (decided).** The UX seat reads and writes `design_conversations`, and a
  turn persists (measured). The legacy thread's migration and the discussion/notebook doors remain.
- Model → DeepSeek (already done; only needed while the vendor pipeline still exists).
- Auth → the seat's identity. PostHog itself needs no login (`AUTO_LOGIN`); the gap is studio-side.
- Data → our ClickHouse (`ux_analytics`) against the vendor's ClickHouse/Postgres. The vendor's
  insights UI is the piece that must move; the chat's tools can read either store directly.
- Interface → reuse PostHog's components, rebranded.
- Telemetry → off.

## Pitfalls

1. **The store split was the live break, and it is fixed for UX.** The seat reads and writes the new
   schema, and a turn persists (measured). What remains is the legacy thread's migration and the
   discussion/notebook doors, which still use the old store.
2. **"One store" is not one store yet.** Three conversation stores and two ClickHouse servers exist.
   Any design that assumes one breaks on the other two (see questions 1 and 1b).
3. **Multi-user auth is foundational, not incremental.** Every table —
   sessions, cards, permissions, conversations — references `user_id` as
   a placeholder. Real multi-user auth touches all of them. A narrow fix
   on the seat alone leaves the rest single-user and it breaks when a
   second user appears.
4. **PostHog's UI is coupled to its own ClickHouse schema.** Its
   insights/funnel pages query PostHog's tables directly. Re-pointing
   them at our `ux_analytics` schema is a rewrite of the query layer,
   not a config change. This is the largest single piece of the absorb.
5. **The absorb is a fork.** Taking PostHog's UI but rewiring model, data,
   and auth is a fork. MIT permits it, but the fork drifts from upstream;
   every future PostHog change is re-applied or abandoned. That is a
   deliberate maintenance cost, not an accident.
6. **Two independent rewires.** The chat (`ee/hogai` → DeepSeek) and the
   analytics (PostHog UI → our store) are separate. Progress on one does
   not reduce the other; the risk is doing half of each.
7. **Vendor blocks resurface.** The forced login and its blocks took a week
   to fight around. The same blocks can reappear elsewhere (session
   expiry, middleware redirects) during the rewire.
8. **Infra.** Rebuilds and restarts are affected by the stale colima
   virtiofs; a change that "should" reach a container may not.

## When complete

- Record finished pieces in the PostHog section of the design changelog.
- Start a second changelog file when the first gets too long.
