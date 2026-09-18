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

7. **Update the counts** — README and `READ-ME/IMPLEMENTATION_CONFORMANCE.md` state
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
