import React from 'react';
import {render, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Catalog, MessageProcessor} from '@a2ui/web_core/v0_9';
import {A2uiSurface, createComponentImplementation} from '@a2ui/react/v0_9';
import catalogDoc from '@design2/surface-design/catalog.json';
import '@design2/chat/parts/design-error-banner';
import '@/components/lit/design-middle-container';

/**
 * THE OFFICIAL REACT RENDERER, DRAWING THE ROOM'S OWN COMPONENTS.
 *
 * The catalogue is the room's document, unchanged. The only things this test adds are thin React
 * entries that hand the resolved props to the Lit elements the room already draws. The live
 * renderer is not imported and is not changed; this is the bridge, measured in isolation.
 */
const loadCatalog = () => Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');

const errorBannerEntry = (api: any) =>
  createComponentImplementation(api, ({props}) =>
    React.createElement('design2-error-banner', {
      message: (props as {message?: string}).message,
      code: (props as {code?: string}).code,
    }),
  );

const middleContainerEntry = (api: any) =>
  createComponentImplementation(api, ({props, buildChild}) => {
    const placements = (props as {placements?: Record<string, string>}).placements;
    const childId = placements?.middle;
    return React.createElement(
      'design-middle-container',
      {outputType: (props as {outputType?: string}).outputType},
      childId
        ? React.createElement('div', {slot: 'middle', key: childId}, buildChild(childId))
        : null,
    );
  });

describe('official A2UI renderer over the room catalogue', () => {
  it('draws the room error banner from a bound message', async () => {
    const catalog = loadCatalog();
    const api = catalog.components.get('error-banner');
    if (!api) throw new Error('the design catalogue has no error-banner');

    const rendererCatalog = catalog.derive({
      catalogId: catalog.id,
      components: [errorBannerEntry(api)],
    }) as unknown as Catalog<any, any>;

    const processor = new MessageProcessor([rendererCatalog]);
    const surfaceId = 'official-error-banner';
    const errors = processor.processMessagesWithErrors([
      {version: 'v0.9.1', createSurface: {surfaceId, catalogId: rendererCatalog.id}},
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId,
          components: [
            {
              id: 'root',
              component: 'error-banner',
              code: 'A2UI-PROOF',
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
          value: {error: {message: 'The official renderer drew this.'}},
        },
      },
    ]);
    expect(errors).toEqual([]);

    const surface = processor.getSurface(surfaceId);
    if (!surface) throw new Error('the surface was not created');

    const {container} = render(<A2uiSurface surface={surface as any} />);
    const element = container.querySelector('design2-error-banner') as
      | (HTMLElement & {message?: string; shadowRoot: ShadowRoot | null})
      | null;
    expect(element).not.toBeNull();

    await waitFor(() => {
      expect(element?.message).toBe('The official renderer drew this.');
      expect(element?.shadowRoot?.textContent).toContain('The official renderer drew this.');
      expect(element?.shadowRoot?.textContent).toContain('A2UI-PROOF');
    });
  });

  it('draws a two-node tree through the middle column placement', async () => {
    const catalog = loadCatalog();
    const middleApi = catalog.components.get('design-middle-container');
    const bannerApi = catalog.components.get('error-banner');
    if (!middleApi) throw new Error('the design catalogue has no design-middle-container');
    if (!bannerApi) throw new Error('the design catalogue has no error-banner');

    const rendererCatalog = catalog.derive({
      catalogId: catalog.id,
      components: [middleContainerEntry(middleApi), errorBannerEntry(bannerApi)],
    }) as unknown as Catalog<any, any>;

    const processor = new MessageProcessor([rendererCatalog]);
    const surfaceId = 'official-middle-tree';
    const errors = processor.processMessagesWithErrors([
      {version: 'v0.9.1', createSurface: {surfaceId, catalogId: rendererCatalog.id}},
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
              code: 'A2UI-TREE',
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
          value: {error: {message: 'The tree drew this.'}},
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
      expect(banner?.shadowRoot?.textContent).toContain('The tree drew this.');
      expect(banner?.shadowRoot?.textContent).toContain('A2UI-TREE');
    });
  });
});
