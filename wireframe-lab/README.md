# wireframe-lab — the wireframing and vibe-coding effort

Its own section, beside `canvas-lab/`: **canvas-lab** is the agent-orchestration canvas and the n8n
source it was studied from; **this** is the other thing — a person (later, the model) assembling
interfaces out of the **real, registered catalog components**, on a drafting canvas that is being
built into the application and **will be used in more than one place**.

## Why it exists, in the owner's words

> *"I want to be able to permission-lock features and only give the product team certain things,
> give the design team certain things… the composer is going to be a multifaceted tool that can do
> many different things… eventually I'm gonna give the product teams this exact same build as its
> own dedicated section — so I'll be creating the same functionality in two spots."*

And the catalogs that feed it are **deliberately partitioned** — a directory and a registry per
design system (Carbon, Material UI, the harness's own), walled off by management, not by structure
(see PLAN.md §9 for the full quote). That is why nothing here may merge them for convenience.

## Where the code is (it stays in the app — this folder is the plan and the record)

| piece | file |
|---|---|
| the drafting view (gestures, payload, refusal-as-a-sentence) | `frontend/src/components/lit/draft-canvas.ts` |
| the catalog node variant (one registered component per node, props as PROPERTIES) | `frontend/src/components/lit/canvas/vueFlowCanvas.ts` (`CatalogNode`) |
| the view selector (the output column's header menu) | `frontend/src/components/lit/output-controls.ts` |
| the host wiring (the switch, the header's view write, the listener) | `frontend/src/pages/WritingAreaIndex.tsx` (`showDraftColumn`, `setColumnView`) |
| the declarations (before anything ships) | `frontend/src/shared/tag-registry.ts` (`draft-canvas`, `output-controls`) |

The catalog components themselves are **files in the repository** (not the database):
`frontend/src/components/A2UI/catalogs/<system>/catalog.json` plus `registry.json` and
`tag-registry.ts`. A new design system (Carbon, Material UI) arrives through the Figma ingest and
lands as one more partition — the app reads it; this folder only records the intent.

## The homes — where this lives, and which one is primary

Three placements, locked by the owner 2026-10-02, and each has a different job:

| place | state | what it is |
|---|---|---|
| **Design** (top nav) | live — the Figma ingest form and the catalog browser are already there (the partitions list with their counts: `design-artifacts 62`, `ecommerce 38`, `primitives 7`, `prompt-composer 60`) | **CATALOG MANAGEMENT, AND THE INGEST'S HOME.** *"Design will manage the input and control of catalogs and design system resources… we can add that ingest function to our current Figma ingest function."* The **Add Design System** upload lands here, beside the Figma hooks — and it must say which catalogue it is creating, never assume: creating a NEW partition is the action, and no code path may write into an existing one. **The system catalogues stay locked**: *"System catalogues like our current lit catalog will be only available to people with high-level permission."* |
| **Product** (top nav) | a **deliberately dead stub** today (`LeftVerticalMenu.tsx:580`, `disabled: true`; WritingAreaIndex:606 — *"DEAD TABS — Product, Development and Governance are STUBS, and they are dead on purpose"*) | **THE PRIMARY WORKSPACE, and its DEFAULT VIEW IS THE DRAFT.** *"The product person will enter their business requirements in the prompt section just like the composer… but instead of outputting the agent orchestration canvas it would automatically load the drafting wireframe output."* Turning the tab on is an ACT, not a bug fix: it un-does a recorded decision and means a real ROOM — the tab enabled, a `render-product` intent, a surface the model composes against the catalogue (never a hand-written chain: the §00c violation), and the run path in this room composing the DRAFT rather than the execution drawing. The design-system picker and the palette live here. |
| **Composer** | live — the draft is its output column's third view (S1a/S1b) | **THE DEVELOPER/ORCHESTRATION SIDE, and the second copy of the build.** *"Instead of streaming an active backend execution graph (the orchestration view used by developers in the Composer)…"* — the run canvas stays what it is here; the draft is its third view, which is also where the authoring/testing side of this build lives. |

**And one fact none of the three has today: the permission.** *"System catalogues… only available to
people with high-level permission."* Nothing in the tree says who may edit a catalogue or which rooms
may draft with it — `session_permissions` carries package roles, not catalogue roles. A catalogue's
editors (and its allowed rooms) is a NEW declaration, and it is a requirement of this feature, not a
later nicety: the locked system catalogues are exactly the case it exists for.

Why the split at all: *"for the purposes of marketing, I want to be able to permission-lock features
and only give the product team certain things, give the design team certain things."* One build,
three audiences — catalogue management in Design, the product team's workspace in Product, the
developer's orchestration view in the Composer — and the catalogues stay partitioned either way.

## The plan, and where the effort stands

**`PLAN.md`** — the blueprint: what the feature is, the three mechanisms against this tree (the
component ingestion loop, the assembly mapper, the drag/tray capture), the palette-as-a-subset
invariant, the file touch-points, the owner's five decisions and their corrections, and the
reasoning for the partitioned catalogs.

**`METHODOLOGY.md`** — the method, stated: why the model composes a bounded palette instead of
writing UI, what the mechanical gates actually are (the envelope reader, the catalog gate, the
partition loader, `npm run catalog:check`, the run's review hold), the laws by their real names
(one writer per fact; no fallbacks; fail loud with a name a person reads; drive it), and the
session contract every builder session is bound to. Read it before trusting the record; the record
is written to be checked against it.

Landed and verified (`tsc` + `npm run build` + driven in the running app):

- **S1a** — the element and the renderer variant: a hand-written payload draws real components
  (`Text` resolved through `resolveTag`, mounted as `<a2ui-text>` with its prop as a property); an
  unknown name is drawn as a sentence; one drag emits one `draft-node-moved`.
- **S1b** — the selector: the output column's header tile opens **Agent Flow / Output / Draft**,
  choosing Draft swaps the column's body to the drafting view, and the tile's label follows the
  view. A wireframing test package exists on the console (*Wireframe Draft — Test*).
- **S2, seen in the browser (2026-10-02, driven on the Scout).** The read path: the seat on the
  seeded thread, the tile → Draft, the canvas draws the stored row's two components — the Text
  *"This tile came from the database"* and the Button *"And so did this"*, at their stored places,
  with nothing pasted into the console; the request recorded was exactly one
  `GET /api/conversations/e6608ee8-…/draft`. The write path: one drag of the Text tile emitted
  exactly one `PUT` to the same conversation, and the stored row's `positions.s1` moved
  `{60,50}` → `{200,110}` while `s2` stayed `{60,190}` — one drag, one write, the host the single
  writer. **The drive order is the fact to keep:** a Run forks the seat onto a fresh conversation
  (the recorded act, *"A RUN GETS ITS OWN CONVERSATION"*), so the run's own Draft view is empty by
  design — the stored draft is seen by switching the seat to the thread that holds it FIRST, then
  choosing Draft. And `output-controls._choose` is a no-op when the chosen view IS the current view
  (`if (view === this.view) return;`), so reaching a conversation's draft means: seat on that
  thread, then the view change.

Open, in the order they matter:

1. **The return path, and what "Output" means** — the Draft-side defect is **fixed and verified
   (2026-10-02)**: choosing Draft replaces the DRAWING'S SLOT inside the column's container, not the
   column — the first version replaced the container, took the header and the foot with it, and left
   a column with no furniture and no way back. Now the container, the header and the foot survive,
   the label follows, and the draft is drawn inside. **What remains is a decision, not a bug:**
   choosing Output dispatches correctly and the tree holds `compiled-output-viewer`, but the layout
   no longer POINTS at the middle column — `showOutputColumn` deletes that pointer on purpose
   ("the column goes away again; it is a Run's column"), so the column empties. For a view selector,
   "Output" should show the output in the column: one line —
   `childMap.middle = middleId` instead of `delete childMap.middle` — but that changes what the
   footer's **Reset** has always meant, and Reset's meaning is the owner's.
2. **A decision the journey exposed**: in the Composer the output column does not exist until a Run
   has put something there — so a package that has never run has no header, no selector and no way
   into the draft. Reaching the draft from a fresh package needs the column to exist independently
   of a Run (a Draft entry on the package card, or the column shown whenever the package is open
   with the draft as its default view). The menu already carries only what can be shown
   (`COLUMN_VIEWS_RUN` / `COLUMN_VIEWS_DRAFT` / `COLUMN_VIEWS_OUTPUT`), so nothing offers a view that
   cannot appear.
3. **S2** — **LANDED, 2026-10-02** (the store AND the canvas's half).
   The store: `conversation_api.get_draft` / `save_draft` (one row per conversation, REPLACED;
   `artifact_type = 'wireframe_draft'`; `add_message`'s own authorization rule) and the routes
   `GET`/`PUT /api/conversations/{conversation_id}/draft`. Proven over HTTP after the server restart
   with the real row (`draft: {label: 'Store test', nodes: [...], positions: {...}}`).
   The canvas's half: `showDraftColumn` reads the conversation's draft into
   `/session/middle_column/draft` before the tree names the element (a FAILED read does not open the
   view — the empty state would claim "nothing is drafted here", a different fact — and the reason
   goes to her thread), and a host listener on `draft-node-moved` folds the released place into the
   payload and PUTs it — one drag, one write, the host the single writer. `tsc` + build clean.
   **Open verification — CLOSED 2026-10-02.** The draft canvas's read and write are now SEEN
   working in the browser (driven on the Scout; the evidence and the drive order are in the
   "Landed and verified" list above). **And the design rail's second form is settled the same
   day:** with the restarted backend, a fresh Design assembly draws the rail with BOTH forms
   under each other — the Figma form (URL / Notes / Submit) and the catalog ingest form (Design
   system label / the `.zip` / Add design system, with its standing note) — the catalogue list
   right below counting `design-artifacts 63` (one more than the 62 the record carried, which is
   the new form's own entry), and **no `ENVELOPE REFUSED for render-design`** in the console —
   the only console output for the intent was `Design clicked → intent: render-design (its own
   process)`. The two earlier checks had been looking at a surface assembled before the restart;
   the emission was never the problem.
4. **S3** — the assembler: the `draft: true` palette marker in the catalog JSON (decided: the
   catalog is the authority, the Figma ingest only PROPOSES), read by a filter beside
   `_catalog_component_vocabulary()` in `backend/routes/ai.py` — not in `figma.py`, which is the
   ingest.
5. **The catalog permission declaration** — who may edit a catalog, and which rooms may draft with
   it. Nothing says that today (`session_permissions` carries package roles, not catalog roles), and
   the walled-off harness catalog is exactly the case it exists for.

## The code, one paragraph

`<draft-canvas>` reads one payload (`{label, nodes, positions}`) and draws a layout; every component
name goes through `resolveTag` (the one name→tag reader, shared with `a2ui-renderer`), so the view
cannot draw a component the catalog does not declare. Gestures are the element's (the library's are
switched off — the rule `agent-flow` states), a place's live drag is the element's and the model's
payload is the payload's, and the events are `draft-select` / `draft-node-moved` — deliberately not
the run canvas's names, because both canvases can be in the same room and the host listens on
`window`.
