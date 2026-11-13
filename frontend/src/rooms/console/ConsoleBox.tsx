/**
 * <ConsoleBox> — THE CONSOLE TAB'S OWN CONTENT AREA.
 *
 * The box owns the console's own ground — the dark plum and the waves video that the shared
 * sandbox used to paint — and mounts the room inside it. The shell mounts this box only
 * while the Console tab is selected, exactly as it mounts the Product box.
 */
import { Suspense, lazy } from 'react';
import type { ConsoleRoomContainerProps } from '@/rooms/console/ConsoleRoomContainer';
import consoleVideo from '@/assets/No-Copyright-waves.mp4';

const ConsoleRoomContainer = lazy(() =>
  import('@/rooms/console/ConsoleRoomContainer').then((m) => ({ default: m.ConsoleRoomContainer })),
);

export function ConsoleBox(props: ConsoleRoomContainerProps) {
  return (
    <div
      data-room-box="console"
      style={{
        position: 'absolute',
        inset: 0,
        /* THE LEFT NAV IS OURS AND STAYS ABOVE THE ROOM (it is z-index 50 in the shell; its logo
           is 60). The room sits beneath it, as Development and Governance do, so the R logo and
           the navigation it opens are never covered by the room's ground. */
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#270F31',
      }}
    >
      {/* THE CONSOLE'S OWN GROUND — the same waves the sandbox painted, now the room's. */}
      <video
        aria-hidden="true"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        src={consoleVideo}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          opacity: 0.75,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* THE ROOM ROOT. The marker names the room's root; the key keeps React from recycling the
          node as the next room's root (measured 2026-10-11 on the other rooms). */}
      <div
        key="console-root"
        data-room-root="console"
        style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0 }}
      >
        <Suspense>
          <ConsoleRoomContainer {...props} />
        </Suspense>
      </div>
    </div>
  );
}
