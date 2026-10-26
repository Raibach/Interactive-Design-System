# The design-update flow — restyle from Figma, see it in the composer

**Written 2026-10-15, on the owner's ask** — his words: *"I want to update the styling of the
app through the Design tab. This is the whole purpose of the Figma ingest process… the
complexity lies in the entire flow: ingest → approve → add to live lit catalog → refresh →
see the new design in the composer."* And the standing instruction for it: *"Much of this
story is already present — this is not new work. It is work that must be preserved and
protected as we move forward with the Design section lit catalog ingestion and design update
process."*

**The goal loop, in one line:** draw in Figma → ingest the node (Design room) → preview →
approve → the component is written and registered (the live Lit catalog) → refresh → the
composer draws the new design, with its bindings and its manipulation intact.

**Companion document:** `composer/THE-COMPOSER-IS-A-PURE-A2UI-SURFACE.md` — the Composer
zone's first map (the surface this flow must land in). Nothing in this plan is built by
writing it down.

---

## §1 What already exists (verified against the files, 2026-10-15)

### 1.1 The Lit catalog — three layers plus a resolver

| layer | file | decides |
|---|---|---|
| CATALOG | `frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json` | what the **server** accepts; a payload it refuses is a **503, the whole surface** — loud |
| REGISTRY (the allowlist) | `frontend/src/shared/tag-registry.ts` | what may be **rendered** (`TAG_REGISTRY`) and what the AI may **emit** (`AI_PLAYGROUND_TAGS`) |
| RUNTIME | `frontend/src/components/lit/**` | what draws |
| RESOLVER | `frontend/src/components/lit/a2ui-renderer.ts` | name → tag: `COMPOSITE_MAP` → primitives → structural composites → the allowlist. A name nothing claims is **reported**, never guessed |

Four catalogues exist today (`frontend/src/components/A2UI/catalogs/`): `primitives` (the
shared floor every theme must carry byte-identical), `prompt-composer` (the composer's gate —
the default), `design-artifacts` (the Design room's own copy of the same names — the owner's
"entered in both places" rule is written into the file itself), and `ecommerce` (a scaffold
awaiting pruning).

**The catalogues are resolved at ask-time, not at boot** (`backend/deps.py`, reworked
2026-10-02): a catalogue file changed by an approval is seen on the next request — a partition
created while the server runs is a partition. The default catalogue loads at boot and is fatal
if unreadable (a server that validates against nothing passes everything). A broken catalogue
raises with the file named; it never falls back to "no components".

### 1.2 The ingest tool (Design room)

- Paste a node URL → **both Figma channels** (REST + MCP) are read and merged → the renderer
  builds a draft from the measurements → a staged preview — a CACHE, not work: TTL 90 s with a
  heartbeat while the screen is open; a closed tab loses it — → approve or discard.
  **Ingest writes nothing; approval is the only write** (`backend/routes/figma.py`, the
  `FIGMA INGEST PIPELINE` banner).
- The doctrine (`design/figma-ingest/CHANGELOG.md` header, quoting the owner): the design owns
  the drawing and the generator **reads it, never interprets it**; everything that is not a
  drawing lives in a **hand-written file the ingest cannot write**; a re-ingest must produce
  the same bytes for the same node; nothing in a generated file may be underivable.
- The identity rule: a Figma node id carries a **component reference** and an **occurrence**
  (the numbers after the colon are where an instance sits); the tag is
  `f-<node id with ':' → '-'>`; "same component?" is answered by the part before the
  semicolon. Re-ingesting the same node re-derives the same tag.

### 1.3 The approve write-set (what "live" means) — verified in `api_figma_commit`

1. **the element** — `frontend/src/components/lit/<tag>.ts` (f- tags only — see the two doors
   below)
2. **the artwork** — assets vendored into `frontend/public/assets/`, references repointed; an
   asset that cannot be obtained is **reported** in the record, never dropped quietly
3. **the Figma map** — `frontend/src/components/registry.json`
4. **the allowlist** — a `TAG_REGISTRY` entry **and** an `AI_PLAYGROUND_TAGS` line (without
   the second, the tag exists but nothing may emit it)
5. **the catalogue** — the definition **and** its `$defs.anyComponent.oneOf` reference in
   `A2UI/catalogs/<INGEST_CATALOG_PIPELINE>/` (`FIGMA_INGEST_CATALOG`, default
   `prompt-composer`)
6. **the counts** — `README.md` + `READ-ME/IMPLEMENTATION_CONFORMANCE.md` ("N trusted
   components") — a drifted count is a blocking finding
7. **the gate** — `npm run catalog:check`; its verdict is returned and shown. The check
   **reports**; `ok` is read from its report, never from its exit code
8. **the layer record** — the measured tree written per pipeline to
   `frontend/public/catalog-figma/<pipeline>.json`, on approve and not on ingest

Plus: the compile verdict travels with the draft (a rename can never skip it), and a commit
whose registrations fail is refused with the failing step named.

### 1.4 The two doors — the part the plan must keep honest

- **Door 1 — f- components (ingest-owned).** Re-ingesting the **same node** re-derives the
  same tag; the commit **replaces the file in place** (`previousBytes` / `nowBytes` are
  recorded on the replacement). The registrations report "already"; the gate re-runs. This is
  the styling-update door that exists today, and the Design room's own UI already runs on it
  (its catalogue head is `<f-40001207-3559>`, its rows are `<f-40001207-3497>`).
- **Door 2 — hand-built components (the app's own pioneer elements, the composer's prompt
  column family among them).** The commit **refuses** to write them, verbatim: *"a commit may
  only write a tag of the form f-\<figma node id\>. A hand-built component is not something an
  ingest may replace."* A re-ingest of a hand-built element's node produces a NEW f- component
  **beside** it; nothing replaces the hand-built file.
- **The protection pattern that makes Door 1 safe:** a generated drawing attaches a
  **hand-written behaviour companion** from `frontend/src/components/lit/behaviour/`
  (`<tag>.behaviour.ts` — "everything about the element that is not a drawing"). The approve
  replaces the drawing; **the behaviour companions are the only part of the app an approve
  cannot overwrite** (`figma-ingest/PROMPT-NEXT-preview-fidelity.md`). This is the repository's
  own answer to "restyle without severing behaviour" — the model the composer's family is
  measured against.
- **Removals:** one component, no children; a liveness guard refuses (409 + `namedBy` +
  `nextStep`) removing a component the application's own code names; the guard strips comments
  before it looks. There is no guard on relationships and there must not be.

### 1.5 The composer (the surface the new design must appear in)

Detail lives in `composer/THE-COMPOSER-IS-A-PURE-A2UI-SURFACE.md`, begun beside this plan. The
facts this flow needs:

- The room is assembled server-side by intent (`render-composer`, `render-session:{id}`) into
  an A2UI envelope (components + data model); a malformed envelope is refused **loudly** — no
  fallback rendering, blank beats fake.
- The prompt column chain is `prompt-section-editor` → `prompt-input-section` → grip­per ·
  role-tile · Functions/Tools · status-bar-prompt-input · prompt-textarea. **These are
  hand-built today (Door 2).**
- Grace's direct manipulation — "she can add, remove, fill, edit the prompt text, change its
  type, select tools" — rides on that family's declared events and on the window-event surface
  (`set-left-column-text`, `force-set-section`, `fill-field`, `add-prompt-role`,
  `remove-prompt-role`, `a2ui:write-seat`, `insert-tool`, `merge-seat`, `move-tool`). A write
  that lands nowhere is **loud** (the chat draws it as an alert). These names are the contract;
  they may not move silently.

---

## §2 The flow, step by step — where it stands, what protects it

1. **Figma edit.** The file is the authority. Restyle means: keep the **same node** so the tag
   is preserved. A redrawn frame is a new node and therefore a new component beside the old —
   correct, but it is an addition, not an update.
2. **Ingest.** Both channels; staged preview. The preview's fidelity is the recorded open
   problem (`figma-ingest/PROMPT-NEXT-preview-fidelity.md`: the clamp question unsettled; no
   spec-by-spec proof; masters not fetched).
3. **Approve.** The §1.3 write-set. The Design room stays in place (2026-10-09 — the old page
   reload was removed at the owner's instruction) and its left list re-reads in place.
4. **The live Lit catalog.** Ask-time resolution means a changed catalogue file is live on the
   next request. A tag in no layer is an empty box with **no error** — all layers or nothing.
5. **Refresh.** A custom element is defined once per document; the page must be reloaded for
   the new bytes to draw. This is the "refresh" in the loop, and it is not a workaround.
6. **The composer draws the new design.** For Door 1, wherever the surface composes that
   component, the same tag resolves to the new drawing — bindings and manipulation unchanged.
   For Door 2, the new drawing must reach the hand-built element through the path M1 settles —
   **not** through the commit, and never by bypassing the refusal.

---

## §3 What must not move (the protection list)

The contract rules this process may never break — from the operating rules
(`AGENTS-instructions/`) and the ingest's own record:

- **Node labels and tag names are the stable anchors; properties and event payloads are the
  breakable surface — additive only.** Renaming a property or changing an event's detail shape
  breaks every consumer silently. A deleted element leaves dangling child ids that render
  NOTHING — report loud.
- **Bindings are `{ "path": "/…" }` — the object form only.** A prop whose path resolves to
  nothing renders empty and is **reported**, never a stand-in.
- **The manipulation events stay declared and consumed** — the section events
  (`section-content-input`, `section-menu-select`, `section-collapse-toggle`), the role tile's
  (`role-menu-toggle`, `role-tile-collapse-toggle`), and the window-event surface §1.5 names.
  An event nothing hears is a finding; a dead control is never excused with a comment.
- **A write that lands nowhere is loud.** Silence there is the fault class this repository
  names first.
- **The honesty gates:** `catalog:check`'s verdict is what "done" means; the fidelity gate
  (unexamined variance aborts; examined defects are reported); no suppression, no fallback
  rendering, blank beats fake.
- **Notes live in the code**, AI-to-AI, above the thing they govern. This folder keeps the
  zone's records; nothing here replaces an inline comment.

---

## §4 The work, staged (each stage verified at :5001, in the room — never standalone)

**M0 — re-verify the ground.** The design line's written records stop at 2026-10-08/09
(`figma-ingest/CHANGELOG.md`, `REPAIR-LIST-2026-10-09.md`, `PROMPT-NEXT-preview-fidelity.md`);
nothing newer is recorded. Before building: confirm at :5001 that an ingest still renders a
draft honestly for one node and that approve still writes the §1.3 set. Receipts into this
folder. *Does not touch:* the renderer, the gates, the preview seam.

**M1 — the first restyle through the loop, end to end.** The owner names the node (standing
rule: the owner names a node and where it goes). One walk-through per door:

- *Door 1 (an f- component):* restyle → re-ingest the same node → approve (file replaced in
  place) → refresh → the new design draws where the component is composed. Verify first:
  **which live surface composes that component today** (the Design room's head/rows do; the
  composer composes its prompt column by hand) and confirm the file-replacement receipt.
- *Door 2 (the prompt input family — the box in the picture):* the ingest refuses to write it
  (quoted in §1.4). The candidate path to settle **with the owner**: migrate the family to the
  built protection pattern — the drawing becomes an ingest-generated component; the events,
  bindings and behaviour move to a `lit/behaviour/` companion the ingest cannot write — so a
  Figma restyle updates the drawing and severs nothing. The alternative (re-derive the
  hand-built drawing from the new measurement by hand, under the same gates) is the fallback
  position and should be named as such if chosen.

  Receipts: node, tag, files written, gate verdict, before/after in the composer.

**M2 — the five untrue sentences (REPAIR-LIST Group A, A1–A5).** Display-only fixes on the
ingest line: the "built by the template fallback" mislabel; the dead success confirmation; the
dead failure text; the red badge on a correct render; "Compiles: yes" defaulting when no
verdict came back. These are the sentences read **while watching M1**; they must be true
before the owner watches. *Does not touch:* the pipeline.

**M3 — the fidelity proof (PROMPT-NEXT steps 1–4).** Settle the clamp question with a browser;
build the spec-by-spec table (one row per layer, one column per measured fact: drawn exactly /
not drawn + reason / not read) as a check that runs in the pipeline; fix what it shows, once
per fact, with the design's own numbers; fetch the masters. This is the piece that makes
silent loss impossible — the core protection for "see the new design" meaning anything.

**M4 — the protection agreement, written and verified.** For each element the composer draws:
which file is ingest-owned, which is hand-written, which events/bindings it carries, and what
a restyle may and may not touch (§3 as a per-element table). Verify by a re-ingest that an
overwrite severs nothing declared.

**M5 — Group B gaps and the open decisions** (B1 partial-draft silence; B2 the size-report
child drop; B3 "could not be read — no reason recorded"; B4 the dev workspace's React
hydration error) — after the walk-through, or interleaved on the owner's word.

---

## §5 Decisions the owner has not ruled on

1. **The channel rule** (REPAIR-LIST C1). The record: *"We have to use both."* Today a
   missing desktop channel continues with REST and the answer reports `mcp: "unavailable"` —
   honest, but not "both". **Default proposed:** keep continuing (a closed Figma desktop must
   not block the room), and surface the missing channel where the designer reads the draft.
   The alternative is a strict refusal.
2. **The preview seam** (REPAIR-LIST C2). A 2026-10-09 audit records the preview's seam
   changed to inert no-ops (the real binding loader needs Vite; the production server cannot
   serve `import.meta.glob`); the committed file is unchanged either way. **Default proposed:**
   keep the preview drawing the measured design as-is; do not reverse until a
   production-servable loader exists.
3. **M1's target node(s)** — the owner names them.

---

## §6 What this plan does not touch

- The renderer's bytes for a given design must stay byte-identical; a fix that changes one
  byte of a generated component is a regression (verify by regeneration — the replay used on
  2026-10-08).
- Nothing on the box; nothing deployed; :5001 only.
- No fallbacks, no suppression, no invented machinery, no new note collections beyond the
  folders named here.

---

## §7 Records

- This plan: `design/DESIGN-UPDATE-FLOW-PLAN-2026-10-15.md`.
- The composer's first map: `composer/THE-COMPOSER-IS-A-PURE-A2UI-SURFACE.md`.
- The operative repair lists, unchanged and still standing until the owner re-orders them:
  `REPAIR-LIST-2026-10-09.md`, `figma-ingest/PROMPT-NEXT-preview-fidelity.md`,
  `INGEST-REFUSAL-ANALYSIS-2026-10-07.md`.
- Housekeeping noted, not done: several documents still point at `START-HERE.md`, which no
  longer exists — repoint on touch. The Composer zone's log entries stop at 2026-10-05; later
  composer work is not yet logged there (catch up on the owner's word).
