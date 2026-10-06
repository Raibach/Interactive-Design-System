# Interactive Design System Manager

> **Deterministic runtime protocols, data schemas, and governance architectures - One surface. Any payload. AI fills the slots.**

**Raibach Interactive Design Studio** · John Holt  
Version **0.9.1** · A2UI Protocol Compliant · 2026-10-06

> ### 📘 Read this first: [`IMPLEMENTATION_CONFORMANCE.md`](READ-ME/IMPLEMENTATION_CONFORMANCE.md)
> The **A2UI Protocol v0.9.1 implementation & conformance specification** — every normative requirement of the protocol mapped, file by file, to the code that implements it, with an honest built/pending status map.
>
> **🧭 How this repo is run:** [`READ-ME/THE_METHOD.md`](READ-ME/THE_METHOD.md) — live-verification design engineering. Claims are hypotheses; only observed runtime behavior is knowledge. Includes the suppression taxonomy and the AI-session steering procedure.

---

## The Six Seats — One Level, On Purpose

The workspace is a cockpit with six seats, all on the same axis:

| Seat | The room |
|------|----------|
| **Console** | Where the work lands: every package is a card, and the portfolio is one grid. |
| **Composer** | Where a package is written and run: sections, conversation, execution, trace — one lifecycle in one place. |
| **Design** | The design room: the component catalog, the Figma source, the drawings the system is built from. |
| **Product** | The product room: the app builder itself, absorbed whole — its build conversation runs inside the platform's own chat. |
| **Development** | The development seat: the sovereign workspace — agents, code, review — bounded to its own room. |
| **Governance** | The observation seat: a high-level read of performance across every other seat, built for the people who answer for the company. |

**It is the CEO. It is the people paying the bills — that is their room. Everybody has a room, and that is the point.** The seats sit at the same level because the company they describe has no translation layers. Traditionally, information bubbles up through management until it reaches the executive suite, losing signal at every hop; here the executive looks horizontally, at the same cockpit everyone else works in. Design, development and governance are adjacent — the handoff is the next room, not the next meeting. The layout is the metaphor: flattened, shared context, no gatekeepers.

## Governance — the Observer Seat

**"You can't let the fox manage the henhouse."** Compliance owned by the function it judges is not compliance: engineering and design, auditing themselves, will eventually rationalize whatever makes their timelines look good. So Governance is a separate, executive-facing seat — CTO and CEO level — whose whole job is observation: performance, risk and the honest state of the system, measured where the work actually happens, and surfaced at the top instead of filtered on the way up.

**And every department may carry its own governance lens.** A design department's governance measures the design — front-end performance, interaction friction, component adoption — everything third-party analytics used to be bolted on to do, measured natively inside the architecture instead. Development's measures the system: runtime, load, regressions. The executive layer reads them all, clean and unspun, on the same flat axis.

---

## Architecture: React Shell + AI Surface

This project follows the **React Shell + AI Surface** pattern — the emerging industry standard for AI-native applications.

- **The React Shell**: Handles deterministic UI, routing, authentication, and design system consistency (React, TypeScript, Tailwind, shadcn/ui).
- **The AI Surface**: Manages dynamic content generation, intent classification, and multi-modal interactions (text, image, speech) embedded within the shell.

**Non-negotiable: the user must never stare at a blank page.** The deterministic shell always renders — navigation, frame, error states, slot containers — regardless of what the AI does or doesn't do. The AI fills slots *inside* a shell that already exists. If the AI fails, the shell shows the failure. If the AI is slow, the shell shows a loading state. The shell is never absent.

---

## Systems Overview: MCP Pipelines and Independent Model Governance

**The external capture (the MCP pipelines).**
Cloud providers ship MCP servers that connect corporate production workflows to their own clouds.

**The internal alternative (model-agnostic RIDS).**
This system is built on open standards (A2UI, MCP) with no dependency on one model provider. The shell is the gatekeeper, so data stays inside the enterprise's own pipelines and models can be replaced without giving up the component tree or the production logic.

This is a reference implementation with no production payloads. The governance rules, the catalog checks and the protocol conformance are implemented and run on every build; populating payloads is ingestion.

A **prompt-package lifecycle workspace** built on the A2UI (Agent-to-User Interface) protocol. The AI assembles every pixel at runtime from a trusted component catalog — no URL routing, no static pages, no hardcoded layouts. Navigation is an AI command that returns a spec-compliant envelope through a single unified endpoint.

**The product:** prompt *packages* — configuration + conversation + execution trace + governance metadata — bundled as one versioned, shareable, contributor-owned unit. The package is the aggregate root; the user is not the package.

---

## Constraint, Compute, Custody — Measured

Cost here follows from the design. Assembly does not need a model that thinks; it needs a model that moves, and what allows that is a closed answer space: a fixed catalog, a fixed set of seats, and values bound by path.

**The mechanism.** A model produces the next token from a set of candidates, and the constraint decides how many candidates are in that set. With the catalog fixed and values bound by path, the set holds one or two items — the model copies rather than chooses. Reasoning tokens are what it spends when the set is wide.

**The measurement.** With reasoning turned off for surfaces, the same prompt returned the same valid JSON: 251 completion tokens instead of 460, 1.53 seconds instead of 6.05. One assembly call per console load at 3,551 tokens replaced three calls of about 3,760 each — roughly half a cent per load, before counting the failures that no longer occur.

**The limit.** The constraint is a live property, not a slogan: each entry added to the catalog, and each field no check covers, gives the model something to decide again.

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
│  One surface. Six seats. Any payload. AI fills the slots.        │
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
| **Zero-Trust Catalog** | Every component validated against `catalogs/<pipeline>/catalog.json`. Unknown → HTTP 503. No silent failures. |
| **Fail Loud** | Invalid AI responses → 503 with diagnostics. Database down → 503. Empty Figma spec → 503 with exact reason. Never silently degrade. |
| **No Executable Code** | `eval()` eliminated. `innerHTML` blocked. Buttons dispatch declarative `a2ui:action` events only. |
| **Package-First** | A composer creates the draft package row on mount. Chat is scoped from keystroke one. |
| **Honest Code** | Comments tell the truth about what the code does. If something is hardcoded, the comment says so. No "AI is the Architect" over fixed layouts. |

---

## Component Catalog

Every component a payload may name is validated against the pipeline's own `catalog.json` — unknown tag, HTTP 503. Components are typed with `ChildList` / `DynamicString` per the validator rules, the live count is printed at backend startup, and `npm run catalog:check` compares the docs against the catalog (it reports drift and never gates). Specified in [`IMPLEMENTATION_CONFORMANCE.md`](READ-ME/IMPLEMENTATION_CONFORMANCE.md) §4.3.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Lit 3.x (hybrid) · Vite · npm · Tailwind · TypeScript |
| **Backend** | FastAPI · PostgreSQL 15 · Zilliz Cloud (Milvus) · LLM providers (Z.ai GLM primary, DeepSeek) |
| **Components** | Lit Web Components (Shadow DOM) · Figma API spec-driven |
| **Deploy** | Docker · Northflank (us-central) · Cloudflare Tunnel |

---

## Repository Layout

```
backend/        FastAPI app · A2UI catalog loader · Figma extractor · AI assembly · topic routers
frontend/       React shell + Lit component library (Shadow DOM, Figma-driven) · the surface host
wireframe-lab/  The sovereign tooling: the app builder and its local engine, the dev workspace, the room docs
READ-ME/        The doctrine: the conformance specification, THE_METHOD, the audits
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

---

## Deployment

Docker on **Northflank** (`prompt-composer-console`, us-central). Production deploys via git push to `main` (CI/CD) or the local `DEPLOY-NORTHFLANK.sh` runbook. The image is a **multi-stage build**: the frontend compiles inside a Node stage (including manifest generation), so no build artifacts live in the repository.

---

## Documentation

- [`IMPLEMENTATION_CONFORMANCE.md`](READ-ME/IMPLEMENTATION_CONFORMANCE.md) — A2UI Protocol v0.9.1 implementation & conformance specification (requirements → code, verified status map)
- [`READ-ME/THE_METHOD.md`](READ-ME/THE_METHOD.md) — Live-verification design engineering: the working doctrine
- [`READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md`](READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md) — Live-verified compliance ledger
- [`CHANGELOG.md`](CHANGELOG.md) — Release history (includes the DeepSeek restoration battle)
- [`FIGMA/CONSOLE_CONTRACTS.md`](FIGMA/CONSOLE_CONTRACTS.md) — Console surface data contract

---

## Roadmap

- **Phase 3:** Generic adjacency-list renderer + JSON Pointer data binding
- **Phase 4:** Remaining docs cleanup, advanced contributor workflows

---

*"The interface never changes. The AI delivers different levels of access. That's the architecture."*
