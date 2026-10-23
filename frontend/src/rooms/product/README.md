# The Product Room — the untangling, 2026-10-23

## What this room is now

Product is its own application inside the studio. It is mounted only while the Product tab is
selected, and it is destroyed when the person leaves. Nothing of its state survives on another
tab.

The surface is three files:

- `ProductBox.tsx` — the stage the room stands on, including the composer ground image.
- `ProductRoomContainer.tsx` — the room's state and behaviour: project, seat, pollers, foot
  wiring, draft machinery, builder events.
- `ProductRoom.tsx` — the pane the person sees: the builder frame and the chat seat.

The shell's only contract with the room is small:

- `requestedProjectId` — the project a Console card asked for;
- `onRequestConsumed` — the room has taken it;
- `sayInThread`, `writeDraftSystem`, `assertPaneWidth` — shared helpers the room already used.

Everything else lives under `frontend/src/rooms/product/`.

## What was removed

Before this work, the Product state, gate, seat, pollers, listeners and exit guard lived in
`pages/WritingAreaIndex.tsx`. The room was one branch of a 6,000-line shell, and the shell
owned its memory.

Removed from Product:

- the full-room gate, its ring, its sentence and the builder's opacity rule;
- the room's own loading text and the shared tab-switch cover on its path;
- the exit-guard modal (“What should happen to this idea?”) and the leave question the shell
  carried for it;
- the Product unsaved-work flag and its browser leave warning;
- Product's branch inside `ai-surface-sandbox` — the sandbox is not rendered on the Product
  page at all;
- the Product assembly image and the dead room-face imports in the tab gate.

The builder application's own loading screen was removed in its own files, and its document is
transparent from the first paint, so the room's ground shows behind it instead of a white or
grey sheet.

## What was measured

- Product page: zero `ai-surface-sandbox` elements. The Product box and its builder frame are
  present; the shared cover, gate, spinner and pre-load text are absent.
- A 90-frame entry sample: zero cover frames, zero gate frames, zero loading-text frames, zero
  white frames.
- Leaving Product unmounts the room completely; returning mounts a fresh one and reopens a
  project.
- A Console card opens Product on that card's project.
- Console and Development still mount the sandbox and work as before.

## The shell's size

- `WritingAreaIndex.tsx` at the checkpoint: 6,078 lines.
- After the Product migration: 5,654 lines.
- Change in this file: 100 insertions, 524 deletions.
- Product hooks still in the shell: 0.

The shell is smaller, and the Product seam is untangled. It is not yet a small file because the
other five tabs are still inside it. Each one moves the same way, and the sandbox is deleted
when the last one leaves.

## The A2UI shape of this room (next)

The room is sovereign. The next step is to make its chat a protocol surface, not only an
imperatively bound host. The protocol references live in:

- `AGENTS-instructions/Data-Binding.md` — a binding is `{ "path": "/x/y" }`; only the object
  form is a path; literal values are written directly.
- `AGENTS-instructions/Data-Flow.md` — structure travels in `updateComponents`, values in
  `updateDataModel`; never both in one message.
- `AGENTS-instructions/Handling-User-Actions.md` — an action is
  `{ version, action: { name, surfaceId, sourceComponentId, context } }`; input components
  write their local model synchronously before an action resolves.

### The surface

`surfaceId: "product-room"` (the room's own). Its data model holds only this room:

```json
{
  "session": {
    "session_id": "...",
    "conversation_id": "...",
    "project_id": "...",
    "title": "..."
  },
  "thread": { "messages": [] },
  "status": { "label": "", "text": "" }
}
```

The ids come from the database row the bridge creates or reuses for the project
(`POST /builder/projects/{project_id}/room`). They are exclusive to this room; no other surface
receives them.

### The seat

`chat-panel` is already a catalog element with the right properties. The target is a declared
seat in this surface:

```json
{
  "id": "product-seat",
  "component": "chat-panel",
  "conversationId": { "path": "/session/conversation_id" },
  "sessionId": { "path": "/session/session_id" },
  "messages": { "path": "/thread/messages" }
}
```

Today `useProductSeat.ts` fetches the room and assigns those props with `assignProps`. The
fetched ids are correct; the binding is imperative. The surface model becomes the single source
those values come from.

### The actions

- The Console card is an A2UI action: `name: "open_room"`, `surfaceId: "console"`,
  `sourceComponentId: <card id>`, `context: { room: "product", project_id: <builder project id> }`.
  The shell is the orchestrator: it routes the action to the Product surface. It must not keep
  the project as its own state. Today `useOpenCardFromConsole.ts` writes
  `requestedProductProjectId`; that is the shortcut this step replaces.
- A chat send is an action on the Product surface: `name: "send_message"`,
  `surfaceId: "product-room"`, `sourceComponentId: "product-seat"`,
  `context: { conversation_id, text }`. The reply is a data-model update at
  `/thread/messages`, not a separate imperative write.
- Data model sync, when enabled, carries only the Product surface. The Console's card model
  never enters it.

### Order

1. Add the Product surface and its data model under `rooms/product/`.
2. Bind the seat to the model paths; keep the database ids as the only source.
3. Replace the shell's project-state handoff with the Console card action.
4. Then update this record and the Product changelog, and move to the next tab.

The embedded OpenHands application is untouched by all of this. Its own chat is hidden when it
is embedded; the room's chat seat is the protocol surface, and it is exclusive to this room.

## The next tabs

Development, Governance, Design, Console and Composer, one at a time, each with its own box and
its own state. The shell keeps the header, the tab selection and the services every application
shares. The rule is the same for every move: the shell selects, the room owns.
