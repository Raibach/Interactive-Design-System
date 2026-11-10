# The Design room's session, card and log wiring — undo the workarounds and build it correctly

This prompt is for a new chat. It records what was built in the previous chat, which parts are
shortcuts or workarounds, and what has to be undone. It is not a plan to patch the shortcuts. The
rule for this application is explicit: **no shortcuts and no workarounds. The goal is not the
fastest solution. The goal is correct.**

Read the user's experience first. Every statement below begins from what the person sees, presses
and receives.

## The person's experience today

The person presses a card on the Design console. The room moves to the Tools page. For about two
and a half seconds the Tools page still shows the previous session. Then the card replaces it. A
purple full-page cover was placed over that wait in the previous chat. It hid the page and any
failure behind it, and it did not fix the order in which the page and the card arrive. The cover is
now removed from the working tree. Removing it exposes the real defect: the press moves the page
before the card's own content is ready, and the previous session is drawn under the new page's name.

The person presses the Tools tab and expects a new session. Leaving Tools to Home and returning
must not restore the visit that was left. A saved session is opened by its card; it is not held by
the tab. The visit must end on leaving. The answers are Save, which makes the card, and Discard,
which removes the visit. The previous chat removed the third answer that kept the visit.

The person runs an ingest and reads the failure in the chat. After reopening the card, the failure
must still be in the card's conversation. In the previous chat the failure line was sometimes
drawn locally and lost because the chat element was not yet tied to a conversation. The Tools seat
now writes the line into the session's conversation itself, and the chat draws it. That work is
described below with its remaining duplication.

## The repository and the room

- Repository: `/Users/raibach/Documents/Raibach_IDS`
- Room: `frontend/src/rooms/design/`
- Backend route for the room's page read: `backend/routes/ai.py`, the `render-design` branch of
  `/api/ai/assemble-surface`.
- Console cards: `backend/routes/design_console.py`, `_design_card` and the cards block.
- Frontend: `DesignRoom.tsx`, `DesignSeatShell.tsx`, `tools/ToolsSeat.tsx`,
  `tools/tools-chat.ts`, `chat/chat-tab.ts`, `chat/design-chat.ts`,
  `console/useDesignConsole.ts`.
- The changelog entry for the previous chat: `CHANGELOG.md`, “2026-11-08 (later) — the session,
  the card, and the running log”.

## What the person expects, stated as requirements

1. A card press opens that card: its name, its Figma address, its saved design and its
   conversation. The previous session is never drawn as the card's page.
2. The Tools tab is a new session. A saved session opens by its card, never by the tab.
3. Leaving Tools ends the visit. The visit is not held for the next press. Save makes the card;
   Discard removes the visit. A card that was opened stays by its own record.
4. Every ingest failure and pass remains in the session's conversation and is still there when the
   card is reopened. The failure is never erased, never hidden, and never suppressed.
5. The Home tab and the top Design tab show the same design console home: the same cards and the
   same design console conversation.
6. A saved card appears on the console without the console being rebuilt under the person's
   pointer.
7. A failure is visible in the page or the chat. Nothing covers it.

## The shortcuts and workarounds built in the previous chat

### 1. The purple cover over the Tools page

The previous chat added a full-page plum cover with “Opening …” while the Tools seat read the card.
It was removed from `DesignSeatShell.tsx` at the end of that chat. **Do not reintroduce it.** It hid
the page and any failure behind it. The real problem it covered is still present: the card press
moves the Tools page at once, the seat keeps the previous `injected` content while the card is
read, and the card replaces that content when the read answers.

What is correct instead: the Tools page must draw the card that was pressed, not the previous
session, and it must show a truthful state while the card is read. The state must not cover the
page or suppress errors. One correct direction is to read the card's stored session and draw the
card's page from that record before or while the page becomes standing; another is to make the
press wait on the destination's own content with a visible state that does not hide failures. Do
not solve this by adding another cover, splash or overlay.

### 2. The card placed on the console from the save's answer

`ToolsSeat.tsx` dispatches `design-card-saved` after a save, and `useDesignConsole.ts` places that
card into the console's data model with `upsertCard`. The card is built in the front end with a
hard-coded `status: "Pending"`, an empty `status_color`, and empty category colours. The console's
own card is built by `_design_card` in `backend/routes/design_console.py` and carries the real
status, colour, category and timestamps.

That is a second card shape. Undo it by making the server the single author of the card. The save
should return the card in the console's own shape, or the console should update the card from a
server read that does not rebuild the grid. The front end must not invent a card's state or
colours.

### 3. Re-reading the whole console on the Home press

The previous chat added `design-console-refresh`, which made the Home press re-run the console's
page read. That read re-ran the console's assembler and rebuilt the card grid under the pointer; a
card could stop answering and stop showing its hover. The event and the hook's refresh listener
were removed. **Do not reintroduce a full page read on a press.** The card list must be updated
from the card's own record, not by rebuilding the grid.

### 4. The tab press count and the assembly flags in the seat

`DesignRoom.tsx` passes `press` to `ToolsSeat.tsx`; the seat uses it to re-run the page read on
every Tools press even when the session id is unchanged. The seat also carries
`needsAssemblyRef`, an `active`/`openSession` guard, and `assemblySeqRef` to discard stale answers.
These are client-side signals to force and order reads. The server already owns the tab's working
row (`get_or_create_design_tab`) and the card owns its id. Audit whether the press count, the
visit flag and the guards can be replaced by one read owned by the room's own tab event, with one
place deciding which session the press opens. Do not add more client flags to make a race quiet.

### 5. Leaving Tools reuses the discard path

The previous chat removed the “Accept” answer that held the visit. Leaving Tools dispatches
`design-tools-leave`; `ToolsSeat.tsx` answers it by calling `discardDesignSession`, the same
function the preview's Discard uses. That function removes the working visit and reads the
record's kept mark so a saved card is not deleted. The session data now carries `kept`, added in
`backend/routes/ai.py`, and `design-save-ask` reads it.

The lifecycle is split across the shell, the room and the seat. Undo the split by giving the visit
one owner. The person's requirements do not change: the visit ends on leaving; Save makes the card;
Discard removes the visit; a card opened during the visit stays. Do not keep a visit for the next
press and do not delete a card as though it were the visit.

### 6. Two writers for the running log, with flags to keep them apart

`ToolsSeat.tsx` writes the ingest failure and pass lines into the session's conversation through
`persistIngestLine`. The chat elements also write host lines in `_onHostSay`. The previous chat
added a `persisted` flag so the chat skips a line the seat wrote, and a `tab` field so the Chat
tab and the shared design chat ignore a line addressed to Tools.

That is two writers and two scoping flags over a shared event. Undo it by giving the session one
log writer and one display channel. The seat knows the session's conversation and is the natural
writer; the chat should draw the line without writing it, or the chat should be the only writer and
the seat must not write before the chat is bound. A line for one tab must not be delivered to
another tab's thread by a flag that every chat has to remember to check.

### 7. The Chat tab's package override

`chat-tab.ts` used to resolve the Chat tab's package as `packages.chat`; the Chat tab is the design
console chat and now resolves `packages.console`. This is a real correction and should stay. Verify
that the Chat tab's conversation list and thread both come from the console package and that the
top Design tab shows the same.

### 8. The server fallback that reopened the last card

The `render-design` branch in `backend/routes/ai.py` used to reopen the newest kept session when
the tab's own conversation held no person's turn. It is removed. A tab press now uses the tab's own
working row, and only a card's id opens a card. This is a real correction and should stay.

### 9. The card deletion guard

`discardDesignSession` reads the record's own kept mark before deleting, so a saved card cannot be
removed as part of a visit. The visit flag remains as the fast path. This is a real correction and
should stay. The card deleted in an earlier chat could not be restored; do not claim otherwise.

## The record as it stands

Checked against the running server on 2026-11-08:

- The saved card is `bb202848-f10c-41f5-95b3-8ca4a2d2ac87`, titled “SCE Enterprise AI Prompt
  Platform Wireframes”, kept, in review, with conversation
  `f80c9b5c-d81c-4727-bedd-2453edfaf4b2`. Its Figma address is in its left column. It has no
  drawing: the ingest never passed, so the card records the attempt, not a preview.
- The Tools working session is `87cc32b2-3dd1-447f-baff-950d352bdb2d`, a `design_tab` row, with
  conversation `2dd067cf-98a8-43ad-8647-37799eb9daa7`.
- The page read with no card returned `87cc32b2…`, an empty Title and address, and `kept: false`.
- The page read with the card id returned `bb202848…`, its title and address, its conversation and
  `kept: true`.
- The design console returns both design-system cards and the saved card with status “Pending”.
- The card's conversation holds the greeting and the 422 refusal from the ingest.

These values are evidence for the next chat. Do not rebuild rows to make a screen look right.

## The ingest — out of scope for this prompt, but not done

The owner set the ingest aside to repair the session and card process. The last measured run of
node `40001066:4301` refused after five reads. The refusal named:

- the check's accounting did not close: two layers share a name and were counted as one fact twice;
- `componentProperties` and `locked` were treated as visual facts nobody had examined;
- the `copolt` rectangle's image fill never reached the measured design.

The working tree contains corrections: rows are distinguished by the layer's own id;
`componentProperties` and `locked` are configuration; and the image fill is rendered through Figma
and carried as the picture itself in the drawing. The measured design was checked to carry the
image. The full run was not repeated before the handoff, so the ingest's pass is **not** claimed.
Do not report it as working.

The ingest's outstanding plan items remain: the mirrored-frame normalization, the arc and
truncation drawings, the promotion gate at Save and Approval, and the round-trip acceptance tests.
The approval queue's running log is not tied to a card's conversation. The advanced filter over
the console cards is not built.

## What not to do

- Do not add a splash, cover, overlay or modal to hide a wait or a failure.
- Do not suppress or catch an error and continue without saying it.
- Do not build a second card shape in the front end.
- Do not re-run the console's page read on a tab press.
- Do not add more client flags or nonces to make a read order quiet.
- Do not hold a visit for the next press.
- Do not claim a browser test that was not made or an ingest that did not pass.
- Do not touch the plan and prompt documents beyond this handoff.

## How to verify

- `cd frontend && npx tsc -b --noEmit` must be zero.
- `python3 -m py_compile backend/routes/ai.py backend/routes/figma.py backend/figma_fidelity.py`
  must be zero.
- Read the running server's `POST /api/ai/assemble-surface` for `render-design`, once with no
  `session_id` and once with the saved card's id. Check the working row, the card's title and
  address, the conversation and `kept`.
- In the browser: press a card and watch what the Tools page draws before the card arrives. It
  must not draw the previous session, must not cover the page with a splash, and must show a
  failure if the read fails.
- In the browser: press Tools, leave to Home, return to Tools; the session must be new. Open a
  card, leave, return; the card must remain on the console and the next Tools press must be new.
- In the browser: run an ingest that fails, save the session as a card if the person wants it,
  reopen the card, and read the failure in its conversation. The line must be there.
- In the browser: hover and press a saved card on the console. It must show its hand and answer
  the press.

## What to report

Report what the person sees and what was checked. State the exact failure when one remains. Do not
describe a shortcut as a fix. If the card's page cannot be built correctly in the time available,
say which part is unfinished rather than covering it.
