/**
 * <chat-messages> — the package conversation's thread.
 *
 * Figma source: the "output-area" slots 40001066:4314–4326 inside
 * right-column-panel-container (40001066:3272) — column, padding 20px, gap 10px,
 * radius 6px, fill #FFFFFF, hug height. Those slots are the message wells.
 *
 * Pure render: it takes the resolved message list as a property and draws
 * role-styled turns. It owns scroll-to-bottom. It never fetches or writes — the
 * parent <chat-panel> is the one channel to the package conversation.
 *
 * Part of the <chat-panel> composition. Not a catalog entry on its own.
 */
import { LitElement, html, css, nothing } from 'lit';
import { asPlainText, stripControlTags } from '@/shared/plainText';
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
  };

  declare messages: ChatMessage[];
  declare sending: boolean;
  declare highlightNodeId?: string;

  constructor() {
    super();
    this.messages = [];
    this.sending = false;
    this.highlightNodeId = undefined;
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
      font-family: 'Inter', system-ui, sans-serif;
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
      background: transparent;
      transition: background 0.12s, outline-color 0.12s;
      outline: 2px solid transparent;
    }
    /* The message itself: pre-wrap, so the newlines a person typed are theirs. */
    .turn .body { white-space: pre-wrap; }
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
    /* THE USER'S TURN IS THE DESIGN'S BUBBLE, not a wash on this wrapper. v.4b draws
       it as its own component — "user-response-bubble" #40001119:6352 — so the fill,
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
    /* THE EMPTY THREAD IS HER GREETING, IN THE CARD'S OWN TYPE.
       Every value here is the drawing's, from "chat-output-header" #40001119:6327 — the card
       holds its lines in Inter Medium 500 / 13px / 20px / #171717 (#40001119:6358, :6337) —
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
      font-family: 'Inter', system-ui, sans-serif;
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
  private _onActionSend(e: Event, action: string): void {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('chat-action-send', {
        detail: { text: `[${action}]` },
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
    // Nothing marked, or nothing to mark: the newest turn is the one in view. Same reason.
    const root = thread.parentElement;
    if (root) root.scrollTop = root.scrollHeight;
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
          ? turns.map((m) => html`<div class="turn ${this._roleOf(m)} ${m.nodeId ? 'linked' : ''} ${m.nodeId && m.nodeId === this.highlightNodeId ? 'hl' : ''}" data-node-id=${m.nodeId ?? nothing} title=${m.nodeId ? 'The note on the canvas this is about — click to point at it' : nothing} @click=${() => this._onTurnClick(m)}>${m.label ? html`<div class="note">${m.label}</div>` : nothing}${this._roleOf(m) === 'user' ? html`<user-response-bubble .text=${String(m.content ?? '')}></user-response-bubble>` : html`<span class="body">${this._segmentsOf(m).map((seg) => (seg.action !== undefined ? html`<button class="action" data-action=${seg.action} @click=${(e: Event) => this._onActionSend(e, String(seg.action))}>${seg.label}</button>` : seg.text))}</span>`}</div>`)
          : html`<div class="empty" role="status">Hi — how can I help you today?</div>`}
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
