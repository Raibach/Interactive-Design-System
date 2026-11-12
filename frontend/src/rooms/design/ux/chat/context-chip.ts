/**
 * <ux-context-chip> — ADD CONTEXT, BESIDE THE PRODUCT CHIP.
 *
 * The chip follows PostHog's Add context chip: the @ mark, the label and the chevron. Its flyout
 * carries the first real context, the page the person is on, named with the current product. The
 * full picker (insights, dashboards, events, actions, notebooks) is the later stage; this chip
 * must not pretend to have it.
 */
import { LitElement, html, css } from 'lit';

export class UxContextChip extends LitElement {
  static properties = {
    active: { type: Boolean },
    contextLabel: { type: String },
    open: { type: Boolean, state: true },
  };

  declare active: boolean;
  declare contextLabel: string;
  declare open: boolean;

  constructor() {
    super();
    this.active = false;
    this.contextLabel = 'This page';
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

  private _toggle = (): void => {
    this.open = !this.open;
  };

  private _choose = (): void => {
    this.open = false;
    this.dispatchEvent(
      new CustomEvent('ux-context-toggle', {
        bubbles: true,
        composed: true,
        detail: { active: !this.active },
      }),
    );
  };

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
    .chip.active {
      background: #f2f2f2;
      border-color: rgba(28, 47, 78, 0.28);
    }
    .chip:focus-visible {
      outline: 2px solid #7e72e3;
      outline-offset: 1px;
    }
    .at {
      width: 15px;
      height: 15px;
      display: grid;
      place-items: center;
      border: 1.2px solid currentColor;
      border-radius: 50%;
      font-size: 9px;
      font-weight: 700;
      line-height: 1;
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
      width: 12px;
      height: 12px;
      color: #6b7a86;
      margin-left: 1px;
      flex: 0 0 auto;
    }
    .menu {
      position: absolute;
      left: 0;
      bottom: calc(100% + 6px);
      width: 246px;
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
      min-height: 34px;
      padding: 5px 8px;
      border: 0;
      border-radius: 6px;
      background: transparent;
      color: #1c2f4e;
      font: inherit;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
    }
    .row:hover {
      background: #f2f2f2;
    }
    .row-copy {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .row-title {
      font-weight: 600;
    }
    .row-sub {
      font-size: 11px;
      color: rgba(28, 47, 78, 0.58);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .check {
      width: 14px;
      height: 14px;
      flex: 0 0 auto;
      color: #3d5b45;
    }
  `;

  render() {
    return html`
      <button
        type="button"
        class="chip ${this.active ? 'active' : ''}"
        aria-haspopup="menu"
        aria-expanded=${this.open ? 'true' : 'false'}
        aria-label="Add context"
        @click=${this._toggle}
      >
        <span class="at" aria-hidden="true">@</span>
        <span class="label">Add context</span>
        <svg class="chevron" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
          <path d="M4 6l4 4 4-4"></path>
        </svg>
      </button>
      ${this.open
        ? html`<div class="menu" role="menu" aria-label="Add context">
            <button type="button" class="row" role="menuitemcheckbox" aria-checked=${this.active ? 'true' : 'false'} @click=${this._choose}>
              <span class="row-copy">
                <span class="row-title">This page</span>
                <span class="row-sub">${this.contextLabel}</span>
              </span>
              ${this.active
                ? html`<svg class="check" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3 3 7-7"></path></svg>`
                : null}
            </button>
          </div>`
        : null}
    `;
  }
}

if (!customElements.get('ux-context-chip')) {
  customElements.define('ux-context-chip', UxContextChip);
}

declare global {
  interface HTMLElementTagNameMap {
    'ux-context-chip': UxContextChip;
  }
}
