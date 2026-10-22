/**
 * <tools-left-panel> — THE TOOLS EXPERIENCE'S OWN LEFT COLUMN (owner, 2026-10-18).
 *
 * The Figma ingestion program's left column is its own frame: the ingest form over the layers
 * tree. The design room has its own panel (`design-left-panel`); the console has its own grid.
 * This one belongs to Tools and to nothing else — a new element, not a borrow of either.
 *
 * It carries a `<slot>` because the SURFACE fills it by id: the tools surface names its
 * children in this element's `children`, and the renderer instantiates them here. It gives its
 * children the box and nothing else; whether the tree scrolls, and what it scrolls, is the
 * children's own business.
 */
import { LitElement, html, css } from 'lit';

export class ToolsLeftPanel extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      width: 100%;
      overflow: hidden;
    }
    ::slotted(*) {
      min-height: 0;
    }
  `;

  render() {
    return html`<slot></slot>`;
  }
}

if (!customElements.get('tools-left-panel')) customElements.define('tools-left-panel', ToolsLeftPanel);

declare global {
  interface HTMLElementTagNameMap {
    'tools-left-panel': ToolsLeftPanel;
  }
}
