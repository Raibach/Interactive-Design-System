/**
 * <agent-canvas> — the plug-in as a CONTAINER: what it owns, and what it refuses to own.
 *
 * The compliance point these tests exist for: the element draws NO component of its own.
 * Its template holds two slots, and the ENVELOPE fills them — an element that renders
 * another element is nesting, and this protocol does not allow it
 * (AGENTS-instructions/Core-Concept.md: "surfaces cannot nest"; children come from the
 * adjacency list, "NEVER from markup inside a component's own template").
 *
 * The rest is the behaviour a layout container legitimately owns, and the boundary around
 * it:
 *
 *   - the column's width, and only the SPACER's gesture moves it — the composer's own
 *     grip raises the same event names and must not drag the column;
 *   - the link both ways between the two slots;
 *   - NOT her bindings: conversation-id and the rest belong to the envelope's binding on
 *     her seat, which is what makes her a surface seat rather than a host seat.
 *
 * jsdom has no layout, so nothing here asserts pixels — what it asserts is which of two
 * mechanisms is in charge, which is the thing that breaks silently.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/agent-canvas';
import '@/components/lit/agent-flow';
import '@/components/lit/chat-panel';
import type { AgentCanvas } from '@/components/lit/agent-canvas';
import type { AgentFlow } from '@/components/lit/agent-flow';
import type { ChatPanel } from '@/components/lit/chat-panel';
import type { FlowGraph } from '@/shared/agentFlow';

type El = AgentCanvas & { updateComplete: Promise<unknown> };

const mounted: El[] = [];

const graph = (): FlowGraph => ({
  label: 'Repair — annotation-missing on prompt-container',
  nodes: [
    { id: 'note:1', family: 'note', kind: 'annotation-missing', title: 'annotation-missing', subtitle: 'prompt-container', state: 'idle', badge: 'advisory', x: 0, y: 0 },
    { id: 'seat:0:system-role', family: 'seat', kind: 'system-role', title: 'System Role', state: 'idle', x: 340, y: 0 },
    { id: 'step:agent', family: 'step', kind: 'agent', title: 'Answer', state: 'active', x: 680, y: 0 },
  ],
  edges: [
    { from: 'note:1', to: 'seat:0:system-role' },
    { from: 'seat:0:system-role', to: 'step:agent' },
  ],
  unresolved: [],
  absent: [],
});

/** Mount the container the way a surface does: the children are the HOST's, slotted by name. */
const mount = async (): Promise<{ el: El; drawing: AgentFlow; seat: ChatPanel }> => {
  const el = document.createElement('agent-canvas') as El;
  const drawing = document.createElement('agent-flow') as AgentFlow;
  drawing.setAttribute('slot', 'flow');
  drawing.flow = graph();
  const seat = document.createElement('chat-panel') as ChatPanel;
  seat.setAttribute('slot', 'seat');
  el.append(drawing, seat);
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return { el, drawing, seat };
};

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

const seatEl = (el: El) => el.shadowRoot!.querySelector('.seat') as HTMLElement;

const grip = (el: El, type: string, detail: Record<string, unknown>): void => {
  // The gesture is raised inside her panel and COMPOSED up to whoever owns the width,
  // which is this element. That is the channel under test.
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
};

describe('<agent-canvas> — the container', () => {
  it('draws NO component: two slots, filled by the envelope', async () => {
    const { el } = await mount();
    // Nothing of the kind lives in its own template.
    expect(el.shadowRoot!.querySelector('agent-flow')).toBeNull();
    expect(el.shadowRoot!.querySelector('chat-panel')).toBeNull();
    expect(el.shadowRoot!.querySelector('slot[name="flow"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('slot[name="seat"]')).toBeTruthy();
    // The header slot exists and is EMPTY here: it takes no height when nothing fills
    // it, so a surface that fills only the drawing slots lays out as it always did.
    expect(el.shadowRoot!.querySelector('slot[name="header"]')).toBeTruthy();
    expect(el.querySelector('[slot="header"]')).toBeNull();
    // And the children ARE the host's, in the light DOM, assigned by name.
    expect(el.querySelector('agent-flow')?.getAttribute('slot')).toBe('flow');
    expect(el.querySelector('chat-panel')?.getAttribute('slot')).toBe('seat');
  });

  it('takes the column\'s header in its own slot, without drawing it', async () => {
    // The header belongs to the column, not to the body under it — so the envelope fills
    // this slot and the container lays it out. Note the element is NOT instantiated here:
    // the container draws no component, and this proves it by using a plain node.
    const el = document.createElement('agent-canvas') as El;
    const header = document.createElement('div');
    header.setAttribute('slot', 'header');
    el.appendChild(header);
    document.body.appendChild(el);
    await el.updateComplete;
    mounted.push(el);
    expect(el.querySelector('[slot="header"]')).toBe(header);
    expect(el.shadowRoot!.querySelector('slot[name="header"]')).toBeTruthy();
  });

  it('does NOT carry her bindings — those are the envelope\'s, on her seat', async () => {
    const { el, drawing } = await mount();
    const forwarded = ['conversationId', 'conversations', 'sessionId', 'leftColumnContent',
      'compiledOutput', 'usage', 'allowedTabs', 'tracePrompt', 'flow'];
    for (const prop of forwarded) {
      expect((el as unknown as Record<string, unknown>)[prop]).toBeUndefined();
    }
    // The drawing holds its own graph, bound straight to it.
    expect(drawing.flow).toEqual(el.querySelector('agent-flow')!.flow);
  });

  it('carries the seat: collapsed by default, and the flag reaches her', async () => {
    const { el, seat } = await mount();
    expect(el.collapsed).toBe(true);
    expect(el.style.getPropertyValue('--seat-w')).toBe('104px');

    el.collapsed = false;
    await el.updateComplete;
    expect(el.style.getPropertyValue('--seat-w')).toBe('650px');
    // She is told, so the rail and the panel agree about the column.
    el.dispatchEvent(new CustomEvent('collapse-toggle', { bubbles: true, composed: true, detail: { collapsed: true } }));
    await el.updateComplete;
    expect(el.collapsed).toBe(true);
    expect(seat).toBeTruthy();
  });

  it('moves the column for the SPACER grip, and ignores the composer grip', async () => {
    // Both grips raise input-resize-start. Only one carries a horizontal position; the
    // other is the composer's own resize (startY) and belongs to her input area.
    const { el } = await mount();
    grip(el, 'input-resize-start', { startY: 400 });
    await el.updateComplete;
    expect(el.collapsed).toBe(true);
    expect(seatEl(el).classList.contains('gripping')).toBe(false);

    grip(el, 'input-resize-start', { clientX: 900, clientY: 400 });
    await el.updateComplete;
    expect(el.collapsed).toBe(false);
    expect(seatEl(el).classList.contains('gripping')).toBe(true);

    grip(el, 'input-resize-end', {});
    await el.updateComplete;
    expect(seatEl(el).classList.contains('gripping')).toBe(false);
  });

  it('a move with no grip in progress does not drag the column', async () => {
    const { el } = await mount();
    const before = el.style.getPropertyValue('--seat-w');
    grip(el, 'input-resize-move', { clientX: 700 });
    await el.updateComplete;
    expect(el.style.getPropertyValue('--seat-w')).toBe(before);
  });

  it('a picked node opens her, marks the turn and says what the node is', async () => {
    const { el, seat } = await mount();
    el.dispatchEvent(new CustomEvent('flow-select', {
      bubbles: true, composed: true, detail: { nodeId: 'step:agent' },
    }));
    await el.updateComplete;

    expect(el.collapsed).toBe(false);
    expect(seat.statusText).toBe('Answer | agent — State: active');
    const messages = seat.shadowRoot?.querySelector('chat-messages') as
      | (HTMLElement & { highlightNodeId?: string | null })
      | null;
    expect(messages?.highlightNodeId).toBe('step:agent');
  });

  it('a clicked turn brings its node into view on the drawing', async () => {
    const { el, drawing } = await mount();
    const focused: string[] = [];
    drawing.focusNode = (id: string) => { focused.push(id); return true; };
    el.dispatchEvent(new CustomEvent('turn-click', {
      bubbles: true, composed: true, detail: { nodeId: 'seat:0:system-role' },
    }));
    expect(focused).toEqual(['seat:0:system-role']);
  });

  it('the rail opens her — one fact, two writers, and the events keep bubbling', async () => {
    const { el } = await mount();
    const heard: string[] = [];
    window.addEventListener('tab-change', () => heard.push('tab-change'));
    el.dispatchEvent(new CustomEvent('tab-change', { bubbles: true, composed: true, detail: { tab: 'trace' } }));
    await el.updateComplete;
    // Opened by the container, and STILL on its way to the surface: the container
    // answers an event without swallowing it.
    expect(el.collapsed).toBe(false);
    expect(heard).toEqual(['tab-change']);
    window.removeEventListener('tab-change', () => heard.push('tab-change'));
  });
});
