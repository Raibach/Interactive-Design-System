# PLAN — the Development room becomes its own box

> Written 2026-10-24 after reading `rooms/development/`, the Development block in
> `pages/WritingAreaIndex.tsx`, `development/CHANGELOG.md`, and
> `development/ops/WRITING-AREA-EXTRACTION-PLAN.md`. This plan changes no code.

## What the person will see

The person clicks Development and one room stands up: the paper lab tile behind both columns,
the OpenHands Agent Canvas in the left column, and Grace's chat on the right with its rail closed.
The room opens straight in, with no assembly gate and no cover. If the workspace is stopped, the
room keeps its ground and draws nothing; there is no fallback.

The room's chat is the Development room's own. It carries the Development package's conversation,
its own rail, and its own closing state; it never borrows the Composer's or Product's seat. The
OpenHands application is untouched: its house patch, its chrome, its panel colour and its
transparent ground stay exactly as they are.

What changes is ownership. The room's ground, its root, its refs, its package read and its seat
become the room's own. The shell keeps the Development button and mounts one box. The
`WritingAreaIndex.tsx` file no longer holds a Development ref, a Development hook call, a
Development ground branch or a Development arm inside the sandbox.

## Why Development next

The room's two files already live in `rooms/development/`: `DevelopmentRoom.tsx` is the pane, and
`useDevelopmentRoom.ts` is the behaviour. The shell still calls the hook, holds both refs, paints
the lab ground and renders the pane inside the sandbox. That is the same residue the Product,
Console, Design and Governance rooms have already removed. The Development tool is an application
of its own, not a model-assembled surface, so this cut changes where the room's frame lives, not how
the tool works.

## The WritingAreaIndex relationship

Read in the shell today, 4,154 lines:

| shell today | where it goes |
| --- | --- |
| `developmentLabBackground` import, line 33 | `DevelopmentBox.tsx` owns the lab tile |
| `DevelopmentRoom` import, line 56 | replaced by the `DevelopmentBox` import |
| `useDevelopmentRoom` import, line 57 | called by `DevelopmentRoomContainer` |
| `WorkspaceLayout` and `ChatPanel` type imports, lines 79–80 | removed with the refs; the room owns its types |
| `isDevelopmentView`, line 334 | removed; the room is the only Development fact |
| `workspaceBackground` / `workspaceGroundColor` / `groundSize` / `groundRepeat` Development branches, lines 353–365 | the Composer's values remain; the Development ground moves to the box |
| `developmentLayoutRef` and `developmentSeatRef`, lines 674–675 | owned by `DevelopmentRoomContainer` |
| `useDevelopmentRoom(...)` call, line 3391 | called inside `DevelopmentRoomContainer` |
| the sandbox's `headerTab === 'development'` arm, lines 4097–4099 | removed; the sandbox holds the Composer |
| the sandbox condition, line 4018 | add `headerTab !== 'development'` |
| the box mount beside the other rooms, near line 4139 | add `<DevelopmentBox />` for the Development tab |

The shell keeps the header, the tab button and the left navigation. It keeps no Development
state, effect, ref, hook, ground or render arm. The room's files grow; the shell must not.

The `ai-surface-sandbox` note that Development is a self-gated room is then stale as well. With
Design, Governance and Development all outside the sandbox, only the Composer mounts it. The
`SELF_GATED_ROOMS` set and its comments should be removed, and the spinner belongs to the
Composer alone.

## The sandbox is being retired

This plan removes Development from the shell's A2UI sandbox. It does not repair or extend that
sandbox. The direction is removal: every room becomes its own box, and the sandbox is the temporary
host the rooms leave behind.

After Product, Console, Design, Governance and Development, the sandbox holds only the Composer.
The Composer's own box cut then deletes `ai-surface-sandbox`, its slot routing, its `headerTab`
prop, the `SELF_GATED_ROOMS` set and the renderer branch, and the shell mounts only room boxes.
The Development cut must not add a new sandbox branch, a new slot rule or a new reason for the
sandbox to stay; it removes the Development arm and leaves the sandbox smaller.

The OpenHands application's own sandbox choice is a different subject. The tool's handoff notes
mention a local-versus-Docker sandbox for the engine. That is a tool decision and is not the
shell's A2UI sandbox; this plan does not choose it or remove it.

The shell line count is measured at execution. The expected cut is every line in the table above;
the plan does not claim a number before the measurement. The target is a smaller shell with no new
room code in it.

## The target folder

```
rooms/development/
  DevelopmentBox.tsx              the lab tile, the room box, the lazy room
  DevelopmentRoomContainer.tsx    the refs, the package read, the seat binding
  DevelopmentRoom.tsx             the pane: OpenHands left, chat right
  useDevelopmentRoom.ts           the closed-on-entry layout and the package read
  development-workspace.ts        the room's own copy of the shared layout
  development-chat-panel.ts       the room's own chat element
  development-voice.ts            the Development instructions (or a constant in the hook)
  PLAN-sovereign-development.md
```

The OpenHands tool itself is not in this tree. It stays in `development/` and runs from its own
engine. This cut does not move, restyle or rebuild it.

## The steps

### Step 1 — the box, the container and the shell cut

Create `DevelopmentBox.tsx`:

- it carries `data-room-box="development"` and owns the lab tile: `developmentLabBackground` over
  `#2b2635`, repeated, exactly the values the shell paints today;
- it mounts `DevelopmentRoomContainer` inside the box;
- it carries the key that keeps React from recycling the box between tabs.

Create `DevelopmentRoomContainer.tsx`:

- it owns `developmentLayoutRef` and `developmentSeatRef`;
- it calls `useDevelopmentRoom` with those refs;
- it renders `DevelopmentRoom` with the refs;
- it has no `headerTab` dependency: the room is mounted only while Development is selected, so the
  hook's work begins on mount and never runs for another room.

The hook's `headerTab` guard is removed. Its `useLayoutEffect` still sets `isThirdOpen = false` and
the rail list; its fetch still reads `/builder/development/room`; its bindings stay the same:
`sessionId`, `conversationId`, `packageTitle`, `allowedTabs`, `instructions`, `graceLiveContext:
false`, `tracePrompt: false`.

`DevelopmentRoom.tsx` keeps its existing pane and `data-room-root="development"`. Its left slot
stops painting the lab tile: the box owns the ground behind both columns. The OpenHands application
is already transparent when embedded through the house patch, so the paper tile shows through it.

In the shell:

- mount `<DevelopmentBox />` while `headerTab === 'development'`, beside the other room boxes;
- exclude Development from the sandbox condition;
- remove the Development arm inside the sandbox;
- remove the shell's Development imports, the `WorkspaceLayout` and `ChatPanel` type-only imports,
  refs, hook call, `isDevelopmentView`, the lab ground import and every Development branch of the
  shared ground;
- leave the Composer's ground and the Composer's sandbox unchanged.

Remove Development from `SELF_GATED_ROOMS`; with no self-gated room left inside the sandbox, remove
the set and its comments, and let the sandbox's spinner speak for the Composer.

Verify on 5001 before going further: the paper tile fills the room; the OpenHands canvas loads;
the chat rail is closed; the sandbox count is 0 on Development; the shell still mounts the
Composer's sandbox when the Composer is selected; the room's own conversation is the one bound.

### Step 2 — the room's own workspace wrapper

Copy the shared `workspace-layout` into `rooms/development/development-workspace.ts` under the
Development tag, exactly as Product copied `product-workspace.ts`. The copy is structural and
verbatim: the same columns, the same gripper, the same closed-third behavior. The room imports and
registers it; the shared `workspace-layout` is no longer mounted on the Development tab.

The room's `isThirdOpen = false` write stays on the room's own wrapper. The room's closed-on-entry
state is unchanged.

Verify: the canvas, the chat rail and the gripper draw the same; the shared `workspace-layout` is
absent from the Development page; the other rooms keep the shared one.

### Step 3 — the room's own chat element

Copy the shared `<chat-panel>` into `rooms/development/development-chat-panel.ts` under the
Development tag, whole, as the other rooms did. The room imports and registers it; the shared
`chat-panel` is no longer mounted on Development.

`useDevelopmentRoom` binds the Development element. The bindings stay: the Development package and
conversation, `DEVELOPMENT_SEAT_TABS` (no Versions), the room's title, the room's instructions,
`graceLiveContext: false` and `tracePrompt: false`. A Development turn goes to Grace's own
`/api/teacher/query` with the Development package and conversation, exactly as the shared seat
does today. The tool's own agent is not connected; that is a separate owner decision.

The shared chat parts — the header, the messages, the input, the action bar, the navigation bar,
the folds, the error banner — remain shared drawings. Only the seat is the room's.

Verify: the rail's tabs are the Development list; the thread is the Development conversation; the
input sends to Grace with the Development ids; no shared `chat-panel` exists on the page.

### Step 4 — sever the copy

Remove from `development-chat-panel.ts` only the code the Development rail and its package cannot
read:

- the Composer's writing acts and prompt-section writes;
- Product's tools, thread and settings;
- the Console's card library and probe;
- the Design room's teaching call and cross-room acts;
- Governance's trace and eval machinery, except what the Development rail's own tabs need.

Keep the thread, the conversation list, the room's own hello, the rail, the scroll, the grip, the
collapse, the repair view and the Development tabs. Keep every line a Development tab reads. The
rail's `tools`, `trace`, `approvals`, `eval`, `states` and `repair` views stay available; the chat
copy must not strip a view that the room still offers.

Verify after each removal: the rail still draws every tab; the thread still loads; the input still
sends; the build's typecheck stays zero; no other room's property or act remains.

### Step 5 — the shell sweep and the record

Re-run the shell audit:

- `DevelopmentRoom`, `useDevelopmentRoom`, `developmentLayoutRef`, `developmentSeatRef`,
  `developmentLabBackground`, `isDevelopmentView`, `openhands-room` and `DEVELOPMENT_GATE_MIN_MS`:
  no result in `WritingAreaIndex.tsx`;
- `DevelopmentBox` mount and the tab button are the only Development entries;
- the sandbox condition excludes Development;
- the shell count is measured and smaller;
- the typecheck is zero.

Write the measured result into `rooms/development/CHANGELOG.md` and add the room's `README.md`
with the structure, the package, the rail, the tool boundary and the open items.

## The Development notes scanned

The top-level `development/` folder is the tool's shelf, and its notes bound this plan.

- `development/CHANGELOG.md` records that the Development tool was removed and then restored as a
  component we control: the repo-run OpenHands Agent Canvas, telemetry cut, the house patch, the
  transparent app ground, the panel colour and the lab tile. The tool is not restyled or rebuilt in
  this plan.
- The first `NEXT PROMPT` block in `development/CHANGELOG.md` is about the tool, not the room box:
  the agent model configuration, the lifecycle and health banner, the sandbox choice, and a bridge
  that would put Development conversations on the Console as cards. It also says to search
  `WritingAreaIndex.tsx` for `openhands-room` and `DEVELOPMENT_GATE_MIN_MS`; that is stale. The
  room moved to `rooms/development/`, and the gate was removed. The plan's Step 1 is the current
  shell instruction.
- The second `NEXT PROMPT` block repeats the bridge as the next feature and adds the automation
  backend's pinned SDK and a global spending cap. Those are tool and bridge jobs, not this box.
- `development/ops/WRITING-AREA-EXTRACTION-PLAN.md` Phase 5 names what leaves the page: the dev
  lab, the draft canvas writes, the lab tile ground and the dev room's seat. Its page target of
  3,600 is historical; the shell is 4,154 now, and this plan measures its own cut.
- `useDevelopmentRoom.ts` carries the room's own laws: the package row `dev_room` is hidden from the
  Console's cards; the rail is `chat,trace,tools,approvals,eval,states,repair,settings` with no
  Versions; the seat is closed on entry; the room's instructions are plumbing, not a persona; the
  turn goes to the platform assistant today, with the tool's own agent left as the owner's call.

## What this plan does not do

- It does not change the OpenHands application, its source, its house patch, its panel colour or
  its transparent ground.
- It does not build the Development-to-Console card bridge. That is the next feature; its reference
  is the Product room's bridge, the publish-is-the-commit rule, and OpenHands'
  `/api/automation/docs`.
- It does not remove the shell's `ai-surface-sandbox`; after Development leaves, the sandbox holds
  only the Composer. The Composer's box cut is the one that deletes the sandbox.
- It does not configure the tool's model, add a lifecycle health banner, choose the OpenHands
  tool's own sandbox, update the automation backend's pinned SDK, or add a spending cap.
- It does not connect the room's chat to the tool's own agent. Grace answers the room today; the
  tool's agent is a separate decision.
- It does not change the shared chat parts, the shared wrapper for other rooms, or the other rooms.
- It does not build or preview the app; verification is on 5001, inside the React frame.

## The traps

- The tool is the engine. Do not move it into the room or restyle it to make the frame fit.
- The ground belongs to the box. If the left slot keeps its own tile, the tile is painted twice;
  the app's transparent ground is what lets the box's tile show through.
- The shell's sandbox currently treats Development as self-gated. After the box, the sandbox must
  not mount for Development; otherwise the second surface returns.
- The sandbox is being retired, not repaired. Do not add a new Development sandbox rule, slot or
  comment that would make it permanent. The Development cut leaves it smaller; the Composer cut
  removes it.
- The hook's `headerTab` guard must go with the shell call. A room mounted only when active does
  not need a tab check, and a check left behind can make the room's own first paint skip.
- The chat copy must bind the Development package and conversation itself. The shared seat is not
  the room's seat, and another room's conversation must never appear.
- The rail's list is the room's own; Versions never comes back.
- The wrapper and chat copies are copied whole first. Styling and behavior changes are not part of
  the move.
- The page's ready signal is `ready-selector="h1"` on the OpenHands frame. The room opens straight
  in; no gate, no cover, no fallback.

## The first slice

The first slice is Step 1: the box, the container, and the shell cut. The person sees the same
Development room with the same tool, but the shell no longer holds its ground, refs, hook or
sandbox arm. The room's own wrapper and chat follow as Steps 2 and 3.
