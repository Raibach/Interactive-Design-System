# Many catalogues — handoff prompt for the coding agent


> **Start with `START-HERE.md`** — it says what is built, what is verified, and the next step. This file is the specification for the next piece of work.
**For the agent, not the owner.** What exists, what is hard-wired to one catalogue, and the
staged work to make the app manage several. Written 2026-09-28, after the ingest pipeline was
working end to end for the app's own catalogue.

---

## 1. The point

The app is a **catalogue manager**. What it has been managing is its own catalogue
(`prompt-composer` — the components this application itself renders). The owner now needs a
**second, entirely separate catalogue**: the design system their enterprise product's customers
see. The app manages other parts of the organisation's Lit catalogues; each catalogue has its
own components, its own registrations, its own gate verdict, and its own reason to exist.

So "a new catalogue" is not a folder holding a copy. It is a **configured entity**: a catalogue
file, a registry of names, a Figma map, a components directory, a package root whose tools run
the gate, and its own stated counts.

## 2. What is hard-wired to one catalogue today

| Piece | Hard-wired how |
|---|---|
| `backend/deps.py:26-40` | Loads ONE catalogue at import: `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json`, and `sys.exit(1)` if it is missing. This is the load-bearing one — it is also what took the whole API down when that file went missing. |
| `backend/routes/figma.py:215` | `INGEST_CATALOG_PIPELINE = os.getenv("FIGMA_INGEST_CATALOG", "prompt-composer")` — one name for every ingest, registration, lookup, removal and gate run. |
| `_catalog_component_names()` (`figma.py:1323`) | Reads the single `a2ui_catalog` from `deps`, so the assembly model is only ever offered one design system's components. |
| `_catalog_file_path()` (`figma.py:373`) | Candidates are the root `A2UI/catalogs/<pipeline>/` and the frontend copy for the SAME pipeline name. |
| `frontend/scripts/catalog-check.mjs:35` | `const CATALOG_NAME = 'prompt-composer'` — the gate checks one catalogue, and writes `catalog-audit/prompt-composer.json`, which `GET /api/catalog/audit` serves. |
| `frontend/src/shared/tag-registry.ts` | ONE allowlist, and it is the app's own: surface/column vocabulary that belongs to this application's UI, not to a customer product's. |
| `frontend/src/components/registry.json` | ONE Figma map ("THE FIGMA MAP") for the app's components. |
| `figma_ingest_activity` table | No `catalog_id`: the record cannot say which catalogue an approval belonged to. |
| The tool (`IngestModal.tsx`) | Has no notion of *which* catalogue it is adding to. |

## 3. The design

**A catalogue becomes a descriptor**, one file listing them all — `A2UI/catalogs/index.json`:

```json
{
  "catalogs": [
    {
      "id": "prompt-composer",
      "title": "The application's own console and composer",
      "catalogFile": "frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json",
      "componentsDir": "frontend/src/components/lit",
      "allowlist": "frontend/src/shared/tag-registry.ts",
      "figmaMap": "frontend/src/components/registry.json",
      "countClaims": ["README.md", "READ-ME/IMPLEMENTATION_CONFORMANCE.md"],
      "packageRoot": "frontend",
      "default": true
    },
    {
      "id": "<customer-product-id>",
      "title": "…",
      "catalogFile": "…",
      "componentsDir": "…",
      "allowlist": "… or null when the product resolves by catalog alone",
      "figmaMap": "…",
      "countClaims": [],
      "packageRoot": "… so the gate and esbuild resolve that package's tools"
    }
  ]
}
```

Everything the pipeline does then takes a `catalogId`, defaulting to the one marked default:

- `POST /api/figma/ingest { …, catalogId }` — the model is offered **that** catalogue's
  component names, and the draft is bound to it.
- `POST /api/figma/commit` — writes into that catalogue's `componentsDir`, registers in its
  map/allowlist/catalog, re-derives its counts, runs the gate in its `packageRoot`.
- `POST /api/figma/remove`, `GET /api/figma/component|node|find|catalog|activity|unresolved` —
  same parameter; the record stores `catalogId` so the procession can be read per catalogue.
- `GET /api/figma/catalogs` — what exists, each with its current component count and last
  verdict, for the tool to offer a choice.

**`deps.py` stops being a single-catalogue gate.** It should load every catalogue in the index
into a dict keyed by id, validate each, and — instead of `sys.exit(1)` — mark the server **not
ready** with the reason, serving 503 from the A2UI endpoints while the rest of the API stays up.
A catalogue problem must not take the model and the console down again.

## 4. Stages, each shippable on its own

1. **The index, the loader, and creating one.** Add `A2UI/catalogs/index.json` with the one
   existing catalogue as `default`. `deps.py` reads the index, loads all catalogues into
   `a2ui_catalogs[id]`, and reports per-catalogue readiness instead of exiting. Then the create
   path: `POST /api/catalogs` takes a descriptor (id, title, catalogFile, componentsDir,
   figmaMap, allowlist or none, packageRoot, countClaims) and **creates the catalog file as a
   valid empty catalogue** — `$schema`, its own `catalogId`, `components: {}`,
   `$defs.anyComponent.oneOf: []` — plus its index entry. Validation: the id is lowercase-kebab
   and unique; every path resolves inside the repository; an existing file is never overwritten
   (create is create); the actor is recorded. *Verify:* server starts, `/api/figma/catalogs`
   lists one with its counts, the gate still reads 57 / 13 / 1, and creating a throwaway
   catalogue produces a file that parses and an entry that lists it — then remove it and confirm
   the index is back to one.
2. **Thread `catalogId` through read paths.** `/api/figma/catalog`, `component`, `node`, `find`,
   `activity`, `unresolved`, and `_catalog_component_names()` take the id with the default
   applied. *Verify:* every existing response is unchanged when the id is omitted.
3. **Thread it through write paths.** `ingest`, `commit`, `remove`, plus the `catalog_id` column
   on `figma_ingest_activity` (backfilled with the default). *Verify:* approve and remove a
   component in the default catalogue — file, three registrations, counts, gate — exactly as now.
4. **The second catalogue.** Create its descriptor, its empty catalog file, its map and (if it
   has one) its allowlist; then ingest, approve and remove one real component from it. *This is
   the acceptance test for the whole feature.*
5. **The tool.** A catalogue selector in the header — a dropdown listing the catalogues with
   their component counts, defaulting to the default one, and **`+ New catalogue`** at the foot
   of it. Choosing "new" asks for the few human fields (a title, an id suggested from it, where
   its components live) and calls the create endpoint from stage 1; everything else it fills in.
   The drafts list, Grace's column, the outcomes and the History view all scope to the selected
   catalogue — that scoping *is* the wall as far as a designer can see it. The verdict shown is
   the selected catalogue's, and if it has no gate yet the tool says so rather than showing
   another catalogue's.
6. **Later — the gate for a catalogue that lives in another package.** `catalog-check.mjs` must
   take the catalogue to check (an argument or the index) instead of `const CATALOG_NAME`.
   Until then, a non-default catalogue gets its own check or none, and the tool must say which.

## 5. Decisions the owner has to make (ask, do not assume)

1. **Where do the new catalogue's components live?** Another directory in this repository
   (`frontend/src/components/lit-<product>/`), or another repository entirely? If it is another
   repository, the pipeline needs a configured root outside this tree — and the preview path
   (today a Vite dev plugin inside *this* app) no longer applies, so previewing a customer
   component has to happen in the customer's own dev server, or by copying the source to a
   preview sandbox here.
2. **Does the customer catalogue need an allowlist at all?** `tag-registry.ts` carries this
   application's `surface`/`column` vocabulary. A customer product that renders purely from the
   catalog may need no second registry — in which case "register" means two edits, not three,
   and the tool must say so per catalogue.
3. **Who may add to which catalogue?** The record already carries the actor; a second catalogue
   may want a rule (e.g. only the design-system team approves into the customer's).

## 6. Rules that carry over unchanged

- Ingest writes nothing; approval is the only write. Discard deletes server-side. Removal deletes
  the file and every registration, and records who did it.
- Never trust a request body with code or a path: the server's own drafts and tag-derived paths.
- The gate's verdict is what "in the catalogue" means — per catalogue, from here on.
- Every failure is recorded with a `nextStep`, and `unresolved` is how the left-behind work is
  found later. Both need `catalogId` so a failure can be traced to the catalogue it belongs to.
- Files are hand-formatted (`registry.json`, `tag-registry.ts`): splice textually, never
  re-serialise, and verify a round trip before writing.

---

## 7. Decision (owner, 2026-09-28): separate, never merged

The application's own catalogue and its process stay **separate** from any design source added
later. No merging, no shared allowlist, no shared counts, no shared gate verdict: a customer
design system is its own catalogue with its own files and its own definition of "in the
catalogue". The tool and its records name which catalogue they are working in.

**Location:** `lit_design-catalogs/<system>/` — deliberately outside `frontend/src`, so nothing
in the application can import a customer component by accident.

## 8. How a customer design system is actually brought in — CORRECTED (owner, 2026-09-28)

**It is opened in Figma and ingested through Figma, like everything else.** A design system comes
in as a Figma file: layers, node ids, annotations, both channels — and the assembly model builds
its components exactly as it does for the app's own catalogue. The only difference between the
two catalogues is *which* catalogue the component is approved into; the pipeline is the same one.

That simplifies this considerably:

- **No manifest to generate**, no source parsing, no reading someone's package.
- **The Figma map works unchanged** — which node each component came from — with one addition
  below.
- **The preview works unchanged** — a draft module served by this dev server, because the
  component is generated here, not imported.
- **Registration is the same** — file, map, catalogue (plus an allowlist only if that catalogue
  has one).
- Stages 1–5 in §4 are the whole requirement; stage 4's acceptance test is simply: open the
  design system's Figma file, ingest one of its nodes, approve it into the new catalogue.

**One addition this forces:** the map entry and the record must carry the **Figma file key**, not
just the node id. Two design files are in play now, and node ids are only unique within a file —
`1:1` in the customer's file is not `1:1` in the app's. Today's records carry `fileKey` for the
ingest but the map entry does not; it should, or "which node" becomes ambiguous the moment there
are two files.

### The other species of work, kept as an option (not the chosen path)

A design system that already exists as code could instead be **imported**: upload it, read its
manifest, declare what it contains into its own catalogue. The owner finds the idea interesting —
an upload button, its own catalogue, no Figma involved — and it is kept here as an alternative,
with the analysis in §9 for whenever it is wanted. It is not the path for Carbon.

Figma generation and this are different jobs, and the pipeline should say so:

| | The app's own catalogue | A customer design system |
|---|---|---|
| Where components come from | the assembly model, from a Figma node | they already exist, written by someone else |
| What the pipeline does | **generates** a component | **declares** what is already there |
| Figma | both channels | often none at all |
| The Figma map | which node each component came from | not applicable |
| The allowlist | this app's surface/column vocabulary | only if the product resolves through it |
| The gate | surfaces, the tag registry, count claims | declarations vs. the source's own manifest |

**The archives already collected** in `lit_design-catalogs/`: `carbon-web-components-main.zip`
(42 components — accordion, breadcrumb, button, … — its own `package.json`, and **no**
`custom-elements.json`, so a manifest must be generated), plus `agnosticui-master`,
`awesome-lit-main`, `kor-develop`, `lion-master`. Five sources, five candidate catalogues.

**The import path, staged:**

1. **Extract one system** to `lit_design-catalogs/<system>/` and give it a catalogue file of its
   own (`catalog.json`, its own `catalogId`) — nothing shared with the app's.
2. **Generate a manifest** for it with `@custom-elements-manifest/analyzer` over its sources
   (Carbon ships none), which yields every component's tag, props and events mechanically.
3. **Declare** those into the catalogue — a mechanical translation of the manifest, no model
   involved, because nothing is being designed. That is the "add components from the design
   system" step.
4. **A gate of its own kind**: every declared component exists in the source; every declared
   prop and event appears in the manifest; the stated count equals what is declared. The app's
   `catalog-check.mjs` cannot do this — it checks this application's surfaces — so either it
   gains a manifest mode or the catalogue gets its own checker.
5. **Then the tool** can show a second catalogue's components, and a person can see what a
   design system contains before anything is composed from it.

**Still to decide (ask before building):**

- Which system first — Carbon is the largest and has no manifest, so it is the honest test case.
- Is a customer catalogue **for rendering** in the product (components must be built and
  resolvable) or **for reference and composition** (the app needs to know what exists and what
  each thing is for, so the assembly model can name it)? The answer decides whether the
  components need a preview path at all, or only declarations and descriptions.

---

## 8b. Two things not to confuse: a catalogue is not a Lit version

Asked and clarified by the owner, 2026-09-28, because an earlier draft of §9 muddied them:

- **A catalogue** is a JSON schema of components plus its registries — its own catalog file, its
  own Figma map, its own allowlist if it has one, its own gate verdict. Carbon gets its **own
  catalogue**; that is the work in §4.
- **A Lit version** is just the library a component's code is written in. This app is on `lit`
  3.3.3.

**Along the chosen path (Figma → generate) they never interact.** A component ingested from any
Figma file is generated by our assembly model in **Lit 3**, following this repo's conventions, so
a Carbon catalogue starts as a *separate catalogue with the same Lit version as the app's*. The
Lit-2 discussion in §9 applies **only** to the alternative of importing a package's source.

Lit versions are a **runtime** fact, not a cataloguing one: a customer product may run whatever
Lit it likes while the catalogue records what its components are — the two do not constrain each
other. The app itself would host two Lit versions only under the import path.

## 9. If the import path is ever taken: what the Carbon archive actually is (verified 2026-09-28)

**Kept for the alternative in §8, not the chosen route.** Were Carbon imported as code rather
than ingested through Figma, the components are already written as Lit web components, so the
catalogue work would be declaration only — no model, no generation. Confirmed from the archive:

| Fact | Value |
|---|---|
| Package | `carbon-web-components` **1.21.0**, dated **2022-12-21** (an archived snapshot; IBM's successor is `@carbon/web-components`, Lit 3) |
| Lit it is written in | `lit-element ^2.5.1` + `lit-html ^1.4.1` — the Lit 2-era, **not** the `lit` 3.x this app uses |
| Component style | `@customElement` decorators and mixins, e.g. `class BXButton extends HostListenerMixin(FocusMixin(LitElement))` — the opposite of this repo's no-decorators convention |
| Tags | prefixed at definition time (`` `${prefix}-btn` ``), i.e. `bx-*` for this version — so the element names in the catalogue are `bx-…`, not `cds-…` |
| Manifest | **none**, and no manifest script — generate one with `@custom-elements-manifest/analyzer --litelement` over `src/components/**` |
| Count | **42** component directories (accordion … ui-shell) |

**What that means for the plan:**

1. **Declaring is mechanical and safe**: extract → generate the manifest → translate it into that
   catalogue's declarations → gate declarations against the manifest. No Figma, no assembly
   model, no prompt.
2. **A second Lit version is accepted** (owner, 2026-09-28: "we might have a couple different Lit
   versions"). It is workable here and for concrete reasons: `vite.config.ts` has **no
   `resolve.dedupe`**, so two copies are not collapsed into one; npm nests the conflicting
   version (this app is `lit` 3.3.3 / `lit-element` 4.2.2, Carbon v1 wants `lit-element` ^2.5,
   so it gets its own copy); and every preview already runs in a sandboxed `srcDoc` iframe — a
   separate document, so a previewed component's Lit is isolated from the app's by construction.
   What actually needs care is not Lit but these four:
   - **Tag namespace**: `customElements` is global per document. Each catalogue's tags must keep
     their own prefix (`bx-*` for this Carbon) so nothing collides with the app's elements.
   - **Its own resolver**: the app resolves a name to a tag through *its* registry. A foreign
     catalogue needs its own name→tag table, or a surface naming a Carbon component resolves to
     nothing.
   - **Never add `resolve.dedupe: ['lit']`** (or a global `lit` alias) later: that is precisely
     what would collapse two versions into one and break the older components.
   - **Cost**: two Lit runtimes in one bundle. A catalogue that is only ever previewed can stay
     out of the app's build entirely and load inside the preview iframe on demand.
3. **Version honesty**: a 2022 snapshot is a fine design source for structure and naming, but it
   is not the live Carbon. Before a catalogue is built against it, decide whether the source
   should be this archive or current `@carbon/web-components`; the answer changes the Lit
   version, the tag prefix and the prop set.

---

## 10. The hard wall — what must never be shared, and where the code bends today

Owner, 2026-09-28: *"They're going to be independent… I'm not merging catalogues or anything.
I'm not sharing. It's got to be separate. There's gotta be a hard wall between each one of these
catalogues — the registries, how they're processed."*

A wall means: **every path, registry, checker and count comes from the catalogue's own
descriptor, and nothing falls back to another catalogue's.** A fallback is not a convenience
here — a fallback that picks "whichever file exists" is exactly how one catalogue's write lands
in another one's tree.

**The audit (each site must be scoped by catalogue id):**

| # | Site in `routes/figma.py` | Reaches for | Under the wall |
|---|---|---|---|
| 1 | `_catalog_file_path()` (373-374) | the root copy **then** the frontend copy of one pipeline name | one path from the descriptor; **delete the candidate list** |
| 2 | `_register_in_catalog()` (381) | that same resolved path | the catalogue's own `catalogFile` |
| 3 | `_register_in_allowlist()` (318) | the app's `shared/tag-registry.ts` | the catalogue's own allowlist, or **no write at all** when it has none |
| 4 | `_register_in_figma_map()` (539) | the app's `components/registry.json` | the catalogue's own `figmaMap` |
| 5 | `_figma_map_lookup()` (1432, 2963) | the app's map | the target catalogue's map — otherwise "already a component" is another system's answer |
| 6 | `_catalog_component_names()` (1323-1333) | `a2ui_catalog` from `deps`, **then** the root path fallback | the named catalogue's components only; delete the fallback |
| 7 | `_catalog_check()` | `npm run catalog:check` in `FRONTEND_DIR` | the catalogue's own `packageRoot`, or its own checker |
| 8 | `_sync_catalog_claims()` (470) | the app's `README.md` and `IMPLEMENTATION_CONFORMANCE.md` | the catalogue's own `countClaims`; empty means write nothing anywhere |
| 9 | `CATALOG_AUDIT_PATH` (2646) | `catalog-audit/<pipeline>.json` in the app | per catalogue |
| 10 | `_catalog_state()` (2656-2657) | both copies again | the descriptor's one path |
| 11 | `_remove_from_figma_map/allowlist/catalog` (2708, 2760) | the app's three files | that catalogue's three places, and only those |
| 12 | `/api/figma/component`, `/node`, `/find` (3091, 3114) | the app's map and allowlist | scoped reads, or a name in Carbon answers with the app's component |
| 13 | `figma_ingest_activity` | no `catalog_id` | add the column (backfilled with the default) — a record that cannot name its catalogue cannot be governed |
| 14 | `INGEST_CATALOG_PIPELINE` (215) | one env default for every request | keep as the *default id* only; every call takes an explicit id |

**Three consequences worth stating as rules:**

1. **No candidate lists, no fallbacks, no "whichever exists".** One catalogue, one path, and a
   missing file is a loud failure for that catalogue alone — never a quiet read of another's.
2. **The app's three files are the app catalogue's files.** `README.md` counts, `tag-registry.ts`
   and `components/registry.json` belong to `prompt-composer`. A second catalogue must never
   write into them, and its descriptor says what it has instead.
3. **Every read is scoped too.** `find`, `component` and `node` are currently global; under the
   wall a search in one catalogue must not answer with another's component — including when the
   names are identical, which they will be.
