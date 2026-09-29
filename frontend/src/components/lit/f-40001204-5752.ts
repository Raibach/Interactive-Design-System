import { LitElement, html, css } from 'lit';
// The dropdown chevron, INLINE — it is not a file any more. It was `assets/figma-9598a83b….svg`:
// an image living in an assets folder, loadable by path from anywhere and reachable by name. A
// data URI has no path and no name, so nothing else in this repository can point at it and no
// preview can resolve it.
const arrowDropDown = "data:image/svg+xml;utf8,<svg preserveAspectRatio='none' overflow='visible' style='display: block;' width='14' height='13' viewBox='0 0 14 13' fill='none' xmlns='http://www.w3.org/2000/svg'><g id='Arrow_drop_down'><rect x='0.5' y='0.5' width='13' height='12' rx='0.5' stroke='%234E68D2'/><path id='Vector 10' d='M6.80794 9.76953L3.09346 5.31215C2.65924 4.79109 3.02976 4 3.70803 4L10.292 4C10.9702 4 11.3408 4.79108 10.9065 5.31215L7.19206 9.76953C7.09211 9.88947 6.90789 9.88947 6.80794 9.76953Z' fill='%234E68D2'/></g></svg>";

export class F400012045752 extends LitElement {
  static properties = {};

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 11px;
      background: #ebf6f5;
      width: 775px;
      box-sizing: border-box;
    }
    .system-role-dropdown {
      display: flex;
      flex-direction: row;
      align-items: flex-start;
      flex: 1 0 0;
      min-width: 284px;
      background: #ffffff;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.15), -4px -4px 10px rgba(0, 0, 0, 0.15);
      box-sizing: border-box;
    }
    .chevron-blue-closed {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 7px;
      width: 40px;
      height: 40px;
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .arrow-drop-down {
      width: 14px;
      height: 13px;
      display: block;
    }
    .dropdwon-tile {
      display: flex;
      flex-direction: row;
      align-items: center;
      flex: 1 0 0;
      min-width: 1px;
      height: 40px;
      box-sizing: border-box;
    }
    .empty {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 18px;
      line-height: 21.784090042114258px;
      letter-spacing: 0px;
      color: #171717;
      text-align: left;
      word-break: break-word;
      width: 524px;
      flex-shrink: 0;
    }
    .tool-dropdown {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      width: 200px;
      flex-shrink: 0;
      background: #ffffff;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.15), -4px -4px 10px rgba(0, 0, 0, 0.15);
      box-sizing: border-box;
    }
    .tile-label {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      flex: 1 0 0;
      min-width: 1px;
      height: 40px;
      box-sizing: border-box;
    }
    .system-role-text {
      font-family: 'Inter', sans-serif;
      font-weight: 700;
      font-size: 18px;
      line-height: 21.784090042114258px;
      letter-spacing: 0px;
      color: #171717;
      text-align: left;
      word-break: break-word;
      flex: 1 0 0;
      min-width: 1px;
    }
  `;

  constructor() {
    super();
  }

  render() {
    return html`
      <div class="system-role-dropdown" data-node-id="40001185:2168" data-name="system-role-dropdown">
        <div class="chevron-blue-closed" data-node-id="40001185:2170" data-name="chevron-blue-closed">
          <img class="arrow-drop-down" data-node-id="I40001185:2170;40000922:4872" data-name="Arrow_drop_down" src="${arrowDropDown}" alt="" />
        </div>
        <div class="dropdwon-tile" data-node-id="40001185:2169" data-name="dropdwon-tile">
          <p class="empty" data-node-id="40001185:2172" data-name="empty">System Role</p>
        </div>
      </div>
      <div class="tool-dropdown" data-node-id="40001185:2161" data-name="tool-dropdown">
        <div class="tile-label" data-node-id="40001185:2162" data-name="tile-label">
          <div class="chevron-blue-closed" data-node-id="40001185:2163" data-name="chevron-blue-closed">
            <img class="arrow-drop-down" data-node-id="I40001185:2163;40000922:4872" data-name="Arrow_drop_down" src="${arrowDropDown}" alt="" />
          </div>
          <div class="system-role-text" data-node-id="40001185:2164" data-name="System Role">Tools</div>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('f-40001204-5752')) {
  customElements.define('f-40001204-5752', F400012045752);
}
