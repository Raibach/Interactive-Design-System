/**
 * <design-left-footer> — THE DESIGN ROOM'S COLUMN FOOTER, WITH ITS ONE ACTION (owner, 2026-10-25).
 *
 * The Composer bar's plate — the same height, fill, rounded corner and inner shadow, read from
 * `control-bar.ts` — and the one control this column owns: Apply Carbon. The floating button
 * that stood over the room moves here, where the Composer keeps its actions.
 */
import { LitElement, css, html, nothing } from 'lit';
import { getStoredUserId } from '@/services/authService';

export class DesignLeftFooter extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-shrink: 0;
      align-items: center;
      justify-content: flex-end;
      height: 70px;
      width: 100%;
      box-sizing: border-box;
      padding: 13px 38px;
      background: rgba(181, 204, 206, 0.75);
      border-radius: 0px 0px 10px 0px;
      position: relative;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
    }
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 3px -4px 10px 0px rgba(0, 0, 0, 0.15),
                  inset 0px 4px 4px 0px rgba(0, 0, 0, 0.1);
    }
    .apply {
      position: relative;
      z-index: 1;
      padding: 8px 16px;
      border: 1px solid rgba(240, 179, 35, 0.55);
      border-radius: 8px;
      background: #231f2e;
      color: #f5f0e8;
      font-size: 13px;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      cursor: pointer;
    }
    .apply:disabled {
      opacity: 0.7;
      cursor: default;
    }
    .result {
      position: relative;
      z-index: 1;
      margin-right: 12px;
      font-size: 12px;
      color: #2f4a4c;
      max-width: 42ch;
    }
  `;

  static properties = {
    result: { type: String },
    busy: { type: Boolean },
  };
  declare result: string;
  declare busy: boolean;

  constructor() {
    super();
    this.result = '';
    this.busy = false;
  }

  private async applyCarbon(): Promise<void> {
    this.busy = true;
    this.result = 'Applying Carbon…';
    try {
      const res = await fetch('/api/design/apply-carbon', {
        method: 'POST',
        headers: { 'X-User-ID': getStoredUserId() },
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; detail?: string } | null;
      if (!res.ok) throw new Error(body?.detail || `the server answered ${res.status}`);
      this.result = 'Carbon applied.';
    } catch (e) {
      this.result = e instanceof Error ? e.message : String(e);
    } finally {
      this.busy = false;
    }
  }

  render() {
    return html`
      ${this.result ? html`<span class="result">${this.result}</span>` : nothing}
      <button class="apply" type="button" ?disabled=${this.busy} @click=${() => void this.applyCarbon()}>
        Apply Carbon
      </button>
    `;
  }
}

if (!customElements.get('design-left-footer')) {
  customElements.define('design-left-footer', DesignLeftFooter);
}
