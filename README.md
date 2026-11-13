# Interactive Design System Manager
Raibach Interactive Design Systems · John Holt  

## Demo: Wireframe interactive prototype
https://astragalar-santa-unbelligerently.ngrok-free.dev
Demo pin: (see resume)

> The **A2UI Protocol v0.9.1 implementation & conformance specification** — every normative requirement of the protocol mapped, file by file, to the code that implements it, with an honest built/pending status map.

The stack, in one line each:

- TypeScript throughout the frontend — React for the shell, Lit for the components, Vite to build, Tailwind for styles.
- Python and FastAPI on the backend — the API, the routes, and the surface assembly.
- PostgreSQL — the one database; sessions, conversations, cards, and activity all live in its tables.
- Milvus — the vector store, for memory and for search over the ingested components.
- The model provider — DeepSeek, reached through the single teacher turn.

---

## Architecture: React Shell + AI Surface

This project follows the **React Shell + AI Surface** pattern — the emerging industry standard for AI-native applications.

- **The React Shell**: Handles deterministic UI, routing, authentication, and design system consistency (React, TypeScript, Tailwind, shadcn/ui).
- **The AI Surface**: Manages dynamic content generation, intent classification, and multi-modal interactions (text, image, speech) embedded within the shell.

**Non-negotiable: the user must never stare at a blank page.** The deterministic shell always renders — navigation, frame, error states, slot containers — regardless of what the AI does or doesn't do. The AI fills slots *inside* a shell that already exists. If the AI fails, the shell shows the failure. If the AI is slow, the shell shows a loading state. The shell is never absent.

### How MCP and the Lit catalog work with the shell

The shell is the part that never moves. It owns the frame, the navigation, the left and right columns, and the failure states. MCP is how outside work reaches that frame: a pipeline reads a source, takes the facts the source states, and hands them to the shell's assembly, which decides which slot they fill. The Figma reader below is the working example. The REST API and the desktop MCP server are its two readers, and their replies are merged into one measured design before the shell draws it.

The Lit catalog is the set of components the shell is allowed to draw. A surface is assembled from that fixed list; no component is invented at request time and no markup is generated from nothing. The catalog is the schema the server accepts, the registry is the list of names the browser may resolve to an element, and the Lit element is the thing that draws. A name outside the catalog is refused, so the shell never receives a surface it cannot draw. The frame stays whole even when the content behind it fails.

---

## Systems Overview: MCP Pipelines and Independent Model Governance

**The external capture (the MCP pipelines).**
Cloud providers ship MCP servers that connect corporate production workflows to their own clouds.

**The internal alternative (model-agnostic RIDS).**
This system is built on open standards (A2UI, MCP) with no dependency on one model provider. The shell is the gatekeeper, so data stays inside the enterprise's own pipelines and models can be replaced without giving up the component tree or the production logic.

This is a reference implementation with no production payloads. The governance rules, the catalog checks and the protocol conformance are implemented and run on every build; populating payloads is ingestion.

## Vertical Slice Architecture

This repository is organized by what a person sees and does, not by technical layer. Each tab of the studio is one self-contained slice: the folder for a tab holds everything that tab needs — its interface, its conversation, its session handling, and its own process — and nothing it does depends on another tab's folder.

- **Feature-based organization.** The Tools tab lives in `frontend/src/rooms/design/tools/` with its own chat, its own conversation file, and its own session contract; the UX tab lives in `frontend/src/rooms/design/ux/`. A change to one tab cannot reach into another tab's files.
- **End-to-end implementation.** A slice runs through every layer its work needs. The Tools tab's session lifecycle is owned by its own backend file, `backend/routes/tools_session.py`, not by a shared store that every other tab also reads. What a slice does, it does from its own folder.
- **No shared abstractions.** There is no generic repository or service layer standing between the tabs. Each slice takes the simplest implementation its own work needs; nothing is forced through a common path that would couple one tab's behavior to another's.
- **Localized changes.** Because a feature is one folder, a repair stays inside that folder. The working rule this repository follows is that a fix for one tab may not borrow a shared helper at another tab's expense; when two tabs' rules differ, each tab owns its own file.

**The complete stack.**

- **The A2UI Protocol v0.9.1 implementation & conformance specification** — every normative requirement of the protocol mapped, file by file, to the code that implements it, with an honest built/pending status map.
- **TypeScript** throughout the frontend — React for the shell, Lit for the components, Vite to build, Tailwind for styles.
- **Python and FastAPI** on the backend — the API, the routes, and the surface assembly.
- **PostgreSQL** — the one database; sessions, conversations, cards, and activity all live in its tables.
- **Milvus** — the vector store, for memory and for search over the ingested components.
- **The model provider** — DeepSeek, reached through the single teacher turn.
- **The slices, one folder per seat** — the shell, `console`, `composer`, `design` (with `chat`, `tools`, `ux`, `review`, `cards`, and `console`), `product`, `governance`, and `development` in the frontend, with the matching routers in `backend/routes/`.

This is the pattern known as Vertical Slice Architecture (VSA): the application is cut vertically, one feature per slice, instead of horizontally across shared layers. It is the reason a defect in one tab can be found and repaired without touching the others, and the reason the interface and its data travel together instead of being assembled from scattered pieces.

### Overriding the Figma Canvas: Two Readers, One Measured Design

The Figma canvas is read directly. The owner did not hold an executive Figma account, so the design is imported into Raibach IDS rather than through Figma's own export path. Raibach IDS assembles the component; Figma remains the source of the measurements.

Two readers supply the same file. The REST API (`GET /v1/files/<key>/nodes?ids=<node>&geometry=paths`) returns the node tree, the geometry and the vector path data. The desktop MCP server at `127.0.0.1:3845` returns the facts the REST response does not carry: the behavioral annotations, the reference code, the designer's descriptions, and the layout and style facts. `_merge_mcp_rest` in `backend/routes/figma.py` joins the two replies into one measured design. The MCP reader is absent on a deployed server, and the pipeline says so rather than inventing the missing facts.

Neither reader interprets the file. A fact one channel states is taken from that channel; a fact both state must agree, and a disagreement is reported with both values. The renderer draws the measured design, so the component the application shows is the file's own geometry rather than a picture exported from Figma.

A **prompt-package lifecycle workspace** built on the A2UI (Agent-to-User Interface) protocol. The AI assembles every pixel at runtime from a trusted component catalog — no URL routing, no static pages, no hardcoded layouts. Navigation is an AI command that returns a spec-compliant envelope through a single unified endpoint.

**The product:** prompt *packages* — configuration + conversation + execution trace + governance metadata — bundled as one versioned, shareable, contributor-owned unit. The package is the aggregate root; the user is not the package.

---

## Conversation Design: Task-Based, Context-Aware, Isolated to Each Tab

The user opens a tab and finds the work they left there, not a chat box waiting for a general question. The conversation opens the last conversation the tab lists, shows the last activity, and asks where the user would like to pick up. It does not introduce itself on every visit, and it does not offer a general chat that could belong to any tab.

The design has four parts: the tab's own conversation and its list; the frame every tab shares, whose view slot holds whatever the tab puts there; the conversations bar, which carries the count, the last saved time and the new and remove controls; and the console in the left column, with the design-system selector, the application's tree and the activity cards.

The conversation manages that surface. The user's selection in the left column is its context; a card opens its last conversation and last activity, and the question it asks comes from that work. Each tab owns its conversation, and no tab reads the whole system's chats. The conversation does not sit apart as a general assistant; it carries the work in the surface forward. The column that carries the conversation is a surface too, not a chat transcript: it can serve text, an image, instructions, or an interface with cards and buttons. The user sees a chat's face because the user already knows how to read it and how to type into it; underneath, it is the output surface of the tab's work, and the tab decides what the column is for.

The rule is in [`design/ONE-CHAT-PER-TAB.md`](design/ONE-CHAT-PER-TAB.md), the console's structure in [`design/ARCHITECTURE.md`](design/ARCHITECTURE.md), and the open work in [`design/plans/05-SEATS.md`](design/plans/05-SEATS.md) and [`design/plans/06-CARDS-AND-CONSOLE.md`](design/plans/06-CARDS-AND-CONSOLE.md). The Approve tab follows the same rule: the surface in the column is the review, not a separate dashboard. The detailed state is in those documents.

GOVERNANCE

The AI governance question — drift and grounding
LLM observability (or AI evaluation & monitoring). 

Drift — watch the system's behavior/output distribution shift away from a baseline over time.
Grounding / faithfulness — is the answer actually supported by what it read? (Hallucination detection is the inverse measure.)
Quality & regression evals — score answers, catch version-to-version regressions.
Plus cost/latency/trace logging.
It exists because for open-ended generative systems you can't enumerate the possible outputs — so you watch statistics forever.

Why that layer is largely not needed here — and what remains. My own ARCHITECTURE-IS-THE-GOVERNANCE.md already draws this line: the model composes only from the human-curated catalogue, and a name outside it gets a loud 503 — so "drift" stops being a statistical thing to watch and becomes a binary violation to reject. For structure, classical drift monitoring is obsolete as a method. The document itself names the pots it does not cover — and one of them is exactly what you're circling: it says the evals / model-risk pots "are different purchases."

> **This section's argument, written out as doctrine:**
> [`AGENTS-instructions/READ-ME/THE_SELF_REPORTING_SYSTEM.md`](AGENTS-instructions/READ-ME/THE_SELF_REPORTING_SYSTEM.md)
> — self-reporting, not self-healing; the failure vault; the morning brief; the
> seven-or-thirty-day window; the purge. When the code and the doctrine disagree, the
> code is wrong.

---

## October 17, 2026: Zero-Reasoning, Zero-Telemetry, Self-Reporting

### 1. Paradigm Shift: Zero-Reasoning / Zero-Trust Architecture

We have moved away from the “AI governance” and passive observability model (Langfuse /
OpenTelemetry spans) as a default. In its place: the model is a utility inside a contract.

In our protocol the AI does not think, does not design, does not write code on the fly, and
does not make runtime architectural decisions. It operates as a stateless, non-interpretive
semantic force mapping data arrays directly to a rigid, deterministic Component Registry and
Static Catalog. Because reasoning is explicitly turned off at the provider level, the model
cannot drift, it cannot lose grounding, and it cannot return anything outside our concrete
boundaries.

### 2. The Economics We Chose

Cloud providers price reasoning tokens and deep-reasoning models at a premium. We do not
request them: the payload carries `reasoning_effort: "none"` on every mode, unconditionally.
What we pay for is the transformation — and it is small. A measured call, 600 tokens, costs
**$0.00004**.

The same applies to observation: we removed the trace trees, span waterfalls, dashboards and
filter tables that exist to watch an open-ended model. A deterministic pipeline needs a
morning receipt, not a live heart monitor.

If an infrastructure fracture occurs, the system behaves as a pure circuit breaker: it halts
instantly, protects the interface, hands the user the real reason and the door to try again,
and writes a single confession — one row, five facts — for the next-day morning briefing.

We do not run an unconstrained chat application. We run a tight, high-performance machine
unburdened by legacy computing philosophies or artificial complexity.

**The full argument:** [`AGENTS-instructions/READ-ME/THE_LIBERATION_FROM_THE_BLACK_BOX.md`](AGENTS-instructions/READ-ME/THE_LIBERATION_FROM_THE_BLACK_BOX.md)
· **The failure doctrine:** [`THE_SELF_REPORTING_SYSTEM.md`](AGENTS-instructions/READ-ME/THE_SELF_REPORTING_SYSTEM.md)
· **The security and compliance gate:** [`SECURITY-AND-COMPLIANCE.md`](SECURITY-AND-COMPLIANCE.md)
· **The user flow:** [`USER-FLOW.md`](USER-FLOW.md)

### 3. New Initiative: A Compliance Gate, and a Thin Governance Layer

We are separating two things that were sharing a word.

**Compliance** answers *"is this assembly allowed to exist?"* — a question with an answer
before anything ships. **Governance** answers *"how is the running system behaving?"* — a
question with no answer until there is traffic.

The initiative builds the first as a chain and keeps the second thin. Business logic is
enforced where it is decided: at the assembly window, where the product person's prompt meets
the static Lit catalogue and the model returns a candidate assembly. Nothing reaches a front end
without three contributed verdicts — **design** reviews it for compliance and disability
standards, runs it in front of real users and sends the analysis back; **product** reads that
analysis and decides it is what they meant; then **one developer** hardens the package against
the registry and launches. Production reads the frozen record; it re-derives nothing. Where the
instruction needs a component the catalogue does not hold, design draws it in Figma, ingests it
through the design seat, and the package continues with the new component tied to the business
logic. The approvals live in the Approvals tab that is already in the chat navigation.

Research is not a fourth department — design *is* research, and every phase carries research
layers. Discovery, feedback and surveys are research for product; A/B tests and user reaction
are research for design; a **spike** is a developer's research; compliance, security and
oversight are research for the CTO and the CEO in the business.

**The loop is the AI.** The machine runs the coordination end to end — communications,
notifications, gate management, catalogue compliance, deterministic assembly — and never idles
waiting on a person. People are contributors at the edge: they supply the spark once, contribute
a verdict at a checkpoint, and step back. Curation is the machine's job too, because curation is
itself a loop and people curate inconsistently. One boundary does not move: the AI may check,
refuse, route, record and escalate its own assembly, but it may not approve it. A machine that
signs its own work is a mirror, not a control.

Governance remains — to keep an eye on failed assemblies, provider walls and evaluation
verdicts — but on a monthly cadence driven by those alerts, not by per-request tracing.

The doctrine, the failure modes it addresses, and the limits it accepts are in
[`SECURITY-AND-COMPLIANCE.md`](SECURITY-AND-COMPLIANCE.md). The chain is not built yet.

### 4. The User Flow, and What It Makes Measurable

The journey end to end — the product person's idea, the instruction, the assembly, the three
approvals, the customer's moment — is written out in [`USER-FLOW.md`](USER-FLOW.md). The gate
document states the rules; that document states the journey through them.

While the people make the judgements, the machine does the coordination: communications between
stages, notifications, gate management, the approval record, assembly, catalogue management, and
composition for the front end. It decides nothing, approves nothing, and invents no component.

Because the front end is drawn from a **fixed catalogue of known components** rather than
generated markup, every interaction can be attributed to a named component inside a named
assembly from a named package. That is what makes deep product analytics honest here:
time-to-intent, click-through latency per component, task completion velocity, friction and
drop-off — plus, internally, how long a package waits at each approval stage.

The inversion follows: an AI product usually spends its telemetry looking inward, tracing the
model. Here the internal steps are fixed by the catalogue and the gate, so looking inward buys
almost nothing. The measurement looks **outward**, at the person using the surface.

Honest status: the design-side activity records (`design_element_activity`) and the governance
event counts exist. The customer-side pieces — a served-at timestamp, a component identity on
each interaction, a session that survives the journey, a store and a view — do not exist yet.

---

What remains genuinely real — and already exists in your system, measured tonight:

Grounding is already judged, per run, in plain English. The run_evaluations table holds 53 judged runs right now (32 failed / 21 cleared), each with the judge's written sentence — rows like "it explicitly did not read them and instead restated headline-level summaries." That is a grounding verdict, stored as a database row. It's written by the house's own evaluation-judge and surfaced as the Eval tab's feed in the seat.
Cost ledger: usage_metrics — per-call, priced, cache-split aware.
Provenance: memory_provenance + vector ids into the local store (the Milvus tie-in).
Conformance: the deterministic stand-ins for structure-drift — catalogue gate, catalog:check, fidelity gate.
So the honest shape of an "AI governance level" for this system: structure is governed by the boundary (binary), and the free-text layer is governed by the per-run judge — which is already writing rows. Those rows are also why your queue item #1 was run_evaluations: I verified its semantics tonight (writer, routes, judge, surface) — the next step per the queue is to own / describe / test that chain inside the room, so the AI ledger is curated content, not just ingested tables.

---

## Constraint, Compute, Custody — Measured

Cost here follows from the design. Assembly does not need a model that thinks; it needs a model that moves, and what allows that is a closed answer space: a fixed catalog, a fixed set of seats, and values bound by path.

**The mechanism.** A model produces the next token from a set of candidates, and the constraint decides how many candidates are in that set. At each step it sits at the edge of a choice. With the catalog fixed and values bound by path, the set holds one or two items, so the model copies rather than chooses. Reasoning tokens are what it spends when the set is wide. This describes the measurements below; it is not a claim about what the model experiences, which is nothing anybody can observe from outside.

**The measurement.** With reasoning turned off for surfaces, the same prompt returned the same valid JSON: 251 completion tokens instead of 460, 1.53 seconds instead of 6.05. If the model were deciding anything, removing the reasoning would have changed the answer.

**Where invention enters.** The structure carries the answer and the model moves it forward. Where the structure has a gap, the model fills it by guessing, and that guess is where invention enters. An unannotated control is a gap of this kind, and so is a field no check covers.

**Per console load.** One assembly call at 3,551 tokens. Before the change: three calls at about 3,760 tokens each, 23 of 86 requests returning an error, and two attempts spent on each failure. Saving: 7,700 tokens per load, about half a cent at commodity model prices, not counting the failures that no longer occur.

**Volume.** Half a cent per load, multiplied by the number of loads. At five dollars per thousand loads, one hundred million loads a year is about half a million dollars — around 300,000 loads a day. Below that volume the token figure is smaller. The remaining savings are behavioral: failures that no longer occur, and the wait per assembly, 6 seconds to 1.5 on the same prompt.

**On-premise.** On owned hardware the limiting resource is GPU seconds, not dollars per token, so a two-thirds reduction in tokens and a four-fold reduction in latency is fewer machines. Assembly runs on a small local model because the catalog fixes the answer space and every value is checked. The conversation runs on a larger model; it is the only mode with reasoning enabled.

**Limits.** Power is the operating cost, not the total cost; hardware and staffing are additional. The conversation needs a capable model and assembly does not. The constraint is a live property: each entry added to the catalog, and each field no check covers, gives the model something to decide again.

---

## Architecture at a Glance

```
┌──────────────────────────────────────────────────────────────────┐
│                        A2UI v0.9.1 Surface                      │
│                                                                  │
│  POST /api/ai/assemble-surface                                   │
│  ┌────────────┐  ┌─────────────────┐  ┌───────────────────┐     │
│  │  Section    │  │   Compiled      │  │     Chat          │     │
│  │  Editor     │  │   Output        │  │     Panel         │     │
│  │  (left)     │  │   (middle)      │  │     (right)      │     │
│  └────────────┘  └─────────────────┘  └───────────────────┘     │
│                                                                  │
│  Intents: render-console · render-composer · render-session:{id} │
│  Envelope: createSurface → updateComponents → updateDataModel    │
└──────────────────────────────────────────────────────────────────┘
         │                    │                     │
    PostgreSQL       LLM providers        Zilliz Cloud
    (42 tables)      (AI assembly)       (vector memory)
```

---

## Key Principles

| Principle | Implementation |
|-----------|---------------|
| **Shell Always Visible** | The deterministic React shell renders unconditionally — nav, frame, error states, slot containers. The user never stares at a blank page. AI failure = shell shows the failure, not nothing. |
| **AI Fills Slots** | Slots are the loading contract (left/middle/right). AI decides which prompt blocks, data, and chat populate them. It does not create or remove slots. |
| **Zero-Trust Catalog** | Every component validated against `component-catalog.json`. Unknown → HTTP 503. No silent failures. |
| **Fail Loud** | Invalid AI responses → 503 with diagnostics. Database down → 503. Empty Figma spec → 503 with exact reason. Never silently degrade. |
| **No Executable Code** | `eval()` eliminated. `innerHTML` blocked. Buttons dispatch declarative `a2ui:action` events only. |
| **Package-First** | A composer creates the draft package row on mount. Chat is scoped from keystroke one. |
| **Honest Code** | Comments tell the truth about what the code does. If something is hardcoded, the comment says so. No "AI is the Architect" over fixed layouts. |

---

## Component Catalog

75 trusted components — the live count is the catalog's, asserted at backend startup (`✅ A2UI Catalog loaded — 75 trusted components`) and checked by `npm run catalog:check`. The component shapes are typed with `ChildList` / `DynamicString` per the validator rules.

```
A2UI Basic:     Column · Row · Text · Image · Button · Card · ActionGroup
                SectionEditor · DecisionDialog · ConsoleCardGrid
                CompiledOutput · ChatPanel
Workspace:      workspace-layout · prompt-section-editor · compiled-output-viewer
                chat-panel · version-trace · token-cost-readout · status-readout
                output-panel · search-bar · filter-pill · footer-bar
                chat-navigation-bar · agent-card · featured-card
                prompt-section · add-section-button
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Lit 3.x (hybrid) · Vite · npm · Tailwind · TypeScript |
| **Backend** | FastAPI · PostgreSQL 15 · Zilliz Cloud (Milvus) · LLM provider (DeepSeek) |
| **Components** | Lit Web Components (Shadow DOM) · Figma API spec-driven |
| **Deploy** | Docker · Northflank (us-central) · Cloudflare Tunnel |

---

## Repository Layout

```
backend/
├── main.py              # App setup, startup, router includes
├── deps.py              # A2UI catalog loader, shared helpers
├── services.py          # Database service startup
├── figma_service.py     # Figma API → Lit spec extractor
├── grace_gui.py         # AI system prompts & assembly logic
└── routes/              # 11 topic routers
    ├── ai.py                # Manifest, assemble-surface, save, audit
    ├── conversations.py    # Conversation + message CRUD
    ├── prompt_sessions.py  # Packages, versions, permissions
    ├── projects.py         # Project CRUD
    ├── memory.py           # Memory storage (dictation)
    ├── figma.py            # Figma API proxy
    ├── milvus.py           # Zilliz/Milvus vectors
    ├── agent_rpc.py        # JSON-RPC 2.0 agent integration
    ├── teacher.py          # Teacher query, model ensure
    ├── misc.py             # Health, news, PDF, reasoning
    └── files.py            # Documentation file I/O

frontend/
├── src/
│   ├── App.tsx              # Root app with routes
│   ├── components/
│   │   ├── A2UI/            # A2UI surface container
│   │   └── lit/             # Lit web components (agent-card, workspace-layout, …)
│   ├── pages/               # WritingAreaIndex (main surface)
│   ├── hooks/               # React hooks
│   └── shared/              # Surface contract, tag registry
└── scripts/                  # Manifest generator, Figma sync
```

---

## Quick Start

```bash
# Frontend build (required for local dev)
cd frontend && npm install && npm run build

# Start backend + serve UI
bash RESTART-LOCAL.sh

# Open
open http://localhost:5001
```

- **Health:** `GET /api/health` → `{"database":"connected","milvus":"connected"}`
- **Dev PIN:** `please request or see reume`
- **Dev mode:** global no-cache middleware — no stale bytes

---

## Deployment

Docker on **Northflank** (`prompt-composer-console`, us-central). Production deploys via git push to `main` (CI/CD) or the local `DEPLOY-NORTHFLANK.sh` runbook. The image is a **multi-stage build**: the frontend compiles inside a Node stage (including manifest generation), so no build artifacts live in the repository.

---

## Documentation

- [`Core-Concept.md`](AGENTS-instructions/Core-Concept.md) — the A2UI operating rules: the architecture facts, the three layers and the component rules
- [`THE_ZERO_TRUST_REPAIR.md`](AGENTS-instructions/THE_ZERO_TRUST_REPAIR.md) — the zero-trust repair record, written from measurements
- [`CHANGELOG.md`](frontend/src/rooms/design/CHANGELOG.md) — the Design room's record: the current work, the audit and the repair plan
- [`THE_CONVERSATION_CONTRACT.md`](AGENTS-instructions/THE_CONVERSATION_CONTRACT.md) — how the chat and the console behave, as invariants

---

## Roadmap

- **Phase 3:** Generic adjacency-list renderer + JSON Pointer data binding
- **Phase 4:** Remaining docs cleanup, advanced contributor workflows

---

*"The interface never changes. The AI delivers different levels of access. That's the architecture."*
