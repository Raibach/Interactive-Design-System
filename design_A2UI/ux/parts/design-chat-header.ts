/**
 * <design2-ux-chat-header> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-chat-header`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatHeader } from '../../chat/parts/design-chat-header';

export class UxChatHeader extends ChatHeader {}

if (!customElements.get('design2-ux-chat-header')) customElements.define('design2-ux-chat-header', UxChatHeader);
