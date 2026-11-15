/**
 * <design2-work-status> — the work card: the clock and the stage trail.
 *
 * A behavioural port of AI Elements' <Reasoning> (MIT; the React sources are vendored at
 * frontend/ai-elements/). Their behaviour, kept 1:1: opens while the work is in flight,
 * remembers the duration when it ends, collapses to "Worked for Ns" a beat later, and reopens
 * on a click. The seat hands the two facts (`sending` = in flight, `stage` = which kind); the
 * clock lives here.
 *
 * It draws nothing when it is idle and has no duration to report.
 */
import { LitElement, html, css, nothing } from 'lit';
import { figureStyles, figures } from '@/shared/figures';

export class WorkStatus extends LitElement {
  static properties = {
    sending: { type: Boolean },
    stage: { type: String, attribute: false },
  };

  declare sending: boolean;
  declare stage: string;

  private _workStart = 0;
  private _workMs: number | null = null;
  private _workOpen = false;
  private _workSeen: string[] = [];
  private _workCollapseTimer: number | null = null;

  constructor() {
    super();
    this.sending = false;
    this.stage = '';
  }

  willUpdate(changed: Map<string, unknown>): void {
    if (changed.has('sending')) {
      const wasSending = Boolean(changed.get('sending'));
      if (this.sending && !wasSending) {
        this._workStart = Date.now();
        this._workMs = null;
        this._workOpen = true;
        this._workSeen = [];
        if (this._workCollapseTimer) {
          clearTimeout(this._workCollapseTimer);
          this._workCollapseTimer = null;
        }
      } else if (!this.sending && wasSending) {
        this._workMs = Date.now() - this._workStart;
        if (this.stage === 'building' && !this._workSeen.includes('Built the page')) {
          this._workSeen = [...this._workSeen, 'Built the page'];
        }
        if (this._workCollapseTimer) clearTimeout(this._workCollapseTimer);
        this._workCollapseTimer = window.setTimeout(() => {
          this._workCollapseTimer = null;
          this._workOpen = false;
          this.requestUpdate();
        }, 1000) as unknown as number;
      }
    }
    if (changed.has('stage') && this.sending && this.stage === 'building') {
      if (!this._workSeen.includes('Answered your message')) {
        this._workSeen = [...this._workSeen, 'Answered your message'];
      }
    }
  }

  private _toggleWork = (): void => {
    this._workOpen = !this._workOpen;
    if (this._workOpen && this._workCollapseTimer) {
      clearTimeout(this._workCollapseTimer);
      this._workCollapseTimer = null;
    }
    this.requestUpdate();
  };

  private _workLabel(): string {
    if (this.sending) return this.stage === 'building' ? 'Building the page…' : 'Thinking…';
    const secs = Math.max(1, Math.round((this._workMs ?? 0) / 1000));
    return `Worked for ${secs}s`;
  }

  static styles = [figureStyles, css`
    :host { display: block; }
    /* THE WORK CARD — the seat's port of AI Elements' <Reasoning> (MIT): a shimmering label
       while her turn is in flight, a collapsed "Worked for Ns" a beat after it ends, click to
       reopen the stage trail. The colours are this app's own — the port is behavioural, not
       cosmetic, because the React original cannot style itself inside a shadow root. */
    .work {
      align-self: flex-start;
      margin: 4px 0 10px;
      max-width: 100%;
    }
    .work-head {
      display: flex;
      align-items: center;
      gap: 8px;
      background: none;
      border: 0;
      padding: 4px 2px;
      cursor: pointer;
      color: #6d6d6d;
      font: inherit;
      font-size: 13px;
    }
    .work-icon { width: 15px; height: 15px; flex: 0 0 auto; }
    .work-chevron { width: 14px; height: 14px; transition: transform 150ms ease; }
    .work-chevron.open { transform: rotate(180deg); }
    .work-label.shimmer {
      /* TWO LAYERS, like the original: the moving highlight OVER a solid base of the text
         colour — without the base the label is invisible except during the highlight's pass. */
      background-image: linear-gradient(90deg, rgba(109, 109, 109, 0) 38%, #171717 50%, rgba(109, 109, 109, 0) 62%), linear-gradient(#6d6d6d, #6d6d6d);
      background-size: 250% 100%, 100% 100%;
      background-repeat: no-repeat;
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
      animation: work-shimmer 1.6s linear infinite;
    }
    @keyframes work-shimmer {
      from { background-position: 100% center; }
      to { background-position: 0% center; }
    }
    .work-body {
      padding: 2px 2px 6px 23px;
      color: #6d6d6d;
      font-size: 12.5px;
      line-height: 18px;
    }
    .work-line + .work-line { margin-top: 2px; }
  `];

  render() {
    if (!this.sending && this._workMs === null) return nothing;
    return html`
      <div class="work" role="status">
        <button
          class="work-head"
          type="button"
          aria-expanded=${this._workOpen ? 'true' : 'false'}
          @click=${this._toggleWork}
        >
          <svg class="work-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M12 18V5"/>
            <path d="M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4"/>
            <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5"/>
            <path d="M17.997 5.125a4 4 0 0 1 2.526 5.77"/>
            <path d="M18 18a4 4 0 0 0 2-7.464"/>
            <path d="M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517"/>
            <path d="M6 18a4 4 0 0 1-2-7.464"/>
            <path d="M6.003 5.125a4 4 0 0 0-2.526 5.77"/>
          </svg>
          <span class="work-label ${this.sending ? 'shimmer' : ''}">${figures(this._workLabel())}</span>
          <svg class="work-chevron ${this._workOpen ? 'open' : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="m6 9 6 6 6-6"/>
          </svg>
        </button>
        ${this._workOpen
          ? html`<div class="work-body">
              ${(this._workSeen.length ? this._workSeen : ['Waiting for her reply']).map((line) => html`<div class="work-line">${line}</div>`)}
            </div>`
          : nothing}
      </div>
    `;
  }
}

if (!customElements.get('design2-work-status')) customElements.define('design2-work-status', WorkStatus);

declare global {
  interface HTMLElementTagNameMap {
    'design2-work-status': WorkStatus;
  }
}
