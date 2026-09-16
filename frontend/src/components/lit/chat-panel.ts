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
import './chat-header';
import './chat-messages';
import './chat-input';
import './chat-action-bar';
import './chat-footer';
import './chat-repair-actions';
import './error-banner';
import './chat-navigation-bar';
import './prompt-input/prompt-textarea';
import logoAsset from './assets/chat-logo-bce2fe.png';
// Grace's surface commands. A reply that carries XML tags drives the surface the
// same way the React seat did — through window CustomEvents and the event bus.
import { eventBus } from '@/shared/event-bus';

interface SeatMessage {
  role?: string;
  content?: string;
}

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
    leftColumnContent: { type: String, attribute: 'left-column-content' },
    /** The compiled Run output in the middle column, for Grace's workspace context. */
    compiledOutput: { type: String, attribute: 'compiled-output' },
    /** The console's prompt packages, for Grace's workspace context. */
    consoleCards: { type: Array },
    /** Open catalog findings, for Grace's workspace context. */
    catalogFindings: { type: Array },
    /** Non-pass findings for the repair panel. */
    findings: { type: Array },
    /** Record<string, 'repair' | 'done'> keyed by finding id. */
    repairStages: { type: Object },
    /** Component ids carrying an open annotation finding — draws the red banner. */
    unannotatedInUse: { type: Array },
    /** Label on the Models button in the action bar. */
    modelLabel: { type: String, attribute: 'model-label' },
    /** The package's conversations, fed by the host — the selector's list. */
    conversations: { type: Array },
    /** The input area's dragged height, px. 0 = auto. Reactive — the gripper's
        drag writes this and the template re-renders chat-input with it. */
    inputHeight: { type: Number },
  };

  // `declare` — NOT a class field. With `useDefineForClassFields` true, a plain field
  // here overwrites Lit's accessor and the element never draws (the blank right column
  // this file once was). Every element in this repo declares properties this way.
  /** The package's conversation. Bound from /session/right_column/conversation_id. */
  declare conversationId?: string;
  /** The package's history, as the server loaded it. Bound from /session/right_column/messages. */
  declare messages: SeatMessage[];
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
  declare leftColumnContent: string;
  /** The compiled Run output in the middle column. */
  declare compiledOutput: string;
  /** The console's prompt packages. */
  declare consoleCards: Array<Record<string, unknown>>;
  /** Open catalog findings. */
  declare catalogFindings: Array<Record<string, unknown>>;
  /** Non-pass findings for the repair panel. */
  declare findings: Array<Record<string, unknown>>;
  /** Per-finding repair state. */
  declare repairStages: Record<string, 'repair' | 'done'>;
  /** Component ids with an open annotation finding. */
  declare unannotatedInUse: string[];
  /** Label on the Models button. */
  declare modelLabel: string;
  /** The package's conversations. */
  declare conversations: Array<{ id?: string; title?: string }>;
  /** The input area's dragged height, px. 0 = auto. */
  declare inputHeight: number;

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
    this.findings = [];
    this.repairStages = {};
    this.unannotatedInUse = [];
    this.modelLabel = 'Models';
    this.conversations = [];
    this.inputHeight = 0;
  }

  private _sending = false;
  /** Turns spoken since this element mounted; the surface supplies everything before that. */
  private _local: SeatMessage[] = [];
  /** The slotted input's draft, and the in-flight request's abort handle. */
  private _draft = '';
  private _abort: AbortController | null = null;

  private _onDraftInput(e: Event) {
    const d = (e as CustomEvent).detail || {};
    if (typeof d.value === 'string') this._draft = d.value;
  }

  /** The bar's submit — send the slotted input's draft to the model. */
  private _onSendCommand() {
    const text = this._draft.trim();
    if (!text || this._sending) return;
    const textarea = this.renderRoot?.querySelector('prompt-textarea') as
      (HTMLElement & { value: string }) | null;
    if (textarea) textarea.value = '';
    this._draft = '';
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

  private _onResizeStart(e: Event) {
    const d = (e as CustomEvent).detail || {};
    this._dragStartY = typeof d.startY === 'number' ? d.startY : 0;
    this._dragStartHeight = this.inputHeight || 100;
    const bar = this.renderRoot?.querySelector('chat-action-bar') as HTMLElement | null;
    const footer = this.renderRoot?.querySelector('chat-footer') as HTMLElement | null;
    this._barHeight = bar?.getBoundingClientRect().height || 82;
    this._footerHeight = footer?.getBoundingClientRect().height || 142;
  }

  private _onResizeMove(e: Event) {
    const d = (e as CustomEvent).detail || {};
    if (typeof d.clientY !== 'number') return;
    const deltaY = this._dragStartY - d.clientY;
    // The cap must RESERVE the bar, the footer, and the output floor, so a big
    // drag shrinks the output region instead of stretching the panel and
    // dragging the footer along.
    const dynamicMax = this.clientHeight > 0
      ? Math.max(100, this.clientHeight - this._barHeight - this._footerHeight - 120)
      : 600;
    this.inputHeight = Math.max(
      100,
      Math.min(Math.min(600, dynamicMax), this._dragStartHeight + deltaY),
    );
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      height: 100%;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      color: #10455f;
    }
    /* The rail is <chat-navigation-bar>, which carries its own Figma constraint
       (75px, blue gradient, radius). The panel stacks the remaining pieces; only
       the thread is allowed to grow and scroll. */
    chat-navigation-bar { flex-shrink: 0; will-change: transform; }
    /* The panel FILLS its column and snaps to the edges of the browser window.
       contain: layout paint scopes its internals so a window drag-resize
       doesn't invalidate the whole surface every frame. */
    .panel {
      flex: 1 1 auto;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: #ffffff;
      contain: layout paint;
    }
    /* The split the gripper adjusts: the OUTPUT region flexes and scrolls
       internally; the INPUT chain (menu + input area + footer) hugs its
       content at the BOTTOM, so the footer never moves. Dragging the bar up
       grows the input area and shrinks the output; down reveals more output.
       No fixed heights, no empty slot wells — the frame's 519px was a
       wireframe value, not a contract. */
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
    .chat-input-wrapper {
      flex: 0 0 auto;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    chat-header { flex-shrink: 0; }
    chat-messages { flex: 1 1 auto; min-height: 0; display: flex; }
    chat-action-bar { flex-shrink: 0; }
    chat-input { flex-shrink: 0; }
    chat-footer { flex-shrink: 0; }
    /* A seat handed over by the host fills the column. The empty modifier is display:none rather
       than a zero-height box on purpose: an empty flex child with flex-grow would take the space
       the element's own pieces are supposed to have. */
    .seat { flex: 1 1 auto; min-height: 0; min-width: 0; display: flex; }
    .seat.empty { display: none; }
    ::slotted(*) { flex: 1 1 auto; min-width: 0; min-height: 0; }
  `;

  private get _thread(): SeatMessage[] {
    // The surface's history first, then anything said since it was handed over. One
    // conversation; the split is only about who supplied the bytes.
    return [...(this.messages || []), ...this._local];
  }

  // ── The slot contract. See the header. ───────────────────────────────────────
  /** Is a seat supplied by the host? Read at render time — the light DOM is the truth. */
  private _seatSlotted(): boolean {
    const slot = this.renderRoot?.querySelector('slot');
    const assigned = slot?.assignedNodes?.({ flatten: true }) ?? [];
    if (assigned.some((n) => n.nodeType === Node.ELEMENT_NODE)) return true;
    // The light DOM covers the case slotting does not report: jsdom's slotting is thin, and a host
    // may append a seat after this element's first render.
    return this.children.length > 0;
  }

  private _onSlotChange(): void {
    // A seat arrived or left. Nothing is cached: the next render reads the light DOM again.
    this.requestUpdate();
  }

  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (changed.has('conversationId')) void this._loadHistory();
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
    try {
      const resp = await fetch(`/api/conversations/${this.conversationId}/messages?limit=200`, {
        headers: { 'X-User-ID': this._userId() },
      });
      if (!resp.ok) return;
      const data = await resp.json().catch(() => ({}));
      const rows: SeatMessage[] = Array.isArray(data?.messages) ? data.messages : [];
      if (!rows.length) return;
      this.messages = rows.map((m) => ({ role: m.role, content: m.content }));
    } catch (err) {
      console.error('[chat-panel] could not read the package\'s history:', err);
    }
  }

  private _userId(): string {
    try {
      return localStorage.getItem('raibach_user_id') || '00000000-0000-0000-0000-000000000001';
    } catch {
      return '00000000-0000-0000-0000-000000000001';
    }
  }

  private async _write(role: 'user' | 'assistant', content: string): Promise<void> {
    // Written into the PACKAGE's conversation as it is said. A message that exists only in
    // this element is gone the moment the surface reassembles — the defect this replaces.
    if (!this.conversationId) return;
    try {
      await fetch(`/api/conversations/${this.conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-ID': this._userId() },
        body: JSON.stringify({ role, content, metadata: {} }),
      });
    } catch (err) {
      console.error('[chat-panel] could not write the turn down:', err);
    }
  }

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
      if (this.leftColumnContent) {
        const parsed = JSON.parse(this.leftColumnContent);
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
        sessionId: 'default',
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
    this._local = [...this._local, { role: 'user', content: text }];
    this._sending = true;
    this.requestUpdate();
    void this._write('user', text);

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
          temperature: 0.45,
          session_id: this.sessionId,
          conversation_id: this.conversationId,
        }),
        signal: this._abort.signal,
      });
      const data = await resp.json().catch(() => ({}));
      // A new package has no conversation until the first send; the backend creates
      // one (conversations.session_id NOT NULL) and returns its id. Adopt it so the
      // thread, the history and every later write are this package's, and tell the
      // host so the package record keeps it too.
      if (typeof data?.conversation_id === 'string' && data.conversation_id && !this.conversationId) {
        this.conversationId = data.conversation_id;
        this.dispatchEvent(
          new CustomEvent('conversation-change', {
            bubbles: true,
            composed: true,
            detail: { conversationId: data.conversation_id },
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
          void this._write('assistant', reply);
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
      this._sending = false;
      this._abort = null;
      this.requestUpdate();
    }
  }

  private _onMessageSent(e: Event) {
    const detail = (e as CustomEvent).detail || {};
    const text = String(detail.text ?? '').trim();
    if (text) void this._send(text);
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
    this.dispatchEvent(
      new CustomEvent('conversation-change', {
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
      <slot
        class=${seated ? 'seat' : 'seat empty'}
        @slotchange=${this._onSlotChange}
      ></slot>
      ${seated
        ? nothing
        : html`
            <chat-navigation-bar active-tab="chat">
              <img slot="logo" src=${logoAsset} width="66" height="62" alt="Copilot" />
            </chat-navigation-bar>
            <div class="panel">
              <div class="chat-output-wrapper">
                <chat-header
                  status-text=${this.statusText ?? ''}
                  status=${this.status ?? ''}
                  session-label=${this.sessionLabel ?? ''}
                  session-name=${this.sessionName ?? ''}
                  duration=${this.duration ?? ''}
                  qa-score=${this.qaScore ?? ''}
                ></chat-header>
                ${unannotated
                  ? html`<error-banner
                      code="UNANNOTATED-IN-USE"
                      message="A component in use was generated without its catalog annotation — its behaviour is being invented downstream."
                    ></error-banner>`
                  : nothing}
                <chat-repair-actions
                  .findings=${this.findings ?? []}
                  .repairStages=${this.repairStages ?? {}}
                ></chat-repair-actions>
                <chat-messages
                  .messages=${this._thread}
                  .sending=${this._sending}
                  .conversations=${this.conversations ?? []}
                  conversation-id=${this.conversationId ?? ''}
                  @conversation-select=${this._onConversationSelect}
                ></chat-messages>
              </div>
              <div class="chat-input-wrapper">
                <chat-action-bar
                  model-label=${this.modelLabel ?? 'Models'}
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
                    @value-input=${this._onDraftInput}
                  ></prompt-textarea>
                </chat-input>
                <chat-footer
                  .unattributed=${!attributed}
                  .tokens=${(usage.totalTokens as number) ?? 0}
                  .inTokens=${(usage.inTokens as number) ?? 0}
                  .outTokens=${(usage.outTokens as number) ?? 0}
                  .calls=${(usage.calls as number) ?? 0}
                  .lastCall=${(usage.lastCall as string) ?? ''}
                ></chat-footer>
              </div>
            </div>
          `}
    `;
  }
}

customElements.define('chat-panel', ChatPanel);

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
          ref?: React.Ref<ChatPanel>;
        },
        ChatPanel
      >;
    }
  }
}
