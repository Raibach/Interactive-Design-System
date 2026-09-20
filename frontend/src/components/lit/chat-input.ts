/**
 * <chat-input> — the frame's "chat-input-area" (node 40001066:4330).
 *
 * Figma source: a region — column, stretch, padding 20px, gap 10px, fill #E5E1DD,
 * inset shadow 0 4px 4px rgba(0,0,0,0.15), radius 6px. The frame contains ONLY
 * the label "chat input". It contains NO textarea and NO send button — so this
 * element renders NONE either. It is a SLOT: the host puts the existing input
 * ability inside it, and whatever that control emits (e.g. `message-sent`)
 * bubbles out of this region.
 *
 * Corrections are violations: a chat that cannot accept input is a CORRECT
 * result if the design has no input control. This element is the region; the
 * control is the host's, slotted.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';

export class ChatInput extends LitElement {
  static properties = {
    /** The dragged height of the input area, px. 0 = auto (frame default). */
    height: { type: Number },
  };

  declare height: number;

  constructor() {
    super();
    this.height = 0;
  }

  static styles = css`
    /* THE CONTROL INSIDE PAINTS NOTHING. v.4b draws this region as ONE surface — a solid
       #E4E7C8 block with the text typed straight onto it (the owner, 2026-09-19: "it
       looks like it's got a button or something floating with rounded corners… it should
       just be transparent… The design itself is just one solid color and then the text
       just typed"). <prompt-textarea> carries the prompt column's designed box, so this
       seat turns that box off by setting its three properties to nothing; the element
       keeps every behaviour — same tag, same events, same auto-grow. */
    :host {
      display: block;
      --pt-fill: transparent;
      --pt-radius: 0;
      --pt-shadow: none;
      /* AND NO SECOND INSET: the region's own 20px is the design's spacing, so the control
         inside adds none of its own (v.4b #40001119:6044 puts the line at exactly 20px). */
      --pt-pad: 0;
    }
    /* v.4b: "chat-input-area" #40001119:6044 — column, stretch, padding 20px,
       gap 10px, fill #E4E7C8, shadow inset 4px 4px 4px rgba(0,0,0,0.25). The
       frame still contains ONLY the label "chat input"; the control inside is the
       host's, slotted, exactly as before. The ground and the inset are the new
       node's values — the old node (40001066:4330) was #E5E1DD with the shadow on
       the top edge. */
    .input-area {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 20px;
      background: #E4E7C8;
      box-shadow: inset 4px 4px 4px 0 rgba(0, 0, 0, 0.25);
      min-height: 80px;
      box-sizing: border-box;
      overflow: hidden;
    }
    ::slotted(*) { flex: 1 1 auto; }
  `;

  render() {
    return html`
      <div class="input-area" style=${this.height > 0 ? `height: ${this.height}px` : ''}>
        <slot></slot>
      </div>
    `;
  }
}

if (!customElements.get('chat-input')) customElements.define('chat-input', ChatInput);

declare global {
  interface HTMLElementTagNameMap {
    'chat-input': ChatInput;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-input': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatInput> & {
          ref?: React.Ref<ChatInput>;
        },
        ChatInput
      >;
    }
  }
}
