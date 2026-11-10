# The console's conversations and its chat output — the plan

2026-11-10. This is the section for the console chat. It covers two things that are one interface:
the **conversations** (what is stored, what always exists, how a tab's thread lives) and the
**chat output** (what the column draws, what a person can press, and what that press does).

Companions in this section: [`chat-output.md`](chat-output.md) (the design seat's column pattern,
part by part), [`tab-consoles.md`](tab-consoles.md) (per-tab consoles and introductions). Search,
memory and ranking stay in `../MILVUS-notes/console-search-plan-2026-11-10.md`.

---

## Part 1 — The conversations

### 1.1 The unit

A conversation belongs to the console's package (`conversations.session_id`), and to one tab of it
(`conversations.tab`). The console's chat and a tab's chat are different rows of the same package —
never one global thread, never another seat's thread.

### 1.2 The default conversation always exists

- A landing ENSURES the chat conversation exists and is bound before the seat draws.
- If every conversation is deleted, the next arrival creates one and the seat greets into it.
- This is not a fallback: an empty console chat is not a state a person can reach.

The rule, from the design seat (the working reference, `chat-panel`):

1. `_takeArrival` clears the greeting latch and the "ensured" latch.
2. `_greetIfArriving`: if the seat has a session and no conversation and has not ensured one, it
   makes one by the app's path (`_startNewConversation`), which creates the row, repoints the
   package, moves the seat in, and announces `conversation-change`.
3. Then it greets — once per arrival, only when the thread has nothing to read.
4. The last delete is an arrival: move the seat to no conversation, re-take the arrival, and the
   same path recreates and greets.

The console seat is a copy of that element and had drifted. The lifecycle is being ported back to
the design seat's exact order; nothing new is invented.

### 1.3 Greetings are turns, not page-load scripts

A greeting is one assistant turn written into a real conversation, once per arrival. It is never
re-injected on every render, and it never speaks into a thread that has words in it. The greeting
asks the question the seat exists to ask ("what are you working on?").

### 1.4 Tabs have their own conversations

`get_or_create_console_tab_conversation(uid, tab)` gives each tab its own row. Approvals already
uses one; the chat tab is the default above. Tools and UX follow in the tab plan.

### 1.5 What is recorded

| Record | Table | Why |
| --- | --- | --- |
| the thread | `conversations`, `conversation_messages` | what was said, per package and tab |
| what a turn showed | `surface_turns` (plan, ordered ids, versions) | replay, "number two", refresh |
| what was pressed | `surface_actions` | outcome, idempotent per set/item/action |

Postgres is the truth. Vectors are derived from it.

---

## Part 2 — The chat output

### 2.1 The column

The console's chat column is its own seat, with the design seat's column as the pattern: shell,
rail, slots, folds, conversation, input and action bar at the bottom, the grip that drags the
input split, and the column's own feed. Same look, its own files.

### 2.2 What a turn can be

| Kind | Drawn as | Produced by |
| --- | --- | --- |
| a sentence | text | the model, into the seat's conversation |
| a question with choices | text plus `[label](action:token)` buttons | the greeting / tool inventory |
| a result set | the plan line plus the grid on the left | the query lane, recorded as a `surface_turn` |
| a missing row | "1 no longer available", with the reason | replay classification |
| an outcome | the press recorded; no chat noise | `surface_actions` |

### 2.3 Inline options

`[Figma ingest](action:figma-ingest)` is a button today: the renderer turns the link into a button
and sending it returns the token as the next turn. The console resolves the token **without a model
call** — it is a choice, not a sentence. The options themselves come from the tool inventory, not
from strings written per page.

### 2.4 The plan line

Above the thread, the console states what it is showing: the plan in words, the count, the missing
count, and a Refresh control. It is the column's equivalent of the design seat's trace feed.

### 2.5 Drag and reference

The column's grip (vertical drag of the input split) exists. The console adds one thing the design
seat does not need: a card dragged from the left column into the input becomes a reference ("this
one"), which the next directive resolves to that card's id.

### 2.6 What the model is allowed to be

The model chooses the query and the actions. It does not write results, does not invent ids, and
does not page-load scripts. The conversation is its working record; the surface is its output.

---

## The interaction loop (the owner's test)

1. She asks, in the conversation, with buttons: what are you working on?
2. The person presses `[Figma ingest](action:figma-ingest)` — a real turn.
3. The grid switches to the ingest's work; the plan line says what was applied; the set is recorded.
4. The person says *"number two"* — the ordinal resolves against the recorded set; the card opens.
5. The open is recorded as an outcome; the read stays a read.

---

## Where it stands

| Piece | State |
| --- | --- |
| Default conversation (main console) | **Browser-verified 2026-11-10.** Deleting the chat conversation (with approvals still present) creates a new `Console — Chat`, binds the package and greets into it. Deleting the last one never leaves the chat at zero. |
| Greeting | **Browser-verified.** One per arrival, asks what they are looking for. The last-delete path re-takes the console's own arrival and the greeting is written into the new conversation. |
| Inline options | **Inventory-driven, browser-verified.** The seat draws the tools from `/console/tools`; the stored greeting carries no link. A stored greeting written by the old prompt is not duplicated. |
| Action token → work | **Browser-verified in the column.** Pressing `Figma ingest` writes the turn, re-assembles with no model call, and draws 8 design cards with `Figma ingest · recent activity · 8 cards`. |
| Ordinal open | **Browser-verified 2026-11-10.** After the Figma set, typing `number two` writes the turn, opens the second card in the Design room through the same `card-open` path, and makes no model call. The set on the left is the set the ordinal resolves against. |
| Contextual card chat | **Browser-verified 2026-11-10.** The Tools tab draws its own thread; every turn carries the visible tab set (tab name, cards, order, ids) as `CURRENT WORKSPACE`. Asking "which cards are showing?" on Tools answers with the eight cards in order and does not change the tab, the cards or the plan. |
| Chat as the tab's search | **Browser-verified 2026-11-10.** A typed instruction narrows the active tab's cards: "show me the input ones" in Tools → three cards, plan `input · 3 cards`, tab/thread/conversation unchanged. The next question answers the three cards in order. A question ending in "?" does not filter. |
| Tools greeting and delete/reload | **Browser-verified 2026-11-10.** The Tools tab greets from its own conversation (one stored assistant turn). Deleting `Console — Tools` creates a new row through the default open and greets into it; reload reads the same greeting back. The separate Chat-tab QA passes the same way. |
| Approvals greeting and delete/reload | **Browser-verified 2026-11-10.** The Approvals tab greets from its own conversation and says the queue is empty today, with the plan `Approvals · waiting on you` and no cards. Deleting `Console — Approvals` creates a new row and greets into it; the same greeting is read back on reload. |
| Results as turns | Done: recorded, replay 0.14 s, missing rows said. |
| Plan line | Drawn with count, missing count and Refresh. |
| Recorded open | Done: one row per set/item/action, idempotent, stale press refused. |
| Drag-to-reference | Not built. |
| Per-tab consoles | **Rows and card assemblies working 2026-11-10.** Chat, Tools and Approvals list only their own `conversations.tab` rows and each has its own bound thread. A tab press runs a **cards-only assembly**: the room writes `/cards` and `/console/query` and leaves the chat element/thread alone. Tools → eight Figma cards + its plan; Approvals → the supervisor queue (none today); Evals/Settings → no set yet, said. The Tools greeting and work view (T2) and the Approvals greeting (T4) remain in [`tab-consoles.md`](tab-consoles.md). |

---

## Build order

| # | Work | Test |
| --- | --- | --- |
| A1 | Console seat lifecycle matches the design seat (arrival, ensure, greeting, last delete) | delete every conversation in the browser → a default exists, is bound, and she greets |
| A2 | Greeting options come from the tool inventory, not the model | the button appears on every arrival; adding a tool adds a button |
| A3 | The plan line is the column's feed | it states plan, count, missing, and survives a reload |
| A4 | Ordinal open from the conversation | "number two" opens the second item of the recorded set |
| A5 | Drag a card into the input | the drop references that card; the directive resolves to its id |
| A6 | Per-tab consoles | each tab has its own conversation, greeting and work view |

A1, A2, A4, T2 (core), T4 and the per-tab cards-only assemblies passed in the browser on 2026-11-10. A3's plan line is drawn and survives a reload. A5 (drag-to-reference) is **not a requirement** — the owner said they never asked for drag-and-drop — so it is parked, not next. The remaining per-tab work is the full tool inventory (T2's unbuilt tools) and each tab's shown-set namespace (T5).

---

## Non-negotiables

1. The console's chat is its own element and its own files; no shared chat across seats.
2. No page-load injection of scripted conversation; the greeting is one turn per arrival.
3. The model's output is an operation — a query, a set, an action — never prose standing in for it.
4. Every write path records and attempts; a miss is visible (`indexed_at IS NULL`) and repairable.
5. A missing row, a refused action and a failed read are said in the column, never drawn as nothing.
6. Hard reload is the only way to judge a Lit custom element change; no claim is made from a tab
   that was already open.

---

## Known issues outside this plan's first pass

- A kept card saved with no drawing opens an empty middle column; it should say so.
- 15 archived `Design — Tools` rows with no preview and no `kept_at`: excluded everywhere, but they
  can only ever render blank if handed to a seat.


---

## T5 — the reference decisions and row 6

**Mechanism.** T5 is the same `surface_turns` rules scoped by `namespace`, not a parallel
record. Namespace values: Chat = `console` (the main console's conversation), Tools = `tools`,
Approvals = `approvals`.

**A — the message id is written before the search.** A search turn is written by the seat
(`POST /api/conversations/{id}/messages`) before the cards-only search; the search request carries
that message id and records inline. The teacher is told `user_turn_written` so it does not write
the same person turn twice. This is the former case, not an outbox: the write is complete before
the search. If the pre-write fails, the cards still narrow and the plan line says
`record_error`; no set is invented for a turn that does not exist.

**B — ordinal refusal text.** With no recorded set in the tab:
`There is no recorded set for this tab yet. Ask for a set first — for example, "show me the input ones" — then name a number.`
No visible-card fallback.

**C — Chat is the main console.** The Chat tab is bound to `console_conversation_id`
(`routes/ai.py:1454`); it shares the `console` namespace and active set with the main console
surface because they are the same conversation. There is no separate main-console set. A Chat
search and a main-console search in that conversation are the same active set; newest wins. Tools
and Approvals have their own conversations and namespaces.

**Dead path.** `routes/ai.py:1510` is dead because the landing no longer sets `_active`/
`_turn_id` (the directive block was removed so a reload is all cards). That is intentional, not a
Phase 4 regression. T5 re-wires replay on **tab reopen** through `surface_turns.replay` and
`/api/console/replay` with namespace; the landing stays all cards.

### Row 6 — record the tab search

Implemented: the seat pre-writes search turns; the cards-only path records the set with
`namespace=tools`, the tab conversation, the message id, `base_ids` for a tab-scoped refresh, and
the write-time eligibility assertion. A missing turn id or a failed record is drawn as
`record_error`; the cards still narrow. Refresh is hidden until row 5 makes it tab-scoped.

**Tested ✓**
- Tools search "show me the input ones": one `surface_turns` row, namespace `tools`, message id =
  the user turn, 3 shown ids, plan `input · 3 cards`, base_ids = the 8 tools cards,
  eligibility `b96521044621`; one user message, no duplicate; cards 3; plan line.
- Tools search "show me the seat one ones": one row, namespace `tools`, 2 shown ids, plan
  `seat one · 2 cards`; one user message; cards 2.
- Write-time assertion: recording an ineligible id raises `Refusal` and writes no row.
- No turn id: cards narrow to 3 and the query says
  `the search set was not recorded because its turn was not written`.

**Rules-checked ✓** — record references the stored message and rows; search cards are the tab's
base rows (no vector-only draw); `fetch_cards_by_ids` uses `ELIGIBILITY_SQL`; `record` refuses
ineligible ids and stores `eligibility_version`.

**Gaps:** active-set namespace (rows 1–2), replay (row 3), ordinal route/refusal (row 4),
tab-scoped refresh/retention (row 5), idempotency (row 7), Chat namespace test, and the measured
search latency (10–16 s in these runs). The Refresh control is hidden for recorded tab searches
until row 5.


## T5 rows 4, 5, 7, 8 — results

**Landing vs recorded set.** The landing and a tab press with no record are DEFAULTS, not recorded
sets; they draw without a `surface_turn` by design. A search or refresh is a recorded set and its
plan line says so (`searched`, `replayed`, `refresh`). Property 1's tab-base "no record" is this
default, not a bug; the equality rule applies to a turn's set.

**Row 4 — ordinal prints the set it resolved against.** The API already returned
`active_turn_id`; the column now prints `Resolved against set <surface_turn_id>` in the same line
as `Opening N — “title”.` Test: Tools set `143c…`; ordinal 2 → 200, item `479…`, column line
contains the full `143c…` id; ordinal 3 → 409; no-set tab text unchanged. If the id is absent, no
card opens and the column says the set did not name itself.

**Row 8 — turn-row parity.** A failed turn is **not drawn as a turn**: a failed ordinal write
draws only `Not saved — … The card opened, but this turn was not written.`; the user/opening turns
are not appended, and the recorded set stays at `143c…`. A failed assistant reply is not drawn; a
notice says it was not saved. A failed person's turn is kept visible with the `not saved` mark
(the allowed "said, not presented as recorded" form) and a notice. Test: force the ordinal write
to 500; local turns are `[]` except the alert; set unchanged. The general teacher failure path is
not forced in-browser yet.

**Row 5 — tab-scoped refresh and prune.** `_search_in_base` uses the recorded `base_ids`; a
monkeypatched `search_cards` captured exactly the 8 base ids and returned the patched order; a
refresh record wrote a new row (`2dbd…`, origin `refresh`, namespace `tools`) while the old row
remained; `active_set(tools)` moved to the new row. `prune(keep=1, namespace='tools')` deleted 2
and kept the active refresh row; the Chat `console` set was untouched. Frontend refresh posts
conversation + namespace, draws the returned cards/plan through `a2ui:console-refresh`, and made
**no** full assembly (1 before, 1 after). End-to-end refresh through the running server was not
run (backend 137 earlier); the base function and the room wiring were tested separately.

**Row 7 — idempotency.** Recording the same message id in `tools` again returned the existing row
`143c…`; the namespace's row count stayed 2. Refresh is exempt by origin; the new refresh row is
the active set.

**tested ✓ / rules-checked ✓ / gaps:**
- Row 4 tested ✓; row 8 tested ✓ for the ordinal write failure (general teacher persistence path
  still a gap); row 5 tested ✓ in the base/prune/room-wiring split (end-to-end refresh not run);
  row 7 tested ✓.
- Rules: active/record/replay/refresh/prune scoped by namespace; record asserts eligibility;
  failed search falls back to the last recorded set (the fallback itself not re-run after the 137);
  landing/base defaults are not recorded by design.
- Gaps: row 6 fallback test after the 137; general assistant/user persistence forced test; actual
  server refresh; Chat namespace test after prune (the set is unchanged but the full path not
  re-run).


## T5 close-out — Chat default, row 6 fallback, live refresh, row 8, row 9

**The Chat tab is the whole library.** Pressing Chat must show every card (the owner, 2026-11-10:
"the chat tab ... represents every card every activity in the system"). Row 3's replay applies to
Tools and Approvals; Chat skips replay and asks for the base library. Test: landing 19 → Tools 2 →
Chat 19 → Tools 2 → Chat 19, Chat plan null. Chat is the main console's conversation and namespace,
but its last search set is not replayed on a tab press. An ordinal on the all-cards Chat view now
refuses (`no recorded set for this view`) instead of resolving that hidden search set.

**Row 6 fallback — retested, not the 137 run.** Forced the pre-write to 500 on Tools: the fallback
drew the last recorded 2-card set, not the unrecorded 3; `consoleQuery.error` =
`HTTP 500 The last recorded set is still showing.`; turn_id `2dbd…`; `refreshable:false`. The
unrecorded search cards were not returned. Tested ✓.

**Server refresh — end-to-end.** Live `POST /api/console/refresh` with `conversation_id` + `namespace:
tools` wrote `ac9f121f…`, origin `refresh`, namespace `tools`, 2 cards/`seat one · 2 cards`; the old
`2dbd…` row remained. Tested ✓.

**Row 8 — both persistence failures forced end-to-end.**
- Assistant reply trigger: user row written, assistant insert raised; the seat's `_local` was user +
  `Not saved — This reply could not be written…`; **no reply turn**. DB: user row only.
- Person turn trigger: user insert raised, assistant row written; the seat marked the user turn
  `notSaved: true` (DOM `.not-saved` = "not saved"), drew the reply, and added `Not saved — Your
  message could not be written…`. DB: assistant row, no user row.
Triggers removed after the test. Tested ✓.

**Row 9 — tree = record.** The search/replay/refresh query now carries `shown_ids`; the seat's
`_treeRecordMismatch` compares `consoleCards` ids/order with it. The context gets
`THE CARDS DRAWN DO NOT MATCH THE RECORDED SET`; the plan line gets
`The cards drawn differ from the recorded set.` Test: reverse the recorded ids against the drawn
cards → both lines appear; restore order → both disappear. Tested ✓.

**Tested ✓ / rules-checked ✓ / gaps:** all four requested items tested. The 10–16 s latency stays
tracked in the MILVUS plan. Gaps: the server refresh end-to-end used the current active Tools set
(not a fresh search turn); Chat's last search set remains in the `console` namespace for audit even
though the Chat view is the library; row 9 compares ids/order only, not card content.


## Accepted — Chat is the library (2026-11-10)

A Chat search records under `console` for audit, but it is not the active set of the Chat view.
Reopening Chat shows the whole library; an ordinal on the library refuses; the hidden search set
is never used behind it. Tools and Approvals replay their own sets. QA checklist row 11 is the
canonical regression.

## Test harness for row 8

The DB triggers used for the two forced persistence failures are gone. The permanent seam is
`backend/test_harness.py` (`CONSOLE_TEST_FORCED_FAILURE=user|assistant`, or `force_failure()` in
tests); the teacher route calls `test_harness.maybe_fail("user"/"assistant")` inside the write
try. The behavior has a Vitest CI test in
`frontend/src/rooms/console/chat/persistence.test.ts` (reply not drawn; person turn marked;
no-error unchanged), and the harness itself has `backend/test_turn_persistence.py`.


## Phase 5 — tool inventory started (2026-11-10)

`backend/console_tools.py` is the console-owned registry: one `available` tool (Figma ingest),
expected size 15, entry/status/one-line fields. `/console/tools` is built from it, and the Tools
greeting is formatted from the seat's `consoleTools` data instead of a Figma-only constant. Tests:
`backend/test_console_tools.py` (registry/available/expected) and
`frontend/src/rooms/console/chat/tool-inventory.test.ts` (available, added entry/status, empty).

**Gap:** the 14 unbuilt tool names are not in the repo. They are not invented; they arrive as
registry entries when supplied. Until then the greeting names Figma and cannot name the unbuilt
tools.


## Phase 5 — selection, work view, approvals, UX

- **Selection:** `console_tools.resolve_tool_selection` resolves name/description and refuses
  unknown/unbuilt in words; tests cover available Figma, a fixture not-built entry, and an unknown
  phrase naming only real available tools. The Tools greeting draws buttons only for `available`;
  `_applyConsoleTool` refuses a non-available token without an assembly. Typed-description wiring
  into the seat is still partial.
- **Tools work view:** the selected tool's cards are the left column today; a dedicated ingest
  view (recent jobs, state) is still the Phase 5 gap.
- **Approvals wait list:** the queue is the left card set; empty today. A count/oldest/who summary
  for a non-empty queue is not built.
- **UX:** blocked on the design UX reference; not invented.
- Remaining inventory names: 14, supplied by the owner/design inventory. Do not fill them.


## Console conversation card — design reference (2026-11-10)

The conversation furniture is the design seat's, not the console's old separate list:
`console-chat-header` is the design header copied and retagged; the console template puts the
rows inside it with `data-slot="conversations"` and `?open`; the list/new-button styles are the
design `design-chat.styles.ts` values. The old `.output-slot` list below the bar was removed.
Reference: `design-chat-header.ts:489-530`, `chat-tab.ts:5103-5150`,
`design-chat.styles.ts:281-410`. QA checklist row 15.
