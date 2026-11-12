/**
 * <ux-notebook-panel> — THE UX TAB'S NOTEBOOK, DRAWN IN THE CHAT OUTPUT.
 *
 * The bottom card's notebook chip opens this panel. It is not a second chat and it is not a
 * browser-only scratchpad: the title and the words are stored on the UX tab's conversation
 * (`conversations.metadata.ux_notebook`), so a reload reads the same notebook back. The PostHog
 * hedgehog is the same character the application uses; the panel is ours.
 */
import { LitElement, html, css } from 'lit';
import { getStoredUserId } from '@/services/authService';
import notebookHog from '@/assets/posthog-notebook-hog.png';

export class UxNotebookPanel extends LitElement {
  static properties = {
    loading: { type: Boolean, state: true },
    loaded: { type: Boolean, state: true },
    saving: { type: Boolean, state: true },
    title: { type: String, state: true },
    content: { type: String, state: true },
    savedAt: { type: String, state: true },
    error: { type: String, state: true },
  };

  declare loading: boolean;
  declare loaded: boolean;
  declare saving: boolean;
  declare title: string;
  declare content: string;
  declare savedAt: string;
  declare error: string;

  constructor() {
    super();
    this.loading = true;
    this.loaded = false;
    this.saving = false;
    this.title = 'Untitled notebook';
    this.content = '';
    this.savedAt = '';
    this.error = '';
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this._load();
  }

  private async _load(): Promise<void> {
    this.loading = true;
    this.loaded = false;
    this.error = '';
    this.requestUpdate();
    try {
      const res = await fetch('/api/ux/chat/notebook', {
        headers: { 'X-User-ID': getStoredUserId() },
      });
      const data = (await res.json().catch(() => null)) as {
        title?: string;
        content?: string;
        updated_at?: string;
        error?: string;
      } | null;
      if (!res.ok || !data || data.error) {
        this.error = data?.error || `the notebook door answered ${res.status}`;
        return;
      }
      this.title = String(data.title || 'Untitled notebook');
      this.content = String(data.content || '');
      this.savedAt = String(data.updated_at || '');
      this.loaded = true;
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.loading = false;
      this.requestUpdate();
    }
  }

  private async _save(): Promise<void> {
    if (this.saving || this.loading) return;
    this.saving = true;
    this.error = '';
    this.requestUpdate();
    try {
      const res = await fetch('/api/ux/chat/notebook', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({ title: this.title, content: this.content }),
      });
      const data = (await res.json().catch(() => null)) as {
        title?: string;
        content?: string;
        updated_at?: string;
        error?: string;
      } | null;
      if (!res.ok || !data || data.error) {
        this.error = data?.error || `the notebook door answered ${res.status}`;
        return;
      }
      this.title = String(data.title || this.title || 'Untitled notebook');
      this.savedAt = String(data.updated_at || '');
    } catch (e) {
      this.error = (e as Error).message;
    } finally {
      this.saving = false;
      this.requestUpdate();
    }
  }

  private _back = (): void => {
    this.dispatchEvent(new CustomEvent('ux-panel-back', { bubbles: true, composed: true }));
  };

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      width: 100%;
      color: #1c2f4e;
      font: 13px/1.45 'IBM Plex Sans', system-ui, -apple-system, "Segoe UI", sans-serif;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 0 0 auto;
      padding: 2px 0 8px;
    }
    .back {
      appearance: none;
      width: 26px;
      height: 26px;
      display: grid;
      place-items: center;
      padding: 0;
      border: 1px solid rgba(28, 47, 78, 0.16);
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.75);
      color: #3d515b;
      cursor: pointer;
    }
    .back:hover { background: #fff; border-color: rgba(28, 47, 78, 0.3); }
    .back svg { width: 14px; height: 14px; }
    .head-title {
      font-size: 13px;
      font-weight: 700;
    }
    .body {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .intro {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 0 0 auto;
      padding: 2px 0 4px;
    }
    .hog {
      width: 70px;
      height: auto;
      flex: 0 0 auto;
      object-fit: contain;
    }
    .intro-copy {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .intro-copy strong {
      font-size: 13px;
      font-weight: 700;
    }
    .intro-copy span {
      font-size: 11px;
      color: rgba(28, 47, 78, 0.6);
    }
    .sheet {
      display: flex;
      flex-direction: column;
      flex: 1 1 auto;
      min-height: 220px;
      border: 1px solid rgba(28, 47, 78, 0.12);
      border-radius: 9px;
      background: #fff;
      overflow: hidden;
    }
    .title-input {
      appearance: none;
      border: 0;
      border-bottom: 1px solid rgba(28, 47, 78, 0.09);
      background: transparent;
      color: #1c2f4e;
      font: inherit;
      font-size: 16px;
      font-weight: 700;
      padding: 10px 12px;
      outline: none;
    }
    .title-input:focus { border-bottom-color: rgba(126, 114, 227, 0.45); }
    textarea {
      flex: 1 1 auto;
      min-height: 180px;
      resize: none;
      border: 0;
      outline: none;
      background: transparent;
      color: #1c2f4e;
      font: inherit;
      line-height: 1.55;
      padding: 10px 12px;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      flex: 0 0 auto;
      padding-top: 8px;
    }
    .status {
      font-size: 11px;
      color: rgba(28, 47, 78, 0.55);
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .status.error { color: #a31545; }
    .save {
      appearance: none;
      border: 1px solid rgba(126, 114, 227, 0.45);
      border-radius: 7px;
      background: rgba(126, 114, 227, 0.12);
      color: #3f3a6b;
      font: inherit;
      font-size: 12px;
      font-weight: 650;
      padding: 6px 12px;
      cursor: pointer;
    }
    .save:hover { background: rgba(126, 114, 227, 0.2); }
    .save[disabled] { opacity: 0.55; cursor: default; }
    .empty {
      padding: 18px;
      text-align: center;
      color: rgba(28, 47, 78, 0.55);
      font-size: 12px;
    }
    .error-state {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 18px;
      text-align: center;
      color: #a31545;
      font-size: 12px;
    }
    .error-state p {
      margin: 0;
      white-space: pre-wrap;
    }
  `;

  render() {
    return html`
      <div class="head">
        <button type="button" class="back" aria-label="Back to chat" title="Back to chat" @click=${this._back}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 3L5 8l5 5"></path>
          </svg>
        </button>
        <span class="head-title">Notebook</span>
      </div>
      <div class="body">
        <div class="intro">
          <img class="hog" src=${notebookHog} alt="" aria-hidden="true" />
          <span class="intro-copy">
            <strong>Untitled notebook</strong>
            <span>A place for the notes that belong with this Product analytics conversation.</span>
          </span>
        </div>
        ${this.loading
          ? html`<div class="empty">Loading the notebook…</div>`
          : !this.loaded
            ? html`<div class="error-state" role="alert">
                <p>${this.error || 'The notebook could not be read.'}</p>
                <button type="button" class="save" @click=${this._load}>Try again</button>
              </div>`
            : html`
                <div class="sheet">
                  <input
                    class="title-input"
                    aria-label="Notebook title"
                    .value=${this.title}
                    @input=${(e: Event) => { this.title = (e.target as HTMLInputElement).value; }}
                  />
                  <textarea
                    aria-label="Notebook content"
                    placeholder="Gather the idea, the question, or the thing you want to remember."
                    .value=${this.content}
                    @input=${(e: Event) => { this.content = (e.target as HTMLTextAreaElement).value; }}
                  ></textarea>
                </div>
                <div class="foot">
                  <span class="status ${this.error ? 'error' : ''}">
                    ${this.error
                      ? this.error
                      : this.savedAt
                        ? `Saved with this conversation · ${new Date(this.savedAt).toLocaleTimeString()}`
                        : 'Saved with this conversation'}
                  </span>
                  <button type="button" class="save" ?disabled=${this.saving} @click=${this._save}>
                    ${this.saving ? 'Saving…' : 'Save notebook'}
                  </button>
                </div>
              `}
      </div>
    `;
  }
}

if (!customElements.get('ux-notebook-panel')) {
  customElements.define('ux-notebook-panel', UxNotebookPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    'ux-notebook-panel': UxNotebookPanel;
  }
}
