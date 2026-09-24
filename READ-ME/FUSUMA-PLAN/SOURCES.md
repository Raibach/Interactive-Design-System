# SOURCES — open source worth reading, tied to named problems

Researched 2026-09-23 in answer to the owner's question: *"can we find a GitHub open source
that can give you any deeper level of work insight to this canvas."* Each entry says **what
it gives you here**, not just what it is. Star counts are from `gh` on that date.

## Provenance

**[read]** — I opened this today (the spec, the type definitions, or the repo's own code) and
the quoted text is from the source. **[pointer]** — I know it is the right place to look but
did not read it this session. Do not treat a pointer as a finding.

---

## The one that changes the architecture — A2UI's dynamic children [read]

**[a2ui-project/a2ui](https://github.com/a2ui-project/a2ui)** — 16,489★, Apache 2.0, a2ui.org.
The spec is at **v0.9.1 stable with a v1.0 release candidate**.

**This repo claims conformance to it.** `READ-ME/IMPLEMENTATION_CONFORMANCE.md` cites
*"A2UI v0.9.1 (Agent-to-User Interface)"* with the catalog `$id`
`https://raibach.net/a2ui/catalogs/prompt-composer/v0_9_1/catalog.json`, and 51 trusted
components — **including `AgentFlow` and `AgentCanvas`**. `READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md`
records that a previous session drifted from the protocol while the docs kept claiming it.

**The finding.** The spec's `ChildList` has **two** forms. The array form is *"a static array
of `ComponentId` component references."* The object form is:

> **"A template for generating children from a data binding list (requires a `template`
> componentId and a data binding path)."**

and inside those instances paths become relative — a path `firstName` under `/users`
*"resolves to /users/0/firstName for the first item."* There is also a `List` component.
Bindings are JSON Pointers, e.g. `{"value": {"path": "/contact/firstName"}}`, and
`formatString` interpolates with `${/user/firstName}`.

**This repo's `childRefs` implements the array form and the named-slot object form, and
nothing else** — nothing in `frontend/src/components/lit/a2ui-renderer.ts` mentions a
template. `agent-flow.ts`'s header states the consequence and treats it as a protocol limit:

> *"there is no dynamic template form (a2ui-renderer.ts, childRefs), so a surface cannot say
> 'draw one node per item of /flow/nodes'. The canvas therefore draws from the bound array."*

So the canvas owning its children is **not** a protocol limitation — it is an unimplemented
half of the protocol. And that is the architectural root of the canvas's open items: because
the nodes are not components in the envelope, their facts have nowhere to live in the data
model, which is why position sits in the element's `_pos` map, drafts sit in `_draftNodes`,
and the graph is rebuilt from the rows rather than read from the model. **Position is the one
fact `CANVAS-AND-PROMPT.md` §2 carves out as "the drawing's" precisely because there is no
field for it.** Same pattern, same cause, in `<trace-feed>`.

A template would give `/flow/nodes/*` an `x` and a `y`, and the exception would stop being an
exception. Worth a conformance pass either way — the target version is moving.

Related, not read: [CopilotKit/generative-ui](https://github.com/CopilotKit/generative-ui)
(840★), [AGenUI/AGenUI](https://github.com/AGenUI/AGenUI) (1,168★) — other renderers, useful
for seeing how a second implementation handles `ChildList`.

---

## The deferred edge decision already has a precedent [read]

The owner's decision (`CANVAS-AND-PROMPT.md` §4.4): a hand-drawn connection either becomes
something the prompt can express, or it is data in the graph. **Both of these say: structured
data stored beside position.** Neither says: rewrite the prompt.

**[obsidianmd/jsoncanvas](https://github.com/obsidianmd/jsoncanvas)** — 3,700★. An open file
format for infinite canvas data (version 1.0, 2024-03-11). A node requires
`id, type, x, y, width, height` — **position is required, not optional** — and an edge carries
`id, fromNode, fromSide, toNode, toSide, fromEnd, toEnd, color, label`, where the sides are
`top | right | bottom | left` and the ends are `none | arrow`. So a person's line, with a side
at each end and a name on it, is expressible in a frozen public format. That is much firmer
ground for the decision than inventing one.

**[excalidraw/excalidraw](https://github.com/excalidraw/excalidraw)** — 132,735★. The mature
binding model, read from `packages/element/src/types.ts`:

```ts
export type FixedPointBinding = {
  elementId: ExcalidrawBindableElement["id"];
  fixedPoint: FixedPoint;        // [number, number] — a ratio on the target
  mode: BindMode;               // "inside" | "orbit" | "skip"
};
```

kept on the linear element as `startBinding` / `endBinding`, and mirrored on the target as

```ts
boundElements: readonly BoundElement[] | null;   // { id, type: "arrow" | "text" }
```

**Bidirectional and persisted**, so the binding is re-resolved when either end moves. That is
exactly "it must survive a rebuild of the graph from the rows."

---

## The composition bug (FINDINGS §2's sibling — the canvas drawing under the chat) [read]

**[xyflow/xyflow](https://github.com/xyflow/xyflow)** — 38,479★, React Flow / Svelte Flow.
The reference implementation of the viewport maths. Its `FitViewOptions`:

```
{ padding, includeHiddenNodes, minZoom, maxZoom, duration, nodes }
```

The relevant lesson from the opposite direction: React Flow's fit is measured against the
**container**, and the documented answer to an overlay is that the sidebar lives *outside* the
flow container. This app's `<agent-flow>` is 1535px wide with ~735px visible — measured live —
so `startView` fits the ring into a box half of which is behind Grace's column, and the
comment above it states the intent it defeats: *"this puts the brain where a person looks
first."* Either the container stops lying, or the element is told the occluded width (it
already has it: `<agent-canvas>` knows `_seatPx` and sets `--seat-w`).

---

## The two-graphs split — `workspace.graph` versus the rows [pointer]

**[Comfy-Org/ComfyUI](https://github.com/Comfy-Org/ComfyUI)** — 134,712★. Keeps an editable
workflow that carries node positions **separate** from a derived, validated API prompt that
executes. That is this project's exact tension, and the split it settled on is the one
`workspace.graph` is groping toward. Also in this space, both large and both node-graphs over
AI pipelines: [langflow-ai/langflow](https://github.com/langflow-ai/langflow) (155,185★),
[FlowiseAI/Flowise](https://github.com/FlowiseAI/Flowise) (55,475★).

---

## The hub and its rings [read for stars, pointer for the algorithms]

`ringRadius` / `ringPlace` in `agentFlow.ts` are a hand-rolled radial tree layout, and the
nodes are **not uniform** — an 88px tile plus a 54px label block.

- [d3/d3-hierarchy](https://github.com/d3/d3-hierarchy) — 1,273★ — the canonical radial tree
  (`tree()` with a radial link).
- [Klortho/d3-flextree](https://github.com/Klortho/d3-flextree) — 366★ — *"Flexible tree layout
  algorithm that allows for variable node sizes."* That is the "grows with its count" property
  solved properly rather than approximated.
- [dagrejs/dagre](https://github.com/dagrejs/dagre) — 5,801★ — directed layout, if the flow
  ever needs to read left-to-right.
- [kieler/elkjs](https://github.com/kieler/elkjs) — 2,779★ — Eclipse Layout Kernel; the heavy
  option, with port-aware routing (relevant to the four-port model).

---

## Text editing on a node — the increment that was never started [pointer]

**[tldraw/tldraw](https://github.com/tldraw/tldraw)** — 50,537★. Uses **one** hidden
`contenteditable` overlay repositioned over whichever shape is being edited, not an editor per
node. That matters here beyond convenience: `prompt-section-editor.ts` already carries a
comment about the textarea owning its caret, and one overlay keeps the caret out of the model
the same way. It also has the cleanest viewport/occlusion maths of the canvas SDKs.

---

## The chrome this canvas already copies, and the simplest wire model [pointer]

- [n8n-io/n8n](https://github.com/n8n-io/n8n) — 205,790★. `agent-flow.ts` says the canvas
  chrome is *"the REFERENCE's geometry (n8n's canvas)"*. **Fair-code licensed** (Sustainable
  Use) — structure and interaction ideas only, not code.
- [node-red/node-red](https://github.com/node-red/node-red) — 23,681★. The simplest durable
  wire model there is: `wires: [[targetId]]` on the node, the whole flow as JSON.
- [jgraph/drawio](https://github.com/jgraph/drawio) — 8,305★. Graph editing at the largest
  scale, including waypoints on connections.
- [retejs/rete](https://github.com/retejs/rete) — 12,271★. A smaller framework built around
  sockets and ports, if the four-port model needs a reference.
