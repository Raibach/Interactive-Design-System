/**
 * PRODUCT OPEN — the product room's open/resume handoff, returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The declaration's text is unchanged and the hook returns it, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';

/** Exactly what the function needs from the shell, by name. */
export interface UseOpenProductRoomDeps {
  creatingProductProjectRef: any;
  setBuilderEngineDown: any;
  setProductRoomProjectId: any;
}

export function useOpenProductRoom(deps: UseOpenProductRoomDeps) {
  const { creatingProductProjectRef, setBuilderEngineDown, setProductRoomProjectId } = deps;
  async function openProductRoom(): Promise<void> {
    if (creatingProductProjectRef.current) return;
    creatingProductProjectRef.current = true;
    try {
      const res = await fetch(`${API_BASE}/builder/room`, {
        method: 'POST',
        headers: { 'X-User-ID': getStoredUserId() },
      });
      const body = await res.json();
      if (body?.ok && body?.project_id) {
        setBuilderEngineDown(false);
        setProductRoomProjectId(String(body.project_id));
      } else if (body?.error === 'engine unreachable') {
        setBuilderEngineDown(true);
      }
    } catch {
      setBuilderEngineDown(true);
    } finally {
      creatingProductProjectRef.current = false;
    }
  }

  return openProductRoom;
}
