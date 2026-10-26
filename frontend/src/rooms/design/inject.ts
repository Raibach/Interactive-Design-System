/**
 * inject — REPLACING A COLUMN'S CONTENT INSIDE ONE INTERFACE.
 *
 * Owner, 2026-10-18: *"column content is an injection point. It's an insert… This is an
 * orchestration between that bar down the middle… and the things that happened on the left of it
 * and the things that happened on the right of it and it will not move."*
 *
 * The room owns ONE assembled interface. A tab does not bring a surface; it brings CONTENT, and
 * that content replaces the left column's subtree in the interface's own adjacency list. The root,
 * the chat and the layout are never part of an injection.
 *
 * Both operations are structural and total: `takeChat` removes every chat entry and every
 * reference to it (the room's chat is placed by the room), and `injectLeft` copies the donor's
 * left subtree into the host and points the host's root at it. A reference to something not
 * copied is a silent hole, so the copy follows children references to the end.
 */
import { componentProps } from "@/components/lit/a2ui-renderer";
import type { Content } from "@/rooms/design/tools/content";

export type Tree = { components: any[]; dataModel: Record<string, any> };

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

/** Replace the host's left column with content a module declared (see tools/content.ts). */
export function withContent(host: Tree, content: Content): Tree {
  const root = host.components.find((c) => c?.id === "root") as any;
  const currentLeftId = root?.children?.left as string | undefined;
  const drop = new Set<string>();
  if (currentLeftId) {
    const byId = new Map(host.components.map((c) => [c?.id, c]));
    const walk = (id: string) => {
      if (drop.has(id)) return;
      drop.add(id);
      const c = byId.get(id);
      if (c) for (const ref of refsOf(c)) walk(ref);
    };
    walk(currentLeftId);
  }
  const kept = host.components.filter((c) => !drop.has(c.id));
  const components = kept.map((c) => {
    if (c?.id !== "root" || !c.children) return c;
    const children = { ...c.children, left: content.leftId };
    delete children.right;
    return { ...c, children };
  });
  const hostSession = (host.dataModel as Record<string, any>)?.session ?? {};
  const contentSession = (content.dataModel as Record<string, any>)?.session ?? {};
  return {
    components: [...components, ...content.components],
    dataModel: {
      ...host.dataModel,
      ...content.dataModel,
      session: { ...hostSession, ...contentSession },
      cards: host.dataModel?.cards,
    },
  };
}

/** Remove the donor engine's chat entry and hand back the props it declared. */
export function takeChat(tree: Tree): { tree: Tree; chat: Record<string, unknown> } {
  const chats = tree.components.filter((c) => c?.component === "design-chat");
  const ids = new Set(chats.map((c) => c.id));
  const chat = chats[0] ? (componentProps(chats[0], tree.dataModel) as Record<string, unknown>) : {};
  if (!ids.size) return { tree, chat };

  const components = tree.components
    .filter((c) => !ids.has(c.id))
    .map((c) => {
      if (c?.children && typeof c.children === "object" && !Array.isArray(c.children)) {
        const children = { ...c.children };
        let changed = false;
        for (const key of Object.keys(children)) {
          if (ids.has(children[key])) {
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

/**
 * TAKE THE LEFT APPLICATION OUT OF A SURFACE — its components and the id the root pointed at.
 * The shell owns the left column (a dedicated container), so a surface's left child is content,
 * not structure: it is removed from the tree and handed over as the application to draw there.
 */
export function extractLeft(tree: Tree): { leftId?: string; components: any[]; rest: Tree } {
  const root = tree.components.find((c) => c?.id === "root") as any;
  const leftId = root?.children?.left as string | undefined;
  if (!leftId) return { components: [], rest: tree };
  const components = reachable(tree, leftId).filter((c) => c?.component !== "design-chat");
  const ids = new Set(components.map((c) => c.id));
  const rest: Tree = {
    ...tree,
    components: tree.components
      .filter((c) => !ids.has(c.id))
      .map((c) => {
        if (c?.id !== "root" || !c.children) return c;
        const children = { ...c.children };
        delete children.left;
        return { ...c, children };
      }),
  };
  return { leftId, components, rest };
}

/**
 * Replace the host's LEFT column with the donor's left subtree. The host's root keeps its id, its
 * chat reference (already removed by `takeChat`) and every other child it had.
 */
export function injectLeft(host: Tree, donor: Tree): Tree {
  const donorRoot = donor.components.find((c) => c?.id === "root") as any;
  const donorLeftId = donorRoot?.children?.left as string | undefined;
  if (!donorLeftId) return host;

  const copied = reachable(donor, donorLeftId).filter((c) => c?.component !== "design-chat");
  const copiedIds = new Set(copied.map((c) => c.id));

  const components = [
    ...host.components.filter((c) => !copiedIds.has(c.id)).map((c) => {
      if (c?.id !== "root" || !c.children) return c;
      const children = { ...c.children, left: donorLeftId };
      delete children.right;
      return { ...c, children };
    }),
    ...copied,
  ];

  /* THE DONOR'S DATA, UNDER THE SAME ROOT — the copied components bind their paths against the
     host's model, so the donor's session values have to be there. The host's own keys are kept;
     the donor's session wins where both speak about the same subject, because the content that is
     standing is the donor's. */
  const hostSession = (host.dataModel as Record<string, any>)?.session ?? {};
  const donorSession = (donor.dataModel as Record<string, any>)?.session ?? {};
  const dataModel = {
    ...host.dataModel,
    ...donor.dataModel,
    session: { ...hostSession, ...donorSession },
    cards: host.dataModel?.cards,
  };

  return { components, dataModel };
}

/** The host with the donor's left column removed again (back to its own content). */
export function withoutInjection(host: Tree, injectedLeftId?: string): Tree {
  if (!injectedLeftId) return host;
  const byId = new Map(host.components.map((c) => [c?.id, c]));
  const drop = new Set<string>();
  const walk = (id: string) => {
    if (drop.has(id)) return;
    drop.add(id);
    const c = byId.get(id);
    if (c) for (const ref of refsOf(c)) walk(ref);
  };
  walk(injectedLeftId);
  return {
    ...host,
    components: host.components.filter((c) => !drop.has(c.id)),
  };
}
