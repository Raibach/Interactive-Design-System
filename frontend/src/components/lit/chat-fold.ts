/**
 * <chat-fold> — the collapsible disclosure every chat view puts its long content in.
 *
 * THE PATTERN IS THE CATALOG CHECK'S OWN, and this is where it lives: the panel (the rule
 * via --chat-rule, the chat sheet's wash), the header row (padding 8px 12px, weight 500,
 * the chat sheet's ink), an optional count chip, extra header chips through the "meta"
 * slot, and the design's own chevron artwork — down and dim while open, turned and full
 * while shut. The owner, 2026-09-19: the inspections and the trace must wear "the exact
 * same pattern that you're using for catalog check" — so the pattern is ONE element used
 * by all three, not a stylesheet copied three ways.
 *
 * The body is a <slot>, so a folding view never loses its content: a hidden body hides
 * what the host slotted, it does not unmount it. Events (composed): `fold-toggle`
 * { open: boolean } — the host owns the state and reflects it back on `open`.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';
// THE DESIGN'S OWN CHEVRON, the exported 14x13 artwork — the same file the catalog check
// and the Conversations dropdown import. One asset, imported, never re-drawn.
// The dropdown chevron, INLINE: no path, no name, nothing can resolve it. It used to be the file
// `assets/figma-9598a83b….svg` — an image in an assets folder, loadable by name from anywhere.
const arrowDropDown = "data:image/svg+xml;utf8,<svg preserveAspectRatio='none' overflow='visible' style='display: block;' width='14' height='13' viewBox='0 0 14 13' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='Arrow_drop_down'><rect x='0.5' y='0.5' width='13' height='12' rx='0.5' stroke='%234E68D2'/><path id='Vector 10' d='M6.80794 9.76953L3.09346 5.31215C2.65924 4.79109 3.02976 4 3.70803 4L10.292 4C10.9702 4 11.3408 4.79108 10.9065 5.31215L7.19206 9.76953C7.09211 9.88947 6.90789 9.88947 6.80794 9.76953Z' fill='%234E68D2'/></g></svg>";

export class ChatFold extends LitElement {
  static properties = {
    /** The header's words, e.g. "Catalog check — 29 open". */
    label: { type: String },
    /** The count chip's words, e.g. "13 advisory". Empty draws no chip. */
    count: { type: String },
    /** Expanded state; the host owns it and reflects it back here. */
    open: { type: Boolean, reflect: true },
  };

  declare label: string;
  declare count: string;
  declare open: boolean;

  constructor() {
    super();
    this.label = '';
    this.count = '';
    this.open = false;
  }

  private _toggle(): void {
    this.dispatchEvent(
      new CustomEvent('fold-toggle', {
        bubbles: true,
        composed: true,
        detail: { open: !this.open },
      }),
    );
  }

  static styles = [
    designTokens,
    css`
      :host {
        /* accordion-dropdown #40000934:22852 — a column, gap 5px. The tiles flex to hold
           whatever the host puts in them; nothing here fixes a height. */
        display: flex;
        flex-direction: column;
        gap: 5px;
        width: 100%;
      }
      /* THE CATALOGUE'S OWN TILES — role-dropdown's tile (#40000934:22851): white, radius 6,
         the "button drop" shadow. The owner, 2026-09-19: "it's a 40 pixel high dropdown and
         it's in the lit catalogue and they're all white" — the trigger and the content are
         the same designed tile, one above the other. */
      .panel,
      .body-tile {
        background: #F7F8F2;
        border-radius: 6px;
        box-shadow: -4px -4px 5px rgba(0, 0, 0, 0.15), 4px 4px 5px rgba(0, 0, 0, 0.15);
        font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
        overflow: hidden;
      }
      .header {
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        min-height: 40px;
        box-sizing: border-box;
        padding: 10px;
        border: none;
        background: transparent;
        font-family: inherit;
        font-size: 14px;
        font-weight: 700;
        color: #171717;
        cursor: pointer;
        text-align: left;
      }
      .chip {
        padding: 1px 8px;
        border-radius: var(--ds-radius-pill);
        font-size: var(--ds-fs-label);
        font-weight: var(--ds-weight);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .chip.count { background: var(--ds-teal-tint); color: var(--ds-navy); }
      /* The chevron's box, to the master's own geometry: 40x30 padded to 7, holding the
         14x13 artwork, dim at 50% and full when the body is shut — the same values the
         small-dropdown's chevron uses, because it is the same drawing. */
      .chevron {
        flex-shrink: 0;
        margin-left: auto;
        width: 40px;
        height: 30px;
        padding: 7px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s ease;
      }
      .chevron img {
        display: block;
        width: 14px;
        height: 13px;
        opacity: 0.5;
        transition: opacity 0.15s ease;
      }
      .header[aria-expanded='false'] .chevron { transform: rotate(180deg); }
      .header[aria-expanded='false'] .chevron img { opacity: 1; }
      .body-tile { display: none; }
      .body-tile.open { display: block; }
    `,
  ];

  render() {
    return html`
      <div class="panel">
        <button
          class="header"
          type="button"
          aria-expanded=${this.open ? 'true' : 'false'}
          @click=${this._toggle}
        >
          ${this.label}
          ${this.count ? html`<span class="chip count">${this.count}</span>` : nothing}
          <slot name="meta"></slot>
          <span class="chevron" aria-hidden="true"><img src=${arrowDropDown} width="14" height="13" alt="" /></span>
        </button>
      </div>
      <!-- The content tile is always mounted — hidden, not unmounted, so a folded-away
           view keeps its scroll and its state. -->
      <div class="body-tile ${this.open ? 'open' : ''}">
        <slot></slot>
      </div>
    `;
  }
}

if (!customElements.get('chat-fold')) customElements.define('chat-fold', ChatFold);
