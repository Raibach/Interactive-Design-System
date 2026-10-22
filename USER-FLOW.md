# The User Flow

**Status: the flow is the plan; most of it is not built.** This is the mechanical breakdown: stage
by stage, who touches what, what the machine runs behind them, and what becomes measurable
because of it. The principle — why the loop belongs to the machine and people are kept at its
edge — is stated in [`SECURITY-AND-COMPLIANCE.md`](SECURITY-AND-COMPLIANCE.md). That document is
the doctrine; this one is the diagram.

The technical contracts (transports, data binding, component structure, catalogues) live in
[`AGENTS-instructions/`](AGENTS-instructions/).

---

## The four people

| Who | Where they sit | What they bring |
|---|---|---|
| **Product** | away from the desk — a garden, a latte, a walk | the idea; what the business should do better |
| **Design** | the design seat, then Figma, then the design seat again | standards: compliance, accessibility, experience; and the evidence from real users |
| **The developer** | the back office, one person | hardening and launch |
| **The customer** | a browser, at checkout, for about four seconds | the only reaction that settles anything |

The first three are the chain. The fourth is the reason it exists — and the fourth is also the
source of the numbers that tell you whether the idea worked.

---

## The flow, end to end

### 1. Noticing — no system involved

A product person is imagining how the business could serve customers better. Nothing is
recorded; this is the part of the job that has never needed software.

### 2. Writing the instruction

They write it down as a prompt:

> *"Please present this coupon to the customer at checkout, using this database of preferred
> customers from our premium list."*

Saving it creates the **orchestration layer**: a prompt package in the database. From this
moment the package has an identity, a version, and a place in the queue.

### 3. Assembly

The prompt meets the static Lit catalogue and a candidate assembly comes back: which components,
in what order, bound to what, with what values. The assembly pulls from components that exist.
It does not invent a component, and it does not write code.

### 4. Gate one — design

Design reviews the candidate against compliance standards and disability/accessibility
standards. Where it is wrong, the correction is made **to the prompt**, not to the surface —
and then the package is put in front of real users: A/B tests, feedback, observation. The
analysis is filed on the package and sent back.

### 5. Gate two — product

Product reads the analysis and answers one question: *is this what I meant?*

### 6. The gap loop, when it is needed

If the instruction needs a component the catalogue does not hold, the package waits. Design
draws it in Figma, matching the branding; ingests it through the design seat; it becomes a
catalogue entry tied to the business logic; and the package continues, carrying the new
component with it.

### 7. Gate three — the developer

One developer hardens the package against the registry, checks it against the instruction, and
launches it. Production serves the frozen record.

### 8. The customer's moment

A surface appears — assembled from components that were chosen, checked and signed. The customer
sees a coupon at checkout. They either use it or they do not, and the gap between those two
outcomes is now measurable in milliseconds, because the surface was known before it was served.

### 9. Evidence, back to the product person

The numbers come back: how long before they acted, which components they touched, how many of
them finished, where they stopped. The product person is no longer guessing whether the idea
worked. The loop closes and reopens with the next instruction.

---

## What the AI does in the background

The loop is the machine's. Every stage transition, every reminder, every record is the AI's job,
not a person's — and the loop never idles waiting for one:

- **communications** — carrying the package and its context between stages;
- **notifications** — telling the next person there is something waiting, and telling the
  previous one it moved;
- **gate management** — which stage the package is at, what it is waiting for, what is blocked;
- **escalation** — an unanswered checkpoint is chased; the rest of the loop keeps running
  everything that does not depend on the answer;
- **the approval process** — recording each verdict, its author, its time, and the bytes it
  covered;
- **assembly** — turning an approved prompt and the catalogue into a candidate;
- **catalogue enforcement** — holding the components, their property types, and what each one is
  allowed to be bound to, and refusing what does not comply;
- **composition for the front end** — serving the assembled surface to the customer.

**What the AI does not do.** It does not decide what the business wants. It does not render the
verdict on its own assembly — it may check, refuse, route, record and escalate, but a machine
approving itself is a mirror, not a control. It does not invent a component that is not in the
catalogue. It does not write product code. It does not change the law — the prompt, the
components and the catalogue.

That division is what makes the background invisible: the human work is a contribution at a
checkpoint, and the machine work is the loop, and neither one pretends to be the other.

---

## The measurement layer

Because the front end is a **fixed catalogue of known components** and not free-form generated
markup, every interaction can be attributed to something specific. That is the difference
between counting clicks and understanding a surface.

What becomes measurable:

| Metric | What it answers | How it is bounded |
|---|---|---|
| **Time-to-intent** | how long between the surface being served and the first meaningful action | needs a served-at timestamp on the assembly |
| **Click-through latency** | per component: how long before *this* control was used | needs a component identity on every event |
| **Task completion velocity** | how long the whole job took — apply the coupon, finish the checkout | needs a session that survives the journey |
| **Friction and drop-off** | where people stop, and how far they got | needs the ordered sequence per session |
| **Approval gate velocity** | how long a package waits at each stage, internally | needs the gate's own timestamps |

**Why these numbers are trustworthy here and usually are not.** In a system that generates
markup freely, a click lands on something whose identity is uncertain, so the numbers describe a
page nobody can name. Here the surface is drawn from a known set: a click belongs to a named
component, inside a named assembly, from a named package. The measurement describes the
business decision, not the rendering.

**The inversion.** The usual AI product spends its telemetry looking inward, tracing the model
to work out what it did. This system's internal steps are fixed by the catalogue and the gate,
so looking inward buys almost nothing. The compute is spent looking outward instead — at the
person using the surface. That is the only evidence that ever mattered.

---

## What has to exist before any of those numbers do

Honest status, checked against the code:

| Piece | Exists? |
|---|---|
| Element-level activity records (`design_element_activity`: element, user, actor, action, detail, at) | **Yes** — in the studio database, and used for design elements |
| Governance event counts by session (`events_core`, read by the sessions view) | **Yes** — sessions, events, traces, cost per session |
| A **served-at** timestamp on the assembly the customer receives | **No** |
| A **component identity** carried on every interaction event from an assembled surface | **No** |
| A **customer session id** that survives the whole journey | **No** |
| A store for those customer events, and a view that reads them | **No** |
| Per-stage timestamps on the approval chain | **No** — the chain itself is not built |

So: the architecture makes these measurements possible, and the pieces that already exist are
the design-side ones. The customer-side instrumentation is the work that has not started.

---

## The limits

**A slow click is not always confusion.** Someone reading a coupon carefully looks identical,
in the numbers, to someone who cannot find the button. Latency describes behaviour; it does not
explain it. Only design's research layer, with a person in front of the thing, can say which it
was.

**A/B tests need volume.** Two variants need enough people for the difference to mean anything.
A quiet campaign produces a result that cannot be told apart from noise, and it should be
recorded as such rather than read as proof.

**A gate velocity metric can reward the wrong thing.** The fastest possible approval is a rubber
stamp. The number has to sit next to what was approved, never on its own.

**Measure the surface, not the person.** These metrics describe what happened on an assembled
component. They do not need a customer's identity to be useful, and the system should not
collect one in order to report a click.

**Vanity metrics arrive on their own.** Once a number is on a dashboard it starts being managed.
The rules stay the same as everywhere else in this system: five facts per event, monthly unless
an alert fires, and never a figure that cannot be traced back to a record.

---

*The gate protects the instruction. The flow is how the instruction becomes something a person
uses. The numbers are how you find out whether it worked.*
