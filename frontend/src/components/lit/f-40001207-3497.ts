import { LitElement, html, css } from 'lit';
// THE SEAM. A hand-written loader, never generated — see connectedCallback below.
//
// IT IS A RELATIVE PATH ON PURPOSE, and it resolves in the two places this file is ever loaded:
// in the catalogue, `src/components/lit/behaviour/attach.ts` (the real loader, beside this file);
// in a PREVIEW, the inert copy the ingest writes into `.preview/<jobId>/behaviour/attach.ts`, so a
// preview resolves locally and never imports anything the application ships — a preview is blind to
// the catalogue (owner, 2026-09-30: *"whenever it's in the preview it should be blind to the lit
// catalogue… It shouldn't have any idea"*; see vite-plugin-figma-preview.ts). The file this
// generates is therefore byte-identical to the file that will be committed, and which loader it
// reaches is decided by where it is read from.
import { attachBehaviour, detachBehaviour, behaviourProperties } from './behaviour/attach';

/**
 * catalog-component-node-raibach-ids — measured from Figma node 40001207:3497
 * and rendered from the measurements. Every declaration below comes from the design; there is no
 * interpretation in this file, and re-ingesting the same node produces this same file.
 *
 * THE ONE THING HERE THAT IS NOT THE DESIGN'S is the seam: `behaviourProperties` on the line above
 * the styles, and the two lifecycle calls under it. They are the same bytes in every generated
 * element, and they hand this instance to the behaviour written for `f-40001207-3497` — a hand-written file no
 * ingest can write. Everything that is not a drawing lives there: extra props, listeners,
 * dispatched events, slot fills. This file holds the drawing and the opening.
 */
export class CatalogComponentNodeRaibachIds extends LitElement {
  static properties = {
    ...behaviourProperties('f-40001207-3497'),
  };

  /**
   * THE OPENING. Not a declaration of what this component does — a call to the file that says it.
   * That split is the whole reason a re-ingest of this node cannot take the component's props,
   * listeners or dispatch away: none of them are in this file to be taken.
   */
  connectedCallback() {
    super.connectedCallback();
    attachBehaviour(this, 'f-40001207-3497');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    detachBehaviour(this, 'f-40001207-3497');
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      gap: 1px;
      width: 622px;
      height: 40px;
      box-sizing: border-box;
      background: #ffffff;
    }
    .slot-status-icon-container {
      display: flex;
      flex-direction: column;
      padding-left: 10px;
      padding-right: 10px;
      padding-top: 10px;
      padding-bottom: 10px;
      gap: 10px;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      box-sizing: border-box;
    }
    .data-tree-spacer {
      position: relative;
      width: 11px;
      height: 40px;
      box-sizing: border-box;
      align-self: stretch;
    }
    .catalog-node {
      display: flex;
      flex-direction: row;
      gap: 10px;
      justify-content: center;
      align-items: center;
      width: 28px;
      height: 28px;
      box-sizing: border-box;
      background: #79a99c;
      border-radius: 6px;
      box-shadow: 0px 4px 4px rgba(0, 0, 0, 0.25);
    }
    .catalog-name {
      position: relative;
      width: 237px;
      height: 42px;
      box-sizing: border-box;
      flex-grow: 1;
      align-self: stretch;
      font-family: "Inter", sans-serif;
      font-weight: 500;
      font-size: 14px;
      line-height: 16px;
      text-align: left;
      white-space: pre-wrap;
      color: #171717;
      word-break: break-word;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .catalog-name-lines {
      display: block;
      max-height: 32px;
      overflow: hidden;
    }
    .data-tree-catalog {
      display: flex;
      flex-direction: row;
      gap: 7px;
      align-items: center;
      width: 272px;
      height: 42px;
      box-sizing: border-box;
      flex-grow: 1;
      align-self: stretch;
    }
    .frame-887026 {
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 272px;
      height: 40px;
      box-sizing: border-box;
      flex-grow: 1;
      align-self: stretch;
    }
    .arrow-drop-down {
      display: flex;
      flex-direction: column;
      padding-left: 2px;
      padding-right: 2px;
      padding-top: 3px;
      padding-bottom: 3px;
      gap: 10px;
      justify-content: center;
      align-items: center;
      width: 16px;
      height: 14px;
      box-sizing: border-box;
      border-radius: 1px;
      border: 1px solid #4e68d2;
    }
    .chevron-blue-closed {
      display: flex;
      flex-direction: column;
      padding-left: 7px;
      padding-right: 7px;
      padding-top: 7px;
      padding-bottom: 7px;
      gap: 10px;
      justify-content: center;
      align-items: center;
      width: 40px;
      height: 40px;
      box-sizing: border-box;
    }
    .functions-label {
      position: relative;
      width: 249px;
      height: 43px;
      box-sizing: border-box;
      flex-grow: 1;
      align-self: stretch;
      font-family: "Inter", sans-serif;
      font-weight: 500;
      font-size: 12px;
      line-height: 14.5227px;
      text-align: left;
      white-space: pre-wrap;
      color: #171717;
      word-break: break-word;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .functions-label-lines {
      display: block;
      max-height: 29.0455px;
      overflow: hidden;
    }
    .catalog-description-dt {
      display: flex;
      flex-direction: row;
      padding-left: 3px;
      padding-right: 3px;
      gap: 10px;
      align-items: center;
      width: 255px;
      height: 40px;
      box-sizing: border-box;
      border-radius: 6px;
    }
  `;

  render() {
    return html`
      <div class="slot-status-icon-container"></div><div class="data-tree-spacer"></div><div class="frame-887026"><div class="data-tree-catalog"><div class="catalog-node"><svg width="17.24" height="17.98" viewBox="346.38 476.01 17.24 17.98" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 346.38 485.0 C 346.38 483.24 346.61 481.61 347.08 480.13 C 347.55 478.65 348.28 477.28 349.25 476.01 L 352.14 476.01 C 351.77 476.48 351.43 477.05 351.11 477.73 C 350.79 478.4 350.51 479.14 350.28 479.95 C 350.04 480.75 349.86 481.58 349.72 482.45 C 349.59 483.3 349.52 484.15 349.52 485.0 C 349.52 486.12 349.64 487.25 349.87 488.4 C 350.1 489.54 350.41 490.6 350.8 491.58 C 351.2 492.56 351.65 493.36 352.14 493.99 L 349.25 493.99 C 348.28 492.72 347.55 491.35 347.08 489.87 C 346.61 488.39 346.38 486.76 346.38 485.0 Z" fill="#ffffff"/><path d="M 363.62 485.0 C 363.62 486.76 363.39 488.39 362.91 489.87 C 362.44 491.35 361.72 492.72 360.75 493.99 L 357.86 493.99 C 358.23 493.52 358.57 492.95 358.89 492.27 C 359.21 491.59 359.49 490.85 359.72 490.05 C 359.96 489.25 360.14 488.41 360.28 487.55 C 360.41 486.69 360.48 485.84 360.48 485.0 C 360.48 483.87 360.36 482.74 360.13 481.6 C 359.9 480.46 359.59 479.4 359.19 478.42 C 358.8 477.44 358.35 476.64 357.86 476.01 L 360.75 476.01 C 361.72 477.28 362.44 478.65 362.91 480.13 C 363.39 481.61 363.62 483.24 363.62 485.0 Z" fill="#ffffff"/></svg></div><div class="catalog-name"><span class="catalog-name-lines"><span style="font-family: 'Inter', sans-serif; font-weight: 600">Components (prompt-composer)<br/></span><span style="color: #767676">catalogue reads 58b</span></span></div></div></div><div class="chevron-blue-closed"><div class="arrow-drop-down"><svg width="10.0" height="6.0" viewBox="629.0 482.0 10.0 6.0" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 633.81 487.77 L 630.09 483.31 C 629.66 482.79 630.03 482.0 630.71 482.0 L 637.29 482.0 C 637.97 482.0 638.34 482.79 637.91 483.31 L 634.19 487.77 C 634.09 487.89 633.91 487.89 633.81 487.77 Z" fill="#4e68d2"/></svg></div></div><div class="catalog-description-dt"><div class="functions-label"><span class="functions-label-lines">FigmaNode: 40001185-2176 System Role Dropdown used in prompt area</span></div></div>
    `;
  }
}

if (!customElements.get('f-40001207-3497')) {
  customElements.define('f-40001207-3497', CatalogComponentNodeRaibachIds);
}
