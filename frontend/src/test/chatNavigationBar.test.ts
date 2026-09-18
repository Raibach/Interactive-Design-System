/**
 * <chat-navigation-bar> — which buttons a seat gets, and what a wrong id costs.
 *
 * The rail shows what `allowed-tabs` names and nothing else, and the lists themselves are
 * written by the SERVER (backend/routes/ai.py: PACKAGE_TABS, CONSOLE_TABS) because a model
 * paraphrasing a menu is how the console's eight buttons once appeared in a package's rail.
 *
 * The cost of that contract is this: an id the rail does not know is dropped in silence. A
 * typo on the server is not an error anywhere — it is a button that quietly is not there.
 * So the two lists are pinned here, both as WHAT THEY DRAW and as what they must not draw.
 *
 * The console's list changed on the owner's instruction, 2026-09-18: "remove runs, evals,
 * states and trace from the console chat vertical menu… add the repair dropdown and show all
 * repairs." Trace, Runs and Evals did not leave the rail — they left the CONSOLE's rail, and
 * a package's rail still offers them (test 2).
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/chat-navigation-bar';
import type { ChatNavigationBar } from '@/components/lit/chat-navigation-bar';

type RailEl = ChatNavigationBar & { updateComplete: Promise<unknown> };

const mounted: RailEl[] = [];

async function mount(allowedTabs: string): Promise<RailEl> {
  const el = document.createElement('chat-navigation-bar') as RailEl;
  el.allowedTabs = allowedTabs;
  document.body.appendChild(el);
  mounted.push(el);
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
    await el.updateComplete;
  }
  return el;
}

/** The labels the rail actually drew, in the order it drew them. */
function labels(el: RailEl): string[] {
  return Array.from(el.shadowRoot?.querySelectorAll('button .lt') ?? []).map(
    (n) => (n.textContent ?? '').trim(),
  );
}

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

describe('<chat-navigation-bar> — the seat lists the server writes', () => {
  it("the console's rail is its own four plus Repairs — and nothing else", async () => {
    // PACKAGE_TABS / CONSOLE_TABS, verbatim from backend/routes/ai.py.
    const el = await mount('chat,versions,tools,approvals,repair');
    expect(labels(el)).toEqual(['Chat', 'Versions', 'Tools', 'Approvals', 'Repairs']);
    for (const gone of ['Trace', 'Runs', 'Evals', 'States']) {
      expect(labels(el)).not.toContain(gone);
    }
  });

  it("a package's rail keeps trace, runs and evals — the console's cut is not theirs", async () => {
    const el = await mount('chat,trace,versions,tools,executions,eval');
    expect(labels(el)).toEqual(['Chat', 'Trace', 'Versions', 'Tools', 'Runs', 'Evals']);
    // The two console-only items stay out of a package: it can only approve, and only
    // repair, what belongs to it.
    expect(labels(el)).not.toContain('Approvals');
    expect(labels(el)).not.toContain('Repairs');
  });

  it('the order is the rail\'s, not the list\'s', async () => {
    const el = await mount('repair,approvals,chat');
    expect(labels(el)).toEqual(['Chat', 'Approvals', 'Repairs']);
  });

  it('an unset list shows every tab rather than an empty bar', async () => {
    const el = await mount('');
    expect(labels(el).length).toBeGreaterThan(5);
  });
});

/**
 * A CLICK ON A COLLAPSED RAIL OPENS THE COLUMN — AND AN OPEN ONE IS LEFT ALONE.
 *
 * The owner, 2026-09-18: "the user should be able to click on the chat icon whenever the chat
 * component is collapsed and expand it… yes, by disabling chat click-and-expand you took care of
 * the other problems, but I don't think you meant to sacrifice the click-and-expand." And the
 * other half, from the same day: "we would click on trace and it would expand it an additional
 * 650 pixels."
 *
 * The rail does not own the column's width — a container does — so an expansion has to be
 * ANNOUNCED. It used to be announced only when the previous tab was empty, which is true only
 * after collapsing by clicking the active tab; a seat that LOADED collapsed (the console always
 * does) clicked into the void. These tests pin both directions.
 */
describe('<chat-navigation-bar> — collapsing and expanding', () => {
  const clickTab = (rail: RailEl, label: string) => {
    const node = Array.from(rail.shadowRoot!.querySelectorAll('button .lt')).find(
      (n) => (n.textContent ?? '').trim() === label,
    );
    (node!.closest('button') as HTMLButtonElement).click();
  };

  const toggles = (rail: RailEl) => {
    const seen: Array<boolean> = [];
    rail.addEventListener('collapse-toggle', (e) =>
      seen.push(Boolean((e as CustomEvent).detail?.collapsed)),
    );
    return seen;
  };

  it('a rail that LOADED collapsed announces the opening when Chat is clicked', async () => {
    const rail = await mount('chat,versions,tools,approvals,repair');
    rail.collapsed = true;
    rail.activeTab = 'versions'; // a real active tab — the state the console loads in
    await rail.updateComplete;

    const seen = toggles(rail);
    clickTab(rail, 'Chat');
    await rail.updateComplete;

    expect(seen).toContain(false); // the container is told: open
    expect(rail.collapsed).toBe(false);
    expect(rail.activeTab).toBe('chat');
  });

  it('an OPEN rail does not ask the container to resize when another tab is clicked', async () => {
    const rail = await mount('chat,versions,tools,approvals,repair');
    rail.collapsed = false;
    rail.activeTab = 'chat';
    await rail.updateComplete;

    const seen = toggles(rail);
    clickTab(rail, 'Tools');
    await rail.updateComplete;

    expect(seen).toEqual([]); // no 650px jump
    expect(rail.activeTab).toBe('tools');
  });

  it('clicking the tab it is already on closes the column — one control, both ways', async () => {
    const rail = await mount('chat,versions,tools,approvals,repair');
    rail.collapsed = false;
    rail.activeTab = 'chat';
    await rail.updateComplete;

    const seen = toggles(rail);
    clickTab(rail, 'Chat');
    await rail.updateComplete;

    expect(seen).toContain(true);
    expect(rail.collapsed).toBe(true);
  });
});
