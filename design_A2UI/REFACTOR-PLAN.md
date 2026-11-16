# The vertical slice — the plan

*2026-11-15, rewritten on the owner's correction: the top tab loads the surface, and everything
inside it navigates that surface. The folder tree must be the interface tree, and a function lives
in the folder of the tab and the subsection it belongs to. No code has been changed.*

## What the person sees

The person presses **Design A2UI** in the shell. One surface loads: the three columns, the rail and
the five boxes. It loads once. From then on, every press inside is navigation of that surface: the
rail's items change what the left and middle columns serve and which conversation the right column
shows; the boxes pull; the conversations open; the thread answers. No page is built, no seat is
built, nothing is replaced under the hand.

The proof is the node: the frame's and the columns' own elements are the same elements before and
after a rail press. Only what they serve and the data inside them change.

## What "loads the surface" means here

1. The top tab is pressed. The shell resolves the tab and hands the surface its session and its
   package.
2. The surface's tree arrives once: the frame, the rail, the left container, the middle container,
   and the right column's five slots.
3. The surface's data arrives: which rail item is active, the package, the session, the rail's
   state and the boxes' heights.
4. The renderer draws the same surface. A rail press writes the active item and the tab's own
   conversation; the section's content is served inside the containers and the slots. The tree
   does not change; the data does.

This is the A2UI rule the folder must obey: structure is the component tree, content is the data
model, and a press is an action whose owner is the component that was pressed.

## The boundary: the shell and the seat

`frontend/src` holds the shell and the universal functions, and it stops growing there. The shell
is the page host, the sign-in, the transport, the event bus, the A2UI renderer, the catalogue
schema and loader, the registry mechanism, the primitives, the structural containers and the
tokens. The A2UI process is universal; a seat's catalogue entries and registry entries are not.

Everything else is the seat's, and it lives in this folder. Search and advanced filtering are not
universal: the sessions' advanced filter lives in `chat/thread/`, and the console's own search
lives in `chat/left/`, because each belongs to the tab that owns the thing being searched. A
function becomes universal only when a second seat uses it with the same data, and that is proven,
never assumed.

The rule of work is **copy**. Every file in the current application stays exactly where it is and
keeps working. This folder receives a copy with the seat's own names. Nothing is moved and nothing
is deleted: not `frontend/src/rooms/design`, not `frontend/src/components/lit`, not
`frontend/src/tools`, not `backend/routes/figma.py`. The current application is the fallback until
the seat's copies pass the checks.

## The plans that already exist in this folder

Four documents were moved here from the disposable `design copy`, and they are the seat's
architecture, not a proposal:

- `chat-surface-design/vertical-slice-chat-design.md` — the chat slice's manifest, its binding
  contract (the properties the host sets), its event contract (the events the seat emits and who
  answers them), its data calls and its acceptance checks.
- `chat-surface-design/SLOT-PLAN.md` — the five boxes and the six rules of the pull.
- `chat-surface-design/SLOT-CHANGELOG.md` — the record of that work.
- `figma-ingest/CHANGELOG.md` — the ingest's record, 982 lines.

This plan follows them. The one refinement is the finer place cut: the manifest's `parts/` is the
same furniture as the subsection folders here, so each part becomes the `view.ts` of its own place,
and its handlers become that place's `actions.ts`. The seat, its styles, its conversation rules,
its frame, its assets and its README stay at the tab's root. The binding and event contracts in
the vertical-slice document are the seat's contract and are not rewritten here.

## The slice follows the interface, not the behavior

The folder tree is the surface's own tree. Each folder is a place on the screen; each folder's
`actions.ts` holds the functions of that place.

```
design_A2UI/
  surface-design/
    surface/                     the room itself, loaded once by the top tab
      frame/                     the three columns, the five boxes, the pull and its stop
      rail/                      the navigation: the items, collapse, unread, the approval pulse
      left-container/            the panel and its slot; what it serves
      middle-container/          its slot; what it serves
      load.ts                    the top tab press: the one door, the surface id, the one tree
      components.ts              the surface tree: frame, containers, slots, the tab's rows
      data.ts                    /surface/*: the active item, package, session, heights
    catalog.ts / catalog.json    the schema the server accepts (35 components)
    registry.ts / registry.json  the name→tag source and the served table (29 names)
    DesignBox.tsx                the tab's content box
    DesignRoom.tsx               the room's React owner
    DesignRoomContainer.tsx      the lazy boundary
    DesignSeatShell.tsx          the one renderer, the one tree, the one data model
    tab.ts                       the tab's descriptor
  chat/                          the Chat tab: the seat, its places, its parts, the frame
    conversations/ readout/ thread/ input/ tray/ left/ parts/ frame/
    conversations.ts             the tab's own conversation ids
    console-conversations.ts     the console's file
    design-chat-seat.ts          the seat
  tools/                         the Tools tab: the seat, the workspace, the form, the tree
  approve/                       the Approve tab: the review view
  ux/                            the UX tab: the seat, the app frame, its chat
  tests/                         four-layers.mjs and export-catalogs.mts
```

## What the Tools tab uses and this folder now holds

The ingest's drawing is this folder's: `tools/figma-ingest-form.ts` (295 lines),
`tools/figma-layers-view.ts` (2,461) and `tools/tools-tab.ts` (100), with the seat's tags and its
catalogue entries. The Tools seat, its workspace, its parts and its conversation file are here too.

The server is still the application's: `backend/routes/figma.py` (8,800 lines) and the six modules
beside it. The Tools tab calls those doors as they are, and the seat's server copy is the handoff's
step 4 — not this pass. The Tools tab is one node of the surface's tree, not a second surface.

## The server, cut by process

`backend copy/routes/figma.py` is 8,800 lines: 37 routes, 167 functions and 7 classes in one
file. Every path in this section is in `backend copy/`; the living `backend/` is not read or
written. Its shape is the wall. The routes are stacked at the top (127–1,931) and at the bottom (6,421–8,800),
and between them sit 4,471 lines of helpers under one preview route. The ingest's engine alone,
`_process_ingest_job`, is 845 lines (5,304–6,148). Nothing can be read, tested or changed without
the whole file.

The cut is by process, and each process owns its routes, its work and its store. Six processes:

| Process | Routes today | The work today | The folder |
|---|---|---|---|
| **The Figma read** | file, versions, component, node, dev-resources, search, config, spec (540–766) | the MCP and REST read, the merge, the spec for the model, the paint, the text, the vector, the transforms (2,014–5,092) | `figma/reads/` |
| **The ingest** | `/api/catalog/ingest` (127), the steps (767), `/api/figma/ingest` (6,421), status (6,618), log (8,028), facts (8,124), compare (8,144), code (8,163) | the job state, the draft set, the registration, the validation, the transpile, the assets, the engine, the generators (675–1,912, 2,398–2,683, 5,304–6,420) | `figma/ingest/` |
| **The preview** | the lit preview (1,932), the preview (1,950), abandon (6,654), heartbeat (6,677), audit (8,264), discard (8,275) | the preview files, the audit, the keep, the drop, the sweep, the bundle (833–1,135, 1,907–1,930) | `figma/preview/` |
| **The review** | accept (325), remove (7,219), ask (8,205), commit (8,316) | the removal, the acceptance, the commit (325–539, 7,267–7,423, 8,205–8,800) | `figma/review/` |
| **The catalog read** | catalog (6,884), usage (7,023), unresolved (7,072), elements (7,495), find (7,609), node (7,717), component (7,750), element (8,051), activity (7,864), purge (7,932), health (7,455) | the catalogue state, the backfill, the history, the walk (4,250–4,403, 6,696–6,834) | `figma/catalog/` |
| **The record** | none of its own | the activity log, the layer index, the layer write, the figma map (2,164–2,397, 3,950–4,167, 7,910) | `figma/records/` |

The copy's target, inside this folder:

```
design_A2UI/backend/
  app.py                    the seat's server: one router, assembled from the six processes
  deps.py                   the seat's own keys and connections
  figma/
    reads/     routes.py  source.py  paint.py  vector.py
    ingest/    routes.py  job.py  drafts.py  engine.py  code.py  catalog_write.py  assets.py
    preview/   routes.py  files.py  audit.py
    review/    routes.py  facts.py
    catalog/   routes.py  state.py
    records/   activity.py  layers.py  figma_map.py
```

Each folder holds the routes of its process, the work those routes call, and the store they read or
write. A process does not import another process's internals; it calls the shared drawing library
or the seat's connection. The seat's server includes the six routers. `routes/figma.py` stays as
the current application's route file and is not deleted.

### The duplicate server

A copy of the routes alone cannot boot, so the seat's server is a duplicate of the current one. It
is 19,741 lines plus the catalogue tree:

| Piece | Lines | Why the duplicate needs it |
|---|---|---|
| `routes/figma.py` | 8,800 | the ingest's routes |
| `figma_fidelity.py` | 2,544 | the drawing's exact numbers |
| `figma_twopass.py` | 632 | the two-pass comparison |
| `figma_service.py` | 590 | the Figma reads |
| `figma_mcp.py` | 358 | the Figma connection |
| `figma_facts.py` | 258 | the fact sheet |
| `figma_key_coverage.py` | 156 | the key coverage |
| `figma_ingest_gate.py` | 76 | the gate |
| `prompt_sessions_api.py` | 2,140 | the conversation pointer and its routes |
| `design_renderer.py` | 1,347 | the renderer the ingest validates against |
| `grace_gui.py` | 1,354 | the model door |
| `accessibility_contract.py` | 673 | the contract gate |
| `deps.py` | 334 | the catalogues and the connections |
| `design_parameters.py` | 189 | the parameter types |
| `config.py` | 109 | the environment |
| `services.py` | 105 | the seat's state |
| `card_lifecycle.py` | 76 | the card states |

`routes/figma_intake.py` (556 lines) is the Governance intake; nothing in the seat's frontend calls
it, so it stays with Governance and is not duplicated.

The duplicate is byte-identical except three named changes:

1. The two catalogue roots point at the seat's own tree instead of `product/catalogs` and
   `frontend/src/components/A2UI/catalogs`. The seat's tree is a copy of the current catalogue at
   the moment of duplication, so the duplicate reads the same catalogue and writes only its own.
2. The connections in `deps.py` become the seat's own keys. Until those exist, the duplicate reads
   the current ones, and the seat's flag stays false, so nothing writes through it.
3. The app listens on its own port, so the duplicate boots beside the current server and answers
   the same calls for comparison.

The duplicate comes first. The six processes are cut from the duplicate, not from the current file.
The current backend, its route file and its modules are untouched.

### The duplicates: the wall around the working application

The safety protocol is a copy. The working front end and back end are not edited during this work,
and the copies are the room to experiment.

| The duplicate | The copy | What it is |
|---|---|---|
| the front end | `frontend copy/` | the whole app, 28 MB, source and configs; its `node_modules` is a link to the working one |
| the back end | `backend copy/` | the server, 4.5 MB of source; no virtual environment, no logs, no secrets copied |
| the catalogue tree | `product copy/catalogs/` | the lab's catalogues, so a write lands in the copy |

The copies sit at the top level, beside the working folders, and they are the source. No server and
no port is added, and the copies are never run: the working application keeps 5001 and 8000. A file
is moved out of a copy into the seat's slice, one element at a time, and the copy shrinks. The whole
front end and the whole back end are never moved, and the working application is untouched
throughout.

The working `frontend/` and `backend/` are not read or written in this work. Every source file is
taken from `frontend copy/`, `backend copy/` or `product copy/`. If a file is needed and it is not
in a copy, the copy is completed first; the original is never reached for.

The living application holds one tab for the seat, and that tab is a link, not an import. The shell
never loads the seat's code: the tab points at the folder's own surface, and the folder is its own
application. The test is the deletion: remove `design_A2UI/` and the living application still runs;
press the tab and the link fails, honestly. The tab answers exactly that way now, and it stays that
way until the folder serves its own surface. The seat is built and tested from the copies, never
by editing the shell.

The order, one process per step:

1. **The Figma read.** It writes nothing, so it is the safe first cut. The eight routes and their
   library are copied to `figma/reads/`. The current file is untouched and keeps answering.
2. **The catalog read.** It answers from files and the record; no writes.
3. **The record.** The activity log, the layer index and the figma map, which the ingest and the
   catalog both read.
4. **The ingest.** The engine, the drafts, the registration, the validation and the assets.
5. **The preview.** The draft window, its files and its audit.
6. **The review.** Accept, ask, commit and remove, the only destructive presses.

The proof after each process: the seat's server boots, and the routes that were copied answer the
same shapes as before. The behavior walk at 5001 covers the Tools tab end to end: submit a Figma link,
watch the steps, open the preview, read the audit, accept or discard, and remove a component.



| File | What it holds |
|---|---|
| `view.ts` | the element that draws that place, and nothing else |
| `data.ts` | the values and paths that place reads, and the values it derives for the drawing |
| `actions.ts` | one function per press in that place, named by the act |
| `state.ts` | the state that place keeps for itself: heights, open, draft, scroll |

A function lives in the folder of the place that was pressed, never in a file that gathers
functions from all places. The reply's buttons live in `thread/actions.ts` because the button is in
the thread. Send lives in `composer/actions.ts` because Send is in the composer. The rail's press
lives in `rail/actions.ts` because the rail is the surface's.

The data paths follow the same tree: `/surface/*`, `/chat/conversations/*`, `/chat/thread/*`,
`/chat/input/*`, `/tools/ingest/*`, `/approve/*`, `/ux/*`. A place writes only its own subtree.
No tab reads another tab's path or conversation id.

## The 5,392 lines, cut by place

The ranges are the method map's own boundaries in `design-chat.ts`. The file is the Chat tab's
seat, so its functions belong to the Chat tab's places and to the surface's places.

| Region | Lines | Goes to |
|---|---|---|
| imports, constants, registration | 1–205, 5,366–5,392 | the seat entry, which composes the places |
| properties and lifecycle wiring | 206–1,107 | each place's `data.ts` and `state.ts`, split by the value's owner |
| the scroll and the drawn thumb | 1,107–1,220 | `chat/thread/` |
| the reply's buttons | 1,220–1,525 | `chat/thread/actions.ts` |
| the sessions lane | 1,525–1,679 | `chat/thread/` (the Sessions view) |
| the input's drag | 1,679–1,781 | `chat/input/state.ts` |
| derived values and slot decisions | 1,783–2,118 | `chat/thread/data.ts`, `chat/conversations/data.ts`, `chat/readout/data.ts` |
| the update, the package enter, the history | 2,118–2,473 | `surface/data.ts` and `chat/conversations/data.ts` |
| arrival and greeting | 2,473–2,932 | `surface/load.ts` and `chat/thread/` |
| package helpers, the workspace context | 2,932–3,248 | `surface/data.ts`, `chat/thread/data.ts` |
| reply processing | 3,248–3,538 | `chat/thread/` |
| the send | 3,538–3,986 | `chat/input/actions.ts`; the turn it writes is the thread's |
| end of work, status, held turns | 3,986–4,060 | `chat/thread/`, `chat/readout/` |
| the composer key, the product foot | 4,060–4,180 | `chat/input/actions.ts` |
| clear, move, adopt | 4,142–4,237 | `surface/rail/actions.ts` and `chat/conversations/` |
| select, new, create | 4,237–4,532 | `chat/conversations/actions.ts` |
| the default conversation, approvals | 4,511–4,596 | `chat/conversations/` and `surface/rail/` |
| the list, removal, titles, writes | 4,596–4,799 | `chat/conversations/` |
| the tab press | 4,799–4,882 | `surface/rail/actions.ts` |
| the column grip, the collapse, the row press | 4,882–4,953 | `surface/frame/`, `surface/rail/`, `chat/conversations/` |
| the render | 4,953–5,392 | **every place's `view.ts`** |

The last row is the test of the slice: the drawing is not left in the seat. The rail's markup is
copied to `rail/view.ts`, the conversations card to `conversations/view.ts`, the thread to
`thread/view.ts`, the composer to `composer/view.ts`, the tray to `tray/view.ts`. The seat keeps
only the frame's composition and the slot declarations.

## The user's individual actions, by place

Every press the person can make today, in the folder that owns it. "Answered" means a listener
exists and does the work.

### The surface

| What the person does | What says it | Answered by | Folder |
|---|---|---|---|
| Presses a rail item | `tab-change` | `_onTabChange` (4,799) | `surface/rail/actions.ts` |
| Presses collapse | `collapse-toggle` | `_onCollapseToggle` (4,903) | `surface/rail/actions.ts` |
| Presses the console mark | `design-console-open` | the room; the seat announces | `surface/rail/actions.ts` |
| Pulls the column's spacer | `pointerdown` | `_onGripDown` (4,882) | `surface/frame/actions.ts` |
| Pulls a box's dots | `pointerdown` | `_onSlotGripDown` (1,759) | `surface/frame/actions.ts` |
| Presses a box's bar | `toggle-output-window`, `remove-output-window` | `_onOutputWindow` (1,702) | `surface/frame/actions.ts` |

### The Chat tab: the conversations

| What the person does | What says it | Answered by | Folder |
|---|---|---|---|
| Presses a conversation row | `conversation-select` | `_onConversationSelect` (4,237) | `chat/conversations/actions.ts` |
| Presses remove, then again | `@click` | `_onConversationRemove` (4,689) | `chat/conversations/actions.ts` |
| Presses the bar, or Enter, or Space | `@click`, `@keydown` | `_toggleConversations` (4,596), `_onConversationsKey` (4,607) | `chat/conversations/actions.ts` |
| Presses the plus beside the bar | `@click` | `_startNewConversation` (4,294) | `chat/conversations/actions.ts` |

### The Chat tab: the thread

| What the person does | What says it | Answered by | Folder |
|---|---|---|---|
| Presses a button inside a reply | `chat-action-send` | `_onActionSend` (1,220) | `chat/thread/actions.ts` |
| Presses a fold's bar | `fold-toggle` | two inline handlers (5,215, 5,263) | `chat/thread/actions.ts` |
| Scrolls the thread | `scroll` | `_onOutputScroll` (1,150) | `chat/thread/state.ts` |
| Drags the drawn scrollbar | `mousedown` | `_onThumbDown` (1,160) | `chat/thread/state.ts` |
| Presses a stored query row in Sessions | `session-select` | **nothing** | `chat/thread/actions.ts` |
| Presses clear in Sessions | `sessions-lane-clear` | `_onSessionsLaneClear` (1,610) | `chat/thread/actions.ts` |

The reply's buttons are fifteen named paths in one function: no thanks, a write to a step, a tool
inserted, the package description, two rows merged, a tool moved, a row's text replaced, an offered
request sent as a sentence, apply all, run, build the wireframe, edit the selected tile, save, name
the package, remove a step. Anything else that reads like a command is said in the thread as an
alert; a sentence with spaces goes to the model.

### The Chat tab: the input

| What the person does | What says it | Answered by | Folder |
|---|---|---|---|
| Types words | `value-input` | `_onDraftInput` (815) | `chat/input/actions.ts` |
| Presses Send | `send-input-to-model` | `_onSendCommand` (1,513) | `chat/input/actions.ts` |
| Presses Enter | `keydown` | `_onComposerKey` (4,082) | `chat/input/actions.ts` |
| Presses Stop | `stop-model-thinking` | `_onStopCommand` (1,672) | `chat/input/actions.ts` |
| Pulls the input bar's dots | `input-resize-start/-move/-end` | `_onResizeStart` (1,714), `_onResizeMove` (1,742) | `chat/input/state.ts` |
| Attaches files | `product-attach` | `_forwardProductAttach` (4,100) | `chat/input/actions.ts` |
| Chooses a tool | `product-tool` | `_forwardProductTool` (4,106) | `chat/input/actions.ts` |
| Pastes a file | `@paste` | `_onProductPaste` (4,118) | `chat/input/actions.ts` |

### What the host says — not a press

`a2ui:system-message`, `a2ui:ask-grace`, `section-write-failed` belong to `chat/thread/data.ts`.
`a2ui:grace-status` belongs to `chat/readout/`. `a2ui:composer-opened` belongs to
`chat/input/`. `design-approval-count` and `design-approval-changed` belong to
`surface/rail/`. None of them is an action, and none of them goes in an `actions.ts`.

## Two dead controls, and the audit's rule

The attached A2UI reference is explicit: an event a component dispatches is declared in the
registry and must have a listener; the audit files `event-unheard`, and **a dead control is never
excused with a comment**. Three were found, and the previous version of this plan was wrong to
call them "declared":

- `session-select`, from `chat-surface-design/parts/design-sessions-feed.ts:335`. It is a live
  press: the feed is mounted in the Sessions view. The seat's replay method exists at 1,625 and
  nothing calls it, and the room does not listen. It is wired to the replay in
  `chat/thread/actions.ts`, or the row is removed from the view. No third choice.
- `conversation-new`, from `design-chat-footer.ts`. The footer element is imported but not
  mounted; the tray replaced it. The element and its event are removed from this surface, not
  kept as a comment.
- `dropdown-toggle`, from `design-small-dropdown.ts`. The dropdown is switched off
  (`_conversationsTopSlot` is false). It is removed from this surface until a place uses it.

## The load and the navigation: what the shell does

The shell now does this. `surface/load.ts` reads the door once and returns the surface id and the
whole tree; `DesignSeatShell.tsx` keeps one `<a2ui-renderer>` and one data model.

1. The top tab press calls `surface/load.ts` once. It reads the door's `surfaceId`, tree and data
   model, and it preloads the seat's registry.
2. A rail press writes `/surface/tab`, `/surface/session_id` and `/surface/conversation_id`.
   `components.ts` selects the tab's left, middle and chat children; the right column reads the
   tab's conversation.
3. No per-tab page and no per-tab chat are built. The frame, the left body, the middle and the
   right column are the same elements; the tree's children change through the data.

This is the handoff's third step. It comes after the Chat tab's places exist as folders, because a
seat that still gathers every function cannot take a new tab's data without being rebuilt.

## The order

The copies come first: `frontend copy`, `backend copy` and `product copy` at the top level. Every
step below pulls from them, and the working application is never edited.

1. **The flag.** Wire `enabled: false` into the bar, the drawer and the mount. Safety first: the
   seat still shares the current Design's keys.
2. **The surface's own places.** Copy the frame, the rail, the containers and the load out of the
   seat into `surface-design/surface/`. The seat, still the composition, imports the copies. The
   current files are untouched.
3. **The Chat tab, one place at a time:** the conversations, the readout, the thread, the composer,
   the tray. Each place gets its `view.ts`, `data.ts`, `actions.ts` and `state.ts`; the seat loses
   that markup and those functions.
4. **The load and the navigation.** Done in this pass: the shell mounts one surface and swaps the
   tab's children through the data model. The proof is the node identity across a rail press; the
   runtime walk is still the owner's test.
5. **Tools, then Approve, then UX.** The same cut, one tab at a time. The Tools tab starts by
   copying its own three drawing files — `figma-ingest-form.ts`, `figma-layers-view.ts` and the
   tab entry — into `tools/`, with the seat's own tags, then the slice. The server copy follows
   the handoff's step 4. Each tab's own copies stay its own; only the database is shared.
6. **The backend keys, the behavior run, the sunset.** The handoff's remaining steps.

One place per commit. The type check after each. The behavior walk after each.

## The proof, and the build boundary

- `npx tsc -b --noEmit` must pass.
- `node design_A2UI/tests/four-layers.mjs` reports zero missing definitions, imports or catalogue
  entries (29 names, 35 catalogue components).
- Each place's behavior walk on the running app at 5001: every press above, in the place that was
  copied. A copied function that no longer answers its own press is a defect.
- The node proof for the load: the frame, the rail and the slots are the same elements before and
  after a rail press.
- `npm run parity:design2` opens 4173, which serves the built folder, so it requires a build. We
  are not building during development; the rendered check waits for the owner's word. The type
  check, the action walk and the node proof are the gate until then.

## What does not change

- The gestures, the pull and its stop, and the five boxes.
- The approval flow.
- The current Design seat and every file under `frontend/src/rooms/design`. Nothing in it is moved
  or deleted. The current front end and the current back end are not edited at all.
- Every file under `backend/`, and its keys. The current route file and its modules stay.
- The current app's ports, 5001 and 8000. The bench uses its own.
- The data: no package, conversation or message is moved, renamed or rewritten.
- The built folder. No build during this work.
