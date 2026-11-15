/**
 * <design2-ux-error-banner> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-error-banner`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ErrorBanner } from '../../chat/parts/design-error-banner';

export class UxErrorBanner extends ErrorBanner {}

if (!customElements.get('design2-ux-error-banner')) customElements.define('design2-ux-error-banner', UxErrorBanner);
