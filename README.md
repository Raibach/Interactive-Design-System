# Interactive Design System Manager

> **Deterministic runtime protocols, data schemas, and governance architectures - One surface. Any payload. AI fills the slots.**

**Raibach Interactive Design Studio** · John Holt  
Version **0.9.1** · A2UI Protocol Compliant · 2026-08-01

> The old hosted prototype link (`site--semantic-design-systems--…code.run`) was removed
> 2026-10-22: it answers nothing. The application runs from this repository — see Quick Start.

> ### 🧭 How this repo is run: [`AGENTS-instructions/THE_METHOD.md`](AGENTS-instructions/THE_METHOD.md)
> Live-verification design engineering. Claims are hypotheses; only observed runtime behavior is knowledge. Includes the suppression taxonomy and the AI-session steering procedure.

---

## Architecture: React Shell + AI Surface

This project follows the **React Shell + AI Surface** pattern — the emerging industry standard for AI-native applications.

- **The React Shell**: Handles deterministic UI, routing, authentication, and design system consistency (React, TypeScript, Tailwind, shadcn/ui).
- **The AI Surface**: Manages dynamic content generation, intent classification, and multi-modal interactions (text, image, speech) embedded within the shell.

**Non-negotiable: the user must never stare at a blank page.** The deterministic shell always renders — navigation, frame, error states, slot containers — regardless of what the AI does or doesn't do. The AI fills slots *inside* a shell that already exists. If the AI fails, the shell shows the failure. If the AI is slow, the shell shows a loading state. The shell is never absent.

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

Grounding is already judged, per run, in plain English. The `run_evaluations` table stores one judgment per run — cleared or failed — each with the judge's written sentence; rows like "it explicitly did not read them and instead restated headline-level summaries" are grounding verdicts, stored as database rows. They are written by the house's own evaluation judge and surfaced as the Eval tab's feed in the seat.
Cost ledger: usage_metrics — per-call, priced, cache-split aware.
Provenance: memory_provenance + vector ids into the local store (the Milvus tie-in).
Conformance: the deterministic stand-ins for structure-drift — catalogue gate, catalog:check, fidelity gate.
So the honest shape of an "AI governance level" for this system: structure is governed by the boundary (binary), and the free-text layer is governed by the per-run judge — which is already writing rows. Those rows are also why your queue item #1 was run_evaluations: I verified its semantics tonight (writer, routes, judge, surface) — the next step per the queue is to own / describe / test that chain inside the room, so the AI ledger is curated content, not just ingested tables.

---

## Systems Overview: MCP Pipelines and Independent Model Governance

**The external capture (the MCP pipelines).**
Cloud providers ship MCP servers that connect corporate production workflows to their own clouds.

**The internal alternative (model-agnostic RIDS).**
This system is built on open standards (A2UI, MCP) with no dependency on one model provider. The shell is the gatekeeper, so data stays inside the enterprise's own pipelines and models can be replaced without giving up the component tree or the production logic.

This is a reference implementation with no production payloads. The governance rules, the catalog checks and the protocol conformance are implemented and run on request (`npm run catalog:check`; the build itself is `tsc -b && vite build`); populating payloads is ingestion.

A **prompt-package lifecycle workspace** built on the A2UI (Agent-to-User Interface) protocol. The AI assembles every pixel at runtime from a trusted component catalog — no URL routing, no static pages, no hardcoded layouts. Navigation is an AI command that returns a spec-compliant envelope through a single unified endpoint.

**The product:** prompt *packages* — configuration + conversation + execution trace + governance metadata — bundled as one versioned, shareable, contributor-owned unit. The package is the aggregate root; the user is not the package.

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
    PostgreSQL       LLM providers        Milvus
    (55 tables)      (AI assembly)       (local, lite)
```

---

## Key Principles

| Principle | Implementation |
|-----------|---------------|
| **Shell Always Visible** | The deterministic React shell renders unconditionally — nav, frame, error states, slot containers. The user never stares at a blank page. AI failure = shell shows the failure, not nothing. |
| **AI Fills Slots** | Slots are the loading contract (left/middle/right). AI decides which prompt blocks, data, and chat populate them. It does not create or remove slots. |
| **Zero-Trust Catalog** | Every component validated against `frontend/src/components/A2UI/catalogs/<surface>/catalog.json`. Unknown → HTTP 503. No silent failures. |
| **Fail Loud** | Invalid AI responses → 503 with diagnostics. Database down → 503. Empty Figma spec → 503 with exact reason. Never silently degrade. |
| **No Executable Code** | `eval()` eliminated. `innerHTML` blocked. Buttons dispatch declarative `a2ui:action` events only. |
| **Package-First** | A composer creates the draft package row on mount. Chat is scoped from keystroke one. |
| **Honest Code** | Comments tell the truth about what the code does. If something is hardcoded, the comment says so. No "AI is the Architect" over fixed layouts. |

---

## Component Catalog

66 trusted components in the Composer's catalogue, typed with `ChildList` / `DynamicString` per validator rules. The number is measured from `frontend/src/components/A2UI/catalogs/prompt-composer/catalog.json` (counted 2026-10-22; every surface carries its own catalogue — `primitives` 7, `design-artifacts` 65, `ecommerce` 38); `npm run catalog:check` compares the docs against the catalog and reports a count that has drifted as a `doc-claim-drift` finding (`blocking` is that finding's severity — which row to read first — not a veto: the check reports and never gates, and exits 0 whatever it finds). That check is run on request and is NOT part of `npm run build` — the build is `tsc -b && vite build`. The live count is printed at backend startup (`✅ A2UI Catalog loaded — 66 trusted components`).

```
A2UI Basic:     Column · Row · Text · Image · Button · Card · ActionGroup
                SectionEditor · DecisionDialog · ConsoleCardGrid
                CompiledOutput · ChatPanel · TraceFeed · AgentFlow
                RoomEmbed · OutputControls · CanvasFooter
Workspace:      workspace-layout · prompt-section-editor · compiled-output-viewer
                chat-panel · chat-header · trace-feed · agent-flow · room-embed · output-controls · canvas-footer · chat-repair-actions
                version-trace · token-cost-readout · status-readout
                output-panel · search-bar
                filter-pill · footer-bar · chat-navigation-bar · agent-card
                prompt-section · control-bar · add-section-button
                ai-surface-sandbox · error-banner · prompt-container
                prompt-input-section · gripper-prompt-input · role-dropdown
                role-tile · status-bar-prompt-input · prompt-textarea
                model-selector-button · user-response-bubble
Design room:    design-left-panel · design-middle-container · component-preview · draft-preview
                figma-ingest-form · figma-layers-view
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Lit 3.x (hybrid) · Vite · npm · Tailwind · TypeScript |
| **Backend** | FastAPI · PostgreSQL 15 · Milvus (local, `MILVUS_MODE=lite`) · LLM providers (DeepSeek — `deepseek-flash` default, `deepseek-v4-pro`, `deepseek-chat`) |
| **Components** | Lit Web Components (Shadow DOM) · Figma API spec-driven |
| **Deploy** | Docker (one image per app) · local stack · ngrok tunnel |

---

## Repository Layout

```
backend/
├── main.py              # App setup, startup, router includes
├── deps.py              # A2UI catalog loader, shared helpers
├── services.py          # Database service startup
├── figma_service.py     # Figma API → Lit spec extractor
├── grace_gui.py         # AI system prompts & assembly logic
└── routes/              # 21 topic routers
    ├── ai.py                # Manifest, assemble-surface, save, audit
    ├── agent_rpc.py         # JSON-RPC 2.0 agent integration
    ├── auth.py              # Sign-in and accounts
    ├── billing.py           # Plans, free trial, the payment seam
    ├── builder_bridge.py    # The builder room's bridge
    ├── conversations.py     # Conversation + message CRUD
    ├── design_console.py    # The design console's assembly
    ├── element_analytics.py # Funnel, pacing and friction reads
    ├── element_events.py    # The element capture door
    ├── figma.py             # Figma API proxy
    ├── figma_intake.py      # Paste a Figma link: intake
    ├── files.py             # Documentation file I/O
    ├── governance.py        # Governance reads, inspection trigger
    ├── memory.py            # Memory storage (dictation)
    ├── milvus.py            # Milvus vectors
    ├── misc.py              # Health, news, PDF, reasoning
    ├── projects.py          # Project CRUD
    ├── prompt_sessions.py   # Packages, versions, permissions
    ├── teacher.py           # Teacher query, model ensure
    ├── tools_surface.py     # The tools surface tree
    └── ux_chat.py           # The UX chat door

frontend/
├── src/
│   ├── App.tsx              # Root app with routes
│   ├── components/
│   │   ├── A2UI/            # A2UI surface container
│   │   └── lit/             # Lit web components (agent-card, workspace-layout, …)
│   ├── pages/               # WritingAreaIndex (main surface)
│   ├── hooks/               # React hooks
│   └── shared/              # Surface contract, tag registry
└── scripts/                  # catalog-check.mjs, catalog-tree.mjs, app-loads.mjs, shell-decompose.cjs
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
- **The visitor gate:** the access code lives in `frontend/index.html` and nowhere else. It is deliberately not repeated in this document.
- **Caching:** the shell (`index.html`) is served `no-store`; the content-hashed `/assets/*` files are immutable for a year (measured 2026-10-01: the old blanket no-store re-downloaded ~1 MB on every load).

---

## Deployment

Docker images are built from each app's own Dockerfile; the studio's is a **multi-stage build** — the frontend compiles inside a Node stage, so no build artifacts live in the repository.

The application runs on this machine as a local stack: `bash RESTART-LOCAL.sh` (backend, site, checks) or `bash development/ops/start-all-local.sh` (every door), with `development/ops/supervise-all.sh` keeping the ports up. Each room's program is its own container or process; outside access runs through the ngrok tunnel configured in `runtime/ngrok-endpoints.yml`.

The earlier Northflank deployment (`prompt-composer-console`, us-central, `DEPLOY-NORTHFLANK.sh`) is retired — neither the script nor the service exists any more.

---

## Documentation

- [`AGENTS-instructions/THE_METHOD.md`](AGENTS-instructions/THE_METHOD.md) — Live-verification design engineering: the working doctrine
- [`AGENTS-instructions/READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md`](AGENTS-instructions/READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md) — Live-verified compliance ledger
- [`CHANGELOG.md`](CHANGELOG.md) — Release history (includes the DeepSeek restoration battle)
- [`SECURITY-AND-COMPLIANCE.md`](SECURITY-AND-COMPLIANCE.md) — The compliance gate and its limits
- [`USER-FLOW.md`](USER-FLOW.md) — The journey the gate governs

> The conformance specification (`IMPLEMENTATION_CONFORMANCE.md`) and `FIGMA/CONSOLE_CONTRACTS.md`
> were removed from the tree before 2026-10-22; this list names only documents that exist here.

---

## Roadmap

- **Phase 3:** Generic adjacency-list renderer + JSON Pointer data binding
- **Phase 4:** Remaining docs cleanup, advanced contributor workflows

---

*"The interface never changes. The AI delivers different levels of access. That's the architecture."*
