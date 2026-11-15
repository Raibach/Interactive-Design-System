/**
 * <design2-ux-response-bubble> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-user-response-bubble`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { UserResponseBubble } from '../../chat/parts/design-user-response-bubble';

export class UxResponseBubble extends UserResponseBubble {}

if (!customElements.get('design2-ux-response-bubble')) customElements.define('design2-ux-response-bubble', UxResponseBubble);
