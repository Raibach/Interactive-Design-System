# Adding an element to the Lit catalog

Everything that must be true before a new component can appear in a surface. Written
after building `<trace-feed>`, where most of these steps were missed on the first
pass — the component existed, the server refused the surface, and the screen stayed
blank. Each step below is here because skipping it produced a specific failure.

## The three layers, and where a new element has to appear in each

| layer | file | what it decides | what breaks if it is skipped |
|---|---|---|---|
| CATALOG | `frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json` | what the SERVER will accept | 503 `CATALOG-REJECT` — the whole surface is refused, not just the component |
| REGISTRY | `frontend/src/shared/tag-registry.ts` | name → tag, surface, column, events | the name is not in the allowlist; the catalog audit reports it |
| RUNTIME | `frontend/src/components/lit/<element>.ts` | what actually draws | the renderer reports "resolved to `<tag>`, which no element defines" and draws nothing |

A component has to be put in **all three**. The gate is the catalog, and it is
deliberately strict: a component the model names that the catalog does not define is
rejected before it reaches the screen. That gate is correct — do not relax it to make
a surface pass.

## The requirement that comes before all of them: the layer's NAME

**Every layer carried into the catalog states its Figma layer name, beside its node id.**
This is not optional and it is not cosmetic. It is the requirement whose absence produced
eleven hours of edits to `output-header-area.ts` while `chat-panel.ts` drew that same block
from `chat-header` — the designer could not see the node ids, the agent read past the layer
names, and nothing in between could tell either of them which file was on screen.

| where | what it carries | who reads it |
|---|---|---|
| the Lit element | `data-node-id="40001127:2062" data-layer-name="textarea"` | the value check, the designer's eye |
| the registry `layers` array | `{ nodeId, name, type, size }` | the allowlist, the audit |
| the catalog `x-layers` | the same array | the schema, and any reader of the catalog |

**The designer reads names. The agent reads ids. The catalog must carry BOTH**, because a
discrepancy is only visible when the two meet: if the name in the catalog is not the name in
the drawing, that is a finding, and it is arithmetic.

**The id is the identity; the name is the label.** An id never changes. It is either present
or deleted — so:

- an id in the catalog and not in the drawing → the layer was **deleted**; the marker is a
  dangling reference that renders nothing
- an id in the drawing and not in the catalog → a **new layer** nothing covers yet
- an id in both, and the names differ → the **name moved** on a layer that still exists, and
  the code must follow it

A new id in an old layer's place is a **new component**, whatever you called it. It is not the
old one relocated.

**And it is checked on every run** — `layer-name-drift` in `catalog-check.mjs`, blocking. A
layer whose name disagrees with the drawing fails the build rather than waiting for someone to
notice. Check it by hand any time with:

```bash
cd frontend && node scripts/design-layer-names.mjs --capture <scope>
```

## The steps

1. **Write the element** — `frontend/src/components/lit/<element>.ts`, `LitElement`,
   and end the file with `customElements.define(...)` guarded by
   `if (!customElements.get(...))`.

2. **Register it at startup** — add the import to `frontend/src/main.tsx`. An element
   that is never imported is never defined, and an undefined tag draws an empty box
   with no error.

3. **Teach the renderer the name** — `COMPOSITE_MAP` in
   `frontend/src/components/lit/a2ui-renderer.ts`, e.g. `TraceFeed: 'trace-feed'`.
   The renderer resolves names in this order: `COMPOSITE_MAP` → A2UI primitives →
   structural composites → the allowlist (`pascalToKebab`). An explicit entry is
   needed when the component's catalog name is not the kebab of its tag.

4. **Claim it in the REGISTRY** — add an entry to `frontend/src/shared/tag-registry.ts`
   (`tag`, `surface`, `column`, `description`, `props`, `events`, `constraints`).
   This is the allowlist and it carries the metadata the tier derivation reads.
   *(For `trace-feed` this step is still outstanding.)*

5. **Claim it in the CATALOG** — in `catalogs/<pipeline>/catalog.json`, **two** places:
   - add the entry under `components`
   - add its `$ref` to `$defs.anyComponent.oneOf` — point it at
     `#/components/<Name>`, **not** `#/$defs/<Name>`

   Miss the second and the checker reports `schema-unreachable`: the server accepts it
   while any client validating against `anyComponent` would reject it.

6. **Emit it from the surface** — the component only appears if the assembly puts it
   in the tree. For a container with named slots, `children` is keyed by slot name:
   `"children": {"view-trace": "trace-view"}`.

   **AND CHECK THAT THE FILE YOU WROTE IS THE FILE THAT RENDERS.** This is the step whose
   absence cost eleven hours on 2026-09-20: `output-header-area.ts` was written, registered,
   imported and audited green — while `chat-panel.ts` still drew that block from
   `chat-header`, so the screen never changed and every check agreed with every other check.
   After emitting, put the drawing's node id in the live DOM and confirm the element you
   wrote is the one carrying it. `grep` for the tag in `chat-panel.ts` first; if the block is
   drawn by a different element, the element you wrote is dead code.

7. **Carry every layer's NAME beside its node id** — in the Lit element
   (`data-node-id="…" data-layer-name="…"` on every layer), in the registry's `layers`
   array, and in the catalog's `x-layers`. **The name is what makes it possible to tell
   which file you are editing**; an id alone is an address with nothing to read. Check it
   with `node scripts/design-layer-names.mjs --capture <scope>`.

   **One name means one component with the same parameters, drawn by one file.** If two
   layers share a name and not a size, that is a naming mistake in the drawing — the screen
   will show it, and the fix is to rename in Figma.

8. **Update the counts** — README and `READ-ME/IMPLEMENTATION_CONFORMANCE.md` state
   the catalog size ("N trusted components", "X + Y primitives") and README carries
   the name list. `doc-claim-drift` is **blocking**, so a stale number fails the
   build. The checker prints the correct numbers; copy them from it.

## Verify, in this order

```bash
# 1. does it COMPILE? — tsc is NOT enough, see the trap below
cd frontend && npx esbuild src/components/lit/<element>.ts --outfile=/tmp/o.js --log-level=error

# 2. types
npx tsc --noEmit

# 3. the catalog gate — read the VERDICT line, not the exit code alone
npm run catalog:check

# 4. the server accepts the surface (watch for 503 / VALIDATION_FAILED)
curl -s -X POST http://localhost:8000/api/ai/assemble-surface \
  -H 'Content-Type: application/json' \
  -H 'X-User-ID: 00000000-0000-0000-0000-000000000001' \
  -d '{"intent":"render-console"}'

# 5. it is actually DEFINED in the browser (a missing define is silent)
#    customElements.get('<tag>')  -> must be truthy
```

Restart the backend after changing anything it reads (catalogs, prompts) — it runs
without `--reload`. The frontend does not need a restart for a new element, but a
page that was already open will not have imported it; load a fresh page.

## Traps that cost real time here

- **A backtick inside a Lit `css`/`html` template literal ends the literal.** This
  happened three times in one session, always in a comment. `tsc` does **not** catch
  it — the result is still valid TypeScript — while esbuild fails and Vite shows a
  build overlay instead of the app. Compile the file (step 1 above) and keep
  backticks out of those comments.
- **`isThirdOpen: false` collapses a pane to ZERO width**, taking any rail inside it
  off screen with it. "Closed" is the pane's collapsed FLOOR, not zero.
- **A prop the payload stops sending stays set** on the element it was last assigned
  to. The renderer now releases props it previously assigned and the payload has
  dropped, so a component is a function of the current tree and not the history of
  trees.
- **A payload flag the component also toggles fights the operator.** If a person can
  change it (open/closed), the payload must not re-assert it on every assembly.
