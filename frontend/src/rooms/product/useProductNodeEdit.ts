/**
 * PRODUCT NODE EDIT — the product room's node-edit effect: guards the selection, edits the draft payload, and speaks a refusal in the thread. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
import { API_BASE } from '@/shared/apiHelper';
import { type DraftPayloadShape } from '@/rooms/product/types';
import { apiFetch } from '@/shared/apiFetch';
import { useEffect } from 'react';

/** Exactly what the block needs from the shell, by name. */
export interface UseProductNodeEditDeps {
  currentProductSessionRef: any;
  productDraftPayloadRef: any;
  productSelectedNodeRef: any;
  sayInThread: any;
  writeProductDraftPayload: any;
}

export function useProductNodeEdit(deps: UseProductNodeEditDeps) {
  const { currentProductSessionRef, productDraftPayloadRef, productSelectedNodeRef, sayInThread, writeProductDraftPayload } = deps;
  useEffect(() => {
    const onEditNode = () => {
      const session = currentProductSessionRef.current;
      const sessionId = String(session?.session_id || '');
      const nodeId = String(productSelectedNodeRef.current || '');
      if (!sessionId) {
        sayInThread('I cannot change a tile yet: this room has not opened a package.');
        return;
      }
      if (!nodeId) {
        sayInThread('Click the tile you want changed first — I edit the one you select.');
        return;
      }
      void (async () => {
        try {
          const res = await apiFetch(`${API_BASE}/ai/edit-node`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              conversation_id: String(session?.conversation_id || ''),
              node_id: nodeId,
            }),
          });
          const payload = (await res.json().catch(() => null)) as
            | { layout?: unknown; say?: unknown; detail?: string }
            | null;
          if (!res.ok) {
            sayInThread(String(payload?.detail || `The change was refused: HTTP ${res.status}`));
            return;
          }
          const layout = payload?.layout as DraftPayloadShape | undefined;
          if (!layout || !Array.isArray(layout.nodes)) {
            sayInThread('The change came back without a layout — nothing was written.');
            return;
          }
          productDraftPayloadRef.current = layout;
          writeProductDraftPayload(layout);
          const target = String(
            currentProductSessionRef.current?.conversation_id || session?.conversation_id || '',
          );
          if (!target) {
            sayInThread('The change landed here but could not be saved: this session has no conversation to keep its draft in.');
            return;
          }
          const put = await fetch(
            `${API_BASE}/conversations/${encodeURIComponent(target)}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(layout),
            },
          );
          if (!put.ok) {
            const refused = (await put.json().catch(() => null)) as { detail?: string } | null;
            throw new Error(String(refused?.detail || `HTTP ${put.status}`));
          }
          const said = String(payload?.say || '').trim();
          if (said) sayInThread(said);
        } catch (err) {
          sayInThread(
            'The change did not complete: '
            + `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    };
    window.addEventListener('a2ui:edit-node', onEditNode);
    return () => window.removeEventListener('a2ui:edit-node', onEditNode);
  }, [sayInThread, writeProductDraftPayload]);
}
