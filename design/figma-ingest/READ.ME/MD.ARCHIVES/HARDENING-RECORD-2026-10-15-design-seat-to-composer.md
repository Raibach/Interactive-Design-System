# Hardening the design-update flow — the running record

**Started 2026-10-15.** The goal, the owner's words: *"a 100% accurate seamless hardened ingestion
process"* — and the boundary that fixes the division of labour: *"The only way the element will be
corrected is through the design seat via our automated process and into an automatic update on the
composer. There is no other way to do it."* So this record is about the PROCESS only. Nothing in it
ever edits an element by hand; a finding is filed, never fixed in place.

**The test element:** node `40001177:2476` (`prompt-textarea-container-system`) → tag
`f-40001177-2476`, file `20UPR2KQMsbAxlo5NJb1se` (Wireframes v.4b). It is currently in **no**
catalogue (the ingest record shows one ingest + one discard, 2026-10-05, the refusal day) and its
visual is hand-drawn inside `prompt-input-section-system-role.ts`. The composer's prompt column is
the seat this flow must eventually update — automatically, through this process.

**Receipts this round** live in `runtime/design-update-hardening-2026-10-15/`
(`raw-1.json`, `ingest-1.json`, `ingest-2.json`, `code-1.ts`, `code-2.ts`, `job-1.txt`, `job-2.txt`).

---

## Round one — baseline (2026-10-15; local backend :8000, site :5001, Figma Desktop MCP :3845 — all up)

**Verified, with receipts:**

1. **The ingest runs and passes.** `POST /api/figma/ingest` for the node → **HTTP 200** (4.3 s first
   run, 0.6 s second). The 2026-10-05 refusal for this exact node ("strokes: stated and never
   reached the spec") does not fire — the paint-visibility handling is live in
   `figma_fidelity._states`. Nothing was refused.
2. **Both channels read, and are reported:** `channels: {rest: success, mcp: success}`. For this
   node MCP contributed one asset (an `mcp-url` PNG); its annotations, descriptions, layout info
   and style info were all empty.
3. **The read is LIVE — no cache.** `_fetch_figma_nodes` (`backend/routes/figma.py:1520`) calls
   `api.figma.com` directly on every ingest (`geometry=paths`); the `figma_specs` cache belongs to
   other endpoints. A one-pixel move in Figma WILL be read on the next ingest.
4. **No AI anywhere in the render.** Journal (both runs): `generatedBy: 'renderer'`, `model: null`,
   `error: null`. The only `query_llm` in the ingest file is the "ask a question" chat mode.
   `backend/design_renderer.py` contains **zero** `mcp_*` reads. For this ingest, no MCP-derived key
   reached the spec at all — the MCP reply keyed its generated code under the fallback
   `mcp-reference`, which the per-node merge never attaches.
5. **Determinism holds.** Two identical ingests → **byte-identical** draft (3794 bytes; `cmp`
   clean).
6. **The fidelity gate walks the design.** `drawn: 20 · accepted: 3 · omissions: [] ·
   missingEllipses: 0`; one policy gap named in the answer: `constraints` ("an element fixed at its
   measured size has nothing to obey them").
7. **The staged preview serves.** `frontend/.preview/<job-2>/` = the draft (byte-identical to the
   commit candidate) + the inert `behaviour/attach.ts` (PREVIEW_SEAM, "three exports that do
   nothing"); both serve **HTTP 200** through the dev server (`/@figma-preview/…`). One preview at
   a time — job-1's staging was evicted by job-2, by design.
8. **Independent alignment — my own instrument, reading Figma directly:** **21/21** measured facts
   match the emitted component exactly — size 562×45, fill #ffffff, radius 6, paddings 13/13/10/10,
   gap 10, both INNER_SHADOWs (0,2,4, rgba 0.15 · 1,0,4, rgba 0.25), area 530×25 gap 10
   align center, text "Enter prompt text." Inter 500 16/25 #767676 left.

**Instrument honesty (mine — stated before any finding is trusted):** three of my own tooling
attempts lied before the fourth told the truth. (a) A shell chain printed `DETERMINISM: DIFFER`
without ever running the comparison — the `&&` short-circuit ate the `cmp` and the `||` branch
fired on the earlier failure. (b) A float-formatting comparator printed four false MISSes
(`562.0px` vs the correct `562px`; raw float32 alpha `0.15000000596046448` vs the correct rounded
`0.15`). (c) A unit-blind check printed `font-weight` FAIL because the property is unitless. Every
one was caught by distrusting the instrument; none was a pipeline fault. Recorded because the same
class of lie is the thing this flow exists to prevent.

**Findings (named, none hand-fixed, each with a receipt):**

- **F1 — effects stacking is named, not merged.** The design states two INNER_SHADOWs; the emitted
  file declares both `box-shadow` lines with an in-file CONFLICT comment ("CSS keeps the last"),
  and CSS renders only the last one. The INGESTION carried both facts faithfully; the RENDERING
  keeps one. Whether the policy should stay "keep last, named in the file" or become a comma-joined
  declaration drawing both is a **rendering decision for the owner** — flagged, not touched.
- **F2 — latent MCP carry can refuse.** `_figma_spec_for_model` (`figma.py:2937-2939`) places
  `mcp_reference_code` (truncated to 1500 chars) and `mcp_description` into the spec **if** the MCP
  reply keys them per node; neither key is in `RENDERED_KEYS`, so the renderer-coverage check would
  **422** the ingest. Vestigial from the model era (the renderer never reads them). Not exercised
  this round. Decision needed: drop the carry, or declare it deliberately.
- **F3 — refusals are not journaled.** The unplaceable-keys 422, the renderer-empty 422 and the
  fidelity-gate 422 all raise **before** `_log_ingest`; only the size gate (413) writes a record.
  On screen the refusal is loud; in the record it does not exist. (Matches the 2026-10-05 note;
  the F1–F3 items of the repair list's territory.)
- **F4 — the room's `Compiles: yes` default.** `WritingAreaIndex.tsx`'s preview facts read
  `compileFailed = compile?.ok === false`, so a **missing** verdict renders as "yes". No verdict has
  been missing in these runs; latent. (REPAIR-LIST A5, still open.)
- **F5 — `_size_report` silently drops a child that throws while measured** (`except Exception:
  continue`, `figma.py:975-977`). Refusal path only, but the ranking that helps a designer pick a
  smaller node can omit a child with no note. (REPAIR-LIST B2 — confirmed present today.)

---

## What the next rounds still owe

1. **The delta proof.** The owner changes ONE fact in Figma (a pixel, a colour digit, an
   arrangement) → re-ingest → the diff between drafts must show exactly that fact and nothing else.
2. **Approve** (on the owner's word) → the write set + counts + gate verdict; then the composer
   refresh — where the automatic update must land (the boundary known from the design-update plan:
   the composer's prompt column draws hand-built elements today).
3. **Refusals on purpose** — a truncating node reported-not-refused; a node with an unplaceable key
   refused with the key named — to prove the loud paths are loud.

**Standing rules for this work:** nothing hand-edits an element; nothing suppresses; a fix that
changes one byte of a rendered component for an unchanged design is a regression; every claim in
this record carries its command.
