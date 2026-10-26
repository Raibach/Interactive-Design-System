# PLAN — the Development room's remaining cut and the tool's open work

> Written 2026-10-24, approved by the owner the same day. Step 1 of the room cut (the box, the
> container and the shell cut) was executed and verified before this plan: see
> `rooms/development/CHANGELOG.md` and `PLAN-sovereign-development.md`. This plan carries Steps 2–5
> of the room cut and the tool's open work from `development/CHANGELOG.md`.

## Decisions taken (2026-10-24)

- **The commit is a Publish button in the room.** Only a published task becomes a card. The tool
  is untouched; the strip is the room's own gate.
- **The agent's sandbox is decided at deployment.** The current local mode stays; the plan records
  the fork and does not change it now.
- **The spending ceiling is deferred.** The plan records where a proxy would sit and does not
  build it.

The order is: the room's remaining cut first, then the tool track in the folder's own order —
health, bridge, version alignment — with the two deferred decisions recorded.

## What the person will see when this plan is done

The Development room is complete on its own terms. It keeps the lab tile, the tool, and Grace's
chat, but the chat is now the room's own element, exactly as Product, Governance, Design and the
Console each own theirs. Nothing of another room's chat is inside it. If the tool is stopped, the
room says so in one honest line and names the command that starts it; the tool area stays empty,
and no fallback panel returns.

The person can also take a task they made in the tool and put it on the Console: a Publish control
in the room's own strip sends a reference, the card appears under a Development category, and
pressing the card opens the room on that task. The task, its runs and its transcript stay in the
tool; the card is a door, never a copy.

---

## Part 1 — the room

### Step 2 — the room's own copy of the shared layout

Create `rooms/development/development-workspace.ts` as a whole copy of
`components/lit/workspace-layout.ts` (2,211 lines), retagged `development-workspace`, class
`DevelopmentWorkspaceLayout`, self-registering with the same guard and the same tag and React
declarations. The copy is structural and verbatim, following Product's `product-workspace.ts`: the
same slots, the same gripper, the same closed-third behaviour, the same open width (700; Product's
copy changed its own to 600, Development keeps the shared value).

`DevelopmentRoom.tsx` imports the file for its side effect and mounts
`<development-workspace key="development-room">` in place of `<workspace-layout>`. The room's
closed-on-entry write still lands through the same property, never an attribute.

Verify on 5001: the canvas, the chat rail and the gripper draw exactly as before; the shared
`workspace-layout` is absent from the page; the other rooms still draw theirs; the typecheck is
zero.

### Step 2b — the wrapper's own sever

The copy starts with every room's hooks in it. Remove only what Development cannot reach, one
removal per verification: the console ceiling constants and check, the design ingest listeners
(`ingest-submit`, `open-component`), and the composer dock/run/flow hooks (`run-click`, `dockPrompt`,
`openPrompt`, `flow-view-ready`, `a2ui:run-held`, `resetArrangement`). Keep every slot, the gripper,
`isThirdOpen`, `chatLoadWidth`, `leftCollapsed`, `setColumnWidths` and `widths`. The right-hand grip
is fed by the seat's own spacer, not by the layout; both copies keep their listeners.

### Step 3 — the room's own chat element

Create `rooms/development/development-chat-panel.ts` as a whole copy of
`components/lit/chat-panel.ts` (5,485 lines), retagged `development-chat-panel`, class
`DevelopmentChatPanel`, self-registering. This is the same first move Governance, Product, Design
and the Console made: copy whole, retag, mount, then sever in stages.

`DevelopmentRoom.tsx` imports the file for its side effect before rendering and mounts
`<development-chat-panel slot="right" ref={developmentSeatRef}>`. The container keeps the seat ref
typed against the shared class (type-only, as Governance does), so no runtime import of the shared
element remains.

**Registration is two layers, not four.** The file defines its own tag and the room imports it. No
catalog entry, no tag-registry entry, no backend emit: the room mounts its seat directly, so no
surface ever names it. The Console needed all four layers because the model assembles the Console's
surface and emits the seat's tag. The backend still emits `chat-panel` for Product, Governance and
Design even though those rooms hand-mount their own tags; Development adds no `render-development`
intent. If a model-assembled Development surface is ever built, the other three layers return with
it.

The bindings stay exactly as they are: `sessionId`, `conversationId`, the package title,
`chat,trace,tools,approvals,eval,states,repair,settings` (no Versions), the room's instructions,
`graceLiveContext: false`, `tracePrompt: false`. A turn still goes to Grace's own
`/api/teacher/query`.

Verify: the rail is the Development list; the thread is the Development conversation; the input
sends with the Development ids; no shared `chat-panel` exists on the page; the typecheck is zero.

### Step 4 — sever the chat copy

Remove from the copy only what the Development room cannot read, in stages, each verified:

- **Product:** its tools and thread properties, the build-wireframe action, the attach/tool
  forwarding, the paste path, the blank-seat return, and the two copied parts. The render falls
  back to the shared `<chat-messages>` and `<chat-plugin-tray>`.
- **The Console:** the card library, the seat-type read, the console hello, the console arrival
  refusal, the console tool-register omission, the console new-conversation successor flow, the
  console title scheme, and `<reassemble-console>`.
- **Governance:** its trace and observation properties, the trace facts appended to the workspace
  context, the governance hello, the outward `tab-change` announcement, and the composer-package
  action.
- **The Composer:** its blank-prompt greeting and the whole hello machinery. Development marks no
  arrival and dispatches no composer-opened event, so no hello fires today; the copy must not leave
  machinery that invents one.

Keep: the thread, the history load, the conversation list and the generic new-conversation path,
the send path and reply handling, the rail and its folds, the approvals findings seat and the
inspection rows, the repair view, the states view slot, the settings tab's no-op, the scroll, the
right grip spacer, the collapse, the error banner, the status and usage events, and the pending-turn
flush. Keep the settings the room binds (`tracePrompt`, `graceLiveContext`) even where the binding
makes a branch dead; severing a declared setting is not this cut's job.

Verify after each removal: every rail tab still draws, the thread still loads, the input still
sends, no other room's property or act remains, the typecheck stays zero.

### Step 5 — the sweep and the room's record

Re-run the shell audit (the Development names must return nothing in `WritingAreaIndex.tsx`),
measure the shell count, write the measured result into `rooms/development/CHANGELOG.md`, and add
`rooms/development/README.md` with the structure, the package, the rail, the tool boundary and the
open items. The shared layout and the shared seat stay as they are for the Composer.

---

## Part 2 — the tool's open work

### T1 — the health door, and the room's own strip

The tool already answers `/dev/health`, `/dev/alive`, `/dev/ready` and `/dev/server_info` through
the ingress, and the automation service answers `/dev/api/automation/health`. Nothing in the
platform reads any of them.

Add `GET /api/builder/development/health`, the Product door's shape: a 1.5-second probe of the
tool's health address, returning `{ok, detail}`. The room checks once on entry, when an address
exists, and for the demo draws nothing.

The person sees the Product pattern: a red line at the top of the tool pane naming the truth and
the exact command (`RESTART-LOCAL.sh`), with the pane otherwise empty. No spinner, no cover, no
fallback.

The room's own strip is the same piece of chrome that will carry Publish. It sits above the tool
inside the left column, belongs to the room (not the tool), and has two states: when the tool is up
it shows the task picker and Publish; when the tool is down it becomes the red line. The strip's
look is verified on 5001 before the bridge is wired behind it.

### T2 — the bridge: publish a task to the Console

**The act.** The person chooses one of the tool's tasks in the strip's picker and presses Publish.
The picker's list is read by the backend from the tool's automation API
(`/dev/api/automation/v1`: automations with their name, state, run count, last run status and
cost), never by the browser.

**The write.** A new `backend/routes/development_bridge.py` with its own router:

- `GET /api/development/tasks` — the picker's list, proxied from the tool.
- `POST /api/development/publish` — reads the chosen automation and its runs, then writes or
  updates one `prompt_sessions` row: `room_domain="development"`, title from the task's name,
  description from its prompt, `category="Development"` with a `categories` row like Product's, and
  metadata `{development_automation_id, development_runs, development_last_status}`. The row is no
  longer a draft, so the Console's card read sees it.
- `POST /api/development/sync` — reconciles the published rows with the tool's list on every
  Console assembly, exactly as the Product sync does: update title, state and run count; remove a
  row whose automation is gone; leave unpublished tasks alone.

**The card and the door.** The card dictionary gains the automation reference beside
`builder_project`; the card draws under its own category; `useOpenCardFromConsole` gains the
Development branch; the shell stores the pending action and opens the room; the room's container
selects that task in the strip. Pressing the card opens the room on the task; it does not create a
second conversation.

**Deleting a card** removes the reference only. The task, its runs and its transcript stay in the
tool. This is the inverse of Product's delete, which cascades into its engine; the plan states the
difference rather than copying it.

**What is not copied.** No transcript, no run log, no task body is duplicated into the platform
database. The card carries ids and the facts it draws.

Verify end to end: publish a task, assemble the Console, see one card under Development; press it,
land in the room on that task; delete the card, find the task still in the tool; unpublish with the
tool running and gone, and see the row reconcile.

### T3 — align the automation backend's version

The folder's note says the automation backend still runs 1.49.6. That is stale:
`development/vendor/automation/pyproject.toml` pins `openhands-sdk==1.50.1` and
`openhands-workspace==1.50.1`, with agent-server 1.19.1 resolved transitively, while the vendored
tree the agent runs is 1.51.0. Align the automation environment to the same 1.51.0 family the agent
already runs, as the canvas image does for the agent, and exercise DeepSeek on a real run. Record
the measured outcome in the tool's changelog; the note's "unknown, not a claim" is the standard.

### T4 — the sandbox, decided at deployment

No code changes now. The plan records the fork: local mode has full filesystem access; contained
Docker sandboxes need Docker Desktop and an image rebuild. The decision is made when the tool is
deployed away from the owner's machine, and the note stays open until then.

### T5 — the spending ceiling, deferred

No proxy now. The plan records the insertion point: the tool's model profile carries `base_url` in
`development/canvas/deploy/settings-bundle/settings.json`, and that field is where a counting proxy
would sit. The ceilings that exist today are the iteration limit and the provider account. The item
stays open in the folder's list.

### T6 — reconcile the folder's notes

Append one dated "current truth" entry to `development/CHANGELOG.md` rather than rewriting history.
It corrects the pointers that would mislead the next reader: the `dev-tool` path (gone), the patch
script (gone; the styling lives in source), the gate anchors in the shell (gone), the shell count
(4,104), the Phase 5 target (historical), the automation SDK version (1.50.1/1.19.1, not 1.49.6),
and the two NEXT PROMPT blocks' status (model configuration built; health, bridge, version open;
sandbox and cap deferred). Update the extraction plan's line count and its Phase 5 pointer to the
room's plans.

---

## Order and gates

1. Step 2, then Step 2b.
2. Step 3, then Step 4 (the longest; one removal at a time).
3. Step 5, the room README and changelog.
4. T1 health and the strip, verified on screen.
5. T2 the bridge, backend first, then the card door.
6. T3 version alignment.
7. T6 the notes' reconciliation; T4 and T5 recorded as open decisions.

Every step ends with the typecheck at zero, and every visual step with a measurement inside the
React frame on 5001.

## Traps

- The ground has one writer: the box. The tool paints its own tile into its own page; do not paint
  the left slot again.
- The right grip lives in the seat's spacer, not the layout. Both copies keep it.
- The shared parts stay shared; only the seat is the room's. Do not copy the header, messages,
  input, action bar, navigation bar, folds or error banner.
- Do not add a `render-development` intent or a catalog entry for the seat. The room mounts it.
- The strip is the room's gate, not the tool's chrome. Do not patch the tool to make room for it.
- A card is a reference. Do not copy a transcript into the platform database.
- The automation documentation URL is disabled in this build; read `/api/automation/openapi.json`,
  not `/docs`.
- The folder's changelog is a record. Annotate stale entries with a dated correction; do not rewrite
  them.

## Status (2026-10-24, measured)

- **Step 2 — done.** `development-workspace.ts` is mounted and verified; the shared layout is absent
  from the room.
- **Step 2b — deferred.** The copy stays verbatim. Its composer, design and console hooks are inert
  in this room, and the Composer's cut retires the shared source they came from; severing them twice
  would be wasted motion. The reason is recorded here rather than silently skipped.
- **Step 3 — done.** `development-chat-panel.ts` is mounted and verified, bound to the room's
  package and conversation.
- **Step 4 — begun.** Product severed (properties, wireframe action, attach/tool/paste, thread and
  foot). Console severed in part (library, reassemble, composer package, trailing switch). Still
  present and inert: the Console seat-scope and hello, the Governance trace facts and hello, the
  Composer hello.
- **Step 5 — recorded.** `rooms/development/README.md` and the changelog carry the structure and
  the measurements.
- **T1–T6 — not started.** They follow the room's remaining sever.

## What this plan does not do

- It does not change the shared layout or the shared seat; the Composer keeps both.
- It does not change the OpenHands source, its theme, its telemetry cut or its start scripts.
- It does not change the sandbox mode or build the spending proxy.
- It does not touch the Composer's box cut or any other room.
- It does not build a Development surface for the model to assemble.
