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
/* THE TOOLS TAB'S OWN SEAT — imported here and by nothing else. */
import "@/rooms/design/tools/tools-chat";
/* THE TOOLS TAB'S OWN SEAT (owner, 2026-10-31). Imported HERE, by the room's shell, and by
   nothing else — never in `components/lit/register.ts`, which would make it available to every
   page and defeat the split. */
/* THE REVIEWER'S SURFACE (owner, 2026-11-02): the sessions sent for review, in the right column. */
import "@/rooms/design/review/design-review-view";

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

/**
 * THE TAB THAT ASKS, AND ANSWERS, A REVIEW (owner, 2026-11-02).
 *
 * The right column carries one surface for approvals: the sessions this person can send, the ones
 * sent to them, the queue and the two answers a reviewer gives. It reads on its own when it is
 * attached; a PRESS of the tab is the fact that says "read again", so a session sent or answered
 * elsewhere never leaves the list stale behind a tab the person already has open.
 */
const APPROVALS_TAB = "approvals";

/**
 * THE QUESTION ABOUT A SESSION THE PERSON IS LEAVING, ASKED AS A REAL QUESTION.
 *
 * It used to be `window.confirm`, which offers two answers worded by the browser. A session has
 * three outcomes and the person chooses between them — Save makes it a card, Accept keeps it here,
 * Discard throws it away — so the room draws a dialog with those three words and answers through
 * the promise this returns.
 *
 * `handled` is set by the listener that draws the dialog. If no dialog took the question (a room
 * without the seat), the answer is Accept: the session is kept rather than silently destroyed.
 */
function askLeaveQuestion(message: string): Promise<"save" | "accept" | "discard"> {
  return new Promise((resolve) => {
    const detail: {
      message: string;
      handled: boolean;
      resolve: (action: "save" | "accept" | "discard") => void;
    } = { message, handled: false, resolve };
    window.dispatchEvent(new CustomEvent("design-leave-question", { detail }));
    if (!detail.handled) resolve("accept");
  });
}

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
  /* WHICH TAB STANDS, readable inside the press handler — state lags the press by a render. */
  const railTabRef = useRef(railTab);
  /* The tab that stood on the previous draw, so a press is told apart from a redraw. */
  const standingTabRef = useRef("");
  useEffect(() => {
    railTabRef.current = railTab;
  }, [railTab]);
  const onTabChange = useCallback(async (event: Event) => {
    const tab = String((event as CustomEvent<{ tab?: string }>)?.detail?.tab || "");
    if (!tab) return;

    /*
     * LEAVING A TAB ENDS ITS SESSION, AND THE PERSON DECIDES WHAT HAPPENS TO IT.
     *
     * The owner, 2026-11-02: *”there is no navigation … every single tab you're creating a
     * session.”* So a tab press is not a page change. The tab that is standing holds a session
     * with its conversations in it; leaving it either keeps that session as a card, keeps it here
     * for the next visit, or throws it away.
     *
     * THE THREE ANSWERS, and the difference between them:
     *
     *   Save     — the same act as the foot of the column: the session becomes a card.
     *   Accept   — the session stays exactly as it is, and the next visit comes back to it.
     *   Discard  — its conversations and its row are removed, and the next press is a new session.
     *
     * NOTHING CHANGED IS NOTHING TO SAVE — AND NOTHING TO THROW AWAY (owner, 2026-11-02).
     *
     * This used to throw the visit away without a word whenever nothing had changed: *"if nothing
     * changes and nothing is added nothing is saved."* Nothing saved is right; DESTROYING is not.
     * The Tools tab's own session holds its conversations, so leaving Tools after only looking at
     * the chat deleted the session, its conversations and the row the tab loads them from — the
     * person came back to an empty tab, every time, and the last conversation they had was gone.
     * That is the "it starts over" they reported: measured, `discardDesignSession` removes every
     * conversation of the session and the session itself.
     *
     * SO: a visit with no work is ACCEPTED silently — the session and its conversations stand, and
     * the next press of the tab comes back to them. A new session begins on the person's own act:
     * Save (which makes the card and starts the next visit fresh) or Discard in the question below.
     */
    if (railTabRef.current === TOOLS_TAB && tab !== TOOLS_TAB) {
      const ask: { work?: boolean; kept?: boolean; title?: string } = {};
      window.dispatchEvent(new CustomEvent("design-save-ask", { detail: ask }));
      /* A TURN THE PERSON TYPED IS WORK, even when no field was touched: the chat is part of the
         session, and it is the thing the session is for. */
      if (!ask.work) {
        const standing = seatsRef.current.get(railTabRef.current);
        const chat = standing?.chat as unknown as {
          hasPersonTurn?: () => boolean;
          hasScreenChange?: () => boolean;
        } | undefined;
        if (chat?.hasPersonTurn?.()) ask.work = true;
        /* A FILTER AND A BOX SIZE ARE CHANGES TOO (2026-11-02). They were not counted, so leaving
           after only filtering discarded the session instead of asking about it. */
        if (!ask.work && chat?.hasScreenChange?.()) ask.work = true;
      }
      if (!ask.kept && ask.work) {
        const name = ask.title ? `"${ask.title}"` : "This session";
        const answer = await askLeaveQuestion(
          `${name} has work in it that is not on a card yet. ` +
            `Save keeps it as a card on the Design console. ` +
            `Accept keeps the session here, so your next visit comes back to it. ` +
            `Discard throws it away.`,
        );
        if (answer === "save") window.dispatchEvent(new CustomEvent("design-left-save"));
        else if (answer === "discard") window.dispatchEvent(new CustomEvent("design-save-discard"));
      }
    }

    railTabRef.current = tab;
    setRailTab(tab);
    onTabRef.current?.(tab);
  }, []);
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  /* THE CONSOLE'S CARDS, read inside the press handler — the frame lags by a render. */
  const frameRef = useRef<any>(frame);
  frameRef.current = frame;

  /*
   * A SESSION CARD TAKES THE PERSON BACK TO WORK (owner, 2026-11-01: the saved card "doesn't
   * reopen the state of where I was").
   *
   * `ConsoleCardGrid` announces a press with the card's id. Three kinds of card stand here: an
   * element (its key names a catalogue tag — the Tools seat answers that one), a design system
   * (its key starts `system:` and it opens nothing yet), and a KEPT SESSION, whose key is empty
   * and whose id is a session row. The last one is this handler's: it asks the room for the Tools
   * tab carrying that id, and the assembly then builds the tab in that very session — its
   * conversation, its title, its address, its notes.
   */
  useEffect(() => {
    const onCardOpen = (event: Event) => {
      const detail = (event as CustomEvent<{ id?: string; sessionId?: string }>).detail ?? {};
      const id = String(detail.sessionId ?? detail.id ?? "");
      if (!id) return;
      const cards = (((frameRef.current as any)?.dataModel as Record<string, any>)?.cards ?? []) as any[];
      const card = cards.find((c) => String(c?.id) === id);
      if (!card) return;
      const key = String(card?.element_key ?? "");

      /*
       * A DESIGN SYSTEM'S CARD OPENS THE TOOL IN THAT SYSTEM (owner, 2026-11-02): *"the card
       * should just open the tool with the loaded DS, which this one is the default."*
       *
       * The card's key is `system:<id>` — the catalogue's own name, the same one the design
       * assembly resolves. The system travels to the room and then to the seat, where it becomes
       * the catalogue the tab is built in. Nothing is switched and no new control exists: pressing
       * the card IS the choice, and the tab opens in it.
       */
      if (key.startsWith("system:")) {
        const system = key.slice("system:".length);
        window.dispatchEvent(
          new CustomEvent("design-tools-open", { detail: { openSystem: system } }),
        );
        railTabRef.current = TOOLS_TAB;
        setRailTab(TOOLS_TAB);
        onTabRef.current?.(TOOLS_TAB);
        return;
      }
      if (key) return;
      window.dispatchEvent(new CustomEvent("design-tools-open", { detail: { openSession: id } }));
      railTabRef.current = TOOLS_TAB;
      setRailTab(TOOLS_TAB);
      onTabRef.current?.(TOOLS_TAB);
    };
    window.addEventListener("card-open", onCardOpen);
    return () => window.removeEventListener("card-open", onCardOpen);
  }, []);

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

    /* THE TOOLS TAB DRAWS ITS OWN SEAT. Every other tab keeps the room's seat; the Figma tool's
       column is `tools-chat`, its own file, so nothing built into it can appear in Chat, UX,
       Executions or Settings. */
    const chat = document.createElement(
      tab === TOOLS_TAB ? "tools-chat" : "design-chat",
    ) as DesignChat;
    chat.setAttribute("data-design-chat", tab);
    /* THE ROOM OWNS THE RAIL. A press moves the room to the container that belongs to the pressed
       tab; it never switches this seat's tab, its conversation or its thread. */
    chat.setAttribute("rail-owned-by-host", "");

    /* THE TAB'S OWN CHAT BUILD. Same face, different job: UX draws the analytics conversation,
       Tools draws the ingest conversation, the other tabs draw the seat's own view for that tab. */
    let view: SeatView | null = null;
    /* THE TOOLS TAB HAS NO SECOND VIEW (owner, 2026-11-02). It used to slot `grace-tools-chat` in
       front of the seat — the old Tools conversation. That element drew an empty card, and the
       seat behind it decided a foreign view was standing and hid its own thread: her greeting was
       in the seat and the person saw nothing. The seat IS the Tools chat; nothing is slotted. */
    if (tab === "approvals") {
      view = document.createElement("design-review-view") as SeatView;
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
    /* A CONTAINER BUILT ON THIS DRAW IS NEW, and its view reads on attach — asking it to read
       again in the same breath would be two reads of one list. */
    const existed = seatsRef.current.has(standing);
    const seat = seatsRef.current.get(standing) ?? openSeat(stage, standing);

    /* ONE CONTAINER STANDS. The others are kept exactly as they were, chats and all. */
    for (const s of seatsRef.current.values()) {
      s.host.style.display = s.tab === standing ? "block" : "none";
    }

    /*
     * A PRESS OF THE TAB OPENS ITS LAST MODIFIED CONVERSATION (owner, 2026-11-02).
     *
     * The seat is kept across presses, so it used to hold whatever thread it was showing when the
     * person walked away. The press is the fact that says "open the default one", and the seat
     * reads the package's own list to find it. It is announced only when the standing tab CHANGES,
     * so a redraw for other reasons never moves the person out of a thread they are reading.
     */
    if (standing !== standingTabRef.current) {
      standingTabRef.current = standing;
      if (standing === TOOLS_TAB) {
        const chat = seat.chat as unknown as { loadDefaultConversation?: () => void };
        chat.loadDefaultConversation?.();
      } else if (standing === APPROVALS_TAB && existed) {
        /* THE REVIEW LIST IS READ AGAIN ON A PRESS — a session sent from another tab, or answered
           by another person, must not wait for a reload of the room to appear. */
        (seat.view as unknown as { reload?: () => void })?.reload?.();
      }
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
          /* THE CONSOLE IS ITS OWN TAB AND ITS OWN PACKAGE (owner, 2026-11-02). The default view
             was reading the Chat tab's package while its session was the console's — one seat
             answering from one row and speaking over another's thread. The console's package is
             the one the payload resolves for it, and its thread is the last modified. `chat` is
             the fallback only for a payload that predates the console package. */
          ? String(packages.console?.conversationId || packages.chat?.conversationId || "")
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
      /*
       * THE PACKAGE'S CONVERSATIONS ARE NOT HANDED HERE YET, AND THIS IS WHY.
       *
       * The assembly for this intent returns the design system's own list — read from the server:
       * one conversation, titled "Raibach Prompt Composer". But both sources reachable from this
       * shell resolve to the CONSOLE's list, not the Tools tab's: the room's frame carries the
       * console's data model, and the headless engine's report carried the console's thread too.
       * A first attempt bound that and the seat drew ANOTHER PACKAGE'S conversation — measured:
       * `conversations: [{ id: ef4f91ec, title: "Design · Console" }]` under the prompt-composer
       * session. That is worse than an empty list, so the assignment is out until the Tools tab's
       * own tree is the source. Next step: read `buildContent`'s chat object at run time and take
       * the list the tools assembly actually resolved.
       */
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
      /* THE FOOTER IS NAMED HERE, AND ITS TWO VALUES ARE BOUND TO THE SESSION — the same data the
         Tools seat writes for the ingest form. A prop patched onto the component would be a write
         nothing reads: the renderer re-applies props when the DATA MODEL changes. */
      ...(isTools
        ? [
            {
              id: "left-footer",
              component: "design-left-footer",
              busy: { path: "/session/saving" },
              result: { path: "/session/save_result" },
            },
          ]
        : []),
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
        /* A TOOL'S CONVERSATIONS ARE ITS OWN (owner, 2026-11-02). The surface's list and id are
           the CONSOLE's; the Tools seat reads its own package instead, so neither is handed on —
           one seat showing another package's threads is the defect this column kept producing. */
        delete chatInfo.conversationId;
        delete chatInfo.conversations;
        delete chatInfo.sessionId;
        /*
         * WHICH PACKAGE THE TOOLS CHAT BELONGS TO — THE TOOL'S OWN, NOT THE ROOM'S.
         *
         * The design surface binds its seat to `/session/id`, which is the DESIGN CONTAINER: the
         * permanent row the room files activity against. The Tools tab's own session — the row Save
         * keeps and whose conversations the seat lists — is `/session/design_session_id`. Taking
         * the first made the seat ask the container for the tool's conversations, find none, and
         * clear its thread whenever the surface re-loaded: measured on the running tab, the chat
         * thought and then emptied itself as the component tree arrived.
         */
        const injectedDesignSession = String(
          (injected?.dataModel as Record<string, any>)?.session?.design_session_id ?? "",
        );
        const toolsSession =
          injectedDesignSession ||
          packages.tools?.packageId ||
          (typeof injectedChat.sessionId === "string" && injectedChat.sessionId) ||
          "";
        if (toolsSession) chatInfo.sessionId = toolsSession;
        if (typeof injectedChat.instructions === "string" && injectedChat.instructions) {
          chatInfo.instructions = injectedChat.instructions;
        }
        /* THE SEAT MAY SPEAK ONLY WHEN THE ROOM SAID WHETHER ITS LIVE FACTS FOLLOW THE WORDS.
           `_gracePrompt` refuses a turn whose `graceLiveContext` is undefined, and this column
           never handed the Tools seat that flag — so every greeting it sent was answered with the
           refusal instead of words. The design surface states `false`, and that is what travels. */
        if (typeof injectedChat.graceLiveContext === "boolean") {
          chatInfo.graceLiveContext = injectedChat.graceLiveContext;
        }
        /* THE TABLE THE CHAT MAY SPEAK ABOUT — the same rows the left column draws. */
        const tableRows = (injected?.dataModel as Record<string, any>)?.session?.elements;
        if (Array.isArray(tableRows)) {
          chatInfo.tableRows = tableRows.map((row: any) => ({
            id: row?.id,
            key: row?.key,
            name: row?.name,
          }));
        }
      }
      if (!isTools && conversationId) chatInfo.conversationId = conversationId;
      if (!isTools) {
        /*
         * THE DESIGN CHAT IS ALL OF DESIGN; THE OTHER TABS AND THE GLOBAL CONSOLE ARE THEIR OWN.
         *
         * The owner, 2026-11-03: *"the chat seat for design would only be the all of the design
         * chats so it's already pre-filtered to design chat. The console is only the global console
         * chats. These chats are not system … they're related to the individual tabs."* The Chat
         * tab's own package is the design console row (`design_tab | console`); its list is every
         * design tab's chats and every kept design session's, filtered by the package's type. The
         * whole system's conversations are not any seat's list.
         */
        const ownPackage =
          seat.tab === "ux" ? packages.ux?.packageId : packages.console?.packageId;
        if (ownPackage) chatInfo.sessionId = ownPackage;
        (seat.chat as unknown as { conversationScope?: "package" | "design" }).conversationScope =
          seat.tab === "chat" ? "design" : "package";
      }
      for (const [key, value] of Object.entries(chatInfo)) {
        if (value === undefined || key === "collapsed") continue;
        /* THE TOOLS SEAT OWNS ITS CONVERSATION (owner, 2026-11-02). It reads the package's own
           list and opens the last modified thread, on a tab press and on a first bind. An id
           handed from an assembly is a snapshot, and assigning it here would overwrite the newer
           one the seat had just read — which is how a press showed an older conversation. */
        if (isTools && key === "conversationId") continue;
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
