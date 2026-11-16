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
import { useCallback, useEffect, useRef, useState } from "react";
import designSectionBackground from "@/assets/design-section2-bkg.webp";
/* THE SHEET'S BASE COLOUR IS THE BOX'S OWN FACT. The seat's cover paints the same sheet the box
   does, so it wears the same base under it. */
import { DESIGN_SHEET_BASE } from "@design2/surface-design/DesignBox";
import { DESIGN2_TAB } from "./tab";
import "@design2/ux/chat";
/* THE TOOLS TAB'S OWN SEAT — imported here and by nothing else. */
import "@design2/tools/tools-chat";
/* THE CHAT TAB'S OWN PAGE — its own file and its own conversation file, built the same way the
   Tools page is: a page element with its own template, importing the shared parts. The shell
   creates this one for the Chat tab. */
import "@design2/chat/chat-tab";
/* THE SEAT ITSELF — the name `chat-panel` in the seat's registry maps to this element, so the
   surface's own table is only true if the element exists. It also draws the rail's other tabs. */
import "@design2/chat/design-chat";
/* THE TOOLS TAB'S OWN SEAT (owner, 2026-10-31). Imported HERE, by the room's shell, and by
   nothing else — never in `components/lit/register.ts`, which would make it available to every
   page and defeat the split. */
/* THE REVIEWER'S SURFACE (owner, 2026-11-02): the sessions sent for review, in the right column. */
import "@design2/approve/review-view";
/* ── THE SHARED FURNITURE IS REGISTERED BY THE ROOM (owner's ruling, 2026-11-16) ──────────────
 *
 * A seat draws the shared furniture BY TAG and imports none of it. Until now those tags existed
 * only as a side effect of the Chat seat's element being imported here, so any tab that drew them
 * while that import moved lost its drawing with no message — an unknown custom element renders
 * nothing. The room registers what the room's tabs may draw, once, here.
 */
import "@design2/surface-design/surface/rail/navigation-bar";
import "@design2/chat/readout/output-header";
import "@design2/chat/parts/design-chat-header";
import "@design2/chat/parts/design-chat-messages";
import "@design2/chat/parts/design-chat-action-bar";
import "@design2/chat/parts/design-chat-input";
import "@design2/chat/parts/design-chat-plugin-tray";
import "@design2/chat/parts/design-prompt-textarea";
/* THE SAME FOOTER UI AS THE FIGMA TOOL — its save is wired to the UX session, not to Tools. */
import "@design2/surface-design/surface/left-container/footer";
import { apiFetch } from "@/shared/apiFetch";
import { API_BASE } from "@/shared/apiHelper";

import type { SurfaceRenderer } from "./surface/load";
/* THE SURFACE'S OWN THREE MODULES — the tree, the data and the load. */
import { buildSurfaceTree } from "./surface/components";
import { createSurfaceRenderer, drawSurface, loadSurfaceRegistry, readConversationTurns } from "./surface/load";
import type { Content } from "@design2/tools/content";
import { useDesignConsole } from "@design2/surface-design/surface/middle-container/use-design-console";
import { useCardDelete } from "@design2/surface-design/surface/left-container/use-card-delete";
import { useDesignRowSelection } from "@design2/surface-design/surface/left-container/left-column";

export const DESIGN_ROOM_TABS = "chat,tools,executions,ux,settings";

/** THE RAIL'S OWN TABS. A `tab-change` from anything else (the top navigation) is not ours. */
const RAIL_TABS = new Set([...DESIGN_ROOM_TABS.split(","), "approvals"]);

/** The tab that owns the controls. Owner, 2026-10-25: *"a footer for tools"*. */
const TOOLS_TAB = "tools";

/** The Chat tab — its own page, opened by the same press the Tools tab answers. */
const CHAT_TAB = "chat";

/** The UX tab — its own seat, drawn by its own file, not a view inside another tab's seat. */
const UX_TAB = "ux";

/** The Approve tab — the gate. It draws the room's one chat today; its own seat is not built. */
const APPROVALS_TAB = "approvals";

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

/** THE CONTRACT EVERY TAB'S CHAT ANSWERS. A tab has its own element; this is all the
 *  shell is allowed to assume about it, so no tab is typed as another tab's seat. */
type SeatChat = HTMLElement & {
  activeTab?: string;
  collapsed?: boolean;
  sessionId?: string;
  conversationId?: string;
  loadDefaultConversation?: () => void;
  hasPersonTurn?: () => boolean;
  hasScreenChange?: () => boolean;
};

/** One tab's standing record: the one surface and the identity of the last tree it drew. */
type Seat = {
  tab: string;
  /* THE VISIT THIS PAGE WAS BUILT FOR. A press of Tools — the tab or a card — increments it, and a
     page whose visit is not the current one is disposed even when the tab is the same. */
  visit: number;
  host: HTMLDivElement;
  renderer: SurfaceRenderer;
  /** THE IDENTITY OF THE TREE LAST DRAWN. Unchanged means the drawn surface still stands. */
  drawnKey: string;
  /* WHETHER THIS PAGE'S CHAT HAS BEEN GIVEN ITS VISIT AND ASKED FOR ITS CONVERSATION. One read
     per page: a later report, tree change or rail press must not re-open the thread under the
     person. */
  chatStarted: boolean;
};

/** WHICH ELEMENT THIS TAB'S CHAT IS, by the tag the registry resolves to. */
const CHAT_TAG_BY_TAB: Record<string, string> = {
  chat: 'design2-chat',
  tools: 'design2-tools-chat',
  ux: 'design2-ux-chat',
  approvals: 'design2-chat',
  executions: 'design2-chat',
  settings: 'design2-chat',
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
  const { frame, surfaceId, allowed, error, coverDown, setError, upsertCard, removeCard } = useDesignConsole();
  const [railTab, setRailTab] = useState("chat");
  /*
   * THE SEAT'S OWN TAG TABLE, LOADED BEFORE THE FIRST DRAW. The shell's renderer resolves a
   * component name through the chosen system's `registry.json` (`resolveTag`, step 5), and that
   * table is the seat's — it lives in `design_A2UI/surface-design/` and the server serves it at
   * `/api/catalog/surface-design/registry`. Drawing before it arrives would refuse every seat name
   * as unknown, so the surface waits for one fetch and says so if the fetch fails.
   */
  const [registryReady, setRegistryReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void loadSurfaceRegistry()
      .then(() => { if (!cancelled) setRegistryReady(true); })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(`The seat's own registry could not be read: ${(err as Error)?.message ?? String(err)}`);
        }
      });
    return () => { cancelled = true; };
  }, [setError]);
  /* THE UX CARD BEING REOPENED. Empty means the tab's working row: the last UX conversation a
     person left, which is the default the UX seat loads on a fresh press. */
  const [uxOpenSession, setUxOpenSession] = useState("");

  /*
   * THE APPROVE TAB'S TURNS, HYDRATED BY THE SURFACE (owner's ruling, 2026-11-16).
   *
   * Its seat owns no conversation state: it renders `/surface/turns`. The surface reads the tab's
   * own conversation from the record and states the turns here, before the draw, so the thread and
   * the record cannot disagree. A failed read is stated, never drawn as an empty thread.
   */
  const [approvalTurns, setApprovalTurns] = useState<Array<{ role?: string; content?: string }> | null>(null);
  const [approvalTurnsFor, setApprovalTurnsFor] = useState("");

  /* THE ROOM TELLS THE SHELL WHEN ITS SCREEN IS BUILT: the cover is down and the design console
     is readable. The shell's copy of this ring leaves on this message. */
  useEffect(() => {
    if (!coverDown) return;
    window.dispatchEvent(new CustomEvent("room-ready", { detail: { room: DESIGN2_TAB.id } }));
  }, [coverDown]);

  /** Where the page stands. One page fills it, absolutely. */
  const stageRef = useRef<HTMLDivElement | null>(null);
  /**
   * THE SURFACE THAT STANDS — ONE RENDERER, ONE TREE. A tab press changes the tree's children
   * through the data model; the frame and the renderer are the same elements before and after.
   * The record it reads is the server's, not this page's.
   */
  const pageRef = useRef<Seat | null>(null);
  /** THE ONE RENDERER. The frame, the left column and the chat are its children. */
  const rendererRef = useRef<SurfaceRenderer | null>(null);
  /* THE CHATS THAT ALREADY ANSWER THEIR OWN RAIL. One listener per drawn chat element. */
  const chatWiredRef = useRef<WeakSet<HTMLElement>>(new WeakSet());
  /** A PATH THE RENDERER COULD NOT RESOLVE — shown in the room, not swallowed. */
  const [validationError, setValidationError] = useState("");

  useDesignRowSelection(rendererRef);

  /** THIS TAB'S CHAT, WHEREVER THE TREE DREW IT. */
  const chatFor = useCallback((tab: string): SeatChat | null => {
    const tag = CHAT_TAG_BY_TAB[tab];
    const root = rendererRef.current?.shadowRoot;
    return tag && root ? ((root.querySelector(tag) as SeatChat | null) ?? null) : null;
  }, []);

  const onValidationFailed = useCallback((event: Event) => {
    const detail =
      (event as CustomEvent<{ code?: string; componentId?: string; path?: string }>).detail;
    setValidationError(
      `${detail?.code ?? "VALIDATION_FAILED"} — ${detail?.path ?? "a path"} in `
      + `${detail?.componentId ?? "a component"} did not resolve.`,
    );
  }, []);

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
        const chat = chatFor("tools");
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

  /**
   * THE UX SESSION'S SAVE — its own route and its own card. The footer is the room's furniture;
   * the function behind it is this tab's: the session row (with its PostHog pointer) becomes the
   * card the console lists, and no conversation text is copied.
   */
  const saveUxSession = useCallback(async () => {
    const seat = pageRef.current;
    if (!seat || seat.tab !== "ux") return;
    const chat = chatFor("ux");
    const footer = rendererRef.current?.shadowRoot?.querySelector("design2-left-footer") as
      | (HTMLElement & { busy?: boolean; result?: string })
      | null;
    const sessionId = String(chat?.sessionId || "");
    if (!sessionId) {
      if (footer) footer.result = "This tab has no session yet.";
      return;
    }
    if (footer) {
      footer.busy = true;
      footer.result = "";
    }
    try {
      const response = await apiFetch(`${API_BASE}/ux/session/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          conversation_id: String(chat?.conversationId || "") || undefined,
        }),
      });
      const answer = await response.json().catch(() => null);
      if (!response.ok) throw new Error(answer?.error || `the server answered ${response.status}`);
      /*
       * THE CARD JOINS THE CONSOLE NOW, IN THE CONSOLE'S OWN SHAPE. The save's answer names the
       * session; the card itself comes from the same single-card read the Tools save uses, so
       * the grid is not rebuilt and the card's surface marker is the record's, not this page's.
       */
      let cardNote = "";
      try {
        const cardResponse = await apiFetch(
          `${API_BASE}/design/cards/${encodeURIComponent(sessionId)}`,
        );
        const cardAnswer = (await cardResponse.json().catch(() => null)) as
          | { card?: Record<string, any> }
          | null;
        if (cardResponse.ok && cardAnswer?.card?.id) {
          window.dispatchEvent(
            new CustomEvent("design-card-saved", { detail: { card: cardAnswer.card } }),
          );
        } else {
          cardNote = cardResponse.ok
            ? "the card read returned no card"
            : `the card read answered ${cardResponse.status}`;
        }
      } catch (cardError) {
        cardNote = (cardError as Error).message;
      }
      if (footer) {
        footer.result = cardNote
          ? `Saved — the card will appear when the console is read again (${cardNote}).`
          : "Saved — the card is on the Console.";
      }
    } catch (error) {
      if (footer) footer.result = `The save failed: ${(error as Error).message}`;
    } finally {
      if (footer) footer.busy = false;
    }
  }, []);

  useEffect(() => {
    const onSave = () => {
      if (railTabRef.current === "ux") void saveUxSession();
    };
    window.addEventListener("design-left-save", onSave);
    return () => window.removeEventListener("design-left-save", onSave);
  }, [saveUxSession]);

  const onTabChange = useCallback(async (event: Event) => {
    const tab = String((event as CustomEvent<{ tab?: string }>)?.detail?.tab || "");
    if (!tab) return;
    /* THE RAIL ONLY. The top navigation's own `tab-change` is not a rail press and must not
       move the room's rail; only this room's items are answered here. */
    if (!RAIL_TABS.has(tab)) return;

    /*
     * A PRESS OF THE TAB THAT ALREADY STANDS IS NOT A NAVIGATION. It is the rail's own
     * expand/collapse: the navigation bar has already opened or closed the column. Treating it
     * as a navigation created a new Tools session on that click and removed the click's expand.
     * A new session belongs to a press that arrives from a different tab.
     */
    if (tab === railTabRef.current) return;

    /* A SAVED UX CARD IS OPENED BY ITS CARD, ONCE. Leaving the UX tab ends that look at the
       saved session; the next press is the tab's working row again, not the card. */
    if (railTabRef.current === UX_TAB && tab !== UX_TAB) {
      setUxOpenSession("");
    }

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
        const chat = chatFor("tools");
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
      const chat = chatFor("tools");
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
       * A KEPT UX SESSION OPENS THE UX TAB AT THAT SESSION. The card's surface is the record's
       * own marker (the UX save writes it); the id is the prompt_sessions row whose
       * `posthog_conversation_id` the seat reads. Tools remains the destination for every other
       * kept session.
       */
      if (
        String(card?.surface ?? "") === UX_TAB
        || String(card?.category ?? "") === "UX"
      ) {
        setUxOpenSession(id);
        railTabRef.current = UX_TAB;
        setRailTab(UX_TAB);
        onTabRef.current?.(UX_TAB);
        return;
      }

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

  /* ── THE SURFACE IS KEPT; ONLY THE TAB'S OWN ROWS CHANGE ──────────────────────────────────── */
  const openSeat = useCallback((stage: HTMLElement, tab: string, visit: number): Seat => {
    const previous = pageRef.current;
    const kept = previous && previous.host.parentElement === stage ? previous : null;

    let host: HTMLDivElement;
    let renderer: SurfaceRenderer;
    if (kept) {
      host = kept.host;
      renderer = kept.renderer;
    } else {
      host = document.createElement("div");
      host.setAttribute("data-design-seat", "surface");
      host.style.cssText = "position:absolute;inset:0;display:block;min-width:0;min-height:0;";
      renderer = createSurfaceRenderer(surfaceId, tab);
      renderer.addEventListener("a2ui:validation-failed", onValidationFailed);
      host.appendChild(renderer);
      stage.appendChild(host);
      rendererRef.current = renderer;
    }

    const seat: Seat = {
      tab,
      visit,
      host,
      renderer,
      drawnKey: kept ? kept.drawnKey : "",
      chatStarted: false,
    };
    pageRef.current = seat;
    return seat;
  }, [surfaceId, onValidationFailed]);

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
        seat.renderer.shadowRoot?.querySelector("design2-workspace") ??
        seat.renderer.shadowRoot?.querySelector("tools-workspace")
      ) as (HTMLElement & { openChat?: () => void }) | null;
      layout?.openChat?.();
    };
    window.addEventListener("design-chat-open", onOpenChat);
    return () => window.removeEventListener("design-chat-open", onOpenChat);
  }, []);

  /*
   * ── THE APPROVE TAB'S TURNS, BEFORE ITS SEAT DRAWS ────────────────────────────────────────
   *
   * The surface owns this tab's conversation state. When the gate stands, its package's own
   * conversation is read from the record and stated at `/surface/turns`; the seat renders it and
   * owns nothing. A read that fails is stated in the room — an empty thread drawn over a failed
   * read would be a lie about the record.
   */
  useEffect(() => {
    const standing = toolsStanding ? TOOLS_TAB : railTab;
    if (standing !== APPROVALS_TAB) return;
    const packages = (((frame?.dataModel as Record<string, any>)?.console?.design_packages ?? {}) as Record<
      string,
      { conversationId?: string }
    >);
    const conversation = String(packages.approvals?.conversationId ?? "");
    if (!conversation || approvalTurnsFor === conversation) return;
    let cancelled = false;
    void readConversationTurns(conversation)
      .then((turns) => {
        if (cancelled) return;
        setApprovalTurns(turns);
        setApprovalTurnsFor(conversation);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError((e as Error)?.message ?? String(e));
      });
    return () => { cancelled = true; };
  }, [frame, railTab, toolsStanding, approvalTurnsFor, setError]);

  /* ── THE DRAW — the standing container, and only it ────────────────────────────────────── */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !frame || !registryReady || !surfaceId) return;

    const standing = toolsStanding ? TOOLS_TAB : railTab;
    const visit = standing === TOOLS_TAB ? Number(toolsVisit ?? 0) : 0;
    let seat = pageRef.current;
    if (!seat || seat.tab !== standing || seat.visit !== visit) {
      seat = openSeat(stage, standing, visit);
      /* NO PANE MOTION DURING A SWITCH. The page that appears sets its column and its width, and
         the workspace's 760ms transition animates both; the duration is off for the click's own
         frame and returns for every other change. */
      stage.style.setProperty("--pane-motion", "0ms");
      window.setTimeout(() => stage.style.removeProperty("--pane-motion"), 1200);
    }

    setValidationError("");
    const surfaceTree = buildSurfaceTree({
      tree: frame,
      isTools: standing === TOOLS_TAB,
      injected,
      surface: {
        tab: standing,
        sessionId: standing === UX_TAB ? uxOpenSession : undefined,
        /* THE GATE'S TURNS, AS THE SURFACE STATES THEM. Undefined on other tabs: they bind
           nothing there, and an absent value stays absent. */
        turns: standing === APPROVALS_TAB ? (approvalTurns ?? []) : undefined,
        /* THE TOOLS COLUMN'S TWO FACTS, ON THE DATA CHANNEL. The frame binds them; nothing reaches
           into the drawn element to set them. */
        leftLedgerText: standing === TOOLS_TAB && injected?.locked
          ? (injected.ledger?.text ?? "This card is locked in the Supervisor Queue.")
          : "",
        leftAssembling: standing === TOOLS_TAB && !injected,
      },
    });
    try {
      seat.drawnKey = drawSurface(seat.renderer, surfaceTree, seat.drawnKey, allowed);
    } catch (e) {
      console.error('[surface] refused', e);
      setError((e as Error).message);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await seat.renderer.updateComplete;
      } catch {
        // Lit's updateComplete does not reject; the query below still runs.
      }
      if (cancelled) return;

      /*
       * THE TAB'S CHAT IS THE TREE'S RIGHT CHILD — whichever chat the tree named for this tab.
       *
       * This asked `CHAT_TAG_BY_TAB[standing]`, and that table has no entry for Approve: the
       * Approve page draws the room's own chat (`design2-chat`) with the review list in its view
       * slot, so the shell looked for `undefined`, found nothing, and never attached the rail's
       * `tab-change` listener. Every press on that page was announced by the bar and heard by
       * nobody — the owner's report, 2026-11-16: *"once I select approved, I can't navigate the
       * tabs anymore."* The drawing decides which chat stands; the shell reads the drawing.
       */
      const chatTags = new Set(Object.values(CHAT_TAG_BY_TAB));
      const chatTag = CHAT_TAG_BY_TAB[standing];
      let chatEl: SeatChat | null = null;
      for (let attempt = 0; attempt < 40; attempt += 1) {
        const right = seat.renderer.shadowRoot?.querySelector('[slot="right"]') as HTMLElement | null;
        const tag = String(right?.tagName ?? '').toLowerCase();
        chatEl = right && chatTags.has(tag) ? (right as SeatChat) : null;
        if (chatEl) break;
        await new Promise((r) => setTimeout(r, 250));
        if (cancelled) return;
      }

      const workspace = seat.renderer.shadowRoot?.querySelector("design2-workspace") as
        | HTMLElement
        | null;
      if (!workspace) {
        setError(`The ${standing} container never drew its layout.`);
        return;
      }

      if (!chatEl) {
        setError(
          `The ${standing} container never drew its chat, so its conversation was not opened `
          + `(the right column holds ${String(seat.renderer.shadowRoot?.querySelector('[slot="right"]')?.tagName ?? 'nothing').toLowerCase()}).`,
        );
        return;
      }
      if (chatEl && !chatWiredRef.current.has(chatEl)) {
        /* THE RAIL'S PRESS ARRIVES AT THE CHAT IT WAS DRAWN IN. The window listener alone does
           not cross the renderer's shadow; the chat element is the boundary the old seat used. */
        chatEl.addEventListener("tab-change", onTabChangeRef.current);
        chatWiredRef.current.add(chatEl);
      }
      if (!chatEl || seat.chatStarted) return;
      seat.chatStarted = true;
      const ownSession = String(
        ((surfaceTree.dataModel as Record<string, any>)?.surface?.session_id) ?? "",
      );
      /* NO HOST WRITE TO A SEAT'S STATE (owner's ruling, 2026-11-16). The session reaches every
         seat through its `/surface/session_id` binding; assigning it here was a second writer of
         one fact, and the ruling closes it. The default-open is the seat's own act, asked for
         once per page, and only seats that implement it answer. */
      if (ownSession) chatEl.loadDefaultConversation?.();
    })();

    return () => {
      cancelled = true;
    };
  }, [frame, surfaceId, allowed, injected, toolsStanding, toolsVisit, railTab, uxOpenSession, approvalTurns, openSeat, setError, registryReady]);

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
      {validationError ? (
        <div
          role="status"
          style={{
            position: "absolute",
            left: 16,
            right: 16,
            bottom: 8,
            zIndex: 5,
            padding: "6px 10px",
            borderRadius: 6,
            background: "rgba(163, 21, 69, 0.92)",
            color: "#fff",
            font: "12px/1.4 system-ui, sans-serif",
            whiteSpace: "pre-wrap",
          }}
        >
          {validationError}
        </div>
      ) : null}
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
          backgroundImage: `url(${designSectionBackground})`,
          /* THE COVER IS OPAQUE BEFORE ITS IMAGE PAINTS. Without the base, the sheet's own
             image was the only paint here, so the shell's boot ground (the composer's purple
             waves) stood in the room's place until the image was decoded. */
          backgroundColor: DESIGN_SHEET_BASE,
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
