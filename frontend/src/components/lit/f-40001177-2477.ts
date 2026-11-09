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
 * text-input-area — measured from Figma node 40001177:2477
 * and rendered from the measurements. Every declaration below comes from the design; there is no
 * interpretation in this file, and re-ingesting the same node produces this same file.
 *
 * THE ONE THING HERE THAT IS NOT THE DESIGN'S is the seam: `behaviourProperties` on the line above
 * the styles, and the two lifecycle calls under it. They are the same bytes in every generated
 * element, and they hand this instance to the behaviour written for `f-40001177-2477` — a hand-written file no
 * ingest can write. Everything that is not a drawing lives there: extra props, listeners,
 * dispatched events, slot fills. This file holds the drawing and the opening.
 */
export class TextInputArea extends LitElement {
  static properties = {
    ...behaviourProperties('f-40001177-2477'),
  };

  /**
   * THE OPENING. Not a declaration of what this component does — a call to the file that says it.
   * That split is the whole reason a re-ingest of this node cannot take the component's props,
   * listeners or dispatch away: none of them are in this file to be taken.
   */
  connectedCallback() {
    super.connectedCallback();
    attachBehaviour(this, 'f-40001177-2477');
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    detachBehaviour(this, 'f-40001177-2477');
  }

  static styles = css`
    :host {
      position: relative;
      display: flex;
      flex-direction: row;
      gap: 10px;
      align-items: center;
      width: 530px;
      height: 25px;
      box-sizing: border-box;
    }
    .empty {
      position: relative;
      width: 530px;
      height: 25px;
      box-sizing: border-box;
      flex-grow: 1;
      align-self: stretch;
      font-family: "Inter", sans-serif;
      font-weight: 500;
      font-size: 16px;
      line-height: 25px;
      text-align: left;
      white-space: pre-wrap;
      color: #767676;
      word-break: break-word;
    }
  `;

  render() {
    return html`
      <div class="empty">Enter prompt text.</div>
    `;
  }
}

if (!customElements.get('f-40001177-2477')) {
  customElements.define('f-40001177-2477', TextInputArea);
}
