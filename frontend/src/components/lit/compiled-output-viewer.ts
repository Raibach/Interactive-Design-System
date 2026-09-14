/**
 * <compiled-output-viewer> — Lit port of MiddleColumnSlot output logic
 *
 * Displays streamed/compiled prompt output for composer surfaces.
 * Receives content via property (from updateDataModel /session/middle_column/compiled_output).
 *
 * Features (v1):
 *   - Raw vs rendered toggle
 *   - Copy to clipboard
 *   - Regenerate / Clear buttons (dispatch events)
 *   - Status + model + token display
 *   - Auto-scroll during streaming
 *
 * Events:
 *   copy-output, regenerate-requested, clear-output
 */

import { LitElement, html, css } from 'lit';
import './prompt-input/model-selector-button';
import './prompt-input/gripper-prompt-input';

/**
 * A fenced block longer than this is folded to one line until it is opened.
 *
 * An answer about a one-word change hands back the WHOLE file — the app's own
 * repair contract is a whole-file re-emit, because applyRepair overwrites a file
 * and applyReadiness rejects a patch or a cut-off file. So the pane that shows the
 * answer was showing sixty lines of code for a one-word edit, and the one line
 * that mattered was above it. Above this many lines the block is announced
 * instead: what it is, how long it is, and one click to read it. Short snippets
 * (a two-line type, a shell command) stay as they were — they were never the
 * wall.
 */
const FOLD_AFTER_LINES = 12;

export class CompiledOutputViewer extends LitElement {
  static properties = {
    content: { type: String },
    status: { type: String },
    model: { type: String },
    tokens: { type: Number },
    /** Dollar cost of the most recent Run, as reported by the provider. */
    cost: { type: String },
    isRunning: { type: Boolean, attribute: 'is-running' },
    sessionId: { type: String, attribute: 'session-id' },
    viewMode: { type: String, state: true },
    /** Seconds the current — or the just-finished — Run has taken. Local state. */
    elapsed: { state: true },
  };

  declare content: string;
  declare status: string;
  declare model: string;
  declare tokens: number;
  declare cost: string;
  declare isRunning: boolean;
  declare sessionId: string | null;
  declare viewMode: 'rendered' | 'raw';
  declare elapsed: number;

  constructor() {
    super();
    this.content = '';
    this.status = 'empty';
    this.model = '';
    this.tokens = 0;
    this.cost = '';
    this.isRunning = false;
    this.sessionId = null;
    this.viewMode = 'rendered';
    this.elapsed = 0;
  }

  private _prevContent = '';

  /**
   * A clock for the Run in flight.
   *
   * A Run is one call to a reasoning model with a large token budget — measured at 1010
   * completion tokens just to answer "OK" — so it is legitimately slow, and the pane
   * said "Running…" with no number while it happened. A spinner that has not changed in
   * forty seconds reads as a hang, so the seconds are counted out loud.
   */
  private _timer: number | null = null;
  private _startedAt = 0;
  /** True once this element has watched a Run finish, so no line appears on mount. */
  private _ranOnce = false;

  /**
   * The folded blocks the reader has opened, by index in the parsed reply.
   *
   * Keyed by position, not by text: the block a reader opens is the one they are
   * looking at — block 3 of this reply — not "every block anywhere that happens
   * to hold these characters". Cleared when a new Run starts or another session's
   * output arrives, because that is a different document.
   */
  private _openBlocks = new Set<number>();

  private _toggleBlock = (index: number): void => {
    const next = new Set(this._openBlocks);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    this._openBlocks = next;
    this.requestUpdate();
  };

  private _startClock = (): void => {
    this._startedAt = Date.now();
    this._ranOnce = true;
    this.elapsed = 0;
    this._openBlocks = new Set();
    if (this._timer !== null) return;
    this._timer = window.setInterval(() => {
      this.elapsed = Math.round((Date.now() - this._startedAt) / 1000);
    }, 1000);
  };

  private _stopClock = (): void => {
    if (this._timer !== null) {
      window.clearInterval(this._timer);
      this._timer = null;
    }
    this.elapsed = Math.round((Date.now() - this._startedAt) / 1000);
  };

  disconnectedCallback(): void {
    this._stopClock();
    super.disconnectedCallback();
  }

  /**
   * What just happened, in words — in the position the running bar occupied.
   *
   * A finished Run left the output and no statement of what it was, and a pane with no
   * mark of an ending cannot be told from one that is still working.
   */
  private get _finishedLine(): string {
    if (!this._ranOnce || this.elapsed <= 0) return '';
    if (this._failed) return `Stopped after ${this.elapsed}s`;
    return this.content ? `Done in ${this.elapsed}s` : '';
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('isRunning')) {
      if (this.isRunning) this._startClock();
      else if (this._ranOnce) this._stopClock();
    }
    if (changed.has('sessionId') && this.sessionId) {
      // Another prompt's output is a different document: folds opened in the one
      // that was on screen do not carry over to it (or to the same index in it).
      this._openBlocks = new Set();
    }
    if (changed.has('content') && this.isRunning) {
      // auto-scroll during streaming
      const el = this.shadowRoot?.querySelector('.output') as HTMLElement | null;
      if (el) el.scrollTop = el.scrollHeight;
    }
  }

  private _copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(this.content || '');
      this.dispatchEvent(new CustomEvent('copy-output', { bubbles: true, composed: true }));
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = this.content || '';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      this.dispatchEvent(new CustomEvent('copy-output', { bubbles: true, composed: true }));
    }
  };

  private _regenerate = (): void => {
    this.dispatchEvent(new CustomEvent('regenerate-requested', {
      bubbles: true,
      composed: true,
      detail: { model: this.model },
    }));
  };

  private _clear = (): void => {
    this.dispatchEvent(new CustomEvent('clear-output', { bubbles: true, composed: true }));
  };

  private _toggleView = (): void => {
    this.viewMode = this.viewMode === 'rendered' ? 'raw' : 'rendered';
  };

  // ── Markdown → Lit templates ─────────────────────────────────────────────
  // No innerHTML anywhere (repo rule: declarative only). Every value is
  // interpolated, so Lit escapes it — XSS-safe by construction.
  private _parse(md: string): any[] {
    const lines = (md || '').replace(/\r\n/g, '\n').split('\n');
    const out: any[] = [];
    let i = 0;
    const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
    const cells = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    const startsBlock = (l: string) =>
      /^(#{1,6}\s|```)/.test(l) || /^\s*([-*+]\s|\d+[.)]\s|>|\|)/.test(l) || /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(l);

    while (i < lines.length) {
      const line = lines[i];

      if (/^```/.test(line)) {
        const lang = line.slice(3).trim();
        const buf: string[] = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
        i++;
        out.push({ t: 'code', lang, text: buf.join('\n') });
        continue;
      }

      const h = /^(#{1,6})\s+(.*)$/.exec(line);
      if (h) { out.push({ t: 'h', level: h[1].length, text: h[2] }); i++; continue; }

      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { out.push({ t: 'hr' }); i++; continue; }

      if (isRow(line) && i + 1 < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1])) {
        const head = cells(line);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && isRow(lines[i])) { rows.push(cells(lines[i])); i++; }
        out.push({ t: 'table', head, rows });
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*+]\s+/, '')); i++; }
        out.push({ t: 'ul', items });
        continue;
      }

      if (/^\s*\d+[.)]\s+/.test(line)) {
        const items: string[] = [];
        while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+[.)]\s+/, '')); i++; }
        out.push({ t: 'ol', items });
        continue;
      }

      if (/^\s*>\s?/.test(line)) {
        const buf: string[] = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) { buf.push(lines[i].replace(/^\s*>\s?/, '')); i++; }
        out.push({ t: 'quote', text: buf.join(' ') });
        continue;
      }

      if (!line.trim()) { i++; continue; }

      const buf: string[] = [line.trim()];
      i++;
      while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) { buf.push(lines[i].trim()); i++; }
      out.push({ t: 'p', text: buf.join(' ') });
    }
    return out;
  }

  /** Inline emphasis → Lit nodes (typed out, never injected as HTML). */
  private _inline(text: string): unknown[] {
    const parts: unknown[] = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push(text.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('**')) parts.push(html`<strong>${tok.slice(2, -2)}</strong>`);
      else if (tok.startsWith('`')) parts.push(html`<code>${tok.slice(1, -1)}</code>`);
      else parts.push(html`<em>${tok.slice(1, -1)}</em>`);
      last = m.index + tok.length;
    }
    if (last < text.length) parts.push(text.slice(last));
    return parts;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: row;
      height: 100%;
      min-height: 0;
      background: #fff;
    }
    /* ── Layout: main column + right vertical tab strip (Figma center-panel-3rd-col) ── */
    .main {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      min-height: 0;
    }
    .controls {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 0 10px;
      height: 40px;
      flex-shrink: 0;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .selector-tile {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      height: 40px;
      padding: 0 10px;
      background: #fff;
      border: none;
      border-radius: 6px;
      box-shadow: 4px 4px 10px rgba(0, 0, 0, 0.15), -4px -4px 10px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .selector-label {
      font-size: 13px;
      font-weight: 700;
      color: #171717;
      white-space: nowrap;
    }
    .chevron { color: #6b7280; font-size: 12px; }
    .model-name {
      font-size: 11px;
      color: #6b7280;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 120px;
    }
    .running {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;
      background: #dbeafe;
      color: #1e40af;
      white-space: nowrap;
    }
    .finished {
      font-size: 10px;
      color: #6b7280;
      white-space: nowrap;
    }
    .actions {
      margin-left: auto;
      display: flex;
      align-items: center;
    }
    .output-area {
      flex: 1;
      min-height: 0;
      display: flex;
      flex-direction: column;
    }
    .tab-strip {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 40px;
      flex-shrink: 0;
      border-left: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .gripper { flex-shrink: 0; }
    .token-readout {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 8px 0;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10px;
      color: #6b7280;
      white-space: nowrap;
    }
    .format-label {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      padding: 4px 0;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10px;
      color: #9ca3af;
      white-space: nowrap;
    }
    .format-btn {
      width: 30px;
      height: 30px;
      margin: 3px 0;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
      font-weight: 700;
      color: #374151;
    }
    .format-btn.active {
      background: #1B898D;
      color: #fff;
      border-color: #1B898D;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      font-size: 11px;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }
    .meta {
      display: flex;
      gap: 8px;
      color: #6b7280;
    }
    .actions button {
      font-size: 10px;
      padding: 2px 8px;
      margin-left: 4px;
      border: 1px solid #d1d5db;
      background: #fff;
      border-radius: 4px;
      cursor: pointer;
    }
    .actions button:hover { background: #f3f4f6; }
    .output {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 12px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
      background: #fff;
    }
    .raw {
      background: #0f172a;
      color: #e2e8f0;
    }
    .status {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 3px;
      background: #e5e7eb;
    }
    .status.running { background: #dbeafe; color: #1e40af; }

    /* ── Candy-stripe progress, INLINE in the header meta row ─────────────── */
    /* Sits where the "running" pill was. Pale blue, softer than the body. */
    .progress {
      position: relative;
      display: inline-block;
      vertical-align: middle;
      width: 96px;
      height: 6px;
      border-radius: 3px;
      background: #eef4fb;
      overflow: hidden;
    }
    .progress-stripe {
      position: absolute;
      top: 0;
      left: -28.28px;
      height: 100%;
      width: calc(100% + 28.28px);
      background-image: repeating-linear-gradient(
        45deg,
        #cddff2 0 10px,
        #ffffff 10px 20px
      );
      animation: candy 0.9s linear infinite;
    }
    @keyframes candy {
      from { transform: translateX(0); }
      to   { transform: translateX(28.28px); }
    }
    @media (prefers-reduced-motion: reduce) {
      .progress-stripe { animation-duration: 3s; }
    }

    /* ── Could not be generated ─────────────────────────────────────────────
       When a Run dies there is nothing to show — and blank space is the one
       thing this pane must never answer with. An empty frame reads as "still
       working" or "nothing to say"; neither is true. So a failure gets a MARK:
       big, unmistakable, impossible to mistake for content — with the raw
       reason underneath, selectable, so it can be quoted back. */
    .failed {
      flex: 1;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 24px 18px;
      background: #fff;
      text-align: center;
    }
    .failed-mark {
      font-size: 64px;
      line-height: 1;
      color: #dc2626;
    }
    .failed-text {
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 14px;
      font-weight: 700;
      color: #991b1b;
    }
    .failed-detail {
      margin: 0;
      padding: 10px 12px;
      max-width: 100%;
      overflow: auto;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      line-height: 1.5;
      color: #7f1d1d;
      white-space: pre-wrap;
      word-break: break-word;
      text-align: left;
    }

    /* ── Rendered markdown (no innerHTML — Lit templates only) ───────────── */
    .md {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 14px 16px;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      font-size: 13px;
      line-height: 1.6;
      color: #1f2937;
      background: #fff;
    }
    .md h1, .md h2, .md h3, .md h4, .md h5, .md h6 {
      margin: 14px 0 6px;
      color: #234354;
      line-height: 1.25;
      font-weight: 700;
    }
    .md h1 { font-size: 20px; }
    .md h2 { font-size: 17px; }
    .md h3 { font-size: 15px; }
    .md h4, .md h5, .md h6 { font-size: 13px; }
    .md p { margin: 0 0 10px; }
    .md ul, .md ol { margin: 0 0 10px; padding-left: 20px; }
    .md li { margin: 2px 0; }
    .md code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      background: #f1f5f9;
      border-radius: 3px;
      padding: 1px 4px;
    }
    /* ── Scrollbar — matched EXACTLY to the left column's (.sections-scroll in
         prompt-section-editor): 14px, transparent track, #dadee4 rounded thumb.
         Kept in lockstep so all three columns scroll identically. ─────────── */
    .output::-webkit-scrollbar,
    .md::-webkit-scrollbar { width: 14px; }
    .output::-webkit-scrollbar-track,
    .md::-webkit-scrollbar-track { background: transparent; }
    .output::-webkit-scrollbar-thumb,
    .md::-webkit-scrollbar-thumb { background: #dadee4; border-radius: 10px; }

    .md pre {
      margin: 0 0 12px;
      padding: 10px 12px;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 6px;
      overflow: auto;
      white-space: pre;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .md pre code { background: none; color: inherit; padding: 0; }
    /* A folded code block: one line saying what it is, opening in place. */
    .md .fold { margin: 0 0 12px; }
    .md .fold-head {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #e5e7eb;
      border-radius: 6px;
      background: #f9fafb;
      color: #234354;
      font: inherit;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
    }
    .md .fold-head:hover { background: #f3f4f6; }
    .md .fold-head:focus-visible { outline: 2px solid #1B898D; outline-offset: 1px; }
    .md .fold-caret { color: #6b7280; font-size: 10px; }
    .md .fold-title { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; }
    .md .fold-action { margin-left: auto; color: #1B898D; text-decoration: underline; }
    .md .fold pre { margin: 6px 0 0; }
    .md blockquote {
      margin: 0 0 10px;
      padding: 6px 12px;
      border-left: 3px solid #8EC1B3;
      background: #f8fafb;
      color: #374151;
    }
    .md hr { border: none; border-top: 1px solid #e5e7eb; margin: 14px 0; }
    .md table { border-collapse: collapse; margin: 0 0 12px; width: 100%; }
    .md th, .md td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; }
    .md th { background: #f9fafb; font-weight: 700; color: #234354; }
    .md a { color: #1B898D; }
  `;

  /**
   * A fenced block, folded when it is long enough to be the whole reply.
   *
   * The reader is told what the block is (its language) and how big it is (its
   * line count) instead of being handed all of it, and one click opens it. The
   * text is still the whole block, still escaped by Lit — folding hides nothing
   * from Copy, which copies the reply, not the fold.
   */
  private _codeBlock(b: any, index: number): unknown {
    const text: string = b.text || '';
    const lines = text ? text.split('\n').length : 0;
    if (lines <= FOLD_AFTER_LINES) return html`<pre><code>${text}</code></pre>`;

    const open = this._openBlocks.has(index);
    return html`
      <div class="fold">
        <button
          class="fold-head"
          type="button"
          aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this._toggleBlock(index)}
        >
          <span class="fold-caret" aria-hidden="true">${open ? '▾' : '▸'}</span>
          <span class="fold-title">${b.lang ? `${b.lang} · ` : ''}${lines} lines</span>
          <span class="fold-action">${open ? 'hide' : 'show'}</span>
        </button>
        ${open ? html`<pre><code>${text}</code></pre>` : html``}
      </div>
    `;
  }

  /** One parsed block → Lit template. */
  private _block(b: any, index = -1): unknown {
    switch (b.t) {
      case 'h': {
        const inner = this._inline(b.text);
        switch (b.level) {
          case 1: return html`<h1>${inner}</h1>`;
          case 2: return html`<h2>${inner}</h2>`;
          case 3: return html`<h3>${inner}</h3>`;
          case 4: return html`<h4>${inner}</h4>`;
          case 5: return html`<h5>${inner}</h5>`;
          default: return html`<h6>${inner}</h6>`;
        }
      }
      case 'p': return html`<p>${this._inline(b.text)}</p>`;
      case 'code': return this._codeBlock(b, index);
      case 'ul': return html`<ul>${(b.items || []).map((it: string) => html`<li>${this._inline(it)}</li>`)}</ul>`;
      case 'ol': return html`<ol>${(b.items || []).map((it: string) => html`<li>${this._inline(it)}</li>`)}</ol>`;
      case 'quote': return html`<blockquote>${this._inline(b.text)}</blockquote>`;
      case 'hr': return html`<hr />`;
      case 'table': return html`<table>
        <thead><tr>${(b.head || []).map((c: string) => html`<th>${this._inline(c)}</th>`)}</tr></thead>
        <tbody>${(b.rows || []).map((r: string[]) => html`<tr>${r.map((c: string) => html`<td>${this._inline(c)}</td>`)}</tr>`)}</tbody>
      </table>`;
      default: return html``;
    }
  }

  /**
   * Did the output FAIL to be generated, as opposed to not existing yet?
   *
   * The two look identical in a pane and mean opposite things, so they are
   * separated here rather than left to the reader. The markers are the ones this
   * app itself writes when a Run cannot complete — matched at the START of the
   * content so a ⚠️ the model happens to use mid-sentence is not mistaken for a
   * dead Run.
   */
  private get _failed(): boolean {
    const t = (this.content || '').trimStart();
    return t.startsWith('Error:')
      || t.startsWith('⚠️')
      || t === '(No output returned.)';
  }

  render() {
    // The output selector tile (Figma "output-selector-tile") is the view-mode
    // control: rendered vs raw. The chevron is the affordance; one click toggles.
    const display = this.viewMode === 'raw'
      ? html`<pre class="output raw">${this.content || '(no output yet)'}</pre>`
      : ((this._failed && !this.isRunning)
          ? html`
              <div class="failed" role="alert">
                <div class="failed-mark" aria-hidden="true">&#9888;</div>
                <div class="failed-text">This could not be generated.</div>
                <pre class="failed-detail">${this.content}</pre>
              </div>
            `
          : (this.content
              ? html`<div class="md">${this._parse(this.content).map((b, i) => this._block(b, i))}</div>`
              : html`<div class="md"><p style="color:#9ca3af">${this.isRunning ? `Running… ${this.elapsed}s` : '(no output yet)'}</p></div>`));

    return html`
      <div class="main">
        <div class="controls">
          <button
            class="selector-tile"
            type="button"
            aria-haspopup="listbox"
            aria-label="Output format"
            title="Toggle output format"
            @click=${this._toggleView}
          >
            <span class="selector-label">${this.viewMode === 'raw' ? 'Raw output' : 'Rendered output'}</span>
            <span class="chevron" aria-hidden="true">&#9662;</span>
          </button>
          <model-selector-button></model-selector-button>
          <span class="model-name">${this.model || '—'}</span>
          ${this.isRunning
            ? html`<span class="running" role="status">Running… ${this.elapsed}s</span>`
            : this._finishedLine
              ? html`<span class="finished">${this._finishedLine}</span>`
              : html``}
          <div class="actions">
            <button @click=${this._copy}>Copy</button>
            <button @click=${this._regenerate} ?disabled=${this.isRunning}>Regenerate</button>
            <button @click=${this._clear}>Clear</button>
          </div>
        </div>
        <div class="output-area">${display}</div>
      </div>
      <div class="tab-strip">
        <gripper-prompt-input class="gripper" aria-label="Drag to resize output"></gripper-prompt-input>
        <div class="token-readout" aria-hidden="true">Tokens: ${this.tokens || 0} · Cost: ${this.cost || '—'}</div>
        <div class="format-label" aria-hidden="true">Response Format</div>
        <button
          class="format-btn ${this.viewMode === 'rendered' ? 'active' : ''}"
          type="button"
          aria-pressed=${this.viewMode === 'rendered' ? 'true' : 'false'}
          title="Response Format A — rendered"
          @click=${() => { this.viewMode = 'rendered'; }}
        >A</button>
        <button
          class="format-btn ${this.viewMode === 'raw' ? 'active' : ''}"
          type="button"
          aria-pressed=${this.viewMode === 'raw' ? 'true' : 'false'}
          title="Response Format B — raw"
          @click=${() => { this.viewMode = 'raw'; }}
        >B</button>
        <gripper-prompt-input class="gripper" aria-label="Drag to resize output"></gripper-prompt-input>
      </div>
    `;
  }
}

customElements.define('compiled-output-viewer', CompiledOutputViewer);

declare global {
  interface HTMLElementTagNameMap {
    'compiled-output-viewer': CompiledOutputViewer;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'compiled-output-viewer': React.DetailedHTMLProps<
        React.HTMLAttributes<CompiledOutputViewer> & {
          content?: string;
          status?: string;
          model?: string;
          tokens?: number;
          'is-running'?: '' | boolean;
          'session-id'?: string;
        },
        CompiledOutputViewer
      >;
    }
  }
}