/**
 * THE TOOLS TAB'S OWN REGISTRY ENTRY — one name the Tools surface may emit.
 *
 * The element is this folder's own copy of the chat seat, so its properties are the chat's
 * properties. The entry takes the chat seat's table rather than repeating it: a prop the chat
 * declares and this file omits would be a payload writing into nothing.
 */
import type { SurfaceRegistryEntry } from '../surface-design/registry';
import { CHAT_SEAT_REGISTRY } from '../chat/registry';

const CHAT_PROPS = CHAT_SEAT_REGISTRY['chat-panel'].props;
const CHAT_EVENTS = CHAT_SEAT_REGISTRY['chat-panel'].events;

export const TOOLS_REGISTRY: Record<string, SurfaceRegistryEntry> = {
  'tools-chat': {
    tag: 'design2-tools-chat',
    surface: 'design',
    description:
      'THE TOOLS TAB\'S CHAT: the ingest conversation and its turn. The element is the seat\'s '
      + 'own copy of the chat, so its properties are the chat\'s.',
    props: CHAT_PROPS,
    events: CHAT_EVENTS,
  },
};
