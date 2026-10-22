# The Self-Reporting System — Why This Machine Does Not Need To Be Watched

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Working doctrine — established 2026-10-17, after removing the last observability
surface from the Governance room
**Companion documents:** [`THE_ENGINEERING_PHILOSOPHY.md`](../THE_ENGINEERING_PHILOSOPHY.md)
(compiled AI, determinism at the seams) · [`A2UI_TRUE_VS_FAKE_AUDIT.md`](./A2UI_TRUE_VS_FAKE_AUDIT.md)
(the method under fire) · [`THE_ACCOUNTABILITY_LAYER.md`](../THE_ACCOUNTABILITY_LAYER.md) (the
surface's own record — who reads it, and who answers for it)

---

## The disagreement with the industry

The popular picture of an AI system is a black box that must be watched: the model is a
volatile, unpredictable mind, and the only safety is a surveillance layer — traces, spans,
sessions, percentiles, a table of seven hundred successful calls and seventy filters to sift
them.

This system rejects that picture, and the rejection is architectural, not philosophical.

The model here is not an agent and not an oracle. It is a **utility**: a function that takes a
structured input and returns a structured output inside a contract the code already wrote.
It has no keys to the kingdom. It cannot alter the catalog, invent a component, touch the
registry, or take an action. It can only answer. When the answer does not fit the contract,
the wall does the talking.

A machine shaped like that does not need to be watched. It needs to be **heard when it
screams**.

## Reasoning is off, and that is the design

The models in this system are not permitted to think: no reasoning budgets, no
chain-of-thought, no "let it work it out". Every mode asks for a transformation and nothing
else. A model that reasons is a model that can wander, and this architecture renders that
impossible rather than monitoring it.

The economics of that decision, the A2UI specification it rests on, and what it means for
systems beyond this repository are argued in
[`THE_LIBERATION_FROM_THE_BLACK_BOX.md`](./THE_LIBERATION_FROM_THE_BLACK_BOX.md). This
document stays with what follows from it: the failure path.

## Self-reporting, not self-healing

This model does not heal itself. It is not expected to notice its own drift, correct its own
mistake, or reason its way back onto the rails. It fails, and it says so.

- **The wall.** The code knows the shape it expects. When the model returns a directive for an
  unknown field, a value outside the field's own vocabulary, or something that is not JSON at
  all, the code does not improvise a fallback. It refuses, at the exact line, with the real
  reason.
- **The confession.** A broken contract writes one row into the failure vault: *when*,
  *which component*, *what kind of break*, *the provider's own code* (HTTP 502, TIMEOUT,
  MALFORMED_DIRECTIVE), and one line of detail. Nothing else. No prompt, no answer, no
  latency, no trace id.
- **The door back in.** The person is offered a retry — not a 404, not an "error, cannot work,
  does not work". The best system feedback a person can receive is the truth plus a way
  forward. A retry is a second attempt at the same deterministic request, not a new class of
  failure.

This is the whole feedback loop, and it is short on purpose: a wall, a confession, a retry.

## No surveillance layer

Everything that existed only to watch the machine has been removed or is being removed:

- the trace tree browsing 763 successful calls;
- the home dashboard of usage, scores, sessions and percentile widgets;
- the four-hundred-line filter toolbar, the column pickers, the date chips;
- the annotation scores mirrored into a tracing service.

None of it answered a question a person in this room has. All of it implied that the model's
behaviour is a mystery that requires forensics. It is not a mystery: the pipeline is fixed —
assemble, call, parse, cost — and the only things that vary are facts, not structure.

**What remains is one thin receipt per call**: the provider's own token counts and the
measured cost, written for financial ledgering only. It carries no prompt, no answer, no
metadata. In a system whose rules grade its own runs, that receipt is also the event the
evaluators run on — it is the trigger, not the surveillance.

## Where the reporting goes

Self-reporting is only worth anything if it arrives where a person already looks.

- The failure vault is summarised into a **morning brief**: what broke, how many times, which
  component, and what people did after the wall. Not a log reader — a confession reader.
- It reports in the **approval queue on the vertical nav**, exactly the way the catalog audit
  already reports on itself. One philosophy, everywhere: the system states its own condition
  in the place a person already passes through.
- The brief can be **dismissed and purged**. Clicking it deletes the entire vault. That is not
  a dangerous button; it is the point of the design.

## Nothing accumulates

There are no long backlogs in this machine, and there will not be.

What happened in the past is in the past — gone — except for the short window the reports are
set to read: seven days, thirty days, whatever the report is for. Beyond that window the
record is deliberately empty. History is not an asset here; it is a liability that grows
until someone has to maintain it.

That is also why the purge is honest: it returns how many confessions were dropped. A purge
that cannot say what it deleted is a suppression.

## The rules this doctrine puts on the code

1. **Determinism at the seams.** The model's output crosses a typed boundary or it does not
   cross at all. No coercion, no guessing, no "close enough".
2. **Fail hard, fail loud, fail once.** No fallback providers, no fabricated states, no
   decorative placeholders. A failure is the answer.
3. **Every wall leaves one confession.** One row, five facts. Never a body, never a latency,
   never a history of successes.
4. **Every wall leaves a door.** A retry control, so the person is never at a dead end.
5. **Report where people look.** Approval queue, morning brief — not a dashboard nobody
   reads.
6. **Let it go.** Retention windows and a purge. The system does not hoard its own past.
7. **The receipt is for the bill.** Token counts and cost, in our own database. Nothing about
   what was said.

## The evidence this doctrine is real

- A model call now writes one row named `receipt`: 600 tokens, $0.00004, **zero bytes of
  prompt or answer**, no metadata, no user, no session.
- The Trace tab was removed from her rail; the trace tree, the dashboards and the filter
  tables went with it. Its seat now holds **Sessions** — the store's own grouping label,
  listed with its event and trace counts, its first and last write, and the group's cost.
  It shows that a group exists and what it cost; it opens no trace and reads no content.
- The failure path writes level ERROR with the provider's real reason — and the vault schema
  now records the wall itself, so the morning brief can be manufactured from five facts
  instead of eight hundred trace lines.
- The rules' cost column reads real money for the first time: $0.0602 and $0.0236 over seven
  days, matching the store to the digit.

The machine is not healing itself, and it is not hiding. It is reporting.

---

*This document is the doctrine; the code that follows it is the proof. When they disagree,
the code is wrong.*
