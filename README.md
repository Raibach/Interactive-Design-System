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

## Documentation

- [`AGENTS-instructions/THE_METHOD.md`](AGENTS-instructions/THE_METHOD.md) — Live-verification design engineering: the working doctrine
- [`AGENTS-instructions/READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md`](AGENTS-instructions/READ-ME/A2UI_TRUE_VS_FAKE_AUDIT.md) — Live-verified compliance ledger
- [`CHANGELOG.md`](CHANGELOG.md) — Release history (includes the DeepSeek restoration battle)
- [`SECURITY-AND-COMPLIANCE.md`](SECURITY-AND-COMPLIANCE.md) — The compliance gate and its limits
- [`USER-FLOW.md`](USER-FLOW.md) — The journey the gate governs

> The documents above are the ones that exist in this repository.

---

*"The interface never changes. The AI delivers different levels of access. That's the architecture."*
