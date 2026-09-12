/**
 * The console surface, as <a2ui-renderer> actually draws it.
 *
 * The console stopped being hand-rendered in React from `dataModel.cards` — which is
 * why the renderer used to be mounted off-screen, to avoid drawing the same grid
 * twice. Two card behaviours had to travel with that swap before it was safe, and
 * both are invisible when they work:
 *
 *   1. A card drawn from Grace's tree carries its session id. <agent-card-element>
 *      dispatches `card-delete` with `this.id`, so a card drawn without one deletes
 *      nothing and names nothing in the confirmation.
 *   2. Clicking a card dispatches `card-open` — an event `agent-card` declares in the
 *      tag contract (shared/tag-registry.ts → AgentCardSchema.events) that nothing
 *      emitted and nothing listened for.
 *
 * Nothing here mocks the payload's shape: the tree below is the one
 * backend/routes/ai.py asks the model for, verbatim, and the data model is the shape
 * it builds from the database.
 */
import { describe, it, expect } from 'vitest';
import '@/components/lit/agent-card-element';
import '@/components/lit/a2ui-renderer';

const CONSOLE_TREE = [
  { id: 'root', component: 'Column', children: ['header', 'card-grid'] },
  { id: 'header', component: 'Text', text: 'Welcome back!', variant: 'greeting' },
  { id: 'card-grid', component: 'ConsoleCardGrid', items: { path: '/cards' } },
];

const SESSION_ID = '11111111-1111-4111-8111-111111111111';

type CardEl = HTMLElement & Record<string, any>;

/** Mount the console tree and hand back the grid the renderer drew, plus its cards. */
const mount = async (dataModel: Record<string, unknown>) => {
  const el = document.createElement('a2ui-renderer') as CardEl;
  Object.assign(el, { components: CONSOLE_TREE, dataModel });
  document.body.appendChild(el);
  await el.updateComplete;
  const grid = el.shadowRoot!.querySelector('a2ui-console-card-grid') as CardEl;
  // The grid is a Lit element too, and the renderer creates it — so its own first
  // update is a separate microtask. Asserting against it before that resolves would
  // read an empty shadow root and report "the binding painted nothing".
  await grid.updateComplete;
  const drawn = Array.from(
    grid.shadowRoot!.querySelectorAll('agent-card-element'),
  ) as CardEl[];
  return { el, grid, drawn };
};

describe('the console surface <a2ui-renderer> draws', () => {
  it('resolves the /cards binding and gives every card its session id', async () => {
    const { el, drawn } = await mount({
      cards: [{ id: SESSION_ID, title: 'First', category: 'Ops', status: 'active', version: 3, likes: 2 }],
    });

    // A grid with no cards still renders, so the COUNT is the assertion: a binding
    // that failed to resolve would paint zero cards and say nothing about why.
    expect(drawn).toHaveLength(1);
    // The id is what `card-delete` reports. Without it the trash control arms,
    // confirms, and deletes the empty string.
    expect(drawn[0].id).toBe(SESSION_ID);
    expect(drawn[0].getAttribute('data-a2ui-id')).toBe(SESSION_ID);
    expect(drawn[0].title).toBe('First');

    el.remove();
  });

  it('dispatches the declared card-open, carrying the session id, when a card is clicked', async () => {
    const { el, drawn } = await mount({ cards: [{ id: SESSION_ID, title: 'First' }] });

    const opened: Array<Record<string, unknown>> = [];
    const onOpen = (e: Event) => opened.push((e as CustomEvent).detail);
    window.addEventListener('card-open', onOpen);
    drawn[0].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    window.removeEventListener('card-open', onOpen);

    // `composed` is what makes this reachable at all: the card is inside the
    // renderer's shadow root, and the host listens on window.
    expect(opened).toEqual([{ sessionId: SESSION_ID, id: SESSION_ID }]);

    el.remove();
  });

  it('dispatches nothing for a card with no session id — there is nothing to open', async () => {
    const { el, drawn } = await mount({ cards: [{ id: '', title: 'Untitled' }] });

    let fired = 0;
    const onOpen = () => { fired += 1; };
    window.addEventListener('card-open', onOpen);
    drawn[0].dispatchEvent(new MouseEvent('click', { bubbles: true, composed: true }));
    window.removeEventListener('card-open', onOpen);

    expect(fired).toBe(0);

    el.remove();
  });

  it('paints no cards when /cards is absent, rather than an empty grid of nothing', async () => {
    const { el, drawn } = await mount({}); // the model sent no cards channel

    expect(drawn).toHaveLength(0);

    el.remove();
  });

  it('follows the data model after the first paint — a rename written into /cards is what the card on screen says', async () => {
    const { el, drawn } = await mount({ cards: [{ id: SESSION_ID, title: 'Old title' }] });
    expect(drawn[0].title).toBe('Old title');

    // The shell keeps no second copy of the card list: it holds the surface's data
    // model, and a rename writes the new title into /cards (WritingAreaIndex →
    // handlePromptTitleChange). That write is only visible if the renderer follows
    // the model AFTER the first paint. When the shell kept its own copy instead, the
    // card on screen went on saying "Old title" — and the copy, plus the picture of
    // the library in Grace's seat, said otherwise. Two consoles, disagreeing.
    el.dataModel = { cards: [{ id: SESSION_ID, title: 'New title' }] };
    await el.updateComplete;

    const grid = el.shadowRoot!.querySelector('a2ui-console-card-grid') as CardEl;
    await grid.updateComplete;
    const after = Array.from(
      grid.shadowRoot!.querySelectorAll('agent-card-element'),
    ) as CardEl[];

    expect(after).toHaveLength(1);
    expect(after[0].title).toBe('New title');
    // The id survives the redraw. Without it the renamed card would still open
    // nothing and delete nothing — the id IS the session id.
    expect(after[0].id).toBe(SESSION_ID);

    el.remove();
  });
});
