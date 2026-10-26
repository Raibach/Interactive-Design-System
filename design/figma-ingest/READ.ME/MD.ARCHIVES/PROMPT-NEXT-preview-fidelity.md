# PROMPT FOR THE NEXT SESSION — why the preview is a lie, and how to prove the ingest or fix it

Repo: `/Users/raibach/Documents/Raibach_IDS`. Read this whole file before touching anything.

## What the owner says, and he is right

*"Make a prompt for the next chat to try to figure out why the preview is a lie, and why it is not
showing what's in Figma… explain how you've added rules and arithmetic and all kinds of ways to force
it to display properly instead of allowing it to ingest the exact same specs… put in the prompt how
you have refused to explore whether every spec is being interpreted by the system correctly and
showing it in the template. Be sure to add in there how the template process is all fake."*

Take that literally. It is an accurate description of the last session's work.

## The doctrine this system runs on (the owner's words, same night)

- *"The Figma file is the authority, not your application."*
- *"There should be no rules. The only rule is whatever the fuck Figma says is what you do."*
- *"You're not ruling anything — you are bringing in specs from a Figma file and creating a preview
  and a temporary folder."*
- *"You can't break the protocol to get it to work. That's the wrong objective. Honesty is the true
  objective."*
- *"Zero trust means it should fail… if you're breaking the rules."*
- *"I have an instinct… Let's not use clamps at all."*
- *"It can't be missing any fucking thing."*

So: read the design, draw the design, and where something cannot be drawn, that is a DEFECT that gets
reported as a defect — never patched, never faked, never suppressed.

## What the last session did instead (do not repeat any of it)

Every one of these was added to make the picture look right instead of making the design's statement
true. All were condemned by the owner and are listed here so they are not re-invented:

| was built | why it was wrong | state now |
|---|---|---|
| a **CSS line clamp** (`-webkit-line-clamp` on `display: -webkit-box`) to draw text truncation | it buys the ellipsis by changing the box's display, and a second rule (`display: flex` for the design's own vertical centring) silently overwrote it — three lines drawn in a two-line box, nothing reported | IN THE GENERATOR NOW (restored last, at the owner's instruction to leave nothing missing). Its *rendering* has never been verified in a browser |
| a **runtime fitting pass** (`frontend/src/components/lit/behaviour/text-fit.ts`): measure, mirror-clone, binary-search the cut, insert the ellipsis | that is arithmetic invented on top of the design, computed at display time, re-deriving what Figma already decided — the owner: *"it's called error suppression and it's not allowed"* | deleted (file, its wiring in `attach.ts`, and the `data-truncate` marker it fed) |
| a **tolerance constant** (1px, then 0.5px) inside that pass | a number nobody's file states, invented so a comparison would agree: *"you can't do .43… you're not supposed to interpret"* | gone with the module |
| a **refusal** of any design containing truncation (422, "the renderer has no rule for `truncation`") | it blocked the owner's own components and asked the DESIGN to change — *"the Figma file is the authority"*, so the burden is the renderer's | truncation re-entered `RENDERED_KEYS`; the ingest no longer refuses |
| a **finding message** explaining the missing ellipsis in words against the draft | the owner: *"take the message out… load the fucking preview honestly and stop fucking with it"* | removed |
| **blanking the boxes** when a row had no value (`?? ''`) | it emptied every box in a PREVIEW, where nothing is ever handed in — text disappeared | reverted: a box shows its value when it has one, the design's own words when it hasn't |
| an **inert preview seam** that made a preview run none of the application's code | correct about the catalogue's ELEMENT, wrong about the binding: the owner ruled the preview *may* know the data binding — *"it does not have to be blind to the data binding"* | the preview's seam re-exports the application's binding through the alias |

## What has NEVER been verified (the actual gap, and the reason the preview can be a lie)

The last session proved only two things: that the generator is **deterministic** (same spec → same
bytes) and that the emitted file **compiles**. It never proved **fidelity** — that what the template
draws is what the Figma file says. A system can be perfectly deterministic and draw the wrong thing.

Specifically unproven, and unproven by construction because it was never attempted:

1. **Per-spec coverage.** No one has walked the measured spec key by key, per layer, and asked: *is
   this drawn? if not, why not — and is the absence reported where a person sees it?* The pieces exist
   (`RENDERED_KEYS`, `ACCEPTED_UNRENDERED`, `unrendered_keys`, `accepted_unrendered` in
   `backend/design_renderer.py`; `frontend/scripts/catalog-check.mjs` and the repo-root
   `scripts/catalog-check.mjs`) but they were never assembled into a spec-by-spec proof for a node.
2. **Every layer, to the bottom.** The walk is uncapped (`_figma_spec_for_model`, whose docstring
   records the cap of 4 being removed), and a print of node `40001207:3497` showed four levels with
   truncation, runs and type present — but no automated check asserts it, so nothing would notice a
   layer going missing.
3. **Instances and masters.** The design contains `Catalog_node`, an INSTANCE of component
   `40001206:3423`. The ingest reports it in `componentsUsed` and fetches nothing of it (`components`
   came back empty). Component sets / variants are not read at all. So anything defined on a master —
   truncation, states, overrides — never reaches the renderer.
4. **The preview's own fidelity.** Whether the temporary file the preview loads draws what Figma
   shows has never been checked, in a browser, by anyone.
5. **The clamp's rendering.** Twice it was measured present in the emitted CSS; once the box still
   drew three lines in a preview and the cause was never found, because the next change was made
   instead of the diagnosis. That open question is the single most concrete thing to settle first.

## What to do, in order

1. **Settle the clamp question with a browser, not with reasoning.** Re-ingest node `40001207:3497`,
   open the preview, and look at the description box: two lines with an ellipsis, or not. If not, find
   out why from the rendered document (`getComputedStyle` on that box: display, box-orient, clamp,
   height, and every rule that touches `display`) — and report the cause as a defect. Do not add a
   second mechanism.
2. **Build the spec-by-spec fidelity proof** — the thing that was refused last session. For one node,
   a table with one row per layer and one column per measured fact (size, position, layout, padding,
   gap, alignment, fill, stroke, radius, effects, opacity, clip, rotation, type style, runs,
   truncation, sizing, and the paths/svg it draws), each cell saying **drawn exactly / not drawn —
   reason / not read**. Produce it mechanically, from the measurement against the emitted file, and
   make it a check that runs in the pipeline so a missing translation can never be silent again. This
   is the honest version of "the template process": a claim per fact, proved or refused.
3. **Then, and only then, fix what the table shows missing** — in the generator, once per fact, with
   the design's own numbers, and no run-time anything.
4. **Bring in the masters**: fetch the components a design uses (the ingest already knows their ids
   from `componentsUsed`) and measure them instead of listing them and dropping them.

## Read these before writing any code

- `backend/design_renderer.py` — the whole generator and its doctrine, in its own comments.
- `backend/routes/figma.py` — `_figma_spec_for_model`, `_process_ingest_job` (the ingest),
  `_write_preview_files` + `PREVIEW_SEAM` (the temporary folder), `api_figma_commit`.
- `frontend/vite-plugin-figma-preview.ts` — how a preview is served, and why it must not resolve the
  catalogue's element.
- `frontend/src/components/lit/behaviour/` — the loader, `boxes.ts`, and the two companions (the row
  and the head): the only place a value is placed, and the only part of the app an approve cannot
  overwrite.
- `frontend/src/components/lit/draft-preview.ts` — the preview document.
- `PLANS.AGENT/figma-ingest/CHANGELOG.md` — the running record of this function, tonight's entries.
- `AGENTS-instructions/Core-Concept.md` — the operating rules, including *"Report: the design has no
  X — add it in Figma, then I'll render it"* (note: the owner has since ruled that the burden is the
  RENDERER's, not the design's — read the quotes above as the newer authority).

## How to run what exists

```
cd frontend && npx tsc -b            # typecheck
cd frontend && npm run catalog:check # the live catalogue gate (60 components, 28 findings, 3 blocking)
# the backend:  cd backend && .venv/bin/python .venv/bin/uvicorn main:app --port 8000   (no --reload:
#               a change to the generator needs a restart)
# the site:     frontend on port 5001 (RESTART-LOCAL.sh owns 5001; a second Vite on 5173 is a stale
#               leftover from Sep 27 whose config predates the preview plugin — it answers preview
#               URLs with the app's HTML, so never verify against it)
# a preview:    http://127.0.0.1:5001/@figma-preview/<jobId>/<tag>.ts  (always with a cache-buster;
#               Vite caches transforms, and a bare URL will lie to you after a discard)
```

## The standard to be held to

Do not report "done" because a test passes, a file compiles, or a render is deterministic. The only
result that counts is: **the preview shows the Figma file, and where it does not, the gap is named as
a defect in the ingest's own record.** Nothing is forced, nothing is suppressed, nothing is invented,
and the designer's file is never asked to become easier to draw.
