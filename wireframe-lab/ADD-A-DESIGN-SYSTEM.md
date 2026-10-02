# Adding a design system — the owner's flow, and what stands between here and there

Written 2026-10-02. The owner's flow, verbatim in substance:

> *"A high-ranking designer goes to the design section, clicks 'Add Design System,' labels it
> 'Carbon', attaches carbon.zip. The system unzips it, runs the ingestion loop, and places
> everything into a brand-new independent directory slice — a local registry.ts and a catalog.json
> just for Carbon, every extracted element marked `draft: true`. Then the product manager goes to the
> Composer, opens the dropdown for 'Design System', selects Carbon, and prompts: 'Build a way for a
> user to select multiple items in a list.' The host reads ONLY carbon-ui/catalog.json and pins it to
> the model as an absolute structural barrier. The canvas renders the result."*

The owner also said the thing that makes this honest: *"it may not be feasible — we may have to
individually add every component."* That instinct is right, and §2 says which halves of the flow
need it.

## §1 — What is already true (so the flow is not a rewrite)

- **Partitions are the existing convention.** Four catalogs already live as directories —
  `frontend/src/components/A2UI/catalogs/{prompt-composer, ecommerce, primitives, design-artifacts}/`,
  each a flat JSON Schema **keyed by component name**, each carrying A2UI's own six primitives
  (`Text, Image, Row, Column, Card, Button`) **plus its own components** (`agent-card`,
  `filter-pill`, `chat-panel`…). A `carbon-ui/` directory is one more of these, not a new idea.
- **A drawing surface already exists** — the draft canvas (S1a/S1b of `PLAN.md`), whose node
  renderer mounts whatever `resolveTag` resolves, one component per node.
- **An ingest exists** — and this is where §2 begins, because its input is not a zip.
- **The catalog is already the model's vocabulary**: the assembly prompt is generated from the
  catalog (`_catalog_component_vocabulary()`, `backend/routes/ai.py`), and it fails loud on an empty
  one.

## §2 — The three corrections

1. **A zip is not a Figma document.** The ingest parses *Figma* — file keys and node ids, cached in
   `figma_specs`, driven from the design room's ingest form. A `carbon.zip` (a React component
   library) contains none of that: no Figma node tree, no file key. Extracting a catalog from a zip
   is a **new reader**, and what it can honestly extract is **names and props** — from the package's
   exports, its types, its stories — and nothing more. It cannot extract implementations, because
   Carbon's are React.
2. **Carbon is React; this canvas mounts Lit custom elements.** "A live, real Carbon dropdown" in
   the draft means one of two things, and it is a decision:
   (a) **we author a Lit implementation per component we want** — the catalog is the vocabulary, the
   element is ours, which is what this app has done all along; or
   (b) **a wrapper that mounts a React root inside a custom element** — real, but a new capability
   (React + Carbon's CSS into a shadow root, bundling, two frameworks in one tree) with its own
   risks. The owner's own sentence points at (a): *"we may have to individually add every
   component."*
3. **"Its own registry.ts per system" is a real restructure.** Every element's declaration lives in
   **one file** today (`frontend/src/shared/tag-registry.ts`, ~1600 lines). Per-system registries
   mean: each catalog directory carries its own registry module, and one loader assembles them (the
   checks and `resolveTag` read the loader). This is exactly what the owner asked for — *"separate
   files, separate .TS, a different registry for these resources"* — and because that one file is
   what every element's contract lives in, it deserves its own increment with the gates green, not a
   corner cut inside another feature.

## §3 — The fact the picker needs, which does not exist

Catalogs are resolved **per surface** today: `a2ui_catalog_for(surface)` (`backend/deps.py:87`) —
composer, console and design each get their catalog, and *nothing* keys a catalog to a **package** or
to a person's choice. "Select Carbon for this package" is therefore a **new fact**: a per-package
choice, read by the assembly when it composes a draft, so that "the model is blind to everything
else" is true by construction — the vocabulary handed to it *is* that one catalog.

## §4 — The increments, smallest first

| # | what | why in this order |
|---|---|---|
| **I1** | **One hand-authored system, end to end, no zip**: a curated catalog in its own directory (a few components we already have Lit elements for), the per-system registry mechanism, the package-level catalog fact, and the assembler pinned to that catalog → the canvas draws the result | proves the owner's demo flow with **zero invented content** and needs none of the unknowns; every later step plugs into it |
| **I2** | **The manifest reader** (the zip path): upload → parse names + props → a catalog skeleton whose entries are `draft: false` and PROPOSED (the ingest's verdict vocabulary: proposed / reviewed / accepted) → a person approves entries | the zip path is real but it *proposes*; it cannot author what it cannot know |
| **I3** | **The drawing**: per accepted component, a Lit implementation (ours) — or the React-wrapper decision of §2.2 if the owner chooses it | the canvas can only mount what exists |
| **I4** | **The assembler + palette gate** (`PLAN.md` S3): the `draft: true` filter beside `_catalog_component_vocabulary()`, reading the package's chosen catalog | the model's palette becomes the partition, and only it |

## §5 — What this flow must NOT do

- **Invent components to look complete.** An entry with no drawing is the dead control this repo
  deletes; the catalog may carry an entry whose element does not exist YET, and then it must be drawn
  as a refusal on the node (the draft already does exactly this) until its implementation lands.
- **Merge the system into the shared catalogs.** A2UI's six primitives travel with every catalog (they
  are the protocol's own); a design system's components belong to their partition and nowhere else.
- **Let the ingest author the marker.** Decided already: `draft: true` is a fact the catalog holds and
  a person confirms; the ingest proposes.

## §6 — The ingest route: three things the spec must change before any code is written

The proposed ingest ("parse the zip, output `registry.ts` + `catalog.json` into the catalogs
directory, mark everything `draft: true`, and the Composer reads only that catalog") cannot be built
as written. Three facts, each measured in this tree:

1. **A `.ts` file cannot be born at runtime.** The browser runs a BUNDLE. `registry.ts` is
   TypeScript compiled by Vite at build time; a file written into the source tree by a running server
   is not in the bundle, is not importable, and does not exist for the app at all. The registry the
   runtime can use must therefore be **DATA**: a per-system `registry.json` mapping a component NAME
   to a tag that **already exists in the bundle** — consulted by `resolveTag` (which today reads
   `tag-registry.ts` and the allowlist). A name with no existing element is not a failure of the
   ingest; it is the refusal the draft already draws, until its Lit implementation lands (§4 I3).
   **This is the change that makes the owner's flow possible at all**: registry-as-data, elements as
   ours.
2. **The backend sees a startup snapshot, not a directory.** `backend/deps.py` loads the catalogs ONCE
   at import (`for _surface in A2UI_CATALOG_SURFACES:` — a **hardcoded tuple**,
   `("prompt-composer", "design-artifacts")`) into `a2ui_catalogs`. A partition created at runtime is
   invisible to the assembler: it is not in the tuple and the map was built at boot. So the ingest
   needs `deps.py` to load catalogs DYNAMICALLY (scan the directory, cache with invalidation) — and
   `a2ui_catalog_for` to accept the PACKAGE's chosen system (§3), not only a surface name.
3. **A zip's shape must be defined before a parser exists.** The Figma ingest parses Figma documents;
   a zip of a component library is a different input, and "map the discrete registry.ts / catalog.json
   fields" presumes the fields are known. They are not — so the contract comes first, and the first
   version is deliberately small: the zip carries a **manifest** we define
   (`system.json` = label + id; `components.json` = names + props + a source path), and the ingest
   reads exactly that, proposes the entries (`draft: false`), and fails loud on anything it cannot
   read. Everything richer (deriving props from a library's own types or stories) is a later reader,
   not the first one.

**The order of work this implies** (each step real when it lands):

1. `deps.py`: catalogs loaded dynamically + a package-level catalog choice — without this, no
   ingested system can be seen or selected. **LANDED AND VERIFIED 2026-10-02** (below).
2. `resolveTag`: consult the per-system `registry.json` (data) — without this, no ingested name can
   be drawn. **LANDED AND VERIFIED 2026-10-02** (below).
3. The ingest route: upload → the manifest reader → a partition (`catalog.json` + `registry.json`,
   entries proposed, `draft: false`) → the person reviews and accepts → `draft: true`.
   **LANDED AND VERIFIED 2026-10-02** (below).
4. The UI: **Add Design System** in the Design room (where the ingest form already lives), the label
   and the upload; a **new system appears as a card/list row** the way packages do.
5. The picker: the package's chosen system, read by the assembly (§3) — the model's blindfold.

### Step 1, as built and measured

`backend/deps.py`: the boot-time snapshot is gone. `a2ui_catalog_surfaces()` scans the directory (a
directory holding a `catalog.json` IS a partition, sorted and deterministic);
`_load_a2ui_catalog()` re-reads when the file's mtime changes and **raises** on failure — a
partition broken at runtime fails the request that asked for it, with the file named, instead of
`sys.exit`ing the server as the boot path did (and still does for the one catalogue the server may
not start without). `a2ui_catalog_for(surface, system)` and `validate_a2ui_components(components,
surface, system)` take the PACKAGE's chosen system, which wins when given and is **loud when its
partition does not exist** — a package that asked for one system and was silently assembled against
another's vocabulary is the substitution this repository hunts. An unknown SURFACE keeps its
documented fallback; nothing about the default changed. `design_system_of(session)` reads the fact:
`session.metadata.design_system` (jsonb — no migration; absent means this package never chose, which
is a real answer).

Measured with the server's own interpreter (`.venv/bin/python`):
`surfaces on disk: [design-artifacts, ecommerce, primitives, prompt-composer]` — the two partitions
that were invisible even at boot (they were never in the tuple) are seen; `ecommerce` loads by name
(`Raibach E-Commerce Catalog`, 38 components) where before it silently fell back to the Composer's;
`unknown surface falls back: True`; a chosen system with no partition **raises**; **a directory
created at runtime is a partition and loads with NO restart** (a probe copy of `primitives`, seen and
loaded in the same process, then removed); and the blindfold is real:
`filter-pill` **passes** against `ecommerce` and is **refused** against `primitives`
(`VALIDATION_FAILED`, with the catalogue's own name in the message).

**Not yet live in the running server**: `deps.py` is loaded at boot, so the server picks this up on
its next restart (`RESTART-LOCAL.sh`) — harmless to defer, because nothing calls the new path yet
(no caller passes a system until step 5), so the running app behaves exactly as before.

### Step 2, as built and measured

`backend/deps.py` gains `a2ui_registry_for(system)`: reads `<partition>/registry.json` (mtime-cached,
like the catalogues), `{}` when the file is ABSENT — a real answer ("no component of this system has
an implementation yet"), never an error — and RAISES with the path named when the file exists and
cannot be read or lacks a `components` object. `backend/routes/misc.py` serves it:
`GET /api/catalog/{system}/registry` — a 404 NAMING an unknown system (a typo must not read as "no
components"), and the map for a known one.

On the client, `frontend/src/shared/a2uiRegistries.ts` FETCHES and caches the map per system (a
failed fetch throws, with the system and the status named — never a silent empty map), and
`resolveTag(name, system)` gains step 6: the partition's map, consulted **LAST**, so the bundle's own
tables keep every name they already own and an ingested map can never hijack one. The drafting canvas
carries `system` (a host-written property, like the header's view) and resolves each node against it,
with **two refusals, two sentences**, both drawn on the tile by name: the catalogue does not know the
name, or the name maps to an element this bundle does not contain ("maps to `<tag>`, and nothing in
this app draws that element yet" — the honest state for a proposed-but-unimplemented component). The
host loads the package's chosen system (`metadata.design_system`) BEFORE the tree names any
component, and fails loud if it cannot be read.

**Measured** (server side, with the server's own interpreter): a probe partition's map read exactly
(`{'ProbeText': 'a2ui-text', 'ProbeUnknown': 'probe-not-a-real-tag'}`); a partition with no
`registry.json` answered `{}`; a malformed registry **raised** with the path. `tsc` and
`npm run build` clean.

**One proof deliberately deferred, per the owner's instruction:** the on-canvas rendering of a
data-resolved name. It needs the registry ROUTE live, which needs the server restart that was
explicitly held back — so it belongs to the unified test after the ingest steps, and it is the first
thing that test should show.

### Step 3, as built and measured

`backend/routes/figma.py` gains `POST /api/catalog/ingest` (multipart: `file`, optional `label`),
sitting beside the Figma ingest because that is where the catalogue-writing code lives.

**The contract it enforces.** The archive carries two members, read IN MEMORY and **never extracted**
— extraction writes attacker-named paths; two members are read BY NAME and turned into two files
whose names this code chooses. `system.json` = `{id, label}` (id: 2–41 chars of lowercase letters,
digits and dashes — it becomes the directory name); `components.json` =
`{components: [{name, props: [{name, type}], source}]}`, where every prop STATES its type from
string/number/boolean/object/array — a prop whose type nobody stated cannot become a schema, so it is
a 400, not a guess. **The manifest is the authority**: a form label that disagrees with
`system.json`'s is a 409 naming both, because two authorities on one name is how a catalogue gets
titled one thing and referenced as another. An id that already exists is a **409** — creating a NEW
partition is the action, and nothing writes into a catalogue that is already there.

**What it writes:** one new directory holding exactly two files — `catalog.json` (one entry per
component, `draft: false`, with `proposed: {source, at}`, and a description that says out loud it is
unreviewed) and `registry.json` (`{"system": id, "components": {}}` — nothing is implemented yet,
which is the truth and draws as the refusal sentence). The system catalogues are never opened.

**Measured** (handler called directly with the server's interpreter; the running server predates the
route): a two-component Carbon manifest ingested cleanly — `files written: [catalog.json,
registry.json]`, `title: Carbon (proposed)`, `draft flags: {CarbonDropdown: False, CarbonTable:
False}`, `registry: {system: carbon-ui, components: {}}`; and then **the app's own readers saw it with
no restart** — `carbon-ui` a partition, its catalogue loading as `Carbon (proposed)` with 2
components, its registry `{}`, the four system partitions untouched. Every failure mode is loud:
existing partition **409**, label conflict **409** (naming both), bad id **400**, untyped prop **400**,
not-a-zip **400**.

The probe partition was then **removed**, so the owner's first real upload creates `carbon-ui`
cleanly instead of hitting the 409 — the pipeline is proven; the scaffolding is not kept.

**Step 4's client is thin:** the form posts the file (and, if it asks, the label — which must match
the manifest), shows the response, and the new system appears in the Design room's catalogue list.

### Step 4, as built and measured

Five pieces, and every one of them is the app's own mechanism rather than a new one:

1. **`frontend/src/components/lit/catalog-ingest-form.ts`** — the form. It DRAWS AND DISPATCHES ONLY:
   the label field, the `.zip` field, Submit, a message line, and a standing note that states both
   refusals a person would otherwise meet by being refused (the manifest's label is the authority and
   a disagreement is refused; creating a NEW system is the action and an existing catalogue is never
   written into). On Submit it emits `catalog-ingest-submit` with `{label, file}` — the same contract
   `<figma-ingest-form>` states one field over.
2. **`backend/routes/ai.py`** — the rail now emits it BESIDE the Figma form
   (`_kids["left"] = ["left-form", "left-system-form", "left-rail"]`), with its two values as BOUND
   DATA-MODEL PATHS under its own keys (`/session/design_system_ingest/{busy,message}`). That is the
   channel the renderer re-applies — a components change does not re-hand props (the Figma form's own
   emission records the measurement) — and the keys are separate because two ingests in one rail must
   not write one message line.
3. **`Tag-registry`** — the element declared before it ships, with the ingest laws as its constraints.
4. **The design-artifacts catalogue** — `catalog-ingest-form` declared (63 components now), so the
   design gate ACCEPTS the rail it appears in; an undeclared name would have been rejected by
   `validate_a2ui_components` the moment the room assembled.
5. **`WritingAreaIndex.tsx`** — the half that knows: `catalog-ingest-submit` → `FormData` →
   `POST /api/catalog/ingest` → the server's words **verbatim** when it refuses (every 400/409 names
   what is wrong; re-wording it here would be a second authority on the reason), and on success the
   created partition named with its proposed count.

**Measured:** `tsc` clean, `npm run build` clean, `py_compile` clean, and the design gate accepts the
new component (`deps.a2ui_catalog_for('design-artifacts')` carries it). **Reachability — SEEN
2026-10-02, after the restart went in:** opening Design draws the rail with BOTH forms under each
other — the Figma form (URL / Notes / Submit) and the second form (Design system label / the `.zip`
/ Add design system / its standing note) — with the catalogue list below it counting
`design-artifacts 63` (the new form's own entry is the +1), and the console carries **no
`ENVELOPE REFUSED for render-design`** — only `Design clicked → intent: render-design (its own
process)`. The earlier "the rail does not show it" checks were reading a surface assembled before
the restart; the emission was never in question. **What remains of the unified test:** upload a real
`carbon.zip`, watch the tree gain the new system, then open the product package and draft with it —
and the route is live now, so that upload is the next act, not the next build.

And one boundary law held throughout: the ingest **creates a directory** and writes nothing outside
it — never the harness catalogs, never `tag-registry.ts`, never the primitives. Isolation is the
feature.