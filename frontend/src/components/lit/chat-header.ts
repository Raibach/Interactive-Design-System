/**
 * <chat-header> — the output area's bar, and the same shell as its response card.
 *
 * v.4b source (file 20UPR2KQMsbAxlo5NJb1se, the drawing this column follows now):
 *
 *   the BAR   "chat-output-header" #40001119:6309 (:6318, :6579 are the same frame
 *             drawn again with different copy — the wireframe shows the bar three
 *             times): padding 7px 10px, radius 8, fill rgba(117,142,135,0.35), a 1px
 *             BOTTOM stroke rgba(117,142,135,0.5), shadows inset 0 -2px 5px
 *             rgba(0,0,0,0.15) and inset 0 2px 4px rgba(0,0,0,0.25), text #485954
 *             Inter 500 / 13px / 22px.
 *   the CARD  "chat-output-header" #40001119:6327: the same shell, padding 10px,
 *             column, gap 10, holding the response itself.
 *
 * Each shape sits in its own "output-header-area" — a #CBE6E3 ground, padding
 * 10px 20px 2px, column, gap 7 (#40001119:6308; the card's block is :6326 with 4px
 * under instead of 2px) — and a BAR block carries a Meatballs row under it: the
 * four-dot grip #40001119:6385 (dots 2.16×2.05, stroke rgba(147,58,69,0.5) at 2px,
 * 4px apart), which is the handle a person will use to take the block away. This
 * element draws it; it is not wired to anything yet — the drawing has no annotation
 * for it, and the row is what remains to be made interactive.
 *
 * THE STATUS LINE IS FOUR SLOTS, not one string. The frame's sample:
 *
 *   "Analyzing: Session 222 | supportCustomerSession — Duration: 28.495s | Closed QA: 89.38%"
 *
 * maps to status / sessionLabel / sessionName / duration / qaScore, joined with
 * the frame's own separators (pipes, em-dash before Duration). `statusText`
 * remains as the flat fallback for hosts that format the line themselves — which
 * is also how the other two bars in the drawing are drawn ("23 Conversations",
 * "23 Ready for approval" are the same bar with copy the host supplies).
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css, nothing } from 'lit';

export class ChatHeader extends LitElement {
  static properties = {
    /** Flat fallback line. Set this OR the slots below, not both. */
    statusText: { type: String, attribute: 'status-text' },
    /** Slot 1: the state word, e.g. "Analyzing". */
    status: { type: String, attribute: 'status' },
    /** Slot 1: the session identifier, e.g. "Session 222". */
    sessionLabel: { type: String, attribute: 'session-label' },
    /** Slot 2: the session name, e.g. "supportCustomerSession". */
    sessionName: { type: String, attribute: 'session-name' },
    /** Slot 3: the duration readout, e.g. "28.495s". */
    duration: { type: String, attribute: 'duration' },
    /** Slot 4: the QA readout, e.g. "89.38%". */
    qaScore: { type: String, attribute: 'qa-score' },
    /**
     * The CARD shape — #40001119:6327 — instead of the bar: same shell, more
     * padding, and a slot for what the block holds. The grip row belongs to the
     * bars only; the drawing's card block has none.
     */
    card: { type: Boolean },
  };

  declare statusText: string;
  declare status: string;
  declare sessionLabel: string;
  declare sessionName: string;
  declare duration: string;
  declare qaScore: string;
  declare card: boolean;

  constructor() {
    super();
    this.statusText = '';
    this.status = '';
    this.sessionLabel = '';
    this.sessionName = '';
    this.duration = '';
    this.qaScore = '';
    this.card = false;
  }

  static styles = css`
    :host { display: block; }
    /* THE BLOCK'S GROUND — "output-header-area" #40001119:6308: #CBE6E3, padding
       10px 20px 2px, column, gap 7. This is new in v.4b; the older node this
       element was drawn from (40001085:1553) was a white strip with a #999 rule,
       and it was drawn transparent so the column showed through. The v.4b drawing
       paints the block, so the block is painted — the value is the node's. */
    .output-area {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 7px;
      padding: 10px 20px 2px;
      /* THE LEADING BLOCK IS DEEPER AT THE TOP. The drawing's FIRST block is
         "output-header-area" #40001119:6308 — padding 20px 20px 2px — while every later one
         carries the template's 10px 20px 2px (EL-ea5b699e). The panel marks whichever block is
         actually first (chat-panel's first-child rule), so the 20 lands on the top
         block even when the status bar is not drawn and the one below it leads instead — the
         owner, 2026-09-19: "the top one, the top padding is off… it's very tight and close to
         the top." */
      padding-top: var(--block-pad-top, 10px);
      background: #CBE6E3;
    }
    /* The card's block, #40001119:6326 — the same ground with 4px under it. */
    .output-area.card-block { padding-bottom: 4px; }
    /* THE CARD FILLS ITS BLOCK, AND THE BLOCK FILLS THE ELEMENT.
       The panel hands this element the region's leftover height (chat-panel's
       chat-header[card] rule: flex 1 0 auto), and until this rule the element was that
       tall while the ground and the card inside it stayed the height of their CONTENT —
       the region drew a small green card at the top of a white void instead of a card
       that fills it (owner, 2026-09-19: "they're not flexing vertically… seems to be
       hugging, should be expanding"). The percentage resolves because a flex item's
       height is definite; the BARS are untouched by it, since their host is
       content-sized and 100% of an auto height is auto. */
    .output-area.card-block {
      height: 100%;
      box-sizing: border-box;
    }
    /* The shell both shapes share. Only the padding, the flow direction and the
       content differ between them, so the fill, the stroke, the radii and the two
       inset shadows are written once, here. */
    .shell {
      background: rgba(117, 142, 135, 0.35);
      border-bottom: 1px solid rgba(117, 142, 135, 0.5);
      border-radius: 8px;
      box-shadow:
        inset 0 -2px 5px 0 rgba(0, 0, 0, 0.15),
        inset 0 2px 4px 0 rgba(0, 0, 0, 0.25);
    }
    .status {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 22px;
      color: #485954;
    }
    .card {
      display: flex;
      flex-direction: column;
      /* It fills the ground it sits in (see .output-area.card-block above) so the card
         reaches the bottom of the region instead of stopping at its last line. */
      flex: 1 1 auto;
      min-height: 0;
      gap: 10px;
      padding: 10px;
      /* THE CARD IS THE SCROLLBAR'S HOME. The panel slots the drawn rail in here beside
         the scroller, as an absolutely positioned child: this box is what it measures
         itself against, so the thumb holds the card's right edge while the conversation
         travels under it. Out-of-flow, so it never becomes a column item. */
      position: relative;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      color: #171717;
    }
    /* The grip row — #40001119:6384, a 7px band whose dots are drawn at the node's
       own size and stroke. A drawing until the design says what the gesture is. */
    .grip {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 7px;
      padding: 0 10px;
    }
    .grip svg { display: block; }
  `;

  /** The frame's slot line: pipes between readouts, an em-dash before Duration. */
  private get _statusLine(): string {
    if (this.statusText) return this.statusText;
    const parts: string[] = [];
    if (this.status || this.sessionLabel) {
      parts.push(`${this.status ? `${this.status}: ` : ''}${this.sessionLabel}`);
    }
    if (this.sessionName) parts.push(this.sessionName);
    if (this.duration) parts.push(`Duration: ${this.duration}`);
    if (this.qaScore) parts.push(`Closed QA: ${this.qaScore}`);
    if (!parts.length) return '';
    return parts.map((p, i) => (i === 0 ? p : i === 2 ? ` — ${p}` : ` | ${p}`)).join('');
  }

  render() {
    const line = this._statusLine;

    if (this.card) {
      return html`
        <div class="output-area card-block">
          <div class="card shell">
            <slot></slot>
          </div>
        </div>
      `;
    }

    // A bar with nothing to say paints nothing at all — no copy, no ground. The
    // grip is part of the bar's block, so it goes with it.
    if (!line) return nothing;

    return html`
      <div class="output-area">
        <div class="status shell" role="status">${line}</div>
        <div class="body"><slot></slot></div>
        <div class="grip" data-node-id="40001119:6384" aria-hidden="true">
          <!-- Figma "Meatballs" #40001119:6385, verbatim: four dots, 2.16×2.05 with
               a 2px stroke, 4px apart, in rgba(147,58,69,0.5). -->
          <svg width="16" height="6" viewBox="0 0 16 6" fill="none">
            <ellipse cx="2.08" cy="3" rx="1.08108" ry="1.02564" stroke="rgba(147,58,69,0.5)" stroke-width="2"/>
            <ellipse cx="6.08" cy="3" rx="1.08108" ry="1.02564" stroke="rgba(147,58,69,0.5)" stroke-width="2"/>
            <ellipse cx="10.08" cy="3" rx="1.08108" ry="1.02564" stroke="rgba(147,58,69,0.5)" stroke-width="2"/>
            <ellipse cx="14.08" cy="3" rx="1.08108" ry="1.02564" stroke="rgba(147,58,69,0.5)" stroke-width="2"/>
          </svg>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('chat-header')) customElements.define('chat-header', ChatHeader);

declare global {
  interface HTMLElementTagNameMap {
    'chat-header': ChatHeader;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-header': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatHeader> & {
          'status-text'?: string;
          'status'?: string;
          'session-label'?: string;
          'session-name'?: string;
          'duration'?: string;
          'qa-score'?: string;
          card?: '' | boolean;
          ref?: React.Ref<ChatHeader>;
        },
        ChatHeader
      >;
    }
  }
}
