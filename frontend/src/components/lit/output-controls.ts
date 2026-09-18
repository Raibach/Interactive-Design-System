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
import { LitElement, html, css } from 'lit';
// Chevron artwork for ouput-selector-tile / chevron-blue-closed — node 40000922:4875,
// child "Arrow_drop_down" (40000922:4872, 14x13). The same asset role-tile.ts and
// compiled-output-viewer.ts import; the design references one file from several places,
// so it is imported, not re-drawn.
import arrowDropDown from '../../assets/figma-9598a83b0a4eb9b9fc9c226f302689fd4f7075df.svg';
// The model control is its own published component (model-btn-label 40000973:24205).
// Instantiating it is what the viewer does too: it owns 171x40 + radius 6 + "Models",
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
  };

  declare outputType: string;

  constructor() {
    super();
    this.outputType = 'Agent Flow';          // node 40001034:1190
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
        <button class="selector-tile" type="button" aria-haspopup="menu">
          <span class="output-type">${this.outputType}</span>
          <span class="chevron"><img src=${arrowDropDown} alt="" /></span>
        </button>
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
      background: #fff;             /* 40001034:1187 bg-white */
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
