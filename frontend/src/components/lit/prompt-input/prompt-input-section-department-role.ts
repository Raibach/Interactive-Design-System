/**
 * <prompt-input-section-department-role> — Figma 40001177:2598 / responsive-prompt-container
 * Department Role seat: appears when "Department Role" selected from System Role dropdown.
 * Header: status icon (Database_fill) + role-tile ("Department Role" with chevron) + Functions | Tools button.
 * Body: status-bar-icon-slot (empty) + prompt-textarea-container-system ("Enter prompt text.").
 *
 * Dropdown menu offers departments: Design / Accounting / Product / Engineering / Marketing.
 * Selecting "Design" auto-populates SOP and emits department-role-change { department: 'Design', addSeats: ['UX Design', 'Design Requirement'] }.
 * Other departments emit department-role-change { department: '<name>', addSeats: [] }.
 */
import { LitElement, html, css, nothing } from 'lit';
import { databaseFillSvg } from './prompt-icons';
// The dropdown chevron, INLINE: no path, no name, nothing can resolve it. It used to be the file
// `assets/figma-9598a83b….svg` — an image in an assets folder, loadable by name from anywhere.
const arrowDropDown = "data:image/svg+xml;utf8,<svg preserveAspectRatio='none' overflow='visible' style='display: block;' width='14' height='13' viewBox='0 0 14 13' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='Arrow_drop_down'><rect x='0.5' y='0.5' width='13' height='12' rx='0.5' stroke='%234E68D2'/><path id='Vector 10' d='M6.80794 9.76953L3.09346 5.31215C2.65924 4.79109 3.02976 4 3.70803 4L10.292 4C10.9702 4 11.3408 4.79108 10.9065 5.31215L7.19206 9.76953C7.09211 9.88947 6.90789 9.88947 6.80794 9.76953Z' fill='%234E68D2'/></g></svg>";

/** Department options with their auto-added seats. */
const DEPARTMENTS = [
  { name: 'Design', addSeats: ['UX Design', 'Design Requirement'], sop: 'Design SOP: Follow the design system guidelines. Create user-centered designs. Document design decisions.' },
  { name: 'Accounting', addSeats: [], sop: 'Accounting SOP: Follow GAAP principles. Ensure accuracy in financial reporting. Document all transactions.' },
  { name: 'Product', addSeats: [], sop: 'Product SOP: Define clear product requirements. Prioritize by user impact. Validate with stakeholders.' },
  { name: 'Engineering', addSeats: [], sop: 'Engineering SOP: Write clean, maintainable code. Follow coding standards. Document architectural decisions.' },
  { name: 'Marketing', addSeats: [], sop: 'Marketing SOP: Align with brand voice. Measure campaign performance. Optimize based on data.' },
] as const;

export class PromptInputSectionDepartmentRole extends LitElement {
  static properties = {
    name: { type: String },
    content: { type: String },
    placeholder: { type: String },
    minHeight: { type: Number, attribute: 'min-height' },
    menuOpen: { type: Boolean, attribute: 'menu-open' },
    department: { type: String },
  };

  declare name: string;
  declare content: string;
  declare placeholder: string;
  declare minHeight: number;
  declare menuOpen: boolean;
  declare department: string;

  constructor() {
    super();
    this.name = 'Department Role';
    this.content = '';
    this.placeholder = 'Enter department role instruction…';
    this.minHeight = 45;
    this.menuOpen = false;
    this.department = '';
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
      /* Figma 40001177:2598 responsive-prompt-container — padding 15/3/15/3 */
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
    /* Status icon — Figma 40001177:2600 status-system-slector-default */
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
    /* System-Role frame — Figma 40001177:2602 */
    .system-role-frame {
      flex: 1;
      display: flex;
      gap: 5px;
      align-items: center;
      height: 40px;
      min-width: 0;
    }
    /* Role tile — Figma 40001177:2604 role-tile (379×40) */
    .role-tile-wrap {
      position: relative;
      flex: 1 0 0;
      min-width: 0;
      display: flex;
    }
    .role-tile {
      /* Figma 40001177:2605 tile-label + 40001177:2604 role-tile */
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
    /* System-toolsSelector-btn — Figma 40001177:2609 (171×40) */
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
    /* Content area — Figma 40001177:2612 prompt-imput-textarea-container */
    .prompt-input-textarea-container {
      display: flex;
      gap: 5px;
      margin-top: 17px;
    }
    /* Status bar icon slot — Figma 40001177:2613 status-bar-icon-slot (40×45) */
    .status-bar-icon-slot {
      width: 40px;
      height: 45px;
      flex-shrink: 0;
      background: #F7F8F2;
    }
    /* Prompt textarea container — Figma 40001177:2615 prompt-textarea-container-system */
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
        ${DEPARTMENTS.map((dept) => html`
          <button class="menu-item${this.department === dept.name ? ' selected' : ''}" role="menuitem"
                  data-action="department" data-value="${dept.name}"
                  @click=${(e: Event) => this._onMenuSelect(e, dept)}>${dept.name}</button>`)}
      </div>` : '';

    return html`
      <div class="responsive-prompt-container" data-tag="prompt-section" data-node-id="40001177:2598" data-section-name="${this.name}">
        <div class="section-header-system-roles" data-node-id="40001177:2599">
          <!-- Status icon — Database_fill (Figma 40001177:2600/2601) -->
          <div class="status-system-selector" data-node-id="40001177:2600">
            ${databaseFillSvg}
          </div>
          <!-- System-Role frame (Figma 40001177:2602) -->
          <div class="system-role-frame" data-node-id="40001177:2602">
            <!-- Role tile (Figma 40001177:2604/2605) -->
            <div class="role-tile-wrap">
              <div class="role-tile" data-node-id="40001177:2604" @click=${this._toggleMenu}>
                <div class="tile-label-container" data-node-id="40001177:2605">
                  <span class="tile-label" data-node-id="40001177:2606">${this.name}</span>
                </div>
                <button class="chevron-blue-closed" data-node-id="40001177:2608" title="Select department" aria-haspopup="menu"
                        @click=${(e: Event) => { e.stopPropagation(); this._toggleMenu(); }}>
                  <img alt="" src=${arrowDropDown} />
                </button>
              </div>
              ${typesMenu}
            </div>
            <!-- System-toolsSelector-btn (Figma 40001177:2609) -->
            <div class="system-tools-btn" data-node-id="40001177:2609">
              <button class="system-tools-btn-label" data-node-id="40001177:2610" title="Functions | Tools"
                      @click=${(e: Event) => this._dispatchToolMenu(e)}>Functions | Tools</button>
            </div>
          </div>
        </div>
        <!-- Content area (Figma 40001177:2612) -->
        <div class="prompt-input-textarea-container" data-node-id="40001177:2612">
          <!-- Status bar icon slot (Figma 40001177:2613) -->
          <div class="status-bar-icon-slot" data-node-id="40001177:2613"></div>
          <!-- Prompt textarea container (Figma 40001177:2615) -->
          <div class="prompt-textarea-container" data-node-id="40001177:2615">
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

  // `typeof DEPARTMENTS[0]` is the type of the FIRST element — the Design entry — and
  // nothing else. So the menu could only hand this method the one department it happens
  // to list first, and every other button in it was a type error. `(typeof DEPARTMENTS)[number]`
  // is the union of what the array actually holds, which is what the menu passes.
  private _onMenuSelect(e: Event, dept: (typeof DEPARTMENTS)[number]) {
    e.stopPropagation();
    this.department = dept.name;
    this._closeMenu();
    // Auto-populate SOP for Design department
    if (dept.name === 'Design' && !this.content) {
      this.content = dept.sop;
    }
    this.dispatchEvent(new CustomEvent('department-role-change', {
      bubbles: true, composed: true, detail: { department: dept.name, addSeats: dept.addSeats, sop: dept.sop },
    }));
    this.dispatchEvent(new CustomEvent('section-content-input', {
      bubbles: true, composed: true, detail: { value: this.content },
    }));
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

if (!customElements.get('prompt-input-section-department-role')) {
  customElements.define('prompt-input-section-department-role', PromptInputSectionDepartmentRole);
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-input-section-department-role': PromptInputSectionDepartmentRole;
  }
}