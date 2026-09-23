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
 *  - A prompt that carries a FORM flags itself: an empty `required` field, or a form
 *    with no values at all, turns the notice above the field red and rings the
 *    field. The flag is read from this section's own content (see
 *    @/shared/repairMaterial) — the same text Run sends — so it cannot describe a
 *    state the prompt is not in.
 *  - The activity rail is the notification column: while this section is waiting on
 *    a person it carries an `!` in a circle beside the lightning. Same source as the
 *    red flag above, so a red field and a marked rail are the same fact.
 *
 * Properties: name, type, content, sticky, minHeight, menuOpen ('types'|'functions'|''),
 *             placeholder.
 * Events (composed, consumed by <prompt-section-editor>):
 *   `section-content-input` {value} · `section-menu-select` {action, value?} ·
 *   `section-collapse-toggle` {collapsed}
 */
import { LitElement, html, css, nothing } from 'lit';
import './gripper-prompt-input';
import './role-tile';
import './status-bar-prompt-input';
import './prompt-textarea';
import {
  SECTION_MENU_TYPES as SHARED_MENU_TYPES,
  SECTION_TYPE_LABELS,
} from '@/shared/promptSections';
import { repairPromptFlag } from '@/shared/repairMaterial';

/**
 * One tile in the seat menu. `description` is not drawn on the tile — it is the
 * fly-out beside it, and the same sentence the chat posts when the seat is picked.
 */
export interface MenuType { type: string; label: string; description: string }

// System is deliberately absent — it is sticky and has no menu.
// The Figma component-set (live node 40001003:25249, "accordion-dropdown") drew
// FOUR role tiles — User Role · Agent Role · Tool Call · Custom Data — while the
// declaration in @/shared/promptSections has since grown three more: Few Shot,
// Constraints and Context were declared and never given a tile, and Custom Data
// is now Custom Skill. The list is derived from that declaration rather than
// retyped here, so the drawing no longer decides what a person may choose.
export const SECTION_MENU_TYPES: MenuType[] = SHARED_MENU_TYPES;

/**
 * id (and every legacy spelling) → the label shown on the row.
 *
 * Declared in @/shared/promptSections alongside the ids, so a label can no
 * longer drift from the seat it names. The old copy here had ten keys for eight
 * ideas and no link to the schema enum.
 */
export const TYPE_LABELS: Record<string, string> = SECTION_TYPE_LABELS;

// Pre-labeled Functions / Tools — from the wireframe's own Tool Call example
// (node 40000747-217). Extend in Figma + here; never free-typed by the AI.
//
// THIS IS THE FALLBACK, NOT THE LIST. The real tools come from the server and
// arrive on the `tools` property, because a tool is a row someone can add or
// change without a deploy. This single example is drawn only until the server
// answers — an empty menu would say "there are no tools" when the truth is
// "the list has not arrived yet", and those are different claims.
export const PRELABELED_TOOLS: Array<{ name: string; token: string }> = [
  { name: 'generate_solar_system_design', token: '{{tool:generate_solar_system_design}}' },
];

/**
 * A TOOL MARKED THIS BELONGS TO EVERY SECTION.
 *
 * Most tools belong to one or two seats — the composer's rules belong with the
 * agent, a lookup belongs where calls are made. A few belong anywhere: something
 * that answers a question is as useful while writing the system role as while
 * writing the user role. Rather than list every seat on such a tool and keep that
 * list in step with the schema, it is marked with this and drawn everywhere.
 */
export const ALL_SECTIONS = '*';

export class PromptInputSection extends LitElement {
  static properties = {
    name: { type: String },
    type: { type: String },
    content: { type: String },
    sticky: { type: Boolean },
    minHeight: { type: Number, attribute: 'min-height' },
    menuOpen: { type: String, attribute: 'menu-open' },
    placeholder: { type: String },
    /** The tools the server offers. Undefined = not answered yet; [] = none. */
    tools: { type: Array },  };

  declare name: string;
  declare type: string;
  declare content: string;
  declare sticky: boolean;
  declare minHeight: number;
  declare menuOpen: '' | 'types' | 'functions';
  declare placeholder: string;
  declare tools: Array<{ name: string; token: string; sections?: string[]; summary?: string }> | undefined;

  /**
   * WHICH SEAT'S DESCRIPTION IS SHOWING, if any, and WHERE TO DRAW IT.
   *
   * Not a reactive property, so a write does not schedule a render by itself —
   * every write goes through _showTip, which asks for the update.
   *
   * THE BOX IS STORED, NOT MEASURED AT RENDER TIME, and the tip is drawn
   * `position: fixed` from it. Both are the same decision: the tip has to float
   * free of the prompt column. That column's body is an `overflow: auto` scroller,
   * so anything absolutely positioned inside it is CLIPPED at the scroll box — the
   * tip was drawn under the chat and cut off at the column edge. Fixed positioning
   * resolves against the viewport and ignores every ancestor's overflow, and taking
   * the coordinates at hover time is what lets it be fixed rather than absolute.
   */
  private _tipType = '';
  /** The card's anchored edge: the seats' card grows right, a tool's grows left. */
  private _tipBox: { left?: number; right?: number; top: number } | null = null;

  /**
   * THE TOOL TIP, ON THE OTHER SIDE.
   *
   * `_tip` holds the words — a tool's name and its one line — and `_tipBox` is
   * shared with the seat tips, because only one card is ever up at a time. What
   * differs is the EDGE IT IS ANCHORED TO: the seats' card grows rightward from
   * the menu, and a tool's card grows LEFTWARD, because the tools menu is at the
   * right-hand end of the row and a card on its right would run off the column.
   *
   * So the box carries `right` instead of `left` for that side, and the style is
   * built from whichever edge is set. Measuring the card's width instead would
   * hard-code a number that changes with its content.
   */
  private _tip: { title: string; body: string } | null = null;

  /**
   * Show a seat's description, or clear it when `type` is empty.
   *
   * ONE PLACE, EVERY TIME: the card appears under the Functions | Tools button
   * and to the right of the menu items, whichever tile the pointer is on. Only
   * the words change. A card that followed the pointer would move while it was
   * being read and would land differently for a tile on the left of the grid
   * than for one on the right; a fixed spot is a place a person learns once.
   *
   * The box comes from the accordion's bottom edge (the row the button sits in)
   * and the menu's right edge, so it sits in the corner the layout already
   * leaves empty rather than over the tiles it is describing.
   */
  private _showTip(type: string): void {
    if (type) {
      const accordion = this.shadowRoot?.querySelector('.prompt-accordion') as HTMLElement | null;
      const anchor = this.shadowRoot?.querySelector('.role-tile-wrap') as HTMLElement | null;
      if (accordion && anchor) {
        const row = accordion.getBoundingClientRect();
        const menu = anchor.getBoundingClientRect();
        this._tipBox = { left: Math.round(menu.right + 10), top: Math.round(row.bottom + 4) };
      }
    } else {
      this._tipBox = null;
    }
    this._tipType = type;
    this._tip = null; // one card at a time — the other menu's is cleared
    this.requestUpdate();
  }

  /**
   * THE SAME CARD, ON THE OTHER SIDE, FOR A TOOL.
   *
   * The tools menu is the right-hand end of the row, so the seats' card — which
   * grows rightward from the menu — would run off the column. This one is anchored
   * to the menu's LEFT edge instead, and grows leftward into the space the prompt
   * body already occupies. Same place every time, like the seat card: only the
   * words change.
   *
   * `right` rather than a computed `left`, because the card's width depends on how
   * long the tool's line is; measuring it would mean reading layout in a render.
   * Anchoring the edge that does not move is what makes that unnecessary.
   */
  private _showToolTip(toolName: string): void {
    const menu = this.shadowRoot?.querySelector('.selection-menu') as HTMLElement | null;
    const tool = (this.tools ?? []).find((t) => t.name === toolName);
    if (!menu || !tool) return;
    const box = menu.getBoundingClientRect();
    this._tipType = '';
    this._tip = { title: tool.name, body: tool.summary || '' };
    this._tipBox = {
      right: Math.round(window.innerWidth - box.left + 10),
      top: Math.round(box.top),
    };
    this.requestUpdate();
  }

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
      /* Figma 40000746:94 — padding 15/3/15/3, as the file has it (the top pad was dropped
         here on the reasoning that the first section should sit flush under the pane title;
         the file never said that, and the check holds the element against the node it
         names). */
      padding: 15px 3px;
      box-sizing: border-box;
    }
    .section-header {
      display: flex;
      /* Figma 40000746:102 — itemSpacing 0, as the file has it. The 5px that stood here
         cited 40000954:23927, a node that is NOT in the file any more, so the value came
         from a drawing nobody can look at. */
      gap: 0;
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
      /* #40000909:4005 — 177.039x43 in the file (the comment above already states it;
         the declaration had kept the pre-rebuild 171x40). */
      width: 177.04px;
      height: 43px;
      background: #ffffff;
      border-radius: 6px;
      box-sizing: border-box;
      box-shadow: -4px -4px 5px rgba(0,0,0,0.15), 4px 4px 5px rgba(0,0,0,0.15);
      /* The width is the one thing here that moves — see .functions-open below. */
      transition: width 240ms cubic-bezier(0.4, 0, 0.2, 1);
    }
    /*
     * THE HORIZONTAL ACCORDION. Opening the tools widens this side, and the role
     * tile gives up the room — it does not need a rule of its own, because
     * .role-tile-wrap is flex: 1 0 0 and simply takes what is left.
     *
     * WHY IT IS NEEDED. The menu below is width: 100% of this wrap, so with the
     * closed 177px it drew a two-column grid of 86px cells and every tool name
     * was cut off at the tile edge — search-the-internet read search-the-inter.
     * A menu that cannot show the name of the thing it is offering is a menu that
     * cannot be used.
     *
     * 46% rather than a pixel width so it holds on a docked column as well as a
     * wide one: the tile shrinks with the column instead of overflowing it.
     */
    .prompt-accordion.functions-open .functions-wrap {
      width: 46%;
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
    /*
     * THE SEAT'S DESCRIPTION — a floating card, not a box in the menu.
     *
     * Fixed positioning is the whole point. The prompt column's body is an
     * overflow-auto scroller, so an absolutely positioned card is clipped at
     * that scroll box; and anything painted inside the left pane sits under the
     * chat column however high its z-index, because the panes are separate
     * stacking contexts and the chat comes later in paint order. Fixed resolves
     * against the viewport and ignores both — it floats over everything.
     *
     * The coordinates come from the tile's own rect, taken when the pointer
     * arrived (see _showTip), so it sits beside the tile that earned it rather
     * than at a position guessed at render time.
     *
     * It does not take pointer events: a card that can be hovered is a card that
     * can steal the hover that opened it, and this one only has to be read.
     */
    .seat-tip {
      position: fixed;
      /*
       * THE BROWSER'S OWN POPOVER RULES HAVE TO BE CANCELLED FIRST.
       *
       * A [popover] gets inset: 0 and margin: auto from the user-agent
       * stylesheet, which CENTRES it in the viewport — measured: a card told to
       * sit at 1026 drew at 1302, and its top moved between one tile and the next
       * because the two had different heights and auto margins split the
       * difference. inset: auto and margin: 0 hand positioning back to the
       * left/top this element sets inline.
       */
      inset: auto;
      margin: 0;
      width: 288px;
      background: #ffffff;
      border-radius: 6px;
      padding: 12px 14px;
      /* Deeper and softer than the menu tiles' button drop, because this floats
         further from the surface than they do. */
      box-shadow: 0 8px 26px rgba(0, 0, 0, 0.18), 0 2px 6px rgba(0, 0, 0, 0.10);
      z-index: 9999;
      pointer-events: none;
    }
    .seat-tip-title {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #171717;
      margin-bottom: 6px;
    }
    .seat-tip-body {
      margin: 0;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 1.45;
      color: #4b5563;
    }
    .functions-label-text {
      font-size: 16px;
      font-weight: 700;
      /* #40000909:4006 - the file states lineHeight AUTO (the font's normal); the
         declaration had kept the previous build's 19.364px. */
      line-height: normal;
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
    /* Figma 40000909-4323 — " | " separator is light weight inside "Functions | Tools". Drawn
       at 500: Medium is the floor weight of this app (owner, 2026-09-18). */
    .functions-label-text .functions-sep {
      font-weight: 500;
    }
    .prompt-imput {
      display: flex;
      /* flex-start: the textarea hugs its own auto-grown height. */
      align-items: flex-start;
      /* #40000878:240 — itemSpacing 6 in the file (was 5). */
      gap: 6px;
      margin-top: 17px;
    }
    :host([collapsed]) .prompt-imput { display: none; }
    /* The flag, above the field it is about.
       Neutral = the app filled what it could and Run only has to confirm it.
       Red = the prompt cannot be run into a result yet: a required field is
       empty, or the form holds no values. The red is an alpha of the menu's own
       danger colour (#c50000, .menu-item.danger), so no new palette enters the
       system for a state the design never drew. */
    .prompt-flag {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      margin: 10px 0 -9px;
      padding: 5px 8px;
      border-radius: 4px;
      border-left: 4px solid #8b8b8b;
      background: #f7f7f7;
      color: #404040;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 600;
      line-height: 16px;
    }
    .prompt-flag--blocked {
      border-left-color: #c50000;
      background: rgba(197, 0, 0, 0.07);
      color: #c50000;
    }
    .prompt-flag-mark { font-weight: 700; }
    .prompt-flag-text { min-width: 0; }
    :host([collapsed]) .prompt-flag { display: none; }
    /* The ring, not a border: an outline takes no space, so the field's geometry
       is exactly the design's whether the ring is drawn or not. */
    prompt-textarea[needs-input] {
      outline: 2px solid #c50000;
      outline-offset: 3px;
    }
    /* The accordion is a movement, so it is the first thing that should stop
       moving when someone has asked the system not to move things. */
    @media (prefers-reduced-motion: reduce) {
      .functions-wrap { transition: none; }
    }
  `;

  render() {
    const t = String(this.type || 'custom').toLowerCase();
    const isSticky = this.sticky;
    const menuOpen = this.menuOpen;

    // WHAT A SEAT IS FOR, shown while the pointer rests on its tile.
    //
    // The menu draws the names of the seats and nothing else — "Few Shot",
    // "Constraints" — and a person who has not been taught the vocabulary has no
    // way to tell what choosing one will do to their prompt. The words are the
    // same ones the chat uses when a seat is picked (see _onMenuSelect in the
    // editor), so the tile and the reply agree rather than being two accounts.
    //
    // It is a card this element draws itself rather than a browser tooltip: a
    // `title` attribute is slow, unstyled, and unreadable in a demo. Where it is
    // positioned, and why that takes it out of the column, is on .seat-tip below.
    const typesMenu = !isSticky && menuOpen === 'types' ? html`
      <div class="selection-menu" role="menu" @mouseleave=${() => { this._showTip(''); }}>
        ${SECTION_MENU_TYPES.map((mt) => html`
          <button class="menu-item${t === mt.type ? ' selected' : ''}" role="menuitem"
                  data-action="type" data-value="${mt.type}"
                  @mouseenter=${() => { this._showTip(mt.type); }}
                  @focus=${() => { this._showTip(mt.type); }}
                  @click=${(e: Event) => this._onMenuSelect(e)}>${mt.label}</button>`)}
        <button class="menu-item danger" role="menuitem" data-action="delete"
                @mouseenter=${() => { this._showTip(''); }}
                @click=${(e: Event) => this._onMenuSelect(e)}>Remove</button>
        <button class="menu-item" role="menuitem" data-action="add"
                @mouseenter=${() => { this._showTip(''); }}
                @click=${(e: Event) => this._onMenuSelect(e)}>Add Section</button>
        <div class="menu-item placeholder" role="presentation">Placeholder row</div>
      </div>` : '';

    // THE DESCRIPTION FLOATS, so it is drawn OUTSIDE the menu's box. Fixed
    // positioning takes it out of the prompt column's scroll box, which would
    // otherwise clip it at the column edge — and out from under the chat column,
    // which paints over anything inside the left pane however high its z-index.
    //
    // ONE CARD, TWO MENUS. Which edge it is anchored to is the only difference:
    // the seats' card grows right from the menu, a tool's grows left. Both are
    // built here because only one can be showing at a time — hovering a tool
    // clears the seat's tip and the other way round (see _showTip).
    const tipWords = this._tip
      ?? (this._tipType
        ? (() => {
            const seat = SECTION_MENU_TYPES.find((m) => m.type === this._tipType);
            return seat ? { title: seat.label, body: seat.description } : null;
          })()
        : null);
    const tipCard = tipWords && this._tipBox
      ? (() => {
          // The whole declaration is ONE expression, not two interpolations in
          // one attribute. Two expressions leave the attribute unset here — the
          // card rendered at its static position instead of beside its tile.
          const edge = this._tipBox!.right !== undefined
            ? `right: ${this._tipBox!.right}px`
            : `left: ${this._tipBox!.left}px`;
          const place = `${edge}; top: ${this._tipBox!.top}px;`;
          /*
           * `popover` PUTS IT IN THE TOP LAYER, and that is what makes the
           * coordinates above mean what they say. A plain `position: fixed` card
           * inside this shadow tree drew 100px low — measured, not guessed: the
           * same card at the same coordinates rendered correctly from
           * `document.body` and wrong from here, because something in this tree
           * is a containing block for fixed positioning. The top layer has the
           * viewport as its containing block by definition and is painted above
           * everything, which is what "floats over the chat" requires.
           *
           * `manual` because the card must not be dismissed by a click or Escape
           * — it is not a dialog, it follows a pointer. It is opened in
           * updated() and removed from the DOM when the pointer leaves, which
           * closes it.
           */
          return html`
            <div class="seat-tip" role="tooltip" popover="manual" style=${place}>
              <div class="seat-tip-title">${tipWords.title}</div>
              <p class="seat-tip-body">${tipWords.body}</p>
            </div>`;
        })()
      : nothing;

    // THE TOOLS THIS SECTION OFFERS. A tool names the sections it belongs to,
    // and a section draws only the tools that name it — plus the ones belonging
    // everywhere, so a general tool does not have to be listed eight times.
    //
    // The fallback while the list is in flight is the wireframe's single example,
    // drawn only under the section that example was written for. Showing it in
    // every section would put a tool in front of someone in a place it does not
    // belong, which is the thing this filter exists to stop.
    const offeredTools = this.tools === undefined
      ? (this.type === 'tool-call' ? PRELABELED_TOOLS : [])
      : this.tools.filter(
          (tool) => tool.sections?.includes(this.type) || tool.sections?.includes(ALL_SECTIONS),
        );
    const functionsMenu = menuOpen === 'functions' ? html`
      <div class="selection-menu" role="menu" @mouseleave=${() => { this._showTip(''); }}>
        ${offeredTools.length === 0
          ? html`<div class="menu-item placeholder" role="presentation">No tools for this seat</div>`
          : offeredTools.map((tool) => html`
          <button class="menu-item" role="menuitem" data-action="tool" data-value="${tool.token}"
                  @mouseenter=${() => { this._showToolTip(tool.name); }}
                  @focus=${() => { this._showToolTip(tool.name); }}
                  @click=${(e: Event) => this._onMenuSelect(e)}>${tool.name}</button>`)}
      </div>` : '';

    // Activity rail — a SINGLE lightning. The Figma rail (40000746-94) carries a
    // database glyph on top plus three lightnings ("Database + purple lightning +
    // 2 dark lightnings"); the owner asked for those to be trimmed down to one
    // lightning. This is an intentional deviation from the Figma source, not a
    // design-system value — re-add kinds here if the full rail is wanted back.
    // The rail is the notification column, so the one addition it takes is the
    // `alert` cell (an exclamation in a circle) while this section is waiting on a
    // person. It is driven by the same `blocked` as the flag and the field ring
    // below, so the three cannot disagree about whether something is wrong — and it
    // is absent the moment the text says nothing is missing, without any state to
    // clear.

    // The flag is derived from `content` — the text a person is looking at and Run
    // sends — so it cannot drift from the fields below it.
    const flag = repairPromptFlag(String(this.content || ''));
    const blocked = flag.kind === 'needs-you' || flag.kind === 'no-values';
    const railIcons: string[] = blocked ? ['lightning', 'alert'] : ['lightning'];
    const promptFlag = flag.kind === 'none' ? '' : html`
      <div class="prompt-flag${blocked ? ' prompt-flag--blocked' : ''}" role="status" data-flag="${flag.kind}">
        <span class="prompt-flag-mark" aria-hidden="true">${blocked ? '!' : '✓'}</span>
        <span class="prompt-flag-text">${flag.text}</span>
      </div>`;

    return html`
      <div class="responsive-prompt-container" data-tag="prompt-section" data-node-id="40000746:94" data-section-name="${this.name}">
        <div class="section-header" data-node-id="40000746:102">
          <gripper-prompt-input ?active=${!isSticky}></gripper-prompt-input>
          <div class="prompt-accordion${menuOpen === 'functions' ? ' functions-open' : ''}" data-node-id="40000909:3998">
            <div class="role-tile-wrap">
              <!-- THE MARKER BELONGS TO THE ELEMENT THAT DRAWS THE NODE. 40000909:3999 is the
                   white rounded tile (pad 18, gap 53, 43 tall in the file) — drawn by
                   <role-tile>'s own :host, not by this positioning wrapper. On the wrapper it
                   compared the wrong element's values; here the check reads the tile's. -->
              <role-tile
                data-node-id="40000909:3999"
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
        ${promptFlag}
        <div class="prompt-imput" data-node-id="40000878:240">
          <status-bar-prompt-input .icons=${railIcons}></status-bar-prompt-input>
          <prompt-textarea
            ?needs-input=${blocked}
            .value=${this.content}
            .placeholder=${this.placeholder}
            .minHeight=${this.minHeight}
            @value-input=${this._onContentInput}
          ></prompt-textarea>
        </div>
      </div>
      ${tipCard}
    `;
  }

  private _toggleMenu(e: Event, kind: 'types' | 'functions') {
    e.stopPropagation();
    this.menuOpen = this.menuOpen === kind ? '' : kind;
    // Closing the menu closes its description too — the card describes a choice
    // CLOSING THE MENU CLOSES ITS CARD, and opening one starts with no tile under
    // the pointer. Either way nothing is being hovered, so neither menu's card
    // applies — this used to check for 'types' specifically, which was true when
    // only the seat menu had one.
    this._showTip('');
    this.requestUpdate();
  }

  /**
   * OPEN THE DESCRIPTION IN THE TOP LAYER.
   *
   * The card carries `popover="manual"`, so it only becomes visible once
   * showPopover() runs and only after the render that created it. Doing it here
   * rather than in the template is the whole reason the card can be positioned
   * with viewport coordinates and still appear where the numbers say: an element
   * in the top layer has the viewport as its containing block, while the same
   * element inside this shadow tree did not — it drew 100px low, measured.
   *
   * showPopover() throws if the element is already open, so the state is checked
   * rather than assumed; nothing else in this element ever opens it.
   */
  protected updated(): void {
    const tip = this.shadowRoot?.querySelector('.seat-tip') as (HTMLElement & { showPopover?: () => void }) | null;
    if (!tip || typeof tip.showPopover !== 'function') return;
    if (!tip.matches(':popover-open')) {
      try { tip.showPopover(); } catch { /* already open, or the platform has no top layer */ }
    }
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
    /*
     * THE CARD GOES WITH THE MENU. It is drawn outside the menu's block — it has
     * to be, to escape the column — so closing the menu does not remove it, and a
     * chosen seat left its own description floating over the prompt with nothing
     * to explain it. A card describing a choice that has been made is clutter on
     * top of the work.
     *
     * The chat carries the same words (see _sayWhatTheSeatIsFor in the editor),
     * so nothing is lost by dismissing it here: it moves from the corner of the
     * screen into the conversation, which is where a record of what was chosen
     * belongs.
     */
    this._showTip('');
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
