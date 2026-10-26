# Product room changelog

## 2026-10-24 — the Product owns its voice

- `useProductThread.ts` holds the room's thread line and its draft canvas's design system. The
  two helpers no longer arrive from the Composer; the shell passes no handler into this room.
- Verified on 5001: the Product tab mounts with no page error.

## 2026-10-23 — the Product tab becomes a sovereign box, done

The room is now the proven pattern: a closed box inside the React shell, with its own
elements, its own conversation, and its own ground.

- The React shell persists always: the document declares no fill, no door and no paint, and
  the shell paints the ground image over its dark base from its very first commit, with the
  image preloaded at the document's start. The boot is never white and never a bare base.
- The Product tab is mounted by the shell only while selected, and unmounted on leaving.
- The room's layout is `product-workspace`, the exact copy of the shared two-column layout
  under the room's own name, with the 600-pixel open width. The shared `workspace-layout` is
  not mounted on the Product page.
- The room's chat is `product-chat-panel` and its fourteen parts, the exact copies of the
  shared chat under Product tags. The shared chat is not mounted on the Product page. The
  conversation block — bar, list, delete — is the shared chat's structure line for line,
  fed by the room's own conversation from the bridge: one conversation per project, never a
  studio package list and never a fabricated row.
- The builder application's own surfaces are transparent while embedded, so the room's
  ground runs continuous through the frame. The application accepts its embedded mode only
  with a real parent frame.
- A Console card opens the room on its project; the seat binds that project's row and the
  poller delivers the application's conversation into the thread. Verified end to end.
- The shell's boot background and the ground preload live in the shell and the document; the
  room's own ground lives in the room's box.
- Working protocol: iterate on `localhost:5001`; the preview on 4173 and the tunnel serve
  the approved reference build and are rebuilt only after approval. Errors are clues; the
  browser is the truth.

## Open items

- The Product row's timestamp: the bridge must supply a saved time for the row to show one.
- What a delete means for the room's one application-owned conversation is undecided.
- The room's files still import some shared services; they are the next layer, taken one at
  a time.
