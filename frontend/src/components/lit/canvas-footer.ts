/**
 * <canvas-footer> — the strip at the foot of the canvas column.
 *
 * Figma source: the ControlBar master — "left-column-control bar" node 40000761:261,
 * instance 40001096:3241. Its numbers, read from the master and not re-invented:
 * 70px high, fill #B5CCCE, bottom-right radius 10, padding 13px 38px, gap 10, and three
 * button treatments — the gold-gradient primary (43px, radius 6, the drop shadow, Inter
 * ExtraBold 18 black), the white secondary (43px, Inter Bold 16 #5A5A5A), and the chip
 * (the secondary's clothes at a smaller size, so a bar keeps one voice).
 *
 * WHY IT EXISTS. This row was drawn first as the standalone playground's own chrome — a
 * page's markup, loaded by nothing else, and therefore unavailable to the application. So
 * the canvas view in the app had no foot at all, and no tone switch with it: the owner's
 * report, 2026-09-18 — "we have lost controls at the bottom… I don't know where the dark
 * mode / light mode options are, they've disappeared." It is a CATALOG COMPONENT now, so
 * any surface that draws the canvas can carry the same foot.
 *
 * CONTENTS. A `slot` for the host's own controls (a page may put undo, save, play — whatever
 * the place needs) and the TONE SWITCH, which is the canvas's own property: the drawing
 * ships a mid-tone and a dark surface, and this is what chooses between them.
 *
 * IT EMITS, IT DOES NOT REACH. `theme-change` carries {theme: '' | 'dark'} and the HOST
 * writes it onto the drawing — a footer does not know where the canvas is, and an element
 * that reached across the tree to restyle a sibling would be the wrong model twice over.
 */
import { LitElement, html, css } from 'lit';

export class CanvasFooter extends LitElement {
  static properties = {
    /** The tone the drawing is currently in. '' is the mid-tone this design is drawn in. */
    theme: { type: String, reflect: true },
    /** True while the host's run is in flight — the play control is disabled, so a second
     *  press cannot start a second run. */
    running: { type: Boolean, reflect: true },
    /** True while the host's SAVE is in flight — the save control shows a spinner and is
     *  disabled until the host clears this. Set from the host's own save call (its
     *  finally), never by a timer and never with a minimum display time: the owner,
     *  2026-09-21 — "it's not got a spinner like the other buttons… to let the user know
     *  it's doing something." */
    saving: { type: Boolean, reflect: true },
    /** What the save control reads once the host has saved. Empty reads "Save". */
    savedLabel: { type: String, attribute: 'saved-label' },
  };

  declare theme: string;
  declare running: boolean;
  declare saving: boolean;
  declare savedLabel: string;

  constructor() {
    super();
    this.theme = '';
    this.running = false;
    this.saving = false;
    this.savedLabel = '';
  }

  /** Every control here SPEAKS; none of them acts. What a run, a reset or a save means is
   *  the host's business — this bar is the place's controls, not the place. */
  private _emit(name: string, detail: Record<string, unknown>): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  /** One control, two states: the labels name what you are choosing, not what you have. */
  private _choose(theme: string): void {
    if (theme === this.theme) return;
    this.dispatchEvent(new CustomEvent('theme-change', {
      bubbles: true,
      composed: true,
      detail: { theme },
    }));
  }

  render() {
    /* ── ANNOTATION — PROPOSED 2026-09-18, TO BE TRANSFERRED TO FIGMA ────────────────
       Written in the design's own field vocabulary because the master's frame carries no
       annotation for this placement (owner: "you can add the annotation and then later I
       will transfer those to the Figma file"). Until it is moved into the frame, the
       catalog checker — which reads annotations from FIGMA — still reports these nodes as
       unannotated. This text is a proposal, not a trace.

       "canvas-footer" — the canvas column's foot, built from 40000761:261.
         Data:     the tone the drawing is in ('' mid-tone | 'dark')
         On click: the ONE tone control toggles to the other mode — it reads "Dark mode"
                   while the drawing is light and "Light mode" while it is dark, so the
                   button always names what pressing it does, never what you already have
                   (owner, 2026-09-18: "it's a toggle basically")
         State:    idle — one control, no selected/unselected pair to keep in step
         A11y:     its own label is the mode it would switch to; the drawing's current tone
                   is carried on the host as `theme`, so nothing has to be inferred

       "canvas-play" #canvas-play — the primary treatment, the master's own.
         Data:     the run this place would make
         On click: canvas-play {source: 'canvas-footer'}
         State:    idle | busy (the host's run state, passed down as `running`) — and busy
                   is now DRAWN, not only disabled: a spinner and "Running…", the same shape
                   the Save control beside it has. The owner, 2026-09-23: "there's no spinner
                   … you need to put a spinner on the stop button or on the run button so
                   that a user knows there's activity." The disabled attribute alone said
                   nothing a person could see — and the button it was saying it on was the
                   one that had just folded away with the prompt.
         A11y:     disabled while running, so a second press cannot start a second run; the
                   label is the state, and it is announced (aria-live) as it changes

       "canvas-reset" #canvas-reset — the secondary treatment.
         Data:     the view this column is showing
         On click: canvas-reset {} — put the column back to its own output
         State:    idle
         A11y:     an ordinary button; nothing is destructive

       "canvas-save" #canvas-save — the secondary treatment.
         Data:     the package: its prompt and its last output
         On click: canvas-save {} — the host saves, and it may say when it last did
         State:    idle | saving | saved (the host sets `saving` for exactly as long as
                   the write is in flight, and `savedLabel` when it has just saved)
         A11y:     an ordinary button; while saving it is disabled and its label reads
                   "Saving…", so the state is spoken as well as drawn
    ─────────────────────────────────────────────────────────────────────────────── */
    return html`
      <div class="bar">
        <!-- IDS ARE THE JOIN KEYS. Every control carries one, because the catalog audit,
             the Figma map and this element all have to agree about WHICH control they
             mean — and the annotation above is what the design gets until it has its own. -->
        <button
          id="canvas-play"
          class="primary"
          type="button"
          ?disabled=${this.running}
          aria-live="polite"
          @click=${() => this._emit('canvas-play', { source: 'canvas-footer' })}
        >${this.running
            ? html`<span class="spin" aria-hidden="true"></span>Running…`
            : html`▶ Play the run`}</button>
        <button
          id="canvas-reset"
          class="secondary"
          type="button"
          @click=${() => this._emit('canvas-reset', {})}
        >⟲ Reset</button>
        <button
          id="canvas-save"
          class="secondary"
          type="button"
          ?disabled=${this.saving}
          @click=${() => this._emit('canvas-save', {})}
        >${this.saving
            ? html`<span class="spin" aria-hidden="true"></span>Saving…`
            : this.savedLabel || 'Save'}</button>
        <slot></slot>
        <span class="tone">
          <button
            id="canvas-theme"
            class="chip"
            type="button"
            aria-label=${this.theme === 'dark' ? 'Switch the canvas to light mode' : 'Switch the canvas to dark mode'}
            @click=${() => this._choose(this.theme === 'dark' ? '' : 'dark')}
          >${this.theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>
        </span>
      </div>
    `;
  }

  static styles = css`
    /* No backticks in this stylesheet: it is a tagged template literal, and one raw
       backtick ends it. tsc will not say so; esbuild will. */

    :host { display: block; flex: 0 0 auto; }

    /* "left-column-control bar" 40000761:261 — the master's own numbers.
       BUTTONS AT THE LEFT, and that is deliberate: the strip spans the column's full width
       and her seat can lie over its right-hand end, so the controls live where nothing can
       ever cover them. justify-content is the only thing read from the other end. */
    .bar {
      display: flex; align-items: center; justify-content: flex-start; gap: 10px;
      height: 70px;                                    /* 40000761:261 h-[70px] */
      padding: 13px 38px;                              /* 40000761:261 p-[13px_38px] */
      box-sizing: border-box;
      background: #B5CCCE;                             /* 40000761:261 fill */
      border-radius: 0 0 10px 0;                       /* 40000761:261 rounded-br-[10px] */
    }

    /* THE MASTER'S TWO TREATMENTS this bar uses — 40000761:261/:267/:269.
       primary: 43px, radius 6, the gold gradient, the drop shadow, Inter ExtraBold 18
       black. secondary: 43px, radius 6, white, the same shadow, Inter Bold 16 #5A5A5A. */
    .bar button {
      font-family: 'Inter', system-ui, sans-serif;
      height: 43px; padding: 0 18px;
      border: none; border-radius: 6px; cursor: pointer;
      box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25), -4px -4px 10px 0px rgba(0, 0, 0, 0.15);
    }
    .bar button.primary {
      font-size: 18px; font-weight: 700; color: #000000;
      background: linear-gradient(-90deg, rgba(240, 180, 36, 1) 0%, rgba(254, 209, 65, 1) 100%);
    }
    .bar button.primary:disabled { opacity: 0.5; cursor: default; }
    .bar button.secondary {
      padding: 0 15px;
      font-size: 16px; font-weight: 700; color: #5A5A5A; background: #FFFFFF;
    }
    .bar button.secondary:disabled { opacity: 0.5; cursor: default; }

    /* THE SAVE CONTROL'S SPINNER — the same mark the rest of the app uses for work in
       flight, at the secondary's own grey. It turns only while the host reports saving;
       under reduced motion it holds still as a partial ring, which still reads as
       "working" without moving. */
    .spin {
      display: inline-block; width: 12px; height: 12px; margin-right: 8px;
      border: 2px solid rgba(90, 90, 90, 0.3);
      border-top-color: #5A5A5A;
      border-radius: 50%;
      vertical-align: -2px;
      animation: canvas-footer-turn 700ms linear infinite;
    }
    @keyframes canvas-footer-turn { to { transform: rotate(360deg); } }
    /* THE PLAY CONTROL'S SPINNER WEARS THE BUTTON'S OWN INK. The grey above is for the Save
       control on white; the primary is the yellow master whose label is black, and a grey
       spinner on it reads as a smudge rather than as work. */
    .bar button.primary .spin {
      border-color: rgba(0, 0, 0, 0.25);
      border-top-color: #000000;
    }
    @media (prefers-reduced-motion: reduce) {
      .spin { animation: none; }
    }

    /* THE TONE SWITCH SITS WITH THE OTHER CONTROLS, AT THE LEFT — and that is not
       tidiness. The bar spans the column's full width and HER SEAT LIES OVER ITS RIGHT
       END, so a control parked at the right is a control nobody can see: measured
       2026-09-18, the owner — "so I don't see dark and light mode still" — while the
       shadow DOM said both buttons were there and 84-97px wide. They were underneath her.
       The same rule the playground's chrome learned first: read the master's order from
       the other end when something can cover one of them. */
    .tone { display: inline-flex; gap: 14px; }

    /* THE MASTER'S SECONDARY, at the chip's size — one voice for the whole bar. */
    .chip {
      font-family: 'Inter', system-ui, sans-serif;
      height: 32px; padding: 0 10px;
      font-size: 13px; font-weight: 700; color: #5A5A5A;
      background: #FFFFFF;
      border: none; border-radius: 6px; cursor: pointer;
      box-shadow: 0px 4px 4px 0px rgba(0, 0, 0, 0.25), -4px -4px 10px 0px rgba(0, 0, 0, 0.15);
    }
    .chip[aria-pressed='true'] { outline: 2px solid #507274; outline-offset: 1px; }
  `;
}

if (!customElements.get('canvas-footer')) customElements.define('canvas-footer', CanvasFooter);

declare global {
  interface HTMLElementTagNameMap {
    'canvas-footer': CanvasFooter;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'canvas-footer': React.DetailedHTMLProps<
        React.HTMLAttributes<CanvasFooter> & { ref?: React.Ref<CanvasFooter> },
        CanvasFooter
      >;
    }
  }
}
