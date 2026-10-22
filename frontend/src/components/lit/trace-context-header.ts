/**
 * <trace-context-header> — the trace facts strip, IN THE SEAT'S READOUT BAR.
 *
 * WHAT IT IS. The governance room slots THIS into the seat's readout bar — the
 * <output-header> block at the top of the column ("Analyzing: Session 222 | …" is that
 * block's drawing sample) — through the seat's `status-content` relay. The owner,
 * 2026-10-13 late, correcting this element's first placement: *"That header information
 * doesn't go there. It goes here"* — pointing at the readout bar. The bar is the
 * where-am-I box: whatever the rail shows, it keeps saying which trace is on the table.
 *
 * THREE STATES, ONE ELEMENT — the owner's mapping (2026-10-13), extended on land (2026-10-14:
 * *"we need to put something in our header box when you land on the dashboard … maybe model
 * metrics/usage"*):
 *   state 1  `trace` only          — the trace ROW's facts: id, name, latency, cost,
 *                                    tokens, session, user.
 *   state 2  + `observation`       — the DETAIL header of the selected node: its name,
 *                                    its start time, its own latency/cost/tokens.
 *   landing  no `trace`, `metrics` — the ROOM's own facts: the newest window of model usage —
 *                                    traces, observations, cost, tokens and the model itself.
 *                                    A selected trace supersedes it; with neither drawn, the
 *                                    bar keeps its own face (never a placeholder claim).
 *
 * IT IS A VIEW, NOT A SOURCE — the trace-feed contract: both props arrive from the
 * shell (lib/governance-trace-source.ts is where the reads live), and undefined is not
 * empty: undefined = no trace chosen, which is a fact, so nothing is drawn.
 *
 * THE FLY-OUT'S TWO SURVIVING CONTROLS (owner, 2026-10-13: *"All we need is the
 * download button and then the three dot menu"* — the app's fly-out header also draws
 * an up/down flipper and an expander; both are dropped). Download JSON emits
 * `trace-download` and the SHELL writes the file from the bundle it already holds
 * (this element owns no data, only the ask). The ⋮ holds the app's own copy items —
 * Copy trace ID, Copy trace name — and nothing else: Share (it creates a PUBLIC link)
 * and Delete (destructive) stay out until the owner says otherwise; a menu item that
 * cannot do what it says is the class of untruth this seat does not draw.
 *
 * NO GRIPPER LIVES HERE (owner corrections, 2026-10-13 late). A five-dot grab row was
 * built below this header and dragged the chat column — *"I don't know what that
 * gripper is floating there. That was a misunderstanding. … that gripper below that
 * header … was supposed to allow the user to expand that header": the expander is the
 * readout bar's OWN meatball gripper (output-header's five dots), and its expand
 * behavior is future work, on the owner's word. The invented row was deleted — nothing
 * of it is left to find.
 */

import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';
import type { GovTraceSummary, GovTraceObservation, GovRoomMetrics } from '@/lib/governance-trace-source';

/** Milliseconds as the fork's own tables read them: 1.839 → "1.84s". */
function fmtLatency(seconds: number | null): string | null {
  return seconds === null ? null : `${seconds.toFixed(2)}s`;
}

/** USD as the fork's own cells read it: 0.000222108 → "$0.000222". Zero is "$0", not "—". */
function fmtCost(cost: number | null): string | null {
  if (cost === null) return null;
  if (cost === 0) return '$0';
  const digits = cost < 0.01 ? 6 : 4;
  return `$${cost.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')}`;
}

/** Tokens, the fork's "5.2k" shape. */
function fmtTokens(tokens: number | null): string | null {
  if (tokens === null) return null;
  if (tokens < 1000) return String(tokens);
  const k = tokens / 1000;
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

/** 6f764fcc2b4bb8af… → "6f764fc…" — the fork's own truncation in row headers. */
function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 7)}…` : id;
}

/** 00000000-0000-0000-0000-000000000001 → "00000000…001". */
function shortUser(id: string): string {
  return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-3)}` : id;
}

function fmtTimestamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export class TraceContextHeader extends LitElement {
  static properties = {
    /** The selected trace's facts. Undefined = nothing chosen — draws nothing. */
    trace: { type: Object },
    /** The selected node, when one is open in the Preview tab — switches to state 2. */
    observation: { type: Object },
    /** The room's landing metrics — drawn ONLY while no trace is selected (see the doc). */
    metrics: { type: Object },
  };

  declare trace?: GovTraceSummary | null;
  declare observation?: GovTraceObservation | null;
  declare metrics?: GovRoomMetrics | null;

  /** The ⋮ popover's open state. */
  private _menuOpen = false;
  /** Which item just copied, for the brief "Copied" swap — real feedback, no toast machinery. */
  private _copied: 'id' | 'name' | null = null;
  private _copiedTimer: number | null = null;
  /** The document listeners that exist only while the menu is open. */
  private _docDown: ((e: MouseEvent) => void) | null = null;
  private _docKey: ((e: KeyboardEvent) => void) | null = null;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._closeMenu();
    if (this._copiedTimer !== null) window.clearTimeout(this._copiedTimer);
  }

  /** The download ask — the shell owns the data, so the shell writes the file. */
  private _download = (): void => {
    this.dispatchEvent(new CustomEvent('trace-download', { bubbles: true, composed: true }));
  };

  private _toggleMenu = (e: Event): void => {
    e.stopPropagation();
    if (this._menuOpen) {
      this._closeMenu();
      return;
    }
    this._menuOpen = true;
    this._copied = null;
    /* Outside press closes; Escape closes. Both live exactly as long as the menu. */
    this._docDown = (ev: MouseEvent) => {
      const path = ev.composedPath();
      if (!path.includes(this)) this._closeMenu();
    };
    this._docKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') this._closeMenu();
    };
    document.addEventListener('mousedown', this._docDown, true);
    document.addEventListener('keydown', this._docKey);
    this.requestUpdate();
  };

  private _closeMenu = (): void => {
    if (this._docDown) document.removeEventListener('mousedown', this._docDown, true);
    if (this._docKey) document.removeEventListener('keydown', this._docKey);
    this._docDown = null;
    this._docKey = null;
    if (!this._menuOpen && this._copied === null) return;
    this._menuOpen = false;
    this._copied = null;
    this.requestUpdate();
  };

  /** Copy trace ID / trace name — the app's own two copy items, nothing invented. */
  private _copy(kind: 'id' | 'name'): void {
    const value = kind === 'id' ? this.trace?.id : this.trace?.name;
    if (!value) return;
    void navigator.clipboard.writeText(value);
    this._copied = kind;
    this.requestUpdate();
    if (this._copiedTimer !== null) window.clearTimeout(this._copiedTimer);
    this._copiedTimer = window.setTimeout(() => {
      this._copiedTimer = null;
      this._closeMenu();
    }, 900);
  }

  static styles = [
    designTokens,
    css`
      :host {
        display: block;
        width: 100%;
        font-family: var(--ds-font);
        font-size: var(--ds-fs-sm);
        color: var(--chat-text, var(--ds-text));
      }
      /* NO CHROME OF ITS OWN — THE BAR WEARS IT (owner's correction, 2026-10-13: the facts
         live in the seat's readout bar, and the bar already draws the panel, border and
         padding; this strip only lays its facts out inside). */
      .hd {
        display: flex;
        align-items: center;
        gap: 6px 12px;
        flex-wrap: wrap;
        min-height: 26px;
        min-width: 0;
      }
      .id {
        font-variant-numeric: tabular-nums;
        color: var(--ds-teal);
        font-weight: 600;
        font-size: var(--ds-fs-meta);
        user-select: text;
      }
      .name {
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 340px;
      }
      .facts {
        display: flex;
        align-items: center;
        gap: 4px 14px;
        flex-wrap: wrap;
        min-width: 0;
        font-variant-numeric: tabular-nums;
        color: var(--ds-muted);
        white-space: nowrap;
      }
      .fact {
        display: inline-flex;
        align-items: center;
        gap: 5px;
      }
      .lbl {
        /* WORD LABELS HOLD THE TEXT FLOOR (owner, 2026-10-13: text never below 14px) —
           the NUMBERS tier (fs-meta 13) is for figures, ids and timestamps only. */
        font-size: var(--ds-fs-label);
        letter-spacing: 0.04em;
        text-transform: lowercase;
        color: var(--ds-muted);
        opacity: 0.75;
      }
      .val {
        color: var(--chat-text, var(--ds-text));
      }
      .state2 .name {
        max-width: 300px;
      }
      .when {
        color: var(--ds-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      /* THE FLY-OUT'S TWO CONTROLS, at the header's trailing edge — quiet icon buttons,
         the chat's own ink on hover. */
      .acts {
        margin-left: auto;
        display: inline-flex;
        align-items: center;
        gap: 2px;
        position: relative;
      }
      .iconbtn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        padding: 0;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: var(--ds-muted);
        cursor: pointer;
      }
      .iconbtn:hover {
        color: var(--chat-text, var(--ds-text));
        background: var(--chat-rule, rgba(0, 0, 0, 0.05));
      }
      .iconbtn svg {
        display: block;
        pointer-events: none;
      }
      .menu {
        position: absolute;
        top: calc(100% + 6px);
        right: 0;
        z-index: 20;
        min-width: 176px;
        padding: 4px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: 8px;
        background: var(--chat-bg, var(--ds-surface));
        box-shadow: 0 8px 22px rgba(28, 47, 78, 0.14);
      }
      .mi {
        display: block;
        width: 100%;
        padding: 7px 10px;
        border: 0;
        border-radius: 5px;
        background: transparent;
        color: var(--chat-text, var(--ds-text));
        font: inherit;
        font-size: var(--ds-fs-meta);
        text-align: left;
        cursor: pointer;
      }
      .mi:hover {
        background: var(--chat-rule, rgba(0, 0, 0, 0.05));
      }
    `,
  ];

  /** THE FLY-OUT'S TWO CONTROLS — Download JSON, and the ⋮ with the app's copy items. */
  private _acts() {
    return html`
      <span class="acts">
        <button
          class="iconbtn"
          type="button"
          title="Download JSON"
          aria-label="Download JSON"
          @click=${this._download}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
        </button>
        <button
          class="iconbtn"
          type="button"
          title="More actions"
          aria-label="More actions"
          aria-expanded=${this._menuOpen ? 'true' : 'false'}
          @click=${this._toggleMenu}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.6"></circle>
            <circle cx="12" cy="12" r="1.6"></circle>
            <circle cx="12" cy="19" r="1.6"></circle>
          </svg>
        </button>
        ${this._menuOpen
          ? html`
              <div class="menu" role="menu">
                <button class="mi" role="menuitem" type="button" @click=${() => this._copy('id')}>
                  ${this._copied === 'id' ? 'Copied' : 'Copy trace ID'}
                </button>
                ${this.trace?.name
                  ? html`<button class="mi" role="menuitem" type="button" @click=${() => this._copy('name')}>
                      ${this._copied === 'name' ? 'Copied' : 'Copy trace name'}
                    </button>`
                  : nothing}
              </div>`
          : nothing}
      </span>
    `;
  }

  /** State 1 — the trace row's facts. */
  private _traceRow(trace: GovTraceSummary) {
    const latency = fmtLatency(trace.latency);
    const cost = fmtCost(trace.totalCost);
    const tokens = fmtTokens(trace.totalTokens);
    return html`
      <div class="hd state1">
        <span class="id" title=${trace.id}>${trace.id}</span>
        <!-- THE CONTROLS RIDE THE FIRST LINE (owner, 2026-10-13 late: "Just put the
             controls next to that first line") — they hug the id-row's right edge and
             the facts wrap below; margin-left: auto keeps them at the line's end. -->
        ${this._acts()}
        ${trace.name ? html`<span class="name" title=${trace.name}>${trace.name}</span>` : nothing}
        <span class="facts">
          ${latency ? html`<span class="fact"><span class="val">${latency}</span></span>` : nothing}
          ${cost ? html`<span class="fact"><span class="val">${cost}</span></span>` : nothing}
          ${tokens ? html`<span class="fact"><span class="val">${tokens}</span> <span class="lbl">tokens</span></span>` : nothing}
          ${trace.sessionId
            ? html`<span class="fact"><span class="lbl">session</span> <span class="val">${shortId(trace.sessionId)}</span></span>`
            : nothing}
          ${trace.userId
            ? html`<span class="fact"><span class="lbl">user</span> <span class="val">${shortUser(trace.userId)}</span></span>`
            : nothing}
        </span>
      </div>
    `;
  }

  /** State 2 — the selected node's detail header, under the trace's own id — the
      upper level stays told, so the box always says WHERE the person is (the owner:
      "everything underneath it … relates to that top box which is telling me where
      I am"). */
  private _detailRow(observation: GovTraceObservation, trace: GovTraceSummary) {
    const latency = fmtLatency(observation.latency);
    const cost = fmtCost(observation.totalCost);
    const tokens = fmtTokens(observation.totalTokens);
    return html`
      <div class="hd state2">
        <span class="id" title=${trace.id}>${trace.id}</span>
        ${this._acts()}
        <span class="name" title=${trace.name ?? observation.name ?? ''}>${observation.name ?? trace.name ?? '—'}</span>
        <span class="when">${fmtTimestamp(observation.startTime)}</span>
        <span class="facts">
          ${latency ? html`<span class="fact"><span class="val">${latency}</span></span>` : nothing}
          ${cost ? html`<span class="fact"><span class="val">${cost}</span></span>` : nothing}
          ${tokens ? html`<span class="fact"><span class="val">${tokens}</span> <span class="lbl">tokens</span></span>` : nothing}
        </span>
      </div>
    `;
  }

  /** Landing — the room's own facts, in the readout bar's own face. */
  private _metricsRow(metrics: GovRoomMetrics) {
    const cost = fmtCost(metrics.totalCost);
    const tokens = fmtTokens(metrics.totalTokens);
    return html`
      <div class="hd landing">
        <span class="name">Model usage</span>
        <span class="facts">
          ${metrics.model ? html`<span class="fact"><span class="val">${metrics.model}</span></span>` : nothing}
          <span class="fact"><span class="val">${metrics.traces}</span> <span class="lbl">traces</span></span>
          <span class="fact"><span class="val">${metrics.observations}</span> <span class="lbl">observations</span></span>
          ${cost ? html`<span class="fact"><span class="lbl">cost</span> <span class="val">${cost}</span></span>` : nothing}
          ${tokens ? html`<span class="fact"><span class="val">${tokens}</span> <span class="lbl">tokens</span></span>` : nothing}
          ${metrics.truncated ? html`<span class="fact"><span class="lbl">newest</span> <span class="val">${metrics.observations}</span></span>` : nothing}
        </span>
      </div>
    `;
  }

  render() {
    if (!this.trace) return this.metrics ? this._metricsRow(this.metrics) : nothing;
    return this.observation
      ? this._detailRow(this.observation, this.trace)
      : this._traceRow(this.trace);
  }
}

if (!customElements.get('trace-context-header')) {
  customElements.define('trace-context-header', TraceContextHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    'trace-context-header': TraceContextHeader;
  }
}
