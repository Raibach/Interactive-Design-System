# A2UI in this repository

Sources: `AGENTS-instructions/Core-Concept.md`, `Components-Structure.md`, `Data-Binding.md`,
`Handling-User-Actions.md`, `Data-Flow.md`, `catalogs.md`.

## The surface

A surface is a component tree plus a data model.

- **Structure** lives in the components: what the interface looks like.
- **Content** lives in the data model: the values the interface shows.
- The assembly loads the component tree. The data binding fills it.

The furniture is the component tree. The data is what changes inside it. A tab press sends the
tab's own rows on the structure channel when the tab's furniture differs; the frame and its regions
keep their ids, so the room does not stand up again. The values still travel on the data channel,
and the tab is one of them (`/surface/tab`). The earlier rule — "a tab press is a data rebuild,
never a furniture rebuild" — asked the standard to select a subtree by a value, which its component
vocabulary does not express. The surface sends the new rows and keeps the frame.

## One surface, many sub-surfaces

The room is one surface. The tabs navigate within it through its sub-surfaces. A tab press never
creates a new surface.

The layers of the one surface:

- the frame;
- the left container's content;
- the middle container's content;
- the right column's chat, whose five boxes are the chat component's own drawing;
- the tab's active sub-surface: Home, Tools, Approve or UX.

The data model carries the active sub-surface and its values. The renderer draws the same surface.
A tab press writes `/surface/tab`; the tree's children change through the data, not through a new
surface.

## Slots and containers

The room is one surface: the frame, the left container, the middle container, and the right
column's chat. The chat's five boxes are the chat component's own drawing, not five more surface
nodes.

```
HEADER          the readout: session, calls, tokens
CONVERSATIONS   the saved conversations
OUTPUT          the thread
INPUT           the typing area and Send
FOOTER          the tools
```

- Each slot has a `data-slot` and a tag in the seat's `frameSlotTags`.
- The slot is the data-binding boundary. The tab's data binding and actions serve the slot.
- A tab may add furniture inside a slot. Nothing outside the slot changes.
- The left and middle containers are stable in the same way. The tab's content is served inside
  them; the container's frame and width do not change.

## The four layers

| Layer | File | Decides |
|---|---|---|
| Catalog | `surface-design/catalog.json`, exported from `surface-design/catalog.ts` | what the server accepts |
| Registry | `surface-design/registry.ts`, exported as `surface-design/registry.json` | what may be rendered: name → tag, props, events |
| Runtime | `design_A2UI/**/<element>.ts`, `frontend/src/components/lit/<element>.ts` | what draws; the living elements are registered by `frontend/src/components/lit/register.ts` |
| Resolver | `frontend/src/components/lit/a2ui-renderer.ts` | name → tag |

A component must be in all four. The registry's source is the TypeScript file; `registry.json` is
the served name→tag table the shell's renderer reads. The shell's `tag-registry.ts` is the
fallback allowlist, not the seat's source. The resolver reads, in order: the composite map, the
primitives, the structural composites, the `f-` names, the fetched system registry, the allowlist.
A name that nothing claims is reported, never guessed. A `{path}` binding that resolves to nothing
is reported as `VALIDATION_FAILED`, not dropped.

The runtime layer may be an element in this folder or one in the app's own component folder. Four
of this room's names — `design-left-panel`, `design-middle-container`, `component-preview`,
`draft-preview` — are the app's elements, registered by `frontend/src/components/lit/register.ts`;
the folder's check scans both trees for the definition and for the import that registers it.

## The catalogue cycle

The Lit catalogue — the elements this application registers — is the catalogue the surfaces are
assembled from. A design system's ingestion partition (the Composer's catalogue, or a system's own)
is what the Figma tools and the catalogue tree read. The cycle is ingestion → approval → Lit
catalogue → assembly:

- the Figma file is read into the ingestion partition;
- a component enters the Lit catalogue through the approval gate: the card is drawn in the third
  column, approved, and written as one catalogue entry;
- the surface assembles from the Lit catalogue, and the next ingestion starts from the same list.

The Composer's partition is therefore the Tools tab's LIST, not a second assembly authority. The
room's own catalogue is generated from `surface-design/registry.ts`; a name it does not hold is not
in the room's tree. The tools list loads every declared entry so a designer can see the whole
catalogue, and it marks the entries nothing on the front end uses.

## Component structure

- Components are an adjacency list: a flat array, each with an `id`, a `component` name and
  properties. Children are ids, listed by `children` (static) or a data path (dynamic).
- A component that draws NAMED regions declares them in its catalogue entry under `placements`
  (region name → child id). The standard's child list carries no region names, so this is the one
  declared addition: `children` stays the standard's array, and the renderer places each child by
  the region that names it. A child no region names is reported, never drawn nowhere.
- Do not nest markup inside a component's own template. Composition happens in the runtime.
- Structure in components; values by `{ "path": "/x/y" }` when they come from the data model.
- The catalog schema defines the accepted properties. `$defs.anyComponent.oneOf` must reach every
  component. The registry declares the tag, its surface, its props and its events.

## Data binding

- A binding is an object with a JSON pointer path: `{ "path": "/session/form/title" }`. A bare
  string is not a path.
- A path that resolves to nothing renders empty. Report it; never substitute a stand-in.
- Static lists are children ids. Dynamic lists are a path plus a component id; each item scopes
  the paths inside it.
- Inputs use the Read/Write contract: the component reads its value from the path, and a user
  interaction writes the new value immediately, before any event.
- Structure and content travel on two channels: `updateComponents` for the tree,
  `updateDataModel` for the values. Never both in one message.

## User actions

- An action is either an **event** (handled by the agent or the host) or a **function** (handled by
  the renderer).
- An event has a stable `name` and a `context` of values, each a literal or a path. The renderer
  resolves the paths against the data model before it dispatches.
- The renderer reports a validation failure back with a `VALIDATION_FAILED` error; it never hides
  it.
- In this repository, a component dispatches a declared custom event. The seat or the room listens
  and performs the action. The event is declared in the registry and must have a listener; the
  audit reports an unheard event. The furniture does not own the data.

## Data flow

1. `createSurface` names the surface and the catalog.
2. `updateComponents` sends the tree.
3. `updateDataModel` sends the values.
4. The renderer draws the tree and resolves the paths.
5. A user action goes back as an event; the host or the agent answers.
6. The answer updates the data model or the tree.

## Serving in this repository

1. The server assembly emits the one surface's component tree and its one data model, under one
   `surfaceId`. The door is `POST /api/design/console`; `surface-design/surface/load.ts` reads it
   once. The door announces this room's own catalogue and validates the tree against it: a name,
   a property, or a child standing in no declared region is refused with `VALIDATION_FAILED`, and
   nothing is drawn. The other rooms record the same check as a finding until their catalogues can
   describe their own trees.
2. The tab's data binding selects the active sub-surface and fills the slots; the tab's actions
   answer them. The left column, the middle column and the chat are children of the same root;
   none of them is cut out of the tree.
3. One `<a2ui-renderer>`, told `system="surface-design"` and the door's `surfaceId`, draws the
   same surface. The data changes; the surface does not.
4. A path the model does not hold is reported as `VALIDATION_FAILED` and shown in the room.
5. The tab's folder is the model's context: the component tree, the data binding, the actions and
   the conversation. The model reads the folder to know what the tab can do.

## The seat's application

- The room is one surface; the tabs are navigation within it through its sub-surfaces. The chat
  is the right column's single node; its five boxes are its own drawing, not a column apart.
- The left and middle containers are stable; the tab's content is served inside them.
- The tab's data binding, actions and conversation ids are its own. No tab reads another tab's.
- The database mirrors the tabs: package → tab → conversation → message.
