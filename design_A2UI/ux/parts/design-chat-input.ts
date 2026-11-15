/**
 * <design2-ux-chat-input> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-chat-input`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatInput } from '../../chat/parts/design-chat-input';

export class UxChatInput extends ChatInput {}

if (!customElements.get('design2-ux-chat-input')) customElements.define('design2-ux-chat-input', UxChatInput);
