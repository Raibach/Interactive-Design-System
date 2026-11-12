/**
 * <ux-chat-controls> — THE ROOM'S CHAT TOOLS, FLAT IN THE FOOTER.
 *
 * The tools are not behind a menu. The notebook and the discussion are text chips at the surface,
 * beside the product chip and Add context. The footer follows the same small-chip treatment the
 * PostHog footer uses (a light chip, a thin border, the product icon, the label), not a second
 * menu of our own.
 */
import { LitElement, html, css } from 'lit';

type ChatPanel = 'notebook' | 'discussion';

export class UxChatControls extends LitElement {
  private _choose(panel: ChatPanel): void {
    this.dispatchEvent(
      new CustomEvent('ux-control-panel', {
        bubbles: true,
        composed: true,
        detail: { panel },
      }),
    );
  }

  static styles = css`
    :host {
      display: inline-flex;
      min-width: 0;
      font: 12px/1.2 'IBM Plex Sans', system-ui, -apple-system, "Segoe UI", sans-serif;
      color: #1c2f4e;
    }
    .tools {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .tool {
      appearance: none;
      height: 28px;
      padding: 0 10px;
      border: 1px solid rgba(28, 47, 78, 0.16);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.78);
      color: #1c2f4e;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      white-space: nowrap;
      transition: background 140ms ease, border-color 140ms ease;
    }
    .tool:hover {
      background: #fff;
      border-color: rgba(28, 47, 78, 0.3);
    }
    .tool:focus-visible {
      outline: 2px solid #7e72e3;
      outline-offset: 1px;
    }
  `;

  render() {
    return html`
      <div class="tools" role="group" aria-label="Chat tools">
        <button type="button" class="tool" @click=${() => this._choose('notebook')}>Notebook</button>
        <button type="button" class="tool" @click=${() => this._choose('discussion')}>Discussions</button>
      </div>
    `;
  }
}

if (!customElements.get('ux-chat-controls')) {
  customElements.define('ux-chat-controls', UxChatControls);
}

declare global {
  interface HTMLElementTagNameMap {
    'ux-chat-controls': UxChatControls;
  }
}
