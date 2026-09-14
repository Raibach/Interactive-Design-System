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
import { renderRepairForm, repairMaterialFor, type RepairFinding } from '@/shared/repairMaterial';
// The wiring test below mounts the whole row: the mark is decided by the section,
// not by the rail, and that decision is what a person actually sees.
import '@/components/lit/prompt-input/prompt-input-section';

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

/**
 * The rail is the prompt's notification column (owner's rule), so a prompt that is
 * waiting on a person marks itself there. What is pinned: the mark is real artwork
 * (a circle + an exclamation, not a stray glyph), it says what it means in words
 * because it has no node id to be looked up by, it carries no invented node id, and
 * the lightning beside it keeps the id it already had.
 */
describe('the rail carries the notification mark while a prompt needs a person', () => {
  it('draws the exclamation-in-a-circle as real geometry', async () => {
    const el = await mount(['alert']);
    const svg = cells(el)[0].querySelector('svg')!;

    expect(svg).toBeTruthy();
    expect(svg.querySelectorAll('circle')).toHaveLength(2); // the ring + the dot
    expect(svg.querySelector('path')).toBeTruthy();        // the bar of the `!`
    // One red for the rail and the field flag: #c50000, not a near miss.
    expect(svg.innerHTML).toContain('#c50000');
  });

  it('says what it means in words, since it has no node id to be found by', async () => {
    const el = await mount(['alert']);
    expect(cells(el)[0].getAttribute('title')).toBe('needs your input');
  });

  it('carries no node id — there is no such node in the file to borrow one from', async () => {
    const el = await mount(['alert']);
    expect(cells(el)[0].hasAttribute('data-node-id')).toBe(false);
  });

  it('does not disturb the lightning beside it', async () => {
    const el = await mount(['lightning', 'alert']);
    const [lightning, alert] = cells(el);

    expect(lightning.getAttribute('data-node-id')).toBe('40000746:99');
    expect(alert.hasAttribute('data-node-id')).toBe(false);
    expect(alert.getAttribute('title')).toBe('needs your input');
  });
});

/**
 * The wiring, not the glyph: <prompt-input-section> is where the decide-to-mark
 * happens, and it happens from `content` — the text a person is editing and Run
 * sends — so the rail cannot show a state the prompt is not in.
 */
describe('prompt-input-section marks its rail from its own text', () => {
  type SectionEl = HTMLElement & {
    content: string; name: string; type: string; sticky: boolean;
    updateComplete: Promise<unknown>;
    shadowRoot: ShadowRoot;
  };

  const mountSection = async (content: string) => {
    const el = document.createElement('prompt-input-section') as SectionEl;
    el.name = 'User Role';
    el.type = 'user-role';
    el.sticky = false;
    el.content = content;
    document.body.appendChild(el);
    await el.updateComplete;
    const rail = el.shadowRoot.querySelector('status-bar-prompt-input') as HTMLElement & {
      icons: string[]; updateComplete: Promise<unknown>;
    };
    await rail.updateComplete;
    return { el, rail, kinds: rail.shadowRoot!.querySelectorAll('[data-icon-kind]') };
  };

  // The form sits LAST in the section, exactly as buildRepairSections assembles it
  // (finding sentence, blank line, fields). That order is load-bearing: a line after
  // a field and before the next label is read as that field's VALUE, so prose
  // appended below a form would fill it in. The fixtures end at the form for that
  // reason, not for brevity — and they are built by `renderRepairForm`, so what is
  // mounted here is the text the app really writes, not a copy of it that can drift.
  const form = (f: RepairFinding) => renderRepairForm(repairMaterialFor(f).fields);
  const REQUIRED_BUT_EMPTY = [
    'Repair the finding below.',
    '',
    form({
      check: 'provenance-missing',
      component: 'prompt-container',
      what: 'No provenance block. Nothing marks which fields came from the design and which were invented.',
    }),
  ].join('\n');

  it('adds the mark while a required field is still empty', async () => {
    const { kinds } = await mountSection(REQUIRED_BUT_EMPTY);
    expect(Array.from(kinds).map((k) => k.getAttribute('data-icon-kind'))).toEqual([
      'lightning', 'alert',
    ]);
  });

  it('drops the mark as soon as the person supplies the value', async () => {
    // The value lands as a continuation of the same field, which is how a person
    // fills it in the textarea — not a new field that would leave the old one empty.
    const filled = [REQUIRED_BUT_EMPTY, 'agent_rpc / envelope field'].join('\n');
    const { el, rail } = await mountSection(filled);

    expect(Array.from(rail.shadowRoot!.querySelectorAll('[data-icon-kind]'))
      .map((k) => k.getAttribute('data-icon-kind'))).toEqual(['lightning']);
    // Mark and notice go together: one state, two places.
    expect(el.shadowRoot.querySelector('.prompt-flag')).toBeNull();
  });

  it('leaves the rail alone when the app\'s own suggestion is what is standing', async () => {
    // `suggested` is not a problem: the flag says so and Run applies it, so the
    // notification column stays as it was.
    const suggested = form({ check: 'node-id-absent', component: 'role-tile', nodeId: '40000909:4316' });
    const { el, rail } = await mountSection(suggested);

    expect(Array.from(rail.shadowRoot!.querySelectorAll('[data-icon-kind]'))
      .map((k) => k.getAttribute('data-icon-kind'))).toEqual(['lightning']);
    expect(el.shadowRoot.querySelector('.prompt-flag')!.getAttribute('data-flag')).toBe('suggested');
  });

  it('shows no mark on a prompt that never carried a form', async () => {
    const { kinds } = await mountSection('Summarise the selected text.');
    expect(Array.from(kinds).map((k) => k.getAttribute('data-icon-kind'))).toEqual(['lightning']);
  });
});
