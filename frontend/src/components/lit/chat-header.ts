/**
 * <chat-header> — the status card above the package chat.
 *
 * Figma source: node 40001066:4308 "output-area" (file 20UPR2KQMsbAxlo5NJb1se),
 * a white card — padding 20px, gap 10px, radius 6px — holding the status bar
 * (40001067:4486): 57px, padding 7px 10px, radius 8px, fill rgba(117,142,135,.35),
 * stroke #758E87 1px, inset 0 4px 4px rgba(0,0,0,.15), text #484460 Inter 500 14/22.
 *
 * THE STATUS LINE IS FOUR SLOTS, not one string. The frame's sample:
 *
 *   "Analyzing: Session 222 | supportCustomerSession — Duration: 28.495s | Closed QA: 89.38%"
 *
 * maps to status / sessionLabel / sessionName / duration / qaScore, joined with
 * the frame's own separators (pipes, em-dash before Duration). `statusText`
 * remains as the flat fallback for hosts that format the line themselves.
 *
 * The conversation selector does NOT live here — it sits below the message
 * output (see <chat-messages>), where the design puts it.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css } from 'lit';

export class ChatHeader extends LitElement {
  static properties = {
    /** Flat fallback line. Set this OR the slots below, not both. */
    statusText: { type: String, attribute: 'status-text' },
    /** Slot 1: the state word, e.g. "Analyzing". */
    status: { type: String, attribute: 'status' },
    /** Slot 1: the session identifier, e.g. "Session 222". */
    sessionLabel: { type: String, attribute: 'session-label' },
    /** Slot 2: the session name, e.g. "supportCustomerSession". */
    sessionName: { type: String, attribute: 'session-name' },
    /** Slot 3: the duration readout, e.g. "28.495s". */
    duration: { type: String, attribute: 'duration' },
    /** Slot 4: the QA readout, e.g. "89.38%". */
    qaScore: { type: String, attribute: 'qa-score' },
  };

  declare statusText: string;
  declare status: string;
  declare sessionLabel: string;
  declare sessionName: string;
  declare duration: string;
  declare qaScore: string;

  constructor() {
    super();
    this.statusText = '';
    this.status = '';
    this.sessionLabel = '';
    this.sessionName = '';
    this.duration = '';
    this.qaScore = '';
  }

  static styles = css`
    :host { display: block; }
    /* The outer card the frame calls "output-area": white, padding 20, gap 10, radius 6. */
    .output-area {
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 10px;
      padding: 20px;
      background: #ffffff;
      border-radius: 6px;
    }
    .status {
      display: flex;
      align-items: center;
      gap: 10px;
      min-height: 57px;
      padding: 7px 10px;
      background: rgba(117, 142, 135, 0.35);
      border: 1px solid #758e87;
      border-radius: 8px;
      box-shadow: inset 0 4px 4px rgba(0, 0, 0, 0.15);
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      line-height: 22px;
      color: #484460;
    }
    /* A status bar with nothing to say should not take the column's space. */
    .status.none { display: none; }
  `;

  /** The frame's slot line: pipes between readouts, an em-dash before Duration. */
  private get _statusLine(): string {
    if (this.statusText) return this.statusText;
    const parts: string[] = [];
    if (this.status || this.sessionLabel) {
      parts.push(`${this.status ? `${this.status}: ` : ''}${this.sessionLabel}`);
    }
    if (this.sessionName) parts.push(this.sessionName);
    if (this.duration) parts.push(`Duration: ${this.duration}`);
    if (this.qaScore) parts.push(`Closed QA: ${this.qaScore}`);
    if (!parts.length) return '';
    return parts.map((p, i) => (i === 0 ? p : i === 2 ? ` — ${p}` : ` | ${p}`)).join('');
  }

  render() {
    const line = this._statusLine;
    return html`
      <div class="output-area">
        <div class="status ${line ? '' : 'none'}" role="status">${line}</div>
      </div>
    `;
  }
}

customElements.define('chat-header', ChatHeader);

declare global {
  interface HTMLElementTagNameMap {
    'chat-header': ChatHeader;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-header': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatHeader> & {
          'status-text'?: string;
          'status'?: string;
          'session-label'?: string;
          'session-name'?: string;
          'duration'?: string;
          'qa-score'?: string;
          ref?: React.Ref<ChatHeader>;
        },
        ChatHeader
      >;
    }
  }
}
