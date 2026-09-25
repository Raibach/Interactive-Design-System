/**
 * <gripper-prompt-input> — translated from Figma MCP cache: src/design/gripper-prompt-input.json
 * (node 40000746:103, pulled via get_design_context 2026-09-09)
 *
 * THAT NODE IS GONE. Re-checked 2026-09-11: 40000746:103 returns nothing from the
 * MCP and nothing from REST, so the capture above is history, not provenance. The
 * component moved to 40000941:23074 (published COMPONENT, 40×40, child "Meatballs");
 * the panel instantiates it as 40000941:23177. The rail's copy is 40000881:399,
 * whose two Meatballs_menu children (24×24) are the ones this element draws.
 * Values below were not re-derived from the moved node — only the address changed.
 *
 * MCP values: two Meatballs_menu instances, size 24px, first at left:9px top:6px,
 * second at left:16px top:6px, each rotated -90deg. Icons are the file's own
 * exported SVGs (downloaded from the MCP asset server to src/assets/).
 *
 * This is the ONLY drag anchor for a prompt-input-section (designer's rule).
 */
import { LitElement, html, css } from 'lit';
import { gripperMeatballsSvg } from './prompt-icons';

/**
 * Provenance for this element's registry entry.
 * Marking is taken exactly from the Provenance line ("inferred"); nothing here is invented.
 */
export const provenance = {
  registryEntry: 'inferred',
} as const;

export class GripperPromptInput extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      cursor: grab;
      user-select: none;
      background: #F7F8F2;
    }
    :host(:active) { cursor: grabbing; }
    /* Figma 40000941-23074: single Meatballs_menu 37×39, rotated -90°. */
    .rot { transform: rotate(-90deg); display: flex; }
  `;

  render() {
    return html`<div class="rot">${gripperMeatballsSvg}</div>`;
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
