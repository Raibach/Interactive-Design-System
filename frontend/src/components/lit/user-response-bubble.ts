/**
 * <user-response-bubble> — one response row in the output card.
 *
 * Figma source (file 20UPR2KQMsbAxlo5NJb1se, v.4b): "user-response-bubble"
 * #40001119:6352 — a row, padding 4px, radius 6, gap 4, fill #CBE6E3 — holding
 * the feedback mark #40001119:6354 (19×19) and its line #40001119:6358
 * (Inter 500 / 13px / 20px, #171717). The wireframe draws it twice inside the
 * response card (#40001119:6327) with sample copy; a host feeds it the real
 * turn, which is what `text` is for.
 *
 * The fill is the same #CBE6E3 the block grounds use — on the card's
 * rgba(117,142,135,0.35) shell it reads as the lighter green the drawing shows.
 *
 * The drawing annotates nothing on this node: no `On click:`, no `Data:`. So the
 * element carries no events and no handler — an invented event name cannot be told
 * from a decision someone actually made, which is the rule the annotation pass
 * exists to keep. It is a drawing until the designer says otherwise.
 */
import { LitElement, html, css, nothing } from 'lit';
import { ref } from 'lit/directives/ref.js';
import responseIcon from '@/assets/figma-user-response-icon.svg';

export class UserResponseBubble extends LitElement {
  static properties = {
    /** The response line. The host supplies it; the drawing's own copy is sample. */
    text: { type: String },
    /**
     * OPEN SHOWS THE WHOLE QUESTION; CLOSED CLAMPS IT TO TWO LINES. The owner, 2026-10-03:
     * *"the question should set at the top… show maybe two lines and then truncate the rest
     * of the question… the user can open it close it as they need to re-read the question,
     * which will happen very rarely, but I want that ability there."* Internal state — a
     * decision the owner made, not an invented event.
     */
    expanded: { type: Boolean, attribute: false },
  };

  declare text: string;
  declare expanded: boolean;

  /** The clamped line, measured so the toggle exists only when something is hidden. */
  private _lineEl: HTMLElement | null = null;
  private _overflowing = false;

  constructor() {
    super();
    this.text = '';
    this.expanded = false;
  }

  private _toggle = (e: Event): void => {
    // The turn's own click handler must not also fire: this press belongs to the question.
    e.stopPropagation();
    if (!this._overflowing) return;
    this.expanded = !this.expanded;
  };

  private _onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this._toggle(e);
    }
  };

  /** Re-runs the trim when the line's own width changes — see `_applyClamp`. */
  private _ro: ResizeObserver | null = null;

  /**
   * THE TWO-LINE CUT IS MEASURED, NOT CLAMPED — the owner, 2026-10-03: *"I don't want to use
   * clamps. Clamps don't work… it would violate our protocol."* He is right, and this
   * repository said so first: `agent-card-element` carries the recorded argument (a fixed
   * line-clamp cannot both adapt to the box and ellipsize the cut, so ITS text is measured
   * and trimmed), and the ellipsis commit's own rule is that the cut is asked of the TEXT,
   * never of an engine's box. So this does exactly what the card does, one box smaller:
   *
   *   the line's box is a FIXED two lines tall (40px — .line carries 20px line-height), the
   *   full text is written into it, and if it does not fit, the longest prefix that DOES fit
   *   is found by binary search and completed with '…'. The string on screen is the proof;
   *   nothing about the cut depends on a CSS property an engine may or may not honour.
   *
   * Written on every pass, including before the fit check: Lit re-applies a text binding
   * only when the bound value changed, so a re-render that keeps `text` would otherwise
   * leave the previous trim on screen (the card's own reason for the same line of code).
   *
   * MEASURED ONLY WHILE CLOSED — expanded, the box is auto-sized and the text is whole —
   * and re-run when the WIDTH changes (a ResizeObserver on the line; the bubbles render once
   * during the assembly, while the panel is still collapsing to the rail, so the first answer
   * wraps against a width the reader never sees) and once when the fonts settle.
   */
  private _applyClamp(): void {
    const line = this._lineEl;
    if (!line) return;
    const full = this.text ?? '';
    line.textContent = full;
    if (this.expanded) return; // the box is auto-sized; the whole question is the drawing
    const fits = (): boolean => line.scrollHeight <= 40 + 1;
    const overflowing = !fits();
    if (overflowing) {
      let lo = 0;
      let hi = full.length;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        line.textContent = `${full.slice(0, mid).trimEnd()}…`;
        if (fits()) lo = mid;
        else hi = mid - 1;
      }
      line.textContent = `${full.slice(0, lo).trimEnd()}…`;
    }
    if (overflowing !== this._overflowing) {
      this._overflowing = overflowing;
      this.requestUpdate();
    }
  }

  protected updated(): void {
    this._applyClamp();
  }

  protected firstUpdated(): void {
    const line = this._lineEl;
    if (line && typeof ResizeObserver === 'function') {
      this._ro = new ResizeObserver(() => this._applyClamp());
      this._ro.observe(line);
    }
    // And once more when the fonts settle: the first trim can run before the face arrives,
    // and a fallback face wraps differently. Engines without the API (and jsdom, which lays
    // nothing out) keep the first answer.
    const fonts = (document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    void fonts?.ready?.then(() => this._applyClamp()).catch(() => undefined);
  }

  disconnectedCallback(): void {
    this._ro?.disconnect();
    this._ro = null;
    super.disconnectedCallback();
  }

  static styles = css`
    :host { display: block; }
    /* Figma "user-response-bubble" #40001119:6352, verbatim: row, padding 4px,
       gap 4, radius 6, fill #CBE6E3, aligned centre.
       THE FILL KEEPS THE SEAT'S OWN TOKEN. index.css carries one chat palette for
       every seat (the owner's 2026-09-19 ask) and --chat-user-bg is its "this turn
       is the person's" value; a seat that sets it keeps its own bubble colour and
       every other seat gets the drawing's #CBE6E3. Hard-coding the hex would have
       quietly retired a token the console relies on. */
    .bubble {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      border-radius: 6px;
      background: var(--chat-user-bg, #CBE6E3);
    }
    /* The mark's own box — the drawing wraps it in a 19-wide column with 5px of
       padding above it (#40001119:6353), so the icon sits 5px down from the row's
       top edge. The column is 19 wide, which is also how the icon is placed. */
    .mark {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      flex: 0 0 19px;
      width: 19px;
      padding-top: 5px;
      box-sizing: border-box;
    }
    .mark img {
      display: block;
      width: 19px;
      height: 19px;
      pointer-events: none;
    }
    /* The line. #40001119:6358 is a fixed 451 in the wireframe because the frame
       is hand-placed; here it takes the row's width, which is what the drawing
       means at any other size. */
    .line {
      flex: 1 1 auto;
      min-width: 0;
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      color: #171717;
      overflow-wrap: anywhere;
    }
    .line:empty { display: none; }
    /* THE TWO-LINE BOX — a fixed height, no clamp property: the CUT is made in the string
       by _applyClamp (measured, with the ellipsis), so what the engine must honour is
       only overflow: hidden, and what the reader sees is decided by the measurement and
       nothing else. 40px = the .line's own 20px line-height, twice; they change together. */
    .line.clamped {
      height: 40px;
      overflow: hidden;
    }
    .bubble.expandable { cursor: pointer; }
    .bubble.expandable:hover { outline: 1px solid rgba(23, 23, 23, 0.14); }
    .bubble.expandable:focus-visible { outline: 2px solid #507274; outline-offset: 1px; }
    ::slotted(*) {
      flex: 1 1 auto;
      min-width: 0;
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      color: #171717;
    }
  `;

  render() {
    return html`
      <div
        class="bubble ${this._overflowing ? 'expandable' : ''}"
        data-node-id="40001119:6352"
        role=${this._overflowing ? 'button' : nothing}
        tabindex=${this._overflowing ? '0' : nothing}
        aria-expanded=${this._overflowing ? String(this.expanded) : nothing}
        title=${this._overflowing
          ? (this.expanded ? 'Click to collapse the question' : 'Click to show the whole question')
          : nothing}
        @click=${this._toggle}
        @keydown=${this._onKey}
      >
        <div class="mark" data-node-id="40001119:6353">
          <img src=${responseIcon} alt="" data-node-id="40001119:6354" />
        </div>
        <span
          class="line ${this.expanded ? '' : 'clamped'}"
          data-node-id="40001119:6358"
          ${ref((el) => { this._lineEl = (el as HTMLElement | undefined) ?? null; })}
        >${this.text}</span>
        <slot></slot>
      </div>
    `;
  }
}

if (!customElements.get('user-response-bubble'))
  customElements.define('user-response-bubble', UserResponseBubble);

declare global {
  interface HTMLElementTagNameMap {
    'user-response-bubble': UserResponseBubble;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'user-response-bubble': React.DetailedHTMLProps<
        React.HTMLAttributes<UserResponseBubble> & {
          text?: string;
          ref?: React.Ref<UserResponseBubble>;
        },
        UserResponseBubble
      >;
    }
  }
}
