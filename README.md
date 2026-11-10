# Interactive Design System Manager

> **One surface. Any payload. AI fills the slots.**

**Raibach Interactive Design Studio** · John Holt  
Version **0.9.1** · A2UI Protocol Compliant

An AI-native interface system. A deterministic shell holds the frame — navigation, layout, error
and loading states — and the AI fills the slots inside it from a trusted catalogue of components.
It does not invent screens; it composes them, and a name outside the catalogue is refused.

## See it

**Request pin access.** The studio runs on a private instance; ask for the pin through
[john.holtportfolio.com](https://john.holtportfolio.com) and the demo opens on the doors described
below.

What you are looking at is six rooms behind one navigation — **Console, Composer, Design, Product,
Development** and **Governance** — each with its own chat, its own working area, and its own way of
being assembled. The shell is the same in every room; only what is inside it changes.

This document describes the product. It is not a developer guide: this repository is a
demonstration of the work, not a codebase open for contribution.

## The one idea

The interface never changes. The AI delivers different levels of access. Everything below is a
consequence of that sentence.

---

## Architecture: React Shell + AI Surface

This project follows the **React Shell + AI Surface** pattern — the emerging industry standard for AI-native applications.

- **The React Shell**: Handles deterministic UI, routing, authentication, and design system consistency (React, TypeScript, Tailwind, shadcn/ui).
- **The AI Surface**: Manages dynamic content generation, intent classification, and multi-modal interactions (text, image, speech) embedded within the shell.

**Non-negotiable: the user must never stare at a blank page.** The deterministic shell always renders — navigation, frame, error states, slot containers — regardless of what the AI does or doesn't do. The AI fills slots *inside* a shell that already exists. If the AI fails, the shell shows the failure. If the AI is slow, the shell shows a loading state. The shell is never absent.

## Why the usual AI-governance layer is largely not needed here

The AI-governance question is drift and grounding — is the system's behaviour shifting away from a
baseline over time, and is the answer actually supported by what it read. Add quality and
regression evals, plus cost, latency and trace logging. That layer exists because an open-ended
generative system cannot enumerate its possible outputs, so you watch statistics forever.

It is largely unnecessary here. The model composes only from the human-curated catalogue, and a
name outside it is refused loudly — so drift stops being a statistical thing to watch and becomes
a binary violation to reject. For structure, classical drift monitoring is obsolete as a method.
What genuinely remains — the free-text layer — is judged per run and written down as a row, not
watched as a graph.

> **The failure doctrine:** [`AGENTS-instructions/READ-ME/THE_SELF_REPORTING_SYSTEM.md`](AGENTS-instructions/READ-ME/THE_SELF_REPORTING_SYSTEM.md)
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
Conformance: the deterministic stand-ins for structure-drift — the catalogue gate, the fidelity gate, and the catalogue check.
So the honest shape of an "AI governance level" for this system: structure is governed by the boundary (binary), and the free-text layer is governed by the per-run judge — which is already writing rows. Those rows are also why your queue item #1 was run_evaluations: I verified its semantics tonight (writer, routes, judge, surface) — the next step per the queue is to own / describe / test that chain inside the room, so the AI ledger is curated content, not just ingested tables.

---

## Systems Overview: MCP Pipelines and Independent Model Governance

**The external capture (the MCP pipelines).**
Cloud providers ship MCP servers that connect corporate production workflows to their own clouds.

**The internal alternative (model-agnostic RIDS).**
This system is built on open standards (A2UI, MCP) with no dependency on one model provider. The shell is the gatekeeper, so data stays inside the enterprise's own pipelines and models can be replaced without giving up the component tree or the production logic.

This is a reference implementation with no production payloads. The governance rules, the catalogue checks and the protocol conformance are implemented and can be re-run on request; populating payloads is ingestion.

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

## How it is built

Every room draws into three seats: a working area on the left, the compiled result in the
middle, and the conversation on the right. The AI decides what fills those seats; it never
creates or removes them.

Four rules hold the whole thing together:

- **The shell is never blank.** Navigation, frame, error states and loading states always render.
  If the AI fails, the shell shows the failure; if it is slow, the shell shows the wait.
- **The AI fills slots; it never invents the frame.**
- **Unknown is refused, not guessed.** A component outside the catalogue is a loud refusal with
  the reason, never a silent fallback.
- **The record tells the truth** — including about what has not been built yet.

---

## The catalogue is the contract

Sixty-six components stand in the Composer's catalogue, each typed and validated before anything
is drawn, and every surface carries its own — the Composer's, the Design room's, and the
primitives both are built from. The AI composes from a fixed set of known parts instead of
writing screens. Adding a component is a deliberate act: it is drawn in Figma, ingested through
the design seat, and approved before the model may use it.

---

## What is in this repository

The core of the studio and the first three rooms — **Console, Composer and Design** — with their
seats, their components, their assembly logic and their records.

The programs the other three rooms frame (the analytics application, the development agent, the
governance observatory) are third-party work that runs beside the studio. They are deliberately
not in this repository.

## Built with

React and Lit on the front, Python (FastAPI) and PostgreSQL behind it, a component catalogue as
the contract between them, and DeepSeek as the model that fills the slots.

---

## What is already real, and what is not

**Built and measured.** Grounding is judged per run in plain English — one row per run, cleared or
failed, with the judge's written sentence. Cost is recorded per call and priced. Assembly is
constrained by the catalogue, so structure is checked by the boundary rather than watched over
time.

**Designed, not shipped.** The compliance gate — design, product and one developer verdict before
anything reaches a front end. The customer-side measurement — a served-at timestamp, a component
identity on every interaction, a session that survives the journey. Both are written down as
doctrine; neither is built.

That distinction is deliberate. A demonstration that claims more than it does is worth nothing.

---

## Sovereign shell audit 2026-10-24

> This is the working audit, kept in the top-level README for visibility. The product
> description above is the introduction.

2026-10-24. Read-only: this audit changed no code. Every claim was read in the code.

The room records hold the detail. [Design](frontend/src/rooms/design/README.md) and
[Product](frontend/src/rooms/product/README.md) are the room-level READMEs; this audit is the
global summary.

### The standing check — run at the start of every refinement turn

The shell is the first thing to inspect, before the next room is touched. These commands are the
check, in order:

```
wc -l frontend/src/pages/WritingAreaIndex.tsx
rg -n "useTabGate|handleTabChangeWithGate|room-handoff-cover|DesignRoom|designTree|designRendererRef|useDesignSurface|useDesignPreview" frontend/src/pages/WritingAreaIndex.tsx
rg -n "ProductBox|ConsoleBox|DesignBox|GovernanceRoom|DevelopmentRoom|useGovernance|useDevelopment|workspaceTree|assembleGovernanceSurface" frontend/src/pages/WritingAreaIndex.tsx
rg -n "workspace-layout|product-workspace" frontend/src/rooms frontend/src/pages
rg -n "from ['\"]@/(components|shared)" frontend/src/rooms/<room>
npm run typecheck
```

What each must show:

- the gate/design names: **nothing**. The first line must be empty.
- the room names: only the boundaries the room has not yet taken. Any room-specific state, effect
  or hook is a finding, not a baseline.
- the workspace lines: the wrapper each room actually draws. A room on the shared wrapper is a
  finding until its own wrapper is in place.
- the shared imports: the drawing pieces the room may share, and the behavior it must not.
- the typecheck: zero.

A turn that does not run the check does not start.

### The shell today — 4,154 lines

*Updated 2026-10-24 after the Design residue was removed from the shell: the shell is 4,154
lines. The Design row and the count are current; the other anchors below shifted with the cuts
and are approximate.*

| block | anchors in `WritingAreaIndex.tsx` | verdict | next |
| --- | --- | --- | --- |
| Design | `DesignBox` mount 4139; the design-boundary comment 8–11; the tools-door comment 3594; sandbox condition 4018 | the box is clean; the sandbox no longer mounts for Design; only the import and mount remain | done 2026-10-24; details in [rooms/design/README.md](frontend/src/rooms/design/README.md); the shared design wrapper is the next structural cut |
| Governance | `GovernanceBox` mount 4156; nav boundary 4000–4002; path/navigate state 354–355 | the box, container, trace hook and nav boundary own it; the shell keeps the nav and the mount | done 2026-10-24 |
| Development | refs 674–675; type imports 79–80; `useDevelopmentRoom` 3391; sandbox arm 4097–4099; ground 33/353–365 | the room and hook are in the folder; the shell owns the refs, hook call, ground and sandbox arm | [PLAN-sovereign-development.md](frontend/src/rooms/development/PLAN-sovereign-development.md); after it, the sandbox holds only the Composer |
| Product | `pendingProductAction` 187; the card door 3577; `ProductBox` 4581 | boxed; the boundary still passes the card action and the shared draft/chat helpers | decide the card door's owner; move the helpers |
| Console | `isAIAssembling` 255; the failure flags 256–260; `ConsoleBox` 4589; the shared assembly and tree refs | boxed; its assembly, failure and tree boundary are still shared with the Composer | move the console's assembly and failure into the room; the Composer's shared door remains |
| Composer and shell | `workspaceTree` 283; `surfaceDataModel` 511; the sandbox renderer and the assembly | the last room; after Development, the sandbox holds only the Composer | box the Composer; delete `ai-surface-sandbox`, its slot routing, `SELF_GATED_ROOMS` and the assembly; the shell becomes navigation |

#### Already clean

- No `useTabGate`, no `handleTabChangeWithGate`, no `room-handoff-cover` anywhere in the code.
- No design tree, renderer, preview, surface hook or width effect in the shell. The Design tab is a
  `DesignBox` mount and nothing else.
- The typecheck is zero.

#### Stale or dead, and therefore a finding

- `assembleGovernanceSurface` is no longer in the shell. On 2026-10-24 it moved with its tree and
  its dead renderer effect to `rooms/governance/useGovernanceSurface.ts`, the room's own door. It
  is still not called; the application's own loader is the room's opening.
- The `data-room-root` markers in `ProductRoom`, `DevelopmentRoom`, `ConsoleBox` and `DesignBox`
  have **no reader** now that the gate is deleted. They were the gate's contract. Keep the keys;
  the markers are inert and should be removed with each room's next cut or kept only as a naming
  convention, stated once.
- The `rooms/product/README.md` still lists `useProductGate.ts`, `useGuardProductExit.ts` and
  `useDiscardProductProject.ts`, which are gone. The room's docs are part of the audit's cleanup.

### The shared and external dependencies, by box

| box | its own files | shared structural file | shared behavior | external or cross-room |
| --- | --- | --- | --- | --- |
| Product | `product-workspace` (2,211), `product-chat-panel`, `ProductBox`/container | none for the wrapper; the shared chat parts are drawings | `room-embed` in the middle; the card door | the builder frame; `useOpenCardFromConsole` |
| Console | `console-chat-panel`, `ConsoleBox`/container | `workspace-layout` (shared) | the shared `assembleSurfaceThenRepairs`, the failure flags, the card door | the card door; the Composer's shared assembly |
| Design | `design-chat`, `design-renderer`, `DesignBox`/container, `tools`, `ux` | `workspace-layout` (shared) | `actionLink`/`promptSections` still imported by `design-chat`; shared chat parts | `tools-tab`/`figma-*`; `ux-app-frame`; the PostHog app; the card door |
| Governance | `governance-chat-panel`, `GovernanceRoom` | `workspace-layout` (shared, used directly in `GovernanceRoom.tsx:125`) | the shell's `useGovernanceChrome`/`useGovernanceRoom` and trace effects; the evals seat | the embedded application; `evals-mount` |
| Development | `DevelopmentRoom`, `useDevelopmentRoom` | `workspace-layout` (shared, used directly in `DevelopmentRoom.tsx:45`) | **the shared `<chat-panel>`**; the shell calls its hook | the builder frame |
| Composer | the shell's own room | `workspace-layout` (shared) | **the shared `<chat-panel>`**; `actionLink`/`promptSections`; the assembly | none; it is the shell's default room |

The shared parts the seats import — `chat-header`, `chat-messages`, `chat-input`,
`chat-action-bar`, `chat-navigation-bar`, the folds — are **drawings** and stay shared. The seat
file is the behavior and must be the room's. The table shows where that rule is met and where it is
not.

### The `workspace` finding — the global wrapper

This is the file the owner remembers.

- `frontend/src/components/lit/workspace-layout.ts` — 2,211 lines. It owns the three-column split,
  the pane widths, `isThirdOpen`, `chatLoadWidth`, `splitEqually`, the grips, the collapse and the
  right column's over-state.
- `frontend/src/rooms/product/product-workspace.ts` — 2,211 lines, the exact copy under the room's
  own tag. `ProductRoom.tsx` imports it and mounts `<product-workspace>`. Product is insulated.
- Development and Governance mount the shared `<workspace-layout>` directly. Design and the Console
  receive it through their surfaces; the Composer receives it through the sandbox. Their surface
  roots name the shared tag, and their rooms write its properties:
  - Product: `chatLoadWidth = 600`, `isThirdOpen = true` (`ProductRoomContainer.tsx:123–124`).
  - Development: `isThirdOpen = false` (`useDevelopmentRoom.ts:46`).
  - Governance: `isThirdOpen = false` (`useGovernanceRoom.ts:47–48`).
  - Design: the tree root carries `isThirdOpen: true` (`DesignSeatShell.tsx:315–318`).
  - Console: the console's tree root carries `isThirdOpen: false`.
  - Composer: the shell writes `chatLoadWidth = 650` and calls `splitEqually` on the shared layout.

One class, six rooms. A change to the shared file changes every tab's wrapper at once. The Product
copy is the proof that the room can own it. This is the nightmare the owner named, and it is still
in place for five of the six rooms.

The audit's recommendation:

- **Every sovereign room owns its wrapper.** Copy `workspace-layout.ts` into the room under the
  room's tag (`design-workspace`, `console-workspace`, `governance-workspace`,
  `development-workspace`), exactly as Product did. The room's tree maps the catalog's trusted
  `workspace-layout` name to the room's tag at the room boundary, the same way `chat-panel` is
  mapped to `design-chat`. The server and the catalog do not change; the client resolves the name
  to the room's element.
- **The Composer keeps the shared layout until it becomes a room.** The shared file is the
  Composer's own wrapper and the source from which the copies are made.
- **The trade is recorded:** each copy is 2,211 lines and must be kept in step for a shared drawing
  fix. The owner's priority is sovereignty over deduplication; Product already accepted the cost.
  If the duplication becomes the problem, the next step is to split the shared file into a
  drawing-only base and a room wrapper; that is a later cut, not this one.

The first cut is Design: `rooms/design/design-workspace.ts` as the copy, the design tree mapped to
it, the design's chat width and column state written on the room's element. Then the Console, the
Governance room and the Development room. The Composer is last.

### The seats

- Product, Console, Design and Governance each draw their own seat file. That is correct.
- Development draws the shared `<chat-panel>`; it is not a full sovereign box yet. Its own room
  folder has the package and the rail list, but the seat is shared. It needs its own copy before it
  can be called sovereign.
- The Composer draws the shared `<chat-panel>`; it is the shared seat's owner until the Composer
  leaves the shell.
- The Design seat is its own file, but it still imports the Composer's writing acts
  (`parseWriteSeatAction`, `parseRunAction`, `parseSaveAction`, `parseSetTitleAction` and the rest
  from `shared/actionLink`, plus `shared/promptSections`). That is shared **behavior**, not a
  drawing. The Console copy severed it; the Design copy still carries it. This is the Stage 5 cut
  in the Design plan, and the audit confirms it is still present.

### The shared drawings and the external applications

- `a2ui-renderer.ts`, `tag-registry.ts` and the catalogues are the shared drawing contract. They are
  unavoidable for an A2UI surface. The room's boundary must map a trusted catalog name to the
  room's own element when the room owns that element; a change to the resolver or the catalog can
  affect every room, so a resolver change is audited like a shared drawing change.
- `room-embed.ts` (626 lines) is the shared embed for the flow/canvas; the Product, Console and
  Design chat panels use it, and the Composer's middle uses it. It is a drawing with slots, but a
  change reaches all three rooms. Keep it in the audit's shared list; a room that needs different
  behavior gets its own copy.
- `builder-embed` (the builder), `ux-app-frame`/`posthog-master` (the analytics application) and the
  Development app are external applications behind frames. They are not frontend state owners. The
  PostHog app is framed at `/posthog`; nothing imports its code.
- `shared/arrival`, `shared/autoAdvice`, `shared/error-registry`, `shared/uxCapture`,
  `conversationStorage`, `apiHelper` and `authService` are generic infrastructure. They are
  allowed; each room imports them directly and none of them owns a room's structure.
- `shared/actionLink` and `shared/promptSections` are the Composer's acts. A room seat that still
  imports them is carrying the Composer's behavior. The Design seat does; the Console seat does
  not; the Product and Governance seats are checked in their own cuts; the Development shared seat
  carries them by definition.
- `useOpenCardFromConsole`, `evals-mount` and the named window events (`navigate-console`,
  `navigate-tab`, `open-console`, `design-tools-open`, `a2ui:composer-opened`) are **cross-room
  doors**. They are allowed only when they are explicit, one-way and named. They are the seams the
  boxes use to reach each other; they are not a room's private state.

### What the shell still keeps that it should not

- The development room's hook call and refs. The hook lives in the room folder; the room can call
  it. The current plan is [rooms/development/PLAN-sovereign-development.md](frontend/src/rooms/development/PLAN-sovereign-development.md).
- The Product card action and the shared draft/chat helpers passed into `ProductBox`.
- The Console's assembly, failure flags and tree boundary, shared with the Composer.
- The Composer itself, which is the shell's default room and the owner of the shared seat/layout.
- The shell's A2UI sandbox. It is a temporary host, not a room. After Development leaves it, only
  the Composer mounts it; the Composer's box deletes it entirely.

### The next cuts, in order

1. The small corrections: the dead `data-room-root` markers and the stale Product README.
2. The Governance block is moved (2026-10-24): the room owns its box, container and traces.
3. The Development room: the [sovereign Development plan](frontend/src/rooms/development/PLAN-sovereign-development.md)
   moves its ground, refs, hook and sandbox arm out, then gives it its own wrapper and seat.
4. The Product and Console boundaries: the card door, the shared assembly and the failure flags.
5. The Composer: the last room. Its box deletes the A2UI sandbox, its slot routing,
   `SELF_GATED_ROOMS` and the shared assembly; the shell becomes navigation only.
6. In parallel, the room wrappers: Design first (`design-workspace`), then Console, Governance and
   Development. The Composer keeps the shared layout.

### The rule this audit leaves behind

A sovereign box owns its ground, its wrapper, its gate, its seat, its conversations and its
loading. It may use the catalog's drawings and the app's generic infrastructure. It may not use a
shared file that owns its structure, its state or its behavior. A cross-room door is named and
one-way. The shell is navigation and the rooms it mounts; everything else is a finding.


## Documentation

- [Sovereign shell audit](#sovereign-shell-audit-2026-10-24) — the shell and shared-dependency check
- [`AGENTS-instructions/THE_METHOD.md`](AGENTS-instructions/THE_METHOD.md) — Live-verification design engineering: the working doctrine
- [`AGENTS-instructions/READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md`](AGENTS-instructions/READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md) — Live-verified compliance ledger
- [`CHANGELOG.md`](CHANGELOG.md) — Release history (includes the DeepSeek restoration battle)
- [`SECURITY-AND-COMPLIANCE.md`](SECURITY-AND-COMPLIANCE.md) — The compliance gate and its limits
- [`USER-FLOW.md`](USER-FLOW.md) — The journey the gate governs

> The documents above are the ones that exist in this repository.

---

*"The interface never changes. The AI delivers different levels of access. That's the architecture."*
