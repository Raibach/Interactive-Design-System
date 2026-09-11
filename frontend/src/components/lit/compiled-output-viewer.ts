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

export class CompiledOutputViewer extends LitElement {
  static properties = {
    content: { type: String },
    status: { type: String },
    model: { type: String },
    tokens: { type: Number },
    isRunning: { type: Boolean, attribute: 'is-running' },
    sessionId: { type: String, attribute: 'session-id' },
    viewMode: { type: String, state: true },
  };

  declare content: string;
  declare status: string;
  declare model: string;
  declare tokens: number;
  declare isRunning: boolean;
  declare sessionId: string | null;
  declare viewMode: 'rendered' | 'raw';

  constructor() {
    super();
    this.content = '';
    this.status = 'empty';
    this.model = '';
    this.tokens = 0;
    this.isRunning = false;
    this.sessionId = null;
    this.viewMode = 'rendered';
  }

  private _prevContent = '';

  updated(changed: Map<string, unknown>): void {
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
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: #fff;
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

  /** One parsed block → Lit template. */
  private _block(b: any): unknown {
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
      case 'code': return html`<pre><code>${b.text}</code></pre>`;
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

  render() {
    const header = html`
      <div class="header">
        <div class="meta">
          <span>${this.model || '—'}</span>
          <span>${this.tokens || 0} tokens</span>
          ${this.isRunning
            ? html`<span class="progress" role="progressbar" aria-label="Running"
                    ><span class="progress-stripe"></span></span>`
            : html`<span class="status">${this.status}</span>`}
        </div>
        <div class="actions">
          <button @click=${this._toggleView}>${this.viewMode === 'raw' ? 'Rendered' : 'Raw'}</button>
          <button @click=${this._copy}>Copy</button>
          <button @click=${this._regenerate} ?disabled=${this.isRunning}>Regenerate</button>
          <button @click=${this._clear}>Clear</button>
        </div>
      </div>
    `;

    // The progress indicator lives inline in the header meta row (above), in
    // the position the "running" pill used to occupy.
    const display = this.viewMode === 'raw'
      ? html`<pre class="output raw">${this.content || '(no output yet)'}</pre>`
      : (this.content
          ? html`<div class="md">${this._parse(this.content).map((b) => this._block(b))}</div>`
          : html`<div class="md"><p style="color:#9ca3af">${this.isRunning ? 'Running…' : '(no output yet)'}</p></div>`);

    return html`${header}${display}`;
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