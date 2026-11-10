# The console's chat column — the design seat's pattern, then the console's job

2026-11-10. This is the plan for the chat output column on the main console: first the interaction
pattern the design seat already proves, then the features that let it manage the surface and query
the data.

## 1. The reference is the design seat's chat column

Not the words she says — the column. The design seat's chat column has been through the failures
and kept the parts that work (THE_CONVERSATION_CONTRACT, C1–C9). The console's column is already a
copy of it; this plan makes that copy deliberate, and then adds what only the console needs.

The pattern, part by part, and where it lives:

| Part | What it is | Reference |
| --- | --- | --- |
| Column shell | the right column: resizable, collapsible, the conversation's home | `chat-panel` (design), `console-chat-panel` (copy) |
| Rail | chat / trace / tools / approvals; a tab is a filter, not a page | `chat-navigation-bar`, `allowedTabs` |
| Slots | `view` (a tab's own view), `content-header`, `status-content` (the seat's readout), the seat slot | `chat-panel` render, `_viewSlotted`, `_tabClaimant` |
| Conversation | header (title, status, actions), turns (role, alert, result, linked node), folds | `chat-header`, `chat-messages`, `chat-fold` |
| Inline actions | `[label](action:token)` becomes a button; pressing sends the token as the turn | `chat-messages._segmentsOf`, `_onActionSend` |
| Input | the bottom input + action bar + plugin tray; height dragged by a gripper | `chat-input`, `chat-action-bar`, `chat-plugin-tray` |
| Grip / drag | vertical drag of the input split; column resize; no reflow mid-drag | gripper handlers, `inputHeight` |
| Data feeds | trace and eval feeds drawn in the `view` slot as the work happens | `trace-feed`, `eval-feed`, `chat-fold` |
| Usage readout | tokens, cost, status under the seat's control | `status-content`, `a2ui:usage` |

The console's copy already carries the shell, the rail, the slots, the folds, the gripper, the
input and the usage readout. What it does not yet do is use them for the console's job.

## 2. What only the console needs

The design seat's conversation is about one package. The console's conversation is about the
surface: the cards on the left, the query that produced them, and the actions valid on them. So
the same column gets four additions, all inside the console's own files:

1. **The plan is a feed.** The query that produced the grid is drawn at the top of the column (the
   `content-header` / the plan line), with its count and its recorded turn. It is the console's
   equivalent of the design seat's trace: what the seat did, in words.
2. **Results are turns.** A set the surface showed is a turn of the conversation (Phase 4), so
   reopening reproduces it and "number two" resolves. The grid is the drawing; the turn is the
   record.
3. **Options are inline buttons.** When she asks a question — *"which tool are you working with?"*
   — the choices are `[Figma ingest](action:figma-ingest)` links, drawn by the existing action
   renderer, answered as a turn. The tool inventory supplies them; nothing is hardcoded per page.
4. **Drag to reference.** A card from the left column can be dragged into the input to refer to it
   by name ("this one"), which the directive then resolves to its id. The column's drag machinery
   already exists; this adds one drop target and one token.

## 3. The interaction loop this produces

1. She asks, in the column, with buttons: what are you working on?
2. The person presses `[Figma ingest](action:figma-ingest)` — a real turn, not a hidden intent.
3. The action resolves to the tool's work without a model call: the grid re-filters to the ingest's
   cards, the plan line says what was applied, the set is recorded as a turn.
4. The person says *"number two"* — the ordinal resolves against the recorded set, the card opens.
5. The open is recorded as an outcome (`surface_actions`), the read stays a read.

Steps 1, 3, 4 and 5 exist or are wired; step 2 exists in the renderer and in the send path and
needs the greeting to offer it (the current greeting explicitly says "Offer no buttons" — it is
wrong for this column and must change).

## 4. Milestones

| # | Milestone | Test |
| --- | --- | --- |
| C1 | The greeting offers the tools as inline actions; "Offer no buttons" is removed | landing on the console shows a clickable `[Figma ingest](action:figma-ingest)` |
| C2 | An action token resolves to the tool's work without a model call | pressing it shows the ingest's cards and the plan line says so |
| C3 | The plan is drawn as the column's feed (count, mode, missing) | the line above the thread states plan/count/missing |
| C4 | Results are turns; reopen replays the recorded set | reload shows the same set, no model call |
| C5 | Inline options from data, not strings | the tool inventory is the source of the buttons; adding a tool adds a button |
| C6 | Drag a card into the input to reference it | the drop inserts a reference the directive resolves to that card |

C1–C2 are the first visible step; C3–C4 exist behind the surface and need the column to draw them;
C5 is the inventory; C6 is the drag addition.

## 5. Rules that do not bend

- The column is the console's own files. Same look as the design seat's, separate machinery;
  sharing the element breaks both seats.
- No page-load injection of a scripted conversation. The greeting is a turn, written once per
  arrival, and the options come from the tool inventory.
- The model's output is an operation: a query, a set, an action. The column draws the record; the
  grid draws the result.
- A missing row, a refused action and a failed read are said in the column, never drawn as nothing.

## 6. What this plan does not cover

- The per-tab consoles and their introductions — [`tab-consoles.md`](tab-consoles.md).
- Search, ranking and memory — the main plan.
- State transitions (approve, queue, reject) — the main plan's Phase 6; this column only records
  `open` today.
