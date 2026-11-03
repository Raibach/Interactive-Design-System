# The approval flow — its own plan

*2026-11-02. For review. Deferred on your word until the interface is hardened. It lives beside
`design/approval-reviews/APPROVAL-PIPELINE.md`, which holds the flow's earlier detail.*

## What the person sees

A person saves a session. Its card is addressed to a named person. That person opens the card and
the review loads into the console's right column, in the same slot the tabs already swap: what the
session holds, what changed, and two buttons — approve, or ask for changes. Approved, the card comes
back to the designer marked approved. If it was replacing an approved component, the approval
replaces it. Nothing is published by this flow; publication is its own act.

## The two things you have already settled

- **Any person can be a reviewer.** Not three fixed roles.
- **A duplicate is the same name, marked pending.** A component and its pending replacement can stand
  side by side; approving the pending one replaces the approved one. That is a status and a gate, not
  a new kind of object.

## What stands

Nothing of the flow. The saved session, its card, and the reopen are built.

## The steps

*Steps 1, 2 and 4 are built as a RECORD, 2026-11-02 — the endpoints and the table writes. The surface
that a person presses is step 3 and is not built; neither are the catalogue write (5), the pending
replacement (6) or the general queue (7).*

1. **A session records what happens in it.** Every action becomes a row against the session, with the
   person who did it. This is the base the rest stands on, and it is also what Save needs. Proof: two
   presses by one person write two rows carrying the session and the person.
2. **A session can be addressed to a person.** Save writes the reviewer. Proof: the addressed person
   sees the card and no one else does.
3. **The review surface.** **Built 2026-11-02.** The Design rail carries an `Approve` tab; its view
   lists every design session that is not saved, and the selected one's events with two buttons.
   Proven on the running app: the scratch session sent to "Dana Whitfield" appeared as "in review",
   pressing Approve changed it to "approved", and the list row's word followed. The scratch row and
   its events were removed after the test. The view is `rooms/design/review/design-review-view.ts`;
   the list is `GET /api/design/reviews`.
4. **Approve and ask for changes.** Built as a record: `POST …/review` with `action=request`,
   `approve` or `changes` writes the stage into the session's metadata and status and one row into
   `design_surface_events`. Proof taken on a scratch session: saved → in-review (reviewer named) →
   approved, two events with the person and the time; a request with no reviewer refused with 422; an
   approve on an approved session refused with 409; another person's session refused with 404. The
   scratch row and its two events were removed after the test.
5. **The final approval writes the catalogue.** Only this gate writes. Proof: the component is in the
   catalogue with a version row, and Save never wrote one.
6. **A pending replacement.** A change to an approved component becomes the same name, marked pending.
   Proof: both stand in the catalogue, one approved and one pending; approving the pending one leaves
   one approved.
7. **A general queue.** **Built and proven 2026-11-02.** `design_requests` holds a request until a
   person decides: kind, subject, reason, requester, decision, who decided and when, and a note. Three
   endpoints — ask, list, decide — with a decided request refusing a second decision (409) and an
   unknown decision word refused (422). The Approve tab draws the waiting requests beside the
   reviews, with Approve and Refuse. Proven on the running app: a font request for "Arial Rounded MT
   Bold" stood under "Waiting for a decision", Approve recorded the decision and the queue emptied.
   The test rows were removed afterwards. The ingest's missing-face conversation is now this queue's
   caller, and that remains the open half of plan 01 step 5.

## Recommendation

Build step 1 before anything else, because it is not really an approval step: it is the session's own
record, and Save, the review and the audit trail all read it. Then 2 and 3 together. Steps 4 to 6 are
one loop and should be built as one. Step 7 last.

Do not start this until the seats are hardened. The whole flow lands in a right column that is still
two five-thousand-line files.

## Still open

- Where the "changes asked for" note lives — the card's word, or also a message in the session's
  conversation.
- Whether an approval event is visible to every person the session is shared with, or only to the
  owner and the reviewer.
