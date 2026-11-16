/**
 * THE OFFICIAL LIT BRIDGE FOR THE DESIGN ROOM'S CATALOGUE.
 *
 * The catalogue is the room's own document, loaded with the official `Catalog.fromJson` at
 * v0.9.1. The shared adapter in `litCatalog.ts` gives every name a light-DOM element over the
 * room's existing elements; the official `A2uiSurface` and `MessageProcessor` do the rest.
 */
import catalogDoc from '@design2/surface-design/catalog.json';
import registryDoc from '@design2/surface-design/registry.json';
import {A2UI_PRIMITIVES, A2UI_STRUCTURAL} from '@/components/lit/a2ui-primitives';
import {createLitCatalog} from './litCatalog';

/* ── every element in the room, registered by side effect ─────────────────────────────────── */
import '@design2/chat/design-chat';
import '@design2/chat/chat-tab';
import '@design2/surface-design/surface/rail/navigation-bar';
import '@design2/chat/parts/design-chat-header';
import '@design2/chat/parts/design-chat-messages';
import '@design2/chat/parts/design-chat-action-bar';
import '@design2/chat/parts/design-chat-input';
import '@design2/chat/parts/design-prompt-textarea';
import '@design2/chat/parts/design-chat-plugin-tray';
import '@design2/chat/readout/output-header';
import '@design2/chat/parts/design-chat-fold';
import '@design2/chat/parts/design-sessions-feed';
import '@design2/chat/parts/design-error-banner';
import '@design2/chat/parts/design-small-dropdown';
import '@design2/chat/parts/design-user-response-bubble';
import '@design2/chat/parts/design-chat-product-tools';
import '@design2/chat/parts/design-chat-product-thread';
import '@design2/chat/thread/cards/work-status';
import '@design2/tools/tools-chat';
import '@design2/ux/chat';
import '@design2/ux/ux-app-frame';
import '@design2/approve/review-view';
import '@design2/surface-design/surface/frame/workspace';
import '@design2/chat/left/card-grid';
import '@design2/chat/left/repair-actions';
import '@design2/surface-design/surface/left-container/footer';
import '@design2/tools/figma-ingest-form';
import '@design2/tools/figma-layers-view';
import '@design2/tools/tools-tab';
import '@/components/lit/design-middle-container';
import '@/components/lit/component-preview';
import '@/components/lit/draft-preview';
import '@/components/lit/design-left-panel';
import '@/components/lit/a2ui-primitives';

/** Every catalogue name the room draws, and the element tag that draws it. */
export const LIT_APP_TAGS: Record<string, string> = {
  ...A2UI_STRUCTURAL,
  ...A2UI_PRIMITIVES,
  ...(registryDoc as {components: Record<string, string>}).components,
};

/** The room's catalogue, with one official Lit adapter for every component it names. */
export const createOfficialLitCatalog = () => createLitCatalog(catalogDoc, LIT_APP_TAGS);
