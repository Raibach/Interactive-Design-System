# `src/rooms/` — one folder per room

The page (`pages/WritingAreaIndex.tsx`) is the shell: navigation, the surface host, the gate
around the whole window, and the switch between rooms. Everything that belongs to ONE room is
lifted out of it and lives here, in a file named for the job it does. **Every file's first line
states what it owns** — read that, not this index, if the two ever disagree.

## The rule

| where | what belongs there |
| --- | --- |
| `rooms/<room>/` | the shell-side wiring for that room — the hooks and handlers lifted out of the page |
| `src/<room>/` | the room's own application (design's seat and tools, console's gate and assembly) |
| `rooms/useTabGate.ts` | the switch itself — it spans every room, so it belongs to none of them |
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

**`governance/`** — `useGovernanceRoom.ts`: the whole governance room's wiring.

**`design/`** — `useDesignSurface.ts`: the shell-side effect that mounts and injects the design
surface. The design application itself is `src/design/`.

## Still in the page (2026-10-21)

- **Product** — nothing of its own. The page renders `<ProductRoom />`, calls the room's hooks,
  and hands them the values they ask for — that is the page's job and it does not know what the
  room does with them.
- **Design** — a ~44-line block that mounts `<DesignRoom />`, plus `designTree`,
  `designPreviewOpen`, `designRendererRef`.
- **Console and Composer** — their surfaces live in the sandbox's slots, so their markup is the
  page's own; their hooks are `src/console/` and `src/hooks/`.
