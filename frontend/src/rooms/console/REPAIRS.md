# Console room — repairs found and left for a decision

*(Owner, 2026-10-23: "will come back to them." Both are recorded here with the evidence, so the
return does not have to rediscover them.)*

## 1. `command-received` is a protocol path with no sender

**What is there.** `a2ui-renderer.ts:558` forwards `command-received` from every component it
draws, and `WritingAreaIndex.tsx` maps it to `a2ui:console-command`
(`case 'command-received'`, where the comment reads "A rendered command IS a console command").
The catalog and the registry both name the event.

**What is missing.** Nothing in the application ever dispatches it. I searched every source file
for a dispatch of `command-received`; the only occurrences are the renderer's forward and the
shell's map. For the Console it is not needed at all: her seat dispatches `a2ui:console-command`
itself from `_processReply` when she writes `<reassemble-console …/>`.

**Why it is left.** Removing it touches the shared renderer's forward list, the shell's event
map, the catalog and the registry — a protocol surface used by every room. It is dead, but it is
not the Console's alone to remove.

## 2. The Console's classified failure never reaches the page

**What is there.** The room's `ConsolePage` draws a detailed failure panel when it is handed an
`errorReport`: what happened, why, a literal pointer, what to do now, and the raw diagnostics
verbatim. That panel exists because the shell built the classifier for it.

**What is missing.** `ConsoleRoomContainer.tsx:123` passes a constant:
`const errorReport: FailureReport | null = null;`. The room never asks the shell for its
classification, so the detailed panel can never draw. The banner still shows the message, so
nothing is hidden and the failure still stands with no dismiss — but the code, the pointer and
the fix that the rest of the application built do not reach this room.

**Why it is left.** Passing the report through is a change to the boundary between the shell and
the room (which facts the room may receive), and that boundary is the thing a sovereign room is
being moved away from. The honest fix may be for the room to classify its own failures rather
than to widen the shell's hand. That is a decision, not an edit.
