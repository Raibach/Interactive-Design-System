/**
 * <agent-card-element> — Lit web component: the A2UI console card.
 *
 * BASE TEMPLATE: Static CSS extracted from Figma node 40000717:17091.
 * This is the foundational card structure. All cards render this immediately.
 *
 * CATEGORY THEMING: Dynamic colors from PostgreSQL (categories table).
 * When a category is assigned, category-color/category-title-color/category-text-color
 * are applied as CSS custom properties.
 *
 * DESIGN UPDATES: When Figma changes, run:
 *   node frontend/scripts/sync-figma-card.mjs
 *   cd frontend && npm run build
 * This regenerates the static CSS from the Figma spec.
 *
 * Figma node: 40000717:17091 ("console-card")
 * File key: 20UPR2KQMsbAxlo5NJb1se
 */

import { LitElement, html, css } from 'lit';
import { getImageAlt, isImageDecorative } from './a2ui-image-catalog';
import cardBgDesignSystem from '@/assets/5e6d8c1ff1f88eac724c57dccba01dde4c5a1bba.png';

// ── Component ──────────────────────────────────────────────────────────────

export class AgentCardElement extends LitElement {
  static properties = {
    id: { type: String },
    title: { type: String },
    category: { type: String },
    description: { type: String },
    username: { type: String },
    teamName: { type: String, attribute: 'team-name' },
    version: { type: Number },
    status: { type: String },
    likes: { type: Number },
    modelName: { type: String, attribute: 'model-name' },
    lastUsed: { type: String, attribute: 'last-used' },
    createdAt: { type: String, attribute: 'created-at' },
    avatarUrl: { type: String, attribute: 'avatar-url' },
    categoryColor: { type: String, attribute: 'category-color' },
    categoryTitleColor: { type: String, attribute: 'category-title-color' },
    categoryTextColor: { type: String, attribute: 'category-text-color' },
    // Owner-instructed control (not in the Figma pull): arm → confirm.
    _deleteArmed: { state: true },
  };

  declare id: string;
  declare title: string;
  declare category: string;
  declare description: string;
  declare username: string;
  declare teamName: string;
  declare version: number;
  declare status: string;
  declare likes: number;
  declare modelName: string;
  declare lastUsed: string;
  declare createdAt: string;
  declare avatarUrl: string;
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
    this.description = '';
    this.username = '';
    this.teamName = '';
    this.version = 1;
    this.status = 'Active';
    this.likes = 0;
    this.modelName = '';
    this.lastUsed = '';
    this.createdAt = '';
    this.avatarUrl = '';
    this.categoryColor = '';
    this.categoryTitleColor = '';
    this.categoryTextColor = '';
    this._deleteArmed = false;
  }

  // ── BASE TEMPLATE — static CSS from Figma node 40000717:17091 ────────────
  // This is the foundational card structure. All cards render this immediately.
  // When Figma design changes, run: node scripts/sync-figma-card.mjs
  static styles = css`
    /* Reset */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :host {
      display: block;
      width: 276px;
      height: 372px;
    }

    /* Base card — neutral gray when no category assigned */
    .card {
      position: relative;
      width: 276px;
      height: 372px;
      background: var(--card-bg, #1B898D);
      border: 1px solid #FFFFFF;
      border-radius: 10px;
      box-shadow:
        4px 4px 10px 0px rgba(0, 0, 0, 0.15),
        -4px -4px 5px 0px rgba(0, 0, 0, 0.1);
      padding: 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
      line-height: 0;
    }

    /* ── card-header — 54px ─────────────────────────────────────────────── */
    .card-header {
      flex: 0 0 54px;
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
    }
    .card-logo svg {
      display: block;
      width: 39px;
      height: 35px;
    }
    .header-text {
      flex: 1 1 auto;
      width: 199px;
      height: 48px;
      display: flex;
      flex-direction: column;
    }
    .model-indicator {
      flex: 0 0 19px;
      font-weight: 700;
      font-size: 12px;
      line-height: 14.5227px;
      color: #FFFFFF;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .category {
      flex: 0 0 29px;
      display: flex;
      align-items: center;
      font-weight: 700;
      font-size: 14px;
      line-height: 16.9432px;
      color: var(--card-title-color, #F6C031);
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    /* ── card-content — 201px ───────────────────────────────────────────── */
    .card-content {
      flex: 0 0 201px;
      display: flex;
      flex-direction: column;
      gap: 9px;
      overflow: hidden;
    }
    .card-title {
      flex: 0 0 auto;
      min-height: 26px;
      max-height: 52px;
      font-weight: 700;
      font-size: 18px;
      line-height: 26px;
      color: var(--card-text-color, #FFFFFF);
      overflow: hidden;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .card-description {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .desc-text {
      flex: 0 1 124px;
      font-weight: 600;
      font-size: 13px;
      line-height: 20px;
      color: var(--card-text-color, #FFFFFF);
      overflow: hidden;
      word-break: break-word;
      display: -webkit-box;
      -webkit-line-clamp: 6;
      -webkit-box-orient: vertical;
    }
    .desc-label {
      font-weight: 400;
      font-size: 12px;
    }
    .desc-line-wrap {
      flex: 0 0 auto;
      padding: 0 3px;
    }
    .desc-line {
      width: 100%;
      height: 0;
      border-top: 1px solid #FFFFFF;
    }

    /* ── author-section — 39px ──────────────────────────────────────────── */
    .author-section {
      flex: 0 0 39px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
    }
    .author-avatar {
      flex: 0 0 41px;
      width: 41px;
      height: 39px;
      border-radius: 200px;
      box-shadow: 0 0 0 1px #FFFFFF;
      overflow: hidden;
    }
    .author-avatar img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: fill;
    }
    .author-meta {
      flex: 1 1 auto;
      width: 204px;
      height: 39px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 2px;
      overflow: hidden;
    }
    .author-username {
      flex: 0 0 20px;
      font-weight: 600;
      font-size: 13px;
      line-height: 20px;
      color: #00437C;
      text-decoration: underline;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }
    .author-role {
      flex: 0 0 17px;
      font-weight: 500;
      font-size: 12px;
      line-height: 16px;
      color: #FFFFFF;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    /* ── footer-details — 28px ──────────────────────────────────────────── */
    .footer-details {
      flex: 0 0 28px;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      gap: 5px;
    }
    .version-pill {
      flex: 0 0 164px;
      width: 164px;
      height: 28px;
      border: 1px solid #FFFFFF;
      border-radius: 8px;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 5px;
      overflow: hidden;
    }
    .version-text {
      flex: 0 0 81px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      font-weight: 500;
      font-size: 14px;
      line-height: 16.9432px;
      color: #FFFFFF;
      white-space: nowrap;
      overflow: hidden;
    }
    .status-text {
      flex: 0 0 78px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
      font-weight: 700;
      font-size: 14px;
      line-height: 16.9432px;
      color: #672223;
      white-space: nowrap;
      overflow: hidden;
    }
    .likes {
      flex: 0 0 84px;
      width: 84px;
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
    .favorite svg {
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
      font-size: 10px;
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
   * Owner-instructed delete control. Confirmation step 1 lives here (arm →
   * confirm). Confirmation step 2 is the host dialog that ConsolePage shows on
   * the `card-delete` event, so nothing is removed on a single click.
   * This control is NOT in the Figma pull for node 40000717:17091.
   */
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

    // Event name declared in the tag contract:
    // frontend/src/shared/tag-registry.ts → AgentCardSchema.events: 'card-delete'
    this.dispatchEvent(
      new CustomEvent('card-delete', {
        detail: { sessionId: this.id, id: this.id },
        bubbles: true,
        composed: true,
      })
    );
  }

  disconnectedCallback() {
    if (this._deleteTimer) clearTimeout(this._deleteTimer);
    super.disconnectedCallback();
  }

  render() {
    const v = this.version ?? 1;
    const safeStatus = this.status || 'Active';
    const likeCount = this.likes ?? 0;
    const avatarSrc = this.avatarUrl || cardBgDesignSystem;

    // Category colors — validated, invalid values throw
    const safeColor = this.categoryColor ? this._validateColor(this.categoryColor) : '';
    const safeTitleColor = this.categoryTitleColor ? this._validateColor(this.categoryTitleColor) : '';
    const safeTextColor = this.categoryTextColor ? this._validateColor(this.categoryTextColor) : '';

    return html`
      <div class="card" data-tag="agent-card" data-node-id="40000717:17091"
           style="${safeColor ? `--card-bg: ${safeColor};` : ''}
                  ${safeTitleColor ? `--card-title-color: ${safeTitleColor};` : ''}
                  ${safeTextColor ? `--card-text-color: ${safeTextColor};` : ''}">

        <!-- owner-instructed delete control — step 1 of 2 (trash → CONFIRM).
             Not in the Figma pull for node 40000717:17091. -->
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
          <div class="card-logo">
            <svg viewBox="0 0 39 35" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="18.5" cy="18.5" r="6.5" fill="#FCCD3D"/>
              <path d="M28 28C29.283 28 30 28.8345 30 29.5C30 30.1655 29.283 31 28 31C26.717 31 26 30.1655 26 29.5C26 28.8345 26.717 28 28 28Z" stroke="#FCCD3D" stroke-width="2"/>
              <circle cx="30" cy="7" r="5" fill="#FCCD3D"/>
              <circle cx="8" cy="8" r="4" fill="#FCCD3D"/>
              <circle cx="8" cy="29" r="6" fill="#FCCD3D"/>
              <path d="M29.1807 29.4248L28.3994 30.0498L27.6191 30.6738L23.2646 25.2314C23.8121 24.8433 24.3097 24.3908 24.7471 23.8838L29.1807 29.4248ZM12.0029 23.582C12.4155 24.1087 12.8904 24.5835 13.417 24.9961L10.957 27.457L9.54297 26.043L12.0029 23.582ZM13.417 12.0029C12.8904 12.4155 12.4155 12.8904 12.0029 13.417L7.89258 9.30664L9.30664 7.89258L13.417 12.0029ZM27.457 10.957L24.9961 13.417C24.5835 12.8904 24.1087 12.4155 23.582 12.0029L26.043 9.54297L27.457 10.957Z" fill="#FCCD3D"/>
            </svg>
          </div>
          <div class="header-text">
            <div class="model-indicator">${this.modelName}</div>
            <div class="category">${this.category}</div>
          </div>
        </div>

        <!-- card-content -->
        <div class="card-content">
          <div class="card-title">${this.title}</div>
          <div class="card-description">
            ${this.description
              ? html`<div class="desc-text"><span class="desc-label">##PROMPT##&nbsp;&nbsp;</span>${this.description}</div>`
              : ''}
            <div class="desc-line-wrap"><div class="desc-line"></div></div>
          </div>
        </div>

        <!-- author-section -->
        <div class="author-section">
          <div class="author-avatar">
            <img src="${avatarSrc}" alt="${getImageAlt('card-bg-design-system')}" ?aria-hidden="${isImageDecorative('card-bg-design-system')}" loading="lazy" data-a2ui-id="card-avatar" @error=${() => { throw new Error('[agent-card] Avatar load failed'); }} />
          </div>
          <div class="author-meta">
            <div class="author-username">${this.username ? '@' + this.username : ''}</div>
            <div class="author-role">${this.teamName}</div>
          </div>
        </div>

        <!-- footer-details -->
        <div class="footer-details">
          <div class="version-pill">
            <div class="version-text">Version ${Math.min(v, 99)} |</div>
            <div class="status-text">${safeStatus}</div>
          </div>
          <div class="likes">
            <div class="like-count">${likeCount}</div>
            <div class="favorite">
              <svg viewBox="0 0 30 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M5.87653 16.5008L14.3451 23.9258L14.3452 23.9258C14.6549 24.1974 14.8098 24.3332 14.9952 24.335H15.0048C15.1902 24.3332 15.3451 24.1974 15.6549 23.9258L24.1235 16.5008C26.6981 14.2435 27.0055 10.3459 24.8167 7.71281L24.6648 7.53011C22.1603 4.51724 17.3913 5.04596 15.6075 8.53425C15.3541 9.02979 14.6459 9.02979 14.3925 8.53425C12.6087 5.04596 7.83972 4.51724 5.33518 7.53011L5.18331 7.71281C2.99446 10.3459 3.30192 14.2435 5.87653 16.5008Z" stroke="#FFDE30" stroke-width="2"/>
                <path d="M5.87653 16.5008L14.3451 23.9258L14.3452 23.9258C14.6549 24.1974 14.8098 24.3332 14.9952 24.335H15.0048C15.1902 24.3332 15.3451 24.1974 15.6549 23.9258L24.1235 16.5008C26.6981 14.2435 27.0055 10.3459 24.8167 7.71281L24.6648 7.53011C22.1603 4.51724 17.3913 5.04596 15.6075 8.53425C15.3541 9.02979 14.6459 9.02979 14.3925 8.53425C12.6087 5.04596 7.83972 4.51724 5.33518 7.53011L5.18331 7.71281C2.99446 10.3459 3.30192 14.2435 5.87653 16.5008Z" stroke="white" stroke-width="2"/>
              </svg>
            </div>
          </div>
        </div>

      </div>
    `;
  }
}

customElements.define('agent-card-element', AgentCardElement);

declare global {
  interface HTMLElementTagNameMap {
    'agent-card-element': AgentCardElement;
  }
}