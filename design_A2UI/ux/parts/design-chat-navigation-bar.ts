/**
 * <design2-ux-chat-navigation-bar> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../surface-design/surface/rail/navigation-bar`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatNavigationBar } from '../../surface-design/surface/rail/navigation-bar';

export class UxChatNavigationBar extends ChatNavigationBar {}

if (!customElements.get('design2-ux-chat-navigation-bar')) customElements.define('design2-ux-chat-navigation-bar', UxChatNavigationBar);
