/**
 * <ProductBox> — THE PRODUCT TAB'S OWN CONTENT AREA.
 *
 * The room used to be rendered inside the shell's shared sandbox.
 * That put a shared layer in Product's path: the sandbox chose its slot, carried its spinner
 * flag, and could stand the Console's loading state over the room during a switch.
 *
 * The box is the template for the other tabs: a content-area stage that belongs to the room,
 * mounts only while the room is selected, and paints no ground of its own.
 *
 * THE SHELL PAINTS NO ROOM'S GROUND (owner, 2026-10-23). The cream fill that used to stand on
 * `WritingAreaIndex.tsx`'s main container was a global surface every room borrowed. It is gone.
 * This box is transparent, so what stands behind it is the application's theme background until
 * the builder frame and the chat draw their own surfaces. No Product-specific fill, and no
 * borrowed cream.
 */
import { Suspense, lazy } from 'react';
import type { ProductRoomContainerProps } from '@/rooms/product/ProductRoomContainer';
import composerBackground from '@/assets/composer-image-bg.webp';

const ProductRoomContainer = lazy(() =>
  import('@/rooms/product/ProductRoomContainer').then((m) => ({ default: m.ProductRoomContainer })),
);

export function ProductBox(props: ProductRoomContainerProps) {
    return (
      <div
        data-room-box="product"
        style={{
          position: 'absolute',
          inset: 0,
          /* THE LEFT NAV IS OURS AND STAYS ABOVE THE ROOM (root z 50, panel 55, logo 60).
             The room sits beneath it, as Development and Governance do, so the R logo and the
             navigation it opens are never covered by the room's ground. */
          zIndex: 40,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        {/* THE ROOM'S OWN GROUND (restored 2026-10-23): the composer illustration, stretched
            over the chrome colour the same way the room wore it before. The box paints its own
            ground; the builder frame and the chat draw their own faces over it. */}
        <img
          aria-hidden="true"
          alt=""
          src={composerBackground}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'fill',
            backgroundColor: '#2b2635',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0 }}>
          <Suspense>
            <ProductRoomContainer {...props} />
          </Suspense>
        </div>
      </div>
    );
}
