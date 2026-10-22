/**
 * PRODUCT DISCARD — the product room's project discard (DELETE /api/projects/:id), returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The declaration's text is unchanged and the hook returns it, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';

/** Exactly what the function needs from the shell, by name. */
export interface UseDiscardProductProjectDeps {

}

export function useDiscardProductProject(deps: UseDiscardProductProjectDeps) {
  async function discardProductProject(bridgeProjectId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/builder/discard`, {
        method: 'POST',
        // X-User-ID rides every builder call (keep, publish, upload) — the discard's own
        // carrier-row cleanup is user-scoped, so this door names its user too (2026-10-06).
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({ project_id: bridgeProjectId }),
      });
    } catch { /* the engine is down — there is nothing to discard against */ }
  }

  return discardProductProject;
}
