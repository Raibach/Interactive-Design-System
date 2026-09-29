/**
 * <prompt-input-section-system-role> — Figma 40001177:2458 / prompt-input-section-sytem-user-seat-one
 * System Role seat: sticky (always first), NO gripper, NO drag, NO delete.
 * Header: status icon (Database_fill) + role-tile ("System Role" with chevron) + Functions | Tools button.
 * Body: status-bar-icon-slot (empty) + prompt-textarea-container-system ("Enter prompt text.").
 *
 * Dropdown menu only offers: System Role / Department Role (no other types, no Add Section, no Remove).
 * Selecting "Department Role" emits system-role-mode-change { mode: 'department' }.
 */
import { LitElement, html, css, nothing } from 'lit';
import { databaseFillSvg } from './prompt-icons';
// The dropdown chevron, INLINE: no path, no name, nothing can resolve it. It used to be the file
// `assets/figma-9598a83b….svg` — an image in an assets folder, loadable by name from anywhere.
const arrowDropDown = "data:image/svg+xml;utf8,<svg preserveAspectRatio='none' overflow='visible' style='display: block;' width='14' height='13' viewBox='0 0 14 13' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='Arrow_drop_down'><rect x='0.5' y='0.5' width='13' height='12' rx='0.5' stroke='%234E68D2'/><path id='Vector 10' d='M6.80794 9.76953L3.09346 5.31215C2.65924 4.79109 3.02976 4 3.70803 4L10.292 4C10.9702 4 11.3408 4.79108 10.9065 5.31215L7.19206 9.76953C7.09211 9.88947 6.90789 9.88947 6.80794 9.76953Z' fill='%234E68D2'/></g></svg>";

/** System Role seat's own menu options — only two, no Add/Remove. */
const SYSTEM_ROLE_MENU_TYPES = [
  { type: 'system-role', label: 'System Role', description: 'The standing instruction. Who the assistant is and how it should behave, said once and read on every request.' },
  { type: 'department-role', label: 'Department Role', description: 'A department-specific role that auto-populates SOPs and adds UX Design + Design Requirement seats.' },
] as const;

export class PromptInputSectionSystemRole extends LitElement {
  static properties = {
    name: { type: String },
    content: { type: String },
    placeholder: { type: String },
    minHeight: { type: Number, attribute: 'min-height' },
    menuOpen: { type: Boolean, attribute: 'menu-open' },
  };

  declare name: string;
  declare content: string;
  declare placeholder: string;
  declare minHeight: number;
  declare menuOpen: boolean;

  constructor() {
    super();
    this.name = 'System Role';
    this.content = '';
    this.placeholder = 'Enter system instruction…';
    this.minHeight = 45;
    this.menuOpen = false;
  }

  static styles = css`
    :host {
      display: block;
      flex: 0 0 auto;
      width: 100%;
      background: #F7F8F2;
      border-radius: 6px;
      box-sizing: border-box;
    }
    .responsive-prompt-container {
      /* Figma 40001177:2459 — padding 15/3/15/3 */
      padding: 15px 3px;
      box-sizing: border-box;
    }
    .section-header-system-roles {
      display: flex;
      gap: 5px;
      align-items: center;
      height: 40px;
      box-sizing: border-box;
    }
    /* Status icon — Figma 40001177:2461 status-system-slector-default */
    .status-system-selector {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #F7F8F2;
      border-radius: 6px;
      box-shadow: -4px -4px 5px rgba(0,0,0,0.15), 4px 4px 5px rgba(0,0,0,0.15);
    }
    .status-system-selector svg { width: 22px; height: 27.5px; }
    /* System-Role frame — Figma 40001177:2463 */
    .system-role-frame {
      flex: 1;
      display: flex;
      gap: 5px;
      align-items: center;
      height: 40px;
      min-width: 0;
    }
    /* Role tile — Figma 40001177:2465 role-tile (379×40) */
    .role-tile-wrap {
      position: relative;
      flex: 1 0 0;
      min-width: 0;
      display: flex;
    }
    .role-tile {
      /* Figma 40001177:2466 tile-label + 40001177:2465 role-tile */
      position: relative;
      flex: 1 0 0;
      min-width: 0;
      height: 40px;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 10px;
      background: #FFFFFF;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0,0,0,0.15), -4px -4px 10px rgba(0,0,0,0.15);
      box-sizing: border-box;
      max-width: 500px;
    }
    .tile-label-container {
      flex: 1;
      display: flex;
      align-items: center;
      min-width: 0;
    }
    .tile-label {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 18px;
      font-weight: 700;
      color: #171717;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      user-select: none;
    }
    .chevron-blue-closed {
      width: 40px;
      height: 40px;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: 7px;
      cursor: pointer;
    }
    .chevron-blue-closed img { width: 14px; height: 13px; }
    /* System-toolsSelector-btn — Figma 40001177:2470 (171×40) */
    .system-tools-btn {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 171px;
      height: 40px;
      background: #F7F8F2;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0,0,0,0.15), -4px -4px 10px rgba(0,0,0,0.15);
      box-sizing: border-box;
    }
    .system-tools-btn-label {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 16px;
      font-weight: 700;
      color: #8B8B8B;
      white-space: nowrap;
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
      height: 43px;
      width: 165px;
      line-height: normal;
    }
    /* Selection menu — absolutely positioned under role tile */
    .selection-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: 100%;
      display: grid;
      grid-template-columns: 1fr;
      gap: 5px;
      padding: 0;
      z-index: 40;
    }
    .menu-item {
      background: #F7F8F2;
      border: none;
      cursor: pointer;
      text-align: left;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #171717;
      padding: 0 20px;
      min-height: 40px;
      min-width: 0;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0,0,0,0.15), -4px -4px 10px rgba(0,0,0,0.15);
      box-sizing: border-box;
      white-space: nowrap;
    }
    .menu-item:hover { background: #f7f7f7; }
    .menu-item.selected { color: #4e68d2; }
    /* Content area — Figma 40001177:2473 prompt-imput-textarea-container-system */
    .prompt-input-textarea-container {
      display: flex;
      gap: 5px;
      margin-top: 17px;
    }
    /* Status bar icon slot — Figma 40001177:2474 status-bar-icon-slot (40×45) */
    .status-bar-icon-slot {
      width: 40px;
      height: 45px;
      flex-shrink: 0;
      background: #F7F8F2;
    }
    /* Prompt textarea container — Figma 40001177:2476 prompt-textarea-container-system */
    .prompt-textarea-container {
      flex: 1;
      min-width: 0;
    }
    .prompt-textarea-wrapper {
      width: 100%;
      background: #FFFFFF;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0,0,0,0.15), -4px -4px 10px rgba(0,0,0,0.15);
      box-sizing: border-box;
      padding: 10px 13px;
    }
    .text-input-area {
      width: 100%;
      min-height: 25px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 16px;
      font-weight: 500;
      line-height: 25px;
      color: #767676;
      background: transparent;
      border: none;
      outline: none;
      resize: none;
      box-sizing: border-box;
    }
    .text-input-area::placeholder { color: #a3a3a3; }
    @media (prefers-reduced-motion: reduce) {
      .selection-menu { transition: none; }
    }
  `;

  render() {
    const typesMenu = this.menuOpen ? html`
      <div class="selection-menu" role="menu" @mouseleave=${() => this._closeMenu()}>
        ${SYSTEM_ROLE_MENU_TYPES.map((mt) => html`
          <button class="menu-item${this.name === mt.label ? ' selected' : ''}" role="menuitem"
                  data-action="mode" data-value="${mt.type}"
                  @click=${(e: Event) => this._onMenuSelect(e)}>${mt.label}</button>`)}
      </div>` : '';

    return html`
      <div class="responsive-prompt-container" data-tag="prompt-section" data-node-id="40001177:2458" data-section-name="${this.name}">
        <div class="section-header-system-roles" data-node-id="40001177:2460">
          <!-- Status icon — Database_fill (Figma 40001177:2461/2462) -->
          <div class="status-system-selector" data-node-id="40001177:2461">
            ${databaseFillSvg}
          </div>
          <!-- System-Role frame (Figma 40001177:2463) -->
          <div class="system-role-frame" data-node-id="40001177:2463">
            <!-- Role tile (Figma 40001177:2465/2466) -->
            <div class="role-tile-wrap">
              <div class="role-tile" data-node-id="40001177:2465" @click=${this._toggleMenu}>
                <div class="tile-label-container" data-node-id="40001177:2466">
                  <span class="tile-label" data-node-id="40001177:2467">${this.name}</span>
                </div>
                <button class="chevron-blue-closed" data-node-id="40001177:2469" title="Select role type" aria-haspopup="menu"
                        @click=${(e: Event) => { e.stopPropagation(); this._toggleMenu(); }}>
                  <img alt="" src=${arrowDropDown} />
                </button>
              </div>
              ${typesMenu}
            </div>
            <!-- System-toolsSelector-btn (Figma 40001177:2470) -->
            <div class="system-tools-btn" data-node-id="40001177:2470">
              <button class="system-tools-btn-label" data-node-id="40001177:2471" title="Functions | Tools"
                      @click=${(e: Event) => this._dispatchToolMenu(e)}>Functions | Tools</button>
            </div>
          </div>
        </div>
        <!-- Content area (Figma 40001177:2473) -->
        <div class="prompt-input-textarea-container" data-node-id="40001177:2473">
          <!-- Status bar icon slot (Figma 40001177:2474) -->
          <div class="status-bar-icon-slot" data-node-id="40001177:2474"></div>
          <!-- Prompt textarea container (Figma 40001177:2476) -->
          <div class="prompt-textarea-container" data-node-id="40001177:2476">
            <div class="prompt-textarea-wrapper">
              <textarea class="text-input-area"
                        .value=${this.content}
                        placeholder=${this.placeholder}
                        @input=${this._onInput}
                        style="min-height: ${this.minHeight}px;"></textarea>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private _toggleMenu() {
    this.menuOpen = !this.menuOpen;
    this.requestUpdate();
  }

  private _closeMenu() {
    this.menuOpen = false;
    this.requestUpdate();
  }

  private _onMenuSelect(e: Event) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const action = btn.getAttribute('data-action');
    const value = btn.getAttribute('data-value');
    this._closeMenu();
    if (action === 'mode' && value === 'department-role') {
      this.dispatchEvent(new CustomEvent('system-role-mode-change', {
        bubbles: true, composed: true, detail: { mode: 'department' },
      }));
    }
  }

  private _dispatchToolMenu(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('section-menu-select', {
      bubbles: true, composed: true, detail: { action: 'functions', value: undefined },
    }));
  }

  private _onInput(e: Event) {
    const ta = e.target as HTMLTextAreaElement;
    this.content = ta.value;
    this.dispatchEvent(new CustomEvent('section-content-input', {
      bubbles: true, composed: true, detail: { value: this.content },
    }));
    // Auto-resize
    ta.style.height = 'auto';
    ta.style.height = Math.max(this.minHeight, ta.scrollHeight) + 'px';
  }
}

if (!customElements.get('prompt-input-section-system-role')) {
  customElements.define('prompt-input-section-system-role', PromptInputSectionSystemRole);
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-input-section-system-role': PromptInputSectionSystemRole;
  }
}