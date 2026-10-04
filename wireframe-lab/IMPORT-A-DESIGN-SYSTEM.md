# Importing an existing design system — the procedure, learned on AgnosticUI (2026-10-03)

This is the playbook for bringing a COMPANY'S existing design system into this app as a
catalogue. It is written from the first real run (AgnosticUI's Select, taken end to end), and it
is what a deterministic tool (`prepare_design_system.py`, the named next build) will automate —
the measurable half — while this document stays the judgment half an agent or person follows.

**The law both halves obey:** everything here PROPOSES. Whatever proposes — an agent's hands, a
script, an upload — the entries land `draft: false` and a person accepts them in the Design
room's rail. The system catalogues (prompt-composer, design-artifacts, ecommerce, primitives) are
never opened by any of this; their markers are hand declarations, reviewed in git.

---

## 1 · Audit the source (read-only, in memory, never extract)

- Open the archive with `zipfile` and STREAM the files out; extracting writes attacker-named
  paths and there is no reason for it.
- Count the elements: `customElements.define(` and `@customElement(` calls; note their namespaces
  (`ag-`, `bx-`, `kor-`, `lion-`…). A shipped `custom-elements.json` (Custom Elements Manifest)
  is the best input when present — **read it first**; otherwise the source is parsed.
- Record what the zip actually carries: a raw code repo, a dist, a .fig (a DIFFERENT door — Figma
  files go through the Figma ingest, not this procedure), or multiple systems in one archive.

## 2 · Choose the system, the partition, and the FIRST component

- One system → one partition (`<id>/catalog.json` + `<id>/registry.json`). `id` is 2–41 chars of
  lowercase letters, digits, dashes; it becomes the directory name.
- Start with ONE component that the system's own architecture makes easy (AgnosticUI's
  source-first "copy the source, own the code" is the easiest class). Record the choice.

## 3 · Close the import closure — and NAME anything foreign

- Read the chosen component's file; list its imports. Walk RELATIVE/internal imports until the
  closure closes (AgnosticUI's Select needed 3 shared modules + 1 util — six files total).
- Any import of a FOREIGN package (`@carbon/…`, `@lion/…`) is a named decision, not a detail:
  stop and say so. Copying source that imports a package this app cannot resolve draws a broken
  module. Fail loud; do not improvise a shim.

## 4 · Copy in — mirror upstream's tree so every import stays byte-identical

- Destination: `frontend/src/components/lit/<system>/…`, mirroring the upstream path (e.g.
  `components/Select/core/_Select.ts`, `shared/…`, `utils/…`). Mirroring is what keeps the
  relative imports (`../../../shared/…`) valid with ZERO edits.
- THE ADAPTATION CLASSES, so far — TWO, and each one is MEASURED before it is applied:
  1. **Decorators**: this repo's TypeScript is lit-3 STANDARD decorators
     (`useDefineForClassFields: true`, no `experimentalDecorators`) — legacy-decorated fields get
     `accessor` inserted, and decorators come off `declare`d members.
  2. **The import rewrite** (found on the Kor batch, 2026-10-03): a `lit-html/…` sub-specifier
     this app cannot resolve — TS2307, because lit-html's exports map lists only the `.js` form
     and this app declares `lit`, not `lit-html` — is rewritten to the SAME directive through
     `lit` (`lit-html/directives/if-defined` → `lit/directives/if-defined.js`). The rewrite names
     the error that proved it, in the file's header.
  Record every adaptation in the file's header (source, date, the exact adaptations) — the file
  stops being byte-identical the moment one token changes, and the record says which.
- Keep upstream's TAG (`ag-select`) — the namespace is provenance and collisions with the app's
  own tags have been zero across the four systems audited so far.

## 5 · Declare before it ships — in the SYSTEM'S OWN registry, never the app's

**Amended 2026-10-03, on the Kor run, by the wall.** The owner watched a session drawing from an
ingested system and said it plainly: *"These are supposed to be separate, isolated catalogs. They
do not share any assembly information. They do not share a registry… The applications catalog
cannot be leveraged for this."* And the rule it applies, recorded earlier
(`PLANS.AGENT/multiple-catalogs.md` §10): **"The app's three files are the app catalogue's files"** —
`shared/tag-registry.ts` belongs to prompt-composer, and a second catalogue never writes into it.
Instance #1 declared into that file; the wall moved it out the day instance #2 landed.

- **The system's own registry module** — `frontend/src/components/lit/<system>/registry.ts`:
  the entries for the tags the system brought in — surface, column, description (naming it as
  copied upstream code, with the source URL), props measured from the source's own declarations,
  events, and constraints ("its look is upstream's — do not restyle it here") — typed against the
  `TagDefinition` contract exported where the allowlist's schema lives. It also carries the
  system's own element imports: an element in no import is an element the bundle does not contain.
- **The system's own name→tag table** — `wireframe-lab/catalogs/<system>/registry.json`
  (`{"system": id, "components": {name: tag}}`): the RESOLUTION half, data because a bundle is
  built before a system is ingested. **This is the step that makes an implemented component
  resolvable**: the ingest writes this file empty ("nothing is implemented yet" — the truth at
  proposal time), and the landing of an implementation records its map here. `resolveTag(name,
  system)` reads THIS table first; the app's allowlist is not consulted for a system's names.
- **Registration** — `frontend/src/components/lit/register.ts` imports the system's registry
  module (one line per system), the same side-effect rule as every element of this app.

## 6 · The manifest — MEASURED, never invented

- `system.json` = `{"id": …, "label": …}` — the label is the authority the upload form must match.
- `components.json` = one entry per component: `name`, `props` (each with a type from the five
  the route accepts: string/number/boolean/object/array — mapped from the source's `@property`
  types or the CEM), `source` (the upstream path, for provenance).
- A prop whose type cannot be measured is LEFT OUT — a measured subset, never a guessed type.
- Zip the TWO FILES (not a folder) → the person's upload in the Design room.

## 7 · The act, and the verification

- Upload → the form answers (partition created, entries PROPOSED). Accept in the rail → the entry
  becomes placeable (`draft: true`, who/when recorded on the entry).
- Verify: the chooser lists the partition; with it chosen, the tray offers the accepted names and
  Grace's script names them (the room hands her THE SESSION'S OWN catalogue + palette — an
  ingested system's own file, never the app's); a draft node resolves through `resolveTag` — **the
  chosen system's own `registry.json` first**, the app's allowlist only for the app's own names
  (the system's were never written into it). The strong proof, driven on the Kor run: empty the
  system's `registry.json` and the name must draw *"The catalogue does not know \"<name>\"."* —
  no fallback exists anywhere; restore it and the element draws again.

## 8 · What this procedure does NOT promise

- No universal transpiler: the manifest is measurable, but the IMPLEMENTATION is per system
  (source-first copy, wrapper, or our rebuild — the owner's own recorded words: *"we may have to
  individually add every component"*). The pipeline makes it repeatable; it does not make it free.
- No bypass of the wall: a script that "accepts" is the same forbidden move as an ingest that
  accepts. Propose is the machine's half; accept is the person's.

---

*Instance #1: AgnosticUI `ag-select` — 6 files copied (two decorator-mode adaptations, recorded in
the file header), 12 props measured from its source, partition `agnosticui` ingested from the
measured manifest, accepted in the rail, placeable in the Product room.*

*Instance #2: Kor — `kor-button` (plus `kor-icon`, the dependency its closure needs) — 5 files
copied (one decorator-mode adaptation, the header naming it exactly; the byte-identical three
verified with `diff` against the archive), 4 props measured from the source's own `@property`
declarations and JSDoc, partition `kor` ingested the same day (the lab writes the real files; the
ingest creates the app-tree symlink), accepted in the rail, placed in the Product room — and the
run that exposed and fixed the wall: the system's own registry module, its own `registry.json`
map, and a session's model context carrying its own catalogue. Honest limits recorded the same
day: the button draws unthemed (upstream's CSS variables are not defined by this app), a
hand-placed node lands with empty props (zero-size until content arrives), and the accepted
entry's description still carries the ingest's "NOT REVIEWED" sentence — the accept route flips
`draft` and records who/when but does not rewrite the ingest's prose.*
