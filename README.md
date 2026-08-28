# Interactive Design System Manager

> **Deterministic runtime protocols, data schemas, and governance architectures - One surface. Any payload. AI fills the slots.**

**Raibach Interactive Design Studio** · John Holt  
Version **0.9.1** · A2UI Protocol Compliant · 2026-08-01

> ### 📘 Read this first: [`SPECIFICATIONS.md`](SPECIFICATIONS.md)
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

## Overview
 Sovereign Strategy (Deterministic AI IDS / Open-Source Architecture): Your framework is completely decoupled from the model type. Because your React wrapper shell is a deterministic, local guardrail, an enterprise can swap out a public API for a lightweight, independent model running completely on-premise or within their own private environment.By keeping the framework model-agnostic, you hand the enterprise total custody back. They don't have to surrender their entire structural design system or machine telemetry to a third-party cloud pipe just to use agentic automation.When you present your architecture to an enterprise client, this is the ultimate structural compromise: They can maintain their massive cloud networks, their proprietary MCPs, and their centralized infrastructure, but it must terminate at your zero-trust gateway. Your system acts as the sovereign firewall that hosts, translates, and validates their designs and components locally before any external cloud service can touch them.This directly solves the ultimate corporate fear: it lets them leverage AI capabilities without giving up the keys to their operational kingdom.

A **prompt-package lifecycle workspace** built on the A2UI (Agent-to-User Interface) protocol. The AI assembles every pixel at runtime from a trusted component catalog — no URL routing, no static pages, no hardcoded layouts. Navigation is an AI command that returns a spec-compliant envelope through a single unified endpoint.

**The product:** prompt *packages* — configuration + conversation + execution trace + governance metadata — bundled as one versioned, shareable, contributor-owned unit. The package is the aggregate root; the user is not the package.

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

28 trusted components — 12 A2UI Basic Catalog primitives + 16 project-specific Lit elements — typed with `ChildList` / `DynamicString` per validator rules. The live count is asserted at backend startup (`✅ A2UI Catalog loaded — N trusted components`) and specified in [`SPECIFICATIONS.md`](SPECIFICATIONS.md) §4.3.

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

- [`SPECIFICATIONS.md`](SPECIFICATIONS.md) — A2UI Protocol v0.9.1 implementation & conformance specification (requirements → code, verified status map)
- [`READ-ME/THE_METHOD.md`](READ-ME/THE_METHOD.md) — Live-verification design engineering: the working doctrine
- [`READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md`](READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md) — Live-verified compliance ledger
- [`CHANGELOG.md`](CHANGELOG.md) — Release history (includes the DeepSeek restoration battle)
- [`A2UI_CARD_CONTRACT.md`](A2UI_CARD_CONTRACT.md) — Card component data contract

---

## Roadmap

- **Phase 3:** Generic adjacency-list renderer + JSON Pointer data binding
- **Phase 4:** Remaining docs cleanup, advanced contributor workflows

---

*"The interface never changes. The AI delivers different levels of access. That's the architecture."*
