/**
 * <status-bar-prompt-input> — Figma 40000746-94 / status-bar-prompt-input
 * 40px-wide vertical activity rail. Database_fill icons (40×27.5 cell,
 * 22×27.5 glyph) stacked with 12px gaps, first icon 10px from the top.
 * The rail grows as activity happens inside the prompt (designer's rule).
 *
 * Property: icons — ordered list of activity kinds, e.g. ['database', 'database'].
 */
import { LitElement, html, css } from 'lit';
import { databaseFillSvg } from './prompt-icons';

export class StatusBarPromptInput extends LitElement {
  static properties = { icons: { type: Array } };
  icons: string[] = [];

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
      height: 27.5px;
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
          ${kind === 'database' ? databaseFillSvg : ''}
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
