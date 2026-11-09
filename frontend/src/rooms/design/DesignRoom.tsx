/**
 * DesignRoom — THE DESIGN TAB'S OWN FILE: ONE INTERFACE, AND THE ENGINES THAT FEED IT.
 *
 * Owner, 2026-10-18: *"It's a navigation that runs down the middle of the page… that navigation
 * carries each tab's chat content — not a different chat, just what's loaded inside of it."* And:
 * *"column content is an injection point. It's an insert… you can't move to a whole new page."*
 *
 * SO THERE IS ONE INTERFACE (`DesignInterface`): the rail and the chat, assembled once and kept.
 * The console engine's surface is its host. The Figma engine is HEADLESS — it assembles its own
 * content and its own actions, and injects its left column and its conversation into that same
 * interface. Nothing here swaps a surface for another surface.
 */
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import DesignSeatShell from "@/rooms/design/DesignSeatShell";
/* THE TOOLS RAIL BELONGS TO THIS ROOM (2026-10-21). It used to be imported by the global
   registry, which rides the boot chunk — so `tools-tab` + `figma-layers-view` (55 kB, 1.08 s
   through the tunnel) were fetched before the console could paint, for a panel that only exists
   after this room opens. The registry no longer imports it; this room does. */
import "@/tools/ToolsTab";
/* THE DESIGN ROOM'S OWN FRAME (owner, 2026-10-25): the three-column layout as this room's own
   file, retagged `design-workspace`, so a change made for Design cannot reach another room's
   frame and another room's frame cannot reach Design's. */
import "@/rooms/design/design-workspace";
// THE TOOLS TAB'S OWN CONTAINER (owner, 2026-10-25): the chat's layout, for Tools only.
import "@/rooms/design/tools/tools-workspace";
// THE COLUMN FOOTER — the Composer bar's plate, empty (owner, 2026-10-25).
import "@/rooms/design/design-left-footer";
// THE UX APPLICATION'S FRAME LIVES IN THIS ROOM NOW (owner, 2026-10-25): its only consumer.
import "@/rooms/design/ux/ux-app-frame";
import type { Content } from "@/rooms/design/tools/content";
import { ToolsDecisionDialog, type ToolsDecision } from "@/rooms/design/tools/ToolsDecisionDialog";

/* THE FIGMA ENGINE IS ITS OWN PACKAGE, LOADED SEPARATELY — and it draws no surface of its own. */
const ToolsSeat = lazy(() => import("@/rooms/design/tools"));

export type DesignRoomProps = {
  /** The shell's global "an assembly is running" flag, handed to the engine that assembles. */
  onAssemblingChange?: (busy: boolean) => void;
};

export default function DesignRoom({ onAssemblingChange }: DesignRoomProps) {
  /** Is the Tools tab the standing one? Then the Figma content is what is injected. */
  const [toolsStanding, setToolsStanding] = useState(false);
  /** The Figma engine is mounted on first activation and kept — its content stays warm. */
  const [toolsOpened, setToolsOpened] = useState(false);
  /** What the headless Figma engine reported, ready to inject. */
  const [injected, setInjected] = useState<Content | null>(null);
  /** An element a design card asked to open — opened by the Figma engine once it has assembled. */
  const [openTag, setOpenTag] = useState<string | null>(null);
  /** A kept session a design card asked to reopen — the Tools tab then works in that row. */
  const [openSession, setOpenSession] = useState<string | null>(null);
  /**
   * THE TAB PRESS COUNT. Every press of the Tools tab is a new session, and a press whose session
   * id is already empty changes no other prop — the press itself has to reach the seat, or the
   * previous session stays on screen under a table that says a new one began.
   */
  const [toolsPress, setToolsPress] = useState(0);
  /**
   * THE DESIGN SYSTEM A CARD ASKED FOR (owner, 2026-11-02): *"the card should just open the tool
   * with the loaded DS, which this one is the default."* The card's key is the catalogue's own
   * name, and the seat builds the tab in that catalogue. Null means the tab's own default.
   */
  const [openSystem, setOpenSystem] = useState<string | null>(null);
  /**
   * THE QUESTION THE SEAT ASKS BEFORE A SAVE IT MUST NOT MAKE (owner, 2026-11-01). A preview is
   * ephemeral, so a save taken while one stands would file a card describing a drawing nobody can
   * open. The seat refuses and asks; this room draws the question, because the seat is headless.
   */
  const [saveDecision, setSaveDecision] = useState<ToolsDecision | null>(null);
  /**
   * THE TWO ANSWERS ABOUT A SESSION THE PERSON IS LEAVING (owner, 2026-11-07). Save makes it a
   * card; Discard removes the visit. There is no third answer that holds the visit for the next
   * press — a saved session is opened by its card. The shell asks and waits; this room draws the
   * question and answers through the promise the shell is holding.
   */
  const [leaveDecision, setLeaveDecision] = useState<ToolsDecision | null>(null);
  const leaveAnswerRef = useRef<((action: "save" | "discard") => void) | null>(null);

  /* THE RAIL IS THE NAVIGATION. It does not select a page; it selects what is injected. */
  const onTab = useCallback((tab: string) => {
    if (tab === "tools") {
      setToolsOpened(true);
      setToolsStanding(true);
    } else {
      setToolsStanding(false);
      /* LEAVING TOOLS PUTS ITS PAGE AWAY. Its content belongs to the visit that is ending; a
         tool's answer arriving after this must not be stored for the next page. */
      setInjected(null);
    }
  }, []);

  /* THE CONTENT REPORT IS ONLY FOR THE PAGE THAT STANDS. A read that was in flight when the
     visit ended must not land on another tab's page. */
  const toolsStandingRef = useRef(false);
  toolsStandingRef.current = toolsStanding;
  const onContent = useCallback((content: Content) => {
    if (!toolsStandingRef.current) return;
    setInjected(content);
  }, []);

  /* The shell asks for the Figma content (a card click) or for the console (the Design button). */
  useEffect(() => {
    const onTools = (event: Event) => {
      const detail = (event as CustomEvent<{ openTag?: string; openSession?: string; openSystem?: string; title?: string }>)?.detail ?? {};
      const tag = String(detail.openTag ?? "");
      const session = String(detail.openSession ?? "");
      const system = String(detail.openSystem ?? "");
      setToolsOpened(true);
      /* THE PRESS OPENS A NEW PAGE. Its content is read by the page itself, so the previous
         visit's content is cleared here: the new page starts on its own answer and never draws
         the session that was left. */
      setInjected(null);
      setToolsStanding(true);
      setToolsPress((n) => n + 1);
      setOpenSession(session || null);
      setOpenSystem(system || null);
      setOpenTag(tag || null);
    };
    const onConsole = () => {
      setToolsStanding(false);
      setInjected(null);
      setOpenTag(null);
      setOpenSession(null);
      setOpenSystem(null);
    };
    window.addEventListener("design-tools-open", onTools);
    window.addEventListener("design-console-open", onConsole);
    return () => {
      window.removeEventListener("design-tools-open", onTools);
      window.removeEventListener("design-console-open", onConsole);
    };
  }, []);

  /*
   * THE SEAT'S QUESTION, DRAWN HERE. The seat renders nothing when it is headless, so it sends the
   * words and the actions; this room shows them and sends the answer back. One listener each way —
   * the same shape as the room's own save question (`design-save-ask` / `design-left-save`).
   */
  useEffect(() => {
    const onAsk = (event: Event) => {
      const detail =
        (event as CustomEvent<{ message?: string; actions?: ToolsDecision["actions"] }>).detail ?? {};
      if (!Array.isArray(detail.actions) || detail.actions.length === 0) return;
      setSaveDecision({ message: String(detail.message ?? ""), actions: detail.actions });
    };
    window.addEventListener("design-save-decision", onAsk);
    return () => window.removeEventListener("design-save-decision", onAsk);
  }, []);

  const onSaveDecision = useCallback((actionId: string) => {
    setSaveDecision(null);
    window.dispatchEvent(new CustomEvent("design-save-decision-answer", { detail: { action: actionId } }));
  }, []);

  useEffect(() => {
    const onLeave = (event: Event) => {
      const detail = (event as CustomEvent<{
        message?: string;
        actions?: ToolsDecision["actions"];
        handled?: boolean;
        resolve?: (action: "save" | "discard") => void;
      }>).detail;
      if (!detail?.resolve) return;
      detail.handled = true;
      leaveAnswerRef.current = detail.resolve;
      setLeaveDecision({
        message: String(detail.message ?? ""),
        actions:
          Array.isArray(detail.actions) && detail.actions.length
            ? detail.actions
            : [
                { id: "save", label: "Save", variant: "primary" },
                { id: "discard", label: "Discard", variant: "destructive" },
              ],
      });
    };
    window.addEventListener("design-leave-question", onLeave);
    return () => window.removeEventListener("design-leave-question", onLeave);
  }, []);

  /*
   * THE QUESTION COULD NOT BE DRAWN, AND NOTHING WAS DELETED. The shell used to answer Accept on
   * its own and then treat that as Discard; this path states the truth and asks only for a Close.
   */
  useEffect(() => {
    const onUnanswered = (event: Event) => {
      const detail = (event as CustomEvent<{ message?: string }>).detail ?? {};
      leaveAnswerRef.current = null;
      setLeaveDecision({
        message: String(detail.message ?? "The session question could not be drawn."),
        actions: [{ id: "close", label: "Close", variant: "plain" }],
      });
    };
    window.addEventListener("design-leave-unanswered", onUnanswered);
    return () => window.removeEventListener("design-leave-unanswered", onUnanswered);
  }, []);

  const onLeaveDecision = useCallback((actionId: string) => {
    const answer = leaveAnswerRef.current;
    leaveAnswerRef.current = null;
    setLeaveDecision(null);
    if (actionId === "save" || actionId === "discard") answer?.(actionId);
  }, []);

  return (
    <>
      <DesignSeatShell
        injected={injected}
        toolsStanding={toolsStanding}
        toolsVisit={toolsPress}
        onTab={onTab}
      />
      {toolsOpened ? (
        <Suspense fallback={null}>
          <ToolsSeat
            headless
            active={toolsStanding}
            onContent={onContent}
            onAssemblingChange={onAssemblingChange}
            openTag={openTag}
            openSession={openSession}
            openSystem={openSystem}
            press={toolsPress}
          />
        </Suspense>
      ) : null}
      <ToolsDecisionDialog decision={saveDecision} onAction={onSaveDecision} />
      <ToolsDecisionDialog decision={leaveDecision} onAction={onLeaveDecision} />
    </>
  );
}
