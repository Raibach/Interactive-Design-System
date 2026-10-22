# Handoff: vector artwork doesn't import correctly, and the preview shows old images

You are picking this up cold. Repository: `/Users/raibach/Documents/Raibach_IDS`. Everything below
was verified in the session that just ended (2026-09-29). Read this whole file before touching code.

---

## 1. The two problems, in the owner's words

> *"Victory images are not importing correctly… the preview is loading old images still and you can't
> seem to fix it."*

Precisely what is being built: a Figma node is **ingested** (measured over Figma REST + MCP),
**rendered** into a Lit component deterministically, **previewed**, and then **approved** into the
Lit catalogue. The owner is running the same component through it over and over (a catalogue row
with a teal icon, a glyph, a chevron, and two text layers) to get a consistent render. Two things
fail: the artwork (vectors) still doesn't always match the design, and the preview has several times
shown something older than the ingest that just ran.

## 2. The pipeline as it now stands (verified facts — do not re-derive)

- **No model anywhere in the ingest.** `design_renderer.render_spec()` is the only builder; a design
  it cannot render is REFUSED with a reason. Every recent ingest logs `generatedBy: renderer,
  model: None`. (The only model call left in `backend/routes/figma.py` is `/api/figma/ask`, a chat.)
- **The preview checks NOTHING.** No catalogue scan, no composition, no stored element. It renders the
  design's own measurements. Composition ("use the existing component") is deliberately off until the
  owner's question exists, because composing silently substituted stored components into previews.
- **The cache is one entry with three rules and NO TIMERS**: the screen says when it leaves
  (`pagehide` + `sendBeacon` → dropped after a 5s grace, which a reload cancels), a new ingest
  replaces it, approve/discard evicts it. The 90s idle timer and the 30s heartbeat were removed on
  the owner's instruction. A screen that dies silently leaves its entry until replaced — stated, not
  hidden.
- **Every read is `no-store`**: server sets `Cache-Control: no-store, must-revalidate` (main.py:128);
  the client's `apiFetch` (LeftVerticalMenu.tsx) sends `cache: 'no-store'`; the tree/manifest reads do
  too.
- **The pane draws the ingest's own code**: `previewSrcDoc()` imports the draft source from the ingest
  response via a blob, with an `<script type="importmap">` mapping `lit` → `/@id/lit` (a blob module
  has no URL hierarchy, so bare/root-relative specifiers need the map). The code is drawn
  **unmodified** — do not rewrite it.
- **The comparison moved to approval** (owner's instruction): "we cannot do a comparison [in preview].
  We'll have to do a comparison after we approve… then say oops we've got a duplicate, do you want to
  replace it or use it." **Not built yet.** `_catalogue_children()` in routes/figma.py is the unused
  function that will drive it.

## 3. What was fixed today, and what proved it

| fix | evidence |
|---|---|
| the chevron drew **upside down** — an ancestor's flip was never composed because the vector has no `parentId`; the ancestor chain is now built from the tree (`_raw_parent_by_id`) | rendered image flipped the right way; the render gate's number fell 1.98% → 0.95% |
| the glyph drew as **one paren** where the design has `( )` — the artwork box came from a regex reading the path's numbers (`_path_box`), which mis-parses real paths; it now comes from **Figma's own stated box** for that vector, and the viewBox origin from where the transformed path actually lands | svg is now `17.24 × 17.98` (was `5.76`), matching Figma's measurement exactly |
| text layers rendered **unstyled/oversized** — a text layer was painted with `background: <fill>` and emitted as `<p><p>…`; text is now a container of runs, and mixed-style layers render as **styled spans** (bold title + grey subtitle) from `characterStyleOverrides`/`styleOverrideTable` | the catalogue row's title/subtitle now render per-run |
| borders and padding were dropped — `paddingleft:` (invalid CSS) and a missing border-inset on positioned children | the chevron's `1px solid #4e68d2` and all four paddings appear in the emitted CSS |
| a draft was drawn as the **approved file** — `previewPath()` decided by "does a record exist" rather than "is this a draft" | fixed in IngestModal.tsx |
| the preview fetched the code a **second time** through a Vite virtual module, which could serve an older copy | the pane now imports the ingest's own bytes |
| composition silently substituted **stored catalogue components** into previews | composition disabled; `composed` is empty |

## 4. What is still wrong, in order of importance

1. **The approval-time duplicate question is not built.** That is the next feature: at commit, scan the
   design's children by component reference against the catalogue, and if anything matches, STOP and
   ask *"this already exists as `<tag>` — replace it, or use the existing one?"* Nothing is written
   until answered. (`_catalogue_children()` already produces exactly that list.)
2. **The deterministic verdict is not built.** The pixel comparison was abandoned as a verdict, with
   evidence: **Figma's own SVG and PNG exports of the same node differ by ~36% even after alignment**,
   so there is no stable pixel reference. Build the check that compares **values**: for every layer,
   Figma's stated values (x, y, width, height, padding, font family/size/weight/line-height, fill,
   stroke, radius) against what the renderer declares for that layer — equality only, output as named
   rows (`layer · property · Figma · ours`), and refuse approval when any row mismatches. The renderer
   already computes every one of those values; have it record them as it writes (a manifest).
3. **Component sets are not understood**: a `COMPONENT_SET` renders as a frame with **all variants
   stacked**, and `componentPropertyDefinitions` (the VARIANT property that declares the states) is not
   read anywhere. The owner has built one: `40001207:6556` ("Component 35"), variants
   `40001207:6493` (open) and `40001207:6548` (closed), property `Property 2` with those two options.
   The intended shape: one element with a `state` attribute, one branch per variant, any property that
   cannot be honoured reported rather than guessed.
4. **`SLOT` is not a known node type** (Figma's newer slot). In that component set the glyph's holder
   is a SLOT in the open variant and a FRAME in the closed one; it works today by luck because the
   node carries real padding.
5. **Stale vendored assets**: `frontend/public/assets/` has five files; **four are referenced by
   nothing but the layer record** (`public/catalog-figma/prompt-composer.json`), and one of them is the
   *old* navy/yellow icon that misled a whole debugging session. Only `figma-9598a83b….svg` is used
   (by seven hand-built components). The plan agreed with the owner: stop vendoring for
   renderer-built components, prune anything referenced by nothing after each write, and report
   orphans in the audit.
6. **Two `PROVISIONAL` markers** (`grep -rn PROVISIONAL backend`): placement of children in a frame
   with **no auto-layout is "centre"**, not the design's measured offset (the measured-offset rule was
   tried, drew the chevron's arrow outside its box, and is disabled pending proof one variable at a
   time); and the image comparator's `0.5%` tolerance, which was a guess.

## 5. Rules that must not be broken

- **No model in the ingest path.** The owner's words: *"if the model is interpreting designs from Figma
  then we have failed."* A model attempt may only return later as an explicit, user-asked retry behind
  the verdict.
- **No caching.** *"The whole application has to be honest. Caching stuff is not allowed."* (A2UI's own
  contract is not the issue — structure is cacheable by design; this is about the transport and the
  reads of a tool a designer runs preview→discard→preview five times a minute.)
- **The preview checks nothing and carries no history** — *"It is a preview. There is nothing there.
  There is no history. There's no tagging of previous ingestions."* No hashes, no timestamps, no
  catalogue lookups, no composition.
- **Approval is the only write**, and it is the moment the component acquires standing. So the
  duplicate question and the value check both belong AT approval, before the write.
- **One change at a time, each measured.** This session's worst mistakes came from changing two things
  in one step (placement + window sizing), then attributing the regression to the wrong one.
- **Verify the app loads, not just that it compiles.** A crash reached the owner because "compiles"
  and "endpoints answer" were checked and "the page renders" was not.
- **The designer's eye is the authority on anything visual.** Reports must be either a named value
  that differs or a picture beside theirs — never a percentage.

## 6. How to run it and what to test with

```
./RESTART-LOCAL.sh                     # backend 8000 + site 5001; watch for "A2UI Catalog loaded"
curl -s localhost:8000/health          # 200
open http://localhost:5001/            # the page must be RELOADED after any edit (hmr: false)
```

Test nodes (file key `20UPR2KQMsbAxlo5NJb1se`):

- `40001207:3497` — the catalogue row: teal icon `#79a99c` 28×28 radius 6 with a white `( )` glyph
  (17.24×17.98), a chevron instance with a `#4e68d2` 1px border and a 10×6 arrow, and two text layers.
- `40001207:6493` / `40001207:6548` — the open/closed chevron variants.
- `40001204:5752` — the seat (a design already in the catalogue).

Ingest:
```
curl -s -X POST localhost:8000/api/figma/ingest -H 'Content-Type: application/json' \
  -d '{"jobId":"probe-1","fileKey":"20UPR2KQMsbAxlo5NJb1se","nodeId":"40001207:3497","notes":"probe"}'
```
Useful fields in the response: `drafts{tag: code}`, `assembled.generatedBy`, `vectorFindings`,
`renderGaps`, `validation`.

## 7. Suggested first hour for the new session

1. Load the app, open the tool, ingest `40001207:3497`, and **put our render beside Figma's own PNG of
   that node at the same scale** (`figma_service.get_node_image`). Look at it. That is the state of the
   artwork, and the owner's eye is the judge.
2. Fix whatever that comparison shows, one thing at a time, with the app loaded and re-ingested
   between changes.
3. Then build the value-by-value verdict (item 4.2), because it is the only check that can say "equal"
   without a rendering to disagree with itself.
4. Then the approval-time duplicate question (item 4.1) — the owner's step change.
5. Then component sets/variants (item 4.3), which is a new construct and a real capability.

Do not tune `_transform_path`/`_svg_for_vector` further without a measurement that names what is wrong:
that reconstruction has already absorbed ten rounds of tuning, and the owner's instruction is explicit
— *"after 10 attempts of adjusting and tweaking… we need to abandon that and figure out a different
solution."* The pivot under discussion is to inline **Figma's own SVG export** of the artwork
(`GET /v1/images/<key>?ids=<node>&format=svg`) instead of rebuilding it. Note from measurement: the
export's bounds include the effects' room (36px for a 28px box), and Figma's SVG and PNG exports do not
match each other pixel for pixel (~36% after alignment), so judge the export by eye, not by pixel diff.
