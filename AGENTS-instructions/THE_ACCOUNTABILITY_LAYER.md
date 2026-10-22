# The Accountability Layer — who reads the telemetry, and who answers for it

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Working doctrine — established 2026-10-18, from the boundary the owner drew around the
design seat's observability work
**Companion documents:** [`THE_METHOD.md`](THE_METHOD.md) (live-verification design engineering) ·
[`READ-ME/THE_SELF_REPORTING_SYSTEM.md`](READ-ME/THE_SELF_REPORTING_SYSTEM.md) (the machine's own
reports — walls, confessions, retention) · the build record of the capture door lives in
[`../design/UX-OBSERVABILITY-PLAN-2026-10-18-the-closed-vocabulary-and-our-own-capture-door.md`](../design/UX-OBSERVABILITY-PLAN-2026-10-18-the-closed-vocabulary-and-our-own-capture-door.md)

---

## §1 — The boundary, in one paragraph

**Product owns the business case. UX owns the human execution. Development owns the orchestration
constraints. The CTO owns the performance of the people in those seats.** Interaction telemetry
belongs to the people who build the surface; business numbers belong to the people who own the
business. The two records meet in one explicit hand-off, on a stated cadence — never in a shared
dashboard where one department can reach into another's work.

The owner's own boundary, 2026-10-18: *"product can adjust its vision not its technical insight."*

## §1a — The intent chain

Product does not hand anyone a list of metrics; it hands **requirements**. The UX designer builds
those requirements into the flow and the interface — *the owner, 2026-10-18: "the UX designer is
just building out the business requirements from product"* — and writes the criteria that show
whether the requirement is being met. Every element that carries a criterion carries the
requirement it serves with it.

The chain, in one line: **requirement → flow → elements → criteria → counters → findings →
Product adjusts its vision.** Each link has an owner, and none of them can be skipped:

- **Product** states the business requirement. It hands requirements, not metrics.
- **UX** builds the requirement into the flow and writes the criteria — the observable expression
  of what the requirement needs to know. A criterion names the requirement it serves; one without
  a requirement is incomplete.
- **The elements** carry the criteria: an `intent` note on the element (or on a part of it) holds
  the criteria, and `metadata.requirement` holds the requirement it traces to.
- **The counters** answer only what the closed vocabulary can express. An intent the vocabulary
  cannot express gets a **stated refusal naming the missing metric** — never a guessed number.
- **Suggestions are drafts.** The system may offer a starter intent drawn from the element's role
  and the flow; the designer edits, replaces, or rejects it. A suggestion never becomes truth by
  default, because only the people who own the requirement know what they need to see.

## §2 — What each seat reads, and what it acts on

| seat | reads | does not read | acts by |
|---|---|---|---|
| **Product** | the business system: revenue, conversion, churn, margin | retry spikes, element hesitation, interaction counters | adjusts the **vision** — pricing, partnerships, market, scope |
| **UX** | element counters, pacing, bailed flows, sandbox findings, the trail of what happened to an element | the books; the model's internal runs | changes the **interface**; collates findings for the hand-off |
| **Development** | agent and orchestration performance, typed refusals, retries, traces, evaluator verdicts, the failure vault | the books | hardens the **orchestration**; owns the failure path — one level above UX |
| **CTO** | all of the above as one **accountability ledger** | — | manages **performance**; names whose responsibility a failure is |

The owner's correction, 2026-10-18, verbatim: *"no they don't look at the retry spikes, product
doesn't care about retry spikes, that's between UX and development and if it continues to bail
product's business numbers will go down. So that would be the observability layer for a chief
technology officer, who wants to manage a team's performance — the human being has
responsibilities. This will expose their inability to fulfill them."*

The consequence is precise: **a retry spike never travels to Product.** Product sees the lagging
number (the business going down); the cause is read where the work happens (UX and Development);
and the CTO reads the same records to hold the responsible person to the job they were given.

## §2a — Failure is a path, not an exit

A failed run does not mean the person walks away and goes to bed. The system offers reassembly
options, and **every try is captured** — the owner, 2026-10-18: *"a failure doesn't mean that user
walks away … we're gonna give them reassembly options so each of those tries are captured and
development needs to step in at a higher level than UX."* The division that follows:

- **Development owns the failure and the hardening.** Agent performance and the orchestration
  layer's performance are Development's records — traces, typed refusals, evaluator verdicts, the
  failure vault. A failure that repeats is an orchestration weakness, and Development acts on it
  **one level above the interface**. The owner, same day: *"that's why we gave them session
  tracking and evaluators and rules — that's for the internal model logic."*
- **UX owns what the person experienced.** The same retry, seen from the interface side, is pacing
  and recovery design: whether the wall was explained and whether the door back was clear.
- **The CTO reads both** as team performance (§2).

One distinction to keep sharp, because the word "session" is used for two scopes: the **model's
session tracking** (the runs inside an agent session, with traces and verdicts) belongs to
Development's internal logic; the **anonymous interaction session** on our surface events is the
record's own identity and carries no person. They never merge into one record.

**Two classes of failure, and they are never exchanged.**

- **The common failure is a failure of understanding.** The person's mental model and the
  interface's model disagree — the product design process failed to carry the model, and the
  interface disabled understanding. That is UX's to diagnose and repair in the interface. It is
  not a model problem, and it is not solved by touching the orchestration.
- **The rare failure is agent drift or orchestration breakage.** In this system the model is held
  by deterministic seams, typed boundaries and evaluators, so drift is uncommon (the owner,
  2026-10-18: *"not an agent drift failure, which doesn't happen very often in our system"*). When
  it does happen it is Development's, one level above the interface.
- **Neither class may be blamed on the other.** "The agent drifted" is not an explanation for an
  interface nobody understood, and a confusing screen is not evidence of model failure. The record
  separates them by where the failure appears: the **element and the flow** for understanding; the
  **run, the trace and the verdict** for orchestration.

**The joint case, and why the flow is the shared key.** Some front-end failures cannot be solved
by design alone: the person's mental model disagrees with the interface because the surface is
being served the wrong facts, or the flow's logic puts the steps in the wrong order. Those are
fixed at the level that owns them — a developer who understands how the database serves the
surface and how the ingestion and orchestration assemble the flow (the owner, 2026-10-18, stating
the likely rule while he works it out: *"that will most likely have to come from a developer who
understands how databases serve up information…"*). The collaboration is an explicit path, never a
hand-off into a void:

1. **UX names the observed failure** — the element, the step, what the person did and what the
   interface showed.
2. **Development inspects the serving path and the flow's logic** — the **same package id is the
   key on both records**: the element counters carry the flow, and the runs and traces carry the
   session that belongs to that package.
3. **The fix lands where the cause is**, and UX re-verifies the person's experience afterwards.

**The collaboration needs an approval pipeline, and it is ours to build (specified, not built).**
No suite we evaluated supplies this layer between the two seats — a finding, the fix proposed
against it, the approval, and the verification afterwards have to be records in our own system, on
the same flow key. The owner, 2026-10-18: *"we're gonna have to build in an approval pipeline
which I've already researched a little bit. Just know that's coming. We don't have to do that
now."* It comes deliberately after the capture and the intent layer, and its shape is the owner's
to bring.

## §3 — The hand-off is an event, not a habit

UX collates and synthesizes what the interface actually did, and presents findings on a stated
cadence — a monthly review, or access on request. Two forms, both from UX:

- *"We analyzed the product launch — these are our findings."*
- *"We ran a testing sandbox — these are our findings."*

Product responds by adjusting its vision. It does **not** respond by editing the interface,
choosing a component, or instructing a layout. That boundary is the whole point: the department
that owns the human execution is the only department that changes it, and it changes it in
response to evidence it is trained to interpret.

## §4 — Why the design department owns the capture

The records are ours at every layer, which is what makes the boundary enforceable:

- **The door is ours.** A browser-side emitter posts same-origin to our own backend; no client
  SDK, no project token, no vendor, no egress. The vendor suite that was evaluated for this
  purpose (its ingestion core and its query lane) was **refused and is reference only** — running
  it would import a growth-workflow product, its datastores, and a settings surface we do not own.
- **The vocabulary is closed.** Three interactions exist on day one; a new metric is a code change
  with typed dimensions, reviewed. Nothing "sends whatever, sorted later."
- **No content, ever.** A dimension carries a name, a label, an enum or a number. Message text and
  prompt text are never read — the emitter deliberately does not touch them.
- **Anonymous identity only.** The session id is minted in the browser; a person is a returning
  anonymous session, never a profile.
- **The reading lives with the reader.** The analytics lane is a tab in the **design seat** —
  an additional item on its rail, its own file and its own behaviour. It is not a global dashboard
  and not a second product.

## §5 — The refusal that matters: "the AI did it"

The owner, 2026-10-18: *"we can't say 'oh the AI did it' — like they're doing now at major cloud
companies and flagship model producers."*

This architecture exists so that sentence is never available here. The model is a utility inside a
contract it cannot alter (`READ-ME/THE_SELF_REPORTING_SYSTEM.md`): it cannot invent a component,
touch the registry, or take an action. The chrome is deterministic; the catalog is an allowlist;
the output crosses a typed boundary or does not cross.

So when a surface fails a person, the failure does not dissolve into model variance. The record
names the **element**, the **surface**, and the **interaction**; the catalogue names the author;
the registry names the contract that was broken. Responsibility resolves to a human being — the
designer who mapped the states, or the engineer who set the constraints — because there is no
layer in between whose job is to relay the number without owning it.

## §6 — The patterns this doctrine designs against

Stated as mechanisms, not motives — and paired with the countermeasure that makes each one
impossible or visible here.

1. **The suite as a department.** A tool sold for one role's workflow gets used by another role to
   do a third role's job, and the org chart quietly changes shape around the tool. **Countermeasure:**
   one tab, one file; each seat's surface declares what it reads; no shared dashboard mediates
   between departments.
2. **The metric as a target.** When a measure becomes a target it stops measuring (Goodhart's
   law); a number that can be gamed will be. **Countermeasure:** a deliberately small, closed
   vocabulary; counters exist to diagnose the surface, not to score another department; growing it
   requires a reviewed code change.
3. **The dashboard as decoration.** Charts that nobody reads, built because the product shipped
   charts. **Countermeasure:** Phase 3 waits for real numbers; the reading lands where the person
   who acts on it already works.
4. **The invisible middle.** Layers that pass a figure along without owning the interpretation —
   where a hesitation becomes a ticket and a ticket becomes a meeting. **Countermeasure:** the
   hand-off is an event (§3), and every failure has a named author (§5).
5. **The AI shield.** "The model was unpredictable" as a general-purpose excuse. **Countermeasure:**
   determinism at the seams, typed boundaries, our own records (§5).
6. **Surveillance dressed as analytics.** A record of persons rather than surfaces. **Countermeasure:**
   no content, no profiles, anonymous sessions, aggregate buckets. This is a record of **elements**,
   not of people — the same line `THE_SELF_REPORTING_SYSTEM.md` draws for the machine's own
   reports: walls and confessions, never bodies; retention windows, not hoards.

## §7 — What the data does not do

It does not explain human psychology. A forty-second pause is a **question**, not an answer: it can
mean confusion, reading, distraction, or a slow network. The counter says *where* to look; the
designer says *why*, and only a designer is trained to. This doctrine adds evidence to judgment —
it never substitutes a graph for it, and it never lets a person outside the craft instruct the
craft from a spreadsheet.

**A NUMBER THAT OPENS NOTHING IS VANITY.** Owner, 2026-10-18, on a dashboard of element counts
built that day: *"All of that information could be captured in one list. A small, unnecessary
vanity metric may be appended to a dashboard with no call to action or functionality tied to it.
This serves no purpose to know people are clicking on things."* The rule that follows: **a count
earns its place only by the action it opens.** Counts belong as a COLUMN in a list of things a
person has to decide about — never as the product. A screen whose only job is to report that
people clicked has no job.

## §8 — RACI: the naming layer (specified, not built)

The name used in the founding discussion for this lane: the **Agile Observability Machine** — a
RACI matrix that stops being a static spreadsheet and becomes the record the metrics hang off:
**Responsible / Accountable** resolve to the people who built the element and its constraints;
**Consulted / Informed** resolve to the seats defined in §2.

**What exists today.** Every interaction resolves to an element (a `prompt_sessions` row through
`metadata->>'element_key'`); the element row carries its author (`user_id`, today the studio
default); the trail records what happened with its own `user_id`; the counters aggregate by
element. A performance read at the level of **elements** is therefore real.

**What does not exist — stated plainly, so no document claims it.** There is no per-element
Responsible/Accountable assignment, no team registry beyond `users`, and no readout that shows a
person's name beside a metric. *"The RACI matrix is hardcoded into the infrastructure"* is the
**direction**, not the current state.

**The shape when the owner calls for it** (the default, chosen to reuse the existing model rather
than add a second answer to "what is this element"):

- the **current** assignment lives on the element's own row — `metadata.responsible_user_id` and
  `metadata.accountable_user_id`;
- every assignment **change** is appended to the trail (`design_element_activity`, action
  `owner-assigned`), because it is a lifecycle fact and the trail is read row by row;
- the **readout** belongs to the design seat's analytics tab (Phase 3), never a global dashboard;
- names resolve from `users`; an element with no assignment reads **unassigned** — responsibility
  is never inferred from activity, seniority, or who happened to touch the row last.

## §9 — The laws this doctrine puts on the code

1. **The capture door is ours.** No vendor SDK, no token, no egress — the emitter posts same-origin
   to our backend and the rows land in our Postgres.
2. **A closed vocabulary.** A new metric is a code change with typed dimensions, never a runtime
   free-for-all.
3. **No content in any dimension.** No message text, no prompt text, no person's words.
4. **A metric hangs off an element or it is not recorded.** No invented elements, no floating tags.
5. **All-or-nothing batches.** A refusal is a sentence naming the reason; nothing partial is
   written.
6. **One tab, one file.** The design seat's analytics tab is its own surface with its own
   behaviour; it is copied and repurposed from the governance room's pattern, never a shared chat.
7. **Responsibility resolves to a human author**, never to "the model did it".
8. **The hand-off is explicit.** Product reads business numbers; UX and Development read
   interaction records; the CTO reads both as performance.
9. **An unassigned element reads unassigned.** RACI names are written by a person and read from
   the element's own row; they are never inferred.
