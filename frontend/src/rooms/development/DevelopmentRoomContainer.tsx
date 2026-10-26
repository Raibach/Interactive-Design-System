/**
 * <DevelopmentRoomContainer> — THE DEVELOPMENT ROOM OWNS ITS OWN STATE.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` (2026-10-24), the Product and Governance rooms'
 * architecture applied to this one. The container owns the layout ref and the seat ref; the
 * behaviour lives in `useDevelopmentRoom`, and the pane lives in `DevelopmentRoom`.
 *
 * THE ROOM IS MOUNTED ONLY WHILE DEVELOPMENT IS SELECTED, so the hook carries no tab guard:
 * its work begins on mount and never runs for another room.
 */
import { useEffect, useRef, useState } from 'react';

import type { ChatPanel } from '@/components/lit/chat-panel';
import type { WorkspaceLayout } from '@/components/lit/workspace-layout';
import { developmentToolUrl } from '@/shared/appConfig';
import { DevelopmentRoom } from '@/rooms/development/DevelopmentRoom';
import { useDevelopmentRoom } from '@/rooms/development/useDevelopmentRoom';

export function DevelopmentRoomContainer() {
  const developmentLayoutRef = useRef<WorkspaceLayout | null>(null);
  const developmentSeatRef = useRef<ChatPanel | null>(null);

  useDevelopmentRoom({ developmentLayoutRef, developmentSeatRef });

  /* THE ROOM'S OWN ARRIVAL (owner, 2026-10-25): the application has loaded when the embedded
     workspace has painted its first heading — the same announcement the Product room waits
     for — with the house ten-second bound as the truth if it never appears. With no address
     there is no application to wait for, and the room's own ground is the answer. Mounting
     the room is neither of those, so the ready message no longer rides on it. */
  const [toolReady, setToolReady] = useState(false);
  useEffect(() => {
    if (!developmentToolUrl()) {
      setToolReady(true);
      return;
    }
    const onReady = () => setToolReady(true);
    window.addEventListener('builder-embed-ready', onReady);
    const deadStop = window.setTimeout(onReady, 10_000);
    return () => {
      window.removeEventListener('builder-embed-ready', onReady);
      window.clearTimeout(deadStop);
    };
  }, []);

  /* THE ROOM TELLS THE SHELL WHEN ITS APPLICATION IS BUILT, NOT WHEN THE ROOM MOUNTED. */
  useEffect(() => {
    if (!toolReady) return;
    window.dispatchEvent(new CustomEvent('room-ready', { detail: { room: 'development' } }));
  }, [toolReady]);

  return (
    /* THE DEVELOPMENT'S FADE-IN (owner, 2026-10-25): the application fades in over 600ms
       once the workspace has painted. The box's lab tile never fades — only the application
       does — so the person goes from the tile and the shell's ring into the workspace. */
    <div
      data-room-fade="development"
      style={{
        flex: '1 1 0%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        opacity: toolReady ? 1 : 0,
        transition: 'opacity 600ms ease',
        pointerEvents: toolReady ? undefined : 'none',
      }}
    >
      <DevelopmentRoom
        developmentLayoutRef={developmentLayoutRef}
        developmentSeatRef={developmentSeatRef}
      />
    </div>
  );
}
