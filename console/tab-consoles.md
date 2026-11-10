# Phase 5 — the console's tabs are consoles, not lists

2026-11-10. This plan was split out of the console plan because it is a different job from search:
each tab is its own conversation, with its own default, its own greeting and its own work. The
main plan ([`console-search-plan-2026-11-10.md`](console-search-plan-2026-11-10.md)) keeps the
search, memory and Phase 4; Phase 5 lives here.

## The correction this plan starts from

The Tools tab is not a list of cards. It is a conversation. The list that shipped — live ingested
cards, newest first, read-only — is a **stopgap**, and it is dead: it cannot be talked to, it asks
nothing, and it answers nothing. A person landing on Tools should be greeted, asked what they are
working on, offered the tools that exist, and taken to the work — not shown a static column.

The same is true of every tab. A tab is a seat: its own conversation, its own default, its own
greeting, its own work.

**Chat is the library.** A Chat search records under `console` for audit but does not become the
active set of the Chat view; reopening Chat shows the library, an ordinal on the library refuses,
and the hidden search set is never used behind the all-cards view. Tools and Approvals replay
their own recorded sets.

## What already exists to replicate — the design seat

The design seat has been doing this since 2026-09-24; it is the reference, not a sketch.

| Piece | Where | What it does |
| --- | --- | --- |
| Default conversation creation/binding | `prompt_sessions_api.get_or_create_console_session` + the design seat's arrival path | a seat always has a conversation, and a deleted one is recreated on the next arrival |
| The greeting | `chat-panel._greetIfArriving`, `shared/arrival.ts` | she speaks once per arrival, into the seat's own thread, when there is nothing to read |
| Per-tab conversations | `conversations.tab`, `get_or_create_console_tab_conversation` | a tab's thread is a row of the same package, not a new store |
| Tab greeting copy | the seat's own instructions | the Tools tab greets about tools, not about the console's index |

The console's surface already carries the same greeting machinery
(`console-chat-panel._greetIfArriving`). The main console's default conversation was built and
tested in Phase 4. What is missing is **per-tab**: each tab's default, each tab's greeting, each
tab's work view.

## The model for every tab

1. **Its own conversation**, `conversations.tab = <tab>`, under the console's package, created and
   bound on arrival, recreated if deleted.
2. **Its own greeting**, in the tab's own words, asking the question that tab exists to ask.
3. **Its own work view**: what that tab does, not a card dump.
4. **Its own turn records** (`surface_turns.namespace`), so a tab's shown set is the tab's.
5. **No shared chat element.** Same look, separate files and state. A tab that borrows another
   tab's chat breaks both.

## The tabs, one at a time

### Tools — the first rebuild

The tab's job: find out what tool the person is working with, and take them to that work.

- **Greeting.** *"Hi — this is the tools seat. Figma ingest is the one tool we have built; the rest
  are listed below as not built yet. What are you working on today?"*
- **Tool inventory.** A small, console-owned registry: name, one line, status (`available` /
  `in build` / `not built`), entry point. Figma ingest is the one `available`. "15 tools" is the
  expected size; the inventory holds what exists and names what doesn't. **Started 2026-11-10:**
  `backend/console_tools.py` is the registry; `/console/tools` and the Tools greeting read it.
  Only Figma is named; the 14 unbuilt names are not in the repo yet — they are a data gap, not
  invented entries.
- **Selection.** A name ("Figma ingest") or a description ("the thing that pulls a Figma frame in")
  resolves to a tool. Unbuilt is refused in words, never drawn as an empty tool.
- **The tool's work.** Once chosen: the ingest's own view — recent jobs, the cards it produced, its
  state. Today that is the ingested-cards list; it becomes the *content* of the chosen tool, not the
  tab's landing page.
- **The list today** is demoted: at most a "recent ingest" strip under the conversation, and removed
  entirely once the greeting works.

### Approvals — second

Its conversation already exists. It needs the greeting ("three cards are waiting on you; the oldest
is from Tuesday") and the wait list: cards in review, who sent them, what the audit says. The
inspection reports stay where they are. **Current:** the queue is the left card set (empty today),
the greeting says nothing is waiting; a non-empty wait-list summary (count/oldest/who) is not
built.

### UX — third

Deferred until the design seat's UX seat is understood well enough to copy its default. Do not
invent it now; the tab exists, its console does not. **Blocked:** the design UX reference has not
been supplied; no UX seat code written.

## Backend

- `get_or_create_console_tab_conversation(uid, tab)` already creates a per-tab thread; the tab
  surfaces call it on arrival and bind the pointer, the same way the main console now does.
- Per-tab greeting instructions live with the tab's own code, not in one shared constant.
- The tool inventory is its own small registry (module or table) — not the prompt-tools table
  (`tools`), which is a different concept (tools a prompt can call, not programs a person opens).

## Milestones

| # | Milestone | Test |
| --- | --- | --- |
| T1 | Every tab has its default conversation, created and bound on arrival, recreated after deletion | delete the Tools conversation → open Tools → a new one exists and is bound. **Passed 2026-11-10 for Chat, Tools and Approvals.** |
| T2 | The Tools tab greets and asks, with the tool inventory | opening Tools says the greeting, names Figma ingest, says the rest are not built. **Core passed 2026-11-10:** the Tools thread draws, greets once per stored conversation, and delete → new default → greeting reloads. **Inventory started:** registry + data model + dynamic greeting; only Figma is named. The 14 unbuilt names are the remaining T2 gap. |
| T3 | A tool selection resolves and opens that tool's work | "Figma ingest" → the ingest view; "the second one" → resolves, or refuses with the list size. **Started:** resolver tests pass for name/description; available-tool buttons under the Tools greeting; unbuilt fixture refused in words. The ingest work view and chat description wiring remain. |
| T4 | Approvals greets and lists what waits | opening Approvals says what is waiting and from whom. **Passed 2026-11-10 in the core form:** the Approvals thread greets from its own conversation, says the queue is empty today, and delete → new default → greeting reloads. The non-empty queue's who/from-what detail rides the same card context when cards are waiting. |
| T5 | Each tab's shown set is recorded under its own namespace | a Tools set and a Chat set never supersede each other |
| T6 | UX | only after the design seat's UX default is copied |

## Not in this plan

- State-transition actions (approve, queue, reject, remove) — Phase 6 of the main plan.
- The search/memory/ranking work — the main plan.
- Any shared chat element across tabs. The pattern is copied; the element is not.

## What this removes from the main plan

The main plan's Phase 5 section is replaced by a pointer here. Its Phase 6 (actions) stays.

## Known stopgap to clear at T2

`frontend/src/rooms/console/console-chat-panel.ts` `_ingestedCardsView()` — the live, read-only,
uninteractive list on the Tools tab. It was useful as a placeholder; it is dead as a destination.
T2 replaces it with the greeting and the tool inventory; the list becomes the chosen tool's content.
