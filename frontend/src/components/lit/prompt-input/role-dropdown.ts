/**
 * <role-dropdown> — the role-selector dropdown for a prompt-input-section's
 * accordion tile. Figma "Component 24/Frame 886946" (node 40000934:22851),
 * pulled via get_design_context 2026-09-10.
 *
 * Annotation (data-development-annotations @ 40000934:22851):
 *   "This is supposed to be the drop-down for the accordion tiles in the left
 *    column where we enter our prompt information. I collect prompt input area
 *    for the agents."
 *   → Behavior (Builder, per §9 free-form note): picking a role sets the role
 *     for that prompt-input section; "Remove" deletes the section.
 *
 * Design values (traced to the pull, none invented):
 *   accordion-dropdown #40000934:22852 → 379px column, gap 5px
 *   role-dropdown-tile → white, radius 6px, "button drop" shadow, px 10px
 *   role-label-injection → 40px tall, p 10px
 *   labels → Inter Bold 14px; User Role / Agent Role / Tool Call / Custom in
 *   #171717; "Remove" in #c50000
 *
 * Events (composed): `role-select` ({ detail: { role } }) · `role-remove`
 */
import { LitElement, html, css } from 'lit';

const ROLES = [
  { label: 'User Role', tileId: '40000934:22853', textId: '40000934:22856' },
  { label: 'Agent Role', tileId: '40000934:22858', textId: '40000934:22861' },
  { label: 'Tool Call', tileId: '40000934:22863', textId: '40000934:22866' },
  { label: 'Custom', tileId: '40000934:22868', textId: '40000934:22871' },
];
const REMOVE = { label: 'Remove', tileId: '40000934:22895', textId: '40000934:22898' };

export class RoleDropdown extends LitElement {
  static styles = css`
    :host {
      /* accordion-dropdown #40000934:22852 — 379px column, gap 5px */
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
      width: 379px;
    }
    .tile {
      /* role-dropdown-tile — white, radius 6px, "button drop", px 10px */
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
      box-sizing: border-box;
      padding: 0 10px;
      background: #ffffff;
      border: none;
      border-radius: 6px;
      box-shadow: -4px -4px 5px rgba(0, 0, 0, 0.15), 4px 4px 5px rgba(0, 0, 0, 0.15);
      cursor: pointer;
    }
    .label {
      /* role-label-injection — 40px, gap 10px, p 10px */
      display: flex;
      align-items: center;
      gap: 10px;
      height: 40px;
      width: 100%;
      box-sizing: border-box;
      padding: 10px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #171717;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .label--remove {
      color: #c50000;
    }
  `;

  render() {
    return html`
      ${ROLES.map((r) => html`
        <button class="tile" data-node-id=${r.tileId} data-name="role-dropdown-tile" @click=${() => this._select(r.label)}>
          <span class="label" data-node-id=${r.textId} data-name="role-label-injection">${r.label}</span>
        </button>
      `)}
      <button class="tile" data-node-id=${REMOVE.tileId} data-name="role-dropdown-tile" @click=${this._remove}>
        <span class="label label--remove" data-node-id=${REMOVE.textId} data-name="role-label-injection">${REMOVE.label}</span>
      </button>
    `;
  }

  private _select(role: string) {
    this.dispatchEvent(new CustomEvent('role-select', { bubbles: true, composed: true, detail: { role } }));
  }

  private _remove() {
    this.dispatchEvent(new CustomEvent('role-remove', { bubbles: true, composed: true }));
  }
}

if (!customElements.get('role-dropdown')) {
  customElements.define('role-dropdown', RoleDropdown);
}

declare global {
  interface HTMLElementTagNameMap {
    'role-dropdown': RoleDropdown;
  }
}
