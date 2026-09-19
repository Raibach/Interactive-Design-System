/**
 * <workspace-layout> — Lit resizable 3-column workspace (A2UI v0.9.1)
 *
 * Responsive flex baseline: the columns share space via flex-grow and squish
 * with the browser (the browser is the hard limit — nothing pushes past its
 * edges). The middle column (compiled output) always flexes; it never holds a
 * fixed width, so it can't push the stage to the right.
 *
 * The 60px left rail and 60px chat floor are COLLAPSED widths. They only
 * engage while the user drags the gripper to dock/collapse a column — they are
 * minimums, not fixed widths, so the expanded layout stays fully responsive.
 *
 * Named slots:
 *   - slot="left"   — prompt-section-editor
 *   - slot="middle" — compiled-output-viewer
 *   - slot="right"  — chat-panel (or other right column content)
 *
 * Events:
 *   resize-start, resize, resize-end, third-column-toggle
 *
 * The React shell (WritingAreaIndex) hosts the surface that emits this — it binds
 * nothing on it. Which panes exist is the SURFACE's tree: this element reads its own
 * slots, so it draws a middle column when the surface put something in it.
 */

import { LitElement, html, css, nothing } from 'lit';

export class WorkspaceLayout extends LitElement {
  static properties = {
    // noAccessor on BOTH column flags, for the same reason spelled out under
    // isThirdOpen's accessor: a write from the payload and a write from the
    // operator have to be told apart, and a hand-written accessor is where that
    // distinction lives.
    isThirdOpen: { type: Boolean, attribute: 'is-third-open', noAccessor: true },
    leftCollapsed: { type: Boolean, attribute: 'left-collapsed', reflect: true, noAccessor: true },
  };

  /**
   * THE LEFT COLUMN, SAME LAW AS THE RIGHT: the payload may set it, the operator
   * owns it after that, and the element itself can always change it.
   *
   * This was a plain reflected property, so anyone could write it — including the
   * renderer re-assigning every prop on every data-model update. The left column is
   * the prompt a person is READING; a telemetry tick snapping it shut under their
   * hands is the same failure the right column already had measured and fixed.
   */
  private _leftCollapsed = false;

  /** Has the operator (or a Run) taken the left pane's state out of the payload's hands? */
  private _leftOwnedByOperator = false;

  get leftCollapsed(): boolean {
    return this._leftCollapsed;
  }

  set leftCollapsed(next: boolean) {
    if (this._leftOwnedByOperator) return; // decided already — a payload re-assert loses
    this._setLeftCollapsed(next);
  }

  /** Change the state from INSIDE: the dock, the grip, or a Run. */
  private _setLeftCollapsed(next: boolean): void {
    if (this._leftCollapsed === next) return;
    const previous = this._leftCollapsed;
    this._leftCollapsed = next;
    this.requestUpdate('leftCollapsed', previous);
  }

  /**
   * IS THERE ANYTHING IN THE MIDDLE PANE? Read from the slot, never sent.
   *
   * This was a `showMiddle` prop, defaulting to false with the note "composer starts
   * 2-column until Run produces output" — and NOBODY EVER SET IT: not the shell, not a
   * prompt, not the backend. So it was permanently false, and the middle pane had been
   * 0px wide with `compiled-output-viewer` inside it since the surface took ownership:
   * the output column could not display, whatever the surface emitted. Measured
   * 2026-09-17 — the composer's tree carried the viewer, the pane measured 0.
   *
   * The content decides, which is also the only thing that can be true for both seats:
   * the composer emits a middle child, the console emits none. One home per fact.
   */
  private _hasMiddle = false;

  /** The third column's open state. See the accessor below for who may change it. */
  private _isThirdOpen = true;

  /** Has the operator taken this pane's open state? */
  private _openOwnedByOperator = false;

  /**
   * THE PAYLOAD SETS THIS ONCE. THE OPERATOR OWNS IT AFTER THAT.
   *
   * `isThirdOpen` is the one flag on this element a person can also change: the
   * rail's Chat button, any rail tab click, and the gripper all flip it. The surface
   * sends it too, and has to — the console's chat column must LOAD closed while the
   * composer's loads open, and that flag is the only thing telling the two apart.
   *
   * So the two fight, and without this the payload wins every time, because the
   * renderer re-assigns a component's props whenever the DATA MODEL changes — not
   * only when a new assembly lands. Measured 2026-09-17 on the console: a Trace
   * click opened the column to 726px, one trace update landed, and it snapped back
   * to 74px with the view inside it. Nothing was wrong with the click.
   *
   * The write is therefore split. A payload assignment is honoured until the
   * operator touches the pane; after that it is ignored, and only this element
   * changes the state — through _setThirdOpen, which is also what marks the
   * ownership. "Open or closed belongs to the element that owns the width" has to
   * mean this in code, or it is only a comment, and the flag is re-asserted on every
   * assembly and every model update.
   */
  get isThirdOpen(): boolean {
    return this._isThirdOpen;
  }

  set isThirdOpen(next: boolean) {
    if (this._openOwnedByOperator) return; // the operator has decided — a re-assert
    if (this._isThirdOpen === next) return; // already there
    const previous = this._isThirdOpen;
    this._isThirdOpen = next;
    this.requestUpdate('isThirdOpen', previous);
  }

  /**
   * Change the state from INSIDE this element: an operator gesture, or the rail
   * asking for a column. Marks the pane operator-owned, so no later payload
   * assignment can undo it.
   */
  private _setThirdOpen(next: boolean): void {
    this._openOwnedByOperator = true;
    if (this._isThirdOpen === next) return;
    const previous = this._isThirdOpen;
    this._isThirdOpen = next;
    this.requestUpdate('isThirdOpen', previous);
  }

  /**
   * HOW LONG THE DOCK WAITS FOR A HOST THAT IS SWAPPING ITS MIDDLE COLUMN. Long enough for a
   * React render plus the renderer's rebuild (a double frame is ~32ms; this is generous), and
   * short enough that a surface which never signals still docks while the Run is spinning.
   */
  private static readonly DOCK_FALLBACK_MS = 420;

  private static readonly MIN_LEFT_PX = 60;
  /**
   * The collapsed chat column's floor — and it is the RAIL'S width, not the 60px
   * this used to be. A collapsed column IS its rail, so a floor narrower than the
   * rail clips it: at 60px the 74px rail lost its right edge and the tab labels
   * read "Version", "Approva". Measured on the console 2026-09-17.
   */
  private static readonly MIN_CHAT_PX = 74;
  private static readonly SNAP_PX = 16;
  /** The plain left boundary bar — the 3-column layout only. */
  private static readonly GRIP_LEFT_PX = 5;
  /**
   * The chat column's spacer: "chat-left-spacer" #40001085:2598, drawn at 30px
   * rather than the design's 20 (see the .gripper-chat rule for why). One home for
   * the number, because the drag arithmetic has to account for it exactly.
   */
  private static readonly GRIP_CHAT_PX = 30;
  /**
   * The right COLUMN's floor — the rail plus the spacer, because the spacer is
   * inside the column now (it is the container's first child, as the design draws
   * it). The pane used to be the rail alone with the strip outside it; every clamp
   * in the drag arithmetic is expressed against the column, so this is the number
   * the drag compares against.
   */
  private static readonly MIN_RIGHT_PX =
    WorkspaceLayout.MIN_CHAT_PX + WorkspaceLayout.GRIP_CHAT_PX;
  /**
   * HER COLUMN'S OPEN WIDTH — the design's 650, and the width she returns to when the rail
   * opens her again (the owner's number, 2026-09-18).
   */
  private static readonly OPEN_CHAT_PX = 650;

  // Flex-grow proportions for the panes that SHARE what she leaves: the prompt and the canvas.
  private _left = 1;
  private _middle = 1;

  /**
   * HER COLUMN'S WIDTH — a NUMBER the element holds, not a proportion of anything.
   *
   * The other two panes are grow ratios because their job is to absorb what is left. Hers is
   * a width because the design gives her one: 650, and whatever the operator's hand makes it.
   * A proportion cannot promise that — measured on a 1375px shell the ratio that was supposed
   * to be 650 rendered at 637, and on the composer at 455, because the panes beside her trade
   * width with each other and with their own floors.
   *
   * It is also why her gripper can no longer move the prompt: her pane's width comes out of
   * the panes beside it by ARITHMETIC (flex takes it from them), not by a second ratio that
   * somebody has to keep in step.
   */
  private _rightPx = WorkspaceLayout.OPEN_CHAT_PX;

  /**
   * THE GROUND HER COLUMN STANDS ON, while a drawing is on screen — the canvas's OWN colour,
   * read from the canvas element rather than a value kept in step with it, and empty when no
   * canvas is in the shell (her pane then paints nothing, which is what a package view wants).
   */
  private _columnGround = '';

  /** Follows the assigned canvas's `theme` while it is the one in the middle pane. */
  private _groundObserver: MutationObserver | null = null;
  private _groundElement: HTMLElement | null = null;

  private _dragging: 'left' | 'right' | null = null;

  constructor() {
    super();
    this.isThirdOpen = true;
    this.leftCollapsed = false;
  }

  /**
   * The middle slot tells us whether it has content, once when the tree arrives and
   * again whenever it changes. `flatten: true` so a fallback or a re-parented node still
   * counts as content — the question is what is drawn, not where it was authored.
   */
  private _onMiddleSlotChange = (): void => {
    const slot = this.shadowRoot?.querySelector('slot[name="middle"]') as HTMLSlotElement | null;
    // Straight away, before the early return: a canvas REPLACED by another canvas is the same
    // middle pane and a different ground.
    this._readColumnGround();
    const has = (slot?.assignedNodes({ flatten: true }) ?? [])
      .some((n) => n.nodeType === Node.ELEMENT_NODE);
    if (has === this._hasMiddle) return;
    this._hasMiddle = has;
    // The pane changes the drag arithmetic (2-column vs 3-column) and the grip, so the
    // split is re-baselined from the column that is now on screen.
    this.requestUpdate();
    /*
     * AND A DOCKED COLUMN IS STILL DOCKED. The dock runs on `run-click`, which arrives a
     * beat BEFORE the middle column exists — a Run is what brings it — so the arithmetic
     * ran in the two-column case and handed the freed space to the right (the
     * `!_hasMiddle` branch). When the middle then arrived, the ratios no longer put the
     * boundary on its floor, and the prompt hung open: measured 107px against a 60px
     * floor, the owner's "it's not quite snapping shut" (2026-09-18).
     *
     * The floor is a fact about the collapsed column, not about when the middle happened
     * to appear, so the dock is recomputed now that it is here.
     */
    if (this._leftCollapsed) this._dockLeft();
    /*
     * AND HER COLUMN KEEPS ITS WIDTH, with nothing to re-assert: hers is a NUMBER the element
     * holds, so the canvas arriving beside her cannot change it. That is what this block used
     * to do — a ratio sized against a two-pane total is not the ratio that lands in a
     * three-pane one — and it is the whole reason the width stopped being a ratio.
     */
  };

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('mousemove', this._onMouseMove as EventListener);
    document.addEventListener('mouseup', this._onMouseUp as EventListener);
    // The release is caught on more than one channel on purpose. A mousedown that
    // starts inside this element's shadow root can end in a place where the
    // matching `mouseup` never reaches a document listener — and a lost release
    // leaves the column following the pointer with the button up, which is the
    // one failure the operator cannot escape. pointerup covers the same gesture on
    // the pointer channel; pointercancel covers the browser taking the gesture
    // away; blur covers the window losing focus mid-drag.
    document.addEventListener('pointerup', this._onMouseUp as EventListener);
    document.addEventListener('pointercancel', this._onMouseUp as EventListener);
    window.addEventListener('blur', this._onMouseUp as EventListener);
    /*
     * AND THE ONE RELEASE NONE OF THOSE CATCH: letting go OUTSIDE the window. It fires no
     * mouseup anywhere — the document never hears it and the window does not lose focus — so
     * the pane kept following a hand that was no longer holding anything. The boundary says it
     * instead: crossing it with NO BUTTON DOWN means the hand is empty, whether it just arrived
     * or just left after letting go. (Capturing the pointer is the other way to know, and it
     * cost the whole page: a capture that outlives its pointer sends every later event to one
     * strip, so nothing else could be grabbed — see chat-panel.)
     */
    document.addEventListener('mouseout', this._onPointerBoundary as EventListener);
    document.addEventListener('mouseover', this._onPointerBoundary as EventListener);
    // The tone switch flips the canvas's `--flow-ground`, and her column stands on it.
    window.addEventListener('theme-change', this._readColumnGround as EventListener);
    // The rail's requests arrive here because both events are composed and
    // bubble: the rail is inside the panel's shadow root, inside this element.
    this.addEventListener('collapse-toggle', this._onCollapseToggle as EventListener);
    /*
     * The grip inside <chat-panel> asks for this drag to begin. The gesture starts
     * on the component that OWNS the grip; the sizing belongs here, because this
     * element is what lays the panes out. right-column-drag-start has been in the
     * rail's registry entry all along with nothing emitting it — the rail's own grip
     * was removed and the event went with it — and the strip that replaced that grip
     * is the thing that asks for the drag now.
     */
    /*
     * The grip inside <chat-panel> owns the gesture and reports it with the names its
     * annotation gives. "chat-left-spacer" #40001085:2598 (the MASTER — the instance
     * inside the container carries no annotation, which is what made this look like an
     * unannotated element):
     *   On drag:  dispatch input-resize-start, input-resize-move, input-resize-end
     *   Connects: drags the chat column's left edge; the whole strip is the target,
     *             not just the glyph
     * The strip raises those three; the sizing happens here, because the column's
     * width is this element's to lay out. The names are the design's, not invented.
     */
    this.addEventListener('input-resize-start', this._onGripStart as EventListener);
    this.addEventListener('input-resize-move', this._onGripStart as EventListener);
    this.addEventListener('input-resize-end', this._onGripEnd as EventListener);
    this.addEventListener('tab-change', this._onTabChange as EventListener);
    /*
     * A RUN DOCKS THE PROMPT, AND THE PROMPT IS WHAT HEARS IT.
     *
     * The Run button lives in the left column's own footer (<control-bar> is slotted
     * into this element's left pane), so the click arrives here from inside the thing
     * it acts on. Docking is the point: a person has just READ the process as text,
     * and what they now watch is the same process as a picture — the canvas takes the
     * width, and the prompt keeps its rail and one grip, so opening it back up is one
     * gesture. This is a RE-presentation of one process, not a mode switch: nothing
     * about the prompt changed by being docked.
     *
     * It is the element that owns the width doing it, which is the whole reason the
     * flag below is internal: a payload re-assert cannot reopen the column mid-run,
     * and the grip still can.
     */
    this.addEventListener('run-click', this._onRunClick as EventListener);
    // The host that swaps its middle column on a Run says when the new one is up.
    this.addEventListener('flow-view-ready', this._dockNow as EventListener);
    this.addEventListener('flow-select', this._onFlowSelect as EventListener);
  }

  disconnectedCallback(): void {
    document.removeEventListener('mousemove', this._onMouseMove as EventListener);
    document.removeEventListener('mouseup', this._onMouseUp as EventListener);
    document.removeEventListener('pointerup', this._onMouseUp as EventListener);
    document.removeEventListener('pointercancel', this._onMouseUp as EventListener);
    window.removeEventListener('blur', this._onMouseUp as EventListener);
    document.removeEventListener('mouseout', this._onPointerBoundary as EventListener);
    document.removeEventListener('mouseover', this._onPointerBoundary as EventListener);
    window.removeEventListener('theme-change', this._readColumnGround as EventListener);
    this._groundObserver?.disconnect();
    this.removeEventListener('collapse-toggle', this._onCollapseToggle as EventListener);
    this.removeEventListener('tab-change', this._onTabChange as EventListener);
    this.removeEventListener('run-click', this._onRunClick as EventListener);
    this.removeEventListener('flow-view-ready', this._dockNow as EventListener);
    this.removeEventListener('flow-select', this._onFlowSelect as EventListener);
    if (this._dockTimer !== null) window.clearTimeout(this._dockTimer);
    /*
     * A DRAG CANNOT OUTLIVE THE ELEMENT. Re-rendering the surface replaces this
     * element mid-gesture, and the flag that says "follow the mouse" went with it
     * while the listener that would clear it was detached — so the next element
     * inherited nothing and the OLD one kept resizing a pane on every mousemove
     * with no way to let go. Measured 2026-09-17: `_dragging` was still 'left'
     * several interactions after the drag that set it.
     */
    this._endDrag();
    super.disconnectedCallback();
  }

  /** Leave the dragging state, once, wherever the release came from. */
  private _endDrag(): void {
    this._dragging = null;
    this.removeAttribute('dragging');
  }

  /**
   * THE HAND IS OFF THE PAGE. A release outside the window fires no mouseup anywhere, so a drag
   * would stay live and the pane would keep following a cursor nobody is holding. Crossing the
   * boundary with no button down is the fact that says otherwise — see the listener in
   * connectedCallback for why the pointer is not captured instead.
   */
  private _onPointerBoundary = (e: MouseEvent): void => {
    if (!this._dragging) return;
    if (e.relatedTarget) return; // a move between elements, not across the page's edge
    if (e.buttons !== 0) return; // the button is still down: the hand is mid-drag
    this._onMouseUp();
  };

  /**
   * THE COLUMN'S OPEN/CLOSED STATE LIVES HERE, AND SO DOES ITS CONSEQUENCE.
   *
   * This element owns the right column's width, so it owns whether that column is
   * open — and it must SAY SO to the panel it is hosting. chat-panel's own note
   * records what happens otherwise: the rail's collapsed flag drifts from the real
   * column, its click logic reads "already collapsed, so expand" against a flag
   * that says false, and the first click on the Chat tab COLLAPSES instead of
   * opening. The operator gets one click too many, and the column appears to fly
   * open and then empty itself.
   *
   * The panel still owns the flag on its own instance; this only writes it when
   * the column changes, so the two can never disagree about the same fact.
   */
  private _rightPanel: HTMLElement | null = null;

  private _syncRightPanel(): void {
    const el = this._rightPanel as unknown as { collapsed?: boolean } | null;
    if (!el) return;
    el.collapsed = !this.isThirdOpen;
  }

  /**
   * IS THERE ANYTHING IN THE RIGHT PANE? Read from the slot, like the middle's own flag.
   *
   * A pane with nothing in it must not be DRAWN, and it must not take width either. That
   * matters because her panel can MOVE: the flow view composes <agent-canvas> in the
   * middle column and puts the same chat panel inside it, so the right slot is left empty
   * — and an empty pane still reserved its floor, which measured 104px of dead column on
   * the right of the drawing (2026-09-18). The middle column has always answered this
   * question for itself (`_hasMiddle`); this is the right column asking it too.
   */
  private _hasRight = false;

  /**
   * WHAT SHOWS THROUGH HER TRANSPARENT EDGE. The strip and the panel's container paint nothing
   * by design — "right-column-panel-container" #40001066:3272 and "chat-left-spacer"
   * #40001085:2598 are both transparent in the drawing, and they are transparent in the code
   * (measured 2026-09-18, both rgba(0,0,0,0)). What was WRONG was what stood behind them: the
   * shell's own grey, because in this shell the drawing is a column beside her rather than the
   * ground under her. The owner, 2026-09-18: "when Grace is over top of the canvas, she should
   * see the canvas behind that."
   *
   * So the drawing's ground becomes the ROOM's ground (see the :host rule): every column stands
   * on it, her transparent edges show the drawing by showing the room, and nothing is painted on
   * her column at all.
   *
   * The value is the canvas element's own `--flow-ground` — mid-tone or dark, one home, read
   * here and never restated — and it is re-read when the tone changes as well as when the
   * canvas arrives, because the tone is written onto the canvas by the TREE (and by the foot's
   * switch) with no event this element could hear. That mattered: the first version of this read
   * it once, caught the mid-tone before `theme="dark"` had been written, and painted a light
   * ground beside a dark drawing — the owner: "the background is dark and you added the light
   * mode version of the background."
   */
  private _readColumnGround(): void {
    const slot = this.shadowRoot?.querySelector('slot[name="middle"]') as HTMLSlotElement | null;
    const canvas = (slot?.assignedElements({ flatten: true }) ?? [])[0] as HTMLElement | undefined;
    this._watchGround(canvas ?? null);
    const ground = canvas
      ? getComputedStyle(canvas).getPropertyValue('--flow-ground').trim()
      : '';
    if (ground === this._columnGround) return;
    this._columnGround = ground;
    if (ground) this.style.setProperty('--column-ground', ground);
    else this.style.removeProperty('--column-ground');
  }

  /** Follow the assigned element's `theme`, the one way its ground changes without an event. */
  private _watchGround(el: HTMLElement | null): void {
    if (el === this._groundElement) return;
    this._groundObserver?.disconnect();
    this._groundElement = el;
    if (!el || typeof MutationObserver === 'undefined') return;
    this._groundObserver = new MutationObserver(() => this._readColumnGround());
    this._groundObserver.observe(el, { attributes: true, attributeFilter: ['theme'] });
  }

  private _onRightSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this._rightPanel = (slot.assignedElements()[0] as HTMLElement | undefined) ?? null;
    const has = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE);
    if (has !== this._hasRight) {
      this._hasRight = has;
      this.requestUpdate();
      /*
       * HER PANEL ARRIVING NEEDS NO SIZING — the width is a number this element already holds
       * (see _rightPx), so the pane is drawn at it the moment it can be drawn at all. This used
       * to re-assert 650 through the ratios, on arrival only, because a ratio has nothing to
       * remember.
       */
    }
    this._syncRightPanel();
  };

  /** The rail asked for a state: the column obeys and the flag follows. */
  private _onCollapseToggle = (e: Event): void => {
    const collapsed = Boolean((e as CustomEvent).detail?.collapsed);
    // Opening her is opening her AT HER WIDTH (see _openThird); a column that is already open
    // keeps the width the operator gave it, so this only acts on the way up from closed.
    if (collapsed) {
      this._setThirdOpen(false);
      this._syncRightPanel();
    } else if (!this.isThirdOpen) {
      this._openThird();
    }
  };

  /**
   * A tab click is the operator asking to SEE something in this column.
   *
   * An EMPTY tab is the rail collapsing itself (chat-panel._onTabChange). Any
   * OTHER tab — Chat, Trace, Versions, Tools, Approvals — is a request to look at
   * that view, so the column OPENS. Without this the panel un-hid its body inside
   * a 74px pane and the click appeared to do nothing at all: measured 2026-09-17,
   * Trace selected, column still 74px, view slot present and empty on screen.
   */
  /**
   * A RAIL SPEAKS FOR ITS OWN COLUMN, and this element only draws a column when it has one.
   *
   * `tab-change` arrives from whatever rail is on screen. In the flow view her panel lives
   * INSIDE the middle column — the container's seat — so a click on Trace was answered here by
   * opening THIS element's right pane, which is empty: the chat slid left and a band of nothing
   * appeared beside it. The owner's diagnosis was exact (2026-09-18): "it's sliding the chat to
   * the left when you click on the trace button — it thinks it's still docked."
   *
   * An empty right slot means the rail that spoke is not this pane's, and a pane with no child
   * has nothing to open.
   */
  private _onTabChange = (e: Event): void => {
    if (!this._hasRight) return;
    const tab = String((e as CustomEvent).detail?.tab ?? '');
    // An empty tab is the rail collapsing itself; any other is a request to LOOK, so she opens
    // — at her width, and only if she was away. A column already on screen keeps its width.
    if (tab === '') {
      this._setThirdOpen(false);
      this._syncRightPanel();
    } else if (!this.isThirdOpen) {
      this._openThird();
    }
  };

  /**
   * A NODE PICKED ON THE CANVAS IS A REQUEST TO SEE HER — at her width.
   *
   * The drawing emits `flow-select` when a node is clicked, composed and bubbling, so it
   * arrives here the same way the rail's and the Run's requests do — and the column that
   * answers a pick is hers. The owner, 2026-09-18: "once you see the canvas and you click on
   * the notes in the canvas it needs to engage Grace, so she'll have to pop back open."
   *
   * ONLY A REAL PICK. A deselect (`nodeId: null`) is the person clearing a selection, and
   * closing her on that would be this element inventing a reason to take her away.
   *
   * What she SAYS about the node is not decided here: the drawing carries the pick, the words
   * are the conversation's business (AGENTIC_EDITOR/06 is the open question), and this element
   * owns exactly one fact — whether she is there, and how wide.
   */
  private _onFlowSelect = (e: Event): void => {
    if (!this._hasRight) return;
    const nodeId = (e as CustomEvent).detail?.nodeId;
    if (!nodeId) return;
    // A pick brings her back when she is away — at her width — and leaves a column that is
    // already on screen exactly as wide as the operator made it.
    if (!this.isThirdOpen) this._openThird();
  };

  /**
   * The spacer's gesture, with the pointer's position in the detail. START takes hold
   * (the column opens under the pointer if it was collapsed); MOVE sizes it. Both run
   * through the same code as this element's own grips, so the two routes cannot drift.
   *
   * IS THIS THE SPACER'S GESTURE, OR THE INPUT AREA'S? Both grips inside her panel raise
   * these three names — the spacer that drags this column's edge, and the grip under her
   * composer that resizes the input area. Only the spacer carries a horizontal position,
   * so that is the test, and it is the SAME test the container hosts (agent-canvas had it
   * while this element, which owns the width, did not — the wrong way round). Answering
   * the input grip here started a right-column drag from a drag of the input area: it set
   * `dragging` on the whole layout, which suspends every pane's motion, and on a collapsed
   * column it ran the open-under-the-pointer branch — which marks the pane OPERATOR-OWNED,
   * so after one drag of the input area nothing could close her column again, the rail's
   * own button included.
   */
  private _onGripStart = (e: Event): void => {
    const detail = ((e as CustomEvent).detail || {}) as { clientX?: unknown; clientY?: unknown };
    if (typeof detail.clientX !== 'number') return;
    const x = detail.clientX;
    const y = Number(detail.clientY ?? 0);
    if (this._dragging) {
      this._onMouseMove({ clientX: x, clientY: y } as MouseEvent);
      return;
    }
    this._onGripDown('right', {
      clientX: x,
      clientY: y,
      preventDefault: () => {},
    } as MouseEvent);
  };

  /** The spacer reports the gesture over — the same finish as this element's own. */
  private _onGripEnd = (): void => {
    this._onMouseUp();
  };

  /**
   * THE RUN BUTTON ASKS FOR THE ROOM. See the listener in connectedCallback.
   *
   * Docking is done HERE, on the element that lays the panes out, and through the
   * internal path — so it is the column's own act, the person's next grip can undo
   * it, and no later payload re-assert can. The ratios are recomputed rather than
   * the flag alone: a pane whose grow factor is unchanged keeps its width, and a
   * collapsed flag that does not move the split would be a mark with no consequence.
   */
  /**
   * THE DOCK IS QUEUED, NOT IMMEDIATE — a Run is followed by a whole new middle column, and
   * the dock used to land a beat BEFORE it.
   *
   * What that looked like (owner, 2026-09-18): "it's closing the left side correctly but in
   * doing so it pulls the chat all the way over… and then when I load the canvas, I push the
   * chat back to its proper position." Two changes, two frames: her column first took the
   * width the prompt gave up, and only then did the flow view arrive and move her inside the
   * middle column.
   *
   * His answer, and it is the right one: "the way I would do it is queue it up — when you hit
   * run it used to spin, and I had a little delay on it that allowed everything to queue up."
   * The Run button DOES spin (`control-bar.isRunning`, which the shell sets at the top of the
   * run). So the dock now waits for the host that is about to swap: it says
   * `flow-view-ready` when its new middle column is on screen, and the dock lands with it.
   *
   * THE FALLBACK KEEPS EVERY OTHER HOST HONEST: a surface with no flow view never signals, so
   * the dock cannot wait forever — it lands on the timer instead, exactly as it always did.
   */
  private _dockTimer: number | null = null;

  private _onRunClick = (): void => {
    this._leftOwnedByOperator = true;
    if (this._dockTimer !== null) window.clearTimeout(this._dockTimer);
    this._dockTimer = window.setTimeout(() => this._dockNow(), WorkspaceLayout.DOCK_FALLBACK_MS);
  };

  /** The dock, once — from the host's signal or from the fallback, whichever arrives first. */
  private _dockNow = (): void => {
    if (this._dockTimer !== null) {
      window.clearTimeout(this._dockTimer);
      this._dockTimer = null;
    }
    this._dockLeft();
  };

  /** Collapse the left pane to its floor. */
  private _dockLeft(): void {
    this._setLeftCollapsed(true);
    /*
     * THE DOCK IS A ZERO SHARE, NOT A SUM. The pane keeps its 60px floor (min-width, in the
     * render), so a grow of zero leaves it ON its floor — and whatever is left over goes to
     * whoever grows: the canvas when there is one, and her column when there is not (see
     * `absorbs` in the render). That is one line instead of the ratio arithmetic this used to
     * do, and it is the same line in both layouts.
     */
    this._left = 0;
    this.requestUpdate();
  }

  /**
   * THE WIDTH THE HAND IS ASKING FOR — read from the POINTER, never from how far it has
   * travelled.
   *
   * This is the owner's own rule for every gripper here (TO-DO.md item 1): "I have to use the
   * cursor." A width computed as `start + travel` drifts from the hand the moment anything
   * reflows — the pane hits its floor, the canvas arrives, a sibling changes size — and the
   * edge ends up somewhere the cursor is not. The spacer sits immediately left of her column,
   * so the cursor IS on the boundary it moves: her width is the distance from the pointer to
   * the host's right edge, clamped to her floor and to what the prompt beside her needs.
   */
  private _rightPxFromPointer(clientX: number): number {
    const w = Math.max(1, this.clientWidth);
    const grip = this._hasMiddle
      ? WorkspaceLayout.GRIP_LEFT_PX + WorkspaceLayout.GRIP_CHAT_PX
      : WorkspaceLayout.GRIP_CHAT_PX;
    const content = Math.max(1, w - grip);
    const max = Math.max(WorkspaceLayout.MIN_RIGHT_PX, content - WorkspaceLayout.MIN_LEFT_PX);
    return Math.min(
      Math.max(this.getBoundingClientRect().right - clientX, WorkspaceLayout.MIN_RIGHT_PX),
      max,
    );
  }

  /**
   * SHE OPENS AT HER OWN WIDTH — the design's 650, and what an expand returns to. Every way of
   * opening her that is NOT a drag goes through here: the rail's Chat button, any rail tab, a
   * picked note. A drag sets her width from the pointer instead, which is why it does not.
   */
  private _openThird(): void {
    this._rightPx = WorkspaceLayout.OPEN_CHAT_PX;
    this._setThirdOpen(true);
    this._syncRightPanel();
  }

  private _onGripDown = (side: 'left' | 'right', e: MouseEvent): void => {
    this.setAttribute('dragging', '');
    this._dragging = side;
    /*
     * THE GRAB IS THE OPERATOR TAKING THE BOUNDARY — in either layout, at any width.
     *
     * From the first touch of a divider the operator owns the column it borders: no later
     * payload assignment can undo what the hand does. That is the half that was missing — a
     * drag used to move the grow ratios only, so the pane stayed unowned and the next payload
     * write slammed a width a hand had just set.
     *
     * FOR HER COLUMN THE GRAB ALSO OPENS IT, and it opens to the POINTER — not with a jump to
     * 650. A collapsed pane has no width to drag, so the grab has to give it one; the edge
     * lands where the hand is and then follows it. Opening to the stored width instead threw
     * the boundary 300px away from a grip taken at the floor.
     */
    if (side === 'left') {
      this._leftOwnedByOperator = true;
      this._setLeftCollapsed(false);
    } else {
      this._openOwnedByOperator = true;
      if (!this.isThirdOpen) {
        this._setThirdOpen(true);
        this._syncRightPanel();
      }
      this._rightPx = this._rightPxFromPointer(e.clientX);
    }
    this.dispatchEvent(new CustomEvent('resize-start', { detail: { side } }));
    e.preventDefault();
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._dragging) return;
    const w = Math.max(1, this.clientWidth);
    /*
     * The space the grips take, so the panes' content width is honest. These are the widths the
     * markup renders: the 5px left bar plus the 30px spacer in 3-column, and the spacer alone
     * in 2-column. It used to say 10 and 5, which under-counted the spacer by 25px.
     */
    const grip = this._hasMiddle
      ? WorkspaceLayout.GRIP_LEFT_PX + WorkspaceLayout.GRIP_CHAT_PX
      : WorkspaceLayout.GRIP_CHAT_PX;
    const content = Math.max(1, w - grip);

    if (this._dragging === 'right') {
      // Her column takes the width the hand is pointing at. The panes beside her give it up
      // by flex's own arithmetic, so nothing here has to hand width to anyone — which is what
      // makes it impossible for her gripper to swell the prompt.
      this._rightPx = this._rightPxFromPointer(e.clientX);
      // ...except at the very end: when she has taken everything the prompt needs, the prompt
      // is on its floor, and that is the same collapsed state the dock and the rail speak. Only
      // in the two-column shell — with a canvas between them there is no boundary to reach.
      if (!this._hasMiddle) {
        this._setLeftCollapsed(this._rightPx >= content - WorkspaceLayout.MIN_LEFT_PX - 1);
      }
    } else {
      // The prompt's divider: the same cursor rule, on the other boundary.
      let leftPx = e.clientX - this.getBoundingClientRect().left;
      // A snap, so the floor is something a hand can hit rather than a target it must find.
      if (Math.abs(leftPx - WorkspaceLayout.MIN_LEFT_PX) <= WorkspaceLayout.SNAP_PX) {
        leftPx = WorkspaceLayout.MIN_LEFT_PX;
      }
      leftPx = Math.max(
        WorkspaceLayout.MIN_LEFT_PX,
        Math.min(leftPx, content - WorkspaceLayout.MIN_CHAT_PX),
      );
      // Back into a share, because the prompt and the canvas are the panes that divide what
      // her column leaves: 0.68 : 1.32 is the same split as 0.34 : 0.66.
      const total = Math.max(1e-6, this._left + this._middle);
      this._left = (leftPx / content) * total;
      this._middle = total - this._left;
      this._setLeftCollapsed(leftPx <= WorkspaceLayout.MIN_LEFT_PX + 1);
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('resize', { detail: { side: this._dragging } }));
  };

  private _onMouseUp = (): void => {
    if (this._dragging) {
      /*
       * LETTING GO AT HER FLOOR CLOSES HER — the same `isThirdOpen` the rail's Chat button
       * flips, so the gripper and the rail are one control and cannot disagree about whether
       * her column is open. A pull away from the floor reopens her, so the whole gesture is one
       * control in both directions.
       *
       * The test is on THE WIDTH THE HAND LEFT HER AT, which is now the number her pane is drawn
       * from. It used to be read off the rendered box and compared with the rail's width alone
       * (74) — a width the pane cannot render below, because its floor is the rail PLUS the
       * spacer inside it (104). The comparison could therefore never be true, and "let go at the
       * floor and it closes" never fired.
       */
      if (this._dragging === 'right') {
        const collapsed = this._rightPx <= WorkspaceLayout.MIN_RIGHT_PX + WorkspaceLayout.SNAP_PX;
        if (collapsed !== !this.isThirdOpen) {
          this._setThirdOpen(!collapsed);
          this._syncRightPanel();
        }
        // A column that was shut goes back to her width the next time it opens; a column that
        // is open keeps exactly what the hand made it — the drag is the operator's.
        if (collapsed) this._rightPx = WorkspaceLayout.OPEN_CHAT_PX;
      }
      // `right` is her column's WIDTH in px; `left` and `middle` are shares, because those two
      // panes divide what she leaves.
      this.dispatchEvent(new CustomEvent('resize-end', {
        detail: { left: this._left, middle: this._middle, right: this._rightPx },
      }));
    }
    this._dragging = null;
    this.removeAttribute('dragging');
  };

  private _toggleThird = (): void => {
    this._setThirdOpen(!this.isThirdOpen);
    this.dispatchEvent(new CustomEvent('third-column-toggle', { detail: { open: this.isThirdOpen } }));
  };

  /**
   * PUT THE PLACE BACK TO HOW IT OPENS — the prompt out of its rail, her column standing open
   * at her width, and the panes back to the proportions a fresh layout starts with.
   *
   * WHAT ASKS FOR THIS: the canvas footer's Reset. The owner, 2026-09-18: "what does the reset
   * button do? Does it set it back to the default state when you first click on composer?
   * Because it doesn't look like it does — it should just reset it." He is right, and this is
   * why: the only thing Reset did was put the middle column back to its compiled output, so the
   * prompt stayed where the Run had docked it and her column kept whatever the last few minutes
   * had made of it. The arrangement is this element's, so this element is what puts it back —
   * the host asks, it does not write.
   *
   * IT IS THE OPERATOR'S ACT, so both panes are marked theirs: no payload re-assert may undo a
   * reset, exactly as none may undo a drag.
   */
  resetArrangement(): void {
    this._leftOwnedByOperator = true;
    this._setLeftCollapsed(false);
    this._left = 1;
    this._middle = 1;
    // Her column opens at her width, and `_openThird` claims it as the operator's on the way.
    this._openThird();
    this.requestUpdate();
  }

  /**
   * THE COLUMN WIDTHS, AS THE SAVE RECORDS THEM — measured off the panes this element is
   * rendering, not re-derived from the flex maths by somebody else. `left` is the prompt's
   * rendered width, null while it is on its rail (the same meaning ColumnWidths gives it);
   * `chat` is her column's, which is a pixel width in both of her forms, pane or layer.
   *
   * A HOST READS HERE; the element does not push — the same contract as `resetArrangement`
   * above and the canvas's `workspaceState`. (The event round trip that used to be asked
   * for — `collect-column-widths` / `column-widths-response` — had no answerer anywhere in
   * the repository, which is how the widths stayed out of every save without a word.)
   */
  widths(): { left: number | null; chat: number } {
    const box = (selector: string): number =>
      Math.round((this.renderRoot.querySelector(selector) as HTMLElement | null)?.getBoundingClientRect().width ?? 0);
    return {
      left: this.leftCollapsed ? null : box('.pane.left'),
      chat: box('.pane.right'),
    };
  }

  static styles = css`
    :host {
      display: flex;
      width: 100%;
      height: 100%;
      min-height: 0;
      /* Same reason as the sandbox: a flex item that won't shrink below its
         content will push its siblings out of the viewport instead of
         yielding. The three panes must be able to give width back. */
      min-width: 0;

      /*
       * THE ROOM'S GROUND, WHILE A DRAWING IS IN IT.
       *
       * Two things are TRUE of this screen and only look contradictory. Her column and the
       * drawing are SIBLINGS here — the drawing in the middle pane, she in the right — so
       * nothing of the drawing is under her, and "make her transparent" showed the shell's grey
       * instead of the drawing. And the design says the strip and the panel's container are
       * transparent so that what shows through them IS the drawing. Both hold at once only if
       * the drawing's ground is the ROOM's ground, with every column standing on it: then the
       * transparent edges show the drawing by showing the room.
       *
       * The value is the drawing's own — read from the canvas element (see _readColumnGround),
       * never restated here. Empty when no drawing is on screen, and then nothing is painted.
       */
      background: var(--column-ground, transparent);

      /* ── Motion language ────────────────────────────────────────────────
         One curve, one duration, for every pane move in the shell.
         Ease accelerates and stops — it lands like a slap. This curve
         leaves fast and decelerates hard into the stop, so a pane arrives
         rather than halts. Slow enough to read as movement, not as a jump. */
      --ease-settle: cubic-bezier(0.22, 1, 0.36, 1);
      --dur-pane: 520ms;
    }

    .pane {
      overflow: auto;
      min-height: 0;
      min-width: 0;
      /* BOTH PROPERTIES, because the panes are not all the same kind of thing: the prompt and
         the canvas move by GROW (their widths are shares), and her column moves by BASIS (its
         width is a number). One duration, one curve — the motion language does not change
         because the arithmetic did. */
      transition:
        flex-grow var(--dur-pane) var(--ease-settle),
        flex-basis var(--dur-pane) var(--ease-settle);
    }
    /* THE LEFT COLUMN IS THE DESIGN'S CONTAINER: content, then the ControlBar LAST.
       "left-column-panel-container" #40000954:23865 holds a panel-inner-container and
       then the "Left-column-ControlBar" INSTANCE #40001096:3241 (656.24 x 70) as its
       last child. So this pane is a COLUMN whose body scrolls and whose footer hugs —
       the bar is at the bottom of the column, and a bar inside the scroller would
       scroll away with the prompt sections, which is the opposite of the point. */
    .pane.left {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .pane.left > .left-body {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
    }
    .pane.left > ::slotted([slot='left-footer']) {
      flex: 0 0 auto;
      display: block;
    }
    /* THE RIGHT PANE IS ONLY THE COLUMN'S BOX now. Its padding, its fill and the
       spacer all belong to <chat-panel>, which is the design's
       right-column-panel-container and renders all three of that container's
       children. What is left here is the one rule this pane needs: it must not clip,
       because the rail's edge shadow is drawn inside it and is cast beyond it.
       The column's own scrollers live further in — the thread and the view slot —
       so this box has nothing to contain. */
    /*
     * HER COLUMN IS A LAYER OVER A DRAWING — AND ONLY OVER A DRAWING.
     *
     * This is the playground's own geometry, for the view that has a drawing to stand on —
     * canvas.html: "THE CANVAS IS THE GROUND; HER COLUMN IS A LAYER OVER IT", and the owner's
     * rule for it: "the canvas does not respond to anything on the right-hand side. It always
     * covers it." As a flex PANE beside a canvas she took width out of the drawing's pane, so
     * opening her narrowed the drawing and closing her widened it — it re-fitted on every move
     * of hers, which is what the owner saw and named: "the canvas is not underneath Grace
     * anymore. Now it's responsive. It has to be under her."
     *
     * THE over CLASS IS WHAT SCOPES IT — and it is set only when the middle holds something
     * that publishes a ground — a canvas. Everything else keeps her as a PANE: a console, or a
     * prompt that has not run, is two columns and always has been. The first version of this
     * rule had no scope, so it applied to the console too, and her layer landed across the
     * console's own column: the owner, 2026-09-18 — "Restore the console. The console is
     * responsive. You've just broke it just now."
     *
     * Absolute over a drawing, so the middle pane spans everything right of the prompt and this
     * one lies on the part of it she takes: the drawing keeps every pixel behind her, and what
     * she covered is simply uncovered again when she closes. The host is a positioning context
     * already (relative, in the :host rule), and the motion is the same curve and duration as
     * every other pane move — on WIDTH, because that is what this box is sized by here.
     */
    .pane.right {
      overflow: visible;
    }
    .pane.right.over {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      transition: width var(--dur-pane) var(--ease-settle);
    }
    /* The MIDDLE pane hides its content when collapsed — that column is simply not
       shown in the 2-column layout, so hiding it is the point.
       THE RIGHT PANE IS NOT INCLUDED, and that is not an oversight. The chat column
       collapsed is its RAIL (the panel is display:none inside the chat panel), so
       there is nothing to hide — while overflow: hidden there clipped the rail's
       edge drop shadow a second time, on the state the console actually loads in.
       The shadow has to escape this box; nothing else does.
       No backticks in this comment, deliberately: this is a Lit css literal. */
    .pane.middle.collapsed {
      overflow: hidden;
    }

    /* When the left column is docked to its rail, collapse the slotted content
       down to just the "Agent Prompting" format-rail tab. These custom
       properties inherit across the shadow boundary, so the slotted components
       hide their own bodies while the rail stays visible. */
    :host {
      --left-sections-display: block;
      --left-control-display: flex;
    }
    :host([left-collapsed]) {
      --left-sections-display: none;
      --left-control-display: none;
    }

    /* The flex-grow transition animates the middle column open on Run. It must
       NOT apply while dragging — every mousemove writes a new grow, and easing
       each one makes the pane chase the cursor (feels like resistance). */
    :host([dragging]) .pane { transition: none; }
    :host([dragging]) {
      user-select: none;
      cursor: col-resize;
    }

    .gripper {
      width: 5px;
      background: #d1d5db;
      cursor: col-resize;
      flex-shrink: 0;
      transition: background 0.1s, width var(--dur-pane) var(--ease-settle);
    }
    .gripper:hover { background: #9ca3af; }
    .gripper:active { background: #6b7280; }
    /* No collapsed rule any more. It set the spacer to width 0, and a spacer the
       design draws in both layouts has no state that removes it.
       No backticks in this comment, deliberately: this is a Lit css literal. */
    /* Figma "chat-left-spacer" #40001085:1406 + "gripper-verticle" #40001085:1470:
       the chat column's left edge as the design draws it — a 20px unfilled strip
       with the 10×38 glyph centred. No painted hover: the frame draws none, and
       the col-resize cursor is the affordance. The design draws this boundary
       only, so the left boundary keeps the plain bar. */
    /* AN EMPTY PANE TAKES NO SPACE. The slot above is the observer, so the pane is always
       drawn — but a pane whose slot has nothing assigned reserves its floor and shows a
       dead column: measured 104px beside the drawing when the flow view moves her panel
       inside the middle column (2026-09-18). The middle column has always sized itself to
       its content this way; so does the right one now.
       This must stay AFTER the .collapsed rule below: same specificity, source order
       decides, and collapse-to-the-rail is the wrong answer for a pane that is empty. */
    .pane.right.empty { flex: 0 0 0; min-width: 0; overflow: hidden; }

    /* The spacer's rules MOVED to <chat-panel>, which is the element that renders it
       and the design's container for it. One definition, in the component that owns
       the element — this file no longer draws that strip at all. */

    /* Motion is a courtesy, never a requirement. This MUST stay last: it and
       the .pane / .gripper rules share specificity 0,1,0, so only source order
       lets this win. Placed above them, the gripper's own transition would
       override it and the opt-out would be dead for the gripper only. */
    @media (prefers-reduced-motion: reduce) {
      .pane, .gripper { transition: none; }
    }
  `;

  render() {
    const middleGrow = this._hasMiddle ? this._middle : 0;
    /*
     * HER COLUMN'S WIDTH IS A NUMBER, and it is a WIDTH — not a share of the flex line. See
     * _rightPx, and see the .pane.right rule: she is a LAYER over the drawing, so this width
     * is how much of the drawing she covers and nothing else.
     */
    const rightWidth = this.isThirdOpen ? this._rightPx : WorkspaceLayout.MIN_RIGHT_PX;
    /*
     * SHE IS A LAYER ONLY OVER A DRAWING — and "there is a drawing" is read off the ELEMENT in
     * the middle: the plug-in that draws it (<agent-canvas>), which is what the flow view puts
     * there. A console, or a prompt that has not run, has no such element: there she is a PANE,
     * exactly as she has always been, and the two columns divide the shell between them.
     *
     * The first version of this rule asked "is there a middle pane", which is true in the
     * console too — so her layer landed across the console's own column: the owner, 2026-09-18,
     * "Restore the console. The console is responsive. You've just broke it just now."
     */
    const middleSlot = this.shadowRoot?.querySelector('slot[name="middle"]') as HTMLSlotElement | null;
    const middleEl = (middleSlot?.assignedElements({ flatten: true }) ?? [])[0] as HTMLElement | undefined;
    const rightOver = this._hasRight && !!middleEl && middleEl.tagName.toLowerCase() === 'agent-canvas';
    /*
     * AS A PANE SHE GROWS ONLY WHEN NOTHING ELSE CAN ABSORB THE REMAINDER: with the prompt
     * docked and no canvas beside her — the beat before a Run's middle column arrives — the
     * leftover has to land somewhere, and hers is the only pane left that can take it.
     */
    const rightAbsorbs = !rightOver && this.isThirdOpen && this._leftCollapsed;
    /*
     * HER BOX, SIZED TWO WAYS, and it has to be written HERE because an inline style beats every
     * selector — the measured case was an empty right pane at 526px with the class applied and
     * the width untouched (the owner's "weird large space on the right hand side").
     *
     *   over a drawing   width, because she is a LAYER on it (.pane.right.over): the number is
     *                    how much of the drawing she covers, and none of it comes out of any
     *                    other column's box.
     *   over nothing     flex, because she is a PANE beside the prompt, as she has always been
     *                    in a console or a prompt that has not run.
     */
    const rightStyle = rightOver
      ? `width: ${this._hasRight ? rightWidth : 0}px;`
      : `flex: ${rightAbsorbs ? 1 : 0} 1 ${rightWidth}px; min-width: ${this._hasRight ? WorkspaceLayout.MIN_RIGHT_PX : 0}px;`;
    const minLeft = WorkspaceLayout.MIN_LEFT_PX;
    /*
     * THE 60px FLOOR IS THE COLLAPSED WIDTH, so it holds in BOTH states.
     *
     * This was `isThirdOpen ? MIN_CHAT_PX : 0`, which collapsed the pane to ZERO
     * — and a zero-width pane draws no rail either, so the console's closed chat
     * was not a closed column, it was no column: the rail laid out at x=1280
     * outside a 1280px window. The file's own header states what the number is
     * for: "The 60px left rail and 60px chat floor are COLLAPSED widths."
     */
    /*
     * THE FLEX LINE MUST FILL ITS CONTAINER, so the grow factors are NORMALISED
     * to sum to 1 among the panes that are actually open.
     *
     * They are proportions, and they are only proportions of the free space while
     * they sum to at least 1. Below that the spec gives each item
     * `grow × free-space` and LEAVES THE REMAINDER UNUSED, so a collapsed pane
     * (grow 0) beside the other pane's fractional ratio left a dead strip inside
     * the container. Measured on the console 2026-09-17 at 1920: layout 1864px,
     * panes 1228 + 0 + 60, and 571px of nothing to the right of the rail. A lit
     * region followed by an edge with nothing after it reads as a panel drawn over
     * the surface, which is what it looked like.
     *
     * Normalising changes no proportion — 0.68 : 1.32 is the same split as
     * 0.34 : 0.66 — it only guarantees the open panes sum to the whole.
     */
    const growTotal = this._left + middleGrow + (rightAbsorbs ? 1 : 0);
    const share = (g: number) => (growTotal > 0 ? g / growTotal : 0);
    const leftFlex = `${share(this._left)} 1 0%`;
    /*
     * HER BOX IS SIZED HERE, IN THE INLINE STYLE, and it is sized differently depending on what
     * she is standing on — which is not a detail to be tidied away:
     *
     *   over a DRAWING   width, because she is a LAYER on it (see .pane.right.over): the number
     *                    is how much of the drawing she covers, and nothing of it comes out of
     *                    any other column's box.
     *   over nothing     flex, because she is a PANE beside the prompt, as she has always been
     *                    in a console or a prompt that has not run — and it has to be written
     *                    HERE because an inline style beats every selector: the measured case
     *                    was an empty right pane at 526px with the class applied and the width
     *                    untouched (the owner's "weird large space on the right hand side").
     */

    return html`
      <div class="pane left" style="flex: ${leftFlex}; min-width: ${minLeft}px;">
        <div class="left-body"><slot name="left"></slot></div>
        <!-- THE CONTROL BAR'S HOME, as the design draws it: the LAST child of the left
             column's container, below the prompt input area. Its own slot rather than
             part of the body, so it is pinned to the bottom of the column. -->
        <slot name="left-footer"></slot>
      </div>
      <!-- The plain bar is the LEFT boundary only, and only exists in the 3-column
           layout. In 2-column there is no middle pane, so the chat column's left
           edge is the design's spacer — see below. -->
      ${this._hasMiddle
        ? html`<div class="gripper" @mousedown=${(e: MouseEvent) => this._onGripDown('left', e)}></div>`
        : nothing}
      <div class="pane middle ${this._hasMiddle ? '' : 'collapsed'}" style="flex: ${share(middleGrow)} 1 0%;"><slot name="middle" @slotchange=${this._onMiddleSlotChange}></slot></div>
      <!-- THE RIGHT COLUMN IS THE DESIGN'S CONTAINER, and this spacer is its FIRST
           CHILD — a sibling of the panel, not a neighbour of the column.

           "right-column-panel-container" #40001066:3272 holds three siblings —
           spacer (x -14857), rail (x -14837), panel (x -14763) — with paddingTop 10
           and a fill behind all three. The app had the spacer OUTSIDE this pane,
           which broke it in three visible ways at once, all measured today:
             · the container's 10px inset could reach the pane and never the strip,
               so the strip stood proud of the rail (spacer.top 57, rail.top 67);
             · the strip is transparent by design, so it showed the shell behind it
               instead of the container's fill;
             · the rail's edge shadow had nothing of the container to fall on.
           None of those were the strip's own rules. It was standing outside the
           box it belongs to. -->
      <!-- THE RIGHT PANE IS THE COLUMN'S BOX, NOT ITS CONTENTS. The spacer, the rail
           and the panel all belong to the chat component now (see its render): it is
           the design's right-column-panel-container, so the container's padding and
           fill live there and the strip is its first child rather than a sibling of
           this pane. This pane only sizes the column, and the drag it used to start
           itself now arrives as right-column-drag-start from the grip inside that
           component — the event the rail's registry entry declares.

           The floor is the COLUMN's: rail 74 + spacer 30, because the pane's content
           now includes both. -->
      <div class="pane right ${this.isThirdOpen ? '' : 'collapsed'} ${this._hasRight ? '' : 'empty'} ${rightOver ? 'over' : ''}" style=${rightStyle}>
        <slot name="right" @slotchange=${this._onRightSlotChange}></slot>
      </div>
    `;
  }

  /** A change to the column's state is also a change to what the panel is told. */
  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('isThirdOpen')) this._syncRightPanel();
  }
}

if (!customElements.get('workspace-layout')) customElements.define('workspace-layout', WorkspaceLayout);

declare global {
  interface HTMLElementTagNameMap {
    'workspace-layout': WorkspaceLayout;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'workspace-layout': React.DetailedHTMLProps<
        React.HTMLAttributes<WorkspaceLayout> & {
          'is-third-open'?: '' | boolean;
        },
        WorkspaceLayout
      >;
    }
  }
}
