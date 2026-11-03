# Slots — the running log

*Only slot work goes here: the Card, the Bar, the Inside, the Grip, and what each slot loads.
Everything else stays in `design/CHANGELOG.md`. The names and the contract are in
`SLOT-PLAN.md`.*

---

## 2026-10-31 — the names, and the Card becomes a container

**Named, at the owner's request**, so the same thing is called the same thing in every conversation:
**Slot** (one stacked box in the output surface), **Card** (its rounded frame), **Bar** (the row
inside the card at its top), **Inside** (the card's internal space), **Grip** (the dot band under
the card). The five slots in the Tools tab, top to bottom: Readout, Conversations, Session,
Composer, Tray.

**The owner's corrections that produced the contract.**

- *"Those rounded corners indicate that the inside of that is a container and that that is what is
  expanding."* → the Card owns the height and the Inside is what opens.
- *"You are putting things inside of a padding area — that is wrong, padding is supposed to be
  empty."* → the height goes to the Card, never to the block around it.
- *"The drop-down is not created correctly. It's loading the conversations outside of the
  container, outside of the slot. It should be loading them inside of the slot."* → the list is a
  child of the Card, drawn by its Inside.
- *"If I click on that slot when it's collapsed, it acts like an accordion. It should expand and
  show the conversation list. If I click on the dragger instead, then it should drag open — two
  functions."* → the Bar is the accordion; the Grip only drags.

**Step 1 — the Card holds its Inside. DONE.**

- `chat/parts/design-chat-header.ts`: the frame (`.shell`) now contains the Bar row and the Inside
  (`.body`); the Inside is `flex: 1 1 auto; min-height: 0; overflow: auto`. The `.body` used to be
  a SIBLING of the frame, so nothing could ever sit inside the card.
- `.shell` gained `margin-bottom: 5px`, restoring the 5px the moved body used to contribute as a
  gap: the block is 61 again, the drawing's height.
- `rooms/design/tools/tools-chat.ts`: the conversation list is a child of the Card, and the Grip
  sizes the CARD (`.shell`), never the host — sizing the host grew the padded block around the card
  and left the Inside untouched.

**Measured on screen, Tools tab.** Closed: block 61, card 38, no list. Bar pressed: block 91, card
68, list 641×30 slotted into the Inside. Grip dragged 90px: card 38 → 158, Inside 30 → 120, list
641×120 — the Inside opens and the list fills it. Grip pressed again: card back to 68. Bar pressed:
closed at 61. The Chat seat's card measured 61 / 38 with an empty Inside — the same as the Tools
card at rest.

**Removed the same day, because it blocked a real greeting.** `routes/ai.py` no longer dictates a
sentence she must say ("SAY THIS AND NOTHING ELSE: …"). `py_compile` clean; the room's door answers
200.

## 2026-10-31 — the conversation's own actions, and shorter notes

**The owner's correction.** The notes were long diatribes. They are now short and precise, above the
section they describe, in both files.

**The actions moved to the conversation.** *"Once I click on the conversation ID … that conversation
inside of the chat output surface has its own buttons — make default, delete, clear — and those
appear at the bottom of the chat, right above the resizing gripper for the chat output and input
area … you can design those buttons for now, simple pills or chips … leave delete [in the list]
because in-line delete is very handy."*

- Drawn: **Clear** and **Delete**, as chips in `.conversation-actions`, at the bottom of the
  output wrapper and above the composer's resizer. Measured: row 683×32 at 816; the input wrapper
  starts at 848, so the row is above it.
- **Not drawn: Make default.** A package's default conversation has no reader and no door yet, so a
  chip for it would be a dead control. It is named here as needing a door, not faked.
- The conversation list keeps its own inline delete, and nothing else.
- Clear deletes the conversation's messages through `DELETE /api/messages/{id}`; Delete removes the
  conversation through `DELETE /api/conversations/{id}`.

## 2026-10-31 — the Conversations rule

*"Dragging the gripper down is the same function as clicking it: expands the list. If the list is
more than 10 lines, add a scroll bar — that's the conversations rule, a different rule than the
header. If I click the conversation and the slot is expanded it closes to the default state."*

- **Press and drag are one function.** A press on the Bar toggles the list; a drag on the Grip opens
  it as it grows. Clicking again closes it, and closing now clears the dragged height too, so the
  card returns to its default — a card cannot stand tall with nothing in it.
- **Ten rows, then a scrollbar.** `design-chat-header .conversation-list` gets
  `max-height: 350px; overflow-y: auto` inside the card. The Readout's rule is different: it fits
  its text, and scrolls only when the text outruns the column.
- Measured before the close fix: closed card 38; press → card 68, list 30; drag 70px → card 108,
  list 70. Pressing close left the card at 108 with the list gone — the defect the close fix
  answers.

## 2026-10-31 — Send was disabled: the bar's name

The owner: *"the send button does not activate when text is entered."* Measured: the field held
"Testing the send button." and the seat's draft held it too, but the bar reported `hasText: false`.

- **Cause.** `_syncBarText` looked for `chat-action-bar` — the shared composer's bar. This seat
  draws `<design-chat-action-bar>`, so the lookup returned nothing and the bar was never told there
  was text.
- **Fixed in the Tools seat:** it now finds either name. Measured after: `hasText: true`,
  `Send disabled: false` with text in the field.
- **Also true, not touched:** the shared seat (`chat/design-chat.ts`) carries the same lookup, so
  the Chat and UX tabs likely have the same disabled Send until their own pass.
- **Still missing:** starting to type with no conversation selected does not create one, and the
  newest conversation is not loaded on landing. Steps 3–5.

## 2026-10-31 — the readout's padding band

Owner: *"it needs to operate just like the chat. It's a slot, it has inner shadows, it has a gripper
below it — right now you're expanding the padding area."*

- **Cause.** The readout is a different element, and its card is `.area` (radius 8, the two inset
  shadows). The grip sized the HOST, which has no card of its own, so the extra height landed in the
  band AROUND the card — the empty strip under it in the screenshot.
- **Changed.** The grip now sizes `.shell, .area`: the design card where there is one, the readout's
  card where it is `.area`. The reset clears the same element.
- **Still to do, from the outline already in SLOT-PLAN:** a press fits the readout to its text; a
  drag pulled fully down collapses the other slots; the Inside scrolls when the text outruns the
  column.

## 2026-10-31 — stoppers: the next work on the slots

Owner: *"I wanna set some limits … if I expand conversation I want it to stop … about 150 pixels
high … if I pull the header down while the conversations are down it pushes everything out of view.
It's not supposed to do that. These are stoppers — we're not pushing things out of view, we're
collapsing. There's a minimum height."*

- **Done:** the conversation list stops at **150px** and scrolls past it (`max-height: 150px`).
- **Not done, and it is the cause of the push-out:** the drag ceiling is one guessed number for the
  whole column (`max(140, column − 160)`), so a slot can grow past every other slot's minimum and
  push them out of view, grips included. The stopper must be computed per drag:
  - every slot keeps a minimum — its Bar plus its Grip, so it and its grip never disappear;
  - a drag stops at the height that leaves the OTHER slots their minimums;
  - the same rule applies when two slots are open at once (a header pulled while the conversations
    are open), which is the case the owner named.

### The 150 stop, and the order the owner set

Owner, 2026-10-31: *"You don't need that same stop feature whenever I expand the header … we have
to stop them at the same 150. Clicking the icon on the header, the little M on the right-hand side,
collapses it back to default. Here's the order: header overrides conversations, conversations
overrides chat output, and then you reverse it … once you've collapsed the conversation to default
it stays collapsed until the user either clicks on it or uses its gripper underneath."*

- **Built:** the readout and the conversations card now stop at 150px when dragged. The other slots
  keep the column-wide limit until the per-slot stopper is built.
- **Recorded, not built:**
  - The **M icon** at the readout's right edge collapses the header to default.
  - **Precedence:** the readout overrides the conversations, the conversations override the chat
    output; collapsing reverses that order.
  - A slot collapsed to default **stays** collapsed until the person presses its Bar or drags its
    Grip.
  - A click on the conversations' Grip currently closes it; that close belongs to the M icon, not
    to a grip press.

## 2026-10-31 — tested by me, not by the owner

*"Why don't you test it until you get it right, then let me know."* Done, on the running build, after a
reload and a sign-in.

**The 75 floor holds, and the layout is the stopper.**

| action | readout card | conversations card | chat output card |
|---|---|---|---|
| at rest | 55 | 38 (closed) | 623 |
| readout pulled 360px | **415** | 38 | **263** |
| conversations opened by press | 415 | 68 (list open, 1 row) | 233 |
| conversations pulled 320px | 415 | **388** (list 350) | **75** |

- Pulling the conversations down stopped the chat output at **exactly 75**, which is the CSS minimum on
  that card. Nothing in the drag computed it.
- Pulling the readout followed the pointer to 415 and then stopped when the column ran out: the chat
  output held above 75 throughout.
- The grip has no limit of its own; the layout is what stops it.

**What the test exposed, not fixed.** The readout has no way back to its default except a press on its
grip, because the M-icon collapse is not built. A person who drags it open and does not know the grip
restores it is stuck with it open.

**State left for the owner:** readout 55, conversations 38 and closed, chat output 623 — the defaults.

### The stop that actually stops — tested

Owner: *"I pulled the conversation gripper down and it disappeared behind the divider … it should
have stopped when the chat output reached 75."* He was right; the floor inside the session card did
not stop the pull.

**Cause.** The output wrapper is a stack, not a flex column: a growing slot PUSHES the ones below and
the wrapper clips them. A floor on the pushed slot therefore never stops the pull; the pushed slot is
simply clipped and its grip disappears behind the composer.

**The rule now.** A slot above the chat output may grow only into the room the wrapper has left it:
the wrapper's height, less the readout above it, less the chat output's 75. No guessed constant, and
nothing re-renders during the move.

**Measured on screen, from default.** Opened: conversations 68, chat output 593. Dragged 600px: the
conversations stopped at **632** (its room), the chat output **75** exactly, and the grip stayed
visible above the composer (band bottom 804, composer top 848). Closed again: conversations 38,
readout 55, chat output 623 — the defaults.

### Correction — the 75 was on the wrong element, and the layout clips instead of shrinking

Owner: *"is that 75 pixel minimum height on the output area? … it looks like it's actually tucking it
behind the chat divider."* He was right.

- In the card variant the session card IS the output area: its label row and the Clear/Delete row
  live inside it. A 75 floor on the card left the thread almost nothing and read as "tucked".
- The floor is now on the thread itself (`[data-slot="session"] .content-scroll { min-height: 75px }`),
  and the pull's spare is the thread's height less 75.
- **Measured, and it does not land:** opened with the thread at 523, a 600px pull left the
  conversations card at 266, the session card at 395 and the thread at **325** — not 75. The card's
  styled height was larger and the layout **clipped** it, because the output wrapper stacks its
  slots: it does not shrink the ones below, so the pull is cut off by clipping before the thread's
  floor is reached.
- **The real fix is structural, not a number:** the wrapper must be a flex column with the session
  as the flexible item, and the drag must give space (flex-basis on the dragged slot) rather than set
  a pixel height. Then the layout itself stops the pull at the thread's floor, with no ceiling math.
  This is the next change and is NOT built.
- Room left at its defaults: readout 55, conversations 38 closed, session card 623, thread 553.

### Verified by the owner — and the divider's own fault

The owner confirmed on screen: **the 75 is correct.** With the conversations pulled fully, the session
card stands at 75 (card 608 → session 75, thread 5, grip visible) and he called it correct.

**Then the divider between the output and the composer was broken:** dragged up, the input grew in the
opposite direction and the bar slid under the input.

- **Cause:** `_wireGrips` also attached this seat's slot drag to the composer's band
  (`design-chat-action-bar`), which already has its own gesture that sizes the input. Two handlers on
  one band pulled opposite ways.
- **Fixed:** the composer's band is skipped by the slot wiring and keeps its own handler.
- **Measured after:** dragging that band up 110px grew the input field 94 → 288 and the wrapper
  261 → 455, with the bar moving up 829 → 635. No sliding under.
