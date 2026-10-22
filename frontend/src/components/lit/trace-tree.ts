/**
 * <trace-tree> — the trace panel, for the seat's Trace tab: the Langfuse fork's
 * navigation panel transcribed whole.
 *
 * WHAT IT IS. The fork's panel = a toolbar (TracePanelNavigationHeader) plus one of
 * three views (the Tree, the Timeline, the Graph), and this element is that panel: the
 * SAME controls with the SAME labels — Search, the Expand all / Collapse all toggle,
 * the View Options dropdown (Show Comments, Show Scores, Show Duration, Show Cost,
 * Collapse System Prompts, Min Level — the fork's own six), and the Tree | Timeline |
 * Graph switch. The preferences act on what is drawn, exactly as the fork's do. The
 * owner, 2026-10-13: "there's no drop-down … if it's a flat list there's no drop-down"
 * and "you need to capture the control controls … nothing should be left out".
 * Placement first: the panel wraps however it needs to; styling is the owner's later
 * pass.
 *
 * NOT TRANSCRIBED YET (said so the panel never pretends): the dense timeline's
 * map-mode (wheel/pinch zoom of rows, drag box zoom, the focus lens) and the graph's
 * ELK layout + search dimming; the graph here lays the SAME instrumented hierarchy out
 * in layers (the fork's own "expanded" semantics) with pan/zoom of its own.
 *
 * IT IS A VIEW, NOT A SOURCE — the trace-feed contract: every prop arrives from the
 * shell (lib/governance-trace-source.ts reads them; the shell writes them), the
 * selected node is the shell's state, and a click says `trace-node-selected` — the
 * element never selects itself. `collapseSystemPrompt` travels the other way: it is a
 * preference of this header that reshapes the DETAIL's blocks, so toggling it also
 * emits `trace-prefs` for the shell to hand to <trace-detail>.
 */

import { LitElement, html, css, nothing } from 'lit';
import { unsafeSVG } from 'lit/directives/unsafe-svg.js';
import { designTokens } from '@/shared/design-tokens';
import type { GovTraceSummary, GovTraceObservation, GovTraceScore } from '@/lib/governance-trace-source';

function fmtLatency(seconds: number | null): string | null {
  return seconds === null ? null : `${seconds.toFixed(2)}s`;
}

function fmtCost(cost: number | null): string | null {
  if (cost === null) return null;
  if (cost === 0) return '$0';
  const digits = cost < 0.01 ? 6 : 4;
  return `$${cost.toFixed(digits).replace(/0+$/, '').replace(/\.$/, '')}`;
}

function fmtTokens(tokens: number | null): string | null {
  // Zero is not a reading, it is the absence of one (a span with no usage): the
  // fork's own tables print nothing there, and a literal "0" beside a latency
  // reads like a defect. The trace-level sum still draws through the header.
  if (tokens === null || tokens === 0) return null;
  if (tokens < 1000) return String(tokens);
  const k = tokens / 1000;
  return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}k`;
}

/** The badge's three letters — GENERATION / SPAN / EVENT, the events model's kinds. */
function typeBadge(type: string): string {
  switch (type.toUpperCase()) {
    case 'GENERATION': return 'GEN';
    case 'EVENT': return 'EVT';
    default: return 'SPAN';
  }
}

/** The type's hue class — the same three the badges use, one place. */
function typeClass(type: string): string {
  switch (type.toUpperCase()) {
    case 'GENERATION': return 't-gen';
    case 'EVENT': return 't-evt';
    default: return 't-span';
  }
}

/** A score's value as its own dataType reads it — the fork's ScoreBadge behavior. */
function fmtScore(score: GovTraceScore): string {
  const t = (score.dataType ?? '').toUpperCase();
  if (t === 'BOOLEAN') return score.value ? 'True' : 'False';
  if (t === 'CATEGORICAL') return score.stringValue ?? '';
  if (score.value !== null) return String(score.value);
  return score.stringValue ?? '';
}

/** Escape a string for text content / double-quoted attribute values in the graph's svg string. */
function escXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type ViewMode = 'tree' | 'timeline' | 'graph';
type LevelValue = 'DEFAULT' | 'DEBUG' | 'WARNING' | 'ERROR';

/** The order the Min Level filter compares by — the events model's own ladder. */
const LEVEL_ORDER: Record<string, number> = { DEFAULT: 0, DEBUG: 1, WARNING: 2, ERROR: 3 };
const LEVELS: LevelValue[] = ['DEFAULT', 'DEBUG', 'WARNING', 'ERROR'];

interface TreeRow {
  observation: GovTraceObservation;
  depth: number;
}

export class TraceTree extends LitElement {
  static properties = {
    /** The selected trace's summary. Undefined/null = none — draws its own empty face. */
    trace: { type: Object },
    /** The trace's observations. Undefined while the shell is reading; [] = the trace has none. */
    observations: { type: Array },
    /** The node the shell has selected — the highlight, written back after a click. */
    selectedId: { type: String },
    /** The trace's scores (ScoreDomain rows) — the shell's read; [] = none, [] is a fact. */
    scores: { type: Array },
    /** Observation id → comment count — the shell's bulk read (comments.getCountByObjectType). */
    commentCounts: { type: Object },
  };

  declare trace?: GovTraceSummary | null;
  declare observations?: GovTraceObservation[];
  declare selectedId?: string | null;
  declare scores?: GovTraceScore[];
  declare commentCounts?: Record<string, number>;

  /** UI-local: which nodes are folded away. Content state (selection) is the shell's. */
  private _collapsed = new Set<string>();
  /** UI-local: the search box's filter, matched against node names. */
  private _query = '';
  /** The panel's view — the fork's switch, its three labels verbatim. */
  private _mode: ViewMode = 'tree';
  /** The View Options panel — open state (the fork's gear dropdown). */
  private _settingsOpen = false;
  /**
   * The View Options toggles — the fork's own six, defaults verbatim from its
   * ViewPreferencesContext (everything shown; system prompts not collapsed).
   */
  private _prefs = {
    showComments: true,
    showScores: true,
    showDuration: true,
    showCostTokens: true,
    collapseSystemPrompt: false,
  };
  /** Min Level — the fork's default; DEFAULT shows every observation. */
  private _minLevel: LevelValue = 'DEFAULT';
  /** The graph viewport — pan/zoom, the fork's own bounds (ZOOM_STEP 1.4, .05–2). */
  private _gx = 0;
  private _gy = 0;
  private _gk = 1;
  private _gdrag: { x: number; y: number; moved: boolean } | null = null;

  static styles = [
    designTokens,
    css`
      :host {
        display: block;
        width: 100%;
        font-family: var(--ds-font);
        font-size: var(--ds-fs-sm);
        color: var(--chat-text, var(--ds-text));
        background: var(--chat-bg, var(--ds-surface));
      }
      /* THE TOOLBAR. Placement first: it WRAPS when it must (the owner: "even if it
         uncomfortably wraps, no big deal … I want them in place"). */
      .bar {
        position: sticky;
        top: 0;
        z-index: 2;
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;
        padding: 8px 14px;
        background: var(--chat-bg, var(--ds-surface));
        border-bottom: 1px solid var(--chat-rule, var(--ds-rule));
      }
      .search {
        flex: 1 1 140px;
        min-width: 90px;
        height: 28px;
        padding: 0 10px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius-sm);
        background: transparent;
        color: inherit;
        font: inherit;
        outline: none;
      }
      .search:focus {
        border-color: var(--ds-teal);
      }
      .count {
        font-size: var(--ds-fs-meta);
        color: var(--ds-muted);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }
      .tools {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .tb {
        height: 28px;
        padding: 0 8px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius-sm);
        background: transparent;
        color: var(--ds-muted);
        font: inherit;
        font-size: var(--ds-fs-meta);
        cursor: pointer;
        white-space: nowrap;
      }
      .tb:hover {
        color: var(--chat-text, var(--ds-text));
      }
      .tb.on {
        color: var(--chat-text, var(--ds-text));
        font-weight: 600;
        background: var(--chat-user-bg, var(--ds-surface-hover));
      }
      .seg {
        display: inline-flex;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius-sm);
        overflow: hidden;
      }
      .seg button {
        border: 0;
        background: transparent;
        color: var(--ds-muted);
        font: inherit;
        font-size: var(--ds-fs-meta);
        padding: 4px 10px;
        cursor: pointer;
      }
      .seg button:hover {
        color: var(--chat-text, var(--ds-text));
      }
      .seg button.on {
        color: var(--chat-text, var(--ds-text));
        font-weight: 600;
        background: var(--chat-user-bg, var(--ds-surface-hover));
      }
      /* THE VIEW OPTIONS PANEL — the fork's gear dropdown. Anchors under the toolbar. */
      .opts-wrap {
        position: relative;
      }
      .opts {
        position: absolute;
        right: 0;
        top: 32px;
        z-index: 5;
        min-width: 230px;
        padding: 8px;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius-sm);
        background: var(--chat-bg, var(--ds-surface));
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.25);
      }
      .opt {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 4px 6px;
        font-size: var(--ds-fs-meta);
        cursor: pointer;
      }
      .opt select {
        background: transparent;
        color: inherit;
        border: 1px solid var(--chat-rule, var(--ds-rule));
        border-radius: var(--ds-radius-sm);
        font: inherit;
        font-size: var(--ds-fs-meta);
        padding: 2px 4px;
      }
      .rows {
        padding: 6px 0 12px;
      }
      .row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 5px 14px 5px 8px;
        cursor: pointer;
        border-left: 2px solid transparent;
        transition: background 90ms linear;
      }
      .row:hover {
        background: var(--chat-user-bg, var(--ds-surface-hover));
      }
      .row.selected {
        border-left-color: var(--ds-teal);
        background: var(--chat-user-bg, var(--ds-surface-hover));
      }
      .chev {
        width: 16px;
        flex: 0 0 16px;
        border: 0;
        background: none;
        color: var(--ds-muted);
        font: inherit;
        cursor: pointer;
        padding: 0;
        text-align: center;
      }
      .chev.blank {
        visibility: hidden;
      }
      .badge {
        flex: 0 0 auto;
        padding: 1.5px 6px;
        border-radius: var(--ds-radius-sm);
        font-size: var(--ds-fs-label);
        font-weight: 700;
        letter-spacing: 0.06em;
      }
      .t-gen { color: #c4b5fd; background: rgba(196, 181, 253, 0.14); }
      .t-span { color: #7dd3fc; background: rgba(125, 211, 252, 0.14); }
      .t-evt { color: #fcd34d; background: rgba(252, 211, 77, 0.14); }
      .name {
        flex: 1 1 auto;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .chip {
        flex: 0 0 auto;
        padding: 1.5px 6px;
        border-radius: var(--ds-radius-sm);
        border: 1px solid var(--chat-rule, var(--ds-rule));
        color: var(--ds-muted);
        font-size: var(--ds-fs-label);
        white-space: nowrap;
      }
      .cmt {
        flex: 0 0 auto;
        min-width: 16px;
        padding: 1px 5px;
        border-radius: 999px;
        background: var(--chat-user-bg, var(--ds-surface-hover));
        color: var(--ds-muted);
        font-size: var(--ds-fs-label);
        text-align: center;
        font-variant-numeric: tabular-nums;
      }
      .metrics {
        flex: 0 0 auto;
        display: inline-flex;
        gap: 12px;
        font-variant-numeric: tabular-nums;
        font-size: var(--ds-fs-meta);
        color: var(--ds-muted);
        white-space: nowrap;
      }
      /* THE TIMELINE — a lane per observation: name gutter, the time track with the
         bar, the row metrics (duration then cost, the fork's own content). */
      .tl {
        padding: 8px 14px 14px;
      }
      .tl-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 0;
        cursor: pointer;
        border-left: 2px solid transparent;
        padding-left: 6px;
      }
      .tl-row:hover {
        background: var(--chat-user-bg, var(--ds-surface-hover));
      }
      .tl-row.selected {
        border-left-color: var(--ds-teal);
        background: var(--chat-user-bg, var(--ds-surface-hover));
      }
      .tl-name {
        flex: 0 0 200px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .tl-track {
        position: relative;
        flex: 1 1 auto;
        min-width: 80px;
        height: 14px;
      }
      .tl-bar {
        position: absolute;
        top: 3px;
        height: 8px;
        border-radius: 3px;
      }
      .tl-metrics {
        flex: 0 0 auto;
        display: inline-flex;
        gap: 10px;
        font-variant-numeric: tabular-nums;
        font-size: var(--ds-fs-meta);
        color: var(--ds-muted);
        white-space: nowrap;
      }
      /* THE GRAPH — a pannable canvas, boxes and elbow edges, the fork's own
         transform (translate + scale) and zoom bounds. */
      .g-wrap {
        position: relative;
        height: 420px;
        overflow: hidden;
        cursor: grab;
      }
      .g-wrap.dragging {
        cursor: grabbing;
      }
      .g-zoom {
        position: absolute;
        right: 10px;
        top: 10px;
        z-index: 3;
        display: inline-flex;
        gap: 4px;
      }
      .g-world {
        position: absolute;
        left: 0;
        top: 0;
        transform-origin: 0 0;
      }
      .g-node {
        cursor: pointer;
      }
      .empty {
        padding: 18px 14px;
        font-size: var(--ds-fs-sm);
        color: var(--ds-muted);
      }
      .waiting {
        display: flex;
        align-items: center;
        gap: 9px;
        padding: 18px 14px;
        font-size: var(--ds-fs-sm);
        color: var(--ds-muted);
      }
      .spinner {
        width: 13px;
        height: 13px;
        border: 2px solid var(--ds-teal);
        border-top-color: transparent;
        border-radius: 50%;
        animation: tt-spin 0.8s linear infinite;
      }
      @keyframes tt-spin {
        to { transform: rotate(360deg); }
      }
    `,
  ];

  /** The observations the Min Level filter admits — every view draws from these. */
  private _visibles(): GovTraceObservation[] {
    const min = LEVEL_ORDER[this._minLevel] ?? 0;
    return (this.observations ?? []).filter(
      (o) => (LEVEL_ORDER[o.level ?? 'DEFAULT'] ?? 0) >= min,
    );
  }

  /** The admitted observations as a hierarchy — roots and children, both time-ordered. */
  private _hierarchy(): { roots: GovTraceObservation[]; children: Map<string, GovTraceObservation[]> } {
    const observations = this._visibles();
    const ids = new Set(observations.map((o) => o.id));
    const roots: GovTraceObservation[] = [];
    const children = new Map<string, GovTraceObservation[]>();
    for (const o of observations) {
      // A parent that is not IN the set makes this node a root — the fork draws the
      // same way when a trace's parent lives outside the fetched window (and the
      // Min Level filter re-parents exactly the same way).
      const parent = o.parentObservationId && ids.has(o.parentObservationId) ? o.parentObservationId : null;
      if (parent === null) {
        roots.push(o);
      } else {
        const arr = children.get(parent) ?? [];
        arr.push(o);
        children.set(parent, arr);
      }
    }
    const sortFn = (a: GovTraceObservation, b: GovTraceObservation) =>
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    roots.sort(sortFn);
    for (const arr of children.values()) arr.sort(sortFn);
    return { roots, children };
  }

  /** The tree, flattened to rows in draw order — nesting is depth, not markup. */
  private _rows(): TreeRow[] {
    const { roots, children } = this._hierarchy();
    const query = this._query.trim().toLowerCase();
    const rows: TreeRow[] = [];
    // While filtering, folding is ignored — the search must be able to find a node
    // inside a folded branch, and the result is a flat list of the matches.
    const walk = (list: GovTraceObservation[], depth: number) => {
      for (const o of list) {
        rows.push({ observation: o, depth });
        if (query || !this._collapsed.has(o.id)) walk(children.get(o.id) ?? [], depth + 1);
      }
    };
    walk(roots, 0);
    return query ? rows.filter((r) => (r.observation.name ?? '').toLowerCase().includes(query)) : rows;
  }

  /** Every id that HAS children — what Collapse all folds. */
  private _expandableIds(): string[] {
    return [...this._hierarchy().children.keys()];
  }

  /** The fork's own test: everything collapsed = every root is folded. */
  private _isEverythingCollapsed(): boolean {
    const roots = this._hierarchy().roots;
    return roots.length > 0 && roots.every((r) => this._collapsed.has(r.id));
  }

  /** One button, two labels — the fork's toggle (TracePanelNavigationHeader). */
  private _toggleAll() {
    if (this._isEverythingCollapsed()) this._collapsed.clear();
    else for (const id of this._expandableIds()) this._collapsed.add(id);
    this.requestUpdate();
  }

  /** The scores pinned to one observation — trace-level rows (no observationId) stay out. */
  private _scoresFor(id: string): GovTraceScore[] {
    return (this.scores ?? []).filter((s) => s.observationId === id);
  }

  private _onRowClick(observation: GovTraceObservation) {
    this.dispatchEvent(
      new CustomEvent('trace-node-selected', {
        detail: { id: observation.id },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _toggle(observation: GovTraceObservation, event: Event) {
    event.stopPropagation();
    if (this._collapsed.has(observation.id)) this._collapsed.delete(observation.id);
    else this._collapsed.add(observation.id);
    this.requestUpdate();
  }

  private _onSearch(event: Event) {
    this._query = (event.target as HTMLInputElement).value;
    this.requestUpdate();
  }

  private _setPref(key: keyof TraceTree['_prefs'], value: boolean) {
    this._prefs = { ...this._prefs, [key]: value };
    // Collapse System Prompts is a preference of THIS header that reshapes the
    // DETAIL's blocks — the shell hands it over (see the element header).
    if (key === 'collapseSystemPrompt') {
      this.dispatchEvent(
        new CustomEvent('trace-prefs', {
          detail: { collapseSystemPrompt: value },
          bubbles: true,
          composed: true,
        }),
      );
    }
    this.requestUpdate();
  }

  // ── the graph's viewport — the fork's own transform and bounds ─────────────

  private _gZoom(factor: number) {
    this._gk = Math.min(2, Math.max(0.05, this._gk * factor));
    this.requestUpdate();
  }

  private _gFit() {
    this._gx = 0;
    this._gy = 0;
    this._gk = 1;
    this.requestUpdate();
  }

  private _onGraphWheel(event: WheelEvent) {
    event.preventDefault();
    this._gZoom(event.deltaY < 0 ? 1.4 : 1 / 1.4);
  }

  private _onGraphDown(event: PointerEvent) {
    this._gdrag = { x: event.clientX - this._gx, y: event.clientY - this._gy, moved: false };
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.requestUpdate();
  }

  private _onGraphMove(event: PointerEvent) {
    if (!this._gdrag) return;
    const nx = event.clientX - this._gdrag.x;
    const ny = event.clientY - this._gdrag.y;
    if (Math.abs(nx - this._gx) + Math.abs(ny - this._gy) > 4) this._gdrag.moved = true;
    this._gx = nx;
    this._gy = ny;
    this.requestUpdate();
  }

  private _onGraphUp(event: PointerEvent) {
    const moved = this._gdrag?.moved ?? false;
    this._gdrag = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    // A dragged release is a pan, not a click on whatever stood under the pointer.
    if (moved) {
      this.requestUpdate();
      return;
    }
    /*
     * THE NODE PICK — A HIT TEST AT THE RELEASE POINT, NOT A CLICK LISTENER (measured
     * live, 2026-10-13 night): pointerdown captures the pointer on this wrap (the pan
     * needs it), and a captured pointer RETARGETS the derived click to the capture
     * element — the browser fired the click at the wrap itself, never at the node
     * under the pointer, so a delegated svg @click could never fire (instrumented:
     * the wrap saw the click with the wrap as its own target, the svg saw nothing).
     * The release is therefore hit-tested directly: the topmost element at the
     * release point inside THIS shadow root, walked up to its nearest g.g-node,
     * whose data-oid carries the observation id (see _graphView).
     */
    const hit = this.shadowRoot?.elementFromPoint(event.clientX, event.clientY) ?? null;
    const g = hit?.closest?.('g.g-node') ?? null;
    const id = g?.getAttribute('data-oid');
    if (!id) return;
    const observation = (this.observations ?? []).find((o) => o.id === id);
    if (observation) this._onRowClick(observation);
  }

  /** A cancelled gesture is never a click — just drop the drag and the capture. */
  private _onGraphCancel(event: PointerEvent) {
    this._gdrag = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
    this.requestUpdate();
  }

  // ── the three views ────────────────────────────────────────────────────────

  private _treeView(rows: TreeRow[]) {
    const { children } = this._hierarchy();
    return html`
      <div class="rows">
        ${rows.map(({ observation, depth }) => {
          const hasChildren = children.has(observation.id);
          const collapsed = this._collapsed.has(observation.id);
          const latency = fmtLatency(observation.latency);
          const cost = fmtCost(observation.totalCost);
          const tokens = fmtTokens(observation.totalTokens);
          const scores = this._scoresFor(observation.id);
          const comments = this.commentCounts?.[observation.id] ?? 0;
          return html`
            <div
              class="row ${this.selectedId === observation.id ? 'selected' : ''}"
              style=${`padding-left: ${8 + depth * 16}px`}
              @click=${() => this._onRowClick(observation)}
            >
              <button
                class="chev ${hasChildren ? '' : 'blank'}"
                aria-label=${collapsed ? 'Expand' : 'Collapse'}
                @click=${(e: Event) => this._toggle(observation, e)}
              >
                ${collapsed ? '▸' : '▾'}
              </button>
              <span class="badge ${typeClass(observation.type)}">${typeBadge(observation.type)}</span>
              <span class="name" title=${observation.name ?? ''}>${observation.name ?? '—'}</span>
              ${this._prefs.showScores && scores.length
                ? scores.map((s) => html`<span class="chip" title="score">${s.name}: ${fmtScore(s)}</span>`)
                : nothing}
              ${this._prefs.showComments && comments > 0
                ? html`<span class="cmt" title="${comments} comment${comments === 1 ? '' : 's'}">${comments}</span>`
                : nothing}
              <span class="metrics">
                ${this._prefs.showDuration && latency ? html`<span>${latency}</span>` : nothing}
                ${this._prefs.showCostTokens && cost ? html`<span>${cost}</span>` : nothing}
                ${this._prefs.showCostTokens && tokens ? html`<span>${tokens}</span>` : nothing}
              </span>
            </div>
          `;
        })}
      </div>
    `;
  }

  private _timelineView() {
    const rows = [...this._visibles()].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime(),
    );
    const starts = rows.map((o) => new Date(o.startTime).getTime());
    const ends = rows.map((o) =>
      o.endTime
        ? new Date(o.endTime).getTime()
        : new Date(o.startTime).getTime() + (o.latency ?? 0) * 1000,
    );
    const t0 = Math.min(...starts);
    const span = Math.max(Math.max(...ends) - t0, 1);
    const HUE: Record<string, string> = {
      't-gen': 'rgba(196, 181, 253, 0.55)',
      't-span': 'rgba(125, 211, 252, 0.55)',
      't-evt': 'rgba(252, 211, 77, 0.55)',
    };
    return html`
      <div class="tl">
        ${rows.map((o) => {
          const s = new Date(o.startTime).getTime();
          const e = o.endTime ? new Date(o.endTime).getTime() : s + (o.latency ?? 0) * 1000;
          const left = ((s - t0) / span) * 100;
          const width = Math.max(((e - s) / span) * 100, 0.7);
          const latency = fmtLatency(o.latency);
          const cost = fmtCost(o.totalCost);
          return html`
            <div
              class="tl-row ${this.selectedId === o.id ? 'selected' : ''}"
              @click=${() => this._onRowClick(o)}
            >
              <span class="badge ${typeClass(o.type)}">${typeBadge(o.type)}</span>
              <span class="tl-name" title=${o.name ?? ''}>${o.name ?? '—'}</span>
              <span class="tl-track"
                ><span
                  class="tl-bar"
                  style=${`left:${left}%;width:${width}%;background:${HUE[typeClass(o.type)]}`}
                ></span
              ></span>
              <span class="tl-metrics">
                ${this._prefs.showDuration && latency ? html`<span>${latency}</span>` : nothing}
                ${this._prefs.showCostTokens && cost ? html`<span>${cost}</span>` : nothing}
              </span>
            </div>
          `;
        })}
      </div>
    `;
  }

  /**
   * THE GRAPH — the fork's third view: the SAME instrumented hierarchy laid out in
   * layers (depth = y, arrival order = x), pan/zoom by the fork's own transform and
   * bounds. The fork's ELK engine and search dimming are still not transcribed and
   * this comment says so; the layered layout here is ours.
   *
   * WHY THE SVG IS BUILT AS ONE STRING (measured live, 2026-10-13 night — this was
   * the owner's "the graph is not loading"): the first build mapped child templates
   * (html`<g …/>` per node) inside <svg>. Lit parses every child template standalone
   * in the HTML namespace — verified live: every node and edge sat in the DOM with
   * the right text and the svg box had real width/height, and NONE of it painted,
   * because the renderer saw HTMLUnknownElement children (xhtml namespace) and an SVG
   * paints only SVG-namespace children. The markup is therefore generated as one
   * svg-flavored string and inserted with the unsafeSVG directive, which parses it in
   * the svg context — the elements come out SVGGElement/SVGPathElement and they
   * paint. Clicks: there is no per-node template to hang @click on, and a captured
   * pointer retargets clicks to the wrap anyway — the release is hit-tested instead
   * (see _onGraphUp); every node carries its observation id in data-oid. Every name
   * is trace data (user content) and is escaped before it enters the string.
   */
  private _graphView() {
    const { roots, children } = this._hierarchy();
    const NODE_W = 190;
    const NODE_H = 38;
    const GAP_X = 48;
    const GAP_Y = 56;
    const placed: Array<{ o: GovTraceObservation; x: number; y: number }> = [];
    const edges: string[] = [];
    let cursor = 0;
    const place = (o: GovTraceObservation, depth: number, parent?: { x: number; y: number }) => {
      const x = cursor * (NODE_W + GAP_X);
      const y = depth * (NODE_H + GAP_Y);
      cursor += 1;
      placed.push({ o, x, y });
      if (parent) {
        const sx = parent.x + NODE_W / 2;
        const sy = parent.y + NODE_H;
        const dx = x + NODE_W / 2;
        const dy = y;
        const my = (sy + dy) / 2;
        edges.push(
          `<path d="M ${sx} ${sy} L ${sx} ${my} L ${dx} ${my} L ${dx} ${dy}" fill="none" stroke="rgba(156,163,175,0.55)" stroke-width="1.5"></path>`,
        );
      }
      for (const kid of children.get(o.id) ?? []) place(kid, depth + 1, { x, y });
    };
    for (const r of roots) place(r, 0);
    const width = Math.max(cursor * (NODE_W + GAP_X), NODE_W + 20);
    const height = placed.reduce((m, n) => Math.max(m, n.y + NODE_H), NODE_H) + 24;
    const HUE: Record<string, string> = {
      't-gen': 'rgba(196, 181, 253, 0.9)',
      't-span': 'rgba(125, 211, 252, 0.9)',
      't-evt': 'rgba(252, 211, 77, 0.9)',
    };
    const nodes = placed
      .map(({ o, x, y }) => {
        const selected = this.selectedId === o.id;
        const fill = selected ? 'rgba(31,172,194,0.14)' : 'rgba(127,127,127,0.06)';
        const stroke = selected ? '#1FACC2' : 'rgba(156,163,175,0.6)';
        const weight = selected ? 1.6 : 1;
        const label = escXml((o.name ?? '—').slice(0, 24));
        return (
          `<g class="g-node" data-oid="${escXml(o.id)}" transform="translate(${x}, ${y})">` +
          `<rect width="${NODE_W}" height="${NODE_H}" rx="6" fill="${fill}" stroke="${stroke}" stroke-width="${weight}"></rect>` +
          `<rect x="8" y="${NODE_H / 2 - 5}" width="10" height="10" rx="2" fill="${HUE[typeClass(o.type)]}"></rect>` +
          `<text x="26" y="${NODE_H / 2 + 4}" font-size="13" fill="currentColor">${label}</text>` +
          `</g>`
        );
      })
      .join('');
    return html`
      <div
        class="g-wrap ${this._gdrag ? 'dragging' : ''}"
        @pointerdown=${this._onGraphDown}
        @pointermove=${this._onGraphMove}
        @pointerup=${this._onGraphUp}
        @pointercancel=${this._onGraphCancel}
        @wheel=${this._onGraphWheel}
      >
        <span class="g-zoom">
          <button class="tb" title="Zoom in" @click=${() => this._gZoom(1.4)}>+</button>
          <button class="tb" title="Zoom out" @click=${() => this._gZoom(1 / 1.4)}>−</button>
          <button class="tb" title="Fit" @click=${this._gFit}>Fit</button>
        </span>
        <div class="g-world" style=${`transform: translate(${this._gx}px, ${this._gy}px) scale(${this._gk})`}>
          <svg width=${width} height=${height} style="display:block">${unsafeSVG(edges.join('') + nodes)}</svg>
        </div>
      </div>
    `;
  }

  render() {
    if (!this.trace) {
      return html`
        <div class="waiting" role="status">Select a trace row in the room and its tree lands here.</div>
      `;
    }
    if (!Array.isArray(this.observations)) {
      return html`
        <div class="waiting" role="status">
          <span class="spinner" aria-hidden="true"></span>
          Reading ${this.trace.name ?? 'the trace'}…
        </div>
      `;
    }
    const rows = this._rows();
    const prefs: Array<[keyof TraceTree['_prefs'], string]> = [
      ['showComments', 'Show Comments'],
      ['showScores', 'Show Scores'],
      ['showDuration', 'Show Duration'],
      ['showCostTokens', 'Show Cost'],
      ['collapseSystemPrompt', 'Collapse System Prompts'],
    ];
    return html`
      <div class="bar">
        <input
          class="search"
          type="search"
          placeholder="Search"
          .value=${this._query}
          @input=${this._onSearch}
        />
        ${this._query
          ? html`<span class="count">${rows.length} ${rows.length === 1 ? 'match' : 'matches'}</span>`
          : nothing}
        <span class="tools">
          <button class="tb" title=${this._isEverythingCollapsed() ? 'Expand all' : 'Collapse all'} @click=${this._toggleAll}>
            ${this._isEverythingCollapsed() ? 'Expand all' : 'Collapse all'}
          </button>
          <div class="opts-wrap">
            <button
              class="tb ${this._settingsOpen ? 'on' : ''}"
              title="View Options"
              @click=${() => {
                this._settingsOpen = !this._settingsOpen;
                this.requestUpdate();
              }}
            >
              View Options
            </button>
            ${this._settingsOpen
              ? html`<div class="opts">
                  ${prefs.map(
                    ([key, label]) => html`<label class="opt"
                      ><span>${label}</span
                      ><input
                        type="checkbox"
                        .checked=${this._prefs[key]}
                        @change=${(e: Event) => this._setPref(key, (e.target as HTMLInputElement).checked)}
                    /></label>`,
                  )}
                  <label class="opt"
                    ><span>Min Level:</span
                    ><select
                      .value=${this._minLevel}
                      @change=${(e: Event) => {
                        this._minLevel = (e.target as HTMLSelectElement).value as LevelValue;
                        this.requestUpdate();
                      }}
                    >
                      ${LEVELS.map((l) => html`<option value=${l}>${l}</option>`)}
                    </select></label
                  >
                </div>`
              : nothing}
          </div>
          <span class="seg">
            ${(['tree', 'timeline', 'graph'] as ViewMode[]).map(
              (m) => html`<button
                class=${this._mode === m ? 'on' : ''}
                @click=${() => {
                  this._mode = m;
                  this.requestUpdate();
                }}
              >
                ${m === 'tree' ? 'Tree' : m === 'timeline' ? 'Timeline' : 'Graph'}
              </button>`,
            )}
          </span>
        </span>
      </div>
      ${this._visibles().length === 0
        ? html`<div class="empty">
            ${(this.observations ?? []).length === 0
              ? 'This trace has no observations.'
              : 'No observations at this level.'}
          </div>`
        : this._mode === 'tree'
          ? this._treeView(rows)
          : this._mode === 'timeline'
            ? this._timelineView()
            : this._graphView()}
    `;
  }
}

if (!customElements.get('trace-tree')) {
  customElements.define('trace-tree', TraceTree);
}

declare global {
  interface HTMLElementTagNameMap {
    'trace-tree': TraceTree;
  }
}
