/**
 * <design-chat-product-thread> — THE APP BUILDER'S OWN CONVERSATION DESIGN, IN THE PRODUCT SEAT.
 *
 * OWNER, 2026-10-06: *"Now proceed with replicating the app builder['s] original app['s]
 * conversation design inside of our grace output area … I really liked the way they did it.
 * I wanted it should work exactly the same."*
 *
 * This is a PORT of the builder's own thread (src/components/workspace/ChatPanel.tsx —
 * `groupMessages`, `BuildGroup`, `UserMessage`, `FormattedText`, the building row) and its
 * progress arithmetic (src/lib/agent-progress.ts). The engine's OWN message vocabulary is
 * the input, passed through the bridge untouched:
 *
 *     regular   the person's prompt              → a user bubble (right, "See all" when long)
 *     starting  "Starting a new run…"            → the group's opening line
 *     building  each step ("Writing the app…", the builder's spoken lines)
 *                                                → the steps list / the live current step
 *     finished  "Finished in Ns."                → the closing line + ✓ Completed
 *     error     "Stopped." / a failure           → the alert line
 *
 * EXACTNESS, WHERE IT IS VISIBLE: same grouping walk, same "N build steps" / "Building… (N)"
 * toggle with the spinner, same live-last-step line, same ✓ Completed in emerald, same
 * user bubble (88% max, rounded, #eeecea, preview at 550 → "See all" past 700), same text
 * rules (bold, links, inline code, fences, headings, bullets, lists), same building row
 * (bouncing dots + "Building..." + the elapsed/estimate bar that stops at 97% and says
 * "Longer than usual" instead of lying).
 *
 * SET ONLY BY THE PRODUCT ROOM (the seat's `productTools` flag chooses this element), so no
 * other seat's thread changes. It composes nothing and reaches nothing: the seat hands it
 * the bound thread plus the live lines it already receives.
 */
import { LitElement, html, css, nothing, svg, type TemplateResult } from 'lit';

interface ThreadMessage {
  role?: string;
  content?: string;
  messageType?: string | null;
}

interface BuildGroupShape {
  type: 'single' | 'build-group';
  messages: ThreadMessage[];
  startMsg?: ThreadMessage;
  buildMsgs?: ThreadMessage[];
  finishMsg?: ThreadMessage;
}

/* ── the port's arithmetic (agent-progress.ts, verbatim constants) ────────────── */

const MINUTE = 60_000;
const RUN_ESTIMATE_MS = 10 * MINUTE;
const RUN_ESTIMATE_MIN_MS = 4 * MINUTE;
const PROGRESS_CEILING = 0.97;
const LADDER: { atMs: number; estimateMs: number }[] = [
  [8, 12], [11, 15], [14, 18], [17, 20], [20, 23], [22, 25],
  [24, 29], [28, 33], [31, 35], [34, 39], [38, 42], [41, 45],
].map(([a, b]) => ({ atMs: a * MINUTE, estimateMs: b * MINUTE }));

function runEstimateAt(elapsedMs: number): { estimateMs: number; previousMs: number } {
  let estimateMs = RUN_ESTIMATE_MS;
  let previousMs = RUN_ESTIMATE_MIN_MS;
  for (const rung of LADDER) {
    if (elapsedMs < rung.atMs) break;
    previousMs = estimateMs;
    estimateMs = rung.estimateMs;
  }
  return { estimateMs, previousMs };
}

const MIN_RATIO_STEP = 0.01;
const LADDER_POINTS: { atMs: number; ratio: number }[] = (() => {
  const points = [{ atMs: 0, ratio: 0 }];
  let ratio = 0;
  for (const rung of LADDER) {
    ratio = Math.min(PROGRESS_CEILING, Math.max(rung.atMs / rung.estimateMs, ratio + MIN_RATIO_STEP));
    points.push({ atMs: rung.atMs, ratio });
  }
  const last = LADDER[LADDER.length - 1];
  points.push({ atMs: last.estimateMs, ratio: PROGRESS_CEILING });
  return points;
})();

function ladderRatio(elapsedMs: number): number {
  for (let index = 1; index < LADDER_POINTS.length; index++) {
    const from = LADDER_POINTS[index - 1];
    const to = LADDER_POINTS[index];
    if (elapsedMs >= to.atMs) continue;
    const span = to.atMs - from.atMs;
    const travelled = span > 0 ? (elapsedMs - from.atMs) / span : 1;
    return from.ratio + travelled * (to.ratio - from.ratio);
  }
  return PROGRESS_CEILING;
}

/* ── the engine-sized estimate (agent-progress.ts: `runProgress` / `expectedRunProgress`) ──
 *
 * THE APP HAS TWO ARITHMETICS AND IT PICKS BY FACT, NOT BY WISH: when the engine sent an
 * estimate (`agent/status.expectedMinutes`) the bar fills against THAT and hands over to the
 * ladder at 90 % when the estimate runs out; when it did not, the fixed ladder decides alone.
 * Both return the same five facts the label and the bar read, so the two can never disagree.
 */

const EXPECTED_HANDOFF_RATIO = 0.9;

interface RunProgressShape {
  ratio: number;
  percent: number;
  overrun: boolean;
  estimateMs: number;
  previousEstimateMs: number;
}

/** The app's `runProgress(elapsedMs)` — no engine estimate: the ladder decides everything. */
function ladderRunProgress(elapsedMs: number): RunProgressShape {
  const elapsed = Math.max(0, elapsedMs);
  const { estimateMs, previousMs } = runEstimateAt(elapsed);
  const overrun = elapsed >= estimateMs;
  const ratio = overrun ? PROGRESS_CEILING : Math.min(PROGRESS_CEILING, ladderRatio(elapsed));
  return { ratio, percent: Math.round(ratio * 100), overrun, estimateMs, previousEstimateMs: previousMs };
}

/** The app's `expectedRunProgress(elapsedMs, expectedMs)` — the engine sent an estimate. */
function expectedRunProgress(elapsedMs: number, expectedMs: number): RunProgressShape {
  const elapsed = Math.max(0, elapsedMs);
  // Floored at two minutes so the range copy never reads "0 to 1".
  const expected = Math.max(2 * MINUTE, expectedMs);

  if (elapsed < expected) {
    const ratio = EXPECTED_HANDOFF_RATIO * (elapsed / expected);
    return {
      ratio,
      percent: Math.round(ratio * 100),
      overrun: false,
      estimateMs: expected,
      // Same shape of range as the default "4 to 10 minutes".
      previousEstimateMs: expected * (RUN_ESTIMATE_MIN_MS / RUN_ESTIMATE_MS),
    };
  }

  // Past the estimate: the same ladder every other run climbs.
  const { estimateMs: ladderEstimate, previousMs } = runEstimateAt(elapsed);
  const ladderEndMs = LADDER[LADDER.length - 1].estimateMs;
  const overrun = elapsed >= ladderEstimate;
  const ratio =
    overrun || ladderEndMs <= expected
      ? PROGRESS_CEILING
      : EXPECTED_HANDOFF_RATIO +
        ((PROGRESS_CEILING - EXPECTED_HANDOFF_RATIO) * (elapsed - expected)) / (ladderEndMs - expected);

  return {
    ratio,
    percent: Math.round(ratio * 100),
    overrun,
    estimateMs: Math.max(expected, ladderEstimate),
    previousEstimateMs: elapsed < LADDER[0].atMs ? expected : Math.max(expected, previousMs),
  };
}

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  // The app gains the hour field rather than letting the minutes grow forever ("1:12:14").
  if (hours > 0) return `${hours}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/* ── the icons (the app's, as paths) ─────────────────────────────────────────── */

const chevronRight = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>`;
const chevronDown = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>`;
const checkIcon = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>`;
const alertIcon = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>`;
const spinnerIcon = svg`<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`;
// Lucide's `bot` — the glyph on the app's own empty state (see `_emptyState`).
const botIcon = svg`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>`;

/* ── FormattedText: the app's own text rules, ported ─────────────────────────── */

function renderInline(text: string): (string | TemplateResult)[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g);
  return tokens.map((token, ti) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return html`<strong>${token.slice(2, -2)}</strong>`;
    }
    const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      return html`<a href=${linkMatch[2]} target="_blank" rel="noopener noreferrer">${linkMatch[1]}</a>`;
    }
    if (token.startsWith('`') && token.endsWith('`')) {
      return html`<code>${token.slice(1, -1)}</code>`;
    }
    return token;
  });
}

function formattedText(text: string): TemplateResult {
  const parts = text.split(/(```[\s\S]*?```)/g);
  return html`<div class="ft">
    ${parts.map((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).replace(/^\w+\n/, '');
        return html`<pre>${code}</pre>`;
      }
      return part.split('\n').map((line) => {
        if (line.startsWith('# ')) return html`<h3>${renderInline(line.slice(2))}</h3>`;
        if (line.startsWith('## ')) return html`<h4>${renderInline(line.slice(3))}</h4>`;
        if (line.startsWith('### ')) return html`<h5>${renderInline(line.slice(4))}</h5>`;
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return html`<div class="li"><span class="li-mark">•</span><span>${renderInline(line.slice(2))}</span></div>`;
        }
        const numbered = line.match(/^(\d+)\.\s+(.*)$/);
        if (numbered) {
          return html`<div class="li"><span class="li-mark li-num">${numbered[1]}.</span><span>${renderInline(numbered[2])}</span></div>`;
        }
        if (line.trim() === '') return html`<div class="ft-gap"></div>`;
        return html`<p>${renderInline(line)}</p>`;
      });
    })}
  </div>`;
}

/* ── groupMessages: the app's exact walk, ported ─────────────────────────────── */

function groupMessages(messages: ThreadMessage[]): BuildGroupShape[] {
  const groups: BuildGroupShape[] = [];
  let i = 0;
  while (i < messages.length) {
    const msg = messages[i];
    if (msg.role !== 'user' && (msg.messageType === 'starting' || msg.messageType === 'building')) {
      const group: ThreadMessage[] = [];
      let startMsg: ThreadMessage | undefined;
      let finishMsg: ThreadMessage | undefined;
      const buildMsgs: ThreadMessage[] = [];
      while (i < messages.length) {
        const current = messages[i];
        if (current.role === 'user' && group.length > 0) break;
        group.push(current);
        if (current.messageType === 'starting') startMsg = current;
        else if (
          current.messageType === 'finished' ||
          current.messageType === 'error' ||
          current.messageType === 'limit-reached'
        ) {
          finishMsg = current;
          i++;
          break;
        } else if (current.messageType === 'building') buildMsgs.push(current);
        i++;
      }
      groups.push({ type: 'build-group', messages: group, startMsg, buildMsgs, finishMsg });
    } else {
      groups.push({ type: 'single', messages: [msg] });
      i++;
    }
  }
  return groups;
}

const USER_MSG_PREVIEW_CHARS = 550;
const USER_MSG_TRUNCATE_AT = 700;

export class ChatProductThread extends LitElement {
  static properties = {
    messages: { type: Array },
    /** A run is in flight — draws the app's building row (dots + estimate bar). */
    running: { type: Boolean },
    /** When the in-flight run started (ms) — the app's own run clock. */
    runStartedAt: { type: Number, attribute: 'run-started-at' },
    /** The engine's estimate for the in-flight run, whole minutes (`agent/status.expectedMinutes`);
     * 0/absent means none, and the app's fixed ladder applies instead. */
    expectedMinutes: { type: Number, attribute: 'expected-minutes' },
  };

  declare messages: ThreadMessage[];
  declare running: boolean;
  declare runStartedAt: number | null;
  declare expectedMinutes: number;

  /** Expanded build groups, by group index. */
  private _expanded = new Set<number>();
  /** "See all" per long user message, by (groupIndex, messageIndex). */
  private _seeAll = new Set<string>();
  private _clock = 0;

  constructor() {
    super();
    this.messages = [];
    this.running = false;
    this.runStartedAt = null;
    this.expectedMinutes = 0;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // The run clock ticks like the app's: one interval only while a run is live.
    this._clock = window.setInterval(() => {
      if (this.running) this.requestUpdate();
    }, 1000);
  }

  disconnectedCallback(): void {
    window.clearInterval(this._clock);
    super.disconnectedCallback();
  }

  private _toggleGroup(index: number): void {
    if (this._expanded.has(index)) this._expanded.delete(index);
    else this._expanded.add(index);
    this.requestUpdate();
  }

  private _toggleSeeAll(key: string): void {
    if (this._seeAll.has(key)) this._seeAll.delete(key);
    else this._seeAll.add(key);
    this.requestUpdate();
  }

  private _userBubble(text: string, seeAllKey: string): TemplateResult {
    const isLong = text.length > USER_MSG_TRUNCATE_AT;
    const expanded = this._seeAll.has(seeAllKey);
    let preview = text;
    if (isLong) {
      let cut = text.slice(0, USER_MSG_PREVIEW_CHARS);
      const lastBreak = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'));
      if (lastBreak > USER_MSG_PREVIEW_CHARS * 0.6) cut = cut.slice(0, lastBreak);
      preview = cut.trimEnd();
    }
    return html`<div class="user-row">
      <div class="user-bubble">
        ${text.trim()
          ? html`<p>${isLong && !expanded ? html`${preview}<span class="ellipsis">…</span>` : text}</p>`
          : nothing}
        ${isLong
          ? html`<button class="see-all" @click=${() => this._toggleSeeAll(seeAllKey)}>
              <span class="chev ${expanded ? 'up' : ''}">${chevronDown}</span>
              ${expanded ? 'Show less' : html`See all <span class="dim">· ${text.length.toLocaleString()} characters</span>`}
            </button>`
          : nothing}
      </div>
    </div>`;
  }

  private _group(group: BuildGroupShape, index: number): TemplateResult {
    const hasBuildMsgs = (group.buildMsgs?.length || 0) > 0;
    const isComplete = !!group.finishMsg;
    const expanded = this._expanded.has(index);
    const lastStep = hasBuildMsgs ? group.buildMsgs![group.buildMsgs!.length - 1] : null;
    return html`<div class="group">
      ${hasBuildMsgs
        ? html`<button class="steps-toggle" @click=${() => this._toggleGroup(index)}>
            ${expanded ? chevronDown : chevronRight}
            ${isComplete ? `${group.buildMsgs!.length} build steps` : html`Building... (${group.buildMsgs!.length})`}
            ${!isComplete ? spinnerIcon : nothing}
          </button>`
        : nothing}
      ${expanded
        ? group.buildMsgs?.map((msg) => html`<div class="step">${msg.content}</div>`)
        : nothing}
      ${!isComplete && hasBuildMsgs && !expanded && lastStep
        ? html`<div class="live-step">${spinnerIcon}<span>${lastStep.content}</span></div>`
        : nothing}
      ${group.finishMsg
        ? html`<div class="finish">
            ${group.finishMsg.messageType === 'error'
              ? html`<div class="finish-error">${alertIcon}${formattedText(String(group.finishMsg.content || ''))}</div>`
              : html`<div>
                  ${formattedText(String(group.finishMsg.content || ''))}
                  <div class="completed">${checkIcon}<span>Completed</span></div>
                </div>`}
          </div>`
        : nothing}
      ${!isComplete && !hasBuildMsgs && group.startMsg
        ? html`<div class="start-only">${spinnerIcon}<span>${group.startMsg.content}</span></div>`
        : nothing}
    </div>`;
  }

  /**
   * THE APP'S OWN EMPTY STATE (`ChatPanel.tsx`): a bot badge, "What do you want to build?",
   * "Describe your idea below" — drawn while the thread holds nothing and no run is live.
   * It stands where a greeting would: the room's voice is the builder's, never a welcome
   * of ours (owner, 2026-10-06: *"take out grace … I want to use app builder"*).
   */
  private _emptyState(): TemplateResult {
    return html`<div class="empty-state">
      <div class="empty-badge">${botIcon}</div>
      <p class="empty-title">What do you want to build?</p>
      <p class="empty-sub">Describe your idea below</p>
    </div>`;
  }

  private _buildingRow(): TemplateResult {
    const elapsed = this.runStartedAt ? Date.now() - this.runStartedAt : 0;
    // The app's own fork in the road: the engine's estimate when it sent one, the ladder otherwise.
    const expectedMs =
      typeof this.expectedMinutes === 'number' && this.expectedMinutes > 0
        ? this.expectedMinutes * MINUTE
        : 0;
    const { ratio, percent, overrun, estimateMs, previousEstimateMs } =
      expectedMs > 0 ? expectedRunProgress(elapsed, expectedMs) : ladderRunProgress(elapsed);
    const from = Math.round(previousEstimateMs / MINUTE);
    const minutes = Math.round(estimateMs / MINUTE);
    return html`<div class="building-row">
      <div class="dots-line">
        <span class="dots"><i></i><i></i><i></i></span>
        <span>Building...</span>
      </div>
      <div class="progress">
        <div class="progress-labels">
          <span class="elapsed">${formatDuration(elapsed)}</span>
          <span class="sep">/</span>
          <span class="estimate">${from} to ${minutes} minutes</span>
          <span class="pct ${overrun ? 'overrun' : ''}">${overrun ? 'Longer than usual' : `${percent}%`}</span>
        </div>
        <div
          class="bar"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow=${overrun ? nothing : percent}
          aria-label="How long this run has been going"
        >
          <div class="bar-fill ${overrun ? 'bar-overrun' : ''}" style=${`width: ${Math.max(2, ratio * 100)}%`}>
            <span class="shine" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>`;
  }

  render() {
    const groups = groupMessages(this.messages || []);
    return html`
      ${!groups.length && !this.running ? this._emptyState() : nothing}
      ${groups.map((group, index) => {
        if (group.type === 'build-group') return this._group(group, index);
        const msg = group.messages[0];
        if (msg.role === 'user') return this._userBubble(String(msg.content || ''), `s${index}`);
        return html`<div class="single-agent">${formattedText(String(msg.content || ''))}</div>`;
      })}
      ${this.running ? this._buildingRow() : nothing}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    /* ── the empty thread (the app's "What do you want to build?") ── */
    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      height: 100%; min-height: 240px; text-align: center; padding: 0 16px;
    }
    .empty-badge {
      width: 40px; height: 40px; border-radius: 999px; background: #f3f4f6;
      display: flex; align-items: center; justify-content: center; margin-bottom: 12px;
    }
    .empty-badge svg { width: 20px; height: 20px; color: #9ca3af; }
    .empty-title { margin: 0 0 4px; font-size: 15px; color: #6b7280; }
    .empty-sub { margin: 0; font-size: 14px; color: #9ca3af; }
    .group, .single-agent, .user-row { margin-bottom: 16px; }
    .group > * + * { margin-top: 4px; }

    /* ── the user bubble (the app's UserMessage) ── */
    .user-row { display: flex; justify-content: flex-end; }
    .user-bubble {
      max-width: 88%;
      border-radius: 16px 16px 2px 16px;
      padding: 10px 16px;
      background: #eeecea;
    }
    .user-bubble p {
      margin: 0;
      font-size: 15px;
      line-height: 1.625;
      white-space: pre-wrap;
      word-break: break-word;
      color: #1f2937;
    }
    .ellipsis { color: #9ca3af; }
    .see-all {
      margin-top: 6px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      font-weight: 500;
      color: #6b7280;
      background: none;
      border: 0;
      padding: 0;
      cursor: pointer;
    }
    .see-all:hover { color: #374151; }
    .see-all svg { width: 12px; height: 12px; }
    .see-all .chev { display: inline-flex; }
    .see-all .chev.up { transform: rotate(180deg); }
    .dim { color: #9ca3af; }

    /* ── the steps card (the app's BuildGroup) ── */
    .steps-toggle {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #9ca3af;
      background: none;
      border: 0;
      padding: 2px 0;
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }
    .steps-toggle:hover { color: #4b5563; }
    .steps-toggle svg { width: 12px; height: 12px; }
    .step {
      font-size: 12px;
      color: #9ca3af;
      padding: 2px 0 2px 16px;
      border-left: 2px solid #f3f4f6;
      margin-left: 2px;
    }
    .live-step {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      color: #6b7280;
      padding: 2px 0 2px 16px;
    }
    .live-step svg { width: 12px; height: 12px; margin-top: 2px; flex-shrink: 0; }
    .live-step span { min-width: 0; word-break: break-word; }
    .start-only {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 15px;
      color: #6b7280;
      padding: 4px 0;
    }
    .start-only svg { width: 16px; height: 16px; }
    .finish { padding: 4px 0; }
    .finish-error { display: flex; align-items: flex-start; gap: 8px; }
    .finish-error > svg { width: 16px; height: 16px; color: #ef4444; margin-top: 2px; flex-shrink: 0; }
    .completed {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 12px;
      font-size: 14px;
      color: #059669;
    }
    .completed svg { width: 16px; height: 16px; }
    .completed span { font-weight: 500; }

    /* ── FormattedText (the app's rules) ── */
    .ft { font-size: 15px; color: #374151; line-height: 1.625; }
    /* The app's space-y-1 rhythm between everything it draws — 4px on tops of siblings only. */
    .ft > *:not(:first-child) { margin-top: 4px; }
    .ft > p { margin: 0; }
    .ft h3 { margin: 8px 0 0; font-size: 16px; font-weight: 600; }
    .ft h4 { margin: 6px 0 0; font-size: 15px; font-weight: 600; }
    .ft h5 { margin: 4px 0 0; font-size: 14px; font-weight: 600; }
    .ft pre {
      margin: 8px 0;
      padding: 12px;
      background: #111827;
      color: #e5e7eb;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'IBM Plex Mono', 'IBM Plex Mono', Menlo, monospace;
      overflow-x: auto;
    }
    .ft code {
      background: #f3f4f6;
      padding: 1px 4px;
      border-radius: 4px;
      font-size: 12px;
      font-family: 'IBM Plex Mono', 'IBM Plex Mono', Menlo, monospace;
    }
    .ft a { color: #2563eb; text-decoration: none; }
    .ft a:hover { text-decoration: underline; }
    .ft .li { display: flex; gap: 6px; }
    .ft .li-mark { color: #9ca3af; flex-shrink: 0; }
    .ft .li-num { min-width: 1.2em; text-align: right; }
    .ft-gap { height: 4px; }

    .spin { animation: spin 1s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── the building row (the app's dots + RunProgress) ── */
    .building-row { padding: 8px 0; }
    .dots-line { display: flex; align-items: center; gap: 8px; font-size: 14px; color: #9ca3af; }
    .dots { display: flex; gap: 4px; }
    .dots i {
      width: 6px; height: 6px; border-radius: 999px; background: #9ca3af;
      animation: bounce 1s infinite;
    }
    .dots i:nth-child(2) { animation-delay: 150ms; }
    .dots i:nth-child(3) { animation-delay: 300ms; }
    /* Tailwind's animate-bounce — the app's dot animation: same duration, same curve. */
    @keyframes bounce {
      0%, 100% { transform: translateY(-25%); animation-timing-function: cubic-bezier(0.8, 0, 1, 1); }
      50% { transform: translateY(0); animation-timing-function: cubic-bezier(0, 0, 0.2, 1); }
    }
    .progress { margin-top: 6px; }
    /* text-2xs in the app: 11px / 16px, a hair of letter-spacing, muted. */
    .progress-labels {
      display: flex; align-items: baseline; gap: 8px;
      font-size: 11px; line-height: 16px; letter-spacing: 0.01em; color: oklch(0.556 0 0);
    }
    /* The app's own theme values (globals.css, light): foreground, warning, primary, border. */
    .elapsed { color: oklch(0.145 0 0); font-weight: 500; font-variant-numeric: tabular-nums; }
    .sep { margin: 0 4px; }
    .pct { margin-left: auto; flex-shrink: 0; font-variant-numeric: tabular-nums; }
    .pct.overrun { color: oklch(0.562 0.138 58); font-weight: 500; }
    .bar {
      margin-top: 4px; height: 3px; border-radius: 999px; overflow: hidden;
      background: oklch(0.922 0 0 / 70%); /* the app's bg-border/70 */
    }
    .bar-fill {
      position: relative; height: 100%; border-radius: 999px;
      background: oklch(0.45 0.18 230); /* the app's bg-primary, light theme */
      transition: width 1s linear;
    }
    .bar-overrun { background: oklch(0.762 0.152 76); } /* the app's bg-warning, light theme */
    /* The breathing head of the app's bar — tp-run-shine, globals.css, verbatim curve. */
    .shine { position: absolute; inset: 0; border-radius: inherit; overflow: hidden; }
    @media (prefers-reduced-motion: no-preference) {
      .shine::after {
        content: '';
        position: absolute; inset: 0; width: 34%;
        background: linear-gradient(90deg, transparent 0%, color-mix(in oklab, white 55%, transparent) 50%, transparent 100%);
        animation: run-shine 2.4s cubic-bezier(0.4, 0, 0.2, 1) infinite;
      }
      @keyframes run-shine {
        from { transform: translateX(-120%); }
        to { transform: translateX(400%); }
      }
    }
  `;
}

if (!customElements.get('design-chat-product-thread')) {
  customElements.define('design-chat-product-thread', ChatProductThread);
}

declare global {
  interface HTMLElementTagNameMap {
    'design-chat-product-thread': ChatProductThread;
  }
}
