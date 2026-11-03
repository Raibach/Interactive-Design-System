# The approval process — the three gates, and the records they keep

*Moved here 2026-11-01, on the owner's instruction that the approval process belongs at the top level:
"these are eventually going to be added to the system. They may eventually override an existing design,
but before that they have to go through an approval process, and that approval process is also in this
repo — it should be at the top level." It was `console/approvals/APPROVAL-PIPELINE-2026-10-31.md`.*

**This folder is the approval process's home.** The two reference applications the owner supplied for
comparison are here too (`processmaker-develop.zip`, `Agentic-opensource/`); the analysis of both is in
the appendix of this file, and the recommendation is our own three gates, not theirs.

**What this document is.** A plan. Nothing in it is built: the tables, the doors and the review surface
are specified, and every claim carries the verification mark it had when it was written. The running
record of what changes belongs in [`CHANGELOG.md`](./CHANGELOG.md), beside this file.

---


*Written 2026-10-31, on the owner's direction, and filed here so the Console's folder holds the
Console's work. This is a plan. Nothing in it is built.*

*Revised the same day, after two corrections from the owner: the application he supplied is a
reference point and not a model (`console/approvals/APPROVAL-PIPELINE-2026-10-31.md`, appendix),
and the right-hand column is an output surface rather than a conversation
(`design/ONE-CHAT-PER-TAB.md`). Both corrections are folded in below.*

---

## What the user does

1. The designer ingests a Figma component. The preview appears exactly as it does today, in the
   temporary folder. Nothing is stored, and the designer reads the measured values there.
2. The designer presses Approve. Instead of the component entering the design system, the preview
   is copied into a draft that can be handed to someone else. The preview then lives and dies by
   its usual rule.
3. The designer names a person and sends the draft for review.
4. That person signs in. One card stands on their console, and its status tag reads the stage it
   is in. They press **Approve** on the rail, and the column beside the cards becomes the review:
   the identical ingest result, its measured values, its comparison, its generated code, and the
   buttons that decide it.
5. They approve it, or they ask for changes. Either way it returns to the designer.
6. The designer opens it again in their own tab's column and gives final approval. That is the
   moment the component enters the design system: the file is written, the registrations are
   made, the catalogue check runs and its verdict is shown.

Three gates, one reviewer hop. Nothing enters the Lit catalogue before the last one.

**The owner's own words, 2026-10-31:** *"When I say nothing enters the database, what I really
mean is nothing gets committed to the catalog. It doesn't become a permanent process… it holds
previews inside of a temporary folder that's for the designer to validate it, and then once the
designer approves it, instead of adding it to the lit catalog, we're gonna add it to this flow."*

## Where it happens — the surface, and no dashboard

The owner's rule: *"I don't want a separate approval dashboard. I want it integrated directly into
our flow and we use the approval button on the navigation and we use the AI's interface output
area as a dynamically loading surface."*

Everything below that is already true in the code, and is why this flow needs no new screen:

- **The card already draws a status word.** `agent-card-element.ts:575` renders `.status-text`
  from the row's status, and `.status-text.completed` already has its own green (`:338`). The
  console hands the card `status` from the package row (`backend/routes/ai.py:1337`). The stages
  become words in that place. No new shape on the card.
- **The right column already loads a view per tab.** The console's surface declares
  `children: {view: "repair-view"}` (`ai.py:1379`), and the seat switches what stands in that slot
  by the tab pressed — `case 'approvals': return 'chat-repair-actions'`
  (`frontend/src/rooms/console/console-chat-panel.ts:1698`). The review is another view in that
  same slot. It is not a page and not a route.
- **The column resizes and folds on its own.** It holds its drag edge (`design-chat.ts:1622`,
  `:1671`) and its grips are the red dot rows measured in `design/ONE-CHAT-PER-TAB.md`.
- **A modal is used only where something must be signed.** The owner: *"we might need to show a
  modal pop-up for some kind of signature process."* A signature is a deliberate act with a date
  and a name attached, so it earns a panel that stops the person. Ordinary approval does not.

## The seven things standing in the way, measured

**1. The right column is one seat shared by five tabs, so an approval surface built there would
appear in all five.**
`frontend/src/rooms/design/chat/design-chat.ts` is one file of 295 KB serving Chat, Tools, UX,
Executions and Settings. The seat's name `chat-panel` is also registered for every page
(`components/lit/register.ts:82`), mapped by the renderer (`a2ui-renderer.ts:240`) and still named
in the catalogue (`shared/tag-registry.ts:120`), and the Design console's own assembly prompt asks
for it (`backend/routes/design_console.py:391`) while the client quietly swaps in the room's
`design-chat` (`design_console.py:425-431`). **This is why the split comes before any approval
work.** The full record is `design/ONE-CHAT-PER-TAB.md`.

**2. The preview is the only copy, and there is deliberately only ever one.**
`ingest_drafts` and `ingest_job_meta` are ordinary in-process dictionaries (`figma.py:770`,
`:772`). `_remember_drafts` (`:1092`) drops every earlier preview the moment a new one is held, and
quotes the owner: *"There is never more than one draft. The draft is the preview."* The folder is
`frontend/.preview/<job>` (`:932`), removed on discard, on abandon (`:5944`) and by the sweep
(`:1068`). No other person, no other server process and no restart can open the result. The fix is
not to change the preview's life. It is to copy at the first approval.

**3. The approve button is the catalogue write.**
`frontend/src/components/IngestModal.tsx:1012` sends the job to `POST /api/figma/commit`. That
route reads the drafts from memory (`:7619`) and the measured rows from the job id (`:7630`).
There is no point in that path where a person can say "send this to someone first". The gate is
right; it is in the wrong place for a review flow, and it belongs at the final approval, where it
already is.

**4. Nothing in the system has ever been pending.**
All 339 package rows are `status = 'Active'` (measured 2026-10-31). The card can draw a stage but
no row has ever held one. `promotion_queue` and `quarantine_items` exist and are empty, and both
mean something else: one promotes a memory, the other holds a threat.

**5. Another person cannot see the card.**
The console's card query is owner-or-shared (`prompt_sessions_api.py:821-823`, `:865-867`).
`session_permissions` holds 240 rows and all 240 are `owner`. A grant route exists
(`backend/routes/prompt_sessions.py:997`) but it needs a package row to hang from, and no package
row may exist before the component is committed. Sharing permissions must not be pressed into
service here: a permission row on a package would make a draft look like a package.

**6. There is no activity to narrate.**
`prompt_history` is empty. `audit_logs` holds 1,983 rows and every one is a chat query.
`figma_ingest_activity` holds 619 real ingest rows, but they hang off a design session, not a
draft, and nothing writes them at review time.

**7. The list of people to send to is open to everyone.**
`GET /api/auth/users` is guarded by `user_is_admin`, which returns true for every caller while
`ADMIN_ROLES` is unset (`backend/deps.py:298-302`). That is a directory of every account. It must
be closed before a picker uses it.

**A wrong comment, worth naming.** `figma_facts.py`'s own note says the measurement lives under
`backend/logs/figma-facts/`; the code sets it to `frontend/.preview` (`figma_facts.py:28`). Both
readings are ephemeral, so the conclusion stands, but the comment is wrong.

## The records I recommend — the trail is the truth

Two tables. Neither commits anything to any catalogue.

### `design_drafts` — one row per designer's first approval

| column | what it is |
|---|---|
| `id` | the draft's own identity |
| `job_id` | the preview's job id, kept so a draft can be traced to the ingest that made it |
| `title` | what the card says |
| `figma_file_key`, `figma_node_id` | where the design was read from |
| `target_tag`, `pattern_tags`, `overwrite_tag` | exactly what the designer ticked |
| `payload` | the generated code per pattern, the measured rows, the validation, the collisions |
| `payload_hash` | so the reviewer's surface and the designer's preview can be shown to be the same |
| `state` | `in_review`, `changes_requested`, `approved`, `committed`, `withdrawn` |
| `waiting_on_user_id` | the one person who may move it now, or null |
| `submitted_by` | the designer |
| `created_at`, `updated_at` | |

### `draft_reviews` — append only, and this is the log Grace reads

| column | what it is |
|---|---|
| `id` | |
| `draft_id` | |
| `at` | the moment |
| `actor_user_id` | who |
| `gate` | `designer-ingest`, `stakeholder`, `designer-final` |
| `decision` | `requested`, `approved`, `changes_requested`, `rejected`, `committed` |
| `note` | what the person wrote |

### The one rule that keeps the two honest

**The state is written only by the transaction that appends the event.** One function moves a
draft: it checks that the actor is the person the draft is waiting on, it appends the review row,
and it writes the new state and the new waiting person — all in one transaction. Nothing else may
write `state`. So the trail and the state cannot part, and "what is waiting for me" is a read of
one indexed column rather than a reconstruction of history.

### Why this shape, and not the reference application's

The owner supplied ProcessMaker as an example and then released it: *"you don't even have to use
their flow … it may be inferior to something you could create from scratch."* Three differences
decide it:

- **Their engine interprets a written route at run time.** Our route is known at build time and is
  three gates in a fixed order, so it lives in code. A written route would be a second place
  stating the same thing, and the two would eventually disagree.
- **Their record answers "what state is this in?" twice**, once on the case and once on each step.
  Ours answers it once, by the rule above.
- **Their work appears in their own task list.** Ours appears as the card the console already
  draws, and the review loads into the right column of the tab the person is already in.

What their engine has that we would not build, and do not need for three gates: a visual process
designer, deadlines, escalation, delegation, parallel steps, and an operations view of cases stuck
in the middle. Those are the reasons to look at it again if the flow ever grows them.

### Why not the alternatives

- **Not a package row.** A draft that looked like a package would appear as a card, would become
  the permanent process the owner said it must not become, and would give "what is this component?"
  two answers.
- **Not `promotion_queue`.** Its columns describe a memory being promoted with votes. It has no
  place for a design's payload.
- **Not a temporary catalogue.** The gate refuses runtime writes to system catalogues on purpose
  (`figma.py:314-322`), and a draft that is placeable is a draft that can be used before it is
  approved.

## The build, in order, each with its own proof

**1. Split the seat: one chat file per tab of the vertical menu.** Five files for the five tabs
Design draws (`DESIGN_ROOM_TABS` in `rooms/design/DesignSeatShell.tsx:46`), each imported by its
own tab and nothing else. No behaviour change inside this step: the same drawings, the same
conversations, the same tabs. Proof: every tab draws what it drew before, and an edit to the Figma
tool's file changes nothing in the UX column.

**2. Remove the shared name.** The global registration of `chat-panel` goes
(`components/lit/register.ts:82`), and with it the Design console's borrowed name in the assembly
prompt (`design_console.py:391`) and the client-side swap that depended on it (`:425-431`). The
catalogue entry is removed or renamed in the same pass. Proof: a surface that names `chat-panel`
reaches nothing the Design room draws, and the room still draws its own.

**3. Prove every red grip grabs.** Each dot row moves its own panel between the slots and expands
or folds its own column, without touching another tab's. Proof: measured once on each tab.

**4. The two tables, and nothing else.** Created by the existing start-up path in
`backend/init_db.py`. Proof: the tables exist, and the package count and the catalogue's file count
are unchanged.

**5. The designer's first approval writes a draft.** A new door takes the preview's job and copies
the generated code, the measured rows, the validation and the collisions into `design_drafts`. The
ingest screen's Approve button calls it instead of the catalogue writer. Proof: the catalogue's
file count and the `design_master` count are identical before and after; the stored hash matches
the preview; the server restarts and the draft reads back byte for byte.

**6. The designer names a reviewer and sends.** Proof: the review row names the person and the
time, the draft's waiting person is that person, and nothing else changes.

**7. The card appears on both consoles with its stage in the status tag.** One card per draft where
the person is the submitter or the person it waits on. Proof: two accounts, signing out and in, the
same card seen by both, the tag reading the opposite word on each.

**8. The reviewer's surface is the same surface.** Pressing **Approve** on the rail opens the
approvals view, the cards stand beside it, and a card loads the stored ingest result into the right
column of that tab — drawn from the payload, not from memory. Proof: every parameter compared field
by field against the designer's preview, and the hash on screen matches the stored hash.

**9. The reviewer decides.** Approve or ask for changes, with a note, through the buttons in that
surface. A signature, where one is required, is the one thing that opens a modal. Proof: both
consoles, and the trail names the decision and the person.

**10. The designer's final approval commits.** The commit body is extracted into one function that
takes the draft's payload instead of a live job, and both the old route and the new one call it, so
there is one writer and not two. The measured-value gate runs again against the stored rows,
because a stored row is not a trusted row. Proof: the component file exists, the Figma map, the
allowlist and the catalogue entry name it, the element row exists, the catalogue check verdict is
shown, and the component draws from the catalogue.

**11. Grace narrates the trail, and only the trail.** The Approve button opens the conversation
with a real count, and a card hands her that draft's own review rows to speak from. She never holds
the decision: the buttons are in the surface and on the card. Proof: her sentence names a real
count and a real person, and with the model unavailable the card, the surface and the buttons still
work.

## What I recommend against

- **A separate approval dashboard.** The owner forbids it. Everything the flow needs is a card, a
  status word, a view in an existing column and the button that is already on the rail.
- **Taking ProcessMaker, in either form.** Not its service and not its route. The reasoning is
  above; the measurement is in the appendix.
- **Keeping the draft's state in the chat.** The conversation is the account of what happened; it
  is not where the answer is kept. If the chat were the record, a reload or a different model would
  change the state.
- **Guarding visibility with a package permission.** A draft is not a package. Its visibility is
  its own addressee.

## The one judgement made for the owner

The owner said "I don't know" about where a draft is kept. The recommendation is the database,
because a draft must reach a different person on a different sign-in and survive a restart, and a
temporary folder on this machine can do neither.

## Not in this plan

The catalogue-card partition, the sorting by recent work, and the Composer's cards missing from
the Design console are separate work.

Two things are open and are the owner's to decide:

- **Which list of Design tabs is authoritative.** The room draws five
  (`DesignSeatShell.tsx:46`, `design_console.py:52`); one surface still states eight, including
  trace, eval and repair (`ai.py:83`, bound at `:2707`). The split's file count depends on it.
- **Where the self-repair findings go.** The console's Approve tab draws them today
  (`console-chat-panel.ts:1698`). The approval queue is the view that tab must show. Whether the
  repairs share that view, take their own tab, or move elsewhere is a decision.

---

## Appendix — the two applications in `approval-reviews/`, read 2026-10-31

### ProcessMaker 4 — `processmaker-develop.zip`, 4,399 files

It is an approval engine. Its own summary: *"an open source, workflow management software suite,
which includes tools to automate your workflow, design forms, create documents, assign roles and
users, create routing rules."*

- PHP 8.4 with Laravel, on MySQL 8 and Redis, behind Nginx and PHP-FPM. Its database
  configuration declares MySQL and no Postgres driver exists in it.
- Licence: AGPL-3.0-or-later.
- **Its record of an approval maps to this plan one for one:**
  - `ProcessMaker/Models/ProcessRequest.php` — the case, which is our `design_drafts` row.
  - `ProcessMaker/Models/ProcessRequestToken.php` — the task waiting for a person, which is our
    `draft_reviews` row whose decision is `requested`.
  - `ProcessMaker/Models/TaskDraft.php` with `migrations/2024_02_20_193849_create_task_drafts_table.php`
    — a saved draft in its own table with its own index.
  - `ProcessMaker/Models/Comment.php` and `Traits/HasComments.php` — the trail.
  - Notifications (78 matching files) carry the ask to the person.
- It has a REST interface (`Http/Controllers/Api/`, documented with `darkaonline/l5-swagger`), so it
  can be driven without its screens.
- **What it costs.** A second server program, a second database, a second network service and a
  second list of users. Its screens are not in our trusted catalogue, so a person either sees its
  interface or sees nothing of it. Its licence requires that anyone who uses a changed copy over a
  network is offered the changed source.

### Budibase — `Agentic-opensource/budibase-master.zip`, 5,442 files

It is not an approval engine. It is a builder for internal tools.

- Node 22 monorepo (lerna, nx). Its own store is CouchDB, with MinIO for files and Redis; Postgres
  appears only as an external source it can read from.
- Licence: GPLv3 overall, per its own `LICENSE`, with a `pro` package for commercial features.
- The only two files carrying the word approval govern what an AI agent may do without asking —
  `OperationApprovalPolicyModal.svelte` and `OperationApprovalRuleModal.svelte`. That is approval
  of an agent's operations, not of a design.

### The recommendation, now measured

ProcessMaker is a reference point, not a model to copy. The owner, 2026-10-31: *"you don't even
have to use their flow … it may be inferior to something you could create from scratch."* On this
reading the answer is our own shape, and it is shorter than theirs:

- **Their engine interprets a written route at run time.** A process is a definition, a diagram
  and a route, and a token travels it. Our route is known at build time and is three gates in a
  fixed order. A written route would be a second place stating the same thing as the code, and the
  two would eventually disagree, which is the drift this repository hunts.
- **Their record answers "what state is this in?" twice.** The request carries a state and its
  tokens carry theirs. Ours answers it once: the trail is the truth, and the draft's state is
  written by the same transaction that appends the event, so the two cannot part.
- **Their work appears in their own task list.** Ours appears as the card the console already
  draws, and the review is a view in the right column, which is what the owner asked for. No
  separate approval dashboard, and no second place a person has to visit.

What their engine has that we would not build, and do not need for three gates: a visual process
designer, deadlines, escalation, delegation, parallel steps, and an operations view of cases stuck
in the middle. Those are the reasons to revisit it, and none of them is present here.
