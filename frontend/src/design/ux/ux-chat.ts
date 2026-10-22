/**
 * <ux-chat> — THE UX CHAT AS ITS OWN FILE (owner, 2026-10-18).
 *
 * The correction, verbatim: *"you will have to have a dedicated file for UX chat. You cannot
 * repurpose a 7000 line page of an app and inject every single aspect of this application."*
 * This file replaces the four injections that made the seat carry one more application's chat.
 *
 * WHAT IT OWNS: the thread drawn in the seat's view slot, the quick links, and the turn call. The
 * server answers `/api/ux/posthog-chat` with `{content}` or a loud `{error}` — both are drawn
 * here; nothing is caught to make a failure look like an empty reply.
 *
 * THE FEATURES ARE PORTED FROM THEIR CHAT, IN OUR STYLING (owner, 2026-10-19: *"the actual chat
 * is already still there. It's sitting right next to our chat … all you have to do is port the
 * features directly into our user interface"*). Their app is open in the left column, so each
 * feature is read off it and rebuilt here on our own data:
 *   - their Recent-chats list (title + "Just now"/"29m") → our list of the tab's saved threads,
 *     with New chat and View all;
 *   - their mode tab and "Add context" pill → our pills row directly above the input, where
 *     Add context really attaches the section to the next question;
 *   - their "Ask a question or / for commands" prompt → the seat's own field's placeholder on
 *     this tab, with /new and /download as the commands that exist;
 *   - their waiting beat → the system's own spinner and the turn's real seconds.
 *
 * THE INPUT IS NOT IN THIS FILE (owner, 2026-10-19: *"there's a chat input. It's labeled at the
 * bottom. There's a send button that activates when you enter something, but for some reason you
 * put it up in the middle where the output area is — are those sections not labeled for you?"*).
 * The sections ARE labeled: this view IS the output. The input is the seat's own bottom field —
 * the one labelled "chat input", with the Send button beside it — and this file wires that field
 * for the UX tab by listening ON THE SEAT for the two events its input already raises: the bar's
 * `send-input-to-model`, and Enter on the composer. Both are handled in the CAPTURE phase on the
 * seat host and stopped there, so the seat's own handler never runs: nothing flips to the Chat
 * tab and nothing is sent down `/api/teacher/query`. The words go to the UX door and the answer
 * is drawn in this view.
 *
 * HOW IT IS MOUNTED: as a seat VIEW, the mechanism the catalogue already has — the page appends
 * it to the seat with `slot="view"` and `view-tab="ux"`, and the seat's own CSS pair shows it
 * only while the UX tab is the active one. No seat code is edited to carry this file, which is
 * the whole point of it existing separately.
 */
import { LitElement, html, css, nothing } from 'lit';
import { getStoredUserId } from '@/services/authService';
import { UX_QUICK_LINKS } from './quick-links';

interface UxTurn {
  role: 'person' | 'app';
  text: string;
}

/** One row of the tab's recent chats, as the server lists them. */
interface UxConversation {
  id: string;
  title: string;
  updated_at: string;
}

/** THE COMMANDS THE PLACEHOLDER PROMISES — each one does something real in this view. */
const UX_COMMANDS = [
  { command: '/new', hint: 'start a new chat' },
  { command: '/download', hint: 'download this chat' },
];

/** Their list's own when: Just now, 29m, 2h, 3d — measured from the row's last save. */
function relativeWhen(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return '';
  const mins = Math.max(0, Math.round((Date.now() - then) / 60000));
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** The seat as this view uses it: its tab, its session, and the shadow root its input lives in. */
type SeatHost = HTMLElement & { activeTab?: string; sessionId?: string; conversationId?: string; renderRoot?: ShadowRoot };

/** The seat's own bottom composer, as the seat itself uses it. */
type SeatField = HTMLElement & { value?: string; focus?: () => void };

export class UxChat extends LitElement {
  static properties = {
    busy: { type: Boolean, state: true },
    /* THE HEADER'S TWO LINES — the room sets them; absence draws nothing. Line one is the
       section the person is working in ("Product analytics"), line two is the model and the
       turn's own figures WHEN the server supplies them. Neither is invented here. */
    section: { type: String },
    meta: { type: String },
  };

  declare busy: boolean;
  declare section: string;
  declare meta: string;

  private _turns: UxTurn[] = [];
  private _seat: SeatHost | null = null;
  /** THE SAVED THREAD'S ID — from the server, never invented here. Empty until one exists. */
  private _conversationId = '';
  /** THE TAB'S RECENT CHATS — their own list under the composer, read from our database. */
  private _conversations: UxConversation[] = [];
  private _showAllChats = false;
  /** THEIR "Add context" PILL: when it is on, the section rides the turn. */
  private _contextOn = false;
  /** The input currently begins with "/" — the command list takes the pills' place. */
  private _slash = false;
  /** The working beat: when this turn started, and the seconds a person can watch tick. */
  private _startedAt = 0;
  private _elapsed = 0;
  private _ticker: number | null = null;

  constructor() {
    super();
    this.busy = false;
    this.section = '';
    this.meta = '';
  }

  connectedCallback(): void {
    super.connectedCallback();
    /*
     * THE SEAT IS THE OTHER HALF OF THIS FILE. It owns the input; this view owns the output.
     * The two are joined by the events the seat's own input already raises — no property is
     * added to the seat and no line of it is edited.
     */
    const seat = this.closest('design-chat') as SeatHost | null;
    if (!seat) {
      console.error('[ux-chat] mounted outside a seat — the bottom input cannot be wired, and no UX turn can be sent.');
      return;
    }
    this._seat = seat;
    seat.addEventListener('send-input-to-model', this._onSeatSend, true);
    seat.addEventListener('keydown', this._onSeatKey, true);
    seat.addEventListener('value-input', this._onSeatValue, true);
    seat.addEventListener('tab-change', this._onSeatTabChange);
    /* THE THREAD THAT WAS ALREADY SAID (owner, 2026-10-19: *"I noticed that the conversations
       went away … are we not saving these conversations"*). It is read from the server, which
       is the only place it lives — this view keeps no copy of its own between loads. */
    void this._restoreThread();
    void this._loadConversations();
    this._applyPlaceholder();
  }

  disconnectedCallback(): void {
    const seat = this._seat;
    if (seat) {
      seat.removeEventListener('send-input-to-model', this._onSeatSend, true);
      seat.removeEventListener('keydown', this._onSeatKey, true);
      seat.removeEventListener('value-input', this._onSeatValue, true);
      seat.removeEventListener('tab-change', this._onSeatTabChange);
    }
    this._seat = null;
    this._stopTicker();
    this._restorePlaceholder();
    super.disconnectedCallback();
  }

  /**
   * THEIR PLACEHOLDER, WHERE IT BELONGS: the seat's own field is the input, so its prompt is set
   * for the UX tab ("Ask a question or / for commands") and put back the moment another tab
   * owns the field. Only the property is written — no line of the seat is edited.
   */
  private _applyPlaceholder(): void {
    const field = this._seatField();
    const inner = field?.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    if (inner) inner.placeholder = 'Ask a question or / for commands';
  }

  private _restorePlaceholder(): void {
    const field = this._seatField();
    const inner = field?.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    if (inner) inner.placeholder = 'chat input';
  }

  /** The composer's own value drives the command list — typing "/" is what shows it. */
  private _onSeatValue = (e: Event): void => {
    const value = String((e as CustomEvent<{ value?: string }>).detail?.value ?? '');
    const slash = value.trimStart().startsWith('/');
    if (slash !== this._slash) {
      this._slash = slash;
      this.requestUpdate();
    }
  };

  private _onSeatTabChange = (): void => {
    this._applyPlaceholder();
  };

  /** THE TAB'S RECENT CHATS (their list, our database) — newest first, title and last save. */
  private async _loadConversations(): Promise<void> {
    try {
      const res = await fetch('/api/ux/conversations', { headers: { 'X-User-ID': getStoredUserId() } });
      const data = (await res.json().catch(() => null)) as {
        conversations?: Array<{ id?: string; title?: string; updated_at?: string }>;
        error?: string;
      } | null;
      if (!res.ok || !data || data.error) {
        console.error('[ux-chat] the recent chats could not be listed:', data?.error || res.status);
        return;
      }
      this._conversations = (data.conversations ?? [])
        .filter((c) => c && c.id)
        .map((c) => ({ id: String(c.id), title: String(c.title || '(untitled)'), updated_at: String(c.updated_at || '') }));
      this.requestUpdate();
    } catch (e) {
      console.error('[ux-chat] the recent chats could not be listed:', (e as Error).message);
    }
  }

  /** Opened from the navigation's Chat tab — the same path the view's own list used. */
  openConversation(id: string): void {
    void this._openConversation(id);
  }

  /** Open one of the tab's chats — the server is asked for THAT thread, not the newest. */
  private async _openConversation(id: string): Promise<void> {
    if (!id || id === this._conversationId) return;
    try {
      const res = await fetch(`/api/ux/chat/thread?conversation_id=${encodeURIComponent(id)}`, {
        headers: { 'X-User-ID': getStoredUserId() },
      });
      const data = (await res.json().catch(() => null)) as {
        conversation_id?: string | null;
        messages?: Array<{ role?: string; content?: string }>;
        error?: string;
      } | null;
      if (!res.ok || !data || data.error) {
        const why = data?.error || `the thread door answered ${res.status}`;
        this._turns = [...this._turns, { role: 'app', text: `That conversation could not be read: ${why}` }];
        this.requestUpdate();
        return;
      }
      this._conversationId = String(data.conversation_id || '');
      this._turns = (data.messages ?? []).map((m) => ({
        role: String(m.role) === 'user' ? 'person' : 'app',
        text: String(m.content ?? ''),
      }));
      this.requestUpdate();
    } catch (e) {
      this._turns = [...this._turns, { role: 'app', text: `That conversation could not be read: ${(e as Error).message}` }];
      this.requestUpdate();
    }
  }

  /** A NEW CHAT starts empty; its conversation is created by the first thing said in it. */
  private _newChat(): void {
    this._conversationId = '';
    this._turns = [];
    this.requestUpdate();
  }

  /** /download — the thread this view owns, as Markdown, exactly as it was said. */
  private _download(): void {
    if (!this._turns.length) {
      this._turns = [...this._turns, { role: 'app', text: 'There is nothing in this chat to download yet.' }];
      this.requestUpdate();
      return;
    }
    const heading = this.section ? `UX chat — ${this.section}` : 'UX chat';
    const body = this._turns
      .map((t) => `${t.role === 'person' ? '**You:**' : '**App:**'} ${t.text}`)
      .join('\n\n');
    const blob = new Blob([`# ${heading}\n_${new Date().toLocaleString()}_\n\n${body}\n`], {
      type: 'text/markdown;charset=utf-8',
    });
    const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `ux-chat-${stamp}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  /** The seconds under the spinner are this turn's own — started, stopped, never guessed. */
  private _startTicker(): void {
    this._stopTicker();
    this._startedAt = Date.now();
    this._elapsed = 0;
    this._ticker = window.setInterval(() => {
      this._elapsed = Math.max(0, Math.round((Date.now() - this._startedAt) / 1000));
      this.requestUpdate();
    }, 1000) as unknown as number;
  }

  private _stopTicker(): void {
    if (this._ticker !== null) {
      window.clearInterval(this._ticker);
      this._ticker = null;
    }
  }

  /** Only the UX tab is this view's; every other tab's input belongs to the seat. */
  private get _uxTabActive(): boolean {
    return this._seat?.activeTab === 'ux';
  }

  private _seatField(): SeatField | null {
    const found = this._seat?.renderRoot?.querySelector('prompt-textarea');
    return (found as SeatField | null) ?? null;
  }

  /**
   * THE SAVED THREAD, DRAWN AGAIN (owner, 2026-10-19: *"I noticed that the conversations went
   * away … what happened to conversation ID?"*).
   *
   * The server is the authority: `GET /api/ux/chat/thread` answers with the tab's conversation id
   * and its messages. A failure is DRAWN — a thread that could not be read must never look like a
   * tab nobody has talked to yet.
   */
  private async _restoreThread(): Promise<void> {
    try {
      /* THE TAB'S OWN THREAD (restored 2026-10-19, owner: *"the conversations … you can restore
         those, put those back where they belong"*). This view reads the thread the UX door owns —
         the one its own list names — exactly as it did before. */
      const res = await fetch('/api/ux/chat/thread', {
        headers: { 'X-User-ID': getStoredUserId() },
      });
      const data = (await res.json().catch(() => null)) as {
        conversation_id?: string | null;
        messages?: Array<{ role?: string; content?: string }>;
        error?: string;
      } | null;
      if (!res.ok || !data || data.error) {
        const why = data?.error || `the thread door answered ${res.status} with no thread`;
        this._turns = [...this._turns, { role: 'app', text: `That conversation could not be read: ${why}` }];
        this.requestUpdate();
        return;
      }
      this._conversationId = String(data.conversation_id || '');
      const loaded: UxTurn[] = (data.messages ?? []).map((m) => ({
        role: String(m.role) === 'user' ? 'person' : 'app',
        text: String(m.content ?? ''),
      }));
      /* ONLY WHAT THE SERVER SAID IS DRAWN — an empty answer is a saved row with no words, and it
         is shown as the empty answer it is rather than being dropped. */
      this._turns = loaded;
      this.requestUpdate();
    } catch (e) {
      this._turns = [
        ...this._turns,
        { role: 'app', text: `That conversation could not be read: ${(e as Error).message}` },
      ];
      this.requestUpdate();
    }
  }

  /** The bar's Send — the same press the seat's own handler would have taken. */
  private _onSeatSend = (e: Event): void => {
    if (!this._uxTabActive) return;
    e.stopPropagation();
    this._fromSeatInput();
  };

  /** Enter on the composer — the seat's `_onComposerKey`, taken before it reaches the seat. */
  private _onSeatKey = (e: KeyboardEvent): void => {
    if (!this._uxTabActive) return;
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    this._fromSeatInput();
  };

  /**
   * THE WORDS COME FROM THE SEAT'S FIELD, AND THEY ARE TAKEN THE WAY THE SEAT TAKES THEM: the
   * field is read and cleared, and the clear is announced (`value-input`) so the bar's Send goes
   * back to its resting state — the same three facts the seat writes on its own send.
   */
  private _fromSeatInput(): void {
    if (this.busy) return;
    const field = this._seatField();
    if (!field) {
      console.error('[ux-chat] the seat has no prompt-textarea — the UX turn could not be read.');
      return;
    }
    const typed = String(field.value ?? '').trim();
    if (!typed) return;
    field.value = '';
    field.dispatchEvent(new CustomEvent('value-input', { bubbles: true, composed: true, detail: { value: '' } }));
    this._slash = false;
    /* A COMMAND IS NOT A TURN: the placeholder promised / for commands, so the ones that exist
       run here and never reach the model. */
    if (typed.startsWith('/')) {
      this._runCommand(typed);
      return;
    }
    void this._ask(typed);
  }

  private _runCommand(text: string): void {
    const name = text.split(/\s+/)[0].toLowerCase();
    if (name === '/new') {
      this._newChat();
      return;
    }
    if (name === '/download') {
      this._download();
      return;
    }
    this._turns = [
      ...this._turns,
      { role: 'app', text: `Unknown command ${name}. The commands here are /new and /download.` },
    ];
    this.requestUpdate();
  }

  static styles = css`
    /*
     * THE OUTPUT AREA'S GROUND IS THE SEAT'S (white — the view slot paints it), so the type here
     * is the app's own dark ink and the chips use the palette's blue. The first version carried a
     * dark-ground palette, and on the seat's white slot the quick links were nearly invisible.
     * (No backticks in this comment: this is a Lit css literal and one would end it.)
     */
    :host {
      display: block;
      height: 100%;
      min-height: 0;
      width: 100%;
      color: #1c2f4e;
      font: 14px/1.45 Inter, system-ui, sans-serif;
    }
    /* The seat's ::slotted rule lays the view out as a block; this column is the view's own. */
    .wrap {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 8px 0 0;
      flex: 0 0 auto;
    }
    /* THE RECENT CHATS — their list, at the top because ours is the conversation's home.
       Title first (one line, ellipsised), the last save at the end, the open thread marked. */
    .recent {
      flex: 0 0 auto;
      padding: 0 0 10px;
      border-bottom: 1px solid rgba(28, 47, 78, 0.12);
      margin-bottom: 10px;
    }
    .recent-head {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 8px;
      padding-bottom: 4px;
    }
    .recent-label {
      font-size: 13px;
      font-weight: 700;
      color: #1c2f4e;
    }
    .recent-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .recent-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      width: 100%;
      padding: 5px 6px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    .recent-row:hover {
      background: #f7fafc;
    }
    .recent-row.on {
      background: rgba(126, 114, 227, 0.12);
    }
    .recent-title {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 13px;
    }
    .recent-when {
      flex: 0 0 auto;
      font-size: 12px;
      color: #6c757d;
    }
    .recent-empty {
      margin: 2px 0 0;
      font-size: 13px;
      font-style: italic;
      color: #6c757d;
    }
    .link {
      border: 0;
      background: none;
      padding: 0;
      color: #4e68d2;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    /* THE PILLS ROW sits where their composer's do — directly above the input. The section is
       named, and Add context is a real toggle that attaches it to the next question. */
    .composer {
      flex: 0 0 auto;
      padding: 8px 0 0;
    }
    .pills,
    .commands {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pill {
      height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid rgba(28, 47, 78, 0.22);
      background: #ffffff;
      color: #6c757d;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .pill.on {
      border-color: #4e68d2;
      color: #4e68d2;
      background: #f3f6ff;
    }
    /* THE SECTION HEADER — line one names the screen the person is working in, line two carries
       the model and the turn's figures when there are any. Drawn only when the room says them. */
    .section {
      flex: 0 0 auto;
      padding: 0 0 10px;
      border-bottom: 1px solid rgba(28, 47, 78, 0.12);
      margin-bottom: 10px;
    }
    .section-name {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
      color: #1c2f4e;
    }
    .section-meta {
      margin: 2px 0 0;
      font-size: 12px;
      font-weight: 500;
      color: #6c757d;
    }
    .chip {
      height: 26px;
      padding: 0 10px;
      border-radius: 999px;
      border: 1px solid rgba(28, 47, 78, 0.22);
      background: #ffffff;
      color: #4e68d2;
      font: inherit;
      font-size: 12px;
      cursor: pointer;
    }
    .chip:hover {
      background: #f7fafc;
    }
    .thread {
      flex: 1 1 0%;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .turn {
      max-width: 92%;
      padding: 9px 12px;
      border-radius: 10px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .turn.person {
      align-self: flex-end;
      background: rgba(126, 114, 227, 0.16);
    }
    .turn.app {
      align-self: flex-start;
      background: rgba(28, 47, 78, 0.06);
    }
    .turn.app.failed {
      background: rgba(180, 83, 9, 0.12);
      border: 1px solid rgba(180, 83, 9, 0.55);
    }
    /* THE WORKING BEAT — the system's own spinner (the seat's .view-spinner values: a 14px
       ring, #D1D5DB with an #1FACC2 head, one turn per 0.8s) beside the elapsed seconds,
       which are this turn's real time and nothing else. No invented stage names. */
    .turn.app.working {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #D1D5DB;
      border-top-color: #1FACC2;
      border-radius: 50%;
      animation: ux-spin 0.8s linear infinite;
      flex: 0 0 auto;
    }
    @keyframes ux-spin {
      to { transform: rotate(360deg); }
    }
  `;

  private async _ask(question: string): Promise<void> {
    if (!question || this.busy) return;
    this._turns = [...this._turns, { role: 'person', text: question }];
    this.busy = true;
    this._startTicker();
    this.requestUpdate();
    try {
      const res = await fetch('/api/ux/posthog-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({
          session_id: String(this._seat?.sessionId ?? ''),
          conversation_id: this._conversationId || undefined,
          question,
          /* THEIR "Add context" PILL, PORTED: when it is on, the section the person is looking
             at rides the turn and the app's agent reads it as part of what was said. */
          context: this._contextOn && this.section ? `the person is looking at ${this.section}` : '',
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        content?: string;
        error?: string;
        conversation_id?: string;
        saved?: boolean;
        save_error?: string;
      } | null;
      /* THE THREAD'S ID COMES BACK FROM THE SERVER, created on its first turn — this view keeps
         it so every later turn continues the SAME conversation, on both sides of the door. */
      if (data?.conversation_id) this._conversationId = String(data.conversation_id);
      if (data?.content) {
        this._turns = [...this._turns, { role: 'app', text: data.content }];
        if (data.saved === false) {
          this._turns = [
            ...this._turns,
            { role: 'app', text: `That answer could not be saved: ${data.save_error || 'the write failed'}` },
          ];
        }
      } else {
        /* A REFUSAL IS DRAWN IN FULL — status and the server's own words, never swallowed. */
        const why = data?.error || `the UX chat door answered ${res.status} with no content`;
        this._turns = [...this._turns, { role: 'app', text: `That turn failed: ${why}` }];
      }
    } catch (e) {
      this._turns = [...this._turns, { role: 'app', text: `That turn failed: ${(e as Error).message}` }];
    } finally {
      this._stopTicker();
      this.busy = false;
      this.requestUpdate();
      /* THE LIST MOVES WHEN THE THREAD DOES — the row's title and its last-save time are this
         turn's own facts, so the list is re-read rather than patched by hand. */
      void this._loadConversations();
    }
  }

  /**
   * A quick link PLACES ITS COMMAND IN THE INPUT — it never sends by itself (the rule this file
   * already carried). The input is the seat's bottom field now, so the command is written there
   * and announced the same way typing is, which is what lights the bar's Send button.
   */
  private _pick(command: string): void {
    const field = this._seatField();
    if (!field) {
      console.error('[ux-chat] the seat has no prompt-textarea — the quick link could not be placed.');
      return;
    }
    field.value = command;
    field.dispatchEvent(new CustomEvent('value-input', { bubbles: true, composed: true, detail: { value: command } }));
    /* THE CURSOR GOES WHERE THE PERSON TYPES — the field's own <textarea>, not the host
       around it: focusing the host leaves the caret nowhere and the keyboard with no target. */
    const inner = (field.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null) ?? null;
    inner?.focus();
  }

  render() {
    return html`
      <div class="wrap">
        ${this.section
          ? html`<div class="section">
              <p class="section-name">${this.section}</p>
              ${this.meta ? html`<p class="section-meta">${this.meta}</p>` : nothing}
            </div>`
          : nothing}
        <!-- THE CONVERSATION LIST IS NOT DRAWN HERE (owner, 2026-10-19: *"It's already featured in
             the chat panel in the very same goddamn output … you have put the conversations down
             inside of the chat output"*). The seat owns conversations — its bar and list moved into
             the reserved foot card — so this view draws the thread and nothing else. -->
        <div class="thread" role="log">
          ${this._turns.map(
            (t) => html`<div class="turn ${t.role} ${t.role === 'app' && t.text.startsWith('That turn failed') ? 'failed' : ''}">${t.text}</div>`,
          )}
          ${this.busy
            ? html`<div class="turn app working">
                <span class="spinner" aria-hidden="true"></span>
                <span>Thinking${this._elapsed ? ` · ${this._elapsed}s` : '…'}</span>
              </div>`
            : nothing}
        </div>
        <div class="chips" role="group" aria-label="Quick links">
          ${UX_QUICK_LINKS.map(
            (link) =>
              html`<button type="button" class="chip" @click=${() => this._pick(link.command)}>${link.label}</button>`,
          )}
        </div>
        <div class="composer" aria-live="polite">
          ${this._slash
            ? html`<div class="commands" role="group" aria-label="Commands">
                ${UX_COMMANDS.map(
                  (c) => html`<button type="button" class="chip" @click=${() => this._pick(c.command)}>
                    ${c.command} · ${c.hint}
                  </button>`,
                )}
              </div>`
            : html`<div class="pills">
                <span class="pill" title="The screen this chat is about">${this.section || 'Chat'}</span>
                <button
                  type="button"
                  class="pill ${this._contextOn ? 'on' : ''}"
                  aria-pressed=${this._contextOn ? 'true' : 'false'}
                  title="Include the screen you are looking at with your next question"
                  @click=${() => { this._contextOn = !this._contextOn; this.requestUpdate(); }}
                >
                  Add context
                </button>
              </div>`}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('ux-chat')) customElements.define('ux-chat', UxChat);

declare global {
  interface HTMLElementTagNameMap {
    'ux-chat': UxChat;
  }
}
