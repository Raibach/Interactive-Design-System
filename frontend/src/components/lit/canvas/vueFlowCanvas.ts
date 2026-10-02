/**
 * THE CANVAS, DRAWN BY THEIR LIBRARY.
 *
 * The owner, 2026-09-24: "You have to take each one line by line, make sure the wiring applies to
 * the new code, and replace what you've built — what you've built is not working." The decision he
 * chose: the canvas becomes a Vue Flow host. So this is a Vue Flow host.
 *
 * THE DIVISION OF LABOUR, STATED SO IT CANNOT DRIFT. Vue Flow draws the things a canvas library
 * draws — the module tiles, the dot grid, the transformation pane — and the element stays the
 * contract: one tag, one binding, the same events, and every gesture. THE LIBRARY'S OWN GESTURES
 * ARE ALL SWITCHED OFF (nodesDraggable, panOnDrag, zoomOnScroll, connectOnClick): there is exactly
 * ONE implementation of a drag, a pan, a zoom or a connection, and it lives in the element. This
 * is not a fallback and there is no fallback — the library draws, the element decides. Two
 * implementations of one gesture is how a canvas panes in one test environment and not another.
 *
 * THE NODE CHROME LIVES IN THE VUE MODULE. The module component renders the same class structure
 * the element's stylesheet already styles (.node/.tile/.glyph/.label/.sub/.badge/.mark/.port/.tb),
 * so there is one stylesheet and one look. The element reads the module's DOM through event
 * delegation on its own canvas surface — data-node-id, data-port, data-action — and runs its own
 * tested gesture state machines. A button the element cannot reach is a dead control; this module
 * carries exactly what the element reads.
 *
 * THE VIEWPORT IS THE ELEMENT'S, PUSHED HERE. The element owns zoom/pan state (its own contract,
 * asserted by tests and saved by the host); every change is pushed down as setViewport, so the
 * pane's transform and the element's edge layer move as one. Vue Flow is never asked to decide
 * where the view is.
 *
 * The library is @vue-flow/core 1.48.2 — the version n8n's canvas is built on, measured from
 * packages/frontend/editor-ui/package.json in the reference source. `proOptions` and the `__vf`
 * root property some tutorials mention DO NOT EXIST in 1.48.2, and code that reaches for them is
 * dead on arrival; neither appears here.
 */
import { createApp, defineComponent, h, markRaw, onMounted, onUpdated, ref as vueRef, type App } from 'vue';
import {
  VueFlow,
  useVueFlow,
  type Node as VFNode,
  type NodeProps,
  type ViewportTransform,
} from '@vue-flow/core';
import { Background } from '@vue-flow/background';
import type { FlowNode } from '@/shared/agentFlow';

const FAMILY_CLASS: Record<string, string> = { note: 'f-note', seat: 'f-seat', step: 'f-step' };

/** The three glyphs the element always drew — the artwork is ours, the frame is theirs. */
const GLYPH: Record<string, string> = {
  note: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M8 10h8M8 14h8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  seat: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  step: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10 8.5l5 3.5-5 3.5z" fill="currentColor"/></svg>',
};

const SIDES = ['left', 'right', 'top', 'bottom'] as const;

/** The mark that says what a node's news is. Idle draws NOTHING — a mark is a claim. */
const markOf = (n: FlowNode) => {
  if (n.state === 'active') return h('span', { class: 'mark active', title: 'in flight', 'aria-hidden': 'true' });
  if (n.state === 'done') return h('span', { class: 'mark done', title: 'done', 'aria-hidden': 'true' }, '✓');
  if (n.state === 'failed') return h('span', { class: 'mark failed', title: 'failed', 'aria-hidden': 'true' }, '⚠');
  return null;
};

/**
 * THE TOOLBAR THE SELECTED NODE WEARS — the same seven controls the element always offered, each
 * carrying a data-action the element's delegated click handler reads. Two of the seven are not
 * actions (the lightning opens the trigger menu, the crosshair moves the view), and they carry no
 * flow-action for the same reason a dead control is never excused: a control that fires an action
 * nobody answers looks wired and is not.
 */
const TOOLBAR = (n: FlowNode) => {
  const runnable = n.family === 'step';
  return h(
    'div',
    {
      class: 'tb',
      // A press in the toolbar is not a press on the node: no select, no drag.
      onPointerdown: (e: Event) => e.stopPropagation(),
    },
    [
      h('button', {
        class: 'tb-btn', type: 'button', 'data-action': 'run',
        disabled: !runnable,
        'aria-label': 'Run this step',
        title: runnable ? 'Run this step' : 'Only a step can be run',
      }, '▶'),
      h('button', {
        class: 'tb-btn', type: 'button', 'data-action': 'toggle',
        'aria-pressed': String(n.state === 'failed'),
        'aria-label': 'Enable or disable this step', title: 'Enable or disable',
      }, '⏻'),
      h('button', {
        class: 'tb-btn', type: 'button', 'data-action': 'trigger-menu',
        disabled: n.family !== 'seat',
        'aria-label': 'What starts this', title: 'What starts this',
      }, '⚡'),
      h('button', {
        class: 'tb-btn', type: 'button', 'data-action': 'delete',
        'aria-label': 'Delete this node', title: 'Delete',
      }, '🗑'),
      h('button', {
        class: 'tb-btn', type: 'button', 'data-action': 'focus',
        'aria-label': 'Bring this module into view', title: 'Bring into view',
      }, '⌖'),
      h('button', {
        class: 'tb-btn', type: 'button', 'data-action': 'ask',
        'aria-label': 'Ask Grace about this', title: 'Ask Grace about this',
      }, '✨'),
      h('button', {
        class: 'tb-btn', type: 'button', 'data-action': 'more',
        'aria-haspopup': 'menu', 'aria-label': 'More', title: 'More',
      }, '⋯'),
    ],
  );
};

/**
 * ONE MODULE, DRAWN THE WAY THEIRS IS: a 96px square with the glyph and the label INSIDE it, so a
 * row step is their 96 instead of the 160 the label-below layout needed. The trigger keeps its
 * larger box and the 36px lead corner. The class list is the element's own vocabulary — the
 * element's stylesheet styles it, its tests query it, and its delegated gesture handlers hit-test
 * it. The module itself owns no behaviour: it is a drawing, and the element is the decision.
 */
const ModuleNode = (props: NodeProps<{ flow: FlowNode; selected: boolean; locked: boolean }>) => {
  const n = props.data.flow;
  const selected = Boolean(props.data.selected);
  /**
   * `locked` IS THE ELEMENT'S RUNNING FLAG, ON THE DATA PATH — the one flag that says a run is in
   * flight, so this module draws the tile as a picture of it: a locked tile carries NO ports and NO
   * toolbar. The element enforces the same flag at its gesture boundary (`_onSurfaceClick`,
   * `_onPortDown`); this is the drawing half of one fact, never a second decision — a control that
   * is refused but still drawn is the dead control this canvas refuses to ship.
   */
  const locked = Boolean(props.data.locked);
  const trigger = n.family === 'seat' && n.kind === 'system-role';
  const size = trigger ? 140 : 96;
  return h(
    'div',
    {
      class: [
        'node',
        FAMILY_CLASS[n.family] ?? 'f-seat',
        `s-${n.state}`,
        trigger ? 'hub' : '',
        selected ? 'sel' : '',
      ],
      'data-node-id': n.id,
      style: { width: `${size}px`, height: `${size}px` },
    },
    [
      h('div', { class: 'tile' }, [
        h('span', { class: 'glyph', innerHTML: GLYPH[n.family] ?? GLYPH.seat }),
        h('span', { class: 'label', title: n.title }, n.title),
        markOf(n),
        // A PORT IS A CONTROL, AND A LOCKED TILE OFFERS NONE (see `locked` above).
        ...(locked ? [] : SIDES.map((side) =>
          h('span', {
            class: `port port-${side}`,
            'data-port': side,
            title: side === 'right' ? 'Click to add a module here, or drag a line out of it' : 'Connect here',
            role: 'button',
            'aria-label': 'Port, ' + side,
          }, [h('span', { class: 'port-plus', 'aria-hidden': 'true' }, '+')]))),
      ]),
      n.subtitle ? h('div', { class: 'sub' }, n.subtitle) : null,
      n.badge ? h('div', { class: `badge b-${n.badge}` }, n.badge) : null,
      selected && !locked ? TOOLBAR(n) : null,
    ],
  );
};

/**
 * ONE PLACED COMPONENT — the DRAFT canvas's node, drawn by this module instead of the run's tile.
 *
 * THE COMPONENT IS CREATED HERE, AND VUE IS NOT ASKED TO DIFF IT. A catalog element takes its props
 * as PROPERTIES (an object prop cannot ride an attribute; this app's elements declare their
 * properties), so Vue renders the frame and this mounts the resolved tag into it — created with
 * `document.createElement`, its props assigned one by one. The frame is Vue's; the component is
 * ours; no library ever patches a custom element's internals.
 *
 * A REFUSED NAME DRAWS A SENTENCE. The element resolved the tag before packing the node
 * (`resolveTag` — the one reader of the name→tag mapping); an empty `tag` means the catalogue does
 * not know the name, and the node says so BY NAME. Never a blank frame, never a substitute.
 */
const CatalogNode = defineComponent({
  name: 'DraftCatalogNode',
  props: { data: { type: Object, required: true } },
  setup(props) {
    const host = vueRef<HTMLElement | null>(null);
    const apply = (): void => {
      const el = host.value;
      if (!el) return;
      const tag = String(props.data.tag || '');
      if (!tag) return;                       // a refusal: the template below draws the sentence
      const current = el.firstElementChild;
      if (!current || current.tagName.toLowerCase() !== tag) {
        el.replaceChildren(document.createElement(tag));
      }
      const node = el.firstElementChild as (HTMLElement & Record<string, unknown>) | null;
      if (!node) return;
      const vars = (props.data.props || {}) as Record<string, unknown>;
      // PROPS AS PROPERTIES, one write per key on every apply: the payload is the model, and this
      // is the moment it lands on the element.
      for (const [k, v] of Object.entries(vars)) node[k] = v;
    };
    onMounted(apply);
    onUpdated(apply);
    return () => h(
      'div',
      {
        class: ['draft-node', props.data.selected ? 'sel' : ''],
        'data-node-id': props.data.id,
        ref: host,
      },
      [
        props.data.refused ? h('div', { class: 'refusal' }, String(props.data.refused)) : null,
      ],
    );
  },
});

/**
 * WHAT AN ELEMENT HANDS THE RENDERER. The module variant spreads a whole `FlowNode` (its tile reads
 * it); the catalog variant carries the resolved `tag` and the payload's `props` instead. One
 * interface, two variants — the packing below is the only place that knows the difference.
 */
export type CanvasNodeInput = {
  id: string;
  x: number;
  y: number;
  selected?: boolean;
  locked?: boolean;
  /** The resolved tag the draft variant mounts; the module variant ignores it. */
  tag?: string;
  props?: Record<string, unknown>;
  /** The name the catalogue refused, drawn as a sentence (the draft variant). */
  refused?: string;
};

export interface VueFlowCanvas {
  /** Redraw every module at the positions given. `nodes` carries x/y resolved by the element,
   *  the selection, and `locked` — the run's own flag, which strips a tile's controls. The
   *  `catalog` variant reads `tag`/`props`/`refused` instead (see CatalogNode). */
  update(nodes: CanvasNodeInput[]): void;
  /** Put the view where the element says it is. `duration` eases the travel (the glide). */
  setViewport(view: ViewportTransform, opts?: { duration?: number }): void;
  /** The dot grid's colour follows the element's theme. */
  setTheme(theme: string): void;
  unmount(): void;
}

const DOT = { '': '#aaa3b5', dark: 'rgba(107, 74, 158, 0.8)' };

export function mountVueFlowCanvas(
  box: HTMLElement,
  opts: { theme?: string; variant?: 'module' | 'catalog' } = {},
): VueFlowCanvas {
  // WHICH DRAWING THIS IS. 'module' is the run canvas (agent-flow); 'catalog' is the draft canvas,
  // whose nodes mount real registered components. The variant picks the node type at mount and is
  // the only thing that differs between the two drawings — the viewport, the theme and the
  // gestures-off rule are the same, because they belong to the ELEMENT, not to the variant.
  const variant = opts.variant ?? 'module';
  let setViewportFn: ((v: ViewportTransform, o?: { duration?: number }) => void) | null = null;
  // The store's setViewport is a no-op until d3 has the pane's dimensions. The element pushes the
  // view on every update, but a push that landed during that window would be dropped — so the last
  // one is kept and applied the moment the pane reports ready. Not a fallback: a queue.
  let lastView: ViewportTransform | null = null;

  const app: App = createApp({
    setup() {
      // `useVueFlow` is VUE Flow's composable, not a React hook. It is named `use…` because
      // Vue's convention reaches for the same word React's does, and the rule reads the name
      // and nothing else. This is a Vue application created with `createApp` inside a Lit
      // element — there is no React component anywhere in this file for the rule to be about.
      // eslint-disable-next-line react-hooks/rules-of-hooks -- Vue composable, not a React hook
      const vf = useVueFlow();
      setViewportFn = (v, o) => {
        lastView = v;
        void vf.setViewport(v, o);
      };
      vf.onPaneReady(() => {
        if (lastView) void vf.setViewport(lastView);
      });
      return {};
    },
    data() {
      return { nodes: [] as VFNode[], dot: DOT[opts.theme ?? ''] ?? DOT[''] };
    },
    render() {
      return h(
        VueFlow,
        {
          nodes: this.nodes,
          edges: [],
          nodeTypes: { [variant]: markRaw(variant === 'catalog' ? CatalogNode : ModuleNode) },
          minZoom: 0.25,
          maxZoom: 2,
          // The element is the gesture: every library gesture is off. See the file note.
          nodesDraggable: false,
          panOnDrag: false,
          zoomOnScroll: false,
          connectOnClick: false,
          applyDefault: false,
        },
        { default: () => h(Background, { gap: 16, size: 1.5, patternColor: this.dot }) },
      );
    },
  });

  const vm = app.mount(box) as unknown as { nodes: VFNode[]; dot: string };

  return {
    update(nodes) {
      // THE HANDOVER IS A VALUE, NOT A QUEUE. The assignment is reactive, and Vue flushes it in
      // its own tick — which is fine, because the element's updateComplete resolves after its own
      // cycle and Vue's flush was queued inside it: a read that follows an awaited update sees
      // the drawing that update produced. This build of Vue (3.5.43) ships no flushSync, and a
      // custom flush loop of our own would be a second scheduler — the one thing this file exists
      // to avoid.
      vm.nodes = nodes.map((n) => ({
        id: n.id,
        type: variant,
        position: { x: n.x, y: n.y },
        // EVERY FLAG A NODE TYPE READS IS PACKED HERE — this object is the module's whole input, so a
        // field left out of it is a field the drawing never sees. `locked` was exactly that on the
        // first pass: the element set it and the module read `undefined`, so the ports stayed drawn
        // through a run (measured, 2026-10-02: 28 ports visible while `running` was true). The
        // catalog variant's fields (`tag`, `props`, `refused`) sit beside them for the same reason.
        data: variant === 'catalog'
          ? { id: n.id, tag: n.tag, props: n.props, refused: n.refused, selected: Boolean(n.selected) }
          : { flow: n as unknown as FlowNode, selected: n.selected, locked: n.locked },
      }));
    },
    setViewport(view, opts) {
      setViewportFn?.(view, opts);
    },
    setTheme(theme) {
      vm.dot = DOT[theme] ?? DOT[''];
    },
    unmount() {
      app.unmount();
    },
  };
}
