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
 * while the person keeps working the drawing. See AGENTIC_EDITOR/08 for the contract.
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
import { LitElement, html, css, nothing, svg, unsafeCSS } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { designTokens } from '@/shared/design-tokens';
import { CREATABLE_KINDS, HUB_TILE, NODE_FOOTPRINT, NODE_TILE, positionKey, type FlowGraph, type FlowNode } from '@/shared/agentFlow';
import { TRIGGERS } from '@/shared/triggers';
// THE DRAWING IS THEIRS. Vue Flow renders the module tiles and the dot grid; this element stays
// the contract (one tag, one binding, the same events) and owns every gesture. See the module's
// own note for the division of labour.
import { mountVueFlowCanvas, type VueFlowCanvas } from './canvas/vueFlowCanvas';
// The library's own stylesheet, INLINED INTO THE SHADOW ROOT. Vue Flow mounts inside this
// element's shadow DOM, and a stylesheet imported into the document does not reach across that
// boundary — the pane, the transformation pane and the node wrapper would all come up unpositioned,
// which is how the drawing "worked in the page but not in the element". One stylesheet, adopted
// where the drawing lives.
import vfStyle from '@vue-flow/core/dist/style.css?inline';
import canvasArt from '@/assets/agent-canvas-art.jpg';

/*
 * THE LABEL BLOCK USED TO BE 54, HERE. It is NODE_FOOTPRINT's other half now, in
 * shared/agentFlow.ts — because the module that PLACES a node needs it (a ring has to clear a
 * node, not a tile) and this file was the only one that knew it. One fact, one reader: everything
 * in this element that asks how tall a node is reads NODE_FOOTPRINT, which is what the model
 * spaces by, so the two can no longer disagree.
 */
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
    /**
     * HOW MUCH OF THIS ELEMENT'S BOX IS COVERED — her column is a LAYER over the drawing
     * whenever a Run is on screen (workspace-layout's `.pane.right.over`), so this element's
     * box is wider than the pane a person can see. THE HOST MEASURES IT from the two boxes
     * and writes it here; nothing about either column's width is assumed or guessed.
     *
     * WHY IT MATTERS, measured 2026-09-23: a 1535px box with 768px visible put the brain at
     * x≈789 and the whole right half of the ring behind her column — so the hub sat on the
     * seam and could not be grabbed, which reads as "the nodes are fixed". The view composes
     * into what can be seen; the drawing still owns every pixel of the element.
     */
    viewportInset: { type: Number, attribute: false },
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
  /** Pixels of this element's right-hand side covered by her column (see the property note). */
  declare viewportInset: number;
  declare selectedId: string | null;
  declare zoom: number;
  declare panX: number;
  declare panY: number;

  /**
   * Drag-positions, filed by POSITION KEY and not by node id. The only state this element owns.
   *
   * A seat's id carries the SLOT it sits in (`seat:<i>:<kind>`), so a row that moves up the stack
   * is handed back under a different id — and an id-keyed map would move whatever row took the
   * slot instead of the one the person dragged. positionKey is the same key the model files a
   * carried place by (shared/agentFlow.ts), so a drag here and a saved place from the package are
   * one fact with one name.
   */
  private _pos = new Map<string, { x: number; y: number }>();

  private _drag: { id: string; key: string; startClientX: number; startClientY: number; x0: number; y0: number; moved: boolean } | null = null;
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
  /**
   * WHICH NODE'S TRIGGER MENU IS OPEN — the same question the prompt row asks, asked on the
   * drawing. The owner, 2026-09-24: "you can do module selection simply by selecting a node on the
   * canvas, and it would offer you those same options to make an edit on the canvas the same way we
   * would make the edit on the linear prompt."
   *
   * The list is the SAME catalogue the row's menu draws (shared/triggers.ts) — one source, so the
   * two views cannot offer different answers to one question. The choice is not written here: the
   * canvas does not know the row's text and must not guess it, so it emits and the host writes,
   * exactly as every other canvas gesture does.
   */
  private _triggerMenuFor: string | null = null;

  /**
   * THE VUE FLOW DRAWING, mounted into this element's own shadow root.
   *
   * Null until the first graph arrives. Its lifetime is this element's: created when a flow is
   * first drawn, updated in place on every later one, unmounted when the element leaves the page —
   * the same discipline as every listener here, so a framework cannot outlive the thing that
   * mounted it.
   */
  private _vue: VueFlowCanvas | null = null;
  private _vueHost: HTMLElement | null = null;
  private _draftSeq = 0;

  constructor() {
    super();
    this.flow = undefined;
    this.theme = '';
    this.mode = '';
    this.panning = false;
    this.viewportInset = 0;
    this.selectedId = null;
    this.zoom = 1;
    this.panX = 48;
    this.panY = 24;
  }

  // ── the pointer: one gesture at a time, and it never outlives the element ──
  //
  // THE MODULES ARE VUE-RENDERED NOW, so the per-node template bindings are gone and the surface
  // routes input by delegation: the canvas surface receives every press, hit-tests the target for
  // the module's own vocabulary (data-node-id, data-port, tb-btn) and runs the same gesture state
  // machines this element has always owned. One implementation of each gesture, whatever draws the
  // chrome. Listeners go on window for the duration of a gesture, because a pointer that leaves
  // this element's box mid-drag must keep dragging; they are removed by the release, and again by
  // disconnectedCallback.
  private _nodeFromTarget(target: EventTarget | null): FlowNode | undefined {
    const el = target instanceof Element ? target.closest('[data-node-id]') : null;
    if (!el) return undefined;
    return this._node(el.getAttribute('data-node-id') ?? '');
  }

  private _onSurfaceDown = (e: PointerEvent): void => {
    const target = e.target;
    // A port is inside its node: check the smaller surface first.
    const port = target instanceof Element ? target.closest('[data-port]') : null;
    if (port) {
      const n = this._nodeFromTarget(target);
      if (n) {
        this._onPortDown(e, n, port.getAttribute('data-port') as Side);
        return;
      }
    }
    const n = this._nodeFromTarget(target);
    if (n) {
      this._onNodeDown(e, n);
      return;
    }
    this._onCanvasDown(e);
  };

  private _onSurfaceUp = (e: PointerEvent): void => {
    const port = e.target instanceof Element ? e.target.closest('[data-port]') : null;
    if (!port) return;
    const n = this._nodeFromTarget(e.target);
    if (n) this._onPortUp(e, n, port.getAttribute('data-port') as Side);
  };

  /**
   * THE MODULE TOOLBAR'S CLICKS, ROUTED BY data-action. Two of the seven controls are not actions
   * (the lightning opens the trigger menu, the crosshair moves the view), and they emit no
   * flow-action — the same contract the toolbar has always had, now read off the Vue module's DOM.
   */
  private _onSurfaceClick = (e: MouseEvent): void => {
    const btn = e.target instanceof Element ? (e.target.closest('.tb-btn') as HTMLButtonElement | null) : null;
    if (!btn || btn.disabled) return;
    const n = this._nodeFromTarget(e.target);
    if (!n) return;
    switch (btn.getAttribute('data-action')) {
      case 'run': this._action('run', { nodeId: n.id }); break;
      case 'toggle': this._action('toggle', { nodeId: n.id }); break;
      case 'trigger-menu': this._toggleTriggerMenu(n.id); break;
      case 'delete':
        this._action('delete', { nodeId: n.id, ...(typeof n.rowIndex === 'number' ? { rowIndex: n.rowIndex } : {}) });
        break;
      case 'focus': this.focusNode(n.id); break;
      case 'ask': this._action('ask', { nodeId: n.id }); break;
      case 'more': this._action('more', { nodeId: n.id }); break;
    }
  };

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
    this._drag = {
      id: n.id, key: positionKey(n),
      startClientX: e.clientX, startClientY: e.clientY, x0: p.x, y0: p.y, moved: false,
    };
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
      // NO CLAMP AT THE ORIGIN. This was `Math.max(0, …)` on both axes, and it was there for one
      // reason: the edge layer's box only covered 0..max, so a node in negative space would have
      // had no frame to be drawn in. That reason is gone (the layer covers the drawing's real
      // bounds), and the clamp was not a boundary anyone chose — it was the drawing refusing to
      // go where a person put it. The owner, 2026-09-23: "there's still clamps on it. I can't
      // move the notes freely onto the grid." A grid has no origin wall; the node goes where the
      // hand takes it, and Save writes the number it landed on.
      this._pos.set(this._drag.key, { x: this._drag.x0 + dx, y: this._drag.y0 + dy });
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
      const { id, key, moved } = this._drag;
      const p = this._pos.get(key);
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
    // The framework goes with the element that mounted it. A Vue app left running against a
    // detached box is the same leak as a listener that outlives its element — the failure this
    // file has been refusing since it was written.
    this._vue?.unmount();
    this._vue = null;
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
    // NO CLAMP AT THE ORIGIN HERE EITHER — the last one of its kind, and it was the same
    // mistake in a third place: `Math.max(0, …)` on both axes, which put a node added near the
    // top-left corner of the grid somewhere other than where the person dropped it. The reason
    // the clamp existed (an edge layer whose box only covered the positive quadrant) went with
    // the box; this line stayed behind and kept the drawing from using half its own grid.
    const x = Math.round(picker.x - NODE_TILE / 2);
    const y = Math.round(picker.y - NODE_TILE / 2);
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
    // A DRAFT IS ITS OWN NODE, so its place is filed under its own id and not under the kind it
    // was picked from: two drafts of the same kind are two nodes, and one of them moving must not
    // move the other (positionKey keeps an id that carries no slot).
    this._pos.set(positionKey(node), { x, y });
    const enterSide = OPPOSITE[picker.side];
    if (picker.editKey) this._rewired.set(picker.editKey, { to: id, toSide: enterSide });
    else this._draftEdges.push({ from: picker.from, to: id, fromSide: picker.side, toSide: enterSide });
    this._picker = null;
    /*
     * A MODULE ARRIVES THE WAY THEIRS DOES: selected, and brought into view.
     *
     * Their `addNodes` hands the first inserted node the viewport so the canvas scrolls it in,
     * and a node added from a handle arrives selected and open. Ours put the node in and left
     * the drawing where it was — so a module added at the edge of the view appeared to do
     * nothing at all, which is the failure mode this repository names everywhere. Select first,
     * then focus, so the person sees the thing they just made.
     */
    this._select(id);
    this.focusNode(id);
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

  /**
   * A DRAFT THE GRAPH HAS CAUGHT UP WITH IS NO LONGER A DRAFT.
   *
   * A node the person drops is drawn by this element, which holds it locally and badges it
   * 'unsaved'. Once the row it names is in the prompt, the host rebuilds the graph from the
   * rows and that row arrives as a seat node — and two nodes for one row, one of them still
   * claiming to be unsaved, is exactly the lie the drawing must not tell. So a graph that
   * carries a seat of the same KIND releases the draft: what is on screen is then the prompt's
   * own row, and the badge goes with the copy.
   *
   * KIND, NOT ID, and that is the whole of the matching: a draft's id is local ('draft:3') and
   * the rebuilt node's names the row ('seat:2:constraints'), while the canonical seat id is what
   * both of them are about.
   *
   * The edges the draft was wired by go with it: they pointed at a node that is now the row's,
   * and the row's own edges are derived from the prompt by the builder.
   */
  private _releaseAdoptedDrafts(flow: FlowGraph | null | undefined): void {
    if (!this._draftNodes.length) return;
    const carried = new Set(
      (flow?.nodes ?? []).filter((n) => n.family === 'seat').map((n) => n.kind),
    );
    if (!this._draftNodes.some((n) => carried.has(n.kind))) return;
    const gone = new Set(this._draftNodes.filter((n) => carried.has(n.kind)).map((n) => n.id));
    this._draftNodes = this._draftNodes.filter((n) => !gone.has(n.id));
    this._draftEdges = this._draftEdges.filter((e) => !gone.has(e.from) && !gone.has(e.to));
    this.requestUpdate();
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    /*
     * THE LIBRARY IS FED HERE, NOT IN THE TEMPLATE — and it is fed the drawing AS THE ELEMENT SEES
     * IT, on every update: every module at the position it is drawn at (a drag is a `_pos` entry,
     * so the model's x/y is not the drawing's), the selection, the viewport. Vue Flow is a
     * projection of this element's state and nothing else — the element decides, the library
     * draws. There is exactly one drawing; the hand-rolled node layer is GONE, not hidden.
     */
    if (this.flow && this._vueHost) {
      if (!this._vue) {
        this._vue = mountVueFlowCanvas(this._vueHost, { theme: this.theme });
      } else if (changed.has('theme')) {
        this._vue.setTheme(this.theme);
      }
      const nodes = this._allNodes().map((n) => {
        const p = this._nodePos(n);
        return { ...n, x: p.x, y: p.y, selected: this.selectedId === n.id };
      });
      this._vue.update(nodes);
      this._vue.setViewport(
        { x: this.panX, y: this.panY, zoom: this.zoom },
        this._glide ? { duration: GLIDE_MS } : undefined,
      );
      /*
       * AND IT SAYS SO. `holding` belongs to the CONTAINER — the column says "Assembling the
       * drawing…" while it waits for a picture, and on a Run the host ends that wait when it
       * publishes. But on a page with no host nothing ever did, so the spinner sat over a finished
       * drawing. The element that HAS the picture is the one that can say the wait is over, and it
       * says it as an event rather than reaching for its container: the container owns its own
       * flag, and this is a report, not a write.
       */
      this.dispatchEvent(new CustomEvent('flow-drawn', { bubbles: true, composed: true }));
    }
    const flow = this.flow;
    this._releaseAdoptedDrafts(flow);
    /*
     * HER COLUMN NARROWING OVER A DRAWING IS A CHANGE THIS ELEMENT CANNOT SEE. She is an
     * absolutely positioned layer, so the drawing's own box does not move when she does and
     * the ResizeObserver above never fires. The host measures the cover and writes it here
     * (viewportInset) — and while the view is still ours, the drawing recomposes into
     * whatever can now be seen. Once a person has taken the view, this does nothing: their
     * picture is theirs.
     */
    if (changed.has('viewportInset') && !this._viewTouched) this.startView();
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
    // A RING IS NOT A LINE, SO THE ARRIVAL VIEW CENTRES ON THE BRAIN and fits the whole ring to
    // the pane when it can.
    //
    // The old rule anchored the top-left and deliberately ran the last node off the edge — a peek
    // that taught people the canvas moves, which was right for a flow that travels rightward.
    // Around a hub the drawing goes in every direction, so anchoring a corner would put the brain
    // in that corner and half the rows off-screen. The peek is not lost, it is now COMPUTED: the
    // radius grows with the number of nodes, so a busy flow still runs past the pane and the hand
    // and the wheel are still the discovery they were.
    const nodes = this._allNodes();
    // THE DRAWING'S OWN BOUNDS, whatever shape it is. A ring and a line are both just nodes in
    // space, and the view's job is to show the thing that exists rather than the shape it hoped
    // for — so this measures both axes and centres what it measures.
    //
    // A NODE IS ITS FOOTPRINT, NOT ITS TILE. This line measured `p.y + NODE_TILE` while `fit()`
    // twenty lines below measured the tile plus the label block — two readers of one fact, and
    // this was the one that decided the arrival view. So the fit believed the drawing was 54
    // shorter than it is, per row, and a ring arrived with its labels running past the bottom of
    // the pane it was told it fitted in. Both read NODE_FOOTPRINT now.
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const n of nodes) {
      const p = this._nodePos(n);
      minX = Math.min(minX, p.x);
      maxX = Math.max(maxX, p.x + this._tileSize(n));
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y + this._nodeFootprint(n));
    }
    if (!Number.isFinite(minX)) return;
    const drawW = Math.max(1, maxX - minX);
    const drawH = Math.max(1, maxY - minY);
    // THE VISIBLE BOX, NOT THE ELEMENT'S BOX. Her column is a layer over the drawing when a
    // Run is on screen, so the room a person can look at is the box less what she covers
    // (see viewportInset). Composing into the full box is how the brain came to sit on the
    // seam under her column.
    const visibleW = Math.max(1, rect.width - this.viewportInset);
    const roomW = Math.max(1, visibleW - 2 * START_PAD_X);
    const roomH = Math.max(1, rect.height - 2 * START_PAD_Y);
    // READING SIZE, AND NEVER MAGNIFIED: 1:1 is the ceiling, for the same reason as before —
    // the tile a person learned is the size it was drawn at. It shrinks only when the drawing
    // would not fit, and a busy ring shrinks rather than being cut, because the ring IS the
    // picture: the peek at the edges is the pane's business to force by being narrow.
    this.zoom = Math.min(1, Math.max(MIN_ZOOM, Math.min(roomW / drawW, roomH / drawH)));
    // The drawing's middle, at the VISIBLE part's middle. A hub sits at the origin, so this
    // puts the brain where a person looks first, and a line still lands whole.
    this.panX = visibleW / 2 - ((minX + maxX) / 2) * this.zoom;
    this.panY = rect.height / 2 - ((minY + maxY) / 2) * this.zoom;
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
    // CENTRED ON THE NODE'S OWN BOX, not on an ordinary tile: the trigger is larger, and a view
    // that centres a 140-square using the 88 every other node draws puts the thing it was asked
    // to show off-centre by 26 units. One reader, as everywhere else the size is needed.
    this.panX = rect.width / 2 - (p.x + this._tileSize(node) / 2) * target;
    this.panY = rect.height / 2 - (p.y + this._nodeFootprint(node) / 2) * target;
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
      maxX = Math.max(maxX, p.x + this._tileSize(n));
      maxY = Math.max(maxY, p.y + this._nodeFootprint(n));
    }
    // FIT OBEYS THE SAME RULE AS THE ARRIVAL VIEW: fit what can be seen, not the element's
    // whole box — otherwise the one control a person presses to "show me everything" hides
    // the right half of it under her column.
    const w = Math.max(1, rect.width - this.viewportInset);
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
   * THE LIGHTNING ON A SELECTED NODE — the same question the prompt's row menu asks.
   *
   * The list it opens is the same catalogue (`shared/triggers.ts`), so the two views cannot offer
   * different answers to one question. The choice is NOT written here: the canvas holds no copy of
   * the row's text and must not invent one, so it emits and the host writes — the same division of
   * labour as every other control on this element.
   */
  private _toggleTriggerMenu(nodeId: string): void {
    this._triggerMenuFor = this._triggerMenuFor === nodeId ? null : nodeId;
    this.requestUpdate();
  }

  /** A trigger chosen on the drawing. Out it goes; the host owns the row. */
  private _pickTrigger(nodeId: string, token: string): void {
    this._triggerMenuFor = null;
    // THE ROW'S ADDRESS TRAVELS WITH THE CHOICE when the node knows it — see FlowNode.rowIndex.
    // The host then updates at a path rather than re-matching a name, which is A2UI's own rule for
    // an action's context (Data-Binding.md) and removes the class of bug that broke this twice.
    const rowIndex = this._node(nodeId)?.rowIndex;
    this._action('trigger', { nodeId, token, ...(typeof rowIndex === 'number' ? { rowIndex } : {}) });
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
      const key = positionKey(node);
      // The arrow keys move a node the same way the hand does, so they stop at the same place:
      // nowhere. The origin clamp came out with the drag's (see _onMove) — a key that walks a node
      // up and then refuses to keep walking is the same wall, one keypress at a time.
      this._pos.set(key, { x: p.x + m.dx, y: p.y + m.dy });
      const np = this._pos.get(key)!;
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

  /**
   * A node's drawn position: what the person dragged it to, else what the model said.
   *
   * THE MODEL'S ANSWER IS ALREADY THE PERSON'S when the package carried places into it (a saved
   * layout is handed to the builder, see agentFlow's FlowPosition) — so the two sources agree by
   * construction, and this is only the LIVE drag sitting on top of a rebuilt graph.
   */
  private _nodePos(n: FlowNode): { x: number; y: number } {
    return this._pos.get(positionKey(n)) ?? { x: n.x, y: n.y };
  }

  /** Where an edge leaves a node, and where it lands. Ports sit on the tile's midline. */
  /**
   * IS THIS THE TRIGGER? The one node drawn larger — see HUB_TILE. It is the System Role: the
   * row that says what this agent is, and therefore the row the rest hang off.
   */
  private _isTrigger(n: FlowNode): boolean {
    return n.family === 'seat' && n.kind === 'system-role';
  }

  /**
   * HOW BIG THIS NODE'S TILE IS. ONE reader, because the size decides three things that must
   * agree: what the element draws (the CSS class), where the ports sit, and therefore where
   * every edge lands. A second reader of this number is how a bigger node ends up with its
   * connectors attached to empty air.
   */
  private _tileSize(n: FlowNode): number {
    return this._isTrigger(n) ? HUB_TILE : NODE_TILE;
  }

  /**
   * WHAT A NODE ACTUALLY OCCUPIES — its tile plus the label block beneath it.
   *
   * ONE READER, because three things have to agree: what the element draws, where the ports sit,
   * and the bounds every fit is computed from. The trigger's tile is larger, so a fit that
   * measures every node at NODE_TILE crops the outermost node whenever that node is the trigger
   * — the same single-number-for-two-sizes fault as the ring's radius, one layer up.
   */
  private _nodeFootprint(n: FlowNode): number {
    return this._tileSize(n) + (NODE_FOOTPRINT - NODE_TILE);
  }

  /** Where a node's port sits, in canvas units. */
  private _portPoint(n: FlowNode, side: Side): { x: number; y: number } {
    const p = this._nodePos(n);
    const size = this._tileSize(n);
    const half = size / 2;
    if (side === 'left') return { x: p.x, y: p.y + half };
    if (side === 'right') return { x: p.x + size, y: p.y + half };
    if (side === 'top') return { x: p.x + half, y: p.y };
    return { x: p.x + half, y: p.y + size };
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
    const sa = this._tileSize(a) / 2;
    const sb = this._tileSize(b) / 2;
    const dx = (pb.x + sb) - (pa.x + sa);
    const dy = (pb.y + sb) - (pa.y + sa);
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
   * WHAT IS ON THE CANVAS NOW — the session's graph PLUS the person's own edits, EACH NODE AT
   * THE PLACE IT IS DRAWN AT.
   *
   * A host reads here rather than reaching into private state: to list what is drawn, or
   * to save it once writing back exists (AGENTIC_EDITOR/10-TODO.md W1). Reading writes
   * nothing; the drawing stays this element's until a host decides otherwise.
   *
   * WHERE THEY ARE, NOT WHERE THE MODEL PUT THEM — and this is the difference between a drag
   * that survives a save and one that does not. The positions a person drags live in `_pos` (the
   * one state this element owns), and this getter is what the SAVE reads: reporting the model's
   * x/y here wrote every dragged node back to the place the ring had given it, so the package
   * remembered a layout nobody had ever chosen. Unpositioned nodes are handed over as they came,
   * because there is nothing to say about them.
   */
  get drawn(): { nodes: FlowNode[]; edges: Array<{ from: string; to: string }> } {
    return {
      nodes: this._allNodes().map((n) => {
        const p = this._nodePos(n);
        /*
         * AND IT SAYS WHICH PLACES ARE THE PERSON'S.
         *
         * `_pos` holds the positions a HAND put things — a drag, or a module dropped from a port.
         * Everything else on this drawing is where the LAYOUT put it, and the two were written to
         * the package identically, so a saved package could not tell them apart.
         *
         * Measured 2026-09-24, and it is why the owner still saw a circle after the ring was
         * deleted from the code: `arrangeAsHub` gives a carried place priority over the
         * arrangement — correctly, so a dragged node stays where it was left — and every package
         * that had ever run carried the ring's own coordinates as though somebody had chosen
         * them. The layout could not show through its own saved output.
         *
         * So a place now travels with `moved`, and only a place that carries it wins. See
         * `arrangeAsHub`.
         */
        if (this._pos.has(positionKey(n))) {
          return { ...n, x: Math.round(p.x), y: Math.round(p.y), moved: true };
        }
        return n;
      }),
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

  // THE MODULE CHROME — the glyph, the mark, the ports, the toolbar — is drawn by the Vue module
  // (canvas/vueFlowCanvas.ts) with the same classes this stylesheet styles. Nothing in this element
  // renders a node any more; what it renders is the ground, the edges, the picker, the menus and
  // the controls, and what it owns is every decision about them.

  render() {
    const flow = this.flow;

    // Unset is not empty: no graph is "the surface has not written the path", an
    // empty graph is "there is nothing to draw". Two different claims.
    if (!flow) {
      return html`<div class="waiting" role="status">Waiting for the flow…</div>`;
    }
    const nodes = this._allNodes();
    const byId = new Map(nodes.map((n) => [n.id, n]));

    // THE EDGE LAYER'S BOX, FROM THE DRAWING'S OWN BOUNDS — IN BOTH HALVES.
    //
    // Measured in the app on 2026-09-18: with the layer at 1px and overflow
    // visible, eight paths with correct geometry and correct stroke drew nothing.
    // The bounds below are facts, not a guess — every node's position is known —
    // so the layer is given the viewport its content actually occupies, and the
    // overshoot room is the curve's own leave-distance plus a margin for a node
    // in flight.
    //
    // AND IT IS NOT JUST THE POSITIVE QUADRANT, which is what it used to be. That box ran
    // 0..max because node positions were clamped at the origin (see _onMove), so the drawing
    // could never leave the first quadrant. THE RING BROKE THAT ASSUMPTION THE DAY IT LANDED: a
    // hub puts its rows at negative x and y, and an edge to one of them fell outside a box that
    // starts at 0 — correct geometry, correct stroke, and nothing drawn, which is the owner's
    // report of 2026-09-23: "the lines are gone. The connectors are broken now."
    //
    // SO THE BOX COVERS WHAT THE DRAWING OCCUPIES, and the clamp is gone with the reason for it.
    // The layer is positioned at the box's own corner, so a model coordinate still maps to the
    // same pixel it always did — only the frame around it changed.
    let minX = 0;
    let minY = 0;
    let maxX = 1;
    let maxY = 1;
    for (const n of nodes) {
      const p = this._nodePos(n);
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + this._tileSize(n));
      maxY = Math.max(maxY, p.y + this._nodeFootprint(n));
    }

    // The connection being drawn: from the source port to wherever the pointer is.
    let livePath: string | null = null;
    if (this._connect) {
      const from = byId.get(this._connect.from);
      if (from) {
        // THE LINE LEAVES THE PORT THE GESTURE STARTED AT. This used the right edge and the
        // vertical middle of an NODE_TILE box, whatever side was actually grabbed and whatever
        // size the node is — so on the larger trigger the live line began inside the box, from a
        // corner the pointer had not touched. `_portPoint` is the one reader of both facts.
        const start = this._portPoint(from, this._connect.side);
        const x1 = start.x;
        const y1 = start.y;
        const bend = Math.max(CURVE, Math.abs(this._connect.x - x1) / 2);
        livePath = 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + bend) + ' ' + y1 + ', '
          + (this._connect.x - bend) + ' ' + this._connect.y + ', '
          + this._connect.x + ' ' + this._connect.y;
        minX = Math.min(minX, this._connect.x - CURVE);
        minY = Math.min(minY, this._connect.y - CURVE);
        maxX = Math.max(maxX, this._connect.x + CURVE);
        maxY = Math.max(maxY, this._connect.y + CURVE);
      }
    }

    // THE LAYER'S FRAME, once both halves are known. The box is the bounds plus the overshoot
    // room, and the layer sits at the box's own corner — so a model coordinate maps to the same
    // pixel whichever corner the drawing happens to be in.
    const boxX = minX - EDGE_PAD;
    const boxY = minY - EDGE_PAD;
    const boxW = Math.max(1, maxX - minX + EDGE_PAD * 2);
    const boxH = Math.max(1, maxY - minY + EDGE_PAD * 2);

    return html`
      <div
        class="canvas ${this.mode === 'hand' ? 'mode-hand' : ''} ${this.panning ? 'panning' : ''}"
        tabindex="0"
        role="application"
        aria-label="Agent flow"
        @pointerdown=${this._onSurfaceDown}
        @pointerup=${this._onSurfaceUp}
        @click=${this._onSurfaceClick}
        @wheel=${this._onWheel}
        @keydown=${this._onKeyDown}
      >
        <!-- THE ARTIST'S BACKDROP, BEHIND THE GRID: the dot field draws over it, and
             the nodes draw over both. The image rides as an inline style because lit
             rejects a string in the stylesheet above. -->
        <div class="art" aria-hidden="true" style="background-image: url(${canvasArt});"></div>

        <!-- THE LIBRARY'S SURFACE, OVER OUR GROUND. Vue Flow draws the modules and the dot grid;
             the element draws the edges, the handles, the picker, the menus and the controls, and
             owns every gesture. One drawing; the module chrome is Vue's, everything a hand grabs
             or a decision reaches is this element's. -->
        <div
          class="vue-host"
          ${ref((el) => { this._vueHost = (el as HTMLElement | undefined) ?? null; })}
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
            viewBox="${boxX} ${boxY} ${boxW} ${boxH}"
            style="left: ${boxX}px; top: ${boxY}px; width: ${boxW}px; height: ${boxH}px;"
          >
            ${this._resolvedEdges().map((e) => {
              const a = byId.get(e.from);
              const b = byId.get(e.to);
              if (!a || !b) return nothing;
              const d = this._edgePath(a, b, e.fromSide, e.toSide);
              /*
               * TWO PATHS PER LINE: the one that is SEEN, and the one that is GRABBED.
               *
               * Measured on canvas.html: every edge carried pointer-events: none, so the line
               * itself was inert — the only hittable thing was the 15px handle at its far end,
               * invisible until hovered. A connector that cannot be taken hold of is a drawing
               * of a connector.
               *
               * The visible stroke stays inert; a second path over it takes the pointer with a
               * wide transparent stroke, because SVG hit-tests the stroke geometry and not the
               * paint. Pressing it runs `_onHandleDown` — the SAME gesture the end handle
               * starts — so a line can be taken hold of anywhere along its length and dragged
               * to another port or another node. That is the behaviour the owner asked for:
               * "when I first built this I was able to grab a connector, move it to a different
               * node and do all kinds of behaviors."
               */
              return svg`
                <path class="edge" d=${d} data-from=${e.from} data-to=${e.to}></path>
                <path
                  class="edge-hit"
                  d=${d}
                  data-handle-key=${e.key}
                  @pointerdown=${(ev: PointerEvent) => this._onHandleDown(ev, e.key, e.from, e.to)}
                ></path>`;
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
        </div>

        <!-- THE KIND PICKER. It opens where a line was dropped on empty canvas: the one
             question the canvas cannot answer for itself. The kinds are the prompt's own
             seats, so this view and the prompt panel cannot drift apart. -->
        ${this._picker
          ? html`<div
              class="picker"
              style="left: ${this._picker.x * this.zoom + this.panX}px; top: ${this._picker.y * this.zoom + this.panY}px;"
              @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
            >
              <div class="picker-head">New node — what is it?</div>
              ${CREATABLE_KINDS.map((k) => html`
                <button type="button" class="picker-kind" @click=${() => this._addNodeAt(k.kind, k.label)}>${k.label}</button>`)}
              <button type="button" class="picker-cancel" @click=${() => { this._picker = null; this.requestUpdate(); }}>Cancel</button>
            </div>`
          : nothing}

        <!-- THE SAME QUESTION, ASKED ON THE DRAWING. A seat's lightning opens the same list the
             prompt row's Functions | Tools menu offers, from the same catalogue — so a person who
             is looking at the picture can ask what starts this without leaving it. The choice is
             emitted, never written here: the canvas has no copy of the row's text. -->
        ${this._triggerMenuFor
          ? (() => {
              const n = this._node(this._triggerMenuFor as string);
              if (!n) return nothing;
              const p = this._nodePos(n);
              return html`<div
                  class="picker trigger-menu"
                  role="menu"
                  style="left: ${p.x * this.zoom + this.panX}px; top: ${(p.y + this._tileSize(n)) * this.zoom + this.panY}px;"
                  @pointerdown=${(e: PointerEvent) => e.stopPropagation()}
                >
                  <div class="picker-head">What starts this?</div>
                  ${TRIGGERS.map((t) => html`
                    <button type="button" class="picker-kind" role="menuitem" title=${t.hint}
                            @click=${() => this._pickTrigger(n.id, t.token)}>${t.name}</button>`)}
                  <button type="button" class="picker-cancel"
                          @click=${() => { this._triggerMenuFor = null; this.requestUpdate(); }}>Cancel</button>
                </div>`;
            })()
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

        <!-- THE DRAWING DOES NOT NARRATE — not even about itself. Two captions used to sit at
             the foot of the canvas: the rows it could not name, and the steps it did not draw,
             each with its reason. Both are still in the graph (unresolved, absent) and both
             are said OUT LOUD — on the message line her column carries at the top, and in her
             thread — because the owner's rule for this element is that it never narrates and
             the conversation carries everything that needs saying. A caption pinned to the
             corner of the working area was a second, quieter voice in a place the person is
             meant to be looking at, not reading.
             (No backticks in this file's templates: it is a tagged template literal, and one
             raw backtick ends it — tsc will not say so; esbuild will.) -->
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
    // THE LIBRARY'S OWN POSITIONING, INSIDE THE SHADOW ROOT where the library mounts.
    unsafeCSS(vfStyle),
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
        /* The owner, 2026-09-19: the dark canvas's dots a little lighter — #352c52 lifted a
           step so the grid reads without competing with the nodes.
           The owner, 2026-09-21: in the homepage's purple family, and a fifth less
           opaque so the artwork behind them shows through. */
        --flow-dot: rgba(107, 74, 158, 0.8);
      }
      .canvas {
        position: relative;
        width: 100%;
        height: 100%;
        overflow: hidden;
        outline: none;
        cursor: default;
        /* The owner, 2026-09-21: no ground of its own again — the dark backdrop it sits
           on shows through, and only the dots carry the purple. */
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
        z-index: 6;
      }
      .waiting {
        display: flex; align-items: center; justify-content: center;
        height: 100%; color: var(--ds-muted); font-size: var(--ds-fs-md);
      }

      /* THE ART THE DOTS SIT ON. The owner, 2026-09-21: the canvas carries no ground of
         its own, the artwork rides at FULL strength as the canvas's backdrop, and the
         dot grid draws above it. Stretched edge to edge the way the console's own
         ground is (100% by 100%, no repeat). The image URL is set on the element
         itself in render: a string cannot be interpolated into this stylesheet (lit
         refuses non-literal values here — measured 2026-09-21, the module threw). */
      .art {
        position: absolute; inset: 0;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        background-position: top left;
        opacity: 1;
        pointer-events: none;
      }

      /* THE VIEW LAYER CARRIES THE EDGES AND THE LINE-END HANDLES ONLY — the modules are the
         Vue pane's now. It must sit ABOVE the pane for hit-testing (an edge grabbed through a
         pane is never grabbed) and let everything else pass through: the container and the
         stroke-layer are inert, the grabbable paths and the handles take the pointer. */
      .view {
        position: absolute; top: 0; left: 0;
        transform-origin: 0 0;
        will-change: transform;
        pointer-events: none;
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
      /* THE LINE'S OWN HIT AREA — see the note over the edge layer. Invisible, wide enough for a
         hand rather than for a pixel, and it takes the pointer so the line can be grabbed. The
         svg around it stays pointer-events: none, so the ground behind the lines still pans. */
      .edge-hit {
        fill: none;
        stroke: transparent;
        stroke-width: 18;
        pointer-events: stroke;
        cursor: grab;
      }
      .edge-hit:active { cursor: grabbing; }

      /* THE MODULE BODY — now inside the Vue Flow node wrapper, which carries the position; the
         module's own inline width/height is what the wrapper measures. */
      .node {
        position: relative;
        user-select: none;
        cursor: grab;
        text-align: center;
      }
      .node:active { cursor: grabbing; }
      /* The owner, 2026-09-21: selecting a node keeps its drop shadow — the ring and
         the lift are both on this rule, or the second one silently cancels the other. */
      /* THE SELECTION RING IS THEIRS: one 6px ring at white 40% in the dark theme
         (--canvas--color--selected-transparent, read from their running canvas), instead of the
         two-ring teal outline this used. A selected node in their canvas reads as LIT, not as
         outlined, and that is the pattern being copied. */
      .node.sel .tile { box-shadow: 0 0 0 6px rgba(255, 255, 255, 0.4); }
      .node:focus-visible .tile { outline: 2px solid var(--ds-teal); outline-offset: 3px; }

      /*
       * ── THE MODULE'S SURFACE, IN THEIR PATTERN ────────────────────────────────────────
       *
       * The owner, 2026-09-24: "you should use the same design patterns… our modules are not
       * special, they were filler, placeholders — you can replace the design to match n8n, and
       * then I'll go back into Figma and re-style them. The only thing I want to keep is the
       * graphic in the background."
       *
       * Every number below was READ FROM THEIR RUNNING CANVAS, not guessed:
       *   corner        8px              (--radius--lg, resolved)
       *   border        1.5px of a 10–15% neutral (--canvas-node--border-width + its border colour)
       *   surface       hsl(0 0% 17%)    (--color--neutral-850, their dark node fill)
       *   selected      6px ring at white 40% (--canvas--color--selected-transparent, dark theme)
       *   status        carried by the BORDER, not by the tile (their status-success/error/warning)
       *   trigger       one lead corner at 36px (--trigger-node--radius)
       *
       * Our families survive as a TINT and as the glyph, which is what their canvas does too: one
       * surface for every node, and the icon says what it is. The ground behind the drawing —
       * the line art and the dot grid — is untouched, which is the one thing he asked to keep.
       */
      .tile {
        position: relative;
        width: ${NODE_TILE}px;
        height: ${NODE_TILE}px;
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        border-radius: 8px;
        background: #2b2b2b;
        border: 1.5px solid rgba(255, 255, 255, 0.16);
        color: var(--ds-text-strong);
        box-sizing: border-box;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.35);
      }
      /* THE FAMILY IS COLOUR AND GLYPH, NOT SHAPE — as theirs. */
      .f-note .tile { background: #3a2f18; }
      .f-seat .tile { background: #242a36; }
      .f-step .tile { background: #22262e; }
      /* STATUS IS THE BORDER, in their colours: success, error, warning. */
      .s-failed .tile { border-color: #e0524a; }
      .s-done .tile { border-color: #3fa76a; }
      .s-active .tile { border-color: #d7a04a; }
      /* THE TRIGGER, DRAWN AS THEIRS IS — a larger square, so its shape says it is where the
         flow starts, and ONE LEAD CORNER at 36px (--trigger-node--radius, read from their
         running canvas) while every other corner keeps the 8px the rest of the nodes use. That
         corner is the whole of what makes their trigger recognisable at a glance, and it costs
         nothing to carry: the size is still HUB_TILE, so the ports and the edges follow it. */
      .node.hub { width: ${HUB_TILE}px; }
      .node.hub .tile { width: ${HUB_TILE}px; height: ${HUB_TILE}px; border-radius: 36px 8px 8px 36px; }
      .node.hub .glyph { width: 64px; height: 64px; }
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
      /* THE "+" THAT SAYS WHAT A PORT DOES — theirs carries it on the handle, and it is the
         difference between a dot nobody dares touch and a control that says a module can go
         here. Its own element with pointer-events off, so the port's hit area, ring and cursor
         are exactly what they were. */
      .port-plus {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        color: var(--ds-muted);
        pointer-events: none;
      }
      .node:hover .port-plus, .port:hover .port-plus { color: var(--ds-text-strong); }
      .port-left { left: -7px; top: 50%; margin-top: -6.5px; }
      .port-right { right: -7px; top: 50%; margin-top: -6.5px; }
      .port-top { top: -7px; left: 50%; margin-left: -6.5px; }
      .port-bottom { bottom: -7px; left: 50%; margin-left: -6.5px; }

      /* THE GRABBABLE END OF A LINE. It sits on the port the line lands at, and it is
         invisible until a line is hovered — the drawing should read as lines, not as a field of
         dots. THE REVEAL IS KEYED TO THE LINE, NOT TO THE DOT: a handle hidden until it is
         hovered itself is a control a person cannot discover, because they cannot see what they
         cannot hover. Hovering any edge-hit (the 18px invisible stroke along every line) shows
         every line's end, so the one grab affordance the owner cares about — moving a connection
         — is findable from the line itself. The view layer is inert, so the handle takes the
         pointer itself. */
      .handles { position: absolute; top: 0; left: 0; }
      .handle {
        position: absolute; width: 16px; height: 16px; margin: -8px 0 0 -8px;
        border-radius: 50%;
        cursor: grab;
        pointer-events: auto;
        opacity: 0;
        transition: opacity 0.12s;
      }
      svg.edges:hover ~ .handles .handle, .handle:hover { opacity: 1; }
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
        position: absolute; z-index: 8;
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

      /* THE LABEL LIVES INSIDE THE TILE NOW — glyph above, name below, both inside the frame,
         which is the module shape their canvas uses. The subtitle and badge hang under the tile
         as they always did. */
      .tile .label {
        margin: 0;
        max-width: 84px;
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        font-size: 12px; font-weight: 600; color: var(--ds-text-strong);
        line-height: 1.2;
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
        /* ABOVE THE LIBRARY'S PANE, always — a control under the pane is a dead control. */
        z-index: 7;
      }
      /* ONE CLUSTER, one corner: the controls that MOVE THE DRAWING. The top-right group
         is gone (see the markup note above), and the host contract it needed went with
         it — --flow-overlay-right existed only to step that cluster left of a column
         laid over the canvas, and nothing left on this element reads it. Removing a
         property a host must remember is a deletion worth having. */
      .controls.bl { left: 12px; bottom: 12px; }

      /* THE LIBRARY'S SURFACE. Vue Flow draws the dot grid and the modules; the element draws
         the ground, the edges, the handles, the picker, the menus and the controls. There is
         exactly one drawing of each thing — the element's view layer (edges and handles) sits
         ABOVE the pane so a line can be grabbed, the pane itself never takes the pointer (its
         gestures are all off), and the controls sit above everything. */
      .vue-host { position: absolute; inset: 0; z-index: 5; }
      /* THE LIBRARY SIZES ITSELF TO ITS CONTAINER, SO THE CONTAINER MUST HAVE ONE. Measured
         2026-09-24: without these two lines the library's own box collapsed to its content, the fit
         ran against THAT box, and the drawing came up at half scale and below the pane — modules
         49px on screen where 96 was asked for. Vue Flow's docs say the same: the wrapper needs
         explicit dimensions.
         (No backticks in this comment, deliberately: this is a css template literal and one raw
         backtick ends it — the same trap the top of this stylesheet warns about, walked into.) */
      .vue-host .vue-flow { width: 100%; height: 100%; background: transparent; }
      /* THE PANE IS A PICTURE, NOT A CONTROL: every Vue Flow gesture is off (see the mount), so
         the pane must not sit on top of the edge layer's hit paths. The nodes themselves are
         interactive through the wrapper's own inline pointer-events. */
      .vue-host .vue-flow__pane,
      .vue-host .vue-flow__transformationpane,
      .vue-host .vue-flow__background { pointer-events: none; }
      .vue-host .vue-flow__node { font-family: 'Inter', system-ui, sans-serif; }
      .view { z-index: 6; }
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
        z-index: 7;
      }

      /* ── RESPONSIVE ──────────────────────────────────────────────────────────
         A column is what this element is dropped into, and a column is whatever
         width the person has dragged it to: wide when the prompt is docked, narrow
         in a three-pane split, narrower still on a laptop with the chat open. The
         canvas must look composed at all of them, so it answers to ITS OWN BOX —
         container queries, never media queries, because the window's width says
         nothing about the seat this element was given.

         What gives way, in order: the controls shrink and the sublabel goes. There
         are no captions to lose any more — the rows that could not be named and the
         steps that were not drawn are SAID, in the message her column carries at the
         top and in her thread (see the note in the render), so what is left here is
         only the drawing and its controls.
         container-type: inline-size is width-only on purpose: it does not contain
         the element's height, so a host that hands over an auto-height box still
         gets the element's own sizing rather than a silent zero-height canvas. */
      @container (max-width: 480px) {
        .controls.bl { left: 8px; bottom: 8px; gap: 4px; }
        .controls.re { right: 8px; top: 8px; gap: 4px; }
        .ctl { width: 28px; height: 28px; font-size: 13px; }
        .label { font-size: 13px; }
        .sub { display: none; }
      }
      @container (max-width: 340px) {
        .ctl { width: 24px; height: 24px; font-size: 13px; }
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
