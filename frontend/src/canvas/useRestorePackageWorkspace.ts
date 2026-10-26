/**
 * RESTORE THE PACKAGE'S WORKSPACE — widths, places, the column it was left in — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged; every name it closes over arrives through `deps`, so the
 * behaviour is the page's own. The dependency list is the contract: a new name in the effect is a
 * compile error here until it is declared in the interface below.
 */
import { applyComponentUpdate } from '@/shared/a2ui-envelope';
import { deepFind, loadCanvasElements } from '@/canvas/pageHelpers';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

/** Exactly what the block needs from the shell, by name. */
export interface UseRestorePackageWorkspaceDeps {
  COLUMN_VIEWS_RUN: any;
  assembledRunColumnRef: any;
  carriedPositionsRef: any;
  currentPromptSession: any;
  currentPromptSessionRef: any;
  setColumnView: any;
  setWorkspaceTree: any;
  storedWidthsRef: any;
  writeFlowToSurface: any;
}

export function useRestorePackageWorkspace(deps: UseRestorePackageWorkspaceDeps) {
  const { COLUMN_VIEWS_RUN, assembledRunColumnRef, carriedPositionsRef, currentPromptSession, currentPromptSessionRef, setColumnView, setWorkspaceTree, storedWidthsRef, writeFlowToSurface } = deps;
  useEffect(() => {
    const stored = currentPromptSession?.workspace;
    storedWidthsRef.current = currentPromptSession?.columnWidths ?? null;
    /*
     * THE PLACES THIS PACKAGE WAS LEFT WITH — read here, where its own save is in hand, and
     * replaced on every open: a package with no graph clears them, so a layout the previous
     * package carried can never be drawn under this one's rows. The places are NOT applied to a
     * drawing here (there is none until a Run — see below); they are held for the builder, which
     * is what draws a Run, and the element's own `drawn` is what writes them back on Save.
     */
    const savedNodes = stored?.graph?.nodes;
    carriedPositionsRef.current = Array.isArray(savedNodes) ? savedNodes : [];
    /*
     * AND THE RUN'S COLUMN RIDES WITH IT (owner, 2026-10-05 — see readWorkspaceState): a
     * package opened on its drawing carries the same column forward, so a manual Save made
     * on the reopened picture re-writes it — `metadata.workspace` is replaced whole by a
     * save (jsonb merges only its top level), so a field read live but not re-fed here
     * would be dropped by the next Save. Cleared on every open: a package with no saved run
     * must never inherit the previous package's column.
     */
    const storedRunColumn = stored?.run_column?.components;
    // THE REF HOLDS THE COLUMN, NOT THE TREE — the same exclusion the run's own write makes.
    // Older saves still carry a root; it is dropped HERE so the next save cannot re-persist it
    // (the replay reads the row's own copy and handles a stored root there).
    assembledRunColumnRef.current = Array.isArray(storedRunColumn)
      ? (storedRunColumn as any[]).filter((c) => c?.component !== 'composer-workspace' && c?.id !== 'root')
      : null;
    /*
     * THE PROMPT IS ON SCREEN WHEN A PACKAGE OPENS, AND THAT DOES NOT DEPEND ON A SAVE.
     *
     * Above the `stored` guard on purpose: an unsaved package, or one whose workspace was never
     * recorded, still has to open with its prompt visible — and the pane may be folded from a
     * Run in the package before this one, because the layout element is reused and the dock
     * marks it operator-owned. See composer-workspace's `openPrompt`, which opens the column and
     * hands the pane's ownership back to the payload in the same act.
     *
     * What the person reported (2026-09-23): "when I open an existing prompt ... the agent
     * prompt area is not expanded. It's collapsed and it makes me think that the prompt text
     * areas are not loading."
     */
    const openThePrompt = (): boolean => {
      const el = deepFind<HTMLElement & {
        openPrompt?: () => void;
        setColumnWidths?: (w: { left?: number | null; chat?: number | null } | null) => void;
      }>('composer-workspace');
      if (!el?.openPrompt) return false;
      // A PACKAGE LOADS WITH ITS COLUMNS EQUAL, AND WITH THE WIDTHS IT WAS SAVED WITH.
      // `openPrompt` puts the split back to the middle and hands the pane to the payload; the
      // saved widths then override it, because an adjustment a person made and SAVED is their
      // decision and outranks the default. The owner, 2026-09-23: "each column for a package is
      // equal width until the user makes adjustments, and then it must remember the user's
      // adjustment. Only on save."
      el.openPrompt();
      el.setColumnWidths?.(currentPromptSessionRef.current ? storedWidthsRef.current : null);
      return true;
    };
    if (!openThePrompt()) {
      // The layout arrives with the surface, so a package opened from a cold start has no
      // element to speak to yet. Same retry the stored view uses below, same give-up.
      let frames = 0;
      const open = () => {
        if (openThePrompt() || ++frames >= 40) return;
        requestAnimationFrame(open);
      };
      requestAnimationFrame(open);
    }
    if (!stored) return;
    /*
     * THE GRAPH COMES BACK — AND THE DRAWING WITH IT WHEN THE PACKAGE HAS RUN (owner,
     * 2026-10-05; the 2026-09-22 rule below NARROWS, it is not contradicted).
     *
     * The owner, 2026-10-05: *"that state should save on run and all card opens after that
     * open a collapsed left rail 'Agent prompt' and reveals the run state."* The 2026-09-22
     * ruling stays whole for a package that has NEVER run — *"the canvas is not supposed to
     * appear until you click run"*: with no saved run there is no drawing to show, and the
     * prompt stands open as the only thing to look at. A package whose saved state carries
     * the run's own column HAS run; opening it is the read that state was saved for: the
     * prompt on its "Agent Prompt" rail, the drawing between the columns, her output beside
     * it — the state the owner drew. The column comes from `run_column` in the save, never
     * from a fresh model call: a model call per open would be the second call per run this
     * app already paid for once and removed.
     *
     * `middle` and the graph are honoured as facts either way: the graph is written into
     * the model, so a Run draws it immediately and nothing about the package is lost. A
     * package whose save says 'output' has no graph and is untouched.
     */
    const graph = stored.graph;
    if (stored.middle !== 'output' && graph && graph.nodes?.length) {
      writeFlowToSurface(graph);
      const runColumn = stored.run_column?.components;
      if (Array.isArray(runColumn) && runColumn.length) {
        void (async () => {
          try {
            // The canvas's own code — fetched on the way in, only when a drawing is
            // actually coming (the same rule a Run follows).
            await loadCanvasElements();
          } catch (err) {
            // NOTHING IS SUBSTITUTED: the prompt stays open on the output column, and the
            // trace carries the reason — a missing canvas is not a state to draw.
            logger.error('the canvas code could not be loaded, so the saved run opens on its output', {
              error: err instanceof Error ? err.message : String(err),
            });
            return;
          }
          /*
           * ONE COMMIT, AND THE SAVED ROOT IS NOT PART OF IT.
           *
           * The saved column is replayed into the tree on screen by id — the same update a Run
           * makes — with ONE exclusion: the saved root. The saved root is a photograph of the
           * tree the Run cut its column from (one assembly's child ids: left-header /
           * left-column / right-column), and the tree on screen was assembled by another
           * (left-hdr / left-col / right-col). Replaying the photograph replaced the live root
           * and orphaned every id that only exists in the other dialect: the prompt column, its
           * header and her column vanished and the renderer reported three missing components —
           * the reopen that forced a re-run instead of returning the room.
           *
           * THE TREE ON SCREEN OWNS ITS ROOT. What the saved column contributes is WHERE the
           * canvas goes and what it is made of: every non-root component merges by id, and the
           * live root's middle pointer is aimed at the restored column — read from the saved
           * root when one exists, otherwise derived from the column itself — and written only
           * when the target really exists in the merged list, because a pointer to a missing id
           * is the same orphaned reference this exclusion exists to remove.
           */
          setWorkspaceTree((prev) => {
            const comps = Array.isArray(prev.components) ? prev.components : [];
            const isRoot = (c: any) => c?.component === 'composer-workspace' || c?.id === 'root';
            const savedRoot = runColumn.find(isRoot) as any;
            const column = runColumn.filter((c) => !isRoot(c));
            const middlePointer =
              (typeof savedRoot?.children?.middle === 'string' ? savedRoot.children.middle : undefined)
              ?? (column.find((c: any) => c?.component === 'RoomEmbed') as any)?.id;
            let merged = applyComponentUpdate(comps, column);
            if (typeof middlePointer === 'string' && merged.some((c: any) => c?.id === middlePointer)) {
              merged = merged.map((c: any) =>
                isRoot(c)
                  ? { ...c, children: { ...(c.children as Record<string, unknown>), middle: middlePointer } }
                  : c,
              );
            } else if (typeof middlePointer === 'string') {
              logger.warn('the saved run column names a middle id that is not in it, so the column merged but the layout was not pointed at it', { middlePointer });
            }
            return { ...prev, components: merged };
          });
          setColumnView('flow', COLUMN_VIEWS_RUN);
          /*
           * THE PROMPT FOLDS ONLY ONCE THE DRAWING IS REALLY THERE. A folded prompt with an
           * empty middle is the "prompt text areas are not loading" state (2026-09-23) — so
           * this waits for the canvas element itself: the collapse and the drawing arrive
           * together, or the prompt stays out. `openPrompt` above has handed the pane's
           * ownership back, so the property write lands.
           */
          let frames = 0;
          const settle = () => {
            const canvas = deepFind<HTMLElement & { applyWorkspaceState?: (s: unknown) => boolean }>('room-embed');
            if (!canvas?.applyWorkspaceState) {
              if (++frames < 90) requestAnimationFrame(settle);
              return;
            }
            const layout = deepFind<HTMLElement & { leftCollapsed?: boolean }>('composer-workspace');
            if (layout) layout.leftCollapsed = true;
            // HER SEAT AND THE DRAWING'S PAN AND ZOOM — the rest of the place, put back by
            // the element that owns it (room-embed.applyWorkspaceState re-reads `stored`).
            canvas.applyWorkspaceState(stored);
          };
          requestAnimationFrame(settle);
        })();
      }
    }
    let frames = 0;
    let applied = false;
    const apply = () => {
      if (applied) return;
      // THE SAME SHADOW-PIERCING READ AS THE SAVE'S (see there): `document.querySelector`
      // finds neither element in this shell, so both writes below were no-ops and a package
      // "reopened where it was left" only in the record.
      const canvas = deepFind<HTMLElement & { applyWorkspaceState?: (s: unknown) => boolean }>('room-embed');
      if (canvas?.applyWorkspaceState) {
        canvas.applyWorkspaceState(stored);
        applied = true;
      }
      /*
       * THE PROMPT IS NOT RESTORED FOLDED WITHOUT A DRAWING — see `openThePrompt` above and
       * the run-state block above it. `leftCollapsed: true` is in a package's save because a
       * RUN docked the prompt; a package with no saved run has no drawing to watch instead,
       * so its prompt stays out, exactly as the owner asked on 2026-09-23 ("it makes me
       * think that the prompt text areas are not loading"). A package WITH a saved run folds
       * to its rail in the run-state block, and only once the canvas is really on screen.
       */
      if (!applied && ++frames < 40) requestAnimationFrame(apply);
    };
    requestAnimationFrame(apply);

  }, [currentPromptSession?.id]);
}
