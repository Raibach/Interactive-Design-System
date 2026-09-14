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
 * THE HEIGHT IS THE TEXT'S, ALWAYS.
 *
 * `min-height` is the design's floor and nothing else — never a cap, and never the
 * height. The box is re-measured whenever its value changes however it changed
 * (a keystroke here, or the host pushing a whole prompt in) and whenever the column
 * it is in changes width, because a narrower column wraps the same text onto more
 * lines. Growing costs nothing the layout has to pay for: the sections live in
 * `.sections-scroll`, a fixed-height column that scrolls, so a tall box scrolls the
 * PROMPT column and cannot push the middle or right columns down.
 *
 * The one thing that was here instead: the re-measure sat behind a
 * "DOM value !== property value" guard and `textarea { overflow: hidden }`. The app
 * sets both in the same commit, so that guard was false exactly when a prompt
 * arrived from the app — and the box stayed at the 45px it had measured while
 * empty. A 12-line repair form rendered inside it lost the bottom 384px, which is
 * where the fields are. The box only grew once a person typed into it — the one
 * path that measured unconditionally.
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
  declare value: string;
  declare placeholder: string;
  declare minHeight: number;

  /** Set while a re-measure is already queued, so a burst of updates measures once. */
  private _resizeQueued = false;
  /** Re-measures when the column changes width — the same text wraps differently. */
  private _ro: ResizeObserver | null = null;
  /** The width the current height was measured at. */
  private _measuredWidth = -1;

  constructor() {
    super();
    this.value = '';
    this.placeholder = '';
    this.minHeight = 45;
  }

  static styles = css`
    :host {
      display: block;
      flex: 1;
      min-width: 0;
      background: rgba(255, 255, 255, 0.50);
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
      /* Grows with the text (see _resize) — never shows an inner scrollbar. */
      overflow: hidden;
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
    this._scheduleResize();
  }

  connectedCallback() {
    super.connectedCallback();
    if (typeof ResizeObserver === 'undefined') return;
    this._ro = new ResizeObserver(() => {
      // Height-only churn is this element's own resize landing back on us; only a
      // WIDTH change can re-wrap the text and change what the height should be.
      const width = this.clientWidth;
      if (width === this._measuredWidth) return;
      this._scheduleResize();
    });
    this._ro.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._ro?.disconnect();
    this._ro = null;
  }

  updated(changed: Map<string, unknown>) {
    // Only sync the DOM value from the property when the user is not typing
    // in this textarea (prevents caret jumps on external updates).
    if (changed.has('value') && this.shadowRoot) {
      const ta = this.shadowRoot.querySelector('textarea');
      if (ta && document.activeElement !== ta && (ta as HTMLTextAreaElement).value !== this.value) {
        (ta as HTMLTextAreaElement).value = this.value;
      }
    }
    // Re-measure on every value change, whoever made it — and on a new floor.
    // This is deliberately NOT nested inside the guard above: the app's own pushes
    // agree with the DOM by construction, so a guard on that agreement measures
    // everything except the case that matters (see the header).
    if (changed.has('value') || changed.has('minHeight')) this._scheduleResize();
  }

  private _onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    // Typing measures at once: scrollHeight is synchronous, so the box stays in
    // step with the caret rather than a frame behind it.
    this._resize();
    this.dispatchEvent(new CustomEvent('value-input', {
      bubbles: true,
      composed: true,
      detail: { value: ta.value },
    }));
  }

  /** Measure once the browser has laid the new text out. */
  private _scheduleResize(): void {
    if (this._resizeQueued) return;
    this._resizeQueued = true;
    const measure = () => {
      this._resizeQueued = false;
      this._resize();
    };
    // rAF is the earliest point the new value has a laid-out height to read; the
    // fallback keeps the element usable where rAF is absent (SSR-style/test envs).
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(measure);
    else measure();
  }

  // Auto-grow: the box hugs its text and expands with it. minHeight is the design
  // floor (45 / 145 / 120 by role family) — a MINIMUM, never a cap — so the box
  // never clips and never needs an inner scrollbar. The text may arrive by typing
  // or be pushed in whole by the app; both are measured (_onInput for the first,
  // updated() for the second).
  private _resize(): void {
    const ta = this.shadowRoot?.querySelector('textarea') as HTMLTextAreaElement | null;
    if (!ta) return;
    this._measuredWidth = this.clientWidth;
    // 'auto' first: a height set on the element is a floor for scrollHeight, so
    // measuring without clearing it can only ever grow the box, never shrink it.
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
