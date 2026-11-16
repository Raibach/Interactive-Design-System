/**
 * THE OFFICIAL LIT BRIDGE FOR THE ROOM'S CATALOGUE.
 *
 * The catalogue is the room's own document, loaded with the official `Catalog.fromJson` at
 * v0.9.1. Every name gets a thin adapter that extends the official `A2uiLitElement`; the adapter
 * renders the room's existing element in light DOM and hands it the resolved props. The official
 * `A2uiSurface` and `MessageProcessor` do the rest.
 *
 * Children: the official controller resolves `children` to child refs and `renderNode` renders
 * each one. The parent's `placements` map is applied to the direct child adapters after render,
 * so the room's own named slots project them exactly as they do under the old renderer.
 */
import {nothing} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {A2uiLitElement} from '@a2ui/lit/v0_9';
import {Catalog, type ComponentApi} from '@a2ui/web_core/v0_9';
import catalogDoc from '@design2/surface-design/catalog.json';
import registryDoc from '@design2/surface-design/registry.json';
import {A2UI_PRIMITIVES, A2UI_STRUCTURAL} from '@/components/lit/a2ui-primitives';

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

const TREE_PROPS = new Set(['id', 'component', 'children', 'placements']);

const childId = (child: unknown): string | null => {
  if (typeof child === 'string') return child;
  if (child && typeof child === 'object' && typeof (child as {id?: unknown}).id === 'string') {
    return (child as {id: string}).id;
  }
  return null;
};

class AppLitAdapter extends A2uiLitElement<any> {
  static appTag = '';
  static tagName = '';

  private readonly app = createRef<HTMLElement>();

  createRenderRoot() {
    return this;
  }

  render() {
    const props = (this.controller?.props ?? {}) as Record<string, any>;
    const appTag = (this.constructor as typeof AppLitAdapter).appTag;
    if (!appTag) return nothing;
    const children = Array.isArray(props.children) ? props.children : [];
    const tag = unsafeStatic(appTag);
    return staticHtml`<${tag} ${ref(this.app)}>${children.map((child) => this.renderNode(child))}</${tag}>`;
  }

  protected updated(): void {
    const app = this.app.value as Record<string, any> | null;
    if (!app) return;
    const props = (this.controller?.props ?? {}) as Record<string, any>;
    const model = this.context?.dataContext?.dataModel;

    const resolve = (value: unknown): unknown => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
      const path = (value as {path?: unknown}).path;
      if (typeof path !== 'string' || !model) return value;
      return model.get(path);
    };

    for (const [name, value] of Object.entries(props)) {
      if (TREE_PROPS.has(name)) continue;
      const resolved = resolve(value);
      if (resolved !== undefined) app[name] = resolved;
    }

    const placements =
      props.placements && typeof props.placements === 'object' && !Array.isArray(props.placements)
        ? (props.placements as Record<string, unknown>)
        : null;
    const children = Array.isArray(props.children) ? props.children : [];
    if (!placements) return;

    const direct = Array.from(app.children) as HTMLElement[];
    children.forEach((child, index) => {
      const id = childId(child);
      const element = direct[index];
      if (!element) return;
      const region = Object.entries(placements).find(([, value]) => value === id)?.[0];
      if (region) element.setAttribute('slot', region);
      else element.removeAttribute('slot');
    });
  }
}

const adapters = new Map<string, CustomElementConstructor>();

const adapterFor = (appTag: string): CustomElementConstructor => {
  const cached = adapters.get(appTag);
  if (cached) return cached;
  const Adapter = class extends AppLitAdapter {};
  (Adapter as unknown as {appTag: string}).appTag = appTag;
  (Adapter as unknown as {tagName: string}).tagName = `a2ui-lit-${appTag}`;
  adapters.set(appTag, Adapter);
  return Adapter;
};

/** The room's catalogue, with one official Lit adapter for every component it names. */
export function createOfficialLitCatalog(): Catalog<any, any> {
  const catalog = Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');
  const missing = [...catalog.components.keys()].filter((name) => !LIT_APP_TAGS[name]);
  if (missing.length > 0) {
    throw new Error(`the official Lit bridge has no element for: ${missing.join(', ')}`);
  }

  const components = [...catalog.components.values()].map((api: ComponentApi) => {
    const appTag = LIT_APP_TAGS[api.name];
    const Adapter = adapterFor(appTag);
    return {
      ...api,
      tagName: `a2ui-lit-${appTag}`,
      element: Adapter,
    };
  });

  return catalog.derive({catalogId: catalog.id, components}) as unknown as Catalog<any, any>;
}
