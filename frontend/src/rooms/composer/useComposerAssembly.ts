/**
 * THE COMPOSER'S ASSEMBLY — its own spinner, failure state and decision dialog.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` on 2026-10-24 (Stage 2c.1) with no behavior change.
 * The Composer calls the shared assembly hook with its own state; the Console keeps its own
 * instance in the shell. The decision dialog belongs here because the decision is the package's
 * question: save it, discard it, or stay.
 */
import { useCallback, useRef, useState } from 'react';
import { useAssembleSurface } from '@/console/useAssembleSurface';
import { loadCanvasElements } from '@/canvas/pageHelpers';
import { AI_STANDBY_MESSAGE, ASSEMBLY_TIMEOUT_MS } from '@/shared/assembly';
import { logger } from '@/lib/logger';
import type { FailureReport } from '@/shared/error-registry';

export interface ComposerAssemblyDeps {
  currentPromptSessionRef: { current: string | null };
  setCurrentPromptSession: any;
  setWorkspaceTree: any;
  hasUnsavedChangesRef: { current: boolean };
  repairSectionsRef: { current: any[] | null };
  repairAskRef: { current: { text: string; buttons: string } | null };
  repairTitleRef: { current: string | null };
  headerTabRef: { current: string | null };
  setHeaderTab: (tab: string) => void;
  setConsoleTree: any;
  loadCatalogFindings: () => Promise<void>;
  handleSavePromptRef: { current: (...args: any[]) => Promise<void> };
}

export function useComposerAssembly(deps: ComposerAssemblyDeps) {
  const {
    currentPromptSessionRef,
    setCurrentPromptSession,
    setWorkspaceTree,
    hasUnsavedChangesRef,
    repairSectionsRef,
    repairAskRef,
    repairTitleRef,
    headerTabRef,
    setHeaderTab,
    setConsoleTree,
    loadCatalogFindings,
    handleSavePromptRef,
  } = deps;

  const [isAIAssembling, setIsAIAssembling] = useState(false);
  const [aiAssemblyMessage, setAiAssemblyMessage] = useState(AI_STANDBY_MESSAGE);
  const [aiAssemblyFailed, setAiAssemblyFailed] = useState(false);
  const [aiAssemblyReport, setAiAssemblyReport] = useState<FailureReport | null>(null);
  const [isFailureAcknowledged, setIsFailureAcknowledged] = useState(false);
  const [aiDecision, setAiDecision] = useState<any>(null);

  const consoleAssemblyControllerRef = useRef<AbortController | null>(null);
  const isConsoleAssemblyInFlightRef = useRef(false);
  const lastAssemblyIntentRef = useRef('render-composer');

  const assemble = useAssembleSurface({
    AI_STANDBY_MESSAGE,
    ASSEMBLY_TIMEOUT_MS,
    consoleAssemblyControllerRef,
    currentPromptSessionRef,
    hasUnsavedChangesRef,
    headerTabRef,
    isConsoleAssemblyInFlightRef,
    lastAssemblyIntentRef,
    repairAskRef,
    repairTitleRef,
    setAiAssemblyFailed,
    setAiAssemblyMessage,
    setAiAssemblyReport,
    setAiDecision,
    setConsoleTree,
    setCurrentPromptSession,
    setHeaderTab,
    setIsAIAssembling,
    setIsFailureAcknowledged,
    setWorkspaceTree,
  });

  /**
   * EVERY SURFACE THAT CAN RUN WARMS THE CANVAS — the same order the shell used: warm, assemble,
   * then read the checker's findings. Nothing is awaited for the warm; the surface paints while
   * the ground arrives behind it.
   */
  const assembleThenRepairs = useCallback(async (intent: string, context?: Record<string, unknown>) => {
    if (intent !== 'render-console') {
      void loadCanvasElements().catch((err: unknown) => {
        logger.warn('the canvas was not warmed for this surface — the Run will fetch it again', {
          error: String((err as Error)?.message ?? err),
        });
      });
    }
    await assemble(intent, context);
    await loadCatalogFindings();
  }, [assemble, loadCatalogFindings]);

  const handleAIDecisionAction = useCallback(async (actionId: string) => {
    if (!aiDecision) return;

    const pendingIntent = aiDecision.pending_intent;
    console.log(`🤖 [A2UI] Decision action: ${actionId}, pending intent: ${pendingIntent}`);

    // Close the dialog
    setAiDecision(null);

    if (actionId === 'save') {
      // Save first, then proceed with the pending intent
      try {
        await handleSavePromptRef.current();
        hasUnsavedChangesRef.current = false;
        // Now execute the original intent without unsaved changes context
        await assembleThenRepairs(pendingIntent);
      } catch (error) {
        console.error('🤖 [A2UI] Save failed:', error);
        // Stay on current surface - save failed
      }
    } else if (actionId === 'discard') {
      // Discard changes and proceed with the pending intent
      hasUnsavedChangesRef.current = false;
      await assembleThenRepairs(pendingIntent);
    } else if (actionId === 'cancel') {
      // Stay on the current surface — and DROP whatever was waiting behind this
      // gate. A repair queues its sections and its name BEFORE the gate opens; if
      // cancel left them set, the column would be replaced by the very thing the
      // person just declined.
      repairSectionsRef.current = null;
      repairTitleRef.current = null;
      console.log('🤖 [A2UI] User cancelled navigation — pending repair dropped');
    } else if (aiDecision.decision_type === 'select_category') {
      // Category selection gate — pass chosen category back to render-composer
      console.log(`🤖 [A2UI] Category selected: ${actionId}`);
      await assembleThenRepairs(pendingIntent, { category: actionId });
    }
  }, [aiDecision, assembleThenRepairs, handleSavePromptRef, hasUnsavedChangesRef, repairSectionsRef, repairTitleRef]);

  return {
    isAIAssembling,
    aiAssemblyMessage,
    aiAssemblyFailed,
    aiAssemblyReport,
    isFailureAcknowledged,
    aiDecision,
    handleAIDecisionAction,
    assembleThenRepairs,
    lastAssemblyIntentRef,
    setAiAssemblyFailed,
    setAiAssemblyMessage,
    setAiAssemblyReport,
    setIsFailureAcknowledged,
  };
}
