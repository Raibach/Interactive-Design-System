/**
 * <sessions-feed> — THE SESSIONS INDEX, drawn in the chat column under the rail's Sessions
 * tab (owner, 2026-10-17: *"well let's add sessions to where the trace was … make preview
 * Sessions"*).
 *
 * WHAT A SESSION IS, SAID PLAINLY. It is not a process, a login or a connection. It is a
 * GROUPING LABEL written on trace rows: every row carrying the same `session_id` is one
 * session, and the governance app's own Sessions page is that column grouped, totalled and
 * listed. Nothing here decides what a session is — the label does.
 *
 * IT READS ITS OWN FEED, like <governance-usage-view> reads the spend ledger:
 * `GET /api/governance/sessions` groups the same column, from the same store, that the app's
 * Sessions page groups. One source, two surfaces — the room's view and the app's page cannot
 * disagree about which sessions exist. The element writes nothing.
 *
 * THE THREE STATES ARE DIFFERENT CLAIMS AND ARE DRAWN DIFFERENTLY:
 *   loading — a read is in flight ("Reading the session groups…");
 *   ready with rows — the groups, newest activity first;
 *   ready with none — no row in the window carried a session label (a real answer);
 *   error — the read's own reason, in the red the seat already uses, never a stand-in list.
 *
 * NO CHROME ABOVE THE LIST — no title, no tabs, no counter, no sort control. The rail names
 * the tab; the rows are the view.
 *
 * A CARD IS A DOOR, NOT A DEAD END (owner, 2026-10-17: *"of course it needs to open up the
 * actual session"*). A press emits `session-select` with the session's own name; the SHELL
 * turns that into the governance app's own address (`/project/<id>/sessions/<session>`) and
 * the middle loads the real session. This element navigates nothing itself — it does not know
 * the project, and it must not guess one. `selectedId` arrives bound when the shell wants a
 * card marked; a press also marks it locally, so the click reads as taken even before the
 * shell answers.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

interface SessionRow {
  session: string;
  events: number;
  traces: number;
  firstSeen: string;
  lastSeen: string;
  users: string[];
  cost: number;
}

interface SessionsPayload {
  status?: string;
  days?: number;
  sessions?: SessionRow[];
  error?: string;
}

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 4,
});

function usd(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? USD.format(value) : '—';
}

/**
 * A COUNT, OR A DASH WHEN IT IS NOT A COUNT.
 *
 * The route sends integers, and this does not assume it: `row.events.toLocaleString()` on a
 * value that arrived as null is a thrown render, and `|| 0` would be a zero this element
 * invented. A dash says the read did not carry the number, which is the truth.
 */
function count(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString('en-US') : '—';
}

export class SessionsFeed extends LitElement {
  static properties = {
    /** The window the route groups over — 30 days unless the host says otherwise. */
    days: { type: Number },
    /** Bumped by the host (or a control) to re-read the feed. */
    refresh: { type: Number },
    /** The session the shell has open, when it wants a card marked. */
    selectedId: { type: String, attribute: 'selected-id' },
    /* ── THE QUERY LANE (owner, 2026-10-18) ──────────────────────────────────────────
       `queryRows` is the LANE'S ANSWER, not this element's feed: `null` means no query has
       been run (draw the unfiltered feed), an array means draw exactly these rows. The
       receipt is the one line saying what was applied; the error is the lane's real reason.
       The element never invents a filter and never merges the two lists. */
    queryRows: { attribute: false },
    receipt: { type: String },
    laneError: { type: String },
    laneBusy: { type: Boolean },
  };

  declare days: number;
  declare refresh: number;
  declare selectedId: string;
  declare queryRows: SessionRow[] | null;
  declare receipt: string;
  declare laneError: string;
  declare laneBusy: boolean;

  private _state: 'loading' | 'ready' | 'error' = 'loading';
  private _rows: SessionRow[] = [];
  private _error = '';
  private _readDays = 30;

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
        /* Transparent, like the eval index — the drawing's ground reads through. */
        background: transparent;
      }
      .rows {
        padding: 8px 14px 16px;
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      /* NO TOTALS LINE ABOVE THE LIST (owner, 2026-10-17: *"Nobody needs to count the number
         of sessions. I don't need to know the number of events … Remove it."*). The rows are
         the view; nothing is added up over them. */
      /* THE HOUSE'S ROW TREATMENT — the same rule-bordered tint <evals-index> draws. */
      .row {
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 100%;
        text-align: left;
        appearance: none;
        font: inherit;
        color: inherit;
        cursor: pointer;
        padding: 10px 12px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius);
        background: rgba(0, 0, 0, 0.12);
        /* The card answers the hand: colour, edge and a shallow lift, nothing that moves
           the layout. 120ms is short enough to read as the pointer's own response. */
        transition:
          background-color 120ms ease,
          border-color 120ms ease,
          box-shadow 120ms ease,
          transform 120ms ease;
      }
      .row:hover {
        background: rgba(0, 0, 0, 0.26);
        border-color: var(--ds-teal);
        box-shadow: 0 3px 12px rgba(0, 0, 0, 0.24);
      }
      .row:hover .name {
        text-decoration: underline;
        text-underline-offset: 2px;
      }
      /* PRESSED IS ITS OWN ANSWER — the card settles a hair, so the click is felt before
         the middle loads. */
      .row:active { transform: translateY(1px); }
      /* SELECTED IS NOT HOVER, AND IT MUST NOT LOOK LIKE IT (owner, 2026-10-17: *"you'll
         need to secure that would maybe be a purple border whenever it's selected or
         something to show select"*). Hover is teal and momentary; selected is PURPLE, holds
         until another card is picked, and carries a second ring so it reads as state rather
         than as the pointer still being there. The ring is an inset shadow, not a thicker
         border: a width change would shift the row by a pixel when the state lands. */
      .row.is-selected,
      .row.is-selected:hover {
        border-color: #8b5cf6;
        box-shadow:
          inset 0 0 0 1px #8b5cf6,
          0 3px 12px rgba(0, 0, 0, 0.24);
      }
      .row:focus-visible { outline: 2px solid var(--ds-teal); outline-offset: 2px; }
      .top {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      .name {
        font-weight: 700;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .cost {
        margin-left: auto;
        flex: 0 0 auto;
        font-size: var(--ds-fs-meta);
        font-variant-numeric: tabular-nums;
      }
      .meta {
        display: flex;
        flex-wrap: wrap;
        gap: 4px 10px;
        color: var(--chat-muted, var(--ds-muted));
        font-size: var(--ds-fs-label);
        font-variant-numeric: tabular-nums;
      }
      .meta .dot::before {
        content: '·';
        margin-right: 10px;
      }
      .when {
        color: var(--chat-muted, var(--ds-muted));
        font-size: var(--ds-fs-meta);
        font-variant-numeric: tabular-nums;
      }
      .state {
        padding: 10px 14px;
        color: var(--chat-muted, var(--ds-muted));
        font-size: var(--ds-fs-sm);
      }
      .state.bad {
        color: var(--ds-red);
        font-weight: 600;
      }
      /* THE RECEIPT LINE — what the lane applied, and the one control that undoes it.
         It sits above the rows and is deliberately quiet: it is a note about the list, not
         a heading for it. */
      .receipt {
        display: flex;
        align-items: baseline;
        gap: 10px;
        margin: 8px 14px 0;
        padding: 8px 10px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius);
        background: rgba(0, 0, 0, 0.18);
        font-size: var(--ds-fs-meta);
        color: var(--chat-muted, var(--ds-muted));
      }
      .receipt .said {
        color: var(--chat-text, var(--ds-text));
        font-weight: 600;
      }
      .receipt .filters {
        font-variant-numeric: tabular-nums;
        overflow-wrap: anywhere;
      }
      .receipt button {
        margin-left: auto;
        flex: 0 0 auto;
        appearance: none;
        font: inherit;
        color: var(--chat-text, var(--ds-text));
        background: transparent;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius);
        padding: 2px 8px;
        cursor: pointer;
      }
      .receipt button:hover {
        border-color: var(--ds-teal);
      }
      .receipt button:focus-visible {
        outline: 2px solid var(--ds-teal);
        outline-offset: 2px;
      }
    `,
  ];

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  protected updated(changed: Map<string, unknown>): void {
    /* The FIRST update reports every property as changed — the read it would trigger is the
       one connectedCallback already made, so the window only re-reads on a LATER change. */
    if (changed.has('refresh')) void this._load();
    if (this.hasUpdated && changed.has('days')) void this._load();
  }

  private async _load(): Promise<void> {
    this._state = 'loading';
    this.requestUpdate();
    const days = this.days || 30;
    try {
      const res = await fetch(`/api/governance/sessions?days=${encodeURIComponent(String(days))}`);
      /*
       * THE BODY IS READ AS TEXT AND PARSED ONCE, because "could not parse" is an OUTCOME to
       * report, not a null to work around. `res.json().catch(() => null)` made a non-JSON body
       * indistinguishable from an empty one, and the list then drew "no sessions recorded" —
       * a failed read wearing the empty state's clothes, which is the one thing this element is
       * not allowed to do (see the header).
       */
      const body = await res.text();
      let payload: SessionsPayload;
      try {
        payload = JSON.parse(body) as SessionsPayload;
      } catch {
        throw new Error(
          `the route answered with something that is not JSON (HTTP ${res.status}): ${body.slice(0, 160)}`,
        );
      }
      if (!res.ok) throw new Error(String(payload.error || `HTTP ${res.status}`));
      if (payload.status && payload.status !== 'ok') {
        throw new Error(String(payload.error || 'the route answered without a status'));
      }
      /* A MISSING LIST IS NOT AN EMPTY ONE. Only a real array is a list of sessions; anything
         else is the route failing to say, and it is reported as such. */
      if (!Array.isArray(payload.sessions)) {
        throw new Error('the route answered without a sessions list');
      }
      this._rows = payload.sessions;
      this._readDays = typeof payload.days === 'number' ? payload.days : days;
      this._state = 'ready';
      /* THE FIRST SESSION IS THE DEFAULT — opening the tab selects the newest group and
         opens it in the middle, the same way the trace tab opened its latest row (owner,
         2026-10-17: *"you cannot select the first session in the list as your default when
         you click on sessions tab"*). It runs once per load and only when nothing is
         selected, so a person's own pick is never overwritten while they are on the tab. */
      if (!this.selectedId && this._rows.length) {
        this._pick(this._rows[0].session);
      }
    } catch (err) {
      this._rows = [];
      this._error = err instanceof Error ? err.message : String(err);
      this._state = 'error';
    }
    this.requestUpdate();
  }

  /** WHICH CARD THE PERSON PRESSED — marked here at once, and named to the shell. */
  private _pick(session: string): void {
    this.selectedId = session;
    this.dispatchEvent(
      new CustomEvent<{ session: string }>('session-select', {
        detail: { session },
        bubbles: true,
        /* The card lives inside the seat's shadow root; without `composed` the event dies
           at that boundary and the shell never hears the press. */
        composed: true,
      }),
    );
    this.requestUpdate();
  }

  private _row(row: SessionRow) {
    /* A user id is shown SHORT and kept whole in the title: the store holds the id, and a
       thirty-six-character uuid in a meta line buries the numbers that matter. Abbreviating
       a value for the eye is not changing it — the full id is one hover away. */
    const users = row.users.length
      ? row.users
          .map((u) => (u.length > 8 ? `${u.slice(0, 8)}…` : u))
          .join(', ')
      : '';
    const selected = this.selectedId === row.session;
    return html`
      <button
        type="button"
        class="row ${selected ? 'is-selected' : ''}"
        aria-pressed=${selected ? 'true' : 'false'}
        @click=${() => this._pick(row.session)}
      >
        <div class="top">
          <span class="name" title=${row.session}>${row.session}</span>
          <span class="cost">${usd(row.cost)}</span>
        </div>
        <div class="meta">
          <span>${count(row.events)} events</span>
          <span class="dot">${count(row.traces)} traces</span>
          ${users
            ? html`<span class="dot" title=${row.users.join(', ')}>${users}</span>`
            : nothing}
        </div>
        <div class="when">first ${row.firstSeen} → last ${row.lastSeen}</div>
      </button>
    `;
  }

  render() {
    /* THE LANE OWNS THE COLUMN WHILE IT IS ANSWERING. A query in flight, a refusal, or a
       result set each replace the list — the unfiltered feed never shows through a result,
       and a refusal never leaves the previous list looking like the answer. */
    if (this.laneBusy) {
      return html`<div class="state" role="status">Reading the sessions you asked for…</div>`;
    }
    if (this.laneError) {
      return html`<div class="state bad" role="alert">The query could not be answered — ${this.laneError}</div>`;
    }
    if (this.queryRows) {
      return html`
        <div class="receipt">
          <span class="said">${this.receipt || 'Applied'}</span>
          <span class="filters">${this.queryRows.length} ${this.queryRows.length === 1 ? 'session' : 'sessions'}</span>
          <button type="button" @click=${this._clearLane}>Clear</button>
        </div>
        ${this.queryRows.length
          ? html`<div class="rows">${this.queryRows.map((row) => this._row(row))}</div>`
          : html`<div class="state" role="status">No session matched what you asked for.</div>`}
      `;
    }
    if (this._state === 'loading') {
      return html`<div class="state" role="status">Reading the session groups…</div>`;
    }
    if (this._state === 'error') {
      return html`<div class="state bad" role="alert">The sessions could not be read — ${this._error}</div>`;
    }
    if (!this._rows.length) {
      return html`<div class="state" role="status">
        No session grouping recorded in the last ${this._readDays} days.
      </div>`;
    }
    return html`
      <div class="rows">${this._rows.map((row) => this._row(row))}</div>
    `;
  }

  /** Leaving the lane's answer is the person's own act — it refills nothing by itself. */
  private _clearLane = (): void => {
    this.dispatchEvent(new CustomEvent('sessions-lane-clear', { bubbles: true, composed: true }));
  };
}

if (!customElements.get('sessions-feed')) customElements.define('sessions-feed', SessionsFeed);
