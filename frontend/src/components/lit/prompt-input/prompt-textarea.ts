/**
 * <prompt-textarea> — Figma 40000746-94 / prompt-textarea
 * Fill rgba(255,255,255,0.50), 1px #767676 stroke, radius 6,
 * shadows: 4px 4px 10px rgba(0,0,0,.15) + -4px -4px 10px rgba(0,0,0,.15).
 * Inner padding 13px horizontal / 10px vertical; textarea Inter 16px
 * weight 600, line-height 25px, #000000, left/top aligned. Auto-resizes;
 * min-height comes from the design per section (45 / 145 / 120).
 *
 * Designer annotation (node 40000746-96): "this is a textarea - for active data."
 *
 * Property: value, placeholder, minHeight (default 45).
 * Event (composed): `value-input` {value} — fired on every input.
 */
import { LitElement, html, css } from 'lit';

export class PromptTextarea extends LitElement {
  static properties = {
    value: { type: String },
    placeholder: { type: String },
    minHeight: { type: Number, attribute: 'min-height' },
  };
  value = '';
  placeholder = '';
  minHeight = 45;

  static styles = css`
    :host {
      display: block;
      flex: 1;
      min-width: 0;
      background: rgba(255, 255, 255, 0.50);
      border: 1px solid #767676;
      border-radius: 6px;
      box-sizing: border-box;
      box-shadow: 4px 4px 10px rgba(0,0,0,0.15), -4px -4px 10px rgba(0,0,0,0.15);
    }
    .text-input-placeholder {
      padding: 10px 13px;
      box-sizing: border-box;
    }
    textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      border: none;
      outline: none;
      background: transparent;
      resize: none;
      font-family: 'Inter', system-ui, sans-serif;
      font-weight: 600;
      font-size: 16px;
      line-height: 25px;
      color: #000000;
    }
    textarea::placeholder { color: #a3a3a3; }
  `;

  render() {
    return html`
      <div class="text-input-placeholder">
        <textarea
          part="textarea"
          .value=${this.value}
          placeholder=${this.placeholder}
          @input=${this._onInput}
        ></textarea>
      </div>
    `;
  }

  firstUpdated() {
    this._resize();
  }

  updated(changed: Map<string, unknown>) {
    // Only sync the DOM value from the property when the user is not typing
    // in this textarea (prevents caret jumps on external updates).
    if (changed.has('value') && this.shadowRoot) {
      const ta = this.shadowRoot.querySelector('textarea');
      if (ta && document.activeElement !== ta && (ta as HTMLTextAreaElement).value !== this.value) {
        (ta as HTMLTextAreaElement).value = this.value;
        this._resize();
      }
    }
  }

  private _onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    this._resize();
    this.dispatchEvent(new CustomEvent('value-input', {
      bubbles: true,
      composed: true,
      detail: { value: ta.value },
    }));
  }

  private _resize() {
    const ta = this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = Math.max(this.minHeight, ta.scrollHeight) + 'px';
  }
}

if (!customElements.get('prompt-textarea')) {
  customElements.define('prompt-textarea', PromptTextarea);
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-textarea': PromptTextarea;
  }
}
