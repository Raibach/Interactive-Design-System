# `src/rooms/` — one folder per room

The page (`pages/WritingAreaIndex.tsx`) is the shell: navigation, the surface host, and the
plain tab switch between rooms. Everything that belongs to ONE room is
lifted out of it and lives here, in a file named for the job it does. **Every file's first line
states what it owns** — read that, not this index, if the two ever disagree.

## The rule

| where | what belongs there |
| --- | --- |
| `rooms/<room>/` | the shell-side wiring for that room — the hooks and handlers lifted out of the page |
| `src/<room>/` | the room's own application (design's seat and tools, console's gate and assembly) |
| `rooms/useOpenCardFromConsole.ts` | a console card's door: it opens whichever room owns the card |
| `rooms/evals-mount.ts` | the evals injection: deliberately outside both the page and the seat |

## The rooms

**`product/`** — 17 files, the whole product room:

- `ProductRoom.tsx` — the room's markup: the pane, the frame, the seat slot, the empty state, the stopped-engine banner, the exit question
- `useProductRoomState.ts` — the room's own state: tree, open package, project, seat's settled hand, stage key, grip, refs, artifact
- `useProductGate.ts` — the room's opening: its two faces, its clocks, its lift rule
- `useProductSeat.ts` — the seat binding: rail tabs, pane width, the settled hand
- `useProductDraft.ts` — the draft effect: node moved / added / selected / cleared
- `useProductNodeEdit.ts` — the node-edit effect, with its spoken refusals
- `useProductConversationPoll.ts` — the 2.5 s engine poller
- `useProductBuildWireframe.ts` — `a2ui:build-wireframe` → assemble → draft PUT
- `useProductAttachment.ts` — the room's attachment upload
- `useAssembleProductSurface.ts` — the room's own (unwired) A2UI assembly
- `useOpenProductRoom.ts` · `useGuardProductExit.ts` · `useDiscardProductProject.ts` — the door, the exit question, the discard
- `useCheckBuilderEngine.ts` — asks the builder whether it is up
- `useWriteProductDraftPayload.ts` · `useWriteProductArtifactPayload.ts` — the two writes into the engine
- `types.ts` — `DraftPayloadShape`

**`governance/`** — `GovernanceBox`, `GovernanceRoomContainer`, `GovernanceRoom`, its own chat
panel and its chrome hook.

**`design/`** — its box, room, container, seat shell, own chat, tools and UX chat.

**`development/`** — its box, container, pane, behaviour, own workspace and own chat.

**`composer/`** — `ComposerBox`, `ComposerRoom`, the surface writers, the surface map, the plan and
the changelog; the room's own workspace and chat follow with the next stage.

## Still in the page (2026-10-24)

- **Every room is its own box.** The page mounts `<ProductBox />`, `<ConsoleBox />`,
  `<DesignBox />`, `<DevelopmentBox />`, `<GovernanceBox />` and `<ComposerBox />`.
- **The Composer** has its own box and room; the sandbox is deleted. Its package management is
  still in the shell and moves into `rooms/composer/` in Stage 2c of its plan.
- **The shell** keeps the header, the tab buttons, the left navigation, the door routing and the
  box mounts.

## The fallbacks and error suppression, as they stand (2026-10-25)

The inventory asked for after this morning's session. Each entry names one place where the
application answers a failure or a wait without telling the person, and what the person actually
sees. Nothing on this list is removed without the owner's ruling.

- **The error screens.** If a room or the shell itself crashes, the person sees an error screen
  instead of a blank page: `App.tsx:102` (the whole application) and `WritingAreaIndex.tsx:463`
  (the room area). The room area's handler also ends the pressed tab's ring when a failure is the
  answer, so the error is never covered by the ring (`WritingAreaIndex.tsx:468`).
- **The three empty stand-ins.** While a piece of the application downloads, nothing is drawn and
  the person keeps seeing the ground underneath: `App.tsx:127` (the page itself),
  `LeftVerticalMenu.tsx:654` (the left menu), `DesignRoom.tsx:78` (the design room's body).
- **Failures swallowed in silence.** The page preload at `App.tsx:60` fails silently. The image
  decodes at `canvas/pageHelpers.ts:49,84` and `components/lit/register.ts:202` fail silently.
  The Governance room's readiness check fails quietly every 120 ms until the embedded
  application's header appears (`GovernanceRoom.tsx:95`). And about forty reads of server
  answers across the rooms and tools accept "no answer" as "no data"
  (`res.json().catch(() => null)` in `IngestModal.tsx`, the evals chat panel, the design tools
  and UX panels, `useDevelopmentRoom.ts`, `useComposerProvider.ts`).
- **The Console's empty report slot.** `ConsoleRoomContainer.tsx:198` hard-sets the failure
  report to nothing: a failed assembly speaks its message as text, but no report object ever
  travels (`errorReport` is handed over at line 262).
- **The waits still inside the boxes.** The rooms' own rings, which the shell's copies were
  copied from, left in place by the owner's instruction because they are never seen while the
  shell's ring stands: console (`ConsoleRoomContainer.tsx:229`), design
  (`DesignSeatShell.tsx:336`), governance (`GovernanceRoom.tsx:203`), product
  (`ProductRoom.tsx:142`). Product's wait also carries the ten-second bound
  (`ProductRoom.tsx:57`): if the builder never announces it has painted, the wait ends anyway.
- **The ring's guard.** `WritingAreaIndex.tsx:108`: the first ready message a room sends is the
  only one accepted, so a room cannot bring its ring back once it has faded.
- **The two reporters, drawn apart from the rest.** `services/errorLogger.ts:52,60` and
  `lib/trace-source.ts:292,309` listen to every failure and send it to the record. These hide
  nothing; they are the opposite of suppression, and they are listed so the line between the
  two kinds is drawn.
