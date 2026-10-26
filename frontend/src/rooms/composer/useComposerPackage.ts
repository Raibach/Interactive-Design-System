/**
 * THE COMPOSER'S PACKAGE STATE — the open package, its save flag, its load key, and the refs
 * the long-lived listeners read at call time.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` on 2026-10-24 (Stage 2c.1) with no behavior change.
 * The shell calls this hook and keeps the same names for now; the call site inverts, and the
 * handlers and the surface tree follow, in the next cuts. The target is the doctrine in
 * `AGENTS-instructions/THE_SHOJI_ROOMS.md`: the shell is navigation, and the package is the
 * Composer's work.
 *
 * Every ref here exists because a listener or an effect registered once must read the live
 * fact when it fires. The comments are the measured reasons, kept with the state they explain.
 */
import { useEffect, useRef, useState } from 'react';
import type { PromptSession } from '@/services/promptService';
import type { DraftPayloadShape } from '@/rooms/product/types';

export function useComposerPackage(externalUnsavedRef?: { current: boolean }) {
  /** The package being edited: its row, its version, its compiled output, its workspace. */
  const [currentPromptSession, setCurrentPromptSession] = useState<PromptSession | null>(null);
  /** The save's own busy state; the bottom bar draws it. */
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  /** Changes on each package load; the three columns remount against it. */
  const [promptLoadKey, setPromptLoadKey] = useState(0);

  /** Serialization guard: prevents concurrent save operations. */
  const isSavingRef = useRef(false);
  /** The open package's id, for listeners that would otherwise hold a stale closure. */
  const currentPromptSessionRef = useRef<string | null>(null);
  /** The live package object, for the same listeners. */
  const currentPromptSessionObjRef = useRef<any>(null);

  /**
   * THE REFS FOLLOW THE STATE (restored 2026-10-25). The old shell kept this one effect; the
   * move to the room dropped it, and every listener read null after a package opened from its
   * card — Save created a second row, the Run was not persisted, evaluations never loaded.
   */
  useEffect(() => {
    currentPromptSessionRef.current = currentPromptSession?.id ?? null;
    currentPromptSessionObjRef.current = currentPromptSession;
  }, [currentPromptSession]);

  /**
   * THE WIDTHS THIS PACKAGE WAS SAVED WITH — kept where the open effect can read them without
   * depending on the session object.
   */
  const storedWidthsRef = useRef<{ left?: number | null; chat?: number | null } | null>(null);

  /**
   * HER REVIEW IS CLEARED BY HER, NOT BY THE CLOCK. Set when she emits `<run_ok/>` and read by
   * the Run gate, which lets exactly one run through per approval.
   */
  const runApprovedRef = useRef(false);

  /**
   * WHAT WAS HELD IS WHAT RUNS. A held Run keeps the sections it arrived with, so the run her
   * approval releases is the one she reviewed.
   */
  const heldRunRef = useRef<{ sections?: any[] } | null>(null);

  /**
   * The save handler as the listeners see it. Accepts the compiled output and the sections the
   * Lit editor actually holds, so a Save after a Run persists the full state. `opts.title` names
   * a package this call is creating (Repair does this at launch); `opts.keepSurface` stops the
   * save from navigating away from what was just saved.
   */
  const handleSavePromptRef = useRef<(
    compiledOutput?: string,
    providedSections?: any[],
    opts?: { keepSurface?: boolean; title?: string },
  ) => Promise<void>>(async () => {});

  /**
   * THE UNSAVED FLAG. The room fills it; the shell reads it through the boundary ref it hands in,
   * because leaving the tab is navigation and the shell still has to ask before it discards work.
   */
  const ownUnsavedRef = useRef(false);
  const hasUnsavedChangesRef = externalUnsavedRef ?? ownUnsavedRef;

  /**
   * The draft's last payload. The host listens for `draft-node-moved`, folds the released place
   * into its copy, and writes it; ONE DRAG, ONE WRITE, and the host is the single writer.
   */
  const draftPayloadRef = useRef<DraftPayloadShape | null>(null);

  return {
    currentPromptSession,
    setCurrentPromptSession,
    isSavingPrompt,
    setIsSavingPrompt,
    promptLoadKey,
    setPromptLoadKey,
    isSavingRef,
    currentPromptSessionRef,
    currentPromptSessionObjRef,
    storedWidthsRef,
    runApprovedRef,
    heldRunRef,
    handleSavePromptRef,
    hasUnsavedChangesRef,
    draftPayloadRef,
  };
}
