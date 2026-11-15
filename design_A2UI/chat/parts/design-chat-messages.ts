/**
 * <design2-chat-messages> — the package conversation's thread.
 *
 * Figma source: the message wells inside the chat output slot — the container
 * "output-output-results-area-container" #40001130:5059 (padding 6px 20px 4px, gap 7,
 * fill #CBE6E3) and the card it holds, "chat-output-area-results" #40001130:5060
 * (radius 8, the owner's fills #ADC7C3 / #F7F8F2), which sits in
 * right-column-panel-container #40001119:6025. Those wells are what the turns fill.
 *
 * IT DRAWS NO GROUND OF ITS OWN, on purpose: the CARD is the surface a turn sits on
 * (chat-header paints it), so every rule in this file that leaves a turn transparent is
 * leaving the card's own fill to show through. A fill here would be a second surface
 * over the drawing's.
 *
 * Pure render: it takes the resolved message list as a property and draws
 * role-styled turns. It owns scroll-to-bottom. It never fetches or writes — the
 * parent <chat-panel> is the one channel to the package conversation.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css, nothing } from 'lit';
import { actionLinkStyles } from '../thread/cards';
import { turnView } from '../thread/cards/turns';
import { resultsAreTheReading } from '@/shared/chatScroll';
import '../thread/cards/work-status';

import type { ChatMessage, ChatConversation } from '../thread/cards/types';
export type { ChatMessage, ChatConversation };

/* THE TURN TYPES LIVE IN chat/thread/cards/types.ts. */

export class ChatMessages extends LitElement {
  static properties = {
    /** The conversation history, resolved by <chat-panel>. */
    messages: { type: Array },
    /** True while a send is in flight; draws a "Thinking…" turn. */
    sending: { type: Boolean },
    /**
     * WHAT THE WORK IS RIGHT NOW, when the room knows more than "busy" ('thinking' while her
     * reply is written; 'building' while the page is written — the room's host announces it
     * through `a2ui:grace-status`). The card's header reads it.
     */
    stage: { type: String, attribute: false },
    /** The node the canvas has selected, if any: the turn about it is marked. */
    highlightNodeId: { type: String, attribute: false },
    /**
     * THE BUTTONS THAT HAVE BEEN PRESSED, by their action — AND THE TURN THEY WERE PRESSED IN.
     *
     * A row of buttons is a LIST, not a choice between them, and nothing said so: the person
     * pressed one and the other two stayed exactly as they were, so the row still read as
     * "pick one" and they could not tell whether the work was done or whether the rest were
     * still waiting. The owner, 2026-09-23: "when I click Fill User Role that button should
     * change state ... by deactivating one when it's done that lets the user know it's a list."
     *
     * SCOPED TO ONE TURN, because an action name alone is not unique in a thread. Every
     * proposing reply ends with the same `[Confirm](action:confirm)`, so a mark kept by action
     * alone would draw the SECOND Confirm this conversation ever offered as already pressed.
     * `spentTurn` is the CONTENT of the turn the press came from, and a button is spent only
     * inside that turn — an offer repeated word for word is the same offer, which is the one
     * case where sharing the mark is right.
     *
     * The seat owns the answers: <chat-panel> handles the press and outlives this element's
     * re-renders, and passes these down as plain values (a Lit property compared by identity
     * is what makes a re-render happen).
     */
    spentActions: { type: Array },
    spentTurn: { type: String },
    /**
     * THE BUTTONS THE PROMPT ITSELF SAYS ARE DONE — read from the seats, not remembered.
     *
     * A press is remembered by the seat and lasts as long as the tab does; this is the half that
     * SURVIVES, because the work it stands for is in the prompt the person saved. Reopening a
     * package used to draw her review again with every button live over seats that had been
     * filled (the owner, 2026-09-23: "it's not saving states … it represents the list again as
     * if it wasn't done"). See shared/buttonState for what can and cannot be derived.
     */
    doneActions: { type: Array },
  };

  declare messages: ChatMessage[];
  declare sending: boolean;
  declare stage: string;
  declare highlightNodeId?: string;
  declare spentActions: string[];
  declare spentTurn: string;
  declare doneActions: string[];

  constructor() {
    super();
    this.messages = [];
    this.sending = false;
    this.stage = '';
    this.highlightNodeId = undefined;
    this.spentActions = [];
    this.spentTurn = '';
    this.doneActions = [];
  }

  /* THE WORK CARD'S CLOCK LIVES IN chat/thread/cards/work-status.ts. */

  static styles = [actionLinkStyles, css`
    :host { display: flex; flex-direction: column; min-height: 0; min-width: 0; }
    /* IT DOES NOT SCROLL. The column does — see chat-panel's .content-scroll — so this
       thread is as tall as its turns and the one scrollbar belongs to the column. An
       inner scroller here would be a second one for the same movement. */
    .thread {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
      /* NO HORIZONTAL PADDING OF ITS OWN — the card carries the drawing's 10px — but TEN
         EXTRA PIXELS UNDER THE LAST LINE, so the newest turn does not sit on the card's
         edge: the owner, 2026-09-19: "can you add an extra 10 pixels to the bottom so it's
         not sitting right on the edge." (The same ask he made for the chat outputs on
         2026-09-19 earlier, and it is the same number.) */
      padding: 0 0 10px;
      /* NUNITO, NOT THE DRAWING'S ARIAL ROUNDED MT BOLD — the owner's face ruling,
         2026-10-07: "Arial or rounded fonts -> becomes Nunito (found in chat interfaces for
         Grace). Inter -> everywhere else. Numbers -> Inter. Use our fonts only - no API
         calls." The thread is chat: it takes the rounded face, and its figures (the work
         clock's "12s") render Inter through the figures helper. */
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      color: var(--chat-text, #171717);
    }
    /* Full-width stacked cards, as the frame's "output-area" slots draw them — and
       TIGHTENED, because a conversation has to read as one. The frame's 20px padding and
       10px gap are what a wireframe slot needs to look like an empty box; with real
       sentences in them they read as gaps between the messages rather than a thread
       (owner, 2026-09-18: "It should just look like a continued conversation").

       AND NOT THE SLOT'S 73px. The frame draws each slot 73px tall because a wireframe
       slot is an EMPTY BOX — its height is the placeholder's, not a rule for a message.
       A real turn hugs its own line. */
    /* THE WHITESPACE INSIDE THIS ELEMENT IS PART OF THE MESSAGE, and that is why the
       template puts the note and the body on ONE LINE with no space between them. The
       body is pre-wrap (a person's own newlines must survive), so every newline and every
       indent the template carried became leading whitespace INSIDE the turn: the text sat
       under a blank line and the padding read as heavy on top (owner, 2026-09-18: "it
       looks like it's got a large padding on top … is something inside fixed height").
       Nothing was fixed — the template was writing a paragraph break into it. */
    .turn {
      align-self: stretch;
      min-width: 0;
      word-break: break-word;
      line-height: 1.5;
      padding: 10px 14px;
      border-radius: 6px;
      /* A TURN PAINTS NOTHING — the CARD is the surface. Its fill is chat-header's
         (the owner's #ADC7C3 between runs, #F7F8F2 while results are up), and a fill
         written here as well would be a second surface laid over the drawing's. */
      background: transparent;
      transition: background 0.12s, outline-color 0.12s;
      outline: 2px solid transparent;
    }
    /* The message itself: the app's own face at 13, and the lines the person wrote are kept. */
    .turn .body {
      white-space: normal;
      min-width: 0;
      overflow-wrap: anywhere;
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 13px;
      line-height: 1.5;
    }
    .turn .body .hd { font-size: 14px; font-weight: 700; margin: 0 0 6px; }
    .turn .body .line { white-space: pre-wrap; overflow-wrap: anywhere; }
    .turn .body .gap { height: 6px; }
    .turn .body ul, .turn .body ol { margin: 4px 0 8px; padding-left: 18px; }
    .turn .body li { margin: 2px 0; white-space: pre-wrap; overflow-wrap: anywhere; }
    .turn .body strong { font-weight: 700; }
    .turn .body .raw {
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      background: rgba(0, 0, 0, 0.04);
      border-left: 2px solid rgba(0, 0, 0, 0.15);
      padding: 6px 8px;
      margin: 4px 0 8px;
      font-family: 'IBM Plex Mono', monospace;
      font-size: 12px;
    }
    /* A RUN'S RESULT WEARS RENDERED MARKDOWN'S OWN TYPE — the owner named the stack
       (marked + github-markdown-css, 2026-09-24) and the size (72ch of line, 16px,
       1.6), so the output reads as the output rather than as more conversation. */
    .turn.result .body { white-space: normal; }
    .turn.result .markdown-body { max-width: 72ch; font-size: 16px; line-height: 1.6; }
    /* CITATION PILLS — a result's links are sources, not prose. Blue underlined
       text would run through the briefing; each link wears a pill instead: small,
       rounded, its number, opening the source beside the app (see _onLinkClick).
       The owner, 2026-09-24: "I just want the pill." (Recorded in the catalog —
       registry.json values.card.citations — the design updates later.) */
    .turn.result .markdown-body a {
      display: inline-block;
      padding: 1px 10px;
      margin: 0 4px 4px 0;
      border-radius: 999px;
      border: 1px solid #CBE6E3;
      background: #FFFFFF;
      color: #234354;
      font-size: 12px;
      line-height: 1.6;
      text-decoration: none;
    }
    .turn.result .markdown-body a:hover { background: #CBE6E3; }
    /* A folded code block in a result — the native <details> the marked renderer
       emits (shared/richText); the summary line opens it in place. */
    .turn.result details.fold { margin: 0 0 10px; }
    .turn.result details.fold summary {
      display: flex; align-items: center; gap: 8px;
      padding: 4px 10px;
      border: 1px solid #e5e7eb; border-radius: 6px;
      background: #f9fafb; color: #234354;
      font-size: 13px; cursor: pointer;
    }
    .turn.result details.fold summary:hover { background: #f3f4f6; }
    .turn.result details.fold .fold-title { font-family: 'IBM Plex Mono', 'IBM Plex Mono', monospace; }
    /* The small note above a linked turn: which part of the flow this is about. */
    .turn .note {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #6c757d;
      margin-bottom: 3px;
    }
    /* A turn about a node answers a click, and says so under the pointer. */
    .turn.linked { cursor: pointer; }
    .turn.linked:hover { background: #f4f8f8; }
    /* And the same turn, marked because the canvas has that node selected. */
    .turn.hl { background: #edf2f2; outline-color: #507274; }
    /* AN ALERT IS A RING INSIDE THE TURN AND A WASH BEHIND THE WORDS.
       Both of those are the owner's own instruction, given after seeing the first version
       (which was an outline): "the red border needs to be inside of the container instead of
       outside and we need to have a fill that is like 20% red."

       AN INSET SHADOW, NOT A BORDER AND NOT AN OUTLINE. An outline is drawn OUTSIDE the box —
       that is what it is for — and a border would add 4px to a turn that hugs its own lines,
       moving every message under it the moment a reply is marked. An INSET box-shadow costs no
       layout at all: the ring sits inside the turn's own edge, exactly where the instruction
       puts it, and nothing on the page moves when it appears.
       No backticks in this comment, deliberately: this is a Lit css literal.

       THE WASH IS 20% AND IT IS MEASURED, not chosen by eye. The turn's ink is the card's own
       #171717 (see the empty-thread rule below for why the card's colours are used at all),
       and 20% of the alarm over the card's green lands at roughly rgb(176,170,165): against
       #171717 that is about 7.9:1, well past AA's 4.5. A stronger wash would start eating that
       margin — which is the failure this file already carries a note about. */
    .turn.alert {
      background: rgba(192, 57, 43, 0.2);
      box-shadow: inset 0 0 0 2px #c0392b;
    }
    /* The alarm's own note colour, so a labelled alert does not carry a grey marker. */
    .turn.alert .note { color: #a5281b; }

    /* THE USER'S TURN IS THE DESIGN'S BUBBLE, not a wash on this wrapper. v.4b draws
       it as its own component — "user-response-bubble" #40001130:5064 — so the fill,
       the padding and the radius live there now and this wrapper paints nothing. It
       stays as the wrapper because a turn about a canvas node still answers a click
       and still marks when its node is selected, and that is the turn's behaviour,
       not the bubble's. */
    .turn.user { background: transparent; padding: 0; }
    /* THE ACTION LINKS' STYLES LIVE IN chat/thread/cards/action-links.ts. */
    .empty {
      /* Nunito, per the owner's face ruling — see .thread above. */
      font-family: 'IBM Plex Sans', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      color: #171717;
    }
    /* THE WORK CARD'S STYLES LIVE IN chat/thread/cards/work-status.ts. */
    /* No conversation selector here. The design puts it in the output area as
       <small-dropdown label="Conversations"> (chat-output-slot-area #40001085:1521),
       so this element is the thread and nothing else. */
  `,
  ];

  /* The turn's role lives in chat/thread/cards/turns.ts. */

  /** The message count the view was last seated against — see `seatConversation` below. */
  private _seatCount = -1;

  /**
   * SEAT THE CONVERSATION AT THE HEAD OF ITS CURRENT EXCHANGE (the owner, 2026-10-03).
   *
   * A long answer used to open at its TAIL — *"so that the user can start reading the
   * response at its beginning instead of picking it up at the end where it currently
   * loads."* The current question goes to the TOP of the viewport (it draws clamped to two
   * lines; see <user-response-bubble>, which the owner asked for in the same breath), and
   * the answer reads from its beginning below — the rule the results already had ("A RUN'S
   * RESULTS OPEN AT THEIR HEAD"), applied to the conversational thread. No user turn at all
   * (a results-only or brand-new thread) keeps the old behaviour: the newest words in view.
   *
   * AND THE NEWEST WORDS ARE NEVER LEFT BELOW THE FOLD (owner, 2026-10-05). Measured on a
   * Run review: her blockers arrive as SEVERAL messages after ONE question — the person's
   * click was the question, every reply followed it — and this re-seated that same question
   * each time a message landed. The first seat showed the first reply; the second, third
   * and fourth appended BELOW the viewport while the question was already parked at the
   * top, so the move was a no-op and *"the chat scroll did not roll up to the message so
   * the user never saw it"*. Every reply was arriving; all of them were out of view.
   *
   * So the question keeps the head of the viewport ONLY WHILE THE NEWEST TURN'S FIRST LINE
   * STILL FITS UNDER IT — the same "newest message in front of them" test the scroll policy
   * has always stated (see shared/chatScroll, "the replies were arriving. They were out of
   * view."). The moment it would not fit, the NEWEST turn takes the top instead: still read
   * from its beginning, which is what the question-at-top rule was for, and it can no
   * longer be missed.
   */
  seatConversation(): void {
    const thread = this.renderRoot?.querySelector('.thread');
    if (!thread) return;
    const userTurns = thread.querySelectorAll('.turn.user');
    const last = userTurns.length ? (userTurns[userTurns.length - 1] as HTMLElement) : null;
    if (!last) {
      const root = thread.parentElement;
      if (root) root.scrollTop = root.scrollHeight;
      return;
    }
    /*
     * A HIDDEN PANE GETS THE PLAIN JUMP (measured 2026-10-05). A smooth scroll is driven by
     * animation frames, and a background tab has none: the seating below ran, moved nothing
     * (scrollTop 0 while the newest message sat 2816px down), and the person returning to
     * the tab found her newest words parked out of view — the exact "it's not loading the
     * conversation" a reader concludes. An instant jump needs no frames and lands even while
     * hidden; reduced motion has always taken it for the same class of reason.
     */
    const reduce = (typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches)
      || document.hidden;
    const turns = thread.querySelectorAll('.turn');
    const newest = turns.length ? (turns[turns.length - 1] as HTMLElement) : null;
    if (newest && newest !== last) {
      const scroller = this._scrollableAncestor();
      if (scroller) {
        // Where the newest turn would land once the question sits at the scroller's top —
        // a content distance, so it is the same number whichever way the scroll sits now.
        const landed = newest.getBoundingClientRect().top - last.getBoundingClientRect().top;
        if (landed >= scroller.clientHeight) {
          newest.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
          return;
        }
      }
    }
    last.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
  }

  /**
   * THE ONE ELEMENT THAT SCROLLS ABOVE THIS THREAD — chat-panel's `.content-scroll`, the
   * card's body ("The column's one scroller"), one shadow root up from here; `parentElement`
   * stops at the shadow boundary, so the walk climbs through `getRootNode().host`. The
   * first ancestor whose box can actually scroll is the element `scrollIntoView` would
   * move — and the element whose height decides whether the newest turn then fits.
   */
  private _scrollableAncestor(): HTMLElement | null {
    let el: Element | null = this.parentElement
      ?? ((this.getRootNode() as ShadowRoot)?.host as Element | null);
    while (el) {
      if (el.scrollHeight > el.clientHeight + 1) return el as HTMLElement;
      el = el.parentElement ?? ((el.getRootNode() as ShadowRoot)?.host as Element | null);
    }
    return null;
  }

  /* The rich-text renderer lives in chat/thread/cards/turns.ts. */

  /* The segment parser lives in chat/thread/cards/action-links.ts. */

  /** An action button answers through the seat: the action goes back as a message — the
      same wire the retired seat's buttons sent (`[action]`). */
  private _onActionSend(e: Event, action: string, turn: string): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('chat-action-send', {
        // `turn` travels with it so the seat can mark the pressed button spent IN ITS OWN TURN
        // and nowhere else — see the spentTurn note on the properties above.
        detail: { text: `[${action}]`, turn },
        bubbles: true,
        composed: true,
      }),
    );
  }

  protected updated(changed: Map<string, unknown>): void {
    const thread = this.renderRoot?.querySelector('.thread');
    if (!thread) return;
    // A HIGHLIGHTED TURN IS BROUGHT INTO VIEW. Selecting a node on the canvas is a
    // question about a piece of the conversation, and an answer below the fold is no
    // answer: the marked turn is scrolled to whenever the mark changes.
    if (changed.has('highlightNodeId') && this.highlightNodeId) {
      const marked = thread.querySelector('.turn.hl') as HTMLElement | null;
      if (marked) {
        /*
         * AND IT ARRIVES RATHER THAN JUMPING. The turn is brought into view by the
         * COLUMN's scroller — this thread does not scroll (see .thread above), so a
         * scrollTop written here is a no-op, and `scrollIntoView` walks up to the one
         * element that does scroll. Behavior is smooth for the same reason the drawing
         * glides: the owner's rule, 2026-09-18 — "the same thing should happen in the
         * chat. If I click on one of the notes, the chat should roll up to that node" —
         * a jump-cut loses the reader the way a teleport loses the viewer. Reduced motion
         * gets the plain jump, which is what that setting is for.
         */
        const reduce = typeof window.matchMedia === 'function'
          && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        // TO THE TOP, NOT THE NEAREST EDGE. `nearest` scrolls the minimum, so with a short
        // output region — the owner shortened it with the input's own gripper and tested
        // exactly this — the marked turn lands at the BOTTOM edge and the conversation
        // above it is what you read. A question about a node wants the answer at the top.
        marked.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        return;
      }
    }
    if (changed.has('messages')) {
      const list = this.messages ?? [];
      /*
       * A RUN'S RESULTS OPEN AT THEIR HEAD, AND THERE IS NOTHING TO SEAT. When the thread's
       * newest turn is a result, the scroller's natural position — the top — is already the
       * head of that reading, so the seat below is skipped outright rather than applied and
       * then taken back. A thread that is not showing results follows the ordinary rule
       * (owner, 2026-09-24: "the output should be visible at the top and then the user can
       * scroll to see the rest").
       */
      const resultsShowing = resultsAreTheReading(list);
      // THE CURRENT EXCHANGE OPENS AT ITS HEAD (2026-10-03) — the question to the top, the
      // answer read from its beginning; see `seatConversation`. SEATED ON GROWTH ONLY: a
      // streaming answer is never re-yanked to the top while it is being read, and
      // content-only updates leave the view where the person put it (the clamp lesson,
      // 2026-09-24). No user turn anywhere falls back to the oldest behaviour — newest
      // words in view.
      if (!resultsShowing && list.length !== this._seatCount) {
        this._seatCount = list.length;
        this.seatConversation();
      }
    }
  }

  /* The button template lives in chat/thread/cards/action-links.ts. */

  /**
   * A TURN THAT IS ABOUT A NODE ANSWERS A CLICK — the other half of the link.
   *
   * It does not act: it says which node this turn is about and lets the host decide
   * (the canvas is the host's to move, and a view that moved another view directly would
   * be two elements reaching into each other). The event is the same shape as every
   * other in this element: composed, bubbling, and carrying just the id.
   */
  private _onTurnClick(m: ChatMessage): void {
    if (!m.nodeId) return;
    this.dispatchEvent(new CustomEvent('turn-click', {
      bubbles: true, composed: true, detail: { nodeId: m.nodeId },
    }));
  }

  render() {
    const turns = this.messages ?? [];
    return html`
      <div class="thread" role="log" aria-live="polite">
        ${turns.length
          ? turns.map((m) => turnView(m, {
              doneActions: this.doneActions,
              spentActions: this.spentActions,
              spentTurn: this.spentTurn,
              highlightNodeId: this.highlightNodeId,
              onSend: this._onActionSend,
              onTurnClick: this._onTurnClick,
            }))
          : nothing}
        <design2-work-status .sending=${this.sending} .stage=${this.stage}></design2-work-status>
      </div>
    `;
  }
}

if (!customElements.get('design2-chat-messages')) customElements.define('design2-chat-messages', ChatMessages);

declare global {
  interface HTMLElementTagNameMap {
    'design2-chat-messages': ChatMessages;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'design2-chat-messages': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatMessages> & {
          ref?: React.Ref<ChatMessages>;
        },
        ChatMessages
      >;
    }
  }
}
