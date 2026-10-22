/**
 * THE PRODUCT ROOM'S GATE — its two faces (`productGateDown`, `productToolDown`), its four
 * clocks, and the lift rule that raises the cover once all three hands have landed.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` verbatim (2026-10-21). The product room owns the
 * gate; the shell destructures the same names it always used, so no call site changed.
 *
 * THE HANDS (owner, 2026-10-06; the minimum removed by his order 2026-10-21: *"remove those
 * time minimums"*): the frame's load and the seat's binding. The cover lifts the instant BOTH
 * have landed — no floor holds it over an already-ready room. The ceiling
 * (`PRODUCT_GATE_MAX_MS`) never outlives itself: a room that cannot assemble reveals on its
 * honest blank seat, never a spinner standing for an assembly that stopped being possible.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { PRODUCT_GATE_MAX_MS } from '@/gate/gateTimings';

/** What the gate needs from the shell: the tab that owns it, and the seat's settled hand. */
export interface UseProductGateArgs {
  headerTab: string | null | undefined;
  productSeatSettledRef: { current: boolean };
}

export function useProductGate({ headerTab, productSeatSettledRef }: UseProductGateArgs) {
  const [productGateDown, setProductGateDown] = useState(false);
  const [productToolDown, setProductToolDown] = useState(false);
  const productFrameLoadedRef = useRef(false);
  /* THE THIRD HAND (2026-10-21): the builder paints AFTER its frame loads. Without this the
     gate lifted on the load event and revealed the builder's own "Loading…" screen — the
     owner's "two spinners". It is set by `builder-embed-ready`, which the embed announces only
     because ProductRoom passes `ready-selector`. */
  const productPaintedRef = useRef(false);
  const productGateMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dropProductGateWhenAllLanded = useCallback(() => {
    if (productFrameLoadedRef.current && productSeatSettledRef.current && productPaintedRef.current) {
      setProductGateDown(true);
    }
  }, []);

  /** THE PRODUCT ROOM'S OWN HANDS — the frame's load and the seat's binding. No floor. */
  useEffect(() => {
    if ((headerTab || '') !== 'product') return;
    setProductGateDown(false);
    setProductToolDown(false);
    productFrameLoadedRef.current = false;
    productPaintedRef.current = false;
    productSeatSettledRef.current = false;
    /* The builder's announcement may arrive AFTER this effect — it then lifts the gate itself. */
    const onPainted = () => {
      productPaintedRef.current = true;
      dropProductGateWhenAllLanded();
    };
    window.addEventListener('builder-embed-ready', onPainted);
    if (productGateMaxTimerRef.current) clearTimeout(productGateMaxTimerRef.current);
    productGateMaxTimerRef.current = setTimeout(() => {
      if (!productFrameLoadedRef.current) setProductToolDown(true);
      // THE COVER NEVER OUTLIVES THE CEILING — see the development effect above: a seat
      // binding that never settles reveals the room on its honest blank seat, never a
      // spinner standing for an assembly that stopped being possible.
      setProductGateDown(true);
    }, PRODUCT_GATE_MAX_MS);
    return () => {
      window.removeEventListener('builder-embed-ready', onPainted);
      if (productGateMaxTimerRef.current) clearTimeout(productGateMaxTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTab]);

  return {
    productGateDown,
    productToolDown,
    productFrameLoadedRef,
    dropProductGateWhenAllLanded,
    setProductGateDown,
    setProductToolDown,
  };
}
