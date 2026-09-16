/**
 * <chat-messages> — the package conversation's thread.
 *
 * Figma source: the "output-area" slots 40001066:4314–4326 inside
 * right-column-panel-container (40001066:3272) — column, padding 20px, gap 10px,
 * radius 6px, fill #FFFFFF, hug height. Those slots are the message wells.
 *
 * Pure render: it takes the resolved message list as a property and draws
 * role-styled turns. It owns scroll-to-bottom. It never fetches or writes — the
 * parent <chat-panel> is the one channel to the package conversation.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css, nothing } from 'lit';

export interface ChatMessage {
  role?: string;
  content?: string;
}

export interface ChatConversation {
  id?: string;
  title?: string;
}

export class ChatMessages extends LitElement {
  static properties = {
    /** The conversation history, resolved by <chat-panel>. */
    messages: { type: Array },
    /** True while a send is in flight; draws a "Thinking…" turn. */
    sending: { type: Boolean },
    /** The package's conversations — the selector BELOW the output is part of the binding. */
    conversations: { type: Array },
    /** The conversation currently bound. */
    conversationId: { type: String, attribute: 'conversation-id' },
  };

  declare messages: ChatMessage[];
  declare sending: boolean;
  declare conversations: ChatConversation[];
  declare conversationId?: string;

  private _menuOpen = false;

  constructor() {
    super();
    this.messages = [];
    this.sending = false;
    this.conversations = [];
    this.conversationId = undefined;
  }

  static styles = css`
    :host { display: flex; flex-direction: column; min-height: 0; }
    .thread {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 20px;
      overflow-y: auto;
      min-height: 0;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: #171717;
    }
    /* Full-width stacked cards, as the frame's "output-area" slots draw them:
       padding 20px, gap 10px, radius 6px, fill #FFFFFF, designed height 73px,
       text #171717 500 14px. A user turn uses the frame's muted token (#F7FAFC)
       as its card fill. */
    .turn {
      align-self: stretch;
      white-space: pre-wrap;
      word-break: break-word;
      line-height: 1.45;
      padding: 20px;
      min-height: 73px;
      border-radius: 6px;
      background: #ffffff;
    }
    .turn.user { background: #f7fafc; }
    .empty {
      opacity: 0.6;
      font-style: italic;
      padding: 12px;
    }
    .thinking {
      display: flex;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      opacity: 0.7;
      font-style: italic;
      padding: 12px 20px;
    }
    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #507274;
      border-top-color: transparent;
      border-radius: 50%;
      animation: chat-spin 0.8s linear infinite;
    }
    @keyframes chat-spin {
      to { transform: rotate(360deg); }
    }
    /* The conversation selector — BELOW the output, part of the binding. */
    .selector {
      position: relative;
      padding: 0 20px 12px;
    }
    .selector > button {
      width: 100%;
      min-height: 36px;
      padding: 6px 10px;
      border: 1px solid #8e98a8;
      border-radius: 6px;
      background: #fff;
      color: #10455f;
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .placeholder { opacity: 0.6; font-style: italic; }
    .menu {
      position: absolute;
      top: calc(100% - 8px);
      left: 20px;
      right: 20px;
      z-index: 20;
      margin: 0;
      padding: 4px;
      list-style: none;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.15);
      max-height: 220px;
      overflow-y: auto;
    }
    .menu button {
      display: block;
      width: 100%;
      padding: 7px 10px;
      border: none;
      background: none;
      font: inherit;
      font-size: 13px;
      text-align: left;
      color: #10455f;
      border-radius: 4px;
      cursor: pointer;
    }
    .menu button:hover { background: #f7fafc; }
  `;

  private _roleOf(m: ChatMessage): string {
    const raw = String(m.role ?? (m as { type?: string }).type ?? 'assistant');
    return raw === 'user' || raw === 'question' ? 'user' : 'assistant';
  }

  protected updated(): void {
    const thread = this.renderRoot?.querySelector('.thread');
    if (thread) thread.scrollTop = thread.scrollHeight;
  }

  private get _currentLabel(): string {
    const found = (this.conversations ?? []).find((c) => c?.id === this.conversationId);
    if (found?.title) return found.title;
    return this.conversationId ?? '';
  }

  private _toggleMenu() {
    this._menuOpen = !this._menuOpen;
  }

  private _pick(conversationId: string) {
    this._menuOpen = false;
    this.dispatchEvent(
      new CustomEvent('conversation-select', {
        bubbles: true,
        composed: true,
        detail: { conversationId },
      }),
    );
  }

  render() {
    const turns = this.messages ?? [];
    const label = this._currentLabel;
    return html`
      <div class="thread" role="log" aria-live="polite">
        ${turns.length
          ? turns.map(
              (m) => html`<div class="turn ${this._roleOf(m)}">${m.content ?? ''}</div>`,
            )
          : html`<div class="empty">No conversation yet for this package.</div>`}
        ${this.sending
          ? html`<div class="thinking"><span class="spinner" aria-hidden="true"></span> Thinking…</div>`
          : ''}
      </div>
      <div class="selector">
        <button type="button" title="Conversation" @click=${this._toggleMenu}>
          ${label ? html`<span>${label}</span>` : html`<span class="placeholder">Select a conversation…</span>`}
        </button>
        ${this._menuOpen
          ? html`
              <ul class="menu">
                ${(this.conversations ?? []).map(
                  (c) => html`
                    <li>
                      <button type="button" @click=${() => this._pick(String(c.id))}>
                        ${c.title || c.id || '(untitled)'}
                      </button>
                    </li>
                  `,
                )}
              </ul>
            `
          : nothing}
      </div>
    `;
  }
}

customElements.define('chat-messages', ChatMessages);

declare global {
  interface HTMLElementTagNameMap {
    'chat-messages': ChatMessages;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-messages': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatMessages> & {
          ref?: React.Ref<ChatMessages>;
        },
        ChatMessages
      >;
    }
  }
}
