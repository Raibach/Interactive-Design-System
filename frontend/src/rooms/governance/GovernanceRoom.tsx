/**
 * <GovernanceRoom> — the room's pane, moved out of `pages/WritingAreaIndex.tsx`
 * (2026-10-21), the Product room's architecture applied to this one.
 *
 * The markup is unchanged: every comment in it is the room's own record of why it looks
 * the way it does. What changed is only WHERE it lives — the names it used to close over
 * arrive as props, and that list is the contract.
 *
 * THE ROOM IS THE SHELL — THE APPLICATION LEFT (owner, 2026-10-08: *"remove the evidently
 * AI application from the governance section — everything … keep the container, the
 * backgrounds, the chat, the sliding effect … keep the left navigation … don't rip out the
 * architecture … take out the application and anything related to the application
 * itself."*). The Development room's structure holds, third instance: the room's own left
 * navigation and the platform's chat seat (its own package, its own conversations).
 *
 * RESTORED 2026-10-18 — the owner's order was to remove the WORD, not the application:
 * *"if you think tearing out the dashboard was what I meant when I said remove the words
 * that said langfuse you got me wrong … restore the goddamn application now."*
 *
 * OUR STAGED OPENING IS GONE (owner, 2026-10-22: *"there's no reason to have an assembly
 * that we present and then load the applications assembly. We only need the applications
 * assembly so take our assembly process off of governance"*). Deleted, not commented out:
 * the full-room cover (the wave at cover/centre), its ring, its sentence *"Standing up the
 * governance workspace…"*, the `opacity`/`transition` it drove on the embed, and the ceiling
 * that lifted it. The room draws the application's own loader and nothing of ours.
 */
import { useEffect, useState } from 'react';
// THE ROOM'S OWN SEAT — its own file, its own tag. The shared <chat-panel> still serves the
// Composer; this room no longer draws it, so a change made for another room cannot strip this one.
import '@/rooms/governance/governance-chat-panel';
import { governanceToolUrl } from '@/shared/appConfig';

export interface GovernanceRoomProps {
  /** True while the chat strip's own gesture is live — draws the drag overlay. */
  governanceGripActive: boolean;
  /** True while the Evals tab's own experience holds the right column. */
  governanceEvalsSeat: boolean;
  governanceLayoutRef: { current: any };
  governanceSeatRef: { current: any };
  governanceEvalsSeatRef: { current: any };
  governanceEmbedRef: { current: any };
}

export function GovernanceRoom({
  governanceGripActive,
  governanceEvalsSeat,
  governanceLayoutRef,
  governanceSeatRef,
  governanceEvalsSeatRef,
  governanceEmbedRef,
}: GovernanceRoomProps) {
  /*
   * ── THE ROOM EASES IN, AND THE WAIT IS REAL (owner, 2026-10-23) ──────────────────────────
   *
   * His words: *"it was supposed to ease in with a nice fade … while that application was
   * loading in the background. The spinner gate was supposed to actually be doing something."*
   *
   * THE DEFECT THIS FIXES, measured on a cold visit: the embedded application's iframe paints
   * its own canvas before any of its CSS or JavaScript arrives, so the room showed a GREY
   * rectangle, then the app's first paint flashed, and only then did the real interface appear.
   * On a second visit all of that is cached and the app is there instantly — which is exactly
   * why the owner read it as a caching problem. It is a COLD-BOOT problem, and the only honest
   * cure is to not show the canvas until the app has something to show.
   *
   * SO THE EMBED IS HELD AT ZERO AND THE ROOM'S OWN GROUND SHOWS INSTEAD. The readiness test
   * reads the embedded document for its own header (`#page-header` — a landmark the
   * application only draws once it has rendered; verified present, with `main` and `nav`,
   * in the live frame). That is a READ of the app, never a contract it has to honour, and it
   * is polled on a timer because no event we own fires when a third-party document paints.
   *
   * THE BOUNDS ARE THE HOUSE'S. A 700 ms fade so the arrival is a fade and not a cut, and a
   * TEN SECOND DEAD STOP: if the header never appears, the frame is revealed anyway and the
   * person sees the application's real state — a wait may never outlive the truth, and the
   * room must never be left holding a blank.
   *
   * THE RING IS THE HOUSE'S OWN SHAPE (26px, 3px track, one quarter turning) and it is only
   * on screen while the hold is real, so it is never decoration: it disappears the instant the
   * application is readable. It is drawn over the room's own ground, not over the canvas.
   */
  const [embedRevealed, setEmbedRevealed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const started = Date.now();
    const DEAD_STOP_MS = 10_000;
    const reveal = () => { if (!cancelled) setEmbedRevealed(true); };
    const timer = window.setInterval(() => {
      if (cancelled) return;
      if (Date.now() - started >= DEAD_STOP_MS) { reveal(); window.clearInterval(timer); return; }
      try {
        /* The embed's frame lives in its shadow root — a light-DOM query would never see it. */
        const host = governanceEmbedRef.current as (HTMLElement & { shadowRoot?: ShadowRoot | null }) | null;
        const frame = host?.shadowRoot?.querySelector('iframe') as HTMLIFrameElement | null;
        const doc = frame?.contentDocument;
        if (doc && doc.querySelector('#page-header')) { reveal(); window.clearInterval(timer); }
      } catch {
        /* A cross-origin or not-yet-created document is simply "not ready yet". */
      }
    }, 120);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [governanceEmbedRef]);

  /* THE ROOM TELLS THE SHELL WHEN ITS SCREEN IS BUILT. With no address there is no application
     to wait for, and the room's own ground is its answer. */
  useEffect(() => {
    if (governanceToolUrl() && !embedRevealed) return;
    window.dispatchEvent(new CustomEvent('room-ready', { detail: { room: 'governance' } }));
  }, [embedRevealed]);

  return (
    <>
      {/* THE GRIP'S SAFETY NET — up only while the chat strip has a live gesture (the
          layout's own resize-start/resize-end). Transparent and fixed over the whole
          window, so the hand's moves keep reaching THIS document even while the pointer is
          over the embedded application beside the strip (see `governanceGripActive`).
          The Product room's own overlay, one room over. */}
      {governanceGripActive && (
        <div
          aria-hidden="true"
          style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize' }}
        />
      )}
      {/* THE ROOM'S OWN RELATIVE GROUND — THE COVER'S FRAME (the product room's pattern):
          the staged opening spans the WHOLE room, both columns. Layout-neutral wrapper,
          clipped like the sandbox's viewport. */}
      <div key="governance-root" data-room-root="governance" style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
      {/* NO OVERLAY IN THIS ROOM — EVERY SEAT IS A FLEX COLUMN (owner, 2026-10-17, after
          the Trace seat overlaid the page again: *"I didn't ask you to turn it back into an
          overlay. I said remove the margin. I liked the responsiveness."*). The overlay
          made the pane a layer over the application, so dragging her edge resized nothing
          underneath — the application stayed full width. The column keeps the room
          responsive: the spacer moves her edge and the application reflows with it. */}
      <workspace-layout
        key="governance-room"
        ref={governanceLayoutRef}
        className="flex-1 min-h-0"
      >
      {/* THE SLOT ADDS NOTHING — ONE WAVE FOR THE WHOLE ROOM (late 2026-10-07; the
          application's own transparent page grounds left with it, 2026-10-08): the
          room-level ground (the "workspace" slot) wears the wave (cover, centred), so this
          slot goes transparent — the left nav's floor and the chat side show the SAME
          single wave, edge to edge, with no seam. */}
      {/* EVEN 20px SIDE MARGINS (owner, 2026-10-17: *"There is a large margin on the right
          … I just want this right margin gone. I want the margins to be equal maybe 20
          pixels all the way around."*). The left number puts the application's edge 20px
          clear of the studio rail (56px wide); the right number matches it 20px clear of
          the gripper. It used to be 90 on the right — a gutter wide enough to read as an
          empty band beside her column. */}
      <div slot="left" style={{ position: 'relative', display: 'flex', flexDirection: 'row', width: '100%', height: '100%', minHeight: 0, paddingLeft: '76px', paddingRight: '20px' }}>
      {/* THE ROOM'S TOOL (2026-10-08): the room's own application, self-hosted in
          governance/langfuse-main, embedded full-page through the frame proxy. The room's
          nav is GovernanceNav, rendered at the page level in the shell rail's own pattern.
          THE 75px LEFT SHIFT (owner, 2026-10-09) lives on the slot's paddingLeft — the
          embed itself keeps margin-left: 0, so the app is never pushed by a margin.
          colorScheme: 'dark' IS LOAD-BEARING (diagnosed 2026-10-09): the embedded document
          declares `color-scheme: dark`, and when the embedding element's used
          color-scheme differs, the browser paints the iframe canvas with an OPAQUE
          backdrop — the frame's transparent backgrounds can never show the room's wave.
          Matching the schemes is what makes the canvas transparent. Do not remove this
          line.
          AND THE DEAD PARAMS DO NOT TRAVEL HERE (F1a, owner-approved 2026-10-09): the app
          reads neither `embedded=console` nor `house_door` (grep-verified), and their
          query string tripped the vendor settings-nav route guard — fixed in the vendor
          source the same day — but this frame takes a clean address: the attribute below
          tells <builder-embed> to skip both params for THIS mount only. The builder mounts
          (product, development) keep them byte-for-byte. */}
      {governanceToolUrl() && (
        <builder-embed
          key="governance-workspace"
          ref={governanceEmbedRef}
          no-embedded-params
          src={governanceToolUrl()}
          style={{
            display: 'block', flex: '1 1 0%', minWidth: 0, height: '100%',
            colorScheme: 'dark',
            /* THE EASE-IN (see the note above the component). Held at zero until the embedded
               application has drawn its own header, then faded into over 700 ms so the arrival
               is a fade and never a grey canvas or a first-paint flash. `opacity` only — the
               frame is mounted and loading the whole time, which is the point: the wait is
               real, the application is assembling behind the hold. */
            opacity: embedRevealed ? 1 : 0,
            transition: 'opacity 700ms ease',
          }}
        />
      )}
      {/* THE WAIT MOVED TO THE SHELL (owner, 2026-10-25). This room's file arrives after the
          tab is pressed, and a ring drawn here could not stand until then — a bare ground
          showed in between. The shell draws the room's ring and sentence the instant the tab
          is pressed, so this room draws none of its own and exactly one ring stands. The
          embed's hold below keeps its two jobs: nothing shows until the application has
          drawn its header, and the 700ms ease-in is the fade — never a pop, never a grey
          canvas. NO ADDRESS, NO WAIT (2026-10-24): with the address unset, no application
          mounts and the room reports ready at once; the ground alone is the answer. */}
      </div>
      {/* THE PLATFORM'S CHAT SEAT — the same <chat-panel> the console and composer mount,
          in the container's right pane. CLOSED on entry (the layout effect sets
          `isThirdOpen = false` as a PROPERTY); the seat binds the room's OWN package
          (`useGovernanceRoom`) and its rail is the room's own list
          (GOVERNANCE_SEAT_TABS). */}
      <governance-chat-panel key="governance-seat" slot="right" ref={governanceSeatRef} style={{ display: governanceEvalsSeat ? 'none' : undefined }}></governance-chat-panel>
      {/* THE EVALS TAB'S OWN EXPERIENCE — its own element, its own content, shown only
          while that tab is selected. */}
      <evals-chat-panel
        key="governance-evals-seat"
        slot="right"
        ref={governanceEvalsSeatRef}
        style={{ display: governanceEvalsSeat ? undefined : 'none' }}
      ></evals-chat-panel>
      </workspace-layout>
      </div>
    </>
  );
}
