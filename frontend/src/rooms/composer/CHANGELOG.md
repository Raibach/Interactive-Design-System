# Composer room changelog

## 2026-10-24 — conversations save themselves, and each belongs to its package

- **A spoken turn is written, not held.** The first person's turn in a blank Composer asks the
  host to create the package as a **draft** (hidden from the Console) and its conversation
  before the turn is sent. Both messages are then written immediately. No Save is pressed, and
  no turn waits in the browser.
- **Verified in the database:** the first test turn created package
  `a8aa21ff-decd-4331-80d1-27e58c3ead77` with `metadata.draft = true` and conversation
  `5a10b970-6d53-4128-9b2a-34b8aa60ad61`; `conversations.session_id` is that package id, and the
  conversation holds the person's line and Grace's reply.
- **The count moves when the thing it counts moves:** the seat's own read of the package's
  conversations returned one row, and the header reads "1 Conversation".
- **Save promotes the draft:** Save Template cleared `metadata.draft`, wrote version 1, and left
  the conversation attached. The Console excludes the draft until then, so speaking does not
  litter the card list.
- **The Console needs no Save button:** its package already exists, so its turns write
  immediately. That remains the Console's own seat.

## 2026-10-24 — the Composer owns the Composer

- **The page holds none of it.** `composerStack` and `composerActions` are gone from
  `WritingAreaIndex.tsx`. The page is **463 lines**, from 2,564. The Composer's room calls
  `useComposerProvider` itself, and that hook owns the package, the Save, the run's dependencies,
  the assembly, the decision, the repair, the flow, the canvas writers and the Composer's window
  events. The page keeps the tab bar, two boundary facts (unsaved work, the open package id), the
  Console's first-load assembly and the room mounts.
- **The Save was dead and is fixed.** After the move the save handler was never put back into
  `handleSavePromptRef`, so Save Template and the canvas foot called an empty function. The
  provider now fills the ref during render. Verified on 5001: a fresh package saved as
  `98662bc4-404d-4ff7-831a-381d5113fb25`, version 1, with the User seat's text; opening its card
  from the Console read the text back.
- **The repair is the Composer's, wherever it is pressed.** A `repair-finding` from another
  room's seat becomes an intent the page hands to the Composer room, which runs the repair. The
  Composer's own events mount with the room.
- **The duplicates are gone.** `canvas/useShellEventListeners.ts` and
  `rooms/useOpenCardFromConsole.ts` were deleted. The Composer's events, the Console's card
  events and the shell's navigation now each have one file.
- **Not done:** Stage 3, the Composer's own workspace and chat copies. The tunnel at 4173 still
  serves the previous build; 5001 is the verified copy.

## 2026-10-24 — the card list follows the package id

- **The error.** After a package was removed from the Console, the surviving cards showed the
  description and version of the card beside them. The card grid rendered the list by position,
  and the identity the whole system uses is the package id. The card element and the grid were
  byte-identical to the original copy; removing a card exposed that the list did not use the id.
- **The fix.** The grid now renders with a keyed repeat on the package id. The workaround — clear
  the list and re-assemble the Console — was removed before it shipped: it would have hidden the
  identity error and left the structure wrong. The rule: the package id is the identity of
  everything underneath it.
- **The database note.** The missing rows in the local database are the owner's own delete test,
  made before this fix. The dump at `runtime/backups/composer-package-2026-10-24.sql` and the
  owner's desktop backup are the recovery. Nothing in this room deleted them.
- **The page.** The package's handlers, effects, save, run, assembly and decision are in this
  room. Its assembly and drawing dependencies are built here now; the page passes the package
  holder and the shell facts. The run dependency object, the save fill and the listener call are
  the wiring left to move.

## 2026-10-24 — the package state leaves the shell

- **The package's state now lives in `rooms/composer/useComposerPackage.ts`.** The open package,
  the save flag, the load key, the listener refs, the held run and the draft ref moved out of
  `pages/WritingAreaIndex.tsx` with no behavior change. The shell calls the hook and keeps the
  same names until the call site inverts.
- **The surface tree moved with it.** `useComposerSurfaceTree.ts` owns the component list and the
  data model the renderer draws. The shell reads and writes it through the same names; the
  writers and the handlers follow in the next cuts.
- **The run-state write moved too.** `useComposerRunState.ts` reads the place off the room's own
  elements (`workspace-layout`, `room-embed`, `agent-flow`) and writes only
  `metadata.workspace`; the shell calls it for the save and the run. The shell is **3,378
  lines**; the three package hooks are 89, 27 and 143 lines.
- **The Save handler moved.** `useComposerSave.ts` owns the whole save: the sections, the name,
  the widths, the place, the version write, the conversation adoption and the console
  re-assembly. The shell assigns the hook's handler to the same ref the Save button, the decision
  dialog and the run pipeline read. The shell is **3,132 lines**; the save hook is 303 lines.
- **The package's fact readers and writers moved with the tree.** `surfaceSections`, the title
  write and the description write live in `useComposerSurfaceTree.ts`; the shell's reasoning and
  call sites stay. The tree hook is 84 lines.
- **The remaining actions moved.** `useComposerPackageActions.ts` owns the delete, the draft loop
  (the drag write and the stored layout), the two column views, the conversation adoption, the
  create request and the title-query effect. The page is **2,564 lines**, down from 3,508 when
  this work began. Verified: the live package opened through the moved code, and a fresh package
  was created through the moved Save. The delete's card test did not complete — the card's confirm
  control did not stay available across the two clicks — so that throwaway row was removed
  directly. The draft and column views are moved and typechecked; their UI tests are still owed.
- **The rename, the create and the four drawing writes moved.** The rename lives in the package
  holder and writes the surface and the Console card. The create leaves `render-composer` for the
  room instead of assembling from the page. The renderer feed, the prompt header's id and version,
  the busy flag and the compiled output are written by `ComposerRoom`, only while it is mounted.
  The live package opened through all of it. The page is **2,992 lines**, down from 3,508 when
  this work began. The delete, the draft writes, the two column views, the conversation change and
  the window-listener call remain in the page.
- **The six package calls became one.** `useComposerPackageStack.ts` holds the package state, the
  surface tree, the writers, the run-state write, the Save and the description write. The page
  calls that holder once. The Save reads its shell dependencies at call time, so it no longer
  captures a render that lacked them. Verified: the live package opened through the holder, and a
  blank Composer saved as `4ed77406-6bc4-4979-ab11-be2f85224701` (version 1, sections, workspace,
  conversation, description). The test package was deleted. The page still holds the handlers
  and effects that read the holder's values; they are the next pass.
- **The assembly instance and the decision dialog moved.** The Composer now calls
  `useAssembleSurface` with its own spinner, failure state and decision state; the shell's
  instance serves the Console only. `ComposerDecisionDialog` draws the save-or-discard question
  in the room. The live package opened through the Composer's engine. The unsaved dialog was not
  exercised, because the live package's prompt column is collapsed and the test did not expand it.
  The shell is **3,055 lines**; the assembly hook is 147 and the dialog 40.
- **The run pipeline mounts with the room.** The shell builds the remaining run dependencies;
  `ComposerRoom` calls `useRunPipeline`, so the run listeners exist only while the Composer is on
  screen. Verified end to end on the test package: Grace held the empty prompt, the offered fills
  were taken, the run drew the flow (System, User, Agent, Answer, Evaluation), the answer and the
  failed-on-placeholder evaluation landed, a second conversation was filed, and the workspace was
  saved on the run. The test package was deleted; the live package remains at version 3.
- **The Save cut is verified end to end.** A blank Composer saved as
  `96d9cf47-46df-489c-abc5-6cb2eea853e3`: one version, the three starter sections, a workspace,
  a conversation and a generated description. The test package was deleted after the run cut.
- **The description write moved.** `useComposerFacts.ts` writes the description to the row, the
  React copy and the surface; an unsaved package is told it will be carried by the next Save.
  The typecheck and the build are zero. The title write stays until the Console card stops being
  written from the Composer.
- **The tab click inverted.** The shell's `handleTabChange` no longer clears the thread or
  assembles the Composer. It leaves `render-composer` and the unsaved context; `ComposerRoom`
  clears the thread and asks for the surface. Verified: the Composer tab drew a blank prompt with
  its three seats and zero conversations.
- **The open path inverted.** `useOpenCardFromConsole` no longer assembles the Composer. It
  dispatches `composer:open`; the shell sets the tab and the pending intent; `ComposerRoom`
  consumes the intent and calls the shared assembly itself. The card open was verified through
  the new path: version 3, five seats, the flow, the run output, four conversations.
- **The Composer's half of the assembly moved.** `applyComposerSurface.ts` turns a
  `render-composer` or `render-session` answer into the package's state, and the decision surface
  into the decision payload. The console's assembly hook calls it; the package open was verified
  through it. The console hook is 461 lines, down from 600; the helper is 180.
- **Measured.** `npm run typecheck` is zero; the built page opens a real package from a Console
  card with version 3, its five seats, its flow, its run output and four conversations. The
  create, open, delete and decision handlers, the writers' call and the assembly call site are
  still in the shell; they are the next cut.

## 2026-10-24 — the sandbox is gone; the Composer has its own box

- **The person sees the same Composer.** A blank prompt on the tab, a saved package when a card
  or a route names one, the same sections, the same chat, the same save and run. The assembly
  spinner and the failure panel are the same drawings.
- **The room owns its surface host.** `ComposerBox` paints the composer image over `#582846`,
  sits at z-index 40 beneath the shell's left navigation, and mounts `ComposerRoom`. The room draws
  the surface host, the centered amber ring with its one sentence, the failure panel with its
  pointer and diagnostics, and the renderer. The left navigation opens above it and receives the
  pointer.
- **The A2UI sandbox is deleted, not hidden.** `components/lit/ai-surface-sandbox.ts` is gone; so
  are its import in `register.ts`, its tag-registry schema and entry, its `SHELL_TAGS` line, its
  `registry.json` entry, its two catalog declarations and `$ref`s, and its comments. The generated
  manifests (`custom-elements.json`, `catalog-tree/*`, `catalog-audit/*`) were regenerated, not
  hand-edited. `npm run catalog:check` completes with advisories only.
- **Measured on 5001.** On the Composer: one composer box at z-index 40, the sandbox count is
  zero, one renderer, one `workspace-layout`, one `chat-panel`, one room root. On the Console:
  eight cards, its box at 40, its own seat, no sandbox. `npm run typecheck` is zero. The shell is
  **3,705 lines** (from 3,802 before this cut, 4,097 before the dead-management cut).
- **The first block of the operating code is out of the shell.** The surface writers — the section
  patch, the section list, the compiled output, the two busy flags, the flow and the evaluations —
  live in `rooms/composer/useComposerSurfaceWriters.ts`; the shell calls the hook and keeps the tree
  it writes into. The shell is **3,509 lines**.
- **What is not done yet.** The Composer's package state — open, save, run, sections, drafts,
  restore, title/description, the repair prompt, the unsaved-changes decision — still lives in the
  shell; moving it into this room is the next stage. The room's own copies of the workspace and the
  chat, with their four registration layers, follow it. The shared elements stay for the Console,
  Design, Governance and the ingest preview.

---

The entries below are preserved from the root `composer/CHANGELOG.md` when the zone's folder moved
into the room on 2026-10-24. The surface map they name now lives here as `SURFACE.md`.

## 2026-10-15 — the zone's first map, and the design-update plan

The composer had no notes of its own — only this log, the code, and the A2UI documents — so the
map begins here: `THE-COMPOSER-IS-A-PURE-A2UI-SURFACE.md` draws what the room is (the
server-assembled surface, the prompt column's element chain, the bindings, and the window-event
surface the model drives the prompt with), each claim pointing into the code that owns it.

The companion plan for the owner's design-update project — restyle from Figma, ingest, approve,
live Lit catalog, refresh, the composer shows it — is filed in the Design zone:
`design/DESIGN-UPDATE-FLOW-PLAN-2026-10-15.md`, with the two doors the approve's write-set
allows and the protection list this surface must keep.

Both documents wait on the owner's word before any build work; nothing else in the zone changed.

## 2026-10-05 — the check reports to the shell again, behind ONE switch

`fetchCatalogHealth` — the chat bar's badge and the findings the shell resolves repairs against —
reads the real report again (`frontend/src/shared/catalogHealth.ts`; the hard "disabled" stub from
2026-09-29 is gone). The ONE switch now lives in the backend, `CATALOG_AUDIT` (default ON), and
both halves go through it: the shell's fetch and the backend readers (Grace's check rows,
`_repair_rows`; `routes/misc.py` `_read_catalog_audit`), so a flipped switch cannot leave the two
halves telling different stories. Owner's word on the plan's question: "align".

## 2026-10-05 — the log starts

**What this folder is.** The Composer zone's own shelf: the prompt-package composer — the room
where packages are built, run, and saved. Its catalogue is the gate for every payload it renders,
its checker's report lands at `frontend/catalog-audit/prompt-composer.json`, and a run's saved
state lives on the package's own row (`metadata.workspace`).

Entries land here as the zone's work lands.
