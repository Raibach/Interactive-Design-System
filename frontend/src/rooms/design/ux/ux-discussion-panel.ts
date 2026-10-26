/**
 * <ux-discussion-panel> — THE UX TAB'S DISCUSSION, DRAWN IN THE CHAT OUTPUT.
 *
 * The discussion is its own thread under the UX package. This panel opens or finds that thread,
 * reads its messages, and sends the person's words to Grace's own `/api/teacher/query` door with
 * the UX package id. It does not use the framed PostHog application's agent. The input is the
 * seat's own bottom field, below the output; this panel draws the conversation and the character,
 * never a second composer.
 */
import { LitElement, html, css, nothing } from 'lit';
import { getStoredUserId } from '@/services/authService';
import { UX_GRACE_INSTRUCTIONS } from './ux-voice';
import discussionStop from '@/assets/posthog-discussion-stop.png';

interface DiscussionTurn {
  role: 'person' | 'app';
  text: string;
  failed?: boolean;
}

export class UxDiscussionPanel extends LitElement {
  static properties = {
    packageId: { type: String },
    busy: { type: Boolean, state: true },
  };

  declare packageId: string;
  declare busy: boolean;

  private _packageId = '';
  private _conversationId = '';
  private _turns: DiscussionTurn[] = [];
  private _loaded = false;
  private _error = '';

  constructor() {
    super();
    this.packageId = '';
    this.busy = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this._open();
  }

  private async _open(): Promise<void> {
    this._loaded = false;
    this._error = '';
    this.requestUpdate();
    try {
      const res = await fetch('/api/ux/chat/discussion', {
        method: 'POST',
        headers: { 'X-User-ID': getStoredUserId() },
      });
      const data = (await res.json().catch(() => null)) as {
        package_id?: string;
        conversation_id?: string;
        error?: string;
      } | null;
      if (!res.ok || !data || data.error || !data.conversation_id) {
        this._error = data?.error || `the discussion door answered ${res.status}`;
        return;
      }
      if (data.package_id) this._packageId = String(data.package_id);
      this._conversationId = String(data.conversation_id);
      await this._loadMessages();
    } catch (e) {
      this._error = (e as Error).message;
    } finally {
      this._loaded = true;
      this.requestUpdate();
    }
  }

  private async _loadMessages(): Promise<void> {
    if (!this._conversationId) return;
    const res = await fetch(
      `/api/conversations/${encodeURIComponent(this._conversationId)}/messages?limit=200`,
      { headers: { 'X-User-ID': getStoredUserId() } },
    );
    const data = (await res.json().catch(() => null)) as {
      messages?: Array<{ role?: string; content?: string }>;
      detail?: string;
      error?: string;
    } | null;
    if (!res.ok || !data) {
      this._error = data?.detail || data?.error || `the discussion thread answered ${res.status}`;
      return;
    }
    this._turns = (data.messages ?? []).map((m) => ({
      role: String(m.role) === 'user' ? 'person' : 'app',
      text: String(m.content ?? ''),
    }));
  }

  /** The UX view calls this when the seat's own input sends while Discussion is the open panel. */
  async send(text: string, context = ''): Promise<void> {
    const question = text.trim();
    if (!question || this.busy) return;
    if (!this._conversationId) {
      this._turns = [
        ...this._turns,
        { role: 'app', text: 'The discussion thread is not available yet.', failed: true },
      ];
      this.requestUpdate();
      return;
    }
    this._turns = [...this._turns, { role: 'person', text: question }];
    this.busy = true;
    this.requestUpdate();
    try {
      const res = await fetch('/api/teacher/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({
          question,
          context:
            context ||
            `${UX_GRACE_INSTRUCTIONS} This is a separate discussion thread about Product analytics.`,
          mode: 'chat',
          reasoning: false,
          reasoning_style: 'chain_of_thought',
          include_memory: true,
          person_turn: true,
          session_id: this.packageId || this._packageId || undefined,
          conversation_id: this._conversationId,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        content?: string;
        error?: string;
        detail?: string;
        conversation_id?: string;
        persistence_error?: string;
        warnings?: string[];
      } | null;
      if (data?.conversation_id) this._conversationId = String(data.conversation_id);
      if (res.ok && data?.content) {
        this._turns = [...this._turns, { role: 'app', text: data.content }];
        if (data.persistence_error) {
          this._turns = [
            ...this._turns,
            { role: 'app', text: `That answer could not be saved: ${data.persistence_error}`, failed: true },
          ];
        }
        for (const warning of data.warnings ?? []) {
          this._turns = [...this._turns, { role: 'app', text: warning, failed: true }];
        }
      } else {
        const why = data?.detail || data?.error || `the turn door answered ${res.status} with no content`;
        this._turns = [...this._turns, { role: 'app', text: `That turn failed: ${why}`, failed: true }];
      }
    } catch (e) {
      this._turns = [
        ...this._turns,
        { role: 'app', text: `That turn failed: ${(e as Error).message}`, failed: true },
      ];
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  private _back = (): void => {
    this.dispatchEvent(new CustomEvent('ux-panel-back', { bubbles: true, composed: true }));
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      width: 100%;
      color: #1c2f4e;
      font: 13px/1.45 'IBM Plex Sans', system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      padding: 2px 0 8px;
    }
    .back {
      appearance: none;
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      padding: 0;
      border: 1px solid rgba(28, 47, 78, 0.16);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.75);
      color: #3d515b;
      cursor: pointer;
    }
    .back:hover { background: #fff; border-color: rgba(28, 47, 78, 0.3); }
    .back svg { width: 14px; height: 14px; }
    .head-title { font-size: 13px; font-weight: 700; }
    .body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .intro {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 0 0 auto;
      padding: 0 0 2px;
    }
    .hog {
      width: 84px;
      height: 84px;
      object-fit: contain;
      flex: 0 0 auto;
    }
    .intro-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .intro-copy strong { font-size: 14px; font-weight: 700; }
    .intro-copy span {
      font-size: 11px;
      color: rgba(28, 47, 78, 0.6);
    }
    .thread {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1 1 auto;
      min-height: 0;
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
      animation: discussion-spin 0.8s linear infinite;
      flex: 0 0 auto;
    }
    @keyframes discussion-spin { to { transform: rotate(360deg); } }
    .empty {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      color: rgba(28, 47, 78, 0.55);
      font-size: 12px;
      text-align: center;
      padding: 8px 12px;
    }
    .hint {
      flex: 0 0 auto;
      font-size: 11px;
      color: rgba(28, 47, 78, 0.52);
      padding-top: 2px;
    }
    .error {
      color: #a31545;
      white-space: pre-wrap;
      font-size: 12px;
    }
  `;

  render() {
    return html`
      <div class="head">
        <button type="button" class="back" aria-label="Back to chat" title="Back to chat" @click=${this._back}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 3L5 8l5 5"></path>
          </svg>
        </button>
        <span class="head-title">Discussion about Product analytics</span>
      </div>
      <div class="body">
        <div class="intro">
          <img class="hog" src=${discussionStop} alt="" aria-hidden="true" />
          <span class="intro-copy">
            <strong>Discussion</strong>
            <span>A separate thread about what you are looking at. Use the chat input below to add to it.</span>
          </span>
        </div>
        ${!this._loaded
          ? html`<div class="empty">Loading the discussion…</div>`
          : this._error
            ? html`<p class="error" role="alert">${this._error}</p>`
            : html`
                <div class="thread" role="log">
                  ${this._turns.map(
                    (t) => html`<div class="turn ${t.role} ${t.failed ? 'failed' : ''}">${t.text}</div>`,
                  )}
                  ${this.busy
                    ? html`<div class="turn app working">
                        <span class="spinner" aria-hidden="true"></span>
                        <span>Working…</span>
                      </div>`
                    : nothing}
                </div>
                ${this._turns.length
                  ? html`<p class="hint">Use the chat input below to add to this discussion.</p>`
                  : html`<div class="empty">
                      <span>There are no messages in this discussion yet.</span>
                      <span>Use the chat input below to start it.</span>
                    </div>`}
              `}
      </div>
    `;
  }
}

if (!customElements.get('ux-discussion-panel')) {
  customElements.define('ux-discussion-panel', UxDiscussionPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    'ux-discussion-panel': UxDiscussionPanel;
  }
}
