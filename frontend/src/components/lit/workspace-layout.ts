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

  // Flex-grow proportions. Equal (1/1/1) by default → balanced columns.
  private _left = 1;
  private _middle = 1;
  private _right = 1;

  private _dragging: 'left' | 'right' | null = null;
  private _startX = 0;
  private _start = { left: 1, middle: 1, right: 1 };

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
  }

  disconnectedCallback(): void {
    document.removeEventListener('mousemove', this._onMouseMove as EventListener);
    document.removeEventListener('mouseup', this._onMouseUp as EventListener);
    document.removeEventListener('pointerup', this._onMouseUp as EventListener);
    document.removeEventListener('pointercancel', this._onMouseUp as EventListener);
    window.removeEventListener('blur', this._onMouseUp as EventListener);
    this.removeEventListener('collapse-toggle', this._onCollapseToggle as EventListener);
    this.removeEventListener('tab-change', this._onTabChange as EventListener);
    this.removeEventListener('run-click', this._onRunClick as EventListener);
    this.removeEventListener('flow-view-ready', this._dockNow as EventListener);
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

  private _onRightSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    this._rightPanel = (slot.assignedElements()[0] as HTMLElement | undefined) ?? null;
    const has = slot.assignedNodes({ flatten: true }).some((n) => n.nodeType === Node.ELEMENT_NODE);
    if (has !== this._hasRight) {
      this._hasRight = has;
      this.requestUpdate();
    }
    this._syncRightPanel();
  };

  /** The rail asked for a state: the column obeys and the flag follows. */
  private _onCollapseToggle = (e: Event): void => {
    this._setThirdOpen(!Boolean((e as CustomEvent).detail?.collapsed));
    this._syncRightPanel();
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
    this._setThirdOpen(tab !== '');
    this._syncRightPanel();
  };

  /**
   * The spacer's gesture, with the pointer's position in the detail. START takes hold
   * (the column opens under the pointer if it was collapsed); MOVE sizes it. Both run
   * through the same code as this element's own grips, so the two routes cannot drift.
   */
  private _onGripStart = (e: Event): void => {
    const { clientX, clientY } = ((e as CustomEvent).detail || {}) as { clientX?: number; clientY?: number };
    const x = Number(clientX ?? this.getBoundingClientRect().right);
    const y = Number(clientY ?? 0);
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

  /** Collapse the left pane to its floor, by the same arithmetic the drag uses. */
  private _dockLeft(): void {
    this._setLeftCollapsed(true);
    // No layout (a test environment, or before first paint): the FLAG is the fact
    // the contract is about, and the ratios below would be arithmetic on a zero
    // width. The drag has the same guard through its Math.max calls.
    const w = this.clientWidth;
    if (!w) return;
    const grip = this._hasMiddle
      ? WorkspaceLayout.GRIP_LEFT_PX + WorkspaceLayout.GRIP_CHAT_PX
      : WorkspaceLayout.GRIP_CHAT_PX;
    const content = Math.max(1, w - grip);
    // Exactly the left pane's branch of _onMouseMove, with the pointer's travel
    // replaced by "put the boundary on its floor" — one arithmetic, two callers.
    if (!this._hasMiddle) {
      const total = this._left + this._right;
      const newLeft = (WorkspaceLayout.MIN_LEFT_PX / content) * total;
      this._left = newLeft;
      this._right = total - newLeft;
    } else {
      const total = this._left + this._middle;
      const newLeft = (WorkspaceLayout.MIN_LEFT_PX / content) * total;
      this._left = newLeft;
      this._middle = total - newLeft;
    }
    this.requestUpdate();
  }

  private _onGripDown = (side: 'left' | 'right', e: MouseEvent): void => {
    this.setAttribute('dragging', '');
    this._dragging = side;
    /*
     * PULLING THE DIVIDER OPENS THE COLUMN — AND IT OPENS UNDER THE POINTER.
     *
     * Open/closed is `isThirdOpen`, and a drag only ever changed the grow ratios
     * — so on a collapsed column (74px, grow 0) the gripper had nothing to size:
     * the operator dragged and the pane did not move, because the width it was
     * being dragged against was not the thing holding it shut. Two mechanisms for
     * one fact is what made it feel stuck.
     *
     * Taking hold of the divider is the operator asking for the column, so the
     * column opens first and the drag then sizes it. Letting go with it back at
     * the floor closes it again (see _onMouseUp), so the whole gesture is one
     * control in both directions.
     *
     * WHAT IT GOT WRONG was WHERE it opened. Opening restored the stored grow
     * ratio — whatever width the last drag happened to leave — so a grip grabbed at
     * 74px threw the boundary out to 391px and the divider left the operator's hand
     * before the drag had begun. The pane is now sized from the POINTER's position
     * instead: the boundary lands exactly where it was grabbed, moves by the same
     * amount the hand does, and `_start` is captured afterwards so the drag that
     * follows continues from there rather than from the old ratio.
     */
    if (!this._hasMiddle && !this.isThirdOpen) {
      const hostRect = this.getBoundingClientRect();
      const content = Math.max(1, this.clientWidth - WorkspaceLayout.GRIP_CHAT_PX);
      // Distance from the pointer to the host's right edge is the pane's width —
      // the spacer sits immediately left of the pane, so the cursor is on the
      // boundary it is about to move.
      const panePx = Math.min(
        Math.max(hostRect.right - e.clientX, WorkspaceLayout.MIN_CHAT_PX),
        content - WorkspaceLayout.MIN_LEFT_PX,
      );
      const total = 2; // one pane each: equal weights, then split by position
      const leftPx = Math.max(WorkspaceLayout.MIN_LEFT_PX, content - panePx);
      this._left = (leftPx / content) * total;
      this._right = total - this._left;
      this._setThirdOpen(true);
      this._syncRightPanel();
    }
    /*
     * TAKING HOLD OF THE LEFT DIVIDER IS THE OPERATOR ASKING FOR THE PROMPT BACK.
     * Same rule as the right column, and the same reason: a collapse docked the pane
     * to its floor, so the grip sits ON the boundary it is about to move — no
     * restored ratio to throw the boundary away from the hand. The grab reopens it
     * and marks the pane the operator's, and the drag's own clamp closes it again if
     * the hand returns to the floor, so the gripper stays one control both ways.
     */
    if (side === 'left') {
      this._leftOwnedByOperator = true;
      this._setLeftCollapsed(false);
    }
    this._startX = e.clientX;
    this._start = { left: this._left, middle: this._middle, right: this._right };
    this.dispatchEvent(new CustomEvent('resize-start', { detail: { side } }));
    e.preventDefault();
  };

  private _onMouseMove = (e: MouseEvent): void => {
    if (!this._dragging) return;
    const delta = e.clientX - this._startX;
    const w = Math.max(1, this.clientWidth);
    // The space the grips take, so the panes' content width is honest. These are
    // the widths the markup actually renders: the 5px left bar plus the 30px spacer
    // in 3-column, and the spacer alone in 2-column. It used to say 10 and 5, which
    // under-counted the spacer by 25px and left the arithmetic to the browser.
    const grip = this._hasMiddle
      ? WorkspaceLayout.GRIP_LEFT_PX + WorkspaceLayout.GRIP_CHAT_PX
      : WorkspaceLayout.GRIP_CHAT_PX;

    if (!this._hasMiddle) {
      // 2-column: left vs right. Compute left in px, snap/clamp, then convert
      // back to a grow ratio so the baseline stays responsive.
      const total = this._start.left + this._start.right;
      const content = Math.max(1, w - grip);
      let leftPx = (this._start.left / total) * content + delta;
      if (Math.abs(leftPx - WorkspaceLayout.MIN_LEFT_PX) <= WorkspaceLayout.SNAP_PX) {
        leftPx = WorkspaceLayout.MIN_LEFT_PX;
      }
      const maxLeft = content - WorkspaceLayout.MIN_CHAT_PX;
      leftPx = Math.max(WorkspaceLayout.MIN_LEFT_PX, Math.min(leftPx, maxLeft));
      const newLeft = (leftPx / content) * total;
      this._left = newLeft;
      this._right = total - newLeft;
      this._setLeftCollapsed(leftPx <= WorkspaceLayout.MIN_LEFT_PX + 1);
    } else if (this._dragging === 'left') {
      // 3-column: left vs middle.
      const total = this._start.left + this._start.middle;
      const content = Math.max(1, w - grip);
      let leftPx = (this._start.left / total) * content + delta;
      if (Math.abs(leftPx - WorkspaceLayout.MIN_LEFT_PX) <= WorkspaceLayout.SNAP_PX) {
        leftPx = WorkspaceLayout.MIN_LEFT_PX;
      }
      const maxLeft = content - WorkspaceLayout.MIN_CHAT_PX;
      leftPx = Math.max(WorkspaceLayout.MIN_LEFT_PX, Math.min(leftPx, maxLeft));
      const newLeft = (leftPx / content) * total;
      this._left = newLeft;
      this._middle = total - newLeft;
      this._setLeftCollapsed(leftPx <= WorkspaceLayout.MIN_LEFT_PX + 1);
    } else {
      // 3-column: middle vs right.
      const total = this._start.middle + this._start.right;
      const content = Math.max(1, w - grip);
      let rightPx = (this._start.right / total) * content - delta;
      const maxRight = content - WorkspaceLayout.MIN_LEFT_PX;
      rightPx = Math.max(WorkspaceLayout.MIN_CHAT_PX, Math.min(rightPx, maxRight));
      const newRight = (rightPx / content) * total;
      this._right = newRight;
      this._middle = total - newRight;
    }

    this.requestUpdate();
    this.dispatchEvent(new CustomEvent('resize', { detail: { side: this._dragging } }));
  };

  private _onMouseUp = (): void => {
    if (this._dragging) {
      /*
       * Dragging the chat column back down to its floor CLOSES it — the same
       * `isThirdOpen` the rail's Chat button flips, so the gripper and the rail
       * are one control and cannot disagree about whether the column is open.
       * Read from what was actually laid out rather than from the ratios, because
       * the floor is a min-width the ratios cannot express.
       */
      if (!this._hasMiddle) {
        const pane = this.shadowRoot?.querySelector('.pane.right') as HTMLElement | null;
        const width = pane ? pane.getBoundingClientRect().width : 0;
        const collapsed = width <= WorkspaceLayout.MIN_CHAT_PX + 1;
        if (collapsed !== !this.isThirdOpen) {
          this._setThirdOpen(!collapsed);
          this._syncRightPanel();
        }
      }
      this.dispatchEvent(new CustomEvent('resize-end', {
        detail: { left: this._left, middle: this._middle, right: this._right },
      }));
    }
    this._dragging = null;
    this.removeAttribute('dragging');
  };

  private _toggleThird = (): void => {
    this._setThirdOpen(!this.isThirdOpen);
    this.dispatchEvent(new CustomEvent('third-column-toggle', { detail: { open: this.isThirdOpen } }));
  };

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
      transition: flex-grow var(--dur-pane) var(--ease-settle);
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
    .pane.right {
      overflow: visible;
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
    const rightGrow = this.isThirdOpen ? this._right : 0;
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
    const growTotal = this._left + middleGrow + rightGrow;
    const share = (g: number) => (growTotal > 0 ? g / growTotal : 0);
    const leftFlex = `${share(this._left)} 1 0%`;
    /*
     * A PANE WITH NOTHING IN IT GETS NO SHARE OF THE WIDTH — and it has to be withheld HERE,
     * because these two lines are written into the pane's own `style` attribute. An inline
     * style beats every selector, so the `.pane.right.empty` rule that was supposed to zero an
     * empty pane could never win: measured 2026-09-18, an empty right pane at 526px with the
     * class applied and the width untouched — the owner's "weird large space on the right hand
     * side when you click one of the navigation menu", which was her panel living inside the
     * flow view's container instead of in her own column.
     */
    const rightFlex = this._hasRight ? `${share(rightGrow)} 1 0%` : '0 0 0';

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
      <div class="pane right ${this.isThirdOpen ? '' : 'collapsed'} ${this._hasRight ? '' : 'empty'}" style="flex: ${rightFlex}; min-width: ${this._hasRight ? WorkspaceLayout.MIN_RIGHT_PX : 0}px;">
        <slot name="right" @slotchange=${this._onRightSlotChange}></slot>
      </div>
    `;
  }

  /** A change to the column's state is also a change to what the panel is told. */
  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('isThirdOpen')) this._syncRightPanel();
  }
}

customElements.define('workspace-layout', WorkspaceLayout);

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
