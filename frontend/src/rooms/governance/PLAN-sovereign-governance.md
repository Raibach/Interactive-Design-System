# PLAN — the Governance room becomes its own box, and its chat its own element

> Written after reading `rooms/governance/`, the shell's governance block, the sandbox's ground
> rule, the tab gate's governance branch, the shared seat's governance machinery, and the two
> typecheck errors that sit on the boundary. Every claim below was read in the code.

> **Executed 2026-10-24.** `GovernanceBox`, `GovernanceRoomContainer` and
> `useGovernanceTrace` are in the room; the shell keeps only the left nav and the box mount
> (4,169 lines). The room's own seat was already transferred. Sessions is no longer in the left
> nav; it is the chat panel's tab. The filter exploration is `PLAN-chat-as-filter.md`.

## What the person will experience

The person clicks Governance and the room they know appears: the wave behind both columns, the
left navigation, the embedded application easing in, the chat column closed with its rail, its
traces arriving in her view slot when a trace is selected. Nothing about that experience changes.

What changes is who the room answers to. Its ground, its gate, its selected trace, its trace
views, its seats and its grip become the room's own. The chat in the right column becomes the
Governance room's own element — the same conversation, the same package, the same voice — instead
of the shared seat every room draws. The shell keeps only the decision of which room is on screen,
and the left navigation it was told to keep.

## Why Governance next

- Its component (`GovernanceRoom.tsx`, 215 lines) and both of its wiring hooks
  (`useGovernanceRoom.ts`, 647 lines; `useGovernanceChrome.ts`, 155 lines) already live in
  `rooms/governance/`, so what is left in the shell is state, not behavior.
- It carries its own application, like Product, and its own package and conversations, like a
  package's seat — but it has no model-assembled surface (`render-governance` has been unwired
  since 2026-10-08), so no server change is in this step.

Development is mechanically smaller — 31 references in the shell against Governance's 123 — but
it is a later job. The Composer is the hardest, because it is the shell's own default room.

## What the shell holds today

Read in `pages/WritingAreaIndex.tsx`:

- Fifteen declarations that are all the room's: the gate flag, the grip flag, the trace signature,
  the trace-elements tick, the gate's ceiling timer, the seat-settled flag, the tree and its
  renderer, the layout, the seat, the evals seat, the embed, the trace elements and selection
  refs, and the composer-package ref.
- Two hook calls, `useGovernanceChrome` and `useGovernanceRoom`.
- The opening effect with the ten-second ceiling (`GOVERNANCE_GATE_MAX_MS`).
- The ground branch: the wave image `data-wave4-flipped.webp` at cover/centre over `#2b2635`.
- The room's render inside the sandbox.
- The unwired `assembleGovernanceSurface` — moved to `useGovernanceSurface.ts` (2026-10-24); it
  is the room's door now and no longer in the shell.
- Two boundary names that no longer exist on the other side: `dropGovernanceGateWhenAllLanded` is
  passed to a hook that does not declare it, and `governanceGateDown` is passed to a room that
  does not accept it. These are two of the project's sixteen standing typecheck errors.

## The room's chat today

`useGovernanceRoom.ts:568` binds the **shared** `<chat-panel>` by hand, with eight properties:
`sessionId`, `conversationId`, `packageTitle: 'Governance'`, `allowedTabs`,
`disabledTabs` (`tools` until a trace is selected), `tabLabels` (the fourth button reads
"Preview"), `instructions` (the room's own sentence), `graceLiveContext: true`, and
`tracePrompt: false`. It then marks the arrival (`kind: 'governance'`, addressed to the room's own
session) so she speaks on landing when the thread is empty.

So the room already owns its conversation and its words, but it draws the same element as the
Composer, the Console and a package's seat. That element still carries the Composer's writing
acts, Product's settings, the Console's library and probe, the Design room's teaching call, and
the Console's reassemble command — all of it inside the file the Governance seat is drawing today.

## What this cut does not change: the measurement

*(Confirmed after the owner asked whether Langfuse measuring the whole application is a glitch in
the plan. It is not a glitch in this cut, but it does bound what sovereignty can mean here.)*

**What is measured, and by whom.** Every model call in the application goes through one function,
`query_llm` in `backend/grace_gui.py`, and each call opens one Langfuse generation carrying the
token counts and the exact cost. The record states plainly that it carries "never prompt bodies,
answers, metadata, tags or stage trees" (`grace_gui.py:28`). So Langfuse measures the
application's model spend, in every room, one row per request. It does not measure the interface,
the rooms' state, or what a person did on screen. The same numbers are also kept in the studio's
own `usage_metrics` table — the comment's words: "the cost record is ours; this is the same
numbers, handed to the application so its dashboard can show them."

**How this room reads it.** `lib/governance-trace-source.ts` does not ask our backend. It speaks
the embedded application's own internal tRPC (`events.byTraceId`, `events.batchIO`) same-origin
under `/governance`, as the signed-in person, because in Langfuse v4 `events_only` mode the public
read API is refused even with keys. The room is therefore a window onto the whole application's
model ledger, by design.

**What that means for this plan.** The cut moves where the reads live — from the shell's hook into
the room's container — and does not change what they observe. The dependency is on the embedded
application and its protocol, not on the shell, so nothing in the steps below is affected. The room
becomes sovereign over its own interior while its subject remains the whole application; those are
different claims and this plan only makes the first.

**If "full sovereignty" is meant to include independence from Langfuse**, that is a separate
project with its own prerequisite. Our `usage_metrics` already holds the cost and token numbers,
but the trace tree and the observation detail exist only in Langfuse's events store. A native room
would need our own trace store first; the trace source's own note anticipates exactly that ("when
the room goes native (Stage 3), the reads stay here and only the transport changes"). That is not
this cut, and it should not be smuggled into it.

## The one end state

The Governance box owns its ground, its own seat, its gate, its state, its trace views, its grip
and its frame door. The shell keeps the tab branch, the box mount, and the page-level navigation.

## The steps

**Step 1 — the room's own ground.**

Create `rooms/governance/GovernanceBox.tsx`. It owns the wave and the floor colour exactly as the
shell does today (`data-wave4-flipped.webp`, cover, centre, over `#2b2635`), carries
`data-room-box="governance"`, and mounts the container inside it. The room's existing
`data-room-root="governance"` stays inside `GovernanceRoom`, so the tab gate keeps hiding the same
node it hides now.

**Step 2 — the room's own chat element, by the same surgery as the Console's.**

Create `rooms/governance/governance-chat-panel.ts` as a whole copy of
`components/lit/chat-panel.ts`, retagged `governance-chat-panel`. Every drawing line is kept.
Then sever, rather than guard:

- the probe that asks whether this seat is the Console's, and every console branch it feeds — the
  console hello and the library (`consoleCards`);
- the Composer's writing acts: writing into prompt sections, inserting a tool, the description,
  merging seats, moving a tool, replacing a seat, removing a seat, running, saving, setting the
  title, Apply-all, the wireframe build and the node edit — and the held-Run review that goes
  with them;
- the prompt column and the compiled output from her workspace context (this room never binds
  them);
- Product's settings and its two pieces;
- the Design room's teaching call;
- the Console's reassemble command — a Governance seat that emitted it would ask the Console's
  room to rebuild itself.

What stays is the room's own: the governance hello (only a thread with nothing in it is greeted),
its package's name and conversations, its history and new-conversation path, the governance
reports under Approvals, and the TRACE ON SCREEN block fed by `governanceTrace` and
`governanceObservation`, with `composerPackageId`, `disabledTabs`, `tabLabels`, `tracePrompt` and
the seat's view slot where the room mounts the trace tree and detail.

The element is imported by the container, so the tag exists before the room draws. No catalog or
registry entry is needed: this seat is mounted by the room, never named by a surface, exactly as
Product's and Design's copies are.

**Step 3 — the room's own container.**

Create `rooms/governance/GovernanceRoomContainer.tsx`. It owns every governance declaration, both
hooks, the opening effect with its ceiling, the room's `useGovernanceSurface` door (already
moved to `useGovernanceSurface.ts`), and the
binding of the room's own seat (the eight properties above, now written to
`governance-chat-panel`). It renders `<GovernanceRoom>` with the two flags the room actually
accepts: the grip overlay and the evals seat.

**Step 4 — the frame door, the one boundary the nav needs.**

The left navigation stays in the shell: it replaces the shell's own rail on this tab and sits in
the header band, and the owner's instruction was to keep it. But it must still drive the room's
frame. So the container publishes two facts and nothing else: the current path, pushed up when it
changes, and one navigate command held in a ref by the shell. That replaces the five refs the
chrome hook would otherwise have to hand across the boundary. The trace selection does not cross:
it feeds the room's own seat and stays inside.

**Step 5 — the shell lets go.**

Remove from `WritingAreaIndex.tsx`: the governance ground branch, the fifteen declarations, both
hook calls, the opening effect and its ceiling, `dropGovernanceGateWhenAllLanded`, the
`governanceGateDown` prop, the already-moved `assembleGovernanceSurface`, and the gate's
`setGovernanceGateDown`
dependency. Keep `isGovernanceView` for the navigation switch, and mount the box outside the
sandbox. The sandbox stops rendering for Governance the way it already stops for Product and the
Console.

**Step 6 — verify in the browser on `localhost:5001`.**

- The room draws with its wave over `#2b2635`, both columns and the strip, edge to edge.
- The left navigation still lists the room's sections, marks the active one, and drives the
  embedded application's route.
- The chat is `governance-chat-panel`; no `chat-panel` exists in this room.
- Her package and conversation are the room's own: the history loads, the conversation list is
  hers, and the rail reads `chat,sessions,tools,approvals,eval,settings` with the fourth button
  labelled "Preview" and dark until a trace is selected.
- She speaks the governance hello on an empty thread, in the room's own words, and not a package's.
- Selecting a trace fills her TRACE ON SCREEN context, the tree and the detail, and the tree's own
  clicks still reach the detail.
- The chat strip's grip does not freeze when the hand crosses onto the frame.
- The ease-in still holds the frame at zero until the application's own header exists, and the
  ten-second ceiling still reveals it if that never comes.
- Leaving Governance hides its root in the click's frame; the Composer, Console and Product are
  unaffected.
- `npm run typecheck`: fourteen errors, down from sixteen, because the two boundary errors are
  gone and no new ones appear. `npm run catalog:check` unchanged.

**Step 7 — the record.**

Write each step into `rooms/governance/CHANGELOG.md` with what was measured.

## Not in this step

- The Evals seat (`evals-chat-panel`) stays shared. It is a second element with its own
  machinery, drawn by this room on its Evals tab, and it deserves the same surgery on its own
  evidence.
- The sandbox itself stays for the Composer and the Design room.

## The traps I am watching

- `graceLiveContext` must keep being bound to TRUE with the seat's own instructions, or the seat
  refuses every turn and the failure is loud in the thread rather than silent.
- The navigation's highlighted path and the embedded application's route are one fact seen twice;
  the door must not let them disagree.
- The room's root already lives inside `GovernanceRoom`; the box must add only `data-room-box`.
- The embedded mount's `colorScheme: 'dark'` and the `no-embedded-params` attribute are
  load-bearing and travel unchanged.
- The shared seat's `_seatIsConsole` also decides the trailing button's direction and which
  conversation rules apply. In this copy the seat is a package seat always, so those branches go
  with the probe rather than being pinned to a value.
