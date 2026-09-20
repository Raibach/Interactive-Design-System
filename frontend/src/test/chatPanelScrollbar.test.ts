/**
 * <chat-panel>'s DRAWN SCROLLBAR — the small thumb that rides over the conversation.
 *
 * The owner, 2026-09-19: "put a scroll feature inside of the chat panel, just a very small
 * little tiny scroll on the right hand side… it can be on top of and over the bubbles" —
 * and, when the first cut scrolled the whole region: "you've got the entire contents of the
 * chat panel scrolling when actually it's supposed to just be that window where you chat
 * with the model so nothing else moves. The frame stays, but only the content inside of the
 * frames moves."
 *
 * So the FRAME is fixed: the scroller is the card's own body (.content-scroll), the card and
 * the bars hold their place, and the thumb is drawn over the card. The bar is not the
 * platform's and it is not a gutter — the native bar is off, the thumb is 4px, and nothing
 * is narrowed to make room for it. Nothing here asserts pixels (jsdom has no layout), so the
 * scroller's measurements are stubbed and the assertions are about what got drawn and where
 * the numbers put it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import '@/components/lit/chat-panel';
import type { ChatPanel } from '@/components/lit/chat-panel';

type SeatEl = ChatPanel & { updateComplete: Promise<unknown> };

/**
 * The sync is the panel's own private step, called here the way its own lifecycle calls it.
 * Reached through a cast rather than an intersection: intersecting with a class that
 * declares the member private collapses the type to never (TS2339), and the point of this
 * test is the drawn result, not the member's visibility.
 */
const sync = (el: SeatEl): void => (el as unknown as { _syncScrollThumb: () => void })._syncScrollThumb();

/**
 * The drawn bar is OFF by default — the owner, 2026-09-19: "you don't really need a scroll bar
 * for now, I can just use my roller on my mouse". The mechanism is kept wired and is what these
 * tests hold down, so they switch it on first; the default is asserted in its own case below.
 */
const showBar = (el: SeatEl): void => {
  (el as unknown as { _showScrollBar: boolean })._showScrollBar = true;
};

const mounted: SeatEl[] = [];

const settle = async (el: SeatEl) => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await el.updateComplete;
  }
};

const mount = async (props: Record<string, unknown> = {}) => {
  const el = document.createElement('chat-panel') as SeatEl;
  Object.assign(el, props);
  document.body.appendChild(el);
  await settle(el);
  mounted.push(el);
  return el;
};

/** Give the scroller a box: jsdom reports 0 for every measurement. */
const setBox = (el: SeatEl, scrollTop: number, clientHeight: number, scrollHeight: number) => {
  const wrap = el.shadowRoot!.querySelector('.content-scroll') as HTMLElement;
  Object.defineProperty(wrap, 'clientHeight', { value: clientHeight, configurable: true });
  Object.defineProperty(wrap, 'scrollHeight', { value: scrollHeight, configurable: true });
  Object.defineProperty(wrap, 'scrollTop', { value: scrollTop, configurable: true, writable: true });
  return wrap;
};

const rail = (el: SeatEl) => el.shadowRoot!.querySelector('.scroll-rail');
const thumb = (el: SeatEl) => el.shadowRoot!.querySelector('.scroll-thumb') as HTMLElement | null;

afterEach(() => {
  while (mounted.length) mounted.pop()?.remove();
});

describe('<chat-panel> — the drawn scrollbar', () => {
  it('draws nothing at all while the bar is switched off, whatever the content', async () => {
    // The shipping default: no rail, no thumb — the conversation rolls under the wheel alone.
    const el = await mount();
    setBox(el, 0, 400, 5000);
    sync(el);
    await settle(el);
    expect(rail(el)).toBeNull();
  });

  it('draws no bar at all while the content fits', async () => {
    const el = await mount();
    showBar(el);
    setBox(el, 0, 600, 600);
    sync(el);
    await settle(el);
    expect(rail(el)).toBeNull();
  });

  it('draws the thumb over the content once there is something to scroll', async () => {
    const el = await mount();
    showBar(el);
    setBox(el, 0, 400, 1000);
    sync(el);
    await settle(el);
    expect(rail(el)).not.toBeNull();
    const t = thumb(el);
    expect(t).not.toBeNull();
    // It sits inside the region's right edge and takes no width from the content: the
    // rail is 4px and the thumb is the only thing in it that takes a pointer.
    expect(t!.style.height).toBe('160px'); // 400 * (400 / 1000)
    expect(t!.style.top).toBe('0px');      // at the top of the region
  });

  it('moves the thumb with the scroll, in proportion to the free track', async () => {
    const el = await mount();
    showBar(el);
    const wrap = setBox(el, 0, 400, 1000);
    sync(el);
    await settle(el);
    // Scrolled to the end: the thumb lands flush with the bottom of the track.
    wrap.scrollTop = 600;
    sync(el);
    await settle(el);
    expect(thumb(el)!.style.top).toBe('240px'); // (600/600) * (400 - 160)
    // Halfway: half the free track.
    wrap.scrollTop = 300;
    sync(el);
    await settle(el);
    expect(thumb(el)!.style.top).toBe('120px');
  });

  it('keeps a grabbable length on a thread many screens long', async () => {
    const el = await mount();
    showBar(el);
    setBox(el, 0, 400, 200000);
    sync(el);
    await settle(el);
    // 400 * (400/200000) = 0.8px, which is not something a hand can hold: clamped to 24.
    expect(thumb(el)!.style.height).toBe('24px');
  });
});
