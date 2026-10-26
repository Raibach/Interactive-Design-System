# Governance room — repair sweep

*(Owner, 2026-10-23: "we're gonna have to repair it first … do a quick sweep for repairs, report
back." Written from live measurements, not from the code's intention.)*

## Fixed today

### 1. The evaluators were blocked by a different key

**What the person saw.** "Evaluator paused — provider credits exhausted", and no evaluators in the
Evals tab.

**What was true.** Both evaluators existed. The index returned two evaluators and two rules, each
evaluator carrying `blockReason: LLM_CONNECTION_BILLING_EXHAUSTED`, set at 01:50 today. Langfuse's
stored DeepSeek connection used a key ending `...4649`. The platform's own DeepSeek key — the one
every model call in this application runs on — ends `...c276`. Same model, two credentials; the one
inside Langfuse was the dead one.

**What was done.** The platform's key was encrypted with Langfuse's own scheme (AES-256-GCM, the
deployment's `ENCRYPTION_KEY`) and written into `llm_api_keys.secret_key`, with
`display_secret_key` set to `...c276`. The stored value was then decrypted with Langfuse's key and
compared to the platform's, and it matches. The two evaluators' block columns were cleared, which
is exactly what the app's own `unblockEvaluator` writes.

**Measured after.** The index reports both evaluators as **Healthy**, and the worker container is
running, so the rules will evaluate new root traces.

### 2. The Evals tab drew an empty conversation instead of the evaluators

**What the person saw.** The Evals tab opened on her talk — an empty column — instead of the
evaluator index.

**What was true.** The room bound `evalsTalk: true` on its Evals seat. That flag makes
`evals-chat-panel` draw the conversation in place of its index, and the same binding never gave
that seat a session or a conversation: both were null and the thread was zero turns. The index
itself had already loaded — two evaluators and two rules sat in the element, with no error — and
was suppressed by the flag.

**What was done.** The `evalsTalk` binding is removed (`useGovernanceRoom.ts`). The element now
draws its index.

**Measured after.** On a fresh document, the Evals tab draws two rows:
`Ask Is Executable — Healthy — LLM as a judge — $0.315` and
`Run Follows Ask — Healthy — LLM as a judge — $0.1919`.

## Open — the sweep's findings

### 3. The Sessions tab has nothing recent to draw — and that is not a break

**Measured.** The store is alive: 5,423 events, newest at 23:49 tonight, 1,697 of them in the last
two days. Every one of those 1,697 carries NO session label. The last session-labelled event in the
store is **2026-10-17 17:39:38**; 914 events carry a label, all between 2026-10-09 and that moment.

**Why.** The receipt that reports a model call was stripped on 2026-10-17 on the owner's
instruction, and its own comment states the terms: "NO PROMPT, NO ANSWER, NO METADATA, NO STAGES,
NO TAGS, NO USER/SESSION: the receipt says what was spent, never what was said"
(`backend/grace_gui.py`, the receipt block). A session is a grouping label on trace rows. With the
label removed, every call since that day is an ungrouped trace, and the Sessions view — the app's
own and any view of ours — has nothing new to group. This is the instruction working as written,
not a failure.

**Repaired (owner, 2026-10-23: "proceed with repairs").**

- **The grouping key is back on the receipt, and only it.** `query_llm` now attaches the session
  its caller already states (`trace_session`) through the SDK's own `propagate_attributes`, for
  the moment the receipt is created. Nothing else returns: no prompt, no answer, no metadata, no
  user, no tags. A call whose caller names no session stays ungrouped, which is the truth about
  that call. Verified through the real function: a `query_llm` call with a named session wrote one
  row carrying that session into the store.
- **The room's Sessions tab now mounts its feed.** `sessions-feed` is created in the room's seat
  effect with `slot="view"` and `view-tab="sessions"`, and its module is imported by the room so
  the tag exists. A card press bubbles `session-select`, which the room already answers by
  opening the app's own session page.
- **The tab now ships the navigation to the table** (owner, 2026-10-23: *"it's supposed to ship
  the navigation to sessions and load the table"*). The tab-change handler has a `sessions`
  branch that navigates the frame to `/project/<id>/sessions`. Verified: the frame's address
  changes to that path and the page's own heading is "Sessions". Before this branch the middle
  stayed on whatever page it last showed — a session, never the table.
- **The table then says "No results", and that is the application's window, not a broken read.**
  Measured in the app's own state: the environment filter is any of `langfuse-llm-as-a-judge` and
  `default` (with `default` visible and the other hidden), "active only" is off, and the date
  range is the house default of the **last seven days measured on a session's creation**. Every
  session in the store was created between 2026-10-09 and 2026-10-16 21:58; at 2026-10-24 00:02
  the window begins on 2026-10-17, so it excludes all of them. The seat's own index reads thirty
  days by last activity and lists all twenty-three beside the table. New sessions will appear in
  the table the moment they are created — the receipt now carries their label.
- **Measured on a fresh document.** The tab draws the feed: twenty-three groups over thirty days,
  the newest of them `surface-assembly-console` (628 events, 315 traces, last seen 2026-10-17
  17:39) and `surface-assembly-composer` (58 events, 29 traces). A card press is wired; the rows
  are the app's own groups.

**What remains ungrouped.** The assembly calls (`render-console`, `render-composer` and the rest)
do not name a session, so their receipts stay ungrouped and the Sessions view gains a fresh row
only when a call that names one is made — a chat turn in the room, for example, whose caller passes
the room's session id. The historical rows show the buckets those assemblies used before the strip
(`surface-assembly-console`, `surface-assembly-composer`); restoring them means passing those names
at each assembly call site, which is a per-room decision and has not been made.

### 4. The god-file diagnosis, in the room's own words

Three facts, read together:

- `evals-chat-panel` is one shared element that changes its face on a boolean (`evalsTalk`) set by
  whichever room mounts it. The flag hides a loaded index and substitutes a conversation the room
  never supplied. One element, many rooms, a mode switch instead of an assembly.
- The shared `chat-panel` carries the same pattern at a larger scale: a probe that asks which room
  it is in, a Product mode, a Governance trace, a Console library, and the Composer's writes.
- The Governance room has no assembly at all. `render-governance` is deliberately unwired
  (2026-10-08), so its seat's face and data are bound by hand: eight properties plus flags. That is
  why a boolean decided what the Evals tab drew, and why nothing said plainly that the index was
  loaded and hidden.

This is the corruption the owner named. The direction out of it is the one the Console has already
taken: the room owns its seat, and the seat's face is the room's own decision rather than a flag in
a shared file. That is the second step of `PLAN-sovereign-governance.md`, which stays on hold until
the owner says otherwise.
