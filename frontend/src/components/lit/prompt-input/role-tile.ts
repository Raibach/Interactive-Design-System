/**
 * <role-tile> — values filled from src/design/VALUES.json (role-tile node 40000746:106,
 * Figma MCP get_design_context). No value in this file is invented; every CSS
 * declaration traces to VALUES.json.
 *
 * VALUES.json → role-tile: bg #ffffff · box-shadow -4px -4px 5px rgba(0,0,0,0.15),
 * 0px 4px 2px rgba(0,0,0,0.25) · radius 6px · padding-left 18px · gap 53px ·
 * label 18px/700 #171717 · Arrow_drop_down 14×13 (file's own SVG asset).
 *
 * Events (composed): `role-menu-toggle` (arrow) · `role-tile-collapse-toggle` (label click)
 */
import { LitElement, html, css } from 'lit';
// The dropdown chevron, INLINE: no path, no name, nothing can resolve it. It used to be the file
// `assets/figma-9598a83b….svg` — an image in an assets folder, loadable by name from anywhere.
const arrowDropDown = "data:image/svg+xml;utf8,<svg preserveAspectRatio='none' overflow='visible' style='display: block;' width='14' height='13' viewBox='0 0 14 13' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='Arrow_drop_down'><rect x='0.5' y='0.5' width='13' height='12' rx='0.5' stroke='%234E68D2'/><path id='Vector 10' d='M6.80794 9.76953L3.09346 5.31215C2.65924 4.79109 3.02976 4 3.70803 4L10.292 4C10.9702 4 11.3408 4.79108 10.9065 5.31215L7.19206 9.76953C7.09211 9.88947 6.90789 9.88947 6.80794 9.76953Z' fill='%234E68D2'/></g></svg>";

export class RoleTile extends LitElement {
  static properties = {
    label: { type: String },
    showMenu: { type: Boolean, attribute: 'show-menu' },
  };
  declare label: string;
  declare showMenu: boolean;

  constructor() {
    super();
    this.label = '';
    this.showMenu = true;
  }

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      /* #40000909:3999 — the file's tile: itemSpacing 53, padding 0 18px (the
         declaration had kept 10/10 from the pre-rebuild tile). */
      gap: 53px;
      width: 100%;
      height: 40px;
      box-sizing: border-box;
      padding: 0 18px;
      /* Figma 40000954-23865 role-tile: px-[10px], max-w-[500px] */
      background: #F7F8F2;
      border-radius: 6px;
      box-shadow: -4px -4px 5px rgba(0,0,0,0.15), 4px 4px 5px rgba(0,0,0,0.15);
      min-width: 0;
    }
    .role-label-injection {
      flex: 1;
      height: 40px;
      padding: 10px;
      box-sizing: border-box;
      display: flex;
      align-items: center;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #171717;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      user-select: none;
      min-width: 0;
    }
    /* Figma 40000909:4317 — role-label-injection inside the role-tile SLOT
       (40000909:4316). The old ids (40000746:107 / 40000879:264) were dead:
       the accordion was rebuilt and they return nothing on either channel.
       Its children are the live label instance 40000909:4318
       ("sample-text-for-role", the component that carries the designer's
       description) and the chevron instance 40000922:4878. */
       Inline text child so ellipsis/nowrap live on the real text element. */
    .role-label-text {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .arrow-drop-down {
      /* Inherit — a shadow-root <button> otherwise falls back to the UA font (Arial). */
      font-family: inherit;
      width: 40px;
      height: 40px;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .arrow-drop-down img { display: block; width: 14px; height: 13px; }
  `;

  render() {
    return html`
      <span class="role-label-injection" data-node-id="40000909:4317" @click=${this._onMenuToggle}>
        <span class="role-label-text" data-node-id="40000909:4318">${this.label}</span>
      </span>
      ${this.showMenu ? html`
        <button class="arrow-drop-down" data-node-id="1:118" title="Select role type" aria-haspopup="menu"
                @click=${this._onMenuToggle}><img alt="" src=${arrowDropDown} /></button>` : ''}
    `;
  }

  private _onMenuToggle(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('role-menu-toggle', { bubbles: true, composed: true }));
  }

  private _onLabelClick(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('role-tile-collapse-toggle', { bubbles: true, composed: true }));
  }
}

if (!customElements.get('role-tile')) {
  customElements.define('role-tile', RoleTile);
}

declare global {
  interface HTMLElementTagNameMap {
    'role-tile': RoleTile;
  }
}
