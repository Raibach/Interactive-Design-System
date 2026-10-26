# Design room — findings, and the plan for replacement and remediation (2026-10-05)

*Written 2026-10-05 at the owner's ask: the findings filed in the Design zone's own folder, with the plan to move forward — replacements where something must be restored, remediation where something must be fixed. All times are local (backend timestamps are UTC−5). Nothing in this document has been applied to any build; every step waits for the owner's word. Every claim below carries its receipt or is marked OPEN.*

---

## 0. The state this document records

- The running build is branch `pre-removal-build` @ `b82ca8e` (Sun 2026-10-04 00:48) — the commit directly before `ee99a1d` (Sun 13:11), which removed the Add-Design-System form. It loads 63 trusted components, 7 partitions; site and API live.
- Nothing pushed; nothing rewritten. The five-file edit of this morning is preserved in `git stash@{0}` ("design-room session 2026-10-05 …"), not in any build.
- Parked builds, each one checkout away (`git checkout <branch>` + `bash RESTART-LOCAL.sh`):
  `demo-mode` @ 88c7542 (Mon) · `friday-build` @ 4e7d5c0 (Fri) · `pre-ingest-build` @ 166e527 (Wed Sept 30 morning) · `pre-removal-build` @ b82ca8e (running).

## 1. Findings — why the design-room ingest refuses

The symptom: submit a Figma node → 422 **"Nothing was written: this design states something the pipeline cannot account for…"** — and the middle column stays empty (this path still has no wait state; it was fixed and rolled back with the set — see M0).

The machinery, in the order a design passes through it:

| stage | where | what it does |
|---|---|---|
| translation | `backend/routes/figma.py` → `_figma_spec_for_model()` (~2560+) | keys in `_CONSUMED_KEYS` are placed into the spec; **every other key is carried under `stated`** ("carried, not faked") |
| the rename table | `backend/figma_fidelity.py` → `RAW_TO_SPEC` | the raw→spec renaming as data (`absoluteBoundingBox`→`size/position`, `strokes`→`stroke`, `fillGeometry`→`paths/svg`, …) |
| the checker | `backend/figma_fidelity.py` → `fidelity_report()` / `_states()` / `key_coverage()` | one row per fact per layer with a verdict: `drawn` / `not-read` / `not-drawn` / `defect`; carried keys are either examined (`STATED_REASONS`, 17 keys) or **omissions** |
| the gate | `backend/figma_fidelity.py` → `fidelity_gate()` (~560); raised at `routes/figma.py` ~4476–4488 | **BLOCKS** on an omission, a `not-read`, a `not-drawn`, or an unmeasured defect. Only the truncation defect reports without blocking (`b522871`). One blocking row refuses the whole ingest. |
| the builder | `backend/design_renderer.py` → `render_spec()` | the only builder; **no model runs on this path** |

**Live receipts (read-only probes against the running build, 2026-10-05):**

- `40001177:2476` (`prompt-textarea-container-system`) → **1 blocking row**: `strokes: stated and never reached the spec` — the exact refusal quoted above. Counterfactuals: visible+solid stroke → **passes**; hidden stroke, or a visible **gradient** stroke → refuses.
- `40001177:2458` (`prompt-input-section-sytem-user-seat-one`) → **8 blocking rows**: four unexamined keys — `` `booleanOperation` ``, `` `boundVariables` ``, `` `minWidth` ``, `` `styles` `` ("stated by the design and no examination covers it") — plus four facts that never reached the spec: `Database_fill (INSTANCE) · fills`, `Subtract (BOOLEAN_OPERATION) · fillGeometry`, `system-role-dropdown (FRAME) · strokes`, `prompt-textarea-container-system (FRAME) · strokes`. Counts: 160 drawn, 31 accepted-with-recorded-reason, 4 never-read.

**The two internal contradictions, named:**

1. **The paint predicate.** The checker treats a non-empty `strokes` list as "stated" without consulting `visible` — and has no `visible` case for `fills` either (the `Database_fill` row is that case in the flesh) — while the spec builder correctly carries only visible paints, and only SOLID strokes (`routes/figma.py:2646`). The two halves of one layer disagree, so any frame with a hidden border is guaranteed to refuse.
2. **The geometry transport.** `fillGeometry` is carried **only for `type == "VECTOR"`** (`routes/figma.py:2654`). A BOOLEAN_OPERATION (the `Subtract`) states geometry that never reaches the spec → `not-read`. The renderer already draws shapes from paths, so widening the transport is a drawing change to verify visually — not a new capability to build.

## 2. Findings — when it broke, and why build-hopping could never fix it

| date | commit | what it did |
|---|---|---|
| Mon Sept 28, evening | *(journal)* | the design-room nodes built and approved — the ingest working |
| Tue Sept 29, 13:47–15:53 | `7b1c757`, `7d92bb6`, `5c33830` | the f- naming rule codified (`backend/mapper/figma-to-lit.ts` added); the f- component files written |
| **Wed Sept 30, 21:08** | **`6cedc71`** | **the rework: design-room ingest stack + carry-all + the fidelity gate + the room's row redesign** |
| Wed Sept 30, 21:12 | `b522871` | the one softening — truncation reports, does not block |
| Thu Oct 1 → Mon Oct 5 | `aa5c416` … `88c7542` | the gate and the spec builder **untouched**: zero diff of `figma_fidelity.py`, `design_renderer.py`, `figma_service.py` between `b522871` and the running build; `routes/figma.py`'s later changes are only the Add-Design-System ZIP ingest (Fri) and its lab/symlink/accept rework (Sat) — separate sections, no hunk touches the gate |

**The ingest journal** (`backend/logs/figma-ingest.jsonl`, 427 records) — the independent witness:

- Heavy successful use Sept 27–30 (231 ingested / 46 approved / 93 discarded across the file).
- **The last success before today: `2026-10-01T02:08Z` = Sept 30, 21:08 local** — the minute of the rework.
- **Silent Oct 2–4** — no records at all.
- Today, exactly two records: `f-40001177-2476` ingested (the fix-era live test) and discarded 14 seconds later. When the fix was rolled back, the refusal returned (verified by probe).
- **Refusals are not journaled** (the gate raises before the log call) — refused attempts leave no trace.

**Conclusion.** The break arrived with the Wednesday-night rework and is present in every build since — Thursday through Monday. **No build switch can restore "last week's" behavior, because that behavior was never in those later builds.** Only the remediation below can change it.

## 3. Findings — the f- identity labels

- **The f- system is alive** (verified). The rule file `backend/mapper/figma-to-lit.ts` ("THE DEFINITIVE TAG NAMING FUNCTION — `f-{figmaIdWithColonAsHyphen}`") exists in every build; the ingest names every component `f-<node>` (`routes/figma.py:4228`); five f- files exist; the system even GREW at the Wed-night commit (`f-40001206-3423` added there); today's run created and discarded `f-40001177-2476`. All-branch scans: **nothing f- was ever deleted.**
- **Where the visible f- labels went — found.** Through Sept 29 the room's rows carried the f- catalogue key as a chip; the old stylesheet says it in words: *"THE CATALOGUE'S OWN KEY — f-40001204-5752 beside the layer a designer knows it as"*, with a `_label()` special case for `f-` names. **The Sept 30, 21:08 rework replaced that chip with the `FigmaNode: <node id>` line** (`codeLine = origin ? 'FigmaNode: …' : elementTag`). So `f-40001204-5752` now renders as `FigmaNode: 40001204:5752` — same node, new form. That is the change remembered as "the f- labels are gone" — a row redesign inside the same rework, not a removal of the system.
- **OPEN — one exact string:** `f-40000746` has never existed in any commit (history-wide scan empty). The 40000746-family components were built before the rule, under semantic keys (`prompt-input-section` ← `40000746:94`, `prompt-textarea` ← `:95`, `prompt-container` ← `:6`). If a specific row is remembered, name the screen and the date and it can be traced.

## 4. Ruled out (checked, not the cause)

- **`design-system-picker`**: lived only Sat 09:37 → 22:13 (`bf7204c` adds, `1928901` deletes) — in none of the builds we ran.
- **Add-Design-System ZIP ingest**: a separate route (`/api/catalog/ingest`); never touches the gate. (Its removal is desired — see R2.)
- **The last build-hop**: `b82ca8e` vs the commit before it (`d5ae943`) is docs only (+77/−28, 4 files) — rolling one commit back would change nothing.

## 5. The plan — replacement and remediation

**Rules for every step below** (the owner's rules, kept): smallest possible diff to existing code; a read-only before/after proof FIRST (the probe pattern of today); nothing lands without the owner's word; nothing pushed without "push"; each step independently revertable; no rewrites.

### Remediation — the ingest refusals, in this order

**M0 — the ingest wait state** *(owner-approved this morning; rolled back with the set; rides the remediation when it lands).* The design submit should show the middle-column wait (spinner + one sentence — no model runs on this path) exactly as a composer Run does; a refusal ends the wait as a success does.

**M1 — the paint predicate, made one rule.** *Scope:* `figma_fidelity._states` — consult `visible` for `strokes` the way the builder does; align the `fills`/`effects` handling between the checker and the sibling predicate in `routes/figma.py` (`_states_value`). *Fixes:* `40001177:2476` (proven end-to-end this morning before the rollback) and the hidden-paint rows in `40001177:2458`. *Does not fix:* visible gradient paints — correctly still blocked under the doctrine until M2b. *Proof:* re-run `verify_gate.py` (2476: before=blocks / after=passes) + one live ingest on the owner's word. *Preserved in:* `stash@{0}` — reused, not rewritten.

**M2 — the geometry transport, widened.** *Scope:* `routes/figma.py:2654` — carry `fillGeometry`/`strokeGeometry` for the shape family (BOOLEAN_OPERATION at minimum; STAR / ELLIPSE / POLYGON carry the same trap), through the same path fitter the renderer already draws. *Fixes:* `Subtract · fillGeometry`. *Also:* a short diagnosis of `Database_fill · fills` (confirm whether it is the same paint family or instance handling — measure before claiming). *Risk:* this changes what is DRAWN — verify visually (the Subtract shape should start appearing in the draft).

**M2b — conditional:** if the nodes carry visible gradients the renderer can draw, carry them (measure first). Only what is drawn may pass; nothing is silenced without a measurement.

**M3 — four examination entries, with measured reasons.** *Scope:* `figma_fidelity.STATED_REASONS` for `styles`, `boundVariables`, `booleanOperation`, `minWidth` — each entry records WHAT WAS MEASURED (e.g., a named style's resolved values already travel in `fill`/`type_style` — verify per node), exactly like `size` / `overrides` / `blendMode` do. No blanket exemptions: a reason written for one value stops applying the moment the design states another.

**M4 — only as a last resort, class by class:** a fact with a recorded measurement that still cannot be placed may be REPORTED instead of blocking — the owner's own precedent from `b522871` ("a gate that refuses every design protected by it is a wall in front of the door"). Not before M1–M3.

**Done means:** both nodes (`40001177:2458`, `40001177:2476`) ingest end-to-end and the journal shows the `ingested` record for each. Live tests run on the owner's word only.

### Replacement — restore what is missed / complete what was decided

**R1 — the f- key back on the room's rows.** Restore the f- identity display (options: beside the `FigmaNode:` chip, or in the code slot). *Scope:* `figma-layers-view.ts` row logic. *Proof:* before/after capture of the same rows. On the owner's word.

**R2 — complete the Add-Design-System removal** (owner: the feature leaves; the form + catalogues were already deleted Sunday). Inventory verified in the mainline: backend routes `POST /api/catalog/ingest` + `POST /api/catalog/{system}/accept` (`routes/figma.py`), `scripts/prepare_design_system.mjs`, `wireframe-lab/ADD-A-DESIGN-SYSTEM.md` + `IMPORT-A-DESIGN-SYSTEM.md`, and the draft-marker readers (the palette filter in `routes/ai.py`). The exact deletion list is shown before anything is deleted.

**R3 — OPEN, needs a decision:** whether the pre-rule components (the 40000746 family) should receive f- identities retroactively — a deliberate change, not a repair. No action proposed without the owner's word.

**R4 — out of scope here, noted so they are not forgotten:** the Sunday evening dark-mode reverts and the onboarding/demo commits after the running build — untouched by this plan.

### The base the work lands on

Recommended: the `demo-mode` mainline (Mon @ `88c7542` — newest, and the Add-Design-System form already gone), once the owner says switch. Until then the running build stays as it is.

## 6. Appendix — the receipts, exactly as run

- **Read-only proof harness, writes nothing:**
  `PLANS.AGENT/design-room-2026-10-05/verify_gate.py` (node 2476: as-fetched = 1 row / gradient = blocks / visible-solid = passes) and `probe_node_2458.py` (the 8 rows above), plus `PLAN.md` (this morning's trail).
- **Journal:** `backend/logs/figma-ingest.jsonl` — 427 records; per-day counts (Sept 27: 17 · Sept 28: 100 · Sept 29: 189 · Sept 30: 44 · Oct 1-UTC: 75 · Oct 2–4: none · Oct 5: 2); kinds (231 ingested / 46 approved / 93 discarded / 11 failed / 3 legacy refused / 37 removed); the discard log where the f- tags live in plain sight (`f-40001207-3497` ×38 … `f-40001177-2476` ×1).
- **Git receipts:** the zero-diff proofs (`b522871`→`b82ca8e` for `figma_fidelity.py`, `design_renderer.py`, `figma_service.py`); the f- file add dates (Sept 29); the old row CSS comment and `_label()` verbatim; the label swap inside `6cedc71`; `b82ca8e`'s docs-only contents; the floor of the search — `git log --all -S'f-40000746'` = empty.
- **The failing nodes:** `40001177:2458` (`prompt-input-section-sytem-user-seat-one`) and `40001177:2476` (`prompt-textarea-container-system`), file key `20UPR2KQMsbAxlo5NJb1se`.
