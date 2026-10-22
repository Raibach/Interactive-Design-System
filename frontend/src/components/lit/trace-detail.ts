/**
 * <trace-detail> — the selected observation's detail, for the seat's Preview tab.
 *
 * WHAT IT IS. The Langfuse fork's detail pane (the inner strip + the IO it shows below
 * it), transcribed into the seat — the owner's mapping (2026-10-13): "a preview opens up
 * exactly what it does now and then inside of that you've got tabs to navigate that
 * section". The strip carries the fork's full set — Preview | Attributes | Scores |
 * Log View | Formatted | Raw — and every one of them draws: Preview and Formatted and
 * Raw from the node's own I/O, Attributes from the node's fields, Scores from the
 * trace's score rows (the same read the tree's chips use), Log View as the trace's
 * observations in time order. "Open in Composer" is still absent until its door is
 * confirmed (the plan's gate M4) — a button with no landing place is a lie about what
 * exists.
 *
 * NO INNER SCROLL BOXES (the owner, 2026-10-13: "the chat itself has its own scroll
 * bar so you should flatten those out and get those out of those scroll boxes"): every
 * block here flows at its natural height and the chat column's own single scroller
 * carries it. Nothing in this element scrolls on its own.
 *
 * IT IS A VIEW, NOT A SOURCE — the trace-feed contract: `trace`, `observation` and `io`
 * all arrive from the shell (lib/governance-trace-source.ts reads them; the shell writes
 * them). Undefined vs null on `io` follows the contract: undefined = the read has not
 * answered yet (waiting), `{input:null, output:null}` = the app answered and there is
 * nothing captured (a different claim, drawn differently).
 */

import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';
import type { GovTraceSummary, GovTraceObservation, GovObservationIO, GovTraceScore } from '@/lib/governance-trace-source';

type DetailMode = 'preview' | 'attributes' | 'scores' | 'log' | 'formatted' | 'raw';

const MODES: Array<{ id: DetailMode; label: string }> = [
  { id: 'preview', label: 'Preview' },
  { id: 'attributes', label: 'Attributes' },
  { id: 'scores', label: 'Scores' },
  { id: 'log', label: 'Log View' },
  { id: 'formatted', label: 'Formatted' },
  { id: 'raw', label: 'Raw' },
];

function fmtLatency(seconds: number | null): string {
  return seconds === null ? '—' : `${seconds.toFixed(2)}s`;
}

function fmtCost(cost: number | null): string {
  if (cost === null) return '—';
  if (cost === 0) return '$0';
  const digits = cost < 0.01 ? 6 : 4;
  return `$${cost.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function fmtTokens(tokens: number | null): string {
  if (tokens === null) return '—';
  if (tokens < 1000) return String(tokens);
  const k = tokens / 1000;
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

function prettyOrRaw(value: string | null): string {
  if (value === null) return '';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

/** A score's value as its own dataType reads it — the fork's ScoreBadge behavior. */
function fmtScore(score: GovTraceScore): string {
  const t = (score.dataType ?? '').toUpperCase();
  if (t === 'BOOLEAN') return score.value ? 'True' : 'False';
  if (t === 'CATEGORICAL') return score.stringValue ?? '';
  if (score.value !== null) return String(score.value);
  return score.stringValue ?? '';
}

/** HH:MM:SS.mmm for the log lines — built by hand so the milliseconds are always there. */
function logTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}.${String(d.getMilliseconds()).padStart(3, '0')}`;
}

/** One role-tagged block of a chat-shaped input, when the string parses to one. */
interface RoleBlock {
  role: string;
  content: string;
}

function roleBlocks(value: string | null): RoleBlock[] | null {
  if (value === null) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  const blocks: RoleBlock[] = [];
  for (const item of parsed) {
    if (!item || typeof item !== 'object') return null;
    const record = item as Record<string, unknown>;
    const role = typeof record.role === 'string' ? record.role : null;
    if (!role) return null;
    const content =
      typeof record.content === 'string'
        ? record.content
        : record.content === undefined || record.content === null
          ? ''
          : JSON.stringify(record.content, null, 2);
    blocks.push({ role, content });
  }
  return blocks;
}

export class TraceDetail extends LitElement {
  static properties = {
    /** The selected trace — context for the attributes and the working header. */
    trace: { type: Object },
    /** The selected node. Undefined/null = none chosen — the element's own empty face. */
    observation: { type: Object },
    /** The node's IO: undefined = being read; null or {input:null,…} = nothing captured. */
    io: { type: Object },
    /**
     * Collapse System Prompts — the tree header's View Options toggle, handed over by
     * the shell (the fork's preference reshapes both panels the same way). When set,
     * system blocks arrive FOLDED: the role line, the opening of the text, and one
     * control to open them per block.
     */
    collapseSystemPrompt: { type: Boolean, attribute: 'collapse-system-prompts' },
    /** The trace's scores (ScoreDomain rows) — the shell's read; [] = none, a fact. */
    scores: { type: Array },
    /** The trace's observations, for Log View — the same bundle the tree draws. */
    observations: { type: Array },
  };

  declare trace?: GovTraceSummary | null;
  declare observation?: GovTraceObservation | null;
  declare io?: GovObservationIO | null;
  declare collapseSystemPrompt?: boolean;
  declare scores?: GovTraceScore[];
  declare observations?: GovTraceObservation[];

  /** UI-local: which inner tab is open. Presentation only — no claim about data. */
  private _mode: DetailMode = 'preview';
  /** UI-local: the system blocks the person opened past the collapse preference. */
  private _openedFolds = new Set<string>();

  static styles = [
    designTokens,
    css`
      :host {
        display: block;
        width: 100%;
        font-family: var(--ds-font);
        font-size: var(--ds-fs-sm);
        color: var(--chat-text, var(--ds-text));
        background: var(--chat-bg, var(--ds-surface));
      }
      .strip {
        display: flex;
        align-items: center;
        gap: 2px;
        padding: 6px 10px;
        border-bottom: 1px solid var(--chat-rule, var(--ds-rule));
        overflow-x: auto;
      }
      .mode {
        border: 0;
        background: none;
        color: var(--ds-muted);
        font: inherit;
        font-size: var(--ds-fs-meta);
        padding: 4px 9px;
        border-radius: var(--ds-radius-sm);
        cursor: pointer;
        white-space: nowrap;
      }
      .mode:hover {
        color: var(--chat-text, var(--ds-text));
      }
      .mode.on {
        color: var(--chat-text, var(--ds-text));
        font-weight: 600;
        background: var(--chat-user-bg, var(--ds-surface-hover));
      }
      .body {
        padding: 10px 14px 16px;
      }
      .waiting {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 18px 14px;
        font-size: var(--ds-fs-sm);
        color: var(--ds-muted);
      }
      .spinner {
        width: 13px;
        height: 13px;
        border: 2px solid var(--ds-teal);
        border-top-color: transparent;
        border-radius: 50%;
        animation: td-spin 0.8s linear infinite;
      }
      @keyframes td-spin {
        to { transform: rotate(360deg); }
      }
      .block {
        margin: 0 0 12px;
      }
      .block:last-child {
        margin-bottom: 0;
      }
      .role {
        font-size: var(--ds-fs-label);
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ds-muted);
        margin-bottom: 5px;
      }
      pre {
        margin: 0;
        padding: 10px 12px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius-sm);
        background: rgba(0, 0, 0, 0.14);
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: var(--ds-fs-meta);
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-word;
        /* NO MAX-HEIGHT, NO OVERFLOW: the chat column's own single scroller carries
           long output (the owner's flatten rule — see the file header). */
      }
      .score-name {
        padding: 4px 8px 4px 0;
        color: var(--ds-muted);
        white-space: nowrap;
        vertical-align: top;
      }
      .score-val {
        padding: 4px 0;
        word-break: break-word;
      }
      .log {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .log-line {
        display: flex;
        align-items: baseline;
        gap: 10px;
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: var(--ds-fs-meta);
      }
      .log-time {
        color: var(--ds-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .log-type {
        color: var(--ds-teal);
        white-space: nowrap;
      }
      .log-lvl {
        color: #fcd34d;
        font-weight: 700;
      }
      .log-name {
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .log-status {
        color: var(--ds-muted);
      }
      .none {
        color: var(--ds-muted);
        font-style: italic;
      }
      .fold-btn {
        margin-left: 8px;
        border: 0;
        background: none;
        color: var(--ds-teal);
        font: inherit;
        font-size: var(--ds-fs-meta);
        cursor: pointer;
        padding: 0;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: var(--ds-fs-meta);
      }
      td {
        padding: 4px 8px;
        border-bottom: 1px solid var(--chat-rule, var(--ds-rule-soft, var(--ds-rule)));
        vertical-align: top;
        font-variant-numeric: tabular-nums;
      }
      td.k {
        width: 130px;
        color: var(--ds-muted);
        white-space: nowrap;
      }
      td.v {
        word-break: break-word;
      }
    `,
  ];

  private _setMode(mode: DetailMode) {
    this._mode = mode;
    this.requestUpdate();
  }

  private _strip() {
    return html`
      <div class="strip" role="tablist">
        ${MODES.map(
          (m) => html`<button
            class="mode ${this._mode === m.id ? 'on' : ''}"
            role="tab"
            aria-selected=${this._mode === m.id}
            @click=${() => this._setMode(m.id)}
          >
            ${m.label}
          </button>`,
        )}
      </div>
    `;
  }

  private _ioBlock(label: string, value: string | null, parsed: RoleBlock[] | null) {
    if (parsed && parsed.length > 0) {
      return parsed.map((block, index) => {
        const foldKey = `${label}-${index}`;
        // COLLAPSE SYSTEM PROMPTS — the fork's preference, honored here because the
        // blocks are drawn here: a system block shows its opening and one control.
        if (
          this.collapseSystemPrompt &&
          block.role.toLowerCase() === 'system' &&
          !this._openedFolds.has(foldKey)
        ) {
          const opening = block.content.slice(0, 160);
          return html`
            <div class="block">
              <div class="role">${block.role}</div>
              <div class="none">
                ${opening}${block.content.length > 160 ? '…' : ''}
                <button class="fold-btn" @click=${() => this._openFold(foldKey)}>Show</button>
              </div>
            </div>
          `;
        }
        return html`
          <div class="block">
            <div class="role">${block.role}</div>
            <pre>${block.content}</pre>
          </div>
        `;
      });
    }
    return html`
      <div class="block">
        <div class="role">${label}</div>
        ${value === null || value === ''
          ? html`<div class="none">Nothing captured.</div>`
          : html`<pre>${value}</pre>`}
      </div>
    `;
  }

  private _openFold(key: string) {
    this._openedFolds.add(key);
    this.requestUpdate();
  }

  private _previewBody(io: GovObservationIO) {
    return html`
      ${this._ioBlock('Input', io.input, roleBlocks(io.input))}
      ${this._ioBlock('Output', io.output, roleBlocks(io.output))}
    `;
  }

  private _attributesBody(observation: GovTraceObservation, io: GovObservationIO) {
    const rows: Array<[string, string]> = [
      ['Type', observation.type],
      ['Name', observation.name ?? '—'],
      ['Model', observation.model ?? '—'],
      ['Start', observation.startTime],
      ['End', observation.endTime ?? '—'],
      ['Latency', fmtLatency(observation.latency)],
      ['Cost', fmtCost(observation.totalCost)],
      ['Tokens', fmtTokens(observation.totalTokens)],
      ['Level', observation.level ?? '—'],
      ['Status', observation.statusMessage ?? '—'],
      ['Session', observation.sessionId ?? '—'],
      ['User', observation.userId ?? '—'],
      ['Environment', observation.environment ?? '—'],
      ['ID', observation.id],
    ];
    return html`
      <table>
        ${rows.map(([k, v]) => html`<tr><td class="k">${k}</td><td class="v">${v}</td></tr>`)}
      </table>
      ${io.metadata
        ? html`
            <div class="block" style="margin-top: 12px">
              <div class="role">Metadata</div>
              <pre>${prettyOrRaw(io.metadata)}</pre>
            </div>
          `
        : nothing}
    `;
  }

  /** The TRACE's scores — the portal's Scores tab, from the same read the tree's chips use. */
  private _scoresBody() {
    if (!Array.isArray(this.scores)) {
      return html`
        <div class="waiting" role="status">
          <span class="spinner" aria-hidden="true"></span>
          Reading scores…
        </div>
      `;
    }
    if (this.scores.length === 0) {
      return html`<div class="none">No scores.</div>`;
    }
    return html`
      <table>
        ${this.scores.map(
          (s) => html`<tr>
            <td class="score-name">${s.name || '(unnamed)'}</td>
            <td class="score-val">
              ${fmtScore(s)}${s.observationId ? nothing : html` <span class="none">(trace-level)</span>`}
            </td>
          </tr>`,
        )}
      </table>
    `;
  }

  /** The trace's event log — the fork's Log View: observations in time order. */
  private _logBody() {
    if (!Array.isArray(this.observations)) {
      return html`
        <div class="waiting" role="status">
          <span class="spinner" aria-hidden="true"></span>
          Reading the trace…
        </div>
      `;
    }
    if (this.observations.length === 0) {
      return html`<div class="none">No observations.</div>`;
    }
    const sorted = [...this.observations].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    return html`
      <div class="log">
        ${sorted.map(
          (o) => html`<div class="log-line">
            <span class="log-time">${logTime(o.startTime)}</span>
            <span class="log-type ${o.level && o.level !== 'DEFAULT' ? 'log-lvl' : ''}">${o.type}</span>
            <span class="log-name">${o.name ?? '(unnamed)'}</span>
            ${o.statusMessage ? html`<span class="log-status">${o.statusMessage}</span>` : nothing}
          </div>`,
        )}
      </div>
    `;
  }

  private _formattedBody(io: GovObservationIO) {
    const input = io.input === null ? null : prettyOrRaw(io.input);
    const output = io.output === null ? null : prettyOrRaw(io.output);
    return html`
      ${input === null ? nothing : html`<div class="block"><div class="role">Input</div><pre>${input}</pre></div>`}
      ${output === null ? nothing : html`<div class="block"><div class="role">Output</div><pre>${output}</pre></div>`}
      ${input === null && output === null ? html`<div class="none">Nothing captured.</div>` : nothing}
    `;
  }

  private _rawBody(io: GovObservationIO) {
    return html`
      ${io.input === null ? nothing : html`<div class="block"><div class="role">Input</div><pre>${io.input}</pre></div>`}
      ${io.output === null ? nothing : html`<div class="block"><div class="role">Output</div><pre>${io.output}</pre></div>`}
      ${io.input === null && io.output === null ? html`<div class="none">Nothing captured.</div>` : nothing}
    `;
  }

  render() {
    if (!this.observation) {
      return html`
        <div class="waiting" role="status">Select a node in the Trace tab and its detail lands here.</div>
      `;
    }
    if (this.io === undefined) {
      return html`
        ${this._strip()}
        <div class="waiting" role="status">
          <span class="spinner" aria-hidden="true"></span>
          Reading ${this.observation.name ?? 'the node'}…
        </div>
      `;
    }
    const io: GovObservationIO = this.io ?? { input: null, output: null, metadata: null };
    return html`
      ${this._strip()}
      <div class="body">
        ${this._mode === 'preview'
          ? this._previewBody(io)
          : this._mode === 'attributes'
            ? this._attributesBody(this.observation, io)
            : this._mode === 'scores'
              ? this._scoresBody()
              : this._mode === 'log'
                ? this._logBody()
                : this._mode === 'formatted'
                  ? this._formattedBody(io)
                  : this._rawBody(io)}
      </div>
    `;
  }
}

if (!customElements.get('trace-detail')) {
  customElements.define('trace-detail', TraceDetail);
}

declare global {
  interface HTMLElementTagNameMap {
    'trace-detail': TraceDetail;
  }
}
