# UX CHAT INTEGRATION — wiring the analytics application's AI into our chat

*Plan written 2026-10-19. The owner's ask: the analytics application (PostHog) is loading its
own AI chat inside its frame. It belongs in OUR chat — our output, our input field — with their
quick links (Analytics, SQL, Session replay, Error tracking, Feature flags, Experiments, Surveys,
Learn) available as controls in our design. The chat for UX is its own file; it is not repurposed
from another tab, and it only LOOKS the same.*

---

## 1. The ground measured today

* The UX application runs at `localhost:8200`; the Design room frames it in the left column
  (`ux-app-frame`, `src=http://localhost:8200`, displayed; verified in-room 2026-10-19).
* Its AI chat is a page inside that application (`/ai` home: "What can I help you with? / for
  commands", quick-link row, suggestions, pinned dashboards). It is THEIR chat UI, drawn in their
  frame.
* The transport already exists on our side: `POST /api/ux/posthog-chat` (`backend/routes/ux_chat.py`)
  signs into the application server-side, hands the words to their own conversation pipeline
  (their agent workflow on OUR DeepSeek model via the env-gated patch), and returns
  `{content}` or a loud `{error}`. Thread id is derived from the seat session key
  (`uuid5("raibach-ux:"+session_id)`).
* The dedicated file already exists: `frontend/src/ux/ux-chat.ts` (`<ux-chat>`) — own thread, own
  textarea, own turn call. It was written 2026-10-18 to replace the four `uxTalk` injections.
* The injections are STILL in the two copied seats (`design-chat-panel.ts`, `design-chat.ts`:
  `uxTalk` property + thread/send branches) and are set by the room files
  (`DesignSeatShell.tsx`, `DesignCards.tsx`, `DesignInterface.tsx`, `SeatShell.tsx`,
  `ToolsSeat.tsx`) and by `WritingAreaIndex.tsx:1694` (`designSeat.uxTalk = true`).
  That is the monolith carrying a tab's behaviour — the architecture law forbids it.

## 2. The target shape

```
+--------------------------------------------------------------+
| left column (the application)   |   right column (OUR seat)    |
| PostHog analytics screens      |   UX CHAT                    |
| (the frame; NOT their /ai)     |   thread (ours)              |
|                                |   quick-link chips (ours)    |
|                                |   our prompt-textarea        |
+--------------------------------------------------------------+
```

* The frame keeps the application's analytics surface. Their AI page is never opened; the frame's
  entry route is the app's dashboard/home, not `/ai` (verify which route the app boots to when
  the AI home is not forced).
* OUR chat owns: the thread, the quick links, the input, the send, the waiting/thinking state,
  the failure text.
* The input is the house `prompt-textarea` (imported from the catalogue), not a new textarea.
* The quick links are OUR controls (house styling), wired to the same door. Their definitions
  (labels + the prompt each launches) are read from the application's own source/UI, never
  invented from a screenshot.
* The "Active Plugins" tray keeps its label and stays open as a seat; the quick links live in the
  chat output (owner's call: "load the whole thing inside of the chat output and that way we can
  keep the design the same"). The tray remains available for future function controls.

## 3. File map (one tab = one file; nothing added to the monoliths)

| File | Owns |
|---|---|
| `frontend/src/ux/ux-chat.ts` (extend the existing `<ux-chat>`) | The whole UX chat: thread, thinking state, failure text, quick-link row, our `prompt-textarea`, send → `/api/ux/posthog-chat`. Mounted as the seat view (`slot="view"`, `view-tab="ux"`). |
| `frontend/src/ux/quick-links.ts` (new) | The quick-link definitions: label + the command text it places in the input. Derived from the application's own definitions. |
| `frontend/src/design/DesignSeatShell.tsx` | Mounts `<ux-chat>` into the seat view slot and keeps the app frame in the left column. No chat behaviour. |
| `backend/routes/ux_chat.py` | The existing door. No new auth; no UI. |

**Removed in the same pass (after the file is live):** the `uxTalk` property and both branches in
`design-chat-panel.ts` / `design-chat.ts`, every `seat.uxTalk = true` setter, and
`WritingAreaIndex.tsx:1694`. The copies stay byte-identical to the seat otherwise; a tab no longer
carries behaviour through them.

## 4. The wiring

1. **Send** — the person types in OUR `prompt-textarea`; Send posts
   `{question, session_id}` to `/api/ux/posthog-chat`. The thread draws the person's turn, then a
   real thinking state, then the answer (or the error verbatim).
2. **Quick links** — each chip places its command text into our input (does not auto-send;
   the person sees what will be sent and can edit it). The chips render above the input, in our
   chat output.
3. **Suggestions** — the empty thread offers the app's suggestions ("Run a funnels analysis",
   "Find impactful errors", "Launch an NPS survey", "Continue your last conversation") as starter
   rows, built from the same definitions file.
4. **Thread identity** — the seat's session key (already on the seat) is the thread key; the
   backend derives the application's conversation id from it. Our drawn turns persist for the
   seat session in M1; durable storage is a separate decision (see §6).
5. **Failure** — the door's `{error}` is drawn in the thread as the reply; nothing is caught to
   look like an empty answer.

## 5. Phases

* **M0 — discovery (read-only).** Read the application's AI home source for the exact quick-link
  labels, their commands, and the route it boots to; confirm the frame can open the dashboard
  without `/ai`. Record the findings in this file.
* **M1 — the chat file.** Extend `<ux-chat>`: our input (imported `prompt-textarea`), thread,
  thinking state, send through the existing door. Mount it in the Design seat's view slot.
* **M2 — the controls.** `quick-links.ts`, the chip row, the empty-state suggestions; each places
  its command in our input.
* **M3 — the frame route.** Open the application on its dashboard/home; their AI page is not the
  room's chat. Verify the frame never shows their `/ai` UI.
* **M4 — remove the injections.** Delete `uxTalk` from the two seat copies and every setter
  (including `WritingAreaIndex.tsx:1694`); verify Chat/Trace/Evals/Preview tabs are unchanged.
* **M5 — persistence (only if wanted).** Decide whether the UX thread is stored in our
  conversation store; if yes, adopt the conversations-bar pattern (same look/behaviour, its own
  ids/lineage).

## 6. Open decisions (defaults chosen)

* **Chip click** → fill the input (default). Alternate: send immediately.
* **Thread persistence** → M1 keeps the drawn thread for the seat session; durable storage is M5.
* **Suggestion rows** → the app's four suggestions in the empty thread (default), not extra chips.
* **Frame route** → the app's dashboard/home (default); `/ai` is never opened.
* **The tray** → keeps "Active Plugins"; quick links live in the chat output (default).

## 7. Laws held

* `WritingAreaIndex.tsx` and `chat-panel.ts` are not edited; the tab is its own file.
* Catalogue components are imported, not copied; no repurposing of another tab's chat.
* The app's AI chat is not duplicated or restyled — only its capabilities are carried through the
  door it already exposes.
* No fake states: a slow turn shows the thinking beat; a failure shows the real reason.
