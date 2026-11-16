/**
 * THE SURFACE'S DATA — `/surface/*`, the values the surface is drawn with.
 *
 * The A2UI rule this file enforces: structure is the component tree, content is the data model,
 * and a press writes data. The surface's tree is built once (see `components.ts`); a rail press
 * changes WHICH item stands, WHICH conversation the right column reads, and the state of the
 * columns — it never rebuilds the frame. The values live under one root, `/surface`, and every
 * write below goes through a path in that root, so the tree and the data cannot disagree about
 * where a fact is.
 *
 * NOTHING IS INVENTED HERE. The shape is the plan's: the active item, the package, the session,
 * the rail's state and the boxes' heights (`REFACTOR-PLAN.md`, "What `loads the surface` means").
 * The shell's existing reads keep their keys for now — `chat`, `session`, `cards`, `console` —
 * because the console door owns them and the seat only reads them.
 */

/** One key per fact, so a write names a path rather than a nested object. */
export const SURFACE_PATHS = {
  tab: '/surface/tab',
  packageId: '/surface/package_id',
  sessionId: '/surface/session_id',
  conversationId: '/surface/conversation_id',
  /** THE APPROVE TAB'S TURNS, stated by the surface so its seat can be a pure renderer. */
  turns: '/surface/turns',
  railCollapsed: '/surface/rail/collapsed',
  thirdOpen: '/surface/third_open',
  heights: '/surface/heights',
} as const;

/** The surface's own state — the part of the model this seat writes. */
export type SurfaceState = {
  /** The standing rail item: `chat`, `tools`, `approvals`, `ux`, `executions`, `settings`. */
  tab: string;
  /** The package the standing tab works in. Empty means the tab has not stated one yet. */
  packageId: string;
  /** The session the package is in, when the tab has one. */
  sessionId: string;
  /** The conversation the right column shows. */
  conversationId: string;
  /**
   * THE TURNS THE RIGHT COLUMN DRAWS, when a tab's seat is a pure renderer.
   *
   * The Approve tab's seat owns no conversation state (owner's ruling, 2026-11-16): it draws what
   * the surface hands it at `/surface/turns`. The surface hydrates this from the tab's own
   * conversation before the seat draws, so the thread and the record cannot disagree.
   */
  turns: Array<{ role?: string; content?: string }>;
  /** The rail's own state: the column folded to its marks. */
  railCollapsed: boolean;
  /** The right column stands open. The frame draws its rail when this is false. */
  thirdOpen: boolean;
  /** The five boxes' heights, by box name, as the person dragged them. */
  heights: Record<string, number>;
};

const EMPTY_SURFACE: SurfaceState = {
  tab: '',
  packageId: '',
  sessionId: '',
  conversationId: '',
  turns: [],
  railCollapsed: false,
  thirdOpen: true,
  heights: {},
};

/** The surface block of a model, with every fact present — an absent block reads as the empty state. */
export function readSurface(model: Record<string, unknown> | null | undefined): SurfaceState {
  const raw = (model ?? {})['surface'];
  const block = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
  const rail = block.rail && typeof block.rail === 'object' && !Array.isArray(block.rail)
    ? (block.rail as Record<string, unknown>)
    : {};
  const heights = block.heights && typeof block.heights === 'object' && !Array.isArray(block.heights)
    ? (block.heights as Record<string, number>)
    : {};
  const turns = Array.isArray(block.turns)
    ? (block.turns as Array<{ role?: string; content?: string }>)
    : [];
  const text = (value: unknown): string => (typeof value === 'string' ? value : '');
  return {
    tab: text(block.tab) || EMPTY_SURFACE.tab,
    packageId: text(block.package_id) || EMPTY_SURFACE.packageId,
    sessionId: text(block.session_id) || EMPTY_SURFACE.sessionId,
    conversationId: text(block.conversation_id) || EMPTY_SURFACE.conversationId,
    turns,
    railCollapsed: block.rail_collapsed === true,
    thirdOpen: block.third_open !== false,
    heights: { ...heights },
  };
}

/**
 * WRITE THE SURFACE'S OWN FACTS. A pure function: the model handed back is a new object and the
 * caller decides when to give it to the renderer. Only `/surface/*` is touched; every other key
 * — the console's `cards`, the `session` block, the package's `console` block — is passed through
 * untouched, because those belong to the door that read them, not to this seat.
 */
export function surfaceDataModel(
  model: Record<string, unknown> | null | undefined,
  patch: Partial<SurfaceState>,
): Record<string, unknown> {
  const base = (model ?? {}) as Record<string, unknown>;
  const current = readSurface(base);
  const next: SurfaceState = { ...current, ...patch };
  const existing = base['surface'];
  const block = existing && typeof existing === 'object' && !Array.isArray(existing)
    ? (existing as Record<string, unknown>)
    : {};
  const existingRail = block['rail'];
  const rail = existingRail && typeof existingRail === 'object' && !Array.isArray(existingRail)
    ? (existingRail as Record<string, unknown>)
    : {};
  const surface: Record<string, unknown> = {
    ...block,
    tab: next.tab,
    package_id: next.packageId,
    session_id: next.sessionId,
    conversation_id: next.conversationId,
    turns: next.turns ?? [],
    rail: { ...rail, collapsed: next.railCollapsed },
    third_open: next.thirdOpen,
    heights: { ...next.heights },
  };
  return { ...base, surface };
}

/** The value at a `/surface/...` path — the read a place uses when it needs one fact only. */
export function surfaceValue(model: Record<string, unknown> | null | undefined, path: string): unknown {
  let cursor: unknown = model ?? {};
  for (const segment of path.split('/').filter(Boolean)) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}
