# The repair plan — 2026-11-08

This plan follows the audit recorded at the top of [CHANGELOG.md](CHANGELOG.md). The audit states what the code does at commit `288910a7` on branch `design-room-honest-ingest`. This file states the repair point for point. It is a plan only; no source file was changed for it.

Each point gives the designer's experience today, the exact change, the proof that the change worked, and the skill the change closes. The status words are the audit's own: `ARMED_AND_HONEST` and `SUPPRESSED_COMPLIANCE_BYPASS`.

## P0 — Stop the deletions

### 1. The designer's card delete must keep the record

**Today.** The Design room swallows a failed conversation delete at `DesignSeatShell.tsx:181` and then asks for `?permanent=true` at `:184`. The route passes the flag at `routes/prompt_sessions.py:504`, and `prompt_sessions_api.py:1408` deletes the session row outright.

**Repair.** Remove the conversation-delete loop at `DesignSeatShell.tsx:179-182`. Remove `?permanent=true` at `:184` so the route's default archive path runs the `UPDATE ... is_archived = TRUE` at `prompt_sessions_api.py:1413-1420`. The conversations and their messages stay against the row.

**Proof.** Delete a card in the Design room. The card leaves the grid, the row remains with `is_archived = TRUE`, and its conversations and activity still read.

**Closes.** `deterministic-agentic-compilation` §1, the permanent ledger.

### 2. The losing tab creator must not delete its row

**Today.** `_discard_losing_tab_package` at `prompt_sessions_api.py:769-830` deletes the conversations at 819, the permissions at 823 and the session row at 827. The JSON fallback at 791-795 turns a corrupt row into an empty mask, which makes the delete reachable.

**Repair.** Read `get_or_create_design_tab` and replace the catch-and-delete with one atomic resolve: the insert uses `ON CONFLICT DO NOTHING`, then the read returns the winner, so a losing caller never creates a row. For a loser row already left by an earlier run, write a `superseded_by` mark and exclude it from the console's card read by that mark; do not delete it.

**Proof.** Run the race test. The loser creates no row, the console returns no blank card, and a pre-existing loser row remains marked and is not drawn.

**Closes.** `deterministic-agentic-compilation` §1.

### 3. A corrupt row must be reported, not read as empty or as a live visit

**Today.** `prompt_sessions_api.py:791-795` returns `{}` on a JSON failure. `card_lifecycle.py:39-42` does the same and `card_state_of` returns `None` at 47-48. `design_console.py:63` and `:1069-1074` do the same, and the empty kind produces the 409 sentence "this is a live Tools visit" at `:1076-1078`.

**Repair.** Raise a terminal error naming the row and the parse failure. Where a list read must continue, the row carries an explicit `unreadable` state and the screen draws an error card for it. The 409 sentence is used only when the parsed `session_type` is actually `design_tab`.

**Proof.** Insert a row with invalid metadata. The read names the row unreadable, it is not drawn as a blank card, and it is not called a live Tools visit.

**Closes.** `anti-error-suppression` and `runtime-diagnostics`.

### 4. The console's delete failure must be visible

**Today.** `useConsoleCardActions.ts:112` writes `console.error` only. The card stays and the person is not told.

**Repair.** Dispatch `a2ui:system-message` with the failure. The room already reads that event at `DesignSeatShell.tsx:196` and `ToolsSeat.tsx:330`.

**Proof.** Force a delete failure. The card stays and the reason appears in the thread.

**Closes.** `anti-error-suppression`.

## P1 — Make the refusal reach the named keys

### 5. The three keys must reach the literal 422, or the block must be retired honestly

**Today.** `arcData`, `componentProperties` and `maxWidth` are consumed at `figma.py:3351-3353` and written as spec fields at `:3448-3458`. `key_coverage` reads only `stated`, so the literal block at `:5477-5481` cannot name them. The fidelity gate at `:5767-5776` raises a different 422.

**Repair.** Read `fidelity["rows"]` before the generic gate refusal. If any row's `fact` is one of the three and its verdict is not `drawn` or `accepted`, raise 422 with the literal block naming those keys. The rest of the gate stays as it is.

**Proof.** A design with a partial arc returns 422 with `[ERROR_TYPE]: INGEST_VALIDATION_FAILURE` and `[MISSING_OR_UNPARSED_KEYS]: [arcData]`. A design with a different defect returns the gate's own 422.

The heavy node `40001066:3272` is refused at `5587-5604` for size before this gate. To see the three-key refusal on that node, the owner must raise `FIGMA_INGEST_MAX_SPEC_CHARS` deliberately or split the node. The size refusal is correct and is not a defect.

**Closes.** `deterministic-agentic-compilation` §3.

### 6. The validation profile must not be a field that is always null

**Today.** `_validation_failure` is assigned only `None` at `figma.py:5472`. The only path that would populate it raises at `:5489`. The 200 answer carries `"validationFailure": null` at `:5894`, and the filter at `:6439-6447` is always empty.

**Repair.** Remove the field and the filter. The refusal record already writes `str(exc.detail)` as `error` at `:6466-6471`, which is the literal block. If the owner wants the profile in the activity row for a 200, the gate must not raise; that contradicts the skill, so both cannot stand.

**Proof.** A refusal's activity row contains the literal block, and no 200 answer carries `validationFailure`.

**Closes.** `anti-error-suppression`. A dead field must not pretend to carry a report.

### 7. The contradictory doctrine must be replaced

**Today.** `figma.py:5744-5753` says `REPORTED, NOT BLOCKED`, says `NOTHING stops the ingest`, and calls a refusing gate suppression. The code at `:5766-5776` reads `gate.get("blocks")` and raises 422.

**Repair.** Replace the paragraph with the code's two outcomes: the gate reports known gaps, and it blocks an omission or an unexamined defect. The block raises 422.

**Proof.** The comment and the code read the same.

**Closes.** `anti-error-suppression` in the written record.

## P1 — Put the failure where the skill requires it

### 8. The raw failure must be in the left column's `<pre>`

**Today.** `ToolsSeat.tsx:1165-1174` calls `reportFailure` and clears the preview. The comment at `:1160-1163` says the profile is deliberately not copied to the form's diagnostic zone. The comment at `:1134-1138` says it goes to both the chat and the diagnostic zone, which the code does not do.

**Repair.** Read the assembled left tree, find the field the diagnostic zone above the layer tree binds to, and write `raw` there before the tree is applied. The zone must be the selectable, scrolling `<pre>` the skill names, and the right panel must return to its middle position. The chat line stays as the record.

**Proof.** A 422 shows the raw block in the left `<pre>` above the tree, the panel is at middle, and the same line is in the chat.

**Closes.** `deterministic-agentic-compilation` §2.

### 9. The unreachable "drawing with differences" branch must be resolved

**Today.** `ToolsSeat.tsx:895-979` shows the drawing and asks accept or discard when `blocking` is non-empty. The server raises 422 at `figma.py:5767-5776` whenever `blocks` is true, so a server 200 with blocking findings cannot arrive.

**Repair.** Keep the server's 422 and remove the branch. The refusal path at `1165-1174` is the one that runs. If the owner wants the drawing shown beside the differences, the owner must change the skill and the server together; a client branch must not claim a behavior the server forbids.

**Proof.** A design with a blocking finding returns 422 and never reaches the accept-or-discard prompt.

**Closes.** `deterministic-agentic-compilation` §3.

## P1 — Remove the print-only paths

### 10. Every console failure must reach the person

**Today.** `design_console.py` prints and continues at `:346` for a package read, `:460` for a description write, and `:1255` for a close line. It prints, leaves the list empty and creates a new conversation at `:532-553`. It prints and reuses an unread thread at `:570-577`. It prints and keeps the old thread after a failed create at `:595-596`.

**Repair.** Raise 503 for the reads the console needs: the packages at `:346`, the conversation list at `:538`, and the open thread at `:575`. Do not create a conversation over an unread list and do not reuse an unread thread. For the soft writes at `:460`, `:596` and `:1255`, dispatch `a2ui:system-message` and write the failure to the activity record.

**Proof.** Force a failure at each site. The person sees the reason, and no conversation is created or reused over an unread value.

**Closes.** `anti-error-suppression` and `runtime-diagnostics`.

### 11. A warning must belong to the request that caused it

**Today.** `ai.py:961-975` uses the process-wide `_REQUEST_WARNINGS`, and the comment at `:955-958` admits a warning can land in another handler's response. The save response drains at `:5644`, but the list is shared.

**Repair.** Hold the list in a `contextvars.ContextVar`, set at the start of each request. `_drain_warnings` reads and clears that request's list.

**Proof.** Two concurrent requests each receive their own warning, and neither receives the other's.

**Closes.** `anti-error-suppression`.

## P1 — Close the catalog gate

### 12. The catalog gate must reach zero blocking findings

**Today.** `npm run catalog:check` exits 0 with two `[blocking]` findings. `RoomEmbed` declares a `seat` slot and the element renders no slot by that name. The README claims 74 trusted components and the catalog holds 75.

**Repair.** Add `<slot name="seat">` to the `RoomEmbed` element if the catalog is the contract, or remove the slot from the catalog if it is not. Set the README count to 75.

**Proof.** `npm run catalog:check` prints zero `[blocking]` lines.

**Closes.** `a2ui-catalog-validation`.

## P1 — The working tree

### 13. The eighteen deleted design documents must be restored or retired in writing

**Today.** The working tree deletes 4062 lines from `design/` and adds 0. No replacement of equivalent size exists.

**Repair.** Restore `design/` from HEAD. For any document that is truly superseded, add a one-paragraph note at its head pointing to the new record. If the owner confirms retirement, record the decision per document in the design seat's record; a silent hole is not a decision.

**Proof.** `git status` shows no unexplained deletion, and every retired document has a written decision.

**Closes.** `architecture-preservation`.

## P2 — Correct the written record and the remaining dead claims

### 14. The comments and the changelog must match the code

`figma_fidelity.py:84-88` still says there are two keys the pipeline examines and does not carry, and says their reasons are in `ACCEPTED_UNRENDERED`. The three keys are carried and compared; `styles` is the accepted one. Rewrite the comment.

`figma_fidelity.py:2102` excludes `unexamined` from `closed`. Include `unexamined == 0` in the condition, so the accounting cannot read as complete while the gate blocks.

The 2026-11-08 (handoff) paragraph in `CHANGELOG.md`, headed "The validation check reports; it does not withhold the drawing", says the check no longer raises, says the profile travels in the left `<pre>`, and says the three keys remain unexamined. All three are false. Mark the paragraph superseded by the audit entry and correct the three claims in place.

`design_reviews.py:20-21` is honest that approving records the gate and does not write the catalogue. Read the approval surface and make its word say the same, for example "approved for catalogue", or show the catalogue state beside it.

### 15. The console POST writes rows

`design_console.py:287-412` creates the design container at 305 and the Tools tab row at 409-412 on a POST. This is a fact, not a defect. If the owner wants a read-only console assembly, move the get-or-create to the writes that need it. If the write is intended, the record already states it.

## No action

`a2ui-primitives.ts:579-597` is correct. The tag is whole, line 586 is `?nodelete=${item?.room_domain === 'design'}`, and the type check exits 0. The claimed comment break and the `?? ''` fallback are not in the file.

`figma_fidelity.py:2288` and `:2462-2474` are correct. The walk does not skip `componentProperties` or `maxWidth`, and the exactness denominator includes the unexamined keys.

`design_renderer.py:79-88` and `:111-164` are correct. The three keys are in `RENDERED_KEYS`, and `ACCEPTED_UNRENDERED` contains `styles` without `arcData`.

`figma.py:5587-5604` is a correct refusal. The heavy node is 446,820 characters against a 200,000 limit. The owner decides whether to raise the limit or split the node.

`figma.py:6485-6506` is correct. A refusal keeps its status, its message and its record.

## Sequence

1. Points 1 to 4: stop the deletions and make the failures visible.
2. Points 5 to 7: wire the three keys to the literal refusal and remove the dead profile field.
3. Points 8 and 9: put the failure in the left `<pre>` and remove the unreachable branch.
4. Points 10 and 11: remove the print-only paths and bind warnings to their request.
5. Point 12: close the catalog gate.
6. Point 13: restore or retire the deleted documents.
7. Points 14 and 15: correct the written record.

The first step is point 1. The Design room's card delete must leave the row and its conversations in place.
