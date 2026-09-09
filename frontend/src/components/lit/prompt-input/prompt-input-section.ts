/**
 * <prompt-input-section> — Figma 40000746-94 / prompt-input-section
 * One prompt row: gripper + prompt-accordion (role-tile + functions) + prompt-imput
 * (status-bar-prompt-input + prompt-textarea). data-tag="prompt-section".
 *
 * Designer rules implemented here:
 *  - sticky=true  → System Role: always first, never changes. No menu, not
 *    draggable, not deletable, nothing displaces slot 0.
 *  - Arrow_drop_down opens/closes the selection menu: role types + "+ Add Section"
 *    + "Delete". Selecting a type updates the label automatically.
 *  - Functions / Tools is pre-labeled; choosing a tool injects its variable token.
 *  - Role-tile label click toggles the accordion body (collapse/expand).
 *  - Drag is anchored to the gripper only.
 *
 * Properties: name, type, content, sticky, minHeight, menuOpen ('types'|'functions'|''),
 *             placeholder.
 * Events (composed, consumed by <prompt-section-editor>):
 *   `section-content-input` {value} · `section-menu-select` {action, value?} ·
 *   `section-collapse-toggle` {collapsed}
 */
import { LitElement, html, css } from 'lit';
import './gripper-prompt-input';
import './role-tile';
import './status-bar-prompt-input';
import './prompt-textarea';

export interface MenuType { type: string; label: string }

// System is deliberately absent — it is sticky and has no menu.
export const SECTION_MENU_TYPES: MenuType[] = [
  { type: 'user', label: 'User Role' },
  { type: 'agent', label: 'Agent Role' },
  { type: 'tool-call', label: 'Tool Call' },
  { type: 'few-shot', label: 'Few Shot' },
  { type: 'context', label: 'Context' },
  { type: 'constraints', label: 'Constraints' },
  { type: 'custom', label: 'Custom' },
];

export const TYPE_LABELS: Record<string, string> = {
  system: 'System Role',
  user: 'User Role',
  agent: 'Agent Role',
  assistant: 'Agent Role',
  'tool-call': 'Tool Call',
  'few-shot': 'Few Shot',
  context: 'Context',
  constraints: 'Constraints',
  custom: 'Custom',
};

// Pre-labeled Functions / Tools — from the wireframe's own Tool Call example
// (node 40000747-217). Extend in Figma + here; never free-typed by the AI.
export const PRELABELED_TOOLS: Array<{ name: string; token: string }> = [
  { name: 'generate_solar_system_design', token: '{{tool:generate_solar_system_design}}' },
];

export class PromptInputSection extends LitElement {
  static properties = {
    name: { type: String },
    type: { type: String },
    content: { type: String },
    sticky: { type: Boolean },
    minHeight: { type: Number, attribute: 'min-height' },
    menuOpen: { type: String, attribute: 'menu-open' },
    placeholder: { type: String },
  };

  name = '';
  type = 'custom';
  content = '';
  sticky = false;
  minHeight = 45;
  menuOpen: '' | 'types' | 'functions' = '';
  placeholder = 'Select a role and enter your prompt.';

  static styles = css`
    :host {
      display: block;
      width: 100%;
      background: #ffffff;
      border-radius: 6px;
      box-sizing: border-box;
    }
    :host([draggable]) { cursor: grab; }
    .responsive-prompt-container {
      /* Figma 40000878:241 — padding top/bottom 15px, left/right 3px (px-3 py-4.5 … py-[15px]) */
      padding: 15px 3px;
      box-sizing: border-box;
    }
    .section-header {
      display: flex;
      /* Figma 40000746:102: items-center (rows center vertically within the 43px header) */
      align-items: center;
      height: 43px;
      box-sizing: border-box;
    }
    .prompt-accordion {
      flex: 1;
      min-width: 0;
      height: 43px;
      display: flex;
      /* Figma 40000880:345 — gap-[10px] + items-center */
      align-items: center;
      gap: 10px;
      position: relative;
    }
    .role-tile-wrap {
      /* Figma 40000880:346 — role-tile flex-[1_0_0]: grows to fill accordion remainder;
         functions stays fixed 177.039 on the right. */
      position: relative;
      flex: 1 0 0;
      min-width: 0;
      display: flex;
    }
    /* Figma 40000879:249 "functions" — 177.039×43, bg #fff, radius 6,
       shadow -4px -4px 5px rgba(0,0,0,.15) + 4px 4px 5px rgba(0,0,0,.15).
       This is the exact shell the "Functions / Tools" label sits in. */
    .functions-wrap {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 177.039px;
      height: 43px;
      background: #ffffff;
      border-radius: 6px;
      box-sizing: border-box;
      box-shadow: -4px -4px 5px rgba(0,0,0,0.15), 4px 4px 5px rgba(0,0,0,0.15);
    }
    .selection-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      min-width: 200px;
      background: #ffffff;
      border: 1px solid #e5e5e5;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0,0,0,0.15), -4px -4px 10px rgba(0,0,0,0.15);
      padding: 4px;
      z-index: 40;
      display: flex;
      flex-direction: column;
    }
    .menu-item {
      background: none;
      border: none;
      cursor: pointer;
      text-align: left;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #171717;
      padding: 8px 10px;
      border-radius: 4px;
      white-space: nowrap;
    }
    .menu-item:hover { background: #fff7e6; }
    .menu-item.selected { color: #4e68d2; }
    .menu-item.danger { color: #991b1b; }
    .functions-label-text {
      font-size: 16px;
      font-weight: 700;
      line-height: 19.364px;
      color: #8b8b8b;
      background: none;
      border: none;
      cursor: pointer;
      /* Figma 40000879:250 — centered text inside the 177.039px "functions" shell */
      padding: 0;
      font-family: 'Inter', system-ui, sans-serif;
      white-space: nowrap;
    }
    .prompt-imput {
      display: flex;
      align-items: flex-start;
      margin-top: 17px;
    }
    .prompt-imput prompt-textarea { margin-left: 6px; }
    :host([collapsed]) .prompt-imput { display: none; }
  `;

  render() {
    const t = String(this.type || 'custom').toLowerCase();
    const isSticky = this.sticky;
    const menuOpen = this.menuOpen;

    const typesMenu = !isSticky && menuOpen === 'types' ? html`
      <div class="selection-menu" role="menu">
        ${SECTION_MENU_TYPES.map((mt) => html`
          <button class="menu-item${t === mt.type ? ' selected' : ''}" role="menuitem"
                  data-action="type" data-value="${mt.type}"
                  @click=${(e: Event) => this._onMenuSelect(e)}>${mt.label}</button>`)}
        <div class="menu-separator"></div>
        <button class="menu-item" role="menuitem" data-action="add"
                @click=${(e: Event) => this._onMenuSelect(e)}>+ Add Section</button>
        <button class="menu-item danger" role="menuitem" data-action="delete"
                @click=${(e: Event) => this._onMenuSelect(e)}>Delete</button>
      </div>` : '';

    const functionsMenu = menuOpen === 'functions' ? html`
      <div class="selection-menu" role="menu">
        ${PRELABELED_TOOLS.map((tool) => html`
          <button class="menu-item" role="menuitem" data-action="tool" data-value="${tool.token}"
                  @click=${(e: Event) => this._onMenuSelect(e)}>${tool.name}</button>`)}
      </div>` : '';

    const isRag = t.includes('context') || /\{\{\s*(retrieved_context|query|context)\s*\}\}/.test(this.content || '');
    const isTool = t.includes('tool') || /\{\{\s*tool:/i.test(this.content || '');
    const railIcons: string[] = [];
    if (isRag) railIcons.push('database');
    if (isTool) railIcons.push('database');

    return html`
      <div class="responsive-prompt-container" data-tag="prompt-section" data-node-id="40000746:94" data-section-name="${this.name}">
        <div class="section-header" data-node-id="40000746:102">
          <gripper-prompt-input ?active=${!isSticky}></gripper-prompt-input>
          <div class="prompt-accordion" data-node-id="40000879:252">
            <div class="role-tile-wrap" data-node-id="40000746:106">
              <role-tile
                .label=${this.name}
                .showMenu=${!isSticky}
                @role-menu-toggle=${(e: Event) => this._toggleMenu(e, 'types')}
                @role-tile-collapse-toggle=${this._onCollapseToggle}
              ></role-tile>
              ${typesMenu}
            </div>
            <div class="functions-wrap" data-node-id="40000879:249">
              <button class="functions-label-text" data-node-id="40000879:250" title="Functions / Tools"
                      @click=${(e: Event) => this._toggleMenu(e, 'functions')}>Functions / Tools</button>
              ${functionsMenu}
            </div>
          </div>
        </div>
        <div class="prompt-imput" data-node-id="40000878:240">
          <status-bar-prompt-input .icons=${railIcons}></status-bar-prompt-input>
          <prompt-textarea
            .value=${this.content}
            .placeholder=${this.placeholder}
            .minHeight=${this.minHeight}
            @value-input=${this._onContentInput}
          ></prompt-textarea>
        </div>
      </div>
    `;
  }

  private _toggleMenu(e: Event, kind: 'types' | 'functions') {
    e.stopPropagation();
    this.menuOpen = this.menuOpen === kind ? '' : kind;
  }

  private _onCollapseToggle(_e: Event) {
    this.dispatchEvent(new CustomEvent('section-collapse-toggle', {
      bubbles: true, composed: true, detail: {},
    }));
  }

  private _onContentInput(e: CustomEvent) {
    this.content = (e.detail as { value: string }).value;
    this.dispatchEvent(new CustomEvent('section-content-input', {
      bubbles: true, composed: true, detail: { value: this.content },
    }));
  }

  private _onMenuSelect(e: Event) {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLElement;
    const action = btn.getAttribute('data-action');
    const value = btn.getAttribute('data-value') || undefined;
    this.menuOpen = '';
    this.dispatchEvent(new CustomEvent('section-menu-select', {
      bubbles: true, composed: true, detail: { action, value },
    }));
  }
}

if (!customElements.get('prompt-input-section')) {
  customElements.define('prompt-input-section', PromptInputSection);
}

declare global {
  interface HTMLElementTagNameMap {
    'prompt-input-section': PromptInputSection;
  }
}
