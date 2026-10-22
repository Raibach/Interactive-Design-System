/**
 * SeatShell — THE FILE THAT HOUSES THE CHAT AND THE INSERT SLOTS.
 *
 * Owner, 2026-10-18: *"you may need to build a separate file. It just houses that chat, those
 * insert slots, then it loads / imports that content directly in there when you click on one of
 * those tabs… so that the user never knows it's coming from the engine."*
 *
 * WHAT LIVES HERE:
 *
 *   - THE CHAT. One element, created once with the room. It is placed into the layout's right slot
 *     and never re-created; a tab changes only what is LOADED INSIDE it — conversation, session,
 *     script, rail. Its frame, styling, buttons and colours are identical on every tab.
 *   - THE LEFT SLOT. An insert point: a tab's content module supplies a tree, and its left subtree
 *     is copied into the interface's own adjacency list (`design/inject.ts`).
 *   - THE MIDDLE SLOT. The run's. It opens when an engine produces something to draw.
 *   - THE UX HOST. The application is one element created once, shown on the UX entry and hidden
 *     on every other — hidden, never removed, so nothing snaps, pops or reloads.
 *   - THE REGISTRY, `SEAT_MODULES`, naming the module each rail tab loads.
 *
 * WHAT THIS FILE NEVER DOES: swap a surface for another surface, draw a second chat, or move the
 * frame. The user must not be able to tell which engine supplied the content.
 */
import { useEffect, useRef, useState } from "react";
import { getStoredUserId } from "@/services/authService";
import { readA2UIEnvelope, envelopeRefusalError } from "@/shared/a2ui-envelope";
import type { DesignChat } from "@/design/design-chat";
import { extractLeft, takeChat, withContent, type Tree } from "@/design/inject";
import type { Content } from "@/design/tools/content";
import "@/design/ux/ux-chat";

export const DESIGN_ROOM_TABS = "chat,tools,executions,ux,settings";

/**
 * THE REGISTRY — data, not code paths. Adding a tab means adding an entry and its module; the
 * shell never learns a tab's name. `tools` is supplied by the headless Figma engine; `ux` is the
 * next module — its application and its chat inserted into this same shell.
 */
export const SEAT_MODULES = {
  chat: { title: "Chat", module: null },
  tools: { title: "Tools", module: "tools" },
  ux: { title: "UX", module: "ux" },
  trace: { title: "Trace", module: null },
  eval: { title: "Evals", module: null },
  repair: { title: "Repairs", module: null },
  settings: { title: "Settings", module: null },
} as const;

export type SeatTab = keyof typeof SEAT_MODULES;

/** Does this tab have content of its own yet? Said plainly where it is asked. */
export function seatHasModule(tab: string): boolean {
  const entry = (SEAT_MODULES as Record<string, { module: string | null }>)[tab];
  return Boolean(entry?.module);
}

/**
 * ONE NAME FOR THE CHAT. The engines name their seat differently (`design-chat-panel` in the
 * console's surface, `chat-panel` in the Figma section's); the shell lifts it by one name, so both
 * are read the same way and neither is left in the tree to draw a second chat.
 */
function asDesignChat(tree: Tree): Tree {
  return {
    ...tree,
    components: (tree.components as any[]).map((c) =>
      c?.component === "design-chat-panel" || c?.component === "chat-panel"
        ? { ...c, component: "design-chat" }
        : c,
    ),
  };
}

export type SeatShellProps = {
  /** The Figma module's declared content, reported by the headless engine. */
  injected?: Content | null;
  /** Is the Tools tab the selected one? Then the Figma content is the injection. */
  injectedActive?: boolean;
  /** The room is told which rail entry is standing. */
  onTab?: (tab: string) => void;
};

export default function SeatShell({ injected, injectedActive, onTab }: SeatShellProps) {
  const [host, setHost] = useState<Tree | null>(null);
  /* THE CONSOLE APPLICATION — its left content, taken out of the host surface because the shell
     owns the left column now (a dedicated container), never a hidden sibling. */
  const [hostLeft, setHostLeft] = useState<{ leftId?: string; components: any[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [railTab, setRailTab] = useState("chat");
  const rendererRef = useRef<any>(null);
  const chatRef = useRef<DesignChat | null>(null);
  const uxHostRef = useRef<HTMLDivElement | null>(null);
  const uxObserverRef = useRef<MutationObserver | null>(null);
  const busyRef = useRef<HTMLDivElement | null>(null);

  /* THE INTERFACE ONCE. The console engine's own door; its answer is the host tree. */
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/design/console", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-User-ID": getStoredUserId() },
        });
        const raw = await res.json().catch(() => null);
        if (!res.ok) throw new Error(String((raw as any)?.detail ?? `the console answered ${res.status}`));
        const read = readA2UIEnvelope(raw);
        if (read.ok === false) throw envelopeRefusalError(read.refusal);
        if (!cancelled) {
          const tree = asDesignChat({
            components: read.reading.components as any[],
            dataModel: read.reading.dataModel as Record<string, any>,
          });
          const left = extractLeft(tree);
          setHostLeft({ leftId: left.leftId, components: left.components });
          setHost(left.rest);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* THE CHAT IS CREATED ONCE, and only its content changes per tab. */
  useEffect(() => {
    const el = document.createElement("design-chat") as DesignChat;
    el.setAttribute("data-design-chat", "shell");
    /* THE UX CHAT IS ITS OWN VIEW: mounted into the seat's view slot, it draws only while the
       UX tab is active (the seat's own .view-slot.tab-ux pair). */
    const uxChat = document.createElement("ux-chat");
    uxChat.setAttribute("slot", "view");
    uxChat.setAttribute("view-tab", "ux");
    el.appendChild(uxChat);
    el.collapsed = false;
    chatRef.current = el;
    const onTabChange = (event: Event) => {
      const tab = String((event as CustomEvent<{ tab?: string }>)?.detail?.tab || "");
      if (!tab) return;
      setRailTab(tab);
      onTab?.(tab);
    };
    el.addEventListener("tab-change", onTabChange);
    return () => {
      el.removeEventListener("tab-change", onTabChange);
      el.remove();
      chatRef.current = null;
    };
  }, [onTab]);

  /* THE UX APPLICATION IS ONE UNIT — created once, shown or hidden, never re-created. */
  const setUxVisible = (visible: boolean) => {
    const layout = rendererRef.current?.shadowRoot?.querySelector("workspace-layout") as HTMLElement | null;
    if (!layout) return;
    let hostEl = uxHostRef.current;
    if (!hostEl) {
      hostEl = document.createElement("div");
      hostEl.setAttribute("slot", "left");
      hostEl.setAttribute("data-ux-tool-host", "");
      hostEl.style.cssText = "display:block;height:100%;min-height:0;width:100%;";
      const frame = document.createElement("ux-app-frame");
      frame.style.cssText = "display:block;height:100%;width:100%;min-height:0;";
      hostEl.appendChild(frame);
      uxHostRef.current = hostEl;
    }
    /* ONE HOST, NOT A PILE OF THEM: any other host of ours is a leftover and is removed. */
    for (const stale of Array.from(layout.querySelectorAll(":scope > [data-ux-tool-host]"))) {
      if (stale !== hostEl) stale.remove();
    }
    if (hostEl.parentElement !== layout) layout.appendChild(hostEl);
    hostEl.style.display = visible ? "block" : "none";

    /*
     * THE LEFT COLUMN'S OWN CONTENT STEPS ASIDE WHILE UX IS OPEN — hidden, not removed, so the
     * injected content keeps what it holds. THE OBSERVER IS THE POINT: the renderer attaches the
     * cards AFTER this function runs, so a one-shot hide left them showing under the application
     * (measured 2026-10-18: the grid stayed `display: grid` with the UX host on top of it).
     */
    const hideNatives = () => {
      for (const el of Array.from(layout.querySelectorAll(':scope > [slot="left"]'))) {
        if (el === hostEl) continue;
        (el as HTMLElement).style.display = visible ? "none" : "";
      }
    };
    hideNatives();
    uxObserverRef.current?.disconnect();
    uxObserverRef.current = null;
    if (visible) {
      const observer = new MutationObserver(hideNatives);
      observer.observe(layout, { childList: true });
      uxObserverRef.current = observer;
      void fetch("/api/ux/posthog-login", { method: "POST" })
        .then(async (r) => {
          if (!r.ok) console.warn("[ux] the framed application could not be signed in:", r.status, await r.text());
        })
        .catch((err) => console.warn("[ux] the sign-in call failed:", err));
    }
  };

  /* THE LEFT SLOT'S LOADER — the chat never waits and the column never draws half a state. While a
     tab's content is on its way (the Figma engine still assembling), the slot shows a spinner; the
     moment the content lands it is replaced. One element, shown and hidden, never re-created. */
  const setLeftBusy = (visible: boolean) => {
    const layout = rendererRef.current?.shadowRoot?.querySelector("workspace-layout") as HTMLElement | null;
    if (!layout) return;
    let busy = busyRef.current;
    if (!busy) {
      busy = document.createElement("div");
      busy.setAttribute("slot", "left");
      busy.setAttribute("data-seat-loading", "");
      busy.style.cssText =
        "display:flex;align-items:center;justify-content:center;height:100%;width:100%;color:#c9c9c9;font:500 13px ui-sans-serif,system-ui,sans-serif;";
      busy.innerHTML =
        '<div style="display:flex;align-items:center;gap:10px;">' +
        '<span style="width:16px;height:16px;border-radius:50%;border:2px solid rgba(240,179,35,0.25);border-top-color:rgb(240,179,35);display:inline-block;animation:seat-spin 0.8s linear infinite;"></span>' +
        '<span>Loading…</span></div>' +
        '<style>@keyframes seat-spin{to{transform:rotate(360deg)}}</style>';
      busyRef.current = busy;
    }
    if (layout.querySelector(":scope > [data-seat-loading]") !== busy) layout.appendChild(busy);
    busy.style.display = visible ? "flex" : "none";
    for (const native of Array.from(layout.querySelectorAll(':scope > [slot="left"]:not([data-seat-loading]):not([data-ux-tool-host])'))) {
      (native as HTMLElement).style.display = visible ? "none" : "";
    }
  };

  /* THE DRAW — host, an optional left injection, and the chat the surface declared. */
  useEffect(() => {
    const renderer = rendererRef.current;
    const chatEl = chatRef.current;
    if (!renderer || !chatEl || !host) return;
    /* THE CONTENT BOUNDARY: the Figma module declares its left application and its chat; the
       shell injects that content and loads that information into its ONE chat. No surface of the
       Figma engine is drawn, and no second chat exists. */
    const active = injectedActive && injected
      ? withContent(takeChat(host).tree, injected)
      : host;
    const { tree, chat } = takeChat(active);
    /* THE TAB'S OWN ROOM. `console.tab_conversations` names the conversation rows the backend
       prepared per tab (chat, tools, ux), so the chat loads that room even when a tab injects no
       tree of its own — UX has an application, not a surface. Tools' binding comes from its own
       module, because its script belongs to the design system. */
    const rooms = ((host.dataModel as Record<string, any>)?.console?.tab_conversations ?? {}) as Record<string, string>;
    const roomConversation = rooms[railTab];
    const activeChat = injectedActive && injected
      ? injected.chat
      : roomConversation
        ? { ...chat, conversationId: roomConversation }
        : chat;

    let cancelled = false;
    void (async () => {
      renderer.components = (tree.components as any[]).map((c) =>
        c?.id === "root" ? { ...c, isThirdOpen: true } : c,
      );
      renderer.dataModel = tree.dataModel;
      try {
        await renderer.updateComplete;
      } catch {
        // Lit's updateComplete does not reject; if it ever does, the queries below still run.
      }
      if (cancelled) return;

      let layout: HTMLElement | null = null;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        layout = (renderer.shadowRoot?.querySelector("workspace-layout") as HTMLElement | null) ?? null;
        if (layout) break;
        await new Promise((r) => setTimeout(r, 250));
        if (cancelled) return;
      }
      if (!layout) {
        console.warn("[design] the shell's layout never appeared; the chat was not placed.");
        return;
      }

      /* THE CHAT GOES INTO THE RIGHT SLOT — the element itself, never a copy. */
      chatEl.setAttribute("slot", "right");
      if (chatEl.parentElement !== layout) layout.appendChild(chatEl);

      /*
       * AND ITS CONTENT IS LOADED — this tab's conversation, session, script, rail and conversation
       * list, every prop the engine declared. THE THREAD IS CLEARED WHEN THE CONVERSATION CHANGES:
       * `design-chat.ts`'s `_loadHistory` returns early while `messages` is non-empty, so a switch
       * that only wrote the new id left the previous tab's thread on screen.
       */
      const nextConversation = activeChat.conversationId;
      if (typeof nextConversation === "string" && nextConversation !== chatEl.conversationId) {
        chatEl.messages = [];
        (chatEl as unknown as { _local: unknown[] })._local = [];
      }
      for (const [key, value] of Object.entries(activeChat)) {
        if (value === undefined || key === "collapsed") continue;
        (chatEl as unknown as Record<string, unknown>)[key] = value;
      }
      chatEl.activeTab = injectedActive ? "tools" : railTab === "ux" ? "ux" : "chat";
      chatEl.collapsed = false;
      setUxVisible(railTab === "ux");
      setLeftBusy(Boolean(injectedActive && !injected));
    })();

    return () => {
      cancelled = true;
    };
  }, [host, injected, injectedActive, railTab]);

  if (error) {
    return <div style={{ padding: 24, color: "#f3b" }}>The design interface could not load: {error}</div>;
  }

  return <design-renderer ref={rendererRef} />;
}
