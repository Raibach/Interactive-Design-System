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
    :host { display: block; }
    .input-area {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 20px;
      background: #e5e1dd;
      box-shadow: inset 0 4px 4px rgba(0, 0, 0, 0.25);
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

customElements.define('chat-input', ChatInput);

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
