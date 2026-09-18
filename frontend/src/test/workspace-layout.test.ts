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

const mounted: LayoutEl[] = [];

const mount = async () => {
  const el = document.createElement('workspace-layout') as LayoutEl;
  document.body.appendChild(el);
  await el.updateComplete;
  mounted.push(el);
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
    const el = await mount();
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
    const el = await mount();
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
