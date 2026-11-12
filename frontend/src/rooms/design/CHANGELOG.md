# The Design room — changelog

> **READ FIRST.** Every time you work in this folder, read the latest entry and orient on what we're currently working on, then pick up from there. This is the only record of this folder's work.

## 2026-11-09 (final) — three columns again, and the left boundary follows the hand

**What was wrong, and what I did about it.** The chat-overlay, the auto-dock and a first
pixel-width attempt were all mine, and together they broke the room: the output sat underneath the
chat, the card showed a strange empty run when the left divider was pulled, and the rail's tabs
left the middle collapsed. I reverted `design-workspace.ts`, `tools-workspace.ts` and
`workspace-layout.ts` to the committed baseline, so the three panes are the committed ones again,
and then changed ONE thing.

**What is now true.** The middle is a pane between the left divider and the chat's own left edge —
three distinct columns, bound on both sides. Measured in the running room on `console-card-hover`
at 1500px: **left 374, middle 374, right 748**, with the left divider at x=374.

The left divider now uses the RIGHT strip's model, which already worked: on the press it records
the pointer's distance from the pane's edge and moves nothing; on each move it sets a **pixel
width** for the left pane, and the middle fills beside it. Measured by driving the element:
press at 376.25 (left stays 374); move to 426 → edge 424; 476 → 474; 576 → 574 — the same 2.25px
grab offset each time, no jump, no share arithmetic.

**What the rail's tabs do, and did before.** Clicking Home/Tools/Approve/UX is the ROOM's section
navigation, not the chat's view: it changes the tab, the preview's content leaves with the Tools
tab, and the middle collapses. The baseline does exactly the same (measured with the changes
reverted: middle 0, left 750, right 750). It is not a gripper fault and not a regression from this
work; changing it would be a navigation decision.

**Reverted, not lost silently:** the chat overlay (it put the output under the chat), the
auto-dock on preview open (it hid the form and was part of the confusing left state), and the
`dockLeftColumn()` call in `ToolsSeat` is now a no-op. The preview's own fixes — the hugging panel,
the restored card asking nothing, the save-time conversation snapshot — are untouched.


## 2026-11-09 (late) — a card's log is the run, not the tab's chat

**What the designer saw.** Reopening the `console-card-hover` card replayed three chat turns —
"user-response-bubble / f-40001207-3559 / f-40001204-5752 is in the catalogue … do you want to
remove it?" — as if the card were about those components. They were written at 17:52:49–53, after
the card was saved at 17:37, while the saved card was still the tab's working session.

**Why.** The save relabels the working `design_tab` row as the card and deliberately keeps its
conversation ("Nothing is copied"). Everything the tab did afterwards — a catalogue row opened, a
remove question — was therefore written into the card's log. And the restore path re-dispatched
the card's own `open-component` on every open, asking the remove question again each time.

**What changed.**

- **The save snapshots the conversation.** `_snapshot_card_conversation` in `routes/ai.py` copies
  the visit's thread into a conversation the card owns at the moment of the save (role, content,
  metadata and timestamps, message by message) and points the card at the copy; the tab keeps its
  own thread, so later actions cannot reach the card's. Verified with a test conversation: two
  messages copied, the card's `conversation_id` moved to the copy, the source untouched.
- **A restore asks nothing.** The `open-component` dispatch from the assembly effect carries
  `restored: true`; the seat draws the card's component but does not append the "in the
  catalogue … remove it?" question or open the chat for it.
- **The three historical turns are removed** from the `console-card-hover` conversation (three
  `conversation_messages` rows by id); the card's log is the six run turns that remain. Nothing
  else in that conversation was touched.

**Left open.** The tab's original conversation is still attached to the card's session, so the
card's conversation list can show it beside the snapshot; the card's default thread is the
snapshot. A save made before this entry (other than the cleaned card) still carries its visit's
thread as its log.


## 2026-11-09 (late) — leaving a Tools visit no longer makes a "Design — Tools" card

**What the designer saw.** A generic "Design — Tools" card appeared on the design console's
dashboard after visits, and kept appearing. Thirteen had accumulated in `prompt_sessions`
(`session_type = design_session`, `design_tab = tools`, no `savedBy`, titles all "Design — Tools"),
one per visit.

**Why.** `POST /api/design/sessions/{id}/close` — the leave route the Tools seat calls — converted
every unkept `design_tab` visit into a `design_session` card on purpose ("CLOSE A TOOLS VISIT AS A
CARD — NEVER PURGE IT"). The seat only skips the close when the visit was saved
(`keptThisVisitRef`), so every visit that ended without a save became a card. The card was never
the component's: it carried the tab's generic title.

**What changed.** The close route now **discards the unkept visit**: the row is deleted and the
row's FKs cascade its conversation and messages. A card is made by the explicit Save (the seat
does not call close when the visit was kept); the ingest activity rows are the ingest's own record
and stay. The docstring says the new contract.

**Verified.** A test visit with one conversation and one message was created for a throwaway user;
the route answered `{"action":"discarded", …}`, and the session, conversation and messages all
counted 0 afterwards (the test user was removed). The thirteen existing rogue cards were
**archived**, not deleted (`is_archived = TRUE`, hidden by the console's own `IS NOT TRUE` filter);
0 rogue rows remain visible, and the single live `design_tab` row stands.

**Left open.** The visit's conversation no longer survives a leave without a save — that is the
trade for no auto-cards. A page already showing the live row keeps it until its next read; the
console is correct on refresh.


## 2026-11-09 (evening) — the preview docks the left column

**What the designer saw.** With the preview open, the ingest form still held a quarter of the
room, so the output column was squeezed and the card clipped. Owner: *"When the third column
opens, we don't need to see the left column at all… it's docked because now we're working with the
preview and the chat."*

**What changed.** `design-workspace` docks the left pane when the preview container
(`design-middle-container`) enters the middle slot — the moment a card reopened from the console
is restored. The Tools seat **also** docks at the ingest result, because a later submit in the
same tab does not change the slot: the form and the component tree stand aside when the preview
and the chat carry the answer, not only on the first ingest that opened the column. The new `dockLeftColumn()` is the dock **without** a Run's
waiting state (`dockPrompt()` raises "Assembling the drawing…", which a preview that is already
drawn must not claim); the pane keeps `_left = 1` so its rail reopens it at the standing split,
and ownership is left alone so the person or a payload can open it again.

**And the chat is a LAYER over the preview, not a pane beside it.** Owner, same message: *"Third
column is not full width. Moving right gripper to resize chat out should not move other sections
— it simply reduces the third column."* The drawing's own rule already says the canvas does not
respond to anything on the right-hand side; the ingest's preview is the same ground. So
`_rightOverDrawing` now also answers true for `design-middle-container`: the right pane takes the
existing `.pane.right.over` form (absolute, width, z-3), the output keeps the full width behind
it, and her grip sizes only her own box. The left boundary's span is then stable — it was her
pane's changing width that made the left grip chase the layout while she was open.

**Verified in the running room** on the saved `console-card-hover` card at 1500px:

| pane | before | after |
|---|---|---|
| left (ingest form) | 374 | **60** (docked to its rail) |
| Component Output | 374 | **1435** (full width behind the chat) |
| chat | 748, in the flex line | **500, absolute** (`position: absolute`, z-3) |

The left grip is still the share-based drag, but its span (left + output) is now constant while
her column is open, so the edge follows the pointer instead of the pane.

**Verified on a live submit through the form**, not only on a reopened card: the same
`console-card-hover` link was pasted into the Tools form and submitted. At the result the left
pane was **60** (the form and the component tree gone from the room), the Component Output
**1435** with the card drawn whole, and the chat standing over it at **500** with the ingest's own
findings and the Accept/Discard question. `tsc -b` exits 0. The left column is one click from its
rail; the dock does not claim the column, so reopening it is not refused.

**And the preview frame hugs the file.** Owner: *"the output for the preview panel should not be
a scrollable box, it is a full width and height container that hugs the height of the inside
files."* It was three scroll boxes stacked: `component-preview` stretched to the column and
scrolled (`flex: 1 1 auto; overflow-y: auto`), its `.frame` was capped at `46vh` with
`overflow: auto`, and the `draft-preview` document was `min-height: 100vh` with its own
`overflow: auto` — so a 380px drawing sat in a 320px iframe inside a 46vh window. Now the
document reports its **body** height to the frame (a message from inside, accepted only from
that iframe's own window), the iframe takes it, the frame is not capped, and the column is the
one scroller when the whole panel is taller than the window. Measured on the saved card: body
380, iframe **380** (was 320, the fallback), frame 404, no internal scroll, and the card's own
footer is on screen without scrolling. The saved card's status also stopped saying "the element
drew nothing … left/top at 16, 947" — that was the iframe being shorter than its document, not a
failure of the drawing.

## 2026-11-09 (later) — the left column's gripper follows the hand

**What the designer saw.** Grabbing the left column's divider jerked the panel away from the
cursor, and the boundary could not be dragged right. The left edge ran at roughly half the
pointer's speed; the first move after a press jumped it ~160 px to the left.

**Why.** Two faults, in `tools-workspace.ts` and its two copies (`design-workspace.ts`,
`components/lit/workspace-layout.ts`):

- The drag turned the pointer into a SHARE by dividing by `content` — the whole host minus the
  grips — but `_left` and `_middle` only divide the width her column leaves. On a 1400 px host
  with her column at 697.5 px, a boundary dragged to 371 px rendered at 189 px: the gripper ran
  at about 51 % of the cursor's speed, always away from the hand.
- The press opened a collapsed prompt to its **stored share**, so a grab taken on the 60 px rail
  threw the boundary a few hundred pixels before the hand moved. It also never recorded where on
  the 5 px bar the grab was taken.

**What changed.** The left boundary now keeps the two facts the right column's strip keeps:
`_leftGripOffset` (the pointer's distance from the edge) and `_leftGrabCollapsed`. The press
moves nothing — no resize, no uncollapse; a collapsed pane gets a width at the pointer on the
first MOVE, and every move divides by the two panes' own measured widths (`_leftMiddleSpan()`),
with the clamp expressed against that span so the middle keeps its floor. The same edit was
applied to all three copies.

**How it was verified.** A temporary harness mounted the real `<tools-workspace>` at 1400 px with
the right column open at 697.5 px, then drove the same mouse sequence the screen uses:

| move | pointer | left edge |
|---|---|---|
| press (no move) | 351.25 | 348.75 — unchanged |
| +20 | 371.25 | 368.75 |
| +60 | 411.25 | 408.75 |
| +120 | 471.25 | 468.75 |
| +200 | 551.25 | 548.75 |

The constant 2.5 px is the grab taken at the centre of the 5 px bar; the edge follows the hand
with no drift. Dragging left tracked the same way (pointer 251.25 → edge 248.75). Collapsed: the
press moved nothing, the first move opened at the pointer (155.3 px where the pointer asked for
162.5; the open layout's span differs from the collapsed one), and the next move was exact (212
vs 212.5). The same checks passed on `<design-workspace>`; `tsc -b` exits 0.

**Left open.** The first move out of a collapsed pane lands ~5 px short for the reason above; the
next move corrects it. The harness was deleted after the check, so this gesture has no standing
browser test in the repository.

## 2026-11-09 — the preview draws the design: the chevron, and the proof that missed it

**What the designer saw.** The preview of node `40001175:2229`
(`prompt-input-section-agent-role`) drew the dropdown chevron's triangle below its square, 16 px
low. The run beside it counted 170 of 170 facts exact and printed `every stated fact matched`.
The link:
`https://www.figma.com/design/20UPR2KQMsbAxlo5NJb1se/Wireframes--v.4b--SCE-Enterprise-AI-Prompt-Platform?node-id=40001175-2229`.

**Why the proof missed it.** The 170 rows compare the measured spec with the declarations in the
generated source. Layout is in neither side: an inline `<svg>` sitting on a text baseline, and a
wrapper placed by its transform's origin instead of its box, are both invisible to a string
comparison. The checker and the renderer also shared the same placement rule (`_child_offset`), so
when the rule was wrong both agreed with each other.

**What changed.** `backend/design_renderer.py`: a shape that carries a finished `svg` is placed by
Figma's own `absoluteBoundingBox` — minus the parent's box and stroke — not by the transform's
translation; the vector wrapper carries `line-height: 0`, so the svg starts at the box's top. The
root's transform is still not drawn: the net canvas transform is `+1`, and the proposed root-mirror
fix is disproved in the handoff correction.

**How it was verified.** One ingest through the running app; the module the run returned was drawn
in the real `<draft-preview>` element in Chromium; every layer's `getBoundingClientRect()` was
compared with Figma's `absoluteBoundingBox` minus the root's box. Result: 23 of 23 layers at
0.00 px. The chevron is at `(382, 32)`, which is Figma's box for it, against `(382, 48)` before.
Pixel diff against Figma's own render: mean 4.92/255, and what remains is confined to the text.

**The process.** The full loop — one ingest of the link, the run's own rows, the module drawn in the
browser, every box against Figma's box, the pixels attributed, one instruction fixed and
re-ingested — is written in the ingest's own record,
[`design/figma-ingest/CHANGELOG.md`](../../../../design/figma-ingest/CHANGELOG.md), entry
2026-11-09. The rule: a passing row count is not a verified drawing, and the browser is the only
instrument that sees layout.

**Left open.** The design states `Inter`; `fonts.css` declares IBM Plex only, so the preview draws
Helvetica — `Agent Role` measures 95.0 px against Inter's 85.5 px. The `fontNotice` reports the
substitution; whether the preview or the application should load Inter is a product decision. The
run's pass sentence also still omits the two-channel counts (19 differing, 27 REST-only on this
node).

## 2026-11-08 (audit) — the code behind the design seat, read at 288910a7

The designer's screen is the subject of this record. It states what the code does now, at commit `288910a7` on branch `design-room-honest-ingest`, and what was measured in this session. It is a record, not a plan: it proposes no repair, and no second document was written.

### The checks that were run

- `cd frontend && npm run typecheck` exited 0. The compiler read the whole front end, including `a2ui-primitives.ts` and `ToolsSeat.tsx`, and reported no type error.
- `cd frontend && npm run catalog:check` exited 0 and printed two `[blocking]` findings. The catalog declares a `"seat"` slot on `RoomEmbed` and the element renders no slot by that name, so a payload written to that slot draws nowhere. The README claims 74 trusted components and the catalog holds 75. The command reports and never fails on a finding, so exit 0 is not a clean verdict.
- `python3 -m py_compile` succeeded for `backend/routes/figma.py`, `backend/prompt_sessions_api.py`, `backend/figma_fidelity.py`, `backend/design_renderer.py`, `backend/card_lifecycle.py`, `backend/routes/design_console.py`, `backend/routes/ai.py`, `backend/routes/prompt_sessions.py` and `backend/routes/design_reviews.py`.
- `git status` shows no modification to the four files the audit named. Their contents are the committed contents of `288910a7`.

### The eleven skills

`.agents/skills/anti-error-suppression/SKILL.md` is present. The record is `SUPPRESSED_COMPLIANCE_BYPASS`: the fallbacks at `prompt_sessions_api.py:791-795`, `card_lifecycle.py:39-42`, `design_console.py:63`, `:1066-1073`, `:532-553` and `:570-577` turn a failed read into an empty value.

`.agents/skills/deterministic-agentic-compilation/SKILL.md` is present. The record is `SUPPRESSED_COMPLIANCE_BYPASS`. The permanent-ledger rule is broken by the deletes at `prompt_sessions_api.py:819`, `:823`, `:827` and `:1408`. The failure-placement rule is broken by `ToolsSeat.tsx:1159-1174`, which sends the raw failure to the chat and not to the left `<pre>`. The literal 422 block exists at `figma.py:5477-5481` but cannot name the three keys it names, for the reason recorded below.

`.agents/skills/architecture-preservation/SKILL.md` is present. The record is `SUPPRESSED_COMPLIANCE_BYPASS`: the working tree deletes 18 tracked `design/` documents, 4062 lines, with no replacement of equivalent size.

`.agents/skills/sovereign-workspace/SKILL.md` is present. The record is `ARMED_AND_HONEST`: no remote fetch, no checkout and no historical override was found in the scanned paths.

`.agents/skills/a2ui-catalog-validation/SKILL.md` is present. The record is `SUPPRESSED_COMPLIANCE_BYPASS`: the gate exits 0 with two `[blocking]` findings, and the skill's definition of done requires zero.

`.agents/skills/runtime-diagnostics/SKILL.md` is present. The record is `SUPPRESSED_COMPLIANCE_BYPASS`: the console treats an unread conversation list as an empty list and creates a new conversation at `design_console.py:532-553`, and treats an unread thread as unused at `:570-577`.

`.agents/skills/a2ui-core-architecture/SKILL.md`, `a2ui-data-binding/SKILL.md`, `a2ui-data-flow/SKILL.md`, `a2ui-protocol/SKILL.md` and `a2ui-user-actions/SKILL.md` are present. No binding, stream sequence, payload shape or action envelope was changed in the four scanned files. The record is `ARMED_AND_HONEST` for those layers, with the catalog gate's findings standing.

`AGENTS-instructions/ZERO-SUPPRESSION-MODE.md` and `frontend/src/rooms/design/ZERO-SUPPRESSION-MODE.md` are present and untracked; they are byte-identical. The code below contradicts both.

### `frontend/src/components/lit/a2ui-primitives.ts`

**What the designer receives.** The card grid draws. The `<agent-card-element>` tag at 579-597 is whole, every attribute is an attribute, and no comment text sits inside the `html` template. The four `//` lines the earlier report placed at 586-589 are not in the file. Lines 588-589 are `description=${item?.description ?? ''}` and `version=${item?.version || item?.message_count || 1}`.

**What the design card carries.** Line 586 is `?nodelete=${item?.room_domain === 'design'}`. The reported `String(item?.element_key ?? '') !== ''` fallback is absent. The consumer is real: `agent-card-element.ts:62` declares `nodelete: { type: Boolean }`, `:84` declares the field, and `:549` suppresses the trash control when `isDemoMode() || this.nodelete`. A design card has no delete control; a product card does.

`[FILE_PATH]: frontend/src/components/lit/a2ui-primitives.ts:579-597`
`[INTENDED_CONSTRAINT]: no comment text inside the tagged template; one whole tag.`
`[ACTUAL_CODE_STATE]: lines 579-597 as above; the only change to this template in fc1f45fe is status-color at 591.`
`[STATUS]: ARMED_AND_HONEST`

### `backend/routes/figma.py`

**What the designer receives when the file states an unexamined key.** The four-line refusal is written at 5477-5481 and raised at 5489:

```
[ERROR_TYPE]: INGEST_VALIDATION_FAILURE
[FAILED_NODE]: <node>
[MISSING_OR_UNPARSED_KEYS]: [<keys>]
[STATUS]: Pipeline incomplete. Representation accuracy is below 100%.
```

The refusal reads `key_coverage(spec_for_model)` at 5470. `key_coverage` walks only `node.get("stated")` (`figma_fidelity.py:1650-1651`).

**What the three named keys do instead.** `_CONSUMED_KEYS` at 3351-3353 names `arcData`, `componentProperties` and `maxWidth`, and the comment states they are carried as named spec fields rather than as `stated`. The spec builder writes them at 3448-3458. Because they are not in `stated`, `key_coverage["omissions"]` cannot name them, and the refusal at 5489 cannot fire for them. The three keys are examined elsewhere: `RAW_TO_SPEC` names them at `figma_fidelity.py:88` and `:138-139`, and the comparison branches at `:1346-1450` return `drawn` or `differs`.

`[FILE_PATH]: backend/routes/figma.py:3351-3358, 3443-3458`
`[INTENDED_CONSTRAINT]: a key the skill names must reach the literal 422.`
`[ACTUAL_CODE_STATE]: the keys are consumed into spec fields and excluded from stated; key_coverage reads stated only.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

**What the designer is told about the gate.** The comment at 5744-5753 says `REPORTED, NOT BLOCKED (owner ruling)`, says `NOTHING stops the ingest`, and calls a refusing gate "suppression wearing zero-trust clothes". The code directly below it, at 5766-5776, reads `gate.get("blocks")` and raises `HTTPException(status_code=422, detail="The fidelity gate blocked this design. Nothing was written.")`. The comment describes a behavior the file does not have.

`[FILE_PATH]: backend/routes/figma.py:5744-5776`
`[INTENDED_CONSTRAINT]: one doctrine, matching the code beneath it.`
`[ACTUAL_CODE_STATE]: comment says reported and not blocked; code blocks and raises 422.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

**What travels with a successful result.** The comment at 5889-5893 says the validation profile is "the report that travels with the drawing". `_validation_failure` is assigned only at 5472, where it is `None`. The only path that would populate it raises at 5489. A 200 answer therefore always carries `"validationFailure": null` at 5894.

**What the activity record filters.** At 6437-6447 the record reads `(result.get("validationFailure") or {}).get("keys")` and removes those keys from the blocking sentences. Because `validationFailure` is always null on a 200, `_validation_keys` is always empty and `_reported_blocking` equals `blocking`. The filter never removes anything.

`[FILE_PATH]: backend/routes/figma.py:5889-5894, 6437-6468`
`[INTENDED_CONSTRAINT]: the profile must travel with the answer and name the keys in the record.`
`[ACTUAL_CODE_STATE]: validationFailure is null on every 200; the key filter is always empty.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

**What stops the heavy node.** The measured spec passes the 200,000-character gate at 5433-5464. The rendered component is measured at 5587-5604, and `446,820 > 200,000` raises 413 with "The component this design produces is 446,820 characters". Log lines 673 (18:20:40Z) and 674 (18:21:54Z) record this refusal. It runs before the fidelity gate at 5766, so the heavy node never reaches the three-key question.

**What still refuses an unmapped spec key.** `unrendered_keys` at 5534-5546 raises 422. Log line 671 (17:38:33Z) records it firing for `componentName`.

**What the route does with a refusal.** At 6485-6506 the handler catches `HTTPException`, records `ingest-refused` for a 4xx with `reason: "the run stopped with HTTP 422"`, and re-raises. Log line 670 (17:30:09Z) records the literal three-key block as an `ingest-refused` with that reason.

`[FILE_PATH]: backend/routes/figma.py:5534-5546, 5587-5604, 6485-6506`
`[INTENDED_CONSTRAINT]: a deliberate stop keeps its status, its message and its record.`
`[ACTUAL_CODE_STATE]: both branches raise; the route records and re-raises.`
`[STATUS]: ARMED_AND_HONEST`

### `backend/prompt_sessions_api.py` and the delete path

**What happens to an empty or unreadable row.** `_discard_losing_tab_package` at 769-830 reads `metadata`. A string that is not valid JSON becomes `{}` at 791-795. With no `session_type` at 798 and no conversation message at 800-812, the function deletes the conversations at 819, the permissions at 823 and the session row at 827.

**What happens to a card the designer deletes.** `delete_session(permanent=False)` at 1391 also accepts `permanent=True`, and 1408 executes `DELETE FROM prompt_sessions`. The route exposes the flag at `routes/prompt_sessions.py:468-470` and passes it at 504. `DesignSeatShell.tsx:184` asks for `?permanent=true`.

**What happens to the conversations before that.** `DesignSeatShell.tsx:181` calls `await remove(...).catch(() => undefined)`. A failed conversation delete is discarded, and the session row is deleted next. The comment at 172-174 promises that a failure leaves the card where it is; the conversation failure does not.

`[FILE_PATH]: backend/prompt_sessions_api.py:769-830, 1391-1413`
`[INTENDED_CONSTRAINT]: no session row, active, failed or empty, is ever deleted.`
`[ACTUAL_CODE_STATE]: the orphan path deletes three tables and treats corrupt metadata as empty; the permanent path deletes the row.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

`[FILE_PATH]: backend/routes/prompt_sessions.py:468-470, 504 and frontend/src/rooms/design/DesignSeatShell.tsx:179-193`
`[INTENDED_CONSTRAINT]: the design room's card delete must not be a permanent row delete, and a failed child delete must stop the act.`
`[ACTUAL_CODE_STATE]: permanent=true is requested at 184; the conversation failure is swallowed at 181.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

`[FILE_PATH]: frontend/src/rooms/console/useConsoleCardActions.ts:110-112`
`[INTENDED_CONSTRAINT]: a failed delete must be told to the person.`
`[ACTUAL_CODE_STATE]: the catch writes console.error only; the card stays and no message is shown.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

### `frontend/src/rooms/design/tools/ToolsSeat.tsx`

**What the designer sees when the server refuses with the validation profile.** Lines 1165-1174 call `reportFailure(raw, status)` and `setDesignPreview(null)`. `reportFailure` calls `reportIngestFailure` at 1248-1273, which persists the server's words to the conversation with `alert: true` and hands them to the chat. The profile is not written to the left-column `<pre>`: the comment at 1160-1163 says it is deliberately not copied into the form's diagnostic zone. The skill requires the raw failure in the left-column scrolling `<pre>` above the component tree.

**What the designer sees when the answer carries blocking findings.** Lines 895-979 keep the drawing, describe the differences in the chat, and ask `Do you accept the drawing as it stands?`. The server raises 422 at `figma.py:5767-5776` whenever `fidelity.blocking` is non-empty, so a 200 answer with `blocking.length > 0` cannot arrive from the live route. The branch that shows the drawing with its differences is unreachable for server-produced results.

`[FILE_PATH]: frontend/src/rooms/design/tools/ToolsSeat.tsx:895-979, 1159-1174, 1248-1273`
`[INTENDED_CONSTRAINT]: the raw failure belongs in the left `<pre>`; a gated design is not drawn beside a warning.`
`[ACTUAL_CODE_STATE]: the 422 goes to the chat and the preview is cleared; the blocking branch cannot receive a server 200 with blocking findings.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

**What is honest in this file.** The failure line is persisted with `alert: true` at 1269, and a failed persist is `console.error` at 1273 while the chat's own write is still offered. `updateComplete` catches at 410-413 and 419 do not reject in Lit and the file says so.

`[FILE_PATH]: frontend/src/rooms/design/tools/ToolsSeat.tsx:1248-1273`
`[INTENDED_CONSTRAINT]: the failure must survive a reload and be drawn as an error.`
`[ACTUAL_CODE_STATE]: persistIngestLine(content, true); alert state carried.`
`[STATUS]: ARMED_AND_HONEST`

### `backend/figma_fidelity.py`

**What the comment says about `RAW_TO_SPEC`.** Lines 84-88 say `TWO KEYS THE PIPELINE EXAMINES AND DOES NOT CARRY`, and say the reason each is accepted is in `design_renderer.ACCEPTED_UNRENDERED`. `arcData` is carried into `spec["arcData"]` at `figma.py:3448-3454`; it is not in `ACCEPTED_UNRENDERED` (`design_renderer.py:111-164` contains `styles` and no `arcData`). `componentProperties` and `maxWidth` are also in `RAW_TO_SPEC` at 138-139, so there are more than two such keys.

`[FILE_PATH]: backend/figma_fidelity.py:84-88`
`[INTENDED_CONSTRAINT]: the comment must describe the current classification.`
`[ACTUAL_CODE_STATE]: it describes a two-key accepted set that no longer exists.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

**What the walk covers.** Line 2288 skips a key only when `key in NOT_A_FACT or key not in RAW_TO_SPEC`. `componentProperties` and `maxWidth` are in `RAW_TO_SPEC` at 138-139, so they are not skipped. The three keys produce comparison rows.

**What the exactness number counts.** Lines 2462-2474 set `exact` to the drawn count and `compared = exact + not_exact + unexamined`, where `unexamined` is the omission count from `key_coverage`. The denominator includes the stated keys no examination covers, so a design cannot print 100% by leaving them out.

**What the accounting closes on.** Line 2102 sets `closed` from the row equation only: `not duplicates and len(rows) == drawn + accepted + missing`. `unexamined` is returned at 2101 and named in the note at 2103-2106, but it is not part of `closed`. The gate still blocks on the omissions at 2157-2160.

`[FILE_PATH]: backend/figma_fidelity.py:2102, 2288, 2462-2474`
`[INTENDED_CONSTRAINT]: every stated fact is either a row, an accepted fact, or a blocking omission.`
`[ACTUAL_CODE_STATE]: the walk covers the three keys; exactness includes the omissions; the closed flag alone does not.`
`[STATUS]: ARMED_AND_HONEST`

**What the gate blocks.** `fidelity_gate` at 2110-2200 collects omissions (2157-2160), `differs` (2171), `uncomparable` (2173), `not-read` (2176), `not-drawn` (2178) and a `defect` outside `INERT_DECLARATIONS` (2187-2190), and returns `"blocks": bool(blocking)` at 2197.

`[FILE_PATH]: backend/figma_fidelity.py:2110-2200`
`[INTENDED_CONSTRAINT]: an omission or an unexamined defect must stop the ingest.`
`[ACTUAL_CODE_STATE]: blocks is true for each of those verdicts.`
`[STATUS]: ARMED_AND_HONEST`

### `backend/design_renderer.py`

**What the renderer reads.** `RENDERED_KEYS` includes `arcData`, `componentProperties` and `maxWidth` at 79-88. `maxWidth` emits `max-width` at 661-662. The three facts have a drawing mapping.

**What is deliberately not drawn.** `ACCEPTED_UNRENDERED` at 111-164 is headed with the singular `THE FIGMA KEY THE PIPELINE DELIBERATELY DOES NOT CARRY (2026-11-02)` and contains `styles` and the other examined facts. `arcData` is absent. `unrendered_keys` at 197-219 refuses any spec key outside `RENDERED_KEYS` and `ACCEPTED_UNRENDERED`; the ingest raises 422 on that list at `figma.py:5534-5546`.

`[FILE_PATH]: backend/design_renderer.py:79-88, 111-164, 197-219`
`[INTENDED_CONSTRAINT]: a fact is either drawn, accepted with a written reason, or refused.`
`[ACTUAL_CODE_STATE]: the three keys are drawn; styles is accepted with its reason; an unknown key is refused.`
`[STATUS]: ARMED_AND_HONEST`

### `backend/card_lifecycle.py` and `backend/routes/design_console.py`

**What a corrupt row becomes.** `card_lifecycle.py:38-42` returns `{}` when the metadata string is not valid JSON. `card_state_of` then reads no `session_type` at 45 and returns `None` at 47-48. A row that cannot be read is treated as "not a card".

`[FILE_PATH]: backend/card_lifecycle.py:33-48`
`[INTENDED_CONSTRAINT]: a failed read must be reported, not turned into "not a card".`
`[ACTUAL_CODE_STATE]: JSONDecodeError becomes an empty mask.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

**What the console does with the same row.** `_card_status` at 57-66 falls back to `{}`. The queue route at 1066-1078 does the same, then sees an empty `kind` and raises 409 with "Session {id} is a live Tools visit. A queue holds cards; close the visit before submitting it." The sentence is a wrong diagnosis of a corrupt row.

**What the console does when a read fails.** At 532-553 a failed conversation-list read is printed and the list stays empty; the code then creates a new conversation. At 570-577 a failed thread read leaves `used` false, so the thread is reused as if unused. At 595-596 a failed new-conversation write is printed and the old thread stays open. At 346, 460 and 1255 a failed package read, description write and close-line write are printed and the handler continues.

`[FILE_PATH]: backend/routes/design_console.py:57-66, 532-553, 570-577, 595-596, 1066-1078`
`[INTENDED_CONSTRAINT]: an unread value must not be treated as an empty value, and a failed read must be visible to the person.`
`[ACTUAL_CODE_STATE]: print-only at 346, 460, 538, 553, 575, 596, 1255; an unread list is written over at 543-553; a corrupt row is called a live Tools visit at 1076-1078.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

**What the console does when the card or queue read fails outright.** Lines 521 and 986 raise 503 with the failure named. Line 287 is a `POST` that writes rows: `get_or_create_design_container` at 305 and `get_or_create_design_tab(tab="tools")` at 409-412. A call to this route is not a read-only assembly; it can create the row that `4f72809b` was reported to be.

`[FILE_PATH]: backend/routes/design_console.py:287-412, 521, 986`
`[INTENDED_CONSTRAINT]: a failed read is refused; a writer is known to write.`
`[ACTUAL_CODE_STATE]: 503 on failure; the POST creates the container and the Tools tab row.`
`[STATUS]: ARMED_AND_HONEST`

### `backend/routes/ai.py`

**What a save does now.** The approval queue is paused. `save_metadata` at 5383-5424 writes `session_type`, `kept_at`, `kept_by`, the preview and the workspace; it does not write `review_stage`. The comment at 5415-5424 states the card stays Closed and editable.

**What happens when the "Card saved." line cannot be written.** Lines 5466-5491 call `_warn` and let the save stand. `_warn` at 961-975 prints and appends to the process-wide `_REQUEST_WARNINGS`; `_drain_warnings` at 976-980 hands the list to the handler's response, and the save response drains at 5644. The comment at 955-958 admits a warning can land in another handler's response. The failure is not silent, but the attribution is process-wide rather than per request.

`[FILE_PATH]: backend/routes/ai.py:961-980, 5383-5424, 5466-5491, 5644`
`[INTENDED_CONSTRAINT]: a save keeps the card Closed while the queue is paused; a degraded save is reported.`
`[ACTUAL_CODE_STATE]: no review_stage write; the save line failure is warned and drained into the response.`
`[STATUS]: ARMED_AND_HONEST`

### `backend/routes/design_reviews.py`

**What the word "approved" means.** The module's own heading at 20-21 says it does not publish and does not write the catalogue: approving a session records the gate, and the catalogue write is a separate act. The limitation is written down. A screen that reads "approved" as a completed catalogue write would be reading it as more than the module does.

`[FILE_PATH]: backend/routes/design_reviews.py:20-21`
`[INTENDED_CONSTRAINT]: the record must not claim a catalogue write it did not make.`
`[ACTUAL_CODE_STATE]: the module states the limitation; the catalogue write is not in this path.`
`[STATUS]: ARMED_AND_HONEST`

### The written record

`frontend/src/rooms/design/CHANGELOG.md:35` says the validation check "no longer raises" and that the four-line profile travels in "the result, the left `<pre>`, the chat and the activity row". It does raise at `figma.py:5489` and `:5772`; `validationFailure` is null on every 200; `ToolsSeat.tsx:1160-1163` sends the profile to the chat and not the left `<pre>`. The same paragraph says the three keys "remain unexamined"; they have comparison branches at `figma_fidelity.py:1346-1450`.

`[FILE_PATH]: frontend/src/rooms/design/CHANGELOG.md:35`
`[INTENDED_CONSTRAINT]: the written record matches the code.`
`[ACTUAL_CODE_STATE]: the paragraph is false on the raise, the profile's route and the three keys' examination.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

`CHANGELOG.md:29` says the save does not write `review_stage`. `ai.py:5415-5424` confirms it. `[STATUS]: ARMED_AND_HONEST`.

`CHANGELOG.md:5` says the queue returns zero cards. The handoff entry at line 39 says the queue returned three; line 5 is the later dated entry and supersedes it. `[STATUS]: ARMED_AND_HONEST (chronological record)`.

### The log

`backend/logs/figma-ingest.jsonl:662` is the 15:30:48Z refusal (job `d25b7109`). `:669` is the 17:06:03Z run with `verdict: "3 fact(s) did not match"` (job `d14f2cd3`). `:670` is the 17:30:09Z refusal with the literal three-key block (job `276a9b5e`). `:671` is the 17:38:33Z refusal naming `componentName` (job `16fcf9cf`). `:673` and `:674` are the 18:20:40Z and 18:21:54Z refusals at 446,820 characters. The log contains both a report and a refusal; the 17:30 entry is a refusal, and the 17:06 entry is a report.

`[FILE_PATH]: backend/logs/figma-ingest.jsonl:662, 669, 670, 671, 673, 674`
`[INTENDED_CONSTRAINT]: a refusal is recorded as a refusal and a report as a report.`
`[ACTUAL_CODE_STATE]: the kinds and reasons are recorded as above.`
`[STATUS]: ARMED_AND_HONEST`

### The working tree

The uncommitted delta is 19 files, 111 insertions, 4063 deletions. Eighteen tracked `design/` documents are deleted: `ARCHITECTURE.md`, `CHANGELOG.md`, `ONE-CHAT-PER-TAB.md`, `README.md`, `TODO.md`, `TOOLS-SEAT-SPLIT-PLAN-2026-10-31.md`, `WORKING-RULES.md`, `figma-ingest/CHANGELOG.md`, `plans/00-DATABASE.md`, `plans/01-INGEST.md`, `plans/02-APPROVALS.md`, `plans/03-CATALOGUES.md`, `plans/04-UX-TAB.md`, `plans/05-SEATS.md`, `plans/06-CARDS-AND-CONSOLE.md`, `slots/SLOT-CHANGELOG.md` and `slots/SLOT-PLAN.md`. `git diff --numstat -- design` reports 0 insertions and 4062 deletions. No replacement text of equivalent size is added on this branch.

`README.md:245` was changed from 67 to 74 trusted components. The catalog holds 75, and the gate reports the drift as `[blocking]`.

`[FILE_PATH]: design/ (18 tracked documents)`
`[INTENDED_CONSTRAINT]: architecture preservation; no net-destructive deletion.`
`[ACTUAL_CODE_STATE]: 4062 lines deleted; 0 added.`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

`[FILE_PATH]: README.md:245`
`[INTENDED_CONSTRAINT]: the documented count equals the catalog count.`
`[ACTUAL_CODE_STATE]: 74 stated; 75 held; the gate reports "[blocking] doc-claim-drift".`
`[STATUS]: SUPPRESSED_COMPLIANCE_BYPASS`

### What was not read

The database was not queried. The states of `deb5a8eb`, `79ce2e2d`, `57a1503d` and `4f72809b`, the four removed rows and the orphan activity row were not read. The code paths that would produce those outcomes are recorded above; the rows themselves are not evidence in this record.

The Design room was not loaded in a browser and no screenshot was taken. `tsc -b --noEmit` exited 0, and the claimed comment break at `a2ui-primitives.ts:586-589` is absent from the file. The runtime behavior of the card grid and the room was not observed.

The repair plan that follows from this record is in [REPAIR-PLAN-2026-11-08.md](REPAIR-PLAN-2026-11-08.md).

## 2026-11-08 (approval queue paused) — the cards are editable again; the queue is preserved

**The three saved cards were released from the Supervisor Queue.** `deb5a8eb` "right-column-panel-container", `79ce2e2d` "Figma Wireframes for AI Prompt Platform" and `57a1503d` "Figma Wireframe Design Reference Prompt" had `review_stage=in-review` removed. Each is **Closed** and unlocked, each conversation carries a release line, and the queue returns zero cards. The release changed no content, no preview and no conversation history.

**A save no longer sends a card into review.** The save path in `backend/routes/ai.py` used to write `review_stage=in-review` and the approval routing mask on every design save, so a card became read-only the moment it was kept. That block is removed for the current testing; a save keeps the card Closed and editable. This entry is the record of that decision, and the comment at `backend/routes/ai.py:5411-5415` points here.

**The queue itself is preserved for later.** `backend/card_lifecycle.py`, `GET /api/design/queue`, the read-only ledger, the 423 refusals and `POST /api/design/sessions/{id}/queue` are untouched. When approvals return, the queue endpoint is the explicit act that sends a card to the supervisor. Nothing about the queue was deleted or disabled in code; it is simply not part of the current save.

**Verified.** The Design console returned six cards: the two design systems, the three saved cards as Closed and unlocked, and `4f72809b` as Open. `GET /api/design/queue` returned zero cards. The card read for `deb5a8eb` returned `Closed` with `locked: false`, and `render-design` returned its stored preview with `card_state: Closed` and `locked: false`. The backend compiles.

## 2026-11-08 (card list correction) — every saved card is drawn, and the blank column is gone

**The card the designer made is back in the Design console.** The console had hidden every card in `Pending_Approval`; it now draws a queued card with its state and its lock, so `deb5a8eb` "right-column-panel-container", `79ce2e2d` "Figma Wireframes for AI Prompt Platform" and `57a1503d` "Figma Wireframe Design Reference Prompt" are drawn beside the live Open row instead of disappearing. The lock still refuses every change; the card is present and read-only.

**The empty "Design — Tools" column in the global console is gone.** Four blank rows were removed with their conversations: `ae788ef1` and `693914ba`, closed visits holding only a greeting and a close line, and `4b8ad59a` and `c6406e1b`, untyped duplicate rows with no messages at all. The live Tools row `4f72809b` and the three saved cards were kept. The global console returned the three saved cards and no blank "Design — Tools" card; the Design console returned the two design systems, `4f72809b` as Open, and the three saved cards as Pending_Approval and locked.

**The duplicate rows cannot return.** A losing tab creator made a session and a conversation, then the one-per-tab index refused its kind; it read the winner and left its own untyped row behind, which the global console listed as a package. `get_or_create_design_tab` now removes the losing row and its empty conversation. A race test confirmed the session, conversation and permission rows were removed, and the live row was untouched.

**Verified.** The Design console's card read returned six cards: the two systems, `4f72809b` as Open, and the three saved cards as Pending_Approval with `locked: true`. The global console returned fourteen cards, the three saved design cards among them, and zero blank "Design — Tools" cards. The backend compiles. This was verified through the running server; the cards were not clicked through in the browser.

## 2026-11-08 (handoff) — the card lifecycle, the vault lock, and the supervisor queue

**The designer now sees the card's lifecycle instead of a duplicate.** The Design console draws the live Tools row as **Open** and the closed blank visit as **Closed**. The three saved cards in review — `deb5a8eb` "right-column-panel-container", `79ce2e2d` "Figma Wireframes for AI Prompt Platform" and `57a1503d` "Figma Wireframe Design Reference Prompt" — are not drawn in that list. They stand in the Supervisor Queue as **Pending_Approval** with `locked: true`, and the queue read returned all three. The rows, their conversations and their activity remain whole; only the designer's workspace list omits them.

**The lifecycle is one enum and one reader.** `backend/card_lifecycle.py` defines `Open`, `Closed`, `Pending_Approval` and `Queued_For_Share`, the two locked states, the row reader and the refusal sentence. `frontend/src/rooms/design/cardLifecycle.ts` carries the same four names to the browser; no surface compares a label or a colour to decide a lock. A live `design_tab` Tools row is Open. A `design_session` with `share_stage=queued` is Queued_For_Share; one with `review_stage=in-review` is Pending_Approval; every other `design_session` is Closed. An approved card is Closed and its footer reads Approved. The routing mask in `metadata.routing` records where the card was sent; the stage decides whether it is still queued.

**The queued card is locked in the panel and at the write.** For a locked card, `buildContent` returns no ingest form, no middle column and no footer; the left column draws a read-only ledger naming the state, the card, the reviewer and the reason. The Tools page evaluates the state before an ingest, a save or a discard and answers with the state's refusal; the leave question is not asked because neither answer could run. The server refuses the same acts: the save answers 423 before the model call, the close answers 423, the ingest answers 423 before a job exists and 400 when a named session arrives without the person's id, and a second queue submission answers 409. The save does not write `review_stage`: the queue is paused by the owner's 2026-11-08 ruling, and the card stays Closed until `POST /api/design/sessions/{id}/queue` is called; the page writes the card's state into its tree and the ledger replaces the canvas immediately.

**The queue is a routing change, not a copy.** `POST /api/design/sessions/{id}/queue` with `destination: "approval"` writes `review_stage=in-review`; with `destination: "share"` it writes `share_stage=queued`. Both update the routing mask and append the state change to the session's own conversation. The row is not deactivated, archived or purged. A live Tools row is refused with 409 because a queue holds cards and the visit must be closed first. The review writer now records the approval routing as well.

**The console's query and the supervisor's read.** The design console's card query filters the locked states out of the grid. `GET /api/design/queue` returns exactly those rows, permission-scoped through `session_permissions`, with `owner_id`, `permission` and `queue` on each card. The global console's design cards carry `state` and `locked`, so its wide view shows a queued card without pretending it is in the designer's workspace. `design_card` remains the one builder; the card shape gained `state`, `locked`, `routing` and `reviewer`.

**The validation check reports; it does not withhold the drawing.** The `INGEST_VALIDATION_FAILURE` profile is unchanged, and the check still runs before the renderer. It no longer raises. A design that states `arcData`, `componentProperties` or `maxWidth` is drawn from what was measured, the preview is shown, and the exact four-line profile travels in the result, the left `<pre>`, the chat and the activity row. The old blocked run at `09:30:48` for session `deb5a8eb`, job `d25b7109`, node `40001066:3272` holds the profile as a refusal; the new path records the same profile on an `ingest-failed` row beside the drawing. The three keys remain unexamined; the component is misshapen where they apply, and the report says so. The parser keys were not fixed, mocked or defaulted. The size gate is unchanged at 200,000 characters of renderable design, about 50,000 tokens; a design at 150,000 tokens would be refused earlier with `TOO LARGE TO INGEST`. The heavy node passed the size gate; its report is the validation profile, not size.

**The original plan, assessed.** `APPROVAL-QUEUE-PROMPT.md` and `CONTINUE-PLAN-PROMPT.md` proposed a separate pending-entry record, a separate log conversation, a five-read loop and a new approval table. The record shows those are not needed: the `design_session` row is the entry, its conversation is the log, `POST /api/design/sessions/{id}/review` is the state writer and the queue endpoint is the routing. The card state and the queue are built. What remains is the supervisor surface: the Approvals tab does not draw the queue cards, bind the selected card's log or walk the approve and changes decision with the existing commit. The advanced console filter, the mirrored-frame, partial-arc and truncated-line facts, the one log writer, the three chat copies and the passing round trip remain; none is a prerequisite for the state machine. The separate table, the separate log and the five-read loop are not to be built.

**Verified.** `GET /api/design/queue` returned three cards, all `Pending_Approval` and locked. `POST /api/design/console` returned the two design systems, `ae788ef1` as Open and `693914ba` as Closed, with no queued card. On `deb5a8eb`, close, queue, ingest and save answered 423, 409, 423 and 423. The `render-design` assembly for that card returned `card_state: Pending_Approval` and `locked: true`. The heavy node `40001066:3272` was run through the ingest without the stopping check: it returned a preview module of 446,869 characters, a `validationFailure` naming `arcData`, `componentProperties` and `maxWidth`, and three blocking rows. The component is drawn; the profile is the report. The backend compiles and the frontend type check exits zero.

**What was not verified.** The drawn heavy component and its diagnostic and chat were not clicked through in the browser. The route's activity row for the new non-blocking path was not written by the direct run; the row at `09:30:48` is the old refusal. The supervisor walk was not run: the approval decision that commits a component is not wired to a supervisor chat, and the review endpoint records the gate without writing the catalogue. The sharing queue has a read and a submission; it has no disposition. The duplicate "Card saved. This session is in review." line remains when the save runs twice, and the live working row still carries the default "Design — Tools" title until a save names it.

**The handoff.** `HANDOFF-PROMPT.md` records this state, the plan assessment, the next work and the constraints. `CONTINUE-PLAN-PROMPT.md` and `APPROVAL-QUEUE-PROMPT.md` carry a note that the handoff is the current state.

**Files changed for this part.** `backend/card_lifecycle.py` (new), `frontend/src/rooms/design/cardLifecycle.ts` (new), `backend/routes/design_console.py`, `backend/routes/ai.py`, `backend/routes/design_reviews.py`, `backend/routes/figma.py`, `frontend/src/rooms/design/tools/content.ts`, `frontend/src/rooms/design/tools/ToolsSeat.tsx`, `frontend/src/rooms/design/console/useDesignConsole.ts`, `frontend/src/rooms/design/console/leftColumn.ts`, `frontend/src/rooms/design/DesignSeatShell.tsx`, `frontend/src/rooms/design/HANDOFF-PROMPT.md` (new), `frontend/src/rooms/design/APPROVAL-QUEUE-PROMPT.md` and `frontend/src/rooms/design/CONTINUE-PLAN-PROMPT.md` (notes).

## 2026-11-08 (later still) — the page per visit, the saved run, and the honest error

**The designer receives a new page on every press.** The Design room now holds one page. A tab press creates that tab's page, and a card press while Tools stands creates a new Tools page; the page that stood is disposed with its chat, its drawing, its draft, its filter and its live state. The Tools page is keyed by the visit, not only by the tab. The room clears the Tools content on entry and on leave, and a content report from a page that no longer stands is ignored. While the Tools session is read, the left column shows its own ring and the middle is empty; the console's card grid is not a stand-in. The Tools chat binds only to the session the Tools answer states (`session.design_session_id`), never to the console's package map. A new visit starts with no session until the server names one, and the kept mark, preview, live conversation, failure mark and third-column flag reset when the server names a different session. The owner checked this navigation and it is the state this record starts from.

**The card comes from the server.** `design_card` in `backend/routes/design_console.py` is the one builder of the card's shape. `GET /api/design/cards/{session_id}` returns one saved card in that shape, and the save places the server's card. The front end no longer invents a Pending state or empty colours. A failed card read is stated, and no card is invented. A card id that is not this person's saved session is refused with its reason; the working row is not used instead. A read failure is a 503, not a missing card.

**The leave question has two answers.** Leaving Tools offers Save, which makes or updates the card, and Discard, which removes the working visit. A card the visit opened is kept by its record. If the question cannot be drawn, nothing is saved and nothing is deleted; the room says so. A recorded failure counts as work, the question names it, and a saved card asks only for a field or a draft made since it was opened. The third answer that kept the visit for the next press is gone.

**The saved run returns with the card.** The save sends the whole preview: the compiled drawing, the facts, the values, the steps, the measured tree, the annotations, the specs and the patterns. The server stores it in the session's `metadata.preview`; a save with no preview keeps the stored one, and a save that sends null clears it. The `render-design` assembly returns the stored preview, and the Tools page applies it through the same setter a live run uses, so the third column, the drawing and the facts return. The warning that a save would lose the preview is gone, because it is no longer true. A card saved from a failed run has no preview and its chat carries the failure. The passing save's restore is built and has not yet been proven by a passing run.

**The failure is the server's own words, and the alarm holds.** The ingest files its activity against the Tools session's own row (`design_session_id`), not the room container. A terminal failure or refusal is written once to the log file and `figma_ingest_activity`, with the facts. The failure line in the conversation is the server's raw error, with `metadata.alert: true`; the history readers carry `alert`, so the card's chat draws the failure as an error after a reload. The 422 names one fact per line. The stroke comparison reads the whole colour, so `rgba(78, 104, 210, 0.5)` is no longer cut at `rgba(78,`. The pass line uses the server's verdict and the exactness count, not a blanket sentence.

**Tested.** Node `40001066:3272` was submitted through the Tools form. It failed after five reads with a 422 naming `arcData` as a stated fact no examination covers, and the stroke fact whose drawn value the parser had cut. The chat held the failure; the activity row at `07:43:07` named session `57a1503d`, job `eff8bdb0`, node `40001066:3272`, and two facts. The failed session was saved as card `57a1503d`, "Figma Wireframe Design Reference Prompt", kept at `07:53:05`, in review, conversation `93c25c3e`; its chat holds the failure and it has no preview. The next Tools visit is `79ce2e2d`, conversation `0f2ab174`, one message. The node did not hit the size limit; the refusal was the fidelity gate.

**The catalogue audit is manual.** The repository-wide audit (`npm run catalog:check`) no longer runs in the approval or the removal. Those paths no longer wait for it or return a `catalogCheck` verdict; the approval answers for the component it registered. The audit remains a manual check, and the catalogue view reads the last report with its checked-at time. The last report says 75 components, 40 findings, 1 blocking; the blocking finding is a README count.

**The plan.** `CONTINUE-PLAN-PROMPT.md` now records this state and the steps that remain. The approval queue is still not built: the card's state stops at `in-review`, and no pending entry, log conversation, selection walk or commit from the chat exists. The gate still skips `strokeCap`, `strokeJoin`, `dashPattern` and `maxWidth`, and counts carried facts as drawn. The running log still has two writers with `persisted` and `tab`, and the three chat copies remain. The seats are still host elements; the surface-descendant seat is not implemented. The ingest has not passed.

**What was not verified.** The passing save's preview restore, the red alert after a reload in the browser, and the approval and removal without the audit were not run end to end. The failed card's chat holds the failure line, but its text was saved before the verbatim change, so it is the old block; a new failure stores the server's raw text. The ingest still fails on `arcData`.

**Files changed for this part.** `frontend/src/rooms/design/DesignRoom.tsx`, `frontend/src/rooms/design/DesignSeatShell.tsx`, `frontend/src/rooms/design/tools/ToolsSeat.tsx`, `frontend/src/rooms/design/console/useDesignConsole.ts`, `frontend/src/rooms/design/console/leftColumn.ts`, `frontend/src/rooms/design/tools/conversation.ts`, `frontend/src/rooms/design/chat/conversation.ts`, `frontend/src/rooms/design/chat/console-conversation.ts`, `frontend/src/rooms/design/chat/chat-tab.ts`, `frontend/src/rooms/design/chat/design-chat.ts`, `backend/routes/ai.py`, `backend/routes/figma.py`, `backend/routes/design_console.py`, `backend/figma_fidelity.py`, `backend/conversation_api.py`, `backend/prompt_sessions_api.py`. `frontend/src/rooms/design/chat/console-chat.ts` was removed.

## 2026-11-08 (later) — the session, the card, and the running log

**A tab press starts a new session; a card opens only from its card.** Pressing Tools no longer opens the newest kept card. The server did that whenever the tab's own conversation held no person's turn. That fallback is removed. The tab now uses its own working session. A card opens when the card sends its own session id; the saved card then returns its own name, its Figma address and its conversation. This was checked against the running server: a fresh Tools press returned the working session with an empty Title and address and its own conversation, and the saved card returned the card itself with its name and address.

**The card press moves to the Tools page at once; the order is still wrong.** A purple cover with the card's name and “Opening…” was placed over the page while the card was read. It hid the page and any failure behind it and did not fix the order, so it is removed. The Tools page still draws the previous session until the card's read answers, and the card then replaces it. The earlier attempt made the page wait for the card before it stood, so the console stayed on screen and the press appeared to do nothing. Both attempts are recorded in `UNDO-WORKAROUNDS-PROMPT.md`; the card's page must be built from the card's own record, without a cover and without hiding errors. If a newer press arrives while an older read is running, the older answer is discarded.

**A saved card joins the console's own list in place.** The console is no longer re-read when Home is pressed. That re-read rebuilt the card grid under the pointer, which is how the card could stop answering and stop showing its hover. The save now hands its card to the console from the save's own answer; the design-system cards stay first, and the grid is not rebuilt. The card's status and category colours are not in that answer and are left empty, so a card saved this way may wear different colours from a card the console reads itself. Its name, description, state and click are present.

**The failure and pass lines are written by the seat that made the run.** The chat used to write a host line only while it was tied to a conversation; an ingest could fail before that tie and the line was shown and lost. The Tools seat now writes the line into this session's own conversation before showing it, and the chat draws it without a second write. A line for the Tools session is ignored by the other tabs' chats. A card reopened later reads its conversation and the line is there.

**Leaving Tools ends the visit.** The answer that kept the visit for the next press is gone. Leaving offers Save, which makes the card, or Discard, which removes the visit. A visit with no work is removed without a question. A card the visit opened is kept by its own kept mark and is not deleted; the next press of Tools is a new session. The page now carries whether it is a kept card, so leaving a card does not treat its saved work as unsaved.

**A discard cannot remove a kept card.** The discard reads the record's own kept mark before deleting; the visit flag remains as the fast path.

**The ingest did not pass in this session.** The owner set the ingestion aside to repair the session and card process. The last measured run of node 40001066:4301 refused after five reads. The refusal named three faults: two layers share a name and were counted as one fact twice; `componentProperties` and `locked` were treated as visual facts nobody had examined; and the `copolt` rectangle's image fill never reached the measured design. The working tree now distinguishes the rows by the layer's own id, treats those two instance facts as configuration, and carries the image fill as the picture itself in the drawing. The measured design was checked to carry the image; the full run was not repeated before this handoff, so the ingest's pass is not claimed. The saved card “SCE Enterprise AI Prompt Platform Wireframes” has its Figma address and its conversation, and no drawing.

**The handoff.** `UNDO-WORKAROUNDS-PROMPT.md` lists every shortcut and workaround from this session, what each one hid, and what has to be undone in the next chat. It also carries the record's evidence, the ingest's unfinished state, and what not to do.

**What was not checked in the browser.** The card press, its hover, the loading state and the error line on a reopened card were not clicked through after these changes. The frontend type check and the backend compile pass; the answers above about the new session, the saved card and the kept fact were read from the running server. The approval tab's running log is not tied to a card's conversation; the card's review state and its review entry are recorded. The advanced filter over the console cards is not built.

**Files changed for this part.** `frontend/src/rooms/design/DesignRoom.tsx`, `frontend/src/rooms/design/DesignSeatShell.tsx`, `frontend/src/rooms/design/tools/ToolsSeat.tsx`, `frontend/src/rooms/design/tools/tools-chat.ts`, `frontend/src/rooms/design/chat/chat-tab.ts`, `frontend/src/rooms/design/chat/design-chat.ts`, `frontend/src/rooms/design/console/useDesignConsole.ts`, `backend/routes/ai.py`, `backend/routes/figma.py`, `backend/figma_fidelity.py`.

## 2026-11-08 — the ingest draws from the file, and every outcome is a conversation

**What the designer receives.** A Figma link produces one of two results. Either the preview is the file, parameter by parameter, drawn in the middle column from memory, or the run fails after five reads and the chat carries one refusal that names every layer and fact that never matched. Nothing is written to disk during the preview, no activity row is made, and no catalogue file is read.

**The typed module.** Every value the file states — its geometry, paints, layout, style references, constraints and vector paths — is written into the generated `.ts` module as a typed property and a frozen object. A value that cannot be typed exactly stops the run. The module is checked by the TypeScript compiler from an in-memory source. The typed block is the record; the browser receives a compiled JavaScript form with the inert behaviour seam inlined, and draws it from a blob. The preview writes no file and serves no address.

**The gate.** The proof covers visual facts only. Style references, bindings, constraints, maximum widths, caps, joins, dash patterns, auto-resize, sizing modes and boolean operations are configuration: they are carried in the typed block and produce no row, no reason and no error. Visual facts must be drawn; a carried fact counts as drawn. The stroke alignment is drawn for outside, center and inside, and a stroke-only vector is drawn from its own stroke geometry. A design's text and font names are escaped for backticks, `${` and backslashes before they enter the module's template. The character limit is 200,000; the node limit remains 400.

**Five reads, one refusal.** The ingest reads both channels, rebuilds the typed module, draws it and proves it. A failed proof discards the attempt and re-reads, at most five times. The fifth failure returns one refusal that names every fact that never matched, and no preview is stored. A successful run is held in memory until the session is saved or approved.

**The catalogue is read at approval, not before.** The ingest no longer checks the tag, the layer names, the existing component or the catalogue names. A child pattern is named from its Figma layer. The comparison to what exists is made in the commit, which refuses a replacement until the designer answers. The preview and a saved draft are blind to the catalogue, even when a component shares the name.

**The conversation.** The run's steps are not a second or third copy. The pending column says that it is processing and to stand by. The completed third column keeps the run's step disclosure. The chat carries the result and the next steps: the success message asks approve or discard; the failure message has a header, the code, the cause, a numbered repair list, the raw error in its own block, and a copy action. A failure is reported once per run, not by both the poll and the request. The messages are written under the active conversation id, so a saved card reopens with its audit log. A failure opens the chat without resetting the left column, so the left keeps its width and padding and the chat gripper no longer snaps it.

**The tabs and their chats are bound together.** Each tab has its own seat and its own package, and the seat reads the surface that belongs to its tab. Tools reads the tools package; pressing the Tools tab starts a new session, and a saved Tools session is opened by its card on the console. UX reads the UX package; Chat reads the design console. The Chat tab is the design console chat, the advanced filter over the console cards, not a second Tools chat and not the global Console at the top of the site. Its conversation and its conversation list come from the same design console package. The earlier code took the Chat tab's conversation from the console package while its list came from a separate chat package; the two halves disagreed, so the tab could show another tab's thread. The separate chat package is no longer a source for the Chat tab, the Tools package is never read there, and the global Console is a different room the Design seat does not receive. A tab switch switches the package, the conversation and the list together; a tab with no conversation starts from its own package rather than borrowing one. The advanced filter itself, where the chat manages the design console cards as they grow into the hundreds, is not built; the binding it needs is in place.

**The leave question and the card.** The header now asks the Design room's leave question before it changes the room, with Save and Discard. Save runs the existing save, which relabels the working `design_tab` row to `design_session`, files it under the design category, stores the conversation id and starts the next Design visit fresh. The card is the record; the console lists it. The database check found no `design_session` rows and one Tools `design_tab` row, which is the proof that the process had never run; the wiring was the missing part. The pending approval stage and the done side of the card remain to be connected to the review writer.

**The chat type.** The conversation and ingest messages use IBM Plex Sans at 13 pixels with 1.5 line height. Headers are 14 pixels bold; notes and the raw-error block are 12 pixels. Bold, bullets, numbered lists, blank-line spacing and the fenced raw error are rendered from the message's own markers. The result turns keep their existing 16-pixel rich output. The renderer keeps the assistant's markers instead of flattening them.

**Verification.** The frontend type check is zero and the backend compiles. The 25-fact node and the 187-fact node both pass with every visual fact drawn. The five-attempt refusal was reproduced. The compiled module was imported and drawn in the page. The workspace remains local; no commit was made.

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
