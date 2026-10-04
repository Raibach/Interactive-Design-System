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

## §6 — The user, and the one rule (owner, 2026-10-03 evening — recorded so it is not re-litigated)

The room's user, stated plainly: *"This is a product team user, not a person who understands
design. They're just in there playing. It's a play box, sandbox — a place for them to explore their
ideas, and they're basically prompting Grace and she's doing everything. This is one of those very
expensive areas of the site. It's a vibe-coding area — its only rule, only restriction: it has to
use items from our approved catalogs. They can't invent items."*

What that fixes, as constraints rather than tone:

1. **The interface is Grace.** The person prompts; she does the work — placing, moving and removing
   become spoken instructions (owner, same evening: *"get rid of the idea dragging elements around
   to reassemble them… if they want to move something, they have to tell her"*). Drag-to-reassemble
   retires from the room; the Composer's own canvas keeps its gestures — a different audience, its
   own build.
2. **The one rule is the catalogue, and it is already enforced by construction.** "They can't
   invent items" is the palette invariant (`METHODOLOGY.md` §2): every placed name resolves through
   the chosen partition's catalogue and its own registry, a name outside it draws the refusal
   sentence, and the tray offers exactly the accepted set. No second rule goes into the room's
   prompt or its gate without the owner.
3. **A sandbox that costs money, on purpose.** The room is one of the site's "very expensive areas"
   — deepseek-v4-pro composes the room today and will assemble the drafts in Slice B, and the
   governance ledger meters every call. Cost-awareness belongs to the room's design (the compiler
   is bounded by the palette — a small vocabulary is also a small bill), never to a quiet
   fallback.
4. **Libraries arrive invisibly.** The person picks the SOURCE library from a dropdown/panel; the
   import itself is Grace's background job — *"the user does not need an interface"* (owner, same
   evening). `prepare_design_system.py` and the background import are the named next build.
   **SUPERSEDED later the same evening:** the owner removed the selection entirely — *"they don't
   need to select anything"* (see §7, Late amendments 1). The loading stays invisible; there is
   nothing TO select: one system, chosen for the room.

What it does NOT change: the doors, the packages, the approval path (Submit → the queue) and the
wall — every session still draws from exactly one partitioned catalogue, and the person never sees
the seams.

## §7 — Slice B LANDED, and driven (2026-10-03 evening): Grace builds the wireframe

The owner's scoping, verbatim: *"don't concentrate on the ingestion part yet… We can just hardcode
— goes in there, just build. The availability of these individual design systems is really what I
want to do. I wanna make that available to the product room's AI model."* And *"Then Grace has to
load it."* All of it landed the same evening, and every claim below was driven in the app:

1. **The room's world is DECLARED, not scanned** — `_PRODUCT_ROOM_DESIGN_SYSTEMS = ("agnosticui",
   "kor")` in `routes/ai.py`, one line to extend; the chooser lists exactly these (verified:
   `["", "agnosticui", "kor"]` — the application's four catalogues never appear in this room), a
   chosen system outside the tuple fails loud, and a declared system with no partition fails loud,
   named. A package born in the room carries the first declared system (written by the same
   `create_session` act that writes `room_domain`); a package that predates the writer reads the
   same first name (verified live: the legacy "Wireframe Session • 9:24 AM" opens on
   `agnosticui` with an empty stage).
   **AMENDED the same evening — THE CHOOSER ITSELF WENT** (below, in "Late amendments" — one
   system, kor, and nothing selects it).
2. **The compile** — `POST /api/ai/assemble-wireframe`: the thread's LAST PERSON TURN is the ask
   (read server-side; the button carries no words), the session's OWN catalogue is the closed
   contract (names + declared props, one walk shared by the prompt and the validator), and every
   name and prop is validated against it — an undeclared one is a 503 by name. It writes NOTHING;
   the host applies the layout through the one draft store.
3. **The offer** — `[Build that](action:build-wireframe)` (declared in `shared/actionLink.ts`,
   parsed by the seat, answered by the host). Driven end to end: asked for *"two buttons side by
   side"* → her reply planned it with `kor-button` + declared props and ended in the button →
   pressed → the log shows `POST /api/ai/assemble-wireframe 200` (deepseek-v4-pro,
   `[wireframe] compiled 2 node(s) from 'kor'`) → `PUT …/draft 200` by the host → the stage drew
   two real `kor-button`s (`label: Get started`, `color: primary`; `label: Learn more`,
   `color: secondary`; 85×24 on screen) — and the layout survived a reload.
4. **THE TRICK, witnessed** — asked *"can you make the border thicker on the Get started
   button?"*, she answered verbatim: *"That's a styling request — border thickness is set by the
   kor design system, not something I can change on the wireframe. What I can build instead: the
   two-button row as planned… exactly as kor defines them."* Structure yes; styling never; the
   refusal is a sentence, not a silent no-op.
5. **The drag retires** — `draft-canvas` gained `movable` (default true; the Composer keeps its
   gestures) and the product tree binds `false`: a real pointer drag on a tile SELECTS it and
   moves nothing (positions stayed `{40,40}`/`{240,40}`; no write in the log). The tray's `+ Add`
   stays — a click is not a drag.
6. **One defect the drive found and fixed** — the first press marked `build-wireframe` spent
   package-wide (the owner's 2026-09-23 repair rule), so her NEXT offer arrived disabled and the
   room's build-again loop would die after one build. `build-wireframe` joined her answers as the
   second turn-scoped exception in `chat-messages.ts`; verified: fresh offers arrive live, the
   pressed one keeps its ✓ for its own turn.
7. **The demo lock treats the new route correctly** — the gate is deny-by-default with an explicit
   mutation allowlist, so `POST /api/ai/assemble-wireframe` is refused on the deployed demo until
   it is written into `ALLOWED_MUTATIONS` on purpose — a publish-time decision, the owner's.
   `check_demo_policy.py` agrees (✅).

**Borrowed, and named** (the owner supplied `wireframe-lab/open-canvas-main`, MIT — LangChain's
Open Canvas): the forced-schema output contract, the refusal-biased routing split, and the
full-artifact rewrite + short followup — each cited at its source path in the code comment above
`ai_assemble_wireframe`.

**Late amendments, same evening (after the owner's first real session):**

1. **THE CHOOSER IS REMOVED — one system, and nobody selects it.** *"So I don't want the user to
   be able to select a catalogue. Let's just pick one that's most compatible and use it. I'm
   removing that feature — they don't need to select anything."* `_PRODUCT_ROOM_DESIGN_SYSTEM =
   "kor"` replaces the tuple (ONE name; kor because its button is the most universally useful
   wireframe primitive — it renders its label — and its source is the cleanest to grow; one line
   to change). The list, the element (`design-system-picker`, file deleted), its catalogue entry
   (62 components now), its registration, the seat's allow-list line and the host's
   `design-system-chosen` write are all GONE — nothing selects and nothing writes
   `metadata.design_system` at the room's edge. The assembly still carries the name in its data
   model (the host pre-loads the registry from it), and the compile reads the same constant.
   Verified in the running room: no picker, no select; `system: kor`.
2. **Her plan-check rule, from the owner's own transcript.** His first session asked for *"a
   contact us form"*; she promised name/email/message fields kor does not carry, and had to take
   it back a turn later. Her instructions now carry the rule — CHECK THE LIST BEFORE YOU PLAN —
   with that transcript cited as the measured case, and the compile gained rule 4 ("a layout of
   buttons labelled like form fields is a LIE, not a wireframe"). Replayed verbatim afterwards:
   *"before I plan anything, I have to check the catalogue, and the catalogue carries only
   kor-button. So a contact form with name, email, and message fields is not buildable yet…
   What I can build with kor-button alone: …"* + a real `[Build a Contact us button]` offer.
3. **A typed "Build that" is answered with the button.** She cannot run the compile herself (the
   host owns the press), so her script now says: one short line and the same `[Build that]`
   link — never leave the person without it.
4. **The example's core is in, adapted: THE SCOPED EDIT.** Their chat edits a highlight; ours
   edits the SELECTED TILE — click a tile, ask about it, she offers `[Edit it]`, one press
   changes THAT node and nothing else (`POST /api/ai/edit-node`; the model answers with the tile
   only, the server splices, the catalogue's contract validates it — their prompts and guards
   cited in the code). Driven: built two buttons, clicked the first, asked for its label to
   change, pressed — its label changed, its colour stayed, the second tile untouched. With it,
   the room's three doors are honest: a question is words, one element is `[Edit it]`, a whole
   layout is `[Build that]`. Also fixed from his play: **the dot grid is hidden** (the ground
   carries its own dots) and **nothing moves by hand** — `movable: false` now covers the pan and
   the zoom, not just the drag ("when I grab the background, it moves the buttons").
5. **"Always create a container first" — and the container carries its contents.** The owner's
   rule, landed as capability, not politeness: `children` are on the payload, the renderer mounts
   them inside their container (the platform's own slots), the compile opens every layout with a
   centered card and puts everything inside it, validation walks the whole tree, and a scoped
   edit keeps a tile's subtree. Driven: one sentence → a centered card holding two inputs, a
   textarea and the submit button — real light-DOM children of the card, not tiles beside it.
6. **CARBON IS THE ROOM'S SYSTEM, THE LADDER GIVES HER JUDGMENT, AND THE BUTTON IS GONE** (the
   night's second half; the full record is `PLANS.AGENT/session-notes-2026-10-03.md` §13): IBM's
   `@carbon/web-components` installed and used AS-IS (the vendor's own Lit elements — no copied
   source), the catalogue GENERATED from its own Custom Elements Manifest by the first real
   `prepare_design_system` run (types measured, unmappable props left out), Kor unseated but
   kept as a partition. The size ladder (`sm|md|lg|full`, ours, never pixels; a container
   defaults to `lg`) answers *"That's not a form size"*; *"just give her a prompt and she starts
   building"* retired every offer button — the seat's person-turn event runs the compile, whose
   rule 0 is the router (a question builds nothing). And one defect class died tonight:
   **`requestAnimationFrame` does not fire in a hidden pane** — the stuck splash, the unset
   system and the uncentered stage were one cause, fixed with timers. Driven: *"I need to create
   a simple contact form."* → a centered `cds-card` at `lg` (clamped to a small window, offset
   0) holding Carbon's own name/email inputs, a textarea and a primary submit button.

**Still open:** Grace loading libraries in the background (`prepare_design_system.py` — the
person never selects, per amendment 1); Slice C (Submit → the queue); the owed word on the
palette's first set; per-catalogue permissions (R3); and the demo's allowlist entry whenever a
publish is approved.

## §8 — THE STAGE CLEARS, WATCHED — AND THE REBUILD DIRECTION (2026-10-03, late; a fresh session)

**The complaint this answers** (the owner, watching the room): *"There is a form floating there
that never goes away… is there no mechanism at all to save your work, transfer your work? …
were there no controls for the canvas at all?"* The audit that ran beside this
(`PLANS.AGENT/audit-2026-10-03.md`) proved the form is DATA — the room's own autosave (one
`prompt_artifacts` row per conversation, replaced on every write) — with no control to empty
it. That is now fixed, and both hands were DRIVEN in the room, pane up:

1. **Spoken, first try:** *"clear the stage"* → `[wireframe] compiled 0 node(s) from 'carbon'`
   → `POST /api/ai/assemble-wireframe 200` → `PUT …/draft 200` → the stage emptied live; the
   row became `{"nodes": [], "positions": {}}`; a reload + re-entry stayed empty. Rule 0 did
   not swallow it — the compile prompt already calls an empty layout a real answer.
2. **The rail's own hand:** `draft-canvas` gained `clearable` (default false; THIS ROOM binds
   true; declared in the catalogue entry and the tag registry before it shipped; the room's
   tree prompt and template carry it — `routes/ai.py:1879–1892, 1912`). While the draft holds
   a node the rail draws **"+ Add · ✕ Clear"**; a press announces `draft-cleared` and the HOST
   writes the empty layout through the SAME one store — one fact, both hands, one writer.
   Driven: tray add → `n-1` drawn → Clear appeared → press → empty, and the Clear withdrew
   itself (nothing to clear, no control drawn). The drive caught a defect in the change itself
   (a dropped `$` rendering the tray's option handler as text); fixed and re-driven green.

**Corrections this session forces on the record above** (the record's own law — corrections
stay visible): **"No offer buttons exist any more" (§7's banner) is FALSE as written** — the
script still teaches `[Edit it]`/`[Build that]` at `ai.py:504–512` while `486–495` and the
appended context (`1848–1855`) say never offer a link, and `ai.py:482` hardcodes a stale kor
list. Her replies can still render live buttons (the thread shows them). The audit document
carries the full finding; the fix is in the queue, superseded in part by the direction below.

**The rebuild direction (the owner's decisions, same evening):**

- **D1 — Built like `wireframe-lab/open-canvas-main`** (the codebase he supplied): the model
  writes the ARTIFACT — code/text, freely — from the prompt; **the same model that speaks is
  the model that builds** (one voice — the narrator-and-hands split, chat reply written before
  the compile is attempted, is the mechanical root of the sycophantic feel); the design
  systems are **reference material — a guide, not a wall**; the artifact's versions
  (`{currentIndex, contents[]}`, prev/next) ride the store. *"First the model has to operate
  like a coding partner and it seems like we left out the coding."*
- **D2 — The sandbox is ephemeral.** Nothing commits to the database until the person is
  done: **Save** or **Send for approval** IS the commit — it takes a name and an ID, "basically
  a package just like we already have… a new form of creating content for a package"
  (save-on-exit the only other time). The per-gesture autosave this §'s first paragraph
  describes is superseded by this decision.
- **D3 — Canvas controls translate too:** pan / zoom in / zoom out — the Composer's own — belong
  in this room. *"Trying to use the composer's core functionality in a space that didn't need
  to be there"* (owner): the mechanism of the contortion, named.
- **D4 — Nothing committed, nothing pushed; `demo-mode` frozen at `4e7d5c0`.**

## §9 — THE ROOM BUILDS PAGES NOW (2026-10-03, late — driven, watched)

**The sentence this section makes true** (owner, same night): *"I just wanna be able to ask the
model to build a webpage or wireframe or whatever and she will just start doing it."* The room's
stage is no longer the node canvas: it is **`artifact-canvas`** — the window onto a real HTML
page Grace writes from the person's sentence (`POST /api/ai/build-artifact`), held IN-SESSION
(nothing reaches the database; Save / Submit as a named package is a later slice on the owner's
word), rendered in a sandboxed iframe that cannot run a script. The design system is a **guide,
not a wall**: its stylesheet (`frontend/public/carbon-styles.css`) is linked into every built
page — classes and tokens available, nothing enforced; plain HTML/CSS equally welcome. The rail
keeps one hand: **✕ Clear** (and "clear the stage" by voice — an empty artifact is a real
answer). The send-back question the room's history carried — *"were there no controls for the
canvas"* — is answered by the thing the room does now.

**Driven, pane up, watched** (18:19–18:24; screenshots on file): empty stage →
*"Build me a simple webpage for a car wash — hours, services, and a call button."* → a 3914-char
page drew on the left ("Sparkle Car Wash": hours, services, Call Now) → *"Change the call button
to say 'Book a wash'"* → 3917 chars, button changed, everything else kept → *"Clear the stage."*
→ 0 chars, empty state back, the Clear withdrew itself.

**Parked, unwired, NOT deleted** (owner: *"push that aside for now"*): the node-era stage in
this room, the wireframe compile/edit routes, the catalogues/partitions/registries and the wall.
The Composer keeps its own canvas and gestures.

**Named next fixes** (each found by the drive, none smoothed): her CHAT script still speaks the
retired node era ("a cds-card holding…") while her hands write free pages — the two-voice split
(§8 D1) made visible; the script's stale kor list and taught offers go with it. Human-typed
Enter (vs scripted fill) to re-verify by hand. The seat's own two-press conversation-remove flow
fired mid-drive and behaved exactly as designed (no artifact lost — the page is in-session).

**The samples shelf:** open-canvas (pattern adopted), VibeSDK (excluded — Cloudflare-only),
Onlook, and tonight's clones — Builder.io (`builder-main`), Mitosis (`mitosis-main`),
`ai-app-builder-open` — all MIT, all reference. **None is the engine**; the working loop is ours,
on our model, with zero new accounts.

**§9 addenda, same night (all driven):** (a) **COMPOSITION** — the build prompt now teaches
Carbon's class components as THE building blocks (palette spellings verified against the served
stylesheet; 967 `cds--` tokens); *"a testimonial section with three cards"* drew **three
`cds--tile`** and an FAQ request drew a real **`cds--accordion`**. The quality lever is the
palette; output quality ∝ the parts fed to the engine (the owner's own reading). (b) **THE SEAT
SHOWS ITS WORK** — the owner pointed at Vercel's AI Elements (MIT): the seat's thread now runs
a 1:1 port of their `<Reasoning>` — shimmering "Thinking…" → "Building the page…" →
auto-collapse **"Worked for Ns"** → click reopens the stage trail (`a2ui:grace-status`
building/idle from the room's host). React originals vendored at `frontend/ai-elements/` (the
seat is Lit + shadow DOM; the README there states the activation plan). The drive caught the
port's missing shimmer base layer; fixed and re-verified. (c) Her CHAT mouth is still the old
era's — the script fix stands as the next change on the owner's word.

## §10 — THE TOOL IS ABSORBED: its projects are cards on the console (2026-10-04)

**The owner's scoping, verbatim:** *"let's try to figure out how to incorporate those projects,
but feed them in into our database as a package … they will go on the console … this is just a
different type of card. It's a different category of card. It's a product team card."* And the
constraints around it: *"They'll be styled exactly like the current console cards — don't change
the styling … Add some new category … it's gonna be something that they share with design and
with development and to be reviewed"*; *"the database can even stay where it is for the tool, but
the cards launch in the product section"*; and, on deletion, *"delete means remove it"* — no
archive concept was invented for this.

Everything below was built and DRIVEN today:

1. **The bridge (backend/routes/builder_bridge.py).** The tool's database stays where it is: the
   engine's own project list (`GET {BUILDER_ENGINE_URL}/api/v1/vcaas/projects`, default
   `http://localhost:4000`) is the fact; the sync keeps ONE package row per project in step —
   born through the same `create_session` every package uses (which gained the `builder_*`
   metadata keys: `builder_project_id`, `builder_preview_url`, `builder_runs`), updated when the
   project's facts move, REMOVED (`delete_session(permanent=True)`; dependents cascade) when the
   project is gone. Nothing is copied — the row is a reference; files, history and versions stay
   with the tool. The console's render-console branch syncs best-effort BEFORE reading the cards,
   so a project built a minute ago is already a card; an engine that is down never breaks the
   console (the rows that exist render unchanged). `POST /api/builder/sync` and
   `GET /api/builder/health` are the manual doors.
2. **A defect the drive found and fixed — the concurrent-sync race.** The console assembles on
   every arrival and the frontend retries, so several `render-console` requests can run at once;
   each one's sync read "no package yet" before any had committed, and all of them created — five
   concurrent assemblies left FIFTEEN rows for three projects. Fixed with a process-level lock
   (one backend process; a DB-level partial unique index would hold across processes but is a
   schema fact this bridge does not get to add); the fifteen were reconciled to three and a fresh
   sync reports `created: 0`. Driven: idempotent.
3. **The card carries its project.** The card dict gained `builder_project`
   (`{project_id, preview_url, runs}` — a faithful read of the flat keys, composed in
   `routes/ai.py`'s render-console branch), and the cards wear the new **Product** category
   (`categories` row: `#1C2F4E` / title `#D3DF44` / text `#FFFFFF`) — the card element's own
   mechanism tints the title, so *"it's a different category of card"* is true with ZERO change
   to the card element. Driven: the console's own assembly returned all three cards with
   `room_domain: product`, `category: Product` and their preview URLs; legacy product packages
   (born before the bridge) carry no `builder_project` and open the room's dashboard.
4. **The card launches in the product section.** The console click handler no longer assembles a
   product surface: a card with `builder_project` sets `productRoomProjectId` and the room's
   `<builder-embed>` opens `http://localhost:3223/project/<id>`; a direct Product-tab click lands
   on the tool's dashboard. The room asks `GET /api/builder/health` on arrival and says plainly
   **"The builder's engine isn't running"** when it is down — a stopped process read as a broken
   tool before this.
5. **The tool, whole (the same day's second directive — *"I want the tool to operate as intended
   in its own repo so it should be a full suite"*).** The engine gained: real LINE DIFFS between
   run snapshots (the version diff used to be a placeholder; a version's snapshot is now the
   state it IS — restoring v1 used to restore an empty project), per-run logs in the Logs panel
   (files/seconds/tokens), project export/import as base64 JSON transfer codes, and the
   source-code ZIP verified end to end through the app's own proxy (the owner's *"I can't load
   source code"* was the engine being down mid-patch — the health banner above is the fix for
   that class). `npm run dev:local` starts engine + builder together (local-vcaas/start.mjs);
   `local-vcaas/README.md` states plainly what works and what is refused, with reasons.
6. **Refused, honestly, with the reason in words** (no silent no-ops): Publish/Deploy, the
   Database panel, GitHub, Figma, custom domains, webhooks, attachments — Totalum's hosted
   services; no local substitute exists.

**Still open:** the handoff *out* of ideation (*"something that they share with design and with
development and to be reviewed"*) — the cards are the first half; a send-for-review door is the
next build on the owner's word. And the category's colors are placeholders from the app's own
palette until the owner styles them.

## §11 — THE ACCESS WRITES: already there, guards corrected, driven (2026-10-04)

**A correction that stays visible, per this record's own law.** A turn earlier this session
claimed "there is no write side: nothing in the backend grants a permission or changes an
owner — I checked." THAT WAS WRONG. The check searched the data layer
(`prompt_sessions_api`) and listed only the first screenful of the routes; the app's HTTP
layer has had a full access-writes module all along, direct-SQL in
`routes/prompt_sessions.py`: `GET/POST …/permissions` (grant), `DELETE …/permissions/{id}`
(revoke), `POST …/transfer` (transfer, previous owner kept as 'editor') — the owner-only
guards included. The blueprint's "missing Access-Writes Module" did not need building; a
parallel implementation this session had begun was DELETED in favour of the app's own (one
writer per fact), leaving only two real gaps closed.

**The two gaps, and the drive that proves them closed** (all against the live backend, a
bridged product package as the subject, a real second user as the grantee):

1. **A grant could mint a second 'owner'** — and `revoke` refuses owner rows by its own rule
   ("transfer ownership first"), so that second owner could never be taken back and a later
   transfer would strand two owner rows. `POST …/permissions` now refuses `role: "owner"`
   with the pointer: *"Role must be 'editor' or 'viewer' — ownership moves through
   transfer"*. Driven: refused (400).
2. **A grant or transfer to a user who does not exist** answered an opaque FK 500. Both now
   answer a named 404 (`No user <uuid>`); transfer to the package's own owner answers 400.
   Driven: both refused by name.

**The transfer, driven whole** (grant GUEST editor → transfer to GUEST → transfer back →
revoke): ownership moved (`prompt_sessions.user_id`), the previous owner demoted to
'editor', the new owner's own package list carried it, `metadata.builder_project_id` rode
the row UNTOUCHED — the reference-pointer strategy the decision matrix recommends is what
the code already did, and the deep-copy alternative is recorded as the named seam on the
transfer route. Final state restored: one owner row, the default user.

**Still open** (unchanged by this): the UI half — a way for the owner to grant/transfer from
the app itself. The endpoints exist and are driven; nothing in the frontend calls them yet
(the "share with design and development for review" door). And these mutations are not in
`demo_policy.ALLOWED_MUTATIONS` — the deployed demo refuses them, which is the correct
default until a publish says otherwise.

**§11 addendum, same evening (from the owner looking at the cards):** *"the cards have a name
at the top — agent function pipe category … it should say product team."* So (a) the category
row is renamed **Product** → **Product Team** (`categories.name` is the join key, so the
colors rode along; the three package rows updated with it) and (b) the card's top line became
data-driven: `<agent-card-element>` gained `headerLabel` (attribute `header-label`), the
console grid writes it from the card's own category FOR PRODUCT-ROOM CARDS ONLY, and every
other card keeps the literal indicator — the owner's 2026-09-19 rule ("the indicator is not a
value") stands everywhere else. Driven: the console's assembly returns `category: "Product
Team"` for all three bridged cards and the sync keeps writing it. Two self-inflicted errors
caught and fixed on the way, recorded because this record keeps its mistakes: a backtick
inside a Lit template comment (template literal terminated — the file even warns about this
elsewhere; caught by Vite's esbuild, not by an incremental `tsc -b`), and a `mountedRef` guard
borrowed from the builder's page where no such ref exists (caught by the next full typecheck;
removed — React 18+ ignores late state updates anyway).

**§11 addendum 2, same evening (the back arrow):** *"there's a back button at the top left
corner … inside the product team area — that back button should go back to the console."* The
builder's back arrow (both layouts) now knows where it came from: every page `<builder-embed>`
loads carries `?embedded=console`, and with that header the arrow postMessages
`{type:'builder-back'}` instead of navigating — the host verifies the sender's origin, opens
the console tab, and the builder never reloads. Standalone (opened at :3223 directly, no
param) it remains the tool's own dashboard. One trap recorded in the code: `document.referrer`
is the obvious source for the host's origin and is WRONG inside a frame — after any in-frame
navigation it names the frame's own previous page — so the message targets `*` and the host's
origin check is the gate (the message is a bare constant; it carries nothing). Both apps
typecheck clean; both URLs answer 200 with and without the header.

**§11 addendum 3, same evening (the chat column moves right):** *"move the chat feature to the
right side instead of the left side … just so that we follow the pattern of our application."*
One file (`ai-app-builder-open/src/app/project/[projectId]/page.tsx`), four small edits: the
chat column and its resize grip are a REAL DOM move — the workspace row now reads
`[preview | grip | chat]`, so tab order follows the eyes; the drag delta flips sign (the grip
rides the column's LEFT edge now); the header's two control clusters swap sides via `order-*`
(the chat's context band — back arrow, project menu, versions, collapse — sits over the chat;
the app's own tools — tabs, address bar, secrets, publish — over the preview), and the collapse
icons become `PanelRight*`. The columns got the real move; the header clusters are a row of
icon buttons where `order-*` costs nothing (said plainly rather than smuggled). Verified:
div balance 0, esbuild parse OK, builder `tsc` exit 0, the page compiles (200). The mobile
one-pane layout is untouched — it never had two columns.

**§11 addendum 4, same evening (the Product door creates; the dashboard is never seen):**
*"when I click product just create a new project … this is the same function as composer …
basically we never want to see the applications dashboard ever."* So the tab click IS the
creation, exactly as the Composer's is: `POST /api/builder/new` (bridge) asks the engine for a
project (`product-idea`, engine-deduplicated to `product-idea-xxxx`), and the room opens its
workspace; a console card still opens an EXISTING project through the card's own path. The
tool's dashboard is now unreachable from the room BY CONSTRUCTION: the embed renders only once
a project id exists (`builder-embed` draws nothing without one — its dashboard default is
gone), and entering the room with no project (a reload, a restored tab) births one exactly as
a click does. Driven: two creations through the door (`product-idea`, then
`product-idea-jno` — deduplication witnessed), a fresh empty project's workspace compiles
(200), both test projects removed and the engine back to its three real ones. The engine-down
case keeps its plain banner: the room says why it cannot open a project instead of quietly
showing somewhere else.

**§11 addendum 5, same evening (the project menu):** *"my projects would simply go to the
console; new project opens up a new project just like you clicked the product tab; you can
remove custom domain."* So, in the tool's project dropdown (one file, `popupMenu`): **My
projects** now calls the same `handleBack` as the header's arrow — embedded, the host opens
the CONSOLE (whose cards are the project list), standalone it is the tool's own list; the
dashboard is no longer a destination from either state. **New project** is the Product tab's
act, one address over: `POST /api/vcaas/projects {projectId: "product-idea"}` through the
builder's own proxy, then the router opens it — it used to send you to the dashboard and rely
on the hero prompt. **Custom domain** left the menu (domains are Totalum's service; the entry
was a door onto a refusal). The modal itself stays mounted for the publish dialog's own link
into it, and `Globe` left the icon imports with the entry. Driven through the builder's proxy:
create (`product-idea-9dj`, removed after), Versions (Run 1), Secrets (create + remove —
cleanup), GitHub/Figma (honest `connected:false`), Logs (the engine's run log), and the
splash on a new project's preview. `tsc` exit 0; the page parses and compiles.

**§11 addendum 6, same evening (the cards' descriptions):** *"we need some kind of default
description because these cards are blank if there's nothing in them … a placeholder
description until it's replaced by the user's prompting."* Two writers, one fact: (a) THE
ENGINE now treats the FIRST PROMPT as the project's description (`runAgent` writes it only
when the field is empty — a project that already says what it is keeps saying it); a project
born from the tab click and prompted in the workspace used to have no description, ever, so
this is also a real defect fixed. (b) THE BRIDGE writes a PLACEHOLDER into the row while the
description is empty (*"A new idea, just opened in the product team's sandbox — its
description follows the first prompt."*) — written into the row, never synthesised at render
time, so the card stays a faithful read (the assembler's old sin — card text appearing
nowhere in the database — stays deleted). Driven whole: create via the door →
`product-idea-ggy` → sync → the card carried the placeholder → one tiny prompt → sync → the
card carried the prompt verbatim ("A tiny hello page with one heading and nothing else.") →
test project deleted, its card removed by the very next sync.

**§11 addendum 7, same evening (deleting a card deletes the project):** *"I deleted product team
cards from the console where they didn't disappear they came back."* The resurrection was
faithful behaviour standing on a contradiction: the console's delete removes the package ROW
(permanently — `deletePackage` passes `permanent=true`), but the tool still held the project,
and the bridge's own law is "a project with no row gets its card back" — so the next sync
re-created it, exactly as written. A card and its project are ONE thing wearing two doors; the
fix makes the delete remove the PROJECT, through the bridge, BEFORE the row (`routes/prompt_sessions.py`'s
delete door + `builder_bridge.delete_builder_project`). A project the engine cannot remove keeps
its card and the refusal says why — driven both ways: (a) delete → engine says PROJECT_NOT_FOUND
for the id → the next sync reports `created: 0` (it stayed dead); (b) engine stopped → the
delete answers 502 *"could not be removed, so the card was kept: engine unreachable"*, the row
SURVIVES, and the same delete succeeds once the engine is back. Scratch projects from the drives
were removed; the owner's own cards were never touched.

**§11 addendum 8, same evening (publish is the commit; leaving is guarded):** *"you should
probably ask the user if they try to exit the product team area without saving their project if
they want to save it or not … it's called publish at the top, that would publish it to the
console"* — and, asked what "don't save" should do: **discard it**. Landed whole:

1. **Publish = the console commit.** The platform's `DeployControl` (deploy to a public URL —
   a service the local engine has no substitute for) is unwired; in its place the top bar and
   the mobile menu carry a Publish button that flags the project in the engine
   (`POST /projects/{id}/publish`) and tells the host (`builder-published` postMessage), which
   syncs the card immediately.
2. **The commit rule.** The bridge's sync now commits only PUBLISHED projects; ABSENT IS
   PUBLISHED in the engine (`publishedOf`) — every project from before this change keeps its
   card, so the owner's own cards survived the switch with no migration. A new project is born
   `published: false` and is the sandbox's business alone.
3. **The exit guard.** Leaving the Product room — another tab, the back arrow, "My projects",
   or a console card — asks the question only where it means something: no project → free;
   published → free; unpublished and BLANK → discarded in silence (born from a click, never
   used); unpublished WITH WORK → a modal: *Publish to console / Discard idea / Keep working*
   (no ambiguous "Cancel" — discarding is destructive and must be chosen on purpose). An
   unreadable engine lets the person leave; a guard that traps someone on a stopped process
   would be worse than the risk.
4. **Driven whole, every branch:** new project → unpublished → the sync creates NO card;
   `state` reads `{published:false, has_work:false}` (the silent-discard case) and
   `{published:false, has_work:true}` after a prompt (the ask case); Publish → the card exists
   in the same breath (`created: 1`); Discard → the project is gone (`PROJECT_NOT_FOUND`).
   Frontend `tsc` exit 0; builder `tsc` exit 0. Three self-inflicted edit mistakes along the
   way — a clipped docstring twice and a clipped function body once, all caught by the
   parse/syntax checks in the same pass and repaired (the record keeps its mistakes).

**§11 addendum 9, same evening (the model moves back to flash):** *"let's switch our model back
to DeepSeek flash. Which is you. Now you can do the assembly and talk to yourself."* Both of
the house's consumers moved together: the app's assembly + Grace (`backend/.env`,
`DEEPSEEK_MODEL=deepseek-flash` — the record-keeping comment in `grace_gui.py` carries the
owner's words) and the builder's engine (`local-vcaas/.env`). Measured on the switch: a builder
build 5s vs 12s for the same prompt (938 tokens), a console assembly 2s with all 17 cards and
the 8 product-team cards intact. The env value remains the one knob per system.

**§11 addendum 10, same evening (the gate's ring on every assembly gate):** *"we have a spinner
on the login gate while it's assembling — it has a nice spinner with a yellow indicator on it.
Can you put those spinners back to our assembly gates?"* The sign-in gate's amber indicator
(rgba(240,179,35,0.25) ring, solid #F0B323 top — `GateSplash`'s own ring) now replaces the plain
teal ring in all three assembly gates: the sandbox's `slot="spinner"` (every room's assembly),
`ConsolePage`'s internal loading card, and the PRODUCT room's own opening state — which is the
one that read as "the renderer has lost its spinner", because that room no longer assembles
through the renderer at all; its gate is the builder's `<builder-embed>` coming up, and it now
carries the same ring. Frontend `tsc` exit 0.

**And the same evening's shapes, verified rather than assumed** (the owner's questions, *"I'm
not seeing the descriptions … maybe I need to remove a couple cards and test that"*): the four
product-team cards standing right now (product-idea-mfl, product-idea-ljf, coffee-shop-demo, the
legacy Wireframe Draft — Test) ALL carry a description in the rows and in a fresh console
assembly — a stale tab is the only way to not see them. And the owner's own test already ran:
four cards deleted (app-app, can-you-build-a, product-idea, product-idea-isq) took their four
PROJECTS with them — the cascade (addendum 7) doing exactly what it was built for. The projects
created by later Product clicks are UNPUBLISHED — deliberately card-less until Publish
(addendum 8) — which is the likeliest thing "not seen" meant.

**§11 addendum 11, same evening (the name, editable in place):** *"add it at the top of that
rename … activate that name layer and just type in a different name and then just hit enter to
save."* The project menu's top row — the small-caps line that showed the id — is now a FIELD: it
edits the LABEL through the builder's own client (`vcaasApi.projects.update` → `PATCH
/projects/{id}`, the platform's documented contract), Enter or leaving the field saves, Escape
puts it back, an empty field clears the label so the id shows again. The platform's own copy
rule is kept: this is a NAME, never called a rename — the id is the address and cannot change.
The engine's PATCH grew the platform's per-key semantics (`null` clears; one key never blanks
another). Driven through the builder's proxy: name → header shows it; published → the console
card is titled "Coffee Shop Redesign"; emptied → back to the id; scratch removed. Builder `tsc`
exit 0. (The i18n keys were `workspace.projectSettings.*`, and the client method is `update` —
the typecheck caught both, plus one botched edit of mine that briefly left the page returning
null, reverted in the same pass.)

**Addendum to §11.11, same evening (the prefix, and the ghost explained):** seen in a fresh
incognito window, the field was there — the old tab was carrying session state from before the
night's dev-server restarts (a dead HMR socket and the JS it loaded hours earlier), which is the
whole of the "ghost coding place" scare; `Cache-Control: no-store` on Vite's source modules means
nothing on disk may hold them, and there is no service worker. And the owner's refinement on the
field itself: *"the user might not know what that is. I just add a prefix to that … just
'Rename:'"* — the menu's top row now reads **Rename:** before the name field, and the field's
all-caps transform (an id-style leftover) is gone so a typed name reads as typed. Builder `tsc`
exit 0.

**§11 addendum 12, same evening (the empty-state texture, and the card that sits on it):** the
owner's texture (*"just make this the background"*) landed on the STAGE's empty surfaces only —
the engine-served splash and the room's opening gate — after one correction: it was first put
behind the chat's empty state too, and the owner moved it back (*"you put it on the chat
background. It should be on the other side where the stage is"*). Tiled, never stretched (the
image is a seamless lattice). And the splash's message, which floated ON the lattice, now sits
ON it properly: a white card (dark variant in dark mode), 50px padding, 18px radius, soft
shadow — *"we need to wrap this text in a container with a pretty thick padding like maybe 50
pixel padding and center."* The engine serves the texture from its own asset desk
(`local-vcaas/assets/`, `/assets/<name>`, regex-whitelisted). Verified: the texture 200s on the
preview's own host, the splash carries the card, both typechecks clean.

**§11 addendum 13, same evening (the default name; the id stays forced):** *"product-idea-m1r —
instead say 'My new product idea'"*, and: *"you can force an ID if they don't title it on
save."* Both are now the design and were driven: the ID stays a forced, unique, generated slug
(it is the project's ADDRESS — one per click, suffix and all, never editable), while the NAME
defaults to **"My new product idea"** — written as the label by whichever door births the
project (the Product tab's `POST /api/builder/new`, or the builder's own New project, which
mirrors the same words by hand). The splash shows the NAME when it exists (the engine's
`emptyProjectPage` reads `label || projectId`), so nothing reads "product-idea-dvr" to a
person; renaming replaces the name and nothing else; clearing the name falls back to the id —
the address is the last resort, per the platform's own semantics. Driven whole: create → label
"My new product idea" → the splash shows it → publish → the console card is titled it → scratch
removed.

**§11 addendum 14, same evening (the Development tab is a room: bolt.diy):** *"you could just drop
it right in there. Can't you under a development tab."* It was the LAST dead stub
(`SECTION_TABS = ['development']`, `disabled: true` in the nav, the assemble path refusing it on
purpose) — and it is now a room, the Product room's move one tab over: bolt.diy (MIT, the
web-native open app builder) cloned to `development/bolt.diy/`, installed, running on
**localhost:3230** (`npx remix vite:dev --port 3230` — the `pnpm run dev` script chain mangles a
trailing `--port`, so the direct CLI is the command; the stale Sep-27 vite of this app's own
frontend held 5173 and was cleared). The host wiring is three small edits: the nav entry loses
`disabled`, the tab handler gains a `development` branch (no A2UI assembly — nothing touches the
Composer), and the renderer branch mounts `<builder-embed src="http://localhost:3230/">` ahead of
the dead-tab check. Frontend `tsc` exit 0; bolt.diy serves 200 ("Bolt").

**THE HONEST CATCH, found before it surprises anyone:** bolt.diy ships
`Cross-Origin-Embedder-Policy: require-corp` + `Cross-Origin-Opener-Policy: same-origin` — the
isolation its in-browser runtime (WebContainers) needs. A nested document can only be
cross-origin-isolated if the TOP page is too, and this app is not, so the UI should render in the
room while the WebContainer runtime may refuse to boot inside the frame. THE LIVE TEST IS THE
OWNER'S: click Development. If the app-preview inside misbehaves, the fallback is one line —
have that tab open :3230 in its own tab instead of embedding it, where bolt.diy runs whole. Its
model keys are configured in ITS OWN settings (bring-your-own; DeepSeek among the providers), not
by our engine — a different shape of key story from the builder's.

**§11 addendum 15, same evening (the Development room's two truths, from its own console):** the
owner's console dump settled both open questions. (1) **The isolation catch is REAL, and now
measured**: `DataCloneError: SharedArrayBuffer transfer requires self.crossOriginIsolated` —
bolt.diy's WebContainer runtime cannot boot inside the frame (a nested document cannot be
cross-origin-isolated unless the top page is), so the room keeps bolt.diy's UI in the frame and
adds one honest door: a slim strip — *"bolt.diy builds and previews apps with WebContainers, which
need their own window"* — with an **Open bolt.diy ↗** button (localhost:3230, its own tab), where
it runs whole. (2) **The API gate is gone without anyone typing a key**: `development/bolt.diy/.env.local`
carries the house DeepSeek key AND the OpenAI-Like provider pointed at the hosted API
(`OPENAI_LIKE_API_BASE_URL` + the real model names, since bolt.diy's built-in `deepseek-chat`
line predates the v4 models this world serves). Driven through bolt.diy's own server: a real
completion came back (`finishReason: stop`, `deepseek-v4-pro`) — so its chat works and the
"enter your API key" screen has nothing to ask for. Also fixed while in there: the owner's
`npm run catalog:check` flagged `README.md:114` claiming 62 trusted components against the
catalog's 63 (the count moved when `builder-embed` landed) — both claims now say 63 and the
doc-claim-drift finding is gone (the other four blocking findings are pre-existing: the design
room's components against the prompt-composer catalogue).

**§11 addendum 16, same evening (the seat's green goes, permanently):** *"I am getting sick of
the green on the grace chat for composer design and console just the output area where she just
talks to the user. Let's change that green to this off permanently"* — his swatch: **#F7F8F3**.
The green was the design's `#CBE6E3`, drawn into seven FILLS across the seat: the output header's
ground (`output-header`), the chat header's block (`chat-header`), the action bar and its grip
strip (`chat-action-bar` ×2), the plugin tray (`chat-plugin-tray`), the result card's 1px
hairline and its link wash (`chat-messages`). All seven are **#F7F8F3** now — deliberately a
near-twin of the seat's own `--chat-bg` (#F7F8F2), so the output chrome melts into the quiet
ground the owner wants. ONE JUDGMENT, FLAGGED: the user's own bubble (`--chat-user-bg`) could
not take the swatch (one unit off the ground — it would vanish), so it falls back to its own
designed default, **#eef2f7**. The design-citation comments keep their #CBE6E3 — the drawing did
not change; the room did, on the owner's word, recorded in `index.css` where the tokens live.
Verified: no active green fill remains anywhere in the frontend, all five touched components
parse, frontend `tsc` exit 0, and the dev server serves the swatch.

**Correction to §11.16, minutes later (the sweep corrected me, and the record keeps it):** the
first pass replaced seven fills and the entry above claimed "no active green fill remains
anywhere" — a FINAL SWEEP proved that false: six more active fills stood in `chat-panel` (×2),
`chat-navigation-bar` (×3, the column's tab rail) and `user-response-bubble`'s own fallback.
All six are #F7F8F3 now (the bubble's fallback becomes #eef2f7, matching the variable it backs),
and the sweep is clean — THIRTEEN fills and the one variable, no active #CBE6E3 left in the
frontend, only the design-citation comments. Frontend `tsc` exit 0; every touched component
parses. A claim made before the last sweep is a claim the last sweep corrects.

**§11 addendum 17, same evening (the right slot, at last — and the record keeps me having changed
the wrong one):** the owner: *"you changed the wrong thing. You changed the frame around it. What
you needed to change was the interior area of grace. Just this one slot. And you'll want to
change back the frame to the green."* §11.16 painted THIRTEEN frames — the container's grounds,
the action bar, the tray, the panel, the rail, the bubble — and left the card alone; that is the
same defect the record already held from 2026-09-24 (*"the entire container now is a light color.
It should've only been the inside"*), and it was re-made and re-corrected in one evening. Done
now, precisely: **all thirteen fills reverted to the drawing's #CBE6E3** (frame green, bubble
green — index.css's `--chat-user-bg` back from #eef2f7 to #CBE6E3 with it), and **exactly ONE
fill moved**: Grace's own card — `chat-header.ts`'s `.shell`, `chat-output-area-results`
#40001130:5060 — whose between-runs solid goes from #ADC7C3 to the owner's swatch **#F7F8F3**
(its results state keeps #F7F8F2; the container keeps #CBE6E3). The registry's `values.card.fill`
moved with it, per the code's own rule that the file and the registry must agree, and its note
carries the owner's words. Verified: the sweep shows ONE active #F7F8F3 declaration in the entire
frontend (this card), registry.json parses, chat-header parses, frontend `tsc` exit 0, and the
dev server serves the change. Two records of the same lesson in two days is enough: when this
owner says interior, the file's own 2026-09-24 comment is the measured case to read first.

**§11 addendum 18, the same night's last act (the Development room changes tools):** *"bolt is not
gonna cut it — it's not designed properly for what I want … I think this one will work better"* —
so the Development tab now embeds **OpenHands' Agent Canvas** (the self-hosted developer control
center: OpenHands/Claude Code/Codex/Gemini agents, local/Docker/VM/cloud backends) instead of
bolt.diy. Driven: installed globally (`npm install -g @openhands/agent-canvas`, Node 24 + `uv`
both present), booted on **:8090** (8000 is this app's backend), serving 200 `<title>OpenHands</title>`,
and the room repointed plain — no strip, no door, because this one needs no cross-origin
isolation (the wall that fenced bolt.diy). Frontend `tsc` exit 0. The room's own record and
forward plan live in **`DEVELOPMENT-ROOM.md`** — including the one real decision waiting there:
the agent currently runs in LOCAL mode with full filesystem access, and the contained Docker
sandbox needs Docker Desktop installed before anyone but the owner uses that room.
