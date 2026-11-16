/* THE DESIGN ROOM'S OWN SEAT — the console's conversation, and the seat the other room tabs draw.

   WHERE EACH THING LIVES:
     the frame         rooms/design/frame/chat-frame.ts — the five boxes, the bands, the pull, the
                       stop and the view slots. One copy for the whole Design section.
     the conversation  rooms/design/chat/conversation.ts — the list, the thread, the ownership
                       check, the move, selecting, removing, creating. THIS SEAT'S OWN COPY.
     the look          rooms/design/chat/design2-chat.styles.ts
     this file         what only this seat says: its greetings, its words, its scroll record.

   ITS LIST IS ALL OF DESIGN: the Chat tab reads the design tab packages and the kept design
   sessions — pre-filtered to Design. The whole system's conversations are not this seat's. A tab's
   own seat reads its package. */

/**
 * <design2-chat-panel> — GRACE'S SEAT, DRAWN BY THE SURFACE.
 *
 * The composer's right column, bound to the PACKAGE's conversation. It composes
 * the Figma pieces (chat-header, chat-messages, chat-input, chat-action-bar,
 * chat-footer) in its own shadow DOM — Schema ≠ Assembly: the catalog declares
 * one `ChatPanel`; this element assembles the rest.
 *
 * WHAT THIS WAS, AND WHY IT MATTERED
 * ─────────────────────────────────
 * A `<div data-tag="chat-panel">` holding a React chat. A div carrying a data attribute is not
 * a surface component: the catalog advertised `chat-panel` to the model, COMPOSITE_MAP
 * resolved it to this tag, and nothing defined it — so every composer assembly drew NOTHING in
 * the right column. The chat a person saw was a React sibling reading REACT PROPS, which is why
 * it did not reload when the surface reassembled.
 *
 * The server had already done its half. `render-session` loads the package's conversation
 * (`prompt_sessions.conversation_id` → `conversations`, whose `session_id` is NOT NULL) and
 * puts the messages in the data model:
 *
 *     /session/right_column/conversation_id
 *     /session/right_column/messages
 *
 * …and emits `chat-panel` with `conversationId: {"path": "/session/right_column/conversation_id"}`
 * (routes/ai.py). The history was travelling with the package all along. What was missing was
 * the element that reads it.
 *
 * THE SLOT CONTRACT — a bridge, not the destination
 * ────────────────────────────────────────────────
 *   - If the host puts a seat inside this element, that seat is what is DRAWN, and this element
 *     is its frame. Nothing is lost in the swap, and the seat is inside the surface's element
 *     rather than beside the surface.
 *   - If nothing is slotted, the element draws its own thread and composer, bound to the
 *     package's conversation, and reads the history itself when the surface did not supply it.
 * The React seat is slotted until the migration completes; this element's own pieces only draw
 * once the slot is empty.
 */
import { LitElement, html, nothing } from 'lit';
// The right column's pieces. Each import is a side effect that registers the tag,
// so <chat-panel> stays self-contained: composing these elements requires them to
// be defined before render, the same rule that forced the main.tsx import above. 
import { designChatStyles } from './design-chat.styles';
import { seatView } from './design-chat-seat/view';
import { connectSeat, disconnectSeat } from './design-chat-seat/events';
import { applySeatDefaults, conversationRowsForList, packageHasSomething } from './design-chat-seat/state';
import { ensureDefaultConversation } from './design-chat-seat/defaults';
import {
  adoptConversationAction,
  createConversationAction,
  loadDefaultConversationAction,
  selectConversationPress,
  startNewConversationPress,
  toggleConversationsPress,
  conversationsKeyPress,
  removeConversationPress,
  pickConversationPress,
  NEW_PROMPT_HELLO,
} from './design-chat-seat/actions';
import * as frame from './frame/chat-frame';
import * as conversation from './conversations';
import * as consoleConversation from './console-conversations';
import { CHAT_SLOT_TAGS } from './components';
import { railView } from '@design2/surface-design/surface/rail/view';
import { trayView } from './tray/view';
import { inputView } from './input/view';
import { conversationsView } from './conversations/view';
import {
  composerKeyAction,
  draftInputAction,
  messageSentAction,
  productPasteAction,
  sendAction,
  stopAction,
  type InputActionHost,
} from './input/actions';
import {
  conversationsKeyAction,
  newConversationAction,
  pickConversationAction,
  removeConversationAction,
  selectConversationAction,
  toggleConversationsAction,
  type ConversationsActionHost,
} from './conversations/actions';
import { outputWindowAction, type OutputWindowHost } from './frame/actions/output-window';
import { sessionsLaneClearAction, type SessionsLaneHost } from './thread/actions/sessions-lane-clear';
import { tabChangeAction, type RailTabHost } from '@design2/surface-design/surface/rail/actions/tab-change';
import { replyAction, type ReplyActionHost } from './thread/actions/reply';
import { threadView, type ThreadHost } from './thread/view';
import { hasResultTurns, threadOf, type ThreadDataHost } from './thread/data';
import {
  graceStatusAction,
  hostAskAction,
  hostSayAction,
  writeFailedAction,
  type HostTurnHost,
} from './thread/turn/host';
import './readout/output-header';
import './parts/design-chat-fold';
import './parts/design-chat-header';
import './parts/design-chat-messages';
import './parts/design-small-dropdown';
import './parts/design-chat-input';
import './parts/design-chat-footer';
import './parts/design-user-response-bubble';
import './parts/design-chat-action-bar';
import './left/repair-actions';
import historyIcon from '@/assets/figma-chat-history-icon.svg';
// THE READOUT'S MODEL MARK, handed in by the instance that draws it: the file's own node is
// #40001124:7096 and its size moved to 20 in the drawing (2026-09-20).
import readoutModelMark from '@/assets/figma-readout-model-mark.svg';
import './parts/design-chat-plugin-tray';
import './parts/design-chat-product-tools';
import './parts/design-chat-product-thread';
import './parts/design-error-banner';
import '@design2/surface-design/surface/rail/navigation-bar';
import './parts/design-sessions-feed';
import './parts/design-prompt-textarea';
import logoAsset from '@/components/lit/assets/chat-logo-carbon.svg';
// The app's own logger. A turn warning from the server is written here as well as drawn in
// the thread: the Trace tab reads this logger (lib/trace-source subscribes to it), and the
// owner asked for exactly that — "we need to report it in the console trace" (2026-09-18).
import { logger } from '@/lib/logger';
import { stepsDone } from '@/shared/buttonState';
// Grace's surface commands. A reply that carries XML tags drives the surface the
// same way the React seat did — through window CustomEvents and the event bus.
import { eventBus } from '@/shared/event-bus';
import {
  parseWriteSeatAction,
  parseWriteToolAction,
  parseDescriptionAction,
  parseMergeSeatAction,
  parseMoveToolAction,
  parseSetSeatAction,
  parseRemoveSeatAction,
  parseRunAction,
  parseSaveAction,
  parseSetTitleAction,
  parseBuildWireframeAction,
  parseEditNodeAction,
  requestForAction,
  HER_ANSWERS,
  NO_ADVICE,
  FIX_ALL,
} from '@/shared/actionLink';
import { arrivalIsFor, consumeArrival, type Arrival, type ArrivalKind } from '@/shared/arrival';
import { markSectionTaught, sectionTaught } from '@/shared/sectionTeaching';
import { autoAdviceOn, declineAutoAdvice } from '@/shared/autoAdvice';
// The app's one "when" — the same format the Evals feed shows for a run. See shared/when.
import { formatWhen } from '@/shared/when';
import { resultsAreTheReading } from '@/shared/chatScroll';
import { isDemoMode } from '@/shared/appConfig';
import { getStoredUserId } from '@/services/authService';
// THE SEAT'S OWN OBSERVABILITY — the application tags itself. The door records element facts
// against catalogue tags and surface facts in their own table; nothing here reads a message.
import { uxCapture, uxCaptureSurfaceOpen } from '@/shared/uxCapture';
import { create, listForPackage, pointPackageAt, remove, type ConversationRow } from '@/shared/conversations';

interface SeatMessage {
  role?: string;
  content?: string;
  /** Which canvas node the turn is about, when it is about one — passed through, never
   *  invented here. See <design2-chat-messages>. */
  nodeId?: string;
  /** The turn's small note (what part of the flow it is). */
  label?: string;
  /** An alert rather than a remark — a held Run that will not go. See <design2-chat-messages>. */
  alert?: boolean;
  /** A run's result, drawn as output (rich text, 14px). See <design2-chat-messages>. */
  result?: boolean;
  /**
   * THE ENGINE'S OWN MESSAGE VOCABULARY (2026-10-06) — the Product room's port of the
   * app builder's thread groups by this: `regular` (the person's prompt), `starting` /
   * `building` (a run's steps), `finished` (the completed card), `error` (stops and
   * failures). Carried through from the bridge; other rooms never set it.
   */
  messageType?: string | null;
}

/**
 * The trace button's `AI:` line, verbatim from Figma "trace-button" state=Default.
 * Clicking Trace is a PROMPT: the reply renders in this thread like any answer.
 */
const TRACE_PROMPT =
  'Load the latest activity and report tokens, cost, latency and evaluation for this session.';

/**
 * THE WAY OUT, ASKED FOR IN EVERY ADVISORY TURN.
 *
 * A suggestion you do not want is a suggestion you have to get past. Every turn where
 * she offers something ends with this button, and the app handles it: pressed, the
 * offer is withdrawn and nothing is sent — no model call to be told "understood", no
 * three seconds spent dismissing a sentence.
 *
 * ONE LINE, USED IN BOTH ADVISORY REQUESTS, so the button reads the same wherever it
 * appears and a change to it cannot land in one turn and miss the other.
 */
const OFFER_THE_WAY_OUT =
  'Finish with one more button, exactly [No thanks](action:no-advice), so they can '
  + 'dismiss what you offered and carry on without answering you.';

/**
 * THE NEW-PROMPT HELLO — ONE INSTRUCTION, TWO DOORS.
 *
 * A person meets a prompt with nothing in it in two ways: a blank composer, and a package
 * whose seats are empty and whose conversations have all been deleted. What she should do is
 * the same for both — introduce herself and ask what they want to work on — so the
 * instruction is written once here and each door supplies its own first sentence, because the
 * two situations are not the same situation and a prompt that says "blank composer" over an
 * open package is the app talking about the wrong room.
 *
 * NO OFFER, AND SO NO WAY OUT. A "No thanks" on a turn that offered nothing is a door out of
 * a room with no walls (the owner, 2026-09-28: "You've got the no thanks at the beginning…
 * she doesn't make a suggestion on an empty composer").
 */

/**
 * ONE SESSION ROW, AS THE LANE RETURNS IT.
 *
 * The route sends these keys (`backend/governance_lanes.py` → `execute`); the feed draws the
 * same seven it draws for its own read, plus the token/cost/duration figures a query may have
 * filtered on. Typed here because the seat hands them straight to <design2-sessions-feed>; the shape
 * is the route's, not ours to invent.
 */
interface SessionsLaneRow {
  session: string;
  events: number;
  traces: number;
  firstSeen: string;
  lastSeen: string;
  users: string[];
  cost: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  inputCost?: number;
  outputCost?: number;
  durationSeconds?: number;
}

export class DesignChatSeat extends LitElement {
  static properties = {
    /**
     * WHICH CONVERSATION FILE THIS SEAT READS. `seat` is the room's standing seat: its own
     * conversation module, and the chat package when the chat tab stands. `console` is the Chat
     * tab's page: the console's conversation module and the console's package, always. The two
     * pages are otherwise one seat, and this property is the only difference between them.
     */
    conversationSource: { type: String, attribute: 'conversation-source' },
    conversationId: { type: String, attribute: 'conversation-id' },
    /** THE SURFACE'S DATA, INJECTED BY THE ROOM (owner, 2026-11-07: the shell is a container;
     *  the seat's own file decides what the data means). The tab's package is read from here. */
    dataModel: { type: Object },
    /** The four tabs' package records, injected as data by the container. */
    designPackages: { type: Object },
    /**
     * WHO SHE IS IN THE ROOM THAT BINDS THIS — declared as a Lit property, and that is load-bearing:
     * the renderer sets its props BEFORE the element upgrades, and Lit only carries an assigned value
     * across the upgrade for a property it has been TOLD about. As a plain class field the
     * initializer overwrote the surface's value on upgrade, so the seat fell back to the composer's
     * script — measured: `instructions` read empty in the running room while the binding was present
     * in the tree.
     */
    instructions: { type: String },
    messages: { type: Array },
    sessionId: { type: String, attribute: 'session-id' },
    /**
     * THE PACKAGE'S OWN NAME AND DESCRIPTION, bound by the host from the surface.
     *
     * Both are requirements she is asked to judge before a Run, so both must be readable here.
     * Measured 2026-09-23: the description HAD been written and she went on saying the package
     * had none — she had no source for the claim, so she guessed, and her guess came from a
     * review request that had said "(none)" minutes earlier. A fact she is asked about has to
     * be a fact she is given.
     */
    packageTitle: { type: String, attribute: 'package-title' },
    packageDescription: { type: String, attribute: 'package-description' },
    /** The "Analyzing: Session 222 | …" status line, host-fed. Empty hides the bar. */
    statusText: { type: String, attribute: 'status-text' },
    /** The header's four status slots, relayed to <design2-chat-header>. */
    status: { type: String, attribute: 'status' },
    sessionLabel: { type: String, attribute: 'session-label' },
    sessionName: { type: String, attribute: 'session-name' },
    duration: { type: String, attribute: 'duration' },
    qaScore: { type: String, attribute: 'qa-score' },
    /** Token/cost tallies for <design2-chat-footer>, fed by the host's a2ui:usage listener. */
    usage: { type: Object },
    /** Persisted left-column JSON — fallback when no live section callback is set. */
    leftColumnContent: { type: Object, attribute: 'left-column-content' },
    /** The compiled Run output in the middle column, for Grace's workspace context. */
    compiledOutput: { type: String, attribute: 'compiled-output' },
    /** The console's prompt packages, for Grace's workspace context. */
    consoleCards: { type: Array },
    /** Open catalog findings, for Grace's workspace context. */
    catalogFindings: { type: Array },
    /** Component ids carrying an open annotation finding — draws the red banner. */
    unannotatedInUse: { type: Array },
    /** Label on the Models button in the action bar. */
    modelLabel: { type: String, attribute: 'model-label' },
    /** The package's conversations, fed by the host — the selector's list. */
    conversations: { type: Array },
    /** The input area's dragged height, px. 0 = auto. Reactive — the gripper's
        drag writes this and the template re-renders chat-input with it. */
    inputHeight: { type: Number },
    /** The rail's active view. Driven by the rail's `tab-change`, not by the host. */
    activeTab: { type: String, attribute: 'active-tab' },
    /**
     * THE ROOM OWNS THE RAIL (owner, 2026-10-25): *"these chats are not global. They're specific
     * to the tab you're on."* When the host sets this, a rail press announces `tab-change` and
     * moves NOTHING inside this seat — no view switch, no conversation switch, no thread cleared.
     * The room shows the container that belongs to the pressed tab, and each container's chat is
     * its own (THE_CONVERSATION_CONTRACT §1: a conversation belongs to a package AND to one tab).
     * Unset, the seat behaves exactly as before, so every other room is untouched.
     */
    railOwnedByHost: { type: Boolean, attribute: 'rail-owned-by-host' },
    /**
     * True when the chat column is collapsed to its rail — the design's
     * chat-button state=Selected, clicked again.
     *
     * And it is passed DOWN to the rail, which matters more than it looks: when a
     * HOST owns the column's width (the console's shell does), the rail's own
     * collapsed flag is never set by the host, so it drifts out of sync with the
     * real column. Its click logic then reads "already collapsed → expand" against
     * a flag that says false, and the first click on the Chat tab COLLAPSES
     * instead of opening — one click too many to get the chat back. The old React
     * seat documented exactly this and fixed it the same way.
     */
    collapsed: { type: Boolean, reflect: true },
    /** Which rail buttons this surface may show, comma-separated. The rail is
        surface-dependent: Chat/Trace/Versions on both, Tools in the composer,
        Approvals on the console. Empty shows them all (dev default). */
    allowedTabs: { type: String, attribute: 'allowed-tabs' },
    /**
     * The room's own words for the rail's buttons, passed through untouched to
     * `<design2-chat-navigation-bar>`'s `tab-labels` (a JSON map id→{label,tooltip}; see the
     * rail for the shape). Ids are the stable key, labels are presentation — a room
     * that means something else by a shared id says so here instead of renaming a
     * button every other room is using. The seat itself never parses it.
     */
    tabLabels: { type: String, attribute: 'tab-labels' },
    /** The room's rail list of deactivated tabs — relayed to <design2-chat-navigation-bar>. See there. */
    disabledTabs: { type: String, attribute: 'disabled-tabs' },
    /**
     * THE GOVERNANCE ROOM'S SELECTED TRACE — her own eyes on the program beside her.
     *
     * Governance is a room the person works THROUGH (the trace list, the tree, the
     * preview), and her turns are about what is on that screen. The room states the
     * facts: the shell reads the selected trace (lib/governance-trace-source.ts) and
     * writes the SUMMARY here and the selected NODE as `governanceObservation`. Both
     * draw a line in her context only when `graceLiveContext` is true — the same switch
     * every other room's facts ride — and ONLY when written: a room with no selection
     * says nothing about a trace. DEDICATED PROPS, never dressed into
     * `leftColumnContent`/`compiledOutput` (those render and mean the composer's
     * areas; see the seat-binding comments in the shell).
     */
    governanceTrace: { type: Object },
    /** The node the person has selected within that trace — same channel. See above. */
    governanceObservation: { type: Object },
    /**
     * THE TRACE'S PROMPT PACKAGE — resolved by the shell (on a Composer run the trace's
     * Langfuse session IS the package's session id) and written only when a package
     * exists; the action bar then offers Open in Composer (see chat-action-bar).
     * Empty = no package for this trace — no button, no dead control.
     */
    composerPackageId: { type: String, attribute: 'composer-package-id' },
    /**
     * Whether the rail's Trace tab SENDS its prompt when clicked.
     *
     * The prompt asks for tokens, cost, latency and evaluation — properties of a
     * prompt PACKAGE's run. The composer's seat is a package, so the question is
     * answerable there. The console's seat is not: it operates on cards, has no
     * run, and the model refuses every time, so each Trace click wrote a canned
     * question and a canned refusal into the console's conversation. Measured
     * 2026-09-17: the console conversation held nothing else — 8 prompt copies
     * and 8 refusals, and nothing more.
     *
     * The view still switches; only the automatic question is suppressed. The
     * surface says which it is, because nothing in the payload distinguishes the
     * two seats — both carry a conversationId and a sessionId.
     */
    tracePrompt: { type: Boolean, attribute: 'trace-prompt' },
    /**
     * WHETHER THIS SEAT'S LIVE WORKSPACE FOLLOWS THE ROOM'S WORDS.
     *
     * The room states it, like `tracePrompt` above and for the same reason: nothing in the payload
     * distinguishes one seat from another, so the surface is the only thing that knows what the words
     * it bound are FOR. A composer's script is an identity — she is a prompt engineer and the package
     * on screen is her material — so its live facts (the package, its seats, the tool register) ride
     * after it. The design room's script is composed with its live facts already inside it, read from
     * the database on every assembly, so nothing follows it; appending the package shape there would
     * put "name: <catalogue>" over a room that has no package.
     *
     * UNDEFINED IS NOT FALSE, and it is not "false by default" either: a surface that does not state
     * this has not been examined, and `_gracePrompt` refuses the turn and says so rather than deciding
     * for it — see there. Set by `_seat_grace` in routes/ai.py, never by a model.
     */
    graceLiveContext: { type: Boolean, attribute: 'grace-live-context' },
    /**
     * THE PRODUCT ROOM'S FOOT — THE APPLICATION'S OWN TOOLS (owner, 2026-10-06: *"all of
     * these stubs go. And you're gonna put the products wiring down"*). TRUE swaps the
     * v.4b tray for <design2-chat-product-tools> — the builder's own attach · Figma · GitHub ·
     * visual-edit row — and lets the seat forward ⌘V files. Set ONLY by the product
     * room's binding: every other seat keeps the tray, untouched.
     */
    productTools: { type: Boolean, attribute: 'product-tools' },
    /**
     * SEE `_evalsDrawsThread` — a room whose Evals carry her talk (the conversation) instead
     * of a feed, until a feed exists. Set by the room's own binding; never by anyone else.
     */
    evalsTalk: { type: Boolean, attribute: 'evals-talk' },
    /**
     * THE PRODUCT ROOM'S MARKER — AND ITS NO-FALLBACK RULE (owner, 2026-10-06, after the engine
     * died under the room and the seat fell back to the v.4b tray: *"no fallbacks in this
     * application … I want all of the fallbacks all the dumb shit out … I would rather it just
     * be a blank page than have a fallback."*). The room sets this where its column opens; while
     * it is set and `productTools` has not landed, the seat draws NOTHING (the guard in
     * `render`). It is structural, not cosmetic: this element's default face is every OTHER
     * seat's real UI — the v.4b tray at the foot (the catalog's own five marks) and the old
     * messages list — and a seat whose product binding never arrived must go BLANK, never wear
     * another room's face. Set ONLY by the product room; every other seat never sets it and
     * renders exactly as before.
     */
    productRoom: { type: Boolean, attribute: 'product-room' },
    /** The builder's connection facts, mirrored from its own `ids:tool-state` messages — the foot's dots. */
    productFigmaConnected: { type: Boolean, attribute: 'product-figma-connected' },
    productGithubConnected: { type: Boolean, attribute: 'product-github-connected' },
    /** The visual editor's own state, mirrored the same way — the pencil's pressed state. */
    productVisualEditActive: { type: Boolean, attribute: 'product-visual-edit-active' },
    /** A run is in flight — the product thread draws the app's building row while it is. */
    productRunning: { type: Boolean, attribute: 'product-running' },
    /** When the in-flight run started (ms) — the app's own run clock, host-fed. */
    productRunStartedAt: { type: Number, attribute: 'product-run-started-at' },
    /** The engine's estimate for the in-flight run, whole minutes (`agent/status.expectedMinutes`) —
     * the app's bar fills against it; 0 means none, and the fixed ladder applies. */
    productExpectedMinutes: { type: Number, attribute: 'product-expected-minutes' },
  };

  // `declare` — NOT a class field. With `useDefineForClassFields` true, a plain field
  // here overwrites Lit's accessor and the element never draws (the blank right column
  // this file once was). Every element in this repo declares properties this way.
  /** The package's conversation. Bound from /session/right_column/conversation_id. */
  declare conversationId?: string;
  /** The surface's data, injected by the room. The seat resolves its own package from it. */
  declare dataModel: Record<string, any> | undefined;
  /** The four tabs' package records, injected as data by the container. */
  declare designPackages: Record<string, { packageId?: string; conversationId?: string }> | undefined;
  /** The package's history, as the server loaded it. Bound from /session/right_column/messages. */
  declare messages: SeatMessage[];
  /** See the `productTools` note in `static properties` — the product room's binding alone. */
  declare productTools: boolean;
  /** See the `evalsTalk` note in `static properties` — the room's own binding alone. */
  declare evalsTalk: boolean;
  /** See the `productRoom` note in `static properties` — blank until the product binding lands. */
  declare productRoom: boolean;
  declare productFigmaConnected: boolean;
  declare productGithubConnected: boolean;
  declare productVisualEditActive: boolean;
  declare productRunning: boolean;
  declare productRunStartedAt: number;
  declare productExpectedMinutes: number;
  /**
   * THE GOVERNANCE REPORTS, TAKEN OUT OF THE THREAD. The inspector files a report into this
   * conversation with metadata kind='inspection'; the owner, 2026-09-19: they belong "under
   * approvals… not under chat". Loaded with the history, drawn under the Approvals tab.
   */
  private _inspectionReports: SeatMessage[] = [];
  /** The Approvals and Trace folds — the catalog check's treatment (header, count,
      chevron), but they arrive OPEN: the content is fed and visible as it always was, and
      the header is there to fold it away, not to hide it (owner, 2026-09-19). */
  private _approvalsOpen = true;
  private _traceOpen = true;
  /**
   * THE CONVERSATIONS DROPDOWN — OFF, NOT GONE. The owner, 2026-09-19: "get that drop-down
   * out of the top… we'll rewire everything later, don't remove any capabilities, but we can
   * just unhook them or disable them, comment them out so that they're still there."
   *
   * v.4b draws no dropdown here (the bar above it is the drawing; the selector is not), and
   * the plan is that conversations open from the FOOTER's own mark — the "chat history" icon
   * #40001119:6622, drawn — so this is the switch, not a deletion: flip it to true and the
   * block below renders exactly what it always did.
   *
   * NOTHING IT NEEDS WAS CUT. The `conversations` list, `_conversationItems()`,
   * `_pickConversation()` and the `conversation-select` listener on the output wrapper are
   * all still here and still live, so re-hooking it is this one flag (or moving the block
   * under the footer's mark) and nothing else.
   */
  private _conversationsTopSlot = false;
  /**
   * THE DRAWN SCROLLBAR — the small thumb that rides over the output region's right edge
   * (owner, 2026-09-19: "put a scroll feature inside of the chat panel, just a very small
   * little tiny scroll on the right hand side… it can be on top of and over the bubbles").
   *
   * These three are its state, and `_railVisible` doubles as the switch: false draws no
   * rail at all, so a region whose content fits shows nothing rather than an empty track.
   * `_syncScrollThumb()` is the only writer, and it writes only on a real change —
   * a redraw per scroll frame would be a render loop.
   */
  private _railVisible = false;
  private _thumbH = 0;
  private _thumbTop = 0;
  /**
   * THE DRAWN SCROLLBAR IS OFF — the wheel is the bar.
   *
   * The owner, 2026-09-19: "you don't really need a scroll bar for now, I can just use my
   * roller on my mouse to move it up and down." So the rail is not drawn; the conversation
   * still scrolls (the card's body carries overflow-y auto, and a hidden native bar does not
   * stop the wheel), and the thread still opens at its newest turn.
   *
   * OFF, NOT GONE, and the mechanism is still wired and still tested: _syncScrollThumb keeps
   * measuring, and the four tests in chatPanelScrollbar.test.ts drive it with this flipped on.
   * Turn it back on when the design wants a bar drawn again — nothing else has to change.
   */
  private _showScrollBar = false;
  /** The scroller's own numbers, carried for the thumb's aria-valuenow/max. */
  private _scrollPos = 0;
  private _scrollMax = 0;
  /**
   * HOW MANY CONVERSATIONS THIS SEAT'S PACKAGE HAS, archived ones included — read from the
   * server, not counted off the surface's list.
   *
   * The owner, 2026-09-19: "when I clicked new chat it created a new chat but I should've
   * seen that count go up… can you tie the conversation count to that?" The bar counted
   * `conversations`, which is the SURFACE's array: it is as fresh as the last assembly, so
   * the count could not move when this seat created or archived one. And the surface's list
   * carries ACTIVE rows only, while what the owner counts is the package's conversations
   * (the archived one is exactly what he asked to keep "into the conversations list").
   *
   * `session_id` is the package's own column — the read the console's assembly itself uses —
   * with archived rows included. Until it is read (or if it cannot be), the bar falls back
   * to the surface's list length, which is real data too, just staler.
   */
  private _conversationRows: Array<{ id: string; title: string; tab: string; archived: boolean; savedAt: string; messageCount: number }> | null = null;
  /**
   * HAS THIS PACKAGE'S CONVERSATION LIST BEEN READ YET?
   *
   * "This package has no conversation" is a claim about the SERVER's list, and an unread list is
   * not an empty one. Without this the seat drew the conclusion from a null list the moment it
   * learned which package it was — before the read came back — and greeted a package whose
   * conversations were sitting right there, results and all. Measured 2026-09-24 while the owner
   * watched it: the seat fetched the run's history, nobody pressed anything, and a silent turn
   * still went out into the results conversation.
   */
  private _conversationsRead = false;
  /**
   * A conversation id the HOST handed this seat, trusted over the seat's own list.
   *
   * `adoptConversation` is how a Run's results arrive: the backend files them in a
   * conversation it created THIS turn, so the seat's cached list — read before the run
   * — cannot contain it yet, and the belongs-check would refuse the very thread it is
   * being handed (measured 2026-09-24: the run ran, the results were filed, and the
   * seat never read them — the screen said nothing happened). The host's word is the
   * authority for the one move; the list is re-read alongside it so every later turn
   * passes the check against a list that now contains the row. Cleared the moment the
   * seat moves to any OTHER conversation, so the trust never outlives the handover.
   */
  private _adoptedByHost = '';
  /** A conversation is being created for this package right now — see _startNewConversation. */
  private _creatingConversation = false;
  /**
   * THIS SEAT HAS ALREADY GIVEN THIS PACKAGE ITS FIRST CONVERSATION.
   *
   * The load-time creation below is triggered by a render, and renders are many; the latch in
   * _startNewConversation stops two at once, and this stops a FAILED create from being retried on
   * every frame — one attempt per package, and the foot's add mark is the person's own way to ask
   * again. Cleared when the seat moves to another package (see _enterPackage).
   */
  private _conversationEnsured = false;
  /**
   * A PRESS OF THE CHAT TAB ASKS FOR THE PACKAGE'S DEFAULT THREAD — the Tools seat's own latch
   * (owner, 2026-11-07). The press usually lands before the seat knows its package, so the
   * request waits for `sessionId` and `updated` asks again.
   */
  private _wantsDefaultConversation = false;
  /**
   * THE PACKAGE WHOSE DEFAULT THREAD THIS SEAT HAS ALREADY ASKED FOR — asked on the first load
   * and on every new package, so the page does not need a second press to open what it lands on.
   */
  private _defaultOpenAsked = '';
  /**
   * THE DEFAULT OPEN IS STILL READING OR PLACING — the window in which Grace must not speak on
   * her own. Creation is in flight through `_creatingConversation`; this covers the read before it.
   */
  private _openingDefault = false;
  /** Whether the leading bar's conversation list is open. */
  private _conversationsOpen = false;
  /**
   * Whether this seat is the console's — read from its session row's own metadata, and what
   * decides which way the trailing button points (see chat-action-bar's `trailing`). Null
   * until read, and the drawing's default stands until it is.
   */
  private _seatIsConsole: boolean | null = null;
  /** The row whose trash is armed (first click); a second click removes it. */
  /**
   * SHE HAS SOMETHING TO SAY AND HER COLUMN IS FOLDED AWAY — the rail's slow pulse.
   *
   * The owner, 2026-09-23: "I want the chat icon to flash slowly when there is a message that
   * Grace has and then the user can choose to open it and read it or ignore it." Nothing opens
   * her to say so: not a turn of hers, and not a node picked on the drawing (which used to
   * bring the column back at her width and take the room out from under the canvas).
   *
   * TWO THINGS COUNT, and both are changes to what this column would show if it were open:
   * a new turn in the thread, and a new status line — which is what the host writes when a
   * person picks a node, so the pick is answered by the pulse rather than by the column.
   * Looking at her clears it.
   */
  private _unread = false;
  /**
   * THE APPROVE RAIL'S SIGNAL (owner, 2026-11-03): a pending approval or a request in the queue
   * pulses the Approve icon, the same pulse the chat icon carries when she has something to say.
   */
  private _approvalWaiting = false;
  /** The thread length and status line last SEEN, so "new" is a change and not a state. */
  private _seenTurns = -1;
  private _seenStatus: string | null = null;

  private _noticeWhileAway(): void {
    const turns = (this.messages?.length ?? 0) + this._local.length;
    const status = this.statusText ?? '';
    const seen = this._seenTurns >= 0;
    const grew = seen && turns > this._seenTurns;
    const said = seen && Boolean(status) && status !== this._seenStatus;
    this._seenTurns = turns;
    this._seenStatus = status;
    if (this.collapsed && (grew || said)) {
      if (!this._unread) {
        this._unread = true;
        this.requestUpdate();
      }
      return;
    }
    // OPENED IS READ: the column on screen is the message delivered.
    if (!this.collapsed && this._unread) {
      this._unread = false;
      this.requestUpdate();
    }
  }

  /**
   * A COMMAND TO THE APP, IN THE SHAPE THE GATEKEEPER ACTUALLY VALIDATES.
   *
   * `eventBus.emit` runs `validateTag` first, and that reads `command.tag` — so a shorthand like
   * `{ command: 'save-button' }` is BLOCKED as "Unknown tag: undefined" and the handler never
   * runs. Both of this panel's save paths sent exactly that shorthand, which is why a person could
   * press Save — on her own control or on the button she offered — and nothing was written
   * (measured 2026-09-23).
   *
   * AND THE PROPS ARE THE REGISTRY'S, not empty: a prop with a `default` is still REQUIRED by this
   * gate (it checks presence, not fallbacks), so `save-button` must carry `state` and `label` or
   * the command is refused for missing them. Sending the declared defaults is the honest form —
   * they are what the command means at dispatch.
   */
  private _emitCommand(tag: string, props: Record<string, unknown> = {}): void {
    eventBus.emit({
      tag,
      sessionId: String(this.sessionId ?? ''),
      command: tag,
      timestamp: new Date().toISOString(),
      props,
    } as never);
  }

  private _armedDelete: string | null = null;
  /** Auto-disarm, so an armed trash never stays armed behind a person's back. */
  private _deleteTimer: ReturnType<typeof setTimeout> | null = null;
  /** A refusal or a failure about the list, said where the list is (never swallowed). */
  private _listNote = '';
  /** Watches the scroller's children so a growing thread moves the thumb without a render. */
  private _outputRO: ResizeObserver | null = null;
  /** The conversation file this seat reads — see the property above. */
  declare conversationSource: 'console' | 'seat';

  /*
   * THE SEND AND REPLY ACTIONS ARE ATTACHED, NOT WRAPPED. `connectSeat` puts these on the element
   * from `./send` and `./replies`; a one-line member here would be a third name for the same
   * function and a second place to keep in step. They are declared here so the seat's own methods
   * and its template can call them with the seat's types.
   */
  declare _send: (text: string, opts?: { silent?: boolean; asked?: boolean }) => Promise<void>;
  declare _processReply: (content: string) => string;
  declare _withdrawOffer: () => void;
  declare _onSendCommand: () => void;
  declare _onActionSend: (e: Event) => void;

  /* THE DERIVED VALUES LIVE IN `./design-chat-seat/state.ts` AND ARE ATTACHED BY `connectSeat`. */
  declare _conversationRowsForList: () => unknown;
  declare _packageHasSomething: () => boolean;
  /** The prompt package. Bound by the host from the surface's session id. */
  declare sessionId?: string;
  /** The package's name and its one-line description — see the properties block. */
  declare packageTitle?: string;
  declare packageDescription?: string;
  /** The "Analyzing: Session 222 | …" line. Empty hides the status bar. */
  declare statusText: string;
  /** The header's four status slots. */
  declare status: string;
  declare sessionLabel: string;
  declare sessionName: string;
  declare duration: string;
  declare qaScore: string;
  /** Token/cost tallies shown in <design2-chat-footer>. */
  declare usage: Record<string, any> | undefined;
  /** Persisted left-column JSON. */
  /**
   * The left column, as the seat beside it sees it: the LIVE sections array
   * (`/session/left_column/sections` — the same path the editor binds and the host writes on
   * every keystroke), or the persisted JSON string when a caller hands it that instead.
   *
   * It was the persisted copy alone (`raw_content`, what the package was SAVED with), which
   * meant she read yesterday's column: type a line into a seat, ask her about it, and the
   * question was answered against text that no longer existed. Two paths held one fact and
   * the seat had the stale one.
   */
  declare leftColumnContent: string | any[];
  /** The compiled Run output in the middle column. */
  declare compiledOutput: string;
  /** The console's prompt packages. */
  declare consoleCards: Array<Record<string, unknown>>;
  /** Open catalog findings. */
  declare catalogFindings: Array<Record<string, unknown>>;
  /** Component ids with an open annotation finding. */
  declare unannotatedInUse: string[];
  /** Label on the Models button. */
  declare modelLabel: string;
  /** The package's conversations. */
  declare conversations: Array<{ id?: string; title?: string; tab?: string }>;
  /** The input area's dragged height, px. 0 = auto. */
  declare inputHeight: number;
  /** The rail's active view. */
  declare activeTab: string;
  /** The room owns the rail: a press is navigation for the room, never a switch inside this seat. */
  declare railOwnedByHost: boolean;
  /** True when the chat column is collapsed to its rail. */
  declare collapsed: boolean;
  /** Comma-separated rail buttons this surface may show. */
  declare allowedTabs: string;
  /** The room's label overrides for the rail, JSON, passed through. See the property. */
  declare tabLabels: string;
  /** Comma-separated rail tab ids the room has deactivated (relayed to the rail). */
  declare disabledTabs: string;
  /** The trace facts the governance room writes — see the property above. */
  declare governanceTrace: Record<string, unknown> | undefined;
  /** The selected node within that trace — see above. */
  declare governanceObservation: Record<string, unknown> | undefined;
  /** The trace's resolved prompt package — see the property above. */
  declare composerPackageId: string;
  /** Whether the rail's Trace tab sends its prompt. See the property above. */
  declare tracePrompt: boolean;
  /**
   * Whether the seat appends its live workspace after the room's words — `undefined` when the
   * surface never said, which `_gracePrompt` treats as a defect rather than as a default. See the
   * property declaration for why undefined is a distinct third state.
   */
  declare graceLiveContext: boolean | undefined;
  /**
   * THIS ROOM'S WORDS, bound by the assembly that drew the surface — her identity here, stated by
   * the room and never by this element. See `_gracePrompt` for where they come from, what follows
   * them, and what happens when a room states none.
   *
   * DECLARED AND NEVER INITIALIZED — a `declare` is erased at compile time, so Lit's own accessor
   * (from `static properties`) is the only thing that owns this name. It was a plain class field
   * with an empty-string initializer when this file still carried a script of its own, and under
   * `useDefineForClassFields` that field SHADOWED the accessor: the surface's words landed on a
   * property nobody read, and the seat fell back to the compiler's copy instead. The note on the
   * property declaration above says the same thing about the same name.
   */
  declare instructions: string;

  constructor() {
    super();
    /* THE OPENING VALUES LIVE IN `./design-chat-seat/state.ts`. */
    applySeatDefaults(this);
    /*
     * THE DERIVED READERS ARE PUT ON THE ELEMENT HERE, NOT AT CONNECTION. The shell asks a fresh
     * Chat seat for its default conversation BEFORE it appends the element to the page, and that
     * path reads `_packageHasSomething`; attached at connection, the call would land on a missing
     * function and the seat would open no thread.
     */
    this._conversationRowsForList = () => conversationRowsForList(this);
    this._packageHasSomething = () => packageHasSomething(this);
  }

  private _sending = false;

  /**
   * THE WORK CARD'S STATE (2026-10-03, late — the owner, on this seat: *"the chat seems
   * underwhelming to me. It's not very performative. It'll need to be for this vibecoding
   * interface because that's their main experience is the chat room"*). `_workActive` spans the
   * WHOLE turn — her reply AND, in a room whose host builds, the page-build that follows it —
   * and `_workStage` names what is happening ('thinking' until the host says 'building' via
   * `a2ui:grace-status`). The card itself (shimmer, elapsed time, collapse) is <design2-chat-messages>'
   * own, ported from AI Elements' <Reasoning> (MIT; see frontend/ai-elements/README.md); these
   * two fields plus the timer are the seat's facts.
   */
  private _workActive = false;
  private _workStage = '';
  private _workTimer: number | null = null;
  /**
   * THE NEXT REPLY OFFERS AND DOES NOT WRITE. Set when the panel asks her a
   * question on its own behalf (a seat was chosen — offer what could go in it) and
   * read once by _processReply. Until the person presses one of her buttons,
   * nothing belongs in the prompt.
   */
  private _offerOnly = false;
  /**
   * THE ARRIVAL GREETING'S BOOKKEEPING. `_historyChecked` says the thread has been
   * read or found absent, so "no turns" is a fact rather than a not-yet; `_greeted`
   * makes the greeting happen once per seat, however many times this element
   * re-renders.
   */
  private _historyChecked = false;
  private _greeted = false;
  /**
   * THE TOOLS THAT EXIST, fetched once for the workspace context. Undefined until the
   * fetch answers; empty means the table is empty, which is a different thing and is
   * said rather than shown as "none".
   */
  private _tools: Array<{ name: string; summary: string; canRun: boolean }> | undefined = undefined;
  /**
   * WHETHER SHE VOLUNTEERS. Read from shared/autoAdvice rather than held here,
   * because the seat is created once per package and this has to survive one — see
   * that module for why. "No thanks" is what turns it off.
   */  /** A surface opened, for a seat that may have been created by that same commit. */
  private _wantsGreeting: ArrivalKind | '' = '';
  /** Turns spoken since this element mounted; the surface supplies everything before that. */
  private _local: SeatMessage[] = [];
  /**
   * Turns that were answered while this seat had NO conversation to write them into.
   *
   * The backend refuses them by design — "this turn will not be persisted", because
   * `conversations.session_id` is NOT NULL and a package that does not exist yet has no
   * row to attach them to. They live here until `flushPendingTurns` hands them to the
   * conversation the first Save creates.
   */
  private _pending: SeatMessage[] = [];
  /**
   * WHICH PACKAGE THE PENDING TURNS WERE SPOKEN IN — null when they were spoken before any
   * package existed (a fresh composer), which is the case `flushPendingTurns` is for.
   * A turn belongs to the conversation it was spoken in; this is what lets the seat refuse
   * to write one package's words into another package's thread.
   */
  private _pendingOwner: string | null = null;
  /** The package this seat was last told it belongs to — the measure of a package CHANGE. */
  private _sessionHeld: string | null = null;
  /** A failed history read, in words the person can see — never an empty thread that says nothing. */
  private _historyError = '';
  /** The slotted input's draft, and the in-flight request's abort handle. */
  private _draft = '';
  /* ── THE SESSIONS LANE (owner, 2026-10-18) ─────────────────────────────────────────────
     "there's only one chat interface inside of governance that is the one that says chat on
     the tab. The rest of them are model based queries for sorting filtering". So on the
     Sessions tab the input is a QUERY, not a question: it goes to
     `/api/governance/sessions/query`, the answer is rows, and no chat turn is written.
     `_laneRows === null` means no query has been run — the feed draws itself as before. */
  private _laneRows: SessionsLaneRow[] | null = null;
  private _laneReceipt = '';
  private _laneError = '';
  private _laneBusy = false;
  private _abort: AbortController | null = null;
  /** The spacer's gesture while it is in flight — see _onGripDown. */
  private _gripMove: ((e: PointerEvent) => void) | null = null;
  private _gripUp: ((e: PointerEvent) => void) | null = null;
  /** The strip that holds the pointer capture, and the pointer it took — see _onGripDown. */
  private _gripEl: HTMLElement | null = null;
  private _gripPointerId: number | null = null;

  private _onDraftInput(e: Event) {
    draftInputAction(this as unknown as InputActionHost, e);
  }

  /**
   * TELL THE BAR WHETHER SEND IS AVAILABLE. It has to be told, and that is the defect
   * this exists for.
   *
   * `_draft` is a PLAIN field on purpose: making it reactive would re-render this element
   * — and therefore the whole thread — on every keystroke. But the bar's disabled state
   * depends on the draft (`chat-action-bar:175`, `?disabled=${!busy && !hasText}`), and
   * nothing ever carried it across. So typing worked, the draft was right, and the send
   * control stayed DISABLED forever: measured 2026-09-17 on a package — the draft held
   * "xXX" from real typing while the bar reported hasText false, and the chat could not
   * speak to the model at all.
   *
   * The bar is this element's OWN child (an internal piece, not a surface component), so
   * writing its property is composition, not a value pushed into the surface's tree.
   */
  private _syncBarText() {
    /* THE ELEMENT THAT IS DRAWN (zero-suppression audit, 2026-11-07): the page renders
       <design2-chat-action-bar>; this lookup named a tag that does not exist, so the draft never
       reached the bar and Send could never enable. The name now matches the element. */
    const bar = this.renderRoot?.querySelector('design2-chat-action-bar') as
      (HTMLElement & { hasText: boolean }) | null;
    if (bar) bar.hasText = this._draft.trim().length > 0;
  }

  /** The bar's submit — send the slotted input's draft to the model. */
  // ── WHAT THE HOST SAYS TO THIS SEAT ────────────────────────────────────────
  //
  // ONE channel, and it is a DISPLAY channel: a2ui:system-message puts a line in the thread.
  // The shell has dispatched these since the React seat owned the thread (a Run failed, the
  // tool call returned nothing, a save failed) and the seat that replaced it never listened,
  // so they landed in a store nothing renders — a Run that died was silent in the one place
  // a person looks. Same shape as before, role + content, so those call sites did not change.
  //
  // There was a second channel here for one afternoon: a2ui:chat-send, which ASKED the model
  // (the post-Run analysis the retired React seat ran when a run finished). It put an
  // instruction to Grace — "analyze this output, what's good, what could be improved" plus
  // three thousand characters of the answer — into the thread as a turn. The owner read it on
  // screen and said what it looks like: code, unreadable, nobody can read that. Asking
  // on the user's behalf is not a turn in their conversation. Removed.
  private _onHostSay = (e: Event) => {
    hostSayAction(this as unknown as HostTurnHost, e);
  };

  /**
   * A WRITE INTO THE PROMPT THAT LANDED NOWHERE, SAID OUT LOUD.
   *
   * `<prompt-section-editor>` dispatches this when it cannot place a write, carrying the seats
   * the prompt does have so the failure can name them. Its own note says the chat listens —
   * and nothing did, anywhere in the app: the event had a sender, a detail shape and a comment
   * promising it was reported, and no listener at all. Measured 2026-09-23: the assistant
   * offered a constraint, the person pressed Confirm, the write was refused, and the screen
   * showed NOTHING — no row, no error, and her sentence saying it was done.
   *
   * It is drawn as an ALERT, because that is what it is: the person asked for a change to
   * their prompt and the prompt did not change.
   */
  private _onWriteFailed = (e: Event) => {
    writeFailedAction(this as unknown as HostTurnHost, e);
  };

  /**
   * SOMETHING HAPPENED — ASK HER TO SAY WHAT IT MEANS.
   *
   * The panel's other window channel, `a2ui:system-message`, DRAWS a line without
   * asking her anything: the shell says "the save failed" and that sentence is
   * what appears. This one asks: the request goes to the model, the working state
   * shows while it is in flight, and her answer is what lands in the thread.
   *
   * The request is not shown as the person's turn (see `silent` on _send). What
   * the person did was choose a seat on the left; they did not type a sentence,
   * and a thread that puts words in their mouth stops being a record of what they
   * said.
   */
  private _onHostAsk = (e: Event) => {
    hostAskAction(this as unknown as HostTurnHost, e);
  };

  /**
   * THE BUTTONS ALREADY PRESSED, by their action. A row of buttons is a list of things to do,
   * and this is what lets one of them read as done while the rest stay live. Cleared when the
   * seat moves to another package: an action belongs to the thread it was offered in.
   */
  private _spent = new Set<string>();
  /** The turn whose buttons those were — see the press handler and ChatMessages.spentTurn. */
  private _spentTurn = '';

  /** Is a Run being held on her answer right now? */
  private _reviewingRun = false;

  /**
   * A RUN THIS REPLY ASKED FOR, WAITING FOR HER WORDS TO BE ON SCREEN.
   *
   * 'asked' is `<run_prompt/>` — she starts one herself. 'approved' is `<run_ok/>` — she clears a
   * run the host was holding. Both are the one effect that rearranges the screen, and both used
   * to fire from inside `_processReply`, before a single character of the reply had been drawn:
   * the middle column swapped, the prompt folded, the button started spinning, and the sentence
   * explaining any of it arrived after. Watched at the screen on 2026-09-23 — "we got to visually
   * connect the run feature … give grace enough time to give her back at her output."
   *
   * THE DELAY IS A READING BEAT, NOT A RACE BEING WON. Two animation frames guarantee her turn is
   * PAINTED before the screen changes; the pause after them is there because a person reads a
   * sentence before they look at what it did, and a canvas that appears in the same frame as the
   * words is a canvas nobody has read the reason for. It is small and it is stated, so it can be
   * judged rather than discovered.
   */
  private _pendingRun: 'asked' | 'approved' | null = null;

  /** How long her sentence sits alone before the run it announces takes the screen. */
  private static readonly READ_THE_REPLY_MS = 450;

  /**
   * Let the queued run go — after her turn has landed, been painted, and been read.
   *
   * Called once, at the end of a turn. A turn that asked for nothing dispatches nothing, so this
   * is safe on every reply, including the failures.
   */
  private _releaseQueuedRun(): void {
    const kind = this._pendingRun;
    this._pendingRun = null;
    if (!kind) return;
    const fire = () => {
      window.dispatchEvent(
        new CustomEvent(kind === 'approved' ? 'a2ui:run-approved' : 'ai-run-prompt'),
      );
    };
    // The paint first, then the beat. `requestAnimationFrame` inside a callback that has already
    // run is the double-frame the host uses for the same reason: one frame is the paint that was
    // already scheduled, the next is the one after it.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(fire, DesignChatSeat.READ_THE_REPLY_MS);
      });
    });
  }

  /** Her last verdict on a held Run: 'ok', 'blocked', or '' if she did not give one. */
  private _runVerdict: 'ok' | 'blocked' | '' = '';

  connectedCallback(): void {
    super.connectedCallback();
    /* THE SEAT'S CONNECTIONS LIVE IN `./design-chat-seat/events.ts`. */
    connectSeat(this);
  }

  disconnectedCallback(): void {
    /* AND THEY ARE LET GO IN THE SAME FILE. */
    disconnectSeat(this);
    super.disconnectedCallback();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // The drawn scrollbar over the output region
  // ═══════════════════════════════════════════════════════════════════════════

  /** The column's one scroller: the card's body, which the drawn thumb rides over. */
  private _scrollerEl(): HTMLElement | null {
    return (this.renderRoot?.querySelector('.content-scroll') as HTMLElement) ?? null;
  }

  /**
   * MEASURE, THEN MOVE ONLY IF SOMETHING CHANGED. Called on scroll, on resize, after every
   * render, and whenever the scroller's children change size — which is how a streaming
   * reply moves the thumb without the panel re-rendering.
   *
   * The thumb's length is the visible FRACTION of the content (clamped to 24px so a very
   * long thread still leaves something to grab), and its offset is that fraction of the
   * free track. Both are whole pixels: the panel is drawn on a grid and a half-pixel here
   * reads as a shimmer while scrolling.
   */
  private _syncScrollThumb(): void {
    const wrap = this._scrollerEl();
    if (!wrap) return;
    const max = Math.max(0, Math.round(wrap.scrollHeight - wrap.clientHeight));
    const visible = max > 1;
    const h = visible
      ? Math.max(24, Math.round(wrap.clientHeight * (wrap.clientHeight / wrap.scrollHeight)))
      : 0;
    const track = visible ? wrap.clientHeight - h : 0;
    const pos = Math.round(wrap.scrollTop);
    const top = visible && max > 0 ? Math.round((pos / max) * track) : 0;
    if (
      visible === this._railVisible &&
      h === this._thumbH &&
      top === this._thumbTop &&
      pos === this._scrollPos &&
      max === this._scrollMax
    ) {
      return;
    }
    this._railVisible = visible;
    this._thumbH = h;
    this._thumbTop = top;
    this._scrollPos = pos;
    this._scrollMax = max;
    this.requestUpdate();
  }

  /** The wrapper's own scroll — the thumb follows the content, not the other way round. */
  private _onOutputScroll = (): void => {
    this._syncScrollThumb();
  };

  /**
   * DRAGGING THE THUMB SCROLLS THE REGION — the same gesture idiom this file already uses
   * for the spacer's grip (press here, move on the window, release ends it), so a pointer
   * that leaves the 4px thumb mid-drag keeps scrolling, and nothing is captured that the
   * element forgets to release.
   */
  private _onThumbDown = (e: MouseEvent): void => {
    const wrap = this._scrollerEl();
    const thumb = e.currentTarget as HTMLElement | null;
    if (!wrap || !thumb) return;
    const overflow = wrap.scrollHeight - wrap.clientHeight;
    if (overflow <= 0) return;
    const track = wrap.clientHeight - thumb.offsetHeight;
    const perPx = track > 0 ? overflow / track : 0;
    const startY = e.clientY;
    const startTop = wrap.scrollTop;
    thumb.classList.add('dragging');
    const onMove = (ev: MouseEvent) => {
      wrap.scrollTop = startTop + (ev.clientY - startY) * perPx;
    };
    const onUp = () => {
      thumb.classList.remove('dragging');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault();
  };

  /** Fires once the region and its children have a box to measure. */
  protected firstUpdated(): void {
    // THE SEAT OPENED. One row per mount in design_surface_events; the seat is a screen, not an
    // element, so it carries `surface` and no component. Emitted before the measurement guards
    // below — an early return there must not cost the surface fact.
    uxCaptureSurfaceOpen('chat-seat');
    this._syncScrollThumb();
    /* THE FIVE BOXES' DOT BANDS ARE HANDLES HERE. */
    this._wireGrips();
    if (typeof ResizeObserver === 'undefined') return;
    const wrap = this._scrollerEl();
    if (!wrap) return;
    this._outputRO = new ResizeObserver(() => this._syncScrollThumb());
    // The scroller AND its children: the scroller's own box catches the card being
    // resized (the input dragged, the column opened), and a child's catches the thread
    // growing inside it — which is what a streaming reply does.
    this._outputRO.observe(wrap);
    for (const child of Array.from(wrap.children)) this._outputRO.observe(child);
  }

  /**
   * A chat button was pressed.
   *
   * MOST ACTIONS GO BACK AS A MESSAGE — that is what the retired seat's buttons
   * did, and it is right for "ask her about this": pressing tells her what to talk
   * about next.
   *
   * A `write-seat` ACTION DOES NOT. It is not a question, it is an edit: the
   * person pressed "add these rules to Constraints", and the answer to that is the
   * seat appearing in the prompt with those words in it — the same thing typing
   * them would produce. Sending it to her instead put her reply where the work
   * should have been, and the work never happened: measured, the seat stayed
   * absent and the thread gained a paragraph.
   *
   * So it is handed to the editor, which owns the sections, and nothing is sent.
   */

  /**
   * WITHDRAW WHAT SHE OFFERED, AND LEAVE WHAT SHE SAID.
   *
   * The buttons live in her turn's own text — that is the wire format — so withdrawing
   * them means rewriting that one turn without the action links. The prose stays: it
   * was read, and it is her answer to what the person did. What goes is the part that
   * was asking them to choose.
   *
   * Only the LAST assistant turn: an older offer that has already been answered is
   * history, and rewriting history because someone dismissed a later one would be a
   * different act than the button describes.
   */
  /**
   * TAKE THE HINT, NOT JUST THE OFFER — and without telling her.
   *
   * "No thanks" is not only a dismissal of what was on screen. Someone who has just
   * waved away an offer does not want the next one either, so this also switches the
   * seat out of volunteering: the next package they open will not be greeted with
   * suggestions. She is still there and still answers — the person just has to ASK.
   *
   * IT IS A LOCAL FLAG, NOT A MESSAGE TO HER, and that is deliberate. Telling the
   * model would cost a call to say "understood" and would only bind the conversation
   * it was said in — a new conversation would have to be told again, and a reload
   * would forget. This belongs to the seat, so it lives on the seat.
   *
   * The owner asked for this as a per-person setting that can be turned off and on;
   * `_autoAdvice` is the same state, in the smallest place it can start.
   */

  /**
   * CLEAR THE COMPOSER AFTER A TURN OR A QUERY — the one writer for all three send paths.
   *
   * The drawn control is <design2-prompt-textarea>, not the older <prompt-textarea>; the lookup
   * used that older name, so the visible box kept the sent words while the draft was already
   * empty. The element's own `clear()` is what lands while the caret is still in it.
   */
  private _clearDraft(): void {
    const textarea = this.renderRoot?.querySelector('design2-prompt-textarea') as
      (HTMLElement & { clear?: () => void }) | null;
    textarea?.clear?.();
    this._draft = '';
    this._syncBarText();
  }


  /* ── THE SESSIONS LANE'S ONE METHOD ────────────────────────────────────────────────────
     Words in; the route turns them into a Langfuse filter, validates it against a catalogue
     built from the app's own filter config, runs it, and hands back the rows. Nothing here
     decides what the words mean — and nothing here writes a turn. A refusal from the lane is
     drawn as its own reason, in the red the seat already uses; it is NEVER an empty list. */
  private async _runSessionsLane(text: string): Promise<void> {
    this._clearDraft();
    this._laneBusy = true;
    this._laneError = '';
    this.requestUpdate();
    try {
      const res = await fetch('/api/governance/sessions/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': this._userId() },
        /* THE SESSION ID IS WHAT MAKES THE QUERY A RECORD (owner, 2026-10-18): the lane writes
           the query onto the session seat as a conversation, and a capture without a seat has
           nowhere to be filed. A capture that fails is reported by the route, not hidden. */
        body: JSON.stringify({
          text,
          session_id: this.sessionId ?? '',
          /* NO project_id HERE. This seat does not carry one — it carries the PACKAGE session —
             and the route treats the column as optional. Declaring a property the element does
             not have is what made the production build fail; the capture only needs the seat. */
        }),
      });
      /* THE BODY IS READ AS TEXT AND PARSED ONCE — "could not parse" is an outcome to report,
         not a null to work around (the same rule the feed's own read follows). */
      const raw = await res.text();
      let payload: {
        status?: string;
        error?: string;
        explain?: string;
        count?: number;
        filter?: Array<{ column?: string; operator?: string; value?: unknown }>;
        sessions?: SessionsLaneRow[];
        capture?: { captured?: boolean; conversationId?: string; error?: string };
      } | null;
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(
          `the lane answered with something that is not JSON (HTTP ${res.status}): ${raw.slice(0, 160)}`,
        );
      }
      if (!res.ok || payload?.status !== 'ok') {
        throw new Error(String(payload?.error || `HTTP ${res.status}`));
      }
      if (!Array.isArray(payload.sessions)) {
        throw new Error('the lane answered without a sessions list');
      }
      this._laneRows = payload.sessions;
      const said = String(payload.explain ?? '').trim();
      const filters = (payload.filter ?? [])
        .map((f) => {
          const value = Array.isArray(f.value) ? `[${f.value.join(', ')}]` : String(f.value ?? '');
          return `${f.column ?? '?'} ${f.operator ?? '?'} ${value}`;
        })
        .join(' · ');
      this._laneReceipt = said && filters ? `${said} — ${filters}` : said || filters;
      const n = typeof payload.count === 'number' ? payload.count : payload.sessions.length;
      this._laneReceipt = `${this._laneReceipt} · ${n} session${n === 1 ? '' : 's'}`;
      /* THE RECORD APPEARS IN THE LIST AT ONCE (owner, 2026-10-18: *"I can go back as a user and
         select that conversation in sessions"*). The row is the record the route just wrote — not
         a copy kept here. A capture that FAILED is said on the receipt line instead of leaving a
         person believing they can come back to something that was never filed. */
      const capture = payload.capture;
      if (capture && capture.captured && capture.conversationId) {
        const known = (this.conversations ?? []).some(
          (c) => String(c.id) === String(capture.conversationId),
        );
        if (!known) {
          this.conversations = [
            { id: String(capture.conversationId), title: text, tab: 'sessions' },
            ...(this.conversations ?? []),
          ];
        }
      } else if (capture && capture.captured === false) {
        this._laneReceipt = `${this._laneReceipt} · NOT RECORDED — ${capture.error ?? 'the query could not be filed'}`;
      }
    } catch (err) {
      this._laneRows = null;
      this._laneReceipt = '';
      this._laneError = err instanceof Error ? err.message : String(err);
    } finally {
      this._laneBusy = false;
      this.requestUpdate();
    }
  }

  /** Back to the unfiltered feed — the person's own act, on the receipt line's button. */
  private _onSessionsLaneClear = (): void => {
    sessionsLaneClearAction(this as unknown as SessionsLaneHost);
  };

  /**
   * A STORED QUERY, OPENED AGAIN (owner, 2026-10-18): *"I can go back as a user and select that
   * conversation in sessions, and it will reload my exact query."*
   *
   * It replays the RECORD — the validated filter saved on the conversation — rather than asking
   * the model again, so opening an old query can never show something different from what was
   * asked. The lane writes no turn; the feed redraws its rows and the receipt line.
   */
  private async _replayLaneQuery(conversationId: string): Promise<void> {
    this._laneBusy = true;
    this._laneError = '';
    this._laneReceipt = '';
    this.requestUpdate();
    try {
      const res = await fetch('/api/governance/sessions/query/replay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': this._userId() },
        body: JSON.stringify({ conversation_id: conversationId }),
      });
      const raw = await res.text();
      let payload: {
        status?: string;
        error?: string;
        explain?: string;
        count?: number;
        sessions?: SessionsLaneRow[];
      } | null;
      try {
        payload = JSON.parse(raw) as typeof payload;
      } catch {
        throw new Error(
          `the stored query answered with something that is not JSON (HTTP ${res.status}): ${raw.slice(0, 160)}`,
        );
      }
      if (!res.ok || payload?.status !== 'ok') {
        throw new Error(String(payload?.error || `HTTP ${res.status}`));
      }
      if (!Array.isArray(payload.sessions)) {
        throw new Error('the stored query answered without a sessions list');
      }
      this._laneRows = payload.sessions;
      const said = String(payload.explain ?? '').trim();
      const n = typeof payload.count === 'number' ? payload.count : payload.sessions.length;
      this._laneReceipt = `${said ? `${said} · ` : ''}${n} session${n === 1 ? '' : 's'}`;
    } catch (err) {
      this._laneRows = null;
      this._laneReceipt = '';
      this._laneError = err instanceof Error ? err.message : String(err);
    } finally {
      this._laneBusy = false;
      this.requestUpdate();
    }
  }

  /** The bar's stop — abort the in-flight call. */
  private _onStopCommand() {
    stopAction(this as unknown as InputActionHost);
  }

  // The input-area height, dragged by the action bar's gripper — the same
  // gesture and clamps as the console seat (InteractiveChatInterface
  // handleMouseDown/handleMouseMove): min 100, max min(600, panel - 190).
  private _dragStartY = 0;
  private _dragStartHeight = 0;
  // THE HAND'S HOLD ON THE EDGE, taken at drag start. The grip strip sits ABOVE the input
  // area's top edge, so placing the edge AT the pointer made the whole input jump away from
  // the hand on the first move (owner, 2026-10-26: *"the buttons and design in the chat, they
  // don't follow the mouse"*). The offset below is (pointer − edge) at the grab; the edge keeps
  // it, so the edge moves exactly as far as the hand does.
  private _dragEdgeBottom = 0;
  private _dragGrabOffset = 0;
  // The bar and footer heights, measured ONCE at drag start. Reading
  // getBoundingClientRect on every mousemove forces synchronous layout per
  // frame — the classic resize-lag pattern. They don't change mid-drag.
  private _barHeight = 82;
  private _footerHeight = 142;

  /**
   * WHICH OUTPUT WINDOWS ARE SHOWING. The conversations window leads, so conversations
   * starts in the list. The window's own control removes that window (the footer mark that
   * used to toggle one in retired with the tray's stubs, 2026-10-14). Events carry the
   * window name, so this element holds the list and the drawing follows.
   */
  private _outputWindows: string[] = ['conversations'];

  private _onOutputWindow(e: Event) {
    outputWindowAction(this as unknown as OutputWindowHost, e);
  }

  private _onResizeStart(e: Event) {
    const d = (e as CustomEvent).detail || {};
    this._dragStartY = typeof d.startY === 'number' ? d.startY : 0;
    const input = this.renderRoot?.querySelector('design2-chat-input') as HTMLElement | null;
    this._dragStartHeight = input ? input.getBoundingClientRect().height : (this.inputHeight || 0);
  }

  /* ── THE FRAME LIVES IN `rooms/design/frame/chat-frame.ts` ───────────────────────────────────
   *
   * The five boxes, the bands, the pull and its stop are the Design section's own, once for every
   * tab. Each delegate below keeps the name the template already binds; the body is the frame's,
   * and the frame's interface states what it may reach on this seat.
   */
  private get frameSlotTags(): Record<string, string> {
    return CHAT_SLOT_TAGS;
  }

  /** The seat as the frame's host. One cast, in one place; the interface states the contract. */
  private _frame(): frame.ChatFrameHost {
    return this as unknown as frame.ChatFrameHost;
  }

  private _onResizeMove(e: Event) {
    frame.onResizeMove.call(this._frame(), e);
  }

  /* ── THE FIVE BOXES' BANDS ─────────────────────────────────────────────────────────────────
   *
   * The same rule as the Tools seat, because it is the same column: the labels, the Pull with its
   * cap, the Header's press, and the Footer's ceiling at the Chat input's height. The bar's own
   * band already raises input-resize-start/move, so this wiring leaves it alone.
   */
  private _gripWired = new WeakSet<Element>();

  private _wireGrips(attempt = 0): void {
    frame.wireGrips.call(this._frame(), attempt);
  }

  /** Hold the dots, move, the box's height changes by the distance travelled, up to its room. */
  private _onSlotGripDown(e: PointerEvent, band: HTMLElement, host: HTMLElement): void {
    frame.onSlotGripDown.call(this._frame(), e, band, host);
  }

  /**
   * THE ROOM THE OTHER BOXES CAN GIVE, ABOVE THEIR OWN DEFAULTS. A box inside the output takes the
   * spare room of the boxes beside it; the Footer reaches the Chat input's height and no further.
   */
  private _roomToGrow(host: HTMLElement): number {
    return frame.roomToGrow.call(this._frame(), host);
  }

  /** A box's Default: the number its card declares, plus the block's own chrome around the card. */
  private _defaultOf(host: HTMLElement): number {
    return frame.defaultOf.call(this._frame(), host);
  }

  /** One box back to its Default: the size a pull wrote is cleared. */
  private _resetBox(host: HTMLElement): void {
    frame.resetBox.call(this._frame(), host);
  }

  static styles = designChatStyles;

  private get _thread(): SeatMessage[] {
    return threadOf(this as unknown as ThreadDataHost) as SeatMessage[];
  }

  /**
   * DOES THE THREAD CARRY A RUN'S RESULTS? The card's results state is this one
   * fact — read from the same thread the messages element draws, and bound onto
   * the card (chat-header's has-results), so the slot's colour and the turns'
   * marks can never disagree (see AGENTS-instructions/OUTPUT-STYLING.md R4).
   */
  private get _hasResultTurns(): boolean {
    return hasResultTurns(this as unknown as ThreadDataHost);
  }

  // ── The slot contract. See the header. ───────────────────────────────────────

  /**
   * A slot in this element's own shadow root, by name (undefined = the default
   * slot). ONE place does the lookup and the cast, because `querySelector` returns
   * `Element` and `assignedNodes` lives on `HTMLSlotElement` — spelled out here so
   * neither reader has to know that.
   */
  private _slot(name?: string): HTMLSlotElement | null {
    return frame.slot.call(this._frame(), name);
  }

  /** Is a seat supplied by the host? Read at render time — the light DOM is the truth. */
  private _seatSlotted(): boolean {
    return frame.seatSlotted.call(this._frame());
  }

  private _onSlotChange(): void {
    frame.onSlotChange.call(this._frame());
  }

  /**
   * Is a view supplied for the rail's non-chat tab — Trace, Versions, Tools,
   * Approvals? Read at render time, the same rule the seat slot follows, because
   * the light DOM is the truth and a cached flag would be one more thing that can
   * disagree with what is assigned.
   *
   * The slot element only exists while a non-chat tab is active (see render), so
   * this answers for the tab being drawn, not for every tab at once.
   */
  /**
   * WHAT AN EMPTY VIEW SAYS. Advice, per tab, in the place the view would be — because a
   * rail button is a request to look at something THIS place has, and "this place has none
   * yet" is the answer a demo owes the person who pressed it.
   *
   * A tab with no line of its own gets the plain truth rather than an invention: the view
   * is empty, and it fills when the surface puts something in it.
   */
  private _emptyViewLine(): unknown {
    return frame.emptyViewLine.call(this._frame());
  }

  /**
   * IS THIS THE CONSOLE'S SEAT — the one whose chat carries the findings?
   *
   * The answer is the rail's own list, written by the server: the seat that OFFERS Repairs is
   * the seat that draws the findings above its thread, and no other chat is touched (owner,
   * 2026-09-18: "this is only for the console, not anywhere else chat appears"). Reading the
   * server's list rather than taking a second flag means the rail and the panel cannot
   * disagree about which seat this is — the same reason the list is not the model's to write.
   */
  /**
   * Is this seat the one that carries a findings view? APPROVALS is that tab now — the
   * owner, 2026-09-19: "remove the repairs from the tab — repairs live under the approvals."
   * The repair TAB is gone (the console's allowedTabs dropped it), and the view that used
   * to hang off it draws under Approvals, where the findings always belonged.
   */
  private _findingsSeat(): boolean {
    return frame.findingsSeat.call(this._frame());
  }

  /**
   * IS A VIEW CLAIMING THIS TAB — an assigned view declaring `view-tab="<tab>"` on
   * itself (a room's own furniture; see `_viewSlotted`). When one is, the tab draws
   * the view FLAT, not in the fold: the trace fold exists for the console/composer's
   * trace-feed — a disclosure around telemetry — and a room whose own view fills the
   * hole draws it as the hole's content, the way the app it came from draws it (the
   * owner, 2026-10-13: "there's no drop-down … if it's a flat list there's no
   * drop-down"). The fold path stays untouched for every seat without a claimant.
   */
  private _tabClaimant(tab: string): boolean {
    return frame.tabClaimant.call(this._frame(), tab);
  }

  private _viewSlotted(): boolean {
    return frame.viewSlotted.call(this._frame());
  }

  /**
   * IS A FOREIGN VIEW ASSIGNED — a view this seat's own tabs do not name.
   *
   * THE SEAT'S OWN DOOR, kept when the first room to use it left. The Product room bound its
   * context strip here (declared 2026-10-03; the owner removed the catalogue chooser the same
   * day, and the strip with it — see the allow-list note above the styles), and this mechanism
   * was what let it draw: the seat's `_wantedViewTag` knows only its own views (trace-feed,
   * eval-feed, chat-repair-actions), so a room's furniture in the hole the design left open
   * ("holds plain text output and inserted functions") is neither "wanted" nor wrong. The
   * question is narrow on purpose — are any assigned view elements tags this seat does not
   * own? — so a room's view draws above her thread on the Chat tab WITHOUT changing any other
   * seat: the composer's seat assigns trace/eval views (all known, nothing changes there), and
   * the console's repair rows are known too. Nothing binds it today; the next room's view needs
   * the same one-line allow-list entry above and nothing here. The two assignment checks mirror
   * `_viewSlotted`'s own.
   */
  private _anyForeignViewAssigned(): boolean {
    return frame.anyForeignViewAssigned.call(this._frame());
  }

  /**
   * DOES THIS TAB DRAW A VIEW ABOVE THE THREAD. Two cases, one place: the console's repair
   * rows on Approvals (their own recorded rule), and a room's foreign view on Chat (the
   * Product room's context strip, 2026-10-03 — the room must open with its chooser visible,
   * the same "never opens on a blank chat" the console's rows answer).
   */
  private _chatTopView(): boolean {
    return frame.chatTopView.call(this._frame());
  }

  /**
   * WHICH SLOTTED ELEMENT THIS TAB'S VIEW IS — each rail tab draws one view, and the
   * slot can hold several at once. A tab without a view element yet (tools, versions,
   * runs, states) has none, so its waiting line shows; the views that exist answer to
   * their own tag, so the trace feed never stands in for Evals and vice versa.
   */
  private _wantedViewTag(): string | null {
    return frame.wantedViewTag.call(this._frame());
  }

  /**
   * WHICH TABS DRAW THE THREAD — and `approvals` draws it.
   *
   * The owner, 2026-09-18: "there's no chat hooked up to the console approval button. It's
   * dead, it does nothing — just hook one of them up so I can talk to it." The console's
   * approvals view held the repair list, which renders nothing when no findings carry a
   * stage, so the tab showed an empty pane. The seat draws its own conversation there
   * instead: the same thread and the same input the Chat tab uses, against the same
   * conversation. A message that names governance runs the inspection and its report comes
   * back as the reply (routes/teacher.py), so this tab is a surface to ask the governance
   * system for a report and to read the reports already filed.
   *
   * The view slot keeps the other tabs (trace, versions, tools, repair), and an element
   * still never renders another element: this is the seat drawing its own thread.
   */
  private get _showsThread(): boolean {
    return frame.showsThread.call(this._frame());
  }

  /**
   * WHICH EVALS TABS DRAW THE THREAD — the rooms that say so.
   *
   * The owner, 2026-10-16: *"She has to talk whenever you click the eval's button. That's
   * the trigger."* — and the talk has to be VISIBLE on the tab that was clicked, or the
   * click reads as silence (measured: the Evals tab drew its waiting line while her words
   * sat one tab over). A room whose Evals have no feed of their own yet declares
   * `evalsTalk`, and its Evals tab draws the conversation instead of the waiting line;
   * THE DAY a feed is slotted (a view claiming `view-tab="eval"` or an eval-feed bound
   * into the slot) this stands aside and the view draws. Other seats never set the flag
   * and render exactly as before.
   */
  /**
   * THE TAB-EXPERIENCE DOOR IS GONE with its styles: a tab's output is the catalog's own view
   * in the `view` slot (the trace tree, the evaluators index), never a second output area.
   * `_evalsDrawsThread` below still reads the slot the right way — a view claiming the tab
   * stands aside from her thread, exactly as the Trace tab does.
   */
  private _evalsDrawsThread(): boolean {
    return frame.evalsDrawsThread.call(this._frame());
  }

  /**
   * Whether the status bar will draw a line — the same condition <design2-chat-header> applies to its
   * own slots (a flat statusText, or any of the four readouts). The panel asks it so an EMPTY
   * status block is left out of the tree entirely rather than rendered hollow: a hollow block
   * is still the first child, and the leading block is the one that carries the drawing's
   * deeper top padding (see the note in the template).
   */

  private get _hasStatusLine(): boolean {
    return Boolean(
      this.statusText || this.status || this.sessionLabel || this.sessionName || this.duration || this.qaScore,
    );
  }

  /**
   * The status line for <design2-output-header> — the frame's own line built from the live slots,
   * in the same order and punctuation chat-header uses. The usage figures are NOT joined
   * here: output-header owns the Tokens/Calls readouts it is handed.
   */
  /**
   * WHETHER THE ROOM HAS SLOTTED ITS OWN READOUT STRIP (the trace seat's facts — owner,
   * 2026-10-13 late: they live in the seat's readout bar, "It goes here"). The relay
   * slot below sits inside <design2-output-header>; this flag rides the same render and turns
   * the bar's built-in line off when the strip is present. False in every other room.
   */
  private _statusContentSlotted = false;

  private _onStatusSlotChange = (e: Event): void => {
    const slot = e.target as HTMLSlotElement;
    const has = (slot.assignedNodes?.() ?? []).some(
      (n) => n.nodeType === Node.ELEMENT_NODE || (n.nodeType === Node.TEXT_NODE && !!n.textContent?.trim()),
    );
    if (has === this._statusContentSlotted) return;
    this._statusContentSlotted = has;
    this.requestUpdate();
  };

  private get _statusLine(): string {
    if (this.statusText) return this.statusText;
    const parts: string[] = [];
    const lead = [this.status ? `${this.status}:` : '', this.sessionLabel ?? ''].join(' ').trim();
    const named = [this.sessionName ?? '', this.duration ? `Duration: ${this.duration}` : ''].join(' ').trim();
    if (lead) parts.push(lead);
    if (named) parts.push(named);
    if (this.qaScore) parts.push(`Closed QA: ${this.qaScore}`);
    /*
     * THE SESSION DATA FROM THE USAGE LEDGER, and nothing else (owner, 2026-11-07). The header
     * shows the recorded tokens, calls, cost and pricing basis, the last call, and the split by
     * model. Langfuse v4 in this deployment is events-only and no longer serves its sessions
     * endpoint, so these are the same numbers the calls reported to it, read from the ledger.
     * Zero recorded calls draw nothing; a missing cost draws nothing rather than a zero.
     */
    const tok = (n: unknown): string => Number(n ?? 0).toLocaleString('en-US');
    const money = (n: unknown): string =>
      n === null || n === undefined ? '' : `$${Number(n).toFixed(4)}`;
    const span = (s: unknown): string => {
      const total = Number(s ?? 0);
      const minutes = Math.floor(total / 60);
      return minutes ? `${minutes}m ${total % 60}s` : `${total}s`;
    };
    const usage = this.usage ?? {};
    const sessions = Number(usage.sessions ?? 0);
    const calls = Number(usage.calls ?? 0);
    const attributed = usage.attributed === true;
    if (attributed && (calls > 0 || sessions > 0)) {
      const cost = money(usage.cost);
      parts.push(
        `This conversation (since recording began): ${tok(usage.totalTokens)} tokens · ` +
        `${calls} call${calls === 1 ? '' : 's'}${cost ? ` · ${cost}` : ''}`,
      );
    } else {
      /* A SEAT WITH NO ATTRIBUTED CALL SAYS SO. It never borrows the session's or the user's
         totals; another scope's numbers would be a lie about this conversation. */
      parts.push('Usage: unattributed — no call in the ledger is attributed to this conversation yet.');
    }
    if (typeof usage.pricing === 'string' && usage.pricing.trim()) {
      parts.push(`Pricing: ${usage.pricing.trim()}`);
    }
    const rates = usage.rates as Record<string, unknown> | undefined;
    if (rates && typeof rates === 'object') {
      const band = usage.rateBand === 'off_peak' ? 'off-peak' : usage.rateBand === 'peak' ? 'peak' : '';
      parts.push(
        `Rates per 1M${band ? ` (${band})` : ''}: input hit $${rates.input_hit} · ` +
        `input miss $${rates.input_miss} · output $${rates.output}`,
      );
    }
    const byModel = Array.isArray(usage.byModel) ? usage.byModel : [];
    for (const m of byModel.slice(0, 4) as Array<Record<string, unknown>>) {
      const model = String(m?.model ?? '').trim();
      if (!model) continue;
      const cost = money(m?.cost);
      parts.push(
        `${model}: ${Number(m?.calls ?? 0)} calls · ${tok(m?.tokens)} tokens` +
        `${cost ? ` · ${cost}` : ''}`,
      );
    }
    const last = usage.lastSession as
      | { name?: string; durationSeconds?: number; tokens?: number; calls?: number; cost?: number; lastSeen?: string }
      | undefined;
    if (last?.name) {
      const cost = money(last.cost);
      parts.push(
        `Last: ${last.name} · ${span(last.durationSeconds)} · ${tok(last.tokens)} tokens · ` +
        `${last.calls} calls${cost ? ` · ${cost}` : ''} · ${String(last.lastSeen ?? '')}`,
      );
    }
    return parts.join('\n');
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    /* THE PAGE READS THE SESSION AND THE CONVERSATION THE ROOM HANDS IT (owner, 2026-11-07;
       amended 2026-11-16). The surface states one pair per tab — the package row and that
       package's own conversation — and this block is the FALLBACK for a host that states
       neither. When the room owns the rail (`railOwnedByHost`, set by the surface's tree), the
       room is the only writer: overriding it here is how Home was moved onto the separate
       `chat` package and handed the thread of a tab it was not standing on. */
    if ((this.dataModel || this.designPackages) && !this.railOwnedByHost) {
      const packages =
        (this.designPackages as Record<string, any> | undefined) ??
        ((this.dataModel as Record<string, any>)?.console?.design_packages ?? {});
      const own =
        this.activeTab === 'ux' ? packages.ux?.packageId
          : this.activeTab === 'approvals' ? ''
            : this.activeTab === 'chat' && this.conversationSource === 'seat'
              ? packages.chat?.packageId
              : packages.console?.packageId;
      const wanted = String(own || '');
      if (wanted && String(this.sessionId ?? '') !== wanted) {
        this.sessionId = wanted;
        /*
         * THE PAGE OPENS THE THREAD THE MOMENT IT LEARNS ITS PACKAGE. This only runs for a host
         * that handed no session of its own; the room's shell hands no Chat address, so the Chat
         * console resolves its own package row here and opens that package's thread.
         */
        if (this.activeTab === 'chat') {
          this._enterPackage(wanted);
          this._defaultOpenAsked = wanted;
          this._wantsDefaultConversation = true;
          void ensureDefaultConversation(this);
        }
      }
    }
    // A PACKAGE CHANGE STARTS THE SEAT OVER. The panel is REUSED across assemblies (the
    // surface keeps the same component id — see the note on `_thread`), so without this the
    // previous package's spoken turns (`_local`) and its loaded history stay on screen over
    // the next package's thread. The owner, 2026-09-18: "I don't see other packages when I
    // open up this package — I only see this package."
    if (changed.has('sessionId')) {
      this._enterPackage(String(this.sessionId ?? ''));
      /*
       * THE RECORD IS READ WHEN THE SEAT LEARNS WHICH SEAT IT IS — not only when it connects.
       *
       * An arrival is SENT and RECORDED, because the seat is usually created by the very commit
       * that announces it (see shared/arrival). Connecting is not always enough to catch it: the
       * element can connect before its `sessionId` has been written, and the record was addressed
       * TO THAT ID — so `consumeArrival(null)` at connect finds nothing that is his, leaves the
       * record waiting, and nothing ever reads it again when the id arrives. Measured
       * 2026-09-24 in the console→package flow: the package opened, the record was waiting for
       * that seat by name, and she never greeted. The stream is idempotent — `consumeArrival`
       * refuses an arrival addressed to another seat and leaves it there — so reading it here
       * cannot steal another seat's.
       */
      const arrived = consumeArrival(this.sessionId ?? null);
      if (arrived) this._takeArrival(arrived.kind);
      void this._readPackageConversations(this._userId());
      void this._readSeatScope(this._userId());
      /* THE READOUT IS READ ON THE REAL EVENT, WITH NO DELAY. A timeout in front of a read is a
         guessed wait, not a fact; the read either answers or it says why. */
      void this._readUsageSummary();
      /* THE CHAT TAB OPENS ITS DEFAULT WHEN THE PAGE LEARNS ITS PACKAGE (owner, 2026-11-07).
         The Tools tab is opened by the press; this tab is the one the room lands on, so the page
         asks the same open for itself instead of waiting for a second press. It is asked once per
         package; a later press asks again through `loadDefaultConversation`. */
      if (this.activeTab === 'chat' && this.sessionId
        && this._defaultOpenAsked !== String(this.sessionId)) {
        this._defaultOpenAsked = String(this.sessionId);
        this._wantsDefaultConversation = true;
      }
      void ensureDefaultConversation(this);
    }
    if (changed.has('conversationId')) {
      void this._loadHistory();
      /* THE READOUT BELONGS TO THE CONVERSATION THE SEAT JUST OPENED. */
      void this._readUsageSummary();
    }
    /*
     * AND AFTER EVERY RENDER, because the greeting waits on facts that arrive in
     * either order: the announcement (which can land before this seat exists) and
     * the history attempt (which is async). Whichever finishes last is the one that
     * runs it; `_greeted` makes that happen once.
     *
     * ── AND THE RECORD IS RE-READ UNTIL IT IS READ ────────────────────────────────────────
     *
     * A seat read the pending arrival at connect and when its `sessionId` changed, and never
     * again. Both of those can PRECEDE the record: the seat is drawn by the commit that opens
     * the room, so an arrival announced a frame later — the design room's own ordering — was
     * written after both reads, nothing ever looked again, and she stayed silent with the
     * record waiting for a seat whose name it matched. Measured 2026-10-01 in production:
     * Design's conversation held zero messages while her seat carried the room's script.
     *
     * `consumeArrival` refuses an arrival addressed to another seat and leaves it where it is,
     * so asking again cannot steal one — this only ever takes what is THIS seat's, and once
     * taken the record is gone, making this one comparison per render.
     */
    if (!this._wantsGreeting && this.sessionId) {
      const waiting = consumeArrival(this.sessionId);
      if (waiting) this._takeArrival(waiting.kind);
    }
    this._greetIfArriving();
    // History arriving lands the column at the newest turn (see _scrollThreadToBottom)...
    // EXCEPT WHEN THE NEWEST TURN IS A RUN'S RESULT: those open at their HEAD, scrolled by
    // the child (chat-messages.updated), and bottom-following here would fight it — the
    // person would be handed the tail of the answer they are about to read (the owner,
    // 2026-09-24: "the output should be visible at the top and then the user can scroll").
    const lastTurn = this._thread[this._thread.length - 1];
    if (changed.has('messages') && !lastTurn?.result) this._scrollThreadToBottom();
    // ...AND SO DOES THE COLUMN COMING BACK. The history usually loads while the column is
    // CLOSED — the console opens with the chat collapsed — where the scroller measures 0 and
    // the scroll is a no-op, so the first open used to land at the top of the thread
    // (measured 2026-09-19: "it's not quite at the bottom").
    //
    // A THREAD OF RESULTS IS LEFT WHERE IT IS (`_scrollThreadToBottom` refuses it), because the
    // results are the first content of their conversation and the top is already the head. Nothing
    // is placed, so nothing holds the person there.
    if (changed.has('collapsed') && !this.collapsed) this._scrollThreadToBottom();
    this._noticeWhileAway();
    // NO THUMB SYNC HERE, and that is deliberate. `updated()` runs on EVERY render, and a
    // drag of the input's divider renders on every mousemove — so syncing from here read
    // `scrollHeight`/`clientHeight` per frame, which is the synchronous-layout pattern this
    // file already warns about for the same gesture ("Reading getBoundingClientRect on every
    // mousemove forces synchronous layout per frame — the classic resize-lag pattern", see
    // the resize clamps above). The owner felt exactly that on 2026-09-19: "the same divider
    // slide up and slide down… it's not releasing the cursor."
    //
    // The sync has three other callers and they are the right ones: firstUpdated, the
    // scroller's own scroll event, and a ResizeObserver that fires after layout when the
    // region or its children change size — which is what a drag of the divider actually
    // changes.
  }

  /**
   * THE THREAD OPENS AT ITS NEWEST TURN. A conversation is read from the bottom up — the
   * last thing said is the thing being answered — so the column's one scroller lands there
   * whenever the thread grows: history arriving, a turn sent, a reply landing. (The COLUMN
   * scrolls, not the thread — chat-messages says why — so the move happens here.)
   *
   * TWO FRAMES, because the DOM grows after this render and the scroller has to be measured
   * once it has — the first frame lands it, the second catches anything that settled late
   * (a wrap that changed height, the fold opening). Cheap, and it is what "at the bottom"
   * means when the content is still arriving.
   *
   * THE SCROLLER IS THE OUTPUT REGION (.chat-output-wrapper), not the card's inner column:
   * the drawn scrollbar moved the scrolling out to the region so the bars and the card
   * travel together under one bar (owner, 2026-09-19). This is the same move the thumb
   * makes — the column still opens at its newest turn.
   */
  private _scrollThreadToBottom(): void {
    if (!this._showsThread) return;
    /*
     * A RESULTS THREAD IS NEVER FOLLOWED TO ITS TAIL. The results ARE the reading, and they are
     * read from their head — the "Your Results" line first, the answer below it as a normal scroll.
     * Following the newest turn would land the person at the END of the output, which is the
     * opposite of reading it, and it is a move nobody asked for: the owner, 2026-09-24, "the
     * results after run have to load at the top of the results. You can't load it at the bottom of
     * the results."
     *
     * The head is placed by <design2-chat-messages> (it is the element that knows where the results
     * start); this is only the refusal to undo it. A conversational turn — the person's own, or
     * her reply to one — is not a result and still follows down exactly as it always has.
     */
    if (resultsAreTheReading(this._thread)) return;
    const once = () => {
      // SEAT THE CURRENT EXCHANGE, NOT ITS TAIL (2026-10-03 — the owner: *"the question
      // should set at the top… so that the user can start reading the response at its
      // beginning instead of picking it up at the end where it currently loads."*). The
      // thread element owns the seating — it is the element that knows where the question
      // is; this only asks for it. A thread that cannot seat (no such element) keeps the
      // old follow-to-bottom.
      const thread = this.renderRoot?.querySelector('design2-chat-messages') as
        | (HTMLElement & { seatConversation?: () => void })
        | null;
      if (thread?.seatConversation) {
        thread.seatConversation();
        return;
      }
      const scroller = this._scrollerEl();
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    };
    requestAnimationFrame(() => {
      once();
      requestAnimationFrame(once);
    });
  }

  /**
   * THE SEAT ENTERS A PACKAGE — and starting over is what that means.
   *
   * A thread belongs to the conversation it was spoken in. `_local` (everything typed here
   * and every host message this seat heard) is never carried into another package, and the
   * loaded history goes with it. The CONVERSATION ID is not cleared here: the surface binds
   * the incoming package's own id, and clearing it would fight the binding that is arriving
   * in this same update.
   */
  private _enterPackage(nextSession: string): void {
    const prior = this._sessionHeld;
    this._sessionHeld = nextSession;
    if (prior === nextSession) return;

    this.messages = [];
    this._local = [];
    this._spent.clear();
    this._spentTurn = '';
    this._historyError = '';
    // A DIFFERENT PACKAGE IS A DIFFERENT QUESTION: whether THIS one has ever been given its
    // first conversation is not something the last one can answer (see _greetIfArriving).
    this._conversationEnsured = false;
    /*
     * AND THIS PACKAGE'S THREAD HAS NOT BEEN READ YET EITHER.
     *
     * `_historyChecked` was never cleared here, so it still said "checked" from the package
     * before — and the greeting ran on a thread that had not been loaded, where "has this package
     * run?" answers NO because there is nothing in `messages` yet. Measured 2026-09-24: opening the
     * Insurance Technology Scout, whose conversation holds a finished run, made her greet it as
     * unfinished work — three times, into the results conversation itself (21:04:36, 21:04:59,
     * 21:07:13). The rule that silences her after a Run is only as good as the thread it reads.
     *
     * With no conversation there is nothing to read and the greeting knows it already (see the
     * synthesis in _greetIfArriving, which records exactly that), so this cannot strand a seat
     * on a package whose conversations were all deleted.
     */
    this._historyChecked = false;
    /*
     * AND THIS PACKAGE'S CONVERSATION LIST HAS NOT BEEN READ EITHER. It is the other half of the
     * same question — "has this package run" is answered by an archived row, and "does it have a
     * conversation at all" by any row — so a list carried over from the package before would
     * answer both about the wrong package.
     */
    this._conversationsRead = false;
    this._conversationRows = null;

    // PENDING TURNS BELONG TO THE PACKAGE THEY WERE SPOKEN IN. Spoken before any package
    // existed (owner null), they are still owed to whatever package is saved next — that is
    // the case flushPendingTurns serves. Spoken INSIDE a package, they can never be written
    // anywhere else without lying about where they came from; carrying them forward is how
    // one package's words landed in another's thread. They are dropped, and LOUDLY.
    if (this._pending.length && this._pendingOwner && this._pendingOwner !== nextSession) {
      console.error(
        `[chat-panel] ${this._pending.length} turn(s) spoken in package ${this._pendingOwner.slice(0, 8)}… were never saved. ` +
        `The seat has moved to ${nextSession ? nextSession.slice(0, 8) + '…' : '(no package)'} and will not carry them across — ` +
        'a conversation belongs to the package it was spoken in.',
      );
      this._pending = [];
      this._pendingOwner = null;
    }
    this.requestUpdate();
  }

  /**
   * THE SEAT READS ITS OWN HISTORY WHEN THE SURFACE DID NOT HAND IT OVER.
   *
   * `render-session` binds `conversationId` and nothing else (routes/ai.py), and a host may bind
   * nothing at all — in which case this element used to say "No conversation yet for this package"
   * over a package that has a conversation with years of turns in it. That sentence is only
   * allowed to be true. The conversation belongs to the package (`conversations.session_id` is
   * NOT NULL), so the element asks the package's conversation for its own history.
   */
  private async _loadHistory(): Promise<void> {
    return this._conversationModule.loadHistory.call(this._conv());
  }

  /**
   * SHE INTRODUCES HERSELF ON ARRIVAL — BY BEING ASKED, NOT BY A PRINTED LINE.
   *
   * The thread used to open with "Hi — how can I help you today?", drawn by the
   * messages element whenever the thread was empty. It was a fixed string: nothing
   * thought, nothing had read anything, and it said the same thing to everyone. The
   * owner, 2026-09-28: "I don't want a hardcoded message… I want her to be thinking
   * and reply."
   *
   * So she is ASKED, the working state shows while she answers, and the words in the
   * thread are hers. THE REQUEST DOES NOT TELL HER WHAT TO SAY — it says a person has
   * arrived at a blank composer and that nobody has said anything yet. What she opens
   * with is her own; a prompt that dictated it would be the hardcoded line again,
   * written in a longer way.
   *
   * WHERE IT FIRES. The host says a composer opened (`a2ui:composer-opened`) — this
   * element cannot tell, because the only property that differs between the seats
   * arrives as an empty array here rather than as absent, so "no console cards" and
   * "not the console" read the same. The seat still decides whether there is
   * anything to greet: it holds the thread, and it is the only thing that knows
   * whether that thread is empty. Once per seat, and never over an unreadable
   * thread — a refusal is not an empty thread, and greeting into one would bury the
   * error.
   *
   * A silent send, so the ask is not drawn as the person's own turn. And it does not
   * re-assemble anything: everything this touches stays inside the chat, which is the
   * rule this seat was given when the greeting was first considered.
   */
  private _onComposerOpened = (e: Event): void => {
    const d = ((e as CustomEvent).detail || {}) as { kind?: string; sessionId?: string | null };
    const kind: ArrivalKind = d.kind === 'resume' ? 'resume' : d.kind === 'console' ? 'console' : d.kind === 'governance' ? 'governance' : d.kind === 'evaluators' ? 'evaluators' : 'blank';
    /*
     * THE ADDRESS IS THE WHOLE POINT. This announcement is broadcast on `window` and every mounted
     * panel hears it, so a seat that is NOT named must not answer it. Measured 2026-09-23: the
     * console's panel answered a package's arrival and wrote that package's greeting into the
     * console's own conversation — 31 messages about another package's prompt, in the thread of the
     * seat whose job is organising cards. Nothing here greets for a seat it is not.
     */
    if (!arrivalIsFor({ kind, sessionId: d.sessionId ?? null }, this.sessionId ?? null)) return;
    this._takeArrival(kind);
    this._greetIfArriving();
  };

  /**
   * SHE OPENS, WHOEVER OPENED — and she only SUGGESTS when there is something to
   * suggest about.
   *
   * BLANK: nobody has said anything and the prompt is empty, so there is nothing to
   * read and nothing to advise on. She introduces herself and asks what to work on.
   * NO OFFER, AND SO NO WAY OUT — a "No thanks" on a turn that offered nothing is a
   * door out of a room with no walls. The owner, 2026-09-28: "You've got the no thanks
   * at the beginning… she doesn't make a suggestion on an empty composer."
   *
   * RESUME: an existing package was opened. She has its conversation — the backend puts
   * the last twenty turns in front of her as CONVERSATION HISTORY, and the workspace
   * rides the request — so she can say where the work stands and OFFER WHERE TO GO NEXT
   * as buttons. That is the same shape as the seat ask, deliberately.
   *
   * AND A PACKAGE THAT HAS RUN IS NOT OFFERED ANYTHING. Recommendations are the learning
   * experience — they used to arrive on every open, so a prompt that already ran end to end
   * was handed three more things to fix every time it was looked at (the owner, 2026-09-24,
   * closing that: "Recommendations are really only for the first before run … once they
   * process a run they're gonna have to ask her for enhancements"). The rule and his words
   * are in shared/autoAdvice; what this seat supplies is the fact. It is read from the
   * thread — `_hasResultTurns`, the same one the card's results fill wears — so it holds on
   * a reload rather than only in the tab that watched the run happen, and it is checked
   * BEFORE the send, because an offer she is not going to make must not cost a model call.
   *
   * AND ONLY IF THE PACKAGE HAS SOMETHING IN IT. An opened package that is empty — no
   * turns, no prompt — gives her nothing to read, and a suggestion about nothing is
   * invention. She says nothing instead. That is the same rule as the blank composer,
   * reached from the other side.
   *
   * AND THE SAME RULE HOLDS: this turn offers, it does not write. `_offerOnly` is set
   * so nothing lands in the prompt before the person picks — the package may have
   * unsaved work in it, and a greeting that edited it would be the worst kind of
   * surprise.
   */
  /**
   * A NEW ARRIVAL HAS NOT BEEN ANSWERED — whatever this seat did on the last one.
   *
   * THE SEAT IS REUSED. One element serves the console and every package opened after it (the
   * surface keeps the same component id — see `_enterPackage`), and `_greeted` was never cleared,
   * so it came to mean "this ELEMENT has spoken" rather than "this ARRIVAL has been answered".
   * Measured 2026-09-24 through the seat's own harness, walking the host's order — the first
   * package greeted (`greetedForA: 1`) and every open after it was silent (`greetedForB: 0`),
   * including reopening the same package. That is the owner's report exactly: "she used to talk
   * … and now she doesn't", with the arrival recorded and the server answering normally.
   *
   * `_conversationEnsured` is cleared with it, and for the same reason: "this package has already
   * been given its conversation" is a fact about the LAST arrival, and a package whose
   * conversations were all deleted since then has to be able to get one. The owner, 2026-09-24:
   * "if there's no conversation and you load the thing, a conversation gets created and Grace
   * starts talking." A failed create is still not retried every frame — it is retried on the next
   * ARRIVAL, which is the next time a person actually opened something.
   */
  private _takeArrival(kind: ArrivalKind): void {
    /*
     * A CLICK THAT LANDS MID-TALK IS ANSWERED BY THE TALK ALREADY RUNNING (owner,
     * 2026-10-16: *"you don't inject text … I know it's not real"* — traced: the rail
     * click and the room's /evals edge both announce within the same model call's
     * flight, the queued arrival retried after it, and TWO replies landed for one
     * click — a doubled answer reads as scripted text. One arrival per flight.)
     */
    if (kind === 'evaluators' && this._sending) return;
    this._wantsGreeting = kind;
    this._greeted = false;
    this._conversationEnsured = false;
  }

  private _greetIfArriving(): void {
    /*
     * A SEAT THAT CAME UP WITH NOTHING TO READ IS AN ARRIVAL, WHETHER OR NOT ONE WAS ANNOUNCED.
     *
     * The seat's own facts are enough to know it: it has a PACKAGE (`sessionId`), it has no
     * conversation, and there is therefore no thread to read. None of that needs an announcement to
     * establish — and depending on one is how a dead screen happened. The owner, 2026-09-24: "if
     * there's no conversation and you load the thing, a conversation gets created and Grace starts
     * talking." Measured the same evening, from the other end: seven consecutive opens of exactly
     * such a package, each with the seat demonstrably up and reading its own package (both of its
     * reads in the backend log), and NOT ONE create and NOT ONE greeting.
     *
     * THE HISTORY QUESTION IS ALREADY ANSWERED when there is no conversation — the same fact
     * `_loadHistory` records when it is handed an empty id — so the greeting must not wait on an
     * attempt that a missing `conversationId` never starts. That wait is the trap the note below
     * describes; this is the other side of it.
     *
     * AND ONLY WHEN THE PACKAGE IS KNOWN TO HAVE NOTHING: the list read has to have come back and
     * have come back EMPTY. An unread list is not an empty one, and treating it as one is how she
     * greeted a package whose conversations — with a finished run in them — were sitting in the
     * very list being fetched.
     *
     * A FAILED READ IS NOT AN EMPTY ONE EITHER, which is why this asks for a REAL array: the row
     * list is only ever assigned from a successful read, so `null` means "this seat could not find
     * out", and "I could not find out" is never a reason to create a conversation.
     */
    const rowsKnown = Array.isArray(this._conversationRows);
    const rows = rowsKnown ? this._conversationRows! : [];
    const currentRow = rows.find((row) => String(row.id) === String(this.conversationId));
    /*
     * THE GREETING BELONGS TO A PACKAGE WITH NOTHING TO READ (owner, 2026-11-03). The Chat's list
     * is its own package's list; an empty newest thread beside other conversations is not a
     * reason to introduce her again. It takes no other conversations, or one empty one; a failed
     * list read is neither.
     */
    const onlyConversationIsEmpty =
      rowsKnown &&
      (rows.length === 0 ||
        (rows.length === 1 && !!currentRow && (currentRow.messageCount ?? 0) === 0));
    if (!this._wantsGreeting && this.sessionId && !this.conversationId
      && Array.isArray(this._conversationRows) && this._conversationRows.length === 0) {
      this._historyChecked = true;
      this._takeArrival('resume');
    }
    /*
     * A CONVERSATION THAT HOLDS NOTHING IS THE SAME ARRIVAL — the Tools seat's own rule, applied
     * here. The rule above needs the seat to have NO conversation at all; a package whose one
     * conversation exists and is empty took no arrival, and this function returned before she was
     * ever asked. That is the tab that opens on an empty thread with no word in it. The emptiness
     * is only claimed once both reads have answered, and `_sending` is excluded so the greeting
     * cannot fire on top of a turn already in flight.
     */
    if (!this._wantsGreeting && !this._sending && this.sessionId
      && this._conversationsRead && this._historyChecked && !this._historyError
      && onlyConversationIsEmpty
      && (this.messages?.length ?? 0) === 0 && this._local.length === 0) {
      this._takeArrival('resume');
    }
    const kind = this._wantsGreeting;
    /*
     * A PACKAGE ALWAYS HAS SOMEWHERE TO TALK, AND OPENING ONE WITH NOTHING MAKES IT.
     *
     * The owner, 2026-09-24: "if there's no conversation and you load the thing, a conversation
     * gets created and Grace starts talking." A package whose conversations have all been
     * deleted has no thread: the seat binds nothing, there is nothing to load, and — this is
     * the part that made it a dead screen rather than an empty one — `_loadHistory` is started
     * by a CHANGE of `conversationId`, so with no id coming there was no attempt, and the
     * greeting waits on that attempt forever.
     *
     * SO THE SEAT MAKES ONE, by the app's one path for it (`_startNewConversation`, the same
     * code the foot's add mark runs): the conversation is created for this package, the
     * package's own column is repointed at it, and the seat moves in. The move is what
     * completes the history attempt, and her greeting then lands in a real thread — with
     * somewhere for the person's next sentence to be written.
     *
     * IT IS ABOVE THE HISTORY GATE ON PURPOSE, because the gate is exactly what cannot open
     * until a conversation exists. And it fires ONCE per package (`_conversationEnsured`):
     * renders are many, and a create that failed must not be retried every frame — the foot's
     * add mark is the person's own way to ask again.
     *
     * AND IT IS KEYED ON THE FACT, NOT ON THE ANNOUNCEMENT. It used to require `kind === 'resume'`,
     * so a seat that was never handed an arrival — for whatever reason, in whichever order its
     * host got there — created nothing at all, which is a package that can never be given its
     * first conversation. `sessionId` is the same fact the arrival was carrying: THIS IS A
     * PACKAGE'S SEAT, so a package's conversation is what it is owed. A composer with no package
     * has no `sessionId` and is still left alone.
     */
    /* THE PAGE OPENS ITS DEFAULT; IT DOES NOT MANUFACTURE ONE (owner, 2026-11-07). This block
       used to create a conversation whenever the seat had a package and no conversation bound
       yet — which is every open, before the list is read — and that is the blank chat a person
       saw on every click. Creation now belongs to ONE place only: the read that returns zero
       rows, after it succeeds. Opening never creates anything. */
    if (!kind || this._greeted || !this._historyChecked) return;
    /* THE OPEN COMES FIRST. While the default thread is being read or created, the greeting must
       not start a turn of its own: that turn would be in flight when the create finishes, and the
       hello meant for the new thread would be dropped as a second send. `_creatingConversation`
       covers the create, `_openingDefault` the read before it. */
    if (this._historyError || this._sending || this._openingDefault || this._creatingConversation) return;
    /*
     * AND NOTHING IS DECIDED ABOUT THIS PACKAGE UNTIL ITS OWN LIST HAS BEEN READ.
     *
     * "HAS THIS PACKAGE RUN?" is answered by the package's own record — an archived conversation
     * (a Run files its results in a thread of its own and archives the one it replaced), or the
     * results in its thread. Both halves arrive ASYNCHRONOUSLY, so for the first frames of an open
     * the answer is not "no", it is NOT KNOWN YET — and a rule that treats "not known" as "no"
     * sends exactly the turn it was written to prevent.
     *
     * Measured 2026-09-24 in Postgres, on the owner's own package (Insurance Technology Scout):
     * ten greeting turns written into the results conversation between 21:04 and 21:19, not one
     * person's turn among them, one per open. Each open fetched the list, and the greeting went out
     * on the frames BEFORE it came back. The owner, watching it: "every time I load and open a card
     * that has been processed already and run … she loads and spins and it pushes the content out
     * of view." The spinner is hers, and the content it pushes is the results they opened the card
     * to read.
     *
     * A PACKAGE'S SEAT WAITS; A COMPOSER DOES NOT. `_readPackageConversations` returns at once for
     * a seat with no `sessionId`, so `_conversationsRead` is only ever awaited where there is
     * something to read. This is a wait of one fetch, and a wait is not an answer.
     */
    if (this.sessionId && !this._conversationsRead) return;
    /*
     * THE TWO "NO OFFER" RULES ARE APPLIED WHERE THE OFFER IS WRITTEN, NOT HERE.
     *
     * They used to `return` from this point — a package that had already been Run, and one where
     * the person had pressed "No thanks" — and a return here is a SILENT SEAT: the arrival was
     * spent, nothing was drawn, nothing was said, and the screen looked exactly like a broken
     * load. The owner, 2026-09-24: "every time you arrive she's supposed to say something … she
     * only makes recommendations before run; once run, she stops recommending." RECOMMENDATIONS
     * STOP — SHE DOES NOT. Both rules choose the words at the end of this function.
     */

    const empty = (this.messages?.length ?? 0) === 0 && this._local.length === 0;
    if (kind === 'blank' && !empty) return;
    /*
     * A PACKAGE WITH NOTHING IN IT IS A NEW PROMPT.
     *
     * This used to say nothing at all, and saying nothing is what a dead screen looks like.
     * The case that found it is a package whose conversations have all been deleted: there is
     * no thread to load, the person is looking at an empty card beside a prompt with no words
     * in it either, and she — who should be the one thing on that screen — was absent. The
     * owner, 2026-09-24: "if the user deletes all the conversations and there's no conversation
     * to load … it's just loading a blank screen … Grace needs to just treat the prompt like
     * it's brand new."
     *
     * SO SHE DOES. The prompt IS new: nothing has been written in it and nothing has been said
     * about it. She introduces herself and asks what they want to work on — the same hello a
     * blank composer gets (NEW_PROMPT_HELLO), because it is the same situation.
     *
     * AND IT IS SAFE WITHOUT A CONVERSATION, which is the other half of the owner's rule and
     * was already true on the server: her greeting is a turn the app asked for (`person_turn`
     * false), so the backend answers it and does NOT write it down, and the person's first turn
     * is what creates the conversation (routes/teacher.py — it reuses the newest conversation
     * the package already owns, or makes one). Nothing here has to invent a thread.
     */
    /*
     * A PACKAGE WITH NOTHING TO READ IS A NEW PROMPT — and NO CONVERSATION is that state,
     * whatever is written in the prompt's seats.
     *
     * The test used to be "has anything been said in it or written in it" (`_packageHasSomething`),
     * which over a package whose conversations have all been deleted answers YES — the seats still
     * hold the person's words — so she skipped the hello and offered next steps about a thread that
     * no longer exists. The owner, 2026-09-24: "if the user removes all conversations and there's
     * zero and there's nothing to load, you have to engage the model … she needs to create a
     * default conversation, say hello, because that's considered a PRE-RUN state." A package with
     * no conversation is that state: the audit trail starts here, so she starts it the way she
     * starts any new prompt.
     *
     * A CONVERSATION WITH TURNS IS STILL READ. This is only true when the seat has no thread to
     * read (`conversationId` empty — the create above is still in flight on that first frame) or
     * the package is empty in both senses, which is the case this rule was written for.
     */
    const nothingToRead = kind === 'resume'
      && onlyConversationIsEmpty
      && (!this.conversationId || !this._packageHasSomething()
          || (this.conversationId && this._historyChecked && !this._historyError
              && !(this.messages?.length)));
    /*
     * AND IT WAITS FOR THE ANSWER WHEN THERE IS ONE COMING. A panel with a session may be the
     * console's or a package's, and that is a server fact (`_readSeatScope`); greeting before it
     * arrives is greeting on a guess. A panel with NO session cannot be the console — a console
     * seat always carries one — so the blank composer's hello does not wait for anything.
     */
    if (this._seatIsConsole === null && this.sessionId) return;
    /*
     * AND THE ARRIVAL IS NOT SPENT WHILE IT WAITS.
     *
     * This flag used to be set near the top of the function, ABOVE the gate that waits for the
     * seat's scope — so an arrival that landed while that read was still in flight was marked
     * answered and then returned unanswered, and the read's own retry (see _readSeatScope)
     * found `_greeted` already true and did nothing. The greeting was lost for the whole life
     * of that seat, and whether it was lost came down to which of two fetches answered first.
     * Measured 2026-09-24: the owner opened a package and she never appeared — "even on a new
     * composer she doesn't even pop up" — and then she did, on another open. A WAIT IS NOT AN
     * ANSWER, so the arrival is only spent once there is nothing left to wait for.
     *
     * AND THE THREAD IS PART OF WHAT IT WAITS FOR (owner, 2026-11-02). A conversation that has
     * not been READ yet cannot be judged empty, so a seat holding an id it has not read waits one
     * more frame instead of spending the arrival on a guess — which is how the Tools tab came up
     * with no thinking and no words.
     */
    if (this.sessionId && this.conversationId && !this._historyChecked) return;
    this._greeted = true;
    /*
     * THE EVALS BUTTON IS THE TRIGGER — AND SHE TALKS THE SAME WAY ON BOTH ICONS (owner,
     * 2026-10-16: *"She has to talk whenever you click the eval's button. That's the
     * trigger"* + *"Keep in mind this is the exact same thing we're going to do on the
     * console so there's no difference — these two behaviors in the chat are exactly the
     * same"*). ABOVE THE CONSOLE BRANCH ON PURPOSE: the console's own hello used to
     * swallow this arrival — its branch returns for every kind once the seat is known to
     * be the console — so the trigger sat DEAD on the console while it worked in
     * governance. ONE branch, both seats; the words are hers either way.
     *
     * SHE SPEAKS ONCE — THE CONVERSATION STAYS (owner, 2026-10-16 late: *"Every time I
     * click evaluator, she starts talking again, so this is not the flow I want … make her
     * speak one time and reload that ID of that conversation every single time a click is
     * done after that … an LLM should not repeat itself."*). The introduction is said
     * once per conversation; every later click leaves it exactly as it stands — the
     * room's announce re-seats the column and the Evals tab draws the conversation, so
     * the SAME conversation comes back into view, word for word, and nothing new is
     * written. The repetition an earlier version produced was THIS FILE re-asking her on
     * every click (a welcome-back prompt per click); the model never repeated itself —
     * the machinery did. A removed (or new) conversation starts over: the mark is keyed
     * to the conversation's own id.
     */
    if (kind === 'evaluators') {
      // No conversation seated yet — the ensure above is creating one, and the next pass
      // (after its history read) runs this branch for real.
      if (!this.conversationId) return;
      if (sectionTaught('evaluators', this.conversationId)) return;
      markSectionTaught('evaluators', this.conversationId);
      void this._send(
        'A person has just opened the EVALUATORS area — the quality-signal place of this system. '
        + 'Introduce it in no more than three short sentences, then ask whether they would like more '
        + 'details. Nothing more — no lists, no depth. Offer no buttons.',
        { silent: true },
      );
      return;
    }
    /*
     * THE APPROVE TAB'S INTRODUCTION (owner, 2026-11-16). *"fix the approval queue so that it
     * loads like the home or console … I wanted to always introduce the section, talk about
     * what's on the console, what's pending approval."* Same mechanism as the console's own
     * hello below: a person has landed, the thread is empty, and she is told what this screen is
     * — with the counts the model carries, so her words name the cards actually waiting. Her
     * reply is written into the conversation, so a later load reads her own words back; delete
     * the tab's conversations and the next arrival introduces the gate again.
     */
    if (this.activeTab === 'approvals') {
      if (!empty) return;
      /* HER INTRODUCTION IS A TURN IN THIS TAB'S CONVERSATION, so it waits for that conversation.
         Sent before the surface's `/surface/conversation_id` lands, the server answers it and —
         correctly — does not write it down, because a place with no conversation yet has nowhere
         to put it; measured 2026-11-16: the reply was on screen and the thread held nothing. */
      if (!this.conversationId) return;
      const model = (this.dataModel ?? {}) as Record<string, any>;
      const waiting = Array.isArray(model.approval_cards) ? (model.approval_cards as Record<string, any>[]) : [];
      const total = Array.isArray(model.cards) ? (model.cards as unknown[]).length : 0;
      const waitingLine = waiting.length === 0
        ? 'No cards are pending approval right now.'
        : `${waiting.length} card${waiting.length === 1 ? ' is' : 's are'} pending approval.`;
      void this._send(
        'A person has just landed on the APPROVE tab — the approval queue of the Design room. '
        + `THIS LOAD'S FACTS, from the surface: the Design console holds ${total} cards in all; `
        + `${waitingLine} `
        + 'Say this in your own words, in two or three short sentences: this is the approval '
        + 'queue; the console holds the room\'s cards and some of them are pending approval; you '
        + 'can list the pending ones here if they would like, and you can work through them '
        + 'together. Do NOT introduce yourself by name. Do NOT list the cards now — offer to. Do '
        + 'not describe the rest of the room, and offer no buttons.',
        { silent: true },
      );
      return;
    }
    if (this._seatIsConsole === true) {
      /*
       * SHE SAYS HELLO WHEN THERE IS NOTHING TO READ — and the test is the THREAD, not whether a
       * conversation row exists.
       *
       * A conversation begins with a person, not with a load (the owner, 2026-09-23: "there's no
       * reason to add a new greeting if the user has not engaged with the console chat … the AI is
       * not the conversation. It's a human being that initiates the conversation"). The first
       * version of this rule read `if (this.conversationId) return` — "she greets only a console
       * with no conversation" — and it silenced her on a console that HAS an empty one: measured
       * 2026-09-23, a conversation existed with 0 messages, so no greeting, and the owner's report
       * was exactly what that looks like from the seat: "This is gone again. The model has
       * disappeared from console again."
       *
       * THE EMPTINESS IS THE FACT, and it is the same test the blank composer uses (`empty`, above):
       * nothing from the surface's history and nothing spoken locally. An empty conversation reads
       * as empty, a conversation with words in it reads as words, and the greeting therefore happens
       * once per thread: she says hello, her reply is written into that conversation, and every load
       * after it reads her own words back instead of saying them again.
       */
      if (!empty) return;
      void this._send(
        'A person has just landed on the console — the index of every package they have built. '
        + 'This screen is an index and nothing more: a card per package, with its name and its one '
        + 'line, and nothing open. YOUR WORK HERE IS ORGANISATION — finding, filtering and sorting '
        + 'their prompts — and NOT writing into one. The seats, the tools and the writes all belong '
        + 'to a package, in that package\'s own chat; there is no prompt open here to write into. '
        + 'Introduce yourself in a sentence or two, say what this screen is and that you can help '
        + 'them find, filter or sort what is in it, and ask what they are looking for. Do NOT '
        + 'describe, quote or comment on any particular package — naming one is reading over their '
        + 'shoulder. Offer no buttons.',
        { silent: true },
      );
      return;
    }
    /*
     * AND THE GOVERNANCE ROOM GETS ITS OWN HELLO (owner, 2026-10-14: *"she should say something
     * on land when people load the page even if it's tucked away to the right … that seat in
     * governance doesn't seem to have any awareness of where she is"*). Same rule as the
     * console's — the THREAD's emptiness is the fact — and the same once-per-thread life: her
     * reply is written into the conversation and every load after reads her own words back.
     * She is told what THIS room is (its rail, its trace facts, the work that belongs to it)
     * and chooses her own words.
     */
    if (kind === 'governance') {
      if (!empty) return;
      void this._send(
        'A person has just opened the governance room — the room that watches what the system '
        + 'did: its traces, what the models cost and how long they took, and the seats that read '
        + 'them. This column is the room\'s own chat, always beside the surface. Their rail is '
        + 'Chat, Trace, Preview, Approve, Evals, States and Repairs; when they select a trace, '
        + 'what is on screen is given to you as the TRACE ON SCREEN facts. YOUR WORK HERE IS '
        + 'READING WITH THEM — what the room shows, where something lives, what a trace says — '
        + 'and NOT writing into the app. Introduce yourself in a sentence or two, say what this '
        + 'room watches and that you can help them read, question or check the work in it, and '
        + 'ask what they would like to look at. Offer no buttons.',
        { silent: true },
      );
      return;
    }
    /*
     * AND A CONSOLE ARRIVAL IS NOT A PACKAGE'S TO ANSWER. Reaching here with it means this seat is
     * known NOT to be the console (the branch above took the console's own case, and a panel whose
     * scope has not been read returned earlier still), so greeting here would be a package
     * answering the library's arrival — the mirror of the bug this addressing exists to fix.
     */
    if (kind === 'console') return;
    if (kind === 'blank') {
      /*
       * THE SAME ONCE-PER-CONVERSATION RULE AS THE OFFER BELOW. A blank composer's hello was
       * guarded only by `empty`, which is enough while her reply is written down — the mark
       * makes it a fact about the conversation rather than about what happened to be drawn.
       */
      if (this.conversationId) {
        if (sectionTaught('arrival', this.conversationId)) return;
        markSectionTaught('arrival', this.conversationId);
      }
      void this._send(
        'A person has just opened a blank composer and has not said anything yet. '
        + NEW_PROMPT_HELLO,
        { silent: true },
      );
      return;
    }

    if (nothingToRead) {
      // The same hello, for the other door into a prompt with nothing in it — see the note
      // where `nothingToRead` is decided.
      void this._send(
        'A person has just opened the Design room, and nothing has been brought in yet. '
        + NEW_PROMPT_HELLO,
        { silent: true },
      );
      return;
    }

    /*
     * AND THIS IS WHERE THE OFFER IS MADE — OR IS NOT MADE, WHICH IS THE WHOLE OF THE TWO RULES.
     *
     * RECOMMENDATIONS BELONG TO THE FIRST VISIT BEFORE A RUN. They are the learning experience:
     * they are how somebody finds out what the machine does with what they wrote, so they come
     * once, before the work has run, and never again. shared/autoAdvice.ts carries the owner's rule
     * in full — "Recommendations are really only for the first before run … once they process a run
     * they're gonna have to ask her for enhancements" — and it names this function as the place the
     * gate is applied. The other rule is the person's own: "No thanks" takes the seat out of
     * volunteering, so the next package they open is not proposed to either.
     *
     * BOTH RULES CHOOSE THE WORDS HERE; NEITHER OF THEM RETURNS EARLIER. A `return` above is a
     * SILENT SEAT — the arrival spent, nothing drawn, nothing said, and a screen that reads as
     * broken — which is why the version of this branch that returned was wrong and is reverted
     * here. What the rules decide is whether a turn is sent AT ALL: an offer she is not going to
     * make must not be paid for with a model call.
     *
     * AND A PACKAGE THAT HAS RUN IS NOT PROPOSED TO. The gate is a fact about the WORK — the
     * results in its thread, or the archived conversation a Run left in its own list — and it is
     * read BEFORE this point, once the list has come back (see the wait above). The owner,
     * 2026-09-24: "whenever the application has run and I reopen the card I should see the results
     * not the model at the bottom of the screen thinking." Reopening a package that has run is
     * somebody coming back to READ it; she waits to be asked.
     */
    const offering = autoAdviceOn() && !this._hasResultTurns;
    if (!offering) return;
    /*
     * SHE SPEAKS ONCE PER CONVERSATION — THE THREAD THEN STAYS (owner, 2026-10-17: *"the design
     * tab the chat is loading every time someone clicks on it … it's only supposed to do it one
     * time that's one conversation and that's the conversation that stays until the user deletes
     * it or creates a new one."*).
     *
     * This offer had no mark of its own: every arrival on a package re-asked her, so a rail tab
     * tapped ten times wrote ten introductions into the same thread — the repetition the owner
     * saw, produced by this file and not by the model. The Evals section was given this mark on
     * 2026-10-16 for exactly the same reason; an arrival is no different, so it uses the same
     * rule and the same store: `shared/sectionTeaching`, keyed by the CONVERSATION's own id.
     *
     * A new conversation has not been taught, and a deleted one takes its mark with it, so the
     * first open after either speaks again — which is the whole of the behaviour he asked for.
     */
    if (sectionTaught('arrival', this.conversationId)) return;
    markSectionTaught('arrival', this.conversationId);
    this._offerOnly = true;
    void this._send(
      'A person has just opened an existing piece of work. You can see the conversation '
      + 'so far and the prompt as it stands. Say briefly where the work is — one or two '
      + 'sentences, concrete, about THIS prompt — then offer two or three things to do '
      + 'next as buttons: [short label](action:write-seat:the seat|the words to put in it) '
      + 'for anything you would write into a seat, or [short label](action:the request) '
      + 'for anything you would do yourself. Keep labels to a few words and use no '
      + 'parentheses inside a button. Ask which one they want and wait. '
      + OFFER_THE_WAY_OUT,
      { silent: true },
    );
  }

  /**
   * IS THERE ANYTHING IN THIS PACKAGE TO READ?
   *
   * Either the conversation has turns, or the prompt has words in it. Both are things
   * she can see and speak about; neither means she should guess.
   *
   * Read from `leftColumnContent`, which is the persisted left column — a JSON string
   * on the wire and already an object in some paths, so both are handled rather than
   * one being assumed. A section with no content is not information: an empty System
   * Role is a row, not something to advise on.
   */

  /**
   * IS THIS CONVERSATION ONE OF THIS PACKAGE'S?
   *
   * The element cannot read `conversations.session_id`; what it CAN do is refuse an id that
   * the package's own list — `/session/right_column/conversations`, what the surface binds —
   * contradicts. An EMPTY list proves nothing (a fresh package, or a list that failed to
   * load: routes/ai.py swallows that failure into a warning), so only a positive
   * contradiction refuses, and the refusal is LOUD. The owner's rule is that a conversation
   * belongs to a package; a seat told otherwise is being lied to, and silence is how it
   * happened.
   */
  /** The seat as the conversation's host. One cast, in one place. */
  private _conv(): conversation.ChatConversationHost {
    return this as unknown as conversation.ChatConversationHost;
  }

  /**
   * THE SEAT'S CONVERSATION FILE. The base page uses `chat/conversation.ts`; <design2-chat-tab>, the
   * Chat console's own page, overrides this with `chat/console-conversation.ts`. The behavior
   * is the same; the file and the package it reads are the seat's own.
   */
  protected get _conversationModule(): typeof conversation {
    return this.conversationSource === 'console'
      ? (consoleConversation as unknown as typeof conversation)
      : conversation;
  }

  private _conversationBelongsToPackage(id: string): boolean {
    return this._conversationModule.belongsToPackage.call(this._conv(), id);
  }

  /**
   * IS THE SEAT BOUND TO A QUERY RECORD? A conversation filed with `tab = "sessions"` holds a
   * validated filter, not a thread. Answering it from both lists, because either can be the one
   * that knows the row (the surface's array, or the package's own server read).
   */
  private _currentRowIsLane(): boolean {
    const id = String(this.conversationId ?? '');
    if (!id) return false;
    const row =
      (this._conversationRows ?? []).find((r) => String(r.id) === id) ??
      (this.conversations ?? []).find((c) => String(c.id) === id);
    return String((row as { tab?: string } | undefined)?.tab ?? '') === 'sessions';
  }

  private _userId(): string {
    // ONE reader of identity, and it is authService's. This element used to read
    // `grace_user_id` from localStorage first — the key a past login wrote — and a stale
    // credential-row id went out as X-User-ID, so the backend answered the owner's own
    // conversation with "not found or not writable by user". getStoredUserId() returns the
    // one identity the app has: the default owner.
    return getStoredUserId();
  }

  // THERE IS NO WRITER HERE, AND THAT IS THE FIX.
  //
  // This element used to POST every turn to /api/conversations/{id}/messages as well as
  // asking for it: `_write('assistant', reply)` after the response, and `_write('user', text)`
  // at send. The backend writes both turns itself (`routes/teacher.py` lines 173 and 315),
  // so the same fact had two homes and the second one doubled every answer.
  //
  // Measured 2026-09-17 in the package's conversation 85d9575b: 12 rows for 4 user turns —
  // each answer twice, 7.5–18ms apart, identical text and identical metadata, which is what
  // two writers look like. The backend log shows the pattern exactly: one
  // `POST /api/teacher/query` followed by one `POST /api/conversations/…/messages`. The user
  // turn never doubled only because this element's `conversationId` was empty at send time,
  // where a chat turn is written before anyone could adopt it.
  //
  // Persisting a turn is the backend's, because the backend is the only party that knows
  // whether a call was a conversation at all (a Run is not one, and writing its prompt here
  // is what put the same text in the output column and in the thread beside it).

  /**
   * Grace's view of the workspace — the same shape the React seat built (buildWorkspaceContext),
   * minus the catalog brief and evaluation metrics, which need host state this element does not
   * yet carry. The left column is read from the persisted JSON; live unsaved edits arrive with
   * the host wiring.
   */
  /**
   * WHICH OF HER BUTTONS THE PROMPT ALREADY SAYS ARE DONE.
   *
   * Read from the seats the panel is given — `leftColumnContent` and the package's description —
   * so a reopened package draws the review with the steps that were finished already spent. The
   * work those buttons asked for IS the prompt, so the prompt is what remembers it: no second
   * record to save, and none to disagree with the seats. See shared/buttonState.
   *
   * Every action on screen is asked about, because the rules differ per action and the asker
   * should not have to know them. Cheap: one pass over the seats per render, on strings the
   * element already holds.
   */
  private _stepsDone(): string[] {
    const actions: string[] = [];
    for (const turn of this._thread ?? []) {
      const raw = String((turn as { content?: unknown }).content ?? '');
      for (const part of raw.split(/(\[.*?\]\(action:[^)]+\))/g)) {
        const m = part.match(/^\[(.*?)\]\(action:([^)]+)\)$/);
        if (m) actions.push(m[2]);
      }
    }
    if (!actions.length) return [];
    let sections: any[] = [];
    try {
      const src = this.leftColumnContent;
      if (Array.isArray(src)) sections = src;
      else if (src) sections = JSON.parse(src)?.sections ?? [];
    } catch {
      sections = [];
    }
    return [...stepsDone(actions, sections, String(this.packageDescription ?? ''))];
  }

  private _buildWorkspaceContext(): string {
    const parts: string[] = [];

    /*
     * THE PACKAGE ITSELF, FIRST — its name and its description.
     *
     * These are the two things she is asked to check before a Run, and until now she was given
     * neither: her context carried the prompt's seats and the output, and nothing about the
     * package they belong to. So she spoke about them from memory, and memory here is the
     * review request she read minutes ago — measured 2026-09-23: "The package still has no
     * description" over a package whose description was already saved.
     *
     * STATED EVEN WHEN EMPTY, and that is the point of the line rather than an oversight: "(none)"
     * is a fact, a missing key is a question, and a model asked a question answers it.
     */
    parts.push('=== THIS PACKAGE ===');
    parts.push(`name: ${String(this.packageTitle ?? '').trim() || '(none)'}`);
    parts.push(`description: ${String(this.packageDescription ?? '').trim() || '(none)'}`);

    let sections: any[] = [];
    try {
      const src = this.leftColumnContent;
      if (Array.isArray(src)) {
        // The live path: the array itself, written by the host on every edit.
        sections = src;
      } else if (src) {
        const parsed = JSON.parse(src);
        sections = Array.isArray(parsed?.sections)
          ? parsed.sections
          : Array.isArray(parsed) ? parsed : [];
      }
    } catch {
      sections = [];
    }

    const leftParts = sections
      .filter((s) => s && (s.name || s.section || s.role || s.type))
      .map((s: any) => {
        const name = s.name || s.section || s.role || s.type || 'Section';
        const content = String(s.content || '').trim();
        return content
          ? `### ${name}\n${content.split('\n').map((l: string) => `  ${l}`).join('\n')}`
          : `### ${name}\n  (empty)`;
      });

    if (leftParts.length > 0) {
      parts.push('=== PROMPT INPUT AREA (what the user is building) ===');
      parts.push(...leftParts);
    }

    if (this.compiledOutput && this.compiledOutput.trim()) {
      parts.push('');
      parts.push('=== OUTPUT PANEL ===');
      parts.push(this.compiledOutput.trim());
    }

    /*
     * THE TOOLS THAT ACTUALLY EXIST — the same list the menu offers and the assembly
     * prompts carry, read from the same table.
     *
     * Without it she does the only thing she can with the Tool Call step: INVENTS a name.
     * Observed before this was added — "I've proposed a generic tool named web_search;
     * give me the exact API or tool name if yours differs" — which puts a call in the
     * prompt that nothing can make. A step whose whole purpose is to reach a real system
     * cannot be written from imagination.
     *
     * Names and one line each: the same words the menu's fly-out shows and the prompt
     * carries, so all three say one thing. The bodies are not here — they arrive when a
     * tool is actually inserted.
     */
    /*
     * THE CONSOLE IS NOT TOLD ABOUT TOOLS, and that is the whole of the tools rule.
     *
     * The owner, 2026-09-23: the console "is a search filter organizational chat interface. You're
     * not going to be doing prompt engineering or prompt adjustments on Grace on the console,
     * because she's tied to the package console in the database" — and its row declares no tools,
     * so it has none. Handing it the register was an invitation to offer a tool into a prompt that
     * is not open, which is exactly the cross-package drift the console must not have. Its own
     * controls are named in her instructions instead (`<reassemble-console …>`).
     *
     * A PACKAGE KEEPS THE REGISTER, deliberately: it is the catalogue of what EXISTS, and it is
     * what stops her inventing a tool name into an empty Tool Call step (see the note above). The
     * gate is `!== true` rather than `=== false` so a failed scope read does not silently strip a
     * package of the catalogue it needs — only a seat KNOWN to be the console goes without.
     *
     * See READ-ME/CHAT-CONVERSATION.md §11 for the decision and what it costs.
     */
    if (this._tools?.length && this._seatIsConsole !== true) {
      parts.push('');
      const runnable = this._tools.filter((t) => t.canRun);
      parts.push(`=== TOOLS AVAILABLE (${this._tools.length} — these are the only ones that exist) ===`);
      parts.push(
        runnable.length
          ? `These ${runnable.length} actually run: ${runnable.map((t) => t.name).join(', ')}.`
          : 'None of them run yet — nothing answers any of these names.',
      );
      parts.push('A tool marked (cannot run yet) can be written into a prompt, and pressing Run');
      parts.push('will not make it do anything. Offer one only when the person asks for it by name.');
      for (const tool of this._tools) {
        parts.push(`  ${tool.name}${tool.canRun ? '' : ' (cannot run yet)'} — ${tool.summary}`);
      }
    }

    if (this.consoleCards && this.consoleCards.length > 0) {
      parts.push('');
      parts.push(`=== CONSOLE — PROMPT LIBRARY (${this.consoleCards.length} packages) ===`);
      this.consoleCards.filter(Boolean).forEach((c: any, i: number) => {
        const facts = [
          c.category ? `category: ${c.category}` : null,
          (c.team_name || c.team) ? `team: ${c.team_name || c.team}` : null,
          (c.model_name || c.model) ? `model: ${c.model_name || c.model}` : null,
          c.status ? `status: ${c.status}` : null,
          typeof c.version === 'number' ? `v${c.version}` : null,
          c.message_count ? `${c.message_count} messages` : null,
          c.likes ? `${c.likes} likes` : null,
          c.lastUsed ? `last used ${String(c.lastUsed).slice(0, 10)}` : null,
        ].filter(Boolean);
        parts.push(`${i + 1}. "${c.title || '(untitled)'}"${facts.length ? ` — ${facts.join(', ')}` : ''}`);
        const desc = String(c.description || '').trim().replace(/\s+/g, ' ').slice(0, 120);
        parts.push(`   id: ${c.id || '(no id)'}${desc ? ` | ${desc}` : ''}`);
      });
    }

    /*
     * THE TRACE BESIDE HER — the governance room's own facts (see the `governanceTrace`
     * property). Stated ONLY when the room wrote them, which it does only once the person
     * has selected one; the numbers are the same ones the header and the tree draw, so her
     * words and the screen agree. The node's raw I/O is deliberately NOT here: it can be
     * orders of magnitude larger than the conversation, and the person can open the
     * Preview tab to read it — she is told what is on screen and where to look, not made
     * to recite it.
     */
    const traceFacts = this.governanceTrace;
    if (traceFacts && typeof traceFacts === 'object') {
      const t = traceFacts as Record<string, unknown>;
      parts.push('');
      parts.push('=== TRACE ON SCREEN (what the person has selected in this room) ===');
      parts.push(`trace id: ${String(t.id ?? '(unknown)')}`);
      if (t.name) parts.push(`name: ${String(t.name)}`);
      if (t.startTime) parts.push(`started: ${String(t.startTime)}`);
      if (typeof t.latency === 'number') parts.push(`latency: ${t.latency.toFixed(2)} seconds`);
      if (typeof t.totalCost === 'number') parts.push(`cost: $${t.totalCost}`);
      if (typeof t.totalTokens === 'number') parts.push(`tokens: ${t.totalTokens}`);
      if (t.sessionId) parts.push(`session: ${String(t.sessionId)}`);
      if (t.userId) parts.push(`user: ${String(t.userId)}`);
      if (typeof t.observationCount === 'number') parts.push(`observations: ${t.observationCount}`);
      const node = this.governanceObservation;
      if (node && typeof node === 'object') {
        const n = node as Record<string, unknown>;
        parts.push(`selected node: ${String(n.name ?? '(unnamed)')} (${String(n.type ?? 'SPAN')})`);
        if (typeof n.latency === 'number') parts.push(`  its latency: ${n.latency.toFixed(2)} seconds`);
        if (typeof n.totalCost === 'number') parts.push(`  its cost: $${n.totalCost}`);
        if (typeof n.totalTokens === 'number') parts.push(`  its tokens: ${n.totalTokens}`);
        if (n.model) parts.push(`  model: ${String(n.model)}`);
        if (n.level && n.level !== 'DEFAULT') parts.push(`  level: ${String(n.level)}`);
        if (n.statusMessage) parts.push(`  status: ${String(n.statusMessage)}`);
      }
      parts.push('Its full input/output is readable in this room\'s Preview tab.');
    }

    return parts.join('\n');
  }

  /**
   * ASK THE SERVER WHAT TOOLS THERE ARE, once, for the workspace context.
   *
   * The same endpoint the composer's menu reads, so the list she is given and the list
   * a person can pick from are one list. A failure leaves it undefined and the context
   * says nothing about tools rather than claiming there are none.
   */
  private async _loadTools(): Promise<void> {
    if (this._tools !== undefined) return;
    try {
      const res = await fetch('/api/ai/tools');
      if (!res.ok) return;
      const body = await res.json();
      const rows = Array.isArray(body?.tools) ? body.tools : [];
      this._tools = rows.map((t: { name: string; summary?: string; can_run?: boolean }) => ({
        name: String(t.name ?? ''),
        summary: String(t.summary ?? ''),
        // WHETHER ANYTHING ANSWERS IT. She has to know, because she is the one who
        // OFFERS a tool: offering one that cannot run is how a person ends up pressing
        // a button that does nothing. The register is the authority — see
        // backend/tool_run.py — and this carries its answer rather than inferring one.
        canRun: t?.can_run === true,
      }));
    } catch {
      // Left undefined: saying nothing about tools is honest, saying "none exist" is not.
    }
  }

  private _gracePrompt(): { ok: true; text: string } | { ok: false; why: string } {
    const room = String(this.instructions ?? '').trim();
    if (!room) {
      return {
        ok: false,
        why:
          'this surface bound no instructions for the room, so the seat has nothing to tell her ' +
          'about where she is — and another room\'s words would be a lie about this one',
      };
    }
    if (this.graceLiveContext === undefined) {
      return {
        ok: false,
        why:
          'this surface did not state whether the seat\'s live workspace follows the room\'s ' +
          'words, so the seat would have to guess at what she is shown',
      };
    }
    if (this.graceLiveContext === false) return { ok: true, text: room };
    return { ok: true, text: `${room}\nCURRENT WORKSPACE\n${this._buildWorkspaceContext()}` };
  }


  /**
   * Strip the XML command tags from a reply and dispatch each one. Returns the prose that is
   * left for the thread. Faithful to InteractiveChatInterface.handleSend — the same events,
   * the same detail shapes, so the host's listeners do not know the seat is now Lit.
   */

  /**
   * ASK HER, WITHOUT PUTTING THE ASK IN THE THREAD.
   *
   * `silent` is the difference between "the person said this" and "something
   * happened and she should say what it means". A silent send still goes to the
   * model, still shows the working state, and still draws her reply; it does not
   * draw a user bubble, because the person did not type anything.
   *
   * That distinction is why this is an option on one send path rather than a
   * second path. A channel that asked on the user's behalf used to exist and was
   * removed for exactly this reason — the ask appeared in the thread as though
   * the person had written it, and it was a wall of instructions nobody could
   * read. The fix is not to stop asking; it is to stop showing the ask.
   */

  /**
   * END THE WORK CARD — the one exit (the host's `a2ui:grace-status` 'idle', the no-build
   * fallback above, or the cap). The stage is NOT cleared: <design2-chat-messages> reads it in the
   * same update to record "Built the page" in the collapsed card's trail.
   */
  private _endWork(): void {
    if (this._workTimer) {
      clearTimeout(this._workTimer);
      this._workTimer = null;
    }
    if (!this._workActive) return;
    this._workActive = false;
    this.requestUpdate();
  }

  /**
   * THE HOST'S BUILD ANNOUNCES ITSELF — `a2ui:grace-status` {state, conversationId} from the
   * room that builds (WritingAreaIndex's person-turn handler): 'building' while the page is
   * being written, 'idle' when the turn is fully done. Scoped to THIS seat's conversation so
   * another room's seat never draws this room's work. One name for one fact.
   */
  private _onGraceStatus = (event: Event): void => {
    graceStatusAction(this as unknown as HostTurnHost, event);
  };

  /**
   * THE THREAD THAT PREDATES THE PACKAGE, WRITTEN DOWN WHEN THE PACKAGE APPEARS.
   *
   * A turn spoken before the first Save has no conversation to live in: the backend
   * refuses it by design ("this turn will not be persisted" — conversations.session_id
   * is NOT NULL, so there is nothing to attach it to), and it stays in `_pending` here.
   * The Save creates the package's conversation; the host hands that id over, and what
   * was spoken is written into it, in order — so the package opens onto the thread that
   * was actually had, not an empty one. Only `_pending` travels; turns the backend
   * already owns are not touched. Returns how many messages landed.
   */
  async flushPendingTurns(conversationId: string, sessionId?: string): Promise<number> {
    if (!conversationId || this._pending.length === 0) return 0;
    // PENDING TURNS BELONG TO THE PACKAGE THEY WERE SPOKEN IN. Spoken before any package
    // existed (owner null) they are owed to the package now being saved; spoken inside a
    // package, only THAT package may receive them — writing them anywhere else is how one
    // package's words landed in another's thread.
    if (this._pendingOwner && sessionId !== undefined && this._pendingOwner !== String(sessionId)) {
      console.error(
        `[chat-panel] refused to write ${this._pending.length} pending turn(s) spoken in package ` +
        `${this._pendingOwner.slice(0, 8)}… into conversation ${String(conversationId).slice(0, 8)}… — ` +
        'a conversation belongs to the package it was spoken in.',
      );
      return 0;
    }
    const pending = [...this._pending];
    let written = 0;
    for (const m of pending) {
      try {
        const resp = await fetch(`/api/conversations/${conversationId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-User-ID': this._userId() },
          body: JSON.stringify({ role: m.role, content: m.content }),
        });
        if (!resp.ok) break;
        written++;
      } catch {
        break;
      }
    }
    this._pending = pending.slice(written);
    if (!this._pending.length) this._pendingOwner = null;
    return written;
  }

  private _onMessageSent(e: Event) {
    messageSentAction(this as unknown as InputActionHost, e);
  }

  /**
   * ENTER SENDS — the same act as the Send button, given to the keyboard.
   *
   * WHAT WAS MISSING, measured 2026-09-30: nothing in this repository DISPATCHES `message-sent`.
   * This seat listens for it (the handler above) and the renderer forwards it (`a2ui-renderer`),
   * so the event was wired at both ends and raised by nobody: a typed question went into `_draft`
   * and no turn was ever sent — the owner, on exactly this: *"no matter what I say, not a single
   * turn."* The path that works is the Send button's (`chat-action-send`).
   *
   * SO THE KEYBOARD TAKES THAT PATH, not a second one of its own: same `_send`, same gates, same
   * conversation. The ingest's own ask box already takes Enter this way (`onKeyDown … Enter →
   * askGrace()`), which is the behaviour being translated here.
   *
   * Shift+Enter is left alone — a newline inside a long question is a person typing, not asking —
   * and `isComposing` so an IME's Enter does not fire a turn mid-word.
   */
  private _onComposerKey = (e: KeyboardEvent): void => {
    composerKeyAction(this as unknown as InputActionHost, e);
  };

  /**
   * THE PRODUCT FOOT'S TWO CALLS — forwarded as the SEAT's own (bubbling, composed), so
   * the room that bound this seat is the one listener and no other surface hears them.
   * The foot only ASKS; what an attach or a tool does is the room's — see <design2-chat-product-tools>.
   */
  private _forwardProductAttach(files: File[]): void {
    this.dispatchEvent(
      new CustomEvent('product-attach', { detail: { files }, bubbles: true, composed: true }),
    );
  }

  private _forwardProductTool(tool: string): void {
    this.dispatchEvent(
      new CustomEvent('product-tool', { detail: { tool }, bubbles: true, composed: true }),
    );
  }

  /**
   * ⌘V ATTACHES WHAT IS ON THE CLIPBOARD — the app's own rule, product room only.
   * ONLY WHEN THE CLIPBOARD IS NOT REALLY TEXT (the app's `filesFromClipboard` rule): a
   * Word or Excel paste carries its own image payload, and attaching a picture of what
   * the person meant to type is worse than doing nothing.
   */
  private _onProductPaste = (e: ClipboardEvent): void => {
    productPasteAction(this as unknown as InputActionHost, e);
  };

  /**
   * START THIS SEAT OVER — an empty thread, ready for the next run.
   *
   * The owner, 2026-09-18: "every time I create a new one by clicking composer, it should clear
   * whatever Grace had and be ready to accept the new run… we're not keeping them." It did not
   * clear: the panel is REUSED across assemblies (the surface keeps the same component id), and
   * `_local` — the turns spoken since it mounted — was never emptied, so a fresh composer opened
   * onto the previous run's sentences. They belong to a conversation that is no longer on
   * screen, which is the same lie the history rule beside this one already refuses: a thread
   * belongs to the conversation it was spoken in.
   *
   * The HOST calls this when it means "a new place" — the Composer click is the one that does.
   * It clears what is DRAWN, nothing else: no request, no row deleted, no conversation touched.
   */
  clearThread(): void {
    this.messages = [];
    this._local = [];
    this.requestUpdate();
  }

  /**
   * A conversation was picked from the selector. Adopting it IS the binding:
   * the history and local turns belong to the conversation they were spoken in,
   * so both are cleared and the new one's history loads through `updated` →
   * `_loadHistory`. The host is told so the package record keeps the same id.
   */
  /**
   * MOVE THE SEAT INTO A CONVERSATION — one writer for the facts that move together.
   *
   * Four things move the seat: picking a row from the list, the console's new conversation, a
   * package's new conversation, and removing the conversation the seat is in. They used to write
   * the same fields by hand, which is how one of them ends up not clearing the thread — or clearing
   * two of the three lists a thread is drawn from. The tab is the CALLER's, because only the list
   * knows which process a row belongs to (`conversations.tab`); a conversation being created has no
   * row yet, so it keeps whatever is showing.
   */
  private _moveSeatTo(id: string, opts: { tab?: string } = {}): void {
    this._conversationModule.moveSeatTo.call(this._conv(), id, opts);
  }

  /**
   * THE HOST TELLS THE SEAT WHERE A RUN'S RESULTS LIVE.
   *
   * A Run makes its own conversation server-side (routes/teacher.py files the findings
   * and the answer in it) and the response carries its id. The host hands that id here,
   * and the seat moves to it by the same path picking a row from the list makes — the
   * thread clears, the new history loads, and the conversation-change event lets the
   * host rebind the package. The conversation being left is already saved and stays in
   * the list: a Run adds a thread, it never destroys one (the owner, 2026-09-24: "the
   * other conversation save it, and it automatically creates a new conversation and
   * loads the results").
   */
  adoptConversation(id: string): void {
    adoptConversationAction(this, id);
  }

  private _onConversationSelect = (e: Event): void => {
    selectConversationPress(this, e);
  }

  /**
   * A NEW CONVERSATION — the foot's add mark (chat-footer dispatches `conversation-new`).
   *
   * The owner, 2026-09-19: "make it work at the bottom so that I can create a new
   * conversation and archive the one that's there… it would get assigned a default title
   * based on the first part of the conversation." And on where it belongs: the console's
   * chat is GLOBAL — "there's conversation IDs per package and in this case it's a
   * conversation ID for the console only… This is the Console package" — so the successor
   * is filed under THIS seat's own session, which is what `sessionId` already is.
   *
   * THE PATHWAY IS THE APP'S OWN; nothing new was added to the server for this:
   *   1. NAME the conversation being left, from the first part of what was said in it —
   *      the rule routes/teacher.py already uses when it creates one (its question's first
   *      80 characters), so a conversation named here and one named there read the same in
   *      the list. Without it the row keeps its working title ("Console — Chat"), and three
   *      of those are three rows nobody can tell apart.
   *   2. ARCHIVE it — POST /api/conversations/{id}/archive. Archived, never deleted.
   *   3. Its successor: POST /api/conversations with this seat's session_id, then point the
   *      session at it (PUT /api/prompt-sessions/{id}), so a reload lands on the new
   *      conversation instead of resurrecting the archived one. Both bindings the seat
   *      reads — /console/conversation_id and /session/right_column/conversation_id — are
   *      the session's own column, which is why repointing it is what makes the move stick.
   *
   * A FAILURE STOPS THE SEQUENCE AND IS SAID IN THE THREAD. Moving the seat to an id that
   * was never created, or archiving without a successor, would leave a person talking into
   * a conversation that is not there.
   *
   * AND IT IS THE CONSOLE'S ACT, ONLY. The owner, 2026-09-19: "it's really important to
   * understand that this is the only place that this global chat is associated. Each package
   * has its own set of conversations, so don't just apply it to both areas." So the gate is
   * first and it is read from the session's own row — `metadata.session_type === 'console'`
   * (GET /api/prompt-sessions/{id}) — not inferred from a tab list or from which props a
   * payload happened to include. A package seat does nothing here: starting a conversation
   * inside a package's own set is a different action, and this design has not specified it.
   *
   * ONE AT A TIME. The foot's add mark (which called this until it retired with the tray's
   * stub set, 2026-10-14) was a click and could not double-fire, but the same work is
   * started by a package being opened with no conversation at all (see `_startNewConversation`'s
   * caller in _greetIfArriving) — and two starts racing would make a package two threads for one
   * open. The body below is unchanged; this is the latch in front of it.
   */
  private _startNewConversation(): void {
    startNewConversationPress(this);
  }

  private async _createConversation(): Promise<void> {
    return createConversationAction(this);
  }

  /**
   * WHICH CHAT THIS SEAT IS. The console's chat is the GLOBAL one, and the reason it can be
   * read reliably is the database's own shape: the console HAS a package — the owner,
   * 2026-09-19: "the console has its own package in the database and everything that happens
   * on the console gets associated with that package… these packages are really important in
   * a database driven system." Its session row carries `session_type: "console"` in its own
   * metadata, written when prompt_sessions_api provisions it. That marker is the gate.
   *
   * 'unknown' IS A THIRD ANSWER ON PURPOSE. A gate that cannot be read must not be treated as
   * a 'no' (the button would do nothing and say nothing), and it must not be treated as a
   * 'yes' (a package's own conversations would be archived under the console's rule).
   */
  /**
   * Read the scope and KEEP it: the trailing button's direction and the new-conversation gate
   * are the same fact, so it is read once and both read it from here.
   */
  private async _readSeatScope(userId: string): Promise<'console' | 'package' | 'unknown'> {
    const scope = await this._seatScope(userId);
    if (scope !== 'unknown' && this._seatIsConsole !== (scope === 'console')) {
      this._seatIsConsole = scope === 'console';
      // The console's hello waits on this answer; tell the greeting it has arrived.
      this._greetIfArriving();
      this.requestUpdate();
    }
    return scope;
  }

  private async _seatScope(userId: string): Promise<'console' | 'package' | 'unknown'> {
    const sessionId = this.sessionId;
    if (!sessionId) return 'package';
    try {
      const res = await fetch(`/api/prompt-sessions/${sessionId}`, {
        headers: { 'X-User-ID': userId },
      });
      if (!res.ok) return 'unknown';
      const body = (await res.json()) as { session?: { metadata?: Record<string, unknown> } };
      const type = String(body?.session?.metadata?.session_type ?? '');
      return type === 'console' ? 'console' : 'package';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Read the package's conversation count (archived rows included) and show it in the
   * leading bar. Called when the seat learns which package it is and whenever this seat
   * changes the set — creating a conversation, archiving one — so the number moves when the
   * thing it counts moves.
   *
   * A FAILED READ CHANGES NOTHING. The count keeps whatever it last had, which is the
   * surface's own list length until the first successful read — real data either way, so
   * there is no stand-in value here and nothing is swallowed: the number simply stays as
   * true as it was.
   *
   * AND THE ATTEMPT IS OVER EITHER WAY. `_conversationsRead` says "this seat is no longer waiting
   * on the list", not "the list came back" — so it is set on every exit, including the failures.
   * The greeting waits on it (see C9 in AGENTS-instructions/THE_CONVERSATION_CONTRACT.md), and a
   * wait that only ends when the server answers would strand a seat on an unreachable one: silent
   * forever, which is the dead screen C8 calls out. A FAILED READ LEAVES `_conversationRows` NULL
   * ON PURPOSE, because "there are no conversations" is a claim only a successful empty read can
   * make — see the gate in _greetIfArriving that requires a real empty array.
   */
  private async _readPackageConversations(userId: string): Promise<void> {
    /* THE TOOLS SEAT'S OWN SHAPE, LINE FOR LINE: the read is the module's, and the zero state is
       answered by the seat's default-open (`_loadDefaultConversationNow`), which creates once. */
    return this._conversationModule.readPackageConversations.call(this._conv(), userId);
  }

  /**
   * THE USAGE READOUT — this seat's tokens, calls, cost and pricing.
   *
   * Langfuse v4 in this deployment runs in events-only mode and no longer serves its sessions
   * endpoint (measured 404), so the readout reads the app's per-call ledger: the same numbers the
   * model calls reported, which is what Langfuse receives. The endpoint answers for this seat
   * when the ledger attributed the call to it, and says so in `scope`. A read that fails is said
   * on the page — it is never drawn as zeros that look measured.
   */
  private async _readUsageSummary(): Promise<void> {
    if (!this.conversationId) return;
    try {
      const res = await fetch(
        `/api/governance/usage/summary?conversation_id=${encodeURIComponent(String(this.conversationId))}`,
        { headers: { 'X-User-ID': this._userId() } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as Record<string, unknown>;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new Error('the usage summary was not an object');
      }
      /* THE READOUT IS THIS CONVERSATION'S OR IT IS UNATTRIBUTED. The endpoint never answers
         with another scope's totals; the page never borrows them. */
      this.usage = body as Record<string, any>;
      this.requestUpdate();
    } catch (err) {
      this._listNote = `The usage readout could not be read: ${String((err as Error)?.message ?? err)}`;
      this.requestUpdate();
    }
  }

  /** THE TAB'S PRESS, ANSWERED — the Tools seat's own method (owner, 2026-11-07). A press usually
   *  lands before the seat knows its package, so the request is latched and `updated` asks again
   *  when `sessionId` arrives. It is asked once per press. */
  loadDefaultConversation(): void {
    loadDefaultConversationAction(this);
  }

  /** THE TAB'S DEFAULT OPEN (owner, 2026-11-07 — the Tools seat's rule, applied here). The seat
   *  lands on the conversation the package points to; if that row is gone, the last one in the
   *  list; with none at all, Grace's hello creates the first. Opening creates nothing else and
   *  saves nothing. */
  /**
   * THE APPROVE ICON'S SIGNAL: is anything waiting for this person?
   *
   * The review list answers the sessions sent to them (`can_answer`); the queue answers the
   * general requests still pending. A failed read is not a zero: the last signal stands.
   */
  private async _readApprovalWaiting(): Promise<void> {
    try {
      const headers = { 'X-User-ID': this._userId() };
      const [reviewsRes, queueRes] = await Promise.all([
        fetch('/api/design/reviews', { headers }),
        fetch('/api/design/requests?decision=pending', { headers }),
      ]);
      const reviewsBody = await reviewsRes.json().catch(() => ({}));
      const queueBody = await queueRes.json().catch(() => ({}));
      const reviews = Array.isArray(reviewsBody?.reviews) ? reviewsBody.reviews : [];
      const requests = Array.isArray(queueBody?.requests) ? queueBody.requests : [];
      const waiting =
        reviews.filter((row: { can_answer?: boolean }) => row?.can_answer === true).length +
        requests.length;
      this._setApprovalWaiting(waiting > 0);
    } catch {
      // A count that could not be read is not a zero; the last signal stands.
    }
  }

  /** The Approve surface has just loaded its list; it knows the answer without a second read. */
  private _onApprovalCount = (event: Event): void => {
    const detail = (event as CustomEvent<{ waiting?: boolean }>).detail ?? {};
    if (typeof detail.waiting === 'boolean') this._setApprovalWaiting(detail.waiting);
  };

  /** A request was filed or answered somewhere else in the room; read the count again. */
  private _onApprovalChanged = (): void => {
    void this._readApprovalWaiting();
  };

  private _setApprovalWaiting(waiting: boolean): void {
    if (this._approvalWaiting === waiting) return;
    this._approvalWaiting = waiting;
    this.requestUpdate();
  }

  /** The bar's own click: open or close its list. The card's own stylesheet draws the two states
   *  (`open` is reflected there): collapsed is the bar alone, open is the rows' exact height. */
  private _toggleConversations = (): void => {
    toggleConversationsPress(this);
  }

  /** The same gesture from the keyboard, because the header is announced as a button. */
  private _onConversationsKey = (e: KeyboardEvent): void => {
    conversationsKeyPress(this, e);
  }

  /**
   * The bar's rows: this package's conversations in the server's order, each one openable.
   * A row that is ARCHIVED says so in the chip the list already uses for a row that is not
   * from here — the row is still reachable, it is just not the live one. Until the server
   * read lands (or if it cannot), the surface's own list is drawn, exactly as before.
   */

  /**
   * THE TRASH ON A ROW — the mark every console card already carries, and its gesture too:
   * first click arms, second removes. A conversation is not deleted by one stray click, and
   * the arming disarms itself so a row cannot be left loaded.
   *
   * THE ONE YOU ARE IN IS REMOVED TOO, AND THE SEAT MOVES OFF IT. That was a refusal, and the
   * refusal deadlocked the two controls: the console's "new conversation" does nothing inside a
   * package, so the one row a package had could not be removed and no second row could be started
   * to move off it. The owner, 2026-09-23: "I'm not able to delete conversations from the packages.
   * It's just basic CRUD process I thought."
   *
   * The guard was there for a real reason — a seat reading a conversation that is not there, and a
   * session pointer on a dead row — and that reason now lives where the delete happens instead
   * (`conversation_api.delete_conversation` moves every pointing session to the newest conversation
   * of the same kind, or to none). So the deletion is safe to make, and what is left for the seat
   * is to follow it: see `_removeConversation`.
   */
  private _onConversationRemove = (e: Event): void => {
    removeConversationPress(this, e);
  }

  /**
   * REMOVE ONE CONVERSATION, AND IF IT WAS THE ONE ON SCREEN, LEAVE NOTHING BEHIND.
   *
   * The removal itself is one call; the rest is what the seat owes the person afterwards. Reading
   * a conversation that is gone would draw an empty thread and a read error where their words were
   * (the seat's own note: "a refusal is not an empty thread"), so the seat moves off it — to the
   * newest live conversation of the same kind this package still owns, or to NO conversation at
   * all. Nothing said yet is a true state to be in: the next thing the person says is what starts
   * a conversation (the server creates it on a person's turn), which is the same rule the console
   * now follows.
   */
  private async _removeConversation(id: string, userId: string): Promise<void> {
    await this._conversationModule.removeConversation.call(this._conv(), id, userId);
    /*
     * THE PACKAGE WITH NOTHING LEFT IS OWED ITS NEXT CONVERSATION.
     *
     * The shared removal moves the seat to no conversation and takes the arrival, but it cannot
     * reach this seat's default open — and creation belongs to that open alone (see the note above
     * the history gate in `_greetIfArriving`). Without this, the greeting that follows is a turn the
     * app asked for: the server answers it and writes nothing down (`routes/teacher.py` refuses to
     * start a conversation for a `person_turn=false` turn), so Grace speaks in a thread that was
     * never registered, the list stays at zero, and the header loses the line naming the
     * conversation. The Tools seat still carries its own create for this case.
     */
    if (this.conversationId) return;
    if (!Array.isArray(this._conversationRows)) return;
    if (this._conversationRows.some((row) => !row.archived)) return;
    this._wantsDefaultConversation = true;
    await ensureDefaultConversation(this);
  }

  /**
   * The first part of what was said here, or nothing — the naming rule routes/teacher.py
   * uses for a new conversation ("request.question[:80]"), so both paths name rows alike.
   * A conversation nobody has spoken in yet has no title to take and keeps whatever it has.
   */
  private _firstTurnTitle(): string {
    const first = (this._thread ?? []).find((m) => String(m.role ?? '') === 'user');
    const text = String(first?.content ?? '').replace(/\s+/g, ' ').trim();
    return text ? text.slice(0, 80) : '';
  }

  /**
   * The successor's title: the naming SCHEME already in use, kept. The console's rows are
   * "Console — Chat" / "Console — Approvals" (prompt_sessions_api gives them that shape), so
   * its new one reads the same way rather than arriving as "New Chat" among them. A package
   * seat, whose conversation is titled from a question, has no such scheme: nothing is sent
   * and the column's own default holds until the conversation is archived and named by step 1.
   */
  private _successorTitle(): string | undefined {
    const current = (this.conversations ?? []).find((c) => String(c.id) === this.conversationId);
    const title = String(current?.title ?? '');
    const scheme = title.match(/^(\S+)\s+—\s+(.+)$/);
    return scheme ? `${scheme[1]} — ${scheme[2]}` : undefined;
  }

  /**
   * One conversation write. Throws with what the server said, so the thread can say it —
   * and deliberately WITHOUT a `.catch()` stand-in on the response: swallowing a failure
   * here is the class the catalog check counts (error-suppression) and the class the owner
   * asked to be told about. An endpoint that does not answer is an error the caller sees,
   * not an empty string it reasons around.
   */
  private async _conversationWrite(
    url: string,
    method: 'POST' | 'PUT',
    body: unknown,
    userId: string,
  ): Promise<Record<string, unknown> | null> {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-User-ID': userId },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${method} ${url} — HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown> | null;
  }

  /**
   * The rail's `tab-change`. Chat and Trace are view switches, except that Trace
   * is also a PROMPT — its note's `AI:` line says the reply is the trace.
   * An EMPTY tab is the rail collapsing itself (the active tab clicked twice).
   */
  private _onTabChange(e: Event): void {
    tabChangeAction(this as unknown as RailTabHost, e);
  }

  /**
   * The spacer's mousedown. "chat-left-spacer" #40001085:2598, state=Default
   * #40001085:2597 — the annotation on the MASTER (not on the instance, which is why
   * it took a second visit to find):
   *   On drag:   dispatch input-resize-start, input-resize-move, input-resize-end
   *   Connects:  drags the chat column's left edge; the whole strip is the target,
   *              not just the glyph
   *
   * So the strip owns the whole gesture: it raises start, tracks the pointer and
   * raises move and end. The host does the sizing, because the column's width is its
   * to lay out. The three names are the annotation's, verbatim.
   *
   * NO POINTER CAPTURE HERE, AND THAT IS A MEASURED DECISION. Capture was tried for the one
   * release it catches and nothing else does — letting go OUTSIDE the window, which fires no
   * mouseup anywhere. It cost far more than it paid: a capture that outlives its pointer sends
   * every later pointer event to that one strip, so the page stops being grabbable at all —
   * the owner, 2026-09-18: "the left is locked. You can't grab it… Grace is locked. You can't
   * grab her… it hangs onto your cursor." The boundary is what tells us instead: crossing it
   * with no button down means the hand is not holding anything, whether it just arrived or
   * just left after letting go.
   */
  private _onGripDown(e: PointerEvent): void {
    frame.onGripDown.call(this._frame(), e);
  }

  /**
   * LET THE PAGE GO — the strip's pointer listeners and its capture off, once. The same discipline
   * the composer's input grip already keeps (`_endDrag` in chat-action-bar, which is called by its
   * release AND by `disconnectedCallback`), applied to the column's strip.
   *
   * WHY IT HAS TO RUN WHERE THE ELEMENT GOES, not only where the mouse does: this element is
   * REPLACED by the renderer whenever the surface re-renders — an assembly landing, a data-model
   * write — and a panel replaced mid-gesture used to leave its `mousemove` listener on the
   * document. That listener went on raising `input-resize-move` at a host that no longer had a
   * gesture, and the layout answered a stray move by STARTING one: the column took hold with no
   * button down, and nothing could release it because the listeners behind it were gone.
   */
  private _releaseGrip(): void {
    frame.releaseGrip.call(this._frame());
  }

  /** The rail's `collapse-toggle` — chat-button state=Selected, clicked again. */
  private _onCollapseToggle(e: Event): void {
    frame.onCollapseToggle.call(this._frame(), e);
  }

  /**
   * The Conversations dropdown's rows. The design's `Data:` line binds this list
   * to the package's conversations, in the white rows of the open variant.
   */
  private _conversationItems() {
    const list = this.conversations ?? [];
    if (!list.length) {
      return html`<p class="conversation-none">No conversations yet for this package.</p>`;
    }
    return html`
      <ul class="conversation-list">
        ${list.map(
          (c) => html`
            <li>
              <button
                type="button"
                data-conversation-id=${String(c.id ?? '')}
                @click=${this._pickConversation}
              >${c.title || c.id || '(untitled)'}${(c.tab || 'chat') !== (this.activeTab || 'chat')
                ? html` <span class="tab-tag">${String(c.tab || 'chat')}</span>`
                : nothing}</button>
            </li>
          `,
        )}
      </ul>
    `;
  }

  /**
   * A row was picked. Raised as the design's `On click:` contract says —
   * `conversation-select { conversationId }` — and caught by the wrapper below,
   * which is the same handler the thread used to raise.
   */
  private _pickConversation = (e: Event): void => {
    pickConversationPress(this, e);
  }

  /** THE VIEW LIVES IN `./design-chat-seat/view.ts` — one template, moved, not rewritten. */
  render() {
    return seatView(this);
  }
}
