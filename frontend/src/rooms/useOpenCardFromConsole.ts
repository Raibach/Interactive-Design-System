/**
 * A CARD OPENS THE ROOM THAT OWNS IT — the console's own door, moved out of
 * `pages/WritingAreaIndex.tsx` verbatim (2026-10-21).
 *
 * It spans THREE rooms, which is why it lives beside `useTabGate` at the root of `rooms/`
 * rather than inside any one of them: a design card opens the Design room on its element, a
 * product card opens the Product room on its builder project, and every other card routes to
 * the Composer exactly as it always has.
 *
 * The body is unchanged — every comment in it is the reason it works the way it does. What
 * changed is only where it lives; the names it closed over arrive through `deps`.
 */
import { markArrival } from '@/shared/arrival';

/** Exactly what the bridge needs from the shell, by name. */
export interface UseOpenCardFromConsoleDeps {
  assembledConsoleCards: any;
  assembleSurfaceThenRepairs: any;
  guardProductExit: any;
  handleHeaderTabChange: any;
  productRoomProjectId: any;
  refreshEvaluations: any;
  repairFindingRef: any;
  repairSectionsRef: any;
  setPromptLoadKey: any;
  setIsAIAssembling: any;
  setProductGateDown: any;
  setProductRoomProjectId: any;
}

export function useOpenCardFromConsole(depsRef: { current: UseOpenCardFromConsoleDeps | null }) {
  /*
   * THE ARGUMENTS ARE READ AT CALL TIME, NOT AT HOOK TIME. Two things this bridge needs —
   * `guardProductExit` and `assembleSurfaceThenRepairs` — are built AFTER the places that call
   * the bridge (the route's own open, and the seat's fresh-handler effect), and a hook's
   * arguments are evaluated the moment it is called. So the page hands over a ref it fills as
   * the render proceeds, and this reads it when a card is actually clicked. Same shape the page
   * already uses for `headerTabRef` and `openComposerRef`.
   */
  return async (sessionId: string) => {
    const { assembledConsoleCards, assembleSurfaceThenRepairs, guardProductExit, handleHeaderTabChange, productRoomProjectId, refreshEvaluations, repairFindingRef, repairSectionsRef, setPromptLoadKey, setIsAIAssembling, setProductGateDown, setProductRoomProjectId } = depsRef.current as UseOpenCardFromConsoleDeps;
    /* LEAVING THE ROOM IS GUARDED ON EVERY WAY OUT (2026-10-04): a console card may open a
       composer package or another product project — either one abandons the idea standing. */
    if (productRoomProjectId) {
      const mayLeave = await guardProductExit();
      if (!mayLeave) return;
    }
    /*
     * A CARD OPENS THE ROOM THAT OWNS IT (2026-10-03). The console's card data carries each
     * package's room (`room_domain`): a product card opens the Product room, and every other
     * card routes exactly where it always has — the Composer. The room's assembly announces
     * its own arrival (see `assembleProductSurface`), so this path holds no second record.
     */
    const openedCard = assembledConsoleCards?.find((c) => String(c?.id) === String(sessionId));
    /*
     * A DESIGN CARD OPENS THE DESIGN ROOM ON ITS ELEMENT (2026-10-18).
     *
     * The console now carries the design room's own rows under the "Design System" category
     * (backend/routes/ai.py, `_design_element_cards`). Those rows are ELEMENT records, not
     * prompt packages — sending one to the composer would read an element as a package. So the
     * click goes to the room that owns it, assembles it, and then dispatches the SAME
     * `open-component` event the catalogue tree's rows dispatch: one navigation path, reused.
     */
    if (openedCard?.room_domain === 'design') {
      const elementKey = String((openedCard as any)?.element_key || '');
      console.log(`🤖 [A2UI] Design card → the Tools seat on "${elementKey}"`);
      handleHeaderTabChange('design');
      /* THE TOOLS SEAT IS THE ROOM THAT OWNS AN ELEMENT (owner, 2026-10-18). The card asks the
         room for that seat, and the seat itself assembles and opens the element once its own
         tree is in hand — the console has no path into the Tools conversation. */
      window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('design-tools-open', { detail: { openTag: elementKey } }));
      });
      return;
    }
    if (openedCard?.room_domain === 'product') {
      /*
       * THE ROOM IS THE BUILDER (2026-10-04): a bridged card carries its project, and the
       * click opens the room ON it — the embed loads that project's workspace. A legacy
       * product package (no `builder_project`: born before the bridge) opens the room's
       * dashboard. NOTHING IS ASSEMBLED either way — no surface, no package read.
       */
      const builderProjectId = (openedCard as any)?.builder_project?.project_id ?? null;
      console.log(`🤖 [A2UI] Product card → the builder${builderProjectId ? ` on "${builderProjectId}"` : ' (dashboard)'}`);
      setProductRoomProjectId(builderProjectId ? String(builderProjectId) : null);
      // THE SAME PRE-ARM THE TAB PATH DOES (2026-10-11, see `handleTabChangeWithGate`): the
      // room's gate must be standing on its first painted frame — never a fade-in over the
      // raw application (the flag persists from the last visit).
      setProductGateDown(false);
      handleHeaderTabChange('product');
      return;
    }
    // ═══════════════════════════════════════════════════════════════════════════
    // A2UI v0.9: Open session via unified surface assembly
    // ═══════════════════════════════════════════════════════════════════════════
    console.log(`🤖 [A2UI] Opening session → intent: render-session:${sessionId}`);
    // Move the assembling flag and the header tab INSTANTLY so the composer's
    // spinner/surface (not the console's) shows during the assembly — the spinner
    // already carries the composer background, so the transition is a gentle
    // dark→composer fade, not the console's image lingering until the cards land.
    setIsAIAssembling(true);
    handleHeaderTabChange('composer');
    // Opening a package ends any repair: the repair prompt belongs to the finding
    // that produced it, not to the package being opened — so the finding it came from
    // is released with it, and a Run of this package settles nothing.
    repairSectionsRef.current = null;
    repairFindingRef.current = null;
    /*
     * AN EXISTING PACKAGE IS BEING OPENED — say so, here, where it is unambiguous.
     *
     * Announced before the assembly rather than inferred from it: this function IS the
     * moment a package opens, and the seat can then be answering by the time the
     * surface settles. The record carries it if the seat does not exist yet (see
     * shared/arrival); the event carries it if one is already up.
     */
    markArrival('resume', sessionId);
    // ADDRESSED TO THE PACKAGE BEING OPENED. The announcement is broadcast, so the seat it names
    // is what keeps another seat's panel from answering it — see shared/arrival for the measurement
    // that made this necessary.
    window.dispatchEvent(new CustomEvent('a2ui:composer-opened', { detail: { kind: 'resume', sessionId } }));
    await assembleSurfaceThenRepairs(`render-session:${sessionId}`);

    // The judged runs this package already has, on screen with the rest of its surface.
    void refreshEvaluations();

    // Force full re-render to dispatch sections to textareas
    setPromptLoadKey(k => k + 1);
  };
}
