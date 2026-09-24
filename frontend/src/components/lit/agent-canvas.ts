/**
 * <agent-canvas> — THE PLUG-IN, AS A CONTAINER: the drawing and her seat, as one place.
 *
 * A CONTAINER, NOT A WRAPPER. Its template holds SLOTS and nothing else, and the
 * ENVELOPE supplies what goes in them — the column's header into "header", the drawing
 * into "flow", her seat into "seat" — exactly as workspace-layout hosts its columns. That is the protocol's own model
 * (AGENTS-instructions/Core-Concept.md), and it is not a style preference:
 *
 *   "Children come from `explicitList` or `template` in the envelope — NEVER from markup
 *    inside a component's own template."
 *   "If you write a Lit element whose template renders another custom element, STOP.
 *    That is nesting. It is the wrong model."
 *   "Sub-pieces are internal to a parent element unless the model must emit them
 *    independently."
 *
 * An earlier revision of this file DID render <agent-flow> and <chat-panel> itself. It
 * worked, it passed every check in the catalog audit, and it was wrong: both are
 * components the model emits independently, so neither can be a sub-piece of this one,
 * and "surfaces cannot nest". This is the same idea in its compliant shape.
 *
 * WHAT IT OWNS is behaviour AROUND its slots, which is what a layout container owns:
 * the seat's column — its width, its motion, the gripper that sizes it and releases on
 * every channel — and the link between the two halves: a picked node marks the turn
 * about it and opens her, and a clicked turn brings its node into view. workspace-layout
 * sets the precedent for both: it lays out slots, and it writes `collapsed` back to the
 * panel it hosts.
 *
 * WHAT IT DOES NOT OWN: her bindings. conversation-id, session-id, the conversation list,
 * the prompt text and the token readout are the ENVELOPE's bindings on her seat. That is
 * what makes her a SURFACE SEAT rather than a host seat (Core-Concept.md, "Chat seat
 * identity"): a surface seat aggregates ONLY the calls made within its own conversation
 * and renders "unattributed" rather than borrowing another scope's numbers. A forwarding
 * wrapper would put this element in the middle of that contract, which is where it does
 * not belong.
 *
 * AND THE MENU IS THE PLACE. Her rail offers what the place you are in has: the surface
 * that emits this container declares the seat's allowed-tabs, so a package shows its own
 * runs, evals and versions, and the console — the only global seat — shows the approvals
 * that no single package can see. The narrowing is built into the place, not filtered at
 * the view.
 */
import { LitElement, html, css } from 'lit';
import type { AgentFlow } from './agent-flow';
import type { ChatPanel } from './chat-panel';

/**
 * The rail's width when she is away — the same floor workspace-layout uses, and for the
 * same reason: the column's own spacer sits inside it, so the floor is the rail PLUS the
 * spacer (74 + 30). At 74 the rail's labels were cut by the edge of the box that holds it.
 */
const SEAT_RAIL_PX = 104;
/** What an expand returns to, and the cap on a drag: the owner's 650 (2026-09-18). */
const SEAT_OPEN_PX = 650;
/** The widest a drag may take her, as a share of this element's own box. */
const SEAT_MAX_SHARE = 0.7;

export class AgentCanvas extends LitElement {
  static properties = {
    /** The drawing's tone. Empty is the mid-tone this design is drawn in; "dark" is the
     *  reference's near-black surface. It reaches the ground her column stands on, and
     *  the drawing takes it from its own place in the surface. */
    theme: { type: String, reflect: true },
    /** True when she is away and only the rail shows. The host's layout may set it (the
     *  container owns the width, so the flag lives here), and her rail and gripper write
     *  it too — they are the same fact. */
    collapsed: { type: Boolean, reflect: true },
    /** The seat's width in px while she is here, and whether a hand is on the gripper. */
    _seatPx: { state: true },
    _gripping: { state: true },
    /**
     * TRUE WHILE THE COLUMN IS STANDING WITH NO DRAWING IN IT YET — and the HOST is what says
     * so, because the host is what holds the drawing back.
     *
     * The column arrives before the picture does, and that gap is deliberate (the host's
     * RUN_DRAWING_HELD_MS): the model composes the column, the rows become nodes, the run's own
     * answers land. An empty pane through all of that says nothing about whether the
     * application is working — the owner's report of a Run was exactly that silence: "it's just
     * sitting there." So the column says it itself, on its own ground, for as long as it is true.
     *
     * NOT A CATALOG PROP, AND THAT IS WHY. It is not a fact about the drawing and the model
     * does not assemble it: it is this column's load state, written by the one thing that knows
     * when the drawing was published. A payload that never names it cannot clobber it, which is
     * the failure this repository keeps measuring when two writers share one flag.
     */
    holding: { type: Boolean, attribute: 'holding', reflect: true },
  };

  declare theme: string;
  declare collapsed: boolean;
  declare holding: boolean;
  declare private _seatPx: number;
  declare private _gripping: boolean;

  constructor() {
    super();
    this.theme = '';
    // SHE LOADS AWAY, with only the rail showing — the console's own default, and the
    // owner's instruction for this view. It is a REFLECTED property because the host's
    // layout may also set it, and a column that two things can move needs one place to
    // see it.
    this.collapsed = true;
    // AND IT OPENS HOLDING: the surface emitted this element, so the column exists, and
    // nothing has been drawn in it yet. It is cleared by whoever publishes a drawing.
    this.holding = true;
    this._seatPx = SEAT_OPEN_PX;
    this._gripping = false;
  }

  /** The drawing the envelope put in the "flow" slot, if it did. */
  private _drawing(): AgentFlow | null {
    return this.querySelector('agent-flow') as AgentFlow | null;
  }

  /** Her seat, from the "seat" slot. */
  private _seat(): ChatPanel | null {
    return this.querySelector('chat-panel') as ChatPanel | null;
  }

  // ── the seat's width ──────────────────────────────────────────────────────

  /** The width a pointer at `clientX` asks for, clamped to the rail and to the share. */
  private _widthFromPointer(clientX: number): number {
    const box = this.getBoundingClientRect();
    const max = Math.round(box.width * SEAT_MAX_SHARE);
    const wanted = Math.round(box.right - clientX);
    return Math.min(Math.max(SEAT_RAIL_PX, wanted), Math.max(SEAT_RAIL_PX, max));
  }

  /** The seat's width is ONE fact with two writers — the rail and the gripper — so both
   *  go through here, and it is visible to the host as a custom property on this element. */
  private _applySeatWidth(): void {
    const px = this.collapsed ? SEAT_RAIL_PX : this._seatPx;
    this.style.setProperty('--seat-w', String(Math.round(px)) + 'px');
  }

  // ── the place, as data ────────────────────────────────────────────────────

  /**
   * THE WORKSPACE, READ OFF THIS ELEMENT — what a package saves so the place comes back as
   * it was left: whether her column stood open and how wide, and where the drawing was
   * panned and zoomed.
   *
   * THE ELEMENT HOLDS IT; THE PACKAGE DOES NOT (owner, 2026-09-18: "I pan and zoom live
   * inside the bar… the element holds them, the package doesn't — that's a small contract,
   * the same kind"). So this only reports what is already true here; it writes nothing and
   * announces nothing. The drawing answers for itself, through its own viewState.
   */
  workspaceState(): {
    seat: { open: boolean; width: number };
    flow: { zoom: number; panX: number; panY: number } | null;
  } {
    const drawing = this._drawing();
    return {
      seat: { open: !this.collapsed, width: Math.round(this._seatPx) },
      flow: drawing ? drawing.viewState() : null,
    };
  }

  /**
   * PUT THE PLACE BACK. Same contract as the drawing's own: a partial record must not
   * rearrange anything, so each piece is checked before it is written, and a seat width is
   * clamped the way a grip would — except before first layout, when there is no box to
   * clamp against and clamping would collapse a wide column to the rail.
   *
   * The seat's openness lands through `collapsed`, which is the same fact the rail and the
   * gripper write: one fact, one place.
   */
  applyWorkspaceState(
    state:
      | {
          seat?: { open?: boolean; width?: number };
          flow?: { zoom?: number; panX?: number; panY?: number } | null;
          leftCollapsed?: boolean;
        }
      | null
      | undefined,
  ): boolean {
    if (!state) return false;
    const seat = state.seat;
    if (seat) {
      const box = this.getBoundingClientRect();
      if (typeof seat.width === 'number' && Number.isFinite(seat.width)) {
        const wanted = Math.max(SEAT_RAIL_PX, Math.round(seat.width));
        const max = Math.round(box.width * SEAT_MAX_SHARE);
        this._seatPx = box.width < 2 || max < SEAT_RAIL_PX
          ? wanted
          : Math.min(wanted, Math.max(SEAT_RAIL_PX, max));
      }
      if (typeof seat.open === 'boolean') this.collapsed = !seat.open;
      this._applySeatWidth();
    }
    const drawing = this._drawing();
    if (drawing) drawing.applyViewState(state.flow ?? null);
    return true;
  }

  /**
   * IS THIS THE SPACER'S GESTURE, OR THE INPUT AREA'S?
   *
   * Both grips inside her panel raise events called input-resize-start/move/end — the
   * spacer that drags this column's edge (clientX), and the grip under the composer that
   * resizes her input area (startY / clientY). They are different gestures on different
   * axes, and taking the wrong one moves a column nobody touched. Only the spacer carries
   * a horizontal position, so that is the test.
   */
  private _isSpacerGrip(e: Event): boolean {
    const d = ((e as CustomEvent).detail || {}) as { clientX?: unknown };
    return typeof d.clientX === 'number';
  }

  private _onGripStart = (e: Event): void => {
    if (!this._isSpacerGrip(e)) return;
    this._gripping = true;
    // Taking hold of the edge is a request for the column, so it opens first and the drag
    // then sizes it — the same rule workspace-layout paid for.
    this.collapsed = false;
    this._seatPx = this._widthFromPointer((e as CustomEvent).detail.clientX as number);
  };

  private _onGripMove = (e: Event): void => {
    // A move with no grip in progress is the tail of a gesture that already ended —
    // obeying it is how a released pointer keeps dragging a column.
    if (!this._gripping || !this._isSpacerGrip(e)) return;
    this._seatPx = this._widthFromPointer((e as CustomEvent).detail.clientX as number);
  };

  /** Let go of the gesture — on the panel's own end event, or on any channel that means
   *  the pointer is no longer down. Whichever arrives first wins; the rest are no-ops. */
  private _endGrip = (): void => {
    if (!this._gripping) return;
    this._gripping = false;
    // Let go at the floor → collapsed, so the grip is one control in both directions.
    if (this._seatPx <= SEAT_RAIL_PX + 2) this.collapsed = true;
  };

  // ── the rail ──────────────────────────────────────────────────────────────

  /** The rail asked for a state. It is the same fact as the width, so it lands here. */
  private _onCollapseToggle = (e: Event): void => {
    this.collapsed = Boolean((e as CustomEvent).detail?.collapsed);
  };

  /** ANY tab is a request to look, so the column opens. The event is hers (the panel
   *  switches its own view); this answers the width half of it. */
  private _onTabChange = (): void => {
    this.collapsed = false;
  };

  // ── the link, in both directions ──────────────────────────────────────────

  /**
   * A NODE PICKED ON THE DRAWING IS A TURN IN HER THREAD.
   *
   * Selecting a node opens her and marks the turn about it, and she says what the node is
   * in her status line. The chat is the SECONDARY thing here — the person is here to
   * build, and the conversation is what a node has to say when they touch one (owner,
   * 2026-09-18: "selecting a node opens the chat and reveals that response").
   */
  private _onFlowSelect = (e: Event): void => {
    const nodeId = ((e as CustomEvent).detail?.nodeId as string) ?? null;
    const seat = this._seat();
    if (!seat) return;
    const messages = seat.shadowRoot?.querySelector('chat-messages') as
      | (HTMLElement & { highlightNodeId?: string | null })
      | null;
    if (messages) messages.highlightNodeId = nodeId;
    if (!nodeId) return;
    this.collapsed = false;
    const node = (this._drawing()?.flow?.nodes ?? []).find((n) => n.id === nodeId);
    if (node) seat.statusText = `${node.title} | ${node.kind} — State: ${node.state}`;
  };

  /** And the other half: a turn clicked is a node brought into view. */
  private _onTurnClick = (e: Event): void => {
    const nodeId = ((e as CustomEvent).detail?.nodeId as string) ?? null;
    if (nodeId) this._drawing()?.focusNode(nodeId);
  };

  connectedCallback(): void {
    super.connectedCallback();
    // THE GESTURE ENDS ON EVERY CHANNEL, not only on the panel's own end event: a pointer
    // released outside the window, a cancelled pointer, a window that loses focus — any
    // of them means the hand is off the gripper. Measured in the page this grew out of:
    // without these, a released pointer kept dragging the column.
    window.addEventListener('pointerup', this._endGrip);
    window.addEventListener('mouseup', this._endGrip);
    window.addEventListener('pointercancel', this._endGrip);
    window.addEventListener('blur', this._endGrip);
    // The events are the children's own, composed up through the slots this container
    // exposes. Nothing here re-dispatches them: the surface's listeners still hear every
    // one of them unchanged, including the ones this element answers.
    this.addEventListener('input-resize-start', this._onGripStart as EventListener);
    this.addEventListener('input-resize-move', this._onGripMove as EventListener);
    this.addEventListener('input-resize-end', this._endGrip as EventListener);
    this.addEventListener('collapse-toggle', this._onCollapseToggle as EventListener);
    this.addEventListener('tab-change', this._onTabChange as EventListener);
    this.addEventListener('flow-select', this._onFlowSelect as EventListener);
    this.addEventListener('turn-click', this._onTurnClick as EventListener);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('pointerup', this._endGrip);
    window.removeEventListener('mouseup', this._endGrip);
    window.removeEventListener('pointercancel', this._endGrip);
    window.removeEventListener('blur', this._endGrip);
    this.removeEventListener('input-resize-start', this._onGripStart as EventListener);
    this.removeEventListener('input-resize-move', this._onGripMove as EventListener);
    this.removeEventListener('input-resize-end', this._endGrip as EventListener);
    this.removeEventListener('collapse-toggle', this._onCollapseToggle as EventListener);
    this.removeEventListener('tab-change', this._onTabChange as EventListener);
    this.removeEventListener('flow-select', this._onFlowSelect as EventListener);
    this.removeEventListener('turn-click', this._onTurnClick as EventListener);
  }

  protected updated(): void {
    this._applySeatWidth();
    // THE FIRST PAINT IS AN ARRIVAL, NOT A GESTURE — see the .seat rule above. Two frames, so
    // the settled width is on screen before the transition is switched on: what the person then
    // sees move is their own click, and the canvas they pressed Run for is simply there.
    if (!this.hasAttribute('arrived')) {
      requestAnimationFrame(() => requestAnimationFrame(() =>
        this.isConnected && this.setAttribute('arrived', '')));
    }
  }

  /** The drawing's own fit, for a host that wants it. */
  fit(): void {
    this._drawing()?.fit();
  }

  /** Bring a node into view, by id. */
  focusNode(nodeId: string): void {
    this._drawing()?.focusNode(nodeId);
  }

  render() {
    return html`
      <!-- THE SLOTS ARE THE SURFACE'S. The envelope puts the column's header in
           "header", the drawing in "flow" and her seat in "seat" (see the head of this
           file). This template draws no component: an element that renders another
           element is nesting, and a surface cannot nest. -->
      <div class="head">
        <slot name="header"></slot>
      </div>

      <div class="stage">
        <slot name="flow"></slot>
        <!-- THE COLUMN SAYS IT IS WORKING, ON ITS OWN GROUND — the whole of what it says while
             the drawing is held back, and it says it where the picture will be. In the DOM
             always and moved by CSS, so it FADES in and out (see .holding): a block that appears
             and is removed in one frame reads as a glitch, which is the report this answers. -->
        <div class="holding" role="status" aria-live="polite">
          <div class="spinner" aria-hidden="true"></div>
          <p>Assembling the drawing…</p>
        </div>
      </div>

      <!-- THE FOOT IS THE COLUMN'S TOO, for the same reason the header is: a Run replaces
           what is under it, and whatever the place keeps at the foot must survive that. -->
      <div class="foot">
        <slot name="footer"></slot>
      </div>

      <!-- NO SEAT IS DRAWN HERE, AND THAT IS THE POINT.
           This element used to render an <aside class="seat"> with a "seat" slot, and the Run
           moved her panel into it — which is what replaced her container and lost the thread.
           The owner, 2026-09-18: "there's no difference between the canvas Grace and the
           new-package Grace… no reason to replace anything." The canvas is the drawing; her
           column is hers and is never a child of this element. The seat styles and the width
           state below are left in place but are inert now — removing them is a cleanup, not a
           behaviour, and an empty absolutely-positioned aside left here would have covered the
           right third of the drawing and eaten its clicks. -->
    `;
  }

  static styles = [
    css`
      /* No backticks in this stylesheet: it is a tagged template literal, and one raw
         backtick ends it. tsc will not say so; esbuild will. */

      /* THE GROUND BESIDE HER IS THE DRAWING'S OWN COLOUR, and these two values are a
         deliberate COPY of the canvas's own surface tokens (agent-flow.ts's :host block:
         light #837b8c, dark #26242e) rather than an import — the element in the other
         slot cannot be read from here, and a seam of two near-identical greys is worse
         than a value that must be kept in step. Her panel takes it as --chat-ground, so
         the column reads as one surface with the drawing. */
      :host {
        display: block;
        position: relative;
        height: 100%;
        min-height: 0;
        /* THE COLUMN IS A COLUMN: the header takes its own height at the top, the
           drawing fills what is left, and her seat lies over BOTH (the design draws the
           header's row inside the column, and her column covers the column's right side
           top to bottom). No backticks in this block: it is a css literal. */
        display: flex;
        flex-direction: column;
        --flow-ground: #837b8c;
        background: var(--flow-ground);
      }
      :host([theme='dark']) { --flow-ground: #26242e; }

      /* THE COLUMN ARRIVES — IT DOES NOT SLAP.
       *
       * It is assembled while the person waits and then it MOUNTS, and a mount is one frame: the
       * owner, 2026-09-23, watching a Run — "now the canvas slams into the interface and slaps the
       * user in the face. Can you please put a slow fade in on the canvas after it's assembled?"
       *
       * So the whole column fades up on its first paint — the ground, its header, the drawing and
       * its foot together, as one object — on the application's own curve and duration
       * (--dur-pane and --ease-settle in workspace-layout's stylesheet, copied here for the reason
       * the ground above is copied: that element is in another bundle), and the pane's own waiting
       * state fades out underneath it over the same time, so the two cross rather than swap.
       *
       * ONCE PER MOUNT, which is once per Run: a second Run reuses the element (the assembly
       * updates it by id) and the drawing changes in place, which is the run's output changing, not
       * the column arriving. */
      @keyframes canvas-arrives {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      :host {
        animation: canvas-arrives 760ms cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      /* Motion is a courtesy, never a requirement. */
      @media (prefers-reduced-motion: reduce) {
        :host { animation: none; }
      }

      /* THE HEADER BAND. Empty it takes no height, so a surface that fills only the two
         drawing slots lays out exactly as it did before this slot existed.
         THE INSETS ARE THE DESIGN'S, taken from the column the header belongs to:
         "right-panel-horiz-tab" 40000909:4085 is padding 10px 10px 23px, so its first
         child sits 10px in — the same place the header occupies in the output view. */
      .head { flex: 0 0 auto; padding: 10px 10px 0; box-sizing: border-box; }
      .head ::slotted(*) { display: block; width: 100%; }

      /* The drawing fills what the header and the foot leave; her seat is laid OVER the
         lot, so nothing about the canvas moves when she comes and goes. */
      .stage { flex: 1 1 auto; min-height: 0; position: relative; }
      /* Empty it takes no height, so a surface that fills neither band lays out exactly as
         it did before the slots existed. */
      .foot { flex: 0 0 auto; }
      .foot ::slotted(*) { display: block; width: 100%; }
      .stage ::slotted(*) { display: block; width: 100%; height: 100%; }

      /* WHILE IT IS BEING ASSEMBLED, THE COLUMN IS THE ROOM'S — NOT A SLAB OF COLOUR.
         The ground below is what the drawing stands on, and it is opaque on purpose (a picture
         needs a surface). But before there IS a picture, an opaque panel covers the thing the
         person is standing in front of: the owner, 2026-09-23, watching a Run assemble — "it's
         got an assembly that's happening on top of a solid fill. It should be transparent. I
         should be able to see the background while it's assembling the canvas."
         So the hold is see-through: his background shows, the spinner and its one line sit on it,
         and the ground arrives with the picture — which is also the moment the column stops being
         a waiting room and becomes the canvas. */
      :host([holding]) { background: transparent; }

      /* THE HELD STATE — the column before its drawing, and the fade is half of it.
         It stands ON THE GROUND the drawing will stand on (the host's own --flow-ground, which
         this element paints), so the column does not change colour when the picture arrives:
         the picture fills the same ground and the spinner leaves over it.
         IN THE DOM ALWAYS, moved by the host's attribute and by CSS, because a hidden state is
         what makes a fade possible at all — the same mechanism, and the same reason, as the chat
         panel's own collapse (opacity and visibility, with the visibility DELAYED on the way
         out so the fade is seen and the element stops taking clicks only at the end). */
      .holding {
        position: absolute;
        inset: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 18px;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition:
          opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
          visibility 0s linear 420ms;
      }
      :host([holding]) .holding {
        opacity: 1;
        visibility: visible;
        transition:
          opacity 420ms cubic-bezier(0.22, 1, 0.36, 1),
          visibility 0s linear 0s;
      }
      .holding p {
        margin: 0;
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 14px;
        font-weight: 500;
        /* THE SAME MUTED TONE THE OUTPUT COLUMN SPEAKS IN, so the two columns' waits read as
           one application rather than two. */
        color: rgba(255, 255, 255, 0.72);
      }
      :host(:not([theme='dark'])) .holding p { color: #3f3a46; }
      .spinner {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid rgba(255, 255, 255, 0.22);
        border-top-color: rgba(255, 255, 255, 0.85);
        animation: holding-spin 900ms linear infinite;
      }
      :host(:not([theme='dark'])) .spinner {
        border-color: rgba(0, 0, 0, 0.14);
        border-top-color: rgba(0, 0, 0, 0.55);
      }
      /* NOTHING TURNS WHILE NOTHING IS BEING SAID — the spinner is only a spinner when the
         column is holding, so a column with a drawing in it costs no animation frames. */
      :host(:not([holding])) .spinner { animation: none; }
      @keyframes holding-spin {
        to { transform: rotate(360deg); }
      }
      /* Motion is a courtesy, never a requirement. The spinner still turns only because a still
         frame cannot say "working"; the fade is what this drops. */
      @media (prefers-reduced-motion: reduce) {
        .holding, :host([holding]) .holding { transition: none; }
      }

      .seat {
        position: absolute; top: 0; right: 0; bottom: 0; z-index: 2;
        width: var(--seat-w, 650px);
        display: flex; flex-direction: column;
        background: transparent;
        /* IT ARRIVES, IT DOES NOT SNAP — the application's own pane motion, whose comment
           is the reason: ease accelerates and stops, so it lands like a slap; this curve
           leaves fast and decelerates hard into the stop. The values are
           workspace-layout's, copied deliberately rather than imported, because that
           element is not in this bundle. */
        transition: width 520ms cubic-bezier(0.22, 1, 0.36, 1);
      }
      /* NOT ON THE WAY IN. A canvas that mounts collapsed and is handed "open" one frame later
         animates 104px -> 650px while the panes are ALSO rebalancing, so the person sees the
         right side pulled in toward the middle and then sliding back out — the owner's report,
         2026-09-18: "when I hit run it's kind of starting in the middle… instead of moving to
         the right, it's pulling the right side in towards the middle, then sliding itself to
         the right."
         The element is not the right thing to animate on its first paint: its opening state is
         where it BEGINS, not a movement. The arrived attribute is set once, after the first paint, so
         the motion belongs to the person's own gestures — the rail and the gripper — and only
         to those. */
      :host(:not([arrived])) .seat { transition: none; }
      /* EXCEPT WHILE A HAND IS ON THE GRIPPER. Every pointermove writes a new width, and
         easing each one makes the column chase the cursor — the owner's report of
         2026-09-18, and the reason the motion belongs to the BUTTONS and to nothing else.
         workspace-layout learned this first; this element inherits the rule. */
      .seat.gripping { transition: none; }

      /* NO display OVERRIDE on the slotted panel, deliberately: she lays herself out as a
         flex column, and forcing display:block collapsed her thread to zero height —
         every turn present and none of them visible. */
      .seat ::slotted(*) { flex: 1 1 auto; min-height: 0; --chat-ground: var(--flow-ground); }

      /* Motion is a courtesy, never a requirement. */
      @media (prefers-reduced-motion: reduce) {
        .seat { transition: none; }
      }
    `,
  ];
}

if (!customElements.get('agent-canvas')) customElements.define('agent-canvas', AgentCanvas);

declare global {
  interface HTMLElementTagNameMap {
    'agent-canvas': AgentCanvas;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'agent-canvas': React.DetailedHTMLProps<
        React.HTMLAttributes<AgentCanvas> & {
          ref?: React.Ref<AgentCanvas>;
        },
        AgentCanvas
      >;
    }
  }
}
