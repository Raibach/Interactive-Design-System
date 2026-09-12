/**
 * <status-bar-prompt-input> — Figma 40000746-94 / status-bar-prompt-input
 * 40px-wide vertical activity rail. Database_fill icons (40×27.5 cell,
 * 22×27.5 glyph) stacked with 12px gaps, first icon 10px from the top.
 * The rail grows as activity happens inside the prompt (designer's rule).
 *
 * Property: icons — ordered list of activity kinds, e.g. ['database', 'database'].
 */
import { LitElement, html, css, nothing } from 'lit';
import { databaseFillSvg, lightningAltFillLightSvg, lightningAltFillLight1Svg } from './prompt-icons';

export class StatusBarPromptInput extends LitElement {
  static properties = { icons: { type: Array } };
  declare icons: string[];

  /** The rail's own Figma node — "status-bar-prompt-input" (registry.json). */
  static readonly NODE_ID = '40000878:239';

  /**
   * Figma node per activity kind. The design draws TWO cells in this rail:
   * Database_fill (40000746:98) and Subtract (40000746:99 — the lightning glyph).
   * Both lightning variants draw that same node's artwork.
   */
  static readonly NODE_OF_ICON: Record<string, string> = {
    database: '40000746:98',
    lightning: '40000746:99',
    lightning1: '40000746:99',
  };

  constructor() {
    super();
    this.icons = [];
  }

  connectedCallback() {
    super.connectedCallback();
    // The rail's own node id rides on the host: the host IS the drawn rail, so
    // this is the node → element mapping, not decoration. Without it the one
    // component in the rail carries no traceable node reference at all.
    if (!this.hasAttribute('data-node-id')) this.setAttribute('data-node-id', StatusBarPromptInput.NODE_ID);
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 40px;
      flex-shrink: 0;
      padding-top: 10px;
      gap: 12px;
      box-sizing: border-box;
    }
    .icon-cell {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
  `;

  render() {
    return html`${this.icons.map(
      (kind) => html`
        <span class="icon-cell" title="${kind} activity" data-icon-kind="${kind}"
              data-node-id=${StatusBarPromptInput.NODE_OF_ICON[kind] ?? nothing}>
          ${kind === 'database' ? databaseFillSvg : kind === 'lightning1' ? lightningAltFillLight1Svg : kind === 'lightning' ? lightningAltFillLightSvg : ''}
        </span>`,
    )}`;
  }
}

if (!customElements.get('status-bar-prompt-input')) {
  customElements.define('status-bar-prompt-input', StatusBarPromptInput);
}

declare global {
  interface HTMLElementTagNameMap {
    'status-bar-prompt-input': StatusBarPromptInput;
  }
}
