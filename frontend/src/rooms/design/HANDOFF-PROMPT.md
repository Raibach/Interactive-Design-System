# HANDOFF — the card lifecycle and the supervisor queue

**Audience: the AI continuing this build.** Read `frontend/src/rooms/design/FOUNDATION.md` first.
Read `CHANGELOG.md` for the record and this prompt for the state you are starting from. The
original `APPROVAL-QUEUE-PROMPT.md` and `CONTINUE-PLAN-PROMPT.md` are history. Their separate
pending-entry record, separate log conversation and five-read loop are superseded and are not to
be built. Where this prompt and the foundation differ, the foundation wins.

Work in small steps. Do not rip out working code. Do not report a step as done from its look.
Leave the workspace local unless the person asks for a commit.

## 1. What the person can do now

- The Design console draws the live Tools row as **Open**, every saved card as its own record, and
  a card in `Pending_Approval` or `Queued_For_Share` as a **locked** card with its state and its
  lock. A queued card is not removed from the room that made it; the lock, not the list, is what
  stops it being changed.
- `GET /api/design/queue` returns the queued cards, permission-scoped through
  `session_permissions`, with `state`, `locked`, `routing`, `reviewer`, `owner_id`, `permission`
  and `queue` on each card.
- Opening a queued card in Tools draws a read-only ledger: the state, the card, the reviewer and
  the reason. The ingest form, the preview, the middle column and the Save and Create-new footer
  are absent.
- The Tools page refuses an ingest, a save or a discard on a queued card with the state's own
  refusal; the leave question is not asked because neither answer could run. The server refuses
  the same acts with 423; a second queue submission is 409.
- A save keeps the card **Closed and editable**; it does not put the card into the Supervisor
  Queue. The queue is paused for the current design testing. When the approval work resumes,
  `POST /api/design/sessions/{id}/queue` is the explicit act that sends a card to the supervisor.
- `POST /api/design/sessions/{id}/queue` moves a closed card to approval
  (`review_stage=in-review`) or sharing (`share_stage=queued`) and writes the routing mask. The
  row, its conversation and its activity are not purged.
- A design that states `arcData`, `componentProperties` or `maxWidth` is still ingested. The
  component is drawn from the measured facts, the preview is shown, and the failure is said once,
  in the chat: what is drawn, which keys are unexamined, the exact `INGEST_VALIDATION_FAILURE`
  profile, and the next action (add an examination for each named key, or declare it
  configuration). The activity row keeps the same profile. The left form and the preview do not
  repeat the failure; the preview shows the drawing, and its own report holds the file
  observations and the write set. The three keys are unexamined, so the drawing is misshapen where
  they apply; the report names them. The check must not become a wall again.

## 2. The records and the evidence

- `prompt_sessions` rows with `metadata.session_type = design_tab` and `design_tab = tools`: the
  live working row, state Open.
- `prompt_sessions` rows with `metadata.session_type = design_session`: the cards. A row with
  `review_stage=in-review` is `Pending_Approval`; one with `share_stage=queued` is
  `Queued_For_Share`; one with `review_stage=approved` is Closed and its footer reads Approved;
  any other is Closed.
- `metadata.routing` is the destination mask: `destination`, `approval`, `share`, `queued_at`,
  `queued_by`. The stage, not the mask, decides whether the card is still queued.
- `conversations` and `conversation_messages` are the card's log. The queue and close lines are
  assistant turns with `source: host` and `session_state`.
- `figma_ingest_activity` is the ingest record, scoped to the session's own row.
- The four blank "Design — Tools" rows were removed with their conversations: `ae788ef1` and
  `693914ba` (closed visits holding only a greeting and a close line) and `4b8ad59a` and
  `c6406e1b` (untyped duplicate rows with no messages). The live Tools row `4f72809b` is kept.
  The three saved cards are `deb5a8eb` ("right-column-panel-container"), `79ce2e2d` ("Figma
  Wireframes for AI Prompt Platform") and `57a1503d` ("Figma Wireframe Design Reference Prompt").
  They were released from the Supervisor Queue on 2026-11-08 for the current design testing: each
  is **Closed** and unlocked, each conversation carries the release line, and the queue returns
  zero cards. The design console returned the two design systems, the three saved cards as Closed,
  and `4f72809b` as Open. The global console returned the three saved cards and no blank
  "Design — Tools" card.
- The duplicate rows came from a losing tab creator: it created a session and conversation, then
  the one-per-tab index refused its kind and it read the winner while leaving its own untyped row
  behind. `get_or_create_design_tab` now removes the losing row and its empty conversation; a
  race test confirmed the session, conversation and permission rows were removed.
- The old validation refusal is the activity row at `09:30:48` for session `deb5a8eb`, job
  `d25b7109`, node `40001066:3272`. The non-blocking run of the same node returned a
  446,869-character preview module, a `validationFailure` naming the three keys, and three
  blocking rows; the component is drawn and the profile is the report. The run of node
  `40001085:1419` at `10:01` returned a 168,204-character preview and the same three keys; its
  activity row names session `4f72809b`, job `fe97c4f0`.

## 3. The next work, in order

### Step 1 — Accept the lifecycle in the browser

The person is testing this now. Open the Design console and confirm the live row as Open and the
three saved cards as Closed and unlocked; open `right-column-panel-container` in Tools and confirm
the preview returns without the ledger. The approval queue is paused: `GET /api/design/queue`
returns zero cards, and the lock is not in the way of the ingest testing. When the approval work
resumes, send a card with `POST /api/design/sessions/{id}/queue` and confirm the ledger and the
refusals then. If any of those is wrong, report the exact screen and the server's answer.

### Step 2 — The supervisor surface

The Approvals tab must draw the queue, not the repair list. Build it from `GET /api/design/queue`:

- the cards in the queue order, with the state, the card name, the owner, the reviewer and the
  queue;
- selecting a card binds the chat to that card's own conversation, which is its log, not a new
  conversation;
- the chat states what the ingest did from the log and asks for approval or changes;
- on approve, call `POST /api/design/sessions/{id}/review` with `action: "approve"` and run the
  existing `POST /api/figma/commit` for the component; the card becomes Closed and Approved and
  leaves the queue;
- on changes, call the review endpoint with `action: "changes"`; the card becomes Closed and
  Changes Requested and returns to the designer;
- do not add a second commit writer and do not write the catalogue from the chat.

The review endpoint records the gate; it does not write the catalogue. The commit is the only
catalogue writer. The queue cards use the design system's own category; the plan's separate
Approvals category is not built. Decide with the person whether it is needed.

### Step 3 — The sharing queue disposition

`share_stage=queued` is installed and the queue read includes `queue: "share"`. There is no
decision endpoint and no sharing surface. Ask the person what sharing means before building it:
a handoff to another person, a publication, or a permission change. The queue row is not purged.

### Step 4 — The debt, only when the person asks

- The duplicate "Card saved. This session is in review." line: the save runs twice in some paths.
  Find the two callers before changing the save.
- The live working row's default title "Design — Tools": the title is the tab's name, not the
  work. A closed blank visit keeps the same title. The state now says Closed; do not remove the
  row.
- The running log has two writers with `persisted` and `tab`; the three chat copies
  (`chat/design-chat.ts`, `tools/tools-chat.ts`, `chat/chat-tab.ts`) remain. One writer and one
  implementation, after the queue behavior is accepted.
- The advanced filter over the console cards on the Chat tab is not built.
- The ingest facts — mirrored-frame normalization, partial arc, truncated line — and the passing
  round trip are not done. The saved run's restore is built and not proven by a passing run.
- The remaining `except` catches that print and continue: state them with the exact failure; do
  not add a fallback.

### Step 5 — The ingest's gate

The validation check is armed as a report, and it must not become a wall again. Do not fix, mock
or default `arcData`, `componentProperties` or `maxWidth`; do not add a five-read loop; do not
soften the profile into a sentence. The component is drawn from the measured facts, the preview is
shown, and the exact profile travels in the result, the left `<pre>`, the chat and the activity
row. The three keys remain unexamined, so the drawing is misshapen where they apply, and the
report says which keys. The size gate is 200,000 characters of renderable design, about 50,000
tokens; a design over the limits is refused with `TOO LARGE TO INGEST` before any work. The heavy
node passed the size gate; its report is the validation profile, not size. If the person asks to
change the size limit to 150,000 tokens, do it deliberately and report the new limit; do not
change it silently.

## 4. What must not change

1. Never purge a session, a conversation or an activity row. A queue is a routing fact; a close is
   a state; nothing is deleted.
2. One card builder (`design_card`), one card shape, one state machine. The design console omits
   locked cards; the supervisor queue returns them.
3. A queued card is read-only to its owner: no save, ingest, close, delete or edit. The server
   refuses with 423 or 409; the UI draws the ledger.
4. The card is the `design_session` row; its conversation is the log. Do not add a separate
   pending-entry table or a separate log conversation.
5. The review endpoint is the state writer; the commit is the catalogue writer. No second commit
   writer.
6. The validation check stays armed as a report; it must not become a wall. The parser keys are
   not fixed; no five-read loop; no soft verdict; no invented "failed" state. The component is
   drawn and the misshapen facts are named.
7. Errors are verbatim, `alert: true`, and durable. No sanitized catch, no invented cause, no
   rewrite of the server's words.
8. Keep the one-page-per-visit lifecycle, the server-authored card, the leave question, the saved
   preview and the tab-bound chats. The catalog audit is manual.
9. Do not cache. Every read is the server's current answer.
10. Leave the workspace local; commit only when the person asks.

## 5. What to report

For each completed step: the files changed, the code path, the rows written (table and ids), and
the acceptance test that passed. For a blocked step: the exact fact, its evidence, and the
decision needed. Do not claim the supervisor walk, the sharing disposition or the passing round
trip until they are run.

## 6. The commands

The server is at `http://localhost:8000`; the frontend is at `http://localhost:5001`; the signed-in
person's id is read from the browser or the database. The reads that established the current
state:

```
curl -s -H "X-User-ID: <person>" http://localhost:8000/api/design/queue
curl -s -X POST -H "Content-Type: application/json" -H "X-User-ID: <person>" -d '{}' http://localhost:8000/api/design/console
curl -s -H "X-User-ID: <person>" http://localhost:8000/api/design/cards/<card>
curl -s -X POST -H "X-User-ID: <person>" http://localhost:8000/api/design/sessions/<card>/close
curl -s -X POST -H "Content-Type: application/json" -H "X-User-ID: <person>" -d '{"destination":"approval"}' http://localhost:8000/api/design/sessions/<card>/queue
curl -s -X POST -H "Content-Type: application/json" -H "X-User-ID: <person>" -d '{"jobId":"<id>","fileKey":"<key>","nodeId":"<id>","sessionId":"<card>"}' http://localhost:8000/api/figma/ingest
curl -s -X POST -H "Content-Type: application/json" -H "X-User-ID: <person>" -d '{"session_id":"<card>","title":"lock test"}' http://localhost:8000/api/ai/save-surface
```

The expected answers on a locked card: 423 for the close, 409 for a second queue submission, 423
for the ingest and 423 for the save. The queue read returns the card with `locked: true`; the
design console does not return it.
