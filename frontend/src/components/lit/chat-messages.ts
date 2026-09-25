/**
 * <chat-messages> — the package conversation's thread.
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
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { asPlainText, stripControlTags } from '@/shared/plainText';
import { renderMarkdown } from '@/shared/richText';
import { HER_ANSWERS } from '@/shared/actionLink';
// The user's turn is the design's own row, not a styled div — v.4b draws it as
// "user-response-bubble" #40001119:6352 and this element draws that element.
import './user-response-bubble';

export interface ChatMessage {
  role?: string;
  content?: string;
  /**
   * WHICH THING ON THE CANVAS THIS TURN IS ABOUT, when it is about one. A turn that
   * carries it wears a note saying so, answers a click, and lights up when that node is
   * selected — the two views pointing at the same fact (AGENTIC_EDITOR/09, the loop).
   * Absent on turns that are not about a node, which is most conversation.
   */
  nodeId?: string;
  /** The small note above a linked turn: what part of the flow it is. */
  label?: string;
  /**
   * AN ALERT, NOT A REMARK. A turn that STOPS the person — a held run that will not go until
   * something is fixed — is not the same kind of thing as a sentence in a conversation, and it
   * may not wear the same weight. The owner, 2026-09-23: "you can't serve alert messages with
   * the same visual weight as every other message."
   *
   * It travels WITH the turn rather than being decided here by matching words in it: the seat
   * that knows why it is an alert is the one that says so.
   */
  alert?: boolean;
  /**
   * A RUN'S RESULT, NOT CHAT. A turn the run produced — what the tools brought back, and the
   * answer — is drawn as the output it is: rich text (markdown, rendered), at its own 14px
   * size, so it reads differently from the conversation around it. The mark travels from the
   * message's metadata (kind 'tool-answer' / 'run-result', read by the seat) or from the host's
   * own dispatch; this element never guesses it from the words.
   */
  result?: boolean;
}

export interface ChatConversation {
  id?: string;
  title?: string;
}

export class ChatMessages extends LitElement {
  static properties = {
    /** The conversation history, resolved by <chat-panel>. */
    messages: { type: Array },
    /** True while a send is in flight; draws a "Thinking…" turn. */
    sending: { type: Boolean },
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
  declare highlightNodeId?: string;
  declare spentActions: string[];
  declare spentTurn: string;
  declare doneActions: string[];

  constructor() {
    super();
    this.messages = [];
    this.sending = false;
    this.highlightNodeId = undefined;
    this.spentActions = [];
    this.spentTurn = '';
    this.doneActions = [];
  }

  static styles = css`
    :host { display: flex; flex-direction: column; min-height: 0; }
    /* IT DOES NOT SCROLL. The column does — see chat-panel's .content-scroll — so this
       thread is as tall as its turns and the one scrollbar belongs to the column. An
       inner scroller here would be a second one for the same movement. */
    .thread {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      gap: 6px;
      /* NO HORIZONTAL PADDING OF ITS OWN — the card carries the drawing's 10px — but TEN
         EXTRA PIXELS UNDER THE LAST LINE, so the newest turn does not sit on the card's
         edge: the owner, 2026-09-19: "can you add an extra 10 pixels to the bottom so it's
         not sitting right on the edge." (The same ask he made for the chat outputs on
         2026-09-19 earlier, and it is the same number.) */
      padding: 0 0 10px;
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
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
    /* The message itself: pre-wrap, so the newlines a person typed are theirs. */
    .turn .body { white-space: pre-wrap; }
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
    .turn.result details.fold .fold-title { font-family: ui-monospace, 'SF Mono', monospace; }
    /* The small note above a linked turn: which part of the flow this is about. */
    .turn .note {
      font-size: 13px;
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
    /* THE CHAT'S BUTTONS — the wire format's action links, drawn with the same wash the user's
       turn uses (owner, 2026-09-19: "use that for all your buttons inside of the chat"),
       never the Conversations dropdown. */
    .turn .action {
      font: inherit;
      color: inherit;
      background: var(--chat-user-bg, #eef2f7);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 6px;
      padding: 3px 10px;
      margin: 2px 4px 2px 0;
      cursor: pointer;
      transition: background 0.12s;
    }
    .turn .action:hover { background: rgba(255, 255, 255, 0.16); }
    /* A BUTTON THAT HAS BEEN PRESSED IS SPENT — it says so, and it stops answering.
       The row is a LIST OF THINGS TO DO, and this is what makes that legible: one press and
       the pressed one reads done while the others stay live and pressable.
       HOW IT READS, and why: the fill goes (it is no longer offering anything), the ink is
       held at the card's own colour rather than greyed — a spent button is still a label the
       person may want to re-read, and this file already has the note about what grey does to
       contrast on this surface (see the empty-thread rule below: #6c757d measured 2.62:1,
       a fail). What marks it is the check, the absence of fill, and the default cursor.
       NOT struck through: the words are the work that was done, not a mistake. */
    .turn .action.spent {
      background: transparent;
      border-color: rgba(23, 23, 23, 0.12);
      color: inherit;
      cursor: default;
      padding-left: 4px;
    }
    .turn .action.spent::before { content: '\\2713\\00a0'; }
    .turn .action.spent:hover { background: transparent; }
    /* A button that is not pressable must not invite a press with a pointing hand, and it
       must not be reachable by keyboard as though it were still an answer. */
    .turn .action.spent:disabled { pointer-events: none; }
    /* THE EMPTY THREAD IS HER GREETING, IN THE CARD'S OWN TYPE.
       Every value here is the drawing's, from the results card "chat-output-area-results" #40001130:5060
       (drawn as "chat-output-header" #40001119:6327 when this element was built, and its line
       there was Inter Medium 500 / 13px / 20px / #171717, #40001119:6358, :6337) —
       and none of it is mine. Nothing else is declared: no opacity, no grey, no italic, no
       padding of its own, because the card already supplies the inset (padding 10px) and the
       drawing has no such treatment.
       WHAT WAS HERE BEFORE WAS NONCOMPLIANT, AND IT IS WORTH THE RECORD. Measured against the
       card's real surface (rgba(117,142,135,0.35) over #CBE6E3 → rgb(173,199,195)), AA for
       normal text needing 4.5:1:
         the grey I briefly put here (#6c757d) ........ 2.62:1  FAIL
         the 60%-opacity treatment it replaced ........ 3.80:1  FAIL
         the drawing's own #171717 ................... 10.02:1  PASS
       The owner caught it: "I've got noncompliant WCAG text, it's barely visible. Why are you
       changing the color of the text?" — and the answer was that I had been inventing a style
       for a line the drawing does not draw, instead of taking the card's own.
       The sentence itself is hardcoded, which the owner allowed for exactly this ("you know
       it's supposed to be gray, so if you're gonna hardcode something just say hi, how can I
       help you today… if it's gotta be hardcoded"): her real words come from an assembly, and
       a brand-new conversation has had none. */
    .empty {
      font-family: 'Arial Rounded MT Bold', 'Inter', system-ui, sans-serif;
      font-size: 13px;
      font-weight: 500;
      line-height: 20px;
      color: #171717;
    }
    .thinking {
      display: flex;
      align-items: center;
      gap: 8px;
      align-self: flex-start;
      opacity: 0.7;
      font-style: italic;
      padding: 12px 20px;
    }
    .spinner {
      display: inline-block;
      width: 14px;
      height: 14px;
      border: 2px solid #507274;
      border-top-color: transparent;
      border-radius: 50%;
      animation: chat-spin 0.8s linear infinite;
    }
    @keyframes chat-spin {
      to { transform: rotate(360deg); }
    }
    /* No conversation selector here. The design puts it in the output area as
       <small-dropdown label="Conversations"> (chat-output-slot-area #40001085:1521),
       so this element is the thread and nothing else. */
  `;

  private _roleOf(m: ChatMessage): string {
    const raw = String(m.role ?? (m as { type?: string }).type ?? 'assistant');
    return raw === 'user' || raw === 'question' ? 'user' : 'assistant';
  }

  /**
   * GRACE'S WORDS AS A PERSON PRINTS THEM — and the buttons those words carry. The control
   * tags come out (pipeline instructions, see shared/plainText), the markers are made plain,
   * and every `[label](action:…)` link becomes a button. The user's own words are left
   * exactly as typed; those are theirs.
   */
  private _segmentsOf(m: ChatMessage): Array<{ text?: string; label?: string; action?: string }> {
    const isAssistant = this._roleOf(m) === 'assistant';
    const raw = String(m.content ?? '');
    const shown = isAssistant ? asPlainText(stripControlTags(raw)) : raw;
    return shown.split(/(\[.*?\]\(action:[^)]+\))/g).map((part) => {
      const match = part.match(/^\[(.*?)\]\(action:([^)]+)\)$/);
      return match ? { label: match[1], action: match[2] } : { text: part };
    });
  }

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
      const root = thread.parentElement;
      /*
       * A RUN'S RESULTS OPEN AT THEIR HEAD, NOT AT THEIR TAIL. When the thread's
       * newest turn is a result (the run's conversation just loaded, or the results
       * just landed in a seat with no package), the top of the first result turn —
       * the "Your Results" line — is the top of the reading, and a long answer is
       * scrolled so it opens the viewport with the rest below as a normal scroll
       * (the owner, 2026-09-24: "the output should be visible at the top and then
       * the user can scroll to see the rest"). A short thread fits the column
       * anyway, so there is nothing to move — the guard reads the real heights.
       *
       * THE RULE ENDS THE MOMENT THE PERSON SPEAKS: their turn, or her reply, is a
       * conversational turn, and the thread follows it to the bottom exactly as it
       * always has — answering the results reverts to the normal flow.
       */
      if (list[list.length - 1]?.result) {
        const first = thread.querySelector('.turn.result') as HTMLElement | null;
        if (first) {
          // THE COLUMN'S OWN SCROLLER IS THE ONE THAT OVERFLOWS, and it is found by
          // walking up from this element (the panel's .content-scroll). The guard
          // reads real heights, so a short answer that fits its column scrolls
          // nothing — the "do nothing" case the owner described. `scrollIntoView`
          // does the rest across the shadow boundary, aligning the head of the
          // results with the top of that scroller.
          let scroller: HTMLElement | null = this.parentElement;
          while (scroller && !(scroller.scrollHeight > scroller.clientHeight)) {
            scroller = scroller.parentElement;
          }
          // jsdom does not implement scrollIntoView, so the call is guarded — a
          // test pins it with a mock of its own.
          if (scroller && typeof first.scrollIntoView === 'function') {
            first.scrollIntoView({ block: 'start', behavior: 'auto' });
          }
        }
        return;
      }
      // Nothing marked, nothing to follow: a new conversational turn keeps the
      // newest words in view.
      if (root) root.scrollTop = root.scrollHeight;
    }
  }

  /**
   * ONE BUTTON OF HER OFFER — pressed or still waiting.
   *
   * `disabled` on a spent one, so it cannot be pressed twice: what the app does for the ones it
   * handles itself would happen again (a second insertion of the same tool, a second write),
   * and for the ones that go back to her it would spend a model call to repeat an answer. The
   * label stays on screen either way, because the record of what was offered is part of the
   * conversation.
   */
  private _actionButton(label: unknown, action: unknown, turn: string) {
    const a = String(action);
    /*
     * TWO WAYS A BUTTON IS DONE, AND THEY COVER TWO DIFFERENT KINDS OF BUTTON.
     *
     * THE PROMPT SAYS SO, for anything that changes it: a seat that was filled, a tool that was
     * inserted, a description that was written. That survives a reload because the prompt does,
     * and it is derived rather than remembered — see shared/buttonState.
     *
     * THE PERSON PRESSED IT, for the ones the prompt cannot prove: "Check the Figma node" changes
     * nothing a reader can see, so no amount of reading the prompt will ever mark it. The press
     * is the only evidence there is.
     *
     * AND A PRESS LASTS FOR THE PACKAGE, NOT FOR THE TURN — which is the whole of this fix. The
     * mark was turn-scoped, so she could re-offer the same item in her next reply and it came
     * back LIVE, over and over: the owner, 2026-09-23, "she's still not fixing things and then
     * making that fixed item inactive … it seems to keep it." Her two answer words are the
     * exception, because `[Confirm]` in a later turn is a different question and must not arrive
     * already answered — those are named (HER_ANSWERS) and stay turn-scoped.
     */
    const answered = HER_ANSWERS.includes(a);
    const spent =
      this.doneActions.includes(a) ||
      (answered
        ? turn !== '' && this.spentTurn === turn && this.spentActions.includes(a)
        : this.spentActions.includes(a));
    return html`<button
      class="action ${spent ? 'spent' : ''}"
      data-action=${action}
      ?disabled=${spent}
      @click=${(e: Event) => this._onActionSend(e, String(action), turn)}
    >${label}</button>`;
  }

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
          ? turns.map((m) => html`<div class="turn ${this._roleOf(m)} ${m.alert ? 'alert' : ''} ${m.result ? 'result' : ''} ${m.nodeId ? 'linked' : ''} ${m.nodeId && m.nodeId === this.highlightNodeId ? 'hl' : ''}" data-node-id=${m.nodeId ?? nothing} title=${m.nodeId ? 'The note on the canvas this is about — click to point at it' : nothing} @click=${() => this._onTurnClick(m)}>${m.label ? html`<div class="note">${m.label}</div>` : nothing}${this._roleOf(m) === 'user' ? html`<user-response-bubble .text=${String(m.content ?? '')}></user-response-bubble>` : (m.result ? html`<div class="body markdown-body">${unsafeHTML(renderMarkdown(String(m.content ?? '')))}</div>` : html`<span class="body">${this._segmentsOf(m).map((seg) => (seg.action !== undefined ? this._actionButton(seg.label, seg.action, String(m.content ?? '')) : seg.text))}</span>`)}</div>`)
          : nothing}
        ${this.sending
          ? html`<div class="thinking"><span class="spinner" aria-hidden="true"></span> Thinking…</div>`
          : ''}
      </div>
    `;
  }
}

if (!customElements.get('chat-messages')) customElements.define('chat-messages', ChatMessages);

declare global {
  interface HTMLElementTagNameMap {
    'chat-messages': ChatMessages;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'chat-messages': React.DetailedHTMLProps<
        React.HTMLAttributes<ChatMessages> & {
          ref?: React.Ref<ChatMessages>;
        },
        ChatMessages
      >;
    }
  }
}
