/**
 * <control-bar> — Lit A2UI Web Component
 *
 * Figma source: Wireframes v.4b — Left-column-ControlBar (node 40000761:261)
 *   Parent: controlBar (node 40000761:248)
 *
 * This component is the bottom control bar of the left column.
 * It is restricted to the left column — it does NOT span the full page.
 *
 * Layout (Figma node 40000761:248, 656×70px):
 *   [↩️ Undo] [Save Template ⌘ S] [RUN ⌘ ⏎]      — right-aligned, and nothing else.
 *   The master carries no version text; see render().
 *
 * Properties (HTML attributes):
 *   - is-saving       (Boolean) — shows spinner on Save button when true
 *   - is-running      (Boolean) — shows spinner on Run button when true
 *   - save-shortcut   (String)  — keyboard shortcut label (default "⌘ S")
 *   - run-shortcut    (String)  — keyboard shortcut label (default "⌘ ⏎")
 *
 * CustomEvents (bubble: true, composed: true — cross Shadow DOM):
 *   - save-click      — fired when Save Template button is clicked
 *   - run-click       — fired when Run button is clicked
 *   - undo-click      — fired when Undo button is clicked
 *
 * No React handlers. No inline callbacks. All interaction → CustomEvents.
 *
 * A2UI Catalog ID: control-bar
 * Lit Component: <control-bar>
 * Figma Node: 40000761:261 ("Left-column-ControlBar")
 * Framework: Lit 3.x — no decorators, static properties + customElements.define()
 */

import { LitElement, html, css } from 'lit';

// ═══════════════════════════════════════════════════════════════════════════════
// Component
// ═══════════════════════════════════════════════════════════════════════════════

export class ControlBar extends LitElement {
  static properties = {
    isSaving: { type: Boolean, attribute: 'is-saving' },
    isRunning: { type: Boolean, attribute: 'is-running' },
    saveShortcut: { type: String, attribute: 'save-shortcut' },
    runShortcut: { type: String, attribute: 'run-shortcut' },
  };

  declare isSaving: boolean;
  declare isRunning: boolean;
  declare saveShortcut: string;
  declare runShortcut: string;

  constructor() {
    super();
    this.isSaving = false;
    this.isRunning = false;
    this.saveShortcut = '⌘ S';
    this.runShortcut = '⌘ ⏎';
  }

  // ── Figma-exact CSS — node 40000761:248 ──────────────────────────────────
  static styles = css`
    :host {
      display: var(--left-control-display, flex);
      flex-shrink: 0;
      align-items: center;
      /* Figma "controlBar" #40000761:248: layout row, justify flex-end, align center.
         The bar holds ONE child — the CTA group — and the group is pushed right. */
      justify-content: flex-end;
      /* Figma node 40000761:248: bg-[#b5ccce] px-[38px] py-[13px] */
      padding: 13px 38px;
      background: #B5CCCE;
      /* Figma: rounded-br-[10px] */
      border-radius: 0px 0px 10px 0px;
      font-family: 'Inter', system-ui, sans-serif;
      /* Figma: 656×70 outer, minus padding = 656 × (70 - 13 - 13) = 656 × 44 inner */
      height: 70px;
      box-sizing: border-box;
      position: relative;
      width: 100%;
    }

    /* Figma: inner shadow on the bar */
    :host::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      pointer-events: none;
      box-shadow: inset 3px -4px 10px 0px rgba(0, 0, 0, 0.15),
                  inset 0px 4px 4px 0px rgba(0, 0, 0, 0.1);
    }

    /* ── Actions container (node 40000761:264 "CTA-prompt-inputs") ────────── */
    /* 417.24 × 44, and the three controls sit at FIXED offsets inside it. The master
       draws them as a group (layout mode "none", absolute x), so the spacing is a
       number, not a gap: undo x=0 (36.07 wide) · Save x=54.88 (204.44 wide, so 18.81
       after the circle) · RUN x=275.24 (142 wide, 15.92 after Save). 36.07 + 18.81 +
       204.44 + 15.92 + 142 = 417.24 exactly. */
    .actions {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      /* HUG the three controls (417.24) instead of filling the content box: the design's
         bar is justify-content flex-end, so the group sits against the right padding and
         the bar is otherwise empty. Measured before this: the group spanned the full
         content width and its controls came out LEFT-aligned — undo at 38px from the bar's
         left edge, where the design puts it at 201px. (No backticks in this comment: this
         is a Lit css literal, and a backtick ends it. tsc does not catch that; esbuild does.) */
      width: fit-content;
      flex: 0 0 auto;
      margin-left: auto;
      height: 44px;
    }

    /* ── Shared button base ───────────────────────────────────────────────── */
    button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border-radius: 6px;
      font-family: 'Inter', system-ui, sans-serif;
      cursor: pointer;
      transition: all 0.15s ease;
      white-space: nowrap;
    }

    /* ── Undo button (node 40000761:271 "undo-last-state-milivis") ───────── */
    .btn-undo {
      /* Figma: 36×36 circle, border 2px solid #A7A7A7, bg #E5E5E5 */
      width: 36px;
      height: 36px;
      padding: 0;
      border: 2px solid #A7A7A7;
      background: #E5E5E5;
      border-radius: 50%;
      /* Figma: ↩️ emoji text-[20px] text-[rgba(72,68,96,0.5)] font-bold */
      font-size: 20px;
      font-weight: 700;
      line-height: 1;
      color: rgba(72, 68, 96, 0.5);
      box-shadow: none;
    }

    .btn-undo:hover {
      background: #f3f4f6;
      border-color: #6b7280;
    }

    /* ── Save button (node 40000761:269 "Save prompt") ───────────────────── */
    .btn-save {
      /* Figma: x=54.88, 18.81 after the 36.07-wide circle — the group's own offsets,
         not a flex gap. */
      margin-left: 18.81px;
      /* Figma: bg-white, h-[43px], w-[204.437px], rounded-[6px] */
      background: #fff;
      color: #5a5a5a;
      border: none;
      /* Figma: text-[#5a5a5a] text-[16px] font-bold */
      font-size: 16px;
      font-weight: 700;
      height: 43px;
      width: 204px;
      /* Figma: button drop shadow */
      box-shadow: -4px -4px 10px 0px rgba(0, 0, 0, 0.15),
                   4px 4px 4px 0px rgba(0, 0, 0, 0.25);
    }

    .btn-save:hover {
      background: #f3f4f6;
    }

    .btn-save:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-save.saving {
      background: #e8f4f0;
      cursor: wait;
    }

    /* ── Run button (node 40000761:267 "enter-run") ──────────────────────── */
    .btn-run {
      /* Figma: x=275.24, 15.92 after Save's 204.44 — the group's own offsets. */
      margin-left: 15.92px;
      /* Figma: bg-gradient-to-l from-[#f0b424] to-[#fed141], h-[43px], w-[142px] */
      background: linear-gradient(to left, #f0b424 0%, #fed141 100%);
      /* Figma: text-black text-[18px] font-extrabold — drawn at 700. The master says extrabold
         (800) and the app has three weights: 500, 600, 700 (owner, 2026-09-18). The top of the
         range is 700, so a heavier request is capped rather than loaded. */
      color: #000;
      border: none;
      font-size: 18px;
      font-weight: 700;
      height: 43px;
      width: 142px;
      /* Figma: button drop shadow */
      box-shadow: -4px -4px 10px 0px rgba(0, 0, 0, 0.15),
                   4px 4px 4px 0px rgba(0, 0, 0, 0.25);
    }

    .btn-run:hover {
      filter: brightness(1.08);
    }

    .btn-run:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }

    .btn-run.running {
      background: linear-gradient(to left, #d4991f 0%, #e0b830 100%);
      cursor: wait;
    }

    .btn-run.running .spinner {
      border-color: rgba(0, 0, 0, 0.15);
      border-top-color: #000;
    }

    /* ── Shortcut labels ──────────────────────────────────────────────────── */
    /* Save shortcut (node 40000761:270): text-[#8b8b8b] */
    .shortcut {
      font-size: 16px;
      font-weight: 500;
      color: #8b8b8b;
    }

    /* Run shortcut (node 40000761:268): text-[#507274] font-medium */
    .shortcut-run {
      font-size: 14px;
      font-weight: 500;
      color: #507274;
    }

    /* ── Spinner (runtime state, not in Figma) ────────────────────────────── */
    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 3px solid rgba(80, 114, 116, 0.25);
      border-top-color: #507274;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    .saving-text {
      color: #507274;
      font-weight: 600;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  // ── Event handlers ────────────────────────────────────────────────────────

  private _handleUndo() {
    this.dispatchEvent(new CustomEvent('undo-click', {
      bubbles: true,
      composed: true,
    }));
  }

  private _handleSave() {
    if (this.isSaving) return;
    this.dispatchEvent(new CustomEvent('save-click', {
      bubbles: true,
      composed: true,
    }));
  }

  private _handleRun() {
    if (this.isRunning) return;
    this.dispatchEvent(new CustomEvent('run-click', {
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    // THE DESIGN'S BAR HAS THREE THINGS AND NOTHING ELSE. Its master
    // "Left-column-ControlBar" #40000761:261 has ONE child — "controlBar" #40000761:248 —
    // whose CTA group #40000761:264 holds the undo circle (#40000761:271), "Save Template
    // ⌘ S" (#40000761:269) and "RUN ⌘ ⏎" (#40000761:267). There is no version line in it.
    // One was drawn here from node #40000761:249, which is not part of this component —
    // and drawing it put a sentence in the bar that the design does not have.
    return html`
      <div class="actions" data-node-id="40000761:264">
        <!-- Undo button (node 40000761:271 "undo-last-state-milivis") -->
        <button
          class="btn-undo"
          @click=${this._handleUndo}
          title="Undo last state"
          data-node-id="40000761:271"
        >↩️</button>
        <!-- Save button (node 40000761:269 "Save prompt") -->
        <button
          class="btn-save ${this.isSaving ? 'saving' : ''}"
          ?disabled=${this.isSaving}
          @click=${this._handleSave}
          title="Save Template (${this.saveShortcut})"
          data-node-id="40000761:269"
        >
          ${this.isSaving
            ? html`<span class="spinner"></span> <span class="saving-text">Compiling...</span>`
            : html`Save Template <span class="shortcut">${this.saveShortcut}</span>`
          }
        </button>
        <!-- Run button (node 40000761:267 "enter-run") -->
        <button
          class="btn-run ${this.isRunning ? 'running' : ''}"
          ?disabled=${this.isRunning}
          @click=${this._handleRun}
          title="Run (${this.runShortcut})"
          data-node-id="40000761:267"
        >
          ${this.isRunning
            ? html`<span class="spinner"></span> <span class="saving-text" style="color:#000">Running...</span>`
            : html`RUN <span class="shortcut-run">${this.runShortcut}</span>`
          }
        </button>
      </div>
    `;
  }
}

if (!customElements.get('control-bar')) customElements.define('control-bar', ControlBar);

declare global {
  interface HTMLElementTagNameMap {
    'control-bar': ControlBar;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'control-bar': React.DetailedHTMLProps<
        React.HTMLAttributes<ControlBar> & {
          'is-saving'?: '' | undefined;
          'save-shortcut'?: string;
          'run-shortcut'?: string;
          ref?: React.Ref<ControlBar>;
        },
        ControlBar
      >;
    }
  }
}
