# PER-TAB CONSOLES — the shape, and what is parked until the shell is refactored

Written 2026-10-21, at the owner's direction, so the next piece of work is isolated to one folder and
one tab. **Status: PARKED.** Nothing here is implemented. Build it after `WritingAreaIndex.tsx` is
decomposed — the owner's words: *"we can forgo that until after we structure its file, it will be
easier to modify after refactoring."*

## The shape the owner described

- **Each tab has its own console.** The Console tab is the first one: it shows **all cards** and is the
  navigation item. Every other tab's console **acts as a filter** — it loads the cards that belong to
  that section.
- **Design is the only section console that exists so far.** The others (Composer, Product,
  Development, Governance) are not built yet.

## What the Design tab does today (measured 2026-10-21, not assumed)

- The cards in the Design room (`ActionGroup`, `add-section-button`, `agent-card`, `agent-flow` …,
  paginated "1 of 15") are the **A2UI catalogue's own elements**, drawn by the design renderer.
- They are **not a package**. `assembleSurfaceWithAI` is only ever called with `render-console`,
  `render-session:<id>` and `render-composer` (shell lines 4073 / 6396 / 6398). `render-design`
  appears only inside a comment (line 8429).
- `setDesignTree` has exactly one writer (line 6647), inside `setDesignPreview` — so the grid is
  populated from the catalogue, not from a surface the backend assembled.
- The Design room carries **two live apps in the frame**: the Figma ingest app and PostHog. Any change
  to this room must keep both loading.

## What must be built (in this order, when the refactor is done)

1. **Backend** — a `render-design` intent in `/ai/assemble-surface` that returns the catalogue cards
   as a surface scoped to its **own package session** (`X-Package-Session`), separate from the main
   Console's packages.
2. **Shell/room** — the Design room asks for `render-design` with that package id instead of building
   the list itself. Pagination ("1 of 15") stays as it is.
3. **A new CRUD path for sessions in this tab — TBD.** The owner: *"we will need to create a new CRUD
   path for sessions in this tab, TBD."* Not designed yet. Do not invent it; ask for the shape.

## Where the work will live

**OWNER'S STRUCTURE RULE (2026-10-21):** *"each tab in design should have a file and a folder perhaps,
these are independent chats and sessions, packages and data."*

So every tab owns its own folder and its own module — nothing shared through the page:

```
frontend/src/rooms/
  console/      ← the tab that shows all cards (the navigation item)
  composer/     ← its own chat, session, package, data
  design/       ← its own chat, session, package, data (+ Figma ingest and PostHog frames)
  product/      ← idem
  development/  ← idem
  governance/   ← idem
```

Each folder holds that tab's: the seat component, its hooks, its assembly call, its conversation and
its package id. Independence is the point — a tab's chat, session, package and data never leak into
another tab's.

When the shell is decomposed, this tab's console becomes its own module (the seat pattern: `rooms/`,
`design/`), so the change touches that module and the backend intent — not an 8,173-line page.

## Hardening the Design tab — what the logs actually said (2026-10-21)

After a fresh navigation (not a stale page): the Design tab **loads cleanly** — 4 catalogue cards
render, the earlier `Failed to fetch dynamically imported module` does **not** recur (that was a stale
page holding a chunk hash a rebuild had replaced; `assets/index-Dd3ODE-h.js` is not on disk).

One real defect remains, seen repeatedly (13:06, 13:18, and again after the fresh load):

```
ERROR [chat-panel] refused conversation f13c2530…: it is not in package 1d61cd4c's own list of conversations.
```

The panel is right to refuse — that conversation does not belong to the package that is open. The
open package's own list has **1 Conversation**. Not found in `localStorage` or `sessionStorage`, so the
stale id arrives from the backend's session payload or from a kept selection, not from browser
storage. **Not fixed yet.**

**Exact target for the fix (located 2026-10-21):**

- The refusal is thrown at `frontend/src/components/lit/chat-panel.ts:3084`.
- The same behaviour is **duplicated three times** — `components/lit/chat-panel.ts:3084`,
  `design/design-chat-panel.ts:3423`, `design/design-chat.ts:3423`. Fix all three, or the Design room
  will keep whichever copy it is running.
- The list it validates against is host-fed: `chat-panel.ts:202` (*"The package's conversations, fed by
  the host — the selector's list"*) and `:567`.
- The fix is **not** a substitute conversation and **not** anything that hides the mismatch (the
  owner forbids both: *"neither error suppression nor fallbacks are allowed in the system"*). The work
  is: (a) **identify the producer** that hands the panel a conversation id the open package does not
  own — the session payload from the backend, or a kept selection — and correct it to supply only ids
  from that package's own list; (b) if an invalid id still arrives, **fail hard and report** it — show
  the error in the surface with both ids and the package, log it, and report it to the system; (c) add
  a check so the mismatch cannot recur silently.
- **Unknown, and not to be invented:** whether the backend's list is wrong or the id is stale from a
  previous open. That has to be read out of the payload before any code changes.
