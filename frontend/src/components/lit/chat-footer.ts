/**
 * <chat-footer> — the input stack's foot.
 *
 * v.4b source (file 20UPR2KQMsbAxlo5NJb1se): "chat-input-menu" #40001119:6470 —
 * row, align centre, gap 9, padding 10px 20px 5px, fill #0E325F, shadow
 * -4px 0px 4px rgba(0,0,0,0.25), height 71. It holds:
 *
 *   the four marks #40001119:6626 (:6622, :6483, :6486) — 32×32 each, 35 apart (the third
 *   was renamed "add-new-conversation" on 2026-09-19; same artwork, and it is the one the
 *   owner has wired),
 *   "user--feedback", "chat history", "add-new-conversation", "ml-model--reference";
 *   and the copyright #40001119:6605, right-aligned, white at 50% opacity, drawn
 *   in Inter Bold 700 / 16px. Its layer text is `{ts1}©{/ts1} {ts2}2026 Raibach
 *   IDS{/ts2}` — the braces are Figma text-style tokens that never resolved, not a
 *   second type style, so the line renders as "© 2026 Raibach IDS" in the node's
 *   own resolved style.
 *
 * THE FOUR MARKS ARE NOT WIRED: none of them carries an annotation, so there is no
 * event name to emit and none is invented (see the note above the row). The owner's
 * intent for them — a click opening that panel at the top of the output area — is
 * the interaction the annotation pass still has to specify; node for node:
 *   40001119:6626 · 40001119:6622 · 40001119:6483 · 40001119:6486
 *
 * THE READOUT LINE IS KEPT, NOT DRAWN BY THE DESIGN. The frame this element was
 * built from (40001066:4394 / #40001085:2697) put four token readouts on a #CFD7D5
 * bar; v.4b's bar draws marks and a copyright instead. The numbers stay on the bar
 * because a function does not leave with a drawing (owner, 2026-09-19: "none of our
 * current functions should disappear just because we're updating a design or
 * changing a node") — the row takes the bar's own text treatment (white, 50%, the
 * one the copyright uses) so it reads as belonging to the navy bar rather than to
 * the bar it replaced.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';
import feedbackIcon from '@/assets/figma-chat-footer-feedback.svg';
import historyIcon from '@/assets/figma-chat-history-icon.svg';
import newConversationIcon from '@/assets/figma-add-new-conversation-icon.svg';
import modelRefIcon from '@/assets/figma-ml-model-reference-icon.svg';

/** The four marks, in the drawing's order, each with the node it is drawn from. */
const MARKS = [
  { nodeId: '40001119:6626', src: feedbackIcon, label: 'user feedback' },
  { nodeId: '40001119:6622', src: historyIcon, label: 'chat history' },
  {
    nodeId: '40001119:6483',
    src: newConversationIcon,
    label: 'new conversation',
    /**
     * THE ONE WIRED MARK. The owner, 2026-09-19: "this is the icon I want you to make it
     * work at the bottom so that I can create a new conversation and archive the one that's
     * there." It emits the event; the seat that owns the conversation does the three
     * writes (title, archive, create) — this element composes nothing and reaches nothing.
     *
     * The NAME is the one thing here that has no annotation behind it: the note that will
     * name this event is still to be written in Figma, so this is the name this repository
     * proposed for it ("conversation-new { tab }", beside the existing
     * "conversation-select { conversationId }"). When the note lands, the name follows it.
     */
    event: 'conversation-new',
  },
  { nodeId: '40001119:6486', src: modelRefIcon, label: 'model reference' },
];

export class ChatFooter extends LitElement {
  static properties = {
    /** True when the seat has no bound conversation: show "unattributed", never
        another scope's numbers. Not drawn in v.4b — see the header note. */
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
    /* Figma "chat-input-menu" #40001119:6470, verbatim: height 71, padding
       10px 20px 5px, fill #0E325F, shadow -4px 0px 4px rgba(0,0,0,0.25). */
    .footer {
      display: flex;
      align-items: center;
      gap: 9px;
      height: 71px;
      padding: 10px 20px 5px;
      background: #0E325F;
      box-shadow: -4px 0 4px 0 rgba(0, 0, 0, 0.25);
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
    }
    /* The marks sit 35 apart (#40001119:6472). */
    .marks {
      display: flex;
      align-items: center;
      gap: 35px;
    }
    /* A mark is a control in the drawing, so it is a button — and it does nothing
       until the annotation says what it does. No border, no fill: the design draws
       the artwork alone on the navy. */
    .mark {
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      background: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: inherit;
    }
    .mark img {
      display: block;
      width: 32px;
      height: 32px;
      pointer-events: none;
    }
    /* The copyright — #40001119:6605: fill #FFFFFF at 50%, Inter Bold 700 / 16px,
       right-aligned, in a 127-wide box at the end of the row. */
    .copy {
      width: 127px;
      text-align: right;
      color: #FFFFFF;
      opacity: 0.5;
      font-size: 16px;
      font-weight: 700;
      white-space: nowrap;
    }
    /* THE READOUT LINE — the older frame's four numbers, kept (see the header note).
       One line, ellipsised rather than wrapped, so the bar stays 71px tall; it takes
       the bar's text treatment rather than the #CFD7D5 bar it was drawn on. */
    .readouts {
      margin-left: auto;
      min-width: 0;
      color: #FFFFFF;
      opacity: 0.5;
      font-size: 13px;
      font-weight: 500;
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
    return html`
      <div class="footer" data-node-id="40001119:6470">
        <!-- THE MARK THAT ACTS IS THE ONE WITH AN EVENT ON IT (see MARKS). The three
             without one carry no handler and no event: the design draws them and nothing
             says what they do yet. -->
        <div class="marks">
          ${MARKS.map(
            (m) => html`
              <button
                class="mark"
                type="button"
                data-node-id=${m.nodeId}
                aria-label=${m.label}
                title=${m.label}
                @click=${() => {
                  if (m.event) this.dispatchEvent(new CustomEvent(m.event, { bubbles: true, composed: true }));
                }}
              >
                <img src=${m.src} alt="" />
              </button>
            `,
          )}
        </div>
        <span class="readouts">${this._line}</span>
        <span class="copy" data-node-id="40001119:6605">© 2026 Raibach IDS</span>
      </div>
    `;
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
