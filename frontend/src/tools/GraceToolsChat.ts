/**
 * <grace-tools-chat> — GRACE'S CONVERSATION FOR THE TOOLS TAB, IN ITS OWN FILE
 * (owner, 2026-10-18): *"the tools conversation comes with it, so you gotta create another file
 * for Grace's conversations when she's in tool. Currently that loads by default when you click
 * design — that's not going to be anymore."*
 *
 * So this file is the conversation that moves WITH the tool. Today that conversation is the
 * design room's seat, loading by default on Design; after the move, the tool and its conversation
 * both live on the Tools tab, and this element is the conversation's own home — its thread, its
 * input, its turn. Nothing is lifted from `chat-panel.ts`; the seat is not edited to carry it.
 *
 * THE DOOR IT SPEAKS TO is the one Grace already answers on: `POST /api/teacher/query` with
 * `{question, session_id}` (routes/teacher.py, TeacherQueryRequest). `session_id` is what her turn
 * persists against, so the host passes the tool room's session key in and this element never
 * invents one.
 *
 * MOUNTED AS A SEAT VIEW like the UX chat: `slot="view"`, `view-tab="tools"`.
 */
import { LitElement, html, css } from 'lit';

interface GraceTurn {
  role: 'person' | 'app';
  text: string;
}

export class GraceToolsChat extends LitElement {
  static properties = {
    /** The tool room's session id — what her turn persists against. */
    sessionId: { type: String },
    /** The package id, when the host has one open for this room. */
    packageId: { type: String },
    busy: { type: Boolean, state: true },
  };

  declare sessionId: string;
  declare packageId: string;
  declare busy: boolean;

  private _turns: GraceTurn[] = [];
  private _draft = '';

  constructor() {
    super();
    this.sessionId = '';
    this.packageId = '';
    this.busy = false;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      width: 100%;
      color: #f4f1ee;
      font: 14px/1.45 Inter, system-ui, sans-serif;
    }
    .thread {
      flex: 1 1 0%;
      min-height: 0;
      overflow: auto;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .turn {
      max-width: 92%;
      padding: 9px 12px;
      border-radius: 10px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .turn.person {
      align-self: flex-end;
      background: rgba(126, 114, 227, 0.28);
    }
    .turn.app {
      align-self: flex-start;
      background: rgba(255, 255, 255, 0.08);
    }
    .turn.app.failed {
      background: rgba(180, 83, 9, 0.22);
      border: 1px solid rgba(180, 83, 9, 0.55);
    }
    form {
      display: flex;
      gap: 8px;
      padding: 10px 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.12);
    }
    textarea {
      flex: 1 1 0%;
      min-height: 38px;
      max-height: 120px;
      resize: none;
      border-radius: 8px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: rgba(0, 0, 0, 0.22);
      color: inherit;
      font: inherit;
      padding: 8px 10px;
    }
    button {
      align-self: flex-end;
      height: 38px;
      padding: 0 16px;
      border-radius: 8px;
      border: 0;
      background: #7e72e3;
      color: #fff;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    button[disabled] {
      opacity: 0.5;
      cursor: default;
    }
  `;

  private async _send(): Promise<void> {
    const question = this._draft.trim();
    if (!question || this.busy) return;
    this._draft = '';
    this._turns = [...this._turns, { role: 'person', text: question }];
    this.busy = true;
    this.requestUpdate();
    try {
      const res = await fetch('/api/teacher/query', {
        method: 'POST',
        // No X-User-ID here: this element does not invent an identity. If the host's door needs
        // one, it is passed in and set as a property — never an empty header pretending to be a user.
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, session_id: this.sessionId || null }),
      });
      const data = (await res.json().catch(() => null)) as Record<string, any> | null;
      const text =
        (data?.content as string) ||
        (data?.answer as string) ||
        (data?.message as string) ||
        '';
      if (res.ok && text) {
        this._turns = [...this._turns, { role: 'app', text }];
      } else {
        const why = (data?.detail as string) || (data?.error as string) || `the turn door answered ${res.status}`;
        this._turns = [...this._turns, { role: 'app', text: `That turn failed: ${why}` }];
      }
    } catch (e) {
      this._turns = [...this._turns, { role: 'app', text: `That turn failed: ${(e as Error).message}` }];
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  render() {
    return html`
      <div class="thread" role="log">
        ${this._turns.map(
          (t) => html`<div class="turn ${t.role} ${t.role === 'app' && t.text.startsWith('That turn failed') ? 'failed' : ''}">${t.text}</div>`,
        )}
      </div>
      <form
        @submit=${(e: Event) => {
          e.preventDefault();
          void this._send();
        }}
      >
        <textarea
          .value=${this._draft}
          placeholder="Ask Grace about this tool room…"
          @input=${(e: Event) => {
            this._draft = (e.target as HTMLTextAreaElement).value;
          }}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void this._send();
            }
          }}
        ></textarea>
        <button type="submit" ?disabled=${this.busy}>${this.busy ? 'Working…' : 'Send'}</button>
      </form>
    `;
  }
}

if (!customElements.get('grace-tools-chat')) customElements.define('grace-tools-chat', GraceToolsChat);

declare global {
  interface HTMLElementTagNameMap {
    'grace-tools-chat': GraceToolsChat;
  }
}
