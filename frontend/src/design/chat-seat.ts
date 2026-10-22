/**
 * chat-seat — LIFTING THE CHAT OUT OF A SURFACE.
 *
 * The design room owns ONE chat element (`design/design-chat.ts`), created once and moved between
 * seats. A seat's surface still NAMES a chat; this module takes that entry out of the tree the
 * renderer will draw and hands back what it was bound to, so the room's one chat can be bound the
 * same way.
 *
 * NOTHING IS INVENTED. The conversation, session, instructions and rail list are read off the
 * surface's own chat entry — the bindings the model wrote — resolved against the same data model
 * the renderer will use. If the entry is absent, the binding says so by leaving the fields out.
 */
import { componentProps } from "@/components/lit/a2ui-renderer";

/**
 * What one engine hands the room's chat: the tab it stands for, and EVERY prop the surface's own
 * chat entry declared — conversation, session, script, rail list, `graceLiveContext`, `tracePrompt`
 * and anything else the seat reads. Copying a hand-picked few is how a seat came to refuse a turn
 * for a prop that was never carried.
 */
export type SeatChatBinding = { tab: string } & Record<string, unknown>;

type Tree = { components: any[]; dataModel: Record<string, any> };

/**
 * Remove every chat component from the tree (and every reference to it) and return the binding
 * that component carried. A surface with no chat entry is left exactly as it is.
 */
export function liftChat(tree: Tree, tab: string): { tree: Tree; binding: SeatChatBinding } {
  const chats = tree.components.filter((c) => c?.component === "design-chat");
  const ids = new Set(chats.map((c) => c.id));

  let binding: SeatChatBinding = { tab };
  const chat = chats[0];
  if (chat) {
    // EVERY PROP THE SURFACE DECLARED, resolved against the same data model the renderer uses.
    // The room's chat is this engine's chat; nothing it reads is left behind.
    binding = { ...componentProps(chat, tree.dataModel ?? {}), tab };
  }

  if (!ids.size) return { tree, binding };

  const components = tree.components
    .filter((c) => !ids.has(c.id))
    .map((c) => {
      // A LAYOUT THAT REFERENCED THE CHAT LOSES THE REFERENCE — an entry point at a component that
      // no longer exists draws nothing, and the room puts the chat back into the slot itself.
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

  return { tree: { ...tree, components }, binding };
}
