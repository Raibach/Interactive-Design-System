/**
 * THE APPROVALS SURFACE — the column a person sends a session from, and answers one in.
 *
 * Owner, 2026-11-02: an approval is "a recorded event inside of that session"; any person can be a
 * reviewer; and the review "loads into the console's right column, in the same slot the tabs
 * already swap". This element is that surface. It is assigned to the Approvals tab, declares
 * `view-tab="approvals"` so the seat knows the tab is this view's, and fills the column.
 *
 * ONE LIST, ONE DETAIL, ONE QUEUE.
 *   the list   every design session this person owns or was sent, newest first, with its stage;
 *   the detail the selected session: whose it is, who it is addressed to, every gate recorded,
 *              and the ONE action this person may take on it;
 *   the queue  a font or a component the system does not hold, waiting for a decision.
 *
 * IT DRAWS AND ASKS; THE SERVER RECORDS AND DECIDES WHAT MAY BE DONE. `can_send` and `can_answer`
 * arrive from the record, so this surface cannot offer an answer a person is not entitled to give.
 * Nothing here writes a catalogue: the final approval is a separate act, and the screen says so.
 */
import { LitElement, html, css, nothing } from 'lit';
import { getStoredUserId } from '@/services/authService';

type ReviewRow = {
  session_id: string;
  title: string;
  stage: string;
  stage_word: string;
  reviewer: string;
  reviewer_id: string;
  owner_id: string;
  owner_name: string;
  mine: boolean;
  can_send: boolean;
  can_answer: boolean;
  updated_at: string;
};

type ReviewEvent = {
  event: string;
  at: string;
  by: string;
  by_id: string;
  note: string;
  reviewer: string;
};

type ReviewDetail = {
  session_id: string;
  title: string;
  stage: string;
  stage_word: string;
  reviewer: string;
  reviewer_id: string;
  owner_id: string;
  owner_name: string;
  mine: boolean;
  can_answer: boolean;
  can_send: boolean;
  events: ReviewEvent[];
};

type QueueRow = { id: number; kind: string; subject: string; reason: string; session_id: string };

/** THE GATE'S WORD ON SCREEN — what happened, not the record's key. */
const EVENT_WORDS: Record<string, string> = {
  'review-requested': 'Sent for review',
  'review-approved': 'Approved',
  'changes-requested': 'Changes asked for',
};

/** A recorded time, in the person's own clock. An unreadable one is shown as it was stored. */
function when(at: string): string {
  if (!at) return '';
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return at;
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export class DesignReviewView extends LitElement {
  static properties = {
    sessionId: { type: String, attribute: 'session-id' },
    reviewId: { attribute: 'review-id' },
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      font-family: var(--catalog-row-font, 'IBM Plex Sans', 'Inter', sans-serif);
      color: #171717;
      box-sizing: border-box;
    }
    h2 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
    h3 {
      font-size: 11px; font-weight: 600; margin: 18px 0 6px;
      text-transform: uppercase; letter-spacing: .06em; color: #6b6b6b;
    }
    .lede { font-size: 12px; color: #6b6b6b; margin: 0 0 12px; line-height: 1.5; }
    .row {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 10px 12px; border: 1px solid #e3e3e3; border-radius: 8px;
      background: #fff; margin-bottom: 8px; cursor: pointer;
    }
    .row[selected] { border-color: #234354; box-shadow: 0 0 0 1px #234354 inset; }
    .row .body { min-width: 0; }
    .title { font-weight: 600; font-size: 13px; }
    .meta { font-size: 11px; color: #6b6b6b; margin-top: 2px; }
    .stage {
      margin-left: auto; flex: 0 0 auto; font-size: 11px; text-transform: uppercase;
      letter-spacing: .04em; color: #7b3d2a; background: #f6e7e1;
      border-radius: 999px; padding: 3px 9px;
    }
    .stage.approved { color: #2f5b3f; background: #e3f0e7; }
    .stage.changes-requested { color: #8a2f2f; background: #fbe6e6; }
    .detail { border-top: 1px solid #ededed; padding-top: 14px; margin-top: 6px; }
    .event {
      display: grid; grid-template-columns: 130px 1fr; gap: 10px;
      font-size: 12px; padding: 7px 0; border-bottom: 1px solid #f0f0f0;
    }
    .event .what { font-weight: 600; }
    .event .note { color: #4a4a4a; margin-top: 2px; }
    textarea, input {
      width: 100%; box-sizing: border-box; margin: 8px 0;
      font: inherit; font-size: 12px; padding: 8px; border: 1px solid #d8d8d8; border-radius: 8px;
    }
    textarea { min-height: 64px; }
    .actions { display: flex; gap: 8px; align-items: center; }
    button {
      font: inherit; font-size: 12px; font-weight: 600; padding: 8px 14px;
      border-radius: 8px; border: 1px solid transparent; cursor: pointer;
    }
    button:disabled { opacity: .55; cursor: default; }
    button.primary { background: #234354; color: #fff; }
    button.plain { background: #ededed; color: #171717; }
    .note { font-size: 12px; color: #6b6b6b; margin-top: 8px; line-height: 1.5; }
    .note.bad { color: #a31545; }
    .empty { font-size: 12px; color: #6b6b6b; }
  `;

  declare sessionId?: string;
  reviewId?: string;

  private _rows: ReviewRow[] = [];
  private _queue: QueueRow[] = [];
  private _detail: ReviewDetail | null = null;
  /** The session whose review stands in the detail. Kept across a reload of the list. */
  private _selected = '';
  /** What the person typed about the gate — a change request, or a note with an approval. */
  private _note = '';
  /** WHO TO SEND IT TO. A name, or the email address when a name belongs to more than one person. */
  private _person = '';
  private _busy = false;
  private _message = '';
  private _messageBad = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.reload();
  }

  /** Read the list and the queue again. The shell asks for this when the tab is pressed. */
  async reload(): Promise<void> {
    await this._load();
  }

  private _headers(): Record<string, string> {
    return { 'X-User-ID': getStoredUserId(), 'Content-Type': 'application/json' };
  }

  private _say(message: string, bad = false): void {
    this._message = message;
    this._messageBad = bad;
  }

  private async _load(): Promise<void> {
    try {
      const res = await fetch('/api/design/reviews', { headers: this._headers() });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        this._say(String(body?.detail || `The list of reviews could not be read (HTTP ${res.status}).`), true);
        this.requestUpdate();
        return;
      }
      this._rows = Array.isArray(body?.reviews) ? body.reviews : [];

      /* THE GENERAL QUEUE SITS BESIDE THE SESSIONS (owner, 2026-11-02): a font or a component the
         system does not hold waits here until a person decides. */
      const queueRes = await fetch('/api/design/requests?decision=pending', { headers: this._headers() });
      const queueBody = await queueRes.json().catch(() => ({}));
      this._queue = Array.isArray(queueBody?.requests) ? queueBody.requests : [];

      /* THE RAIL'S APPROVE ICON PULSES FROM THIS COUNT (owner, 2026-11-03). The seat is the
         listener; the count is the sessions this person can answer plus the requests waiting. */
      this._publishApprovalCount();

      const wanted =
        this.reviewId || this._selected || this._rows[0]?.session_id || '';
      if (wanted) {
        this._selected = wanted;
        await this._open(wanted);
      } else {
        this._detail = null;
        this._say('');
        this.requestUpdate();
      }
    } catch (err) {
      this._say(`The list of reviews could not be read: ${String((err as Error)?.message ?? err)}`, true);
      this.requestUpdate();
    }
  }

  /** The count the rail's Approve icon pulses on: answers owed plus requests waiting. */
  private _publishApprovalCount(): void {
    const reviews = Array.isArray(this._rows) ? this._rows : [];
    const requests = Array.isArray(this._queue) ? this._queue : [];
    const waiting =
      reviews.filter((row) => (row as { can_answer?: boolean })?.can_answer === true).length +
      requests.length;
    this.dispatchEvent(
      new CustomEvent('design-approval-count', {
        detail: { waiting },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private async _open(sessionId: string): Promise<void> {
    try {
      const res = await fetch(`/api/design/sessions/${encodeURIComponent(sessionId)}/review`, {
        headers: this._headers(),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        this._say(String(body?.detail || `That review could not be read (HTTP ${res.status}).`), true);
        this.requestUpdate();
        return;
      }
      this._detail = body as ReviewDetail;
      this._selected = sessionId;
      this.reviewId = sessionId;
      this._say('');
      this.requestUpdate();
    } catch (err) {
      this._say(`That review could not be read: ${String((err as Error)?.message ?? err)}`, true);
      this.requestUpdate();
    }
  }

  /** One gate, posted. `request` addresses the session; `approve` and `changes` answer it. */
  private async _post(
    action: 'request' | 'approve' | 'changes',
    extra: Record<string, string> = {},
  ): Promise<void> {
    const id = this._detail?.session_id;
    if (!id || this._busy) return;
    this._busy = true;
    try {
      const res = await fetch(`/api/design/sessions/${encodeURIComponent(id)}/review`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ action, note: this._note, ...extra }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        this._say(String(body?.detail || `That could not be recorded (HTTP ${res.status}).`), true);
      } else {
        this._detail = body as ReviewDetail;
        this._note = '';
        this._person = '';
        this._say('');
        await this._load();
      }
    } catch (err) {
      this._say(`That could not be recorded: ${String((err as Error)?.message ?? err)}`, true);
    } finally {
      this._busy = false;
      this.requestUpdate();
    }
  }

  private async _sendDecision(requestId: number, decision: 'approve' | 'refuse'): Promise<void> {
    if (this._busy) return;
    this._busy = true;
    try {
      const res = await fetch(`/api/design/requests/${requestId}/decide`, {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify({ decision, note: this._note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        this._say(String(body?.detail || `That decision could not be recorded (HTTP ${res.status}).`), true);
      } else {
        this._note = '';
        this._say('');
        await this._load();
      }
    } catch (err) {
      this._say(`That decision could not be recorded: ${String((err as Error)?.message ?? err)}`, true);
    } finally {
      this._busy = false;
      this.requestUpdate();
    }
  }

  /** WHO THE SESSION BELONGS TO, in one plain line under the title. */
  private _addressLine(row: ReviewRow | ReviewDetail): string {
    const whose = row.mine ? 'Yours' : `From ${row.owner_name || 'another person'}`;
    const sent = row.reviewer ? `sent to ${row.reviewer}` : 'not sent to anyone yet';
    return `${whose} · ${sent} · ${row.stage_word}`;
  }

  private _events(detail: ReviewDetail) {
    if (!detail.events.length) {
      return html`<p class="empty">Nothing has been recorded against this session yet.</p>`;
    }
    return detail.events.map((event) => html`
      <div class="event">
        <span class="meta">${when(event.at)}</span>
        <span>
          <span class="what">${EVENT_WORDS[event.event] || event.event}</span>
          ${event.by ? html`<span class="meta"> · ${event.by}</span>` : nothing}
          ${event.note ? html`<div class="note">${event.note}</div>` : nothing}
        </span>
      </div>`);
  }

  private _detailActions(detail: ReviewDetail) {
    if (detail.can_answer) {
      return html`
        <textarea
          placeholder="What needs changing? This is optional when you approve."
          .value=${this._note}
          @input=${(e: Event) => { this._note = (e.target as HTMLTextAreaElement).value; }}
        ></textarea>
        <div class="actions">
          <button class="primary" ?disabled=${this._busy} @click=${() => void this._post('approve')}>
            Approve
          </button>
          <button class="plain" ?disabled=${this._busy} @click=${() => void this._post('changes')}>
            Ask for changes
          </button>
        </div>`;
    }
    if (detail.can_send) {
      return html`
        <p class="note">This session has not been sent for review yet.</p>
        <input
          placeholder="Who reviews it? Their name, or their email address."
          .value=${this._person}
          @input=${(e: Event) => { this._person = (e.target as HTMLInputElement).value; }}
        />
        <div class="actions">
          <button class="primary" ?disabled=${this._busy}
                  @click=${() => void this._post('request', { reviewer: this._person })}>
            Send for review
          </button>
        </div>`;
    }
    if (detail.stage === 'in-review') {
      return html`<p class="note">
        Waiting for ${detail.reviewer || 'the reviewer'} to answer. ${
          detail.mine ? 'You sent this session; the person it was sent to answers it.' : ''
        }
      </p>`;
    }
    if (detail.stage === 'approved') {
      return html`<p class="note">
        Approved${detail.reviewer ? ` by ${detail.reviewer}` : ''}. Nothing is published by this
        flow.
      </p>`;
    }
    if (detail.stage === 'changes-requested') {
      return html`<p class="note">
        Changes were asked for${detail.reviewer ? ` by ${detail.reviewer}` : ''}. Nothing is
        published by this flow.
      </p>`;
    }
    return nothing;
  }

  render() {
    const detail = this._detail;
    return html`
      <h2>Approvals</h2>
      <p class="lede">
        The sessions you can send for review, the ones sent to you, and the requests waiting for a
        decision.
      </p>

      ${this._rows.length === 0
        ? html`<p class="empty">No design session is yours yet, and nothing has been sent to you.</p>`
        : this._rows.map((row) => html`
            <div class="row" ?selected=${row.session_id === this._selected}
                 @click=${() => void this._open(row.session_id)}>
              <div class="body">
                <div class="title">${row.title || 'Untitled session'}</div>
                <div class="meta">${this._addressLine(row)} · ${when(row.updated_at)}</div>
              </div>
              <span class="stage ${row.stage}">${row.stage_word}</span>
            </div>`)}

      ${detail
        ? html`
            <div class="detail">
              <h2>${detail.title || 'Untitled session'}</h2>
              <div class="meta">${this._addressLine(detail)}</div>
              <h3>What happened</h3>
              ${this._events(detail)}
              <h3>${detail.can_answer ? 'Your answer' : detail.can_send ? 'Send it' : 'Where it stands'}</h3>
              ${this._detailActions(detail)}
            </div>`
        : nothing}

      ${this._queue.length
        ? html`
            <h3>Waiting for a decision</h3>
            ${this._queue.map((req) => html`
              <div class="row" style="cursor:default">
                <div class="body">
                  <div class="title">${req.subject}</div>
                  <div class="meta">${req.kind}${req.reason ? ` · ${req.reason}` : ''}</div>
                </div>
                <div class="actions" style="margin-left:auto">
                  <button class="primary" ?disabled=${this._busy}
                          @click=${() => void this._sendDecision(req.id, 'approve')}>Approve</button>
                  <button class="plain" ?disabled=${this._busy}
                          @click=${() => void this._sendDecision(req.id, 'refuse')}>Refuse</button>
                </div>
              </div>`)}`
        : nothing}

      ${this._message
        ? html`<p class="note ${this._messageBad ? 'bad' : ''}">${this._message}</p>`
        : nothing}
    `;
  }
}

if (!customElements.get('design-review-view')) {
  customElements.define('design-review-view', DesignReviewView);
}
