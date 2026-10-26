# Console room changelog

## 2026-10-24 — the Console owns its card doors

- **Open, create and delete are the Console's.** `useConsoleCardActions.ts` holds them. A card
  asks the shell which room to visit (`composer:open`, `a2ui:action` for the Product,
  `navigate-tab` for Design); the New control asks for a blank Composer with `composer:create`;
  a confirmed delete removes the row through the service and takes the card out of this room's
  own tree. Nothing reaches into the Composer.
- **The shell no longer listens for `card-delete`.** The duplicate bridge
  (`rooms/useOpenCardFromConsole.ts`) is deleted.
- **Verified on 5001:** the saved package `98662bc4…` opened from its card and read its User
  seat back; a throwaway package `04e8389d…` was deleted through the card's arm → CONFIRM and
  the row was gone from the database.

## 2026-10-24 — the left navigation stays above the room, and the room owns its assembly

- **The R logo and the navigation it opens are back on the Console.** The Console's box sat at
  z-index 100 while the shell's navigation is a width-0 overlay at z-index 50 with its panel at 55
  and its logo at 60. The logo lives in the header band and stayed clickable, but the panel opened
  underneath the room's ground. The box now sits at z-index 40, the same rule Development and
  Governance already followed. Measured on 5001: the box is 40, the panel opens 310 wide at 55, and
  the pointer at (30, 200) lands in the navigation. The same stacking rule was applied to the Design
  and Product boxes so no room can cover the shell's rail; Product gains no navigation.
- **The Console owns its assembly.** `ConsoleRoomContainer` calls `useAssembleSurface` itself and
  holds its own request state, sentence, failure and ring. It no longer receives the shell's
  assembly callback or flags. The repair stages come from the shared store; the trace subscription
  writes the room's own tree. Verified on 5001: eight cards draw, the room's seat is present, and
  the sandbox is not involved.
- `npm run typecheck` is zero.

## 2026-10-24 — the Console owns its entry, and the tab gate is gone

- The shared tab gate file was deleted. The shell has one plain `handleTabChange`; the Composer
  clears and assembles, every other tab changes the header.
- The Console room now asks for its own surface when it mounts: it marks the console arrival,
  dispatches `a2ui:composer-opened`, and calls `render-console`. The initial page's assembly stays
  in the shell's mount effect; `assembleOnEntry` tells the room whether the mount is the initial
  page or a later entry, so the first paint is assembled once.
- Verified on 5001 inside the React frame: the initial page drew the cards; leaving to Design and
  returning to Console drew them again through the room's own entry; the Composer drew its prompt
  surface and chat. `npm run typecheck` is zero.
- The Figma ingest tool is untouched.

## 2026-10-23 — the chat is the room's own, and she is given the library

- **The person's Console keeps its face and gains the library.** The right column is the same
  drawing — the same rail, thread, folds, repair rows and hello — and every answer about the
  index is now answered from the index itself. Nothing visibly moved.
- **The seat is its own file.** `rooms/console/console-chat-panel.ts` is a whole copy of the
  shared seat, retagged `console-chat-panel`: 3,779 lines against the shared file's 5,485. The
  drawing is unchanged. What was severed, not guarded: the server probe that asked whether this
  seat was the Console's (this seat answers by existing), the package's hello and its
  conversation-creation on landing, the package's name and description, the prompt column and the
  output panel, the Composer's writes and its held-Run review, Product's settings and pieces, the
  Governance room's selected trace, and the Design room's teaching call. The seat's own acts stay:
  the Console hello, the conversation list, the new-conversation path that archives its
  predecessor, the approvals conversation, the library, the repair rows, the rail, and
  `<reassemble-console …/>`.
- **She had never been shown the cards.** The seat composes a workspace message on every turn.
  In the Console that message used to read only `=== THIS PACKAGE === / name: (none) /
  description: (none)`: there is no package in this room, and the library block beside it was
  bound by nothing. The Console's assembly now binds `consoleCards` to `/cards`. Measured in the
  browser after the transfer: her turn carries `=== CONSOLE — PROMPT LIBRARY (13 packages) ===`
  with every card's name, category, status, version and last use, and no package block and no
  tool register.
- **The name is published in all four layers.** The catalog gained `console-chat-panel`, the
  registry gained the same entry, the resolver needed nothing (the name is already in the form it
  reads), and the runtime is the new file, imported by `ConsoleRoomContainer.tsx` so the tag is
  defined before the surface draws. The shared `chat-panel` entry now says who it actually
  serves: the Composer and the Governance room.
- **The server asks for the room's own seat.** In `backend/routes/ai.py`, `render-console` emits
  `console-chat-panel` in the right slot and binds `consoleCards` to `/cards`. `_seat_tabs` and
  `_seat_grace` now match every chat seat by name (`CHAT_SEAT_COMPONENTS`), so the room's rail
  tabs and her script cannot silently miss their own seat again.
- **The chat checker was blind to the room files.** `scripts/catalog-check.mjs` scanned only
  `src/components/lit`, so it reported `console-chat-panel` as a tag "nothing defines" — a
  blocking finding that was false, because a tab's seat now lives in the tab's own folder. It
  reads the whole source tree now. Final report: 19 findings, 3 blocking, all pre-existing.
- **The Console is taken down like every other room.** `ConsoleBox.tsx` carries
  `key="console-root" data-room-root="console"`, the marker `useTabGate` hides in the click's own
  frame. This is one line of state, not work on the gate.
- **Measured on `localhost:5001`** (a fresh document, then the Console tab): the drawn seat is
  `console-chat-panel` with id `console-chat`; no `chat-panel` exists on the Console; thirteen
  cards are bound and the grid draws them (eight on the first page of two); her words and live
  context arrive (`graceLiveContext` true, the Console's script); the rail reads
  `chat,eval,tools,approvals,settings`; `chat-repair-actions` is the seat's `view` child; the room
  root exists while the Console is selected and is gone when the Composer is. The Composer after
  the switch still draws the shared `chat-panel`, with no error block.
- **The shell's side of the chat came out with it.** The tab gate still carried a refresh counter
  that nothing read — the room owns the refresh now — so it is gone, with its setter in the
  gate's own dependency list and the bump that ran after every Console landing. An unused
  navigation handle in the shell is gone. `pages/ConsolePage.tsx` is deleted: it was the
  pre-transfer copy of the page, imported by nothing, and it still carried the Dismiss button you
  removed. The shell measures 4,807 lines, and its only remaining never-read declaration is an
  underscore placeholder whose setter is used.
- **Two things found and left for a decision.** Nothing in the application dispatches
  `command-received`, though the renderer still forwards it and the shell still maps it — it is a
  protocol path with no sender. And the room passes a constant `null` for the classified failure,
  so the detailed panel inside the room's page (the code, the pointer, the fix) can never draw;
  the banner shows the message alone. Both are recorded here rather than changed without your word.
- **Checks.** `npm run typecheck`: 16 errors, the same sixteen that existed before this work and
  none in the Console's files. `npm run catalog:check`: 19 findings, 3 blocking, all pre-existing.
- **Open seam, recorded rather than guessed.** Her `<reassemble-console sort="…" filter="…"/>`
  reaches `ConsoleRoomContainer`, which re-assembles the Console and — exactly as the shell did
  before the transfer — drops the `sort` and `filter` values, so the grid is rebuilt but not
  reordered. Making the grid follow those words is a decision about their vocabulary, and it is
  the next piece of this room's own work.

## 2026-10-23 — the room's own box, and the chat transfer begins

- The Console became a sovereign box inside the React shell: `ConsoleBox.tsx` owns the room's
  ground (the plum and the waves video), `ConsoleRoomContainer.tsx` owns the surface's state,
  renderer and listeners, and the room's state hook owns the tree and the cards. The shared
  sandbox no longer paints the Console's face, and it is not mounted on the Console page.
- The Console's arrival is the same from every door: the tab gate's Console branch sends the
  clean intent, no other room's context.
- The Console's spinner lives in the room's own pane and answers the cards' loading; it is the
  room's purple ring.
- The error surface fails loud: the Dismiss button and the acknowledge state were removed, and
  the shared error banner gained a `dismissable` property so an error can stand until a retry
  succeeds.
- The Console's chat data is the room's own (its session and conversation); its chat ELEMENT is
  still the shared catalog element. The transfer prompt is
  `PROMPT-chat-sovereignty.md` in this folder, and the transfer is the next work.
- The tunnel's serving changed: a plain no-store static server replaced the preview, the
  application routes forward to the folder's own processes, and the builder runs as its own
  production Node application from `product/ai-app-builder-open`.
