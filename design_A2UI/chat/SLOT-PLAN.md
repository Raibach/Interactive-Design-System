# The five boxes of a chat column — the plan, for every tab

*Rewritten 2026-10-31 on the owner's instruction: one clean plan, no old attempts, written so the
same procedure is used on the Chat tab and then the UX tab.*

---

## What the person sees

Five boxes are stacked in one column, and every one of them is on screen at all times. Each box has
a row of dots at its edge. Holding the dots and moving the hand moves that edge; the boxes on the
other side give up the space; the edge stops where they can give no more. Pressing a box's bar opens
it to its default size or closes it back to its bar. Nothing is ever hidden, nothing is folded away
out of sight, nothing slides under anything else, and the column itself never gets longer or
scrolls.

The whole column is one accordion, positioned by hand.

## 1. The names

Top to bottom. The dots column counts what the drawing puts on the band.

| # | name | what it holds | dots | the file that draws it |
|---|---|---|---|---|
| 1 | **Header** | the system's status line: session, duration, tokens, calls | five | `components/lit/output-header.ts` |
| 2 | **Conversation container** | the saved conversations for this tab | five | `rooms/design/chat/parts/design-chat-header.ts` |
| 3 | **Chat output** | the surface: whatever the system returns, in any shape | none today | `rooms/design/chat/parts/design-chat-header.ts` |
| 4 | **Chat input** | where the person types, with Send at its top | four, on the Send bar | `rooms/design/chat/parts/design-chat-input.ts`, `rooms/design/tools/controls.ts` |
| 5 | **Footer** | the tools this tab carries | four | `rooms/design/chat/parts/design-chat-plugin-tray.ts` |

The seat that holds the five boxes is the tab's own file: `tools/tools-chat.ts` for Tools,
`chat/design-chat.ts` for Chat, `ux/ux-chat.ts` for UX.

## 2. The three behaviours, named

| name | what it is |
|---|---|
| **Pull** | Hold the dots and move. The edge follows the hand, and the box changes height by the distance travelled. |
| **Accordion press** | Press the box's bar. It opens to its default size, or closes back to its bar. This belongs to the bar, never to the dots. |
| **Stop** | Where a Pull ends because the boxes on the other side have reached their own numbers. |

## 3. The six rules

1. **The column is fixed.** A Pull moves one edge between two groups of boxes. It never makes the
   column longer, and the column never scrolls.
2. **The Default is the minimum.** A box has one size of record, the size it has when nothing has
   been pulled. That number is also its floor, so it never closes below it and nothing is hidden.
3. **The furthest a Pull reaches is the next box's Default.** An expansion stops when the boxes
   that give are down to their own numbers.
4. **A box gives only if it is allowed to shrink.** The room is measured once, at the press, from
   the boxes that may give. A box pinned at its size gives nothing. When no box can give, the Pull
   does not move.
5. **The stop lives in the Pull, not in the box.** A declared minimum stops a box from shrinking.
   It does not stop the box above from growing; without the measurement at the press, the growing
   card pushes the boxes below out of the column and under the Chat input.
6. **Giving the space back is the person's work.** A Pull never takes a size back from a box the
   person expanded. To make room, the person pulls an expanded box back to its Default first.

## 4. One number per box

Each box's number is declared once, in its own file, on its **card** — the box with the frame and
the shadow. The block around the card declares no number of its own: a second number is what makes
an adjustment miss, because the larger of the two rules and changing the other one does nothing.

The stop is read from the card: the card's number plus the frame's few pixels around it.

| box | the number | where it is written |
|---|---|---|
| Header | 55 | `.readout-area { min-height }` in `output-header.ts` |
| Conversation container | 38 | `:host([data-slot="conversations"]) .shell { min-height }` |
| Chat output | 75 | `:host([data-slot="session"]) .shell { min-height }` |
| Chat input | the height it rests at; 80 at the smallest | `.input-area { min-height }` in `design-chat-input.ts` |
| Footer | 53 | `.card { min-height }` in `design-chat-plugin-tray.ts` |

The owner's test for any box: change its number to 100, then to 20. Only that box's stop moves.

## 5. The labels

One label per box, the same word in the plan, in the seat and in the box's own file.

| label | the box |
|---|---|
| `HEADER` | the status line |
| `CONVERSATIONS` | the saved conversations |
| `OUTPUT` | the surface |
| `INPUT` | the typing box and Send |
| `FOOTER` | the tools |

Each label is written three times in the seat — a block in the template, a block in the styles and
a block in the wiring — plus once at the head of the box's own file with its number.

## 6. The footer's own ceiling

The Footer's band sits ABOVE its card, so an **upward** pull grows it. Its height comes out of the
Chat input above it: the input gives exactly what the footer takes, down to the input's own floor.
The footer's maximum is **100 pixels**, whatever the input's height.

Measured on the Tools tab: the footer at 53 and the input at 94, a 40-pixel upward pull took the
footer to 67 and the input to its 80-pixel floor. With the input pulled up to 140 first, the same
pull took the footer to its 100-pixel maximum and the input down to 107.

This is the one box whose room does not come from the Chat output.

## 7. The procedure, for any tab

Work one box at a time and test the other four after each.

1. **List the boxes.** Name the five and the tag that draws each in this tab's seat.
2. **Give each box its label** in the three places in the seat and at the head of its file.
3. **Put one number on each card**, and remove any second number from the block around it.
4. **Wire each band with one press handler.** The handler reads the room once, caps the travel with
   it, and writes the height. No second handler, no second registration.
5. **Give the Footer its ceiling**: the Chat input's height at the press.
6. **Pull every band by hand**, both directions, and watch the four boxes it does not belong to.
7. **Run the compliance sheet** in section 9 before moving to the next box.

## 8. What we ran into

Written down so the next tab does not repeat it.

- **The Footer was missed.** Its card is named `.card`, and the lookup asked for `.shell` and
  `.readout-area`, so the pull sized the whole footer element and the visible card never moved. A
  box whose card has a different name is a box the drag cannot find. Check every band by pulling
  it before saying the work is done.
- **A band was registered twice.** It was added at the top of the wiring loop and added again in
  its own branch; the branch then found it already taken and skipped itself, so the Send band was
  dead while every other band worked. One registration, one handler.
- **Two numbers per box.** The block carried 83, 40 and 205 while the cards carried 55, 38 and 75.
  The block's number ruled, so the card's number changed nothing. One number, on the card.
- **A CSS floor stops the giver, not the grower.** With the output at its floor and the
  conversations still growing, the card pushed the boxes below out of the column and under the Chat
  input. Only the measurement at the press ends a Pull.
- **The page carries the copy it loaded.** A change shows only in a page loaded after the change;
  the old copy keeps running otherwise, and it looks exactly like a change that did nothing.
- **The Header's press.** Its whole face is its bar, so a press on the card clears the size a pull
  wrote and returns it to its Default; only the dots write a size.
- **A press on a band is a drag, never a selection.** Moving off the dots and over the bar's own
  words started a text selection; the browser cancelled the pointer and the drag let go mid-pull.
  That is the "snap and jerk" the owner felt. Every band now carries `user-select: none` as well as
  the resize cursor and `touch-action: none`.

## 9. The compliance sheet

Every check is made by pulling and watching, not by reading the files.

| check | how it is tested | what passing looks like |
|---|---|---|
| **C1 — nothing hides** | close each box by its bar, then open it | all five boxes are on screen before, during and after; a closed box shows its bar and its dots |
| **C2 — nothing collapses away** | pull every box to its end, one at a time | no bar, dot band or card edge disappears |
| **C3 — nothing goes underneath** | pull each box to its Stop | the boxes below keep their height, the Chat input stays where it is, no card is painted over another |
| **C4 — the column never scrolls** | during each pull, compare the output area's scroll height with its height | the two numbers are equal at the start, during and after |
| **C5 — the stop is in the pull** | with the givers at their Defaults, pull the other box | it does not move; returning an expanded box makes the pull work again |
| **C6 — one number per box** | change one box's number to 100, then to 20 | only that box's stop moves |
| **C7 — return to the Default** | load the tab, then press a bar open and closed | all five boxes stand at their Defaults on arrival; a press returns the box it opened |

## 10. The tabs, in order

1. **Tools** — done: the five boxes, the stop, the numbers, the labels, the Footer's pair and its
   100-pixel maximum, and every band pulled by hand.
2. **Chat** — the wiring is in: `data-slot` on its two headers, the three rules that say which box
   gives, the bands, the Header's press, the input drag on the travel rule, and the Footer's pair.
   Its pulls are not measured yet.
3. **UX** — after Chat. An application sits inside its output; the boxes and the rules are the
   same, and the application changes none of them.

## 11. The conversations, in every tab

The same wiring belongs in Chat and UX, so it is written here once.

**What the list is.** The Conversation container's inside holds the rows, and the rows are in the
card at all times — they are never taken out of it. On arrival the card stands at 38, its minimum,
so only its bar shows and the rows are in it, clipped. A pull on its dots sizes the card, and the
rows grow and shrink inside it; a press on its bar sets 68 (bar and one row) or 38 (bar alone).

**Where it was left.** The thread's scroll position is stored on the conversation's own row, in
`surface_state_json`, through `GET` and `PUT /api/conversations/{id}/surface-state`, and read back
when that conversation opens. The seat restores it once the thread has content to scroll; with
nothing stored the thread opens at its newest turn. Measured round trip: `{"surfaceState":{"scroll":0}}`
written to `a0d26644…` and read back.

**The order and the default.** The server answers with the conversations ordered by last modified,
newest first. On landing the seat opens the conversation its session is bound to — the one the
person was last in, which is how every open picks up where the last one left off. With nothing
bound, it opens the first row, which is the last modified conversation.

**Selecting.** A row press raises `conversation-select` with that conversation's id. The seat's
`_onConversationSelect` moves the seat to it, which sets the id, repoints the session and reads that
conversation's messages into the Chat output.

**Starting one.** The bar carries a slot named `bar-actions` beside its mark. The seat fills it with
a square `+`; pressing it creates a conversation for the package, points the session at it, moves
the seat into it and re-reads the list. The new thread opens with her own answer to the hello a
blank composer gets, so the Chat output is never blank and the person can see the conversation they
are in. The hello names the Figma ingest area of the Tools tab, so her sentence is about that work.

**The chain, from the press to the rows.** The press writes a row in `conversations` — `session_id`
is the package, with a title and a message count. The package's row in `prompt_sessions` is
repointed at that conversation's id. Her opening turn is written into `conversation_messages`
against the same id. The seat reads its conversation id from the session's column and its thread
from the messages of that id, which is why a reload lands in the same conversation with the same
text.

**Removing one.** Each row carries its own trash: the first press arms it, the second removes the
conversation. The demo locks deletes, so the control is not drawn there.

**Where it lives.** The bar and its `bar-actions` slot are in `design-chat-header.ts`. The list, the
selection, the create and the remove are in the tab's own seat: `tools-chat.ts` today, then
`design-chat.ts` and `ux-chat.ts`.

**The checks, made on the Tools tab on 2026-10-31.**

| check | what was done | the result |
|---|---|---|
| load on landing | opened the tab | the session's conversation is the seat's own id |
| select a row | pressed "Design — Tools" | the seat's id returned to that conversation |
| start one | pressed the `+` beside the mark | one row before, two after — "New Chat" above "Design — Tools" — and the seat on the new id |
| remove one | pressed the trash on "New Chat" twice | the row went; the list is back to "Design — Tools" and the seat stayed on it |
| the list inside the card | pulled the card open | the rows fill the card and scroll inside it |
