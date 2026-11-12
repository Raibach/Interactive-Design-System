# The database, read as it is — what the story already says, and what is missing

*2026-11-02. A read of the live database on this machine, not a schema design. Row counts are the
real counts at the moment of reading. Every gap is named with the plan that fills it.*

## What the person sees

They open the console. A card names a session. Pressing it opens that session where it was left: its
conversation, the screen it was showing, and the work. Every press they make and every change they
write is a row against that session, with their name on it, so a second person who opens the same
session later can read what the first one did.

## The tables that carry that story

| table | rows | what it holds | written by | read by |
|---|---|---|---|---|
| `prompt_sessions` | 342 | the session and the card: title, description, category, status, the left column, the output, the conversation it points at, metadata, `avatar_url` | `prompt_sessions_api`, `routes/ai.py` (save), `routes/design_console.py` | the console, the seats, the save |
| `conversations` | 63 | one thread per session or tab: title, tab, count, `surface_state_json` (where the screen was), the owner | `conversation_api`, `routes/teacher.py` | every seat |
| `conversation_messages` | 181 | the turns | `routes/teacher.py` | every seat |
| `prompt_versions` | 36 | a save's content, versioned | `routes/ai.py` save | the version panel |
| `design_element_activity` | 90 | one row per action: element, user, actor, action, detail, session, flow | `routes/figma.py`, `sync_design_elements.py`, the capture door | the analytics vocabulary |
| `figma_ingest_activity` | 649 | one row per ingest: kind, actor, node, tag, verdict, reason | the ingest recorder (`INGEST_ACTIVITY_TABLE`) | the ingest's own history |
| `figma_specs` | 18 | the measured spec per file and node | the ingest | the ingest, the renderer |
| `session_permissions` | 243 | who may work in a session, and in what role | `prompt_sessions_api`, `conversation_api` | every read and write |
| `users` | 15 | the people | auth | everything |

Two smaller ones exist and are relevant: `design_element_metrics` (9 rows, measurements per element)
and `design_element_annotations` (0 rows, a place for notes that nothing writes yet).

## The second store

The database is not the only place the story is written. **ClickHouse** holds the event stream the
capture door sends: one row per interaction, keyed by session, surface, instance and conversation.
Postgres holds the state; ClickHouse holds what happened. Any audit or approval history that must
say "who did what, and when" reads both.

## What already supports the model you described

- **A session is a growing package.** `prompt_sessions` has a title, a category, a status, an owner,
  and permissions. Reassignment is a write to `user_id`; sharing is `session_permissions`.
- **A conversation belongs to a package.** `conversations.session_id` is the ownership column, and the
  seat reads by it.
- **An action is a row.** `design_element_activity` already carries the person, the actor, the action,
  the detail and the session. The capture door is built and posts to `/api/elements/events`.
- **A save is a state.** `prompt_versions` keeps the content of each save, with the person who made it.

## The gaps, in the order the approval plan needs them

0. **The queue is built.** `design_requests` was added on 2026-11-02 — the one table the other
   plans needed that did not exist: a request, its requester, its decision, who decided and when.
   *Built; the ingest's font question is its first caller and is not built yet.*
1. **There is no approval record.** No table holds a reviewer, a stage, a decision, a time, or a
   requested-changes note. The closest is `prompt_sessions.status`, which is a word, not an event.
   *Filled by `02-APPROVALS.md`, steps 1 to 5.*
2. **Nothing writes `design_element_versions`.** The table exists with the right columns — version
   number, change type, description, snapshot, the person — and holds **0 rows**. No code inserts into
   it. So a component has no history, which is what an approval would cite.
   *Filled by `02-APPROVALS.md`, step 5.*
3. **The action's row is recorded, in the second store.** The capture door writes every interaction to
   **ClickHouse** (`ux_analytics.events`): 948 `surface_opened` rows, 32 counters and 3 trails at the
   moment of reading. The Postgres table `design_surface_events` holds 25 historical rows and no code
   writes it; it is a leftover, not the record. So "this session was opened" IS recorded — the
   database document's first version missed the second store, and this is the correction. What is
   still missing is a read that unites the two stores for the per-person audit. *Built for the
   write; the read is `06`, step 4.*
4. **The card has no reviewer and no stage.** `avatar_url` can carry the logo, `category` the room,
   `status` a coarse word. A reviewer is a person and a stage is an event, and neither has a column or
   a table. *Filled by `06`, step 2, and `02`, step 2.*
5. **The screen state is stored.** The conversation in use is `conversations.id`; the scroll, the
   heights of the boxes a person sized by hand, and the component table's filter are in
   `surface_state_json` since 2026-11-02; the three form fields are the left column's sections; the
   output is `compiled_output`; the preview is the middle column. *Built; the on-screen proof of a
   reopen is the person's press.*
6. **A reassignment leaves no trace.** Changing `prompt_sessions.user_id` transfers the package and
   writes nothing that says who held it before. For a package that can be handed to a new owner, the
   handover is itself an event. *Filled by `06`, step 5.*

## Recommendation

The tables are closer to your model than the interface suggests: sessions, conversations, actions,
permissions and saves all exist. What is missing is the approval record, the version writer and the
surface-event writer — three writes, not three schemas.

So the next step is `06`, steps 2 to 4: give the card its row, give the screen its state, give the
action its open — and then the approval plan has a place to write. I would not build the approval
surface before step 4 of `06`, because a review with no history and no recorded opens has nothing to
show.

One thing I will not do without your word: adding tables. Every gap above is filled by columns that
exist or by tables that already stand empty. If a new table is needed for approvals, it is one table
with five columns — reviewer, stage, decision, note, time — and I will bring it as a statement before
writing it.
