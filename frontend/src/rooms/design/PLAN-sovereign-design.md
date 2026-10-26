# PLAN — the Design room becomes its own box, and its chat its own files

> Written after reading the shell's design blocks, the live Design room, the design console's
> route, the chat, the tab gate, and the three finished rooms. Every claim below was read in the
> code. This is the current instruction. The original prompt is retired to
> `design/archive/PROMPT-sovereign-design.md`; the archive README records why.
>
> **Order change, 2026-10-24.** The owner moved the analytics application's startup pass ahead of
> the room. It is Stage 0 below, and its measured record is
> `design/POSTHOG-STARTUP-TRIM-2026-10-24.md`. The remaining feature trim is still Stage 7.

## What the person will experience

The person clicks Design and the room stands up as one thing: the light sheet behind the whole
room, the console's cards on the left, the chat on the right with its rail. The person clicks
Tools and the Figma application opens in the left column with its own conversation. The person
clicks UX and the analytics application opens in that column with its own chat view. Leaving
Design takes the whole room down in the click's own frame; returning stands it up again from its
own files. Nothing about the appearance changes.

What changes is ownership. The room owns its ground, its cover, its console, its chat, its Tools
application and its UX application. The shell keeps only the button that mounts the room's box.
The chat becomes a folder of small files instead of one 5,948-line file, and each tab of that
chat gets its own file when it has a face of its own.

## What I found

### The shell's design memory is already dead

Read in `pages/WritingAreaIndex.tsx`:

- `designTree` (`300–302`) never receives a value. `setDesignTree` is passed only to
  `useDesignPreview` (`4159`), and `setDesignPreview` is named only in an effect that has no body
  (`4249–4253`). Nothing calls it.
- `designRendererRef` (`841–842`) is attached to no element in the shell.
- `designPreviewOpen` (`477`) is declared with no setter.
- `useDesignSurface` (`953`) receives that unattached ref and returns at its first guard. The
  width effect (`4204–4247`) returns at `!designTree.components.length`.
- `isDesignView` (`497`) and the design arm of `workspaceBackground` (`520–521`) are the only
  live design facts in the shell, besides the room branch and its root marker.

The live room does its own work. `DesignSeatShell` fetches `/api/design/console` itself
(`112–162`), takes the chat entry out of the answer, keeps the console's left application, and
draws its own `design-renderer` (`475`).

**The prompt's Step 2 is therefore wrong.** It says to move `useDesignSurface` and
`useDesignPreview` into the container. They are inert. Moving them would move dead code. They are
deleted, and the live work stays where it already is.

### The live Design room

- `DesignRoom.tsx` (90 lines) mounts `DesignSeatShell` and the lazy Figma seat. It decides whether
  the console or the Figma content is standing, and listens for `design-tools-open` and
  `design-console-open`.
- `DesignSeatShell.tsx` (525 lines) is the real room shell: it fetches the design console, takes
  the chat out of the answer, keeps the card grid as the left application, creates the
  `design-chat` element once, mounts the UX chat in its view slot, creates the left column, and
  places the standing tab's application there. It chooses the conversation for Chat, Tools and UX
  from `console.design_packages`.
- The ground is painted today by the shell's sandbox workspace slot (`4642`), and the room's cover
  paints the same sheet again (`493–522`). `DesignSeatShell`'s root has neither the ground nor
  `data-room-root`; the shell wrapper (`4716`) carries the marker.

### Nine design files are dead or duplicated

- `design-chat-panel.ts` (5,948 lines, 322 KB) is a whole duplicate of the chat. The server
  normalizes `design-chat-panel` to `chat-panel` before it leaves `backend/routes/design_console.py`
  (`399–411`), and the room maps `chat-panel` to `design-chat`. Nothing emits
  `design-chat-panel`. It is dead.
- `DesignInterface.tsx` (243), `SeatShell.tsx` (311) and `chat-seat.ts` (63) have no importers.
- `DesignCards.tsx` (249) and `DesignConsole.tsx` (237) have no importers except each other. They
  are an older console mount. The live console is the left column inside `DesignSeatShell`.
- `DesignLoading.tsx` (51) has no importers.
- `useDesignSurface.ts` (80) and `useDesignPreview.ts` (193) are imported only by the shell and are
  inert, as measured above. The Tools seat has its own preview work; the shell's copy is not the
  room's.

The live files are `DesignRoom.tsx`, `DesignSeatShell.tsx`, `design-chat.ts`,
`design-renderer.ts`, `inject.ts`, `tools/` (1,090 lines) and `ux/` (776 lines).

### The chat is one file with every room inside it

`design-chat.ts` is a whole copy of the shared seat. It carries:

- Product: `productTools`, `productRoom`, the product tools and thread pieces, the attach and
  paste forwarding, and the product branches in the drawing.
- Governance: the sessions lane and `sessions-feed`, `governanceTrace` and
  `governanceObservation`, `evalsTalk`, the eval and trace views, and the trace prompt.
- The Composer's writing acts: the parsers for writing seats, tools, descriptions, merges, runs,
  saves and titles, and the prompt-section writing.

The Design rail does not allow any of those tabs. The server states the room's rail at
`DESIGN_CONSOLE_TABS` (`backend/routes/design_console.py:52`):
`chat,tools,executions,ux,settings`. The Design console's own answer also carries a repair view
(`chat-repair-actions`), which stays.

The tabs that have a face today:

| Tab | What it draws | Where its file belongs |
| --- | --- | --- |
| Chat | the thread, the input, the conversation list | the chat element and its job files |
| Tools | the Figma application | `tools/ToolsSeat.tsx`, with the seat's small binding in `chat/tabs/tools.ts` |
| UX | the analytics application and its chat view | `ux/ux-chat.ts`, which already exists |
| Executions | one sentence, "No runs yet…" | `chat/tabs/executions.ts`, holding the existing sentence |
| Settings | nothing; the rail button is documented as unwired | no file; a file here would invent a face |

### The tab gate still shelters Design

The shared switch cover still includes Design
(`frontend/src/rooms/useTabGate.ts:129`). Product and the Console have left that branch. Design
still draws the shared sheet for one frame and then its own cover. The design branch itself is at
`useTabGate.ts:242`: it dispatches `design-console-open` and moves the header.

The gate hides every `[data-room-root]` element in the click's own frame. The Design box will
carry that marker, so the hide works without new gate logic. Design leaves the shared cover
branch, and its own branch retires any cover already in flight.

## The rule behind the cut

The shell is a switcher. Each tab is an application with its own folder, its own ground, its own
gate, its own loading and its own memory. The Design room composes its applications: the console,
the Figma tool, the analytics application, and its chat. The shell knows the tab and the box, and
nothing else. This is why the shell shrinks when a room leaves, and why a change to one room cannot
reach another.

The chat follows the same rule inside the room. The Chat tab is the seat's own thread and stays in
the seat. Tools, UX and Executions each have their own face, so each gets its own file. Settings
has no face, so it gets no file. The seat's jobs — the thread, the conversations, the chrome and
the views — move into job files so that no single file carries the whole application.

## The target

```
frontend/src/rooms/design/
  DesignBox.tsx                  the room's ground, its root marker, the lazy room
  DesignRoomContainer.tsx        the room's boundary; no shell memory
  DesignRoom.tsx                 the room's one interface
  DesignSeatShell.tsx            the frame, the chat placement, the left column
  console/
    useDesignConsole.ts          the design console's read and its failure
    leftColumn.ts                the card grid, the UX frame, the standing application
  chat/
    design-chat.ts               the chat element: rail, panel, input, slots, the Chat tab
    design-chat.styles.ts        the existing styles, moved
    design-chat.types.ts         the existing types and constants, moved
    thread.ts                    history, greeting, context, send, reply
    conversations.ts             scope, list, create, delete, move, select
    chrome.ts                    scroll, thumb, output windows, grip, collapse
    views.ts                     empty view lines, view claimant, status
    tabs/
      tools.ts                   the Tools tab's conversation and standing tab
      executions.ts              the existing Executions sentence
  tools/
    ToolsSeat.tsx                the Figma application
    content.ts
    index.ts
  ux/
    ux-chat.ts                   the UX tab's own chat file
    quick-links.ts
  renderer/
    design-renderer.ts
    inject.ts
  CHANGELOG.md
  PLAN-sovereign-design.md
```

### The size rule

The chat is 5,948 lines today. The target is no new chat file over 1,500 lines. The seat's own
drawing is measured at each step. If the four job files and the per-tab files leave the seat above
1,500, the next cut is the same four jobs as controllers: each receives the chat element, owns its
job, and the drawing reads its answers. The statements move line for line; the drawing does not
change.

## The stages

### Stage 0 — the analytics application's startup, first

The person opens the UX tab and sees one loading face, then the application. The three-second
wait for feature flags that cannot arrive is gone, the preflight gate is gone, the OAuth startup
is gone, and the entry, the app gate, the shell and the scene all draw the same preloader. Capture
stays off. The measured chain, the cuts and the build are recorded in
`design/POSTHOG-STARTUP-TRIM-2026-10-24.md`; the screens, the data and the Figma ingest tool are
not touched.

### Stage 1 — Dead weight out, with no pixel changed

Delete `DesignInterface.tsx`, `SeatShell.tsx`, `chat-seat.ts`, `DesignCards.tsx`,
`DesignConsole.tsx`, `DesignLoading.tsx` and `design-chat-panel.ts`.

Remove from `WritingAreaIndex.tsx`: the `useDesignSurface` and `useDesignPreview` imports
(`72–73`), `designTree` (`300–302`), `designPreviewOpen` (`477`), `designRendererRef`
(`841–842`), the `useDesignSurface` call (`953`), `setDesignPreview` (`4159`), the width effect
(`4204–4247`) and the empty effect (`4249–4253`).

Keep the design branch (`4701–4721`), `isDesignView` (`497`), the design ground (`520–521`) and
the `designSectionBackground` import (`52`) until the box exists, because they still paint the
room. Remove the `design-chat-panel` import from `register.ts` when its file is deleted; a missing
import would break the typecheck at this stage.

Delete `useDesignSurface.ts` and `useDesignPreview.ts` after their calls are gone. Do not move
them.

Verification: typecheck is zero; the Design room looks and behaves exactly as before, because
none of the removed code ran.

### Stage 2 — One home

Move the contents of `frontend/src/design/` into `frontend/src/rooms/design/`, which already
exists. This is the room folder inside `frontend/src`; it is not the top-level `design/` that
holds the analytics source. The move merges into the existing folder rather than moving the
folder onto it, because the target already has a name.

Update the imports in `components/lit/register.ts`, `DesignRoom.tsx`, `DesignSeatShell.tsx`,
`tools/ToolsSeat.tsx`, `inject.ts`, `ux/ux-chat.ts` and `design-renderer.ts`. Keep the
`design-chat` and `design-renderer` registrations; the dead panel was removed in Stage 1. Move
this plan and the prompt with the room.

Verification: typecheck is zero, and the room is unchanged. This stage changes paths, not pixels.

### Stage 3 — The box

Create `rooms/design/DesignBox.tsx`:

- It carries `data-room-box="design"` and `data-room-root="design"`, and it owns the room's ground:
  `design-section2-bkg.webp` stretched over `#582846`, exactly the values the shell uses today.
- It mounts the room inside the marker with the key `design-root`.
- It keeps the lazy `DesignRoom` inside a `Suspense` boundary with the same empty fallback the
  shell uses today. The lazy boundary is what preserves the room's first paint.

Create `rooms/design/DesignRoomContainer.tsx` as the room's thin boundary. It renders
`DesignRoom`. It does not receive or recreate the shell's dead values. It does not need
`onAssemblingChange`: `ToolsSeat` declares that callback but never calls it, so the shell's
`setIsAIAssembling` handoff is dead and is dropped rather than moved.

In `WritingAreaIndex.tsx`:

- Mount `<DesignBox />` beside `ProductBox` and `ConsoleBox` (`4765–4789`), only while
  `headerTab === 'design'`.
- Remove the design branch from the sandbox (`4701–4721`).
- Remove `isDesignView`, the design arm of `workspaceBackground`, the `designSectionBackground`
  import, and the lazy `DesignRoom` import. Remove `lazy` and `Suspense` from the React import if
  no other use remains.
- The shell's `workspaceBackground` falls through to the Composer's ground, which is correct: the
  Design room no longer draws in the sandbox.

The tab gate is gone:

- Delete `rooms/useTabGate.ts`. The shell has one plain `handleTabChange`: the Composer clears and
  assembles, every other tab changes the header. There is no shared cover and no Design branch.
- The Console room asks for its own surface on every later entry; the initial page's assembly stays
  in the shell's mount effect. `assembleOnEntry` tells the room which mount it is, so the first
  paint is assembled once.
- The room's own box and cover are its gate. `DesignBox` carries the room root marker; nothing
  hides it in the click's frame now, and the room boxes unmount on the tab change.
- Do not set `setIsAIAssembling` for Design. The room's cover reports its own readiness.

Verification: the Design room draws with its own ground and its own cover; the console cards and
the chat stand; leaving and returning works; a Product → Design switch shows no ghost and no
shared sheet; typecheck is zero.

### Stage 4 — The console's own files

Move the live console out of `DesignSeatShell.tsx` into `console/`:

- `useDesignConsole.ts` owns the read (`112–162`): the `POST /api/design/console`, the envelope,
  the error, the cover-down fact, the console's application and its tree.
- `leftColumn.ts` owns the created left column (`195–241`) and the placement of the standing
  application (`360–445`): the `design-renderer`, the UX frame, the assembly cover, the card grid,
  and the switch between them.

`DesignSeatShell` composes these and keeps the chat placement. Nothing about the drawing changes.

The dead `DesignCards` and `DesignConsole` were deleted in Stage 1. Do not revive them. The live
console's error and cover are the room's own, and they stay.

Verification: the card grid draws from the design console; the retry and the error are the
server's words; the UX frame and the Figma application still swap in the left column; typecheck is
zero.

### Stage 5 — The chat's folder and files

The conversation/package design for the Tools and PostHog chats is planned separately in
`PLAN-tools-and-ux-chat.md`. This stage owns the chat's files; that plan owns the database rows, the
Tools view and the UX conversation.

**5a. Move, do not change.** Move `design-chat.ts` to `chat/design-chat.ts`. Update the
registration import. The room must draw the same element. Verify before splitting.

**5b. Sever the other rooms.** Remove only what the Design rail and the Design console's answer
prove unused. Keep every line a Design tab still reads.

- Product: `productTools`, `productRoom`, the `chat-product-tools` and `chat-product-thread`
  imports, the attach and paste forwarding, and the product branches in the drawing. The Design
  console emits no product properties and the rail has no product tab.
- Governance: the sessions lane and `sessions-feed`, `governanceTrace`, `governanceObservation`,
  `evalsTalk`, the eval and trace views, the trace prompt and its constant. The Design rail is
  `chat,tools,executions,ux,settings`; the server sends `tracePrompt: false` and no governance
  properties.
- The Composer's writing acts: the parsers for writing seats, tools, descriptions, merges, runs,
  saves and titles, and the prompt-section writing. Audit each one: the Design console's Grace does
  not write into prompts, and the Figma application owns its own ingest. Remove the acts whose only
  reader is gone; keep any act a Design tab still emits.

Keep the design console's own hello, the conversation list, the new-conversation path, the package
conversations for Chat, Tools and UX, the repair view the console emits, the rail, the scroll, the
grip and the collapse.

**5c. Move the styles and the types.** Move the style block (`1671–2250`) to
`design-chat.styles.ts` and the types and constants (`50–188`) to `design-chat.types.ts`. The
element imports them. No statement changes.

**5d. Move the pure helpers.** The empty view lines (`2369–2385`), the conversation row mapping,
the status line and the tab-to-conversation choice are answers, not drawings. Move them to
`views.ts` and to the smallest file that owns their job.

**5e. Give each tab its own file.**

- Tools: `chat/tabs/tools.ts` holds the Tools tab's conversation choice and the seat's standing
  tab. The Figma application stays in `tools/`.
- UX: `ux/ux-chat.ts` already is the UX tab's own file. It stays beside its application; it is the
  template for the other tabs.
- Executions: `chat/tabs/executions.ts` holds the existing sentence. No run view is invented.
- Settings: no file. The rail button is documented as unwired, and the seat's plain empty line is
  the truth. A file here would invent a face.

**5f. Split the seat's jobs if the seat is still over 1,500 lines.** Move the thread, the
conversations, the chrome and the views into `thread.ts`, `conversations.ts`, `chrome.ts` and
`views.ts`. Each file receives the chat element and owns one job; the drawing in
`design-chat.ts` reads their answers. The statements move line for line; the drawing does not
change.

Verification after each sub-step: typecheck is zero; the chat draws the same; the rail's five
buttons still stand; the Chat, Tools and UX conversations still switch; the repair view still
draws; the input still sends; no other room's property or act remains.

### Stage 6 — Verification and the record

- On `localhost:5001`, on a fresh document: the Design room's ground, the console's cards, the
  chat, the rail, the Tools application, the UX application and its chat.
- Leave Design for Product and for the Console: no frame of Design survives underneath.
- Return to Design: the room stands up again from its own files.
- `rg` the shell for `designTree`, `designRendererRef`, `designPreviewOpen`, `useDesignSurface`,
  `useDesignPreview` and `isDesignView`: no result.
- `rg` the chat for `productTools`, `sessions-feed`, `governanceTrace`, `evalsTalk` and the
  Composer's writing parsers: only the files that still own a live act.
- File sizes: every chat file at or under 1,500 lines; the seat's own drawing is the measured
  exception only if Stage 5f has not run.
- Typecheck is zero. Run the catalog check only if a registered name changed; no catalog entry is
  added or removed in this plan.
- Do not rebuild the preview or the tunnel without the owner's word. If he asks, match the asset
  hashes across `dist`, the preview and the tunnel.
- Write each stage into `rooms/design/CHANGELOG.md` with what was measured.

### Stage 7 — the analytics application's deeper trim, later

The startup pass is Stage 0. This stage is the feature and content trim, started only after the
room is closed. The person keeps the screens the studio uses and loses the vendor-only weight:
experiments, surveys, feature flags, replays, cohorts, billing, onboarding, the cloud move, and
the remaining OAuth and cloud code. The navigation keeps only the screens that answer a question
the studio asks. The data and the UX chat stay.

- Read `design/posthog-master/OURS.md` and the UX observability plan before changing a screen.
- Remove a feature only when nothing in the kept screens reads it; prove each with a search.
- Keep one door at `/posthog`, one sign-in through our backend, one frame and one loading face.
- Keep the UX chat in `ux/ux-chat.ts` and its direct Grace door `/api/teacher/query`.
- No React shell growth.

## What I will not touch

The shared chat parts, the design console's server route, the catalog, the analytics application's
screens and data until Stage 7 (Stage 0 touched only its startup), the Product, Console and
Governance rooms, the rooms' own gates (the shared tab gate is deleted; the Console and Composer
entries are the shell's plain handler), and the room's visual design. No new element, no new
catalog name, no fallback, and no dismiss button.

## The traps

- The dead hooks must be deleted, not moved. Moving `useDesignSurface` or `useDesignPreview` would
  carry the shell's dead values into the new room.
- The room root marker belongs on the box. The shared gate's outgoing hide is gone with the gate;
  the room boxes unmount on the tab change. DesignSeatShell's own root has no marker.
- The ground belongs on the box, not on the chat. A ground on the chat travels with the column.
- The chat element must be defined before the console's answer is read. The registration import
  stays with the room.
- The server's trusted name is `chat-panel`; the room maps it to `design-chat` in one place. The
  dead `design-chat-panel` name is removed, not kept as a second mapping.
- The repair view is emitted by the Design console even though `repair` is not a rail tab. It
  stays.
- The Tools seat has its own preview work. The shell's preview copy is not the room's.
- `onAssemblingChange` is declared but never called. Drop it; do not pass it to the container.
- The UX frame itself is unchanged. The application's startup is Stage 0; its deeper feature trim
  is Stage 7.

## What the person should see at the end

The Design tab looks the same. The difference is that leaving it takes it down completely, and
returning builds it from its own folder. The shell no longer carries a design tree, a design
renderer, a design preview or a design width. The chat is a folder, not a 5,948-line file. The
console has its own files. The Tools and UX applications have their own files. The next tab can
leave the shell without touching Design, and Design can change without touching the next tab.
