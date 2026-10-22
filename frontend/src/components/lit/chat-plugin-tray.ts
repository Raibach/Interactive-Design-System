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
 *   rgba(117,142,135,0.5), padding 7px 14px, gap 10. It used to carry the label "Active
 *   Plugins" and the credit line; BOTH LEFT ON THE OWNER'S WORD, 2026-10-19: *"You can
 *   remove the active plug-in and the copyright"* — the card is now the RESERVED SPACE FOR
 *   THE ROOM'S OWN CHAT CONTROLS (the owner's own note on it: *"we have this space at the
 *   bottom for chat controls related to post hog … that's what that space is reserved for
 *   customization"*). An empty card is what an unclaimed reservation looks like; nothing
 *   stands in it until a room fills it.
 *
 * THE FIVE MARKS RETIRED — 2026-10-14, on the owner's word: *"take away these inactive
 * icons at the bottom of the chat for every section… filler icons that are inactive or
 * stubs"* — the attached set: forum, model reference, chat history, new conversation, user
 * feedback. The label, the credit and the marks have all left since; the gripper and the
 * readouts stay. The product room never drew this tray (its foot is <chat-product-tools>),
 * so the removal reaches every other section and nothing of product's. Two marks had
 * behaviour — the history toggle and the wired add mark — both went with the set; the add
 * mark's function lives on where it was always also called (a package opened with no
 * conversation — see chat-panel's `_startNewConversation`). The five artwork files stay in
 * assets, referenced by nothing.
 *
 * TYPE: the credit and the readouts keep the application face (.block's Inter).
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';

export class ChatPluginTray extends LitElement {
  static properties = {
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
    /* THE CARD IS THE ROOM'S RESERVATION. Its own rows left on the owner's word (see the
       header), so what is left is the box the room fills — the drawing's radius, edge and
       ground, and nothing drawn inside it until something is said there. */
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
        <div class="card" data-node-id="40001123:6690"></div>
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
          ref?: React.Ref<ChatPluginTray>;
        },
        ChatPluginTray
      >;
    }
  }
}
