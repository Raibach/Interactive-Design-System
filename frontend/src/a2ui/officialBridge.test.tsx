import React from 'react';
import {render, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Catalog, MessageProcessor} from '@a2ui/web_core/v0_9';
import {A2uiSurface} from '@a2ui/react/v0_9';
import catalogDoc from '@design2/surface-design/catalog.json';
import {BRIDGED_TAGS, createOfficialDesignCatalog} from './officialBridge';

/**
 * THE WHOLE ROOM'S CATALOGUE, THROUGH THE OFFICIAL CLIENT.
 *
 * The first test asserts coverage: every name in the catalogue has an implementation and a
 * defined element. The next two draw from that catalogue: one spec primitive and one two-node
 * tree with a named placement. The live renderer is not imported or changed.
 */
describe('official bridge over the design room catalogue', () => {
  it('has an implementation and a defined element for every catalogue name', () => {
    const source = Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');
    const official = createOfficialDesignCatalog();

    expect(official.components.size).toBe(source.components.size);
    for (const name of source.components.keys()) {
      expect(official.components.has(name), name).toBe(true);
      const tag = BRIDGED_TAGS[name];
      expect(tag, name).toBeTruthy();
      expect(customElements.get(tag), `${name} → ${tag}`).toBeTruthy();
    }
  });

  it('draws a spec Text component from a binding', async () => {
    const catalog = createOfficialDesignCatalog();
    const processor = new MessageProcessor([catalog]);
    const surfaceId = 'official-text';
    const errors = processor.processMessagesWithErrors([
      {version: 'v0.9.1', createSurface: {surfaceId, catalogId: catalog.id}},
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId,
          components: [
            {id: 'root', component: 'Text', text: {path: '/message'}, variant: 'body'},
          ],
        },
      },
      {
        version: 'v0.9.1',
        updateDataModel: {
          surfaceId,
          path: '/',
          value: {message: 'The bridge drew this.'},
        },
      },
    ]);
    expect(errors).toEqual([]);

    const surface = processor.getSurface(surfaceId);
    if (!surface) throw new Error('the surface was not created');

    const {container} = render(<A2uiSurface surface={surface as any} />);
    const text = container.querySelector('a2ui-text') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    expect(text).not.toBeNull();

    await waitFor(() => {
      expect(text?.shadowRoot?.textContent).toContain('The bridge drew this.');
    });
  });

  it('draws a two-node tree through a named placement', async () => {
    const catalog = createOfficialDesignCatalog();
    const processor = new MessageProcessor([catalog]);
    const surfaceId = 'official-tree';
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
              code: 'A2UI-BRIDGE',
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
          value: {error: {message: 'The bridge drew the tree.'}},
        },
      },
    ]);
    expect(errors).toEqual([]);

    const surface = processor.getSurface(surfaceId);
    if (!surface) throw new Error('the surface was not created');

    const {container} = render(<A2uiSurface surface={surface as any} />);
    const parent = container.querySelector('design-middle-container') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    const banner = container.querySelector('design2-error-banner') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    expect(parent).not.toBeNull();
    expect(banner).not.toBeNull();

    await waitFor(() => {
      expect(parent?.shadowRoot?.querySelector('slot[name="middle"]')).not.toBeNull();
      expect(parent?.querySelector('design2-error-banner')).not.toBeNull();
      expect(banner?.shadowRoot?.textContent).toContain('The bridge drew the tree.');
      expect(banner?.shadowRoot?.textContent).toContain('A2UI-BRIDGE');
    });
  });
});
