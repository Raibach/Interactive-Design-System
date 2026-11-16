import {html} from 'lit';
import {describe, expect, it} from 'vitest';
import {Catalog, MessageProcessor} from '@a2ui/web_core/v0_9';
import {A2uiLitElement, A2uiSurface} from '@a2ui/lit/v0_9';
import catalogDoc from '@design2/surface-design/catalog.json';
import '@design2/chat/parts/design-error-banner';

/**
 * THE OFFICIAL LIT RENDERER, DRAWING ONE OF THE ROOM'S OWN COMPONENTS.
 *
 * The catalogue is the room's document, unchanged. The adapter is the Lit equivalent of the
 * React entry: the official renderer hands it the resolved node, and its render puts the room's
 * existing element on screen with the resolved values. The live renderer is not imported.
 */
class ErrorBannerAdapter extends A2uiLitElement<any> {
  createRenderRoot() {
    return this;
  }

  render() {
    const props = (this.controller?.props ?? {}) as {message?: string; code?: string};
    return html`
      <design2-error-banner
        .message=${props.message ?? ''}
        .code=${props.code ?? ''}
      ></design2-error-banner>
    `;
  }
}

(ErrorBannerAdapter as unknown as {tagName: string}).tagName = 'a2ui-lit-error-banner';

describe('official A2UI Lit renderer over the room catalogue', () => {
  it('draws the room error banner from the official surface', async () => {
    const catalog = Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');
    const api = catalog.components.get('error-banner');
    if (!api) throw new Error('the design catalogue has no error-banner');

    const implementation = {
      ...api,
      tagName: 'a2ui-lit-error-banner',
      element: ErrorBannerAdapter,
    } as any;
    const rendererCatalog = catalog.derive({
      catalogId: catalog.id,
      components: [implementation],
    });

    const processor = new MessageProcessor([rendererCatalog as unknown as Catalog<any, any>]);
    const surfaceId = 'lit-proof';
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
              code: 'A2UI-LIT',
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
          value: {error: {message: 'The official Lit renderer drew this.'}},
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
    await customElements.whenDefined('a2ui-lit-error-banner');
    await new Promise((resolve) => setTimeout(resolve, 0));

    const banner = view.querySelector('design2-error-banner') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    expect(banner).not.toBeNull();
    expect(banner?.shadowRoot?.textContent).toContain('The official Lit renderer drew this.');
    expect(banner?.shadowRoot?.textContent).toContain('A2UI-LIT');

    view.remove();
  });
});
