# The architecture — the systems, the tree and the console

*2026-11-03, from the owner's explanation. This is the structure the catalogues and the console are
being built toward. The plans point here for it.*

## What the person does

The Design room opens on a design system. A selector at the top of the tree names the system being
read. The application's own system, **Raibach Design System**, stands first and is the default;
**Carbon** stands beneath it. Choosing either rebuilds the tree and the work beside it in that
system. The selector is a tree: it rolls up, and a system's branches appear when it is opened.

Under the chosen system, the tree follows the architecture of the application: the global console
and the tabs, the components each one draws, the child elements and their tools inside those
components, and finally the functionality of each element. It expands and rolls up the same way. The
data-tree icons the room already made mark what each node is.

Selecting the name of a functionality loads its code in the third column. The chat recommends the
Development tool beside it, and a button carries the person to the Development tab to work on the
code. Sending the work to a developer is a later step.

The console is not a page. It is an organizing space, a gallery of the activities that happen inside
Design: design-system cards, UX cards, individual component work, and other work as it appears. The
UX tab has several jobs, and each can stand as a card.

## The tree

```
Raibach Design System (the application's own system; default)
├─ Global console
│  └─ the gallery of activity cards
├─ Design
│  ├─ components the room draws
│  │  ├─ left-column-header
│  │  │  ├─ child element
│  │  │  │  └─ functionality (named)
│  │  │  └─ …
│  │  └─ …
│  └─ …
├─ Composer
├─ Product
├─ Development
└─ Governance
Carbon (the second system)
└─ its own categories, components, children and functionality
```

The names under each branch are the database's, read as the tree expands. The drawing invents no
node: a node the database does not hold does not appear. The catalogue files are themes — they
declare the components and their bindings — and the database supplies the structure and the data.

The system is the whole application. Its parts — the console, the tabs, the components — are the
branches of the tree. A part becomes a system of its own only when it has a real catalogue; until
then it stands as a branch under Raibach.

## The shell is a placeholder (owner, 2026-11-03)

The frame, the rails and the styling components are placeholders. What a person reads and presses
inside them comes from the database and the files that call the database's activity: the session, its
conversations, its events, its measured values and its previews. A card's conversation opens with its
last thread and its last activity, and the question that follows is drawn from that work. Nothing is
isolated inside a chat panel; the conversation is contextual to the card and the activity.

## The two systems today

The application's own system is named **Raibach Design System** in this structure. Its catalogue on
disk is the one the room calls **Raibach Prompt Composer** today (73 components); that file name can
change without changing the structure. **Carbon** is the second system (58 components) and stands
beneath it in the selector.

## What stands, and what this adds

**Stands today.** The two cards on the Design console open the tool in their own catalogues; the last
measurement was Carbon at 58 and the default at 73. The left column lists a catalogue's components
with a search. The tab opens the application's catalogue by a fixed default; the selector replaces
that default.

**This structure adds.** The selector; the hierarchy under a system (the global console and the tabs,
then components, then children, then functionality) instead of a flat list; the icons on the tree;
selecting a functionality to load its code; the chat's recommendation of the Development tool; the
button to the Development tab; and the console's cards for the different kinds of activity.

## To do

- The system selector: Raibach Design System first and default, Carbon beneath it; choosing either
  rebuilds the tree and the work beside it.
- The tree under a system: the global console and the tabs, the components, the child elements and
  their tools, and the functionality; expanded and rolled up; drawn with the icons already made.
- A functionality node loads its code in the third column when selected.
- The chat recommends the Development tool beside the code; a button opens the Development tab.
  Sending the work to a developer waits.
- The console's activity cards: design-system cards, UX cards, individual component work, and other
  work as it appears; the UX tab's jobs as cards.

## Where this is worked

- [`plans/03-CATALOGUES.md`](./plans/03-CATALOGUES.md) — the systems, their names and their files.
- [`plans/04-UX-TAB.md`](./plans/04-UX-TAB.md) — the UX tab's jobs, each able to stand as a card.
- [`plans/06-CARDS-AND-CONSOLE.md`](./plans/06-CARDS-AND-CONSOLE.md) — the console as a gallery and
  the card as a row.
- [`TODO.md`](./TODO.md) — the open work and the next steps.
