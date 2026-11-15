/**
 * <design2-ux-chat-fold> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-chat-fold`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatFold } from '../../chat/parts/design-chat-fold';

export class UxChatFold extends ChatFold {}

if (!customElements.get('design2-ux-chat-fold')) customElements.define('design2-ux-chat-fold', UxChatFold);
