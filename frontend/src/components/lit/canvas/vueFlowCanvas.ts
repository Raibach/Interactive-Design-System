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
import { createApp, h, markRaw, type App } from 'vue';
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
const ModuleNode = (props: NodeProps<{ flow: FlowNode; selected: boolean }>) => {
  const n = props.data.flow;
  const selected = Boolean(props.data.selected);
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
        ...SIDES.map((side) =>
          h('span', {
            class: `port port-${side}`,
            'data-port': side,
            title: side === 'right' ? 'Click to add a module here, or drag a line out of it' : 'Connect here',
            role: 'button',
            'aria-label': 'Port, ' + side,
          }, [h('span', { class: 'port-plus', 'aria-hidden': 'true' }, '+')])),
      ]),
      n.subtitle ? h('div', { class: 'sub' }, n.subtitle) : null,
      n.badge ? h('div', { class: `badge b-${n.badge}` }, n.badge) : null,
      selected ? TOOLBAR(n) : null,
    ],
  );
};

export interface VueFlowCanvas {
  /** Redraw every module at the positions given. `nodes` carries x/y resolved by the element. */
  update(nodes: Array<FlowNode & { selected: boolean }>): void;
  /** Put the view where the element says it is. `duration` eases the travel (the glide). */
  setViewport(view: ViewportTransform, opts?: { duration?: number }): void;
  /** The dot grid's colour follows the element's theme. */
  setTheme(theme: string): void;
  unmount(): void;
}

const DOT = { '': '#aaa3b5', dark: 'rgba(107, 74, 158, 0.8)' };

export function mountVueFlowCanvas(box: HTMLElement, opts: { theme?: string } = {}): VueFlowCanvas {
  let setViewportFn: ((v: ViewportTransform, o?: { duration?: number }) => void) | null = null;
  // The store's setViewport is a no-op until d3 has the pane's dimensions. The element pushes the
  // view on every update, but a push that landed during that window would be dropped — so the last
  // one is kept and applied the moment the pane reports ready. Not a fallback: a queue.
  let lastView: ViewportTransform | null = null;

  const app: App = createApp({
    setup() {
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
          nodeTypes: { module: markRaw(ModuleNode) },
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
        type: 'module',
        position: { x: n.x, y: n.y },
        data: { flow: n, selected: n.selected },
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
