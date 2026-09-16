/**
 * <chat-panel> — the surface's own seat, and the ways it was drawing nothing.
 *
 * This is a test for a measured failure, not for a data structure. In the running app on
 * 2026-09-15 the composer's right column was BLANK: `<chat-panel>` measured 836x874 with
 * `shadowRoot.innerHTML.length === 0`, and the React seat inside it measured 0x0 while fully
 * mounted. Two causes, and neither one is visible in the file that has it:
 *
 *   1. IT NEVER DREW AT ALL. `useDefineForClassFields` is true here, so `conversationId?: string;`
 *      and friends REPLACED the accessors Lit installs for declared properties, and Lit throws on
 *      the first update ("...will not trigger updates as expected because they are set using class
 *      fields"). The declarations are `declare` now, and the first test below fails without that.
 *   2. THE SEAT IT WAS GIVEN WAS INVISIBLE. A shadow root renders light-DOM children only where a
 *      `<slot>` sits. A host that slots a seat into this element gets that seat drawn; a host that
 *      slots nothing gets the element's own thread and composer.
 *
 * And one more that no pixel showed: with a conversation bound and no history handed over, the
 * element said "No conversation yet for this package" — over a package whose conversation had
 * turns in it. The conversation belongs to the package, so the element reads it.
 *
 * jsdom has no layout, so nothing here asserts pixels. Every assertion is about what was drawn,
 * which conversation was asked for, and what was written back.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import '@/components/lit/chat-panel';
import type { ChatPanel } from '@/components/lit/chat-panel';

type SeatEl = ChatPanel & { updateComplete: Promise<unknown> };

const mounted: SeatEl[] = [];

/** The element's update plus the microtasks its async paths (history, send) run on. */
const settle = async (el: SeatEl) => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
    await el.updateComplete;
  }
};

const mount = async (props: Record<string, unknown> = {}, child?: HTMLElement) => {
  const el = document.createElement('chat-panel') as SeatEl;
  if (child) el.appendChild(child);
  Object.assign(el, props);
  document.body.appendChild(el);
  await settle(el);
  mounted.push(el);
  return el;
};

/** Composed text: the element's shadow root plus every nested shadow root inside it. */
const shadowText = (el: Element): string => {
  const root = el.shadowRoot;
  if (!root) return (el.textContent || '').replace(/\s+/g, ' ').trim();
  let text = root.textContent || '';
  for (const child of root.querySelectorAll('*')) {
    if (child.shadowRoot) text += ' ' + shadowText(child);
  }
  return text.replace(/\s+/g, ' ').trim();
};

afterEach(() => {
  while (mounted.length) mounted.pop()!.remove();
  vi.unstubAllGlobals();
});

/** A fetch stand-in that records every call and answers the endpoints this element uses. */
function stubFetch(history: Array<{ role?: string; content?: string }> = []) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
  vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    if (String(url).includes('/api/teacher/query')) return json({ content: 'Answer' });
    if (init?.method === 'POST') return json({ id: 'msg-1', success: true });
    return json({ messages: history });
  }));
  return calls;
}


describe('<chat-panel> draws its seat', () => {
  it('draws the history the surface handed it, and no empty-state sentence over it', async () => {
    const el = await mount({
      messages: [
        { role: 'assistant', content: 'Composer ready.' },
        { role: 'user', content: 'put a lock on it' },
      ],
    });

    expect(shadowText(el)).toContain('Composer ready.');
    expect(shadowText(el)).toContain('put a lock on it');
    expect(shadowText(el)).not.toContain('No conversation yet');
  });

  it('draws its own composer when the surface handed it nothing', async () => {
    const el = await mount();

    expect(shadowText(el)).toContain('No conversation yet for this package.');
    expect(el.shadowRoot?.querySelector('chat-input')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('chat-messages')).toBeTruthy();
  });

  it('reads the package conversation when no history was handed over', async () => {
    // The read is the point: `render-session` binds the conversation id and nothing else, so
    // without this the element announced an empty package over a conversation that has turns.
    const calls = stubFetch([
      { role: 'user', content: 'what does the tool call do' },
      { role: 'assistant', content: 'It reads the node.' },
    ]);

    const el = await mount({ conversationId: 'conv-1730' });
    await settle(el);

    expect(calls.some((c) => c.url === '/api/conversations/conv-1730/messages?limit=200')).toBe(true);
    expect(shadowText(el)).toContain('It reads the node.');
    expect(shadowText(el)).not.toContain('No conversation yet');
  });

  it('writes every turn back into the package conversation', async () => {
    const calls = stubFetch();
    const el = await mount({ conversationId: 'conv-1730', sessionId: 'sess-1' });
    await settle(el);

    const inputEl = el.shadowRoot!.querySelector('chat-input')!;
    inputEl.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true,
      composed: true,
      detail: { text: 'what is this for' },
    }));
    await settle(el);

    const written = calls.filter(
      (c) => c.init?.method === 'POST' && c.url === '/api/conversations/conv-1730/messages',
    );
    const bodies = written.map((c) => JSON.parse(String(c.init?.body)));

    expect(written.length).toBe(2);
    expect(bodies.map((b) => `${b.role}:${b.content}`)).toEqual([
      'user:what is this for',
      'assistant:Answer',
    ]);
    expect(shadowText(el)).toContain('Answer');
  });

  it('drives the surface through Grace\'s XML command tags, and strips them from the thread', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({
          content: 'I put this in Constraints. <update_constraints>Never remove error boundaries.</update_constraints>',
        }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));

    const written: Array<{ content: string; target: string }> = [];
    const onWrite = (e: Event) => {
      const d = (e as CustomEvent).detail || {};
      written.push({ content: d.content, target: d.target });
    };
    window.addEventListener('set-left-column-text', onWrite);

    const el = await mount({ conversationId: 'conv-1730' });
    const inputEl = el.shadowRoot!.querySelector('chat-input')!;
    inputEl.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true,
      composed: true,
      detail: { text: 'lock it down' },
    }));
    await settle(el);

    window.removeEventListener('set-left-column-text', onWrite);

    expect(written).toEqual([{ content: 'Never remove error boundaries.', target: 'Constraints' }]);
    expect(shadowText(el)).toContain('I put this in Constraints.');
    expect(shadowText(el)).not.toContain('update_constraints');
  });

  it('renders the status bar as the frame\'s four slots, joined with the frame\'s separators', async () => {
    const el = await mount({
      status: 'Analyzing',
      sessionLabel: 'Session 222',
      sessionName: 'supportCustomerSession',
      duration: '28.495s',
      qaScore: '89.38%',
    });

    const header = el.shadowRoot!.querySelector('chat-header')!;
    const text = header.shadowRoot?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
    expect(text).toContain(
      'Analyzing: Session 222 | supportCustomerSession — Duration: 28.495s | Closed QA: 89.38%',
    );
  });

  it('adopts the conversation picked from the selector and reloads its history', async () => {
    const calls = stubFetch([
      { role: 'user', content: 'what does the tool call do' },
      { role: 'assistant', content: 'It reads the node.' },
    ]);

    const el = await mount({
      conversationId: 'conv-A',
      conversations: [
        { id: 'conv-A', title: 'First chat' },
        { id: 'conv-B', title: 'Second chat' },
      ],
    });
    await settle(el);

    const messagesEl = el.shadowRoot!.querySelector('chat-messages')!;
    messagesEl.dispatchEvent(new CustomEvent('conversation-select', {
      bubbles: true,
      composed: true,
      detail: { conversationId: 'conv-B' },
    }));
    await settle(el);

    expect(el.conversationId).toBe('conv-B');
    expect(calls.some((c) => c.url === '/api/conversations/conv-B/messages?limit=200')).toBe(true);
    expect(shadowText(el)).toContain('It reads the node.');
  });

  it('resizes the input area when the gripper is dragged', async () => {
    const el = await mount();
    const bar = el.shadowRoot!.querySelector('chat-action-bar')!;
    const gripper = bar.shadowRoot!.querySelector('.gripper')!;
    const inputEl = el.shadowRoot!.querySelector('chat-input') as HTMLElement & { height: number };

    gripper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 300 }));
    window.dispatchEvent(new MouseEvent('mousemove', { clientY: 200 }));
    window.dispatchEvent(new MouseEvent('mouseup'));
    await settle(el);

    // Dragging up 100px grows the input area from its 100px floor to 200px.
    expect(inputEl.height).toBeGreaterThan(100);
    expect(inputEl.height).toBeLessThanOrEqual(600);
  });

  it('sends the slotted input\'s draft when the bar\'s submit is clicked, and clears it', async () => {
    const calls = stubFetch();
    const el = await mount({ conversationId: 'conv-1730', sessionId: 'sess-1' });
    await settle(el);

    const textarea = el.shadowRoot!.querySelector('prompt-textarea') as HTMLElement & { value: string };
    textarea.dispatchEvent(new CustomEvent('value-input', {
      bubbles: true,
      composed: true,
      detail: { value: 'wire it up' },
    }));
    el.shadowRoot!.querySelector('chat-action-bar')!.dispatchEvent(
      new CustomEvent('send-input-to-model', { bubbles: true, composed: true }),
    );
    await settle(el);

    const written = calls.filter(
      (c) => c.init?.method === 'POST' && c.url === '/api/conversations/conv-1730/messages',
    );
    const bodies = written.map((c) => JSON.parse(String(c.init?.body)));
    expect(bodies.map((b) => `${b.role}:${b.content}`)).toEqual([
      'user:wire it up',
      'assistant:Answer',
    ]);
    expect(textarea.value).toBe('');
  });

  it('reports the call\'s usage attributed to its conversation, so the footer accumulates', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({
          content: 'Answer',
          conversation_id: 'conv-1730',
          usage: {
            call_id: 'call-1', mode: 'chat',
            prompt_tokens: 100, completion_tokens: 50, total_tokens: 150,
            conversation_id: 'conv-1730',
          },
        }) } as Response;
      }
      if (String(url).includes('/api/conversations/')) {
        return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({}) } as Response;
    }));

    const seen: Array<Record<string, unknown>> = [];
    const onUsage = (e: Event) => seen.push((e as CustomEvent).detail || {});
    window.addEventListener('a2ui:usage', onUsage);

    const el = await mount({ conversationId: 'conv-1730', sessionId: 'sess-1' });
    el.shadowRoot!.querySelector('chat-input')!.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true,
      composed: true,
      detail: { text: 'count me' },
    }));
    await settle(el);

    window.removeEventListener('a2ui:usage', onUsage);
    expect(seen.length).toBe(1);
    expect(seen[0].total_tokens).toBe(150);
    expect(seen[0].conversation_id).toBe('conv-1730');
    expect(seen[0].sessionId).toBe('sess-1');
  });

  it('stops an in-flight call when the bar\'s stop is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn((url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return new Promise((_res, rej) => {
          const signal = init?.signal;
          if (signal) {
            signal.addEventListener('abort', () => rej(new DOMException('Aborted', 'AbortError')));
          }
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ messages: [] }) } as Response);
    }));

    const el = await mount({ conversationId: 'conv-1730', sessionId: 'sess-1' });
    el.shadowRoot!.querySelector('chat-input')!.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true,
      composed: true,
      detail: { text: 'think for a while' },
    }));
    await settle(el);
    expect(shadowText(el)).toContain('Thinking');

    el.shadowRoot!.querySelector('chat-action-bar')!.dispatchEvent(
      new CustomEvent('stop-model-thinking', { bubbles: true, composed: true }),
    );
    await settle(el);

    expect(shadowText(el)).toContain('Stopped.');
    expect(shadowText(el)).not.toContain('Thinking');
  });

  it('keeps the composer above the footer, with the findings panel collapsed by default', async () => {
    // The layout assertion for the class of bug this test exists to stop: a
    // self-added panel once rendered 3,309px of findings and buried the composer
    // below the fold, which read as "the chat input is missing". The frame's
    // order is status → messages → action bar → input → footer, and the panel
    // must default collapsed so it can never grow into that order.
    const el = await mount({
      findings: Array.from({ length: 52 }, (_, i) => ({
        id: `f-${i}`, level: 'advisory', what: `finding ${i}`,
      })),
    });

    const panel = el.shadowRoot!.querySelector('.panel')!;
    // The frame's corrected split: output pieces in the fixed 519px wrapper,
    // the composer chain in the filling input wrapper, input above the footer.
    const outputWrapper = panel.querySelector('.chat-output-wrapper')!;
    expect(outputWrapper.querySelector('chat-header')).toBeTruthy();
    expect(outputWrapper.querySelector('chat-messages')).toBeTruthy();

    const inputWrapper = panel.querySelector('.chat-input-wrapper')!;
    const pieces = Array.from(inputWrapper.children).map((c) => c.tagName.toLowerCase());
    expect(pieces.indexOf('chat-action-bar')).toBeGreaterThan(-1);
    expect(pieces.indexOf('chat-input')).toBeGreaterThan(-1);
    expect(pieces.indexOf('chat-input')).toBeLessThan(pieces.indexOf('chat-footer'));

    const repair = el.shadowRoot!.querySelector('chat-repair-actions') as
      HTMLElement & { collapsed: boolean };
    expect(repair.collapsed).toBe(true);
    expect(repair.shadowRoot?.querySelector('ul')).toBeNull();
  });
});

describe('<chat-panel> hosts the seat it is given', () => {
  it('draws the slotted seat instead of its own, so a host is never shown two', async () => {
    const seat = document.createElement('div');
    seat.textContent = 'the real seat';
    const el = await mount({}, seat);

    // The slot is live, and the element's own thread and composer are NOT drawn beside it.
    const slot = el.shadowRoot!.querySelector('slot')!;
    expect(slot.className).toBe('seat');
    expect(el.shadowRoot!.querySelector('chat-input')).toBeNull();
    expect(shadowText(el)).not.toContain('No conversation yet');

    // The seat is still the host's, in the light DOM, and it is what the reader sees.
    expect(el.children[0]).toBe(seat);
    expect(seat.isConnected).toBe(true);
  });

  it('collapses the slot when nothing is slotted, so an empty box takes no room', async () => {
    const el = await mount();
    expect(el.shadowRoot!.querySelector('slot')!.className).toBe('seat empty');
  });
});
