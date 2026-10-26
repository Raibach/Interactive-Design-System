# Development room changelog

## 2026-10-24 — the room owns its ground, its refs and its seat binding (Step 1 of five)

- **The person sees the same room.** Development opens straight in: the paper lab tile behind both
  columns, the OpenHands Agent Canvas in the left column, and Grace's chat on the right with its
  rail closed. No assembly gate, no cover, no fallback. The OpenHands application is untouched —
  its house patch, its chrome, its panel colour and its transparent ground stay exactly as they
  were.
- **The box is the room's own.** `rooms/development/DevelopmentBox.tsx` carries
  `data-room-box="development"` and paints the lab tile itself: `canvas-development-lab-bkg.webp`
  over `#2b2635`, natural size, repeated, from the top left — the values the shell painted before.
  The left slot in `DevelopmentRoom.tsx` no longer paints it, so the tile is drawn once.
- **The container owns the refs.** `rooms/development/DevelopmentRoomContainer.tsx` holds
  `developmentLayoutRef` and `developmentSeatRef` and calls `useDevelopmentRoom`. The room mounts
  only while Development is selected, so the hook's `headerTab` guard is gone; a check left behind
  would have made the room's own first paint skip.
- **The shell holds no Development state.** `WritingAreaIndex.tsx` lost the lab-ground import, the
  room and hook imports, the two type-only element imports, `isDevelopmentView`, the four ground
  branches, both refs, the hook call and the sandbox arm. It gains one
  `<DevelopmentBox key="development-box" />`. Measured: 4,154 lines before, 4,104 after.
- **The sandbox is smaller.** Development is excluded from the sandbox condition, and the
  `SELF_GATED_ROOMS` set is deleted with its comments: the Composer is the only surface left in
  it, so the spinner speaks for the Composer alone.
- **Verified on 5001 inside the React frame.** On Development: the sandbox count is 0; one room
  box and one room root are mounted; the box measures 1280 × 664 and paints the tile with repeat,
  natural size, top left; `isThirdOpen` is false and the chat strip is the only visible column;
  the seat is bound to session `86f49051…`, conversation `562ffdcb…`, title `Development`, with
  `chat,trace,tools,approvals,eval,states,repair,settings` (no Versions); the tool's frame drew
  its own heading, "What do you want to work on?". Leaving to the Composer and returning mounted
  the room again with the same rows and the same closed rail. On the Composer: one sandbox, one
  renderer, no room box. `npm run typecheck` is zero.
- **What this step did not do.** The room still wears the shared `workspace-layout` and the shared
  `<chat-panel>`; the room's own copies are Steps 2 and 3. The shell still calls
  `warmLabGrounds()`, which is the shared room-ground warmer (four grounds, Governance's and
  Design's among them) and not a Development branch — it keeps the tile decoded before the click.

## 2026-10-24 — the room's own workspace and chat (Steps 2–3), and the sever begins

- **The person sees the same room.** The lab tile, the tool, the closed rail and the Development
  conversation are unchanged. What changed is ownership: the room now mounts its own layout and
  its own chat element, and the shared ones are no longer on the page.
- **The layout is the room's own.** `rooms/development/development-workspace.ts` is a whole copy of
  `components/lit/workspace-layout.ts`, retagged `development-workspace` and self-registering. The
  room imports it for its side effect and mounts it. The copy is verbatim, including the open width
  (700) and the grip listeners; its provenance note names the source and the remaining sever.
- **The chat is the room's own.** `rooms/development/development-chat-panel.ts` is a whole copy of
  `components/lit/chat-panel.ts`, retagged `development-chat-panel` and self-registering. The room
  imports it before rendering and mounts it in the right slot. Registration is two layers, not
  four: the file defines the tag and the room imports it. No catalog entry, no tag-registry entry
  and no backend emit — no assembled surface names this seat, because the box renders it. The
  backend's `chat-panel` emissions for other rooms are untouched and no `render-development` intent
  was added.
- **The sever has begun.** The Product room's branches are removed from the copy: its two properties
  and their declares, the build-wireframe action, the attach/tool forwarders, the clipboard paste,
  the blank-seat return, and its thread and foot branches. The thread is now `<chat-messages>` and
  the foot is `<chat-plugin-tray>`. From the Console: the prompt library, `<reassemble-console>`,
  the composer-package action and the trailing-button switch. The seat's declared settings the room
  binds (`tracePrompt`, `graceLiveContext`) are kept.
- **Measured on 5001 inside the React frame.** On Development: one `development-workspace`, zero
  shared `workspace-layout`; `isThirdOpen` false at 1280 wide; the tool's heading drawn. The seat:
  one `development-chat-panel`, zero shared `chat-panel`, bound to session `86f49051…`, conversation
  `562ffdcb…`, title `Development`, the eight-tab rail without Versions, `graceLiveContext: false`,
  `tracePrompt: false`. Opening the Chat rail raised the column to 640 and drew `chat-messages`,
  `chat-input`, `prompt-textarea` and `chat-navigation-bar`; no `chat-product-thread` or
  `chat-product-tools` is on the page. The Composer still mounts one shared `workspace-layout`, one
  shared `chat-panel` and one sandbox. `npm run typecheck` is zero.
- **What remains in the copy.** The Console's seat-scope read and hello flow, the Governance room's
  trace facts and hello, and the Composer's hello machinery are still present and inert here; they
  are the next sever stage. The wrapper's own sever (the Composer's dock, the Design room's ingest,
  the Console's width ceiling) is deferred to the Composer's cut, when the shared source retires —
  the copy stays verbatim until then.
- **The remaining plan is recorded.** `PLAN-remaining-development.md` carries the rest of the room
  work and the tool track; its pointers are at the top of `development/CHANGELOG.md` and
  `development/ops/WRITING-AREA-EXTRACTION-PLAN.md`. The owner's direction for the next project is
  on the record: the Composer becomes sovereign, the A2UI sandbox and its file are deleted, and the
  tab gates go with it.

