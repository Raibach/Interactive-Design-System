# The Product Room — the sovereign tab, and the recipe for the others

## The ruling principles

- **The React shell persists always.** Nothing loads or paints outside it. The document
  (`index.html`) declares no fill, no door and no background of its own; the shell paints
  everything, from its very first commit.
- **The shell owns the boot paint.** `App.tsx`'s wrapper carries the system's one background —
  the composer ground image over its dark base, stretched with the browser — and the document
  preloads that image at its start, so the first frame is the ground itself: never white,
  never a bare base, never a door.
- **Errors are clues, and the browser is the truth.** An error names the global requirement
  that was removed or moved. The rendered page is the authority; the code's self-description
  is not. Test by opening the browser and clicking the tabs, on `localhost:5001`.

## The room's structure

The Product tab is a closed box inside the shell. The shell mounts it only while the Product
tab is selected, and unmounts it on leaving.

- `ProductBox.tsx` — the room's stage. It paints the room's own ground: the composer image
  over the dark base, stretched with the browser.
- `ProductRoomContainer.tsx` — the room's state and behaviour: the project, the seat, the
  pollers, the entry flow and the foot wiring. It takes one small contract from the shell:
  the Console card's action and the shared writer helpers.
- `ProductRoom.tsx` — the pane the person sees: the canvas on the left, the chat on the
  right, the small wait ring, the engine banner.

## The room's own elements

Every element the room draws is a copy that lives in this folder under a Product-owned name,
registered by the room's own files:

- `product-workspace.ts` — the exact copy of the shared two-column layout, with its own
  element name and the room's 600-pixel open width. The shared `workspace-layout` is not
  mounted on the Product page.
- `product-chat-panel.ts` and the fourteen parts in `chat/` — the exact copies of the shared
  chat, with Product tags. The shared `chat-panel` and its parts are not mounted on the
  Product page.
- The chat's conversation block — the bar, the list and the delete — is the shared chat's own
  structure, line for line. Its data is the room's own: one conversation per project, created
  and carried by the bridge, never a studio package list and never a fabricated row.

## The application inside

The builder application is framed at `/builder/project/<project id>`. Its own surfaces — the
header bands and the not-found screen — are transparent while embedded, so the room's ground
runs continuous through the frame. The application accepts its embedded mode only when it
truly has a parent frame.

## The Console card's door

A Console card dispatches the protocol action `open_room` with the project; the shell routes
it to the box, which opens the room on that project. Verified end to end: the card opens the
room, the seat binds the project's row, and the poller delivers the application's
conversation into the thread.

## The workflow

- Iterate and test on `localhost:5001` — the live source.
- The preview on port 4173 — and the tunnel that serves it — holds the approved reference
  build. It is rebuilt only after the owner approves.
- Verify with the browser and with pixel measurement of the painted frames.

## The recipe for the next tab

Each remaining tab follows the same steps, one at a time:

1. Give the tab its own box mounted by the shell only while the tab is selected.
2. Copy the layout element into the tab's folder under the tab's own name and register it
   from the tab's own files; stop mounting the shared one.
3. Copy the chat into the tab's folder with the tab's own tags, keeping the shared chat's
   structure line for line; feed it the tab's own conversation, never a shared list.
4. Keep every room's ground inside the room's own box; the shell paints only the boot
   background.
5. Verify in the browser: the shared elements are absent from the tab's page, the tab's own
   conversation is the one in the chat, and the first frame is the ground.

## Open items, stated plainly

- The Product row's timestamp: the room's binding carries no saved time; the bridge must
  supply it for the row to show one.
- What a delete means for the room's one conversation is undecided — the copied path deletes
  the studio's row and moves the seat to the package's next conversation, which does not
  apply to a room with one application-owned conversation.
- The room's files still import some shared services (the configuration reader, the address
  helper, the profile read and others); they are the next layer, taken one at a time.
