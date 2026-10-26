# The Console extraction — a plan to take the surface out of the React shell

*Written 2026-10-21, on the owner's direction: "We should not be assembling the surface from that
react shell… I need to make a plan to reduce the size of the WritingAreaIndex.TSX file."*

---

## 1. Is the request legitimate? YES — verified against this repo's own doctrine

The request is not a preference; it is the architecture the repo already states and has already
practised once.

| source | what it says |
|---|---|
| Owner, 2026-10-18 (modularity law) | Never add to `WritingAreaIndex.tsx`; every tab gets its own TS file; the pattern to copy is Governance (five small files with its own `render-governance` intent) and a room that carries a tool + a chat in one surface tree is built wrong. |
| Owner, 2026-10-17 (architecture line) | Every tab = its own file, its own surface, its own data; nothing is shared except styling/theme and the slot mechanism. |
| `AGENTS-instructions/THE_PACKAGE_CONTRACT.md` §5 | The shell is not the package: shell-level things (login, left nav, evaluation lens, choosing a package) belong to the React shell; the work's surface does not. |
| `AGENTS-instructions/Core-Concept.md` | The HOST SEAT is mounted by `WritingAreaIndex.tsx` — that mount stays. The SURFACE it shows is the tab's own content, not the shell's. |
| Precedent in code | `frontend/src/design/tools/ToolsSeat.tsx` — the Tools tab's own file, which took the `render-design` section, its assembly door (`/api/ai/assemble-surface`, intent `render-design`), its renderer effect and its whole action surface **out of the shell, unchanged**. The barrier is the point: its chat, its conversation, its actions, its data. |

So the owner's observation is exactly the rule the repo wrote down: **the deterministic shell must
render first; a tab's surface is the tab's own file.**

## 2. The measured problem

| measurement (2026-10-21) | value |
|---|---|
| `frontend/src/pages/WritingAreaIndex.tsx` | **12,090 lines** |
| References coupling the console assembly into the shell (`isAIAssembling`, `setConsoleTree`, `setWorkspaceTree`, `assemble-surface`, `aiAssembly*`) | **70** |
| The console assembly function | `assembleSurfaceWithAI` lives in the shell and writes the shell's state |

**Why this makes the system fail the way it does.** The shell's boot and the console's surface are
one state machine. A model call (2–20s) gates the shell's "ready" state, so:

- a slow assembly looks like a slow application;
- the failure report, the retry and the standby line are shell state, drawn by the shell;
- `GET /api/config` queues behind the same work in the browser's own boot path (measured: aborted
  at the 10s cap with `GET /api/config timed out after 10000ms`).

The shell must be able to say "I am here" before any model answers. Today it cannot.

**Honest boundary:** the backend also blocks its event loop while the model call runs (measured
`Milestone A (Database)` 8.9s cold / 2.4s warm + `Milestone B (LLM)` 4.7–9.0s). That is a
**separate backend fix** and this extraction does not claim it. The extraction removes the
*frontend* coupling; the backend must stop running the model call on the event loop in its own
pass.

## 3. The target shape

```
console/
  consoleAssembly.ts      ← the transport: intent render-console, abort WITH ITS REASON,
                             failure-report parsing. No React. No shell imports.
  ConsoleGate.tsx         ← the standby line, the failure report, Retry, Dismiss — the tab's own.
  ConsoleSeat.tsx         ← the console surface: cards, the renderer effect, the interactions,
                             its own conversation. Mounted by the shell through the slot.
```

The shell keeps, unchanged: routing and the tab bar, auth/identity, the left navigation, the warm
grounds, the slot mechanism, and the mount line:

```tsx
<ConsoleSeat slot="view" view-tab="console" />
```

Nothing is re-derived. The code moves the way `ToolsSeat.tsx` moved: **the shell's code, moved.**

## 4. Phases — each independently verifiable, no behavior change inside a phase

**Phase 0 — the inventory (read-only).**
List every console-owned symbol in `WritingAreaIndex.tsx` with its line range: the assembly entry
points, the tree state (`consoleTree`, `workspaceTree`), the gate state (`isAIAssembling`,
`aiAssemblyMessage`, `aiAssemblyFailed`, `aiAssemblyReport`, `isFailureAcknowledged`), the retry
ref (`lastAssemblyIntentRef`), the abort controller, the `uxCapture` calls, and the JSX that draws
the console slot. Deliverable: the list, in order, with line numbers. No code changes.

**Phase 1 — `console/consoleAssembly.ts` (transport only). DONE 2026-10-21.**
Move the console's assembly call (fetch, 10s AbortController with a stated reason, response
parsing, failure report shape). Pure TypeScript. The shell keeps its own call sites until Phase 4.
Verification: the console still assembles; the failure text still names the timeout.

> Receipt (2026-10-21): `frontend/src/console/consoleAssembly.ts`, 99 lines, exports
> `postAssembleSurface()` — no React, no shell imports. The shell's inline fetch and non-ok
> body reading were replaced by one call; the package headers (`X-Package-Session`,
> `X-Conversation-Id`) moved with it, the signal and `limit=500` unchanged, and the failure
> facts (`httpStatus`, `body`, `rawBody`, `message`) are handed back exactly as before.
> `parseValidationEnvelope` left the shell's imports (no longer used there).
> Typecheck: no errors in either file. Build: 4.68s. Tunnel: console drawn 1.3s after the
> shell appeared, `🤖 [A2UI] envelope version "v0.9.1"`, no failure event.
> Line count: `WritingAreaIndex.tsx` 12,090 → 12,050.

**Phase 2 — `console/ConsoleGate.tsx`. DONE 2026-10-21 (markup; state stays until Phase 3).**
Move the standby line, the failure report, Retry and Dismiss into the tab's own file. No state
lives in the shell. Verification: in-room — cold failure at 10s with the verbatim reason, Retry
draws, Dismiss keeps the diagnostics.

> Receipt (2026-10-21): `frontend/src/console/ConsoleGate.tsx`, 141 lines — `AssemblySpinner`
> (slot="spinner": the amber ring and the one true sentence), `AssemblyFailureBanner`, 
> `AssemblyFailureReport` (pointer, What happened / Why / What to do now, verbatim diagnostics),
> `AssemblyFailurePane`. The shell's three gate sites now call them; the markup, sentences and
> doctrine comments are the shell's own, moved verbatim.
> Scope, stated honestly: the STATE (`isAIAssembling`, `aiAssemblyMessage`, `aiAssemblyReport`,
> `isFailureAcknowledged`, the `error-retry`/`error-dismiss` listeners) still lives in the shell,
> because a gate cannot own the state of a request whose caller has not moved yet. That move is
> Phase 3, with the seat. Dismiss/Retry behavior is unchanged — the listeners are untouched.
> Typecheck: clean. Build: 4.60s. Tunnel: console drawn 978ms, no failure text.
> Line count: `WritingAreaIndex.tsx` 12,050 → 12,010.

**Phase 3 — `console/ConsoleSeat.tsx`.**
Move the console surface: the cards, the renderer effect that places the seat, the interactions
(card open/select), and its own conversation wiring. The shell mounts it via the slot mechanism
(the established door: `slot="view"` + `view-tab="console"`). Verification: in-room and through the
tunnel — the console draws, its interactions work, its chat belongs to its conversation.

**Phase 4 — the shell slims.**
Delete the moved state and effects from `WritingAreaIndex.tsx`; leave the mount line and the shell
facts the seat needs (identity, session). Verification: `grep` for the moved symbols in the shell
returns nothing but the mount; `tsc` clean; the tab still loads.

**Phase 5 — the proof.**
- Cold load through the tunnel: the shell draws immediately; the console either draws or fails at
  10 seconds with the stated reason.
- Retry draws.
- `wc -l frontend/src/pages/WritingAreaIndex.tsx` — the reduction is recorded as a receipt.
- No second assembly path anywhere (`grep -rn "assemble-surface" frontend/src` names only the
  console's own file plus any other tab's own file).

## 5. The laws this work holds

- **One tab, one file.** The console's surface, data and chat live in the console's files.
- **Move, never re-derive** (the `ToolsSeat.tsx` rule). The code is the shell's, moved.
- **The shell always renders.** The deterministic shell must draw before any model answers.
- **No suppression.** Every abort carries its reason; every failure is a sentence on screen.
- **No shared state across tabs.** Nothing from the Console's conversation is readable by another
  tab, and the shell holds no tab's work state.

## 6. What comes after (not this plan)

- The same extraction for the Composer's own assembly (the shell still owns `render-composer`
  paths).
- The backend's event-loop fix: the model call must run off the event loop so
  `GET /api/config` and the other doors answer while an assembly is in flight.

---

## Appendix A — Phase 0 inventory (measured 2026-10-21; `WritingAreaIndex.tsx` = 12,090 lines)

Console-owned state in the shell:

| symbol | line |
|---|---|
| `consoleAssemblyControllerRef` | 441 |
| `isAIAssembling` / `aiAssemblyMessage` / `aiAssemblyFailed` | 480–482 |
| `aiAssemblyReport` | 485 |
| `lastAssemblyIntentRef` | 491 |
| `consoleTree` | 501 |
| `workspaceTree` | 504 |

Assembly entry and its call sites:

| symbol | line | note |
|---|---|---|
| `assembleSurfaceWithAI` | 6937 | ONE `useCallback` serving **every** intent |
| `render-console` call site | 4102 | the console's own |
| `render-composer` call sites | 3744, 5040, 5184 | the composer's — its own future pass |

**What this means for Phase 1.** The transport cannot be lifted whole: `assembleSurfaceWithAI` is
shared by all intents. Phase 1 splits it at the intent dispatch — the console's fetch, abort,
timeout and parse move to `console/consoleAssembly.ts`; the composer's path stays in the shell
until its own pass. That split is the first real cut, and it is the only place where behavior
could change, so it gets the in-room proof.

**Backend receipts that bound this work (same day).** With the ledger write moved off the event
loop and the vector-store load moved to a background thread, `GET /api/config` answers in
**2–20ms while an assembly runs** (measured 0.019s / 0.003s / 0.003s / 0.002s / 0.002s), and a warm
`render-console` assembly measured **1,966ms** (DB 193ms + LLM 1,597ms). The 10-second cap is no
longer a race against the backend on a quiet machine.
