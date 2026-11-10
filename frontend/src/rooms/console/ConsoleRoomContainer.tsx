/**
 * <ConsoleRoomContainer> — THE CONSOLE ROOM OWNS ITS OWN SURFACE (owner, 2026-10-23).
 *
 * The room's own state, renderer, assembly and listeners live here: the tree the model assembled,
 * the renderer that draws it, the console's entry and re-assembly requests, its conversation-change
 * path, its trace, and its own ring. The shell mounts the box and hands over the two doors (open a
 * card, create a prompt) and the two boundary refs; it owns no assembly state for this room.
 *
 * THE INITIAL PAGE'S ASSEMBLY stays in the shell's mount effect; every tab entry is this room's
 * own. The room's long-lived writers (the shell's rename and delete paths) reach its tree through
 * `consoleTreeWriterRef`, the same ref-through-the-boundary pattern the Product room uses.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import '@/rooms/console/console-chat-panel';
import ConsolePage from '@/rooms/console/ConsolePage';
import { useConsoleRoomState } from '@/rooms/console/useConsoleRoomState';
import { useConsoleCardActions } from '@/rooms/console/useConsoleCardActions';
import { useAssembleSurface } from '@/console/useAssembleSurface';
import { markArrival } from '@/shared/arrival';
import { AI_STANDBY_MESSAGE, ASSEMBLY_TIMEOUT_MS } from '@/shared/assembly';
import type { FailureReport } from '@/shared/error-registry';
import { useRepairStages } from '@/shared/repairStages';
import { getStoredUserId } from '@/services/authService';
import { subscribeTrace, traceSnapshot } from '@/lib/trace-source';

export interface ConsoleRoomContainerProps {
  /** The boundary ref the shell's long-lived writers use to reach the room's tree. */
  consoleTreeWriterRef: { current: { setConsoleTree: (updater: unknown) => void } | null };
  /** The room's card list, handed through the boundary for the Console card's door. */
  consoleCardsRef: { current: any[] | null };
  /**
   * True when this mount is a tab entry. The initial page is assembled by the shell's mount
   * effect; arming the room on that mount would ask for the console twice.
   */
  assembleOnEntry?: boolean;
}

type ConsoleTree = { components: any[]; dataModel: Record<string, any> };

export function ConsoleRoomContainer({
  consoleTreeWriterRef,
  consoleCardsRef,
  assembleOnEntry = true,
}: ConsoleRoomContainerProps) {
  const { consoleTree, setConsoleTree, consoleRendererRef, assembledConsoleCards, assembledConsoleQuery } = useConsoleRoomState();
  const [repairStages] = useRepairStages();
  /* THE CONSOLE'S OWN CARD DOORS (2026-10-24): open, create and delete are the Console's.
     The shell is handed the request, never another room's handler. */
  const { openCard, createPrompt } = useConsoleCardActions({
    assembledConsoleCards,
    setConsoleTree: setConsoleTree as unknown as (updater: unknown) => void,
  });

  /* THE ROOM'S OWN ASSEMBLY STATE (2026-10-24). It used to arrive from the shell, which owned a
     single instance for the Composer and the Console together. A room that assembles its own
     surface owns the facts of that assembly: the request in flight, the sentence, the failure. */
  const [isAIAssembling, setIsAIAssembling] = useState(false);
  const [aiAssemblyMessage, setAiAssemblyMessage] = useState(AI_STANDBY_MESSAGE);
  const [aiAssemblyFailed, setAiAssemblyFailed] = useState(false);
  const [, setAiAssemblyReport] = useState<string | null>(null);
  const [, setIsFailureAcknowledged] = useState(false);

  /* The hook's contract, held here rather than in the shell. The refs the Composer fills are empty
     in this instance: a console assembly never creates a package, has no unsaved edits to guard,
     and no repair question to answer. The tab setter is a no-op so a late console landing can
     never move the person out of the room they chose. */
  const consoleAssemblyControllerRef = useRef<AbortController | null>(null);
  const isConsoleAssemblyInFlightRef = useRef(false);
  const lastAssemblyIntentRef = useRef<string | null>(null);
  const headerTabRef = useRef('console');
  const emptySessionRef = useRef<string | null>(null);
  const noUnsavedRef = useRef(false);
  const noRepairAskRef = useRef<{ text: string; buttons: string } | null>(null);
  const noRepairTitleRef = useRef<string | null>(null);
  const noop = () => {};

  const assembleSurfaceWithAI = useAssembleSurface({
    AI_STANDBY_MESSAGE,
    ASSEMBLY_TIMEOUT_MS,
    consoleAssemblyControllerRef,
    currentPromptSessionRef: emptySessionRef,
    hasUnsavedChangesRef: noUnsavedRef,
    headerTabRef,
    isConsoleAssemblyInFlightRef,
    lastAssemblyIntentRef,
    repairAskRef: noRepairAskRef,
    repairTitleRef: noRepairTitleRef,
    setAiAssemblyFailed,
    setAiAssemblyMessage,
    setAiAssemblyReport,
    setAiDecision: noop,
    setConsoleTree,
    setCurrentPromptSession: noop,
    setHeaderTab: noop,
    setIsAIAssembling,
    setIsFailureAcknowledged,
    setWorkspaceTree: noop,
  });

  /* The latest callback, without re-running the entry effect when its identity changes. */
  const assembleRef = useRef(assembleSurfaceWithAI);
  assembleRef.current = assembleSurfaceWithAI;
  /* The entry decision is taken at mount: the initial page's shell effect owns that assembly. */
  const entryOnMountRef = useRef(assembleOnEntry);

  /* THE ROOM'S CARD LIST, HANDED THROUGH THE BOUNDARY for the Console card's door. */
  useEffect(() => {
    consoleCardsRef.current = assembledConsoleCards;
    return () => {
      consoleCardsRef.current = null;
    };
  }, [consoleCardsRef, assembledConsoleCards]);

  /* THE ROOM'S TREE WRITER, HANDED THROUGH THE BOUNDARY for the shell's rename and delete paths. */
  useEffect(() => {
    consoleTreeWriterRef.current = { setConsoleTree: setConsoleTree as unknown as (updater: unknown) => void };
    return () => {
      consoleTreeWriterRef.current = null;
    };
  }, [consoleTreeWriterRef, setConsoleTree]);

  /* THE ROOM'S OWN ENTRY (owner, 2026-10-24): mounting the room is the arrival. The Console no
     longer waits for the shell's tab gate; it announces itself and asks for its own surface. The
     writer above is established first, so the shell's assembly can reach this room's tree. */
  useEffect(() => {
    if (!entryOnMountRef.current) return;
    markArrival('console');
    window.dispatchEvent(new CustomEvent('a2ui:composer-opened', { detail: { kind: 'console' } }));
    void assembleRef.current('render-console');
  }, []);

  /* THE RENDERER DRAWS THE ROOM'S TREE — the same properties the shell once assigned. */
  useEffect(() => {
    const el = consoleRendererRef.current;
    if (!el) return;
    el.components = consoleTree.components;
    el.dataModel = consoleTree.dataModel;
  }, [consoleTree, consoleRendererRef]);

  /* THE ROOM'S TRACE (2026-10-24). The shell used to write the trace into both trees; each room
     now subscribes to the same source and writes its own. */
  useEffect(() => {
    const merge = (prev: ConsoleTree, trace: unknown): ConsoleTree =>
      prev.dataModel.trace === trace
        ? prev
        : { ...prev, dataModel: { ...prev.dataModel, trace } };
    setConsoleTree((prev) => merge(prev as ConsoleTree, traceSnapshot()));
    return subscribeTrace((trace) => {
      setConsoleTree((prev) => merge(prev as ConsoleTree, trace));
    });
  }, [setConsoleTree]);

  /* THE ROOM PUBLISHES THE SHARED REPAIR STAGES INTO ITS OWN TREE. */
  useEffect(() => {
    setConsoleTree((prev) => {
      const repairs = prev.dataModel.repairs ?? {};
      const have = repairs.stages ?? {};
      const same = Object.keys(have).length === Object.keys(repairStages).length
        && Object.entries(repairStages).every(([id, stage]) => have[id] === stage);
      if (same) return prev;
      return {
        ...prev,
        dataModel: { ...prev.dataModel, repairs: { ...repairs, stages: repairStages } },
      };
    });
  }, [repairStages, setConsoleTree]);

  /* THE CONSOLE'S CONVERSATION-CHANGE PATH — the room's seat writes its own model path. */
  useEffect(() => {
    const onConversationChange = (event: Event) => {
      const detail = (event as CustomEvent<{ conversationId?: string | null; surface?: string }>).detail || {};
      if ((detail.surface ?? 'composer') !== 'console') return;
      const conversationId = detail.conversationId ?? null;
      const path = (event as CustomEvent).composedPath?.() ?? [];
      if (path.length && !path.includes(consoleRendererRef.current)) return;
      setConsoleTree((prev) => {
        const consoleModel = prev.dataModel.console ?? {};
        if ((consoleModel.conversation_id ?? null) === conversationId) return prev;
        return {
          ...prev,
          dataModel: { ...prev.dataModel, console: { ...consoleModel, conversation_id: conversationId } },
        };
      });
    };
    window.addEventListener('conversation-change', onConversationChange);
    return () => window.removeEventListener('conversation-change', onConversationChange);
  }, [consoleRendererRef, setConsoleTree]);

  /* THE RAIL'S TAB ASSEMBLES THE CARDS, NOT THE CHAT.
   *
   * A tab is a filter over the one library: Chat is the whole index, Tools is the tool work,
   * Approvals is the supervisor queue. Pressing one asks the assembly for THAT tab's card set
   * with `cards_only`, and this room writes the returned list and plan into the tree it already
   * holds. No `updateComponents` comes back, so the chat element, its conversation and its
   * thread are not replaced or reloaded — only the left column changes. Each tab's own
   * conversation is the seat's move, made in the same press.
   *
   * The request sequence is latched: a slow answer from the tab the person just left cannot
   * overwrite the tab they are on now. */
  const tabRequestRef = useRef(0);
  /*
   * ONE LOADER FOR BOTH KINDS OF LEFT-COLUMN CHANGE: a tab press (the tab's base set) and a
   * search the chat just ran (the same tab, narrowed). Both are cards-only assemblies; neither
   * touches the chat element. The sequence latch means a slow answer for the tab/search the
   * person just left cannot overwrite the one they are on now.
   */
  const loadConsoleCards = useCallback(async (
    tab: string,
    search?: { text?: string; sort?: string; turnId?: string; recordError?: string },
  ) => {
    const request = ++tabRequestRef.current;
    try {
      const response = await fetch('/api/ai/assemble-surface?limit=500', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({
          intent: 'render-console',
          context: {
            current_surface: 'console',
            console_tab: tab,
            cards_only: true,
            ...(String(search?.text || '').trim()
              ? {
                console_search: {
                  text: String(search?.text).trim(),
                  sort: search?.sort,
                  turnId: search?.turnId || '',
                  recordError: search?.recordError || '',
                },
              }
              : {}),
          },
        }),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as {
        cards?: unknown[]; query?: unknown; tab?: string;
      };
      if (!Array.isArray(body?.cards)) {
        throw new Error('the tab assembly returned no card list');
      }
      if (request !== tabRequestRef.current) return;
      setConsoleTree((prev) => ({
        ...prev,
        dataModel: {
          ...prev.dataModel,
          cards: body.cards,
          console: { ...prev.dataModel.console, query: body.query ?? null, tab: body.tab ?? tab },
        },
      }));
    } catch (err) {
      if (request !== tabRequestRef.current) return;
      const why = err instanceof Error ? err.message : String(err);
      const label = String(search?.text || '').trim() ? 'The search could not be run' : `The ${tab} cards could not be loaded`;
      setConsoleTree((prev) => ({
        ...prev,
        dataModel: {
          ...prev.dataModel,
          cards: [],
          console: {
            ...prev.dataModel.console,
            query: { error: `${label} — ${why}`, count: 0 },
            tab,
          },
        },
      }));
    }
  }, [setConsoleTree]);

  /* THE RAIL'S TAB ASSEMBLES THE CARDS, NOT THE CHAT.
   *
   * A tab is a filter over the one library: Chat is the whole index, Tools is the tool work,
   * Approvals is the supervisor queue. Pressing one asks the assembly for THAT tab's card set
   * with `cards_only`, and this room writes the returned list and plan into the tree it already
   * holds. No `updateComponents` comes back, so the chat element, its conversation and its
   * thread are not replaced or reloaded — only the left column changes. Each tab's own
   * conversation is the seat's move, made in the same press. */
  useEffect(() => {
    const onTabChange = (event: Event) => {
      const detail = (event as CustomEvent<{
        tab?: string; conversationId?: string; namespace?: string;
      }>).detail || {};
      const tab = String(detail.tab || '');
      if (!tab) return;
      /* THE RAIL'S RAW EVENT AND THE SEAT'S ENRICHED ONE BOTH REACH WINDOW. Only the seat's
         carries the conversation and namespace; acting on the raw one started a base load
         after the replay had already drawn, putting the base 8 back over the recorded set. */
      if (!Object.prototype.hasOwnProperty.call(detail, 'conversationId')) return;
      const path = (event as CustomEvent).composedPath?.() ?? [];
      if (path.length && !path.includes(consoleRendererRef.current)) return;
      const conversationId = String(detail.conversationId || '');
      const namespace = String(detail.namespace || (tab === 'chat' ? 'console' : tab));
      void (async () => {
        const request = ++tabRequestRef.current;
        /* THE CHAT TAB IS THE WHOLE LIBRARY, NOT A SAVED SEARCH. A Chat search records a set
           under `console` for the ordinal/audit, but pressing Chat must never replay that search
           in place of the library: the owner, 2026-11-10, "the chat tab ... represents every
           card every activity in the system." Tools and Approvals replay their recorded sets;
           Chat always asks for the base library. */
        if (tab === 'chat') {
          await loadConsoleCards('chat');
          return;
        }
        let replayError = '';
        if (conversationId && namespace) {
          try {
            const replay = await fetch('/api/console/replay', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
              body: JSON.stringify({ conversation_id: conversationId, namespace }),
            });
            if (request !== tabRequestRef.current) return;
            if (replay.ok) {
              const body = (await replay.json()) as {
                unrecorded?: boolean; cards?: unknown[]; query?: unknown;
              };
              if (!body.unrecorded && Array.isArray(body.cards)) {
                setConsoleTree((prev) => ({
                  ...prev,
                  dataModel: {
                    ...prev.dataModel,
                    cards: body.cards,
                    console: { ...prev.dataModel.console, query: body.query ?? null, tab },
                  },
                }));
                return;
              }
            } else {
              replayError = `HTTP ${replay.status}`;
            }
          } catch (err) {
            replayError = err instanceof Error ? err.message : String(err);
          }
        }
        if (request !== tabRequestRef.current) return;
        await loadConsoleCards(tab);
        if (replayError) {
          setConsoleTree((prev) => ({
            ...prev,
            dataModel: {
              ...prev.dataModel,
              console: {
                ...prev.dataModel.console,
                query: {
                  error: `The recorded ${tab} set could not be restored — ${replayError}`,
                  count: 0,
                },
                tab,
              },
            },
          }));
        }
      })();
    };
    window.addEventListener('tab-change', onTabChange);
    return () => window.removeEventListener('tab-change', onTabChange);
  }, [consoleRendererRef, loadConsoleCards, setConsoleTree]);

  /* THE CHAT'S SEARCH IS THE SAME DOOR, NARROWED. The seat sends the words and the active tab;
     the assembly applies them INSIDE that tab's base set. The thread and the conversation are
     untouched — this writes only the cards and the plan line. */
  useEffect(() => {
    const onConsoleSearch = (event: Event) => {
      const detail = (event as CustomEvent<{
        tab?: string; text?: string; sort?: string; turnId?: string; recordError?: string;
      }>).detail || {};
      const tab = String(detail.tab || 'chat');
      const text = String(detail.text || '').trim();
      if (!text) return;
      /* THE SEAT SENDS THIS ON WINDOW — its path is [window], not the renderer, so the tab
         listener's path check would reject it. The event name is this room's own channel;
         the tab in the detail is the scope, and the turn id is what the record is written
         against. */
      void loadConsoleCards(tab, {
        text,
        sort: detail.sort,
        turnId: detail.turnId,
        recordError: detail.recordError,
      });
    };
    window.addEventListener('a2ui:console-search', onConsoleSearch);
    return () => window.removeEventListener('a2ui:console-search', onConsoleSearch);
  }, [consoleRendererRef, loadConsoleCards]);

  /* THE REFRESH RESPONSE IS A CARD WRITE, NOT A SURFACE ASSEMBLY. The API re-ran the
     recorded plan inside the tab's base; this room draws the returned cards and plan and leaves
     the chat element and its conversation exactly as they are. */
  useEffect(() => {
    const onConsoleRefresh = (event: Event) => {
      const detail = (event as CustomEvent<{ tab?: string; cards?: unknown[]; query?: unknown }>).detail || {};
      if (!Array.isArray(detail.cards)) return;
      const tab = String(detail.tab || 'chat');
      setConsoleTree((prev) => ({
        ...prev,
        dataModel: {
          ...prev.dataModel,
          cards: detail.cards,
          console: { ...prev.dataModel.console, query: detail.query ?? null, tab },
        },
      }));
    };
    window.addEventListener('a2ui:console-refresh', onConsoleRefresh);
    return () => window.removeEventListener('a2ui:console-refresh', onConsoleRefresh);
  }, [setConsoleTree]);

  /* THE ROOM'S RE-ASSEMBLY REQUEST — the same door the page's own retry button used. */
  useEffect(() => {
    const onConsoleCommand = () => {
      void assembleRef.current('render-console');
    };
    window.addEventListener('a2ui:console-command', onConsoleCommand as EventListener);
    return () => window.removeEventListener('a2ui:console-command', onConsoleCommand as EventListener);
  }, []);

  const errorMessage = aiAssemblyFailed ? aiAssemblyMessage : null;
  const errorReport: FailureReport | null = null;

  /* THE ROOM'S OWN RING, ANSWERING THE CARDS' LOADING (owner, 2026-10-23): it spins while
     the console's cards are genuinely loading — the assembly in flight, or no surface landed
     yet and no failure either. The moment the cards land, or a failure speaks, the ring
     stops. It is the room's, in the room's pane, never a decoration.
     IT STANDS ONLY ON A RETURN VISIT (owner, 2026-10-25): on the first entry the pin gate is
     the wait, with the video loading behind it, so this ring stays out of that stretch. */
  const cardsLoading = isAIAssembling || (assembledConsoleCards === null && !aiAssemblyFailed);

  /* THE ROOM TELLS THE SHELL WHEN ITS SCREEN IS BUILT. The shell's copy of this room's ring
     leaves on this message, and the room stands in its place. */
  useEffect(() => {
    if (cardsLoading) return;
    window.dispatchEvent(new CustomEvent('room-ready', { detail: { room: 'console' } }));
  }, [cardsLoading]);

  return (
    <div style={{ position: 'relative', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
      {cardsLoading && assembleOnEntry && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 2,
          }}
        >
          <div
            className="animate-spin"
            style={{
              width: 26,
              height: 26,
              borderRadius: '50%',
              border: '3px solid rgba(126, 114, 227, 0.6)',
              borderTopColor: 'rgb(126, 114, 227)',
            }}
          />
        </div>
      )}
      {/* THE CONSOLE'S FADE-IN (owner, 2026-10-25): the cards fade in over 600ms once they
          have landed or the failure has spoken. The box's video ground never fades — only the
          application does — so the person goes from the pin gate (first entry) or from the
          room's own ring (return visit) into the cards, never onto a bare ground. */}
      <div
        data-room-fade="console"
        style={{
          height: '100%',
          opacity: cardsLoading ? 0 : 1,
          transition: 'opacity 600ms ease',
          pointerEvents: cardsLoading ? 'none' : undefined,
        }}
      >
        {aiAssemblyFailed && errorMessage && (
          <div
            role="alert"
            style={{
              margin: '12px 16px',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(127,29,29,0.9)',
              color: '#ffffff',
              fontSize: 13,
            }}
          >
            {errorMessage}
          </div>
        )}
        <a2ui-renderer ref={consoleRendererRef} />
        <ConsolePage
          onOpenPrompt={openCard}
          onCreateNew={() => createPrompt()}
          aiAssembledCards={assembledConsoleCards}
          consoleQuery={assembledConsoleQuery}
          isParentLoading={isAIAssembling}
          errorMessage={errorMessage}
          errorReport={errorReport}
          loadingMessage={AI_STANDBY_MESSAGE}
        />
      </div>
    </div>
  );
}
