/**
 * <workspace-layout> — Lit resizable 3-column workspace (A2UI v0.9.1)
 *
 * Balanced by default:
 *   - Composer (2-column) splits 50/50 (prompt editor | chat).
 *   - On Run, the middle column (compiled output) animates open to an even
 *     3-way split — unless the user has already resized it.
 *
 * Named slots:
 *   - slot="left"   — prompt-section-editor
 *   - slot="middle" — compiled-output-viewer
 *   - slot="right"  — chat-panel (or other right column content)
 *
 * Events:
 *   resize-start, resize, resize-end, third-column-toggle
 *
 * The React shell (WritingAreaIndex) hosts this inside slot="workspace"
 * of ai-surface-sandbox and binds only `show-middle` (visibility), never widths.
 */

import { LitElement, html, css } from 'lit';

export class WorkspaceLayout extends LitElement {
  static properties = {
    isThirdOpen: { type: Boolean, attribute: 'is-third-open' },
    showMiddle: { type: Boolean, attribute: 'show-middle' },
  };

  declare isThirdOpen: boolean;
  declare showMiddle: boolean;

  // Flex-grow proportions. Equal (1/1/1) by default → balanced columns.
  private _left = 1;
  private _middle = 1;
  private _right = 1;

  constructor() {
    super();
    this.isThirdOpen = true;
    this.showMiddle = false; // composer starts 2-column until Run produces output
  }

  private _dragging: 'left' | 'right' | null = null;
  private _startX = 0;
  private _start = { left: 1, middle: 1, right: 1 };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('mousemove', this._onMouseMove as EventListener);
    document.addEventListener('mouseup', this._onMouseUp as EventListener);
  }

  disconnectedCallback(): void {
    document.removeEventListener('mousemove', this._onMouseMove as EventListener);
    document.removeEventListener('mouseup', this._onMouseUp as EventListener);
    super.disconnectedCallback();
  }

  private _onGripDown = (side: 'left' | 'right', e: MouseEvent): void => {
    this._dragging = side;
    this._startX = e.clientX;
    this._start = { left: this._left, middle: this._middle, right: this._right };
    this.dispatchEvent(new CustomEvent('resize-start', { detail: { side } }));
    e.preventDefault();
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._dragging) return;
    const delta = e.clientX - this._startX;
    const usable = Math.max(1, this.clientWidth);

    if (!this.showMiddle) {
      // 2-column: left vs right (the single gripper is the left↔right boundary).
      const total = this._start.left + this._start.right;
      const leftPx = (this._start.left / total) * usable + delta;
      const newLeft = Math.max(0.2, (leftPx / usable) * total);
      this._left = newLeft;
      this._right = total - newLeft;
    } else if (this._dragging === 'left') {
      // 3-column: left vs middle.
      const total = this._start.left + this._start.middle;
      const leftPx = (this._start.left / total) * usable + delta;
      const newLeft = Math.max(0.2, (leftPx / usable) * total);
      this._left = newLeft;
      this._middle = total - newLeft;
    } else {
      // 3-column: middle vs right.
      const total = this._start.middle + this._start.right;
      const rightPx = (this._start.right / total) * usable - delta;
      const newRight = Math.max(0.2, (rightPx / usable) * total);
      this._right = newRight;
      this._middle = total - newRight;
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('resize', { detail: { side: this._dragging } }));
  };

  private _onMouseUp = (): void => {
    if (this._dragging) {
      this.dispatchEvent(new CustomEvent('resize-end', {
        detail: { left: this._left, middle: this._middle, right: this._right },
      }));
    }
    this._dragging = null;
  };

  private _toggleThird = (): void => {
    this.isThirdOpen = !this.isThirdOpen;
    this.dispatchEvent(new CustomEvent('third-column-toggle', { detail: { open: this.isThirdOpen } }));
  };

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    .pane {
      overflow: auto;
      min-height: 0;
      min-width: 0;
      transition: flex-grow 0.35s ease;
    }
    .pane.collapsed {
      overflow: hidden;
    }

    .gripper {
      width: 5px;
      background: #d1d5db;
      cursor: col-resize;
      flex-shrink: 0;
      transition: background 0.1s, width 0.35s ease;
    }
    .gripper.collapsed {
      width: 0;
    }
    .gripper:hover { background: #9ca3af; }
    .gripper:active { background: #6b7280; }
  `;

  render() {
    // Always render three columns; collapse the middle (and its gripper) to 0
    // when it isn't shown so the transition can animate it open on Run.
    const middleGrow = this.showMiddle ? this._middle : 0;
    const rightGrow = this.isThirdOpen ? this._right : 0;

    return html`
      <div class="pane left" style="flex: ${this._left} 1 0%;"><slot name="left"></slot></div>
      <div class="gripper" @mousedown=${(e: MouseEvent) => this._onGripDown('left', e)}></div>
      <div class="pane middle ${this.showMiddle ? '' : 'collapsed'}" style="flex: ${middleGrow} 1 0%;"><slot name="middle"></slot></div>
      <div class="gripper ${this.showMiddle ? '' : 'collapsed'}" @mousedown=${(e: MouseEvent) => this._onGripDown('right', e)} @dblclick=${this._toggleThird}></div>
      <div class="pane right ${this.isThirdOpen ? '' : 'collapsed'}" style="flex: ${rightGrow} 1 0%;"><slot name="right"></slot></div>
    `;
  }
}

customElements.define('workspace-layout', WorkspaceLayout);

declare global {
  interface HTMLElementTagNameMap {
    'workspace-layout': WorkspaceLayout;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'workspace-layout': React.DetailedHTMLProps<
        React.HTMLAttributes<WorkspaceLayout> & {
          'is-third-open'?: '' | boolean;
          'show-middle'?: '' | boolean;
        },
        WorkspaceLayout
      >;
    }
  }
}