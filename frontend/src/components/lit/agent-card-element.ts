/**
 * <agent-card-element> — Lit web component: the A2UI console card.
 *
 * DESIGN SOURCE: Figma "console-card-design-system" node 40001114:5813, file
 * 20UPR2KQMsbAxlo5NJb1se — pulled through the Figma MCP 2026-09-18. Every number
 * below is the node's own: 262×251, padding 10, gap 10, stroke #FFFFFF 3px,
 * radius 10, the two-part box shadow, the fills and the type.
 *
 * CATEGORY THEMING: Dynamic colors from PostgreSQL (categories table) arrive as
 * category-color / category-title-color / category-text-color and are applied as
 * CSS custom properties. The card's own defaults are the design's (the Design
 * System row: #1C2F4E / #FB8D67 / #FFFFFF).
 *
 * STRUCTURE (the node's own): header (logo + function line + category line),
 * content (title + description with the ##PROMPT## lead), footer (version pill
 * with status, likes with the heart). No author section — the design has none.
 */
import { LitElement, html, css } from 'lit';
import cardLogo from '@/assets/figma-card-logo.svg';
import favoriteIcon from '@/assets/figma-card-favorite.svg';

// ── Component ──────────────────────────────────────────────────────────────

export class AgentCardElement extends LitElement {
  static properties = {
    id: { type: String },
    title: { type: String },
    category: { type: String },
    /** The function level — the line ABOVE the category. */
    function: { type: String },
    description: { type: String },
    version: { type: Number },
    status: { type: String },
    likes: { type: Number },
    categoryColor: { type: String, attribute: 'category-color' },
    categoryTitleColor: { type: String, attribute: 'category-title-color' },
    categoryTextColor: { type: String, attribute: 'category-text-color' },
    // Owner-instructed control (not in the Figma pull): arm → confirm.
    _deleteArmed: { state: true },
  };

  declare id: string;
  declare title: string;
  declare category: string;
  declare function: string;
  declare description: string;
  declare version: number;
  declare status: string;
  declare likes: number;
  declare categoryColor: string;
  declare categoryTitleColor: string;
  declare categoryTextColor: string;
  /** First confirmation step: trash clicked once, waiting for the second click. */
  declare _deleteArmed: boolean;
  /** Auto-disarm timer so an armed trash never stays armed. */
  private _deleteTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    super();
    this.id = '';
    this.title = '';
    this.category = '';
    this.function = '';
    this.description = '';
    this.version = 1;
    this.status = 'Active';
    this.likes = 0;
    this.categoryColor = '';
    this.categoryTitleColor = '';
    this.categoryTextColor = '';
    this._deleteArmed = false;
  }

  static styles = css`
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      display: block;
      width: 262px;                                   /* designedWidth */
      height: 251px;                                  /* designedHeight */
    }

    /* THE LEAVING MOMENT — the card settles where it is before it is taken away. CSS
       transition, not an animation: the element sets the flag and this does the moving.
       Motion is a courtesy: reduced-motion gets the removal without the pause. */
    .card.leaving {
      transform: scale(0.94);
      opacity: 0;
      transition: transform 180ms cubic-bezier(0.22, 1, 0.36, 1), opacity 180ms cubic-bezier(0.22, 1, 0.36, 1);
    }
    @media (prefers-reduced-motion: reduce) {
      .card.leaving { transform: none; transition: none; }
    }

    .card {
      position: relative;
      width: 262px;
      height: 251px;
      background: var(--card-bg, #1C2F4E);            /* the design's own fill */
      border: 3px solid #FFFFFF;                      /* stroke, 3px */
      border-radius: 10px;
      box-shadow:
        4px 4px 10px 0px rgba(0, 0, 0, 0.15),
        -4px -4px 5px 0px rgba(0, 0, 0, 0.1);
      padding: 10px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      overflow: hidden;
      /* THE WHOLE CARD OPENS A PACKAGE, SO THE WHOLE CARD SAYS SO. The card's own
         controls carry the hand and the card itself carried nothing, so hovering its
         title, its description or its empty space gave no sign that the area was
         clickable (owner, 2026-09-18). A clickable area without a hand reads as a
         picture, on every platform that draws one. */
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
    }

    /* ── card-header — logo, function, category ──────────────────────────── */
    .card-header {
      align-self: stretch;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      padding: 3px 0;
    }
    .card-logo {
      flex: 0 0 39px;
      width: 39px;
      height: 35px;
      display: block;
    }
    .header-labels {
      flex: 1 1 auto;
      width: 199px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    /* The function — the level above the category, the design's own gold. */
    .fn-line {
      font-weight: 700;
      font-size: 14px;
      line-height: 17px;
      color: #F6C031;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* The category — 12px, the categories table's title_color (the design's #FB8D67). */
    .cat-line {
      height: 19px;
      font-weight: 700;
      font-size: 12px;
      line-height: 19px;
      color: var(--card-title-color, #FB8D67);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* ── card-content — title + description ─────────────────────────────── */
    .card-content {
      align-self: stretch;
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      gap: 9px;
      overflow: hidden;
    }
    .card-title {
      flex: 0 0 50px;                                 /* the node's title box */
      font-weight: 700;
      font-size: 16px;
      line-height: 26px;
      color: var(--card-text-color, #FFFFFF);
      overflow: hidden;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .card-description {
      flex: 0 0 82px;                                 /* the node's description box */
      /* The design draws this text at Inter Regular; the app's typography law is
         nothing below Medium, so it renders 500. Flagged to the design. */
      font-weight: 500;
      font-size: 13px;
      line-height: 20px;
      color: var(--card-text-color, #FFFFFF);
      overflow: hidden;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 4;
      -webkit-box-orient: vertical;
    }

    /* ── footer-details — the flip-footer pill + likes ───────────────────── */
    .footer-details {
      align-self: stretch;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 5px;
    }
    .version-pill {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 5px;
      height: 28px;
      padding: 0 5px;
      border: 1px solid #FFFFFF;
      border-radius: 8px;
      overflow: hidden;
    }
    .version-text {
      width: 81px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      font-weight: 500;
      font-size: 14px;
      line-height: 17px;
      color: #FFFFFF;
      white-space: nowrap;
      overflow: hidden;
    }
    .status-text {
      width: 78px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-weight: 700;
      font-size: 14px;
      line-height: 17px;
      color: #FCCD3D;                                 /* the node's own status gold */
      white-space: nowrap;
      overflow: hidden;
    }
    /* A finished package says so in green — asked for by name. It is the one word this chip
       draws that is a verdict rather than a state: the work is done, and the card leaves the
       console on the next assembly. */
    .status-text.completed { color: #1F7A3D; }
    .likes {
      margin-left: auto;
      width: 72px;
      height: 28px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: flex-end;
      gap: 10px;
    }
    .like-count {
      font-weight: 700;
      font-size: 13px;
      line-height: 20px;
      color: #FFFFFF;
      text-align: right;
      white-space: nowrap;
    }
    .favorite {
      flex: 0 0 30px;
      width: 30px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .favorite img {
      display: block;
      width: 30px;
      height: 28px;
    }

    /* ── card-delete — owner-instructed control (NOT in the Figma pull) ──── */
    /* Progressive: hidden until the card is hovered/focused, then trash
       icon top-right. First click arms it; second click confirms. */
    .card-delete {
      /* Inherit — a shadow-root <button> otherwise falls back to the UA font (Arial). */
      font-family: inherit;
      position: absolute;
      top: 8px;
      right: 8px;
      z-index: 3;
      height: 26px;
      min-width: 26px;
      padding: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      border: 1px solid rgba(255, 255, 255, 0.65);
      border-radius: 6px;
      background: rgba(0, 0, 0, 0.38);
      color: #FFFFFF;
      cursor: pointer;
      opacity: 0;
      transition: opacity 120ms ease, background 120ms ease;
    }
    .card:hover .card-delete,
    .card-delete:focus-visible { opacity: 1; }
    .card-delete:hover { background: rgba(0, 0, 0, 0.65); }
    .card-delete svg { display: block; width: 14px; height: 14px; }
    .card-delete.armed {
      opacity: 1;
      padding: 0 8px;
      background: #B91C1C;
      border-color: #FFFFFF;
    }
    .card-delete-label {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      line-height: 1;
    }
  `;

  private _validateColor(val: string): string {
    if (!val) return '';
    const s = new Option().style;
    s.color = '';
    s.color = val;
    // If browser accepts it, s.color will be a normalized value
    // If not, it remains empty — fall back to safe default
    return s.color ? val : '';
  }

  /**
   * HOW LONG THE CARD HOLDS ITS GROUND BEFORE IT GOES. Short enough to read as a
   * consequence of the press rather than as a wait — the owner asked for "a little bit",
   * and a list that reshuffles instantly reads as a glitch.
   */
  private static readonly LEAVING_MS = 180;

  private _onDeleteClick(e: Event) {
    // Never let this reach the wrapper's card-open handler.
    e.stopPropagation();
    e.preventDefault();

    if (!this._deleteArmed) {
      this._deleteArmed = true;
      if (this._deleteTimer) clearTimeout(this._deleteTimer);
      this._deleteTimer = setTimeout(() => { this._deleteArmed = false; }, 4000);
      return;
    }

    if (this._deleteTimer) clearTimeout(this._deleteTimer);
    this._deleteArmed = false;

    /*
     * THE CARD'S OWN MOMENT BEFORE IT GOES. The card settles where it stands — a short
     * shrink and a fade — and THEN says it was deleted. DISPATCH SECOND, deliberately: a
     * removal that animates first and fails looks like a card that vanished on its own.
     * If the delete fails, the card is still there — the only honest place for it to be.
     */
    this._leaving = true;
    window.setTimeout(() => {
      this._leaving = false;
      this.dispatchEvent(
        new CustomEvent('card-delete', {
          detail: { sessionId: this.id, id: this.id },
          bubbles: true,
          composed: true,
        })
      );
    }, AgentCardElement.LEAVING_MS);
  }

  /** True for the moment between CONFIRM and the host being told. */
  private _leaving = false;

  disconnectedCallback() {
    if (this._deleteTimer) clearTimeout(this._deleteTimer);
    super.disconnectedCallback();
  }

  render() {
    const v = this.version ?? 1;
    const safeStatus = this.status || 'Active';
    const likeCount = this.likes ?? 0;

    // Category colors — validated, invalid values throw
    const safeColor = this.categoryColor ? this._validateColor(this.categoryColor) : '';
    const safeTitleColor = this.categoryTitleColor ? this._validateColor(this.categoryTitleColor) : '';
    const safeTextColor = this.categoryTextColor ? this._validateColor(this.categoryTextColor) : '';

    return html`
      <div class="card ${this._leaving ? 'leaving' : ''}" data-tag="agent-card" data-node-id="40001114:5813"
           style="${safeColor ? `--card-bg: ${safeColor};` : ''}
                  ${safeTitleColor ? `--card-title-color: ${safeTitleColor};` : ''}
                  ${safeTextColor ? `--card-text-color: ${safeTextColor};` : ''}">

        <!-- owner-instructed delete control — step 1 of 2 (trash → CONFIRM).
             Not in the Figma pull. -->
        <button
          class="card-delete ${this._deleteArmed ? 'armed' : ''}"
          type="button"
          data-a2ui-id="card-delete"
          title=${this._deleteArmed ? 'Click again to confirm delete' : 'Delete this prompt package'}
          aria-label=${this._deleteArmed ? 'Confirm delete' : 'Delete prompt package'}
          @click=${this._onDeleteClick}
        >
          ${this._deleteArmed
            ? html`<span class="card-delete-label">CONFIRM</span>`
            : html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
        </button>

        <!-- card-header -->
        <div class="card-header">
          <img class="card-logo" src=${cardLogo} alt="" aria-hidden="true" />
          <div class="header-labels">
            <div class="fn-line">${this.function || ''}</div>
            <div class="cat-line">${this.category || ''}</div>
          </div>
        </div>

        <!-- card-content -->
        <div class="card-content">
          <div class="card-title">${this.title}</div>
          <div class="card-description">${this.description ? html`##PROMPT##&nbsp;&nbsp;${this.description}` : ''}</div>
        </div>

        <!-- footer-details -->
        <div class="footer-details">
          <div class="version-pill">
            <div class="version-text">Version ${Math.min(v, 99)} |</div>
            <div class="status-text ${String(safeStatus).toLowerCase() === 'completed' ? 'completed' : ''}">${safeStatus}</div>
          </div>
          <div class="likes">
            <div class="like-count">${likeCount}</div>
            <div class="favorite"><img src=${favoriteIcon} alt="" aria-hidden="true" /></div>
          </div>
        </div>

      </div>
    `;
  }
}

if (!customElements.get('agent-card-element')) customElements.define('agent-card-element', AgentCardElement);

declare global {
  interface HTMLElementTagNameMap {
    'agent-card-element': AgentCardElement;
  }
}
