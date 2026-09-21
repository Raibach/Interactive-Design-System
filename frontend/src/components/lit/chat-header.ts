/**
 * <chat-header> — the output area's bar, and the same shell as its response card.
 *
 * v.4b source (file 20UPR2KQMsbAxlo5NJb1se, the drawing this column follows now):
 *
 *   the BAR   "chat-output-header" #40001119:6309 (:6318, :6579 are the same frame
 *             drawn again with different copy — the wireframe shows the bar three
 *             times): padding 7px 10px, radius 8, fill rgba(117,142,135,0.35), a 1px
 *             stroke rgba(117,142,135,0.5), shadows inset 0 -2px 5px
 *             rgba(0,0,0,0.15) and inset 0 2px 4px rgba(0,0,0,0.25), text #3D515B
 *             Arial Rounded MT Bold 400 / 13px / 20px.
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
// The readout's model mark — the drawing's "ml-model--reference 1" #40001123:6751,
// 26x26 in #507274, at the card's trailing edge.
import modelMark from '@/assets/figma-readout-model-mark.svg';

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
    /* THE USAGE FIGURES — declared, or the renderer DROPS them. assignProps skips an
       undeclared property with a console warning only, so a bound value would arrive at
       nothing and the readout would show a zero nobody sent (prop-undeclared). */
    /* THE MARK THE CARD CARRIES AT ITS TRAILING EDGE. The readout card draws the model
       mark; the conversations card draws the history artwork; each window draws what the
       drawing draws in that window's card. The host hands the artwork in, so this element
       holds no catalogue of its own. */
    icon: { type: String },
    iconNode: { type: String, attribute: 'icon-node' },
    /* THE GRIP BELONGS TO THE BAR THIS INSTANCE DRAWS. The drawing repeats the bar in
       every window and each copy carries its OWN node ids (the readout's gripper is
       40001123:6773; the conversations bar's is 40001126:2014) — so the ids are handed
       in, exactly as the icon's are, and an instance that hands in none keeps the
       readout bar's own. */
    /* THE BAR'S OWN THREE LAYERS, per instance: the block it sits in, the bar itself and
       the line it writes. The drawing repeats this bar in every window and each copy
       carries its own ids (readout 40001119:6308/6309/40001123:6750; conversations
       40001119:6317/6318/40001123:6744; approvals 40001123:6978/6979) — handed in, as the
       icon and the grip are, so a deleted layer can never leave the app pointing at it. */
    blockNode: { type: String, attribute: 'block-node' },
    /* THE WINDOW'S OWN SHAPE. The drawing draws the approvals window taller than the bars
       above it: its block takes gap 7 and 4 under, and its bar pads 10px 2px 10px 10px
       where the bars pad 7px 10px (40001123:6978 / :6979 against 40001119:6308 / :6309).
       One instance passes `variant="tall"`; nothing else changes. */
    variant: { type: String },
    barNode: { type: String, attribute: 'bar-node' },
    textNode: { type: String, attribute: 'text-node' },
    gripNode: { type: String, attribute: 'grip-node' },
    gripRowNode: { type: String, attribute: 'grip-row-node' },
    gripDots: { type: String, attribute: 'grip-dots' },
    /* THE MARK'S SIZE IS THE CARD'S OWN. The readout card draws 26; the conversations
       card draws 22. One size for every card was my guess and the drawing does not have
       one size — read per card, never assumed. */
    iconSize: { type: Number, attribute: 'icon-size' },
    /* THE CARD'S TEXT FAMILY. The readout card's line is Arial Rounded; the conversations
       card's line is DM Sans 600. Two cards, two families. */
    dmSans: { type: Boolean, attribute: 'dm-sans' },
    tokens: { type: Number },
    inTokens: { type: Number, attribute: 'in-tokens' },
    outTokens: { type: Number, attribute: 'out-tokens' },
    calls: { type: Number },
    lastCall: { type: String, attribute: 'last-call' },
    unattributed: { type: Boolean },
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

  declare tokens: number;
  declare inTokens: number;
  declare outTokens: number;
  declare calls: number;
  declare lastCall: string;
  declare unattributed: boolean;
  declare icon: string;
  declare iconNode: string;
  declare blockNode: string;
  declare variant: string;
  declare barNode: string;
  declare textNode: string;
  declare gripNode: string;
  declare gripRowNode: string;
  declare gripDots: string;
  declare iconSize: number;
  declare dmSans: boolean;
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
      /* Figma "output-header-area": gap 5, padding 20/20/6/0 — and every block under the
         leading one takes 6 at the top against the leader's 20. */
      gap: 5px;
      padding: 6px 20px 0;
      /* THE LEADING BLOCK IS DEEPER AT THE TOP. The drawing's FIRST block is
         "output-header-area" #40001119:6308 — padding 20px 20px 2px — while every later one
         carries the template's 10px 20px 2px (EL-ea5b699e). The panel marks whichever block is
         actually first (chat-panel's first-child rule), so the 20 lands on the top
         block even when the status bar is not drawn and the one below it leads instead — the
         owner, 2026-09-19: "the top one, the top padding is off… it's very tight and close to
         the top." */
      padding-top: 6px;
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
      /* THE 1px EDGE IS INSIDE THE HEIGHT. Without border-box the stroke adds 2px to a card
         that the drawing measures at 36, and the whole block grows with it (38 against 36,
         61 against 54, measured in the browser). */
      box-sizing: border-box;
      background: rgba(117, 142, 135, 0.35);
      /* The drawing strokes all four edges at 1px (#40001119:6318 stroke rgba(117,142,135,0.5)
         w=1); the code drew the bottom edge alone. */
      border: 1px solid rgba(117, 142, 135, 0.5);
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
      /* #40001123:6750 — Arial Rounded 400 at 14px in #3D515B. The code carried 13px at
         weight 500 in #485954. */
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 400;
      line-height: normal;
      color: #3D515B;
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
      /* The card's body takes the drawing's own treatment for the text it holds — the
         user-response-bubble line, #40001123:6984: Arial Rounded 400 at 13/20 in #3D515B.
         The code carried weight 500 and #171717, neither of which is in the file. */
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 400;
      line-height: 20px;
      color: #3D515B;
    }
    /* The grip row — #40001123:6773, the readout band's own gripper: 500x7, padding
       10px 0 10px 0, itemSpacing 10, primary CENTER, counter CENTER, holding the
       480-wide Meatballs row #40001123:6774 (padding 1px 2px, itemSpacing 4, primary
       CENTER, counter CENTER, FILL + grow 1 → flex 1 1 auto).
       READ FROM THE FILE, NOT FROM THE OLD COMMENT: the dots are CENTRED — the file's
       own coordinates put the row at x=-8828 (width 480, centre -8588) and the five
       ellipses centred on that same -8588. The previous drawing said "at the start";
       the value check said flex-start against the file's CENTER, so the alignment and
       the dot spacing below are the file's, and the artwork is the tray's own spans
       (2.16x2.05, 2px stroke, gap 4) instead of an SVG whose ellipses sat 4 apart
       CENTRE TO CENTRE — which is not a gap of 4 between 2.16-wide dots. */
    .grip {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 7px;
      padding: 0 10px;
    }
    /* The dot row is 480 wide in the drawing (#40001123:6774, padding 1px 2px) with the
       dots centred in it and 4 between them. */
    .grip .row {
      flex: 1 1 auto;
      padding: 1px 2px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      box-sizing: border-box;
    }
    .dot {
      display: block;
      width: 2.16px;
      height: 2.05px;
      border: 2px solid rgba(147, 58, 69, 0.5);
      border-radius: 50%;
      box-sizing: border-box;
    }
    /* THE CARD IS A ROW: the readout grows and takes the room, the model mark keeps its
       26 and sits at the trailing edge (#40001123:6751). */
    .status {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    /* #40001119:6308 — THE LEADING BLOCK IS DEEPER AT THE TOP: 16 in the drawing where
       every later block takes 6. Read from the file's own node, on the instance that leads
       (the panel marks it variant="lead"), so the value is compared rather than sitting in
       a custom property the reader cannot resolve. */
    .output-area.lead { padding-top: 16px; }
    /* #40001123:6978 / :6979 — THE APPROVALS WINDOW'S OWN NUMBERS, READ FROM THE FILE.
       The designer moved both heights: the block is 142 where it was 150, and the bar it
       holds is 118 where it was 126. Declared here rather than left to follow from content,
       so the two values are COMPARED on every run instead of sitting undeclared — the same
       move as .output-area.lead's 16px top padding, and it is what "carry them into the
       source" asks for. The block is border-box so its 142 is the frame the drawing
       measures, not 142 plus its own padding. */
    .output-area.tall { gap: 7px; padding-bottom: 4px; height: 142px; box-sizing: border-box; }
    .status.tall { padding: 10px 10px 10px 2px; height: 118px; }
    /* #40001123:6750 — THE READOUT LINE IS 12px. The designer took it down from 14 and the
       declaration had kept the bar's 14, so the readout drew a size the frame does not have.
       Stated on the readout's own element rather than on .status, because the conversations
       line shares .status and keeps 14. */
    .readout { flex: 1 1 auto; min-width: 0; font-size: 12px; }
    /* #40001123:6744 — the conversations line is DM Sans 600 at 14/22, not the rounded face
       the other cards use. Its 14 is declared here so the readout's 12 does not take it. */
    .readout.dm {
      font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
      font-weight: 600;
      font-size: 14px;
    }
    .model-mark {
      display: block;
      width: 26px;
      height: 26px;
      flex: 0 0 auto;
    }
  `;

  /** The frame's slot line — #40001123:6750: "Analyzing: Session 222 | supportCustomerSession
   *  Duration: 28.495s | Closed QA: 89.38%". Pipes between the readouts; the state leads. */
  private get _statusLine(): string {
    /*
     * THE READOUT IS ALWAYS WRITTEN. This panel is the system talking to the user — a
     * state, a technical issue, a usage figure — and a readout with nothing in it is a
     * space that does not work. The owner, 2026-09-20: "put that dummy text in there and
     * then put your token feed at the end of it... make that space work."
     *
     * So there is always a line. The live parts come first when the seat has them; the
     * drawing's own copy is the sample that stands in when it does not — it is the frame's
     * text (#40001123:6750), not an invention. The usage joins the same line under the same
     * pipes, taken from the attributes the host already assigns, so a number that is not
     * known reads as a figure rather than as an empty gap.
     */
    const SAMPLE = 'Analyzing: Session 222 | supportCustomerSession Duration: 28.495s | Closed QA: 89.38%';
    const parts: string[] = [];
    if (this.statusText) {
      parts.push(this.statusText);
    } else {
      /* THE FRAME'S OWN LINE, BUILT FROM THE LIVE SLOTS. All five slot properties exist and
         the panel hands every one of them in, but only the label and the name were ever
         printed — so a seat with a live duration and QA score drew a line the frame does not
         have, and the two figures were dropped on the floor. Built here in the frame's own
         order and with the frame's own punctuation: the state leads, a pipe, then the name
         and its duration, a pipe, then the QA readout. No em-dash: the frame has none. */
      const lead = [this.status ? `${this.status}:` : '', this.sessionLabel ?? ''].join(' ').trim();
      const named = [this.sessionName ?? '', this.duration ? `Duration: ${this.duration}` : ''].join(' ').trim();
      if (lead) parts.push(lead);
      if (named) parts.push(named);
      if (this.qaScore) parts.push(`Closed QA: ${this.qaScore}`);
      if (!parts.length) parts.push(SAMPLE);
    }
    // THE USAGE BELONGS TO ONE PANEL, NOT TO EVERY BAR. The host hands the figures to the
    // readout alone (the leading panel), so their presence is what says "this is the
    // readout" — a bar the host gave no figure to is a bar, and nothing joins its text.
    if (this.hasAttribute('tokens')) {
      const attr = (n: string, fallback: string) => {
        const v = (this.getAttribute(n) ?? '').trim();
        return v === '' ? fallback : Number(v).toLocaleString();
      };
      const unattributed = this.hasAttribute('unattributed');
      parts.push(`Tokens: ${unattributed ? 'unattributed' : attr('tokens', '0')}`);
      const calls = attr('calls', '');
      if (calls) parts.push(`Calls: ${unattributed ? 'unattributed' : calls}`);
    }
    return parts.join('  |  ');
  }

  /** The dots of this instance: the ids it was handed, or the readout bar's own five. */
  private get _dots(): string[] {
    const handed = (this.gripDots || '').split(',').map((s) => s.trim()).filter(Boolean);
    return handed.length ? handed : ['40001123:6775', '40001123:6776', '40001123:6777', '40001123:6778', '40001123:6779'];
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

    // THE READOUT PANEL ALWAYS DRAWS. It used to paint nothing when it had nothing to
    // say — "no copy, no ground" — but the owner's ruling on this panel is the opposite
    // (2026-09-20): "This is the first panel, it always loads by default. It is the
    // readout. It is the way that the system communicates to the user... It always stays
    // at the top, it can be removed." A panel that is always there cannot be conditional
    // on its own content, and a drawing that is not on screen does not exist.

    return html`
      <div class="output-area ${this.variant === 'lead' ? 'lead' : ''} ${this.variant === 'tall' ? 'tall' : ''}" data-node-id=${this.blockNode || nothing}>
        <div class="status shell ${this.variant === 'tall' ? 'tall' : ''}" data-node-id=${this.barNode || nothing} role="status">
          <span class="readout ${this.dmSans ? 'dm' : ''}" data-node-id=${this.textNode || nothing}>${line}</span>
          ${this.icon
            ? html`<img class="model-mark" style=${`width: ${this.iconSize || 22}px; height: ${this.iconSize || 22}px`} data-node-id=${this.iconNode || ''} src=${this.icon} alt="" />`
            : this.hasAttribute('tokens')
              ? html`<img class="model-mark" style=${`width: ${this.iconSize || 22}px; height: ${this.iconSize || 22}px`} data-node-id=${this.iconNode || nothing} src=${modelMark} alt="" />`
              : nothing}
        </div>
        <div class="body"><slot></slot></div>
        <div class="grip" data-node-id=${this.gripNode || '40001123:6773'} aria-hidden="true">
          <div class="row" data-node-id=${this.gripRowNode || '40001123:6774'}>
            ${this._dots.map((id) => html`<span class="dot" data-node-id=${id}></span>`)}
          </div>
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
