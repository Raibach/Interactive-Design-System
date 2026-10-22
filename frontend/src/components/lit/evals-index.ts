/**
 * <evals-index> — THE EVALUATORS INDEX, drawn in the chat column's `view` slot under the
 * rail's Evals tab (owner, 2026-10-17: *"Add the index for evaluators to the chat output
 * under the appropriate tab and all of its features that includes its filtering options
 * rules is a tab on that same index … it loads inside of the output it doesn't load in the
 * middle"*).
 *
 * THE SAME INDEX THE GOVERNANCE APP DRAWS, read from the same database by the backend's
 * `/api/governance/evaluators` route — AND DRAWN AS THE APP DRAWS IT: A TABLE, not cards
 * (owner, 2026-10-17, holding up the app's own index: *"just take what is already in the
 * index and move that table"* … *"it doesn't need to have a new style card. It doesn't need
 * to be on two rows"*).
 *
 * THE FEATURED COLUMNS ARE THE OWNER'S, NAMED ONE BY ONE (2026-10-17): **Name, Status,
 * Type, Cost (7d)** — and nothing else. What the app's table also carries is deliberately
 * NOT drawn here, because the reason it exists in the app does not exist here:
 *   - **Model** — *"technically, they'll be filtered by the model selector"*: the model is a
 *     FILTER in our surface (the conversations control), not a column to read.
 *   - **Created by** — *"admin created by is not important … you can keep it in the table.
 *     The model can find it by creator, but we don't need the creator listed"*.
 *   - **Updated at** — *"we don't need our last updated featured because we're not filtering
 *     the table with column headers. We're using a large language model"*.
 *   All three stay IN THE PAYLOAD (the backend route returns them and the model can search
 *   and answer by them); they are simply not featured in the drawn row.
 *   - **Actions** — *"actions do not need to be there. Actions are in the actual display in
 *     the middle. We do not put them there so no action."* No View scores, no row menu, no
 *     link out of this column: the row click opens the evaluator in the middle, where the
 *     app's own actions live.
 *
 * HER CHAT BOX IS THIS INDEX'S SEARCH (owner, 2026-10-17: *"we do need search but grace does
 * it in her input box on this tab, but all she does is sort and search the index and display
 * them — no chat in this tab"* — refined the same day: *"all of the filtering and sorting …
 * is done by the model in that section"*). The element carries NO search field, no label and
 * no tabs of its own: the chat panel intercepts the submit on this tab, the model reads the
 * words into a directive, and the shell binds the answer onto `query` / `sort`.
 *
 * THE ORDER IS THE OWNER'S RULE (2026-10-17, restated the same day: *"they're ordered by
 * last modified and then that's proceeded by urgency so if the status is urgent, it proceeds
 * last modified"*): rows are ordered by LAST MODIFIED (updatedAt, newest first), and an
 * URGENT status is placed ahead of that ordering — urgency first, then last modified within
 * each rank. Urgent is the app's own red state, Blocked. No sort control is drawn: sorting
 * is asked of the MODEL in her chat box ("newest", "resort") and the model answers
 * SILENTLY — no chat reply. That interaction is PINNED, not built (see the note above
 * `_rows`); until it lands, the bound `query` narrows the list and done.
 *
 * WHAT THIS INDEX DOES NOT CARRY, BY THE OWNER'S OWN STRIKE-THROUGHS (2026-10-17, each
 * named against the app's controls): no Columns picker, no "My Views" saved views, no
 * search instruction, NO PAGINATION — the list is lazy: it renders a window of rows and
 * grows as the person scrolls — and NO FILTER FACETS OR SORT CONTROLS (*"all bloat not need
 * anymore in the chat output area for Evals"*). What is left is exactly what the owner
 * keeps: the four columns, the rows, and the column's two bottom buttons. *
 * THE SCALE IS DELIBERATELY SMALL (owner, 2026-10-17: *"I'm guessing there will not be more
 * than 20 at most then people will need to clean them out … I'm building this for about 20
 * at most."*). The lazy window below is the no-pagination mechanism he ordered; with ~20
 * rows it normally draws everything in one pass. Do NOT add virtualization, server paging,
 * column machinery or cleanup tooling for a "large list" — that scale is explicitly not the
 * product. *
 * IT IS A VIEW, NOT A SOURCE — the same contract as trace-feed and eval-feed: `data`
 * arrives bound from the shell and the element fetches nothing. Undefined is "the shell has
 * not fetched yet"; a real payload with empty lists is "the project has none", and the two
 * draw differently, because a false "nothing yet" is a claim about the app.
 *
 * SELECTION IS THE SHELL'S — the row click only SAYS which evaluator the person picked
 * (`evaluator-select`); the shell navigates the middle section to that exact evaluator
 * (owner: *"Console lands them on the exact Eval they select"*). The view never selects
 * itself; `selectedId` arrives bound so the row can mark itself.
 */

import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

/** One evaluator row, mirrors the backend route's payload. */
export interface EvaluatorIndexRow {
  id: string;
  name: string;
  /** LLM_AS_JUDGE | CODE | DECISION_MODEL | FACET — the app's own enum. */
  type: string;
  /** Blocked | Healthy | Inactive — the app's own words, derived from DB facts. */
  status: string;
  blockReason?: string | null;
  blockMessage?: string | null;
  model?: string | null;
  provider?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
  /** Total cost of this evaluator's runs over the last 7 days; null only when the analytics
   *  read failed — the reason then travels in the route's `costErrors`. */
  cost7d: number | null;
  activeRules: number;
}

/** One rule row — the second tab of the same index. */
export interface EvaluatorRuleRow {
  id: string;
  name: string;
  /** ACTIVE | INACTIVE — JobConfigState. */
  status: string;
  sampling: number;
  filter?: unknown;
  evaluators: string[];
  createdAt: string;
  updatedAt: string;
  /** Total cost of this rule's runs over the last 7 days (the app's own Cost (7d) column). */
  cost7d: number | null;
}

export interface EvalsIndexData {
  projectId: string;
  evaluators: EvaluatorIndexRow[];
  rules: EvaluatorRuleRow[];
}

const TYPE_WORD: Record<string, string> = {
  LLM_AS_JUDGE: 'LLM as a judge',
  CODE: 'Code',
  DECISION_MODEL: 'Decision model',
  FACET: 'Facet',
};

/** Status speaks through colour, the app's own palette — never a new one. */
function statusClass(status: string): string {
  const s = status.toLowerCase();
  if (s === 'healthy' || s === 'active') return 'st-good';
  if (s === 'blocked' || s === 'error') return 'st-bad';
  return 'st-off';
}

/**
 * THE APP'S OWN Cost (7d) FORMAT — USD, at least two and at most four fraction digits
 * (the app formats it with usdFormatter(value, 2, 4)). Four digits matter here: a run
 * costs fractions of a cent, and rounding to two would print every evaluator as "$0.00".
 * A null value only means the analytics read failed; the dash never stands in for a guess.
 */
const USD_7D = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});
function usd7d(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? USD_7D.format(value) : '—';
}

/**
 * One rule's filter as a short human line — "root observations" for the boolean
 * isRootObservation filter both live rules carry. Unknown shapes are drawn as their
 * column names rather than guessed at: the element says what it can prove.
 */
function filterLine(filter: unknown): string {
  if (!Array.isArray(filter) || filter.length === 0) return 'every observation';
  const parts: string[] = [];
  for (const f of filter as Array<Record<string, unknown>>) {
    const column = typeof f?.column === 'string' ? f.column : '';
    if (column === 'isRootObservation') parts.push('root observations');
    else if (column) parts.push(column);
  }
  return parts.length ? parts.join(', ') : 'every observation';
}

export class EvalsIndex extends LitElement {
  static properties = {
    /** Bound by the shell from GET /api/governance/evaluators. Undefined until it lands. */
    data: { type: Object },
    /** The evaluator the middle section is showing — bound, never chosen here. */
    selectedId: { type: String },
    /** HER BOX ON THIS TAB IS THE SEARCH — the shell binds what was submitted. */
    query: { type: String },
    /** THE MODEL'S SILENT DIRECTIVE — "newest" | "oldest" | "name" | "critical" (owner,
        2026-10-17: *"Users just ask the model for newest or to resort, surely it can handle
        sorting without speaking back"*). Bound by the shell from the query route; the view
        only ever sorts. */
    sort: { type: String },
    /** THE MODEL'S FOLDER AT WORK — the filters she answered with (field/value pairs drawn
        from the fields the rows really carry). Empty = every row. */
    filters: { type: Array },
    /** WHICH LIST — chosen by the column's bottom toggle, never inside this output
        (owner, 2026-10-17: *"none of this exists anymore … inside of the output it does not"*
        — no title, no tabs, no counts, no sort chip, no navigation in the output). */
    mode: { type: String },
  };

  // No constructor default on purpose: unset has to stay distinguishable from empty.
  declare data?: EvalsIndexData;
  declare selectedId?: string;
  declare query?: string;
  declare sort?: string;
  declare filters?: Array<{ field: string; op?: string; value: string | number }>;
  declare mode?: string;

  /** LAZY, NEVER PAGINATED (owner, 2026-10-17) — the window this list renders; scroll grows it. */
  private _visible = 25;
  private _sentinel: IntersectionObserver | null = null;

  static styles = [
    designTokens,
    css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
        overflow: auto;
        font-family: var(--ds-font);
        font-weight: var(--ds-weight);
        font-size: var(--ds-fs-sm);
        color: var(--chat-text, var(--ds-text));
        /* Transparent, like the eval feed — the drawing's ground reads through the column. */
        background: transparent;
      }
      /* NOTHING ABOVE THE LIST — no title, no tabs, no counts, no sort chip (owner,
         2026-10-17: *"there's no labels above the list of evaluators"*; the mode is chosen
         by the column's bottom toggle). */
      /* NO FILTER FACETS, NO SEARCH BOX, NO INSTRUCTION, NO SORT CONTROL — the owner's
         strikes (2026-10-17: *"no filtering needed … All filtering happens in the chat"*).
         Ordering is the element's own rule (critical first, then newest created). */
      .rows { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 8px; }
      /* THE EXISTING ROW TREATMENT, VERBATIM FROM eval-feed (the house's evaluation list) —
         no new styling here (owner, 2026-10-17: *"It's about location … The styling comes
         later."*). The row is the feed's own: a rule-bordered tint, radius --ds-radius. */
      .rows { padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; }
      .row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        width: 100%;
        text-align: left;
        appearance: none;
        padding: 10px 12px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius);
        background: rgba(0, 0, 0, 0.12);
        color: inherit;
        font: inherit;
        cursor: pointer;
      }
      .row.is-selected { border-color: var(--ds-teal); }
      .main { flex: 1 1 auto; min-width: 0; }
      .top { display: flex; align-items: center; gap: 8px; }
      .name { font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
      .status {
        margin-left: auto;
        flex: 0 0 auto;
        display: inline-block;
        font-size: var(--ds-fs-label);
        font-weight: 600;
        padding: 2px 8px;
        border-radius: var(--ds-radius-pill);
        border: 1px solid currentColor;
      }
      .st-good { color: var(--ds-green); }
      .st-bad { color: var(--ds-red); }
      .st-off { color: var(--chat-muted, var(--ds-muted)); }
      .meta {
        margin-top: 4px;
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        color: var(--chat-muted, var(--ds-muted));
        font-size: var(--ds-fs-label);
      }
      .meta .dot::before { content: '·'; margin-right: 10px; }
      .empty {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 18px 10px;
        color: var(--chat-muted, var(--ds-muted));
      }
      .empty .empty-title { font-weight: 600; color: var(--chat-text, var(--ds-text)); }
      .sentinel { height: 1px; }
      /* THE TABLE — the app's own shape (owner, 2026-10-17: *"just take what is already in
         the index and move that table"*) — with NO header row (owner, same day: *"you can
         remove these. We don't need these. It's obvious what they are."*). Rows only; the
         classes below are layout, not labels. Tokens only, no new visual language. */
      .tbl-wrap { padding: 2px 14px 0; }
      .tbl { width: 100%; border-collapse: collapse; table-layout: auto; }
      .tbl td {
        padding: 10px;
        border-bottom: 1px solid var(--chat-rule, var(--ds-rule));
        vertical-align: middle;
      }
      .tbl tbody tr { cursor: pointer; }
      .tbl tbody tr:hover { background: rgba(0, 0, 0, 0.12); }
      .tbl tbody tr.is-selected { background: rgba(0, 0, 0, 0.12); box-shadow: inset 2px 0 0 var(--ds-teal); }
      .tbl tbody tr:focus-visible { outline: 1px solid var(--ds-teal); outline-offset: -1px; }
      /* Name takes the room; the other three keep their natural width. */
      .tbl .c-name { width: 100%; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .tbl .c-status, .tbl .c-type, .tbl .c-cost { white-space: nowrap; }
      .tbl .c-cost { color: var(--chat-muted, var(--ds-muted)); }
      .tbl .c-evals, .tbl .c-filters, .tbl .c-sampling { white-space: nowrap; }
      .tbl .c-filters { color: var(--chat-muted, var(--ds-muted)); }
      /* THE ENABLED SWITCH — a real control, the app's own idea of a switch. */
      .switch {
        position: relative;
        display: inline-block;
        width: 30px;
        height: 16px;
        padding: 0;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: 999px;
        background: transparent;
        cursor: pointer;
      }
      .switch .knob {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        background: var(--chat-muted, var(--ds-muted));
        transition: left 120ms linear;
      }
      .switch.is-on { border-color: var(--ds-green); background: color-mix(in srgb, var(--ds-green) 30%, transparent); }
      .switch.is-on .knob { left: 16px; background: var(--ds-green); }
    `,
  ];

  /** THE MODEL'S FOLDER AT WORK — every filter compares a real field of the row against a
   * value the shell's route already proved exists in the folder. A filter naming a field the
   * row does not carry simply does not match; nothing is guessed and nothing is dropped. */
  private _passesFilters(row: Record<string, unknown> | EvaluatorIndexRow | EvaluatorRuleRow): boolean {
    for (const f of this.filters ?? []) {
      const field = String(f?.field ?? '').trim();
      const op = String(f?.op ?? 'eq').trim().toLowerCase();
      const value = f?.value;
      if (!field || value === undefined || value === null || value === '') continue;
      /* A ROW INTERFACE HAS NO INDEX SIGNATURE, so the field is read through one. A filter naming
         a field the row does not carry reads as `undefined` and simply does not match. */
      const raw = (row as Record<string, unknown>)[field];
      /* A LIST FIELD (a rule's attached evaluator names) matches when it CONTAINS the value. */
      if (Array.isArray(raw)) {
        const wanted = String(value).toLowerCase();
        if (!raw.some((item) => String(item ?? '').toLowerCase() === wanted)) return false;
        continue;
      }
      /* NUMBERS AND DATES COMPARE — a date arrives as an ISO string, where order is text order. */
      if (op === 'gte' || op === 'lte') {
        if (typeof raw === 'number' && typeof value === 'number') {
          if (op === 'gte' ? !(raw >= value) : !(raw <= value)) return false;
        } else {
          const left = String(raw ?? '');
          const right = String(value);
          if (op === 'gte' ? !(left >= right) : !(left <= right)) return false;
        }
        continue;
      }
      const rawText = String(raw ?? '').toLowerCase();
      const wanted = String(value).toLowerCase();
      if (op === 'contains' ? !rawText.includes(wanted) : rawText !== wanted) return false;
    }
    return true;
  }

  private get _rows(): EvaluatorIndexRow[] {
    const all = this.data?.evaluators ?? [];
    const q = (this.query ?? '').trim().toLowerCase();
    const filtered = all.filter((r) => {
      if (!this._passesFilters(r)) return false;
      if (!q) return true;
      return [r.name, r.type, r.model ?? '', r.createdBy ?? '', r.status]
        .some((v) => v.toLowerCase().includes(q));
    });
    /* THE ORDER IS THE OWNER'S RULE (2026-10-17: *"they're ordered by last modified and then
       that's proceeded by urgency so if the status is urgent, it proceeds last modified"*):
       last modified first (updatedAt, newest first), and an URGENT status — the app's own
       red state, Blocked — is placed ahead of the last-modified ordering. THE MODEL'S
       DIRECTIVE RIDES ON TOP (same owner, built 2026-10-17): the chat box's words are read
       by the model into `sort`, and "oldest" / "name" restate the order WITHIN the
       urgency-first law — the owner's ranking is never silently dropped by an ask. No sort
       control is drawn here. */
    const rank = (r: EvaluatorIndexRow): number => (r.status === 'Blocked' ? 0 : 1);
    const sort = (this.sort ?? 'newest').toLowerCase();
    const byLastModified = (a: EvaluatorIndexRow, b: EvaluatorIndexRow): number =>
      rank(a) - rank(b) || b.updatedAt.localeCompare(a.updatedAt);
    const ordered = [...filtered].sort((a, b): number => {
      if (sort === 'oldest') return rank(a) - rank(b) || a.updatedAt.localeCompare(b.updatedAt);
      if (sort === 'name') return rank(a) - rank(b) || a.name.localeCompare(b.name);
      /* STRUCTURING BY TYPE (owner, 2026-10-17: *"structuring it by type"*) — grouped by the
         app's own type word, then last modified inside each group. */
      if (sort === 'type') {
        return rank(a) - rank(b) || a.type.localeCompare(b.type) || b.updatedAt.localeCompare(a.updatedAt);
      }
      /* "newest" (the default) and "critical" both rest on the owner's ranking: urgency
         overrides last modified. Stated, not implied. */
      return byLastModified(a, b);
    });
    return ordered;
  }

  private get _ruleRows(): EvaluatorRuleRow[] {
    const all = this.data?.rules ?? [];
    const q = (this.query ?? '').trim().toLowerCase();
    const filtered = all.filter((r) => {
      if (!this._passesFilters(r)) return false;
      if (!q) return true;
      return [r.name, ...r.evaluators].some((v) => v.toLowerCase().includes(q));
    });
    /* Rules keep the backend's newest-first order by default — the owner's
       critical-overrides-new rule is stated for evaluators; nothing is invented for the rules
       side. THE MODEL'S ORDER ASK APPLIES HERE TOO (2026-10-17): "oldest" and "name" restate
       the order; anything else leaves the newest-first read untouched. */
    const sort = (this.sort ?? 'newest').toLowerCase();
    if (sort === 'oldest') return [...filtered].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (sort === 'name') return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    return filtered;
  }

  updated(): void {
    /* THE LAZY LIST — no pagination exists here (owner, 2026-10-17: *"remove pagination one
       forever lazy loading list instead"*). The sentinel below the last printed row grows
       the window as it comes into view; with the list in a scroller this is what "load
       more" means, and no page control is ever drawn. */
    this._sentinel?.disconnect();
    const el = this.renderRoot.querySelector('.sentinel') as HTMLElement | null;
    if (!el) return;
    this._sentinel = new IntersectionObserver((entries) => {
      if (!entries.some((en) => en.isIntersecting)) return;
      const total = this._mode === 'evaluators' ? (this._rows.length) : (this._ruleRows.length);
      if (this._visible >= total) return;
      this._visible += 25;
      this.requestUpdate();
    }, { root: this, rootMargin: '120px' });
    this._sentinel.observe(el);
  }

  disconnectedCallback(): void {
    this._sentinel?.disconnect();
    this._sentinel = null;
    super.disconnectedCallback();
  }

  /** WHICH LIST — chosen by the column's bottom toggle, never inside this output. */
  private get _mode(): 'evaluators' | 'rules' {
    return this.mode === 'rules' ? 'rules' : 'evaluators';
  }

  private _pickEvaluator(row: EvaluatorIndexRow): void {
    this.dispatchEvent(new CustomEvent('evaluator-select', {
      bubbles: true,
      composed: true,
      detail: { id: row.id, name: row.name },
    }));
  }

  private _pickRule(row: EvaluatorRuleRow): void {
    this.dispatchEvent(new CustomEvent('rule-select', {
      bubbles: true,
      composed: true,
      detail: { id: row.id, name: row.name },
    }));
  }

  render() {
    if (this.data === undefined) {
      return html`
        <div class="empty" role="status">
          <span class="empty-title">Loading…</span>
          <span>Waiting for the shell to read the governance database.</span>
        </div>
      `;
    }
    /* NOTHING BUT THE LIST (owner, 2026-10-17: *"none of this exists anymore and at least
       inside of the output it does not"* — the title, the tabs, the counts and the sort chip
       are gone). Which list draws comes from `mode`, chosen by the column's bottom toggle. */
    const total = this._mode === 'evaluators'
      ? (this.data.evaluators?.length ?? 0)
      : (this.data.rules?.length ?? 0);
    const shown = this._mode === 'evaluators' ? this._rows.length : this._ruleRows.length;

    return total === 0
      ? html`
          <div class="empty" role="status">
            <span class="empty-title">No ${this._mode === 'evaluators' ? 'evaluators' : 'rules'} yet</span>
            <span>${this._mode === 'evaluators'
              ? 'Create one from the add button below — it lands here.'
              : 'Add one from the button below — it lands here.'}</span>
          </div>
        `
      : shown === 0
        ? html`
            <div class="empty" role="status">
              <span class="empty-title">Nothing matches this search</span>
              <span>${shown} of ${total} shown — clear the search in chat.</span>
            </div>
          `
        : this._mode === 'evaluators'
          ? html`${this._evaluatorTable()}
                 <div class="sentinel" aria-hidden="true"></div>`
          : html`${this._ruleTable()}
                 <div class="sentinel" aria-hidden="true"></div>`;
  }

  /**
   * THE TABLE — the app's index, moved into the chat output (owner, 2026-10-17: *"just take
   * what is already in the index and move that table"*). The four featured columns are the
   * owner's exact list: Name, Status, Type, Cost (7d).
   *
   * NO COLUMN HEADERS (owner, 2026-10-17, on a screenshot of the header row: *"you can
   * remove these. We don't need these. It's obvious what they are."*): the name reads as a
   * name, the pill reads as a state, the type reads as a type, the figure reads as cost.
   * The header row is gone — do NOT put it back; the column classes below are layout only.
   *
   * NOT DRAWN, ON PURPOSE, EACH BY THE OWNER'S OWN REASON: Model (the model selector filters
   * by it), Created by ("not important … the model can find it by creator"), Updated at ("we
   * don't need our last updated featured"), and Actions ("actions are in the actual display
   * in the middle. We do not put them there so no action"). Model, createdBy and updatedAt
   * stay in the payload — the model searches and answers by them without a column.
   */
  private _evaluatorTable() {
    const rows = this._rows.slice(0, this._visible);
    return html`
      <div class="tbl-wrap">
        <table class="tbl">
          <tbody>
            ${rows.map((r) => {
              const selected = this.selectedId === r.id;
              return html`
                <tr class=${selected ? 'is-selected' : ''}
                  aria-selected=${selected ? 'true' : 'false'}
                  tabindex="0"
                  @click=${() => this._pickEvaluator(r)}
                  @keydown=${(event: KeyboardEvent) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    this._pickEvaluator(r);
                  }}>
                  <td class="c-name" title=${r.name}>${r.name}</td>
                  <td class="c-status"><span class="status ${statusClass(r.status)}">${r.status}</span></td>
                  <td class="c-type">${TYPE_WORD[r.type] ?? r.type}</td>
                  <td class="c-cost">${usd7d(r.cost7d)}</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * THE RULES TABLE — the same treatment as the evaluators table, over the fields the rule
   * record really carries. Bound: name, the ENABLED switch, the attached evaluators, the
   * rule's own filter, and sampling.
   *
   * NOT BOUND: row checkboxes, filter facets, search, My Views, Columns, pagination, Created
   * by, Created at, Updated at and Actions — the owner's removals, unchanged for rules. Cost
   * (7d) IS drawn (2026-10-17): the route reads it from the app's own ClickHouse with the
   * app's own aggregation, so the figure is the app's figure, not a dash standing in for one.
   *
   * THE SWITCH IS REAL: pressing it emits `rule-enabled`, the shell writes
   * evaluation_rules.status through /api/governance/rules/enabled and re-reads the list. A
   * failed write is shown with its real reason — never treated as if it worked.
   */
  private _ruleTable() {
    const rows = this._ruleRows.slice(0, this._visible);
    return html`
      <div class="tbl-wrap">
        <table class="tbl">
          <tbody>
            ${rows.map((r) => {
              const active = r.status === 'ACTIVE';
              const selected = this.selectedId === r.id;
              return html`
                <tr class=${selected ? 'is-selected' : ''}
                  aria-selected=${selected ? 'true' : 'false'}
                  tabindex="0"
                  @click=${() => this._pickRule(r)}
                  @keydown=${(event: KeyboardEvent) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    this._pickRule(r);
                  }}>
                  <td class="c-name" title=${r.name}>${r.name}</td>
                  <td class="c-state">
                    <button
                      type="button"
                      class="switch ${active ? 'is-on' : ''}"
                      role="switch"
                      aria-checked=${active ? 'true' : 'false'}
                      aria-label=${`${active ? 'Disable' : 'Enable'} ${r.name}`}
                      @click=${(event: Event) => {
                        event.stopPropagation();
                        this.dispatchEvent(new CustomEvent('rule-enabled', {
                          bubbles: true,
                          composed: true,
                          detail: { id: r.id, enabled: !active },
                        }));
                      }}
                    ><span class="knob"></span></button>
                  </td>
                  <!-- THE APP'S OWN COLUMN ORDER: the switch, then Cost (7d), then the
                       evaluators. Written as a comment here because the header row is gone
                       by the owner's own ruling — the order is the only thing naming them. -->
                  <td class="c-cost">${usd7d(r.cost7d)}</td>
                  <td class="c-evals">${r.evaluators.length ? r.evaluators.join(', ') : '—'}</td>
                  <td class="c-filters">${filterLine(r.filter)}</td>
                  <td class="c-sampling">${Math.round(r.sampling * 100)}%</td>
                </tr>
              `;
            })}
          </tbody>
        </table>
      </div>
    `;
  }
}

if (!customElements.get('evals-index')) customElements.define('evals-index', EvalsIndex);

declare global {
  interface HTMLElementTagNameMap {
    'evals-index': EvalsIndex;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'evals-index': React.DetailedHTMLProps<React.HTMLAttributes<EvalsIndex> & {
        data?: EvalsIndexData;
        selectedId?: string;
        ref?: React.Ref<EvalsIndex>;
      }, EvalsIndex>;
    }
  }
}
