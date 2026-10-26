/**
 * <DesignBox> — THE DESIGN TAB'S OWN CONTENT AREA.
 *
 * The room used to be a branch of the shell's sandbox, with its ground painted by the sandbox's
 * workspace slot. The box owns both now: the light design sheet over the room's plum, the room
 * root the tab gate hides in the click's own frame, and the lazy room inside it.
 *
 * The ground is the existing `design-section2-bkg.webp` at the same 100% × 100% stretch the
 * sandbox used. It sits behind everything, so the chat column and the console's cards draw over
 * it. The room's own cover paints the same sheet again while the design console lands.
 */
import designSectionBackground from '@/assets/design-section2-bkg.webp';

import { DesignRoomContainer } from '@/rooms/design/DesignRoomContainer';

export function DesignBox() {
  return (
    <div
      data-room-box="design"
      style={{
        position: 'absolute',
        inset: 0,
        /* THE LEFT NAV IS OURS AND STAYS ABOVE THE ROOM (root z 50, panel 55, logo 60).
           The room sits beneath it, as Development and Governance do. */
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: '#582846',
      }}
    >
      {/* THE ROOM'S OWN GROUND — the sheet the sandbox painted, now the room's. */}
      <img
        aria-hidden="true"
        alt=""
        src={designSectionBackground}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          backgroundColor: '#582846',
        }}
      />
      {/* THE ROOM ROOT. The marker names the room's root; the key keeps React from recycling the
          node as the next room's root. */}
      <div
        key="design-root"
        data-room-root="design"
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          flex: '1 1 0%',
          minHeight: 0,
        }}
      >
        <DesignRoomContainer />
      </div>
    </div>
  );
}
