# The wireframe draft canvas — a blueprint to evaluate

Written 2026-10-02, from the owner's brief and the tree as it stands. **Nothing is built.**
This is the file touch-point map and the decisions, for you to argue with before code.

The feature, in the owner's words: a "restricted vibe-coding drafting canvas" where a product
person assembles interfaces out of the **real, registered components** — arranged by the model from
a business requirement, adjusted by hand — inside this package's own surface. Selected as a flow
option or a tool option inside the prompt, per the owner.

---

## §1 — The laws this obeys, and the five corrections

Acknowledged and kept: the **catalog is the only palette** (no invented tags, no raw HTML/CSS, no
invented props); the graph is emitted as **flat, id-referenced data** (A2UI's adjacency list — a
component's template never renders another component); every hand gesture is an **event the host
answers** (`flow-node-moved` / `flow-node-added` already exist); the **package is the authority**
(§1.2 of `PLAN-ORCHESTRATION-CANVAS.md` — Grace is the package's seat, her conversations are the
package's rows, verified in the database).

Five claims in the brief do not hold in this tree, and each one changes the build:

1. **There is no SFC toolchain.** `<template #node-custom_lit_element>` cannot compile: the frontend
   declares no `@vitejs/plugin-vue` and no `@vue/compiler-sfc` — Vue reaches us only through
   `@vue-flow/core`, and every node type here is a **render function**
   (`canvas/vueFlowCanvas.ts`'s `ModuleNode` is `h('div', …)`, not a `.vue` file). A node that hosts
   one catalog component is a render function that creates the element and sets its props.
2. **Vue Flow does not own the gestures, by law.** The library is mounted with
   `nodesDraggable: false, panOnDrag: false, zoomOnScroll: false, connectOnClick: false,
   applyDefault: false`, and the file says why: *"THE LIBRARY'S OWN GESTURES ARE ALL SWITCHED OFF …
   there is exactly ONE implementation of a drag, a pan, a zoom or a connection, and it lives in the
   element."* So `@node-drag-stop` never fires and is not the capture point; `_onNodeDown` →
   `_onMove` → `_onUp` → `flow-node-moved` is, and it is already tested.
3. **A second `surfaceId` is refused by the shell.** `shared/a2ui-envelope.ts` collects surface ids
   and returns `ok: false`, code `SURFACE-CONFLICT`, when an envelope names more than one: *"this
   shell draws one."* So the draft is **not** a second A2UI surface (`grace-wireframe-draft`); it is
   a **view/component inside the one surface**, reading its own **data-model path** — the same shape
   the execution canvas already uses (`agent-flow` reads `/session/middle_column/flow`). The
   payload in the brief is right in spirit; only its name is wrong: it is a data model, not a
   surface.
4. **`arrangeAsHub` is not a layout engine for this.** It places the *execution* graph's
   notes|seats|steps columns from the prompt's rows and the run's facts (`shared/agentFlow.ts`). A
   wireframe has no run and no rows-as-columns: its positions come from the assembler's own answer
   and the person's hand, and its **size** comes from the container (the canvas's container queries
   already give way under 480px and 340px). Nothing of §2.B's layout work is reused, and nothing of
   it is broken by this.
5. **"Re-saves the package" per gesture is a second writer.** Today the drawn graph is written to
   the package by **Save** (`WAI:2441-2456`, `workspace.graph`). If a drag must persist the moment
   it ends, autosave-on-gesture-end becomes **the** writer and Save reads it — one writer either
   way, never both. That is a decision, named in §6.

## §2 — Where it lives: the fork

Three placements exist; all ride mechanisms the app already has, and they are not exclusive (a
tool declares it, the chosen column draws it).

| # | placement | the mechanism that already exists | cost |
|---|---|---|---|
| A | **her seat's view slot** | "One slot, four views: the slot stays generic and the view decides" — Trace, Versions, Tools, Approvals; a fifth view is a new child in the host's slot | smallest; the panel is a narrow column, and the seat is where the person talks, not builds |
| B | **the output column, behind its selector** | `output-controls`'s tile, whose annotation already says "switching between the canvas view, the raw output, and more to come" — and whose menu is P0's open item | medium; the column already hosts the drawing machinery, and "what is being built" is what that column is for |
| C | **a tool named in the prompt** | the register (`tools`) + `FLOW-REQUIREMENTS.md` T1/T2 — "every tool named in a prompt is registered; a `call` tool has something behind it" — so the prompt says `{{tool:…}}` and the run opens the view | largest, and the honest answer to "a flow option or a tool option the user selects inside the prompt" |

**Recommendation: B for the drafting view, C for the declaration.** The output column is where the
machine's work is shown and already owns the canvas's whole vocabulary (the element, the gestures,
the lock, the viewport, the selector that documents a third view); her seat stays the conversation.
If you would rather have it beside the thread, A is cheaper and legitimate — but it puts a build
surface inside the column whose job is to talk.

## §3 — The three mechanisms, against this tree

**1 · The component ingestion loop.** The components are **not in the database** —
`PLANS.AGENT/design-artifacts-database-plan.md` states it: they live in the repository, in
`frontend/src/components/registry.json` (`figmaName → litComponent → file`), `tag-registry.ts`
(tag, surface/column, props, events, constraints) and the **catalogs**
(`frontend/src/components/A2UI/catalogs/*/catalog.json` — JSON Schema, components **keyed by name**,
each `allOf`-referencing `ComponentCommon`, with the property descriptions naming the file that
implements it). The assembler's context barrier is therefore a **file read at assembly time**, and
it must read **one** source for one fact: the **catalog** (the thing the model already composes
surfaces against — see `render-run`) — not the catalog *and* `registry.json`, which describe the
same components twice.

**2 · The assembly mapper.** The emitted shape is the app's own: one flat component list with ids +
a positions map, written to a data-model path (e.g. `/session/output_column/draft`) and read by the
view — never a nested tree, never a second surface. Positions are the one thing A2UI has no notion
of, so they ride in the same payload as data (`{ id → {x, y} }`), which is exactly how the execution
canvas already carries its places (`FlowPosition`, `shared/agentFlow.ts`).

**3 · The drag/tray capture.** The element captures (see §1.2); `flow-node-moved` and
`flow-node-added` are the payloads; the host writes; the writer question is §6.3. The **tray** is a
new control with an existing precedent: the canvas already opens a **kind picker** when a line is
dropped on empty space (`agent-flow._picker`; its list comes from `SECTION_TYPES`). A tray is that
picker's contents swapped from "the prompt's seats" to "the catalog's palette" — one list, one
reader, two uses.

## §4 — The palette is a SUBSET, and that is the one genuinely new invariant

Not every registered component may be instantiated in a draft. The catalog contains `chat-panel`
("one Grace — a surface mounts this OR a bare chat-panel, never both"), `agent-canvas` (the plug-in
itself), `canvas-footer` (the canvas's own furniture), `model-selector-button` (a declared
placeholder). A wireframe node hosting any of those would be a second Grace, a nested surface, or a
control that does nothing — all three forbidden.

So the draft needs a **declared, draftsafe palette**: a per-component marker that says "this one may
be placed in a draft, with these props". The mechanism exists — `tag-registry.ts` entries already
carry `constraints`, and the catalogs carry `annotation` — so this is a field to **declare**, never
to infer. Until it exists, the assembler's palette is undefined and the model would be choosing from
components nobody said were placeable.

## §5 — The file touch-points

| file | what changes | why there |
|---|---|---|
| `frontend/src/shared/tag-registry.ts` + `frontend/src/components/registry.json` + `…/A2UI/catalogs/*/catalog.json` | a `draft` marker on the components that may be placed (and the new element's own entry, when it exists) | the registry is the declarative surface; nothing ships before it is declared |
| a new `frontend/src/components/lit/canvas/…` node renderer | a node type whose render function creates one catalog element and sets its props as **properties** (non-primitives cannot ride attributes) | `vueFlowCanvas.ts` is where node types live; render functions, no SFCs |
| `frontend/src/components/lit/agent-flow.ts` **or a sibling element** sharing its contract | the gesture owner + the reader of the draft payload; if a sibling, it reuses the same event vocabulary (`flow-node-moved`, `flow-node-added`, `flow-select`, `flow-action`) | one implementation of a gesture, whichever element carries it |
| `frontend/src/shared/agentFlow.ts` or a sibling builder | the graph builder for a draft: components from the assembler, places from the person — no rows, no run facts | the builder is where a graph is a function of its inputs; a draft's inputs are different |
| `frontend/src/pages/WritingAreaIndex.tsx` | the host wiring: the selector's third view (B), the ask that produces the draft, the write path, the save | every write and every arrangement already lives in the host |
| `frontend/src/components/lit/output-controls.ts` | its menu made real (P0's open item) with the draft as an entry | its own annotation names this exact job |
| `frontend/src/components/lit/chat-panel.ts` | only if the view is A: a fifth view in the seat's view slot | the slot's consumer |
| backend `tools` register (+ `routes/…`) | only if the declaration is C: a registered tool with a runner behind it | T1/T2: a name that is not in the register is a step that cannot happen |
| `PLANS.AGENT/design-artifacts-database-plan.md` | read, not edited: an assembled wireframe is a design artifact, and that plan is where its store is argued | the artifact store is `prompt_artifacts` (exists, empty) / the plan's `design_components` |

## §6 — The decisions only the owner can make

1. **Placement** — A (her seat's view slot) or B (the output column's selector). Recommendation: B.
2. **Declaration** — is it a tool named in the prompt (C), or a view a person opens? Both can be
   true; C is what makes "a flow option the user selects inside the prompt" literal.
3. **The writer of a drag** — Save persists it (today), or autosave-on-gesture-end becomes the one
   writer (then Save reads it). Not both.
4. **The palette's home** — the `draft` marker in `tag-registry.ts`, the catalogs, or both (and if
   both, which one the assembler reads).
5. **The store** — the draft lives in the package's own state (`workspace.*`, today's shape) or in
   the artifact tables (`PLANS.AGENT/design-artifacts-database-plan.md`) — the plan exists and is
   unanswered; this feature is the first thing that would need it.

## §7 — What this does NOT touch

The execution canvas, its lock, its controls, and P1's layout work are untouched: a draft is a
different graph from a different input, drawn by its own element or by the same element reading a
different path. Nothing in §2.B changes, and nothing in P0 is re-opened.

---

## §8 — Amendments, 2026-10-02: the owner's five decisions, and four corrections

**Decided:** 1 → **B** (the output column, behind its selector). 2 → **the artifacts table**.
3 → **autosave-on-gesture-end is the one writer**. 4 → **the marker lives in `catalog.json`**.
5 → a cross-room capability guard (assessed below). Four of them carry a correction that has to
land before code, and three are facts from the tree, not opinions:

1. **The store is CONVERSATION-keyed, not package-keyed.** Measured on the local database,
   `prompt_artifacts` is `id, conversation_id NOT NULL, project_id, artifact_type NOT NULL,
   artifact_data jsonb, created_at` — indexed on conversation and project, **0 rows**, and **no
   package/session column**. "Keyed directly to the package" therefore needs either a migration
   (the first schema change in this area) or an accepted consequence: a package with many
   conversations has many drafts, one per thread. The seat's own law says the package owns its
   conversations, so conversation-keyed is *coherent* — but it must be chosen, not drifted into.
   → **Decision needed: add `session_id`, or accept conversation scoping.**
2. **The palette filter's home is `backend/routes/ai.py`, NOT `figma.py`.** The assembly path
   already reads the catalog there: `_catalog_component_vocabulary()` — *"The component list for a
   prompt, GENERATED from the catalog… Loud on an empty catalog rather than degrading to a shorter
   list"* — plus `a2ui_catalog`, `a2ui_catalog_id`, `a2ui_catalog_for`. `figma.py` is the **ingest**
   (Figma → catalog entries); putting an assembly-side vocabulary filter there is the same mistake
   as two readers for one fact. The ingest's legitimate role for the marker is **proposal**: it can
   see facts (a component that fetches nothing; not a shell element) and record a candidate through
   its own verdict vocabulary (`verdict, written, rejected, reason`) — because `draft: true` is not
   a Figma fact, and *"the ingest carries every fact Figma states, and nothing unexamined may
   pass."* → **Decision needed: who marks the palette — a hand declaration, or ingest-proposed and
   person-confirmed.**
3. **`flow-node-moved` already exists** — the element emits it on `_onUp` when a node actually moved
   (`agent-flow.ts`), and it is in the registry's declared event list. `flow-action{action:
   'node-moved'}` would be a **second name for one fact**, which is the shape this repo spends its
   comments preventing. The new part is only the host's write; the event needs no invention.
4. **Decision 5's premise needs restating.** The room already states her words and her capabilities
   (`_gracePrompt`; a room that states none gets a refusal *"rather than an answer from a
   stranger"*), so she structurally cannot offer drafting in a room that does not declare it. What
   is buildable is the *offer*: a model-emitted button (like `write-seat`) whose action the host
   answers — that needs an action name declared in `shared/actionLink.ts` and one host handler. What
   must NOT be built is the model "evaluating the active UI routing state": the host owns the
   routing, and the room's script is what tells her what this room can do.

**Sequencing, so each slice is real when it lands:**

| slice | what it is | blocked on |
|---|---|---|
| **S1** | the draft view: the element, the node renderer (`h()`, props as properties), the payload at `/session/output_column/draft`, the selector's third entry, the gestures reusing `flow-node-moved` | nothing — testable with a hand-written payload |
| **S2** | the store + autosave: the write path into `prompt_artifacts`, fail-loud, gesture-end | amendment 1's key |
| **S3** | the assembler: the partitioned palette, the filter in `routes/ai.py`, the model call, the marker | amendment 2's author |

S1 draws what a payload holds and needs no palette and no store, which is why it is first: it proves
the concept — a real registered component, live, at a position, moved by hand — before anything
depends on it.

**S1a LANDED, 2026-10-02** — the element, the renderer variant, the declaration; `tsc` and
`npm run build` clean. Files: `frontend/src/components/lit/draft-canvas.ts` (new), the `catalog`
variant + `CatalogNode` in `frontend/src/components/lit/canvas/vueFlowCanvas.ts`, the `draft-canvas`
entry in `frontend/src/shared/tag-registry.ts`. **Driven with a hand-written payload** (the element
is not yet reachable through the UI — the selector wiring is S1b): two nodes drawn; `Text` resolved
through `resolveTag` and the real `<a2ui-text>` mounted inside the frame with its prop arriving as a
**property** (`text === 'Hello from the draft'`); a name the catalogue does not know drawn as
*"The catalogue does not know \"NotAComponent\"."*; one drag → exactly one
`draft-node-moved {nodeId:'n1', x:80, y:100}` and the node at `translate(80px, 100px)` on screen.

**One deviation from the execution order, deliberate and recorded:** the draft's events are
`draft-select` and `draft-node-moved`, **not** `flow-select`/`flow-node-moved`. Both canvases can be
in the same room (the column switches between them) and the host listens on `window` — one name for
two facts would make the run canvas's handlers answer a draft gesture, and the draft's autosave
write fire on an execution drag. The SHAPE is identical (`{nodeId, x, y}`); the names are declared
in the registry. `flow-node-moved` keeps its one meaning.

**Still open in S1:** S1b — the output column's selector made real (P0's inert tile) with the draft
as its third entry, which is what makes the element reachable, plus its host wiring. **Then:** S2
(the store + autosave on `conversation_id`) and S3 (the palette + the assembler filter in
`routes/ai.py`).

**A trap hit while driving it, worth remembering:** the element's first drive drew the RUN's tile
instead of the catalog component — the dev page had `vueFlowCanvas.ts` cached from before the
variant existed, and Vite served my dynamic import the same stale module the app already held. A
reload fixed it. *A frontend change needs a new tab* — the same line the canvas brief already
carries.

**S1b LANDED, 2026-10-02 — the selector, and the draft reachable in the app.** Files:
`frontend/src/components/lit/output-controls.ts` (the tile opens a real menu of the views the HOST
declares, emits `view-change {view}`, and its label is read from `view`),
`frontend/src/pages/WritingAreaIndex.tsx` (`loadDraftElements`, `showDraftColumn`, the
`view-change` listener, and `setColumnView`), `frontend/src/shared/tag-registry.ts` (the header's
declared event and the constraint). `tsc` + `npm run build` clean. Driven: the menu reads
**Agent Flow / Output / Draft**; choosing Draft mounts `<draft-canvas>` with its empty state and the
tile reads "Draft"; a payload of two components draws two frames mounting the real `a2ui-text` and
`a2ui-button`; one drag emits one `draft-node-moved`.

**Two defects found BY driving, both fixed:**
1. **A tree-stamped prop goes stale.** The renderer re-hands props to elements it already drew only
   when the DATA MODEL changes and the components do not (`a2ui-renderer.updated`); a components
   change rebuilds the tree and a surviving element keeps what it was constructed with. So the
   header is written as a LIVE PROPERTY, like `holding` on the canvas and `running` on the drawing —
   `setColumnView`, with the same rAF retry. (First pass: the body swapped to the draft and the tile
   still read "Agent Flow".)
2. **Two writers raced.** The arrival default and the Run's write were both scheduled in one tick,
   the default landed last, and a column showing the DRAWING read "Output". The default writer now
   stands down when a more specific path has written (`onlyIfUnset`).

**ONE KNOWN DEFECT, NOT FIXED:** coming BACK from Draft → Output did not dispatch a second
`view-change` (measured: only `'draft'` recorded; the viewer did not mount and `draft-canvas` left
the DOM). The forward path works in every pass; the return needs one more session of diagnosis
(strongest hypothesis: the tile's menu state on the second opening).
*(Superseded later on 2026-10-02 — see README "Open, in the order they matter" item 1: the return
dispatches correctly now, and what remains there is a decision about what Output should show, the
owner's to call.)*

**AND ONE STRUCTURAL GAP THE JOURNEY EXPOSED:** in the Composer the output column does not exist
until a Run has put something there — so a package that has never run has no header, no selector and
no way into the draft. The owner's wireframing test package (`Wireframe Draft — Test`,
`6f093e1a-68ec-455b-a2f0-933a66f1027b`) is created and on the console, but **reaching its draft
needs the column to exist independently of a Run**, which is a decision: a Draft entry on the
package card, or the column shown whenever the package is open (with the draft as its default
view). Until that is chosen, the draft is reached from a package that has run.

**S2'S UI HALF, SEEN — 2026-10-02, on the Scout.** The read path and the write path are both
verified in the running app, driven through the real controls, nothing pasted into the console:
the Scout's header tile → Draft recorded exactly one `GET /api/conversations/e6608ee8-…/draft` and
the canvas drew the stored row's two components (the Text *"This tile came from the database"*, the
Button *"And so did this"*) at their stored places; one drag of the Text tile emitted exactly one
`PUT` to the same conversation and the stored `positions.s1` moved `{60,50}` → `{200,110}` with
`s2` untouched — one drag, one write, the host the single writer.

Two facts the drive fixed in the record, both worth knowing before the next drive:

1. **The drive order is the fact.** A Run forks the seat onto a fresh conversation (the recorded
   act, *"A RUN GETS ITS OWN CONVERSATION"* — it archives the thread it left and creates the
   results thread), and the draft is conversation-keyed — so a Run's own Draft view is empty BY
   CONSTRUCTION, not by defect. Seeing a thread's stored draft means: seat on that thread FIRST
   (the conversations list), then the header tile → Draft. The first pass of the drive chose Draft
   before switching the seat and correctly drew the empty state of the run's fresh thread.
2. **`output-controls._choose` is a no-op when the chosen view is the current view**
   (`if (view === this.view) return;`, its own deliberate line), so the read re-runs only on a view
   CHANGE — switching the seat while Draft is already showing does not re-read. The draft view's
   menu offers `output | draft`, and Output deletes the column (the open decision above) — so from
   the draft, the way back to a column is a Run, which forks a thread again. That is coherent with
   conversation-keyed drafts, and it is the shape R1's "draft default" has to answer to.

---

## §9 — Why the catalogs are partitioned: the owner's own words, recorded so they are not re-litigated

> *"I am going to use the Figma ingest application that we built to add a separate catalogue just for
> this. So we're not using this catalogue for the actual harness — we're gonna wall that catalog off.
> It's not going to be editable, but only by permission of a high ranking UX designer. Then we're
> gonna create a bunch of little catalogs that… are Lit catalogs… I intentionally want them
> partitioned, that's because of MANAGEMENT not because of structure. The AI I'm sure can do all
> kinds of wonderful things locking them all together but for a human I want them separate. I don't
> care if they need to be separate or not, I want them separate. I wanna look at every repository and
> see separate files, separate .TS, a different registry for these resources — like Carbon, which is
> a UI kit, or Material UI, which is a UI kit — which I will be adding to this through the Figma
> process just like we did the other one. In other words the designer can actually select inside of
> the design section: create new repository, new design system."*

And what it is FOR, which is the part that makes it architecture rather than tidiness:

> *"I need to be sure that the connection between the design part and the composer part are related,
> because what's gonna happen eventually is I'm gonna give the product teams this exact same build as
> its own dedicated section — so I'll be creating the same functionality in two spots… the composer
> is going to be a multifaceted tool that can do many different things, but for the purposes of
> marketing, I want to be able to permission-lock features and only give the product team certain
> things, give the design team certain things."*

Three consequences to hold, in the order they constrain the build:

1. **Partitioning is deliberate and load-bearing.** Never merge the catalogs into one for the draft's
   convenience — the separate dirs, the separate `catalog.json` and registry files, are the product,
   not the packaging. Reviewers read repositories.
2. **The design → composer connection is the CATALOG, and it already exists**: catalogs are files
   under `frontend/src/components/A2UI/catalogs/<system>/`, the id rides the envelope
   (`createSurface.catalogId`; `shared/a2ui-envelope.ts` reads it), and the server resolves it per
   surface (`a2ui_catalog`, `a2ui_catalog_id`, `a2ui_catalog_for` — defined in
   `backend/deps.py`, imported by `routes/ai.py`; corrected against the tree 2026-10-03, this
   line had placed them in `ai.py`). The
   Figma ingest (`backend/routes/figma.py` + the design room's `figma-ingest-form`) is what CREATES
   a system; the draft is one of the things that READS one. So "create new repository / new design
   system" is the design room's job over the same partitions the composer consumes — one mechanism,
   two rooms.
3. **The two-location build and the permission lock are a NEW fact, and it needs its own design.**
   Nothing today says *who may edit which catalog* or *which rooms may use it* — `session_permissions`
   carries roles for packages, not catalogs. So a catalog→permission declaration (editors; rooms
   allowed to draft with it) is a requirement of this feature, not a later nicety: the walled-off
   harness catalog is exactly the case the owner named. It is the fourth thing to decide, beside
   §8's artifact key and palette author.
