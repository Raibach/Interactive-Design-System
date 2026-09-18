/**
 * <prompt-container> — Figma 40000746-6 / "Frame 143"
 * 643-wide bordered container (#C0BDCF 1px) hosting the stacked
 * prompt-input-sections (left, 602px area) and the vertical format rail
 * (right, 39px): gripper top / meatballs bottom, vertical "Agent Prompting"
 * label (Inter 16px w500 lh19.364 #171717), vertical tokens/cost readout
 * (Inter 12px w600 lh20 #767676).
 *
 * Properties: formatLabel, tokensLabel (rail texts; shown verbatim).
 * Sections are provided via the default slot.
 */
import { LitElement, html, css } from 'lit';
import { meatballsInstanceSvg, gripperMeatballsSvg } from './prompt-icons';

export class PromptContainer extends LitElement {
  static properties = {
    formatLabel: { type: String, attribute: 'format-label' },
    tokensLabel: { type: String, attribute: 'tokens-label' },
  };
  declare formatLabel: string;
  declare tokensLabel: string;

  constructor() {
    super();
    this.formatLabel = '';
    this.tokensLabel = '';
  }

  static styles = css`
    :host {
      /* Stretches to the BOTTOM of the column so the panel's border snaps to the
         bottom edge. The slotted prompt sections inside still hug their own
         content — only the panel fills, never the textareas. */
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 0;
      background: #ffffff;
      border: 1px solid #c0bdcf;
      /* Figma 40000746:6 "left-column-panel-container": rounded-tl-[10px] (TOP-LEFT ONLY) */
      border-top-left-radius: 10px;
      box-sizing: border-box;
    }
    .inner {
      display: flex;
      flex: 1;
      min-height: 0;
      margin: 1px;
    }
    .sections-area {
      display: var(--left-sections-display, block);
      flex: 1;
      min-width: 0;
      /* Deliberately NOT a flex column — the sections must hug their content
         (and auto-grow as you type), not stretch to fill the panel. */
      min-height: 0;
    }
    .format-rail {
      width: 39px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      background: #ffffff;
    }
    .rail-meatballs {
      display: flex;
      height: 34px;
      align-items: flex-start;
    }
    .rail-meatballs > :first-child { margin-right: -1px; }
    /* Instrumented wrappers: keep 24×24 meatballs pixel-identical (no inline-SVG baseline gap). */
    .rail-meatballs > span { display: block; line-height: 0; }
    .rail-gripper {
      width: 39px;
      height: 37px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .rail-gripper .rot { transform: rotate(-90deg); display: flex; }
    .vertical-label {
      writing-mode: vertical-rl;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 16px;
      font-weight: 500;
      line-height: 19.364px;
      color: #171717;
      white-space: nowrap;
    }
    .vertical-tokens {
      writing-mode: vertical-rl;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      line-height: 20px;
      color: #767676;
      white-space: nowrap;
    }
    .rail-bottom { margin-top: auto; }
  `;

  render() {
    return html`
      <div class="inner">
        <div class="sections-area">
          <slot></slot>
        </div>
        <div class="format-rail" data-tag="format-rail">
          <div class="rail-gripper" data-node-id="40000881:399">
            <span class="rot">${gripperMeatballsSvg}</span>
          </div>
          ${this.formatLabel ? html`<div class="vertical-label">${this.formatLabel}</div>` : ''}
          ${this.tokensLabel ? html`<div class="vertical-tokens">${this.tokensLabel}</div>` : ''}
          <div class="rail-meatballs rail-bottom" data-node-id="40000881:399">
            <span data-node-id="40000881:400">${meatballsInstanceSvg}</span>
            <span data-node-id="40000881:401">${meatballsInstanceSvg}</span>
          </div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('prompt-container')) {
  customElements.define('prompt-container', PromptContainer);
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-container': PromptContainer;
  }
}
