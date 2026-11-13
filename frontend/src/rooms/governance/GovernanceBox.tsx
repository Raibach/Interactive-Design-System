/**
 * <GovernanceBox> — THE GOVERNANCE TAB'S OWN CONTENT AREA.
 *
 * The room used to draw inside the shell's sandbox, with the sandbox's workspace slot painting
 * the wave. The box owns the ground now: the wave at cover/centre over the room's floor, the
 * same drawing the shell used, and the room root carried by <GovernanceRoom> stays inside it.
 */
import dataWave4Background from '@/assets/data-wave4-flipped.webp';

/* THE GROUND IS DECODED AT BOOT, not on the press (owner, 2026-11-12). On a cold load the
   browser downloads the ground only when this box mounts, so the room's flat base colour stood
   alone while the image came down. Decoding it at boot means a press paints the finished ground
   in the click's own frame. */
const _groundPreload = new Image();
_groundPreload.src = dataWave4Background;
if (_groundPreload.decode) _groundPreload.decode().catch(() => {});

import { Suspense, lazy } from 'react';
import type { GovernanceRoomContainerProps } from '@/rooms/governance/GovernanceRoomContainer';

const GovernanceRoomContainer = lazy(() =>
  import('@/rooms/governance/GovernanceRoomContainer').then((m) => ({ default: m.GovernanceRoomContainer })),
);

export function GovernanceBox(props: GovernanceRoomContainerProps) {
  return (
    <div
      data-room-box="governance"
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
      }}
    >
      {/* THE ROOM'S OWN GROUND — the wave the sandbox painted, now the room's. */}
      <img
        aria-hidden="true"
        alt=""
        src={dataWave4Background}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center center',
        }}
      />
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
          <GovernanceRoomContainer {...props} />
        </Suspense>
      </div>
    </div>
  );
}
