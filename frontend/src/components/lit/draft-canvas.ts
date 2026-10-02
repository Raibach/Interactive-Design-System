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
 * WHY ITS EVENTS HAVE THEIR OWN NAMES — `draft-select` and `draft-node-moved`, not `flow-select`
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
import { mountVueFlowCanvas, type VueFlowCanvas } from './canvas/vueFlowCanvas';
// The library's stylesheet, inlined into the shadow root — the pane and the transformation pane
// come up unpositioned without it. The same line `agent-flow` carries, for the same reason.
import vfStyle from '@vue-flow/core/dist/style.css?inline';

/** One component, placed. `props` are the element's own declared properties, verbatim. */
export interface DraftComponent {
  id: string;
  component: string;
  props?: Record<string, unknown>;
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
    /** Protected: the selection is the operator's, never the payload's. */
    selectedId: { type: String, attribute: false },
  };

  declare draft: DraftPayload | undefined;
  declare theme: string;
  declare system: string;
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

  constructor() {
    super();
    this.draft = undefined;
    this.theme = '';
    this.system = '';
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
      const p = this._placeFor(id);
      this._drag = {
        id, startClientX: e.clientX, startClientY: e.clientY, x0: p.x, y0: p.y, moved: false,
      };
    } else {
      this._select(null);
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

  disconnectedCallback(): void {
    this._vue?.unmount();
    this._vue = null;
    this._detach();
    this._drag = null;
    this._pan = null;
    super.disconnectedCallback();
  }

  protected updated(): void {
    if (!this._vueHost) return;
    if (!this._vue) {
      this._vue = mountVueFlowCanvas(this._vueHost, { theme: this.theme, variant: 'catalog' });
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
    const nodes = (this.draft?.nodes ?? []).map((n, i) => {
      const p = this._place(n, i);
      const tag = resolveTag(n.component, this.system || undefined);
      const drawable = Boolean(tag && customElements.get(tag));
      const refused = drawable
        ? ''
        : tag
          ? `"${n.component}" maps to <${tag}>, and nothing in this app draws that element yet.`
          : `The catalogue does not know "${n.component}".`;
      return {
        id: n.id, x: p.x, y: p.y,
        selected: this.selectedId === n.id,
        tag: drawable ? (tag as string) : '',
        refused,
        props: n.props ?? {},
      };
    });
    this._vue.update(nodes);
    this._vue.setViewport({ x: this._panX, y: this._panY, zoom: this._zoom });
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
        ${!draft || draft.nodes.length === 0
          ? html`<div class="empty" role="status">Nothing drafted yet. A layout appears here.</div>`
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
