/**
 * PRODUCT DRAFT — the product room's draft effect (node moved / added / selected / cleared), moved out of the shell verbatim. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
import { API_BASE } from '@/shared/apiHelper';
import { useEffect } from 'react';
import type { DraftPayloadShape } from './types';

/** Exactly what the block needs from the shell, by name. */
export interface UseProductDraftDeps {
  currentProductSessionRef: any;
  productArtifactRef: any;
  productDraftPayloadRef: any;
  productSelectedNodeRef: any;
  sayInThread: any;
  writeProductArtifactPayload: any;
  writeProductDraftPayload: any;
}

export function useProductDraft(deps: UseProductDraftDeps) {
  const { currentProductSessionRef, productArtifactRef, productDraftPayloadRef, productSelectedNodeRef, sayInThread, writeProductArtifactPayload, writeProductDraftPayload } = deps;
  useEffect(() => {
    const onProductDraftNodeMoved = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as {
        nodeId?: unknown; x?: unknown; y?: unknown;
      };
      const nodeId = typeof detail.nodeId === 'string' ? detail.nodeId : '';
      const at = (typeof detail.x === 'number' && typeof detail.y === 'number')
        ? { x: detail.x, y: detail.y }
        : null;
      const payload = productDraftPayloadRef.current as DraftPayloadShape | null;
      if (!nodeId || !at || !payload) return;
      const next: DraftPayloadShape = {
        ...payload,
        positions: { ...(payload.positions ?? {}), [nodeId]: at },
      };
      productDraftPayloadRef.current = next;
      // The model follows the drag immediately — the payload and the drawing stay one fact.
      writeProductDraftPayload(next);
      const conversationId = String((currentProductSessionRef.current?.conversation_id) || '');
      if (!conversationId) {
        sayInThread('That drag was not saved: this wireframe session has no conversation to keep its draft in.');
        return;
      }
      void (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            },
          );
          if (!res.ok) {
            const refused = (await res.json().catch(() => null)) as { detail?: string } | null;
            throw new Error(String(refused?.detail || `HTTP ${res.status}`));
          }
        } catch (err) {
          sayInThread(
            'That drag was not saved to this conversation: '
            + `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    };
    const onProductDraftNodeAdded = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as {
        nodeId?: unknown; component?: unknown; x?: unknown; y?: unknown;
      };
      const nodeId = typeof detail.nodeId === 'string' ? detail.nodeId : '';
      const component = typeof detail.component === 'string' ? detail.component : '';
      const at = (typeof detail.x === 'number' && typeof detail.y === 'number')
        ? { x: detail.x, y: detail.y }
        : null;
      if (!nodeId || !component || !at) return;
      /*
       * AN ADD ON AN EMPTY STAGE IS A REAL PAYLOAD'S FIRST NODE — no draft row exists yet, so
       * the base is built here in the store's own shape. The element announced; the host folds
       * and writes (one write, at the gesture's end), and the model the element draws follows.
       * THE NAME IS NOT RE-CHECKED HERE: the tray's list IS the server-computed palette, so a
       * name it cannot offer cannot arrive — and if one ever did, the stage draws the
       * catalogue's refusal sentence on the node rather than this handler inventing a rule.
       */
      const payload = (productDraftPayloadRef.current as DraftPayloadShape | null) ?? { nodes: [], positions: {} };
      if (payload.nodes.some((n) => (n as Record<string, unknown>).id === nodeId)) return;
      const next: DraftPayloadShape = {
        ...payload,
        nodes: [...payload.nodes, { id: nodeId, component }],
        positions: { ...(payload.positions ?? {}), [nodeId]: at },
      };
      productDraftPayloadRef.current = next;
      writeProductDraftPayload(next);
      const conversationId = String((currentProductSessionRef.current?.conversation_id) || '');
      if (!conversationId) {
        sayInThread('That component was not saved: this wireframe session has no conversation to keep its draft in.');
        return;
      }
      void (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            },
          );
          if (!res.ok) {
            const refused = (await res.json().catch(() => null)) as { detail?: string } | null;
            throw new Error(String(refused?.detail || `HTTP ${res.status}`));
          }
        } catch (err) {
          sayInThread(
            'That component was not saved to this conversation: '
            + `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    };
    /*
     * AND THE SELECTION IS TRACKED, NOT WRITTEN — the stage's own `draft-select` (one node id,
     * or null on an empty click) keeps this room's answer to "which tile did the person pick".
     * It is what a scoped edit names; nothing persists it and nothing draws it (the canvas
     * already draws its own selection).
     */
    const onProductDraftSelect = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { nodeId?: unknown };
      productSelectedNodeRef.current =
        typeof detail.nodeId === 'string' && detail.nodeId ? detail.nodeId : null;
    };
    /*
     * AND THE STAGE CAN BE EMPTIED BY HAND — the rail's Clear announces `draft-cleared` and
     * the HOST writes the empty layout through the same one draft store every other write
     * goes through (the spoken "clear the stage" already lands there via the compile — one
     * fact, both hands, one writer). Nothing rides the event: an empty stage is the host's
     * payload, not the element's opinion. The selection goes with the stage — a stale node id
     * on an empty stage would make the next scoped action name a tile that no longer exists.
     */
    const onProductDraftCleared = () => {
      const conversationId = String(currentProductSessionRef.current?.conversation_id || '');
      if (!conversationId) {
        sayInThread('The stage was not cleared: this wireframe session has no conversation to keep its draft in.');
        return;
      }
      const next: DraftPayloadShape = { nodes: [], positions: {} };
      productDraftPayloadRef.current = next;
      productSelectedNodeRef.current = null;
      writeProductDraftPayload(next);
      void (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            },
          );
          if (!res.ok) {
            const refused = (await res.json().catch(() => null)) as { detail?: string } | null;
            throw new Error(String(refused?.detail || `HTTP ${res.status}`));
          }
        } catch (err) {
          sayInThread(
            'The stage was not cleared: '
            + `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    };
    window.addEventListener('draft-node-moved', onProductDraftNodeMoved);
    window.addEventListener('draft-node-added', onProductDraftNodeAdded);
    window.addEventListener('draft-select', onProductDraftSelect);
    window.addEventListener('draft-cleared', onProductDraftCleared);
    /*
     * AND THE PAGE CAN BE EMPTIED BY HAND — the artifact stage's rail announces
     * `artifact-cleared`, and the HOST empties the sandbox (the page is in-session; there is
     * no store to write). One fact, both hands: the spoken "clear the stage" empties it
     * through the same build route — an empty artifact.
     */
    const onArtifactCleared = () => {
      productArtifactRef.current = null;
      writeProductArtifactPayload(null);
    };
    window.addEventListener('artifact-cleared', onArtifactCleared);
    return () => {
      window.removeEventListener('draft-node-moved', onProductDraftNodeMoved);
      window.removeEventListener('draft-node-added', onProductDraftNodeAdded);
      window.removeEventListener('draft-select', onProductDraftSelect);
      window.removeEventListener('draft-cleared', onProductDraftCleared);
      window.removeEventListener('artifact-cleared', onArtifactCleared);
    };
  }, [writeProductDraftPayload, writeProductArtifactPayload, sayInThread]);
}
