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
 *   - and its chat's information — conversation, session, script, rail — which the SHELL's one
 *     chat loads. Nothing of the Figma surface's chat is drawn; there is no second chat.
 *
 * Its `workspace-layout`, its chat column and its own right side are discarded here, deliberately:
 * the shell already owns a layout and a chat, and a second one is exactly what made the room jerk.
 */
import { componentProps } from "@/components/lit/a2ui-renderer";

export type Tree = { components: any[]; dataModel: Record<string, any> };

export type Content = {
  /** The id the shell's root should point its left slot at. */
  leftId: string;
  /** The left application, every reachable component included. */
  components: any[];
  /** THE RUN'S COLUMN — present only when the engine produced something to draw (Submit). */
  middleId?: string;
  middleComponents?: any[];
  /** The data those components bind against. The shell keeps its own keys and takes these. */
  dataModel: Record<string, any>;
  /** The chat information the shell's one chat loads while this content is standing. */
  chat: Record<string, unknown>;
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

/** The Figma application, as content the shell can inject — or null when the tree names none. */
export function buildContent(tree: Tree): Content | null {
  const root = tree.components.find((c) => c?.id === "root") as any;
  const leftId = root?.children?.left as string | undefined;
  if (!leftId) return null;

  const components = reachable(tree, leftId).filter((c) => c?.component !== "design-chat");
  const middleId = root?.children?.middle as string | undefined;
  const middleComponents = middleId
    ? reachable(tree, middleId).filter((c) => c?.component !== "design-chat")
    : [];
  const chatEntry = tree.components.find((c) => c?.component === "chat-panel" || c?.component === "design-chat");
  const chat = chatEntry
    ? (componentProps(chatEntry, tree.dataModel as Record<string, unknown>) as Record<string, unknown>)
    : {};

  const session = (tree.dataModel as Record<string, any>)?.session ?? {};
  return {
    leftId,
    components,
    middleId,
    middleComponents,
    /* THE APPLICATION'S DATA, AS THE APPLICATION DECLARED IT. The shell merges this under its own
       model so the injected components resolve their paths; it is not the shell's job to know
       which keys the Figma application uses. */
    dataModel: { session, ...(tree.dataModel as Record<string, any>) },
    chat,
  };
}
