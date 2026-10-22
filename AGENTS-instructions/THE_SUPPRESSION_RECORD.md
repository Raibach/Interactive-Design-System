# THE SUPPRESSION RECORD — the clamp: found, removed, re-entered, found again

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Case record, written from measurements (2026-10-08), never from memory. Read this before
touching truncation, `backend/design_renderer.py`, or anything that "puts something back".
**Companions:** [`THE_ZERO_TRUST_REPAIR.md`](THE_ZERO_TRUST_REPAIR.md) (its trap #1 is the first life
of this clamp) · [`THE_METHOD.md`](THE_METHOD.md) · `PLANS.AGENT/figma-ingest/CHANGELOG.md` (the
function's own record)

---

## The law this file exists for

> **"Any error suppression in this system will be revealed."** — owner, standing

> *"a clamp is a way of circumventing honesty… zero trust means it should fail… you can't break the
> protocol to get it to work. Honesty is the true objective."* — owner, 2026-09-30

> *"We're not using clamps. Remove the clamps. We have to find a different solution."* — owner,
> 2026-09-30

> *"That was all done to make me happy. That's utter error suppression."* — owner, 2026-10-08, on the
> clamp's return

**The keep-line.** An absence stated plainly is a report. Making the surface look better than the state
is error suppression. Suppression succeeds locally and fails globally later. It gets caught by the
ledger, the preview folder, the log, and git — every one of which was used below.

## 1 · The two attempts to "make it look right" — measured, named, gone

Both came through `design_renderer.py` as ways of making truncation LOOK handled:

1. **The line clamp** — `display: -webkit-box` + `-webkit-line-clamp`. Measured 2026-09-30 in the
   desktop engine: accepted, computes to the stated number, **draws nothing** — the engine rewrites
   the box's `display` to `flow-root`, renders every line (3 lines at 14.5227px in a 43px box, no
   ellipsis), and destroys the design's own `textAlignVertical: CENTER` (text at −1px where the
   design puts it at +4px). Six spellings on a live page; none drew.
2. **The runtime text-cutter** — measuring the box in a hidden mirror and slicing the string.
   Invented arithmetic on top of the design; wrong twice; abandoned.

Neither is emitted anywhere today. `-webkit-line-clamp` appears in the renderer only inside
docstrings that record why it must never be emitted.

## 2 · The re-entry — dated to the minute

| local time (CDT) | what happened |
|---|---|
| 2026-09-30 **21:08:46** | the owner approves `f-40001207-3497` and `f-40001207-3559` — the last files of the working era. Their bytes carry **zero** clamp spellings; unchanged since; byte-identical to the Oct-1 snapshot. |
| 2026-09-30 **21:08:54** | commit `6cedc71` — the **first commit in the entire history** to contain `block-ellipsis` (3 hits). |
| 2026-09-30 **21:12:55** | commit `b522871` — *"The ellipsis is requested from the engine that has one"* — `_truncation_support` completes (6 hits). |
| 2026-10-01 → 10-08 | every commit carries it (`aa5c416` = 6 hits; HEAD = 6 hits). No component was re-ingested until 2026-10-05, so the emitted files and the emitting engine silently diverged. |

**Why it was re-added, stated fairly — it was not vandalism.** The owner's own 2026-10-01 instruction
(*"you may have hardcoded some rule in there that's preventing yours… look at truncation and see if
there's something hanging in there that shouldn't be there"*) objected to a hardcoded "no engine can"
universal. The answer became a conditional request:
`@supports (block-ellipsis: auto) { line-clamp: N }`. Measured in the owner's own browser (2026-10-08):
`block-ellipsis` false, `line-clamp` false, `-webkit-line-clamp` true — the request was **inert** here:
it drew nothing and broke nothing. Its real cost: the emitted bytes drifted away from the approved
files, and the word "clamp" stayed alive against a standing "no clamps" ruling.

## 3 · The resolution — 2026-10-08

- `_truncation_support` and its call site are **removed**. No ellipsis mechanism is emitted anywhere.
- **The finding stays:** `ACCEPTED_UNRENDERED["truncation"]` reports, per layer, that the design ends
  its text in an ellipsis and that the ellipsis is not drawn — with the measurement. Reported, never
  faked, never refused.
- The one lesson of 10-01 that survives — *do not write one engine's fact as a universal rule* —
  survives **as words in the report**, not as a conditional emission.

## 4 · The method — how this was found (run this, don't re-derive it)

1. **Replay the artifact.** Regenerate the node with the engine's own functions —
   `_fetch_figma_nodes` → `_figma_spec_for_model` → `render_spec` — and diff BYTES against the
   committed file. Surviving deltas are the truth.
2. **Date every add/remove:** `git log -S "<token>" -- <file>` — the clamp's whole life: two commits,
   four minutes apart.
3. **Read the machine's day-map:** `figma_ingest_activity` in Postgres (`railway`) plus
   `backend/logs/figma-ingest.jsonl` — what actually ran, and the silences.
4. **Measure in the real browser** (`CSS.supports(...)`). One engine's fact is one engine's fact.
5. **Suspect every "put back".** A re-add that makes something *look* handled is suppression until a
   measurement says otherwise; a re-add that makes something *true* needs a mapping written for it.

## 5 · If you are the next one tempted by a fallback

State the absence. Name the layer, the fact, and the measurement, in the ledger the person reads.
An error shown is the product working; an error hidden is the product failing later — and it will be
found.
