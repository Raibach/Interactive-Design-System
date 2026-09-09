/**
 * <prompt-container> — Figma 40000746-6 / "Frame 143"
 * 643-wide bordered container (#C0BDCF 1px) hosting the stacked
 * prompt-input-sections (left, 602px area) and the vertical format rail
 * (right, 39px): meatballs groups top/bottom, vertical "Response Format A"
 * label (Inter 16px w500 lh19.364 #171717), vertical tokens/cost readout
 * (Inter 12px w600 lh20 #767676).
 *
 * Properties: formatLabel, tokensLabel (rail texts; shown verbatim).
 * Sections are provided via the default slot.
 */
import { LitElement, html, css } from 'lit';
import { meatballsInstanceSvg } from './prompt-icons';

export class PromptContainer extends LitElement {
  static properties = {
    formatLabel: { type: String, attribute: 'format-label' },
    tokensLabel: { type: String, attribute: 'tokens-label' },
  };
  formatLabel = '';
  tokensLabel = '';

  static styles = css`
    :host {
      display: block;
      background: #ffffff;
      border: 1px solid #c0bdcf;
      /* Figma 40000746:6 "left-column-panel-container": rounded-tl-[10px] (TOP-LEFT ONLY) */
      border-top-left-radius: 10px;
      box-sizing: border-box;
    }
    .inner {
      display: flex;
      margin: 1px;
    }
    .sections-area {
      flex: 1;
      min-width: 0;
    }
    .format-rail {
      width: 39px;
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
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
    .vertical-label {
      writing-mode: vertical-rl;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 16px;
      font-weight: 500;
      line-height: 19.364px;
      color: #171717;
      margin-top: 11px;
      white-space: nowrap;
    }
    .vertical-tokens {
      writing-mode: vertical-rl;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 600;
      line-height: 20px;
      color: #767676;
      margin-top: 10px;
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
          <div class="rail-meatballs" data-node-id="40000881:373">
            <span data-node-id="40000881:374">${meatballsInstanceSvg}</span>
            <span data-node-id="40000881:375">${meatballsInstanceSvg}</span>
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
