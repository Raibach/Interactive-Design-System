# Continue here

The brief for the next session. Read this first, then `READ-ME/FLOW-REQUIREMENTS.md`
(what a prompt must be before a Run), `READ-ME/CANVAS-AND-PROMPT.md` (the canvas
brief) and `READ-ME/CHAT-CONVERSATION.md` (§10–§11 are the console's rules).

**There is a second brief: `READ-ME/FUSUMA-PLAN/`.** This document covers *a Run now
works*; that folder covers *the fold, the way back to the prompt, and the two-way
sync*, with four measured defects and a four-piece plan that is **NOT APPROVED and
NOT STARTED**. Its `README.md` has the opening prompt for a new chat.

**Rewritten 2026-09-23, at the end of the session that made a Run work.** Everything
below is measured, not remembered. Where something is unverified it says so.

---

## §00 — THE LATEST SESSION: the ring is spaced, the clamp is gone, the panels part

**Read this before §1.** Written at the owner's stopping point, 2026-09-23 late evening.
Nothing committed. `tsc` clean, **491 tests pass** (33 files, up from 484), `npm run build`
clean, `py_compile` clean on the four backend files, backend restarted and healthy
(`milvus: DISCONNECTED` remains the one degraded service).

**What the session was for:** the owner asked for a simple test prompt that reaches the
internet, and then, watching it run, reported four usability defects in the canvas.

**1 · THE TEST PROMPT EXISTS AND RUNS.** `Insurance Technology Scout`
(`277f60ce-29eb-4371-b9c9-5fa2b38f37be`) — four rows (System, User, Agent, Tool Call), the
Tool Call row carrying `{{tool:search-the-internet}}` with its question on the last line.
Verified twice: it passes the app's own `reviewFlow` with **zero unmet requirements**, and it
was driven in the browser — the skill reached Google News for real and the briefing came back
newest-first with publisher, date and "why it matters". **This discharges §0's pending item
"the RUN with real nodes was not demonstrated"**: the canvas drew all seven nodes (four seats,
the tool, the answer, the evaluation).

**2 · THE RING PLACED NODES BY THE TILE, NOT BY WHAT THEY DRAW.** A ring's radius was floored
at `NODE_TILE` (88) while a node draws `NODE_FOOTPRINT` (142 — the tile plus the 54px label
block under it), so the hub sat 88 from its first row and the boxes ran through each other by
47px. Measured on a 9-node ring: two rows 81 apart in x and 141 in y against a box of 88×142 —
one pixel of overlap in each direction. `RING_STEP` is now derived
(`ceil(hypot(88, 142)) + 24`), because two boxes that size cannot overlap once their centres
are that far apart *at any angle*, and a ring sweeps every angle. **`shared/agentFlow.ts`**;
the arrival view had the same reading error in **`agent-flow.ts`'s `startView`** (it measured
`NODE_TILE` in y while `fit()` measured the label block — two readers of one fact) and both
read `NODE_FOOTPRINT` now. Live: 7 nodes, **zero overlaps**. New tests assert no overlap at
7/8/9/11/13/15 nodes.

**3 · THE ORIGIN CLAMP — the owner called it and was right.** `Math.max(0, …)` on both axes in
the pointer drag and the arrow-key move meant no node could go left of or above the origin, and
the edge layer's box ran `0..max` *because* of it ("Positions are clamped at the origin (see
_onMove), so the box needs no negative half"). The ring broke that assumption, so every
connector to a negative-coordinate node had correct geometry, correct stroke, and drew nothing
— which is the owner's "the lines are gone". **The clamp is removed and the layer's box covers
both halves.** Live: 6 edge paths all with geometry, the box reading `-641 -544 1222 1038`, and
a node dragged from `(-166, 96)` to **`(-481, -61)`**.

**4 · THE PANELS NOW PART IN THE MIDDLE.** `_dockLeft` zeroes the prompt's share and the
leftover went to "whoever grows: the canvas when there is one, and her column when there is
not" — but the canvas arrives 300ms later, so for that beat `_hasMiddle` is false, the middle
had no grow, and **her pane took all 1220 freed pixels and swept across, then snapped back**.
Now the middle holds the space while the prompt is docked and her pane never absorbs
(`rightAbsorbs` deleted). Measured through the dock: prompt 640→60, middle 0→610, and
`rightXBefore 640 / rightXMinimum 640` — **the chat never moves left.** One consequence to
decide on: on the console, folding the prompt now leaves the gap in the middle instead of her
column taking it, which is consistent with "each takes their side" but is a visible change.

**THE SPINNER IS STILL OPEN, and it is a PLACEMENT question, not a missing control.** Three
indicators exist and all were checked: `control-bar`'s RUN button (spinner + "Running…"),
`canvas-footer`'s Play button (spinner + "Running…"), and `compiled-output-viewer`'s animated
progress stripe + "Running… Ns". The owner cannot see one because the control he presses is the
one the Run removes: the prompt docks 520ms in and the bar carrying its spinner folds to its
rail; the canvas footer's arrives only when the canvas mounts. Between them the middle's stripe
is the only motion. **Where the busy state should live instead — the rail, or the middle's
opening column — is his call and he is bringing design direction.** The mechanism he described
(a floor so the indicator is not a flicker) already exists: `MIN_RUN_BUSY_MS`.

**5 · EXAMINED AND DELIBERATELY LEFT.** `grace_gui.py:497` still defaults a missing User Role to
the literal `"Execute the prompt configuration."`. The review blocks an empty User Role (S2)
before a Run, so it is unreachable through the UI, and it does not hide a failure — named, not
swept. And the dock leaves a ~30px drift in her column (640→610) because "equal shares until
someone chooses a width" gives her no fixed number while the prompt is docked.

**6 · ALSO THIS SESSION.** The console chat history was cleared: 24 conversations, 111 messages,
backup at `~/Documents/console-chat-backup-2026-09-23.json`; the console session row and the
empty Approvals seat were kept. And a silent substitution was removed from the run path — the
chat history is no longer read in `prompt_output` mode (it was being prepended to the JSON
config, breaking `json.loads`, and `_assemble_prompt_output` answered the failure by running
`"Execute the prompt configuration."` instead of the person's prompt). It now **refuses with the
reason as a 500**.

---

## §00b — THE PANELS DO NOT FALL BACK TOGETHER, AND THE CODE SAYS WHY

**This is the open item, and it is the last thing the owner raised: "Why does the left column close
first? There's something wrong with that. They should just both close, fall back at the same time.
What is the problem in the code?"** Answer, measured — three separate faults, and they compound:

**1 · THEY ARE DRIVEN BY TWO DIFFERENT EVENTS, 800ms APART.** The prompt's fold is
`workspace-layout._dockLeft()` — it fires on the Run click and zeroes the prompt's share. Her
column's retreat is driven by `_rightOverDrawing`: "is there a drawing in the middle", which cannot
be true until the canvas has been fetched and mounted, `RUN_DOCK_MS + RUN_CANVAS_AFTER_DOCK_MS`
later. So hers is *inherently* second: nothing docks her on the click.

**2 · AND HERS IS NOT AN ANIMATION AT ALL — IT IS A MODE CHANGE.** Measured in the rendered app,
sampling `.pane.right` every 40ms through a Run:

```
t=3449…3921   x 643 → 670   width 637 → 610   position: static    transition: flex-grow   ← smooth
t=3921→4529   x 670 → 853   width 610 → 427   position: absolute  transition: width       ← THE JERK
t=4529…5162   x 853 → 1176  width 427 → 104   position: absolute  transition: width       ← smooth
```

She is sized by **`flex-grow`** while there is no canvas and by **`width`** once the drawing lands
(`OVER_DRAWING_SHARE`). CSS cannot interpolate across a change of property, so at that instant the
pane teleports 183px and then resumes — the owner's "there's no reason for them to jerk like that."

**3 · THE FIX IS ONE MECHANISM, AND THAT IS THE WHOLE OF IT.** He said it himself: "there's one way
to do it, one way to do it." Give her column the same sizing property in BOTH states and a dock of
her own that fires WITH the prompt's:

- **Her column is always `position: absolute; right: 0` sized by `width`** — a share (50% with no
  drawing, `OVER_DRAWING_SHARE` with one) or the operator's px. It is already a layer over the
  drawing when a canvas is up; when there is none there is nothing under her, so nothing is lost.
- **The Run sets both docks in one frame**: the prompt's share → 0 AND her width → her rail, so the
  two sides fall together and the middle opens between them (the middle already holds the space —
  see §00 item 4).
- **The middle becomes one mode too**: absolute, spanning everything right of the prompt, with
  `pointer-events: none` while it holds no canvas. Then no pane in the shell switches mechanism,
  and the only animated property anywhere is a width.

**NOT DONE, DELIBERATELY.** The owner's instruction: "please don't create some jiggered up fake
bullshit. You're gonna have to build this correctly." Masking the teleport with a transform or a
one-off animation would be exactly that. The change above touches the prompt's share arithmetic
(three shares of one line, not two), the empty middle's pointer events, the console's 2-column
case, the operator's saved width and the collapsed rail width — it wants a deliberate pass with
tests, and it is the first thing to do next session.

**Everything else in §00 stands.** The ring is one band (420×526, arrival zoom 0.867), the origin
clamp is gone from all three places it existed, the connectors draw, her panel fades out with its
rail instead of popping (measured: opacity 1.00 → 0.77 → 0.57 → 0.17 → 0.00 over 760ms, `visibility`
only after), the panes ease over 760ms (`--dur-pane` and `RUN_DOCK_MS` moved together), 491 tests
pass, `tsc`/`build`/`py_compile` clean, nothing committed.

**Still open, in one line each:** the spinner's placement (§00 item 5); the answer step sitting two
places from the seat it hangs off, because two steps share one parent and there is only one
shoulder (fix: park one sibling before the parent and one after); and the element-held positions on
the answer and evaluation that I could not attribute to any writer.

---

## §00c — THE ASSEMBLY CANNOT BE RUSHED OR STACKED, AND THE CANVAS IS NOT ASSEMBLED AT ALL

**The owner's principle, stated the same evening: "the assembly process of your A2UI-native
application — the assembly is an important part of the process. It can't be rushed. It can't be
stacked."** And the architectural charge that goes with it: *"if those nodes are not being called
from the A2UI library by a model, then you've not only violated the protocol, you've created this
jarring effect."*

**THE CHARGE IS CORRECT, AND IT IS IN THE CODE.** Measured tonight:

- `/api/ai/assemble-surface` is called **once** in the whole shell
  (`src/pages/WritingAreaIndex.tsx:3211`) — that is the console, the composer and a session. The
  **Run does not assemble anything.**
- The Run **patches the tree by hand**: `setWorkspaceTree` writes
  `next[i] = { id: middleId, component: 'AgentCanvas', theme: 'dark', children: {...} }` straight
  into the live components array (~`:1304`–`:1410`), and the canvas's data
  (`/session/middle_column/flow`) is computed in TypeScript by `buildRepairFlow`
  (`shared/agentFlow.ts`, called at `:1175` and `:1213`) and pushed into the model by hand.
- So **the third column is forced through the envelope rather than assembled through it**, while
  the console's own cards — the same class of thing — arrive from the model against the catalog.
  The one surface a person watches most closely is the one the protocol does not build.

**AND THAT IS WHAT MAKES THE PANELS JERK — the two faults are the same fault.** The hand-patched
tree carries `"isThirdOpen": true` on its `workspace-layout` (`backend/routes/ai.py:994`; the
console's carries `false` at `:629`), and every published update writes it into the element. So:

1. `dockPrompt()` **does** close both columns in one frame — `_dockLeft()` and
   `_setThirdOpen(false)` (workspace-layout.ts:719), and that is the sequence the owner asked for.
2. But the next published update re-asserts `isThirdOpen: true` and **undoes her dock**. Her column
   therefore does not move until the CANVAS's own update lands, ~800ms later.
3. That update is also the moment her unit changes — flex pane → absolutely positioned layer —
   which no transition can cross, so she teleports 183px (the measurement is at `rightStyle` and in
   §00b).

One fact — *is her column open* — with two writers, and the payload wins. The same disease the file
names everywhere else: **one fact, one writer.**

**WHAT TO DO, IN THE OWNER'S TERMS (next session, deliberately — it cannot be rushed either):**

1. **Assemble the third column on Run, through the same effect the cards use** — the model against
   the catalog, as a surface — instead of patching the components array in the host.
2. **Hold the drawing back until both sides have SEATED**, and show a **spinner on the background
   in the middle** while it is held: *"you could do a spinner on top of our background and just not
   load the nodes until the sides have seated."* The middle is empty during that window today and
   nothing in it says the application is working — this is also the spinner's placement, which has
   been open all evening (§00 item 5).
3. **One writer for her open state during a Run** — the payload stops asserting it (or the dock
   claims it the way the left already claims `_leftOwnedByOperator`).
4. Then the drawing mounts into a layout that has already settled, which is exactly how the
   prompt's own fold was cured when it used to jump (see the FLIP note in workspace-layout).

**A SPIKE IS WANTED, NOT A PATCH.** The owner: *"I think we're gonna have to maybe do some research,
maybe a spike on how to get these nice flows. It may be necessary for us to restructure the code. I
think probably load order has something to do with it."* Agreed — and worth writing down before the
hour is too late: the load order IS the defect (a hand-patched tree racing a layout that has its own
dock), and the restructure he is reaching for is the one the protocol already prescribes.

**AND THE REASON IT MATTERS IS NOT SPEED.** *"It doesn't have to be fast. The application is not
about fast — speed is not the experience."* The Run's sequence is the product's first impression:
the button spins, both sides slide back, the middle says it is working, then the picture is there.
Every one of those is a place where the app either looks like it knows what it is doing or does not.

---

## §0 — A LATER SESSION THE SAME EVENING: the AI was taken out of the assembly, and put back

**Read this before §1: it corrects a mistake, and the correction is the state you inherit.**
The owner reported a production 503 — `A2UI FAILURE: DeepSeek API request failed: Request timed
out. (waited 10s; this is a SURFACE and 10s is its contract)` — on opening a package. The session
that followed **took the model out of the surface assembly entirely** and composed the four
component trees in Python instead. **That was error suppression, not a correction**: it made the
error disappear by removing the thing that failed, and it removed the AI from the one job this
architecture exists to give it (`AGENTS-instructions/Core-Concept.md`: the renderer provides the
catalog and the instructions, **the agent provides the UI**; `READ-ME/THE_METHOD.md`: "Suppression
is any act that makes an error disappear without making the system correct"). The owner said so
plainly and was right: *"you took out the error instead of correcting it … this is an AI-native
system, it's not React, it's not hardcoded, if it doesn't work it fails."*

**THE CORRECTION, which is what is in the tree now:**

1. **The AI assembles all four surfaces again.** The removed prompts, their `query_llm` calls,
   their parse/validate blocks and their `usage`/`llm_used` reporting were restored verbatim from
   the committed file (`git show HEAD:backend/routes/ai.py` — they were never in a commit of their
   own, so nothing was lost). Nothing of the Python-tree work remains in that file. Receipt after a
   restart: `[DeepSeek API] deepseek-v4-pro — mode=surface_assembly … 45s` → `OK — 2117 chars in
   4.1s`, `llm_used: true`, and the model's own `ai_message`.
2. **What actually failed was a constant, not the model.** `grace_gui.py`'s own provider note says
   it: *"deepseek-flash times out under the surface budget — deepseek-v4-pro is the only model
   used."* The 10s socket killed the fast model and then sat in front of a REASONING model that has
   to compose a twelve-component JSON document; measured successes run 3–8s and the failures hit
   exactly 10s. It is now `LLM_TIMEOUT_ASSEMBLY` (default **45s**, env-overridable) with the
   measurement written above it — **one attempt, no retry, no cache, no fallback tree**, and a
   failure is still a loud 503 with diagnostics.
3. **Two of the panel's own save commands were silently blocked**, which is why a person could
   press Save — on her control or on the button she offered — and nothing was written: they sent
   `{ command: 'save-button' }`, and `eventBus.emit` runs `validateTag` first, which reads
   `command.tag` (none) → "Unknown tag: undefined". A second subtlety: a prop with a `default` is
   still REQUIRED by that gate, so `save-button` must carry `state` and `label`. Both sites now go
   through one `_emitCommand(tag, props)` helper in `chat-panel.ts`.
4. **The names she reached for are implemented** (`shared/actionLink.ts`): `save`, `set-title`,
   and `run` (which releases the held Run as her approval). A BARE `set-title`/`set-description`
   is not a refusal — the person's words are what is missing, so it is handed back to her as a
   question (`requestForAction`), and her answer comes back as the spelled button.
5. **Her review ask now names the vocabulary** (`WritingAreaIndex`, the run-review brief): the
   exact action forms for each blocker it can name. Every form in that list has a matcher in
   `actionLink.ts`; adding a line without one is how that list becomes a lie.
6. My own two defects from that work, corrected: her column opened on the console load (the
   payload decides it now, not `openPrompt`), and a failed canvas load only logged (it now raises
   the app's own failure banner and substitutes nothing).

**WHAT THE OWNER ASKED FOR EARLIER THAT SESSION, AND STILL STANDS** (each verified in the app):
the drawing composes into the pane a person can SEE (`agent-flow.viewportInset`, measured off the
two boxes by the host, which is why the brain no longer lands on the seam under her column); on a
Run BOTH columns collapse to their rails and the canvas takes the room; a pick no longer opens her
and the rail's chat icon pulses slowly (2.6s) when she has something waiting; the canvas's code
and its 591KB ground are fetched on Run only (`index` 745.9 → 696.7 kB, `agent-flow` + `agent-canvas`
as their own chunks); the canvas foot says "Running…" with a spinner.

**THE TRAPS THAT COST TIME, so they are not re-learned:**

- **A Python change needs a RESTART of the backend; a frontend change needs a NEW TAB.** The
  backend runs without `--reload`, and a tab open across many edits gets some modules by HMR and
  not others — which reads as "the assembly is gone" and is not. Two of this session's hour went
  to chasing that. `/tmp/backend-8000.log` is where the restart's output went.
- **A measurement through `document.querySelectorAll` sees nothing inside shadow roots.** A count
  of `agent-card-element` read 0 while the console was rendering 8 cards inside the grid's own
  shadow tree. Walk `shadowRoot` (the page's `deepFind`), or the answer is a lie.
- **`eventBus.emit` is a gate, not a pipe.** It validates before dispatch — see the save bug above.
- **HEAD still holds whatever a session deletes from the working tree**, which is how the AI's
  prompts came back; `git show HEAD:<file>` is the recovery path before inventing a substitute.

**STOPPING POINT AND WHAT IS PENDING** (the owner asked for a stopping point here; nothing is
committed, `tsc` is clean, 484 tests pass, the build and the Python compile are clean):

- **The RUN with real nodes was not demonstrated in this session's last state.** The package on
  screen was an unsaved DRAFT ("Untitled Prompt"), and her review blocks its Run for exactly that
  reason — *"The package has never been saved, so there is nothing to run yet"* — which is correct
  behaviour, not a failure. To see the canvas: press one of her repair buttons or **Save Template**,
  then RUN. (The earlier drive in the same evening did show the canvas with the seven nodes.)
- **The catalog's own drift is unfixed, and the restored audit says so**: `AgentCanvas.children`
  declares `{flow, seat}` while the element renders `{header, flow, footer}` and no seat slot
  (`frontend/scripts/catalog-check.mjs`, `npm run catalog:check` — 5 blocking findings: that slot,
  plus the docs' "51 trusted components" against the catalog's 55).
- **The arrival anchor is still the owner's call**: the ring's centre IS the brain, so a
  top-left corner anchor cuts the ring; the choice is (1) centred in the visible pane as now,
  (2) the picture's top-left at the pane's pad (right side peeks), (3) the brain a third in from
  the left, with build room to its left. One line in `startView` either way.

---

## §1 — The state you inherit

Nothing is committed. The working tree holds two sessions' work, all of it verified:

```
cd frontend && npx tsc -b --noEmit     # clean
cd frontend && npx vitest run          # 473 passing, 32 files
cd frontend && npm run build           # clean
cd backend && python3 -m py_compile prompt_sessions_api.py routes/ai.py   # clean
```

**Added later on 2026-09-23, in the session that read the open-source references and then closed
§3.2's first item:** "a moved node keeps its position" is **DONE** and driven in the app — see that
entry for the whole chain and what was measured. 7 new tests (466 → 473). Nothing else on the list
moved, nothing is committed.

**Read the diff before you change anything.** `git status` and `git diff` are the truth
about what was built; this document is the truth about *why*, and the two disagreeing
is a bug in this document.

---

## §2 — What this session made work: **a Run now runs, and the canvas draws**

The goal it was set: *"we have not been able to run a prompt successfully and generate
the nodes on the canvas."* It runs now. Verified end to end in the live app on
**Insurance News Scout**, 2026-09-23, not inferred from tests:

```
press RUN     → run-requested · a2ui:ask-grace · a2ui:run-held · a2ui:run-blocked
                (correct: the prompt really did have two blockers)
press APPLY ALL → run-requested · flow-opened
                → <agent-flow> on screen, 7 nodes:
                  System Role · User Role · Agent Role · Tool Call ·
                  search-the-internet · Answer · Evaluation
```

**Four defects sat between the Run button and that picture.** Each is fixed, each has
a test, and each is worth reading before you touch the files they live in.

1. **The review could not see the description.** `reviewFlow` was handed
   `currentPromptSession.description`, and the composer assembly never carried that
   field — so a package whose description was on screen (the console card shows it, the
   seat reads it) was reviewed as `(none)`. I2 is blocking, its repair is `via: 'words'`,
   and the "Add description" button was **disabled**, because the seat's own reader could
   see the description. Held forever, no button able to clear it.
   → `frontend/src/shared/packageFacts.ts` (new): the description is read the way the
   seat reads it — surface first, row as fallback. `assembledSession` now carries
   `description`, the same hop `workspace` already had.

2. **The review could not read a saved row's name.** A saved row is
   `{section, role, content}` — **no `name`, no `type`** — and the review read
   `type || name`, which answers `''`. `''` is its own `empty` kind, so
   `isUndecidedType('')` is FALSE and the reader fell to `normalizeSectionType`'s
   documented `custom` default: **the System and User rows of every saved package became
   two rows called `custom`.** S2 said "There is no User Role" over a User Role with
   words in it, and T6 reported the pair as one row sent twice. Both blocking, both
   `via: 'words'`, both unclearable. This was the one that made a Run impossible.
   → `declaredName` / `seatIdOf` in `frontend/src/shared/promptSections.ts`, used by
   `flowReview.ts` and `agentFlow.ts`. CANVAS-AND-PROMPT §5 already said it: *"Read the
   name as `name || section || role || type`"* — `buttonState.ts` had it right and the
   other two did not.

3. **Apply all was unreachable.** `a2ui:fix-all` had a handler, an action name in
   `actionLink`, and a dispatch in `chat-panel` — and **no surface ever drew a button
   with it, and nothing ever told her to offer one.** The one control that clears the
   repairs the app can make for itself did not exist on any screen.
   → the app now offers it in its own voice, in the thread, exactly when a press would
   do something (`runHoldingRepairs`: blocking **and** a kind the press handles).
   `mechanicalRepairs` is wider and is deliberately not what the button claims.

4. **Apply all could not start a Run.** A block ENDS a Run (`handleRunBlocked` clears the
   held payload, on purpose), so by the time the person works the list there is usually
   nothing held to release — and Apply all cleared the blockers and then asked a question
   that could run nothing. Measured: the list came back *"nothing — every requirement is
   met"* and no canvas appeared.
   → when the list clears, it **starts** the run, reading the rows from
   `<prompt-section-editor>` (synchronous, source of truth) rather than the surface,
   whose copy React has not committed yet.

**And the drawing was given a fifth defect's worth of names it could not read.**
`flowInputRef` mapped each row to `{name, type, content}` — dropping `section` and
`role`, i.e. dropping the name. A package reopened from the library therefore drew
*"One row I cannot name yet — a row with no name, a row with no name"* while the prompt
beside it was perfectly named. One reader now (`declaredName`), and the row rides over
whole.

---

## §3 — What is left, closest first

### 1. The canvas composes the drawing into a box half of which is under the chat
**Measured, and the code's own stated intent is what is defeated.** On a Run:

```
<agent-flow>  box    x=65   width=1535     ← full-bleed
<chat-panel>  box    x=800  width=800      ← an OVERLAY on top of it
                → the visible canvas is 65..800, i.e. ~735 wide
startView:  rect.width = 1535, zoom = 1, panX = 724
                → the brain lands at x=789; the ring spans 549..1029
                → the right half of the picture is behind Grace's column
```

The overlap is **by design** — workspace-layout:1121 says her column *"covers it"* as a
pane-over-canvas, and `agent-flow`'s own scrim comment describes a node *"half-covered by
the chat"* read as hidden rather than missing. So this is not a layout bug to undo. What
is wrong is that `startView` fits the ring to `rect.width`, when the pane a person can
see is narrower — so a busy ring does **not** shrink, it hides. The comment above
`startView` states the intent it fails: *"A hub sits at the origin, so this puts the
brain where a person looks first."*

**Do not guess the visible width.** `<agent-canvas>` already knows it (`_seatPx`, and it
sets `--seat-w` on itself, of which `agent-flow` is a descendant), but whether the
drawing should compose around the overlay is a design question and the design is the
owner's. Ask, then fix.

### 2. The rest of the canvas brief
`READ-ME/CANVAS-AND-PROMPT.md` §4. One of the three is done; two stand:

- ~~**A moved node keeps its position.**~~ **DONE 2026-09-23, and driven in the app.** It was
  three broken hops, not one, which is why it read as a bigger change than it is:
  1. **`drawn` reports where the nodes ARE.** It returned `_allNodes()` — the MODEL's x/y —
     while a drag lives in the element's `_pos` map, so every save wrote the ring's place back
     over the person's. It now applies `_nodePos`, rounds to whole pixels (what a move is
     ANNOUNCED as), and hands a node it did not move over unchanged.
  2. **A place is filed by the ROW, not the slot.** A seat's id carries its ordinal
     (`seat:<i>:<kind>`), so a row that moves up the stack comes back under another id and an
     id-keyed map moves whichever row took the slot. One reader — `positionKey` in
     `shared/agentFlow.ts` (a slotted seat → `seat:<kind>`; everything else keeps its id) — is
     used by the element's `_pos` **and** by the model's lookup, so a drag and a saved place
     are one fact with one name.
  3. **The rebuild honours the saved places.** `buildRepairFlow({ carried })` takes the saved
     graph's nodes and `arrangeAsHub` lets them win over the ring. The host reads them into
     `carriedPositionsRef` when a package OPENS (the reopen effect, where its own save is in
     hand) and passes them to both builders, so a Run after a reopen draws the layout the
     person left. A place that is not a pair of numbers is not a place: the ring answers.
  **Measured live 2026-09-23 on Insurance News Scout:** dragged Tool Call → canvas (0, 315);
  `drawn` reported it while the model still said (-76, 44); Save carried it in
  `workspace.graph.nodes`; read back from the API; **a new tab**, reopened, pressed RUN — the
  node drew at (0, 315), every other node on its ring place.
- **Editing a node edits its row.** The drawing has no text editing of any kind. A node's
  title and subtitle ARE the row's name and its first line. Toolbar pattern is
  `_toolbar` in `agent-flow.ts` (every control emits `flow-action`; the host answers);
  the row writers are `prompt-section-editor.ts` (`set-left-column-text` reaches
  `_seatFor`, which matches a name by MEANING). A name that is one of the declared seats
  must reuse that row, never make a second one.
  **A precedent to read first** (found 2026-09-23, not yet opened in anger): tldraw keeps ONE
  hidden contenteditable overlay repositioned over whichever shape is being edited, not an
  editor per node — and that matters here beyond convenience, because `prompt-section-editor`
  already has a comment about the textarea owning its caret. One overlay keeps the caret out of
  the model the same way.
- **A hand-drawn connection gets a real meaning** — logged and dropped in `onFlowConnect`.
  **The brief defers this decision to the owner** and so does this one: either it becomes
  something the prompt can express, or it is written into the graph as data and drawn from
  it. Nothing is worth writing first. **Two precedents now exist for the second answer**
  (found 2026-09-23, unread in the source): obsidianmd/jsoncanvas — a frozen format where a
  node REQUIRES id/type/x/y/width/height and an edge carries fromNode/fromSide/toNode/toSide/
  fromEnd/toEnd/label — and Excalidraw's arrow, which persists `startBinding`/`endBinding`
  (`{elementId, fixedPoint: [x, y] ratio, mode}`) while the target keeps `boundElements`, so
  the binding is re-resolved when either end moves. That is exactly "it must survive a rebuild
  of the graph from the rows".

### 3. The review and the editor can be handed different rows
`handleRunRequested` reviews `detail.sections` (whatever the Run button sent);
`onFixAll` reviews `surfaceSections()`. Both are the same list today, by luck of who
calls them. One reader for the rows would end it — `surfaceSections()` is the obvious
one, and the editor's `get sections()` is the synchronous truth when a write has just
been dispatched.

### 4. No test for the host wiring
`handleRunRequested`, `handleRunApproved`, `onFixAll`, `onFlowNodeAdded`, `onFlowAction`
live in a 5,900-line React page with no harness, so they are verified by `tsc`, the build
and a browser. The honest fix is the one the checklist already demonstrates: lift the
decision into the model layer as a pure function and test it there. **This session is
evidence for it**: four of the defects above were in the shell's glue, and three of them
were found only by driving the app.

### 5. Housekeeping — HELD FOR THE OWNER'S REVIEW, do not start unasked
- `READ-ME/CANVAS-AND-PROMPT.md` §3 still describes the staircase arrangement and §7 quotes
  a stale test count (429 as of `accf6ba`).
- **Production health reports `degraded`: `milvus: DISCONNECTED`** (`/api/health`).
- A stray `agent_role` row in the Insurance News Scout package — it is real, it is the T6
  the review reports, and Apply all now removes it. The owner may still want it gone by hand.
- The commit.

**ASKED FOR, AND NOT DONE (2026-09-23): clear the console chat's history.** The owner tried
to remove it in the UI and could not, and asked for it to be done in a later session. The
console's chat has accumulated turns about the **Prompt Weaver** package and he wants them
gone. Read this before deleting anything:

- **It is not one thread — it is many.** Every landing calls `open_console_conversation`
  (`backend/prompt_sessions_api.py:161`), which **inserts a new row** into `conversations`
  with `tab = 'chat'` and `title = 'Console — Chat'`. `(session_id, tab)` is deliberately
  **not unique** (`idx_conversations_tab` is a plain btree), so the console session holds
  every visit's thread. Clearing the live one will not remove the history — check them all.
- **The console session** is the `prompt_sessions` row with
  `metadata->>'session_type' = 'console'`, one per user, guarded by the partial unique index
  `idx_prompt_sessions_console_per_user` (`get_or_create_console_session`, `:219`). **Do not
  delete that row** — it is the person's home, and the conversations hang off it by a NOT NULL
  FK.
- **One side effect to expect:** that session's legacy `conversation_id` column is moved to
  the newest thread on every landing (`:179`). Delete the newest thread by hand and the
  column points at a row that is gone until the next landing replaces it.
- **~~UNVERIFIED~~ ANSWERED 2026-09-23: it CASCADES.** `conversation_messages_conversation_id_fkey`
  is `ON DELETE CASCADE` (measured against `postgresql://localhost:5432/railway`), so deleting a
  conversation takes its messages with it and leaves no orphans. Deleting the row is enough.

**AND TWO CORRECTIONS FROM THE SAME MEASUREMENT, because the job above was scoped on both:**

- **The console session holds TWO conversations, not "every visit's thread".** Measured: the
  console session (`50e0a193…`, `metadata->>'session_type' = 'console'`) owns `9b67e014`
  ("New Chat", tab `chat`, 87 messages, created 2026-09-19) and `e7e19dfd` ("Console — Approvals",
  tab `approvals`, 0 messages, created 2026-09-23 16:41). **The whole database holds 13
  conversations and 326 messages.** So "clear the console chat history" is a two-row job, not the
  hunt the paragraph above describes.
- **The "a fresh thread per landing" behaviour is NOT happening, and the cause is not yet known.**
  A landing was made and the count stayed at 2 while the live thread grew instead (85 → 87
  messages). `open_console_conversation` itself WORKS — called directly it inserted a row and
  returned its id (that row was deleted again). So the failure is somewhere between the landing
  and that call, and the one place that says so is uvicorn's own stdout: the code path prints
  *"a fresh console conversation could not be opened, so this landing continues the last one: …"*
  (`routes/ai.py:450`). Read the server's terminal before touching this.

**AND THE TWO CONVERSATION CONTROLS, MEASURED IN THE APP 2026-09-23** (this is what a person
hits, and it is written down because it reads as a broken control from the seat):

- **Console — both work.** The trash on a row arms on the first press and removes on the second
  (`DELETE /api/conversations/{id}` → 200, then the list re-reads). The "new conversation" mark
  runs its whole sequence at 200: name the thread being left from its first user turn, archive it,
  create the successor, repoint the session — the old row then shows an `ARCHIVED` chip.
- **A package seat — both are refused, and one of them SILENTLY.** `new conversation` returns
  before doing anything (`chat-panel.ts:3134`, `if (scope === 'package') return;`) — measured:
  zero fetches, no note, no message. And the only row a package has is the one you are in, whose
  trash refuses with *"That is the conversation you are in — start a new one, then remove it."*
  So in a package the two controls deadlock each other: you cannot start the thread you would need
  in order to remove the one you have. The owner has to decide which one opens (the create is
  designed for the console only, and the package case was never specified).
- **The list is behind a bar, not behind the history mark.** The trash lives in the list that the
  **"N Conversations" bar** opens (`_toggleConversations`). The tray's *chat history* mark toggles
  the WINDOW that holds that bar, not the list — pressing it on a seat whose window is already
  shown changes nothing on screen, which is the likeliest reason a person reports "I cannot remove
  a conversation" on the console.

**ONE THING SEEN AND NOT EXPLAINED, so nobody re-discovers it:** in the middle of the controls test
above, the console session's legacy `conversation_id` column read **NULL** — after a `PUT` that had
returned 200 with the value in the response body. It was set back and verified
(`9b67e014-…`), and a later landing preserved it, so it is not reproducible on demand. What is
ruled out: a title-only `PUT` does not do it (`update_session` writes only non-None fields,
`prompt_sessions_api.py:700`), and a landing does not do it (measured after). What is left is
unattributed, and the column is a fallback anyway — the console's seat binds the value the
assembly computes (`console_conversation_id`), not this one.

Do this against the local database (`postgresql://localhost:5432/railway`) unless the owner
says otherwise, and say what was deleted afterwards.

---

## §4 — The standing rules (the owner's, not open for redesign)

- **One interface for everyone.** Permissions change what a person can DO, never which
  surface they get.
- **No developers in the system.** Nothing assumes someone edits a file to change behaviour.
- **The words:** a row is a row or a step; a capability is a **skill**; "agent" as a noun,
  "MCP" and "sandbox" never reach a person. "Agentic flow" is fine in the catalogue, never
  in front of Martha.
- **No red walls.** Nothing refuses a person at the point of typing. Mistakes are ALLOWED.
  The wall is the held Run, one sentence and a button, and Grace says what is wrong.
- **The design is the owner's** — colours, notes, background, the redundancy between the
  prompt and the canvas. The redundancy is the feature. The mechanism is ours.
- **Every node action has a prompt meaning, or it does not exist.** No canvas-only state and
  no prompt-only state, except position.
- **One fact, one reader.** Two readers of one fact drift, and the copy that lies is the one
  nobody re-derives. Three of this session's four defects were exactly this.

---

## §5 — Traps that cost time, this session

- **`tab.reload()` in the IAB did not replace the document.** A marker set on `window`
  survived it, so every "fresh" run kept executing pre-edit code — and the app was
  *sometimes* right, because Vite HMR had delivered some modules to that tab and not
  others. **Open a new tab to pick up source changes, and verify with a marker.** This
  cost an hour and produced a wrong conclusion ("the fix does not work") from a correct
  fix.
- **`tabs.list()[0]` was the old tab.** `browser.tabs.new()` does not put the new tab
  first. Two tabs on the same URL, and every click went to the one running old code.
  Read the list, match by id, and close the ones you are not driving.
- **Playwright `click()` times out in this app** — the surface is inside the renderer's
  shadow root. `count()` returns 1 and the click never lands. Use `tab.cua.click({x,y})`
  with a screenshot; get coordinates from `getBoundingClientRect()` in an `evaluate`.
- **A saved row is shaped differently from a row being edited.** `{section, role, content}`
  versus `{name, type, content}`. Everything that reads a row's name must read all four
  fields. See `declaredName`.
- **`isUndecidedType('')` is FALSE and `normalizeSectionType('')` is `'custom'`.** So a row
  with no name does not fail a guard — it silently becomes a Custom row. Any reader that
  guards on `isUndecidedType` must test for the empty string too, which is what `seatIdOf`
  is for.
- **The whole console/composer surface renders inside shadow roots.** `document.querySelector`
  finds nothing; use the page's `deepFind`, and when driving the browser, walk `shadowRoot`
  recursively.
- **A block ENDS the Run.** `handleRunBlocked` clears `heldRunRef` deliberately. Anything
  that expects a held Run to still be there after a block is wrong.
- **A stray comma in a ternary's true branch** breaks the whole page, and the parse errors
  report a line 100 lines from the cause. Read the FIRST error's line.
- **A backtick inside a `css`/`html` template literal ends it**, even in a comment. `tsc`
  does NOT catch it; esbuild does.

---

## §6 — How to verify anything

Test first, in the four shapes this repo already has: `agentFlow.test.ts` for the graph's
model, `flowReview.test.ts` for the checklist, `promptSections.test.ts` for the
vocabulary, `promptSectionWrite.test.ts` for a row write, `chat-panel.test.ts` for a
button. Then `tsc`, the full suite, and the build.

**And then drive it.** Three of this session's four defects passed `tsc`, 449 tests and the
build, and were found only in the browser:

```bash
cd backend && .venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
cd frontend && npm run dev          # the site on :5001, forwards /api
```
Open the console, open a package, press **RUN**. To watch the shell's own reasoning,
capture `console.log` in the page and listen for `run-requested`, `a2ui:ask-grace`,
`a2ui:run-held`, `a2ui:run-blocked`, `a2ui:run-approved`, `flow-opened` — that sequence is
the whole path from the button to the drawing, and a missing link says which half broke.

For backend changes, `python3 -m py_compile` plus a **rolled-back transaction** against
`postgresql://localhost:5432/railway` — that is how `open_console_conversation` was proven
without leaving a row behind. The local database mirrors production.
