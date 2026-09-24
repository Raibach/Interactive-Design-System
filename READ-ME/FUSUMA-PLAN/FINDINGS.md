# FINDINGS — what was measured, and how

Everything below is a measurement, with the code that implements it. **Provenance is marked
per section**, because it matters:

- **[live]** — observed in the running app this session, in the browser, with the numbers
  reported.
- **[read]** — read in the source by the person writing this.
- **[swept]** — produced by a source-wide search by an agent, not re-opened afterwards. The
  line numbers should be right and the claims should be checked before acting on them.

---

## §1 — The prompt's saved width is written and never read back [read]

`frontend/src/components/lit/workspace-layout.ts:1009` — `setColumnWidths()`:

```ts
setColumnWidths(saved: { left?: number | null; chat?: number | null } | null | undefined): void {
  const chat = saved?.chat;
  if (typeof chat === 'number' && Number.isFinite(chat) && chat > 0) {
    this._rightPx = Math.round(chat);
    this._rightIsOperatorSet = true;
  }
  this.requestUpdate();
}
```

`saved.left` is never mentioned in the body. The docstring above it claims otherwise:

> "A COMPOSER LOADS EQUAL, AND A SAVED ADJUSTMENT WINS… **This is the reader.** It is called on
> open, after `openPrompt`, so the saved number is applied to the equal split rather than being
> overwritten by it."

And the comment immediately above *describes this exact bug* while fixing only half of it:

> "The save has recorded `column_widths` all along (`widths()` below reads the panes) and
> **NOTHING HAS EVER READ IT BACK**: the value went into the package's metadata and stayed
> there, so a person who widened her column and saved found it back at its default the next
> time."

Her column was given its reader. The prompt's was not.

The writer is `widths()` at `workspace-layout.ts:1031` — `{ left: this.leftCollapsed ? null :
box('.pane.left'), chat: box('.pane.right') }` — and the save reads it at
`WritingAreaIndex.tsx:1746-1756`, writing `column_widths` into the payload. So the number
makes the round trip into Postgres and is dropped on the way back.

**A test currently pins the broken behaviour**, with a comment that says so:
`frontend/src/test/workspace-layout.test.ts:451` — *"The save has always written
column_widths and nothing ever read it back."* The round-trip test is
`frontend/src/test/workspaceState.test.ts:137`.

### The subtlety that makes the fix real work [read]

`widths()` reports the left pane in **pixels**; the pane is stored as a **share** of the flex
line (`_left` / `_middle` grow numbers, `leftFlex` at `workspace-layout.ts:1374`). So the
read-back is a px→share conversion that needs a measured box — and there is none before first
layout. That is the same "no box, no fit" trap `agent-flow.ts` documents for its own fit. The
conversion has to be deferred until a box exists, and it must not clobber a width the
operator set in the meantime (the element already has `_leftOwnedByOperator` for that).

---

## §2 — The only way back to a folded prompt is a 5px grip [read]

`workspace-layout.ts:1208`:

```css
.gripper {
  width: 5px;
  background: #d1d5db;
  cursor: col-resize;
  flex-shrink: 0;
  transition: background 0.1s, width var(--dur-pane) var(--ease-settle);
}
```

and it is rendered only when the middle pane holds an element —
`workspace-layout.ts:1409`:

```ts
${this._hasMiddle
  ? html`<div class="gripper" @mousedown=${(e: MouseEvent) => this._onGripDown('left', e)}></div>`
  : nothing}
```

**What folding actually does** (`workspace-layout.ts:1194`):

```css
:host([left-collapsed]) {
  --left-sections-display: none;
  --left-control-display: none;
}
```

Those inherit across the shadow boundary and are consumed by the slotted components —
`prompt-input/prompt-container.ts:50` for the rows, `control-bar.ts:63` for the
Save/Run/Undo bar. So a folded prompt is **not rendered**, not merely narrow: the pane is at
a 60px floor (`MIN_LEFT_PX`, `workspace-layout.ts:143`) with `overflow: hidden`
(`:1094`), the rows are `display: none`, and **the control bar goes with them.**

That last part reads worse than it is: while folded, the prompt is genuinely put away, and
if you want to re-run from it you open it and the bar is there. Re-running while folded is
still reachable from the canvas footer's play button (`canvas-footer.ts:118` → `canvas-play`
→ `WritingAreaIndex.tsx:4324` `onCanvasPlay`). So this is a discoverability question about
the grip, not a missing control. Putting a horizontal three-button bar into a 60px rail
would be a design change, not a fix — noted in `PLAN.md` as deliberately not done.

**Other routes back**, for completeness: `resetArrangement()` (`workspace-layout.ts:941`,
asked for by the canvas footer's Reset) and `openPrompt()` (`:966`, called by the host when a
package opens — its comment quotes the owner: *"when I open an existing prompt … the agent
prompt area is not expanded."*).

---

## §3 — The two-way sync is one channel each way [read]

The drawing is published into the surface at `/session/middle_column/flow`
(`WritingAreaIndex.tsx:1221`), so `<agent-flow>` renders a **snapshot**, not a live
derivation.

### Prompt → drawing: one of four events

`publishFlowFromRows` (`WritingAreaIndex.tsx:1099`) has exactly **one call site**:
`onSectionAdd` at `:2422`.

| event | the model | the drawing |
|---|---|---|
| `section-add` `:2413` | updates | **rebuilds** (`publishFlowFromRows(section)`, `:2422`) |
| `section-update` `:2396` (typing) | updates (`patchSectionAt`) | **nothing** — node subtitle goes stale |
| `section-remove` `:2439` | updates (splice, name-guarded) | **nothing** — the node stays on the canvas |
| `section-reorder` `:2460` | updates (splice) | **nothing** — the nodes do not move |

The module's own claim (`WritingAreaIndex.tsx:1082`): *"THE DRAWING IS A FUNCTION OF THE
ROWS — so a row that changed rebuilds it."* For three of the four events it is not.

And the brief's invariant is that a node's subtitle **is** the row's first line
(`CANVAS-AND-PROMPT.md` §4.2). Today it is, only until you type.

### Drawing → prompt: one of five events

| event | what the host does | writes the prompt? |
|---|---|---|
| `flow-node-added` `:4256` | `rowForAddedNode` → `set-left-column-text` → `_seatFor` | **yes** |
| `flow-action: delete` `:4055` | `a2ui:ask-grace` — asks, does not delete | no (a button press is the write) |
| `flow-node-moved` | `logger.info` — positions stay in the element | no |
| `flow-connect` | `logger.info` | no |
| `flow-select` | `logger.info` + a status readout | no |

So the "complex back-and-forth orchestration" is, today, one pipe in each direction with
three of four valves shut. That is the useful reframing: the complexity the owner is wary of
has not been built, so the discipline can be built into it rather than retrofitted.

**The element tolerates rebuilds by design**, which is why §3 is cheap to fix: node identity
is `seat:<i>:<kind>` (`agentFlow.ts`), so positions held in the element's `_pos` map survive a
rebuild; and `flow-opened` fires only when the flow's **label** changes
(`agent-flow.ts:517`), so a rebuild does not re-announce.

---

## §4 — The model is handed the OLDEST twenty turns [read]

`backend/routes/teacher.py:291`:

```python
msgs = state.conversation_api.get_messages(conv_id, uid, limit=20)
```

`backend/conversation_api.py:522`:

```python
query = """
    SELECT id, conversation_id, user_id, role, content, metadata, created_at
    FROM conversation_messages
    WHERE conversation_id = %s
    ORDER BY created_at ASC
"""
params = [conversation_id]
query += " LIMIT %s OFFSET %s"
params.extend([limit, offset])
```

`limit=20`, `offset=0`, `ASC`. **That is the first twenty messages of the thread.** At turn
21 the window stops moving: the model keeps being handed the opening of the conversation and
never what was just said, permanently, and nothing says so. It is not gradual decay — it is a
freeze.

The assembled block is prose, prepended to the **system** message (`teacher.py:311-317`), not
a `messages[]` transcript:

```
=== CONVERSATION HISTORY ===
User: …
Assistant: …
```

The 20-turn window itself was known — `READ-ME/CHAT-CONVERSATION.md:234` records
*"that thread's own 20-turn history is what she is handed"* — and the size of the assembled
context was measured (`CHAT-CONVERSATION.md:136`: *"11,008 characters in 60.7s"*). The
**ordering** was not.

### Two other callers read the same way [swept]

- `backend/governance_inspector.py:158` — `limit=50`, so the daily governance pass reads the
  oldest 50.
- `backend/conversation_api.py:801` — `limit=100`, the tag-detection pass.

Both want the same decision. `routes/conversations.py:373` passes `limit`/`offset` through
from HTTP, and the chat panel draws the thread with `?limit=200` **oldest-first because it is
paginated** — so the fix has to be opt-in and must not change the default, or the thread
scrolls backwards.

### Also measured, in the same area

- **A Run is one model call.** `_assemble_prompt_output` (`backend/grace_gui.py:442-509`)
  flattens System Role + `AGENT ROLE:` + `CONSTRAINTS:` + `CONTEXT:` + `EXAMPLES:` + every
  custom row into **one** system message; the user message is the User Role plus the declared
  tool. Two messages, always. Several Agent Role rows are **not** steps — they are
  concatenated into that single string.
- **A Run is stateless.** No history, no previous run, no previous output. The history block
  is gated on `conv_id`, which is only set for `chat` mode (`teacher.py:234`).
- **No token counting anywhere in the backend.** The only truncations are ad hoc: the Tool
  Call seat at 3,000 chars (`grace_gui.py:479`), tool results at 700 chars × 10 items
  (`tool_run.py`), and the **Figma design block appended unbounded** (`figma_mcp.py`).
- **A latent trap worth one guard:** that history block is gated on `conv_id`, not on mode. A
  future caller sending `conversation_id` with `mode: 'prompt_output'` would prefix
  `=== CONVERSATION HISTORY ===` onto the JSON config, break `json.loads`, and silently land
  the run on the generic-prompt fallback.

---

## §5 — "The prompt output area" is the MIDDLE column [swept]

The owner's phrase does exist in his design, under a different name than he remembered. The
exact string `"Prompt Output"` appears in:

- `frontend/src/design/prompt-column.json:809`
- `frontend/src/design/prompt-section.json:415` — a child of the left column's prompt-accordion header
- `frontend/src/design/prompt-accordion.json:108`
- `frontend/src/design/VALUES.json:154` — the builder note, inside middle-column node
  `40000909:4165` (`data-name="output-area"`): *"Prompt Output ← match this font and size for
  out put text."*

`tag-registry.ts:669` calls the model selector *"Model selector button (Figma 40000909-4322) —
'Models' label in the Prompt Output accordion header."* So **Prompt Output names the output —
the middle column — not the prompt.**

The exact phrase *"prompt output area"* appears nowhere in the repo; *"the agent prompt area"*
appears in code comments quoting the owner (`workspace-layout.ts:974`,
`WritingAreaIndex.tsx:4439`).

---

## §6 — The case-study drift, claim by claim [read]

The published case study makes claims that the code partly contradicts. Per-claim, not
blanket — fix the code where the claim is the better product decision, edit the page where the
claim overstates what ships.

| the claim | the measurement |
|---|---|
| *"the panels are movable walls, not fixed rooms"* | True for Grace's column. **Partly false for the prompt** until §1 lands — widen it, save, reopen, and it is back to the equal split. |
| *"reopening a package restores its conversation, output, trace, and history as they were"* | True — except the **prompt's width** (§1) and the **canvas's node positions** (`drawn` in `agent-flow.ts` reports the model's `x/y`, not the dragged ones, so the save half of position persistence is not done either). |
| *"three views of one package, not three places to move between"* | Right intent; today it is **one live reader** (the prompt) and **two snapshots** — the drawing as of the last Run (§3), and the conversation's oldest twenty turns (§4). |
| *"contributions from multiple experts … are combined"* | True of the design surface, **not of the run**: several Agent Role rows are concatenated into a single call (§4). |

---

## §7 — What could not be verified

- **The grip's hit area.** jsdom has no layout, so a unit test here would pin jsdom rather
  than the element. The repo treats geometry this way deliberately (`agent-flow.ts`'s glide
  note says the same about the transition curve). Any change to it is verified by measurement
  in the browser.
- **The host wiring** — `handleRunRequested`, `onFixAll`, `onFlowNodeAdded`, `onFlowAction`
  and the section listeners live in a ~5,900-line React page with **no harness**. This is
  `CONTINUE-HERE.md` §3.4's standing item. §3's fix therefore has no unit test; its pure half
  is already covered (`agentFlow.test.ts` asserts subtitles are derived from content) and its
  wiring half is verified in the browser.
- **There is no backend test suite at all** — no `pytest.ini`, no `conftest.py`, no
  `tests/`. Backend changes follow the method `CONTINUE-HERE.md` §6 prescribes:
  `py_compile` plus a **rolled-back transaction** against
  `postgresql://localhost:5432/railway`.
