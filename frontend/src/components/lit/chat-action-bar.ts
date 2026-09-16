/**
 * <chat-action-bar> — the command strip under the thread.
 *
 * Figma source: node 40001066:4361 "output-area" — row, padding 20px, gap 10px,
 * fill #F7FAFC (bg/muted), stroke #999999 "1px 0px" (top+bottom), "button drop"
 * shadow. Children, left to right, exactly as the frame:
 *
 *   1. gripper-prompt-input 40x40, white — Meatballs SVG 17x21 (a marker in the
 *      frame; resizing is not implemented, so it is not a handle)
 *   2. "Function - send input to model" 46x40 — Send-chat frame, Vector SVG
 *      24.32x20 #4E68D2 (asset: assets/chat-action-send.svg). THE SUBMIT BUTTON.
 *   3. "Function - stop model thinking" 46x40 — 20x18 rect #4E68D2 radius 2.
 *      THE STOP BUTTON.
 *   4. "Console" 126x40 — label Inter Bold 700/16 #4E68D2
 *   5. "Models"  126x40 — same
 *   6. "+" 40x40 — glyph #4066E3 Inter 500/35, line-height 20
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
  };

  declare modelLabel: string;

  constructor() {
    super();
    this.modelLabel = 'Models';
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
        <button class="icon" type="button" title="Send input to model" @click=${() => this._emit('send-input-to-model')}>
          <img src=${sendIcon} width="24.32" height="20" alt="" />
        </button>
        <button class="icon" type="button" title="Stop model thinking" @click=${() => this._emit('stop-model-thinking')}>
          <span class="glyph-stop" aria-hidden="true"></span>
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

customElements.define('chat-action-bar', ChatActionBar);

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
