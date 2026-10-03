# Interactive Design System Manager

> **Deterministic runtime protocols, data schemas, and governance architectures — One surface. Any payload. AI fills the slots.**

**Raibach Interactive Design Studio** · John Holt  
Version **0.9.1** · A2UI Protocol Compliant · 2026-10-02

A prompt-package lifecycle workspace built on the A2UI (Agent-to-User Interface)
protocol: the AI assembles every screen at runtime from a trusted component catalog —
no static pages, no hardcoded layouts — and every component in a payload is validated
against that catalog before anything renders. This repository is the reference
implementation: the protocol, the runtime, the catalog, and the surface that draws
them.

## Demo: Wireframe interactive prototype

The hosted demo is **shared privately with reviewers** — the URL and pin come from
the owner, not from this page. It is **locked, server-side**: the pin is a doorman,
not the lock. Whoever gets past it lands in a sandbox seat that can chat, assemble,
and edit its own cloned packages — and cannot delete, publish, ingest, or reach
anything of the owner's, because the backend refuses those calls outright. On a local
run the lock is off and the full system is the point; the mechanisms, the sandbox,
and the environment are in [The Demo's Lock](#the-demos-lock-demomode) below.

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
| **The Server Is the Lock** | The demo's restrictions live in the backend (`demo_policy.py`), never in the browser. The frontend only hides the affordances the gate already refuses; a client that lies about the demo changes its own buttons and nothing else. |
| **Fail Loud** | Invalid AI responses → 503 with diagnostics. Database down → 503. Empty Figma spec → 503 with exact reason. Never silently degrade. |
| **No Executable Code** | `eval()` eliminated. `innerHTML` blocked. Buttons dispatch declarative `a2ui:action` events only. |
| **Package-First** | A composer creates the draft package row on mount. Chat is scoped from keystroke one. |
| **Honest Code** | Comments tell the truth about what the code does. If something is hardcoded, the comment says so. No "AI is the Architect" over fixed layouts. |

---

## Component Catalog

62 trusted components — 17 A2UI Basic Catalog primitives + 45 project-specific Lit elements — typed with `ChildList` / `DynamicString` per validator rules. This number is measured from `catalogs/prompt-composer/catalog.json`; `npm run catalog:check` compares the docs against the catalog and reports a count that has drifted as a `doc-claim-drift` finding (`blocking` is that finding's severity — which row to read first — not a veto: the check reports and never gates, and exits 0 whatever it finds). That check is run on request and is NOT part of `npm run build` — the build is `tsc -b && vite build`. The live count is printed at backend startup (`✅ A2UI Catalog loaded — 62 trusted components`).

```
A2UI Basic:     Column · Row · Text · Image · Button · Card · ActionGroup
                SectionEditor · DecisionDialog · ConsoleCardGrid
                CompiledOutput · ChatPanel · TraceFeed · AgentFlow
                AgentCanvas · OutputControls · CanvasFooter
Workspace:      workspace-layout · prompt-section-editor · compiled-output-viewer · draft-canvas · design-system-picker
                chat-panel · chat-header · trace-feed · agent-flow · agent-canvas · output-controls · canvas-footer · chat-repair-actions
                version-trace · token-cost-readout · status-readout
                output-panel · search-bar
                filter-pill · footer-bar · chat-navigation-bar · agent-card
                prompt-section · control-bar · add-section-button
                ai-surface-sandbox · error-banner · prompt-container
                prompt-input-section · gripper-prompt-input · role-dropdown
                role-tile · status-bar-prompt-input · prompt-textarea
                model-selector-button · user-response-bubble
Design room:    design-left-panel · design-middle-container · component-preview · draft-preview
                figma-ingest-form · catalog-ingest-form · figma-layers-view
```

The Design room keeps its **own** catalogue (`catalogs/design-artifacts/`, 63 components) — one catalogue per surface, each the gate for its own payloads, resolved at ask-time from the directory itself (`deps.a2ui_catalog_for`).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18 + Lit 3.x (hybrid) · Vite · npm · Tailwind · TypeScript |
| **Backend** | FastAPI · PostgreSQL 15 · Zilliz Cloud (Milvus) · DeepSeek hosted API — one model for every mode |
| **Components** | Lit Web Components (Shadow DOM) · Figma API spec-driven |
| **Deploy** | Docker · Northflank (`semantic-design-systems`, `nf-europe-west`) |

---

## Repository Layout

```
backend/
├── main.py              # App setup, startup, router includes, the demo gate's registration
├── deps.py              # A2UI catalog loader, shared helpers, the demo identity pin
├── demo_policy.py       # The demo lock: deny-by-default policy tables + rate buckets
├── check_demo_policy.py # Policy-vs-routes drift check (run before a deploy)
├── seed_demo_data.py    # Seeds / resets the demo sandbox (clones, project, user)
├── services.py          # Database service startup
├── figma_service.py     # Figma API → Lit spec extractor
├── grace_gui.py         # AI system prompts & assembly logic
└── routes/              # 14 topic routers
    ├── ai.py                # Manifest, assemble-surface, save, audit
    ├── conversations.py    # Conversation + message CRUD
    ├── prompt_sessions.py  # Packages, versions, permissions
    ├── projects.py         # Project CRUD
    ├── memory.py           # Memory storage (dictation)
    ├── figma.py            # Figma API proxy, catalogue ingest
    ├── figma_intake.py     # Governance intake runs
    ├── milvus.py           # Zilliz/Milvus vectors
    ├── agent_rpc.py        # JSON-RPC 2.0 agent integration
    ├── teacher.py          # Teacher query, model ensure
    ├── auth.py             # Login, signup, users
    ├── governance.py       # Inspection runs
    ├── misc.py             # Health, config, news, PDF, reasoning
    └── files.py            # Documentation file I/O, repair read/apply

frontend/
├── index.html               # The shell — carries a static twin of the sign-in gate
│                            #   (drawn before any JS; main.tsx removes it on mount)
├── src/
│   ├── App.tsx              # Root app with routes
│   ├── components/
│   │   ├── A2UI/            # A2UI surface container + per-surface catalogs
│   │   └── lit/             # Lit web components (agent-card, workspace-layout, …)
│   ├── pages/               # WritingAreaIndex (main surface)
│   ├── hooks/               # React hooks
│   └── shared/              # Surface contract, tag registry, demo flag (demoMode.ts)
└── scripts/                  # Manifest generator, Figma sync, catalog check
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

- **Health:** `GET /api/health` → `{"database":"connected","milvus":"connected"}` (a real, paid model ping — not a free liveness probe)
- **Sign-in gate:** the local gate takes the team pin — the same one shared privately with the demo's reviewers
- **Local runs the full system:** with `DEMO_MODE` unset the identity pin and the policy gate are inert — `GET /api/config` answers `{"demo_mode": false}` — and a request's `X-User-ID` header is honored exactly as before
- **Caching:** the shell (`index.html`) is never cached; the hashed assets are cached immutable — a deploy takes effect on the next load with no hard refresh

---

## Deployment

Docker on **Northflank** — project `semantic-design-system`, service
`semantic-design-systems`, cluster `nf-europe-west`. The service builds from branch
**`demo-mode`** and redeploys on every push to it; `main` is untouched. The image is
a **multi-stage build**: the frontend compiles inside a Node stage (including the
catalog audit report), so no build artifacts live in the repository. To return the
service to plain `main`, point its build branch back (`northflank patch service
combined` with `vcsData.projectBranch: main`).

---

## The Demo's Lock (DEMO_MODE)

The public demo is one switch: `DEMO_MODE=1`, set only on the deployed service. Every
mechanism below is inert without it, and a local run never sets it — local is the
full system, on purpose.

**The identity pin.** `deps.get_user_id_from_header()` ignores `X-User-ID` entirely
when the switch is on and resolves every request to the demo user (`DEMO_USER_ID`).
The frontend still sends its constant; the server never reads it. That is also what
repairs `/api/teacher/query`, which called the resolver with no argument and
therefore wrote every demo chat turn as the owner.

**The gate** (`backend/demo_policy.py`, registered in `main.py`). Order: rate limit →
pass-list → policy. Mutations are **deny-by-default** against an allowlist named by
the app's own route templates (the chat turn, assembly, the demo's own packages and
their versions, the conversation writes, project create/rename) — prefixes are
deliberately not used, because `startswith("/api/prompt-sessions/")` reads as "the
demo may use its packages" and actually permits their deletion. GETs pass except a
denylist (the unscoped Milvus dump, source files, the reasoning trace, admin,
governance, and the Figma endpoints that dial the API or write source), with three
exceptions kept for the design rail: `/api/figma/activity`, `/api/figma/catalog`,
`/api/figma/config`. Refusals are 403s with a sentence a person can read.
`backend/check_demo_policy.py` asserts the tables still match `app.routes` — an
allowlist entry whose route was renamed is drift, named — and prints every mutating
route's demo disposition.

**The money.** In-process token buckets: the LLM-backed endpoints (`teacher/query`,
`assemble-surface`, `save-surface`, `confirm-exit`, `health`) are capped per visitor
(20 per 10 min by default) and **globally** (300 per hour — the backstop that bounds
the DeepSeek bill), other mutations 120 per hour per visitor. `GET /api/health` is
throttled *before* the pass-list precisely because it is a paid model ping. Limits
are environment-tunable (`DEMO_RATE_LLM_PER_KEY`, `DEMO_RATE_LLM_GLOBAL`,
`DEMO_RATE_MUTATION_PER_KEY`; format `N/seconds`).

**The sandbox.** The demo user owns cloned copies of packages the owner chooses:
`DEMO_SEED_SESSION_IDS` names the originals, `seed_demo_data.py` clones them
(versions, conversations, messages, the owner permission row, every pointer
remapped), and `--reset` throws the copies away and re-clones. The originals are
unreachable — the ownership predicates scope every list and read to the demo's own
rows — and a project row ("Demo Workspace") exists so the shell's first load finds
one instead of trying to create it.

```bash
python seed_demo_data.py                     # what it would do (dry run)
python seed_demo_data.py --apply             # create user/project, clone the sources
python seed_demo_data.py --reset --apply     # wipe the sandbox, re-clone
python seed_demo_data.py --list-sources      # the cards the console would draw, as a paste-ready id list
# inside the deployed container:
northflank exec service --cmd 'python seed_demo_data.py --reset --apply' \
    --project semantic-design-system --service semantic-design-systems
```

**Cards come from saved packages only.** The console reads its list with
`exclude_drafts=True` ("unsigned composer drafts never litter the console"), so an
unsaved draft never draws a card however many the sandbox holds — which is why
`--list-sources` prints exactly the set that renders, and why the seeded-count and
the card-count can legitimately differ.

**The shell side is cosmetic.** `GET /api/config` says which build this is; the
frontend (`shared/demoMode.ts`) reads it once before the first render and hides the
affordances the gate refuses (card/menu/chat deletes, Repair, the ingest forms, the
debug routes). A client that lies about the flag changes its own buttons and nothing
else — the server consults it never.

**No blank page, down to the first byte.** The shell's oldest rule takes its
strongest form here: `index.html` carries a static twin of the sign-in gate —
colours, logo (inline data URI), the fixed `dev@local` — so the first paint *is* the
gate, never a white screen while the bundle streams (measured before the fix: 2.2 MB
of JS, about 3 seconds of white). `main.tsx` removes the twin one frame after React
commits.

**And the gate's JavaScript is its own small bundle** (2026-10-02). The entry used to
carry the whole application — every Lit registration, the surface, the pages — so the
gate could not be *typed into* until ~2.5 s of script had arrived. The registrations
live in `components/lit/register` (imported by the app's own page, still before any
surface assembles), the pages are lazy, the composer's ground travels with them, and
`manualChunks` keeps the React family in the entry while every other dependency rides
behind the pin. Whatever waits — the config read, the app chunk for a session already
signed in — shows `GateSplash`, the same card, so the whole boot reads as one slow
gate that becomes typeable.

Service environment: `DEMO_MODE=1`, `DEMO_USER_ID`, `ADMIN_USER_IDS` (the admin stub
is allow-all when unset), `DEMO_SEED_SESSION_IDS`; optionally `DEMO_USER_EMAIL` and
the three rate-limit variables.

---

## Documentation

- [`READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md`](READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md) — Live-verified compliance ledger
- [`CHANGELOG.md`](CHANGELOG.md) — Release history

---

## Roadmap

- **Phase 3:** Generic adjacency-list renderer + JSON Pointer data binding
- **Phase 4:** Remaining docs cleanup, advanced contributor workflows

---

*"The interface never changes. The AI delivers different levels of access. That's the architecture."*
