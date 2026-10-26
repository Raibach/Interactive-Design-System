# PLAN — The Console's chat becomes the Console's own

> Written after reading the Console room, the Product room, the shared seat, the four resolution
> layers, the Console's assembly on the server, and the tab gate. Every claim below was read in
> the code; nothing here is inferred from a summary.

## What the person will experience

The person opens the Console and sees the library they see today: the cards on the left and the
chat column on the right, closed, with its rail. When they open the chat and ask her to find,
sort or explain what is in the library, she answers from the actual cards — each package's name,
description, category, status, version, message count and the date it was last used — because the
library will finally be placed in front of her on every turn.

Nothing about the appearance changes. The column, the thread, the rail, the folds, the repair
rows and the hello she speaks are the same drawing.

What changes is ownership. The chat inside the Console becomes the Console's own piece of the
application. A change made to the Composer's chat no longer changes the Console's. The Composer,
the Product room, the Design room and the Governance room are not touched.

The person will also stop seeing the Console survive for a frame underneath the room they just
clicked, because the Console will be taken down in the same instant as every other room.

## What I found in the code

1. The Console's chat is not placed on the page by the Console itself. The server assembles the
   Console's surface and names the chat in the right-hand column: the requirement is stated at
   `backend/routes/ai.py:1346` and the exact tree is at `backend/routes/ai.py:1388`. That tree
   binds the Console's own conversation and session: `/console/conversation_id`,
   `/console/conversations` and `/console/session_id`.

2. Four layers decide what that name becomes. The catalog
   (`frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json:1241`) is the server's
   gate. The registry (`frontend/src/shared/tag-registry.ts:813`) says what may be drawn. The
   resolver (`frontend/src/components/lit/a2ui-renderer.ts:278`) turns the name into a tag. The
   runtime (`frontend/src/components/lit/chat-panel.ts`) draws it. The resolver is called with
   the name alone, so one shared element serves every room today.

3. The shared element carries every room inside it. It holds a probe that asks the server whether
   this seat is the Console's or a package's (`chat-panel.ts:4517`), Product's settings, the
   Governance room's selected trace, and the Composer's acts — writing into prompt sections,
   merging seats, running, saving, setting a title. Rule 3 of the handoff prompt says these are
   not covered by a switch in the Console's copy; they are severed.

4. The library is never placed in front of her. The panel has a block that writes every card into
   her turn context (`chat-panel.ts:3259`), and that context is sent on every turn through
   `_gracePrompt` (`chat-panel.ts:3371`). The value it reads, `consoleCards`, is declared at
   `chat-panel.ts:195`, but the Console's surface binds no such property, and no file in the
   application assigns it. I searched the whole frontend: every mention of `consoleCards` lives
   inside a copy of the chat. The Console's Grace has therefore never been shown the library she
   is asked to organise, sort and search.

5. Her own words state the room. `backend/routes/ai.py:451` tells her she is the prompt engineer
   over the index of every package, that she advises on what the packages say and which to work
   on next, and that she does not write into a prompt from this room. The panel carries her own
   console control, `reassemble-console`, so she can ask the room to rebuild the surface.

6. The tab gate does not block the chat, but it has one defect that concerns the Console. Every
   room carries `data-room-root`, and the gate hides every such element in the click's own frame
   (`frontend/src/rooms/useTabGate.ts:50`). The Console's box carries `data-room-box` and no
   `data-room-root` (`ConsoleBox.tsx:14`), so the Console is the one room that is not taken down
   when the person clicks away. Nothing in the gate names the Console's chat, so the transfer
   needs no change to the gate's logic. The fix below is one line of state, so it neither
   depends on the gate nor delays its removal.

7. Two transfers already exist to copy from. Product copied the seat and fourteen of its pieces
   into `rooms/product/` and mounts its seat directly (`ProductRoom.tsx:11`). Design copied the
   seat alone into `design/design-chat-panel.ts` and imports the shared pieces. Your own rule,
   recorded in that file's header on 2026-10-18, reads: "a tab's seat is its own file; the only
   things shared are the lit components and the styling."

## The one decision I am making

The Console's seat becomes its own file. Its pieces — the header, the message list, the input,
the action bar, the rail, the folds — remain the shared pieces, as Design does and as your
2026-10-18 rule states. The handoff prompt says "a `console-chat-panel` copy and its parts", and
Product did copy its parts. I recommend the Design shape, because the pieces are the drawing and
the styling that the prompt says remain under the catalog's control, and because copying eleven
more pieces would add roughly one hundred and eighty thousand characters of duplicate code that
must be kept in step forever with no visible gain. If you prefer the Product shape, every step
below is unchanged and the copies are added at the end of step one.

## The steps

**Step 1 — the Console's seat is its own file.**

Create `rooms/console/console-chat-panel.ts` as a whole copy of `components/lit/chat-panel.ts`,
retagged `console-chat-panel`. Every line that draws is kept. Then sever, rather than guard:

- the server probe that asks whether this is the Console's seat, and the package half of every
  branch it feeds — this copy is the Console's seat, and the Console's hello is the only hello it
  has;
- the package's facts and acts: its name, its description, moving the seat to another package,
  writing into prompt sections, merging seats, running, saving, setting a title;
- Product's settings and Product's two pieces;
- the Governance room's selected trace and observation;
- the Design room's teaching call.

The Console's own acts stay: the hello, the conversation list, the new-conversation path that
archives its predecessor, the approvals conversation, the library block, the repair rows, the
rail, and `reassemble-console`.

Import the new file from the Console room so the tag is defined before the surface is drawn.

**Step 2 — the name is published to the two frontend layers.**

Add `console-chat-panel` to `shared/tag-registry.ts` with its own description and properties, and
add the same name to the catalog with the properties the Console binds. The resolver needs no
change, because the name is already in the form the registry uses. Correct the shared entry's
description, which still claims one seat serves the Console.

**Step 3 — the Console's surface asks for its own seat, and gives her the library.**

In `backend/routes/ai.py`, the Console's requirement and its exact tree emit
`console-chat-panel`, and the tree gains one binding: `consoleCards` from `/cards`.

`_seat_tabs` (`ai.py:487`) and `_seat_grace` (`ai.py:494`) match the literal name `chat-panel`.
They must also match `console-chat-panel`, or they will silently skip the Console's seat and
leave her without her words and without her rail. The seat refuses to answer in another room's
voice, so that failure would be loud in the thread rather than silent.

**Step 4 — the Console is taken down like every other room.**

Give the Console's box `key="console-root"` and `data-room-root="console"` in `ConsoleBox.tsx`,
matching the Product room. This is one line of state, not work on the gate.

**Step 5 — verify in the browser on `localhost:5001`, and only there.**

- The Console's right column is the room's own element. Measure it: the tag present is
  `console-chat-panel`, and no `chat-panel` exists on the Console.
- She speaks the Console's hello against an empty thread, and does not speak a package's hello.
- She is given the library. Ask her for a fact only the card list holds — the name of the most
  recent package — and compare her answer with the card on the left.
- The rail's tabs, the conversation switch, the new-conversation path and the repair rows behave
  as they did before the transfer.
- The error surface still stands, with no dismiss.
- Leaving the Console for another room: no frame of the Console survives underneath it.
- `npm run typecheck` reports exactly the errors that exist today and no new ones; sixteen was
  the count at the last measure. `npm run catalog:check` passes.
- Only after your approval: rebuild the preview and the tunnel, and match the asset hashes.

**Step 6 — the record.**

Write each step into `rooms/console/CHANGELOG.md` with what was measured.

## What I will not touch

The Composer's seat, the Design room's seat, the Governance seat, the Product room, the tab
gate's logic, and `chat-repair-actions`, which is already the Console's own repair rows. No
guards, no dismiss buttons, no fallbacks, and no invented elements.

## The traps I am watching

- A property the surface binds and the copy does not declare is warned about and dropped by the
  renderer. `consoleCards` is declared already, and every property the Console binds must stay
  declared.
- The new element must exist before the surface is drawn, so the import belongs to the room.
- The catalog is the server's gate. A name missing there is a refused assembly, not a drawing
  error.
- The shared `<chat-footer>` tag is defined in a file that nothing imports, so it draws nothing
  today. The copy keeps that state rather than quietly adding a footer nobody has seen.
- The copy must not carry the server probe. Replacing it with a constant is the difference
  between owning the room and guarding it.
