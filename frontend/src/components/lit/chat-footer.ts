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
      /* THE MASTER'S OWN NUMBERS: chat-footer-area #40001085:2697, instance
         #40001085:2698 — 540x70, padding 20, gap 10, fill #CFD7D5, radius 6, the button
         drop (4 4 10 / -4 -4 10 at 15%), one text line: Inter Medium 14, #171717.

         The padding is 20 and the bar lands on 70 because there is ONE line: 20 + a
         14px line's box (30) + 20 = 70. It was 8px while four readouts wrapped into two
         rows — the padding was bending to content that was not the design's, and the
         owner's note that the footer was "a little off" was that arithmetic showing.
         min-height, not height: a long readout grows the bar rather than being clipped. */
      padding: 20px;
      min-height: 70px;
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
    /* THE LINE. One, filling the box's width, ellipsised rather than wrapped — the
       master draws a single text layer with horizontal fill, and a footer that grows to
       two lines stops being 70px tall. */
    .line {
      width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  private _fmt(n: number): string {
    return Number.isFinite(n) ? n.toLocaleString() : '—';
  }

  private _value(v: string): string {
    return this.unattributed ? 'unattributed' : v;
  }

  /**
   * ONE LINE, AS THE MASTER DRAWS IT. The readouts that are known, in the order they
   * matter while work is happening: the token count first (the field the master's own
   * placeholder text names), then the split, then the call count and its timing when
   * there are any. A number nobody can stand behind still says so, through the seat's own
   * unattributed rule — an invented figure in a token readout is worse than a dash.
   */
  private get _line(): string {
    const parts: string[] = [`Tokens: ${this._value(this._fmt(this.tokens))}`];
    if (this.inTokens || this.outTokens) {
      parts.push(`In / Out: ${this._value(`${this._fmt(this.inTokens)} / ${this._fmt(this.outTokens)}`)}`);
    }
    if (this.calls) parts.push(`Calls: ${this._value(this._fmt(this.calls))}`);
    if (this.lastCall) parts.push(`Last Call: ${this._value(this.lastCall)}`);
    return parts.join('  ·  ');
  }

  render() {
    return html`<div class="footer"><div class="line">${this._line}</div></div>`;
  }
}

if (!customElements.get('chat-footer')) customElements.define('chat-footer', ChatFooter);

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
