# The Development room

The room behind the Development tab. It is the OpenHands Agent Canvas on the left, Grace's chat on
the right, over the paper lab tile, and it belongs to the room rather than to the shell.

## What lives here

| File | What it owns |
| --- | --- |
| `DevelopmentBox.tsx` | The room box (`data-room-box="development"`) and the lab tile: the tile at natural size, repeated, over `#2b2635`. It mounts the container. The shell mounts this one component. |
| `DevelopmentRoomContainer.tsx` | The layout ref, the seat ref, and the call to the room's behaviour. |
| `DevelopmentRoom.tsx` | The pane: the room's own workspace on the left, the tool inside it, the room's own chat on the right. Carries `data-room-root="development"`. |
| `useDevelopmentRoom.ts` | The room's two statements: the column is closed on entry with the room's rail list, and the seat binds the room's own package and conversation. |
| `development-workspace.ts` | The room's own copy of `components/lit/workspace-layout.ts`, retagged `development-workspace`. |
| `development-chat-panel.ts` | The room's own copy of `components/lit/chat-panel.ts`, retagged `development-chat-panel`. |
| `PLAN-sovereign-development.md` | The Step 1 plan and its exact shell moves. |
| `PLAN-remaining-development.md` | The remaining room steps and the tool's open work. |
| `CHANGELOG.md` | The measured record. |

## The package and the conversation

The room's chat binds `POST /api/builder/development/room`, which ensures one `prompt_sessions` row
marked `dev_room` — hidden from the Console's cards — with its own conversation. The seat binds that
row's session and conversation, the title `Development`, and the room's instructions. Nothing of the
Composer's or Product's conversation reaches this seat.

## The rail

`chat,trace,tools,approvals,eval,states,repair,settings` — every drawable tab except Versions
(`DEVELOPMENT_SEAT_TABS`). The rail is written as the seat's first fill and again with the package's
bindings; an empty bound list falls through to this list, never the full rail.

## The tool boundary

The OpenHands application is the tool and is not touched by this room. It runs from
`development/OpenHands-main` on port 8090, served under `/dev` on 5001, with telemetry cut and the
house theme in its own source. It paints its own copy of the lab tile into its page; the box paints
the room's tile behind both columns. The tool's own agent is not connected to this chat: a
Development turn goes to Grace's `/api/teacher/query` today.

## Open items

- **The sever is staged.** The Product room's branches and the Console's library, reassemble command
  and composer action are removed. The Console's seat-scope and hello flow, the Governance room's
  trace facts, and the Composer's hello are still in the copy and are inert here; they are the next
  sever stage in `PLAN-remaining-development.md`.
- **The wrapper's sever is deferred** to the Composer's cut, when the shared source is retired.
- **Health, the bridge, the sandbox and the spending cap** are the tool track in
  `PLAN-remaining-development.md`. The sandbox decision is made at deployment; the spending cap is
  deferred.
