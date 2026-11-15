import type { ConversationsActionHost } from './host';
import { toggleConversationsAction } from './toggle';

/** THE SAME GESTURE FROM THE KEYBOARD — the bar is announced as a button. */
export const conversationsKeyAction = (host: ConversationsActionHost, e: KeyboardEvent): void => {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault();
  toggleConversationsAction(host);
};
