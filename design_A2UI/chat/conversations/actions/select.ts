import { uxCapture } from '@/shared/uxCapture';
import type { ConversationsActionHost } from './host';

/** SELECT — a person chose a conversation from the bar; the conversation module adopts it. */
export const selectConversationAction = (host: ConversationsActionHost, e: Event): void => {
  const detail = (e as CustomEvent).detail || {};
  const id = typeof detail.conversationId === 'string' && detail.conversationId
    ? detail.conversationId
    : null;
  if (!id) return;
  // A person chose a conversation from the bar: an action against the seat, named by its act.
  uxCapture(
    'action',
    'chat-panel',
    { action: 'conversation-select' },
    host.sessionId ? { flow: host.sessionId } : {},
  );
  host._conversationModule.selectConversation.call(host._conv(), id);
};
