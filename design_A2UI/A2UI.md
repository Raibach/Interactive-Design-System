# A2UI in this repository

Sources: `AGENTS-instructions/Core-Concept.md`, `Components-Structure.md`, `Data-Binding.md`,
`Handling-User-Actions.md`, `Data-Flow.md`, `catalogs.md`.

## The surface

A surface is a component tree plus a data model.

- **Structure** lives in the components: what the interface looks like.
- **Content** lives in the data model: the values the interface shows.
- The assembly loads the component tree. The data binding fills it.

The furniture is the component tree. The data is what changes inside it. A tab press is a data
rebuild, not a furniture rebuild.

## One surface, many sub-surfaces

The room is one surface. The tabs navigate within it through its sub-surfaces. A tab press never
creates a new surface.

The layers of the one surface:

- the frame;
- the left container's content;
- the middle container's content;
- the right column's five slots;
- the tab's active sub-surface: Home, Tools, Approve or UX.

The data model carries the active sub-surface and its values. The renderer draws the same surface.
The tree does not change; the data does.

## Slots and containers

The room is one surface: the frame, the left container, the middle container, and the right
column's five slots.

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
| Catalog | `frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json` | what the server accepts |
| Registry | `frontend/src/shared/tag-registry.ts` | what may be rendered: name → tag, props, events |
| Runtime | `frontend/src/components/lit/<element>.ts` | what draws |
| Resolver | `frontend/src/components/lit/a2ui-renderer.ts` | name → tag |

A component must be in all four. The resolver reads, in order: the composite map, the primitives,
the structural composites, the `f-` names, the fetched system registry, the allowlist. A name that
nothing claims is reported, never guessed.

## Component structure

- Components are an adjacency list: a flat array, each with an `id`, a `component` name and
  properties. Children are ids, listed by `children` (static) or a data path (dynamic).
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

1. The server assembly emits the one surface's component tree: the layers, the containers and
   the slots.
2. The tab's data binding selects the active sub-surface and fills the slots; the tab's actions
   answer them.
3. The renderer draws the same surface. The data changes; the surface does not.
4. The tab's folder is the model's context: the component tree, the data binding, the actions and
   the conversation. The model reads the folder to know what the tab can do.

## The seat's application

- The room is one surface; the tabs are navigation within it through its sub-surfaces. The chat
  is the right column's slots, not a column apart.
- The left and middle containers are stable; the tab's content is served inside them.
- The tab's data binding, actions and conversation ids are its own. No tab reads another tab's.
- The database mirrors the tabs: package → tab → conversation → message.
