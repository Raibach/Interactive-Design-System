I will start with the folder you pointed at, then map the Design chat surface from the element down to its bindings, events and data.

The SLOT plan already names the five boxes. I will now map the TypeScript layer: the seat's state, its bindings, the events it emits, and the data calls, so the duplication recipe is exact.

# PLAN: The Chat Surface as a Vertical Slice

*This is a separate plan. It does not modify the grounds plan or the Design-seat untethering plan.*

## What the person sees

A tab's chat is one column with five stacked boxes: the readout, the saved conversations, the output, the input with Send, and the tool tray. The conversation list, the new conversation button, the delete, the turn, the readout, the tool tray and the column's drag all work inside that tab. Duplicating the chat into another tab produces a second, independent column: its own conversation list, its own turns, its own package, its own words, its own imports. Nothing in the new column points back at the Design seat.

## The answer to your structural question

Yes. The logic, the binding and the data rules are in the TypeScript, and they are layered like this:

| Layer | What lives there | Where it is today |
|---|---|---|
| The host | Sets the element's properties, places it in the right column, listens to its events, switches tabs | `rooms/design/DesignSeatShell.tsx:925-1015` |
| The seat element | The binding (properties), the internal state, the send, the reply handling, the action parsing, the render | `rooms/design/chat/design-chat.ts` |
| The conversation module | The data rules and the calls: list, read, belong-check, move, create, remove, adopt newest | `rooms/design/chat/conversation.ts` |
| The frame module | The five boxes, their bands, the pull, the stop, the accordion | `rooms/design/frame/chat-frame.ts` |
| The parts | The contents of each box: header, list, messages, input, action bar, footer, navigation, tray, bubbles, banners | `rooms/design/chat/parts/*.ts` |
| The look | The five boxes' styles and the column's ground | `rooms/design/chat/design-chat.styles.ts` |
| The server | Conversations, messages, the turn, the package pointer, the surface state | `/api/conversations`, `/api/conversations/{id}/messages`, `/api/conversations/{id}/surface-state`, `/api/teacher/query`, `/api/prompt-sessions/{id}` |
| The A2UI data | The package, its instructions, its tab packages and its live facts | The surface's data model, handed in by the host |

The TypeScript is the wrapper between the surface and the parts. The host gives the element the package, the conversation, the instructions and the tab packages. The element owns the behavior and draws the parts. The server owns the data. The A2UI data model carries the package facts into the host.

## The slice manifest

A tab's chat slice is these files, and only these:

```
rooms/<tab>/chat/
  <tab>-chat.ts            the seat element (binding, state, send, replies, render)
  <tab>-chat.styles.ts     the five boxes and the column's look
  conversation.ts          this tab's data rules and calls
  frame/chat-frame.ts      the five boxes, the bands, the pull, the stop
  parts/                   the box contents, each a <tab>-chat-* element
  assets/                  the icons this tab uses, its own copies
  README.md                this slice's contract
```

The five boxes today, from the seat's `frameSlotTags` (`design-chat.ts:1726-1734`):

| Box | Element today | What it holds |
|---|---|---|
| `HEADER` | `output-header` | the status line, tokens, calls |
| `CONVERSATIONS` | `design-chat-header` (slot `conversations`) | the saved conversations |
| `OUTPUT` | `design-chat-header` (slot `session`) | the thread |
| `INPUT` | `design-chat-action-bar` | the typing box, Send, the input grip |
| `FOOTER` | `design-chat-plugin-tray` | the tools |

## The binding contract

The properties the host sets on the seat, as the code stands today (`design-chat.ts:205-417`):

**The chat's own facts**
`sessionId`, `conversationId`, `instructions`, `messages`, `conversations`, `designPackages`, `dataModel`, `activeTab`, `collapsed`, `railOwnedByHost`, `allowedTabs`, `tabLabels`, `disabledTabs`, `tracePrompt`, `graceLiveContext`, `usage`, `inputHeight`.

**The readout and the header**
`statusText`, `status`, `sessionLabel`, `sessionName`, `duration`, `qaScore`, `packageTitle`, `packageDescription`, `modelLabel`.

**The room's facts**
`leftColumnContent`, `compiledOutput`, `consoleCards`, `catalogFindings`, `unannotatedInUse`, `governanceTrace`, `governanceObservation`, `composerPackageId`.

**The product and evals bindings**
`productTools`, `evalsTalk`, `productRoom`, `productFigmaConnected`, `productGithubConnected`, `productVisualEditActive`, `productRunning`, `productRunStartedAt`, `productExpectedMinutes`.

For a new tab, the first group is required; the room's facts and the product bindings are added only when that tab has them. The seat must receive `graceLiveContext` or it refuses every turn, and it must receive `instructions` or it refuses for a different reason.

## The event contract

Events the seat emits, and who answers them today:

| Event | What it carries | Who answers it |
|---|---|---|
| `tab-change` | the pressed tab | the room's shell, which switches the container |
| `conversation-select` | the conversation id | the seat itself, through the conversation module |
| `conversation-change` | the adopted conversation id | the host, to keep the pointer in step |
| `a2ui:person-turn` | conversation, session, the person's text | the room that builds on a person's turn |
| `a2ui:usage` | the call's tokens, cost, conversation | the readout accumulator |
| `a2ui:system-message` | a sentence for the thread | the thread |
| `a2ui:run-blocked` | nothing | the room's gate |
| `input-resize-start/move/end` | the composer's band | the seat's own input sizing |
| `right-column-drag-start` | the column's spacer | the host, which owns the column's width |
| `insert-tool`, `move-tool`, `set-left-column-text`, `clear-left-column`, `set-prompt-title`, `set-package-description`, `add-prompt-role`, `remove-prompt-role`, `merge-seat`, `a2ui:write-seat`, `a2ui:fix-all`, `a2ui:run-approved`, `a2ui:build-wireframe`, `a2ui:edit-node`, `ai-eval-grounding`, `ai-show-version`, `a2ui:console-command` | the surface commands her reply parses | the room's own listeners |

A new tab wires the events it needs. The minimum for a working chat is `tab-change`, `conversation-select`, `conversation-change`, `a2ui:person-turn`, `a2ui:usage` and the input-resize trio.

## The data calls

| Call | Used for |
|---|---|
| `GET /api/conversations?session_id=…&include_archived=true` | the tab package's list |
| `GET /api/conversations/{id}/messages?limit=200` | the open thread |
| `POST /api/teacher/query` | one turn; the body carries the question, the context, the session, the conversation, `person_turn` and `reasoning` |
| `POST /api/conversations` | a new conversation on the package |
| `PUT /api/prompt-sessions/{id}` | repoint the package at the new conversation |
| `PUT /api/conversations/{id}/archive`, `DELETE /api/conversations/{id}`, `DELETE /api/messages/{id}` | archive, delete, clear |
| `GET` / `PUT /api/conversations/{id}/surface-state` | the thread's scroll position |
| `GET /api/prompt-sessions/{id}` | the package's current conversation pointer |
| `GET /api/governance/usage/summary?conversation_id=…` | the readout's totals |
| `GET /api/ai/tools` | the tool tray's list |

## The duplication recipe, for a model

This is the instruction to hand to a model. It is written to be copied as-is, with `<tab>` replaced.

1. **Source.** Use the Design chat vertical slice at `frontend/src/rooms/design/chat` as the source. Copy these files into `frontend/src/rooms/<tab>/chat/`: `design-chat.ts`, `design-chat.styles.ts`, `conversation.ts`, every file in `parts/`, and `rooms/design/frame/chat-frame.ts`.
2. **Rename.** `design-chat` → `<tab>-chat`. Every `<design-chat-*` element tag → `<tab>-chat-*`. Every class name matches its tag. The five `data-slot` values stay `header`, `conversations`, `session`, `input`, `footer`. The five `frameSlotTags` point at the new element tags.
3. **Assets.** Copy the icons the seat imports into `rooms/<tab>/chat/assets/`, and import only those copies. Do not import anything from `rooms/design`.
4. **The conversation module.** Point `conversation.ts` at the new tab's package. The package is the divider: the list is that package's conversations, never another tab's.
5. **The seat's registration.** In the new tab's room file, import `<tab>-chat.ts` so the tag is defined before the element is created.
6. **The host wiring.** The new tab's shell creates `<tab>-chat`, sets `slot="right"`, places it in the layout's right slot, and sets these properties: `sessionId` (the tab's package), `instructions` (the tab's own Grace script), `dataModel`, `designPackages`, `graceLiveContext`, `activeTab` (the tab's name), and the readout facts. It listens to `tab-change`, `conversation-change`, `a2ui:person-turn`, `a2ui:usage` and the input-resize events.
7. **The backend.** Create the tab's package and its conversation rows, and give the tab its own Grace instructions. The chat turn uses the same `/api/teacher/query` door with that package and conversation.
8. **The five boxes.** Pull every band by hand, in both directions, and check the six rules in `SLOT-PLAN.md`: nothing hides, nothing collapses away, nothing goes underneath, the column never scrolls, the stop is in the pull, and each box returns to its default.
9. **The conversation checks.** Load the tab, select a row, start one, remove one, type and send, reload and confirm the same conversation and the same text.
10. **The boundary check.** No file in the new slice imports from `rooms/design` or any other seat. The only shared imports are the A2UI process (renderer, primitives, tokens, protocol), the platform services on the agreed list, and the tab's own assets.

## The acceptance checks

| Check | What passing looks like |
|---|---|
| The five boxes | every box is on screen at all times; each band pulls; each bar opens and closes; no box goes under another |
| The list | the tab's package's conversations only; newest first; select, create and remove all work |
| The turn | a typed message draws, the wait is shown, the reply lands, and a reload shows the same thread |
| The words | the tab's own instructions, not the Design seat's and not the Composer's |
| The readout | the tab's own conversation's tokens and calls, not another conversation's |
| The imports | the slice compiles with `rooms/design` absent; no cross-seat import exists |
| The independence | the Design chat still works when the new tab is removed, and the new tab works when the Design chat is removed |

## What stays shared, and what does not

Shared: the A2UI assembly process only — the renderer, the protocol envelope, the generic primitives and structural containers, the design tokens, the catalogue schema, the registry mechanism, and the generic assembly utilities.

Copied into the slice: the seat, the conversation rules, the frame, every part, the styles, the assets, the words, the package, the events.

The one open decision is the platform list: sign-in, logging, error reporting, API access, app configuration, the event bus and the formatting helpers. If those stay shared as platform, they are the only exception. If not, they are copied too.