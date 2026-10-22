/**
 * THE TAB GATE — outgoing room down in the click's own frame — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import dataWave4Background from '@/assets/data-wave4-flipped.webp';
import { deepFind } from '@/canvas/pageHelpers';
import designSectionBackground from '@/assets/design-section2-bkg.webp';
import developmentLabBackground from '@/assets/canvas-development-lab-bkg.webp';
import { markArrival } from '@/shared/arrival';
import productAssemblyBackground from '@/assets/product-assembly-bg.webp';
import { useCallback } from 'react';

/** Exactly what the callback needs from the shell, by name. */
export interface UseTabGateDeps {
  SECTION_TABS: any;
  assembleGovernanceSurface: any;
  assembleProductSurface: any;
  assembleSurfaceThenRepairs: any;
  currentPromptSession: any;
  guardProductExit: any;
  handleHeaderTabChange: any;
  handoffCoverEpochRef: any;
  hasUnsavedChangesRef: any;
  headerTab: any;
  isDeadTab: any;
  openProductRoom: any;
  productRoomProjectId: any;
  setConsoleRefreshKey: any;
  setGovernanceGateDown: any;
  setIsAIAssembling: any;
  setProductGateDown: any;
}

export function useTabGate(deps: UseTabGateDeps) {
  const { SECTION_TABS, assembleGovernanceSurface, assembleProductSurface, assembleSurfaceThenRepairs, currentPromptSession, guardProductExit, handleHeaderTabChange, handoffCoverEpochRef, hasUnsavedChangesRef, headerTab, isDeadTab, openProductRoom, productRoomProjectId, setConsoleRefreshKey, setGovernanceGateDown, setIsAIAssembling, setProductGateDown } = deps;
  return useCallback(async (tabId: string | null) => {
    /*
     * ══ THE OUTGOING ROOM COMES DOWN IN THE CLICK'S OWN FRAME (owner, 2026-10-11) ══
     *
     * *"you have to move between product and then click development and then click product
     * again and you'll see the ghost … it appears before assembly … it happens within the 1st
     * ms."* Measured on that exact switch: after the click, the OLD room stayed painted while
     * the switch was still being decided — the exit guard's fetch below runs BEFORE any tab
     * moves, and this shell's own re-render of the tab change lands a frame or two after the
     * click — so the eye caught the previous room once more before the new room's gate. A
     * React state change cannot fix this: that update would itself pay the same render delay
     * before anything changed on screen. So the mounted room roots are hidden IMPERATIVELY,
     * synchronously, in the click's own task — the first frame after the click already shows
     * the pane's own ground, never the old room's face. The swap that follows unmounts the
     * hidden node; `roomRootsShown()` restores it only on the paths where nothing moves.
     * THE OUTGOING NODE MUST NOT BE REUSABLE — each room root carries its own `key`
     * (`development-root`, `product-root`, `governance-root`); measured 2026-10-11 without
     * them: React recycled the hidden node as the incoming room's root and that room stayed
     * invisible (probe: 109/109 frames hidden-but-mounted). With the keys the incoming room
     * is a fresh, visible node; probe after the fix: 0 frames showing the outgoing room,
     * either direction. The remaining rooms' 700ms staged openings are untouched — this takes away the
     * ghost, not the assembly.
     */
    const roomRootsShown = () =>
      document.querySelectorAll<HTMLElement>('[data-room-root]').forEach((el) => { el.style.visibility = ''; });
    const roomRootsHidden = () =>
      document.querySelectorAll<HTMLElement>('[data-room-root]').forEach((el) => { el.style.visibility = 'hidden'; });
    /*
     * ══ AND THE HAND-OFF IS ONE GROUND, NOT THREE (owner, 2026-10-11, the switch still
     * jerking after the ghost was taken out: *"It's supposed to be a beautiful assembly
     * spinner then it fades into the application … there's not supposed to be jumping and
     * snapping and ghosts."*) ══
     *
     * What the eye got on that switch, measured: click → the outgoing room hid → the pane's
     * own ground (the Composer's paper) showed through for the exit guard's round-trip — 40ms
     * on the way out of Product — → the incoming room's gate, whose ground was a different
     * color. Paper flashing between two dark rooms IS the snap. So the switch lands on ONE
     * cover: `#room-handoff-cover` is shown imperatively in the click's own frame, over
     * everything — AND IT WEARS THE TARGET ROOM'S OWN FACE, set per switch by
     * `handoffCoverShown` (Product: the assembly image + ring + sentence = its gate's very
     * face; Governance: the wave + ring + sentence = its gate's; Development: the room's lab
     * tile, bare). The seam cannot show in any room: the gate — or the Development room
     * itself — mounts behind a cover wearing the same pixels. Product and Governance retire
     * it the moment their root is visible (their gates carry the face on unchanged);
     * DEVELOPMENT HOLDS it until the canvas signals it has painted (`builder-embed-ready`,
     * the dev embed's `ready-selector`) — then a 700ms SOFT FADE, never a display:none snap
     * (measured before this: retiring at root-visible exposed the half-painted canvas
     * bleeding over the room's purple). The cover is also removed when the guard answers
     * "keep working" (nothing moved — beside the room coming back). TEN SECONDS IS THE DEAD
     * STOP in every case: a cover may never outlive the truth it stands over (past that
     * bound the room shows its real state, whatever it is).
     *
     * ══ AND THE TARGET ROOM'S GATE IS ARMED BEFORE ITS OWN COMMIT ══
     *
     * The gate flags persist while the room is away (a room left after its opening holds
     * `gateDown = true`), and the entry effect resets them AFTER paint — so on the way back in,
     * the room's first painted frame held the gate at opacity 0 and the raw iframe at opacity 1,
     * and then the gate FADED IN over the bare application (its 700ms transition fires on that
     * 0→1). That fade-in-over-the-raw-app is the jerk — the gate must be UP from the room's
     * first frame, and only ONE fade may exist: the fade OUT into the application. Clearing
     * the flag here — synchronously, before the tab change it rides with — mounts the room
     * with the gate already standing and the frame already hidden under it. The entry effect's
     * own reset then finds the flag already cleared (a no-op).
     */
    /*
     * THE COVER WEARS THE TARGET ROOM'S OWN FACE (2026-10-16; owner: *"it looks like there is
     * still a spinner and a purple flash"*, and he was right): MEASURED — the tile it wore
     * for EVERY room (`canvas-development-lab-bkg.webp`) is an OPAQUE purple sheet (avg RGB
     * 64,54,79, alpha 255 everywhere; the older notes calling it "a transparent grid" were
     * wrong, so every switch toward Product stood on purple until the gate's near-black
     * image, and toward Governance until its wave). Now the cover takes the TARGET's own
     * ground, byte-matching the face about to mount behind it: product → the assembly image
     * at 100% 100%, governance → the wave at cover/center, development → the room's own lab
     * tile (repeat). The `#2b2635` base in the JSX stays under every face — what the cover
     * shows while an image decodes. Ring and sentence: Product and Governance keep them
     * (their gates carry both); DEVELOPMENT GETS NEITHER — *"no spinner of ours may stand
     * over that room"* (2026-10-16) — its cover is bare ground until the canvas is painted.
     * (The ring's phase can differ by the guard's few frames at the hand-off — a one-time
     * arc tick the eye reads as continuous rotation; the alternative was the pop that was
     * rejected.)
     * SHOWN = INSTANT, ALWAYS: any in-flight soft fade is cut and the cover snaps to full
     * opacity in the click's own frame (the transition is disabled across the write, then
     * restored for the next fade); `data-cover-face` records the face for probes.
     */
    const handoffCoverShown = (room: string) => {
      const cover = document.getElementById('room-handoff-cover');
      if (!cover) return;
      const dev = room === 'development';
      if (dev) {
        cover.style.backgroundImage = `url(${developmentLabBackground})`;
        cover.style.backgroundSize = '';
        cover.style.backgroundRepeat = 'repeat';
        cover.style.backgroundPosition = '';
      } else if (room === 'product') {
        cover.style.backgroundImage = `url(${productAssemblyBackground})`;
        cover.style.backgroundSize = '100% 100%';
        cover.style.backgroundRepeat = 'no-repeat';
        cover.style.backgroundPosition = '';
      } else if (room === 'design') {
        /* THE DESIGN ROOM'S GROUND — the same sheet its slot paints, stretched the same way
           (100% 100%): the fade from this cover into the room's own gate is one picture. */
        cover.style.backgroundImage = `url(${designSectionBackground})`;
        cover.style.backgroundSize = '100% 100%';
        cover.style.backgroundRepeat = 'no-repeat';
        cover.style.backgroundPosition = 'top left';
      } else {
        cover.style.backgroundImage = `url(${dataWave4Background})`;
        cover.style.backgroundSize = 'cover';
        cover.style.backgroundRepeat = 'no-repeat';
        cover.style.backgroundPosition = 'center';
      }
      cover.dataset.coverFace = room;
      const ring = cover.querySelector<HTMLElement>('[data-cover-ring]');
      /* THE RING + SENTENCE BELONG TO A ROOM THAT HAS NO GATE OF ITS OWN (Development).
         Product, Governance and Design each stand up their own gate with the ring and
         sentence — drawing a second one here stacks two spinners over the room. The
         cover for those rooms is the seamless FACE only; Development keeps both because
         its cover is the only feedback until the canvas paints. */
      if (ring) ring.style.display = dev ? '' : 'none';
      const line = cover.querySelector('p');
      if (line) {
        if (dev) {
          line.textContent = 'Standing up the development workspace\u2026';
          line.style.display = '';
          line.style.color = '#c9c9c9';
        } else {
          line.textContent = '';
          line.style.display = 'none';
        }
      }
      cover.style.transition = 'none';
      cover.style.opacity = '1';
      cover.style.display = 'flex';
      void cover.offsetHeight; /* flush the write so the next fade starts from full opacity */
      cover.style.transition = '';
    };
    /* INSTANT HIDE, and the epoch bump that stops any in-flight settle loop or soft fade:
       the guard's "keep working" path and the Product/Governance retirements (their gates
       carry the face — the swap is invisible there, so no fade). */
    const handoffCoverHidden = () => {
      handoffCoverEpochRef.current += 1;
      const cover = document.getElementById('room-handoff-cover');
      if (!cover) return;
      cover.style.transition = '';
      cover.style.opacity = '1';
      cover.style.display = 'none';
    };
    /* THE SOFT FADE (Development's arrival — owner's direction: "soft fade in when the app
       signals ready (no display:none snap)"): the cover IS the room's ground, so fading it
       over the freshly painted canvas reveals the app through the room's own purple — no
       snap, no half-painted bleed. The epoch check leaves a fade alone if a newer switch
       has already taken the cover over. */
    const handoffCoverFadeOut = () => {
      const cover = document.getElementById('room-handoff-cover');
      if (!cover) return;
      const epoch = handoffCoverEpochRef.current;
      cover.style.transition = 'opacity 700ms ease';
      cover.style.opacity = '0';
      window.setTimeout(() => {
        if (handoffCoverEpochRef.current !== epoch) return; /* superseded — do not touch */
        cover.style.transition = '';
        cover.style.opacity = '1';
        cover.style.display = 'none';
      }, 750);
    };
    const isRoomSwitch = !!tabId && tabId !== (headerTab || '');
    if (isRoomSwitch) {
      roomRootsHidden();
      if (tabId === 'product') setProductGateDown(false);
      else if (tabId === 'governance') setGovernanceGateDown(false);
      if (tabId === 'product' || tabId === 'development' || tabId === 'governance' || tabId === 'design') {
        handoffCoverEpochRef.current += 1;
        handoffCoverShown(tabId);
        const roomTarget = tabId;
        const coverEpoch = handoffCoverEpochRef.current;
        const coverShownAt = performance.now();
        /*
         * DEVELOPMENT NO LONGER WAITS FOR THE CANVAS TO PAINT (2026-10-21).
         *
         * What stood here: the cover held until `builder-embed-ready` — the canvas's first h1 —
         * with a ten-second bound, on the reasoning that the canvas measures its heading at
         * ~357ms. MEASURED ON THE LIVE ROOM: the embedded canvas takes far longer than that to
         * produce its first heading, so the signal never lands inside the bound, and every
         * arrival sat on a bare purple tile for the FULL TEN SECONDS before the room even began
         * to show its app. The wait was ours, not the app's: a cover that outlives its own
         * evidence is a delay dressed as politeness.
         *
         * The rule now is the room's, like every other room's: the cover retires when the room's
         * own root is visible. The canvas's stages paint underneath, in the open, where they can
         * be seen for what they are — the owner has said repeatedly that he would rather watch a
         * real load than a fabricated hold ("I would rather it just be a blank page than have a
         * fallback"). Owner, 2026-10-21: *"I'm not sure what it's doing … it literally assembles
         * that it goes blank like nothing's there."* That was this wait.
         */
        const settleCover = () => {
          if (handoffCoverEpochRef.current !== coverEpoch) {
            return; /* superseded by a newer switch — its cover is not ours to touch */
          }
          const root = document.querySelector<HTMLElement>(`[data-room-root="${roomTarget}"]`);
          const rootVisible = !!root && getComputedStyle(root).visibility !== 'hidden';
          /* THE COVER'S BOUND: ten seconds, dead stop — the cover may stand only while the
             switch itself can honestly be pending; past the bound it comes down and the room
             shows its real state, whatever that is. A cover may never outlive the truth. */
          const beyondBound = performance.now() - coverShownAt > 10_000;
          if (roomTarget === 'development') {
            if (rootVisible || beyondBound) {
              handoffCoverFadeOut();
              return;
            }
          } else if (rootVisible || beyondBound) {
            handoffCoverHidden();
            return;
          }
          requestAnimationFrame(settleCover);
        };
        requestAnimationFrame(settleCover);
      }
    }

    /**
     * ⭐ THE ROOM'S EXIT GUARD COMES FIRST (owner, 2026-10-04: *"you should probably ask the
     * user if they try to exit the product team area without saving their project if they
     * want to save it or not … it's called publish at the top, that would publish it to the
     * console"* — and "don't save" means DISCARD). Leaving the Product room with an open,
     * unpublished idea asks the question before ANY tab moves; a blank idea is discarded in
     * silence; a published one leaves freely. See `guardProductExit`.
     *
     * AND IT IS THE EXIT DOOR ONLY (2026-10-11): it no longer runs when the target IS the
     * product room — entering it abandons nothing (`openProductRoom` reopens the held
     * project — the confirmed package model) — and running it there bought a network
     * round-trip before the tab moved for an answer that path never uses. Real switches out
     * of a published project still pay the guard's own state read — safe by design; the
     * hide above already keeps that wait from showing the last room's face.
     */
    if (productRoomProjectId && tabId !== 'product') {
      const mayLeave = await guardProductExit();
      if (!mayLeave) {
        // NOTHING MOVED — "keep working" — the room gets its face back, and the cover comes
        // off with it (same frame; the room is never seen behind a leftover cover).
        roomRootsShown();
        handoffCoverHidden();
        return;
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // A2UI v0.9: Tab clicks are AI commands
    // Send document state to AI - AI decides how to handle unsaved changes
    // ══════════════════════════════════════════════════════════════════════

    // Build context for AI - includes unsaved changes state
    const context = {
      current_surface: headerTab || 'console',
      has_unsaved_changes: hasUnsavedChangesRef.current,
      session_id: currentPromptSession?.id || null,
      session_title: currentPromptSession?.title || '',
    };

    if (tabId === 'console') {
      // Set the assembling flag FIRST so the sandbox goes composer → spinner (which
      // already carries the console background) → console, instead of flashing the
      // bare console slot for a tick and then snapping. The header tab still moves
      // instantly for the indicator; the spinner covers the surface during assembly.
      setIsAIAssembling(true);
      handleHeaderTabChange('console');
      /*
       * THE CONSOLE'S OWN ARRIVAL — it used to announce nothing at all.
       *
       * Its panel therefore greeted on whatever record happened to be left pending, and the last
       * thing to leave one is a package open: that is how a PACKAGE's greeting was written into the
       * console's own conversation (measured 2026-09-23: 31 of that thread's 69 messages were about
       * another package's prompt). A landing now says so itself. The kind carries no session id
       * because the console's session is a server fact that arrives WITH the assembly — the panel
       * answers this one from its own scope read, which is the same fact its greeting waits on.
       */
      markArrival('console');
      window.dispatchEvent(new CustomEvent('a2ui:composer-opened', { detail: { kind: 'console' } }));
      // Console is read-only — unsaved changes in the composer do not block navigation.
      console.log('🤖 [A2UI] Console clicked → intent: render-console (direct, no gate)');
      await assembleSurfaceThenRepairs('render-console', {
        current_surface: 'composer',
        has_unsaved_changes: false,  // ← Console is safe navigation, no decision dialog
        session_id: currentPromptSession?.id || null,
        session_title: currentPromptSession?.title || '',
      });
      setConsoleRefreshKey((k) => k + 1);
      return;
    }

    if (tabId === 'composer') {
      // A FRESH COMPOSER STARTS CLEAN — whatever Grace had here is not kept.
      //
      // The owner, 2026-09-18: "it's almost as if the composer is not clearing… every time I
      // create a new one by clicking composer, it should clear whatever Grace had and be ready
      // to accept the new run." The seat is reused across assemblies, so its thread has to be
      // emptied on purpose here; nothing that was SAVED is affected (a package's conversation
      // is loaded from its own id when it is opened).
      // THE SHADOW-PIERCING READ, NOT document.querySelector: the seat is drawn by the
      // renderer inside its shadow root, so the document-level query returned null on every
      // click and the thread was silently never emptied — the sentence above was a claim
      // about behaviour that did not run. `deepFind` is the helper this file already uses
      // for exactly this boundary (see its note).
      const seat = deepFind<HTMLElement & { clearThread?: () => void }>('chat-panel');
      seat?.clearThread?.();
      // Move the header tab indicator INSTANTLY — don't wait for AI assembly
      handleHeaderTabChange('composer');
      // Composer click always starts a FRESH prompt package (same as "Create New")
      // — never reload the card the user had open.
      console.log('🤖 [A2UI] Composer clicked → intent: render-composer (fresh package)');
      await assembleSurfaceThenRepairs('render-composer', {
        ...context,
        session_id: null,
        session_title: '',
      });
      return;
    }

    /*
     * A SECTION IS A SURFACE LIKE EVERY SURFACE — so it ASSEMBLES, and this branch asks.
     *
     * The owner, 2026-09-30, on finding that Design did not: *"No, no it's a surface. It's a
     * surface just like every surface. I'm not seeing assembly happening. I see a section
     * loading, but I'm getting a jarring jerk when I click on design — I'm not getting the
     * assembly process that we have on composer."* He was right, and this is what he was seeing:
     *
     * THIS BRANCH USED TO RETURN WITHOUT ASKING. It moved the header indicator and stopped, so
     * no `assemble-surface` request was ever made — and because that request is what sets the
     * assembling flag, the sandbox never projected its `spinner` slot either. The React tree in
     * the slot simply swapped its content in one paint, which is what a web page does and
     * nothing like a surface arriving. The model was never asked anything.
     *
     * `render-section:<id>` is new on the server for the same reason: `assemble-surface` accepted
     * only render-console, render-composer, render-session and render-run, so asking for a section
     * would have been a 400. A section assembles the Composer's own tree — the same LAYOUT
     * CONTRACT, the same five slots — because the owner asked for that architecture reused:
     * *"I need you to reuse the same architectural structure that we currently use for composer."*
     *
     * Product, Development and Governance come through here too. They inherited the same defect
     * from the line below, which has read "Other tabs - just switch for now (TODO: wire to AI
     * assembly)" since before this work began — so no unbuilt tab in this shell has ever
     * assembled.
     *
     * The left menu's own "Ingest Design" item still opens the ingest as a modal, unchanged.
     */
    if (tabId === 'design') {
      // DESIGN LANDS ON ITS CONSOLE — the room's own file, its own door, its own renderer. The
      // Figma program closes back to the console; its own assembly is not asked for here.
      window.dispatchEvent(new CustomEvent('design-console-open'));
      handleHeaderTabChange('design');
      console.log('🤖 [A2UI] Design clicked → the design console (its own surface mount)');
      return;
    }

    if (tabId === 'product') {
      /*
       * PRODUCT GOES THROUGH ITS OWN PROCESS (2026-10-03) — the same shape as Design's above:
       * the tab moves, the room's own assembly is asked, and nothing of the Composer's is
       * called: no package adopted, no thread cleared, no `currentPromptSession` written.
       *
       * THE ROOM OPENS THE MOST RECENT PRODUCT PACKAGE. The console's cards already carry
       * each package's room (`room_domain`, from the console's own read), so the door is a
       * lookup in data that is already on screen. None → the honest empty state with the
       * create door — never an assembly around nothing.
       */
      handleHeaderTabChange('product');
      console.log('🤖 [A2UI] Product clicked → the builder pane (no assembly: the room IS the builder)');
      /*
       * NOTHING IS ASSEMBLED FOR THIS ROOM ANY MORE (owner, 2026-10-04): *"the product room
       * will just remove the grace chat."* The pane below this branch mounts <builder-embed>
       * — the whole local app builder — so there is no surface to ask the server for, no
       * package get-or-create, and no model call on arrival. `assembleProductSurface` and its
       * tree/state stay in the file, unwired, rather than deleted: the room they served may
       * come back, and a deleted door is not a decision this host gets to make alone.
       */
      /* THE CLICK IS THE DOOR — AND THE DOOR NOW RESUMES (owner, 2026-10-06, the confirmed
         package model): entering Product reopens the project last touched (*"they may come
         back and want to do something different to it"*), birthing one only when there is
         none — see `openProductRoom`. A console card opens an EXISTING project instead;
         that path belongs to the card (handleOpenPromptFromConsole). */
      void openProductRoom();
      return;
    }

    if (tabId === 'governance') {
      // THE ROOM IS THE SHELL NOW — the application left it (owner, 2026-10-08: the
      // Evidently application was removed, everything of it; the container, the
      // backgrounds, the chat, the slide and the left navigation stay). The product
      // branch's shape, one room over: the room's own nav and seat stand, the seat binds
      // its own package (the seat effect below); no surface is asked for and no model call
      // happens on arrival. `assembleGovernanceSurface` and its tree/state STAY IN THE
      // FILE, unwired, rather than deleted: the ledger's surface may return, and a deleted
      // door is not a decision this host gets to make alone.
      handleHeaderTabChange('governance');
      return;
    }

    if (tabId === 'development') {
      /*
       * THE DEVELOPMENT TAB IS A ROOM NOW (owner, 2026-10-04: *"you could just drop it right in
       * there. Can't you under a development tab"*) — the development workspace embedded
       * whole, exactly the Product room's move: no A2UI assembly, no `render-section`,
       * nothing of the Composer's touched. It was the LAST dead stub (DEAD_TABS); it stays
       * listed there so the assemble path keeps refusing it, and this branch — ahead of that
       * path — is what makes it live.
       */
      handleHeaderTabChange('development');
      console.log('🤖 [A2UI] Development clicked → the development room (no assembly)');
      return;
    }

    if (SECTION_TABS.includes(tabId || '')) {
      /*
       * A SECTION ASSEMBLES, AND IT TOUCHES NOTHING OF THE COMPOSER'S.
       *
       * THIS BRANCH HELD TWO LINES IT SHOULD NEVER HAVE HAD, and they did real damage on
       * 2026-09-30: the owner clicked a section tab and came back to an empty Composer, reading
       * it as every package being gone. Nothing was lost — 226 rows, 18 conversations, 0 deleted,
       * verified — but the UI had cleared WHICH PACKAGE WAS OPEN, and these two lines are why:
       *
       *   `seat?.clearThread?.()`  Lifted from the Composer's branch, where it exists to empty the
       *                            seat for a FRESH package. A section has no business clearing
       *                            the Composer's seat.
       *
       *   `session_id: null`       The Composer's "there is no current package" argument. Copied
       *   `session_title: ''`      here it told the app the open package was gone — and the
       *                            assembly's failure path runs `setCurrentPromptSession(null)`,
       *                            which then made it true.
       *
       * Both are gone. And the two fields that replace them are the CONSOLE's own precedent, not
       * a new idea: `current_surface` names the tab being opened rather than the one being left
       * (so the server cannot read this as a Composer navigation), and `has_unsaved_changes:
       * false` says the same thing the console says — *"read-only navigation; unsaved changes in
       * the composer do not block it"* — because a section cannot discard somebody's work.
       */
      handleHeaderTabChange(tabId);
      /*
       * AND A DEAD TAB LOADS NOTHING — see DEAD_TABS above for the owner's instruction and for why
       * the server keeps its `render-section:<id>` path. The indicator moves, no request is made,
       * no surface is adopted and no package is touched, so clicking Product, Development or
       * Governance leaves the room exactly as it was.
       */
      if (isDeadTab) {
        console.log(`🤖 [A2UI] ${tabId} clicked → a stub tab: nothing is loaded`);
        return;
      }
      console.log(`🤖 [A2UI] ${tabId} clicked → intent: render-section:${tabId}`);
      await assembleSurfaceThenRepairs(`render-section:${tabId}`, {
        ...context,
        current_surface: tabId,
        has_unsaved_changes: false,
      });
      return;
    }

    // Other tabs - just switch for now (TODO: wire to AI assembly)
    handleHeaderTabChange(tabId);
  }, [handleHeaderTabChange, assembleSurfaceThenRepairs, currentPromptSession?.id, currentPromptSession?.title, headerTab, assembleProductSurface, assembleGovernanceSurface]);
}
