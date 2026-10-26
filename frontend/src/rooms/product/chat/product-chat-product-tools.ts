/**
 * <product-chat-product-tools> — THE PRODUCT ROOM'S FOOT: THE APPLICATION'S OWN TOOLS.
 *
 * OWNER, 2026-10-06 — looking at the v.4b tray the foot carried ("Active Plugins" with its
 * five marks): *"all of these stubs go. And you're gonna put the products wiring down"*.
 * The marks were drawing-only by their own header's admission ("THE MARKS EMIT NOTHING
 * YET, DELIBERATELY"); the product room's foot carries the BUILDER's own tool row instead —
 * the one under its textarea, in its order:
 *
 *     attach · Figma · GitHub · edit visually
 *
 * WIRED, NOT DRAWN. This element composes nothing and reaches nothing (the tray's own
 * law): it raises two events and the ROOM answers them.
 *
 *     product-attach  { files: File[] }   — the room uploads through the product's own
 *                                           engine door and hands the engine's answer
 *                                           back as a chat line (the local engine's
 *                                           refusal included, verbatim).
 *     product-tool    { tool: 'figma' | 'github' | 'visual-edit' }
 *                                         — the room posts the ask into the embedded
 *                                           builder, which opens ITS OWN modal / editor:
 *                                           the product's functions with the product's
 *                                           own answers (local mode's truths included).
 *
 * SET ONLY BY THE PRODUCT ROOM — `product-chat-panel`'s `productTools` flag chooses between this
 * element and the tray — so no other seat's foot changes.
 *
 * THE CLIPBOARD IS THE APP'S RULE TOO: the seat forwards ⌘V files on the same flag, and
 * only when the clipboard is not really text (the app's own `filesFromClipboard` rule).
 */
import { LitElement, html, css, svg, nothing } from 'lit';

const paperclip = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
const figma = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"/><path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"/><path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"/><path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"/><path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"/></svg>`;
const github = svg`<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.33-1.28-1.68-1.28-1.68-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.18 1.76 1.18 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.72-1.54-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.9 10.9 0 0 1 5.74 0c2.19-1.49 3.15-1.18 3.15-1.18.62 1.59.23 2.76.11 3.05.73.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.39-5.25 5.67.41.36.78 1.06.78 2.15 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z"/></svg>`;
const pencil = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>`;
/* THE DESIGN SYSTEM'S MARK — four parts of one system (owner, 2026-10-25: *"make carbon an
   option in the footer … along with these other icons"*). It sits beside the builder's own
   tools because the system is what the builder builds in, not a room setting somewhere else. */
const systemIcon = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;

export class ChatProductTools extends LitElement {
  static properties = {
    /** The app's own connection facts, mirrored from the builder's messages. */
    figmaConnected: { type: Boolean, attribute: 'figma-connected' },
    githubConnected: { type: Boolean, attribute: 'github-connected' },
    /** The visual editor's own state, mirrored the same way — the pencil's pressed state. */
    visualEditActive: { type: Boolean, attribute: 'visual-edit-active' },
    /** THE SYSTEM THIS PACKAGE BUILDS IN — the package's own record, set by the room. */
    designSystem: { type: String, attribute: 'design-system' },
    /** The systems that exist right now, as the backend lists them: [{name, title}]. */
    designSystems: { type: Array },
  };

  declare figmaConnected: boolean;
  declare githubConnected: boolean;
  declare visualEditActive: boolean;
  declare designSystem: string;
  declare designSystems: Array<{ name?: string; title?: string }>;

  /** The system menu's own open state — drawing only; the room answers the choice. */
  private _systemsOpen = false;

  constructor() {
    super();
    this.figmaConnected = false;
    this.githubConnected = false;
    this.visualEditActive = false;
    this.designSystem = '';
    this.designSystems = [];
    this._systemsOpen = false;
  }

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('click', this._onDocumentClick);
  }

  disconnectedCallback(): void {
    document.removeEventListener('click', this._onDocumentClick);
    super.disconnectedCallback();
  }

  /** A click anywhere outside closes the menu — the house rule for every popover here. */
  private _onDocumentClick = (e: Event): void => {
    if (!this._systemsOpen) return;
    if (e.composedPath().includes(this)) return;
    this._systemsOpen = false;
    this.requestUpdate();
  };

  /** THE STANDING SYSTEM'S NAME, as the person reads it. */
  private _standingTitle(): string {
    const match = this.designSystems.find((s) => s?.name === this.designSystem);
    return String(match?.title || this.designSystem || 'Design system');
  }

  /** Choosing a system is the room's act; this element only says which one was pressed. */
  private _chooseSystem(name: string): void {
    this._systemsOpen = false;
    this.requestUpdate();
    if (!name) return;
    this.dispatchEvent(
      new CustomEvent('product-tool', {
        detail: { tool: 'design-system', system: name },
        bubbles: true,
        composed: true,
      }),
    );
  }

  /** The picker and the paste are ONE path — both land here as files. */
  private _onPick = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    input.value = ''; // so picking the same file twice still fires
    if (!files.length) return;
    this.dispatchEvent(
      new CustomEvent('product-attach', { detail: { files }, bubbles: true, composed: true }),
    );
  };

  private _tool(tool: 'figma' | 'github' | 'visual-edit'): void {
    this.dispatchEvent(
      new CustomEvent('product-tool', { detail: { tool }, bubbles: true, composed: true }),
    );
  }

  static styles = css`
    /*
     * THE CHIPS ONLY. THE PLATE IS NOT DRAWN HERE (owner, 2026-10-25: *"you have redesigned the
     * actual container without using the lit component … undo that and apply the actual lit
     * component and follow the pattern exactly"*). The container is <product-chat-plugin-tray>,
     * the same element the UX footer fills through its card's slot; this element is only what
     * stands IN that slot — the row of chips, in the UX footer's own chip treatment.
     */
    :host {
      display: inline-flex;
      min-width: 0;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .tool {
      position: relative;
      min-width: 30px;
      height: 28px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 8px;
      box-sizing: border-box;
      border: 1px solid rgba(28, 47, 78, 0.16);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.78);
      color: #1c2f4e;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      transition: background 140ms ease, border-color 140ms ease;
    }
    .tool:hover { background: #fff; border-color: rgba(28, 47, 78, 0.3); }
    .tool:focus-visible { outline: 2px solid #7e72e3; outline-offset: 1px; }
    .tool[aria-pressed='true'] { background: #fff; border-color: rgba(28, 47, 78, 0.3); }
    .tool svg { width: 16px; height: 16px; }
    /* The app marks a connection with a dot; same fact, same mark. */
    .tool[data-connected='true']::after {
      content: '';
      position: absolute;
      top: 4px;
      right: 4px;
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #10b981;
    }
    /* THE SYSTEM'S MENU — opens UP, because this row is the foot of the column. */
    .syswrap { position: relative; display: inline-flex; }
    .systems {
      position: absolute;
      left: 0;
      bottom: 34px;
      min-width: 196px;
      padding: 6px;
      border-radius: 10px;
      border: 1px solid rgba(0, 0, 0, 0.12);
      background: #ffffff;
      box-shadow: 0 10px 26px rgba(0, 0, 0, 0.16);
      z-index: 5;
    }
    .systems-head {
      padding: 4px 8px 6px;
      font-size: 11px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #6b7280;
    }
    .systems button {
      display: flex;
      width: 100%;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 7px 8px;
      border: 0;
      border-radius: 7px;
      background: transparent;
      color: #111827;
      font: inherit;
      font-size: 13px;
      text-align: left;
      cursor: pointer;
    }
    .systems button:hover { background: rgba(0, 0, 0, 0.06); }
    .systems button[aria-checked='true'] { background: rgba(0, 0, 0, 0.08); font-weight: 600; }
    .systems .check { color: #111827; font-size: 12px; }
    .systems .none { padding: 7px 8px; font-size: 12px; color: #6b7280; }
    input[type='file'] {
      position: absolute;
      width: 1px;
      height: 1px;
      opacity: 0;
      pointer-events: none;
    }
  `;

  render() {
    return html`
      <div class="row">
        <label class="tool" title="Attach files" aria-label="Attach files">
          <input type="file" multiple accept="image/*,.pdf,.svg" @change=${this._onPick} />
          ${paperclip}
        </label>
        <button
          class="tool"
          title="Figma"
          aria-label="Figma"
          data-connected=${this.figmaConnected ? 'true' : 'false'}
          @click=${() => this._tool('figma')}
        >${figma}</button>
        <button
          class="tool"
          title="GitHub"
          aria-label="GitHub"
          data-connected=${this.githubConnected ? 'true' : 'false'}
          @click=${() => this._tool('github')}
        >${github}</button>
        <button
          class="tool"
          title=${this.visualEditActive ? 'Close the visual editor' : 'Edit visually'}
          aria-label=${this.visualEditActive ? 'Close the visual editor' : 'Edit visually'}
          aria-pressed=${this.visualEditActive ? 'true' : 'false'}
          @click=${() => this._tool('visual-edit')}
        >${pencil}</button>
        <div class="syswrap">
          <button
            class="tool"
            title="Design system: ${this._standingTitle()}"
            aria-label="Design system: ${this._standingTitle()}"
            aria-haspopup="menu"
            aria-expanded=${this._systemsOpen ? 'true' : 'false'}
            aria-pressed=${this._systemsOpen ? 'true' : 'false'}
            @click=${() => {
              this._systemsOpen = !this._systemsOpen;
              this.requestUpdate();
            }}
          >${systemIcon}</button>
          ${this._systemsOpen
            ? html`<div class="systems" role="menu" aria-label="Design system">
                <div class="systems-head">Design system</div>
                ${this.designSystems.length
                  ? this.designSystems.map(
                      (s) => html`<button
                        type="button"
                        role="menuitemradio"
                        aria-checked=${s?.name === this.designSystem ? 'true' : 'false'}
                        @click=${() => this._chooseSystem(String(s?.name || ''))}
                      >
                        <span>${s?.title || s?.name}</span>
                        ${s?.name === this.designSystem ? html`<span class="check">✓</span>` : nothing}
                      </button>`,
                    )
                  : html`<div class="none">Reading the systems…</div>`}
              </div>`
            : nothing}
        </div>
        ${nothing}
      </div>
    `;
  }
}

if (!customElements.get('product-chat-product-tools')) {
  customElements.define('product-chat-product-tools', ChatProductTools);
}

declare global {
  interface HTMLElementTagNameMap {
    'product-chat-product-tools': ChatProductTools;
  }
}
