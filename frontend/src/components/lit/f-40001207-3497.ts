import { LitElement, html, css } from 'lit';

/**
 * catalog-component-node-raibach-ids — measured from Figma node 40001207:3497
 * and rendered from the measurements. Every declaration below comes from the design; there is no
 * interpretation in this file, and re-ingesting the same node produces this same file.
 */
export class CatalogComponentNodeRaibachIds extends LitElement {
  static properties = {};

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      gap: 1px;
      width: 622px;
      height: 40px;
      box-sizing: border-box;
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
      width: 307px;
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
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .data-tree-catalog {
      display: flex;
      flex-direction: row;
      gap: 7px;
      align-items: center;
      width: 342px;
      height: 42px;
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
    .frame-887025 {
      display: flex;
      flex-direction: row;
      align-items: center;
      width: 382px;
      height: 40px;
      box-sizing: border-box;
      flex-grow: 1;
      align-self: stretch;
    }
    .functions-label {
      position: relative;
      width: 165px;
      height: 43px;
      box-sizing: border-box;
      font-family: "Inter", sans-serif;
      font-weight: 500;
      font-size: 12px;
      line-height: 14.5227px;
      text-align: left;
      white-space: pre-wrap;
      color: #171717;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
    .id-label {
      display: flex;
      flex-direction: row;
      padding-top: 3px;
      padding-bottom: 3px;
      justify-content: center;
      align-items: center;
      width: 165px;
      height: 40px;
      box-sizing: border-box;
      align-self: stretch;
      align-self: stretch;
    }
    .catalog-description-dt {
      display: flex;
      flex-direction: row;
      padding-left: 3px;
      padding-right: 3px;
      gap: 10px;
      align-items: center;
      width: 198px;
      height: 40px;
      box-sizing: border-box;
      border-radius: 6px;
    }
  `;

  render() {
    return html`
      <div class="slot-status-icon-container"></div><div class="frame-887025"><div class="data-tree-catalog"><div class="catalog-node"><svg width="17.24" height="17.98" viewBox="208.38 517.01 17.24 17.98" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 208.38 526.0 C 208.38 524.24 208.61 522.61 209.08 521.13 C 209.55 519.65 210.28 518.28 211.25 517.01 L 214.14 517.01 C 213.77 517.48 213.43 518.05 213.11 518.73 C 212.79 519.4 212.51 520.14 212.28 520.95 C 212.04 521.75 211.86 522.58 211.72 523.45 C 211.59 524.3 211.52 525.15 211.52 526.0 C 211.52 527.12 211.64 528.25 211.87 529.4 C 212.1 530.54 212.41 531.6 212.8 532.58 C 213.2 533.56 213.65 534.36 214.14 534.99 L 211.25 534.99 C 210.28 533.72 209.55 532.35 209.08 530.87 C 208.61 529.39 208.38 527.76 208.38 526.0 Z" fill="#ffffff"/><path d="M 225.62 526.0 C 225.62 527.76 225.39 529.39 224.91 530.87 C 224.44 532.35 223.72 533.72 222.75 534.99 L 219.86 534.99 C 220.23 534.52 220.57 533.95 220.89 533.27 C 221.21 532.59 221.49 531.85 221.72 531.05 C 221.96 530.25 222.14 529.41 222.28 528.55 C 222.41 527.69 222.48 526.84 222.48 526.0 C 222.48 524.87 222.36 523.74 222.13 522.6 C 221.9 521.46 221.59 520.4 221.19 519.42 C 220.8 518.44 220.35 517.64 219.86 517.01 L 222.75 517.01 C 223.72 518.28 224.44 519.65 224.91 521.13 C 225.39 522.61 225.62 524.24 225.62 526.0 Z" fill="#ffffff"/></svg></div><div class="catalog-name"><span style="font-family: 'Inter', sans-serif; font-weight: 600">Components (prompt-composer)<br/></span><span style="color: #767676">catalogue reads 58</span></div></div><div class="chevron-blue-closed"><div class="arrow-drop-down"><svg width="10.0" height="6.0" viewBox="560.0 523.0 10.0 6.0" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M 564.81 528.77 L 561.09 524.31 C 560.66 523.79 561.03 523.0 561.71 523.0 L 568.29 523.0 C 568.97 523.0 569.34 523.79 568.91 524.31 L 565.19 528.77 C 565.09 528.89 564.91 528.89 564.81 528.77 Z" fill="#4e68d2"/></svg></div></div></div><div class="catalog-description-dt"><div class="id-label"><div class="functions-label">FigmaNode: 40001185-2176<br/>System Role Dropdown used in prompt area</div></div></div>
    `;
  }
}

if (!customElements.get('f-40001207-3497')) {
  customElements.define('f-40001207-3497', CatalogComponentNodeRaibachIds);
}
