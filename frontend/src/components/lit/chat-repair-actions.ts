/**
 * <chat-repair-actions> — the "Catalog check — N open" panel and its Repair buttons.
 *
 * The list Grace can see and the person acts on. It takes the findings and their
 * repair stages as properties, draws one row per finding (component | file, nodeId,
 * what), and reports a Repair click as `repair-finding` — the host's
 * handleRepairFinding already knows what to do with that event.
 *
 * Data flows one way: findings IN, `repair-finding` OUT. This element never
 * fetches the audit, never applies a repair, and never decides urgency — the host
 * owns the report and the repair lifecycle, exactly as it did for the React seat.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css, nothing } from 'lit';

export interface ChatFinding {
  id: string;
  check?: string;
  level?: 'advisory' | 'blocking' | 'pass';
  owner?: 'pipeline' | 'designer';
  component?: string;
  nodeId?: string;
  file?: string;
  what?: string;
  fix?: string;
}

export class ChatRepairActions extends LitElement {
  static properties = {
    /** Non-pass findings, blocking first. */
    findings: { type: Array },
    /** Record<string, 'repair' | 'done'> keyed by finding id. */
    repairStages: { type: Object },
    collapsed: { type: Boolean },
  };

  declare findings: ChatFinding[];
  declare repairStages: Record<string, 'repair' | 'done'>;
  declare collapsed: boolean;

  constructor() {
    super();
    this.findings = [];
    this.repairStages = {};
    // Collapsed by DEFAULT. This panel is not part of the Figma frame — it is a
    // console feature living above the thread. Expanded with 52 findings it
    // measured 3,309px and pushed the composer below the fold, which read as
    // "the chat input is missing". The header stays visible either way; the list
    // waits for a click, and even expanded it is capped and scrolls.
    this.collapsed = true;
  }

  static styles = css`
    :host { display: block; }
    .panel {
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #fff;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      color: #374151;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: #f7fafc;
      border-radius: 6px 6px 0 0;
      font: inherit;
      font-weight: 700;
      color: #10455f;
      cursor: pointer;
      text-align: left;
    }
    .chip {
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .chip.blocking { background: #fee2e2; color: #991b1b; }
    .chip.count { background: #e5f1ec; color: #10455f; }
    ul {
      list-style: none;
      margin: 0;
      padding: 0 12px 8px;
      /* The cap: expanded, the list scrolls instead of growing the column and
         burying the composer beneath it. */
      max-height: 240px;
      overflow-y: auto;
    }
    li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      border-bottom: 1px solid #f3f4f6;
    }
    li:last-child { border-bottom: none; }
    .id { font-weight: 700; color: #10455f; }
    .file { color: #6b7280; }
    .node { color: #6b7280; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
    .what {
      flex: 1;
      min-width: 0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stage { font-weight: 700; }
    .stage.done { color: #15803d; }
    .stage.repair { color: #b45309; }
    button.repair {
      padding: 4px 12px;
      border: 1px solid #507274;
      border-radius: 4px;
      background: #e5f1ec;
      color: #10455f;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button.repair:hover { background: #d3e8e0; }
  `;

  private get _ordered(): ChatFinding[] {
    const list = (this.findings ?? []).filter(Boolean);
    return [...list].sort((a, b) => {
      const rank = (f: ChatFinding) => (f.level === 'blocking' ? 0 : 1);
      return rank(a) - rank(b) || String(a.id).localeCompare(String(b.id));
    });
  }

  private _counts(): { blocking: number; pipeline: number; designer: number } {
    const out = { blocking: 0, pipeline: 0, designer: 0 };
    for (const f of this.findings ?? []) {
      if (f.level === 'blocking') out.blocking += 1;
      if (f.owner === 'pipeline') out.pipeline += 1;
      if (f.owner === 'designer') out.designer += 1;
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
    const findings = this._ordered;
    if (!findings.length) return nothing;
    const counts = this._counts();
    return html`
      <div class="panel">
        <button class="header" type="button" @click=${this._toggle}>
          Catalog check — ${findings.length} open
          ${counts.blocking ? html`<span class="chip blocking">${counts.blocking} blocking</span>` : ''}
          <span class="chip count">${counts.pipeline} pipeline · ${counts.designer} designer</span>
        </button>
        ${this.collapsed
          ? nothing
          : html`
            <ul>
              ${findings.map((f) => {
                const stage = this.repairStages?.[f.id];
                return html`
                  <li>
                    <span class="id">${f.component || f.id}</span>
                    ${f.file ? html`<span class="file">${f.file}</span>` : ''}
                    ${f.nodeId ? html`<span class="node">${f.nodeId}</span>` : ''}
                    <span class="what">${f.what || ''}</span>
                    ${stage === 'done'
                      ? html`<span class="stage done">done ✓</span>`
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
