# Design A2UI — the rules

## The room is one surface

- The top tab is the room. It opens the default sub-surface, Home (the Chat tab: the console
  cards and the chat). The rail navigates within the surface through its sub-surfaces: Home,
  Tools, Approve, UX. The top tab stays. A tab press never creates a new surface.
- The room is one surface made of layers: the frame, the left container, the middle container and
  the right column's five slots. The chat is the right column's slots; it is not a column beside
  a separate left surface.
- The furniture is assembled once. A tab press changes the active sub-surface and re-injects its
  data; it does not rebuild the surface. The built pages are kept; a new session re-injects data
  into the kept furniture.

## Slots and containers

- The five slots are `HEADER`, `CONVERSATIONS`, `OUTPUT`, `INPUT`, `FOOTER`. The seat declares
  them in `frameSlotTags`; the parts carry `data-slot`.
- The left and middle containers are stable: the panel, the width, the frame and the slot. The
  tab's content is served inside them — the console grid, the Figma ingest tree, the approvals,
  the UX app.
- A tab may add furniture inside a slot or a container. Nothing outside it changes.
- The slot is the data-binding boundary. The slot's data binding and actions belong to the tab.

## The line

- **Universal:** the A2UI process — renderer, catalog schema, primitives, structural containers,
  tokens, registry mechanism.
- **Kernel:** sign-in, fetch/transport, realtime, error handling.
- **Per tab:** the slot and container furniture, the data binding, the user actions, the
  conversation ids.

No data-binding module is shared between tabs. No tab reads another tab's conversation ids. A
universal component is allowed only when its data comes from the tab's binding.

## The shell holds a link, not the seat

- The React shell is navigation. It holds one tab for this seat, and that tab is a link to this
  folder's own surface. The shell never imports this folder's code, its components, its styles or
  its tests.
- This folder is the whole seat: its surface, its component tree, its catalogue entries, its
  registry entries, its data binding, its actions, its conversations and its back end. Nothing the
  seat needs lives in the shell.
- The test, and it is a rule: remove this folder and the living application still runs. The tab
  then fails, honestly, because its link points at what is gone. A blank room is a defect; a
  reported missing surface is the correct answer.
- A change made in the shell to make this seat work is a defect. The seat fixes itself in here.
  The only thing the shell may hold is the tab and the address it links to.

## The UX surface hosts an application

- The UX tab shows the running analytics application (PostHog) in a frame at `/posthog`. It is
  the application's own interface, not a re-drawing: the frame owns no data and shows what the
  application shows.
- The application is a COMPONENT OF THE SURFACE: the frame is one node in the surface's tree, and
  its address comes from the surface's data. The surface hosts the application; it does not draw
  around a second copy of it.
- It loads exactly as it does in the living site: the same address, the same behavior when the
  application is not served, the same silence of a cross-origin refusal. The refactor extracts the
  chat and the frame's surroundings; it never rewrites the framed application, its address or its
  screens.
- The live site is the behavior to match for every seat. The extraction changes where the code
  lives, never what the person sees or does.

## A self-describing surface

- A surface describes itself: its own catalog file (what the server accepts), its own registry
  entries (what may be rendered — name → tag, props, events), its own runtime elements under its
  own tags, its own resolver mapping, and its own data binding and assembly. Reading this folder
  tells the model what the surface can draw and do; nothing outside it is required to understand it.
- The four layers are the seat's, not the section's. The same-looking element in two seats is two
  copies with two names; that is deliberate. Each seat must pass its test from its own four layers,
  its own names and its own data. A shared element is not shared during this refactor; it is copied.
- After every seat is sovereign and passes its own test, the components may be consolidated into a
  central repository and each seat's registry may point at it. Then the sharing is a choice with a
  proven fallback, not a dependency. The consolidation comes after the test, never before.

## The tree

```
design_packages
  design_tabs              chat, tools, approve, ux
    design_conversations   each row names its tab_id
      design_messages      each row names its conversation_id
    design_records         the tab's records
    design_events          the tab's events
  design_package_records   the package/console records
```

The frontend mirrors it: the chat surface is the package; one folder per tab; one
`conversations.ts` per tab.

## Parity

- The masks are frozen and named: the top tab labels and active state, the readout, the
  conversation list and thread, the console card grid.
- Any non-masked pixel difference is a defect. Never add a mask to reach zero.
- `npm run parity:design2` exits non-zero on any diff.
- The behavior run is required: send, select, save, approve, on both seats.

## The flag

`surface-design/tab.ts` carries `enabled: false` until the seat has its own session, container and
conversation keys. While it is false, the tab is absent from the bar and the drawer, it is not
landable, and nothing mounts it. The only enabled window is the parity/test run, with no saves.

## Extraction order

1. `components.ts` — the tab's component tree.
2. Header, footer, tray.
3. Conversation, messages, input.
4. Actions and turn.
5. State and the conversation rules, last.

One behavior per file; one extraction per commit; parity after each. The furniture stays; the seat
becomes a thin composition. Watch import order, the CSS cascade and circular imports.

## Rename completeness

The old element prefix in the new seat returns zero, except the documented shared names. The new
prefix in the current Design returns zero. Strings count: query selectors, data attributes, event
names, localStorage keys, tab keys.

## Names

The displayed seat is **Design A2UI**. The old seat is **Design**. The folder is `design_A2UI/`.
The import alias remains `@design2`, the tab key remains `design2` and the element prefix remains
`design2-`; these are internal names and do not change with the folder.

## Freeze and sunset

Design A2UI is the successor. The current Design sunsets when the duplicate passes parity and its
backend is untethered. A change made only to the current Design during the migration is a defect in
the duplicate.

This folder is the template for the other seats. When the refactor is complete, a second seat is a
copy of its structure — the surface, the places, the data, the actions, the conversation and the
back end — with its own tab, package and conversation. Nothing in the template may be specific to
Design's data; a place is data, actions, view and state, and the seat supplies the values.
