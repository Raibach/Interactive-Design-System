/**
 * <design2-left-footer> — THE DESIGN ROOM'S COLUMN FOOTER: SAVE, AND THE SELECTED COMPONENT'S DELETE.
 *
 * The Composer bar's plate — the same height, fill, rounded corner and inner shadow, read from
 * `control-bar.ts` — carrying ONE control in the Composer's RUN treatment (`control-bar.ts`,
 * `.btn-run`, node 40000761:267): the same gradient, the same black bold label at 18, the same
 * 43-pixel height, 142-pixel width and drop shadow. This room has no run, so the act at the bottom
 * of this column is saving the package (owner, 2026-10-31).
 *
 * THE SECOND CONTROL IS THE SELECTED COMPONENT'S DELETE (owner, 2026-11-16): *"add a delete button
 * to the bottom next to save whenever one of the components is selected so the user can try to
 * delete it if it's not locked and the user should be able to remove it with double
 * confirmation."* It appears only while a catalogue component is selected, it arms on the first
 * press and deletes on the second, and it never decides whether the component may be removed:
 * the server's liveness guard refuses a component that is being served, with the files that name
 * it, and that answer is drawn in `result` beside the button.
 *
 * IT DRAWS AND DISPATCHES, AND NOTHING ELSE. A press raises `design-left-save`; the seat that holds
 * the session answers it, because only it knows the title, the address, the notes and the package
 * that are being saved. The delete raises `component-delete` with the tag, and the seat runs the
 * removal. The footer never fetches and never decides what saving or deleting means. `busy` and
 * `result` belong to the HOST: the seat sets them while the work is in flight and when it answers,
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
    /* THE SELECTED COMPONENT'S DELETE — the same plate, a destructive control. The first press
       arms it; the second deletes. A refusal from the server (a live component) is shown in the
       result line beside it, in the server's words. */
    .delete {
      height: 43px;
      min-width: 110px;
      padding: 0 14px;
      border: 1px solid rgba(160, 30, 30, 0.45);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.55);
      color: #8f1d1d;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 15px;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.15s ease, border-color 0.15s ease, color 0.15s ease;
    }
    .delete:hover { background: rgba(255, 255, 255, 0.85); border-color: rgba(160, 30, 30, 0.7); }
    .delete.armed { background: #b91c1c; border-color: #b91c1c; color: #fff; }
    .delete:disabled { opacity: 0.6; cursor: not-allowed; }
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
    /** The host's answer after a save or a removal — one line beside the controls. */
    result: { type: String },
    /** Set by the host while the save is in flight; locks the control and reads "Saving...". */
    busy: { type: Boolean },
    hideNew: { type: Boolean, attribute: 'hide-new' },
    /** The catalogue component the tree has open; empty means no Delete control. */
    selected: { type: String },
  };
  declare result: string;
  declare busy: boolean;
  declare hideNew: boolean;
  declare selected: string;

  /** The Delete control's first press arms it; the second deletes. */
  private _deleteArmed = false;
  /** True while the removal this footer asked for is in flight. */
  private _deleting = false;

  constructor() {
    super();
    this.result = '';
    this.busy = false;
    this.hideNew = false;
    this.selected = '';
  }

  updated(changed: Map<string, unknown>): void {
    /* A NEW SELECTION IS A NEW QUESTION: an armed Delete must not carry to another component. */
    if (changed.has('selected')) this._deleteArmed = false;
  }

  /*
   * THE HOST HAS FINISHED THE REMOVAL IT WAS ASKED FOR. The answer itself goes to the conversation
   * (owner, 2026-11-16: the confirmation messages belong to the model and the chat), so this only
   * releases the control's own working state; the footer never prints the answer beside the button.
   */
  private _onDeleteSettled = () => {
    this._deleting = false;
    this._deleteArmed = false;
    this.requestUpdate();
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('component-delete-settled', this._onDeleteSettled);
  }

  disconnectedCallback(): void {
    window.removeEventListener('component-delete-settled', this._onDeleteSettled);
    super.disconnectedCallback();
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

  /*
   * THE SELECTED COMPONENT'S DELETE, IN TWO PRESSES. The first arms the control and changes its
   * word; the second tells the seat to remove that component. The seat runs the removal through
   * the server's guard, so a component that is live is refused with the files that name it and
   * nothing is deleted — the refusal is drawn in `result`, not swallowed here.
   */
  private _onDelete() {
    if (this.busy || this._deleting || !this.selected) return;
    if (!this._deleteArmed) {
      this._deleteArmed = true;
      this.requestUpdate();
      return;
    }
    this._deleteArmed = false;
    this._deleting = true;
    this.dispatchEvent(
      new CustomEvent('component-delete', {
        detail: { tag: this.selected },
        bubbles: true,
        composed: true,
      }),
    );
    this.requestUpdate();
  }

  render() {
    return html`
      ${this.result ? html`<span class="result">${this.result}</span>` : nothing}
      <div class="actions">
        ${this.hideNew
          ? nothing
          : html`<button
              class="new"
              type="button"
              ?disabled=${this.busy}
              title="Create new session"
              @click=${this._onNew}
            >
              Create new
            </button>`}
        ${this.selected
          ? html`<button
              class="delete ${this._deleteArmed ? 'armed' : ''}"
              type="button"
              ?disabled=${this.busy || this._deleting}
              title=${this._deleteArmed
                ? `Click again to delete ${this.selected} from the catalogue`
                : `Delete ${this.selected} from the catalogue`}
              @click=${this._onDelete}
            >
              ${this._deleting
                ? html`<span class="spinner"></span> <span>Deleting...</span>`
                : this._deleteArmed
                  ? 'Confirm delete'
                  : 'Delete'}
            </button>`
          : nothing}
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

if (!customElements.get('design2-left-footer')) {
  customElements.define('design2-left-footer', DesignLeftFooter);
}
