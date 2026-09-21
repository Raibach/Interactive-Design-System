/**
 * <chat-panel> — GRACE'S SEAT, DRAWN BY THE SURFACE.
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
import './chat-fold';
import './chat-header';
import './chat-messages';
import './small-dropdown';
import './chat-input';
import './chat-action-bar';
import historyIcon from '@/assets/figma-chat-history-icon.svg';
// THE READOUT'S MODEL MARK, handed in by the instance that draws it: the file's own node is
// #40001124:7096 and its size moved to 20 in the drawing (2026-09-20).
import readoutModelMark from '@/assets/figma-readout-model-mark.svg';
import './chat-plugin-tray';
import './error-banner';
import './chat-navigation-bar';
import './prompt-input/prompt-textarea';
import logoAsset from './assets/chat-logo-bce2fe.png';
// The app's own logger. A turn warning from the server is written here as well as drawn in
// the thread: the Trace tab reads this logger (lib/trace-source subscribes to it), and the
// owner asked for exactly that — "we need to report it in the console trace" (2026-09-18).
import { logger } from '@/lib/logger';
// Grace's surface commands. A reply that carries XML tags drives the surface the
// same way the React seat did — through window CustomEvents and the event bus.
import { eventBus } from '@/shared/event-bus';

interface SeatMessage {
  role?: string;
  content?: string;
  /** Which canvas node the turn is about, when it is about one — passed through, never
   *  invented here. See <chat-messages>. */
  nodeId?: string;
  /** The turn's small note (what part of the flow it is). */
  label?: string;
}

/**
 * The trace button's `AI:` line, verbatim from Figma "trace-button" state=Default.
 * Clicking Trace is a PROMPT: the reply renders in this thread like any answer.
 */
const TRACE_PROMPT =
  'Load the latest activity and report tokens, cost, latency and evaluation for this session.';

export class ChatPanel extends LitElement {
  static properties = {
    conversationId: { type: String, attribute: 'conversation-id' },
    messages: { type: Array },
    sessionId: { type: String, attribute: 'session-id' },
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
  };

  // `declare` — NOT a class field. With `useDefineForClassFields` true, a plain field
  // here overwrites Lit's accessor and the element never draws (the blank right column
  // this file once was). Every element in this repo declares properties this way.
  /** The package's conversation. Bound from /session/right_column/conversation_id. */
  declare conversationId?: string;
  /** The package's history, as the server loaded it. Bound from /session/right_column/messages. */
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
   * carries ACTIVE rows only, while what the owner counts is the package's conversations
   * (the archived one is exactly what he asked to keep "into the conversations list").
   *
   * `session_id` is the package's own column — the read the console's assembly itself uses —
   * with archived rows included. Until it is read (or if it cannot be), the bar falls back
   * to the surface's list length, which is real data too, just staler.
   */
  private _conversationRows: Array<{ id: string; title: string; tab: string; archived: boolean }> | null = null;
  /** Whether the leading bar's conversation list is open. */
  private _conversationsOpen = false;
  /**
   * Whether this seat is the console's — read from its session row's own metadata, and what
   * decides which way the trailing button points (see chat-action-bar's `trailing`). Null
   * until read, and the drawing's default stands until it is.
   */
  private _seatIsConsole: boolean | null = null;
  /** The row whose trash is armed (first click); a second click removes it. */
  private _armedDelete: string | null = null;
  /** Auto-disarm, so an armed trash never stays armed behind a person's back. */
  private _deleteTimer: ReturnType<typeof setTimeout> | null = null;
  /** A refusal or a failure about the list, said where the list is (never swallowed). */
  private _listNote = '';
  /** Watches the scroller's children so a growing thread moves the thumb without a render. */
  private _outputRO: ResizeObserver | null = null;
  /** The prompt package. Bound by the host from the surface's session id. */
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
  /** Whether the rail's Trace tab sends its prompt. See the property above. */
  declare tracePrompt: boolean;

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
      role?: string; content?: string; nodeId?: string; label?: string;
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
      },
    ];
    this.requestUpdate();
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('a2ui:system-message', this._onHostSay);
    // A chat button's answer arrives here from <chat-messages> and goes down the one send
    // path this seat has — the same one the input uses.
    this.addEventListener('chat-action-send', this._onActionSend);
    // The thumb's length depends on the region's height, so a window resize re-measures it.
    window.addEventListener('resize', this._onOutputScroll);
  }

  disconnectedCallback(): void {
    window.removeEventListener('a2ui:system-message', this._onHostSay);
    this.removeEventListener('chat-action-send', this._onActionSend);
    window.removeEventListener('resize', this._onOutputScroll);
    this._outputRO?.disconnect();
    this._outputRO = null;
    if (this._deleteTimer) {
      clearTimeout(this._deleteTimer);
      this._deleteTimer = null;
    }
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

  /** A chat button's answer: the action goes back as a message, like the retired seat's. */
  private _onActionSend = (e: Event): void => {
    const text = String((e as CustomEvent).detail?.text ?? '');
    if (text) void this._send(text);
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
   * WHAT THE TRAY'S MARKS REPORT AS PLACED — the windows the output area above is
   * actually showing. The drawing's own state dims "chat history" for exactly one
   * reason (the owner, 2026-09-20): "the reason it's deactivated in the bottom footer is
   * because the conversations are being displayed at the top." This panel draws the
   * Conversations bar at the top of the output unconditionally, so that is the truth it
   * hands the tray. When the stack exists and the user composes it, this reads the stack
   * instead — until then it says what is really on screen rather than guessing.
   */
  /**
   * WHICH OUTPUT WINDOWS ARE SHOWING. The conversations window leads, so conversations
   * starts in the list. The footer mark toggles a window in and out; the control inside a
   * window removes that window. Both arrive as events carrying the window name, so this
   * element holds the list and the drawing follows.
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

  /** A window's tray label, so the footer mark reads as placed while that window is up. */
  private get _trayPlaced(): string {
    return this._outputWindows.map((w) => (w === 'conversations' ? 'chat history' : w)).join(',');
  }

  private _onResizeStart(e: Event) {
    const d = (e as CustomEvent).detail || {};
    this._dragStartY = typeof d.startY === 'number' ? d.startY : 0;
    this._dragStartHeight = this.inputHeight || 100;
    const bar = this.renderRoot?.querySelector('chat-action-bar') as HTMLElement | null;
    // THE TRAY, not <chat-footer>: the drawing's foot replaces it, so the bar the input
    // height must reserve is the tray's block — the design's own 97px (#40001123:6689),
    // which is what the fallback carries if the element is not up yet.
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
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
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
     */
    .gripper-chat {
      flex: 0 0 30px;
      width: 30px;
      background: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
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
      background: var(--chat-bg, #ffffff);
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
    /* Collapsed to the rail — chat-button state=Selected, clicked again. */
    .panel.collapsed { display: none; }
    /* The Conversations dropdown's rows, from "small-dropdown" state=open
       #40001085:2414: a column of white tiles, gap 5, radius 4, height 30,
       label #4E68D2 Semi Bold 600 / 14. */
    .conversation-list {
      margin: 0;
      padding: 0;
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    /* THE ROW IS THE TILE, AND IT HOLDS TWO CONTROLS — the conversation (open it) and the
       trash (remove it). The tile could not stay a <button>: a button inside a button is not
       HTML, and the inner click would fire both. So the tile's own look (white, radius 4, the
       twin shadows, 30 tall) lives on the row and the controls inside it are transparent. */
    .conversation-list li {
      display: flex;
      align-items: center;
      height: 30px;
      border-radius: 4px;
      background: #ffffff;
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
      eval: 'Nothing has been judged yet. The catalog check runs after a repair is applied.',
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

  private _viewSlotted(): boolean {
    const assigned = this._slot('view')?.assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE)) return true;
    // The light DOM covers what slotting does not report: jsdom's slotting is thin,
    // and the surface's child may be appended after this element's first render.
    // A SLOT ELEMENT IS NOT A VIEW. When a host sits between this panel and the
    // surface — <agent-canvas> re-projects the surface's children into these slots —
    // the children seen here are `slot` elements, which PROJECT content rather than
    // being it. Counting them claimed a view was slotted when the host had none, and
    // the waiting line was suppressed for a view that was never coming.
    return Array.from(this.children).some(
      (el) => el.getAttribute('slot') === 'view' && el.tagName !== 'SLOT',
    );
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

  protected updated(changed: Map<PropertyKey, unknown>): void {
    // A PACKAGE CHANGE STARTS THE SEAT OVER. The panel is REUSED across assemblies (the
    // surface keeps the same component id — see the note on `_thread`), so without this the
    // previous package's spoken turns (`_local`) and its loaded history stay on screen over
    // the next package's thread. The owner, 2026-09-18: "I don't see other packages when I
    // open up this package — I only see this package."
    if (changed.has('sessionId')) {
      this._enterPackage(String(this.sessionId ?? ''));
      void this._readPackageConversations(this._userId());
      void this._readSeatScope(this._userId());
    }
    if (changed.has('conversationId')) void this._loadHistory();
    // History arriving lands the column at the newest turn (see _scrollThreadToBottom)...
    if (changed.has('messages')) this._scrollThreadToBottom();
    // ...AND SO DOES THE COLUMN COMING BACK. The history usually loads while the column is
    // CLOSED — the console opens with the chat collapsed — where the scroller measures 0 and
    // the scroll is a no-op, so the first open used to land at the top of the thread
    // (measured 2026-09-19: "it's not quite at the bottom").
    if (changed.has('collapsed') && !this.collapsed) this._scrollThreadToBottom();
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
    const once = () => {
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
    this._historyError = '';

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
    if (this.messages?.length || !this.conversationId) return;
    if (!this._conversationBelongsToPackage(this.conversationId)) return;
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
        this.requestUpdate();
        return;
      }
      const data = await resp.json().catch(() => ({}));
      const rows: SeatMessage[] = Array.isArray(data?.messages) ? data.messages : [];
      this._historyError = '';
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
        .map((m) => ({ role: m.role, content: m.content }));
    } catch (err) {
      this._historyError = 'This conversation could not be read — the server did not answer.';
      console.error('[chat-panel] could not read the package\'s history:', err);
      this.requestUpdate();
    }
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

  private _userId(): string {
    try {
      // `grace_user_id` is the key this app WRITES (services/authService.ts). The key this
      // read first — 'raibach_user_id' — had no writer anywhere in the repository, so every
      // read and write from this element was silently the development default: an identity
      // fallback that named a user nobody had chosen.
      return localStorage.getItem('grace_user_id')
        || localStorage.getItem('raibach_user_id')
        || '00000000-0000-0000-0000-000000000001';
    } catch {
      return '00000000-0000-0000-0000-000000000001';
    }
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
  private _buildWorkspaceContext(): string {
    const parts: string[] = [];

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

  /** Grace's identity and the XML command reference, ending with the current workspace. */
  private _graceInstructions(): string {
    const workspaceContext = this._buildWorkspaceContext();
    return `You are Grace, the Agentic Flow Architect. You help users build multi-step agentic prompt pipelines. Each prompt entry field in the workspace represents a STEP in an agentic flow — they are not arbitrary text boxes. Your job is to map the user's ideas onto the correct steps in the flow.

HOW YOU WRITE TO A PERSON — they read every character you type:
1. Plain sentences. No headings and no number-sign characters, no asterisks or underscores for weight, no tables, no bullet stars, no backticks or code fences, no lines of dashes or equals signs.
2. Short. Say it the way you would say it out loud, then stop.
3. One sentence on which step you chose and where the content went.
4. When you had to decide something the user did not tell you, name the decision in one short sentence so they can change it.
5. Never write out the choices of a button, and never ask the user to reply with a word. The buttons are the ask.

AGENTIC FLOW STEPS — choose from these seven; do not invent new ones:
1. System Role — <update_agent> — the AI's identity, expertise and behavioural rules.
2. User Role — <update_user> — the user's request, task or query template.
3. Agent Role — <update_agent_role> — what THIS agent is and does.
4. Tool Call — <update_tool> — functions, APIs or tools the agent can invoke.
5. Few Shot — <update_few_shot> — examples of the input and the output wanted.
6. Context — <update_context> — background, domain knowledge, reference material.
7. Constraints — <update_constraints> — hard rules the agent must never violate.

HOW YOU WORK:
1. ANALYZE the user's intent. MAP it to ONE of the seven steps above.
2. STATE your choice in ONE sentence.
3. EMIT the tag IMMEDIATELY — same message, right after your sentence. Write the content INSIDE the tag.
4. SUGGEST which step to fill next. Stay within the seven steps above.
5. USER has veto — if they say move it to a different step, do it.

CONFIRMATION BUTTONS
When you need a decision from the user, put the buttons on their own line, in this exact form:
[Confirm](action:confirm) [Refuse](action:refuse) [Cancel](action:cancel)
That line is the whole ask. Do not print the options underneath it.

Never proceed with a destructive or irreversible action (save, clear, delete) without explicit user confirmation.

# CONTROL SURFACE (XML COMMAND TAGS)
WRITE TO STEPS:
<update_agent>text</update_agent>
<update_user>text</update_user>
<update_agent_role>text</update_agent_role>
<update_tool>text</update_tool>
<update_few_shot>text</update_few_shot>
<update_context>text</update_context>
<update_constraints>text</update_constraints>
MEMORY COMMANDS:
<save/>
<get_versions/>
<load_version>N</load_version>
DESTRUCTIVE:
<clear_all/> — ONLY if user says "clear", "reset", "wipe", or "nuke". MUST ask for confirmation with buttons first.

CURRENT WORKSPACE
${workspaceContext}`;
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
    for (const { regex, target } of writeTags) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(content)) !== null) {
        write(target, match[1].trim());
      }
      content = content.replace(regex, '');
    }

    const addRoleRegex = /<add_role\s+name="([^"]+)">([\s\S]*?)<\/add_role>/g;
    let addMatch: RegExpExecArray | null;
    while ((addMatch = addRoleRegex.exec(content)) !== null) {
      window.dispatchEvent(new CustomEvent('add-prompt-role', {
        detail: { roleName: addMatch[1].trim(), placeholder: addMatch[2].trim() },
      }));
    }
    content = content.replace(addRoleRegex, '');

    const removeRoleRegex = /<remove_role\s+name="([^"]+)"\s*\/>/g;
    let remMatch: RegExpExecArray | null;
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
    if (/<run_prompt\s*\/>/.test(content)) {
      window.dispatchEvent(new CustomEvent('ai-run-prompt'));
      content = content.replace(/<run_prompt\s*\/>/g, '');
    }
    if (/<save\s*\/>/.test(content)) {
      eventBus.emit({ command: 'save-button' } as never);
      content = content.replace(/<save\s*\/>/g, '');
    }
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

  private async _send(text: string): Promise<void> {
    text = (text ?? '').trim();
    if (!text || this._sending) return;
    // THE WRITE PATH IS CHECKED TOO, not just the read (2026-09-18). `_loadHistory` refuses a
    // conversation the package's own list contradicts; this is the same guard before a turn
    // is sent, because a foreign id in the property would otherwise be WRITTEN to — the
    // server trusts a client-supplied conversation id, so the seat is where it stops.
    if (this.conversationId && !this._conversationBelongsToPackage(this.conversationId)) return;
    const before = this._local.length;
    this._local = [...this._local, { role: 'user', content: text }];
    this._scrollThreadToBottom();
    this._sending = true;
    this.requestUpdate();
    let answered = false;

    try {
      this._abort = new AbortController();
      const resp = await fetch('/api/teacher/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': this._userId() },
        body: JSON.stringify({
          question: text,
          context: this._graceInstructions(),
          mode: 'chat',
          reasoning: true,
          reasoning_style: 'chain_of_thought',
          include_memory: true,
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
        if (reply) {
          this._local = [...this._local, { role: 'assistant', content: reply }];
        }
        answered = true;
      }
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
      // Her reply (or the failure) just landed — the column follows it down.
      this._scrollThreadToBottom();
      // A turn that was ANSWERED while this seat had no conversation lives only here:
      // the backend refused to write it (no row to bind it to yet), so it is held and
      // handed over by flushPendingTurns when the first Save creates the package's
      // conversation. Failed turns are not held — an error is not a thing that was said.
      if (answered && !this.conversationId) {
        // The owner is recorded with the FIRST pending turn: spoken before any package
        // existed (owner null) they are owed to whatever Save creates one; spoken INSIDE a
        // package they belong to it and to no other (see flushPendingTurns).
        if (!this._pending.length) this._pendingOwner = this.sessionId ? String(this.sessionId) : null;
        this._pending = [...this._pending, ...this._local.slice(before)];
      }
      this._sending = false;
      this._abort = null;
      this.requestUpdate();
    }
  }

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
  private _onConversationSelect(e: Event) {
    const detail = (e as CustomEvent).detail || {};
    const id = typeof detail.conversationId === 'string' && detail.conversationId
      ? detail.conversationId
      : null;
    if (!id || id === this.conversationId) return;
    this.messages = [];
    this._local = [];
    this.conversationId = id;
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
    this.activeTab = String(picked?.tab || 'chat') === 'approvals' ? 'approvals' : 'chat';
    this.dispatchEvent(
      new CustomEvent('conversation-change', {
        bubbles: true,
        composed: true,
        detail: { conversationId: id },
      }),
    );
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
   */
  private _onConversationNew(): void {
    void this._startNewConversation();
  }

  private async _startNewConversation(): Promise<void> {
    const userId = this._userId();
    const scope = this._seatIsConsole === null
      ? await this._readSeatScope(userId)
      : (this._seatIsConsole ? 'console' : 'package');
    if (scope === 'package') return;
    if (scope === 'unknown') {
      // The gate could not be read, so nothing is attempted — and the reason is said rather
      // than shown as a button that quietly does nothing.
      this._historyError =
        'Whether this chat is the console’s could not be read, so nothing was changed — no conversation was archived.';
      this.requestUpdate();
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
   */
  private async _readPackageConversations(userId: string): Promise<void> {
    if (!this.sessionId) return;
    try {
      const res = await fetch(
        `/api/conversations?session_id=${encodeURIComponent(this.sessionId)}&include_archived=true`,
        { headers: { 'X-User-ID': userId } },
      );
      if (!res.ok) return;
      const body = (await res.json()) as {
        conversations?: Array<{ id?: unknown; title?: unknown; tab?: unknown; is_archived?: unknown }>;
      };
      if (!Array.isArray(body?.conversations)) return;
      const rows = body.conversations.map((c) => ({
        id: String(c?.id ?? ''),
        title: String(c?.title || '(untitled)'),
        tab: String(c?.tab || 'chat'),
        archived: c?.is_archived === true,
      })).filter((r) => r.id);
      if (rows.length === this._conversationRows?.length
          && rows.every((r, i) => r.id === this._conversationRows?.[i]?.id && r.title === this._conversationRows?.[i]?.title)) {
        return;
      }
      this._conversationRows = rows;
      this.requestUpdate();
    } catch {
      // Unreachable server: keep the number that was already true (see the header note).
    }
  }

  /** The bar's own click: open or close its list. */
  private _toggleConversations = (): void => {
    this._conversationsOpen = !this._conversationsOpen;
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
      })).filter((r) => r.id);
    if (!rows.length) {
      return html`<p class="conversation-none">No conversations yet for this package.</p>`;
    }
    return rows.map(
      (r) => html`<li>
        <button class="conv-open" data-conversation-id=${r.id} @click=${this._pickConversation}>
          ${r.title}${r.archived ? html`<span class="tab-tag">archived</span>` : nothing}
        </button>
        <button
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
        </button>
      </li>`,
    );
  }

  /**
   * THE TRASH ON A ROW — the mark every console card already carries, and its gesture too:
   * first click arms, second removes. A conversation is not deleted by one stray click, and
   * the arming disarms itself so a row cannot be left loaded.
   *
   * THE ONE YOU ARE IN IS REFUSED, and the refusal is said under the list. Deleting it would
   * leave the seat reading a conversation that is not there, and the package's own pointer on
   * a dead row — so a person switches (or starts a new one) and removes it after.
   */
  private _onConversationRemove = (e: Event): void => {
    e.stopPropagation();
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
    if (String(id) === String(this.conversationId ?? '')) {
      this._listNote = 'That is the conversation you are in — start a new one, then remove it.';
      this.requestUpdate();
      return;
    }
    void this._removeConversation(id, this._userId());
  }

  /** Remove one conversation from the data, then re-read the list and the count. */
  private async _removeConversation(id: string, userId: string): Promise<void> {
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
    this._gripMove = (ev: MouseEvent) => {
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
      if (this._gripMove) document.removeEventListener('mousemove', this._gripMove);
      if (this._gripUp) {
        document.removeEventListener('mouseup', this._gripUp);
        document.removeEventListener('pointerup', this._gripUp);
        document.removeEventListener('pointercancel', this._gripUp);
        document.removeEventListener('mouseout', this._gripBoundary);
        document.removeEventListener('mouseover', this._gripBoundary);
      }
      this._gripMove = null;
      this._gripUp = null;
      this._gripBoundary = null;
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
              ?collapsed=${this.collapsed}
              @tab-change=${this._onTabChange}
              @collapse-toggle=${this._onCollapseToggle}
            >
              <img slot="logo" src=${logoAsset} width="66" height="62" alt="Copilot" />
            </chat-navigation-bar>
            <div class="panel ${this.collapsed ? 'collapsed' : ''}">
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
                  tokens=${String((usage.totalTokens as number) ?? 0)}
                  calls=${String((usage.calls as number) ?? 0)}
                ></output-header>
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
                <!-- THE 1px RULE THAT WAS HERE IS GONE WITH ITS NODE. v.4b draws no
                     rule between the output blocks — they are #CBE6E3 grounds separated
                     by their own 2px — so the old "chat-output-spacer-slot-area"
                     (#40001085:2404, a 1px #B5CCCE line) is not drawn. Nothing else
                     used it and no control lived in it. -->
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
                <chat-header card>
                  <div class="content-scroll" @scroll=${this._onOutputScroll}>
                    <div class="content-header"><slot name="content-header"></slot></div>
                  ${this._showsThread
                    ? html`${this.activeTab === 'approvals' && this._findingsSeat()
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
                        .sending=${this._sending}
                      ></chat-messages>`
                    : this.activeTab === 'trace'
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
                      : html`<div class="view-slot">
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
                <chat-plugin-tray
                  .placed=${this._trayPlaced}
                  @conversation-new=${this._onConversationNew}
                ></chat-plugin-tray>
              </div>
            </div>
          `}
    `;
  }
}

if (!customElements.get('chat-panel')) customElements.define('chat-panel', ChatPanel);

declare global {
  interface HTMLElementTagNameMap {
    'chat-panel': ChatPanel;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-panel': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatPanel> & {
          'session-id'?: string;
          'conversation-id'?: string;
          'status-text'?: string;
          'allowed-tabs'?: string;
          /** React 19 sets the matching PROPERTY, so a real boolean is correct —
              never the string "false", which Lit's boolean converter reads as true. */
          collapsed?: boolean;
          ref?: React.Ref<ChatPanel>;
        },
        ChatPanel
      >;
    }
  }
}
