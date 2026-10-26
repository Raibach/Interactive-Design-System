# The update path does not destroy the code — remediation, 2026-09-30

Written after reading the whole path, not from memory. Every claim below carries the file and line
it was measured in. Nothing here is a guess about what the app does.

## What was reported

The owner, 2026-09-30: *"I tried to apply a style to one of those rows — it updated in the catalog.
It seems to have worked, but it stripped out the functionality, ripped out the description insert
from the database."*

## What actually happened — measured

The style change DID arrive, and the code DID die. Both are one event: an ingest + approve of node
`40001207:3497` regenerated `frontend/src/components/lit/f-40001207-3497.ts` from the design, and
that file is written whole — so anything in it that the design cannot state was replaced by the
design's own sample text.

| what | where | state today |
|---|---|---|
| the element | `frontend/src/components/lit/f-40001207-3497.ts:9` | `static properties = {}` — no props, no slot, no dispatch; the words on screen are Figma's sample text |
| the registry | `frontend/src/shared/tag-registry.ts:1705-1721` | declares `name`, `code`, `description`, `open` and `events: ['chevron-toggle']` |
| the design catalogue | `frontend/src/components/A2UI/catalogs/design-artifacts/catalog.json:2087-2125` | declares the same four props, with prose |
| the composer catalogue | `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json:2035-2065` | still declares the three invented props (`content`, `justify`, `align`) from the retired template generator |
| the consumer | `frontend/src/components/lit/figma-layers-view.ts:1551-1568` | instantiates the tile with `.name` / `.code` / `.description` / `.open`, listens for `chevron-toggle`, projects `<span slot="status">` |

So the registry and both catalogues promise four props and one event; the element implements none of
them. A row that is handed the catalogue's own name, code and description draws Figma's placeholder
words instead — *"the description insert from the database"*, gone.

**The registrations are innocent.** `_register_in_allowlist` returns `"already in the allowlist"`
when the tag is present (`backend/routes/figma.py:703`) and `_register_in_catalog` returns
`"already declared"` (`:773`), so a re-approve leaves both declarations alone. Only the ELEMENT file
is overwritten — `backend/routes/figma.py:5819` writes `drafts[tag]` over `lit/<tag>.ts`, and
`_SAFE_TAG_RE` means an ingest can write nothing but `lit/f-<node id>.ts`.

**Why the element has nothing to keep.** `render_spec`'s template (`backend/design_renderer.py:717-741`)
declares only the fields the designer annotated `Data: <field>` (`_data_fields`, `:211`), and the
tile's text layers carry no annotations — the design's only annotation is prose on the chevron frame
("show this chevrons annotaitons"). A faithful reader therefore emits `static properties = {}` and
the design's literal words. The reader is right; the design has not yet said those three lines are
data.

**It is a class, not an incident.** The catalogue HEAD element,
`frontend/src/components/lit/f-40001207-3559.ts`, is hand-edited the same way and is one re-ingest
away from the same loss: `:21-30` declares four props, `:37-46` a constructor with the measured
sample text as defaults, `:204` renders `${this.name}`, `${this.count}`,
`${this.catalogId || this.description}` — in a file whose own header still says *"there is no
interpretation in this file, and re-ingesting the same node produces this same file."* That sentence
is no longer true of it.

**There is no "apply a style" feature anywhere in the app.** Nothing in `IngestModal.tsx`,
`component-preview.ts`, `figma-ingest-form.ts` or the design branch of `backend/routes/ai.py` offers
a style. The only writers of `lit/f-*.ts` are the ingest's commit (`figma.py:5819`) and the repair
apply, which writes one file a person asked for
(`backend/repair_apply.py`, `apply_repair` → `target_path`). So the "style" came through the ingest:
the design was re-measured and re-rendered, the new geometry and text arrived, and the code that was
not derivable from the design did not.

## The rule the fix keeps

Two halves, and they are the owner's own words (*"the functionality the code should be called from a
completely different file"*):

- **A. The design owns the drawing, and the generator reads it — never interprets it.** Every
  measured value is emitted exactly as Figma measures it, and a re-ingest reproduces the file byte
  for byte. Three things a design can also state, all of which the generator must learn to read,
  because a re-ingest must not lose them: **data** (`Data:` — built), **interaction** (`On click:`),
  **state** (`State:` / the variant).
- **B. Logic lives in a hand-written file that is called from one.** The generated file carries
  exactly one seam, emitted by the generator's constant template so it is identical in every
  generated element and cannot be lost by a re-ingest. Everything that is not a drawing — extra
  props, listeners, dispatched events, slot fills, keyboard handling, timers — belongs in a companion
  module, which is never generated and never overwritten.

There is no third place. A generated file is a build output; a "preserved logic region" inside one
would break its own stated invariant, and guessing a binding from a layer's name is forbidden.

Figma's role is unchanged and worth stating plainly, because it is the owner's point: **the design is
the drafting table, consulted at ingest time and never at run time.** The annotations are part of the
draft — like the sizes — and they are read once, when the component is promoted into the catalogue.
Nothing in the running application reaches Figma, and the values a row draws come from the app's own
records (`prompt_sessions` where `metadata->>'session_type' = 'design_master'`, read at
`backend/routes/ai.py:1885-1898`, delivered at `/session/elements`).

## The work

### W1 — the seam, emitted by the generator (the invariant half)

`backend/design_renderer.py`'s template gains, in every generated file, the same bytes:

```ts
import { attachBehaviour, detachBehaviour, behaviourProperties } from './behaviour/attach';
…
  static properties = { ...behaviourProperties('<tag>'), /* the design's Data: fields */ };

  connectedCallback() { super.connectedCallback(); attachBehaviour(this, '<tag>'); }
  disconnectedCallback() { super.disconnectedCallback(); detachBehaviour(this, '<tag>'); }
```

The spread is derivable — `behaviourProperties('<tag>')` is a pure lookup into a hand-written table —
so the file's invariant still holds. The design's own fields are written last, so a design field wins
over a companion's.

*Acceptance:* the same spec renders byte-identical source twice; the emitted file compiles under the
ingest's own esbuild check (`figma.py:963-991` — syntax only, so a relative import passes); `npx tsc
-b` clean.

### W2 — the loader, hand-written, never generated

`frontend/src/components/lit/behaviour/attach.ts`:

- `import.meta.glob('./*.behaviour.ts', { eager: true })` — the pattern this repo already uses
  (`frontend/src/components/lit/ingested.ts:43`, `figma-layers-view.ts:48`).
- A map tag → `{ attach, detach }`, built from each companion's exported `tag`. **A tag with no
  companion is a no-op** — silence, not an error.
- `behaviourProperties(tag)` — the props a companion declares, so they can be spread into the
  element's `static properties` and are therefore reactive.

**The `.behaviour.ts` suffix is load-bearing.** Both checkers walk `src/components/lit` recursively
and key a source by its BASENAME (`scripts/catalog-check.mjs:206-215`, `litFiles()`/`srcOf()`;
`frontend/scripts/catalog-check.mjs:69-77`, `walk()`), so a companion named `f-40001207-3497.ts` in a
subdirectory could be read as the element itself. A different basename makes that impossible, and
neither checker mistakes a helper module for an element (`scripts/catalog-check.mjs:662-665`).

### W3 — the tile's companion (the reported breakage, fixed)

`frontend/src/components/lit/behaviour/f-40001207-3497.behaviour.ts`:

- declares `open` (boolean) — the state the design cannot yet express, and the one the tree already
  passes;
- on attach, one delegated click listener on the shadow root: a click inside the design's chevron
  flips `open` and dispatches `chevron-toggle` with `{ open }` — bubbles + composed, which is exactly
  what the tree's handler reads (`figma-layers-view.ts:1563-1566`);
- ensures the design's status well (`slot-status-icon-container`) carries `<slot name="status">`, so
  the tree's dot draws. The design cannot express a slot today, so this belongs here and is marked as
  the stopgap it is;
- on detach, removes the listener.

*Acceptance:* in the running room the row expands on the chevron and the dot draws, and the file
survives a re-ingest untouched (asserted by hash).

### W4 — reading 2: `On click:`

The app's own field format is `On click: the event fired and its payload (e.g. dispatch role-select
{ role: <tile label> })` (`frontend/src/shared/repairMaterial.ts:642`). The generator reads
`dispatch <name>` from a layer's or instance's annotation (`spec["annotation"]`,
`backend/routes/figma.py:2251-2260`) and emits, on that layer, a click that dispatches `<name>` as a
`CustomEvent` with `bubbles` + `composed` — and knows nothing else about it. The payload's meaning
stays with the consumer, which is the doctrine: *"the element dispatches that event and knows nothing
else about it."*

### W5 — reading 3: `State:` and the variant (staged; the largest)

When a layer is an INSTANCE of a component set with variant properties, the element takes a prop
named for that property, its values are the variant names, and the variant the design instanced is
the default. Two things make this the largest item and they should not be discovered halfway:

1. the property set is not in the spec today — it must be read off the instance and carried through
   the measurement, and any new spec key must be registered in `RENDERED_KEYS` or the ingest REFUSES
   (`backend/design_renderer.py:38-44`, refusal at `figma.py:3872-3882`);
2. for the state to change the DRAWING (the chevron turning), both variants' artwork must be
   measured and emitted, because the file today draws the single variant that was instanced.

Until it lands, `open` is the companion's prop and the chevron's other artwork is not in the element
— a named gap, not a silent one.

### W6 — the head element, `f-40001207-3559` — DONE

Same shell, and it was measured to have the same disease: the file declares `name`, `count`,
`catalogId`, `description`, defaults them to the measured sample text and renders
`${this.name}` / `${this.count}` / `${this.catalogId || this.description}` — while its own header
claims no interpretation. Its design carries NO annotation at all, so nothing about those bindings is
derivable and its next approve deletes every one of them.

Built: `behaviour/f-40001207-3559.behaviour.ts` declares the four props and places them in the
design's own boxes through `boxes.ts` (`.catalog-name` line one = name, line two = count,
`.functions-label` = the catalogId). **The chevron there is deliberately left a drawing** — the
design's note on it is prose and nothing in the application listens for an event from the head, so a
listener would be the dead control this repository files findings about.

`frontend/src/components/lit/behaviour/boxes.ts` is the shared half: the unset-is-not-empty rule,
the design's class names as the box addresses, the after-every-render hook (an instance-level
`updated`, restored on detach), and the slot-into-the-design's-well helper. It is a helper module,
not a companion — the loader's glob is `./*.behaviour.ts`, so nothing registers a tag against it.

### W7 — the gate cannot see a companion's props, and the gate that could is dead

Measured while doing this work, and it changes what was assumed here:

- `scripts/catalog-check.mjs` (the repo root, 1856 lines) is the fuller gate — it carries
  `prop-undeclared` (`:749-792`), which asks the exact question *"can the element receive what the
  catalog promises?"*, plus `event-unheard`, `annotation-missing`, `annotation-prose`,
  `geometry-drift`. **It cannot run where it is.** It computes its own root as
  `dirname(fileURLToPath(import.meta.url)) + '/..'` — correct for `frontend/scripts/`, wrong for the
  repository root — so every run dies with `ENOENT … /Raibach_IDS/src/components/lit`. Measured
  today: `node scripts/catalog-check.mjs --offline` → `scandir` ENOENT, nothing written.
- `frontend/scripts/catalog-check.mjs` (542 lines) is the live gate: it is what `npm run
  catalog:check`, the ingest's `_catalog_check` and `backend/repair_apply.py` run, and it carries six
  checks (`catalog-member`, `component-resolves`, `slots`, `props`, `events`, `doc-claim-drift`). It
  compares the catalogue against the elements for SLOTS and DISPATCHED EVENTS, but it does **not**
  compare declared props against `static properties` at all. So "declared == implemented" is enforced
  by nothing that runs today.

Consequence for this work, stated rather than papered over: a prop declared through the companion
spread (`...behaviourProperties('<tag>')`) is invisible to a text-matching check by construction,
and the check that would have caught its absence is not running. The honest positions are (a) make
the props the design's — annotate, and the generator writes the literal keys a checker can read; or
(b) put the big checker back where it can run (`frontend/scripts/`) or fix its root computation, and
teach it the spread. That is a separate decision about which gate is authoritative — the two files
also write the SAME report path, so whichever ran last is what the app's Repairs tab shows. It is
named here as work, not done in this pass.

What IS held honest by hand, today, for the tile: the registry, the design-artifacts catalogue and
the element all say `name`, `code`, `description`, `open` and `chevron-toggle` — the last three
through the companion — and the composer catalogue's three invented props (`content`, `justify`,
`align`) were removed in this pass so it says the same thing.

## Who states a binding — DECIDED 2026-09-30: the application, not the designers

The owner, on being asked to annotate the layers: *"You should add those data bindings now, you do
that and preserve them. The designers aren't gonna add those… Do you need me to add the data
annotations? I'm not doing it. You need to add those at least for this application."*

So the architecture this plan implements is: **Figma draws; the application binds.** Which box gets
which value is stated in a hand-written companion, next to the behaviour that uses it, and no ingest
can write those files — so the binding survives every re-ingest, and nothing about the running
application depends on a designer annotating anything.

The design's own grammar (`Data: <field>` / `On click: dispatch <…>` / `State: <values>`) stays built
and tested, and a component whose design carries one gets its binding from the generator instead —
that is the better path where a design chooses to use it, since the binding then travels with the
drawing. It is not a requirement anywhere, and nothing waits on it.

What the application owes in return, and does: **a binding that cannot be placed says so.** A
companion names one of the design's own layers, so a layer renamed or removed leaves the binding
pointing at a box that is gone; that case writes one line to the console naming the tag, the box and
what to change, and the design's own words stand in the box meanwhile. Silent wrongness is the one
outcome this whole mechanism exists to prevent.

Still the design's to give, and none of it is a binding: the chevron's other state (`State:` /
variant — the artwork of `chevron-blue-open` is not in the element, so the chevron cannot yet turn),
and its `On click:` event if a design ever wants the dispatch generated rather than companion-held.

### How an instruction becomes a binding — the recipe, stated so it repeats

The owner, on where a binding's INSTRUCTION comes from: *"The designers will give you prose written
just like a prompt… it's you should treat that no differently. It's up to you, data bind it — the
assembly AI will data bind it."*

So prose is the normal input, and the AI is the interpreter. The path, end to end:

1. **A designer or the owner describes what the element should do** — in Figma's annotation on the
   layer, in a note on the component, or in the chat beside the drawing. A story is a valid
   instruction; so is a sentence as short as "the name goes there and the chevron opens it".
2. **The AI reads it against the measured drawing**, where the design's own layer names are the
   handles: `catalog-name`, `functions-label`, `chevron-blue-closed`, `slot-status-icon-container`.
3. **The AI writes the companion** — `behaviour/<tag>.behaviour.ts` — with three parts: `properties`
   (the values the component takes), the placement of each value into the design's box (through
   `boxes.ts`), and any behaviour (listeners, dispatch, slots). This is the step the owner means by
   "it's up to you, data bind it", and it is the same work whether the instruction arrived as prose
   or as a `Data:` annotation — the difference is only who did the interpreting, and for prose it is
   the AI's judgement, recorded in a file a human can read and correct.
4. **The assembly binds the values.** The props are reactive, so a surface's data model can bind them
   (`{"path": "…"}`) the way it binds any catalogue element, and the assembly AI decides which path
   each one takes. The tree that lists the catalogue is one such consumer today; it is not the only
   one possible.
5. **Everything survives the next ingest**, because steps 3 and 4 are in files nothing regenerates —
   and if the design renames or removes a box, the companion says so instead of going quiet.

The structured readings stay in the generator (`Data:` / `On click: dispatch …` / the variant), and a
design that states one gets its binding from the drawing instead. They are the better path when a
design chooses them; they are not a precondition for anything the application needs.

## Verification (the repository's own rule: does the turn appear, does the call happen)

1. `cd frontend && npx tsc -b` — clean.
2. `npm run catalog:check` (the gate the backend and the repair loop run) and
   `node scripts/catalog-check.mjs --offline` (the fuller gate, the one whose finding ids the Repairs
   flow speaks) — before and after, reported as a delta. The three pre-existing blocking findings
   stay the only ones.
3. Render determinism, offline: the same measured spec through `render_spec` twice, byte-compared,
   plus `_validate_generated_module` on the output.
4. The re-ingest proof: hash the companion file, run the ingest + approve of `40001207:3497`, hash
   again, and confirm the element was rewritten with the seam while the companion's bytes are
   unchanged.
5. In the running page: the room's rows draw, the chevron expands its row, the status dot appears.

## Named, not fixed here

- **Two checkers, one report path.** `frontend/scripts/catalog-check.mjs` (6 checks) is what
  `npm run catalog:check`, the ingest's `_catalog_check` and the repair loop run;
  `scripts/catalog-check.mjs` (the census, `prop-undeclared`, `event-unheard`, the annotation and
  geometry checks) is the fuller gate and writes to the same file. Whichever ran last is what the app
  reads. A finding the Repairs flow can act on can therefore be invisible on screen.
- **The composer catalogue's three invented props** on `f-40001207-3497` (`content`, `justify`,
  `align`) — the design-artifacts entry was corrected by hand; the composer's was not, and it is the
  catalogue the checker reads.
- **The `status` well** — until the design can say "this box is a slot", the well is the companion's.
- **A new companion needs the loader re-resolved in dev.** Vite caches the eager glob while
  `behaviour/attach.ts` is unchanged, so a newly added `<tag>.behaviour.ts` is a no-op until the file
  is touched or the dev server restarts (measured today; a production build always sees every file).
  Nothing reports it, which is why the loader's own comment now says it.
- **`npm test` cannot run either.** `vitest.config.ts` declares `setupFiles: ['./src/test/setup.ts']`
  and that file does not exist, so the runner fails before a test is collected. Measured today while
  proving the seam: the checks below were run through a throwaway config, and the harness was
  deleted afterwards rather than added to a project whose test entry point is already broken.
- **The design carries no `Data:` annotations and that is now the norm, not a gap.** `render_spec` on
  the tile's live measurement emits zero props, and that is correct behaviour — the drawing is the
  design's and it does not become empty because nothing is loaded. The bindings live in the
  companions (see the section above), which is the decision the owner made.

## Built and measured in this pass (2026-09-30, evening)

- `backend/design_renderer.py` — the seam is emitted by the constant template: the import, the
  `...behaviourProperties('<tag>')` spread, `connectedCallback`/`disconnectedCallback`, and (reading
  2) `_on_click_event`/`_on_click_events` + the `@click → this._fire(<event>)` attribute on the
  annotated layer, which composes with a catalogue-supplied child and with a bare `<svg>` too.
- `frontend/src/components/lit/behaviour/attach.ts` — the loader: `import.meta.glob('./*.behaviour.ts',
  { eager: true })`, tag → companion, `behaviourProperties(tag)`, idempotent attach/detach, no
  companion = no-op.
- `frontend/src/components/lit/behaviour/f-40001207-3497.behaviour.ts` — the tile's companion:
  `name`, `code`, `description`, `open`; the values written into the design's own boxes after every
  render (via the instance's `updated`, restored on detach); the chevron's click flipping `open` and
  dispatching `chevron-toggle { open }` with `stopPropagation`; the `status` slot ensured inside the
  design's own well. Every stopgap is marked, and each has the sentence that deletes it.
- `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json` — the tile's entry no longer
  declares `content`/`justify`/`align`; it declares the four real props.

Measured, not asserted:

| check | result |
|---|---|
| `render_spec` twice on a fixture spec | byte-identical |
| the fixture's emitted file under the ingest's own esbuild | compiles |
| `render_spec` twice on node `40001207:3497`'s live measurement | byte-identical, seam present |
| the design's annotations today | one, prose, on the chevron frame (`show this chevrons annotaitons`) — so 0 props, 0 listeners emitted, correctly |
| `npx tsc -b` | clean |
| `npm run catalog:check` (the live gate) | 28 findings, 3 blocking — unchanged, the same three ids |
| Vite transform of both new modules | 200, and the eager glob resolved to `./f-40001207-3497.behaviour.ts` |
| a dry `POST /api/figma/ingest` of the tile (the app's own endpoint, nothing written) | the returned draft carries the seam: import, spread, attach, detach | 
| `node scripts/catalog-check.mjs --offline` (the root gate) | **cannot run** — ENOENT on `src/components/lit`; see W7 |
| the head node `40001207:3559`'s live measurement, rendered twice | byte-identical, seam present, compiles; its design carries **no annotations**, so it emits 0 props |
| both companions through the real loader (temporary harness, 9 checks, deleted) | values land in the design's boxes; an empty value clears its line; the chevron flips + reports + does not reach the row; the status slot is created; the head's chevron dispatches nothing; detach stops the listening |
| a bug the harness caught | `boxes.ts` queried `querySelector('catalog-name')` (a TAG) instead of `.catalog-name` — every value silently failed to land, with no error anywhere. Fixed; a companion's failure to write is exactly the class of silence this repository distrusts, which is why the harness existed for an hour |
| adding a companion while the dev server runs | Vite keeps the eager glob's answer while the loader is unchanged, so the new file is ABSENT from the map (measured: the map held only the row's companion until `touch attach.ts`). In production the glob resolves at build time |
| the owner's own ingest, 2026-09-30 18:2x | **the seam broke the preview**: the generated file was written to `.preview/<jobId>/` and served from there by `frontend/vite-plugin-figma-preview.ts`, so its relative `./behaviour/attach` resolved to nothing and Vite stopped with `Failed to resolve import` over the whole application. Fixed by importing the loader through the project's own alias — `@/components/lit/behaviour/attach` — which resolves from inside `src/` AND from the preview folder. Verified on the app's server: the failing URL now returns the module (200, 19.9 KB) with the import rewritten to `/src/components/lit/behaviour/attach.ts` |
| the dev servers | the application is on **5001** (`vite --port 5001 --strictPort`, started 07:31 today, config includes the preview plugin). A second Vite on **5173** has been up since **Sep 27** with the older config, so it has no preview plugin and answers `/@figma-preview/…` with the SPA fallback — verifying against that one gives false results, which is how a first pass here mis-read the preview as broken |

Not yet measured, and it is the owner's next step: the approve itself. The generated element on disk
does not carry the seam until the tile is re-ingested, so the companion attaches on the first
approve after this pass — and the backend had to be restarted for the new template to be live (it ran
without `--reload`).

## Where Figma is read, and on which channel (asked 2026-09-30)

The application pulls on TWO channels per ingest, and their order is deliberate
(`backend/routes/figma.py:3642-3664`):

1. **REST first** (`_fetch_figma_nodes`) — "primary, always available". It carries the complete node
   tree: geometry, fills, strokes, layout, text styles, AND the annotations (`:2244-2260` — an
   annotation added in Figma comes back on this channel; that was a fixed defect, not a design).
2. **MCP second** (`_fetch_figma_mcp`, `FIGMA_MCP_URL`, default `http://127.0.0.1:3845/mcp` — Figma
   Desktop's Dev Mode server) — "optional, desktop-only": behavioural annotations, reference code,
   descriptions, layout/style info. If it is unavailable the ingest CONTINUES with REST alone
   (`mcp_context = None`).
3. `_merge_mcp_rest` then enriches each REST node with whatever MCP provided.

Consequence that matters to the plan: **the `Data:` / `On click:` / `State:` annotations do not need
Figma open, and do not need MCP.** They arrive on REST, which is the channel that is always
available — so the drafting-table flow (annotate, then ingest) works with the desktop app closed,
which is the owner's stated condition.

## The prompt for the next window, in one paragraph

The ingest regenerates `lit/f-<node>.ts` from the design, so a re-ingest deletes every prop, event,
slot and handler that is not derivable from the design; the fix is (A) the generator reads the three
things a design can state that it does not yet read — `Data:` (built), `On click:`, `State:`/the
variant — and (B) the generated file carries one constant seam,
`connectedCallback → attachBehaviour(this, '<tag>')` / `disconnectedCallback → detachBehaviour(…)`,
calling a single hand-written loader (`frontend/src/components/lit/behaviour/attach.ts`) that maps a
tag to a companion module (`behaviour/<tag>.behaviour.ts`, never generated, never overwritten) which
owns everything that is not a drawing. The tile `f-40001207-3497` is the proven example: its row
expands and its dot draws from the companion, and a re-ingest no longer takes either away.
