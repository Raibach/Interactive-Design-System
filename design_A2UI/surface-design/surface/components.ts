/**
 * THE SURFACE'S TREE — the frame, the containers, the slots and the rail, built from the console's
 * answer.
 *
 * This is the STRUCTURE half of the A2UI rule. It reads the tree the design console's door returns,
 * keeps the frame's own node, and states what the standing tab serves: the console's left
 * application, the Tools tab's middle application and foot, and the right column's five boxes (the
 * rail, the readout, the view, the input and the tray — `SLOT-PLAN.md`). It does not draw; the
 * shell's renderer draws what this file states.
 *
 * THE SEAT'S OWN ELEMENTS ARE REGISTERED HERE. A name in the surface's registry is only true if an
 * element answers it, so this module imports the seat's own component files for their side effect:
 * the frame, the console's card grid, the seat, the left foot. A surface that names a tag nothing
 * registers is a refusal the renderer reports by name, and importing the components here is what
 * keeps that from happening.
 *
 * THE KEY IS THE CHANGE TEST. The tree is rebuilt on every render, so object identity of the built
 * array says nothing; `surfaceKey` gives each SOURCE object (the console's tree, the Tools report)
 * a stable number and combines it with the facts that change the tree. The shell assigns a tree
 * only when the key changed, which is how a rail press moves data without redrawing the frame.
 */
import './frame/workspace';
import '../../chat/left/card-grid';
import './left-container/footer';

import type { Tree } from './load';
import type { Content } from '@design2/tools/content';
import { surfaceDataModel, type SurfaceState } from './data';

/** The frame's slots, as the door names them. The frame draws a slot when the tree fills it. */
export const SURFACE_FRAME_SLOTS = ['left-header', 'left', 'left-footer', 'middle', 'right'] as const;

/** The right column's five boxes. The seat draws them inside its own shadow DOM. */
export const SURFACE_RIGHT_SLOTS = ['rail', 'readout', 'view', 'input', 'tray'] as const;

/** The foot the Tools tab and the UX tab name; it draws the session's Save control. */
export const SURFACE_FOOT_ID = 'left-footer';

export type SurfaceTree = {
  /** The flat component list, exactly the shape the renderer draws. */
  components: unknown[];
  /** The model the props bind against. */
  dataModel: Record<string, unknown>;
  /** The identity of what was built; unchanged means the drawn tree still stands. */
  key: string;
};

export type SurfaceTreeInput = {
  /** The console's tree with its chat and left application already taken out. */
  tree: Tree;
  /** Is the Tools tab standing? Then its report says what the middle column serves. */
  isTools: boolean;
  /** The Tools report, when the Tools tab has one. */
  injected?: Content | null;
  /** The surface's own values — the active item and the rest of `/surface/*`. Not part of the key:
   *  a rail press writes these and leaves the tree standing. */
  surface?: Partial<SurfaceState>;
};

/* A stable number per source object. Weak, so a replaced tree is collectable; small, so a key is
   one short string. The counter never resets, so two different objects can never share a number. */
const sourceIds = new WeakMap<object, number>();
let nextSourceId = 1;
function sourceId(value: object | null | undefined): number {
  if (!value) return 0;
  const seen = sourceIds.get(value);
  if (seen) return seen;
  const id = nextSourceId++;
  sourceIds.set(value, id);
  return id;
}

/** The identity of a surface: the console's tree, the tab, the Tools report and its middle node. */
export function surfaceKey(input: SurfaceTreeInput): string {
  const middle = input.isTools ? String(input.injected?.middleId ?? '') : '';
  return `${sourceId(input.tree)}:${input.isTools ? 'tools' : 'room'}:${sourceId(input.injected as object | null)}:${middle}`;
}

/**
 * BUILD THE SURFACE'S TREE.
 *
 * The root is the door's own frame node and keeps its id; what changes is its children. The room's
 * own tabs are served inside the frame's slots by the seat; the Tools tab is served by its report,
 * so its middle application and its foot are named here, and the console's left grid is removed
 * while no tool has reported (a grid under a tool's tab is another page's content).
 */
export function buildSurfaceTree(input: SurfaceTreeInput): SurfaceTree {
  const { tree, isTools, injected } = input;
  const lockedTools = Boolean(isTools && injected?.locked === true);

  const components: unknown[] = [
    ...(tree.components as unknown[]).map((entry) => {
      const c = entry as Record<string, unknown>;
      if (c?.id !== 'root') return c;
      const children = { ...((c.children as Record<string, unknown> | undefined) ?? {}) };
      if (isTools) {
        /* THE TOOLS PAGE'S OWN COLUMNS, AND NOT THE CONSOLE'S. */
        if (injected?.middleId && !lockedTools) children.middle = injected.middleId;
        else delete children.middle;
        if (injected && !lockedTools) children['left-footer'] = SURFACE_FOOT_ID;
        else delete children['left-footer'];
        if (!injected) delete children.left;
      }
      /* THE THIRD COLUMN STANDS OPEN IN THIS SURFACE. The room's shell sets this on the frame it
         draws; without it the right column is the rail and the seat has no width. */
      return { ...c, children, isThirdOpen: true };
    }),
    ...(isTools && !lockedTools ? (injected?.middleComponents ?? []) : []),
    ...(isTools && injected && !lockedTools
      ? [{
          id: SURFACE_FOOT_ID,
          component: 'design-left-footer',
          busy: { path: '/session/saving' },
          result: { path: '/session/save_result' },
        }]
      : []),
  ];

  /* THE TOOLS DATA, UNDER THE SAME ROOT — the middle column's components bind their paths against
     it. The console's own keys are kept; the tool's session wins where both speak. */
  const dataModel = surfaceDataModel(
    isTools && injected
      ? {
          ...tree.dataModel,
          ...injected.dataModel,
          session: {
            ...((tree.dataModel as Record<string, unknown> | undefined)?.session as object | undefined),
            ...((injected.dataModel as Record<string, unknown> | undefined)?.session as object | undefined),
          },
          cards: (tree.dataModel as Record<string, unknown> | undefined)?.cards,
        }
      : tree.dataModel,
    input.surface ?? {},
  );

  /* THE KEY EXCLUDES `surface` ON PURPOSE. A rail press writes the active item and the tab's
     conversation; the tree is the same tree, so the drawn frame stands and only the data moves. */
  return { components, dataModel, key: surfaceKey(input) };
}
