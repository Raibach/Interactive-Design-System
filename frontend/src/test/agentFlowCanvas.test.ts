/**
 * <agent-flow> — the canvas behaves, and says only what it knows.
 *
 * jsdom has no layout and its pointer support is partial, so nothing here asserts
 * pixels. What it asserts is the CONTRACT the host depends on:
 *
 *   - one node drawn per node given, and nothing drawn for a state that has no news
 *     (an idle node wears no mark — a mark is a claim);
 *   - a drag moves the node by the pointer's delta and emits ONCE, on release;
 *     a click selects and does not emit a move;
 *   - a connection is port to port, and port to port only;
 *   - every control emits, because an emitted event with no listener is what the
 *     catalog audit reports as event-unheard;
 *   - unset is not empty: no graph draws the waiting line, an empty graph draws the
 *     "nothing to draw" line, and those are different claims about the app.
 *
 * The last test feeds the element a graph built by the real repair builder, so the
 * seam between the model and the view is exercised too — not only hand-made objects.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/agent-flow';
import type { AgentFlow } from '@/components/lit/agent-flow';
import { buildRepairFlow, type FlowGraph } from '@/shared/agentFlow';

type El = AgentFlow & { updateComplete: Promise<unknown> };

const mounted: El[] = [];

const mount = async (flow?: FlowGraph): Promise<El> => {
  const el = document.createElement('agent-flow') as El;
  if (flow) el.flow = flow;
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return el;
};

/**
 * A pointer event, with the MouseEvent fallback. jsdom implements PointerEvent in
 * current versions but does not promise it everywhere, and the element listens on
 * the plain pointer channel — the fallback keeps the test about behaviour rather
 * than about which constructor the environment happens to ship.
 */
const pe = (type: string, opts: Record<string, unknown> = {}): Event => {
  const Ctor = (globalThis as { PointerEvent?: typeof MouseEvent }).PointerEvent ?? MouseEvent;
  return new Ctor(type, { bubbles: true, composed: true, cancelable: true, button: 0, ...opts });
};

const graph = (): FlowGraph => ({
  label: 'Repair — annotation-missing on prompt-container',
  nodes: [
    { id: 'note:1', family: 'note', kind: 'annotation-missing', title: 'annotation-missing', subtitle: 'prompt-container', state: 'idle', badge: 'advisory', x: 0, y: 0 },
    { id: 'seat:0:system-role', family: 'seat', kind: 'system-role', title: 'System Role', state: 'idle', x: 340, y: 0 },
    { id: 'step:agent', family: 'step', kind: 'agent', title: 'Answer', state: 'failed', x: 680, y: 0 },
  ],
  edges: [
    { from: 'note:1', to: 'seat:0:system-role' },
    { from: 'seat:0:system-role', to: 'step:agent' },
  ],
  unresolved: [],
  absent: [],
});

const node = (el: El, id: string): HTMLElement =>
  el.shadowRoot!.querySelector(`[data-node-id="${id}"]`) as HTMLElement;

const emit = (el: El, name: string): CustomEvent[] => {
  const seen: CustomEvent[] = [];
  el.addEventListener(name, (e) => seen.push(e as CustomEvent));
  return seen;
};

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

describe('<agent-flow> — drawing', () => {
  it('draws a node per node, with its title, and an edge per edge', async () => {
    const el = await mount(graph());
    expect(el.shadowRoot!.querySelectorAll('.node').length).toBe(3);
    expect(el.shadowRoot!.querySelectorAll('.edge').length).toBe(2);
    expect(node(el, 'note:1').querySelector('.label')!.textContent).toBe('annotation-missing');
    expect(node(el, 'note:1').querySelector('.badge')!.textContent).toBe('advisory');
  });

  it('wears no mark when there is no news, and a mark when there is', async () => {
    const el = await mount(graph());
    // idle: no claim
    expect(node(el, 'note:1').querySelector('.mark')).toBeNull();
    // failed: a claim
    expect(node(el, 'step:agent').querySelector('.mark')!.textContent).toBe('⚠');
  });

  it('carries what it could not name and what it did not draw, and prints neither', async () => {
    // THE CAPTIONS LEFT THE DRAWING on the owner's instruction (2026-09-18): what the graph
    // could not name and what it did not draw are said on the message line at the top of her
    // column and in her thread — "that's where we're supposed to have messages like
    // [tool-call: the prompt names no tool…]". The element never narrates, so the two facts
    // ride the graph and never appear as text on the canvas.
    const el = await mount({
      ...graph(),
      unresolved: ['Hero Specs'],
      absent: [{ step: 'data-insert', why: 'the finding names no file, so there is nothing to write' }],
    });
    const text = el.shadowRoot!.textContent!;
    expect(text).not.toContain('Hero Specs');
    expect(text).not.toContain('the finding names no file');
    expect(el.shadowRoot!.querySelector('.note')).toBeNull();
    expect(el.flow!.unresolved).toEqual(['Hero Specs']);
    expect(el.flow!.absent).toEqual([
      { step: 'data-insert', why: 'the finding names no file, so there is nothing to write' },
    ]);
  });

  it('unset is not empty: waiting is not the same claim as nothing to draw', async () => {
    const waiting = await mount(undefined);
    expect(waiting.shadowRoot!.textContent).toContain('Waiting for the flow');

    const empty = await mount({ label: 'x', nodes: [], edges: [], unresolved: [], absent: [] });
    expect(empty.shadowRoot!.textContent).toContain('Nothing to draw yet');
  });

  it('draws its edges as SVG, not as elements that merely look like SVG', async () => {
    // Measured in the app on 2026-09-18: every edge path came out as
    // HTMLUnknownElement in the XHTML namespace — the right class, a correct d
    // attribute, and no pixels, because SVG's renderer ignores an HTML node inside
    // its tree. jsdom keeps namespaces, so this is the test that fails without the
    // svg template tag.
    const el = await mount(graph());
    const edge = el.shadowRoot!.querySelector('path.edge') as Element;
    expect(edge).toBeTruthy();
    expect(edge.namespaceURI).toBe('http://www.w3.org/2000/svg');
    // The namespace is the fact that fails: an HTMLUnknownElement named PATH sits in
    // the XHTML namespace. jsdom implements SVGElement but not getBBox, so the
    // browser-only method is deliberately NOT asserted here — it would pin jsdom's
    // gaps rather than this component's behaviour.
    expect(edge instanceof SVGElement).toBe(true);
  });

  it('announces what it was handed — once per document, not per state', async () => {
    // The canvas's half of the conversation with the chat: it says what it holds so
    // Grace can read it out and ask. Per DOCUMENT, because a run rebuilds the graph
    // at every await and six identical announcements would be noise, not news.
    const el = await mount();
    const opened: Array<Record<string, unknown>> = [];
    el.addEventListener('flow-opened', (e) => opened.push((e as CustomEvent).detail));

    el.flow = graph();
    await el.updateComplete;
    expect(opened.length).toBe(1);
    expect(opened[0]).toMatchObject({
      label: 'Repair — annotation-missing on prompt-container',
      notes: 1,
      seats: 1,
      steps: 1,
      unresolved: [],
      absent: [],
    });

    // Same document, a new state (the run moving on): still one line.
    const moved = graph();
    moved.nodes = moved.nodes.map((n) => (n.id === 'step:agent' ? { ...n, state: 'done' as const } : n));
    el.flow = moved;
    await el.updateComplete;
    expect(opened.length).toBe(1);

    // A different document announces again, and carries what it could not draw.
    el.flow = {
      ...graph(),
      label: 'another repair',
      unresolved: ['Hero Specs'],
      absent: [{ step: 'data-insert', why: 'the finding names no file' }],
    };
    await el.updateComplete;
    expect(opened.length).toBe(2);
    expect(opened[1]).toMatchObject({ unresolved: ['Hero Specs'], absent: [{ step: 'data-insert', why: 'the finding names no file' }] });
  });

  it('points at a node when the conversation asks it to, and refuses when it cannot', async () => {
    // The chat's half: Grace says "this is the row nobody named" and the canvas puts
    // it under the person's eyes. A refusal is a returned false, never a silent no-op.
    const el = await mount(graph());
    expect(el.focusNode('no-such-node')).toBe(false);
    expect(el.focusNode('seat:0:system-role')).toBe(false); // jsdom has no box to move

    (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const selected: unknown[] = [];
    el.addEventListener('flow-select', (e) => selected.push((e as CustomEvent).detail));

    expect(el.focusNode('seat:0:system-role')).toBe(true);
    await el.updateComplete;
    expect(el.selectedId).toBe('seat:0:system-role');
    expect(selected.at(-1)).toEqual({ nodeId: 'seat:0:system-role' });
    expect(el.zoom).toBeGreaterThan(0);
  });

  it('opens blown up at the beginning — Fit is what shows the whole flow', async () => {
    // The canvas must NOT arrive fitted to everything: a long run would land as a
    // postage stamp. It opens at reading size on the first nodes and the person pans
    // through it; Fit (⛶ / 0) is the "zoom to the edges" control.
    const el = await mount();
    const box = (w: number, h: number) =>
      ({ width: w, height: h, top: 0, left: 0, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => box(800, 600);

    el.flow = graph(); // a new document arrives
    await el.updateComplete;
    // THE PEEK IS THE FLOW'S OWN, at reading size. The drawing is never magnified, so
    // what falls outside the column is decided by how wide the flow is and how wide the
    // column is — not by a number chosen here. In an 800px box this fixture (768 + the
    // corner padding) is cut, which is the cue; in a wider one it is not, which is the
    // truth of that case and not a thing to fake by zooming.
    const span = 680 + 88; // the fixture's furthest node, plus its tile
    expect(el.zoom).toBe(1);
    expect(el.zoom * span + el.panX).toBeGreaterThan(800); // it runs past the edge

    // 1:1 IS THE CEILING, and that is the contract — the drawing is never magnified to
    // fill a box, because the tile a person learned is the size it was drawn at. In a
    // column wider than the flow there is room to spare and nothing to discover; the
    // canvas does not pretend otherwise by zooming in.
    (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => box(1600, 600);
    el.startView();
    await el.updateComplete;
    expect(el.zoom).toBe(1);
    expect(el.zoom * span + el.panX).toBeLessThan(1600); // it fits, and says so

    // In a box too small for the whole drawing, Fit is what makes it all visible.
    (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => box(300, 200);
    el.fit();
    await el.updateComplete;
    expect(el.zoom).toBeLessThan(0.4);
  });

  it('grabbing the canvas pans it in either tool; the hand pans from a node too', async () => {
    const el = await mount(graph());
    (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    const canvas = el.shadowRoot!.querySelector('.canvas') as HTMLElement;
    const panBefore = el.panX;

    // SELECT, on the background: the grab carries the canvas. No tool switch first —
    // there are no scrollbars, so this is the only way the view travels.
    // DISPATCHED AT THE GRID, not at the canvas: that is the element a real press on
    // empty canvas targets, and identity-checking the target against the canvas was
    // what made the app's canvas undraggable while these tests stayed green.
    const grid = el.shadowRoot!.querySelector('.grid') as HTMLElement;
    grid.dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 100 }));
    window.dispatchEvent(pe('pointermove', { clientX: 160, clientY: 100 }));
    window.dispatchEvent(pe('pointerup', { clientX: 160, clientY: 100 }));
    await el.updateComplete;
    expect(el.panX).toBe(panBefore + 60);

    // A press with no travel is still a click: it clears the selection.
    node(el, 'note:1').dispatchEvent(pe('pointerdown', { clientX: 5, clientY: 5 }));
    window.dispatchEvent(pe('pointerup', { clientX: 5, clientY: 5 }));
    await el.updateComplete;
    expect(el.selectedId).toBe('note:1');

    // THE HAND pans from a NODE as well: the tile travels with everything else
    // instead of being dragged out of place.
    (el.shadowRoot!.querySelector('button[aria-label="Hand tool — drag the canvas (H)"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.mode).toBe('hand');

    const panNow = el.panX;
    const moved: unknown[] = [];
    el.addEventListener('flow-node-moved', (e) => moved.push((e as CustomEvent).detail));
    node(el, 'seat:0:system-role').dispatchEvent(pe('pointerdown', { clientX: 200, clientY: 200 }));
    window.dispatchEvent(pe('pointermove', { clientX: 240, clientY: 200 }));
    window.dispatchEvent(pe('pointerup', { clientX: 240, clientY: 200 }));
    await el.updateComplete;
    expect(el.panX).toBe(panNow + 40); // the canvas moved
    expect(moved.length).toBe(0); // and the node did not

    // Back to select: nodes drag again.
    (el.shadowRoot!.querySelector('button[aria-label="Select tool (V)"]') as HTMLElement).click();
    await el.updateComplete;
    expect(el.mode).toBe('');
  });

  it('gives the edge layer a viewport that contains its paths', async () => {
    // Measured in the app on 2026-09-18: the layer was 1px with overflow visible,
    // and eight paths with correct geometry and the right stroke painted NOTHING.
    // A viewport derived from the nodes is the fix, so this pins it.
    const el = await mount(graph());
    const svg = el.shadowRoot!.querySelector('svg.edges') as SVGSVGElement;
    const box = (svg.getAttribute('viewBox') || '').split(/\s+/).map(Number);
    expect(box.length).toBe(4);
    // graph() puts its furthest node at x = 680: the layer must reach past that
    // node's tile, not sit at one pixel.
    expect(box[2]).toBeGreaterThan(680 + 64);
    expect(box[3]).toBeGreaterThan(96);
    expect(svg.style.width).not.toBe('1px');
  });
});

describe('<agent-flow> — the operator gestures', () => {
  it('a click selects, and emitting a selection is not a move', async () => {
    const el = await mount(graph());
    const selected = emit(el, 'flow-select');
    const moved = emit(el, 'flow-node-moved');

    node(el, 'note:1').dispatchEvent(pe('pointerdown', { clientX: 10, clientY: 10 }));
    window.dispatchEvent(pe('pointerup', { clientX: 10, clientY: 10 }));
    await el.updateComplete;

    expect(selected.length).toBe(1);
    expect(selected[0].detail).toEqual({ nodeId: 'note:1' });
    expect(moved.length).toBe(0);
    expect(node(el, 'note:1').classList.contains('sel')).toBe(true);
  });

  it('a drag moves the node by the pointer delta and emits exactly once, on release', async () => {
    const el = await mount(graph());
    const moved = emit(el, 'flow-node-moved');

    node(el, 'note:1').dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 100 }));
    window.dispatchEvent(pe('pointermove', { clientX: 130, clientY: 118 }));
    window.dispatchEvent(pe('pointermove', { clientX: 160, clientY: 136 }));
    // Not yet: a move mid-drag is the element's own business, not the host's.
    expect(moved.length).toBe(0);
    window.dispatchEvent(pe('pointerup', { clientX: 160, clientY: 136 }));
    await el.updateComplete;

    expect(moved.length).toBe(1);
    expect(moved[0].detail).toEqual({ nodeId: 'note:1', x: 60, y: 36 });
  });

  it('a drag that outlives the element lets go', async () => {
    const el = await mount(graph());
    node(el, 'note:1').dispatchEvent(pe('pointerdown', { clientX: 0, clientY: 0 }));
    window.dispatchEvent(pe('pointermove', { clientX: 40, clientY: 0 }));
    // The surface re-renders mid-gesture and replaces the element.
    el.remove();
    // A pointermove after removal must not throw and must not move a phantom node.
    expect(() => window.dispatchEvent(pe('pointermove', { clientX: 900, clientY: 900 }))).not.toThrow();
  });

  it('a click on the background clears the selection', async () => {
    const el = await mount(graph());
    node(el, 'note:1').dispatchEvent(pe('pointerdown', { clientX: 5, clientY: 5 }));
    window.dispatchEvent(pe('pointerup', { clientX: 5, clientY: 5 }));
    await el.updateComplete;

    const selected = emit(el, 'flow-select');
    const canvas = el.shadowRoot!.querySelector('.canvas') as HTMLElement;
    canvas.dispatchEvent(pe('pointerdown', { clientX: 400, clientY: 400 }));
    window.dispatchEvent(pe('pointerup', { clientX: 400, clientY: 400 }));
    await el.updateComplete;

    expect(selected.length).toBe(1);
    expect(selected[0].detail).toEqual({ nodeId: null });
  });

  it('draws a connection from a port to a port, and nowhere else', async () => {
    const el = await mount(graph());
    const connected = emit(el, 'flow-connect');
    const out = node(el, 'note:1').querySelector('.port-right') as HTMLElement;
    const into = node(el, 'seat:0:system-role').querySelector('.port-left') as HTMLElement;

    out.dispatchEvent(pe('pointerdown', { clientX: 64, clientY: 32 }));
    into.dispatchEvent(pe('pointerup', { clientX: 340, clientY: 32 }));
    await el.updateComplete;

    expect(connected.length).toBe(1);
    expect(connected[0].detail).toMatchObject({ from: 'note:1', to: 'seat:0:system-role' });
    // The line is a DRAFT — drawn, and not in the session (10-TODO W2).
    expect(el.drawn.edges.some((e) => e.from === 'note:1' && e.to === 'seat:0:system-role')).toBe(true);
  });

  it('every node has four ports — left, right, top and bottom', async () => {
    const el = await mount(graph());
    const ports = [...node(el, 'note:1').querySelectorAll('.port')].map((p) => p.getAttribute('data-port'));
    expect(ports.sort()).toEqual(['bottom', 'left', 'right', 'top']);
  });

  it("a line released on nothing asks for a node, and the kinds are the prompt's own seats", async () => {
    const el = await mount(graph());
    const connected = emit(el, 'flow-connect');
    const added = emit(el, 'flow-node-added');

    const out = node(el, 'note:1').querySelector('.port-right') as HTMLElement;
    out.dispatchEvent(pe('pointerdown', { clientX: 64, clientY: 32 }));
    window.dispatchEvent(pe('pointerup', { clientX: 500, clientY: 400 }));
    await el.updateComplete;

    // Nothing was dropped ON, so there is no connection — and the picker is open where
    // the line was let go: what kind of node goes here?
    expect(connected.length).toBe(0);
    const picker = el.shadowRoot!.querySelector('.picker') as HTMLElement;
    expect(picker).toBeTruthy();
    const kinds = [...picker.querySelectorAll('.picker-kind')].map((b) => b.textContent);
    // The vocabulary the prompt panel uses, not a second one — derived from the
    // same declaration, so the two cannot drift. It is every seat the panel can
    // show: the six the menu offers plus System Role, which is sticky and has no
    // menu of its own but is still a seat a node can be. Custom Role is absent on
    // purpose: it is on promptSections.ts's UNDECIDED list (10-TODO W5).
    expect(kinds).toEqual([
      'System Role', 'User Role', 'Agent Role', 'Tool Call',
      'Custom Skill', 'Few Shot', 'Constraints', 'Context',
    ]);

    // Choosing a kind makes the node there, wired to the port the line came from.
    (picker.querySelectorAll('.picker-kind')[1] as HTMLElement).click();
    await el.updateComplete;

    expect(added.length).toBe(1);
    const detail = added[0].detail as { nodeId: string; kind: string };
    expect(detail.kind).toBe('user-role');
    expect(el.drawn.nodes.find((n) => n.id === detail.nodeId)?.badge).toBe('unsaved');
    expect(el.drawn.edges.some((e) => e.to === detail.nodeId)).toBe(true);
    expect(node(el, detail.nodeId)).toBeTruthy();
  });

  it("grabbing a line's end moves that end to another port", async () => {
    const el = await mount(graph());
    const handle = el.shadowRoot!.querySelector('.handle[data-handle-key="note:1->seat:0:system-role"]') as HTMLElement;
    expect(handle).toBeTruthy();

    handle.dispatchEvent(pe('pointerdown', { clientX: 340, clientY: 32 }));
    // Let go over the Answer node instead: the line ends there now.
    node(el, 'step:agent').querySelector('.port-top')!.dispatchEvent(pe('pointerup', { clientX: 680, clientY: 40 }));
    await el.updateComplete;

    expect(el.drawn.edges.some((e) => e.from === 'note:1' && e.to === 'step:agent')).toBe(true);
    expect(el.drawn.edges.some((e) => e.from === 'note:1' && e.to === 'seat:0:system-role')).toBe(false);
  });

  it('zooms in and out, and clamps at both ends', async () => {
    const el = await mount(graph());
    const zoomIn = [...el.shadowRoot!.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Zoom in')!;
    const zoomOut = [...el.shadowRoot!.querySelectorAll('button')].find((b) => b.getAttribute('aria-label') === 'Zoom out')!;

    zoomIn.click();
    await el.updateComplete;
    expect(el.zoom).toBeGreaterThan(1);

    for (let i = 0; i < 20; i++) zoomIn.click();
    await el.updateComplete;
    expect(el.zoom).toBe(2);

    for (let i = 0; i < 40; i++) zoomOut.click();
    await el.updateComplete;
    expect(el.zoom).toBe(0.25);
  });

  it('Escape clears the selection', async () => {
    const el = await mount(graph());
    node(el, 'note:1').dispatchEvent(pe('pointerdown', { clientX: 5, clientY: 5 }));
    window.dispatchEvent(pe('pointerup', { clientX: 5, clientY: 5 }));
    await el.updateComplete;
    expect(el.selectedId).toBe('note:1');

    (el.shadowRoot!.querySelector('.canvas') as HTMLElement)
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await el.updateComplete;
    expect(el.selectedId).toBeNull();
  });
});

describe('<agent-flow> — the controls the host answers', () => {
  it('the node toolbar emits run, toggle, delete, ask and more, each with its node', async () => {
    const el = await mount(graph());
    node(el, 'step:agent').dispatchEvent(pe('pointerdown', { clientX: 5, clientY: 5 }));
    window.dispatchEvent(pe('pointerup', { clientX: 5, clientY: 5 }));
    await el.updateComplete;

    const actions: string[] = [];
    el.addEventListener('flow-action', (e) => actions.push((e as CustomEvent).detail.action));
    const buttons = [...node(el, 'step:agent').querySelectorAll('.tb-btn')] as HTMLElement[];
    expect(buttons.length).toBe(5);
    for (const b of buttons) b.click();
    await el.updateComplete;

    expect(actions).toEqual(['run', 'toggle', 'delete', 'ask', 'more']);
  });

  it('run is refused where there is nothing to run — the note and the seat', async () => {
    const el = await mount(graph());
    node(el, 'note:1').dispatchEvent(pe('pointerdown', { clientX: 5, clientY: 5 }));
    window.dispatchEvent(pe('pointerup', { clientX: 5, clientY: 5 }));
    await el.updateComplete;
    const run = node(el, 'note:1').querySelector('.tb-btn') as HTMLButtonElement;
    expect(run.disabled).toBe(true);
  });

  it('every canvas control emits — and the cluster that did not act is GONE', async () => {
    const el = await mount(graph());
    const actions: string[] = [];
    el.addEventListener('flow-action', (e) => actions.push((e as CustomEvent).detail.action));

    const canvasButtons = [...el.shadowRoot!.querySelectorAll('.controls button')] as HTMLElement[];
    // FIVE, NOT TEN. The bottom-left cluster — fit, zoom in, zoom out, select, hand —
    // is the whole control surface now: those move the drawing, which is what this
    // element is for. Fit is disabled in jsdom (no layout, no box — the next test pins
    // that), so it is exercised there.
    expect(canvasButtons.length).toBe(5);
    expect(el.shadowRoot!.querySelector('.controls.re')).toBeNull();
    for (const b of canvasButtons) b.click();
    await el.updateComplete;

    expect(actions).toContain('zoom'); // zoom in / out both report the zoom they landed on
    expect(actions).toContain('tool'); // select and hand are tools, and the choice is announced
    // The removed cluster's four verbs are not merely unrouted — nothing dispatches
    // them, so no host has a handler to keep alive. Removed 2026-09-18 by the owner:
    // "these come from engineers who tend to make feature factories."
    for (const gone of ['add', 'find', 'save', 'panel']) {
      expect(actions).not.toContain(gone);
    }
  });

  it('fit is refused with no box, and fits once there is one', async () => {
    // jsdom has no layout, so the element genuinely has no box. A control that
    // cannot act must SAY so — hence disabled, not silently inert.
    const el = await mount(graph());
    const fitButton = () =>
      [...el.shadowRoot!.querySelectorAll('button')]
        .find((b) => b.getAttribute('aria-label') === 'Fit the flow to the view') as HTMLButtonElement;
    expect(fitButton().disabled).toBe(true);

    const actions: string[] = [];
    el.addEventListener('flow-action', (e) => actions.push((e as CustomEvent).detail.action));
    // Give it the box a real host would; the control reads the box during render,
    // so one update is enough for it to draw itself enabled.
    (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    el.requestUpdate();
    await el.updateComplete;

    expect(fitButton().disabled).toBe(false);
    fitButton().click();
    await el.updateComplete;

    expect(actions).toContain('fit');
    expect(el.zoom).toBeGreaterThan(0);
  });

  it('there is no canvas-level "ask Grace" control any more', async () => {
    // The removed cluster's AI button asked about the whole flow with no subject. Grace
    // is the panel this canvas is drawn BESIDE — she has a seat, a rail and a slot in
    // every assembly that wants her — so the canvas does not need a button that opens a
    // conversation it is already next to. The node toolbar keeps its own ask, because
    // THAT one has a subject: the node in front of the person.
    const el = await mount(graph());
    const asked: unknown[] = [];
    el.addEventListener('flow-action', (e) => asked.push((e as CustomEvent).detail));
    expect(el.shadowRoot!.querySelector('.ctl-ai')).toBeNull();
    expect(asked).toEqual([]);
  });
});

describe('<agent-flow> — the seam with the model', () => {
  it('draws a real repair flow, and the check node carries its verdict sentence', async () => {
    const flow = buildRepairFlow({
      label: 'Repair — annotation-missing on prompt-container',
      finding: {
        id: 'annotation-missing:prompt-container',
        check: 'annotation-missing',
        component: 'prompt-container',
        nodeId: '40000954:23865',
        file: 'frontend/src/components/lit/prompt-input/prompt-container.ts',
        level: 'advisory',
      },
      sections: [
        { name: 'System', type: 'system', content: '' },
        { name: 'User', type: 'user', content: 'Provenance (required):' },
        {
          name: 'Tool Call',
          type: 'tool-call',
          content: 'tool        figma.get_design_context\nfigma node  40000954:23865',
        },
        { name: 'Agent', type: 'agent', content: 'Add the annotation.' },
      ],
      run: { answer: 'received', verdict: { cleared: false, sentence: 'the fresh check still finds it' } },
    });
    const el = await mount(flow);
    await el.updateComplete;

    // Seats key off canonical ids, not labels: the shape is the id.
    expect(node(el, 'seat:0:system-role')).toBeTruthy();
    expect(node(el, 'seat:3:agent-role')).toBeTruthy();
    // A verdict that still derives the finding is a FAILED evaluation, and it says why.
    const evaluation = node(el, 'step:evaluation');
    expect(evaluation.querySelector('.mark')!.textContent).toBe('⚠');
    expect(evaluation.querySelector('.sub')!.textContent).toBe('the fresh check still finds it');
    // No tool is drawn without an address: this prompt has one, so it is.
    expect(node(el, 'step:tool')).toBeTruthy();
  });

  it('draws a plain prompt run: no note node at all, and nothing claims one', async () => {
    // The same seam, for the run that came from no repair: Run in the left column's
    // footer. The model draws no note (see agentFlow.test.ts), and the DRAWING must not
    // put one on screen either — no tile, no label, nothing the eye would read as the
    // head of a flow that has no head. The `flow-opened` announcement carries the same
    // fact, because it is what she says out loud about what she was handed.
    const flow = buildRepairFlow({
      label: 'Prompt - 9/18/2026',
      finding: null,
      sections: [
        { name: 'User', type: 'user', content: 'Summarise the catalog.' },
        { name: 'Agent', type: 'agent', content: 'Answer in one paragraph.' },
      ],
      run: { running: true },
    });
    const el = await mount(flow);
    await el.updateComplete;

    expect(el.drawn.nodes.map((n) => n.id)).toEqual([
      'seat:0:user-role',
      'seat:1:agent-role',
      'step:agent',
      'step:evaluation',
    ]);
    expect(el.shadowRoot!.querySelector('.f-note')).toBeNull();
    expect(node(el, 'seat:0:user-role')).toBeTruthy();
    expect(node(el, 'seat:1:agent-role')).toBeTruthy();
    // The run is in flight, so the answer is the active step and no write is drawn.
    expect(node(el, 'step:agent').querySelector('.mark.active')).toBeTruthy();
    expect(node(el, 'step:data')).toBeNull();

    // The announcement rides the LABEL — the document's own name — so the same flow
    // told twice says nothing twice, and a renamed one speaks. Same rule as before,
    // and it holds for a flow with no note in it just as it does for a repair.
    const opened = emit(el, 'flow-opened');
    el.flow = flow;
    await el.updateComplete;
    expect(opened).toHaveLength(0);
    el.flow = { ...flow, label: 'Prompt - a later run' };
    await el.updateComplete;
    expect(opened).toHaveLength(1);
  });
});

describe('<agent-flow> — the glide', () => {
  // The rule: a move the ELEMENT makes for someone else is eased; a move a HAND makes is
  // exact. It is the same distinction the seat's column draws between its rail's arrival
  // and a grip under the pointer — and it was the owner's note, 2026-09-18: "it should move
  // with some sort of gentle movement, easing, not jerk to that position."
  const sized = (el: El) => {
    (el as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
      ({ width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
  };
  const viewOf = (el: El) => el.shadowRoot!.querySelector('.view') as HTMLElement;

  it('glides when a turn points the drawing at a node', async () => {
    const el = await mount(graph());
    sized(el);
    expect(el.focusNode('step:agent')).toBe(true);
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0));
    await el.updateComplete;
    const view = viewOf(el);
    expect(view.className).toContain('glide');
    // THE DURATION AND THE CURVE ARE NOT ASSERTED HERE, and that is deliberate rather than
    // lazy: jsdom does not compute transition longhands from a stylesheet, so it reports ''
    // for both and a test that "passed" would be measuring jsdom, not the drawing. They are
    // MEASURED IN THE BROWSER instead — 2026-09-18, clicking a turn in her chat:
    //   transition: transform / 0.52s / cubic-bezier(0.22, 1, 0.36, 1)
    //   transform travelled matrix(1,0,0,1,58,44) → matrix(1,0,0,1,868,416), then the class
    //   cleared and the transition read 0s again.
  });

  it('does not glide under a hand: a drag takes the view at once', async () => {
    const el = await mount(graph());
    sized(el);
    el.focusNode('step:agent');
    await el.updateComplete;
    expect(viewOf(el).classList.contains('glide')).toBe(true);

    // A press on the background and a move of the pointer — the hand, not the element.
    el.shadowRoot!.querySelector('.grid')!.dispatchEvent(pe('pointerdown', { clientX: 100, clientY: 100 }));
    window.dispatchEvent(pe('pointermove', { clientX: 140, clientY: 130 }));
    await el.updateComplete;
    expect(viewOf(el).classList.contains('glide')).toBe(false);
    window.dispatchEvent(pe('pointerup', { clientX: 140, clientY: 130 }));
  });
});

describe('`drawn` is a VALUE the save reads, not a method it calls', () => {
  it('answers as a getter — the save once called it and every save threw', async () => {
    // Measured in the app 2026-09-18: "Save failed — flowEl?.drawn is not a function".
    // `drawn` is a getter on this element; the save read it with a call. A value is read.
    const el = await mount(buildRepairFlow({
      label: 'the prompt', finding: null, sections: [{ name: 'System Role', type: 'system', content: 'hello' }],
    }));

    const drawn = (el as unknown as { drawn: unknown }).drawn;
    expect(typeof drawn).toBe('object');
    expect(Array.isArray((drawn as { nodes: unknown[] }).nodes)).toBe(true);
    expect(Array.isArray((drawn as { edges: unknown[] }).edges)).toBe(true);
  });
});
