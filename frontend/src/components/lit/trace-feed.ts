/**
 * <trace-feed> — the live telemetry view that belongs in the chat panel's `view`
 * slot when the rail's Trace button is selected.
 *
 * WHAT IT REPLACES. The trace view was a React component in the seat that has
 * since been retired (retired-files/console-seat-20260917/TraceFeed.tsx). It was
 * rendered as a JSX child of that seat, which is why it stopped existing when the
 * seat did: the slot it filled now lives inside <a2ui-renderer>'s shadow root, and
 * React cannot render into a shadow root. This is the same feed as a Lit element,
 * so it is a component like every other one and the SURFACE can put it in that
 * slot — anything can go there, which is the point of the slot.
 *
 * IT IS A VIEW, NOT A SOURCE. It reads nothing: `entries` and `breadcrumbCount`
 * arrive as bound properties from the surface's data model, `{path: "/trace/..."}`,
 * which is what Data-Binding.md asks of a component that displays state. The reads
 * themselves — the logger, fetch, errors, the surface's events, long tasks,
 * Sentry's scope — live in lib/trace-source.ts, which the shell writes into the
 * model. A component that fetches its own data cannot be handed a different one.
 *
 * EVERY LINE CARRIES ITS OWN SHAPE. A network line has a status and a duration; an
 * error has a stack; an event has a payload. The element renders what the entry has
 * and omits what it does not, so one list can hold every kind the source observes
 * without any of them looking like a half-filled version of the others.
 *
 * LOADING vs EMPTY is the difference between "the surface has not written the path
 * yet" and "it wrote an empty list". `entries` is undefined in the first case and
 * `[]` in the second, and the two draw differently on purpose: a false "nothing
 * yet" is a claim about the app, and it would be wrong.
 */

import { LitElement, html, css, nothing } from 'lit';
// The shared design sheet. A shadow-root component cannot use the shell's Tailwind
// sheet — see shared/design-tokens.ts for both reasons, and for the token list.
import { designTokens } from '@/shared/design-tokens';

/** One line in the feed. Mirrors TraceEntry in lib/trace-source.ts. */
interface TraceEntry {
  id: string;
  timestamp: number;
  kind: 'log' | 'network' | 'error' | 'event' | 'audit' | 'perf' | 'breadcrumb';
  level: string;
  message: string;
  detail?: string;
  durationMs?: number;
  status?: number;
}

const MAX_ENTRIES = 100;

/**
 * The level speaks before the kind: a failure and a slowdown are what they are
 * whatever produced them. Everything else is badged by its kind. The class names
 * resolve to tokens in the stylesheet, so no colour is chosen in JavaScript.
 */
const LEVEL_CLASS: Record<string, string> = {
  error: 'k-error',
  fatal: 'k-error',
  warning: 'k-warn',
  warn: 'k-warn',
};

/** A call this long is the outlier an operator is scrolling to find. */
const SLOW_MS = 1000;

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** Milliseconds under a second, seconds above it. 7920 → "7.9s". */
function formatDuration(ms: number): string {
  return ms < 1000 ? String(ms) + 'ms' : (ms / 1000).toFixed(1) + 's';
}

export class TraceFeed extends LitElement {
  // Public properties, NOT state: these are the component's contract with the
  // payload, and the renderer assigns only properties it can see declared here.
  static properties = {
    /** Bound to /trace/entries. Undefined until the surface writes that path. */
    entries: { type: Array },
    /** Bound to /trace/breadcrumbCount — how deep Sentry's scope currently is. */
    breadcrumbCount: { type: Number, attribute: 'breadcrumb-count' },
  };

  // `declare` — not a class field. A plain field would overwrite Lit's accessor
  // under useDefineForClassFields, which is how this repo's right column once
  // became a blank box. No constructor default for `entries` on purpose: unset
  // has to stay distinguishable from empty.
  declare entries?: TraceEntry[];
  declare breadcrumbCount?: number;

  // The shared sheet first, then this element's own layout. Every colour and type
  // value comes from the tokens — see shared/design-tokens.ts for why a shadow-root
  // component cannot use the shell's Tailwind sheet.
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
        /* 12px, one step below the thread's 14px: this is a dense log, not prose. */
        font-size: var(--ds-fs-sm);
        color: var(--ds-text);
        background: var(--ds-surface);
      }
      .head {
        position: sticky;
        top: 0;
        z-index: 1;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 10px 14px;
        background: var(--ds-surface);
        border-bottom: 1px solid var(--ds-rule);
        font-size: var(--ds-fs-label);
        font-weight: 600;
        letter-spacing: 0.09em;
        text-transform: uppercase;
        color: var(--ds-teal);
      }
      /* The brand gold, spent on one meaning: this view is live. */
      .live {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: var(--ds-gold);
        box-shadow: 0 0 0 3px rgba(246, 192, 49, 0.22);
        animation: trace-pulse 2.4s ease-in-out infinite;
      }
      @keyframes trace-pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.45; }
      }
      .count {
        margin-left: auto;
        min-width: 22px;
        padding: 2px 7px;
        border-radius: var(--ds-radius-pill);
        background: var(--ds-teal-tint);
        color: var(--ds-teal);
        font-size: var(--ds-fs-label);
        font-weight: 700;
        letter-spacing: 0.02em;
        text-align: center;
      }

      /* A FOUR-COLUMN GRID, so the log reads as columns: times stack, badges stack,
         messages start at one x. Inline flex left the message start ragged, which is
         what made a long list hard to scan. */
      .row {
        display: grid;
        grid-template-columns: 56px 78px minmax(0, 1fr) auto;
        column-gap: 10px;
        row-gap: 2px;
        align-items: baseline;
        padding: 7px 14px;
        border-bottom: 1px solid var(--ds-rule-soft);
        transition: background 90ms linear;
      }
      .row:hover { background: var(--ds-surface-hover); }
      /* Inter, like everything else — the digits align through tabular figures
         rather than a second typeface, which is what a narrower "data font" was
         really for. */
      .time {
        font-family: var(--ds-font);
        font-size: var(--ds-fs-meta);
        font-variant-numeric: tabular-nums;
        color: var(--ds-muted);
      }
      .kind {
        justify-self: start;
        padding: 1.5px 6px;
        border-radius: var(--ds-radius-sm);
        font-size: var(--ds-fs-label);
        font-weight: 700;
        letter-spacing: 0.07em;
        text-transform: uppercase;
        white-space: nowrap;
      }
      /* The badge, per kind. Classes rather than an inline style attribute, so the
         palette stays in one place and no line's colours are decided in JS. */
      .k-log { color: var(--ds-teal); background: var(--ds-teal-tint); }
      .k-network { color: var(--ds-navy); background: var(--ds-navy-tint); }
      .k-event { color: var(--ds-green); background: var(--ds-green-tint); }
      .k-audit { color: var(--ds-cyan); background: var(--ds-cyan-tint); }
      .k-perf { color: var(--ds-amber); background: var(--ds-amber-tint); }
      .k-breadcrumb { color: var(--ds-muted); background: var(--ds-grey-tint); }
      /* A failure and a slowdown outrank whatever produced them. */
      .k-error { color: var(--ds-red); background: var(--ds-red-tint); }
      .k-warn { color: var(--ds-amber); background: var(--ds-amber-tint); }

      .msg {
        min-width: 0;
        word-break: break-word;
        line-height: 1.45;
      }
      /* Right-hand column: status, then duration, both tabular so a column of
         numbers lines up and an outlier is visible without reading it. */
      .meta {
        display: flex;
        align-items: center;
        gap: 6px;
        font-family: var(--ds-font);
        font-size: var(--ds-fs-meta);
        font-variant-numeric: tabular-nums;
        color: var(--ds-muted);
        white-space: nowrap;
      }
      .status {
        padding: 1px 5px;
        border-radius: var(--ds-radius-sm);
        font-weight: 700;
        font-size: var(--ds-fs-label);
      }
      .s-ok { background: var(--ds-green-tint); color: #4f6f0f; }
      .s-warn { background: var(--ds-amber-tint); color: #8a4b06; }
      .s-bad { background: var(--ds-red-tint); color: #8f1d13; }
      .detail {
        grid-column: 3 / -1;
        font-family: var(--ds-font);
        font-size: var(--ds-fs-meta);
        font-variant-numeric: tabular-nums;
        line-height: 1.4;
        color: var(--ds-muted);
        white-space: pre-wrap;
        word-break: break-word;
      }
      /* A slow call is the thing an operator scrolls for; give it the weight. */
      .slow { color: #8a4b06; font-weight: 700; }

      .empty { padding: 18px 14px; font-size: var(--ds-fs-sm); color: var(--ds-muted); }
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
        animation: trace-spin 0.8s linear infinite;
      }
      @keyframes trace-spin {
        to { transform: rotate(360deg); }
      }
    `,
  ];

  /** The badge class: the level speaks first, then the kind. */
  private _kindClass(e: TraceEntry): string {
    return LEVEL_CLASS[e.level] ?? 'k-' + e.kind;
  }

  /** 2xx accepted, 3xx/4xx the caller's problem, 5xx the backend's. */
  private _statusClass(status: number): string {
    if (status >= 500) return 's-bad';
    return status >= 300 ? 's-warn' : 's-ok';
  }

  /** Status and duration, when the entry has either. */
  private _meta(e: TraceEntry) {
    const hasStatus = typeof e.status === 'number' && e.status > 0;
    const hasDuration = typeof e.durationMs === 'number';
    if (!hasStatus && !hasDuration) return nothing;
    return html`<span class="meta">
      ${hasStatus
        ? html`<span class="status ${this._statusClass(e.status as number)}">${e.status}</span>`
        : nothing}
      ${hasDuration
        ? html`<span class=${(e.durationMs as number) >= SLOW_MS ? 'slow' : ''}
            >${formatDuration(e.durationMs as number)}</span
          >`
        : nothing}
    </span>`;
  }

  render() {
    // Unset is not empty. See the file header.
    if (!Array.isArray(this.entries)) {
      return html`
        <div class="head">
          <span class="live" aria-hidden="true"></span>
          <span>Live trace</span>
        </div>
        <div class="waiting" role="status">
          <span class="spinner" aria-hidden="true"></span>
          Waiting for the surface to bind /trace/entries.
        </div>
      `;
    }

    return html`
      <div class="head">
        <span class="live" aria-hidden="true"></span>
        <span>Live trace</span>
        <span class="count">${this.entries.length}</span>
      </div>
      ${this.entries.length === 0
        ? html`<div class="empty">
            Nothing yet. Events appear here as the app logs them, as requests complete,
            as the surface acts, and as Sentry records breadcrumbs — ${this.breadcrumbCount ?? 0} in scope.
          </div>`
        : this.entries.map(
            (e) => html`
              <div class="row">
                <span class="time">${formatTime(e.timestamp)}</span>
                <span class="kind ${this._kindClass(e)}">${e.kind}</span>
                <span class="msg">${e.message}</span>
                ${this._meta(e)}
                ${e.detail ? html`<span class="detail">${e.detail}</span>` : nothing}
              </div>
            `,
          )}
      ${nothing}
    `;
  }
}

if (!customElements.get('trace-feed')) {
  customElements.define('trace-feed', TraceFeed);
}
