/**
 * <design2-ux-chat-plugin-tray> — THE UX PAGE'S NAME FOR THE CHAT'S ELEMENT.
 *
 * The element is the chat seat's own (`../../chat/parts/design-chat-plugin-tray`); this file gives it the UX tag that the
 * UX seat's template names and the UX stylesheet selects. Nothing is re-implemented: the
 * behaviour, the props and the drawing are the chat element's, inherited unchanged.
 */
import { ChatPluginTray } from '../../chat/parts/design-chat-plugin-tray';

export class UxChatPluginTray extends ChatPluginTray {}

if (!customElements.get('design2-ux-chat-plugin-tray')) customElements.define('design2-ux-chat-plugin-tray', UxChatPluginTray);
