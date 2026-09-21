/**
 * <chat-plugin-tray> — the tray at the foot of the chat column.
 *
 * v.4b source (file 20UPR2KQMsbAxlo5NJb1se): "output-header-area" #40001123:6689 —
 * column, padding 10px 20px 20px, gap 7, fill #CBE6E3, width 540. It holds:
 *
 *   the gripper #40001123:6692 — 500×7, 10 from each side. Its "Meatballs" are four
 *   2.16×2.05 ellipses, 2px stroke rgba(147,58,69,0.5), 4 apart. The owner's note on
 *   the block is the mechanism: "This gripper pulls this window and everything above it
 *   up and expands the section below it."
 *
 *   the card #40001123:6690 — 500×53, radius 8, fill rgba(117,142,135,0.35), 1px stroke
 *   rgba(117,142,135,0.5), padding 7px 14px, gap 10. Inside it: the label "Active
 *   Plugins" (#40001123:6832) then FIVE marks 32×32, 20 apart (#40001124:7035,
 *   #40001124:7032, #40001123:6728, #40001123:6732, #40001123:6724), and the credit
 *   (#40001123:6740) at the end of the row.
 *
 * THE ONE DIMMED MARK IS THE WHOLE STATE SYSTEM. "chat history" (#40001123:6728) is
 * drawn at opacity 0.5 while the marks beside it are solid. The owner, 2026-09-20:
 * "the chat conversations history is kind of deactivated in that bottom panel ... the
 * reason it's deactivated is because the conversations are being displayed at the top.
 * So this is a user's choice — if you click on that again it will remove those from the
 * top." So DIMMED MEANS ITS WINDOW IS ALREADY PLACED, and a mark is a toggle. That is
 * a STATE, not a disabled condition — which is why the mark stays clickable.
 *
 * THE MARKS EMIT NOTHING YET, DELIBERATELY, ON THE FOOTER'S OWN PRECEDENT. The toggle
 * needs an event name, the name belongs in the annotation, and none of these nodes
 * carries one — so drawing a name here would be inventing the thing the annotation rule
 * exists to stop (see <chat-footer>, which refuses the same way for the same reason).
 * The exception is the mark the project has already named: "add-new-conversation"
 * emits `conversation-new`, which the seat hears and turns into the three writes.
 *
 * TYPE: the drawing sets the label in Arial Rounded MT Bold 400 / 12px and the credit in
 * Inter 700 / 9px. Both are below the owner's floor and the label is not Inter, so both
 * take the house treatment — Inter, 700, 13px — and this comment is the record of the
 * deviation rather than a silent retune.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';
// THE DRAWING'S OWN ARTWORK, pulled from the tray's mark nodes — not the old footer's
// assets. The footer's five were drawn for the navy bar and carry that bar's colours;
// these carry the design's, so the fill is the file's and not a tint applied here.
import forumIcon from '@/assets/figma-tray-forum.svg';
import modelRefIcon from '@/assets/figma-tray-model.svg';
import historyIcon from '@/assets/figma-tray-history.svg';
import newConversationIcon from '@/assets/figma-tray-new-conversation.svg';
import feedbackIcon from '@/assets/figma-tray-feedback.svg';

/**
 * The five marks in the drawing's order, each with its node.
 *
 * `placed` is the drawing's own state: the history mark is the one the design shows
 * dimmed, because the conversations window is up. A host sets it from what its stack
 * actually holds — this element composes nothing and reaches nothing.
 */
const MARKS = [
  { nodeId: '40001124:7035', src: forumIcon, label: 'forum' },
  { nodeId: '40001124:7032', src: modelRefIcon, label: 'model reference' },
  {
    nodeId: '40001123:6728',
    src: historyIcon,
    label: 'chat history',
    placed: true,
    /* THE FOOTER COPY OF THE HISTORY MARK TOGGLES THE CONVERSATIONS WINDOW. The copy
       drawn inside that window (same artwork, same layer name) removes the window; this
       copy adds the window and removes the window. The annotation on each copy carries
       the behaviour; the name is shared because the artwork is shared. */
    event: 'toggle-output-window',
    detail: { window: 'conversations' },
  },
  { nodeId: '40001123:6732', src: newConversationIcon, label: 'new conversation', event: 'conversation-new' },
  { nodeId: '40001123:6724', src: feedbackIcon, label: 'user feedback' },
];

export class ChatPluginTray extends LitElement {
  static properties = {
    /** The label the block carries in the drawing. */
    label: { type: String },
    /** Mark labels the host's stack currently holds, comma-separated. */
    placed: { type: String },
    /* THE TOKEN READOUTS — kept, not drawn by this frame (see the header note). They
       arrive from the seat exactly as <chat-footer> took them, because the function is
       the seat's and only the bar it sits on has changed. */
    unattributed: { type: Boolean },
    tokens: { type: Number },
    inTokens: { type: Number, attribute: 'in-tokens' },
    outTokens: { type: Number, attribute: 'out-tokens' },
    calls: { type: Number },
    lastCall: { type: String, attribute: 'last-call' },
  };

  declare label: string;
  declare placed: string;
  declare unattributed: boolean;
  declare tokens: number;
  declare inTokens: number;
  declare outTokens: number;
  declare calls: number;
  declare lastCall: string;

  constructor() {
    super();
    this.label = 'Active Plugins';
    this.placed = '';
    this.unattributed = false;
    this.tokens = 0;
    this.inTokens = 0;
    this.outTokens = 0;
    this.calls = 0;
    this.lastCall = '';
  }

  /** A mark is dimmed when its window is placed — the host's answer first, the drawing's second. */
  private _isPlaced(m: { label: string; placed?: boolean }): boolean {
    if (this.placed) {
      return this.placed.split(',').map((s) => s.trim().toLowerCase()).includes(m.label.toLowerCase());
    }
    return !!m.placed;
  }

  private _fmt(n: number): string {
    return Number.isFinite(n) ? n.toLocaleString() : '—';
  }

  private _value(v: string): string {
    return this.unattributed ? 'unattributed' : v;
  }

  /**
   * ONE LINE, THE FOOTER'S OWN — unchanged in wording and order, because the numbers are
   * the same numbers and only the bar under them changed. A seat that cannot resolve its
   * own conversation still says "unattributed" rather than showing another scope's totals.
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

  static styles = css`
    :host {
      display: block;
      flex: 0 0 auto;
    }
    /* Figma "output-header-area" #40001123:6689, verbatim: column, padding
       10px 20px 20px, gap 7, fill #CBE6E3. */
    .block {
      display: flex;
      flex-direction: column;
      gap: 7px;
      padding: 10px 20px 20px;
      background: #CBE6E3;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
    }
    /* The gripper #40001123:6692 — 500×7, padding 0 10px, itemSpacing 10, primary CENTER
       (the file's own coordinates: the row's centre -8588.00 is the band's centre), and
       the row it holds is 1px 2px padded with the dots 4 apart. The whole strip is the
       target, as the spacer's is: the drawing draws 4 dots and a hand expects the row. */
    .gripper {
      height: 7px;
      padding: 0 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      cursor: ns-resize;
    }
    /* #40001123:6693 — the row HUGS its dots (24.65 wide in the file, not the band's
       width) and is centred in the band by the gripper above; the dots sit at ITS start. */
    .meatballs {
      display: flex;
      gap: 4px;
      padding: 1px 2px;
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
    /* The card #40001123:6690: 500×53, radius 8, translucent #758E87, 1px edge, and a
       COLUMN in the drawing — the row, then whatever else the card carries. */
    .card {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-height: 53px;
      padding: 7px 14px;
      border-radius: 8px;
      background: rgba(117, 142, 135, 0.35);
      border: 1px solid rgba(117, 142, 135, 0.5);
      box-sizing: border-box;
    }
    .row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 9px;
      width: 100%;
      min-width: 0;
    }
    /* #40001123:6723 — the label and the five marks, 20 apart. */
    .marks {
      display: flex;
      align-items: center;
      gap: 20px;
      min-width: 0;
    }
    .label {
      color: #3D515B;
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 400;
      white-space: pre-line;
    }
    /* A mark is 32×32 of artwork and nothing else — no border, no fill. */
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
      /* The drawing's placed state: half opacity, still a control. */
      opacity: 1;
    }
    .mark[data-placed='true'] {
      opacity: 0.5;
    }
    .mark img {
      display: block;
      width: 32px;
      height: 32px;
      pointer-events: none;
    }
    /* #40001123:6740 — the credit, at the end of the row. */
    .credit {
      color: #3D515B;
      font-size: 9px;
      font-weight: 700;
      text-align: right;
      white-space: pre-line;
      flex: 1 1 auto;
      min-width: 0;
    }
    /* THE READOUTS, KEPT — the footer's own line on the tray's ground. One line,
       ellipsised rather than wrapped so the card keeps its 53px floor and the row's
       arithmetic (307 + 9 + 156 = 472) is untouched by their arrival. */
    .readouts {
      color: #3D515B;
      font-size: 13px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      align-self: stretch;
    }
  `;

  render() {
    return html`
      <div class="block" data-node-id="40001123:6689">
        <div class="gripper" data-node-id="40001123:6692" role="separator" aria-orientation="horizontal"
             aria-label="Drag to resize the output above" title="Drag to resize the output above">
          <div class="meatballs" data-node-id="40001123:6693" aria-hidden="true">
            <span class="dot" data-node-id="40001123:6694"></span><span class="dot" data-node-id="40001123:6695"></span><span class="dot" data-node-id="40001123:6696"></span><span class="dot" data-node-id="40001123:6697"></span>
          </div>
        </div>
        <div class="card" data-node-id="40001123:6690">
          <div class="row" data-node-id="40001123:6722">
            <div class="marks" data-node-id="40001123:6723">
              <span class="label" data-node-id="40001123:6832">${this.label}</span>
              ${MARKS.map(
                (m) => html`
                  <button
                    class="mark"
                    type="button"
                    data-node-id=${m.nodeId}
                    data-placed=${this._isPlaced(m) ? 'true' : 'false'}
                    aria-pressed=${this._isPlaced(m) ? 'true' : 'false'}
                    aria-label=${m.label}
                    title=${m.label}
                    @click=${() => {
                      if (m.event) this.dispatchEvent(new CustomEvent(m.event, { bubbles: true, composed: true, detail: (m as { detail?: unknown }).detail }));
                    }}
                  >
                    <img src=${m.src} alt="" />
                  </button>
                `,
              )}
            </div>
            <span class="credit" data-node-id="40001123:6740">Created by John Travis Holt
Raibach.net © 2026 Raibach IDS</span>
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('chat-plugin-tray')) customElements.define('chat-plugin-tray', ChatPluginTray);

declare global {
  interface HTMLElementTagNameMap {
    'chat-plugin-tray': ChatPluginTray;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-plugin-tray': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatPluginTray> & {
          label?: string;
          placed?: string;
          ref?: React.Ref<ChatPluginTray>;
        },
        ChatPluginTray
      >;
    }
  }
}
