# The approval flow — its own plan

*2026-11-02. For review. Deferred on your word until the interface is hardened. It lives beside
`design/approval-reviews/APPROVAL-PIPELINE.md`, which holds the flow's earlier detail.*

## What the person sees

A person saves a session. Its card is addressed to a named person. That person opens the card and
the review loads into the console's right column, in the same slot the tabs already swap: what the
session holds, what changed, and two buttons — approve, or ask for changes. Approved, the card comes
back to the designer marked approved. If it was replacing an approved component, the approval
replaces it. Nothing is published by this flow; publication is its own act.

## What an approval is (owner, 2026-11-03)

An approval is not a button press. It is a process of reviewing activity and approving the outcome.
A card may be worked on by different people at different times, and the record must carry all of it:
who opened it, who saved it, what changed, who asked for changes, who answered and when. The queue is
that running log, with the key activity indicated, and it is not a one-time decision that a second
approval replaces. The run of an ingest is part of that log: its steps, its channels and its problems
are a trace against the session, so the person approving reads what happened before any catalogue
write. The same trace is what the Governance application reports; one run, one record, two readers.

The saved card `output-footer-area import` is the test card. It is opened, worked on and saved again,
by one person and then by another; the log must name both people and both times, and no later
approval may hide the earlier one.

## The two things you have already settled

- **Any person can be a reviewer.** Not three fixed roles.
- **A duplicate is the same name, marked pending.** A component and its pending replacement can stand
  side by side; approving the pending one replaces the approved one. That is a status and a gate, not
  a new kind of object.

## What stands

The record, the review surface and the general queue are built and proven; each step says when. The
saved session, its card and the reopen were already built. The running log is the one requirement
this plan now carries that no step below has finished.

## The steps

*Steps 1, 2 and 4 are built as a RECORD; step 3 (the surface) and step 7 (the queue) are built and
proven on the running app. What remains are the catalogue write (5), the pending replacement (6), the
running log (8), the ingest trace (9), the chat's question (10) and the people and their sign-in (11),
which the owner's notes of 2026-11-03 add.*

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
   The test rows were removed afterwards. The ingest's missing-face conversation now calls this queue;
   plan 01 is complete.

8. **The approval is a running log, not a one-time click.** Every change of state appends an event
   with the person and the time, in the same transaction that writes the new state (step 1's rule),
   and a later answer never rewrites an earlier one. The card shows the latest key activity and the
   stage; the review surface shows the whole trail, newest first, with the person and the time of
   each event. Proof: the card `output-footer-area import` is opened and saved by one person, then
   opened and saved by another; the log names both people, both times, and every answer between
   them, and the first record still stands after the second approval.

9. **The ingest's run is an approval trace.** Every step the ingest takes — the REST read, the MCP
   attempt and its absence, the layers, the styled ranges, the fonts, the compile, the person and the
   time — is written against the session as one event with the run's detail. The review draws it as a
   trace, so the person approving sees what happened before any catalogue write. The same entries are
   what the Governance application reports: one run, one record, two readers. Proof: an ingest with a
   missing face and a styled-range gap writes one trace; the review shows every step; the governance
   report names the same job and the same counts.
10. **The chat asks after the trace.** When the run carries problems, the chat asks the person to
    approve anyway or make corrections. Approve anyway is the preview's own approve, recorded with
    the problems it accepted; make corrections is the preview returned to the person with the
    findings, and the next ingest appends to the same trace. Both answers are events, and they lead
    the next actions. Nothing is hidden because it was inconvenient.

11. **People, and how they sign in.** One user per person: an email, a name and a password through
    the signup door, with the email verified; the person signs in with their own email and password.
    The reviewer is addressed by that person; the session's share and the review's answer follow.
    The directory (`GET /api/auth/users`) is admin-guarded, and its guard is a development stub, so
    a picker must not be a public directory of accounts. Proof: a second account signs in, sees the
    card `output-footer-area import`, and answers it.

## Recommendation

Steps 1 to 4 and 7 are built. The last loop is 5 and 6 as one piece — the final approval that writes
the catalogue and the pending replacement — and step 8's running log is the surface those steps are
read through. Step 9 is the ingest's trace in that record, and step 10 is the chat's question over it;
step 11 is the people who answer. The card's face carrying the stage, and sharing and reassignment,
belong to the console plan.

## Still open

- Where the "changes asked for" note lives — the card's word, or also a message in the session's
  conversation.
- Whether an approval event is visible to every person the session is shared with, or only to the
  owner and the reviewer.
