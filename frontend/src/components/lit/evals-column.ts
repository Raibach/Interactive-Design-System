/**
 * <evals-column> — THE EVALS SECTION'S OWN GRACE COLUMN (owner, 2026-10-17: *"Grace is not an
 * overlay inside of eval's. If you have to create a different .TS file for grace for this
 * section you should … This is not supposed to overlay. We wanted to squeeze in in a
 * traditional responsive way with flex column."*).
 *
 * A DEDICATED COMPONENT, ON PURPOSE. The Evals section is not the chat panel wearing a
 * different hat: this column owns its own layout and composes in the NORMAL FLOW — a plain
 * flex column: the evaluators index taking the flexible middle (the one scroller), the two
 * controls at the bottom. Nothing absolute, nothing layered over anything — the page
 * squeezes and grows the way a responsive column does.
 *
 * NOTHING ABOVE THE LIST, AND NO SEARCH FIELD IN THIS COLUMN (owner, 2026-10-17: *"there's
 * no labels above the list of evaluators. There's no search there's no toggling
 * back-and-forth the buttons below are the toggles"*). Filtering and sorting are the MODEL's
 * job — the person asks in her chat box (the seat's own input), the model reads the words
 * into a silent directive (an order or a search), and the shell binds it onto the index as
 * `query` / `sort` (owner: *"all of the filtering and sorting … is done by the model in that
 * section"*). A failed round-trip is said in the column's own line (`notice`) — never
 * dressed up as an empty list.
 *
 * THE CONTROLS RIDE THE SEAT'S ACTION STRIP (owner, 2026-10-17: *"they're supposed to go on
 * the resizing horizontal bar"*): the Search Query pill, the grip, the toggle (the other
 * list's name) and the add pill ("+ New evaluator" / "+ New rule") draw on <chat-action-bar>
 * in `evals-mode`, fed by this column's `mode`. Above the list stands the model row from
 * the owner's mock (the project's model + "Project default"); nothing else labels the list.
 *
 * IT IS STILL A VIEW: `data`, `selectedId`, `query` and `sort` arrive bound from the shell; the
 * element fetches nothing and selects nothing. A row click forwards `evaluator-select` up
 * (bubbles, composed) — the shell navigates the middle section.
 */

import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';
import './evals-index';
import type { EvalsIndexData } from './evals-index';

export class EvalsColumn extends LitElement {
  static properties = {
    /** Bound by the shell from GET /api/governance/evaluators. */
    data: { type: Object },
    /** The evaluator the middle section is showing — bound, never chosen here. */
    selectedId: { type: String },
    /** The section's search text — bound; written by the shell from the model's directive. */
    query: { type: String },
    /** The model's silent order — bound by the shell from the query route. */
    sort: { type: String },
    /** The query result's narrowings (status / type), from the same directive. */
    /** THE MODEL'S FOLDER AT WORK — filters answered from the fields the rows carry. */
    filters: { type: Array },
    /** A FAILED QUERY'S REAL REASON, in one line — the only text this column ever adds. */
    notice: { type: String },
    /** THE LIST ON SCREEN — switched by the bottom toggle, the ONLY navigation
        (owner, 2026-10-17: *"the button toggles between a list of evaluators … that way we
        don't have different areas for navigation inside of our list"*). */
    mode: { type: String },
  };

  declare data?: EvalsIndexData;
  declare selectedId?: string;
  declare query?: string;
  declare sort?: string;
  declare filters?: Array<{ field: string; op?: string; value: string | number }>;
  declare notice?: string;
  declare mode?: string;

  static styles = [
    designTokens,
    css`
      :host {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        min-height: 0;
        font-family: var(--ds-font);
        font-weight: var(--ds-weight);
        font-size: var(--ds-fs-sm);
        color: var(--chat-text, var(--ds-text));
        background: transparent;
      }
      /* THE FLEXIBLE MIDDLE — the index takes what the column has and scrolls inside it. */
      .index-area {
        flex: 1 1 auto;
        min-height: 0;
        overflow: auto;
      }
      /* NO INPUT FIELD IN THIS COLUMN — filtering and sorting are asked of the model in her
         chat box, never inline (owner, 2026-10-17: *"There's no search"*). */
      /* THE FAILURE'S OWN LINE — the real reason, one line, above the index. */
      .notice {
        flex: 0 0 auto;
        padding: 4px 10px;
        color: var(--ds-red, #e66);
        font-size: var(--ds-fs-label);
      }
    `,
  ];

  private get _mode(): 'evaluators' | 'rules' {
    return this.mode === 'rules' ? 'rules' : 'evaluators';
  }

  render() {
    return html`
      <div class="index-area">
        <evals-index
          .data=${this.data}
          .selectedId=${this.selectedId ?? ''}
          .query=${this.query ?? ''}
          .sort=${this.sort ?? 'newest'}
          .filters=${this.filters ?? []}
          .mode=${this._mode}
        ></evals-index>
      </div>
      ${this.notice
        ? html`<div class="notice" role="status">${this.notice}</div>`
        : nothing}
    `;
  }
}

if (!customElements.get('evals-column')) customElements.define('evals-column', EvalsColumn);

declare global {
  interface HTMLElementTagNameMap {
    'evals-column': EvalsColumn;
  }
}
