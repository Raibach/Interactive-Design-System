/**
 * THE SHARED OFFICIAL LIT ADAPTER.
 *
 * One light-DOM adapter class per app element, built from a catalogue document and the
 * name → element tag table for that catalogue. The catalogue is loaded with the official
 * `Catalog.fromJson` at v0.9.1; the adapter extends the official `A2uiLitElement`, renders the
 * room's existing element, hands it the resolved props (including DataBinding props the official
 * binder leaves as `{path}`), renders children through `renderNode`, and writes each `placements`
 * region's `slot` on the direct child adapters. The design and prompt-composer bridges are thin
 * callers of this module.
 */
import {nothing} from 'lit';
import {html as staticHtml, unsafeStatic} from 'lit/static-html.js';
import {createRef, ref} from 'lit/directives/ref.js';
import {A2uiLitElement} from '@a2ui/lit/v0_9';
import {Catalog, type ComponentApi} from '@a2ui/web_core/v0_9';

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

/** Load a catalogue document and give every name an official Lit adapter for its element. */
export function createLitCatalog(
  catalogDoc: Record<string, any>,
  tags: Record<string, string>,
): Catalog<any, any> {
  const catalog = Catalog.fromJson(catalogDoc, 'v0.9.1');
  const missing = [...catalog.components.keys()].filter((name) => !tags[name]);
  if (missing.length > 0) {
    throw new Error(`the official Lit bridge has no element for: ${missing.join(', ')}`);
  }

  const components = [...catalog.components.values()].map((api: ComponentApi) => {
    const appTag = tags[api.name];
    const Adapter = adapterFor(appTag);
    return {
      ...api,
      tagName: `a2ui-lit-${appTag}`,
      element: Adapter,
    };
  });

  return catalog.derive({catalogId: catalog.id, components}) as unknown as Catalog<any, any>;
}
