/**
 * THE COMPOSER'S SURFACE WRITERS — the one-way writes into the model the renderer binds from.
 *
 * These lived in `pages/WritingAreaIndex.tsx` while the shell hosted the Composer. They are the
 * Composer's own behaviour: every one writes a path in `/session/...` that the assembled surface
 * reads, and none of them knows anything about navigation, the rooms or the doors. Moving them
 * here takes the first block of the Composer's operating code out of the God file; the state they
 * write (the tree) still lives with the host that owns it until the box takes that too.
 *
 * EVERY WRITE BAILS OUT WHEN THE VALUE IS ALREADY THERE. The callers run on every commit or on
 * every event, and returning a fresh object each time would loop.
 */
import { useCallback } from 'react';

export type ComposerTree = { components: any[]; dataModel: Record<string, any> };

export interface ComposerSurfaceWritersDeps {
  setWorkspaceTree: (updater: (prev: ComposerTree) => ComposerTree) => void;
}

export function useComposerSurfaceWriters({ setWorkspaceTree }: ComposerSurfaceWritersDeps) {
  /**
   * ONE SECTION AT ONE INDEX — or appended when the index is null and the shape is new.
   *
   * THE SHAPE TEST IS LOAD-BEARING: one new row (`section-add` and the `section-update` that
   * follows) arrives in the same tick, and `surfaceSections()` would hand both the same stale
   * list — the second would compute an array without the first one's row. The shape test makes
   * the second report a no-op instead of a duplicate.
   */
  const patchSectionAt = useCallback((index: number | null, section: any) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const left = session.left_column ?? {};
      const have = Array.isArray(left.sections) ? left.sections : [];
      const shape = (s: any) => `${s?.type ?? ''}\u0000${s?.name ?? ''}\u0000${s?.content ?? ''}`;
      const sections = index !== null && index < have.length
        ? have.map((s: any, i: number) => (i === index ? { ...s, ...section } : s))
        : have.some((s: any) => shape(s) === shape(section))
          ? have
          : [...have, section];
      const same = have.length === sections.length
        && have.every((s: any, i: number) => shape(s) === shape(sections[i]));
      if (same) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, left_column: { ...left, sections } },
        },
      };
    });
  }, [setWorkspaceTree]);

  /**
   * Put sections into the composer's column, the way the surface reads them.
   *
   * TYPE AND NAME ARE COMPARED, NOT ONLY CONTENT. A seat's TYPE is not its text: changing User
   * Role to Constraints leaves the content string unchanged, so a content-only guard dropped the
   * write and the model never learned about the new seat. A guard that decides whether to write
   * has to compare everything the write carries.
   */
  const writeSectionsToSurface = useCallback((sections: any[]) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const left = session.left_column ?? {};
      const have = Array.isArray(left.sections) ? left.sections : [];
      const shape = (s: any) => `${s?.type ?? ''}\u0000${s?.name ?? ''}\u0000${s?.content ?? ''}`;
      const same = have.length === sections.length
        && have.every((s: any, i: number) => shape(s) === shape(sections[i]));
      if (same) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, left_column: { ...left, sections } },
        },
      };
    });
  }, [setWorkspaceTree]);

  /**
   * THE MIDDLE COLUMN'S WRITER — the viewer binds `content` to
   * /session/middle_column/compiled_output, and without this writer a Run's answer arrived in
   * React state and went nowhere: the column drew its empty state over an answer that had already
   * arrived. Same shape, same bail-out.
   */
  const writeCompiledOutputToSurface = useCallback((output: string) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const middle = session.middle_column ?? {};
      if ((middle.compiled_output ?? '') === output) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, middle_column: { ...middle, compiled_output: output } },
        },
      };
    });
  }, [setWorkspaceTree]);

  /**
   * THE TWO BUSY FLAGS THE BOTTOM BAR DRAWS — the spinner on the button that was pressed.
   *
   * `<control-bar>` carried `isSaving` and `isRunning` from the drawing and nothing ever assigned
   * either, so a Save that took two seconds looked like a button that did nothing. Written as
   * values, not as a call into the element: the model is how a value reaches a component here,
   * and the renderer re-applies every bound path when it changes.
   */
  const writeBusyToSurface = useCallback((saving: boolean, running: boolean) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const left = session.left_column ?? {};
      const middle = session.middle_column ?? {};
      if (left.saving === saving && middle.running === running) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: {
            ...session,
            left_column: { ...left, saving },
            middle_column: { ...middle, running },
          },
        },
      };
    });
  }, [setWorkspaceTree]);

  /** The graph, into the model. Same shape as the writers above, same bail-out. */
  const writeFlowToSurface = useCallback((flow: unknown) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const middle = session.middle_column ?? {};
      if (middle.flow === flow) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, middle_column: { ...middle, flow } },
        },
      };
    });
  }, [setWorkspaceTree]);

  /**
   * THE JUDGED RUNS, WHERE THE EVALS VIEW READS THEM — the backend's `/evaluations` rows,
   * published to /session/middle_column/evaluations. Unset stays unset until the first write; an
   * empty list is the claim "ran and nothing judged yet".
   */
  const writeEvaluationsToSurface = useCallback((list: unknown) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const middle = session.middle_column ?? {};
      if (middle.evaluations === list) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, middle_column: { ...middle, evaluations: list } },
        },
      };
    });
  }, [setWorkspaceTree]);

  return {
    patchSectionAt,
    writeSectionsToSurface,
    writeCompiledOutputToSurface,
    writeBusyToSurface,
    writeFlowToSurface,
    writeEvaluationsToSurface,
  };
}
