# Figma → Lit Translation Pipeline

> **Scope:** the end-to-end handoff — walking a Figma design via MCP, extracting
> behavioral annotations, resolving nodes to the component allowlist, and producing
> Lit web components. This is the single canonical contract; there is no second copy.
>
> **Value handling** (verbatim numbers, `UNSPECIFIED`, break-loud,
> `// TODO(behavior)` stubs) lives in
> [`.continue/rules/design-system.md`](../.continue/rules/design-system.md).
> This file references it; it does not restate it.
>
> **Component allowlist** lives in:
> - [`frontend/src/components/registry.json`](../frontend/src/components/registry.json) — Figma `data-name` → Lit custom element → source file
> - [`frontend/src/components/A2UI/component-catalog.json`](../frontend/src/components/A2UI/component-catalog.json) — the A2UI v0.9.1 catalog allowlist

## 1 · MCP endpoints

| Scope | Endpoint |
| --- | --- |
| Continue | `http://127.0.0.1:3845/mcp` (streamable-http) |
| VS Code | `https://mcp.figma.com/mcp` |

Primary tool: **`get_design_context`** (accepts a file key + node ID).

## 2 · The annotation channel — behavioral spec, no Code Connect

Behavioral specs (data bindings, event dispatch, tracking, A2UI envelope fields)
live in Figma Dev Mode **annotations**. The Figma MCP is the only bridge.

### The attribute name is untrusted
- Do **not** hardcode any attribute name. The annotation attribute has varied
  across MCP versions and must be treated as **untrusted input**.
- Match any attribute with the regex **`/^data-.*annotation/i`**.
- **Record the exact attribute name you found** alongside the value, so a later
  pass can reconcile which name this file actually emitted.

### Annotations are a first-class required channel
- Every node is probed for annotations. An instance with no annotation anywhere in
  its chain is a **reportable gap**, not a silent pass (see §5).

### Variant semantics — annotate each variant, not the set
- Annotate the **variant** — one annotation per variant. Open and closed have
  genuinely different behavior, so each gets its own note. The component **set**
  can hold only one note, so annotating the set loses the variant distinction.
- Non-propagation is a fact of Figma, not a bug: an annotation on a variant does
  **not** copy to instances. The agent must resolve instance → variant and read
  the variant's annotation (see §4). The designer never touches instances.

### Design-side rule — annotate the variant, never touch instances
The designer annotates the **variant** (one annotation per variant). That variant's
contract applies everywhere it is ever placed. Instances are annotated **only** for
genuinely frame-specific overrides (rare) — never as the primary behavior spec.

### Nesting limitation — annotations do not bubble up
- Annotations on a component instance **nested inside another component** are
  **invisible** unless `get_design_context` is called on that **specific child
  node ID**.
- Annotations do **not** bubble up to the parent frame.
- This is why the recursive rule in §3 is mandatory, not optional.

## 3 · Node walk — recursive, do not stop at the top frame

1. Call `get_design_context` on the top-level frame.
2. Read the response for `data-node-id` attributes.
3. For **every** child `data-node-id` found, recursively call `get_design_context`
   on that node.
4. Annotations on nested component instances are only visible when you query that
   specific node — the top-level pull does not surface them.
5. At each node, extract:
   - `data-node-id` / `data-name` — tree mapping
   - any `data-*-annotation*` attribute (regex `/^data-.*annotation/i`) — the
     behavioral spec; record the exact attribute name found

### Annotation priority (highest first)

1. Annotation attributes (regex `/^data-.*annotation/i`)
2. Component name → allowlist mapping
3. Inferred from visual structure

## 4 · REST pre-pass — one call, join locally

Preferred over per-node MCP probing: one REST call for the whole file, then join
locally.

```
GET https://api.figma.com/v1/files/{file_key}
Header: X-Figma-Token: {token}     # scope: file_content:read
```

Build one map:

```
annotationMap: Map<nodeId, Annotation[]>     // annotations per node (instance, variant, component, set)
```

Annotation shape (Plugin API `Annotation`):

```
{ label?, labelMarkdown?, properties?, categoryId? }
```

Prefer `labelMarkdown`. A node may carry multiple annotations.

**Resolve the variant (the whole mechanism).**

An instance's `componentId` **is** the specific variant it instantiates (for
components inside a set) or the component itself (standalone). Record
`instance.componentProperties` too — that is the "which variant" evidence
(e.g. `state: open`). Read **that variant's** annotation, never the set's: the set
can hold only one note, so it cannot carry per-variant behavior.

**Join order when reading an instance** (concatenate, label each source, do **not**
dedupe silently):

```
instance → which variant is it? → read that variant's annotation
         → (optional) instance-level annotation for frame-specific overrides
         → concatenate, labeled, into the assembly instructions
```

1. `annotationMap[instance.componentId]`   — the variant's contract (primary)
2. `annotationMap[instance.id]`            — instance-level override (optional, rare)

If `componentId` is not exposed, resolve via `componentProperties` → `componentSets`
→ the matching variant. If the instance still cannot be resolved to a variant, that
is a **gap** (see §5) — never silently assume "no spec."

## 5 · Resolve components — import, don't regenerate

- Look up the Figma `data-name` in `frontend/src/components/registry.json`.
- **Present** → import the mapped Lit element. Do **not** regenerate it.
- **Absent** → flag `⚠️ Unmapped component: [name]. Needs registry entry.` and ask
  before building.

The agent is a **composer**, not a builder.

### Gap reporting — silent-failure guard
The chain has a silent break point: if the agent cannot resolve instance → variant,
it does not error — it finds nothing and assembles a clean component with **no
behavior**. The gap report forces that failure to be spoken aloud.

List explicitly, by node ID:
- any instance whose **variant cannot be resolved** → `⚠️ Could not resolve {nodeId} → variant.`
- any instance whose **resolved variant has no annotation** → `⚠️ Missing spec: {nodeId} → variant {variantId} has no annotation.`

Do not silently pass either case.

## 6 · Convert to Lit

- The MCP returns **React + Tailwind + `data-node-id`**. Convert it — do not keep it.
- Output Lit web components: `customElements.define`, `lit-html`, Shadow DOM.
- Never emit JSX, never emit Tailwind, never install Tailwind.
- Preserve the tree mapping: Figma node → Lit element, node for node (`data-node-id`
  carried on each mapped element).
- Import components from `@/components/lit/...`.

## 7 · Backend cache flow

`backend/figma_service.py` is the single entry point for node specs at render time:

1. `get_cached_spec(file_key, node_id)` — **cache-first** (PostgreSQL `figma_specs`).
2. Live pull via `get_node` + `extract_node_spec` (verbatim, lossless — no rounding).
3. Stale-cache fallback on transient Figma failure.
4. Miss.

Figma is the source of truth at **authoring** time; the cache is consumed at
**render** time.

## 8 · Authoring convention (where specs get written)

Annotate the **variant** — one annotation per variant. That variant's contract
applies everywhere it is ever placed. Never annotate instances except for genuinely
frame-specific overrides; never annotate the component **set** (it holds one note
and loses the variant distinction).

Template — one annotation per variant, markdown:

```
Data:      <what it binds to, e.g. workspace.activeItem>
Source:    <agent_rpc call / envelope field>
On click:  <dispatch + payload shape>
Track:     <track_event name + props>
State:     <this variant's state, e.g. open>
Disabled:  <condition>
A11y:      <role / label source>
```

Pin the actual Figma variable/component into the annotation instead of typing its
name — pinned references stay in sync, typed text rots.

## 9 · Figma Fetch Protocol (Permanent)

### Trigger
Any of the following user commands activates this protocol:
- "fetch <figma-url>"
- "update <component-name> from figma"
- "sync <figma-url>"
- A bare Figma link pasted into the conversation

### Procedure (execute in order, no confirmation needed)

1. **Parse the URL.** Extract `fileKey` and `nodeId` from the Figma URL.
   Format: `figma.com/design/<fileKey>/<fileName>?node-id=<nodeId>`

2. **Pull the node.** Call `get_design_context(fileKey, nodeId)`. Walk children
   recursively per §3 — nested-instance annotations do not bubble up.

3. **Extract all properties from the response.** For every node in the
   returned tree, capture:
   - Layout: width, height, padding, gap, border-radius, alignment
   - Visual: fills, borders, shadows, opacity
   - Typography: font-family, font-size, font-weight, line-height, color
   - Annotation: any attribute matching `/^data-.*annotation/i` (observed name:
     `data-development-annotations`) — this is the behavioral spec, see §2

4. **Write to the LIT catalogue.** For each component/variant found:
   - Already mapped in `registry.json` → merge (overwrite properties, append or
     update annotations)
   - Not mapped → flag `⚠️ Unmapped component` (§5), then create the entry
   - Catalogue locations (there is no `catalog/` directory):
     - `frontend/src/components/registry.json` — Figma `data-name` → Lit element
     - `frontend/src/components/A2UI/component-catalog.json` — A2UI allowlist
     - `frontend/src/components/lit/*.ts` — the Lit component source
   - Record **provenance**: in the registry entry's `provenance` object, mark each
     field `verbatim` (from the annotation) or `inferred` (agent-invented). An
     `inferred` field is the agent's invention — never let it masquerade as the
     designer's text. The import report (`frontend/scripts/import-report.mjs`)
     surfaces this so a component can be audited for provenance drift.

5. **Report.** One line per component:
   `✓ <component-name> — <n> properties, <n> annotations`

   Do NOT narrate individual property values. Do NOT ask for confirmation.

### Annotation Format (what to expect in the behavioral spec)

Annotations follow this structure (all fields optional, any subset may appear):

    Data:      <binding path>
    Source:    <where data comes from>
    On click:  <event + payload>
    Track:     <event name + props>
    State:     <state machine or condition>
    Disabled:  <condition>
    A11y:      <role / label source>
    Builder:   <instruction to the code generator>
    AI:        <instruction to the runtime model>

If an annotation does not follow this structure, treat the full text as a
free-form instruction and apply it to the `Builder` field.

- **Structured format is mandatory to avoid inference.** If an annotation has
  no `On click:` field, the agent must invent the event names — mark those
  `inferred` in the registry `provenance` object (never `verbatim`) and flag
  the component for re-annotation. The designer writing `On click:` is what
  makes behavior `verbatim`.

### Endpoint

Preferred: `https://mcp.figma.com/mcp` — remote, live, never needs re-sync.
Auth is **OAuth 2.0 with scope `mcp:connect`**. A Personal Access Token
(`figd_*`) is **rejected** (401) — do not send it. OAuth is already done by
VS Code's Figma MCP; wire Cline's Figma MCP to that same server so
`get_design_context` is available as a live tool.

Fallback: `http://127.0.0.1:3845/mcp` — the Figma Desktop app's local MCP.
Requires no auth and reads `get_design_context`, but serves a **stale
snapshot** until the file is re-opened in the desktop app. After a re-sync it
returns fresh annotations (verified 2026-09-10). Use it when the OAuth
endpoint is unreachable — then re-sync before each pull.

### Failure Handling

- 401 / auth error → report: "Figma MCP auth expired. Re-run OAuth in VS Code."
- 0 annotations on the requested node → report: "No annotations on <nodeId>. Did
  you add them in Dev Mode?"
- Node not found → report the nodeId and ask for the correct link.
- Suspected stale pull (desktop endpoint) → re-sync the file in Figma Desktop,
  then re-pull.

### What this protocol does NOT do
- Does not generate code. It only populates the LIT catalogue.
- Does not modify the Figma file.
- Does not require the user to explain design decisions. The annotations ARE the
  explanation.

## 10 · Known gotchas

- The annotation attribute name is untrusted (see §2); match by regex and record
  what you found.
- Nested-component instances have a history of annotations not surfacing. If a
  nested node returns nothing, verify via REST (§4) before concluding "none."
- Reports exist of annotations bleeding from non-default variants into instances —
  inconsistent, possibly a bug. Never rely on it; the contract is non-propagation.
- Top-level canvas nodes are always returned by REST `ids=` even when not requested
  (documented API quirk).

## 11 · Definition of done for an extraction pass

- [ ] Every node ID in scope was queried individually
- [ ] Every annotation found is attributed to its node ID + attribute name
- [ ] Every component instance resolved instance → variant (the specific variant it uses)
- [ ] Components with zero annotations anywhere in the chain are listed explicitly
      as gaps for the designer to fill in

## 12 · Sources of truth (reference — do not duplicate)

- `.continue/rules/design-system.md` — value-handling rules
- `frontend/src/components/registry.json` — Figma name → Lit element map
- `frontend/src/components/A2UI/component-catalog.json` — A2UI allowlist
- `frontend/scripts/design-extract.mjs` — annotation extractor (uses the §2 regex,
  records the attribute name per node, and hard-fails on zero annotations)
