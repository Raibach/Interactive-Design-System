/**
 * THE GOVERNANCE ROOM'S OWN SURFACE DOOR — UNWIRED, AND THE ROOM'S NOW.
 *
 * The owner, 2026-10-22: *"there's no reason to have an assembly that we present and then load the
 * applications assembly. We only need the applications assembly so take our assembly process off
 * of governance."* The room opens on the embedded application's own loader; this door is NOT
 * called. It stays because the ledger surface may return, and a deleted door is not this room's
 * decision to make alone.
 *
 * MOVED OUT OF THE SHELL (2026-10-24): `assembleGovernanceSurface`, the tree it wrote and the dead
 * renderer effect were the last governance surface code in `pages/WritingAreaIndex.tsx`. They live
 * here now. The shell mounts the room; the room owns the door. The renderer ref is not attached
 * until a surface returns.
 *
 * THE TELEMETRY APPLICATION IS NOT THIS FILE. It lives in `governance/langfuse-main` and is framed
 * by `GovernanceRoom`. This is an optional A2UI surface, not the monitor.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

import { API_BASE } from '@/shared/apiHelper';
import { apiFetch } from '@/shared/apiFetch';
import { envelopeRefusalError, readA2UIEnvelope } from '@/shared/a2ui-envelope';
import { markArrival } from '@/shared/arrival';

export type GovernanceTree = {
  components: any[];
  dataModel: Record<string, any>;
};

export function useGovernanceSurface() {
  const [governanceTree, setGovernanceTree] = useState<GovernanceTree>({
    components: [],
    dataModel: {},
  });
  const governanceRendererRef = useRef<any>(null);
  const [assembling, setAssembling] = useState(false);

  /* THE ROOM'S RENDERER, WHEN A SURFACE RETURNS. The shell's effect moved here with the tree; it
     stays quiet while the ref is unattached. */
  useEffect(() => {
    const el = governanceRendererRef.current;
    if (!el) return;
    el.components = governanceTree.components;
    el.dataModel = governanceTree.dataModel;
  }, [governanceTree]);

  /**
   * THE GOVERNANCE SURFACE'S DOOR — `render-governance`. The room is a container, not a package,
   * so the call carries no session id. It writes this room's tree and announces the arrival; the
   * shell's shared assembling flag is not touched. This function is not called by the room yet.
   */
  const assembleGovernanceSurface = useCallback(async (): Promise<void> => {
    setAssembling(true);
    try {
      const response = await apiFetch(`${API_BASE}/ai/assemble-surface`, {
        method: 'POST',
        body: JSON.stringify({ intent: 'render-governance' }),
      });
      const rawData = await response.json();
      const read = readA2UIEnvelope(rawData);
      if (read.ok === false) {
        console.error(
          `🤖 [A2UI] ENVELOPE REFUSED for render-governance — ${read.refusal.code}: ${read.refusal.message}`,
        );
        throw envelopeRefusalError(read.refusal);
      }
      const reading = read.reading;
      setGovernanceTree({
        components: reading.components as any[],
        dataModel: reading.dataModel as Record<string, any>,
      });
      const governanceSession = (reading.dataModel as Record<string, any>)?.session ?? null;
      window.requestAnimationFrame(() => {
        const kind = governanceSession?.session_id ? 'resume' : 'blank';
        const forSeat = governanceSession?.session_id ?? null;
        markArrival(kind, forSeat);
        window.dispatchEvent(
          new CustomEvent('a2ui:composer-opened', {
            detail: { kind, sessionId: forSeat },
          }),
        );
      });
    } finally {
      setAssembling(false);
    }
  }, []);

  return { governanceTree, governanceRendererRef, assembleGovernanceSurface, assembling };
}
