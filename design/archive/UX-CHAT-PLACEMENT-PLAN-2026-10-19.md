# The UX Chat — Placement Plan (2026-10-19)

Owner's direction, verbatim: *"we have this space at the bottom for chat controls related to
post hog … that's what that space is reserved for customization … these are not rigid slots
inside of the chat … this can be leveraged for section related headers … if I'm chatting inside
of a particular thing like product analytics you could put that at the top … then put a second
line underneath it maybe with model and some token usage if necessary … these grippers are meant
to allow you to expand those areas and read more text. It's a drag feature … you can add up to two
more buttons there if needed, round buttons for a download link … there's a lot of space leverage
here without reinventing it or tearing it apart."*

The rule this plan follows: **ABSORB PostHog's chat functions into the slots this chat already
draws.** Nothing is invented beside the design, and the seat's file is not edited.

---

## 1. The slots that already exist

| # | Slot | Where it lives | Today |
|---|------|----------------|-------|
| 1 | Rail (tabs) | `chat-navigation-bar` inside `design-chat` | **Chat, Tools, UX, Settings** — Trace, Evals and Repairs were removed on the owner's word, 2026-10-19. The UX mark is the owner's own icon, painted in the rail's teal (#1FACC2) through a CSS mask, so the artwork file is untouched |
| 2 | Section header, line 1 | `ux-chat` `.section-name` (view slot) | **Added 2026-10-19** — says the screen the person is working in ("Product analytics"); the owner approved this default because it keeps the app's own homepage as the framed screen rather than the room's chat |
| 3 | Section header, line 2 | `ux-chat` `.section-meta` | Reserved; drawn only when the server supplies model/turn figures |
| 4 | View slot (the output) | `design-chat` `.view-slot` → `ux-chat` | Thread + quick links + the working beat (the system's spinner and the turn's real seconds) |
| 5 | Action bar | `chat-action-bar` | Send/Stop, Console chip, input-area gripper. **The two round buttons are not built yet** (see §3) |
| 6 | Input area | `chat-input` → `prompt-textarea` (labelled **chat input**) | The only input; the UX view wires its Send/Enter on the UX tab |
| 7 | Foot card | `chat-plugin-tray` `.card` | **Emptied 2026-10-19** — label and credit removed; it is the reserved space for the room's chat controls |
| 8 | Foot gripper | `chat-plugin-tray` `.gripper` | Drags the input area's height (`input-resize-start/move/end`) |
| 9 | Column gripper | `design-chat` `.gripper-chat` | Drags the column's width; collapses at the floor; **pointer capture added 2026-10-19** so it survives the framed app |

---

## 2. What PostHog's own chat has (scanned from the local build)

Source read: `design/posthog-master/frontend/src/scenes/project-homepage/ai-first/` (the AI-first
homepage: `HomepageInput`, `HomepageThread`, `homepageSuggestions`) and `scenes/max/` (the chat
itself: `Thread.tsx`, `QuestionInput.tsx`, `ConversationHistory.tsx`).

| PostHog function | Present in the app | Our home for it |
|---|---|---|
| Section context ("where am I") | The AI-first homepage embeds the thread in the project context | Slot 2 — header line 1 (done) |
| Model + usage readouts | In the composer and turn trailer | Slot 3 — header line 2 (reserved; needs the figures from the app's stream) |
| Quick links / suggestion cards | `homepageSuggestions` + `SuggestionCard` + `TopicBadges` | Slot 4 — the chips row (done) |
| Conversation history (list, open, delete) | `ConversationHistory.tsx` — compact list, titles, dates, delete | **Saved per tab in our database** (see §4); a compact list in slot 4 is the next addition |
| Message rendering (markdown, code, tables) | `MarkdownMessage` / `Thread` | Slot 4 — the thread renders plain text today; **markdown is the next addition** |
| Streaming answers | SSE from `/api/projects/:id/conversations/` | Our door waits for the final snapshot; streaming into the thread is a follow-up |
| Stop a turn | `QuestionInput` stop button | Slot 5 — Send becomes Stop while a turn is in flight (`busy`) |
| Feedback (thumbs), copy, retry | `TurnTrailerActions` | Slot 4 turn actions — to add |
| **Download / export** | **Not built in the app** (searched `scenes/max` and the ai-first files: no download) | Slot 5/7 — if we add it, it is ours, and a round button is the right shape |
| Model picker, tools, slash commands, hands-free, file attachments, message queue | `QuestionInput` (Max composer) | These belong to the **seat's composer** (slot 6). They are not output features and are not added without the owner's word |

## 3. Placement of the two round buttons (owner's allowance)

The action bar (slot 5) currently draws: Send/Stop · Console · input-area gripper. The owner's
allowance is **up to two more round buttons**. The rule: the bar is shared by every tab, so a
room's buttons must be **supplied by the room**, not baked into the bar.

Plan: give `chat-action-bar` two small round slots (`controls`, `controls-end`) that a room can
fill. The UX view fills the first with **Download** (exports the thread it owns, as Markdown) —
only if the owner wants it, since the app has no such feature today. Verify: on the UX tab two
round buttons sit between Send and Console, and they are absent on every other tab.

**Download already exists as a command** (2026-10-19): `/download` in the input exports the
thread as Markdown. The round button is the visible control for the same action; until the bar
has its slots, `/download` is the working path.

## 3b. The features ported from their chat (2026-10-19)

Owner: *"the actual chat is already still there. It's sitting right next to our chat … all you
have to do is port the features directly into our user interface."* Each one, read off the app
and rebuilt here on our own data:

| Their feature | Ours |
|---|---|
| **Recent chats** (title + "Just now"/"29m", View all) under the composer | A **Recent chats** block at the top of the output — the UX tab's saved threads (`GET /api/ux/conversations`), title + last save, the open thread marked; **New chat** starts an empty one; **View all** toggles the full list. Opening a row reads that thread (`GET /api/ux/chat/thread?conversation_id=…`) |
| The **mode tab** ("Product analytics") and **Add context** pill over the input | A **pills row** directly above the input: the section pill names the screen; **Add context** is a real toggle that attaches the section to the next question (the door sends it as a context line and stores it on the message) |
| Placeholder **"Ask a question or / for commands"** | The seat's own field carries that placeholder while UX is the active tab, and is put back to "chat input" on every other tab |
| **/ commands** | `/new` and `/download`, listed in the view when the input begins with "/" |
| The waiting beat | The system's spinner + the turn's real seconds |
| Quick links (8) | The same eight, in our chips row, at the bottom by the input |

## 3c. Where the UX experience lives (isolation, 2026-10-19)

Owner: *"You need to stay inside of the design folder. I don't want things happening outside of
it, and if it is happening outside, we need to take that code and pull it into the folder and
isolate this experience."*

**Inside `frontend/src/design/`** (the whole experience):

| File | What it is |
|---|---|
| `ux/ux-chat.ts` | **Moved here 2026-10-19** (was `frontend/src/ux/`). The view: thread, recent chats, chips, pills, commands, placeholder wiring, the turn call |
| `ux/quick-links.ts` | **Moved here 2026-10-19**. The eight quick links |
| `ux/UxNav.tsx` | **New 2026-10-19.** The absorbed PostHog navigation (rail + panel) |
| `ux/posthog-nav.ts` | **New 2026-10-19.** The captured nav data and icons — generated, see §3d |
| `DesignSeatShell.tsx` | Creates the seat and mounts the view (`slot="view"`, `view-tab="ux"`), and holds `UX_APP_LANDING` / `UX_APP_SECTION` |
| `DesignInterface.tsx`, `SeatShell.tsx` | The room's other paths — they mount the same view by the same import |
| `design-chat.ts`, `design-chat-panel.ts` | The seat copies (the gripper's pointer capture lives in both) |

`frontend/src/pages/WritingAreaIndex.tsx` carries **nothing** of this experience any more: the
`uxTalk` injections are gone and the view is not mounted from there (verified by search: no
`uxTalk`, no `ux-chat` in `pages/`).

**Outside `frontend/src/design/`, and why** (these are shared catalogue elements, not the UX
experience):

| File | Why it cannot move into `design/` |
|---|---|
| `components/lit/chat-navigation-bar.ts` | One rail draws every room's tabs. The UX entry is listed there and only draws where a room names `ux` in `allowedTabs` — Design alone. The teal mask is generic (`maskSrc`) |
| `components/lit/chat-plugin-tray.ts` | The tray is the seat's shared foot. The label and credit were removed globally on the owner's word |
| `backend/routes/ux_chat.py` | The server door. The backend keeps every room's doors in `backend/routes/` (the design room's own door is `design_console.py` there); there is no design subfolder to move into without breaking the app's routing |

## 3d. The left navigation — the application's own, captured whole (2026-10-19)

Owner: *"The navigation is supposed to capture every single thing in the PostHog navigation …
put it inside of the navigation and like I told you to match governance … reuse the UI and the
styling from PostHog … use the icons from the application."*

**Governance's mechanics, the application's content and skin.**

| Piece | Where it lives |
|---|---|
| `design/ux/UxNav.tsx` | The component. Governance's layers: a `width:0` root, a 56px header band holding the logo and the ONLY toggle, a 56px rail that mounts 300ms after the panel closes, a panel below the header. Inside: the app's three bands — project + Search (⌘K) → Apps/Files/Chat tabs → the active tab's list — then its footer (Settings, More) |
| `design/ux/posthog-nav.ts` | **The capture**: every label, href and icon, in the application's own order. Icons are the app's rendered SVG stored whole (every path, `fill-rule`, `clip-rule`) — not redrawn, not merged into one path |
| `design/ux/posthog-nav.dom.json` | The evidence: the raw captured rows with their geometry, kept beside the data so a later build can be diffed against this one |
| `design/posthog-master/ux-frame-proxy/nginx.conf.template` | The app served through a proxy, modelled on the Governance room's Langfuse proxy |
| `DesignSeatShell.tsx` | Mounts the nav (UX tab, gate down), points the frame at the proxy, and marks the row the app reports |

- **What the capture holds** (counting the app's own rows): Home, Activity, People and groups;
  **Starred** — 14 rows, each with the row action the app draws beside it (+ / chevron / dots);
  **All products** — 9 groups (Popular, AI engineering, Data, Monitoring, Product engineering,
  Messaging, CDP, Schema, Tools), 39 rows; the **Files** tab's three trees (Starred → Raibach →
  Empty home folder; Recents; Files → Unfiled, Users); the footer's Settings and More; and the
  three tab icons. 58 rows drawn in the Apps tab, every one with its own icon.
- **Values measured, not chosen:** ground `rgb(229,231,223)`, hairline `rgb(219,222,212)`, text
  `rgb(13,13,13)`, section headings 12px/600 `rgb(64,64,64)`, rows 30px with 4px 6px padding and a
  6px radius. The panel opens at **360px** (the owner's "a little wider"); the rail is 56px.
- **The application's own sidebar is GONE.** The proxy injects
  `#project-panel-layout{display:none}` and `button[aria-label="Open navigation"]{display:none}`,
  so the frame's content starts at x=0. Verified in the room: the frame is
  `http://localhost:8201/project/1/insights`, the nav element computes to `display:none`, the
  injected style is present, and `main` sits at x=0.
- **The active row is real.** The proxy injects a reporter that posts `posthog-location`; the
  shell listens and sets the marked row. Verified: `history.pushState('/project/1/web')` inside the
  frame marked **Web analytics** in under a second — the Governance room's own channel.
- **Chat tab is ours:** it lists the seat's own package conversations (the same list the foot card
  reads) and opens one through the seat's `conversation-select`.
- **Still open, stated:** the app's account menu is not rebuilt (the project row deep-links to
  `/project/1/settings/project`); the Search button opens a client-side palette over the captured
  rows, not the app's server-side search index; the second-level column the app opens for some rows
  is represented by the Files tab's trees, which expand in place.

## 3e. The conversations — in the chat panel's reserved card (2026-10-19)

Owner: *"Those files can go inside of the area reserve in the image … use that space for this
stuff"* and *"It's already featured in the chat panel in the very same goddamn output."*

- The seat already had the whole feature: `chat-header` (the "N Conversations" bar) plus
  `.conversation-list` (title, last-saved time, two-click remove), fed by
  `_readPackageConversations` (`/api/conversations?session_id=…&include_archived=true`).
- **It was suppressed on the UX tab** by `!this._tabClaimant(this.activeTab)` — a host view claims
  the output there, so the bar was hidden. That gate is gone; the furniture now draws on every tab.
- **Its home is the foot card.** `chat-plugin-tray`'s `.card` gained a slot and stopped painting a
  second shell behind its content; the seat renders the SAME `chat-header` and the SAME
  `.conversation-list` into it. Nothing was rebuilt.
- **One store:** `ux-chat` now reads and writes the seat's own conversation
  (`/api/ux/chat/thread?conversation_id=<seat conversation>`), so the thread the person sees and the
  list the card shows are the same package. The duplicate "Recent chats" block that had been added
  inside the view's output is **deleted**.
- Verified in the room: the card shows "2 Conversations"; opening it lists the rows with their
  times and remove controls; the Chat tab lists the same rows; clicking one moves the seat.

## 4. The database slot (done 2026-10-19)

- `prompt_sessions` — one row per tab: `metadata.session_type = 'design_tab'`,
  `metadata.design_tab = 'ux'` (the shape `design_console` already reads for every tab).
- `conversations` — one row under that package: `session_id` = the UX tab package, `tab = 'ux'`.
- `conversation_messages` — the turns (`role`, `content`, `metadata.kind = 'ux-chat'`; refusals
  are stored as `ux-chat-error` so a reload shows what happened).
- The **same conversation id** is given to the PostHog application, so our thread and its own
  thread are one id, and its memory of previous turns survives.
- Doors: `GET /api/ux/chat/thread` (restore) and `POST /api/ux/posthog-chat` (one turn).
- The row lives under the tab's package, **not** under the Design container, so it never appears
  in the room's own conversation list.

## 5. Verification checklist (in the room at http://localhost:5001, Design → UX)

1. **Header line 1** — "Product analytics" is the first line above the quick links; it matches
   the framed screen on the left.
2. **Header line 2** — absent until the server supplies figures; when present it reads
   `model · tokens` and never shows a zero it did not receive.
3. **Quick links** — 8 chips, blue on white; clicking one fills the bottom **chat input** and
   focuses it; the Send button lights.
4. **The one input** — there is exactly one input (the seat's bottom field). The view draws none.
5. **Send/Enter** — a turn goes to `/api/ux/posthog-chat`; the tab stays on UX; the answer draws
   in the output.
6. **Restore** — reload the page, open Design → UX: the saved thread is drawn again with the same
   conversation id (`GET /api/ux/chat/thread`).
7. **Foot** — the card is empty (no "Active Plugins", no credit) and is the reserved space; the
   readouts line above it is untouched.
8. **Foot gripper** — dragging it up grows the input area and shrinks the output; dragging down
   reveals more output.
9. **Column gripper** — dragging left expands the column across the framed app; dragging right to
   the floor and releasing collapses it; a click alone does nothing.
10. **Other tabs** — Chat, Trace, Tools and Evals are unchanged: their own threads, the tray's
    empty card on Chat, no UX chips.

## 6. Open, stated plainly

- **The app's follow-up failure is FIXED (2026-10-19).** Measured before the fix: a brand-new
  conversation answered, and the **second** turn in that same conversation ended with
  `ai/failure`. Two things were true, and both are now changed in the app fork:
  1. `ee/hogai/core/executable.py` — `_execute` swallowed every `NotImplementedError` from the
     async path and fell back to `run`, which the base class raises **empty**; the real cause was
     destroyed every time. It now re-raises the original error whenever the node has no sync
     implementation. (Mounted into the web + three workers.)
  2. The real cause, revealed by (1): `get_num_tokens_from_messages() is not presently implemented
     for model deepseek-chat`. Every follow-up counts the conversation's history with a tokeniser
     tiktoken does not ship for `deepseek-chat`; the first turn never counts history, which is
     why it worked. Both model paths now carry `tiktoken_model_name="gpt-4o"` (a context-budget
     estimate; the model that answers is still ours) — the main call in
     `agent_modes/executables.py` and every secondary call built from `MaxChatOpenAI` in
     `ee/hogai/llm.py`.

  Verified: three consecutive turns in one conversation answer, and the second recalls the
  first ("I said retention is…"); through our own door the same thread answered in 8.5s with
  history-aware words. The failed turns recorded before the fix stay in the saved thread —
  they are what happened, not noise to hide.
- **The TLS banner inside the frame.** `PostHog dangerously running in PRODUCTION mode without
  TLS!` is the application's own warning, drawn in its document because the local install is
  served over `http://localhost:8200` with production settings. **Nobody on the tunnel sees it:**
  the room only loads the app when `window.location.hostname` is `localhost`/`127.0.0.1`; on any
  other host the column draws "The UX program is not served on this host." (no frame at all). An
  HTTPS page could not frame a plain-http localhost app anyway. If the app is ever exposed
  through the tunnel, it must be served over HTTPS (the existing `raibach-ux.ngrok-free.dev`
  domain is the address for that) — the banner disappears by construction, and the cross-site
  sign-in work returns with it. Until then: local-only, and the warning is true.
- **The two round buttons (§3) are not built yet.** The bar needs its two slots and the UX view
  supplies a Download that exports the thread it owns as Markdown. The app itself has no
  download anywhere in its chat (scanned).
- **Markdown in the thread** — the app answers with markdown (lists, code). Our thread draws
  plain text today; the app's own renderer is the target.
- **Streaming** — the door returns the finished answer; the app streams snapshots. A pass-through
  stream is a follow-up. The working beat (spinner + seconds) is drawn meanwhile.
- **History list in the view** — threads are saved; a compact list (title, when, open, delete) in
  slot 4 mirrors the app's `ConversationHistory` and is the next addition.
- **Model/token figures** — line 2 needs the app's usage events; until they are read, the line
  stays absent rather than guessed.
