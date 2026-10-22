/**
 * PRODUCT ENGINE PROBE — asks the builder whether it is up, returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The declaration's text is unchanged and the hook returns it, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { API_BASE } from '@/shared/apiHelper';

/** Exactly what the function needs from the shell, by name. */
export interface UseCheckBuilderEngineDeps {
  setBuilderEngineDown: any;
}

export function useCheckBuilderEngine(deps: UseCheckBuilderEngineDeps) {
  const { setBuilderEngineDown } = deps;
  async function checkBuilderEngine(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/builder/health`);
      const body = await res.json();
      setBuilderEngineDown(!body?.ok);
    } catch {
      setBuilderEngineDown(true);
    }
  }

  return checkBuilderEngine;
}
