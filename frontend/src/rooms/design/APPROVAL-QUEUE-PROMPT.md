# APPROVAL QUEUE — Build Prompt

> **Superseded for the current state by `HANDOFF-PROMPT.md`.** Read that first. The separate
> pending-entry record and the separate log conversation described below are not to be built;
> the `design_session` row is the entry and its conversation is the log.

You are continuing a build in this repository. Read `frontend/src/rooms/design/FOUNDATION.md`
first. It is the source of truth for the architecture, the boundaries, the card and seat
contracts, the shared interface, and the invariants. This prompt adds the approval queue's plan;
where the two differ, the foundation wins.

Work in small steps. Do not rip out working code. Do not quote anyone in documents. Do not report a
step as done from its look; verify it.

---

## 1. The state you are starting from

**Working, verified:** the Design room's Chat and Tools seats send turns, answer, persist them,
bind their own records, stay in their tab on send, and draw the shared interface. The session
question is selectable. The catalogue lists are ordered by last modified, then created, newest
first. The approval stamps the element record, so a re-approval is first.

**Working code that stays in place:** the ingest's approve path. `ToolsSeat.onPreviewApprove` calls
`POST /api/figma/commit`; the commit writes the component's file, the Figma map, the allowlist and
the catalogue entry, and replaces an existing component. This is the code to reuse for the
approval's commit, and it is not removed until the queue path does the same work.

**Data that already exists:**

- `figma_ingest_activity` — one row per ingest event: `kind` (`ingested`, `approved`, `discarded`),
  `job_id`, `node_id`, `tag`, `written`, `verdict`, `reason`, `at`, `session_id`, `session_title`.
- `design_element_activity` — the registration trail: `element-registered`, `layers-registered`.
- `prompt_sessions` — rows with `metadata.session_type` in `design_tab`, `design_session`,
  `design_catalogue`, `design_master`; `metadata.review_stage` holds the review state
  (`in-review`, `changes-requested`, `approved`).
- `conversations` and `conversation_messages` — the conversation store.

**Not built:** a pending approval entry, a log conversation per entry, the approval queue's filter,
the approval chat, the selection that loads a card's log, and the commit from the approval. The
Approve tab still draws the review list in the right column.

**Known facts to respect:**

- The ingest's draft is temporary. Confirm its lifetime and where the files live before you decide
  how a pending entry keeps its work.
- The commit is the only writer of the catalogue. Do not add a second writer.
- The review endpoint `POST /api/design/sessions/{id}/review` exists with actions `request`,
  `approve`, `changes`; it writes `review_stage`.

---

## 2. The model you must hold

- A section is a boundary. A tab is a boundary and a filter. The boundary's surface carries the
  filter, the cards it selects, the chat, the record and the words. It loads when the tab is used
  and stays.
- No rule is global. The interface is shared; the tab's conditions and states are its own.
- The approval log is a conversation with its own conversation id. The ingest's and the approval's
  events are that conversation's turns. It is not a side table the chat reads around.
- States are data: `Pending approval` and `Approved`. The card's footer word beside the version is
  the state. The category is `Approvals`, with its own label and colour.
- Every list reads last modified, then last created, newest first. A write stamps the record. A list
  is re-read after a write.
- Do not hand a seat its identity, list, words or filter from the host. Do not create a second live
  path.

---

## 3. The goal

The process, end to end:

1. A person ingests a Figma element. The ingest produces a **pending approval entry**. Nothing is
   written to the catalogue and no existing component is replaced.
2. The entry appears as a **card in the Approve tab**, in the `Pending approval` state, with the
   `Approvals` label and colour. The live component is untouched.
3. The entry has an **audit log**, and that log is a **conversation with its own conversation id**.
   It holds what the ingest did: what it read, what it refused, what it produced, what it would
   replace.
4. Selecting the card in the Approve tab **binds the approval chat to that entry's log** and draws
   it.
5. The chat **asks whether to approve**, yes or no.
6. On yes, the **commit runs**: the file and the registrations are written, the existing component
   is replaced, and the entry becomes `Approved`.
7. The record is stamped, so the card is **first in every list** — the Design console's cards and
   the catalogue.
8. The Approve tab takes the **next pending entry** and the walk begins again.

---

## 4. The plan

Each step says what to produce, where, and how to verify it. Do one step at a time.

### Step 0 — Read and confirm

Read `FOUNDATION.md`. Confirm the current state in the code and the database before changing
anything. Do not remove the working ingest approve.

Evidence to collect: the ingest's draft location and lifetime; the commit's writes; the activity
rows for one ingest.

### Step 1 — Define the pending entry

Decide and record, with evidence, the entry's record and the draft's durability. Two decisions:

- **The entry's record.** One row per pending entry that holds: the state, the draft's address, the
  Figma source (file key, node id, name, tag), the intended replacement, the actor, the time. Use
  the package model: a `prompt_sessions` row with a `session_type` for the entry (for example
  `design_approval`) and its metadata, or the existing `design_session` row with the pending state.
  Pick one and state why.
- **The draft.** The draft must survive until approval. If the ingest's folder is deleted with the
  preview, hold a durable copy with the entry, or store enough to re-ingest at approval. State
  which one and its consequences.

Verify: create one entry from a real ingest; read it back; it holds the source and the draft; the
catalogue is unchanged.

### Step 2 — Create the log conversation

Create one conversation for the entry, with its own conversation id, and write the ingest's events
into it as turns.

- The conversation belongs to the entry's record.
- The events come from `figma_ingest_activity` for the job and the session, and from the registration
  trail.
- Every event is a readable turn: what happened, what was read, what was refused, what was written,
  what will be replaced.
- Do not invent a parallel log table for the chat to read around.

Verify: the entry has a conversation id; the conversation's turns match the activity rows; reading
the conversation returns them in order.

### Step 3 — The Approve boundary

Emit the Approve boundary's surface. It carries:

- the filter: the entries whose state is `Pending approval`;
- the cards: one per entry, with the state, the label and the colour;
- the seat: the approval chat, bound to the selected entry's log conversation;
- the words: the approval chat's own script;
- the active entry: the next pending entry.

The boundary loads when Approve is pressed and stays. Do not draw the review list in the right
column; the queue is the cards and the chat.

Verify: pressing Approve shows the pending cards in the left column and the approval chat in the
right; the Design console is unchanged.

### Step 4 — Selection

Selecting a card binds the approval chat to that card's log conversation and draws the log.

Verify: two different cards load two different logs; the chat's next turn is written into the
selected card's conversation, not another's.

### Step 5 — The walk

In the approval chat:

1. State what the ingest did, from the log.
2. Ask yes or no.
3. On yes, run the existing commit — the same writer the ingest uses, with the entry's job, tag,
   replacement and patterns.
4. On success: the entry becomes `Approved`, the record is stamped, the card is first in the lists.
5. Take the next pending entry.

Do not add a second commit writer. Do not write the catalogue from the chat's own code.

Verify: approve one entry; the file and the registrations are written; the existing component is
replaced; the state and the timestamp are right; the card is first; the next entry loads.

### Step 6 — The card's state and category

- The footer's word beside the version is the entry's state.
- `Pending approval` and `Approved` carry their colours from the record, not from the component.
- The `Approvals` category is a real category with its label and colour; the filter selects it.

Verify: a pending card reads `Pending approval` in its colour and carries the Approvals label; an
approved card reads `Approved`; the live design-system cards keep their own state.

### Step 7 — The filter and the lists

- The Approve tab's left column shows only the approval entries.
- The Design console shows all design cards, with the approved entry first as the last modified.
- The catalogue list is re-read after the approval, newest first.

Verify with the acceptance tests in `FOUNDATION.md`, plus the four queue states: pending, approved,
selection, and next.

---

## 5. Constraints

1. Move, do not rewrite. The working ingest approve stays in place. Add the queue beside it, verify
   it, switch, then remove the old path. Never two live paths after the switch.
2. One writer for the catalogue: the existing commit. The queue calls it; the queue does not write
   the files or the rows.
3. The log is a conversation. One conversation per entry, with its own id.
4. States and colours are data. No component knows a state's name.
5. Every list is last modified, then created, newest first. A write stamps the record; a list is
   re-read after a write.
6. No global rules. The approval's conditions belong to the approval boundary.
7. No fallbacks, no delays, no silent catches. A failure is said where the person is reading, with
   its reason.
8. No comment inside an opening tag. No clearing a control by writing its value from outside.
9. Do not quote anyone in documents. State the rule.
10. Do not report a step done from its look. Run the round trip and show the evidence.

---

## 6. What to report

For each completed step: the files changed, the code path, the rows written (table and ids), and the
acceptance test that passed. For each step blocked: the exact fact that blocks it, with the evidence,
and the decision needed.
