import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useParams, useNavigate, useSearchParams, useBlocker } from "react-router-dom";
// pdfService import removed — PDF processing is retired
// import { quarantineService } from "@/services/quarantineService"; // Excluded from production
import {
  conversationStorage,
  type Project,
  type Conversation,
} from "@/services/conversationStorage";
// TODO: Legacy reference cleanup — module no longer exists at this path
// import TeacherEditorChat from "@/components/TeacherChat/TeacherEditorChat";
// PromptWorkspace import removed — replaced by model-driven Lit tree (prompt-section-editor + compiled-output-viewer + workspace-layout) inside slot="workspace"
// import QuarantinePanel from "@/components/QuarantinePanel"; // Excluded from production
// MyStoryEditor + SaveProjectModal imports removed — components are retired
// TODO: Legacy reference cleanup — module no longer exists at this path
// import MemoriesTab from "@/components/MemoriesTab";
// Progress import removed — was only used by retired PDF processing
import { useToast } from "@/hooks/use-toast";
import { getAuthState } from "@/services/authService";
import { promptService, type PromptSession, type PromptSection } from "@/services/promptService";
import { UI_ID } from "@/utils/uiIdentifiers";
import LeftVerticalMenu from "@/components/LeftVerticalMenu";
import LeftColumnHeader from "@/components/LeftColumnHeader";
import { useNotificationGate } from "@/hooks/useNotificationGate";
import ConsolePage from "@/pages/ConsolePage";
import consoleBackground from "@/assets/data-wave3.png";
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";
// InteractiveChatInterface is RETIRED — archived, not deleted, at
// retired-files/console-seat-20260917/InteractiveChatInterface.tsx. The console's
// chat is the same Lit <chat-panel> the composer loads, assembled in the console's
// surface and bound to the console's own conversation.
// MobileLayout stood here — a stub returning null, imported and never rendered. It was
// moved to retired-files/dead-code-20260918/ with the rest of the unreachable React set
// (2026-09-18). The real responsive handling is MinWidthWarning + useIsMobile below.
import { useIsMobile } from "@/hooks/use-mobile";
import { MinWidthWarning } from "@/components/MinWidthWarning";
import { useLayoutState } from "@/hooks/useLayoutState";
import { useAiOrchestrator, extractCommands } from "@/shared/ai-orchestrator";
import { eventBus } from "@/shared/event-bus";
import SessionLoader from "@/components/SessionLoader";
import { API_BASE } from "@/shared/apiHelper";
import { CORE_ROLE_LABELS } from "@/shared/promptSections";
import { getStoredUserId } from "@/services/authService";
import { aiOrchestrator } from "@/utils/aiOrchestrator";
// The frontend half of the fail-loud boundary. Every failure the shell can observe gets
// named, pointed at, and shown — see shared/error-registry.ts for why this is a hardcoded
// ledger rather than a heuristic.
import { classifyFailure, parseValidationEnvelope, type FailureReport } from "@/shared/error-registry";
// The A2UI envelope boundary — the version and surface labels on every operation,
// read instead of assumed. See shared/a2ui-envelope.ts: a version this shell does
// not implement, or a response describing more than one surface, is refused here
// rather than parsed as v0.9.1-and-one-surface.
import { readA2UIEnvelope, envelopeRefusalError } from "@/shared/a2ui-envelope";
// The trace view's data path. The reads (the app logger, Sentry's global scope)
// live behind this module, and this shell is what WRITES what they hold into the
// surface's model — the same shape writeSectionsToSurface uses for /session.
// See lib/trace-source.ts for why the element does not fetch its own.
import { subscribeTrace, traceSnapshot, type TraceSnapshot } from "@/lib/trace-source";
import { buildRepairSections } from "@/shared/repairSections";
import { repairAsk, repairBrief } from "@/shared/repairMaterial";
// The flow — the same process the prompt is, drawn. The builder is pure (it makes
// the graph from facts this file already holds); everything below the import is the
// writing, the swapping and the listening.
import {
  buildRepairFlow,
  type FlowNote,
  type FlowSeatInput,
  type RepairRunFacts,
} from "@/shared/agentFlow";
// The app's own logger. The flow's events land here, which is what puts them in the
// operator's Trace view instead of inventing a place for them (see the listeners).
import { logger } from "@/lib/logger";
import {
  applyReadiness,
  applyRepair,
  correctionFromAnswer,
  readRepairTarget,
} from "@/shared/repairApply";
// The chat button wire format, in one place: the payload may not contain `)`, and the
// arguments are encoded per argument (shared/actionLink.ts says why).
import { actionLink, fillFieldAction } from "@/shared/actionLink";
// The repair's own state: clicked = queued, and done only when a fresh check stops
// deriving the finding. See shared/catalogHealth.ts.
import {
  fetchCatalogHealth,
  queuedRepair,
  reconcileRepairs,
  settleRepairs,
  type RepairStages,
} from "@/shared/catalogHealth";

interface WritingAreaIndexProps {
  onLogout?: () => void;
  isAuthenticated?: boolean | null;
}

/**
 * FIND AN ELEMENT WHEREVER IT IS DRAWN — the shell draws the surface INSIDE the renderer's
 * shadow root, so `document.querySelector` reaches nothing here. That is not a theory: the
 * save's `workspace-layout` read and the restore's both came back null, and a null in either
 * is silent — the place simply never travelled, with no error anywhere. This walks the
 * shadow roots the surface is drawn into and returns the first match.
 *
 * It is a DOM read, not a new contract: the elements it finds are the same ones the envelope
 * wrote, and the properties it sets on them are the ones they already publish.
 */
function deepFind<T extends Element>(selector: string): T | null {
  const walk = (root: ParentNode): Element | null => {
    const hit = root.querySelector(selector);
    if (hit) return hit;
    for (const el of root.querySelectorAll('*')) {
      const shadow = (el as HTMLElement).shadowRoot;
      if (!shadow) continue;
      const found = walk(shadow);
      if (found) return found;
    }
    return null;
  };
  return walk(document) as T | null;
}

/**
 * The Figma file the tool calls address.
 *
 * The same key the catalogs carry as `x-figma-source.fileKey` and the registry
 * records per component, so a tool call and the component's provenance cannot
 * drift apart. It is a literal here because the browser has to name the file when
 * it asks the server to run the tool — the server defaults to it too, and a call
 * that names no file is a call nobody can audit.
 */
const FIGMA_FILE_KEY = '20UPR2KQMsbAxlo5NJb1se';

/**
 * HOW LONG A RUN'S CONTROLS STAY BUSY, at the very least.
 *
 * The owner, 2026-09-18: "you need to add a spinner and a delay to the run — three seconds, five
 * seconds, ten seconds, I don't know, however long it takes to assemble all of this stuff in the
 * background. I don't wanna see the chat with a big gap on the side and all of a sudden it
 * corrects itself and slides… this thing should already be in place and then you're just
 * presenting them, right — you're creating an effective opening like a cassette tape."
 *
 * So the spinner is not a progress bar and not a lie about the work: it is the beat that lets the
 * canvas be PRESENTED instead of watched. Below this floor a run's own controls blink, which is
 * the glitch he is describing; above it, the motion belongs to the row of controls he is looking
 * at, which is the point. The canvas's ready signal still ends it — a wait is a floor, not a
 * delay added to the work.
 */
const MIN_RUN_BUSY_MS = 3200;

export default function Index({
  onLogout: _onLogout,
  isAuthenticated: _isAuthenticated,
}: WritingAreaIndexProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id: routeSessionId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const isMobile = useIsMobile();
  const { flipped, toggleFlip } = useLayoutState();
  const [activeTab, setActiveTab] = useState("composer");
  const {
    tabLoading: _tabLoading,
    approvalMode,
    headerTab,
    setHeaderTab,
    clearApprovalMode,
    handleHeaderTabChange,
    handleNotificationAction: _handleNotificationAction,
    finishTabChange: _finishTabChange,
    handleSuppressNotification: _handleSuppressNotification,
    isNotificationSuppressed: _isNotificationSuppressed,
  // A2UI: Removed onNavigate - AI controls surfaces, not URL routing
  } = useNotificationGate({ initialTab: routeSessionId ? "composer" : "console" });
  const [consoleRefreshKey, setConsoleRefreshKey] = useState(0);
  const pendingExitTabRef = useRef<string | null>(null);

  // ── THE CONSOLE'S SEAT IS NOT IN THIS SHELL ANY MORE ────────────────────────
  // It lived here: a React grip writing a column width, a ResizeObserver that
  // followed the shell, a seat hung off that width, and rail-tab state feeding
  // its `view` slot. All of it is gone, because the console's chat is now IN the
  // surface the model assembles: the same `chat-panel` the composer loads, in the
  // container's right slot, bound to the console's own conversation.
  //
  // What went with it here: COLLAPSED_WIDTH / DEFAULT_EXPANDED_WIDTH /
  // SIDEBAR_GRIP_OFFSET / CONSOLE_CHAT_OPEN_FRACTION, consoleChatWidth and its
  // resize+collapse handlers, the console session fetch (the assembly resolves
  // that same row server-side, through the same get-or-create), and the
  // consoleChatTab / consolePanelEl pair that listened to the seat's rail.
  //
  // What STAYS: the `a2ui:console-command` channel below. The assembled seat
  // still speaks through it, and re-assembly is what a reshuffle means.
  //
  // The column's content is no longer reached through a React ref to the editor.
  // <prompt-section-editor> is drawn by <a2ui-renderer> inside its own shadow
  // root, so the ref can only ever be null; every read of it is gone and the
  // surface's data model is read instead (surfaceSections / surfaceCompiledOutput
  // below).

  // Composer-specific running state (controls middle column visibility during Run)
  const [isComposerRunning, setIsComposerRunning] = useState(false);
  // `middleOpen`/`setMiddleOpen` stood here — five writers and NO reader, so every sentence
  // beside it about "the middle pane opens/closes" was a claim about nothing. The pane's
  // presence is the MODEL's (the middle column's component, written when the column is
  // swapped), not a React flag. Removed rather than kept: a dead mirror of a live fact reads
  // as the place that fact lives, and the next edit to it would move nothing.

  // ── Request deduplication: abort previous request if new one comes in ──
  const consoleAssemblyControllerRef = useRef<AbortController | null>(null);
  const isConsoleAssemblyInFlightRef = useRef(false);

  // ── Session loading state (must be declared here, BEFORE any early returns) ──
  const [sessionLoadingState, setSessionLoadingState] = useState<{
    isLoading: boolean;
    progress: number;
    error: string | null;
    sessionName?: string;
  }>({ isLoading: false, progress: 0, error: null });

  // ═══════════════════════════════════════════════════════════════════════════════
  // AI ASSEMBLY LOADING — honest state, no theater.
  // One real spinner bound to the live request. One true sentence.
  // No scripted message rotation, no artificial minimum display time, no
  // withholding completed results. (The previous interstitial faked a
  // 10-message sequence on a 2.2s timer and held finished responses until a
  // 10s "floor" elapsed — removed 2026-08-25 per the TRUE-vs-FAKE doctrine.)
  // ═══════════════════════════════════════════════════════════════════════════════
  const AI_STANDBY_MESSAGE = "Standby — AI is building this interface…";

  /**
   * THE assembly timeout — one home. The abort, the console error, and the
   * message the user reads all come from here. It used to be hardcoded as "30s"
   * in two places while the abort itself was 30000 and then 10000, so the error
   * told the user a number the code had stopped using.
   */
  // Client-side timeout for a surface assembly.
  //
  // This has been wrong in both directions, so record the measurements:
  //   - 10s  → too short. It was set today on the reasoning "warm assemblies run
  //            1.5-2.7s", which is only true when this is the ONLY model call in
  //            flight. The catalog check measures 28.5s (production, 2026-09-11)
  //            and the backend runs query_llm synchronously inside an async
  //            handler, so it BLOCKS the event loop and this request queues
  //            behind it. Every load aborted at 10s and the console never
  //            assembled: "AI Assembly Error - Assembly timed out (10s)".
  //   - 30s  → also too short for the same reason once the queue is involved.
  //
  // So: long enough that a real call is never killed mid-flight. Aborting is
  // only correct for a request that is genuinely dead, and a model call is not
  // dead just because it is slow. A hard cap that fires during normal work is
  // not a safety net, it is an outage.
  //
  // The catalog check does NOT come through here — it has its own fetch with no
  // client cap, because it can legitimately run long.
  const ASSEMBLY_TIMEOUT_MS = 120000;

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
  // The surface's two channels, handed to <a2ui-renderer> as props. This is what
  // replaced `window.__lastA2UIComponents`: a bare global drifted outside React's
  // control — nothing could react to it, nothing could diff it, and it outlived
  // the surface it described.
  //
  // ONE TREE PER SURFACE, not one tree. The sandbox projects exactly one slot and
  // each slot mounts its own renderer, so a tree has a destination. Held as a
  // single tree, the console painted the composer's columns and the cards
  // disappeared from a surface nobody had asked to change (measured 2026-09-17).
  const [consoleTree, setConsoleTree] = useState<{ components: any[]; dataModel: Record<string, any> }>(
    { components: [], dataModel: {} },
  );
  const [workspaceTree, setWorkspaceTree] = useState<{ components: any[]; dataModel: Record<string, any> }>(
    { components: [], dataModel: {} },
  );

  // Which slot <ai-surface-sandbox> projects. Its rule is
  // `headerTab === 'console' ? 'console' : 'workspace'`, and an unset tab is the
  // console — this has to read the same way, or the values below would describe a
  // slot that is not on screen.
  const isConsoleView = (headerTab || 'console') === 'console';
  const surfaceComponents = isConsoleView ? consoleTree.components : workspaceTree.components;
  const surfaceDataModel = isConsoleView ? consoleTree.dataModel : workspaceTree.dataModel;

  /**
   * THE SURFACE'S MODEL, READ THROUGH A REF BY LONG-LIVED LISTENERS.
   *
   * `surfaceDataModel` is chosen per render from `headerTab` — the console's tree or the
   * composer's. A window listener registered once keeps the render it was registered on,
   * so a handler reading the variable directly reads THE TREE THAT WAS ON SCREEN THEN.
   *
   * Measured 2026-09-17, and it is why Save did nothing: the save-click listener was
   * registered while the console was showing, so `surfaceSections()` looked in the
   * console's model, found no `/session/left_column/sections`, and took the "nothing to
   * save" exit — start fired, end fired twice, and not one request left the browser,
   * while the composer on screen held four sections. The same pattern the file already
   * uses for the output (`surfaceCompiledOutput` reads a ref for exactly this reason).
   */
  const surfaceDataModelRef = useRef(surfaceDataModel);
  surfaceDataModelRef.current = surfaceDataModel;

  // ONE authority for the console's prompt packages: /cards in that data model —
  // the same array Grace's ConsoleCardGrid binds to, which is what the renderer
  // draws on screen.
  //
  // There used to be a second copy in React state (`assembledConsoleCards`),
  // written by four different paths — the assembly, both failure branches, a
  // rename, and an `a2ui:surface-update` listener that nothing in this repo
  // dispatched — and read by two others (ConsolePage's states, and both chat
  // panels). Nothing kept it in step with what was drawn: renaming a package
  // updated the copy and left the card on screen showing the old title, and the
  // dead listener set the copy while the surface was never told anything. Two
  // consoles, free to disagree — and the one the operator reads is the drawn one,
  // so the copy could only ever be the one that was wrong.
  // Derived, so it cannot drift. null = no console surface has specified cards yet
  // (ConsolePage states that as "waiting"); [] = assembled, and there are none
  // (stated as "zero packages"). The old variable carried the same distinction in
  // a comment; now the model itself makes it.
  // The CONSOLE's tree specifically, not whichever slot is showing: the cards are
  // the console's, and reading the projected surface here would report the
  // composer's model as the console's while the composer tab was up.
  const assembledConsoleCards = Array.isArray(consoleTree.dataModel.cards)
    ? (consoleTree.dataModel.cards as any[])
    : null;

  // ── THE SURFACE IS WHERE THE COLUMN'S CONTENT IS NOW READ FROM ──────────────
  // These two used to be read out of the DOM — `promptSectionEditorRef.current
  // .sections` and `document.querySelector('compiled-output-viewer').content`.
  // Both components are drawn by <a2ui-renderer> inside its own shadow root now,
  // so no React ref and no document query can reach them: the ref is null and the
  // query finds nothing. That is why Save had nothing to write.
  //
  // The values themselves are unchanged — they are what the renderer BOUND into
  // those elements, held in the data model the assembly returned. Reading them
  // there reads exactly what the components were given.
  const surfaceSections = useCallback((): any[] => {
    // Through the REF, not the render's variable: see surfaceDataModelRef above — a
    // listener that outlives a render must not read the tree from the render it was
    // registered in. This is what made Save read the console's model while the composer
    // was on screen, find no sections, and give up in silence.
    const s = (surfaceDataModelRef.current as any)?.session?.left_column?.sections;
    return Array.isArray(s) ? s : [];
  }, []);

  const surfaceCompiledOutput = useCallback((): string => {
    const out = (surfaceDataModelRef.current as any)?.session?.middle_column?.compiled_output;
    if (typeof out === 'string' && out.length > 0) return out;
    // No assembled output on screen: the package's stored output is the last
    // thing that was written, and it is what the column would be seeded with.
    //
    // Read through the REF, never the `currentPromptSession` state: this callback
    // is declared above that state, and naming it in the dependency array below
    // evaluates it during render — before its `const` runs — which throws
    // "Cannot access 'currentPromptSession' before initialization" and takes the
    // whole shell down. A ref is a stable box the closure reads at call time.
    return currentPromptSessionObjRef.current?.compiledOutput || '';
  }, [surfaceDataModel]);

  /**
   * Put sections into the composer's column, the way the surface reads them.
   *
   * This replaces three writes to `promptSectionEditorRef.current.sections` — the
   * imperative push, the repair re-assert, and the repair prompt's retry dance.
   * All three wrote to a Lit element this shell no longer mounts, so all three
   * were no-ops against null. Writing the model the renderer binds from
   * re-resolves the column's `sections` binding in the same commit, which is what
   * the property write was reaching for.
   *
   * Bails out when the value is already there: the re-assert runs on every commit,
   * and returning a fresh object each time would loop.
   */
  const writeSectionsToSurface = useCallback((sections: any[]) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const left = session.left_column ?? {};
      const have = Array.isArray(left.sections) ? left.sections : [];
      const same = have.length === sections.length
        && have.every((s: any, i: number) => (s?.content || '') === (sections[i]?.content || ''));
      if (same) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, left_column: { ...left, sections } },
        },
      };
    });
  }, []);

  /**
   * THE MIDDLE COLUMN'S WRITER — and there was none, which is why the output was never
   * on screen.
   *
   * The viewer binds `content` to /session/middle_column/compiled_output, and this file
   * only ever READ that path (four reads: the surface read, the session load, the
   * post-load restore). Nothing wrote it. So a Run went: press → POST /api/teacher/query
   * → 200 with an answer → into React state → nowhere. The column drew its empty state
   * over an answer that had already arrived, and the only evidence was the network tab.
   *
   * Measured 2026-09-17: one RUN click produced three teacher/query calls (200, 10.5 /
   * 11.1 / 11.5s) while the surface's model still held {"compiled_output": ""} and the
   * viewer's own prop was 0 chars, status "empty". The model was connected the whole
   * time; the last metre was missing, exactly as it was for the left column.
   *
   * Same shape as the writer above, same reason, and the same bail-out: the sync runs on
   * every change, so returning a fresh object when nothing moved would loop.
   */
  const writeCompiledOutputToSurface = useCallback((output: string) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const middle = session.middle_column ?? {};
      if ((middle.compiled_output ?? '') === output) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, middle_column: { ...middle, compiled_output: output } },
        },
      };
    });
  }, []);

  /**
   * THE TWO BUSY FLAGS THE BOTTOM BAR DRAWS — the spinner on the button that was pressed.
   *
   * `<control-bar>` has carried `isSaving` (state=Compiling) and `isRunning` from the
   * drawing since it was built, and nothing ever assigned either: the surface emits the bar
   * with no props, so both stayed false and a Save Template that took two seconds looked
   * like a button that did nothing. The host already tracks both facts (`isSavingPrompt`,
   * `isComposerRunning`); they are published to the model now and the bar binds them by
   * path, which is the one way a value reaches a component in this system.
   *
   * Written as values, not as a call into the element: whoever renders the bar draws what
   * the model says, and the renderer re-applies every bound path when the model changes.
   */
  // ── The run's own controls, busy from the CLICK ────────────────────────────
  //
  // The owner, 2026-09-18: "when I click run, the run button is not spinning. It's not delaying
  // like the save tab does… I don't wanna see the chat with a big gap on the side and all of a
  // sudden it corrects itself and slides if I put a spinner in, so they have some time to queue
  // up the canvas." He is describing the same shape Save already has (a spinner and a
  // "Compiling…" label), and the reason Run did not have it: `isRunning` reaches the control bar
  // through the tree binding (/session/middle_column/running), and on a Run the tree is SWAPPED
  // for the canvas — so the flag is written into a tree whose control bar has already been
  // replaced. The spinner arrives, if at all, after the thing it was meant to cover.
  //
  // So the controls are written DIRECTLY for the duration of the assembly, and released on the
  // canvas's own ready signal — which is the one moment that means "the canvas is up".
  const setRunControlsBusy = useCallback((busy: boolean) => {
    for (const tag of ['control-bar', 'canvas-footer']) {
      // THE SHADOW-PIERCING READ, NOT document.querySelectorAll — these elements are drawn
      // by the renderer inside its shadow root, so a document-level query finds nothing and
      // the spinner silently never appeared (the silence `deepFind` exists to end; see its
      // note above). An absent tag is a view that is not on screen yet, which is why the Run
      // re-asserts this flag once the canvas has mounted (see the flow-view-ready frame).
      const node = deepFind<HTMLElement & { isRunning?: boolean; running?: boolean }>(tag);
      if (!node) continue;
      node.isRunning = busy;
      node.running = busy;
    }
  }, []);
  /** When the current run was asked for — the floor the spinner is held for. */
  const runBusyFromRef = useRef(0);

  const writeBusyToSurface = useCallback((saving: boolean, running: boolean) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const left = session.left_column ?? {};
      const middle = session.middle_column ?? {};
      if (left.saving === saving && middle.running === running) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: {
            ...session,
            left_column: { ...left, saving },
            middle_column: { ...middle, running },
          },
        },
      };
    });
  }, []);

  // Lit receives objects as PROPERTIES, not JSX attributes — React's `.prop=`
  // syntax is Preact, and in React it is a syntax error (it compiled to
  // "Identifier expected"). So the two payload channels are assigned onto the
  // element through a ref, which is how every other Lit element in this file is
  // fed. Attributes would also be lossy here: a component tree and a data model
  // are structures, and both would arrive as the string "[object Object]".
  //
  // ONE REF PER RENDERER. There are two renderers — one per slot — and a single
  // ref bound to both points at whichever React attached last, so the other
  // surface was handed no tree at all and drew nothing. Measured 2026-09-17: the
  // console slot existed at 1224px with an empty tree and no error to explain it.
  const consoleRendererRef = useRef<any>(null);
  const composerRendererRef = useRef<any>(null);

  useEffect(() => {
    const el = consoleRendererRef.current;
    if (!el) return;
    el.components = consoleTree.components;
    el.dataModel = consoleTree.dataModel;
  }, [consoleTree]);

  useEffect(() => {
    const el = composerRendererRef.current;
    if (!el) return;
    el.components = workspaceTree.components;
    el.dataModel = workspaceTree.dataModel;
  }, [workspaceTree]);

  // ── THE TRACE FEED'S DATA PATH ──────────────────────────────────────────────
  // <trace-feed> renders `{path: "/trace/entries"}` and nothing else; something has
  // to write that path. This is the something, and the choice of WRITER is the one
  // real decision in the trace view:
  //
  //   The protocol-pure writer is the agent — it owns the model, and it would send
  //   an updateDataModel operation. It cannot be the writer here, and not for a
  //   stylistic reason: the transport has no return path (transports.md — our REST
  //   channel is a one-shot POST, and A2A/AG-UI are not wired), so breadcrumbs
  //   never reach the server at all. Telemetry is also client-local by nature: the
  //   logger and Sentry's scope exist in this tab and nowhere else.
  //
  //   So the CLIENT writes it, which the Read/Write contract permits, and which
  //   this shell already does for /session/left_column/sections
  //   (writeSectionsToSurface below). The component stays a view: it is still
  //   handed its values by a path, and it draws what it is given.
  //
  // BOTH TREES. The trace is the app's, not a surface's — one scope, one logger —
  // so both models carry it and the binding resolves in whichever seat emits the
  // feed. Writing it into a model with no such binding is inert.
  //
  // TWO JOBS. (1) Live updates while a surface is on screen. (2) Re-assertion: an
  // assembly REPLACES the whole model, so `/trace` leaves with the one it was
  // written into, and a feed that is bound to a path which is no longer there
  // shows its waiting state until the next breadcrumb happens to arrive. Keyed on
  // the assembled component lists, this re-runs on every assembly and writes the
  // values straight back.
  //
  // The identity check is what keeps a quiet poll from re-rendering the surface
  // twice a second: the source hands back the SAME snapshot object until something
  // actually changed, and returning `prev` unchanged makes React bail out.
  useEffect(() => {
    const merge = (
      prev: { components: any[]; dataModel: Record<string, any> },
      trace: TraceSnapshot,
    ) =>
      prev.dataModel.trace === trace
        ? prev
        : { ...prev, dataModel: { ...prev.dataModel, trace } };

    setConsoleTree((prev) => merge(prev, traceSnapshot()));
    setWorkspaceTree((prev) => merge(prev, traceSnapshot()));

    return subscribeTrace((trace) => {
      setConsoleTree((prev) => merge(prev, trace));
      setWorkspaceTree((prev) => merge(prev, trace));
    });
  }, [consoleTree.components, workspaceTree.components]);

  // Route the surface renderer's events onto the bus.
  //
  // <a2ui-renderer> catches a primitive's event and re-emits it as `a2ui-event`,
  // tagged with the id of the component that raised it (see _forward in
  // a2ui-renderer.ts). It bubbles and is composed, so it crosses the shadow
  // boundary and arrives at window — no ref, no per-element listener.
  //
  // Without this the renderer talks and nobody hears. The catalog audit counts
  // exactly that as `event-unheard`, and it is how a fully wired component still
  // looks inert: the wire is connected at one end only.
  useEffect(() => {
    const handleA2uiEvent = (event: Event) => {
      const { sourceId, type, payload } = ((event as CustomEvent).detail || {}) as {
        sourceId?: string; type?: string; payload?: Record<string, unknown>;
      };
      switch (type) {
        case 'a2ui-action':
          // The generic action channel A2UISurfaceContainer already uses.
          window.dispatchEvent(new CustomEvent('a2ui:action', { detail: { ...payload, sourceId } }));
          break;
        case 'message-sent':
          // The user spoke through the surface. Distinct from a2ui:system-message,
          // which carries Grace's words in the other direction — the two must not
          // share a channel or her reply would echo back as input.
          window.dispatchEvent(new CustomEvent('a2ui:user-message', { detail: { ...payload, sourceId } }));
          break;
        case 'command-received':
          // A rendered command IS a console command.
          window.dispatchEvent(new CustomEvent('a2ui:console-command', { detail: { ...payload, sourceId } }));
          break;
        default:
          console.warn(`[a2ui] surface event "${type}" from ${sourceId} has no listener mapping.`);
      }
    };
    window.addEventListener('a2ui-event', handleA2uiEvent);
    return () => window.removeEventListener('a2ui-event', handleA2uiEvent);
  }, []);
  // The catalog check's findings, as Grace assembled them into the data model.
  // null = the surface is not a catalog surface.
  const [catalogFindings, setCatalogFindings] = useState<any[] | null>(null);

  /**
   * Components that are ON SCREEN RIGHT NOW and carry an open annotation finding.
   *
   * This is what raises the red alert. Both facts have to be true at once: the
   * catalogue says the component has no annotation, AND the surface being rendered
   * contains it anyway. A finding on something nobody is using is a report, not an
   * incident — the incident is the generated one, which is how invented behaviour
   * gets shipped to every surface that places it.
   *
   * Declared after catalogFindings on purpose: it reads it, and a const evaluated
   * before its subject is in the temporal dead zone, which is a render-time crash.
   */
  const unannotatedInUse: string[] = (() => {
    const open = new Set(
      (catalogFindings || [])
        .filter((f: any) => f.check === 'annotation-missing' || f.check === 'annotation-prose')
        .map((f: any) => f.component)
        .filter(Boolean),
    );
    if (open.size === 0) return [];
    const used = new Set<string>();
    for (const c of surfaceComponents || []) {
      const name = c?.component;
      if (typeof name === 'string' && open.has(name)) used.add(name);
    }
    return [...used];
  })();

  const [_rightColumnView, _setRightColumnView] = useState<"chat" | "trace">("chat"); // Chat = TeacherEditorChat, Trace = SCE panel
  const [_isPromptPortalOpen, _setIsPromptPortalOpen] = useState<boolean>(false); // Show prompt portal in first column
  const [_selectedPrompt, _setSelectedPrompt] = useState<{
    title: string;
    content: string;
  } | null>(null); // Selected prompt from portal
  
  // ResponseCard state
  const [_responseCardModel, _setResponseCardModel] = useState<string>("GPT-4.1");
  const [_expandedCard, _setExpandedCard] = useState<"a" | "b">("a");

  // ── Prompt Session state (Create → Edit → Save → Reopen → Delete) ──
  // A `_promptSessions` list stood here — fetched by `loadPromptSessions` after every save,
  // create and delete, and read by NOTHING (the underscore was the tell). The console's list
  // is the model's `/cards` and the sidebar fetches its own, so it was a request per save
  // whose answer went nowhere. Removed with its loader.
  const [currentPromptSession, setCurrentPromptSession] = useState<PromptSession | null>(null);
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  // The two busy flags the bottom bar draws. Declared HERE, after the state it reads:
  // an effect's dependency array is evaluated during render, so reading a const that is
  // declared further down the file is a ReferenceError, not a subtle bug.
  useEffect(() => {
    writeBusyToSurface(isSavingPrompt, isComposerRunning);
  }, [isSavingPrompt, isComposerRunning, writeBusyToSurface]);

  /**
   * THE OUTPUT FOLLOWS THE STATE INTO THE SURFACE. One writer, whatever changed the
   * output: a Run's answer (streamed or whole), a Run's error, the Clear control, or a
   * version restore (the `restore-output` listener). The state is the authority; the
   * model is what the element reads, so this is the only place that carries it over —
   * the alternative was five call sites, each one a place to forget.
   *
   * Written here rather than at the run's own completion so a restore and a Clear land
   * the same way a Run does. Without it the column has never displayed a run's output
   * at all: see the writer above for the measurement.
   */
  useEffect(() => {
    writeCompiledOutputToSurface(currentPromptSession?.compiledOutput ?? '');
  }, [currentPromptSession?.compiledOutput, writeCompiledOutputToSurface]);

  // The SURFACE SEAT's usage accumulator stood here — a second sum of the seat's spend,
  // deduped by call_id, "what the footer shows". The footer never read it: `usageTotal`
  // was written by these effects and referenced nowhere else, and the seat's own numbers
  // reach the surface by path. A running copy of a live fact is the second home the
  // package contract forbids, so it is gone; the rail and the trace read the event.
  const isSavingRef = useRef(false); // Serialization guard: prevents concurrent save operations
  // Key that changes on each prompt load — forces full unmount/remount of all three columns
  const [promptLoadKey, setPromptLoadKey] = useState(0);
  // Ref for currentPromptSession ID — avoids stale closure in event listeners
  const currentPromptSessionRef = useRef<string | null>(null);
  // Same reason: listeners registered once must be able to read the LIVE session
  // object (the effect that wires them does not re-run on session change).
  const currentPromptSessionObjRef = useRef<any>(null);
  // Ref for handleSavePrompt — always points to latest function, used by event listeners
  // Accepts optional compiledOutput + optional sections (from Lit editor) so Save after Run persists full state.
  // `opts.title` names a package this call is CREATING (Repair does this at launch) and
  // `opts.keepSurface` stops the save from navigating away from what was just saved.
  const handleSavePromptRef = useRef<(
    compiledOutput?: string,
    providedSections?: any[],
    opts?: { keepSurface?: boolean; title?: string },
  ) => Promise<void>>(async () => {});
  // Tracks whether the user has unsaved changes since the last save.
  // Used to suppress the exit confirmation when the user just saved.
  const hasUnsavedChangesRef = useRef(false);
  /**
   * The repair prompt, while it owns the left column.
   *
   * Clicking "Repair" beside a catalog finding turns that finding into a PROMPT
   * and drops it into the editor's inputs; the user then Runs it like any other
   * prompt. It lives in a ref rather than in state because it has to WIN over the
   * composer's own sections: opening the composer re-assembles it from the backend
   * (System / User / Agent starters), and that assembly lands AFTER the click and
   * would otherwise wipe the repair. Cleared on Run, on Save, and when another
   * package is opened.
   */
  const repairSectionsRef = useRef<any[] | null>(null);
  /**
   * The repair's own name, held for the same reason — the click that starts a
   * repair can be INTERRUPTED by the unsaved-changes gate and resumed after the
   * person answers, so the title cannot be applied at click time and trusted.
   * Consumed by the composer branch below, which every composer assembly passes
   * through, whichever route got there.
   */
  const repairTitleRef = useRef<string | null>(null);
  /**
   * Where each finding's repair stands, by finding id — 'repair' from the click,
   * 'done' once a fresh check stops deriving it. Absent = nothing done about it.
   * See shared/catalogHealth.ts for why the check, and only the check, decides.
   */
  const [repairStages, setRepairStages] = useState<RepairStages>({});

  /**
   * THE ROW'S STATE, PUBLISHED TO THE MODEL — the last wire between the repair path and the
   * repair list.
   *
   * The stages were tracked here and never left this component: the element has drawn an
   * amber "in repair" and a green mark since it was built, and nothing ever handed it a
   * stage, so a row that was being repaired looked exactly like one nobody had touched. The
   * model is how a value reaches a component in this system, and the repair-view entry binds
   * `/repairs/stages`, so this writes the map there. Declared AFTER the state it reads: an
   * effect's dependency array is evaluated during render.
   */
  const writeRepairStagesToSurface = useCallback((stages: RepairStages) => {
    setConsoleTree((prev) => {
      const repairs = prev.dataModel.repairs ?? {};
      const have = repairs.stages ?? {};
      const same = Object.keys(have).length === Object.keys(stages).length
        && Object.entries(stages).every(([id, stage]) => have[id] === stage);
      if (same) return prev;
      return {
        ...prev,
        dataModel: { ...prev.dataModel, repairs: { ...repairs, stages } },
      };
    });
  }, []);

  useEffect(() => {
    writeRepairStagesToSurface(repairStages);
  }, [repairStages, writeRepairStagesToSurface]);

  // ── THE CHAT PANEL'S CHANNELS ARE NO LONGER ASSIGNED FROM HERE ──────────────
  // There was a `chatPanelRef` here, plus two effects: one pushing findings /
  // repair stages / unannotated names / cards / usage onto the element, one
  // loading the package's conversation list into it. Both are gone, and neither
  // worked: the panel is drawn by <a2ui-renderer> in its own shadow root, so the
  // ref never held an element and every assignment was a no-op on a null value.
  //
  // What those effects were for is real, and the surface is where it has to come
  // from — the findings ride the assembly's data model next to the panel, the
  // same way its conversation id already does. Reaching into the element from the
  // shell was never going to work; that is why removing it costs nothing.

  /**
   * The finding the repair prompt in the column came from. Held from the click to the
   * Run that answers it, because that Run is the thing that gets settled — and it
   * survives the unsaved-changes gate for the same reason the title and the sections
   * do: the click that starts a repair can be interrupted and resumed.
   */
  const repairFindingRef = useRef<string | null>(null);
  /**
   * The ask a repair launch produced, held from the click until the assembly that
   * carries it answers.
   *
   * The BUTTONS are the deterministic half of a repair — one per answer, wired to
   * `fill-field` — and they stay app-rendered on purpose: a model must never generate
   * the answer set, because a wrong set is a wrong repair. The SENTENCE asking for them
   * is no longer app-written; it is Grace's `ai_message` for the assembly, built from
   * `repairBrief`. So the ask waits here and is posted WITH her reply, and it is posted
   * on its own only as the fallback, when the assembly fails and there is no reply to
   * attach it to. Before this, the sentence was a template posted as her, which she had
   * no record of having said.
   */
  const repairAskRef = useRef<{ text: string; buttons: string } | null>(null);
  // Ref for pending action to execute after exit confirmation
  const pendingActionRef = useRef<(() => Promise<void>) | null>(null);
  // Keep refs in sync with state
  useEffect(() => {
    currentPromptSessionRef.current = currentPromptSession?.id ?? null;
    currentPromptSessionObjRef.current = currentPromptSession ?? null;
  }, [currentPromptSession]);

  // ══════════════════════════════════════════════════════════════════════════
  // THE FLOW — the same process, as a picture
  //
  // The prompt is the process READ; the canvas is the same process WORKED. Nothing
  // in the graph is new: its nodes are the sections the left column already holds
  // (keyed by their canonical ids, never by a label a person may rename), the
  // finding the repair came from, and the run's own responses. shared/agentFlow.ts
  // is the pure builder; this is the writer, the publisher, and the one swap that
  // puts it on screen — one writer per fact, like every other path in this file.
  // ══════════════════════════════════════════════════════════════════════════

  /**
   * The Run's own inputs, snapshotted the moment it is accepted.
   *
   * They have to be held because the Run CONSUMES the refs they come from
   * (repairSectionsRef and repairFindingRef are both cleared as it starts), while the
   * graph keeps being rebuilt as the facts land afterwards. Holding the same values
   * is also what keeps the drawing honest: it is the section list the run sent, read
   * a second time.
   */
  const flowInputRef = useRef<{ finding: FlowNote | null; sections: FlowSeatInput[]; label: string } | null>(null);
  /** What the app knows about the run so far. Rebuilt FROM, never edited in place. */
  const flowFactsRef = useRef<RepairRunFacts>({});
  /** The delete handler, reachable from the card's own event listener (see onCardDelete). */
  const deletePackageRef = useRef<(sessionId: string) => void>(() => {});
  /** The publisher, reachable from the settle path — which is defined above it. */
  const publishFlowRef = useRef<() => void>(() => {});

  /** The answer's own first line — the RESULT line the repair prompt asks for. */
  const firstLineOf = (text: string): string =>
    ((text || '').split('\n').find((l) => l.trim()) || '').trim().slice(0, 96);

  /** The graph, into the model. Same shape as the writers above, same bail-out. */
  const writeFlowToSurface = useCallback((flow: ReturnType<typeof buildRepairFlow> | null) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const middle = session.middle_column ?? {};
      if (middle.flow === flow) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, middle_column: { ...middle, flow } },
        },
      };
    });
  }, []);

  /**
   * Rebuild the whole graph from the facts that exist, and write it.
   *
   * A REBUILD, not an edit: the graph is a function of its inputs, so the drawing
   * cannot drift from the run it draws. Called at the four awaits that change what
   * the app knows — the run starting, the answer arriving, what the write returned,
   * and what the fresh check found — and at no other time.
   */
  const publishRepairFlow = useCallback(() => {
    const input = flowInputRef.current;
    if (!input) return;
    writeFlowToSurface(buildRepairFlow({
      label: input.label,
      finding: input.finding,
      sections: input.sections,
      run: flowFactsRef.current,
    }));
  }, [writeFlowToSurface]);

  useEffect(() => {
    publishFlowRef.current = publishRepairFlow;
  }, [publishRepairFlow]);

  /**
   * THE MIDDLE COLUMN, SWAPPED — the PLUG-IN on Run, the output on the way back.
   *
   * The renderer resolves the tree's component name every render, so a swap is a
   * tree write like any other, and the tree is the input it already reads.
   *
   * WHAT A RUN MOVES, AND WHAT IT DOES NOT. It swaps the middle column — the drawing in
   * place of the compiled output — and the left column docks to its rail, which
   * `workspace-layout` hears from the column's own footer and performs itself. Her column
   * is neither moved nor told anything: she is the same seat the composer shows, with the
   * bindings she already had, and the layout that lays her out is the only writer of her
   * width and her open state. An earlier revision moved her panel into the plug-in (which
   * re-created her container on every Run and lost the thread), and a later one left her in
   * place while still writing `isThirdOpen: false` here — one fact from a second place,
   * which closed a column the operator had just sized by hand.
   *
   * The compiled output is NOT lost by the swap: going back binds the viewer's content
   * to the path it was documented to read (/session/middle_column/compiled_output) —
   * today's composer assembly hands it an empty literal instead, which is why this
   * binds it on the way back rather than trusting the assembly to.
   */
  const setOutputColumn = useCallback((which: 'flow' | 'output') => {
    setWorkspaceTree((prev) => {
      const comps = Array.isArray(prev.components) ? prev.components : [];
      const next = comps.slice();

      /**
       * THE COLUMNS ARE FOUND BY ROLE, NEVER BY ID — and that is not fastidiousness.
       *
       * Every assembly names its own components: the composer's session column is
       * `middle-column` and its seat is `right-column`, while a LOADED session's are
       * `middle-col` and `right-col`. This function used to look for the composer's names,
       * so on a saved package it found nothing and returned unchanged — the Run did its
       * model call and its save, and drew no canvas at all (measured 2026-09-18: the query
       * and save both 200, the middle column never appeared). An id belongs to the
       * assembly that chose it; the ROLE belongs to the layout.
       */
      const r = next.findIndex((c: any) => c?.component === 'workspace-layout');
      const root = r >= 0 ? next[r] : null;
      const childMap: Record<string, unknown> = { ...((root?.children as Record<string, unknown>) ?? {}) };
      const byComponent = (name: string): number =>
        next.findIndex((c: any) => c?.component === name);
      // The middle: whatever the layout points at, or the viewer the assembly emitted
      // without pointing at it (a Run is what makes it a column).
      const middleId =
        (childMap.middle as string | undefined) ??
        next.find((c: any) => c?.component === 'compiled-output-viewer' || c?.component === 'AgentCanvas')?.id;
      const i = middleId ? next.findIndex((c: any) => c?.id === middleId) : -1;
      if (i < 0) return prev;
      const have = next[i];
      if (which === 'flow' && have?.component === 'AgentCanvas') return prev;
      if (which === 'output' && have?.component === 'compiled-output-viewer' && have?.content?.path) return prev;


      if (which === 'flow') {
        // THE UNIT IS COMPOSED BY THE ENVELOPE, not by an element. `agent-canvas` is a
        // CONTAINER: it declares two slots and this surface fills them — the drawing in
        // "flow", her seat in "seat" — exactly as workspace-layout is filled by name.
        // An element that renders another element is nesting, and this protocol does not
        // allow it (AGENTS-instructions/Core-Concept.md: children come from the envelope,
        // never from a component's own template; "surfaces cannot nest").
        //
        // HER SEAT IS THE SAME COMPONENT, NOT A COPY. "right-column" already exists in
        // this tree with every binding she needs — the conversation, the conversations,
        // the session, the prompt text, the compiled output, and her own view child. The
        // adjacency list lets one component change parents, so nothing about her contract
        // is restated here and there is exactly one chat-panel to keep true.
        // A RUN DOES NOT TOUCH HER. The canvas is the DRAWING — header, flow, foot — and her
        // seat is not a child of it. This used to move her in (the plug-in had a "seat" slot),
        // which is what replaced her container and lost the thread on every Run. The owner,
        // 2026-09-18: "there's no difference between the canvas Grace and the new-package Grace
        // — they're the same Grace, so there's no reason to replace anything. That was my
        // mistake." And: "when we click run, all we have to do is expose the third column,
        // which is actually the canvas." So the middle column swaps what it shows; she stays
        // where she is, with her conversation, and nothing re-creates her.
        next[i] = {
          id: middleId,
          component: 'AgentCanvas',
          // THE CANVAS IS BORN DARK (owner, 2026-09-18). The drawing's own default is the
          // mid-tone this design was drawn in, but a Run produces a picture meant to be
          // looked at, and dark is the tone it is shown in — the tone control in the foot
          // takes it back.
          // AND NO `collapsed` IS SENT, because there is no column here to state: the plug-in
          // is the drawing, and her column belongs to the layout that lays it out. The open
          // state a Run shows her at is the state the operator left.
          theme: 'dark',
          children: {
            header: 'output-controls-view',
            flow: 'flow-view',
            // THE FOOT IS THE COLUMN'S TOO — the ControlBar master's bar, where the tone
            // switch lives. A Run replaces what is under the header, and the place's own
            // foot has to survive that.
            footer: 'canvas-footer-view',
          },
        };
        if (!next.some((c: any) => c?.id === 'flow-view')) {
          next.push({
            id: 'flow-view',
            component: 'AgentFlow',
            flow: { path: '/session/middle_column/flow' },
            theme: 'dark',
          });
        }
        // THE COLUMN'S HEADER, PRESENT AND UNWIRED — the owner's instruction (2026-09-18):
        // "just add the element to the canvas and that way it'll be there when we get ready
        // to wire it up." It is the design's own row (output-vontrols 40001034:1186): the
        // view selector and the model selector. The selector opens nothing yet, because no
        // menu contents exist in the Figma pull and its entries are the owner's
        // specification — so it is drawn with its tag and role and does nothing, rather
        // than doing something invented.
        if (!next.some((c: any) => c?.id === 'output-controls-view')) {
          next.push({
            id: 'output-controls-view',
            component: 'OutputControls',
            outputType: 'Agent Flow',
          });
        }
        if (!next.some((c: any) => c?.id === 'canvas-footer-view')) {
          next.push({ id: 'canvas-footer-view', component: 'CanvasFooter', theme: 'dark' });
        }
        // THE MIDDLE COLUMN ARRIVES WITH THE RUN. Before one there is nothing to draw
        // there — a prompt that has not been run is two columns, the prompt and Grace —
        // so the assembly emits the component without pointing the layout at it. The Run
        // is what makes it a column, which is also why the flow view lives in it.
        childMap.middle = middleId;
        // AND HER OWN COLUMN IS NOT EVEN NAMED HERE. It used to stand down, because she was
        // drawn inside the canvas — one Grace on screen meant one of the two columns had to go.
        // She is not inside it any more (see the note above), and then it was left standing but
        // still TOLD to close (`isThirdOpen: false`): the same fact written from a second place,
        // which is what slammed a column the operator had just sized by hand. Her column has ONE
        // writer — the layout that lays it out — and a Run is not it. Whatever the operator set
        // with the rail or the grip is the state she keeps; the owner, 2026-09-18: "all we have to
        // do is expose the third column, which is actually the canvas."
        if (root) next[r] = { ...root, children: childMap };
      } else {
        next[i] = {
          id: middleId,
          component: 'compiled-output-viewer',
          content: { path: '/session/middle_column/compiled_output' },
        };
        // The middle column goes away again — it is a Run's column — and the drawing and the
        // header leave with the view that used them. Her column is not "restored" either: it was
        // never taken and never written, so there is nothing here to put back.
        delete childMap.middle;
        for (const gone of ['flow-view', 'output-controls-view', 'canvas-footer-view']) {
          const idx = next.findIndex((c: any) => c?.id === gone);
          if (idx >= 0) next.splice(idx, 1);
        }
        if (root) next[r] = { ...root, children: childMap };
      }
      return { ...prev, components: next };
    });
  }, []);

  // ══════════════════════════════════════════════════════════════════════════
  // The middle column is the source of truth for the run output.
  // Save used to read the output from a ref, which can be stale by the time the
  // click arrives — so Save posted compiled_output:"" and the backend wrote that
  // empty string over the output the user was looking at, wiping the column on
  // every save. It then read the LIVE element to compensate.
  //
  // The live element is unreachable now: <compiled-output-viewer> is drawn by
  // <a2ui-renderer> inside its own shadow root, so `document.querySelector` finds
  // nothing and the DOM read silently degraded to the stale fallback it was
  // written to avoid. surfaceCompiledOutput reads the same value one step earlier
  // — the model the renderer bound into that element — which is what "whatever is
  // on screen" means now.
  // ══════════════════════════════════════════════════════════════════════════
  const readLiveOutput = (): string => surfaceCompiledOutput();

  // My Story Editor state — NOTE: MyStory editor and SaveProjectModal are retired.
  // State kept for legacy compatibility with remaining save function references.
  const [_myStoryContent, _setMyStoryContent] = useState<string>("");
  const [_hasUnsavedChanges, _setHasUnsavedChanges] = useState(false);
  const [editorSuggestions, _setEditorSuggestions] = useState<unknown[]>([]);
  const [_activeSuggestion, setActiveSuggestion] = useState<unknown | null>(
    null,
  );

  // PDF Summary state for highlights and suggestions
  // Chat mode is always 'grace' - Keeper removed from chat interface
  // Karen/Mistral is only used for grammar checking (separate feature, not chat)

  const _handleQuestionSubmit = useCallback(() => {
    // Clear active suggestion when user submits a new question
    setActiveSuggestion(null);
  }, []); // No dependencies - stable function
  const [_isLightMode, _setIsLightMode] = useState(false); // Dark mode is default
  const [_isTeacher, setIsTeacher] = useState(false); // Teacher role state

  // Projects management state
  const [projects, setProjects] = useState<Project[]>([]);
  const [_editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState<string>("");
  const [newProjectName, setNewProjectName] = useState<string>("");
  const [_showNewProjectInput, setShowNewProjectInput] =
    useState<boolean>(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [_projectConversations, setProjectConversations] = useState<
    Conversation[]
  >([]);
  const [selectedConversationIds, setSelectedConversationIds] = useState<
    Set<string>
  >(new Set());
  const [_isMultiSelectMode, setIsMultiSelectMode] = useState<boolean>(false);

  // Clear active suggestion when suggestions are cleared
  useEffect(() => {
    if (editorSuggestions.length === 0) {
      setActiveSuggestion(null);
    }
  }, [editorSuggestions]);

  // ── Session loading state listener (MUST be before any early returns) ──
  useEffect(() => {
    const handleLoadingState = (e: CustomEvent) => {
      setSessionLoadingState(e.detail);
    };

    window.addEventListener('session-loading-state', handleLoadingState as EventListener);
    return () => {
      window.removeEventListener('session-loading-state', handleLoadingState as EventListener);
    };
  }, []);

  // ══════════════════════════════════════════════════════════════════════
  // A2UI EVENT LISTENERS — Bridge aiOrchestrator events to React state
  // These are the "ears" that hear when the AI has assembled something
  // ══════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // The generic `a2ui:surface-update` handler that used to open this effect is
    // GONE, along with the channel it listened on: nothing in this repo ever
    // dispatched that event (grep for `surface-update` finds only prose — no
    // sender). What it did was write a second copy of the console's cards from
    // `cmd.props.cards` while never telling the surface anything, so it could only
    // ever have produced a console that disagreed with the one on screen. The
    // console's cards are read from the surface's data model now (see
    // `assembledConsoleCards` above); a legacy second channel feeding a deleted copy
    // is not kept on the chance that it comes back.

    // Handler for errors
    const handleError = (e: CustomEvent) => {
      const props = e.detail?.props ?? {};
      console.error("[WritingAreaIndex] A2UI error", props);
      // This used to set the MESSAGE and stop the spinner, and nothing else. The failure
      // arrived on the error channel and was announced on the LOADING channel — then
      // discarded when the spinner unmounted, because the workspace only renders the
      // failure when aiAssemblyFailed is true. A failure that leaves no surface behind is
      // suppression by definition, so the flag is set here.
      //
      // NOTE: nothing in this repo currently DISPATCHES `a2ui-update-error-banner` —
      // this listener has no sender (verified by grep: the add and the remove, and
      // no dispatch anywhere else). Wiring a sender is separate work; this handler is
      // made honest now so that when the sender lands the failure is already visible
      // rather than already swallowed.
      const report = classifyFailure(
        new Error(props.message || 'A2UI component reported an error'),
        { intent: props.intent || 'component-error', body: props },
      );
      setAiAssemblyReport({ ...report, code: props.code || report.code });
      setAiAssemblyMessage(props.message || report.headline);
      setIsFailureAcknowledged(false);
      setAiAssemblyFailed(true);
      setIsAIAssembling(false);
    };

    // `a2ui-update-error-banner` has no sender either (see the note on handleError
    // above) — but that listener is kept deliberately, so that the first component
    // which reports an error is already visible when the sender lands.
    window.addEventListener('a2ui-update-error-banner', handleError as EventListener);

    // Cleanup
    return () => {
      window.removeEventListener('a2ui-update-error-banner', handleError as EventListener);
    };
  }, []);


  const loadProjects = useCallback(async () => {
    // Load projects from API (use cache first, only refresh if needed)
    // Don't force refresh on every load to avoid API spam
    let allProjects = await conversationStorage.getAllProjects(false);

    // Find "Archived Unassigned Chats" project (the default project)
    let defaultProject = allProjects.find(
      (p) => p.name === "Archived Unassigned Chats",
    );

    // If default project doesn't exist, create it
    if (!defaultProject) {
      console.log("⚠️ [WritingAreaIndex] Default project not found, searching for existing one...");

      // Search for any project named "Archived Unassigned Chats" in the list
      const existingDefault = allProjects.find(
        (p) => p.name === "Archived Unassigned Chats",
      );

      if (existingDefault) {
        console.log("✅ [WritingAreaIndex] Found existing default project:", existingDefault.id);
        defaultProject = existingDefault;
      } else {
        try {
          console.log("📁 [WritingAreaIndex] Creating default 'Archived Unassigned Chats' project...");
          defaultProject = await conversationStorage.createProject(
            "Archived Unassigned Chats",
          );
          console.log("✅ [WritingAreaIndex] Created default project:", defaultProject);

          // Reload projects to include the newly created one
          allProjects = await conversationStorage.getAllProjects(true);
          defaultProject = allProjects.find(
            (p) => p.name === "Archived Unassigned Chats",
          );

          if (!defaultProject) {
            console.error("❌ [WritingAreaIndex] Failed to find newly created project in project list");
            // Add it manually to the list
            allProjects.push(defaultProject);
          }
        } catch (error) {
          console.error("❌ [WritingAreaIndex] Failed to create default project:", error);
          // Create a fallback project in memory
          defaultProject = {
            id: 'fallback-' + Math.random().toString(36).substr(2, 9),
            name: "Archived Unassigned Chats",
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          allProjects.push(defaultProject);
          console.warn("⚠️ [WritingAreaIndex] Using fallback project:", defaultProject);
        }
      }
    }

    // Ensure default project is in the list (in case it was created but not in the array)
    if (
      defaultProject &&
      !allProjects.find((p) => p.id === defaultProject!.id)
    ) {
      allProjects.push(defaultProject);
    }

    // Set projects (allow multiple projects - don't auto-delete)
    setProjects(allProjects);

    // Determine which project to select (handle async operations first)
    // CRITICAL: Prioritize last modified project (most recent activity)
    let projectIdToSelect: string | null = null;

    // Check if a project is already selected
    const currentSelectedId = selectedProjectId;
    if (
      currentSelectedId &&
      allProjects.find((p) => p.id === currentSelectedId)
    ) {
      // Keep the currently selected project
      console.log(`✅ Keeping user-selected project: ${currentSelectedId}`);
      projectIdToSelect = currentSelectedId;
    } else {
      // PRIORITY 1: Restore last modified project (most recent activity)
      const lastModified = conversationStorage.getLastModifiedProject();
      if (lastModified && lastModified.projectId) {
        const project = allProjects.find(
          (p) => p.id === lastModified.projectId,
        );
        if (project) {
          conversationStorage.setCurrentProjectId(project.id);
          console.log(
            `✅ Restored last modified project: ${project.id} (modified at ${new Date(lastModified.timestamp).toLocaleString()})`,
          );
          projectIdToSelect = project.id;
        }
      }

      // PRIORITY 2: If no last modified, check saved project from localStorage
      if (!projectIdToSelect) {
        const savedProjectId = conversationStorage.getCurrentProjectId();
        if (
          savedProjectId &&
          allProjects.find((p) => p.id === savedProjectId)
        ) {
          console.log(
            `✅ Restored saved project from localStorage: ${savedProjectId}`,
          );
          projectIdToSelect = savedProjectId;
        }
      }

      // PRIORITY 3: Use first available project (user's actual projects take priority)
      if (!projectIdToSelect && allProjects.length > 0) {
        const firstProject = allProjects[0];
        conversationStorage.setCurrentProjectId(firstProject.id);
        console.log(`✅ Using first available project: ${firstProject.id}`);
        projectIdToSelect = firstProject.id;
      } else if (!projectIdToSelect && defaultProject) {
        // PRIORITY 4: Fallback to "Archived Unassigned Chats" only if no other projects exist
        conversationStorage.setCurrentProjectId(defaultProject.id);
        console.log(
          `⚠️ No user projects found, using fallback (Archived Unassigned Chats): ${defaultProject.id}`,
        );
        projectIdToSelect = defaultProject.id;
      } else if (!projectIdToSelect) {
        // PRIORITY 5: No projects exist - user must create one
        console.log("📝 No projects found - user must create a project");
        projectIdToSelect = null;
      }
    }

    // Set the selected project ID (now that async operations are complete)
    if (projectIdToSelect) {
      setSelectedProjectId(projectIdToSelect);
    }

    // Conversations are NOT loaded here, and must not be.
    //
    // A conversation is filtered in direct relationship to the package it was
    // created in, and it is fetched when that container is called — not swept up
    // for the whole project when the homepage mounts. The one independent set is
    // the user-wide chats at the top level, and those arrive the same way: when
    // their own container is called.
    //
    // This block used to pull every conversation in the project into
    // projectConversations — a value nothing ever read. A full
    // GET /api/conversations?project_id=... on every page load, for nobody.
    const currentProjectId =
      projectIdToSelect || conversationStorage.getCurrentProjectId();

    console.log(
      `✅ Loaded ${allProjects.length} project(s), current project: ${currentProjectId}`,
    );
  }, [selectedProjectId]);

  // Load projects from localStorage on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Check if user is a teacher (only on mount - role won't change unless user logs out/in)
  useEffect(() => {
    const authState = getAuthState();
    const teacherStatus = authState.isTeacher || false;
    setIsTeacher(teacherStatus);
  }, []);

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return;
    const project = await conversationStorage.createProject(
      newProjectName.trim(),
    );
    setProjects([...projects, project]);
    setNewProjectName("");
    setShowNewProjectInput(false);
    setSelectedProjectId(project.id);
    conversationStorage.setCurrentProjectId(project.id);
  };

  const _handleStartEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const _handleSaveEditProject = async (projectId: string) => {
    if (!editingProjectName.trim()) {
      setEditingProjectId(null);
      return;
    }
    const project = projects.find((p) => p.id === projectId);
    if (project) {
      project.name = editingProjectName.trim();
      try {
        const saveResult = await conversationStorage.saveProject(project);
        if (saveResult.success) {
          setProjects([...projects]);
          setEditingProjectId(null);
          setEditingProjectName("");
          if (saveResult.error) {
            // Show warning if saved locally
            alert(`Saved Locally: ${saveResult.error}`);
          }
        } else {
          // Show error if save failed
          alert(
            `Failed to save project: ${saveResult.error || "Unknown error"}`,
          );
        }
      } catch (error) {
        console.error("Error saving project:", error);
        alert(
          `Error saving project: ${error instanceof Error ? error.message : "Unknown error"}`,
        );
      }
    }
  };

  const _handleCancelEditProject = () => {
    setEditingProjectId(null);
    setEditingProjectName("");
  };

  // ── Prompt Session CRUD Handlers ──
  // `loadPromptSessions` stood here: a fetch whose only effect was to store the list in a
  // state nothing read (see the note at that state). Gone with it and with its three call
  // sites — a save no longer pays for a request whose answer is discarded.

  const handleCreateNewPrompt = async (_title?: string) => {
    // ══════════════════════════════════════════════════════════════════════════
    // A2UI v0.9: "Create New" → AI assembles blank composer surface
    // Uses the unified assembleSurfaceWithAI function with render-composer intent
    // ══════════════════════════════════════════════════════════════════════════
    console.log('🤖 [A2UI] Creating new prompt → intent: render-composer');
    await assembleSurfaceThenRepairs('render-composer');
  };

  const handleSavePrompt = async (
    compiledOutput?: string,
    providedSections?: any[],
    opts?: { keepSurface?: boolean; title?: string },
  ) => {
    console.log('🔵 [SAVE] Save button clicked! Current session:', currentPromptSession?.id);
    // Serialization guard: prevent concurrent save operations.
    //
    // It used to RETURN here in silence. Run is save-then-run when the package has
    // never been saved, so a Run that arrived while a Save was still in flight got
    // no session id back and reported "saving failed — nothing was executed" —
    // while the save it was waiting on went on to succeed a second later. Nothing
    // had failed; the caller had left before the answer arrived. Wait for the save
    // in flight instead: the id it is about to write is the id this caller needs.
    if (isSavingRef.current) {
      const deadline = Date.now() + 20000;
      console.log('⏸️ [CRUD] Save already in flight — waiting for it to land instead of skipping');
      while (isSavingRef.current && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      return;
    }
    isSavingRef.current = true;
    setIsSavingPrompt(true);

    // ══════════════════════════════════════════════════════════════════════
    // A2UI: IMMEDIATE GRACE FEEDBACK — User sees response the moment they click
    // This is Grace acknowledging the command, not a static spinner.
    // Dispatches event so ResponsivePromptBuilder shows spinner on button.
    // ══════════════════════════════════════════════════════════════════════
    window.dispatchEvent(new CustomEvent('save-template-start'));

    try {
      let allSections: { name: string; content: string }[] = [];

      if (providedSections && providedSections.length > 0) {
        // ══════════════════════════════════════════════════════════════════════
        // ONLY PATH: sections from the Lit <prompt-section-editor>.
        // The Lit editor is the source of truth — it owns the shadow DOM textareas.
        // Both save-template and save-requested events pass sections here.
        // ══════════════════════════════════════════════════════════════════════
        allSections = providedSections.map((s: any) => ({
          name: s.name || s.section || s.role || s.type || 'Section',
          content: s.content || ''
        }));
        console.log('📦 [SAVE] Using sections from Lit editor:', allSections.length);
      } else {
        // ── NO SECTIONS: The Lit editor ref is empty or not mounted.
        // This means the composer surface hasn't loaded yet — bail out.
        console.warn('⚠️ [SAVE] No sections available — Lit editor not mounted or empty. Aborting save.');
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: { role: 'assistant', content: '⚠️ Nothing to save — the composer has no sections yet.' }
        }));
        isSavingRef.current = false;
        setIsSavingPrompt(false);
        window.dispatchEvent(new CustomEvent('save-template-end'));
        return;
      }

      // Build sections array - include ALL sections, even empty ones
      const sections: PromptSection[] = allSections.map((s, index) => ({
        id: crypto.randomUUID?.() || s.name,
        type: s.name as PromptSection['type'],
        content: s.content,
      }));

      console.log('📸 [SAVE] Capturing surface state:', {
        totalSections: sections.length,
        sectionNames: sections.map(s => s.type),
      });

      // ══════════════════════════════════════════════════════════════════════
      // GUARD: Do not send CRUD requests with a null session ID.
      // The backend CREATE path is functional, but we must not hit the
      // UPDATE path (PUT /api/prompt-sessions/null) which crashes PostgreSQL.
      // If no valid session ID exists, the save will use the CREATE path.
      // ══════════════════════════════════════════════════════════════════════
      const sessionId = currentPromptSessionRef.current;
      const isValidSessionId = sessionId && sessionId !== 'null' && sessionId.length > 0;
      // The name is settled here as well as at assembly, because THIS is the
      // boundary where a name becomes permanent — and Run is save-then-run when the
      // package has never been saved, so here is often the only chance it gets.
      // Order: what the session carries, then the repair that spawned it — but only
      // when this save is CREATING a package (`!isValidSessionId`). An UPDATE of an
      // existing package must never be renamed by a repair that merely happens to be
      // queued behind an unsaved-changes gate.
      // `opts.title` is the repair's own name, handed in by the caller that is
      // CREATING the package. Repair cannot leave it in `repairTitleRef` for this
      // to read: the assembly consumes that ref when the surface lands (see the
      // composer branch) and the closure here is still the pre-assembly render.
      // It is ignored for an UPDATE, like every other rename path: an existing
      // package is not renamed by a repair that merely passes through it.
      const title = (opts?.title && !isValidSessionId ? opts.title : null)
        || currentPromptSession?.title
        || (repairTitleRef.current && !isValidSessionId ? repairTitleRef.current : null)
        || `Prompt - ${new Date().toLocaleString()}`;

      console.log('🤖 [AI] Calling AI save endpoint...');

      // ── THE WIDTHS, READ OFF THE ELEMENT THAT OWNS THEM ────────────────────
      //
      // This used to dispatch `collect-column-widths` and wait 100ms for a
      // `column-widths-response` that NOTHING in this repository ever sent: every save paid
      // the wait and stored no column_widths at all, without a word. The widths are the
      // layout's own numbers — it renders the panes — so the host reads them at the save
      // exactly the way it reads workspaceState off the canvas (see the place read below),
      // through the same shadow-piercing helper.
      const columnWidths = deepFind<
        HTMLElement & { widths?: () => { left: number | null; chat: number } }
      >('workspace-layout')?.widths?.();

      // ── The place, as the operator left it ──
      //
      // READ OFF THE ELEMENTS THAT OWN IT — the left column from <workspace-layout>, her
      // column and the drawing's pan and zoom from <agent-canvas>. Not a new event and not a
      // new prop: the components already publish these (leftCollapsed is a property; the
      // plug-in answers workspaceState()), and a save is a read, not a gesture. A piece that
      // is not on screen is simply absent, and the server keeps what it had.
      //
      // AND IT IS A SHADOW-PIERCING READ, which is the correction: `document.querySelector`
      // reaches nothing here — the shell draws the surface INSIDE the renderer's shadow root —
      // so both of these were null on every save and the place never travelled, silently.
      // A null was indistinguishable from "the view is not open", which is why it took the
      // same helper the flow's link needed to make the two reads real.
      const workspace = (() => {
        const layout = deepFind<HTMLElement & { leftCollapsed?: boolean }>('workspace-layout');
        const canvas = deepFind<HTMLElement & { workspaceState?: () => Record<string, unknown> }>('agent-canvas');
        const state: Record<string, unknown> = {};
        if (layout) state.leftCollapsed = !!layout.leftCollapsed;
        const canvasState = canvas?.workspaceState?.();
        if (canvasState) Object.assign(state, canvasState);
        // WHICH MIDDLE VIEW THE PACKAGE WAS LEFT ON — a package saved while the canvas was
        // up reopens on the canvas; one saved on the output reopens on the output. The
        // element's presence is the fact: Run mounts the canvas, Reset unmounts it.
        if (canvas) state.middle = 'flow';
        else if (deepFind('compiled-output-viewer')) state.middle = 'output';
        // THE DRAWING AS IT WAS LEFT — the element's drawn graph carries the person's own
        // edits (positions dragged, nodes added, edges rewired), which the published model
        // does not. The label and the not-drawn lists come from the model the element holds.
        //
        // `drawn` IS A GETTER, NOT A METHOD (agent-flow.ts). This read used to call it —
        // `flowEl?.drawn?.()` — which threw "flowEl.drawn is not a function" out of the save
        // handler on EVERY save that had a canvas on screen, so the save never sent and the
        // toast said exactly that. A value is read; it is not called.
        const flowEl = deepFind<HTMLElement & {
          flow?: { label?: string; unresolved?: string[]; absent?: unknown[] };
          drawn?: { nodes: unknown[]; edges: unknown[] };
        }>('agent-flow');
        const drawn = flowEl?.drawn;
        if (drawn) {
          state.graph = {
            label: flowEl?.flow?.label ?? '',
            nodes: drawn.nodes,
            edges: drawn.edges,
            unresolved: flowEl?.flow?.unresolved ?? [],
            absent: flowEl?.flow?.absent ?? [],
          };
        }
        return Object.keys(state).length ? state : undefined;
      })();

      const savePayload = {
        session_id: isValidSessionId ? sessionId : undefined,
        title,
        left_column: {
          sections: sections.map((s, index) => ({
            section: s.type,
            role: s.type,
            content: s.content,
            position: index,
            visible: true,
          })),
        },
        middle_column: {
          compiled_output: compiledOutput || '',
        },
        right_column: {
          conversation_id: currentPromptSession?.conversationId || null,
        },
        column_widths: columnWidths,
        workspace,
      };

      const response = await fetch(`${API_BASE}/ai/save-surface`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
        },
        body: JSON.stringify(savePayload),
      });

      if (!response.ok) {
        throw new Error(`AI save failed: ${response.status}`);
      }

      const result = await response.json();
      console.log(`🤖 [AI] ${result.ai_message}`);

      if (!result.session_id) {
        throw new Error('AI save response missing session_id');
      }

      const savedSession = await promptService.getPromptSession(result.session_id);
      setCurrentPromptSession(savedSession);
      currentPromptSessionRef.current = savedSession.id;

      hasUnsavedChangesRef.current = false;
      // The repair name has now been written down; it must not follow this user
      // into the next package they save.
      repairTitleRef.current = null;

      // THE THREAD THAT WAS SPOKEN BEFORE THE PACKAGE EXISTED IS WRITTEN DOWN WITH IT.
      //
      // A turn spoken before the first Save has no conversation to live in — the backend
      // refuses it by design ("this turn will not be persisted": conversations.session_id
      // is NOT NULL, so there is nothing to bind it to) and it lives only in the seat. The
      // Save creates the package's conversation; without this hop that conversation starts
      // empty, and the person who reopens their package finds their own words missing —
      // the thread beside them is whatever the conversation carries, and an empty one
      // carries nothing. The pending turns travel in order; turns the backend already
      // owns are not touched. A save made from the console (a repair launched into a
      // package) skips this: its seat is the console's, not the package's.
      const savedConversationId = savedSession.conversationId || undefined;
      if (headerTab !== 'console' && savedConversationId) {
        const seat = deepFind<HTMLElement & { flushPendingTurns?: (id: string, sessionId?: string) => Promise<number> }>('chat-panel');
        let written = 0;
        if (seat?.flushPendingTurns) {
          try {
            written = await seat.flushPendingTurns(savedConversationId, savedSession.id);
          } catch (err) {
            // NOT SWALLOWED. The flush writes the thread that was spoken before this package
            // existed; if it fails, those turns stay pending and the next Save retries — but
            // nobody was told, which is exactly the defect this line removes. The logger's
            // warn/error reach the Trace tab (lib/trace-source subscribes to it).
            logger.error('the pre-save thread could not be written into the package conversation', {
              conversationId: savedConversationId,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
        if (written) {
          console.log(`💬 [SAVE] ${written} turn(s) spoken before the package existed written into ${savedConversationId}`);
        }
        // The model learns the id through the ONE writer that already owns this fact —
        // the seat's own adoption path — so a re-render cannot drop it and every later
        // turn persists server-side instead of waiting for the next Save.
        handleConversationChange(savedConversationId, 'composer');
      }

      // If user is on console, re-assemble to show updated cards.
      // If on composer, just update the session state (already done above).
      //
      // NOT when the caller is putting a prompt IN the column (`keepSurface`): a
      // save made at launch (Repair) would otherwise swap the composer — and the
      // repair prompt inside it — for the package list it was launched from.
      if (headerTab === 'console' && !opts?.keepSurface) {
        assembleSurfaceWithAI('render-console');
      }

      // ✅ Toast: save succeeded
      toast({
        title: "Template saved",
        description: `Saved with ${allSections.length} sections`,
        duration: 3000,
      });
    } catch (error) {
      console.error('❌ [CRUD] Save failed:', error);
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      // ✅ Toast: save failed
      toast({
        title: "Save failed",
        description: errMsg,
        variant: "destructive",
        duration: 5000,
      });
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: { role: 'assistant', content: `⚠️ Save failed: ${errMsg}` }
      }));
    } finally {
      isSavingRef.current = false;
      setIsSavingPrompt(false);
      // Signal to ResponsivePromptBuilder that save is complete
      window.dispatchEvent(new CustomEvent('save-template-end'));
    }
  };
  // Keep ref in sync for event listeners
  handleSavePromptRef.current = handleSavePrompt;

  // ── AI Orchestrator — listens for XML tags in chat responses ──
  const sessionId = currentPromptSession?.id ?? null;
  const { lastCommand } = useAiOrchestrator({ sessionId });

  // Wire AI commands to actual component actions
  useEffect(() => {
    if (!currentPromptSession) return;

    // <save-button/> → save (sections read from the surface's data model)
    const unsubSave = eventBus.on('save-button', () => {
      const sections = surfaceSections();
      const compiledOutput = surfaceCompiledOutput();
      handleSavePromptRef.current?.(compiledOutput, sections);
    });

    // <prompt-section type="..." content="..."> → insert section
    const unsubSection = eventBus.on('prompt-section', (cmd) => {
      const { type, content } = cmd.props || {};
      if (!type) return;
      // Dispatch DOM event that ResponsivePromptBuilder listens for
      window.dispatchEvent(new CustomEvent('add-prompt-role', {
        detail: { roleName: type, placeholder: content || '' }
      }));
    });

    return () => {
      unsubSave();
      unsubSection();
    };
  }, [currentPromptSession]);

  // ── Leaving with unsaved work: force a decision ───────────────────────────
  // Closing the tab or reloading used to take the work with it, silently. The
  // browser owns the wording here (Save/Discard are not ours to draw at this
  // level), but the CONDITION is the same ref every other gate reads — one truth
  // about what "unsaved" means, so the repair gate, the in-app navigations that
  // go through the assembler, and the exit all agree.
  //
  // The in-app half already works: any surface change calls the assembler with
  // has_unsaved_changes, and the backend answers with a Save / Discard / Cancel
  // decision surface (routes/ai.py:213) when there is something to lose.
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedChangesRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // Track changes to prompt content
  useEffect(() => {
    // Remove the session check - we want to track changes even without a session
    const handleContentChange = () => {
      console.log('📝 [SAVE] Content changed, marking as unsaved');
      hasUnsavedChangesRef.current = true;
    };

    // Listen for any changes in the prompt builder
    //
    // The composer's fields live in SHADOW DOM: prompt-section-editor →
    // prompt-input-section → prompt-textarea → the real <textarea>. An `input`
    // event that reaches `document` is RETARGETED to the shadow host on the way
    // out, so `e.target` is the custom element and never the TEXTAREA. The old
    // `e.target.tagName === 'TEXTAREA'` test therefore could not pass for the one
    // surface it was written for: typing in a prompt never armed
    // hasUnsavedChangesRef, so nothing downstream believed there was anything to
    // lose — no save prompt on exit, and "Repair" replaced the column without
    // asking. `composedPath()[0]` is the real target, inside the shadow tree.
    const handleInputEvent = (e: Event) => {
      const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
      const origin = (path[0] ?? e.target) as HTMLElement | undefined;
      if (!origin) return;

      const isField = origin.tagName === 'TEXTAREA' || origin.tagName === 'INPUT';
      if (!isField) return;

      // The section marker can sit on the host OR inside the path (the editor
      // stamps data-section-name on each <prompt-input-section>).
      const inSection = path.some(
        (n) => n instanceof HTMLElement && n.hasAttribute && n.hasAttribute('data-section-name'),
      ) || !!origin.closest?.('[data-section-name]');

      if (inSection) handleContentChange();
    };

    // CRITICAL: Handle loading content from database into textareas
    const handleLoadSectionContent = (e: CustomEvent) => {
      const { target, content, sessionId } = e.detail;
      console.log('🔄 [LOAD] Received load-section-content event:', { target, contentLength: content?.length, sessionId });

      // Use the proper event system to set content in React components
      // The force-set-section event is handled by AutoResizeTextarea component
      window.dispatchEvent(new CustomEvent('force-set-section', {
        detail: {
          sectionName: target,
          content: content || '',
          override: true
        }
      }));
      console.log(`✅ [LOAD] Dispatched force-set-section event for "${target}" with ${content?.length || 0} chars`);
    };

    // Add listeners for input changes
    document.addEventListener('input', handleInputEvent);
    window.addEventListener('load-section-content', handleLoadSectionContent as EventListener);
    // Also listen for custom events that indicate changes
    window.addEventListener('prompt-content-changed', handleContentChange);
    window.addEventListener('add-prompt-role', handleContentChange);
    window.addEventListener('remove-prompt-role', handleContentChange);

    return () => {
      document.removeEventListener('input', handleInputEvent);
      window.removeEventListener('load-section-content', handleLoadSectionContent as EventListener);
      window.removeEventListener('prompt-content-changed', handleContentChange);
      window.removeEventListener('add-prompt-role', handleContentChange);
      window.removeEventListener('remove-prompt-role', handleContentChange);
    };
  }, []); // Empty dependency array - always listen

  // VersionManager dispatches 'restore-output' when a version is restored. The
  // event had no listener anywhere in the app, so restoring rolled the row back
  // in Postgres while the middle column kept showing the newer output until a
  // manual reload — the screen disagreed with the database.
  useEffect(() => {
    const handleRestoreOutput = (e: Event) => {
      const content = (e as CustomEvent).detail?.content ?? '';
      setCurrentPromptSession(prev => (prev ? { ...prev, compiledOutput: content } : prev));
      console.log(`🔄 [RESTORE] Middle column set from restored version (${content.length} chars)`);
    };
    window.addEventListener('restore-output', handleRestoreOutput);
    return () => window.removeEventListener('restore-output', handleRestoreOutput);
  }, []);

  // Log last AI command for debugging (toast on blocked commands)
  useEffect(() => {
    if (!lastCommand) return;
    console.log('[AI Orchestrator] Last command:', lastCommand.tag, lastCommand.props);
  }, [lastCommand]);

  const handlePromptTitleChange = async (newTitle: string) => {
    // Serialization guard: share mutex with handleSavePrompt to prevent double-record race
    if (isSavingRef.current) {
      console.log('⏸️ [CRUD] Title change skipped — save already in flight');
      return;
    }
    if (!currentPromptSession?.id) {
      // No session with a valid ID — create one via the AI save pipeline
      // (sections come from the surface's data model, same as save-template)
      const sections = surfaceSections();
      try {
        const result = await promptService.savePromptTemplate(
          newTitle,
          sections.map((s: any) => ({ id: s.id || s.name, type: s.name || s.role, content: s.content || '' })),
          {
            title: newTitle,
            // No description. This call used to stamp
            // `Prompt with ${sections.length} sections` into the row, which reads
            // like a summary of the package but describes only how many sections
            // it happens to have. The backend keeps the model's description or
            // nothing; it does not invent one.
          }
        );
        if (result.session) {
          setCurrentPromptSession(result.session);
          console.log('✅ [CRUD] Created session from title:', result.session?.id);
        }
      } catch (error) {
        console.error('❌ [CRUD] Failed to create prompt from title:', error);
      }
      return;
    }
    try {
      console.log('📝 [CRUD] Renaming session:', currentPromptSession.id, '→', newTitle);
      // Direct PUT to backend — don't use updatePromptSession which
      // constructs a return value that wipes leftColumnContent etc.
      await fetch(`${API_BASE}/prompt-sessions/${currentPromptSession.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
        },
        body: JSON.stringify({ title: newTitle }),
      });
      // Merge new title into existing session — don't replace entire object
      setCurrentPromptSession(prev => prev ? { ...prev, title: newTitle, updatedAt: new Date().toISOString() } : prev);
      // The card on screen is drawn from the surface's data model, so that is where
      // a rename has to land to be visible at all. This used to patch a React copy
      // of the card list instead — so the title on screen kept the old value while
      // the copy (and the picture of the library in Grace's seat) said otherwise.
      // Writing /cards re-resolves the grid's binding, and the drawn card states
      // the new title immediately.
      setConsoleTree((prev) => {
        const cards = Array.isArray(prev.dataModel.cards) ? prev.dataModel.cards : null;
        if (!cards) return prev; // no console surface to update
        return {
          ...prev,
          dataModel: {
            ...prev.dataModel,
            cards: cards.map((card: any) =>
              card?.id === currentPromptSession.id ? { ...card, title: newTitle } : card
            ),
          },
        };
      });
      console.log('✅ [CRUD] Renamed session:', currentPromptSession.id);
    } catch (error) {
      console.error('❌ [CRUD] Failed to update prompt title:', error);
    }
  };

  // Store loaded sections for injection after remount
  const pendingSectionsRef = useRef<Array<{ content: string; target: string }>>([]);

  // Dispatch pending sections into existing textareas when workspace mounts.
  // Do NOT arm the exit gate here — only user edits should trigger that.
  useEffect(() => {
    if (headerTab !== "composer") return;
    if (promptLoadKey === 0) return;

    if (pendingSectionsRef.current.length === 0) return;

    const dispatchSections = () => {
      for (const section of pendingSectionsRef.current) {
        if (section.target && section.content) {
          window.dispatchEvent(new CustomEvent('set-left-column-text', {
            detail: { content: section.content, target: section.target },
          }));
        }
      }
    };

    // Wait for React to mount textareas and register listeners
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        dispatchSections();
        setTimeout(dispatchSections, 300);
      });
    });
    pendingSectionsRef.current = [];
  }, [promptLoadKey, headerTab]);

  // ── A2UI: Push sections into the composer column through the surface ───────
  // This wrote `sections` as a PROPERTY on the <prompt-section-editor> element,
  // because declarative prop passing to custom elements can be unreliable for
  // complex arrays. The element is inside the renderer's shadow root now, so the
  // write goes to the model the renderer binds it from — same value, one step
  // earlier, and it survives the renderer rebuilding the element.
  useEffect(() => {
    if (headerTab !== 'composer') return;

    // A repair prompt OWNS the column until the user Runs, Saves, or opens
    // another package. This check has to live HERE and not only in the click
    // handler: render-composer builds the composer from the backend, so its
    // starter sections arrive after the repair and would overwrite it.
    if (repairSectionsRef.current) {
      writeSectionsToSurface(repairSectionsRef.current);
      return;
    }

    // ── THE SESSION'S COPY IS A SEED, NOT AN OVERWRITER ─────────────────────
    //
    // This used to re-apply `currentPromptSession.leftColumnContent` whenever it was
    // present, and the effect's deps include `headerTab` — so leaving the composer and
    // coming back re-ran it and wrote the session's serialized copy OVER a column the
    // model had since moved past. A keystroke updates the MODEL (see the write half of
    // the read/write contract below) but not that serialized string, so a tab round-trip
    // could quietly restore older text. The model is the source of truth for the current
    // state (Handling-User-Actions.md); the session's copy is what a package OPENS with —
    // so it is written only when the column has nothing at all.
    if (surfaceSections().length > 0) return;

    try {
      const raw = currentPromptSession?.leftColumnContent 
        ? JSON.parse(currentPromptSession.leftColumnContent).sections || [] 
        : [];
      const normalized = raw
        .map((s: any) => s && typeof s === 'object' ? {
          name: s.name || s.section || s.role || s.type || 'Section',
          content: s.content || '',
          type: s.type || s.role || s.name || 'custom',
          position: s.position,
          visible: s.visible !== false,
        } : null)
        .filter(Boolean);
      // Only override if we have real data; let the surface keep its seeded defaults otherwise
      if (normalized.length > 0) {
        console.log('[A2UI] Writing sections into the composer column:', normalized.length);
        writeSectionsToSurface(normalized);
      }
    } catch (e) {
      console.warn('[A2UI] Failed to write sections into the composer column', e);
    }
  }, [currentPromptSession?.leftColumnContent, promptLoadKey, headerTab, writeSectionsToSurface]);

  // ── Every write into the column lands back in the repair prompt we hold ────
  //
  // The re-assert just below keeps a repair prompt in the column while surfaces swap,
  // and it compares the editor's text with `repairSectionsRef.current`. Until this
  // listener existed the ref held ONLY what the repair launched with, so the first edit
  // inside that prompt — a keystroke, or an answer Grace files from the chat — was undone
  // by the next commit: the text quietly returned to its launch state. `section-update`
  // is emitted for every content change, whoever made it, so reading it here makes the
  // ref the truth it already claims to be.
  useEffect(() => {
    const handler = (e: Event) => {
      const { index, section } = (e as CustomEvent).detail || {};

      // ── THE WRITE HALF OF THE READ/WRITE CONTRACT ──────────────────────────
      // Handling-User-Actions.md: "As soon as a user interacts … the renderer
      // IMMEDIATELY writes the new value into the local Data Model … the local model is
      // always the source of truth for the UI's current state."
      //
      // This listener did not write anything. It updated the repair copy and armed the
      // unsaved flag, so a keystroke lived in the element and NOWHERE ELSE — and every
      // reader of the model got the text from before the edit, including the save path's
      // `surfaceSections()`. That is how a package gets written with 42 characters while
      // a person watches their prompt on screen. Measured 2026-09-17: typing "ZQ" into
      // System Role left the element holding 2 characters and the model still holding 0.
      if (typeof index === 'number' && index >= 0 && section) {
        const held = surfaceSections();
        if (index < held.length) {
          const next = held.slice();
          next[index] = { ...next[index], ...section };
          writeSectionsToSurface(next);
        }
      }

      const held = repairSectionsRef.current;
      if (!held || !section || typeof index !== 'number' || index < 0 || index >= held.length) return;
      const next = held.slice();
      next[index] = { ...next[index], ...section };
      repairSectionsRef.current = next;
      // A write into a prompt is a change to it, whoever made it. A keystroke arms this
      // flag through the input listener elsewhere in this file; a value filed from the
      // chat is written programmatically, so nothing else here would know the saved
      // package is now one edit behind the column.
      hasUnsavedChangesRef.current = true;
    };
    window.addEventListener('section-update', handler);
    return () => window.removeEventListener('section-update', handler);
    // The writers are re-created when the model changes, so the listener is re-registered
    // with them: a handler holding the first render's copy would write from the model as
    // it was when the page loaded.
  }, [surfaceSections, writeSectionsToSurface]);

  // ── Keep a repair prompt in the column ────────────────────────────────────
  // No dependency array, on purpose: this re-asserts AFTER EVERY COMMIT.
  //
  // The repair is pushed imperatively, and a push is a MOMENT, not a state. Any
  // later render can replace what the editor holds — the composer re-asserts the
  // session's own sections when an assembly lands, and <ai-surface-sandbox> swaps
  // which slot it projects while one is in flight. Declared AFTER every other
  // section writer so it runs last in each commit and the repair wins.
  useEffect(() => {
    const want = repairSectionsRef.current;
    if (!want) return;
    // The equality check that used to guard this write now lives inside the
    // writer, where it can compare against what the model actually holds.
    writeSectionsToSurface(want);
  });

  // ══════════════════════════════════════════════════════════════════════════
  // Repair → a prompt, not a fix
  // ══════════════════════════════════════════════════════════════════════════
  // A finding is a report. Its "Repair" button applies NOTHING — it turns the
  // finding into the prompt that would repair it and puts that prompt in the left
  // column, so the user can read it, change it, and Run it like any other prompt.
  //
  // The check has ALREADY run, and its verdict is why the finding is in the queue.
  // So the prompt does not repeat it: the four seats carry the CORRECTION and
  // nothing else, assembled by @/shared/repairSections — which is where the seats
  // and their contents are declared, and where a test holds them to that.
  // (Lit-to-figma-trace-plan, Step 4 — "Repair becomes a prompt".)
  //
  // Once that prompt is Run, the finding is settled against a FRESH check. The check
  // that raised a finding is the only thing in this app that can say it is fixed:
  // the click queues it, the run corrects it, and the next report either derives it
  // or does not. Nothing else moves it to done — least of all a model saying so.
  //
  // These live at component scope, NOT inside the listener useEffect where
  // handleRunRequested/handleSaveRequested are declared: the JSX below calls
  // handleRepairFinding directly, and a const inside that effect is not visible
  // to the render.

  /**
   * Say a repair's outcome in the chat, in plain words.
   *
   * The answer's own RESULT line says what the model DID. This says what the check
   * FOUND — and that is the only one of the two that can tell a person their problem is
   * gone. It lives beside settleRepair because it is the same act: a verdict that exists
   * only as a console line is not a verdict anyone read.
   */
  const speakRepairVerdict = (content: string) => {
    window.dispatchEvent(new CustomEvent('a2ui:system-message', {
      detail: { role: 'assistant', content },
    }));
  };

  /**
   * Settle a repair that has just finished, against a fresh check.
   *
   * The finding is 'done' only when a new report stops deriving it. A checker that
   * could not run settles NOTHING: the finding stays in repair rather than being
   * reported as fixed on no evidence.
   */
  const settleRepair = async (findingId: string) => {
    const health = await fetchCatalogHealth();
    if (health.state !== 'ok') {
      console.warn(`[repair] the check did not answer — ${findingId} stays in repair`);
      // Said out loud, in plain words. The verdict is the whole point of pressing Run,
      // and this path used to end in a console line — so from the chat seat a repair
      // that could not be checked looked exactly like one that worked.
      speakRepairVerdict('Not checked — the check did not answer. Still on the list.');
      return;
    }
    const stillDerived = health.report.findings.map((f) => f.id);
    setRepairStages((s) => settleRepairs(s, [findingId], stillDerived));
    const stillThere = stillDerived.includes(findingId);
    console.log(
      `[repair] ${findingId} settled against ${stillDerived.length} open finding(s) — ` +
      `${stillThere ? 'still derived, so still in repair' : 'done'}`
    );
    // And the person is told, here, in the same three words the answer uses: the model's
    // own RESULT line says what it DID, this says what the check FOUND. Only one of them
    // can tell you the problem is gone, and it is not the model's.
    speakRepairVerdict(
      stillThere
        ? 'Not done — the fresh check still finds it.'
        : 'Done — the fresh check no longer finds it.'
    );

    // The verdict the canvas waits for. The node's mark and this sentence are the
    // same fact — the fresh report — so nothing can go green on a hunch. A checker
    // that did not answer returned above and settles nothing, here as everywhere.
    if (flowInputRef.current) {
      flowFactsRef.current = {
        ...flowFactsRef.current,
        verdict: {
          cleared: !stillThere,
          sentence: stillThere ? 'the fresh check still finds it' : 'the fresh check no longer finds it',
        },
      };
      publishFlowRef.current();
    }
  };

  /**
   * The answer's file, written back to disk — the step that makes a repair real.
   *
   * Everything before this point in the flow ends in text: the prompt is text, the
   * answer is text, and a person reading it has no way to know whether a file
   * exists at the end of it. This is the end of it. The answer has to hand back
   * the WHOLE file, the app writes it over the old one, and every sentence spoken
   * here is built from what the write actually returned — there is no path through
   * this function that says a file changed without one having changed.
   *
   * Five things can stop a write, and each one is said out loud instead of silently
   * skipped, because "nothing happened" and "it worked" must never look alike:
   *
   *   no file in the answer     the model described the change instead of making it
   *                             (exactly the failure this all started as);
   *   a different file          the answer rewrote something the finding is not about;
   *   the file could not be read  nothing to compare against, so nothing to replace;
   *   the file looks wrong      cut off, a patch, or unchanged — refused before a byte moves;
   *   the server refused it     same judgement, made again where the write happens.
   */
  /**
   * What a write attempt leaves behind.
   *
   * `report` is the SERVER's own account of the write — path, bytes, backup, line
   * counts — and it is absent, not zero, when nothing was written. The flow's Data
   * insert node reads this and nothing else, which is why the distinction matters:
   * a missing report must never be drawn as a write of no bytes.
   */
  type WriteOutcome = {
    written: boolean;
    checked: boolean;
    report?: { path: string; bytes?: number; backup?: string; linesBefore?: number; linesAfter?: number };
  };

  const writeAnswerBack = async (answer: string, findingId: string): Promise<WriteOutcome> => {
    const finding = (catalogFindings || []).find((f: any) => f.id === findingId);
    const target = finding?.file as string | undefined;
    const correction = correctionFromAnswer(answer);
    const nothing: WriteOutcome = { written: false, checked: false };

    if (!correction) {
      speakRepairVerdict('Nothing written — the answer had no file in it.');
      return nothing;
    }
    if (target && correction.path !== target) {
      speakRepairVerdict(
        `Nothing written — the answer rewrote \`${correction.path}\`, not \`${target}\`.`,
      );
      return nothing;
    }

    // Read the file again, fresh, and compare against THAT: the prompt carried the
    // file as it was when the prompt was built, and this is what is on disk now.
    const original = await readRepairTarget(correction.path);
    if (original === null) {
      speakRepairVerdict(`Nothing written — could not read \`${correction.path}\`.`);
      return nothing;
    }

    const ready = applyReadiness(original, correction.content);
    if (ready.ok === false) {
      speakRepairVerdict(`Nothing written — the answer ${ready.reason}.`);
      console.warn(`[repair] refused before writing ${correction.path}: ${ready.reason}`);
      return nothing;
    }

    const result = await applyRepair({ path: correction.path, content: ready.content });
    if (!result.ok) {
      speakRepairVerdict(`Nothing written — ${result.reason}.`);
      console.warn(`[repair] the write was refused for ${correction.path}: ${result.reason}`);
      return nothing;
    }

    // The check ran as part of the write (the report the app reads is a FILE the
    // checker writes — see rerun_catalog_check), so the verdict spoken next is read
    // off the file that exists NOW. When it did not run, there is no verdict to give,
    // and this says that instead of reading an old report and calling it fresh.
    const checked = result.check?.ran === true;
    speakRepairVerdict(
      `Written \`${result.path}\` — ${result.lines_after} lines (was ${result.lines_before}), ` +
      `backup \`${result.backup}\`.` +
      (checked
        ? ""
        : ` Check did not run (${result.check?.why || "no reason given"}) — still on the list.`),
    );
    console.log(
      `[repair] WROTE ${result.path}: ${result.lines_before} -> ${result.lines_after} lines ` +
      `(backup ${result.backup}) · check ${checked ? result.check?.verdict : "did not run"}`,
    );
    return {
      written: true,
      checked,
      // The server's own report of what it wrote, carried out of here so the flow's
      // Data insert node can draw what actually happened — the path, the bytes, the
      // backup and the line counts, not a sentence about them.
      report: {
        path: result.path ?? correction.path,
        bytes: result.bytes,
        backup: result.backup,
        linesBefore: result.lines_before,
        linesAfter: result.lines_after,
      },
    };
  };

  /**
   * Write the repair prompt into the composer column.
   *
   * This used to retry the write across three rAF/timeout passes, because the
   * element mounted only after the composer assembled and a single attempt could
   * land while the ref was still null. There is no element to wait for now: the
   * write lands in the surface's data model, and the renderer binds it whenever
   * the column is next drawn — a state update does not need a retry to survive.
   */
  const pushRepairSections = (sections: any[]) => {
    writeSectionsToSurface(sections);
  };

  /**
   * Repair a finding → fill the left column with the prompt that would fix it.
   *
   * `surfaceContext` preserves what each call site already passed to the
   * assembler: the composer chat stays in the open package, the console chat
   * opens a fresh one.
   */
  const handleRepairFinding = async (
    findingId: string,
    surfaceContext?: { current_surface?: string; session_id?: string | null; session_title?: string },
  ) => {
    const finding = (catalogFindings || []).find((f: any) => f.id === findingId);
    if (!finding) {
      // The report moved under us. Say so rather than opening a composer that
      // pretends to hold a finding it does not have.
      console.warn('[repair] finding is no longer in the report:', findingId);
      return;
    }

    // ── The file, read BEFORE the prompt is built ─────────────────────────────
    //
    // The answer has to hand back the WHOLE file, because that is the only thing the
    // app can write over the old one without guessing what was already there — and a
    // model cannot hand back a file it has never seen. So the file is read here and
    // carried in the prompt's Agent seat (see buildRepairSections).
    //
    // `null` is not an error to throw: it is a fact the prompt states, and the honest
    // answer to a prompt carrying no file is COULD NOT CHECK. The seat says exactly
    // that when this comes back empty, so the run that cannot write says so instead of
    // printing a corrected file it invented from a component name.
    const fileText = finding.file ? await readRepairTarget(finding.file) : null;
    if (finding.file && !fileText) {
      console.warn(
        `[repair] could not read ${finding.file} — nothing can be written to it, ` +
        "and the prompt will ask for COULD NOT CHECK instead of a file",
      );
    }

    const sections = buildRepairSections(finding, fileText || undefined);
    repairSectionsRef.current = sections;

    // Every repair names itself, from the finding it came from.
    //
    // A fresh package otherwise inherits whatever the composer's blank-surface
    // suggestion is ("Untitled Prompt", "New Prompt Agent"), and a list of those
    // says nothing a week later about which repair was which — or which ones were
    // never finished. This is the name that gets SAVED, so it is set here and not
    // left to the model to guess.
    const repairTitle = `Repair — ${finding.check}${finding.component ? ` on ${finding.component}` : ''}`;
    repairTitleRef.current = repairTitle;
    console.log(
      `[repair] ${findingId} → "${repairTitle}" · ` +
      `${sections.filter((s) => (s.content || '').trim()).length}/${sections.length} sections with content ` +
      'written into the left column. Press Run to compile them.'
    );

    // Open the composer FIRST — the editor does not exist until the surface does.
    //
    // Which package this repair lands in: the same expression the assembly is handed
    // below, read here as well because the launch save depends on it. A repair that
    // targets nothing opens a FRESH package, and that is the only case this file
    // writes down on its own: repairing from inside an open package is an edit of
    // that package, and an edit is saved when the person says so.
    const repairTargetSessionId = surfaceContext?.session_id !== undefined
      ? surfaceContext.session_id
      : (currentPromptSession?.id || null);
    const repairOpensFreshPackage = !repairTargetSessionId;

    // ── ONE FACT SET, TWO READERS ─────────────────────────────────────────────
    // Both are computed from the same finding, in the same module, so they cannot come
    // to describe different forms. `repairBrief` is read by the model that GUIDES the
    // person, and it rides the composer assembly this click already makes — her greeting
    // costs no second model call and no second timeout budget. `repairAsk` is read by
    // the PERSON; its buttons are the deterministic half and stay app-rendered, because
    // a model must never generate the answer set.
    const userSeat = sections.find((s: any) => s.type === 'user');
    const repairSeatName = userSeat?.name || 'User';
    const ask = repairAsk(finding, repairSeatName, userSeat?.content);
    const brief = repairBrief(finding, repairSeatName, userSeat?.content);
    // The buttons are built HERE, while the seat name is in hand, and the ask is held
    // with them so the reply path needs no second lookup. They stay app-rendered: a
    // model must never generate the answer set.
    const repairAskButtons = ask
      ? ask.answers
          .map((a) => actionLink(a.label, fillFieldAction(repairSeatName, a.field, a.value.join('\n'))))
          .join('  ')
      : '';
    repairAskRef.current = ask ? { text: ask.text, buttons: repairAskButtons } : null;
    console.log(
      `[repair] ${repairSeatName}: ` +
      `${brief ? `${brief.length} line(s) of brief riding the assembly` : 'nothing open — no brief'} · ` +
      `${ask ? `${ask.answers.length} answer button(s)` : 'no buttons'}`,
    );

    await assembleSurfaceThenRepairs('render-composer', {
      current_surface: surfaceContext?.current_surface ?? (headerTab || 'composer'),
      has_unsaved_changes: hasUnsavedChangesRef.current,
      session_id: repairTargetSessionId,
      session_title: surfaceContext?.session_title || repairTitle,
      repair_brief: brief,
    });

    // The NAME was settled by the composer branch when the surface landed — it has
    // to survive the unsaved-changes gate, which can stop this click entirely. All
    // that is left here is the prompt itself: the re-assert effect keeps it in the
    // column, so this push only has to survive the mount.
    pushRepairSections(sections);

    // ── LAUNCHED = WRITTEN DOWN ───────────────────────────────────────────────
    // The prompt is in the column, so it is saved NOW — not left for Run to create
    // on the way past.
    //
    // Run is save-then-run when a package has never been saved, and that made the
    // package's existence depend on a click that arrives later, through an editor
    // that is a moment rather than a state: a Run landing while the column was
    // swapping read back no sections, saved nothing, and reported "saving failed"
    // for a payload it never sent. The person then had a prompt they could read and
    // could not run. Saving here removes the dependency: what Run runs already
    // exists, under the repair's own name, and shows up in the console list before
    // anything is executed.
    //
    // Queued behind any save already in flight, because the guard in handleSavePrompt
    // waits for that save and then returns — calling it now would drop THIS payload.
    if (repairOpensFreshPackage) {
      const writeItDown = (attempt = 0) => {
        if (isSavingRef.current && attempt < 40) {
          setTimeout(() => writeItDown(attempt + 1), 300);
          return;
        }
        console.log(`[repair] writing "${repairTitle}" down at launch so Run has a package to run in`);
        void handleSavePromptRef.current?.('', sections, { keepSurface: true, title: repairTitle });
      };
      writeItDown();
    }

    // ── THE ASK DOES NOT SPEAK FOR HER ANY MORE ───────────────────────────────
    // It used to be posted here, as a template with `role: 'assistant'` — a sentence
    // wearing her name that she had no record of saying, because it never went through
    // the model and never entered her context. The sentence is hers now: the brief above
    // rides the assembly and comes back as her `ai_message`.
    //
    // What waits here is the half she must NOT author — one button per answer, wired to
    // `fill-field`, which writes the value under that field's label when pressed. A model
    // generating the answer set would be a model choosing what a repair may say.
    //
    // Held rather than posted, so her greeting and these buttons arrive as ONE turn. The
    // reply consumes it; the assembly-failure path falls back to it, so a repair whose
    // assembly gives up still tells the person what is missing. (Already set above, with
    // the buttons — nothing to do here.)

    // CLICKED = QUEUED. The finding is in repair from here, and the Run that answers
    // this prompt is what settles it (see settleRepair). Held in a ref rather than in
    // state for the same reason the sections are: this click can be interrupted by the
    // unsaved-changes gate and resumed, and the Run still has to know what it repairs.
    repairFindingRef.current = findingId;
    setRepairStages((s) => queuedRepair(s, findingId));
  };

  const handleOpenPromptFromConsole = async (sessionId: string) => {
    // ══════════════════════════════════════════════════════════════════════════
    // A2UI v0.9: Open session via unified surface assembly
    // ══════════════════════════════════════════════════════════════════════════
    console.log(`🤖 [A2UI] Opening session → intent: render-session:${sessionId}`);
    // Opening a package ends any repair: the repair prompt belongs to the finding
    // that produced it, not to the package being opened — so the finding it came from
    // is released with it, and a Run of this package settles nothing.
    repairSectionsRef.current = null;
    repairFindingRef.current = null;
    await assembleSurfaceThenRepairs(`render-session:${sessionId}`);

    // Force full re-render to dispatch sections to textareas
    setPromptLoadKey(k => k + 1);
  };

  // DELETED: handleLoadPromptSession - was database fallback bypassing AI assembly
  // All session loads MUST go through AI assembly via handleOpenPromptFromConsole

  // DELETED: Load session from route - was database fallback bypassing AI assembly
  // All session loads MUST go through AI assembly via handleOpenPromptFromConsole
  useEffect(() => {
    if (routeSessionId) {
      handleOpenPromptFromConsole(routeSessionId);
    }
  }, [routeSessionId, handleOpenPromptFromConsole]);

  // ══════════════════════════════════════════════════════════════════════════
  // A2UI v0.9 STRICT: NO LEGACY DIRECT DB LOADS
  // All surface loads (including routeSessionId) MUST go through assembleSurfaceWithAI.
  // The effect below that called promptService.getPromptSession directly has been removed.
  // It was a bypass that fought the model-orchestrated path and caused state races.
  // ══════════════════════════════════════════════════════════════════════════
  // (Legacy direct fetch removed per A2UI compliance. See handleOpenPromptFromConsole + initial mount.)

  // Auto-create prompt from title query param (e.g., /prompts?title=My+Prompt)
  useEffect(() => {
    const titleParam = searchParams.get('title');
    // No longer using /prompts/new - AI handles initialization
    if (titleParam && !currentPromptSession) {
      handleCreateNewPrompt(titleParam);
      // Clear the param so it doesn't re-trigger on remount
      setSearchParams({}, { replace: true });
    }
  }, [searchParams]);

  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // A2UI: AI-driven decision dialog state
  const [aiDecision, setAiDecision] = useState<{
    show: boolean;
    message: string;
    actions: Array<{ id: string; label: string; variant: string }>;
    pending_intent: string;
    decision_type: string;
    session_id: string | null;
  } | null>(null);

  // The console seat's resize/collapse handlers lived here (the ref-attached
  // ResizeObserver, the proportional-width follow, the grip drag, and the
  // rail's tab-change / collapse-toggle wiring). They are deleted, not archived:
  // no separate file held them — they were this component's own code, and the
  // seat they drove is already in the archive.
  //
  // The React seat itself is NOT here and does not need moving: it was retired on
  // 2026-09-17 to retired-files/console-seat-20260917/InteractiveChatInterface.tsx,
  // with the README beside it. This file stopped mounting it in the same move.

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI v0.9 UNIFIED SURFACE ASSEMBLY
  // ═══════════════════════════════════════════════════════════════════════════
  // AI ASSEMBLY — current state (2026-08-01 honest audit):
  //
  // TRUE:  AI decides *data* for each intent (cards, sections, messages).
  // TRUE:  On AI failure, the surface returns 503 — no fake fallback rendering.
  //
  // "AI is the ARCHITECT" — the frame belongs to the SURFACE now, not to this shell. The
  // assemblers in backend/routes/ai.py emit it, and this file renders only the HOST that
  // the tree is handed to:
  //     - <workspace-layout>, the three-column frame, whose panes are NAMED slots
  //     - <prompt-section-editor> in slot="left"
  //     - <control-bar> in slot="left-footer" — the bottom of the left column, where the
  //       design puts it ("left-column-panel-container" #40000954:23865 carries the
  //       "Left-column-ControlBar" as its LAST child)
  //     - <compiled-output-viewer> in slot="middle"
  //     - <chat-panel> in slot="right"
  //   This list is the model's to change, which is why it can grow — the control bar
  //   arrived here without this component being edited. (It WAS edited once, to remove a
  //   hardcoded tree; naming an element in a comment is not a mount, and the checker
  //   reads comments as claims — see READ-ME/TRACE-VIEW.md.)
  // DISCOVERY GOAL: For A2UI to be real, AI must control the *component tree*
  //   (which components, in what arrangement), not just the *data* inside a
  //   fixed frame. The hardcoded JSX is a scaffold during development —
  //   the AI should eventually emit the component tree itself.
  //
  // Intents: "render-console", "render-composer", "render-session:{id}"
  // ═══════════════════════════════════════════════════════════════════════════
  const assembleSurfaceWithAI = useCallback(async (intent: string, context?: {
    current_surface?: string;
    has_unsaved_changes?: boolean;
    session_id?: string | null;
    session_title?: string;
    category?: string;
    /** The repair brief — see `repairBrief`. Carried only when a repair launched this
     *  assembly, and declared here because a field the model does not declare is dropped
     *  in silence (see AISurfaceContext in backend/routes/ai.py). */
    repair_brief?: string[] | null;
  }) => {
    // ✅ DEDUP: If already in flight, skip (user spamming refresh)
    if (isConsoleAssemblyInFlightRef.current) {
      console.log('🤖 [A2UI] Request already in flight - skipping duplicate');
      return;
    }

    // ✅ ABORT: Cancel any previous request that might still be pending
    if (consoleAssemblyControllerRef.current) {
      console.log('🤖 [A2UI] Aborting previous request');
      consoleAssemblyControllerRef.current.abort();
    }

    console.log(`🤖 [A2UI] Assembling surface with intent: ${intent}`, context ? `context: ${JSON.stringify(context)}` : '');
    isConsoleAssemblyInFlightRef.current = true;
    setIsAIAssembling(true);
    setAiAssemblyFailed(false);
    setAiAssemblyReport(null);
    setIsFailureAcknowledged(false);
    // Recorded so Retry re-runs the request that actually failed rather than a guess.
    lastAssemblyIntentRef.current = intent;
    setAiAssemblyMessage(AI_STANDBY_MESSAGE);

    // Create new abort controller for this request
    const controller = new AbortController();
    consoleAssemblyControllerRef.current = controller;

    // Client-side timeout: ASSEMBLY_TIMEOUT_MS (120s, declared at the top of this file).
    //
    // This cap is the OUTER bound and it is deliberately loose: it exists to stop a
    // request that is truly dead, not to police latency. THE REAL BUDGET IS THE
    // SERVER'S — grace_gui.LLM_TIMEOUT is 20s per attempt with max_retries=1, so a
    // surface gives up at 40s worst case and returns its own 503 naming the budget that
    // expired. A client cap BELOW the server's is the failure mode this number exists
    // to avoid: it aborts a call the backend goes on to finish, and the abort reads as
    // a network failure rather than a timeout with a reason. That is what happened when
    // this was 10s against a cold call measured at ~13.5s.
    //
    // The catalog check does NOT come through here — it has its own fetch with
    // no client cap, because it can legitimately run long (measured 5.4–17.4s on
    // a 12 KB prompt). If it ever moves back onto this path, revisit this number.
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    // Transport facts, carried to the catch as FACTS rather than re-derived from the thrown
    // message. The message is for humans; this is for the reader (shared/error-registry).
    // Declared here because the catch is the only place that classifies a failure, and by
    // then `response` is long out of scope.
    let failureTransport: { httpStatus?: number; body?: unknown; rawBody?: string } = {};

    try {
      timeoutId = setTimeout(() => controller.abort(), ASSEMBLY_TIMEOUT_MS);

      // ═══════════════════════════════════════════════════════════════════
      // SINGLE UNIFIED ENDPOINT - A2UI v0.9 COMPLIANT
      // Include context so AI knows about unsaved changes
      // ═══════════════════════════════════════════════════════════════════
      const response = await fetch(`${API_BASE}/ai/assemble-surface?limit=500`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
        },
        body: JSON.stringify({ intent, context }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // Read the body as TEXT first.
        //
        // The previous version called response.json() inside a bare `catch {}` and fell back
        // to the bare status string. Two consequences, both live and both verified: a
        // non-JSON error page was discarded entirely, and the §1 envelope — an OBJECT —
        // stringified to "[object Object]", so all four of its fields were lost at the last
        // meter. That is also why the "A2UI FAILURE:" branch in the catch below could never
        // match: the throw site emitted a different prefix. text() cannot fail that way.
        const rawBody = await response.text();
        let parsedBody: unknown;
        try {
          parsedBody = JSON.parse(rawBody);
        } catch {
          // Not JSON. rawBody already holds the truth; parsedBody stays undefined and the
          // classifier falls back to status + raw text instead of inventing a shape.
        }
        failureTransport = {
          httpStatus: response.status,
          body: parsedBody,
          rawBody,
        };
        console.error('🔴 [A2UI] Backend error', response.status, parsedBody ?? rawBody);

        // §1 says the envelope's `message` is the human sentence — prefer it. Never let its
        // absence collapse the status into a bare number: the raw body is the fallback.
        const envelope = parseValidationEnvelope(parsedBody);
        const detailFromBody =
          typeof parsedBody === 'object' && parsedBody !== null
            ? (parsedBody as { detail?: unknown }).detail
            : undefined;
        throw new Error(
          envelope?.message
            ?? (typeof detailFromBody === 'string' ? detailFromBody : undefined)
            ?? (rawBody.trim() || `${response.status} ${response.statusText}`),
        );
      }

      const rawData = await response.json();

      // ═══════════════════════════════════════════════════════════════════
      // A2UI v0.9.1 ENVELOPE BOUNDARY — version and surface are read, not assumed.
      //
      // Every operation is labeled with the format version it is written in and
      // the surface it belongs to. Both labels used to be ignored: the operations
      // were piled together, the last updateComponents and the last
      // updateDataModel won, and *which surface was on screen* was guessed from
      // the shape of the data model. So a v1.0 answer drew silently as v0.9.1,
      // and an answer carrying two surfaces became one pile holding parts of
      // each. readA2UIEnvelope() reads both labels and REFUSES rather than
      // guessing — see src/shared/a2ui-envelope.ts for the wire shape.
      // ═══════════════════════════════════════════════════════════════════
      const read = readA2UIEnvelope(rawData);
      // `read.ok === false`, not `!read.ok`: this project compiles with
      // strictNullChecks off, where truthiness does not narrow a union — only
      // equality against the literal does.
      if (read.ok === false) {
        const { code, message, detail } = read.refusal;
        console.error(
          `🤖 [A2UI] ENVELOPE REFUSED — ${code}\n` +
          `  ${message}\n` +
          `  detail: ${JSON.stringify(detail)}\n` +
          `  CAUSE: ${
            code === 'UNSUPPORTED-VERSION'
              ? 'the answer is written in a format version this shell does not implement'
              : 'the answer describes surfaces this shell cannot hold at once'
          }.\n` +
          `  Refusing beats guessing: parsing it anyway draws an empty or wrong\n` +
          `  surface, and says nothing about why.`,
        );
        // Thrown into the assembly failure path on purpose: the surface is
        // cleared, the assembly is marked failed, and the reason is NAMED and
        // shown. A refusal nobody sees is the same defect as the silent
        // mis-reading it replaces.
        throw envelopeRefusalError(read.refusal);
      }

      const reading = read.reading;
      const assembledComponents = reading.components as any[];
      // The page reads a few well-known keys off the model (cards, usage,
      // session) — the same keys the server puts there. The renderer is handed
      // the model as it is; it walks paths, it does not read this shape.
      const dataModel = reading.dataModel as Record<string, any>;
      // ── WHAT THE ASSEMBLY COULD NOT READ, INTO THE TRACE ───────────────────
      // The backend collects every failure it survived into the model's `warnings`
      // (routes/ai.py `_warn`); the trace is where those are looked at (lib/trace-source
      // subscribes to this logger). A degraded assembly says so instead of looking clean.
      if (Array.isArray(dataModel.warnings)) {
        for (const warning of dataModel.warnings) {
          logger.warn(`[assembly] ${String(warning)}`, { surfaceId: reading.surfaceId ?? null });
        }
      }
      for (const note of reading.notes) console.warn(`🤖 [A2UI] ${note}`);
      console.log(
        `🤖 [A2UI] Envelope surface: "${reading.surfaceId ?? '(unnamed)'}"` +
        `${reading.catalogId ? ` · catalog ${reading.catalogId}` : ''}`,
      );
      console.log(`🤖 [A2UI] Model-supplied components:`, assembledComponents.map((c: any) => c?.component || c?.id));
      console.log(`🤖 [A2UI] Data model received:`, Object.keys(dataModel));

      // Hand both channels to the surface renderer as props.
      //
      // WHICH RENDERER IS DECIDED BELOW, by the same inference the view uses — a
      // tree goes to the slot it was assembled for and nowhere else. The
      // assignment cannot happen here: `surface` is not known until the model has
      // been read, and assigning first is what put the composer's columns on the
      // console (measured 2026-09-17) and dropped the cards from the screen.
      //
      // The component list is passed even when empty: an empty list is Grace
      // saying "no surface", and the renderer draws nothing for it. Keeping the
      // previous tree on screen instead would make a deliberately cleared surface
      // look stuck — indistinguishable from a renderer that had stopped
      // listening, which is the exact failure this wiring exists to make visible.

      // A2UI v0.9.1: the surface LABEL is the spec's `surfaceId`, and it is read by
      // the envelope boundary above (readA2UIEnvelope) — it names which surface these
      // operations belong to. It is not the same question as WHICH VIEW to show:
      // the server mounts the console, the composer and the decision dialog all on
      // the one surface `main`, so the view is still inferred from the data model
      // itself — decision payload → decision dialog, cards → console grid, session
      // payload → composer. Two questions, two answers; this used to be one guess.
      const surface = dataModel.decision_type
        ? 'decision'
        : Array.isArray(dataModel.cards)
          ? 'console'
          : dataModel.session
            ? 'composer'
            : 'console';
      console.log(`🤖 [A2UI] Surface inferred from data model: ${surface}`);

      // The tree now goes to the slot it belongs to. A decision payload is drawn
      // on the composer's side — it is the composer's own question, asked in the
      // composer's column — so anything that is not the console goes to the
      // workspace tree.
      if (surface === 'console') {
        setConsoleTree({ components: assembledComponents, dataModel });
      } else {
        setWorkspaceTree({ components: assembledComponents, dataModel });
      }

      const assemblyTime = dataModel.assembly_time_ms || 0;
      const aiMessage = dataModel.ai_message || '';

      // ── SHE SPEAKS WHEN SHE WAS ASKED, AND IS SILENT WHEN SHE WAS NOT ────────
      // The history here is worth keeping: this was suppressed entirely ("an assembly
      // is not a turn in the conversation — nobody asked"), then re-enabled for every
      // assembly, and the owner's verdict on that is the second one: opening a package,
      // switching a tab or loading the console is not a question, and a column that
      // greets you on every one of them reads as a machine talking to itself.
      //
      // The one assembly that IS an ask is a repair: the brief rides the assembly and
      // comes back as her sentence, which is how a repair tells the person what is open.
      // So that is the condition — a repair brief, not "the model produced a message".
      if (aiMessage.trim() && (context?.repair_brief?.length ?? 0) > 0) {
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: { role: 'assistant', content: aiMessage.trim() },
        }));
      }
      // The measured cost of this action, straight from the provider's usage
      // report — the readout in Grace's seat shows this and nothing else.
      if (dataModel.usage && typeof dataModel.usage.total_tokens === 'number') {
        // The spend belongs to the surface it came from, so it carries that
        // surface's session id. Without it, every listener in every open
        // conversation pulls the same number — the contract scopes a chat panel
        // to its own conversationId (catalog.json -> ChatPanel).
        window.dispatchEvent(new CustomEvent('a2ui:usage', {
          detail: { ...dataModel.usage, sessionId: dataModel.session_id || currentPromptSessionRef.current || null },
        }));
      }
      console.log(`🤖 [A2UI] Surface assembled in ${assemblyTime}ms`);
      console.log(`🤖 [A2UI] Grace says: ${aiMessage}`);

      // ═══════════════════════════════════════════════════════════════════
      // Process based on surface type
      // ═══════════════════════════════════════════════════════════════════
      if (surface === 'console') {
        const cards = dataModel.cards || [];
        if (!Array.isArray(cards)) {
          throw new Error("AI did not return valid cards - surface cannot render without AI");
        }
        // No setState here. These cards ARE `dataModel.cards`, and the data model was
        // handed to the renderer two lines up — the console's one authority. A React
        // copy kept in step beside them is what let the drawn console and the console
        // this file believed in differ in the first place.
        setHeaderTab('console');
        console.log(`✅ [A2UI] Console assembled with ${cards.length} cards`);

      } else if (surface === 'composer') {
        // Extract session from data model
        const session = dataModel.session || {};
        const sections = session.left_column?.sections || [];
        const metadata = dataModel.metadata || {};

        // Map raw_content if available, otherwise construct from sections
        const leftColumnContent = session.left_column?.raw_content || JSON.stringify({
          sections: sections.map((s: any, i: number) => ({
            name: s.name || s.section || s.role || 'Section',
            content: s.content || '',
            type: s.type || s.role || s.name || 'custom',
            position: i,
            visible: true,
          }))
        });

        const assembledSession = {
          id: session.id || null,
          userId: 'default-user',
          title: session.title || dataModel.suggested_title || 'New Prompt Agent',
          leftColumnContent,
          compiledOutput: session.middle_column?.compiled_output || '',
          conversationId: session.right_column?.conversation_id || null,
          isActive: true,
          isArchived: false,
          currentVersion: metadata.version || 1,
          createdAt: metadata.created_at || new Date().toISOString(),
          updatedAt: metadata.updated_at || new Date().toISOString(),
          lastAccessedAt: metadata.last_accessed_at || new Date().toISOString(),
          metadata: {},
          is_unsaved: session.is_unsaved ?? !session.id,
          // THE PLACE IT WAS LEFT, carried through the assembly the way column_widths is —
          // the backend puts it under /metadata/workspace, and without this hop the reopen
          // never saw it: the restore effect reads currentPromptSession.workspace, and a
          // session built here without it reopens "where it was left" only in the record.
          workspace: metadata.workspace || undefined,
        };

        setCurrentPromptSession(assembledSession as any);
        hasUnsavedChangesRef.current = assembledSession.is_unsaved;

        // A repair names its own package, and this is where it lands — not in the
        // click handler. A repair can be stopped by the unsaved-changes gate and
        // resumed by the user's answer, and every resumed assembly arrives HERE;
        // naming it at click time would leave the resumed one called "Untitled
        // Prompt". Only a fresh package is renamed: repairing from inside an open
        // package is an edit of that package, not a new one.
        if (repairTitleRef.current && (assembledSession.is_unsaved || !assembledSession.id)) {
          const repairTitle = repairTitleRef.current;
          repairTitleRef.current = null;
          setCurrentPromptSession((prev: any) =>
            prev ? { ...prev, title: repairTitle, is_unsaved: true } : prev,
          );
        }
        setHeaderTab('composer');

        // ── HER GREETING, WHEN IT IS ANSWERING SOMETHING ───────────────────────
        // Every other assembly's ai_message is deliberately NOT posted (see the note
        // where `aiMessage` is read): an assembly is not a turn, and nobody asked. A
        // REPAIR is the exception — the person clicked REPAIR and is looking at a form
        // they cannot finish alone, so the message that describes it answers what they
        // just did.
        //
        // The flag is the SERVER's, set only when the brief actually rode this assembly.
        // So the greeting is posted only when she was really given it, and a repair whose
        // brief went missing does not fake one.
        // Her reply was posted above, by the surface branch — this adds only the half she
        // must NOT author: one button per answer, wired to `fill-field`. Sent as its own
        // message on purpose. Hers is prose and these are app-rendered controls, and a
        // reader can tell those apart; fused into one bubble they would not be able to.
        if (dataModel.repair_brief && repairAskRef.current?.buttons) {
          window.dispatchEvent(new CustomEvent('a2ui:system-message', {
            detail: { role: 'assistant', content: repairAskRef.current.buttons },
          }));
          console.log('[repair] answer buttons attached under her reply');
        }
        // Either way the ask is consumed: a stale ask must not fire on a later assembly.
        if (dataModel.repair_brief) repairAskRef.current = null;

        console.log(`✅ [A2UI] Composer assembled with ${sections.length} sections`);

      } else if (surface === 'decision') {
        // ═══════════════════════════════════════════════════════════════════
        // A2UI v0.9: AI-driven decision dialog
        // AI returns a decision surface when user action requires confirmation
        // ═══════════════════════════════════════════════════════════════════
        const decisionType = dataModel.decision_type;
        const actions = dataModel.actions || [];
        const aiMessage = dataModel.ai_message || 'Please make a choice.';
        const pendingIntent = dataModel.pending_intent || '';
        const sessionId = dataModel.session_id || null;

        console.log(`🤖 [A2UI] Decision surface: ${decisionType}`, { actions, pendingIntent });

        setAiDecision({
          show: true,
          message: aiMessage,
          actions,
          pending_intent: pendingIntent,
          decision_type: decisionType,
          session_id: sessionId,
        });
      }

      setAiAssemblyFailed(false);
      setAiAssemblyReport(null);

    } catch (error) {
      clearTimeout(timeoutId);
      setIsAIAssembling(false);

      // ── THE FALLBACK: the brief had nowhere to land ──────────────────────────
      // The assembly failed, so there is no greeting to carry the ask. Post the app's
      // own sentence after all — as the FALLBACK, not as the design. It exists because
      // a repair whose assembly gives up must still tell the person what is open; the
      // alternative is a form with no explanation and no way in, which is the state
      // this whole path replaced.
      //
      // Skipped when this request was SUPERSEDED rather than failed — a newer assembly is
      // already on its way and the brief will ride that one — so it is guarded on the
      // controller for the same reason the timeout branch below is.
      if (repairAskRef.current && consoleAssemblyControllerRef.current === controller) {
        const unspoken = repairAskRef.current;
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content: [unspoken.text, unspoken.buttons].filter(Boolean).join('\n\n'),
          },
        }));
        repairAskRef.current = null;
        console.log('[repair] the assembly did not land — the app-authored ask stands in as the fallback');
      }

      const errMsg = error instanceof Error ? error.message : String(error);
      const isAbort = error instanceof Error && (
        error.name === 'AbortError' ||
        errMsg.toLowerCase().includes('aborted') ||
        errMsg.toLowerCase().includes('signal')
      );
      if (isAbort) {
        if (consoleAssemblyControllerRef.current === controller) {
          // This request itself timed out — see ASSEMBLY_TIMEOUT_MS.
          console.error(
            `[A2UI] ASSEMBLY TIMED OUT\n` +
            `  intent: ${intent}\n` +
            `  timeout: ${ASSEMBLY_TIMEOUT_MS}ms\n` +
            `  error.name: ${error instanceof Error ? error.name : 'N/A'}\n` +
            `  error.message: ${errMsg}\n` +
            `  timestamp: ${new Date().toISOString()}\n` +
            `  CAUSE: Backend did not respond within ${ASSEMBLY_TIMEOUT_MS / 1000}s. Typical causes: a cold model call slower than usual, backend down, or network failure.\n` +
            `  FIX: Check backend logs for the request matching this timestamp. Look for "A2UI FAILURE" or PERF TRACE lines.`
          );
          // Classified, not hand-written. The client cap fired — but classifyFailure reads the
          // actual thrown error and the transport facts, so a real 503 that raced the cap is
          // reported as a 503 rather than being re-labelled a timeout by proximity.
          const report = classifyFailure(error, { intent, ...failureTransport });
          setAiAssemblyReport(report);
          setAiAssemblyMessage(report.headline);
          setIsFailureAcknowledged(false);
          setAiAssemblyFailed(true);
          setCurrentPromptSession(null);
          // The surface goes with them. <a2ui-renderer> holds its last tree until it
          // is handed a new one, so a failure that left the previous components in
          // state would draw a stale console beside the error — the one thing that
          // looks like a renderer that stopped listening. No envelope, no surface.
          // The console's cards are READ from this model, so clearing it is also what
          // clears them: there is no second list left holding the failed assembly.
          // Cleared for the surface that FAILED, not for both: the other slot's
          // tree is not stale — it is simply not what this request was for.
          if (intent === 'render-console') setConsoleTree({ components: [], dataModel: {} });
          else setWorkspaceTree({ components: [], dataModel: {} });
        } else {
          // Previous request was aborted because a newer user action (tab click, etc.) superseded it
          console.log('[A2UI] Previous assembly superseded by newer request (normal)');
        }
      } else {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
          `[A2UI] ASSEMBLY FAILED\n` +
          `  intent: ${intent}\n` +
          `  error.type: ${error instanceof Error ? error.constructor.name : typeof error}\n` +
          `  error.name: ${error instanceof Error ? error.name : 'N/A'}\n` +
          `  error.message: ${errorMessage}\n` +
          `  error.stack: ${error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 5).join('\n    ') : 'N/A'}\n` +
          `  timestamp: ${new Date().toISOString()}\n` +
          `  state: aiAssemblyFailed=true, currentPromptSession=null, the failed surface's tree cleared (cards go with it)`
        );
        // The branch that used to live here tested `errorMessage.startsWith('A2UI FAILURE:')`
        // against a message the throw site prefixed differently ("A2UI Assembly Failed: "), so
        // it could never match and the structured payload was never shown directly. The
        // classifier replaces it: the §1 envelope travels in `failureTransport` as an OBJECT,
        // so its code / surfaceId / path / message survive instead of becoming "[object Object]".
        const report = classifyFailure(error, { intent, ...failureTransport });
        setAiAssemblyReport(report);
        setAiAssemblyMessage(report.headline);
        setIsFailureAcknowledged(false);
        setAiAssemblyFailed(true);
        setCurrentPromptSession(null);
        // Same reason as the timeout branch above: the renderer paints its last
        // tree until it is handed another, and a stale surface beside a failure
        // reads as a live one. Cleared, so the error is the only thing on screen —
        // and with the model cleared there are no cards left to disagree with it.
        if (intent === 'render-console') setConsoleTree({ components: [], dataModel: {} });
        else setWorkspaceTree({ components: [], dataModel: {} });
      }
    } finally {
      isConsoleAssemblyInFlightRef.current = false;
      consoleAssemblyControllerRef.current = null;
      setIsAIAssembling(false);
    }
  }, [setHeaderTab]);

  /**
   * THE CHECKER'S FINDINGS, READ FROM THE REPORT THE CHECKER WROTE.
   *
   * This is the ONE source the repair lookup resolves against (handleRepairFinding,
   * writeAnswerBack), so it has to be populated even when nothing else is: a Repair
   * control whose finding cannot be found does nothing at all, silently.
   *
   * It is a READ, not a model call. The findings are the audit report the checker
   * already wrote to disk (GET /api/catalog/audit) — the same report this page has
   * always been able to fall back to. Nothing here is assembled, so nothing here can
   * be refused for being slow.
   */
  const loadCatalogFindings = useCallback(async () => {
    try {
      const health = await fetchCatalogHealth();
      if (health.state !== 'ok') {
        // Said out loud. With no findings the repair list has nothing to resolve
        // against, and an empty list looks exactly like a clean catalog.
        console.error(
          `[catalog] the check did not answer (${health.state}) — the repairs have nothing ` +
            `to resolve against. Run it: cd frontend && npm run catalog:check`,
        );
        return;
      }
      const open = health.report.findings.filter((f) => f.level !== 'pass');
      setCatalogFindings(open);
      // ── THE GOVERNANCE LINE, IN THE TRACE ──────────────────────────────────
      // The owner, 2026-09-18: "I need to know when there's a fallback, I need to know
      // when there's error suppression — we need to report it in the console trace."
      // The checker counts every swallowed failure on the governed path
      // (check:error-suppression); this is where that count reaches the person: a warn on
      // the app logger is a trace entry (lib/trace-source subscribes to it), so the Trace
      // tab says how many failures are being hidden and where the count lives.
      const suppressed = open.filter((f: { check?: string }) => f.check === 'error-suppression');
      if (suppressed.length) {
        logger.warn(
          `${suppressed.length} swallowed failure(s) recorded on the governed path — each one hides something from the person`,
          { check: 'error-suppression', count: suppressed.length, where: 'frontend/catalog-audit/*.json' },
        );
      }
      // A finding the report still derives is still open, so a 'done' mark is dropped
      // the moment it comes back (shared/catalogHealth.reconcileRepairs).
      setRepairStages((s) => reconcileRepairs(s, open.map((f) => f.id)));
      console.log(`[catalog] ${open.length} open finding(s) read from the checker's report`);
    } catch (e) {
      console.error('[catalog] the report could not be read:', e);
    }
  }, []);

  /**
   * ONE MODEL CALL, THEN THE REPAIRS — in that order, never together.
   *
   * A load used to fire two surfaces in the same millisecond (`Promise.allSettled([
   * graceReport, assembleSurfaceWithAI(intent) ])`), with the report request sent
   * TWICE besides, and all three raced one provider on the surface's 10s contract.
   * The slowest was refused, which is how a first-time visitor got an error over an
   * empty console while a report about the catalog was still being written.
   *
   * The order here is the order the surface is read in: the surface assembles first,
   * on its own, and only when it has landed are the findings read. The chat panel is
   * CLOSED by default on the console, so nothing waits behind it — there was never a
   * reason to hold the cards for a report.
   */
  const assembleSurfaceThenRepairs = useCallback(
    async (intent: string, context?: Parameters<typeof assembleSurfaceWithAI>[1]) => {
      await assembleSurfaceWithAI(intent, context);
      await loadCatalogFindings();
    },
    [assembleSurfaceWithAI, loadCatalogFindings],
  );

  // ── Legacy function wrappers for backward compatibility ──
  const assembleConsoleWithAI = useCallback(() => assembleSurfaceWithAI('render-console'), [assembleSurfaceWithAI]);
  const assembleComposerWithAI = useCallback((sessionId?: string) => {
    if (sessionId) {
      return assembleSurfaceWithAI(`render-session:${sessionId}`);
    }
    return assembleSurfaceWithAI('render-composer');
  }, [assembleSurfaceWithAI]);

  // ── error-banner's own events ────────────────────────────────────────────────
  //
  // error-banner emits `error-dismiss` / `error-retry` as bubble+composed CustomEvents
  // precisely so a window listener hears them across the shadow boundary
  // (error-banner.ts:18-19). Both are wired to something REAL here, because a control that
  // renders and does nothing is the `tag-inert` finding this banner was written to fix:
  //
  //   error-retry   → re-run the assembly that actually failed (lastAssemblyIntentRef),
  //                   so Retry re-issues the failing request instead of a guess.
  //   error-dismiss → acknowledge the HEADLINE only. It clears neither aiAssemblyFailed nor
  //                   the diagnostics pane: the record of what happened stays on screen
  //                   until a successful assembly replaces it.
  //
  // This effect sits BELOW assembleSurfaceWithAI on purpose — a useEffect above its
  // definition would evaluate the dependency array before the const is initialised.
  useEffect(() => {
    const handleRetry = () => {
      console.log(`🤖 [A2UI] Retry requested → re-running intent: ${lastAssemblyIntentRef.current}`);
      void assembleSurfaceThenRepairs(lastAssemblyIntentRef.current);
    };
    const handleDismiss = () => {
      setIsFailureAcknowledged(true);
    };
    window.addEventListener('error-retry', handleRetry);
    window.addEventListener('error-dismiss', handleDismiss);
    return () => {
      window.removeEventListener('error-retry', handleRetry);
      window.removeEventListener('error-dismiss', handleDismiss);
    };
  }, [assembleSurfaceWithAI]);

  // ══════════════════════════════════════════════════════════════════════════
  // A2UI: Chat commands the console surface via XML tags in AI responses
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const handleConsoleCommand = (e: CustomEvent) => {
      const { sort, filter } = e.detail || {};
      console.log('[WritingAreaIndex] Console command from chat:', { sort, filter });
      // Re-assemble console — AI will sort/filter fresh from DB
      assembleSurfaceThenRepairs('render-console');
    };
    window.addEventListener('a2ui:console-command', handleConsoleCommand as EventListener);
    return () => window.removeEventListener('a2ui:console-command', handleConsoleCommand as EventListener);
  }, [assembleSurfaceWithAI]);

  // ══════════════════════════════════════════════════════════════════════════
  // A2UI v0.9: TAB CLICKS ARE AI COMMANDS, NOT WEBPAGE LINKS
  // ══════════════════════════════════════════════════════════════════════════
  // Every tab click sends an INTENT to the AI. The AI decides what DATA to
  // return. On failure: 503 hard fail, no fake rendering — correct.
  //
  // BUT: AI does NOT decide the *frame*. The slot routing in
  // <ai-surface-sandbox> is hardcoded: console→slot="console",
  // everything else→slot="workspace". AI cannot create new surface types
  // or reorganize which slots exist. See assembly audit above.
  // ══════════════════════════════════════════════════════════════════════════
  const handleTabChangeWithGate = useCallback(async (tabId: string | null) => {
    // ══════════════════════════════════════════════════════════════════════
    // A2UI v0.9: Tab clicks are AI commands
    // Send document state to AI - AI decides how to handle unsaved changes
    // ══════════════════════════════════════════════════════════════════════

    // Build context for AI - includes unsaved changes state
    const context = {
      current_surface: headerTab || 'console',
      has_unsaved_changes: hasUnsavedChangesRef.current,
      session_id: currentPromptSession?.id || null,
      session_title: currentPromptSession?.title || '',
    };

    if (tabId === 'console') {
      // Move the header tab indicator INSTANTLY — don't wait for AI assembly
      handleHeaderTabChange('console');
      // Console is read-only — unsaved changes in the composer do not block navigation.
      console.log('🤖 [A2UI] Console clicked → intent: render-console (direct, no gate)');
      await assembleSurfaceThenRepairs('render-console', {
        current_surface: 'composer',
        has_unsaved_changes: false,  // ← Console is safe navigation, no decision dialog
        session_id: currentPromptSession?.id || null,
        session_title: currentPromptSession?.title || '',
      });
      setConsoleRefreshKey((k) => k + 1);
      return;
    }

    if (tabId === 'composer') {
      // A FRESH COMPOSER STARTS CLEAN — whatever Grace had here is not kept.
      //
      // The owner, 2026-09-18: "it's almost as if the composer is not clearing… every time I
      // create a new one by clicking composer, it should clear whatever Grace had and be ready
      // to accept the new run." The seat is reused across assemblies, so its thread has to be
      // emptied on purpose here; nothing that was SAVED is affected (a package's conversation
      // is loaded from its own id when it is opened).
      // THE SHADOW-PIERCING READ, NOT document.querySelector: the seat is drawn by the
      // renderer inside its shadow root, so the document-level query returned null on every
      // click and the thread was silently never emptied — the sentence above was a claim
      // about behaviour that did not run. `deepFind` is the helper this file already uses
      // for exactly this boundary (see its note).
      const seat = deepFind<HTMLElement & { clearThread?: () => void }>('chat-panel');
      seat?.clearThread?.();
      // Move the header tab indicator INSTANTLY — don't wait for AI assembly
      handleHeaderTabChange('composer');
      // Composer click always starts a FRESH prompt package (same as "Create New")
      // — never reload the card the user had open.
      console.log('🤖 [A2UI] Composer clicked → intent: render-composer (fresh package)');
      await assembleSurfaceThenRepairs('render-composer', {
        ...context,
        session_id: null,
        session_title: '',
      });
      return;
    }

    // Other tabs - just switch for now (TODO: wire to AI assembly)
    handleHeaderTabChange(tabId);
  }, [handleHeaderTabChange, assembleSurfaceThenRepairs, currentPromptSession?.id, currentPromptSession?.title, headerTab]);

  // ══════════════════════════════════════════════════════════════════════════
  // A2UI v0.9: INITIAL MOUNT - AI ALWAYS ASSEMBLES THE INITIAL SURFACE
  // The AI is the ARCHITECT. On mount, call AI to determine what to render.
  // STRICT: No fallbacks, no cache, no static rendering.
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // The front page IS the console.
    //
    // The persisted tab (localStorage "activeHeaderTab") must NOT dictate what
    // the front page assembles. `handleTabChangeWithGate` persists every tab
    // switch, so a stale saved tab ("composer") made a reload of "/" re-assemble
    // the Composer and the Console never assembled at all — no cards, no hero.
    //
    // Only a session id in the URL changes the initial intent. The assembled
    // surface still sets the tab that matches it (see the `setHeaderTab` calls
    // in the surface handlers).
    // The console page shows the CARDS. The checker's findings are read AFTER the
    // surface has landed — a read of the report, not a second model call — and they
    // populate ONE source (`catalogFindings`) that the repair lookup resolves against.
    const initialIntent = routeSessionId
      ? `render-session:${routeSessionId}`
      : 'render-console';

    // Align the visible tab with the intent BEFORE assembling, so the console
    // renders instead of a stale composer workspace.
    if (!routeSessionId && headerTab !== 'console') {
      setHeaderTab('console');
    }

    console.log(`🤖 [A2UI] Initial mount → intent: ${initialIntent}`);

    // THE ORDER: the surface first, alone; the checker's findings after it lands.
    //
    // This used to be two surfaces in the same millisecond — the comment said so
    // outright: "The surface, in PARALLEL — not behind her report" — with the report
    // request sent TWICE besides (a StrictMode remount re-ran this effect down a path
    // that bypassed the single in-flight slot). Three model calls raced one provider
    // on the surface's 10s contract, and the slowest was refused. That is how a
    // first-time visitor's first impression became an error over an empty console.
    //
    // The chat panel is CLOSED by default on the console, so nothing sits behind it
    // waiting: there was never a reason to hold the cards while a report was written.
    void (async () => {
      await assembleSurfaceThenRepairs(initialIntent);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = run only on mount

  const navigateAway = () => {
    setCurrentPromptSession(null);
    hasUnsavedChangesRef.current = false; // Clear unsaved flag
    const targetTab = pendingExitTabRef.current;
    pendingExitTabRef.current = null;

    // Execute any pending action (like opening a different prompt)
    const pendingAction = pendingActionRef.current;
    pendingActionRef.current = null;

    if (pendingAction) {
      pendingAction();
    } else if (targetTab) {
      handleHeaderTabChange(targetTab);
    } else {
      navigate('/');
    }
  };

  const handleConfirmExit = () => {
    setShowExitConfirm(false);
    navigateAway();
  };

  const handleSaveAndExit = async () => {
    setShowExitConfirm(false);
    // Save the prompt before navigating away
    try {
      await handleSavePromptRef.current();
    } catch {
      // Save failed — still proceed with exit; the user chose to leave
    }
    navigateAway();
  };

  const handleCancelExit = () => {
    setShowExitConfirm(false);
    pendingExitTabRef.current = null;
    setHeaderTab("composer");
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // A2UI v0.9: Handle AI Decision Dialog Actions
  // User selects an action, AI executes it
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAIDecisionAction = useCallback(async (actionId: string) => {
    if (!aiDecision) return;

    const pendingIntent = aiDecision.pending_intent;
    console.log(`🤖 [A2UI] Decision action: ${actionId}, pending intent: ${pendingIntent}`);

    // Close the dialog
    setAiDecision(null);

    if (actionId === 'save') {
      // Save first, then proceed with the pending intent
      try {
        await handleSavePromptRef.current();
        hasUnsavedChangesRef.current = false;
        // Now execute the original intent without unsaved changes context
        await assembleSurfaceThenRepairs(pendingIntent);
      } catch (error) {
        console.error('🤖 [A2UI] Save failed:', error);
        // Stay on current surface - save failed
      }
    } else if (actionId === 'discard') {
      // Discard changes and proceed with the pending intent
      hasUnsavedChangesRef.current = false;
      await assembleSurfaceThenRepairs(pendingIntent);
    } else if (actionId === 'cancel') {
      // Stay on the current surface — and DROP whatever was waiting behind this
      // gate. A repair queues its sections and its name BEFORE the gate opens; if
      // cancel left them set, the column would be replaced by the very thing the
      // person just declined.
      repairSectionsRef.current = null;
      repairTitleRef.current = null;
      console.log('🤖 [A2UI] User cancelled navigation — pending repair dropped');
    } else if (aiDecision.decision_type === 'select_category') {
      // Category selection gate — pass chosen category back to render-composer
      console.log(`🤖 [A2UI] Category selected: ${actionId}`);
      await assembleSurfaceThenRepairs(pendingIntent, { category: actionId });
    }
  }, [aiDecision, assembleSurfaceThenRepairs]);

  /**
   * ONE REMOVAL, TWO WIRES — and the second wire is what was missing.
   *
   * The card's own two-step confirm (arm → CONFIRM, in <agent-card-element>) dispatches
   * `card-delete`, and NOTHING in the application heard it: the handler that used to was
   * live in the React console, which no longer draws the cards. So a confirmed delete went
   * nowhere. The owner, 2026-09-18: "when I click confirm it reloads the entire console" —
   * that was the old path; the new one did not reload, it did nothing.
   *
   * WHAT THIS DELIBERATELY DOES NOT DO: re-assemble the console. That was a MODEL CALL to
   * tell it what it already knows. The packages are a list in the data model, so the removal
   * is a write to the list — one card leaves, the rest do not flicker, and the pager drops a
   * page with it if that was the last card on the last one.
   */
  const removePackageFromConsole = useCallback((sessionId: string) => {
    setConsoleTree((prev) => {
      const model = (prev.dataModel ?? {}) as Record<string, unknown>;
      const cards = Array.isArray(model.cards) ? (model.cards as unknown[]) : null;
      if (!cards) return prev;
      const next = cards.filter((c) => String((c as { id?: unknown })?.id ?? '') !== String(sessionId));
      if (next.length === cards.length) return prev;
      return { ...prev, dataModel: { ...model, cards: next } };
    });
  }, []);

  /**
   * Delete a package. NO SECOND CONFIRMATION: the card's own two-step is the confirmation
   * (arm, then CONFIRM), and a native dialog on top of it would be a third ask for one act.
   */
  const deletePackage = useCallback(async (sessionId: string) => {
    try {
      await promptService.deletePromptSession(sessionId, true);
      if (currentPromptSession?.id === sessionId) setCurrentPromptSession(null);
      removePackageFromConsole(sessionId);
    } catch (error) {
      console.error('Failed to delete prompt session:', error);
    }
  }, [currentPromptSession?.id, removePackageFromConsole]);

  const _handleDeletePromptSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this prompt? This will remove all versions and the linked chat.')) return;
    await deletePackage(sessionId);
    setConsoleRefreshKey(k => k + 1);
  };

  // The card's own event listener sits in an effect that cannot depend on this callback —
  // it is defined below it — so the handler travels through a ref, the same shape the run
  // and save paths use here. One writer, one home.
  useEffect(() => {
    deletePackageRef.current = (sessionId: string) => { void deletePackage(sessionId); };
  }, [deletePackage]);

  const handleConversationChange = useCallback((conversationId: string | null, surface: 'console' | 'composer' = 'composer') => {
    // ── WHICH SURFACE SPOKE DECIDES WHICH PATH IS WRITTEN ──────────────────
    //
    // Both seats dispatch the same `conversation-change`, and they read different paths:
    // the composer's seat reads /session/right_column/conversation_id and the console's
    // reads /console/conversation_id. Writing the composer's path for a console pick would
    // put the console's conversation into the composer's model — one surface's id in the
    // other's seat. The event carries the surface now (`detail.surface`), which the element
    // knows from the tree it was rendered in.
    if (surface === 'console') {
      setConsoleTree((prev) => {
        const consoleModel = prev.dataModel.console ?? {};
        if ((consoleModel.conversation_id ?? null) === conversationId) return prev;
        return {
          ...prev,
          dataModel: { ...prev.dataModel, console: { ...consoleModel, conversation_id: conversationId } },
        };
      });
      return;
    }

    if (currentPromptSession && conversationId && currentPromptSession.conversationId !== conversationId) {
      // Update local state only. Conversations are package-owned: the conversation
      // row already carries session_id — prompt_sessions.conversation_id was dropped.
      setCurrentPromptSession(prev => prev ? { ...prev, conversationId } : null);
      // The ref must move in the SAME tick: the seat dispatches the first
      // call's a2ui:usage right after conversation-change, and the usage
      // accumulator reads this ref synchronously. An effect-run update would
      // still hold the old conversation and drop the first call's numbers.
      if (currentPromptSessionObjRef.current) {
        currentPromptSessionObjRef.current = { ...currentPromptSessionObjRef.current, conversationId };
      }

      // ── AND THE MODEL HAS TO LEARN IT, OR THE SEAT FORGETS EVERY TURN ──────
      //
      // The seat reads its conversation from /session/right_column/conversation_id, and a
      // re-render re-applies that path over whatever the element adopted. React state does
      // not reach that path, so the id was adopted from the response and lost on the next
      // render: the backend log shows `Reusing conversation … for session … ` on EVERY
      // turn, which is the lookup running because the request arrived with no
      // conversation_id at all. The package's conversation was found each time by its
      // session_id — the one home — and handed to the element, which dropped it.
      //
      // Writing the path is what makes the link outlive one turn. It is the same value,
      // not a second home: the model is where this element is told.
      setWorkspaceTree((prev) => {
        const session = prev.dataModel.session ?? {};
        const right = session.right_column ?? {};
        if ((right.conversation_id ?? null) === conversationId) return prev;
        return {
          ...prev,
          dataModel: {
            ...prev.dataModel,
            session: { ...session, right_column: { ...right, conversation_id: conversationId } },
          },
        };
      });
    }
  }, [currentPromptSession]);

  // The Lit seat speaks through composed events, so they arrive at window — no
  // ref, no per-element listener. repair-finding starts the repair flow;
  // conversation-change adopts the conversation the first send created for a
  // new package.
  useEffect(() => {
    const onRepairFinding = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { findingId?: string };
      if (detail.findingId) {
        void handleRepairFinding(detail.findingId, { current_surface: headerTab || 'composer' });
      }
    };
    const onConversationChange = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { conversationId?: string };
      if (!detail.conversationId) return;
      // Which tree raised it decides which path is written. Both seats dispatch this same
      // event, and each reads its conversation from its own path — the composer's seat from
      // /session/right_column/conversation_id, the console's from /console/conversation_id —
      // so the event's path through the DOM is what says which one spoke. The renderer in
      // the path is the surface.
      const path = typeof (event as Event & { composedPath?: () => EventTarget[] }).composedPath === 'function'
        ? (event as Event & { composedPath: () => EventTarget[] }).composedPath()
        : [];
      const consoleSpeaking = !!consoleRendererRef.current && path.includes(consoleRendererRef.current);
      handleConversationChange(detail.conversationId, consoleSpeaking ? 'console' : 'composer');
    };
    /**
     * THE CANVAS'S OWN FOUR EVENTS.
     *
     * All new names, all heard HERE, in the same pass that emits them: an emitted
     * event with no listener is what the catalog audit reports as event-unheard, and
     * it also reads to a person as a control that works. What each does today is
     * stated rather than invented:
     *
     *   flow-node-moved  the node is where the person put it. Positions live in the
     *                    element for now; this records them so a decision to persist
     *                    them has somewhere to start.
     *   flow-select      the selection, recorded. Clicking a node asks nothing of
     *                    Grace YET — how she speaks about the flow is the open
     *                    question in AGENTIC_EDITOR/06, not a guess to make here.
     *   flow-connect     a connection drawn by hand. The graph's edges come from the
     *                    run, so this records what the canvas cannot yet do.
     *   flow-action      the node toolbar and the canvas controls.
     *
     * Everything lands in the app logger, which is the operator's own view — the
     * Trace tab reads it. Honest, and out of Grace's seat until we decide her words.
     */
    const onFlowNodeMoved = (event: Event) => {
      logger.info('flow node moved', ((event as CustomEvent).detail || {}) as Record<string, unknown>);
    };
    /**
     * THE LINK, BOTH WAYS — the floor this view was missing.
     *
     * A picked note is a question about a piece of the conversation, and the playground has
     * answered it since the canvas existed: the turn about that note is marked in her thread,
     * her header says what the note is, and a click on that turn puts the note back under the
     * person's eye. In the app NONE of it happened, and the reason is structural: her column
     * and the drawing are SIBLINGS here (the drawing in the middle pane, she in the right), so
     * the two elements never meet. The canvas unit listens for `flow-select` to mark her turn —
     * but she is not its child any more, so it finds no seat to mark; and the turn's
     * `turn-click` never crosses out of the right pane into the middle one. The page is the one
     * place that knows both halves, so the wiring lives here — the playground's own rule:
     * "Neither view reaches into the other… the wiring between them is here, in the host."
     *
     * WHAT SHE DOES ABOUT A PICK — opening her column, 650 wide — is deliberately NOT here:
     * the element that owns her width hears `flow-select` itself and performs it.
     */
    const onFlowSelect = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { nodeId?: string | null };
      logger.info('flow select', detail as Record<string, unknown>);
      const nodeId = detail.nodeId ?? null;
      const panel = deepFind<HTMLElement & { statusText?: string }>('chat-panel');
      const messages = panel?.shadowRoot?.querySelector('chat-messages') as
        | (HTMLElement & { highlightNodeId?: string | null })
        | null;
      if (messages) messages.highlightNodeId = nodeId;
      if (!nodeId || !panel) return;
      const nodes = deepFind<HTMLElement & { flow?: { nodes?: Array<{ id: string; title: string; kind: string; state: string }> } }>('agent-flow')?.flow?.nodes ?? [];
      const node = nodes.find((n) => n.id === nodeId);
      if (node) panel.statusText = `${node.title} | ${node.kind} — State: ${node.state}`;
    };
    /** And the other half: a turn clicked is its note brought back under the eye. */
    const onTurnClick = (event: Event) => {
      const nodeId = (((event as CustomEvent).detail || {}) as { nodeId?: string }).nodeId ?? '';
      if (!nodeId) return;
      deepFind<HTMLElement & { focusNode?: (id: string) => void }>('agent-flow')?.focusNode?.(nodeId);
    };
    const onFlowConnect = (event: Event) => {
      logger.info('flow connect', ((event as CustomEvent).detail || {}) as Record<string, unknown>);
    };
    const onFlowAction = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as Record<string, unknown>;
      const action = String(detail.action || '');
      // The view's own gestures are not news: one line per wheel notch would bury
      // the operator's feed under the canvas's zoom.
      if (action === 'zoom' || action === 'fit') return;
      logger.info(`flow action: ${action}`, detail);
    };
    /**
     * THE AGENT BUTTON RUNS THE COMPOSER'S OWN CONTROL.
     *
     * Its annotation (#40001120:6641) reads:
     *   On click:  dispatch loads-cards-form-console-in-prompt-area   ← the element does this
     *   Connects:  loads the console's prompt packages into the left column
     * and the owner, 2026-09-19, on what the click should do: "it's not opening a new [package]…
     * you can use the same controls that you have on composer." So it calls the composer's own
     * control — the same `handleTabChangeWithGate('composer')` the Composer tab calls — which
     * starts a FRESH package (session_id null, title empty) and never reloads the card the
     * person had open. Nothing new is invented for it; if the two ever diverge, they diverge in
     * that one function.
     *
     * (The event NAME is the old function's, kept because it is the name the design's note
     * dispatches — a name is an address, and the note is where this one is written down.)
     */
    const onAgentButton = () => {
      void handleTabChangeWithGate('composer');
    };
    /**
     * ...AND THE SAME BUTTON POINTS THE OTHER WAY FROM A PACKAGE. There it reads "Console" and
     * opens the console — the same `handleTabChangeWithGate('console')` the Console tab calls,
     * so the two directions are one pair of controls rather than two lookalikes.
     * The element decides which name to dispatch from the seat it was told it is
     * (chat-panel reads that from the session row); this end only listens.
     */
    const onOpenConsole = () => {
      void handleTabChangeWithGate('console');
    };
    window.addEventListener('open-console', onOpenConsole);
    window.addEventListener('loads-cards-form-console-in-prompt-area', onAgentButton);
    window.addEventListener('repair-finding', onRepairFinding);
    window.addEventListener('conversation-change', onConversationChange);
    /**
     * THE CANVAS ANNOUNCES ITSELF — AND SHE SAYS WHAT IT HOLDS.
     *
     * This is the two halves of one loop. The canvas stays the clean working area: it
     * emits `flow-opened` with what it was handed (counts, and every row it could not
     * name or step it did not draw). The sentence is HIS app's, spoken through the
     * same channel the repair verdicts use, so the drawing and the conversation agree
     * about what just happened — the canvas never carries the noise itself.
     *
     * The seat is where it lands; nothing about the conversation model changes.
     */

    /**
     * THE BLANK ONES ARE NEWS TOO, and they ride the announcement the canvas already makes.
     *
     * A seat with nothing written in it used to pass in silence — an empty tile and a quiet
     * chat — so the most likely first move in this demo (open a prompt nobody has written in,
     * run it) produced a picture and no words. The owner, 2026-09-18: "we need to send her a
     * notification for blank nodes, and tell her to load a section in the chat that represents
     * them… just simply say they're blank — would you like to work on this one?"
     *
     * The turn carries the node's id and its name, which is what makes it a CARD rather than a
     * sentence: clicking it points the canvas at the seat it is about.
     */
    const speakBlankSeats = (blanks: Array<{ id: string; title: string }> | undefined) => {
      for (const node of blanks ?? []) {
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content: `"${node.title}" is blank — nothing has been written in this seat yet. Want to work on this one?`,
            nodeId: node.id,
            label: node.title,
          },
        }));
      }
    };

    const onFlowOpened = (event: Event) => {
      const d = ((event as CustomEvent).detail || {}) as {
        label?: string;
        notes?: number;
        seats?: number;
        blanks?: Array<{ id: string; title: string }>;
        steps?: number;
        unresolved?: string[];
        absent?: Array<{ step: string; why: string }>;
      };
      logger.info('flow opened', d as Record<string, unknown>);
      // THE BLANKS FIRST, THEN THE SUMMARY — and from HERE, not from a second listener.
      //
      // They used to be two `flow-opened` listeners: a named one for this summary, and an
      // INLINE arrow for the blank seats that the effect's cleanup never removed. The effect
      // re-runs while a run progresses, so the inline one stacked up — measured in the running
      // app: 88 copies of two sentences (2 blanks x 44 accumulated listeners) while this summary
      // spoke once, which is exactly how the duplication looked on screen (owner, 2026-09-18:
      // "when I run, Grace output — it duplicates"). One event, one listener, one place to
      // remove it. Order kept: the seats are spoken before the sentence about the flow.
      speakBlankSeats(d.blanks);
      const count = (n: number | undefined, one: string): string =>
        `${n ?? 0} ${(n ?? 0) === 1 ? one : one + 's'}`;
      let line = `The flow is up — ${d.label || 'this run'}: `
        + `${count(d.notes, 'note')}, ${count(d.seats, 'seat')}, ${count(d.steps, 'step')}.`;
      if (d.unresolved?.length) {
        line += ` One row I cannot name yet — ${d.unresolved.join(', ')} — so it is drawn without a seat claimed.`;
      }
      if (d.absent?.length) {
        line += ` Not drawn: ${d.absent.map((a) => a.step).join(', ')} — ${d.absent.map((a) => a.why).join('; ')}.`;
      }
      /*
       * AND THE SAME TWO FACTS GO WHERE THE PERSON IS ALREADY LOOKING: the message line at the
       * top of her column. That line is the readout for whatever is on screen — the note you
       * picked, or what this drawing could not say — and the owner pointed these facts at it
       * (2026-09-18: "Those messages should appear at the very top of Grace… that's where we're
       * supposed to have messages like [tool-call: the prompt names no tool…]"). The words are
       * the graph's own, unchanged, so the drawing's omission and her sentence cannot drift.
       * The DRAWING no longer prints them: it never narrates (see agent-flow's render).
       */
      const notes: string[] = [];
      if (d.unresolved?.length) {
        notes.push(
          `${d.unresolved.length} row${d.unresolved.length === 1 ? '' : 's'} could not be named: ${d.unresolved.join(', ')}`,
        );
      }
      if (d.absent?.length) notes.push(d.absent.map((a) => `${a.step}: ${a.why}`).join(' · '));
      const readout = deepFind<HTMLElement & { statusText?: string }>('chat-panel');
      if (readout && notes.length) readout.statusText = notes.join(' · ');
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: { role: 'assistant', content: line },
      }));
    };
    /**
     * A NODE THE PERSON PULLED OUT OF THE CANVAS — a draft, and it says so.
     *
     * The canvas keeps its own edits locally and writes nothing back yet (the reasons
     * are recorded in AGENTIC_EDITOR/10-TODO.md W1/W2): the node is drawn, carries an
     * `unsaved` badge, and the session knows nothing about it. Saying that out loud is
     * the difference between a working area and a surface that looks like it saved.
     */
    const onFlowNodeAdded = (event: Event) => {
      const d = ((event as CustomEvent).detail || {}) as { nodeId?: string; kind?: string };
      logger.info('flow node added (draft)', d as Record<string, unknown>);
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content: `Added a ${d.kind || 'node'} on the canvas. It is a draft — this drawing has it and the package does not, so nothing is saved yet.`,
        },
      }));
    };
    window.addEventListener('flow-node-moved', onFlowNodeMoved);
    window.addEventListener('flow-node-added', onFlowNodeAdded);
    window.addEventListener('flow-select', onFlowSelect);
    window.addEventListener('turn-click', onTurnClick);
    window.addEventListener('flow-connect', onFlowConnect);
    window.addEventListener('flow-action', onFlowAction);
    /**
     * THE TONE SWITCH ASKS, THE HOST WRITES — the same split as every other write here.
     *
     * <canvas-footer> carries the master's tone control and emits `theme-change`; it does
     * not reach across the tree to restyle a sibling, because a footer does not know where
     * the drawing is (and an element that did would be the wrong model twice over). Two
     * things take the tone: the CONTAINER, whose ground her column stands on, and the
     * DRAWING itself, which owns the ink and the grid.
     */
    const onThemeChange = (event: Event) => {
      const theme = String((event as CustomEvent).detail?.theme ?? '');
      setWorkspaceTree((prev) => {
        const comps = Array.isArray(prev.components) ? prev.components : [];
        const next = comps.map((c: any) => {
          if (c?.id === 'canvas-footer-view' || c?.component === 'AgentCanvas' || c?.id === 'flow-view') {
            return { ...c, theme };
          }
          return c;
        });
        return { ...prev, components: next };
      });
    };
    window.addEventListener('theme-change', onThemeChange);

    /**
     * THE FOOT'S CONTROLS, WIRED TO THE PATHS THAT ALREADY EXIST — none of them is new.
     *
     *   canvas-play   the same run the control bar's RUN makes: this dispatches the request
     *                 the editor's own button dispatches, so there is one run path, not two
     *   canvas-reset  the way back that the column's own selector was supposed to give: the
     *                 middle column returns to the last output (setOutputColumn('output'))
     *   canvas-save   the same save as Save Template, which is also what a Run does before
     *                 it runs — the owner's "save options… when they run and when they exit"
     *
     * A control that emitted into the void would be the `tag-inert` finding this repo keeps
     * writing checks for: every event here has a listener in the same change.
     */
    const onCanvasPlay = () => window.dispatchEvent(new CustomEvent('run-requested'));
    const onCanvasReset = () => {
      setOutputColumn('output');
      /*
       * AND THE REST OF THE PLACE GOES BACK WITH IT. The swap above takes the canvas out of the
       * middle column; the ARRANGEMENT — the prompt out of its rail, her column open at her
       * width — belongs to the layout that lays it out, so the layout is ASKED to put it back
       * (owner, 2026-09-18: "it should just reset it… it doesn't look like it does"). Before
       * this, Reset left the prompt docked where the Run had put it and her column wherever the
       * last drag had left it: the canvas left, and nothing else did.
       */
      deepFind<HTMLElement & { resetArrangement?: () => void }>('workspace-layout')
        ?.resetArrangement?.();
    };
    const onCanvasSave = () => {
      // THE FOOT'S SAVE TAKES THE SAME TWO READINGS its siblings do — the control bar's Save and
      // the surface's own save-template both hand the save the sections and the live output.
      // This one called it with NO arguments, and a save with no sections throws on the way to
      // its payload: the foot logged "[CRUD] Save failed", no request was sent, and nothing was
      // written (owner, 2026-09-18: "the save feature on the canvas is not saving"). Same two
      // helpers as the others, so there is still exactly one way to read the column and one way
      // to save it.
      const sections = surfaceSections();
      const compiledOutput = readLiveOutput();
      console.log('[canvas-footer] save-click →', sections.length, 'sections +', compiledOutput.length, 'chars of output from the surface');
      handleSavePromptRef.current?.(compiledOutput, sections);
    };
    /**
     * THE CONSOLE TOLD US IT TURNED A PAGE. It carries no data the shell must act on — the
     * grid owns its own page — but an event nobody hears is the `event-unheard` finding this
     * repo keeps writing checks for, and it is right: a control that says something into a
     * room with nobody in it is a wire connected at one end. So the page change is recorded,
     * like the canvas's own events are.
     */
    /**
     * A CARD SAID IT WAS DELETED. Its own two-step confirm is the whole confirmation (arm,
     * then CONFIRM), so this deletes and takes the card out of the list — see deletePackage:
     * no re-assembly, because the packages are a list in the data model.
     */
    const onCardDelete = (event: Event) => {
      const sessionId = String((event as CustomEvent).detail?.sessionId ?? '');
      if (sessionId) void deletePackageRef.current(sessionId);
    };
    window.addEventListener('card-delete', onCardDelete);

    const onCardPage = (event: Event) => {
      logger.info('console page', ((event as CustomEvent).detail || {}) as Record<string, unknown>);
    };
    window.addEventListener('card-page', onCardPage);
    window.addEventListener('canvas-play', onCanvasPlay);
    window.addEventListener('canvas-reset', onCanvasReset);
    window.addEventListener('canvas-save', onCanvasSave);
    window.addEventListener('flow-opened', onFlowOpened);
    return () => {
      window.removeEventListener('open-console', onOpenConsole);
      window.removeEventListener('loads-cards-form-console-in-prompt-area', onAgentButton);
      window.removeEventListener('repair-finding', onRepairFinding);
      window.removeEventListener('conversation-change', onConversationChange);
      window.removeEventListener('flow-node-moved', onFlowNodeMoved);
      window.removeEventListener('flow-node-added', onFlowNodeAdded);
      window.removeEventListener('flow-select', onFlowSelect);
      window.removeEventListener('turn-click', onTurnClick);
      window.removeEventListener('flow-connect', onFlowConnect);
      window.removeEventListener('flow-action', onFlowAction);
      window.removeEventListener('card-delete', onCardDelete);
      window.removeEventListener('card-page', onCardPage);
      window.removeEventListener('canvas-play', onCanvasPlay);
      window.removeEventListener('canvas-reset', onCanvasReset);
      window.removeEventListener('canvas-save', onCanvasSave);
      window.removeEventListener('theme-change', onThemeChange);
      window.removeEventListener('flow-opened', onFlowOpened);
    };
  }, [handleRepairFinding, handleConversationChange, handleTabChangeWithGate, headerTab]);

  /**
   * A PACKAGE OPENS WHERE IT WAS LEFT.
   *
   * The stored workspace arrives with the session (`currentPromptSession.workspace`, mapped
   * in promptService) and the elements that take it arrive with the surface — so this waits
   * for both, frame by frame, and gives up quietly: an element that never appears is a view
   * that is not open, not an error. Applying it is one call on the plug-in (her column and
   * the drawing's view) and one property write on the layout (the left column).
   *
   * Only on a change of package: re-running this on every render would fight the operator,
   * who owns the arrangement from the moment they touch it.
   */
  useEffect(() => {
    const stored = currentPromptSession?.workspace;
    if (!stored) return;
    // THE DRAWING COMES BACK WHENEVER THE PACKAGE LEFT ONE. `middle` is the marker a save
    // writes now; a package saved before that marker existed still carries the graph the
    // canvas showed, and a graph with nodes IS the canvas having been open — so both
    // reopen the same way: the graph written into the model, the column swapped to the
    // canvas, and the seat + view applied once the canvas mounts. A package whose save
    // says 'output' (the canvas was closed) has no graph and opens as it always did.
    const graph = stored.graph;
    if (stored.middle !== 'output' && graph && graph.nodes?.length) {
      writeFlowToSurface(graph);
      setOutputColumn('flow');
    }
    let frames = 0;
    let applied = false;
    const apply = () => {
      if (applied) return;
      // THE SAME SHADOW-PIERCING READ AS THE SAVE'S (see there): `document.querySelector`
      // finds neither element in this shell, so both writes below were no-ops and a package
      // "reopened where it was left" only in the record.
      const layout = deepFind<HTMLElement & { leftCollapsed?: boolean }>('workspace-layout');
      const canvas = deepFind<HTMLElement & { applyWorkspaceState?: (s: unknown) => boolean }>('agent-canvas');
      if (canvas?.applyWorkspaceState) {
        canvas.applyWorkspaceState(stored);
        applied = true;
      }
      if (layout && typeof stored.leftCollapsed === 'boolean') {
        layout.leftCollapsed = stored.leftCollapsed;
      }
      if (!applied && ++frames < 40) requestAnimationFrame(apply);
    };
    requestAnimationFrame(apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPromptSession?.id]);

  const _handleDeleteProject = (projectId: string) => {
    // Prevent deletion of the only project
    if (projects.length <= 1) {
      alert(
        "Cannot delete the only project. At least one project is required.",
      );
      return;
    }
    if (
      confirm(
        "Are you sure you want to delete this project? This will also delete all prompts in this project.",
      )
    ) {
      conversationStorage.deleteProject(projectId);
      const updatedProjects = projects.filter((p) => p.id !== projectId);
      setProjects(updatedProjects);
      if (selectedProjectId === projectId) {
        setSelectedProjectId(
          updatedProjects.length > 0 ? updatedProjects[0].id : null,
        );
        if (updatedProjects.length > 0) {
          conversationStorage.setCurrentProjectId(updatedProjects[0].id);
        }
      }
    }
  };

  const _handleSelectProject = async (projectId: string) => {
    setSelectedProjectId(projectId);
    conversationStorage.setCurrentProjectId(projectId);
    // Load conversations for the selected project
    const conversations =
      await conversationStorage.getProjectConversations(projectId, true);
    setProjectConversations(
      conversations.sort((a, b) => b.updatedAt - a.updatedAt),
    );
    setIsMultiSelectMode(false);
    setSelectedConversationIds(new Set());
  };

  const _handleToggleConversationSelect = (conversationId: string) => {
    const newSelected = new Set(selectedConversationIds);
    if (newSelected.has(conversationId)) {
      newSelected.delete(conversationId);
    } else {
      newSelected.add(conversationId);
    }
    setSelectedConversationIds(newSelected);
  };

  const _handleDeleteSelectedConversations = async () => {
    if (selectedConversationIds.size === 0) return;

    if (
      confirm(
        `Are you sure you want to delete ${selectedConversationIds.size} prompt(s)?`,
      )
    ) {
      for (const id of selectedConversationIds) {
        await conversationStorage.deleteConversation(id);
      }
      setSelectedConversationIds(new Set());
      setIsMultiSelectMode(false);
      // Reload conversations
      if (selectedProjectId) {
        const conversations =
          await conversationStorage.getProjectConversations(selectedProjectId);
        setProjectConversations(
          conversations.sort((a, b) => b.updatedAt - a.updatedAt),
        );
      }
    }
  };

  const _handleDeleteSingleConversation = async (
    conversationId: string,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this prompt?")) {
      await conversationStorage.deleteConversation(conversationId);
      // Reload conversations
      if (selectedProjectId) {
        const conversations =
          await conversationStorage.getProjectConversations(selectedProjectId);
        setProjectConversations(
          conversations.sort((a, b) => b.updatedAt - a.updatedAt),
        );
      }
    }
  };

  const _handleProjectsClick = async () => {
    setActiveTab("projects");
    await loadProjects(); // Refresh projects when tab is opened
  };

  // Listen for conversation updates to refresh the list
  useEffect(() => {
    const handleConversationUpdate = async () => {
      // Always refresh projects list when conversationUpdated event fires
      // This ensures deleted projects are removed from the list
      // Force refresh to get latest data from API
      const allProjects = await conversationStorage.getAllProjects(true);
      setProjects(allProjects);

      // If the currently selected prompt was deleted, switch to default or all prompts
      const currentProjectId = conversationStorage.getCurrentProjectId();
      if (
        currentProjectId &&
        !allProjects.find((p) => p.id === currentProjectId)
      ) {
        // Selected prompt was deleted, switch to all prompts view
        setSelectedProjectId(null);
        conversationStorage.setCurrentProjectId("");
      }

      if (selectedProjectId && activeTab === "projects") {
        const conversations =
          await conversationStorage.getProjectConversations(selectedProjectId);
        setProjectConversations(
          conversations.sort((a, b) => b.updatedAt - a.updatedAt),
        );
      }
    };

    window.addEventListener("conversationUpdated", handleConversationUpdate);

    // Listen for switchToMemoriesTab event (from TeacherChat project label click)
    const handleSwitchToMemoriesTab = () => {
      setActiveTab("memories");
    };

    // Listen for switchToChatTab event (from MemoriesTab when clicking a conversation)
    // NOTE: This should NOT trigger when clicking conversations in the projects tab
    // The projects tab should just load the conversation without switching tabs
    const handleSwitchToChatTab = (event: Event) => {
      // Check if event came from projects tab - if so, NEVER switch tabs
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.fromProjectsTab) {
        console.log(
          "🚫 [Projects Tab] Ignoring switchToChatTab - chat panel is always visible",
        );
        return;
      }
      // Also check if we're currently on projects tab - don't switch if we are
      if (activeTab === "projects") {
        console.log(
          "🚫 [Projects Tab] Blocking switchToChatTab - staying on projects tab",
        );
        return;
      }
      // Chat is always visible in the right column — no tab switch needed
    };

    // Listen for editor-send-to-model event (from MyStoryEditor) — REMOVED: MyStory is retired

  // `toggle-third-column` WAS NEVER SENT BY ANYONE. It was listened for here with a handler
  // that dispatched `reset-columns-to-equal-widths` — which only the retired React
  // ResizableSplitter ever heard. The element that owns her column is `workspace-layout`,
  // and it broadcasts its own fact as `third-column-toggle` (the name its registry entry
  // declares); the shell has nothing to do with that fact — the layout owns it, and the save
  // reads her state off the element directly. Both dead ends are gone: a listener is not a
  // wire when the name it waits for is one nobody speaks.

  // ── A2UI: Wire run-requested / save-requested from Lit <prompt-section-editor> ──
  // The Lit editor (AI-emitted) is now the source of truth for sections in the AI surface.
  // Run executes the prompt (real backend call) and streams into compiledOutput.
  // Middle column appears on Run (even while streaming) and stays if output exists.
  // Clear-output collapses the middle column. Save persists both left content + compiled output.
  const handleRunRequested = async (e: Event) => {
    const detail = ((e as CustomEvent).detail || {}) as { sections?: any[] };
    const fromEditor = detail.sections || [];
    // The editor is the source of truth for what a person can see and edit — but it
    // is a MOMENT, not a state. The column is swapped while a surface lands, and a
    // Run that arrives inside that window reads back an empty editor. Two things
    // this app already knows are read in turn rather than running nothing (and
    // rather than blaming a save for a payload that was never sent):
    //   1. the repair prompt it put in the column (held until this Run answers it),
    //   2. the package's own left column, which is what the column was built from.
    const fromRepair = repairSectionsRef.current || [];
    const fromSession = (() => {
      try {
        const raw = currentPromptSessionObjRef.current?.leftColumnContent;
        return raw ? (JSON.parse(raw).sections || []) : [];
      } catch {
        return [];
      }
    })();
    const sections = fromEditor.length ? fromEditor : (fromRepair.length ? fromRepair : fromSession);
    console.log(
      '[WritingAreaIndex] run-requested from <prompt-section-editor>',
      `${fromEditor.length} section(s) from the editor`,
      fromEditor.length ? '' : `— editor empty, running the ${sections.length} the column holds`,
    );

    // ── NOTHING TO RUN IS THE ONLY THING THAT STOPS A RUN ────────────────────
    //
    // A RUN DOES NOT NEED A PACKAGE. This used to be nested inside "if there is no
    // session": with no package it tried a save, and when that save did not finish the
    // run refused — "Run did not execute… the save that creates one did not finish."
    // The owner, 2026-09-18: "So it does not have to save the package to run — that is
    // not required." He is right: Run sends the prompt and draws the canvas, and the
    // package is a place to KEEP the answer, not a permission to ask for one.
    //
    // The one real precondition is CONTENT. With nothing in the left column there is no
    // prompt to send, and that is what this says — where the person is looking, not only
    // in the console. Nothing else gates a run: the run's own call carries
    // `session_id: currentPromptSessionRef.current || undefined`, which is what an
    // unsaved prompt has always meant here.
    if (!sections.length) {
      console.warn('[WritingAreaIndex] Run has no sections — nothing was sent anywhere');
      setCurrentPromptSession((prev: any) =>
        prev
          ? { ...prev, compiledOutput: '⚠️ Run did nothing: there was nothing in the left column to run.' }
          : prev
      );
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content:
            '⚠️ **Run did nothing.** The left column came back empty, so there was no prompt to send ' +
            'and nothing was changed. Put something in a section — or press Repair on a finding — and press Run again.',
        },
      }));
      return;
    }

    // The repair prompt has done its job: Run folds these sections into the
    // session, which owns them from here. Holding the override would make the
    // NEXT package open still holding the previous repair.
    repairSectionsRef.current = null;
    // WHICH finding this run answers, captured before the prompt is let go. The run
    // is the repair; a fresh check is what settles it (see settleRepair).
    const repairingFinding = repairFindingRef.current;
    repairFindingRef.current = null;

    const leftColumnContent = JSON.stringify({ sections });

    // Reset output for fresh run; show middle immediately via isComposerRunning
    setCurrentPromptSession((prev: any) =>
      prev ? { ...prev, leftColumnContent, compiledOutput: '' } : prev
    );
    setIsComposerRunning(true);
    // THE SPINNER GOES ON NOW, not when the tree catches up. See setRunControlsBusy.
    runBusyFromRef.current = Date.now();
    setRunControlsBusy(true);

    // ── THE PROMPT DOCKS, AND THE CANVAS TAKES THE WIDTH ────────────────────
    //
    // The same process, read and then worked: the sections the left column holds are
    // the nodes, the finding is the trigger, and the run's own answers are the steps.
    // The dock itself is the LEFT COLUMN'S OWN act — it hears the Run from its own
    // footer and keeps its rail and one grip, so opening the prompt back up is a
    // gesture, not a navigation (see workspace-layout's run-click). Nothing here
    // forces it, because nothing here owns that width.
    const repairFinding = repairingFinding
      ? (catalogFindings || []).find((f: any) => f.id === repairingFinding)
      : null;
    // ── EVERY RUN DRAWS. The canvas is what the middle column is for, so it takes the
    // column on Run whether or not a repair started it. A repair arrives with a note at
    // the head of the flow; a plain prompt run has no finding, and the flow then starts
    // at the prompt's own seats — the model draws both (see RepairFlowInput.finding).
    // Nothing here asks whether there is something else to compile: there is not. The
    // flow IS the run's output, and the compiled text stays reachable through the
    // column's own selector and Clear.
    flowInputRef.current = {
      finding: repairFinding
        ? {
            id: repairFinding.id,
            check: repairFinding.check,
            component: repairFinding.component,
            nodeId: repairFinding.nodeId,
            file: repairFinding.file,
            level: repairFinding.level,
          }
        : null,
      sections: (sections || []).map((s: any) => ({ name: s.name, type: s.type, content: s.content })),
      label: repairTitleRef.current
        || (repairFinding
          ? `Repair — ${repairFinding.check}${repairFinding.component ? ` on ${repairFinding.component}` : ''}`
          : currentPromptSessionObjRef.current?.title || 'This run'),
    };
    flowFactsRef.current = { running: true };
    setOutputColumn('flow');
    publishRepairFlow();
    // THE CANVAS IS UP, SO THE PROMPT MAY FOLD. The dock is queued on this signal (see
    // workspace-layout): two frames, because a React render plus the renderer's rebuild and
    // a paint have to happen before the new middle column is actually on screen — and the
    // dock landing before it is what made her column take the width, then give it back.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      // THE BAR THAT ARRIVES IS TOLD, NOT ASSUMED. The swap replaced the middle column, so
      // the element that took the flag at the click is gone and the one now on screen was
      // created while the run was already in flight. One re-assert here is what puts the
      // spinner on the controls the person is actually looking at.
      setRunControlsBusy(true);
      window.dispatchEvent(new CustomEvent('flow-view-ready'));
    }));
    // …AND THE SPINNER IS HELD FOR A FLOOR OF ITS OWN, so the canvas is PRESENTED rather than
    // watched arriving: the assembly is as fast as it is, and a control that stops spinning
    // half a second in reads as a glitch, not as work. Released on the canvas's ready signal,
    // never earlier than MIN_RUN_BUSY_MS after the click.
    window.setTimeout(() => setRunControlsBusy(false), Math.max(0, MIN_RUN_BUSY_MS - (Date.now() - runBusyFromRef.current)));

    // ── The Run URL is RELATIVE, like every other call in this app ────────────
    //
    // It used to be `${import.meta.env.VITE_API_URL || ''}/api/teacher/query`.
    // VITE_API_URL is set in `backend/.env` to the DOCKER SERVICE NAME —
    // `http://prompt-composer-console:5001` — and RESTART-LOCAL.sh exports that file
    // into the shell before starting Vite, so the dev server inlined it. Every Run
    // therefore went to a hostname that resolves only inside the container and died
    // before it left the browser: `TypeError: Failed to fetch`, with nothing in any
    // server log, because nothing arrived.
    //
    // Every other endpoint already used the relative `API_BASE` ("/api") — the
    // backend serves this app from the same origin in every environment, dev and
    // deployed (see shared/apiHelper.ts) — which is exactly why only Run broke, and
    // why the proxy, the tunnel and the endpoint all looked healthy.
    //
    // Declared outside the try so the failure message can name the REAL address
    // instead of a path it was never sent to.
    const runUrl = `${API_BASE}/teacher/query`;

    try {
      const { getApiKey } = await import('@/services/authService');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const apiKey = getApiKey();
      if (apiKey) headers['X-API-Key'] = apiKey;

      // Build the structured context the backend _assemble_prompt_output expects:
      // { core_roles: { "System Role": ... }, custom_roles: [...] }.
      // (Previously sent markdown, which json.loads() rejected, so the backend fell
      // back to a bare "Execute the prompt configuration." with no real prompt.)
      // Which sections the model receives as core roles, and which fall through to
      // custom_roles. Declared in @/shared/promptSections so a seat added to the
      // left column cannot be silently dropped from the model's view by a list
      // nobody remembered to update — the failure was one missing string away.
      const CORE_ROLES = CORE_ROLE_LABELS;
      const coreRoles: Record<string, string> = {};
      const customRoles: { name: string; content: string }[] = [];
      for (const s of sections || []) {
        const name = s.name || s.section || s.role || s.type || 'Section';
        const content = (s.content || '').trim();
        if (!content) continue;
        if (CORE_ROLES.includes(name)) {
          coreRoles[name] = content;
        } else {
          customRoles.push({ name, content });
        }
      }
      const promptContext = JSON.stringify({ core_roles: coreRoles, custom_roles: customRoles });

      // ── Tool calls: the prompt's declaration, made real ──────────────────
      // The Tool Call section names the tool and carries the address. This turns
      // that into an actual call the SERVER executes before the model runs, so the
      // design is in the prompt instead of something the model is asked to imagine.
      // Read from the sections the user can see and edit — change the node in the
      // column and the check follows, rather than a hidden copy of the finding.
      const toolNode = (sections || [])
        .map((s: any) => String(s?.content || ''))
        .join('\n')
        .match(/figma node\s+(\d+:\d+)/)?.[1];
      const toolCalls = toolNode
        ? [{ name: 'figma.get_design_context', nodeId: toolNode, fileKey: FIGMA_FILE_KEY }]
        : [];

      const resp = await fetch(runUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          question: 'Execute the prompt configuration.',
          context: promptContext,
          mode: 'prompt_output',
          // NO temperature here. It sent 0.45 while the mode decides: grace_gui.py pins
          // 0.0 for every mode that is not `chat` (and turns reasoning off with it), so
          // this number was read by nobody and claimed otherwise. The chat is the only
          // place with a temperature — CHAT_TEMPERATURE, 1.5 — and the run is not a chat.
          // Executed server-side before the model runs. Empty when the prompt
          // declares no tool, which is not an error and changes nothing.
          tool_calls: toolCalls,
          // The prompt package this run belongs to. The backend uses it to
          // attach/reuse the conversation row (conversations.session_id is NOT
          // NULL), so every chat turn actually persists.
          session_id: currentPromptSessionRef.current || undefined,
          // No `model` — let the provider's configured default apply.
        }),
      });

      if (!resp.ok) {
        const errText = await resp.text();
        setCurrentPromptSession((prev: any) =>
          prev ? { ...prev, compiledOutput: `Error: ${resp.status} ${errText}` } : prev
        );
        setIsComposerRunning(false);
        return;
      }

      // The backend returns a single JSON object ({ content, error, conversation_id })
      // — not a Server-Sent Events stream. Parse it directly instead of expecting
      // `data: ` lines (which never arrive, so output stayed empty → "(No output returned.)").
      const data = await resp.json();
      const output = (data && (data.content || data.error || '')) || '';

      // A declared tool call that could not run is not a detail. The answer was
      // written WITHOUT the design, so the answer has to say so — otherwise a
      // design-blind reply arrives looking like a checked one. The ⚠️ prefix is
      // also what makes the middle column render its "could not be generated"
      // marker rather than passing this off as a finished result.
      const toolWarnings: string[] = Array.isArray(data?.tool_warnings) ? data.tool_warnings : [];
      if (toolWarnings.length) {
        console.warn('[run] tool warnings:', toolWarnings);
        window.dispatchEvent(new CustomEvent('a2ui:system-message', {
          detail: {
            role: 'assistant',
            content:
              '⚠️ **The tool call did not return the design.**\n\n'
              + toolWarnings.map((w) => `- ${w}`).join('\n')
              + '\n\nThis prompt was answered without it. Treat the result as '
              + 'unverified against Figma — and if the reason is that Figma Desktop '
              + 'is closed, open the file and press Run again.',
          },
        }));
      }

      setCurrentPromptSession((prev: any) =>
        prev
          ? {
              ...prev,
              compiledOutput: toolWarnings.length
                ? `⚠️ ${toolWarnings.join('\n')}\n\n---\n\n${output || '(No output returned.)'}`
                : (output || '(No output returned.)'),
            }
          : prev
      );

      // The answer is a fact the canvas draws: the Answer node's news, and the tool
      // node's warning when the declared call did not return the design. No claim is
      // made about the file here — that is the write's to make, below.
      if (flowInputRef.current) {
        flowFactsRef.current = {
          ...flowFactsRef.current,
          running: false,
          answer: data?.error ? 'error' : 'received',
          answerLine: firstLineOf(output),
          toolWarning: toolWarnings[0],
        };
        publishRepairFlow();
      }

      // ── THE RUN'S ANSWER IS NOT WRITTEN DOWN HERE ANY MORE ─────────────────
      //
      // It was: the output was saved through the same AI endpoint Save uses, because the
      // output column drew an answer the package kept nothing of (measured 2026-09-17: the
      // column held 279 characters while `compiled_output` was still 0, so a reload took it
      // off the screen). That fix was right about the SYMPTOM and wrong about the mechanism —
      // it made every Run call the model a second time, to save.
      //
      // The owner's rule (2026-09-18) is the one that holds: "people need to save manually
      // using the button, or get them an alert if they try to exit with unsaved changes."
      // Save does that job, and it is one click. A Run now runs and nothing else.
      //
      // THE COST, STATED: an answer that has not been saved is not on screen after a reload.
      // That is the same contract as every other edit in this column, and the person has a
      // button for it.

      // ── THE ANSWER BECOMES A FILE, AND ONLY THEN IS IT CHECKED ─────────────
      //
      // This is the step that was missing, and its absence is why the last run read
      // as a claim about a file: the answer was text, nothing put it anywhere, so
      // "Correction applied" could not have been true. The write comes FIRST and the
      // check comes after it, in that order, because the check has to read the new
      // file — and the chat says what the write returned, not what the model said.
      //
      // Two cases still do not settle anything, exactly as before: the run errored,
      // or the declared tool call did not return the design (in which case a change
      // was made without the thing it had to match — those lines are written down
      // here and go into the prompt, not into a file).
      if (repairingFinding && !data?.error && toolWarnings.length === 0) {
        const outcome = await writeAnswerBack(output || '', repairingFinding);
        // What the APP wrote, in the server's own numbers — the Data insert node's
        // only honest source. The model's claim about the file never was one.
        if (flowInputRef.current) {
          flowFactsRef.current = { ...flowFactsRef.current, write: outcome.report };
          publishRepairFlow();
        }
        // The repair is done being MADE. Whether it is done being REPAIRED is the
        // check's call, not this app's and not the model's: a fresh report settles it.
        //
        // Both halves have to be true for a verdict to exist at all — a file was
        // written, AND the checker was re-run against it. With nothing written there is
        // nothing to settle (the finding stays open, which is the truth, and the chat
        // above has just said why); with no re-run the only report available predates
        // the change, so reading it would be inventing a verdict.
        if (outcome.written && outcome.checked) {
          void settleRepair(repairingFinding);
        }
      } else if (repairingFinding) {
        // Nothing was written — and that is said here rather than left implied, because
        // a run that wrote nothing looks identical to a run that worked once the tab is
        // closed.
        speakRepairVerdict(
          "Nothing written — " +
          (data?.error
            ? "the run failed."
            : "the tool call returned no design, so the file was left alone."),
        );
      }
    } catch (err: any) {
      console.error('[WritingAreaIndex] Run execution failed', err);
      // Name the call. "Failed to fetch" on its own says nothing about WHICH
      // request died, and this path can fail before the request is even sent
      // (the dynamic import of authService) as well as during it.
      const why = err?.message || String(err);
      setCurrentPromptSession((prev: any) =>
        prev
          ? {
              ...prev,
              compiledOutput:
                `Error: ${why}\n\n` +
                // Name the address the request actually went to, resolved, plus the
                // page it was made from — the two facts that turn "Failed to fetch"
                // into something diagnosable. This message previously named a
                // RELATIVE path the browser had never been sent to, which sent the
                // reader looking at a proxy that was fine.
                `${runUrl}  (resolved: ${new URL(runUrl, location.origin).href}, from ${location.origin})\n\n` +
                `If this reads "Failed to fetch", the browser never got a response: the ` +
                `host is unreachable, the connection was dropped, or a module reloaded ` +
                `mid-flight. It is not a rejected prompt.`,
            }
          : prev
      );
      // And say it in the CHAT. Save failures already speak here
      // (a2ui:system-message); Run failures only wrote to the middle pane, so a
      // Run that died was silent everywhere a person actually looks.
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content:
            `⚠️ **Run failed.**\n\n\`POST /api/teacher/query\` did not complete: ${why}\n\n` +
            'The prompt itself was sent only if the request got that far. ' +
            '"Failed to fetch" means the browser got no response at all — the request was ' +
            'dropped or aborted, not rejected.',
        },
      }));
    } finally {
      setIsComposerRunning(false);
      // Optional: give the layout a hint to equalize widths when middle appears
      window.dispatchEvent(new CustomEvent('reset-columns-to-equal-widths', { detail: { isThirdColumnOpening: true } }));
    }
  };

  // `save-requested` HAD NO SENDER, so this whole path was unreachable — the registry
  // declared it as the editor's event, but <prompt-section-editor> emits none of that kind
  // (its contract is section-update/add/remove/reorder), and the control bar's Save speaks
  // through `save-click` (below) into the same handler this used. Removed rather than kept:
  // a listener nobody can fire is a claim that something is wired.

  // Clear from the compiled-output-viewer "Clear" button → collapse middle column
  const handleClearOutput = () => {
    console.log('[WritingAreaIndex] clear-output — collapsing middle column');
    setCurrentPromptSession((prev: any) =>
      prev ? { ...prev, compiledOutput: '' } : prev
    );
    // The column's CLOSE was never implemented: the flag this used to write (`middleOpen`)
    // was read by nothing, and the middle column's presence is the model's. Clearing the
    // output empties the viewer; it does not take the column away.
  };

    console.log('✅ [WritingAreaIndex] Setting up event listeners');
    window.addEventListener("switchToMemoriesTab", handleSwitchToMemoriesTab);
    window.addEventListener("switchToChatTab", handleSwitchToChatTab);

    // Listen for save-template event. Sections come from the surface's data model — the
    // composer column's binding. No DOM read, no fallback.
    const handleSaveTemplateEvent = () => {
      const sections = surfaceSections();
      const compiledOutput = readLiveOutput();
      console.log('[save-template] Reading', sections.length, 'sections +', compiledOutput.length, 'chars of output from the surface');
      handleSavePromptRef.current?.(compiledOutput, sections);
    };
    window.addEventListener("save-template", handleSaveTemplateEvent);

    window.addEventListener("run-requested", handleRunRequested);
    window.addEventListener("clear-output", handleClearOutput);

    // Wire the bottom control bar (control-bar from Figma node 40000761:261) to the *existing* CRUD paths only.
    // No new save/run/version logic — re-uses handleSavePromptRef + run-requested dispatch exactly as the Lit editor does.
    // Control-bar save: sections from the surface's data model (same as save-template).
    const handleControlBarSave = () => {
      const sections = surfaceSections();
      const compiledOutput = readLiveOutput();
      console.log('[control-bar] save-click →', sections.length, 'sections +', compiledOutput.length, 'chars of output from the surface');
      handleSavePromptRef.current?.(compiledOutput, sections);
    };
    const handleControlBarRun = () => {
      const sections = surfaceSections();
      console.log('[control-bar] run-click → dispatching run-requested (existing path)');
      window.dispatchEvent(new CustomEvent('run-requested', { detail: { sections } }));
    };
    window.addEventListener('save-click', handleControlBarSave as EventListener);
    window.addEventListener('run-click', handleControlBarRun as EventListener);

    // Wire undo-click from control-bar (Figma node 40000761:271 "undo-last-state-milivis")
    // TODO: undo-last-state-milivis has no backend handler yet. Wire the event now,
    // implement the Milvus state rollback when the backend supports it.
    const handleControlBarUndo = () => {
      console.log('[control-bar] undo-click → undo-last-state-milivis (no backend handler yet)');
      // Future: dispatch undo to Milvus state manager
      // window.dispatchEvent(new CustomEvent('undo-last-state'));
    };
    window.addEventListener('undo-click', handleControlBarUndo as EventListener);

    // DELETED: prompt-session-loaded listener - was database fallback bypassing AI assembly
    // All session loads MUST go through AI assembly via handleOpenPromptFromConsole
    const handlePromptSessionLoaded = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.sessionId) {
        handleOpenPromptFromConsole(detail.sessionId);
      }
    };
    window.addEventListener("prompt-session-loaded", handlePromptSessionLoaded);

    // Listen for prompt-session-deleted from LeftVerticalMenu
    // Uses ref to avoid stale closure (effect deps don't change on prompt load)
    const handlePromptSessionDeleted = (event: Event) => {
      const detail = (event as CustomEvent).detail || {};
      if (detail.id && currentPromptSessionRef.current === detail.id) {
        setCurrentPromptSession(null);
      }
    };
    window.addEventListener("prompt-session-deleted", handlePromptSessionDeleted);

    // Listen for start-new-prompt from LeftVerticalMenu — clear workspace without DB save
    const handleStartNewPrompt = () => {
      setCurrentPromptSession(null);
      setPromptLoadKey(prev => prev + 1);
    };
    window.addEventListener("start-new-prompt", handleStartNewPrompt);
    console.log('✅ [WritingAreaIndex] Event listeners set up');

    return () => {
      window.removeEventListener(
        "conversationUpdated",
        handleConversationUpdate,
      );
      window.removeEventListener(
        "switchToMemoriesTab",
        handleSwitchToMemoriesTab,
      );
      window.removeEventListener("switchToChatTab", handleSwitchToChatTab);
      window.removeEventListener("save-template", handleSaveTemplateEvent);
      window.removeEventListener("run-requested", handleRunRequested);
      window.removeEventListener("clear-output", handleClearOutput);
      window.removeEventListener('save-click', handleControlBarSave as EventListener);
      window.removeEventListener('run-click', handleControlBarRun as EventListener);
      window.removeEventListener('undo-click', handleControlBarUndo as EventListener);
      window.removeEventListener("prompt-session-loaded", handlePromptSessionLoaded);
      window.removeEventListener("prompt-session-deleted", handlePromptSessionDeleted);
      window.removeEventListener("start-new-prompt", handleStartNewPrompt);
    };
  }, [selectedProjectId, activeTab]);

  // When a project is selected/activated in Projects tab, default to Keeper chat
  // NOTE: Chat mode switching is now handled in onProjectChange callback based on user clicks
  // This ensures Grace remains default until user explicitly clicks a project

  // NOTE: Mobile layout now uses the same shell with responsive card grid.
  // The left nav collapses to hamburger via LeftVerticalMenu responsiveness.

  // ══════════════════════════════════════════════════════════════════════
  // A2UI: Shell ALWAYS renders. Loading/error states render INSIDE surfaces.
  // ══════════════════════════════════════════════════════════════════════

  return (
    <div
      {...UI_ID.LAYOUT.MAIN_CONTAINER}
      className="h-screen flex flex-row overflow-hidden"
      style={{ backgroundColor: "#E5E1DD" }}
    >
      {/* Real loading state indicator - shows actual database activity */}
      {sessionLoadingState.isLoading && (
        <SessionLoader
          isLoading={sessionLoadingState.isLoading}
          progress={sessionLoadingState.progress}
          error={sessionLoadingState.error}
          sessionName={sessionLoadingState.sessionName}
        />
      )}

      {/* Min-width warning overlay for desktop */}
      {!isMobile && <MinWidthWarning />}

      {/* A2UI v0.9: AI Decision Dialog - AI drives this interaction */}
      {aiDecision?.show && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#E5E1DD]/95 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md mx-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-start gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#234354] flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-semibold">G</span>
              </div>
              <div>
                <p className="text-[#1a1a1a] text-sm font-medium mb-1">Grace</p>
                <p className="text-[#1a1a1a] text-base">{aiDecision.message}</p>
              </div>
            </div>
            <div className="flex gap-3 justify-end flex-wrap">
              {aiDecision.actions.map((action) => (
                <button
                  key={action.id}
                  onClick={() => handleAIDecisionAction(action.id)}
                  className={`px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors ${
                    action.variant === 'primary'
                      ? 'bg-[#234354] text-white hover:bg-[#1a2f3d]'
                      : action.variant === 'destructive'
                      ? 'bg-red-100 text-red-700 hover:bg-red-200'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Legacy exit confirm dialog - kept for backward compatibility */}
      {showExitConfirm && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#E5E1DD]/95 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-sm mx-4 animate-in zoom-in-95 duration-300">
            <p className="text-[#1a1a1a] text-lg font-semibold mb-2">Leave composer?</p>
            <p className="text-gray-500 text-sm mb-6">You have an open session. Save your work before leaving, or discard changes.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={handleCancelExit} className="px-5 py-2.5 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
              <button onClick={handleConfirmExit} className="px-5 py-2.5 text-sm font-semibold bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-colors">Leave without saving</button>
              <button onClick={handleSaveAndExit} className="px-5 py-2.5 text-sm font-semibold bg-[#234354] text-white rounded-xl hover:bg-[#1a2f3d] transition-colors">Save &amp; leave</button>
            </div>
          </div>
        </div>
      )}

      {/* Left Vertical Menu — full-height icon strip */}
      <LeftVerticalMenu
        onNewChat={() => window.dispatchEvent(new CustomEvent("new-chat"))}
      />

      {/* Main content area — flex column that takes remaining height after header.
          Uses flex-1 + min-h-0 so the operator shell row below the header can grow
          to fill the viewport. No more vh calc hacks. */}
      <div
        className="flex flex-col flex-1 min-w-0 overflow-hidden"
      >
        {/* ── HEADER FRAME — spans full width above all columns ── */}
        <LeftColumnHeader
          flipped={flipped}
          onToggleFlip={toggleFlip}
          promptTitle={currentPromptSession?.title}
          version={currentPromptSession ? `Saved v${currentPromptSession.currentVersion || 1}` : undefined}
          currentVersion={currentPromptSession?.currentVersion}
          tags={currentPromptSession?.metadata?.tags?.join(', ') || undefined}
          promptId={currentPromptSession?.id}
          author={currentPromptSession?.metadata?.author || undefined}
          onTitleChange={handlePromptTitleChange}
          activeTab={headerTab}
          onTabChange={handleTabChangeWithGate}
        />

        {/* ── THE SURFACE HOST — the AI's surface, and now the only thing here ──
            The row used to hold two children: the surface, and the console's chat
            seat beside it. The seat is gone, so this row is the surface alone. */}
        <div className="flex flex-row overflow-hidden flex-1 min-h-0" style={{ minWidth: 0 }}>
            {/* ── AI SURFACE — Lit Shadow DOM sandbox for A2UI content rendering ── */}
            <SentryErrorBoundary scope="ai-surface" onError={(error) => console.error("AI Surface error:", error.message)}>
              {/* P1+MIGRATION: React AISurfaceSandbox → Lit <ai-surface-sandbox>.
                  Properties map to HTML attributes; children use named slots for
                  Shadow DOM projection. React components MUST be wrapped in DOM
                  elements — the browser assigns slots based on the slot="..."
                  HTML attribute, which React components do not render on their
                  root elements. */}
              <ai-surface-sandbox
                // NO `key` here. This carried key={isAIAssembling ? "assembling"
                // : "idle-or-failed"}, which changes on every assembly — and a
                // changed key makes React tear down and rebuild the WHOLE
                // subtree. That killed everything inside on every Grace emission:
                // the chat panel mid-conversation, and prompt-section-editor with
                // the composer's unsaved sections. Twice per assembly (true when
                // it starts, false when it ends).
                //
                // Nothing here needed a remount: <ai-surface-sandbox> routes its
                // slots from the is-ai-assembling and header-tab PROPERTIES, so a
                // property change already re-slots it. The key was paying for a
                // capability that was never used, with the state of the app.
                is-ai-assembling={isAIAssembling ? '' : undefined}
                header-tab={headerTab}
              >
                {/* slot="spinner" — honest loading state: one real spinner bound to
                     the live request via isAIAssembling, one true sentence.
                     No scripted message rotation, no fake progress bar,
                     no artificial minimum display time. */}
                <div slot="spinner" className="flex flex-col items-center justify-center gap-5 size-full" style={{ backgroundColor: isConsoleView ? '#582846' : '#E5E1DD', paddingBottom: '200px', ...(isConsoleView ? { backgroundImage: `linear-gradient(rgba(88, 40, 70, 0.15), rgba(88, 40, 70, 0.15)), url(${consoleBackground})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'top left' } : {}) }}>
                  <div className="w-8 h-8 border-4 border-[#507274] border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-[#507274] text-sm font-medium font-['Inter']">{aiAssemblyMessage}</p>
                </div>
                {/* slot="console" — shown when header-tab is "console" */}
                <div slot="console" style={{ display: 'flex', flex: '1 1 0%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'auto', backgroundColor: '#582846', backgroundImage: `linear-gradient(rgba(88, 40, 70, 0.15), rgba(88, 40, 70, 0.15)), url(${consoleBackground})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'top left' }}>
                  {/* A FAILED ASSEMBLY MUST SAY SO, IN THE SLOT THAT IS SHOWN.
                      The full failure pane lives in slot="workspace", and the sandbox
                      projects ONE slot — so a console failure wrote its message into
                      markup that was never displayed and the console went blank with
                      no explanation. Measured 2026-09-17: header-tab unset (→ console),
                      console slot 0 wide, no error rendered anywhere. This banner is
                      the one thing that must reach the visible slot. */}
                  {aiAssemblyFailed && !isFailureAcknowledged && (
                    <error-banner
                      code={aiAssemblyReport?.code || 'ASSEMBLY-FAILED'}
                      message={aiAssemblyMessage}
                      {...(aiAssemblyReport?.retryable ? { retry: true } : {})}
                    ></error-banner>
                  )}
                  {/* NO HOST PADDING. This wrapper carried `padding: 54px 16px 24px`,
                      which pushed the whole surface down — the cards AND the chat
                      column together — while the design insets neither: the chat
                      column touches the header and runs to the bottom of the
                      window, with only the container's own 10px on its right pane
                      (Figma "right-column-panel-container" #40001066:3272), and the
                      cards float inside their pane by the grid's own rules
                      (max-width + centred). Insets belong to the components that
                      were designed with them, not to a shell wrapper. */}
                  <div style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden' }}>
                    {/* ONLY THE SURFACE THAT IS ON SCREEN IS BUILT. Both slots used to
                        render at once and <ai-surface-sandbox> hid the one it was not
                        projecting, so the whole other screen — its cards, its chat panel,
                        every element — sat in the page at zero size. Measured 2026-09-17:
                        two a2ui-renderers, two chat panels, and 61 shadow roots on one
                        console page, with the hidden panel at 0x0. The cost was not only
                        weight: two live seats hear the same window events, which is how a
                        pick in the console's dropdown wrote into the composer's model.
                        The tree is handed back on mount (consoleTree / workspaceTree are
                        React state), so unmounting one costs nothing. */}
                    {isConsoleView && <a2ui-renderer ref={consoleRendererRef} />}
                  </div>
                  <ConsolePage
                    refreshKey={consoleRefreshKey}
                    aiAssembledCards={assembledConsoleCards}
                    isParentLoading={isAIAssembling}
                    loadingMessage={aiAssemblyMessage}
                    errorMessage={aiAssemblyFailed ? aiAssemblyMessage : null}
                    errorReport={aiAssemblyFailed ? aiAssemblyReport : null}
                    onCreateNew={async (_title) => {
                      await assembleSurfaceThenRepairs('render-composer', {
                        current_surface: headerTab || 'console',
                        has_unsaved_changes: hasUnsavedChangesRef.current,
                        session_id: currentPromptSession?.id || null,
                        session_title: currentPromptSession?.title || '',
                      });
                    }}
                    onOpenPrompt={async (sessionId) => {
                      await assembleSurfaceThenRepairs(`render-session:${sessionId}`, {
                        current_surface: headerTab || 'console',
                        has_unsaved_changes: hasUnsavedChangesRef.current,
                        session_id: currentPromptSession?.id || null,
                        session_title: currentPromptSession?.title || '',
                      });
                    }}
                  />
                </div>
                {/* slot="workspace" — AI-driven Lit tree (A2UI v0.9.1).
                    Slots are the loading contract. AI fills them with prompt blocks.
                    When assembly FAILS, show the error — no hiding. */}
                <div slot="workspace" style={{ display: 'flex', flex: '1 1 0%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden', backgroundColor: '#582846', backgroundImage: `linear-gradient(rgba(88, 40, 70, 0.15), rgba(88, 40, 70, 0.15)), url(${consoleBackground})`, backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'top left' }}>
                  {aiAssemblyFailed ? (
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', overflow: 'auto' }}>
                      {/* The DECLARED A2UI error surface. This slot previously held an ad-hoc
                          <pre>, while <error-banner> sat in the catalog, granted to every role,
                          accepted by a schema — and rendered by nothing on this path. A
                          component that exists and is never reached is the same finding
                          (`tag-inert`) the banner was written to fix.

                          ALERT, DON'T BLOCK: the ✕ acknowledges the HEADLINE only. The
                          diagnostics below stay until a successful assembly replaces them. */}
                      {!isFailureAcknowledged && (
                        <error-banner
                          code={aiAssemblyReport?.code || 'ASSEMBLY-FAILED'}
                          message={aiAssemblyMessage}
                          {...(aiAssemblyReport?.retryable ? { retry: true } : {})}
                        ></error-banner>
                      )}

                      {aiAssemblyReport && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {/* THE POINTER. A literal glyph plus the exact region — "an error
                              occurred" is not a location, and this pane exists to give one. */}
                          {(() => {
                            const parts = aiAssemblyReport.arrow.split(' ');
                            const glyph = parts.shift() ?? '';
                            return (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
                                <span aria-hidden="true" style={{ fontSize: '22px', lineHeight: 1, color: '#B45309' }}>{glyph}</span>
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#92400E' }}>{parts.join(' ')}</span>
                              </div>
                            );
                          })()}
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '3px' }}>What happened</div>
                            <div style={{ fontSize: '13px', color: '#111827', fontWeight: 600 }}>{aiAssemblyReport.headline}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '3px' }}>Why</div>
                            <div style={{ fontSize: '13px', color: '#374151' }}>{aiAssemblyReport.cause}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#6B7280', marginBottom: '3px' }}>What to do now</div>
                            <div style={{ fontSize: '13px', color: '#374151' }}>{aiAssemblyReport.fix}</div>
                          </div>
                          <details style={{ marginTop: '2px' }}>
                            <summary style={{ fontSize: '11px', fontWeight: 700, color: '#6B7280', cursor: 'pointer' }}>Raw diagnostics — verbatim, nothing filtered</summary>
                            <pre style={{ fontSize: '11px', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: '#374151', margin: '6px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word', background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '4px', padding: '10px' }}>{aiAssemblyReport.detail}</pre>
                          </details>
                        </div>
                      )}
                    </div>
                  ) : (
                    !isConsoleView && <a2ui-renderer ref={composerRendererRef} />
                  )}                </div>
            </ai-surface-sandbox>
          </SentryErrorBoundary>

          {/* ── THE CONSOLE'S CHAT IS NO LONGER DRAWN BY THIS SHELL ──────────
              It was here: a grip, a width state, and a <chat-panel> hung off
              that width, mounted outside the surface and present before the
              cards assembled. All three are gone.

              The console's chat is now IN the surface the model assembles: the
              same `chat-panel` the composer loads, beside `ConsoleCardGrid`
              and bound to the console's own conversation through the surface's
              data model (/console/conversation_id, /console/session_id). It
              arrives when the surface arrives, which is the point — nothing
              outside the assembly draws it, so it cannot appear ahead of the
              cards, and the same Lit element the composer loads is what the
              console loads.

              The React seat that used to answer to this comment is archived, not
              deleted: retired-files/console-seat-20260917/InteractiveChatInterface.tsx,
              with its README. */}

        </div>
      </div>
    </div>
  );
}
