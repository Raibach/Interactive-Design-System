import {afterEach, describe, expect, it} from 'vitest';
import {act, waitFor} from '@testing-library/react';
import './officialRenderer';

type Renderer = HTMLElement & {
  surfaceId: string;
  components: unknown[];
  dataModel: Record<string, unknown>;
  updateComplete: Promise<void>;
};

const TREE = [
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
    code: 'A2UI-RENDERER',
    message: {path: '/error/message'},
  },
];

const make = async (): Promise<Renderer> => {
  let renderer!: Renderer;
  await act(async () => {
    renderer = document.createElement('a2ui-official-renderer') as Renderer;
    document.body.appendChild(renderer);
    renderer.surfaceId = 'test';
    await renderer.updateComplete;
  });
  return renderer;
};

const draw = async (
  renderer: Renderer,
  components: unknown[],
  dataModel: Record<string, unknown>,
): Promise<void> => {
  await act(async () => {
    renderer.components = components;
    renderer.dataModel = dataModel;
    await renderer.updateComplete;
  });
};

afterEach(() => {
  document.body.innerHTML = '';
});

describe('a2ui-official-renderer', () => {
  it('draws the tree, then updates data without replacing the elements', async () => {
    const renderer = await make();
    await draw(renderer, TREE, {error: {message: 'First.'}});

    const parent = renderer.shadowRoot!.querySelector('design-middle-container');
    const banner = renderer.shadowRoot!.querySelector('design2-error-banner') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    expect(parent).not.toBeNull();
    expect(banner).not.toBeNull();
    const host = banner?.parentElement;
    expect(host?.getAttribute('slot')).toBe('middle');
    expect(banner?.getAttribute('slot')).toBeNull();
    await waitFor(() => {
      expect(banner?.shadowRoot?.textContent).toContain('First.');
      expect(banner?.shadowRoot?.textContent).toContain('A2UI-RENDERER');
    });

    await act(async () => {
      renderer.dataModel = {error: {message: 'Second.'}};
      await renderer.updateComplete;
    });

    const same = renderer.shadowRoot!.querySelector('design2-error-banner');
    expect(same).toBe(banner);
    await waitFor(() => {
      expect(banner?.shadowRoot?.textContent).toContain('Second.');
    });
  });

  it('replaces the tree when the components change', async () => {
    const renderer = await make();
    await draw(renderer, TREE, {error: {message: 'First.'}});
    expect(renderer.shadowRoot!.querySelector('design-middle-container')).not.toBeNull();

    await act(async () => {
      renderer.components = [
        {id: 'root', component: 'error-banner', code: 'ROOT', message: {path: '/error/message'}},
      ];
      await renderer.updateComplete;
    });

    expect(renderer.shadowRoot!.querySelector('design-middle-container')).toBeNull();
    const banner = renderer.shadowRoot!.querySelector('design2-error-banner') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    expect(banner).not.toBeNull();
    await waitFor(() => {
      expect(banner?.shadowRoot?.textContent).toContain('First.');
    });
  });
});
