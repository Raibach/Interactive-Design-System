/**
 * PRODUCT EXIT GUARD — the product room's exit guard (asks the engine whether work is at risk), returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The declaration's text is unchanged and the hook returns it, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';

/** Exactly what the function needs from the shell, by name. */
export interface UseGuardProductExitDeps {
  discardProductProject: any;
  hasUnsavedChangesRef: any;
  productRoomProjectId: any;
  setLeavePrompt: any;
  setProductRoomProjectId: any;
}

export function useGuardProductExit(deps: UseGuardProductExitDeps) {
  const { discardProductProject, hasUnsavedChangesRef, productRoomProjectId, setLeavePrompt, setProductRoomProjectId } = deps;
  async function guardProductExit(): Promise<boolean> {
    const bridgeProjectId = productRoomProjectId;
    if (!bridgeProjectId) return true;
    let published = true;
    let hasWork = false;
    try {
      const res = await fetch(`${API_BASE}/builder/state?project_id=${encodeURIComponent(bridgeProjectId)}`);
      const body = await res.json();
      if (body?.ok) {
        published = Boolean(body.published);
        hasWork = Boolean(body.has_work);
      }
    } catch { /* unreadable → leave freely (see the note above) */ }
    // A PUBLISHED PROJECT IS SAFE — its card holds everything — and a BLANK one is dropped in
    // silence. Either way nothing remains unsaved, and the exit gate's same ref is told so
    // (see the beforeunload effect): the room and the Composer keep ONE truth.
    if (published) {
      hasUnsavedChangesRef.current = false;
      return true;
    }
    if (!hasWork) {
      await discardProductProject(bridgeProjectId);
      hasUnsavedChangesRef.current = false;
      setProductRoomProjectId(null);
      return true;
    }
    const choice = await new Promise<'publish' | 'discard' | 'keep' | 'stay'>((resolve) => {
      setLeavePrompt({
        projectId: bridgeProjectId,
        settle: (chosen) => {
          setLeavePrompt(null);
          resolve(chosen);
        },
      });
    });
    if (choice === 'stay') return false;
    if (choice === 'publish') {
      try {
        await fetch(`${API_BASE}/builder/publish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ project_id: bridgeProjectId }),
        });
      } catch { /* the card simply stays absent until a publish succeeds */ }
    } else if (choice === 'keep') {
      try {
        await fetch(`${API_BASE}/builder/projects/${encodeURIComponent(bridgeProjectId)}/keep`, {
          method: 'POST',
          headers: { 'X-User-ID': getStoredUserId() },
        });
      } catch { /* the project stays held — the next room entry reopens it; nothing is lost */ }
    } else {
      await discardProductProject(bridgeProjectId);
    }
    // SAVED AS A DRAFT, PUBLISHED, OR DISCARDED — resolved; nothing is at risk anymore.
    hasUnsavedChangesRef.current = false;
    setProductRoomProjectId(null);
    return true;
  }

  return guardProductExit;
}
