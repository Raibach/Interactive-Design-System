/**
 * THE GOVERNANCE ROOM'S TRACE READ — the room's own.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` (2026-10-24) with the room's container. It reads
 * the selected trace through the embedded application's own source, writes the three trace
 * views and the seat's facts, and reads the selected node's I/O. The shell no longer holds
 * the selection, the views or the package link.
 */
import { useEffect } from 'react';

import { assignProps } from '@/components/lit/a2ui-renderer';
import {
  fetchGovObservationCommentCounts,
  fetchGovObservationIO,
  fetchGovTrace,
  fetchGovTraceScores,
  observationWindow,
  type GovTraceBundle,
  type GovTraceScore,
} from '@/lib/governance-trace-source';
import { getStoredUserId } from '@/services/authService';
import { API_BASE } from '@/shared/apiHelper';

export type GovernanceTraceSig = {
  projectId: string;
  traceId: string;
  obsId: string | null;
  timestampIso: string | null;
  peekId: string | null;
};

export type GovernanceTraceEls = {
  header: HTMLElement;
  tree: HTMLElement;
  detail: HTMLElement;
};

export type GovernanceTraceSel = {
  bundle: GovTraceBundle | null;
  traceId: string | null;
  obsId: string | null;
  appliedObsId: string | null;
  peekId: string | null;
  scores: GovTraceScore[] | null;
  commentCounts: Record<string, number> | null;
  els: GovernanceTraceEls | null;
};

export interface UseGovernanceTraceDeps {
  governanceTraceSig: GovernanceTraceSig | null;
  governanceTraceElsTick: number;
  setGovernanceTraceElsTick: (updater: (n: number) => number) => void;
  governanceTraceElsRef: { current: GovernanceTraceEls | null };
  governanceTraceSelRef: { current: GovernanceTraceSel };
  governanceSeatRef: { current: any };
  governanceSectionPrefix: () => string;
  governanceComposerPackageRef: { current: string };
}

export function useGovernanceTrace({
  governanceTraceSig,
  governanceTraceElsTick,
  setGovernanceTraceElsTick,
  governanceTraceElsRef,
  governanceTraceSelRef,
  governanceSeatRef,
  governanceSectionPrefix,
  governanceComposerPackageRef,
}: UseGovernanceTraceDeps) {
  useEffect(() => {
    const sig = governanceTraceSig;
    if (!sig) return;
    const els = governanceTraceElsRef.current;
    if (!els) {
      /* THE VIEWS ARE NOT REGISTERED YET — wait for the mount, then apply. Never a silent
         drop: without this the selection was lost and the tree stayed blank. */
      const retry = window.setTimeout(() => setGovernanceTraceElsTick((n) => n + 1), 400);
      return () => window.clearTimeout(retry);
    }
    let cancelled = false;
    void (async () => {
      try {
        const base = `${window.location.origin}${governanceSectionPrefix()}`;
        const sel = governanceTraceSelRef.current;
        let bundle = sel.bundle;
        let traceChanged = false;
        if (!bundle || bundle.trace.id !== sig.traceId) {
          bundle = await fetchGovTrace(base, sig.projectId, sig.traceId, sig.timestampIso, sig.obsId);
          if (cancelled) return;
          sel.bundle = bundle;
          sel.traceId = sig.traceId;
          sel.peekId = sig.peekId ?? null;
          traceChanged = true;
          assignProps(els.header, { trace: bundle.trace, observation: null });
          assignProps(els.tree, { trace: bundle.trace, observations: bundle.observations, selectedId: null });
          assignProps(els.detail, { trace: bundle.trace, observation: null, io: null, observations: bundle.observations });
          const seatForFacts = governanceSeatRef.current;
          if (seatForFacts) {
            assignProps(seatForFacts, { governanceTrace: bundle.trace, governanceObservation: null, disabledTabs: '' });
          }
          const maybePackage = bundle.trace.sessionId;
          void (async () => {
            let packageId = '';
            if (maybePackage && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maybePackage)) {
              try {
                const res = await fetch(`${API_BASE}/prompt-sessions/${encodeURIComponent(maybePackage)}`, {
                  headers: { 'X-User-ID': getStoredUserId() },
                });
                if (res.ok) packageId = maybePackage;
              } catch {
                /* the button simply does not draw — no package claim without one */
              }
            }
            if (cancelled) return;
            governanceComposerPackageRef.current = packageId;
            const seatElse = governanceSeatRef.current;
            if (seatElse) assignProps(seatElse, { composerPackageId: packageId });
          })();
        }
        if (traceChanged) {
          void (async () => {
            try {
              const [scores, commentCounts] = await Promise.all([
                fetchGovTraceScores(base, sig.projectId, sig.traceId, sig.timestampIso),
                fetchGovObservationCommentCounts(base, sig.projectId),
              ]);
              if (cancelled) return;
              sel.scores = scores;
              sel.commentCounts = commentCounts;
              assignProps(els.tree, { scores, commentCounts });
              assignProps(els.detail, { scores });
            } catch (err) {
              if (!cancelled) console.error('[governance trace] extras read failed:', err);
            }
          })();
        }
        const rootDefault = bundle.observations.find((o) => !o.parentObservationId)
          ?? bundle.observations[0]
          ?? null;
        const appRoot = sig.peekId && bundle.observations.some((o) => o.id === sig.peekId)
          ? sig.peekId
          : null;
        const obsId = sig.obsId ?? appRoot ?? rootDefault?.id ?? null;
        sel.obsId = obsId;
        if (!traceChanged && sel.els === els && sel.appliedObsId === obsId) return;
        const observation = obsId ? (bundle.observations.find((o) => o.id === obsId) ?? null) : null;
        assignProps(els.header, { trace: bundle.trace, observation });
        assignProps(els.tree, {
          trace: bundle.trace,
          observations: bundle.observations,
          selectedId: observation?.id ?? null,
        });
        assignProps(els.detail, { trace: bundle.trace, observation, io: observation ? undefined : null });
        const seatForNode = governanceSeatRef.current;
        if (seatForNode) {
          assignProps(seatForNode, { governanceTrace: bundle.trace, governanceObservation: observation, disabledTabs: '' });
        }
        sel.els = els;
        sel.appliedObsId = obsId;
        if (!observation) return;
        const win = observationWindow(bundle.observations);
        if (!win) return;
        const io = await fetchGovObservationIO(base, sig.projectId, sig.traceId, observation.id, win.start, win.end);
        if (cancelled) return;
        assignProps(els.detail, { trace: bundle.trace, observation, io });
      } catch (err) {
        /* SAID OUT LOUD with its real reason — the views stay waiting, never fake. */
        if (!cancelled) console.error('[governance trace] read failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [governanceTraceSig, governanceTraceElsTick]);
}
