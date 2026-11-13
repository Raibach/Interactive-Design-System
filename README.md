# Interactive Design System Manager

## Demo: Wireframe interactive prototype
https://astragalar-santa-unbelligerently.ngrok-free.dev
Demo pin: (see resume)

> The **A2UI Protocol v0.9.1 implementation & conformance specification** — every normative requirement of the protocol mapped, file by file, to the code that implements it.

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

## Accessibility Contract: A Gate, Not an Audit

**Accessibility requirements travel with the component.** The Figma ingest carries four declarations beside every component it proposes — role, label, keyboard behavior, and screen-reader announcement — each with the source it came from. The contract is not a report written after the interface ships; it is a condition of the component entering the catalog.

- **The ingest reports; it does not change the design.** The deterministic reader measures the file exactly as it always has, and the declarations ride beside the measured facts. A missing declaration is named in the preview and in the conversation, and the drawing is still shown.
- **Approval is the gate.** A component whose contract is incomplete is refused with HTTP 503 before the catalog is written. The refusal names every missing declaration, the values that were found and their sources, and the annotation that supplies each missing one.
- **Composition follows the contract.** The server refuses a payload that names an uncertified component, and refuses one that omits a property the contract marks as required. An image cannot be sent without its description, and an icon-only control cannot be sent without its name.
- **The standard is the standard.** Every WCAG identifier is checked against the machine-readable WCAG 2.2 standard vendored in `backend/standards/`. A criterion the standard does not contain is a finding, not a silent pass.

The full design, the four declarations, and the approval refusal are in [`ACCESSIBILITY-CONTRACT-PLAN.md`](frontend/src/rooms/design/tools/ACCESSIBILITY-CONTRACT-PLAN.md).

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


> **This section's argument, written out as doctrine:**
> [`AGENTS-instructions/READ-ME/THE_SELF_REPORTING_SYSTEM.md`](AGENTS-instructions/READ-ME/THE_SELF_REPORTING_SYSTEM.md)
> — self-reporting, not self-healing; the failure vault; the morning brief; the
> seven-or-thirty-day window; the purge. When the code and the doctrine disagree, the
> code is wrong.

---

## Zero-Reasoning, Zero-Telemetry, Self-Reporting

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

## Documentation

- [`Core-Concept.md`](AGENTS-instructions/Core-Concept.md) — the A2UI operating rules: the architecture facts, the three layers and the component rules
- [`THE_ZERO_TRUST_REPAIR.md`](AGENTS-instructions/THE_ZERO_TRUST_REPAIR.md) — the zero-trust repair record, written from measurements
- [`CHANGELOG.md`](frontend/src/rooms/design/CHANGELOG.md) — the Design room's record: the current work, the audit and the repair plan
- [`THE_CONVERSATION_CONTRACT.md`](AGENTS-instructions/THE_CONVERSATION_CONTRACT.md) — how the chat and the console behave, as invariants

---
