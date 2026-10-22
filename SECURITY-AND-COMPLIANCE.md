# The Security and Compliance Gate

**Status: doctrine. The loop is not built yet.** This document states the loop, who contributes
to it, where drift actually enters, and what this layer deliberately is not. When the code and
this document disagree, the code is wrong.

The mechanical breakdown of the journey — stage by stage, who touches what, what becomes
measurable — is in [`USER-FLOW.md`](USER-FLOW.md). That one is the diagram; this one is the
principle.

---

## The loop is the AI. Humans are contributors.

**There is no human in the loop, and the design does not put one there.**

A loop is repetition, consistency and zero fatigue. People are the opposite of all three: they
hesitate, they drift, they are strict on Monday and tired by Friday. So the loop belongs to the
machine, and people are kept at its edge.

- **The human is the data source.** A person supplies the spark from outside — a business
  vision, a requirement, a reaction — once, and then steps back. That is a contribution to the
  loop, not a turn of it.
- **The loop runs on the machine.** Communications between stages, notifications, gate
  management, catalogue compliance and deterministic front-end assembly are the AI's work. No
  person carries the process forward, remembers what is waiting, or decides what happens next.
- **A checkpoint is an input event, not a blockage.** Where a person's judgement is genuinely
  needed — the instruction, the design review, the product decision, the hardening — the loop
  does not idle waiting for them. It records what the package needs, notifies, escalates, keeps
  running everything else, and takes the contribution as an event when it arrives.
- **Curation is the machine's job.** Curation is itself a loop, and humans curate badly: their
  taste shifts, their standards slip, their attention goes. The catalogue is therefore enforced
  mechanically — which components exist, which properties they declare, which bindings are
  legal — and never by feel.

This is also why the whole subject stays **security and compliance**. The moment a person is
inside the loop, their hesitation, their mood and their shortcuts become part of the system's
behaviour, and what you have is a compliance problem you cannot model or audit. Keeping them at
the edge, as contributors, is the security decision.

---

## Why two layers, and not one

There are two different questions, and they were being answered by one word.

**"Is this assembly allowed to exist?"** That is a *compliance* question. It has an answer
before anything ships, it is answered once per package, and three verdicts close it.

**"How is the running system behaving?"** That is a *governance* question. It has no answer
until there is traffic, it is answered periodically, and it is answered by numbers.

Conflating them is what produced the observability machinery we removed: a live heart monitor
for a system whose behaviour is decided in advance. This document separates them.

- **Compliance — the gate.** Before a package reaches a front end, it clears the checkpoints:
  design, then product, then the developer. This is the layer that enforces business logic. It
  runs at configuration time, per package, and it is the only place a human contribution is
  accepted.
- **Governance — thin.** After launch, governance keeps an eye on things: a periodic read of
  failed assemblies, provider walls, and evaluation verdicts. Monthly, or when an alert fires.
  It is not granular, it is not per-request, and it is not a trace viewer.

---

## Where the risk actually is: the assembly window

A surface is manufactured in one step: **the product person's prompt meets the static
catalogue.** The model receives a business instruction and a fixed set of Lit components, and
returns an assembly — components, order, bindings, values.

That window is the only place drift can be introduced, because it is the only place where
something is interpreted rather than executed. The failures it produces are specific and
recognisable:

- a data field bound to the wrong slot in a component;
- a string handed to a property that expects a number;
- a parameter misread from the prompt;
- a component chosen because it is close, when the right one exists and was not picked;
- a value that satisfies the schema but contradicts the business rule.

None of these are visible in production traffic, because production does not re-interpret
anything. They are visible **once**, at the moment of assembly, to whoever is looking.
---

## Who is in the room

A product person does not sit in a dark office inventing features. They sit in a garden with a
latte, thinking about how the business could serve customers better, and they write that
thought down as an instruction:

> *"Please present this coupon to the customer at checkout, using this database of preferred
> customers from our premium list."*

That is the start of the loop, and everything downstream exists to protect it — to make sure
what ships is what they meant.

**Three departments contribute to this loop.** They already exist as roles in
`backend/role_caps.py` — **product**, **ux-design**, **governance**:

| Department | Owns | Answers |
|---|---|---|
| **Product** | the business instruction | *what should happen, and for whom?* |
| **Design** (research included) | compliance, accessibility, experience, evidence | *is this acceptable to ship to a person?* |
| **The developer** (console operator) | hardening and launch | *is it correct, and is it live?* |

### Research is not a department

**Design is research.** Research is not a fourth column in this loop and it is not a section of
its own — it runs through every phase of the application, and every phase has its research
layers. The `research` role in `backend/role_caps.py` is a capability profile, not a stage.

What changes from phase to phase is the *name* of the layer and whose question it answers:

| Whose question | The layer is called | It looks like |
|---|---|---|
| Product's | **research** — discovery | what the customer actually needs; feedback and surveys |
| Design's | **research** — validation | A/B tests, putting it in front of real users, reading the reaction |
| The developer's | **a spike** | a time-boxed investigation: *can this be done, and how* |
| The CTO's and the CEO's | **compliance, security, oversight** | the record of who approved what, the walls, the audit trail |

A spike is a developer's research. Discovery, feedback and surveys are research for product.
Compliance, security and oversight are research for the CTO and the CEO in the business. It is
the same instinct at every layer — find out before you commit — and the difference is who is
entitled to ask, and what evidence settles the question.

---

## The loop

The machine drives. The diagram separates two things that look alike in a process drawing and
behave nothing alike: **what the loop does**, and **where a person contributes**.

```
    ───────────────────────────────────────────────────────────────────────────────
    THE LOOP — run by the AI, never waiting on a person
    ───────────────────────────────────────────────────────────────────────────────

    AI — INTAKE
    reads the contributed instruction, creates the package, versions it, queues it,
    notifies the first checkpoint. Nothing is lost, and nobody has to remember it.

                              │
                              ▼
    AI — ASSEMBLY
    the instruction meets the static Lit catalogue and a candidate assembly is produced
    from components that exist. No invented component, no generated markup, no code.
    Then the mechanical checks, which are the machine's and not a matter of taste:
    every component in the catalogue · every binding legal for its property type ·
    every value inside its schema · nothing named that does not exist.

                              │
                              ▼
    AI — ROUTING, NOTIFICATION, ESCALATION
    the package is carried to its next checkpoint, the right person is told, and an
    unanswered checkpoint is escalated. The loop does not stall: it keeps running
    everything that does not depend on that answer.

    ───────────────────────────────────────────────────────────────────────────────
    THE CHECKPOINTS — contributions, outside the loop
    ───────────────────────────────────────────────────────────────────────────────

    CONTRIBUTION 1 — PRODUCT
    writes the business instruction — "present this coupon at checkout for the premium
    list" — and steps back. Research layer: discovery — feedback, surveys, what the
    customer actually needs.

    CONTRIBUTION 2 — DESIGN
    reviews the candidate against compliance standards and disability/accessibility
    standards; contributes corrections as changes to the instruction, never as a
    hand-carved surface; runs A/B tests and real-user feedback; files the analysis on
    the package. Research layer: validation.

    CONTRIBUTION 3 — PRODUCT
    reads the analysis and contributes the decision: this is what I meant, or it is not.

    CONTRIBUTION 4 — THE DEVELOPER
    hardens the package against the registry, checks it against the instruction, and
    launches it. Research layer: a spike, when a question is still open.

                              │
                              ▼
    AI — FREEZE AND SERVE
    the contributed verdicts are recorded against the package, the package is frozen,
    and production reads the frozen record. Nothing is re-derived at runtime.

                              │
                              ▼
    AI — MEASUREMENT
    the customer's interaction is recorded against the component and the package. The
    ledger for the CTO and the CEO: compliance, security, oversight.
```

**The AI runs the approval process; it does not render the verdict.** Routing, sequencing,
reminders, escalation, recording, catalogue membership, property types, refusing a package that
fails a check — all of that is mechanical, and all of it belongs to the machine. The verdict
does not. A machine that approves its own assembly is not a control, it is a mirror. That is the
one boundary in this document that cannot move: automation makes the loop fast, it does not make
it a witness.

**Each contribution changes the artefact in the medium it owns.** Product owns the instruction.
Design owns the instruction *and* the catalogue. The developer owns the hardened record. Nobody
reaches into the next checkpoint's medium, and no change is silent — a change at any checkpoint
returns the package to the mechanical checks before it moves again.

**What a contributor is judging.** That the assembly does what the instruction says: the right
components, the right bindings, the right values, in the right order — and that everything it
names exists in the catalogue with the property types it used. Nobody is reviewing the model;
each is reviewing the *result* against the *instruction*.

**What "frozen" means.** The package carrying its three verdicts becomes the record production
reads. The instruction is not re-sent, the model is not re-consulted, and nothing at runtime can
produce a different arrangement. The prompt, the components and the catalogue are the law; the
frozen package is the ruling.

**When drift is expected.** On the first assembly, and mostly only there. The loop is positioned
to catch it then: the candidate is checked mechanically, seen, corrected, run, seen again — and
only then does it move to the next checkpoint.

---

## The catalogue gap — where the design seat earns its place

Sooner or later the instruction needs something that does not exist:

```
    the assembly needs a component that is not in the catalogue
                              │
                              ▼
    DESIGN goes to Figma and designs a solution that matches the branding
                              │
                              ▼
    back to the DESIGN SEAT in the application, and ingests those Figma designs
                              │
                              ▼
    the new components are added to the catalogue and tied to the business logic
                              │
                              ▼
    the whole package — the prompt package, the new components and their bindings —
    goes to the developer for final hardening and launch
```

The catalogue is therefore a governed artefact, not a dumping ground. Adding to it is a
deliberate act, and the package that carries the addition carries the instruction it exists to
serve — so the developer receives one thing to harden, not two unrelated changes.

This is also where a **spike** legitimately appears before the developer stage: a question such
as *"can this binding be expressed at all with what the catalogue holds?"* is a developer's
research, and answering it early is cheaper than discovering it at hardening.

---

## Where the approvals live

**The Approvals tab.** It is already in the chat navigation — the approval icon is there, and
that is where this belongs. Not a new surface, not a second console, not a separate queue with
its own sign-in. The loop is read, discussed and signed in the place the operator already sits,
and the approvals conversation is its own thread so it does not mix with the chat.

The pieces around it already exist in the codebase:

- **departmental roles** — `product`, `ux-design`, `research`, `governance` in
  `backend/role_caps.py`, with tabs and tags filtered per role before the model is ever called;
- **the Approvals tab** as the governance console's fourth button, drawing findings and filed
  inspections, with the client-side slotted view `chat-repair-actions`;
- **the Figma ingest approval** — it records the components an approval wrote and refuses to
  approve when the compile verdict is not `ok`;
- **prompt packages** in the database, which the Approvals tab can open rather than describe.

What does **not** exist: the loop itself. There is no package queue, no checkpoint routing, no
notification or escalation, no verdict record per checkpoint, and no A/B result attached to a
package.

---

## What the gate is not

- **Not a runtime monitor.** It does not watch users. Production has no interpretation path to
  watch.
- **Not a trace viewer.** It reviews an assembly and its evidence, not a history of calls.
- **Not a dashboard nobody reads.** It is a record of decisions with names and dates on them.
- **Not a separate application.** It lives in the Approvals tab that already exists.
- **Not a human-operated process.** The machine runs it end to end; people contribute verdicts
  at the checkpoints and then step back out.
- **Not a substitute for governance.** It answers "may this exist", not "is the system
  healthy".

---

## The honest limits

**Three verdicts still mean three people agreed.** The loop is automatic; the verdicts are not.
If a contributor is rushed — or if the instruction was ambiguous to begin with — the frozen
record will faithfully encode the mistake. The loop makes drift *visible, attributable and
reversible*; it does not make it impossible.

**A fast gate is a rubber stamp.** Automating the routing makes approvals arrive sooner, and a
queue that empties quickly invites approving without reading. Speed is a property of the loop,
never a reason to shrink the review.

**A prompt-only tweak is a real limitation.** Because design changes the instruction rather than
the surface, design is constrained by what the assembly window can express. A required design
that no combination of catalogue components can produce cannot be "tweaked" — it is a catalogue
gap, and the gap loop is the only honest way to close it.

**Accessibility review is a person, not a check.** Disability standards are reviewed at the first
checkpoint by someone who knows them. Nothing in the system currently proves conformance; a
reviewer under time pressure will pass things that should not pass.

**A/B tests need volume.** Putting a surface in front of real users produces a signal only if
there are enough of them. A campaign with modest traffic will produce a result indistinguishable
from noise, and should be recorded as such rather than read as evidence.

**One developer at the gate is a throughput decision, not a security decision.** With a single
developer hardening and launching, the queue is the constraint: approvals delay launches, and a
backlog invites rubber stamping. That is a known cost, accepted — the answer is to keep a couple
of good developers around, because they are handy, not to remove the checkpoint.

**A research layer is not a checkpoint, and nobody signs it.** Discovery, A/B tests and spikes
produce evidence; they do not produce verdicts. If the evidence is thin, the verdict that relies
on it is thin, and the record will not show that. Only the reasoning in the package can.

**Schemas reject structure; only a person rejects meaning.** A validator can refuse an unknown
component or a string in a number slot. It cannot know that the coupon was meant for the premium
list and not the general one. That judgement is why each checkpoint needs a person at it.

**Catalogue gaps surface here first.** When an assembly needs a component that does not exist,
the checkpoint is where that is discovered — which is the correct place for it, and also the
moment someone must build the missing part.

---

## The rules this doctrine puts on the code

1. **The loop never blocks on a person.** It queues, notifies, escalates, and keeps running
   everything that does not depend on the answer. A stalled package is a system fault, not a
   waiting room.
2. **The AI never renders a verdict on its own assembly.** It may check, refuse, route, record
   and escalate; it may not sign. A package with no outside verdict is not approved — it is
   merely unopposed.
3. **No assembly reaches a front end without all three verdicts.** A candidate is a candidate;
   only a package that has cleared design, product and developer is served.
4. **Each verdict is a record, not a click.** Who contributed it, when, at which checkpoint,
   against which instruction version, and which assembly bytes — stored with the package.
5. **A change to the instruction invalidates the verdicts downstream of it.** New instruction
   means new assembly and a new round. Silence is not consent.
6. **A change to a component invalidates the packages that use it** until they are re-checked.
   The catalogue is the other half of the law.
7. **No checkpoint edits silently.** A correction is a new version of the package with a new
   verdict, never an in-place mutation of an approved record.
8. **The gap loop is part of the flow, not a detour.** A package that needs a new component
   waits for the Figma ingest and the catalogue entry, and then continues — it does not ship
   around it.
9. **Governance reads the loop's output.** The monthly review consumes approved, rejected and
   failed packages — five facts per event, not eight hundred trace lines.

---

## What this changes about the rest of the system

- **Observability loses its last justification.** Traces existed to catch drift in an
  unconstrained model at runtime. With the loop, drift is caught at configuration time at the
  checkpoints. What remains is a receipt per call and a queue per package.
- **The model's job gets narrower and clearer.** It assembles a candidate from a fixed catalogue
  under a written instruction. It is judged at the only moment its output can vary.
- **The catalogue becomes a governed artefact.** Every component it holds is part of the law.
  Adding one is a deliberate act; changing one is a decision the loop must honour.
- **Research becomes the spine of the loop rather than a department beside it.** Discovery,
  validation, spikes, and compliance/security/oversight are the four layers that keep every
  checkpoint honest, and each one belongs to the department whose question it answers.

---

*This document is the doctrine; the code that follows it is the proof. When they disagree, the
code is wrong.*
