/**
 * DesignInterface — THE ROOM'S ONE INTERFACE: A FIXED MIDDLE BAR AND AN INJECTION POINT.
 *
 * Owner, 2026-10-18: *"You need to replace the very column… column content is an injection point.
 * It's an insert… This is an orchestration between that bar down the middle, which holds our
 * vertical menu on chat, and the things that happened on the left of it and the things that
 * happened on the right of it and it will not move."*
 *
 * SO THIS FILE IS THE ORCHESTRATOR:
 *
 *   - IT ASSEMBLES THE INTERFACE ONCE — the console engine's surface is the host: its root layout,
 *     its seats and its data model. It is loaded once and never replaced.
 *   - THE CHAT IS ONE ELEMENT, created here and never re-created. The surface's own chat entry is
 *     taken out of the tree (`takeChat`) and this chat stands in its place, so the rail, the frame,
 *     the buttons and the colours never change. A tab changes what is LOADED INSIDE it.
 *   - A TAB INJECTS CONTENT — the Figma engine is headless; its left subtree is copied into the
 *     host's left column (`injectLeft`) and its conversation/script are loaded into the same chat.
 *
 * Nothing here swaps a surface for another surface. The only thing that changes is the content of
 * the left column and the information bound to the chat.
 */
import { useEffect, useRef, useState } from "react";
import { getStoredUserId } from "@/services/authService";
import { readA2UIEnvelope, envelopeRefusalError } from "@/shared/a2ui-envelope";
import type { DesignChat } from "@/design/design-chat";
import { injectLeft, takeChat, type Tree } from "@/design/inject";
import "@/design/ux/ux-chat";

const DESIGN_ROOM_TABS = "chat,tools,executions,ux,settings";

/**
 * ONE NAME FOR THE CHAT. The engines name their seat differently (`design-chat-panel` in the
 * console's surface, `chat-panel` in the Figma section's); the interface lifts it by one name, so
 * both are read the same way and neither is left in the tree to draw a second chat.
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

export type DesignInterfaceProps = {
  /** The Figma engine's content, reported by the headless seat. */
  injected?: Tree | null;
  /** Is the Tools tab the selected one? Then the Figma content is the injection. */
  injectedActive?: boolean;
  /** The room is told which rail entry is standing, so it can load the matching content. */
  onTab?: (tab: string) => void;
};

export default function DesignInterface({ injected, injectedActive, onTab }: DesignInterfaceProps) {
  const [host, setHost] = useState<Tree | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [railTab, setRailTab] = useState("chat");
  const rendererRef = useRef<any>(null);
  const chatRef = useRef<DesignChat | null>(null);
  const cleanups = useRef<Array<() => void>>([]);

  /* THE UX APPLICATION IS ONE UNIT — a host element created ONCE and shown or hidden as the rail
     moves. It is never re-created, so nothing snaps or pops: the frame keeps its DOM, its iframe
     and its scroll position across tab switches. */
  const uxHostRef = useRef<HTMLDivElement | null>(null);

  const setUxVisible = (visible: boolean) => {
    const layout = rendererRef.current?.shadowRoot?.querySelector("workspace-layout") as HTMLElement | null;
    if (!layout) return;
    let host = uxHostRef.current;
    if (!host) {
      host = document.createElement("div");
      host.setAttribute("slot", "left");
      host.setAttribute("data-ux-tool-host", "");
      host.style.cssText = "display:block;height:100%;min-height:0;width:100%;";
      const frame = document.createElement("ux-app-frame");
      frame.style.cssText = "display:block;height:100%;width:100%;min-height:0;";
      host.appendChild(frame);
      uxHostRef.current = host;
    }
    if (host.parentElement !== layout) layout.appendChild(host);
    host.style.display = visible ? "block" : "none";
    /* AND THE LEFT COLUMN'S OWN CONTENT STEPS ASIDE WHILE UX IS OPEN — hidden, not removed, so
       the injected content keeps what it holds. */
    for (const native of Array.from(layout.querySelectorAll(':scope > [slot="left"]:not([data-ux-tool-host])'))) {
      (native as HTMLElement).style.display = visible ? "none" : "";
    }
    if (visible) {
      void fetch("/api/ux/posthog-login", { method: "POST" })
        .then(async (r) => {
          if (!r.ok) console.warn("[ux] the framed application could not be signed in:", r.status, await r.text());
        })
        .catch((err) => console.warn("[ux] the sign-in call failed:", err));
    }
  };

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
          setHost(asDesignChat({
            components: read.reading.components as any[],
            dataModel: read.reading.dataModel as Record<string, any>,
          }));
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * THE CHAT IS CREATED ONCE, OUTSIDE THE TREE, AND STAYS. It is placed into the layout's right
   * slot after each draw and its binding is loaded per tab; the element itself is never replaced.
   */
  useEffect(() => {
    const el = document.createElement("design-chat") as DesignChat;
    el.setAttribute("data-design-chat", "interface");
    /* THE UX CHAT IS ITS OWN VIEW: mounted into the seat's view slot, it draws only while the
       UX tab is active (the seat's own .view-slot.tab-ux pair). */
    const uxChat = document.createElement("ux-chat");
    uxChat.setAttribute("slot", "view");
    uxChat.setAttribute("view-tab", "ux");
    el.appendChild(uxChat);
    el.collapsed = false;
    chatRef.current = el;
    const onTabChange = (event: Event) => {
      const tab = String((event as CustomEvent<{ tab?: string }>).detail?.tab || "");
      if (!tab) return;
      setRailTab(tab);
      onTab?.(tab);
    };
    el.addEventListener("tab-change", onTabChange);
    return () => {
      el.removeEventListener("tab-change", onTabChange);
      el.remove();
      chatRef.current = null;
      for (const off of cleanups.current) off();
      cleanups.current = [];
    };
  }, [onTab]);

  /* THE DRAW — host, an optional left injection, and the chat the surface declared. */
  useEffect(() => {
    const renderer = rendererRef.current;
    const chatEl = chatRef.current;
    if (!renderer || !chatEl || !host) return;
    const hostTree = asDesignChat(host);
    /* THE DONOR'S OWN CHAT ENTRY — read from the donor before its left subtree is copied, because
       the chat is not part of that subtree. This is the information the same chat loads when that
       tab is standing: its conversation, its session, its script. */
    const donorChat = injected ? takeChat(asDesignChat(injected)).chat : {};
    const active = injectedActive && injected
      ? injectLeft(takeChat(hostTree).tree, asDesignChat(injected))
      : hostTree;
    const { tree, chat } = takeChat(active);
    const activeChat = injectedActive && injected ? donorChat : chat;

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
        console.warn("[design] the interface's layout never appeared; the chat was not placed.");
        return;
      }

      /* THE CHAT GOES INTO THE RIGHT SLOT — the element itself, never a copy. */
      chatEl.setAttribute("slot", "right");
      if (chatEl.parentElement !== layout) layout.appendChild(chatEl);

      /*
       * AND ITS CONTENT IS LOADED — this tab's conversation, session, script, rail and conversation
       * list, every prop the engine declared.
       *
       * THE THREAD IS CLEARED WHEN THE CONVERSATION CHANGES, and that is not politeness:
       * `design-chat.ts`'s `_loadHistory` returns early while `messages` is non-empty
       * (`if (this.messages?.length …) return`), so a switch that only wrote the new id left the
       * PREVIOUS tab's thread on screen — Chat showing the Tools conversation. Clearing first is
       * what makes the panel read the conversation this tab actually owns.
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
      chatEl.activeTab = injectedActive ? "tools" : "chat";
      chatEl.collapsed = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [host, injected, injectedActive]);

  /* THE UX HOST FOLLOWS THE RAIL — shown on the UX entry, hidden on every other. Re-applied after
     each draw so a re-rendered layout gets the same host back; the host itself never changes. */
  useEffect(() => {
    if (!host) return;
    setUxVisible(railTab === "ux");
  }, [railTab, host, injected, injectedActive]);

  if (error) {
    return <div style={{ padding: 24, color: "#f3b" }}>The design interface could not load: {error}</div>;
  }

  return <design-renderer ref={rendererRef} />;
}
