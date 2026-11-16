import {describe, expect, it} from 'vitest';
import {Catalog, MessageProcessor} from '@a2ui/web_core/v0_9';
import {A2uiSurface} from '@a2ui/lit/v0_9';
import catalogDoc from '@/components/A2UI/catalogs/prompt-composer/catalog.json';
import {createOfficialLitComposerCatalog, LIT_COMPOSER_TAGS} from './officialLitComposerBridge';

const eventually = async (check: () => boolean, label: string): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe('official A2UI Lit bridge over the prompt-composer catalogue', () => {
  it('has an adapter for every prompt-composer name', () => {
    const source = Catalog.fromJson(catalogDoc as Record<string, any>, 'v0.9.1');
    const official = createOfficialLitComposerCatalog();

    expect(official.components.size).toBe(source.components.size);
    for (const name of source.components.keys()) {
      expect(LIT_COMPOSER_TAGS[name], name).toBeTruthy();
      const implementation = official.components.get(name) as any;
      expect(implementation?.tagName, name).toBe(`a2ui-lit-${LIT_COMPOSER_TAGS[name]}`);
      expect(implementation?.element, name).toBeTruthy();
    }
  });

  it('draws a Column and a Text from the prompt-composer catalogue', async () => {
    const catalog = createOfficialLitComposerCatalog();
    const processor = new MessageProcessor([catalog]);
    const surfaceId = 'composer-proof';
    const errors = processor.processMessagesWithErrors([
      {version: 'v0.9.1', createSurface: {surfaceId, catalogId: catalog.id}},
      {
        version: 'v0.9.1',
        updateComponents: {
          surfaceId,
          components: [
            {id: 'root', component: 'Column', children: ['copy']},
            {id: 'copy', component: 'Text', text: {path: '/copy'}},
          ],
        },
      },
      {
        version: 'v0.9.1',
        updateDataModel: {
          surfaceId,
          path: '/',
          value: {copy: 'The composer catalogue drew this.'},
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
      () => view.querySelector('a2ui-text') !== null,
      'the composer Text',
    );
    const column = view.querySelector('a2ui-column');
    const text = view.querySelector('a2ui-text') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    expect(column).not.toBeNull();
    expect(text).not.toBeNull();
    await eventually(
      () => (text?.shadowRoot?.textContent ?? '').includes('The composer catalogue drew this.'),
      'the composer Text content',
    );

    view.remove();
  });
});
