/**
 * <DesignBox> — THE DESIGN TAB'S OWN CONTENT AREA.
 *
 * The room used to be a branch of the shell's sandbox, with its ground painted by the sandbox's
 * workspace slot. The box owns both now: the light design sheet over the application's own
 * ground, the room root the tab gate hides in the click's own frame, and the lazy room inside it.
 *
 * The ground is the existing `design-section2-bkg.webp` at the same 100% × 100% stretch the
 * sandbox used. It sits behind everything, so the chat column and the console's cards draw over
 * it. The room's own cover paints the same sheet again while the design console lands.
 */
import designSectionBackground from '@/assets/design-section2-bkg.webp';

/* THE GROUND IS DECODED AT BOOT, not on the press (owner, 2026-11-12). On a cold load the
   browser downloads the ground only when this box mounts, so the room's flat base colour stood
   alone while the image came down. Decoding it at boot means a press paints the finished ground
   in the click's own frame. */
const _groundPreload = new Image();
_groundPreload.src = designSectionBackground;
if (_groundPreload.decode) _groundPreload.decode().catch(() => {});

/* THE SHEET'S OWN BASE, MEASURED FROM THE ASSET (owner, 2026-11-14). The drawing's flat margins
   are #EFF1E1 — the dominant fill of `design-section2-bkg.webp`. The box paints it under the
   sheet, and the room's cover paints it under the same sheet, so the shell's boot ground (the
   composer's purple waves) never stands in the design room's place while the sheet is decoded. */
export const DESIGN_SHEET_BASE = '#EFF1E1';

import { DesignRoomContainer } from '@design2/surface-design/DesignRoomContainer';

export function DesignBox() {
  return (
    <div
      data-room-box="design"
      style={{
        position: 'absolute',
        inset: 0,
        /* THE ROOM'S BASE IS THE SHEET'S OWN. Painted here, the room is opaque from its first
           commit: the shell's boot ground behind it can never show through while the sheet is
           still being decoded. */
        backgroundColor: DESIGN_SHEET_BASE,
        /* THE LEFT NAV IS OURS AND STAYS ABOVE THE ROOM (root z 50, panel 55, logo 60).
           The room sits beneath it, as Development and Governance do. */
        zIndex: 40,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
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
