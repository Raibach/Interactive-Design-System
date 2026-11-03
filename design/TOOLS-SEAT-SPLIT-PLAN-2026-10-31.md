# The Tools seat, cut into pieces — the plan

*Written 2026-10-31 for the owner's review. Written to be reused on the
next tab once Tools is done, so every step names its proof. **Steps 1–4 are built, and step 5's cuts are built for the Chat tab.** The frame and the
conversation are now one file each for the whole Design section, and the Chat seat delegates to
them. The proofs marked below were taken from the type check, the parse and the build; the
on-screen proofs are the person's press.*

*CORRECTED the same day. An earlier version of this plan said 3,503 lines of the file were its
stylesheet and that moving it would take the file from 6,101 lines to about 2,600. That count was
wrong: it measured from the line where the stylesheet starts to the line where the drawing starts,
and everything between is the element's methods, not its styling. The stylesheet is **95 lines**. The
correction is carried through the tables and steps below and stated in the ledger at the end.*

---

## What the person sees

Nothing changes. The Tools tab draws the same column it draws today: the same five boxes, the same
dots at their edges, the same conversation list, the same thread, the same controls, the same foot.
The only difference a person could ever notice is the one this plan is written to remove — a mistake
in one file of six thousand lines that nobody could see. The page must be identical after every
step, and that is the test.

## The rule this plan obeys

**The frame may be common. The conversation may not.**

- **Common, across the Design section:** the five boxes, the dots at their edges, how a pull moves
  an edge, where a pull stops, and the tab rail. The owner, 2026-10-31: *"as far as the grippers the
  tabs I think that's common throughout design section for now eventually it will apply that same
  behavior to all of the other chats."*
- **Never common:** what is inside the boxes and how it is displayed — the conversation list, the
  thread, the session, sending a turn, the controls a tab carries. The owner: *"we should not be
  sharing components of the behavior of the chat … the tools has its own controls and its own
  inserted data."*
- **Scope now:** the Tools seat, one file. The other seats wait until this one proves the method.

## Why the file is this size — the receipts, corrected

Measured on `frontend/src/rooms/design/tools/tools-chat.ts`, 2026-10-31:

| part | lines | what it is |
|---|---|---|
| header and imports | 1–246 | 52 lines of note; the rest imports |
| the element's stated settings and state | 246–~1,750 | properties, private fields, and the notes about them |
| gestures, stop and slots | ~1,750–2,146 | resize, grips, the stop, the five boxes' numbers, the slots |
| **its own styles** | **2,147–2,241** | **95 lines** |
| its methods and the prose about them | 2,242–5,649 | 3,408 lines: 1,700 comment-only, about 1,600 code |
| the drawing | 5,650–6,101 | 452 lines, and most of those are comments |

Two facts that matter more than the totals. **The seat's look is not in this file at all:** it
imports `rooms/design/chat/design-chat.styles.ts` — 596 lines, shared with the Chat seat — and adds
its own 95. So the Tools tab is displayed with the Chat tab's rules, which is the opposite of the
owner's rule that display is specific to the tab. And **the file is mostly behaviour:** about 1,600
lines of code in roughly one hundred fifty methods, half of them explained at length.

The file is also not unique in its shape: after renaming the tag and the class, it and the Design
room's seat differ by 636 lines. Each seat pays about five thousand shared lines to keep six hundred
of its own. This plan reduces the Tools file; it does not merge the seats.

## The three pieces

| piece | what it holds | where it lives | who may use it |
|---|---|---|---|
| **The frame** | the five boxes, the bands, the pull and its stop, the numbers each box declares, the tab rail, the slots that hold a view | `rooms/design/tools/` for now — Tools alone, until a second tab needs it | every Design tab, then every room |
| **The chat** | the conversation list, the thread, the session, sending, the greeting, the scroll record — and what the left column holds, so it can be asked about it (step 4) | `tools-chat.ts`, one per tab | that tab only |
| **The content** | the controls, the ingest, the preview, the tray | already separate: `tools/controls.ts`, `ToolsSeat.tsx` | that tab only |

The frame knows nothing about conversations. It may not read a session, call a conversation
endpoint, or hold a thread. If a method needs to know what a message says, it is chat, not frame.

## The four layers, and when they apply

From `AGENTS-instructions/Components-Structure.md`: a new element must be in the catalogue
(`catalogs/prompt-composer/catalog.json`), the registry (`shared/tag-registry.ts`), the runtime
(`components/lit/<element>.ts`) and the resolver — or the server refuses the whole surface with a
503 and the tag draws an empty box. `cd frontend && npm run catalog:check` is the gate.

**This plan avoids new elements wherever it can.** A stylesheet file and a plain helper are not
elements and need none of the four. The frame and the chat stay inside the existing element. Only if
a piece must be drawn by the surface does it become an element, and then all four layers are done in
the same step and `catalog:check` is run.

## The steps, each with its proof

*Where this stands, 2026-11-02: **steps 1–4 are built**; step 5 is built for Chat. The four cuts
are: the look, the frame (now shared), the header, and the chat's reach into the table. Step 2 took two turns and one broken page — the line-range slice that carried a getter into the
module — which is why every member in a span is now listed before it moves.*

### Step 1 — the Tools seat stops wearing the Chat seat's look

The owner's rule is that the display is specific to the tab. Today it is not: the Tools seat imports
the Chat folder's 596-line stylesheet and adds 95 of its own. The fix is the pattern the seats
already follow — a copy in the Tools folder:

- `rooms/design/tools/tools-chat.styles.ts` holds the Chat stylesheet's 596 lines followed by the
  seat's own 95, in the same order the element's array declares them today.
- `tools-chat.ts` imports only that file. No rule is edited; the order is preserved exactly.

*Proof:* the file's line count does not change (this step moves no behaviour); `npx tsc -b --noEmit`
passes; the page is identical — the five boxes at their defaults, the footer at 53, the input at its
rest height, and each of the four bands pulled once in both directions.

### Step 2 — the frame collects its own gestures

The methods that move an edge, read the room, stop at a number, and switch a tab leave the seat and
take their state with them:

- the pull and its stop: `_onResizeMove`, `_wireGrips`, `_onSlotGripDown`, `_roomToGrow`,
  `_defaultOf`, `_resetBox`, `_resetSlotGrips`
- the input's drag edge: `_onGripDown`, `_releaseGrip`, `_onCollapseToggle`
- the tab rail: `_onTabChange`
- the slots that hold a view: `_slot`, `_seatSlotted`, `_onSlotChange`, `_viewSlotted`,
  `_chatTopView`, `_wantedViewTag`, `_emptyViewLine`, `_findingsSeat`, `_tabClaimant`,
  `_anyForeignViewAssigned`

About a thousand lines, with the fields those methods own. The frame is a plain helper the seat's
own class applies — **not an element, and not a chat**. It stays in the Tools folder until a second
tab uses it; then the owner decides whether it becomes the Design section's common frame. Nothing in
it reads or writes a conversation.

*Proof:* the same four bands pulled by hand in both directions with the other four boxes watched;
the tab rail moves the room to the tab pressed; the seat draws exactly the tree it drew before;
`npm run catalog:check` unchanged.

### Step 3 — the seat keeps its chat and says so at the top

What remains in `tools-chat.ts` is the conversation: the list, the thread, the session, sending, the
greeting, the scroll record. Its header states the rule in three lines — the frame is in the frame
file, the chat is here, the controls are in `controls.ts` — so the next person does not have to read
six thousand lines to learn where a thing belongs.

*Proof:* the conversation list opens and closes, a row press moves the seat, `+` creates a
conversation, the thread loads, a turn sends, and the scroll position returns after a reload — the
five checks already recorded in `design/slots/SLOT-PLAN.md` §11.

### Step 4 — the chat understands the column

The owner, 2026-10-31: *"the chat needs to be able to understand what's happening in the left
column so it needs to be context aware of the table, what's in the table. I should be able to ask
the chat to find a component in the data table and it should be able to bring that to the top of
the list, for example, or present or open it — it's selected and open it in the third column."*

So the person types "find the prompt textarea" and gets three things at once: the table filtered to
the rows that match, the row selected, and the component open in the third column.

**What already exists, measured.** The table is `figma-layers-view`: it has its own search
(`_query`, drawn by `_renderSearch`, counting "N of M components match"), a `selected` setting that
marks the row the third column has open, and it raises `open-component` with `{ tag }` when a row is
pressed. The Tools seat already listens for that event and opens the preview, so the third column
half of this is built and working today. The chat is given a workspace context each turn
(`_buildWorkspaceContext`) that carries the package, the left column's sections and the output — and
**nothing about the table**.

**What is missing, and it is three small things.**

1. **`query` becomes a public setting** on `figma-layers-view`, beside `selected` and `refresh`,
   written by the host. Its own search box writes the same field, so the person and the chat drive
   one filter and there is no second list. A setting on an existing element needs none of the four
   catalogue layers.
2. **The table goes into the chat's context**, compactly: for each component its tag and its name,
   plus the row count and whether a filter is standing. Seventy-three lines of tag and name, read
   from the same catalogue read the column already makes — not a second copy and not a second fetch.
3. **The answer carries an action.** The reply's own action block names what to do — show, select,
   open — with the component's tag. The seat executes it through the doors that already exist: write
   `query`, write `selected`, dispatch `open-component`. Nothing new is drawn, and the model never
   reaches the catalogue directly: an action that names nothing in the table is refused, and the
   refusal states how many rows were searched.

**The rule that keeps it honest.** An action is a request the person can see, not a silent move: the
table's own count line says how many rows matched, and a name that matches nothing leaves the column
as it was with the sentence saying so. This is the same fail-loud rule as the rest of the room.

*Proof:* asked by name, the matching row is the only one drawn, it is marked selected, and the
component stands in the third column; asked for a name the catalogue does not hold, the column is
unchanged and the answer says how many rows were searched; the search box and the chat write the
same filter (typing in the box and asking produce the same row set).

### Step 5 — the example for the next tab

The same four steps, one tab at a time, starting with Chat. A step is done when the page is
identical and the previous step's proof still holds.

## What each step buys — the numbers as they came out

| after | the file | the rest |
|---|---|---|
| when we began | 6,101 lines | its look borrowed from the Chat folder, 596 lines |
| step 1 — built 2026-10-31 | 6,007 lines | its look is its own: `tools-chat.styles.ts`, 698 lines |
| step 2 — built 2026-11-01 | **5,437 lines** | the frame: `tools-chat.frame.ts`, **751 lines** — the gestures, the view slots, the column edge |
| step 3 — not built | about the same | a header that says what belongs where |
| step 4 — not built | about the same | the table in the chat's context, and three actions it may ask for |

Two of the estimates above were wrong in this plan's first version and are now replaced by what was
measured: the frame was estimated at about a thousand lines and came out at 751 moved plus the
contract, and the seat was expected near 5,100 and stood at 5,437.

The honest headline: this plan does **not** halve the file, and the earlier claim that it would was
built on the wrong count. About four hundred lines of the file are prose about its own behaviour, and
the behaviour itself — the conversation, the thread, the sending — is exactly what the owner's rule
keeps in the tab's own file. The cut is real but modest, and each thing now lives in a file that
names it.

The number that matters is not the line count. It is that a change to the output box's floor happens
in the file that owns the boxes, beside its own number, and a change to a conversation's behaviour
cannot reach the Chat tab by accident.

## What must not happen

- **No shared chat.** The seats stay separate, each with its own file, as the owner ordered
  2026-10-31. The frame may be shared later because the owner said the grippers and tabs are common;
  nothing else is.
- **No behaviour moved into a shared part.** The header, the input and the tray that the Tools seat
  draws are shared with the Chat seat today. Moving Tools behaviour into them would reach another
  tab, which is the thing this plan exists to prevent. Those pieces stay as they are; a tab's
  behaviour stays in that tab's file.
- **No new element without all four layers.** A helper is a file; an element is a catalogue entry,
  a registry entry, a runtime file and a resolver path, and `catalog:check` must pass in the same
  step.
- **No rule edited during a move.** A step that moves text changes no value. If a value must change,
  it is its own step with its own proof.
- **No claim without its line number in hand.** The correction at the head of this document is the
  reason for this rule.

## The ledger

| claim | mark | receipt |
|---|---|---|
| the file is 6,101 lines | ✅ verified | `wc -l` |
| its own stylesheet is 95 lines, at 2,147–2,241 | ✅ verified | the `static styles` block's own closing line |
| the seat's look comes from `chat/design-chat.styles.ts`, 596 lines, shared with the Chat seat | ✅ verified | the import at `tools-chat.ts:57`, and `design-chat.ts:47` |
| its methods occupy 2,242–5,649: 1,700 comment-only, about 1,600 code | ✅ verified | `sed` + `grep -c` over that range |
| the drawing is 452 lines, 5,650–6,101 | ✅ verified | `render()` line and the file's end |
| the Tools seat and the Design seat differ by 636 lines after renaming | ✅ verified | `diff` with the tag and class renamed |
| the four layers and `catalog:check` are the gate for a new element | ✅ verified | `AGENTS-instructions/Components-Structure.md`; the check runs today |
| the table already has a search, a `selected` setting and an `open-component` event, and the seat already opens the third column from that event | ✅ verified | `figma-layers-view.ts` (`_renderSearch`, `static properties`, `_openComponent`) and `ToolsSeat.tsx:1474` |
| the chat's context carries the package, the left column and the output, and **nothing about the table** | ✅ verified | `_buildWorkspaceContext`, `tools-chat.ts:3587` |
| `query` is not a public setting today; the filter is private to the tree | ✅ verified | `figma-layers-view.ts` `_query`, absent from `static properties` |
| 3,503 lines of the file were its stylesheet, and moving it would halve the file | ❌ **measured and wrong** | the stylesheet ends at 2,241; the 3,503 was measured to the drawing's first line, and everything between is the methods |
| the frame may be about 1,000 lines | 🟡 partial | the method spans are measured; the split itself is not made |
| the page will be identical after each step | 🔜 specified, not built | proved per step by the numbers and the four pulls |
| the chat can filter, select and open a component by name | 🔜 specified, not built | step 4, with its three proofs |
