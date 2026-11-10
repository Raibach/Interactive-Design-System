# FOUNDATION — The AI-Native Surface and the Section Template

**Audience: the AI implementing this.** This file is the build contract. Read it before changing any
section. It states the model, the boundaries, the tab rules, the card and seat contracts, the shared
interface, the code to use, the checks to run, and the invariants to hold. It does not argue and it
does not quote anyone.

**Status.** The Design section is the first section built on this model. When it is complete, this
file is the template for Console, Composer, Product, Development, and Governance.

---

## 0. The model

The application is one interface made of pieces. It looks like one page and is several surfaces
loaded in unison and at different times. That is the design: the person never leaves the page; the
piece they need is assembled and loaded when they use it, and kept while they stay.

- **A section is a boundary.** Design is one section. Each top-level tab selects a section.
- **A tab inside a section is a boundary and a filter.** A tab either filters to one job, or filters
  to the index of jobs drawn as cards.
- **A boundary loads its own surface.** The surface carries the filter, the cards that filter
  selects, the chat for that filter, the chat's record, and the tab's state. It is loaded when the
  boundary is used and kept while the person stays.
- **Boundaries do not share rules.** States, conditions, questions and decisions belong to the tab.
  The only thing every boundary shares is the interface: the patterns and the layout.
- **The interface is the pattern; the tab is the condition.** A developer builds from conditions and
  states. A designer builds from patterns and layout. Inside the pattern, states and conditions vary
  by tab, so a rule from one tab applied to another is a defect.

The unit of work is therefore **one boundary surface**, not one page and not one column.

**Each tab is a page, not a panel of one page.** A tab is its own experience with its own code, its
own state and its own lifecycle. It is loaded when the person enters it and unloaded when they
leave, like loading a section of a website. Returning to a tab is a fresh load of that page; what
persists is the record and its conversations in the database, which the page reads again. The
section only looks like one page; nothing of a page's live state survives leaving it, and no page
shares live state with another. The one thing that must match across pages is the interface — the
layout, the sizes, the controls — because that is what makes the separate pages feel like one
application. A page whose chat is a different size from the pattern is a page built wrong, not a
size to be copied from another page.

---

## 1. The boundary surface

**1.1 — One surface per boundary.** A boundary's surface is emitted for that boundary alone. It
carries, in one data model:

```jsonc
{
  "boundary": {
    "id": "design.approve",        // section.tab
    "tab": "approvals",            // the rail tab that stands
    "filter": "approvals"          // the selector this tab applies to the cards
  },
  "session_id": "…",               // the tab's record (package)
  "conversation_id": "…",          // the tab's conversation
  "grace_instructions": "…",       // the tab's words
  "cards": [ /* only the cards this filter selects */ ],
  "active_card": "…"               // the card the tab is working (Approve: the next pending)
}
```

**1.2 — The tree is the boundary's layout.** The surface emits the workspace frame, the left index
(the card grid), and the seat in the right column:

```
workspace-layout
  children.left    → the card grid (an index of the filter's cards)
  children.right   → chat-panel (the seat)
  children.middle  → the tab's own view, when the tab has one
```

**1.3 — The seat is a surface seat.** It is a descendant of the surface. It carries a non-null
`conversation_id` and `session_id`. It aggregates only its own conversation. This is the rule in
`AGENTS-instructions/Core-Concept.md`; it is a structural requirement, not a style.

**1.4 — The host decides only which boundary stands.** The host (the room shell) selects the boundary
and keeps its surface. It does not create seats, hand identities, hand lists, or filter arrays. Those
are the surface's facts. If the host is handing a seat its session, its words, its tab or a filtered
card list, the boundary is split and the fix is the surface, not another prop.

**1.5 — Loading and unloading.** The section's first boundary loads when the section is entered.
Each other boundary loads when its tab is pressed. While the person stays on a boundary, its page
stays loaded. When they leave it, the page is disposed: its live state — the open preview, the typed
draft, the selected row, the scroll of the moment — goes with it. Returning to the tab is a fresh
load of that page, and its record and conversations are read again from the server. A page is never
kept alive behind another tab, and two pages never share live state.

---

## 2. The tab contract

Every tab declares these facts. Nothing about them is inherited from another tab.

| Field | Meaning |
|---|---|
| `id` | the boundary's tab id (`chat`, `tools`, `approvals`, `ux`) |
| `kind` | `job` (one piece of work) or `index` (the console of jobs, drawn as cards) |
| `filter` | how the card index is selected |
| `record` | the `prompt_sessions` row that owns this tab's conversations |
| `words` | the script that defines the chat for this tab |
| `chat_rule` | what the chat does here (read, ask, decide, report) |
| `states` | the states this tab's cards can be in, and the transitions |

### The tabs as they stand

**Chat** — `kind: index`, `filter: all design cards`, `record: design_tab = chat`, `words: the Chat
tab script`, `chat_rule: answer in prose about the cards on the screen`, `states: none of its own`.

**Tools** — `kind: job`, `filter: none (the ingest application is the left column)`, `record:
design_tab = tools`, `chat_rule: help with the ingest and the catalogue`, `states: an ingest produces
a pending approval entry`.

An ingest does **not** write the catalogue and does **not** overwrite an existing component. It
produces a pending approval entry: the draft is held, the entry carries the pending state, and the
catalogue lists it as pending. The live component is untouched.

**The ingest reads every layer and every stated spec, or it fails.** REST and the desktop MCP are the
two readers; the model does not choose what to read and does not interpret a fact in place of reading
it. The result is verified against the measured facts. If any layer is missing or any fact differs or
is not drawn, the run is discarded and retried from the read, five attempts at most. After the fifth
failure the ingest fails as a whole: no preview and no component are presented, and the failure names
every layer and fact that never matched. No partial result leaves the loop, and the fidelity gate
blocks instead of reporting.

**Saving a session keeps its preview.** A saved session must be able to draw what was built without
running the ingest again. Today the draft is a temporary file at `frontend/.preview/<job>/<tag>.ts`,
and the save does not copy it, so the leave/save question says the preview will be lost and the
ingest must be run again — the warning is true, and it is the defect. The save must copy the draft
into a place owned by the session, record its address with the session's record, and the room must
draw that saved draft when the session is reopened. The question then says the drawing is kept.

**The preview carries the design's own facts and nothing about the catalogue.** The drawing, the
declarations, the readings, the annotations, the fidelity report, the steps: everything the ingest
read from the Figma file belongs in the preview. The catalogue is checked in the approval process,
and only there. The name-collision question and its overwrite answers are approval-queue material,
not preview material; the preview does not draw them, and the seat does not hand them to it.

The code for that comparison is kept, not deleted: `component-preview.ts` still holds
`_collisionQuestion` and the `collisions` / `instances` / `collisionAnswer` fields for the approval
to use, and the tool's layer-name fact is no longer drawn in the preview's facts. When the approval
queue is built, it takes the question and the answers; the preview never shows them.

**Approve** — `kind: index`, `filter: entries whose state is pending approval`, `record: design_tab =
approvals`, `chat_rule: the approval walk (below)`, `states: Pending approval → Approved`.

### The approval queue and its log

- The queue holds the pending entries. Each entry is a card in the Approve filter and a row in the
  record.
- **The entry is its own record, never the Tools visit.** An entry must survive the visit that
  produced it: replacing, discarding or resetting a Tools page must not remove an approval. The
  current code ties the card to the saved session, and a Discard answer deletes that session and
  every conversation it owns — the approval disappears with the visit. The entry gets its own row
  and its own conversation; the visit merely creates it.
- The entry's log is a **conversation with its own conversation id**. The ingest's events and the
  approval's events are that conversation's turns. The log is not a side table the chat reads
  around; it is a conversation, exactly like any other.
- Selecting a card in the Approve tab binds the approval chat to that card's log conversation and
  draws the log. The chat answers from the same conversation.
- Approval is what commits: the write, the file, the Figma map, the allowlist and the catalogue
  entry are made when the person approves. Only then is the existing component replaced.
- After the commit, the entry becomes Approved, the record is stamped as last modified, and the
  card is first in the lists.

### The Approve rule

This rule belongs to Approve and to no other tab. Implement it exactly:

```
The tab shows only the entries whose state is pending approval.
The chat takes the next pending entry and:
  1. loads its log — what the ingest did, what it read, what it refused, what it will replace;
  2. asks the person whether to approve it — yes or no;
  3. on yes: commits the entry (writes the file and the registrations, replacing the existing
     component), sets the entry to Approved, and stamps the record;
  4. the card now loads in the Design console as the last modified, so it appears first;
  5. the tab takes the next pending entry and the walk begins again.
```

**UX** — `kind: job`, `filter: none (the analytics program is the left column)`, `record: design_tab
= ux`, `chat_rule: answer about the program and the flows it served`, `states: none of its own`.

The transition is a state change on the card's record, not a local flag:

```python
# The pipeline's states are the record's `metadata.review_stage`.
# Pending = waiting on a person. Approved = the decision.
STAGE_TO_STATE = {
    "in-review": "pending",
    "changes-requested": "pending",
    "approved": "approved",
}

# Approving writes the decision and bumps the record, so ordering by updated_at puts the card first.
# Use the existing review writer: POST /api/design/sessions/{id}/review with action "approve".
# It sets review_stage = "approved" and updates the record's status and timestamp.
```

Do not add a second writer for the decision, and do not store the state on the card alone. The card
is a view of the record.

---

## 3. The card

**3.1 — A card is an index entry for a record.** It carries the fields the grid draws:

```python
{
  "id": "<record id>",            # the package the card opens
  "title": "…",
  "description": "…",
  "category": "Design System",    # the classification
  "status": "Pending",            # THE STATE — drawn in the footer beside the version
  "status_color": "#8BE0A4",      # the state's colour, emitted with the state
  "version": 1,
  "likes": 0,
  "createdAt": "…",
  "lastUsed": "…",
}
```

**3.2 — The footer word is the state.** The slot beside `Version 1 |` draws `status`. It is not a
description of the card's kind. Do not write a word there that describes what the card is; write the
state the record is in. A design system card wears the record's own state (`Active`); a card in the
approval pipeline wears `Pending` or `Approved`.

**3.3 — The state and its colour are data.** The backend emits both; the card draws both and knows no
state's name:

```python
# backend/routes/design_console.py
CARD_STATES = {
    "in-review": ("Pending", "#8BE0A4"),
    "changes-requested": ("Pending", "#8BE0A4"),
    "approved": ("Approved", "#5FD688"),
}

# the session card's state
_stage = str(_meta.get("review_stage") or "")
_state, _state_color = CARD_STATES.get(
    _stage, (str(_row.get("status") or ("Saved" if _kept else "Open")), "")
)
```

The card element takes `status` and `status-color`. The footer:

```ts
<div class="version-text">Version ${figures(String(Math.min(v, 99)))} |</div>
<div class="status-text ${safeStatusColor ? 'stated' : ''}"
     style=${safeStatusColor ? `--status-color: ${safeStatusColor}` : ''}>${safeStatus}</div>
```

```css
.status-text { color: rgba(31, 172, 194, 0.35); }
.status-text.stated, .card:hover .status-text.stated { color: var(--status-color); }
```

**3.4 — The filter is the category.** The approval cards carry the `Approvals` category, so the index
can select them by one field. The category is a row in `categories` and carries the label and its
colour. The state is the progress; the category is the classification. Never infer one from the
other.

**3.5 — A card with no state of its own is not given one.** A design system's state is its record's
status. A session outside the pipeline wears its recorded status. Do not invent a state to fill the
slot.

---

## The list rule

One rule governs every list in the application, without exception:

- **Order.** Last modified first, then last created, newest first. No list is ordered by name, key,
  alphabet, or insertion.
- **A write stamps the record.** A save, an approval, a turn, a rename: the write sets the record's
  `updated_at`. That stamp is what makes the record first on the next read; a list cannot be
  ordered by last modified if the writes do not set the time.
- **Re-read after the write.** A list drawn from a snapshot taken before the write is stale. After a
  write that changes a list, read the list again; do not trust the copy already in the page.
- **What obeys it.** The catalogue's elements, the sessions, the cards, the conversations, the
  approvals. One rule, every list.

Code:

```sql
-- every catalogue read
ORDER BY updated_at DESC NULLS LAST, created_at DESC
```

The three reads are in `backend/routes/ai.py`, `backend/routes/design_console.py`, and
`backend/routes/tools_surface.py`. The commit stamps the element row in `backend/routes/figma.py` so
a re-approval moves it to the front.

---

## The leave question

**The rule.**

- Leaving a tab always succeeds and is immediate. The page unloads, its live state goes with it, and
  the room moves to the pressed tab. Nothing holds the navigation.
- The page reports whether anything changed since it loaded.
- With no change: no question, no warning. The person leaves, and the page resets.
- With a change: a warning is shown that names what changed. The warning does not gate the
  navigation; leaving still happens. Save (the session becomes a card) and Discard (the record and
  its conversations are removed) are actions on the record, not conditions for leaving.
- Leaving without acting keeps the record as it is. A plain leave never destroys work.

**The baseline.** The page captures its baseline when it has finished loading — the record bound,
the form seeded with the record's own values, the screen restored. The comparison at leave is
against that baseline, never against an empty or pre-seed state.

**What counts as a change, per page.** The page answers; the host does not decide.

- **Tools:** the form's fields differ from the baseline; a person's turn was spoken in this visit;
  the screen (table filter, box heights) differs from the baseline; a draft produced in this visit
  is undecided. A component merely opened from the catalogue is **not** a change.
- **Chat:** a person's turn spoken in this visit, and a draft in the composer if losing a draft
  silently is not acceptable for that page.
- **Approve:** a decision in progress. A pending card that the person only read is not a change.

**The plan to make it true.**

1. **Unblock the navigation.** In `DesignSeatShell.onTabChange`, move the room to the pressed tab
   first. Ask the standing page for its change report and show the warning after the move; never
   await an answer to navigate.
2. **Fix the Tools change test.** `ToolsSeat`'s `holdsWork` counts any standing preview. Count only
   a draft made in this visit — a preview whose source is the ingest and whose job is undecided —
   and never an opened catalogue component.
3. **Move the baselines.** The form baseline is captured after the record's values are seeded; the
   screen baseline after the screen is restored. Verify the order for a reopened session.
4. **Per-page words.** The warning names the page's own change; there is no generic sentence.
5. **Verify.** Leave with no change: no warning, page reset. Leave after a typed field: warning,
   page reset, record kept. Leave after an ingest draft: warning. Leave after only opening a
   component: no warning. Leave and return: the record and its conversations are read again.

---

## 4. The seat (the chat)

**4.1 — The four parts.** A tab's chat is four parts, and none of them is shared with another tab:

| Part | What it is |
|---|---|
| record | the tab's `prompt_sessions` row and the conversations that hang off it |
| words | the tab's script, emitted by the surface |
| conversation file | the module that lists, reads, moves, removes and creates the tab's threads |
| page file | the element that renders the seat (a surface descendant, not a host) |

**4.2 — The send contract.** Every tab sends the same request shape; only the record, the
conversation and the words differ.

```ts
POST /api/teacher/query
{
  question: <the person's words>,
  context: <the tab's words>,
  mode: "chat",
  person_turn: true,
  session_id: <the tab's record>,
  conversation_id: <the tab's conversation>,
  headers: { "X-User-ID": <user>, "X-Package-Session": <record>, "X-Conversation-ID": <conversation> }
}
```

The server writes both turns. The page does not write them a second time. The reply is drawn in the
tab's thread and survives a reload.

**4.3 — The conversation module.** One module per tab, a plain module that takes the seat as `this`:

```
listForPackage        read the record's conversations, newest first
readPackageConversations  store the list; adopt the newest when the bound id is not in it
loadHistory           read the open conversation's turns; a denial is drawn, never shown as empty
belongsToPackage      refuse a conversation the record's list contradicts; an unread list is not a contradiction
moveSeatTo            move the seat; remember the row's tab
selectConversation    a person picked a row; point the record at it
removeConversation    remove one; if it was on screen, move to the next live row or to none
createPackageConversation  create the record's next conversation and move there
```

The module does not import another tab's conversation module.

**4.4 — The seat resolves its own record.** In order:

1. the row the seat's own assembly states at `session.design_session_id`;
2. the tab's entry in the surface's package map.

A change in either re-enters the record: the thread clears and the new conversation's history loads.

**4.5 — Guards.** These are per-seat decisions, not global laws:

- A seat with no words refuses the turn and says why. No fallback to another tab's words.
- A send does not change the tab when the room owns the rail. The governance rule that moves a send
  to the Chat tab belongs to the governance seat; it is not applied here.
- A refusal or a failure is written where the person is reading, with its reason. No silent return,
  no empty answer.
- No delay is put in front of a read. The read answers or says why.
- The composer is cleared through the drawn control's own `clear()`, never by writing its value from
  outside.
- No comment sits inside an opening tag. A comment between attributes ends the tag and turns every
  binding after it into text.

**4.6 — Events.** The seat and the room exchange only these:

```
tab-change            a tab was pressed; the host decides what stands
collapse-toggle       the active tile was pressed; fold or unfold
conversation-change   the seat moved to another conversation
conversation-select   a person picked a conversation
send-input-to-model   Send was pressed
stop-model-thinking   stop was pressed
message-sent          a turn was submitted by another path
value-input           the draft changed
a2ui:person-turn      a person's turn was written
a2ui:usage            a call's measured cost
```

---

## 5. The interface pattern (shared by every tab)

This is the only shared part. Implement it once per section; do not fork it per tab. A tab changes
the data and the rules, not the interface.

### 5.1 The column

- One page per boundary. The page is created when the boundary is entered and disposed when it is
  left; the next entry is a fresh load, and its data is read again from the server. No live state of
  a page survives leaving it.
- The rail is 74px. The drag strip beside it is 30px. The column's floor is 104px. The load width is
  700px. The left column's floor is 60px. A drag is read from the pointer, not from accumulated
  travel. These are the pattern's numbers: every page draws its chat at the same size, so moving
  from one tab to another never changes the chat's size.
- Pressing the active tile folds the column to its rail; the panel is hidden, not destroyed.
- The panel holds, in order: the readout, the conversations bar, the response card, the input stack.

### 5.2 The rail

- Draw only the tabs the boundary allows, in the boundary's order.
- A disabled tab stays visible and cannot be pressed.
- The lit tile is the tab whose surface stands. The host owns the rail: the press announces
  `tab-change`; the seat does not switch itself.
- The Chat mark pulses when a message waits and the column is folded; the Approve mark shows a
  waiting approval. Neither opens the column by itself.

### 5.3 The readout

- First block of the panel, always drawn.
- Fixed 55px box; two lines with an ellipsis; minimum 55px.
- A five-dot band under it, 7px tall, visible.
- A press opens it to its full height and a second press closes it; a press clears a height a drag
  wrote.
- A drag on the band writes the box's height; the box follows the hand until the neighbours' room is
  spent, read once at the press.
- The line is the seat's facts: the status text, and the usage of the open conversation or
  `unattributed`. Never person or session totals. No delay in front of the read.

### 5.4 The conversations bar and card

- The bar carries the record's live conversation count, the history mark, and the new control.
- A press on the bar, or Enter, or Space opens and closes the card. Only the bar toggles.
- The resting card is the bar, 38px; open, it takes the rows' height. The rows are always inside it.
- The five-dot band under the bar resizes the card; a first downward drag reads the list.
- A row opens its conversation and shows its title and saved time. An archived row stays reachable
  and wears its chip.
- Removing a row takes two presses: the first arms, the second removes. The row on screen can be
  removed; the seat moves to the next live row or to none.
- The new control creates the record's next conversation, points the record at it, and moves there.
- An empty record says it has no conversations. A failed list operation says its reason in the card.
- The open list holds two whole rows (65px) before it scrolls.

### 5.5 The response card and the thread

- The card fills the room between the conversations bar and the input; minimum 75px; one scroller.
- The thread opens at its newest turn; a stored position wins; a run's result opens at its head.
- Turns are drawn as: the person's words, prose, an alert, a result.
- A wait is drawn with its stage and elapsed seconds. The stop control aborts; the thread says
  `Stopped.` A turn that fails says why. A reply with no prose draws no empty bubble.
- Empty, refused and denied are three different states and are drawn differently.
- A tab's own view may replace the thread inside the same card; the thread returns when the view is
  gone.
- The column draws its own 4px scrollbar, only when the content overflows.
- The usage figures belong to the open conversation.

### 5.6 The input stack

- Order: the controls bar, the input area, the footer.
- Send is one pill: 127px wide, 35px tall, radius 6, white at half opacity, the drawing's shadow,
  the send mark and the word Send.
- Send is disabled with no text. While a turn is in flight it becomes stop and raises
  `stop-model-thinking`.
- The trailing pill is the tab's own (Agent or Console) and opens that thing.
- The divider between the bar and the input is a drag handle only: no click, no toggle. It is a 15px
  strip with a 27px catch area, the resize cursor, and no text selection.
- The input area's floor is 80px. A drag writes its height up to the neighbours' room, read once.
- The text control's placeholder is `chat input`. Enter sends, Shift+Enter inserts a line, an input
  method's Enter does not send.
- The button and the keyboard take the same path: one send method, one set of gates, one clear.
- The footer is a card with its own grip; its height never exceeds 100px and its growth comes from
  the input, so the pair moves together.

### 5.7 The grips

- Every grip does one thing: it grabs its box and moves it. One band per box. No click, no role, no
  toggle.
- The pointer is the edge: the box's height is computed from the pointer and the grab offset taken at
  the press.
- A drag stops at the room the neighbours can give, read once at the press.
- A box's Default is its card's declared minimum plus the block's chrome; a press on the readout
  returns it to the Default.
- A subclass must call the parent's first draw; the parent's first draw is what attaches the grips.
- The wiring retries while a band is missing.

### 5.8 Names

The separator is `Resize the chat column`. The input divider is `Drag to resize the input area`. The
card's grip is `Drag to resize the output above`. The conversations bar is `Show this package's
conversations` and reports expanded. The new control is `New conversation`. The row's remove is
`Remove this conversation`, then `Confirm remove`. Send is `Send input to model`. The field is `chat
input`.

---

## 6. Measured faults and the guard each left behind

Check each of these before declaring a boundary done.

| Symptom | Cause | Guard |
|---|---|---|
| The composer showed handler code; Send did nothing | a comment sat inside the opening tag and the bindings became text | no comment inside an opening tag; press Send and read the request |
| The tab had no session on a cold load | the section's assembler did not resolve that tab's record | resolve every tab's record on every assembly; the map is never partial |
| A card-opened visit spoke in the tab's own thread | the seat read the package map but not the session its assembly stated | the stated session first, the map second |
| The session question could not be clicked | the dialog was drawn beside the stage and lost the stacking order | draw it at the document root |
| A send moved the person to the Chat tab | a governance rule was applied to a seat that owns its own tab | the guard is per seat; no rule is global |
| A card's footer said `catalogue` | a label was written where the state belongs | the footer is the state; the state is data |

---

## 7. Build order for a section

0. **Move, do not rewrite.** When working code lives in the wrong boundary, add the new path beside
   it, verify the new path, switch to it, and only then remove the old one. The working path stays
   in place as the reference while the move is in progress. Never rip out a path that works, and
   never leave two live paths after the switch.
1. **Define the boundaries.** List the section's tabs: id, kind, filter, record, words, chat rule,
   states. A tab with no rule of its own is not a boundary.
2. **Emit one surface per boundary.** The data model carries the filter, the cards it selects, the
   seat identity, the words, and the active card.
3. **Put the seat inside the surface.** A surface descendant with its own conversation and session.
   Remove host mounting and prop hand-offs for that boundary.
4. **Load on use and keep.** The section's first boundary loads on entry; each other boundary loads
   on its press and stays.
5. **Cards as data.** The state and its colour, the category and its filter, derived from the record.
6. **The tab's rule.** The Approve walk, the Tools save, the Chat answers, the UX report: each in
   its own surface, never in a shared branch.
7. **The interface pattern.** The shared components as listed in section 5, unchanged per tab.
8. **Verification.** Section 8, before anything is called done.

---

## 8. Acceptance tests

Run these in the running application.

1. **Boundary load.** Press the tab. Its own cards are the left column; its own conversation is the
   right column; its own words are what the chat speaks.
2. **Boundary isolation.** Two tabs never show each other's cards, threads or states.
3. **The round trip.** Type a turn, press Send with the mouse. The request returns 200; the turn and
   the reply are drawn; the composer is empty; Send is available again. Reload: the turn and the
   reply are still there.
4. **The tab stays.** After a send, the lit tile, the standing surface and the seat's tab are still
   the tab that was pressed.
5. **The boxes.** The readout opens and closes; the conversations card opens, closes, and its rows
   open; each band drags its box and stops at the neighbours' floors; the input and footer move as a
   pair; the scroll thumb appears only when the content overflows.
6. **The entry.** An ingest produces a pending entry. The catalogue lists it as `Pending approval`
   in green. The live component is unchanged: no file, map, allowlist or catalogue entry was
   written. Closing and reopening the tab still shows the pending entry.
7. **The log.** Selecting the pending card binds the approval chat to that entry's log conversation
   and draws what the ingest did — what it read, what it refused, what it will replace. The log is a
   conversation with its own id, and the chat answers from it.
8. **The walk.** Press Approve: the next pending entry is taken. The chat states the change and asks
   yes or no. On yes, the commit runs — the file and the registrations are written and the existing
   component is replaced. The entry becomes `Approved`, the record is stamped, the card is first in
   the Design console, and the next pending entry follows.
9. **The session question.** Leaving a tab with work draws the question at the root; all three
   answers can be clicked; Accept keeps the session and the room moves.
10. **The list rule.** After the approval, every list that shows the record reads again and the
    record is first: the catalogue, the console's cards, the approvals.
11. **Failure is visible.** With the server stopped, a send says why in the thread; nothing is drawn
    as an empty success.

---

## 9. Current state — what is met and what is not

**Met in Design, verified by the round trip:** the Tools and Chat seats send and answer, persist
their turns, bind their own records, stay in their own tab on send, and draw the shared interface;
the session question is selectable; the five faults in section 6 carry their guards.

**Met in the data, verified by the backend's own record:** every catalogue read is ordered by last
modified and then created; the approval stamps the element row so a re-approval is first; the card's
footer draws the record's state with its colour.

**The approval split is not met.** The ingest's approve still commits immediately: it writes the
files and the registrations and replaces the existing component. The required flow is stage first,
then commit on approval. The existing commit stays where it is and keeps working while the queue is
built beside it; it is not removed until the queue path does the same work.

**Not met yet:**

- **The surface.** The seats are still host elements mounted outside the surface, with the section's
  assembler and the room shell handing identities. This is the structural item that everything else
  depends on.
- **The pending entry.** An ingest does not yet produce a pending approval entry; it approves
  without a queue.
- **The approval log as a conversation.** Each entry does not yet have a conversation of its own,
  and selecting a card does not bind the approval chat to it.
- **The filter.** The left column is not filtered per tab; the Approve tab still draws a review list
  in the right column.
- **The Approve walk.** The log, the yes/no question, the commit from the chat, and the next pending
  entry are not built.
- **The Approvals category.** The category row and its label and colour are not built; the state
  (`Pending approval` / `Approved`) is.
- **UX** has its own view, words and turn, but reads through the shared conversation file.
- **Executions and Settings** are not separate boundaries.

---

## 10. Invariants — instructions to keep

1. Do not quote a person in a document. State the rule.
2. Do not add a rule to one tab and apply it to another. The interface is shared; the conditions are
   not.
3. Do not hand a seat its identity, its list, its words or its filter from the host.
4. Do not invent a state, a label or a category. States and categories are data on the record.
5. Do not special-case a category or a state in a shared component. Emit the colour and the word
   with the data.
6. Do not write a fallback, a delay, a made-up record, or a silent catch. A failure is said where the
   person is reading, with its reason.
7. Do not clear a control by writing its value from outside; use the control's own writer.
8. Do not put a comment inside an opening tag.
9. Do not call a boundary done from its look. Run the round trip and the boundary tests.
10. Do not build the next section until this one is complete. This section is the template.
11. Do not rip out working code to move it. Add beside it, verify the new path, switch, then remove
    the old one.
12. Do not treat a section as one page. Each tab is its own page with its own code and state; it is
    loaded on entry and disposed on leave. The interface is the only constant, and every page draws
    it at the same size.
