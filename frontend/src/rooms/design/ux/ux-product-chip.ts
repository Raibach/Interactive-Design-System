/**
 * <ux-product-chip> — THE PRODUCT CHIP AND ITS FLYOUT, IN POSTHOG'S OWN SHAPE.
 *
 * This is the one chip in the footer that opens a flyout. The flyout is the shared product
 * selector: Auto, Product analytics, SQL, Session replay, Error tracking, Surveys, Flags and AI
 * observability. Choosing an entry changes the chip's label, the product icon and the focus of
 * the next question. The notebook and discussion chips stay flat beside it.
 *
 * The chip is read from the place the framed application reports while Auto is selected. A pinned
 * product stays until Auto is chosen again. The styling follows PostHog's footer chip and its
 * selector rows; it is not a new visual language.
 */
import { LitElement, html, css } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { UX_AUTO, UX_SELECTOR_PRODUCTS, type UxProduct } from './ux-products';

function glyph(key: string) {
  const svg = (body: string) => html`<svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${unsafeSVG(body)}</svg>`;
  switch (key) {
    case 'auto':
      return svg('<path d="M2 5h3l6 6h3M2 11h3l6-6h3"></path><path d="M12 3l2 2-2 2M12 9l2 2-2 2"></path>');
    case 'sql':
      return svg('<ellipse cx="8" cy="4" rx="5" ry="2"></ellipse><path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4"></path>');
    case 'session_replay':
      return svg('<circle cx="8" cy="8" r="6"></circle><path d="M6.8 5.6l4 2.4-4 2.4z"></path>');
    case 'error_tracking':
      return svg('<path d="M8 2l6 12H2L8 2z"></path><path d="M8 6v4M8 12v.4"></path>');
    case 'surveys':
      return svg('<path d="M3 3h10v8H8l-3 2v-2H3z"></path><path d="M6 7l1.5 1.5L10 5.5"></path>');
    case 'flags':
      return svg('<path d="M4 2v12M4 3h8l-1.5 3L12 9H4"></path>');
    case 'ai_observability':
      return svg('<path d="M2 8s2.2-4 6-4 6 4 6 4-2.2 4-6 4-6-4-6-4z"></path><circle cx="8" cy="8" r="2"></circle>');
    case 'product_analytics':
      return svg('<path d="M3 13V8M8 13V3M13 13V6"></path>');
    default:
      return svg('<circle cx="8" cy="8" r="2.5"></circle>');
  }
}

export class UxProductChip extends LitElement {
  static properties = {
    product: { type: Object },
    open: { type: Boolean, state: true },
  };

  declare product: UxProduct;
  declare open: boolean;

  constructor() {
    super();
    this.product = UX_AUTO;
    this.open = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
    document.addEventListener('keydown', this._onDocumentKeyDown, true);
  }

  disconnectedCallback(): void {
    document.removeEventListener('pointerdown', this._onDocumentPointerDown, true);
    document.removeEventListener('keydown', this._onDocumentKeyDown, true);
    super.disconnectedCallback();
  }

  private _onDocumentPointerDown = (event: PointerEvent): void => {
    if (!this.open) return;
    if (event.composedPath().includes(this)) return;
    this.open = false;
  };

  private _onDocumentKeyDown = (event: KeyboardEvent): void => {
    if (this.open && event.key === 'Escape') this.open = false;
  };

  private _choose(product: UxProduct): void {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('ux-product-change', {
        bubbles: true,
        composed: true,
        detail: { product },
      }),
    );
  }

  static styles = css`
    :host {
      display: inline-flex;
      position: relative;
      min-width: 0;
      max-width: 100%;
      font: 12px/1.2 'IBM Plex Sans', system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #1c2f4e;
    }
    .chip {
      appearance: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
      max-width: 220px;
      height: 28px;
      padding: 0 7px;
      border: 1px solid rgba(28, 47, 78, 0.18);
      border-radius: 6px;
      background: #fff;
      color: #1c2f4e;
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
    }
    .chip:hover,
    .chip[aria-expanded="true"] {
      background: #f7f7f7;
      border-color: rgba(28, 47, 78, 0.3);
    }
    .chip:focus-visible {
      outline: 2px solid #7e72e3;
      outline-offset: 1px;
    }
    .chip svg {
      width: 15px;
      height: 15px;
      flex: 0 0 auto;
      color: #3d515b;
    }
    .label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .chevron {
      width: 12px !important;
      height: 12px !important;
      color: #6b7a86;
      margin-left: 1px;
    }
    .menu {
      position: absolute;
      left: 0;
      bottom: calc(100% + 6px);
      width: 220px;
      padding: 4px;
      border: 1px solid rgba(28, 47, 78, 0.16);
      border-radius: 8px;
      background: #fff;
      box-shadow: 0 10px 28px rgba(28, 47, 78, 0.18);
      z-index: 150;
    }
    .row {
      appearance: none;
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      height: 32px;
      padding: 0 8px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #1c2f4e;
      font: inherit;
      font-size: 12px;
      font-weight: 500;
      text-align: left;
      cursor: pointer;
    }
    .row:hover,
    .row.selected {
      background: #f2f2f2;
    }
    .row svg {
      width: 15px;
      height: 15px;
      flex: 0 0 auto;
      color: #3d515b;
    }
    .divider {
      height: 1px;
      margin: 4px 6px;
      background: rgba(28, 47, 78, 0.1);
    }
  `;

  render() {
    const current = this.product ?? UX_AUTO;
    const rest = UX_SELECTOR_PRODUCTS.filter((product) => product.key !== 'auto');
    return html`
      <button
        type="button"
        class="chip"
        aria-haspopup="menu"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-label=${`Product: ${current.label}`}
        @click=${() => { this.open = !this.open; }}
      >
        ${glyph(current.key)}
        <span class="label">${current.label}</span>
        <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6l4 4 4-4"></path>
        </svg>
      </button>
      ${this.open
        ? html`<div class="menu" role="menu" aria-label="Product">
            <button
              type="button"
              class="row ${current.key === 'auto' ? 'selected' : ''}"
              role="menuitemradio"
              aria-checked=${current.key === 'auto' ? 'true' : 'false'}
              @click=${() => this._choose(UX_AUTO)}
            >
              ${glyph('auto')}
              <span>Auto</span>
            </button>
            <div class="divider" role="separator"></div>
            ${rest.map(
              (product) => html`
                <button
                  type="button"
                  class="row ${current.key === product.key ? 'selected' : ''}"
                  role="menuitemradio"
                  aria-checked=${current.key === product.key ? 'true' : 'false'}
                  @click=${() => this._choose(product)}
                >
                  ${glyph(product.key)}
                  <span>${product.label}</span>
                </button>
              `,
            )}
          </div>`
        : null}
    `;
  }
}

if (!customElements.get('ux-product-chip')) {
  customElements.define('ux-product-chip', UxProductChip);
}

declare global {
  interface HTMLElementTagNameMap {
    'ux-product-chip': UxProductChip;
  }
}
