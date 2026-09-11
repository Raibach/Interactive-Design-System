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
// Menu contents are the Figma component-set. Live node: 40001003:25249
// ("accordion-dropdown", open state), which carries FOUR role tiles —
// User Role · Agent Role · Tool Call · Custom Data — plus Remove and Add Section.
// "Custom Data" is the addition the older three-item menu was missing
// (the earlier node 40000934:22868 called this tile "Custom").
export const SECTION_MENU_TYPES: MenuType[] = [
  { type: 'user', label: 'User Role' },
  { type: 'agent', label: 'Agent Role' },
  { type: 'tool-call', label: 'Tool Call' },
  { type: 'custom-data', label: 'Custom Data' },
];

export const TYPE_LABELS: Record<string, string> = {
  system: 'System Role',
  user: 'User Role',
  agent: 'Agent Role',
  assistant: 'Agent Role',
  'tool-call': 'Tool Call',
  'custom-data': 'Custom Data',
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

  declare name: string;
  declare type: string;
  declare content: string;
  declare sticky: boolean;
  declare minHeight: number;
  declare menuOpen: '' | 'types' | 'functions';
  declare placeholder: string;

  constructor() {
    super();
    this.name = '';
    this.type = 'custom';
    this.content = '';
    this.sticky = false;
    this.minHeight = 45;
    this.menuOpen = '';
    this.placeholder = 'Select a role and enter your prompt.';
  }

  static styles = css`
    :host {
      /* Hugs its content — no forced height. */
      display: block;
      flex: 0 0 auto;
      width: 100%;
      background: #ffffff;
      border-radius: 6px;
      box-sizing: border-box;
    }
    :host([draggable]) { cursor: grab; }
    .responsive-prompt-container {
      /* Figma 40000878:241 — px-3 py-[15px]. The top pad is dropped: the first
         section must sit flush under the pane title. The bottom 15px still gives
         the gap between stacked sections. */
      padding: 0 3px 15px;
      box-sizing: border-box;
    }
    .section-header {
      display: flex;
      /* Figma 40000954-23927 — gap-[5px] (refined sections 3–4) */
      gap: 5px;
      align-items: center;
      height: 40px;
      box-sizing: border-box;
    }
    .prompt-accordion {
      flex: 1;
      min-width: 0;
      height: 40px;
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
    /* Figma 40000909:4005 "functions" — 177.039×43, bg #fff, radius 6,
       shadow -4px -4px 5px rgba(0,0,0,.15) + 4px 4px 5px rgba(0,0,0,.15).
       This is the exact shell the "Functions / Tools" label sits in.
       (Rebuilt in Figma 2026-09-11: this tile and its accordion moved from the
       40000879 / 40000746 namespace to 40000909; the old ids now return nothing
       from either channel. Geometry is unchanged, to the third decimal.) */
    .functions-wrap {
      position: relative;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 171px;
      height: 40px;
      background: #ffffff;
      border-radius: 6px;
      box-sizing: border-box;
      box-shadow: -4px -4px 5px rgba(0,0,0,0.15), 4px 4px 5px rgba(0,0,0,0.15);
    }
    /* Figma 40001003:25249 "accordion-dropdown" (live node, open state) — a
       TWO-COLUMN grid of white tile-cards with 5px gaps. Container itself has no
       fill in the design; each tile carries its own white card + drop shadow.
       Tiles: User Role · Agent Role · Tool Call · Custom Data · Remove ·
       Add Section · Placeholder row.

       SIZING (owner instruction, overrides the node's fixed 379px): the menu is
       absolutely positioned inside .role-tile-wrap, which is flex:1 0 0. Using
       width:100% makes it track the role tile exactly, so both the columns and
       the rows expand with the left column like the role/accordion tiles do. */
    .selection-menu {
      position: absolute;
      top: calc(100% + 4px);
      left: 0;
      width: 100%;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      padding: 0;
      z-index: 40;
    }
    .menu-item {
      /* role-dropdown-tile: #FFFFFF, radius 6, "button drop" shadow.
         min-height (not height) so the rows expand with their content, and
         min-width:0 so the tiles can shrink with a narrow column. */
      background: #ffffff;
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
    .menu-item.danger { color: #c50000; }
    /* role-dropdown-tile.dropdown-bottom (node 40001003:25282) — a full-width
       tile, same card/shadow/radius, label in #8B8B8B (fill_fa023af3).
       Built verbatim from the design; it is not hoverable. */
    .menu-item.placeholder {
      grid-column: 1 / -1;
      color: #8b8b8b;
      cursor: default;
    }
    .menu-item.placeholder:hover { background: #ffffff; }
    .functions-label-text {
      font-size: 16px;
      font-weight: 700;
      line-height: 19.364px;
      color: #8b8b8b;
      background: none;
      border: none;
      cursor: pointer;
      /* Figma 40000909-4323 — h-[43px] w-[165px] inside the 40px tile (quirk preserved verbatim) */
      height: 43px;
      width: 165px;
      padding: 0;
      font-family: 'Inter', system-ui, sans-serif;
      white-space: nowrap;
    }
    /* Figma 40000909-4323 — " | " separator is light weight inside "Functions | Tools" */
    .functions-label-text .functions-sep {
      font-weight: 300;
    }
    .prompt-imput {
      display: flex;
      /* flex-start: the textarea hugs its own auto-grown height. */
      align-items: flex-start;
      gap: 5px;
      margin-top: 17px;
    }
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
        <button class="menu-item danger" role="menuitem" data-action="delete"
                @click=${(e: Event) => this._onMenuSelect(e)}>Remove</button>
        <button class="menu-item" role="menuitem" data-action="add"
                @click=${(e: Event) => this._onMenuSelect(e)}>Add Section</button>
        <div class="menu-item placeholder" role="presentation">Placeholder row</div>
      </div>` : '';

    const functionsMenu = menuOpen === 'functions' ? html`
      <div class="selection-menu" role="menu">
        ${PRELABELED_TOOLS.map((tool) => html`
          <button class="menu-item" role="menuitem" data-action="tool" data-value="${tool.token}"
                  @click=${(e: Event) => this._onMenuSelect(e)}>${tool.name}</button>`)}
      </div>` : '';

    // Activity rail — a SINGLE lightning. The Figma rail (40000746-94) carries a
    // database glyph on top plus three lightnings ("Database + purple lightning +
    // 2 dark lightnings"); the owner asked for those to be trimmed down to one
    // lightning. This is an intentional deviation from the Figma source, not a
    // design-system value — re-add kinds here if the full rail is wanted back.
    const railIcons: string[] = ['lightning'];

    return html`
      <div class="responsive-prompt-container" data-tag="prompt-section" data-node-id="40000746:94" data-section-name="${this.name}">
        <div class="section-header" data-node-id="40000746:102">
          <gripper-prompt-input ?active=${!isSticky}></gripper-prompt-input>
          <div class="prompt-accordion" data-node-id="40000909:3998">
            <div class="role-tile-wrap" data-node-id="40000909:3999">
              <role-tile
                .label=${this.name}
                .showMenu=${!isSticky}
                @role-menu-toggle=${(e: Event) => this._toggleMenu(e, 'types')}
                @role-tile-collapse-toggle=${this._onCollapseToggle}
              ></role-tile>
              ${typesMenu}
            </div>
            <div class="functions-wrap" data-node-id="40000909:4005">
              <button class="functions-label-text" data-node-id="40000909:4006" title="Functions | Tools"
                      @click=${(e: Event) => this._toggleMenu(e, 'functions')}>Functions<span class="functions-sep"> | </span>Tools</button>
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
    this.requestUpdate();
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
