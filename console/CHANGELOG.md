# The Console zone — changelog and what comes next

*Started 2026-10-05, on the owner's rule: every tab's folder keeps its own log, and each tab's
folder is the source of truth. This folder begins here — before today the Console's records live
in the root `CHANGELOG.md` and the git history.*

---

## 2026-10-05 — the log starts

**What this folder is.** The Console zone's own shelf. The Console is the room the shell opens
onto — the package library: the cards, the chat seats and the catalogue the assembly reads
(`frontend/src/pages/ConsolePage.tsx`; the surface comes from `backend/routes/ai.py`, intent
`render-console`).

Entries land here as the zone's work lands.

---

## 2026-10-11 — the box's Console was empty; the database wasn't (and neither was the page).

**What was seen.** On the deployed site the Console assembled **"AI assembled — 0 packages"**.
Straight answer first: that card is the page's honest EMPTY state, not suppression — and the
cause was data, not code: the box's studio database was a bootstrap skeleton (a few seat rows)
while this Mac's carried the real store.

**Fix + receipts.** The full studio dump was restored on the box (cancel-safe detached script;
`pg_restore` exit 0): `prompt_sessions` **320** · `audit_logs` **1622** · `usage_metrics`
**1327** · `figma_ingest_activity` **450**. Verified: `assemble-surface` returns the owner's
real cards (Tennis Shoe, Boots on Sale, Competitive Intelligence Analyst, My new product
idea, …).

**No code changed in this zone.** `ConsolePage.tsx`'s empty-state card, its adjacent raw
diagnostics path, and the assembly endpoint stood exactly as they were.

---

## 2026-10-21 — the console comes out of the shell: the plan

**Why.** Owner: "We should not be assembling the surface from that react shell… separate out the
console itself from the react file." Verified against the repo's own laws — the modularity law
(every tab its own file), the architecture line (a tab = its own file, own surface, own data), and
the living precedent `frontend/src/design/tools/ToolsSeat.tsx`, which already moved a tab's
assembly door out of the shell unchanged. The request is the rule, not a preference.

**Measured.** `frontend/src/pages/WritingAreaIndex.tsx` = **12,090 lines**; **70** references
couple the console assembly into the shell (`isAIAssembling`, `setConsoleTree`, `setWorkspaceTree`,
`assemble-surface`, `aiAssembly*`). The shell's boot is one state machine with a model call, so a
slow assembly looks like a slow application and `GET /api/config` queues behind it (measured:
aborted at the 10s cap with `GET /api/config timed out after 10000ms`).

**Planned, not yet executed.** `console/CONSOLE-EXTRACTION-PLAN-2026-10-21.md` — Phases 0–5:
inventory → transport (`console/consoleAssembly.ts`) → the gate (`console/ConsoleGate.tsx`) → the
seat (`console/ConsoleSeat.tsx`) → the shell slims → the proof (cold fails at 10s with its reason,
retry draws, line-count receipt). Move, never re-derive.

**Boundary, stated honestly.** This fixes the FRONTEND coupling only. The backend still runs the
model call on its event loop (`Milestone A` 8.9s cold + `Milestone B` 4.7–9.0s); that is a separate
backend pass, recorded in the plan §6.

## 2026-10-21 — Phase 1 complete: the assembly transport leaves the shell

- `frontend/src/console/consoleAssembly.ts` (99 lines) — `postAssembleSurface()`: the fetch, the
  package headers, the non-ok body read as text, the §1 envelope parse, and the failure facts.
  No React, no shell imports. The shell calls it with the same intent, context, user id and
  AbortController signal (10s, reason stated).
- `WritingAreaIndex.tsx` 12,090 → 12,050 lines. `parseValidationEnvelope` removed from its
  imports (unused there now).
- Typecheck: zero errors in either file. Build: 4.68s.
- Tunnel proof: shell → console drawn in 1.3s; `🤖 [A2UI] envelope version "v0.9.1"`; no
  `ASSEMBLY FAILED`, no `ASSEMBLY-TIMEOUT`.
- Next: Phase 2 — `ConsoleGate.tsx` (standby line, failure report, Retry, Dismiss).
## 2026-10-21 — Phase 2 complete: the gate's markup leaves the shell

- `frontend/src/console/ConsoleGate.tsx` (141 lines) — `AssemblySpinner` (slot="spinner":
  amber ring + the one true sentence), `AssemblyFailureBanner`, `AssemblyFailureReport`
  (pointer, What happened / Why / What to do now, verbatim diagnostics), `AssemblyFailurePane`.
- The shell's three gate sites call them; markup, sentences and doctrine comments moved verbatim.
- Boundary, stated honestly: the gate's STATE and the `error-retry` / `error-dismiss` listeners
  did not move. They travel with the seat in Phase 3, because the gate cannot own the state of a
  request whose caller (the shell's `assembleSurfaceThenRepairs`) has not moved yet.
- Typecheck clean. Build 4.60s. Tunnel: console drawn 978ms, no failure text.
- Line count: `WritingAreaIndex.tsx` 12,010 (from 12,090 at session start).
- Next: Phase 3 — `ConsoleSeat.tsx` (cards, renderer effect, interactions, own conversation).

## 2026-10-21 — the shell's first 635-line block leaves (mechanical move, verified)

- `frontend/src/canvas/useShellEventListeners.ts` (679 lines) now owns the shell's window-event
  wiring: the statement was **moved verbatim**, not rewritten, and every name it closes over is
  passed in through `ShellEventDeps` (14 names, all `any` for now).
- `WritingAreaIndex.tsx`: **12,055 → 11,423 lines** (−632).
- How it was done, so it can be repeated: a read-only analyser used the TypeScript parser to list
  the component's 319 body statements by true size (the shell's biggest block is a 1,286-line
  `useEffect`), then computed the chosen block's free identifiers and imports; a mover spliced the
  exact line range out and wrote the module. The scratch tools were deleted after use.
- Verified: typecheck clean in both touched files; build 4.67 s; through the tunnel the console drew
  in **1,479 ms**, and dispatching `save-template` produced the effect's own log line
  (`[save-template] Reading 0 sections + 0 chars…`) — the listeners are live from the new module.
- Next candidates, by true size (re-measure after every move — line numbers shift):
  the 1,286-line `useEffect`, `assembleSurfaceWithAI` (549), `handleTabChangeWithGate` (455),
  `handleSavePrompt` (256).

## 2026-10-21 (cont.) — the shell passes under ten thousand lines

- `frontend/src/canvas/useRunPipeline.ts` (1,360 lines) — the 1,286-line run pipeline effect
  (run-requested, the third column, the repair loop), moved verbatim with **50** named deps.
- `frontend/src/rooms/useGovernanceRoom.ts` (651 lines) — the 612-line governance room wiring
  (seat, layout grip, trace elements, tool navigation), moved verbatim with **17** named deps.
- `WritingAreaIndex.tsx`: **11,424 → 9,533 lines** (−1,891 this pass; −2,522 from 12,055).
- Verified: typecheck clean in both touched files; build 4.18 s; through the tunnel the console drew
  in **991 ms**, and clicking **Governance** mounted the room (iframe + seat + "Standing up the
  governance workspace…"), which is the moved wiring running.
- The move tool is now kept as `frontend/scripts/shell-decompose.cjs`
  (`inventory` / `analyse` / `move`): it computes the block's free identifiers and imports from the
  TypeScript AST, refuses any block that would need a shell module-scope name (cycle), and splices by
  exact line range. Use `analyse` before every `move`, and re-run `inventory` after each one —
  line numbers shift.
- Next by true size (re-measured after the moves): `return (` JSX 867, `assembleSurfaceWithAI` 549,
  `handleTabChangeWithGate` 455, `handleSavePrompt` 256.

## 2026-10-21 (cont.) — assembly callback and tab gate out; the shell is 8,535 lines

- `frontend/src/console/useAssembleSurface.ts` (590 lines) — the 549-line assembly callback that
  serves every intent, returned by a hook so every call site kept its own name. 20 deps.
  One false dependency (`middle`) was caught by the compiler: it is a renamed destructuring key
  inside the moved code, not a page value. The decomposer now excludes `BindingElement.propertyName`.
- `frontend/src/rooms/useTabGate.ts` (~500 lines) — the 455-line tab gate. 17 deps.
- Verified: typecheck clean; build 4.36 s. Composer assembly through the tunnel:
  `Surface assembled in 2190ms`, `Composer assembled with 3 sections`, envelope v0.9.1, no errors.
  Tab gate through the tunnel: Composer → Product → Development → Console all switched, no errors,
  no orphan iframes, cards back (`Console clicked → intent: render-console (direct, no gate)`).
- **A real Run was exercised end-to-end** through the moved pipeline: `run-requested` with 3
  sections → `Run held for review` → `Run stays held — she blocked it`, with Grace returning the
  five fixes for an unsaved package that has no Agent/User role. 2 model calls. The owner confirmed
  the guard is correct: a Run requires a saved package and prompts.
- `WritingAreaIndex.tsx`: **8,535 lines** (from 12,055 at the start of the pass; −3,520).
- Next by size: the 867-line JSX return (needs components, not a hook), `handleSavePrompt` (256).

## 2026-10-21 (cont.) — the save-handler move was REVERTED; one more block moved

- **Reverted, and why:** moving `handleSavePrompt` into a hook broke evaluation order — the original
  arrow referenced `assembleSurfaceWithAI`, `handleConversationChange` and `surfaceTitle` lazily (it
  runs later), while a hook call reads them **during render**, so those three were in their temporal
  dead zone (`TS2448 used before declaration`). The whole statement was restored byte-exact from the
  generated module and the module deleted. Shell back to its previous size; typecheck clean.
  Lesson for the next pass: a `const fn = async () => …` may only be moved **below** every value it
  closes over, or not at all.
- `frontend/src/canvas/useRestorePackageWorkspace.ts` (217 lines) — the 193-line effect that restores
  a package's column widths, carried places and column on open. 9 deps.
- `WritingAreaIndex.tsx`: **8,535 → 8,346 lines** (from 12,055 at the start; −3,709).
- Verified: typecheck clean, build 4.29 s. In-room re-test of this last effect did not land on the
  intended path (a click opened the Development room instead) — it is unproven in the browser and is
  recorded as such.
- Parked by the owner until the refactor is done: per-tab consoles, the Design tab's own package and
  the new session CRUD path — see `console/PER-TAB-CONSOLES-2026-10-21.md`.

## 2026-10-21 (cont.) — design preview out; the decomposer no longer trusts a typed line

- Two hand-typed end lines were **one line short** and left a statement's closing line in the page
  (the save handler at 4100, the design preview at 6821). Both were repaired immediately from the
  generated module and the tree typechecks; the save handler was then fully reverted for the
  temporal-dead-zone reason recorded above.
- The decomposer now resolves a statement's end **from the TypeScript AST** when the end is passed
  as `0`/omitted — `resolveEnd()`. Hand-typed ranges are no longer used.
- `frontend/src/design/useDesignPreview.ts` (193 lines) — the design-preview callback (175 lines),
  moved to the design folder, 1 dep (`setDesignTree`).
- `WritingAreaIndex.tsx`: **8,346 → 8,173 lines** (from 12,055 at the start; −3,882).
- Verified: typecheck clean, build 4.37 s. Browser re-test of this effect: not yet run — recorded as
  unproven, and the next pass should exercise a Design-tab preview.
