/**
 * <ai-surface-sandbox> — Lit A2UI Web Component
 *
 * Port of the React AISurfaceSandbox into a Shadow DOM-isolated Lit element.
 * Provides a rigid, visually bounded rendering surface where Grace (the AI
 * agent) assembles and renders A2UI content. Strictly separated from the
 * Operator Shell (sidebar, header, chat panel) per 2UI architecture.
 *
 * Structural guarantees (verified via Playwright 2026-07-26):
 *   - :host applies flex: 1 1 0% + min-height: 0 as the flex child anchor
 *     in the parent flex row — the exact same role the React <section> played.
 *   - #ai-surface uses CSS contain: layout style as the visual boundary, with
 *     inset box-shadow sinking the canvas into the dashboard.
 *   - .viewport uses position: absolute + overflow: auto so content scrolls
 *     independently without warping the parent layout.
 *
 * Named slots:
 *   - slot="spinner"  — shown when is-ai-assembling is true
 *   - slot="console"  — shown when header-tab is "console"
 *   - slot="workspace"— shown for all other tab values (composer, evaluation, etc.)
 *
 * All three slots' content lives in the light DOM; the component conditionally
 * projects only the active slot into the Shadow DOM. Non-active content remains
 * mounted (preserving React state) but is not displayed.
 *
 * A2UI Catalog ID: ai-surface-sandbox
 * Framework: Lit 3.x — no decorators, static properties + customElements.define()
 */

import { LitElement, html, css } from 'lit';

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export class AISurfaceSandbox extends LitElement {
  // ── Reactive properties (static getter — no decorators) ──────────────────
  static properties = {
    /**
     * When true, the "spinner" slot is projected. The AI is assembling the
     * surface and no interactive content should be shown.
     * Lit Boolean converter: attribute present → true, absent → false.
     */
    isAIAssembling: { type: Boolean, attribute: 'is-ai-assembling' },

    /**
     * Which tab is active in the header. Controls which content slot is shown:
     *   "console"   → projects slot="console"
     *   any other   → projects slot="workspace"
     */
    headerTab: { type: String, attribute: 'header-tab' },

    /**
     * Internal error boundary state. NOT reflected as an attribute —
     * managed entirely inside the Shadow DOM. When true, the viewport
     * is replaced with an inline error panel.
     */
    _hasRuntimeError: { type: Boolean, state: true },

    /** Human-readable error summary for the inline panel. */
    _errorMessage: { type: String, state: true },

    /** Full stack trace for diagnostics. */
    _errorStack: { type: String, state: true },
  };

  // ── Defaults ─────────────────────────────────────────────────────────────
  declare isAIAssembling: boolean;
  declare headerTab: string;

  /** @internal — error boundary state */
  declare _hasRuntimeError: boolean;
  /** @internal — error message for inline display */
  declare _errorMessage: string;
  /** @internal — stack trace for inline display */
  declare _errorStack: string;

  /**
   * The slot being PROJECTED right now. Follows `headerTab`/`isAIAssembling`; the
   * incoming surface fades in over the dark ground on each change.
   */
  private _committedSlot = '';
  /** Cross-fade phase: '' (settled) | 'out' (fading the old away) | 'in' (fading the new in). */
  private _fadePhase: '' | 'out' | 'in' = '';
  private _fadeTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super();
    this.isAIAssembling = false;
    this.headerTab = 'console';
    this._hasRuntimeError = false;
    this._errorMessage = '';
    this._errorStack = '';
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────
  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('error', this._onSlotError as EventListener, true);
  }

  disconnectedCallback(): void {
    this.removeEventListener('error', this._onSlotError as EventListener, true);
    if (this._fadeTimer) { clearTimeout(this._fadeTimer); this._fadeTimer = null; }
    super.disconnectedCallback();
  }

  /** The fade class — a single gentle fade-in on the incoming surface. */
  private get _fadeClass(): string {
    return this._fadePhase === 'in' ? 'fade-in' : '';
  }

  /**
   * The slot the shell is asking for, right now — the same three-way contract render()
   * uses: spinner while assembling, console for the console header tab, workspace
   * otherwise.
   */
  private get _activeSlot(): string {
    return this.isAIAssembling
      ? 'spinner'
      : this.headerTab === 'console'
        ? 'console'
        : 'workspace';
  }

  /**
   * SIMPLE FADE-IN, NO TEARDOWN. The slot swaps immediately (so the chat and the
   * rest of the surface never linger after they should be gone) and the incoming
   * surface fades in over the already-dark #582846 ground. No fade-out, no deferred
   * commit — a two-beat teardown held the outgoing tree (chat included) on screen
   * for an extra beat and then dropped it at once, which is the "flies out" jerk.
   */
  updated(): void {
    const wanted = this._activeSlot;
    if (wanted !== this._committedSlot) {
      this._committedSlot = wanted;
      this._fadePhase = 'in';
      if (this._fadeTimer) clearTimeout(this._fadeTimer);
      this._fadeTimer = setTimeout(() => {
        this._fadePhase = '';
        this._fadeTimer = null;
        this.requestUpdate();
      }, 875);
      this.requestUpdate();
    }
  }

  /** Catch errors bubbling up from slotted child elements. */
  private _onSlotError = (e: Event): void => {
    const errorEvent = e as ErrorEvent;
    this._hasRuntimeError = true;
    this._errorMessage = errorEvent.message || 'Unknown rendering error in slotted content';
    this._errorStack = errorEvent.error?.stack || '(no stack trace available)';
    e.stopPropagation(); // trap inside shadow — don't crash React shell
  };

  /** Reset the error boundary and request the React shell to re-mount content. */
  private _handleReset(): void {
    this._hasRuntimeError = false;
    this._errorMessage = '';
    this._errorStack = '';
    this.dispatchEvent(new CustomEvent('surface-error-reset', {
      bubbles: true,
      composed: true,
      detail: { timestamp: Date.now() },
    }));
  }

  // ── Shadow DOM styles — exact pixel-identical port + error panel styles ──
  static styles = css`
    /* ── :host acts as the flex child in the parent row layout ────────── */
    :host {
      display: flex;
      flex: 1 1 0%;
      min-height: 0;
      /* min-width:0 is REQUIRED, not cosmetic. A flex item defaults to
         min-width:auto, which refuses to shrink below its content's
         min-content width. Without this the sandbox will not yield any
         width, and the fixed-width, shrink-0 console chat pane beside it is
         pushed past the browser's right edge, where the parent's
         overflow:hidden clips it — visible in the DOM, unreachable by mouse. */
      min-width: 0;
    }

    /* ── Outer boundary — visual frame, containment, border ──────────── */
    #ai-surface {
      position: relative;
      width: 100%;
      height: 100%;
      min-height: 0;
      /* Border removed at the owner's request — the surface frame used to draw a
         2px #507274 outline around everything. Kept as none (not deleted) so the
         box model is unchanged: the same rule still owns the edge. */
      border: none;
      /* THE SCENE'S OWN GROUND, matched to the surface — so a slot swap never
         flashes the wrong colour. The base paints immediately and the incoming
         content layers over it; if the base is a fixed single colour it shows
         through the fade when one surface's ground differs from the other's
         (console #270F31 vs composer #582846). */
      background-color: #582846;
      overflow: hidden;
      contain: layout style;
      margin: 0;
      box-shadow:
        inset 0 2px 4px rgba(0, 0, 0, 0.06),
        0 1px 2px rgba(0, 0, 0, 0.05);
    }
    #ai-surface.ground-console {
      background-color: #270F31;
    }

    /* ── Scroll viewport — absolute fill, overflow-x: hidden prevents
         unwanted horizontal scrollbars during splitter resize operations.
         Vertical overflow-y: auto allows content to scroll naturally. ── */
    .viewport {
      position: absolute;
      inset: 0;
      overflow-x: hidden;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
    }
    .viewport.fade-in {
      animation: surface-fade 875ms ease-out;
    }
    @keyframes surface-fade {
      from { opacity: 0; }
      to { opacity: 1; }
    }
    /* Motion is a courtesy, never a requirement: honour the OS-level opt-out. */
    @media (prefers-reduced-motion: reduce) {
      .viewport.fade-in { animation: none; }
    }

    /* ── Scrollbar — same as the left composer column (.sections-scroll) and all
         three workspace columns: 14px, transparent track, #dadee4 rounded thumb.
         This is the scroller the CONSOLE uses, so the console matches. ─────── */
    .viewport::-webkit-scrollbar { width: 14px; }
    .viewport::-webkit-scrollbar-track { background: transparent; }
    .viewport::-webkit-scrollbar-thumb { background: #dadee4; border-radius: 10px; }

    /* ── Slotted content fills the viewport.
         min-width: 0 is essential to prevent content from expanding
         the flex container horizontally during splitter resize.
         overflow-x: hidden clips horizontal overflow at this level. ── */
    ::slotted(*) {
      display: flex;
      flex: 1 1 auto;
      min-height: 0;
      min-width: 0;
      overflow-x: hidden;
    }

    /* ── Error boundary panel — high-visibility, loud, no soft fallbacks ── */
    .error-panel {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      background: #1a1a2e;
      color: #ff6b6b;
      padding: 24px;
      overflow: auto;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .error-panel .error-label {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 20px;
      font-weight: 700;
      color: #ff4444;
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .error-panel .error-icon {
      width: 28px;
      height: 28px;
      background: #ff4444;
      border-radius: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: 18px;
      font-weight: 700;
      line-height: 1;
    }

    .error-panel .error-message {
      font-size: 15px;
      font-weight: 600;
      color: #ff8a80;
      margin-bottom: 20px;
      padding: 12px;
      background: rgba(255, 68, 68, 0.1);
      border-left: 3px solid #ff4444;
      border-radius: 0 6px 6px 0;
    }

    .error-panel .error-stack {
      flex: 1;
      min-height: 0;
      overflow: auto;
      background: #0d0d1a;
      border: 1px solid #333;
      border-radius: 6px;
      padding: 16px;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.6;
      color: #e0e0e0;
      white-space: pre-wrap;
      word-break: break-all;
      margin-bottom: 20px;
    }

    .error-panel .error-actions {
      display: flex;
      gap: 12px;
      flex-shrink: 0;
    }

    .error-panel button {
      padding: 10px 24px;
      border: none;
      border-radius: 6px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
    }

    .error-panel button:active {
      transform: scale(0.97);
    }

    .error-panel .btn-reset {
      background: #ff4444;
      color: #fff;
    }

    .error-panel .btn-reset:hover {
      background: #cc0000;
    }

    .error-panel .error-hint {
      margin-top: 12px;
      font-size: 13px;
      color: #666;
      font-style: italic;
    }
  `;

  // ── Render ───────────────────────────────────────────────────────────────
  // HONEST STATUS (2026-08-01):
  // This viewport routes to exactly 3 slots: console | workspace | spinner.
  // The AI decides WHAT fills those slots (prompt blocks, data, chat messages)
  // but cannot change the slot contract itself. Per owner design, the prompt
  // layout has slots with pre-ordered locations for modules — slots are the
  // layout contract, blocks are the content the AI controls.
  render() {
    // Runtime error boundary (template compilation failures)
    if (this._hasRuntimeError) {
      return html`
        <section id="ai-surface">
          <div class="error-panel">
            <div class="error-label">
              <span class="error-icon">!</span>
              A2UI Surface Runtime Error
            </div>
            <div class="error-message">${this._errorMessage || 'Unknown error'}</div>
            <div class="error-stack">${this._errorStack || 'No stack trace captured.'}</div>
            <div class="error-actions">
              <button class="btn-reset" @click=${this._handleReset}>Force Reset Viewport</button>
            </div>
            <div class="error-hint">
              This error was trapped inside the Lit Shadow DOM boundary.
              The operator shell (sidebar, header, chat panel) is unaffected.
            </div>
          </div>
        </section>
      `;
    }

    // Normal rendering — project the COMMITTED slot (deferred across the cross-fade)
    // HONEST STATUS (2026-08-01): Slot routing is FIXED: console | workspace | spinner.
    // The AI controls WHAT fills the slots (which prompt blocks, which data),
    // but it cannot create new slot names or change the routing logic.
    // The slot contract (left=prompt-section-editor, middle=compiled-output-viewer,
    // right=chat-panel) is the layout framework — pre-ordered locations for modules.
    // This is correct per owner design: slots are the contract, blocks are the content.
    const activeSlot = this._committedSlot || this._activeSlot;
    // The base ground follows the surface so the fade never reveals the other surface's
    // colour: console paints #270F31, everything else (composer/spinner) the #582846 default.
    const groundClass = activeSlot === 'console' ? 'ground-console' : '';

    try {
      return html`
        <section id="ai-surface" class=${groundClass}>
          <div class="viewport ${this._fadeClass}">
            <slot name=${activeSlot}></slot>
          </div>
        </section>
      `;
    } catch (err: unknown) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._hasRuntimeError = true;
      this._errorMessage = `Template compilation failed: ${error.message}`;
      this._errorStack = error.stack || '(no stack)';
      return html``;
    }
  }
}

// ── Register the custom element ─────────────────────────────────────────────
if (!customElements.get('ai-surface-sandbox')) customElements.define('ai-surface-sandbox', AISurfaceSandbox);

// ── Extend JSX intrinsics for TypeScript recognition in React ───────────────
declare global {
  interface HTMLElementTagNameMap {
    'ai-surface-sandbox': AISurfaceSandbox;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'ai-surface-sandbox': React.DetailedHTMLProps<
        React.HTMLAttributes<AISurfaceSandbox> & {
          'is-ai-assembling'?: '' | undefined;
          'header-tab'?: string;
          ref?: React.Ref<AISurfaceSandbox>;
        },
        AISurfaceSandbox
      >;
    }
  }
}
