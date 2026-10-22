/**
 * PRODUCT ARTIFACT WRITE — persists the product room's artifact string through the engine, returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { useCallback } from 'react';

/** Exactly what the callback needs from the shell, by name. */
export interface UseWriteProductArtifactPayloadDeps {
  setProductTree: any;
}

export function useWriteProductArtifactPayload(deps: UseWriteProductArtifactPayloadDeps) {
  const { setProductTree } = deps;
  return useCallback((artifact: string | null): void => {
    setProductTree((prev) => {
      const model = { ...((prev.dataModel ?? {}) as Record<string, any>) };
      const session = { ...((model.session ?? {}) as Record<string, any>) };
      session.artifact = artifact;
      model.session = session;
      return { ...prev, dataModel: model };
    });
  }, []);
}
