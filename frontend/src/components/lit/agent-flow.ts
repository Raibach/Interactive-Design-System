/**
 * <agent-flow> — the flow, drawn.
 *
 * WHAT IT IS. Given a graph (lit/../shared/agentFlow.ts) it draws the canvas the
 * output column shows on Run: a dot grid, nodes with a glyph, a label and a mark,
 * and bezier edges between their ports. It draws what it is given and nothing else —
 * it fetches nothing, it composes no sentence about a node, and it never edits the
 * graph. Positions the person drags are the ONE thing it owns, and they leave the
 * element only as an event.
 *
 * WHY IT OWNS ITS NODES RATHER THAN BEING HANDED THEM. The renderer resolves a
 * container's children as an ID array or as named slots — there is no dynamic
 * template form (a2ui-renderer.ts, childRefs), so a surface cannot say "draw one
 * node per item of /flow/nodes". The canvas therefore draws from the bound array,
 * which is the same shape <trace-feed> uses for its entries: bound props in, events
 * out, no fetching.
 *
 * THE NODE BODY IS ONE FUNCTION. Everything inside a tile is _nodeBody(); the tile
 * frame, its position, its ports, its selection ring and its mark are the canvas's.
 * That split is deliberate: the node's own artwork is being designed in Figma, and
 * when it arrives it replaces that one function (or becomes its own element the
 * canvas instantiates per node) without touching anything else here.
 *
 * OUT — FOUR EVENTS, AND WHAT THEY ARE FOR. `flow-select`, `flow-node-moved`,
 * `flow-connect`, `flow-action`. They are the element's whole voice, and the reason
 * it can sit in a column beside Grace while she talks: the same events that a host
 * logs today are what HER SEAT will render — the list of what the canvas is doing,
 * loaded into one of the chat panel's simple slots, so she can speak about the run
 * while the person keeps working the drawing. See AGENTIC_EDITOR/08 for the contract
 * and /canvas.html for the working example of that loop.
 *
 * A CONTROL THAT CANNOT DO ITS JOB IS NOT DRAWN AS IF IT COULD. The two right-edge
 * actions whose meaning is still undecided (find, save — see
 * AGENTIC_EDITOR/04-CANVAS-INTERACTION.md) still emit, and the host answers them
 * visibly; nothing here pretends. No node is draggable into a state the app does not
 * store: the graph is rebuilt from the session on every fact, so a dragged layout
 * survives only as this element's own memory.
 *
 * Figma: the output column's own selector tile draws the words "Agent Flow"
 * (40001034:1190) — this element is what that name means. The canvas chrome below is
 * the REFERENCE's geometry (n8n's canvas, see AGENTIC_EDITOR/reference/), not a
 * Figma node: no node of this drawing exists yet, so nothing here claims a node id.
 */
import { LitElement, html, css, nothing, svg } from 'lit';
import { designTokens } from '@/shared/design-tokens';
import { CREATABLE_KINDS, NODE_TILE, type FlowGraph, type FlowNode } from '@/shared/agentFlow';

const LABEL_BLOCK = 54;
/** How far the connection curve leaves a port before it bends. */
const CURVE = 48;
/** Room past the last node for the layer's box: a curve's overshoot and a node in motion. */
const EDGE_PAD = 160;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 1.2;
/** How far past the column's right edge the drawing runs on arrival — the pan's cue. */
const START_OVERHANG = 44;
/** The corner's padding: where the flow's first node is put, and how far down. */
/**
 * HOW LONG A GLIDE TAKES — the application's own pane duration, because that is the motion
 * this whole interface moves on (workspace-layout's `--dur-pane`: 520ms on the settle
 * curve). It belongs to the moves the ELEMENT makes; a hand's moves are exact. See _glide.
 */
const GLIDE_MS = 520;

const START_PAD_X = 58;
const START_PAD_Y = 44;
/** The grid's spacing at zoom 1. */
const GRID = 24;

/**
 * A port's side. Four per node — see _nodeView — because a flow that only runs
 * left-to-right draws a stacked prompt as a series of loops out to the right and back,
 * which is what the drawing looked like before this existed.
 */
type Side = 'left' | 'right' | 'top' | 'bottom';

/** The side of a node that faces the other way round. */
const OPPOSITE: Record<Side, Side> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' };

export class AgentFlow extends LitElement {
  static properties = {
    /** The graph to draw: { label, nodes, edges, unresolved, absent }. */
    flow: { type: Object },
    /**
     * The palette: unset draws in the app's light design sheet, 'dark' draws the
     * canvas as the reference draws it. A property rather than a host-page trick,
     * because the canvas is a plug-in: where it is dropped should not decide how it
     * looks, and a demo that needs the dark surface asks for it.
     */
    theme: { type: String, attribute: 'theme', reflect: true },
    /**
     * Which TOOL the canvas is in. `''` is select — click to select, drag a port to
     * connect; `'hand'` makes the canvas itself draggable. There are no scrollbars
     * anywhere, so the hand is the only way the view moves, which is why it is a
     * button on the canvas and not a hidden modifier.
     */
    mode: { type: String, attribute: 'mode', reflect: true },
    /** True while the hand is holding the canvas — the grabbing cursor. */
    panning: { type: Boolean, state: true },
    /** Protected: selection is the operator's, never the payload's. */
    selectedId: { type: String, attribute: false },
    zoom: { type: Number, attribute: false },
    panX: { type: Number, attribute: false },
    panY: { type: Number, attribute: false },
  };

  declare flow: FlowGraph | undefined;
  declare theme: string;
  declare mode: string;
  declare panning: boolean;
  declare selectedId: string | null;
  declare zoom: number;
  declare panX: number;
  declare panY: number;

  /** Drag-positions, by node id. The only state this element owns. */
  private _pos = new Map<string, { x: number; y: number }>();

  private _drag: { id: string; startClientX: number; startClientY: number; x0: number; y0: number; moved: boolean } | null = null;
  private _pan: { startClientX: number; startClientY: number; x0: number; y0: number; moved: boolean } | null = null;
  /**
   * A connection being drawn. `from`/`side` is the port the line leaves; `editKey` is
   * set when the person grabbed the END OF AN EXISTING LINE rather than a free port —
   * the same gesture with two meanings (re-attach it, or pull a new node out).
   */
  private _connect: { from: string; side: Side; x: number; y: number; editKey?: string } | null = null;

  /**
   * THE PERSON'S OWN EDITS — inside the canvas, and nowhere else yet.
   *
   * Nodes they dropped, lines they drew, endpoints they moved. None of it is written
   * back into the application: that is held deliberately, and recorded in
   * AGENTIC_EDITOR/10-TODO.md (W1/W2). A draft node carries an `unsaved` badge so the
   * drawing cannot look saved while it is not — the failure this repo keeps finding is
   * a surface that looks like it did something it did not.
   */
  private _draftNodes: FlowNode[] = [];
  private _draftEdges: Array<{ from: string; to: string; fromSide?: Side; toSide?: Side }> = [];
  /** Endpoints the person moved, keyed by the line they grabbed. */
  private _rewired = new Map<string, { to: string; toSide?: Side }>();
  /** The kind picker, open at a drop point — what kind of node goes here? */
  private _picker: { x: number; y: number; from: string; side: Side; editKey?: string } | null = null;
  private _draftSeq = 0;

  constructor() {
    super();
    this.flow = undefined;
    this.theme = '';
    this.mode = '';
    this.panning = false;
    this.selectedId = null;
    this.zoom = 1;
    this.panX = 48;
    this.panY = 24;
  }

  // ── the pointer: one gesture at a time, and it never outlives the element ──
  //
  // Listeners go on window for the duration of a gesture, because a pointer that
  // leaves this element's box mid-drag must keep dragging. They are removed by the
  // release, and again by disconnectedCallback: a surface re-render replaces this
  // element mid-gesture, and a drag whose flag outlived its element kept resizing a
  // pane on every move with no way to let go (workspace-layout.ts, measured
  // 2026-09-17). The same failure is not repeated here.

  private _onNodeDown = (e: PointerEvent, n: FlowNode): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    // THE HAND PANS FROM ANYWHERE. With it chosen, a press that lands on a tile is
    // still a press on the canvas — the tile comes along with everything else instead
    // of being dragged out of place.
    if (this.mode === 'hand') {
      this._pan = { startClientX: e.clientX, startClientY: e.clientY, x0: this.panX, y0: this.panY, moved: false };
      window.addEventListener('pointermove', this._onMove);
      window.addEventListener('pointerup', this._onUp);
      window.addEventListener('pointercancel', this._onUp);
      return;
    }
    this._select(n.id);
    this._viewTouched = true;
    const p = this._nodePos(n);
    this._drag = { id: n.id, startClientX: e.clientX, startClientY: e.clientY, x0: p.x, y0: p.y, moved: false };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  };

  private _onCanvasDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    if (this._picker) {
      this._picker = null;
      this.requestUpdate();
      return;
    }
    // ANYTHING INTERACTIVE STOPS THE EVENT BEFORE IT REACHES HERE — nodes, ports, the
    // node toolbar, both control clusters all call stopPropagation on pointerdown. So
    // a pointerdown that ARRIVES is the background, whatever element the browser names
    // as its target.
    //
    // The identity check that used to sit here compared the target against the canvas
    // element itself. In a real browser the target of a press on empty canvas is the
    // GRID DIV laid over it, so the comparison failed on every press and the canvas
    // could not be dragged at all — while the tests stayed green, because they
    // dispatch straight at the element and never see a target it does not own.
    // Measured 2026-09-18 in the app: a real mouse drag moved nothing.
    this._pan = { startClientX: e.clientX, startClientY: e.clientY, x0: this.panX, y0: this.panY, moved: false };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  };

  private _onMove = (e: PointerEvent): void => {
    if (this._drag) {
      const dx = (e.clientX - this._drag.startClientX) / this.zoom;
      const dy = (e.clientY - this._drag.startClientY) / this.zoom;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) this._drag.moved = true;
      this._pos.set(this._drag.id, { x: Math.max(0, this._drag.x0 + dx), y: Math.max(0, this._drag.y0 + dy) });
      this.requestUpdate();
      return;
    }
    if (this._pan) {
      // GRABBING THE CANVAS MOVES IT — anywhere that is not a node, in EITHER tool.
      // There are no scrollbars, so this is the only way the view travels, and making
      // a person switch tools first would be a rule with no reason behind it. The hand
      // still means something: it pans from anywhere, nodes included (see _onNodeDown).
      const dx = e.clientX - this._pan.startClientX;
      const dy = e.clientY - this._pan.startClientY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this._pan.moved = true;
      if (this._pan.moved) {
        // Taking hold of the canvas is taking the view — see _viewTouched.
        this._viewTouched = true;
        this.panning = true;
      }
      // A HAND ON THE DRAWING ALWAYS WINS, and it never animates: a glide that outlived
      // the grab would drag the drawing out from under the pointer (see _glide).
      this._stopGlide();
      this.panX = this._pan.x0 + dx;
      this.panY = this._pan.y0 + dy;
      this.requestUpdate();
      return;
    }
    if (this._connect) {
      // The live end of the connection follows the pointer, in canvas units.
      const rect = this.getBoundingClientRect();
      this._connect = {
        from: this._connect.from,
        side: this._connect.side,
        editKey: this._connect.editKey,
        x: (e.clientX - rect.left - this.panX) / this.zoom,
        y: (e.clientY - rect.top - this.panY) / this.zoom,
      };
      this.requestUpdate();
    }
  };

  private _onUp = (): void => {
    this._detach();
    if (this._drag) {
      const { id, moved } = this._drag;
      const p = this._pos.get(id);
      const node = this._node(id);
      // ONCE, on release, and only when it moved: a click is a selection, not a move.
      if (moved && p && node) {
        this.dispatchEvent(new CustomEvent('flow-node-moved', {
          bubbles: true, composed: true, detail: { nodeId: id, x: Math.round(p.x), y: Math.round(p.y) },
        }));
      }
      this._drag = null;
      this.requestUpdate();
      return;
    }
    if (this._pan) {
      const moved = this._pan.moved;
      this._pan = null;
      this.panning = false;
      // A click on the background is a deselect; a pan that moved is not a click.
      if (!moved) this._select(null);
      else this.requestUpdate();
      return;
    }
    if (this._connect) {
      // RELEASED ON NOTHING — the person pulled a line into empty space, which is a
      // request for a node there. The picker opens at the drop point.
      this._picker = {
        x: this._connect.x,
        y: this._connect.y,
        from: this._connect.from,
        side: this._connect.side,
        editKey: this._connect.editKey,
      };
      this._connect = null;
      this.panning = false;
      this.requestUpdate();
    }
  };

  private _detach(): void {
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
  }

  /**
   * DOES THIS ELEMENT HAVE A BOX YET?
   *
   * Fit is meaningless without one, and the first version of this control was worse
   * than useless in that state: `fit()` returned early and the button did nothing at
   * all, silently — the exact shape this repo refuses (a control that reads as
   * working and is not). So the state is measured and the control disables itself
   * until there is something to fit.
   *
   * Read during render rather than tracked as state: a box read is cheap, it must
   * be the CURRENT box, and a state flag would mean flipping it from a lifecycle
   * hook — which is an update scheduled from inside an update, and Lit says so out
   * loud (change-in-update). One measurement per render is the honest price.
   */
  private get _hasBox(): boolean {
    const r = this.getBoundingClientRect();
    return r.width >= 2 && r.height >= 2;
  }

  disconnectedCallback(): void {
    this._detach();
    this._drag = null;
    this._pan = null;
    this._connect = null;
    super.disconnectedCallback();
  }

  /** Start a connection from a node's output port. */
  private _onPortDown = (e: PointerEvent, n: FlowNode, side: Side, editKey?: string): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    this._picker = null;
    const p = this._portPoint(n, side);
    const away = this._bend(p, side, CURVE);
    this._connect = { from: n.id, side, x: away.x, y: away.y, editKey };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  };

  /** Grabbing the END OF AN EXISTING LINE: the same drag, meaning "move this end". */
  private _onHandleDown = (e: PointerEvent, key: string, from: string, to: string): void => {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    const node = this._node(from);
    if (!node) return;
    const side = this._sidesFor(node, this._node(to) ?? node).from;
    this._onPortDown(e, node, side, key);
  };

  /**
   * A DROP. On a port, the line lands there — a new one, or the end of a line that was
   * grabbed (which is a re-attach). On nothing, the picker opens where it was dropped:
   * the person is asking for a NODE THERE, and the one question the canvas cannot answer
   * for itself is what kind of node it is.
   */
  private _onPortUp = (e: PointerEvent, n: FlowNode, side: Side): void => {
    const connect = this._connect;
    if (!connect || connect.from === n.id) return;
    e.stopPropagation();
    this._connect = null;
    this._detach();
    if (connect.editKey) {
      this._rewired.set(connect.editKey, { to: n.id, toSide: side });
    } else {
      this._draftEdges.push({ from: connect.from, to: n.id, fromSide: connect.side, toSide: side });
    }
    this.dispatchEvent(new CustomEvent('flow-connect', {
      bubbles: true, composed: true,
      detail: { from: connect.from, fromSide: connect.side, to: n.id, toSide: side, rewired: Boolean(connect.editKey) },
    }));
    this.requestUpdate();
  };

  /**
   * MAKE THE NODE the picker was opened for, and wire it to the port the line came from.
   *
   * The kinds offered are the prompt's own seats (`CREATABLE_KINDS`, derived from
   * `SECTION_TYPES`) — this is the alternate view of the same vocabulary, not a second
   * one. The node is a DRAFT: it lives in this element, carries an `unsaved` badge, and
   * is not in the session. Writing it back is held (AGENTIC_EDITOR/10-TODO.md W1).
   */
  private _addNodeAt(kind: string, label: string): void {
    const picker = this._picker;
    if (!picker) return;
    const id = 'draft:' + (++this._draftSeq);
    const x = Math.max(0, Math.round(picker.x - NODE_TILE / 2));
    const y = Math.max(0, Math.round(picker.y - NODE_TILE / 2));
    const node: FlowNode = {
      id,
      family: 'seat',
      kind,
      title: label,
      subtitle: 'unsaved — not in the session yet',
      state: 'idle',
      badge: 'unsaved',
      x,
      y,
    };
    this._draftNodes.push(node);
    this._pos.set(id, { x, y });
    const enterSide = OPPOSITE[picker.side];
    if (picker.editKey) this._rewired.set(picker.editKey, { to: id, toSide: enterSide });
    else this._draftEdges.push({ from: picker.from, to: id, fromSide: picker.side, toSide: enterSide });
    this._picker = null;
    this.dispatchEvent(new CustomEvent('flow-node-added', {
      bubbles: true, composed: true,
      detail: { nodeId: id, kind, x, y, from: picker.from, fromSide: picker.side, rewired: Boolean(picker.editKey) },
    }));
    this.requestUpdate();
  }

  // ── selection, zoom, pan ───────────────────────────────────────────────────

  private _select(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.dispatchEvent(new CustomEvent('flow-select', {
      bubbles: true, composed: true, detail: { nodeId: id },
    }));
  }

  private _zoomBy(factor: number, aboutX?: number, aboutY?: number): void {
    // A zoom is the operator taking the view — see _viewTouched. And a hand on the view
    // ends any glide: easing this would make the drawing chase the wheel.
    this._stopGlide();
    this._viewTouched = true;
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this.zoom * factor));
    if (next === this.zoom) return;
    const rect = this.getBoundingClientRect();
    const cx = aboutX ?? rect.width / 2;
    const cy = aboutY ?? rect.height / 2;
    // The point under the cursor stays put; the rest of the canvas scales around it.
    const k = next / this.zoom;
    this.panX = cx - (cx - this.panX) * k;
    this.panY = cy - (cy - this.panY) * k;
    this.zoom = next;
    this.dispatchEvent(new CustomEvent('flow-action', {
      bubbles: true, composed: true, detail: { action: 'zoom', zoom: next },
    }));
  }

  private _onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.getBoundingClientRect();
    this._zoomBy(e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, e.clientX - rect.left, e.clientY - rect.top);
  };

  /**
   * Fit the drawing to the view — the one view operation a HOST may call.
   *
   * Public on purpose (it was private while the element was only ever driven by its
   * own controls): a canvas dropped into a column should be able to fit itself on
   * arrival without simulating a click. Everything else about the view is the
   * element's own, and stays that way.
   */
  fit(): void {
    this._applyFit();
    this.dispatchEvent(new CustomEvent('flow-action', {
      bubbles: true, composed: true, detail: { action: 'fit' },
    }));
  }

  /**
   * ANNOUNCE THE DRAWING WHEN IT ARRIVES — the canvas's half of the conversation.
   *
   * The moment a host hands over a graph, the element says what it got: the label,
   * how many notes, seats and steps, and every row it could not name or step it did
   * not draw. THAT is the information the chat needs — and the canvas should not
   * carry it. The canvas stays the clean working area; Grace is the one who reads the
   * summary out, asks about the unnamed rows, and offers to run it. Their product
   * pours logs and controls into the canvas; ours keeps the canvas quiet and puts the
   * noise in the conversation where a person can answer it.
   *
   * Once per DOCUMENT, not per state: a run rebuilds the graph at every await, and an
   * announcement per rebuild would be six of the same sentence. The label is the
   * document's name, so a changed label announces and a changed state does not.
   */
  private _announcedLabel: string | null = null;

  protected updated(): void {
    const flow = this.flow;
    if (!flow) return;
    const label = flow.label ?? '';
    if (label === this._announcedLabel) return;
    this._announcedLabel = label;
    this.dispatchEvent(new CustomEvent('flow-opened', {
      bubbles: true, composed: true, detail: this._summary(flow),
    }));
    // A NEW DOCUMENT ARRIVES BLOWN UP AT ITS BEGINNING — see startView — unless the
    // person has already taken the view themselves.
    if (!this._viewTouched) this.startView();
  }

  /**
   * THE ARRIVAL VIEW — the flow blown up at its beginning, NOT shrunk to fit.
   *
   * Fitting the whole graph on arrival sounds helpful and is not: a twelve-node run
   * lands as a postage stamp nobody can read, and what a person wants first is the
   * START of it, at a size where the words are legible. So the canvas opens at reading
   * size on the first nodes and the person PANS THROUGH the flow — there are no
   * scrollbars anywhere, so the hand and the wheel are how the view travels — and
   * zooming out (or Fit, or the 0 key) is there whenever the whole shape is wanted at
   * once. Untouched views only: once the person has panned or zoomed, it is theirs.
   */
  startView(): void {
    const rect = this.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;

    // TOP-LEFT, TIGHT, AND WITH A DELIBERATE OVERHANG.
    //
    // The first nodes sit just inside the corner; the drawing is then sized so that it
    // runs past the right edge by OVERHANG pixels, so the last node is half-hidden under
    // the chat. That is not a leftover — it is the load: a person who sees a node cut
    // off at the edge reaches for the canvas and pans, which is the discovery the owner
    // wanted ("so that people realize there's a pan feature"). A constant zoom could not
    // promise it, because the column's width is the host's business: the peek has to be
    // computed from the box, not assumed.
    const nodes = this._allNodes();
    let maxX = 0;
    for (const n of nodes) maxX = Math.max(maxX, this._nodePos(n).x + NODE_TILE);
    const span = Math.max(1, maxX);
    const fit = (rect.width + START_OVERHANG - START_PAD_X) / span;
    // READING SIZE, AND NEVER MAGNIFIED: 1:1 is the ceiling. The drawing is the size the
    // owner drew it — a tile is 88px, labels and all — so the canvas looks the same on
    // every screen and in every column, and a person's muscle memory for a node is worth
    // something. It SHRINKS only when a long flow would not fit.
    //
    // What falls outside the column is the peek: the drawing's own width decides it, not
    // a number chosen here. A column narrower than the flow cuts it (and the bottom row
    // is always cut — four rows of a staircase are taller than most panes), which is the
    // cue that says the canvas moves. A column wider than the flow has room to spare and
    // nothing to discover, which is the truth of that case.
    this.zoom = Math.min(1, Math.max(MIN_ZOOM, fit));
    this.panX = START_PAD_X;
    this.panY = START_PAD_Y;
    this.requestUpdate();
  }

  /** The graph in the terms a conversation needs: counts, and what could not be drawn. */
  private _summary(flow: FlowGraph): Record<string, unknown> {
    const count = (family: string): number => (flow.nodes ?? []).filter((n) => n.family === family).length;
    return {
      label: flow.label,
      notes: count('note'),
      seats: count('seat'),
      steps: count('step'),
      unresolved: flow.unresolved ?? [],
      absent: flow.absent ?? [],
      /*
       * THE SEATS WITH NOTHING IN THEM, carried with everything else the announcement says.
       *
       * A blank seat used to pass in silence: the drawing showed an empty tile and Grace said
       * nothing, so the most likely first move — open a prompt that has not been written in,
       * run it — produced a picture and a quiet chat. The owner (2026-09-18): "we need to send
       * her a notification for blank nodes, and tell her to load a section in the chat that
       * represents them, just simply say they're blank — would you like to work on this one?"
       *
       * The element knows which are blank (a seat's subtitle is its content's first line, so an
       * empty one is empty) and the host knows how to speak, so the list travels with the
       * announcement rather than being rediscovered by every host.
       */
      blanks: (flow.nodes ?? [])
        .filter((n) => n.family === 'seat' && !String(n.subtitle ?? '').trim())
        .map((n) => ({ id: n.id, title: n.title })),
    };
  }

  /**
   * PUT A NODE UNDER THE PERSON'S EYES — the chat's half of the conversation.
   *
   * Grace says "this is the row that could not be named"; the host calls this with
   * that node's id and the canvas centres it and selects it, so her sentence and the
   * picture agree about which thing is being discussed. Returns false when there is
   * no such node (or no box to move), so a caller can say it did not point rather
   * than pretending it did.
   *
   * Named focusNode, not focus: focus is HTMLElement's own — the element must not
   * shadow the DOM's contract with one of its own.
   */
  /**
   * A GLIDE IS A MOVE THE ELEMENT MAKES FOR SOMEONE ELSE; a drag is not.
   *
   * Clicking a turn in her chat pans this drawing to the node it is about. That move used
   * to be instant — a jump-cut across the canvas — and the owner's note (2026-09-18) is the
   * rule: "it should move with some sort of gentle movement, easing, not jerk to that
   * position."
   *
   * So this flag is on for exactly the moves the ELEMENT initiates (focusNode), and off for
   * every move a HAND initiates (a pan, a wheel, a zoom button, a fit). It is the same
   * distinction the seat's column makes between its rail's click-driven arrival and a grip
   * being dragged — and for the same reason: easing a drag makes the drawing chase the
   * pointer, and NOT easing a jump-cut makes a 1,500px travel read as a teleport.
   */
  private _glide = false;
  private _glideTimer: number | null = null;

  /** End any glide, at once — the settle curve belongs to the element's own moves only. */
  private _stopGlide(): void {
    if (this._glideTimer !== null) {
      window.clearTimeout(this._glideTimer);
      this._glideTimer = null;
    }
    if (!this._glide) return;
    this._glide = false;
    this.requestUpdate();
  }

  focusNode(nodeId: string): boolean {
    const node = this._node(nodeId);
    if (!node) return false;
    const rect = this.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return false;
    const p = this._nodePos(node);
    const target = this.zoom < 0.6 ? 0.75 : this.zoom;
    // THE TRAVEL IS ANIMATED, the arrival is exact: the transform glides to the numbers
    // below and the numbers are the numbers. See _glide.
    this._glide = true;
    if (this._glideTimer !== null) window.clearTimeout(this._glideTimer);
    this._glideTimer = window.setTimeout(() => this._stopGlide(), GLIDE_MS + 60);
    this.zoom = target;
    this.panX = rect.width / 2 - (p.x + NODE_TILE / 2) * target;
    this.panY = rect.height / 2 - (p.y + (NODE_TILE + LABEL_BLOCK) / 2) * target;
    // The view now belongs to the conversation, not to the next resize: a re-fit
    // would take the node straight back off screen while she is talking about it.
    this._viewTouched = true;
    this.requestUpdate();
    this._select(nodeId);
    return true;
  }

  /**
   * THE VIEW, AS DATA — where the drawing was panned and zoomed, for a package to keep.
   *
   * The package does not own this. Pan and zoom are this element's own state and the save
   * READS them off it (owner, 2026-09-18: "I pan and zoom live inside the bar… the element
   * holds them, the package doesn't. That's a small contract, the same kind"). Nothing is
   * stored here and nothing is announced: a save asks, and this answers.
   */
  viewState(): { zoom: number; panX: number; panY: number } {
    return { zoom: this.zoom, panX: this.panX, panY: this.panY };
  }

  /**
   * PUT THE VIEW BACK — without animating, and without a re-fit taking it away.
   *
   * A restored view is the operator's own arrangement, so it is marked touched: the same flag
   * a pan sets, and the reason a package comes back where it was left instead of snapping to a
   * fit that has never seen the person's screen.
   *
   * Anything that is not a complete, finite view changes NOTHING and returns false — a
   * half-written record must not move a drawing.
   */
  applyViewState(view: { zoom?: number; panX?: number; panY?: number } | null | undefined): boolean {
    if (!view) return false;
    const { zoom, panX, panY } = view;
    if (!Number.isFinite(zoom) || !Number.isFinite(panX) || !Number.isFinite(panY)) return false;
    this.zoom = zoom as number;
    this.panX = panX as number;
    this.panY = panY as number;
    this._viewTouched = true;
    this.requestUpdate();
    return true;
  }

  /** The arithmetic, without the announcement — arrivals and re-fits use this. */
  private _applyFit(): void {
    this._stopGlide();
    const nodes = this._allNodes();
    if (!nodes.length) return;
    const rect = this.getBoundingClientRect();
    // NO BOX, NO FIT. Before first layout — or in a host that has not sized the
    // element yet — the rect is zero, and fitting a drawing to nothing is how a
    // canvas arrives zoomed to its floor in the corner of a container that was
    // about to be 900px wide. Measured on /canvas.html 2026-09-18.
    if (rect.width < 2 || rect.height < 2) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) {
      const p = this._nodePos(n);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + NODE_TILE);
      maxY = Math.max(maxY, p.y + NODE_TILE + LABEL_BLOCK);
    }
    const w = rect.width;
    const h = rect.height;
    const pad = 48;
    const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min((w - pad * 2) / (maxX - minX), (h - pad * 2) / (maxY - minY))));
    this.zoom = zoom;
    this.panX = (w - (maxX - minX) * zoom) / 2 - minX * zoom;
    this.panY = (h - (maxY - minY) * zoom) / 2 - minY * zoom;
    this.requestUpdate();
  }

  /**
   * Has the OPERATOR taken the view — panned, zoomed, dragged?
   *
   * The third column's law, applied to pan and zoom: the canvas comes along when its
   * column changes shape, until the person moves the view themselves. After that the
   * view is THEIRS, and a resize must not yank their drawing off screen. This is the
   * same failure as a payload re-asserting a toggle the operator just flipped, in a
   * new costume — so it gets the same guard.
   */
  private _viewTouched = false;
  private _ro: ResizeObserver | null = null;

  /**
   * THE CONTAINER CHANGED — the whole of what "responsive" means here.
   *
   * The CSS fills the column at any width. This re-fits the DRAWING when the column
   * changes shape — narrower in a split, wider when the prompt docks, taller when the
   * seat opens — and only while the view is still ours. A host can size the element
   * however it likes; the canvas will look composed in it either way.
   */
  private _onResize = (): void => {
    if (this._viewTouched) return;
    this.startView();
  };

  connectedCallback(): void {
    super.connectedCallback();
    if (typeof ResizeObserver !== 'undefined') {
      this._ro = new ResizeObserver(() => this._onResize());
      this._ro.observe(this);
    }
  }

  private _action(action: string, detail: Record<string, unknown> = {}): void {
    this.dispatchEvent(new CustomEvent('flow-action', {
      bubbles: true, composed: true, detail: { action, ...detail },
    }));
  }

  /**
   * Choose the tool. `''` selects; `'hand'` carries the canvas.
   *
   * A tool is a mode, so it stays until the other one is chosen — the same as every
   * drawing program. It is announced (`flow-action: tool`) because a host may want to
   * know what the person is doing, and it is NOT a view gesture, so it is not hidden
   * from the event list the way zoom and fit are.
   */
  private _setMode(mode: '' | 'hand'): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this._action('tool', { mode: mode || 'select' });
    this.requestUpdate();
  }

  private _onKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this._select(null);
      return;
    }
    if (e.key === '+' || e.key === '=') { this._zoomBy(ZOOM_STEP); return; }
    if (e.key === '-' || e.key === '_') { this._zoomBy(1 / ZOOM_STEP); return; }
    if (e.key === '0') { this.fit(); return; }
    // The two tools, on the keys a drawing program teaches: V selects, H is the hand.
    if (e.key === 'v' || e.key === 'V') { this._setMode(''); return; }
    if (e.key === 'h' || e.key === 'H') { this._setMode('hand'); return; }
    const node = this.selectedId ? this._node(this.selectedId) : null;
    if (!node) return;
    const step = e.shiftKey ? 10 : 1;
    const p = this._nodePos(node);
    const move: Record<string, { dx: number; dy: number }> = {
      ArrowLeft: { dx: -step, dy: 0 }, ArrowRight: { dx: step, dy: 0 },
      ArrowUp: { dx: 0, dy: -step }, ArrowDown: { dx: 0, dy: step },
    };
    const m = move[e.key];
    if (m) {
      e.preventDefault();
      this._pos.set(node.id, { x: Math.max(0, p.x + m.dx), y: Math.max(0, p.y + m.dy) });
      const np = this._pos.get(node.id)!;
      this.dispatchEvent(new CustomEvent('flow-node-moved', {
        bubbles: true, composed: true, detail: { nodeId: node.id, x: Math.round(np.x), y: Math.round(np.y) },
      }));
      this.requestUpdate();
    }
  };

  // ── reading the graph ──────────────────────────────────────────────────────

  private _node(id: string): FlowNode | undefined {
    return this._allNodes().find((n) => n.id === id);
  }

  /** A node's drawn position: what the person dragged it to, else what the model said. */
  private _nodePos(n: FlowNode): { x: number; y: number } {
    return this._pos.get(n.id) ?? { x: n.x, y: n.y };
  }

  /** Where an edge leaves a node, and where it lands. Ports sit on the tile's midline. */
  /** Where a node's port sits, in canvas units. */
  private _portPoint(n: FlowNode, side: Side): { x: number; y: number } {
    const p = this._nodePos(n);
    const half = NODE_TILE / 2;
    if (side === 'left') return { x: p.x, y: p.y + half };
    if (side === 'right') return { x: p.x + NODE_TILE, y: p.y + half };
    if (side === 'top') return { x: p.x + half, y: p.y };
    return { x: p.x + half, y: p.y + NODE_TILE };
  }

  /**
   * WHICH SIDE OF EACH NODE FACES THE OTHER — geometry, not a stored choice.
   *
   * A model edge (from the run) carries no sides: the drawing works them out from where
   * the two nodes are. Whichever axis separates them more decides, so a seat stacked
   * under another connects bottom-to-top and a step to the right connects right-to-left
   * — which is what makes four ports worth having.
   */
  private _sidesFor(a: FlowNode, b: FlowNode): { from: Side; to: Side } {
    const pa = this._nodePos(a);
    const pb = this._nodePos(b);
    const dx = (pb.x + NODE_TILE / 2) - (pa.x + NODE_TILE / 2);
    const dy = (pb.y + NODE_TILE / 2) - (pa.y + NODE_TILE / 2);
    if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? { from: 'right', to: 'left' } : { from: 'left', to: 'right' };
    return dy >= 0 ? { from: 'bottom', to: 'top' } : { from: 'top', to: 'bottom' };
  }

  /** A point pushed away from the node along the port's own axis: where the curve bends. */
  private _bend(p: { x: number; y: number }, side: Side, d: number): { x: number; y: number } {
    if (side === 'left') return { x: p.x - d, y: p.y };
    if (side === 'right') return { x: p.x + d, y: p.y };
    if (side === 'top') return { x: p.x, y: p.y - d };
    return { x: p.x, y: p.y + d };
  }

  private _edgePath(from: FlowNode, to: FlowNode, fromSide?: Side, toSide?: Side): string {
    const sides = fromSide && toSide ? { from: fromSide, to: toSide } : this._sidesFor(from, to);
    const p1 = this._portPoint(from, sides.from);
    const p2 = this._portPoint(to, sides.to);
    const bend = Math.max(CURVE, Math.min(160, Math.abs(p1.x - p2.x) / 2 + Math.abs(p1.y - p2.y) / 2));
    const c1 = this._bend(p1, sides.from, bend);
    const c2 = this._bend(p2, sides.to, bend);
    return 'M ' + p1.x + ' ' + p1.y + ' C ' + c1.x + ' ' + c1.y + ', ' + c2.x + ' ' + c2.y + ', ' + p2.x + ' ' + p2.y;
  }

  private _edgeKey(e: { from: string; to: string }): string {
    return e.from + '->' + e.to;
  }

  /** Every node drawn: the session's, then the person's own. */
  private _allNodes(): FlowNode[] {
    return [...(this.flow?.nodes ?? []), ...this._draftNodes];
  }

  /** THE LINES AS DRAWN: model and draft edges, with any moved endpoint applied. */
  private _resolvedEdges(): Array<{ key: string; from: string; to: string; fromSide?: Side; toSide?: Side }> {
    return this._allEdges().map((e) => {
      const moved = this._rewired.get(e.key);
      return moved ? { ...e, to: moved.to, toSide: moved.toSide } : e;
    });
  }

  /**
   * WHAT IS ON THE CANVAS NOW — the session's graph PLUS the person's own edits.
   *
   * A host reads here rather than reaching into private state: to list what is drawn, or
   * to save it once writing back exists (AGENTIC_EDITOR/10-TODO.md W1). Reading writes
   * nothing; the drawing stays this element's until a host decides otherwise.
   */
  get drawn(): { nodes: FlowNode[]; edges: Array<{ from: string; to: string }> } {
    return {
      nodes: this._allNodes(),
      edges: this._resolvedEdges().map((e) => ({ from: e.from, to: e.to })),
    };
  }

  /** Every line drawn, each with a stable key so an endpoint can be moved. */
  private _allEdges(): Array<{ key: string; from: string; to: string; fromSide?: Side; toSide?: Side }> {
    const model = (this.flow?.edges ?? []).map((e) => ({ key: this._edgeKey(e), from: e.from, to: e.to }));
    const draft = this._draftEdges.map((e) => ({
      key: this._edgeKey(e), from: e.from, to: e.to, fromSide: e.fromSide, toSide: e.toSide,
    }));
    return [...model, ...draft];
  }

  // ── the parts ──────────────────────────────────────────────────────────────

  /**
   * The glyph inside a tile.
   *
   * Family-level on purpose: the per-kind artwork is the design's, and inventing
   * eighteen pictures here would be inventing a design. What this must do is make
   * the three families distinguishable WITHOUT colour — the state mark and the
   * badge already use the tints, so a glyph that needs hue to be read would leave
   * the canvas unreadable in greyscale.
   */
  private _glyph(n: FlowNode): unknown {
    if (n.family === 'note') {
      return html`<svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <path d="M8 10h8M8 14h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>`;
    }
    if (n.family === 'seat') {
      return html`<svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8" />
        <path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" />
      </svg>`;
    }
    return html`<svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8" />
      <path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor" />
    </svg>`;
  }

  /** The mark that says what a node's news is. Idle draws NOTHING — see 04. */
  private _mark(n: FlowNode): unknown {
    if (n.state === 'active') return html`<span class="mark active" title="in flight" aria-hidden="true"></span>`;
    if (n.state === 'done') return html`<span class="mark done" title="done" aria-hidden="true">✓</span>`;
    if (n.state === 'failed') return html`<span class="mark failed" title="failed" aria-hidden="true">⚠</span>`;
    return nothing;
  }

  /**
   * THE NODE BODY — the one function the Figma design replaces.
   * Everything drawn INSIDE the tile lives here; the frame, the ring, the ports,
   * the label, the badge and the toolbar are the canvas's and do not move.
   */
  private _nodeBody(n: FlowNode): unknown {
    return html`
      <span class="glyph">${this._glyph(n)}</span>
      ${this._mark(n)}
    `;
  }

  /** The toolbar the selected node wears. Every control emits; the host answers. */
  private _toolbar(n: FlowNode): unknown {
    const runnable = n.family === 'step';
    return html`
      <div class="tb" @pointerdown=${(e: PointerEvent) => e.stopPropagation()}>
        <button
          class="tb-btn"
          type="button"
          ?disabled=${!runnable}
          aria-label="Run this step"
          title=${runnable ? 'Run this step' : 'Only a step can be run'}
          @click=${() => this._action('run', { nodeId: n.id })}
        >▶</button>
        <button class="tb-btn" type="button" aria-pressed=${n.state === 'failed' ? 'true' : 'false'}
          aria-label="Enable or disable this step" title="Enable or disable"
          @click=${() => this._action('toggle', { nodeId: n.id })}>⏻</button>
        <button class="tb-btn" type="button" aria-label="Delete this node" title="Delete"
          @click=${() => this._action('delete', { nodeId: n.id })}>🗑</button>
        <button class="tb-btn" type="button" aria-label="Ask Grace about this" title="Ask Grace about this"
          @click=${() => this._action('ask', { nodeId: n.id })}>✨</button>
        <button class="tb-btn" type="button" aria-haspopup="menu" aria-label="More" title="More"
          @click=${() => this._action('more', { nodeId: n.id })}>⋯</button>
      </div>
    `;
  }

  private _nodeView(n: FlowNode): unknown {
    const p = this._nodePos(n);
    const selected = this.selectedId === n.id;
    return html`
      <div
        class="node f-${n.family} s-${n.state} ${selected ? 'sel' : ''}"
        style="left: ${p.x}px; top: ${p.y}px;"
        data-node-id=${n.id}
        role="button"
        tabindex="0"
        aria-label=${n.title + (n.state === 'idle' ? '' : ' (' + n.state + ')')}
        @pointerdown=${(e: PointerEvent) => this._onNodeDown(e, n)}
        @keydown=${(e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._select(n.id); } }}
      >
        <div class="tile">
          ${this._nodeBody(n)}
          <!-- FOUR PORTS, and they are quiet until used: a small ring that says where
               a line may leave or land, at full strength only under the pointer. A
               press on one starts a line; releasing it on nothing opens the picker. -->
          ${(['left', 'right', 'top', 'bottom'] as Side[]).map((side) => html`
            <span
              class="port port-${side}"
              data-port=${side}
              title=${side === 'right' ? 'Drag out to add a step' : 'Connect here'}
              role="button"
              aria-label=${'Port, ' + side}
              @pointerdown=${(e: PointerEvent) => this._onPortDown(e, n, side)}
              @pointerup=${(e: PointerEvent) => this._onPortUp(e, n, side)}
            ></span>`)}
        </div>
        <div class="label">${n.title}</div>
        ${n.subtitle ? html`<div class="sub">${n.subtitle}</div>` : ''}
        ${n.badge ? html`<div class="badge b-${n.badge}">${n.badge}</div>` : ''}
        ${selected ? this._toolbar(n) : ''}
      </div>
    `;
  }

  render() {
    const flow = this.flow;

    // Unset is not empty: no graph is "the surface has not written the path", an
    // empty graph is "there is nothing to draw". Two different claims.
    if (!flow) {
      return html`<div class="waiting" role="status">Waiting for the flow…</div>`;
    }
    const nodes = this._allNodes();
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // THE EDGE LAYER'S BOX, FROM THE DRAWING'S OWN BOUNDS.
    //
    // Measured in the app on 2026-09-18: with the layer at 1px and overflow
    // visible, eight paths with correct geometry and correct stroke drew nothing.
    // The bounds below are facts, not a guess — every node's position is known —
    // so the layer is given the viewport its content actually occupies, and the
    // overshoot room is the curve's own leave-distance plus a margin for a node
    // in flight. Positions are clamped at the origin (see _onMove), so the box
    // needs no negative half.
    let extentX = 1;
    let extentY = 1;
    for (const n of nodes) {
      const p = this._nodePos(n);
      extentX = Math.max(extentX, p.x + NODE_TILE + EDGE_PAD);
      extentY = Math.max(extentY, p.y + NODE_TILE + LABEL_BLOCK + EDGE_PAD);
    }

    // The connection being drawn: from the source port to wherever the pointer is.
    let livePath: string | null = null;
    if (this._connect) {
      const from = byId.get(this._connect.from);
      if (from) {
        const p = this._nodePos(from);
        const x1 = p.x + NODE_TILE;
        const y1 = p.y + NODE_TILE / 2;
        const bend = Math.max(CURVE, Math.abs(this._connect.x - x1) / 2);
        livePath = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', '
          + (this._connect.x - bend) + ' ' + this._connect.y + ', '
          + this._connect.x + ' ' + this._connect.y;
        extentX = Math.max(extentX, this._connect.x + EDGE_PAD);
        extentY = Math.max(extentY, this._connect.y + EDGE_PAD);
      }
    }

    return html`
      <div
        class="canvas ${this.mode === 'hand' ? 'mode-hand' : ''} ${this.panning ? 'panning' : ''}"
        tabindex="0"
        role="application"
        aria-label="Agent flow"
        @pointerdown=${this._onCanvasDown}
        @wheel=${this._onWheel}
        @keydown=${this._onKeyDown}
      >
        <div
          class="grid"
          style="background-position: ${this.panX}px ${this.panY}px; background-size: ${GRID * this.zoom}px ${GRID * this.zoom}px;"
          aria-hidden="true"
        ></div>

        <div class="view ${this._glide ? 'glide' : ''}" style="transform: translate(${this.panX}px, ${this.panY}px) scale(${this.zoom});">
          <!-- THE EDGE LAYER USES THE svg TAG, AND IT IS NOT A STYLE CHOICE.
               Measured in the app 2026-09-18: the layer's paths came out as
               HTMLUnknownElement in the XHTML namespace — elements that exist, carry
               the right class and a CORRECT d attribute, and paint nothing. The html
               tag parses a fragment whose first element is a path in HTML context,
               where path is an unknown HTML element; the browser then inserts an
               HTML node inside an SVG tree and SVG's renderer ignores it. The svg tag
               parses the same fragment with an SVG context element, so the paths are
               SVGGraphicsElement and draw. A glyph inside an svg in static markup is
               unaffected — which is why the node artwork drew and the edges did not. -->
          <svg
            class="edges"
            aria-hidden="true"
            viewBox="0 0 ${extentX} ${extentY}"
            style="width: ${extentX}px; height: ${extentY}px;"
          >
            ${this._resolvedEdges().map((e) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return nothing;
              return svg`<path class="edge" d=${this._edgePath(a, b, e.fromSide, e.toSide)} data-from=${e.from} data-to=${e.to}></path>`;
            })}
            ${livePath ? svg`<path class="edge live" d=${livePath}></path>` : nothing}
          </svg>
          <!-- THE END OF EVERY LINE IS GRABBABLE. One handle per line, sitting on the
               port it lands at: press it and the end follows the pointer, so a
               connection can be moved to another port or another node, or pulled out
               into a new one. -->
          <div class="handles">
            ${this._resolvedEdges().map((e) => {
              const target = byId.get(e.to);
              if (!target) return nothing;
              const side = e.toSide ?? this._sidesFor(byId.get(e.from) ?? target, target).to;
              const p = this._portPoint(target, side);
              return html`<span
                class="handle"
                style="left: ${p.x}px; top: ${p.y}px;"
                data-handle-key=${e.key}
                title="Drag this end to another port"
                role="button"
                aria-label="Move this connection's end"
                @pointerdown=${(ev: PointerEvent) => this._onHandleDown(ev, e.key, e.from, e.to)}
              ></span>`;
            })}
          </div>
          ${nodes.map((n) => this._nodeView(n))}
        </div>

        <!-- THE KIND PICKER. It opens where a line was dropped on empty canvas: the one
             question the canvas cannot answer for itself. The kinds are the prompt's own
             seats, so this view and the prompt panel cannot drift apart. -->
        ${this._picker
          ? html`<div class="picker" style="left: ${this._picker.x * this.zoom + this.panX}px; top: ${this._picker.y * this.zoom + this.panY}px;">
              <div class="picker-head">New node — what is it?</div>
              ${CREATABLE_KINDS.map((k) => html`
                <button type="button" class="picker-kind" @click=${() => this._addNodeAt(k.kind, k.label)}>${k.label}</button>`)}
              <button type="button" class="picker-cancel" @click=${() => { this._picker = null; this.requestUpdate(); }}>Cancel</button>
            </div>`
          : nothing}

        <!-- THE EDGE THAT GOES UNDER THE CHAT. The drawing continues past this column
             and the seat sits on top of it; a soft fade at the right edge makes that
             read as "underneath" rather than "cut off", so a node half-covered by the
             chat looks hidden rather than missing. It is not a mask — pan, and the
             thing comes back. -->
        <div class="scrim" aria-hidden="true"></div>

        ${nodes.length === 0
          ? html`<div class="empty" role="status">Nothing to draw yet. A Run builds the flow.</div>`
          : nothing}

        <!-- The undo list the graph deliberately does not decorate: rows that could
             not be named are DRAWN as unresolved nodes, and this says so in words. -->
        ${flow.unresolved?.length
          ? html`<div class="note unresolved" role="status">
              ${flow.unresolved.length} row${flow.unresolved.length === 1 ? '' : 's'} could not be named: ${flow.unresolved.join(', ')}
            </div>`
          : nothing}
        ${flow.absent?.length
          ? html`<div class="note absent" role="status">
              ${flow.absent.map((a) => `${a.step}: ${a.why}`).join(' · ')}
            </div>`
          : nothing}
        <div class="controls bl" @pointerdown=${(e: PointerEvent) => e.stopPropagation()}>
          <button class="ctl" type="button" aria-label="Fit the flow to the view" title="Fit (0)"
            ?disabled=${!this._hasBox}
            @click=${() => this.fit()}>⛶</button>
          <button class="ctl" type="button" aria-label="Zoom in" title="Zoom in (+)"
            ?disabled=${this.zoom >= MAX_ZOOM} @click=${() => this._zoomBy(ZOOM_STEP)}>🔍+</button>
          <button class="ctl" type="button" aria-label="Zoom out" title="Zoom out (−)"
            ?disabled=${this.zoom <= MIN_ZOOM} @click=${() => this._zoomBy(1 / ZOOM_STEP)}>🔍−</button>
          <button class="ctl" type="button" aria-label="Select tool (V)" aria-pressed=${this.mode !== 'hand'}
            title="Select — click a node, drag a port to connect (V)"
            @click=${() => this._setMode('')}>➤</button>
          <button class="ctl" type="button" aria-label="Hand tool — drag the canvas (H)" aria-pressed=${this.mode === 'hand'}
            title="Hand — hold the canvas and move it (H)"
            @click=${() => this._setMode('hand')}>✋</button>
        </div>

        <!-- THE TOP-RIGHT CLUSTER USED TO BE HERE — add, find, save, side-panel, and an
             "ask Grace" that only logged. It is REMOVED, on the owner's instruction
             (2026-09-18): "you can remove these. We don't need them… these come from
             engineers who tend to make feature factories." Four of the five did nothing
             a person could see (each emitted a flow-action with nothing to act on it),
             and the fifth duplicated a conversation that already has a seat: Grace is
             the side panel this canvas is drawn beside, not a button on it. The
             bottom-left cluster stays — those controls move the drawing, and the
             drawing is what this element is for. -->
      </div>
    `;
  }

  static styles = [
    designTokens,
    css`
      /* No backticks in this stylesheet: static styles is a tagged template literal
         and ONE raw backtick ends it — tsc will not say so, esbuild will. */

      :host {
        display: block;
        position: relative;
        width: 100%;
        height: 100%;
        min-height: 0;
        overflow: hidden;
        background: var(--ds-surface);
        font-family: var(--ds-font);
        /* The query container for the rules at the foot of this sheet. */
        container-type: inline-size;
        /* ── THE CANVAS'S LIGHT PALETTE. ──
           THE SURFACE IS THE OWNER'S. EVERYTHING ELSE IS UNCHANGED, on his instruction
           (2026-09-18) — he gave a background colour, and re-tuning the inks, tints, rules
           and dot around it was me inventing work he did not ask for. So the palette is
           exactly what it was, with the surface swapped.

           THE CONSEQUENCE, stated rather than silently corrected: #837b8c is a MID-TONE,
           and these inks were chosen for a darker surface. On this one the body ink
           measures 3.7:1 and the mute 2.2:1 — under the 4.5:1 floor the rest of this
           project keeps. That is a fact about the combination, not a change to make here;
           if the floor matters on this surface, the inks move and the owner says so. */
        --ds-surface: #837b8c;
        --ds-surface-hover: #665b74;
        --ds-text: #f4f4f6;
        --ds-text-strong: #ffffff;
        --ds-muted: #c8cdd3;
        --ds-rule: #6b6178;
        --ds-grey-tint: #6a6079;
        --ds-teal: #8fd0d4;
        --ds-teal-tint: #5f7375;
        --ds-navy: #a8c8ec;
        --ds-navy-tint: #5a6780;
        --ds-amber: #f0b866;
        --ds-amber-tint: #76653f;
        --ds-red: #f08c7f;
        --ds-red-tint: #6e4a44;
        --ds-green: #a8d16a;
        --flow-note-border: #6b5a3c;
        /* THE FIRST NODE'S FILL — the note, the trigger the flow starts from, which is
           the node drawn at the head of the drawing. The owner, 2026-09-18, working
           through the palette a colour at a time: "This is our first node's colour."
           A token of its own rather than --ds-amber-tint, which also fills the advisory
           badge: naming the note's fill must not repaint a mark nobody mentioned. */
        --flow-note-fill: #d69812;
        --flow-seat-border: #4d6668;
        /* THE PROMPT ROLES' FILL — System Role, User Role, Tool Call, Agent Role — the
           owner's colour, 2026-09-18: "all of those should be this colour. The border can
           stay the same, just the fill." A token of its own rather than the shared teal
           tint, because that tint also draws the ports' hover ring: naming the seats' fill
           must not repaint a control nobody mentioned.
           RE-SET TWICE THE SAME DAY, the owner working the palette a colour at a time:
           the brick #8e3e2e read as orange to him, then the olive #826320, and now this
           slate. ONE VALUE FOR BOTH MODES on purpose — his own instruction for this pass,
           "because I want to be a little cautious, I want to use the same colours for each
           mode" — so it is declared here and NOT overridden in the dark block below. */
        --flow-seat-fill: #3d485c;
        --flow-step-border: #4a5c70;
        /* THE CANVAS'S TOOLS — the owner's word — meaning the two framed button clusters
           in the corners: the bottom-left group and the right-hand group. They took
           --ds-surface, which is the canvas's own colour, so they read as holes in the
           drawing instead of controls on it; measured, they were literally the same
           value as the ground. The owner, 2026-09-18: "They need to have a contrasting
           background colour and I think this colour you've used for this node will work
           perfectly" — the node being the step tile, so this is that same navy.
           Its own token, like the seats' fill and the note's, so a later change to the
           steps does not silently repaint the chrome, and vice versa. This is NOT the
           Tool Call seat's fill: that one is --flow-seat-fill. */
        --flow-ctl-fill: #5a6780;
        --flow-done-border: #5d7549;
        --flow-failed-border: #7a453c;
        /* THE DOT, BY THE OWNER'S RULE: the surface's own colour, a couple of shades
           lighter (2026-09-18). It is a token of its own because it has been wrong twice —
           it kept a grey from a darker surface and the grid disappeared, which is the
           failure the token exists to prevent. If a specific value is wanted, this line is
           the only place to change it. */
        --flow-dot: #aaa3b5;
      }
      /* ── DARK ────────────────────────────────────────────────────────────────
         The reference's own surface: a near-black canvas, tiles a shade above it,
         one accent per meaning. EVERY value below is a token the rules further down
         already read, so switching mode is one attribute and not one rule: nothing
         in this stylesheet knows which mode it is drawing. */
      :host([theme='dark']) {
        /* THE OWNER'S DARK SURFACE, AND ONLY THE SURFACE: #26242e (2026-09-18). The inks,
           tints, rules and dot below are the values the palette already had — he asked for
           a background colour, not a re-tune, and the last time I widened that instruction
           I moved the node tints and got it right back. The light inks are comfortably over
           the floor here regardless: #9aa5ae on #26242e is 6.1:1. */
        --ds-surface: #26242e;
        --ds-surface-hover: #2a2346;
        --ds-text: #ececec;
        --ds-text-strong: #f4f4f4;
        --ds-muted: #9aa5ae;
        --ds-rule: #3a3157;
        --ds-grey-tint: #2a2346;
        --ds-teal: #6fb3b8;
        --ds-teal-tint: #1d2b3a;
        --ds-navy: #8ab6e8;
        --ds-navy-tint: #232a4a;
        --ds-amber: #e0a44a;
        --ds-amber-tint: #2f2718;
        --ds-red: #e5776a;
        --ds-red-tint: #33202b;
        --ds-green: #93c352;
        --flow-note-border: #4a3f2a;
        --flow-seat-border: #2f4243;
        --flow-step-border: #2b3a4b;
        --flow-done-border: #3f5030;
        --flow-failed-border: #5a2f28;
        --flow-dot: #352c52;
      }
      .canvas {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        outline: none;
        cursor: default;
      }
      .canvas:focus-visible { outline: 2px solid var(--ds-teal); outline-offset: -2px; }
      /* GRABBING THE CANVAS MOVES IT — in either tool. The cursor says so, because a
         background you can drag under a cursor that says "arrow" is the kind of quiet
         lie this repo keeps finding. The hand differs in WHERE it grabs from: chosen,
         a press that lands on a node pans too, instead of dragging the node. */
      .canvas { cursor: grab; }
      .canvas.panning { cursor: grabbing; }
      .canvas.mode-hand .node { cursor: inherit; }
      .scrim {
        position: absolute; top: 0; right: 0; bottom: 0; width: 64px;
        background: linear-gradient(to right, transparent, var(--ds-surface));
        pointer-events: none;
      }
      .waiting {
        display: flex; align-items: center; justify-content: center;
        height: 100%; color: var(--ds-muted); font-size: var(--ds-fs-md);
      }

      /* The dot grid is drawn, not transformed, so it never blurs and never has to
         be a huge element: only its spacing and offset follow the view. */
      .grid {
        position: absolute; inset: 0;
        background-image: radial-gradient(var(--flow-dot) 1.3px, transparent 1.3px);
        background-repeat: repeat;
      }

      .view {
        position: absolute; top: 0; left: 0;
        transform-origin: 0 0;
        will-change: transform;
      }
      /* THE GLIDE. The panes' own settle curve — the one every pane in this application
         arrives on — because a drawing that jumps 1,500px reads as a teleport and the
         person loses where they were. Only while the glide flag is set: a drag or a wheel
         must stay exact under the hand. (No backticks in this stylesheet — one ends the
         literal, which is exactly how this comment broke it first.) */
      .view.glide { transition: transform ${GLIDE_MS}ms cubic-bezier(0.22, 1, 0.36, 1); }
      @media (prefers-reduced-motion: reduce) {
        .view.glide { transition: none; }
      }
      /* The edge layer's box is set from the drawing's own bounds (see render):
         an SVG sized to one pixel and left to paint outside itself was measured
         drawing NOTHING in Chrome — the paths existed, carried the right geometry
         and the right stroke, and produced no pixels. Content inside the viewport
         is content the browser owes you. */
      .edges { position: absolute; top: 0; left: 0; pointer-events: none; }
      .edge {
        fill: none;
        stroke: var(--ds-muted);
        stroke-width: 1.6;
        vector-effect: non-scaling-stroke;
      }
      .edge.live { stroke: var(--ds-teal); stroke-dasharray: 5 4; }

      .node {
        position: absolute;
        width: ${NODE_TILE}px;
        user-select: none;
        cursor: grab;
        text-align: center;
      }
      .node:active { cursor: grabbing; }
      .node.sel .tile { box-shadow: 0 0 0 3px var(--ds-surface), 0 0 0 6px var(--ds-teal); }
      .node:focus-visible .tile { outline: 2px solid var(--ds-teal); outline-offset: 3px; }

      .tile {
        position: relative;
        width: ${NODE_TILE}px;
        height: ${NODE_TILE}px;
        display: flex; align-items: center; justify-content: center;
        border-radius: 20px;
        background: var(--ds-grey-tint);
        border: 2px solid var(--ds-rule);
        color: var(--ds-text-strong);
        box-sizing: border-box;
      }
      /* The families read apart in GREYSCALE: a note is square-ish and light, a seat
         is rounder and tinted, a step carries the darker frame. Colour only sharpens
         what shape already says. */
      .f-note .tile { background: var(--flow-note-fill); border-color: var(--flow-note-border); }
      .f-seat .tile { background: var(--flow-seat-fill); border-color: var(--flow-seat-border); border-radius: 30px; }
      .f-step .tile { background: var(--ds-navy-tint); border-color: var(--flow-step-border); border-radius: 14px; }
      .s-failed .tile { border-color: var(--ds-red); }
      .s-done .tile { border-color: var(--flow-done-border); }
      .glyph { display: block; width: 40px; height: 40px; }
      .glyph svg { width: 100%; height: 100%; display: block; }

      .mark {
        position: absolute; right: -7px; bottom: -7px;
        width: 20px; height: 20px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; line-height: 1;
        background: var(--ds-surface); border: 1px solid var(--ds-rule);
      }
      .mark.done { color: var(--ds-green); border-color: var(--flow-done-border); }
      .mark.failed { color: var(--ds-red); border-color: var(--flow-failed-border); }
      .mark.active { border-color: var(--ds-teal); }
      .mark.active::after {
        content: ''; width: 8px; height: 8px; border-radius: 50%;
        background: var(--ds-teal);
        animation: af-pulse 1.1s ease-in-out infinite;
      }
      @keyframes af-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.25; } }
      @media (prefers-reduced-motion: reduce) { .mark.active::after { animation: none; } }

      /* FOUR PORTS PER NODE — left, right, top, bottom — and they stay QUIET: a small
         ring, faint until the node is under the pointer, because the drawing leads and
         the handles follow. The right one is where a line leaves to make something new;
         every one of them can end a line. */
      .port {
        position: absolute;
        width: 13px; height: 13px;
        border-radius: 50%;
        background: var(--ds-surface);
        border: 2px solid var(--ds-muted);
        box-sizing: border-box;
        opacity: 0.35;
        cursor: crosshair;
        transition: opacity 0.12s;
      }
      .node:hover .port, .node.sel .port, .port:focus-visible { opacity: 1; }
      .port:hover { border-color: var(--ds-teal); box-shadow: 0 0 0 3px var(--ds-teal-tint); opacity: 1; }
      .port-left { left: -7px; top: 50%; margin-top: -6.5px; }
      .port-right { right: -7px; top: 50%; margin-top: -6.5px; }
      .port-top { top: -7px; left: 50%; margin-left: -6.5px; }
      .port-bottom { bottom: -7px; left: 50%; margin-left: -6.5px; }

      /* THE GRABBABLE END OF A LINE. It sits on the port the line lands at, and it is
         invisible until the line or the handle is hovered — the drawing should read as
         lines, not as a field of dots. */
      .handles { position: absolute; top: 0; left: 0; }
      .handle {
        position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px;
        border-radius: 50%;
        cursor: grab;
        opacity: 0;
        transition: opacity 0.12s;
      }
      .handles:hover .handle, .handle:hover { opacity: 1; }
      .handle::after {
        content: ''; position: absolute; inset: 3px;
        border-radius: 50%;
        background: var(--ds-teal);
        border: 2px solid var(--ds-surface);
        box-sizing: border-box;
      }

      /* THE KIND PICKER, at the drop point. Small, quiet, and it answers one question:
         what kind of node goes here. The list is the prompt's own seats. */
      .picker {
        position: absolute; z-index: 6;
        display: flex; flex-direction: column; gap: 2px;
        min-width: 150px; padding: 6px;
        background: var(--ds-surface);
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
        font-family: var(--ds-font);
      }
      .picker-head {
        padding: 2px 6px 4px;
        font-size: 13px; text-transform: uppercase; letter-spacing: 0.06em;
        color: var(--ds-muted);
      }
      .picker-kind, .picker-cancel {
        font: inherit; font-size: 13px; text-align: left;
        padding: 5px 8px; border: none; border-radius: var(--ds-radius-sm);
        background: transparent; color: var(--ds-text); cursor: pointer;
      }
      .picker-kind:hover { background: var(--ds-teal-tint); }
      .picker-cancel { color: var(--ds-muted); border-top: 1px solid var(--ds-rule-soft, var(--ds-rule)); }
      .picker-cancel:hover { background: var(--ds-surface-hover); }

      .label {
        margin-top: 9px;
        font-size: 13px; font-weight: 600; color: var(--ds-text);
        line-height: 1.25;
      }
      .sub {
        font-size: 13px; color: var(--ds-muted);
        margin-top: 2px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
      }
      .badge {
        display: inline-block; margin-top: 4px;
        font-size: var(--ds-fs-label); text-transform: uppercase; letter-spacing: 0.04em;
        padding: 1px 6px; border-radius: var(--ds-radius-pill);
      }
      .b-blocking { background: var(--ds-red-tint); color: var(--ds-red); }
      .b-advisory { background: var(--ds-amber-tint); color: var(--ds-amber); }
      .b-unresolved { background: var(--ds-grey-tint); color: var(--ds-muted); }

      /* The toolbar a selected node wears. It floats ABOVE the node and takes no
         space in the flow, so selecting a node never moves the picture. */
      .tb {
        position: absolute; left: 50%; top: -46px; transform: translateX(-50%);
        display: flex; gap: 2px; padding: 3px;
        background: var(--ds-surface);
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
        white-space: nowrap;
      }
      .tb-btn {
        width: 26px; height: 26px; padding: 0;
        display: flex; align-items: center; justify-content: center;
        border: none; border-radius: var(--ds-radius-sm);
        background: transparent; color: var(--ds-text);
        font-size: 13px; cursor: pointer;
      }
      .tb-btn:hover:not(:disabled) { background: var(--ds-surface-hover); }
      .tb-btn:disabled { opacity: 0.35; cursor: not-allowed; }
      .tb-btn:focus-visible { outline: 2px solid var(--ds-teal); outline-offset: 1px; }

      .controls {
        position: absolute; display: flex; gap: 6px;
        z-index: 2;
      }
      /* ONE CLUSTER, one corner: the controls that MOVE THE DRAWING. The top-right group
         is gone (see the markup note above), and the host contract it needed went with
         it — --flow-overlay-right existed only to step that cluster left of a column
         laid over the canvas, and nothing left on this element reads it. Removing a
         property a host must remember is a deletion worth having. */
      .controls.bl { left: 12px; bottom: 12px; }
      .ctl {
        width: 32px; height: 32px; padding: 0;
        display: flex; align-items: center; justify-content: center;
        background: var(--flow-ctl-fill);
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        color: var(--ds-text);
        font-size: 13px; cursor: pointer;
      }
      .ctl:hover:not(:disabled) { background: var(--ds-surface-hover); }
      .ctl:disabled { opacity: 0.35; cursor: not-allowed; }
      .ctl:focus-visible { outline: 2px solid var(--ds-teal); outline-offset: 1px; }
      .ctl-ai { color: var(--ds-navy); }

      .empty {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        color: var(--ds-muted); font-size: var(--ds-fs-md);
        pointer-events: none;
      }
      .note {
        position: absolute; left: 12px; bottom: 56px; right: 60px;
        font-size: var(--ds-fs-meta); color: var(--ds-muted);
        pointer-events: none;
      }
      .note.absent { bottom: 40px; }

      /* ── RESPONSIVE ──────────────────────────────────────────────────────────
         A column is what this element is dropped into, and a column is whatever
         width the person has dragged it to: wide when the prompt is docked, narrow
         in a three-pane split, narrower still on a laptop with the chat open. The
         canvas must look composed at all of them, so it answers to ITS OWN BOX —
         container queries, never media queries, because the window's width says
         nothing about the seat this element was given.

         What gives way, in order: the controls shrink, the sublabel goes (a hint),
         and the captions below stay whatever happens — those are FACTS about the
         drawing (rows that could not be named, steps that were not drawn), and a
         narrow column is not a reason to stop telling the truth.
         container-type: inline-size is width-only on purpose: it does not contain
         the element's height, so a host that hands over an auto-height box still
         gets the element's own sizing rather than a silent zero-height canvas. */
      @container (max-width: 480px) {
        .controls.bl { left: 8px; bottom: 8px; gap: 4px; }
        .controls.re { right: 8px; top: 8px; gap: 4px; }
        .ctl { width: 28px; height: 28px; font-size: 13px; }
        .label { font-size: 13px; }
        .sub { display: none; }
        .note { left: 8px; right: 44px; }
      }
      @container (max-width: 340px) {
        .ctl { width: 24px; height: 24px; font-size: 13px; }
        .note { font-size: 13px; }
      }
    `,
  ];
}

if (!customElements.get('agent-flow')) customElements.define('agent-flow', AgentFlow);

declare global {
  interface HTMLElementTagNameMap {
    'agent-flow': AgentFlow;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'agent-flow': React.DetailedHTMLProps<
        React.HTMLAttributes<AgentFlow> & {
          ref?: React.Ref<AgentFlow>;
        },
        AgentFlow
      >;
    }
  }
}
