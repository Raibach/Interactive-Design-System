import React from 'react';
import {render, waitFor} from '@testing-library/react';
import {describe, expect, it} from 'vitest';
import {Catalog, MessageProcessor} from '@a2ui/web_core/v0_9';
import {A2uiSurface, createComponentImplementation} from '@a2ui/react/v0_9';
import catalogDoc from '@design2/surface-design/catalog.json';
import '@design2/chat/parts/design-error-banner';

/**
 * THE OFFICIAL REACT RENDERER, DRAWING ONE OF THE ROOM'S OWN COMPONENTS.
 *
 * The catalogue is the room's document, unchanged. The only thing this test adds is a React
 * entry for `error-banner` that hands the resolved props to the Lit element the room already
 * draws. The live renderer is not imported and is not changed; this is the bridge, measured
 * in isolation.
 */
describe('official A2UI renderer over the room catalogue', () => {
  it('draws the room error banner from a bound message', async () => {
    const catalog = Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');
    const api = catalog.components.get('error-banner');
    if (!api) throw new Error('the design catalogue has no error-banner');

    const implementation = createComponentImplementation(api, ({props}) =>
      React.createElement('design2-error-banner', {
        message: (props as {message?: string}).message,
        code: (props as {code?: string}).code,
      }),
    );

    const rendererCatalog = catalog.derive({
      catalogId: catalog.id,
      components: [implementation],
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
});
