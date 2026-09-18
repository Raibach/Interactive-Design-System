# Interactive Design System Manager

> **Deterministic runtime protocols, data schemas, and governance architectures - One surface. Any payload. AI fills the slots.**

**Raibach Interactive Design Studio** · John Holt  
Version **0.9.1** · A2UI Protocol Compliant · 2026-08-01

> ### 📘 Read this first: [`IMPLEMENTATION_CONFORMANCE.md`](READ-ME/IMPLEMENTATION_CONFORMANCE.md)
> The **A2UI Protocol v0.9.1 implementation & conformance specification** — every normative requirement of the protocol mapped, file by file, to the code that implements it, with an honest built/pending status map.
>
> **🧭 How this repo is run:** [`READ-ME/THE_METHOD.md`](READ-ME/THE_METHOD.md) — live-verification design engineering. Claims are hypotheses; only observed runtime behavior is knowledge. Includes the suppression taxonomy and the AI-session steering procedure.

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
| **Zero-Trust Catalog** | Every component validated against `catalogs/<pipeline>/catalog.json`. Unknown → HTTP 503. No silent failures. |
| **Fail Loud** | Invalid AI responses → 503 with diagnostics. Database down → 503. Empty Figma spec → 503 with exact reason. Never silently degrade. |
| **No Executable Code** | `eval()` eliminated. `innerHTML` blocked. Buttons dispatch declarative `a2ui:action` events only. |
| **Package-First** | A composer creates the draft package row on mount. Chat is scoped from keystroke one. |
| **Honest Code** | Comments tell the truth about what the code does. If something is hardcoded, the comment says so. No "AI is the Architect" over fixed layouts. |

---

## Component Catalog

41 trusted components — 13 A2UI Basic Catalog primitives + 28 project-specific Lit elements — typed with `ChildList` / `DynamicString` per validator rules. This number and the list below are held against `catalogs/prompt-composer/catalog.json` by `catalog-check.mjs` (`doc-claim-drift`, blocking) on every run, and the live count is printed at backend startup (`✅ A2UI Catalog loaded — 41 trusted components`). A stale number here fails the build; it does not wait to be remembered. Specified in [`IMPLEMENTATION_CONFORMANCE.md`](READ-ME/IMPLEMENTATION_CONFORMANCE.md) §4.3.

```
A2UI Basic:     Column · Row · Text · Image · Button · Card · ActionGroup
                SectionEditor · DecisionDialog · ConsoleCardGrid
                CompiledOutput · ChatPanel · TraceFeed
Workspace:      workspace-layout · prompt-section-editor · compiled-output-viewer
                chat-panel · trace-feed · chat-repair-actions · version-trace
                token-cost-readout · status-readout · output-panel · search-bar
                filter-pill · footer-bar · chat-navigation-bar · agent-card
                prompt-section · control-bar · add-section-button
                ai-surface-sandbox · error-banner · prompt-container
                prompt-input-section · gripper-prompt-input · role-dropdown
                role-tile · status-bar-prompt-input · prompt-textarea
                model-selector-button
```

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
- **Dev PIN:** `7377`
- **Dev mode:** global no-cache middleware — no stale bytes

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
