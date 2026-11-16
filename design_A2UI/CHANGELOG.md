# Design A2UI — log

## 2026-11-16 — the Approve tab's fake seat removed, and Home's arrangement back in its own sheet

**Home.** Home's seat draws its rail and its panel itself again. `chat/design-chat-seat/view.ts`
has no wrapper element and no slot attributes, and `chat/design-chat.styles.ts` carries the row,
the panel, the output region, the composer and the folded state once more. Measured on a fresh
page: the column is 104 wide at load, which is the door's own `isThirdOpen: false`; one press
opens it to an 846-wide panel with a 784-wide thread; a second press folds it and hides the
panel; the gripper resizes the column in both directions.

**The removal.** `approve/approval-chat.ts` — a hand-written element that drew the chat's
furniture with no conversation behind it — and the layout element
`surface-design/parts/chat-layout.ts` are deleted, with their registry entries. `registry.json`
(30 names) and `catalog.json` (36 components) are re-exported from the one source.

**The Approve tab.** It names `chat-panel` again and reads the console's package and
conversation, with its own package, script and turns branches removed. Measured on the page:
`design2-chat`, panel `tab-approvals`, the pending cards in the left column, one conversation,
the response card, the action bar, the input and the tray. It still speaks with the Chat tab's
script, because the tree states a script only for the Chat tab and the chat element is reused
from tab to tab; the tab's own script waits for a seat of its own. The surface's read of one
conversation's turns and `/surface/turns` are kept for that seat.

**The proof.** `npx tsc -b --noEmit` passes. `node design_A2UI/tests/four-layers.mjs` reports 30
names, 36 catalogue components, one missing definition (`design-left-panel`, missing before this
work), no missing imports and nothing absent from the catalogue.

## 2026-11-16 — one surface, one renderer, one data model

**The save bug.** `tools/ToolsSeat.tsx` is mounted once and kept headless; its `design-left-save`
listener answered the UX footer's Save too and wrote a Tools session the press had already
replaced. The listener now answers only while Tools stands, except a leave's forced Save.

**The four layers.** `design2-tools-chat`, `design2-ux-chat`, `design2-review-view` and
`design2-ux-app-frame` are in the catalogue, the registry source and the shell's allowlist, and
their modules are imported. The catalogue is 35 components (6 primitives and 29 names);
`registry.json` is 29 names.

**The repair list.** `chat-repair-actions` keeps its wire name; its tag is
`design2-repair-actions`. The frame and both stylesheets select the new tag, and
`chat/left/repair-actions.ts` is imported. The old tag returns zero.

**One tree.** `surface/load.ts` no longer takes the chat or the left column out of the door's
tree; `surface/components.ts` selects the tab's left, middle and chat children;
`DesignSeatShell.tsx` creates one `<a2ui-renderer>` and keeps it. The left column's second
renderer, the per-tab chat creation and the property-copying loop are gone. The chat's props are
`{path}` bindings to `/surface/*`, and the renderer's missing path emits `VALIDATION_FAILED`,
which the room shows.

**The frame.** `design2-workspace` draws the left column's ledger and wait as its own overlay.

**The proof.** `npx tsc -b --noEmit` passes; `node design_A2UI/tests/four-layers.mjs` reports 29
names, 35 catalogue components and zero missing definitions, imports or catalogue entries. The
running page has not been re-measured.

**Still open.** The Tools chat is one 5,645-line component with a large internal assembly; its
places are the next cut. The shell's kernel imports, the server routes and the `enabled: false`
gate remain.

## 2026-11-15 — the seat becomes sovereign, and the application's room is archived

**The tree.** The folder now holds the plan's interface tree: `surface-design/surface/` (the frame,
the rail, the left and middle containers, `load.ts`, `components.ts`, `data.ts`), `chat/` (the seat,
its places, its parts, its assets), `tools/`, `approve/` and `ux/`. The flat copy of
`frontend/src/rooms/design` and the parallel `chat-surface-design/` root were removed. The seat's
own renderer files (`design-renderer.ts`, `chat-surface-design/renderer.ts`, `renderer.test.ts`) were
deleted; the shell's renderer is the one renderer.

**The names.** Every element in the folder is `design2-*`. The 27 living names were renamed in the
definitions, the template tags, the `createElement`/`querySelector` calls, the JSX declarations and
the CSS selectors; `design-workspace` became `design2-workspace`, `design-chat` became
`design2-chat`, and the room's `design-renderer` was removed with its registrations.

**The catalogue and the registry.** `surface-design/registry.ts` now declares the seat's whole
allowlist — the chat's eighteen names and the room's seven, composed into one table — and
`surface-design/catalog.ts` derives the schema from it. The two exports are
`catalog.json` (28 components) and `registry.json` (22 names with their tags). The shell's loader
finds them through two file links at
`frontend/src/components/A2UI/catalogs/surface-design/{catalog,registry}.json`, six levels up;
the server's directory scan lists `surface-design` as a partition and
`GET /api/catalog/surface-design/registry` answers the seat's table. No line of the loader changed.

**The renderer's table.** `frontend/src/components/lit/a2ui-renderer.ts` gained a `system`
property: empty everywhere as before, it lets a surface name the registry table its names resolve
through. The seat's load and its left column set it to `surface-design`, so the seat's names draw
the seat's elements and the application's allowlist answers only after that table.

**The load.** `surface-design/surface/load.ts` (284 lines) owns the top-tab load: it reads
`POST /api/design/console`, reads the envelope, renames the door's seat to the room's name, and
takes the chat and the left application out of the tree with its own `takeChat` and `extractLeft`
(the former `inject.ts` was inlined and deleted). It preloads the seat's registry, creates the
shell's `<a2ui-renderer>` with `system="surface-design"`, and assigns the tree only when its key
changed. `components.ts` (140 lines) states the tree and registers the seat's own elements;
`data.ts` (122 lines) owns `/surface/*` and the rail's data write.

**The mount.** `DesignSeatShell` keeps the host and the renderer across a rail press and replaces
only the tab's chat and view; the left column's reference and the drawn key travel with it. Measured:
the frame, the rail and the slots are the same elements before and after a press, and
`/surface/tab` moves while the tree does not.

**The shell's four edges.** `components/lit/register.ts` no longer imports `rooms/design`'s renderer
or chat; `shared/EmbeddedWarmup.tsx` imports the seat's `design-tool`; `rooms/console/useConsoleCardActions.ts`
imports the seat's `pendingOpen`; `pages/WritingAreaIndex.tsx` mounts the seat for the Design tab and
matches the seat's `room-ready` report to that tab. The type check reports zero errors.

**The archive.** `frontend/src/rooms/design` (80 files) moved to
`archive/frontend-src-rooms-design-2026-11-15/`. A search for imports of the room outside its own
folder returns none; what remains of the path is comments and catalogue descriptions.

**The Tools tab.** `tools/tools-tab.ts` (100), `tools/figma-ingest-form.ts` (295) and
`tools/figma-layers-view.ts` (2,461) were copied from the application with the seat's tags
(`design2-tools-tab`, `design2-figma-ingest-form`, `design2-figma-layers-view`), together with the
generated row the tree renders (`tools/design2-f-40001207-3559.ts`, 211). The seat registry maps the
three names the tools door emits, and the left column resolves them through the seat's table.
Measured: the Tools tab draws the form and the tree with zero refusals.

**The chat seat, merged.** `chat/design-chat.ts` and `chat/chat-tab.ts` were 4,737 and 4,743 lines
and differed in 28. They are now `chat/design-chat-seat.ts` with a `conversationSource` property
(`'seat' | 'console'`) choosing the conversation module and the package, and the two pages are 48
and 47 lines.

**The chat seat, split.** `chat/design-chat-seat/view.ts` (269), `events.ts` (79), `state.ts` (138),
`actions.ts` (233), `send.ts` (464), `replies.ts` (306) and a barrel; the seat is 3,440 lines. The
send and reply actions are attached to the element at connection, not wrapped; the derived readers
and the default open are attached in the constructor because the shell's first call can reach them
before connection.

**The atomic default open.** `chat/design-chat-seat/defaults.ts` holds `ensureDefaultConversation`:
it re-reads the package's list before deciding, adopts the row that exists, creates only when a
successful read found none, and shares one run per session in the page. Two full page loads opened
the same conversation and created none; the database's count for the session was unchanged. The
cross-page window remains the server's to close with a get-or-create.

**The UX seat, deduplicated.** Fourteen `ux/parts/` files became twelve-line wrappers over the chat
seat's elements, defining the UX tags; `ux/conversations.ts`, `ux/frame/chat-frame.ts` and
`ux/thread/actions/sessions-lane-clear.ts` became re-exports, and the seven input action files became
one barrel. `design-chat-messages.ts` (differing by 381 lines), `design2-ux-output-header.ts` and the
UX stylesheet stayed. The folder went from 39 files and 16,199 lines to 33 files and 9,938.

**The UX seat, merged and split.** `ux/ux-chat-seat.ts` holds the class `UxChatSeat` and `ux/chat.ts`
is 19 lines. Then `ux/ux-chat-seat/defaults.ts` (60), `state.ts` (128), `view.ts` (431) and
`actions.ts` (1,849) took the default open, the opening values and derived readers, the render, and
the send, greeting, reply, workspace context, conversation create, sessions lane and tab press. The
seat is 3,449 lines; the folder is 38 files and 10,112 lines.

**Measured at 5001.** The Design tab and the Design A2UI tab draw `design2-workspace` with
`design2-chat-tab` in the right column and zero refused components; the rail's press keeps the frame
and swaps the chat; the Approve page draws its review list; the Tools tab draws the form and the
catalogue tree; the UX tab draws its application, its greeting and the UX tags; a Chat-tab message
was sent and answered ("Hello — good to have you here in the Design room's Chat tab."). The UX
message round trip was attempted and produced no visible reply; it is not proven.

**What remains.** The Tools tab's server routes are still the application's; the chat seat's
conversation presses and the UX seat's remaining readers are not split; the UX round trip needs a
direct test; and the cross-page duplicate-conversation window belongs to the server.

## 2026-11-15 — the Chat seat's own registry

- `chat-surface-design/registry.ts` is the seat's allowlist: 18 names the surface may emit, each
  mapped to this seat's own `design2-*` tag, with the props and events the element declares. It is
  the seat's, not the section's; the Tools and UX seats get their own.
- The readout's entry was checked against the element and corrected to its five actual props
  (`line`, `attributed`, `tokens`, `calls`, `readoutFilled`); the other entries are the props and
  events the seat binds today.
- Next in this layer: the room's registry (the workspace, the footer) and the seat's catalog — the
  same names with their schemas — then the renderer resolving through this map.

## 2026-11-15 — a self-describing surface, and why the catalog and registry are copied

- The rule is written in `RULES.md`: a surface describes itself through its own four layers, its
  own data binding and its own assembly; reading the folder is enough to know what it can draw
  and do.
- The copies are deliberate: each seat must pass its test from its own catalog, registry, runtime
  and names. A shared element would make a failure in one seat a failure in both, and neither
  sovereign.
- Consolidation into a central repository is a later, optional act, made only after every seat is
  sovereign and proven; then the sharing is a choice with a fallback, not a dependency.

## 2026-11-15 — the turn's host announcements are their own file

- `chat/thread/turn/host.ts` holds the four announcements the seat answers: `a2ui:system-message`
  (a display line with the host's own marks), `section-write-failed` (the prompt did not change,
  as an alert), `a2ui:ask-grace` (a silent request, with the already-run package released without
  a call) and `a2ui:grace-status` (the build's stage, scoped to this seat's conversation).
- `design-chat.ts` and `chat-tab.ts` delegate; the four bodies and the channel note are gone from
  the seats. `HostTurnHost` is the narrow contract.
- What remains in the seat's turn is `_send` and the reply processing, then the scroll state.

## 2026-11-15 — the Chat seat's thread data is its own file

- `chat/thread/data.ts` holds the two rules: the merged turns (the conversation is the source of
  truth; a local turn the surface has returned is released) and the results fact (a result turn,
  or a package with an archived row; the console is not a package).
- `design-chat.ts` and `chat-tab.ts` delegate both getters; the merge and the archive read are
  gone from the seats.
- The thread place now has its view, its data, its actions (reply, sessions clear) and its cards.
  What remains on the seat is the turn (`_send` and the reply processing) and the scroll state.

## 2026-11-15 — the Chat seat's thread view is its own file

- `chat/thread/view.ts` holds the output card: the one scroller, the thread or the tab's own
  view (the trace fold, the sessions feed, the host's view slot), the inspections fold and the
  drawn scrollbar. It takes the seat through `ThreadHost` and owns no state.
- `design-chat.ts` and `chat-tab.ts` render `${threadView(this)}`; the 114-line card block is one
  call. The seat's render is now the composition: the spacer, the slot, the rail, the output
  header, the conversations card, the thread, the input and the tray.
- The thread's data and its scroll state remain on the seat; they are the data and state steps,
  and the turn (`_send`) is the remaining large unit.
- The TypeScript check is pending: it is an environment issue (`/bin/zsh: ENOENT`), not a code
  dependency, and the environment fix is separate from this refactor.

## 2026-11-15 — the UX surface hosts an application

- The rule is written in `RULES.md`: the UX tab frames the running analytics application at
  `/posthog`; the application is a COMPONENT OF THE SURFACE, one node in the surface's tree with
  its address as data. The surface hosts the application; it never draws a second copy of it.
- It loads exactly as it does in the living site, and the refactor never rewrites the framed
  application, its address or its screens.
- The frame is already its own element (`ux/ux-app-frame.ts`) and owns no data; it is the UX
  slice's application, not a unit to rebuild.
- The live site is the behavior to match for every seat: the extraction moves code, never the
  person's experience.
- The UX chat's six input actions and its sessions clear are already its own files.

## 2026-11-15 — the UX seat's input actions and the seats' sessions clear

- `ux/input/actions/` holds the six input actions with its own host and barrel;
  `ux/thread/actions/sessions-lane-clear.ts` holds the feed's clear. `ux/chat.ts` delegates.
- `tools/thread/actions/sessions-lane-clear.ts` is the Tools copy; `tools-chat.ts` delegates.
- The three seats keep dedicated code; only the database is shared.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the Tools seat's input actions are its own files

- `tools/input/actions/` holds `send.ts`, `stop.ts`, `message-sent.ts`, `composer-key.ts`,
  `draft-input.ts` and `product-paste.ts`, with its own `host.ts` and `index.ts`. Dedicated code
  per seat; only the database is shared.
- `tools/tools-chat.ts` delegates; the six bodies are gone from it.
- The Tools reply handler is NOT the Chat reply: it answers the preview's own actions
  (`preview-discard`, `preview-remove`, `preview-keep`). It gets its own extraction, not a copy.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the thread's turns are their own file

- `chat/thread/cards/turns.ts` holds the turn's role, the rich-text renderer and the turn
  template. It hands the links to the action-links slice and the click to the element.
- `chat/thread/cards/types.ts` holds `ChatMessage` and `ChatConversation`; the element re-exports
  them so the public import path is unchanged.
- The messages element delegates the turn rendering; `_roleOf`, `_richText` and the inline turn
  template are gone from it.
- The thread's styles and the seating (`seatConversation`, the highlight scroll) stay with the
  element for now; they are the drawing and the scroll policy, and they are the remaining part of
  the cards split.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the thread's cards split: action links and the work card

- `chat/thread/cards/action-links.ts` holds the reply-link parser, the button template, the two
  spent rules and their styles. The messages element calls it; its own copies are gone.
- `chat/thread/cards/work-status.ts` is the work card as its own element (`design2-work-status`):
  the clock, the stage trail, the shimmer and the collapse. The messages element renders the
  child and no longer carries the clock or its styles.
- `chat/thread/cards/index.ts` is the barrel.
- The messages element is smaller and delegates both units; its turn template and seating are the
  remaining pieces of the cards split.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the reply's buttons are one file

- `chat/thread/actions/reply.ts` holds the pressed-action handler: the bracket unwrap, the spent
  mark, the way out, the eleven edit dispatches, run, the wireframe, edit-node, save, title,
  remove, the refusal for an unknown command, and the sentence that goes to the model.
- `design-chat.ts` and `chat-tab.ts` delegate; the 235-line handler is a three-line call.
- The seat's 5,400-line files have lost the input, conversations, rail, frame and sessions
  actions and this one; the remaining work in the seat is the thread view and the state.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the rail's tab press is its own file

- `chat/rail/actions/tab-change.ts` holds the press, the room-owned announcement, the per-tab
  conversation switch and the trace prompt it owns.
- `design-chat.ts` and `chat-tab.ts` delegate; `RailTabHost` is the narrow contract.
- `chat/frame/actions/output-window.ts` and `chat/thread/actions/sessions-lane-clear.ts` complete
  the small presses.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the conversations actions and the two small presses are files

- `chat/conversations/actions/` holds one file per action: `pick.ts`, `select.ts`, `toggle.ts`,
  `keyboard-toggle.ts`, `new.ts` and `remove.ts`, with `host.ts` and `index.ts`.
- `chat/frame/actions/output-window.ts` holds the box bar's press.
- `chat/thread/actions/sessions-lane-clear.ts` holds the sessions feed's clear.
- The seat's methods delegate; the behavior is unchanged. The create and remove processes stay on
  the seat until the conversation step, and the presses call them through the host.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the input place's six actions are their own files

- `chat/input/actions/` holds one file per action: `send.ts`, `stop.ts`, `message-sent.ts`,
  `composer-key.ts`, `draft-input.ts` and `product-paste.ts`, with `host.ts` for the narrow
  contract and `index.ts` for the barrel.
- Each action takes the seat through `InputActionHost`; the seat passes itself with the same cast
  the frame uses. The six methods on both seat files delegate, and the behavior is unchanged.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the conversations card leaves the seat

- `chat/conversations/view.ts` holds the card's chrome: the bar, the icon, the node ids, the new
  conversation mark, the list and the note. It takes the status line, the open flag, the note, the
  rows and the three callbacks.
- The rows are still built by the seat (`_conversationRowsForList`), because the list read and the
  remove are the conversation place's actions and they move in a later step.
- `design-chat.ts` and `chat-tab.ts` call the view; their render loses the card block. The new mark
  still stops propagation and starts the seat's own new-conversation path.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the input place leaves the seat

- `chat/input/view.ts` holds the action bar and the typing box. It takes the labels, the flags,
  the input's height and the six callbacks, and returns the template. The place is the chat's
  input, never the Composer room; the old `composer/` folder is a one-line re-export because the
  word collided.
- `design-chat.ts` and `chat-tab.ts` call it; their render loses the two elements. The wrapper
  stays in the seat because it is the container and it also holds the tray.
- No handler moved: send, stop, the message-sent path, the keyboard, the draft and the paste
  remain the seat's.
- The type check is pending: the shell is unavailable.

## 2026-11-15 — the rail and the tray leave the seat

- `chat/rail/view.ts` holds the navigation bar's markup. It takes the rail's values and the two
  callbacks and returns the template; the seat still answers the tab press and the collapse.
- `chat/tray/view.ts` holds the foot: the product room's tools, or the seat's own tray. It takes
  the four flags and the two product callbacks.
- `design-chat.ts` and `chat-tab.ts` call both views; their render loses the two blocks. No
  handler moved, so the behavior is unchanged.
- The type check is pending: the shell is unavailable. The copy's type check runs on its return.

## 2026-11-15 — the first extraction: the Chat tab's component tree

- `chat/components.ts` holds the five slot names and the element tags the Chat tab binds to them.
- `design-chat.ts` and `chat-tab.ts` import `CHAT_SLOT_TAGS`; each `frameSlotTags` is now one line
  returning the constant. The two files lose their own copies of the map.
- Structure only: no drawing, no data and no handlers moved.
- The type check is pending: the shell is unavailable. The copy's type check runs on its return.

## 2026-11-15 — the shell holds a link, not the seat

- The rule is written in `RULES.md`: the React shell is navigation; its one tab for this seat is a
  link to this folder, and the shell never imports this folder's code.
- The test is the deletion: remove `design_A2UI/` and the living application still runs; the tab
  fails honestly, reporting that its surface is gone.
- Measured in the living application: it holds no import, alias, type-check include, package
  script or registry entry for this folder. Pressing the tab reports the missing surface.

## 2026-11-15 — the folder matches the tab name

- The seat folder is now `design_A2UI/`. The type check include, the resolver target and the parity
  command point to it.
- The import alias `@design2`, the tab key `design2` and the element prefix `design2-` remain
  internal names; they do not change with the folder.
- Type check, production build and rendered parity pass; the parity shows zero pixels different.
- `HANDOFF.md` is the entry point for the next engineer.

## 2026-11-15 — the seat is duplicated and wired

- The current Design seat was copied into `surface-design/`; its tags, classes and imports were
  renamed. The current seat was not edited, moved or deleted.
- The Design A2UI tab was wired into the shell. The flag in `surface-design/tab.ts` is recorded but
  not yet enforced.
- Each sub-tab has its own furniture and its own conversation file: `chat/`, `tools/`, `ux/` use
  their own parts, frame and readout; `console/` and `approve/` keep their own code.
- Type check, production build and rendered parity pass; the parity shows zero pixels different.
- The seats are still 5,000+ lines. The next job is the behavior split: data binding, user actions,
  conversation and turn, one file at a time.

## 2026-11-15 — the foundation is written down

- The left container moved to `surface-design/leftColumn.ts`; the console data stays in
  `chat-surface-design/console/useDesignConsole.ts`.
- The documents now state: the room is one surface; the left and middle containers and the five
  right slots are stable; a tab may add furniture inside a slot or container; the furniture is
  assembled once and a tab press is a data rebuild; the model reads the tab's folder as its
  context.
- The next job is the behavior split of the 5,000/6,000-line seats.

## 2026-11-15 — one surface, many sub-surfaces

- The documents state the room is one surface. The tabs are navigation within it through its
  sub-surfaces; a tab press changes the active sub-surface and the data, never the surface.
- The current shell still creates a page and a seat per tab (`openSeat`). That correction is part
  of the behavior refactor.
