/**
 * <output-controls> — the middle column's header row.
 *
 * Figma source: "output-vontrols" (the designer's spelling; the node id is the join key)
 * node 40001034:1186 — TWO children, exactly as drawn:
 *
 *   ouput-selector-tile  40001034:1187, its text run 40001034:1190
 *                        (literally "Agent Flow"), chevron 40000922:4875
 *   model-selector-button 40000909:4322 — the same published component the prompt
 *                        surface instantiates, instantiating it here too
 *
 * WHY IT IS ITS OWN ELEMENT. The header belongs to the COLUMN, not to the body that
 * happens to be under it: when the flow view takes the middle column on Run, the output
 * viewer leaves and the header went with it. Extracting it is what lets a second view
 * carry the same header without a second copy of these numbers.
 *
 * IT IS A PLACEHOLDER, ON THE OWNER'S INSTRUCTION (2026-09-18): "for right now that could
 * just be a placeholder, it doesn't have to do anything… just add the element to the
 * canvas and that way it'll be there when we get ready to wire it up." So the tile is
 * drawn with the tag and role its design gives it — a button that opens a menu — and NO
 * menu, exactly as `compiled-output-viewer` draws it today. The menu this selector opens
 * is not in the Figma pull ("no menu contents are in the pull; the host owns the menu"),
 * and the owner has since said what it is FOR: switching between the canvas view, the raw
 * output, and more to come. Until that is built, the control is present and inert, and
 * this note is why.
 *
 * Not to be confused with the viewer's own copy of the same row: that one is still drawn
 * inside <compiled-output-viewer>, and the two are meant to become one home when the
 * selector is wired (AGENTIC_EDITOR/10-TODO.md, P6).
 */
import { LitElement, html, css, nothing } from 'lit';
// Chevron artwork for ouput-selector-tile / chevron-blue-closed — node 40000922:4875,
// child "Arrow_drop_down" (40000922:4872, 14x13). The same asset role-tile.ts and
// compiled-output-viewer.ts import; the design references one file from several places,
// so it is imported, not re-drawn.
// The dropdown chevron, INLINE: no path, no name, nothing can resolve it. It used to be the file
// `assets/figma-9598a83b….svg` — an image in an assets folder, loadable by name from anywhere.
const arrowDropDown = "data:image/svg+xml;utf8,<svg preserveAspectRatio='none' overflow='visible' style='display: block;' width='14' height='13' viewBox='0 0 14 13' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='Arrow_drop_down'><rect x='0.5' y='0.5' width='13' height='12' rx='0.5' stroke='%234E68D2'/><path id='Vector 10' d='M6.80794 9.76953L3.09346 5.31215C2.65924 4.79109 3.02976 4 3.70803 4L10.292 4C10.9702 4 11.3408 4.79108 10.9065 5.31215L7.19206 9.76953C7.09211 9.88947 6.90789 9.88947 6.80794 9.76953Z' fill='%234E68D2'/></g></svg>";
/**
 * WHAT THE VIEWS ARE CALLED. The ids are the host's vocabulary ('flow' | 'output' | 'draft'); the
 * names are the design's — the tile's own drawn text ("Agent Flow", node 40001034:1190) is the
 * canvas's, so the example the design drew stays the name it is shown by.
 */
const VIEW_LABELS: Record<string, string> = {
  flow: 'Agent Flow',
  output: 'Output',
  draft: 'Draft',
};
// The model control is its own published component (model-btn-label 40000973:24205).
// Instantiating it is what the viewer does too: it owns 171x40 + radius 6 + "Functions | Tools",
// and nothing about it is restyled here.
import './prompt-input/model-selector-button';

export class OutputControls extends LitElement {
  static properties = {
    /**
     * What the selector tile reads — the view this column is showing.
     *
     * Node 40001034:1190's text is literally "Agent Flow". It is a property rather than a
     * hardcoded string because this tile is the thing the reader chooses at the top of
     * the column: the drawn value is the example, not the only value.
     */
    outputType: { type: String, attribute: 'output-type' },
    /**
     * WHICH VIEW THIS COLUMN IS SHOWING — 'flow' | 'output' | 'draft'. The HOST writes it (it is
     * the one that swaps the column) and the tile's label is READ FROM IT: a selector that names
     * one view while the column shows another is the quietest kind of lie.
     */
    view: { type: String, attribute: 'view' },
    /**
     * WHICH VIEWS THIS COLUMN CAN SHOW, host-set — only the host knows (a drawing exists only
     * after a Run, a draft only once one is stored), and the menu carries what is there. A view
     * that cannot be shown is not offered. Empty means NO MENU: the tile is then exactly what it
     * was before this existed — a label with the design's tag and role, opening nothing.
     */
    views: { type: Array, attribute: false },
  };

  declare outputType: string;
  declare view: string;
  declare views: string[];

  /** The menu's own state — the operator's, never the payload's. */
  private _menuOpen = false;

  constructor() {
    super();
    this.outputType = 'Agent Flow';          // node 40001034:1190
    this.view = '';
    this.views = [];
  }

  /** The drawn label: the current view's name, else the design's example text. */
  private _label(): string {
    return VIEW_LABELS[this.view] ?? this.outputType;
  }

  private _onTileClick = (e: MouseEvent): void => {
    // THE TILE NAMES THE VIEW AND OPENS THE LIST OF THEM. With no views declared it is what it has
    // always been — a label — and it opens nothing (see the `views` note).
    if (!this.views.length) return;
    e.stopPropagation();
    this._menuOpen = !this._menuOpen;
    // The next press anywhere else closes it. A press INSIDE stays inside (see `_closeMenu`); the
    // listener is added and removed with the menu, so a closed menu leaves nothing behind.
    if (this._menuOpen) window.addEventListener('pointerdown', this._closeMenu, true);
    else window.removeEventListener('pointerdown', this._closeMenu, true);
    this.requestUpdate();
  };

  private _closeMenu = (e: Event): void => {
    if (e.composedPath().includes(this)) return;
    this._menuOpen = false;
    window.removeEventListener('pointerdown', this._closeMenu, true);
    this.requestUpdate();
  };

  private _choose(view: string): void {
    this._menuOpen = false;
    window.removeEventListener('pointerdown', this._closeMenu, true);
    this.requestUpdate();
    // THE CHOICE IS EMITTED, NEVER PERFORMED HERE: what changing a view means is the host's — this
    // header does not know where the column's body lives, and an element that swapped it would be
    // the wrong model twice over.
    if (view === this.view) return;
    this.dispatchEvent(new CustomEvent('view-change', {
      bubbles: true, composed: true, detail: { view },
    }));
  }

  disconnectedCallback(): void {
    window.removeEventListener('pointerdown', this._closeMenu, true);
    super.disconnectedCallback();
  }

  render() {
    /* ── ANNOTATION — PROPOSED 2026-09-18, TO BE TRANSFERRED TO FIGMA ────────────────
       Written here in the design's own field vocabulary because the Figma pull for this
       frame carries none (the owner: "I don't think we have done a proper annotation of
       everything… you can add the annotation and then later I will transfer those to the
       Figma file"). Until it is moved into the frame, the catalog checker — which reads
       annotations from FIGMA, not from here — still reports these nodes as unannotated.
       That is correct: this text is a proposal, not a trace.

       "output-vontrols" #40001034:1186 — the middle column's header ROW. Two children,
       exactly as drawn, no third.
         Data:     which view this column is showing (the tile's own text)
         State:    idle — the row has no selected state of its own; the tile NAMES the
                   current view rather than offering it

       "ouput-selector-tile" #40001034:1187 — the left child (the designer's spelling of
       "output"; the node id is the join key, so the name is left as written).
         Data:     the current view: its text run 40001034:1190 reads "Agent Flow"
         On click: opens the view menu — NOT DESIGNED. No menu contents are in the pull
                   for 40000914:4677, so this control is drawn with its tag and role and
                   opens nothing. The owner has since said what it is for: switching
                   between the canvas view, the raw output, and more to come.
         State:    idle | open (open undrawn)
         A11y:     role=button, aria-haspopup=menu; the tile reads as its own label, so
                   no aria-label is drawn

       "model-selector-button" #40000909:4322 — the right child. Its own published
       component, instantiated and never restyled; its annotation belongs to its own
       frame (the checker already reports 40000909:4322 as annotation-missing).
    ─────────────────────────────────────────────────────────────────────────────── */
    return html`
      <div class="controls">
        <button
          class="selector-tile"
          type="button"
          aria-haspopup=${this.views.length ? 'menu' : 'false'}
          aria-expanded=${this._menuOpen ? 'true' : 'false'}
          @click=${this._onTileClick}
        >
          <span class="output-type">${this._label()}</span>
          <span class="chevron"><img src=${arrowDropDown} alt="" /></span>
        </button>
        ${this._menuOpen && this.views.length
          ? html`<div class="view-menu" role="menu">
              ${this.views.map((v) => html`
                <button
                  type="button"
                  role="menuitem"
                  class="view-item ${v === this.view ? 'current' : ''}"
                  aria-current=${v === this.view ? 'true' : 'false'}
                  @click=${() => this._choose(v)}
                >${VIEW_LABELS[v] ?? v}</button>`)}
            </div>`
          : nothing}
        <model-selector-button></model-selector-button>
      </div>
    `;
  }

  static styles = css`
    /* No backticks in this stylesheet: it is a tagged template literal, and one raw
       backtick ends it. tsc will not say so; esbuild will. */

    /* Every number below is the node's own, copied from the design pull — the same
       values compiled-output-viewer carries for this row, because it IS this row. */

    /* output-controls — 40001034:1186 */
    :host {
      display: block;
    }
    .controls {
      display: flex;
      gap: 10px;                    /* 40001034:1186 gap-[10px] */
      align-items: center;          /* 40001034:1186 items-center */
      height: 40px;                 /* 40001034:1186 h-[40px] */
      width: 100%;                  /* 40001034:1186 w-full */
      flex-shrink: 0;
      /* the menu's frame is the row it hangs off */
      position: relative;
    }

    /* ouput-selector-tile — 40001034:1187 (misspelled in Figma; the node id is the
       join key, so the name is left exactly as the designer wrote it) */
    .selector-tile {
      display: flex;
      flex: 1 0 0;                  /* 40001034:1187 flex-[1_0_0] */
      align-items: center;          /* 40001034:1187 items-center */
      height: 40px;                 /* 40001034:1187 h-[40px] */
      max-width: 500px;             /* 40001034:1187 max-w-[500px] */
      min-width: 1px;               /* 40001034:1187 min-w-px */
      padding: 0 10px;              /* 40001034:1187 px-[10px] */
      background: #F7F8F2;             /* 40001034:1187 bg-white */
      border: none;
      border-radius: 6px;           /* 40001034:1187 rounded-[6px] */
      /* 40001034:1187 drop-shadow — the applied blur is 5px. The "button drop"
         variable returned for this same node says radius 10. Both are recorded in the
         middle-column spec (O2); neither is silently dropped. */
      box-shadow: -4px -4px 5px rgba(0, 0, 0, 0.15),
                   4px 4px 5px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      font: inherit;
      text-align: left;
      box-sizing: border-box;
    }

    /* output-type — 40001034:1189; its text run is 40001034:1190 */
    .output-type {
      flex: 1 0 0;                  /* 40001034:1189 flex-[1_0_0] */
      min-width: 1px;               /* 40001034:1189 min-w-px */
      font-family: 'Inter', system-ui, sans-serif;  /* 40001034:1190 Inter:Bold */
      font-size: 18px;              /* 40001034:1190 text-[18px] */
      font-weight: 700;             /* 40001034:1190 font-bold */
      line-height: normal;          /* 40001034:1190 leading-[normal] */
      color: #171717;               /* 40001034:1190 text-[#171717] */
      white-space: nowrap;          /* 40001034:1190 whitespace-nowrap */
    }

    /* chevron-blue-closed — 40000922:4875: 40x40, p-[7px], 14x13 Arrow_drop_down */
    .chevron {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 7px;                 /* 40000922:4875 p-[7px] */
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .chevron img { display: block; width: 14px; height: 13px; }  /* 40000922:4872 */

    /* THE VIEW MENU — the list the tile's own annotation promised ("switching between the canvas
       view, the raw output, and more to come"), drawn below the tile it belongs to. The current
       view is MARKED, not disabled: choosing it again is a no-op the element answers by doing
       nothing (see _choose). */
    .view-menu {
      position: absolute; top: 44px; left: 0; z-index: 20;
      min-width: 170px; padding: 4px;
      display: flex; flex-direction: column;
      background: #F7F8F2;
      border: 1px solid var(--ds-rule);
      border-radius: 6px;
      box-shadow: -4px -4px 5px rgba(0, 0, 0, 0.10), 4px 4px 5px rgba(0, 0, 0, 0.10);
    }
    .view-item {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px; font-weight: 600;
      text-align: left; padding: 8px 10px;
      border: none; border-radius: 4px;
      background: transparent; color: #171717; cursor: pointer;
    }
    .view-item:hover { background: rgba(0, 0, 0, 0.06); }
    .view-item.current { color: var(--ds-teal); }
  `;
}

if (!customElements.get('output-controls')) customElements.define('output-controls', OutputControls);

declare global {
  interface HTMLElementTagNameMap {
    'output-controls': OutputControls;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'output-controls': React.DetailedHTMLProps<
        React.HTMLAttributes<OutputControls> & {
          ref?: React.Ref<OutputControls>;
        },
        OutputControls
      >;
    }
  }
}
