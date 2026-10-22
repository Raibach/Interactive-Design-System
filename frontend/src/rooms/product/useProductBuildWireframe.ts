/**
 * PRODUCT BUILD WIREFRAME — the product room's build effect: assembles the wireframe, writes the draft payload, and saves it to the conversation. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
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
export interface UseProductBuildWireframeDeps {
  currentProductSessionRef: any;
  productDraftPayloadRef: any;
  sayInThread: any;
  writeProductDraftPayload: any;
}

export function useProductBuildWireframe(deps: UseProductBuildWireframeDeps) {
  const { currentProductSessionRef, productDraftPayloadRef, sayInThread, writeProductDraftPayload } = deps;
  useEffect(() => {
    const onBuildWireframe = () => {
      const session = currentProductSessionRef.current;
      const sessionId = String(session?.session_id || '');
      if (!sessionId) {
        sayInThread('I cannot build yet: this room has not opened a package.');
        return;
      }
      void (async () => {
        try {
          const res = await apiFetch(`${API_BASE}/ai/assemble-wireframe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_id: sessionId,
              conversation_id: String(session?.conversation_id || ''),
            }),
          });
          const payload = (await res.json().catch(() => null)) as
            | { nodes?: unknown; positions?: unknown; say?: unknown; detail?: string }
            | null;
          if (!res.ok) {
            sayInThread(String(payload?.detail || `The build was refused: HTTP ${res.status}`));
            return;
          }
          const base = (productDraftPayloadRef.current as DraftPayloadShape | null) ?? { nodes: [] };
          const next: DraftPayloadShape = {
            ...(base.label ? { label: base.label } : {}),
            nodes: Array.isArray(payload?.nodes) ? (payload?.nodes as DraftPayloadShape['nodes']) : [],
            positions: (payload?.positions ?? {}) as DraftPayloadShape['positions'],
          };
          // The stage follows the build immediately — the payload and the drawing stay one fact.
          productDraftPayloadRef.current = next;
          writeProductDraftPayload(next);
          const target = String(
            currentProductSessionRef.current?.conversation_id || session?.conversation_id || '',
          );
          if (!target) {
            sayInThread('The build landed here but could not be saved: this session has no conversation to keep its draft in.');
            return;
          }
          const put = await fetch(
            `${API_BASE}/conversations/${encodeURIComponent(target)}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
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
            'The build did not complete: '
            + `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    };
    window.addEventListener('a2ui:build-wireframe', onBuildWireframe);
    return () => window.removeEventListener('a2ui:build-wireframe', onBuildWireframe);
  }, [sayInThread, writeProductDraftPayload]);
}
