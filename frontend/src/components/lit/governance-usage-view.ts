/**
 * <governance-usage-view> — WHAT THE SYSTEM SPENT, drawn.
 *
 * The owner, 2026-10-03: *"it's a great way to test our system, for me to observe the
 * governance of the system's performance — to see what kind of cost is generated using a pro
 * model from a cloud, because the ultimate objective of the application is to reduce token
 * costs."*
 *
 * IT READS ITS OWN FEED, like <figma-layers-view> reads the audit: `GET /api/governance/usage`
 * — the per-call ledger (one row per model call, written at the request boundary with the
 * provider's own usage numbers). The element fetches, writes nothing, and draws exactly what
 * the record says: today's totals, the per-model split, and the newest calls.
 *
 * TOKENS ARE MEASURED. A COST is shown only when the deployment states its prices, and
 * `priced_calls` says how many of the day's calls the sum covers — a partial sum is never
 * presented as the whole bill, and an absent cost says it is absent. An empty ledger says
 * "nothing recorded yet" — a real answer, not a blank.
 *
 * THE STYLING IS DELIBERATELY PLAIN. The owner will redesign this UI and use the data's shape
 * as his guide; this element's job is to make every number readable, never to be final.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

interface UsageCall {
  at?: string;
  user_id?: string;
  mode?: string;
  model?: string;
  package_session_id?: string | null;
  conversation_id?: string | null;
  total_tokens?: number | null;
  prompt_tokens?: number | null;
  completion_tokens?: number | null;
  elapsed_s?: number | null;
  temperature?: number | null;
  reasoning_tokens?: number | null;
  est_cost_usd?: number | null;
}

interface UsageFeed {
  calls: UsageCall[];
  today: {
    calls: number;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    est_cost_usd: number | null;
    priced_calls: number;
  };
  today_by_model: Array<{ model?: string; calls: number; total_tokens: number }>;
  today_by_user: Array<{ user_id?: string; calls: number; total_tokens: number }>;
  cost_note?: string;
}

export class GovernanceUsageView extends LitElement {
  static properties = {
    /** Bumped by the host (or the button) to re-read the feed. */
    refresh: { type: Number },
  };

  declare refresh: number;

  private _feed: UsageFeed | null = null;
  private _state: 'loading' | 'ready' | 'error' = 'loading';
  private _error = '';

  constructor() {
    super();
    this.refresh = 0;
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('refresh')) void this._load();
  }

  private async _load(): Promise<void> {
    this._state = 'loading';
    this.requestUpdate();
    try {
      const res = await fetch('/api/governance/usage?limit=100');
      const payload = (await res.json().catch(() => null)) as UsageFeed | { detail?: string } | null;
      if (!res.ok) {
        const detail = (payload as { detail?: string } | null)?.detail;
        throw new Error(String(detail || `HTTP ${res.status}`));
      }
      this._feed = payload as UsageFeed;
      this._state = 'ready';
    } catch (err) {
      this._feed = null;
      this._error = err instanceof Error ? err.message : String(err);
      this._state = 'error';
    }
    this.requestUpdate();
  }

  private _reload = (): void => {
    this.refresh += 1;
  };

  private _fmt(n: number | null | undefined): string {
    return typeof n === 'number' ? n.toLocaleString('en-US') : '—';
  }

  private _when(iso?: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? iso
      : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  }

  /** A user id, shortened the way the rest of the app shows identities: 8…4. */
  private _short(id?: string | null): string {
    if (!id) return '—';
    return id.length > 14 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id;
  }

  /**
   * THE DAY IN ONE SENTENCE — what the system did, at the top. Composed FROM THE FEED, so it
   * cannot say anything the ledger does not: calls and the models they ran on, the token split,
   * and the estimate with its own coverage (how many calls the price covers) — never a sum
   * presented as a bill.
   */
  private _summary(feed: UsageFeed): string {
    const t = feed.today;
    const models = feed.today_by_model.map((m) => m.model || '(model unrecorded)').join(', ');
    const priced = typeof t.est_cost_usd === 'number';
    const calls = `${this._fmt(t.calls)} call${t.calls === 1 ? '' : 's'}`;
    const where = models ? ` on ${models}` : '';
    const tokens = `${this._fmt(t.total_tokens)} tokens (${this._fmt(t.prompt_tokens)} in / ${this._fmt(t.completion_tokens)} out)`;
    const money = priced
      ? `, about $${t.est_cost_usd!.toFixed(4)} at DeepSeek rates${
          t.priced_calls < t.calls ? ` (${t.priced_calls} of ${t.calls} calls priced)` : ''
        }`
      : ', cost not estimated (no published rate for this model)';
    return `Today the system made ${calls}${where} — ${tokens}${money}.`;
  }

  render() {
    if (this._state === 'loading') {
      return html`<div class="line"><span class="spin" aria-hidden="true"></span> reading the ledger…</div>`;
    }
    if (this._state === 'error') {
      return html`<div class="line bad">The usage ledger could not be read: ${this._error}</div>`;
    }
    const feed = this._feed;
    if (!feed) return nothing;
    const t = feed.today;
    const priced = typeof t.est_cost_usd === 'number';
    return html`
      <div class="wrap">
        <div class="head">
          <span class="title">Today</span>
          <button class="reload" type="button" @click=${this._reload}>Re-read</button>
        </div>
        ${t.calls === 0
          ? html`<div class="line">Nothing recorded yet — the ledger starts with the first model call.</div>`
          : html`
              ${/* THE SUMMARY FIRST (owner, 2026-10-03: *"probably want to give a summary of what
                    you do at the top"*) — one sentence a person can read before the cards. */ ''}
              <p class="summary">${this._summary(feed)}</p>
              <div class="totals">
                <div class="cell"><span class="k">Calls</span><span class="v">${this._fmt(t.calls)}</span></div>
                <div class="cell"><span class="k">Tokens in</span><span class="v">${this._fmt(t.prompt_tokens)}</span></div>
                <div class="cell"><span class="k">Tokens out</span><span class="v">${this._fmt(t.completion_tokens)}</span></div>
                <div class="cell"><span class="k">Tokens total</span><span class="v">${this._fmt(t.total_tokens)}</span></div>
                <div class="cell">
                  <span class="k">Est. cost</span>
                  <span class="v">${priced ? `$${t.est_cost_usd!.toFixed(4)}` : 'not priced'}</span>
                  ${priced
                    ? html`<span class="sub">${t.priced_calls} of ${t.calls} call${t.calls === 1 ? '' : 's'} priced</span>`
                    : html`<span class="sub">no published rate for this model</span>`}
                </div>
              </div>
              <div class="bymodel">
                ${feed.today_by_model.map(
                  (m) => html`
                    <div class="mrow" style="--d:0">
                      <span class="mname">${m.model || '(model unrecorded)'}</span>
                      <span class="mnum">${m.calls} call${m.calls === 1 ? '' : 's'}</span>
                      <span class="mnum">${this._fmt(m.total_tokens)} tokens</span>
                    </div>`,
                )}
              </div>
              ${/* THE OWNER'S SHAPE: the day AT THE LEVEL OF USER, busiest first. Package
                    filters and activity-type filters come later, on his word. */ ''}
              <div class="head calls-head"><span class="title">Users</span></div>
              <div class="bymodel">
                ${feed.today_by_user.map(
                  (u) => html`
                    <div class="mrow" style="--d:0">
                      <span class="mname" title=${u.user_id || ''}>${this._short(u.user_id)}</span>
                      <span class="mnum">${u.calls} call${u.calls === 1 ? '' : 's'}</span>
                      <span class="mnum">${this._fmt(u.total_tokens)} tokens</span>
                    </div>`,
                )}
              </div>
              <div class="head calls-head"><span class="title">Newest calls</span></div>
              <div class="calls">
                ${feed.calls.map(
                  (c) => html`
                    <div class="crow" style="--d:0">
                      <span class="ctime">${this._when(c.at)}</span>
                      <span class="cuser" title=${c.user_id || ''}>${this._short(c.user_id)}</span>
                      <span class="cmode">${c.mode || '—'}</span>
                      <span class="cmodel">${c.model || '—'}</span>
                      <span class="ctok">${this._fmt(c.total_tokens)} tok</span>
                      <span class="csec">${typeof c.elapsed_s === 'number' ? `${c.elapsed_s}s` : '—'}</span>
                      <span class="ccost">${typeof c.est_cost_usd === 'number' ? `$${c.est_cost_usd.toFixed(5)}` : ''}</span>
                    </div>`,
                )}
              </div>`}
        <div class="note">${feed.cost_note || ''}</div>
      </div>
    `;
  }

  static styles = [
    designTokens,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */
      :host { display: block; height: 100%; overflow: auto; background: #ffffff; }
      .wrap { padding: 14px 16px 24px; font-family: 'Inter', system-ui, sans-serif; }
      .head { display: flex; align-items: center; justify-content: space-between; margin: 6px 0 8px; }
      .calls-head { margin-top: 18px; }
      .title { font-size: 13px; font-weight: 700; color: #234354; text-transform: uppercase; letter-spacing: 0.04em; }
      .reload {
        font: inherit; font-size: 12px; padding: 4px 10px;
        border: 1px solid var(--ds-rule, #d8d8d8); border-radius: 6px;
        background: transparent; color: #234354; cursor: pointer;
      }
      .reload:hover { background: rgba(35, 67, 84, 0.06); }
      .line { font-size: 13px; color: #507274; padding: 8px 0; }
      .line.bad { color: #b4231f; }
      .summary {
        margin: 0 0 10px; padding: 8px 0 0;
        font-size: 13px; line-height: 1.55; color: #234354;
      }
      .spin {
        display: inline-block; width: 12px; height: 12px; margin-right: 6px;
        border: 2px solid #507274; border-top-color: transparent; border-radius: 50%;
        animation: rot 0.8s linear infinite; vertical-align: -2px;
      }
      @keyframes rot { to { transform: rotate(360deg); } }
      .totals { display: flex; flex-wrap: wrap; gap: 10px; }
      .cell {
        display: flex; flex-direction: column; gap: 2px;
        border: 1px solid var(--ds-rule, #d8d8d8); border-radius: 8px; padding: 8px 12px; min-width: 110px;
      }
      .k { font-size: 11px; color: #507274; text-transform: uppercase; letter-spacing: 0.03em; }
      .v { font-size: 16px; font-weight: 700; color: #171717; }
      .sub { font-size: 10px; color: #8a8a8a; }
      .bymodel { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
      .mrow { display: flex; gap: 12px; font-size: 12px; color: #171717; }
      .mname { font-weight: 600; min-width: 140px; }
      .mnum { color: #507274; }
      .calls { display: flex; flex-direction: column; }
      .crow {
        display: grid; grid-template-columns: 90px 110px 1fr 150px 90px 60px 80px;
        gap: 8px; font-size: 12px; padding: 4px 0; border-bottom: 1px solid rgba(0, 0, 0, 0.05);
        color: #171717;
      }
      .ctime, .csec, .cuser { color: #507274; }
      .cmode { font-weight: 600; }
      .ctok, .ccost { text-align: right; }
      .note { margin-top: 12px; font-size: 10px; color: #8a8a8a; }
    `,
  ];
}

if (!customElements.get('governance-usage-view'))
  customElements.define('governance-usage-view', GovernanceUsageView);

declare global {
  interface HTMLElementTagNameMap {
    'governance-usage-view': GovernanceUsageView;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'governance-usage-view': React.DetailedHTMLProps<
        React.HTMLAttributes<GovernanceUsageView> & { ref?: React.Ref<GovernanceUsageView> },
        GovernanceUsageView
      >;
    }
  }
}
