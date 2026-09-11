/**
 * <workspace-layout> — Lit resizable 3-column workspace (A2UI v0.9.1)
 *
 * Responsive flex baseline: the columns share space via flex-grow and squish
 * with the browser (the browser is the hard limit — nothing pushes past its
 * edges). The middle column (compiled output) always flexes; it never holds a
 * fixed width, so it can't push the stage to the right.
 *
 * The 60px left rail and 60px chat floor are COLLAPSED widths. They only
 * engage while the user drags the gripper to dock/collapse a column — they are
 * minimums, not fixed widths, so the expanded layout stays fully responsive.
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
    leftCollapsed: { type: Boolean, attribute: 'left-collapsed', reflect: true },
  };

  declare isThirdOpen: boolean;
  declare showMiddle: boolean;
  declare leftCollapsed: boolean;

  private static readonly MIN_LEFT_PX = 60;
  private static readonly MIN_CHAT_PX = 60;
  private static readonly SNAP_PX = 16;

  // Flex-grow proportions. Equal (1/1/1) by default → balanced columns.
  private _left = 1;
  private _middle = 1;
  private _right = 1;

  private _dragging: 'left' | 'right' | null = null;
  private _startX = 0;
  private _start = { left: 1, middle: 1, right: 1 };

  constructor() {
    super();
    this.isThirdOpen = true;
    this.showMiddle = false; // composer starts 2-column until Run produces output
    this.leftCollapsed = false;
  }

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
    this.setAttribute('dragging', '');
    this._dragging = side;
    this._startX = e.clientX;
    this._start = { left: this._left, middle: this._middle, right: this._right };
    this.dispatchEvent(new CustomEvent('resize-start', { detail: { side } }));
    e.preventDefault();
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._dragging) return;
    const delta = e.clientX - this._startX;
    const w = Math.max(1, this.clientWidth);
    const grip = this.showMiddle ? 10 : 5; // two 5px grippers in 3-column, one in 2-column

    if (!this.showMiddle) {
      // 2-column: left vs right. Compute left in px, snap/clamp, then convert
      // back to a grow ratio so the baseline stays responsive.
      const total = this._start.left + this._start.right;
      const content = Math.max(1, w - grip);
      let leftPx = (this._start.left / total) * content + delta;
      if (Math.abs(leftPx - WorkspaceLayout.MIN_LEFT_PX) <= WorkspaceLayout.SNAP_PX) {
        leftPx = WorkspaceLayout.MIN_LEFT_PX;
      }
      const maxLeft = content - WorkspaceLayout.MIN_CHAT_PX;
      leftPx = Math.max(WorkspaceLayout.MIN_LEFT_PX, Math.min(leftPx, maxLeft));
      const newLeft = (leftPx / content) * total;
      this._left = newLeft;
      this._right = total - newLeft;
      this.leftCollapsed = leftPx <= WorkspaceLayout.MIN_LEFT_PX + 1;
    } else if (this._dragging === 'left') {
      // 3-column: left vs middle.
      const total = this._start.left + this._start.middle;
      const content = Math.max(1, w - grip);
      let leftPx = (this._start.left / total) * content + delta;
      if (Math.abs(leftPx - WorkspaceLayout.MIN_LEFT_PX) <= WorkspaceLayout.SNAP_PX) {
        leftPx = WorkspaceLayout.MIN_LEFT_PX;
      }
      const maxLeft = content - WorkspaceLayout.MIN_CHAT_PX;
      leftPx = Math.max(WorkspaceLayout.MIN_LEFT_PX, Math.min(leftPx, maxLeft));
      const newLeft = (leftPx / content) * total;
      this._left = newLeft;
      this._middle = total - newLeft;
      this.leftCollapsed = leftPx <= WorkspaceLayout.MIN_LEFT_PX + 1;
    } else {
      // 3-column: middle vs right.
      const total = this._start.middle + this._start.right;
      const content = Math.max(1, w - grip);
      let rightPx = (this._start.right / total) * content - delta;
      const maxRight = content - WorkspaceLayout.MIN_LEFT_PX;
      rightPx = Math.max(WorkspaceLayout.MIN_CHAT_PX, Math.min(rightPx, maxRight));
      const newRight = (rightPx / content) * total;
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
    this.removeAttribute('dragging');
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

    /* When the left column is docked to its rail, collapse the slotted content
       down to just the "Agent Prompting" format-rail tab. These custom
       properties inherit across the shadow boundary, so the slotted components
       hide their own bodies while the rail stays visible. */
    :host {
      --left-sections-display: block;
      --left-control-display: flex;
    }
    :host([left-collapsed]) {
      --left-sections-display: none;
      --left-control-display: none;
    }

    /* The flex-grow transition animates the middle column open on Run. It must
       NOT apply while dragging — every mousemove writes a new grow, and easing
       each one makes the pane chase the cursor (feels like resistance). */
    :host([dragging]) .pane { transition: none; }
    :host([dragging]) {
      user-select: none;
      cursor: col-resize;
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
    const middleGrow = this.showMiddle ? this._middle : 0;
    const rightGrow = this.isThirdOpen ? this._right : 0;
    const minLeft = WorkspaceLayout.MIN_LEFT_PX;
    const minChat = this.isThirdOpen ? WorkspaceLayout.MIN_CHAT_PX : 0;

    return html`
      <div class="pane left" style="flex: ${this._left} 1 0%; min-width: ${minLeft}px;"><slot name="left"></slot></div>
      <div class="gripper" @mousedown=${(e: MouseEvent) => this._onGripDown('left', e)}></div>
      <div class="pane middle ${this.showMiddle ? '' : 'collapsed'}" style="flex: ${middleGrow} 1 0%;"><slot name="middle"></slot></div>
      <div class="gripper ${this.showMiddle ? '' : 'collapsed'}" @mousedown=${(e: MouseEvent) => this._onGripDown('right', e)} @dblclick=${this._toggleThird}></div>
      <div class="pane right ${this.isThirdOpen ? '' : 'collapsed'}" style="flex: ${rightGrow} 1 0%; min-width: ${minChat}px;"><slot name="right"></slot></div>
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
