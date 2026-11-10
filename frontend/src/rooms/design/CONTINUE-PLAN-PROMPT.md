# CONTINUE THE DESIGN PLAN — Prompt

> **Superseded for the current state by `HANDOFF-PROMPT.md`.** Read that first. The separate
> pending-entry record, the separate log conversation and the five-read loop described below are
> not to be built; the `design_session` row is the entry, its conversation is the log, and the
> validation block is the terminal check.

**Audience: the AI continuing this build.** Read `frontend/src/rooms/design/FOUNDATION.md` first. It is the source of truth for the architecture, the boundaries, the card and seat contracts, the shared interface, and the invariants. Read `frontend/src/rooms/design/CHANGELOG.md` for what was last recorded, `APPROVAL-QUEUE-PROMPT.md` for the approval queue's plan, and `PREVIEW-FIX-PROMPT.md` for the ingest's plan. This prompt records the state you are starting from and the steps that remain. Where this prompt and the foundation differ, the foundation wins.

Work in small steps. Do not rip out working code. Do not quote anyone in documents. Do not report a step as done from its look; verify it.

## 1. The state you are starting from

**The designer's experience that works.** The designer presses a tab inside Design and receives a new page and a new session. The previous page is disposed when another tab is pressed; its drawing, chat, draft and filter do not stand under the next page. The Tools page is keyed by the visit, so a card press while Tools already stands also starts a new page. While the Tools session is read, the left column shows its own ring and the middle is empty; the console's card grid is not used as a stand-in. The Tools chat binds only to the session the Tools answer states, never to the console's package map.

The designer presses a card, and the Tools page opens the card's own session: its name, its Figma address, its conversation and its saved run. The page does not draw the previous session while the card is read. A card id that is not this person's saved session is refused with its reason, and the working row is not used instead.

The designer leaves Tools. With no change, the visit ends without a question. With a change, a draft, or a recorded failure, the question offers Save and Discard. Save makes or updates the card; Discard removes the working visit; a card the visit opened is kept by its record. If the question cannot be drawn, nothing is deleted, and the room says so. The answer that kept the visit for the next press is gone.

The designer runs an ingest. A failure is written into the session's conversation as the server's own error, verbatim, with its alert state, and it is written to the activity record against the session's own row. A pass is written with the server's verdict and the exactness count. The failure line is stored with `alert: true`, and the history readers carry that flag, so the card's chat draws it as an error after a reload; verify that in the browser. The message names the facts one per line.

The designer saves a session. The server stores the run with the session: the compiled drawing, the facts, the values, the steps and the measured tree. A saved card that was made from a passing run is built to apply that preview on reopen, so the third column and the drawing return; a passing save has not yet been run. A card saved from a failed run has no preview and its chat carries the failure; the status remains the pipeline's state, and no invented "failed" status is written.

**The data that exists.**
- `prompt_sessions` holds one working `design_tab` row per person per tab and the `design_session` cards. A Save relabels the working row; the next press resolves a new one. The saved run is in `metadata.preview`.
- `conversations` and `conversation_messages` hold the tab threads. A host failure is stored with `metadata.alert` true; the readers carry that flag.
- `figma_ingest_activity` holds the terminal ingest outcomes. The session id is the working row or the card, not the room container.
- `figma_facts.remember` keeps the current measurement in the process. The preview is not a durable file.
- `frontend/catalog-audit/prompt-composer.json` is the last manual catalogue audit. It is not run by an approval or a removal.

**The record at the time of this prompt.** The failed ingest of node `40001066:3272` was saved as card `57a1503d`, titled "Figma Wireframe Design Reference Prompt", kept at `2026-11-08T07:53:05`, in review, with conversation `93c25c3e`. Its chat holds the five-read 422 naming `arcData` and the stroke fact; the stroke value was cut at `rgba(78,` by the gate's parser, which is now fixed. Its activity row is job `eff8bdb0`, node `40001066:3272`, two facts, at `07:43:07`. The old cards were removed. The next Tools visit is `79ce2e2d`, conversation `0f2ab174`, one message: Save and the next press are each a new session. The repository catalogue audit, run manually, says 75 components, 40 findings, 1 blocking — a README count, not a design fault.

**The working code that stays.**
- The one-page-per-visit lifecycle: the page keyed by the Tools visit, the previous page disposed, the content cleared on entry and leave, the Tools chat bound to the stated session, the visit-local facts reset when the server names a different session.
- The server-authored card: `design_card` in `backend/routes/design_console.py` and `GET /api/design/cards/{session_id}`. The save places the server's card; the browser invents no state or colour.
- The refused card: a 404 for a row that is not a saved Design session, a 503 for a read failure, and no fallthrough to the working row.
- The leave question: Save and Discard, no Accept; `unanswered` keeps the record; a failure counts as work; a saved card asks only for a field or a draft made since it was opened.
- The saved run: the save sends the preview, the server stores it in `metadata.preview`, the assembly returns it, and the Tools page applies it through the same preview setter a live run uses. A save with no preview keeps the stored one; a sent null clears it.
- The error record: the server's raw error is the conversation line; `alert: true` is stored and read; the terminal outcomes are written to the file and `figma_ingest_activity` once per job; the 422 lists one fact per line; the pass line uses the server's verdict and the exactness count.
- The typed-module compile refusal, the stroke geometry for stroke-only vectors, the INSIDE/CENTER/OUTSIDE alignment drawings, the image fill carried as a data URI, the rows keyed by node id, and the text escaping.
- The repository catalogue audit as a manual check only.
- The approval queue is still not built. The card's state stops at `in-review`; the commit does not write `Approved`; no pending entry, no log conversation, no selection walk and no commit from the chat exist.

**The gaps.**
- The approval queue: the pending entry, its own record, its log conversation, the Approve boundary, the selection and the walk, and the commit from the approval.
- The gate: the visual facts that are skipped, the carried facts counted as drawn, the image-render cause that is only printed, and the design's own catalogue comparison at approval. The repository audit is now manual, so it cannot be the approval's catalogue check.
- The duplication: two writers for the running log with `persisted` and `tab`, and three near-copies of the chat.
- The ingest facts: the mirrored-frame normalization, the partial arc, the truncated line.
- The advanced filter over the console cards on the Chat tab.
- The round trip, including a passing saved run that reopens with its preview.
- The seats are still host elements. The page lifecycle is now correct, but the FOUNDATION's surface-descendant seat is not implemented. Do not claim it.

## 2. The plan

### Step 0 — Read and confirm

Read the foundation, the changelog and this prompt. Confirm the current state in the code and the database before changing anything: the one-page-per-visit lifecycle in `DesignSeatShell.tsx`, the visit key in `DesignRoom.tsx`, the server card in `design_console.py`, the refused-card branch in `routes/ai.py`, the leave question in `DesignSeatShell.tsx` and `DesignRoom.tsx`, the saved preview in `routes/ai.py` and `ToolsSeat.tsx`, and the failure and activity records in `routes/figma.py` and `figma_fidelity.py`.

Evidence to collect: the `prompt_sessions` rows for the design tabs and the cards, the conversations and their message counts, the latest `figma_ingest_activity` rows, and the manual catalogue audit's report. Do not remove the working ingest approve. Change nothing in this step.

### Step 1 — The card's state and the review writer

The card is the `design_session` row. Its states are data: `Pending approval` and `Approved`. The footer's word beside the version is the state, and the `Approvals` category is a real category with its own label and colour.

Connect the acceptance of the preview to `Pending approval` through the review writer, and connect the approval's commit to `Approved` on the same row. The commit remains the catalogue writer; the review endpoint remains the state writer; the approval action calls both, or the commit records the state in the same transaction. No component knows a state's name.

A card saved from a failed run keeps the failure in its conversation and has no preview. Do not invent a "failed" card state; the failure is a conversation fact, and the status remains the pipeline's state.

Verify: save a session and the card carries `Pending approval` in its colour and the `Approvals` label; approve and the component is written and the card reads `Approved`; the row, the activity and the review events agree; the lists are newest first.

### Step 2 — The pending entry and its log

An ingest produces a pending entry without a catalogue write and without a replacement. The entry is its own record, never the Tools visit. Its log is a conversation with its own conversation id; the ingest's events and the approval's events are that conversation's turns. The events come from `figma_ingest_activity` for the job and the session and from the registration trail. Do not invent a parallel log table for the chat to read around.

The activity table is the audit, not the reading surface. The failure and pass lines the Tools seat writes into the session's conversation are the session's own record; the approval's log is the entry's own conversation, and the two must not be confused.

Decide with evidence how the preview survives until the entry is accepted: the saved preview is already carried on the session's record, so the entry can adopt it or refuse it, and the consequence must be stated.

Verify: one entry from a real ingest; the entry holds its source, its state and its draft; the catalogue is unchanged; the log conversation returns the turns in order.

### Step 3 — The Approve boundary

The Approve boundary carries the filter for the entries whose state is `Pending approval`, the cards with their state, label and colour, the approval chat bound to the selected entry's log, the words of the approval chat, and the active entry. The boundary loads when Approve is pressed. It is disposed when the person leaves it, and the next press loads it again; it is not held behind another tab.

The tab-bound rule applies here too: the approval boundary reads its own record and its own package, not the Tools package, not the Chat tab's design console package, and not the global Console.

Verify: pressing Approve shows the pending cards in the left column and the approval chat in the right; the Design console is unchanged; the review list is not drawn in the right column.

### Step 4 — Selection and the walk

Selecting a card binds the approval chat to that card's log conversation and draws the log. In the chat: state what the ingest did from the log; ask yes or no; on yes run the existing commit with the entry's job, tag, replacement and patterns; on success the entry becomes `Approved`, the record is stamped, and the card is first in the lists; then take the next pending entry.

Do not add a second commit writer. Do not write the catalogue from the chat's own code.

Verify: two cards load two different logs; the chat's next turn is written into the selected card's conversation; approving one entry writes the file and the registrations, replaces the existing component, sets the state and the timestamp, puts the card first, and loads the next entry.

### Step 5 — The saved run

The Tools save now sends the whole run: the compiled drawing, the facts, the values, the steps, the measured tree, the annotations, the specs and the patterns. The server stores it in the session's `metadata.preview`. The assembly returns it, and the Tools page applies it through the same setter a live run uses, so the third column, the drawing and the facts return. A save with no preview keeps the stored one; a save that sends null clears it, because the person discarded the drawing.

Verify with a **passing** run: ingest a node that passes, save it, reopen the card, and confirm the third column, the drawing, the facts and the steps are drawn from the record without a new Figma read. Discard the preview, save again, and confirm the stored preview is cleared. The failed card `57a1503d` has no preview and its chat carries the failure; do not claim a drawing for it.

### Step 6 — The ingest facts and the gate

Finish the ingest's facts. The mirrored frame is normalized into the network channel's origin using the frame's flip and the child's relative transform, so a mirrored position is reported as agreeing and the flip is a fact the network channel carries. The partial arc is drawn from the path geometry, or the run fails and names the layer. The truncated line draws the ellipsis, or the run fails and names the layer and its line count. No visual fact is accepted without a drawing.

Restore the gate's full question. `STRUCTURAL_FACTS` in `figma_fidelity.py` currently skips `strokeCap`, `strokeJoin`, `dashPattern` and `maxWidth`, which change the drawing and which the renderer does not draw. Put those back. `componentProperties` and `locked` need a decision on evidence: `locked` is not a pixel; `componentProperties` is configuration only if the measured children carry every override. `textAutoResize`, the sizing modes, the constraints, the style references, the bindings, the boolean operation and `componentId` are configuration, and the reason must be written down.

Restore `accepted` for a carried fact unless the drawing names the value. A corner radius drawn in the path and a rotation composed into the transform are drawn; a carried value that the drawing does not name is accepted, not drawn. Do not let a global reclassification raise the exactness count.

Carry the image-render error into the gap's reason. `_rendered_image_fill` catches the Figma render failure and only prints it; the gate then reports "a paint not drawn" without the cause. The cause is what tells the designer where the ingest broke.

The approval's catalogue comparison is the design's own: the commit's registration and replacement decisions. The repository-wide audit (`npm run catalog:check`) is a manual development check and stays out of `api_figma_commit` and `_remove_component`. The approval answers for the component it registered, not for the catalogue's paperwork.

The pass line uses the server's verdict and the exactness count. It never says "every stated fact" when the gate has skipped facts.

Do not re-run the five-read loop to obtain a pass. Restore the gate's question first. The five-read rule stays: a failed proof discards the attempt and re-reads, at most five times; the fifth failure is one refusal that names every fact that never matched; no preview is stored; the refusal is written verbatim into the conversation and the activity record.

Verify: a mirrored design reports agreement; a partial arc and a truncated line either draw or refuse with their names; the five-read refusal names the facts one per line; the gate names the stroke caps, joins and dash patterns when they are stated and not drawn; the activity row and the conversation line are the same text; a pass carries the server's verdict and the exactness count.

### Step 7 — The advanced filter over the console cards

The Chat tab is the design console chat and the advanced filter over the console cards. The design console cards will reach the hundreds, and the chat is how they are managed. The Chat tab is bound to the design console package for its conversation and for its conversation list; it does not read the Tools package, the separate chat package, or the global Console.

Build the filter as the tab's own condition: the cards the console holds, read from the design console package, with the chat managing and narrowing them. The filter belongs to the Chat tab, not to a global rule.

Verify: the Chat tab lists the design console cards; the chat can narrow them; the Tools cards are not in the list; the global Console cards are not in the list; a saved card remains a card after the filter changes.

### Step 8 — The round trip

Prove the whole path: a Figma ingest produces a preview; the preview is accepted and becomes a pending card; the card is reopened and its draft is read; the approval chat states the log and asks; the approval commits and the card becomes `Approved`; the component is in the catalogue; the card is first in the lists; the next pending entry follows.

Run the acceptance tests in the foundation and the four queue states: pending, approved, selection, and next. Show the rows written and the file written. Do not report a step done from its look.

### Step 9 — The duplication

Give the running log one writer. The Tools seat knows the session's conversation and is the natural writer; the chat should draw the line without writing it, or the chat should be the only writer and the seat must not write before the chat is bound. Remove `persisted` and `tab`; a page created with its own conversation cannot deliver a line to another tab. The server that performed the work is the other correct writer for the ingest's lines, and the seat then draws what the server stored. Do not keep two writers with flags.

Collapse the three chat copies. `chat/design-chat.ts`, `tools/tools-chat.ts` and `chat/chat-tab.ts` are the same page three times, about sixteen thousand lines together. Keep one implementation with the shared parts, and make each tab a thin file that supplies its tab name, its conversation file, its words and its view. Do this after the page behavior above is confirmed; do not rewrite the page in the same pass. The 2026-11-02 replacement failed because it rewrote the page, not because a thin file was wrong.

## 3. What must not change

1. Move, do not rewrite. The working ingest approve stays in place. Add the queue beside it, verify it, switch, then remove the old path. Never two live paths after the switch.
2. One writer for the catalogue: the existing commit. The queue calls it; the queue does not write the files or the rows.
3. The log is a conversation. One conversation per entry, with its own id.
4. States and colours are data. No component knows a state's name.
5. Every list is last modified, then created, newest first. A write stamps the record; a list is re-read after a write.
6. No global rules. The approval's conditions belong to the approval boundary; the Chat tab's filter belongs to the Chat tab.
7. No fallbacks, no delays, no silent catches. A failure is said where the person is reading, with its reason.
8. No comment inside an opening tag. No clearing a control by writing its value from outside.
9. Do not quote anyone in documents. State the rule.
10. Do not report a step done from its look. Run the round trip and show the evidence.
11. Preserve the working architecture. Do not delete, disable or rewrite surrounding functional paths to solve a local defect; every pre-existing import, property and handler stays unless the step names it.
12. Keep the tab-bound chats. Each tab reads its own package; the Tools tab starts a new session on the press; the Chat tab is the design console chat; the global Console is not read.
13. Keep the one-page-per-visit lifecycle. The page is keyed by the Tools visit, the previous page is disposed on leave, the content is cleared on entry and leave, and the Tools chat binds only to the session the Tools answer states.
14. Keep the server-authored card. `design_card` is the only builder; the save places the server's card; a refused card id states its reason and does not fall through.
15. Keep the leave question. Save and Discard only; `unanswered` keeps the record; a failure counts as work; a saved card asks only for a field or a draft.
16. Keep the saved run. The save stores the preview in the session's metadata; the assembly returns it; the page applies it; a save with no preview keeps it, and a sent null clears it.
17. Keep the error record. The server's raw error is the conversation line; `alert` is stored and read; the terminal outcomes are written once against the session; the 422 lists one fact per line; the pass line uses the server's verdict.
18. Keep the catalog audit manual. It does not run in the approval, the removal or the ingest.

## 4. Out of scope

The other rooms and the global Console at the top of the site. The PostHog UX work. A second catalogue writer. A second log table. A global filter or a global state rule. Deleting a working path to make a new one fit. The repository catalogue audit in the approval or removal. A kept page behind another tab. A client-invented card. A rewritten error message. A fourth chat copy.

## 5. What to report

For each completed step: the files changed, the code path, the rows written (table and ids), and the acceptance test that passed. For each step blocked: the exact fact that blocks it, with its evidence, and the decision needed.

The frontend changes need a reload; backend changes are live after the server reloads. Leave the workspace local. Do not commit unless the person asks.
