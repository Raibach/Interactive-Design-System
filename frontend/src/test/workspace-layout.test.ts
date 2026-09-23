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
import '@/components/lit/agent-canvas';
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
 * the WINDOW): a run-click arms it, and `flow-view-ready` lands it. Dispatching both is what
 * a host with a canvas does; the fallback path has its own test below.
 */
const runAndSwap = async (el: LayoutEl) => {
  el.dispatchEvent(new CustomEvent('run-click', { detail: {} }));
  await el.updateComplete;
  window.dispatchEvent(new CustomEvent('flow-view-ready'));
  await el.updateComplete;
};

const gripDown = (el: LayoutEl) => {
    const grip = el.shadowRoot!.querySelector('.gripper') as HTMLElement | null;
    expect(grip).toBeTruthy();
    // MOUSEDOWN, not pointerdown: the bar deliberately does NOT capture the pointer. Capture was
    // tried for the one release it catches and nothing else does, and it cost the whole page — a
    // capture that outlives its pointer sends every later pointer event to that one element, so
    // nothing else can be grabbed (the owner, 2026-09-18: "the left is locked… Grace is locked").
    grip!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, composed: true, button: 0, clientX: 60 }));
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

  it('docks for a run the PERSON did not press — the sign is on the window', async () => {
    /*
     * EVERY RUN DOCKS, NOT ONLY THE ONE THE BUTTON STARTED.
     *
     * The dock waited on two things: a `run-click` timer, and the host's `flow-view-ready`. The
     * second was listened for ON THIS ELEMENT while the host dispatches it on WINDOW, so the two
     * never met — and the dock therefore happened only for a Run the person pressed. A run
     * RELEASED after her review, or one she started herself, moved nothing and the prompt stayed
     * open over the drawing. The owner, 2026-09-23: "on run in all instances … they should
     * collapse."
     *
     * This test never dispatches a run-click: the signal alone has to be enough.
     */
    const el = await mountWithMiddle();
    expect(el.leftCollapsed).toBe(false);

    window.dispatchEvent(new CustomEvent('flow-view-ready'));
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);
  });

  it('a collapsed prompt is drawn at its FLOOR, whoever collapsed it', async () => {
    /*
     * THE FLAG AND THE WIDTH ARE TWO FACTS, and only the dock moved them together. Every other
     * writer — the payload restoring a saved arrangement, the rail — moved the flag alone, so a
     * package saved with `leftCollapsed: true` reopened with the seats hidden and the pane still
     * holding its share of the row: measured 2026-09-23 at 417px of EMPTY COLUMN beside her,
     * which the owner reported as "the prompt text areas are not loading" and found filled in
     * the moment a drag gave the pane width again.
     *
     * The floor is a fact about the collapsed column (the file's header says the 60px rail is a
     * COLLAPSED width), so it is decided in the render from the flag and cannot drift from it.
     */
    const el = await mountWithMiddle();
    // A payload assignment, the way a saved arrangement arrives.
    el.leftCollapsed = true;
    await el.updateComplete;

    const left = el.shadowRoot!.querySelector('.pane.left') as HTMLElement;
    const style = left.getAttribute('style') ?? '';
    expect(style).toContain('flex: 0 0 60px');

    // ...and reopening gives it a share of the row again, not the floor.
    el.leftCollapsed = false;
    await el.updateComplete;
    expect(left.getAttribute('style') ?? '').not.toContain('flex: 0 0 60px');
  });

  it('openPrompt brings the prompt back AND hands the pane back to the payload', async () => {
    /*
     * THE SECOND CAUSE OF THE SAME COMPLAINT. This element is REUSED across packages, and the
     * dock marks the pane operator-owned — so after one Run in a session, the public setter
     * refused every later write and each package opened with its prompt folded. `openPrompt`
     * is what the host calls when a package opens: it opens the column and gives the ownership
     * back, so the next package starts from its own defaults rather than the last run's.
     */
    const el = await mountWithMiddle();
    // A Run docks it, which is what marks the pane operator-owned.
    el.dispatchEvent(new CustomEvent('run-click', { detail: {} }));
    window.dispatchEvent(new CustomEvent('flow-view-ready'));
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);

    // A payload write is refused now — this is the state the next package would open in.
    el.leftCollapsed = false;
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);

    // The host says a package is open.
    el.openPrompt();
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(false);

    // ...and the payload is heard again, which is the half that was missing.
    el.leftCollapsed = true;
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);
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

  it('a Run the host HELD does not dock — not even on the fallback', async () => {
    // Measured 2026-09-23: the host holds a Run and asks the assistant to review the prompt
    // first, and no canvas is coming. The button still arms the dock, so the prompt went to its
    // rail and the width went to an empty middle column — the whole workspace collapsing around
    // a background. A run that never started may not rearrange the screen.
    const el = await mountWithMiddle();
    el.dispatchEvent(new CustomEvent('run-click', { detail: {} }));
    await el.updateComplete;
    window.dispatchEvent(new CustomEvent('a2ui:run-held'));
    await el.updateComplete;

    // Past the fallback, so this pins the cancellation and not just the queueing.
    await new Promise((r) => setTimeout(r, 500));
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(false);

    // ...and a run that IS released docks as it always did: the held state stops this run,
    // it does not leave the column undockable.
    el.dispatchEvent(new CustomEvent('run-click', { detail: {} }));
    await el.updateComplete;
    window.dispatchEvent(new CustomEvent('flow-view-ready'));
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

/**
 * RESET — what the canvas footer's Reset asks for.
 *
 * The owner, 2026-09-18: "what does the reset button do? Does it set it back to the default
 * state when you first click on composer? Because it doesn't look like it does — it should just
 * reset it." It did not: the host's half (the canvas out of the middle column) was all there
 * was, so the prompt stayed docked where the Run had put it.
 */
describe('<workspace-layout> Reset puts the arrangement back', () => {
  const widthOf = (el: LayoutEl) => (el as unknown as { _rightPx: number })._rightPx;

  it('the prompt comes out of its rail and her column stands open at 650', async () => {
    const el = await mountWithPanel();
    Object.defineProperty(el, 'clientWidth', { value: 1375, configurable: true });
    el.getBoundingClientRect = () => ({
      left: 0, right: 1375, width: 1375,
      top: 0, bottom: 900, height: 900, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;

    // A Run docks the prompt …
    el.dispatchEvent(new CustomEvent('run-click', { detail: {} }));
    window.dispatchEvent(new CustomEvent('flow-view-ready'));
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(true);

    // … and the operator narrows her column by hand.
    el.dispatchEvent(new CustomEvent('input-resize-start', { detail: { clientX: 1000, clientY: 10 } }));
    el.dispatchEvent(new CustomEvent('input-resize-end', {}));
    await el.updateComplete;
    expect(widthOf(el)).toBe(375);

    el.resetArrangement();
    await el.updateComplete;
    expect(el.leftCollapsed).toBe(false);
    expect(el.isThirdOpen).toBe(true);
    expect(widthOf(el)).toBe(650);
  });
});

/**
 * SHE IS A LAYER OVER THE DRAWING — the playground's geometry, and the owner's rule.
 *
 * canvas.html: "THE CANVAS IS THE GROUND; HER COLUMN IS A LAYER OVER IT… the drawing never moves,
 * never re-scales and never re-fits because she opened or closed." The owner, 2026-09-18, seeing
 * the app do the opposite: "the canvas is not underneath Grace anymore. Now it's responsive. It
 * has to be under her." And the question that names the stakes: "what if I have a note that's 15
 * nodes long? Where is it gonna go?"
 *
 * So the invariant these pin: her column's moves are HERS — the drawing's box is the same before
 * and after, and a 15-node flow is never squeezed by her opening.
 */
describe('<workspace-layout> her column is a layer, not a pane', () => {
  const withDrawing = async () => {
    const el = await mountWithPanel();
    const middle = document.createElement('agent-canvas');
    middle.setAttribute('slot', 'middle');
    el.appendChild(middle);
    el.shadowRoot!.querySelector('slot[name="middle"]')!.dispatchEvent(new Event('slotchange'));
    await el.updateComplete;
    return el;
  };
  const styleOf = (el: LayoutEl, which: '.pane.middle' | '.pane.right') =>
    (el.shadowRoot!.querySelector(which) as HTMLElement).getAttribute('style') ?? '';

  it('opening and closing her leaves the drawing its whole box', async () => {
    const el = await withDrawing();
    const drawing = styleOf(el, '.pane.middle');
    const herOpen = styleOf(el, '.pane.right');
    expect(herOpen).toContain('650px');

    el.dispatchEvent(new CustomEvent('collapse-toggle', { detail: { collapsed: true } }));
    await el.updateComplete;
    // THE DRAWING DID NOT MOVE: the same flex line, so the same box, with her away or here.
    expect(styleOf(el, '.pane.middle')).toBe(drawing);
    // ...and she did, which is the whole of the interaction.
    expect(styleOf(el, '.pane.right')).not.toBe(herOpen);
    expect(styleOf(el, '.pane.right')).toContain('104px');
  });

  it('she takes no width out of the flex line — a layer, not a share', async () => {
    const el = await withDrawing();
    // Her box is sized by WIDTH; the drawing and the prompt divide the line between them only.
    expect(styleOf(el, '.pane.right')).not.toContain('flex');
    expect(styleOf(el, '.pane.middle')).toContain('flex');
  });
});
