/* THE DESIGN ROOM'S OWN SEAT — a WHOLE duplicate of `chat-panel.ts`, retagged
   `design-chat-panel` and renamed to the room that owns it (owner, 2026-10-18: a tab's seat is
   its own file; the only things shared are the lit components and the styling). Duplicated
   whole and renamed — nothing else differs. Never import the shared `chat-panel` into the
   design console's surface: that is the borrowed seat this copy exists to replace. */
/**
 * <design-chat-panel> — GRACE'S SEAT, DRAWN BY THE SURFACE.
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
import { LitElement, html, css, nothing } from 'lit';
// The right column's pieces. Each import is a side effect that registers the tag,
// so <chat-panel> stays self-contained: composing these elements requires them to
// be defined before render, the same rule that forced the main.tsx import above. 
import '@/components/lit/chat-fold';
import '@/components/lit/chat-header';
import '@/components/lit/chat-messages';
import '@/components/lit/small-dropdown';
import '@/components/lit/chat-input';
import '@/components/lit/chat-action-bar';
import historyIcon from '@/assets/figma-chat-history-icon.svg';
// THE READOUT'S MODEL MARK, handed in by the instance that draws it: the file's own node is
// #40001124:7096 and its size moved to 20 in the drawing (2026-09-20).
import readoutModelMark from '@/assets/figma-readout-model-mark.svg';
import '@/components/lit/chat-plugin-tray';
import '@/components/lit/chat-product-tools';
import '@/components/lit/chat-product-thread';
import '@/components/lit/error-banner';
import '@/components/lit/chat-navigation-bar';
import '@/components/lit/sessions-feed';
import '@/components/lit/prompt-input/prompt-textarea';
import logoAsset from '@/components/lit/assets/chat-logo-gemini.png';
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

interface SeatMessage {
  role?: string;
  content?: string;
  /** Which canvas node the turn is about, when it is about one — passed through, never
   *  invented here. See <chat-messages>. */
  nodeId?: string;
  /** The turn's small note (what part of the flow it is). */
  label?: string;
  /** An alert rather than a remark — a held Run that will not go. See <chat-messages>. */
  alert?: boolean;
  /** A run's result, drawn as output (rich text, 14px). See <chat-messages>. */
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
const NEW_PROMPT_HELLO =
  'Introduce yourself in a sentence or two, and ask what they want to work on. '
  + 'Do not guess what they are building, do not list what you can do, and offer '
  + 'no suggestions and no buttons — there is nothing yet to have an opinion about.';

/**
 * ONE SESSION ROW, AS THE LANE RETURNS IT.
 *
 * The route sends these keys (`backend/governance_lanes.py` → `execute`); the feed draws the
 * same seven it draws for its own read, plus the token/cost/duration figures a query may have
 * filtered on. Typed here because the seat hands them straight to <sessions-feed>; the shape
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

export class DesignChat extends LitElement {
  static properties = {
    conversationId: { type: String, attribute: 'conversation-id' },
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
    /** The header's four status slots, relayed to <chat-header>. */
    status: { type: String, attribute: 'status' },
    sessionLabel: { type: String, attribute: 'session-label' },
    sessionName: { type: String, attribute: 'session-name' },
    duration: { type: String, attribute: 'duration' },
    qaScore: { type: String, attribute: 'qa-score' },
    /** Token/cost tallies for <chat-footer>, fed by the host's a2ui:usage listener. */
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
     * `<chat-navigation-bar>`'s `tab-labels` (a JSON map id→{label,tooltip}; see the
     * rail for the shape). Ids are the stable key, labels are presentation — a room
     * that means something else by a shared id says so here instead of renaming a
     * button every other room is using. The seat itself never parses it.
     */
    tabLabels: { type: String, attribute: 'tab-labels' },
    /** The room's rail list of deactivated tabs — relayed to <chat-navigation-bar>. See there. */
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
     * v.4b tray for <chat-product-tools> — the builder's own attach · Figma · GitHub ·
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
  private _conversationRows: Array<{ id: string; title: string; tab: string; archived: boolean; savedAt: string }> | null = null;
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
  /** Token/cost tallies shown in <chat-footer>. */
  declare usage: Record<string, number | string | undefined>;
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
    this.statusText = '';
    this.status = '';
    this.sessionLabel = '';
    this.sessionName = '';
    this.duration = '';
    this.qaScore = '';
    this.usage = {};
    this.leftColumnContent = '';
    this.compiledOutput = '';
    this.consoleCards = [];
    this.catalogFindings = [];
    this.unannotatedInUse = [];
    this.modelLabel = 'Models';
    this.conversations = [];
    this.inputHeight = 0;
    this.activeTab = 'chat';
    this.collapsed = false;
    this.allowedTabs = '';
    this.tracePrompt = true;
  }

  private _sending = false;

  /**
   * THE WORK CARD'S STATE (2026-10-03, late — the owner, on this seat: *"the chat seems
   * underwhelming to me. It's not very performative. It'll need to be for this vibecoding
   * interface because that's their main experience is the chat room"*). `_workActive` spans the
   * WHOLE turn — her reply AND, in a room whose host builds, the page-build that follows it —
   * and `_workStage` names what is happening ('thinking' until the host says 'building' via
   * `a2ui:grace-status`). The card itself (shimmer, elapsed time, collapse) is <chat-messages>'
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
    const d = (e as CustomEvent).detail || {};
    if (typeof d.value !== 'string') return;
    this._draft = d.value;
    this._syncBarText();
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
    const bar = this.renderRoot?.querySelector('chat-action-bar') as
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
    const detail = ((e as CustomEvent).detail || {}) as {
      role?: string; content?: string; nodeId?: string; label?: string; alert?: boolean; result?: boolean;
      messageType?: string | null;
    };
    if (!detail.content) return;  // an empty bubble reads as having said nothing on purpose
    this._local = [
      ...this._local,
      {
        role: detail.role === 'user' ? 'user' : 'assistant',
        content: String(detail.content),
        // Carried through, not decided here: whether a turn is about a node is the
        // host's business, and the element that draws turns only needs to know it.
        nodeId: detail.nodeId,
        label: detail.label,
        alert: detail.alert === true,
        // A host that says "this is a run's result" is believed: the drawing of it is
        // chat-messages' business (rich text, 14px), the fact is the host's.
        result: detail.result === true,
        // THE ENGINE'S TYPE, when the host states it (the Product room's live run lines
        // ride in with their own `starting` / `building` / `finished` / `error` stamps —
        // the thread element groups by exactly this).
        messageType: detail.messageType ?? null,
      },
    ];
    this.requestUpdate();
    // A HOST LINE IS THE THREAD GROWING — follow it exactly as history, a sent turn and a
    // reply already do (the rule `_scrollThreadToBottom` states; the live build's steps and
    // the run's bar arrive by this door). Measured 2026-10-06: without this the column held
    // its scroll while the run's lines landed below the fold — the app follows every line.
    this._scrollThreadToBottom();
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
    const detail = ((e as CustomEvent).detail || {}) as {
      target?: string; why?: string; names?: string[];
    };
    const target = String(detail.target ?? 'that');
    const why = String(detail.why ?? 'the write could not be placed');
    const names = (detail.names ?? []).filter(Boolean);
    const held = names.length ? ` The prompt has: ${names.join(', ')}.` : '';
    this._local = [
      ...this._local,
      {
        role: 'assistant',
        content: `⚠️ Nothing was written to "${target}" — ${why}.${held} The prompt is unchanged.`,
        alert: true,
      },
    ];
    this.requestUpdate();
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
    const detail = ((e as CustomEvent).detail || {}) as { request?: unknown; review?: unknown };
    const request = String(detail.request ?? '');
    if (!request) return;
    /*
     * THIS TURN OFFERS, IT DOES NOT WRITE. The flag outlives the send and is read
     * by _processReply when the answer lands — see the note there.
     */
    this._offerOnly = true;
    /*
     * AND A PACKAGE THAT HAS ALREADY RUN IS NOT REVIEWED AGAIN — she is not put to work, and she
     * is not made to think.
     *
     * A run review is a model call, and a clean verdict is drawn as NOTHING (see `silentVerdict`):
     * so pressing Run on a package with results already in it produced exactly what the owner
     * watched — her thinking in the chat, not a word said, and the results pushed out of view.
     * Measured 2026-09-24: "stop her from thinking after run … I've loaded 1500 times and she
     * never said a word and now all of a sudden you can't stop her."
     *
     * THE REVIEW IS FOR A PROMPT THAT HAS NOT RUN — it is how somebody finds out what the machine
     * does with what they wrote, and it is the gate that holds a FIRST Run until she answers it.
     * Once the results exist there is nothing left to judge that they have not already said, so the
     * Run is released here: no call, no spinner, and the host is told at once.
     */
    if (detail.review === 'run' && this._hasResultTurns) {
      this._pendingRun = 'approved';
      this._releaseQueuedRun();
      return;
    }
    /*
     * AND THIS TURN CAN STOP SOMETHING: a request that carries `review: 'run'` is a Run
     * the host is holding until she says it is ready. A verdict is owed for it either
     * way — `<run_ok/>` releases it, and anything else has to SAY SO, because the host
     * is showing the run as busy and a host that is never told would spin forever. See
     * where the verdict is read, after the reply lands.
     */
    this._reviewingRun = detail.review === 'run';
    // `asked: true` — this channel IS a person asking (see the hard stop in `_send`): the canvas's
    // ✨, its trash's explanation, the seat menu's "what is this seat for". Without it a package
    // that has already run answered a press with nothing at all.
    void this._send(request, { silent: true, asked: true });
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
        window.setTimeout(fire, DesignChat.READ_THE_REPLY_MS);
      });
    });
  }

  /** Her last verdict on a held Run: 'ok', 'blocked', or '' if she did not give one. */
  private _runVerdict: 'ok' | 'blocked' | '' = '';

  connectedCallback(): void {
    super.connectedCallback();
    // THE WORK CARD'S OTHER HALF — the room's host announces its build (see `_onGraceStatus`).
    window.addEventListener('a2ui:grace-status', this._onGraceStatus as EventListener);
    /*
     * THE OPENING MAY HAVE BEEN ANNOUNCED BEFORE THIS SEAT EXISTED. A composer
     * announces itself in the same commit that creates this element, so the event
     * can be gone by the time there is anything to hear it — measured, and the
     * reason the announcement is also recorded (shared/arrival). This is the other
     * half of that: the record is consumed on arrival, and the greeting waits for
     * the history attempt either way.
     */
    // FOR THIS SEAT ONLY. A record left by another seat's arrival stays where it is — see
    // shared/arrival: eating it here is how the seat it was addressed to never hears it.
    const arrived = consumeArrival(this.sessionId ?? null);
    if (arrived) this._takeArrival(arrived.kind);
    void this._loadTools();
    window.addEventListener('a2ui:system-message', this._onHostSay);
    // A write that landed nowhere is reported where the person is already reading. The editor
    // is inside this same surface and has been dispatching this all along with nothing on the
    // other end — see _onWriteFailed.
    window.addEventListener('section-write-failed', this._onWriteFailed as EventListener);
    window.addEventListener('a2ui:ask-grace', this._onHostAsk as EventListener);
    window.addEventListener('a2ui:composer-opened', this._onComposerOpened as EventListener);
    // A chat button's answer arrives here from <chat-messages> and goes down the one send
    // path this seat has — the same one the input uses.
    this.addEventListener('chat-action-send', this._onActionSend);
    // The thumb's length depends on the region's height, so a window resize re-measures it.
    window.addEventListener('resize', this._onOutputScroll);
  }

  disconnectedCallback(): void {
    window.removeEventListener('a2ui:system-message', this._onHostSay);
    window.removeEventListener('section-write-failed', this._onWriteFailed as EventListener);
    window.removeEventListener('a2ui:ask-grace', this._onHostAsk as EventListener);
    window.removeEventListener('a2ui:grace-status', this._onGraceStatus as EventListener);
    window.removeEventListener('a2ui:composer-opened', this._onComposerOpened as EventListener);
    this.removeEventListener('chat-action-send', this._onActionSend);
    window.removeEventListener('resize', this._onOutputScroll);
    this._outputRO?.disconnect();
    this._outputRO = null;
    if (this._deleteTimer) {
      clearTimeout(this._deleteTimer);
      this._deleteTimer = null;
    }
    // A GESTURE CANNOT OUTLIVE THE ELEMENT — the strip's document listeners come off here as
    // well as on the release. See `_releaseGrip` for what a survivor does to the layout.
    this._releaseGrip();
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
  private _onActionSend = (e: Event): void => {
    const text = String((e as CustomEvent).detail?.text ?? '');
    if (!text) return;
    /*
     * THE BRACKETS COME OFF FIRST. A button's action arrives as `[<action>]` —
     * that is the wire the retired seat's buttons sent and the seat still sends
     * it. Parsing the raw text meant every action failed to match, because the
     * string began with `[` rather than with the action name, so a write-seat
     * button fell through to the model and the seat it was supposed to fill was
     * never written. The unwrapping is here because this is where the envelope and
     * the action are separated; below it, `text` is an action.
     */
    const action = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
    /*
     * A PRESSED BUTTON IS SPENT, WHATEVER IT WAS — recorded before anything else can fail,
     * because the press has happened either way and the row is a list the person is working
     * down. The owner, 2026-09-23: "when I click Fill User Role that button should change
     * state ... by deactivating one when it's done that lets the user know it's a list."
     *
     * AND THE MARK BELONGS TO ONE TURN. `turn` comes from <chat-messages>, which knows which
     * turn the button sat in; without it a mark kept by action alone would draw the SECOND
     * Confirm this conversation ever offered as already pressed, because every proposing reply
     * ends with the same confirm link. See ChatMessages.spentTurn.
     *
     * Kept on the SEAT, not on the turn: the thread is re-rendered from the surface's messages
     * on every assembly, and a mark carried in the message would go with it. The seat outlives
     * its own re-renders.
     */
    this._spentTurn = String(((e as CustomEvent).detail?.turn as string) ?? '');
    this._spent.add(action);
    this.requestUpdate();
    /*
     * THE WAY OUT IS HANDLED HERE, NOT SENT. "Skip the advice" is not a question and a
     * dismissal should not cost a model call and three seconds to be acknowledged. The
     * offer is withdrawn and nothing goes to her.
     */
    if (action === NO_ADVICE) {
      this._withdrawOffer();
      return;
    }
    const edit = parseWriteSeatAction(action);
    if (edit) {
      window.dispatchEvent(new CustomEvent('a2ui:write-seat', { detail: edit }));
      return;
    }
    /*
     * A TOOL IS AN EDIT TOO, AND A DIFFERENT ONE. `write-seat` carries words for a seat;
     * this carries the NAME of a tool, and the words come from the register — a tool inserted
     * from here has to be byte-for-byte what the seat's own Tools menu inserts, or the prompt
     * would say one thing when a person put it in and another when she did. See the editor's
     * `_onInsertTool`.
     */
    const tool = parseWriteToolAction(action);
    if (tool) {
      window.dispatchEvent(new CustomEvent('insert-tool', { detail: tool }));
      return;
    }
    /*
     * THE PACKAGE'S DESCRIPTION, OFFERED AS A BUTTON.
     *
     * She writes this one herself, and she reaches for `set-description|<the words>` — not the
     * two-part form every other action uses. Measured 2026-09-23, in the stored conversation:
     * `[Add description](action:set-description|Add a short description for the package)` was
     * pressed, did not parse, and went back to the model as a message — so the person watched a
     * button turn into a sentence and a model call, and the work it promised happened only
     * because she happened to write the tag in her reply.
     *
     * THE SPELLING IS TAKEN AS SHE WRITES IT: the name, then a separator that may be either
     * `:` or `|`, then the words. One reader, so the two forms cannot drift.
     */
    const described = parseDescriptionAction(action);
    if (described) {
      window.dispatchEvent(new CustomEvent('set-package-description', { detail: described }));
      return;
    }
    /*
     * TWO ROWS FOR ONE STEP, MERGED — an edit like the others, performed by the app so the words
     * are moved rather than retyped. See the editor's `_onMergeSeat` and actionLink's note on why
     * a write followed by a removal is not the same thing.
     */
    const merge = parseMergeSeatAction(action);
    if (merge) {
      window.dispatchEvent(new CustomEvent('merge-seat', { detail: merge }));
      return;
    }
    /*
     * A TOOL MOVED TO ANOTHER STEP, AND A ROW'S TEXT REPLACED. Both are repairs she was already
     * offering — as `move-tool:search-the-internet` and `clean-agent-role` — and both came back
     * to the person as "this app does not know how to do that". The intent was right and the
     * names were hers; the capability was missing. See actionLink.
     */
    const move = parseMoveToolAction(action);
    if (move) {
      window.dispatchEvent(new CustomEvent('move-tool', { detail: move }));
      return;
    }
    const replaced = parseSetSeatAction(action);
    if (replaced) {
      window.dispatchEvent(new CustomEvent('set-left-column-text', {
        detail: { target: replaced.seat, content: replaced.text },
      }));
      return;
    }
    /*
     * A REQUEST SHE ALREADY OFFERS AS A BUTTON — translated, never handed over as a token.
     * `review-prompt` has been on her first message of every session since the beginning; see
     * actionLink's note for why it is a sentence she receives and not a word she reads back.
     */
    const asked = requestForAction(action);
    if (asked) {
      void this._send(asked);
      return;
    }
    /*
     * APPLY ALL — the whole list, worked in one press.
     *
     * The seat applies nothing itself: the repairs are writes into the prompt, and the writers
     * live in the host (`merge-seat`, `move-tool`). So this hands the request over and the host
     * applies what the checklist marks as the app's own, then re-derives the list and either runs
     * the held Run or asks her about what is left. See actionLink's note on FIX_ALL.
     */
    if (String(action).trim().toLowerCase() === FIX_ALL) {
      window.dispatchEvent(new CustomEvent('a2ui:fix-all'));
      return;
    }
    /*
     * RUN IT — HER OWN BUTTON, AND THE NAME WAS HERS.
     *
     * The review instruction has ended with "offer to run it" since the beginning, and she did:
     * a champagne message and a button reading [Run it](action:run). The app knew no action
     * called `run`, so a person told their prompt was ready pressed it and got "this app does
     * not know how to do that (run)" — measured 2026-09-23. See actionLink's note on RUN.
     *
     * IT RELEASES THE HELD RUN, it does not start a fresh one: she has just read this prompt and
     * cleared it, so the press is the same approval `<run_ok/>` is. With nothing held the host
     * ignores it (handleRunApproved says why) — nothing runs unreviewed.
     */
    if (parseRunAction(action)) {
      window.dispatchEvent(new CustomEvent('a2ui:run-approved'));
      return;
    }
    /*
     * BUILD THE WIREFRAME — the product room's compile, released by her own button.
     *
     * THE OWNER'S SHAPE, VERBATIM (2026-10-03 evening): *"they're basically prompting Grace and
     * she's doing everything… It only allows them to imagine and vibe-code structure or features
     * — they cannot design in it."* The ask is the THREAD's last person turn, read server-side
     * by the compile — the button carries no words of its own, so what gets built cannot drift
     * from what was said. The host answers by compiling and applying through the one draft store
     * (see WritingAreaIndex's build handler); a refusal comes back as her words in the thread.
     */
    if (parseBuildWireframeAction(action)) {
      window.dispatchEvent(new CustomEvent('a2ui:build-wireframe'));
      return;
    }
    /*
     * EDIT THE SELECTED TILE — the scoped op, STOLEN FROM THE EXAMPLE (see actionLink's note on
     * EDIT_NODE, and the route's own note for the borrowed contract): the host holds the stage's
     * own selection (`draft-select`), and the route edits exactly that node — the model answers
     * with the tile only, never the layout.
     */
    if (parseEditNodeAction(action)) {
      window.dispatchEvent(new CustomEvent('a2ui:edit-node'));
      return;
    }
    /*
     * SAVE THE PACKAGE — the blocker list's first item, and a name she reached for.
     *
     * IT IS THE APP'S OWN SAVE, not a second one written for her: `save-button` is the command
     * `<save-button/>` emits and the one the host answers by reading the sections off the surface.
     *
     * THERE ARE SEVERAL DOORS TO THIS WRITE, AND THAT IS THE DESIGN — the control bar's Save, the
     * keyboard, her `<save/>` tag, and now the button she offers in the thread — because a person
     * saves from wherever their hand happens to be, and redundancy is a usability feature rather
     * than a cost to trim (CANVAS-AND-PROMPT §1: "Redundancy is the feature here. Two ways to do
     * one thing is the cost; a person who can start at either end is the return"). ONE command
     * stands behind all of them: the doors are the usability, the command is what keeps a save a
     * save. See actionLink's note on SAVE — with this name unknown, every repair below it in her
     * list was moot, because a draft has no record yet.
     */
    if (parseSaveAction(action)) {
      // The same command the `<save/>` tag sends — one command, many doors: a tag in her reply, a
      // press on the button she offered, the bar, or the keyboard. See _emitCommand for why the
      // SHAPE matters (the shorthand both save paths used to send was blocked by the gatekeeper).
      this._emitCommand('save-button', { state: 'idle', label: 'Save' });
      return;
    }
    /* NAME THE PACKAGE — the writer already existed (`set-prompt-title`, also dispatched when she
     * writes `<set_title>`); only the button's name was missing. See actionLink's note. */
    const titled = parseSetTitleAction(action);
    if (titled) {
      window.dispatchEvent(new CustomEvent('set-prompt-title', { detail: { title: titled.title } }));
      return;
    }
    // The one destructive repair, as a button: the same act as `<remove_role name="X"/>`.
    const removed = parseRemoveSeatAction(action);
    if (removed) {
      window.dispatchEvent(new CustomEvent('remove-prompt-role', { detail: { roleName: removed.seat } }));
      return;
    }
    /*
     * A COMMAND NOBODY HANDLES IS SAID SO, NOT SENT.
     *
     * A button is either an edit this app knows how to make or a question for her — and when it
     * is neither, sending it to the model is the worst available answer: she replies to the
     * wire format as though it were a request and says she has done the thing (measured
     * 2026-09-23 — "I'll add a short description for the package" over a button that had
     * already failed to parse), so the person is told the work is done by the one path that
     * cannot fail loudly.
     *
     * WHICH IS WHICH IS NOT DECIDED BY THE SHAPE. "confirm" and "set-description" are both one
     * token, and one of them is her own answer that must reach her. So her two words are named
     * (HER_ANSWERS, the vocabulary her instructions fix) and everything else that reads like a
     * command — one token, or carrying a `:` or a `|` — is reported here instead.
     *
     * A sentence with spaces in it is a question, and goes to her as one, exactly as before.
     */
    if (!HER_ANSWERS.includes(action) && (/^[^\s]+$/.test(action) || /[:|]/.test(action))) {
      this._local = [
        ...this._local,
        {
          role: 'assistant',
          content:
            `⚠️ That button asks for something this app does not know how to do (${action.slice(0, 80)}), ` +
            'so nothing was changed. Tell me which step you want and I will do it here.',
          alert: true,
        },
      ];
      this.requestUpdate();
      return;
    }
    // A button carries words she wrote, so the shape is known and there is nothing to
    // work out. Reasoning is off for every chat turn; see _send's note.
    void this._send(text);
  };

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
  private _withdrawOffer(): void {
    declineAutoAdvice();
    const turns = this._local.slice();
    for (let i = turns.length - 1; i >= 0; i -= 1) {
      if (turns[i].role !== 'assistant') continue;
      const stripped = String(turns[i].content ?? '').replace(/\[[^\]]*\]\(action:[^)]*\)/g, '').trimEnd();
      if (stripped === String(turns[i].content ?? '').trimEnd()) return; // nothing to withdraw
      turns[i] = { ...turns[i], content: stripped };
      this._local = turns;
      this.requestUpdate();
      return;
    }
  }

  private _onSendCommand() {
    const text = this._draft.trim();
    if (!text || this._sending) return;
    const textarea = this.renderRoot?.querySelector('prompt-textarea') as
      (HTMLElement & { value: string }) | null;
    if (textarea) textarea.value = '';
    this._draft = '';
    this._syncBarText();
    void this._send(text);
  }

  /* ── THE SESSIONS LANE'S ONE METHOD ────────────────────────────────────────────────────
     Words in; the route turns them into a Langfuse filter, validates it against a catalogue
     built from the app's own filter config, runs it, and hands back the rows. Nothing here
     decides what the words mean — and nothing here writes a turn. A refusal from the lane is
     drawn as its own reason, in the red the seat already uses; it is NEVER an empty list. */
  private async _runSessionsLane(text: string): Promise<void> {
    const textarea = this.renderRoot?.querySelector('prompt-textarea') as
      (HTMLElement & { value: string }) | null;
    if (textarea) textarea.value = '';
    this._draft = '';
    this._syncBarText();
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
    this._laneRows = null;
    this._laneReceipt = '';
    this._laneError = '';
    this.requestUpdate();
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
    this._abort?.abort();
  }

  // The input-area height, dragged by the action bar's gripper — the same
  // gesture and clamps as the console seat (InteractiveChatInterface
  // handleMouseDown/handleMouseMove): min 100, max min(600, panel - 190).
  private _dragStartY = 0;
  private _dragStartHeight = 0;
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
    const d = ((e as CustomEvent).detail || {}) as { window?: string };
    const id = String(d.window || '');
    if (!id) return;
    const showing = this._outputWindows.includes(id);
    const next = e.type === 'toggle-output-window' ? !showing : false;
    this._outputWindows = next
      ? [...this._outputWindows, id]
      : this._outputWindows.filter((w) => w !== id);
    this.requestUpdate();
  }

  private _onResizeStart(e: Event) {
    const d = (e as CustomEvent).detail || {};
    this._dragStartY = typeof d.startY === 'number' ? d.startY : 0;
    this._dragStartHeight = this.inputHeight || 100;
    const bar = this.renderRoot?.querySelector('chat-action-bar') as HTMLElement | null;
    // THE TRAY (or the product room's tools row), not <chat-footer>: the drawing's foot
    // replaces it, so the bar the input height must reserve is the foot's block — the
    // design's own 97px (#40001123:6689), which is what the fallback carries if the
    // element is not up yet.
    const footer = this.renderRoot?.querySelector(
      'chat-plugin-tray, chat-product-tools',
    ) as HTMLElement | null;
    this._barHeight = bar?.getBoundingClientRect().height || 82;
    this._footerHeight = footer?.getBoundingClientRect().height || 97;
  }

  private _onResizeMove(e: Event) {
    const d = (e as CustomEvent).detail || {};
    if (typeof d.clientY !== 'number') return;
    // THE HEIGHT THE HAND IS ASKING FOR — read from the POINTER, never from how far it has
    // travelled. This is the owner's rule for every gripper here (TO-DO.md item 1: "I have to
    // use the cursor"), and the same rule `workspace-layout._rightPxFromPointer` already
    // follows for the width. A height computed as `start + travel` drifts from the hand the
    // moment anything reflows — the cap below clamps, the pane resizes, the footer
    // re-measures — and the edge ends up somewhere the cursor is not, for the rest of the drag.
    //
    // The input area sits above the footer and below this bar, so its floor is the host's
    // bottom edge less the footer. The pointer IS the top edge.
    //
    // The cap must RESERVE the bar, the footer, and the output floor, so a big drag shrinks
    // the output region instead of stretching the panel and dragging the footer along.
    const dynamicMax = this.clientHeight > 0
      ? Math.max(100, this.clientHeight - this._barHeight - this._footerHeight - 120)
      : 600;
    const floor = this.getBoundingClientRect().bottom - this._footerHeight;
    const wanted = floor - d.clientY;
    this.inputHeight = Math.max(
      100,
      Math.min(Math.min(600, dynamicMax), wanted),
    );
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      height: 100%;
      min-height: 0;
      min-width: 0;
      /*
       * NO OVERFLOW HIDING. This host used to clip, and that clip was doing two
       * jobs, both of them wrong. It hid content that overflows — the class of
       * thing that makes a broken layout look contained — and it cut off the rail's
       * edge drop shadow, which is drawn to fall OUTSIDE the rail and onto the
       * surface beside it ("chat-main-menu-vert" #40001066:4301, -4px 4px 10px).
       *
       * Nothing here needs it. The column's scrollers are the inner regions — the
       * thread and the view slot both carry overflow-y: auto — so this box is not a
       * scroll container and has no overflow to contain.
       */
      /* THE PANEL'S FACE — NUNITO, per the owner's ruling, 2026-10-07: "Arial or rounded
         fonts -> becomes Nunito (found in chat interfaces for Grace)... Use our fonts
         only - no API calls." The panel is chat; the figures its children draw render
         Inter (.num). */
      font-family: 'Nunito', 'Inter', system-ui, sans-serif;
      font-size: 14px;
      color: #1c2f4e;
    }
    /*
     * THIS ELEMENT IS THE DESIGN'S right-column-panel-container, and the node it names
     * moved with v.4b: it was #40001066:3272 and it is now #40001119:6025 — same name,
     * same three siblings, new drawing. The container is 634 wide = spacer (20) + rail
     * (74) + panel (540), with paddingTop 10; the drawing's own panel is 540x954.
     *   paddingTop 10 — why the design's rail is 954 tall inside a 964 container.
     * With the strip and the panel both inside this box, the padding insets both and
     * the fill sits behind both — which is what could not happen while the strip was
     * outside it.
     */
    :host {
      padding-top: 10px;
      box-sizing: border-box;
      /* TRANSPARENT, SO THERE IS NOTHING TO KEEP IN STEP. This container (the design's
         right-column-panel-container) and the spacer beside it paint no fill at all: what
         shows through is whatever the column stands on, so when it stands on a canvas the
         canvas IS its background and the two read as one surface with no token to match
         (owner, 2026-09-18). A ground colour here was a second value that had to agree
         with the drawing, and a second value is a thing that drifts. Her own fills — the
         rail, the panel, the turns — are hers, and she looks the same everywhere.
         No backticks in a css literal: this comment is inside one. */
      background: transparent;
    }
    /*
     * The spacer: "chat-left-spacer" #40001085:2598. 20px in the design, 30px here
     * for the reason recorded in the host layout tests; transparent because the
     * node's fill is switched off (or removed) in Figma and the container's fill is
     * what shows through; the glyph's two colours are the component set's two
     * states, and the colour IS the hover — neither state paints a background.
     *
     * AND THE GLYPH SITS AT THE STRIP'S RAIL SIDE, NOT ITS CENTRE (owner, 2026-10-13:
     * *"Scroll bar is still underneath the gripper … brought in closer"*). MEASURED at
     * the governance seam: the app's own 12px scrollbar rides the app's right edge at
     * 90..102px from the browser's edge, and the CENTRED glyph (84..94) sat on its
     * lane. Justified to the panel side the glyph lives at 74..84 — six clear pixels
     * from the scrollbar's lane — while the strip's own width and every number the
     * layout's drag arithmetic keeps stay untouched.
     */
    .gripper-chat {
      flex: 0 0 30px;
      width: 30px;
      /* 5px BETWEEN THE GLYPH AND THE RAIL (owner, 2026-10-17: *"it's supposed to have a little
         maybe a five pixel padding between the gripper and the edge of the vertical navigation
         menu."*). The strip keeps its 30px — the layout's drag arithmetic reads that width — and
         border-box means the 5px comes out of it, so the glyph floats 5px clear of the rail's
         first pixel instead of sitting flush against it. */
      box-sizing: border-box;
      padding-right: 5px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      cursor: col-resize;
      color: #b4b4b4;
      user-select: none;
      /* POINTER-CAPTURE DRAG — the strip keeps the gesture even over a framed application
         (see _onGripDown); no touch or trackpad gesture may take it mid-drag. */
      touch-action: none;
    }
    .gripper-chat:hover,
    .gripper-chat:active {
      color: #7e72e3;
    }
    .gripper-chat svg {
      display: block;
      pointer-events: none;
    }
    /* The rail is <chat-navigation-bar>, which carries its own Figma constraint
       (75px, blue gradient, radius). The panel stacks the remaining pieces; only
       the thread is allowed to grow and scroll.

       NO z-index, NO un-clipping, and neither is missing: both were tried today to
       get the rail's drop shadow out of this element, and both were the wrong kind
       of change — a forced paint order, and a containment guarantee given up for a
       visual effect. The shadow is invisible here because THIS ELEMENT IS NOT THE
       CONTAINER THE DESIGN PUTS IT IN.

       The design's right column is one container holding three SIBLINGS — spacer
       (20, x -14857), rail (74, x -14837), panel (540, x -14763) — so the rail's
       -4px 4px 10px lands on the transparent spacer beside it and on the container
       behind it, across boundaries nothing clips. Here the rail is a CHILD of the
       panel, flush against the edge of the box that clips it, and the panel paints
       over it. Until the rail is the panel's sibling inside a right-column
       container, any fix from inside this element is a workaround. */
    chat-navigation-bar { flex-shrink: 0; will-change: transform; }
    /* The panel FILLS its column and snaps to the edges of the browser window.
       contain: layout paint scopes its internals so a window drag-resize
       doesn't invalidate the whole surface every frame. */
    .panel {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-width: 0;
      /* The console sets --chat-bg on its wrapper (the owner's #2d1831, 2026-09-19);
         the composer sets nothing and keeps the design's white. */
      background: var(--chat-bg, #F7F8F2);
      contain: layout paint;
    }
    /* The split the gripper adjusts: the OUTPUT region flexes and scrolls
       internally; the INPUT chain (menu + input area + footer) hugs its
       content at the BOTTOM, so the footer never moves. Dragging the bar up
       grows the input area and shrinks the output; down reveals more output.
       No fixed heights, no empty slot wells — the frame's 519px was a
       wireframe value, not a contract. */
    /* THE FRAME DOES NOT MOVE — ONLY WHAT IS INSIDE IT. The owner, 2026-09-19: "you've got
       the entire contents of the chat panel scrolling when actually it's supposed to just be
       that window where you chat with the model — so nothing else moves. The frame stays, but
       only the content inside of the frames moves."
       So this region is a fixed frame again: overflow hidden, the bars hold their place,
       and the ONE scroller is the card's own body (.content-scroll, inside the response
       card). That is also where it was before the drawn scrollbar existed; what the drawn
       bar changed is only HOW it is drawn, not WHAT scrolls. */
    .chat-output-wrapper {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      /* The floor: no matter how far the input is dragged, the output keeps a
         visible region — the console reserves 80px for the chat area; this is
         the same rule. Default (inputHeight 0) is the design's own view. */
      min-height: 120px;
      overflow: hidden;
    }
    /* The rail is the thumb's track: 4px at the CARD's right edge, transparent, and it
       takes no pointer events of its own — only the thumb is grabbable, so a click that
       lands beside it goes to the bubble underneath. It rides the card, not the column:
       the frame stays put while the conversation scrolls inside it (owner, 2026-09-19). */
    .scroll-rail {
      position: absolute;
      top: 0;
      right: 2px;
      bottom: 0;
      width: 4px;
      pointer-events: none;
      z-index: 1;
    }
    .scroll-thumb {
      position: absolute;
      right: 0;
      width: 4px;
      border-radius: 10px;
      /* The same thumb the other panes draw (#dadee4) — a value this repository already
         has, not a new one. */
      background: #dadee4;
      opacity: 0.8;
      pointer-events: auto;
      cursor: grab;
      touch-action: none;
    }
    .scroll-thumb:hover,
    .scroll-thumb.dragging {
      opacity: 1;
      cursor: grabbing;
    }
    .chat-input-wrapper {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
      /* v.4b: "chat-input-wrapper" #40001119:6034 — the input stack's own ground,
         #CBE6E3, with 5px above it. The action bar, the input area and the footer
         inside it each paint their own fills over this one. */
      background: #CBE6E3;
      padding-top: 5px;
    }
    /* THE TAB-EXPERIENCE DOOR IS GONE (owner, 2026-10-17: *"every assembly is customized"*
       — and the assembly is the CATALOG's views in the seat's own view slot, not a second
       output area beside them). The Evals view is <evals-index> claiming view-tab="eval"
       in the slot below, drawn by the seat's own per-tab rule. This seat is the box copy
       from Hetzner, unchanged. */
    chat-header { flex-shrink: 0; }
    /* THE LEADING BLOCK'S TOP IS THE DRAWING'S OWN — #40001119:6308 says 16 (it said 20
       before the file moved, 2026-09-20), and every later block takes 6. It is marked on the
       instance that leads (the readout passes variant="lead") rather than left in a custom
       property: the value check compares what it can read, and a var() was a value neither it
       nor a reader could hold against the file. */
    .chat-output-wrapper > chat-header:first-child { --block-pad-top: 16px; }
    /* THE CARD IS BOUNDED BY THE REGION, AND THAT IS WHAT MAKES THE THREAD SCROLL.
       It GROWS to fill what the bars leave (a short thread still fills the region, the
       design's own view) and it SHRINKS no further than the region allows — flex 1 1 auto
       with min-height 0. Its own body (.content-scroll, overflow-y auto) is then the box
       that runs out of room, which is what a wheel needs: while this was flex 1 0 auto the
       card grew to its CONTENT instead, so the inner scroller never overflowed and the
       conversation could not be rolled at all (owner, 2026-09-19: "still cannot scroll, it's
       weird"). The note that used to stand here — that allowing shrink would stop the region
       scrolling — was true while the REGION was the scroller, which it no longer is. */
    chat-header[card] { flex: 1 1 auto; min-height: 0; }
    small-dropdown { flex-shrink: 0; }
    /* "chat-output-slot-area" #40001085:1521 — column, padding 10px 20px, gap 10px,
       vertical HUG. The HUG is why the Conversations row is as tall as the dropdown
       and no taller; only the two below it are drawn to fill.
       ITS GROUND IS THE v.4b BLOCK'S: this row heads the conversations bar and sits in
       the block the drawing paints #CBE6E3, so it paints that instead of the column's
       own token — otherwise a white (or, in the console, plum) strip would cut the
       block in two. */
    .output-slot {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px 20px;
      background: #CBE6E3;
    }
    /* Collapsed to the rail — chat-button state=Selected, clicked again.
       THE MOVEMENT IS THE COLUMN'S, NOT THIS ELEMENT'S, and that is the whole of this rule.
       It used to fade: first display:none (contents gone in one frame, "all of the chat contents
       pop away … and then the bar slides back", owner 2026-09-23), then an opacity fade over
       --dur-pane, which was written and never driven and is now measured — sampled on the console
       with the panes every 40ms, the CONTENT was still being squeezed to nothing (width 803 → 587
       → 357 → 191 → 0) while it faded, so what a person saw was the chat crunching and then an
       empty container sliding shut. The owner: "it should slide shut as a complete component, not
       in pieces … do you have clamps, do you have workarounds, do you have trickery in there to
       give the illusion of it sliding instead of just building it properly."
       SO THERE IS NO TRICK HERE ANY MORE. The element that owns the width — <workspace-layout> —
       holds this whole panel at the size it had open while the column is shut, and lets it
       overflow the narrowing pane (see its _slabWidthPx). Nothing about this element resizes, so
       nothing inside it re-lays-out: the column slides out of the room as one object and the rail
       arrives at the edge as its leading face.
       WHAT IS LEFT IS ONLY WHAT A HIDDEN PANEL MUST STILL DO: stop taking presses, and stop being
       reachable by the keyboard. Both are visibility's, DELAYED on the way out so the slide is
       seen to the end, and immediate on the way in so the panel is live again the instant it
       opens. (No backticks in this comment: this is a Lit css literal and one would end it.) */
    .panel {
      transition: visibility 0s linear 0s;
    }
    .panel.collapsed {
      visibility: hidden;
      pointer-events: none;
      transition: visibility 0s linear var(--dur-pane, 760ms);
    }
    /* The Conversations dropdown's rows, from "small-dropdown" state=open
       #40001085:2414: a column of white tiles, gap 5, radius 4, height 30,
       label #4E68D2 Semi Bold 600 / 14. */
    /* A LONG LIST SCROLLS IN ITS OWN SMALL BOX — more than two rows, or a short window,
       and a slim scrollbar appears inside the dropdown instead of the list stretching the
       Conversations row down the column. Two rows are always held whole (2×30 + 5 gap =
       65px); the viewport term only bites on a short window, where the box shrinks further
       rather than crowding the results area below it. */
    .conversation-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
      max-height: min(65px, 20vh);
      overflow-y: auto;
      overscroll-behavior: contain;
    }
    /* 6px, and WEBKIT-ONLY ON PURPOSE — a scrollbar-width: thin here would take precedence
       in this app's own browser and draw Chrome's 11px bar instead (measured on the Scout's
       23-row list, 2026-10-02: an 11px gutter). The rest of the app's scrollers style only
       through the pseudo-elements for the same reason. (No backticks in this comment: this is
       a Lit css literal and one would end it.) */
    .conversation-list::-webkit-scrollbar { width: 6px; }
    .conversation-list::-webkit-scrollbar-track { background: transparent; }
    .conversation-list::-webkit-scrollbar-thumb {
      background: rgba(0, 0, 0, 0.28);
      border-radius: 3px;
    }
    /* THE ROW IS THE TILE, AND IT HOLDS TWO CONTROLS — the conversation (open it) and the
       trash (remove it). The tile could not stay a <button>: a button inside a button is not
       HTML, and the inner click would fire both. So the tile's own look (white, radius 4, the
       twin shadows, 30 tall) lives on the row and the controls inside it are transparent. */
    /* AND THE ROWS DO NOT SHRINK INTO THE BOX — flex items compress before they overflow
       (min-height: auto), which would squash every tile instead of scrolling the list. */
    .conversation-list li {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      height: 30px;
      border-radius: 4px;
      background: #F7F8F2;
      box-shadow: 2px 2px 6px 0 rgba(0, 0, 0, 0.15), -2px -2px 6px 0 rgba(0, 0, 0, 0.15);
    }
    .conversation-list button {
      border: none;
      background: none;
      font-family: inherit;
      cursor: pointer;
    }
    .conversation-list .conv-open {
      flex: 1 1 auto;
      min-width: 0;
      height: 100%;
      padding: 0 10px;
      text-align: left;
      font-size: 14px;
      font-weight: 600;
      color: #4e68d2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .conversation-list .conv-open:hover { background: #f7fafc; border-radius: 4px 0 0 4px; }
    /* WHEN THE THREAD WAS LAST SAVED — the owner's ask, 2026-09-24: "can you add timestamps to
       the conversations when they're saved."
       IT IS NOT IN THE DRAWING, AND THAT IS WORTH SAYING PLAINLY. v.4b draws no conversation
       selector here at all; this list's look is the older "small-dropdown" state=open
       #40001085:2414 (see registry.json), so there is no drawn time to copy. This is the app's
       own when — the same format the Evals feed shows (shared/when.ts) — recorded as an
       addition the design has yet to catch up with, the way the citation pill is.
       THE COLOUR IS MEASURED, NOT CHOSEN. #3D515B is the card's own line colour — a value the
       file already carries — and on this tile it reads 7.78:1, past AA. The muted greys the
       rest of this file uses (#6c757d, #767676) measure 4.39:1 and 4.25:1 here: both fail, and
       a timestamp is exactly the kind of small text that fails invisibly. */
    .conversation-list .conv-when {
      flex: 0 0 auto;
      padding-right: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #3D515B;
      white-space: nowrap;
    }
    /* The trash, at the row's end. The mark is the one the console cards already carry
       (agent-card-element: the same 24-grid stroke path), and so is the gesture: first click
       arms it, second click removes — a conversation is not deleted by one stray click. */
    .conversation-list .conv-remove {
      flex: 0 0 30px;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #6c757d;
      border-radius: 0 4px 4px 0;
    }
    .conversation-list .conv-remove:hover { background: #f7fafc; color: #b91c1c; }
    .conversation-list .conv-remove svg { display: block; width: 14px; height: 14px; }
    .conversation-list .conv-remove.armed,
    .conversation-list .conv-remove.armed:hover {
      background: #b91c1c;
      color: #ffffff;
      font-size: 13px;
      font-weight: 700;
    }
    /* The list's own line — for a refusal that must be said where it happened. */
    .conv-note {
      margin: 0;
      padding: 6px 0 0;
      font-size: 13px;
      color: #6c757d;
    }
    /* THE ROW'S PLACE TAG — "this isn't from here". A conversation that belongs to another
       tab says where it belongs (the owner, 2026-09-19: "we have a little label saying this
       isn't from approval"), in the muted type, at the floor size the type law allows. */
    .conversation-list .tab-tag {
      margin-left: 6px;
      padding: 1px 6px;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.08);
      color: #6c757d;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .conversation-none {
      margin: 0;
      padding: 8px 0;
      font-size: 13px;
      font-style: italic;
      opacity: 0.7;
    }
    chat-messages { flex: 1 1 auto; min-height: 0; display: flex; }
    /* The host's slot above the content. It takes what its content asks for and
       NOTHING when it is empty — no height, no border, no gap. This is what keeps the
       new slot cost-free for every assembly that does not fill it. */
    /* THE ONE SCROLLER: the card's own body, and the bar over it is DRAWN.
       The owner, 2026-09-19: "just be that window where you chat with the model so nothing
       else moves… only the content inside of the frames moves." So the thread and whatever
       view the rail selected scroll inside the card, the card and the bars stay put, and the
       native bar is switched off in favour of the 4px thumb (see .scroll-rail) — nothing is
       narrowed to make room for it. Only the card's CONTENT travels. */
    .content-scroll {
      flex: 1 1 auto;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      display: flex;
      flex-direction: column;
      gap: 10px;
      /* Firefox: no native bar — the drawn thumb is the only one. */
      scrollbar-width: none;
    }
    .content-scroll::-webkit-scrollbar {
      width: 0;
      height: 0;
    }
    .content-header { flex: 0 0 auto; min-height: 0; display: flex; }
    .content-header ::slotted(*) { flex: 1 1 auto; min-height: 0; }
    /* "chat-output-simple-slot-area" #40001085:2373 — the hole the surface injects into.
       Read from the file, not assumed: the master's own sizing is vertical HUG (it is as
       tall as what is put in it) and the placement #40001085:2391 is vertical FILL (it takes
       the height its parent gives it). NEITHER IS A FIXED HEIGHT, and this rule is the
       placement's: flex 1 1 auto is vertical fill, and the children keep their own heights
       — the feed fills, the repair list hugs.
       The box's own numbers are drawn on both nodes and were not being honoured here: padding
       10px 20px (this had 20px all round), gap 10px between injected children, white fill.
       overflow-y is NOT drawn — the drawing shows one static line — and it is kept
       deliberately: a slot that fills a column whose parent clips (.chat-output-wrapper,
       overflow hidden) would otherwise cut a long repair list off at the panel's edge. */
    .view-slot {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      overflow-y: auto;
      padding: 10px 20px;
      background: var(--chat-bg, #FFFFFF);
    }
    /* TWO VIEWS SHARE THIS ONE HOLE (the design's answer: "holds plain text output and
       inserted functions", plural). The feed FILLS it; the repair list HUGS its content,
       because a list stretched to fill the pane leaves a border around empty space and
       pushes its own rows off the bottom edge — measured: the header sat clipped at the
       panel's lower boundary with the feed above it taking the whole height. The 12px under
       the list is gone: the slot's own 10px gap is the drawn distance between children. */
    .view-slot ::slotted(chat-repair-actions) {
      flex: 0 0 auto;
    }
    /* ONE SLOT, ONE VIEW AT A TIME. The slot can hold several views at once (the trace feed
       AND the eval feed are both slotted), and each rail tab shows only its own: everything is
       hidden by default, and the tab's class turns its view on. The trace tab renders its own
       fold branch above, so the trace feed is hidden here everywhere; the eval feed exists only
       under Evals; the repair rows belong to Approvals and their chat-top branch, nowhere else.
       A view shown under the wrong tab is the bug this fixes: Evals used to draw the trace feed
       because the slot had no idea which tab was looking. */
    .view-slot ::slotted(trace-feed) { display: none; }
    .view-slot ::slotted(eval-feed) { display: none; }
    .view-slot ::slotted(chat-repair-actions) { display: none; }
    .view-slot.tab-eval ::slotted(eval-feed) { display: block; }
    .view-slot.tab-approvals ::slotted(chat-repair-actions) { display: block; }
    .view-slot.tab-repair ::slotted(chat-repair-actions) { display: block; }
    /* A ROOM'S OWN VIEW, PER TAB — the same one-slot-one-view discipline as the tag
       rules above, made generic so the seat needs no room's names: the view declares its
       tab on itself (the view-tab attribute, e.g. view-tab="trace" — the attribute
       _viewSlotted reads) and only the active tab's claimant draws. Everything claiming a
       tab is hidden first; the two showing rules are the two tabs that have a claimant
       today — a room whose view declares another tab adds that pair the day the view
       exists. A view naming NO tab is not governed here: it is chat furniture, and
       _anyForeignViewAssigned is that door. */
    .view-slot ::slotted([view-tab]) { display: none; }
    .view-slot.tab-trace ::slotted([view-tab="trace"]) { display: block; }
    .view-slot.tab-tools ::slotted([view-tab="tools"]) { display: block; }
    /* THE SESSIONS TAB'S OWN OUTPUT — the panel draws this view itself (no slot, no
       mounting): <sessions-feed> reads its own feed and fills the column. */
    .sessions-out {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }
    .sessions-out sessions-feed { flex: 1 1 auto; min-height: 0; }
    /* THE EVALS TAB'S VIEW — the same pair as the two above, for the tab whose view is the
       evaluators index (owner, 2026-10-17: *"you just take the exact information and stick
       it into the chat output — we'll design it later"*). */
    .view-slot.tab-eval ::slotted([view-tab="eval"]) { display: block; }
    /* THE DESIGN SEAT'S UX VIEW — REMOVED 2026-10-18 (owner, on the counters view: *"it's
       useless … a small, unnecessary vanity metric … no call to action or functionality tied to
       it"*). The rule stays because the tab stays: when the UX tab has a view of its own, this
       is the one line that draws it. */
    .view-slot.tab-ux ::slotted([view-tab="ux"]) { display: block; }
    /* THE EVALS VIEW PAINTS NO GROUND — the owner asked for it transparent (2026-09-24), so
       the drawing's ground reads through the column. Scoped to the eval tab: the chat and the
       other views keep the design's own sheet. */
    .panel.tab-eval { background: transparent; }
    .view-slot.tab-eval { background: transparent; }
    /* The trace fold holds the same slot; only the feed it names may draw there. */
    .fold-wrap ::slotted(eval-feed) { display: none; }
    .fold-wrap ::slotted(chat-repair-actions) { display: none; }
    /* …and only the view that NAMED the trace tab may draw there: it is the trace tab's
       hole, so a claimant of any other tab is hidden — the pair's other half. */
    .fold-wrap ::slotted([view-tab]:not([view-tab="trace"])) { display: none; }
    /* THE CHAT TAB CARRIES THE FINDINGS TOO — AND ONLY THE FINDINGS.
       The console must not open on a blank chat (owner, 2026-09-18: "I'm building a demo and
       I don't want blank chat to open up, so add it to the chat as well… just make sure it's
       collapsed by default"). It is the SAME slot the rail's tabs draw from — one element,
       two places, so the two can never disagree — and the filter is what keeps the chat
       honest: a TraceFeed slotted for a package's rail is not drawn above a package's thread.
       It sits inside the column's one scroller, so a long list scrolls the column instead of
       growing a second scrollbar, and the list itself arrives collapsed: the person opens it,
       and the thread stays the first thing they meet. */
    .chat-top {
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 0 0 auto;
      padding: 10px 20px 0;
      background: var(--chat-bg, #FFFFFF);
    }
    .chat-top ::slotted(*) { display: none; }
    .chat-top ::slotted(chat-repair-actions) { display: block; }
    /* AND THE ROOMS' OWN VIEWS DRAW — the allow-list above is what keeps this hole to KNOWN
       views only (2026-10-03: the Product room's context strip was assigned, projected, and
       then hidden here — measured on the live page as a zero-sized element). A room's view
       joins the list the day the room exists, named, nothing else admitted.
       THE STRIP'S LINE IS GONE WITH THE STRIP (late 2026-10-03): the owner removed the
       catalogue chooser, so nothing foreign is assigned today — the next room's view joins
       this list the day it exists, the same rule as before. */
    /* THE FILED INSPECTIONS, UNDER APPROVALS — the governance reports as cards, not chat turns:
       the header in the header's cream, the attention rows in amber, the ok rows in green. */
    .inspection-reports { display: flex; flex-direction: column; gap: 8px; padding: 4px 10px 10px; }
    /* THE FOLDS ARE <chat-fold> NOW — the catalogue's 40px white dropdown tile, shared
       with the catalog check and the trace. What the panel adds is the margin around it. */
    .fold-wrap { margin: 4px 10px 8px; }
    .inspection-report {
      background: rgba(0, 0, 0, 0.03);
      border-left: 2px solid rgba(0, 0, 0, 0.12);
      border-radius: 6px;
      padding: 8px 10px;
      font-size: 13px;
      line-height: 1.5;
      color: #444444;
    }
    .inspection-report .line-head { color: #171717; font-weight: 700; margin-bottom: 2px; }
    .inspection-report .line-attention { color: #fbbf24; }
    .inspection-report .line-ok { color: #4ade80; }
    /* What an EMPTY view slot draws. The slot is filled by the surface, so an empty
       one means the surface has not put anything there yet — a state, not a blank.
       THE LINE IS THE FIRST LESSON, NOT A SPINNER. It used to read "Loading the X view…",
       which was untrue twice over: nothing is loading (the slot is filled by the surface,
       synchronously), and the person is looking at a demo whose whole point is to be
       explored empty (owner, 2026-09-18: "offer empty slots and offer advice in those
       slots… letting them know how Grace handles an empty prompt"). So an empty view says
       what the view IS and what would fill it. */
    .view-waiting {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: #6B7280;
    }
    .view-empty { line-height: 1.5; }
    .view-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid #D1D5DB;
      border-top-color: #1FACC2;
      border-radius: 50%;
      animation: view-spin 0.8s linear infinite;
    }
    @keyframes view-spin {
      to { transform: rotate(360deg); }
    }
    chat-action-bar { flex-shrink: 0; }
    chat-input { flex-shrink: 0; }
    chat-footer { flex-shrink: 0; }
    chat-plugin-tray { flex-shrink: 0; }
    /* A seat handed over by the host fills the column. The empty modifier is display:none rather
       than a zero-height box on purpose: an empty flex child with flex-grow would take the space
       the element's own pieces are supposed to have. */
    .seat { flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; }
    .seat.empty { display: none; }
    ::slotted(*) { flex: 1 1 auto; min-width: 0; min-height: 0; }
  `;

  private get _thread(): SeatMessage[] {
    /*
     * THE SURFACE'S HISTORY FIRST, THEN WHAT IT DOES NOT YET CARRY — and the second half
     * is why a turn must not be drawn twice.
     *
     * A local turn is not a second kind of turn: the seat WRITES each one into the
     * package's conversation as it is spoken (`_write`). So the moment the surface hands
     * that conversation back — the next assembly, a reload, a re-assert — the same turn
     * exists in `messages` AND in `_local`, and `[...messages, ..._local]` draws it twice.
     * Measured 2026-09-17 in the console chat: "ping from the seat" twice, and her reply
     * twice, in the order they were spoken.
     *
     * The conversation is the source of truth (Data-Binding.md: the value arrives by
     * path), so any local turn the surface's list now ends with is RELEASED — it is the
     * same turn, back from where it was written. Only local turns the conversation has
     * not caught up with yet are appended.
     */
    const fromSurface = this.messages || [];
    const local = this._local;
    if (!fromSurface.length || !local.length) return [...fromSurface, ...local];

    const same = (a: SeatMessage, b: SeatMessage) =>
      (a?.role || '') === (b?.role || '') && (a?.content || '') === (b?.content || '');

    let caughtUp = 0;
    const max = Math.min(local.length, fromSurface.length);
    for (let n = max; n > 0; n--) {
      const tail = fromSurface.slice(-n);
      const spoken = local.slice(-n);
      if (tail.every((m, i) => same(m, spoken[i]))) { caughtUp = n; break; }
    }
    return [...fromSurface, ...local.slice(0, local.length - caughtUp)];
  }

  /**
   * DOES THE THREAD CARRY A RUN'S RESULTS? The card's results state is this one
   * fact — read from the same thread the messages element draws, and bound onto
   * the card (chat-header's has-results), so the slot's colour and the turns'
   * marks can never disagree (see AGENTS-instructions/OUTPUT-STYLING.md R4).
   */
  private get _hasResultTurns(): boolean {
    if (this._thread.some((m) => m.result === true)) return true;
    /*
     * AND A RUN IS ALSO A ROW — the fact that does not depend on what is loaded.
     *
     * This read the thread and nothing else, so it answered "no run here" whenever the seat was
     * between conversations: no history fetched yet, no conversation bound, or the conversation
     * the package points at not being the one the results went into. Measured 2026-09-24, at the
     * moment the owner was watching it happen: the seat fetched the run's history, the person
     * pressed nothing, and a SILENT turn still went out and was written into the results
     * conversation ("the app asked for this turn (person_turn=false): Grace is opening the
     * conversation") — with the results sitting in that very thread.
     *
     * C6 is the row: a Run files its results in a conversation of its own and ARCHIVES the one it
     * replaced, so a package carrying an archived conversation is a package that has run. That is
     * read from the server's own list (`_readPackageConversations`, archived rows included), which
     * is fetched when the seat learns which package it is — before any history and whatever the
     * binding says. Erring towards silence is the correct side to err on: the rule is that a
     * package which has run is not talked at.
     *
     * THE CONSOLE IS NOT A PACKAGE and runs nothing, so its own archived rows (approvals, an
     * earlier welcome) must not silence it — that is why this half is skipped for the console.
     */
    if (this._seatIsConsole === true) return false;
    return (this._conversationRows ?? []).some((r) => r.archived === true);
  }

  // ── The slot contract. See the header. ───────────────────────────────────────

  /**
   * A slot in this element's own shadow root, by name (undefined = the default
   * slot). ONE place does the lookup and the cast, because `querySelector` returns
   * `Element` and `assignedNodes` lives on `HTMLSlotElement` — spelled out here so
   * neither reader has to know that.
   */
  private _slot(name?: string): HTMLSlotElement | null {
    const selector = name ? 'slot[name="' + name + '"]' : 'slot';
    const found = this.renderRoot?.querySelector(selector) as HTMLSlotElement | null;
    return found ?? null;
  }

  /** Is a seat supplied by the host? Read at render time — the light DOM is the truth. */
  private _seatSlotted(): boolean {
    const assigned = this._slot()?.assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE)) return true;
    // The light DOM covers the case slotting does not report: jsdom's slotting is thin, and a host
    // may append a seat after this element's first render.
    //
    // A child that NAMES another slot is not a seat. The surface puts the Trace view in this
    // element's "view" slot, so a bare count of children read that as "the host handed me a seat",
    // rendered the seat slot in place of the panel body, and took the entire rail off the screen
    // — the collapsed right column measured 82px with nothing in it. Measured 2026-09-17.
    return Array.from(this.children).some((el) => !el.getAttribute('slot'));
  }

  private _onSlotChange(): void {
    // A seat or a view arrived or left. Nothing is cached: the next render reads the
    // light DOM again.
    this.requestUpdate();
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
    const lines: Record<string, string> = {
      versions: 'No versions yet. A version is written when this package is saved.',
      tools: 'No tools yet. A Tool Call seat in the prompt is what names one.',
      executions: 'No runs yet. Press ▶ Play the run and this flow\'s run lands here.',
      eval: 'Nothing has been judged yet. Press Run and each run\'s verdict lands here, one row per run.',
      trace: 'Nothing traced yet. The canvas\'s own events appear here as they happen.',
      states: 'Sample drawings only. Run the flow to draw the real one.',
      repair: 'Nothing to repair. The catalog checker found no open findings.',
    };
    const line = lines[this.activeTab]
      ?? `Nothing in this view yet — the surface fills it when this place has something to show.`;
    return html`<span class="view-empty">${line}</span>`;
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
    return this.allowedTabs
      .split(',')
      .map((tab) => tab.trim())
      .includes('approvals');
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
    const claims = (el: Element): boolean =>
      el.tagName.toLowerCase() !== 'slot' && el.getAttribute('view-tab') === tab;
    const assigned = this._slot('view')?.assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE && claims(n as Element))) return true;
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'view' && claims(el),
    );
  }

  private _viewSlotted(): boolean {
    const wanted = this._wantedViewTag();
    const assigned = this._slot('view')?.assignedNodes?.({ flatten: true }) ?? [];
    /* TWO WAYS A VIEW BELONGS TO THIS TAB — its TAG is one this tab wants (the seat's
       own views: trace-feed, eval-feed, chat-repair-actions), or the ROOM declared the
       tab on the element itself (`view-tab="<rail tab id>"` — the door that lets a
       room's own furniture fill this hole without the seat learning room names).
       Either way its waiting line must not draw: the view is coming, or here. */
    const cameFor = (el: Element): boolean =>
      (!!wanted && el.tagName.toLowerCase() === wanted)
      || (!!this.activeTab && el.getAttribute('view-tab') === this.activeTab);
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE && cameFor(n as Element))) return true;
    // The light DOM covers what slotting does not report: jsdom's slotting is thin,
    // and the surface's child may be appended after this element's first render.
    // A SLOT ELEMENT IS NOT A VIEW. When a host sits between this panel and the
    // surface — <room-embed> re-projects the surface's children into these slots —
    // the children seen here are `slot` elements, which PROJECT content rather than
    // being it. Counting them claimed a view was slotted when the host had none, and
    // the waiting line was suppressed for a view that was never coming.
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'view' && el.tagName.toLowerCase() !== 'slot' && cameFor(el),
    );
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
    const known = new Set(['trace-feed', 'eval-feed', 'chat-repair-actions']);
    /* A TAB VIEW IS NOT FURNITURE. A room's rail-tab view declares `view-tab` on itself
       and draws in the hole under its own tab (the `view-tab` rules in the styles); this
       door feeds the chat-top strip ABOVE the thread and must not see those — admitting
       one drew an empty chat-top band on every Chat tab, because that strip's own styles
       allow only the repair rows. Foreign here means: a tag this seat does not own AND
       no tab claimed — the Product strip was that, and the next such strip joins by
       nothing but this check. */
    const isFurniture = (el: Element): boolean =>
      el.tagName.toLowerCase() !== 'slot'
      && !known.has(el.tagName.toLowerCase())
      && !el.hasAttribute('view-tab');
    const assigned = this._slot('view')?.assignedNodes?.({ flatten: true }) ?? [];
    for (const n of assigned) {
      if (n.nodeType === Node.ELEMENT_NODE && isFurniture(n as Element)) return true;
    }
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'view' && isFurniture(el),
    );
  }

  /**
   * DOES THIS TAB DRAW A VIEW ABOVE THE THREAD. Two cases, one place: the console's repair
   * rows on Approvals (their own recorded rule), and a room's foreign view on Chat (the
   * Product room's context strip, 2026-10-03 — the room must open with its chooser visible,
   * the same "never opens on a blank chat" the console's rows answer).
   */
  private _chatTopView(): boolean {
    return (this.activeTab === 'approvals' && this._findingsSeat())
      || (this.activeTab === 'chat' && this._anyForeignViewAssigned());
  }

  /**
   * WHICH SLOTTED ELEMENT THIS TAB'S VIEW IS — each rail tab draws one view, and the
   * slot can hold several at once. A tab without a view element yet (tools, versions,
   * runs, states) has none, so its waiting line shows; the views that exist answer to
   * their own tag, so the trace feed never stands in for Evals and vice versa.
   */
  private _wantedViewTag(): string | null {
    switch (this.activeTab) {
      case 'trace': return 'trace-feed';
      case 'eval': return 'eval-feed';
      case 'repair':
      case 'approvals': return 'chat-repair-actions';
      default: return null;
    }
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
    return this.activeTab === 'chat' || this.activeTab === 'approvals' || this._evalsDrawsThread();
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
    return this.activeTab === 'eval'
      && this.evalsTalk
      && !this._tabClaimant('eval')
      && !this._viewSlotted();
  }

  /**
   * Whether the status bar will draw a line — the same condition <chat-header> applies to its
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
   * The status line for <output-header> — the frame's own line built from the live slots,
   * in the same order and punctuation chat-header uses. The usage figures are NOT joined
   * here: output-header owns the Tokens/Calls readouts it is handed.
   */
  /**
   * WHETHER THE ROOM HAS SLOTTED ITS OWN READOUT STRIP (the trace seat's facts — owner,
   * 2026-10-13 late: they live in the seat's readout bar, "It goes here"). The relay
   * slot below sits inside <output-header>; this flag rides the same render and turns
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
    return parts.join('  |  ');
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
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
    }
    if (changed.has('conversationId')) void this._loadHistory();
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
     * The head is placed by <chat-messages> (it is the element that knows where the results
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
      const thread = this.renderRoot?.querySelector('chat-messages') as
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
    if (this.messages?.length || !this.conversationId) { this._historyChecked = true; return; }
    if (!this._conversationBelongsToPackage(this.conversationId)) { this._historyChecked = true; return; }
    try {
      const resp = await fetch(`/api/conversations/${this.conversationId}/messages?limit=200`, {
        headers: { 'X-User-ID': this._userId() },
      });
      if (!resp.ok) {
        // A DENIAL IS LOUD (THE_PACKAGE_CONTRACT §7, invariant 12 — the database and the
        // API both answer a refusal with 403, deliberately). This used to `return` here, so
        // "you may not read this conversation" drew as "nothing was ever said here" — the
        // same pixels as an empty thread, and the same for a 404 and a 500.
        this._historyError = `This conversation could not be read (HTTP ${resp.status}).`;
        console.error(`[chat-panel] history read refused for ${String(this.conversationId).slice(0, 8)}…: HTTP ${resp.status}`);
        this._historyChecked = true;
        this.requestUpdate();
        return;
      }
      const data = await resp.json().catch(() => ({}));
      const rows: SeatMessage[] = Array.isArray(data?.messages) ? data.messages : [];
      this._historyError = '';
      this._historyChecked = true;
      if (!rows.length) { this.requestUpdate(); return; }
      // A GOVERNANCE INSPECTION IS A REPORT, NOT A CHAT TURN. The inspector files its verdict in
      // the console's own conversation (metadata kind='inspection'); the owner, 2026-09-19: "this
      // should be under approvals… not under chat". The reports are taken OUT of the thread here —
      // they render under the Approvals tab — and the running history still sits in the trace
      // (lib/trace-source subscribes to the app logger).
      const reports: SeatMessage[] = [];
      for (const row of rows) {
        const meta = (row as { metadata?: { kind?: string; verdict?: string; at?: string } }).metadata;
        if (meta?.kind === 'inspection') {
          logger.info(`[inspection] ${meta.verdict ?? 'not done'} · ${meta.at ?? ''}`, {
            verdict: meta.verdict ?? null,
            at: meta.at ?? null,
          });
          reports.push({ role: row.role, content: row.content });
        }
      }
      this._inspectionReports = reports;
      this.messages = rows
        .filter((row) => (row as { metadata?: { kind?: string } }).metadata?.kind !== 'inspection')
        .map((m) => {
          const meta = (m as { metadata?: { kind?: string } }).metadata;
          // A RUN'S RESULTS KEEP THEIR MARK ACROSS A RELOAD: the conversation the run
          // filed them in carries kind 'tool-answer' / 'run-result' on its messages, and
          // the thread draws those as results (rich text, 14px) — so a conversation
          // opened next week still reads as the output it is.
          return {
            role: m.role,
            content: m.content,
            result: meta?.kind === 'tool-answer' || meta?.kind === 'run-result',
          };
        });
    } catch (err) {
      this._historyError = 'This conversation could not be read — the server did not answer.';
      this._historyChecked = true;
      console.error('[chat-panel] could not read the package\'s history:', err);
      this.requestUpdate();
    }
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
    if (!this._wantsGreeting && this.sessionId && !this.conversationId
      && Array.isArray(this._conversationRows) && this._conversationRows.length === 0) {
      this._historyChecked = true;
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
    if (this.sessionId && !this.conversationId && !this._conversationEnsured) {
      this._conversationEnsured = true;
      this._startNewConversation();
    }
    if (!kind || this._greeted || !this._historyChecked) return;
    if (this._historyError || this._sending) return;
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
      && (!this.conversationId || !this._packageHasSomething());

    /*
     * THE CONSOLE GETS ITS OWN HELLO, AND NEVER A PACKAGE'S.
     *
     * The console is the library: cards, a search, and no prompt of its own. She used to greet it
     * exactly as she greets a package — reading whatever work was to hand and reporting on it —
     * so a person landing on their library was told about one of their own prompts, unasked. The
     * owner, 2026-09-23: "we have got to get this off of the homepage console chat … every time
     * the console loads she checks the Weaver prompt. She just needs to say the same thing she
     * says on consul or composer, except for console she needs to talk about 'let me help you sort
     * your prompts, is there anything you'd like to search for' — give her a message explaining
     * what the console is and let her decide what to say."
     *
     * So the console is told what it is, and decides its own words. No buttons, because a library
     * is not a form to fill: the ask is an offer to help, and a person can type.
     */
    /*
     * AND IT IS DECIDED BY THE ONE FACT THAT CANNOT BE MISREAD. `consoleCards` is an EMPTY ARRAY
     * on a package, not undefined — and an empty array is truthy, so a first version of this
     * condition would have handed the console's hello to every blank composer. The seat's scope
     * is read from the server (`_readSeatScope`, the same answer the trailing button uses), and
     * until it has been read the greeting simply waits: an unanswered question is not a no.
     */
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
     */
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
        'A person has just opened an existing package that is empty — no seats filled and '
        + 'nothing said in it — so it is a new prompt that already has a name. ' + NEW_PROMPT_HELLO,
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
  private _packageHasSomething(): boolean {
    if ((this.messages?.length ?? 0) > 0) return true;
    const raw = this.leftColumnContent as unknown;
    if (!raw) return false;
    let parsed: unknown = raw;
    if (typeof raw === 'string') {
      try { parsed = JSON.parse(raw); } catch { return false; }
    }
    /*
     * THE ROWS, AS THE SURFACE BINDS THEM — one shape, and it is the array.
     *
     * Both assemblies bind `leftColumnContent` to `/session/left_column/sections` (backend/routes/
     * ai.py, the `right-col` component: `"leftColumnContent": {"path": "/session/left_column/
     * sections"}`), which is the LIST. This read demanded `{sections: […]}` — so `parsed.sections`
     * was `undefined` on every package, this answered FALSE, and the branch that uses it ("an opened
     * package that is empty gives her nothing to read, so she says nothing instead") silenced her on
     * packages full of the person's words. The owner, 2026-09-23: "She's gone from the package.
     * Restore the model to the package."
     *
     * AN EARLIER REVISION OF THIS FIX ALSO ACCEPTED THE `{sections: […]}` OBJECT "for a caller that
     * still sends it" — and no caller does. That is a fallback wearing an acceptance letter, and it
     * is exactly what this application does not do: a reader reads the shape the surface sends, and
     * a shape nothing sends is not read at all. The owner, on the spot: "You mean you create a
     * fallback in my application? … This application has no room for bullshit."
     *
     * A row counts as something only when it has words in it — the rule this was written for.
     */
    if (!Array.isArray(parsed)) return false;
    return parsed.some((s) => String((s as { content?: string })?.content ?? '').trim().length > 0);
  }

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
  private _conversationBelongsToPackage(id: string): boolean {
    if (String(this._adoptedByHost) === String(id)) return true;
    const list = this.conversations ?? [];
    // The surface's list carries ACTIVE rows only; this seat's own server read carries the
    // archived ones too, and a conversation archived from here is still this package's and
    // must stay openable (owner, 2026-09-19: "it should expand so that I can see the message
    // that you just archived").
    if ((this._conversationRows ?? []).some((r) => String(r.id) === String(id))) return true;
    if (!list.length) return true;
    if (list.some((c) => String(c?.id ?? '') === String(id))) return true;
    console.error(
      `[chat-panel] refused conversation ${String(id).slice(0, 8)}…: it is not in package ` +
      `${String(this.sessionId ?? '(none)').slice(0, 8)}'s own list of conversations.`,
    );
    return false;
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
  private _processReply(content: string): string {
    const write = (target: string, value: string) => {
      window.dispatchEvent(new CustomEvent('set-left-column-text', { detail: { content: value, target } }));
    };

    const writeTags: Array<{ regex: RegExp; target: string }> = [
      { regex: /<update_agent>([\s\S]*?)<\/update_agent>/g, target: 'System Role' },
      { regex: /<update_user>([\s\S]*?)<\/update_user>/g, target: 'User Role' },
      { regex: /<update_agent_role>([\s\S]*?)<\/update_agent_role>/g, target: 'Agent Role' },
      { regex: /<update_tool_call>([\s\S]*?)<\/update_tool_call>/g, target: 'Tool Call' },
      { regex: /<update_tool>([\s\S]*?)<\/update_tool>/g, target: 'Tool Call' },
      { regex: /<update_few_shot>([\s\S]*?)<\/update_few_shot>/g, target: 'Few Shot' },
      { regex: /<update_context>([\s\S]*?)<\/update_context>/g, target: 'Context' },
      { regex: /<update_constraints>([\s\S]*?)<\/update_constraints>/g, target: 'Constraints' },
    ];
    /*
     * A REPLY TO AN OFFER MAY NOT WRITE. When the panel asked her a question on its
     * own behalf — a seat was chosen, offer what could go in it — the person has not
     * chosen anything yet, and the answer must not appear in the prompt before they
     * do. She is told to offer buttons, and she is also TOLD, by the control-surface
     * list in her own instructions, that `<update_constraints>` writes into that seat
     * directly. Obeying both would put words in the prompt nobody picked.
     *
     * So the tags are stripped and NOT executed on that turn. The words stay in her
     * reply where they can be read, and the buttons remain the only way in. The flag
     * is cleared here, so it covers exactly one reply: the person's next message
     * keeps every one of its powers.
     */
    const offeringOnly = this._offerOnly;
    this._offerOnly = false;
    if (!offeringOnly) {
      for (const { regex, target } of writeTags) {
        let match: RegExpExecArray | null;
        while ((match = regex.exec(content)) !== null) {
          write(target, match[1].trim());
        }
      }
    }
    for (const { regex } of writeTags) content = content.replace(regex, '');

    const addRoleRegex = /<add_role\s+name="([^"]+)">([\s\S]*?)<\/add_role>/g;
    let addMatch: RegExpExecArray | null;
    while ((addMatch = addRoleRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('add-prompt-role', {
        detail: { roleName: addMatch[1].trim(), placeholder: addMatch[2].trim() },
      }));
    }
    content = content.replace(addRoleRegex, '');

    const removeRoleRegex = /<remove_role\s+name="([^"]+)"\s*\/>/g;    let remMatch: RegExpExecArray | null;
    while ((remMatch = removeRoleRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('remove-prompt-role', {
        detail: { roleName: remMatch[1].trim() },
      }));
    }
    content = content.replace(removeRoleRegex, '');

    if (/<clear_all\s*\/>/.test(content)) {
      window.dispatchEvent(new CustomEvent('clear-left-column'));
      content = content.replace(/<clear_all\s*\/>/g, '');
    }
    /*
     * SHE ASKS FOR THE RUN — and the ask is RECORDED here rather than carried out here.
     *
     * THIS IS THE ONE EFFECT THAT CHANGES THE WHOLE SCREEN. Every other tag in this function
     * writes into something the person is already looking at — a seat, a title, the thread —
     * and their eyes are there. A run takes the middle column, folds the prompt and starts a
     * spinner on the button, and doing that from INSIDE this function happens while her
     * sentence is still a string in this element: nothing of the reply has been drawn yet, so
     * the screen rearranges first and the words that explain it arrive after. Measured
     * 2026-09-23, watched at the screen: "we got to visually connect the run feature … give
     * grace enough time to give her back at her output."
     *
     * So it is queued (see `_pendingRun`), and `_send` releases it once her reply has been
     * appended and painted. Nothing about the run changes — the same event, the same spinner,
     * the same canvas — only the order of two things the person sees.
     */
    if (/<run_prompt\s*\/>/.test(content)) {
      this._pendingRun = 'asked';
      content = content.replace(/<run_prompt\s*\/>/g, '');
    }
    /*
     * HER VERDICT ON A PROMPT SHE WAS ASKED TO REVIEW — the answer to a Run that was held.
     *
     * A RUN THAT HAS BEEN STOPPED STAYS STOPPED UNLESS SHE CLEARS IT. The host asks her to
     * review before a run and holds it; `<run-ok/>` is her saying it is ready, and only
     * that releases it. Anything else — a `<run-blocked>` tag, or no tag at all — leaves
     * the run held, and her prose says what is wrong.
     *
     * SILENCE IS NOT CONSENT, deliberately. If she forgets the tag, or her reply is
     * interrupted, the run does not proceed on a default. The failure that prevents is a
     * prompt with a problem she named going through anyway because the machinery assumed
     * a missing answer meant yes.
     *
     * BOTH FORMS OF THE BLOCKED TAG COME OFF, because she writes both. She is asked for the
     * self-closing shape, and she answered with a bare `<run_blocked>` — measured 2026-09-23,
     * a held Run whose reply drew the tag as text under her sentence. The paired form keeps
     * its body stripped with it; a lone tag is simply removed.
     */
    if (/<run_ok\s*\/>/.test(content)) {
      this._runVerdict = 'ok';
      // QUEUED, NOT DISPATCHED — the same reason as `<run_prompt/>` above: the run takes the
      // screen, and her sentence saying it is ready has to be on screen before it does.
      this._pendingRun = 'approved';
      content = content.replace(/<run_ok\s*\/>/g, '');
    }
    if (/<run_blocked\s*\/?>/.test(content)) this._runVerdict = 'blocked';
    content = content
      .replace(/<run_blocked>[\s\S]*?<\/run_blocked>/g, '')
      .replace(/<\/?run_blocked\s*\/?>/g, '');
    if (/<save\s*\/>/.test(content)) {
      this._emitCommand('save-button', { state: 'idle', label: 'Save' });
      content = content.replace(/<save\s*\/>/g, '');
    }
    /*
     * THE PACKAGE'S TITLE — the one piece of the prompt that used to have no path at all.
     *
     * It was React state behind a callback the shell handed down, so nothing the AI could
     * reach could read or set it. <left-column-header> moved into the surface for exactly
     * this reason, and this is the tag that uses it: a name in, the same rename the bar's
     * own field runs, and the database, the console card and the header all follow because
     * there is one writer.
     *
     * Stripped from the prose like every other tag, so the person reads a sentence about
     * the name rather than the name wearing angle brackets.
     */
    const titleRegex = /<set_title>([\s\S]*?)<\/set_title>/g;
    let titleMatch: RegExpExecArray | null;
    while ((titleMatch = titleRegex.exec(content)) !== null) {
      const title = titleMatch[1].trim();
      if (title) window.dispatchEvent(new CustomEvent('set-prompt-title', { detail: { title } }));
    }
    content = content.replace(titleRegex, '');
    /*
     * THE PACKAGE'S DESCRIPTION, WHICH HAD NO WRITER AT ALL.
     *
     * The description is the line under the name on the console card — and the review before a
     * Run asks for it by name. She tried to write it, and the tag she reached for was invented,
     * because the app had given her none: measured 2026-09-23, `<set_description>…</set_description>`
     * in a reply, drawn as nothing, with the description left empty and her sentence saying it was
     * added.
     *
     * Same shape as the title on purpose: one tag, one write, one place the value lives. The
     * handler is the shell's, next to the title's, because the description is a property of the
     * package rather than of anything inside the surface.
     */
    const descRegex = /<set_description>([\s\S]*?)<\/set_description>/g;
    let descMatch: RegExpExecArray | null;
    while ((descMatch = descRegex.exec(content)) !== null) {
      const description = descMatch[1].trim();
      if (description) {
        window.dispatchEvent(new CustomEvent('set-package-description', { detail: { description } }));
      }
    }
    content = content.replace(descRegex, '');
    /*
     * A TOOL, NAMED — inserted into the seat it belongs in, the same way the seat's own
     * Functions / Tools menu inserts it. The name must be one the register answers to: an
     * invented tool is a step that cannot happen, and the editor reports it rather than
     * writing a token nothing can resolve.
     */
    /*
     * TWO ROWS MERGED, FROM HER OWN TAG — `<merge_role from="agent_role" into="Agent Role"/>`.
     * The attribute form is the one that reads clearly for a pair, and it is what she reaches
     * for: names are what the tag is about, and a bare "a b" would be a guess about which is
     * which.
     */
    const mergeRegex = /<merge_role\s+from="([^"]+)"\s+into="([^"]+)"\s*\/>/g;
    let mergeMatch: RegExpExecArray | null;
    while ((mergeMatch = mergeRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('merge-seat', {
        detail: { from: mergeMatch[1].trim(), into: mergeMatch[2].trim() },
      }));
    }
    content = content.replace(mergeRegex, '');

    const moveRegex = /<move_tool\s+name="([^"]+)"\s+into="([^"]+)"\s*\/>/g;
    let moveMatch: RegExpExecArray | null;
    while ((moveMatch = moveRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('move-tool', {
        detail: { name: moveMatch[1].trim(), into: moveMatch[2].trim() },
      }));
    }
    content = content.replace(moveRegex, '');

    const setSeatRegex = /<set_seat\s+name="([^"]+)"\s*>([\s\S]*?)<\/set_seat>/g;
    let seatMatch: RegExpExecArray | null;
    while ((seatMatch = setSeatRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('set-left-column-text', {
        detail: { target: seatMatch[1].trim(), content: seatMatch[2].trim() },
      }));
    }
    content = content.replace(setSeatRegex, '');

    const toolRegex = /<insert_tool>([\s\S]*?)<\/insert_tool>/g;
    let toolMatch: RegExpExecArray | null;
    while ((toolMatch = toolRegex.exec(content)) !== null) {
      const name = toolMatch[1].trim();
      if (name) window.dispatchEvent(new CustomEvent('insert-tool', { detail: { name } }));
    }
    content = content.replace(toolRegex, '');
    if (/<eval_grounding\s*\/>/.test(content)) {
      window.dispatchEvent(new CustomEvent('ai-eval-grounding'));
      content = content.replace(/<eval_grounding\s*\/>/g, '');
    }

    const showVersionRegex = /<show_version>(\d+)<\/show_version>/g;
    let verMatch: RegExpExecArray | null;
    while ((verMatch = showVersionRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('ai-show-version', {
        detail: { version: parseInt(verMatch[1], 10) },
      }));
    }
    content = content.replace(showVersionRegex, '');

    const reassembleRegex = /<reassemble-console\s+([^>]*?)\s*\/?>/g;
    let reassembleMatch: RegExpExecArray | null;
    while ((reassembleMatch = reassembleRegex.exec(content)) !== null) {
      const attrs = reassembleMatch[1];
      const sortMatch = attrs.match(/sort="([^"]*)"/);
      const filterMatch = attrs.match(/filter="([^"]*)"/);
      window.dispatchEvent(new CustomEvent('a2ui:console-command', {
        detail: {
          sort: sortMatch ? sortMatch[1] : undefined,
          filter: filterMatch ? filterMatch[1] : undefined,
        },
      }));
    }
    content = content.replace(reassembleRegex, '');

    // Third-column surface tags, routed through the gatekeeper like the React seat.
    const emitTag = (tag: string, props: Record<string, string>) => {
      eventBus.emit({
        tag,
        sessionId: this.sessionId ?? null,
        command: tag,
        timestamp: new Date().toISOString(),
        props,
      } as never);
    };

    const attrTag = (regex: RegExp): [string, Record<string, string>] => {
      let m: RegExpExecArray | null;
      while ((m = regex.exec(content)) !== null) {
        const props: Record<string, string> = {};
        const attrRegex = /(\w+)="([^"]*)"/g;
        let am: RegExpExecArray | null;
        while ((am = attrRegex.exec(m[1])) !== null) props[am[1]] = am[2];
        return [m[0], props];
      }
      return ['', {}];
    };

    const projectCard = attrTag(/<project-card-element\s+([^>]*?)\s*\/?>/g);
    if (projectCard[0]) emitTag('project-card-element', projectCard[1]);
    content = content.replace(/<project-card-element\s+([^>]*?)\s*\/?>/g, '');

    const addButton = attrTag(/<add-button\s+([^>]*?)\s*\/?>/g);
    if (addButton[0]) emitTag('add-button', addButton[1]);
    content = content.replace(/<add-button\s+([^>]*?)\s*\/?>/g, '');

    const setHtmlRegex = /<set-html\s+content="([^"]*)"\s*\/?>/g;
    let htmlMatch: RegExpExecArray | null;
    while ((htmlMatch = setHtmlRegex.exec(content)) !== null) {
      emitTag('set-html', { content: htmlMatch[1] });
    }
    content = content.replace(setHtmlRegex, '');

    if (/<clear-surface\s*\/>/.test(content)) {
      emitTag('clear-surface', {});
      content = content.replace(/<clear-surface\s*\/>/g, '');
    }

    return content.trim();
  }

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
  private async _send(text: string, opts: { silent?: boolean; asked?: boolean } = {}): Promise<void> {
    text = (text ?? '').trim();
    if (!text || this._sending) return;
    /* THE SESSIONS TAB DOES NOT SPEAK — IT ASKS. This check sits ABOVE the tab flip below,
       because that flip would otherwise drag the person into the chat tab and turn their
       query into a conversation turn, which is the exact thing the owner ruled out
       (2026-10-18). Only a person's own utterance reaches this branch: `silent`/`asked`
       sends are the app talking to itself and never arrive from this input. */
    if (this.activeTab === 'sessions') {
      void this._runSessionsLane(text);
      return;
    }
    /* THE PERSON'S OWN TURN, RECORDED — AND NOTHING IT SAID. The capture vocabulary has no
       content dimension; `kind` is a name, not words. Silent sends (arrivals, run reviews) are
       the app talking to itself and are not the person's act, so they are not sent. The seat's
       session is the composer package when it belongs to one — that is the flow the record
       ties the interaction to. */
    if (!opts.silent) {
      uxCapture(
        'message_sent',
        'chat-panel',
        { kind: 'person' },
        this.sessionId ? { flow: this.sessionId } : {},
      );
    }
    /* A CHAT TURN IS NEVER WRITTEN INTO A QUERY RECORD. A stored query holds one user message —
       the words that were turned into a filter — and a conversation of that kind is not a
       thread. Sending here releases the binding, so the turn starts a real conversation
       instead of adding prose to a record the lane owns. */
    if (this._currentRowIsLane()) this._moveSeatTo('');
    /*
     * A QUESTION IS ASKED IN THE CHAT TAB — AND NOWHERE ELSE.
     *
     * Governance's rail law: the conversations live in Chat, the other tabs carry views
     * of the thing being worked (the owner, 2026-10-13: *"if anyone wants to chat, it has
     * to shift back to the chat tab … the user is going to have to manually go back to
     * the trace that they were working on"*). So a person who types — or presses send —
     * while looking at Trace, Tools or any other view lands in the thread, because that
     * is where their turn is going to be drawn. THE TRIGGER IS THE SEND ONLY: focusing
     * the input, clicking a rail tab, or simply looking at a view never flips anything,
     * and the return to a view is the person's own click, never automatic. Approvals is
     * exempt: the console's recorded rule draws the thread there on purpose (the tab a
     * person asks the governance system its report from). Silent turns never flip —
     * nothing the person did raised them.
     */
    if (
      !opts.silent
      && this.activeTab !== 'chat'
      && this.activeTab !== 'approvals'
    ) {
      this.activeTab = 'chat';
    }
    /*
     * THE HARD STOP — SHE IS NOT MADE TO SPEAK INTO A PACKAGE THAT HAS ALREADY RUN.
     *
     * This is the one place it is enforced, and it is enforced HERE because every rule that was
     * supposed to be quiet — the arrival greeting, the run's own conversation being adopted, the
     * console hello, whatever the host asks for — arrives through this function. Gating the rules
     * individually is what let her keep talking: each new path into a send had to remember a rule
     * it did not know about. The owner, 2026-09-24: "Grace needs to stop talking unless she's asked
     * a question … stop questioning me."
     *
     * WHAT IS NOT SILENCED: the person's own turn (`silent` is false — that is the question she is
     * answering), the RUN REVIEW, which is the app asking her to judge a prompt before a run that
     * has not happened yet, and — the third kind, added 2026-10-02 — THE TURN A PERSON ASKED FOR BY
     * PRESSING A CONTROL (`asked`). Everything else — a greeting, a suggestion, a note of her own —
     * waits until the person asks, which is the whole of the rule.
     *
     * ON `asked`, AND WHY IT IS A FLAG AND NOT A NEW CHANNEL. The owner, 2026-10-02, on the canvas's
     * ✨ Ask Grace: "a person pressing the button absolutely counts as 'the person asking'… there is
     * no difference between a user typing a manual command or clicking an explicit, contextual
     * button tile." The rule above exists to stop her speaking UNINVITED; a press is an invitation,
     * and leaving the button dead is the failure it reads as. The flag is passed by exactly one
     * caller — `_onHostAsk`, the receiver of `a2ui:ask-grace` — and every dispatcher of that event
     * in this tree is a person's press: the Run gate and Apply all (both carry `review: 'run'`), the
     * canvas's trash and ✨, and the seat menu's "what is this seat for". It is a flag on the SEND
     * and not a new event, because a second channel would be a second authority on whether a person
     * asked. NOTE WHAT DOES NOT CHANGE: `person_turn` stays false (`!opts.silent`), so the app's
     * wording is never written into the thread as the person's words — the defect the owner found
     * on 2026-10-01.
     */
    if (opts.silent && !opts.asked && !this._reviewingRun && this._hasResultTurns) return;
    /*
     * THE CHAT DOES NOT REASON, AND THAT IS A MEASUREMENT, NOT A PREFERENCE.
     *
     * It used to reason on every turn the person typed. Measured on this provider, the
     * reasoning is the whole of what they waited for: 2000 reasoning tokens took 36.2
     * seconds and produced no answer at all once the ceiling was reached — 55 tokens a
     * second, which is simply the model's speed. A turn with it off answers in two to
     * ten seconds.
     *
     * The owner, 2026-09-28, after watching several: "make it zero".
     *
     * WHAT REPLACES IT IS STRUCTURE, NOT THINKING. Reasoning is what the model spends
     * when the choice set is wide, and the answer to a wide set is to narrow it before
     * the call rather than to pay for it during — which is what this codebase does for
     * every surface, and what the Few Shot seat exists for on the prompt side. The asks
     * already do it: the ones that state the shape come back in two seconds.
     */
    const wantsReasoning = false;
    // THE WRITE PATH IS CHECKED TOO, not just the read (2026-09-18). `_loadHistory` refuses a
    // conversation the package's own list contradicts; this is the same guard before a turn
    // is sent, because a foreign id in the property would otherwise be WRITTEN to — the
    // server trusts a client-supplied conversation id, so the seat is where it stops.
    if (this.conversationId && !this._conversationBelongsToPackage(this.conversationId)) return;
    /*
     * ── AND THE TURN IS NOT SENT INTO A ROOM SHE HAS NO WORDS FOR ──────────────────────────────
     *
     * THE OWNER, 2026-10-01: *"There are no fallbacks in the system."* This seat answered every
     * room with the composer's script when the surface had bound none, so a room with no identity
     * spoke in another room's voice — the failure the owner saw as *"she's saying the wrong thing…
     * she's a different thing in each room"* — and nothing anywhere said so. The room states her
     * words now (`_seat_grace` in routes/ai.py binds them; see `_gracePrompt`), and a room that
     * states none gets a refusal instead of an answer from a stranger.
     *
     * THE PERSON'S OWN TURN IS STILL DRAWN. Their sentence stays in the thread — losing it would
     * take their words away as well as her answer — and the defect is the turn beside it, so what
     * is said is said once and in the place they are already reading.
     *
     * BEFORE THE `_sending` FLAG AND BEFORE THE FETCH: nothing is sent, no usage is recorded
     * against the conversation, and no held Run is disturbed — a turn that never left does not
     * block the next one.
     */
    const grace = this._gracePrompt();
    if (grace.ok === false) {
      this._local = [
        ...this._local,
        { role: 'user', content: text },
        {
          role: 'assistant',
          alert: true,
          content:
            `I cannot answer in this room: ${grace.why}. ` +
            'The turn was not sent. This is a defect in the surface, not in what you asked — ' +
            'the room has to state who I am here before I speak in it.',
        },
      ];
      this._scrollThreadToBottom();
      try {
        logger.error('[chat-panel] refused a turn: the surface bound no words for this room', {
          conversationId: this.conversationId ?? null,
          sessionId: this.sessionId ?? null,
          instructions: this.instructions ?? '',
          graceLiveContext: this.graceLiveContext,
        });
      } catch (logError) {
        console.error('[chat-panel] the logger refused the refusal:', logError);
      }
      return;
    }
    const before = this._local.length;
    if (!opts.silent) {
      this._local = [...this._local, { role: 'user', content: text }];
      this._scrollThreadToBottom();
    }
    this._sending = true;
    /*
     * THE WORK CARD OPENS FOR EVERY ANSWER — the person's own turn AND the app's own asks
     * (owner, 2026-10-16: *"I'm seeing a pop as if it's a fixed text… I need to see the
     * model thinking. I wanna see spinning. I want to see the standard model behavior
     * inside of a chat window… I do not want to see text popping in there because I know
     * that is not real."*). Silent turns used to draw NOTHING, so every arrival's reply —
     * a room greeting, the section's introduction — landed with no thinking beat, and a
     * real model answer with an unseen wait reads as injected text. What stays silent is
     * only the ASK (it is never written as the person's turn); the WAIT is drawn — the
     * thinking card, the elapsed time, her actual seconds.
     */
    this._workActive = true;
    this._workStage = 'thinking';
    if (this._workTimer) clearTimeout(this._workTimer);
    // THE ROOM-AGNOSTIC CAP: a seat in a room that never builds must still end. The
    // no-build fallback below fires first for those seats; this cap is the last resort.
    this._workTimer = window.setTimeout(() => this._endWork(), 30000) as unknown as number;
    this.requestUpdate();
    let answered = false;
    /*
     * A CLEAN VERDICT IS SILENT, and this is the flag that keeps the silence in both
     * places a turn lands — the thread and the pending list. The review still runs and
     * the Run still waits on it; what is skipped is only the drawing of her "everything
     * is in place 🍾" reply, which is the same sentence every time and reads as noise
     * rather than news (the owner, 2026-09-24: "it seems fake"). A blocked verdict —
     * real news — is shown and held exactly as before.
     */
    let silentVerdict = false;

    try {
      this._abort = new AbortController();
      const turnUrl = '/api/teacher/query';
      const resp = await fetch(turnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': this._userId() },
        body: JSON.stringify({
          question: text,
          context: grace.text,
          mode: 'chat',
          /*
           * THE PERSON'S OWN TURN REASONS; THE PANEL'S ASK DOES NOT.
           *
           * Reasoning is what makes this wait long — the model is a reasoning
           * model, and `chat` is the one mode that turns thinking on, because a
           * person's message can be complicated and thinking about it is worth
           * the seconds. A seat description is not complicated: the sentence is
           * already written and handed over in the same request. There is nothing
           * to work out, and the delay was the whole of what a person noticed.
           *
           * This is the project's own rule, not a new one: reasoning belongs to
           * the chat input and the reply to it, and a summary or a tag pass does
           * not reason. Measured on this provider, reasoning off returned the same
           * valid answer in 1.53s where reasoning on took 6.05s.
           */
          reasoning: wantsReasoning,
          reasoning_style: 'chain_of_thought',
          include_memory: true,
          /*
           * WHO SPOKE — FALSE WHEN THE PANEL IS THE ONE ASKING.
           *
           * A silent send is the app asking Grace to open a conversation: the `question` is
           * an INSTRUCTION she is given ("A person has just landed on the console — the index
           * of every package they have built…"), and nobody typed it. The server records her
           * reply either way, and records the question only when a person said it — without
           * this, the instruction came back as the person's own turn the next time the thread
           * was read. The owner, 2026-09-23: "now it says a person has landed on the console —
           * the index of every package they have built …"
           */
          person_turn: !opts.silent,
          /*
           * WHICH TURNS ARE REVIEWS, so the server knows which replies are verdicts.
           * A clean `<run_ok/>` verdict is not recorded (see silentVerdict below and
           * the server's own note in routes/teacher.py): the thread was filling with
           * the same canned congratulations every run, and a record of the gate
           * passing is not what the person needs to read back.
           */
          run_review: this._reviewingRun,
          // No temperature here. It used to send 0.45 while the request model defaulted
          // to 0.45 and the backend passed it straight through — three homes for one
          // number, and three numbers waiting to disagree. `chat` has ONE: CHAT_TEMPERATURE
          // in grace_gui.py, chosen by mode, because this element does not own how she is
          // prompted.
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        }),
        signal: this._abort.signal,
      });
      const data = await resp.json().catch(() => ({}));
      // THE SERVER'S ANSWER IS THE THREAD — adopted whenever it DIFFERS, not only when the
      // seat holds none. The server may have moved the thread: a CLOSED conversation starts
      // a new one (routes/teacher.py), and a seat that keeps the old id writes nothing into
      // the thread it is drawing — the reply is shown and then lost on reload. The move is
      // SHOWN, not silent.
      const returned = typeof data?.conversation_id === 'string' && data.conversation_id ? data.conversation_id : '';
      if (returned && returned !== this.conversationId) {
        const moved = !!this.conversationId;
        this.conversationId = returned;
        if (moved) {
          window.dispatchEvent(new CustomEvent('a2ui:system-message', {
            detail: {
              role: 'assistant',
              content: 'The previous conversation was closed — this reply continues in a new one.',
            },
          }));
        }
        this.dispatchEvent(
          new CustomEvent('conversation-change', {
            bubbles: true,
            composed: true,
            detail: { conversationId: returned },
          }),
        );
        // The header's list is re-read too: the server just created this thread (a first
        // turn in a package with none), and the count should say so now rather than wait
        // for the next assembly. Without this the row was in the database but not in the
        // list until a reload — measured live 2026-09-24.
        void this._readPackageConversations(this._userId());
      }
      /*
       * THE PERSON'S TURN IS ANNOUNCED — THE ROOM BUILDS AS THEY SPEAK (owner, 2026-10-03:
       * *"we don't need that [button] — just give her a prompt and she starts building"*). This
       * fires AFTER the server has answered AND after the thread adoption above, so it carries
       * the conversation the turn actually landed in, and the turn is PERSISTED — a room that
       * builds on this event (the Product room's host) reads "the thread's last person message"
       * and is guaranteed to find THIS one. Silent turns — the app's own instructions to her —
       * never announce; nobody typed them. The event is generic: rooms take from it what they
       * need — Product remounts its stage; Governance reads the text (added 2026-10-13) for
       * the ask-listener that pivots the room to a trace when the person asks for one.
       */
      if (!opts.silent) {
        window.dispatchEvent(new CustomEvent('a2ui:person-turn', {
          /* AND THE TURN'S OWN WORDS (2026-10-13 late) — additive: the governance room
             reads them to answer an ask (“I want to look at trace” pivots the room;
             see WritingAreaIndex's ask-listener). Every existing listener takes these
             events unchanged. */
          detail: { conversationId: this.conversationId, sessionId: this.sessionId, text },
        }));
      }
      // The measured cost of this call, attributed to the conversation it
      // served. The host's accumulator only accepts calls whose
      // conversation_id matches this seat's — so the footer shows THIS
      // conversation's numbers, never session totals.
      if (data?.usage && typeof data.usage.total_tokens === 'number') {
        window.dispatchEvent(
          new CustomEvent('a2ui:usage', {
            detail: {
              ...data.usage,
              sessionId: this.sessionId ?? null,
              conversation_id: typeof data.usage.conversation_id === 'string'
                ? data.usage.conversation_id
                : (this.conversationId ?? null),
            },
          }),
        );
      }
      if (data?.error) {
        this._local = [...this._local, { role: 'assistant', content: `Error: ${data.error}` }];
      } else {
        const raw = String(data?.content ?? '(no answer)');
        const reply = this._processReply(raw);
        // THE VERDICT IS READ BEFORE THE REPLY IS DRAWN, because a clean one is not
        // drawn at all (see silentVerdict above): `_processReply` set `_runVerdict`
        // from the tag, and the tag has already been stripped from the prose.
        silentVerdict = this._reviewingRun && this._runVerdict === 'ok';
        if (reply && !silentVerdict) {
          if (!this.productTools) {
            this._local = [
              ...this._local,
              // HER VERDICT IS DRAWN AS WHAT IT IS. A reply that stopped a Run is an ALERT — the
              // person pressed a button and is owed a stop sign, not another remark in the
              // conversation. See ChatMessage.alert and the turn's own outline rule.
              { role: 'assistant', content: reply, alert: this._reviewingRun && this._runVerdict === 'blocked' },
            ];
          }
          /*
           * THE PRODUCT ROOM DOES NOT ECHO THIS REPLY (2026-10-06, the app-design port):
           * the record is the ENGINE's, and every line of it — the builder's spoken steps
           * and the `Finished in Ns.` that carries the ✓ — arrives through the room's live
           * poll of the engine's own conversation with its `messageType` intact. Appending
           * this route's reply here would draw the same sentence twice.
           */
        }
        answered = true;
      }
      /*
       * THE HELD RUN IS SETTLED IN THE finally BELOW, for every outcome — a reply, a refusal,
       * a connection error, or the person stopping the turn. See there.
       */
      // A TURN THAT DID NOT PERSIST IS SAID IN THE THREAD. The server answered it but could
      // not write it down (routes/teacher.py `persistence_error`: a failed lookup, a failed
      // create, a failed message write); without this the person reads a reply that is gone
      // on reload, and nothing anywhere says so.
      if (typeof data?.persistence_error === 'string' && data.persistence_error) {
        this._local = [
          ...this._local,
          { role: 'assistant', content: `⚠️ Not saved — ${data.persistence_error}` },
        ];
      }
      // AND EVERY OTHER WARNING THIS TURN PRODUCED — drawn in the thread and written to the
      // app logger, which the Trace tab reads (the owner, 2026-09-18: "we need to report it
      // in the console trace"). Empty on a clean turn.
      if (Array.isArray(data?.warnings)) {
        for (const warning of data.warnings) {
          this._local = [...this._local, { role: 'assistant', content: `⚠️ ${String(warning)}` }];
          try {
            logger.warn(`[chat] ${String(warning)}`, {
              conversationId: this.conversationId ?? null,
              sessionId: this.sessionId ?? null,
            });
          } catch (logError) {
            // A logger that throws must not cost the turn — but the fact that it threw is
            // itself said, on the console (the gate counts `pass`, not a named failure).
            console.error('[chat-panel] the logger refused a turn warning:', logError, warning);
          }
        }
      }
    } catch (err) {
      if (this._abort?.signal.aborted) {
        this._local = [...this._local, { role: 'assistant', content: 'Stopped.' }];
      } else {
        const why = err instanceof Error ? err.message : String(err);
        this._local = [...this._local, { role: 'assistant', content: `Connection error: ${why}` }];
      }
    } finally {
      /*
       * THE HELD RUN IS SETTLED HERE, ONCE, WHATEVER HAPPENED.
       *
       * `<run_ok/>` released it inside _processReply. This is the other half: a run she did NOT
       * clear has to be told so, because the host is showing it as busy and silence would leave
       * the button spinning with nothing coming. "Silence is not consent" cuts both ways — no
       * verdict is not a yes, and it is not a wait either.
       *
       * IN THE finally AND NOT THE try, because the outcomes that most need it are the ones that
       * never reach the end of the try: a connection error, or the person stopping the turn.
       * Either way the person is looking at a spinner they must be able to get out of.
       *
       * A turn that is not a run review owes nothing and dispatches nothing.
       */
      if (this._reviewingRun) {
        this._reviewingRun = false;
        if (this._runVerdict !== 'ok') {
          window.dispatchEvent(new CustomEvent('a2ui:run-blocked'));
        }
      }
      this._runVerdict = '';
      // Her reply (or the failure) just landed — the column follows it down.
      this._scrollThreadToBottom();
      /*
       * AND ONLY NOW MAY THE SCREEN CHANGE. Everything above this line is her turn arriving; the
       * run is the one effect that rearranges the page, so it goes last — see `_pendingRun`.
       */
      this._releaseQueuedRun();
      // A turn that was ANSWERED while this seat had no conversation lives only here:
      // the backend refused to write it (no row to bind it to yet), so it is held and
      // handed over by flushPendingTurns when the first Save creates the package's
      // conversation. Failed turns are not held — an error is not a thing that was said.
      if (answered && !this.conversationId && !silentVerdict) {
        // The owner is recorded with the FIRST pending turn: spoken before any package
        // existed (owner null) they are owed to whatever Save creates one; spoken INSIDE a
        // package they belong to it and to no other (see flushPendingTurns).
        if (!this._pending.length) this._pendingOwner = this.sessionId ? String(this.sessionId) : null;
        this._pending = [...this._pending, ...this._local.slice(before)];
      }
      this._sending = false;
      this._abort = null;
      if (this._workActive && this._workStage === 'thinking') {
        // NO BUILD WAS ANNOUNCED IN THIS ROOM — the reply was the whole turn. Give the build's
        // announcement one beat to beat us to it, then close the card. (A room that builds
        // announces 'building' within that beat and ends the card later, on 'idle'.)
        if (this._workTimer) clearTimeout(this._workTimer);
        this._workTimer = window.setTimeout(() => this._endWork(), 1500) as unknown as number;
      }
      this.requestUpdate();
    }
  }

  /**
   * END THE WORK CARD — the one exit (the host's `a2ui:grace-status` 'idle', the no-build
   * fallback above, or the cap). The stage is NOT cleared: <chat-messages> reads it in the
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
    const detail = ((event as CustomEvent).detail || {}) as { state?: unknown; conversationId?: unknown };
    const cid = String(detail.conversationId || '');
    if (cid && this.conversationId && cid !== String(this.conversationId)) return;
    const state = String(detail.state || '');
    if (state === 'building') {
      this._workStage = 'building';
      this.requestUpdate();
    } else if (state === 'idle') {
      this._endWork();
    }
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
    const detail = (e as CustomEvent).detail || {};
    const text = String(detail.text ?? '').trim();
    if (text) void this._send(text);
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
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    const text = String(this._draft ?? '').trim();
    if (!text) return;
    e.preventDefault();
    // THE KEYBOARD TAKES THE BUTTON'S PATH EXACTLY — including the clear. Measured 2026-10-18:
    // Enter sent the message and left the words in the box, so the next Enter would send them
    // again. The button path (`_onSendCommand`) has cleared since it was written; this is the
    // same three lines, not a second rule.
    const textarea = this.renderRoot?.querySelector('prompt-textarea') as
      (HTMLElement & { value: string }) | null;
    if (textarea) textarea.value = '';
    this._draft = '';
    this._syncBarText();
    void this._send(text);
  }

  /**
   * THE PRODUCT FOOT'S TWO CALLS — forwarded as the SEAT's own (bubbling, composed), so
   * the room that bound this seat is the one listener and no other surface hears them.
   * The foot only ASKS; what an attach or a tool does is the room's — see <chat-product-tools>.
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
    if (!this.productTools) return;
    const text = e.clipboardData?.getData('text/plain') ?? '';
    if (text.trim()) return; // a real paste is text — never turn it into a picture
    const files = Array.from(e.clipboardData?.files ?? []);
    if (!files.length) return;
    e.preventDefault();
    this._forwardProductAttach(files);
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
    // Moving anywhere that is not the adopted id ends the trust: it covered the one
    // handover, not the rest of the seat's life (see _adoptedByHost).
    if (id !== this._adoptedByHost) this._adoptedByHost = '';
    this.messages = [];
    this._local = [];
    this._inspectionReports = [];
    this.conversationId = id;
    this._historyError = '';
    if (opts.tab) {
      /* A QUERY RECORD OPENS ON ITS OWN TAB (owner, 2026-10-18). A conversation filed with
         `tab = "sessions"` is a stored lane query, not a thread — opening it moves to Sessions
         and REPLAYS the recorded filter. Chat and approvals behave as they always have. */
      this.activeTab =
        opts.tab === 'approvals' ? 'approvals' : opts.tab === 'sessions' ? 'sessions' : 'chat';
    }
    if (opts.tab === 'sessions') void this._replayLaneQuery(id);
    this.dispatchEvent(
      new CustomEvent('conversation-change', {
        bubbles: true,
        composed: true,
        detail: { conversationId: id },
      }),
    );
    this.requestUpdate();
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
    if (!id || id === this.conversationId) return;
    const leaving = String(this.conversationId ?? '');
    /*
     * AND SHE SAYS NOTHING ABOUT A RUN THAT JUST FINISHED.
     *
     * The results landing is not an arrival she answers — it is the output of the thing the person
     * pressed. The owner, 2026-09-24: "she's not supposed to be chatting after run. She is done
     * with recommendations after run." Measured the same evening: filing a run's results was
     * followed by her opening the conversation out loud ("the app asked for this turn
     * (person_turn=false): Grace is opening the conversation"), which is a greeting about work she
     * had already delivered, sitting on top of the answer they pressed Run to read.
     *
     * The greeting is spent here rather than forbidden, so the next thing that IS an arrival — the
     * person opening this package later — is answered normally (`_takeArrival` clears the flag).
     */
    this._wantsGreeting = '';
    this._greeted = true;
    // THE HOST'S WORD IS THE AUTHORITY FOR THIS ONE MOVE — see _adoptedByHost. The
    // list is re-read alongside it, so the belongs-check passes for every later turn.
    this._adoptedByHost = id;
    void this._readPackageConversations(this._userId());
    this._moveSeatTo(id);
    /*
     * AND THE RUN ARCHIVES WHAT IT LEFT.
     *
     * The owner, 2026-09-24, describing what a Run should do to the package's conversations:
     * "it creates a new conversation and archives the one that was there when user arrived. So
     * now you have two conversations — you have the original conversation on load and then you
     * have the results conversation. It's creating a conversation audit trail."
     *
     * The backend makes the results conversation and files them in it (routes/teacher.py, "A RUN
     * GETS ITS OWN CONVERSATION"); archiving the one being left is this half, so the package's
     * list reads as the record it is: the thread the person was in, closed and dated, above the
     * run's own. Archived and never deleted — `_readPackageConversations` asks for the archived
     * rows too, and the row wears the chip that says so.
     *
     * A PERSON STARTING A CONVERSATION STILL ARCHIVES NOTHING (see _createConversation: a
     * package's list is theirs to keep or clear). This is the Run's act, not the seat's habit.
     */
    if (leaving) {
      void this._conversationWrite(
        `/api/conversations/${leaving}/archive`,
        'POST',
        undefined,
        this._userId(),
      ).catch((err) => {
        // NOT SWALLOWED, and not fatal: the results are on screen either way, and what is lost
        // is the row's own note that the thread is closed. The Trace tab reads this logger.
        logger.warn('the run could not archive the conversation it replaced', {
          conversationId: leaving,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
  }

  private _onConversationSelect(e: Event) {
    const detail = (e as CustomEvent).detail || {};
    const id = typeof detail.conversationId === 'string' && detail.conversationId
      ? detail.conversationId
      : null;
    if (!id) return;
    // A person chose a conversation from the bar: an action against the seat, named by its act.
    // The seat's session is the flow — the package whose conversation they picked.
    uxCapture(
      'action',
      'chat-panel',
      { action: 'conversation-select' },
      this.sessionId ? { flow: this.sessionId } : {},
    );
    /*
     * THE ROW KNOWS ITS OWN TAB, AND BOTH LISTS ARE ASKED. The surface's array and the server's
     * read are different sources, and the row a person clicked may only be in the second one —
     * searching just the first resolved `tab` to undefined and opened a stored query as a chat.
     */
    const picked =
      (this.conversations ?? []).find((c) => String(c.id) === id) ??
      (this._conversationRows ?? []).find((r) => String(r.id) === id);
    const tab = String((picked as { tab?: string } | undefined)?.tab || 'chat');
    /*
     * A QUERY RECORD IS A DOOR EVEN WHEN YOU ARE ALREADY IN IT (owner, 2026-10-18: *"if I
     * selected the most expensive session, it would automatically go to sessions and load
     * that"*). The early return used to make the row dead in exactly that case — the seat was
     * bound to the record, so the click was a no-op and nothing moved. A query record RE-OPENS
     * its recorded filter; a chat that is already open has nothing to re-do.
     */
    if (id === this.conversationId) {
      if (tab === 'sessions') {
        if (this.activeTab !== 'sessions') this.activeTab = 'sessions';
        void this._replayLaneQuery(id);
      }
      return;
    }
    this._moveSeatTo(id, { tab });
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
    if (this._creatingConversation) return;
    this._creatingConversation = true;
    void this._createConversation().finally(() => { this._creatingConversation = false; });
  }

  private async _createConversation(): Promise<void> {
    const userId = this._userId();
    const scope = this._seatIsConsole === null
      ? await this._readSeatScope(userId)
      : (this._seatIsConsole ? 'console' : 'package');
    if (scope === 'unknown') {
      // The gate could not be read, so nothing is attempted — and the reason is said rather
      // than shown as a button that quietly does nothing.
      this._historyError =
        'Whether this chat is the console’s could not be read, so nothing was changed — no conversation was archived.';
      this.requestUpdate();
      return;
    }
    /*
     * A PACKAGE STARTS ITS OWN CONVERSATION TOO — this was one half of a deadlock.
     *
     * It returned here and did nothing at all: no request, no note, no message (measured
     * 2026-09-23 — zero fetches). And the seat's other control, the trash, refused to remove the
     * conversation you were in ("start a new one, then remove it"). So a package's one row could
     * not be removed, and no second row could be started to move off it — a person cleaning up had
     * no move at all. The owner: "I'm not able to delete conversations from the packages. It's just
     * basic CRUD process I thought."
     *
     * WHAT IT DOES IS THE PLAIN THING: create a conversation for THIS package and move the seat
     * into it, leaving the one just left in the list, where it can be returned to or deleted. The
     * console's flow ARCHIVES its predecessor instead — that is the console's own act and it stays
     * there (the owner, 2026-09-19: "this is the only place that this global chat is associated …
     * don't just apply it to both areas"). A package's list is the person's to keep or clear, which
     * is what CRUD means here.
     *
     * THE SESSION IS REPOINTED, the same hop the console's flow makes: the seat's conversation id
     * comes from this session's own column, so moving the column is what makes a reload land in the
     * new thread instead of resurrecting the old one.
     */
    if (scope === 'package') {
      this._historyError = '';
      try {
        const created = await this._conversationWrite(
          '/api/conversations',
          'POST',
          { session_id: this.sessionId ?? undefined, title: this._successorTitle() ?? 'New Chat' },
          userId,
        );
        const next = typeof created?.id === 'string' ? created.id : '';
        if (!next) throw new Error('the new conversation came back without an id');
        if (this.sessionId) {
          await this._conversationWrite(
            `/api/prompt-sessions/${this.sessionId}`,
            'PUT',
            { conversation_id: next },
            userId,
          );
        }
        this._moveSeatTo(next);
        void this._readPackageConversations(userId);
        this.requestUpdate();
      } catch (err) {
        this._historyError =
          `A new conversation could not be started: ${String((err as Error)?.message ?? err)}`;
        this.requestUpdate();
      }
      return;
    }
    const leaving = this.conversationId;
    const title = this._firstTurnTitle();
    const writing = this._conversationWrite;
    this._historyError = '';
    try {
      if (leaving && title) {
        await writing(`/api/conversations/${leaving}`, 'PUT', { title }, userId);
      }
      if (leaving) {
        await writing(`/api/conversations/${leaving}/archive`, 'POST', undefined, userId);
      }
      const created = await writing(
        '/api/conversations',
        'POST',
        { session_id: this.sessionId ?? undefined, title: this._successorTitle() },
        userId,
      );
      const next = typeof created?.id === 'string' ? created.id : '';
      if (!next) throw new Error('the new conversation came back without an id');
      if (this.sessionId) {
        await writing(`/api/prompt-sessions/${this.sessionId}`, 'PUT', { conversation_id: next }, userId);
      }
      // The seat moves, exactly as it does when a conversation is picked from the list.
      this.messages = [];
      this._local = [];
      this._inspectionReports = [];
      this.conversationId = next;
      // AND THE COUNT MOVES WITH IT: one archived, one created — the package's total is
      // what the leading bar counts, so it is re-read rather than guessed at.
      void this._readPackageConversations(userId);
      // NO GREETING EVENT, AND NO ASSEMBLY. The owner, 2026-09-19: "I don't care about a
      // greeting. I care that the conversations create and then are they retrievable" — and
      // a greeting raised by re-assembling would reload the whole surface, which this must
      // never do: everything a new conversation touches stays inside this chat.
      this.dispatchEvent(
        new CustomEvent('conversation-change', {
          bubbles: true,
          composed: true,
          detail: { conversationId: next },
        }),
      );
    } catch (err) {
      const why = String((err as Error)?.message ?? err);
      this._historyError = `A new conversation could not be started, so this one is still yours: ${why}`;
      this.requestUpdate();
    }
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
    if (!this.sessionId) return;
    try {
      const res = await fetch(
        `/api/conversations?session_id=${encodeURIComponent(this.sessionId)}&include_archived=true`,
        { headers: { 'X-User-ID': userId } },
      );
      if (!res.ok) { this._conversationsRead = true; return; }
      const body = (await res.json()) as {
        conversations?: Array<{
          id?: unknown; title?: unknown; tab?: unknown; is_archived?: unknown; updated_at?: unknown;
        }>;
      };
      if (!Array.isArray(body?.conversations)) { this._conversationsRead = true; return; }
      const rows = body.conversations.map((c) => ({
        id: String(c?.id ?? ''),
        title: String(c?.title || '(untitled)'),
        tab: String(c?.tab || 'chat'),
        archived: c?.is_archived === true,
        // WHEN IT WAS LAST SAVED, as the server wrote it. The read already carries it (the
        // server orders the list by it), so the row's time and the list's order are the same
        // fact — the newest thread is the top row and the top row is the newest time.
        savedAt: String(c?.updated_at ?? ''),
      })).filter((r) => r.id);
      const rowsChanged = !(rows.length === this._conversationRows?.length
          && rows.every((r, i) => r.id === this._conversationRows?.[i]?.id
            && r.title === this._conversationRows?.[i]?.title
            // A thread that was just written to is the same row with a NEW time: without this
            // the early return would keep a stale timestamp on screen after a save.
            && r.savedAt === this._conversationRows?.[i]?.savedAt));
      this._conversationRows = rows;
      this._conversationsRead = true;

      /*
       * IF THERE IS A CONVERSATION, LOAD THE LAST ONE.
       *
       * A seat can come up with nothing bound and still have threads behind it: a person
       * deletes the conversation they were in and what is left of the package is its history,
       * not a blank screen. The owner, 2026-09-24: "if there is a conversation then you should
       * just load that conversation, the last one, but if it's empty … Grace needs to just treat
       * the prompt like it's brand new." (The empty half is `nothingToRead` in _greetIfArriving.)
       *
       * THE LIST IS ALREADY IN THAT ORDER. The server answers `ORDER BY updated_at DESC`, so
       * the first row is the thread last written to — "the last one" as a person means it — and
       * this is the same choice the server makes for the first turn of a package with nothing
       * bound (routes/teacher.py reuses `existing[0]`), taken here so the person SEES that
       * thread on opening instead of an empty card that fills in only once they type.
       *
       * `_moveSeatTo` is the app's one way to move this seat: it clears the thread, sets the id,
       * tells the host (so the package's own pointer follows), and setting the id is what makes
       * `_loadHistory` read it. Nothing new is invented here.
       */
      if (!this.conversationId && rows.length) {
        /* A LANE RECORD IS OPENED AS WHAT IT IS (owner, 2026-10-18). Adopting it with no tab
           made the seat sit in a stored query AS A CHAT: the thread showed the query line as if
           it were something said, the tab stayed on chat, and clicking the row afterwards was a
           no-op because the seat was "already there". The row's own tab travels with the move. */
        this._moveSeatTo(rows[0].id, { tab: rows[0].tab });
        return;
      }
      if (!rowsChanged) return;
      this.requestUpdate();
    } catch {
      // Unreachable server: keep the number that was already true (see the header note). The wait
      // is still released — the attempt is over, and a seat that waits on a server that never
      // answers never speaks (see the header note).
      this._conversationsRead = true;
    }
  }

  /** The bar's own click: open or close its list. */
  private _toggleConversations = (): void => {
    this._conversationsOpen = !this._conversationsOpen;
    /* A NOTE BELONGS TO THE OPEN IT HAPPENED IN. "Removed." sat above a freshly opened list and
       read as a state of the list rather than as a thing that just happened. Opening or closing
       starts a new look, so the note starts empty. */
    this._listNote = '';
    // Opening re-reads, so a conversation created or archived a moment ago is in the list
    // rather than missing until the next assembly.
    if (this._conversationsOpen) void this._readPackageConversations(this._userId());
    this.requestUpdate();
  };

  /** The same gesture from the keyboard, because the header is announced as a button. */
  private _onConversationsKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    this._toggleConversations();
  };

  /**
   * The bar's rows: this package's conversations in the server's order, each one openable.
   * A row that is ARCHIVED says so in the chip the list already uses for a row that is not
   * from here — the row is still reachable, it is just not the live one. Until the server
   * read lands (or if it cannot), the surface's own list is drawn, exactly as before.
   */
  private _conversationRowsForList() {
    const rows = this._conversationRows
      ?? (this.conversations ?? []).map((c) => ({
        id: String(c?.id ?? ''),
        title: String(c?.title || '(untitled)'),
        tab: String(c?.tab || 'chat'),
        archived: false,
        // The SURFACE's list carries no time — it is the assembly's own array, not this
        // server read — so a fallback row draws the title and no timestamp. A missing time
        // is drawn as nothing rather than as a guess.
        savedAt: '',
      })).filter((r) => r.id);
    if (!rows.length) {
      return html`<p class="conversation-none">No conversations yet for this package.</p>`;
    }
    return rows.map(
      (r) => html`<li>
        <button class="conv-open" data-conversation-id=${r.id} @click=${this._pickConversation}>
          ${r.title}${r.archived ? html`<span class="tab-tag">archived</span>` : nothing}
        </button>
        ${r.savedAt
          // THE HOVER CARRIES THE EXACT STAMP, the way the Evals feed's row does: the drawn
          // text is local time and a machine stamp on the row would be unreadable, so each
          // says what the other cannot.
          ? html`<span class="conv-when" title=${`Last saved ${r.savedAt}`}>${formatWhen(r.savedAt)}</span>`
          : nothing}
        ${isDemoMode()
          // Deleting a conversation is refused on the demo (demo_policy.py locks
          // every DELETE), so the remove control is not drawn there.
          ? nothing
          : html`<button
          class="conv-remove ${this._armedDelete === r.id ? 'armed' : ''}"
          type="button"
          data-conversation-id=${r.id}
          title=${this._armedDelete === r.id ? 'Click again to remove this conversation' : 'Remove this conversation'}
          aria-label=${this._armedDelete === r.id ? 'Confirm remove' : 'Remove this conversation'}
          @click=${this._onConversationRemove}
        >
          ${this._armedDelete === r.id
            ? html`REMOVE`
            : html`<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M4 7h16M10 7V5h4v2M6 7l1 13h10l1-13M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`}
        </button>`}
      </li>`,
    );
  }

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
    e.stopPropagation();
    // Belt to the hidden control's braces: the demo's DELETE is refused server-side.
    if (isDemoMode()) return;
    const el = e.currentTarget as HTMLElement | null;
    const id = el?.dataset.conversationId ?? '';
    if (!id) return;
    if (this._armedDelete !== id) {
      this._armedDelete = id;
      this._listNote = '';
      if (this._deleteTimer) clearTimeout(this._deleteTimer);
      this._deleteTimer = setTimeout(() => {
        this._armedDelete = null;
        this._deleteTimer = null;
        this.requestUpdate();
      }, 4000);
      this.requestUpdate();
      return;
    }
    if (this._deleteTimer) {
      clearTimeout(this._deleteTimer);
      this._deleteTimer = null;
    }
    this._armedDelete = null;
    void this._removeConversation(id, this._userId());
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
    const wasTheOneOnScreen = String(id) === String(this.conversationId ?? '');
    try {
      const res = await fetch(`/api/conversations/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'X-User-ID': userId },
      });
      if (!res.ok) {
        this._listNote = `That conversation could not be removed — HTTP ${res.status}.`;
        this.requestUpdate();
        return;
      }
      this._listNote = '';
      await this._readPackageConversations(userId);
      if (!wasTheOneOnScreen) {
        // The live thread is untouched, so it is NOT re-drawn: only the list above it changed.
        this._listNote = 'Removed.';
        this.requestUpdate();
        return;
      }
      const live = (this._conversationRows ?? [])
        .filter((r) => !r.archived && String(r.id) !== String(id));
      const next = live.length ? String(live[0].id) : '';
      if (next) {
        this._moveSeatTo(next);
        this._listNote = 'Removed. This chat moved to your other conversation.';
      } else {
        // NO CONVERSATION IS NOT A BROKEN STATE. The thread is emptied of what was read from the
        // row that is gone; what the person says next will not reach either (the local turns are
        // kept — they are what the seat is showing).
        //
        // AND THE SURFACE IS TOLD, with an EMPTY id. That is the fact the model needs, because the
        // model is what a Save reads: leaving the deleted id in it made every save write a dead
        // foreign key and fail with a 500 (measured 2026-09-23 — "AI save failed: 500"). An empty
        // id is not "nothing to say"; it is "this place has no conversation", which is true and
        // writable into a nullable column.
        this._moveSeatTo('');
        this._listNote = 'Removed. Nothing has been said here yet.';
        /*
         * AND A PACKAGE WITH NO CONVERSATION IS A NEW PROMPT, so the removal is treated as an
         * arrival and the seat starts the package over the same way an open does: a default
         * conversation is made for it and she says hello (`nothingToRead` in _greetIfArriving).
         *
         * The owner, 2026-09-24: "if the user removes all conversations and there's zero and
         * there's nothing to load you have to engage the model … she needs to create a default
         * conversation, say hello, because that's considered a PRE-RUN state." Measured the same
         * evening, before this: deleting the last row left the seat with no conversation, her
         * greeting was answered by the server and NOT written down ("this place has no
         * conversation yet — it is answered and NOT written down"), and the person was left on a
         * card with a thread in it that no row would ever hold — the audit trail the owner wants
         * had a hole in it where the deletion was.
         */
        this._takeArrival('resume');
      }
      this.requestUpdate();
    } catch (err) {
      this._listNote = `That conversation could not be removed: ${String((err as Error)?.message ?? err)}`;
      this.requestUpdate();
    }
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
    const tab = String((e as CustomEvent).detail?.tab ?? '');
    if (!tab) {
      this.collapsed = true;
      return;
    }
    this.collapsed = false;
    this.activeTab = tab;
    /*
     * EACH TAB TALKS IN ITS OWN CONVERSATION. Approvals is a different process from the chat
     * (conversations.tab — the column the schema always had), and the console opens both
     * conversations under its one session. Switching tabs therefore switches which
     * conversation this seat reads and writes, so Approvals lands exactly where that process
     * left off — the owner, 2026-09-19: "the user is right where that particular process left
     * off." Tabs with no conversation of their own (versions, tools, trace, repair) keep the
     * chat's.
     */
    const list = this.conversations ?? [];
    const match = list.find((c) => String(c.tab || 'chat') === tab)
      ?? list.find((c) => String(c.tab || 'chat') === 'chat');
    if (match && match.id && String(match.id) !== this.conversationId) {
      this.messages = [];
      this._local = [];
      this.conversationId = String(match.id);
    }
    // The VIEW switches either way; only a seat that has a run is asked the
    // question. See `tracePrompt`.
    if (tab === 'trace' && this.tracePrompt) void this._send(TRACE_PROMPT);
    /*
     * AND THE ROOM MAY WANT TO KNOW — the tab is announced OUT the same way the rail
     * announces it IN. A room with nothing selected can answer the Trace click itself
     * (the governance room moves the app to its Traces section, opens this column and
     * loads the newest trace — the owner's rule, 2026-10-13). An element never reaches
     * into its host; it says what happened and the host decides.
     */
    this.dispatchEvent(
      new CustomEvent('tab-change', {
        detail: { tab },
        bubbles: true,
        composed: true,
      }),
    );
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
    // A PRESS DURING A LIVE GESTURE REPLACES IT rather than stacking a second set of listeners
    // on the first — the rule the sibling grip already states ("a press during a live gesture
    // REPLACES it rather than stacking", chat-action-bar `_startDrag`), and the other way this
    // gesture ends up unable to let go. Without it the old listeners are unreachable (the fields
    // that named them are overwritten) and no release can ever remove them.
    this._releaseGrip();
    /*
     * THE STRIP KEEPS THE HAND — POINTER CAPTURE, NOT LISTENERS ON THE DOCUMENT.
     *
     * This gesture followed the hand through `mousemove` on the document, and that is what made
     * the gripper unusable beside a framed application: her left neighbour is often an iframe
     * (the Design room's left column frames PostHog), and while the pointer is over a frame the
     * parent document receives NO mouse events at all — not the moves, not the release. Measured
     * 2026-10-19: press the collapsed column's strip, drag left, and the width stopped at the
     * floor while the layout stayed `dragging` with the button up, so every later hover moved a
     * column nobody was holding. The owner: *"the gripper is fighting the user… it's forcing it to
     * the right, I'm not able to expand and collapse."*
     *
     * Pointer capture is the platform's own answer: the strip captures the pointer on
     * pointerdown, and from then until the release EVERY pointermove/pointerup is delivered to
     * the strip — whatever element, or frame, is under the cursor.
     */
    const strip = e.currentTarget as HTMLElement | null;
    if (!strip) return;
    const pointerId = e.pointerId;
    this._gripEl = strip;
    this._gripPointerId = pointerId;
    this._gripMove = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      /*
       * THE MOVE THAT SAYS THE HAND IS EMPTY IS THE RELEASE. Pointer capture already ends the
       * gesture on pointerup/pointercancel; this is the same fact read from the event that
       * carries it — `buttons` is the state of the mouse RIGHT NOW — so a release lost to a
       * focused frame or a dropped event cannot outlive the hand.
       */
      if (ev.buttons === 0) {
        this._gripUp?.(ev);
        return;
      }
      this.dispatchEvent(
        new CustomEvent('input-resize-move', {
          bubbles: true,
          composed: true,
          detail: { clientX: ev.clientX, clientY: ev.clientY },
        }),
      );
    };
    this._gripUp = () => {
      this.dispatchEvent(new CustomEvent('input-resize-end', { bubbles: true, composed: true }));
      this._releaseGrip();
    };
    strip.addEventListener('pointermove', this._gripMove);
    strip.addEventListener('pointerup', this._gripUp);
    strip.addEventListener('pointercancel', this._gripUp);
    /* THE CAPTURE IS THE GESTURE. It is taken on the strip itself, so every event in flight —
       over the panel, over the left column, over the frame inside it — is routed here. */
    try {
      strip.setPointerCapture(pointerId);
    } catch (err) {
      /* A capture that cannot be taken is said out loud, because the gesture would otherwise
         read as a dead gripper: the pointer would leave this element and the moves would stop. */
      console.error('[design-chat] the column gripper could not capture the pointer:', err);
    }

    this.dispatchEvent(
      new CustomEvent('input-resize-start', {
        bubbles: true,
        composed: true,
        detail: { clientX: e.clientX, clientY: e.clientY },
      }),
    );
    e.preventDefault();
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
    const el = this._gripEl;
    this._gripEl = null;
    if (el) {
      if (this._gripMove) el.removeEventListener('pointermove', this._gripMove);
      if (this._gripUp) {
        el.removeEventListener('pointerup', this._gripUp);
        el.removeEventListener('pointercancel', this._gripUp);
      }
      // The capture belongs to the strip, so it goes with it. `hasPointerCapture` guards the
      // release: releasing an id nobody holds throws, and a throw here would strand the gesture.
      if (this._gripPointerId !== null && el.hasPointerCapture?.(this._gripPointerId)) {
        el.releasePointerCapture(this._gripPointerId);
      }
    }
    this._gripMove = null;
    this._gripUp = null;
    this._gripPointerId = null;
  }

  /** The rail's `collapse-toggle` — chat-button state=Selected, clicked again. */
  private _onCollapseToggle(e: Event): void {
    this.collapsed = Boolean((e as CustomEvent).detail?.collapsed);
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
  private _pickConversation(e: Event): void {
    const el = e.currentTarget as HTMLElement | null;
    const id = el?.dataset.conversationId ?? '';
    if (!id) return;
    el?.dispatchEvent(
      new CustomEvent('conversation-select', {
        bubbles: true,
        composed: true,
        detail: { conversationId: id },
      }),
    );
  }

  render() {
    /*
     * A SEAT MARKED `productRoom` HAS NO OTHER FACE (owner, 2026-10-06: *"no fallbacks in this
     * application … I would rather it just be a blank page than have a fallback."*). Until the
     * product binding lands — `productTools: true`, set by the room once the engine's carrier
     * answers — this seat draws NOTHING: no tray, no messages branch, no chrome. Every other
     * seat has `productRoom` unset and renders fully as before.
     */
    if (this.productRoom && !this.productTools) return html``;
    const seated = this._seatSlotted();
    const usage = this.usage ?? {};
    const attributed = Boolean(this.conversationId);
    const unannotated = (this.unannotatedInUse ?? []).length > 0;
    return html`
      <!-- THE COLUMN'S SPACER — "chat-left-spacer" #40001085:2598, and it is this
           component's first child, not the host's.

           THE DESIGN PUTS THREE SIBLINGS IN ONE CONTAINER: "right-column-panel-
           container" #40001066:3272 holds spacer (x -14857, w 20), rail (x -14837,
           w 74) and panel (x -14763, w 540), with paddingTop 10 and a fill behind
           all three. THIS element is that container in the app, so the strip is
           rendered here — beside the rail and the panel — and the container's own
           padding and fill reach it, which they could not while it was a sibling of
           the pane outside this component. That was the fault behind three visible
           symptoms: the strip standing 10px proud of the rail, showing the shell
           through its transparency instead of the container's fill, and covering the
           container's top inset band.

           The drag STARTS here too, on this element, and leaves as the rail's own
           declared contract — right-column-drag-start, which the allowlist has
           declared all along and nothing emitted. The host owns the widths, so the
           host does the sizing; the component owns the grip, so the component
           raises the gesture. -->
      <div
        class="gripper-chat"
        data-node-id="40001085:1470"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the chat column"
        @pointerdown=${this._onGripDown}
      >
        <!-- Figma "Meatballs-for-spacer-between-columns" #40001085:1478. One glyph,
             two colours, from the two states of set "chat-left-spacer"
             #40001085:2598: state=Default strokes #B4B4B4, state=Hover strokes
             #7E72E3. Drawn with currentColor so the hover is a colour change and not
             a second asset. -->
        <svg width="10" height="38" viewBox="0 0 10 38" fill="none" aria-hidden="true">
          <ellipse cx="5.35914" cy="2.08103" rx="1.08108" ry="1.02564" transform="rotate(-90 5.35914 2.08103)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.35914" cy="8.56736" rx="1.08108" ry="1.02564" transform="rotate(-90 5.35914 8.56736)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.35914" cy="15.0537" rx="1.08108" ry="1.02564" transform="rotate(-90 5.35914 15.0537)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.56422" cy="22.081" rx="1.08108" ry="1.02564" transform="rotate(-90 5.56422 22.081)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.56422" cy="28.5674" rx="1.08108" ry="1.02564" transform="rotate(-90 5.56422 28.5674)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          <ellipse cx="5.56422" cy="35.0537" rx="1.08108" ry="1.02564" transform="rotate(-90 5.56422 35.0537)" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <slot
        class=${seated ? 'seat' : 'seat empty'}
        @slotchange=${this._onSlotChange}
      ></slot>
      ${seated
        ? nothing
        : html`
            <chat-navigation-bar
              active-tab=${this.collapsed ? '' : this.activeTab}
              allowed-tabs=${this.allowedTabs}
              tab-labels=${this.tabLabels}
              disabled-tabs=${this.disabledTabs}
              ?collapsed=${this.collapsed}
              ?unread=${this._unread}
              @tab-change=${this._onTabChange}
              @collapse-toggle=${this._onCollapseToggle}
            >
              <img slot="logo" src=${logoAsset} width="50" height="50" alt="Grace" />
            </chat-navigation-bar>
            <div class="panel tab-${this.activeTab || 'none'} ${this.collapsed ? 'collapsed' : ''}">
              <!-- The listener sits on the WRAPPER so it hears conversation-select
                   from the Conversations dropdown below and from the thread. -->
              <div class="chat-output-wrapper" @conversation-select=${this._onConversationSelect}
                     @toggle-output-window=${this._onOutputWindow}
                     @remove-output-window=${this._onOutputWindow}>
                <!-- THE STATUS BLOCK IS ABSENT WHEN IT HAS NOTHING TO SAY, not merely empty.
                     chat-header draws nothing inside such a block, but the ELEMENT would still
                     be there — and it is :first-child, so the leading block's deeper top
                     padding (20px, the drawing's own value for the first block) landed on an
                     empty box while the bar below it kept 10 and sat tight against the top
                     (owner, 2026-09-19). Absent, the block after it leads and takes the 20. -->
                <!-- THE TOP PANEL IS ALWAYS DRAWN — it is the first block of the output
                     area in v.4b (#40001119:6308), not a conditional one. It was gated on
                     _hasStatusLine, so a seat with no status text lost the block entirely
                     and the Conversations bar took the top. The owner, 2026-09-20: "you
                     left out the top panel." The drawing stacks four blocks and the status
                     line is the first of them; whether it HAS anything to say is
                     chat-header's business, not whether the block exists.
                     THE TOKEN READOUT LIVES HERE NOW, not in the foot: the owner,
                     2026-09-20: "The top panel contains Tokens: 0, it doesn't go into
                     footer anymore." The drawing's status line is the readout line — the
                     numbers are joined into it by chat-header, which is where the navy
                     bar's readouts went when it was replaced. -->
                <!-- THE OTHER TWO BARS, AS v.4b DRAWS THEM. The wireframe stacks three
                     single-line bars above the response card — the session status
                     (#40001119:6309), "23 Conversations" (#40001119:6318) and
                     "23 Ready for approval" (#40001119:6579) — and each sits on its own
                     #CBE6E3 block. The numbers here are the panel's own: the package's
                     conversations and the reports filed for approval. The wireframe's
                     "23" is sample copy and is not drawn — a count that is not the real
                     count is the one thing a status bar must never say. The Conversations
                     bar is the drawing; the SELECTOR that used to hang under it
                     ("chat-output-slot-area" #40001085:1521) is switched off below. -->
                <!-- THE LEADING BAR OPENS THE CONVERSATIONS — the owner, 2026-09-19: "I should be
                     able to go to the chat at the top and it should expand so that I can see the
                     message that you just archived." It is the list's header, so it acts like
                     one: click (or Enter/Space) to open it, and the rows below come from the same
                     read as the count — the package's own conversations, ARCHIVED ONES INCLUDED,
                     which is how a conversation this seat archived stays reachable. -->
                <!-- THE CONVERSATIONS BAR'S OWN LAYERS, from the file: the block 40001119:6317
                     holds #40001126:2014 (500x7, centred), its row #40001126:2015, and five
                     dots #40001126:2016-2020. Each copy of this bar carries its own ids.
                     RE-POINTED: the designer re-drew this gripper, so the file deleted
                     40001123:6765-6771 and created the same layer under new ids — same name,
                     same size, same place in the block. The markers follow the layer the file
                     draws today; a marker left on a dead id claims nothing and compares
                     nothing. (The re-draw also dropped the gold accent dot: all five now carry
                     the one stroke, as the readout's five already did.) -->
                <output-header
                  line=${this._statusLine}
                  ?attributed=${attributed}
                  ?readout-filled=${this._statusContentSlotted}
                  tokens=${String((usage.totalTokens as number) ?? 0)}
                  calls=${String((usage.calls as number) ?? 0)}
                >
                  <!-- THE ROOM'S READOUT STRIP RELAYS THROUGH HERE (owner, 2026-10-13 late
                       — the trace facts go in THIS bar). A room appends its strip to this
                       seat with slot="status-content"; the relay forwards it into the
                       bar's own door (readout-content). Empty elsewhere: nothing is
                       forwarded and the bar is exactly what it always was. -->
                  <slot name="status-content" slot="readout-content" @slotchange=${this._onStatusSlotChange}></slot>
                </output-header>
                <!-- THE CONVERSATION FURNITURE STEPS OUT WHERE A ROOM'S OWN VIEW SHOWS
                     (owner, 2026-10-13 late: "you can remove the conversation panel …
                     in the trace view. We don't need it there." — and the trace view
                     STAYS: the correction was "in the trace view", not removing it).
                     When the active tab's claimant is a host view (the trace room's
                     tree on Trace, its detail on Preview), this bar is not drawn — a
                     tab showing its own view shows THE VIEW, nothing appended. Every
                     other tab and every other room: unchanged. -->
                ${this._outputWindows.includes('conversations')
                  ? html`<chat-header
                  status-text=${(() => {
                    const n = this._conversationRows?.length ?? (this.conversations ?? []).length;
                    // The drawing's copy is "23 Conversations"; one of them is one conversation.
                    return `${n} ${n === 1 ? 'Conversation' : 'Conversations'}`;
                  })()}
                  role="button"
                  tabindex="0"
                  aria-expanded=${this._conversationsOpen ? 'true' : 'false'}
                  aria-label="Show this package's conversations"
                  icon=${historyIcon}
                  icon-node="40001123:6745"
                  icon-size="22"
                  block-node="40001119:6317"
                  bar-node="40001119:6318"
                  text-node="40001123:6744"
                  grip-node="40001126:2014"
                  grip-row-node="40001126:2015"
                  grip-dots="40001126:2016,40001126:2017,40001126:2018,40001126:2019,40001126:2020"
                  dm-sans
                  @click=${this._toggleConversations}
                  @keydown=${this._onConversationsKey}
                ></chat-header>`
                  : nothing}
                ${this._conversationsOpen
                  ? html`<div class="output-slot">
                      <ul class="conversation-list">${this._conversationRowsForList()}</ul>
                      ${this._listNote ? html`<p class="conv-note" role="status">${this._listNote}</p>` : nothing}
                    </div>`
                  : nothing}
                <!-- THE DROPDOWN IS OUT OF THE TOP; ITS CAPABILITY IS NOT. See the
                     _conversationsTopSlot field above: v.4b draws no selector here, and the
                     owner's plan is that conversations open from the footer's own mark
                     (#40001119:6622), so the block is switched off rather than deleted. -->
                ${this._conversationsTopSlot
                  ? html`
                      <div class="output-slot">
                        <small-dropdown label="Conversations">
                          ${this._conversationItems()}
                        </small-dropdown>
                      </div>
                    `
                  : nothing}
                ${unannotated
                  ? html`<error-banner
                      code="UNANNOTATED-IN-USE"
                      message="A component in use was generated without its catalog annotation — its behaviour is being invented downstream."
                    ></error-banner>`
                  : nothing}
                <!-- THE REPAIR LIST IS NOT DRAWN HERE ANY MORE. It was a permanent
                     sibling in this template — a console list above the composer in
                     every assembly, owned by the panel rather than by the surface that
                     has the findings. It arrives the same way the trace view does, in
                     the "view" slot below: chat-panel draws the slot, the surface fills
                     it. See chat-repair-actions and the console assembler. -->
                <!-- THE CONTENT SLOT — the design's "Current content goes here"
                     (chat-output-simple-slot-area #40001085:2373, whose note reads
                     "holds plain text output and inserted functions").
                     The CHAT tab shows the thread; every other tab shows whatever
                     the host slots into the "view" slot — Trace, Versions, Tools or
                     Approvals. One slot, four views: the slot stays generic and the
                     view decides, which is the same split as the dropdown. -->
                <!-- A HOST-FILLABLE SLOT ABOVE THE WORK — the hole a host fills with
                     whatever belongs at the top of the content: the canvas's own
                     events, a run's notes, a summary of what is being worked on. The
                     same idea as the "view" slot one level down, and EMPTY BY DEFAULT
                     ON PURPOSE: the wrapper takes no height and paints nothing when
                     nothing is slotted, so every existing assembly is unchanged.
                     Anything slotted here brings its own height, border and disclosure. -->
                <!-- THE ONE SCROLLER. Everything below the conversations dropdown and
                     above the composer moves under a single scrollbar on this column's
                     right edge: the repairs, the thread, whatever view the rail selected.
                     There are no inner scrollers here any more — a repair list that
                     scrolls inside a column that also scrolls is two scrollbars for one
                     movement, and the owner's rule is one (2026-09-18). It also means a
                     list GROWS as long as it is: 500 repairs is 500 rows down, which is
                     the incentive to clean them up, and a cap would hide exactly that. -->
                <!-- THE RESPONSE CARD — v.4b's fourth block is the card itself
                     (#40001119:6327 / its block :6326): the same shell as the bars with
                     the response inside it. The scroller and every view that was in the
                     output area before are inside it, unchanged: the thread, the trace
                     fold, the view slot, the content-header slot. -->
                <chat-header card .hasResults=${this._hasResultTurns}>
                  <div class="content-scroll" @scroll=${this._onOutputScroll}>
                    <div class="content-header"><slot name="content-header"></slot></div>
                  ${this._showsThread
                    ? html`${this._chatTopView()
                        ? html`<div class="chat-top">
                            <slot name="view" @slotchange=${this._onSlotChange}></slot>
                          </div>`
                        : nothing}
                      ${this.activeTab === 'approvals' && this._inspectionReports.length
                        ? html`<div class="fold-wrap">
                            <chat-fold
                              label="Inspections"
                              count=${`${this._inspectionReports.length} filed`}
                              ?open=${this._approvalsOpen}
                              @fold-toggle=${(e: CustomEvent<{ open: boolean }>) => { this._approvalsOpen = e.detail.open; this.requestUpdate(); }}
                            >
                              <div class="inspection-reports">
                                ${this._inspectionReports.map(
                                  (r) => html`<article class="inspection-report">
                                    ${String(r.content || '')
                                      .split('\n')
                                      .map((line) => {
                                        const t = line.trim();
                                        if (!t) return nothing;
                                        const cls = t.startsWith('‼')
                                          ? 'line-attention'
                                          : t.startsWith('✓')
                                            ? 'line-ok'
                                            : t.startsWith('INSPECTION')
                                              ? 'line-head'
                                              : 'line-body';
                                        return html`<div class=${cls}>${t}</div>`;
                                      })}
                                  </article>`,
                                )}
                              </div>
                            </chat-fold>
                          </div>`
                        : nothing}
                      ${this._historyError
                        ? html`<p class="conversation-none" role="alert">${this._historyError}</p>`
                        : nothing}
                      ${this.productTools
                        ? html`<chat-product-thread
                            .messages=${this._thread}
                            ?running=${this.productRunning}
                            .runStartedAt=${this.productRunStartedAt || 0}
                            .expectedMinutes=${this.productExpectedMinutes || 0}
                          ></chat-product-thread>`
                        : html`<chat-messages
                            .messages=${this._thread}
                            .sending=${this._workActive}
                            .stage=${this._workStage}
                            .spentActions=${[...this._spent]}
                            .spentTurn=${this._spentTurn}
                            .doneActions=${this._stepsDone()}
                          ></chat-messages>`}`
                    : this.activeTab === 'trace' && !this._tabClaimant('trace')
                      ? html`<div class="fold-wrap">
                          <chat-fold
                            label="Trace"
                            ?open=${this._traceOpen}
                            @fold-toggle=${(e: CustomEvent<{ open: boolean }>) => { this._traceOpen = e.detail.open; this.requestUpdate(); }}
                          >
                            <slot name="view" @slotchange=${this._onSlotChange}></slot>
                            ${this._viewSlotted()
                              ? nothing
                              : html`<div class="view-waiting" role="status">
                                  ${this._emptyViewLine()}
                                </div>`}
                          </chat-fold>
                        </div>`
                      : this.activeTab === 'sessions'
                        ? html`<div class="sessions-out">
                            <sessions-feed
                              .queryRows=${this._laneRows}
                              .receipt=${this._laneReceipt}
                              .laneError=${this._laneError}
                              ?laneBusy=${this._laneBusy}
                              @sessions-lane-clear=${this._onSessionsLaneClear}
                            ></sessions-feed>
                          </div>`
                      : html`<div class="view-slot tab-${this.activeTab || 'none'}">
                          <slot name="view" @slotchange=${this._onSlotChange}></slot>
                          ${this._viewSlotted()
                            ? nothing
                            : html`<div class="view-waiting" role="status">
                                ${this._emptyViewLine()}
                              </div>`}
                        </div>`}
                  </div>
                  <!-- THE DRAWN SCROLLBAR, INSIDE THE CARD. It is a SIBLING of the scroller
                       and a child of the card, so it holds the card's right edge while the
                       conversation travels under it — the card owns position: relative for
                       it (see chat-header). Nothing at all when the content fits
                       (_railVisible false); a 4px thumb over the card when it does not —
                       _syncScrollThumb holds its length and offset. -->
                  ${this._showScrollBar && this._railVisible
                    ? html`<div class="scroll-rail">
                        <div
                          class="scroll-thumb"
                          role="scrollbar"
                          aria-orientation="vertical"
                          aria-label="Scroll the chat"
                          aria-valuemin="0"
                          aria-valuemax=${this._scrollMax}
                          aria-valuenow=${this._scrollPos}
                          style=${`height: ${this._thumbH}px; top: ${this._thumbTop}px`}
                          @mousedown=${this._onThumbDown}
                        ></div>
                      </div>`
                    : nothing}
                </chat-header>
              </div>
              <div class="chat-input-wrapper">
                <chat-action-bar
                  model-label=${this.modelLabel ?? 'Models'}
                  trailing=${this._seatIsConsole === false ? 'console' : 'agent'}
                  composer-package=${this.composerPackageId ?? ''}
                  ?busy=${this._sending}
                  ?has-text=${this._draft.trim().length > 0}
                  @input-resize-start=${this._onResizeStart}
                  @input-resize-move=${this._onResizeMove}
                  @send-input-to-model=${this._onSendCommand}
                  @stop-model-thinking=${this._onStopCommand}
                ></chat-action-bar>
                <chat-input
                  .height=${this.inputHeight}
                  @message-sent=${this._onMessageSent}
                  @keydown=${this._onComposerKey}
                >
                  <prompt-textarea
                    placeholder="chat input"
                    @value-input=${this._onDraftInput}
                    @paste=${this._onProductPaste}
                  ></prompt-textarea>
                </chat-input>
                <!-- THE TRAY IS v.4b's FOOT. The navy <chat-footer> that stood here is
                     REPLACED: the drawing does not draw it, and the owner's ruling is that
                     the drawing is the truth — "If the design doesn't draw it, then it's
                     been replaced. This is the new truth replace it." Its token readouts are
                     a live FUNCTION, and a function does not leave with a drawing, so they
                     move onto this bar and take its treatment — the same move that put them
                     on the navy bar when the #CFD7D5 bar it replaced went away. -->
                <!-- v.4b's foot, OR THE PRODUCT ROOM'S OWN TOOLS (owner, 2026-10-06:
                     "all of these stubs go. And you're gonna put the products wiring
                     down."). The flag is the product room's binding alone — every other
                     seat keeps the tray (its five marks retired 2026-10-14; label and
                     credit alone — see its header). See <chat-product-tools>. -->
                ${this.productTools
                  ? html`<chat-product-tools
                      .figmaConnected=${this.productFigmaConnected}
                      .githubConnected=${this.productGithubConnected}
                      .visualEditActive=${this.productVisualEditActive}
                      @product-attach=${(e: CustomEvent<{ files: File[] }>) =>
                        this._forwardProductAttach(e.detail.files)}
                      @product-tool=${(e: CustomEvent<{ tool: string }>) =>
                        this._forwardProductTool(e.detail.tool)}
                    ></chat-product-tools>`
                  : html`<chat-plugin-tray></chat-plugin-tray>`}
              </div>
            </div>
          `}
    `;
  }
}

if (!customElements.get('design-chat')) customElements.define('design-chat', DesignChat);

declare global {
  interface HTMLElementTagNameMap {
    'design-chat': DesignChat;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'design-chat': React.DetailedHTMLProps<
        React.HTMLAttributes<DesignChat> & {
          'session-id'?: string;
          'conversation-id'?: string;
          'status-text'?: string;
          'allowed-tabs'?: string;
          /** React 19 sets the matching PROPERTY, so a real boolean is correct —
              never the string "false", which Lit's boolean converter reads as true. */
          collapsed?: boolean;
          ref?: React.Ref<DesignChat>;
        },
        DesignChat
      >;
    }
  }
}
