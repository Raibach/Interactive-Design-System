# Design Seat — Session Record, 2026-11-07

This file records the work done in this session on the Design room's right column, and it records
the failures as plainly as the corrections. It exists so the same work can be repeated on the
other tabs, and on the Composer chat, without the same circles.

The subject of the session was the Chat tab under Design — the Chat console seat — and the Tools
tab was the working reference throughout.

---

## 1. The reference: the Tools tab

The Tools tab works. Its shape is the shape every seat should follow.

| Part | Tools |
|---|---|
| Seat page | `frontend/src/rooms/design/tools/tools-chat.ts` |
| Conversation file | `frontend/src/rooms/design/tools/conversation.ts` |
| Package row | `prompt_sessions`, `design_tab = tools` (`7600fbc7`) |
| Conversation store | `DATABASE_URL`: `conversations` (`session_id` = the package), `conversation_messages` |
| Words | its own instructions, handed in from the Figma content (`injectedChat.instructions`) |
| Default open | the package's list, newest first by `updated_at`; the first live row; create only at zero |
| Trigger | the room's tab press calls `loadDefaultConversation` |
| Send | `/api/teacher/query` with the seat's session, conversation, words and `person_turn` |
| Card | the seat's own conversation rows; collapsed bar; a click opens it |
| Grips | the frame's `wireGrips` attaches the drag to each `.gripper` band in the right column |

The Tools tab's chat input had one real fault that this session fixed: after a send it cleared
the draft but looked for `prompt-textarea`, while the drawn control is `design-prompt-textarea`.
The visible words stayed in the box, the bar's `hasText` went false, and Send looked dead. The
Tools seat now has the Chat seat's `_clearDraft()` writer, which uses the drawn element's own
`clear()`. That is the only change made to the Tools seat.

---

## 2. How the Chat console was identified

The Chat tab under Design is the "Chat console" seat. It was the shared
`frontend/src/rooms/design/chat/design-chat.ts` element, created by `DesignSeatShell.tsx` and
given `chatInfo` built from the surface's console chat component (`baseChat`): the Console
package's session, conversation and list, and `DESIGN_CONSOLE_GRACE_INSTRUCTIONS`.

That is the root of the failure. The Chat tab was not its own seat. It was the Console's seat
wearing the Chat tab's tab. It spoke with the Console's words, read the Console's list, and the
Console route rotated the Console package's conversation on each assembly. The Chat tab was never
given an identity of its own.

The visible failures followed from that:

- The Chat adopted the newest Design conversation, which was the Figma/Tools chat, and then the
  ownership check refused it: "This conversation is not this seat's … belongs to another tab."
- The Console package's conversations grew on every visit, because the design console route
  creates and rotates them.
- The Chat answered as the Console, and a reply that was a surface command left no prose. The
  screen showed the thinking state and then nothing.
- The Chat's list, its words and its conversation were all another seat's.

---

## 3. How the Chat was broken out of the shell

The Chat console now has its own seat file and its own conversation file:

- `frontend/src/rooms/design/chat/console-chat.ts` — the Chat console's own seat. It is created
  by `DesignSeatShell.tsx` for the Chat tab, exactly as `tools-chat` is created for Tools.
- `frontend/src/rooms/design/chat/console-conversation.ts` — the Chat console's own conversation
  file. It reads the Console Chat package's list with `listForPackage`, the same store the Tools
  file uses, and it does not import the Tools file.

`console-chat.ts` extends `design-chat.ts`; the shared template is inherited. This is a subclass,
not a full page copy, and that distinction matters for the grips (see section 7).

What the shell hands the Chat seat now:

- the room's data model;
- the tab packages (`designPackages`);
- the Chat tab's own words from the data model;
- no session id, no conversation id, no conversation list, and no console instructions.

What the Chat seat resolves itself:

- its package, `packages.chat` (`cc952185`), from `designPackages.chat`;
- its conversation list from `listForPackage` for that package;
- its default conversation: the first live row (the last modified), else a new conversation.

The shell's tab press now calls `loadDefaultConversation` for both Tools and Chat, the same call
the Tools seat answers. The Chat seat also opens its default from its own first draw.

The other Design seats were given the same rule: the shell no longer hands any non-Tools seat a
pointed conversation id or the surface's conversation list. Each seat reads its own package's
list and takes the first row. The Approve seat has no conversation; its rows are records.

---

## 4. The Chat tab's own words

The Chat seat was speaking with the Console's instructions. The assembly now carries a second
script for the Chat tab:

- `backend/routes/design_console.py` — `DESIGN_CHAT_TAB_GRACE_INSTRUCTIONS`, exposed in the data
  model as `console.chat_tab_grace_instructions`.
- `DesignSeatShell.tsx` — for the Chat tab only, it deletes the surface chat's `instructions`
  (the Console's) and sets the Chat tab's words from the data model.

There is no fallback to the Console's words. A Chat seat with no words refuses the turn and says
so, instead of speaking as another seat.

---

## 5. The one database

The Chat console uses the same database as Tools: `DATABASE_URL`, with `prompt_sessions` for the
tab's package row, `conversations` for the tab's chats (`session_id` = the package), and
`conversation_messages` for the turns.

The separate design store was examined during the session: `DESIGN_DATABASE_URL`,
`backend/design_db/`, `backend/routes/raibach_design.py`, and the `design_tab` branch in
`backend/routes/teacher.py`. It is a second database with `design_conversations` and
`design_messages`. The Chat console does not use it. No rows were deleted from it, and the
untracked files were left in place. The one-database rule is the rule.

---

## 6. The default open, the timestamp and the empty conversations

- The timestamp is `conversations.updated_at`. It is set at creation and updated on every turn.
- The package list is read `ORDER BY updated_at DESC`. The first row is the last modified
  conversation; a conversation with no further turns is the last created one.
- The seat opens the first live row. It creates a conversation only when there are zero.
- The Tools rule for an empty conversation was restored: when the seat's list holds one
  conversation and it is empty, Grace is asked to speak in it. The Chat package currently holds
  more than one empty conversation from earlier attempts, so that rule holds back until only one
  remains. The empty rows are real data; the thread is empty because those rows contain no turns.

The observed database state during the session:

- The Console package (`323d1990`) had one conversation, "Design — Console", with zero messages.
- The Chat package (`cc952185`) had conversations with zero messages.
- The Tools package (`7600fbc7`) had conversations with zero messages in the newest rows.

---

## 7. The readout and the grippers

### The readout's display

- The readout is the fixed two-line box: `height: 55px`, `min-height: 55px`, `overflow: hidden`.
- The line is cut to two lines with an ellipsis.
- The five-dot gripper is drawn under the readout and is visible.
- A click on the readout box opens it to the full readout height; a second click closes it.
- A drag on the five-dot gripper resizes the box; the drag's inline height lifts the two-line cut,
  so the rest of the readout is revealed.

The display changes I made that were wrong, and were reverted:

- the readout was expanded to its full height automatically, with no two-line cut;
- the readout was made a click target in place of the grip;
- the five-dot gripper was removed while the box was resized;
- the readout was changed in ways no one asked for. Those changes were undone.

### The dead gripper

The gripper was dead for one concrete reason. `DesignChat.firstUpdated` wires the frame's grips
(`this._wireGrips()`). `ConsoleChat` overrode `firstUpdated` and called only
`loadDefaultConversation()`, without calling the parent. So the Chat seat never ran the grip
wiring: every band was drawn and nothing was attached to it. The Tools seat called the wiring in
its own first draw, so its bands worked.

The fix is in `console-chat.ts`: the Chat seat's first draw calls `super.firstUpdated()` before it
opens the default conversation. The frame's `wireGrips` then attaches the drag to every band in the
right column: the readout, the conversation card, the input divider and the footer.

### The conversation card's click

The conversation card's click is the frame's own: `wireGrips` attaches the bar-row click to
`_toggleConversations` for the `data-slot="conversations"` host. The page template also has the
card's `@click=${this._toggleConversations}`. The Chat seat's click was missing because the same
parent first draw was skipped; the `super.firstUpdated()` fix restores the frame's wiring.

---

## 8. The usage readout

The readout is the seat's own conversation, not the session and not the user.

- `backend/routes/misc.py` reads the per-call ledger in `usage_metrics` and returns the figures
  for one `conversation_id`: calls, tokens, cost, the pricing basis, the per-million rates, the
  last call and the per-model split.
- Langfuse v4 in this deployment runs in `events_only` mode and no longer serves its sessions
  endpoint (measured 404). The ledger is the source that still answers; it holds the numbers the
  calls reported.
- The page reads the summary when it opens a conversation and after a send. It passes the
  conversation id and the user id.
- If no call is attributed to the conversation, the readout says "unattributed." It does not show
  user totals or session totals.
- The page sends `X-Package-Session` and `X-Conversation-ID` on `/api/teacher/query`, so the
  ledger can attribute the call to the seat.

The workarounds I added and removed:

- a 2.5-second delay before the readout read on the first load;
- a 1.2-second delay after a send;
- a user-totals fallback when the seat had no attributed calls.

All three were workarounds, not facts, and all three were removed.

---

## 9. Why it failed, in order

1. **The wrong seat.** The Chat tab used the Console's chat component, its session, its list and
   its words. It was never its own seat.
2. **The wrong list.** The Console package's list was the Console route's rotating list. The Chat
   tab adopted a conversation that was not its own; the ownership check refused it. The
   Design-wide list made it worse by including the Tools/Figma chat.
3. **The wrong words.** The Chat seat received `DESIGN_CONSOLE_GRACE_INSTRUCTIONS`, so the model
   answered as the Console. A reply that was only a surface command left no prose to draw. The
   send method itself was identical to Tools; the words were not.
4. **The empty data.** The conversations that were opened held zero messages. The tab was loading
   a real, empty row. The thread was blank because the row was empty, not because the read failed.
5. **The missing grip wiring.** The Chat subclass's first draw skipped the parent's first draw,
   which is the frame's grip wiring. The bands were drawn but dead.
6. **The display changes I made without instruction.** The readout was expanded, the grip was
   removed, and the box was resized. These were reverted; the readout is again the fixed two-line
   box with the visible five-dot gripper.
7. **The workarounds.** Timeouts and a user-totals fallback were added instead of stating the real
   facts. They were removed.

---

## 10. The rules this session established

- The Tools tab is the reference. A seat's behavior is compared to it line by line before any
  change is proposed.
- The package is the divider. No seat reads another package's conversation list, and no seat
  borrows another tab's conversation.
- A seat has its own words. It never falls back to another seat's instructions.
- One database: `DATABASE_URL`; `prompt_sessions` for the package, `conversations` for the chats,
  `conversation_messages` for the turns. The separate design store is not used.
- The default open is the last modified conversation, ordered by `updated_at`; create only when
  there are zero; a sole empty conversation receives the first turn.
- The timestamp is `updated_at`, updated on every turn.
- No fake workarounds: no delay in front of a read, no fallback list, no substitute totals, no
  silent catch. A failure is said with its reason.
- Do not overwrite the owner's files from git, from a pushed branch, or from a backup. GitHub is
  not a backup here. The one time this session did that, it destroyed the working copy of
  `output-header.ts`; the file was rewritten by hand from the observed requirements.
- Do not redesign. The display, the sizes and the controls are the owner's instructions; a request
  to fix a grip is a request to fix a grip, not to change the box.
- The right-column chat is a Lit host element mounted by the room, not a component emitted inside
  the A2UI surface. The surface's chat entry is removed by `takeChat`. The A2UI rules in
  `AGENTS-instructions/Core-Concept.md` call for a SURFACE SEAT (a surface descendant with a
  non-null conversation id and session id, aggregating only its own conversation). That
  architecture is not implemented for this seat; the current seat is a host seat. This is stated
  so it is not mistaken for the surface architecture.

---

## 11. Replication checklist for the Composer chat and the other tabs

**The specification is now one file: `FOUNDATION.md`**, in this folder. It states the AI-native
surface model, the boundary and tab rules, the card states and category, the seat and conversation
contracts, the shared interface, the code to use, the measured faults with their guards, the build
order and the acceptance tests. It is written for the AI that implements the pattern, and it is the
single source for Design and for every section that follows it. The list below is the earlier,
shorter form of the same work and is kept as the record of what this session believed; the
foundation document is the specification.

1. **Give the tab its own seat file and its own conversation file.** Do not share a conversation
   file across tabs. The Tools pair is the shape: `tools-chat.ts` + `tools/conversation.ts`.
2. **Give it its own package row.** The tab's package is its divider. Read the package's
   conversations with `listForPackage` (or the design tab's equivalent); never read another
   package's list.
3. **Give it its own words in the assembly.** Add the tab's script to the route's data model and
   hand it to the seat. Delete the surface chat's instructions for that tab; no fallback.
4. **Mount it by its own file.** Import the seat file in the room's shell, create that element for
   the tab, and let the seat resolve its package from `designPackages`. Do not hand it a session,
   a conversation id, or a conversation list from the shell.
5. **Open the default on the real events.** On the tab press, call the seat's
   `loadDefaultConversation`, exactly as Tools does. The seat opens the first row of its own
   package, creates only at zero, and greets inside a sole empty conversation.
6. **If the seat is a subclass, call the parent's first draw.** `super.firstUpdated()` is what wires
   the frame's grips and the shared parts. Overriding it without the parent was the dead-grip
   defect.
7. **Send through the same path as Tools.** `/api/teacher/query` with the seat's session,
   conversation, words and `person_turn`; record the turn through the existing routes; keep the
   `X-Package-Session` and `X-Conversation-ID` headers for the ledger.
8. **Keep the readout its own conversation's.** It is either attributed to the conversation or
   "unattributed." No user totals, no session totals, no delay.
9. **Keep the display as instructed.** The readout is the fixed two-line box with the five-dot
   gripper; a click on the box and a drag on the gripper both reveal the full readout. The
   conversation card's click and the frame's grips are wired by the same `wireGrips`.
10. **Verify by the round trip, not by the DOM:** type a turn, press Send, the POST succeeds, the
    turn appears in the thread, the conversation's list shows it, and a reload opens it. Then test
    the default open and the grips.

---

## 12. Current state and open facts

- The Chat console seat is its own file (`console-chat.ts`) with its own conversation file
  (`console-conversation.ts`), its own package (`cc952185`), its own words, and the shell no
  longer hands it another seat's address or list.
- The Tools seat is unchanged except for the composer clear fix.
- All non-Tools Design seats read their own package's list and take the newest row; the Approve
  seat has no conversation.
- The Chat package and the Tools package contain conversations with zero messages. The Chat's
  empty rows are from earlier attempts. The empty thread is real data. The user can remove the
  extra rows; the sole-empty greeting rule then applies.
- The readout is the fixed two-line box with the five-dot gripper; the click and the drag both
  open it. The conversation card's click is the frame's `_toggleConversations`.
- The usage readout is conversation-scoped, with no user totals and no delays.
- The separate design database is unused and undeleted.
- The chat is still a host element, not an A2UI surface seat. The architecture described in
  `AGENTS-instructions/Core-Concept.md` calls for a surface seat; implementing that is a separate
  structural change and has not been done.
- The last type check and linter run after the Tools clear fix and the readout/grip edits passed.
  The owner tests the screen.

## 13. Files changed or added in this session

- `frontend/src/rooms/design/DesignSeatShell.tsx`
- `frontend/src/rooms/design/chat/design-chat.ts`
- `frontend/src/rooms/design/chat/conversation.ts`
- `frontend/src/rooms/design/chat/console-chat.ts` (added)
- `frontend/src/rooms/design/chat/console-conversation.ts` (added)
- `frontend/src/rooms/design/chat/parts/design-prompt-textarea.ts`
- `frontend/src/rooms/design/tools/tools-chat.ts` (the composer clear fix only)
- `frontend/src/components/lit/output-header.ts`
- `backend/routes/misc.py`
- `backend/routes/design_console.py`

---

## 14. Where the specification lives

The foundation, the boundary model, the tab rules, the card states and category, the seat and
conversation contracts, the shared interface, the code to use, the measured faults and their guards,
the build order and the acceptance tests are in `FOUNDATION.md`, in this folder. It is the single
source for the Design section and the template for every section that follows it. This record is the
history of one session; the document is the specification.
