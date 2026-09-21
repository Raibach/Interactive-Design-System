/**
 * <chat-action-bar> — the command strip under the thread.
 *
 * v.4b source (file 20UPR2KQMsbAxlo5NJb1se): "chat-input-menu" #40001119:6035 —
 * row, padding 10px 20px 20px, align centre, gap 9, on the #CBE6E3 ground the input
 * stack shares. It holds three things, left to right:
 *
 *   1. "send-to-model" #40001119:6370 — 127 wide, radius 6, fill
 *      rgba(255,255,255,0.5) with the "button drop" shadow (4px 4px 10px /
 *      -4px -4px 10px rgba(0,0,0,0.15), the file's own effect). Inside it, the
 *      send--alt mark #40001119:6380 (24×24) and the word "Send"
 *      (Inter Bold 700 / 16px) — both filled #64617F as of 2026-09-19, updated in the file.
 *   2. the four-dot grip #40001120:6644 — the same "Meatballs" the bars carry: a #CBE6E3
 *      strip 15 tall that FILLS the space between the two controls, and the handle the
 *      owner drags to size the input area. It is a row of its own; the first cut of this
 *      node nested it inside the send frame, which read as part of the button.
 *   3. "Function - loads cards form console in prompt area" #40001120:6641 — 126×35,
 *      the same pill and shadow, label "Console" (Inter Bold 700 / 16px, #838383).
 *
 * ONE CONTROL WITH TWO STATES, kept from the element's own contract: while a call is
 * in flight the pill shows the stop block instead of the arrow, and emits
 * stop-model-thinking. The v.4b drawing draws neither the stop state nor its colour,
 * so the block keeps its shape and takes the control's own #948FBA — recorded here
 * rather than left as a silent difference.
 *
 * The Models and "+" buttons that used to sit on this bar are NOT in the v.4b
 * drawing and are gone with it. Neither emitted anything, so nothing is lost but the
 * drawing is now the bar.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css, nothing } from 'lit';
import sendIcon from '@/assets/figma-send-alt-icon.svg';

export class ChatActionBar extends LitElement {
  static properties = {
    /** Label on the Models button. */
    modelLabel: { type: String, attribute: 'model-label' },
    /** A call is in flight — the one control shows stop instead of send. */
    busy: { type: Boolean },
    /** The input holds no text — send is disabled (`Disabled:` on state=send). */
    hasText: { type: Boolean, attribute: 'has-text' },
    /**
     * WHICH WAY THE TRAILING BUTTON POINTS — it is a switch between the two surfaces, and it
     * names the one you are NOT on:
     *   'agent'   (the console's seat)  → opens a new package, the composer's own control
     *   'console' (any package's seat)  → opens the console
     * The owner, 2026-09-19: "that same button on the composer is actually going to open the
     * console. So you would want to change the text to console." The default is the drawing's
     * own word, Agent, so a seat that has not been asked keeps what the design says.
     */
    trailing: { type: String },
  };

  declare modelLabel: string;
  declare busy: boolean;
  declare hasText: boolean;
  declare trailing: string;

  /**
   * THE TWO TRAILING BUTTONS ARE OFF THE BAR — Models and "+", together, on the owner's
   * instruction of 2026-09-19 ("you can remove the models on the horizontal drag for the
   * chat panel… we don't need those anymore: Models +" / "and the + he can remove the +").
   *
   * OFF, NOT GONE. The same session's rule for a removal: "don't remove any capabilities,
   * but we can just unhook them or disable them, comment them out so that they're still
   * there but then we can go back and change." Nothing was cut for this: `model-label`
   * still arrives, the two styles still describe the buttons, and this flag is the only
   * thing standing between the drawing and them. Flip it to true and the bar is as it was.
   */
  private _showModelAndAdd = false;

  constructor() {
    super();
    this.modelLabel = 'Models';
    this.busy = false;
    this.hasText = false;
    this.trailing = 'agent';
  }

  static styles = css`
    :host { display: block; }
    /* Figma "chat-input-menu" #40001119:6035 — the strip, on the input stack's own
       #CBE6E3 ground. No strokes and no shadow of its own in v.4b: the shadow
       belongs to the pills. */
    .bar {
      display: flex;
      align-items: center;
      /* The strip's own gap is 9 (#40001119:6035); the 35 is INSIDE the group, between the
         Send control and Console (#40001119:6212). Having both at 35 is what read as
         off balance. */
      gap: 9px;
      padding: 10px 20px 20px;
      background: #CBE6E3;
      font-family: 'Inter', system-ui, sans-serif;
    }
    /* #40001119:6212 — the Send control and Console, 35 apart. */
    .group {
      display: flex;
      align-items: center;
      gap: 35px;
    }
    /* #40001119:6359 — the strip's row: the Send pill, the grip, Console, 9 apart (the
       node's own gap; the 35 inside #40001119:6212 has nothing left to space, since that
       wrapper now holds only the Send pill). */
    .group {
      display: flex;
      align-items: center;
      gap: 9px;
      width: 100%;
    }
    /* THE SEND CONTROL IS ONE PILL — #40001119:6370: the label (#40001119:6376, 127 wide,
       padding 2px 12px, its row inset another 10px with a 14px gap between glyph and word).
       The owner, 2026-09-19: "look at the padding and how I have it aligned." */
    .pill {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 35px;
      box-sizing: border-box;
      border: none;
      border-radius: 6px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.5);
      box-shadow: 4px 4px 10px 0 rgba(0, 0, 0, 0.15), -4px -4px 10px 0 rgba(0, 0, 0, 0.15);
      font-family: inherit;
      font-size: 16px;
      font-weight: 700;
      /* THE CONTROL'S COLOUR, UPDATED 2026-09-19. The drawing now fills both the send--alt
         glyph (#40001119:6380) and the word "Send" (#40001119:6382) with #64617F; they were
         #948FBA when this element was built from the same nodes. One value, on the pill, so
         the icon and the label cannot disagree. */
      color: #64617F;
    }
    .send-label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 14px;
      width: 127px;
      height: 100%;
      box-sizing: border-box;
      padding: 2px 12px;
      border: none;
      background: none;
      font: inherit;
      color: inherit;
      cursor: pointer;
    }
    .send-label:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    /* The trailing button is a <button>, and a browser gives a button the ARROW unless the
       hand is asked for — so a control that acts looked inert under the pointer (owner,
       2026-09-19: "put up an indicator like a hand that'll show up when you hover over the
       agent button so the user knows that it's clickable"). The Send control never needed
       this line because its label is a button of its own with the cursor already on it. */
    .agent {
      width: 126px;
      padding: 0 12px;
      cursor: pointer;
    }
    /* MODELS AND "+" ARE NOT IN THE v.4b DRAWING AND STAY ANYWAY. They are functions
       (a model label the host sets, and the add control), and a function does not
       leave with a drawing (owner, 2026-09-19). They take the bar's new pill so the
       strip reads as one row; their own values are the ones already traced here —
       #4E68D2 for the Models label, #4066E3 and the 40px box for the "+" — never a
       colour invented for them. */
    .models { width: 126px; color: #4E68D2; }
    .add {
      width: 40px;
      height: 40px;
      padding: 0;
      color: #4066E3;
      font-size: 35px;
      font-weight: 500;
      line-height: 20px;
    }
    /* The Send/Console group — #40001119:6212 puts 35 between the two. */
    .group {
      display: flex;
      align-items: center;
      gap: 35px;
    }
    /* state=send, Disabled — empty input. */
    .pill:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
    /* The stop glyph — the frame's 20x18 rect, radius 2, in the control's own
       #948FBA (v.4b draws no stop state; see the header note). */
    .glyph-stop {
      width: 20px;
      height: 18px;
      border-radius: 2px;
      /* The stop block is not drawn in v.4b at all; it keeps the control's own colour so it
         follows the drawing when the drawing's colour moves (it just did: #948FBA → #64617F). */
      background: #64617F;
      display: inline-block;
    }
    /* The four-dot grip under Send — #40001120:6644, height 15, padding 5px 10px 10px,
       itemSpacing 10, primary CENTER, counter CENTER; the row it holds is #40001120:6645
       (HUG, padding 1px 2px, itemSpacing 4) with the dots at the same size and stroke as
       the bars' (2.16×2.05, 2px).
       Its class stays .gripper: that is the handle the pinned test drives by name, and
       the drag it witnesses is the same drag this element has always dispatched. */
    /* The grip: a #CBE6E3 strip 15 tall that FILLS the space between Send and Console
       (#40001120:6644), its dots centred - and the same row carries the drag. */
    .gripper {
      flex: 1 1 auto;
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 15px;
      padding: 5px 10px 10px;
      box-sizing: border-box;
      background: #CBE6E3;
      cursor: ns-resize;
    }
    /* THE HAND GETS MORE ROOM THAN THE DRAWING DOES. The drawn row is 15px tall (#40001120:6644:
       5px of padding, a 6px dot row, 10px under it), which is a small thing to catch under a
       moving hand — measured 127x15 in the running panel. This extends the hit area 12px
       DOWN into the strip's own padding: no drawn pixel moves, nothing else is covered, and
       the row becomes a 27px handle. */
    .gripper::after {
      content: '';
      position: absolute;
      left: 0;
      right: 0;
      top: 0;
      bottom: -12px;
    }
    /* The dot row hugs its dots (#40001120:6645) and the gripper centres it. */
    .gripper .row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 1px 2px;
      box-sizing: border-box;
    }
    .dot {
      display: block;
      width: 2.16px;
      height: 2.05px;
      border: 2px solid rgba(147, 58, 69, 0.5);
      border-radius: 50%;
      box-sizing: border-box;
    }
    .send-stack .pill img { pointer-events: none; }
  `;

  /**
   * The names this strip dispatches. Two of them are the design's own (`send-input-to-model`,
   * `stop-model-thinking`) and one is the annotated trailing button's
   * (`loads-cards-form-console-in-prompt-area`). `open-console` is the one name here with NO
   * note behind it yet — the second direction of that button, which the owner offered to draw
   * as a button of its own with its own annotation (2026-09-19). When that note lands, this
   * name follows it.
   */
  private _emit(type: 'send-input-to-model' | 'stop-model-thinking' | 'loads-cards-form-console-in-prompt-area' | 'open-console') {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }

  /**
   * The grip resizes the input area — the same drag the console seat has
   * (InteractiveChatInterface: mousedown records the origin, window mousemove
   * reports the delta, mouseup ends). This element is only the INPUT DEVICE;
   * the height and its clamps live in the parent, so it dispatches the three
   * phases and owns nothing.
   *
   * IT MUST LET GO, AND THAT IS WHAT THIS CODE IS SHAPED AROUND. The owner, 2026-09-19:
   * "the horizontal divider that you can drag up and down inside of the chat… it won't
   * let me release it. It holds onto my cursor." The divider sits above the input stack,
   * so dragging it DOWN pushes the pointer toward the bottom edge of the page — and a
   * release beyond the page fires NO mouseup anywhere, leaving the gesture tracking a
   * hand that is no longer holding anything.
   *
   * The teardown below is the SAME discipline the chat column's own spacer grip uses
   * (chat-panel, _onGripDown), for the same complaint and by the same reasoning:
   *   - no pointer capture. It was tried for this one case and cost more than it paid —
   *     a capture that outlives its pointer sends every later pointer event to this strip
   *     ("it hangs onto your cursor", 2026-09-18), so the page stops being grabbable.
   *   - the BOUNDARY is what tells us instead: crossing the page edge with no button down
   *     means the hand is empty, whether it just arrived or just left after letting go.
   *   - pointerup and pointercancel end it too, so a pointer that is cancelled (a gesture
   *     the browser took over) cannot leave it running.
   *   - and a press during a live gesture REPLACES it rather than stacking a second set of
   *     listeners on top, which is the other way this ends up unable to release.
   */
  private _dragging = false;
  private _moveHandler: ((e: MouseEvent) => void) | null = null;
  private _upHandler: (() => void) | null = null;
  private _boundaryHandler: ((e: MouseEvent) => void) | null = null;

  /** End the gesture, once, however it ended. Safe to call when nothing is running. */
  private _endDrag(): void {
    if (!this._dragging) return;
    this._dragging = false;
    const move = this._moveHandler;
    const up = this._upHandler;
    const boundary = this._boundaryHandler;
    if (move) document.removeEventListener('mousemove', move);
    if (up) {
      document.removeEventListener('mouseup', up);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
    }
    if (boundary) {
      document.removeEventListener('mouseout', boundary);
      document.removeEventListener('mouseover', boundary);
    }
    this._moveHandler = null;
    this._upHandler = null;
    this._boundaryHandler = null;
    this.dispatchEvent(new CustomEvent('input-resize-end', { bubbles: true, composed: true }));
  }

  private _startDrag(e: MouseEvent): void {
    this._endDrag();
    this._dragging = true;
    this.dispatchEvent(new CustomEvent('input-resize-start', {
      bubbles: true,
      composed: true,
      detail: { startY: e.clientY },
    }));
    this._moveHandler = (ev: MouseEvent) => {
      if (!this._dragging) return;
      this.dispatchEvent(new CustomEvent('input-resize-move', {
        bubbles: true,
        composed: true,
        detail: { clientY: ev.clientY },
      }));
    };
    this._upHandler = () => this._endDrag();
    this._boundaryHandler = (ev: MouseEvent) => {
      // A move inside the page, or a hand still holding the button: neither is a release.
      if (ev.relatedTarget || ev.buttons !== 0) return;
      this._endDrag();
    };
    document.addEventListener('mousemove', this._moveHandler);
    document.addEventListener('mouseup', this._upHandler);
    document.addEventListener('pointerup', this._upHandler);
    document.addEventListener('pointercancel', this._upHandler);
    document.addEventListener('mouseout', this._boundaryHandler);
    document.addEventListener('mouseover', this._boundaryHandler);
    e.preventDefault();
  }

  disconnectedCallback(): void {
    // An element taken off the page must not leave its listeners tracking a hand.
    this._endDrag();
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="bar">
        <div class="group">
          <!-- Figma "send-to-model" #40001119:6370 — the label is one control with two states:
                 state=send  idle   · glyph is the send arrow · On click: send-input-to-model
                 state=stop  busy   · glyph is the stop block · On click: stop-model-thinking
               Disabled on state=send: while the input is empty. -->
          <div class="pill send" data-node-id="40001119:6370">
            <button
              class="send-label"
              type="button"
              data-state=${this.busy ? 'stop' : 'send'}
              title=${this.busy ? 'Stop model thinking' : 'Send input to model'}
              aria-label=${this.busy ? 'Stop model thinking' : 'Send input to model'}
              ?disabled=${!this.busy && !this.hasText}
              @click=${() => this._emit(this.busy ? 'stop-model-thinking' : 'send-input-to-model')}
            >
              ${this.busy
                ? html`<span class="glyph-stop" aria-hidden="true"></span>`
                : html`<img src=${sendIcon} width="24" height="25" alt="" data-node-id="40001119:6380" />`}
              <span>${this.busy ? 'Stop' : 'Send'}</span>
            </button>
          </div>
          <!-- THE GRIP IS A ROW OF ITS OWN, BETWEEN THE TWO CONTROLS — the design as the
               owner corrected it (2026-09-19): #40001120:6644, a #CBE6E3 strip 15 tall that
               FILLS the space between the Send pill and Console, with the four dots centred
               in it. It sat inside the send frame in the first cut of this node, which read
               as part of the button; it is not, and it is not under the pill either — it is
               the divider between them, which is what it resizes. -->
          <div
            class="gripper"
            data-node-id="40001120:6644"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Drag to resize the input area"
            title="Drag to resize the input area"
            @mousedown=${this._startDrag}
          >
            <div class="row" data-node-id="40001120:6645" aria-hidden="true">
              <span class="dot" data-node-id="40001120:6646"></span><span class="dot" data-node-id="40001120:6647"></span><span class="dot" data-node-id="40001120:6648"></span><span class="dot" data-node-id="40001120:6649"></span>
            </div>
          </div>
          <!-- THE TRAILING BUTTON IS "AGENT" NOW (2026-09-19): the drawing's word for it is
               Agent (#I40001120:6642;40000973:24203) where it read "Console", and it is filled
               #64617F like Send rather than #838383 — so it shares the pill's colour and
               needs no value of its own.
               ITS ANNOTATION NOW EXISTS, on the frame it is drawn in (#40001120:6641), and
               this element already does the half it names for itself:
                 On click:  dispatch loads-cards-form-console-in-prompt-area   ← this dispatch
                 Connects:  loads the console's prompt packages into the left column   ← NOT BUILT
               Nothing in the app hears this event (checked 2026-09-19), so the button is a
               drawing and its click ends here. The missing half is the shell's: it owns both
               the console's packages (/console/cards) and the left column
               (/session/left_column/sections), so the load is its to perform — and which
               package it loads, and what becomes of one already in the column, is the design
               question that keeps it unbuilt.
               NOTE FOR THE AUDIT: this element is NOT in the allowlist, so the check that
               catches a dispatched-but-unheard event (event-unheard) never looks at it. A
               dead control here is invisible to the gate. -->
          <button
            class="pill agent"
            type="button"
            data-node-id="40001120:6641"
            title=${this.trailing === 'console' ? 'Console' : 'Agent'}
            aria-label=${this.trailing === 'console' ? 'Console' : 'Agent'}
            @click=${() => this._emit(this.trailing === 'console' ? 'open-console' : 'loads-cards-form-console-in-prompt-area')}
          >
            ${this.trailing === 'console' ? 'Console' : 'Agent'}
          </button>
        </div>
        <!-- MODELS AND "+" ARE UNHOOKED, NOT DELETED. The owner, 2026-09-19: "you can
             remove the models on the horizontal drag for the chat panel… we don't need
             those anymore: Models +" — off the bar, and kept the way he asked for removals
             earlier the same day: "don't remove any capabilities, but we can just unhook
             them or disable them, comment them out so that they're still there but then we
             can go back and change." So they are one flag away rather than gone:
             model-label still arrives from the seat (chat-panel binds it), the styles
             below still describe both buttons, and flipping _showModelAndAdd puts them
             back exactly as they were. -->
        ${this._showModelAndAdd
          ? html`<button class="pill models" type="button">${this.modelLabel}</button>
              <button class="pill add" type="button">+</button>`
          : nothing}
      </div>
    `;
  }
}

if (!customElements.get('chat-action-bar')) customElements.define('chat-action-bar', ChatActionBar);

declare global {
  interface HTMLElementTagNameMap {
    'chat-action-bar': ChatActionBar;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-action-bar': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatActionBar> & {
          'model-label'?: string;
          ref?: React.Ref<ChatActionBar>;
        },
        ChatActionBar
      >;
    }
  }
}
