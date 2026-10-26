/**
 * DesignSeatShell — THE DESIGN ROOM'S SHELL, ONE CONTAINER PER TAB.
 *
 * Owner, 2026-10-25: *"There's been a misunderstanding … that these chats are global. They're
 * not, they're specific to the tab you're on."* And: *"we need to … just create separate
 * containers and then the data is injected. The only thing that is different is the data."*
 *
 * SO A TAB IS A CONTAINER, NOT A BRANCH INSIDE A SHARED ONE. Each tab gets its own container,
 * built the first time its tab is pressed and kept afterwards:
 *
 *   Chat        → the console's card grid in the left column, the room's own chat;
 *   Tools       → the Figma ingest application, its own chat build, and its own controls (the
 *                 footer plate). Owner: *"a footer for tools in the design tab, that does not
 *                 show on the console"*;
 *   UX          → the analytics program's frame, its own chat build;
 *   Executions  → the console's grid and the chat's own drawing for that tab;
 *   Settings    → the same.
 *
 * THE CONTAINERS ARE INSTANCES OF THE SAME ELEMENT AND DIFFER ONLY BY DATA. Nothing is copied and
 * there is no second frame element. The per-tab chat builds are the room's own files, because
 * THE_SHOJI_ROOMS says the face is shared and the build is not: *"it's not the same component. It
 * just LOOKS like the same component."*
 *
 * A CHAT IS NEVER MOVED BETWEEN CONTAINERS, CLEARED OR RE-POINTED. Each container's chat is
 * created once with the conversation that belongs to its tab — conversations belong to the
 * package AND to one tab (THE_CONVERSATION_CONTRACT §1) — and no id is handed to a tab it does
 * not belong to. Switching tabs shows another container; it never empties this one.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import designSectionBackground from "@/assets/design-section2-bkg.webp";
import "@/rooms/design/ux/ux-chat";
import "@/rooms/design/tools/GraceToolsChat";

import type { DesignChat } from "@/rooms/design/chat/design-chat";
import { takeChat, type Tree } from "@/rooms/design/inject";
import type { Content } from "@/rooms/design/tools/content";
import { useDesignConsole } from "@/rooms/design/console/useDesignConsole";
import {
  UX_APP_SECTION,
  ensureLeftColumn,
  placeLeftColumn,
  useDesignRowSelection,
  type DesignLeft,
} from "@/rooms/design/console/leftColumn";

export const DESIGN_ROOM_TABS = "chat,tools,executions,ux,settings";

/** The tab that owns the controls. Owner, 2026-10-25: *"a footer for tools"*. */
const TOOLS_TAB = "tools";

/** A tab's own chat build, as the shell places it (a view inside the seat's view slot). */
type SeatView = HTMLElement & {
  sessionId?: string;
  conversationId?: string;
  instructions?: string;
  section?: string;
};

/** One tab's container: its own drawing surface, its own chat, its own left column. */
type Seat = {
  tab: string;
  host: HTMLDivElement;
  renderer: any;
  chat: DesignChat;
  view: SeatView | null;
  leftRef: RefObject<DesignLeft | null>;
  /* WHAT THIS CONTAINER WAS LAST DRAWN WITH — a tree is assigned only when it changed, because an
     assignment rebuilds every node and would be the container visibly reloading. */
  drawn: boolean;
  drawnFrame: Tree | null;
  drawnInjected: Content | null | undefined;
  drawnMiddle: string;
};

export type DesignSeatShellProps = {
  /** The Figma module's declared application + chat information (headless engine). */
  injected?: Content | null;
  /** Is Tools the standing tab? Then the Tools container is the one drawn. */
  toolsStanding?: boolean;
  /** The rail's selection, reported to the room. */
  onTab?: (tab: string) => void;
};

export default function DesignSeatShell({ injected, toolsStanding, onTab }: DesignSeatShellProps) {
  /* THE CONSOLE'S READ IS ITS OWN FILE. Every container is drawn from the same structure; this is
     the structure, and the console's own left application. */
  const { frame, consoleApp, error, coverDown, setError } = useDesignConsole();
  const [railTab, setRailTab] = useState("chat");

  /* THE ROOM TELLS THE SHELL WHEN ITS SCREEN IS BUILT: the cover is down and the design console
     is readable. The shell's copy of this ring leaves on this message. */
  useEffect(() => {
    if (!coverDown) return;
    window.dispatchEvent(new CustomEvent("room-ready", { detail: { room: "design" } }));
  }, [coverDown]);

  /** Where the containers stand. Each container fills it, absolutely, and only one is shown. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  /** THE CONTAINERS, KEPT WARM. A tab's container is created on its first press and never rebuilt. */
  const seatsRef = useRef<Map<string, Seat>>(new Map());
  /** The left column that is standing — the layer tree marks its row when an approve writes one. */
  const leftRef = useRef<DesignLeft | null>(null);

  useDesignRowSelection(leftRef);

  /* THE RAIL IS THE NAVIGATION. It selects the container that stands; it never selects a page. */
  const onTabRef = useRef(onTab);
  onTabRef.current = onTab;
  const onTabChange = useCallback((event: Event) => {
    const tab = String((event as CustomEvent<{ tab?: string }>).detail?.tab || "");
    if (!tab) return;
    setRailTab(tab);
    onTabRef.current?.(tab);
  }, []);
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  /* ── A TAB'S CONTAINER ──────────────────────────────────────────────────────────────────── */
  const openSeat = useCallback((stage: HTMLElement, tab: string): Seat => {
    const host = document.createElement("div");
    host.setAttribute("data-design-seat", tab);
    host.style.cssText = "position:absolute;inset:0;display:none;min-width:0;min-height:0;";

    const renderer = document.createElement("design-renderer");
    renderer.setAttribute("data-design-seat-renderer", tab);
    renderer.style.cssText = "display:block;width:100%;height:100%;min-height:0;";
    host.appendChild(renderer);
    stage.appendChild(host);

    const chat = document.createElement("design-chat") as DesignChat;
    chat.setAttribute("data-design-chat", tab);
    /* THE ROOM OWNS THE RAIL. A press moves the room to the container that belongs to the pressed
       tab; it never switches this seat's tab, its conversation or its thread. */
    chat.setAttribute("rail-owned-by-host", "");

    /* THE TAB'S OWN CHAT BUILD. Same face, different job: UX draws the analytics conversation,
       Tools draws the ingest conversation, the other tabs draw the seat's own view for that tab. */
    let view: SeatView | null = null;
    if (tab === TOOLS_TAB) {
      view = document.createElement("grace-tools-chat") as SeatView;
      view.setAttribute("slot", "view");
      view.setAttribute("view-tab", tab);
      chat.appendChild(view);
    } else if (tab === "ux") {
      view = document.createElement("ux-chat") as SeatView;
      view.setAttribute("slot", "view");
      view.setAttribute("view-tab", tab);
      /* THE HEADER'S FIRST LINE IS THE SECTION THE PERSON IS WORKING IN. */
      view.section = UX_APP_SECTION;
      chat.appendChild(view);
    }
    chat.activeTab = tab;
    chat.collapsed = false;
    chat.addEventListener("tab-change", onTabChangeRef.current);

    const seat: Seat = {
      tab,
      host,
      renderer,
      chat,
      view,
      leftRef: { current: null },
      drawn: false,
      drawnFrame: null,
      drawnInjected: undefined,
      drawnMiddle: "",
    };
    seatsRef.current.set(tab, seat);
    return seat;
  }, []);

  /* ── THE DRAW — the standing container, and only it ────────────────────────────────────── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !frame) return;

    const standing = toolsStanding ? TOOLS_TAB : railTab;
    const seat = seatsRef.current.get(standing) ?? openSeat(stage, standing);

    /* ONE CONTAINER STANDS. The others are kept exactly as they were, chats and all. */
    for (const s of seatsRef.current.values()) {
      s.host.style.display = s.tab === standing ? "block" : "none";
    }

    const { tree: hostTree, chat: baseChat } = takeChat(frame);
    const packages = (((frame.dataModel as Record<string, any>)?.console?.design_packages ?? {}) as Record<
      string,
      { packageId?: string; conversationId?: string }
    >);
    const injectedChat = (injected?.chat ?? {}) as Record<string, unknown>;
    const isTools = seat.tab === TOOLS_TAB;

    /* THE TAB'S OWN CONVERSATION. Conversations belong to the package AND to one tab
       (THE_CONVERSATION_CONTRACT §1), so the id is this container's alone. It is assigned once
       and never re-pointed: nothing is cleared and no thread is read twice. */
    const conversationId = isTools
      ? String((injectedChat.conversationId as string) || packages.tools?.conversationId || "")
      : seat.tab === "ux"
        ? String(packages.ux?.conversationId || "")
        : seat.tab === "chat"
          ? String(packages.chat?.conversationId || "")
          : "";

    /* THE TOOLS VIEW'S OWN FACTS — the package the turn is filed under, the conversation it
       draws, and the surface's script. They go to the tools view, not to another tab's chat. */
    if (isTools && seat.view) {
      const nextSessionId =
        (typeof injectedChat.sessionId === "string" && injectedChat.sessionId) ||
        packages.tools?.packageId ||
        "";
      const nextInstructions =
        typeof injectedChat.instructions === "string"
          ? injectedChat.instructions
          : typeof injectedChat.graceInstructions === "string"
            ? injectedChat.graceInstructions
            : "";
      if (nextSessionId && seat.view.sessionId !== nextSessionId) seat.view.sessionId = nextSessionId;
      if (conversationId && seat.view.conversationId !== conversationId) {
        seat.view.conversationId = conversationId;
      }
      if (nextInstructions && seat.view.instructions !== nextInstructions) {
        seat.view.instructions = nextInstructions;
      }
    }

    /* THE CONTAINER'S DATA. The structure is the same in every container; what differs is the
       data — and, for Tools only, the controls. The plate is named here, in the Tools
       container's own data, so the console's surface never carries it. */
    const components: any[] = [
      ...(hostTree.components as any[]).map((c) => {
        if (c?.id !== "root") return c;
        const children = { ...(c.children ?? {}) } as Record<string, any>;
        if (isTools && injected?.middleId) children.middle = injected.middleId;
        if (isTools) children["left-footer"] = "left-footer";
        return { ...c, children, isThirdOpen: true };
      }),
      ...(isTools ? (injected?.middleComponents ?? []) : []),
      ...(isTools ? [{ id: "left-footer", component: "design-left-footer" }] : []),
    ];
    /* THE TOOLS DATA, UNDER THE SAME ROOT — the middle column's components bind their paths
       against it. The console's own keys are kept; the tool's session wins where both speak. */
    const dataModel =
      isTools && injected
        ? {
            ...hostTree.dataModel,
            ...injected.dataModel,
            session: {
              ...((hostTree.dataModel as Record<string, any>)?.session ?? {}),
              ...((injected.dataModel as Record<string, any>)?.session ?? {}),
            },
            cards: (hostTree.dataModel as Record<string, any>)?.cards,
          }
        : hostTree.dataModel;

    const middleKey = isTools ? (injected?.middleId ?? "") : "";
    if (
      !seat.drawn ||
      seat.drawnFrame !== frame ||
      seat.drawnInjected !== injected ||
      seat.drawnMiddle !== middleKey
    ) {
      seat.drawn = true;
      seat.drawnFrame = frame;
      seat.drawnInjected = injected;
      seat.drawnMiddle = middleKey;
      seat.renderer.components = components;
      seat.renderer.dataModel = dataModel;
    }

    let cancelled = false;
    void (async () => {
      try {
        await seat.renderer.updateComplete;
      } catch {
        // Lit's updateComplete does not reject; if it ever does, the queries below still run.
      }
      if (cancelled) return;

      let layout: HTMLElement | null = null;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        layout =
          (seat.renderer.shadowRoot?.querySelector("design-workspace") as HTMLElement | null) ?? null;
        if (layout) break;
        await new Promise((r) => setTimeout(r, 250));
        if (cancelled) return;
      }
      if (!layout) {
        /* FAIL HARD. A container that draws its layout and places nothing looks assembled and is
           not; a warning nobody reads is the same as no report. */
        setError(
          `The ${seat.tab} container never drew its layout, so its chat and left column were not placed.`,
        );
        return;
      }

      /* THE TAB'S OWN CHAT, IN ITS OWN CONTAINER — placed once, and only into its own layout. */
      seat.chat.setAttribute("slot", "right");
      if (seat.chat.parentElement !== layout) layout.appendChild(seat.chat);
      const chatInfo: Record<string, unknown> = { ...baseChat };
      if (isTools) {
        if (typeof injectedChat.sessionId === "string" && injectedChat.sessionId) {
          chatInfo.sessionId = injectedChat.sessionId;
        }
        if (typeof injectedChat.instructions === "string" && injectedChat.instructions) {
          chatInfo.instructions = injectedChat.instructions;
        }
      }
      if (conversationId) chatInfo.conversationId = conversationId;
      for (const [key, value] of Object.entries(chatInfo)) {
        if (value === undefined || key === "collapsed") continue;
        if ((seat.chat as unknown as Record<string, unknown>)[key] === value) continue;
        (seat.chat as unknown as Record<string, unknown>)[key] = value;
      }
      seat.chat.activeTab = seat.tab;
      seat.chat.collapsed = false;

      /* THE LEFT COLUMN — this container's own. */
      ensureLeftColumn(layout, seat.leftRef);
      const left = seat.leftRef.current;
      if (left) {
        placeLeftColumn({
          left,
          railTab: seat.tab,
          toolsStanding: isTools,
          injected,
          consoleApp,
          tree: hostTree,
        });
        leftRef.current = left;
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [frame, consoleApp, injected, toolsStanding, railTab, openSeat, setError]);

  if (error) {
    return <div style={{ padding: 24, color: "#f3b" }}>The design interface could not load: {error}</div>;
  }

  /*
   * THE STAGE HOLDS THE CONTAINERS. Each fills it and only the standing one is shown, so a tab
   * press reveals what already stands rather than drawing it again.
   */
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flex: "1 1 0%",
        minWidth: 0,
        minHeight: 0,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <div
        ref={stageRef}
        style={{
          position: "relative",
          flex: "1 1 0%",
          minWidth: 0,
          minHeight: 0,
          height: "100%",
          overflow: "hidden",
        }}
      />
      {/* THE ROOM'S COVER — THE SHEET AND THE DISSOLVE (owner, 2026-10-25). The wait itself
          (the ring and the sentence) moved to the shell, which draws it the instant the tab is
          pressed; the sentence keeps its plum because it reads over this light sheet. This
          cover keeps two jobs: it paints the same sheet the box's ground wears, so the ground
          never changes, and its 700ms dissolve reveals the interface when the assembler's tree
          has landed — a fade, never a pop. It draws no ring of its own, so exactly one ring
          stands. */}
      <div
        aria-hidden={coverDown}
        data-room-cover="design"
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 3,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          backgroundColor: "#582846",
          backgroundImage: `url(${designSectionBackground})`,
          backgroundSize: "100% 100%",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "top left",
          opacity: coverDown ? 0 : 1,
          transition: "opacity 700ms ease",
          pointerEvents: coverDown ? "none" : "auto",
        }}
      />
    </div>
  );
}
