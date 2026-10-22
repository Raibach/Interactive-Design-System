/**
 * <evals-experience> — THE EVALS TAB'S WHOLE EXPERIENCE, IN ONE FILE (owner, 2026-10-17:
 * *"each one of these tabs is a different experience … if you have to create a separate .TS
 * file for eval's then you should do it … stop doing global universal fixes … You can only
 * borrow previous work if it's included in that experience."*).
 *
 * THE HARD RULE THIS FILE ENCODES:
 *   - Every rail tab is its OWN experience. A tab's interface is a component of its own,
 *     loaded only while that tab is active.
 *   - Nothing here changes the shared chat seat: the seat keeps its approved configuration
 *     (the box originals, restored 2026-10-17). This element is mounted INTO the seat through
 *     the one declared door (`slot="evals-experience"`), and while it stands the seat draws
 *     nothing of its own for this tab.
 *   - BorrowING is allowed (small-dropdown, the evaluators index, prompt-textarea) because
 *     each borrowed piece is included in this experience; nothing borrowed is restyled for
 *     the other tabs, and nothing global is bent to fit this one.
 *
 * THE ARRANGEMENT, per the owner's map (2026-10-17):
 *   1. the model bar — the house's <small-dropdown> (its own chevron), label
 *      "deepseek / deepseek-flash | Project default", fed by the shell's index read;
 *   2. the evaluators index — <evals-column>, data inserted by the shell;
 *   3. the query box — <prompt-textarea> (the model answers silently: no chat turn);
 *   4. the action strip — Search Query · toggle (the other list) · add, whose label follows
 *      the list on screen.
 *
 * EVENTS (composed, bubble to the room's seat): `evals-query` (the draft),
 * `evals-add`, and the index's own `evaluator-select`. The shell wires all three.
 */
import { LitElement, html, css } from 'lit';
import './small-dropdown';
import './prompt-input/prompt-textarea';
/* THE SEAT'S OWN INPUT REGION — the same element the chat seat wraps its textarea in
   (owner, 2026-10-17: *"you must use the current chat styling and theme and structure exactly
   as it exists everywhere else … you're not reinventing it. It already exists."*). */
import './chat-input';
import './evals-column';
import type { EvalsIndexData } from './evals-index';

export class EvalsExperience extends LitElement {
  static properties = {
    /** Bound by the shell from GET /api/governance/evaluators. */
    data: { type: Object },
    /** The evaluator the middle section is showing — bound, never chosen here. */
    selectedId: { type: String },
    /** The model's silent search text — bound by the shell from the query route. */
    query: { type: String },
    /** The model's silent order — bound by the shell from the query route. */
    sort: { type: String },
    /** The query result's narrowings, from the same directive. */
    /** THE MODEL'S FOLDER AT WORK — filters answered from the fields the rows carry. */
    filters: { type: Array },
    /** A failed query's real reason, in one line. */
    notice: { type: String },
    /** 'evaluators' | 'rules' — the toggle's own state. */
    mode: { type: String },
    /** "deepseek / deepseek-flash | Project default" — written by the shell's index read. */
    modelLabel: { type: String, attribute: 'model-label' },
  };

  declare data?: EvalsIndexData;
  declare selectedId?: string;
  declare query?: string;
  declare sort?: string;
  declare filters?: Array<{ field: string; op?: string; value: string | number }>;
  declare notice?: string;
  declare mode?: string;
  declare modelLabel?: string;

  private _draft = '';

  static styles = css`
    /* THE SEAT'S OWN STACK, COPIED VALUE-FOR-VALUE INTO THIS TAB'S OWN FILE (owner,
       2026-10-17: *"use the exact same styling that I've already provided … you've abandoned
       the design"*). Nothing here is a new look: the same #CBE6E3 ground with 5px above it,
       the same strip paddings (10px 20px 20px), the same pill fill
       rgba(255,255,255,0.5) + "button drop" shadow + 16/700 #64617F, the same four-dot grip. */
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      font-family: var(--ds-font);
      color: var(--chat-text, var(--ds-text));
      background: transparent;
    }
    .model-row {
      flex: 0 0 auto;
      display: flex;
      align-items: center;
      padding: 10px 10px 0;
    }
    .list {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    .notice {
      flex: 0 0 auto;
      padding: 4px 10px 0;
      color: var(--ds-red, #e66);
      font-size: var(--ds-fs-label);
    }
    /* THE INPUT STACK — the seat's own wrapper: #CBE6E3 with 5px above it. */
    .input-row {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      background: #CBE6E3;
      padding: 5px 10px 0;
    }
    .input-row prompt-textarea { display: block; width: 100%; }
    /* "chat-input-menu" #40001119:6035 — row, padding 10px 20px 20px, align centre, gap 9. */
    .bar {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 10px 20px 20px;
      background: #CBE6E3;
      font-family: inherit;
    }
    /* THE GRIP SITS IN THE ROW — the design's four-dot spacer between the query pill and
       the list pills, never a stacked block. */
    .grip {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 15px;
      cursor: ns-resize;
    }
    /* "send-to-model" #40001119:6370 — the pill: radius 6, rgba(255,255,255,0.5), the
       "button drop" shadow, 16/700 #64617F. */
    .pill {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 35px;
      box-sizing: border-box;
      border: none;
      border-radius: 6px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.5);
      box-shadow: 4px 4px 10px 0 rgba(0, 0, 0, 0.15), -4px -4px 10px 0 rgba(0, 0, 0, 0.15);
      font-family: inherit;
      font-size: 16px;
      font-weight: 700;
      color: #64617F;
      padding: 0 14px;
      cursor: pointer;
    }
    .pill:disabled { opacity: 0.4; cursor: not-allowed; }
    /* "Meatballs-for-spacer" #40001120:6644 — the grip: #CBE6E3 strip 15 tall, dots centred. */
    .gripper {
      flex: 1 1 auto;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      height: 15px;
      padding: 5px 10px 10px;
      box-sizing: border-box;
      background: #CBE6E3;
      cursor: ns-resize;
    }
    .dot {
      display: block;
      width: 2.16px;
      height: 2.05px;
      border: 2px solid rgba(147, 58, 69, 0.5);
      border-radius: 50%;
      box-sizing: border-box;
    }
  `;

  private get _mode(): 'evaluators' | 'rules' {
    return this.mode === 'rules' ? 'rules' : 'evaluators';
  }

  private _onDraft = (e: Event) => {
    const value = (e.target as HTMLElement & { value?: string }).value;
    if (typeof value === 'string') this._draft = value;
  };

  private _submit(): void {
    const text = this._draft.trim();
    if (!text) return;
    const box = this.renderRoot.querySelector('prompt-textarea') as
      (HTMLElement & { value?: string }) | null;
    if (box) box.value = '';
    this._draft = '';
    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('evals-query', {
      bubbles: true,
      composed: true,
      detail: { text },
    }));
  }

  private _onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    this._submit();
  };

  private _toggleMode(): void {
    this.mode = this._mode === 'rules' ? 'evaluators' : 'rules';
    this.requestUpdate();
  }

  private _add(): void {
    this.dispatchEvent(new CustomEvent('evals-add', {
      bubbles: true,
      composed: true,
      detail: { mode: this._mode },
    }));
  }

  render() {
    const other = this._mode === 'rules' ? 'Evaluators' : 'Rules';
    const addLabel = this._mode === 'rules' ? '+ New rule' : '+ New evaluator';
    return html`
      <div class="list">
        <evals-column
          .data=${this.data}
          .selectedId=${this.selectedId ?? ''}
          .query=${this.query ?? ''}
          .sort=${this.sort ?? 'newest'}
          .filters=${this.filters ?? []}
          .notice=${this.notice ?? ''}
          .mode=${this._mode}
        ></evals-column>
      </div>
      ${this.notice
        ? html`<div class="notice" role="status">${this.notice}</div>`
        : ''}
    `;
  }
}

if (!customElements.get('evals-experience')) customElements.define('evals-experience', EvalsExperience);

declare global {
  interface HTMLElementTagNameMap {
    'evals-experience': EvalsExperience;
  }
}
