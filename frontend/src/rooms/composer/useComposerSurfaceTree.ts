/**
 * THE COMPOSER'S SURFACE TREE — the two channels the renderer draws from: the component list
 * and the data model — and the package facts read or written through them.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` on 2026-10-24 (Stages 2c.1 and 2c.2) with no
 * behavior change. The A2UI surface is the package's view: the sections, the compiled output,
 * the flow and the run column all live in this model. The shell still calls the same names until
 * the Save handler follows.
 */
import { useCallback, useRef, useState } from 'react';

export type ComposerTree = { components: any[]; dataModel: Record<string, any> };

export function useComposerSurfaceTree() {
  const [workspaceTree, setWorkspaceTree] = useState<ComposerTree>({
    components: [],
    dataModel: {},
  });
  /**
   * The live tree for the callbacks that must not close over a stale render — the same
   * render-synced ref shape the shell uses for `headerTabRef` and `currentPromptSessionRef`.
   */
  const workspaceTreeRef = useRef(workspaceTree);
  workspaceTreeRef.current = workspaceTree;
  /** The live data model, for the readers below. */
  const surfaceDataModelRef = useRef(workspaceTree.dataModel);
  surfaceDataModelRef.current = workspaceTree.dataModel;

  /**
   * THE SECTIONS, READ FROM THE SURFACE — the model the renderer bound into the editor, held in
   * the data the assembly returned. Reading it here reads exactly what the components were
   * given; reading `currentPromptSession` would read a copy that follows a save, not a draft.
   *
   * THROUGH THE REF, NOT THE RENDER'S VARIABLE. A listener that outlives a render must not read
   * the tree from the render it was registered in. This is what made Save read the console's
   * model while the composer was on screen, find no sections, and give up in silence.
   */
  const surfaceSections = useCallback((): any[] => {
    const s = (surfaceDataModelRef.current as any)?.session?.left_column?.sections;
    return Array.isArray(s) ? s : [];
  }, []);

  /**
   * THE TITLE INTO THE SURFACE, WHERE THE BAR THAT DRAWS IT READS IT. A write that only reached
   * React state would persist and leave the bar on the old name. Both branches of a rename call
   * this: a fresh composer has no package id, an existing one has a row.
   */
  const writeTitleToSurface = useCallback((next: string) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      if ((session.title ?? null) === next) return prev;
      return {
        ...prev,
        dataModel: { ...prev.dataModel, session: { ...session, title: next } },
      };
    });
  }, []);

  /**
   * THE DESCRIPTION INTO THE SURFACE, WHERE THE SEAT THAT JUDGES IT READS IT. <chat-panel> is
   * bound to `/session/description`; a write that only reached React state would leave the seat
   * reading the old value, and the button that added the description would stay live.
   */
  const writeDescriptionToSurface = useCallback((next: string) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      if ((session.description ?? null) === next) return prev;
      return {
        ...prev,
        dataModel: { ...prev.dataModel, session: { ...session, description: next } },
      };
    });
  }, []);

  return {
    workspaceTree,
    setWorkspaceTree,
    workspaceTreeRef,
    surfaceDataModelRef,
    surfaceSections,
    writeTitleToSurface,
    writeDescriptionToSurface,
  };
}
