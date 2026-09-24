/**
 * <eval-feed> — the evaluations view that belongs in the chat panel's `view` slot when the
 * rail's Evals button is selected.
 *
 * ONE FOR ONE WITH N8N'S EVALUATIONS VIEW. Their view is a list of test runs, one row per run:
 * a run number, when it ran, a status, and the sentence that decided the status. Ours is the
 * same list for one package: every Run of this prompt, judged, newest first. The judgment is
 * the model's (Qwen, via the backend's /evaluations endpoint) — the element draws what the
 * surface binds and judges nothing itself.
 *
 * IT IS A VIEW, NOT A SOURCE — the same contract as trace-feed: `evaluations` arrives as a
 * bound array from the data model and the element fetches nothing. Undefined is "the surface
 * has not written the path yet"; [] is "this package has run and nothing has been judged",
 * and the two draw differently, because a false "nothing yet" is a claim about the app.
 *
 * THE ROW IS N8N'S: run number, run-at (date, time), status with its colour, and the verdict
 * sentence under it. A status is one of cleared / failed / running / error — cleared and
 * failed come from the judge, running and error are the app's own facts about the run.
 */

import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

/** One judged run. Mirrors the row the backend's /evaluations endpoint returns. */
export interface EvaluationRecord {
  id: string;
  /** 1-based, newest last — the same "Run N" the n8n table shows. */
  index: number;
  /** ISO timestamp of the run. */
  runAt: string;
  /** What started this run: the Run button, a schedule, a message. */
  trigger: string;
  /** The judge's verdict. 'running' and 'error' are the app's own facts, not judgments. */
  verdict: 'cleared' | 'failed' | 'running' | 'error';
  /** The judge's one sentence. Empty for running/error. */
  sentence?: string;
}

/** Status speaks through colour and glyph, exactly as the canvas's own mark does. */
const STATUS = {
  cleared: { glyph: '✓', cls: 'st-cleared' },
  failed: { glyph: '⚠', cls: 'st-failed' },
  running: { glyph: '', cls: 'st-running' },
  error: { glyph: '✕', cls: 'st-error' },
} as const;

const STATUS_WORD: Record<EvaluationRecord['verdict'], string> = {
  cleared: 'Cleared',
  failed: 'Failed',
  running: 'Running',
  error: 'Error',
};

/** "2026-09-24, 08:12:33" — the same two facts n8n's Run-at column shows. */
function formatRunAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-US', { hour12: false });
}

export class EvalFeed extends LitElement {
  static properties = {
    /** Bound to /session/middle_column/evaluations. Undefined until the surface writes it. */
    evaluations: { type: Array },
  };

  // No constructor default on purpose: unset has to stay distinguishable from empty.
  declare evaluations?: EvaluationRecord[];

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
        /* NO GROUND OF ITS OWN — the panel's view slot owns the ground, and the owner asked
           for the Evals view to be transparent so the drawing's ground reads through it. */
        background: transparent;
      }
      .head {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: transparent;
        border-bottom: 1px solid var(--chat-rule, var(--ds-rule));
        font-size: var(--ds-fs-label);
        font-weight: 600;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--chat-text, var(--ds-teal));
      }
      .count {
        margin-left: auto;
        min-width: 22px;
        padding: 2px 7px;
        border-radius: var(--ds-radius-pill);
        background: var(--ds-teal-tint);
        color: var(--ds-teal);
        text-align: center;
      }
      .empty {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 18px 14px;
        color: var(--chat-muted, var(--ds-muted));
      }
      .empty .title { font-weight: 600; color: var(--chat-text, var(--ds-text)); }
      .rows { padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; }
      .row {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        padding: 10px 12px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius);
        /* A TINT, NOT A GROUND — the row reads as a card without painting over the
           drawing's ground the way the old white feed did. */
        background: rgba(0, 0, 0, 0.12);
      }
      .idx {
        min-width: 34px;
        font-weight: 700;
        color: var(--chat-muted, var(--ds-muted));
        font-variant-numeric: tabular-nums;
      }
      .main { flex: 1 1 auto; min-width: 0; }
      .top {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .status {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-weight: 600;
        text-transform: capitalize;
      }
      .status .glyph { width: 16px; text-align: center; }
      .st-cleared { color: var(--ds-green); }
      .st-failed { color: var(--ds-amber); }
      .st-error { color: var(--ds-red); }
      .st-running .spin {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        border: 2px solid var(--ds-teal-tint);
        border-top-color: var(--ds-teal);
        animation: ef-spin 0.9s linear infinite;
      }
      @keyframes ef-spin { to { transform: rotate(360deg); } }
      @media (prefers-reduced-motion: reduce) {
        .st-running .spin { animation-duration: 2.4s; }
      }
      .when {
        margin-left: auto;
        font-size: var(--ds-fs-label);
        color: var(--chat-muted, var(--ds-muted));
        white-space: nowrap;
      }
      .sentence {
        margin-top: 4px;
        line-height: 1.45;
        color: var(--chat-text, var(--ds-text));
      }
    `,
  ];

  private _statusView(r: EvaluationRecord): unknown {
    const s = STATUS[r.verdict];
    const glyph = r.verdict === 'running'
      ? html`<span class="spin" aria-hidden="true"></span>`
      : html`<span class="glyph" aria-hidden="true">${s.glyph}</span>`;
    return html`<span class="status ${s.cls}">${glyph}${STATUS_WORD[r.verdict]}</span>`;
  }

  render() {
    // Unset is not empty: no list is "the surface has not written the path", [] is "ran and
    // nothing has been judged". Two different claims, drawn differently.
    if (this.evaluations === undefined) {
      return html`
        <div class="head">Evaluations</div>
        <div class="empty" role="status">
          <span class="title">Loading evaluations…</span>
          <span>Waiting for the surface to write this package's run history.</span>
        </div>
      `;
    }
    if (this.evaluations.length === 0) {
      return html`
        <div class="head">Evaluations</div>
        <div class="empty" role="status">
          <span class="title">Nothing has been judged yet</span>
          <span>Press ▶ Play the run and the judge's verdict lands here, one row per run.</span>
        </div>
      `;
    }
    return html`
      <div class="head">
        Evaluations
        <span class="count">${this.evaluations.length}</span>
      </div>
      <div class="rows">
        ${this.evaluations.map((r) => html`
          <div class="row">
            <span class="idx">#${r.index}</span>
            <div class="main">
              <div class="top">
                ${this._statusView(r)}
                <span class="when" title=${r.runAt}>${formatRunAt(r.runAt)}</span>
              </div>
              ${r.sentence ? html`<div class="sentence">${r.sentence}</div>` : nothing}
            </div>
          </div>
        `)}
      </div>
    `;
  }
}

if (!customElements.get('eval-feed')) customElements.define('eval-feed', EvalFeed);

declare global {
  interface HTMLElementTagNameMap {
    'eval-feed': EvalFeed;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'eval-feed': React.DetailedHTMLProps<React.HTMLAttributes<EvalFeed> & {
        evaluations?: EvaluationRecord[];
        ref?: React.Ref<EvalFeed>;
      }, EvalFeed>;
    }
  }
}
