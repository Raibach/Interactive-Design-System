import {describe, expect, it} from 'vitest';
import './officialLitRenderer';

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
    code: 'A2UI-LIT-SEAT',
    message: {path: '/error/message'},
  },
];

const eventually = async (check: () => boolean, label: string): Promise<void> => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`timed out waiting for ${label}`);
};

describe('a2ui-official-lit-renderer', () => {
  it('draws the tree, then updates data without replacing the elements', async () => {
    const renderer = document.createElement('a2ui-official-lit-renderer') as Renderer;
    document.body.appendChild(renderer);
    renderer.surfaceId = 'lit-seat';
    renderer.components = TREE;
    renderer.dataModel = {error: {message: 'First.'}};
    await renderer.updateComplete;

    await eventually(
      () => renderer.shadowRoot?.querySelector('design2-error-banner') !== null,
      'the room banner',
    );
    const banner = renderer.shadowRoot!.querySelector('design2-error-banner') as
      | (HTMLElement & {shadowRoot: ShadowRoot | null})
      | null;
    const childAdapter = renderer.shadowRoot!.querySelector('a2ui-lit-design2-error-banner');
    expect(banner).not.toBeNull();
    expect(childAdapter?.getAttribute('slot')).toBe('middle');
    await eventually(
      () => (banner?.shadowRoot?.textContent ?? '').includes('First.'),
      'the first banner text',
    );

    renderer.dataModel = {error: {message: 'Second.'}};
    await renderer.updateComplete;
    const same = renderer.shadowRoot!.querySelector('design2-error-banner');
    expect(same).toBe(banner);
    await eventually(
      () => (banner?.shadowRoot?.textContent ?? '').includes('Second.'),
      'the second banner text',
    );

    renderer.remove();
  });
});
