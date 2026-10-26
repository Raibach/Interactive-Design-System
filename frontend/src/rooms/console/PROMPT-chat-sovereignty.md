# PROMPT — The Console's chat becomes the room's own element

> Kept inside the Console folder on purpose: the room's prompts and notes live with the room's
> code. This document is the complete instruction for the next working session.

## The goal

The Console's chat must become the Console's own element — transferred line for line from the
shared chat, exactly as Product's was transferred — keeping everything except the styling and
the theme. The styling and the theme remain under the lit catalog's control.

The Console's chat data is already sovereign: the seat binds the Console's own session and
conversation (`/console/conversation_id`, `/console/session_id`) from the Console's own data
model. What is still shared is the ELEMENT: the seat drawn inside the Console's box is the
shared `chat-panel` from `components/lit/chat-panel.ts`, registered by the global startup list.

## The template — Product did it first

Look at `rooms/product/` as the finished example and follow the same steps:

- `rooms/product/product-chat-panel.ts` and the fourteen parts in `rooms/product/chat/` are the
  shared chat copied with Product tags.
- The room's own files register them; the shared `chat-panel` and its parts are NOT mounted on
  the Product page.
- The conversation block — bar, list, delete — was restored line for line from the shared
  original and fed by the room's own conversation.

## The A2UI difference, stated plainly

Product's seat is HOST-MOUNTED: the room's React renders `<product-chat-panel>` directly.
The Console's seat is EMITTED: the server's assembled surface names the chat component, and the
protocol resolves it through four layers:

| layer | file |
|---|---|
| CATALOG — what the server accepts | `frontend/src/components/A2UI/catalogs/<pipeline>/catalog.json` |
| REGISTRY — what may be rendered | `frontend/src/shared/tag-registry.ts` |
| RESOLVER — name → tag | `frontend/src/components/lit/a2ui-renderer.ts` |
| RUNTIME — what draws | `frontend/src/components/lit/<element>.ts` |

Therefore the transfer must change what the CONSOLE'S surface resolves to: a
`console-chat-panel` copy and its parts, with the Console's own data paths, while the catalog
keeps its styling authority. The protocol rules to obey, from `AGENTS-instructions/`:

- A binding is `{ "path": "/x/y" }` and only the object form is one (`Data-Binding.md`).
- Structure travels in `updateComponents`, values in `updateDataModel` — never both in one
  (`Data-Flow.md`).
- An action is `{ version, action: { name, surfaceId, sourceComponentId, context } }`
  (`Handling-User-Actions.md`).
- The gate is `cd frontend && npm run catalog:check`.

## The rules of the transfer

1. Transfer line for line. Never invent an element; copy the shared/catalog design exactly.
2. Keep the Console's own packages and conversations — never a shared list, never another
   room's thread.
3. Do NOT hide global behavior with guards; SEVER it. If the copied chat carries Composer
   machinery (greeting, arrival, profile reads), the Console's copy either owns its own honest
   version or does not have it — never a switch that covers it.
4. Errors fail loud. No dismiss buttons, no acknowledge states, no suppression.
5. Verify in the browser on `localhost:5001`. The preview on 4173 and the tunnel are rebuilt
   only after the owner approves.
6. The browser is the truth; the code is not. Errors are clues.

## The record

- Update `rooms/console/CHANGELOG.md` as each step lands, with what was verified.
- Keep every artifact — prompts and notes — inside this folder.
