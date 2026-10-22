/**
 * THE PRODUCT ROOM'S FOOT WIRING — moved out of `pages/WritingAreaIndex.tsx` verbatim (2026-10-21,
 * owner: *"you'll have to take that out of that writing area index.TS file"*).
 *
 * The seat's foot only asks; the ROOM answers, and both wires end at the product's own doors:
 *
 *   attach      → `uploadProductAttachment` (the engine's upload endpoint)
 *   figma /     → `postToBuilder` INTO the embedded builder, which opens ITS own modal
 *   github        / toggles ITS own visual editor — the product's functions with the product's
 *   visual-edit     own answers (its local-mode truths included)
 *
 * AND THE APP TALKS BACK: `ids:tool-state` rides out of the frame, <builder-embed> re-announces it
 * as `builder-tool-state`, and its three facts land on the seat's own props — the foot's dots and
 * the pencil's pressed state mirror the APP, never a guess.
 *
 * THE GRIP'S SAFETY NET RIDES HERE TOO (see `productGripActive`): the layout's own
 * `resize-start`/`resize-end` — dispatched on itself when the chat strip's gesture begins and ends
 * — raise and lower the room's transparent drag overlay.
 *
 * PRODUCT-ONLY: the guard is the tab, and every listener lives on this room's seat element or the
 * window event the room's own frame announces.
 */
import { useEffect } from 'react';
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';

export interface UseProductFootWiringArgs {
  headerTab: string | null | undefined;
  productSeatRef: { current: any };
  productLayoutRef: { current: any };
  productRoomProjectId: string | null;
  uploadProductAttachment: (file: File) => void | Promise<void>;
  setProductGripActive: (active: boolean) => void;
}

export function useProductFootWiring({
  headerTab,
  productSeatRef,
  productLayoutRef,
  productRoomProjectId,
  uploadProductAttachment,
  setProductGripActive,
}: UseProductFootWiringArgs) {
  useEffect(() => {
    if ((headerTab || '') !== 'product') return;
    const seat = productSeatRef.current;
    if (!seat) return;
    const layout = productLayoutRef.current;
    const onGripStart = () => setProductGripActive(true);
    const onGripEnd = () => setProductGripActive(false);
    layout?.addEventListener('resize-start', onGripStart);
    layout?.addEventListener('resize-end', onGripEnd);
    const onTool = (e: Event) => {
      const tool = (e as CustomEvent<{ tool?: string }>).detail?.tool;
      if (!tool) return;
      const embed = document.querySelector('builder-embed') as
        | (HTMLElement & { postToBuilder?: (message: Record<string, unknown>) => void })
        | null;
      embed?.postToBuilder?.({ type: 'ids:product-tool', tool });
    };
    const onAttach = (e: Event) => {
      const files = (e as CustomEvent<{ files?: File[] }>).detail?.files || [];
      for (const file of files) void uploadProductAttachment(file);
    };
    const onToolState = (e: Event) => {
      const d =
        (e as CustomEvent<{ figmaConnected?: boolean; githubConnected?: boolean; visualEditActive?: boolean }>)
          .detail || {};
      seat.productFigmaConnected = !!d.figmaConnected;
      seat.productGithubConnected = !!d.githubConnected;
      seat.productVisualEditActive = !!d.visualEditActive;
    };
    // THE STOP — THE APP'S OWN ACT, THROUGH THE BRIDGE (2026-10-06): the seat's red stop button
    // asks; this posts the engine's own `agent/stop` (the exact endpoint the app's Stop button
    // calls), and the engine appends its "Stopped." message — which the poller then draws as the
    // group's error finish. Nothing to fake: the run really ends.
    const onProductStop = () => {
      if (!productRoomProjectId) return;
      void (async () => {
        try {
          await fetch(
            `${API_BASE}/builder/projects/${encodeURIComponent(productRoomProjectId)}/stop`,
            { method: 'POST', headers: { 'X-User-ID': getStoredUserId() } },
          );
        } catch {
          /* the poller shows the run's own end when it comes */
        }
      })();
    };
    seat.addEventListener('product-tool', onTool);
    seat.addEventListener('product-attach', onAttach);
    seat.addEventListener('product-stop', onProductStop);
    window.addEventListener('builder-tool-state', onToolState);
    return () => {
      seat.removeEventListener('product-tool', onTool);
      seat.removeEventListener('product-attach', onAttach);
      seat.removeEventListener('product-stop', onProductStop);
      window.removeEventListener('builder-tool-state', onToolState);
      layout?.removeEventListener('resize-start', onGripStart);
      layout?.removeEventListener('resize-end', onGripEnd);
      setProductGripActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTab, productRoomProjectId, uploadProductAttachment]);
}
