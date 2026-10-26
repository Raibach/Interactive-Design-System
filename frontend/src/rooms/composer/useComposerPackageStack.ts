/**
 * THE COMPOSER'S PACKAGE STACK — one holder for the package state, the surface tree, the
 * surface writers, the run-state write, the Save, the description write and the rename.
 *
 * The shell used to call these hooks itself. It now calls this one holder, and the shell's
 * remaining package handlers read the values it returns. The save's dependencies are filled by
 * the shell after its own assembly and conversation functions exist; the handler reads them at
 * call time, so no value is captured from a render that did not have it.
 */
import { useRef } from 'react';
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';
import { useComposerPackage } from '@/rooms/composer/useComposerPackage';
import { useComposerSurfaceTree } from '@/rooms/composer/useComposerSurfaceTree';
import { useComposerSurfaceWriters } from '@/rooms/composer/useComposerSurfaceWriters';
import { useComposerRunState } from '@/rooms/composer/useComposerRunState';
import { useComposerSave, type ComposerSaveDeps } from '@/rooms/composer/useComposerSave';
import { useComposerFacts } from '@/rooms/composer/useComposerFacts';

export function useComposerPackageStack({
  hasUnsavedChangesRef,
}: {
  hasUnsavedChangesRef?: { current: boolean };
}) {
  const saveDepsRef = useRef<ComposerSaveDeps | null>(null);
  const assembledRunColumnRef = useRef<unknown[] | null>(null);

  const pkg = useComposerPackage(hasUnsavedChangesRef);
  const tree = useComposerSurfaceTree();
  const writers = useComposerSurfaceWriters({ setWorkspaceTree: tree.setWorkspaceTree });
  const runState = useComposerRunState({
    currentPromptSessionRef: pkg.currentPromptSessionRef,
    assembledRunColumnRef,
  });
  const save = useComposerSave(saveDepsRef);
  const facts = useComposerFacts({
    currentPromptSessionObjRef: pkg.currentPromptSessionObjRef,
    setCurrentPromptSession: pkg.setCurrentPromptSession,
    writeDescriptionToSurface: tree.writeDescriptionToSurface,
  });

  /**
   * A RENAME IS A PACKAGE FACT AND A CONSOLE CARD FACT. The prompt's own bar reads the surface
   * (see writeTitleToSurface); the Console's card is drawn from the console's tree, so the card
   * is written here too. A rename of a draft stops at the surface; the first Save creates the
   * row under the name the person gave it.
   */
  const handlePromptTitleChange = async (newTitle: string) => {
    // Serialization guard: share mutex with handleSavePrompt to prevent double-record race
    if (pkg.isSavingRef.current) {
      console.log('⏸️ [CRUD] Title change skipped — save already in flight');
      return;
    }
    /*
     * A NAME IS NOT A PACKAGE, AND NAMING ONE MUST NOT CREATE ONE.
     *
     * So a title given to a draft is written to the SURFACE and stops there. The row is
     * created by the first SAVE, which generates a description like every other save — and
     * the save reads the title from the surface (see the title chain in handleSavePrompt),
     * so the name the person gave it is the name it is stored under.
     *
     * An EXISTING package is still renamed by PUT, which is what a rename is: no
     * description is involved and none should be.
     */
    if (!pkg.currentPromptSession?.id) {
      tree.writeTitleToSurface(newTitle);
      console.log('📝 [CRUD] Named draft — persisted on first save');
      return;
    }
    try {
      console.log('📝 [CRUD] Renaming session:', pkg.currentPromptSession.id, '→', newTitle);
      // Direct PUT to backend — don't use updatePromptSession which
      // constructs a return value that wipes leftColumnContent etc.
      const renameRes = await fetch(`${API_BASE}/prompt-sessions/${pkg.currentPromptSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
        },
        body: JSON.stringify({ title: newTitle }),
      });
      // A REFUSAL IS A REFUSAL (2026-10-25): the server's no used to be merged into the
      // local state anyway, so a failed rename read as a successful one.
      if (!renameRes.ok) {
        const raw = (await renameRes.text().catch(() => '')).trim();
        throw new Error(`the rename was refused (${renameRes.status}${raw ? ` — ${raw.slice(0, 200)}` : ''})`);
      }
      // Merge new title into existing session — don't replace entire object
      pkg.setCurrentPromptSession((prev: any) => prev ? { ...prev, title: newTitle, updatedAt: new Date().toISOString() } : prev);
      /*
       * AND THE PROMPT'S OWN BAR READS THE SURFACE (see writeTitleToSurface).
       */
      tree.writeTitleToSurface(newTitle);
      /* THE CONSOLE'S CARD IS NOT WRITTEN HERE (2026-10-24). The card belongs to the Console's
         surface; that room re-assembles its cards when it is entered, so it reads the new name
         from the package row. One room does not edit another room's surface. */
      console.log('✅ [CRUD] Renamed session:', pkg.currentPromptSession.id);
    } catch (error) {
      console.error('❌ [CRUD] Failed to update prompt title:', error);
    }
  };

  return {
    ...pkg,
    ...tree,
    ...writers,
    ...runState,
    ...save,
    ...facts,
    handlePromptTitleChange,
    saveDepsRef,
    assembledRunColumnRef,
  };
}
