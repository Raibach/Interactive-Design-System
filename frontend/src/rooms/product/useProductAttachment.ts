/**
 * PRODUCT ATTACHMENT — the product room's attachment upload, returned by its own hook. — moved out of `pages/WritingAreaIndex.tsx` verbatim.
 *
 * The statement's text is unchanged and the callback is returned, so every call site in the page
 * keeps its own name and signature. The dependency list is the contract.
 */
import { API_BASE } from '@/shared/apiHelper';
import { getStoredUserId } from '@/services/authService';
import { useCallback } from 'react';

/** Exactly what the callback needs from the shell, by name. */
export interface UseProductAttachmentDeps {
  productRoomProjectId: any;
}

export function useProductAttachment(deps: UseProductAttachmentDeps) {
  const { productRoomProjectId } = deps;
  return useCallback(async (file: File) => {
    if (!productRoomProjectId) return;
    const line = (content: string) =>
      window.dispatchEvent(new CustomEvent('a2ui:system-message', { detail: { role: 'assistant', content } }));
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(
        `${API_BASE}/builder/projects/${encodeURIComponent(productRoomProjectId)}/files/upload`,
        { method: 'POST', body: form, headers: { 'X-User-ID': getStoredUserId() } },
      );
      const body = (await res.json().catch(() => null)) as
        | { errors?: { errorMessage?: string }; error?: string; message?: string; data?: unknown }
        | null;
      const refused = !res.ok || !!body?.errors || !!body?.error;
      if (!refused) {
        line(`Attached \u201c${file.name}\u201d to the project.`);
        return;
      }
      line(
        body?.errors?.errorMessage ||
          body?.error ||
          body?.message ||
          `The engine refused \u201c${file.name}\u201d (HTTP ${res.status}).`,
      );
    } catch {
      line(`The engine did not answer the upload of \u201c${file.name}\u201d.`);
    }
  }, [productRoomProjectId]);
}
