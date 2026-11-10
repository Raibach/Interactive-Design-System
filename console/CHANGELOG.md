# The Console zone — changelog and what comes next

*Started 2026-10-05, on the owner's rule: every tab's folder keeps its own log, and each tab's
folder is the source of truth. This folder begins here — before today the Console's records live
in the root `CHANGELOG.md` and the git history.*

---

## 2026-10-05 — the log starts

**What this folder is.** The Console zone's own shelf. The Console is the room the shell opens
onto — the package library: the cards, the chat seats and the catalogue the assembly reads
(`frontend/src/pages/ConsolePage.tsx`; the surface comes from `backend/routes/ai.py`, intent
`render-console`).

Entries land here as the zone's work lands.

---

## 2026-10-11 — the box's Console was empty; the database wasn't (and neither was the page).

**What was seen.** On the deployed site the Console assembled **"AI assembled — 0 packages"**.
Straight answer first: that card is the page's honest EMPTY state, not suppression — and the
cause was data, not code: the box's studio database was a bootstrap skeleton (a few seat rows)
while this Mac's carried the real store.

**Fix + receipts.** The full studio dump was restored on the box (cancel-safe detached script;
`pg_restore` exit 0): `prompt_sessions` **320** · `audit_logs` **1622** · `usage_metrics`
**1327** · `figma_ingest_activity` **450**. Verified: `assemble-surface` returns the owner's
real cards (Tennis Shoe, Boots on Sale, Competitive Intelligence Analyst, My new product
idea, …).

**No code changed in this zone.** `ConsolePage.tsx`'s empty-state card, its adjacent raw
diagnostics path, and the assembly endpoint stood exactly as they were.

---

## 2026-10-21 — the console comes out of the shell: the plan

**Why.** Owner: "We should not be assembling the surface from that react shell… separate out the
console itself from the react file." Verified against the repo's own laws — the modularity law
(every tab its own file), the architecture line (a tab = its own file, own surface, own data), and
the living precedent `frontend/src/design/tools/ToolsSeat.tsx`, which already moved a tab's
assembly door out of the shell unchanged. The request is the rule, not a preference.

**Measured.** `frontend/src/pages/WritingAreaIndex.tsx` = **12,090 lines**; **70** references
couple the console assembly into the shell (`isAIAssembling`, `setConsoleTree`, `setWorkspaceTree`,
`assemble-surface`, `aiAssembly*`). The shell's boot is one state machine with a model call, so a
slow assembly looks like a slow application and `GET /api/config` queues behind it (measured:
aborted at the 10s cap with `GET /api/config timed out after 10000ms`).

**Planned, not yet executed.** `console/CONSOLE-EXTRACTION-PLAN-2026-10-21.md` — Phases 0–5:
inventory → transport (`console/consoleAssembly.ts`) → the gate (`console/ConsoleGate.tsx`) → the
seat (`console/ConsoleSeat.tsx`) → the shell slims → the proof (cold fails at 10s with its reason,
retry draws, line-count receipt). Move, never re-derive.

**Boundary, stated honestly.** This fixes the FRONTEND coupling only. The backend still runs the
model call on its event loop (`Milestone A` 8.9s cold + `Milestone B` 4.7–9.0s); that is a separate
backend pass, recorded in the plan §6.

## 2026-10-21 — Phase 1 complete: the assembly transport leaves the shell

- `frontend/src/console/consoleAssembly.ts` (99 lines) — `postAssembleSurface()`: the fetch, the
  package headers, the non-ok body read as text, the §1 envelope parse, and the failure facts.
  No React, no shell imports. The shell calls it with the same intent, context, user id and
  AbortController signal (10s, reason stated).
- `WritingAreaIndex.tsx` 12,090 → 12,050 lines. `parseValidationEnvelope` removed from its
  imports (unused there now).
- Typecheck: zero errors in either file. Build: 4.68s.
- Tunnel proof: shell → console drawn in 1.3s; `🤖 [A2UI] envelope version "v0.9.1"`; no
  `ASSEMBLY FAILED`, no `ASSEMBLY-TIMEOUT`.
- Next: Phase 2 — `ConsoleGate.tsx` (standby line, failure report, Retry, Dismiss).
## 2026-10-21 — Phase 2 complete: the gate's markup leaves the shell

- `frontend/src/console/ConsoleGate.tsx` (141 lines) — `AssemblySpinner` (slot="spinner":
  amber ring + the one true sentence), `AssemblyFailureBanner`, `AssemblyFailureReport`
  (pointer, What happened / Why / What to do now, verbatim diagnostics), `AssemblyFailurePane`.
- The shell's three gate sites call them; markup, sentences and doctrine comments moved verbatim.
- Boundary, stated honestly: the gate's STATE and the `error-retry` / `error-dismiss` listeners
  did not move. They travel with the seat in Phase 3, because the gate cannot own the state of a
  request whose caller (the shell's `assembleSurfaceThenRepairs`) has not moved yet.
- Typecheck clean. Build 4.60s. Tunnel: console drawn 978ms, no failure text.
- Line count: `WritingAreaIndex.tsx` 12,010 (from 12,090 at session start).
- Next: Phase 3 — `ConsoleSeat.tsx` (cards, renderer effect, interactions, own conversation).

## 2026-10-21 — the shell's first 635-line block leaves (mechanical move, verified)

- `frontend/src/canvas/useShellEventListeners.ts` (679 lines) now owns the shell's window-event
  wiring: the statement was **moved verbatim**, not rewritten, and every name it closes over is
  passed in through `ShellEventDeps` (14 names, all `any` for now).
- `WritingAreaIndex.tsx`: **12,055 → 11,423 lines** (−632).
- How it was done, so it can be repeated: a read-only analyser used the TypeScript parser to list
  the component's 319 body statements by true size (the shell's biggest block is a 1,286-line
  `useEffect`), then computed the chosen block's free identifiers and imports; a mover spliced the
  exact line range out and wrote the module. The scratch tools were deleted after use.
- Verified: typecheck clean in both touched files; build 4.67 s; through the tunnel the console drew
  in **1,479 ms**, and dispatching `save-template` produced the effect's own log line
  (`[save-template] Reading 0 sections + 0 chars…`) — the listeners are live from the new module.
- Next candidates, by true size (re-measure after every move — line numbers shift):
  the 1,286-line `useEffect`, `assembleSurfaceWithAI` (549), `handleTabChangeWithGate` (455),
  `handleSavePrompt` (256).

## 2026-10-21 (cont.) — the shell passes under ten thousand lines

- `frontend/src/canvas/useRunPipeline.ts` (1,360 lines) — the 1,286-line run pipeline effect
  (run-requested, the third column, the repair loop), moved verbatim with **50** named deps.
- `frontend/src/rooms/useGovernanceRoom.ts` (651 lines) — the 612-line governance room wiring
  (seat, layout grip, trace elements, tool navigation), moved verbatim with **17** named deps.
- `WritingAreaIndex.tsx`: **11,424 → 9,533 lines** (−1,891 this pass; −2,522 from 12,055).
- Verified: typecheck clean in both touched files; build 4.18 s; through the tunnel the console drew
  in **991 ms**, and clicking **Governance** mounted the room (iframe + seat + "Standing up the
  governance workspace…"), which is the moved wiring running.
- The move tool is now kept as `frontend/scripts/shell-decompose.cjs`
  (`inventory` / `analyse` / `move`): it computes the block's free identifiers and imports from the
  TypeScript AST, refuses any block that would need a shell module-scope name (cycle), and splices by
  exact line range. Use `analyse` before every `move`, and re-run `inventory` after each one —
  line numbers shift.
- Next by true size (re-measured after the moves): `return (` JSX 867, `assembleSurfaceWithAI` 549,
  `handleTabChangeWithGate` 455, `handleSavePrompt` 256.

## 2026-10-21 (cont.) — assembly callback and tab gate out; the shell is 8,535 lines

- `frontend/src/console/useAssembleSurface.ts` (590 lines) — the 549-line assembly callback that
  serves every intent, returned by a hook so every call site kept its own name. 20 deps.
  One false dependency (`middle`) was caught by the compiler: it is a renamed destructuring key
  inside the moved code, not a page value. The decomposer now excludes `BindingElement.propertyName`.
- `frontend/src/rooms/useTabGate.ts` (~500 lines) — the 455-line tab gate. 17 deps.
- Verified: typecheck clean; build 4.36 s. Composer assembly through the tunnel:
  `Surface assembled in 2190ms`, `Composer assembled with 3 sections`, envelope v0.9.1, no errors.
  Tab gate through the tunnel: Composer → Product → Development → Console all switched, no errors,
  no orphan iframes, cards back (`Console clicked → intent: render-console (direct, no gate)`).
- **A real Run was exercised end-to-end** through the moved pipeline: `run-requested` with 3
  sections → `Run held for review` → `Run stays held — she blocked it`, with Grace returning the
  five fixes for an unsaved package that has no Agent/User role. 2 model calls. The owner confirmed
  the guard is correct: a Run requires a saved package and prompts.
- `WritingAreaIndex.tsx`: **8,535 lines** (from 12,055 at the start of the pass; −3,520).
- Next by size: the 867-line JSX return (needs components, not a hook), `handleSavePrompt` (256).

## 2026-10-21 (cont.) — the save-handler move was REVERTED; one more block moved

- **Reverted, and why:** moving `handleSavePrompt` into a hook broke evaluation order — the original
  arrow referenced `assembleSurfaceWithAI`, `handleConversationChange` and `surfaceTitle` lazily (it
  runs later), while a hook call reads them **during render**, so those three were in their temporal
  dead zone (`TS2448 used before declaration`). The whole statement was restored byte-exact from the
  generated module and the module deleted. Shell back to its previous size; typecheck clean.
  Lesson for the next pass: a `const fn = async () => …` may only be moved **below** every value it
  closes over, or not at all.
- `frontend/src/canvas/useRestorePackageWorkspace.ts` (217 lines) — the 193-line effect that restores
  a package's column widths, carried places and column on open. 9 deps.
- `WritingAreaIndex.tsx`: **8,535 → 8,346 lines** (from 12,055 at the start; −3,709).
- Verified: typecheck clean, build 4.29 s. In-room re-test of this last effect did not land on the
  intended path (a click opened the Development room instead) — it is unproven in the browser and is
  recorded as such.
- Parked by the owner until the refactor is done: per-tab consoles, the Design tab's own package and
  the new session CRUD path — see `console/PER-TAB-CONSOLES-2026-10-21.md`.

## 2026-10-21 (cont.) — design preview out; the decomposer no longer trusts a typed line

- Two hand-typed end lines were **one line short** and left a statement's closing line in the page
  (the save handler at 4100, the design preview at 6821). Both were repaired immediately from the
  generated module and the tree typechecks; the save handler was then fully reverted for the
  temporal-dead-zone reason recorded above.
- The decomposer now resolves a statement's end **from the TypeScript AST** when the end is passed
  as `0`/omitted — `resolveEnd()`. Hand-typed ranges are no longer used.
- `frontend/src/design/useDesignPreview.ts` (193 lines) — the design-preview callback (175 lines),
  moved to the design folder, 1 dep (`setDesignTree`).
- `WritingAreaIndex.tsx`: **8,346 → 8,173 lines** (from 12,055 at the start; −3,882).
- Verified: typecheck clean, build 4.37 s. Browser re-test of this effect: not yet run — recorded as
  unproven, and the next pass should exercise a Design-tab preview.

## 2026-10-31 — the approval flow's plan is filed here; nothing is built

- `console/approvals/APPROVAL-PIPELINE-2026-10-31.md` — the plan for the Design room's Figma
  ingest to pass through three gates: the designer validates the ephemeral preview, one named
  reviewer decides, and the designer's final approval commits the component to the Lit catalogue.
  Nothing in it is implemented.
- The six measured obstacles, each with the line that proves it: the preview is the only copy and
  is deliberately only ever one (`routes/figma.py:770`, `:772`, `:1092`); the Approve button is
  the catalogue write (`IngestModal.tsx:1012` → `routes/figma.py:7605`); no package has ever been
  anything but `status = 'Active'` (339 of 339); another person cannot see a card
  (`prompt_sessions_api.py:821-823`); there is no activity to narrate (`prompt_history` 0,
  `audit_logs` only chat queries); and `GET /api/auth/users` is open to every caller while
  `ADMIN_ROLES` is unset (`deps.py:298-302`).
- Recommendation on record: two tables, `design_drafts` and `draft_reviews`; the draft is stored
  because it must reach another person on another sign-in and survive a restart; the preview stays
  ephemeral, unchanged.
- **Revised the same day, on two owner corrections.** The right-hand column is an output surface
  and not a conversation (`design/ONE-CHAT-PER-TAB.md`), so the review loads into that surface and
  there is no approval dashboard: the card's existing status tag carries the stage, the buttons are
  added, and a modal appears only for a signature. And the supplied application is a reference
  point, not a model — its route is not adopted. The build order now begins with the seat split,
  because one seat file serves five Design tabs (`rooms/design/chat/design-chat.ts`, 295 KB) and an
  approval surface written there would appear in all of them. The trail is the truth: the draft's
  state is written only by the transaction that appends the decision.

---

## 2026-11-10 — the console chat is never at zero, and its tools come from the inventory

**What was seen.** Deleting the console's conversation left the seat on the deleted id: the
thread drew a 403, the conversation count fell to zero, and no greeting came. The seat's
`conversation-change` was also being ignored by the room, so the stale bound id was written
back over every move the seat made.

**Fixed, from the design seat's lifecycle.** The seat's conversation-change now names its
surface, the last delete re-takes the console's own arrival (not a package's `resume`), the
greeting waits for the conversation the ensure creates instead of speaking into no thread, and
the delete only moves to a live conversation of the same tab — so deleting the chat can never
land the chat seat in the approvals thread. A new default is `Console — Chat`, like the ones
around it.

**Browser-verified.** Delete the chat conversation (approvals still present): a new
`Console — Chat` is created, bound, and she greets into it within a few seconds. Press
`Figma ingest`: the turn is written, the surface re-assembles with no model call, and 8 design
cards appear under `Figma ingest · recent activity · 8 cards`. Reload: the same set replays and
the greeting and the choice are both still in the thread.

**The option is inventory, not prose.** `/console/tools` is bound to the seat; the greeting
draws one action button per entry. The greeting prompt no longer asks the model to emit a link,
and a stored greeting that already has one is not duplicated. Adding a tool to the inventory
adds a button.

**Grippers.** The column edge and the input-height grip already worked. The readout, the
conversation bar and the footer now have the design seat's dot-band pull: drag a band down and
that box grows by the hand's travel, taking the room from the box below; the output card keeps a
120px floor. The footer's pull takes its height out of the chat input and gives it back, within
the input's floor. A band's click is stopped, so pulling the dots never opens the conversation
list.

---

## 2026-11-10 — the console chat is sovereign, and the tabs are its filters

**The split.** The console chat no longer draws the shared chat parts. Its column, header,
messages, action bar, input, tray, rail, fold, dropdowns and readout are console-owned copies
under `frontend/src/rooms/console/chat/parts/`, with `console-` tags and their own CSS. The
console's chat palette and the fold's design tokens are declared on the seat's own host, not read
from a global chat stylesheet. A change to the Composer's or the design seat's chat cannot clip,
resize or recolour this column. The parts are the console's to evolve; the design tab is the
pattern (a parts folder, separate styles, no shared tag).

**The tabs are filters.** Chat, Tools and Approvals each list only their own conversations —
`conversations.tab` is the key — and each has its own bound thread in
`/console/tab_conversations`. Chat no longer carries the approvals or tools rows. Deleting a
tab's last row recreates that tab's default (`Console — Chat`, `Console — Tools`).

**The cards follow the tab, by assembly.** Pressing a rail tab asks the assembly for that tab's
cards with `cards_only`. The room writes only `/cards` and `/console/query` into the tree it
already holds — no `updateComponents`, so the chat element, its conversation and its thread are
not replaced or reloaded. Tools returns the eight Figma ingest cards and the plan
`Tools · Figma ingest · recent activity`; Approvals returns the supervisor queue (none waiting
today) and `Approvals · waiting on you`; Evals and Settings have no card set yet and say so;
Chat restores the whole library. No model call. When the tool inventory grows, the tab's plan
grows with it.

**A reply cannot pull the seat back.** If the person deletes or switches conversation while a
turn is in flight, the response is not adopted into the new thread. That race was the last way
the seat could be left on a deleted id while a fresh default sat unused in the list.

**Verified in the browser.** Chat lists one chat row; Tools lists one tools row and shows the
eight Figma cards; Approvals lists one approvals row. Deleting the chat row mid-greeting creates
`Console — Chat` and greets into it; deleting the Tools row creates `Console — Tools`. No errors
on a fresh load.



---

## 2026-11-10 — "number two" opens the second card

**What was missing.** The chat could filter the left cards but could not act on them by position.
The owner's loop ends with *"number two"* opening the second card.

**What it does now.** The console seat recognises a whole turn that is an ordinal — `number two`,
`2`, `the second one`, `open the second card` — and resolves it against the cards currently on
the left: the filtered tab set or the last directive's set. It writes the person's turn, confirms
`Opening 2 — "<title>"`, and opens that card through the same `card-open` path a click uses. No
model call. A number the set does not have is answered in the thread instead of being sent to
her; a sentence that merely mentions a number is still a sentence.

**Verified.** After `Figma ingest`, `number two` opened `prompt-input-section-agent-role` (the
second of the eight) in the Design room; the user turn was written to the chat conversation; no
`/api/teacher/query` was made.

**Next.** A5 — dragging a card into the input as a reference — and the Tools/Approvals
greetings (T2/T4).


---

## 2026-11-10 — the chat knows the cards on the tab it is standing on

**The gap.** After clicking Tools, the chat could not answer "what cards are showing?" — the
tools thread was not drawn, and the model was shown a library heading rather than the tab's set.

**Now.** The Tools tab draws the same chat thread as Chat and Approvals (the old static ingest
list is gone). Every turn carries the visible set as `CURRENT WORKSPACE`: the tab's name, the
cards currently on the left, in the order the grid draws them, with each card's facts and id. A
question about what is showing is answered from that list. The tab's cards-only assembly ignores
the last turn in the thread, so asking a question cannot re-plan the left column to "all cards";
a control tag in her answer is stripped and, on a tab, not allowed to reassemble the surface.

**Verified.** On Tools: eight cards, plan `Tools · Figma ingest · recent activity`; asking "which
cards are showing?" answers with the eight titles in order and leaves the tab, the eight cards and
the plan line unchanged. The question and answer are written in the Tools conversation.

**The conversation is the one the default open made.** The Tools thread used to show replies that
were not in its conversation: a greeting sent before the row existed was answered but not written
down, so it lived only on screen. The console now follows the design tab's default-open order —
read the tab's list, create a row only when the list is empty, move into it, wait for the id, then
greet. Deleting the last conversation re-takes the arrival, the default open makes the next row,
and the greeting is written into it.

**QA, run in the browser.** Delete `Console — Tools`: a new `Console — Tools` is created with one
assistant greeting (stored in the new conversation), the plan stays `Tools · Figma ingest ·
recent activity`, and the eight cards stay. Reload: the same greeting is read back, not said
again. The same delete/reload passes on the Chat tab. No 403s and no duplicate greeting.


---

## 2026-11-10 — Approvals has its own hello

The Approvals tab now greets from its own conversation, in the queue's words: it says this is the
supervisor queue, says plainly that nothing is waiting today, and asks what to review. The plan
line reads `Approvals · waiting on you`; the left column is the (empty) queue, not the library.

The same lifecycle as Chat and Tools: the greeting is a stored assistant turn in the Approvals
conversation, not a local line. Deleting `Console — Approvals` re-takes the arrival, the default
open creates the next row, and the greeting is written into it; reload reads the same words back.

**QA, run in the browser.** Approvals → greeting and plan; delete the row → new
`Console — Approvals` with one stored greeting; no errors. The Tools and Chat delete/reload checks
still pass.

**Parked, not next.** A5 drag-to-reference is in this plan's build order but was never a
requirement; the owner said they never asked for drag-and-drop. It is parked. The remaining
per-tab work is the full tool inventory (unbuilt tools) and each tab's shown-set namespace (T5).


---

## 2026-11-10 — the thinking beat on every answer, including quiet arrivals

The design seat's `_send` opens the work card for **every** answer — the person's typed turn and
the app's own silent greetings. The console seat still opened it only for typed turns, so the
Tools and Approvals greetings landed with no thinking beat; a real model answer with an unseen
wait reads as injected text.

The console now follows the design's rule. On a fresh Tools conversation the thread shows
`Thinking… Waiting for her reply`, then her greeting, then `Worked for 3s`; the greeting is one
stored assistant turn in the new Tools conversation. Deleting and reloading reads it back.

**Still structural, not patched.** The console is one seat switching Chat/Tools/Approvals; the
design tab has a separate seat per tab (`chat-tab.ts`, `tools-chat.ts`) with its own conversation
module and greeting. That per-tab seat structure is the remaining gap (T6 / A6); this entry only
aligns the send/thinking rule and the greeting lifecycle.


---

## 2026-11-10 — the Chat button is Tools, not Figma ingest

The button from the Chat tab is the **Tools** door, not a tool's name. Figma ingest is only the
one tool that exists inside Tools today; the label stays generic so a second tool does not add a
second button.

- The Chat greeting appends `[Tools](action:tools)` from the rail's allowed tabs.
- A stored greeting written with the old `[Figma ingest](action:figma-ingest)` link shows **Tools**
  in the thread, and the old token is treated as the same door.
- Pressing it moves the chat to Tools, switches to the Tools conversation, and runs the Tools
  cards-only assembly: the left column filters to the eight Figma ingest cards, plan
  `Tools · Figma ingest · recent activity`. The Chat conversation is left intact.
- The room script now tells her to offer `[Tools](action:tools)` when a question is about a
  tool's work.

**Verified in the browser.** Chat showed one Tools button; pressed → Tools tab, Tools
conversation, eight cards. Asked "what is happening with Figma?" in Chat: her answer offered
`[Tools]`; pressing the answer's link made the same move. No model call for the press, no errors.

This wires the door into the current seat; the separate per-tab seat structure (own element and
conversation module per tab) is still the larger remaining piece.


---

## 2026-11-10 — a reload is the whole library again

The default screen was reading the last thing said in the chat as a standing filter. After
"what is happening with Figma?" the next load planned that sentence as a content search, matched
nothing, and drew **"No cards for this tab"** with zero cards. A conversation turn is not a saved
query.

The landing no longer plans the last turn. It reads all cards and sorts them **last modified
first** (`updated_at DESC`). Selecting a tab still narrows: Chat is all cards, Tools is the tool
work, Approvals is the queue. The tab press and the chat's own search are the filters; the landing
is the library.

**Verified in the browser.** Reload → 19 cards, no plan line, first card the most recently
modified; the empty message is gone.


---

## 2026-11-10 — the chat is the tab's search

A typed instruction is now a filter over the active tab's cards, not just a sentence for the
model. "show me the input ones" in Tools narrowed the eight cards to three, wrote
`input · 3 cards` in the plan line, and left the tab, the thread and the conversation where they
were. The next question — "what cards are showing?" — answered with those three cards in order;
the plan line and the tab did not move.

How it works: the seat sends the search words and the active tab to the room; the room runs the
same cards-only assembly it uses for a tab press, with `console_search`. The assembly searches
**inside the tab's base set** (Milvus filtered to that set's card ids, plus a title/description
match so an unembedded row is not lost), then returns the cards and the plan line. The chat
element is not reloaded.

A question ending in "?" is not a search: asking what is showing must never replace the set
being asked about. A reload is still the whole library, last modified first; a tab press is still
the tab's base set.

**Verified in the browser.** Tools: search → 3 cards, plan `input · 3 cards`; "what cards are
showing?" → the three titles in order, tab still Tools, plan unchanged. No errors.


---

## 2026-11-10 — T5 row 6: the search turn is written before the search

The tab search now has the record beside it. A search turn is written by the seat first; the
cards-only search carries that message id and records the set under the tab's namespace
(`tools` here) with the base card ids and the eligibility version. The teacher is told the turn
is already written, so the person's words appear once.

A failed pre-write or record is not hidden: the cards still narrow and the plan line says the set
was not recorded. Refresh is hidden for recorded tab searches until it can re-run inside the tab.

**Tested:** Tools "show me the input ones" → one `surface_turns` row, namespace `tools`, message
id = the user turn, 3 shown ids, plan `input · 3 cards`, base_ids 8; one user message, three
cards. Tools "seat one" → 2 cards/2 shown. Ineligible id → `Refusal`, no row. No turn id → cards
narrow, `record_error` said.

**Gaps:** active-set namespace, replay, ordinal, tab refresh, prune, idempotency; Chat namespace
test; measured search latency 10–16 s.


---

## 2026-11-10 — T5: recorded ordinal, failed turns not drawn, tab refresh, idempotency

- The ordinal's column line now names the `surface_turn_id` it resolved against.
- A failed turn is not drawn as a turn. An ordinal write failure shows only
  `Not saved — … The card opened, but this turn was not written.`; the recorded set is untouched.
  A failed reply is not drawn; a notice says so. A failed person's turn stays visible with a
  `not saved` mark.
- The landing and an unrecorded tab base are defaults; searches and refreshes are recorded sets.
- Tab refresh re-runs the recorded plan inside `base_ids`, writes a new row in the tab namespace,
  and updates the cards without a full assembly. `prune` keeps the active set per namespace.
- Re-recording the same message id returns the existing row; refresh is exempt by origin.

**Tested:** ordinal 2 → set `143c…` printed; forced ordinal write → only the alert, set unchanged;
base search captured the 8 base ids; refresh row `2dbd…` old intact, active moved; prune kept it
and Chat untouched; room refresh updated 1 card with no extra full assembly; idempotent record
returned `143c…`, count unchanged.

**Gaps:** row 6 fallback not re-run after the 137; general teacher persistence failure not forced;
end-to-end server refresh not run. Latency tracked in the MILVUS plan.


---

## 2026-11-10 — Chat tab restored; T5 close-out

The Chat tab is the whole library again. Clicking Chat no longer replays the last Chat search set;
it asks for the base library (19 cards, last modified first). Tools/Approvals keep their recorded
replay. An ordinal on the all-cards Chat view refuses instead of resolving a hidden search set.

T5 close-out: the row 6 failure path now draws the last recorded set (2) + error after a forced
pre-write 500, not the unrecorded 3; live server refresh wrote a new `tools` refresh row while the
old set remained; both row 8 persistence failures were forced (assistant reply not drawn, notice;
person turn marked `not saved`, reply drawn, notice); row 9 compares the drawn ids/order to the
recorded `shown_ids` and says so in the context and plan line when they differ.

All four requested tests pass. Latency remains in the MILVUS plan; gaps listed in PLAN.md.


---

## 2026-11-10 — Phase 5 tool inventory starts

The console's tool inventory is now its own registry (`backend/console_tools.py`) instead of a
hardcoded Figma-only button sentence. Figma ingest is `available`; expected size 15; status and
entry travel with each tool. `/console/tools` and the Tools greeting read the registry, so adding a
tool is a data change. Tests: backend registry tests; frontend formatter tests (available, added
entry/status, empty inventory).

Gap: the 14 unbuilt names are not supplied; the greeting does not invent them.


---

## 2026-11-10 — Phase 5 tool selection starts

The tool registry now resolves a name or description (`resolve_tool_selection`) and refuses an
unbuilt/unknown choice in words. Tests: available Figma by name/description; fixture not-built
refused; unknown names list only real available tools. The Tools greeting offers buttons only for
`available`; an unbuilt token is refused by `_applyConsoleTool` with no assembly and no cards.

QA rows 13 (partial inventory said, not filled) and 14 (unbuilt press refused; fixture tested,
pending real names) added.

Gaps: 14 production tool names; typed-description wiring; dedicated Tools work view; non-empty
Approvals wait list; UX reference.


---

## 2026-11-10 — console conversations open in the design seat's card

The main console's Chat conversation card now uses the design seat's header structure and list:
the count, `+` new-conversation mark and history mark are the bar; the conversation rows
(title, time, trash) are inside the same card; closed is the bar, open grows to the rows. The list
scrolls in the card body. The console's separate list box below the bar is gone. The structure is
the design header copied to `console-chat-header` and the design chat template/list styles copied
to the console seat.

**Verified in the browser:** closed bar; press → one card, `1 Conversation`, `+`, history mark,
row `Console — Chat` with time/trash; shell 68px, list 30px; no separate box. The verification
screenshot was a temporary QA artifact and is not committed.


---

## 2026-11-10 — conversation rows are flat

Removed the drop shadow from the conversation row tile in the console chat list. Both the Chat and
Tools rows now compute `box-shadow: none`; the row's fill and radius remain. The conversation
card's own inset frame is the design card's, not the row's shadow, and is unchanged.


---

## 2026-11-10 — conversation lot pointer, click and drag

The conversation lot now shows `cursor: pointer` and closes after a drag. The grip shows `ns-resize`;
dragging it down sets the card open and grows its shell (38 → 108 in the test). A bar click clears
the drag's inline height, so open/close always wins over a previous pull.

**Verified:** cursor `pointer`/`ns-resize`; click 38→68→38; drag 38→108; click after drag 108→38;
no errors. QA checklist row 16.


---

## 2026-11-10 — public demo build

The frontend was built (`npm run build`) and the preview on `:4173` was restarted behind the
existing `studio` ngrok tunnel. Public page, `/api/config`, and the latest hashed asset were
verified; the console loaded 19 Chat cards after the PIN. The top-level README was not changed.
