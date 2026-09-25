/**
 * <left-column-header> — the prompt's own bar: what this package is called, which
 * version of it is on screen, and what is known about it.
 *
 * WHY IT MOVED OFF REACT. Everything else about a prompt already lives in the surface —
 * the sections are data-bound paths the AI writes, and that is why a person can insert a
 * tool or a seat without anything bespoke. This bar was the last piece still owned by the
 * shell, so the TITLE in particular could only be changed through a callback the shell
 * handed down: no path, no tag, nothing the AI could reach. Moving it in makes the title
 * a value like every other value, so she can read it, ask about it, and set it.
 *
 * WHAT IS WIRED AND WHAT IS NOT. This is a straight carry of the React bar
 * (`components/LeftColumnHeader.tsx`, row 2) with its state made explicit, and some of it
 * has nothing behind it yet. Those are marked in place rather than drawn as though they
 * work — a control that takes a click and does nothing is indistinguishable from a broken
 * one, which is the failure this codebase keeps writing down.
 *
 *   title    WIRED   editable here, and settable by the AI (see the `title` prop and the
 *                    `a2ui:set-title` path in the host)
 *   version  WIRED   the label only. The list and restore are the React VersionManager's
 *                    job today and are marked as not yet moved.
 *   ID       WIRED   display only. Kept because the owner reads it while testing; not
 *                    something a customer needs to see.
 *   tags     PLACEHOLDER  drawn, inert, says so
 *   author   PLACEHOLDER  drawn, inert, says so
 *   score    PLACEHOLDER  drawn, inert, says so
 *   flip     INACTIVE     the owner: "you don't have to do the flip function. You can
 *                         just keep that inactive at the moment"
 *
 * DESIGN. Colours, sizes and spacing are the React bar's, which its own docstring says
 * were taken from the design. nothing here is invented.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

/** One inert control. Drawn, labelled, and honest about taking no click. */
function placeholder(label: string, value: unknown, cls: string) {
  return html`
    <span class=${cls} data-inert="true" title=${`${label} — not wired up yet`}
          aria-disabled="true">${value}</span>`;
}

export class LeftColumnHeader extends LitElement {
  static properties = {
    /** The package's title. Empty draws the prompt to name it. */
    title: { type: String },
    /** The version on screen, as a number. 0 or absent draws the empty label. */
    version: { type: Number },
    /** The package's id. Display only — the owner reads it while testing. */
    promptId: { type: String, attribute: 'prompt-id' },
    /** True while the title field is open. Local, but declared so the host can see it. */
    editing: { type: Boolean, reflect: true },
  };

  declare title: string;
  declare version: number;
  declare promptId: string;
  declare editing: boolean;

  /** What the person is typing, before it is committed. */
  private _draft = '';

  static styles = [
    designTokens,
    css`
      :host {
        display: block;
        flex: 0 0 auto;
        background: #F7F8F2;
        border-top: 1px solid rgba(0, 0, 0, 0.08);
        min-height: 44px;
        /*
         * THE DROP SHADOW IS THE DRAWING'S, not a decoration added here. It was on the
         * React wrapper (#left-column-header, boxShadow 0 8px 24px rgba(0,0,0,0.25))
         * and it is what lifts the bar off the prompt below it — the bar and the sections
         * are both white, so without it they read as one surface with a seam.
         */
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
        position: relative;
        z-index: 1;
      }
      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        padding: 0 16px;
        min-height: 44px;
      }

      /* ── the title, which is the one field a person edits here ───────────── */
      .title-slot { flex: 1 1 0%; min-width: 0; }
      .title-btn {
        width: 100%;
        text-align: left;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        color: #111827;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 4px 8px;
        cursor: pointer;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .title-btn:hover { border-color: #d1d5db; }
      .title-empty { color: #6b7280; font-style: italic; font-weight: 500; }
      .title-input {
        width: 100%;
        box-sizing: border-box;
        font: inherit;
        font-size: 14px;
        font-weight: 600;
        color: #111827;
        background: #F7F8F2;
        border: 2px solid #4e68d2;
        border-radius: 4px;
        padding: 4px 8px;
        outline: none;
        box-shadow: 0 0 0 2px rgba(78, 104, 210, 0.15);
      }

      /* ── the controls on the right ───────────────────────────────────────── */
      .controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
      }
      .meta {
        font-size: 12px;
        font-weight: 500;
        color: #4b5563;
        white-space: nowrap;
      }
      /* No muted state to style for an absent id: it draws NO line. A draft is a normal
         thing to have, not a field waiting to be filled. */
      .version { font-size: 12px; font-weight: 600; color: #4b5563; white-space: nowrap; }
      .version-empty { color: #9ca3af; font-weight: 500; }
      .tag {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 12px;
        font-weight: 500;
        color: #d97706; /* text-amber-600 in the React bar */
      }
      .tag svg { width: 14px; height: 14px; }
      /*
       * AN INERT CONTROL LOOKS INERT. The three that have nothing behind them carry a
       * dashed underline rather than a hover state — a hover that promises a click and
       * a click that does nothing is how a person concludes the app is broken.
       */
      .inert {
        border-bottom: 1px dashed rgba(0, 0, 0, 0.28);
        cursor: default;
      }
      .score {
        display: flex;
        align-items: center;
        gap: 4px;
        padding: 2px 12px;
        border-radius: 4px;
        border: 1px solid #9ca3af;
        background: #F7F8F2;
        font-size: 12px;
        font-weight: 500;
        color: #374151;
      }
      .score svg { width: 12px; height: 12px; opacity: 0.6; }
      .flip {
        font-size: 12px;
        font-weight: 600;
        color: #9ca3af;
        padding: 2px 8px;
        border-radius: 4px;
        border: 1px dashed rgba(0, 0, 0, 0.28);
      }
    `,
  ];

  constructor() {
    super();
    this.title = '';
    this.version = 0;
    this.promptId = '';
    this.editing = false;
  }

  /** Enter commits, Escape abandons — the React bar's own keys, kept. */
  private _onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter') { e.preventDefault(); this._commit(); }
    else if (e.key === 'Escape') { e.preventDefault(); this._cancel(); }
  };

  private _commit(): void {
    this.editing = false;
    const next = this._draft.trim();
    // A title is not cleared by blurring an empty field: an empty submit is a cancel,
    // which is what the React version did by testing `trimmed &&` before dispatching.
    if (!next || next === this.title) return;
    this.title = next;
    this.dispatchEvent(new CustomEvent('title-change', {
      bubbles: true, composed: true, detail: { title: next },
    }));
  }

  private _cancel(): void {
    this.editing = false;
    this._draft = this.title;
  }

  private _beginEdit(): void {
    this._draft = this.title;
    this.editing = true;
  }

  protected updated(changed: Map<string, unknown>): void {
    // The field owns the caret, so it is focused after the render that created it.
    if (changed.has('editing') && this.editing) {
      const input = this.renderRoot.querySelector('input') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    }
  }

  render() {
    const title = this.title || '';
    return html`
      <div class="bar">
        <div class="title-slot">
          ${this.editing
            ? html`<input class="title-input" type="text" .value=${this._draft}
                          placeholder="Enter prompt title..."
                          @input=${(e: Event) => { this._draft = (e.target as HTMLInputElement).value; }}
                          @keydown=${this._onKey}
                          @blur=${() => this._commit()}>`
            : html`<button class="title-btn" type="button" title="Click to edit title"
                           @click=${() => this._beginEdit()}>
                     ${title || html`<span class="title-empty">Untitled prompt — give it a name</span>`}
                   </button>`}
        </div>

        <div class="controls">
          <span class="version ${this.version ? '' : 'version-empty'}">
            ${this.version ? `Editing Version v${this.version}` : 'Editing Version —'}
          </span>

          ${placeholder('Tags', html`<svg viewBox="0 0 16 16" fill="none"><path d="M8 3L14 13H2L8 3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 7v3M8 11.5v.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>No tags +`, 'tag inert')}

          ${/*
             * NO ID DRAWS NOTHING AT ALL. There is no such thing as a package that is
             * "missing" an id: it is a draft, and a draft is a normal thing to have —
             * people try something out and choose not to keep it, which is their call and
             * not a state worth flagging. The owner, 2026-09-28: "unsaved package needs
             * nothing... a lot of unsaved packages. It's actually a user choice."
             *
             * When there IS an id it is TRUNCATED TO FIVE CHARACTERS, with the whole one on
             * hover. A UUID is 36 characters that pushed the title out of the way, which is
             * the opposite of what a header is for; five is enough to tell two packages
             * apart at a glance and the full value is one hover away for the testing it
             * exists for.
             */ ''}
          ${this.promptId
            ? html`<span class="meta" title="Full id: ${this.promptId}"
                  >ID: ${this.promptId.slice(0, 5)}…</span>`
            : nothing}

          ${placeholder('Author', 'Author: —', 'meta inert')}

          ${placeholder('Score', html`Score N/A<svg viewBox="0 0 12 12" fill="none"><path d="M3 4.5l3 3 3-3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`, 'score inert')}

          <span class="flip" title="Column flip — not wired up yet">Flip</span>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('left-column-header')) {
  customElements.define('left-column-header', LeftColumnHeader);
}

declare global {
  interface HTMLElementTagNameMap {
    'left-column-header': LeftColumnHeader;
  }
}
