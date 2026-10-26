/**
 * THE COMPOSER'S RUN-STATE WRITE — the place the run left, read off the Composer's own elements
 * and written to the package's row.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` on 2026-10-24 (Stage 2c.3) verbatim. The shell calls
 * the hook with the two refs and keeps the same names until the run pipeline follows.
 */
import { API_BASE } from '@/shared/apiHelper';
import { deepFind } from '@/canvas/pageHelpers';
import { getStoredUserId } from '@/services/authService';
import { logger } from '@/lib/logger';

export interface ComposerRunStateDeps {
  currentPromptSessionRef: { current: string | null };
  assembledRunColumnRef: { current: unknown[] | null };
}

export function useComposerRunState({
  currentPromptSessionRef,
  assembledRunColumnRef,
}: ComposerRunStateDeps) {
  /**
   * THE PLACE, AS THE OPERATOR LEFT IT — read off the elements that own it, ONCE, for both
   * writers of `metadata.workspace`: the Save (which sends it with everything else) and the
   * Run's own state write (saveRunState — owner, 2026-10-05: *"it has already RUN and that
   * state should save on run"*).
   *
   * READ OFF THE ELEMENTS — the left column from <composer-workspace>, her seat and the
   * drawing's pan and zoom from <room-embed>, the drawing itself from <agent-flow>. Not a
   * new event and not a new prop: the components already publish these (leftCollapsed is a
   * property; the plug-in answers workspaceState()), and a save is a read, not a gesture. A
   * piece that is not on screen is simply absent, and the server keeps what it had
   * (metadata merges key-by-key at the top; see update_session).
   *
   * AND IT IS A SHADOW-PIERCING READ, which was the correction: `document.querySelector`
   * reaches nothing here — the shell draws the surface INSIDE the renderer's shadow root —
   * so both of these were null on every save and the place never travelled, silently.
   * A null was indistinguishable from "the view is not open", which is why it took the
   * same helper the flow's link needed to make the two reads real.
   */
  const readWorkspaceState = (): Record<string, unknown> | undefined => {
    const layout = deepFind<HTMLElement & { leftCollapsed?: boolean }>('composer-workspace');
    const canvas = deepFind<HTMLElement & { workspaceState?: () => Record<string, unknown> }>('room-embed');
    const state: Record<string, unknown> = {};
    if (layout) state.leftCollapsed = !!layout.leftCollapsed;
    const canvasState = canvas?.workspaceState?.();
    if (canvasState) Object.assign(state, canvasState);
    // WHICH MIDDLE VIEW THE PACKAGE WAS LEFT ON — a package saved while the canvas was
    // up reopens on the canvas; one saved on the output reopens on the output. The
    // element's presence is the fact: Run mounts the canvas, Reset unmounts it.
    if (canvas) state.middle = 'flow';
    else if (deepFind('compiled-output-viewer')) state.middle = 'output';
    // THE DRAWING AS IT WAS LEFT — the element's drawn graph carries the person's own
    // edits (positions dragged, nodes added, edges rewired), which the published model
    // does not. The label and the not-drawn lists come from the model the element holds.
    //
    // `drawn` IS A GETTER, NOT A METHOD (agent-flow.ts). A value is read; it is not called.
    const flowEl = deepFind<HTMLElement & {
      flow?: { label?: string; unresolved?: string[]; absent?: unknown[] };
      drawn?: { nodes: unknown[]; edges: unknown[] };
    }>('agent-flow');
    const drawn = flowEl?.drawn;
    if (drawn) {
      state.graph = {
        label: flowEl?.flow?.label ?? '',
        nodes: drawn.nodes,
        edges: drawn.edges,
        unresolved: flowEl?.flow?.unresolved ?? [],
        absent: flowEl?.flow?.absent ?? [],
      };
    }
    /*
     * THE COLUMN THE RUN ASSEMBLED — the drawing's own components, kept WITH the state that
     * shows them (owner, 2026-10-05). The saved `middle` says WHICH view; the graph says
     * what the picture holds; this says what the picture is MADE OF — the five components a
     * Run's assembly put in the middle column. Without it a reopened package can know it
     * has run and still draw nothing (the column only ever arrived from a Run's model call),
     * and re-drawing it would be a fresh model call per open — the second call per Run this
     * app already paid for and removed. The ref is fed by the Run the moment its column
     * arrives, and by the open the moment a saved column is put back.
     */
    const runColumn = assembledRunColumnRef.current;
    if (Array.isArray(runColumn) && runColumn.length) {
      state.run_column = { components: runColumn };
    }
    return Object.keys(state).length ? state : undefined;
  };

  /**
   * THE RUN'S STATE, WRITTEN THE MOMENT THE RUN IS — the narrow write (owner, 2026-10-05:
   * *"it has already RUN and that state should save on run"*).
   *
   * IT WRITES ONLY `metadata.workspace`. Not the sections, not the output, not the
   * description: content stays the operator's Save to make (the owner's rule, 2026-09-18),
   * and the full save path pays for a model summary.
   *
   * A CARD, NOT A SCRATCH PROMPT: the write needs a session id. An unsaved prompt has no
   * row for a state to live in; its manual Save still carries the same state when made.
   *
   * THE DRAWING IS WAITED FOR, BOUNDED, ON A REAL CONDITION. The answer and the assembly
   * are two independent waits (two model calls), so the response can land before the canvas
   * mounts; a write at that moment would store "ran, nothing to show" — the half-record
   * this change exists to prevent. The wait ends when the state HAS its drawing (middle
   * 'flow' + a graph), or when the bound runs out — and a bound that runs out is said, in
   * the trace, never swallowed.
   *
   * FAILURES ARE SAID, NOT SWALLOWED (logger → the Trace tab): a state write that fails
   * silently is the reopened package that "forgot" it ran.
   */
  const saveRunState = async (): Promise<void> => {
    const sessionId = currentPromptSessionRef.current;
    if (!sessionId) return;
    const deadline = Date.now() + 25_000;
    let workspace = readWorkspaceState();
    while (
      (!workspace || workspace.middle !== 'flow' || !workspace.graph)
      && Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 250));
      workspace = readWorkspaceState();
    }
    if (!workspace || workspace.middle !== 'flow' || !workspace.graph) {
      logger.error('the run state never formed, so nothing was saved for it', { sessionId });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/prompt-sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({ metadata: { workspace } }),
      });
      if (!res.ok) {
        logger.error('the run state could not be saved on the package', { sessionId, status: res.status });
        return;
      }
      console.log('[run] state saved on the package —', JSON.stringify(Object.keys(workspace)));
    } catch (e) {
      logger.error('the run state write never reached the backend', { sessionId, error: String(e) });
    }
  };

  return { readWorkspaceState, saveRunState };
}
