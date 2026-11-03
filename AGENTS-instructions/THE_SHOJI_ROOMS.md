# The Shoji Rooms — Simple Is Expensive

**Author:** John Holt, Raibach Interactive Design Studio
**Status:** Working doctrine — restated and captured 2026-10-22
**Companion documents:** [`THE_ENGINEERING_PHILOSOPHY.md`](THE_ENGINEERING_PHILOSOPHY.md) (determinism and the compiled-AI method) · [`THE_METHOD.md`](THE_METHOD.md)

> The tabs are rooms. The doors between them are shoji — sliding screens. They open to let
> the light in, they close, and a small simple space becomes a multidimensional experience.
> The user sees a calm surface; all the complexity lives underneath, on purpose.

## The rooms slide like shoji

A tab is a room behind sliding doors — the fusuma/shoji metaphor this studio has always
used. The behaviours are physical, not decorative: the fade is the screen sliding, the
slides are the screen moving in its track, the grippers are the hand on the frame.

Because a person can push things out, bring the chat back, and slide everything else out of
the way, the SAME interface serves every adoption level — novice to advanced. The novice
keeps the chat and the instructions beside them; the advanced worker slides them away and
the whole screen becomes the work. One room, reshaped to whoever is standing in it.

The destination, in the owner's own words: an engineer in the field clicks a card on the
Console, a schematic built by a prompt appears, and they slide the chat to the right and the
prompt instructions to the left — now the full screen is the schematic. Zoom in, make notes.
Not built yet — this is the target the shell serves.

## The UX seat's nav — a sliding panel, one face everywhere

The left navigation for the UX seat, inside the Design tab, must:

- **behave like the governance nav** — clicking the logo expands the menu,
- **appear like the console nav** — the same face,
- **operate like a shoji sliding panel** — it slides open and shut, never pops,
- **feel consistent in every tab**.

No framework requirement — not React, not any particular build. The behaviour IS the spec:
a sliding panel, one face everywhere, bespoke underneath.

## The process is inverted — and that is deliberate

The industry builds software backwards. Engineers design everything the same, repurpose
components to cut production time, and then decorate it at the end. The user gets the result
of an engineering process that was never about the user.

This studio reverses it. The design comes FIRST — for the user — and then the engineering
works back into the complexity. Verbatim:

> "I decorate it first and then I engineer it, because I'm a software designer."
>
> "I designed for the user and then I work my way back to the complexity of the engine
> engineering. I don't start with engineering and try to make it simple… that's the reverse.
> It's been wrong for decades."

A model trained on the industry's path is trained on the inverted process. When work in this
repository drifts, that inversion is almost always the reason.

## Same look is NOT the same build

The interface is consistent. The code is not. This is the rule that separates this system
from a component library:

> "It's the same pattern, it's the same color, it's the same shape — no, it's not the same
> component. It just LOOKS like the same component."

Never reuse or standardize a component because it looks identical to another tab's. That is
the engineer's shortcut, and it is exactly what breaks the system. Example, verified in code:
the Console's left nav (`LeftVerticalMenu`) is a data menu over our own store; the
Governance left nav (`GovernanceNav`) is a section rail that deep-links an embedded app.
Same face, two entirely different builds, swapped into the same slot. The slot is shared; the
builds are bespoke.

## Folders, not a component library

The system is partitioned by **folder**, never by an abstract shared component registry.
Every tab owns a folder, and each folder can hold its own shell file — for example
`design/WritingAreaIndex.tsx`, `development/WritingAreaIndex.tsx`. A bespoke program gets
its own file and its own interaction layer; it does not live inside a global frame.

The partition goes down to every surface, not just the tab (owner, 2026-10-22): the header
loads as its own file, the left nav loads as its own file, and each tab loads its own chat
component as its own file. When a surface is assembled from the Lit catalog, it gets its own
registry entry and its own section — and each tab already has its own database. That is the
illusion in full: *"they're not all the same — they just look the same."*

`WritingAreaIndex.tsx` is **not** a universal container. Its only job is navigation: the tab
bar, the header, the active tab, the shared session/package id, and the lazy room imports.
Target: ≤ 1,000 lines, zero room behaviour left in it. The extraction plan
(`development/ops/WRITING-AREA-EXTRACTION-PLAN.md`) is the scoreboard for that.

## There are exactly two patterns

The application never changes its patterns. There are two, and only two:

1. **Console** — a grid of cards.
2. **Composer** — three columns: left, middle, the chat on the right.

Every tab is one of those two patterns, built bespoke underneath. Do not invent a third.

## The shell never changes — the illusion of continuity

The header and the main navigation never change and never go away. That is the fluid
continuity. When a tab switches, the user must never see a white flash or a reload — the new
shell fades in, and continuity is the illusion the interface maintains.

This is not a lie. It is the drama of the interface, and its purpose is **usability**. One
seamless surface, many bespoke shells underneath.

## The shell paints no room's ground

The header and the navigation are the shell. The background under a room is not. A room that
needs a ground owns it in its own folder; the shell must never lend a room a fill that makes
another surface show through it. The cream fill that once stood on the main container in
`pages/WritingAreaIndex.tsx` was removed for this reason, and the Product box is transparent
behind its builder and chat. What shows there is the application's theme, the one background
every room shares.

## The line between illusion and fake

The same instinct has two faces, and only one is allowed:

- **Allowed** — the illusion in service of the user: the same-face nav, the fade, the
  seamless continuity across bespoke shells.
- **Forbidden** — the illusion that a thing is *working* when it is not: error suppression,
  fallbacks, shortcuts, a fake state standing in for a real one.

One is craft. The other is a lie. Never blur them. (Blank beats fake — see
[`THE_SUPPRESSION_RECORD.md`](THE_SUPPRESSION_RECORD.md).)

## Simplicity is expensive

> "It takes a lot of work, a lot of bespoke crafting of code, to create something so simple."

The simpler it looks, the more bespoke work went into it. Simplicity is not the absence of
engineering; it is the result of it, all of it hidden.

## The only person who never notices is the user

Three applications run inside this system, on three engines: bespoke Figma ingestion, the
Composer's AI orchestration, and the Console that organizes everything into packages. The
user never sees any of it — and that is the design working. The complexity is ours, not
theirs.

## Words are instructions, not suggestions

The owner dictates, and because he is not a developer the wording feels casual. It is not:

> "It feels casual because I'm dictating and I'm not a developer, but there's nothing casual
> about my instructions."

When he names tabs, work exactly on those tabs. Never extrapolate a change to "everywhere."
Never remove a bespoke thing (a colour, a behaviour) that was not broken.
