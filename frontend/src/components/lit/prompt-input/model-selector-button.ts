/**
 * <model-selector-button> — Figma 40000922:4882 "Frame 886944" /
 * "Function - Model Selector Button" slot (node 40000909:4322) +
 * "model-btn-label" instance (node 40000973:24208, component 40000973:24205).
 *
 * The model selector in the "Prompt Output" prompt-accordion header. White
 * button, radius 6, "button drop" shadow, fixed 171×40, centered "Models"
 * label (Inter Bold 16px, #8B8B8B). Every value traces to the Figma MCP
 * get_design_context pull of node 40000922:4882 (2026-09-10). No invented
 * values.
 *
 * Design-tree mapping (node → element):
 *   40000909:4322   "Function - Model Selector Button" → <button class="model-btn">
 *   40000973:24208  "model-btn-label"                  → <span class="model-label">
 *   I40000973:24208;40000973:24203 "Models" text       → label text (property `label`)
 *
 * Events (composed): `model-selector-toggle` (click).
 * // TODO(behavior): the model menu this button opens is not drawn in node
 * 40000922:4882 — no menu contents are in the pull. The control is rendered
 * with the correct tag/role (native <button>, aria-haspopup="menu") and
 * dispatches the structural toggle; the host owns the actual menu.
 */
import { LitElement, html, css } from 'lit';

export class ModelSelectorButton extends LitElement {
  static properties = {
    label: { type: String },
  };
  declare label: string;

  constructor() {
    super();
    this.label = 'Models';
  }

  static styles = css`
    :host {
      /* node 40000909:4322 — fixed 171×40, white, radius 6, "button drop" */
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;              /* node 40000909:4322 layout gap */
      width: 171px;           /* node 40000909:4322 sizing fixed */
      height: 40px;           /* node 40000909:4322 sizing fixed */
      box-sizing: border-box;
      padding: 0 3px;         /* node 40000909:4322 padding */
      background: #ffffff;    /* node 40000909:4322 fill (fill_658ab2fa) */
      border-radius: 6px;     /* node 40000909:4322 borderRadius */
      box-shadow: 4px 4px 10px 0px rgba(0, 0, 0, 0.15),
                  -4px -4px 10px 0px rgba(0, 0, 0, 0.15); /* node 40000909:4322 "button drop" */
      flex-shrink: 0;
    }
    .model-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .model-label {
      /* node I40000973:24208;40000973:24203 — Inter Bold 16px, #8B8B8B, centered */
      font-size: 16px;
      font-weight: 700;
      line-height: normal;
      color: #8b8b8b;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `;

  render() {
    return html`
      <button
        class="model-btn"
        data-node-id="40000909:4322"
        title="Select model"
        aria-haspopup="menu"
        @click=${this._onToggle}
      >
        <span class="model-label" data-node-id="40000973:24208">${this.label}</span>
      </button>
    `;
  }

  private _onToggle(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('model-selector-toggle', { bubbles: true, composed: true }));
  }
}

if (!customElements.get('model-selector-button')) {
  customElements.define('model-selector-button', ModelSelectorButton);
}

declare global {
  interface HTMLElementTagNameMap {
    'model-selector-button': ModelSelectorButton;
  }
}
