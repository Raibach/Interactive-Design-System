# Handoff — the preview does not match the Figma file (2026-11-09)

> ## CORRECTION — 2026-11-09 16:55, measured in the browser
>
> **Failure 1 below is wrong and must not be implemented.** The root's `-1` is relative to its
> parent, and that parent is flipped too; the two cancel on the canvas. Figma's own render of
> `40001175:2229` (624 × 133 PNG from `GET /v1/images`) shows the component UNMIRRORED — paperclip
> on the left, `Functions | Tools` on the right — and every child's `absoluteBoundingBox` sits at
> `+x` from the root's left edge (`-20968 + 3 = -20965`). Emitting the root's `-1` on `:host`
> would mirror the preview away from the file. The 19 REST/MCP `x` differences are a channel
> coordinate-convention difference, not a drawing difference: the drawn offset is the child's
> offset inside its parent (3), which is neither REST's accumulated 610 nor the MCP's 616.
>
> **The real failure, found by comparing the browser to Figma's PNG.** The chevron was drawn
> 16 px too low: six pixels because a rotated vector was placed at its
> `relativeTransform` translation (3, 10) instead of the corner of its post-transform box (3, 4),
> and ten more because the inline `<svg>` was aligned to the parent's text baseline instead of the
> box top. Both were invisible to the 174 rows, which read declarations, not layout. Fixed in
> `design_renderer.py` (`_child_offset` places a finished-`svg` shape by Figma's own box; the
> vector wrapper carries `line-height: 0`).
>
> **Verification (this session).** One ingest with the fixed code: 170/170 rows exact; then the
> compiled module was drawn in the real `<draft-preview>` element in Chromium and every drawn
> layer's `getBoundingClientRect()` was compared with Figma's `absoluteBoundingBox` offset by the
> root box — **23 of 23 layers match to 0.00 px**. The pixel diff against Figma's PNG is confined
> to the text (mean 4.9/255; the remaining difference is the face, below).
>
> **Remaining, not hidden.** The design states `Inter`; `/fonts/fonts.css` no longer declares it
> (the owner's 2026-10-25 font pass), so the browser substitutes Helvetica: `Agent Role` measures
> 95.0 px instead of Inter's 85.5 px. The `fontNotice` reports the substitution; making the
> preview load `Inter` would change that product decision, so it is stated here rather than done.
>
> **Failures 2 and 4 below are real but separate from the drawing** — the pass sentence does not
> carry the two-channel counts, and a discard leaves the session's saved preview. Neither was
> changed in this pass.

The goal is the preview alone: given a Figma link, the pane draws the file, layer for layer, and
the checker reports what it measured. Approval and the catalogue are not part of this goal and no
change below touches them.

## What the run says

The run at 21:18:26 passed its own check and contradicted itself in the same log.

- `Checked 174 rows: 170 exact, 0 not exact, 0 stated key(s) with no examination, 4 ask for no
  drawing.`
- `The design was drawn; every stated fact matched.`
- Earlier in the same run: `20 of 24 layers were measured over REST and over Figma's desktop MCP,
  101 of 120 facts carrying the same value. 19 fact(s) differ inside a mirrored frame … The drawn
  position is REST's, and the flip itself is a fact only REST carries. … 2 vector layer(s) are
  named by one channel only … 25 other fact(s) exist only over REST (2 layer (FRAME), 3 text, 20
  transform).`

So the checker's 174 rows compare the spec to the generated code text. The two-channel read is a
different measurement: 19 mirrored facts, 2 one-channel vectors, and 25 REST-only facts are
reported in the step log but are not in the 174 rows and are not in the pass sentence.

## Failure 1 — the root mirror is excluded from the drawing and from the checker

- `design_renderer.py:749` — `if not is_root:` wraps the transform emission. The root's matrix and
  rotation are never written. The comment says the root's place is "canvas placement"; that is true
  of the translation, but the root's 2×2 part in `[[-1,0,…],[0,1,…]]` is a mirror, which is
  structure. The component is drawn flat.
- `figma_fidelity.py:2256-2259` — the checker skips the root's `position`, `rotation` and
  `transform` for the same reason. The run's 19 mirrored facts are therefore never compared.
- Both sides skip the same fact, so 170 of 174 is self-consistent and the drawing is still wrong.
  The run names the defect — "the flip itself is a fact only REST carries" — and the code does not
  draw it.

## Failure 2 — the pass sentence overclaims

`routes/figma.py:6456` says `The design was drawn; every stated fact matched.` That sentence is
reached when `blocking` is empty. The two-channel divergences are not in `blocking`; they live in
`result["twoPass"]`. The sentence ignores the 19 mirrored facts, the 2 one-channel vectors and the
25 REST-only facts that the same run printed. The step log is the record the designer reads, and it
says the opposite of the evidence above it.

## Failure 3 — the preview CSS is outside every check

The 174 rows compare text: the spec's values against the declarations in the generated source. They
cannot see the browser. The user's screen is the only witness to raw, unstyled HTML, and the run
contains no browser evidence. `draft-preview.ts:212-230` injects the component's `static styles` into
the shadow root and the iframe head, but nothing in the pipeline verifies that the iframe loaded the
module or that the shadow root received the CSS. This is unverified, not disproved.

## Failure 4 — the discard clears the job but not the saved preview

- `api_figma_discard` (`routes/figma.py:8178`) calls `_drop_preview`, which pops the draft, the
  validation, the job metadata, the job status, the abandoned mark, the facts, and the
  `.preview/<jobId>/` folder (`routes/figma.py:830-843`). The ephemeral job is gone.
- The save path stores the preview on the session (`routes/ai.py:5404-5413`). The discard route
  never clears that stored preview. `ToolsSeat.tsx:2047` restores a saved preview when the card is
  opened. A discarded preview can therefore return from the session record.
- The live backend is current: the uvicorn worker `38710` started 2026-11-09 15:15:14, the same
  minute `design_renderer.py` was last written. The "nothing changes" result is not a stale reload.

## What was not done, and why the previous attempts failed

No ingest was run between the renderer changes. Every claim of a fix rested on `py_compile`,
`npm run typecheck`, or a synthetic `render_spec` call. Those prove syntax, not the drawing. The
coordinate source was changed six times (`place`, root-relative, parent-relative boxes, raw
`position`, transform translation, hybrid) without first reading the checker row for the failing
vector. Each change moved the break to another layer because the rule was changed, not derived from
the file.

## The deterministic corrections

1. Root mirror. Emit the root's 2×2 linear part on the `:host`, not its translation:
   `transform: matrix(a, b, c, d, 0, 0)` with `transform-origin: 0 0`, or `scaleX(-1)` when
   `a < 0`. A text layer inherits the mirror; counter it on the text node with
   `transform: scaleX(-1)`, or mirror the children's positions instead of the pixels. The checker
   skips the root transform, so this correction must be verified in the browser as well.
2. Pass sentence. Replace "every stated fact matched" with the fidelity result plus the two-channel
   counts: the rows that matched, the mirrored facts, the one-channel vectors, and the REST-only
   facts. The step log must not claim more than the run measured.
3. Discard. Clear the session's stored `preview` when the discarded job belongs to that session.
   The ephemeral drop is correct; the session record is the remaining hold.
4. Preview CSS. Verify in the browser with the iframe's console and network: the module must load,
   the element must upgrade, and the shadow root must contain the component's CSS. The pipeline
   cannot establish this from text.

## The verification loop that must be used from here

One ingest, then the run's exact rows. For the first failing row, read the layer, the fact, the
source value and the drawn value; find the one renderer instruction that wrote the drawn value; fix
that instruction; re-ingest. Do not change the coordinate source again until the run shows the same
layer and fact before and after. The run is the evidence; the browser is the second witness for the
visual, which the checker cannot see.
