import { isDemoMode } from '@/shared/appConfig';
import type { ConversationsActionHost } from './host';

/**
 * REMOVE A CONVERSATION — two presses: the first arms the row for four seconds, the second
 * removes it. The demo's delete is refused server-side; the seat does not offer it.
 */
export const removeConversationAction = (host: ConversationsActionHost, e: Event): void => {
  e.stopPropagation();
  if (isDemoMode()) return;
  const el = e.currentTarget as HTMLElement | null;
  const id = el?.dataset.conversationId ?? '';
  if (!id) return;
  if (host._armedDelete !== id) {
    host._armedDelete = id;
    host._listNote = '';
    if (host._deleteTimer) clearTimeout(host._deleteTimer);
    host._deleteTimer = setTimeout(() => {
      host._armedDelete = null;
      host._deleteTimer = null;
      host.requestUpdate();
    }, 4000);
    host.requestUpdate();
    return;
  }
  if (host._deleteTimer) {
    clearTimeout(host._deleteTimer);
    host._deleteTimer = null;
  }
  host._armedDelete = null;
  void host._removeConversation(id, host._userId());
};
