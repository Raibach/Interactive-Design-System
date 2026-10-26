/**
 * THE COMPOSER'S PACKAGE FACTS — the description write.
 *
 * Moved out of `pages/WritingAreaIndex.tsx` on 2026-10-24 (Stage 2c.2) verbatim. The row is
 * written first, the React copy follows, and the surface is written too so the seat that judges
 * the package sees it at once. An unsaved package has nowhere to put it yet; the next Save
 * carries it.
 */
import { useCallback } from 'react';
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';

export interface ComposerFactsDeps {
  currentPromptSessionObjRef: { current: any };
  setCurrentPromptSession: any;
  writeDescriptionToSurface: (next: string) => void;
}

export function useComposerFacts({
  currentPromptSessionObjRef,
  setCurrentPromptSession,
  writeDescriptionToSurface,
}: ComposerFactsDeps) {
  const handlePromptDescriptionChange = useCallback(async (description: string) => {
    const id = currentPromptSessionObjRef.current?.id;
    if (!id) {
      writeDescriptionToSurface(description);
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content: 'That description will be saved with the package — this draft has no record yet.',
        },
      }));
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/prompt-sessions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
        },
        body: JSON.stringify({ description }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setCurrentPromptSession((prev: any) =>
        prev ? { ...prev, description, updatedAt: new Date().toISOString() } : prev,
      );
      writeDescriptionToSurface(description);
      console.log('📝 [CRUD] Description written:', description.slice(0, 60));
    } catch (error) {
      // Said out loud: a description the person cannot see is one they will write again.
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content: `The description was not saved — ${String(error)}`,
          alert: true,
        },
      }));
    }
  }, [writeDescriptionToSurface]);

  return { handlePromptDescriptionChange };
}
