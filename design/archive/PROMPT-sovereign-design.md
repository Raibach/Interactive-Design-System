# PROMPT — the Design tab becomes its own sovereign box

> Kept with the design room's code on purpose. This is the complete instruction for the next working
> session, written after the same transfer was completed for Product, the Console and Governance.
>
> **Read `PLAN-sovereign-design.md` first.** It corrects this prompt's Step 2 — the shell's design
> hooks are inert and are deleted, not moved — and adds the console, dead-file, tab-gate and
> chat-file findings.

## The goal

The Design tab becomes its own box, the way Product, the Console and Governance already are. The
person clicks Design and the room draws itself: its ground, its interface, its rail, its seats, its
own loading. The shell (`pages/WritingAreaIndex.tsx`) keeps only the tab branch that mounts the box.
Everything the design tab owns — its tree, its renderer, its preview flag, its ground, its room root,
its own effects — moves into the design folder and dies with the room when the tab is left.

Why it matters, in the owner's words: the sessions path was once stripped out of a shared seat by a
change made for another room. A room that owns its box cannot be reached that way.

## The template — three rooms have done it

- **Product** — `rooms/product/ProductBox.tsx` + `ProductRoomContainer.tsx`; the box owns the
  ground, the container owns the state; the shell mounts the box only while the tab is selected.
- **The Console** — `rooms/console/ConsoleBox.tsx` + `ConsoleRoomContainer.tsx`, plus its own seat
  (`console-chat-panel`) and the room root marker that lets the tab gate take it down in the click's
  own frame.
- **Governance** — `rooms/governance/GovernanceBox` (planned) and, already done, its own seat
  (`governance-chat-panel`), the collapsed column on entry, the application's home on entry, and the
  layout effect moved out of the shell.

Read those before writing anything. Copy their shape; do not invent a new one.

## What the shell holds today

Read in `pages/WritingAreaIndex.tsx`:

- `designTree` state (line 300), `designPreviewOpen` (line 477, read-only), `designRendererRef`
  (line 842).
- `useDesignSurface({ designPreviewOpen, designRendererRef, designTree })` (line 953) — assembly,
  render, then the injection.
- `useDesignPreview({ setDesignTree })` (line 4159).
- The design effects at lines 4203–4253: `roomShapeSetRef`, `previewWidthSetRef`, the tree's own
  inspection of the workspace-layout.
- The ground: `designSectionBackground` chosen in the `workspaceBackground` block (lines 52, 521).
- The branch itself (line 4716): a wrapper with `key="design-root"` and `data-room-root="design"`,
  then `Suspense` and the lazy `DesignRoom`.
- `isDesignView` (line 497), which exists only for the ground and the design effects.

## The steps

**Step 1 — the box.** Create `design/DesignBox.tsx` (or `rooms/design/DesignBox.tsx` if the folder
is moved) that owns the room's ground (`designSectionBackground` over `#582846`, the values the
shell uses today), carries `key="design-root"` and `data-room-root="design"`, and mounts the
container. The room root stays on this box; the tab gate hides `[data-room-root]` elements in the
click's own frame and the Console proved the marker must be there.

**Step 2 — the container.** Create `DesignRoomContainer.tsx` that owns `designTree`,
`designRendererRef`, `designPreviewOpen`, the `useDesignSurface` call, the `useDesignPreview` call,
and the two effects now at 4203–4253. It renders the lazy `DesignRoom` inside a `Suspense` exactly
as the shell does today.

**Step 3 — the shell lets go.** Remove the state, refs, hook calls, effects and ground branch above
from `WritingAreaIndex.tsx`, and replace the design branch with `<DesignBox />`, mounted only while
`headerTab === 'design'`. Keep the header tab button and the lazy import boundary; the box may be
lazy-loaded the same way the room is today.

**Step 4 — verify in the browser on `localhost:5001`.**

- The Design room draws with its own ground, its interface, its rail and its seats.
- Nothing of the design room remains mounted when the tab is left; returning re-establishes the
  room's own shape and preview width (the two refs are the room's now).
- Leaving Design: the room root is hidden in the click's own frame, and no ghost survives under the
  next room.
- The Design seat (`design-chat-panel`) still draws, binds and answers; the Tools seat still opens
  from `design-tools-open`.
- `npm run typecheck` stays at zero errors, and `npm run build` passes.

**Step 5 — the record.** Create `design/CHANGELOG.md` with the dated entry of what moved and what was
measured, the way the Console and Product keep theirs. Keep the prompt in this folder.

## The rules of the transfer

1. Transfer line for line. Every drawing line is the room's existing line; nothing is invented.
2. The room owns its facts; the shell keeps only the branch. No design state stays in the shell.
3. Sever rather than guard: if a value was only there for another room, it goes.
4. Errors fail loud; nothing is hidden behind a fallback.
5. Verify in the browser on `localhost:5001`. Rebuild the preview and the tunnel only on the
   owner's approval, and match the asset hashes across `dist`, the preview and the tunnel.
6. The browser is the truth; the code is not. Errors are clues.

## The traps

- `DesignRoom` is lazy-loaded; the box must keep the `Suspense` boundary or the room's first paint
  changes.
- The design seat is already its own element (`design-chat-panel`); do not copy it again.
- The ground sits at room level, not on the seat — a ground painted on the seat travels with the
  column.
- The room root marker is load-bearing for the tab gate; Product, the Console and Governance all
  carry it.
- `useDesignSurface` is already in `rooms/design/`; the container should call it there, not from the
  shell.
