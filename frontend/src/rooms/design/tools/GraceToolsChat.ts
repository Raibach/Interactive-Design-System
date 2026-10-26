/**
 * <grace-tools-chat> — GRACE'S CONVERSATION FOR THE DESIGN ROOM'S TOOLS TAB.
 *
 * The Tools tab already has the Figma ingestion tool on the left. This file is the conversation
 * beside it: its saved thread, its introduction, and its turn. It is a VIEW in the design seat's
 * output slot, mounted with `slot="view"` and `view-tab="tools"` exactly as the UX view is.
 *
 * THE INPUT IS THE SEAT'S (owner, 2026-10-18: one chat interface, its tabs change what is loaded
 * inside it). This view draws no form and owns no second field. It listens on the seat for the
 * events the seat's own bottom composer already raises — the bar's `send-input-to-model` and Enter
 * on the field — in the CAPTURE phase, and stops them there. The seat's own handler never runs, so
 * a Tools turn never lands in the design console's conversation.
 *
 * THE IDS COME FROM THE ROOM. `sessionId` is the Tools tab's own package and `conversationId` is
 * that package's conversation. The server writes both, and the assembly carries them through the
 * Figma surface's chat information. Nothing here invents either. The turn is sent with BOTH, which
 * is what makes the server file it under the Tools conversation (routes/teacher.py).
 *
 * THE FIRST MESSAGE IS SEEDED BY THE SERVER, once, when the Tools conversation is created. This
 * view reads the thread and draws it; it does not generate a greeting on every landing and it does
 * not print a hardcoded line over an empty thread. A conversation that cannot be read is drawn as
 * the failure it is.
 */
import { LitElement, html, css, nothing } from 'lit';
import { getStoredUserId } from '@/services/authService';

interface ToolsTurn {
  role: 'person' | 'app';
  text: string;
  failed?: boolean;
}

/** The design seat as this view uses it: its tab, its field, and the shadow root both live in. */
type SeatHost = HTMLElement & {
  activeTab?: string;
  renderRoot?: ShadowRoot;
};

/** The seat's own bottom composer, as the seat itself uses it. */
type SeatField = HTMLElement & { value?: string; focus?: () => void };

export class GraceToolsChat extends LitElement {
  static properties = {
    /** The Tools tab's package id — what the server files the turn under. */
    sessionId: { type: String },
    /** The Tools tab's conversation id — the thread this view reads and writes. */
    conversationId: { type: String },
    /** The Figma surface's own script for this room, carried by the assembly. */
    instructions: { type: String },
    busy: { type: Boolean, state: true },
  };

  declare sessionId: string;
  declare conversationId: string;
  declare instructions: string;
  declare busy: boolean;

  private _turns: ToolsTurn[] = [];
  private _seat: SeatHost | null = null;
  /** THE THREAD THIS VIEW HAS BOUND — not the property, so a re-render cannot reload it. */
  private _boundConversation = '';
  /** THE READ THAT IS RUNNING — a slower old read must not overwrite a newer thread. */
  private _loadSeq = 0;
  /** The working beat: when this turn started, and the seconds a person can watch tick. */
  private _startedAt = 0;
  private _elapsed = 0;
  private _ticker: number | null = null;

  constructor() {
    super();
    this.sessionId = '';
    this.conversationId = '';
    this.instructions = '';
    this.busy = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    /*
     * THE SEAT IS THE OTHER HALF OF THIS FILE. It owns the input; this view owns the output. The
     * join is the events the seat already raises — no property is added to the seat and no line of
     * it is edited. Capture on the seat host is what keeps the seat's own `_send` from running.
     */
    const seat = this.closest('design-chat') as unknown as SeatHost | null;
    if (!seat) {
      console.error(
        '[grace-tools-chat] mounted outside a design seat — the bottom input cannot be wired, and no Tools turn can be sent.',
      );
      return;
    }
    this._seat = seat;
    seat.addEventListener('send-input-to-model', this._onSeatSend, true);
    seat.addEventListener('keydown', this._onSeatKey, true);
    seat.addEventListener('tab-change', this._onSeatTabChange);
    this._syncConversation();
    this._applyPlaceholder();
  }

  disconnectedCallback(): void {
    const seat = this._seat;
    if (seat) {
      seat.removeEventListener('send-input-to-model', this._onSeatSend, true);
      seat.removeEventListener('keydown', this._onSeatKey, true);
      seat.removeEventListener('tab-change', this._onSeatTabChange);
    }
    this._restorePlaceholder();
    this._seat = null;
    this._stopTicker();
    super.disconnectedCallback();
  }

  /**
   * THE SEAT'S ONE INPUT CARRIES EACH TAB'S OWN PROMPT. The UX view owns the field while UX is
   * active; this view owns it while Tools is active; every other tab keeps the seat's own words.
   * The restore is conditional, so leaving Tools never erases a prompt another view has set.
   */
  private _applyPlaceholder(): void {
    const field = this._seatField();
    const inner = field?.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    if (!inner) return;
    if (this._toolsTabActive) {
      inner.placeholder = 'Ask Grace about this tool…';
    } else if (inner.placeholder === 'Ask Grace about this tool…') {
      inner.placeholder = 'chat input';
    }
  }

  private _restorePlaceholder(): void {
    const field = this._seatField();
    const inner = field?.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    if (inner && inner.placeholder === 'Ask Grace about this tool…') {
      inner.placeholder = 'chat input';
    }
  }

  private _onSeatTabChange = (): void => {
    this._applyPlaceholder();
  };

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('conversationId')) this._syncConversation();
  }

  /**
   * THE THREAD IS THE CONVERSATION'S, AND THE SERVER IS ITS AUTHORITY. A new id (the first
   * assembly, or the server moving a closed thread) is read once. An unreadable thread is drawn
   * in this view; it never looks like a tab nobody has spoken in.
   */
  private _syncConversation(): void {
    const next = String(this.conversationId || '');
    if (next === this._boundConversation) return;
    this._boundConversation = next;
    this._turns = [];
    if (!next) {
      this._turns = [
        {
          role: 'app',
          text:
            'The tools conversation is not available yet. The Figma tool is still assembling, ' +
            'or the Tools package could not be read.',
          failed: true,
        },
      ];
      this.requestUpdate();
      return;
    }
    void this._loadThread(next);
  }

  private async _loadThread(conversationId: string): Promise<void> {
    const seq = ++this._loadSeq;
    try {
      const res = await fetch(
        `/api/conversations/${encodeURIComponent(conversationId)}/messages?limit=200`,
        { headers: { 'X-User-ID': getStoredUserId() } },
      );
      const data = (await res.json().catch(() => null)) as {
        messages?: Array<{ role?: string; content?: string }>;
        detail?: string;
        error?: string;
      } | null;
      if (seq !== this._loadSeq || conversationId !== this._boundConversation) return;
      if (!res.ok || !data) {
        const why = data?.detail || data?.error || `the thread door answered ${res.status}`;
        this._turns = [{ role: 'app', text: `That conversation could not be read: ${why}`, failed: true }];
        this.requestUpdate();
        return;
      }
      this._turns = (data.messages ?? []).map((m) => ({
        role: String(m.role) === 'user' ? 'person' : 'app',
        text: String(m.content ?? ''),
      }));
      this.requestUpdate();
    } catch (e) {
      if (seq !== this._loadSeq) return;
      this._turns = [
        { role: 'app', text: `That conversation could not be read: ${(e as Error).message}`, failed: true },
      ];
      this.requestUpdate();
    }
  }

  /** Only the Tools tab's input belongs to this view; every other tab's input is the seat's. */
  private get _toolsTabActive(): boolean {
    return this._seat?.activeTab === 'tools';
  }

  private _seatField(): SeatField | null {
    const found = this._seat?.renderRoot?.querySelector('prompt-textarea');
    return (found as SeatField | null) ?? null;
  }

  /** The bar's Send — the same press the seat's own handler would have taken. */
  private _onSeatSend = (e: Event): void => {
    if (!this._toolsTabActive) return;
    e.stopPropagation();
    this._fromSeatInput();
  };

  /** Enter on the composer — the seat's `_onComposerKey`, taken before it reaches the seat. */
  private _onSeatKey = (e: KeyboardEvent): void => {
    if (!this._toolsTabActive) return;
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    e.stopPropagation();
    this._fromSeatInput();
  };

  /**
   * THE WORDS COME FROM THE SEAT'S FIELD, AND THEY ARE TAKEN THE WAY THE SEAT TAKES THEM: read,
   * cleared, and the clear announced so the bar's Send returns to its resting state.
   */
  private _fromSeatInput(): void {
    if (this.busy) return;
    const field = this._seatField();
    if (!field) {
      console.error('[grace-tools-chat] the seat has no prompt-textarea — the Tools turn could not be read.');
      return;
    }
    const typed = String(field.value ?? '').trim();
    if (!typed) return;
    field.value = '';
    field.dispatchEvent(
      new CustomEvent('value-input', { bubbles: true, composed: true, detail: { value: '' } }),
    );
    void this._ask(typed);
  }

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

  private async _ask(question: string): Promise<void> {
    if (!question || this.busy) return;
    if (!this._boundConversation) {
      this._turns = [
        ...this._turns,
        {
          role: 'app',
          text:
            'That turn was not sent: the tools conversation is not available. ' +
            'The Tools package could not be read, so there is nowhere to file the turn.',
          failed: true,
        },
      ];
      this.requestUpdate();
      return;
    }
    this._turns = [...this._turns, { role: 'person', text: question }];
    this.busy = true;
    this._startTicker();
    this.requestUpdate();
    try {
      const res = await fetch('/api/teacher/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({
          question,
          /* THE ROOM'S OWN SCRIPT, AS THE ASSEMBLY SUPPLIED IT. Never a second identity written
             here: if the surface did not carry it, the turn is simply sent without one. */
          context: this.instructions || undefined,
          mode: 'chat',
          reasoning: false,
          reasoning_style: 'chain_of_thought',
          include_memory: true,
          person_turn: true,
          session_id: this.sessionId || null,
          conversation_id: this._boundConversation,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        content?: string;
        answer?: string;
        message?: string;
        detail?: string;
        error?: string;
        conversation_id?: string;
        persistence_error?: string;
        warnings?: string[];
      } | null;
      /* THE SERVER MAY MOVE A CLOSED THREAD. Adopt the id it returned; the next turn belongs to
         the thread this view is drawing. */
      if (data?.conversation_id) {
        this._boundConversation = String(data.conversation_id);
        this.conversationId = this._boundConversation;
      }
      const text = data?.content || data?.answer || data?.message || '';
      if (res.ok && text) {
        this._turns = [...this._turns, { role: 'app', text }];
        if (data?.persistence_error) {
          this._turns = [
            ...this._turns,
            { role: 'app', text: `That answer could not be saved: ${data.persistence_error}`, failed: true },
          ];
        }
        for (const warning of data?.warnings ?? []) {
          this._turns = [...this._turns, { role: 'app', text: warning, failed: true }];
        }
      } else {
        const why = data?.detail || data?.error || `the turn door answered ${res.status}`;
        this._turns = [...this._turns, { role: 'app', text: `That turn failed: ${why}`, failed: true }];
      }
    } catch (e) {
      this._turns = [
        ...this._turns,
        { role: 'app', text: `That turn failed: ${(e as Error).message}`, failed: true },
      ];
    } finally {
      this._stopTicker();
      this.busy = false;
      this.requestUpdate();
    }
  }

  static styles = css`
    /*
     * THE OUTPUT AREA'S GROUND IS THE SEAT'S (white), so the type here is the design room's dark
     * ink and the person's turns use the palette's purple. The view draws only the thread; the
     * input above it is the seat's own bottom field.
     */
    :host {
      display: block;
      height: 100%;
      min-height: 0;
      width: 100%;
      color: #1c2f4e;
      font: 14px/1.45 'IBM Plex Sans', system-ui, sans-serif;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .thread {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 4px 0;
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
    .turn.failed {
      background: rgba(180, 83, 9, 0.12);
      border: 1px solid rgba(180, 83, 9, 0.55);
    }
    .turn.working {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #d1d5db;
      border-top-color: #1facc2;
      border-radius: 50%;
      animation: tools-spin 0.8s linear infinite;
      flex: 0 0 auto;
    }
    @keyframes tools-spin {
      to { transform: rotate(360deg); }
    }
  `;

  render() {
    return html`
      <div class="wrap">
        <div class="thread" role="log" aria-live="polite">
          ${this._turns.length
            ? this._turns.map(
                (t) => html`<div class="turn ${t.role} ${t.failed ? 'failed' : ''}">${t.text}</div>`,
              )
            : nothing}
          ${this.busy
            ? html`<div class="turn app working">
                <span class="spinner" aria-hidden="true"></span>
                <span>Working${this._elapsed ? ` — ${this._elapsed}s` : '…'}</span>
              </div>`
            : nothing}
        </div>
      </div>
    `;
  }
}

if (!customElements.get('grace-tools-chat')) {
  customElements.define('grace-tools-chat', GraceToolsChat);
}

declare global {
  interface HTMLElementTagNameMap {
    'grace-tools-chat': GraceToolsChat;
  }
}
