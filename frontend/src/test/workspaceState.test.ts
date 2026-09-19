/**
 * THE PLACE, AS DATA — what a package saves and what it gets back.
 *
 * The owner's contract, 2026-09-18: "I pan and zoom live inside the bar… the element holds
 * them, the package doesn't. That's a small contract, the same kind." So the elements answer
 * for their own state (`viewState`, `workspaceState`) and take it back (`applyViewState`,
 * `applyWorkspaceState`), and the save is a READ of those answers — nothing is stored in a
 * second place, and no event was added to carry it.
 *
 * Two rules are pinned here because both are silent when they work and damaging when they do
 * not:
 *
 *   1. A PARTIAL RECORD CHANGES NOTHING. A package opened without the drawing, or saved by a
 *      client that could not see her column, must not rearrange what it cannot describe.
 *   2. A RESTORED VIEW IS THE OPERATOR'S OWN. It marks the view touched, so the next resize
 *      re-fits nothing and the drawing comes back where it was left.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/agent-flow';
import '@/components/lit/agent-canvas';
import '@/components/lit/workspace-layout';

type El = HTMLElement & Record<string, any>;

const mounted: El[] = [];

const settle = async (el: El) => {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await el.updateComplete;
  }
};

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

describe('<agent-flow> — the drawing answers for its own view', () => {
  it('reports the view it holds, and takes a complete one back', async () => {
    const flow = document.createElement('agent-flow') as El;
    // A box, so anything that measures does not measure zero.
    flow.getBoundingClientRect = () => ({ width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(flow);
    mounted.push(flow);
    await settle(flow);

    const saved = { zoom: 1.4, panX: -220, panY: 88 };
    expect(flow.applyViewState(saved)).toBe(true);
    await settle(flow);
    expect(flow.viewState()).toEqual(saved);
  });

  it('changes nothing when the record is partial or unusable', async () => {
    const flow = document.createElement('agent-flow') as El;
    flow.getBoundingClientRect = () => ({ width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(flow);
    mounted.push(flow);
    await settle(flow);

    const before = flow.viewState();
    expect(flow.applyViewState({ zoom: 2, panX: 10 })).toBe(false);      // no panY
    expect(flow.applyViewState({ zoom: NaN, panX: 10, panY: 10 })).toBe(false);
    expect(flow.applyViewState(null)).toBe(false);
    expect(flow.applyViewState(undefined)).toBe(false);
    expect(flow.viewState()).toEqual(before);
  });
});

describe('<agent-canvas> — the plug-in answers for her column and the drawing', () => {
  it('reports the seat it is holding, and restores one', async () => {
    const canvas = document.createElement('agent-canvas') as El;
    document.body.appendChild(canvas);
    mounted.push(canvas);
    await settle(canvas);

    // The default: she loads away, at the open width, with no drawing behind the slot.
    const opening = canvas.workspaceState();
    expect(opening.seat.open).toBe(false);
    expect(opening.flow).toBeNull();

    expect(canvas.applyWorkspaceState({ seat: { open: true, width: 700 } })).toBe(true);
    await settle(canvas);
    const restored = canvas.workspaceState();
    expect(restored.seat.open).toBe(true);
    expect(restored.seat.width).toBe(700);
    expect(canvas.style.getPropertyValue('--seat-w')).toBe('700px');
  });

  it('leaves the arrangement alone when the record says nothing about it', async () => {
    const canvas = document.createElement('agent-canvas') as El;
    document.body.appendChild(canvas);
    mounted.push(canvas);
    await settle(canvas);

    expect(canvas.applyWorkspaceState({})).toBe(true);   // a record with no seat in it
    expect(canvas.applyWorkspaceState(null)).toBe(false);
    expect(canvas.workspaceState().seat.open).toBe(false);
  });

  it('hands the view to the drawing in its slot, and reads it back', async () => {
    const canvas = document.createElement('agent-canvas') as El;
    const flow = document.createElement('agent-flow') as El;
    flow.setAttribute('slot', 'flow');
    flow.getBoundingClientRect = () => ({ width: 900, height: 600, top: 0, left: 0, right: 900, bottom: 600, x: 0, y: 0, toJSON: () => ({}) });
    canvas.appendChild(flow);
    document.body.appendChild(canvas);
    mounted.push(canvas);
    await settle(canvas);
    await settle(flow);

    const saved = { zoom: 0.8, panX: 12, panY: -30 };
    canvas.applyWorkspaceState({ seat: { open: true, width: 640 }, flow: saved });
    await settle(canvas);
    await settle(flow);

    expect(canvas.workspaceState().flow).toEqual(saved);
  });
});

describe('<workspace-layout> — the widths answer, read at Save', () => {
  it('reports the panes it is rendering, and null for a docked prompt', async () => {
    const layout = document.createElement('workspace-layout') as El;
    layout.getBoundingClientRect = () => ({ width: 1200, height: 800, top: 0, left: 0, right: 1200, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
    document.body.appendChild(layout);
    mounted.push(layout);
    await settle(layout);

    // The panes are what the element renders; the accessor MEASURES them rather than
    // re-deriving the flex arithmetic (a second derivation is how two numbers disagree).
    const left = layout.renderRoot.querySelector('.pane.left') as El;
    const right = layout.renderRoot.querySelector('.pane.right') as El;
    expect(left).toBeTruthy();
    expect(right).toBeTruthy();
    left.getBoundingClientRect = () => ({ width: 420, height: 800, top: 0, left: 0, right: 420, bottom: 800, x: 0, y: 0, toJSON: () => ({}) });
    right.getBoundingClientRect = () => ({ width: 650, height: 800, top: 0, left: 550, right: 1200, bottom: 800, x: 550, y: 0, toJSON: () => ({}) });

    expect(layout.widths()).toEqual({ left: 420, chat: 650 });

    // On its rail the prompt has no width to record — the ColumnWidths meaning of null.
    layout.leftCollapsed = true;
    await settle(layout);
    expect(layout.widths().left).toBeNull();
    expect(layout.widths().chat).toBe(650);
  });
});
