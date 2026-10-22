# The Zero-Trust Repair — a running record of a system that was lying, and what it took to make it stop

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Working record — one entry per session, newest first. Written from measurements, never
from memory.
**Companions:** [`THE_METHOD.md`](THE_METHOD.md) (the doctrine this is an instance of) ·
[`THE_PACKAGE_CONTRACT.md`](THE_PACKAGE_CONTRACT.md) (the invariants) ·
[`Core-Concept.md`](Core-Concept.md) (the known-failure pattern) ·
`PLANS.AGENT/figma-ingest/CHANGELOG.md` (the function's own record)

---

## What this file is for

`Core-Concept.md` names a failure pattern and says it happened six times on 2026-09-16:

> complete-looking output, required piece missing, success reported anyway.

On 2026-09-30 it was still happening, and this file is the account of one session spent finding it,
measuring it, and putting a gate in front of it. It is written to be read by a model that is about
to work on this codebase, because the trap is not a bug in one function — it is a *shape*, and a
model that does not know the shape will reproduce it while believing it is being careful.

The short version, for a reader in a hurry:

> **A system that reports success while doing nothing is not fixed by reading its code. It is fixed
> by measuring its output, and by making "unexamined" a failure and "examined with a reason" a
> report. Everything else in this file is evidence for those two sentences.**

---

## 2026-09-30/10-01 — the night the ingest stopped dropping facts in silence

### 1. What the complaint was, and why the complaint was right

The owner's report, in his words:

> *"It's not reading the Figma file. It's got every annotation in it. It will not do it. It's not
> showing me a preview… it will not read most of it, but it skips parts and the parts that can't read
> it just skipped and silently fail… it keeps on serving the same fucking thing over and over."*

Every clause of that was checkable, and every clause was true. What follows is what was actually
wrong, in the order it was found, with the measurement that found it.

### 2. The traps, named — five ways this system was lying, all of them silent

Each of these passed every check that existed at the time. Each one **reported success**.

| # | The lie | The mechanism | The measurement that found it |
|---|---|---|---|
| 1 | **A capability claimed that did not exist** | `truncation` sat in `RENDERED_KEYS` — "this renderer draws truncation" — while the declaration it emitted did nothing. | `-webkit-line-clamp` is accepted, computes to `2`, and draws nothing: the engine rewrites the box's `display` from `-webkit-box` to `flow-root` and renders **3 lines at 14.5227px in a 43px box, with no ellipsis**. `CSS.supports('block-ellipsis','auto')` → false. `CSS.supports('line-clamp','2')` → false. Six spellings tried on a live page; none drew. |
| 2 | **Facts dropped at measurement, by a hand-written list** | `_figma_spec_for_model` read a fixed list of keys. Everything else Figma stated was discarded at the point of measurement, with nothing said. | 18 distinct keys on essentially every node — including `interactions`, `overrides`, `lineTypes`, `primaryAxisSizingMode` — never reached the spec at all. |
| 3 | **A loop that could never execute, inside a comment that said it did** | The ingest fetched the components a design uses by iterating a `components` map. The endpoint does not return that key. So the list was always empty and no master was ever fetched — and the code's own comment asserted the response carried it. | `/v1/files/<key>/nodes` top-level keys: `editorType, lastModified, linkAccess, name, nodes, role, thumbnailUrl, version`. `components: null`, `componentSets: null`. Five INSTANCE layers, none measured. |
| 4 | **A measurement read by nothing** | `maxLines` was measured into the spec and listed as rendered; the line count came from `height ÷ lineHeightPx` instead. | The fact that decides the drawing was the one fact nothing looked at. |
| 5 | **A second code path for one layer** | `render_spec` hand-built the root's `:host` rule from layout and size only. The root's fill, stroke, radius, effects, opacity and clipping were never emitted. | The design's root frame is `[{SOLID, #ffffff}]`; the emitted `:host` carried **no `background` at all**. |

And two meta-traps, which matter more than any of the five:

| # | The meta-lie | The measurement |
|---|---|---|
| 6 | **A guard that existed only as records** | The activity log holds two `removal-refused` records from 2026-09-29, each with `namedBy`, a `ruling` and a `nextStep` — refusing to delete a component that is live on the front end. **The code that wrote them is in no commit in this repository** (`git log -S namedBy` is empty). Both removal paths have been unguarded since. The records outlived the rule. |
| 7 | **An instrument that lied five times** | The fidelity tool reported losses that were not losses: text-layer fills probed for `background` instead of `color`; vector strokes probed for a CSS border when they are on the `<path>`; `clipsContent: false` counted as a statement; **transparent pixels counted as ink** (alpha ignored); and a 1px row misalignment that inflated a diff to 45%. |

**Number 6 is the one to remember.** A rule that survives as a *log entry* while its *code* is gone
is the most dangerous state in this list, because the record makes it look enforced.

### 3. How the trap was sprung — the procedure that actually worked

The method is `THE_METHOD.md`'s, in a specific order. This order is the whole lesson:

1. **Measure the output, not the code.** Every one of traps 1–5 is invisible to a reader and obvious
   to a measurement. The truncation defect was found by screenshotting the rendered element and
   comparing it to Figma's own export — nothing that reads files can see it.
2. **Build the instrument, then distrust it.** Five rounds of removing false positives went in
   *before* any finding was reported. **A lying instrument is worse than none**, because it sends you
   to fix things that are correct and teaches you to distrust the one measurement that is real.
3. **Verify by injection, never by assertion.** The gate that refuses unexamined facts was proven by
   planting an invented key (`absoluteBoundingBoxV2`) and watching it refuse, naming it. A gate
   nobody has watched fire is a hope.
4. **Fix once per fact, in the generator, with the design's own numbers.** No run-time pass, no
   second mechanism, no tolerance constant, no character limit.
5. **Withdraw your own claims, out loud.** Three of this author's own results were reported and then
   retracted the same night: a 45% difference that was a 1px misalignment; a "+50 ink pixels"
   stroke defect that was rasterisation; and a cache-staleness test that was flawed and settled
   nothing. **Saying "my last number was wrong" is cheaper than a week built on it.**
6. **Name the mechanism, with the file.** Not "something dropped it" — `figma.py` line N, the key,
   the value, and the source that contradicted it.

### 4. The distinction that makes a gate usable

The instruction arrived, more than once, to make **any** defect abort the ingest. Taken literally it
would have refused **both of the repository's own catalogue components**, every time — each carries
`defect: 2` (truncation), and truncation is a defect this engine cannot fix. A gate that refuses
everything it protects is a wall in front of the door. The same failure had already been built once
(a `422` refusing a truncating design) and removed on the owner's ruling that **the Figma file is the
authority and the burden is the renderer's, not the design's**.

So the gate was built on the distinction that is actually protective:

> **UNEXAMINED variance aborts. EXAMINED defects are reported and counted.**
> An examined defect is a known gap with a measurement behind it. An unexamined one is a surprise,
> and surprises abort.

It blocks on: a stated key no examination covers · a stated fact that never reached the spec · a
declaration with no measurement behind it. It reports, per layer and counted at the root of the
ingest's own answer, a defect that is recorded in `INERT_DECLARATIONS` with its date and engine.

**And a reason expires with its value.** `blendMode: "PASS_THROUGH"` is examined; a real blend mode
returns the key to the omissions list. `cornerSmoothing: 0` is examined; `4` is not. That property
is what stops the examined set becoming a blanket exemption — the failure mode to fear most, because
a list of reassuring sentences looks exactly like diligence.

### 5. What the numbers became

| | before | after |
|---|---|---|
| Truncating text layer, region mean pixel Δ | **100** | **47.1** |
| That layer's text ink, rows | 0–39 (three lines) | 6–33 (two lines) — Figma: 7–33 |
| Facts whose fate is unaccounted for | 18 keys dropped at measurement | **0 omissions**, 15 keys examined with value-aware reasons |
| Drafts from the header design | 1 (the target alone) | **5** (four masters + the target) |
| Doomed declarations emitted twice | `align-self: stretch` ×2 | deduped; conflicting values now **named in the stylesheet** |
| Root's own fill drawn | never | `background: #ffffff` |
| Size-gate headroom | 16,079 of 40,000 (a *report* could refuse a design) | 28,861 of 40,000 — the gate measures the **renderable** spec |

Every one of those is a *pixel or a count*, not a claim.

### 6. The protection that was rebuilt

The removal path now refuses, on the **server** — because it is the file deletion that has to be
stopped, and a client check only stops the client that remembers to ask:

```
POST /api/figma/remove {tag: "f-40001207-3497"}
→ 409  {"ruling": "live",
        "namedBy": ["frontend/src/components/lit/figma-layers-view.ts"],
        "note": "…is live in the application's own code, so removing it would break what names it…",
        "nextStep": "…the name leaving figma-layers-view.ts is what makes it removable — a click cannot."}
```

`figma-layers-view.ts:1557` instantiates `<f-40001207-3497>` as **the tile every catalogue row is
drawn with**. Removing it would have emptied the left column while reporting success. The verdicts
that come out of the guard today:

| tag | verdict | named by |
|---|---|---|
| `f-40001207-3497` | REFUSED | `figma-layers-view.ts` |
| `f-40001207-3559` | REFUSED | `backend/routes/ai.py`, `figma-layers-view.ts` |
| `trace-feed` | REFUSED | `a2ui-renderer.ts`, `chat-panel.ts`, `main.tsx` |
| `RoomEmbed` | REFUSED | `ai.py`, `a2ui-renderer.ts`, `room-embed.ts`, `WritingAreaIndex.tsx` |
| `f-40001204-5752`, `f-40001206-2888` | removable | none |

Two rules the guard's own construction taught, both worth carrying to any similar check:

- **It strips comments before it looks.** A raw substring scan found six files naming
  `f-40001207-3497`; three named it only in **prose**. A guard that refuses because a docstring
  mentions a name refuses every removal anybody ever attempts.
- **It does not scan its own module.** The first version reported `backend/routes/figma.py` as a
  "reference" — because the paragraph documenting the guard mentions the tag. A guard whose own
  documentation trips it is not a guard.

And a hand-written file is never deleted by an automated pass: the component's behaviour companion
is **reported** as orphaned, not removed, because no re-ingest can rebuild hand-written work.

### 7. The honest remainder

Nothing in this file is a claim about what is *done*. What is not:

- **The ellipsis is still not drawn.** The design states `ENDING`; the engine cannot draw a
  multi-line ellipsis by any of six measured spellings. The whole lines that fit are drawn and
  clipped, and the absence is named per layer and counted at the root of the ingest's answer. The
  only route that would draw the pixel is the design stating where the ellipsis falls, which is
  literal data rather than a computation.
- **The generator is not byte-deterministic for a vector.** The same node, rendered twice, produced
  two different SVG coordinate origins — visually identical, but it violates "same spec → same
  bytes", so a re-approve rewrites the file for no visible reason.
- **No removal of a *removable* component has been executed.** Refusals were tested; a completed
  removal was not.
- **The remaining `not-drawn` rows are a ruling, not a defect.** The preview reads no catalogue on
  purpose (*"the preview should be fresh and not checking the lit catalog… a comparison after we
  approve"*), so an instance is drawn from its own measured subtree. Composition belongs to approval.

---

## The transferable part — for a model reading this before it touches the pipeline

1. **A comment is not evidence of behaviour.** Trap 3 was a code comment describing a response key
   that does not exist. Read the response. Run the function.
2. **A list of keys is a list of what you are allowed to notice.** Any hand-written allowlist in a
   measurement path is a silent-drop mechanism. Carry everything; place what you can; name the rest.
3. **"It renders" and "it draws what the design says" are different claims.** Determinism and
   compilation prove the first. Only a pixel comparison proves the second.
4. **Failure has to be loud, and refusal has to be reasoned.** An empty list for "you may not read
   this" reads as "nothing is here". A `409` with `namedBy` and a `nextStep` is a next step; a status
   code alone is a shrug.
5. **Do not fix a symptom by adding a mechanism.** Every clamp, character limit and tolerance
   constant in this file's history was added to make a picture look right, and each one was removed
   after it was measured. A number nobody's file states is an interpretation wearing a measurement's
   clothes.
6. **When you cannot draw something, say so where the person is looking.** The ingest's answer
   carries `fidelity.missingEllipses` and a sentence, so the gap is visible without opening anything.
   A gap that lives in a ledger file is a gap nobody reads.
7. **Report your own instrument's failures first.** If your check disagrees with the drawing, suspect
   the check. This session's check was wrong five times before it was right once.

*This document practices what it preaches: every claim above names the file, the key, the value, the
date, or the count that produced it.*
