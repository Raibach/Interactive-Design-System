# The Design Room — its own box, its conversations, and its footer

The detailed record for the Design tab. The top-level `README.md` is the global summary; this file
and `CHANGELOG.md` are the room's own record.

## What the person sees

The person clicks Design and one room stands up: the light design sheet behind both columns, the
design console's cards on the left, Grace's chat on the right. The room owns its cover, its ground
and its files; the shell mounts one box.

The room has three conversation faces:

- **Chat** is the general Design conversation. It talks about the cards, the filters, the saved
  set-ups, the system and the work. All general conversation lives there.
- **Tools** opens the Figma ingestion application and Grace's conversation about the tool. The
  conversation belongs to the tool.
- **UX** opens the Product analytics application and Grace's conversation about what the person is
  looking at. The welcome is PostHog's own pre-chat screen; after the first person turn, the
  conversation is drawn in our output.

At the foot of the chat is one flat row of tools. The product chip opens the shared product
selector. Add context opens the page's own context flyout. Notebook and Discussions are flat text
chips beside them. The product chip and Add context change what the next question carries; the
notebook and the discussion open their own panels in the chat output.

## The room's structure

```
DesignBox.tsx                 the room's ground and box; mounts the container
DesignRoomContainer.tsx       the room's lazy boundary
DesignRoom.tsx                the one interface and the Figma engine's mount
DesignSeatShell.tsx           the frame, the chat placement, the left column
console/
  useDesignConsole.ts         the design console's read, refusal and cover fact
  leftColumn.ts               the left column, the UX frame, the placement
chat/
  design-chat.ts              the room's own chat element
  design-chat.styles.ts       its styles
tools/
  ToolsSeat.tsx               the Figma ingestion application, headless
  GraceToolsChat.ts           the Tools tab's conversation view
  content.ts                  the Figma application's declared boundary
  index.ts
ux/
  ux-chat.ts                  the UX tab's conversation frame
  posthog-prechat.ts          the PostHog welcome
  ux-chat-controls.ts         the flat Notebook and Discussions chips
  ux-product-chip.ts          the product chip and its flyout
  ux-context-chip.ts          Add context and its flyout
  ux-notebook-panel.ts        the notebook panel
  ux-discussion-panel.ts      the discussion panel
  ux-products.ts              the product map
  ux-voice.ts                 Grace's UX script
  quick-links.ts
design-renderer.ts            the room's renderer
inject.ts                     the console surface's chat and left split
```

## The conversations

One Design container is the division. Each conversation tab owns a package and a conversation.

| tab | package metadata | conversation | introduction |
| --- | --- | --- | --- |
| Chat | `session_type='design_tab'`, `design_tab='chat'` | the console's seat | the design assistant's, seeded once |
| Tools | `session_type='design_tab'`, `design_tab='tools'` | `GraceToolsChat` | the Figma tool's, seeded once |
| UX | `session_type='design_tab'`, `design_tab='ux'` | `ux-chat` | the PostHog welcome, not a stored greeting |
| Discussion | a conversation under the UX package, `tab='discussion'` | `ux-discussion-panel` | none; the panel's character and copy |

`PromptSessionsAPI.get_or_create_design_tab` is the one writer for a tab's package, conversation
and first message. The UX tab has no stored introduction because the PostHog welcome is its
introduction.

## Direct Grace

All three faces send their turns to Grace's own door, `/api/teacher/query`:

- Chat sends the Chat package and conversation with the design console's script.
- Tools sends the Tools package and conversation with the Figma surface's script.
- UX sends the UX package and conversation with `UX_GRACE_INSTRUCTIONS`.
- The discussion sends the UX package and its own conversation with the UX script.

The UX package id comes from `/api/ux/chat/thread`; the UX thread read returns `package_id` and
the conversation id together. `/api/ux/chat/new` creates a new conversation under the UX package
and moves the package's primary pointer to it.

The framed PostHog application's agent is not in the active path. The old
`/api/ux/posthog-chat` route remains in the backend but nothing in the frontend calls it.

## The footer

The reserved card in `chat-plugin-tray` is the footer's surface. The row holds:

- **Product**, one chip with a flyout: Auto, Product analytics, SQL, Session replay, Error
  tracking, Surveys, Flags and AI observability. Auto follows the place; a chosen product pins
  the chip until Auto is chosen again.
- **Add context**, the @ chip with a flyout: the current page, named by the current product.
  Toggling it attaches the page to the next question.
- **Notebook** and **Discussions**, flat text chips. They are not behind a menu. Notebook opens
  the notebook panel; Discussions opens the discussion panel.

The product map is `ux-products.ts`. The framed application reports its pathname through
`ux-app-frame` as `ux-app-location`; the room maps the path to a product. The app's navigation
remains the only navigation; the footer does not keep a second one.

The product and Add context state travel into the next chat turn, and into a discussion turn.

### The notebook

`ux-notebook-panel.ts` opens in the chat output with the PostHog hedgehog. The title and body are
stored on the UX conversation's metadata (`ux_notebook`) through `GET/PUT
/api/ux/chat/notebook`. A failed read shows the error and a Try again action, never an editable
empty sheet that could overwrite the real notebook. The chat input steps aside while the notebook
is open; the footer stays, and Back returns to the chat.

### The discussion

`ux-discussion-panel.ts` opens in the chat output with the PostHog stop hedgehog. The discussion is
a separate conversation under the UX package, created or found by `POST /api/ux/chat/discussion`.
The panel draws no second composer: the seat's own input carries the words, with the “Discuss
Product analytics” placeholder. The messages stay under the discussion conversation, not in the
chat thread.

## The framed application

The Product analytics application is framed same-origin at `/posthog`. Its own navigation is its
navigation; the room does not redraw it. The PostHog welcome, the product footer and Grace's turns
are ours.

The PostHog TLS banner was removed at its source in
`posthog/templates/overlays.html`. The running web container was patched and restarted because the
image rebuild is blocked by a Docker overlay-snapshot error; the source is corrected for the next
healthy build. The full record is `design/POSTHOG-STARTUP-TRIM-2026-10-24.md`.

## The shell boundary

The shell imports `DesignBox` and mounts it while the Design tab is selected. It carries no Design
tree, renderer, preview, ground, chat or state. Its sandbox condition excludes Design, so no second
surface mounts behind the box. `WritingAreaIndex.tsx` is 4,154 lines.

The shared `workspace-layout` is still the structural wrapper the room draws. It is the remaining
shared structural dependency for Design and the next cut of its kind.

## Open items

- The full Add context picker: insights, dashboards, events, actions and notebooks. The current
  chip attaches the page.
- The optional location actions, beginning with Web analytics' Export all as CSV and Session
  Attribution Explorer. Most places add none.
- The tracking contract for the UX designers: product changes, action opens and runs, context
  additions. The destinations and the customer frontend setup are later work.
- The room-owned copy of `workspace-layout`, so the room stops drawing the shared wrapper.
- The chat file's Stage 5 split and severing: `chat/design-chat.ts` still carries Product,
  Governance and Composer code that Design does not use.
- The unused `/api/ux/posthog-chat` route can be removed once no compatibility path needs it.
- The PostHog image build must be completed before the web container is recreated, or the removed
  TLS banner returns with the old image.

## Working rules

- Test the room inside the React frame on `localhost:5001`, not at a direct address.
- The typecheck must be zero.
- No build, preview or tunnel rebuild without the owner's word.
- The turn goes to Grace; no PostHog agent, no second chat input and no duplicate navigation.
- The Figma ingestion tool is fragile and is not changed to make the chat fit.

## The record

- `CHANGELOG.md` — what was done, in order, with what was measured.
- `PLAN-sovereign-design.md` — the room's own box and files.
- `PLAN-tools-and-ux-chat.md` — the Tools and UX conversations.
- `PLAN-ux-posthog-chat.md` — the welcome, the top readout and the output features.
- `PLAN-ux-chat-tools.md` — the product-aware footer, the selector and the location actions.
- `design/POSTHOG-STARTUP-TRIM-2026-10-24.md` — the analytics application's startup and the TLS
  banner.
