/**
 * <design2-ux-sessions-feed> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-sessions-feed`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { SessionsFeed } from '../../chat/parts/design-sessions-feed';

export class UxSessionsFeed extends SessionsFeed {}

if (!customElements.get('design2-ux-sessions-feed')) customElements.define('design2-ux-sessions-feed', UxSessionsFeed);
