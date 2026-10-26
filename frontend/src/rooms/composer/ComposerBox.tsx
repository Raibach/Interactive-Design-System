/**
 * <ComposerBox> — THE COMPOSER TAB'S OWN CONTENT AREA.
 *
 * The room used to draw inside the shell's sandbox, with the sandbox's workspace slot painting
 * the ground and the sandbox's fixed slot routing choosing between the spinner and the surface.
 * The box owns both now: the composer image over the room's plum, the surface host and its
 * spinner, and the renderer the model's tree is written into.
 *
 * THE LEFT NAV IS OURS AND STAYS ABOVE THE ROOM (root z 50, panel 55, logo 60). The box sits at
 * 40, as the other rooms do, so the R logo and the navigation it opens are never covered.
 */
import composerBackground from '@/assets/composer-image-bg.webp';

import { Suspense, lazy } from 'react';
import type { ComposerRoomProps } from '@/rooms/composer/ComposerRoom';

const ComposerRoom = lazy(() =>
  import('@/rooms/composer/ComposerRoom').then((m) => ({ default: m.ComposerRoom })),
);

/* THE ROOM'S FILE IS FETCHED WITH THE PAGE, NOT WHEN THE TAB IS PRESSED. The white ring this
   replaces was the lazy file's own loader, not the assembly; starting the fetch here means the
   first press opens the room directly. */
void import('@/rooms/composer/ComposerRoom').catch(() => {});


export function ComposerBox(props: ComposerRoomProps) {
  return (
    <div
      data-room-box="composer"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#582846',
        /* THE ROOM'S OWN GROUND — the composer image the sandbox painted, stretched over the
           room's plum exactly as it was. */
        backgroundImage: `url(${composerBackground})`,
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'top left',
      }}
    >
      <div
        key="composer-root"
        data-room-root="composer"
        style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0 }}
      >
        <Suspense>
          <ComposerRoom {...props} />
        </Suspense>
      </div>
    </div>
  );
}
