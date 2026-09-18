/**
 * <small-dropdown> — the chat output's collapsible slot (placed as "Conversations").
 *
 * Figma source: "small-dropdown" component set #40001085:2413 (file
 * 20UPR2KQMsbAxlo5NJb1se). Variants: state=closed (#40001085:1835) and
 * state=open (#40001085:2414). Placed in the chat panel as instance
 * #I40001085:1796;40001085:2474 inside "chat-output-slot-area" #40001085:1521.
 *
 * Geometry, traced to the closed variant:
 *   trigger tile  row · padding-left 10px · height 30 · #FFFFFF · radius 4
 *                 shadow 2px 2px 6px / -2px -2px 6px rgba(0,0,0,.15)
 *   label         #4E68D2 · Inter Semi Bold 600 / 14
 *   chevron       40×30 · 14×13 glyph · arrow pointing DOWN when closed
 *
 * STATES — one boolean, matching the two Figma variants:
 *   state=closed (default)  chevron down at 50% blue, body hidden
 *   state=open              chevron up at full #4E68D2, body revealed
 * The chevron's state=open variant (#40001085:1890) is the same glyph rotated
 * 180°, so the flip is a transform, not a second asset.
 *
 * The body is a <slot>. The open variant's rows are placeholders ("item"), so
 * this element renders nothing of its own there — the host supplies the content.
 *
 * Events (composed): `dropdown-toggle` { open: boolean }.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';

export class SmallDropdown extends LitElement {
  static properties = {
    /** The tile label. The panel places this one as "Conversations". */
    label: { type: String },
    /** Expanded state — mirrors the design's state=open / state=closed. */
    open: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare open: boolean;

  constructor() {
    super();
    this.label = '';
    this.open = false;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }
    /* role-tile #40001085:1826 — white, radius 4, the frame's small shadow. */
    .trigger {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 30px;
      padding: 0 0 0 10px;
      box-sizing: border-box;
      background: #ffffff;
      border: none;
      border-radius: 4px;
      box-shadow: 2px 2px 6px 0 rgba(0, 0, 0, 0.15), -2px -2px 6px 0 rgba(0, 0, 0, 0.15);
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      text-align: left;
    }
    .label {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 14px;
      font-weight: 600;
      color: #4e68d2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* chevron #40001085:1892 — 40×30, 50% blue closed → full blue open. */
    .chevron {
      flex-shrink: 0;
      width: 40px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(78, 104, 210, 0.5);
      transition: transform 0.15s ease, color 0.15s ease;
    }
    .chevron svg { display: block; }
    .trigger[aria-expanded='true'] .chevron {
      transform: rotate(180deg);
      color: #4e68d2;
    }
    /* Hover — inferred (the frame carries no hover variant). */
    .trigger:hover { background: #f7fafc; }
    .body { margin-top: 10px; }
    .body.closed { display: none; }
  `;

  private _toggle() {
    this.open = !this.open;
    this.dispatchEvent(
      new CustomEvent('dropdown-toggle', {
        bubbles: true,
        composed: true,
        detail: { open: this.open },
      }),
    );
  }

  render() {
    return html`
      <button
        type="button"
        class="trigger"
        data-node-id="40001085:1826"
        aria-expanded=${this.open ? 'true' : 'false'}
        title="${this.label}"
        @click=${this._toggle}
      >
        <span class="label" data-node-id="40001085:1828">${this.label}</span>
        <span class="chevron" data-node-id="40001085:1892" aria-hidden="true">
          <svg width="14" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M7 10l5 5 5-5" />
          </svg>
        </span>
      </button>
      <div class="body ${this.open ? '' : 'closed'}">
        <slot></slot>
      </div>
    `;
  }
}

customElements.define('small-dropdown', SmallDropdown);

declare global {
  interface HTMLElementTagNameMap {
    'small-dropdown': SmallDropdown;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'small-dropdown': React.DetailedHTMLProps<
        React.HTMLAttributes<SmallDropdown> & {
          label?: string;
          open?: boolean;
          ref?: React.Ref<SmallDropdown>;
        },
        SmallDropdown
      >;
    }
  }
}
