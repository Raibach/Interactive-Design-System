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
// THE DESIGN'S OWN CHEVRON — "Arrow_drop_down", the exported 14x13 artwork, the same
// file the output selector's tile imports. The design references ONE asset from two
// places, so it is imported, not re-drawn: this element used to paint its own stroked
// path in code, which is a second drawing of a glyph the file already ships — and it
// looked like one (owner, 2026-09-18: "for some reason there's a fake chevron on the
// conversations … I know that component came with its own chevron"). Its own artwork,
// its own 50%-to-full blue, exactly as the node draws it.
import arrowDropDown from '../../assets/figma-9598a83b0a4eb9b9fc9c226f302689fd4f7075df.svg';

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
    /* A FAINT OUTLINE, NOT A TILE — the owner, 2026-09-19: "knock it down to 35… a very
       faint outline of that in the chat area. I don't want that full fill." The white tile
       and its drop are gone; the outline waits, and the hover lights it up. */
    .trigger {
      display: flex;
      align-items: center;
      width: 100%;
      min-height: 30px;
      padding: 0 0 0 10px;
      box-sizing: border-box;
      background: transparent;
      border: 1px solid rgba(255, 255, 255, 0.35);
      border-radius: 4px;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      text-align: left;
      transition: border-color 120ms linear;
    }
    .label {
      flex: 1 1 auto;
      min-width: 0;
      font-size: 14px;
      font-weight: 600;
      /* The design's blue, at the same 35% — every part of the tile rests faint. */
      color: rgba(78, 104, 210, 0.35);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: color 120ms linear;
    }
    /* chevron #40001085:1892 — a 40x30 box, padding 7, holding the 14x13 artwork.
       The DIM is the design's: 50% blue closed, full blue open. It rides on the image as
       opacity, because the colour is in the file — which is the difference between
       importing a drawing and tinting one made from a string. */
    .chevron {
      flex-shrink: 0;
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
    .trigger[aria-expanded='true'] .chevron { transform: rotate(180deg); }
    .trigger[aria-expanded='true'] .chevron img { opacity: 1; }
    /* Hover — inferred (the frame carries no hover variant). The light-up: the outline and
       the word come to full, so the tile is faint until it is wanted. */
    .trigger:hover { background: transparent; border-color: rgba(255, 255, 255, 0.9); }
    .trigger:hover .label { color: #4e68d2; }
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
          <img src=${arrowDropDown} width="14" height="13" alt="" />
        </span>
      </button>
      <div class="body ${this.open ? '' : 'closed'}">
        <slot></slot>
      </div>
    `;
  }
}

if (!customElements.get('small-dropdown')) customElements.define('small-dropdown', SmallDropdown);

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
