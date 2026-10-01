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
 * Catalog_node — measured from Figma node 40001206:3423
 * and rendered from the measurements. Every declaration below comes from the design; there is no
 * interpretation in this file, and re-ingesting the same node produces this same file.
 *
 * THE ONE THING HERE THAT IS NOT THE DESIGN'S is the seam: `behaviourProperties` on the line above
 * the styles, and the two lifecycle calls under it. They are the same bytes in every generated
 * element, and they hand this instance to the behaviour written for `f-40001206-3423` — a hand-written file no
 * ingest can write. Everything that is not a drawing lives there: extra props, listeners,
 * dispatched events, slot fills. This file holds the drawing and the opening.
 */
export class CatalogNode extends LitElement {
  static properties = {
    ...behaviourProperties('f-40001206-3423'),
  };

  /**
   * THE OPENING. Not a declaration of what this component does — a call to the file that says it.
   * That split is the whole reason a re-ingest of this node cannot take the component's props,
   * listeners or dispatch away: none of them are in this file to be taken.
   */
  connectedCallback() {
    super.connectedCallback();
    attachBehaviour(this, 'f-40001206-3423');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    detachBehaviour(this, 'f-40001206-3423');
  }

  static styles = css`
    :host {
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
  `;

  render() {
    return html`
      <svg width="17.24" height="17.98" viewBox="5.38 5.01 17.24 17.98" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 5.38 14.0 C 5.38 12.24 5.61 10.61 6.08 9.13 C 6.55 7.65 7.28 6.28 8.25 5.01 L 11.14 5.01 C 10.77 5.48 10.43 6.05 10.11 6.73 C 9.79 7.4 9.51 8.14 9.28 8.95 C 9.04 9.75 8.86 10.58 8.72 11.45 C 8.59 12.3 8.52 13.15 8.52 14.0 C 8.52 15.12 8.64 16.25 8.87 17.4 C 9.1 18.54 9.41 19.6 9.8 20.58 C 10.2 21.56 10.65 22.36 11.14 22.99 L 8.25 22.99 C 7.28 21.72 6.55 20.35 6.08 18.87 C 5.61 17.39 5.38 15.76 5.38 14.0 Z" fill="#ffffff"/><path d="M 22.62 14.0 C 22.62 15.76 22.39 17.39 21.91 18.87 C 21.44 20.35 20.72 21.72 19.75 22.99 L 16.86 22.99 C 17.23 22.52 17.57 21.95 17.89 21.27 C 18.21 20.59 18.49 19.85 18.72 19.05 C 18.96 18.25 19.14 17.41 19.28 16.55 C 19.41 15.69 19.48 14.84 19.48 14.0 C 19.48 12.87 19.36 11.74 19.13 10.6 C 18.9 9.46 18.59 8.4 18.19 7.42 C 17.8 6.44 17.35 5.64 16.86 5.01 L 19.75 5.01 C 20.72 6.28 21.44 7.65 21.91 9.13 C 22.39 10.61 22.62 12.24 22.62 14.0 Z" fill="#ffffff"/></svg>
    `;
  }
}

if (!customElements.get('f-40001206-3423')) {
  customElements.define('f-40001206-3423', CatalogNode);
}
