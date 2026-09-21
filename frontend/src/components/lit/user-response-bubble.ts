/**
 * <user-response-bubble> — one response row in the output card.
 *
 * Figma source (file 20UPR2KQMsbAxlo5NJb1se, v.4b): "user-response-bubble"
 * #40001119:6352 — a row, padding 4px, radius 6, gap 4, fill #CBE6E3 — holding
 * the feedback mark #40001119:6354 (19×19) and its line #40001119:6358
 * (Inter 500 / 13px / 20px, #171717). The wireframe draws it twice inside the
 * response card (#40001119:6327) with sample copy; a host feeds it the real
 * turn, which is what `text` is for.
 *
 * The fill is the same #CBE6E3 the block grounds use — on the card's
 * rgba(117,142,135,0.35) shell it reads as the lighter green the drawing shows.
 *
 * The drawing annotates nothing on this node: no `On click:`, no `Data:`. So the
 * element carries no events and no handler — an invented event name cannot be told
 * from a decision someone actually made, which is the rule the annotation pass
 * exists to keep. It is a drawing until the designer says otherwise.
 */
import { LitElement, html, css } from 'lit';
import responseIcon from '@/assets/figma-user-response-icon.svg';

export class UserResponseBubble extends LitElement {
  static properties = {
    /** The response line. The host supplies it; the drawing's own copy is sample. */
    text: { type: String },
  };

  declare text: string;

  constructor() {
    super();
    this.text = '';
  }

  static styles = css`
    :host { display: block; }
    /* Figma "user-response-bubble" #40001119:6352, verbatim: row, padding 4px,
       gap 4, radius 6, fill #CBE6E3, aligned centre.
       THE FILL KEEPS THE SEAT'S OWN TOKEN. index.css carries one chat palette for
       every seat (the owner's 2026-09-19 ask) and --chat-user-bg is its "this turn
       is the person's" value; a seat that sets it keeps its own bubble colour and
       every other seat gets the drawing's #CBE6E3. Hard-coding the hex would have
       quietly retired a token the console relies on. */
    .bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border-radius: 6px;
      background: var(--chat-user-bg, #CBE6E3);
    }
    /* The mark's own box — the drawing wraps it in a 19-wide column with 5px of
       padding above it (#40001119:6353), so the icon sits 5px down from the row's
       top edge. The column is 19 wide, which is also how the icon is placed. */
    .mark {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      flex: 0 0 19px;
      width: 19px;
      padding-top: 5px;
      box-sizing: border-box;
    }
    .mark img {
      display: block;
      width: 19px;
      height: 19px;
      pointer-events: none;
    }
    /* The line. #40001119:6358 is a fixed 451 in the wireframe because the frame
       is hand-placed; here it takes the row's width, which is what the drawing
       means at any other size. */
    .line {
      flex: 1 1 auto;
      min-width: 0;
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      color: #171717;
      overflow-wrap: anywhere;
    }
    .line:empty { display: none; }
    ::slotted(*) {
      flex: 1 1 auto;
      min-width: 0;
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      color: #171717;
    }
  `;

  render() {
    return html`
      <div class="bubble" data-node-id="40001119:6352">
        <div class="mark" data-node-id="40001119:6353">
          <img src=${responseIcon} alt="" data-node-id="40001119:6354" />
        </div>
        <span class="line" data-node-id="40001119:6358">${this.text}</span>
        <slot></slot>
      </div>
    `;
  }
}

if (!customElements.get('user-response-bubble'))
  customElements.define('user-response-bubble', UserResponseBubble);

declare global {
  interface HTMLElementTagNameMap {
    'user-response-bubble': UserResponseBubble;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'user-response-bubble': React.DetailedHTMLProps<
        React.HTMLAttributes<UserResponseBubble> & {
          text?: string;
          ref?: React.Ref<UserResponseBubble>;
        },
        UserResponseBubble
      >;
    }
  }
}
