# The approval process — its own record

*Started 2026-11-01, at the owner's word: *"that approval process is also in this repo — it should be
at the top level — it may need its own change log."*

**What this process is for.** A design that has been read from Figma does not go straight into the
design system. It goes into an approval flow first: a named person reviews it, asks for changes or
approves it, and only the last approval writes the catalogue. The plan is
[`APPROVAL-PIPELINE.md`](./APPROVAL-PIPELINE.md) beside this file.

**This log's marks.** `verified` — the thing exists and was measured. `specified, not built` — the
plan describes it and no code does it. `verification pending` — the code exists and the owner has not
confirmed it on screen. Nothing is written here as done without one of those.

---

## 2026-11-01 — where the process stands

### What is built, and verified

| thing | mark | where |
|---|---|---|
| A visit to Tools becomes a session, and keeping it puts a card on the Design console | verified | `design/CHANGELOG.md`, 2026-10-31 |
| A saved card reopens the session it stands for — its conversation, its title, its address, its notes | verified | `design/CHANGELOG.md`, 2026-11-01 |
| Saving with a live preview asks first: Save anyway / Approve / Cancel | verification pending | `rooms/design/tools/ToolsDecisionDialog.tsx` |
| The console draws design systems and kept sessions as cards | verified | `backend/routes/design_console.py` |

### What is specified, and not built

| thing | why it is not built yet |
|---|---|
| `design_drafts` — one row per designer's first approval | the tables do not exist; nothing writes a draft |
| `draft_reviews` — append-only, the trail Grace reads | same |
| The rule that the state is written only by the transaction that appends the event | needs the tables first |
| A named reviewer on the card: manager, design director, product | the picker and the addressee do not exist |
| The review as a view in the console's right column | the seat is one file for five tabs; the split is the prerequisite |
| The final approval that writes the catalogue | today `POST /api/figma/commit` is the only writer, and the Approve button calls it directly |
| The seven obstacles in the plan | each is measured in the plan with its file and line |

### The decision this folder already carries

ProcessMaker and Budibase are **reference points, not models**. Their zips sit in this folder because
the owner supplied them and the analysis is worth keeping; nothing of either is adopted. Our route is
three gates in a fixed order and lives in code, because a written route would be a second place saying
the same thing.

### Open, and the owner's to say

1. Who may be named as a reviewer — the three roles, or any person in the user table?
2. Does one session carry one component or several, and is approval then per component?
3. Where a "changes requested" note lives — only the card's stage word, or also the session's
   conversation?
4. The catalogue pin: a design system's card cannot load until the Tools tab stops forcing the prompt
   composer.

## 2026-11-03 — an approval is a running log, not a button

**The owner's note.** *"These cards may be worked on by different people at different times. The
approval queue should capture that audit log. Approvals are more than a one-time thing — it is a
running log with key activity indicated. An approval is not a click of a button; an approval is a
process of reviewing activity and approving the outcome/output."*

**What this changes.** The queue is the audit log of a card's life: each visit that changes it, each
save, each request for changes and each answer is an event with the person and the time. A later
approval stands after the earlier ones; it does not replace them. The card says what is happening now,
and the review surface says what happened and who did it.

**The test card is `output-footer-area import`.** It is worked on and saved by one person, then
opened and saved by another; the log must name both people and both times, with every answer between
them.

**To do.**

- The card's face carries the latest key activity and the stage.
- The review surface draws the whole trail, newest first, with the person and the time.
- The next save on `output-footer-area import` appends to the same log, not to a new one.

**Where this is recorded.** The requirement is step 8 of `plans/02-APPROVALS.md`, and the rule is
under "The trail is a running log" in `APPROVAL-PIPELINE.md`.
