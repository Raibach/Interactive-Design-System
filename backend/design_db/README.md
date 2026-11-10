# The Design Section's Own Database

The Design section is no longer a set of labels inside the application's database. It has its
own Postgres database, its own login, and its own structure:

```
user
  Design section
    Design package
      Chat room
      Tools room
      Approve room
      UX room
```

Every room owns its content. A conversation names the room it belongs to. A saved session or
a card names the room it was made in. A design system belongs to the Design package and to no
room. The Chat room's search reads the whole package; its own list reads only its own room.

The database is `raibach_design`, owned by the role `design_app`. The application's identity
database is separate, and `design_app` cannot read its tables (measured: `permission denied
for table users`). The credentials live in `backend/.env`:

```
DESIGN_DATABASE_URL=postgresql://design_app:...@localhost:5432/raibach_design
```

## The tables

| table | what it holds |
|---|---|
| `design_users` | the user id and display name, mirrored from the identity database |
| `design_sections` | one Design section per user |
| `design_packages` | one Design package per section |
| `design_tabs` | the four rooms: `chat`, `tools`, `approve`, `ux` |
| `design_conversations` | a conversation, its room, its title, its archive state, its surface state |
| `design_messages` | one turn, its conversation, its role, its words, its stamp |
| `design_records` | sessions, cards, elements, reviews, approvals — each names its room |
| `design_package_records` | the design systems, which belong to the package and no room |
| `design_events` | the activity of a room |
| `design_moves` | one row per source record moved, with its target and its result |

The indexes are on the tab and the time (`tab_id, updated_at DESC`), on the conversation and
the turn (`conversation_id, created_at`), and on the kind and the time.

## The commands

Run from `backend/`, with the backend's own interpreter for the Milvus step:

```sh
python3 -m design_db.create                 # the database and the design_app role
python3 -m design_db.seed --schema          # the tables, the section, the package, the four rooms
python3 -m design_db.move                   # read and report what will move
python3 -m design_db.move --apply           # copy the entries; one ledger row per source
.venv/bin/python -m design_db.index         # report what the search index will hold
.venv/bin/python -m design_db.index --apply --rebuild   # build the Milvus collection
```

The move is a copy. No source row is deleted, changed, or re-pointed. A conversation keeps its
id; every message keeps its id.

## The mapping, measured

The six Design conversations moved as three to Chat, one to Tools, two to UX, and none to
Approve:

| source | room |
|---|---|
| `Design — Console`, `Design · Console`, `Design — Chat` | Chat |
| `Design — Tools` | Tools |
| `Design — UX`, `Discussion about Product analytics` | UX |
| the review of `output-footer-area import` | Approve |

The records moved as the saved Tools session, the 63 element masters and their 10 children
(Tools), the three design systems (the package), and the review (Approve). The activity and
metric rows moved as 99 events in the Tools room.

Measured after the move: 6 conversations, 3 turns on disk (the source's `message_count` for
`Design — Chat` says 2 and the message table holds 1 — the table is the truth), 75 records,
3 package records, 99 events, and 188 ledger rows.

The Milvus collection `design_items` holds 183 items. The package-wide search returns items
from all four rooms; a search filtered to `chat`, `tools`, `ux`, or `approve` returns only that
room's items; another user's search returns zero.

## What is not done

The running application still reads and writes the **old** database. The new Design database
is a verified mirror, not yet the application's source. The next step is the cutover, room by
room: the Chat room first, then Tools, then Approve and UX. The old database stays in place
until that cutover is accepted.
