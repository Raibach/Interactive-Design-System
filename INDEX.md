# INDEX — what everything is

If you are an AI session: read this before you touch anything. Three files here are called some version of "registry" and they are not the same thing.

---

## The three that all sound like "registry"

| File | It is | Read by |
|---|---|---|
| `frontend/src/shared/tag-registry.ts` | **THE ALLOWLIST** — what may be rendered | The app (validation), `generate-manifest.mjs`, the backend's AI prompt |
| `frontend/src/components/registry.json` | **THE FIGMA MAP** — which Figma node each component came from | `catalog-check.mjs`, the Figma import tooling |
| `frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json` | **THE SCHEMA** — what the server validates a payload against (503 on unknown). One per pipeline: `prompt-composer`, `ecommerce` | `backend/deps.py`, at startup (exits 1 if it fails to load) |

## The components

| Path | It is |
|---|---|
| `frontend/src/components/lit/` | The Lit components — flat, one folder |
| `frontend/src/components/A2UISurfaceContainer.tsx` | Renders components the AI emits |
| `frontend/src/components/InteractiveChatInterface.tsx` | The chat / command centre on the right |

## The catalog pipeline

| File | It is | Feeds |
|---|---|---|
| `frontend/scripts/generate-manifest.mjs` | Builds the AI manifest | `frontend/dist/manifest.json` → the backend's system prompt |
| `frontend/scripts/catalog-check.mjs` | **The catalog health check** — the condition of the catalog | `frontend/dist/catalog-audit.json` → `GET /api/catalog/audit` → the console chat |
| `frontend/scripts/import-report.mjs` | Figma import report | stdout |
| `frontend/scripts/import-audit.mjs` | Figma import governance audit | `frontend/.figma-cache/import-audit/` |
| `frontend/scripts/design-extract.mjs` | Turns cached Figma pulls into a value table | `frontend/src/design/VALUES.json` |
| `frontend/src/design/*.json` | Cached Figma pulls (authoring-time only) | The Lit components' provenance comments |

## The server

| File | It is |
|---|---|
| `backend/deps.py` | Loads the schema at startup; validates every AI payload against it |
| `backend/role_caps.py` + `frontend/src/shared/role-caps.ts` | Role → what you see (tabs, components, tables). The two must agree |
| `backend/routes/*.py` | The endpoints |

## Running it

| File | It is |
|---|---|
| `RESTART-LOCAL.sh` | The launcher. **Site on 5001, served LIVE from source — never a build.** API on 8000, proxied under `/api`. If 5001 is taken the site fails loudly rather than moving to another port |

## The rules

| File | It is |
|---|---|
| `.clinerules/figma-to-lit.md` | The Figma → Lit contract |
| `.continue/rules/design-system.md` | Value-handling rules (never invent a value; break loud) |
| `FIGMA/ANNOTATION_FIGMA_GUIDE.md` | The designer's guide to writing annotations |

## The plan

| File | It is |
|---|---|
| `Lit-to-figma-trace-plan` | Where this is going: the catalog shape, then the monitoring |

## The register

| File | It is |
|---|---|
| `OPEN-ITEMS.md` | Every open discrepancy, with the number to quote it by. Two ID spaces: the **checker** owns `check:component` (regenerate with `cd frontend && npm run catalog:check`); **`#NNN`** covers what no checker can see. An item closes only when the thing that derived it stops deriving it |

---

*Keep this current. If a file here is renamed or removed, fix this page in the same change — a stale index is worse than none.*
