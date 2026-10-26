/**
 * <DevelopmentBox> — THE DEVELOPMENT TAB'S OWN CONTENT AREA.
 *
 * The room used to draw inside the shell's sandbox, with the sandbox's workspace slot painting
 * the lab tile. The box owns the ground now: the same paper tile, repeated at natural size over
 * the room's dark floor, exactly the values the shell painted. The room root carried by
 * <DevelopmentRoom> stays inside it.
 *
 * THE TOOL IS NOT TOUCHED. The OpenHands application keeps its house patch, its chrome, its
 * panel colour and its transparent ground; the lab tile shows through it. The tile belongs to
 * the box rather than a column because the chat column's strip has to show the same ground,
 * and a ground painted on the panel would travel with the panel while the rail is closed.
 */
import developmentLabBackground from '@/assets/canvas-development-lab-bkg.webp';

import { Suspense, lazy } from 'react';

const DevelopmentRoomContainer = lazy(() =>
  import('@/rooms/development/DevelopmentRoomContainer').then((m) => ({ default: m.DevelopmentRoomContainer })),
);

export function DevelopmentBox() {
  return (
    <div
      data-room-box="development"
      style={{
        position: 'absolute',
        inset: 0,
        /* THE LEFT NAV IS OURS AND STAYS ABOVE THE ROOM (it is z-index 50 in the shell).
           The room sits beneath it; the nav's strip and toggle remain reachable. */
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#2b2635',
        /* THE ROOM'S OWN GROUND — the lab tile the sandbox painted, now the room's. A
           graph-paper tile is drawn to REPEAT at natural size, from the top left. */
        backgroundImage: `url(${developmentLabBackground})`,
        backgroundSize: 'auto',
        backgroundRepeat: 'repeat',
        backgroundPosition: 'top left',
      }}
    >
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 0%',
          minHeight: 0,
        }}
      >
        <Suspense>
          <DevelopmentRoomContainer />
        </Suspense>
      </div>
    </div>
  );
}
