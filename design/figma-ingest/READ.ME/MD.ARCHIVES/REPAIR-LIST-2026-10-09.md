# The design line — repair list

**Written 2026-10-09, from an audit of the whole Figma ingest → preview → approve line.**
Nothing here is fixed yet. Each entry says where it is, what it does now, what it should be,
and what a fix can and cannot break — so the work can be taken one item at a time.

**The rule this list exists for** (the owner's standing law): no error suppression, no
fallbacks, no fake rendering. A statement on a screen is a statement of fact, and a false one
is the same class of fault as a hidden error.

---

## FIRST — what none of these touch

Nothing on this list changes the renderer (`backend/design_renderer.py`), the gates
(`unrendered_spec_keys`, the fidelity gate), the preview's blindness, the compile check, or
what the approve writes. The renderer's output must stay byte-identical; a fix that changes
one byte of a generated component is not a fix, it is a regression. Any work on this list
should be verified against a regeneration (`render_spec` on the same node, diff against the
working file — the replay used on 2026-10-08).

---

## GROUP A — Untrue words on screen (display only, cannot break the pipeline)

These are labels and sentences in **one pop-up** — the "Ingest Figma Design" modal, opened
from the navigation drawer's Design item (`LeftVerticalMenu.tsx`, the `open-ingest` event).
The Design room the daily work happens in does not carry any of them — checked.

**A1 — "built by the template fallback" on every ingested entry.**
- Where: `frontend/src/components/IngestModal.tsx`, the activity list entry (the line
  `built by {a.generatedBy === "assembly-model" ? "the assembly model" : "the template fallback"}`,
  in the "Added in this session / History" list).
- Now: the server records every ingest as `generatedBy: "renderer"` (`backend/routes/figma.py`,
  `generated_by = "renderer"`). The line only recognises `"assembly-model"`, so everything else —
  which is everything — prints "the template fallback". That builder does not exist any more.
- Should say: "the renderer" — or better, print the server's own value, so a new builder name
  can never be silently mislabelled again.
- Receipt that this phrase is a known lie: `backend/routes/figma.py` (~line 4613):
  *"a record that names a model which was never called is the same class of lie as a badge
  reading 'template fallback' on a rendered draft."* The codebase named this exact phrase.
- Risk of fixing: none to the pipeline. Worst case, the wording is still wrong.

**A2 — the modal's success confirmation never appears.**
- Where: `IngestModal.tsx`, the green "Grace · built — I built … It compiles. Nothing is in the
  catalogue yet" block (gated on `generatedBy === "assembly-model"`).
- Now: the gate can never be true, so the confirmation is dead.
- Should do: show for the renderer — the same confirmation the room already shows.
- Risk: none to the pipeline; this only makes a message appear where none appears today.

**A3 — dead text that claims the model failed.**
- Where: `IngestModal.tsx` — the "I did not build this one — what you are looking at is the
  template fallback" block (gated on `generatedBy === "template"`, unreachable), and the
  `AssemblyFailure` component (defined, never rendered) whose words are "the assembly model did
  not build this component" / "the preview below is the template fallback, not the model's work".
- Now: dead. Not displayed anywhere today.
- Should do: delete, or rewrite to the renderer's truth. A dead component whose text is a lie
  is a loaded gun the day someone wires it back up.
- Risk: none — nothing renders them.

**A4 — the renderer's badge is painted red.**
- Where: `IngestModal.tsx`, the badge in `SpecStrip` (colour chosen by
  `generatedBy === "assembly-model" ? green : red`).
- Now: the text is correct ("rendered from the measurements") but the colour says failure.
- Should be: neutral or green, like the other success marks.
- Risk: none — colour only.

**A5 — the "Compiles" fact defaults to "yes".**
- Where: `frontend/src/pages/WritingAreaIndex.tsx`, the preview facts — `compileFailed =
  compile?.ok === false` and `{ label: "Compiles", value: compileFailed ? "no — the approval
  will be refused" : "yes" }`. **This one is in the Design room.**
- Now: "yes" is shown when the verdict says `ok: true`, **and also when no verdict came back
  at all** (a missing entry). The server always returns a verdict today, so this has not bitten
  yet — but the fact defaults to a claim it cannot support.
- Should be: "yes" only when a verdict is present and true; otherwise "no verdict was returned".
- Risk: display only — the approve-side refusal is computed from the same verdict and is
  untouched. A wrong edit here can mislabel the fact, not open the gate.

---

## GROUP B — Real gaps (behaviour or reporting; each needs its own verification)

**B1 — a partial draft is made silently when child components cannot be fetched.**
- Where: `backend/routes/figma.py`, in the ingest — the referenced-components fetch failure
  prints `"⚠️ … only the target will be drafted"` to the server log and carries on.
- Now: the designer can receive a target-only draft with nothing on screen saying a component
  was missing.
- Should be: the sentence should travel in the ingest's answer (the channels/findings the pane
  already renders), not only to the console.
- Risk: changes the response shape; the pane must render it. Verify against a failing fetch.

**B2 — the "too large to ingest" refusal can silently omit a child.**
- Where: `backend/routes/figma.py`, `_size_report` — `except Exception: continue` around
  `_measure(child)`.
- Now: a child that throws while being measured is dropped from the ranking in the refusal
  message, with no note.
- Should be: reported ("a child could not be measured") rather than skipped.
- Risk: refusal-message path only; low, but it is a silent drop and the rule says none.

**B3 — "could not be read — no reason recorded".**
- Where: `frontend/src/components/lit/figma-layers-view.ts` (~line 1795) —
  `${this._catalogError || 'no reason recorded'}`. Observed live in the Design room's left rail.
- Now: the panel says the catalogue could not be read, and then says it has no reason.
- Should be: capture and show the actual reason (`_loadCatalog` sets `_catalogError`, but the
  observed state had it empty — the read that failed is not the one that writes the reason).
- Risk: none to the pipeline; needs the failing case reproduced to verify.

**B4 — the dev workspace logs a React hydration error (#418) on load.**
- Where: the Development room's tool (the agent-canvas app, `development/agent-canvas`).
- Now: renders and answers 200, but the console error is real and unexplained. The house
  patch's own notes say the trailing-zone arrangement fixed #418 once; it fires again.
- Should be: root-caused, not silenced. (A suppression here would be the exact fault this list
  exists against.)
- Risk: separate surface; do not touch it in the same pass as anything else.

---

## GROUP C — Decisions the owner has to make (not bugs)

**C1 — the channel rule.** The owner's words: *"We have to use both."* Today, when the Figma
desktop channel (MCP) is unreachable, the ingest **continues with the REST channel only** and
the answer reports `mcp: "unavailable"`. Honest, but not "both".
- Option 1: keep continuing, with the note (current).
- Option 2: refuse when a channel is missing (strict).
- The decision has to come before any code.

**C2 — the preview is now blind (a change made 2026-10-09, may be reversed).**
- `backend/routes/figma.py`, `PREVIEW_SEAM` was changed from re-exporting the real behaviour
  loader to three inert no-op exports. Reason: the real loader reads its companions through
  `import.meta.glob`, a Vite-only construct the production server cannot serve, so the preview
  could not load at all in production.
- Effect: the preview now draws **the Figma design exactly as measured, with no database values
  bound into it**. The committed file is unchanged (it still imports the real loader, and the
  draft file stays byte-identical to what is committed).
- Reversing it means building a production-servable copy of the behaviour loader — a real piece
  of work, not a one-line revert. Owner's call.

---

## HOW TO WORK THIS LIST

1. Take Group A first: five display fixes, no pipeline risk, each verifiable on screen.
2. Group B one item at a time, each with its own reproduction.
3. Group C needs a ruling before anything is written.

**And the standing rule for every fix here:** a fix corrects the statement or the behaviour.
It never hides the error, never adds a fallback, and never changes a byte of what the renderer
produces for a given design.
