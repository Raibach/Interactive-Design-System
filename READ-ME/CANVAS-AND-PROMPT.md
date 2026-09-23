# The canvas and the prompt — the brief for building the nodes

This is the opening brief for the next session. It states what exists, what is
being built, and the rules the work has to obey — so the next turn starts from
the truth rather than from a description of it.

---

## §1 — One thing seen twice

The prompt's rows and the canvas's nodes are **the same rows**. Not a copy, not a
projection that has to be kept in step: a node IS a row of the prompt, and the
drawing is what those rows look like when they are connected to each other.

That is already true in one direction. `buildRepairFlow` reads the prompt's rows
and draws them as seat nodes, in the order they are stacked; a tool is drawn on
the row of the seat that names it, with the edge leaving that seat.

The work ahead is the other direction, and the point of it is adoption rather
than convenience. Martha works in the call centre. She will not read a document
about seats and steps. She will open a package, see six nodes with names she can
read, move one, rename it, add one — and the prompt she was afraid of will have
changed underneath her without her needing to be told what a prompt is. Then she
will look at the left column, recognise her own words in it, and start typing
there instead. Back and forth, each one teaching the other.

The owner, 2026-09-23:

> The user, once they're in the canvas, they can add more roles, they can do all
> the things they can do in the prompt. It feels redundant, but it's part of our
> usability, adoptability, progressive learning process. So they will be able to
> make the node change and then that change is reflected back in the prompt, and
> the prompt reflects back in the node, and it's back and forth. The prompt is
> never static — it's always dynamically updating as nodes are being managed, and
> vice versa.

**Redundancy is the feature here.** Two ways to do one thing is the cost; a person
who can start at either end is the return.

---

## §2 — The one invariant

**Every node action has a prompt meaning, or it does not exist.**

There is no canvas-only state and no prompt-only state. A node that lives in the
drawing and nowhere else is a lie told by the picture — and the picture is the
thing a person trusts most, so it is the worst place to lie. Today the drawing
says so out loud when it happens ("It is a draft — this drawing has it and the
package does not, so nothing is saved yet"), which is honest and is also the
thing this work deletes: once adding a node adds a row, there is no draft to
warn about.

The one genuine exception is **position**. Where a node sits on the canvas is not
a fact about the prompt and never will be. It already has a home: the graph the
package saves carries `workspace.graph.nodes[].x/y`, written on Save. Any other
thing that cannot be expressed as a row has to be argued for in the same terms —
a stated place where it is saved and read — and never merely held in the element.

---

## §3 — What exists tonight, and where

Read these four before writing anything.

| what | where |
|---|---|
| rows → nodes, the staircase, tools on their seat's row | `frontend/src/shared/agentFlow.ts` |
| the drawing, its toolbar, its five events | `frontend/src/components/lit/agent-canvas.ts` |
| the canvas's events, all heard here | `WritingAreaIndex.tsx` — search `THE CANVAS'S OWN FOUR EVENTS` |
| the writers that reach the rows | `prompt-section-editor.ts` (`_seatFor`, `_onWriteSeat`, `_onMergeSeat`, `_onMoveTool`, `_onSetText`, `_onInsertTool`, `_onRemoveRole`) |

**Working today:** rows draw as seat nodes in stacked order; a tool draws on the
row of the seat that names it and is joined from that seat; several tools draw as
several nodes; the run's own steps (answer, evaluation) hang off the seats.

**Recorded and nothing more** — each of these is logged to the Trace and stops
there, which is what makes them the work:

- `flow-node-added` — a node the person made on the canvas
- `flow-node-moved` — where the person put it (the element holds it for now)
- `flow-connect` — a connection drawn by hand
- `flow-action` — the node toolbar and the canvas controls
- `flow-select` — the selection

**The writers that already work**, and should be reused rather than paralleled:
`write-seat` (add to a row, making it if absent), `merge-seat`, `move-tool`,
`set-seat` (replace a row's text), `remove-seat`, plus the tags `<update_*>`,
`<set_seat>`, `<insert_tool>`, `<move_tool>`, `<merge_role>`, `<remove_role>`.
They land in the model through `patchSectionAt` / the `section-add`,
`section-remove` and `section-reorder` listeners in `WritingAreaIndex.tsx`.

**The reset**, already in place and not to be redesigned: the canvas's Reset calls
`workspace-layout.resetArrangement()`, and clearing the drawing's work means going
back and running again. A Run is what makes a picture; a cleared picture is a Run
that has not happened yet.

**And the run sequence**, which is deliberate: the prompt folds at its own pace,
a 300ms beat passes, then the drawing is published into a pane already at its
final size. `RUN_DOCK_MS` and `RUN_CANVAS_AFTER_DOCK_MS` in `WritingAreaIndex.tsx`.
The delays are the feature — they are how a person tracks what is happening.

---

## §4 — What to build, smallest increment first

Do not build all five. Each one is separately useful and separately testable.

1. **A node added on the canvas is a row in the prompt.** The node's kind picks
   the row's type, its name comes from the declaration (never from a label the
   drawing invented), and it is created through the same path a write already
   uses — `_seatFor`, not a new one. The draft warning goes away with this.
2. **Editing a node edits its row.** A node's title and subtitle ARE the row's
   name and its first line; there is no second text to keep in step.
3. **A moved node keeps its position** across a save and a reopen, in
   `workspace.graph.nodes[].x/y`. Position is the one fact that is the drawing's.
4. **A hand-drawn connection is said somewhere.** The edges the run derives are the
   prompt's own order. An edge a person draws by hand is a relationship the prompt
   cannot express today — so either it becomes something the prompt can express, or
   it is written into the graph as data and drawn from there. Decide which, and say
   why in the code. Do not let it exist only in the element.
5. **Removing a node removes its row** — through `remove-seat`, and with her
   asking first, exactly as a row removal does today.

---

## §5 — The traps, so they are not re-learned

Each of these has cost this repository a day. One line each.

- **A tag with no listener is a tag that lies.** `section-add`, `section-remove`
  and `section-reorder` were emitted for weeks with nothing on the other end, and
  `section-write-failed` had no listener anywhere: a write that landed nowhere
  said nothing, and the assistant reported success over a prompt that had not
  changed. Before adding an event, grep for its listener.
- **One fact, one reader.** Two readers of one fact drift, and the one that lies
  is always the copy nobody re-derives. This is why button states are read from
  the prompt (`shared/buttonState.ts`) instead of being remembered.
- **A name is matched by meaning, not spelling.** `agent_role`, `agent role` and
  `agent-role` are one row. A misspelled name must fill the row that exists, never
  make a second one.
- **A saved row is shaped differently from a row being edited.** Stored seat rows
  carry `{section, role, content}`; the editor's carry `{name, type, content}`.
  Read the name as `name || section || role || type`.
- **Backticks do not belong in a `css` or `html` template literal**, even inside a
  comment: they end the literal. `tsc` does not catch it. Six occurrences so far.
- **She writes what she was told to write, and invents the rest.** When a reply
  offers a button with an action the app does not know, the person is told the app
  cannot do it — so either implement the name she reached for (`move-tool` was
  hers) or put the real vocabulary in her instructions.
- **Silence is not consent.** A held Run is released by `<run_ok/>` and nothing
  else; a missing verdict must leave it held, and must not leave the button
  spinning either.

---

## §6 — The standing constraints

From the owner, and not open for a redesign in this work.

- **One interface for everyone.** Permissions change what a person can DO in the
  surface, never which surface they are given.
- **No developers in the system.** Nothing here assumes someone edits a file to
  change what the app can do.
- **The words in the interface:** a row is a row or a step; a person's word for a
  capability is a **skill**; the words "agent" (as a noun), "MCP" and "sandbox"
  never reach a person. "Agentic flow" is fine in the catalogue, never in front of
  Martha.
- **No red walls.** Nothing refuses a person at the point of typing. The wall is
  the held Run, and it is made of one sentence and a button.
- **The schematic must be learnable from itself.** The node's name is the prompt's
  word for that row. If a node needs a legend, the naming is wrong.

---

## §7 — How to start

```bash
cd frontend && npm run build && npx vitest run     # 429 green as of accf6ba
cd backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000   # API on :8000
cd frontend && npm run dev                          # the site on :5001 (strict)
```

Then: read the four files in §3, pick **one** increment from §4, and write the
test that fails without it before writing the change. The tests in
`src/test/agentFlow.test.ts` show the graph's contract, `promptSectionWrite.test.ts`
shows how a row write is proven, and `chat-panel.test.ts` shows how a button is
proven — the same three shapes apply here.

When the increment is done, the person should be able to do this and nothing
should surprise them:

> open a package, move a node, rename it, add one, draw a line between two, save,
> close it, open it again — and find the prompt holding the same six rows it held
> when they left, in the same order, with the same words.
