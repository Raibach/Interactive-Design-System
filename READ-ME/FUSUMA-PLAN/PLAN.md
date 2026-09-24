# PLAN — four pieces, **NOT APPROVED, NOT STARTED**

> **STATUS: a proposal.** This plan was presented to the owner and he asked for it to be
> saved so it could move to a new chat. **Approving the folder was not approving this.** No
> line of it has been written, and nothing here should be treated as agreed work until the
> owner says so. The findings it rests on are in `FINDINGS.md`, each with a `file:line`.

The owner raised three things: the opening and folding of the prompt, the availability to
look back at it, and the cross-pollination between the canvas and the prompt. Measured, those
three contain four defects with single correct answers — not design questions.

Deeper question deliberately kept **out** of this plan: how much of the prompt survives
multi-agent turns. Reasons in §5. It needs a decision before code, not a patch.

---

## Piece 1 — The prompt comes back as you left it

**The defect.** `workspace-layout.ts:1009` `setColumnWidths()` reads `saved.chat` and ignores
`saved.left`, while its docstring claims *"A COMPOSER LOADS EQUAL, AND A SAVED ADJUSTMENT
WINS… This is the reader."* So you widen the prompt, save, reopen, and it is back at the
equal split.

**The change.** Read `saved.left`, clamp it the way `_columnWidth` clamps hers, and mark the
left pane operator-owned so a later payload re-assert cannot win.

**Why this is real work and not a one-liner.** `widths()` reports the left pane in **pixels**
but the pane is stored as a **share** of the flex line (`_left` / `_middle` grow numbers). So
the read-back is a px→share conversion that needs a measured box, and there is none before
first layout — the same "no box, no fit" trap `agent-flow.ts` documents. It must be deferred
until a box exists, and must not clobber a width the operator has set in the meantime.

**Where.** `frontend/src/components/lit/workspace-layout.ts` — `setColumnWidths`, and
whatever px↔share helper the layout already has.

**Proof.** `frontend/src/test/workspace-layout.test.ts:451` currently asserts the *broken*
behaviour with a comment saying so; that test inverts. Extend the round trip in
`frontend/src/test/workspaceState.test.ts:137`.

---

## Piece 2 — A handle you can find

**The defect.** The only way back to a folded prompt is `.gripper` — **5px** painted width
(`workspace-layout.ts:1208`), drawn only when the middle pane holds an element (`:1409`).

**The change.** Keep the 5px look; give it a hit area roughly three times wider via a
`::before` with negative inline insets. A pseudo-element is the safe route because the gripper
is a flex sibling — widening it must not reflow the panes.

**Proof, honestly.** Not a unit test — jsdom has no layout, so a test would pin jsdom rather
than the element (the repo treats geometry this way on purpose). Verified by measurement in
the browser, with the number reported.

**Deliberately not included:** the 60px rail cannot hold a horizontal Run/Save bar without a
design. That is a design question, not a bug — and re-running while folded is already
reachable from the canvas footer's play button.

---

## Piece 3 — The drawing follows the rows

**The defect, measured.** `publishFlowFromRows` has exactly **one** call site: `onSectionAdd`
(`WritingAreaIndex.tsx:2422`). So:

| you do this to a row | the model | the drawing |
|---|---|---|
| add | updates | **rebuilds** |
| type | updates | stale subtitle |
| remove | updates | node stays on the canvas |
| reorder | updates | nodes do not move |

The brief's invariant is that a node's subtitle **is** the row's first line. Today it is —
until you type.

**The change.** All three listeners (`:2439` remove, `:2460` reorder, `:2396` update) already
update the model; each gains a republish.

**The one real design concern.** `section-update` fires **per keystroke**, so an unguarded
rebuild would rewrite the whole surface tree on every character. It is coalesced to at most
one rebuild per animation frame — the pattern this file already uses for the drawing's
arrival. The cost is bounded further by an existing guard: `publishFlowFromRows` returns early
when no Run has happened, so typing before a Run still costs nothing.

**Why the element tolerates this** (worth knowing before changing it): node identity is
`seat:<i>:<kind>`, so positions held in the element's `_pos` map survive a rebuild; and
`flow-opened` fires only on a **label** change, so a rebuild does not re-announce.

**Proof.** The pure half is already covered — `agentFlow.test.ts` asserts `buildRepairFlow`
derives subtitles from content. The wiring half has no harness (see `FINDINGS.md` §7), so it
is verified in the browser by watching a subtitle follow a keystroke, and that is said out
loud rather than papered over with a test that pins nothing.

---

## Piece 4 — The model gets the recent turns

**The defect.** `teacher.py:291` reads history with `limit=20`; `conversation_api.py:522` is
`ORDER BY created_at ASC` with `OFFSET 0`. **That is the oldest twenty messages.** At turn 21
the window stops moving: she keeps being handed the opening of the conversation and never
what was just said. This is the "the AI loses more and more context" the owner described —
not gradual decay, a freeze.

**The change.** Add an **opt-in** ordering to `get_messages` and have `teacher.py` ask for the
newest 20, assembled chronologically. The default must stay oldest-first, because
`routes/conversations.py:373` passes `limit`/`offset` straight through for the chat panel's
paginated draw — changing the default scrolls the thread backwards.

**Decide while you are there:** `governance_inspector.py:158` (oldest 50) and
`conversation_api.py:801` (oldest 100) read the same way. Whether the governance pass wants
the oldest or the newest fifty is a question about that report, not a bug.

**Also one line of hardening.** The history block is gated on `conv_id`, not on mode. A future
caller sending `conversation_id` with `mode: 'prompt_output'` would prefix
`=== CONVERSATION HISTORY ===` onto the JSON config, break `json.loads`, and silently land the
run on the generic-prompt fallback. One guard, because the failure is invisible.

**Proof.** There is **no backend test suite** — measured: no `pytest.ini`, no `conftest.py`,
no `tests/`. So this follows the brief's prescribed method: `py_compile` plus a
**rolled-back transaction** against `postgresql://localhost:5432/railway`, proving the
newest-N read and leaving no row behind.

---

## §5 — What this plan deliberately does not do

- **The hand-drawn connection's meaning.** `CANVAS-AND-PROMPT.md` §4.4 defers the decision to
  the owner, and this plan does not take it. The precedent for it exists (see `SOURCES.md`:
  JSON Canvas gives an edge `fromSide`/`toSide`/`label`; Excalidraw persists a binding as
  `{elementId, fixedPoint, mode}` on both ends) — but no code is worth writing before he
  decides.
- **Node position persistence.** `drawn` (the getter the save reads) reports the **model's**
  `x/y`, not the dragged ones — the person's positions live in the element's `_pos` map. So
  the save half is not done either, and it is a bigger change than anything above.
- **Token budgeting, compaction, per-step context slicing.** The multi-agent question. See
  below.
- **The 60px rail holding a Run bar.** A design problem, not a bug (Piece 2).

---

## §6 — The question to settle before multi-agent, not after

The owner: *"every time you make an adjustment, it gets more and more complex and the AI
loses more and more context… I'm not sure how much of the prompt is useful once you get into
multi-agent turns. I think this is actually an industry issue that hasn't truly been
resolved."*

**Measured, the question is premature in this build and the architecture is accidentally
well-placed for it.**

- A Run is **one model call** (`FINDINGS.md` §4). Several Agent Role rows are concatenated
  into one string. There are no multi-agent turns to lose context in yet.
- **The prompt's rows are already a partition by role** — System, User, Agent, Constraints,
  Context, Few-Shot, Tool Call. That is exactly the shape a multi-agent turn needs: each step
  gets its slice, not the whole brief. Today `_assemble_prompt_output` throws the partition
  away by concatenating all of it into one message.
- So the discipline to add is **not "compress the history."** It is **"each step assembles its
  own slice from the package"** — and the package is already the externalised state, per the
  owner's own contract.

**The risk the case study does not address**, and the one the owner named himself: every
adjustment appends a row permanently, so the prompt only grows. There is no notion of a row
that was for one run. That is the thing to decide before multi-agent execution is built,
because the answer changes where a step's context comes from — and therefore what the graph
is for.

---

## §7 — Verification for the whole plan

```
cd frontend && npx tsc -b --noEmit && npx vitest run && npm run build
cd backend  && python3 -m py_compile prompt_sessions_api.py routes/ai.py
```

plus the rolled-back transaction for Piece 4, and a browser pass for Pieces 2 and 3 with the
measured numbers reported. Nothing committed without the owner's say-so; housekeeping in
`CONTINUE-HERE.md` §3.5 stays parked.
