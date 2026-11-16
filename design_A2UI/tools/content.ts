/**
 * content — THE FIGMA INGESTION APPLICATION'S DECLARED BOUNDARY.
 *
 * Owner, 2026-10-18: *"you know darn well that Figma application is hardwired to whatever chat
 * you're loading with it — you're gonna have to disconnect it from that or rewire it to this chat,
 * so that it seamlessly transitions from chat to tools and back without jerking and snapping and
 * reloading."*
 *
 * SO THIS FILE IS THE DISCONNECT. The Figma assembly returns a whole surface — a root layout, a
 * chat column and the ingest application. The shell does not want a surface; it wants the
 * application. This module takes the assembled tree and states, in one place, what the Figma
 * content IS:
 *
 *   - the components of its LEFT application (the ingest form and the layer tree), copied whole
 *     with every reference they reach;
 *   - the data those components bind against (its session's `ingest`, `elements`, `checks`,
 *     `preview` and the rest);
 *   - and its chat's own entry — the raw component with its `{path}` bindings, so the surface's
 *     tree can bind the Tools chat to the same values the assembly resolved.
 *
 * Its `workspace-layout`, its chat column and its own right side are discarded here, deliberately:
 * the surface's own tree is the one layout, and a second one is exactly what made the room jerk.
 */

export type Tree = { components: any[]; dataModel: Record<string, any> };

export type Content = {
  /** The id the surface's root should point its left slot at. */
  leftId: string;
  /** The left application, every reachable component included. */
  components: any[];
  /** THE RUN'S COLUMN — present only when the engine produced something to draw (Submit). */
  middleId?: string;
  middleComponents?: any[];
  /** The data those components bind against. The surface keeps its own keys and takes these. */
  dataModel: Record<string, any>;
  /** The chat's own entry, raw: its `{path}` props are the bindings the surface's tree reuses. */
  chat: Record<string, unknown>;
  /**
   * THE CARD IS IN A SUPERVISOR QUEUE. The active canvas is suppressed: no ingest form, no
   * preview, no Save control. `ledger` is the read-only status the left column draws instead.
   */
  locked?: boolean;
  ledger?: { state: string; text: string };
};

const refsOf = (c: any): string[] => {
  const out: string[] = [];
  const children = c?.children;
  if (!children || typeof children !== "object") return out;
  for (const value of Object.values(children)) {
    if (typeof value === "string") out.push(value);
    else if (Array.isArray(value)) for (const v of value) if (typeof v === "string") out.push(v);
  }
  return out;
};

/**
 * Everything reachable from `startId` — the ingest form's host panel and all it contains. A
 * reference to something not copied is a silent hole, so the walk follows children to the end.
 */
function reachable(tree: Tree, startId: string): any[] {
  const byId = new Map(tree.components.map((c) => [c?.id, c]));
  const out: any[] = [];
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

/** The Figma application, as content the surface can inject — or null when the tree names none. */
export function buildContent(tree: Tree): Content | null {
  const root = tree.components.find((c) => c?.id === "root") as any;
  const leftId = root?.children?.left as string | undefined;
  if (!leftId) return null;

  const components = reachable(tree, leftId).filter((c) => c?.component !== "design2-chat");
  const middleId = root?.children?.middle as string | undefined;
  const middleComponents = middleId
    ? reachable(tree, middleId).filter((c) => c?.component !== "design2-chat")
    : [];
  /* THE CHAT'S OWN ENTRY, RAW. The surface's tree binds the Tools chat to these same paths;
     resolving them here would make the shell a second binding path, and the values would stop
     following the data model. */
  const chatEntry = tree.components.find(
    (c) => c?.component === "chat-panel" || c?.component === "design2-chat",
  );
  const chat = (chatEntry ?? {}) as Record<string, unknown>;

  const session = (tree.dataModel as Record<string, any>)?.session ?? {};
  /* THE CANVAS ALWAYS STANDS. There is no lock on a card (owner, 2026-11-16): a saved card is
     Pending by default, and pending is a word on its footer, not a refusal. The ingest form, the
     tree, the preview and the Save control are handed over for every card, so pressing a card
     resumes the work it holds. */
  return {
    leftId,
    components,
    middleId,
    middleComponents,
    /* THE APPLICATION'S DATA, AS THE APPLICATION DECLARED IT. The surface merges this under its
       own model so the injected components resolve their paths; it is not the surface's job to
       know which keys the Figma application uses. */
    dataModel: { session, ...(tree.dataModel as Record<string, any>) },
    chat,
  };
}
