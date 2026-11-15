/**
 * <design2-ux-small-dropdown> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-small-dropdown`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { SmallDropdown } from '../../chat/parts/design-small-dropdown';

export class UxSmallDropdown extends SmallDropdown {}

if (!customElements.get('design2-ux-small-dropdown')) customElements.define('design2-ux-small-dropdown', UxSmallDropdown);
