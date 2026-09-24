# The canvas, and the sweep — the opening prompt for the next session

Paste this into a new chat. It is the whole brief: what the session is for, what it must not
re-litigate, and where the evidence already is.

---

## Read first, in this order

1. `READ-ME/CONTINUE-HERE.md` — §00d is the last session (the Run assembles its own column, the
   console keeps one conversation, the conversation controls are CRUD). §4 is the standing rules.
2. `READ-ME/CANVAS-AND-PROMPT.md` — the canvas brief. §1–§2 are the invariant, §4 is the work list.
3. `READ-ME/CANVAS-AND-CLEANUP/CLEANUP.md` — the sweep, **after** the canvas work or in a session of
   its own. It is not the same job and it should not be mixed into the canvas session.
4. `AGENTS-instructions/Core-Concept.md` and `READ-ME/THE_METHOD.md` — the loader provides the
   catalog and the instructions, **the agent provides the UI**; suppression is making an error
   disappear without making the system correct.

**The tree is committed and pushed** (`06a69bf`): `tsc` clean, 499 tests, `npm run build` clean,
`py_compile` clean. Start from that.

---

## What the session is for

**The canvas.** The owner, on what he is about to spend weeks on: *"I'm gonna spend weeks just
designing and refining this canvas view. So if you don't build the foundation solid and correct, then
as we scale it will break."* So: foundations and the drawing's own behaviour, not a feature rush.

### The work list, smallest increment first (CANVAS-AND-PROMPT §4)

1. **Editing a node edits its row.** A node's title and subtitle ARE the row's name and its first
   line; there is no second text to keep in step. **Not started.** The precedent to read first:
   tldraw keeps ONE hidden `contenteditable` overlay repositioned over whichever shape is being
   edited, not an editor per node — and that matters here because `prompt-section-editor` already has
   a note about the textarea owning its caret. One overlay keeps the caret out of the model.
   The row writers to reuse, not parallel: `_seatFor`, `_onWriteSeat`, `_onSetText` in
   `prompt-section-editor.ts`; `set-left-column-text` reaches them. A name that is one of the
   declared seats must REUSE that row, never make a second one.
2. **A hand-drawn connection gets a real meaning** — logged and dropped in `onFlowConnect` today.
   The brief defers the decision to the owner: either it becomes something the prompt can express,
   or it is written into the graph as data and drawn from it. Two precedents exist for the second
   answer, unread in the source: obsidianmd/jsoncanvas (a frozen format: a node REQUIRES
   id/type/x/y/width/height; an edge carries fromNode/fromSide/toNode/toSide/fromEnd/toEnd/label) and
   Excalidraw's arrow (`startBinding`/`endBinding` with `{elementId, fixedPoint: [x, y] ratio, mode}`,
   re-resolved when either end moves). **Decide with the owner before writing anything.**

### Then, the canvas's own rough edges — all measured, none fixed

3. **The arrival anchor is still the owner's call.** The ring's centre IS the brain, so a top-left
   corner anchor cuts the ring. One line in `startView` either way: (1) centred in the visible pane
   as now, (2) the picture's top-left at the pane's pad (the right side peeks), (3) the brain a third
   in from the left with build room to its left.
4. **Two nodes sit in the wrong place by construction.** The answer step sits two places from the
   seat it hangs off (two steps share one parent and there is only one shoulder; fix: park one
   sibling before the parent and one after). And the element-held positions on the answer and
   evaluation could not be attributed to any writer — find the writer before changing anything.
5. **A second Run reuses the canvas element**, so the column does not fade again and `holding` is
   never true: the drawing changes in place. Decide whether a re-run should re-present the column
   (a fresh mount) or change in place — the owner's call, and it is a one-line difference in the
   host's run path.
6. **The Run's wait is two model calls**: her review turn, then the column's assembly
   (`render-run`) — measured at roughly 8s end to end for the Insurance Technology Scout. Both are
   the architecture working. If it should FEEL shorter, that is a decision about what the person
   watches, not about removing a call: the button spins from the click, the doors slide when the
   column is ready, and the pane says it is working in between.

### What must not be re-litigated

- **No fallbacks.** The owner, twice: *"There are no fallbacks in this application… you don't create
  fallbacks ever."* A failure fails loud, with a name and a reason a person can read.
- **No suppression.** `READ-ME/THE_METHOD.md`: suppression is any act that makes an error disappear
  without making the system correct. Four comments in the tree name a `check:error-suppression` that
  **does not exist** — see the sweep.
- **One fact, one reader; one writer per fact.** Three of the last session's defects were a second
  reader or a second writer.
- **The words** (§4 of CONTINUE-HERE): a row is a row or a step; a capability is a **skill**; "agent"
  as a noun; "MCP" and "sandbox" never reach a person.
- **Every node action has a prompt meaning, or it does not exist.** Position is the one exception.

### How to verify anything

```bash
cd frontend && npx tsc -b --noEmit && npx vitest run && npm run build
cd backend  && python3 -m py_compile routes/ai.py routes/teacher.py conversation_api.py prompt_sessions_api.py grace_gui.py
```

Then **drive it** — three of the last session's defects passed `tsc`, 499 tests and the build and were
found only in the browser. `READ-ME/CONTINUE-HERE.md` §6 has the sequence to listen for
(`run-requested` → `a2ui:ask-grace` → `a2ui:run-held` → `a2ui:run-approved` → `flow-opened`) and §5
has the traps: **a Python change needs a backend restart; a frontend change needs a NEW TAB** (a tab
open across edits runs old code and reads as "the fix does not work"); the whole surface renders
inside shadow roots, so walk `shadowRoot`; `eventBus.emit` is a gate, not a pipe.

**A backend restart orphans the tab that is open on it** — the seat's scope read never answers, she
never greets, and it reads as "Grace is gone". Reload the tab after a restart, and check it.

---

## Two things carried over from the last session that are NOT the canvas

- **The production database mirror.** The owner's instruction: *"local is the source of truth, there
  are no users on the production, it should mirror the local."* Nothing was written to production.
  What exists: the Northflank CLI is installed (`/opt/homebrew/bin/northflank`, context in
  `~/.northflank/config.json`, project `semantic-design-system`, service `semantic-design-systems`,
  database addon `sdsmanager`), and its credentials are readable with
  `northflank get addon credentials --addonId sdsmanager --projectId semantic-design-system -o json`
  (host `primary.sdsmanager--mgtvxtd7xr2v.addon.code.run`, port 5432, external 28054, TLS on).
  `pg_dump`/`psql` are NOT installed locally. A mirror is a destructive production write: dump local,
  replace production's rows, reset sequences — decide it, do not drift into it. No schema migration
  is needed for the last session's work (`conversations.tab` and `conversation_messages` already
  exist; the code adds no column).
- **The sweep** — `READ-ME/CANVAS-AND-CLEANUP/CLEANUP.md`. Its own session.
