/**
 * <chat-action-bar> — the command strip under the thread.
 *
 * Figma source: node 40001066:4361 "output-area" — row, padding 20px, gap 10px,
 * fill #F7FAFC (bg/muted), stroke #999999 "1px 0px" (top+bottom), "button drop"
 * shadow. Children, left to right, exactly as the frame:
 *
 *   1. gripper-prompt-input 40x40, white — the drag handle for the input area
 *      (see <chat-navigation-bar> / <workspace-layout> for the resize contract)
 *   2. "send-stop-chat-input" 46x40 — ONE control with two states, component set
 *      40001085:2532. state=send: the arrow 24.32x20 #4E68D2 (asset
 *      assets/chat-action-send.svg), disabled while the input is empty.
 *      state=stop: the 20x18 block #4E68D2 radius 2, while a call is in flight.
 *   3. "Console" 126x40 — label Inter Bold 700/16 #4E68D2
 *   4. "Models"  126x40 — same
 *   5. "+" 40x40 — glyph #4066E3 Inter 500/35, line-height 20
 *
 * Only the two named functions dispatch events — with the design's own names,
 * kebab-cased. Console / Models / + are rendered per the frame; their actions
 * are not declared in the design, so none are invented here (Core-Concept.md:
 * corrections are violations).
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';
import sendIcon from './assets/chat-action-send.svg';
import gripperIcon from './assets/chat-action-gripper.svg';

export class ChatActionBar extends LitElement {
  static properties = {
    /** Label on the Models button. */
    modelLabel: { type: String, attribute: 'model-label' },
    /** A call is in flight — the one control shows stop instead of send. */
    busy: { type: Boolean },
    /** The input holds no text — send is disabled (`Disabled:` on state=send). */
    hasText: { type: Boolean, attribute: 'has-text' },
  };

  declare modelLabel: string;
  declare busy: boolean;
  declare hasText: boolean;

  constructor() {
    super();
    this.modelLabel = 'Models';
    this.busy = false;
    this.hasText = false;
  }

  static styles = css`
    :host { display: block; }
    .bar {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 20px;
      background: #f7fafc;
      border-top: 1px solid #999999;
      border-bottom: 1px solid #999999;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.15), -4px -4px 10px rgba(0, 0, 0, 0.15);
      font-family: 'Inter', system-ui, sans-serif;
    }
    .gripper {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: ns-resize;
    }
    button {
      height: 40px;
      border: none;
      border-radius: 6px;
      background: #fff;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.15), -4px -4px 10px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      font-family: inherit;
    }
    .icon {
      width: 46px;
      border: 1px solid #4e68d2;
      color: #4e68d2;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0;
    }
    /* state=send, Disabled — empty input. */
    .icon:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    /* The stop glyph — the frame's 20x18 rect, #4E68D2, radius 2. */
    .glyph-stop {
      width: 20px;
      height: 18px;
      border-radius: 2px;
      background: #4e68d2;
      display: inline-block;
    }
    .wide {
      width: 126px;
      color: #4e68d2;
      font-size: 16px;
      font-weight: 700;
      text-align: center;
    }
    .add {
      width: 40px;
      color: #4066e3;
      font-size: 35px;
      font-weight: 500;
      line-height: 20px;
    }
  `;

  private _emit(type: 'send-input-to-model' | 'stop-model-thinking' | 'loads-cards-form-console-in-prompt-area') {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }

  /**
   * The gripper resizes the input area — the same drag the console seat has
   * (InteractiveChatInterface: mousedown records the origin, window mousemove
   * reports the delta, mouseup ends). This element is only the INPUT DEVICE;
   * the height and its clamps live in the parent, so it dispatches the three
   * phases and owns nothing.
   */
  private _dragging = false;

  private _startDrag(e: MouseEvent) {
    this._dragging = true;
    this.dispatchEvent(new CustomEvent('input-resize-start', {
      bubbles: true,
      composed: true,
      detail: { startY: e.clientY },
    }));
    const onMove = (ev: MouseEvent) => {
      if (!this._dragging) return;
      this.dispatchEvent(new CustomEvent('input-resize-move', {
        bubbles: true,
        composed: true,
        detail: { clientY: ev.clientY },
      }));
    };
    const onUp = () => {
      if (!this._dragging) return;
      this._dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      this.dispatchEvent(new CustomEvent('input-resize-end', { bubbles: true, composed: true }));
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  }

  render() {
    return html`
      <div class="bar">
        <div class="gripper" title="Drag to resize the input area" @mousedown=${this._startDrag}>
          <img src=${gripperIcon} width="17" height="21" alt="" />
        </div>
        <!-- Figma "send-stop-chat-input" #40001085:2532 — ONE control with two
             states, not two buttons side by side.
               state=send  idle   · glyph is the send arrow · On click: send-input-to-model
               state=stop  busy   · glyph is the stop block · On click: stop-model-thinking
             Disabled on state=send: while the input is empty. -->
        <button
          class="icon"
          type="button"
          data-state=${this.busy ? 'stop' : 'send'}
          title=${this.busy ? 'Stop model thinking' : 'Send input to model'}
          aria-label=${this.busy ? 'Stop model thinking' : 'Send input to model'}
          ?disabled=${!this.busy && !this.hasText}
          @click=${() => this._emit(this.busy ? 'stop-model-thinking' : 'send-input-to-model')}
        >
          ${this.busy
            ? html`<span class="glyph-stop" aria-hidden="true"></span>`
            : html`<img src=${sendIcon} width="24.32" height="20" alt="" />`}
        </button>
        <button class="wide" type="button" title="Loads cards from console in prompt area" @click=${() => this._emit('loads-cards-form-console-in-prompt-area')}>
          Console
        </button>
        <button class="wide" type="button">${this.modelLabel}</button>
        <button class="add" type="button">+</button>
      </div>
    `;
  }
}

if (!customElements.get('chat-action-bar')) customElements.define('chat-action-bar', ChatActionBar);

declare global {
  interface HTMLElementTagNameMap {
    'chat-action-bar': ChatActionBar;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-action-bar': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatActionBar> & {
          'model-label'?: string;
          ref?: React.Ref<ChatActionBar>;
        },
        ChatActionBar
      >;
    }
  }
}
