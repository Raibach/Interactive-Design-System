/**
 * <design2-ux-chat-action-bar> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-chat-action-bar`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatActionBar } from '../../chat/parts/design-chat-action-bar';

export class UxChatActionBar extends ChatActionBar {}

if (!customElements.get('design2-ux-chat-action-bar')) customElements.define('design2-ux-chat-action-bar', UxChatActionBar);
