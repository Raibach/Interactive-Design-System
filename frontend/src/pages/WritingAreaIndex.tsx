// THE APP'S COMPONENT REGISTRATIONS — every tag the surface can name, defined before any
// surface assembles. It rides with this page, not with the entry, so the sign-in gate never
// waits for forty elements it cannot draw yet (2026-10-02; the rule it protects — a tag
// nothing defines draws nothing — is documented in components/lit/register.ts).
import "@/components/lit/register";
import { useState, useRef, useEffect, useLayoutEffect, useCallback, lazy, Suspense } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
// THE ONE WAY THROUGH THE BOUNDARY. The design room's container is drawn by the design
// renderer INSIDE ITS SHADOW ROOT, and the ingest's three regions are React elements the
// renderer cannot instantiate — it builds elements from the catalogue by tag name, and the
// ingest is not a catalogue entry (it is the tool that WRITES the catalogue). So the injection
// below goes through a portal, whose target is a DOM node React did not create and does not
// own. It is the only mechanism in this file that reaches into the shadow tree, and it reaches
// exactly one element — the container the design assembler named.
// NO `createPortal` HERE, AND THAT IS LOAD-BEARING (2026-09-30). The design room is assembled —
// a surface is an adjacency list, and a React region appended to a shadow root's child list is
// not a child of anything that projects it: measured on the live page, the injected block drew
// beneath the room and pushed the whole design up by 129px. The ingest is the TEMPLATE for what
// this room must do; its functionality is translated into the catalogue's own elements, bound to
// the data model, drawn by the renderer. Nothing else may be mounted in there.
import {
  conversationStorage,
  type Project,
  type Conversation,
} from "@/services/conversationStorage";
import { useToast } from "@/hooks/use-toast";
import { loadSystemRegistry } from "@/shared/a2uiRegistries";
import { getAuthState } from "@/services/authService";
import { promptService, type PromptSession, type PromptSection } from "@/services/promptService";
import { UI_ID } from "@/utils/uiIdentifiers";
import { generateUuid } from "@/utils/uuid";
import LeftVerticalMenu from "@/components/LeftVerticalMenu";
import GovernanceNav from "@/components/navigation/GovernanceNav";
import LeftColumnHeader from "@/components/LeftColumnHeader";
import { useNotificationGate } from "@/hooks/useNotificationGate";
import { GOVERNANCE_GATE_MAX_MS } from "@/gate/gateTimings";
import ConsolePage from "@/pages/ConsolePage";
// THE DESIGN TAB LOADS A FILE, AND THAT FILE IMPORTS ITS CONTENT (owner, 2026-10-18: *"There is a
// button at the top. It's called Design. Load a file that imports its content."*). The shell holds
// no design code: it renders <DesignRoom />, and `design/DesignRoom` imports the room's parts —
// today the console experience, and per tab each tab's own experience file.
/* THE ROOM LOADS WHEN ITS TAB IS OPENED (2026-10-21). It used to be a static import here, so
   every byte of the Design room — its seat shells, the tools rail, the Figma layers tree — rode
   the boot chunk and had to arrive before the console could paint. Measured through the tunnel:
   the room chunk was 403 kB gzipped and took 1.7 s, and `figma-layers-view` alone was 55 kB /
   1.8 s of that. `lazy()` moves it behind the moment the Design button is pressed. */
const DesignRoom = lazy(() => import("@/design/DesignRoom"));
import consoleVideo from "@/assets/No-Copyright-waves.mp4";
// 2026-10-19: JPG re-encoded to WebP (516 KB → 231 KB) for faster loading.
import composerBackground from "@/assets/composer-image-bg.webp";
// THE PRODUCT ROOM'S ASSEMBLY GROUND — the SAME IMAGE as the composer's, carried as its own
// RE-LABELED copy (owner, 2026-10-14: *"just borrow it … same effect same fade in same
// everything but be sure to re-label it so it doesn't interfere with composer in any way"*).
// The room's one background is the composer's image; the assembly cover must load the SAME one —
// as a name of its own, so neither side can ever redefine the other's picture.
// 2026-10-19: JPG re-encoded to WebP (516 KB → 231 KB) for faster loading.
// MOVED (2026-10-21): the import went with the pane — `rooms/product/ProductRoom.tsx` wears it
// now, and this page no longer names the room's picture at all.
// THE DESIGN SECTION'S OWN CANVAS — the artwork behind the room's columns. Same import
// mechanism as the Composer's, so it is bundled and hashed like every other asset.
// The artwork is the owner's second pass at it (`images/design-section2-bkg.png`, 2026-09-30); the
// first file is still in the assets directory and is referenced by nothing.
// 2026-10-10: re-encoded to WebP (q90) — 348 KB PNG → 42 KB; the PNG stays in assets/_old.
import designSectionBackground from "@/assets/design-section2-bkg.webp";
// THE PRODUCT ROOM'S OWN GROUND RETIRED (2026-10-03 → 2026-10-05): the room wears the
// composer's ground now (see the workspaceBackground block below), and the wireframe-named
// duplicate of this tile left the tree with the retirement (2026-10-05 — one image for the lab
// ground; `canvas-wireframe-lab-bkg.png` deleted, referenced by nothing).
// 2026-10-10: re-encoded to WebP (q90) — 411 KB JPG → 238 KB; 2026-10-19: recompressed q75 → 77 KB.
import developmentLabBackground from "@/assets/canvas-development-lab-bkg.webp";
// THE GOVERNANCE GROUND, THIRD PASS (owner, 2026-10-09): the owner knocked the wave back in
// Photoshop — a transparent export, master `images/data-wave4.png`. That master is in the
// ORIGINAL (unmirrored) orientation, and the room's flip from earlier today still stands, so
// the asset imported here is a horizontal mirror of wave4 (`sips -f horizontal`, the same
// one-copy step as wave3's). Masters stay untouched; `data-wave3-flipped.png` is now
// referenced by nothing.
// 2026-10-10: re-encoded to WebP (q90) — 2.8 MB PNG → 354 KB; 2026-10-19: recompressed q75 → 177 KB.
import dataWave4Background from "@/assets/data-wave4-flipped.webp";
/* `canvasArt` WAS IMPORTED HERE AND NEVER RENDERED (removed 2026-10-21): a 301 KB WebP whose
   only job was to be a string nobody read. The ground the Run uses is `warmLabGrounds` below. */
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";

/**
 * THE VALUES THE COMPONENT WILL BE GIVEN — the data binding, for the preview to show.
 *
 * THE OWNER, 2026-09-30: *"it does not have to be blind to the data binding. It can load the data
 * binding as part of the preview… I think that creates a very clear picture of what it's doing at the
 * preview level."* So the preview carries the values, not only the drawing — and they come from THE
 * DATABASE ROWS the room already holds (`session/elements`, one `design_master` row per component),
 * never from the catalogue's declaration of itself and never invented: the names a component exists
 * under live in the database, which is the rule the room was built on.
 *
 * WHAT A PREVIEW MAY AND MAY NOT KNOW, stated because the two were one rule before this: it must not
 * resolve, import or read anything the application SHIPS (the catalogue's elements and behaviour —
 * `vite-plugin-figma-preview.ts`), and it MAY know the DATA its component will be given. Values are
 * data; the loader and the companions are code.
 *
 * A TAG WITH NO ROW YIELDS NOTHING — a component being created for the first time has no data yet,
 * and an empty list is that fact. Nothing is substituted for it.
 */
// `previewValues` LIVES IN `canvas/pageHelpers.ts` NOW (2026-10-21) — the first block pulled out
// of this file by the extraction plan (development/ops/WRITING-AREA-EXTRACTION-PLAN.md).
// InteractiveChatInterface is RETIRED — archived, not deleted, at
// retired-files/console-seat-20260917/InteractiveChatInterface.tsx. The console's
// chat is the same Lit <chat-panel> the composer loads, assembled in the console's
// surface and bound to the console's own conversation.
// MobileLayout stood here — a stub returning null, imported and never rendered. It was
// moved to retired-files/dead-code-20260918/ with the rest of the unreachable React set
// (2026-09-18). Responsive handling is `useIsMobile` alone: NO width warning, by the
// owner's word (2026-10-18) — a narrow window clips the card rather than telling the
// person to buy a bigger screen. The overlay lives at
// retired-files/responsive-warning-20261018/MinWidthWarning.tsx.
import { deepFind, loadCanvasElements, loadDraftElements, warmLabGrounds } from "@/canvas/pageHelpers";
import { useOpenCardFromConsole } from "@/rooms/useOpenCardFromConsole";
import type { UseOpenCardFromConsoleDeps } from "@/rooms/useOpenCardFromConsole";
import { ProductRoom } from "@/rooms/product/ProductRoom";
import { useProductGate } from "@/rooms/product/useProductGate";
import { useProductFootWiring } from "@/rooms/product/useProductFootWiring";
import { useProductEntry } from "@/rooms/product/useProductEntry";
import { useWriteProductDraftPayload } from "@/rooms/product/useWriteProductDraftPayload";
import { useWriteProductArtifactPayload } from "@/rooms/product/useWriteProductArtifactPayload";
import { useCheckBuilderEngine } from "@/rooms/product/useCheckBuilderEngine";
import { useOpenProductRoom } from "@/rooms/product/useOpenProductRoom";
import { useDiscardProductProject } from "@/rooms/product/useDiscardProductProject";
import { useGuardProductExit } from "@/rooms/product/useGuardProductExit";
import { useProductAttachment } from "@/rooms/product/useProductAttachment";
import { useAssembleProductSurface } from "@/rooms/product/useAssembleProductSurface";
import { useProductBuildWireframe } from "@/rooms/product/useProductBuildWireframe";
import { useProductNodeEdit } from "@/rooms/product/useProductNodeEdit";
import { useProductSeat } from "@/rooms/product/useProductSeat";
import { useProductConversationPoll } from "@/rooms/product/useProductConversationPoll";
import { useProductDraft } from "@/rooms/product/useProductDraft";
import type { DraftPayloadShape } from "@/rooms/product/types";
import { useDesignSurface } from "@/rooms/design/useDesignSurface";
import { useDesignPreview } from "@/design/useDesignPreview";
import { useRestorePackageWorkspace } from "@/canvas/useRestorePackageWorkspace";
import { useTabGate } from "@/rooms/useTabGate";
import { useAssembleSurface } from "@/console/useAssembleSurface";
// THE DEVELOPMENT AND GOVERNANCE ROOMS ARE FOLDERS TOO (2026-10-21) — the Product room's
// architecture applied to both: the page renders <DevelopmentRoom /> and <GovernanceRoom />
// and calls their hooks; the markup and the behaviour live in `rooms/<room>/`.
import { DevelopmentRoom } from "@/rooms/development/DevelopmentRoom";
import { useDevelopmentRoom } from "@/rooms/development/useDevelopmentRoom";
import { GovernanceRoom } from "@/rooms/governance/GovernanceRoom";
import { useGovernanceRoom } from "@/rooms/governance/useGovernanceRoom";
import { useGovernanceChrome } from "@/rooms/governance/useGovernanceChrome";
import { useRunPipeline } from "@/canvas/useRunPipeline";
import { useShellEventListeners } from "@/canvas/useShellEventListeners";
import { useAiOrchestrator } from "@/shared/ai-orchestrator";
import { eventBus } from "@/shared/event-bus";
// THE CAPTURE EMITTER — the browser's half of the element capture door. The door records
// against catalogue element keys; the renderer forwards each interaction with the tag beside
// the instance id, and this page hands the fact on. No vendor, no token: same-origin POST.
import { uxCapture } from "@/shared/uxCapture";
import SessionLoader from "@/components/SessionLoader";
import { API_BASE } from "@/shared/apiHelper";
import { apiFetch } from "@/shared/apiFetch";
import { isDemoMode } from "@/shared/appConfig";
// THE GOVERNANCE TRACE READS — see the module's header for why the reads live there:
// same-origin tRPC against the embedded app's own session, the only read path this
// deployment answers in v4 events_only mode. The views never fetch; this shell does.
import { fetchGovTrace, fetchGovObservationIO, fetchGovTraceScores, fetchGovObservationCommentCounts, observationWindow, type GovTraceBundle, type GovTraceScore } from "@/lib/governance-trace-source";
/* THE INGEST MODAL IS NOT IMPORTED HERE ANY MORE (2026-10-21). Nothing in this file rendered it
   — only two comments mention it — and it dragged `figma-layers-view` (55 kB, measured 1.8 s
   through the tunnel) plus the whole modal into the boot chunk. The Design room imports what it
   draws; this page does not. */
/* THE INGEST'S URL PARSER IS NOT IMPORTED HERE (2026-10-21): `parseFigmaUrl` was imported and
   never called — the Design room and the modal both parse their own links. */
// The renderer's own resolver, imported rather than re-implemented: the shell asks the same
// authority the renderer will use, so "what can be drawn" has one answer.
// AND ITS PROP PIPELINE, for the room seats: `assignProps` writes a component's settings onto
// the element — the same step the renderer's own `_assign` runs. `resolveTag` and
// `componentProps` were imported beside it and had no caller left after the dead row-click
// handler went (removed 2026-10-21).
import { assignProps } from "@/components/lit/a2ui-renderer";
// TYPE-ONLY, and both elements are already REGISTERED by `@/components/lit/register` (the
// first import above) — these two lines are only the refs' types, never a second runtime
// import of the elements themselves.
import type { WorkspaceLayout } from "@/components/lit/workspace-layout";
import { useProductRoomState } from "@/rooms/product/useProductRoomState";
import type { EvalsChatPanel } from "@/components/lit/evals-chat-panel";
import type { ChatPanel } from "@/components/lit/chat-panel";
import type { BuilderEmbed } from "@/components/lit/builder-embed";
import { markArrival } from "@/shared/arrival";
import { getStoredUserId } from "@/services/authService";
// The frontend half of the fail-loud boundary. Every failure the shell can observe gets
// named, pointed at, and shown — see shared/error-registry.ts for why this is a hardcoded
// ledger rather than a heuristic.
import { classifyFailure, type FailureReport } from "@/shared/error-registry";
// The A2UI envelope boundary — the version and surface labels on every operation,
// read instead of assumed. See shared/a2ui-envelope.ts: a version this shell does
// not implement, or a response describing more than one surface, is refused here
// rather than parsed as v0.9.1-and-one-surface.
import { readA2UIEnvelope, envelopeRefusalError, applyComponentUpdate } from "@/shared/a2ui-envelope";
// The trace view's data path. The reads (the app logger, Sentry's global scope)
// live behind this module, and this shell is what WRITES what they hold into the
// surface's model — the same shape writeSectionsToSurface uses for /session.
// See lib/trace-source.ts for why the element does not fetch its own.
import { subscribeTrace, traceSnapshot, type TraceSnapshot } from "@/lib/trace-source";
import { buildRepairSections } from "@/shared/repairSections";
// The trigger rule lives once, in shared/triggers.ts. `withTrigger` was imported here and never
// called (removed 2026-10-21); the canvas and the row's menu import it themselves.
import { repairAsk, repairBrief } from "@/shared/repairMaterial";
// The flow — the same process the prompt is, drawn. The builder is pure (it makes
// the graph from facts this file already holds); everything below the import is the
// writing, the swapping and the listening.
import {
  buildRepairFlow,
  type FlowNote,
  type FlowPosition,
  type FlowSeatInput,
  type RepairRunFacts,
} from "@/shared/agentFlow";
// THE BLOCKERS, COMPUTED — the whole pre-Run list, so she explains it instead of deriving it.
// `holdsRun` and `runHoldingRepairs` live in the module that owns them; this shell never called
// them (removed 2026-10-21, with `reviewFlow`, which had no caller here either).
// THE PACKAGE'S FACTS, READ BY THE READER THE SEAT READS THEM WITH — the name and the
// description, surface first. Two readers of one fact is what held every Run on a package whose
// description was on screen; see the module's head.
import { packageTitle, packageDescription } from "@/shared/packageFacts";
// What a row is called — one reader for the four fields a name arrives in. A saved row carries
// no `name` and no `type`, so anything that picks fields by hand drops the name it needs.
import { declaredName } from "@/shared/promptSections";
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
  isCatalogAuditDisabled,
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
 * THE CANVAS IS FETCHED WHEN A RUN ASKS FOR IT — and never before.
 *
 * `main.tsx` used to import the two canvas elements with the rest of the components, so every
 * person who opened a package paid for the drawing's code and its 591KB ground whether or not
 * they ever ran anything. The owner, 2026-09-23: "When the user opens a package, prompt
 * package or clicks composer, we don't need to load all of the code for the canvas at that
 * same time. We only load that once the run is clicked."
 *
 * TWO THINGS HAPPEN HERE, AND THE ORDER MATTERS:
 *   1. the ground starts fetching — it is the one part of the canvas that cannot arrive after
 *      the pane is on screen without a flash of the fallback colour (measured against the
 *      deployed site, 2026-09-23: "a very ugly purple paint"), and a Run gives it the whole
 *      dock to arrive in;
 *   2. the elements are imported, and the caller swaps the column only once they are defined,
 *      because the surface names RoomEmbed and a tag nothing defines draws an empty box with
 *      no error anywhere.
 *
 * ONE PROMISE PER SESSION, held at module scope so a re-render cannot start a second fetch.
 * A failure clears it: the next Run tries again, and the run that failed leaves the output
 * column where it was (the caller says why — see the Run's own catch).
 */
// `loadCanvasElements` LIVES IN `canvas/pageHelpers.ts` NOW (2026-10-21).

/**
 * NO WIDTH IS ASKED FOR HERE ANY MORE, AND THAT IS THE DECISION. The room used to name two pixel
 * widths (380 at rest, 650 while the preview was open) and hand them to the layout, which meant the
 * surface was choosing a number the operator could not see the reasoning for. The owner, 2026-09-30:
 * *"the design panels should load equal… they should be equal on both sides… I think we set a number
 * of 650 before — let's just do percentages and then let the user expand it where needed."*
 *
 * So the room asks for the element's OWN EQUAL SHARES — two panes equal while her column sits beside
 * the prompt, three while the middle one is open — and a drag still claims a width for the operator
 * afterwards, exactly as it does on a fresh package. See `splitEqually` in `workspace-layout.ts`.
 */

/* `loadCanvasElements` LIVES IN `@/canvas/pageHelpers` NOW (2026-10-21). It and its module-scope
   promise moved out of this page: the canvas fetch is a landing concern, not room navigation. */

/**
 * THE ROOM GROUNDS, WARMED AT LANDING (owner, 2026-10-05: *"an awful paint progressive JPEG
 * effect … load those backgrounds early somewhere else in the application, maybe after the
 * user lands"*). The Development room paints its lab tile the moment it opens, and since
 * 2026-10-16 the room-switch cover can wear any room's own face (see `handoffCoverShown`):
 * the lab tile (Development), the assembly image (Product), the wave (Governance), the design
 * sheet (Design). Fetched cold they visibly paint themselves in mid-switch, so all four decode
 * here, deliberately not awaited and failure-is-nothing: every room still fetches its own
 * ground; this buys only that the usual path spends no time on it.
 */
/* `warmLabGrounds` LIVES IN `@/canvas/pageHelpers` NOW (2026-10-21). */

/**
 * THE DRAFTING VIEW'S ELEMENT, loaded the same lazy way and for the same reason: the tree-write
 * that shows the draft CREATES `<draft-canvas>` by tag, and a tag whose module was never imported
 * is an unknown element — a blank column with no error anywhere. So the module is awaited before
 * the write, not after it.
 */
/* `loadDraftElements` LIVES IN `@/canvas/pageHelpers` NOW (2026-10-21). */

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
/* `deepFind` LIVES IN `@/canvas/pageHelpers` NOW (2026-10-21). */

/**
 * The Figma file the tool calls address.
 *
 * The same key the catalogs carry as `x-figma-source.fileKey` and the registry
 * records per component, so a tool call and the component's provenance cannot
 * drift apart. It is a literal here because the browser has to name the file when
 * it asks the server to run the tool — the server defaults to it too, and a call
 * that names no file is a call nobody can audit.
 */
/* `FIGMA_FILE_KEY` and `RUN_DOCK_MS` LIVE IN `@/canvas/pageHelpers` NOW (2026-10-21). */

/**
 * HOW LONG THE PROMPT TAKES TO FOLD — the pane's own `--dur-pane`, restated here because the
 * shell has to WAIT for it before it shows what the fold was making room for. Two places, one
 * number: if the stylesheet's curve changes, this changes with it (workspace-layout's
 * stylesheet is where it is declared).
 *
 * MOVED 520 → 760 WITH THE STYLESHEET, 2026-09-23, when the owner asked for the panes to "ease
 * back, smooth and contemplative". A longer fold with the old wait would have published the
 * canvas while the panes were still sliding — the delay is what makes the fold read as one event
 * and the picture as the next (see the beat below).
 */



export default function Index({
  onLogout: _onLogout,
  isAuthenticated: _isAuthenticated,
}: WritingAreaIndexProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { id: routeSessionId } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  /* `useIsMobile()` and `useLayoutState()` WERE CALLED HERE AND THEIR RESULTS THROWN AWAY
     (removed 2026-10-21): `isMobile` and `flipped`/`toggleFlip` were never read or called in
     this file, so both hooks ran their own effects — a media-query listener and a layout
     subscription — for nobody. The mobile handling lives in the components that use it. */
  const [activeTab, setActiveTab] = useState("composer");
  const {
    tabLoading: _tabLoading,
    headerTab,
    setHeaderTab,
    handleHeaderTabChange,
    handleNotificationAction: _handleNotificationAction,
    finishTabChange: _finishTabChange,
    handleSuppressNotification: _handleSuppressNotification,
    isNotificationSuppressed: _isNotificationSuppressed,
  // A2UI: Removed onNavigate - AI controls surfaces, not URL routing
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
   * THE PRODUCT ROOM'S OWN STATE (moved 2026-10-21). The page names none of it now: the tree,
   * the open package, the project, the seat's settled hand, the stage key, the grip, the three
   * canvases and the artifact all live in `@/rooms/product/useProductRoomState` with the
   * comments that explain them. Destructured under the same names, so every reader below is
   * unchanged.
   */
  const {
    productTree, setProductTree,
    /* THE SETTER STAYS, THE VALUE GOES (2026-10-21): nothing in this file reads
       `currentProductSession` any more — the room's assembly writes it and its own hook reads
       it through `currentProductSessionRef` — but the assembly still needs the setter, so it
       is passed below. Removing the pair would have been removing a live write. */
    setCurrentProductSession,
    productRoomProjectId, setProductRoomProjectId,
    productSeatSettledRef,
    productStageKey, setProductStageKey,
    productGripActive, setProductGripActive,
    currentProductSessionRef,
    productDraftPayloadRef,
    productSelectedNodeRef,
    productRendererRef,
    productLayoutRef,
    productSeatRef,
    productArtifactRef,
  } = useProductRoomState();
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
  const [designTree, setDesignTree] = useState<{ components: any[]; dataModel: Record<string, any> }>(
    { components: [], dataModel: {} },
  );

  /* THE TOOLS SEAT OWNS ITS OWN ASSEMBLY AND ITS OWN DOOR (`design/ToolsSeat.tsx`, owner,
     2026-10-18: the Figma section "was loading by default when you selected design and I'm just
     trying to move it and its chat which goes with it to the tools tab"). Nothing of that seat is
     asserted here — not its tree, not its seats, not its listeners. */

  /** The builder's engine, up or down — the bridge's /api/builder/health door, read when the room opens. */
  const [builderEngineDown, setBuilderEngineDown] = useState(false);
  /*
   * THE DEVELOPMENT ROOM OPENS STRAIGHT INTO THE WORKSPACE — NO ASSEMBLY. There is no gate,
   * no cover, no minimum clock, no ceiling: the workspace's own loading face is the room's
   * state, from its first frame. A load may never be held hidden behind a spinner or a cover
   * — a ready (or failed) workspace sitting behind a claim is suppression; fail fast, show
   * the truth. A stopped workspace draws nothing — no fallback, ever.
   */
  /* THE DEVELOPMENT ROOM'S RAIL LIST MOVED WITH THE ROOM (2026-10-21): it is
     `DEVELOPMENT_SEAT_TABS` in `@/rooms/development/useDevelopmentRoom`, where the seat that
     consumes it is bound. The page's copy had no reader left. */

  /*
   * THE PRODUCT ROOM'S OWN RAIL LIST (owner, 2026-10-06 — the wireframe's list, nothing more):
   * Chat, Trace, Tools, Approve, Evals — the menu items carry through; their VIEWS are stubs
   * for a later phase (owner: *"some of those are stubs … that's a whole 'nother phase where I
   * have to build out each one of those views"*). Settings stays for the panel's gear;
   * Versions, States and Repairs are not offered in this room.
   */
  const PRODUCT_SEAT_TABS = 'chat,trace,tools,approvals,eval,settings';

  /*
   * THE GOVERNANCE ROOM OPENS THE SAME WAY (owner, 2026-10-07: *"pop it in there"* —
   * OpenMetadata as the room's tool, its login KEPT as the tool's own administrative layer:
   * *"I'm gonna require login. Because this is an administrative tool and I want another
   * layer."*) Same three hands, third room: the minimum (three seconds, matching the other
   * two rooms), the frame's own load, and the seat's binding — the cover spans the whole
   * room and drops only when all three have landed, or at its ceiling; then the room eases
   * in underneath it, one 700ms cross-fade. A frame that never arrives leaves the pane on
   * its own ground — no fallbacks.
   */
  /* The gate clocks live in @/gate/gateTimings — extracted 2026-10-19. */
  /*
   * THE ROOM'S OWN RAIL LIST — the Development room's list and its reasons (the rail's
   * empty-list rule draws every tab, Versions included; this room states the membership it
   * wants instead).
   * THE TRACE TAB IS OUT OF THIS ROOM (owner, 2026-10-17: *"Evals are important, evaluators are
   * important, rules are important — those I get, those I understand"*, after calling the
   * trace table *"a log … bloat"*). Traces keep being written — they are the evidence an
   * evaluator's verdict lands on — but a browser of 700+ successful calls with seventy
   * filters is engineering tooling, not a surface a person in this room uses. What is
   * actionable stays: the verdict in the evaluator's status, and the failed-call count on
   * the readout (grace_gui writes level ERROR with the provider's real reason).
   * Restoring the tab is one word here: add `trace` back to the list.
   *
   * THE ROOMS THAT DO OFFER IT STILL DO (the owner's word, 2026-10-18: the removal he asked
   * for was of the WORD, not the application — Development and Product keep Trace).
   *
   * AND SESSIONS TAKES THAT SEAT (owner, 2026-10-17: *"well let's add sessions to where the
   * trace was … make preview Sessions"*). The rail filters by TABS order, so the Sessions
   * button lands in the second position — the slot the Trace button occupies in the rooms
   * that still offer it.
   *
   * STATES AND REPAIRS ARE OUT OF THIS ROOM (owner, 2026-10-18, with a picture of the two rail
   * buttons: *"remove these from the governance chat panel"*). The tabs themselves stay defined in
   * `chat-navigation-bar.ts` because Development still draws the console's rail — this is the
   * GOVERNANCE room's list, and the room it belongs to is the only thing that changed.
   */
  const GOVERNANCE_SEAT_TABS = 'chat,sessions,tools,approvals,eval,settings';
  /**
   * THE ROOM'S LANDING BEAT — the staged opening's clock (see the room's render).
   *
   * It times the cover over the embedded application: the minimum, the seat's binding, and
   * the ceiling that drops the cover honestly if a hand never lands. Restored 2026-10-18 with
   * the application itself.
   */
  const [governanceGateDown, setGovernanceGateDown] = useState(false);

  /*
   * THE GRIP'S SAFETY NET, GOVERNANCE'S COPY (2026-10-13): the chat strip's whole gesture
   * rides document-level moves (the seat's own measured design — pointer capture was tried
   * and rejected), and THIS room's surface is a builder-embed iframe — the strip's left
   * neighbour — so the frame's document swallows every move the moment the hand crosses onto
   * it and the drag freezes. The owner, 2026-10-13: *"I cannot grab the chat gripper and
   * pullout the trey for chat, it's stuck"* — the console has no iframe beside it, which is
   * why the same strip works there. THE PRODUCT ROOM'S FIX, one room over (see
   * `productGripActive`): while this flag is true the room draws a transparent fixed
   * overlay, so every move of the gesture stays in THIS document. ROOM-SIDE: the seat
   * element is untouched.
   */
  const [governanceGripActive, setGovernanceGripActive] = useState(false);
  /* WHAT THE ROOM REPORTED AS SELECTED — the trace (and node) the person is working
     through. The frame's own reporter carries a row click and a node click (the
     langfuse-location path's traceId/observation/timestamp params — verified live
     2026-10-13), our tree's clicks write the node back into it, and ONE read effect
     below turns it into the seat's views. Nothing else consumes it. */
  const [governanceTraceSig, setGovernanceTraceSig] = useState<{
    projectId: string;
    traceId: string;
    obsId: string | null;
    timestampIso: string | null;
    /** The app's own `peek` value — the observation IT calls the trace's root; the table
        hears the row mark from this id, so the room keeps it (2026-10-13 late). */
    peekId: string | null;
  } | null>(null);
  /* THE SEAT'S VIEWS MOUNT A BEAT AFTER A SELECTION CAN ARRIVE (owner, 2026-10-17: the tree
     sat empty while the read was healthy — "Trace is disconnected"). The bundle effect used
     to RETURN when the views were not registered yet and never ran again; this tick makes it
     retry once the mount settles, so a selection that lands first is APPLIED, not dropped. */
  const [governanceTraceElsTick, setGovernanceTraceElsTick] = useState(0);

  /* MOVED (2026-10-21): the room's nav (`governancePath`, `governanceSectionPrefix`,
     `navigateGovernanceTool`) and the app's location reporter live in
     `@/rooms/governance/useGovernanceChrome`. Called below, after the refs exist — the
     reporter reads the embed, the layout and the seat. */
  const governanceGateMaxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const governanceSeatSettledRef = useRef(false);

  /*
   * THE PRODUCT ROOM'S STAGED OPENING (2026-10-05): the builder's own first paint is white,
   * and uncovered it flashes between the frame's mount and its content — this cover hides
   * that splash. Its hands (2026-10-06; the time minimum removed 2026-10-21 by the owner's
   * order): the gate spans the whole room and drops only when the frame's load event and the
   * seat have both landed. The ceiling takes the cover down and the pane draws NOTHING — no
   * fallbacks; the frame is unmounted with the ceiling (see the pane's own rule below), and
   * the next entry asks again.
   *
   * THE OPENING IS PRODUCT'S AND GOVERNANCE'S ONLY. Development has none — it opens straight
   * into its workspace; never reintroduce a cover there (a load held hidden behind a claim
   * is suppression).
   * The faces and clocks themselves belong to the room: they live in
   * `@/rooms/product/useProductGate` and are destructured below, under these same names.
   */

  /*
   * AND THE COVER IS THE WHOLE ROOM'S (owner, same night — the illusion "creates a nice fade
   * into the application"). It holds until BOTH of the room's hands have landed — the frame's
   * load and the seat (the time minimum was removed 2026-10-21: a floor is still a hold) — and
   * then the room eases in under it as one object. Measured
   * before it (2026-10-06, driving the room cold): the chat column sat frozen at its 104px
   * rail floor — the layout's declared 600 landed in a render that could not yet measure the
   * element — until an unrelated re-render unfroze it seconds later; that unfreeze, visible
   * beside the left-only cover, was the pop. Both crossings live in the room's own gate hook
   * (`@/rooms/product/useProductGate`) so no writer can drop the cover on two hands and forget
   * the third.
   */
  /* MOVED (2026-10-21): the gate's faces, clocks, effect and lift rule live in
     `@/rooms/product/useProductGate`. Destructured under the same names, so every call site
     below — the tab gate, the frame's load handler, the JSX — is unchanged. */
  const {
    productGateDown,
    productToolDown,
    productFrameLoadedRef,
    dropProductGateWhenAllLanded,
    setProductGateDown,
    setProductToolDown,
  } = useProductGate({ headerTab, productSeatSettledRef });
  /**
   * THE GOVERNANCE ROOM'S OWN HAND — THE SEAT, and since 2026-10-21 nothing else: the minimum
   * is gone by the owner's order (*"remove those time minimums"*), and the frame-load hand
   * went with the application on 2026-10-08. `assertPaneWidth` rides here — this is the room's
   * own standing moment (same `requestUpdate` door, same reason: the declared column width can
   * land in a render that could not yet measure the room).
   */
  const dropGovernanceGateWhenAllLanded = useCallback(() => {
    if (governanceSeatSettledRef.current) {
      assertPaneWidth(governanceLayoutRef.current);
      setGovernanceGateDown(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /**
   * HER POP-OUT OPENS AT 650 (owner, 2026-10-13 late: *"I think a pop out of 650 pixels
   * wide is a good default. They won't expand it more. They can easily do that."* — the
   * design's own 650). A PROPERTY through the ref, the product room's exact mechanism:
   * the layout lands a declared width once (see `chatLoadWidth`), a drag still wins
   * afterward, and the room still LOADS with her closed — the declaration only says how
   * wide she stands when she is asked out.
   */
  useLayoutEffect(() => {
    if ((headerTab || '') !== 'governance') return;
    const el = governanceLayoutRef.current;
    if (!el) return;
    el.chatLoadWidth = 650;
  }, [headerTab]);
  /*
   * THE PANE'S WIDTH, ASSERTED WHERE IT CAN BE MEASURED. The room declares her column's load
   * width (`chatLoadWidth`, below) and the layout lands it once — but that landing render can
   * run before the room has been laid out, and `_columnWidth()` clamps the declared 600 into
   * the room's then-unmeasurable box: the pane then holds its 104px floor until something
   * else re-renders the element (measured 2026-10-06: nothing did, for the whole entry, until
   * an unrelated package effect). A `requestUpdate` is the element's own door: its state
   * already says 600, and one forced render picks the real width back up. Idempotent — a
   * settled room re-renders the same style and nothing moves.
   */
  const assertPaneWidth = useCallback((el: WorkspaceLayout | null) => {
    try {
      el?.requestUpdate?.();
    } catch {
      /* not an upgraded element yet — the next beat asserts again */
    }
  }, []);



  /*
   * THE GOVERNANCE ROOM'S STATE (2026-10-03) — the room where the system accounts for what it
   * spent. The same law as Product's and Design's: this room's assembly writes THESE two, and no
   * path from Governance writes the Composer's `currentPromptSession`.
   */
  const [governanceTree, setGovernanceTree] = useState<{ components: any[]; dataModel: Record<string, any> }>(
    { components: [], dataModel: {} },
  );
  /* THE SETTER STAYS, THE VALUE GOES (2026-10-21): `setCurrentGovernanceSession` is called by the
     room's assembly below, but nothing in this file reads the value back — the governance hook
     holds its own copy. */
  const [, setCurrentGovernanceSession] = useState<Record<string, any> | null>(null);



  /*
   * IS THE THIRD COLUMN DRAWN YET? — no, until there is something to put in it.
   *
   * The owner, 2026-09-30: *"whenever I click on Preview or submit that operates, just like run on
   * the composer. It's the same behavior when I select one of the components in the component tree
   * that operates just like run in the composer. if the Preview window is already open then there's
   * no reason to reopen it right, because it's open."* The Composer's rule is the same rule, and
   * this is its mechanism: which panes exist IS the surface's tree — `workspace-layout` draws a
   * middle column when something is in its middle slot and takes no width when nothing is — and at
   * rest the Composer's root carries no middle child at all ("the shell moves the flow view into it
   * at Run time").
   *
   * So the server DECLARES the container and does not reference it, the tool reports that the
   * Preview is drawing something (`onPreviewChange`), and this flag is where the two meet: while it
   * is false the tree is handed to the renderer exactly as assembled, and the moment the Preview has
   * a component the reference is added and the column is drawn. The seat is read again in the same
   * effect, so the Preview is portaled into the container the instant it exists.
   *
   * ONE WRITER, AND IT ONLY EVER OPENS. Selecting a second component, or the same one again, is not
   * a reason to rebuild the column — so nothing here closes it and nothing re-creates it: the
   * reference is added once, and later selections are just the tool re-rendering inside a column
   * that is already there.
   *
   * THE RIGHT COLUMN IS NOT PART OF THIS, DELIBERATELY. The owner, 2026-09-30: *"I have not decided
   * what I want her navigation to be so none of that navigation wiring needs to be taken apart. It
   * just needs to be ignored. You don't need to remove anything until it's in conflict with
   * something we're adding from the ingestion application."* So the Composer's chat seat stays where
   * it is and this shell does not touch it.
   */
  /* THE FLAG STAYS, THE CALLBACK GOES (2026-10-21). `designPreviewOpen` is READ — `useDesignSurface`
     below receives it — so it is live state. What was dead was `onDesignPreviewChange`, the only
     writer: it was never passed to anything (the ingest that would have reported to it is not
     mounted by this page), so the flag could never become true. It is declared here, read by the
     room's hook, and written by nothing — stated plainly rather than dressed up. */
  const [designPreviewOpen] = useState(false);

  /**
   * THE LIVE TREE, READABLE FROM A LISTENER REGISTERED IN AN EARLIER RENDER.
   *
   * `handleRunRequested` is registered once on the window and closes over the render it was
   * registered in, so state read inside it is the state of that render. The Run's assembly
   * needs the tree as it is AT THE CLICK — which ids the layout has, what the middle column is
   * called, and the rows the editor is holding — and `surfaceDataModelRef` below is the same
   * pattern for the same measured reason (see its note: the save's listener read the console's
   * model while the composer was on screen).
   */
  const workspaceTreeRef = useRef(workspaceTree);
  workspaceTreeRef.current = workspaceTree;

  // Which slot <ai-surface-sandbox> projects. Its rule is
  // `headerTab === 'console' ? 'console' : 'workspace'`, and an unset tab is the
  // console — this has to read the same way, or the values below would describe a
  // slot that is not on screen.
  const isConsoleView = (headerTab || 'console') === 'console';
  // The Design room is not the console and not the composer: it wears its own canvas.
  const isDesignView = (headerTab || '') === 'design';
  // The Development room is a two-column tool room now too (owner, 2026-10-05) — and, like
  // Product, its ground has to sit at room level for the chat column's strip to show it.
  const isDevelopmentView = (headerTab || '') === 'development';
  // THE GOVERNANCE ROOM WEARS THE WAVE AS ITS ROOM-LEVEL GROUND (late 2026-10-07): the
  // wave is this section's exclusive image, and it must cover the WHOLE room — both
  // columns, the chat side and the gripper strip. Without this branch the room fell to
  // the composer default and the composer's image showed in the gripper strip beside the
  // chat rail.
  const isGovernanceView = (headerTab || '') === 'governance';
  // THE PRODUCT ROOM WEARS THE COMPOSER'S GROUND NOW (owner, 2026-10-05): the room gains the
  // console's chat column with its rail closed on entry, and the gripper strip beside the rail
  // is transparent — so the room's own ground is what shows in that strip, and the owner's
  // word is that it is the composer's: dark #582846 plus the composer's image, stretched. The
  // wireframe-lab backdrop retired with it (2026-10-03 → 2026-10-05).
  //
  // AND THE DEVELOPMENT ROOM KEEPS ITS OWN (owner, 2026-10-05): the same container, the same
  // strip — but this room's floor is its lab tile (`developmentLabBackground` over #2b2635),
  // the look its tool was given on 2026-10-04. Same reasoning, one room over: the strip shows
  // the room's ground, and the room is the tile.
  //
  // WHY IT SITS AT ROOM LEVEL RATHER THAN ON THE CHAT PANEL: while the column is closed the
  // container keeps the panel at its OPEN width and slides it out of view, so a ground painted
  // on the panel itself would travel with the panel and stretch across the tool area whenever
  // the column is closed. One fact, one reader: both ground slots below use the values below.
  const workspaceBackground = isDesignView
    ? designSectionBackground
    : isDevelopmentView
      ? developmentLabBackground
      : isGovernanceView
        ? dataWave4Background
        : composerBackground;
  // THE ROOM'S GROUND COLOUR — one fact with two readers (the two ground slots below).
  // Product stands on the composer purple; Development stands on its own dark grey, the
  // colour its tool's wrapper has always painted under the tile.
  const workspaceGroundColor = isDevelopmentView || isGovernanceView ? '#2b2635' : '#582846';
  // AND EVERY OTHER ROOM'S GROUND STRETCHES (100% × 100%, top-left, no repeat). The product
  // room's tiling era ended with its own image; DEVELOPMENT is the exception — a graph-paper
  // tile is drawn to REPEAT at natural size, and it inherits this room's own floor.
  const groundSize = isDevelopmentView ? 'auto' : isGovernanceView ? 'cover' : '100% 100%';
  const groundRepeat = isDevelopmentView ? 'repeat' : 'no-repeat';
  const groundPosition = isGovernanceView ? 'center center' : 'top left';
  const surfaceDataModel = isConsoleView ? consoleTree.dataModel : workspaceTree.dataModel;

  /*
   * THE SECTIONS THAT WEAR THE COMPOSER'S CONTAINER.
   *
   * Console is its own surface and the Composer is assembled — those two are unchanged. Product,
   * Development and Governance are the owner's compartments, and they get the Composer's
   * container ASSEMBLED, with the Composer's own components in its five slots, so the design
   * matches before anything is put in them.
   *
   * The owner, 2026-09-30: *"go ahead and build your containers for each section and match the
   * design"* — and, on how: *"You're gonna have to use the same lit components in the same
   * behavior inside of design… I want to just reuse the lit components for the composer. I will
   * just replace what they hold."* And on the fourth: *"you can do governance — they're all
   * exactly the same, the containers, just column containers, and their behaviour the sliding,
   * the docking to the right, docking to the left, the chat interface is exactly the same for
   * all of those."*
   *
   * DESIGN IS NOT IN THIS LIST, because its slots are already spoken for: the ingest lives in
   * them. *"when I ingest a file it opens up a third column and displays the output just like we
   * do now, the left column left rail… Grace follows along like she does now on ingest.
   * Everything's exactly the same, just wired up into the column."* It wears the SAME container
   * — `IngestModal variant="section"` renders a `<workspace-layout>` and fills `left`, `middle`
   * and `right` with the rail, the output and Grace — so the architecture is reused and the
   * contents are the ingest's rather than the Composer's.
   */
  /*
   * PRODUCT LED THIS LIST (2026-10-03) AND GOVERNANCE FOLLOWED THE SAME DAY — the promise kept:
   * *"the day one of them is designed it leaves this list and nothing else moves."* Both are
   * real rooms now: their own branches, `render-product` / `render-governance`, their own
   * renderers. Development is the one compartment still waiting for its room.
   */
  const SECTION_TABS = ['development'];

  /*
   * DEAD TABS — Development is the LAST stub, and it is dead on purpose.
   * (PRODUCT LEFT THIS SET on 2026-10-03, and GOVERNANCE the same day: both are real rooms now —
   * handler branches, `render-product` / `render-governance`, their own renderers — and a room
   * is not a stub. This is the mistake that proved it twice: a real room left in this list still
   * assembles — the click branch runs first — and then draws NOTHING, because the mount checks
   * this flag. Leaving the list is part of making the room.)
   *
   * The owner, 2026-09-30: *"I want to just disable. We don't have to un-wire it. We just need to
   * make it not display. Just make them dead… product, development and governance should not load
   * anything. Just make them dead tabs, whatever you call them, stubs."*
   *
   * SO NOTHING IS UNWIRED AND NOTHING IS DELETED. The server still answers `render-section:<id>`
   * with a surface, and the three entries stay in the header navigation, because a tab that
   * disappears is a tab a person cannot find again. What changes is only what a click DOES: the
   * indicator moves and no assembly is asked for, so nothing loads, nothing is written, and no
   * composer surface is drawn into a room that has not been designed yet.
   *
   * THE SAME LIST AS SECTION_TABS TODAY, and deliberately a second name rather than a rename: the
   * sections are the tabs that will one day hold their own content and these three are the ones
   * waiting for it, so the day one of them is designed it leaves this list and nothing else moves.
   */
  const DEAD_TABS = SECTION_TABS;
  const isDeadTab = DEAD_TABS.includes(headerTab || '');

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

  /**
   * WHAT THIS RUN WAS ASKED TO DO — the judge's other input.
   *
   * The User Role is the person's ask; the Agent Role is the job the prompt describes. Either
   * can name what "right" means, and a judge handed only the answer is being asked to mark
   * homework with no question in front of it. Joined on one blank line, capped so a long
   * prompt cannot outgrow the judge's context.
   */
  const askOf = useCallback((sections: any[]): string => {
    const pick = (type: string): string => {
      const row = sections.find((s) => s?.type === type);
      return typeof row?.content === 'string' ? row.content.trim() : '';
    };
    const ask = [pick('user'), pick('agent')].filter(Boolean).join('\n\n');
    return ask.slice(0, 6000);
  }, []);

  /**
   * THE TOOLS A PROMPT NAMES THAT NOTHING CAN RUN.
   *
   * Two kinds of tool live in the register (backend/tools.py): `read`, which is words the
   * system follows and needs nothing behind it, and `call`, which asks another program for
   * something. A `call` tool is only real if a service answers it, and that is what the row's
   * `runner` says (backend/tool_run.py). No runner: the prompt names a step that cannot
   * happen, and the owner's rule is flat — "we cannot allow a prompt that's not operational to
   * be run."
   *
   * THE REGISTER IS THE AUTHORITY, AND IT IS READ, NOT GUESSED. A tool becomes real by being
   * given a runner in one row; this stops naming it with no second list to keep in step, and a
   * tool that loses its service starts being named again the same way.
   *
   * It answers with NAMES, and an empty answer means "none found" — never "none exist". A
   * register that cannot be read does not block a run: the review happens either way, and the
   * tool list normally reaches her with the workspace context besides.
   */
  const readToolRegister = useCallback(async (): Promise<any[]> => {
    try {
      const resp = await fetch(`${API_BASE}/ai/tools`);
      if (!resp.ok) return [];
      const data = await resp.json().catch(() => null);
      return Array.isArray(data) ? data : Array.isArray(data?.tools) ? data.tools : [];
    } catch {
      return [];
    }
  }, []);

  /**
   * THE REACH-OUT TOOLS THIS PROMPT NAMES THAT NOTHING ANSWERS — and the register is handed IN
   * when the caller has already read it, so a review reads the table once.
   */
  const toolsThatCannotRun = useCallback(async (held: any[], register?: any[]): Promise<string[]> => {
    try {
      const list: any[] = register ?? (await readToolRegister());
      const reachOut = list
        .filter((t) => t?.kind === 'call' && !t?.runner && t?.name)
        .map((t) => String(t.name));
      if (!reachOut.length) return [];
      // The whole of what a prompt says, lowercased once: a tool is named either as the menu's
      // own token ({{tool:search-the-internet}}) or in a sentence, and both are the same fact.
      const text = held.map((s: any) => String(s?.content ?? '')).join('\n').toLowerCase();
      return reachOut.filter((name) => text.includes(name.toLowerCase()));
    } catch {
      return [];
    }
  }, [readToolRegister]);

  /**
   * ONE ROW, APPLIED TO THE MODEL — replaced where it already sits, and ADDED where it does not.
   *
   * There was no add path at all, and that is why a row the assistant made did not survive: the
   * element CAN grow its own list (`_seatFor`, the seat menu's Add Section, an add-role), it
   * reports the new row, and every writer here dropped anything whose index was past the end of
   * the model — `if (index < held.length)` — so the model never learned about it and the next
   * model-driven render handed the element its old list back. Measured 2026-09-23: she added a
   * constraint, and it was gone.
   *
   * `index: null` is a row with no position yet — `<prompt-section-editor>` reports those with
   * `section-add`, which carries the row and no index.
   *
   * APPLIED INSIDE THE UPDATER, never from a read of the model outside it, because both reports
   * for one new row (`section-add` and then the `section-update` that follows it) arrive in the
   * same tick and `surfaceSections()` would hand both of them the same stale list — the second
   * would compute an array without the first one's row. The shape test is what makes the second
   * report a no-op instead of a duplicate, and `same` is what keeps any of it from looping.
   */
  const patchSectionAt = useCallback((index: number | null, section: any) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const left = session.left_column ?? {};
      const have = Array.isArray(left.sections) ? left.sections : [];
      const shape = (s: any) => `${s?.type ?? ''}\u0000${s?.name ?? ''}\u0000${s?.content ?? ''}`;
      const sections = index !== null && index < have.length
        ? have.map((s: any, i: number) => (i === index ? { ...s, ...section } : s))
        : have.some((s: any) => shape(s) === shape(section))
          ? have
          : [...have, section];
      const same = have.length === sections.length
        && have.every((s: any, i: number) => shape(s) === shape(sections[i]));
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
      /*
       * TYPE AND NAME ARE COMPARED, NOT ONLY CONTENT.
       *
       * This guard asked whether the text had changed, and a seat's TYPE is not its
       * text: changing User Role to Constraints leaves the content string exactly as
       * it was, so `same` came out true, the write was dropped, and the model never
       * learned about the new seat. Nothing failed — the element showed the new seat
       * immediately and the next model-driven render handed the OLD one back.
       * Measured: a seat changed to `constraints` reverted to `agent-role` 22 seconds
       * later, and the button that had been offered for it then had no seat to write
       * into.
       *
       * A guard that decides whether to write has to compare everything the write
       * carries. This one compared one of the three fields.
       */
      const shape = (s: any) => `${s?.type ?? ''}\u0000${s?.name ?? ''}\u0000${s?.content ?? ''}`;
      const same = have.length === sections.length
        && have.every((s: any, i: number) => shape(s) === shape(sections[i]));
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
  // THE REPAIR IS THE FLAG'S LIFETIME, NOT A SECOND WRITER — and it took two attempts to see that.
  // The first attempt wrote `isRunning` DIRECTLY onto the elements (deepFind, past the shadow
  // roots) for the duration of the assembly. That works until the model moves: the renderer
  // re-assigns every prop on every data-model change, so the write was undone by the next publish —
  // and the two writers disagreed exactly where the owner could see it. Measured 2026-09-23, what
  // he reported: "it's spinning for just a few minutes and then turning off and so everything's
  // sitting there, it looks broken, and then all of a sudden the console opens."
  //
  // The flag is ONE fact — is a Run's opening still in flight — and it is written in ONE place
  // (`writeBusyToSurface`, from `isComposerRunning`, which the tree binds). What was wrong was WHEN
  // it went false: the run's own answer landing cleared it, while the column was still being
  // composed. It is cleared where the opening actually ends now: the drawing's ready signal, a
  // failed assembly, or a Run she blocked.

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
  /* DESIGN'S OWN RENDERER — a separate instance, never the Composer's with a swapped tree. */
  const designRendererRef = useRef<any>(null);

  /* AND GOVERNANCE'S (2026-10-03) — the last room. */
  const governanceRendererRef = useRef<any>(null);

  /* AND THE DEVELOPMENT ROOM'S (owner, 2026-10-05) — the same pair for the same job: the
     canvas tool's container (settled closed on entry the same way) and the room's seat. */
  const developmentLayoutRef = useRef<WorkspaceLayout | null>(null);
  const developmentSeatRef = useRef<ChatPanel | null>(null);
  const governanceLayoutRef = useRef<WorkspaceLayout | null>(null);
  const governanceSeatRef = useRef<ChatPanel | null>(null);
  /* THE EVALS TAB'S OWN SEAT (owner's architecture, 2026-10-17: *"one tab = one file … the tab
     IS the file"*). It stands in the room's right pane beside the shared seat and is shown only
     while the Evals tab is selected; the shared seat is hidden, never unmounted — so its
     conversation and scroll survive the round trip, and the Evals file can never reach another
     tab's surface. */
  const governanceEvalsSeatRef = useRef<EvalsChatPanel | null>(null);
  const [governanceEvalsSeat, setGovernanceEvalsSeat] = useState(false);
  /** The embedded app's element — the rail wrote its destinations onto this. NOTHING
      mounts into it since 2026-10-08 (the application left the room, owner's order);
      kept for the rail's dormant go-channel, per the architecture rule. */
  const governanceEmbedRef = useRef<BuilderEmbed | null>(null);
  /** The room's three trace views, appended into this seat's own slots (the mount block
      in the governance seat effect). Rebuilt per room entry; views never fetch — the
      shell writes every value from lib/governance-trace-source.ts. */
  const governanceTraceElsRef = useRef<{
    header: HTMLElement;
    tree: HTMLElement;
    detail: HTMLElement;
  } | null>(null);
  /** The seat's trace state BETWEEN room entries: the last bundle read, the node asked
      for, and the node + elements that were actually written — the read effect's skip
      conditions (`els` + `appliedObsId`) live here, not in render state, because none
      of this should re-render the shell on its account. */
  const governanceTraceSelRef = useRef<{
    bundle: GovTraceBundle | null;
    traceId: string | null;
    obsId: string | null;
    appliedObsId: string | null;
    /** The app's own peek id for the standing trace (see the sig's note). */
    peekId: string | null;
    /** The panel's extras (scores + comment counts), the last read — restored on re-entry. */
    scores: GovTraceScore[] | null;
    commentCounts: Record<string, number> | null;
    els: { header: HTMLElement; tree: HTMLElement; detail: HTMLElement } | null;
  }>({ bundle: null, traceId: null, obsId: null, appliedObsId: null, peekId: null, scores: null, commentCounts: null, els: null });
  /** The package resolved for the selected trace (empty = none) — written to the seat,
      read by the Open in Composer click. */
  const governanceComposerPackageRef = useRef('');
  /** THE LATEST composer-open handler, so the seat's listener never holds a stale one. */
  const openComposerRef = useRef<((sessionId: string) => void) | null>(null);
  /*
   * THE COLUMN THE RUN ASSEMBLED, KEPT FOR THE STATE (owner, 2026-10-05). The model composes
   * the third column on every Run; the components it returns are what the drawing IS, and
   * before this nothing kept them — so a package that had run reopened as a package that had
   * not (its saved state said `leftCollapsed: false` and nothing else, measured on the
   * Insurance card). The Run writes them here as soon as they arrive; the open puts a saved
   * column back; the state reads (readWorkspaceState) carry them into `metadata.workspace`
   * so opening a run card is a READ of the run, never a second model call.
   */
  const assembledRunColumnRef = useRef<unknown[] | null>(null);

  // Preload the composer background at mount so a transition never paints a
  // half-decoded image in sections. The browser fetches and decodes it eagerly
  // here, into cache, before the first composer swap. decode() is the part
  // that matters: setting .src only queues the fetch — a busy/oversized image (the
  // composer background ships as a photographic JPEG) can still be mid-decode when
  // the swap paints, which reads as "the background is still loading". Awaiting
  // decode() finishes that work up front so the paint is instant.
  //
  // The console needs none of this: its ground is the waves VIDEO, and
  // <ai-surface-sandbox> mounts it (preload="auto") the moment it has the src — so it
  // is buffered and already playing long before the console is ever shown. That is
  // also why the video is a single element the sandbox owns rather than one per slot.
  /*
   * THE COMPOSER'S GROUND IS ALREADY BEING FETCHED — see main.tsx, THE TWO GROUNDS. This
   * effect used to do it, and it was too late by the width of a React mount and a paint:
   * the same image, started after the app was on screen, is the difference between a card
   * opening onto its own background and a card opening onto the fallback colour first.
   * One fetcher, at the earliest place that can start one.
   */

  useEffect(() => {
    const el = consoleRendererRef.current;
    if (!el) return;
    el.components = consoleTree.components;
    el.dataModel = consoleTree.dataModel;
  }, [consoleTree]);

  useEffect(() => {
    // THE COMPOSER'S RENDERER, AND ONLY THE COMPOSER'S TREE.
    const el = composerRendererRef.current;
    if (!el) return;
    el.components = workspaceTree.components;
    el.dataModel = workspaceTree.dataModel;
  }, [workspaceTree]);

  /*
   * DESIGN'S OWN RENDERER — a separate instance, not the Composer's with a different tree.
   *
   * The owner, 2026-09-30: *"build a rendering process that is similar and operates like composer,
   * but it has to be specific to design and it has to load the exact same lit components but
   * empty… you need to load a separate version of Grace just like we load a separate version of
   * Grace for the console, and Grace gets a separate version for composer. She gets her own seat
   * for design, but she is assembled in a different render."*
   *
   * SO THIS IS A SECOND ELEMENT, with its own ref, drawing its own tree through the same
   * catalogue and the same resolver. Swapping ONE renderer's tree underneath it — what this was
   * before — is not a boundary: the two rooms would share the drawing, so one room's assembly
   * would write over the other's surface, and neither could hold a surface while the other held
   * one.
   *
   * WHAT IS SHARED is the catalogue, the resolver and the components — the reasons the two rooms
   * look alike. What is not shared is the INSTANCE, because the instance is the state.
   *
   * AND SO DESIGN GETS ITS OWN GRACE. Each render builds its own elements, so the `chat-panel` in
   * this tree is an instance of its own, bound to Design's own conversation id — exactly as the
   * console has its own and the Composer has its own. Grace the component is unchanged; she is
   * assembled here, in this render, with her own seat.
   */
  /* MOVED (2026-10-21): the 167-line block now lives in `@/rooms/design/useDesignSurface`.
     Same statement, same deps, passed by name. */
  useDesignSurface({ designPreviewOpen, designRendererRef, designTree });
  /*
   * THE BAR'S ID AND VERSION ARE SET, NOT BOUND — see the effect below the session state,
   * where both `currentPromptSession` and its ref exist to be read.
   */

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
  //
  // THE FLOW IS THE COMPOSER PACKAGE. The capture door buckets a counter by
  // (element, metric, day, dimensions, flow), so an element's performance is
  // attributable to the business process it served. `currentPromptSessionRef`
  // is the active package id; it is read AT EVENT TIME because this effect's
  // dependency list is empty on purpose (one listener for the page's life).
  // The A2UI surface label cannot serve this — every view is mounted on `main`.
  useEffect(() => {
    const handleA2uiEvent = (event: Event) => {
      const { sourceId, component, type, payload } = ((event as CustomEvent).detail || {}) as {
        sourceId?: string; component?: string; type?: string; payload?: Record<string, unknown>;
      };
      const flow = currentPromptSessionRef.current ?? undefined;
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

  // The catalog check's findings, as Grace assembled them into the data model.
  // null = the surface is not a catalog surface.
  const [catalogFindings, setCatalogFindings] = useState<any[] | null>(null);


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
  /**
   * THE WIDTHS THIS PACKAGE WAS SAVED WITH, kept where the open effect can read them without
   * depending on the session object. Written by the same effect that reads
   * `currentPromptSession.columnWidths` at the top of a package's life.
   */
  const storedWidthsRef = useRef<{ left?: number | null; chat?: number | null } | null>(null);

  /**
   * HER REVIEW IS CLEARED BY HER, NOT BY THE CLOCK. Set when she emits `<run_ok/>` and
   * read by the Run gate, which lets exactly one run through per approval — the released
   * run arrives as the same `run-requested` it was just held from.
   */
  const runApprovedRef = useRef(false);

  /**
   * WHAT WAS HELD IS WHAT RUNS. A held Run keeps the sections it arrived with, so the run
   * that her approval releases is the one she reviewed — not a fresh read of the column,
   * which by then may have been edited, swapped out, or emptied by whatever she said.
   */
  const heldRunRef = useRef<{ sections?: any[] } | null>(null);

  /**
   * THE BAR'S ID AND VERSION ARE SET HERE, NOT BOUND — and this effect sits below the
   * session state because it reads it. An effect declared above a `const` evaluates it
   * before it exists; this file has the note twice already.
   *
   * THE TITLE IS BOUND; THESE ARE STATED, and the difference is who owns them. The title
   * belongs to the SURFACE — that is what lets Grace name a package, and the reason the
   * bar moved out of React at all. The id and the version are facts the SHELL holds about
   * which package is open: nothing in the prompt can write them and nothing should.
   *
   * Binding them left them to the model's goodwill, and it is not reliable. Measured twice
   * on the SAME package, minutes apart: the first assembly emitted the bindings and the
   * bar read "ID: 2fd1c…", the next omitted them and the bar read nothing. A value that
   * appears when the model remembers to emit it is not a value — so the shell states it,
   * the way it already states the middle column's contents on Run.
   */
  useEffect(() => {
    const header = deepFind<HTMLElement & { promptId?: string; version?: number }>('left-column-header');
    if (!header) return;
    header.promptId = currentPromptSession?.id || '';
    header.version = currentPromptSession?.currentVersion || 0;
  }, [workspaceTree, currentPromptSession?.id, currentPromptSession?.currentVersion]);

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
   * THE ROWS A DECISION IS MADE FROM — ONE READER, because there were two and they disagreed.
   *
   * `handleRunRequested` reviewed whatever the Run button's event happened to carry and
   * `onFixAll` reviewed `surfaceSections()`: two readers of one fact, agreeing only by the luck
   * of who called them and whether React had committed. The standing rule is one fact, one
   * reader — the copy that drifts is always the one nobody re-derives, and this copy decides
   * both whether a Run is held and what that Run will send.
   *
   * THE ORDER IS THE APP'S OWN, not a preference. In turn:
   *
   *   1. THE EDITOR — the rows as they stand in the column. It is the only copy already true
   *      when a write has just been DISPATCHED and React has not committed yet; reading the
   *      surface at that moment answers with the prompt as it was BEFORE the write. It is also
   *      the list the person is looking at, which is the list a review is supposed to be about.
   *   2. THE SURFACE — what the renderer BOUND into the column (see surfaceSections above for
   *      why the DOM query could not be used for this).
   *   3. THE REPAIR PROMPT the column was holding.
   *   4. THE PACKAGE'S OWN LEFT COLUMN — what the column was built from.
   *
   * 2 to 4 exist for one window, and it is the swap: a Run arriving while the column is being
   * replaced reads back an empty editor, and the honest next question is what the column held a
   * moment ago rather than whether to run nothing at all.
   */
  const rowsForDecision = useCallback((): any[] => {
    const editor = deepFind<HTMLElement & { sections?: unknown[] }>('prompt-section-editor');
    if (Array.isArray(editor?.sections) && editor.sections.length) return editor.sections as any[];
    const fromSurface = surfaceSections();
    if (fromSurface.length) return fromSurface;
    const fromRepair = repairSectionsRef.current || [];
    if (fromRepair.length) return fromRepair;
    try {
      const raw = currentPromptSessionObjRef.current?.leftColumnContent;
      return raw ? (JSON.parse(raw).sections || []) : [];
    } catch {
      return [];
    }
  }, [surfaceSections]);

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
  /**
   * WHERE THE PERSON PUT THE NODES, as the package they opened saved them.
   *
   * POSITION IS THE ONE FACT THE DRAWING OWNS (READ-ME/CANVAS-AND-PROMPT.md §2) and its home is
   * the graph the package carries — `workspace.graph.nodes[].x/y`, written by the save from the
   * element's own `drawn` (see the place read in handleSave). This is the READ half: held from
   * the moment the package opens, and handed to the builder at every rebuild, so a Run after a
   * reopen draws the layout the person left instead of the default ring on top of it.
   *
   * A REF, NOT STATE, for the same reason the run's own inputs are: the rebuild happens inside
   * await callbacks that must see the current value without being re-created for it.
   */
  const carriedPositionsRef = useRef<FlowPosition[]>([]);
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
   * THE JUDGED RUNS, WRITTEN WHERE THE EVALS VIEW READS THEM — the same one-way write as the
   * flow above: the shell owns the fact (the backend's /evaluations rows) and publishes it to
   * /session/middle_column/evaluations, which the assembly binds to the EvalFeed. Unset stays
   * unset until the first write; an empty list is the claim "ran and nothing judged yet".
   */
  const writeEvaluationsToSurface = useCallback((list: unknown) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      const middle = session.middle_column ?? {};
      if (middle.evaluations === list) return prev;
      return {
        ...prev,
        dataModel: {
          ...prev.dataModel,
          session: { ...session, middle_column: { ...middle, evaluations: list } },
        },
      };
    });
  }, []);

  /** Fetch this package's judged runs and publish them. The element never fetches. */
  const refreshEvaluations = useCallback(async () => {
    const sessionId = currentPromptSessionObjRef.current?.id ?? currentPromptSessionRef.current;
    if (!sessionId) return;
    const res = await fetch(`${API_BASE}/prompt-sessions/${sessionId}/evaluations`);
    if (!res.ok) {
      logger.error('the evaluations list could not be fetched', { sessionId, status: res.status });
      return; // the list stays whatever it was; the view's empty state says the rest
    }
    const data = await res.json();
    writeEvaluationsToSurface(Array.isArray(data.evaluations) ? data.evaluations : []);
  }, [writeEvaluationsToSurface]);

  /**
   * THE THIRD COLUMN IS ASSEMBLED, NOT INSERTED — the RUN's one model call.
   *
   * WHAT THIS REPLACES, measured 2026-09-23 (READ-ME/CONTINUE-HERE.md §00c): this file wrote
   * the components itself. `setOutputColumn('flow')` built `RoomEmbed` with its three slots
   * and pushed `AgentFlow`, `OutputControls` and `CanvasFooter` straight into the live
   * component list, in TypeScript, on every Run — so the one surface a person watches most
   * closely was the one the protocol did not build, while the console's own cards, the same
   * class of thing, arrived from the model against the catalog. The owner's charge: "if those
   * nodes are not being called from the A2UI library by a model, then you've not only violated
   * the protocol, you've created this jarring effect."
   *
   * AN UPDATE, NOT A REPLACEMENT, and the ids are what make it one. `render-session` assembles
   * a whole surface because opening a package IS the whole surface; a Run moves ONE COLUMN of a
   * surface that is already on screen and already carries facts this file owns — the rows as
   * the editor holds them, the conversation in her column, the places the person dragged nodes
   * to. So the request states the ids the assembly must land on (the layout's root, its other
   * slots, and the component standing in the middle today), the model returns the components
   * for that column, and they are applied BY ID with `applyComponentUpdate` — the spec's own
   * updateComponents semantics. The server checks the other slots came back untouched and
   * refuses with a reason if they did not, because an assembly that rewrote them would take
   * the prompt or Grace off the screen mid-Run.
   *
   * THE ROWS ARE NOT SENT AND CANNOT BE. They are the person's, the editor is their writer,
   * and a model that echoed them back into the model would be a second author of the same fact.
   * The drawing is bound to `/session/middle_column/flow` — a path this file writes from the
   * rows it already holds (see publishRepairFlow).
   */
  const assembleThirdColumn = useCallback(async (): Promise<{
    components: unknown[];
    dataModel: Record<string, any>;
  }> => {
    const tree = workspaceTreeRef.current;
    const components = Array.isArray(tree.components) ? tree.components : [];
    const root = components.find((c: any) => c?.component === 'workspace-layout') ?? null;
    const slots: Record<string, unknown> = { ...((root?.children as Record<string, unknown>) ?? {}) };
    /*
     * THE MIDDLE IS FOUND BY ROLE, NEVER BY ID — the same rule showOutputColumn states and for
     * the same measured reason: every assembly names its own components (the composer's middle
     * is `middle-column`, a loaded session's is `middle-col`), so a run that looked for one
     * name would land on nothing in the other and draw no canvas at all.
     *
     * A package that has never run has the component already — the composer emits the output
     * viewer and simply does not point the layout at it, because until a Run the middle column
     * is not drawn. When it is absent entirely the model is told so and gives the column an id
     * of its own; the update adds it and the layout's pointer is the model's.
     */
    const middleId = (slots.middle as string | undefined)
      ?? components.find((c: any) => c?.component === 'compiled-output-viewer' || c?.component === 'RoomEmbed')?.id
      ?? '';
    delete slots.middle; // it is the column being assembled; the model returns it filled

    const session = tree.dataModel?.session ?? {};
    const rows = Array.isArray(session.left_column?.sections) ? session.left_column.sections : [];
    const run = {
      layoutId: root?.id ?? 'root',
      middleId,
      slots,
      package: {
        id: currentPromptSessionObjRef.current?.id ?? null,
        title: session.title || currentPromptSessionObjRef.current?.title || 'Untitled Prompt',
        rows: rows.length,
        seats: rows.map((r: any) => declaredName(r)).filter(Boolean),
      },
    };

    const response = await fetch(`${API_BASE}/ai/assemble-surface?limit=500`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
      body: JSON.stringify({ intent: 'render-run', context: { session_id: session.id ?? null, run } }),
    });
    if (!response.ok) {
      // The server's own reason, verbatim — it names what it refused and why. Never a bare
      // status: the two failures this path can have (the model drifted, the provider died)
      // are told apart by that sentence and by nothing else.
      const raw = await response.text();
      throw new Error(raw.trim() || `${response.status} ${response.statusText}`);
    }

    const reading = readA2UIEnvelope(await response.json(), tree.dataModel);
    // `=== false`, not `!ok`: this project compiles with strictNullChecks off, where truthiness
    // does not narrow a union — only equality against the literal does (see the other call site).
    if (reading.ok === false) throw envelopeRefusalError(reading.refusal);
    for (const note of reading.reading.notes) console.warn(`🤖 [A2UI] run: ${note}`);
    console.log(
      `🤖 [A2UI] Run — the model assembled the third column:`,
      reading.reading.components.map((c: any) => `${c?.id} <${c?.component}>`).join(', '),
    );
    return { components: reading.reading.components, dataModel: reading.reading.dataModel };
  }, []);

  /**
   * AND IT IS PUT ON SCREEN BY AN UPDATE, NOT BY AN AUTHOR.
   *
   * `applyComponentUpdate` is the spec's own updateComponents semantics: components whose ids
   * are already in the surface are updated, new ids are added, and every component the update
   * does not mention — the prompt column, her seat, the trace view — is left exactly as it is.
   * Nothing here names a component, a slot or a binding: the model's update carries all three,
   * including the layout root that points its middle slot at the canvas.
   *
   * SEPARATE FROM THE FETCH ON PURPOSE. The model call can start the instant the Run does, but
   * the picture may not be put on screen until the panes it will live between have finished
   * moving — see the sequence in handleRunRequested. That ordering is the whole cure for the
   * jump: a canvas that mounts mid-fold takes its width while the pane beside it is still
   * moving, and is seen sliding in.
   */
  const applyThirdColumn = useCallback((update: { components: unknown[]; dataModel: Record<string, any> }) => {
    setWorkspaceTree((prev) => ({
      components: applyComponentUpdate(prev.components, update.components),
      dataModel: update.dataModel,
    }));
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
      carried: carriedPositionsRef.current,
    }));
  }, [writeFlowToSurface]);

  /**
   * THE DRAWING IS A FUNCTION OF THE ROWS — so a row that changed rebuilds it.
   *
   * THIS IS THE OTHER DIRECTION, and the one that makes the two views one thing rather than
   * two that have to be kept in step. A row written in the prompt (a keystroke, a chat
   * button, a section the seat menu made) is a node on the canvas the next time the drawing
   * is built; a node added on the canvas is a row (see onFlowNodeAdded, which writes through
   * this same path). Neither view holds a fact the other does not.
   *
   * A REBUILD, NOT AN EDIT, and from the ROWS AS THEY STAND rather than from the run's own
   * snapshot: the snapshot is what the run sent, and this is what the prompt is now. Where a
   * person has moved a node, position is the one fact the drawing owns and it is carried on
   * the node itself (workspace.graph.nodes[].x/y), never re-derived here.
   *
   * NOTHING ON SCREEN MEANS NOTHING TO REBUILD. Without a run's input there is no drawing in
   * the middle column, so a row added while the output is showing publishes no graph and says
   * nothing — a graph built here would swap the compiled output for a picture nobody asked for.
   */
  const publishFlowFromRows = useCallback((added?: unknown, rowsNow?: FlowSeatInput[]) => {
    const input = flowInputRef.current;
    if (!input) return;
    /*
     * THE ROWS CAN BE HANDED IN, AND SOMETIMES THEY MUST BE.
     *
     * `surfaceSections()` reads the model through a ref, and React commits a state update after
     * the line that made it — so a caller that has just WRITTEN a row and asks this to rebuild
     * immediately gets the rows as they were before its own write. Measured live 2026-09-24: a
     * trigger chosen on the canvas landed in the row (badge "On a schedule", rail marked) and the
     * NODE went on showing the plain prose, because the graph had been rebuilt from the rows that
     * predated it.
     *
     * A writer already knows what it wrote. `rowsNow` is that, passed in, so the drawing follows
     * the write rather than racing it — and the ref stays the reader for every caller that has
     * nothing to hand over.
     */
    const rows = rowsNow ?? (surfaceSections() as FlowSeatInput[]);
    // The row that was just made may not be in the model's copy yet: `section-add` fires
    // before React has committed it. Same-name-and-type is the identity a row has here.
    const identity = (s: { type?: unknown; name?: unknown } | null | undefined): string =>
      `${s?.type ?? ''}\u0000${s?.name ?? ''}`;
    const sections = added && !rows.some((s) => identity(s) === identity(added as { type?: unknown; name?: unknown }))
      ? [...rows, added as FlowSeatInput]
      : rows;
    writeFlowToSurface(buildRepairFlow({
      label: input.label,
      finding: input.finding,
      sections,
      run: flowFactsRef.current,
      carried: carriedPositionsRef.current,
    }));
  }, [surfaceSections, writeFlowToSurface]);

  /**
   * HOW MUCH OF THE DRAWING HER COLUMN COVERS — measured, never assumed.
   *
   * ON A RUN HER COLUMN IS A LAYER OVER THE DRAWING (workspace-layout: `.pane.right.over` is
   * absolutely positioned), so the drawing's box is wider than the pane a person can see, and
   * the drawing cannot see her: she is not its child and its own box never moves when she
   * narrows. So the number is measured HERE, where both boxes are in reach, and written onto
   * the element that composes the view (agent-flow's `viewportInset`). It is a measurement,
   * not a guess at the columns' widths: the two rects are read as they are on screen.
   *
   * WHY IT EXISTS: with the drawing composed into its full box, the brain of a 1535px drawing
   * landed at x≈789 with her column at 768 — the hub sat on the seam, half of it under the
   * chat, and the nodes a person wanted to drag could not be grabbed (owner, 2026-09-23: "I
   * can no longer slide the nodes around … system role seems fixed").
   *
   * The observer follows the element on screen rather than the one that was there when the
   * canvas arrived: an assembly replaces her panel, so a stale observer would stop reporting.
   */
  const canvasInsetRef = useRef<{ ro: ResizeObserver | null; chat: Element | null }>({ ro: null, chat: null });

  const syncCanvasInset = useCallback((): void => {
    const flow = deepFind<HTMLElement & { viewportInset?: number }>('agent-flow');
    const chat = deepFind<HTMLElement>('chat-panel');
    const held = canvasInsetRef.current;
    if (chat && chat !== held.chat) {
      held.ro?.disconnect();
      held.ro = typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => syncCanvasInset())
        : null;
      held.ro?.observe(chat);
      held.chat = chat;
    }
    if (!flow) return;
    const f = flow.getBoundingClientRect();
    if (f.width < 2) return;
    const c = chat?.getBoundingClientRect() ?? null;
    // She covers it only where the two boxes actually overlap: beside the drawing she takes
    // width out of the flex line and covers nothing, and on the console she is not over it.
    const covered = c && c.left > f.left + 1 && c.left < f.right
      ? Math.max(0, Math.round(f.right - c.left))
      : 0;
    if (flow.viewportInset !== covered) flow.viewportInset = covered;
  }, []);

  // Her column resizes on the Run (the layer's share), on a window resize, and whenever a hand
  // takes the gripper — all of them measured through the same reader.
  useEffect(() => {
    syncCanvasInset();
    window.addEventListener('resize', syncCanvasInset);
    return () => {
      window.removeEventListener('resize', syncCanvasInset);
      canvasInsetRef.current.ro?.disconnect();
      canvasInsetRef.current = { ro: null, chat: null };
    };
  }, [syncCanvasInset]);

  /**
   * THE COLUMN'S OWN WAIT — the spinner it shows while the drawing is held back.
   *
   * The fact belongs to the Run's sequence (this file decides when the drawing is published),
   * so this file is what tells the column — the same shape as `syncCanvasInset` above: a
   * property written onto the element that has it, not a value re-derived from the model.
   *
   * IT WAITS FOR THE ELEMENT, AND GIVES UP QUIETLY. `applyThirdColumn` writes React state, so
   * the canvas is not in the DOM on the next line — it is committed a frame later, and on the
   * frame after that the renderer has built it. An element that never appears is a column that
   * was not put there (a failed assembly keeps the output), which is not an error here.
   */
  const setCanvasHolding = useCallback((holding: boolean): void => {
    let frames = 0;
    const write = (): void => {
      const canvas = deepFind<HTMLElement & { holding?: boolean }>('room-embed');
      if (canvas) {
        // Lit's own property, so the attribute and the style follow it. Written every time,
        // including the `false` that ends the hold: the element may have been built while the
        // run was in flight, and its constructor default is `holding`.
        if (canvas.holding !== holding) canvas.holding = holding;
        return;
      }
      if (++frames < 40) requestAnimationFrame(write);
    };
    requestAnimationFrame(write);
  }, []);

  /**
   * THE CANVAS IS TOLD THE RUN IS IN FLIGHT — the same writer pattern as `holding` above, and for
   * the same reason: the drawing may be built while the run already is (a mount mid-run takes the
   * constructor's `false`), so the write is retried for a few frames and re-asserted every time the
   * fact changes.
   *
   * WHY THE DRAWING LOCKS. A run rebuilds it at four awaits, so an edit made between two of them
   * would be erased by the next rebuild — the drawing would take the gesture and then quietly undo
   * it. While the model execution loop is active the drawing is a PICTURE: no tile drags, no ports,
   * no toolbar, no line handles, no picker — and the VIEW is still the person's (pan, zoom, fit, the
   * tool switch), so they can move it out of her column's way and watch. The owner, 2026-10-02:
   * "it stays completely pannable, but structurally locked."
   *
   * ONE FACT, TWO READERS: this is `isComposerRunning`'s own fact, written where the run starts
   * (6930) and where it ends (the run's `finally`), and the element reads it as one flag.
   */
  const setCanvasRunning = useCallback((running: boolean): void => {
    let frames = 0;
    const write = (): void => {
      const flow = deepFind<HTMLElement & { running?: boolean }>('agent-flow');
      if (flow) {
        if (flow.running !== running) flow.running = running;
        return;
      }
      if (++frames < 40) requestAnimationFrame(write);
    };
    requestAnimationFrame(write);
  }, []);

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
  /**
   * THE MIDDLE COLUMN GOES BACK TO THE OUTPUT — the canvas footer's own control.
   *
   * THIS IS THE OTHER DIRECTION AND IT IS NOT AN ASSEMBLY. What it restores is a component the
   * surface already emitted: the composer's tree hands the middle column a
   * `compiled-output-viewer` bound to `/session/middle_column/compiled_output` at open time, and
   * a Run is what replaces it with the canvas. Going back is putting that column's original
   * component in place again and taking the canvas's own subtree out with it — the drawing, the
   * column's controls and its foot are the canvas's children, and they leave when it does.
   *
   * THE RUN'S DIRECTION IS THE OPPOSITE OF THIS ONE and lives somewhere else: a Run does NOT
   * write components, it ASSEMBLES them (`assembleThirdColumn` → the model, against the
   * catalog). That asymmetry is deliberate and is the owner's charge — "if those nodes are not
   * being called from the A2UI library by a model, then you've not only violated the protocol,
   * you've created this jarring effect." This function exists because going BACK is a control on
   * the column that says so, and there is no assembly in it to make.
   *
   * The compiled output is NOT lost by the swap: this binds the viewer's content to the path it
   * was documented to read (/session/middle_column/compiled_output) — today's composer assembly
   * hands it an empty literal instead, which is why this binds it on the way back rather than
   * trusting the assembly to.
   */
  /**
   * WHAT THE COLUMN'S HEADER OFFERS, AND WHAT IT IS SHOWING.
   *
   * A LIVE PROPERTY WRITE, like `holding` on the canvas and `running` on the drawing — NOT a stamp
   * in the tree. Measured 2026-10-02: a tree-stamped prop goes STALE, because the renderer re-hands
   * props to the elements it already drew only when the DATA MODEL changes and the components do
   * not (`a2ui-renderer.updated` — a components change rebuilds the tree, and a surviving element
   * keeps what it was constructed with). The body swapped and the tile still read "Agent Flow".
   *
   * So the host writes the two facts where they land: the header draws itself from them, and the
   * host is the only thing that knows them (whether a drawing exists; whether a draft is open).
   */
  const setColumnView = useCallback((view: string, views: string[], onlyIfUnset = false): void => {
    let frames = 0;
    const write = (): void => {
      const header = deepFind<HTMLElement & { view?: string; views?: string[] }>('output-controls');
      if (header) {
        // `onlyIfUnset` is for the DEFAULT writer alone (a model-composed column that no switch has
        // told yet): if a more specific path — a Run, a switch — has written in the meantime, this
        // one stands down. Measured 2026-10-02: both writers were scheduled in one tick, the
        // default landed last, and a column showing the DRAWING read "Output".
        if (onlyIfUnset && (header.view || (Array.isArray(header.views) && header.views.length))) return;
        if (header.view !== view) header.view = view;
        const same = Array.isArray(header.views) && header.views.length === views.length
          && header.views.every((v, i) => v === views[i]);
        if (!same) header.views = [...views];
        return;
      }
      if (++frames < 40) requestAnimationFrame(write);
    };
    requestAnimationFrame(write);
  }, []);

  /**
   * THE DRAFT IS TOLD WHICH DESIGN SYSTEM IT DRAWS FROM — a live property write, like the header's
   * view (see setColumnView; the renderer does not re-hand props on a components change). '' is the
   * honest default: the package never chose one, so the draft resolves against the app's own tables.
   */
  const writeDraftSystem = useCallback((system: string): void => {
    let frames = 0;
    const write = (): void => {
      // THE VISIBLE ONE — measured 2026-10-03, late, on the owner's small window: with more than
      // one room's tree mounted, `deepFind` returns the FIRST canvas in the document, and the
      // write landed on the OTHER room's (hidden) canvas — the product stage stood there with an
      // empty system while the composer's hidden draft got "carbon". THE CANVAS A PERSON IS
      // LOOKING AT is the one the room is telling; a hidden tree's canvas draws nothing, so its
      // box is the honest discriminator.
      const candidates: Array<HTMLElement & { system?: string }> = [];
      const walk = (root: ParentNode): void => {
        root.querySelectorAll('draft-canvas').forEach((el) => candidates.push(el as HTMLElement & { system?: string }));
        root.querySelectorAll('*').forEach((el) => {
          const shadow = (el as HTMLElement).shadowRoot;
          if (shadow) walk(shadow);
        });
      };
      walk(document);
      const visible = candidates.find((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      }) ?? candidates[0];
      if (visible) {
        if (visible.system !== system) visible.system = system;
        return;
      }
      if (++frames < 60) setTimeout(write, 60);
    };
    // IMMEDIATE FIRST, THEN TIMER RETRIES — NOT rAF. Measured 2026-10-03, late: rAF does not
    // fire in a hidden pane (the same fact as the splash's removal in main.tsx), and a write
    // that waited only on it left the stage resolving against the app's own tables whenever
    // nobody was looking at the browser. A timer fires in a hidden pane (throttled, not
    // paused), and the element-upgrade race this loop exists for is measured in frames, not
    // seconds — 60 × 60ms is the same courtesy with a scheduler that always runs.
    write();
    setTimeout(write, 60);
  }, []);

  /*
   * PRODUCT'S OWN RENDERER (2026-10-03) — a third instance, same catalogue, same resolver.
   * Simpler than Design's: no portals, no preview column. What it DOES carry beyond the
   * tree assignment, both from the assembly's own data model:
   *
   *  · THE STAGE IS TOLD WHICH SYSTEM IT DRAWS FROM — a live property write, like the
   *    header's view (the renderer does not re-hand props on a components change). '' is
   *    honest: this package never chose a design system.
   *  · THE DRAG LISTENER'S PAYLOAD REF is kept here, from the same read the server made
   *    BEFORE the tree named the element — a missing draft stores null (no drag can fold
   *    into a payload that does not exist).
   *
   * IT LIVES HERE, not beside the other renderer effects, because its deps array evaluates at
   * render time and `writeDraftSystem` is a const declared below them (tsc's TS2448, measured).
   */
  useEffect(() => {
    const el = productRendererRef.current;
    if (!el) return;
    el.components = productTree.components;
    el.dataModel = productTree.dataModel;
    const model = (productTree.dataModel ?? {}) as Record<string, any>;
    writeDraftSystem(String((model.session ?? {}).design_system || ''));
    productDraftPayloadRef.current = ((model.session ?? {}).draft ?? null);
    // the page too — one mirror per fact (see the artifact ref's note)
    productArtifactRef.current = ((model.session ?? {}).artifact ?? null);
  }, [productTree, writeDraftSystem]);

  /* GOVERNANCE'S OWN RENDERER (2026-10-03) — the same rule, the last room. It carries the
     ledger element and the seat; nothing outside the tree needs wiring, because the ledger
     element reads its own feed. */
  useEffect(() => {
    const el = governanceRendererRef.current;
    if (!el) return;
    el.components = governanceTree.components;
    el.dataModel = governanceTree.dataModel;
  }, [governanceTree]);

  /**
   * S2'S FRONTEND HALF — THE LOOP THAT MAKES THE DRAFT REMEMBER.
   *
   * READ: `showDraftColumn` loads the conversation's stored layout (GET
   * /api/conversations/{id}/draft) and writes it to the path the view already binds
   * (`/session/middle_column/draft`), so opening the draft shows what was left there. Absent is a
   * real answer — this thread has no draft yet — and a read that FAILS does not open the view at
   * all: the empty state claims "nothing is drafted here", which is a different fact from "the
   * layout could not be read", and the reason goes where a person reads (her thread).
   *
   * WRITE: the host listens for `draft-node-moved` — the drafting canvas's own gesture end — folds
   * the released place into its copy of the payload and PUTs it. ONE DRAG, ONE WRITE, and the host
   * is the single writer of the stored draft: the element owns the live drag, the model owns the
   * payload, and this is the only thing that talks to the database.
   *
   * A WRITE THAT FAILS IS SAID, never swallowed: a layout that silently stopped saving is the
   * failure this whole loop exists to prevent.
   */
  const draftPayloadRef = useRef<DraftPayloadShape | null>(null);

  const writeDraftPayload = useCallback((payload: unknown): void => {
    setWorkspaceTree((prev) => {
      const model = { ...((prev.dataModel ?? {}) as Record<string, any>) };
      const session = { ...((model.session ?? {}) as Record<string, any>) };
      const middle = { ...((session.middle_column ?? {}) as Record<string, any>) };
      middle.draft = payload;
      session.middle_column = middle;
      model.session = session;
      return { ...prev, dataModel: model };
    });
  }, []);

  const sayInThread = useCallback((content: string): void => {
    window.dispatchEvent(new CustomEvent('a2ui:system-message', {
      detail: { role: 'assistant', content },
    }));
  }, []);

  useEffect(() => {
    const onDraftNodeMoved = (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as {
        nodeId?: unknown; x?: unknown; y?: unknown;
      };
      const nodeId = typeof detail.nodeId === 'string' ? detail.nodeId : '';
      const at = (typeof detail.x === 'number' && typeof detail.y === 'number')
        ? { x: detail.x, y: detail.y }
        : null;
      const payload = draftPayloadRef.current;
      if (!nodeId || !at || !payload) return;
      const next: DraftPayloadShape = {
        ...payload,
        positions: { ...(payload.positions ?? {}), [nodeId]: at },
      };
      draftPayloadRef.current = next;
      // The model follows the drag immediately — the payload and the drawing stay one fact.
      writeDraftPayload(next);
      const conversationId = String(((currentPromptSessionObjRef.current as any)?.conversationId) || '');
      if (!conversationId) {
        sayInThread('That drag was not saved: this package has no conversation to keep its draft in.');
        return;
      }
      void (async () => {
        try {
          const res = await fetch(
            `${API_BASE}/conversations/${encodeURIComponent(conversationId)}/draft`,
            {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(next),
            },
          );
          if (!res.ok) {
            const refused = (await res.json().catch(() => null)) as { detail?: string } | null;
            throw new Error(String(refused?.detail || `HTTP ${res.status}`));
          }
        } catch (err) {
          sayInThread(
            'That drag was not saved to this conversation: '
            + `${err instanceof Error ? err.message : String(err)}`,
          );
        }
      })();
    };
    window.addEventListener('draft-node-moved', onDraftNodeMoved);
    return () => window.removeEventListener('draft-node-moved', onDraftNodeMoved);
  }, [writeDraftPayload, sayInThread]);

  /*
   * THE PRODUCT ROOM'S DRAFT PAYLOAD — the drag listener's own copy, folded and PUT the same
   * way the Composer's is (ONE DRAG, ONE WRITE; the host is the single writer). The ref is
   * kept by the product renderer effect from the assembly's read; the guard on `payload`
   * means the Composer's listener and this one can each stand down for the other's canvas
   * (only one room's ref is ever set), so one drag can never write twice.
   */
  /* MOVED (2026-10-21): the 9-line callback now lives in `@/rooms/product/useWriteProductDraftPayload`, returned by a hook. */
  const writeProductDraftPayload = useWriteProductDraftPayload({ setProductTree });



  /* MOVED (2026-10-21): the 9-line callback now lives in `@/rooms/product/useWriteProductArtifactPayload`, returned by a hook. */
  const writeProductArtifactPayload = useWriteProductArtifactPayload({ setProductTree });

  /* MOVED (2026-10-21): the 173-line block now lives in `@/rooms/product/useProductDraft`.
     Same statement, same deps, passed by name. */
  useProductDraft({ currentProductSessionRef, productArtifactRef, productDraftPayloadRef, productSelectedNodeRef, sayInThread, writeProductArtifactPayload, writeProductDraftPayload });

  /*
   * ══ THE BUILD — HER OFFER, THE COMPILE, THE STAGE (2026-10-03 evening, Slice B) ═══════════════
   *
   * `[Build that](action:build-wireframe)` from her chair (chat-panel dispatches
   * `a2ui:build-wireframe`) opens the product room's compile: the host asks
   * `POST /api/ai/assemble-wireframe` for the layout — the ask is the THREAD's last person turn,
   * read server-side, so the button carries no words of its own — and applies what comes back
   * through the ONE draft store (the same PUT every gesture uses; the host stays the single
   * writer). The stage redraws from the model path the drag handlers already keep, and her `say`
   * line lands in the thread as a system message — the room's own channel for what happened.
   *
   * A REFUSAL IS SPOKEN, THE STAGE UNTOUCHED: every failure — no package open, an undeclared
   * name, a prop the catalogue does not carry — is the server's words verbatim in her thread
   * (re-wording it here would be a second authority on the reason), and nothing is written.
   */
  /* MOVED (2026-10-21): the 66-line block now lives in `@/rooms/product/useProductBuildWireframe`.
     Same statement, same deps, passed by name. */
  useProductBuildWireframe({ currentProductSessionRef, productDraftPayloadRef, sayInThread, writeProductDraftPayload });

  /*
   * ══ THE SCOPED EDIT — "THIS TILE, NOT THE ROOM" (2026-10-03 late, STOLEN FROM THE EXAMPLE) ════
   *
   * `[Edit it](action:edit-node)` from her chair (chat-panel dispatches `a2ui:edit-node`) changes
   * ONE tile — the one the person selected on the stage (`draft-select`, tracked in
   * `productSelectedNodeRef`) — and leaves everything else exactly as it stands. This is Open
   * Canvas's highlight-scoped op brought over (their `updateArtifact`: the model answers with the
   * fragment only, the server splices; see the route's note for the borrowed contract and its
   * citations). The host applies the returned layout through the ONE draft store, the same writer
   * every gesture and the compile use.
   *
   * A REFUSAL IS SPOKEN, THE STAGE UNTOUCHED — every guard fails loud with a name a person reads:
   * no selection here, no package there, a tile that is no longer in the layout. The server's
   * words arrive verbatim; re-wording them would be a second authority on the reason.
   */
  /* MOVED (2026-10-21): the 70-line block now lives in `@/rooms/product/useProductNodeEdit`.
     Same statement, same deps, passed by name. */
  useProductNodeEdit({ currentProductSessionRef, productDraftPayloadRef, productSelectedNodeRef, sayInThread, writeProductDraftPayload });

  /*
   * ══ THE ROOM BUILDS AS THE PERSON SPEAKS (2026-10-03, late — the owner's word) ════════════════
   *
   * *"we don't need that [Build that button] — just give her a prompt and she starts building."*
   * So the seat announces every real person turn (`a2ui:person-turn`, fired only after the server
   * answered AND the thread adoption settled). THE DRAFT-ERA COMPILE THAT USED TO ANSWER THIS
   * RETIRED 2026-10-06: the room builds IN THE ENGINE now — the seat's turn IS the build (the
   * bridge hands builder conversations to the engine; see routes/builder_bridge.py), so by the
   * time this event fires the build has already landed. The host's whole job here is to let the
   * STAGE show what was written: bumping the key remounts the embed, which re-reads the project
   * and paints the new files. The work card is the seat's own (it opens on send, ends on the
   * reply) — there is no second stage for the host to announce. Only the product room listens.
   */
  useEffect(() => {
    const onPersonTurn = () => {
      if ((headerTab || '') !== 'product') return; // another room's turn — not this stage's
      setProductStageKey((k) => k + 1);
    };
    window.addEventListener('a2ui:person-turn', onPersonTurn);
    return () => window.removeEventListener('a2ui:person-turn', onPersonTurn);
  }, [headerTab]);

  /**
   * The views a column can show in each state.
   *
   * THE DRAFT IS A VIEW OF THE COLUMN, SO THE OUTPUT VIEW CANNOT OFFER IT: leaving the run's column
   * gives the column up (that is what `showOutputColumn` has always done — "the middle column goes
   * away again, it is a Run's column"), and a draft needs a column to be drawn in. Raising one from
   * the output view means assembling it — the model's job (`render-draft`), not a hand-written
   * chain, which is the protocol violation the canvas docs already record. So the menu carries
   * exactly what is there, and nothing else.
   */
  const COLUMN_VIEWS_RUN = ['flow', 'output', 'draft'];
  const COLUMN_VIEWS_DRAFT = ['output', 'draft'];
  const COLUMN_VIEWS_OUTPUT = ['output'];

  /**
   * THE THIRD VIEW — the drafting canvas takes the output column's body, by the same rules the
   * Run's drawing and the output do: the body is found by ROLE, replaced, and what was there
   * leaves with its subtree. The DRAWING GOES WITH IT when it was the view being left — the same
   * consequence choosing "Output" has always had, and the reason the header only offers the canvas
   * while a Run has put one there.
   */
  const showDraftColumn = useCallback(async (): Promise<void> => {
    // The element must exist before the tree names it — see loadDraftElements.
    await loadDraftElements();
    /*
     * THE PACKAGE'S CHOSEN DESIGN SYSTEM IS LOADED BEFORE THE TREE NAMES ANY COMPONENT. `resolveTag`
     * reads the fetched map (shared/a2uiRegistries), so a load that happened after the first render
     * would leave names refusing that are about to be resolvable. ABSENT IS A REAL ANSWER — the
     * package never chose one, and the draft resolves against the app's own tables only. A load that
     * FAILS throws: the switch fails loud rather than drawing a draft for a system it could not read.
     */
    const system = String(
      ((currentPromptSessionObjRef.current as any)?.metadata?.design_system) || '',
    );
    if (system) await loadSystemRegistry(system);
    /*
     * THE STORED LAYOUT, READ BEFORE THE VIEW OPENS (see the S2 block above). Absent is a real
     * answer — nothing drafted in this thread yet — and the empty state then tells the truth. A
     * read that FAILS does not open the draft at all: the empty state would claim "nothing is
     * drafted here", which is a different fact from "the layout could not be read", and the reason
     * goes where a person reads.
     */
    const conversationId = String(((currentPromptSessionObjRef.current as any)?.conversationId) || '');
    if (conversationId) {
      try {
        const res = await fetch(`${API_BASE}/conversations/${encodeURIComponent(conversationId)}/draft`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = (await res.json()) as { draft?: unknown };
        draftPayloadRef.current = (body?.draft as DraftPayloadShape | null) ?? null;
      } catch (err) {
        sayInThread(
          'The draft was not opened: this conversation\'s layout could not be read '
          + `(${err instanceof Error ? err.message : String(err)}). Nothing was changed.`,
        );
        return;
      }
      // The payload lands where the view reads it — its own bound path — before the tree names
      // the element, so the first paint is the stored layout rather than the empty state.
      writeDraftPayload(draftPayloadRef.current);
    }
    setWorkspaceTree((prev) => {
      const comps = Array.isArray(prev.components) ? prev.components : [];
      const next = comps.slice();
      /*
       * THE DRAFT TAKES THE DRAWING'S SLOT, NOT THE COLUMN — and that distinction WAS the defect.
       * Measured 2026-10-02: replacing the column's body replaced the CONTAINER (`RoomEmbed` —
       * the header and the foot are its slots), so choosing Draft took the header with it: the
       * selector, the label, and every way back, leaving a column with no furniture. The draft is a
       * view INSIDE the column: the container, its header and its foot stay; only the `flow` child
       * changes.
       */
      const container = next.find((c: any) => c?.component === 'RoomEmbed');
      const flowId = (container?.children as Record<string, unknown> | undefined)?.flow;
      const j = typeof flowId === 'string' ? next.findIndex((c: any) => c?.id === flowId) : -1;
      if (j < 0) {
        // Unreachable while the menu carries no Draft in a state with no column (see the
        // COLUMN_VIEWS_* constants). Named rather than silent, so a future caller that reaches it
        // is told why nothing happened.
        logger.warn('the draft was asked for, but there is no column to draw it in', {
          hasContainer: Boolean(container),
          hasFlow: typeof flowId === 'string',
        });
        return prev;
      }
      /*
       * THE BODY IS THE DRAFT, bound to the one data-model path this view reads — where the
       * assembler will write a layout and a hand adjusts it. Unset is its own state: the element
       * says nothing is drafted yet, which is the truth, not a blank.
       *
       * THE PATH IS `/session/middle_column/draft`, and the owner's note said `output_column`:
       * every binding this column has ever carried lives under `middle_column` (the flow, the
       * compiled output), so ONE name is used for one place — a second prefix for the same column
       * would be two names for it.
       */
      next[j] = {
        id: flowId as string,
        component: 'draft-canvas',
        draft: { path: '/session/middle_column/draft' },
      };
      return { ...prev, components: next };
    });
    // The header is told in the same act — a live property write (see setColumnView) — and the
    // draft is told which system it draws from, which was loaded above.
    setColumnView('draft', COLUMN_VIEWS_DRAFT);
    writeDraftSystem(system);
  }, []);

  /**
   * THE HEADER IS TOLD WHAT THIS COLUMN CAN SHOW, ON ARRIVAL TOO — not only when a view is
   * switched. Without this the menu existed only after a Run: a fresh package's header is composed
   * by the model (render-composer) with no view props, so the tile stayed the label it had always
   * been and the drafting view was unreachable from exactly the state a person starts in.
   *
   * ONE WRITER AND ONE FACT: `stampColumnView`, and the guard is the fact itself — a header that
   * already carries `views` is left alone, so this cannot fight a switch (which stamps too) or
   * re-run against its own write.
   */
  useEffect(() => {
    const comps = Array.isArray(workspaceTree?.components) ? workspaceTree.components : [];
    if (!comps.some((c: any) => c?.component === 'OutputControls')) return;
    // The header has arrived without a view written (a model-composed column: render-composer,
    // render-run's own emission). Tell it what THIS state can show; a header that already carries
    // views is left alone, so this cannot fight a switch, and the property write is idempotent, so
    // a re-render cannot loop it. The retry inside setColumnView covers the element not being
    // committed yet.
    const header = deepFind<HTMLElement & { views?: string[] }>('output-controls');
    if (!header || !(Array.isArray(header.views) && header.views.length)) {
      setColumnView('output', COLUMN_VIEWS_OUTPUT, true);
    }
  }, [workspaceTree, setColumnView]);

  const showOutputColumn = useCallback(() => {
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
      // The middle: whatever the layout points at, or the viewer the assembly emitted
      // without pointing at it (a Run is what makes it a column).
      const middleId =
        (childMap.middle as string | undefined) ??
        next.find((c: any) =>
          c?.component === 'compiled-output-viewer'
          || c?.component === 'RoomEmbed'
          || c?.component === 'draft-canvas')?.id;
      const i = middleId ? next.findIndex((c: any) => c?.id === middleId) : -1;
      if (i < 0) return prev;
      const have = next[i];
      if (have?.component === 'compiled-output-viewer' && have?.content?.path) return prev;

      /*
       * WHAT THE CANVAS BROUGHT, READ OFF THE CANVAS ITSELF. The subtree that leaves with it is
       * the one ITS `children` names — the column's controls, the drawing, the foot — and the
       * ids are the assembly's, not a list kept here. A hardcoded list of names is how the other
       * side of this file drifted from the catalog in the first place.
       */
      const doomed = new Set<string>();
      const collect = (id: string): void => {
        if (doomed.has(id)) return;
        doomed.add(id);
        const comp = next.find((c: any) => c?.id === id);
        for (const childId of Object.values((comp?.children as Record<string, unknown>) ?? {})) {
          if (typeof childId === 'string' && childId !== middleId) collect(childId);
        }
      };
      for (const childId of Object.values((have?.children as Record<string, unknown>) ?? {})) {
        if (typeof childId === 'string') collect(childId);
      }

      next[i] = {
        id: middleId,
        component: 'compiled-output-viewer',
        content: { path: '/session/middle_column/compiled_output' },
      };
      // The middle column goes away again — it is a Run's column — and the drawing and the
      // header leave with the view that used them. Her column is not "restored" either: it was
      // never taken and never written, so there is nothing here to put back.
      delete childMap.middle;
      for (let idx = next.length - 1; idx >= 0; idx -= 1) {
        if (doomed.has(next[idx]?.id)) next.splice(idx, 1);
      }
      if (root) next[r] = { ...root, children: childMap };
      return { ...prev, components: next };
    });
    setColumnView('output', COLUMN_VIEWS_OUTPUT);
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

  const [_isLightMode, _setIsLightMode] = useState(false); // Dark mode is default
  const [_isTeacher, setIsTeacher] = useState(false); // Teacher role state

  // Projects management state — WHAT SURVIVES IS WHAT IS STILL WRITTEN (2026-10-21).
  // `projects` lost its last reader when the project handlers were deleted; `editingProjectId`,
  // `editingProjectName`, `newProjectName`, `showNewProjectInput`, `selectedConversationIds`
  // and the multi-select flag lost their only WRITERS with the same deletion, so they were
  // state that could never change. What stays is what the pipeline still writes: the project
  // list, the selected project, and that project's conversations.
  const [, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [_projectConversations, setProjectConversations] = useState<
    Conversation[]
  >([]);

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

  /**
   * THE PLACE, AS THE OPERATOR LEFT IT — read off the elements that own it, ONCE, for both
   * writers of `metadata.workspace`: the Save (which sends it with everything else) and the
   * Run's own state write (saveRunState — owner, 2026-10-05: *"it has already RUN and that
   * state should save on run"*).
   *
   * READ OFF THE ELEMENTS — the left column from <workspace-layout>, her seat and the
   * drawing's pan and zoom from <room-embed>, the drawing itself from <agent-flow>. Not a
   * new event and not a new prop: the components already publish these (leftCollapsed is a
   * property; the plug-in answers workspaceState()), and a save is a read, not a gesture. A
   * piece that is not on screen is simply absent, and the server keeps what it had
   * (metadata merges key-by-key at the top; see update_session).
   *
   * AND IT IS A SHADOW-PIERCING READ, which was the correction: `document.querySelector`
   * reaches nothing here — the shell draws the surface INSIDE the renderer's shadow root —
   * so both of these were null on every save and the place never travelled, silently.
   * A null was indistinguishable from "the view is not open", which is why it took the
   * same helper the flow's link needed to make the two reads real.
   */
  const readWorkspaceState = (): Record<string, unknown> | undefined => {
    const layout = deepFind<HTMLElement & { leftCollapsed?: boolean }>('workspace-layout');
    const canvas = deepFind<HTMLElement & { workspaceState?: () => Record<string, unknown> }>('room-embed');
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
    /*
     * THE COLUMN THE RUN ASSEMBLED — the drawing's own components, kept WITH the state that
     * shows them (owner, 2026-10-05). The saved `middle` says WHICH view; the graph says
     * what the picture holds; this says what the picture is MADE OF — the five components a
     * Run's assembly put in the middle column. Without it a reopened package can know it
     * has run and still draw nothing (the column only ever arrived from a Run's model call),
     * and re-drawing it would be a fresh model call per open — the second call per Run this
     * app already paid for and removed. The ref is fed by the Run the moment its column
     * arrives, and by the open the moment a saved column is put back.
     */
    const runColumn = assembledRunColumnRef.current;
    if (Array.isArray(runColumn) && runColumn.length) {
      state.run_column = { components: runColumn };
    }
    return Object.keys(state).length ? state : undefined;
  };

  /**
   * THE RUN'S STATE, WRITTEN THE MOMENT THE RUN IS — the narrow write (owner, 2026-10-05:
   * *"it has already RUN and that state should save on run"*).
   *
   * IT WRITES ONLY `metadata.workspace`. Not the sections, not the output, not the
   * description: content stays the operator's Save to make (the owner's rule, 2026-09-18),
   * and the full save path pays for a model summary — the second model call per Run this
   * app already paid for once and removed (see the note where the old answer-save was
   * deleted, below). What nothing used to write down is the state OF THE RUN — the folded
   * prompt, the middle marker, the drawing and the column it is made of — which is why the
   * Insurance card, measured 2026-10-05, carried `{ leftCollapsed: false }` and nothing
   * else after it had run.
   *
   * A CARD, NOT A SCRATCH PROMPT: the write needs a session id. An unsaved prompt has no
   * row for a state to live in; its manual Save still carries the same state when made.
   *
   * THE DRAWING IS WAITED FOR, BOUNDED, ON A REAL CONDITION. The answer and the assembly
   * are two independent waits (two model calls), so the response can land before the canvas
   * mounts; a write at that moment would store "ran, nothing to show" — the half-record
   * this change exists to prevent. The wait ends when the state HAS its drawing (middle
   * 'flow' + a graph), or when the bound runs out — and a bound that runs out is said, in
   * the trace, never swallowed.
   *
   * FAILURES ARE SAID, NOT SWALLOWED (logger → the Trace tab): a state write that fails
   * silently is the reopened package that "forgot" it ran.
   */
  const saveRunState = async (): Promise<void> => {
    const sessionId = currentPromptSessionRef.current;
    if (!sessionId) return;
    const deadline = Date.now() + 25_000;
    let workspace = readWorkspaceState();
    while (
      (!workspace || workspace.middle !== 'flow' || !workspace.graph)
      && Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 250));
      workspace = readWorkspaceState();
    }
    if (!workspace || workspace.middle !== 'flow' || !workspace.graph) {
      logger.error('the run state never formed, so nothing was saved for it', { sessionId });
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/prompt-sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': getStoredUserId() },
        body: JSON.stringify({ metadata: { workspace } }),
      });
      if (!res.ok) {
        logger.error('the run state could not be saved on the package', { sessionId, status: res.status });
        return;
      }
      console.log('[run] state saved on the package —', JSON.stringify(Object.keys(workspace)));
    } catch (e) {
      logger.error('the run state write never reached the backend', { sessionId, error: String(e) });
    }
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
      const sections: PromptSection[] = allSections.map((s) => ({
        id: generateUuid(),
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
        /*
         * THE SURFACE'S OWN TITLE, BEFORE THE REACT COPY.
         *
         * The bar lives in the surface now, so a name given to a draft lives there too —
         * and it is the NEWEST name, where `currentPromptSession.title` is whatever the
         * last save returned. Read in this order, a prompt named and then saved keeps the
         * name the person gave it; read the other way round it would be saved under the
         * previous name, or under the timestamp fallback for a package being created.
         */
        || surfaceTitle()
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
      // READ BY ITS ONE READER (readWorkspaceState, above the save) — the Run's own state
      // write (saveRunState) reads the same facts through the same code, so the two writers
      // of `metadata.workspace` cannot drift apart. It reads the live elements: the layout's
      // left column, the canvas's seat and pan/zoom, the drawing's graph, and the column a
      // Run assembled (run_column, owner 2026-10-05) — each present only when it is on
      // screen, so a half-record cannot rearrange anything the server already holds.
      const workspace = readWorkspaceState();

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

  /**
   * WRITE THE PACKAGE'S NAME INTO THE SURFACE, WHERE THE BAR READS IT.
   *
   * `<left-column-header>` binds its title to /session/title, so a rename that only
   * reached React state would persist, would update the console card, and would leave the
   * bar showing the old name — which is exactly what happened: the handler ran, the row
   * was written, and the title on screen did not move.
   *
   * BOTH BRANCHES OF A RENAME CALL THIS. A fresh composer has no package id yet, so the
   * title goes down the CREATE path; an existing one goes down the UPDATE path. The bar
   * does not care which — it reads one path — so the write belongs in both rather than in
   * the one that was easy to reach.
   */
  const writeTitleToSurface = useCallback((next: string) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      if ((session.title ?? null) === next) return prev;
      return {
        ...prev,
        dataModel: { ...prev.dataModel, session: { ...session, title: next } },
      };
    });
  }, []);

  /**
   * THE PACKAGE'S OWN FACTS, AS THE SURFACE HOLDS THEM — the read half of the pairs above.
   *
   * The bar and the card are in the surface now, so the surface is where their values live; this is
   * how everything OUTSIDE the surface asks for them. `currentPromptSession.title` and
   * `.description` are copies that follow a save, and reading them for a draft that has been named
   * but never saved would give the previous value — or nothing.
   *
   * ONE READER, AND IT IS THIS ONE. The seat beside the Run draws its buttons from the surface
   * (`packageDescription`), so a review that read a different copy would hold the Run on a
   * requirement the seat can see is already met — and disable the very button that would clear it.
   * That is exactly what happened: measured 2026-09-23 on the Insurance News Scout package, the
   * seat read a description the review was told was `(none)`. The order the two copies are read in
   * is decided in shared/packageFacts, once, and this hands it the surface's own session.
   */
  const surfaceSession = useCallback((): { title?: unknown; description?: unknown } => {
    return (surfaceDataModelRef.current as { session?: { title?: unknown; description?: unknown } })?.session ?? {};
  }, []);

  const surfaceTitle = useCallback((): string => {
    return packageTitle(surfaceSession(), currentPromptSessionObjRef.current?.title);
  }, [surfaceSession]);

  /** The description, read the way the seat that judges it reads it. See shared/packageFacts. */
  const surfaceDescription = useCallback((): string => {
    return packageDescription(surfaceSession(), currentPromptSessionObjRef.current?.description);
  }, [surfaceSession]);

  /**
   * THE DESCRIPTION INTO THE SURFACE, WHERE THE SEAT THAT JUDGES IT READS IT.
   *
   * The same pair as the title above, for the same reason: <chat-panel> is bound to
   * /session/description and it is the seat that says whether a package has one. A write that
   * only reached React state would persist and leave the seat reading the old value — so the
   * button that added the description would stay live, and the next review would be told the
   * package has none. One fact, one path, written where it is read.
   */
  const writeDescriptionToSurface = useCallback((next: string) => {
    setWorkspaceTree((prev) => {
      const session = prev.dataModel.session ?? {};
      if ((session.description ?? null) === next) return prev;
      return {
        ...prev,
        dataModel: { ...prev.dataModel, session: { ...session, description: next } },
      };
    });
  }, []);

  /**
   * THE DESCRIPTION, WRITTEN WHERE IT LIVES — the second half of `set-package-description`.
   *
   * The session row carries it (prompt-sessions PUT takes a partial update), the React copy
   * follows so the console card reads the new line without a reload, and the SURFACE is written
   * too (see writeDescriptionToSurface) so the seat that judges the package sees it at once.
   *
   * AN UNSAVED PACKAGE HAS NOWHERE TO PUT IT YET. There is no row to write to, and inventing one
   * is exactly the mistake the title path stopped making — the first SAVE creates the row, and a
   * save generates the description from the prompt anyway. So a draft's description is said back
   * as unsaved rather than dropped in silence; the person is told, once, in the console's own
   * voice, and the next save carries it.
   */
  const handlePromptDescriptionChange = useCallback(async (description: string) => {
    const id = currentPromptSessionObjRef.current?.id;
    if (!id) {
      writeDescriptionToSurface(description);
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content: 'That description will be saved with the package — this draft has no record yet.',
        },
      }));
      return;
    }
    try {
      const resp = await fetch(`${API_BASE}/prompt-sessions/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-User-ID': getStoredUserId(),
        },
        body: JSON.stringify({ description }),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      setCurrentPromptSession((prev: any) =>
        prev ? { ...prev, description, updatedAt: new Date().toISOString() } : prev,
      );
      writeDescriptionToSurface(description);
      console.log('📝 [CRUD] Description written:', description.slice(0, 60));
    } catch (error) {
      // Said out loud: a description the person cannot see is one they will write again.
      window.dispatchEvent(new CustomEvent('a2ui:system-message', {
        detail: {
          role: 'assistant',
          content: `The description was not saved — ${String(error)}`,
          alert: true,
        },
      }));
    }
  }, []);

  const handlePromptTitleChange = async (newTitle: string) => {
    // Serialization guard: share mutex with handleSavePrompt to prevent double-record race
    if (isSavingRef.current) {
      console.log('⏸️ [CRUD] Title change skipped — save already in flight');
      return;
    }
    /*
     * A NAME IS NOT A PACKAGE, AND NAMING ONE MUST NOT CREATE ONE.
     *
     * This branch used to create a row from the title alone, through
     * promptService.savePromptTemplate — a call that passes NO description, because the
     * description is written by the save pipeline (`/api/ai/save-surface` has the model
     * summarise the prompt) and this path does not go near it. Measured: every package
     * created this way had an EMPTY description, so the console drew cards with nothing
     * under them. Four of them, from one afternoon of naming drafts.
     *
     * So a title given to a draft is written to the SURFACE and stops there. The row is
     * created by the first SAVE, which generates a description like every other save — and
     * the save reads the title from the surface (see the title chain in handleSavePrompt),
     * so the name the person gave it is the name it is stored under.
     *
     * An EXISTING package is still renamed by PUT, which is what a rename is: no
     * description is involved and none should be.
     */
    if (!currentPromptSession?.id) {
      writeTitleToSurface(newTitle);
      console.log('📝 [CRUD] Named draft — persisted on first save');
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
      /*
       * AND THE PROMPT'S OWN BAR READS THE SURFACE (see writeTitleToSurface). This used
       * to be an inline write here — right in the UPDATE branch only, which is why the
       * bar stayed on its old value on a fresh composer: that title goes down the CREATE
       * path below.
       */
      writeTitleToSurface(newTitle);
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
      //
      // AND A ROW THAT IS PAST THE END IS AN ADDED ROW, not a write to ignore. See
      // patchSectionAt: the drop was silent, so a row the assistant made never reached the
      // model and came back off the next render.
      if (typeof index === 'number' && index >= 0 && section) {
        patchSectionAt(index, section);
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

    /*
     * AND A ROW THE ELEMENT MADE. `<prompt-section-editor>` grows its own list — the seat
     * menu's Add Section, an add-role, and now a write to a seat the prompt does not have —
     * and says so with `section-add`, which carries the row itself. Nothing anywhere listened,
     * so the row existed only inside the element: drawn, and not in the model. This is that
     * event's other end. (The repair copy needs nothing here: a repair prompt's rows are the
     * finding's, and a row added to one is not part of the finding.)
     */
    const onSectionAdd = (e: Event) => {
      const section = ((e as CustomEvent).detail || {}).section;
      if (!section) return;
      patchSectionAt(null, section);
      hasUnsavedChangesRef.current = true;
      // A ROW IS A NODE. Rebuild the drawing the moment a row appears, so a seat made in the
      // prompt is on the canvas — and a node dropped on the canvas, which writes its row
      // through this same event, stops being a draft. Whoever made it (the seat menu, an
      // add-role, a chat button, the canvas), the row is the fact and the picture follows it.
      publishFlowFromRows(section);
    };
    window.addEventListener('section-add', onSectionAdd);

    /*
     * AND A ROW TAKEN OUT, WHICH NOTHING LISTENED FOR EITHER.
     *
     * The element has reported removals and reorders since it was written — its own header lists
     * both as events it emits, and the tag registry repeats it — and neither had a listener. So
     * the seat menu's Delete, the assistant's `<remove_role>`, and a merge all removed a row from
     * the ELEMENT: drawn as gone, still in the model, and back on screen at the next
     * model-driven render. Measured 2026-09-23 while adding the merge.
     *
     * REMOVED BY INDEX, GUARDED BY NAME. An index alone would cut whatever had moved into that
     * slot if a write landed between the report and this listener; the name is what the element
     * meant, and a row whose name no longer matches is not the row that was removed.
     */
    const onSectionRemove = (e: Event) => {
      const { index, name } = ((e as CustomEvent).detail || {}) as { index?: number; name?: string };
      if (typeof index !== 'number' || index < 0) return;
      setWorkspaceTree((prev) => {
        const session = prev.dataModel.session ?? {};
        const left = session.left_column ?? {};
        const have: any[] = Array.isArray(left.sections) ? left.sections : [];
        if (index >= have.length) return prev;
        const named = (s: any) => String(s?.name || s?.section || s?.role || s?.type || '');
        if (name && named(have[index]) !== String(name)) return prev;
        const sections = have.filter((_, i) => i !== index);
        return {
          ...prev,
          dataModel: { ...prev.dataModel, session: { ...session, left_column: { ...left, sections } } },
        };
      });
      hasUnsavedChangesRef.current = true;
    };
    window.addEventListener('section-remove', onSectionRemove);

    // A REORDER IS THE SAME KIND OF REPORT: the element decided the order, and the model follows.
    const onSectionReorder = (e: Event) => {
      const { from, to } = ((e as CustomEvent).detail || {}) as { from?: number; to?: number };
      if (typeof from !== 'number' || typeof to !== 'number') return;
      if (from < 0 || to < 0 || from === to) return;
      setWorkspaceTree((prev) => {
        const session = prev.dataModel.session ?? {};
        const left = session.left_column ?? {};
        const have: any[] = Array.isArray(left.sections) ? left.sections : [];
        if (from >= have.length || to >= have.length) return prev;
        const sections = have.slice();
        const [moved] = sections.splice(from, 1);
        sections.splice(to, 0, moved);
        return {
          ...prev,
          dataModel: { ...prev.dataModel, session: { ...session, left_column: { ...left, sections } } },
        };
      });
      hasUnsavedChangesRef.current = true;
    };
    window.addEventListener('section-reorder', onSectionReorder);

    return () => {
      window.removeEventListener('section-update', handler);
      window.removeEventListener('section-add', onSectionAdd);
      window.removeEventListener('section-remove', onSectionRemove);
      window.removeEventListener('section-reorder', onSectionReorder);
    };
    // The writers are re-created when the model changes, so the listener is re-registered
    // with them: a handler holding the first render's copy would write from the model as
    // it was when the page loaded.
  }, [surfaceSections, writeSectionsToSurface, patchSectionAt, publishFlowFromRows]);

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
    // No audit in this build — nothing to settle against, and nothing to say about it
    // (see isCatalogAuditDisabled). Silent, on the owner's design.
    if (isCatalogAuditDisabled(health)) return;
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

    // AND THE EVALS TAB GETS THE CHECK'S VERDICT — for a repair, the check IS the judge:
    // no model is asked to second-guess it. The row carries the same sentence the canvas
    // node draws, so the two views of one fact cannot drift.
    {
      const sessionId = currentPromptSessionRef.current;
      if (sessionId) {
        try {
          const res = await fetch(`${API_BASE}/prompt-sessions/${sessionId}/evaluations`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              verdict: stillThere ? 'failed' : 'cleared',
              sentence: stillThere ? 'the fresh check still finds it' : 'the fresh check no longer finds it',
              trigger: 'Repair',
            }),
          });
          if (!res.ok) {
            logger.error('the check verdict could not be recorded', { sessionId, status: res.status });
          }
        } catch (e) {
          logger.error('the check verdict never reached the backend', { sessionId, error: String(e) });
        }
      }
      void refreshEvaluations();
    }

    /*
     * AND THE STATE IS WRITTEN AGAIN WITH THE VERDICT (owner, 2026-10-05 — see saveRunState):
     * a repair's last word is the check's, and the graph a reopened card draws must carry it.
     * The write is narrow and idempotent — the run's-end write stood without it, and this one
     * supersedes it the moment the verdict exists.
     */
    void saveRunState();
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

  /* MOVED (2026-10-21): the 88-line bridge now lives in `@/rooms/useOpenCardFromConsole`. Its
     arguments are read AT CALL TIME from this ref — the route's open and the seat's fresh-handler
     effect both need the bridge above the functions it closes over, and a hook's arguments
     evaluate the moment it is called. The ref is filled below `assembleSurfaceThenRepairs`. */
  const openCardDepsRef = useRef<UseOpenCardFromConsoleDeps | null>(null);
  const handleOpenPromptFromConsole = useOpenCardFromConsole(openCardDepsRef);

  /**
   * IS THE TOOL'S ENGINE UP? (2026-10-04) — the bridge's health door (`/api/builder/health`
   * proxies the engine's own `/health`). The room asks when it opens, because a stopped
   * engine otherwise reads as a BROKEN TOOL: the Code panel and every build fail with the
   * tool's own error text, and nothing on screen says the process is missing. This is what
   * the room's banner says out loud. Best-effort — a failed check reads as "down".
   */
  /* MOVED (2026-10-21): the 9-line function now lives in `@/rooms/product/useCheckBuilderEngine`, returned by a hook. */
  const checkBuilderEngine = useCheckBuilderEngine({ setBuilderEngineDown });

  /**
   * OPEN THE ROOM — RESUME THE PROJECT LAST TOUCHED, OR BIRTH THE FIRST ONE (owner,
   * 2026-10-06 — the confirmed package model: *"user will come in and create an idea in their
   * project/package and then they may come back and want to do something different to it …
   * five different edit processes over a month to one project."*). Entering Product no longer
   * births a project on every click: the bridge's `/builder/room` reopens the project whose
   * conversations moved last — its package PERSISTS now (hidden from the console's cards
   * until published, the way every draft package is) — and births one only when there is
   * none to resume. The seat's own conversations list is the project's return visits.
   * THERE IS NO DASHBOARD, EVER (2026-10-04, unchanged): the room lands in a project, or the
   * banner says why it cannot.
   */
  const creatingProductProjectRef = useRef(false);
  /* MOVED (2026-10-21): the 21-line function now lives in `@/rooms/product/useOpenProductRoom`, returned by a hook. */
  const openProductRoom = useOpenProductRoom({ creatingProductProjectRef, setBuilderEngineDown, setProductRoomProjectId });

  /* MOVED (2026-10-21): the room's ENTRY — the engine check and the open-a-project decision —
     now lives in `@/rooms/product/useProductEntry`. The shell's only part is saying which tab is
     active. */
  useProductEntry({ checkBuilderEngine, headerTab, openProductRoom, productRoomProjectId });

  /**
   * THE ROOM'S EXIT GUARD (owner, 2026-10-04; the save-as-draft door, 2026-10-06: *"You must
   * save this before we can continue or offer them a saved draft option."*) — asked only
   * where it means something:
   *   · no project open          → leave freely;
   *   · published                → leave freely (its card is the team's business now);
   *   · unpublished and BLANK    → discarded IN SILENCE (born from a click, never used);
   *   · unpublished with work    → ASK: save it as a draft, publish it to the console, discard
   *                                it for good, or stay. Save-as-draft SETTLES the held
   *                                project into the person's packages — private and resumable,
   *                                still off the console until published.
   * The ENGINE is the fact (read through the bridge); an unreadable engine lets the person
   * leave — a guard that traps someone on a stopped process would be worse than the risk.
   */
  const [leavePrompt, setLeavePrompt] = useState<{ projectId: string; settle: (choice: 'publish' | 'discard' | 'keep' | 'stay') => void } | null>(null);

  /* MOVED (2026-10-21): the 11-line function now lives in `@/rooms/product/useDiscardProductProject`, returned by a hook. */
  const discardProductProject = useDiscardProductProject({  });

  /* MOVED (2026-10-21): the 59-line function now lives in `@/rooms/product/useGuardProductExit`, returned by a hook. */
  const guardProductExit = useGuardProductExit({ discardProductProject, hasUnsavedChangesRef, productRoomProjectId, setLeavePrompt, setProductRoomProjectId });

  /**
   * THE LAB GROUND WARMS HERE — ONCE THE WORKSPACE HAS LANDED (see `warmLabGrounds` above).
   * By the time Development is clicked, the tile is fetched and decoded, and the room's first
   * paint is the finished ground instead of the arriving one.
   */
  useEffect(() => {
    warmLabGrounds();
  }, []);

  /**
   * THE BUILDER SAID IT PUBLISHED (2026-10-04): the flag is the engine's (the builder's own
   * proxy wrote it); what is missing is the CARD — so the host syncs now, and the console
   * has it before anyone looks.
   */
  useEffect(() => {
    const onPublished = () => {
      // PUBLISHED = RESOLVED — the exit gate's same ref comes down (see the beforeunload
      // effect): a published project has nothing left to lose, in the room or the browser.
      hasUnsavedChangesRef.current = false;
      void fetch(`${API_BASE}/builder/sync`, { method: 'POST' });
    };
    window.addEventListener('builder-published', onPublished);
    return () => window.removeEventListener('builder-published', onPublished);
  }, []);

  /**
   * THE GOVERNANCE ROOM'S OPENING — the same three-hands shape as the rooms beside it.
   * TWO hands since 2026-10-08 (the application left the room, owner's order — the
   * frame-load hand went with it): the minimum and the seat's binding restart on every
   * entry; the ceiling still takes the cover down and the room keeps its own ground —
   * no fallbacks, never a trapped blank.
   */
  useEffect(() => {
    if ((headerTab || '') !== 'governance') return;
    setGovernanceGateDown(false);
    governanceSeatSettledRef.current = false;
    if (governanceGateMaxTimerRef.current) clearTimeout(governanceGateMaxTimerRef.current);
    governanceGateMaxTimerRef.current = setTimeout(() => {
      setGovernanceGateDown(true);
    }, GOVERNANCE_GATE_MAX_MS);
    return () => {
      if (governanceGateMaxTimerRef.current) clearTimeout(governanceGateMaxTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTab]);

  /* THE PRODUCT ROOM'S OWN THREE HANDS — the minimum, the frame's load, the seat's binding —
     run inside `@/rooms/product/useProductGate` (moved 2026-10-21, same reasons). */

  /**
   * THE PRODUCT ROOM'S CHAT LOADS OPEN AT 600 (owner, 2026-10-06, revised the same night:
   * *"make the chat window size on load default to 600 instead of 550"* — superseding his
   * own earlier 550). This supersedes the room's 2026-10-05 open-closed rule:
   * `chatLoadWidth = 600` is the layout's OWN declared load width — the element documents
   * it ("a room that declares a width opens her THERE instead") and it only says where she
   * STANDS on load; a drag is still the operator's and the saved-width path is untouched.
   * `isThirdOpen = true` opens her on entry. Both are PROPERTIES through the ref, never JSX
   * attributes (Lit's boolean converter reads any present attribute as true). From there the
   * gripper keeps opening and closing her exactly as it does in every other section — open or
   * closed belongs to the element that owns the width. `useLayoutEffect`, so the first paint
   * is already the open column.
   */
  useLayoutEffect(() => {
    if ((headerTab || '') !== 'product') return;
    const el = productLayoutRef.current;
    if (!el) return;
    el.chatLoadWidth = 600;
    el.isThirdOpen = true;
    /* THE SEAT IS MARKED AS THE ROOM'S OWN BEFORE ITS FIRST PAINT (owner, 2026-10-06 — the
       no-fallback rule, quoted in chat-panel's `productRoom` note): an unbound product seat
       must draw NOTHING, never the v.4b tray or the old messages list — the seat's default
       face is every other room's UI. A PROPERTY through the ref, set here, where the column
       opens, so the seat's very first render already knows the room it belongs to. */
    const seat = productSeatRef.current;
    if (seat) seat.productRoom = true;
    /* THE WIDTH IS ASSERTED ON THE ENTRY FRAMES (see `assertPaneWidth`): the declared 600 can
       land in a render that cannot measure the element yet, and the pane then holds its 104px
       rail floor until an unrelated re-render unfreezes it — measured, and it was the pop.
       Three frames cover the measured case; the frame-load and seat-settle beats assert again
       if the window closes early. */
    let frames = 0;
    let raf = requestAnimationFrame(function assertWidth() {
      assertPaneWidth(productLayoutRef.current);
      frames += 1;
      if (frames < 3) raf = requestAnimationFrame(assertWidth);
    });
    return () => cancelAnimationFrame(raf);
  }, [headerTab]);

  /**
   * THE PRODUCT ROOM'S SEAT IS THE BUILDER'S (2026-10-06 — the absorption: owner, *"I want to
   * absorb that chat into our chat … I don't want two different chat setting side-by-side"*).
   *
   * The seat no longer borrows the Composer's loaded chat. Its thread is THE PROJECT'S
   * conversation, read from the engine through the bridge; its identity is the room's CARRIER
   * — a package row + conversation the seat's own guards require (a conversation must belong
   * to its package for a send to leave). The carrier is DISPOSABLE: the engine keeps the
   * transcript; nothing of substance is ever written to the platform side. The send needs no
   * room-side code at all — the seat posts its turn the one way it always does, and the
   * TEACHER ROUTE hands builder conversations to the engine (`builder_turn_reply`); the reply
   * that lands in the thread is the builder's own sentence. `messages` is bound ONCE per entry
   * — live turns ride the seat's own thread, so a rebind after every run would draw each turn
   * twice.
   */
  /* MOVED (2026-10-21): the 112-line block now lives in `@/rooms/product/useProductSeat`.
     Same statement, same deps, passed by name. */
  useProductSeat({ PRODUCT_SEAT_TABS, assertPaneWidth, dropProductGateWhenAllLanded, headerTab, productLayoutRef, productRoomProjectId, productSeatRef, productSeatSettledRef });

  /**
   * THE ATTACH DOOR — THE ENGINE'S OWN UPLOAD ENDPOINT, THE ENGINE'S OWN ANSWER.
   *
   * The app's paperclip uploads to `{engine}/projects/{id}/files/upload` through its own
   * proxy; this is the same door, reached through the bridge (one hop, same endpoint, the
   * same multipart the app sends). The answer is handed back VERBATIM as a chat line —
   * including the local engine's honest refusal ("Attachments are not supported by the
   * local engine."), which is exactly what a person clicking attach on the app's own chat
   * gets locally. SUCCESS IS THE FUTURE'S PATH, not a fake: when the engine supports
   * uploads, this same call attaches for real and says so.
   */
  /* MOVED (2026-10-21): the 29-line callback now lives in `@/rooms/product/useProductAttachment`, returned by a hook. */
  const uploadProductAttachment = useProductAttachment({ productRoomProjectId });

  /**
   * THE PRODUCT FOOT'S WIRING (owner, 2026-10-06: *"all of these stubs go. And you're gonna
   * put the products wiring down"*). The foot only asks; this room answers, and both wires
   * end at THE PRODUCT'S OWN DOORS:
   *
   *   attach    → `uploadProductAttachment` above (the engine's upload endpoint).
   *   figma /   → `postToBuilder` INTO the embedded builder, which opens ITS own modal
   *   github      / toggles ITS own visual editor — the product's functions with the
   *   visual-edit   product's own answers (its local-mode truths included).
   *
   * AND THE APP TALKS BACK: `ids:tool-state` rides out of the frame, <builder-embed>
   * re-announces it as `builder-tool-state`, and its three facts land on the seat's own
   * props — the foot's dots and the pencil's pressed state mirror the APP, never a guess.
   * PRODUCT-ONLY: the guard is the tab, the listeners live on this room's seat element.
   */
  /* MOVED (2026-10-21): the foot's wiring effect — the tool/attach/stop listeners, the app's
     tool-state relay and the grip's safety net — now lives in
     `@/rooms/product/useProductFootWiring`, returned by a hook. */
  useProductFootWiring({
    headerTab,
    productLayoutRef,
    productRoomProjectId,
    productSeatRef,
    setProductGripActive,
    uploadProductAttachment,
  });

  /**
   * LIVE BUILD PROGRESS — THE APPLICATION'S OWN CHAT BEHAVIOR (owner, 2026-10-06: *"wire up
   * all of the product applications functions that it had in its chat … to load inside of our
   * chat frame"*). The app's chat shows the run AS IT HAPPENS — "Starting a new run…",
   * "Writing the app…" — and so does this room now: while a project is open, the room polls
   * the engine's own transcript and hands each NEW progress line to the seat's display
   * channel (`a2ui:system-message`, the shape the seat already draws — role + content).
   * PRODUCT-ONLY and room-side: the seat element is untouched, no other room's chat can see
   * any of this, and the person's turn and the builder's reply still ride the one route.
   * The FIRST successful read is the baseline — a reopened thread's history is the bound
   * record's business, never replayed as live lines.
   */
  /* MOVED (2026-10-21): the 131-line block now lives in `@/rooms/product/useProductConversationPoll`.
     Same statement, same deps, passed by name. */
  useProductConversationPoll({ hasUnsavedChangesRef, headerTab, productRoomProjectId, productSeatRef });

  /* MOVED (2026-10-21): the room's closed-on-entry write and its seat binding now live in
     `@/rooms/development/useDevelopmentRoom`. Same statements, same deps, passed by name. */
  useDevelopmentRoom({ headerTab, developmentLayoutRef, developmentSeatRef });

  /** THE GOVERNANCE ROOM'S CONTAINER LOADS CLOSED — the Development pair's mirror: the
   *  property write (never the attribute — Lit's boolean converter reads any present
   *  attribute, "false" included, as true), the first paint already closed, and the rail's
   *  list filled from the room's own constant while the seat carries none. */
  useLayoutEffect(() => {
    if ((headerTab || '') !== 'governance') return;
    const el = governanceLayoutRef.current;
    if (el) el.isThirdOpen = false;
    const seat = governanceSeatRef.current;
    if (seat && !seat.allowedTabs) seat.allowedTabs = GOVERNANCE_SEAT_TABS;
    /* THE EVALS EXPERIENCE WEARS THE ROOM'S OWN RAIL — same ids, same labels, same
       deactivated Preview until a trace stands. One room, one rail. */
    const evalsSeatEntry = governanceEvalsSeatRef.current as (HTMLElement & {
      allowedTabs?: string;
      tabLabels?: string;
      disabledTabs?: string;
    }) | null;
    if (evalsSeatEntry && !evalsSeatEntry.allowedTabs) {
      evalsSeatEntry.allowedTabs = GOVERNANCE_SEAT_TABS;
      evalsSeatEntry.tabLabels = '{"tools":{"label":"Preview","tooltip":"Preview the selected trace detail"}}';
      evalsSeatEntry.disabledTabs = 'tools';
    }
  }, [headerTab]);

  /* MOVED (2026-10-21): the room's seat is bound to its OWN package in
     `@/rooms/development/useDevelopmentRoom` — called above, one statement for both. */

  /*
   * THE COMPOSER-OPEN HANDLER, KEPT FRESH (see the seat's `open-composer` listener wired
   * in the governance mount block): the handler is recreated on every render, and the
   * listener wired at room entry must always call the LATEST one — a stale closure would
   * route to the Composer with stale state standing behind it.
   */
  useEffect(() => {
    openComposerRef.current = (sessionId: string) => void handleOpenPromptFromConsole(sessionId);
  }, [handleOpenPromptFromConsole]);

  /**
   * THE GOVERNANCE ROOM HAS ITS OWN CHAT — ITS OWN PACKAGE, ITS OWN CONVERSATIONS (the
   * owner's per-room law, 2026-10-06: *"Every room has its own packages its own output.
   * It's own conversation IDs."*). The bridge ensures the room's OWN package (a
   * `prompt_sessions` row marked `governance_room`, hidden from the console's cards) with
   * its own conversation, and the seat binds THAT — the Development seat's mechanism,
   * third room. The rail is the room's own list; what answers a governance turn is the
   * platform's own assistant, exactly as in the Composer — stated so, not dressed up.
   */
  /* MOVED (2026-10-21): the 612-line block now lives in `@/rooms/useGovernanceRoom`.
     Same statement, same deps, passed by name. */
  const { governancePath, governanceSectionPrefix, navigateGovernanceTool } = useGovernanceChrome({
    governanceEmbedRef, governanceLayoutRef, governanceSeatRef, governanceTraceSelRef, setGovernanceTraceSig,
  });
  useGovernanceRoom({ GOVERNANCE_SEAT_TABS, dropGovernanceGateWhenAllLanded, governanceComposerPackageRef, governanceEmbedRef, governanceEvalsSeatRef, governanceLayoutRef, governanceSeatRef, governanceSeatSettledRef, governanceSectionPrefix, governanceTraceElsRef, governanceTraceSelRef, headerTab, navigateGovernanceTool, openComposerRef, setGovernanceEvalsSeat, setGovernanceGripActive, setGovernanceTraceSig });

  /**
   * THE CONSOLE'S EVALS BUTTON USED TO CLAIM A TEACHING HERE — DELETED 2026-10-21.
   *
   * What stood here: a walk that found the console's `chat-panel`, wrote `evalsTalk` onto it,
   * and listened for `tab-change`. It did nothing. `chat-panel` has no `evalsTalk` property —
   * the capability lives on `evals-chat-panel` ("_evalsDrawsThread") — so `assignProps`
   * reported it as an unreported binding and dropped it, and the tab-change handler's body
   * was empty: it read the event and returned. A comment above it claimed an announcement
   * that no line of it made.
   *
   * DELETED RATHER THAN RE-AIMED: the console's seat is a `chat-panel`, which cannot draw the
   * conversation on its Evals tab, so there is nothing to aim the binding at. If the owner's
   * 2026-10-16 rule ("she has to talk whenever you click the eval's button") is to hold in
   * the Console, it needs a real build on an element that carries the behaviour — not this
   * effect pretending to.
   */

  /**
   * THE SEAT'S TRACE READ — the one place the room's selection becomes data.
   *
   * Reads the bundle (lib/governance-trace-source.ts) when the TRACE changes, writes the
   * three views from the shell (views never fetch), and reads the selected node's I/O —
   * the same two calls the app itself makes for the same screen. The skip condition is
   * (elements, applied node): re-entering the room re-applies everything (the elements
   * are new), a repeated report does NOTHING, and a new node reads only its I/O. Values
   * are written with assignProps — the views' declared properties are their contract.
   * A failed read is said out loud in the console with its real reason (the honesty
   * rule); the views simply stay on their waiting faces — never a fabricated state.
   */
  useEffect(() => {
    if ((headerTab || '') !== 'governance') return;
    const sig = governanceTraceSig;
    if (!sig) return;
    const els = governanceTraceElsRef.current;
    if (!els) {
      /* THE VIEWS ARE NOT REGISTERED YET — wait for the mount, then apply. Never a silent
         drop: without this the selection was lost and the tree stayed blank. */
      const retry = window.setTimeout(() => setGovernanceTraceElsTick((n) => n + 1), 400);
      return () => window.clearTimeout(retry);
    }
    let cancelled = false;
    void (async () => {
      try {
        const base = `${window.location.origin}${governanceSectionPrefix()}`;
        const sel = governanceTraceSelRef.current;
        let bundle = sel.bundle;
        let traceChanged = false;
        if (!bundle || bundle.trace.id !== sig.traceId) {
          bundle = await fetchGovTrace(base, sig.projectId, sig.traceId, sig.timestampIso, sig.obsId);
          if (cancelled) return;
          sel.bundle = bundle;
          sel.traceId = sig.traceId;
          sel.peekId = sig.peekId ?? null;
          traceChanged = true;
          assignProps(els.header, { trace: bundle.trace, observation: null });
          assignProps(els.tree, { trace: bundle.trace, observations: bundle.observations, selectedId: null });
          assignProps(els.detail, { trace: bundle.trace, observation: null, io: null, observations: bundle.observations });
          /* AND HER OWN EYES — the same snapshot the views draw, written onto the SEAT:
             `governanceTrace` joins her turn context (see the chat-panel props). Facts
             only — the same numbers on the screen. */
          const seatForFacts = governanceSeatRef.current;
          if (seatForFacts) {
            assignProps(seatForFacts, { governanceTrace: bundle.trace, governanceObservation: null, disabledTabs: '' });
          }
          /* THE PACKAGE LINK — on a Composer run the trace's Langfuse session IS the
             package's session id (the tap writes trace_session = request.session_id);
             a UUID that answers from the studio's own session store IS the package, and
             the action bar then offers Open in Composer for it. Anything else (the
             assembly modes' constants) resolves to no package: no button, no dead
             control. */
          const maybePackage = bundle.trace.sessionId;
          void (async () => {
            let packageId = '';
            if (maybePackage && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(maybePackage)) {
              try {
                /* API_BASE ALREADY CARRIES /api — this line used to add a second one
                   (`${API_BASE}/api/prompt-sessions/…`) and every probe answered 404:
                   the Open-in-Composer button simply never resolved. Measured live
                   2026-10-13 late (`GET /api/api/prompt-sessions/… FAILED 404`); every
                   other call site in this file reads `${API_BASE}/prompt-sessions/…`. */
                const res = await fetch(`${API_BASE}/prompt-sessions/${encodeURIComponent(maybePackage)}`, {
                  headers: { 'X-User-ID': getStoredUserId() },
                });
                if (res.ok) packageId = maybePackage;
              } catch {
                /* the button simply does not draw — no package claim without one */
              }
            }
            if (cancelled) return;
            governanceComposerPackageRef.current = packageId;
            const seatElse = governanceSeatRef.current;
            if (seatElse) assignProps(seatElse, { composerPackageId: packageId });
          })();
        }
        if (traceChanged) {
          /* THE PANEL'S EXTRAS — the scores and the bulk comment counts, the same two
             reads the fork's panel makes for this screen. They ride AFTER the bundle so
             the panel draws its data first; a failure is said out loud in the console,
             and the panel simply shows no chips — never a fabricated count. */
          void (async () => {
            try {
              const [scores, commentCounts] = await Promise.all([
                fetchGovTraceScores(base, sig.projectId, sig.traceId, sig.timestampIso),
                fetchGovObservationCommentCounts(base, sig.projectId),
              ]);
              if (cancelled) return;
              sel.scores = scores;
              sel.commentCounts = commentCounts;
              assignProps(els.tree, { scores, commentCounts });
              assignProps(els.detail, { scores });
            } catch (err) {
              if (!cancelled) console.error('[governance trace] extras read failed:', err);
            }
          })();
        }
        /* A TRACE-LEVEL SELECTION LANDS ITS ROOT NODE (owner, 2026-10-13 late: "we're not
           autoloading all parts of the default view" — with a trace standing, the Preview
           must be alive). The app's own row click carries the root's id as `peek`; when the
           selection legitimately has no node, the ROOT observation (parentObservationId
           null — the SPAN) stands in: the tree marks it, the detail fills with the prompt
           (the light preview), the io read fires. Nothing invented: the root IS the
           trace's own node, and the fork draws the same thing for a trace row. */
        const rootDefault = bundle.observations.find((o) => !o.parentObservationId)
          ?? bundle.observations[0]
          ?? null;
        /* THE APP'S OWN ROOT WINS WHERE IT HAS ONE (2026-10-13 late, measured): its row
           click carries `peek` = the observation IT considers the trace's root, and when a
           trace holds more than one parentless observation our own find() picked a
           different one — the app then refused to mark the row for a re-navigation built
           from our pick. The app's dialect is the authority; the parentless find is the
           fallback. */
        const appRoot = sig.peekId && bundle.observations.some((o) => o.id === sig.peekId)
          ? sig.peekId
          : null;
        const obsId = sig.obsId ?? appRoot ?? rootDefault?.id ?? null;
        sel.obsId = obsId;
        if (!traceChanged && sel.els === els && sel.appliedObsId === obsId) return;
        const observation = obsId ? (bundle.observations.find((o) => o.id === obsId) ?? null) : null;
        assignProps(els.header, { trace: bundle.trace, observation });
        assignProps(els.tree, {
          trace: bundle.trace,
          observations: bundle.observations,
          selectedId: observation?.id ?? null,
        });
        assignProps(els.detail, { trace: bundle.trace, observation, io: observation ? undefined : null });
        const seatForNode = governanceSeatRef.current;
        if (seatForNode) {
          assignProps(seatForNode, { governanceTrace: bundle.trace, governanceObservation: observation, disabledTabs: '' });
        }
        sel.els = els;
        sel.appliedObsId = obsId;
        if (!observation) return;
        /* THE NODE'S I/O — one batchIO read, the app's own window (min→max start times). */
        const win = observationWindow(bundle.observations);
        if (!win) return;
        const io = await fetchGovObservationIO(base, sig.projectId, sig.traceId, observation.id, win.start, win.end);
        if (cancelled) return;
        assignProps(els.detail, { trace: bundle.trace, observation, io });
      } catch (err) {
        /* SAID OUT LOUD with its real reason — the views stay waiting, never fake. */
        if (!cancelled) console.error('[governance trace] read failed:', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [governanceTraceSig, headerTab, governanceTraceElsTick]);

  useEffect(() => {
    // THE PRODUCT ROOM'S FRAME ANNOUNCES ITSELF HERE (Development's half left with its gate —
    // that room opens straight into its workspace and nothing waits on this event; the
    // GOVERNANCE branch left with the application, 2026-10-08 — its room has no frame):
    // the announcement is a bare window event and the embed raises it, so the guard reads
    // the CURRENT tab — never a stale closure.
    // Re-registered per tab.
    const onFrameLoaded = () => {
      const tab = headerTab || '';
      if (tab === 'product') {
        productFrameLoadedRef.current = true;
        setProductToolDown(false);
        /* THE FRAME IS UP — assert the pane's width from a beat where the room is standing
           (see `assertPaneWidth`): the declared 600 lands before the cover can lift. */
        assertPaneWidth(productLayoutRef.current);
        dropProductGateWhenAllLanded();
      }
    };
    window.addEventListener('builder-embed-loaded', onFrameLoaded);
    return () => window.removeEventListener('builder-embed-loaded', onFrameLoaded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [headerTab]);

  /**
   * THE BUILDER'S BACK ARROW COMES HOME (owner, 2026-10-04): *"there's a back button …
   * inside the product team area — that back button should go back to the console."*
   * The frame cannot touch this app; it postMessages, <builder-embed> verifies the sender
   * and re-announces `builder-back` on window, and this — the host — opens the console.
   */
  useEffect(() => {
    const onBuilderBack = () => {
      // Through the guard: the back arrow and "My projects" both LEAVE the room (2026-10-04).
      void (async () => {
        if (await guardProductExit()) handleHeaderTabChange('console');
      })();
    };
    window.addEventListener('builder-back', onBuilderBack);
    return () => window.removeEventListener('builder-back', onBuilderBack);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  /* MOVED (2026-10-21): the 549-line callback now lives in `@/console/useAssembleSurface`, returned by a hook. */
  const assembleSurfaceWithAI = useAssembleSurface({ AI_STANDBY_MESSAGE, ASSEMBLY_TIMEOUT_MS, consoleAssemblyControllerRef, currentPromptSessionRef, hasUnsavedChangesRef, headerTabRef, isConsoleAssemblyInFlightRef, lastAssemblyIntentRef, repairAskRef, repairTitleRef, setAiAssemblyFailed, setAiAssemblyMessage, setAiAssemblyReport, setAiDecision, setConsoleTree, setCurrentPromptSession, setHeaderTab, setIsAIAssembling, setIsFailureAcknowledged, setWorkspaceTree });

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
      // NO AUDIT, NO NOISE (owner, 2026-10-06, late): with the audit disabled by design
      // there is nothing to read and nothing to report — this used to log "the check did
      // not answer" into every console, which read as breakage on a page that was fine.
      if (isCatalogAuditDisabled(health)) return;
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
      /*
       * EVERY SURFACE THAT CAN RUN WARMS THE CANVAS — the one place all of them pass through.
       * The ground (591 KB) and the two elements are the only Run assets not already fetched, and
       * the console cannot run anything, so this is the earliest moment a Run is possible.
       * NOTHING IS AWAITED: the surface assembles and paints while the ground arrives behind it,
       * the Run's own loadCanvasElements() shares this promise, and the Run still fails loudly if
       * it cannot load them.
       */
      if (intent !== 'render-console') {
        void loadCanvasElements().catch((err: unknown) => {
          logger.warn('the canvas was not warmed for this surface — the Run will fetch it again', {
            error: String((err as Error)?.message ?? err),
          });
        });
      }
      await assembleSurfaceWithAI(intent, context);
      await loadCatalogFindings();
    },
    [assembleSurfaceWithAI, loadCatalogFindings],
  );

  /* THE BRIDGE'S ARGUMENTS, FILLED HERE — see its call above. Assigning the ref during render is
     the page's own standing pattern for a stale-closure read (`headerTabRef`, `openComposerRef`). */
  openCardDepsRef.current = { assembledConsoleCards, assembleSurfaceThenRepairs, guardProductExit, handleHeaderTabChange, productRoomProjectId, refreshEvaluations, repairFindingRef, repairSectionsRef, setPromptLoadKey, setIsAIAssembling, setProductGateDown, setProductRoomProjectId };

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
  /* THE TOOLS DOOR IS THE SEAT'S OWN. The console's rail announces the tab with
     `design-tools-open`; `design/DesignRoom` answers it by rendering `design/ToolsSeat`, which
     assembles ITSELF. Nothing of that seat is mounted, assembled or gated from this file. */

  /*
   * THE PRODUCT ROOM'S OWN ASSEMBLY (2026-10-03) — aimed at `render-product:{id}`. It writes
   * `productTree` and `currentProductSession` and nothing else; the arrival is recorded AND
   * announced one frame after the tree lands.
   */
  /* MOVED (2026-10-21): the 64-line callback now lives in `@/rooms/product/useAssembleProductSurface`, returned by a hook. */
  const assembleProductSurface = useAssembleProductSurface({ currentProductSessionRef, setCurrentProductSession, setIsAIAssembling, setProductTree });

  /*
   * THE CHOOSER'S WRITE IS GONE (2026-10-03, late) — REMOVED WITH THE CHOOSER, NOT DISABLED.
   *
   * The owner: *"I don't want the user to be able to select a catalogue. Let's just pick one
   * that's most compatible and use it. I'm removing that feature."* The room's system is now a
   * server-side constant (`_PRODUCT_ROOM_DESIGN_SYSTEM`), the element that dispatched
   * `design-system-chosen` is deleted from the app, and this listener went with it: no dispatch,
   * no PUT, no second writer on `metadata.design_system`. The assembly still CARRIES the name in
   * its data model — `assembleProductSurface` reads it to pre-load the system's registry before
   * the tree names any component — but nothing offers it and nothing writes it.
   */

  /*
   * THE GOVERNANCE ROOM'S OWN ASSEMBLY (2026-10-03) — the product room's shape, aimed at
   * `render-governance`. No session id: the room is a CONTAINER (the design room's own kind of
   * row), not a package — it opens its ledger and its seat, always. It writes `governanceTree`
   * and `currentGovernanceSession` and nothing else.
   */
  const assembleGovernanceSurface = useCallback(async (): Promise<void> => {
    setIsAIAssembling(true);
    try {
      const response = await apiFetch(`${API_BASE}/ai/assemble-surface`, {
        method: "POST",
        body: JSON.stringify({ intent: "render-governance" }),
      });
      const rawData = await response.json();
      const read = readA2UIEnvelope(rawData);
      if (read.ok === false) {
        console.error(`🤖 [A2UI] ENVELOPE REFUSED for render-governance — ${read.refusal.code}: ${read.refusal.message}`);
        throw envelopeRefusalError(read.refusal);
      }
      const reading = read.reading;
      setGovernanceTree({
        components: reading.components as any[],
        dataModel: reading.dataModel as Record<string, any>,
      });
      const governanceSession = (reading.dataModel as Record<string, any>)?.session ?? null;
      setCurrentGovernanceSession(governanceSession);
      window.requestAnimationFrame(() => {
        const kind = governanceSession?.session_id ? 'resume' : 'blank';
        const forSeat = governanceSession?.session_id ?? null;
        markArrival(kind, forSeat);
        window.dispatchEvent(new CustomEvent('a2ui:composer-opened', {
          detail: { kind, sessionId: forSeat },
        }));
      });
    } finally {
      setIsAIAssembling(false);
    }
  }, []);

  /* THE INGEST IS THE TOOLS FOLDER'S (`design/tools/ToolsSeat.tsx`). The copy that lived here was
     dead — the Design tab renders DesignRoom, and the tool owns its own handlers. */


  /* The ingest is answered by `design/tools/ToolsSeat.tsx`. */






  /*
   * ══ THE ACCEPT ACT, ANSWERED HERE (2026-10-03) ══════════════════════════════════════════════
   *
   * The rail announces `catalog-accept {system, name}`; this posts it and reports the outcome by
   * `catalog-accept-settled`, which is what lets the rail's row change — a row may not flip on its
   * own press; it flips on the write that landed.
   *
   * IT USED TO SPEAK AS WELL, on the message line the add-design-system form drew. That form is
   * gone (2026-10-04), so the write had no reader left and went with it: the row is the whole
   * account of an accept now. A refusal the person must read would need a line on an element that
   * exists — the server's reason is still returned, and nothing currently displays it.
   */
  useEffect(() => {
    const onCatalogAccept = async (event: Event) => {
      const detail = ((event as CustomEvent).detail || {}) as { system?: string; name?: string };
      const system = String(detail.system || '');
      const name = String(detail.name || '');
      if (!system || !name) return;
      let ok = false;
      try {
        const res = await fetch(`${API_BASE}/catalog/${encodeURIComponent(system)}/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name }),
        });
        ok = res.ok;
      } catch {
        ok = false;
      }
      window.dispatchEvent(new CustomEvent('catalog-accept-settled', {
        detail: { system, name, ok },
      }));
    };
    window.addEventListener('catalog-accept', onCatalogAccept);
    return () => window.removeEventListener('catalog-accept', onCatalogAccept);
  }, []);

  /*
   * ══ THE TWO RUN TRIGGERS, AND THE COLUMN THEY LAUNCH ═════════════════════════════════════════
   *
   * The owner's correlation, 2026-09-30: *"submit is run, selecting one of those components in that
   * list is a run function. It's supposed to display it… It's basically a left navigation — you're
   * loading those components and all of their meta-data just like you are on the react application
   * for ingest."*
   *
   * On the Composer, RUN moves a view into the middle column and `workspace-layout` draws it. Here
   * the same two facts are needed: something to draw (the preview state) and the layout REFERENCING
   * the middle column — a column the tree does not reference is collapsed, which is
   * workspace-layout's own contract and not a style. This function is both halves at once, because
   * they are one act: a run produces something, and the column that shows it opens.
   *
   * Clearing it (null) closes the column again — a Discard leaves the room as it was before the run.
   */
  /* MOVED (2026-10-21): the 175-line callback now lives in `@/design/useDesignPreview`, returned by a hook. */
  const setDesignPreview = useDesignPreview({ setDesignTree });

  /*
   * ══ HER COLUMN'S WIDTH — ONE PLACE THAT DECIDES IT, AT THE TWO MOMENTS THAT DECIDE IT ═════════
   *
   * TWO NUMBERS, BECAUSE THE ROOM HAS TWO STATES.
   *
   * AT REST the design surface asks for `DESIGN_CHAT_PX` — the owner, 2026-09-30: *"You need to
   * make the chat push further to the right, it's not closing enough. You don't have to collapse it
   * all the way, but you should reduce it. It's too wide as there's no room for anything to load."*
   * The element's own default is the Composer's `OPEN_CHAT_PX` (650px), which is right for a package
   * whose middle column is read at a glance and wrong for a room whose middle column is a PREVIEW.
   *
   * WITH THE PREVIEW OPEN her column takes `PREVIEW_CHAT_PX` — the owner's next instruction, in this
   * file's words at that constant: *"Make the chat panel reduced to 650 pixels that should be its
   * target whenever the internal column appears on submit or when selecting a component."*
   *
   * BOTH ARE ASKED FOR THROUGH THE ELEMENT'S OWN `setColumnWidths` — the public call the save and
   * restore use, never a private field and never a style override — and the Composer's own default
   * is untouched, because this runs only for the design renderer.
   *
   * ── WHY THE TWO ARE ONE EFFECT ───────────────────────────────────────────────────────────────
   * They write the same field, and two effects writing one field are two answers to one question.
   * Kept apart they also had to agree about an edge each tracked privately; here the precedence is
   * one `if`: the preview's width wins while the column is open, the room's width is for the room at
   * rest, and neither is applied twice.
   *
   * ── AND WHY IT FIRES ON AN EDGE RATHER THAN ON EVERY RENDER ──────────────────────────────────
   * THE WIDTHS BELONG TO WHOEVER DRAGS THEM. `setColumnWidths` records a width as the operator's
   * decision, and an effect keyed on the whole tree fights that decision on every re-render — after
   * an approve, after a second selection, over a width just set by hand. That fight was measured in
   * the running room on 2026-09-30: a run put her column at 650, the next row selection put it back
   * to 380, and a width set by hand to 500 became 380 one selection later. It is the owner's own
   * complaint from the column beside it: *"It's jerking away from me."* So each width is applied at
   * the one moment it is the room's business — the room drawing, and the preview column appearing —
   * and whatever happens to the width afterwards stands.
   *
   * ── AND "APPLIED" MEANS THE CALL ACTUALLY LANDED ─────────────────────────────────────────────
   * The first tree that arrives has no `workspace-layout` in the renderer to speak to yet, so an
   * attempt made then does nothing — and treating it as done left the room on the element's own
   * equal split: 950px of her column in a 1900px room, the exact width the owner asked to be rid of.
   * The wait is the one this file already makes when a package opens against the same race
   * (`openThePrompt` below, "the layout arrives with the surface"): retry frame by frame, and give
   * up quietly — an element that never appears is a room that is not drawn.
   */
  const roomShapeSetRef = useRef(false);
  const previewWidthSetRef = useRef(false);
  useEffect(() => {
    if (!isDesignView) {
      // Leaving the room forgets both, so coming back establishes them again.
      roomShapeSetRef.current = false;
      previewWidthSetRef.current = false;
      return;
    }
    if (!designTree.components.length) return;

    // WHETHER THE COLUMN IS OPEN IS THE TREE'S FACT, not the layout element's: the reference lives
    // in `components.children.middle` — the one line `setDesignPreview` writes for a Submit and for
    // a selected row alike — and reading it back off the DOM would be a second answer to it.
    const root = designTree.components.find((c: any) => c.id === "root") as
      | { children?: Record<string, unknown> }
      | undefined;
    const previewOpen = !!root?.children?.middle;
    if (!previewOpen) previewWidthSetRef.current = false;

    let equalise = false;
    if (previewOpen && !previewWidthSetRef.current) equalise = true;
    else if (!previewOpen && !roomShapeSetRef.current) equalise = true;
    if (!equalise) return;

    let frames = 0;
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      const ws = (designRendererRef.current as any)?.shadowRoot?.querySelector("workspace-layout");
      if (ws?.splitEqually) {
        ws.splitEqually();
        if (previewOpen) previewWidthSetRef.current = true;
        else roomShapeSetRef.current = true;
        return;
      }
      if (++frames >= 40) return;
      requestAnimationFrame(apply);
    };
    apply();
    return () => {
      cancelled = true;
    };
  }, [isDesignView, designTree]);

  useEffect(() => {

    /* THE PREVIEW'S ACTS AND THE CARD DOOR ARE THE TOOLS FOLDER'S (`design/tools/ToolsSeat.tsx`).
       Nothing is registered here; two registrations would run every action twice. */
  }, [designTree, setDesignPreview]);

  /* Guards the room-switch cover against stale owners: every show or instant hide bumps
     it, and a settle loop or soft fade that finds a newer epoch leaves the cover alone
     (see `handoffCoverShown` / `handoffCoverHidden` / `handoffCoverFadeOut`). */
  const handoffCoverEpochRef = useRef(0);

  /* MOVED (2026-10-21): the 455-line callback now lives in `@/rooms/useTabGate`, returned by a hook. */
  const handleTabChangeWithGate = useTabGate({ SECTION_TABS, assembleGovernanceSurface, assembleProductSurface, assembleSurfaceThenRepairs, currentPromptSession, guardProductExit, handleHeaderTabChange, handoffCoverEpochRef, hasUnsavedChangesRef, headerTab, isDeadTab, openProductRoom, productRoomProjectId, setConsoleRefreshKey, setGovernanceGateDown, setIsAIAssembling, setProductGateDown });

  // The chat rail's mark navigates back to the console — the same
  // path the Console header tab uses.
  useEffect(() => {
    const onNavigateConsole = () => { void handleTabChangeWithGate('console'); };
    window.addEventListener('navigate-console', onNavigateConsole);
    return () => window.removeEventListener('navigate-console', onNavigateConsole);
  }, [handleTabChangeWithGate]);

  /*
   * THE DRAWER'S HAND-OVER (2026-10-03). The mobile drawer receives `currentTab` and no switch
   * callback, so a tab a person can actually open hands over through an event — the same device
   * `navigate-console` already is. This routes it through the SAME gate every header click uses,
   * so the drawer can never become a second, ungated way into a room.
   */
  useEffect(() => {
    const onNavigateTab = (event: Event) => {
      const tabId = String(((event as CustomEvent).detail || {}).tabId || '');
      if (!tabId) return;
      void handleTabChangeWithGate(tabId);
    };
    window.addEventListener('navigate-tab', onNavigateTab);
    return () => window.removeEventListener('navigate-tab', onNavigateTab);
  }, [handleTabChangeWithGate]);

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

    /*
     * A LOAD IS AN ARRIVAL, AND IT SAYS SO — exactly as pressing the Console tab does.
     *
     * This was the one path that never announced anything, so a person who opened the console
     * (or reloaded it) got a silent seat: her greeting is what answers an arrival, and with no
     * arrival announced there was nothing for her to answer. Measured 2026-09-23 — the owner,
     * after a reload: "Grace is gone, she doesn't talk anymore", while the same console greeted
     * correctly the moment the Console tab was pressed.
     *
     * The kind is 'console' and carries no session id: the console's session is a server fact
     * that arrives WITH the assembly, and the seat answers this one from its own scope read —
     * the same fact its greeting waits on (see `_seatIsConsole` in chat-panel).
     *
     * NOT ANNOUNCED FOR A PACKAGE. A session in the URL means this load is a package, and a
     * package's arrival is announced where it is opened (`markArrival('resume', sessionId)`),
     * because opening one is an act with its own address.
     */
    if (!routeSessionId) {
      markArrival('console');
      window.dispatchEvent(new CustomEvent('a2ui:composer-opened', { detail: { kind: 'console' } }));
    }

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
    // THE DEMO KEEPS EVERYTHING. DELETE is refused server-side (demo_policy.py) and
    // the card's delete control is not drawn there (agent-card-element) — this is the
    // belt under that brace, for any other caller of this path.
    if (isDemoMode()) return;
    try {
      await promptService.deletePromptSession(sessionId, true);
      if (currentPromptSession?.id === sessionId) setCurrentPromptSession(null);
      removePackageFromConsole(sessionId);
    } catch (error) {
      console.error('Failed to delete prompt session:', error);
    }
  }, [currentPromptSession?.id, removePackageFromConsole]);


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

    if (currentPromptSession && (conversationId === null || currentPromptSession.conversationId !== conversationId)) {
      // Update local state only. Conversations are package-owned: the conversation
      // row already carries session_id — prompt_sessions.conversation_id was dropped.
      setCurrentPromptSession(prev => prev ? { ...prev, conversationId: conversationId ?? null } : null);
      // The ref must move in the SAME tick: the seat dispatches the first
      // call's a2ui:usage right after conversation-change, and the usage
      // accumulator reads this ref synchronously. An effect-run update would
      // still hold the old conversation and drop the first call's numbers.
      if (currentPromptSessionObjRef.current) {
        currentPromptSessionObjRef.current = { ...currentPromptSessionObjRef.current, conversationId: conversationId ?? null };
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
  /* MOVED (2026-10-21): the 635-line window-event effect now lives in
     `canvas/useShellEventListeners.ts`. Same statement, same deps, passed by name. */
  useShellEventListeners({ consoleRendererRef, deletePackageRef, handleConversationChange, handleRepairFinding, handleSavePromptRef, handleTabChangeWithGate, headerTab, patchSectionAt, publishFlowFromRows, readLiveOutput, setWorkspaceTree, showDraftColumn, showOutputColumn, surfaceSections });

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
  /* MOVED (2026-10-21): the 193-line block now lives in `@/canvas/useRestorePackageWorkspace`.
     Same statement, same deps, passed by name. */
  useRestorePackageWorkspace({ COLUMN_VIEWS_RUN, assembledRunColumnRef, carriedPositionsRef, currentPromptSession, currentPromptSessionRef, setColumnView, setWorkspaceTree, storedWidthsRef, writeFlowToSurface });


  // Listen for conversation updates to refresh the list
  /* MOVED (2026-10-21): the 1286-line block now lives in `@/canvas/useRunPipeline`.
     Same statement, same deps, passed by name. */
  useRunPipeline({ COLUMN_VIEWS_RUN, activeTab, applyThirdColumn, askOf, assembleThirdColumn, assembledRunColumnRef, catalogFindings, currentPromptSessionObjRef, currentPromptSessionRef, firstLineOf, flowFactsRef, flowInputRef, handleOpenPromptFromConsole, handlePromptDescriptionChange, handlePromptTitleChange, handleSavePromptRef, heldRunRef, publishRepairFlow, readLiveOutput, readToolRegister, refreshEvaluations, repairFindingRef, repairSectionsRef, repairTitleRef, rowsForDecision, runApprovedRef, saveRunState, selectedProjectId, setActiveTab, setAiAssemblyFailed, setAiAssemblyMessage, setAiAssemblyReport, setCanvasHolding, setCanvasRunning, setColumnView, setCurrentPromptSession, setIsComposerRunning, setIsFailureAcknowledged, setProjectConversations, setProjects, setPromptLoadKey, setSelectedProjectId, settleRepair, speakRepairVerdict, surfaceDescription, surfaceSections, surfaceTitle, syncCanvasInset, toolsThatCannotRun, writeAnswerBack });

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

      {/* NO VIEWPORT-WIDTH WARNING (owner, 2026-10-18): "We don't need to give him a
          message. He should show the card. It should just be covered." A narrow window
          clips the content it cannot fit; it never covers the room with a notice. */}

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

      {/* Left column nav — THE SAME PAGE-LEVEL PATTERN EVERY SECTION USES: the
          shell rail on every tab, and the Governance room's own isolated nav on
          Governance. Both are width-0 overlays in this flex row at the page's
          top-left, which is what keeps their header control (the logo) in the
          header band — never under it. */}
      {isGovernanceView ? (
        <GovernanceNav
          onNavigate={navigateGovernanceTool}
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
            ROW 1 ONLY. It used to carry a second row — the prompt's title, version, tags,
            id, author, score and flip — and that row now lives INSIDE the surface as
            <left-column-header>, in the left column it describes. The title is why: as
            React state behind a callback it had no path, so the AI could not read it or
            set it. What stays is navigation, which is the shell's own job. */}
        <LeftColumnHeader
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
                // THE CONSOLE'S GROUND, handed to the surface rather than painted by the
                // slots: one element, owned by the sandbox, living outside the viewport's
                // fade. See .ground-video in ai-surface-sandbox.ts for why the two slots
                // below carry no backdrop of their own.
                console-video-src={consoleVideo}
              >
                {/* slot="spinner" — honest loading state: one real spinner bound to
                     the live request via isAIAssembling, one true sentence.
                     No scripted message rotation, no fake progress bar,
                     no artificial minimum display time.

                     NO BACKDROP OF ITS OWN on the console side: the console's ground
                     (video + #270F31) belongs to <ai-surface-sandbox>, which paints it
                     BEHIND this slot and outside the viewport's fade — so the waves run
                     unbroken from the spinner through to the assembled console instead of
                     fading out and back in mid-transition. The composer keeps its image. */}
                <div slot="spinner" className="flex flex-col items-center justify-center gap-5 size-full" style={{ backgroundColor: isConsoleView ? 'transparent' : workspaceGroundColor, paddingBottom: '200px', backgroundImage: isConsoleView ? 'none' : `url(${workspaceBackground})`, backgroundSize: groundSize, backgroundRepeat: groundRepeat, backgroundPosition: groundPosition }}>
                  {/* THE GATE'S RING (owner, 2026-10-04: *"we have a spinner on the login gate …
                      it has a nice spinner with a yellow indicator on it. Can you put those
                      spinners back to our assembly gates"*). The sign-in gate's amber indicator
                      — rgba(240,179,35,0.25) ring, solid #F0B323 top — replaces the plain teal
                      ring, so every assembly gate wears the one look the gate taught. */}
                  <div aria-hidden="true" className="animate-spin" style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(240, 179, 35, 0.25)', borderTopColor: 'rgb(240, 179, 35)' }} />
                  <p className="text-[#507274] text-sm font-medium font-['Inter']">{aiAssemblyMessage}</p>
                </div>
                {/* slot="console" — shown when header-tab is "console" */}
                <div slot="console" style={{ display: 'flex', flex: '1 1 0%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'auto', position: 'relative' }}>
                  {/* NO GROUND HERE — not the #270F31, not the waves. Both come from
                      <ai-surface-sandbox> (console-video-src + the ground-console class),
                      which paints them behind the whole viewport. A backdrop inside this
                      slot lives inside the fade, so it went out with the spinner and came
                      back in with the console: that swap was the flash. The cards and chat
                      above stay fully opaque, since the video sits at 0.75 behind them. */}
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
                  <div style={{ flex: '1 1 0%', minWidth: 0, minHeight: 0, height: '100%', overflow: 'hidden', position: 'relative' }}>
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
                      // Card-open goes through the SAME path as the shell's own open:
                      // it flips the header to composer and sets the assembling flag
                      // first, so the composer background (not the console's) fades in
                      // during assembly. The old inline call skipped the flip, so the
                      // spinner kept showing the console's image until the composer landed.
                      await handleOpenPromptFromConsole(sessionId);
                    }}
                  />
                </div>
                {/* slot="workspace" — AI-driven Lit tree (A2UI v0.9.1).
                    Slots are the loading contract. AI fills them with prompt blocks.
                    When assembly FAILS, show the error — no hiding. */}
                <div slot="workspace" style={{ position: 'relative', display: 'flex', flex: '1 1 0%', height: '100%', minHeight: 0, minWidth: 0, overflow: 'hidden', backgroundColor: workspaceGroundColor, backgroundImage: `url(${workspaceBackground})`, backgroundSize: groundSize, backgroundRepeat: groundRepeat, backgroundPosition: groundPosition }}>
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
                    /* TWO RENDERERS, ONE CATALOGUE. Design mounts its OWN instance — its own
                       Grace, its own container, its own everything — drawing the same components
                       from the same catalogue as the Composer's. The `key` is what makes them
                       two mounts rather than one element whose props changed: without it React
                       reuses the element and the second room would inherit the first's drawn
                       surface.

                       AND NOTHING AT ALL FOR A DEAD TAB — see DEAD_TABS. Without this branch the
                       three stubs fell through to the COMPOSER's renderer, which would have drawn
                       whatever composer surface happened to be in it: a room showing another
                       room's contents, which is the opposite of "should not load anything". */
                    !isConsoleView && (headerTab === 'development'
                      /* THE DEVELOPMENT ROOM'S PANE LIVES IN ITS OWN FOLDER (2026-10-21) — see
                         `@/rooms/development/DevelopmentRoom`. The markup and the room's own
                         record moved with it; the page states the branch and nothing else. */
                      ? (
                        <DevelopmentRoom developmentLayoutRef={developmentLayoutRef} developmentSeatRef={developmentSeatRef} />
                      )
                      : isDeadTab
                      ? null
                      : headerTab === 'design'
                        /* THE DESIGN BUTTON LOADS A FILE (owner, 2026-10-18). `<DesignRoom />` is
                           the Design tab's own entry point, and it holds the room's SEATS: the
                           console seat and the Tools seat (`design/ToolsSeat`, the Figma
                           ingestion section with its own columns, its own chat and its own
                           conversation). The shell hands it the assembly flag and draws
                           nothing of any seat itself.
                           AND IT IS A ROOM ROOT LIKE THE OTHERS (`data-room-root="design"`):
                           the switch's own mechanics — the synchronous hide of the outgoing
                           root and the hand-off cover's retirement at root-visible — read
                           that attribute, and without it a product→design switch paid the
                           exit guard on the pane's bare ground and the cover had nothing to
                           wait for. The wrapper is the same layout-neutral flex box the other
                           rooms wear. */
                        ? (
                          <div key="design-root" data-room-root="design" style={{ position: 'relative', display: 'flex', flexDirection: 'column', flex: '1 1 0%', minHeight: 0, overflow: 'hidden' }}>
                            <Suspense fallback={null}>
                              <DesignRoom key="design-room" onAssemblingChange={setIsAIAssembling} />
                            </Suspense>
                          </div>
                        )
                        : headerTab === 'product'
                          /* THE PRODUCT ROOM IS THE CONSOLE'S CONTAINER + THE BUILDER (owner,
                             2026-10-05): *"just dropping the app iframe into a copy of the console
                             — remove the cards, drop the builder in there where the cards are."*
                             So the room wears the CONSOLE'S container — `workspace-layout`, the
                             composer's own frame element, never a copy of it — with the whole app
                             builder as its left column (unchanged inside: the frame and the
                             stopped-engine banner; the staged gate now spans the whole room,
                             see the cover below) and the platform chat seat as its
                             right column, CLOSED on entry (the gripper strip and the rail — the
                             console's own behaviour, because it is the console's container).
                             THE SEAT IS THE ONE ELEMENT THE CONSOLE AND COMPOSER USE, and it
                             reads the COMPOSER'S loaded chat — same conversation, same thread;
                             no surface is assembled for this room and no new conversation is
                             created (see the seat effect beside the product clocks below).
                             THE PROJECT COMES FROM THE CARD: a console card for a builder
                             project sets `productRoomProjectId`, and the embed opens that
                             project's workspace; with none, a new one is born (never the
                             dashboard — the room's own rule). */
                          ? (
                            <ProductRoom builderEngineDown={builderEngineDown} productGripActive={productGripActive} productToolDown={productToolDown} productRoomProjectId={productRoomProjectId} productStageKey={productStageKey} productGateDown={productGateDown} leavePrompt={leavePrompt} productLayoutRef={productLayoutRef} productSeatRef={productSeatRef} />
                          )
                          : headerTab === 'governance'
                            ? (
                              /* THE GOVERNANCE ROOM'S PANE LIVES IN ITS OWN FOLDER (2026-10-21) —
                                 see `@/rooms/governance/GovernanceRoom`. The markup and the
                                 room's own record moved with it; the page states the branch
                                 and nothing else. */
                              <GovernanceRoom
                                governanceGripActive={governanceGripActive}
                                governanceGateDown={governanceGateDown}
                                governanceEvalsSeat={governanceEvalsSeat}
                                governanceLayoutRef={governanceLayoutRef}
                                governanceSeatRef={governanceSeatRef}
                                governanceEvalsSeatRef={governanceEvalsSeatRef}
                                governanceEmbedRef={governanceEmbedRef}
                              />
                            )
                            : <a2ui-renderer key="composer-render" ref={composerRendererRef} />)
                  )}
                  {/*
                    ══ THE INJECTION ═══════════════════════════════════════════════════════
                    THE INGEST, PORTED INTO THE ROOM'S SLOTS.

                    The owner, 2026-09-30: *"you don't replace, you inject — you're just
                    putting that… what you've got is unstyled, it has no theme, it's just the
                    application the way you built it. And we're just gonna port that into the
                    slots."* And on what does the porting: *"Grace will have to assemble it or
                    the AI assembler will have to call it through the design assembly
                    renderer."*

                    So the assembler emits the CONTAINER (`render-design`), the design renderer
                    draws it, and this portal puts the ingest's three regions INSIDE it — the
                    frame and the theme come from the container, the content comes from the
                    tool. `variant="section"` is what makes that a hand-over and not a copy:
                    it returns the three regions as a React fragment, with no wrapper element
                    of its own, so each one lands as a DIRECT CHILD of the room's
                    `<workspace-layout>` and is projected by its own `slot` attribute —
                    `left` (the rail: Figma URL, catalogues, the component tree), `middle`
                    (the output column: the preview) and `right` (Grace). A container inside a
                    container is what made the first attempt look like a copy of the modal.

                    WHY A PORTAL AND NOT COMPONENTS IN THE SURFACE. The regions are React and
                    the room is Lit, drawn in a shadow root from a component tree whose entries
                    are catalogue TAGS. React elements are not tags and the ingest is not in
                    the catalogue — it is what writes it — so the surface cannot carry them.
                    The portal is the join: React renders them, the DOM places them, the
                    container's slots project them. And it is rendered ONLY for the design room
                    and ONLY once the container exists, so the Composer's surface — which draws
                    its own tree with the same catalogue — is untouched by any of this.

                    THE INGEST IS NOT A PACKAGE AND IS HANDED NO SESSION. Design's own
                    container is the record (`currentDesignSession`), and no id from it is
                    passed as a prompt session: a click in Design writes nothing the Composer
                    owns, and this is where that would otherwise leak in.

                    `onClose` does nothing, deliberately: in `section` there is no overlay and
                    no Close — leaving the tab is how you leave it.
                  */}
                  {/*
                    ══ NOTHING IS MOUNTED INTO THIS ROOM FROM HERE ══════════════════════════
                    It was here: a portal that put the ingestion tool's React regions
                    (`IngestModal variant="section"`) inside the room's own `<workspace-layout>`.
                    Removed for good on the owner's instruction, 2026-09-30: *"stop building
                    react… finish the goddamn task."*

                    WHY IT CANNOT COME BACK. The rules this repository runs on say a surface is
                    an ADJACENCY LIST — "children come from the envelope's ID references, NEVER
                    from markup inside a component's own template" — and that the two kinds of
                    chat seat are never interchangeable: a HOST seat is mounted by the shell
                    outside a surface, a SURFACE seat is emitted inside the assembly and must
                    carry a conversation id. React regions appended to a shadow root's own child
                    list are neither: their `slot` attributes project nothing there (a shadow
                    root projects its LIGHT DOM, and those nodes were not it), so they were drawn
                    loose BENEATH the room. Measured on the live page: the layout at y = −129
                    with a 202px React block at y = 535 pushing the whole design up. The room's
                    panes are the assembled surface's and nothing else's.

                    The ingest tool itself is untouched and still opens from the left menu, which
                    is what a host mount is for.
                  */}
                  {/* ── THE ROOM SWITCH'S COVER — see `handoffCoverShown` in
                      `handleTabChangeWithGate`: it wears the TARGET room's own face, set
                      imperatively per switch (the lab tile for Development, the assembly
                      image for Product, the wave for Governance, the design sheet for
                      Design — measured 2026-10-16: the
                      tile is an OPAQUE purple sheet, avg RGB 64,54,79, so the old
                      "transparent grid" note here was wrong; the #2b2635 base below is only
                      what the active face sits on while its image decodes). The ring and the
                      sentence belong to Product and Governance ONLY — Development's cover is
                      bare ground: no spinner of ours may stand over that room. Shown
                      imperatively in the click's own frame; `display:none` by default, and
                      NOTHING here is ever driven by React state, on purpose: the cover must
                      exist in the click's own task, before any render runs. The JSX
                      backgroundImage below is only the pre-first-switch default
                      (Development's tile); every switch rewrites the face itself. */}
                  <div
                    id="room-handoff-cover"
                    aria-hidden="true"
                    style={{
                      position: 'absolute', inset: 0, zIndex: 60, display: 'none', pointerEvents: 'none',
                      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
                      backgroundColor: '#2b2635',
                      backgroundImage: `url(${developmentLabBackground})`, backgroundRepeat: 'repeat',
                    }}
                  >
                    {/* The ring and the sentence are Product's and Governance's; DEVELOPMENT
                        gets NEITHER. Text set imperatively per target; empty while hidden. */}
                    <div data-cover-ring aria-hidden="true" className="animate-spin" style={{ width: 26, height: 26, borderRadius: '50%', border: '3px solid rgba(240, 179, 35, 0.25)', borderTopColor: 'rgb(240, 179, 35)' }} />
                    <p style={{ color: '#c9c9c9', fontSize: 13, fontWeight: 500, fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif' }} />
                  </div>
                </div>
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
