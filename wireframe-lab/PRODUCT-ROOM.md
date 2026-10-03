# The Product room — the three-level blueprint, corrected against this tree

Written 2026-10-02, from the owner's blueprint (nav tab → domain-filtered cards → sandboxed package)
and Google's framing of it as a "2-to-3 click cognitive hierarchy". **Nothing here is built beyond
what the list below says** — and the list below now says: **R1 has LANDED and been driven
(2026-10-03; Slice A — the room, the tray, the strip, the door), and R2's strip landed with it.**
The owner's shape for the door (2026-10-03): *"clicking on the tab in the top navigation is the
creation of a session… it should mirror how composer, and how console and how the design also create
session packages"* — `render-product` alone is a server-side get-or-create. The record of the day:
`PLANS.AGENT/session-notes-2026-10-03.md`.

## §1 — What is real today, and what the blueprint assumes

| blueprint says | what the tree actually has |
|---|---|
| `session.metadata.room_domain === "product"` / `"design"` / `"composer"` | **Does not exist.** `metadata` today carries `session_type` ('console'…), `initial_conversation_id` and the fact `design_system` (added 2026-10-02, read by `design_system_of`, no writer yet). A package's ROOM is a new fact. |
| cards "tagged as `artifact_type: 'wireframe'`" | **`artifact_type` is a column on `prompt_artifacts`** — rows of ASSEMBLED artifacts, not a tag on a package. Packages live in `prompt_sessions`. The blueprint's two tables are one: "the package belongs to a room" is a package fact; "this is a wireframe layout" is an artifact fact. |
| "the Product Room Console displays only package cards… the Design Room Console displays only… `catalog_ingest`" | The Design room's console is not a package list at all — Design manages **catalogs** (the four partitions, their counts, the ingest tools). Its "cards" are catalogue rows. So the filter is a REAL mechanism for Product and Composer; for Design it would be applied to a different list that exists on its own terms. |
| "Grace reads only from the conversation_id bound to that card" | **Already true and verified** (2026-10-02): the seat accepts a conversation only from its package's list (`chat-panel._conversationBelongsToPackage`, read at history AND on the write path), the server grants a write only with the package's `session_permissions` row, and a canvas ask was proven to land in that package's conversation and nowhere else. |
| "the canvas autosaves only to the `prompt_artifacts` rows belonging to that specific package session" | **Does not exist yet.** The autosave is S2 of `PLAN.md`/`ADD-A-DESIGN-SYSTEM.md` — read first, then the write on gesture end, keyed by `conversation_id` (the decided key). Level 3's second half IS S2; there is nothing extra to build for it here. |

## §2 — The fact that has to be defined: the package's room

One fact, one writer. A package's room belongs in `prompt_sessions.metadata.room_domain` (jsonb — no
migration), and **the writer is the creation path of each room**: a package made in the Product room
is born `room_domain: 'product'`; in the Composer, `'composer'`. ABSENT IS A REAL ANSWER — every
package that exists today has no room, and they keep belonging where they have always been (the
console/composer), exactly as `metadata.design_system`'s absence means "never chose".

The three rooms then read the same fact in the same way — one query parameter, one filter:

- **Product** → `room_domain = 'product'` → the product team's wireframe packages.
- **Composer** → `room_domain = 'composer'` (plus absent, which is every legacy package).
- **Design** → not a package list; its list is the catalogues (see §1), and it stays that way until
  the owner says a design room holds packages too.

## §3 — The un-stub is an ACT, and it lands WITH its room

`Product` is `disabled: true` by a recorded decision (*"DEAD TABS — Product, Development and
Governance are STUBS, and they are dead on purpose"*). Turning it on alone would produce the exact
thing this repository deletes: a tab that opens onto nothing. So it lands in ONE increment with its
room:

1. the tab enabled;
2. a `render-product` intent assembled against the catalogue (the model composes it — never a
   hand-written chain, the §00c violation);
3. the room's console filtered by `room_domain` (the API takes the parameter; the console passes it);
4. the package's workspace defaulting to the **draft** view — the output column's selector already
   carries `flow | output | draft` and a default view is a host fact (the header's `view` write);
5. the picker that writes `metadata.design_system` (the remaining sliver of step 5).

## §4 — The order, and the one prerequisite

**S2 comes first.** Level 3's autosave IS S2 (the `prompt_artifacts` read + the write on gesture
end, keyed by `conversation_id`), and without it the Product room's draft draws and forgets: a
product person's layout would not survive a reload, which is precisely the promise that room makes.
The room increment (below) can be built in parallel, but it should not be the thing a person is
invited into before the draft can remember.

**S2 is now VERIFIED, both halves, in the running app (2026-10-02).** The stored row draws its
components when the seat is on its conversation and the view changes to Draft; one drag writes
exactly one `PUT`; the stored positions move with it (the full record and its evidence live in
`PLAN.md`, "S2'S UI HALF, SEEN"). One consequence the drive exposed is R1's to answer: a Run forks
the seat onto a fresh conversation, so a package's workspace defaulting to the **draft** (the
increment's item 4) lands on the run's own empty thread unless the default knows to read the thread
that holds a layout — the draft is conversation-keyed, and "which conversation is the package's
draft" is a fact R1 has to name.

| # | what | needs |
|---|---|---|
| **S2** | the store: read `prompt_artifacts` for the active `conversation_id` → the draft's payload; the write on `draft-node-moved`; both fail loud | nothing — decided |
| **R1** | the room: tab enabled + `render-product` + the `room_domain` write on creation + the filtered console + the draft default | the owner's word on `room_domain` as the fact (and its three values) |
| **R2** | the picker: a package's design system, written to `metadata.design_system` from the room's own control | R1 |
| **R3** | the permission: catalogue editors + rooms allowed to draft with a catalogue (the locked system catalogues) | its own design; nothing today carries it |

## §5 — What this blueprint must NOT do

- **Do not give Design a package console to satisfy the filter.** Design's list is catalogues; the
  `catalog_ingest` tag in the blueprint names a thing that would have to be invented to exist.
- **Do not treat `metadata.room_domain` as written already.** A filter reading an unwritten key
  returns nothing — a Product room that shows an empty console on day one and a person who concludes
  the feature is broken. The writer ships with the reader.
- **Do not un-stub Product without its room.** A live tab onto nothing is the dead control this
  repository deletes, wearing navigation.
