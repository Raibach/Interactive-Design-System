# Governance room — the chat lanes, and what is left

*(Owner, 2026-10-23. The law and the record are in `governance/QUERY-LANES.md`; this is the
room's own to-do list.)*

## The law, in one line

**Seat = tab.** The Chat tab is a conversation. Every other tab is a lane: the person's words in,
a Langfuse filter out, validated, executed, and the rows drawn in the output column. **No reply is
written.** The input's own label changes with the tab — on Evals the send button reads
**Search Query**, not Send — because the act is a search, not a message.

## The three patterns (owner, 2026-10-23)

1. **Conversation** — the Chat tab. She replies, and the thread is the record.
2. **Query lane** — **Evals is the reference and already has it**: its send button reads
   **Search Query**, the words become a filter, the rows are the answer, and no reply is written.
   The same pattern is what the Console borrows for filtering; for this room, Sessions is the next
   lane.
3. **Console — a third pattern, and it does not count as a lane.** The results sit on the left, so
   she talks about them as well as organising them. A lane's silence would be wrong there; the
   Console is counted separately from the lanes.

## The navigation direction (owner, 2026-10-24)

The left navigation is being cleaned up so that navigation can be customized for each application.
As each tab is cleaned, the chat panel absorbs most of that tab's functionality; the application's
own left-nav entry is then unnecessary. Sessions is the first: it is the chat panel's own tab, and
the left nav no longer carries a second Sessions interface. This is one tab at a time, not a sweep.

## The saved conversation is the preset (owner, 2026-10-24)

The chat is the primary filter. The Sessions input is a filter search, the rows are the answer, and
the saved conversation is the preset: its ID is the key, its title is the person's words, and its
stored filter is the view. Selecting it replays the query. The target is the application's **full**
sessions filter vocabulary — the app's Columns, Filters and sort controls leave the interface only
once the chat covers them (Phase 3b). The exploration is `PLAN-chat-as-filter.md`; the lane's next
wiring is items 1–2 below.

## What is built

- The **Evals lane** works this way today: `_onMessageSent` on `eval` calls `_submitEvalsQuery()`
  beside the `chat` fall-through that calls `_send()` (`components/lit/evals-chat-panel.ts`).
- The **sessions backend** is built: `POST /api/governance/sessions/query`, the catalogue at
  `runtime/governance/filters/sessions.json`, the query captured as a conversation on the session
  seat (title = the person's words, `tab: "sessions"`, the validated query in its metadata), and
  `POST /api/governance/sessions/query/replay`.
- The sessions list, its first-row selection and the purple highlight are live in the seat's own
  Sessions tab.

## To do

1. **Wire the Sessions input to the lane.** `_onMessageSent` on `sessions` must call
   `/api/governance/sessions/query`, not `_send()`, and bind its answer to `sessions-feed`:
   `queryRows` for the rows, `receipt` for the one-line receipt, `laneError` for a refusal.
   The working handler to copy is in `design/design-chat-panel.ts`.
2. **Wire the replay.** Selecting a saved conversation whose `tab` is `sessions` must call
   `/api/governance/sessions/query/replay` and draw its rows. The saved conversations are the
   presets; no separate preset store is needed.
3. **Department scoping.** The idea — a products person sees no development sessions — has no
   data behind it: the session groups carry user ids, and nothing maps a person to a department.
   This needs the mapping before a lane can filter on it.
4. **Phase 3b of the lane plan.** Remove the application's own Columns, Filters and sort controls
   from its list pages once the lane draws the rows (owner's word: *"remove it from the
   interface not remove it from the application"*). Until then, those controls and the lane can
   disagree.

## Why each tab's chat must be its own element

The buttons already change per tab — Evals says Search Query. Inside a tab there will be
subsections of the chat, and each type of chat will be its own `.ts` file. A shared seat is where
that behaviour was stripped before: a change made for one room's tab reached into another's. So
the Governance seat is copied and severed like the Console's, and each tab's lane lives beside it.
