# The Design room — changelog

## 2026-10-24 (closing the tab) — the shell residue, the TLS banner, and the room record

**The shell no longer carries a Design render path.** The sandbox condition in
`WritingAreaIndex.tsx` now excludes `headerTab !== 'design'`, so the sandbox does not mount behind
the Design box. The two stale paths are corrected to `rooms/design/tools/ToolsSeat.tsx` and
`rooms/design/DesignRoom`; the sandbox's own comments no longer say Design is in its set; the top
design-boundary comment no longer describes a portal the shell no longer owns; the dead blank
lines after the Development and Governance comments are collapsed. The shell is **4,154 lines**.
Verified: with Design active the sandbox count is 0, the Design box/root/renderers/seat/UX view
are present; with the Composer active the sandbox count is 1; returning to Design returns it to 0.

**The TLS banner is removed from the framed application.** The orange “PostHog dangerously running
in PRODUCTION mode without TLS!” notice came from
`design/posthog-master/posthog/templates/overlays.html`, not from our shell. The non-debug branch
that prepended it is removed. The running `posthog-master-web-1` container was patched with the
corrected template and restarted, because the image rebuild is blocked by a Docker overlay-snapshot
error. The embedded document was stale after the restart; reloading the frame showed no
`#bottom-notice` and no warning text. The direct app and the 5001 proxy both answer 200 with no
warning. The app's own invite banner remains; it is not ours. The full record is
`design/POSTHOG-STARTUP-TRIM-2026-10-24.md`. A container recreate before a successful image build
would restore the old warning; a restart keeps the patch.

**The room record.** `rooms/design/README.md` is the detailed room record: the structure, the three
conversations, direct Grace, the footer, the notebook and discussion, the framed application, the
shell boundary, the open items and the working rules. The top-level `README.md` remains the global
summary and points here.

The typecheck is zero. No build, preview or tunnel rebuild was made.

## 2026-10-24 (Stage 1 footer) — the product chip follows the place

**The map.** `rooms/design/ux/ux-products.ts` holds the ten-plus places and their product labels,
icons and path shapes. The shared selector's eight entries are Auto and the seven products PostHog
shows: Product analytics, SQL, Session replay, Error tracking, Surveys, Flags and AI observability.
Web analytics reads as the Product analytics family in the chip; Logs and Customer analytics fall
back to Auto until their own modes exist.

**The place bridge.** `ux-app-frame` reads the same-origin frame's current pathname and announces
`ux-app-location` when it changes. The frame routes internally with the history API, so this small
read is what keeps the footer honest; the app's navigation is the only navigation.

**The footer.** The tray card now has a row. `ux-product-chip` is the PostHog-shaped product chip;
its flyout opens Auto, a divider, and the seven products, with the current product marked.
`ux-context-chip` is the Add context chip: the @ mark, the label and the chevron, opening the page's
own context. The room's notebook and discussion are flat text chips beside them, not a menu.
`chat-plugin-tray` gives the card's slot one row for all four.

**Add context.** The Add context flyout carries the first real context, “This page — Product
analytics”, with a check when it is attached. Toggling it sets the context for the next question;
the duplicate Add context pill was removed from the output, so the footer is the one surface for
it. The full context picker (insights, dashboards, events, actions, notebooks) is the later stage.

**Verified on 5001, inside the React frame.** The landing place shows Product analytics in the
chip, then Add context, Notebook and Discussions in one flat row. The row is vertically centered:
the card's center and the chip center both measured 1034. The product flyout opens Auto, Product
analytics, SQL, Session replay, Error tracking, Surveys, Flags and AI observability, with Product
analytics selected. Choosing Session replay pins the chip to Session replay; choosing Auto returns
it to Product analytics, the current place. Moving the frame to the Session replay path moves the
chip to Session replay under Auto. The path was restored to the insights landing and the chip
returned to Product analytics.

The Add context flyout shows “This page — Product analytics”; toggling it marks the check and turns
the context on, and toggling it again returns it to off. Notebook opens its panel from the footer,
hides the chat action bar and input, and leaves every footer chip in place; Discussions opens from
that same footer, restores the input with the “Discuss Product analytics” placeholder, and Back
returns to the chat. Switching the seat to Chat hides the product, context and control chips and
restores “chat input”; switching back to UX shows the footer and its current product again. The
discussion turn now also receives the current product and the Add context text with the UX script.
The typecheck is zero. No build, preview or tunnel rebuild was made. The full Add context picker
and the optional location actions are not built yet.

## 2026-10-24 (last for this tab) — the UX turns go to Grace directly

**No PostHog agent in the active path.** The UX chat and the discussion now send their turns to
`/api/teacher/query`, Grace's own door, with the UX package id, the UX conversation id and the UX
script. They no longer call `/api/ux/posthog-chat`, the route that handed the words to the framed
PostHog application's agent. The model was already ours; the agent workflow around it was theirs.
Now both the model and the turn route are ours.

- `rooms/design/ux/ux-voice.ts` holds `UX_GRACE_INSTRUCTIONS`: she is the analytics assistant in
  this tab, with the Product analytics application on the left and the data it holds. The UX view
  sends that script as `context`, with `mode: 'chat'`, reasoning off, memory on, and
  `person_turn: true`.
- `/api/ux/chat/thread` now resolves the UX package through the same Design-tab writer and returns
  `package_id` with the conversation id. The view keeps both and sends them with every turn.
- The discussion panel uses the same direct door with the UX package id and the discussion
  conversation id. Its thread stays a separate conversation under the UX package.
- `/api/ux/chat/new` creates a real new conversation under the UX package and moves the package's
  primary pointer to it. The `/new` command uses it, so a new chat is a new thread rather than a
  reopened old one.
- The old `/api/ux/posthog-chat` route remains in the backend but nothing in the frontend calls
  it. It is an unused legacy door now; the PostHog agent is out of the active path.

**Verified on 5001, inside the React frame.** A direct `/api/teacher/query` turn with the UX
package and conversation answered “Hi — what would you like to look at in the Design room UX tab?”
The UX input then sent “hi” through the same door and drew Grace's answer in the thread. The
discussion panel sent “hi” with the UX package and its own conversation and drew Grace's answer
there. No PostHog refusal appeared. The test turns were removed; the UX conversation is empty and
showing the welcome, the discussion is empty with its character, and the notebook is empty. The
typecheck is zero. No build, preview or tunnel rebuild was made.

**The next plan.** The product-aware chat footer is planned in `PLAN-ux-chat-tools.md`. Its
correction is the template: most products share one footer menu, and selecting a product changes
the chip's label and icon and Grace's focus, not the menu. Add context is the common action; a
place's own actions, such as Web analytics' Export all as CSV and Session Attribution Explorer,
are the exception. The plan also covers the location bridge that makes the footer follow the
navigation, the registry, and the tracking contract the UX designers will wire later.

## 2026-10-24 (still later) — the bottom card opens the notebook and the discussion

**The reserved card has its control.** `chat-plugin-tray` now carries a default slot inside its
`card`, the empty reservation at the foot of the chat. The UX view places
`rooms/design/ux/ux-chat-controls.ts` in it: one simple icon (not a PostHog icon) and, when
pressed, a small menu of text chips — Untitled notebook and Discussions. The menu opens above the
card. The outside-click check reads the composed path, because the control lives in the seat's
shadow root and a retargeted target would otherwise close the menu on the press itself. The
control is visible only while UX is the active tab; the card is empty in Chat and Tools.

**The notebook.** `rooms/design/ux/ux-notebook-panel.ts` opens in the chat output. It draws the
PostHog hedgehog character, an editable title and the notebook body, with Save. The notebook is
stored on the UX conversation's own metadata (`conversations.metadata.ux_notebook`), through
`GET/PUT /api/ux/chat/notebook`; the UX package and its primary conversation are resolved by the
same helper the other conversation tabs use. A failed read draws its error and a Try again action;
it never shows an editable empty sheet that could overwrite the real notebook. The chat action bar
and input step aside while the notebook is open; the tray stays so the control and the menu remain
reachable. The panel's Back returns to the chat and restores the input.

**The discussion.** `rooms/design/ux/ux-discussion-panel.ts` opens in the chat output and draws the
PostHog stop hedgehog. The discussion is a separate conversation under the same UX package
(`conversations.tab = 'discussion'`), created or found by `POST /api/ux/chat/discussion`; its
messages are rows under that conversation, not mixed into the chat thread. The panel draws no
second composer: its words come from the seat's own input, whose placeholder becomes "Discuss
Product analytics". The words travel through the existing `/api/ux/posthog-chat` door with the
discussion conversation id, so the same app agent and the same database write path serve it.

**Verified on 5001, inside the React frame.** The Design → UX bottom card holds the icon; the menu
opens on a real press and shows both chips. The notebook panel draws the hedgehog at 70 by 105,
loads the saved title and body, saves a change to the database, and returns to the chat. The
discussion panel draws the stop hedgehog at 84 by 84, opens or finds conversation
`52d79c98…`, reads an empty thread, and the main input sends through it; the person's turn and the
agent's refusal were written under that conversation and the refusal was drawn in the panel. The
analytics application's own agent still returns "I'm unable to respond right now" for every test
prompt, including "hi"; the notebook does not depend on it. The test notebook content and the two
test discussion messages were removed, and the owner's UX conversation is empty again with the
PostHog welcome and the control in place. The typecheck is zero. No build, preview or tunnel
rebuild was made.

**Still open from the plan.** The top readout with the conversation identity, New chat and
Download, and the Add-context function are not built; the bottom card now carries the room's
notebook and discussion controls. The chat file's Stage 5 severing and job split remain pending.
The God file cleanup waits for the owner's review, as instructed.

## 2026-10-24 (later) — the two conversations, the console split, the chat's own folder

**The Tools conversation is its own.** `PromptSessionsAPI.get_or_create_design_tab` is the one
writer for a Design conversation tab: it finds or creates the tab's package, attaches its
conversation, and seeds the tab's introduction once when the conversation is empty. The Tools
route uses it, so the Figma conversation now lives under the Tools package instead of the Design
container. `rooms/design/tools/GraceToolsChat.ts` replaced the old shared file: it is a view in
the seat's output, reads the Tools thread with
`GET /api/conversations/{id}/messages`, captures the seat's own input, and sends both the package
id and the conversation id to `/api/teacher/query`. It draws no second input. The server's
introduction is the first message.

**The UX and Chat tabs use the same shape.** The UX route calls the same helper; the UX tab has no
stored introduction because its welcome is the PostHog screen. The design console calls the helper
for the Chat tab instead of falling back to the Design container. The database holds three tab
conversations for the owner: Chat (`f13c2530…`, two rows kept), Tools (`053d5836…`, introduction
plus one verified question and answer), and UX (`aa45011d…`, empty, waiting for the welcome's first
turn). The Tools question was asked through the seat's own input and landed in the Tools thread; the
Chat thread did not change.

**The console's read and the left column are their own files.**
`rooms/design/console/useDesignConsole.ts` owns the console request, its tree, its left
application, its refusal and the cover fact. `rooms/design/console/leftColumn.ts` owns the created
left column, the UX frame, the assembly cover, the row-selected listener and the placement of the
standing application. `DesignSeatShell.tsx` fell from 525 lines to 338 and composes the two.

**The chat moved into its own folder.** `design-chat.ts` is now
`rooms/design/chat/design-chat.ts`; its style block moved whole to
`rooms/design/chat/design-chat.styles.ts`. The registration and the room import follow the new
path. The file is 5,371 lines. The severing of Product, Governance and Composer code and the
further job split are not finished; they are the next Stage 5 cut.

**The PostHog welcome is in the UX tab.** `rooms/design/ux/posthog-prechat.ts` draws the Product
analytics welcome from the framed application's own Max screen: the headline "How can I help you
understand users?", the subtitle, the notice, the eight colourful topic buttons and the four
preset cards (or the Learn list) for the selected topic. The topics, prompts and card copy are
copied from `scenes/max/suggestionTopics.tsx`. The welcome is a Lit view, not the app's React chat.
It shows only when the UX conversation has no person turn and the thread read has succeeded. A
complete preset sends through the UX view's own `/api/ux/posthog-chat` door; a fill-in preset
places its prefix in the seat's own input and focuses it. The welcome hides when the first person
turn exists, so a reload with a real turn goes straight to the conversation. The placeholder UX
introduction is gone from the server and from the owner's empty UX thread; the old `ux` intro is
also filtered from the thread read, so no second greeting can appear.

**Verified on 5001, inside the React frame.** Design → Tools draws the Figma form and layer tree;
Grace's Tools introduction is the first turn; the question "What should I check before I approve
an ingest?" was asked through the seat's input and answered in the Tools thread; switching Chat →
UX → Tools kept the three Tool turns and did not reload the tool; the Tools input's placeholder is
its own. Design → UX draws the PostHog welcome with its eight topic buttons and four cards; the
selected Analytics topic shows its four presets; the input reads "Ask about product analytics";
the welcome is 670 by 485 inside the output; the icons paint in their topic colours. A preset was
clicked and it hid the welcome and drew the person's turn. **The analytics application's own agent
then refused both the retention preset and the Learn feature-flag prompt with "I'm unable to
respond right now. Please try again later."** The refusal is drawn in the thread, never hidden.
The route's own note says it reads no analytics data; the generic "hi" thread in the database shows
the door can answer a plain greeting, so the failure is the application's agent, not the welcome.
The test turns were removed and the owner's UX conversation is empty again, showing the welcome.
The Chat tab reads the Chat package's conversation. The console split draws the cards, the Figma
tool and the UX frame with no visual change. The typecheck is zero. No build, preview or tunnel
rebuild was made.

**The new plan.** The PostHog welcome screen, the top readout, the conversation identity and the
bottom functions are planned in `PLAN-ux-posthog-chat.md`. The plan records the seat's law: the
Design Chat tab is the general console-like conversation; Tools and UX carry their own; every
general conversation lives in Chat; an introduction is loaded once.

## 2026-10-24 — its own box, and the shell lets go

**Dead weight out.** Nine files that nothing drew or imported were removed: the 322 KB
`design-chat-panel` duplicate, `DesignInterface`, `SeatShell`, `chat-seat`, `DesignCards`,
`DesignConsole`, `DesignLoading`, `useDesignSurface` and `useDesignPreview`. The shell's inert
design memory also went: `designTree`, `designRendererRef`, `designPreviewOpen`, the
`useDesignSurface` and `useDesignPreview` calls, the width effect and the empty effect. None of it
ran. `npm run typecheck` stayed zero.

**One folder.** The room moved from `frontend/src/design/` to `frontend/src/rooms/design/`. The
imports in the registry, the room, the Tools seat, the injector, the UX view and the shell were
rewritten. Typecheck stayed zero; the room drew the same.

**The box.** `DesignBox.tsx` owns the light design sheet over `#582846`, the
`data-room-root="design"` marker and the key that keeps React from recycling a hidden node.
`DesignRoomContainer.tsx` is the room's boundary and its lazy import. The shell mounts one
`<DesignBox />` beside Product and the Console; the sandbox no longer holds Design, and the shell
no longer carries a design ground, tree, renderer or preview.

**The tab gate is gone.** The shared gate file was deleted. The shell has one plain
`handleTabChange`: the Composer clears and assembles, every other tab changes the header. The
Console room asks for its own surface on every later entry, and the initial page's assembly stays
in the shell's mount effect. Design's own cover is its gate; no shared cover stands over it.

**Verified on 5001, inside the React frame.** Re-entering Design shows the room's own cover at
opacity 1; five seconds later the renderer, layout, chat and room root are present and the cover is
`aria-hidden` at opacity 0. Switching to Product unmounts the Design box and mounts the Product box;
no shared cover is involved. The Figma ingest tool is untouched.

**The archive.** The original prompt and the three retired plans moved to `design/archive/`, with
a README that names each and why it was retired. Nothing was deleted.

**A new plan.** `PLAN-tools-and-ux-chat.md` sets out the Tools and PostHog chats as their own
conversations under Design: one `design_tab` package per conversation tab, Grace's introduction as
the first message, the Tools view mounted in the seat, and the UX package aligned.

**The standing audit.** [the top-level README](../../../../README.md#sovereign-shell-audit-2026-10-24) is run at the start of every
refinement turn: the shell inventory, the shared and external dependencies, and the workspace
wrapper map. The Design box is clean; the stale comments and the dead markers are recorded; the
shared `workspace-layout` is the next structural finding.

**Next.** The console's own files (Stage 4), then the chat's folder and per-tab split (Stage 5). The
plan is `PLAN-sovereign-design.md` beside this file.
