/**
 * THE UX TAB'S OWN REGISTRY ENTRIES — the two names the UX surface may emit.
 *
 * `ux-chat` is this folder's copy of the chat seat, so its properties are the chat's.
 * `ux-app-frame` is the application frame: one address (`src`) and no data of its own.
 */
import type { SurfaceRegistryEntry } from '../surface-design/registry';
import { CHAT_SEAT_REGISTRY } from '../chat/registry';

const CHAT_PROPS = CHAT_SEAT_REGISTRY['chat-panel'].props;
const CHAT_EVENTS = CHAT_SEAT_REGISTRY['chat-panel'].events;

export const UX_REGISTRY: Record<string, SurfaceRegistryEntry> = {
  'ux-chat': {
    tag: 'design2-ux-chat',
    surface: 'design',
    description: 'THE UX TAB\'S CHAT: the analytics conversation and its turn.',
    props: CHAT_PROPS,
    events: CHAT_EVENTS,
    placements: ['view'],
  },
  'ux-app-frame': {
    tag: 'design2-ux-app-frame',
    surface: 'design',
    description:
      'THE UX APPLICATION FRAME: the analytics program at the address the surface gives it.',
    props: {
      src: { type: 'string', optional: true },
    },
    events: [],
  },
};
