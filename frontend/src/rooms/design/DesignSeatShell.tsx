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
/* THE CHAT TAB'S OWN PAGE — its own file and its own conversation file, built the same way the
   Tools page is: a page element with its own template, importing the shared parts. The shell
   creates this one for the Chat tab. */
import "@/rooms/design/chat/chat-tab";
/* THE TOOLS TAB'S OWN SEAT (owner, 2026-10-31). Imported HERE, by the room's shell, and by
   nothing else — never in `components/lit/register.ts`, which would make it available to every
   page and defeat the split. */
/* THE REVIEWER'S SURFACE (owner, 2026-11-02): the sessions sent for review, in the right column. */
import "@/rooms/design/review/design-review-view";

import type { DesignChat } from "@/rooms/design/chat/design-chat";
import { takeChat, type Tree } from "@/rooms/design/inject";
import type { Content } from "@/rooms/design/tools/content";
import { useDesignConsole } from "@/rooms/design/console/useDesignConsole";
import { useCardDelete } from "@/rooms/design/cards/useCardDelete";
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

/** The Chat tab — its own page, opened by the same press the Tools tab answers. */
const CHAT_TAB = "chat";

/**
 * THE QUESTION ABOUT A SESSION THE PERSON IS LEAVING, ASKED AS A REAL QUESTION.
 *
 * A session has two outcomes and the person chooses between them — Save makes it a card, Discard
 * removes the visit — so the room draws a dialog with those two words and answers through the
 * promise this returns.
 *
 * `handled` is set by the listener that draws the dialog. If no dialog took the question, the
 * answer is `unanswered`: nothing is saved and nothing is deleted, and the caller states the
 * failure. It used to answer Accept, which the caller then treated as Discard — a hidden
 * deletion behind a question nobody saw.
 */
type LeaveAnswer = "save" | "discard" | "unanswered";

function askLeaveQuestion(message: string): Promise<LeaveAnswer> {
  return new Promise((resolve) => {
    const detail: {
      message: string;
      handled: boolean;
      resolve: (action: LeaveAnswer) => void;
    } = { message, handled: false, resolve };
    window.dispatchEvent(new CustomEvent("design-leave-question", { detail }));
    if (!detail.handled) resolve("unanswered");
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
  /* THE VISIT THIS PAGE WAS BUILT FOR. A press of Tools — the tab or a card — increments it, and a
     page whose visit is not the current one is disposed even when the tab is the same. */
  visit: number;
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
  /** Each Tools press is a new visit; the page is keyed by it and the previous one is disposed. */
  toolsVisit?: number;
  /** The rail's selection, reported to the room. */
  onTab?: (tab: string) => void;
};

export default function DesignSeatShell({ injected, toolsStanding, toolsVisit, onTab }: DesignSeatShellProps) {
  /* THE CONSOLE'S READ IS ITS OWN FILE. Every container is drawn from the same structure; this is
     the structure, and the console's own left application. */
  const { frame, consoleApp, error, coverDown, setError, upsertCard, removeCard } = useDesignConsole();
  const [railTab, setRailTab] = useState("chat");

  /* THE ROOM TELLS THE SHELL WHEN ITS SCREEN IS BUILT: the cover is down and the design console
     is readable. The shell's copy of this ring leaves on this message. */
  useEffect(() => {
    if (!coverDown) return;
    window.dispatchEvent(new CustomEvent("room-ready", { detail: { room: "design" } }));
  }, [coverDown]);

  /** Where the page stands. One page fills it, absolutely. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  /**
   * THE PAGE THAT STANDS — AND ONLY IT. A tab's page is created when the tab is pressed and
   * destroyed when another tab is pressed; returning to a tab is a fresh page. Nothing of the
   * previous page's live state survives leaving it, which is what makes the previous session
   * impossible to draw under the next one. The record it reads is the server's, not this map's.
   */
  const pageRef = useRef<Seat | null>(null);
  /** The left column that is standing — the layer tree marks its row when an approve writes one. */
  const leftRef = useRef<DesignLeft | null>(null);

  useDesignRowSelection(leftRef);

  /* A SAVED CARD JOINS THE CONSOLE'S LIST IN PLACE. See `upsertCard` in `useDesignConsole`: the
     console is not re-read, so the grid the person is about to press is not rebuilt under them. */
  useEffect(() => {
    const onSaved = (event: Event) => {
      const card = (event as CustomEvent<{ card?: Record<string, any> }>).detail?.card;
      if (card) upsertCard(card);
    };
    window.addEventListener("design-card-saved", onSaved);
    return () => window.removeEventListener("design-card-saved", onSaved);
  }, [upsertCard]);

  /*
   * A CONFIRMED CARD DELETE IS THE DESIGN CONSOLE'S OWN. The card's arm→confirm is the whole
   * confirmation; a second question would be a second guard on one act. The delete archives the
   * session, so the row, its conversations and its activity stay in the record; a failure leaves
   * the card where it is and says why in the chat the person is reading.
   */
  const deleteCard = useCardDelete({
    removeCard,
    tab: toolsStanding ? TOOLS_TAB : railTab,
  });

  /* THE RAIL IS THE NAVIGATION. It selects the container that stands; it never selects a page. */
  const onTabRef = useRef(onTab);
  onTabRef.current = onTab;
  /* WHICH TAB STANDS, readable inside the press handler — state lags the press by a render. */
  const railTabRef = useRef(railTab);
  useEffect(() => {
    railTabRef.current = railTab;
  }, [railTab]);

  /*
   * A PAGE RELOAD IS A LEAVE TOO. The rail asks its Save or Discard question when a tab press
   * moves away, but a reload, a close, or a typed address never touches the rail, and the Tools
   * visit disappeared with no question. The same answer the rail reads is read here, and the
   * browser's own confirmation is the only notice a page is allowed to show before it unloads.
   * The browser writes the sentence; the application cannot.
   *
   * THE QUESTION IS THE SAME ONE. `design-save-ask` is synchronous, so the standing seat fills
   * this answer before the handler decides. A visit with nothing unsaved reloads without a
   * prompt; a draft, a changed field, or a recorded failure raises it.
   */
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (railTabRef.current !== TOOLS_TAB) return;
      const ask: {
        work?: boolean;
        kept?: boolean;
        changed?: boolean;
        draft?: boolean;
      } = {};
      window.dispatchEvent(new CustomEvent("design-save-ask", { detail: ask }));
      if (!ask.work) {
        const chat = pageRef.current?.chat as unknown as {
          hasPersonTurn?: () => boolean;
          hasScreenChange?: () => boolean;
        } | undefined;
        if (chat?.hasPersonTurn?.()) ask.work = true;
        if (!ask.work && chat?.hasScreenChange?.()) ask.work = true;
      }
      const unsaved = Boolean(ask.work && (!ask.kept || ask.changed || ask.draft));
      if (!unsaved) return;
      event.preventDefault();
      /* THE OLDER FORM SOME BROWSERS STILL READ. The sentence is the browser's own; an
         application string is ignored. */
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  const onTabChange = useCallback(async (event: Event) => {
    const tab = String((event as CustomEvent<{ tab?: string }>)?.detail?.tab || "");
    if (!tab) return;

    /*
     * A PRESS OF THE TAB THAT ALREADY STANDS IS NOT A NAVIGATION. It is the rail's own
     * expand/collapse: the navigation bar has already opened or closed the column. Treating it
     * as a navigation created a new Tools session on that click and removed the click's expand.
     * A new session belongs to a press that arrives from a different tab.
     */
    if (tab === railTabRef.current) return;

    /*
     * LEAVING A TAB ENDS ITS SESSION. The owner, 2026-11-07: the Tools tab is a new session, and a
     * saved session is opened by its card. A session is therefore not held for the next visit:
     * leaving either keeps the work as a card (Save) or removes the visit (Discard, or nothing to
     * save). A card the visit opened is kept by its own mark; it is not the visit, and it is not
     * deleted. The next press of the tab is a new working session.
     *
     * The question is asked only for work that is not yet on a card. "Accept" stood here and kept
     * the visit for the next press; that is the holding the owner rejected. There are two answers
     * now, Save and Discard, and a visit with no work is removed without a question.
     */
    let leavingTools = false;
    let warn: { title?: string; failure?: boolean; kept?: boolean } | null = null;
    if (railTabRef.current === TOOLS_TAB && tab !== TOOLS_TAB) {
      leavingTools = true;
      const ask: {
        work?: boolean;
        kept?: boolean;
        title?: string;
        failure?: boolean;
        changed?: boolean;
        draft?: boolean;
      } = {};
      window.dispatchEvent(new CustomEvent("design-save-ask", { detail: ask }));
      /* A TURN THE PERSON TYPED IS WORK, even when no field was touched: the chat is part of the
         session, and it is the thing the session is for. */
      if (!ask.work) {
        const standing = pageRef.current;
        const chat = standing?.chat as unknown as {
          hasPersonTurn?: () => boolean;
          hasScreenChange?: () => boolean;
        } | undefined;
        if (chat?.hasPersonTurn?.()) ask.work = true;
        /* A FILTER AND A BOX SIZE ARE CHANGES TOO (2026-11-02). They were not counted, so leaving
           after only filtering discarded the session instead of asking about it. */
        if (!ask.work && chat?.hasScreenChange?.()) ask.work = true;
      }
      /*
       * A SAVED CARD ASKS ONLY FOR WHAT THIS VISIT CHANGED. A failure is already in the card's
       * conversation, and a turn or a screen change is already stored with it; a field or a new
       * draft made after the card was opened is not. A working visit has no record anywhere but
       * itself, so anything in it is work the person may want to keep.
       */
      const unsaved = Boolean(ask.work && (!ask.kept || ask.changed || ask.draft));
      if (unsaved) {
        warn = {
          title: ask.title,
          failure: Boolean(ask.failure && !ask.kept),
          kept: ask.kept,
        };
      }
    }

    /*
     * THE MOVE IS NOT HELD BY THE QUESTION. Leaving a tab always succeeds and is immediate: the
     * page goes, its live state goes with it, and the room shows the pressed tab. The warning is
     * a notice about what changed, not a gate; it is shown after the move, and its answers act on
     * the record rather than deciding whether the person may leave.
     */
    /*
     * THE TOOLS TAB IS A NEW SESSION. A saved Tools session is opened by its card on the
     * console; pressing the Tools tab starts the next session. Clearing the opened session here
     * makes the seat assemble its own package instead of reopening the last conversation.
     */
    if (tab === TOOLS_TAB) {
      window.dispatchEvent(new CustomEvent("design-tools-open", { detail: { openSession: "" } }));
    }
    railTabRef.current = tab;
    setRailTab(tab);
    onTabRef.current?.(tab);

    if (leavingTools) {
      if (warn) {
        const name = warn.title ? `"${warn.title}"` : "This session";
        /* THE QUESTION NAMES WHAT IS AT STAKE. A recorded failure is not a field and not a
           drawing, so the generic sentence would hide why the question is being asked. A saved
           card is already on the console, so its Discard means "leave the card as it is", not
           "delete the card". */
        const finding = warn.failure
          ? "has a recorded failure that is not on a card yet."
          : warn.kept
            ? "has changes from this visit that are not saved on its card."
            : "has work in it that is not on a card yet.";
        const outcome = warn.kept
          ? "Save updates the card, with its drawing and its activity. Discard ends this visit " +
            "and leaves the card in place."
          : "Save keeps it, with its drawing and its activity, as a card on the Design console. " +
            "Discard closes the session and keeps its activity; the drawing is not kept.";
        void askLeaveQuestion(`${name} ${finding} ${outcome}`).then((answer) => {
          if (answer === "save") {
            window.dispatchEvent(new CustomEvent("design-left-save", { detail: { force: true } }));
          } else if (answer === "discard") {
            window.dispatchEvent(new CustomEvent("design-save-discard"));
          } else {
            /*
             * THE QUESTION COULD NOT BE DRAWN. Nothing is deleted and nothing is saved; the
             * session stays where it is and the failure is stated. The old fallback answered
             * Accept, which this caller read as Discard and deleted the session behind a question
             * the person never saw.
             */
            window.dispatchEvent(
              new CustomEvent("design-leave-unanswered", {
                detail: {
                  message:
                    "The save question could not be drawn, so the session was kept and nothing " +
                    "was deleted. It is still in the database; the next visit will find it.",
                },
              }),
            );
          }
        });
      } else {
        /* NOTHING TO ASK, AND NOTHING TO HOLD. The visit ends here: a card it opened stays by its
           own kept mark, a working session is removed, and the next press is a new session. */
        window.dispatchEvent(new CustomEvent("design-tools-leave"));
      }
    }
  }, []);
  const onTabChangeRef = useRef(onTabChange);
  onTabChangeRef.current = onTabChange;

  /* THE CONSOLE'S CARDS, read inside the press handler — the frame lags by a render. */
  const frameRef = useRef<any>(frame);
  frameRef.current = frame;

  /*
   * THE FOOTER'S CREATE NEW — END THIS SESSION, START THE NEXT, STAY IN TOOLS.
   *
   * The current session is asked for its own report; a person's turn and a screen change count
   * too. Only unsaved work raises the question. Save or Discard then acts on the record, and the
   * seat's next assembly builds the new working session in place. A question that cannot be drawn
   * starts nothing and keeps the session; nothing is deleted.
   */
  const onNewSession = useCallback(async () => {
    const page = pageRef.current;
    if (!page || page.tab !== TOOLS_TAB) return;
    const ask: {
      work?: boolean;
      kept?: boolean;
      title?: string;
      failure?: boolean;
      changed?: boolean;
      draft?: boolean;
    } = {};
    window.dispatchEvent(new CustomEvent("design-save-ask", { detail: ask }));
    if (!ask.work) {
      const chat = page.chat as unknown as {
        hasPersonTurn?: () => boolean;
        hasScreenChange?: () => boolean;
      };
      if (chat?.hasPersonTurn?.()) ask.work = true;
      if (!ask.work && chat?.hasScreenChange?.()) ask.work = true;
    }
    const unsaved = Boolean(ask.work && (!ask.kept || ask.changed || ask.draft));
    if (!unsaved) {
      /* NOTHING IS UNSAVED: the visit closes as a card and the seat assembles the next one. */
      window.dispatchEvent(new CustomEvent("design-save-discard", { detail: { newSession: true } }));
      return;
    }
    const name = ask.title ? `"${ask.title}"` : "This session";
    const finding = ask.failure
      ? "has a recorded failure that is not on a card yet."
      : ask.kept
        ? "has changes from this visit that are not saved on its card."
        : "has work in it that is not on a card yet.";
    const outcome = ask.kept
      ? "Save updates the card. Discard ends this visit and leaves the card in place."
      : "Save keeps it, with its drawing and its activity, as a card. Discard closes the session "
        + "and keeps its activity; the drawing is not kept.";
    const answer = await askLeaveQuestion(`${name} ${finding} ${outcome} A new session starts either way.`);
    if (answer === "save") {
      window.dispatchEvent(
        new CustomEvent("design-left-save", { detail: { force: true, newSession: true } }),
      );
    } else if (answer === "discard") {
      window.dispatchEvent(new CustomEvent("design-save-discard", { detail: { newSession: true } }));
    }
  }, []);

  useEffect(() => {
    const onNew = () => { void onNewSession(); };
    window.addEventListener("design-left-new", onNew);
    return () => window.removeEventListener("design-left-new", onNew);
  }, [onNewSession]);

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
          new CustomEvent("design-tools-open", {
            detail: { openSystem: system, title: String(card?.title ?? "") },
          }),
        );
        railTabRef.current = TOOLS_TAB;
        setRailTab(TOOLS_TAB);
        onTabRef.current?.(TOOLS_TAB);
        return;
      }
      if (key) return;
      /*
       * A CARD PRESS IS A NAVIGATION. The press moves the room to the Tools page at once — the
       * person pressed a card and must see the page answer — and the page shows its own loading
       * state for this card while its session is read. Holding the console until the session
       * arrived left the press with no visible response, which is not a navigation.
       */
      window.dispatchEvent(
        new CustomEvent("design-tools-open", {
          detail: { openSession: id, title: String(card?.title ?? "") },
        }),
      );
      railTabRef.current = TOOLS_TAB;
      setRailTab(TOOLS_TAB);
      onTabRef.current?.(TOOLS_TAB);
    };
    window.addEventListener("card-open", onCardOpen);
    return () => window.removeEventListener("card-open", onCardOpen);
  }, []);

  /*
   * A CONFIRMED DELETE ON A SESSION CARD REMOVES THAT SESSION. A design system's card is a package
   * too, but its removal is a catalogue decision, not a session delete; this handler leaves it
   * alone. The card's own arm→confirm is the only confirmation.
   */
  useEffect(() => {
    const onCardDelete = (event: Event) => {
      const detail = (event as CustomEvent<{ sessionId?: string; id?: string }>).detail ?? {};
      const id = String(detail.sessionId ?? detail.id ?? "");
      if (!id) return;
      const cards = ((((frameRef.current as any)?.dataModel as Record<string, any>)?.cards ??
        []) as Record<string, any>[]);
      const card = cards.find((row) => String(row?.id) === id);
      if (!card || String(card?.element_key ?? "") !== "") return;
      void deleteCard(id);
    };
    window.addEventListener("card-delete", onCardDelete);
    return () => window.removeEventListener("card-delete", onCardDelete);
  }, [deleteCard]);

  /* ── A TAB'S PAGE IS CREATED, AND THE PREVIOUS ONE IS DESTROYED ─────────────────────────── */
  const disposePage = useCallback(() => {
    const page = pageRef.current;
    if (!page) return;
    pageRef.current = null;
    /* THE LEFT COLUMN'S REFERENCE GOES WITH THE PAGE. A removed element held here would be the
       row-selection listener's stale authority. */
    leftRef.current = null;
    page.chat.remove();
    page.view?.remove();
    page.host.remove();
  }, []);

  const openSeat = useCallback((stage: HTMLElement, tab: string, visit: number): Seat => {
    /* THE PAGE THAT STOOD IS GONE BEFORE THE NEXT ONE IS BUILT. A tab is a page: it is loaded on
       entry and disposed on leave, so no previous drawing, chat or draft can stand under it. */
    disposePage();
    const host = document.createElement("div");
    host.setAttribute("data-design-seat", tab);
    host.style.cssText = "position:absolute;inset:0;display:block;min-width:0;min-height:0;";

    const renderer = document.createElement("design-renderer");
    renderer.setAttribute("data-design-seat-renderer", tab);
    renderer.style.cssText = "display:block;width:100%;height:100%;min-height:0;";
    host.appendChild(renderer);
    stage.appendChild(host);

    /* EACH TAB DRAWS ITS OWN PAGE FILE. Tools draws <tools-chat>; the Chat tab draws <chat-tab>,
       its own page with its own conversation file; every other tab keeps the shared <design-chat>
       until its own page is built. The page resolves its own package from the data it is given. */
    const chat = document.createElement(
      tab === TOOLS_TAB ? "tools-chat" : tab === CHAT_TAB ? "chat-tab" : "design-chat",
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
      visit,
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
    pageRef.current = seat;
    return seat;
  }, [disposePage]);

  /*
   * THE CHAT IS OPENED FROM A SEAT THAT CANNOT REACH THE LAYOUT. The tools seat reports an ingest
   * result from outside the renderer's shadow root; a document query there cannot see the page.
   * This shell holds the seat, so it asks the standing page's own workspace to open her — the same
   * `openChat` the room uses, and the width the person already chose.
   */
  useEffect(() => {
    const onOpenChat = (event: Event) => {
      const tab = String((event as CustomEvent<{ tab?: string }>).detail?.tab ?? "");
      const seat = pageRef.current?.tab === tab ? pageRef.current : null;
      if (!seat) return;
      /* THE ROOT IS `design-workspace` IN THE TREE THE SEAT DRAWS — the Tools assembly's own
         answer, measured: `root -> design-workspace -> {left, middle, right}`. The
         `tools-workspace` element is the page wrapper, not the layout this method lives on. */
      const layout = (
        seat.renderer.shadowRoot?.querySelector("design-workspace") ??
        seat.renderer.shadowRoot?.querySelector("tools-workspace")
      ) as (HTMLElement & { openChat?: () => void }) | null;
      layout?.openChat?.();
    };
    window.addEventListener("design-chat-open", onOpenChat);
    return () => window.removeEventListener("design-chat-open", onOpenChat);
  }, []);

  /* ── THE DRAW — the standing container, and only it ────────────────────────────────────── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !frame) return;

    const standing = toolsStanding ? TOOLS_TAB : railTab;
    /* A TOOLS PAGE IS KEYED BY ITS VISIT, not only by the tab: a card press while Tools already
       stands is a new page, and the page that drew the previous card is disposed with the press. */
    const visit = standing === TOOLS_TAB ? Number(toolsVisit ?? 0) : 0;
    let seat = pageRef.current;
    if (!seat || seat.tab !== standing || seat.visit !== visit) {
      /* A TAB PRESS IS A NEW PAGE. The previous page is disposed inside `openSeat`, so nothing it
         held — drawing, chat, draft, filter — can stand under the page that replaces it. */
      seat = openSeat(stage, standing, visit);

      /*
       * NO PANE MOTION DURING A SWITCH. A page that was just built opens its column and sets its
       * width, and after a drag the next page's pane changes mode and number; each of those ran the
       * workspace's 760ms transition, which is the column animating and popping out on every tab
       * change. The duration is a variable the room can switch off (see the workspace's
       * `--dur-pane`): it is 0 for the moment the page appears, and the drawn duration returns for
       * every other change, including the drag.
       */
      stage.style.setProperty("--pane-motion", "0ms");
      window.setTimeout(() => stage.style.removeProperty("--pane-motion"), 1200);

      /*
       * THE CHAT TAB OPENS ITS LAST MODIFIED CONVERSATION ON THE PRESS. The Tools tab is not
       * called here: its own page states the session it is in, and its chat binds to that session
       * when the page's own answer arrives. Calling the package's newest thread here would show
       * the previous visit's conversation before the new session exists.
       */
      if (standing === CHAT_TAB) {
        const chat = seat.chat as unknown as { loadDefaultConversation?: () => void };
        chat.loadDefaultConversation?.();
      }
      /* The review view reads its own list when it attaches; the new page has just attached it. */
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
          /* THE CHAT TAB IS THE DESIGN CONSOLE CHAT. It is the advanced filter over the console
             cards, so it is bound to the console package's own conversation. It does not read the
             Tools package, and the separate chat package is not a second source for it. */
          ? String(packages.console?.conversationId || "")
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
    /* THE TOOLS CARD'S LIFECYCLE, READ BEFORE THE PAGE IS ASSEMBLED. A queued card has no
       canvas: the middle column is not referenced and the Save/Create-new footer is not named.
       The left column draws the read-only ledger instead (see placeLeftColumn). */
    const lockedTools = isTools && injected?.locked === true;
    const components: any[] = [
      ...(hostTree.components as any[]).map((c) => {
        if (c?.id !== "root") return c;
        const children = { ...(c.children ?? {}) } as Record<string, any>;
        if (isTools) {
          /* THE TOOLS PAGE'S OWN COLUMNS, AND NOT THE CONSOLE'S. Until the page's own answer
             arrives there is no tool application to draw; the left column's ring is the honest
             state. The console's card grid is never a stand-in for a tool that has not reported. */
          if (injected?.middleId && !lockedTools) children.middle = injected.middleId;
          else delete children.middle;
          if (injected && !lockedTools) children["left-footer"] = "left-footer";
          else delete children["left-footer"];
          /* NO APPLICATION YET: the console's card grid is not a stand-in for it. A locked card
             keeps the left reference because the ledger is drawn in the left column's own host. */
          if (!injected) delete children.left;
        }
        return { ...c, children, isThirdOpen: true };
      }),
      ...(isTools && !lockedTools ? (injected?.middleComponents ?? []) : []),
      /* THE FOOTER IS NAMED HERE, AND ITS TWO VALUES ARE BOUND TO THE SESSION — the same data the
         Tools seat writes for the ingest form. A prop patched onto the component would be a write
         nothing reads: the renderer re-applies props when the DATA MODEL changes. */
      ...(isTools && injected && !lockedTools
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

      /*
       * THE CHAT'S WIDTH IS THE SECTION'S, NOT EACH PAGE'S.
       *
       * Every tab is its own page with its own layout element, and each layout drew its own width
       * from its own rules — one from the assembly's declared load width, one from the equal
       * share, one from a drag. The result was the chat resizing on every tab press. The width is
       * part of the interface, so it is one number for the section: the first page's rendered
       * width anchors it, a drag updates it, and every other page is drawn at that same width.
       */
      /* THE TAB'S OWN CHAT, IN ITS OWN CONTAINER — placed once, and only into its own layout. */
      seat.chat.setAttribute("slot", "right");
      if (seat.chat.parentElement !== layout) layout.appendChild(seat.chat);
      const chatInfo: Record<string, unknown> = { ...baseChat };
      chatInfo.dataModel = dataModel;
      /* THE TAB PACKAGES, INJECTED AS DATA. They travel separately because the merged Tools
         data model can replace the console block. */
      chatInfo.designPackages =
        ((hostTree.dataModel as Record<string, any> | undefined)?.console?.design_packages ??
          {}) as Record<string, { packageId?: string; conversationId?: string }>;
      /* EVERY DESIGN SEAT CARRIES THE SPEECH FLAG. Without it a seat refuses every turn with no
         visible result. */
      if (typeof injectedChat.graceLiveContext === "boolean") {
        chatInfo.graceLiveContext = injectedChat.graceLiveContext;
      } else {
        chatInfo.graceLiveContext = false;
      }
      if (isTools) {
        /* A TOOL'S CONVERSATIONS ARE ITS OWN (owner, 2026-11-02). The surface's list and id are
           the CONSOLE's; the Tools seat reads its own package instead, so neither is handed on. */
        delete chatInfo.conversationId;
        delete chatInfo.conversations;
        delete chatInfo.sessionId;
        /*
         * THE PAGE'S OWN SESSION IS THE ONLY AUTHORITY. The tab-packages map is the console's
         * snapshot from when the room loaded; after a save or a discard it names the session that
         * is already gone, and the chat would open its conversation before this page's own answer
         * arrives. The Tools chat binds only to the session the Tools answer states — and until
         * that answer, it is given no session and no package at all.
         */
        delete chatInfo.designPackages;
        delete chatInfo.instructions;
        chatInfo.dataModel = injected ? dataModel : { session: {} };
        if (typeof injectedChat.instructions === "string" && injectedChat.instructions) {
          chatInfo.instructions = injectedChat.instructions;
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
      /*
       * EVERY DESIGN SEAT TAKES THE NEWEST ROW OF ITS OWN PACKAGE. The assembly's pointed
       * conversation, and the surface's conversation list, are not handed to any seat: the list
       * the seat reads is the package's own, ordered by `updated_at` descending, so the first row
       * is the last modified conversation. The package is the divider; the newest row is the
       * default. The Tools seat does the same with its own package.
       */
      if (!isTools) {
        delete chatInfo.conversationId;
        delete chatInfo.conversations;
        delete chatInfo.sessionId;
        const ownPackage =
          seat.tab === "approvals" ? ""
            : seat.tab === "ux" ? packages.ux?.packageId
              : packages.console?.packageId;
        if (ownPackage) chatInfo.sessionId = ownPackage;
      }
      /*
       * THE CHAT TAB'S OWN WORDS, NOT THE CONSOLE'S. The surface's chat component carries the
       * console's script; the Chat tab is its own seat and receives the Chat tab's script from
       * the room's data. There is no fallback to the console's words: a seat with no words
       * refuses the turn loudly rather than speaking as another seat.
       */
      if (seat.tab === CHAT_TAB) {
        delete chatInfo.instructions;
        const chatWords = (hostTree.dataModel as Record<string, any> | undefined)?.console
          ?.chat_tab_grace_instructions;
        if (typeof chatWords === "string" && chatWords) {
          chatInfo.instructions = chatWords;
        }
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
      /* THE READOUT'S NUMBERS ARE THE SEAT'S OWN READ. The shell no longer hands the assembly's
         last-call usage object to the page: that object carries one call, and assigning it here
         overwrote the seat's recorded readout with a single call's figures. The page reads its
         usage summary from the ledger and owns the readout. */
      seat.chat.activeTab = seat.tab;
      /*
       * THE COLUMN'S COLLAPSE IS THE PERSON'S, NOT A REDRAW'S. The chat starts open when its page
       * is created; after that, a content report or a tree change must not reopen a column the
       * person collapsed by clicking the active tab.
       */

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
  }, [frame, consoleApp, injected, toolsStanding, toolsVisit, railTab, openSeat, setError]);

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
