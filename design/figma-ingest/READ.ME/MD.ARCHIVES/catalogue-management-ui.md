# The catalogue, managed from the front end — what we did on 2026-09-28

> **Read `START-HERE.md` first** — it carries the state after the 2026-09-28 evening session, and
> its §4 is the queue. This file is kept because the measurements in it are still right; what has
> changed since it was written is marked below.
>
> **§5.1 IS CLOSED.** Nothing in the catalogue said which file draws a component, and that is why
> most of the tree rendered nothing when you clicked it. The display half was fixed on
> 2026-09-28 evening: a component is resolved through the renderer's own `resolveTag` and the
> element manifest (`frontend/src/shared/component-drawn-by.ts`), every row says what draws it,
> and the preview loads it. What is still a decision is whether the catalogue should *declare* the
> module per entry as well — see §5.1 below.
>
> It assumes `PLANS.AGENT/design-system-tree.md` (the display schematic) and
> `PLANS.AGENT/catalogue-structure.md` (the file's shape) have been read.

---

## 1. What the tool is now

The owner's words for it: **"you have a menu on the left, which is your data tree with all the
components and their sub-components, and then you have a display on the right hand side."**

That is what the ingest modal is. `frontend/src/components/IngestModal.tsx`:

```
┌ Figma URL + Submit ─────────────┬ Preview ──────────────────────┬ Grace ──────────┐
│ Notes                            │ [the selected component,      │ what happened    │
│                                  │  rendered, or its record]     │ what she made of │
│ THE CATALOGUE TREE               │                               │ it               │
│  Raibach IDS Catalogs            │ Approve & add to catalogue    │                  │
│   [ecommerce 38][primitives 7]   │ Close · Remove from catalogue │                  │
│   [prompt-composer 57]           │                               │                  │
│  Raibach Prompt Composer Catalog │                               │                  │
│   57 components                  │                               │                  │
│    role-tile   allOf(3)  4 props │                               │                  │
│    ...                           │                               │                  │
└──────────────────────────────────┴───────────────────────────────┴──────────────────┘
```

**There is no draft list and no approval queue, deliberately.** The owner, 2026-09-28: *"They're
not creating backlogs. They're building user interfaces… You either approve it or you don't
approve it."* Ingesting or picking from the tree puts one thing in the middle; from there it is
approved into the catalogue or it is not. Nothing waits, nothing accumulates, and there is no cap
to run into. `MAX_DRAFTS`, the counter and the "N drafts are held" banner are gone.

**Clicking a row in the tree opens that component in the middle.** The row navigates; the chevron
expands. One click, one thing.

---

## 2. The catalogue's real shape (verified, not described)

`frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json` is a **JSON Schema document**, not
a tree. Eight top-level fields: `$schema`, `$id`, `title`, `whatThisFileIs`, `description`,
`catalogId`, `components`, `$defs`.

- **`components` is a flat map of names.** `prompt-composer` 57, `ecommerce` 38, `primitives` 7.
- **Entries are written in two shapes**, and reading one as the other is how a single file gets
  described two different ways: **flat** (24 of 57 — `type`, `description`, `properties`,
  `required` at the top level) and **`allOf(3)`** (33 of 57 — those same fields as the *third*
  element, behind two shared `$ref`s). `readComponent()` in the tree view detects the shape first
  and reads the block from where that shape says it is.
- **A component has no id of its own.** Its identity is the map key, which is also its
  `properties.component.const` — 57 of 57. The `id` *property* on 29 entries is a payload field,
  not an identifier.
- **Nesting is `$ref` and `allOf`, not children.** Only 9 entries name any containment.
- **The catalogue is the only source for "what exists".** The tree's 57 rows were checked against
  the file's 57 keys: identical, same order, nothing extra, nothing missing.

Three catalogues, no fourth thing holding them — they are peers, and "Raibach IDS Catalogs" is a
heading, not a container in any file.

---

## 3. What was fixed on 2026-09-28

Each of these was found by the owner using the tool and saying the readout did not match reality.

**The display**

| was | is |
|---|---|
| The tree's rows only expanded; clicking a component did nothing | A row opens the component; the chevron expands |
| The click never reached the modal — the listener was attached while the modal rendered `null` | The listener re-attaches when the modal opens |
| `openByTag` sent every catalogue *name* to the node endpoint, so every row failed with "Not a Figma node id" | A tag, a name and a node id each go to the right endpoint |
| The preview rejected any component not named `f-…`, and built a flat module path from the tag | Resolves the name and the file the map records — `role-tile` now loads `lit/prompt-input/role-tile.ts` and draws |
| The declared list and the measured layers were two sections | One row per component: what it declares, then what it was measured from |
| A component with no measured design said "layers not recorded yet" | Says nothing; it shows what it declares |
| The list came from a **module import**, which the browser caches, so a new component could not appear until a page reload | **Fetches the file**, so a re-read sees what is on disk |
| Every tab held its own snapshot and only the tab that acted re-read | Re-reads when the tab is looked at again |
| "Just added" marked the last key in the file — which after a removal is whatever was already at the end | The newest **approval** from the activity record, dropped when that component is no longer declared |
| Opening a component counted against a 5-draft cap | Viewing is not drafting; there is no cap |
| The search answered from the ingest log and never asked Figma | Only a Figma-map hit returns early; a record-only hit continues to the file |
| Search hits said "already a component: f-…" for components that had been removed | Says where it was found: `in the ingest record only … — not in the catalogue now` |
| A removed component's row read "failed" (the status label had no case for it) | Each row reads its own status |

**The ingest**

| was | is |
|---|---|
| The layer tree was measured on every ingest and thrown away | Written per pipeline to `frontend/public/catalog-figma/<pipeline>.json` — **on approve, not ingest** |
| The model was handed the catalogue's 58 *names* and nothing tying a name to a design layer | `_design_system_context()` lists the design's own layers and says which already have a component |
| The rule to compose rather than redraw existed only as a warning **after** the code was written | Given to the model before it writes |
| Name collisions were invisible | `_name_collisions()` reports a layer whose name the design system already has at a **different** node |
| The designer had no say in a collision | The form asks: *Yes — overwrite `<tag>`* or *No — add it as a new component*, and the answer retags the commit to the existing component |

**The write**

| was | is |
|---|---|
| The catalogue write truncated the file before filling it | Atomic — temp file, then `os.replace` |

---

## 4. What is still open

> **Status, 2026-09-28 late** — measured against the files, not remembered:
>
> | item | then | now |
> |---|---|---|
> | 1. removals recorded without a subject | 48 rows, no tag | **fixed at the source** — the insert read `tags` (approvals) and never the scalar `tag` (removals), so every removal reached the table with an empty subject. Backfilled from the log and deduped; 63 of 64 rows carry their subject and reason now |
> | 2. every approve written six or seven times | one approval, 7 identical rows | **fixed** — the backfill's dedup key asked each log line for a scalar `tag` an approval does not have, and compared timestamps rendered in the session's timezone against the log's UTC, so nothing ever matched and every event was re-imported on every start. Table: 283 rows → 116 = the 116 distinct events; a simulated restart imports 0 |
> | 3. node ids in two conventions | `40001185:2176` vs `40001185-2176` | **still open** — the ledger holds both spellings |
> | 4. timestamps five hours early, labelled `Z` | `approved …T14:36:44Z` | **fixed** — `to_char(at AT TIME ZONE 'UTC', …)`. The record now reads `19:36:44Z`, which is the truth |
> | 5. the catalogue does not record where a component lives | 18 of 57 resolved | **closed for the display** — see §5.1. The declared-field question stays open |
> | 6. the search does not match on the tag | typing `f-40001204-5752` finds nothing | **still open** |
> | 7. `deps.py` reads the catalogue once at startup | a new component needs a restart | **still open** — and it is why every backend change in this session needed `RESTART-LOCAL.sh` |


> The queue as of now — the collision screen, the pre-approval import check, behaviour capture,
> and attaching a node to a component that has none — is in `START-HERE.md` §4, with the file
> and line of each. It is not repeated here.

**What item 5 measured, kept because the numbers are the finding:**

5. **The catalogue does not record where any component lives, and the map covers 18 of the 57.**
   Measured on 2026-09-28, against the live files:

   | | |
   |---|---|
   | catalogue components | **57** |
   | resolve to a file straight away (`litComponent` == the catalogue name, and the file exists) | **18** |
   | resolve only via the Figma layer name | 0 |
   | **cannot resolve at all — no entry in the Figma map under either spelling** | **39** |
   | files the map names that are *absent* from disk | **0** |

   So the files are not missing and the names are not mismatched — **nothing says which file draws
   those 39.** Selecting `add-section-button` gives "Nothing to render — no module for this row,
   and no tag to build one from", and the record says `no file · in catalog · (no map entry)`. The
   same is true of `Text`, `Image`, `Row`, `Column`, `Card`, `Button`, `TraceFeed`, `EvalFeed`,
   `AgentFlow`, `RoomEmbed` and the rest.

   **`registry.json` is a FIGMA map, not an inventory.** It holds the 36 components that came from
   a Figma node (plus hand-declared ones with no node at all). The catalogue holds the 57 names
   that may be drawn. Those are two different questions and the two lists were never meant to
   agree — but the display needs the second to know what file the first draws, and only 18 do.

   **This is the rework the owner suspected, and it is delicate: many of the 39 are live.** The
   catalogue is what the server validates payloads against and what the AI composes from, so it
   cannot simply be pruned to the map. What is missing is a file recorded per entry — one field,
   declared once, rather than inferred from a map built for provenance.

   The name↔tag mapping in `a2ui-renderer.ts`'s `COMPOSITE_MAP` is a *second*, smaller instance of
   the same gap: where the catalogue name and the Lit tag differ (`CompiledOutput` vs
   `compiled-output-viewer`) nothing in the data says they are one thing.

6. **The search does not match on the tag.** It matches the layer name and the node id, so typing
   `f-40001204-5752` finds nothing.

**And the backend change that was reverted, which is worth knowing because it bites.**

7. `backend/deps.py` reads the catalogue's component list **once, at startup**, and calls
   `sys.exit(1)` if that read fails. So a component approved from the UI is written and registered
   everywhere, and the server still refuses a payload naming it until the next restart. A re-read
   on change was written and then reverted at the owner's request — the safe version raises on a
   failed read rather than serving a stale copy, so it is worth re-landing deliberately rather
   than by accident.

---

## 5. Two decisions outstanding

### 5.1 Where does a component live? — start here

**Nothing in the catalogue says which file draws a component, and the map covers 18 of the 57.**
See §4 item 5 for the measurement. It is why most of the tree renders nothing when you click it.

The three files ask three different questions today:

| file | what it knows | how many |
|---|---|---|
| `A2UI/catalogs/prompt-composer/catalog.json` | a component may be drawn, and what it accepts | **57** |
| `components/registry.json` | which Figma node it came from, and which file it lives in | **36** (18 of them catalogue names) |
| `shared/tag-registry.ts` | the tag may render, and on which surface and column | **44** |

So the file that can draw a component lives in a map built for **provenance**, and the list that
authorises drawing does not carry it. **The owner, 2026-09-28:** *"I believe the catalog structure
may need some reworking. I'm not sure that the things in there we're actually using and I know a
lot of them are live, so this could be tricky."*

That caution is the right one: the catalogue is what the server validates every payload against
and what the AI is told it may compose from, so it cannot be pruned to match the map. **What is
missing is one field per entry** — the module that draws it — declared once in the catalogue, and
then every readout (the tree, the preview, the search, the audit) can resolve a name to a file
without inferring it.

The same gap at a smaller scale: where a catalogue name and a Lit tag differ
(`CompiledOutput` vs `compiled-output-viewer`), nothing in the data says they are one thing. The
pairing lives in `a2ui-renderer.ts`'s `COMPOSITE_MAP`, which the preview does not read.

**CLOSED for the display, 2026-09-28 late. What was built instead of the declared field:**

- `frontend/src/shared/component-drawn-by.ts` — one resolver: **name → tag** through the
  renderer's own `resolveTag` (COMPOSITE_MAP → spec primitives → structural → allowlist), then
  **tag → module** through the generated `frontend/custom-elements.json`, with the renderer's own
  `a2ui-*` tags answered as renderer-owned. It distinguishes `none` from `unknown`, because a
  manifest that could not be read is not the same claim as "nothing draws it".
- Every tree row says what draws it, and the preview loads it: `AgentFlow`, `Text`, `trace-feed`,
  `RoomEmbed` and the rest all render now. The backend's record line reads it from the same
  answer, so the pane and the row cannot disagree.
- The preview document renders the **resolved tag**, not the catalogue key — a payload cannot name
  `<AgentFlow>`.
- `COMPOSITE_MAP` gained one entry, `agent-card → agent-card-element`: that entry described the
  element in its own text ("Lit web component `<agent-card-element>`") while resolving to a tag
  nothing defines, so its row read "nothing draws this" while the console drew cards.

**What is still a decision, and it is smaller than it was:** whether the catalogue should *declare*
the module per entry as well. It is no longer needed for any readout; it would make the answer a
property of the catalogue rather than of a derived file (`custom-elements.json` is regenerated on
every write by the element analyser, so a component added by hand and never analysed would read as
"nothing draws it" until the analyser runs). The owner's caution stands unchanged: the catalogue is
what the server validates every payload against and what the AI composes from, so it must not be
pruned to match the map.

### 5.2 Is the same design at two nodes one component or two?

Today the answer is implicitly "two", because a component's identity is its node id — the tag is
built from it. That is why `System_Role` became two components the moment Figma handed over a new
node, and why the duplicate check did not catch it: `_name_collisions()` compares the names of the
layers *underneath* a node and skips the node's own name.

- **Two** → check the frame's own name as well, and say so before the approve.
- **One** → identity stops being the node id; the name becomes the identity, and a second node with
  the same name overwrites or is refused.

**Sharpened 2026-09-28 late, from two live frames — this is now three problems, not one:**

1. **The frame's own name is still never checked** (`_name_collisions()`, `figma.py:1860`:
   `if node is spec: continue  # the root is what is being built`). So a node already claimed in
   the map can be ingested again and quietly become a second component for one node. Verified:
   node `40001177:2458` is mapped to `prompt-input-section-system-role`, whose file exists and
   which the catalogue never declares — invisible, and nothing reported it.
2. **An instance of a component we have is reported as a stranger.** The check compares the layer's
   own node id; an INSTANCE carries its own id (`System_Role [40001204:5753]`) while the map
   records the main component's (`40001204:5752`), so the form offered to overwrite
   `f-40001204-5752` — i.e. to write an entire section under the seat's tag. Comparing the layer's
   `componentId` as well fixes it.
3. **One answer is offered for several different collisions**, and for a layer *inside* a frame the
   only offered answers are overwrites of the whole frame onto that layer's component — which is
   never what the owner means. The owner's decision (2026-09-28 late): **only the frame's own name
   may offer an overwrite; a collision inside it is reuse information** — *"you already have this
   element"* — and not a decision.

**And a finding about the designs themselves**, which decides how much of the reuse can ever be
automatic: the frames checked so far *redraw* components the catalogue has rather than instancing
them. `role-tile` and `responsive-prompt-container` appear in node `40001177:2540` as **FRAMEs with
no `componentId`** — copies, not instances. So they cannot be picked up as the components they
look like; the design has to instance them first. That is also why a parent built before its
children cannot compose them.

---

## 6. How to see it working

```
cd backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000   # restart after backend edits
cd frontend && node node_modules/.bin/vite --port 5001 --strictPort  # the site is served from source
```

Open `http://localhost:5001/`, then **Ingest Design** in the left menu.

- The tree on the left is the catalogue: 57 components, one row each, expandable.
- Click `role-tile` — it renders in the middle from `lit/prompt-input/role-tile.ts`.
- Click `CompiledOutput` — it renders nothing, because of limit 5 above. That is the honest state.
- Click the chevron — the row expands without navigating.

**`hmr: false` means an open page never picks up an edit.** A tab left open is running the code it
loaded. Reload each tab once after a change, and after that they keep themselves current — the tree
re-reads whenever it is looked at.

### Two habits that save time here

- **Check the file before believing a readout.** Every contradiction found today was settled by
  reading `catalog.json` or the ledger and comparing, not by reasoning about the UI.
- **Four files answer four different questions.** `catalog.json` — what exists. `registry.json` —
  which Figma node a component came from. `backend/logs/figma-ingest.jsonl` — what happened.
  `figma_ingest_activity` — the same events, in a table, written several times each. When two
  readouts disagree, they are usually both right about different files.
