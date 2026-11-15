/**
 * <design2-ux-chat> — THE UX TAB'S OWN PAGE.
 *
 * The right column for the UX tab: the rail, the five boxes and the conversation that reads the
 * UX package. Every behaviour lives in `./ux-chat-seat`; this file names the element and nothing
 * else. It was the whole seat until the parts were deduplicated; the seat's text moved to the
 * sibling file unchanged.
 */
import { UxChatSeat } from './ux-chat-seat';

export class UxChat extends UxChatSeat {}

if (!customElements.get('design2-ux-chat')) customElements.define('design2-ux-chat', UxChat);

declare global {
  interface HTMLElementTagNameMap {
    'design2-ux-chat': UxChat;
  }
}
