import type { ConversationsActionHost } from './host';

/** A NEW CONVERSATION — the add mark's press; one at a time, by the seat's own latch. */
export const newConversationAction = (host: ConversationsActionHost): void => {
  if (host._creatingConversation) return;
  host._creatingConversation = true;
  void host._createConversation().finally(() => {
    host._creatingConversation = false;
  });
};
