# Vector ingestion — the pivot, and the one open question

Written at the end of a long session, 2026-09-29, so the next one starts where this one ends.
Read this before touching anything about vectors.

## The decision that was made

**Stop reconstructing artwork. Use Figma's own exported drawing of it.**

What is built today reads a vector's `fillGeometry.path`, composes the chain of transforms above it,
rewrites the path's points, and emits an `<svg>` of our own. That is a *reconstruction*, and after
roughly ten rounds of tuning it still produces wrong artwork (a chevron drawn upside down, a glyph
stretched three times over, a half-pixel seating that moves when the designer centres the layer).
Tuning made the error more precise, never absent — which is the signature of a wrong method rather
than an under-tuned one.

Figma can export the node's own drawing:

```
GET /v1/images/<fileKey>?ids=<nodeId>&format=svg      → a URL to an SVG Figma produced
GET /v1/images/<fileKey>?ids=<nodeId>&format=png&scale=2
```

The export has transforms applied, flips applied, the artwork in its own box, effects included and
clipping baked in — every one of those is a thing the reconstruction gets wrong. The plan is to
inline that SVG for artwork leaves (a vector, an icon instance like `Catalog_node`), while the tree,
boxes, padding, text and composition stay ours.

## The one open question

**Does the exported SVG, rendered in a browser, reproduce Figma's own picture of the same node?**

Not answered. Two attempts, both wrong in the harness:

1. compared a 72×72 SVG export against a 56×56 PNG export — different bounds;
2. forced them to the same size — the result was garbage (45% differing, max channel difference 255,
   i.e. two different pictures), because the export's bounds **include the effects' room** (this
   icon: 36 CSS px for a 28 px box, 4 px of shadow room on each side) and the scale/bounds handling
   in the harness mixed them up.

## The exact first step

One clean test, no product code touched:

1. export the same node as SVG and as PNG at the same scale, and **print both bounds** before
   comparing anything;
2. if the bounds differ, crop to the node's box using the export's own viewBox arithmetic (do not
   guess the inset — read `viewBox` and `width`/`height` from the SVG);
3. render the SVG in headless Chrome at the SVG's own size, at the same device scale as the PNG;
4. compare like for like and report **two numbers**: pixels differing by more than 12/255, and the
   maximum channel difference. If the export is exact, both are ~0.

Node to test on: file `20UPR2KQMsbAxlo5NJb1se`, node `40001207:3511` (`Catalog_node`, the teal icon
instance with the white glyph — the one the owner has been re-making).

If it passes: replace `_svg_for_vector`'s reconstruction with the export, for artwork leaves only.
If it fails: say what blocked it in one line; do not tune the reconstruction again.

## What is in flux, and what is settled

- `PROVISIONAL` markers are greppable (`grep -rn PROVISIONAL backend`): placement by centring in a
  frame with no auto-layout, and the 0.5% tolerance. Both are stand-ins, not process.
- Settled and verified: the renderer is the only builder (no model in the ingest path); the spec
  reads text runs, truncation, opacity, rotation, clipping, radii, fills, stroke detail, sizing; the
  coverage checks (raw→spec gaps; unknown spec keys refuse the ingest); the vector transform chain
  built from the tree (this fixed the upside-down chevron); auto-layout padding read and emitted
  (the owner's own fix — their centring moved the error, which is why the pivot is needed).
- Not built: component sets/variants (both states draw stacked), the `SLOT` node type, the verdict
  shown in the preview and enforced at the commit, and the stale vendored assets under
  `frontend/public/assets/` (4 of 5 are referenced by nothing but the layer record).

## How to judge anything from here

Not by a pixel percentage. The owner's objection stands: a pixel ratio at zero offset conflates
"shifted" with "wrong", and the two thresholds inside it (12/255, 0.5%) are invented. The
deterministic check to build instead is **value against value**: Figma's own measurements per layer
(x, y, width, height, padding, font size/line-height/weight, fill, stroke, radius, path) compared
with what the renderer declares for that layer — equality, no tolerance, output as named rows.
Screenshots stay a tool a person runs, never the verdict.
