/**
 * <workspace-layout> — who owns the third column's open state.
 *
 * This is a test for a measured failure, not for a data structure. On the console
 * on 2026-09-17 a rail click opened the chat column to 726px, one trace update
 * landed, and it snapped back to 74px with the Trace view inside it — the click
 * looked like it had done nothing twice over.
 *
 * The cause is not in this element's logic, it is in who is allowed to write the
 * flag. The surface sends `isThirdOpen: false` because the console's column must
 * LOAD closed; the operator flips the same flag from the rail. The renderer
 * re-assigns a component's props whenever the DATA MODEL changes, not only when a
 * new assembly lands — so a telemetry update re-asserted `false` and the payload won.
 *
 * The contract these tests pin, in one sentence: a payload assignment is honoured
 * until the operator touches the pane, and ignored after that — but the element
 * itself can always still change it.
 *
 * jsdom has no layout, so nothing here asserts widths. The flag is the fact.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/workspace-layout';
import type { WorkspaceLayout } from '@/components/lit/workspace-layout';

type LayoutEl = WorkspaceLayout & { updateComplete: Promise<unknown> };
type Layout = LayoutEl;

const mounted: LayoutEl[] = [];

const mount = async () => {
  const el = document.createElement('workspace-layout') as LayoutEl;
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return el;
};

/**
 * A LAYOUT WITH A PANEL IN ITS RIGHT SLOT — which is what a rail belongs to. Since
 * 2026-09-18 a rail only moves its OWN column (see the element): an empty pane has nothing
 * to open, so a tab-change with nothing slotted is correctly ignored.
 */
const mountWithPanel = async () => {
  const el = await mount();
  const panel = document.createElement('div');
  panel.setAttribute('slot', 'right');
  el.appendChild(panel);
  el.shadowRoot!.querySelector('slot[name="right"]')!.dispatchEvent(new Event('slotchange'));
  await el.updateComplete;
  return el;
};

/** What the rail raises: chat-panel re-emits its nav bar's event, and this hears it. */
const railTab = (el: LayoutEl, tab: string) =>
  el.dispatchEvent(new CustomEvent('tab-change', { detail: { tab } }));

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

describe('<workspace-layout> third column: payload first, operator after', () => {
  it('honours a payload assignment before the operator has touched it', async () => {
    const el = await mount();
    // The console's surface: the column loads closed.
    el.isThirdOpen = false;
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(false);
  });

  it('ignores a payload re-assert once the operator has opened the column', async () => {
    const el = await mountWithPanel();
    el.isThirdOpen = false; // the assembly closes it
    await el.updateComplete;

    railTab(el, 'trace'); // the operator opens it by asking to see the view
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(true);

    // The re-assert that used to snap it shut: same payload, new data-model object.
    el.isThirdOpen = false;
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(true);
  });

  it('still lets the element close what it opened, so the rail is one control', async () => {
    const el = await mountWithPanel();
    railTab(el, 'chat');
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(true);

    // The active tab clicked again: the rail collapsing itself.
    railTab(el, '');
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(false);

    // ...and a payload re-assert cannot undo THAT either.
    el.isThirdOpen = true;
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(false);
  });
});

/**
 * The left column: docked on Run, reopened by the grip, and never fought over.
 *
 * The prompt is READ as text and then watched as a picture — that is the same
 * process seen twice, so the prompt is docked rather than closed: its rail and one
 * grip stay, and opening it back up is a single gesture. These tests pin the part
 * that is easy to get wrong: who owns that state afterwards, and who may not undo
 * it. The widths are the browser's; the flag is the fact.
 */
describe('<workspace-layout> left column: a Run docks the prompt, the grip brings it back', () => {
  /** The grip exists only when a middle pane does — the surface's slot decides. */
  const mountWithMiddle = async () => {
    const el = await mount();
    const middle = document.createElement('div');
    middle.setAttribute('slot', 'middle');
    el.appendChild(middle);
    await el.updateComplete;
    await new Promise((r) => setTimeout(r, 0)); // slotchange is delivered async
    await el.updateComplete;
    return el;
  };

  /**
 * A RUN, QUEUED. The dock waits for the host that is about to swap its middle column (see
 * the element): a run-click arms it, and `flow-view-ready` lands it. Dispatching both is what
 * a host with a canvas does; the fallback path has its own test below.
 */
const runAndSwap = async (el: LayoutEl) => {
  el.dispatchEvent(new CustomEvent('run-click', { detail: {} }));
  await el.updateComplete;
  el.dispatchEvent(new CustomEvent('flow-view-ready', {}));
  await el.updateComplete;
};

const gripDown = (el: LayoutEl) => {
    const grip = el.shadowRoot!.querySelector('.gripper') as HTMLElement | null;
    expect(grip).toBeTruthy();
    // POINTERDOWN, because that is what the bar listens for now: the gesture CAPTURES the
    // pointer, so a hand that lets go outside the window still ends the drag instead of
    // leaving the column following a hand that is no longer there.
    grip!.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, composed: true, button: 0, clientX: 60 }));
  };

  it('a Run request docks the prompt', async () => {
    const el = await mountWithMiddle();
    expect(el.leftCollapsed).toBe(false);

    // The Run button lives in the left column's own footer; the column hears it — and the
    // dock lands with the canvas, not before it.
    await runAndSwap(el);

    expect(el.leftCollapsed).toBe(true);
  });

  it('the grip brings the prompt back — docking is not closing', async () => {
    const el = await mountWithMiddle();
    await runAndSwap(el);
    expect(el.leftCollapsed).toBe(true);

    gripDown(el);
    await el.updateComplete;

    expect(el.leftCollapsed).toBe(false);
  });

  it('a payload may dock it before the operator acts, and never after', async () => {
    const el = await mountWithMiddle();

    // Before anyone touches it: the surface may say (the console loads its chat shut
    // the same way). Honoured.
    el.leftCollapsed = true;
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);

    // A payload may not reopen the column a Run just docked.
    el.leftCollapsed = false;
    await el.updateComplete;
    // (still within the payload's rights — the Run has not happened yet)
    expect(el.leftCollapsed).toBe(false);

    await runAndSwap(el);
    expect(el.leftCollapsed).toBe(true);

    el.leftCollapsed = false; // the re-assert that would undo the Run
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);

    // ...and once the operator has the grip, the payload has lost it for good.
    gripDown(el);
    await el.updateComplete;
    el.leftCollapsed = true;
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(false);
  });

  it('does not draw a pane there is nothing to put in', async () => {
    // Her panel can MOVE: the flow view composes <agent-canvas> in the middle column and
    // puts the same chat panel inside it, leaving the right slot empty. An empty pane
    // still reserved its floor — measured 104px of dead column beside the drawing
    // (2026-09-18). A pane with nothing in it is not drawn at all.
    const el = document.createElement('workspace-layout') as Layout;
    document.body.appendChild(el);
    await el.updateComplete;
    mounted.push(el);

    const rightPane = () => el.shadowRoot!.querySelector('.pane.right') as HTMLElement | null;
    const isDimmed = () => rightPane()!.classList.contains('empty');

    // The pane is DRAWN even when empty — its slot is the observer, and an observer
    // cannot live behind the thing it is watching for. It takes no space instead.
    expect(rightPane()).toBeTruthy();
    expect(isDimmed()).toBe(true);

    const chat = document.createElement('div');
    chat.setAttribute('slot', 'right');
    el.appendChild(chat);
    el.shadowRoot!.querySelector('slot[name="right"]')!.dispatchEvent(new Event('slotchange'));
    await el.updateComplete;
    expect(isDimmed()).toBe(false);

    chat.remove();
    el.shadowRoot!.querySelector('slot[name="right"]')!.dispatchEvent(new Event('slotchange'));
    await el.updateComplete;
    expect(isDimmed()).toBe(true);
  });

  it('does NOT dock between the Run and the canvas: the queue is the fix', async () => {
    // The bug this file now pins (owner, 2026-09-18): "it's closing the left side correctly
    // but in doing so it pulls the chat all the way over… and then when I load the canvas, I
    // push the chat back." Two frames, two positions for her column. So a Run ALONE must not
    // move the prompt — the dock waits for the host to say the new middle column is up.
    const el = await mountWithMiddle();
    el.dispatchEvent(new CustomEvent('run-click', { detail: {} }));
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(false);

    // ...and the fallback still docks a host that never signals, so no surface is stuck.
    await new Promise((r) => setTimeout(r, 500));
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);
  });
});

/**
 * HER COLUMN'S WIDTH — a number the element holds, and the hand that changes it.
 *
 * These pin the shape the owner asked for on 2026-09-18, after two rounds of the width
 * drifting: "you have removed the click feature from the icon… if I click chat she should
 * open and close, that's the same function for those buttons that happens on the console",
 * and, about the gripper, "I have to use the cursor. It holds my cursor and it won't let me
 * release it."
 *
 * jsdom has no layout, so the box is stubbed: what is asserted is the NUMBER the element
 * decides, and the one line of it that reaches the screen (the pane's own style).
 */
describe('<workspace-layout> her column: 650, and the cursor', () => {
  type Width = { _rightPx: number };
  const widthOf = (el: LayoutEl) => (el as unknown as Width)._rightPx;
  const rightPaneStyle = (el: LayoutEl) =>
    (el.shadowRoot!.querySelector('.pane.right') as HTMLElement).getAttribute('style') ?? '';

  /** A layout with a panel on the right and a box big enough to size her against. */
  const withBox = async (hostWidth = 1375) => {
    const el = await mountWithPanel();
    Object.defineProperty(el, 'clientWidth', { value: hostWidth, configurable: true });
    el.getBoundingClientRect = () => ({
      left: 0, right: hostWidth, width: hostWidth,
      top: 0, bottom: 900, height: 900, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;
    return el;
  };

  it('opens at 650 — the design\'s width, on the pane itself', async () => {
    const el = await withBox();
    expect(widthOf(el)).toBe(650);
    expect(rightPaneStyle(el)).toContain('650px');
  });

  it('the Chat button closes her and opens her again at 650', async () => {
    const el = await withBox();

    el.dispatchEvent(new CustomEvent('collapse-toggle', { detail: { collapsed: true } }));
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(false);
    expect(rightPaneStyle(el)).toContain('104px');

    el.dispatchEvent(new CustomEvent('collapse-toggle', { detail: { collapsed: false } }));
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(true);
    expect(widthOf(el)).toBe(650);
    expect(rightPaneStyle(el)).toContain('650px');
  });

  it('takes its width from the CURSOR, so a reflow cannot separate the edge from the hand', async () => {
    const el = await withBox();

    // The hand takes her spacer 400px from the host's right edge.
    el.dispatchEvent(new CustomEvent('input-resize-start', { detail: { clientX: 975, clientY: 10 } }));
    expect(widthOf(el)).toBe(400);

    // THE SHELL REFLOWS UNDER THE HAND — the window narrows, a pane changes, the canvas
    // arrives. The pointer has not moved. A drag measured by TRAVEL would keep the width it
    // started with (400) and the edge would leave the cursor; measured by POSITION, her
    // column is whatever is between the cursor and the edge it hangs from (300).
    el.getBoundingClientRect = () => ({
      left: 0, right: 1275, width: 1275,
      top: 0, bottom: 900, height: 900, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;
    el.dispatchEvent(new CustomEvent('input-resize-move', { detail: { clientX: 975, clientY: 10 } }));
    expect(widthOf(el)).toBe(300);
  });

  it('let go at the floor and she closes; a pull away from it is a re-open', async () => {
    const el = await withBox();

    // The hand takes her spacer 25px from the host's right edge — under her floor (the rail
    // plus the spacer that sits inside the pane), so she lands ON the floor, never below it.
    el.dispatchEvent(new CustomEvent('input-resize-start', { detail: { clientX: 1350, clientY: 10 } }));
    expect(widthOf(el)).toBe(104);
    el.dispatchEvent(new CustomEvent('input-resize-end', {}));
    await el.updateComplete;
    expect(el.isThirdOpen).toBe(false);
  });
});
