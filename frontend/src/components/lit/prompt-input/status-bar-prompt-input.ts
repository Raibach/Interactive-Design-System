/**
 * <status-bar-prompt-input> — Figma 40000746-94 / status-bar-prompt-input
 * 40px-wide vertical activity rail. Database_fill icons (40×27.5 cell,
 * 22×27.5 glyph) stacked with 12px gaps, first icon 10px from the top.
 * The rail grows as activity happens inside the prompt (designer's rule).
 *
 * Property: icons — ordered list of activity kinds, e.g. ['database', 'database'].
 */
import { LitElement, html, css } from 'lit';
import { databaseFillSvg, lightningAltFillLightSvg, lightningAltFillLight1Svg } from './prompt-icons';

export class StatusBarPromptInput extends LitElement {
  static properties = { icons: { type: Array } };
  declare icons: string[];

  constructor() {
    super();
    this.icons = [];
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
        <span class="icon-cell" title="${kind} activity" data-icon-kind="${kind}">
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
