/**
 * PRODUCT SURFACE ASSEMBLY — the product room's surface assembly, returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { API_BASE } from '@/shared/apiHelper';
import { apiFetch } from '@/shared/apiFetch';
import { envelopeRefusalError, readA2UIEnvelope } from '@/shared/a2ui-envelope';
import { loadDraftElements } from '@/canvas/pageHelpers';
import { loadSystemRegistry } from '@/shared/a2uiRegistries';
import { markArrival } from '@/shared/arrival';
import { useCallback } from 'react';

/** Exactly what the callback needs from the shell, by name. */
export interface UseAssembleProductSurfaceDeps {
  currentProductSessionRef: any;
  setCurrentProductSession: any;
  setIsAIAssembling: any;
  setProductTree: any;
}

export function useAssembleProductSurface(deps: UseAssembleProductSurfaceDeps) {
  const { currentProductSessionRef, setCurrentProductSession, setIsAIAssembling, setProductTree } = deps;
  return useCallback(async (sessionId?: string): Promise<void> => {
    setIsAIAssembling(true);
    try {
      /*
       * THE STAGE'S ELEMENT MUST EXIST BEFORE THE TREE NAMES IT — found by driving, 2026-10-03:
       * the room assembled and the stage drew a refusal sentence ABOUT ITSELF ("Resolved to
       * <draft-canvas>, which no element defines — nothing was drawn"). The Composer's draft
       * view awaits this same lazy import before its tree-write (`loadDraftElements`, whose own
       * note states the rule); the product path now does the same. A failure here throws before
       * any tree is set, so the room never draws a stage it cannot fill.
       */
      await loadDraftElements();
      /*
       * WITH NO ID THE SERVER IS THE DOOR: `render-product` alone is the room's own
       * get-or-create — the most recent product package, or one born for this arrival
       * (the console room's and the design room's own shape). The tab click sends exactly
       * that; a card click sends the package it opened.
       */
      const response = await apiFetch(`${API_BASE}/ai/assemble-surface`, {
        method: "POST",
        body: JSON.stringify({ intent: sessionId ? `render-product:${sessionId}` : "render-product" }),
      });
      const rawData = await response.json();
      const read = readA2UIEnvelope(rawData);
      if (read.ok === false) {
        console.error(`🤖 [A2UI] ENVELOPE REFUSED for render-product — ${read.refusal.code}: ${read.refusal.message}`);
        throw envelopeRefusalError(read.refusal);
      }
      const reading = read.reading;
      /*
       * THE SESSION'S OWN REGISTRY LOADS BEFORE THE TREE NAMES ANY COMPONENT — and since
       * 2026-10-03 this load is LOAD-BEARING, not a courtesy. By the owner's wall
       * (PLANS.AGENT/multiple-catalogs.md §10) an ingested system's names are no longer in the
       * app's allowlist; `resolveTag` reads the CHOSEN system's own table (the partition's
       * fetched registry.json). Found by driving minutes after the wall went in: the stage drew
       * *"The catalogue does not know \"ag-select\""* for a session whose own registry maps it —
       * the map was never fetched on this path (the Composer's draft view has awaited this since
       * the step that built it; `showDraftColumn`). ABSENT IS A REAL ANSWER — no system chosen
       * means the app's own tables resolve the draft. A load that FAILS throws BEFORE the tree
       * is set, so the room never draws a stage whose names it could not resolve.
       */
      const chosenSystem = String(
        ((reading.dataModel as Record<string, any>)?.session?.design_system) || '',
      );
      if (chosenSystem) await loadSystemRegistry(chosenSystem);
      setProductTree({
        components: reading.components as any[],
        dataModel: reading.dataModel as Record<string, any>,
      });
      const productSession = (reading.dataModel as Record<string, any>)?.session ?? null;
      setCurrentProductSession(productSession);
      currentProductSessionRef.current = productSession;
      window.requestAnimationFrame(() => {
        const kind = productSession?.session_id ? 'resume' : 'blank';
        const forSeat = productSession?.session_id ?? null;
        markArrival(kind, forSeat);
        window.dispatchEvent(new CustomEvent('a2ui:composer-opened', {
          detail: { kind, sessionId: forSeat },
        }));
      });
    } finally {
      setIsAIAssembling(false);
    }
  }, []);
}
