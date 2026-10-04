/**
 * <draft-canvas> — the wireframe drafting view for the output column.
 *
 * WHAT IT IS. A restricted assembly surface: real, registered components placed on a grid. The only
 * things it can draw are tags the catalogue resolves — `resolveTag` is the ONE reader of the
 * name→tag mapping (the same reader `a2ui-renderer` uses), so this view cannot invent a component
 * the app does not have, and a name the catalogue refuses is DRAWN AS A REFUSAL, by name, on the
 * node. No fallback element, no empty box.
 *
 * WHAT IT IS NOT. Not the execution canvas (`agent-flow`): that one draws a RUN — notes, seats and
 * steps built from the prompt's rows and the run's facts — and it owns connectors, ports and a
 * picker. This one draws a LAYOUT a person is assembling: components at places. The two share the
 * rendering engine (Vue Flow) and the gesture discipline, and nothing else.
 *
 * WHY ITS EVENTS HAVE THEIR OWN NAMES — `draft-select`, `draft-node-moved` and
 * `draft-node-added`, not `flow-select`
 * and `flow-node-moved`. Both canvases can exist in the same room (the output column switches
 * between them), and the host listens on `window`: one name for two facts would make the execution
 * handlers answer a draft's gestures, and the draft's autosave write fire on a run drawing's drag.
 * Same SHAPE, different facts, different names — and both are declared in the tag registry.
 *
 * HOW A COMPONENT IS MOUNTED. The Vue module creates the element the catalogue resolved and sets
 * the payload's props as PROPERTIES (`canvas/vueFlowCanvas.ts`, CatalogNode): an object prop cannot
 * ride an attribute, and this app's elements declare their properties. The module draws; this
 * element decides — its gestures, its selection, its places.
 *
 * ONE WRITER FOR A PLACE. `_pos` is the element's own record of where a hand put a node; the
 * payload's `positions` is the model's. A gesture writes `_pos` (and announces
 * `draft-node-moved`); the host decides what to persist. Rebuilding the payload does not move a
 * node the person has already placed.
 */
import { LitElement, html, css, nothing, unsafeCSS } from 'lit';
import { ref } from 'lit/directives/ref.js';
import { designTokens } from '@/shared/design-tokens';
import { resolveTag } from './a2ui-renderer';
import { mountVueFlowCanvas, SIZES, type VueFlowCanvas } from './canvas/vueFlowCanvas';
// The library's stylesheet, inlined into the shadow root — the pane and the transformation pane
// come up unpositioned without it. The same line `agent-flow` carries, for the same reason.
import vfStyle from '@vue-flow/core/dist/style.css?inline';

/** One component, placed. `props` are the element's own declared properties, verbatim. */
export interface DraftComponent {
  id: string;
  component: string;
  props?: Record<string, unknown>;
  /**
   * THE SIZE LADDER — the room's declared STRUCTURAL vocabulary (2026-10-03; the owner, watching
   * a form render "1 inch wide": *"That's not a form size. Is she not using any of her
   * judgment?"* — she had no size to choose FROM, so the ladder is ours and her judgment acts
   * within it). One of `sm | md | lg | full`, rendered by the tile at the ladder's width (see
   * SIZES in canvas/vueFlowCanvas). Unset = natural size. It rides in the payload exactly like
   * `positions` — the things A2UI has no notion of — so no catalogue entry needs a width prop
   * and the styling door stays shut: she picks from our ladder, never in pixels.
   */
  size?: string;
  /**
   * WHAT A CONTAINER CARRIES (2026-10-03 — the owner's rule: *"Always create a container
   * first"*). A container's contents are its CHILDREN: the renderer mounts them as light-DOM
   * children of the container's element, which is how this platform's containers already work
   * (kor-card's template has a default slot; slotted content lands in it). Children are the same
   * shape as any node — and they carry THEIR children the same way, all the way down. A child
   * needs no position: it flows inside its container.
   */
  children?: DraftComponent[];
}

/** The payload this view draws — what the assembler emits and the person adjusts. */
export interface DraftPayload {
  label?: string;
  nodes: DraftComponent[];
  /** Where each node sits. A node with no place gets a deterministic seed (see `_seedFor`). */
  positions?: Record<string, { x: number; y: number }>;
}

/** How big the grid is, in canvas units. A tile is the component's own size plus its frame. */
const GRID = 24;
const TILE_W = 220;
const TILE_H = 140;
const MAX_ZOOM = 2;
const MIN_ZOOM = 0.25;
const ZOOM_STEP = 1.12;

export class DraftCanvas extends LitElement {
  static properties = {
    /** The layout to draw: { label?, nodes, positions }. */
    draft: { type: Object },
    /** The palette: '' draws the app's light sheet, 'dark' the reference's. */
    theme: { type: String, attribute: 'theme', reflect: true },
    /**
     * THE DESIGN SYSTEM THIS DRAFT DRAWS FROM — a partition's name, or '' for the app's own tables.
     * The HOST writes it (from the package's fact) and loads the partition's registry BEFORE the
     * tree names any of its components, because `resolveTag` reads the loaded map. One fact, one
     * reader: this property is not in the payload, so a payload cannot choose what its own names
     * are resolved against.
     */
    system: { type: String, attribute: 'system', reflect: true },
    /**
     * THE TRAY'S LIST — the draft-safe palette of the chosen catalogue, bound by the host
     * (/session/palette; the SERVER computes it from the same filter the compiler reads).
     * With it bound the stage draws its + Add picker; with none (the Composer's seat), no
     * tray — a control that cannot work is not drawn.
     */
    palette: { type: Array, attribute: false },
    /**
     * MAY A HAND MOVE ANYTHING HERE? (owner, 2026-10-03 evening — the product room). *"These
     * people do not understand design systems… get rid of the idea dragging elements around to
     * reassemble them… if they want to move something, they have to tell her."* The PRODUCT room
     * binds this false, and it means NOTHING moves by hand — not a node, and not the view: the
     * tile still SELECTS (a click is how a person inspects), but the pan and the zoom go with
     * the drag. (Found by driving: with only the node drag off, grabbing the BACKGROUND panned
     * the canvas — the owner: *"when I grab the background, it moves the buttons"* — and a view
     * that slides under a fixed ground reads as the tiles moving for no reason.) The Composer's
     * draft view keeps the default (true) — a developer's hands keep their gestures.
     */
    movable: { type: Boolean, attribute: 'movable', reflect: true },
    /**
     * THE DOT GRID — visible by default, hidden in the Product room (owner, 2026-10-03: *"remove
     * the dots from the screen because the background already has dots"*; that room's ground
     * carries its own). The room's declaration, like `movable`; the Composer's draft keeps it.
     */
    grid: { type: Boolean, attribute: 'grid', reflect: true },
    /**
     * THE STAGE'S OWN HAND — MAY IT BE CLEARED FROM THE RAIL? (owner, 2026-10-03, about the
     * form that "never goes away": the room had no control that could empty the stage). The
     * PRODUCT room binds this true; with it — and only while the draft holds at least one
     * node — the rail draws a small Clear beside + Add. A press ANNOUNCES (`draft-cleared`)
     * and the host writes the empty layout through the SAME one draft store the spoken
     * "clear the stage" already lands in — one fact, both hands, one writer. Default false:
     * the control exists where a room declares it, never everywhere.
     */
    clearable: { type: Boolean, attribute: 'clearable', reflect: true },
    /** Protected: the selection is the operator's, never the payload's. */
    selectedId: { type: String, attribute: false },
  };

  declare draft: DraftPayload | undefined;
  declare theme: string;
  declare system: string;
  declare palette: Array<{ name: string; description?: string }>;
  declare movable: boolean;
  declare grid: boolean;
  declare clearable: boolean;
  declare selectedId: string | null;

  private _vue: VueFlowCanvas | null = null;
  private _vueHost: HTMLElement | null = null;
  /** Where a hand has put a node, by node id. The element's record — see the file note. */
  private _pos = new Map<string, { x: number; y: number }>();
  private _drag: { id: string; startClientX: number; startClientY: number; x0: number; y0: number; moved: boolean } | null = null;
  private _pan: { startClientX: number; startClientY: number; x0: number; y0: number; moved: boolean } | null = null;
  private _zoom = 1;
  private _panX = 0;
  private _panY = 0;
  private _pickerOpen = false;

  constructor() {
    super();
    this.draft = undefined;
    this.theme = '';
    this.system = '';
    this.palette = [];
    this.movable = true;
    this.grid = true;
    this.selectedId = null;
  }

  /**
   * A NODE WITH NO PLACE GOES SOMEWHERE DETERMINISTIC — a placement rule, not a default standing in
   * for something that failed. Reading left to right, three to a row; the same payload always seeds
   * the same drawing, so a person's eye can follow it and a diff of two payloads reads.
   */
  private _seedFor(index: number): { x: number; y: number } {
    return { x: GRID + (index % 3) * (TILE_W + GRID), y: GRID + Math.floor(index / 3) * (TILE_H + GRID) };
  }

  private _place(n: DraftComponent, index: number): { x: number; y: number } {
    return this._pos.get(n.id) ?? this.draft?.positions?.[n.id] ?? this._seedFor(index);
  }

  private _onSurfaceDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const el = e.target instanceof Element ? e.target.closest('[data-node-id]') : null;
    const id = el?.getAttribute('data-node-id') ?? null;
    if (id) {
      e.stopPropagation();
      e.preventDefault();
      this._select(id);
      // A ROOM WITH NO DRAG STILL SELECTS (see the `movable` note): the click is inspection.
      if (!this.movable) return;
      const p = this._placeFor(id);
      this._drag = {
        id, startClientX: e.clientX, startClientY: e.clientY, x0: p.x, y0: p.y, moved: false,
      };
    } else {
      this._select(null);
      // THE VIEW DOES NOT MOVE EITHER when the room says nothing moves by hand (see `movable`):
      // an empty-space grab deselects and stops there — no pan, no listeners.
      if (!this.movable) return;
      this._pan = { startClientX: e.clientX, startClientY: e.clientY, x0: this._panX, y0: this._panY, moved: false };
    }
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onUp);
  };

  private _placeFor(id: string): { x: number; y: number } {
    const i = (this.draft?.nodes ?? []).findIndex((n) => n.id === id);
    const n = (this.draft?.nodes ?? [])[i];
    return n ? this._place(n, i) : { x: 0, y: 0 };
  }

  private _onMove = (e: PointerEvent): void => {
    if (this._drag) {
      const dx = (e.clientX - this._drag.startClientX) / this._zoom;
      const dy = (e.clientY - this._drag.startClientY) / this._zoom;
      if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) this._drag.moved = true;
      this._pos.set(this._drag.id, { x: this._drag.x0 + dx, y: this._drag.y0 + dy });
      this.requestUpdate();
      return;
    }
    if (this._pan) {
      const dx = e.clientX - this._pan.startClientX;
      const dy = e.clientY - this._pan.startClientY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this._pan.moved = true;
      this._panX = this._pan.x0 + dx;
      this._panY = this._pan.y0 + dy;
      this.requestUpdate();
    }
  };

  private _onUp = (): void => {
    this._detach();
    if (this._drag) {
      const { id, moved } = this._drag;
      const p = this._pos.get(id);
      // ONCE, on release, and only when it moved — a click is a selection, not a move.
      if (moved && p) {
        this.dispatchEvent(new CustomEvent('draft-node-moved', {
          bubbles: true, composed: true,
          detail: { nodeId: id, x: Math.round(p.x), y: Math.round(p.y) },
        }));
      }
      this._drag = null;
      this.requestUpdate();
      return;
    }
    this._pan = null;
    this.requestUpdate();
  };

  private _detach(): void {
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onUp);
  }

  private _onWheel = (e: WheelEvent): void => {
    // THE ZOOM GOES WITH THE PAN when the room says nothing moves by hand (see `movable`).
    if (!this.movable) return;
    e.preventDefault();
    const rect = this.getBoundingClientRect();
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, this._zoom * (e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP)));
    if (next === this._zoom) return;
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const k = next / this._zoom;
    this._panX = cx - (cx - this._panX) * k;
    this._panY = cy - (cy - this._panY) * k;
    this._zoom = next;
    this.requestUpdate();
  };

  private _select(id: string | null): void {
    if (this.selectedId === id) return;
    this.selectedId = id;
    this.dispatchEvent(new CustomEvent('draft-select', {
      bubbles: true, composed: true, detail: { nodeId: id },
    }));
  }

  private _togglePicker = (e: Event): void => {
    e.stopPropagation();
    this._pickerOpen = !this._pickerOpen;
    this.requestUpdate();
  };

  /**
   * ADD A COMPONENT — the tray's one gesture, and it ANNOUNCES rather than writes: the element
   * does not own the payload (the model does, and the host is the single writer), so an add
   * dispatches `draft-node-added` with the node and its place, exactly as a drag dispatches
   * `draft-node-moved`. The host folds it into the payload and persists it.
   *
   * THE PLACE IS THE SEED RULE (`_seedFor`) — a new node lands where an item with that index
   * reads, deterministic, never a hidden default. The ID is derived the same way and checked
   * against the payload, so `n-1` is never handed out twice.
   */
  private _addNode(name: string): void {
    const nodes = this.draft?.nodes ?? [];
    let k = nodes.length + 1;
    while (nodes.some((n) => n.id === `n-${k}`)) k += 1;
    const at = this._seedFor(nodes.length);
    this._pickerOpen = false;
    this.dispatchEvent(new CustomEvent('draft-node-added', {
      bubbles: true, composed: true,
      detail: { nodeId: `n-${k}`, component: name, x: at.x, y: at.y },
    }));
  }

  /**
   * CLEAR THE STAGE — the rail's own act, and it ANNOUNCES like every other gesture: the
   * element does not own the payload, so a press dispatches `draft-cleared` carrying NOTHING
   * (the empty layout is the host's write, through the same one draft store the spoken
   * "clear the stage" lands in via the compile). Drawn only while there is something to
   * clear (see the render), so it is never a control that cannot work.
   */
  private _clear = (e: Event): void => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('draft-cleared', { bubbles: true, composed: true }));
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback(): void {
    this._vue?.unmount();
    this._vue = null;
    this._detach();
    this._drag = null;
    this._pan = null;
    window.removeEventListener('resize', this._onResize);
    super.disconnectedCallback();
  }

  /**
   * A SMALLER WINDOW IS NOT A SMALLER LAYOUT (2026-10-03, the owner in a smaller browser window:
   * *"It's not responsive and I can't read [it]… I can't move the canvas at all"* — true in this
   * room by design: no pan, no zoom). So the element answers the two halves itself:
   *   · the ladder's width is CLAMPED to the box (see `resolveForDraw`), and
   *   · the content is CENTERED here, on every draw and every resize, in a room whose hands are
   *     off (`movable: false`) — the viewport follows the content, because nobody else can.
   * The Composer's draft keeps its hands and its own view: this never runs there.
   */
  private _onResize = (): void => {
    this.requestUpdate();
  };

  private async _centerContent(): Promise<void> {
    if (this.movable) return;
    const host = this._vueHost;
    if (!host) return;
    await this.updateComplete;
    // A TIMER, NOT rAF — rAF does not fire in a hidden pane (measured tonight, three times:
    // the splash, the system write, this), and a room that only centers itself while watched
    // is the bug the owner hit from the other side of the glass.
    setTimeout(() => {
      if (this.movable || !this._vueHost) return;
      const box = this._vueHost.getBoundingClientRect();
      const tiles = Array.from(this._vueHost.querySelectorAll('.draft-node')) as HTMLElement[];
      if (!tiles.length || !box.width) return;
      let minX = Infinity, maxX = -Infinity, minY = Infinity;
      for (const tile of tiles) {
        const r = tile.getBoundingClientRect();
        minX = Math.min(minX, r.left);
        maxX = Math.max(maxX, r.right);
        minY = Math.min(minY, r.top);
      }
      const contentW = maxX - minX;
      const shiftX = (box.left + box.width / 2) - (minX + contentW / 2);
      const shiftY = Math.max(0, box.top + 48 - minY);
      if (Math.abs(shiftX) > 1 || Math.abs(shiftY) > 1) {
        this._panX += shiftX / this._zoom;
        this._panY += shiftY / this._zoom;
        this._vue?.setViewport({ x: this._panX, y: this._panY, zoom: this._zoom });
      }
    });
  }

  protected updated(): void {
    if (!this._vueHost) return;
    if (!this._vue) {
      this._vue = mountVueFlowCanvas(this._vueHost, { theme: this.theme, variant: 'catalog', grid: this.grid });
    } else {
      this._vue.setTheme(this.theme);
    }
    /*
     * THE TAG IS RESOLVED HERE, ONCE PER NODE, and the module is handed the answer: the renderer
     * draws what it is told. TWO REFUSALS, TWO SENTENCES, both drawn on the tile by name — never a
     * blank frame, never a substituted component:
     *   · the catalogue does not know the name at all; or
     *   · the name resolves (a system's registry maps it) to an element this bundle does NOT
     *     contain — an ingested system whose component is proposed but not implemented yet, which is
     *     a real state and not an ingest error (§5 of wireframe-lab/ADD-A-DESIGN-SYSTEM.md).
     */
    // EACH NODE, AND EACH OF ITS CHILDREN, RESOLVED THE SAME WAY — a container's contents are
    // resolved by this same reader (see DraftComponent.children): the refusals are drawn on the
    // child by name, inside the container, exactly as on a top-level tile.
    const resolveForDraw = (n: DraftComponent, x: number, y: number): Record<string, unknown> => {
      const tag = resolveTag(n.component, this.system || undefined);
      const drawable = Boolean(tag && customElements.get(tag));
      const refused = drawable
        ? ''
        : tag
          ? `"${n.component}" maps to <${tag}>, and nothing in this app draws that element yet.`
          : `The catalogue does not know "${n.component}".`;
      // THE LADDER, CLAMPED TO THIS BOX (2026-10-03, the owner in a smaller window: *"Are you
      // using clamps to center things? It's not responsive"*): the ladder width is a CEILING,
      // the room is the floor — a narrow window narrows the tile instead of overflowing it,
      // with a small margin on each side. Children flow and get none.
      const ladder = n.size && SIZES[n.size] ? SIZES[n.size] : 0;
      const available = Math.max(180, (this.clientWidth || 0) - 96);
      const widthPx = ladder ? Math.min(ladder, available) : undefined;
      return {
        id: n.id, x, y,
        selected: this.selectedId === n.id,
        tag: drawable ? (tag as string) : '',
        refused,
        props: n.props ?? {},
        size: n.size,
        widthPx,
        children: (n.children ?? []).map((c) => resolveForDraw(c, 0, 0)),
      };
    };
    const nodes = (this.draft?.nodes ?? []).map((n, i) => {
      const p = this._place(n, i);
      return resolveForDraw(n, p.x, p.y);
    });
    this._vue.update(nodes as never);
    this._vue.setViewport({ x: this._panX, y: this._panY, zoom: this._zoom });
    // AND THE HANDS-OFF ROOM KEEPS ITS CONTENT IN VIEW (see `_centerContent`): a smaller window
    // must not hide the layout behind an edge nobody can drag it away from.
    void this._centerContent();
  }

  render() {
    const draft = this.draft;
    return html`
      <div
        class="stage"
        tabindex="0"
        role="application"
        aria-label="Wireframe draft"
        @pointerdown=${this._onSurfaceDown}
        @wheel=${this._onWheel}
      >
        <div
          class="vue-host"
          ${ref((el) => { this._vueHost = (el as HTMLElement | undefined) ?? null; })}
        ></div>
        ${this.palette && this.palette.length > 0
          ? html`
              <div class="tray" @pointerdown=${(e: PointerEvent) => e.stopPropagation()}>
                <button
                  class="tray-btn"
                  type="button"
                  aria-expanded=${this._pickerOpen ? 'true' : 'false'}
                  @click=${this._togglePicker}
                >+ Add</button>
                ${this.clearable && (draft?.nodes.length ?? 0) > 0
                  ? html`<button
                      class="tray-btn"
                      type="button"
                      title="Clear the stage"
                      @click=${this._clear}
                    >✕ Clear</button>`
                  : nothing}
                ${this._pickerOpen
                  ? html`
                      <div class="tray-menu" role="listbox" aria-label="Draft-safe components">
                        ${this.palette.map((item) => html`
                          <button class="tray-item" type="button" role="option" @click=${() => this._addNode(item.name)}>
                            <span class="tray-name">${item.name}</span>
                            ${item.description ? html`<span class="tray-desc">${item.description}</span>` : nothing}
                          </button>
                        `)}
                      </div>`
                  : nothing}
              </div>`
          : nothing}
        ${!draft || draft.nodes.length === 0
          ? html`<div class="empty" role="status">Nothing drafted yet. Add a component from the palette, and drag it where it belongs.</div>`
          : nothing}
      </div>
    `;
  }

  static styles = [
    designTokens,
    unsafeCSS(vfStyle),
    css`
      /* No backticks in this stylesheet: it is a tagged template literal, and one raw
         backtick ends it. tsc will not say so; esbuild will. */

      :host { display: block; position: relative; width: 100%; height: 100%; min-height: 0; }
      .stage {
        position: relative; width: 100%; height: 100%;
        overflow: hidden; outline: none; cursor: grab;
      }
      .stage:focus-visible { outline: 2px solid var(--ds-teal); outline-offset: -2px; }

      /* THE LIBRARY'S SURFACE. Vue Flow draws the nodes; this element owns every gesture, so the
         pane takes no pointer. The same division the execution canvas states, and the same reason. */
      .vue-host { position: absolute; inset: 0; }
      .vue-host .vue-flow { width: 100%; height: 100%; background: transparent; }
      .vue-host .vue-flow__pane,
      .vue-host .vue-flow__transformationpane,
      .vue-host .vue-flow__background { pointer-events: none; }

      /* A PLACED COMPONENT'S FRAME. The component draws itself; this is the ground it stands on,
         and the only thing this view adds to it. Sized to its content: a draft holds components of
         every size, unlike a run's uniform tiles. */
      .vue-host .draft-node {
        padding: 10px 12px;
        min-width: 120px; min-height: 48px;
        display: inline-block;
        background: var(--ds-surface);
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
        font-family: 'Inter', system-ui, sans-serif;
      }
      .vue-host .draft-node.sel {
        outline: 2px solid var(--ds-teal); outline-offset: 2px;
      }
      /* A REFUSED NAME IS DRAWN, NOT HIDDEN: the sentence IS the node's content, so a layout the
         catalogue cannot draw reads as exactly that rather than as an empty frame. */
      .vue-host .draft-node .refusal {
        font-size: 12px; color: var(--ds-red);
        max-width: 220px;
      }
      .empty {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        color: var(--ds-muted); font-size: var(--ds-fs-md);
        pointer-events: none;
      }

      /* THE TRAY — the one control this element adds, and it is drawn ONLY when a palette is
         bound (see the property). Colors carry fallbacks: the tokens this app defines are used
         where they exist, and nothing here invents a variable the theme may not hold. */
      /* THE RAIL: one row — + Add (when a palette is bound) and the room's Clear (when the
         room declares clearable and there is something to clear). The picker menu hangs
         under the row's start. */
      .tray { position: absolute; top: 12px; left: 12px; z-index: 4; display: flex; gap: 8px; align-items: flex-start; }
      .tray-btn {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px; font-weight: 600;
        color: var(--ds-ink, #234354); background: var(--ds-surface);
        border: 1px solid var(--ds-rule); border-radius: var(--ds-radius);
        padding: 6px 12px; cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
      }
      .tray-btn:hover { background: rgba(0, 0, 0, 0.04); }
      .tray-menu {
        position: absolute; top: 36px; left: 0;
        width: 280px; max-height: 320px; overflow: auto;
        background: var(--ds-surface);
        border: 1px solid var(--ds-rule); border-radius: var(--ds-radius);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
      }
      .tray-item {
        display: flex; flex-direction: column; gap: 2px;
        width: 100%; padding: 8px 10px; text-align: left;
        background: none; border: 0; cursor: pointer;
      }
      .tray-item:hover { background: rgba(0, 0, 0, 0.05); }
      .tray-name { font-family: 'Inter', system-ui, sans-serif; font-size: 13px; color: var(--ds-ink, #234354); }
      .tray-desc { font-family: 'Inter', system-ui, sans-serif; font-size: 11px; color: var(--ds-muted); }
    `,
  ];
}

if (!customElements.get('draft-canvas')) customElements.define('draft-canvas', DraftCanvas);

declare global {
  interface HTMLElementTagNameMap {
    'draft-canvas': DraftCanvas;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'draft-canvas': React.DetailedHTMLProps<
        React.HTMLAttributes<DraftCanvas> & { ref?: React.Ref<DraftCanvas> },
        DraftCanvas
      >;
    }
  }
}
