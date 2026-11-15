/**
 * <design2-ux-chat-footer> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-chat-footer`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatFooter } from '../../chat/parts/design-chat-footer';

export class UxChatFooter extends ChatFooter {}

if (!customElements.get('design2-ux-chat-footer')) customElements.define('design2-ux-chat-footer', UxChatFooter);
