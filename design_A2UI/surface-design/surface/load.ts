/**
 * THE SURFACE'S LOAD — the top tab press: resolve the session and the package, and mount once.
 *
 * This file is the plan's `surface/load.ts` (`REFACTOR-PLAN.md`, "The load and the navigation").
 * It owns the four things a press must do, and nothing else:
 *
 *   1. READ THE DOOR. `POST /api/design/console` assembles this room's surface; its answer is an
 *      A2UI envelope (the tree, the data model, and the door's words when it refuses).
 *   2. RESOLVE THE SEAT'S TABLE. The shell's renderer resolves a name through the chosen system's
 *      `registry.json`; that table is this seat's, and it is loaded before anything is built, so a
 *      name is never refused for arriving before its table.
 *   3. TAKE THE CHAT AND THE LEFT APPLICATION OUT OF THE TREE. The seat draws its own chat in the
 *      right column and its own left container; a chat left in the tree draws a second one. The
 *      door's own words for the seat travel back as `chat`, so nothing it declared is lost.
 *   4. MOUNT ONCE. The renderer is created on the first press and kept; the frame it draws is the
 *      same element before and after a rail press, and a new tree is assigned only when the tree
 *      actually changed (`surfaceKey`).
 *
 * NOTHING HERE DRAWS THE ROOM'S CHAT OR ITS COLUMNS. Those are the seat's components, placed by the
 * container; this module hands the container the facts and the drawing surface.
 */
import { getStoredUserId } from '@/services/authService';
import { readA2UIEnvelope, envelopeRefusalError } from '@/shared/a2ui-envelope';
import { loadSystemRegistry } from '@/shared/a2uiRegistries';
import type { SurfaceTree } from './components';

/** One surface tree: the flat component list and the model its props bind against. */
export type Tree = { components: unknown[]; dataModel: Record<string, unknown> };

/** The system whose registry the surface's names resolve through. */
export const SURFACE_SYSTEM = 'surface-design';

/** The drawing surface: the shell's renderer element, used through the properties it publishes. */
export type SurfaceRenderer = HTMLElement & {
  components: unknown[];
  dataModel: Record<string, unknown>;
  system: string;
  updateComplete: Promise<unknown>;
  shadowRoot: ShadowRoot | null;
};

export type SurfaceLeft = {
  leftId?: string;
  components: unknown[];
};

export type SurfaceLoad = {
  /** The console's tree with its chat and its left application removed. */
  tree: Tree;
  /** The props the door declared for the seat — its session, its conversation and its words. */
  chat: Record<string, unknown>;
  /** The console's own left application, ready for the left container. */
  left: SurfaceLeft;
};

/**
 * The door's own seat name is `chat-panel`; the room reads one name for it. The renaming is here,
 * at the boundary, so every reader inside the seat sees the same name.
 */
function asDesignChat(tree: Tree): Tree {
  return {
    ...tree,
    components: (tree.components as unknown[]).map((entry) => {
      const c = entry as Record<string, unknown>;
      return c?.component === 'design-chat-panel' || c?.component === 'chat-panel'
        ? { ...c, component: 'design-chat' }
        : c;
    }),
  };
}

// ── the tree's two extractions, here and not behind another file ─────────────
//
// The door assembles one tree; the surface does not draw all of it. The chat belongs to the seat's
// right column, which the container places, and the left application belongs to the left
// container's own renderer. Both leave the tree here, kept as facts, and the types and helpers
// below are this file's own — a load that imported them from another module would be a load whose
// logic lives elsewhere.

/** Keys that are structure, not props. Everything else is passed through to the element. */
const STRUCTURAL = new Set(['id', 'component', 'children', 'props']);

/** A `{ path }` value is a pointer into the model; a bare string is copy and is never a path. */
function resolveBinding(value: unknown, dataModel: Record<string, unknown>): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const path = (value as { path?: unknown }).path;
  if (typeof path !== 'string') return value;
  let cursor: unknown = dataModel;
  for (const segment of path.split('/').filter(Boolean)) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** The props an entry carries: everything that is not structure, with its bindings resolved. */
function componentProps(
  comp: Record<string, unknown>,
  dataModel: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(comp)) {
    if (STRUCTURAL.has(key)) continue;
    out[key] = resolveBinding(value, dataModel);
  }
  return out;
}

/** Every child reference an entry names, in any of the spec's two forms. */
function refsOf(comp: Record<string, unknown>): string[] {
  const out: string[] = [];
  const children = comp?.children;
  if (!children || typeof children !== 'object') return out;
  for (const value of Object.values(children as Record<string, unknown>)) {
    if (typeof value === 'string') out.push(value);
    else if (Array.isArray(value)) for (const v of value) if (typeof v === 'string') out.push(v);
  }
  return out;
}

/** THE NAMES A SURFACE MAY USE FOR ITS SEAT. One chat, whatever the assembler called it. */
const CHAT_COMPONENTS = new Set([
  'design-chat',
  'chat-panel',
  'console-chat-panel',
  'composer-chat-panel',
]);

/**
 * TAKE THE CHAT OUT OF THE TREE. Every chat entry and every reference to it leaves, and the props
 * the door declared for the seat come back with them: the room reads its session, its conversation
 * and its words from the entry it removed, not from a second copy of them.
 */
export function takeChat(tree: Tree): { tree: Tree; chat: Record<string, unknown> } {
  const chats = tree.components.filter((entry) => {
    const c = entry as Record<string, unknown>;
    return CHAT_COMPONENTS.has(String(c?.component ?? ''));
  }) as Record<string, unknown>[];
  const ids = new Set(chats.map((c) => String(c.id)));
  const chat = chats[0] ? componentProps(chats[0], tree.dataModel) : {};
  if (!ids.size) return { tree, chat };

  const components = tree.components
    .filter((entry) => !ids.has(String((entry as Record<string, unknown>)?.id)))
    .map((entry) => {
      const c = entry as Record<string, unknown>;
      if (c?.children && typeof c.children === 'object' && !Array.isArray(c.children)) {
        const children = { ...(c.children as Record<string, unknown>) };
        let changed = false;
        for (const key of Object.keys(children)) {
          if (ids.has(String(children[key]))) {
            delete children[key];
            changed = true;
          }
        }
        return changed ? { ...c, children } : c;
      }
      return c;
    });
  return { tree: { ...tree, components }, chat };
}

/** Every component reachable from `startId`, copied as they are. */
function reachable(tree: Tree, startId: string): Record<string, unknown>[] {
  const byId = new Map(
    (tree.components as Record<string, unknown>[]).map((c) => [String(c?.id), c]),
  );
  const out: Record<string, unknown>[] = [];
  const seen = new Set<string>();
  const walk = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    const c = byId.get(id);
    if (!c) return;
    out.push(c);
    for (const ref of refsOf(c)) walk(ref);
  };
  walk(startId);
  return out;
}

/**
 * TAKE THE LEFT APPLICATION OUT OF THE TREE. The shell owns the left column, so a surface's left
 * child is content, not structure: it leaves the tree with its own subtree and is handed to the
 * left container as the application to draw there.
 */
export function extractLeft(tree: Tree): {
  leftId?: string;
  components: unknown[];
  rest: Tree;
} {
  const root = tree.components.find(
    (entry) => (entry as Record<string, unknown>)?.id === 'root',
  ) as Record<string, unknown> | undefined;
  const leftId = root?.children
    ? ((root.children as Record<string, unknown>).left as string | undefined)
    : undefined;
  if (!leftId) return { components: [], rest: tree };

  const components = reachable(tree, leftId).filter((c) => c?.component !== 'design-chat');
  const ids = new Set(components.map((c) => String(c.id)));
  const rest: Tree = {
    ...tree,
    components: (tree.components as Record<string, unknown>[])
      .filter((c) => !ids.has(String(c?.id)))
      .map((c) => {
        if (c?.id !== 'root' || !c.children) return c;
        const children = { ...(c.children as Record<string, unknown>) };
        delete children.left;
        return { ...c, children };
      }),
  };
  return { leftId, components, rest };
}

/**
 * READ THE DOOR. A refusal keeps the door's own words and names the address, because a bare "Not
 * Found" reads as the room being broken; the truth is usually the server not carrying this door.
 */
export async function readSurface(): Promise<SurfaceLoad> {  const res = await fetch('/api/design/console', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok) {
    const detail = String(
      (raw as { detail?: unknown; error?: unknown })?.detail
      ?? (raw as { detail?: unknown; error?: unknown })?.error
      ?? '',
    ).trim();
    throw new Error(
      `the design console door (POST /api/design/console) answered ${res.status}`
      + (detail ? ` — ${detail}` : ''),
    );
  }
  const read = readA2UIEnvelope(raw);
  if (read.ok === false) throw envelopeRefusalError(read.refusal);

  const assembled = asDesignChat({
    components: read.reading.components as unknown[],
    dataModel: read.reading.dataModel as Record<string, unknown>,
  });
  /* THE SHELL OWNS THE CHAT AND THE LEFT COLUMN: both leave the tree here, kept as facts. */
  const { tree, chat } = takeChat(assembled);
  const left = extractLeft(tree);
  return {
    tree: left.rest,
    chat,
    left: { leftId: left.leftId, components: left.components },
  };
}

/** THE SEAT'S TABLE, BEFORE THE FIRST DRAW. A failure is the caller's to state; it is not hidden. */
export async function loadSurfaceRegistry(): Promise<void> {
  await loadSystemRegistry(SURFACE_SYSTEM);
}

/**
 * CREATE THE SURFACE'S RENDERER. It is the shell's renderer element — the seat does not own one —
 * told which registry table to resolve the surface's names through.
 */
export function createSurfaceRenderer(tab: string): SurfaceRenderer {
  const renderer = document.createElement('a2ui-renderer') as SurfaceRenderer;
  renderer.setAttribute('data-design-seat-renderer', tab);
  renderer.style.cssText = 'display:block;width:100%;height:100%;min-height:0;';
  renderer.system = SURFACE_SYSTEM;
  return renderer;
}

/**
 * DRAW THE TREE, ONCE PER CHANGE. The key is the identity of what was built; when it is unchanged
 * the drawn frame still stands and no node is rebuilt. When it changed, both channels are assigned
 * together, so the structure and the values it binds are never one frame apart.
 */
export function drawSurface(
  renderer: SurfaceRenderer,
  tree: SurfaceTree,
  drawnKey: string,
): string {
  if (tree.key === drawnKey) return drawnKey;
  renderer.components = tree.components;
  renderer.dataModel = tree.dataModel;
  return tree.key;
}
