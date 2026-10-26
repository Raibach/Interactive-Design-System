# Changelog — 2026-10-26

Newest first. Each entry says what changed, why, how it was verified, and what it left open. The
prose account of the day is in [`README.md`](./README.md).

---

## The Design seat owns its chat parts

**What.** The Design room's seat now draws its own copies of every chat piece it uses: the rail, the
header, the messages, the input, the action bar, the footer, the fold, the plugin tray, the product
tools and thread, the small dropdown, the sessions feed, the error banner, the prompt textarea and the
response bubble. They live in `src/rooms/design/chat/parts/`, each with its own element name
(`design-chat-header`, `design-chat-messages`, `design-chat-navigation-bar`, and so on), and the seat
imports none of the shared `chat-*` components. The tab behaviours the owner asked for are in the
Design rail itself: closing the panel keeps the active tab filled, hover changes no colour and grows
the icon only on a tab that is not open.

**Why.** Owner, 2026-10-26: *“This is not a shared component library… we just experienced a global
catastrophe because we didn't have isolated components for that chat.”* The catalogue supplies the
shapes, styling and theme; each section builds its own controls.

**Verified.** In the Design room all sixteen design elements report `defined: true`, the room draws
`design-chat-navigation-bar`, `design-chat-header` (twice), `design-chat-messages`,
`design-chat-action-bar`, `design-chat-input` and `design-chat-plugin-tray`, and **no shared chat
element is present**. Closing the panel keeps Chat filled and bold; pressing UX keeps UX filled while
closed. With UX open, resting the pointer on Chat leaves Chat transparent and grows its icon from 38
to 41 pixels, while UX keeps its fill and normal icon; resting it on UX changes nothing.

**Files.** `src/rooms/design/chat/parts/*` (fifteen copies); `src/rooms/design/chat/design-chat.ts`
(imports and template tags); `src/rooms/design/chat/design-chat.styles.ts` (tag selectors). The
shared `chat-navigation-bar.ts` was restored to its committed state for the other rooms.

**Left open, and disclosed.** Restoring the shared rail from git also discarded an uncommitted change
in it; the missing type line (`maskSrc`) was restored in both the shared file and the Design copy. The
other rooms still share the `chat-*` components, and their seats were not touched.

---

## Hover on the rail is no longer the same as the open tab

**What.** On the vertical rail (Chat, Tools, UX) the hovered tab was painted with the same fill,
the same growth and the same bold label as the open tab. With UX open and the pointer resting on
Chat, Chat looked selected and the content did not match the tile. Hover now changes **no colour at
all**: the icon grows slightly (1.08 about its own centre) and the tab's fill, height and label
weight belong to the open tab alone.

**Why.** Owner, 2026-10-26: *“I'm in UX but chat is showing as selected… Same thing for tools. It's
probably a mouse in mouse out.”* And: *“Let's switch the hover effect so that the icon grows slightly
instead of the whole tab changing color on hover.”*

**Verified.** With UX open and the pointer resting on Chat: Chat is fully transparent, its label
weight 500, its icon scaled to a 41-pixel box from 38; UX carries the fill `rgb(203, 230, 227)`, weight
700, and is not scaled. With the pointer away, Chat's icon returns to 38 pixels. All three tabs stay
74 tall, so nothing moves under the pointer. Each tab's content follows it: Tools draws
`grace-tools-chat`, UX draws the PostHog chat (`ux-chat`, `posthog-prechat`).

**Files.** `frontend/src/components/lit/chat-navigation-bar.ts` (the hover fill, the icon and label
shifts, and the bold label rule).

**Left open.** Pressing the already-open Chat tab still collapses the rail; that is the rail's
documented second gesture, not the mismatch this entry fixes.

---

## The second catalogue is gone, and the module list can no longer name a deleted folder

**What.** The Design room's five own names — `design-left-panel`, `design-middle-container`,
`design-workspace`, `tools-workspace`, `design-left-footer` — moved into the official catalogue, which
now declares 73 components. Every place that gated the room against `design-artifacts` now checks
against the one catalogue (`backend/routes/ai.py`, `backend/routes/design_console.py`). The
design-artifacts catalogue and its tree document are deleted, and its entry is gone from the tree
index and the accept list. Both modules that read catalogues now name the official path in their
module list instead of globbing the folder, so a deleted folder cannot survive in the browser's copy.

**Why.** Owner, 2026-10-26: *“design artifacts is still there. It's not supposed to be there.”* And,
of the error the old page showed: *“The catalogue above these components could not be read. Failed to
fetch dynamically imported module: … primitives/catalog.json?import”* — the module list had been
built by enumerating the folders, so it kept naming the primitives file after the file was gone.

**Verified.** A fresh page in the room: zero catalogue chips, the header reads “Raibach Prompt
Composer Catalog / 73 components”, 75 rows (73 declared and 2 recorded), and no catalogue request
fails. The audit report was regenerated against the moved names. The backend answers its catalogue
and design doors.

**Files.** `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json` (five entries added,
byte-identical round-trip); `backend/routes/ai.py`, `backend/routes/design_console.py` (gate and
catalogue id); `frontend/src/components/A2UI/catalogs/design-artifacts/` and
`frontend/catalog-tree/design-artifacts.json` deleted; `frontend/src/components/lit/figma-layers-view.ts`,
`frontend/src/components/lit/catalog-schema-view.ts` (the module list names one file);
`frontend/src/shared/tag-registry.ts` (its description of the list no longer says it switches
catalogues).

**Left open.** The room's next AI turn was not run, so the repointed gate is proven by its code path
and by the catalogue file, not by a live design assembly. The tree index's counts are regenerated
from the catalogue directories by their own script.

---

## One catalogue: the switcher is gone, and the extra files are accounted for

**What.** The catalogue chips are removed from the list, and the list reads the official catalogue
only (`prompt-composer`). The remembered choice in the browser is no longer read, so nothing on a
machine can put the list back on a catalogue that is not offered. The primitives catalogue is
deleted — its file, its tree document, its entry in the tree index and its place in the accept list —
because its seven names are all already in the official catalogue. The design-artifacts and carbon
files remain on disk; neither is offered in the list.

**Why.** Owner, 2026-10-26: *“We only need the official one. I'm not able to even load primitives. I
don't even think that's real. I don't want the design artifacts because that seems like an attempt to
duplicate the primary one.”*

**What the measurement showed.** The primitives catalogue was real — pressing its chip drew seven
rows. What failed was its **audit**, with a 503: the checker produces a report for one pipeline, and
prompt-composer is that pipeline; the other three never had a report. Its seven names are a strict
subset of the official catalogue's names, so it added no name and nothing was lost by removing it.
The design-artifacts catalogue is **not** a duplicate of the whole catalogue: it holds five names the
official one does not — `design-left-panel`, `design-middle-container`, `design-workspace`,
`tools-workspace`, `design-left-footer` — and the Design room's own surfaces are validated against it
(`backend/routes/ai.py`, `backend/routes/design_console.py`). Removing it as it stands would stop the
room's own components from being accepted; those five names must move into the official catalogue
first. The carbon catalogue is what the Apply Carbon control writes through; the file stays so that
control keeps working, and the list no longer offers it.

**Verified.** In the room: zero chips, the header reads “Raibach Prompt Composer Catalog / 68
components”, 70 rows (the 68 declared and the 2 recorded), and no catalogue request fails. The
search, header and rows are the whole column.

**Files.** `frontend/src/components/lit/figma-layers-view.ts` (switcher, remembered choice and chip
styles removed); `frontend/src/rooms/design/tools/ToolsSeat.tsx` (the model's catalogue fact is
written as the official name; the switch listener removed); `frontend/src/components/A2UI/catalogs/
primitives/` and `frontend/catalog-tree/primitives.json` deleted; `frontend/catalog-tree/index.json`
and `backend/routes/figma.py` (`_ACCEPT_SYSTEM_CATALOGUES`) updated.

**Left open.** The design-artifacts five names and the two validators are the next step, and were not
touched. The other two catalogues' audits still have no report, and are no longer reachable from the
list.

---

## The list has a search box, and the catalogues sit under the name

**What.** A search box is the first thing in the list, above the catalogue's own block. Typing
narrows the rows to those whose name, tag or Figma layer contains the words; the line under the box
says how many of how many are shown, and a search that matches nothing says so in words rather than
drawing an empty list. The catalogue's own count stays the total, so a short list cannot be mistaken
for a catalogue that lost components. The four catalogue chips (carbon, design-artifacts, primitives,
prompt-composer) moved from above the catalogue's name to below it, under the heading “Catalogues in
this repository”.

**Why.** Owner, 2026-10-26: *“add a search box for that data table at the top… it's a filter.”* And,
of the chips: *“I don't get it… if those are sub categories of the catalogue, then that should be
under this image.”* They are four separate catalogues, not sub-categories; above the name they read
as filters of a list already named below them.

**Verified.** In the room the column reads search, catalogue head, catalogue chips, rows. Typing
`button` showed 3 of 68 rows; typing a tag (`f-40001207-3497`) showed 1; typing `zzzz` showed 0 with
“Nothing in this catalogue matches…” and the count line; clearing restored 70 rows (the 68 declared
and the 2 recorded ones), and the head still read “68 components”.

**Files.** `frontend/src/components/lit/figma-layers-view.ts` (`_query`, `_matches`,
`_renderSearch`, the order in `render`, the chip heading).

**Superseded the same day.** The chips were removed entirely, and the extra catalogues with them —
see the two entries above. The search box described here is unchanged.

**Left open.** The search is literal, not meaning-based. Milvus holds no index of these components —
its collections are documents, prompts, sessions, conversations, memories, files and governance — so
a search that understood “the button we use to approve” does not exist here. Indexing the catalogue
into Milvus is separate work, and was not done.

---

## What approving will write, and what the tick chooses

**What.** Above the actions the output carries a block. When the design's layer name is already in
the catalogue, its heading reads “Already in the catalogue” and the line names the component, its
approval date, that approving replaces it, and that the existing component's own values were not
read. Every child pattern is a row with a tick box: new ones ticked (“New — will be added”),
existing ones unticked (“Existing — tick to replace it”), and a pattern that could not be built
disabled with the server's reason. The approval sends the ticked tags; the server writes those and
leaves every other pattern untouched — no file, no map entry, no allowlist entry, no catalogue
entry, no layer record — and the confirmation names what was left as it was. The replacement warning
now lists only the ticked patterns that will be replaced.

**Why.** Owner, 2026-10-26: *“I might be trying to replace it… it should show me what's there, what's
being overwritten.”* And: replacing a component must be the designer's choice, not the default.

**Verified.** A real ingest of `40001204:5752` drew “Already in the catalogue”, the root line
“This design already exists as f-40001204-5752, approved 2026-09-28…”, and six patterns, all ticked.
A panel with three existing patterns, one new one and one unbuildable one drew the three existing
unticked, the new one ticked, the unbuildable one disabled with `the layer or its tag is not
usable`; ticking one existing box made the approval carry exactly `[new-thing, old-discard]`. The
write-set rule was exercised directly: no choice → every tag; an empty choice → the root only; one
ticked → the root and that tag; an unknown tag → the root only.

**Files.** `backend/routes/figma.py` (`_chosen_write_set`, `CommitRequest.patternTags`,
`leftAlone`, the reason merged into `componentSet`); `frontend/src/components/lit/component-preview.ts`
(`_writes`, `_patternChecked`, the tick rows); `frontend/src/rooms/design/tools/ToolsSeat.tsx`.

**Left open.** The block's own heading for a design with no existing root (“What approving writes”)
was not seen in the room; the case that was seen always had an existing root.

---

## The stages of a write, named as they run

**What.** An approval and a removal record each stage as it begins, against an id the client
generates, and `GET /api/figma/steps/<id>` returns them. The panel shows the latest one on a line
above the block. A failure stops on the stage that failed and says what remains.

**Why.** Owner: *“I would like to know what's actually happening… Step-by-step and if it fails, then
we can stop at that level to report the failure.”*

**Verified.** A removal of `f-40001207-3497` (named by `figma-layers-view.ts`) was refused at the
liveness stage: the steps returned, in order, “Checking whether f-40001207-3497 is used by the
application's own code…” then “Stopped at: … it is, in frontend/src/components/lit/figma-layers-view.ts.
Nothing was removed.” The panel showed the refusal on the stage line after the two presses, and the
component was untouched.

**Files.** `backend/routes/figma.py` (`OP_STEPS`, `_op_step`, `GET /api/figma/steps/<id>`, stages in
`_remove_component` and `api_figma_commit`); `frontend/src/components/lit/component-preview.ts`
(`progress`); `frontend/src/rooms/design/tools/ToolsSeat.tsx` (`watchStages`).

**Left open.** The approval's own stages run through the same line but were not watched on screen;
the removal was, because a removal can be refused without writing.

---

## A date for every row — built, measured, and removed the same day

**What.** Every catalogue row was given a date: the approval record's date where one exists,
otherwise the modification time of the component's own file, returned for the whole catalogue by
`GET /api/catalog/updated/<pipeline>`. It was measured stable — 72 rows in the same order across a
page reload — and then the owner looked at the top of the list and asked why the three rows there
were not the components he had been working on.

**Why it was wrong.** They were `component-preview`, `figma-layers-view` and `figma-ingest-form`,
and they were at the top because their files had been edited that morning — by this program's own
work, not by a design change. A file's write time is not the component's date when the program is
being worked on.

**What stands instead.** The approval date is the only date this system records for a component. A
component with no approval has no date, sorts below every dated one, and keeps the catalogue's own
order among its peers. The dates address was removed with the rule, so no part of it remains.

**Verified.** The rule's other half was measured earlier with a real approval (72 rows, identical
across a reload); the removal is recorded here rather than left as a claim that the rule works.

**Files.** `frontend/src/components/lit/figma-layers-view.ts` (`_modifiedFor`, `_updatedAt` removed);
`backend/routes/figma.py` (the dates address removed).

---

## The pattern list stops at an instance

**What.** Two corrections to the pattern set. The walk no longer descends into an INSTANCE: its
contents are that component's drawing, not this design's patterns. And an INSTANCE whose component
is one this system ships is not a pattern at all — it is `_name_instances`, stated under “Same
component, other place”, with nothing written for it. `_name_instances` now recognises an instance by
the component it names (`componentId`), not only by name and occurrence.

**Why.** Measured on `System_Role`: ten entries in the pattern list, four of them the insides of an
instance of a chevron — `Arrow_drop_down` and `Vector 10`, twice, with tags nothing can write. They
read as four problems in a design that had none.

**Verified.** The same design now yields six patterns, all drafted, and no phantom entries.

**Files.** `backend/routes/figma.py` (`_component_set`, `_name_instances`).

**Left open.** An instance of a component this system does not ship is still a pattern whose tag is
derived from its occurrence; whether it should be drawn as a new pattern or refused is a decision
not taken today.

---

## The pattern library: a name is an identity, and approval registers what it names

**What.** The ingest now reports the **pattern set** of a design — every child that is a frame, a
component, an instance or a vector — with its layer name, its path, its node id, the parent it was
measured under, and its own annotations. A child whose layer name matches an existing catalogue
component carries that component's tag and is marked as a replacement; a child with a name of its own
carries its own tag and is a new pattern.

Each pattern is rendered from its own measurement, put through the same proof, and compiled. Only a
pattern that is exact is registered at approval, with what the root gets: file, Figma map entry,
allowlist entry, catalogue entry, record with its facts and annotations, and a database row with its
own approval date. A pattern that is not exact is named in the confirmation with its reason.

**Why.** Owner, 2026-10-26: the design system is a pattern library; the name decides whether a child
replaces an existing pattern or becomes a new one; annotations belong to the occurrence, because a
button behaves differently inside different parents.

**Verified.** Node `40001421:5467` yields three patterns — `approve-button` (16/16 facts exact),
`discard button` (15/15), `remove-button` (16/16), no gaps. A full approval wrote four files and
registered the three patterns; all four tags are declared in the catalogue and have records; the
three files are on disk at about 3.4 KB each. The catalogue audit reported 69 components, 46 findings,
5 blocking.

**Files.** `backend/routes/figma.py` (`_component_set`, `_node_by_id`, pattern drafting and proof,
pattern registration in `api_figma_commit`); `frontend/src/rooms/design/tools/ToolsSeat.tsx`
(confirmation names added/replaced/skipped).

**Left open.** The catalogue grows by one entry per uniquely named pattern, by design. Patterns that
are not exact are skipped with a reason rather than written.

---

## Feedback: the third column never goes silent

**What.** During an ingest the column opens immediately with a spinner at the exact centre and the
real step beneath it, updated as the work advances. During an approval the Approve button turns and
reads “Approving — writing it into the catalogue…”. On success the column stays open, shows the
component the catalogue now holds, and states the confirmation. When the component already exists, the
button's label stays neutral and pressing Approve raises a red readout naming what is replaced; a
second press confirms. The discard button turns while the removal runs. The list is ordered by last
modified, and the newest row carries a “just added” mark.

**Why.** Owner: *“The third column should not disappear on a successful gesture… it has to be a
read-out.”* A commit takes about 69 seconds on this machine (component-manifest analysis and the
catalogue audit), and the silence read as a failure.

**Verified.** In a browser: the pending column renders with an animating ring and the real step; the
first Approve press produced the warning and dispatched nothing, the confirm press dispatched once;
the discard button renders “Discarding…”, disabled, with its ring; the newest row carries the mark.
The spinner's centre was measured equal to the column's centre after correcting a three-pixel offset
caused by the ring's border sitting outside its box.

**Files.** `frontend/src/components/lit/component-preview.ts`; `frontend/src/components/lit/figma-ingest-form.ts`;
`frontend/src/components/lit/figma-layers-view.ts`; `frontend/src/rooms/design/tools/ToolsSeat.tsx`.

**Left open.** The results are now accordions (specs per layer collapsed, sections open); the source
starts closed.

---

## The results are accordions

**What.** Specs, annotations, facts read and the component source are each a collapsible section.
Inside Specs, each layer is its own accordion and starts collapsed.

**Verified.** Rendered with a real ingest answer: four sections, the three evidence sections open and
the source closed, eight per-layer accordions each closed.

**Files.** `frontend/src/components/lit/component-preview.ts`.

---

## The preview's records are ephemeral, and the database is untouched before approval

**What.** The measurement table lives inside the preview's folder (`frontend/.preview/<job>/facts.json`)
and in memory, and dies with the preview. Discard forgets it. Ingest and discard write the log file
only; the database is written by an approval. A preview folder left by a previous process is removed at
start, with the folder names printed. Every discard writes an audit of what remains.

**Why.** Owner: *“It has got to be held in a temporary ephemeral state… you shouldn't even be adding it
to the database until approval.”*

**Verified.** A discard answered “Removed completely: no entry, no folder, no files, no other preview”,
and the facts address for that job answers 404. The database's activity list held the same rows before
and after an ingest, while the log file gained the ingest's line. Two ingests in a row leave exactly
one preview folder, and the first module answers “Nothing is being previewed… it was replaced by the
next ingest.”

**Fixed on the way.** Remembering a new preview evicted the previous one and forgot the node's
measurement *before* the comparison ran, so every second ingest said “this is the first”. The previous
record is now read at the start of the ingest.

**Files.** `backend/figma_facts.py`; `backend/routes/figma.py` (`_log_ingest(to_db=False)`,
`_sweep_orphaned_previews`, `_preview_audit`, `GET /api/figma/preview/audit/<job>`).

**Left open.** Ingest and discard rows written before this rule remain in `figma_ingest_activity`;
removing them is destructive and waits on the owner.

---

## The transform is drawn, and the mirror is why

**What.** A layer whose stated transform is not the identity is placed by that transform: its
translation becomes its position, its 2×2 part a CSS matrix with the origin at the corner. The
`rotation` field is no longer read to make a picture. Transformed children are positioned by their
own transform even inside an auto-layout parent.

**Why.** Owner: *“The rotation is a hallucination.”* Figma reports `rotation: 3.14159` on a node whose
transform is a horizontal mirror (`[[-1,0,624],[0,1,13]]`). Reading the field produced a 3.14° turn the
file never asked for.

**Verified.** After the correction the component measures 662 × 66 with the buttons at 209, 343 and
482 — 124 × 40, 124 × 40 and 142 × 40, at 13 from the top — the design's own numbers to the pixel.
Earlier, the same buttons measured 28 pixels off after flex placement and the group's mirror.

**Files.** `backend/routes/figma.py` (`transform` carried from `relativeTransform`);
`backend/design_renderer.py` (`_linear_of`, placement and the matrix declaration);
`backend/figma_fidelity.py` (transform rows carried in the proof).

**Left open.** The proof compares values; it cannot yet compare how transforms compose. The mirror
was exact by every value and wrong as a picture — that limit is written in the README.

---

## The proof compares values, and the answer leads with what it could not read

**What.** Every fact is a pair — the Figma value and the drawn value — with `differs` when they are
unequal. The count covers every fact that asks for a drawing, so 100% cannot appear beside a named
failure. The answer opens with a sentence naming what could not be read, and every gap says whether
it is the program's or the file's. The commit is refused with 409 while any fact differs. A fact table
is kept per job, and two ingests are compared by layer name path.

**Why.** Owner: *“Just report it. Say I can't read this, or I built it anyway and did not read this,
this, this.”* And: the proof had been matching words, so one-pixel and one-digit changes passed.

**Verified.** A stale drawing compared against a moved design reports
`position | x 16, y 21 → left 16, top 20` and `fills | #ff0001 → #ff0000`. A whole-component canvas move
reports zero changes; a one-pixel move of one button reports exactly one row
(`left 142, top 0 → left 143, top 0`). A commit against a design with a difference is refused and
names the line.

**Files.** `backend/figma_fidelity.py`; `backend/figma_facts.py`; `backend/routes/figma.py`;
`backend/scripts/figma_compare.py` (the same comparison without the server).

**Left open.** `childMatches` is a stale always-empty field; the pattern set carries the child facts
now.

---

## The measurement faults the value comparison found

**What.** Each of these was invisible to a word-matching check and is now corrected:

- gradients and translucent fills reached the style as prose (`… (gradient, 2 stops)`,
  `#000000 (fill opacity 0.5)`), which the browser discards — they are real CSS now;
- a fill stack kept only its first fill; the whole stack is emitted in the design's order;
- two shadows kept only the last; multiple shadows are one declaration;
- a drawn shape's outline was read only for `VECTOR`; boolean operations, stars, ellipses and
  polygons now carry their path, through one list used by both the reading and the drawing;
- a frame with no auto-layout drew at 0 × 0 because a custom element is inline until a display is
  declared; the box is declared;
- child offsets were rounded to two decimals while the check expected four; size and position to one
  decimal; the artwork's box to two — each now carries four, the precision the drawing keeps.

**Verified.** A boolean triangle renders with its `<svg>`, path and fill inside a 120 × 120 frame;
a free-frame root measures 120 × 120 where it measured 0 × 0.

**Files.** `backend/routes/figma.py` (`_figma_paint`, `_figma_color`, shape family, precision);
`backend/design_renderer.py` (fill stack, shadows, `display`).

---

## One face: IBM Plex Sans, with the stated family kept

**What.** The drawing emits IBM Plex Sans for every design. The fact row keeps the family Figma
states, and the drawn value is recorded as a substitution (`accepted`), with a warning at the root of
the answer naming the layers and the family. Eight of the room's own files that still named `Inter`
were switched.

**Why.** Owner: *“We should be using IBM's font. I added it as a ubiquitous font that replaces font
everywhere in the system.”* `Inter` is not shipped, so the browser fell back and the tool looked like
Times.

**Verified.** A rendered component's text resolves to `"IBM Plex Sans", sans-serif` with the face
loaded; the design reports “FONT WARNING: 3 layer(s) use Inter …”, and its own count stays 100% because
the substitution is a recorded decision, not a defect of the design.

**Files.** `backend/design_renderer.py` (`_local_face`, both emission sites);
`backend/figma_fidelity.py` (the substitution row and the warning);
`frontend/src/rooms/design/{ux,tools}/*.ts` (eight files, `Inter` → IBM Plex).

---

## The catalogue components could not draw at all

**What.** `frontend/src/components/lit/ingested.ts` imports every generated `f-*.ts` so each defines
its custom element. Nothing imported it, so no generated element was defined in the page: a catalogue
row resolved to a tag that nothing defined and the pane drew a shadow of a previous state.

**Verified.** After adding the import to `main.tsx`, `f-40001204-5752`, `f-40001207-3497`,
`f-40001207-3559`, `f-40001206-2888` and `f-40001177-2476` all report `defined: true` in a browser.

**Files.** `frontend/src/main.tsx`; `frontend/src/components/lit/ingested.ts` (unchanged; the import
was the missing line).

---

## The list is ordered by last modified

**What.** The declared rows are sorted by approval date, newest first; a component with no recorded
approval sorts last in catalogue order. The newest row carries a “just added” mark.

**Why.** Owner: *“The list should be organized by last modified… it should be at the very top.”*

**Verified.** Type-checked and rendered; the mark reads the activity record's newest approval, so it
names the component the last write produced rather than the last key in the catalogue file.

**Files.** `frontend/src/components/lit/figma-layers-view.ts` (`_modifiedFor`, `_renderDeclared`).

---

## One verification that is worth repeating

The day's largest trap was the day's own instrument. Three reports were false before they were true:

1. a hidden effect counted as a stated fact (fixed: an all-invisible effect list asks for nothing);
2. a drawn offset rounded to two decimals compared against four (fixed by carrying four decimals,
   not by widening the check);
3. a whole-component canvas move reported as a change to every child (fixed: a position is the
   layer's own offset inside its parent).

Each was found by asking what the number was measured from. That is the habit this folder exists to
keep.
