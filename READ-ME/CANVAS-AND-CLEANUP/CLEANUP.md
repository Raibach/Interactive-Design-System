# The sweep — finding and removing suppression, fallbacks and junk

**Its own session.** Do not run it inside the canvas session: it touches almost every file, and the
canvas work needs a stable tree to build on.

The owner's ask, 2026-09-23: *"I need you to make a plan to run through this code and clean it up and
make sure it's not junked up and there's not a bunch of error suppression in it."* And the rule that
governs every judgement in it: **there are no fallbacks in this application.** A failure fails loud,
with a name and a reason a person can read.

---

## §1 — The standard, stated once

`READ-ME/THE_METHOD.md`: **suppression is any act that makes an error disappear without making the
system correct.** Three shapes of it:

1. **A swallowed failure** — an empty catch, a catch that only prints, a promise handler that answers
   with a default, `?? []` / `|| {}` where a call may have failed. The person sees a working screen;
   the reason is in a log nobody reads.
2. **A fabricated substitute** — a hardcoded prompt when a config cannot be parsed, a placeholder
   tree when the model fails, a "default" value standing in for a lookup that errored. The last
   session removed one of these from the run path (it answered `"Execute the prompt configuration."`
   instead of the person's prompt) — that is the shape to hunt.
3. **A check that does not exist.** A comment, a doc or a register that claims something is verified
   when nothing verifies it. See §2, item 1: this is already true in four files.

**What is NOT suppression**, so the sweep does not break the app in the other direction:

- A failure that is SAID WHERE A PERSON READS — the response's `warnings`, the failure banner, the
  thread, the trace. `_warn` and `warnings` are this repo's idiom and they are correct when the
  caller draws them.
- A genuinely best-effort side effect (telemetry, an optional enrichment) that names itself in the
  response or the trace AND is counted by the audit.
- A value that is legitimately absent (`conversation_id` on a package that has never been spoken in):
  absent is not the same as defaulted-over-an-error. The distinction is whether something FAILED.

---

## §2 — The measured baseline (2026-09-23, our code only)

145 source files, **502 sites** by a coarse scan (backend `*.py` + `frontend/src/**` excluding
tests, `node_modules`, `.venv`, `dist`). Coarse on purpose: this is a list to READ, not a count to
trust — several hits are legitimate (`?? []` on a genuinely optional prop). The number that matters is
that it must not grow.

| pattern | sites | first examples |
|---|---|---|
| `?? []` / `?? null` / `?? ''` on a call | 248 | `canvas-standalone.ts:508`, `:656`, `:668` |
| python: `except` → print only | 109 | `deps.py:35`, `services.py:36`, `:53` |
| `\|\| []` / `\|\| {}` | 85 | `figma_intake.py:529`, `canvas-standalone.ts:581` |
| python: `except` → `pass` | 36 | `database_pool.py:56`, `:99`, `:401` |
| `.catch(() => …)` | 15 | `main.tsx:126`, `catalogHealth.ts:60`, `repairApply.ts:150` |
| python: `except` → `return None` | 5 | `tool_run.py:193`, `:201`, `figma_mcp.py:69` |
| bare `catch {}` | 4 | `error-registry.ts:21`, `WritingAreaIndex.tsx:3303` |

**The files with the most such sites, which is where the sweep starts:**

| sites | file |
|---|---|
| 105 | `frontend/src/pages/WritingAreaIndex.tsx` |
| 76 | `frontend/src/components/lit/chat-panel.ts` |
| 16 | `frontend/src/shared/actionLink.ts` |
| 15 | `frontend/src/components/lit/prompt-section-editor.ts` |
| 13 each | `grace_memory_api.py`, `milvus_client.py`, `routes/memory.py` |
| 12 | `frontend/src/shared/agentFlow.ts` |

Also from the same scan, for the junk half of the sweep:

- `frontend/src/canvas-standalone.ts` — a standalone playground that is not part of the app's bundle
  (`main.tsx` does not import it). It accounts for the single largest block of `??` sites. **Decide:
  keep it as the design reference the canvas grew out of, or move it out of `src/`.**
- `frontend/src/storybook/**` — MDX docs describing Phases 1–4 of a retired plan
  (`InteractiveChatInterface.tsx`, `PromptWorkspace.tsx`, `ResponsivePromptBuilder` — none of which
  are in the tree any more). It reads as instructions and is not true. Either rewrite to what exists
  or delete.
- The four comments naming `check:error-suppression` (`conversation_api.py:27`,
  `prompt_sessions_api.py:1260`, `routes/ai.py:233`, `routes/teacher.py:246`).
- Dead exports after last session's removals: nothing measured yet; `npx tsc` with
  `noUnusedLocals` and a scan for exported-and-never-imported symbols is the first pass.

---

## §3 — Step 0: build the check that four comments claim exists

`check:error-suppression` is named in four files and **implemented nowhere**. The CHANGELOG describes
what it is supposed to be (2026-09-18, the governance inspection):

> The checker counts swallowed failures on the governed path, which are empty catch blocks, exception
> blocks that only print, and promise handlers that answer with a default. A new site changes the
> count; the register must match; the build fails when the two disagree.

So: `frontend/scripts/suppression-check.mjs` (same shape as `catalog-check.mjs`, which was itself
restored after being deleted) + `npm run suppression:check`, writing a report to
`frontend/catalog-audit/`-style JSON that the governance inspector can read, with:

- the three definitions from the CHANGELOG above, plus `?? default` on a call whose failure is
  indistinguishable from absence;
- an **allowlist with a reason per entry** (a legitimate optional read), because a check whose
  baseline cannot be stated is a check that will be disabled;
- a recorded count; **the build fails when the count grows**;
- the count printed in the app's own Trace, so it is not a number only CI sees.

**Do this first.** Everything else in the sweep is judged by it, and without it the sweep is one
person's opinion of 145 files.

**And extend it beyond the governed path if it holds up** — the same three shapes in
`frontend/src/**` are where tonight's silent defects lived (a lookup that found nothing because a
component was renamed; a reader that demanded a shape nothing sends). Neither was an exception; both
were the same disease, and a checker that only reads python `except` blocks would have missed both.

---

## §4 — The order, and what each pass costs

1. **The check** (§3). Then the register records 502-and-falling.
2. **The Run, the assembly, the save, the conversation writes** — the path the owner drives. Files:
   `routes/ai.py`, `routes/teacher.py`, `conversation_api.py`, the run path in `WritingAreaIndex.tsx`.
   Every site here: a failure must reach the person (the banner / `warnings` / the thread) or the run
   must fail.
3. **The two big seats** — `WritingAreaIndex.tsx` (105), `chat-panel.ts` (76). Read site by site; the
   file comments are unusually good and many sites are already documented as deliberate.
4. **The rest of the frontend** — `shared/`, `components/lit/`, `services/`.
5. **The rest of the backend** — `routes/`, the APIs, the adapters (`milvus_client.py`,
   `figma_service.py` are allowed to degrade **if they say so**; several already do).
6. **Junk** — the list in §2: the standalone playground, the stale storybook docs, dead exports,
   comments that name things that do not exist, docs whose counts are stale (the catalog check
   already fails the build on the "N trusted components" claims — run `npm run catalog:check`).
7. **The register** — the final count, recorded, with the allowlist and its reasons.

---

## §5 — How a site is decided, in one line each

- **Is the failure possible, and does anybody need to know?** If no → the code is dead; delete it.
- **Does the caller act on it?** → propagate it (`raise`, `throw`, or a returned error the caller
  draws). Do NOT return a value that looks like a successful answer.
- **Is it genuinely best-effort?** → it must SAY so where a person reads (a `warning`, the trace) AND
  be counted by the check. A `print` alone is not "said".
- **Is it a value that is legitimately absent?** → name it so (`?? null` on an optional prop is fine;
  `?? []` on the result of a call that may have failed is not). The question is always whether
  something FAILED, not whether a value is falsy.

Every change names, in its comment, the failure it now surfaces and where the person sees it. Every
change that alters behaviour gets a test in the four shapes the repo already has (§6 of
CONTINUE-HERE). **No site may be "fixed" by adding a default.**
