/**
 * <DesignRoomContainer> — THE DESIGN ROOM'S BOUNDARY.
 *
 * The room's values already live in its own files: the console read and the chat in
 * `DesignSeatShell`, the Figma engine in `tools/`, the UX view in `ux/`. This container is the
 * seam the box mounts, and the lazy boundary that keeps the room's first paint: the room's
 * drawing arrives as its own chunk, exactly as it did when the shell owned this import.
 *
 * It takes no props from the shell. The old `onAssemblingChange` handoff was declared but never
 * called, so it is not carried forward.
 */
import { Suspense, lazy } from 'react';

const DesignRoom = lazy(() => import('@/rooms/design/DesignRoom'));

export function DesignRoomContainer() {
  return (
    <Suspense>
      <DesignRoom />
    </Suspense>
  );
}
