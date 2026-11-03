# One chat per tab — the right column is a surface, not a conversation

*Started 2026-10-31, on the owner's correction. This is the beginning of the record: it states the
rule, the measured state of the code, and the split that must happen before the approval flow is
built.*

---

## The correction

> *"Stop thinking of the chat output on the right column as a traditional conversation interface.
> It is not. It is an output surface associated with our A2UI protocol. It can serve text. It could
> serve an image. It can serve instructions. It can serve an interface."*
> — owner, 2026-10-31

> *"It still looks like a chat interface, but it is not."*

That sentence is the whole document. The column on the right wears a chat's face because a person
already knows how to read it and how to type into it. What it *is*, underneath, is a place where
the system puts something for a person to look at: a paragraph, a picture, a set of instructions,
or an interface with cards and buttons in it.

Two consequences follow, and everything below serves them.

1. **What is drawn there is chosen per tab, and it is not a thread.** Two tabs showing the same
   column do not share a conversation. They share a shape.
2. **A chat component is a tab's own.** If one file draws the column for the Figma tool, for the
   analytics program, and for the console, then a change made for one of them lands in all three.
   That is the thing to stop.

## What it looks like, and what it is

The column is a seat with a **view slot**. The seat draws the frame — the rail of tabs, the
readout, the input, the foot, the grips. The slot holds whatever that tab decided to put there.

The evidence is in the console's own surface, which is the simplest case:

- The surface declares the seat and names the view it carries:
  `children: {view: "repair-view"}` (`backend/routes/ai.py:1379`).
- The seat switches what stands in the slot by the tab that is pressed: `case 'approvals': return
  'chat-repair-actions'` (`frontend/src/rooms/console/console-chat-panel.ts:1698`).

So the Approvals tab already is a surface that loads a view. It is not a conversation with a
different subject. The view is the thing.

The same slot carries the Tools tab's ingest conversation (`grace-tools-chat`) and the UX tab's
analytics conversation (`ux-chat`) inside Design (`frontend/src/rooms/design/DesignSeatShell.tsx:139-151`).
Those two are already separate files, which is correct and is the pattern the rest must follow.

**What the slot may serve, in the owner's terms:** text; an image; instructions; an interface. The
interface it serves is drawn by the renderer from the A2UI tree, so it carries cards, buttons and
data bindings the same way the console's card grid does. Nothing about the column limits it to
words.

## The geometry belongs to the same fact

The column is not a fixed strip. It is resized, moved and folded, and those controls are part of
what makes it a surface rather than a transcript:

- **It resizes vertically with its gripper.** The seat holds its own drag state —
  `_dragEdgeBottom` (`rooms/design/chat/design-chat.ts:1622`, `:1671`) — so the column's edge is
  held, not jumped to.
- **It can take the middle of the screen.** The owner's requirement is that the column expands
  across half the screen when the thing in it needs the room. The width is draggable today; a
  named half-screen stop is not measured in the code, so it is a requirement, not a fact.
- **The red dots are the grab.** The panel grips are drawn as a row of small dots in a rose red —
  `rgba(147, 58, 69, 0.5)` — and they are the handle a person takes hold of. Measured:
  - four dots, `#40001119:6385`, dot size 2.16 × 2.05
    (`frontend/src/rooms/design/chat/parts/design-chat-header.ts:26`);
  - four dots, `#40001120:6644`, under Send
    (`frontend/src/rooms/design/chat/parts/design-chat-action-bar.ts:229`);
  - five dots passed to the header at `rooms/design/chat/design-chat.ts:5183`.
- **Every dot row must grab.** The owner names three-dot and six-dot grips on other panels. The
  count differs by panel and that is not the point; the point is that every grip that is drawn can
  be taken hold of, and that taking hold of it moves *that panel between the slots* and expands or
  folds *its own* column, without touching another tab's.

A grip that is drawn but cannot be grabbed is the same defect as a control that does nothing.

## The measured state — who draws the right column, today

| tab | what draws the column | shared? |
|---|---|---|
| Console | `frontend/src/rooms/console/console-chat-panel.ts` | its own |
| Composer | `frontend/src/rooms/composer/composer-chat-panel.ts` | its own |
| Product | `frontend/src/rooms/product/product-chat-panel.ts` | its own |
| Development | `frontend/src/rooms/development/development-chat-panel.ts` | its own |
| Governance | `frontend/src/components/lit/evals-chat-panel.ts` | its own |
| Design — Chat, Tools, UX, Executions, Settings | **one file**: `frontend/src/rooms/design/chat/design-chat.ts` (295 KB) | **five tabs, one seat** |

Inside Design, two tabs already inject their own view into that one seat:
`grace-tools-chat` for Tools (`rooms/design/tools/GraceToolsChat.ts`) and `ux-chat` for UX
(`rooms/design/ux/ux-chat.ts`). So the *content* is separate; the *seat* is not.

And the shared name is still live:

- `chat-panel` is defined as a custom element (`components/lit/chat-panel.ts:5459`) and imported
  globally (`components/lit/register.ts:82`), so it is available to every page whether that page
  asked for it or not.
- The A2UI renderer maps the model's `ChatPanel` onto it (`components/lit/a2ui-renderer.ts:240`),
  and the catalogue still carries the name (`shared/tag-registry.ts:120`, `:800`).
- The Design console's own assembly prompt names `chat-panel` for its seat
  (`backend/routes/design_console.py:391`), and the client swaps in the room's `design-chat` by
  its own mapping. The comment that records why is at `design_console.py:425-431`.

That last line is the exact shape of the problem: the surface names one seat, the room draws
another, and the link between them is a mapping kept in a comment. A name that two halves agree
about only because someone wrote the agreement down is a name waiting to drift.

## The rule

**One chat file per tab of the vertical menu, imported by that tab and by nothing else.**

The vertical menu a person sees in Design is five tabs
(`DESIGN_ROOM_TABS` in `rooms/design/DesignSeatShell.tsx:46`, and `DESIGN_CONSOLE_TABS` in
`backend/routes/design_console.py:52`, which agree):

| tab id | what its column serves |
|---|---|
| `chat` | the seat's own drawing for the Chat tab |
| `tools` | the Figma ingest conversation, in its own build |
| `ux` | the analytics conversation, in its own build |
| `executions` | the seat's own drawing for Executions |
| `settings` | the seat's own drawing for Settings |

Three of those are the ones the owner named, and they are the ones that must not share a file:

- the **Figma tool's** column (`tools`),
- the **UX / PostHog** column (`ux`),
- the **console's** column, which is a different room's tab and already has its own file.

The split, therefore, is not a copy of the seat five times for its own sake. It is that each tab's
column becomes a file that holds only what that tab does — and the seat it uses is imported by
that tab alone, so no other tab can be handed it by accident.

The global registration must go with it. A name registered for every page is a name a surface can
reach for without any file deciding to use it.

## What this means for the approval flow

The approval work does not need a new dashboard, and it must not have one. In the owner's words:
*"I don't want a separate approval dashboard. I want it integrated directly into our flow and we
use the approval button on the navigation and we use the AI's interface output area as a
dynamically loading surface."*

So:

- **The card's status tag carries the stage.** The card already carries a status; it becomes the
  word a person reads — waiting, in review, approved, in the design system. No new shape.
- **The buttons are added to the surface**, not to a page of their own. A modal appears only where
  something must be signed, and only then.
- **The Approve button on the rail is the door.** It opens the conversation and the cards stand
  beside it, and the surface in the right column is the review itself.
- **Nothing of ProcessMaker's interface is used, and its flow is not adopted either.** It is a
  reference point. The owner, 2026-10-31: *"we're not using their interface, we're incorporating
  it … you don't even have to use their flow … it may be inferior to something you could create
  from scratch."* What is taken is the idea of a draft that waits for a named person with a trail
  of decisions. The records are our own, and the shape is the one three fixed gates need.

**And the split comes first.** If the approval surface is written into one seat shared by five
tabs, then Approvals will appear in tabs that have nothing to approve, and the Figma tool's review
will be alive inside the analytics column. That is the reason this document exists before any
approval code does.

## The order of work

1. Split the Design seat into one file per tab, with each tab importing its own. No behaviour
   change in the split: the same drawings, the same tabs, the same conversations.
2. Remove the global registration of the shared seat, so a surface can only reach a column it
   named.
3. Prove every red grip grabs: it moves its own panel between the slots and it expands or folds
   its own column.
4. Only then build the approval surface into the tab that owns it.

## Open, and not decided here

Two different lists of Design tabs exist in the code, and they disagree:

- `DESIGN_TABS = "chat,trace,tools,executions,eval,repair,ux,settings"` — eight tabs
  (`backend/routes/ai.py:83`), bound to the surface by `_seat_tabs` at `ai.py:2707`.
- `DESIGN_CONSOLE_TABS = "chat,tools,executions,ux,settings"` — five tabs
  (`backend/routes/design_console.py:52`), and the five the room draws.

A person sees five. One surface still states eight. Which list is authoritative is the owner's
decision, and it decides how many chat files the split produces.
