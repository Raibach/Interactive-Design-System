import {describe, expect, it} from 'vitest';
import {Catalog, MessageProcessor} from '@a2ui/web_core/v0_9';
import {A2uiSurface} from '@a2ui/lit/v0_9';
import catalogDoc from '@design2/surface-design/catalog.json';
import {createOfficialLitCatalog, LIT_APP_TAGS} from './officialLitBridge';

const eventually = async (check: () => boolean, label: string): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe('official A2UI Lit bridge over the design catalogue', () => {
  it('has an adapter for every catalogue name', () => {
    const source = Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');
    const official = createOfficialLitCatalog();

    expect(official.components.size).toBe(source.components.size);
    for (const name of source.components.keys()) {
      expect(LIT_APP_TAGS[name], name).toBeTruthy();
      const implementation = official.components.get(name) as any;
      expect(implementation?.tagName, name).toBe(`a2ui-lit-${LIT_APP_TAGS[name]}`);
      expect(implementation?.element, name).toBeTruthy();
    }
  });

  it('draws a parent and a child in the parent\'s named slot', async () => {
    const catalog = createOfficialLitCatalog();
    const processor = new MessageProcessor([catalog]);
    const surfaceId = 'lit-tree';
    const errors = processor.processMessagesWithErrors([
      {version: 'v0.9.1', createSurface: {surfaceId, catalogId: catalog.id}},
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'design-middle-container',
              outputType: 'preview',
              children: ['banner'],
              placements: {middle: 'banner'},
            },
            {
              id: 'banner',
              component: 'error-banner',
              code: 'A2UI-LIT-TREE',
              message: {path: '/error/message'},
            },
          ],
        },
      },
      {
        version: 'v0.9.1',
        updateDataModel: {
          surfaceId,
          path: '/',
          value: {error: {message: 'The official Lit tree drew this.'}},
        },
      },
    ]);
    expect(errors).toEqual([]);

    const surface = processor.getSurface(surfaceId);
    if (!surface) throw new Error('the surface was not created');

    if (!customElements.get('a2ui-surface')) {
      customElements.define('a2ui-surface', A2uiSurface);
    }
    const view = document.createElement('a2ui-surface') as A2uiSurface;
    view.surface = surface as any;
    document.body.appendChild(view);
    await view.updateComplete;

    await eventually(
      () => view.querySelector('design2-error-banner') !== null,
      'the room banner',
    );

    const parent = view.querySelector('design-middle-container') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    const childAdapter = view.querySelector('a2ui-lit-design2-error-banner') as HTMLElement | null;
    const banner = view.querySelector('design2-error-banner') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;

    expect(parent).not.toBeNull();
    expect(childAdapter).not.toBeNull();
    expect(banner).not.toBeNull();
    expect(childAdapter?.getAttribute('slot')).toBe('middle');
    expect(parent?.shadowRoot?.querySelector('slot[name="middle"]')).not.toBeNull();

    await eventually(
      () => (banner?.shadowRoot?.textContent ?? '').includes('The official Lit tree drew this.'),
      'the banner text',
    );
    expect(banner?.shadowRoot?.textContent).toContain('A2UI-LIT-TREE');

    view.remove();
  });
});
