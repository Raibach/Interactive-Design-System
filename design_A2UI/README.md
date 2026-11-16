# Design A2UI — the Design room's own seat

This folder is the Design room's own seat: the interface the person uses when they press Design
or Design A2UI. It is not a copy that runs beside the application; it is the application's Design
room, moved here, drawn under this folder's own names and driven by this folder's own catalogue.

## What the person sees

The person presses Design and the room opens inside the application: the three columns, the rail,
and the five boxes of the right column — the status line, the conversations card, the thread, the
typing area with Send, and the row of tools. The rail's items — Home, Tools, Approve, UX — change
what the room serves without rebuilding it. Tools opens the Figma ingest: the form, the measured
catalogue tree and its preview. Approve opens the records waiting for a decision. UX opens the
analytics application with its own conversation. The Design A2UI tab shows the same room, and the
two tabs are the same surface reached two ways.

## What was achieved today

The room draws one surface. One `<a2ui-renderer>`, told the door's `surfaceId` and
`system="surface-design"`, draws one tree and one data model: the frame, the left column, the
middle column and the chat are children of the same root. The left column no longer has a second
renderer, and a rail press writes the data model instead of building a new page.

The four elements the room draws directly — the Tools chat, the UX chat, the Approve review and
the UX application frame — are declared in the catalogue, the registry and the shell's allowlist,
and their modules are imported. The catalogue is 35 components (6 primitives and 29 names); the
served registry is 29 names. The repair list's wire name is `chat-repair-actions`; its element tag
is `design2-repair-actions`, and the old tag returns zero.

The save bug is fixed. The Tools engine is mounted once and kept headless; its Save listener
answered the UX footer's Save as well and wrote a Tools session the press had already replaced. It
now answers only while Tools stands, except a leave's forced Save.

## How it was made

The work followed one rule: copy the application's files into this folder with the seat's own
names, and change nothing in the application until the copy is proven. Element names were changed
throughout — `design-workspace` became `design2-workspace`, the room's seat renderer was removed
entirely, and the chat, tools and UX parts took the `design2-*` names. The seat's catalogue and
registry were written from the seat's own components and exported as the two files the shell's
loader reads; a pointer in the application's catalogue folder lets that loader find them without a
line of application code changing. The shell's renderer draws the surface through the seat's table,
and the tab's load was moved into `surface/load.ts`, which reads the console's answer, resolves the
seat's table, and mounts once.

The two chat seats — the standing seat and the Chat tab's page — were merged into one class with
one property saying which conversation file it reads, and the UX seat's parts were reduced to the
chat seat's own elements wherever the two were the same code. What could not be shared was left
alone rather than forced.

## Why it matters

The Design room can now be changed, tested and eventually deleted without editing the application
to do it. A failure in the seat is a failure of one seat, not of the shell. The same pattern — a
folder with its own names, catalogue, registry and renderer table — is the one the Tools, Approve
and UX seats follow, so the remaining work is repetition rather than invention.

## The proof

`npx tsc -b --noEmit` passes. `node design_A2UI/tests/four-layers.mjs` reports 29 registry names,
35 catalogue components and zero missing definitions, imports or catalogue entries. The page has
not been re-measured since the one-surface change; the runtime walk is the next proof.

## What is not finished

The Tools chat (`tools/tools-chat.ts`, 5,645 lines) is still one component with a large internal
assembly. It is one node of the surface's tree, not a second surface; its places are the next cut.
The seat still imports the shell's kernel — the sign-in identity, the transport, the envelope
reader, the registry loader, the renderer and the image assets. The Tools tab's server-side routes
are still the application's. `surface-design/tab.ts` still carries `enabled: false`; the flag is the
owner's gate. The page has not been re-measured since the one-surface change.
