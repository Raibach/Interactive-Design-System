/**
 * <ProductRoom> — the room's pane, moved out of `pages/WritingAreaIndex.tsx` verbatim
 * (2026-10-21).
 *
 * The markup is unchanged: every comment in it is the room's own record of why it looks the way
 * it does. What changed is only WHERE it lives — the names it used to close over arrive as
 * props, and that list is the contract.
 */
import { useEffect, useState } from 'react';
import { builderToolUrl, isDemoMode } from '@/shared/appConfig';
import '@/rooms/product/product-chat-panel';
// THE ROOM'S OWN WORKSPACE — Product's exact copy of the shared two-column layout, registered
// under its own element name. The chat output is served from this room's box, not from the
// shared workspace file the other tabs use.
import '@/rooms/product/product-workspace';

export interface ProductRoomProps {
  builderEngineDown: boolean;
  productGripActive: boolean;
  productRoomProjectId: string | null;
  productStageKey: number;
  productLayoutRef: { current: any };
  productSeatRef: { current: any };
}

export function ProductRoom({
  builderEngineDown,
  productGripActive,
  productRoomProjectId,
  productStageKey,
  productLayoutRef,
  productSeatRef,
}: ProductRoomProps) {
  /*
   * NO GATE, NO OPACITY TRAP (owner, 2026-10-23). The room used to hide the builder behind a
   * full-room cover and draw the frame at opacity 0 until three signals landed. Removing the
   * cover alone would have left the frame invisible; removing the opacity alone would have left
   * the cover. Both are gone together: the builder is drawn at full opacity from its first
   * frame, the empty state speaks plainly while there is no project, and the red engine banner
   * is the only other state. What the person sees while the builder boots is the builder's own
   * loading screen, inside its own frame.
   */
  /* A SMALL SPINNER, NOT A COVER (owner, 2026-10-23): the builder canvas can be slower than
     the chat column, and the left pane must not be an unexplained blank. The ring sits in the
     middle of the left pane, transparent behind it and pointer-events none; the frame is
     visible and interactive underneath. It goes when the builder announces its own painted
     header, with the house ten-second dead stop as the bound. */
  const [canvasLoading, setCanvasLoading] = useState(true);
  useEffect(() => {
    if (builderEngineDown || !builderToolUrl()) {
      setCanvasLoading(false);
      return;
    }
    setCanvasLoading(true);
    const onReady = () => setCanvasLoading(false);
    window.addEventListener('builder-embed-ready', onReady);
    const deadStop = window.setTimeout(() => setCanvasLoading(false), 10_000);
    return () => {
      window.removeEventListener('builder-embed-ready', onReady);
      window.clearTimeout(deadStop);
    };
  }, [productRoomProjectId, productStageKey, builderEngineDown]);

  /* THE ROOM TELLS THE SHELL WHEN ITS SCREEN IS BUILT: the builder's own header has painted.
     The shell's copy of this room's ring leaves on this message. */
  useEffect(() => {
    if (canvasLoading) return;
    window.dispatchEvent(new CustomEvent('room-ready', { detail: { room: 'product' } }));
  }, [canvasLoading]);

  return (
    <>
      {/* THE GRIP'S SAFETY NET — up only while the chat strip has a live
          gesture (the layout's own resize-start/resize-end). Transparent
          and fixed over the whole window, so the hand's moves keep
          reaching THIS document even while the pointer is over the
          builder frame beside the strip (see `productGripActive`).
          The builder app's own resize already draws the same thing. */}
      {productGripActive && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize' }}
        />
      )}
      {/* THE ROOM'S OWN LAYOUT BOX — a flex column handing the layout the same box the
          sandbox's viewport gave it, clipping it as that viewport did. It carries no cover,
          no mask and no loading layer: the tab switch reads `data-room-root`, and the
          builder draws inside it at full visibility. */}
      <div key="product-root" data-room-root="product" style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
      {/* THE ROOM'S OWN WORKSPACE (owner, 2026-10-23): Product's own copy of the shared
          two-column layout, with its own element name. The canvas fills the left pane and
          the chat seat stands in the right pane; the layout's gripper and rail rules open,
          close and resize the column exactly as they always did, and no other tab's file
          serves this room's chat output. */}
      <product-workspace key="product-room" ref={productLayoutRef} className="flex-1 min-h-0">
        <div slot="left" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      {/* NO DASHBOARD, EVER (owner, 2026-10-04): the frame exists only
          once a project does. While one is being born — or while the
          engine is down — the pane is quiet; it is never pointed at the
          tool's project list. The key carries the project id so a new
          project remounts the frame clean rather than reusing one.
          THE ADDRESS IS RUNTIME CONFIG NOW (2026-10-04, HOST-THE-TOOLS):
          `builderToolUrl()` — the hosted builder service on the demo, the
          Mac's own :3223 locally. The states the old fallback panel drew
          (no address at all, the demo's engine unreadable) draw NOTHING
          now — see the note under this block; a stopped local engine
          keeps the red banner below. */}
      {/* THE FALLBACK PANEL IS GONE (owner, 2026-10-06: *"I want all of
          the fallbacks all the dumb shit out … I would rather it just
          be a blank page than have a fallback."*). Every state it drew —
          no address configured, the demo's engine unreadable, a frame
          that never arrived — draws NOTHING now: the pane keeps its own
          ground. A stopped LOCAL engine still gets its red banner below,
          which names the real process and the command that starts it. */}
      {!builderToolUrl() || (isDemoMode() && builderEngineDown) ? null : productRoomProjectId ? (
        /* THE BUILDER DRAWS ITSELF — at full opacity from its first frame. No cover stands over
           it and no flag holds it invisible; the builder's own loading screen is the honest
           wait while it boots. */
        <builder-embed
          key={`product-builder-${productRoomProjectId}-${productStageKey}`}
          src={`${builderToolUrl()}/project/${encodeURIComponent(productRoomProjectId)}`}
          ready-selector="[data-workspace-header]"
          hide-until-load
          style={{
            display: 'block', width: '100%', height: '100%',
          }}
        />
      ) : (
        /* NOTHING IS DRAWN AHEAD OF THE APPLICATION (owner, 2026-10-23). While the project is
           being born, the pane is the room's own ground and nothing else: no sentence, no ring,
           no cover. The builder's own frame is the next thing to appear. */
        null
      )}
      {/* THE LEFT PANE'S SMALL WAIT — a ring, not a sheet. It sits over the room's ground and
          the frame, transparent and non-blocking, and leaves when the builder paints. */}
      {canvasLoading && (
        <div
          aria-hidden="true"
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 1 }}
        >
          <div
            className="animate-spin"
            style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(240, 179, 35, 0.25)', borderTopColor: 'rgb(240, 179, 35)' }}
          />
        </div>
      )}
      {/* A STOPPED ENGINE GETS SAID PLAINLY — else the tool's own errors read
          like broken features. NEVER ON THE DEMO (2026-10-04): its copy names
          the repo's own start script, which is developer text, and on the
          deployed site it reads to a visitor as "this program cannot run". */}
      {builderEngineDown && !isDemoMode() && (
        <div
          role="status"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 2,
            padding: '8px 12px', background: '#7f1d1d', color: '#ffffff',
            fontFamily: "'IBM Plex Mono', 'IBM Plex Mono', Menlo, monospace", fontSize: 12,
          }}
        >
          {"The builder's engine isn't running. Start it with: npm run dev:local  (in product/ai-app-builder-open)"}
        </div>
      )}
        </div>
        {/* THE PLATFORM'S CHAT SEAT — the room's chat, in the layout's right pane. The seat
            draws NOTHING until its binding lands; never an empty chat, never another room's
            face. */}
        <product-chat-panel key="product-seat" slot="right" ref={productSeatRef}></product-chat-panel>
      </product-workspace>
      </div>
    </>
  );
}
