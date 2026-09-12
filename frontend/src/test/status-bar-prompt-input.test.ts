/**
 * <status-bar-prompt-input> — the rail that carried no node reference at all.
 *
 * registry.json maps this element to Figma node 40000878:239, and the design
 * cache it was built from (src/design/VALUES.json) records the two cells the rail
 * draws: Database_fill (40000746:98) and Subtract (40000746:99). The element
 * carried none of those ids anywhere — the :host had no id, the cells had none —
 * so the drawn rail could not be traced back to the design it came from, which is
 * the one `node-id-absent` finding the catalogue audit raises for this theme.
 *
 * What is pinned here is the MAPPING, not the presence of a string: the host IS
 * the rail's own node, each cell carries its own node, and a kind the design does
 * not draw carries NO node id rather than borrowing one from a sibling.
 */
import { describe, it, expect } from 'vitest';
import '@/components/lit/prompt-input/status-bar-prompt-input';

type RailEl = HTMLElement & { icons: string[]; updateComplete: Promise<unknown> };

const mount = async (icons: string[]) => {
  const el = document.createElement('status-bar-prompt-input') as RailEl;
  el.icons = icons;
  document.body.appendChild(el);
  await el.updateComplete;
  return el;
};

const cells = (el: RailEl) => Array.from(el.shadowRoot!.querySelectorAll('.icon-cell'));

describe('status-bar-prompt-input carries its Figma node references', () => {
  it('puts the rail node on the host and one node per designed cell', async () => {
    const el = await mount(['database', 'lightning']);

    // The host is the drawn rail, so node 40000878:239 belongs on it — not inside.
    expect(el.getAttribute('data-node-id')).toBe('40000878:239');
    expect(cells(el).map((c) => c.getAttribute('data-node-id'))).toEqual([
      '40000746:98', // Database_fill
      '40000746:99', // Subtract — the lightning glyph
    ]);
  });

  it('leaves the attribute off a kind the design does not draw, rather than borrowing a node', async () => {
    const el = await mount(['not-a-designed-kind']);

    expect(cells(el)).toHaveLength(1);
    expect(cells(el)[0].hasAttribute('data-node-id')).toBe(false);
  });
});
