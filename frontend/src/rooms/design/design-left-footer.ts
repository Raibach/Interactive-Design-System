/**
 * <design-left-footer> — THE DESIGN ROOM'S COLUMN FOOTER, AND ITS ONE ACTION: SAVE.
 *
 * The Composer bar's plate — the same height, fill, rounded corner and inner shadow, read from
 * `control-bar.ts` — carrying ONE control in the Composer's RUN treatment (`control-bar.ts`,
 * `.btn-run`, node 40000761:267): the same gradient, the same black bold label at 18, the same
 * 43-pixel height, 142-pixel width and drop shadow. This room has no run, so the act at the bottom
 * of this column is saving the package (owner, 2026-10-31).
 *
 * APPLY CARBON STOOD HERE AND IS GONE (owner, 2026-10-31). A designer does not finish naming and
 * reading one design by applying a whole system to the room. The plate stays exactly as it is:
 * same height, fill, corner, inner shadow and position — only the control on it changes.
 *
 * IT DRAWS AND DISPATCHES, AND NOTHING ELSE. A press raises `design-left-save`; the seat that holds
 * the session answers it, because only it knows the title, the address, the notes and the package
 * that are being saved. The footer never fetches and never decides what saving means. `busy` and
 * `result` belong to the HOST: the seat sets them while the save is in flight and when it answers,
 * and the footer's own line under the fields is that answer, in the host's words.
 */
import { LitElement, css, html, nothing } from 'lit';

export class DesignLeftFooter extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: flex-end;
      height: 70px;
      width: 100%;
      box-sizing: border-box;
      padding: 13px 38px;
      background: rgba(181, 204, 206, 0.75);
      border-radius: 0px 0px 10px 0px;
      position: relative;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
    }
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 3px -4px 10px 0px rgba(0, 0, 0, 0.15),
                  inset 0px 4px 4px 0px rgba(0, 0, 0, 0.1);
    }
    /* THE COMPOSER'S RUN TREATMENT (control-bar.ts, node 40000761:267), unchanged: the gradient
       runs to the left, the label is black at 18 and bold, the box is 43 by 142 with the same
       two-part drop shadow. The room's own control keeps the room's words. */
    .save {
      position: relative;
      z-index: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      height: 43px;
      width: 142px;
      padding: 0;
      border: none;
      border-radius: 6px;
      background: linear-gradient(to left, #f0b424 0%, #fed141 100%);
      color: #000;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 18px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
      box-shadow: -4px -4px 10px 0px rgba(0, 0, 0, 0.15),
                   4px 4px 4px 0px rgba(0, 0, 0, 0.25);
    }
    .save:hover { filter: brightness(1.08); }
    .save:disabled { opacity: 0.7; cursor: not-allowed; }
    .save.saving {
      background: linear-gradient(to left, #d4991f 0%, #e0b830 100%);
      cursor: wait;
    }
    /* THE TWO ACTIONS SIT TOGETHER AT THE FOOT: the next session, then the save. */
    .actions {
      position: relative;
      z-index: 1;
      display: flex;
      align-items: center;
      gap: 12px;
      flex-shrink: 0;
    }
    .new {
      height: 43px;
      min-width: 128px;
      padding: 0 14px;
      border: 1px solid rgba(35, 67, 84, 0.28);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.55);
      color: #234354;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .new:hover {
      background: rgba(255, 255, 255, 0.82);
      border-color: rgba(35, 67, 84, 0.45);
    }
    .new:disabled { opacity: 0.6; cursor: not-allowed; }
    /* Runtime state, not in the design — the Composer's own spinner. */
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 3px solid rgba(0, 0, 0, 0.15);
      border-top-color: #000;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .result {
      position: relative;
      z-index: 1;
      margin-right: 12px;
      font-size: 12px;
      color: #2f4a4c;
      max-width: 42ch;
    }
  `;

  static properties = {
    /** The host's answer after a save — one line beside the control. */
    result: { type: String },
    /** Set by the host while the save is in flight; locks the control and reads "Saving...". */
    busy: { type: Boolean },
  };
  declare result: string;
  declare busy: boolean;

  constructor() {
    super();
    this.result = '';
    this.busy = false;
  }

  private _onSave() {
    if (this.busy) return;
    this.dispatchEvent(new CustomEvent('design-left-save', { bubbles: true, composed: true }));
  }

  /*
   * THE SECOND CONTROL: START THE NEXT SESSION HERE. The press ends the session that stands —
   * the seat asks the same Save or Discard question the tab's leave asks, then builds the next
   * Tools session in place — and this element only says that the press happened.
   */
  private _onNew() {
    if (this.busy) return;
    this.dispatchEvent(new CustomEvent('design-left-new', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      ${this.result ? html`<span class="result">${this.result}</span>` : nothing}
      <div class="actions">
        <button
          class="new"
          type="button"
          ?disabled=${this.busy}
          title="Create new session"
          @click=${this._onNew}
        >
          Create new
        </button>
        <button
          class="save ${this.busy ? 'saving' : ''}"
          type="button"
          ?disabled=${this.busy}
          title="Save"
          @click=${this._onSave}
        >
          ${this.busy
            ? html`<span class="spinner"></span> <span>Saving...</span>`
            : 'SAVE'}
        </button>
      </div>
    `;
  }
}

if (!customElements.get('design-left-footer')) {
  customElements.define('design-left-footer', DesignLeftFooter);
}
