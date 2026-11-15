/**
 * <design2-ux-chat-product-tools> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-chat-product-tools`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatProductTools } from '../../chat/parts/design-chat-product-tools';

export class UxChatProductTools extends ChatProductTools {}

if (!customElements.get('design2-ux-chat-product-tools')) customElements.define('design2-ux-chat-product-tools', UxChatProductTools);
