import type { ConversationsActionHost } from './host';

/**
 * TOGGLE THE LIST — the bar's own press. Opening re-reads, so a conversation created or archived
 * a moment ago is in the list. A note belongs to the open it happened in, so it starts empty.
 */
export const toggleConversationsAction = (host: ConversationsActionHost): void => {
  host._conversationsOpen = !host._conversationsOpen;
  host._listNote = '';
  if (host._conversationsOpen) void host._readPackageConversations(host._userId());
  host.requestUpdate();
};
