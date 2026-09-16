/**
 * <chat-footer> — the frame's "chat-footer-area" (node 40001066:4394).
 *
 * Figma source: column, stretch, padding 20px, gap 10px, HUG height
 * (contextual), fill #CFD7D5, "button drop" shadow, radius 6px, text
 * Inter Medium 500 / 14px / #171717.
 *
 * Content: the four state readouts, ON A ROW — Total Tokens, In / Out,
 * Calls, Last Call. A value with nothing real behind it shows '—'.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';

export class ChatFooter extends LitElement {
  static properties = {
    /** True when the seat has no bound conversation: show "unattributed", never
        another scope's numbers. */
    unattributed: { type: Boolean },
    tokens: { type: Number },
    inTokens: { type: Number, attribute: 'in-tokens' },
    outTokens: { type: Number, attribute: 'out-tokens' },
    calls: { type: Number },
    lastCall: { type: String, attribute: 'last-call' },
  };

  declare unattributed: boolean;
  declare tokens: number;
  declare inTokens: number;
  declare outTokens: number;
  declare calls: number;
  declare lastCall: string;

  constructor() {
    super();
    this.unattributed = false;
    this.tokens = 0;
    this.inTokens = 0;
    this.outTokens = 0;
    this.calls = 0;
    this.lastCall = '';
  }

  static styles = css`
    :host { display: block; }
    .footer {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 20px;
      min-height: 102px;
      background: #cfd7d5;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.15), -4px -4px 10px rgba(0, 0, 0, 0.15);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: 22px;
      color: #171717;
      box-sizing: border-box;
    }
    .row {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .stat {
      display: flex;
      flex-direction: row;
      gap: 6px;
    }
  `;

  private _fmt(n: number): string {
    return Number.isFinite(n) ? n.toLocaleString() : '—';
  }

  private _value(v: string): string {
    return this.unattributed ? 'unattributed' : v;
  }

  render() {
    return html`
      <div class="footer">
        <div class="row">
          <div class="stat"><span>Total Tokens</span><span>${this._value(this._fmt(this.tokens))}</span></div>
          <div class="stat"><span>In / Out</span><span>${this._value(`${this._fmt(this.inTokens)} / ${this._fmt(this.outTokens)}`)}</span></div>
          <div class="stat"><span>Calls</span><span>${this._value(this._fmt(this.calls))}</span></div>
          <div class="stat"><span>Last Call</span><span>${this._value(this.lastCall || '—')}</span></div>
        </div>
      </div>
    `;
  }
}

customElements.define('chat-footer', ChatFooter);

declare global {
  interface HTMLElementTagNameMap {
    'chat-footer': ChatFooter;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-footer': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatFooter> & {
          tokens?: number;
          'in-tokens'?: number;
          'out-tokens'?: number;
          calls?: number;
          'last-call'?: string;
          ref?: React.Ref<ChatFooter>;
        },
        ChatFooter
      >;
    }
  }
}
