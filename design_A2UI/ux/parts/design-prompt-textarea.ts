/**
 * <design2-ux-prompt-textarea> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-prompt-textarea`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { PromptTextarea } from '../../chat/parts/design-prompt-textarea';

export class UxPromptTextarea extends PromptTextarea {}

if (!customElements.get('design2-ux-prompt-textarea')) customElements.define('design2-ux-prompt-textarea', UxPromptTextarea);
