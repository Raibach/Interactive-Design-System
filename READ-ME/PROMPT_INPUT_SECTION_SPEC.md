# ⛔ STALE — SUPERSEDED BY LIVE MCP PULL

> **This document is now STALE.** Its numbers were drawn from an earlier Figma read
> that no longer matches the live file.
>
> **Superseded by:** `get_design_context` node `40000746:94` (prompt-input-section)
> and node `40000746:6` (left-column-panel-container), pulled 2026-09-09 via the
> local Figma Dev Mode MCP server (`127.0.0.1:3845`). Raw pulls cached at:
> `/tmp/ref94.txt` and `/tmp/ref6.txt` (this session).
>
> **Do NOT treat any value in this file as the source of truth.** Re-pull the two
> nodes above (or run `frontend/scripts/design-extract.mjs` against a fresh MCP
> cache) before implementing anything. Known stale deltas (verified this session):
> - Container node `40000746:6` is named **left-column-panel-container**, not
>   "Frame 143", and carries a **top-left radius of 10px** (only the top-left).
> - Section wrapper padding is `15px 3px` (top/bottom 15px), not `3px`.
> - `functions` (node `40000879:249`) carries **its own white fill, shadow
>   `-4px -4px 5px rgba(0,0,0,.15)` + `4px 4px 5px rgba(0,0,0,.15)`, radius 6**,
>   177.039×43 — this is the element the composed section must carry.
>
> Delete this banner and merge the corrected values into the component tree only
> after re-verifying every number against a fresh node pull.

---

# PROMPT INPUT — Figma→Lit Spec (single source of truth)

**Figma file:** `20UPR2KQMsbAxlo5NJb1se` (Wireframes v.4b — SCE Enterprise AI Prompt Platform)
**Nodes:** `40000746-6` (container) · `40000746-94` (prompt-input-section) · `40000747-217` (role reference)
**Extraction:** Figma REST API with `geometry=paths`, live pull 2026-09-09. Annotation channel verified (node 40000746-96: "this is a textarea - for active data.").

Every value below is copied from the file. Lit components implement these numbers verbatim; changes happen in Figma first, then here.

---

## 1 · Container (node 40000746-6, "Frame 143") → `<prompt-container>`

| Property | Value |
|---|---|
| Frame size | 643 × 861 (height grows with content) |
| Fill | #FFFFFF |
| Stroke | #C0BDCF, 1px (inner 1px inset frame) |
| Sections area (Frame 886938) | 602 wide, sections stacked flush — 0 gap |
| Format rail (Frame 886937) | 39 wide, right side: meatballs group (39×34, top y=1), vertical label (y=45), vertical tokens readout (y=405), meatballs group (y=803) |

### Format rail content
| Element | Spec |
|---|---|
| Meatballs (×2 per group) | 24×24 instances, 7px apart; 6 dots per group = 2 cols × 3 rows; dot 2×2, stroke #767676, weight 2 |
| Vertical label "Response Format A" | Inter 16px, weight 500, line-height 19.36, #171717, 39×350 (vertical writing mode) |
| Vertical readout "Tokens: 2022 Cost: $0.00802" | Inter 12px, weight 600, line-height 20, #767676, 39×388 (vertical writing mode) |

## 2 · Section (node 40000746-94) → `<prompt-input-section>`

| Property | Value |
|---|---|
| Section frame | 602 wide (height varies: 137.5 / 235 / 210 in container) |
| responsive-prompt-container | inner padding 3px horizontal, 15px vertical |
| section-header | 595 × 43 |
| gripper-prompt-input | 49 × 37 white, offset (0, 3) in header; two Meatballs 24×24 at x 9 and 16 |
| prompt-accordion | 547 × 43 at x 49 (0 gap after gripper) |
| role-tile | 357 × 43, #FFFFFF, radius 6; shadows: `0 4px 4px rgba(0,0,0,.25)` + `-4px -4px 10px rgba(0,0,0,.15)` |
| role-label-injection | padding-left 18px; Inter 18px, weight 700, line-height 21.784, #171717 |
| Arrow_drop_down | 14×13, 18px from tile right edge; Vector 10×6 fill #4E68D2 (exact path in prompt-icons.ts) |
| functions | 177 × 43, #FFFFFF, radius 6; shadows: `4px 4px 10px rgba(0,0,0,.15)` + `-4px -4px 10px rgba(0,0,0,.15)`; 10px gap after role-tile |
| functions-label | "Functions / Tools", padding-left 9px; Inter 16px, weight 700, line-height 19.364, #8B8B8B |
| prompt-imput | 17px below header bottom |
| status-bar-prompt-input | 40 wide; Database_fill 40 × 27.5 at top offset 10; 12px gap between icons; #222222 (Union path exact; inner band Vector stroke #33363F, weight 2) |
| prompt-textarea | 550 wide, 6px gap after rail; fill rgba(255,255,255,0.50); stroke #767676 1px; radius 6; shadows: `4px 4px 10px rgba(0,0,0,.15)` + `-4px -4px 10px rgba(0,0,0,.15)` |
| text-input-placeholder | padding 13px horizontal, 10px vertical; textarea Inter 16px, weight 600, line-height 25px, #000000, left-aligned, top-aligned |

### Role labels (verbatim from file)
`System Role` · `User Role` · `Agent Role` — plus menu-only types (Tool Call, Few Shot, Context, Constraints, Custom).

### Section content heights in the container (receipted)
| Section | DB icons | Textarea height |
|---|---|---|
| System Role | 1 | 45 |
| User Role | 2 | 145 |
| Agent Role | 2 | 120 |

## 3 · Designer annotations (the communication channel)
- Node 40000746-96 (placeholder text): **"this is a textarea - for active data."**

## 4 · Behavior contract (design-independent — CRUD is structure)
- Events (never renamed): `section-update`, `section-add`, `section-remove`, `section-reorder`, `save-requested`, `run-requested`; window events `set-left-column-text`, `force-set-section`, `add-prompt-role`, `remove-prompt-role`.
- System Role: sticky first, never changes — no type menu, not draggable, not deletable, nothing displaces slot 0.
- Arrow_drop_down opens/closes the selection menu (role types + `+ Add Section` + `Delete`); selecting updates the label automatically.
- Drag is anchored to the gripper only. Collapse/expand: role-tile click toggles the body (accordion).
- Save chain (untouchable): editor → `save-requested` → `POST /api/ai/save-surface` → PostgreSQL → Zilliz.
