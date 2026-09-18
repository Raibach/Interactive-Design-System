/**
 * <chat-repair-actions> — the catalog checker's findings, drawn in the chat panel.
 *
 * It is a VIEW, injected into the chat panel's simple slot by the surface:
 *
 *   chat-panel  "children": { "view": ["trace-view", "repair-view"] }
 *   repair-view "component": "chat-repair-actions", "findings": { "path": "/findings" }
 *
 * The panel draws the slot; the surface fills it. It used to be a permanent sibling in
 * the panel's own template, which made the panel responsible for a list it does not own
 * — and put a console feature above the composer in every assembly.
 *
 * THE ROWS ARRIVE READY TO DRAW. `text` and `level` are composed by the writer, in
 * Python, from the report the checker already wrote (frontend/catalog-audit/<pipeline>
 * .json). This element composes no sentence about a finding and decides no severity: a
 * view that re-words a finding is a second author of it, and the two would disagree.
 *
 * Data flows one way: rows IN, `repair-finding` OUT. It never fetches the audit, never
 * applies a repair, and never decides urgency.
 *
 * Unset is not empty. `findings === undefined` means the surface has not bound the path
 * yet and draws its waiting state; `findings === []` means the checker found nothing
 * open, which is a different and better claim.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

/** One row, as the writer composes it. Nothing here is derived on the client. */
export interface ChatRepairRow {
  /** The finding's id — what `repair-finding` reports, and what the repair resolves. */
  id: string;
  /** The sentence to draw, already composed. */
  text: string;
  /** Resolved by the writer from the checker's own severity rule. */
  level?: 'advisory' | 'blocking';
}

export class ChatRepairActions extends LitElement {
  static properties = {
    /** Rows, blocking first, composed by the writer. Undefined = not bound yet. */
    findings: { type: Array },
    /**
     * Optional per-finding marks — Record<findingId, 'repair' | 'done'> — written by
     * the shell while a repair is in flight. Unset draws no mark; the element never
     * guesses that a repair is done, because only a new report can settle one.
     */
    stages: { type: Object },
    collapsed: { type: Boolean },
  };

  declare findings: ChatRepairRow[] | undefined;
  declare stages: Record<string, 'repair' | 'done'> | undefined;
  declare collapsed: boolean;

  constructor() {
    super();
    this.findings = undefined;
    this.stages = undefined;
    // EXPANDED by default now that it lives in the panel's view hole. It used to default
    // collapsed because it was a SIBLING ABOVE THE THREAD: expanded with 52 findings it
    // measured 3,309px and pushed the composer below the fold, which read as "the chat
    // input is missing". In the slot it cannot do that — the hole is a bounded, scrolling
    // region and the list is capped at 240px — so the findings are on screen when the tab
    // is opened, and the header still collapses them.
    this.collapsed = false;
  }

  static styles = [
    designTokens,
    css`
      :host { display: block; }
      .panel {
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        background: var(--ds-surface);
        font-family: var(--ds-font);
        font-size: var(--ds-fs-sm);
        color: var(--ds-text);
      }
      .header {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: var(--ds-surface-muted);
        border-radius: var(--ds-radius) var(--ds-radius) 0 0;
        font: inherit;
        font-weight: var(--ds-weight);
        color: var(--ds-navy);
        cursor: pointer;
        text-align: left;
      }
      .chip {
        padding: 1px 8px;
        border-radius: var(--ds-radius-pill);
        font-size: var(--ds-fs-label);
        font-weight: var(--ds-weight);
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .chip.blocking { background: var(--ds-red-tint); color: var(--ds-red); }
      .chip.count { background: var(--ds-teal-tint); color: var(--ds-navy); }
      .waiting {
        padding: 8px 12px;
        color: var(--ds-muted);
        font-size: var(--ds-fs-sm);
      }
      ul {
        list-style: none;
        margin: 0;
        padding: 0 12px 8px;
        /* The cap: expanded, the list scrolls instead of growing the column and burying
           the composer beneath it. */
        max-height: 240px;
        overflow-y: auto;
      }
      li {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 8px 0;
        border-bottom: 1px solid var(--ds-rule-soft);
      }
      li:last-child { border-bottom: none; }
      .level {
        flex: 0 0 auto;
        padding: 1px 6px;
        border-radius: var(--ds-radius-sm);
        font-size: var(--ds-fs-meta);
        font-weight: var(--ds-weight);
      }
      .level.blocking { background: var(--ds-red-tint); color: var(--ds-red); }
      .level.advisory { background: var(--ds-grey-tint); color: var(--ds-muted); }
      .text { flex: 1 1 auto; min-width: 0; }
      .stage { flex: 0 0 auto; font-weight: var(--ds-weight); }
      .stage.done { color: var(--ds-green); }
      .stage.repair { color: var(--ds-amber); }
      button.repair {
        flex: 0 0 auto;
        padding: 3px 10px;
        border: 1px solid var(--ds-teal);
        border-radius: var(--ds-radius-sm);
        background: var(--ds-teal-tint);
        color: var(--ds-navy);
        font: inherit;
        font-weight: var(--ds-weight);
        cursor: pointer;
      }
      button.repair:hover { background: var(--ds-surface-hover); }
    `,
  ];

  private _counts(): { blocking: number; advisory: number } {
    const out = { blocking: 0, advisory: 0 };
    for (const f of this.findings ?? []) {
      if (f?.level === 'blocking') out.blocking += 1;
      else out.advisory += 1;
    }
    return out;
  }

  private _repair(findingId: string) {
    this.dispatchEvent(
      new CustomEvent('repair-finding', {
        bubbles: true,
        composed: true,
        detail: { findingId },
      }),
    );
  }

  private _toggle() {
    this.collapsed = !this.collapsed;
  }

  render() {
    // NOTHING TO DRAW AT ALL — the surface has not bound the path. Distinct from an
    // empty list, which says the checker found nothing open.
    if (this.findings === undefined) {
      return html`<div class="panel"><p class="waiting">Waiting for the surface to bind /findings…</p></div>`;
    }

    const rows = this.findings;
    if (!rows.length) return nothing;
    const counts = this._counts();
    return html`
      <div class="panel">
        <button class="header" type="button" @click=${this._toggle}>
          Catalog check — ${rows.length} open
          ${counts.blocking ? html`<span class="chip blocking">${counts.blocking} blocking</span>` : ''}
          <span class="chip count">${counts.advisory} advisory</span>
        </button>
        ${this.collapsed
          ? nothing
          : html`
            <ul>
              ${rows.map((f) => {
                const stage = this.stages?.[f.id];
                return html`
                  <li>
                    <span class="level ${f.level === 'blocking' ? 'blocking' : 'advisory'}">${f.level ?? 'advisory'}</span>
                    <span class="text">${f.text}</span>
                    ${stage === 'done'
                      ? html`<span class="stage done">completed</span>`
                      : stage === 'repair'
                        ? html`<span class="stage repair">in repair</span>`
                        : html`<button class="repair" type="button" @click=${() => this._repair(f.id)}>Repair</button>`}
                  </li>
                `;
              })}
            </ul>
          `}
      </div>
    `;
  }
}

customElements.define('chat-repair-actions', ChatRepairActions);

declare global {
  interface HTMLElementTagNameMap {
    'chat-repair-actions': ChatRepairActions;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-repair-actions': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatRepairActions> & {
          ref?: React.Ref<ChatRepairActions>;
        },
        ChatRepairActions
      >;
    }
  }
}
