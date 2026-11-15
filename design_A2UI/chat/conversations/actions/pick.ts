/**
 * PICK A CONVERSATION — the row's press becomes the seat's `conversation-select` event.
 * The row carries the id in `data-conversation-id`; nothing else is read.
 */
export const pickConversationAction = (e: Event): void => {
  const el = e.currentTarget as HTMLElement | null;
  const id = el?.dataset.conversationId ?? '';
  if (!id) return;
  el?.dispatchEvent(
    new CustomEvent('conversation-select', {
      bubbles: true,
      composed: true,
      detail: { conversationId: id },
    }),
  );
};
