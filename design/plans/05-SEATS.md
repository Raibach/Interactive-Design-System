# The seats — its own plan

*2026-11-02. For review.*

## What the person sees

In every tab of the Design section, the right column behaves the same way — the five boxes, the dots,
the pull — and speaks about the work in that tab. Chat is the navigation inside the seat: it finds
cards, filters them, answers questions, and offers the functions that belong to the moment. Most of
those functions are rare enough that they should not have a permanent home in a menu.

## What stands, measured today

- **The frame is one file** for the section: `rooms/design/frame/chat-frame.ts`, 755 lines. Each tab
  names its own five elements and inherits the rest.
- **The conversation is one file per seat**: `rooms/design/tools/conversation.ts` and
  `rooms/design/chat/conversation.ts` — the list, the thread, the ownership check, the move,
  selecting, removing and creating. The two do not import each other; each seat answers to its own
  package. The shared `session/` folder was deleted on your word.
- **Two seats have adopted them**: Tools (5,250 lines) and Chat (5,030). Each tab lists its own
  package; the console lists everything the person has.
- **The seat says where each thing lives**, at the top of both files.

## The steps

1. **UX keeps the application's conversation design.** The owner, 2026-11-03: the UX tab uses the
   application's conversation design, not ours; its conversations are still saved the same way. No
   `ux/conversation.ts` is ours to write. The owner's correction also stands for this plan's scope:
   the chat console is the tab being fixed; the UX is not.
2. **Executions and Settings take the frame and their own conversation files.** Proof: the same.
3. **The shared `chat-panel.ts` is retired** from each room that now has its own seat, one room at a
   time. Proof: each room draws what it drew before, and no surface reaches a seat it did not name.
4. **The fifteen pieces in `chat/parts/`** become each tab's own, or are named as the section's frame
   pieces and left shared on purpose. The second is the honest choice for the header, the messages and
   the input: they are the frame's drawing, not a tab's behaviour.
5. **A dead-code list**, kept as stubs for now: the view code for tabs no longer offered (Product's
   Trace, Tools and Evals; Development's Trace, Tools, States and Repairs), the room's old seat copies,
   and the two unused helpers found during the split.

## Recommendation

Adopt the frame and each seat's own conversation file in UX, Executions and Settings first — that is
where the duplication still lives, and it is mechanical. Then the dead-code list. Do not add features
to a seat while this is happening: the plan's rule is text moves, values do not.

Do not touch the gestures or the approval flow in this pass, on your word.

## Still open

- Whether the shared `chat-navigation-bar.ts` stays shared or every room gets its own rail. You said
  the R mark will grow into a place for real functionality; the rail itself can wait until the chat
  is fully a surface.
