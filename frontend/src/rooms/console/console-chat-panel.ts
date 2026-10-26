/**
 * <console-chat-panel> — THE CONSOLE'S OWN SEAT.
 *
 * A tab's seat is its own file (owner, 2026-10-18: "a tab's seat is its own file; the only things
 * shared are the lit components and the styling"). This is that file for the Console. The shared
 * <chat-panel> still serves the Composer and the Governance room; nothing in this file is reached
 * from either of them, and nothing they change reaches this seat.
 *
 * WHAT THE CONSOLE IS, AND WHAT THIS SEAT DOES IN IT (owner, 2026-10-23): the Console is the index
 * of every prompt package the person has built, and this chat is how the person searches that
 * index, filters it, sorts it, organises it and discovers what is in it. She does nothing else
 * here. She does not write into a prompt, she does not run one, and she does not report on another
 * room's work. The cards on the left are her subject, and the library they form is placed in front
 * of her on every turn (see _buildWorkspaceContext).
 *
 * WHERE ITS FACTS COME FROM. The server assembles the Console's surface and names this element in
 * the right-hand column (routes/ai.py, `render-console`). It binds the Console's own session and
 * conversation:
 *
 *     /console/session_id
 *     /console/conversation_id
 *     /console/conversations
 *     /console/grace_instructions
 *     /cards                      (the library, through `consoleCards`)
 *
 * and it fills this element's "view" slot with the console's repair rows (chat-repair-actions),
 * which stay shared because they are already the Console's own view.
 *
 * WHAT WAS SEVERED, AND WHY IT IS NOT A SWITCH. The shared seat serves every room by asking the
 * server which room it is in, then branching on the answer. That question is a switch over the
 * room, and this copy answers it by existing: it is the Console's seat, always. The package's
 * facts and acts, the Product room's settings and pieces, the Governance room's selected trace and
 * the Design room's teaching call are not present here — not hidden behind a condition, but
 * removed.
 */
import { LitElement, html, css, nothing } from 'lit';
// The right column's pieces. They stay SHARED — they are the drawing and the styling the catalog
// governs — and each import here is a side effect that defines the tag before this element draws. 
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
import '@/components/lit/error-banner';
import '@/components/lit/chat-navigation-bar';
import '@/components/lit/prompt-input/prompt-textarea';
import logoAsset from '@/components/lit/assets/chat-logo-gemini.png';
// The app's own logger. A turn warning from the server is written here as well as drawn in
// the thread: the Trace tab reads this logger (lib/trace-source subscribes to it), and the
// owner asked for exactly that — "we need to report it in the console trace" (2026-09-18).
import { logger } from '@/lib/logger';
// Grace's surface commands. A reply that carries XML tags drives the surface — through window
// CustomEvents and the event bus, the same doors the React seat used.
import { eventBus } from '@/shared/event-bus';
import { consumeArrival, type ArrivalKind } from '@/shared/arrival';
// The app's one "when" — the same format the Evals feed shows for a run. See shared/when.
import { formatWhen } from '@/shared/when';
import { resultsAreTheReading } from '@/shared/chatScroll';
import { isDemoMode } from '@/shared/appConfig';
import { getStoredUserId } from '@/services/authService';

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

export class ConsoleChatPanel extends LitElement {
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
    /** The console's prompt packages, for Grace's workspace context. */
    consoleCards: { type: Array },
    /** Open catalog findings, for Grace's workspace context. */
    catalogFindings: { type: Array },
    /** Component ids carrying an open annotation finding — draws the red banner. */
    unannotatedInUse: { type: Array },
    /** Label on the Models button in the action bar. */
    modelLabel: { type: String, attribute: 'model-label' },
    /** The Console's conversations, fed by the surface — the selector's list. */
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
  };

  // `declare` — NOT a class field. With `useDefineForClassFields` true, a plain field
  // here overwrites Lit's accessor and the element never draws (the blank right column
  // this file once was). Every element in this repo declares properties this way.
  /** The Console's conversation. Bound from /console/conversation_id. */
  declare conversationId?: string;
  /** The Console's history, as the server loaded it. Bound from /console/messages when present. */
  declare messages: SeatMessage[];
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
   * carries ACTIVE rows only, while what the owner counts is the seat's conversations
   * (the archived one is exactly what he asked to keep "into the conversations list").
   *
   * `session_id` is the console's own column — the read the console's assembly itself uses —
   * with archived rows included. Until it is read (or if it cannot be), the bar falls back
   * to the surface's list length, which is real data too, just staler.
   */
  private _conversationRows: Array<{ id: string; title: string; tab: string; archived: boolean; savedAt: string }> | null = null;
  /**
   * HAS THIS SEAT'S CONVERSATION LIST BEEN READ YET?
   *
   * "This seat has no conversation" is a claim about the SERVER's list, and an unread list is not
   * an empty one. Without this the seat drew the conclusion from a null list the moment it learned
   * which session it was bound to — before the read came back — and greeted a seat whose
   * conversations were sitting right there.
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
  /** A conversation is being created for the console right now — see _startNewConversation. */
  private _creatingConversation = false;
  /** Whether the leading bar's conversation list is open. */
  private _conversationsOpen = false;
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
  /** The Console's session. Bound by the surface from /console/session_id. */
  declare sessionId?: string;
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
   * THE ARRIVAL GREETING'S BOOKKEEPING. `_historyChecked` says the thread has been
   * read or found absent, so "no turns" is a fact rather than a not-yet; `_greeted`
   * makes the greeting happen once per seat, however many times this element
   * re-renders.
   */
  private _historyChecked = false;
  private _greeted = false;
  /** A surface opened, for a seat that may have been created by that same commit. */
  private _wantsGreeting: ArrivalKind | '' = '';
  /** Turns spoken since this element mounted; the surface supplies everything before that. */
  private _local: SeatMessage[] = [];
  /**
   * Turns that were answered while this seat had NO conversation to write them into.
   *
   * The backend answers them and does not write them down — "this turn will not be persisted" —
   * because `conversations.session_id` is NOT NULL and a seat with no conversation yet has no row
   * to attach them to. They live here until `flushPendingTurns` hands them to the conversation
   * that first exists.
   */
  private _pending: SeatMessage[] = [];
  /**
   * WHICH SESSION THE PENDING TURNS WERE SPOKEN IN — null when they were spoken before any
   * conversation existed, which is the case `flushPendingTurns` is for. A turn belongs to the
   * conversation it was spoken in; this is what lets the seat refuse to write one seat's words
   * into another seat's thread.
   */
  private _pendingOwner: string | null = null;
  /** The session this seat was last told it belongs to — the measure of a session CHANGE. */
  private _sessionHeld: string | null = null;
  /** A failed history read, in words the person can see — never an empty thread that says nothing. */
  private _historyError = '';
  /** The slotted input's draft, and the in-flight request's abort handle. */
  private _draft = '';
  private _abort: AbortController | null = null;
  /** The spacer's gesture while it is in flight — see _onGripDown. */
  private _gripMove: ((e: MouseEvent) => void) | null = null;
  private _gripUp: (() => void) | null = null;
  /** The window boundary during a grip — the one channel an outside release is visible on. */
  private _gripBoundary: ((e: MouseEvent) => void) | null = null;

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
   * THE BUTTONS ALREADY PRESSED, by their action. A row of buttons is a list of things to do,
   * and this is what lets one of them read as done while the rest stay live. Cleared when the
   * seat moves to another package: an action belongs to the thread it was offered in.
   */
  private _spent = new Set<string>();
  /** The turn whose buttons those were — see the press handler and ChatMessages.spentTurn. */
  private _spentTurn = '';


  connectedCallback(): void {
    super.connectedCallback();
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
    window.addEventListener('a2ui:system-message', this._onHostSay);
    window.addEventListener('a2ui:composer-opened', this._onComposerOpened as EventListener);
    // A chat button's answer arrives here from <chat-messages> and goes down the one send
    // path this seat has — the same one the input uses.
    this.addEventListener('chat-action-send', this._onActionSend);
    // The thumb's length depends on the region's height, so a window resize re-measures it.
    window.addEventListener('resize', this._onOutputScroll);
  }

  disconnectedCallback(): void {
    window.removeEventListener('a2ui:system-message', this._onHostSay);
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
     * THE BRACKETS COME OFF FIRST. A button's action arrives as `[<action>]` — that is the wire
     * the seat's buttons send. Below this point `text` is an action.
     */
    const action = text.startsWith('[') && text.endsWith(']') ? text.slice(1, -1) : text;
    /*
     * A PRESSED BUTTON IS SPENT, WHATEVER IT WAS — recorded before anything else can fail,
     * because the press has happened either way and the row is a list the person is working down.
     * The mark belongs to one turn (`_spentTurn`): every proposing reply ends with the same link,
     * and a mark kept by action alone would draw a later Confirm as already pressed.
     */
    this._spentTurn = String(((e as CustomEvent).detail?.turn as string) ?? '');
    this._spent.add(action);
    this.requestUpdate();
    /*
     * A COMMAND THIS ROOM DOES NOT PERFORM IS SAID SO, NOT SENT.
     *
     * The Console's one control of its own is `<reassemble-console …/>`, a tag in her reply
     * rather than a button. So a one-token action, or one carrying `:` or `|`, is a command this
     * room cannot perform. Sending it to the model is the worst available answer: she replies to
     * the wire format as though it were a request and says she has done the thing, so the person
     * is told the work is done by the one path that cannot fail loudly. A sentence with spaces in
     * it is a question, and goes to her as one.
     */
    if (/^[^\s]+$/.test(action) || /[:|]/.test(action)) {
      this._local = [
        ...this._local,
        {
          role: 'assistant',
          content:
            `⚠️ That button asks for something this room does not do (${action.slice(0, 80)}), ` +
            'so nothing was changed. The Console is the index of your prompts; ask me to find, ' +
            'filter or sort what is in it.',
          alert: true,
        },
      ];
      this.requestUpdate();
      return;
    }
    // A button carries words she wrote, so the shape is known and there is nothing to work out.
    void this._send(text);
  };

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
    // THE TRAY, not <chat-footer>: the drawing's foot replaces it, so the bar the input height
    // must reserve is the foot's block — the design's own 97px (#40001123:6689), which is what
    // the fallback carries if the element is not up yet.
    const footer = this.renderRoot?.querySelector('chat-plugin-tray') as HTMLElement | null;
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
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
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
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      cursor: col-resize;
      color: #b4b4b4;
      user-select: none;
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
    /* THE CONSOLE RUNS NOTHING. The thread is the only place a result turn could appear, and the
       console's own archived conversations — an earlier welcome, the approvals thread — are not a
       run, so they are not read here. */
    return this._thread.some((m) => m.result === true);
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
    return this.activeTab === 'chat' || this.activeTab === 'approvals';
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
    // A SESSION CHANGE STARTS THE SEAT OVER. The panel is REUSED across assemblies (the surface
    // keeps the same component id — see the note on `_thread`), so without this the previous
    // session's spoken turns (`_local`) and its loaded history stay on screen over the next one.
    if (changed.has('sessionId')) {
      this._startOverSeat(String(this.sessionId ?? ''));
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
      void this._readConversations(this._userId());
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
   * THE SEAT STARTS OVER WHEN THE SESSION IT IS BOUND TO CHANGES.
   *
   * A thread belongs to the conversation it was spoken in. `_local` (everything typed here and
   * every host message this seat heard) is never carried across, and the loaded history goes with
   * it. The CONVERSATION ID is not cleared here: the surface binds the incoming id, and clearing
   * it would fight the binding arriving in this same update.
   *
   * THE CONSOLE HAS ONE SESSION, so this runs when a fresh seat is given it. It exists so a reused
   * element can never show the previous session's words under the new one.
   */
  private _startOverSeat(nextSession: string): void {
    const prior = this._sessionHeld;
    this._sessionHeld = nextSession;
    if (prior === nextSession) return;

    this.messages = [];
    this._local = [];
    this._spent.clear();
    this._spentTurn = '';
    this._historyError = '';
    /* THE THREAD HAS NOT BEEN READ YET. `_historyChecked` says "the history attempt finished";
       carrying it over would let the greeting read a thread that has not been loaded. */
    this._historyChecked = false;
    /* AND THE CONVERSATION LIST HAS NOT BEEN READ EITHER, so a list from the session before
       cannot answer "does this seat have a conversation at all". */
    this._conversationsRead = false;
    this._conversationRows = null;
    // PENDING TURNS BELONG TO THE CONVERSATION THEY WERE SPOKEN IN. They can never be written
    // anywhere else without lying about where they came from. They are dropped, and LOUDLY.
    if (this._pending.length && this._pendingOwner && this._pendingOwner !== nextSession) {
      console.error(
        `[console-chat-panel] ${this._pending.length} turn(s) spoken in session ${this._pendingOwner.slice(0, 8)}… were never saved. ` +
        `The seat has moved to ${nextSession ? nextSession.slice(0, 8) + '…' : '(no session)'} and will not carry them across — ` +
        'a conversation belongs to the session it was spoken in.',
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
    if (!this._conversationBelongsToSeat(this.conversationId)) { this._historyChecked = true; return; }
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
        console.error(`[console-chat-panel] history read refused for ${String(this.conversationId).slice(0, 8)}…: HTTP ${resp.status}`);
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
      console.error('[console-chat-panel] could not read the conversation\'s history:', err);
      this.requestUpdate();
    }
  }

  /**
   * SHE INTRODUCES HERSELF ON ARRIVAL — BY BEING ASKED, NOT BY A PRINTED LINE.
   *
   * The thread must not open with a fixed string. The owner, 2026-09-28: "I don't want a
   * hardcoded message… I want her to be thinking and reply." So she is ASKED, the working state
   * shows while she answers, and the words in the thread are hers. The ask says that a person has
   * just landed on the console; it does not tell her what to say.
   *
   * ONLY THE CONSOLE'S ARRIVAL IS ANSWERED HERE. The announcement is broadcast on `window`, so a
   * package's or another room's arrival reaches this element too — and reading one of those would
   * put another room's greeting into the console's own conversation, which is the fault measured
   * on 2026-09-23: 31 messages about one package's prompt sitting in the thread whose job is
   * organising cards. This seat is the Console's, so it answers the Console's arrival and nothing
   * else. A silent send, so the ask is not drawn as the person's own turn.
   */
  private _onComposerOpened = (e: Event): void => {
    const d = ((e as CustomEvent).detail || {}) as { kind?: string };
    if (d.kind !== 'console') return;
    this._takeArrival('console');
    this._greetIfArriving();
  };

  /**
   * A NEW ARRIVAL HAS NOT BEEN ANSWERED — whatever this seat did on the last one.
   *
   * THE SEAT IS REUSED. The surface keeps the same component id across assemblies, so `_greeted`
   * has to mean "this ARRIVAL has been answered", not "this ELEMENT has spoken". It is cleared
   * here, at the one place an arrival is taken, so a second landing can be greeted.
   */
  private _takeArrival(kind: ArrivalKind): void {
    this._wantsGreeting = kind;
    this._greeted = false;
  }

  private _greetIfArriving(): void {
    /*
     * A CONSOLE WITH NOTHING TO READ IS AN ARRIVAL, ANNOUNCED OR NOT.
     *
     * The seat does not need an announcement to know it has nothing to read: it holds the thread.
     * A console with no conversation bound has no history, so there is nothing for her to answer
     * and nothing for the person to read either — that is the state she introduces herself into.
     * The owner, 2026-09-23: "there's no reason to add a new greeting if the user has not engaged
     * with the console chat … the AI is not the conversation. It's a human being that initiates
     * the conversation." The first conversation is created by the person's first turn, not by
     * looking.
     */
    if (!this._wantsGreeting && this.sessionId && !this.conversationId) {
      this._historyChecked = true;
      this._wantsGreeting = 'console';
    }
    /* THIS SEAT ANSWERS THE CONSOLE'S ARRIVAL AND NOTHING ELSE. Every other kind belongs to a
       room this element is not in, and reading one would put another room's greeting here. */
    if (this._wantsGreeting !== 'console') return;
    if (this._greeted || !this._historyChecked) return;
    if (this._historyError || this._sending) return;
    /*
     * SHE SAYS HELLO WHEN THERE IS NOTHING TO READ — and the test is the THREAD, not whether a
     * conversation row exists.
     *
     * The first version of this rule read `if (this.conversationId) return` — "she greets only a
     * console with no conversation" — and it silenced her on a console that HAS an empty one:
     * measured 2026-09-23, a conversation existed with 0 messages, so no greeting, and the
     * owner's report was exactly what that looks like from the seat: "This is gone again. The
     * model has disappeared from console again."
     *
     * THE EMPTINESS IS THE FACT: nothing from the surface's history and nothing spoken locally.
     * An empty conversation reads as empty, a conversation with words in it reads as words, and
     * the greeting therefore happens once per thread: she says hello, her reply is written into
     * that conversation, and every load after it reads her own words back instead of saying them
     * again.
     */
    this._greeted = true;
    const empty = (this.messages?.length ?? 0) === 0 && this._local.length === 0;
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
  }


  /**
   * IS THIS CONVERSATION ONE OF THIS SEAT'S?
   *
   * The element cannot read `conversations.session_id`; what it CAN do is refuse an id that the
   * seat's own list — `/console/conversations`, what the surface binds — contradicts. An EMPTY
   * list proves nothing (an untouched console, or a list that failed to load: routes/ai.py
   * swallows that failure into a warning), so only a positive contradiction refuses, and the
   * refusal is LOUD. A conversation belongs to the session that owns it; a seat told otherwise is
   * being lied to, and silence is how it happened.
   */
  private _conversationBelongsToSeat(id: string): boolean {
    if (String(this._adoptedByHost) === String(id)) return true;
    const list = this.conversations ?? [];
    // The surface's list carries ACTIVE rows only; this seat's own server read carries the
    // archived ones too, and a conversation archived from here is still this seat's and must
    // stay openable (owner, 2026-09-19: "it should expand so that I can see the message that you
    // just archived").
    if ((this._conversationRows ?? []).some((r) => String(r.id) === String(id))) return true;
    if (!list.length) return true;
    if (list.some((c) => String(c?.id ?? '') === String(id))) return true;
    console.error(
      `[console-chat-panel] refused conversation ${String(id).slice(0, 8)}…: it is not in session ` +
      `${String(this.sessionId ?? '(none)').slice(0, 8)}'s own list of conversations.`,
    );
    return false;
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


  private _buildWorkspaceContext(): string {
    const parts: string[] = [];

    /*
     * WHAT SHE IS SHOWN IN THIS ROOM: THE LIBRARY, AND NOTHING ELSE.
     *
     * There is no package open here, so there is no package block, no prompt column and no output
     * panel to describe — those facts belong to whatever package the person opens, and stating
     * them here wrote "THIS PACKAGE / name: (none)" into the one room that has no package. She is
     * told nothing about tools either: a tool offered from the index is a tool offered into a
     * prompt that is not open, and her own control is `<reassemble-console …>`.
     */

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

    return parts.join('\n');
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
    /*
     * HER ONE CONTROL OVER THIS ROOM: `<reassemble-console sort="…" filter="…"/>`.
     *
     * She does not write into a prompt from here and she does not run one. The Console is the
     * index, and what she does is ask the room to show it again — the tag carries what she wants
     * to see, and the room answers through its own command channel. The tag is stripped from the
     * prose like every other command, so the person reads her sentence rather than the tag.
     */
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
  private async _send(text: string, opts: { silent?: boolean } = {}): Promise<void> {
    text = (text ?? '').trim();
    if (!text || this._sending) return;
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
    if (!opts.silent && this.activeTab !== 'chat' && this.activeTab !== 'approvals') {
      this.activeTab = 'chat';
    }
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
    if (this.conversationId && !this._conversationBelongsToSeat(this.conversationId)) return;
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
        logger.error('[console-chat-panel] refused a turn: the surface bound no words for this room', {
          conversationId: this.conversationId ?? null,
          sessionId: this.sessionId ?? null,
          instructions: this.instructions ?? '',
          graceLiveContext: this.graceLiveContext,
        });
      } catch (logError) {
        console.error('[console-chat-panel] the logger refused the refusal:', logError);
      }
      return;
    }
    const before = this._local.length;
    if (!opts.silent) {
      this._local = [...this._local, { role: 'user', content: text }];
      this._scrollThreadToBottom();
    }
    this._sending = true;
    if (!opts.silent) {
      // THE WORK CARD OPENS — the person's own turn; silent turns draw nothing.
      this._workActive = true;
      this._workStage = 'thinking';
      if (this._workTimer) clearTimeout(this._workTimer);
      // THE ROOM-AGNOSTIC CAP: a seat in a room that never builds must still end. The
      // no-build fallback below fires first for those seats; this cap is the last resort.
      this._workTimer = window.setTimeout(() => this._endWork(), 30000) as unknown as number;
    }
    this.requestUpdate();
    let answered = false;

    try {
      this._abort = new AbortController();
      const resp = await fetch('/api/teacher/query', {
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
        void this._readConversations(this._userId());
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
        if (reply) this._local = [...this._local, { role: 'assistant', content: reply }];
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
            console.error('[console-chat-panel] the logger refused a turn warning:', logError, warning);
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
      // Her reply (or the failure) just landed — the column follows it down.
      this._scrollThreadToBottom();
      // A turn that was ANSWERED while this seat had no conversation lives only here: the
      // backend refused to write it (no row to bind it to yet), so it is held and handed over
      // by flushPendingTurns when the first turn creates the conversation. Failed turns are not
      // held — an error is not a thing that was said.
      if (answered && !this.conversationId) {
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
   * END THE WORK CARD — the one exit (the no-build fallback in _send, or the cap). The stage is
   * NOT cleared: <chat-messages> reads it in the same update to record the turn in the card.
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
   * THE THREAD THAT PREDATES THE CONVERSATION, WRITTEN DOWN WHEN ONE APPEARS.
   *
   * A turn spoken before a conversation exists has nothing to live in: the backend answers it
   * and does not write it down, and it stays in `_pending` here. When a conversation id is handed
   * over, what was spoken is written into it, in order — so the seat opens onto the thread that
   * was actually had, not an empty one. Only `_pending` travels; turns the backend already owns
   * are not touched. Returns how many messages landed.
   */
  async flushPendingTurns(conversationId: string, sessionId?: string): Promise<number> {
    if (!conversationId || this._pending.length === 0) return 0;
    // PENDING TURNS BELONG TO THE SESSION THEY WERE SPOKEN IN. Spoken before any conversation
    // existed (owner null) they are owed to the one now being created; spoken inside a session,
    // only THAT session may receive them — writing them anywhere else is how one seat's words
    // landed in another's thread.
    if (this._pendingOwner && sessionId !== undefined && this._pendingOwner !== String(sessionId)) {
      console.error(
        `[console-chat-panel] refused to write ${this._pending.length} pending turn(s) spoken in session ` +
        `${this._pendingOwner.slice(0, 8)}… into conversation ${String(conversationId).slice(0, 8)}… — ` +
        'a conversation belongs to the session it was spoken in.',
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
    void this._send(text);
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
    if (opts.tab) this.activeTab = opts.tab === 'approvals' ? 'approvals' : 'chat';
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
    void this._readConversations(this._userId());
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
     * run's own. Archived and never deleted — `_readConversations` asks for the archived
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
    if (!id || id === this.conversationId) return;
    /*
     * AND THE COLUMN MOVES TO THE CONVERSATION'S OWN TAB. A conversation carries the tab it
     * belongs to (conversations.tab, on the dropdown's rows); picking one is a request to
     * continue THAT process, so the panel moves there — approvals stays in approvals, the
     * chat in the chat. This used to move to trace, which the console does not even offer as
     * a tab (measured 2026-09-19). The rail hears it the same way a click on it would:
     * `active-tab` is what this panel passes down, so the highlight and the view move
     * together — one writer, so the two cannot disagree about which tab is showing.
     */
    const picked = (this.conversations ?? []).find((c) => String(c.id) === id);
    this._moveSeatTo(id, { tab: String(picked?.tab || 'chat') });
  }

  /**
   * A NEW CONVERSATION FOR THE CONSOLE — its own act, and the only room it belongs to.
   *
   * The owner, 2026-09-19: "make it work at the bottom so that I can create a new
   * conversation and archive the one that's there… it would get assigned a default title
   * based on the first part of the conversation." And on where it belongs: the console's
   * chat is GLOBAL — "there's conversation IDs per package and in this case it's a
   * conversation ID for the console only… This is the Console package" — so the successor
   * is filed under THIS seat's own session, which is what `sessionId` already is.
   *
   * THE PATHWAY IS THE APP'S OWN:
   *   1. NAME the conversation being left, from the first part of what was said in it —
   *      the rule routes/teacher.py already uses when it creates one (its question's first
   *      80 characters), so a conversation named here and one named there read the same in
   *      the list. Without it the row keeps its working title ("Console — Chat"), and three
   *      of those are three rows nobody can tell apart.
   *   2. ARCHIVE it — POST /api/conversations/{id}/archive. Archived, never deleted.
   *   3. Its successor: POST /api/conversations with this seat's session_id, then point the
   *      session at it (PUT /api/prompt-sessions/{id}), so a reload lands on the new
   *      conversation instead of resurrecting the archived one. The seat's binding
   *      (/console/conversation_id) is the session's own column, which is why repointing it
   *      is what makes the move stick.
   *
   * A FAILURE STOPS THE SEQUENCE AND IS SAID IN THE THREAD. Moving the seat to an id that
   * was never created, or archiving without a successor, would leave a person talking into
   * a conversation that is not there.
   *
   * ONE AT A TIME. The foot's add mark (which called this until it retired with the tray's
   * stub set, 2026-10-14) was a click and could not double-fire; the latch below keeps any
   * future caller from starting two threads for one seat.
   */
  private _startNewConversation(): void {
    if (this._creatingConversation) return;
    this._creatingConversation = true;
    void this._createConversation().finally(() => { this._creatingConversation = false; });
  }

  private async _createConversation(): Promise<void> {
    const userId = this._userId();
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
      void this._readConversations(userId);
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
  private async _readConversations(userId: string): Promise<void> {
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
        this._moveSeatTo(rows[0].id);
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
    // Opening re-reads, so a conversation created or archived a moment ago is in the list
    // rather than missing until the next assembly.
    if (this._conversationsOpen) void this._readConversations(this._userId());
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
      return html`<p class="conversation-none">No conversations yet.</p>`;
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
      await this._readConversations(userId);
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
  private _onGripDown(e: MouseEvent): void {
    // A PRESS DURING A LIVE GESTURE REPLACES IT rather than stacking a second set of document
    // listeners on the first — the rule the sibling grip already states ("a press during a live
    // gesture REPLACES it rather than stacking", chat-action-bar `_startDrag`), and the other way
    // this gesture ends up unable to let go. Without it the old listeners are unreachable (the
    // fields that named them are overwritten) and no release can ever remove them.
    this._releaseGrip();
    this._gripMove = (ev: MouseEvent) => {
      /*
       * THE MOVE THAT SAYS THE HAND IS EMPTY IS THE RELEASE.
       *
       * Every channel below is a way of hearing about the release, and each can be lost: an
       * event stopped on its way up to the document, a focused frame that ate the mouseup, a
       * panel replaced mid-gesture. The move event carries the fact itself — `buttons` is the
       * state of the mouse RIGHT NOW — so the first move after a lost release says the hand is
       * empty whether or not any listener heard the release. Without this the gesture outlives
       * the hand and the strip goes on raising `input-resize-move` — which the layout used to
       * answer by STARTING a drag (see `_onGripMove` in workspace-layout), so the column
       * followed a bare hover with no button held anywhere. Measured 2026-09-30, the owner:
       * "it will not let me release it… I can't even move my mouse over the window and it grabs it."
       */
      if (ev.buttons === 0) {
        this._gripUp?.();
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
    /*
     * AND THE HAND THAT LETS GO OUTSIDE THE WINDOW. A release beyond the page fires no mouseup
     * anywhere, so the strip would keep tracking a hand that is no longer holding anything: it
     * reads the boundary instead — crossing it with NO BUTTON DOWN means the hand is empty,
     * whether it just arrived or just left after letting go.
     */
    this._gripBoundary = (ev: MouseEvent) => {
      if (ev.relatedTarget || ev.buttons !== 0) return; // a move inside the page, or still held
      this._gripUp?.();
    };
    document.addEventListener('mousemove', this._gripMove);
    document.addEventListener('mouseup', this._gripUp);
    document.addEventListener('pointerup', this._gripUp);
    document.addEventListener('pointercancel', this._gripUp);
    document.addEventListener('mouseout', this._gripBoundary);
    document.addEventListener('mouseover', this._gripBoundary);

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
   * LET THE PAGE GO — the strip's three document channels off, once. The same discipline the
   * composer's input grip already keeps (`_endDrag` in chat-action-bar, which is called by its
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
    if (this._gripMove) document.removeEventListener('mousemove', this._gripMove);
    if (this._gripUp) {
      document.removeEventListener('mouseup', this._gripUp);
      document.removeEventListener('pointerup', this._gripUp);
      document.removeEventListener('pointercancel', this._gripUp);
    }
    if (this._gripBoundary) {
      document.removeEventListener('mouseout', this._gripBoundary);
      document.removeEventListener('mouseover', this._gripBoundary);
    }
    this._gripMove = null;
    this._gripUp = null;
    this._gripBoundary = null;
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
      return html`<p class="conversation-none">No conversations yet.</p>`;
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
        @mousedown=${this._onGripDown}
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
                ${this._outputWindows.includes('conversations') && !this._tabClaimant(this.activeTab)
                  ? html`<chat-header
                  status-text=${(() => {
                    const n = this._conversationRows?.length ?? (this.conversations ?? []).length;
                    // The drawing's copy is "23 Conversations"; one of them is one conversation.
                    return `${n} ${n === 1 ? 'Conversation' : 'Conversations'}`;
                  })()}
                  role="button"
                  tabindex="0"
                  aria-expanded=${this._conversationsOpen ? 'true' : 'false'}
                  aria-label="Show the conversations"
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
                     the "view" slot below: console-chat-panel draws the slot, the surface fills
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
                      <chat-messages
                        .messages=${this._thread}
                        .sending=${this._workActive}
                        .stage=${this._workStage}
                        .spentActions=${[...this._spent]}
                        .spentTurn=${this._spentTurn}
                      ></chat-messages>`
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
                  trailing="agent"
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
                  ></prompt-textarea>
                </chat-input>
                <!-- THE TRAY IS v.4b's FOOT. The navy <chat-footer> that stood here is
                     REPLACED: the drawing does not draw it, and the owner's ruling is that
                     the drawing is the truth — "If the design doesn't draw it, then it's
                     been replaced. This is the new truth replace it." Its token readouts are
                     a live FUNCTION, and a function does not leave with a drawing, so they
                     move onto this bar and take its treatment — the same move that put them
                     on the navy bar when the #CFD7D5 bar it replaced went away. -->
                <!-- v.4b's foot. Its five marks retired 2026-10-14; label and credit alone —
                     see its header. -->
                <chat-plugin-tray></chat-plugin-tray>
              </div>
            </div>
          `}
    `;
  }
}

if (!customElements.get('console-chat-panel')) customElements.define('console-chat-panel', ConsoleChatPanel);

declare global {
  interface HTMLElementTagNameMap {
    'console-chat-panel': ConsoleChatPanel;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'console-chat-panel': React.DetailedHTMLProps<
        React.HTMLAttributes<ConsoleChatPanel> & {
          'session-id'?: string;
          'conversation-id'?: string;
          'status-text'?: string;
          'allowed-tabs'?: string;
          /** React 19 sets the matching PROPERTY, so a real boolean is correct —
              never the string "false", which Lit's boolean converter reads as true. */
          collapsed?: boolean;
          ref?: React.Ref<ConsoleChatPanel>;
        },
        ConsoleChatPanel
      >;
    }
  }
}
