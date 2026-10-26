# WRITING AREA INDEX — THE EXTRACTION PLAN

> **Current Development instruction, 2026-10-24.** Step 1 of the room cut is executed and verified:
> the shell mounts `<DevelopmentBox>` and holds no Development state. It is 4,097 lines today. The
> remaining room steps and the tool track are
> `frontend/src/rooms/development/PLAN-remaining-development.md`; the Step 1 moves and their
> measured result are in `PLAN-sovereign-development.md`. The Phase 5 line target below (3,600) is
> historical; the plan measures its own cut rather than inheriting this scoreboard.

Owner, 2026-10-21: *"Everything is currently being loaded inside of a 12,000 line document and that
needs to change. We need to begin to systematically pull out that code and assign it to its
individual folder — product, development, governance, composer, design — they all need that code in
them … and it's only a navigation as it should be: only the header navigation which causes the
individual tabs and their respective files and folders and engines."*

This file is the plan and the scoreboard. Every phase names what leaves the page, where it goes, and
the line count the page must be at when the phase is done.

---

## BASELINE (measured 2026-10-21, before this plan)

| measurement | value |
|---|---|
| lines in `frontend/src/pages/WritingAreaIndex.tsx` | **12,108** |
| the ONE component (`export default function Index`) | starts line **390** → ~11,700 lines in one function |
| static imports in the page | **60** |
| top-level helpers above the component | 5 (canvas loaders, ground warming, shadow-root find, preview values) |
| room state machines inline | 4 (`productGateDown`, `governanceGateDown`, design seat, composer/console trees) |
| type-check of the project | `tsc -p tsconfig.app.json` → **14 errors, all pre-existing** |

**A NOTE ABOUT TYPE-CHECKING, MEASURED THE HARD WAY.** The root `tsconfig.json` has `"files": []`,
so `npx tsc -p tsconfig.json --noEmit` checks **nothing** and prints zero errors whatever the code
says. Every type-check in this plan uses `npx tsc -p tsconfig.app.json --noEmit`, and the rule is:
**the 14 pre-existing errors must not grow**.

---

## THE TARGET

`WritingAreaIndex.tsx` = **navigation only**:

- the room tab bar and the header,
- which tab is active,
- the session/package id all rooms share,
- `lazy()` imports of the six rooms.

**Exit criterion for the whole plan: ≤ 1,000 lines in that file, and no room's behaviour left in it.**

---

## THE FOLDER MAP

Each tab owns its folder; each folder exports ONE room component and imports its own engine.

| tab | folder | component | engine it imports itself |
|---|---|---|---|
| Composer | `src/composer/` | `ComposerTab.tsx` | chat panel, prompt sections, package adoption |
| Console | `src/console/` | `ConsoleTab.tsx` | console gate, card grid, AI assembly call |
| Design | `src/design/` (exists) | `DesignRoom.tsx` (exists) | Figma ingest, tools rail, seat shells |
| Product | `src/product/` (new) | `ProductRoom.tsx` | builder embed, product assembly |
| Development | `src/development/` (new) | `DevelopmentRoom.tsx` | dev lab canvas, draft canvas |
| Governance | `src/governance/` (new) | `GovernanceRoom.tsx` | trace reads, observation I/O, evals |

**THE LOADING RULE, for every room:** the index holds `const ProductRoom = lazy(() => import("@/product/ProductRoom"))`
and renders it inside `<Suspense fallback={null}>` **only when that tab is active**. The engine
modules are imported *inside* the room's folder, so nothing for that room is fetched until the tab is
clicked. This is proved by network, not by looking: no request for that room's chunk before the click.

---

## PHASES

### Phase 1 — landing helpers ✅ DONE (2026-10-21)
- **What left:** `previewValues`, `loadCanvasElements` (+ its module promise), `warmLabGrounds`,
  `loadDraftElements`, `deepFind`, `FIGMA_FILE_KEY`, `RUN_DOCK_MS`.
- **Where:** `src/canvas/pageHelpers.ts` (created).
- **Verified:** `tsc -p tsconfig.app.json` → **14** errors (unchanged); `vite build` green; the page
  imports the module and holds no copy of them.
- **Score:** 12,108 → **12,054**.

### Phase 2 — Composer out → `src/composer/ComposerTab.tsx`
- **What leaves:** the composer's JSX, its prompt-section writes, package adoption, the unsaved
  changes gate, the tab forcing that belongs to it.
- **Done when:** the composer tab still draws and sends, and the page is **≤ 10,300**.

### Phase 3 — Console out → `src/console/ConsoleTab.tsx`
- **What leaves:** the console card grid, its conversations list, the assemble-surface call and its
  failure pane, the console's package selection.
- **Done when:** console draws cards from the API and the assembly failure state still shows, and the
  page is **≤ 7,800**.

### Phase 4 — Product out → `src/product/ProductRoom.tsx`
- **What leaves:** the product room's seat, its builder embed, `productGateDown` and its clocks, the
  product assembly ground.
- **Done when:** the Product tab opens with its gate ring and lands on the builder, and the page is
  **≤ 5,200**.

### Phase 5 — Development out → `src/development/DevelopmentRoom.tsx`
- **What leaves:** the dev lab, the draft canvas writes, the lab tile ground, the dev room's seat.
- **Done when:** the Development tab opens into the lab with no assembly gate, and the page is
  **≤ 3,600**.

### Phase 6 — Governance out → `src/governance/GovernanceRoom.tsx`
- **What leaves:** every `fetchGov*` read, the observation I/O, the scores, the evals list, the
  governance seat and its gate.
- **Done when:** the Governance tab reads traces and draws its lists, and the page is **≤ 1,800**.

### Phase 7 — the page becomes navigation
- **What leaves:** everything that is not: tab bar, active tab, shared session/package id.
- **Done when:** the file is **≤ 1,000 lines**, holds no `useEffect` that fetches a room's data, and
  the only imports are React, the tab list, and six `lazy()` room imports.

---

## THE RULE FOR EVERY PHASE

1. Move code **verbatim** first (no rewriting, no "improving"); the only change is where it lives and
   what it imports.
2. `npx tsc -p tsconfig.app.json --noEmit` → **14 errors, unchanged**.
3. `npx vite build` → green, and the room chunk count does not grow at boot.
4. Click the tab in the room; it must draw exactly what it drew before.
5. Update the scoreboard line in this file with the measured `wc -l`.

No phase is "done" on a description — only on the four checks above.
