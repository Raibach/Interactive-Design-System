// THE APP'S COMPONENT REGISTRATIONS — every tag the surface can name, defined before any
// surface assembles. It rides with this page, not with the entry, so the sign-in gate never
// waits for forty elements it cannot draw yet (2026-10-02; the rule it protects — a tag
// nothing defines draws nothing — is documented in components/lit/register.ts).
import "@/components/lit/register";
import { useState, useRef, useEffect, useCallback } from "react";
import { useParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { UI_ID } from "@/utils/uiIdentifiers";
import LeftVerticalMenu from "@/components/LeftVerticalMenu";
import GovernanceNav from "@/components/navigation/GovernanceNav";
import LeftColumnHeader from "@/components/LeftColumnHeader";
import { useNotificationGate } from "@/hooks/useNotificationGate";
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";

import { warmLabGrounds } from "@/canvas/pageHelpers";
import { ProductBox } from "@/rooms/product/ProductBox";
import { ConsoleBox } from "@/rooms/console/ConsoleBox";
import { DesignBox } from "@/rooms/design/DesignBox";
import { ComposerBox } from "@/rooms/composer/ComposerBox";
import { GovernanceBox } from "@/rooms/governance/GovernanceBox";
import type { ProductOpenAction } from "@/rooms/product/productSurface";
import { useAssembleSurface } from "@/console/useAssembleSurface";
// THE DEVELOPMENT ROOM IS A BOX TOO (2026-10-24) — the Product room's architecture applied
// to this one: the shell mounts <DevelopmentBox /> and nothing else for it.
import { DevelopmentBox } from "@/rooms/development/DevelopmentBox";
import { uxCapture } from "@/shared/uxCapture";
import { AI_STANDBY_MESSAGE, ASSEMBLY_TIMEOUT_MS } from "@/shared/assembly";
import { markArrival } from "@/shared/arrival";
import type { FailureReport } from "@/shared/error-registry";

/*
 * THE SHELL DRAWS EACH ROOM'S WAIT (owner, 2026-10-25). Each spinner below is a copy of the one
 * that room draws inside its own folder: the same 26px ring, the same track, and the same
 * sentence where the room has one. The copy lives here so it is on the page the instant a tab
 * is pressed — nothing is fetched and nothing is imported. Development's folder draws no wait of
 * its own, so the shell gives it the amber ring and the sentence the other rooms wear.
 * THE DESIGN ROOM'S WAIT MOVED HERE
 * TOO (owner, 2026-10-25): the ring stands the instant the tab is pressed, over the sheet the
 * room's cover already paints, and the cover — drawing no ring of its own — dissolves when the
 * room's program lands. THE GOVERNANCE ROOM'S WAIT MOVED HERE AS WELL (owner, 2026-10-25): the
 * room's file arrives after the press, and a bare ground stood until it did; the shell's ring
 * covers that stretch, and the room keeps only its ease-in, drawing no ring of its own. THE ONE
 * ROOM THAT KEEPS ITS OWN WAIT draws no shell copy: the Console (its first-entry wait is the
 * pin gate, and the room's own ring answers the return visits).
 */
type RoomSpinner = {
  ringBorder: string;
  ringColor: string;
  sentence?: string;
  sentenceColor?: string;
};

const ROOM_SPINNERS: Record<string, RoomSpinner> = {
  composer: {
    ringBorder: '3px solid rgba(240, 179, 35, 0.25)',
    ringColor: 'rgb(240, 179, 35)',
    sentence: 'Assembling A2UI surface for Composer\u2026',
    sentenceColor: '#c9c9c9',
  },
  design: {
    ringBorder: '3px solid rgba(240, 179, 35, 0.25)',
    ringColor: 'rgb(240, 179, 35)',
    sentence: 'Standing up the design workspace\u2026',
    sentenceColor: '#582846',
  },
  product: {
    ringBorder: '3px solid rgba(240, 179, 35, 0.25)',
    ringColor: 'rgb(240, 179, 35)',
    sentence: 'Loading the product application\u2026',
    sentenceColor: '#c9c9c9',
  },
  development: {
    ringBorder: '3px solid rgba(240, 179, 35, 0.25)',
    ringColor: 'rgb(240, 179, 35)',
    sentence: 'Loading the development application\u2026',
    sentenceColor: '#c9c9c9',
  },
  governance: {
    ringBorder: '3px solid rgba(240, 179, 35, 0.25)',
    ringColor: 'rgb(240, 179, 35)',
    sentence: 'Loading the governance application\u2026',
    sentenceColor: '#c9c9c9',
  },
};

interface WritingAreaIndexProps {
  onLogout?: () => void;
  isAuthenticated?: boolean | null;
}

export default function Index(_props: WritingAreaIndexProps) {
  const { toast } = useToast();
  const { id: routeSessionId } = useParams<{ id: string }>();
  const {
    headerTab,
    setHeaderTab,
    handleHeaderTabChange,
  } = useNotificationGate({ initialTab: routeSessionId ? "composer" : "console" });
  /*
   * THE TAB AS IT STANDS THIS INSTANT, for work that lands seconds after the click that asked
   * for it (owner, 2026-10-21: *"stop the snap back"*). MEASURED on a cold session: the boot
   * console assembly was still in flight when the click landed on Product; the tab moved, and
   * the landing — arriving later — wrote `console` back over it. A render-synced ref is the
   * only honest read: `headerTab` in a closure is the value from when the request was made.
   */
  const headerTabRef = useRef(headerTab);
  headerTabRef.current = headerTab;

  /*
   * THE ROOMS OWN THEMSELVES. The shell keeps the requests that move a person between them and
   * the boundary facts a room must publish: whether the Composer is holding unsaved work, which
   * package it has open, and the Console's tree writer.
   */
  const [pendingProductAction, setPendingProductAction] = useState<ProductOpenAction | null>(null);
  const [pendingComposerIntent, setPendingComposerIntent] = useState<{
    intent: string;
    context?: Record<string, unknown>;
  } | null>(null);

  /* THE SHELL'S FIVE SPINNERS, AND THE ONE MESSAGE THAT ENDS EACH. A room sends `room-ready`
     when its screen is built; the shell's copy of that room's ring then fades away over 600ms
     and the room stands in its place. The guard makes the first message the only one for that
     entry. */
  const [readyRooms, setReadyRooms] = useState<Record<string, boolean>>({});
  const [fadingRooms, setFadingRooms] = useState<Record<string, boolean>>({});
  const roomReadyRef = useRef<Record<string, boolean>>({});
  useEffect(() => {
    const onRoomReady = (event: Event) => {
      const room = String(((event as CustomEvent).detail || {}).room || '');
      if (!room || roomReadyRef.current[room]) return;
      roomReadyRef.current[room] = true;
      setReadyRooms((prev) => ({ ...prev, [room]: true }));
      setFadingRooms((prev) => ({ ...prev, [room]: true }));
      window.setTimeout(() => {
        setFadingRooms((prev) => (prev[room] ? { ...prev, [room]: false } : prev));
      }, 600);
    };
    window.addEventListener('room-ready', onRoomReady);
    return () => window.removeEventListener('room-ready', onRoomReady);
  }, []);

  /* LEAVING A ROOM FORGETS ITS READINESS (owner, 2026-10-25). The rooms rebuild themselves on
     every entry — the Composer re-assembles, Development waits for its workspace again — so a
     room that reported ready once is not ready for its next visit. Every press draws the ring
     until the room reports its new build. */
  const prevHeaderTabRef = useRef(headerTab);
  useEffect(() => {
    const prev = prevHeaderTabRef.current;
    if (prev && prev !== headerTab) {
      roomReadyRef.current[prev] = false;
      setReadyRooms((r) => (r[prev] ? { ...r, [prev]: false } : r));
      setFadingRooms((r) => (r[prev] ? { ...r, [prev]: false } : r));
    }
    prevHeaderTabRef.current = headerTab;
  }, [headerTab]);

  /* THE COMPOSER'S TWO BOUNDARY FACTS. The Composer's room fills them; the shell reads them
     when a person leaves the tab (unsaved work) and when a surface event is recorded (the flow). */
  const composerUnsavedRef = useRef(false);
  const composerActivePackageRef = useRef<string | null>(null);

  /* The Console's boundary: its tree writer, and its card list for the card's own door. */
  const consoleTreeWriterRef = useRef<{ setConsoleTree: (updater: unknown) => void } | null>(null);
  const consoleCardsRef = useRef<any[] | null>(null);
  const writeConsoleTree = useCallback((next: unknown) => {
    consoleTreeWriterRef.current?.setConsoleTree(next);
  }, []);

  /* THE CONSOLE CARD'S ACTION IS ROUTED HERE, NOT WRITTEN INTO THE ROOM'S STATE. The card
     emits the protocol action; the shell decides which box owns it and mounts that box. */
  useEffect(() => {
    const onAction = (event: Event) => {
      const message = (event as CustomEvent).detail as ProductOpenAction | null;
      const action = message?.action;
      if (!action || action.name !== 'open_room' || action.context?.room !== 'product') return;
      setPendingProductAction(message);
      handleHeaderTabChange('product');
    };
    window.addEventListener('a2ui:action', onAction);
    return () => window.removeEventListener('a2ui:action', onAction);
  }, [handleHeaderTabChange]);

  /* A CARD OR A ROUTE ASKS THE COMPOSER TO OPEN A PACKAGE. The shell sets the tab and hands
     the room the intent; the room asks for the surface itself. */
  useEffect(() => {
    const onComposerOpen = (event: Event) => {
      const detail = (event as CustomEvent).detail as { sessionId?: string } | null;
      const sessionId = detail?.sessionId;
      if (!sessionId) return;
      setPendingComposerIntent({ intent: `render-session:${sessionId}` });
      handleHeaderTabChange('composer');
    };
    window.addEventListener('composer:open', onComposerOpen);
    return () => window.removeEventListener('composer:open', onComposerOpen);
  }, [handleHeaderTabChange]);

  // ── Request deduplication: abort previous request if new one comes in ──
  const consoleAssemblyControllerRef = useRef<AbortController | null>(null);
  const isConsoleAssemblyInFlightRef = useRef(false);

  // ═══════════════════════════════════════════════════════════════════════════════
  // AI ASSEMBLY LOADING — honest state, no theater.
  // One real spinner bound to the live request. One true sentence.
  // No scripted message rotation, no artificial minimum display time, no
  // withholding completed results.
  // ═══════════════════════════════════════════════════════════════════════════════
  // ── AI Assembly state ──
  // The header tabs are AI COMMANDS, not webpage links.
  // When user clicks Console, AI assembles the console surface.
  // If AI fails, the surface shows the failure — NO FAKE RENDERING.
  const [isAIAssembling, setIsAIAssembling] = useState(false);
  const [aiAssemblyMessage, setAiAssemblyMessage] = useState(AI_STANDBY_MESSAGE);
  const [aiAssemblyFailed, setAiAssemblyFailed] = useState(false); // STRICT: blocks rendering when true
  // The structured failure — read off the response, never inferred from a status number
  // alone. Rendered in the workspace slot whenever aiAssemblyFailed is true.
  const [aiAssemblyReport, setAiAssemblyReport] = useState<FailureReport | null>(null);
  // The ✕ acknowledges the HEADLINE. It deliberately does not clear the diagnostics: being
  // told a failure happened is not the same as the failure being resolved, and the pane
  // stays until a successful assembly replaces it.
  const [isFailureAcknowledged, setIsFailureAcknowledged] = useState(false);
  // Retry re-runs the assembly that actually failed, not a guess at one.
  const lastAssemblyIntentRef = useRef<string>('render-console');

  // THE GOVERNANCE ROOM IS ITS OWN BOX NOW (2026-10-24): its wave lives in
  // <GovernanceBox>; this flag marks the room for the left navigation switch.
  const isGovernanceView = (headerTab || '') === 'governance';
  const [governancePath, setGovernancePath] = useState('');
  const navigateGovernanceRef = useRef<((path: string) => void) | null>(null);

  const composerRendererRef = useRef<any>(null);

  /*
   * THE COMPOSER'S DEPENDENCIES ARE ITS OWN. The page's initial assembly is the CONSOLE's, so
   * every Composer setter below is empty and never called: the Composer room assembles its own
   * surface, in its own folder, when the tab is selected.
   */
  const emptyRef = useRef<any>(null);
  const neverUnsavedRef = useRef(false);
  const noop = useCallback(() => {}, []);
  const assembleSurfaceWithAI = useAssembleSurface({
    AI_STANDBY_MESSAGE,
    ASSEMBLY_TIMEOUT_MS,
    consoleAssemblyControllerRef,
    currentPromptSessionRef: emptyRef,
    hasUnsavedChangesRef: neverUnsavedRef,
    headerTabRef,
    isConsoleAssemblyInFlightRef,
    lastAssemblyIntentRef,
    repairAskRef: emptyRef,
    repairTitleRef: emptyRef,
    setAiAssemblyFailed,
    setAiAssemblyMessage,
    setAiAssemblyReport,
    setAiDecision: noop,
    setConsoleTree: writeConsoleTree,
    setCurrentPromptSession: noop,
    setHeaderTab,
    setIsAIAssembling,
    setIsFailureAcknowledged,
    setWorkspaceTree: noop,
  });

  /* A SURFACE EVENT IS RECORDED AGAINST THE PACKAGE IT SERVED — read through the boundary ref
     the Composer fills, at event time, because this listener is registered once. */
  useEffect(() => {
    const handleA2uiEvent = (event: Event) => {
      const { sourceId, component, type, payload } = ((event as CustomEvent).detail || {}) as {
        sourceId?: string; component?: string; type?: string; payload?: Record<string, unknown>;
      };
      const flow = composerActivePackageRef.current ?? undefined;
      switch (type) {
        case 'a2ui-action': {
          // WHAT IS RECORDED: the action's NAME, from the three shapes the primitive uses
          // (a string; {name}; the v0.9 {event:{name}}). Nothing else from the payload is sent —
          // a dimension carries a name or a number, never a person's words, and the door refuses
          // anything the vocabulary does not name rather than guessing.
          const actionValue = payload?.action as unknown;
          const actionName =
            typeof actionValue === 'string'
              ? actionValue
              : typeof (actionValue as { name?: unknown })?.name === 'string'
                ? String((actionValue as { name: string }).name)
                : typeof (actionValue as { event?: { name?: unknown } })?.event?.name === 'string'
                  ? String((actionValue as { event: { name: string } }).event.name)
                  : '';
          uxCapture('action', component || '', actionName ? { action: actionName } : {}, {
            instanceId: sourceId,
            surface: typeof payload?.surfaceId === 'string' ? payload.surfaceId : undefined,
            flow,
          });
          // The generic action channel A2UISurfaceContainer already uses.
          window.dispatchEvent(new CustomEvent('a2ui:action', { detail: { ...payload, sourceId } }));
          break;
        }
        case 'message-sent': {
          // THE TEXT IS DELIBERATELY NOT READ. The vocabulary has no text dimension — message
          // content is a person's words — so only the optional `kind` (an enum/name) travels.
          const kind = typeof payload?.kind === 'string' ? payload.kind : '';
          uxCapture('message_sent', component || '', kind ? { kind } : {}, {
            instanceId: sourceId,
            flow,
          });
          // The user spoke through the surface. Distinct from a2ui:system-message,
          // which carries Grace's words in the other direction — the two must not
          // share a channel or her reply would echo back as input.
          window.dispatchEvent(new CustomEvent('a2ui:user-message', { detail: { ...payload, sourceId } }));
          break;
        }
        case 'command-received': {
          const command = typeof payload?.command === 'string' ? payload.command : '';
          uxCapture('command_received', component || '', command ? { command } : {}, {
            instanceId: sourceId,
            flow,
          });
          // A rendered command IS a console command.
          window.dispatchEvent(new CustomEvent('a2ui:console-command', { detail: { ...payload, sourceId } }));
          break;
        }
        default:
          console.warn(`[a2ui] surface event "${type}" from ${sourceId} has no listener mapping.`);
      }
    };
    window.addEventListener('a2ui-event', handleA2uiEvent);
    return () => window.removeEventListener('a2ui-event', handleA2uiEvent);
  }, []);

  /**
   * A PACKAGE IS OPENED FROM A CARD OR A ROUTE. The request says WHICH package; the Composer
   * room performs the assembly, the announcement and the repair reset. This is the one door the
   * Governance room and the URL still use.
   */
  const handleOpenPromptFromConsole = useCallback((sessionId: string) => {
    if (!sessionId) return;
    window.dispatchEvent(new CustomEvent('composer:open', { detail: { sessionId } }));
  }, []);

  /**
   * THE ROOM GROUNDS WARM HERE — ONCE THE WORKSPACE HAS LANDED.
   */
  useEffect(() => {
    warmLabGrounds();
  }, []);

  useEffect(() => {
    if (routeSessionId) {
      handleOpenPromptFromConsole(routeSessionId);
    }
  }, [routeSessionId, handleOpenPromptFromConsole]);

  /**
   * THE TAB SWITCH, WITHOUT A GATE (2026-10-24).
   *
   * Every room owns its entry now. The shell changes the header tab and lets the room mount; the
   * room's own cover, assembly and seat are its gate. The Composer is asked for a blank surface;
   * the room states the unsaved work it is leaving.
   */
  const handleTabChange = useCallback(async (tabId: string | null) => {
    if (!tabId) return;
    if (tabId === 'composer') {
      setPendingComposerIntent({ intent: 'render-composer' });
      handleHeaderTabChange('composer');
      return;
    }
    handleHeaderTabChange(tabId);
  }, [handleHeaderTabChange]);

  // The chat rail's mark navigates back to the console — the same
  // path the Console header tab uses.
  useEffect(() => {
    const onNavigateConsole = () => { void handleTabChange('console'); };
    window.addEventListener('navigate-console', onNavigateConsole);
    return () => window.removeEventListener('navigate-console', onNavigateConsole);
  }, [handleTabChange]);

  /*
   * THE DRAWER'S HAND-OVER (2026-10-03). The mobile drawer receives `currentTab` and no switch
   * callback, so a tab a person can actually open hands over through an event — the same device
   * `navigate-console` already is. This routes it through the SAME tab handler every header click uses,
   * so the drawer can never become a second way into a room.
   */
  useEffect(() => {
    const onNavigateTab = (event: Event) => {
      const tabId = String(((event as CustomEvent).detail || {}).tabId || '');
      if (!tabId) return;
      void handleTabChange(tabId);
    };
    window.addEventListener('navigate-tab', onNavigateTab);
    return () => window.removeEventListener('navigate-tab', onNavigateTab);
  }, [handleTabChange]);

  /* THE CONSOLE ASKS FOR A BLANK COMPOSER (2026-10-24). The Console owns the request; the
     shell owns the tab change. The Composer room assembles the blank surface. */
  useEffect(() => {
    const onCreate = () => { void handleTabChange('composer'); };
    window.addEventListener('composer:create', onCreate);
    return () => window.removeEventListener('composer:create', onCreate);
  }, [handleTabChange]);

  /* THE SEAT'S TWO NAVIGATION BUTTONS. The action bar dispatches these; the shell answers,
     because moving between rooms is navigation and no room owns it. */
  useEffect(() => {
    const onOpenConsole = () => { void handleTabChange('console'); };
    const onOpenComposer = () => { void handleTabChange('composer'); };
    window.addEventListener('open-console', onOpenConsole);
    window.addEventListener('loads-cards-form-console-in-prompt-area', onOpenComposer);
    return () => {
      window.removeEventListener('open-console', onOpenConsole);
      window.removeEventListener('loads-cards-form-console-in-prompt-area', onOpenComposer);
    };
  }, [handleTabChange]);

  /* A REPAIR PRESSED ON ANOTHER ROOM'S SEAT IS A REQUEST TO OPEN THE COMPOSER. The finding is
     the Composer's work; the room it was pressed in only knows the finding's id. */
  useEffect(() => {
    const onRepair = (event: Event) => {
      const findingId = String(((event as CustomEvent).detail || {}).findingId || '');
      if (!findingId) return;
      setPendingComposerIntent({ intent: `repair:${findingId}` });
      handleHeaderTabChange('composer');
    };
    window.addEventListener('repair-finding', onRepair);
    return () => window.removeEventListener('repair-finding', onRepair);
  }, [handleHeaderTabChange]);

  /* THE SHELL OWNS THE INITIAL PAGE'S ASSEMBLY; the Console room owns every later entry. The
     ref is false during the first render, so the Console box does not ask a second time. */
  const initialMountHandledRef = useRef(false);

  // ══════════════════════════════════════════════════════════════════════════
  // A2UI v0.9: INITIAL MOUNT - AI ALWAYS ASSEMBLES THE INITIAL SURFACE
  // The front page IS the console. A package in the URL is opened by the Composer room.
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    initialMountHandledRef.current = true;
    if (routeSessionId) return;
    if (headerTab !== 'console') {
      setHeaderTab('console');
    }
    /*
     * A LOAD IS AN ARRIVAL, AND IT SAYS SO. The Console room announces its own entries; this is
     * the page-load one, before that room has mounted.
     */
    markArrival('console');
    window.dispatchEvent(new CustomEvent('a2ui:composer-opened', { detail: { kind: 'console' } }));
    void assembleSurfaceWithAI('render-console');
  }, []); // Empty deps = run only on mount

  // ══════════════════════════════════════════════════════════════════════
  // A2UI: Shell ALWAYS renders. Loading/error states render INSIDE surfaces.
  // ══════════════════════════════════════════════════════════════════════

  /* THE WAIT, AS THE PERSON SEES IT: the pressed tab's own ring, already on the page, until
     that room sends `room-ready`. It stays mounted for the 600ms fade, then it is gone. */
  const roomSpinner = ROOM_SPINNERS[headerTab];
  const spinnerFading = !!roomSpinner && !!readyRooms[headerTab];
  const spinnerShowing = !!roomSpinner && (!readyRooms[headerTab] || !!fadingRooms[headerTab]);

  return (
    <div
      {...UI_ID.LAYOUT.MAIN_CONTAINER}
      className="h-screen flex flex-row overflow-hidden"
    >
      {/* NO VIEWPORT-WIDTH WARNING (owner, 2026-10-18): "We don't need to give him a
          message. He should show the card. It should just be covered." A narrow window
          clips the content it cannot fit; it never covers the room with a notice. */}

      {/* Left column nav — THE SAME PAGE-LEVEL PATTERN EVERY SECTION USES: the
          shell rail on every tab, and the Governance room's own isolated nav on
          Governance. Both are width-0 overlays in this flex row at the page's
          top-left, which is what keeps their header control (the logo) in the
          header band — never under it. */}
      {isGovernanceView ? (
        <GovernanceNav
          onNavigate={(path) => navigateGovernanceRef.current?.(path)}
          activePath={governancePath}
        />
      ) : (
        <LeftVerticalMenu
          onNewChat={() => window.dispatchEvent(new CustomEvent("new-chat"))}
          currentTab={headerTab}
        />
      )}

      {/* Main content area — flex column that takes remaining height after header.
          Uses flex-1 + min-h-0 so the operator shell row below the header can grow
          to fill the viewport. No more vh calc hacks. */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden"
      >
        {/* ── HEADER FRAME — spans full width above all columns ──
            ROW 1 ONLY. What stays is navigation, which is the shell's own job. */}
        <LeftColumnHeader
          activeTab={headerTab}
          onTabChange={handleTabChange}
        />

        {/* ── THE SURFACE HOST — the AI's surface, and the only thing here ── */}
        <div className="flex flex-row overflow-hidden flex-1 min-h-0" style={{ minWidth: 0, position: 'relative' }}>
            {/* ── AI SURFACE — Lit Shadow DOM sandbox for A2UI content rendering ── */}
            <SentryErrorBoundary
              scope="ai-surface"
              onError={(error) => {
                console.error("AI Surface error:", error.message);
                /* THE FAILURE IS THE ANSWER: the wait ends so the message is not covered. */
                setReadyRooms((prev) => (prev[headerTab] ? prev : { ...prev, [headerTab]: true }));
              }}
            >
              {headerTab === 'composer' && (
                /* THE COMPOSER'S FADE-IN (owner, 2026-10-25). While the application is loading,
                   the person sees the ground and the ring; when the room reports ready, the
                   room's own contents fade in over 600ms as the ring fades out. Composer only —
                   the other tabs keep their own wait until this one is accepted. */
                <div
                  data-room-fade="composer"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 40,
                    opacity: readyRooms['composer'] ? 1 : 0,
                    transition: 'opacity 600ms ease',
                    pointerEvents: readyRooms['composer'] ? undefined : 'none',
                  }}
                >
                  <ComposerBox
                    composerRendererRef={composerRendererRef}
                    pendingIntent={pendingComposerIntent}
                    onIntentConsumed={() => setPendingComposerIntent(null)}
                    shell={{
                      hasUnsavedChangesRef: composerUnsavedRef,
                      activePackageRef: composerActivePackageRef,
                      headerTab,
                      setHeaderTab,
                      headerTabRef,
                      toast,
                      assembleConsole: () => assembleSurfaceWithAI('render-console'),
                    }}
                  />
                </div>
              )}
            {/*
              THE PRODUCT BOX REPLACES THE SANDBOX (owner, 2026-10-23). The shared surface is
              not mounted while Product is selected, so no second chat, slot or spinner can
              stand behind the room.
            */}
            {headerTab === 'product' && (
              /* THE PRODUCT'S FADE-IN (owner, 2026-10-25): the Composer's process, applied to
                 this room. While the application loads, the person sees the ground and the
                 ring; when the room reports ready — the builder has painted its header — the
                 room fades in over 600ms as the ring fades out. The box's ground is the same
                 illustration the shell paints, so the ground never appears to change. */
              <div
                data-room-fade="product"
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 40,
                  opacity: readyRooms['product'] ? 1 : 0,
                  transition: 'opacity 600ms ease',
                  pointerEvents: readyRooms['product'] ? undefined : 'none',
                }}
              >
                <ProductBox
                  requestedAction={pendingProductAction}
                  onRequestConsumed={() => setPendingProductAction(null)}
                />
              </div>
            )}
            {headerTab === 'console' && (
              <ConsoleBox
                consoleTreeWriterRef={consoleTreeWriterRef}
                consoleCardsRef={consoleCardsRef}
                assembleOnEntry={initialMountHandledRef.current}
              />
            )}
            {/*
              THE DESIGN BOX REPLACES THE SANDBOX (2026-10-24). The room owns its sheet, its
              room root and its lazy room; the shell mounts one component and no design ground,
              renderer or tree.
            */}
            {headerTab === 'design' && <DesignBox />}
            {/*
              THE DEVELOPMENT BOX REPLACES THE SANDBOX (2026-10-24). The box owns the lab tile
              and the room; the key keeps React from recycling the node as the next room's box.
            */}
            {headerTab === 'development' && <DevelopmentBox key="development-box" />}
            {headerTab === 'governance' && (
              <GovernanceBox
                onOpenPrompt={handleOpenPromptFromConsole}
                onPathChange={setGovernancePath}
                navigateRef={navigateGovernanceRef}
                onBackToConsole={() => handleHeaderTabChange('console')}
              />
            )}
          </SentryErrorBoundary>

            {/* THE PRESSED TAB'S RING, OUTSIDE THE ROOM BOX. It is the room's own spinner
                copied into the shell, so it is drawn in the same frame as the tab press and
                nothing has to arrive first. The room sends `room-ready`; this copy fades over
                600ms and the room is left in its place. Grounds and backgrounds are the room
                boxes' own and are never covered by paint from here. */}
            {spinnerShowing && roomSpinner && (
              <div
                aria-hidden="true"
                data-room-spinner={headerTab}
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 45,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 16,
                  pointerEvents: 'none',
                  opacity: spinnerFading ? 0 : 1,
                  transition: 'opacity 600ms ease',
                }}
              >
                <div
                  className="animate-spin"
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '50%',
                    border: roomSpinner.ringBorder,
                    borderTopColor: roomSpinner.ringColor,
                  }}
                />
                {roomSpinner.sentence && (
                  <p
                    style={{
                      margin: 0,
                      color: roomSpinner.sentenceColor,
                      fontSize: 16,
                      fontWeight: 700,
                      fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
                    }}
                  >
                    {roomSpinner.sentence}
                  </p>
                )}
              </div>
            )}

        </div>
      </div>
    </div>
  );
}
