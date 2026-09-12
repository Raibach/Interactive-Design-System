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
| `frontend/scripts/catalog-check.mjs` | **The catalog health check** — the condition of the catalog | `frontend/catalog-audit/<pipeline>.json` → `GET /api/catalog/audit` → the console chat. **Not under `dist/`** — `vite build` empties `dist/`, which deleted the report and turned every production build into a 503 |
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
| `RESTART-LOCAL.sh` | The launcher. **Site on 5001, served LIVE from source — never a build.** API on 8000, proxied under `/api`. If 5001 is taken the site fails loudly rather than moving to another port. **Gitignored (`.gitignore:40`): a fix to this file never enters the repository's history — it exists on this machine and nowhere else** |

## The rules

| File | It is |
|---|---|
| `.clinerules/figma-to-lit.md` | The Figma → Lit contract. **Not in the tree** — `.clinerules/` is gitignored (`.gitignore:37`) and `bb157be` deleted the file. Last tracked copy: `git show f27b4a4:.clinerules/figma-to-lit.md` (312 lines) |
| `.continue/rules/design-system.md` | Value-handling rules (never invent a value; break loud). **Not in the tree** — `.continue/` is gitignored (`.gitignore:35`); `d03c7b6` ("Delete .continue directory") removed it. Last tracked copy: `git show d03c7b6^:.continue/rules/design-system.md` |
| `FIGMA/ANNOTATION_FIGMA_GUIDE.md` | The designer's guide to writing annotations |

## The plan

| File | It is |
|---|---|
| `Lit-to-figma-trace-plan` | Where this is going: the catalog shape, then the monitoring |

## The register

| File | It is |
|---|---|
| `ignore-this-work-catalog-audit/OPEN-ITEMS.md` | Every open discrepancy, with the number to quote it by. Two ID spaces: the **checker** owns `check:component` (regenerate with `cd frontend && npm run catalog:check`); **`#NNN`** covers what no checker can see. An item closes only when the thing that derived it stops deriving it |

## The notes — where a session with no memory re-orients

Written for an AI reader, not for the repository — so most of them are ignored on
purpose. Read them in this order.

| File | It is | Git sees it |
|---|---|---|
| `catalog-audit/AI-notes.md` | The working journal: what was broken, what was verified live, what is explicitly *not* claimed, and — at the end — the reporting register: the session's own wrong numbers, each re-run and corrected, plus the classes that are not numbers (§8: a fix marked "applied" whose only evidence is that it compiles, in a repo with no Python tests; §9: process shortcuts) and the open questions, three of five since closed. Converted from `AI-SLOOP.pages` (401431 B, 2026-09-11), which has since left the tree and was **never committed** — this file is now the only surviving copy; the decode method and the body md5 are in its header comment | untracked until 2026-09-12 (then committed — it was the only copy, so it was the last thing to be saved) |
| `FIGMA/AGENT_BRIEF.md` | Figma in this repository: the two channels, both endpoints, the write-side rules, and the gotchas each earned by a wrong conclusion | ignored (`.gitignore:52`) |
| `FIGMA/AGENT_NODE_MAP.md` | Figma node ↔ Lit element, containers, the two id sets, the dead ids | ignored (`.gitignore:53`) |
| `FIGMA/AGENT_OPEN_GAPS.md` | What is unresolved right now, by owner, with node ids | ignored (`.gitignore:54`) |

**Their one shared rule, learned expensively:** state the scope, or the result is not a
result. A search reporting "no results" over a subset is not absence; `| head` makes a
search finite; and `grep` finds text where only a parser counts constructs. The list
of times that rule was broken — with re-runs — is at the end of `AI-notes.md`.

---

*Keep this current. If a file here is renamed or removed, fix this page in the same change — a stale index is worse than none.*
