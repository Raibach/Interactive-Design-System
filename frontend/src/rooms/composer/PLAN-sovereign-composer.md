# PLAN — the Composer becomes its own room, and the sandbox is deleted

> Written 2026-10-24 and approved the same day. The Composer was built first, when the shell was
> new and the tangle was small; this plan untangles the center. It moves the Composer's operating
> system as one unit, gives the Console its own share first, deletes the sandbox and the dead
> project/conversation management in the same cut, then gives the Composer its own workspace and
> chat.

## What I confirmed before planning

You were right about the dead management, and I was too generous calling the shell clean. The shell
holds **about 200 lines of dead project and conversation work**: it loads projects at mount and
writes state nothing reads, the "projects" path in the run pipeline cannot be reached, the session
loader waits for an event nothing sends, two version handlers wait for a component that is never
drawn, and `gateTimings.ts` has no importer. No tab gate remains.

The rest is **not dead**. About 850 lines open, save, rename, describe, delete, restore and adopt a
package's conversation, and run the prompt. That is the Composer's operating system, and it moves
into the Composer's room rather than being deleted.

The sandbox is mounted only for the Composer. It goes. The shared workspace is not Composer-only —
Console, Design, Governance and the ingest preview also mount it — so it stays for them. The shared
chat is the Composer's only live tenant, and it moves in the last stage.

## What the person will see

The Composer opens the way it does today: a blank prompt when the tab is chosen, a saved package
when a card or a route names one, the same sections, the same chat, the same save and run, the same
repair loop. The Assembly spinner and the failure panel remain, drawn by the Composer's own room
rather than by a shared sandbox. No sandbox exists behind any tab after this cut.

When the last stage lands, the Composer's workspace and chat are its own elements with the same
drawing, and the shared ones are left to the rooms that still use them.

## What the architecture documents require

The application's own documents state the target, and this plan follows them:

- `WritingAreaIndex.tsx` is **not** a universal container. Its only job is navigation: the tab bar,
  the header, the active tab, the shared session/package id, and the lazy room imports. Target: at
  most 1,000 lines, with zero room behaviour left in it (`THE_SHOJI_ROOMS.md`, "Folders, not a
  component library"; `THE_CALM_SURFACE.md`).
- The system is partitioned by folder, not by a shared component library. Every tab owns a folder,
  and a tab may hold its own shell file. The Composer's folder is
  `frontend/src/rooms/composer/`.
- The package is the unit of work (`THE_PACKAGE_CONTRACT.md` §1). The shell owns login, the left
  navigation, the evaluation lens, and choosing which package to open (§5). The package owns its
  conversations, versions, audits and corrections. Grace is scoped to a package, not global (§3).
- The database is the application (§9). A package's open and closed state, its versions, its runs
  and its conversations are rows; browser memory is a view of a row, never the record.
- The first three seats — System, User and Agent — are the first three sections of the package's
  prompt in the Composer's left column. The move preserves their content, order and behaviour; it
  moves the machinery around them, not the seats.
- The conversation rules C1–C9 (`THE_CONVERSATION_CONTRACT.md`) travel with the package. A package
  always has somewhere to talk, the seat reads the package's own record, and no turn is sent on a
  guess. The move must not weaken them to make the extraction easier.

## Stage 0 — one Composer folder, and the n8n fact

**What the person will see.** Nothing changes on screen. This stage makes the record true before
any code moves.

There are two Composer folders today:

- `composer/` at the repository root: `CHANGELOG.md` (the zone log, 2026-10-05 and 2026-10-15) and
  `THE-COMPOSER-IS-A-PURE-A2UI-SURFACE.md` (the surface map, 2026-10-15).
- `frontend/src/rooms/composer/`: `ComposerBox.tsx`, `ComposerRoom.tsx`,
  `useComposerSurfaceWriters.ts`, `CHANGELOG.md` (2026-10-24) and this plan.

The root folder is not a duplicate to delete blind. It is the only copy of the zone's early history
and the only copy of the surface map, and the map is now stale: it names the deleted
`components/lit/ai-surface-sandbox.ts` at lines 28–29 and 152, and it describes the shell as the
surface host. `frontend/src/rooms/README.md:43` points at `composer/` for `ComposerBox`,
`ComposerRoom` and the plan, but those files live in `frontend/src/rooms/composer/`; the pointer is
wrong.

The order:

1. Read `composer/THE-COMPOSER-IS-A-PURE-A2UI-SURFACE.md` line by line against the current room.
   Keep every fact that is still true, correct the sandbox and shell claims, and save it into the
   room folder as `SURFACE.md`.
2. Append the two root changelog entries (2026-10-05, 2026-10-15) to
   `frontend/src/rooms/composer/CHANGELOG.md`, oldest at the bottom. The room changelog is newest
   first.
3. Fix `frontend/src/rooms/README.md:43` to point at `frontend/src/rooms/composer/`.
4. Move `composer/` to `runtime/archive/composer-zone-docs-2026-10-24/` with a one-line reason:
   its map and its history now live in the room folder. Do not delete it until the move is verified.
5. Delete nothing else. `frontend/src/assets/composer-image-bg.webp` is used by `App.tsx`,
   `pageHelpers.ts`, `register.ts`, `ProductBox`, `ComposerBox` and `index.html`; it stays.
   `frontend/src/assets/_old/composer-image-bg.jpg` and the root `images/composer-*` files have no
   references; they can be archived after a fresh search confirms zero importers.
   `runtime/box-reference-2026-10-18/` is a reference snapshot; leave it.
   The `Raibach_IDS copy 2` tree is not the live application; do not touch it.

**The n8n fact.** The Composer does not contain a running n8n. No n8n process, container or
`~/.n8n` exists. `n8n/` (4.2 GB), `resources/`, `n8n-data/` and `lit_design-catalogs/` are gitignored
reference material on disk; nothing imports them. The canvas uses `@vue-flow/core` 1.48.2, the same
version n8n's canvas uses, and the Agent Flow elements (`agent-flow.ts`, `vueFlowCanvas.ts`,
`eval-feed.ts`, `when.ts`) copy n8n's geometry. The flow's saved state is
`metadata.workspace.graph`. Moving the Composer moves those elements and their registrations; it
does not move an n8n dependency tree.

**Verify.** The room changelog contains the old entries; `SURFACE.md` has no `ai-surface-sandbox`
reference; `rooms/README.md` points at the room; `npm run typecheck` is zero; no code changed.

## Stage 1 — the Console keeps its own share (prerequisite)

The shell currently holds the assembly state and the repair stages that the Console also uses. They
have to leave the shell with the Composer, so the Console takes its own first:

- `ConsoleRoomContainer` calls `useAssembleSurface` itself and owns its assembly state. The shell
  stops passing `assembleSurfaceThenRepairs`, `aiAssemblyFailed`, `aiAssemblyReport`,
  `isAIAssembling` and `loadingMessage` to `ConsoleBox`.
- The repair stages become a small shared store, `shared/repairStages.ts`. The Composer writes the
  stages it is working; the Console reads them and writes its own tree. The shell's `repairStages`
  state and the `consoleTreeWriterRef` writes for repairs leave it.
- The trace subscription leaves the shell. The Composer and the Console each subscribe to
  `lib/trace-source` and write their own tree; the shell's dual-write effect (which writes both
  trees) is deleted.
- The `assembleSurfaceThenRepairs` wrapper moves out of the shell into a shared helper both rooms
  call.

Verify the Console before going on: cards draw, assembly and repair rows still appear, the
typecheck is zero.

## Stage 2 — the Composer box, the dead management, and the sandbox (one cut)

New in `frontend/src/rooms/composer/`:

- `ComposerBox.tsx` — `data-room-box="composer"`, the Composer ground (`composerBackground` over
  `#582846`, 100% stretch, top left), the room box and the container.
- `ComposerRoomContainer.tsx` — the Composer's operating system: the surface tree and its writer,
  the renderer reference, the assembly state, the run pipeline, the package restore, the save and
  run-state handlers, the title and description handlers, the conversation adoption, the section
  writes, the draft writes, the canvas and flow directors, the repair prompt, the unsaved-changes
  state and its `beforeunload` guard, and the decision dialog.
- `ComposerRoom.tsx` — the pane: the surface host with the sandbox's box contract (flex fill,
  minimum sizes, the scroll viewport), the centered amber-ring spinner with `aiAssemblyMessage`,
  the failure panel with its pointer and diagnostics, and the decision dialog above the surface.
- `useComposerRoomState.ts` — the state and handlers moved out of the shell, following
  `useConsoleRoomState`.

The shell keeps only navigation and routing:

- `handleTabChange` loses its Composer branch; the box assembles on mount (blank, or the package
  the route names).
- The card and route doors become a request: the shell stores `{sessionId, tab}` and switches to
  the Composer; the box consumes it on mount and on change. `useOpenCardFromConsole` keeps its
  Product and Design branches and returns a Composer request for everything else.
  `openCardDepsRef` is deleted.
- `handleOpenPromptFromConsole` becomes that router. Console and Governance still call it.
- The route's initial intent and `?title=` fact are passed to the box; the current behavior is
  preserved, including the fact that the title parameter does not name the new prompt.
- The shell's render becomes the header, the left navigation, the six room boxes, and the
  `SentryErrorBoundary`. The sandbox mount and its ground constants are deleted.

Folded into the same cut, as you chose:

- The dead project branch: `loadProjects`, the `Project` and `Conversation` state and types,
  `activeTab`/`setActiveTab`, and the `conversation-updated` listener in the run pipeline.
- The session loader: `sessionLoadingState`, its listener, and the `SessionLoader` render.
- The two unreachable handlers: `restore-output` and `load-section-content`, after confirming
  `VersionManager` is never rendered.
- `pendingSectionsRef`, which is never assigned.
- The dead barrier fields in `useNotificationGate`; the hook keeps the tab state and the
  persisted-tab guard.
- `frontend/src/gate/gateTimings.ts`, the whole file.

The sandbox's retirement, all layers:

- Delete `components/lit/ai-surface-sandbox.ts` and its import in `register.ts`.
- Remove its tag-registry entry, schema and `SHELL_TAGS` line; its `registry.json` entry; its two
  catalog declarations and `$ref`s.
- Regenerate the generated manifests (`custom-elements.json`, `catalog-tree/*`,
  `catalog-audit/*`); do not hand-edit them.
- Update the comments that name it in `ProductBox`, `useNotificationGate` and `a2ui-renderer`.

Verify: blank Composer; route package opens; a Console card opens it; save writes; a run draws the
flow; the conversation is adopted; the unsaved dialog appears; the sandbox count is zero on every
tab; the other rooms draw; the typecheck is zero.

## Stage 2c — the package: the database note and the move

**What the person will see.** The Composer opens, edits, saves, versions and runs a package exactly
as it does today. The difference is where the work lives: the Composer owns it, and the shell holds
only the tab and the package id.

### The current state, checked 2026-10-24

The typecheck is zero. The Composer opens in the browser: one box at z-index 40, the three seats
(System, User, Agent), the Save Template and RUN controls, the chat seat, Trace, Tools and Evals.
No `ai-surface-sandbox` reference remains in code or manifests; the remaining references are in old
documents. The package work, however, is still in the shell. That is the unfinished stage, not
damage to the room.

### The database note, read 2026-10-24

Connection: `postgresql://localhost:5432/railway`.

`prompt_sessions` has 326 rows. Only 11 carry a prompt (`left_column_content` is not empty). The
others belong to other rooms and must not be read as Composer packages:

| session_type | rows |
|---|---|
| (none) | 235 — a mix of Composer packages and Product builder runs |
| design_master | 59 |
| governance | 21 |
| design_tab | 5 |
| design_catalogue | 3 |
| console | 2 |
| design | 1 |

28 rows have a conversation, and 1 is archived. `THE_PACKAGE_CONTRACT.md` §10 measured 0 rows using
`prompt_sessions.conversation_id` on 2026-09-15; that measurement no longer holds. The column is
populated today, so this stage must not assume it is vestigial and must not retire it.

A Composer package is:

- `left_column_content`: JSON `{"sections":[{"section","role","content"}]}`. This is the prompt,
  and its first three sections are the seats.
- `compiled_output`: the run's compiled text. Non-empty means the package has run.
- `current_version`, and `prompt_versions`: one row per version with `version_number`,
  `left_column_content`, `compiled_output`, `change_type`, `created_by_user_id`, `overall_score`
  and `score_breakdown`.
- `conversation_id` into `conversations`, with the turns in `conversation_messages`. The package
  contract says the package owns its conversations through `conversations.session_id`; the pointer
  on the package row is still present and populated. The move must read the package's conversation
  through the contract's path and treat the pointer as a compatibility fact until it is retired
  deliberately.
- `metadata` with these keys on a real package: `draft`, `savedBy`, `llm_used`, `workspace`,
  `ai_compiled`, `column_widths`, `ai_description`, `initial_conversation_id`.

`metadata.workspace` is the opened and closed state, and it is where the screen's memory lives:

| key | what it holds |
|---|---|
| `flow` | `panX`, `panY`, `zoom` for the Agent Flow canvas |
| `seat` | `{open, width}` for the chat rail |
| `graph` | `{nodes, edges, label}`; each node carries `kind`, `family`, `rowIndex`, `x`, `y`, `state` (`idle`, `done`, `failed`) |
| `middle` | which view the middle column holds (the sample holds `"flow"`) |
| `run_column` | the saved A2UI tree of the run column: `workspace-layout` with `left-col`, `right-col`, `middle-col`, `control-bar` and their children |
| `leftCollapsed` | boolean |

`metadata.draft` is the unsaved payload; `metadata.column_widths` is `{chat, left}`;
`metadata.ai_compiled` becomes `"true"` after the compile.

The run is not one flag. A package that has run carries four facts together: `compiled_output` is
not empty, `metadata.ai_compiled` is `"true"`, `run_evaluations` has rows for the session, and
`workspace.run_column` and the graph's node states describe the screen. `run_evaluations` holds one
judged row per run (`verdict`, `sentence`, `run_at`, `trigger_kind`); the table has 56 rows.
`prompt_context` has 0 rows and nothing uses it.

Two data faults are already there and are not this stage's work: `Insurance Technology Scout`
exists twice with the same version 7 and the same content, and `Repair — annotation-missing on mod`
exists twice, one with a workspace and one without. They must survive the move unchanged.

### The package cluster in the shell

The package is not one hook. It is a cluster, and the dependency stands: it moves as one unit.

State and refs: `currentPromptSession` (584), its id and object refs (613–616), `isSavingPrompt`
(585), `promptLoadKey` (611), `hasUnsavedChangesRef` (668), `storedWidthsRef` (622),
`runApprovedRef` (629), `heldRunRef` (636), the repair refs (680–788), `flowInputRef` (813),
`carriedPositionsRef` (826), `flowFactsRef` (828), `draftPayloadRef` (1249),
`assembledRunColumnRef` (416), `lastAssemblyIntentRef` (189).

Handlers: `handleCreateNewPrompt` (1573), `saveRunState` (1670), `handleSavePrompt` (1702),
`handleOpenPromptFromConsole`, `handlePromptTitleChange`, `handlePromptDescriptionChange` (2145),
`writeDraftSystem` (1193), `writeDraftPayload` (1251), `showDraftColumn` (1339),
`showOutputColumn` (1449), `deletePackage` (3265), `removePackageFromConsole` (3247),
`handleConversationChange` (3296), and the Composer branch of `handleTabChange` (3091).

Hooks: `useRunPipeline` (1,287 lines), `useRestorePackageWorkspace` (221), the package half of
`useShellEventListeners` (679), and the tree that `useComposerSurfaceWriters` writes into.

The Console reaches the same work through `onOpenPrompt`, `onCreateNew` and the delete listener. The
initial route reaches it through `routeSessionId` and the mount effect. Those are two open paths
today; they become one request with one consumer.

### Stages

**2c.0 — safety and a second check.** Branch from the current tree. Dump the five tables that hold
a package: `prompt_sessions`, `prompt_versions`, `conversations`, `conversation_messages`,
`run_evaluations`. Record one package and its version chain as the fixture (the sample used for this
note is `16831321-a42d-45c4-a89a-0bc799585322`, version 3, three versions, a run column and a
graph). Take a browser baseline of open, edit, save, run, close and reopen, with a hard reload
between passes. Do not test on the 11 live packages; create a test package for the destructive
checks and delete it at the end.

**2c.1 — the read path.** Create `rooms/composer/useComposerPackage.ts` with the package state and
the load and restore path: the row, the version chain, `metadata.workspace`, the column widths, the
conversation, the draft. `ComposerRoom` calls it; the shell passes only the session id from the
route and the Console's open request. Verify a card and a route open the same package with the same
sections, widths, seat open and closed, flow pan and zoom, graph node states and run column. The
database is unchanged.

**2c.2 — the write path.** Move the section writes, title and description, the draft, save and
versioning. A save writes `left_column_content`, `compiled_output`, `current_version`,
`metadata.workspace` and a new `prompt_versions` row. The unsaved-changes decision moves with the
guard. Verify by comparing the row and the version count before and after, and by reopening the
package.

**2c.3 — the run path.** Move `useRunPipeline` and the evaluation feed. A run writes
`compiled_output`, `metadata.ai_compiled`, `workspace.run_column`, the graph states and one
`run_evaluations` row. Verify a successful run, a failed run and a repair verdict. The Evals tab
still reads the same rows.

**2c.4 — the Console boundary.** The Console's cards ask the package owner to open, create or
delete; they do not call the shell. Choosing which package to open stays shell-level per §5; the
list and the choice remain on the Console. Use one small service for the table calls, not shell
state. Verify the eight Console cards, open, delete on a test package, and the Composer's unsaved
decision.

**2c.5 — the workspace and chat copies.** The existing Stage 3, unchanged: the Composer's own
`composer-workspace` and `composer-chat-panel`, the four registration layers, and the Design room's
tag map.

**2c.6 — the sweep.** Remove the package code left in the shell. Measure the line count against the
1,000-line target. Update the room changelog with the database checks and the browser result.

### Rollback

Every stage is a branch commit. The database needs no migration, so the dump in 2c.0 is the
recovery point. If a write path fails, restore the five tables from the dump and return to the
previous commit; the shell's package code stays callable until its replacement is verified. The test
package, not a live one, is the destructive fixture. A Lit element change is verified after a hard
reload, never in the tab that was already open.

## Stage 3 — the Composer's own workspace and chat

- `composer-workspace.ts` — a whole copy of `components/lit/workspace-layout.ts`, retagged
  `composer-workspace`, self-registering.
- `composer-chat-panel.ts` — a whole copy of `components/lit/chat-panel.ts`, retagged
  `composer-chat-panel`, self-registering. Its pieces stay the shared parts; only the seat is the
  room's.
- Publish the two names in the four layers: the `prompt-composer` catalog, the tag registry, the
  backend's `render-composer` and `render-session` branches, and the runtime imports in the
  Composer's room.
- The Design room consumes the Composer's surface root: update the design branch's emitted tags,
  add `composer-chat-panel` to `useDesignConsole`'s rename map, and make `DesignSeatShell`'s
  workspace query accept `composer-workspace`.
- The shared `workspace-layout` stays for Console, Design, Governance and the ingest preview. The
  shared `chat-panel` has no live tenant after this stage; its file and registrations are left for
  a later, separate check because three backend prompts still name it even though those trees are
  unwired.

Verify: the Composer's surface names its own tags; zero shared seats on the Composer; the seat
binds the package conversation; Design, Console and Governance still draw; the typecheck is zero.

## Stage 4 — the sweep and the record

- Audit the shell for Composer state, handlers, the sandbox, and the dead management; measure the
  line count.
- Write `rooms/composer/README.md` and `CHANGELOG.md` with the measured result, the package and
  conversation path, the rail, the four registration layers, and the open items.
- Update `rooms/README.md` and the two pointers in `composer/`.

## The dependencies — the center of the yarn

- The run pipeline, the canvas and flow directors, the save, the section writes and the restore are
  interdependent. They move as one unit, not piece by piece.
- The Console's assembly, repair rows and trace must have their own home before the shell's copy
  leaves.
- The box unmounts when another tab is selected, exactly as the surface does today. The
  `beforeunload` guard goes with it; that is correct, because the editable surface goes too.
  Cross-tab preservation would be a new behavior and is not in this cut.
- The route has two open paths today (the route effect and the initial intent). Make them one
  request with one consumer.
- The Design room reads the Composer's surface root; a new tag that only the Composer knows breaks
  Design silently.
- The sandbox has four registration layers plus generated manifests. Miss one and the validator
  still offers a tag nothing defines.
- Do not delete the shared workspace; it has other tenants.
- Do not silently fix the `?title=` no-op.
- The repair stages are a cross-room fact; a shared store is deliberate, not a leak.

## Status (2026-10-24)

- **THE OWNERSHIP PASS IS DONE (this pass).** The Composer room calls `useComposerProvider`
  itself; the page no longer calls the package holder or the actions and is **463 lines**. The
  Console owns open, create and delete in `useConsoleCardActions.ts`; the Product owns its thread
  line and draft system in `useProductThread.ts`. The shell keeps the tab, the boundary facts,
  the initial Console assembly and the mounts. `canvas/useShellEventListeners.ts` and
  `rooms/useOpenCardFromConsole.ts` are deleted. Verified on 5001: a fresh package saved
  (`98662bc4…`), reopened from its Console card with its text; a throwaway package was deleted
  through the Console's arm → CONFIRM and its row was gone; every room mounted with no page
  error. **The tunnel at 4173 still serves the previous build.**

- **The remaining actions moved.** `useComposerPackageActions.ts` owns the delete, the draft loop,
  the column views, the conversation adoption, the create request and the title-query effect. The
  page is **2,564 lines**, down from 3,508. The live package opened through the moved code and a
  fresh package saved through it. The delete's card test did not complete; its throwaway row was
  removed directly. The draft and column view tests in the browser are still owed.
- **The rename, the create and the drawing writes moved.** The package holder owns the rename;
  the page leaves the create to the room; `ComposerRoom` writes the renderer, the prompt header,
  the busy flag and the output. Verified: the live package opened through the room. The page is
  **2,992 lines**. The delete, the draft writes, the two column views, the conversation change and
  the window-listener call remain.
- **The six package calls are one holder.** `useComposerPackageStack.ts` holds the package state,
  the tree, the writers, the Save, the run-state write and the description write. The page calls
  it once; the Save reads the page's functions at call time. Verified: the live package opened
  through it, and a fresh Save wrote a test package with its sections, workspace, conversation
  and description; the test package was deleted. The page's handlers and effects that read the
  holder remain.
- **Stage 0 — done.** The root `composer/` folder is archived at
  `runtime/archive/composer-zone-docs-2026-10-24/`. Its early history is in this room's changelog,
  its map is `SURFACE.md` corrected for the sandbox deletion, and `rooms/README.md` points at the
  room. No live pointer names the removed folder.
- **Stage 1 — done.** The Console owns its assembly instance, its failure state, its trace
  subscription and its repair rows (through `shared/repairStages.ts`). Verified on 5001: eight
  cards, the Console's seat, no sandbox involvement. Typecheck zero.
- **Stage 2a — done.** The dead management is out of the shell: the project loader and its state,
  the session loader and its listener, the two unreachable version handlers, `pendingSectionsRef`,
  the dead notification-gate fields, the `gateTimings.ts` file, and the run pipeline's project
  listener and switch handlers. The shell is **3,802 lines** (from 4,097). Typecheck zero.
- **A regression found and fixed on the way.** The Console box covered the shell's left navigation.
  The box now sits at z-index 40, and Design and Product follow the same rule. Verified: the panel
  opens above the Console and receives the pointer.
- **Stage 2b — partially done.** The sandbox is deleted across every registration layer and its
  generated manifests, and the Composer's surface host is a real box (`ComposerBox`,
  `ComposerRoom`) at z-index 40 beneath the shell's navigation. The surface writers moved into
  `rooms/composer/useComposerSurfaceWriters.ts`; the shell calls the hook and keeps the tree. The
  shell is **3,509 lines**. Measured: sandbox count zero, one renderer, one layout, one seat with
  the Composer's tabs, three starter sections, the Console still drawing eight cards and the
  Composer's box at 40. **Still in the shell:** the package state — open, save, run, drafts,
  restore, title/description, the repair prompt, the unsaved decision. Moving it into the room is
  the next step.
- **Stage 2c.1 — in progress.** The package state and the surface tree are in
  `useComposerPackage.ts` and `useComposerSurfaceTree.ts`; the Composer's half of the assembly is
  in `applyComposerSurface.ts`; the assembly instance, its spinner and failure state and the
  decision dialog are in `useComposerAssembly.ts` and `ComposerDecisionDialog.tsx`; and both open
  paths are inverted. The live package opened through the Composer's engine (version 3, five
  seats, the flow, the run output, four conversations). The package-state hooks are still called
  by the shell; the title, draft, delete and create handlers remain.
- **The last cut — the provider.** The package, tree, save, run-state and assembly state move
  into a `ComposerPackageProvider` in this folder that wraps the shell's content. The shell's
  prompt header, the window event listeners and the Composer read one context, and the shell
  calls no package hook. The Console's card list, the navigation and the repair store stay
  shell-level, as the package contract says.
- **Stage 2c.2 — in progress, the Save verified end to end.** The section reader, the title and
  description writes, the whole Save handler and the description write are in the room
  (`useComposerSurfaceTree.ts`, `useComposerSave.ts`, `useComposerFacts.ts`). A blank Composer
  saved as `96d9cf47-46df-489c-abc5-6cb2eea853e3`, version 1, with the three sections, the
  workspace, a conversation and a generated description. The test package is the run fixture and
  is deleted after the run cut. The title write waits on the Console card boundary; the draft
  writes are shared with the Product room.
- **Stage 2c.3 — started, the run verified end to end.** The run-state write is in
  `useComposerRunState.ts`, and the run listeners now mount with the room through
  `useRunPipeline`; the shell supplies the remaining dependencies. Verified on the test package:
  the flow drew, the answer and the evaluation landed, a second conversation was filed, and the
  workspace was saved on the run. The test package was deleted; the live package is unchanged.
  The pipeline's internals and the assembly state and decision remain to move.
- **Stage 3 — not started.** The Composer's own workspace and chat copies, with the four
  registration layers and the Design room's tag map.

## What this plan does not do

- It does not change the Composer's visible design, its rail, its seat, or its behavior.
- It does not add live Composer state across tab switches. The package's saved state is read back
  from its row, and an unsaved edit is the package's draft, not the shell's memory.
- It does not redesign the Console, Design or Governance beyond giving the Console its own services.
- It does not delete the shared `chat-panel` file, and it does not touch the Development tool's
  work.
- It does not promise a line count; the shell is measured after each stage, and the target is
  navigation and box mounts only.
