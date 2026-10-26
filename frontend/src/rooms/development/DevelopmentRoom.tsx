/**
 * <DevelopmentRoom> — the room's pane, moved out of `pages/WritingAreaIndex.tsx`
 * (2026-10-21), the Product room's architecture applied to this one.
 *
 * The markup is unchanged: every comment in it is the room's own record of why it looks
 * the way it does. What changed is only WHERE it lives — the names it used to close over
 * arrive as props, and that list is the contract.
 *
 * THE ROOM IS THE CONSOLE'S CONTAINER + THE WORKSPACE (owner, 2026-10-06: *"show the
 * modified open hands application that we just made sovereign"*). The shape is the owner's
 * 2026-10-05 one: the room wears the console's container — `workspace-layout` — with the
 * room's own workspace as its left column and the platform chat seat as its right column,
 * CLOSED on entry. The seat is the one element the console and composer use; no surface is
 * assembled for this room and no new conversation is created.
 *
 * THE WORKSPACE IS THE REPO-RUN COPY (development/OpenHands-main, :8090 — started by
 * RESTART-LOCAL.sh), telemetry cut so nothing reaches any other server
 * (development/CHANGELOG.md, 2026-10-06). The workspace opens STRAIGHT IN — no staged
 * opening covers it (the assembly and its ceiling are removed: a ready room sat hidden
 * behind a spinner); a stopped workspace draws NOTHING — no fallback, ever.
 */
import { developmentToolUrl } from '@/shared/appConfig';
import '@/rooms/development/development-workspace';
// THE ROOM'S OWN SEAT — its own file, its own tag (2026-10-24). The shared `<chat-panel>` stays
// with the Composer; this room mounts its own copy.
import '@/rooms/development/development-chat-panel';

export interface DevelopmentRoomProps {
  /** The room's own container element — the seat-closed write and the nav's target. */
  developmentLayoutRef: { current: any };
  /** The platform chat seat — bound by `useDevelopmentRoom`, never by another room. */
  developmentSeatRef: { current: any };
}

export function DevelopmentRoom({ developmentLayoutRef, developmentSeatRef }: DevelopmentRoomProps) {
  return (
    <>
      {/* KEY: A ROOM IS ITS OWN INSTANCE (2026-10-06 — owner: "It seems to be
          borrowing a chat from product … un-bind those."). Without these keys,
          React reconciles Product's and Development's frames as ONE subtree: the
          same seat node carries Product's conversation into Development, and
          the layout keeps the previous room's pane state. The keys force each
          room to mount its own instance. */}
      {/* THE ROOM'S OWN RELATIVE GROUND: a layout-neutral wrapper — a flex
          column handing the layout the same box the sandbox's viewport gave
          it, and clipping it as that viewport did. */}
      <div key="development-root" data-room-root="development" style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
      <development-workspace key="development-room" ref={developmentLayoutRef} className="flex-1 min-h-0">
        {/* THE ROOM'S WORKSPACE — opens straight in; no staged opening
            covers it (the gate, its clocks and its ceiling are removed);
            a stopped workspace draws NOTHING — no fallback. */}
        {/* THE GROUND IS THE BOX'S (2026-10-24): <DevelopmentBox> paints the lab tile
            behind both columns. The left slot paints nothing of its own; the embedded
            application's transparent ground lets the box's tile show through. */}
        <div slot="left" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      {/* THE ARRIVAL'S READY SIGNAL (2026-10-16): the room-switch cover
          holds over this room until the canvas has actually painted —
          `ready-selector` makes <builder-embed> announce
          `builder-embed-ready` once its document first contains an h1
          (measured: the canvas's first h1 is its home heading, up at
          ~357ms local, absent while it boots). If it never appears,
          the cover's ten-second bound is the truth. */}
      {developmentToolUrl() && (
      <builder-embed
        key="dev-workspace"
        src={developmentToolUrl()}
        ready-selector="h1"
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      )}
      {/* THE FALLBACK PANEL IS GONE (owner, 2026-10-06, late: *"there's
          not supposed to be any fallbacks in this application. You should
          remove the fallbacks … there is no fallback ever."*). It drew
          "The development workspace isn't reachable right now. / It runs
          from this repository — start it with RESTART-LOCAL.sh." — an
          excuse worn where the workspace goes. No address, or a frame
          that never arrived: the pane keeps its own ground and draws
          NOTHING, exactly as the Product room does. */}
        </div>
        {/* THE PLATFORM'S CHAT SEAT — the same <chat-panel> the console and
            composer mount, in the container's right pane. CLOSED on entry:
            the container effect sets `isThirdOpen = false` as a
            PROPERTY (never the attribute — Lit's boolean converter reads
            the string "false" as true), so the gripper strip and the rail
            are what show, and the panel's settings arrive from the room's
            own package (`useDevelopmentRoom`). Until then nothing is bound
            — an empty seat, never another room's. Its rail is the room's
            own list: every drawable tab except Versions
            (DEVELOPMENT_SEAT_TABS). */}
        <development-chat-panel key="development-seat" slot="right" ref={developmentSeatRef}></development-chat-panel>
      </development-workspace>
      </div>
    </>
  );
}
