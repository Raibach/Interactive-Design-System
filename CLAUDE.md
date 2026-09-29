You are an A2UI protocol generator.

## Input
You receive a Figma REST API JSON response. The components, variants,
and properties in that JSON define your available element set.

## Task
Given the Figma JSON and the existing registry below, generate ONLY
the components that are not yet in the registry. For components that
already exist, output a reference line:

  "Card" → already in registry (skip)

For new components, output the full Lit implementation.

## Mapping
Derive the registry key from the Figma component name using
kebab-case. If a component name matches an existing registry key,
it is a reference (skip). If it does not match, it is new.

## Existing Registry
{{REGISTRY_KEYS}}

## Output Format
- One line per component: `"Name" → new` or `"Name" → already in registry (skip)`
- For new components: the full Lit TypeScript file (class, styles, template)

## Example
Input (Figma node):
  { "name": "Header", "type": "FRAME", "layoutMode": "HORIZONTAL", ... }

Output:
  "Header" → new
  // header.ts
  export class Header extends LitElement { ... }

## Architecture

This system has two layers:

**React Shell** (do not modify)
- Owns: routing, layout, auth, theme, navigation, error boundaries
- Entry: App.tsx → Shell → <Surface />
- The shell is stable.

**A2 UI Surface** (the working area)
- Mounted at: <A2ui surface />
- Owns: all content rendering, component composition, data display

## Rules
- Never import from shell internals (use the surface API)
- If a change requires shell modification, stop and flag it
- The shell remounts the surface on route change — don't rely on
  surface-level state persistence

---

## Figma Spec Extraction — Dual-Channel Protocol (Verified 2026-09-27)

**PROBLEM:** No single Figma API gives you everything. The platform gates library vectors, descriptions, and generated code behind file boundaries and Enterprise tiers.

**SOLUTION:** Use **both channels** and merge.

---

### Channel 1: Figma MCP (Desktop) — `get_design_context`
**Endpoint:** `http://127.0.0.1:3845/mcp` (requires Figma Desktop open with file loaded)

**Returns:**
- Generated React+Tailwind code (with `data-node-id` attributes)
- Base64 PNG/SVG assets (inline, no separate downloads)
- Component descriptions — **including library components** from other files
- Style summary (text, not structured)
- Annotations (if present on nodes)

**Limitations:**
- No structured design tokens (colors, spacing, typography as parseable JSON)
- Only works locally (Desktop MCP)
- No vector networks for library components

---

### Channel 2: Figma REST API — `/nodes` + `extract_node_spec()`
**Endpoint:** `https://api.figma.com/v1/files/{key}/nodes?ids={node}&geometry=paths`
**Auth:** Personal Access Token (`FIGMA_TOKEN` in `.env`)

**Returns (via `backend/figma_service.py::extract_node_spec`):**
- **Full structured design tokens** per node: fills, strokes, effects, layout, text, bounds
- Complete recursive node tree with absolute positions
- Precise values: `drop-shadow: offset(4,4) radius:10 rgba(0,0,0,0.15)`
- Typography: `fontFamily`, `fontPostScriptName`, `fontWeight`, `fontSize`, `lineHeightPx`, `letterSpacing`
- Auto-layout: `layoutMode`, `itemSpacing`, `padding*`, `align*`, `layoutGrow`
- Annotations (Dev Mode) — **only for nodes in this file**
- Component descriptions — **only for components defined in this file** (`/components` endpoint)

**Limitations:**
- Library components (from other files): only refs (`componentId`), no vectors, no descriptions
- No generated code
- No base64 images (refs only — separate download needed)
- Requires valid token (expires)

---

### Merge Strategy (What We Did for `40001177:2597`)

| Need | Source | How |
|------|--------|-----|
| Exact colors, shadows, spacing, type, layout | REST + extractor | `get_cached_spec(file_key, node_id, refresh=True)` |
| Library component vectors (chevron) | MCP | Base64 images in `content[5], content[6]` |
| Library component descriptions | MCP | `content[4]` text block |
| Generated reference code | MCP | `content[0]` (for human reference only) |
| Annotations (designer intent) | REST | `spec.annotations` array per node |
| This-file component descriptions | REST | `get_component_descriptions(file_key)` |

---

### Production Code Path (Already Implemented)

`backend/figma_mcp.py::run_tool_calls()` → tries MCP first, falls back to `_rest_design_block()` → calls `figma_service.get_cached_spec()` → extracts + caches in Postgres `figma_specs` table.

**The cache IS the production path.** Live REST calls only on cache miss or `refresh=true`.

---

### Workaround for Library Vectors (When MCP Unavailable)

If you need a library component's vectors without MCP:

1. Identify the library file key (from `componentId` prefix or team knowledge)
2. Call `/nodes` on **that file** with the master component ID
3. Extract `vectorNetwork` from the master component definition
4. Or use `/components` on library file for metadata

**This requires access to the library file** — the moat Figma built.

---

### Quick Commands

```bash
# REST: Get full structured spec (requires valid FIGMA_TOKEN)
curl "https://api.figma.com/v1/files/20UPR2KQMsbAxlo5NJb1se/nodes?ids=40001177:2597&geometry=paths" \
  -H "X-FIGMA-TOKEN: $FIGMA_TOKEN"

# Python: Normalized spec via extractor
cd /Users/raibach/Documents/Raibach_IDS
# THE TOKEN IS READ, NEVER WRITTEN. It belongs in backend/.env, which is gitignored, and
# a token inlined here is a token in the repository the moment this file is committed —
# GitHub's secret scanning refuses the push for exactly that reason. Read it from the file:
FIGMA_TOKEN="$(grep '^FIGMA_TOKEN=' backend/.env | cut -d= -f2-)" python3 -c "
from backend.figma_service import get_node, extract_node_spec
import json
raw = get_node('20UPR2KQMsbAxlo5NJb1se', '40001177:2597')
spec = extract_node_spec(raw['document'])
print(json.dumps(spec, indent=2))
"

# MCP: Get design context (requires Figma Desktop open)
# Use backend/figma_mcp.py::call_design_context(node_id, file_key)
```