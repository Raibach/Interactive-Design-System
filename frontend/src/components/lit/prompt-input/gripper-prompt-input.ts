/**
 * <gripper-prompt-input> — translated from Figma MCP cache: src/design/gripper-prompt-input.json
 * (node 40000746:103, pulled via get_design_context 2026-09-09)
 *
 * MCP values: two Meatballs_menu instances, size 24px, first at left:9px top:6px,
 * second at left:16px top:6px, each rotated -90deg. Icons are the file's own
 * exported SVGs (downloaded from the MCP asset server to src/assets/).
 *
 * This is the ONLY drag anchor for a prompt-input-section (designer's rule).
 */
import { LitElement, html, css } from 'lit';
import meatballs1 from '../../../assets/figma-8b1b452e2cef56cac2782037ad0063fc0fc0b0c7.svg';
import meatballs2 from '../../../assets/figma-e0e27b50d05223371eaf5e9bc107d6901d0b45be.svg';

export class GripperPromptInput extends LitElement {
  static styles = css`
    :host {
      display: block;
      position: relative;
      width: 49px;
      height: 37px;
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
      background: #ffffff;
    }
    :host(:active) { cursor: grabbing; }
    .meatballs {
      position: absolute;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .meatballs img { display: block; width: 24px; height: 24px; }
    /* MCP: both instances carry -rotate-90 */
    .meatballs .rot { transform: rotate(-90deg); }
    .m0 { left: 9px; top: 6px; }
    .m1 { left: 16px; top: 6px; }
  `;

  render() {
    return html`
      <div class="meatballs m0"><div class="rot"><img alt="" src=${meatballs1} /></div></div>
      <div class="meatballs m1"><div class="rot"><img alt="" src=${meatballs2} /></div></div>
    `;
  }
}

if (!customElements.get('gripper-prompt-input')) {
  customElements.define('gripper-prompt-input', GripperPromptInput);
}

declare global {
  interface HTMLElementTagNameMap {
    'gripper-prompt-input': GripperPromptInput;
  }
}
