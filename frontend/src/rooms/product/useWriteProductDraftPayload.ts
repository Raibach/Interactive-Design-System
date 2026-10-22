/**
 * PRODUCT DRAFT WRITE — persists the product room's draft payload through the engine, returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { useCallback } from 'react';

/** Exactly what the callback needs from the shell, by name. */
export interface UseWriteProductDraftPayloadDeps {
  setProductTree: any;
}

export function useWriteProductDraftPayload(deps: UseWriteProductDraftPayloadDeps) {
  const { setProductTree } = deps;
  return useCallback((payload: unknown): void => {
    setProductTree((prev) => {
      const model = { ...((prev.dataModel ?? {}) as Record<string, any>) };
      const session = { ...((model.session ?? {}) as Record<string, any>) };
      session.draft = payload;
      model.session = session;
      return { ...prev, dataModel: model };
    });
  }, []);
}
