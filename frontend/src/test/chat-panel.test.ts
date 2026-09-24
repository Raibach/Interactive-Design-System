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
// The real child the surface puts in the panel's view slot. Imported, not stubbed: the
// failure this file guards against was about a real slotted element's `slot` attribute.
import '@/components/lit/trace-feed';
// The console's repair list — the real element, imported for the same reason: the failure it
// guards against is about what a slotted element does or does not get drawn in.
import '@/components/lit/chat-repair-actions';
// THE PANEL'S OWN CHILDREN ARE NOT IMPORTED BY THE PANEL — chat-panel.ts uses the tags and
// relies on main.tsx to define them, so a test that asserts on a child must define it here.
// Without this the tag is inert: present in the tree, `customElements.get` false, no shadow
// root, and every read of its content comes back null.
import type { ChatPanel } from '@/components/lit/chat-panel';
import { parseRunAction, parseSaveAction, parseSetTitleAction } from '@/shared/actionLink';
import { eventBus } from '@/shared/event-bus';

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

    // The empty thread says her line, in grey — the hardcoded greeting the owner asked for on
    // 2026-09-19 ("just say hi, how can I help you today… if it's gotta be hardcoded").
    expect(shadowText(el)).toContain('how can I help you today');
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

  it('leaves persistence to the backend — it asks for the turn and writes nothing itself', async () => {
    // The backend writes both turns (`routes/teacher.py`, the user write and the assistant
    // write). When this element wrote them as well, every answer landed twice: measured
    // 2026-09-17, six duplicated rows in one package's conversation. One home per fact, so
    // the assertion is now the opposite of what it used to be — and it fails loudly if a
    // second writer comes back.
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
      (c) => c.init?.method === 'POST' && String(c.url).includes('/messages'),
    );

    expect(written).toEqual([]);
    expect(calls.some((c) => String(c.url).includes('/api/teacher/query'))).toBe(true);
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
    // AND THE COLUMN MOVES TO THE CONVERSATION'S OWN TAB. Picking a conversation is a request
    // to continue THAT process, so the panel lands on the tab the row belongs to — the chat
    // for a chat conversation (the old jump to trace, which the console does not even offer,
    // is gone: owner, 2026-09-19).
    expect(el.activeTab).toBe('chat');
    expect((el.messages || []).some((m) => String(m.content || '').includes('It reads the node.'))).toBe(true);
  });

  it('lands on Approvals when the picked conversation is an approvals one', async () => {
    stubFetch([{ role: 'user', content: 'what did the inspection find' }]);

    const el = await mount({
      conversationId: 'conv-chat',
      conversations: [
        { id: 'conv-chat', title: 'Console — Chat', tab: 'chat' },
        { id: 'conv-approvals', title: 'Console — Approvals', tab: 'approvals' },
      ],
    });
    await settle(el);

    const messagesEl = el.shadowRoot!.querySelector('chat-messages')!;
    messagesEl.dispatchEvent(new CustomEvent('conversation-select', {
      bubbles: true,
      composed: true,
      detail: { conversationId: 'conv-approvals' },
    }));
    await settle(el);

    expect(el.conversationId).toBe('conv-approvals');
    expect(el.activeTab).toBe('approvals');
  });

  it('the command strip draws Send and Agent, and the two trailing buttons are off it', async () => {
    // The owner, 2026-09-19: "you can remove the models on the horizontal drag for the chat
    // panel… we don't need those anymore: Models +", then "and the + he can remove the +".
    // Unhooked rather than deleted — the same session's rule was "don't remove any
    // capabilities, but we can just unhook them or disable them, comment them out" — so
    // this pins what is DRAWN, which is the thing a person can see either way.
    const el = await mount();
    const bar = el.shadowRoot!.querySelector('chat-action-bar')!;
    const drawn = Array.from(bar.shadowRoot!.querySelectorAll('.pill')).map((b) =>
      (b.textContent || '').trim(),
    );
    // The trailing button's word is "Agent" since 2026-09-19 (it read "Console"); the
    // drawing's own label, taken from the node rather than chosen here.
    expect(drawn).toEqual(['Send', 'Agent']);
    expect(bar.shadowRoot!.querySelector('.models')).toBeNull();
    expect(bar.shadowRoot!.querySelector('.add')).toBeNull();
  });

  it('resizes the input area when the gripper is dragged', async () => {
    const el = await mount();
    const bar = el.shadowRoot!.querySelector('chat-action-bar')!;
    const gripper = bar.shadowRoot!.querySelector('.gripper')!;
    const inputEl = el.shadowRoot!.querySelector('chat-input') as HTMLElement & { height: number };

    // jsdom has no layout, so the panel has no bottom edge to measure from. Give it one: the
    // height is read from the POINTER, not from the travel, so the test has to supply the
    // geometry that rule reads (the same stubbing workspace-layout's width test does).
    el.getBoundingClientRect = () => ({
      left: 0, right: 540, width: 540,
      top: 0, bottom: 500, height: 500, x: 0, y: 0, toJSON: () => ({}),
    }) as DOMRect;

    gripper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 300 }));
    // Dispatched on the document, which is where a real move lands on its way up the tree
    // (element → document → window); the gesture listens there, the way the spacer's grip does.
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 200 }));
    document.dispatchEvent(new MouseEvent('mouseup'));
    await settle(el);

    // THE EDGE SITS UNDER THE POINTER. The host's bottom (500) less the tray's own 97px block
    // (#40001123:6689) is the floor the input may not cross — 403 — and the cursor is at 200.
    // The floor is a FLOOR: the pointer is the top edge, so the height is 203, not 300 + 100.
    expect(inputEl.height).toBe(203);
    expect(inputEl.height).toBeGreaterThan(100);
    expect(inputEl.height).toBeLessThanOrEqual(600);

    // AND IT LETS GO. The owner, 2026-09-19: "the same divider slide up and slide down…
    // it's not releasing the cursor." A gesture whose listeners outlive the release keeps
    // resizing the column as the hand moves afterwards, which is what a held cursor feels
    // like — so the release is asserted, not assumed: a move after mouseup changes nothing.
    const afterRelease = inputEl.height;
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 40 }));
    await settle(el);
    expect(inputEl.height).toBe(afterRelease);
  });

  it('lets go of the divider when the hand leaves the page with the button up', async () => {
    // THE CASE THE OWNER HIT, twice: "I'm still grabbing and it won't let me release it.
    // It holds onto my cursor." The divider sits above the input stack, so dragging it DOWN
    // walks the pointer at the page's bottom edge — and a release beyond the page fires no
    // mouseup anywhere, so the old teardown (mouseup only) never ran and the gesture kept
    // tracking a hand that was no longer holding anything.
    //
    // The boundary is what the spacer's grip reads instead: crossing the page edge with NO
    // button down means the hand is empty, whether it just arrived or just left. This pins
    // that read for the divider too — and that a pointercancel ends it as well.
    const el = await mount();
    const bar = el.shadowRoot!.querySelector('chat-action-bar')!;
    const gripper = bar.shadowRoot!.querySelector('.gripper')!;
    const inputEl = el.shadowRoot!.querySelector('chat-input') as HTMLElement & { height: number };
    const dragging = () => !!(bar as unknown as { _dragging: boolean })._dragging;

    gripper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 300 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 250 }));
    await settle(el);
    expect(dragging()).toBe(true);

    // Leaving the page with the button up: relatedTarget null (nothing inside the page),
    // buttons 0 (nothing held).
    document.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null, buttons: 0 }));
    expect(dragging()).toBe(false);
    const released = inputEl.height;
    document.dispatchEvent(new MouseEvent('mousemove', { clientY: 120 }));
    await settle(el);
    expect(inputEl.height).toBe(released);

    // A cancelled pointer (the browser took the gesture over) ends it too.
    gripper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 300 }));
    await settle(el);
    expect(dragging()).toBe(true);
    document.dispatchEvent(new Event('pointercancel', { bubbles: true }));
    expect(dragging()).toBe(false);
  });

  it('the Send label is the button that sends, and a drag on its grip is not a click', async () => {
    // The v.4b control is ONE pill holding the label AND the grip (#40001119:6370), so the
    // grip lives inside the same box as the send action. That is exactly why the pill is a
    // div with a button inside it rather than a button: a drag that began on the grip must
    // not finish as a click on Send.
    const el = await mount();
    const bar = el.shadowRoot!.querySelector('chat-action-bar')!;
    const sr = bar.shadowRoot!;
    const send = sr.querySelector('.send-label') as HTMLButtonElement;
    const grip = sr.querySelector('.gripper')!;
    let sent = 0;
    let ended = 0;
    bar.addEventListener('send-input-to-model', () => { sent += 1; });
    bar.addEventListener('input-resize-end', () => { ended += 1; });

    // Give the input a draft, so the send state is enabled (Disabled: while empty).
    el.shadowRoot!.querySelector('prompt-textarea')!.dispatchEvent(
      new CustomEvent('value-input', { bubbles: true, composed: true, detail: { value: 'hello' } }),
    );
    await settle(el);

    grip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientY: 300 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    await settle(el);
    expect(sent).toBe(0);
    expect(ended).toBe(1);

    send.click();
    expect(sent).toBe(1);
  });

  it('starts a new conversation from the foot\'s add mark, and archives the one being left', async () => {
    // The owner, 2026-09-19: "make it work at the bottom so that I can create a new
    // conversation and archive the one that's there… it would get assigned a default title
    // based on the first part of the conversation."
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      // The CONSOLE's seat, which is the only one this mark acts on.
      if (u.startsWith('/api/prompt-sessions/') && (!init || init.method === undefined)) {
        return json({ session: { id: 'sess-console', metadata: { session_type: 'console' } } });
      }
      if (u === '/api/conversations' && init?.method === 'POST') return json({ id: 'conv-new', success: true });
      // The history the seat loads for the conversation it was given — it REPLACES whatever
      // the host pushed in, so the first turn the title is taken from has to be here too.
      if (u.includes('/messages')) return json({ messages: [{ role: 'user', content: 'what does the tool call do' }] });
      return json({ success: true });
    }));

    const el = await mount({
      conversationId: 'conv-chat',
      sessionId: 'sess-console',
      conversations: [{ id: 'conv-chat', title: 'Console — Chat', tab: 'chat' }],
      messages: [
        { role: 'user', content: 'what does the tool call do' },
        { role: 'assistant', content: 'It reads the node.' },
      ],
    });
    await settle(el);

    const mark = el.shadowRoot!.querySelector('chat-plugin-tray')!.shadowRoot!
      .querySelector('button[data-node-id="40001123:6732"]') as HTMLButtonElement;
    expect(mark).toBeTruthy();
    mark.click();
    for (let i = 0; i < 12; i++) { await Promise.resolve(); await el.updateComplete; }

    const put = calls.find((c) => c.url === '/api/conversations/conv-chat' && c.init?.method === 'PUT');
    const archived = calls.find((c) => c.url === '/api/conversations/conv-chat/archive');
    const created = calls.find((c) => c.url === '/api/conversations' && c.init?.method === 'POST');
    const pointed = calls.find((c) => c.url === '/api/prompt-sessions/sess-console' && c.init?.method === 'PUT');

    // 1. Named from the first part of the conversation — the rule routes/teacher.py uses (80).
    expect(JSON.parse(String(put?.init?.body)).title).toBe('what does the tool call do');
    // 2. Archived, not deleted.
    expect(archived).toBeTruthy();
    // 3. A successor filed under THIS seat's package, keeping the naming scheme in use.
    expect(JSON.parse(String(created?.init?.body))).toEqual({ session_id: 'sess-console', title: 'Console — Chat' });
    // 4. The session points at it, so a reload lands on the new one.
    expect(JSON.parse(String(pointed?.init?.body))).toEqual({ conversation_id: 'conv-new' });
    // 5. And the seat moved to it.
    expect(el.conversationId).toBe('conv-new');
  });

  it('starts a package its own conversation — the plain create that was missing', async () => {
    /*
     * THIS TEST USED TO ASSERT THE OPPOSITE, and the opposite was a deadlock: the control did
     * nothing at all for a package (no request, no note), while the seat's trash refused to remove
     * the conversation the seat was in ("start a new one, then remove it"). So a package's one row
     * could not be removed and no second could be started to move off it. The owner, 2026-09-23:
     * "I'm not able to delete conversations from the packages. It's just basic CRUD process I
     * thought."
     *
     * The console's rule still holds — "each package has its own set of conversations, so don't
     * just apply it to both areas" — and it is why this is NOT the console's flow: a package
     * CREATES and moves, and does not archive what it left (the console's archive is the console's
     * own act). The gate is still the session row's metadata, read before anything happens.
     */
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      if (u.startsWith('/api/prompt-sessions/') && (!init || init.method === undefined)) {
        return json({ session: { id: 'sess-package', metadata: { has_prompt_session: true } } });
      }
      if (u.includes('/messages')) return json({ messages: [] });
      if (u === '/api/conversations' && init?.method === 'POST') return json({ id: 'conv-new' });
      return json({ success: true });
    }));

    const el = await mount({
      conversationId: 'conv-package',
      sessionId: 'sess-package',
      messages: [{ role: 'user', content: 'a package turn' }],
    });
    await settle(el);

    el.shadowRoot!.querySelector('chat-plugin-tray')!.shadowRoot!
      .querySelector('button[data-node-id="40001123:6732"]')!.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    for (let i = 0; i < 12; i++) { await Promise.resolve(); await el.updateComplete; }

    const created = calls.find((c) => c.url === '/api/conversations' && c.init?.method === 'POST');
    const pointed = calls.find((c) => c.url === '/api/prompt-sessions/sess-package' && c.init?.method === 'PUT');
    const archived = calls.find((c) => c.url.includes('/archive'));

    // Filed under THIS package, and nothing of the console's flow (no archive) leaks in.
    expect(JSON.parse(String(created?.init?.body))).toEqual({ session_id: 'sess-package', title: 'New Chat' });
    expect(archived).toBeUndefined();
    // The session points at it, so a reload lands in the new thread rather than the old one.
    expect(JSON.parse(String(pointed?.init?.body))).toEqual({ conversation_id: 'conv-new' });
    // And the seat moved: a blank thread, and the id the next turn will be written to.
    expect(el.conversationId).toBe('conv-new');
    expect(el.messages).toEqual([]);
  });

  it('and the three marks without an event still emit nothing', async () => {
    const el = await mount();
    const marks = el.shadowRoot!.querySelector('chat-plugin-tray')!.shadowRoot!.querySelectorAll('button.mark');
    // The tray draws the drawing's five. Two carry behaviour — chat history (#40001123:6728)
    // toggles the conversations window, new conversation (#40001123:6732) starts one — and
    // the other three are marks only.
    expect(marks.length).toBe(5);
    const heard: string[] = [];
    for (const name of ['conversation-new', 'toggle-output-window']) {
      el.addEventListener(name, () => heard.push(name));
    }
    for (const m of Array.from(marks)) {
      const id = m.getAttribute('data-node-id');
      if (id === '40001123:6732' || id === '40001123:6728') continue;
      m.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    }
    await settle(el);
    expect(heard).toEqual([]);
  });

  it('counts the package\'s conversations from the server, archived ones included', async () => {
    // The owner, 2026-09-19: "I should've seen that count go up… can you tie the conversation
    // count to that?" The surface's list is as fresh as the last assembly AND carries active
    // rows only, so the count could neither move nor include what was just archived.
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      const u = String(url);
      if (u.startsWith('/api/conversations?')) {
        return json({ conversations: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] });
      }
      if (u.includes('/messages')) return json({ messages: [] });
      return json({ success: true });
    }));

    const el = await mount({
      conversationId: 'conv-chat',
      sessionId: 'sess-console',
      // The surface says two; the package has three (one of them archived).
      conversations: [{ id: 'conv-chat', title: 'Console — Chat', tab: 'chat' }, { id: 'conv-approvals', title: 'Console — Approvals', tab: 'approvals' }],
    });
    await settle(el);

    // The count rides the CONVERSATIONS bar. The readout is the panel's first block and
    // carries the seat's own status line; the conversations bar is the one drawn for the
    // drawing's #40001119:6318.
    const bar = el.shadowRoot!.querySelector('chat-header[bar-node="40001119:6318"]') as HTMLElement & { statusText: string };
    expect(bar.statusText).toBe('3 Conversations');
  });

  it('removes a conversation on the second click of its trash, and refuses the one you are in', async () => {
    // The owner, 2026-09-19: "add a delete icon at the end of each of those conversation
    // tiles that are loading so that I can remove them from the data." The mark is the trash
    // every console card carries, and so is the gesture: one click arms, the second removes.
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      const u = String(url);
      calls.push({ url: u, init });
      if (u.startsWith('/api/conversations?') && (!init || init.method === undefined)) {
        return json({ conversations: [{ id: 'conv-a' }, { id: 'conv-b' }] });
      }
      if (u.includes('/messages')) return json({ messages: [] });
      return json({ success: true });
    }));

    const el = await mount({ sessionId: 'sess-console', conversationId: 'conv-a' });
    await settle(el);

    // The CONVERSATIONS bar opens the list — it is the list's header, and the readout above
    // it is not (see where the panel draws each bar).
    (el.shadowRoot!.querySelector('chat-header[bar-node="40001119:6318"]') as HTMLElement).click();
    await settle(el);
    const trash = (id: string) =>
      [...el.shadowRoot!.querySelectorAll('.conv-remove')].find(
        (b) => (b as HTMLElement).dataset.conversationId === id,
      ) as HTMLElement;
    const removed = () => calls.filter((c) => c.init?.method === 'DELETE');
    expect(el.shadowRoot!.querySelectorAll('.conversation-list li').length).toBe(2);

    /*
     * THE ROW YOU ARE IN IS REMOVED TOO, AND THE SEAT MOVES OFF IT. This used to refuse — "that is
     * the conversation you are in" — which deadlocked the two controls: the console's new-
     * conversation does nothing inside a package, so the one row a package had could not be removed
     * and no second row could be started. The owner, 2026-09-23: "I'm not able to delete
     * conversations from the packages. It's just basic CRUD process I thought." What makes it safe
     * is the server's half (`conversation_api.delete_conversation` moves every session pointing at
     * the row onto the newest conversation of the same kind, or onto none), so the seat only has to
     * follow: here, onto the package's other live conversation.
     */
    trash('conv-a').click();
    await settle(el);
    trash('conv-a').click();
    await settle(el);
    expect(removed().map((c) => c.url)).toEqual(['/api/conversations/conv-a']);
    expect(el.conversationId).toBe('conv-b');
    expect(el.shadowRoot!.textContent).toContain('moved to your other conversation');

    // Any other row: the first click only arms it, the second removes it from the data.
    trash('conv-b').click();
    await settle(el);
    expect(removed()).toHaveLength(1);
    trash('conv-b').click();
    await settle(el);
    expect(removed().map((c) => c.url)).toEqual(['/api/conversations/conv-a', '/api/conversations/conv-b']);
  });

  it('points the trailing button at the surface you are NOT on, and acts on that', async () => {
    // The owner, 2026-09-19: "that same button on the composer is actually going to open the
    // console. So you would want to change the text to console." Which seat this is comes from
    // the session row's own metadata (session_type), the same read the new-conversation gate
    // uses — so one fact, two readers.
    const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;
    const mountWithScope = async (sessionType: string) => {
      vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
        const u = String(url);
        if (u.startsWith('/api/prompt-sessions/') && (!init || init.method === undefined)) {
          return json({ session: { id: 'sess-1', metadata: { session_type: sessionType } } });
        }
        if (u.startsWith('/api/conversations?')) return json({ conversations: [] });
        if (u.includes('/messages')) return json({ messages: [] });
        return json({ success: true });
      }));
      const el = await mount({ sessionId: 'sess-1' });
      await settle(el);
      const bar = el.shadowRoot!.querySelector('chat-action-bar')!;
      const btn = bar.shadowRoot!.querySelector('.agent') as HTMLButtonElement;
      const heard: string[] = [];
      window.addEventListener('open-console', () => heard.push('open-console'));
      window.addEventListener('loads-cards-form-console-in-prompt-area', () => heard.push('agent'));
      btn.click();
      await settle(el);
      const out = { label: (btn.textContent || '').trim(), trailing: (bar as unknown as { trailing: string }).trailing, heard: [...heard] };
      window.removeEventListener('open-console', () => {});
      return out;
    };

    // The console's seat: the drawing's word, and a new package.
    const onConsole = await mountWithScope('console');
    expect(onConsole.label).toBe('Agent');
    expect(onConsole.trailing).toBe('agent');
    expect(onConsole.heard).toContain('agent');
    expect(onConsole.heard).not.toContain('open-console');

    // A package's seat: it reads Console, and opens the console.
    const onPackage = await mountWithScope('assistant');
    expect(onPackage.label).toBe('Console');
    expect(onPackage.trailing).toBe('console');
    expect(onPackage.heard).toContain('open-console');
    expect(onPackage.heard).not.toContain('agent');
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
      (c) => c.init?.method === 'POST' && String(c.url).includes('/messages'),
    );
    expect(written).toEqual([]);
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

  it('draws the frame the design draws and NOT the repair list, which the surface injects', async () => {
    // Two things this pins, both learned the hard way.
    //
    // 1. THE ORDER. A self-added panel once rendered 3,309px of findings and buried the
    //    composer below the fold, which read as "the chat input is missing". The frame's
    //    order is header → dropdown → rule → content, with the composer chain (action
    //    bar → input → footer) after it.
    // 2. THE OWNER. The repair list is NOT this element's child. It arrives in the
    //    "view" slot — the design's one content hole ("holds plain text output and
    //    inserted functions") — the same way the trace view does, filled by the surface
    //    that has the findings. A panel that draws it is a panel owning a list it cannot
    //    see the source of, and it put a console list above the composer in every
    //    assembly.
    const el = await mount({
      findings: Array.from({ length: 52 }, (_, i) => ({
        id: `f-${i}`, level: 'advisory', what: `finding ${i}`,
      })),
    });

    const panel = el.shadowRoot!.querySelector('.panel')!;
    const outputWrapper = panel.querySelector('.chat-output-wrapper')!;
    expect(outputWrapper.querySelector('chat-header')).toBeTruthy();
    expect(outputWrapper.querySelector('chat-messages')).toBeTruthy();

    const inputWrapper = panel.querySelector('.chat-input-wrapper')!;
    const pieces = Array.from(inputWrapper.children).map((c) => c.tagName.toLowerCase());
    expect(pieces.indexOf('chat-action-bar')).toBeGreaterThan(-1);
    expect(pieces.indexOf('chat-input')).toBeGreaterThan(-1);
    // The composer chain is drawn in order, and the foot is the TRAY — v.4b's foot. The navy
    // <chat-footer> it replaced is gone from the panel (see the note where the tray is drawn).
    expect(pieces.indexOf('chat-input')).toBeLessThan(pieces.indexOf('chat-plugin-tray'));

    // The findings were handed in as a prop and the panel still does not draw them: the
    // slot is the only way in, and that is the point. (The slot itself is drawn on the
    // non-chat tabs, which is where a view is what the design shows.)
    expect(el.shadowRoot!.querySelector('chat-repair-actions')).toBeNull();

    const onAViewTab = await mount({ activeTab: 'trace', findings: [{ id: 'f-1' }] });
    expect(onAViewTab.shadowRoot!.querySelector('chat-repair-actions')).toBeNull();
    expect(onAViewTab.shadowRoot!.querySelector('slot[name="view"]')).toBeTruthy();
  });
});

describe("<chat-panel> — a Run held on her verdict", () => {
  /**
   * THE RUN GATE'S TWO ENDS, AND THE WEIGHT OF WHAT SHE SAYS.
   *
   * The host presses Run, holds it, and asks her to check the prompt (`a2ui:ask-grace` carrying
   * `review: 'run'`). She answers with `<run_ok/>` to release it, or with a problem to stop it.
   * Three facts have to hold, and each was a measured failure:
   *
   *   1. A RUN SHE DID NOT CLEAR IS STILL SETTLED. The host shows the Run as busy while it waits,
   *      so a verdict that never arrives leaves the button spinning with nothing coming. Silence
   *      is not consent — and it is not a wait either.
   *   2. HER VERDICT IS DRAWN AS AN ALERT. The owner, 2026-09-23: "it should be outlined in red
   *      just like you would handle a regular error… you can't serve alert messages with the same
   *      visual weight as every other message."
   *   3. THE TAG ITSELF IS NOT DRAWN. She writes the bare `<run_blocked>` as readily as the
   *      self-closing form, and only one of them used to come off the prose.
   */
  const hear = (names: string[], heard: string[]) => {
    const fns = names.map((name) => {
      const fn = () => heard.push(name);
      window.addEventListener(name, fn);
      return [name, fn] as const;
    });
    return () => fns.forEach(([name, fn]) => window.removeEventListener(name, fn));
  };

  /**
   * AND THE THREAD IS A CHILD, SO ITS OWN UPDATE IS WAITED FOR TOO.
   *
   * `<chat-messages>` renders asynchronously from the `.messages` property this panel hands it,
   * so awaiting only the panel's update leaves the child's shadow root EMPTY — measured here as
   * a turn that was correctly in the thread, correctly marked, and simply not drawn yet. (The
   * text assertions would have passed anyway, because the panel's own shadow text is not empty:
   * only the class check needs the child to have painted.)
   */
  const settleThread = async (el: SeatEl) => {
    await settle(el);
    const child = el.shadowRoot!.querySelector('chat-messages') as
      | (HTMLElement & { updateComplete: Promise<unknown> })
      | null;
    if (child) {
      for (let i = 0; i < 5; i++) {
        await Promise.resolve();
        await child.updateComplete;
      }
    }
  };

  const answerWith = async (content: string, ask: Record<string, unknown> = { review: 'run' }) => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({ content }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));
    const el = await mount({ conversationId: 'conv-1730' });
    const heard: string[] = [];
    const stop = hear(['a2ui:run-approved', 'a2ui:run-blocked'], heard);
    window.dispatchEvent(new CustomEvent('a2ui:ask-grace', {
      detail: { ...ask, request: 'A person has pressed Run and the prompt is held.' },
    }));
    await settleThread(el);
    // THE RUN IS QUEUED BEHIND HER SENTENCE — two frames and a reading beat (see the seat's
    // `_pendingRun`). The events a test hears arrive AFTER that, so the wait is part of the
    // contract now and not a slow test.
    await new Promise((r) => setTimeout(r, 700));
    stop();
    return { el, heard };
  };

  it('her sentence lands BEFORE the run it asks for', async () => {
    /*
     * THE ORDER THE OWNER WATCHED GO WRONG, 2026-09-23: "we got to visually connect the run
     * feature … give grace enough time to give her back at her output." The run used to be
     * dispatched from inside the reply processing, so the middle column swapped and the button
     * span BEFORE a character of the reply had been drawn.
     */
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({
          content: 'Everything checks out, so I am running it now. <run_ok/>',
        }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));
    const el = await mount({ conversationId: 'conv-1730' });
    let sawTheReply = false;
    let spokeFirst = false;
    const onApproved = () => { if (!sawTheReply) spokeFirst = true; };
    window.addEventListener('a2ui:run-approved', onApproved);

    window.dispatchEvent(new CustomEvent('a2ui:ask-grace', {
      detail: { review: 'run', request: 'held' },
    }));
    await settle(el);
    // Settled, and the run has NOT been released yet.
    sawTheReply = shadowText(el).includes('I am running it now');
    expect(sawTheReply).toBe(true);
    expect(spokeFirst).toBe(false);

    await new Promise((r) => setTimeout(r, 700));
    window.removeEventListener('a2ui:run-approved', onApproved);
    expect(spokeFirst).toBe(false);
  });

  it('releases the held Run on <run_ok/>, and says nothing else', async () => {
    const { el, heard } = await answerWith('Everything it needs is here. <run_ok/>');

    expect(heard).toEqual(['a2ui:run-approved']);
    expect(shadowText(el)).not.toContain('run_ok');
    // Nothing was wrong, so nothing wears the alarm outline.
    const child = el.shadowRoot!.querySelector('chat-messages')!.shadowRoot!;
    expect(child.querySelectorAll('.turn.alert').length).toBe(0);
  });

  it('stops a Run she did not clear, outlines the turn that says so, and strips the tag', async () => {
    const { el, heard } = await answerWith(
      'The User Role is empty, so there is no task for the flow to run. <run_blocked>',
    );

    // 1 — the host is told, so the button comes out of its spin
    expect(heard).toEqual(['a2ui:run-blocked']);
    // 3 — the tag is gone from the prose, in the bare form she actually writes
    expect(shadowText(el)).toContain('The User Role is empty');
    expect(shadowText(el)).not.toContain('run_blocked');
    // 2 — and the turn she left behind carries the alarm. Read INSIDE <chat-messages>: the
    // turns are drawn in that element's own shadow root, not in the panel's.
    const turns = el.shadowRoot!.querySelector('chat-messages')!.shadowRoot!.querySelectorAll('.turn');
    const alerts = [...turns].filter((t) => t.classList.contains('alert'));
    expect(alerts.length).toBe(1);
    expect(alerts[0].textContent).toContain('The User Role is empty');
  });

  it('settles the held Run when she says nothing about it at all', async () => {
    // No tag, no verdict. The run must not go, and the spinner must not hang.
    const { heard } = await answerWith('That looks like a solid prompt to me.');

    expect(heard).toEqual(['a2ui:run-blocked']);
  });

  it('owes nothing on a turn that is not a run review', async () => {
    // The same reply on an ordinary turn dispatches nothing: no host is holding a Run, and an
    // event out of nowhere would release one nobody asked her about.
    const { heard } = await answerWith('Fine. <run_blocked>', {});

    expect(heard).toEqual([]);
  });
});

describe('<chat-panel> — the console says hello as the console', () => {
  /**
   * THE CONSOLE IS AN INDEX, AND SHE USED TO GREET IT LIKE A PACKAGE.
   *
   * The owner, 2026-09-23: "we have got to get this off of the homepage console chat — every time
   * the console loads she checks the Weaver prompt … She just needs to say the same thing she says
   * on console or composer, except for console she needs to talk about 'let me help you sort your
   * prompts, is there anything you'd like to search for' … and it's an index, so she would be
   * filtering and searching for prompts for people."
   *
   * Three properties: the console gets its own hello, it is about finding and sorting rather than
   * writing, and a PACKAGE never gets it. The last one is the one that was nearly wrong —
   * `consoleCards` is an empty array on a package, and an empty array is truthy.
   */
  const greet = async (props: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({ content: 'Hello.' }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      // THE SEAT'S SCOPE, as the server really answers it: the package row's own
      // `session_type`. 'unknown' is a read that FAILS, which is a different thing from a read
      // that says 'not the console' — see _seatScope.
      if (props.__scope === 'unknown') {
        return { ok: false, status: 500, json: async () => ({}) } as Response;
      }
      const session_type = props.__scope === 'console' ? 'console' : 'prompt';
      return {
        ok: true, status: 200,
        json: async () => ({ session: { metadata: { session_type } }, messages: [] }),
      } as Response;
    }));
    const el = await mount({ conversationId: '' });
    await settle(el);
    // THE SESSION ARRIVES AFTER THE ELEMENT DOES, which is what makes the seat-scope read run at
    // all: it is started by a CHANGE of sessionId, and the surface binds this one when it lands.
    // Setting it at mount would be a value, not a change, and no read would happen.
    if (props.sessionId) {
      el.sessionId = String(props.sessionId);
      await settle(el);
    }
    // The host announces the landing, which is what asks her to say hello at all. AND IT IS A
    // `console` ARRIVAL, because a blank one belongs to the seat with NO package (see
    // shared/arrival) and the console has a package — its own row. This is also why the landing
    // could not simply be announced as a package's: that mis-addressing is the defect this kind
    // exists to fix, and it is what put a package's greeting in the console's own thread.
    window.dispatchEvent(new CustomEvent('a2ui:composer-opened', { detail: { kind: 'console' } }));
    for (let i = 0; i < 8; i++) { await Promise.resolve(); await el.updateComplete; }
    const calls = (globalThis.fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const asked = calls.find((c) => String(c[0]).includes('/api/teacher/query'));
    return String(((asked?.[1] as RequestInit | undefined)?.body as string) ?? '');
  };

  it('tells her the console is an index, and that her work there is organisation', async () => {
    const asked = await greet({ __scope: 'console', sessionId: 'console-session', consoleCards: [] });
    expect(asked).toContain('index');
    expect(asked).toContain('ORGANISATION');
    // And says plainly what is NOT there to do: the seats and the writes belong to a package.
    expect(asked).toContain('the writes all belong');
    expect(asked).toContain('no prompt open here');
  });

  it("does NOT give a package the console hello", async () => {
    // A package carries `consoleCards: []`, which is truthy — the near-miss this pins.
    const asked = await greet({ __scope: 'package', sessionId: 'sess-1', consoleCards: [] });
    expect(asked).not.toContain('ORGANISATION');
  });

  it('does not guess when the scope has not been read', async () => {
    // 'unknown' is a third answer: an unanswered question is not a no, and it is not a yes.
    const asked = await greet({ __scope: 'unknown', sessionId: 'console-session', consoleCards: [] });
    expect(asked).toBe('');
  });
});

describe('<chat-panel> — a button that asks for something the app cannot do', () => {
  /**
   * THE WIRE FORMAT LEAKING INTO THE CONVERSATION.
   *
   * From the stored conversation of 2026-09-23: she offered
   * `[Add description](action:set-description|Add a short description for the package)`, the
   * person pressed it, it did not parse, and it went to the model AS A MESSAGE — so the press
   * produced a sentence ("I'll add a short description for the package") and a model call, and
   * whether the work happened came down to whether she also wrote the tag in her reply.
   *
   * Three properties, and the third is the one that keeps her answers working: her OWN words
   * back to her (`confirm`, `not-now`) must still reach her, and they are the same shape as the
   * commands — one token.
   */
  const press = async (action: string) => {
    const calls = stubFetch();
    const el = await mount({ conversationId: 'conv-1730' });
    await settle(el);
    const heard: any[] = [];
    const onDesc = (e: Event) => heard.push((e as CustomEvent).detail);
    window.addEventListener('set-package-description', onDesc as EventListener);

    el.dispatchEvent(new CustomEvent('chat-action-send', {
      bubbles: true, composed: true, detail: { text: `[${action}]`, turn: 'a turn' },
    }));
    await settle(el);
    window.removeEventListener('set-package-description', onDesc as EventListener);
    return { el, calls, heard };
  };

  it('does the description write for HER spelling of the action', async () => {
    // `set-description|the words` — the form she wrote. One separator, no argument name.
    const { heard, calls } = await press('set-description|Add a short description for the package');
    expect(heard).toEqual([{ description: 'Add a short description for the package' }]);
    // And it did NOT become a turn of its own.
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(false);
  });

  it('reads the two-part spelling too, so the two forms cannot drift', async () => {
    const { heard } = await press('set-description:Scouts insurance news.');
    expect(heard).toEqual([{ description: 'Scouts insurance news.' }]);
    const { heard: underscored } = await press('set_description:Scouts insurance news.');
    expect(underscored).toEqual([{ description: 'Scouts insurance news.' }]);
  });

  it('says a command it cannot do out loud, instead of asking her about it', async () => {
    const { el, calls } = await press('do-something-odd');
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(false);
    expect(shadowText(el)).toContain('this app does not know how to do');
  });

  it('performs the repairs she was offering as invented names', async () => {
    /*
     * From the thread of 2026-09-23, four alerts in a row: `move-tool:search-the-internet` and
     * `clean-agent-role` were pressed and answered with "this app does not know how to do that",
     * twice each. The intents were right — move the tool to the step it belongs in, replace a
     * row's text — and the capability was missing, so the person was left with a prompt nobody
     * could repair from the chat.
     */
    const heard: any[] = [];
    const onMove = (e: Event) => heard.push(['move', (e as CustomEvent).detail]);
    const onSet = (e: Event) => heard.push(['set', (e as CustomEvent).detail]);
    const onRemove = (e: Event) => heard.push(['remove', (e as CustomEvent).detail]);
    window.addEventListener('move-tool', onMove as EventListener);
    window.addEventListener('set-left-column-text', onSet as EventListener);
    window.addEventListener('remove-prompt-role', onRemove as EventListener);

    await press('move-tool:search-the-internet|Tool Call');
    await press('set-seat:Agent Role|You are the news scout.');
    await press('remove-seat:agent_role');

    window.removeEventListener('move-tool', onMove as EventListener);
    window.removeEventListener('set-left-column-text', onSet as EventListener);
    window.removeEventListener('remove-prompt-role', onRemove as EventListener);

    expect(heard).toEqual([
      ['move', { name: 'search-the-internet', into: 'Tool Call' }],
      ['set', { target: 'Agent Role', content: 'You are the news scout.' }],
      ['remove', { roleName: 'agent_role' }],
    ]);
  });

  it('releases the held Run for the button her cleared review offers', async () => {
    /*
     * Measured in the app 2026-09-23, and the whole reason this test exists: her champagne
     * sentence ended with [Run it](action:run), and pressing it answered "⚠️ That button asks for
     * something this app does not know how to do (run), so nothing was changed." The review
     * instruction has told her to "offer to run it" since the beginning — so the name was hers,
     * and it was the third of that class (move-tool, clean-agent-role, run).
     */
    const heard: string[] = [];
    const onApproved = () => heard.push('approved');
    window.addEventListener('a2ui:run-approved', onApproved as EventListener);
    const { el, calls } = await press('run');
    window.removeEventListener('a2ui:run-approved', onApproved as EventListener);

    // IT IS THE APPROVAL HER REVIEW WAS WAITING FOR — the same path <run_ok/> takes.
    expect(heard).toEqual(['approved']);
    // And it is not a turn of its own: the press ACTS, it does not ask her again.
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(false);
    expect(shadowText(el)).not.toContain('does not know how to do');
  });

  it('saves the package for the button her blocker list offers', async () => {
    /*
     * Measured in the app 2026-09-23: the review's first blocker was correct — "The package has
     * never been saved, so there is nothing to run yet" — and its button, `[Save the package]
     * (action:save)`, was answered "this app does not know how to do that (save)". Every other
     * repair in the list was moot behind it: a draft has no record to write a title into.
     */
    const heard: string[] = [];
    const blocked: unknown[] = [];
    const off = eventBus.on('save-button', () => { heard.push('save'); return { allowed: true } as never; });
    window.addEventListener('ai-command-blocked', (e) => blocked.push((e as CustomEvent).detail));
    const { el, calls } = await press('save');
    off();
    expect({ heard, blocked }).toEqual({ heard: ['save'], blocked: [] });
    // AND NOTHING WAS BLOCKED — this is the assertion that would have caught the shorthand the
    // panel used to send: the gatekeeper refused it as "Unknown tag: undefined", in silence.
    expect(shadowText(el)).not.toContain('does not know how to do');
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(false);
  });

  it('names the package for the button her blocker list offers', async () => {
    // `[Name the package](action:set-title|Precise Professional Assistant)` — same class. The
    // WRITER existed (`set-prompt-title`); only the button's name was missing.
    const heard: string[] = [];
    const onTitle = (e: Event) => heard.push((e as CustomEvent).detail.title);
    window.addEventListener('set-prompt-title', onTitle as EventListener);
    const { el } = await press('set-title|Precise Professional Assistant');
    window.removeEventListener('set-prompt-title', onTitle as EventListener);
    expect(heard).toEqual(['Precise Professional Assistant']);
    expect(shadowText(el)).not.toContain('does not know how to do');
  });

  it('asks for the name when the button carried none, instead of refusing it', async () => {
    /*
     * Measured in the app 2026-09-23: `[Name it](action:set-title)` — a bare action, because the
     * name is the person's to choose — was answered "this app does not know how to do that
     * (set-title)". A request with no words in it is still a request; what was missing was a
     * question, so it goes to her as words. Nothing is invented and nothing is substituted.
     */
    const { el, calls } = await press('set-title');
    expect(shadowText(el)).not.toContain('does not know how to do');
    // She is asked, in the thread — the person's answer comes back as the spelled button.
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(true);
  });

  it('reads the spellings of save and title, and nothing else as either', () => {
    expect(parseSaveAction('save')).toBe(true);
    expect(parseSaveAction('Save-Template')).toBe(true);
    expect(parseSaveAction('save_package')).toBe(true);
    expect(parseSaveAction('save-as')).toBe(false);
    expect(parseSetTitleAction('set-title|One')?.title).toBe('One');
    expect(parseSetTitleAction('set_title: One')?.title).toBe('One');
    expect(parseSetTitleAction('set-title')).toBeNull();
    expect(parseSetTitleAction('title|One')).toBeNull();
    expect(parseRunAction('save')).toBe(false);
    expect(parseSaveAction('run')).toBe(false);
  });

  it('reads the long spellings of run as the same intent, and nothing else as run', () => {
    // Three spellings, one intent. `rerun` is NOT one of them: a substring match is how an
    // unknown word becomes a wrong action, which is the failure this whole file is about.
    expect(parseRunAction('run')).toBe(true);
    expect(parseRunAction('Run')).toBe(true);
    expect(parseRunAction('run-it')).toBe(true);
    expect(parseRunAction('run_prompt')).toBe(true);
    expect(parseRunAction('rerun')).toBe(false);
    expect(parseRunAction('run-the-whole-thing')).toBe(false);
    expect(parseRunAction('')).toBe(false);
  });

  it('does not send an unrecognised command to her, whichever shape it has', async () => {
    // `move-tool` used to be one of these. Every repair she offers has to name a real action, or
    // the person presses a button that does nothing and is told so.
    for (const action of ['clean-agent-role', 'tidy-up', 'fix:the thing']) {
      const { el, calls } = await press(action);
      expect(calls.some((c) => c.url.includes('/api/teacher/query')), action).toBe(false);
      expect(shadowText(el), action).toContain('this app does not know how to do');
    }
  });

  it('still sends her own two words to her, which are the same shape', async () => {
    const { calls } = await press('confirm');
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(true);
  });

  it('still sends a button that is a plain request', async () => {
    const { calls } = await press('Review the whole prompt and tell me what is weak');
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(true);
  });

  it('tells her the package it is asking about, so she stops guessing', async () => {
    // The description was WRITTEN and she went on saying the package had none: her context
    // carried the seats and the output and nothing about the package itself. A fact she is
    // asked to judge has to be a fact she is given.
    const calls = stubFetch();
    const el = await mount({
      conversationId: 'conv-1730',
      packageTitle: 'Insurance News Scout',
      packageDescription: 'Scouts insurance industry news.',
    });
    await settle(el);
    el.shadowRoot!.querySelector('chat-input')!.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true, composed: true, detail: { text: 'is this package ready' },
    }));
    await settle(el);

    const sent = calls.find((c) => c.url.includes('/api/teacher/query'));
    const body = String((sent?.init?.body as string) ?? '');
    expect(body).toContain('Insurance News Scout');
    expect(body).toContain('Scouts insurance industry news.');
    // And an empty one is STATED, not omitted — "(none)" is a fact, a missing key is a question.
    const bare = await mount({ conversationId: 'conv-2' });
    await settle(bare);
  });
});

describe('<chat-panel> — a row of buttons is a list, not a choice', () => {
  /**
   * THE FEEDBACK A PRESSED BUTTON OWES BACK.
   *
   * The owner, 2026-09-23, after pressing "Fill User Role" on a message that also offered "Fill
   * Agent Role" and "Add description": "when I click Fill User Role that button should change
   * state ... the user is not necessarily clear that they're having to do each one of those, it
   * seems like it's an either or, so maybe by deactivating one when it's done that lets the user
   * know it's a list."
   *
   * Three things have to hold, and each is silent when it is wrong: the pressed button reads
   * spent, it stops answering, and its NEIGHBOURS ARE UNTOUCHED — a rule that greyed the whole
   * turn would say "that offer is finished" and leave the person with no way to do the rest.
   */
  const OFFER = [
    'The User Role and Agent Role are both empty.',
    '',
    '[Fill User Role](action:write-seat:User Role|Write the task)',
    '[Fill Agent Role](action:write-seat:Agent Role|Write the identity)',
    '[Add description](action:write-seat:description|One line about this package)',
  ].join('\n');

  const offered = async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({ content: OFFER }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));
    const el = await mount({ conversationId: 'conv-1730' });
    el.shadowRoot!.querySelector('chat-input')!.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true, composed: true, detail: { text: 'what is missing' },
    }));
    await settle(el);
    const child = el.shadowRoot!.querySelector('chat-messages') as unknown as
      HTMLElement & { updateComplete: Promise<unknown> };
    for (let i = 0; i < 5; i++) { await Promise.resolve(); await child.updateComplete; }
    return { el, child };
  };

  const buttons = (child: HTMLElement) =>
    [...child.shadowRoot!.querySelectorAll('.action')] as HTMLButtonElement[];

  it('marks the pressed button spent and leaves the rest pressable', async () => {
    const { el, child } = await offered();
    expect(buttons(child).length).toBe(3);

    buttons(child)[0].click();
    await settle(el);
    for (let i = 0; i < 5; i++) { await Promise.resolve(); await child.updateComplete; }

    const after = buttons(child);
    expect(after[0].classList.contains('spent')).toBe(true);
    expect(after[0].disabled).toBe(true);
    // The rest are the point: this is a list, and they are still waiting.
    expect(after[1].classList.contains('spent')).toBe(false);
    expect(after[1].disabled).toBe(false);
    expect(after[2].classList.contains('spent')).toBe(false);
  });

  it('presses each one once, and the row reads done at the end', async () => {
    const { el, child } = await offered();
    for (const button of buttons(child)) {
      // Re-read each time: the thread re-renders between presses.
      const live = buttons(child).find((b) => !b.disabled);
      expect(live, 'a live button to press').toBeTruthy();
      live!.click();
      await settle(el);
      for (let i = 0; i < 5; i++) { await Promise.resolve(); await child.updateComplete; }
    }
    const after = buttons(child);
    expect(after.every((b) => b.classList.contains('spent'))).toBe(true);
    expect(after.every((b) => b.disabled)).toBe(true);
  });

  it('does not carry the marks into another package', async () => {
    // An action belongs to the thread it was offered in: the next package's thread is a new
    // one, so a button that shares an action string with the last package's is not spent.
    const { el, child } = await offered();
    buttons(child)[0].click();
    await settle(el);
    el.sessionId = 'another-package';
    await settle(el);
    for (let i = 0; i < 5; i++) { await Promise.resolve(); await child.updateComplete; }
    expect(buttons(child).every((b) => !b.classList.contains('spent'))).toBe(true);
  });

  it('does not mark the SAME action in a LATER turn, which is what confirm would hit', async () => {
    /*
     * THE REASON THE MARK IS SCOPED TO ONE TURN. Every proposing reply she writes ends with the
     * same line — `[Confirm](action:confirm) [Not now](action:not-now)` — so a set of actions
     * alone would draw the SECOND Confirm this conversation ever offered as already pressed, and
     * the person would watch an answer they never gave appear answered.
     */
    const calls = stubFetch();
    const el = await mount({ conversationId: 'conv-1730' });
    await settle(el);
    const child = el.shadowRoot!.querySelector('chat-messages') as unknown as
      HTMLElement & { updateComplete: Promise<unknown> };

    // Two turns, each ending with the same confirm line, both in the thread.
    el.messages = [
      { role: 'assistant', content: 'Add the tool?\n\n[Confirm](action:confirm) [Not now](action:not-now)' },
      { role: 'assistant', content: 'Name the package?\n\n[Confirm](action:confirm) [Not now](action:not-now)' },
    ];
    await settle(el);
    for (let i = 0; i < 5; i++) { await Promise.resolve(); await child.updateComplete; }

    // Press the FIRST turn's Confirm.
    buttons(child)[0].click();
    await settle(el);
    for (let i = 0; i < 5; i++) { await Promise.resolve(); await child.updateComplete; }

    const after = buttons(child);
    expect(after[0].classList.contains('spent')).toBe(true);
    // The second turn's Confirm is a different question and is still waiting.
    expect(after[2].classList.contains('spent')).toBe(false);
    expect(after[2].disabled).toBe(false);
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(true);
  });
});

describe('<chat-panel> — a tool, and the package description', () => {
  /**
   * TWO WRITERS THAT DID NOT EXIST, AND THE INVENTED SYNTAX THEY CAUSED.
   *
   * The transcript of 2026-09-23 is the evidence: asked to put a tool in a prompt that named
   * none, she offered a button that said "Add search tool" and never named one; asked for a
   * description, she wrote `<set_description>…</set_description>`, which the app had never
   * heard of, so the description stayed empty while her sentence said it was added.
   *
   * The rule these pin is the one the whole file keeps: a sentence and a change are two
   * different things, and the change is a fact the app can check.
   */
  const answerWith = async (content: string) => {
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({ content }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));
    const el = await mount({ conversationId: 'conv-1730' });
    el.shadowRoot!.querySelector('chat-input')!.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true, composed: true, detail: { text: 'add the search tool' },
    }));
    await settle(el);
    return el;
  };

  const heard = (name: string, el: SeatEl) => {
    const seen: any[] = [];
    const fn = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener(name, fn as EventListener);
    return { seen, stop: () => window.removeEventListener(name, fn as EventListener), el };
  };

  it('turns <insert_tool> into an insertion, by the register\'s own name', async () => {
    const el = await mount({ conversationId: 'conv-1730' });
    const seen: any[] = [];
    const fn = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener('insert-tool', fn as EventListener);
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({
          content: 'I will put the search tool in. <insert_tool>search-the-internet</insert_tool>',
        }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));

    el.shadowRoot!.querySelector('chat-input')!.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true, composed: true, detail: { text: 'add the search tool' },
    }));
    await settle(el);
    window.removeEventListener('insert-tool', fn as EventListener);

    expect(seen).toEqual([{ name: 'search-the-internet' }]);
    // And the tag is not left in the prose for the person to read.
    expect(shadowText(el)).not.toContain('insert_tool');
  });

  it('turns <set_description> into a description write, and strips it', async () => {
    const el = await mount({ conversationId: 'conv-1730' });
    const seen: any[] = [];
    const fn = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener('set-package-description', fn as EventListener);
    vi.stubGlobal('fetch', vi.fn(async (url: unknown, init?: RequestInit) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({
          content: 'Added it. <set_description>Scouts insurance news.</set_description>',
        }) } as Response;
      }
      if (init?.method === 'POST') return { ok: true, status: 200, json: async () => ({ id: 'm', success: true }) } as Response;
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));

    el.shadowRoot!.querySelector('chat-input')!.dispatchEvent(new CustomEvent('message-sent', {
      bubbles: true, composed: true, detail: { text: 'add a description' },
    }));
    await settle(el);
    window.removeEventListener('set-package-description', fn as EventListener);

    expect(seen).toEqual([{ description: 'Scouts insurance news.' }]);
    expect(shadowText(el)).not.toContain('set_description');
  });

  it('a write-tool button inserts rather than sending the words to her', async () => {
    // The button is an EDIT, like write-seat: sending it to her would produce a sentence about
    // the tool instead of the tool.
    const calls = stubFetch();
    const el = await mount({ conversationId: 'conv-1730' });
    await settle(el);
    const seen: any[] = [];
    const fn = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener('insert-tool', fn as EventListener);

    el.dispatchEvent(new CustomEvent('chat-action-send', {
      // The wire <chat-messages> sends: the ACTION, in brackets — see its _onActionSend.
      bubbles: true, composed: true, detail: { text: '[write-tool:search-the-internet]' },
    }));
    await settle(el);
    window.removeEventListener('insert-tool', fn as EventListener);

    expect(seen).toEqual([
      { name: 'search-the-internet' },
    ]);
    expect(calls.some((c) => c.url.includes('/api/teacher/query'))).toBe(false);
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

/**
 * The rail must survive the surface filling the panel's OTHER slot.
 *
 * This is the 2026-09-17 failure, and it is here because nothing asserted it: the
 * surface puts the Trace view in this element's "view" slot, which made it a light-DOM
 * child, which made `_seatSlotted()`'s fallback (`this.children.length > 0`) report
 * that a host had handed over a seat — so the panel drew the seat slot in place of its
 * entire body. The rail left the screen entirely and the collapsed right column
 * measured 82px with nothing in it. The Trace button could not be found.
 *
 * A regression test rather than a fix note: the three assertions below are exactly the
 * three things that were wrong, and none of them needs a pixel to check.
 */
describe('<chat-panel> is not fooled by a child that names another slot', () => {
  const viewChild = () => {
    const view = document.createElement('trace-feed');
    view.setAttribute('slot', 'view');
    return view;
  };

  it('keeps its own rail when the surface fills the view slot', async () => {
    const view = viewChild();
    const el = await mount({}, view);

    // A child named for another slot is NOT a seat...
    expect(el.shadowRoot!.querySelector('slot')!.className).toBe('seat empty');
    // ...so the element draws its own body, rail included.
    expect(el.shadowRoot!.querySelector('chat-navigation-bar')).not.toBeNull();
    expect(el.children[0]).toBe(view);
  });

  it('draws the view slot on a non-chat tab, with no waiting state over a filled slot', async () => {
    const view = viewChild();
    const el = await mount({ activeTab: 'trace' }, view);

    expect(el.shadowRoot!.querySelector('slot[name="view"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.view-waiting')).toBeNull();
  });

  it('answers an empty view with what the view IS — never with a spinner that cannot end', async () => {
    // The line used to read "Loading the trace view…", which was untrue twice: nothing is
    // loading (the surface fills the slot synchronously) and the empty composer is the
    // demo. An empty view now says what it is and what would fill it (2026-09-18).
    const el = await mount({ activeTab: 'trace' });

    expect(el.shadowRoot!.querySelector('.view-waiting')).not.toBeNull();
    const text = shadowText(el);
    expect(text).toContain('Nothing traced yet');
    expect(text).not.toContain('Loading the trace view');
    // And every rail view has its own line, so the answer is about THIS place.
    for (const [tab, expected] of [
      ['versions', 'No versions yet'],
      ['tools', 'No tools yet'],
      ['executions', 'No runs yet'],
      ['eval', 'Nothing has been judged yet'],
    ] as const) {
      const other = await mount({ activeTab: tab });
      expect(shadowText(other)).toContain(expected);
    }
  });
});

/**
 * THE CONSOLE'S CHAT OPENS WITH THE FINDINGS ON IT — and no other chat is touched.
 *
 * The owner, 2026-09-18: "I'm building a demo and I don't want blank chat to open up, so add
 * it to the chat as well… just make sure it's collapsed by default." And then, on scope:
 * "this is only for the console, not anywhere else chat appears."
 *
 * Which seat is the console's is not a second flag: it is the rail's own list, written by the
 * server, and the seat that OFFERS Approvals is the seat that draws the findings. And WHERE it
 * draws them moved on the owner's instruction, 2026-09-19: "remove the repairs from the tab —
 * repairs live under the approvals" and, of the chat tab, "from the chat tab." So the region is
 * drawn on APPROVALS ONLY: the chat tab is the conversation and nothing else. A package's panel
 * slots a TraceFeed and has no Approvals button, so nothing changes there — the element is the
 * same, the place is not.
 *
 * jsdom computes no `::slotted` rules, so what is asserted is the structure the CSS then
 * filters: the region is drawn above the thread on Approvals, absent on Chat.
 */
describe("<chat-panel> — the console's approvals tab carries the findings", () => {
  const CONSOLE_SEAT = 'chat,versions,tools,approvals';
  const PACKAGE_SEAT = 'chat,trace,versions,tools,executions,eval';

  it('draws the findings region above the thread on Approvals, with the thread still there', async () => {
    const repair = document.createElement('chat-repair-actions');
    repair.setAttribute('slot', 'view');
    const el = await mount({ activeTab: 'approvals', allowedTabs: CONSOLE_SEAT }, repair);

    expect(el.shadowRoot!.querySelector('.chat-top')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.chat-top slot[name="view"]')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('chat-messages')).not.toBeNull();
    // Above the thread, not below it: the thread stays the thing at the bottom of the column.
    const region = el.shadowRoot!.querySelector('.chat-top')!;
    const thread = el.shadowRoot!.querySelector('chat-messages')!;
    expect(region.compareDocumentPosition(thread) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('draws nothing of the findings on the chat tab — the conversation and nothing else', async () => {
    const repair = document.createElement('chat-repair-actions');
    repair.setAttribute('slot', 'view');
    const el = await mount({ activeTab: 'chat', allowedTabs: CONSOLE_SEAT }, repair);

    expect(el.shadowRoot!.querySelector('.chat-top')).toBeNull();
    expect(el.shadowRoot!.querySelector('chat-messages')).not.toBeNull();
  });

  it("leaves every other chat alone — a package's seat draws no such region", async () => {
    const trace = document.createElement('trace-feed');
    trace.setAttribute('slot', 'view');
    const el = await mount({ activeTab: 'chat', allowedTabs: PACKAGE_SEAT }, trace);

    expect(el.shadowRoot!.querySelector('.chat-top')).toBeNull();
    expect(el.shadowRoot!.querySelector('chat-messages')).not.toBeNull();
  });

  it('draws it on a view tab too, in the view hole the rail switches to', async () => {
    const repair = document.createElement('chat-repair-actions');
    repair.setAttribute('slot', 'view');
    const el = await mount({ activeTab: 'versions', allowedTabs: CONSOLE_SEAT }, repair);

    expect(el.shadowRoot!.querySelector('.chat-top')).toBeNull();
    expect(el.shadowRoot!.querySelector('.view-slot slot[name="view"]')).not.toBeNull();
  });
});

/**
 * A FRESH COMPOSER KEEPS NOTHING FROM THE LAST ONE.
 *
 * The owner, 2026-09-18: "it's almost as if the composer is not clearing… every time I create a
 * new one by clicking composer, it should clear whatever Grace had and be ready to accept the
 * new run." The panel is reused across assemblies (the surface keeps the same component id), so
 * the turns it spoke in the previous place stayed on screen. `clearThread()` is what the host
 * calls when it means "a new place" — the Composer click.
 */
describe('<chat-panel> — starting over', () => {
  it('empties the thread on request, whoever put the turns there', async () => {
    const el = await mount({
      conversationId: '',
      messages: [
        { role: 'assistant', content: 'a turn from the last composer' },
        { role: 'user', content: 'and one of mine' },
      ],
    });
    expect(shadowText(el)).toContain('a turn from the last composer');

    el.clearThread();
    await settle(el);

    expect(shadowText(el)).not.toContain('a turn from the last composer');
    expect(shadowText(el)).not.toContain('and one of mine');
  });
});

describe('a conversation belongs to its package — the seat holds that line', () => {
  it('starting over for another package does not carry the turns spoken here across', async () => {
    stubFetch();                                        // the teacher answers; no conversation bound
    const el = await mount({ sessionId: 'package-a' });
    void (el as unknown as { _send: (t: string) => Promise<void> })['_send']('spoken in package A');
    await settle(el);
    expect(shadowText(el)).toContain('spoken in package A');

    // The package changes. The element is REUSED (the surface keeps the same component id),
    // nothing remounts it — so the seat itself has to leave the last package behind.
    el.sessionId = 'package-b';
    await settle(el);

    expect(shadowText(el)).not.toContain('spoken in package A');
  });

  it('does not leave the last package\'s LOADED history on screen either', async () => {
    // The stub answers per conversation — the first version of this test replayed package A's
    // history for package B's id, which proved nothing about the element.
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      const messages = String(url).includes('conv-b') ? [] : [{ role: 'user', content: 'spoken in package A' }];
      return { ok: true, status: 200, json: async () => ({ messages }) } as Response;
    }));
    const el = await mount({ sessionId: 'package-a', conversationId: 'conv-a' });
    expect(shadowText(el)).toContain('spoken in package A');

    el.sessionId = 'package-b';
    el.conversationId = 'conv-b';
    await settle(el);

    expect(shadowText(el)).not.toContain('spoken in package A');
  });

  it('refuses a conversation id the package\'s own list contradicts — and asks for nothing', async () => {
    const calls = stubFetch([{ role: 'user', content: 'not mine' }]);
    const el = await mount({
      sessionId: 'package-a',
      conversations: [{ id: 'conv-a' }],
      conversationId: 'conv-foreign',
    });
    await settle(el);

    // No read for a stranger's THREAD. (The seat does ask for its own package's conversation
    // COUNT when it learns which package it is — a different read, of its own session.)
    expect(calls.filter((c) => c.url.includes('/messages'))).toHaveLength(0);
    expect(shadowText(el)).not.toContain('not mine');
  });

  it('will not write pending turns into another package\'s conversation', async () => {
    const calls = stubFetch();
    const el = await mount({ sessionId: 'package-a' }); // no conversation yet
    const priv = el as unknown as Record<string, unknown>;
    priv['_pending'] = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'hello' }];
    priv['_pendingOwner'] = 'package-a';

    const refused = await el.flushPendingTurns('conv-of-b', 'package-b');
    expect(refused).toBe(0);
    expect(calls.filter((c) => c.init?.method === 'POST')).toHaveLength(0);

    // …and the same turns DO go to their own package.
    const written = await el.flushPendingTurns('conv-of-a', 'package-a');
    expect(written).toBe(2);
  });

  it('adopts a conversation id the server changed, and shows that the thread moved', async () => {
    const events: string[] = [];
    const onConv = () => events.push('conversation-change');
    window.addEventListener('conversation-change', onConv);
    vi.stubGlobal('fetch', vi.fn(async (url: unknown) => {
      if (String(url).includes('/api/teacher/query')) {
        return { ok: true, status: 200, json: async () => ({ content: 'Answer', conversation_id: 'conv-new' }) } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ messages: [] }) } as Response;
    }));

    const el = await mount({ sessionId: 'package-a', conversationId: 'conv-old' });
    void (el as unknown as { _send: (t: string) => Promise<void> })['_send']('hi');
    await settle(el);
    await settle(el);

    expect(el.conversationId).toBe('conv-new');
    expect(events).toContain('conversation-change');
    expect(shadowText(el)).toContain('previous conversation was closed');
    window.removeEventListener('conversation-change', onConv);
  });

  it('says a refusal out loud instead of drawing an empty thread', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }) as Response));
    const el = await mount({ sessionId: 'package-a', conversationId: 'conv-a' });
    await settle(el);

    expect(shadowText(el)).toContain('could not be read (HTTP 403)');
  });
});

describe('the approvals tab carries the thread', () => {
  it('draws the conversation and its input there, and not the empty view line', async () => {
    // The owner, 2026-09-18: "there's no chat hooked up to the console approval button. It's
    // dead, it does nothing — just hook one of them up so I can talk to it." The tab held the
    // repair list, which renders nothing when no findings carry a stage.
    stubFetch([{ role: 'assistant', content: 'INSPECTION — OK' }]);
    const el = await mount({
      sessionId: 'package-a',
      conversationId: 'conv-a',
      allowedTabs: 'chat,versions,tools,approvals,repair',
    });
    await settle(el);

    expect(el.shadowRoot?.querySelector('chat-messages')).toBeTruthy();

    el.activeTab = 'approvals';
    await settle(el);

    expect(el.shadowRoot?.querySelector('chat-messages')).toBeTruthy();
    expect(el.shadowRoot?.querySelector('.view-waiting')).toBeFalsy();
    expect(shadowText(el)).toContain('INSPECTION — OK');
  });
});
