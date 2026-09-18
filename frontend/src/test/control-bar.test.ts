/**
 * <control-bar> — the left column's bottom bar, and the two ways it was wrong here.
 *
 * 1. IT DREW SOMETHING THE DESIGN DOES NOT HAVE. The bar's master
 *    "Left-column-ControlBar" #40000761:261 has ONE child — "controlBar" #40000761:248 —
 *    and that child holds a single group, "CTA-prompt-inputs" #40000761:264, with three
 *    things in it: the undo circle (#40000761:271), "Save Template ⌘ S" (#40000761:269)
 *    and "RUN ⌘ ⏎" (#40000761:267). There is no version line anywhere in it. This element
 *    drew one from node #40000761:249, which is not part of this component, and a
 *    `versionText` binding put a sentence in the bar that the design does not have.
 *
 * 2. NOTHING MOUNTED IT, and the catalogue gate passed it anyway: `element-unclaimed`
 *    decides a component is mounted when the literal tag text appears anywhere under
 *    `src`, and a COMMENT saying "control-bar always at bottom of left column" satisfied
 *    it. The element, its three events and the shell's three listeners were all real and
 *    all dead — the handlers were waiting on a bar that was never on screen.
 *
 * What is pinned here is the CONTRACT: three controls and no fourth thing, each carrying
 * the design's own node id, and each dispatching the event the shell already listens for,
 * bubbling and composed so a window listener hears it across the shadow boundary.
 *
 * The events are asserted, not performed: save writes a package, run executes the
 * pipeline and undo reverts column state, so pressing them is the operator's to do. This
 * file is how the wiring gets proven without doing any of the three.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/control-bar';

type BarEl = HTMLElement & {
  isSaving: boolean;
  isRunning: boolean;
  saveShortcut: string;
  runShortcut: string;
  updateComplete: Promise<unknown>;
};

const mounted: BarEl[] = [];

const mount = async (props: Partial<BarEl> = {}) => {
  const el = document.createElement('control-bar') as BarEl;
  Object.assign(el, props);
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
  return el;
};

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

/** Collect the composed events that reach the window, which is where the shell listens. */
const hearAtWindow = (names: string[]) => {
  const heard: string[] = [];
  const listeners = names.map((name) => {
    const fn = () => heard.push(name);
    window.addEventListener(name, fn);
    return [name, fn] as const;
  });
  return {
    heard,
    stop: () => listeners.forEach(([name, fn]) => window.removeEventListener(name, fn)),
  };
};

describe('<control-bar> draws the design\'s bar — three controls, nothing else', () => {
  it('has ONE child: the CTA group, with the design\'s own node id', async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    // Lit keeps its stylesheet in the shadow root as a <style> node, so "the children"
    // means everything that is not that.
    const content = Array.from(root.children).filter((c) => c.tagName.toLowerCase() !== 'style');

    expect(content).toHaveLength(1);
    expect(content[0].classList.contains('actions')).toBe(true);
    expect(content[0].getAttribute('data-node-id')).toBe('40000761:264');
  });

  it('carries the three controls, each under the node it was drawn from', async () => {
    const el = await mount();
    const root = el.shadowRoot!;

    expect(root.querySelector('.btn-undo')!.getAttribute('data-node-id')).toBe('40000761:271');
    expect(root.querySelector('.btn-save')!.getAttribute('data-node-id')).toBe('40000761:269');
    expect(root.querySelector('.btn-run')!.getAttribute('data-node-id')).toBe('40000761:267');
  });

  it('draws no version line — the master does not carry one', async () => {
    const el = await mount();
    const root = el.shadowRoot!;
    const actions = root.querySelector('.actions')!;

    expect(root.querySelector('.version')).toBeNull();
    // Read the drawn markup, not the shadow root's textContent — that includes Lit's
    // inlined stylesheet, comments and all.
    expect(actions.textContent).not.toContain('Editing Version');
    expect(actions.textContent).not.toContain('Saved:');
    // The whole bar is the three controls, so nothing can be smuggled in on the left.
    expect(actions.textContent!.replace(/\s+/g, ' ').trim()).toBe('↩️ Save Template ⌘ S RUN ⌘ ⏎');
  });

  it('labels the two buttons with their shortcut spans from the design', async () => {
    const el = await mount();
    const root = el.shadowRoot!;

    expect(root.querySelector('.btn-save .shortcut')!.textContent).toBe('⌘ S');
    expect(root.querySelector('.btn-run .shortcut-run')!.textContent).toBe('⌘ ⏎');
  });
});

describe('<control-bar> dispatches what the shell listens for', () => {
  it('raises undo-click, save-click and run-click, each bubbling and composed', async () => {
    const el = await mount();
    const { heard, stop } = hearAtWindow(['undo-click', 'save-click', 'run-click']);

    el.shadowRoot!.querySelector<HTMLElement>('.btn-undo')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('.btn-save')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('.btn-run')!.click();
    stop();

    // Heard at the WINDOW, not at the element: the page's handlers live on window, so a
    // non-composed event would be swallowed by the shadow boundary and the buttons dead.
    expect(heard).toEqual(['undo-click', 'save-click', 'run-click']);
  });

  it('drops a second save while one is in flight', async () => {
    const el = await mount({ isSaving: true });
    const { heard, stop } = hearAtWindow(['save-click']);

    el.shadowRoot!.querySelector<HTMLElement>('.btn-save')!.click();
    stop();

    expect(heard).toEqual([]);
  });

  it('drops a second run while one is in flight', async () => {
    const el = await mount({ isRunning: true });
    const { heard, stop } = hearAtWindow(['run-click']);

    el.shadowRoot!.querySelector<HTMLElement>('.btn-run')!.click();
    stop();

    expect(heard).toEqual([]);
  });
});
