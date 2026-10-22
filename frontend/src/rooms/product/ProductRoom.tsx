/**
 * <ProductRoom> — the room's pane, moved out of `pages/WritingAreaIndex.tsx` verbatim
 * (2026-10-21).
 *
 * The markup is unchanged: every comment in it is the room's own record of why it looks the way
 * it does. What changed is only WHERE it lives — the names it used to close over arrive as
 * props, and that list is the contract.
 */
import { builderToolUrl, isDemoMode } from '@/shared/appConfig';
import productAssemblyBackground from '@/assets/product-assembly-bg.webp';

export interface ProductRoomProps {
  builderEngineDown: boolean;
  productGripActive: boolean;
  productToolDown: boolean;
  productRoomProjectId: string | null;
  productStageKey: number;
  productGateDown: boolean;
  leavePrompt: {
    projectId: string;
    settle: (choice: 'publish' | 'discard' | 'keep' | 'stay') => void;
  } | null;
  productLayoutRef: { current: any };
  productSeatRef: { current: any };
}

export function ProductRoom({
  builderEngineDown,
  productGripActive,
  productToolDown,
  productRoomProjectId,
  productStageKey,
  productGateDown,
  leavePrompt,
  productLayoutRef,
  productSeatRef,
}: ProductRoomProps) {
  /*
   * ONE ROOM, ONE WAIT — AND IN ORDER (owner, 2026-10-21: *"it's loading something before the
   * assembly … it should be an order"*). MEASURED: while the gate was standing, this empty state
   * also drew its own amber ring, because the earlier guard leaned on the builder's ADDRESS being
   * known — and in the first frames of a fresh load it is not, so the ring slipped through and two
   * identical rings stood side by side.
   * The rule is now the room's own state, not a fetched fact: while `productGateDown` is false the
   * gate owns the screen and this empty state says NOTHING — no ring, no sentence. When the gate
   * lifts, the empty state speaks only if there is still no project to show. One wait, then the
   * next one — never two at once.
   */
  const gateStands = !productGateDown;

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
      {/* THE ROOM'S OWN RELATIVE GROUND — THE COVER'S FRAME (2026-10-06): the
          staged gate spans the WHOLE room now (both columns — see the gate
          states above), so it cannot live inside the left column's box.
          The wrapper is layout-neutral: a flex column handing the layout
          the same box the sandbox's viewport gave it, and clipping it as
          that viewport did. */}
      <div key="product-root" data-room-root="product" style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
      <workspace-layout key="product-room" ref={productLayoutRef} className="flex-1 min-h-0">
        {/* NO SECOND GROUND IN THIS ROOM (owner, 2026-10-14): this seat
            used to wear the lab tile over #2b2635 — the grid that sat
            between the room and everything drawn in it, and made the
            stage look like the Development section (*"This is the
            background that is interfering … the background is already
            there. It's underneath this grid"*). Made see-through: the
            room's own composer ground (the room-level div above) is
            the system's ONE background and now reads straight
            through the frame, the builder's page and the stage.
            Development keeps its own tile — its seat is untouched. */}
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
      {!builderToolUrl() || (isDemoMode() && builderEngineDown) || productToolDown ? null : productRoomProjectId ? (
        /* THE BUILDER'S OWN WORDS (2026-10-21, the owner's "two spinners" report). The gate used
           to lift on the frame's load event alone — but that fires when the builder's HTML
           arrives, and the builder paints "Loading…" for several seconds AFTER that. So the gate
           lifted and exposed a second loading screen behind it. `ready-selector` makes
           <builder-embed> poll its own document and announce `builder-embed-ready` once this
           marker exists; `[data-workspace-header]` is present twice on the painted builder page
           (measured in-room) and absent from its loading state. */
        <builder-embed
          key={`product-builder-${productRoomProjectId}-${productStageKey}`}
          src={`${builderToolUrl()}/project/${encodeURIComponent(productRoomProjectId)}`}
          ready-selector="[data-workspace-header]"
          style={{
            display: 'block', width: '100%', height: '100%',
            opacity: productGateDown ? 1 : 0,
            transition: 'opacity 700ms ease',
          }}
        />
      ) : (
        /* NO SECOND GROUND HERE EITHER (owner, 2026-10-14): this empty
           state used to wear Development's lab tile — the grid sitting
           between the person and the room while a project was born. The
           room's own composer ground reads straight through it now — the
           same one background as the seat beside it. */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, width: '100%', height: '100%', color: '#c9c9c9', fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
          {/* THE SAME GATE'S RING (2026-10-04): the Product room's own
              opening state is an assembly gate too — it gets the amber
              indicator, not a bare line of text. STANDING DOWN WHILE
              THE GATE STANDS (2026-10-21, measured: two rings 52px
              apart) — one room, one wait. */}
          {!builderEngineDown && !gateStands && (
            <div aria-hidden="true" className="animate-spin" style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(240, 179, 35, 0.25)', borderTopColor: 'rgb(240, 179, 35)' }} />
          )}
          {builderEngineDown || gateStands ? '' : "Opening the project\u2026"}
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
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12,
          }}
        >
          {"The builder's engine isn't running. Start it with: npm run dev:local  (in product/ai-app-builder-open)"}
        </div>
      )}
        </div>
        {/* THE PLATFORM'S CHAT SEAT — the same <chat-panel> the console
            and composer mount, in the container's right pane. CLOSED on
            entry: the product room's own effect sets the column open
            as a PROPERTY (never the attribute — Lit's boolean converter
            reads the string "false" as true), so the gripper strip and
            the rail are what show, and the panel's binding arrives from
            the engine's carrier (the seat effect below). Until that
            binding lands the seat draws NOTHING AT ALL — `productRoom`,
            set where the column opens: never an empty chat, never
            another room's face (owner, 2026-10-06: *"I would rather it
            just be a blank page than have a fallback."*). */}
        <chat-panel key="product-seat" slot="right" ref={productSeatRef}></chat-panel>
      </workspace-layout>
      {builderToolUrl() && !productToolDown && !builderEngineDown && (
      /* THE SAME STAGED GATE AS DEVELOPMENT (2026-10-05) — now over the
         WHOLE room (2026-10-06): the chat column here sat frozen at its
         104px rail floor until an unrelated re-render unfroze it, and
         beside a left-only gate that unfreeze WAS the pop. The cover
         spans both columns and drops only when the minimum, the
         frame's load, and the seat have all landed (see the clocks
         above): one 700ms cross-fade, and neither the builder's white
         first paint nor the chat's late face ever shows alone.
         NEVER WHILE THE ENGINE IS DOWN (owner, 2026-10-06): nothing is
         standing up, and a spinner claiming otherwise is the same lie
         the seat's old face told — the banner below says the real state.
         AND THE COVER WEARS THE ROOM'S OWN GROUND (owner, 2026-10-14):
         it used to wear Development's lab tile, so every opening began
         on a grid and then faded into the composer ground — two
         backgrounds in one breath (*"we've already got two backgrounds
         … assembly loads one background we should just load the same
         background"*). It now paints the composer image's re-labeled
         copy, stretched exactly like the room-level div above, so the
         fade reveals the SAME picture with no seam. */
      <div
        aria-hidden={productGateDown}
        style={{
          position: 'absolute', inset: 0, zIndex: 3,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
          backgroundImage: `url(${productAssemblyBackground})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat',
          opacity: productGateDown ? 0 : 1,
          transition: 'opacity 700ms ease',
          pointerEvents: productGateDown ? 'none' : 'auto',
        }}
      >
        <div aria-hidden="true" className="animate-spin" style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(240, 179, 35, 0.25)', borderTopColor: 'rgb(240, 179, 35)' }} />
        <p style={{ color: '#c9c9c9', fontSize: 13, fontWeight: 500, fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>
          {"Standing up the builder\u2026"}
        </p>
      </div>
      )}
      </div>
      {/* THE EXIT GUARD'S QUESTION (owner, 2026-10-04; its save-as-draft
          door, 2026-10-06: *"You must save this before we can continue
          or offer them a saved draft option."*). ONE LEVEL UP since the
          column arrived (2026-10-05): it must cover the WHOLE room, and
          a fixed overlay inside a transformed pane would be positioned
          against that pane, not the window. Save as a draft, publish
          the idea to the console, discard it for good, or keep
          working. Explicit buttons and no ambiguous "Cancel" —
          discarding is destructive and must be chosen on purpose. */}
      {leavePrompt && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(17, 24, 39, 0.45)' }}
          role="dialog"
          aria-modal="true"
          aria-label="Publish this idea"
        >
          <div style={{ width: 430, maxWidth: 'calc(100vw - 40px)', background: '#ffffff', borderRadius: 14, padding: '20px 22px', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.35)', fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 700, color: '#111827' }}>What should happen to this idea?</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13.5, lineHeight: 1.55, color: '#4B5563' }}>
              {"This idea isn't in the console yet — it's held in the room. Saving it as a draft keeps it as your private package; publishing makes it a card the team can see; discarding removes it for good."}
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => leavePrompt.settle('stay')}
                style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #E5E7EB', background: '#ffffff', color: '#374151', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
                Keep working
              </button>
              <button type="button" onClick={() => leavePrompt.settle('keep')}
                style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #111827', background: '#ffffff', color: '#111827', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Save as draft
              </button>
              <button type="button" onClick={() => leavePrompt.settle('discard')}
                style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Discard idea
              </button>
              <button type="button" onClick={() => leavePrompt.settle('publish')}
                style={{ padding: '7px 12px', borderRadius: 9, border: '1px solid #111827', background: '#111827', color: '#ffffff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Publish to console
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
