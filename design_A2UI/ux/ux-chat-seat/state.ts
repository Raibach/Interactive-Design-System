/**
 * THE SEAT'S STATE — its opening values and the values it derives for the drawing.
 *
 * The reactive property declarations and the working fields stay on the class: they are the
 * element's contract with the renderer and the state its view and actions read. What lives here
 * is the opening list and the derived readers.
 */
import { html, nothing } from 'lit';
import { formatWhen } from '@/shared/when';
import { isDemoMode } from '@/shared/appConfig';
import { ensureDefaultConversation } from './defaults';

export function seatDefaults(): Record<string, unknown> {
  return {
    statusText: '',
    status: '',
    sessionLabel: '',
    sessionName: '',
    duration: '',
    qaScore: '',
    usage: {},
    leftColumnContent: '',
    compiledOutput: '',
    consoleCards: [],
    catalogFindings: [],
    unannotatedInUse: [],
    modelLabel: 'Models',
    conversations: [],
    inputHeight: 0,
    activeTab: 'chat',
    collapsed: false,
    allowedTabs: '',
    tracePrompt: true,
  };
}

export function applySeatDefaults(host: any): void {
  Object.assign(host, seatDefaults());
  /* The default conversation is asked for here and decided in `./defaults.ts`; at construction the
     session is not known yet, so the call returns at once and the seat's own update asks again. */
  void ensureDefaultConversation(host);
}

/** The conversation card's rows, as this seat's list and its filter make them. */
export function conversationRowsForList(host: any) {
    /* THE APPROVE TAB'S ROWS ARE RECORDS, NOT CONVERSATIONS (owner, 2026-11-07): its view draws
       them, and the conversations card above it draws nothing — never another tab's list. */
    if (host.activeTab === 'approvals') {
      return html`<p class="conversation-none">This tab's records are drawn by its own view.</p>`;
    }
    /* THE SURFACE'S OWN LIST IS DRAWN UNTIL THE PACKAGE'S READ LANDS — the header's sessions were
       fed this way, and a card that hides them until a fetch comes back is a card that looks
       empty. The server read takes over the moment it arrives, and a failed read says its reason
       instead of pretending the package has none. */
    const surfaceRows = (host.conversations ?? []).map((c) => ({
      id: String(c?.id ?? ''),
      title: String(c?.title || '(untitled)'),
      tab: String(c?.tab || 'chat'),
      archived: false,
      savedAt: '',
      messageCount: 0,
    })).filter((r) => r.id);
    const rows = host._conversationRows ?? surfaceRows;
    if (!rows.length) {
      return html`<p class="conversation-none">${host._listNote || 'No conversations yet for this package.'}</p>`;
    }
    return rows.map(
      (r) => html`<li>
        <button class="conv-open" data-conversation-id=${r.id} @click=${host._pickConversation}>
          ${r.title}${r.archived ? html`<span class="tab-tag">archived</span>` : nothing}
        </button>
        ${r.savedAt
          // THE HOVER CARRIES THE EXACT STAMP, the way the Evals feed's row does: the drawn
          // text is local time and a machine stamp on the row would be unreadable, so each
          // says what the other cannot.
          ? html`<span class="conv-when" title=${`Last saved ${r.savedAt}`}>${formatWhen(r.savedAt)}</span>`
          : nothing}
        ${isDemoMode()
          // Deleting a conversation is refused on the demo (demo_policy.py locks
          // every DELETE), so the remove control is not drawn there.
          ? nothing
          : html`<button
          class="conv-remove ${host._armedDelete === r.id ? 'armed' : ''}"
          type="button"
          data-conversation-id=${r.id}
          title=${host._armedDelete === r.id ? 'Click again to remove this conversation' : 'Remove this conversation'}
          aria-label=${host._armedDelete === r.id ? 'Confirm remove' : 'Remove this conversation'}
          @click=${host._onConversationRemove}
        >
          ${host._armedDelete === r.id
            ? html`REMOVE`
            : html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
        </button>`}
      </li>`,
    );
}

/** Is there anything in this package? The greeting's own test. */
export function packageHasSomething(host: any) {
    if ((host.messages?.length ?? 0) > 0) return true;
    const raw = host.leftColumnContent as unknown;
    if (!raw) return false;
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { return false; }
    }
    /*
     * THE ROWS, AS THE SURFACE BINDS THEM — one shape, and it is the array.
     *
     * Both assemblies bind `leftColumnContent` to `/session/left_column/sections` (backend/routes/
     * ai.py, the `right-col` component: `"leftColumnContent": {"path": "/session/left_column/
     * sections"}`), which is the LIST. This read demanded `{sections: […]}` — so `parsed.sections`
     * was `undefined` on every package, this answered FALSE, and the branch that uses it ("an opened
     * package that is empty gives her nothing to read, so she says nothing instead") silenced her on
     * packages full of the person's words. The owner, 2026-09-23: "She's gone from the package.
     * Restore the model to the package."
     *
     * AN EARLIER REVISION OF THIS FIX ALSO ACCEPTED THE `{sections: […]}` OBJECT "for a caller that
     * still sends it" — and no caller does. That is a fallback wearing an acceptance letter, and it
     * is exactly what this application does not do: a reader reads the shape the surface sends, and
     * a shape nothing sends is not read at all. The owner, on the spot: "You mean you create a
     * fallback in my application? … This application has no room for bullshit."
     *
     * A row counts as something only when it has words in it — the rule this was written for.
     */
    if (!Array.isArray(parsed)) return false;
    return parsed.some((s) => String((s as { content?: string })?.content ?? '').trim().length > 0);
}
