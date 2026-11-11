# The Liberation from the Black-Box

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Systemwide doctrine — established 2026-10-17
**Companions:** [`THE_SELF_REPORTING_SYSTEM.md`](./THE_SELF_REPORTING_SYSTEM.md) (how failures are
reported) · [`../THE_ENGINEERING_PHILOSOPHY.md`](../THE_ENGINEERING_PHILOSOPHY.md) (compiled AI)

---

## The industry default

The prevailing pattern for building with large language models is an open-ended one: the
model is given latitude to interpret, plan, and re-plan, and the system is observed
afterwards. That pattern needs an observability stack — traces, spans, prompt archives,
percentile dashboards, filter tables — because the range of what the model may do is wide
enough that its behaviour has to be watched statistically.

## What this system does instead

- **Reasoning is off, at the provider level.** The payload
  carries `reasoning_effort: "none"` on every mode, and a caller asking for reasoning is
  overruled in one place. No chain-of-thought, no hidden planning pass.
- **The output is a transformation, not a conversation about what to do.** Every mode asks
  for a shape the code already wrote: a strict JSON directive, a surface assembled from a
  fixed catalog, an answer to a question. The model's job ends at the boundary.
- **The catalog is the boundary.** The model composes only from a human-curated registry. A
  name outside it does not get "fixed" — it gets refused, at the exact line, with the reason.
- **There is no open loop to drift in.** Drift, grounding failure and distribution shift are
  statistics you watch when the machine can wander. Here it cannot. A violation is not a
  trend to monitor; it is a value the contract rejects.

## Built on the A2UI specification, used differently

A2UI was specified to solve a structural and security problem: an agent must not be able to
inject code or break a layout. That is the specification we implement, and it is what makes
the rest possible.

Because the interface is deterministic and the catalog is closed, a different set of choices
becomes available to the builder:


 **Observation can be minimal.** A deterministic pipeline does not need a live heart
   monitor. It needs a receipt per call and a confession per wall.
 **The conversation can be caged.** Whatever looseness remains lives in the chat, and the
   chat holds no keys: it cannot reach the registry, cannot author a component, cannot take
   an action. Its answer must fit the catalog or it fails at the boundary; the interface —
   not the model — decides what is allowed to exist.

The same specification supports an open-ended model watched by a large telemetry stack, or a
constrained one that reports itself in five facts. This repository takes the second shape
deliberately, and says so here so the choice is visible rather than implied.

## What replaces the telemetry stack

a short, honest loop:

1. **The wall.** The machine halts at the contract boundary. It does not improvise.
2. **The confession.** One row for the failure: when, which component, what kind of break,
   the provider's own code, one line of detail. No prompt, no answer, no latency, no history
   of successes.
3. **The door.** The person is handed the real reason and the ability to try again. Not a
   404, not a dead end.
4. **The morning brief.** Those confessions, summarised where people already look — the
   approval queue in the vertical nav — with a dismissal that purges the vault and says what
   it deleted.
5. **The receipt.** The only thing kept per successful call is the bill: token counts and
   cost, in our own database. What was spent, never what was said.

Nothing accumulates. There is no backlog, because a backlog of the past is a liability that
someone must maintain. What happened is gone except for the report window — seven days,
thirty days, whatever the report is for.

## Why this matters beyond this repository

The pattern generalises to any system where the model must be *right* and *accountable*
rather than merely fluent. The strongest near-term example is a large enterprise learning
system — a compliance machine serving a data-center workforce.

An LMS cannot guess what training a technician needs. A technician's certification is not a
creative writing task; it is a state that either matches the catalog or does not. Locking the
interface into a deterministic A2UI layer means:

- the model maps a person's request onto a fixed catalog of courses, modules and
  requirements — it does not author them;
- grounding is not a metric to monitor, because there is nothing to ground: the only content
  that can appear is content the registry already holds;
- a mismatch is a hard failure with a retry, not a hallucination to be discovered later by an
  auditor;
- the compliance surface has no drift, no backlog, and no telemetry debt to fund.

A bulletproof, zero-debt compliance machine does not need to be watched. It needs to be built
so that being wrong is impossible, and so that being broken is loud.

## The standard this sets

- We do not request reasoning. We pay for the transformation and nothing else.
- We do not run a telemetry stack. We run a boundary, and the failure of that boundary is the
  system's own report.
- We do not keep history. We keep the bill and the confessions, inside a window someone chose.
- We do not describe a machine we have not built this way. When the code and this document
  disagree, the code is wrong.
