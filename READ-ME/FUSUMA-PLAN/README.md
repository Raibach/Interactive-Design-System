# FUSUMA-PLAN — a handoff for a new chat

**Written 2026-09-23.** Self-contained: a new session can read this cold, without the
conversation that produced it. Everything here is **measured**, and where something is
unverified it says so.

The name is the owner's own metaphor, from his case study:

> "The workspace customization is built like a Japanese sliding-door house (Fusuma 襖):
> the panels are movable walls, not fixed rooms."

This folder is about where the implementation falls short of that.

---

## What is in here

| file | what it is |
|---|---|
| `README.md` | this — orientation, the state of the tree, how to start the new chat |
| `FINDINGS.md` | the measurements the plan rests on, every claim with a `file:line` |
| `PLAN.md` | four proposed changes. **NOT APPROVED — NOT STARTED.** Presented, and the owner asked for it to be saved rather than executed |
| `SOURCES.md` | the open-source research from the same session, tied to named problems |

---

## The state of the tree you inherit

Nothing is committed. Two sessions' work is in the working tree, all of it verified:

```
cd frontend && npx tsc -b --noEmit     # clean
cd frontend && npx vitest run          # 466 passing, 32 files
cd frontend && npm run build           # clean
cd backend && python3 -m py_compile prompt_sessions_api.py routes/ai.py   # clean
```

Both servers were up on the machine this was written on — backend on `:8000`, the Vite dev
server on `:5001` forwarding `/api/*` to it.

**`READ-ME/CONTINUE-HERE.md` is this folder's sibling and covers different ground.** Read it
first. It records (a) how a Run was made to work end to end in this session — four defects,
all of them "one fact, two readers" — and (b) the traps that cost the most time. Three of
those traps are about driving the browser and **will cost you again if you skip them**:

- **`tab.reload()` in the in-app browser does not replace the document.** A `window` marker
  set before it survives it, so the tab keeps executing pre-edit code while *some* modules
  arrive by Vite HMR and others do not — which reads as "the fix doesn't work" when the fix
  is correct. **Open a new tab and verify with a marker.** This cost an hour.
- **`browser.tabs.list()[0]` was the old tab.** `tabs.new()` does not put the new one first.
  Match by id, and close the tabs you are not driving.
- **Playwright `click()` times out in this app** — the surface renders inside shadow roots,
  so `count()` returns 1 and the click never lands. Use `tab.cua.click({ x, y })` with
  coordinates from `getBoundingClientRect()` in an `evaluate`.

---

## How to start the new chat

Paste something like this:

> Read `READ-ME/CONTINUE-HERE.md` for the state of the tree, then
> `READ-ME/FUSUMA-PLAN/README.md`, `FINDINGS.md` and `PLAN.md`.
>
> The plan in `PLAN.md` was presented and **not approved** — I asked for it to be saved so we
> could move it to a new chat. Treat it as a proposal, not as agreed work: check the findings
> against the code yourself, tell me which pieces you would do and in what order, and flag
> anything in it you think is wrong.
>
> The standing rules are in `CONTINUE-HERE.md` §4 and are not open for redesign. The design
> is mine; the mechanism is yours.

---

## The one-paragraph summary

The owner raised three things — the opening and folding of the prompt, the availability to
look back at it, and the cross-pollination between the canvas and the prompt. Measured, those
three contain **four defects with single correct answers**, not design questions:

1. The prompt's saved width is written on every save and **never read back**.
2. The only way back to a folded prompt is a **5px** grip.
3. The drawing rebuilds on **one** of the four row events, so it is a snapshot from the last
   Run rather than a live view — one channel in each direction, three of four valves shut.
4. The model is handed the **oldest** twenty turns of the conversation, and at turn 21 the
   window stops moving.

Two things the plan deliberately leaves alone, and both are the owner's call: the
hand-drawn connection's meaning (`CANVAS-AND-PROMPT.md` §4.4 defers it), and node position
persistence (a bigger change than anything in the plan).

**CORRECTION, same day, from a parallel session: position persistence is DONE.** It measured as
three broken hops rather than a large change — the save's `drawn` getter reported the model's
x/y instead of the dragged ones, a place was filed by the node id (`seat:<i>:<kind>`, which
carries the row's slot) instead of by the row, and the rebuild ignored saved places entirely.
`positionKey` in `shared/agentFlow.ts`, `buildRepairFlow({ carried })`, and `carriedPositionsRef`
in `WritingAreaIndex.tsx` close all three; it is verified in the app, and `CONTINUE-HERE.md` §3.2
has the measurement. So: **do not re-plan it**, and expect the tree to carry 7 more tests (473)
than the count at the top of `CONTINUE-HERE.md` §1's original block. The hand-drawn connection's
meaning is still the owner's to decide.

And one thing that is a question rather than a task: **how much of the prompt survives
multi-agent turns.** Measured, a Run is one model call today, so there are no multi-agent
turns to lose context in yet — which makes it a decision to take *before* building, not a bug
to fix. That is `PLAN.md`'s closing section.
