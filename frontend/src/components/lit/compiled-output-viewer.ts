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
// Chevron artwork for ouput-selector-tile / chevron-blue-closed — node
// 40000922:4875, child "Arrow_drop_down" (40000922:4872, 14x13). The same file
// role-tile.ts imports; the design references one asset from two places, so it
// is imported, not re-drawn.
import arrowDropDown from '../../assets/figma-9598a83b0a4eb9b9fc9c226f302689fd4f7075df.svg';
// Side-effect imports for the elements the drawing instantiates. Both are
// registry entries with their own node ids — do not re-implement either:
//   model-selector-button  40000909:4322 + model-btn-label 40000973:24205
//   gripper-prompt-input   40000941:23074
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
    isRunning: { type: Boolean, attribute: 'is-running' },
    sessionId: { type: String, attribute: 'session-id' },
    /**
     * What the panel is showing, shown in ouput-selector-tile.
     *
     * Node 40001034:1190's text is literally "Agent Flow" (§3.5 of
     * FIGMA/AGENT_MIDDLE_COLUMN_SPEC.md). It is a property rather than a
     * hardcoded string because §D1 of WHAT-THEY-BUILT-WHAT-WE-BUILT.md makes
     * this slot the thing the reader chooses at the top of the panel — the
     * drawn value is the example, not the only value.
     */
    outputType: { type: String, attribute: 'output-type' },
    /** The description line in a vertical tab — node 40001034:1041, "Figma designs". */
    outputDescription: { type: String, attribute: 'output-description' },
    /** Cost for the vertical-tab readout — node 40001034:1039. */
    cost: { type: String },
    viewMode: { type: String, state: true },
    /** Seconds the current — or the just-finished — Run has taken. Local state. */
    elapsed: { state: true },
  };

  declare content: string;
  declare status: string;
  declare model: string;
  declare tokens: number;
  declare isRunning: boolean;
  declare sessionId: string | null;
  declare outputType: string;
  declare outputDescription: string;
  declare cost: string;
  declare viewMode: 'rendered' | 'raw';
  declare elapsed: number;

  constructor() {
    super();
    this.content = '';
    this.status = 'empty';
    this.model = '';
    this.tokens = 0;
    this.isRunning = false;
    this.sessionId = null;
    // Defaults are the literals read from the drawing, not invented values.
    this.outputType = 'Agent Flow';          // node 40001034:1190
    this.outputDescription = 'Figma designs'; // node 40001034:1041
    this.cost = '';
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
      const el = this.shadowRoot?.querySelector('.output-body') as HTMLElement | null;
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
    /* ── The middle column, as drawn ────────────────────────────────────────
       Figma node 40000914:4677 "center-panel-3rd-col", file key
       20UPR2KQMsbAxlo5NJb1se. Every value below carries the node id it was read
       from; the node-by-node table is FIGMA/AGENT_MIDDLE_COLUMN_SPEC.md §3.
       Nothing here comes from a screenshot or from memory.

       The layout arithmetic, every term of it a class string in that table:
         531 = 451 (panel) + 40 (vertical-tab B) + 40 (vertical-tab A)
         649 = 732 - pt10 - 40 (controls) - gap10 - pb23
         431 = 451 - px10 - px10
       ──────────────────────────────────────────────────────────────────────── */
    :host {
      display: flex;                /* output-container 40001037:2229 */
      align-items: center;          /* 40001037:2229 items-center */
      height: 100%;
      min-height: 0;
      min-width: 0;
      background: #fff;
    }

    /* right-panel-horiz-tab — 40000909:4085 */
    .panel {
      display: flex;
      flex-direction: column;       /* 40000909:4085 flex-col */
      gap: 10px;                    /* 40000909:4085 gap-[10px] */
      align-items: flex-start;      /* 40000909:4085 items-start */
      justify-content: center;      /* 40000909:4085 justify-center */
      /* 40000909:4085's own class string is size-full — it FILLS its container.
         The 451 in output-container is what the drawing's 531-wide container
         leaves it after the two 40px tabs: 531 - 40 - 40. It is a consequence
         of the container, not a width the node fixes.

         So this must flex. A hard width:451px reproduced the drawing at exactly
         531 and broke at every other width — and in the app the middle column's
         width is driven by workspace-layout, not by 531. Spec section 9.8.

         HAZARD: never write a backtick in this stylesheet. static styles is a
         tagged template literal, so ONE raw backtick ends the template and the
         whole file stops parsing (TS1005, reported at the line below, not at the
         backtick). Recursive backticks belong in ordinary // comments only. */
      flex: 1 1 auto;
      min-width: 0;
      height: 100%;
      padding: 10px 10px 23px;      /* 40000909:4085 pt-10 px-10 pb-23 */
      background: #fff;             /* 40000909:4085 bg-white */
      box-sizing: border-box;
    }

    /* output-vontrols — 40001034:1186.
       TWO children, exactly: the selector tile and the model button. The
       placeholder canvas controls are deliberately NOT here — spec §4; they
       render inside the output area's body instead. */
    .controls {
      display: flex;
      gap: 10px;                    /* 40001034:1186 gap-[10px] */
      align-items: center;          /* 40001034:1186 items-center */
      height: 40px;                 /* 40001034:1186 h-[40px] */
      width: 100%;                  /* 40001034:1186 w-full */
      flex-shrink: 0;
    }

    /* ouput-selector-tile — 40001034:1187 (misspelled in Figma; the node id is
       the join key, so the name is left exactly as the designer wrote it) */
    .selector-tile {
      display: flex;
      flex: 1 0 0;                  /* 40001034:1187 flex-[1_0_0] */
      align-items: center;          /* 40001034:1187 items-center */
      height: 40px;                 /* 40001034:1187 h-[40px] */
      max-width: 500px;             /* 40001034:1187 max-w-[500px] */
      min-width: 1px;               /* 40001034:1187 min-w-px */
      padding: 0 10px;              /* 40001034:1187 px-[10px] */
      background: #fff;             /* 40001034:1187 bg-white */
      border: none;
      border-radius: 6px;           /* 40001034:1187 rounded-[6px] */
      /* 40001034:1187 drop-shadow — the applied blur is 5px. The "button drop"
         variable returned for this same node says radius 10. Both are recorded
         in spec §3.4 (O2); neither is silently dropped. */
      box-shadow: -4px -4px 5px rgba(0, 0, 0, 0.15),
                   4px 4px 5px rgba(0, 0, 0, 0.15);
      cursor: pointer;
      font: inherit;
      text-align: left;
      box-sizing: border-box;
    }
    /* The output-type menu this selector opens is not drawn in 40000914:4677 —
       no menu contents are in the pull. The control renders with the correct tag
       and role; the host owns the menu. Same disposition as
       <model-selector-button>. Deliberately NOT marked as a behavior stub: see
       the note on _verticalTab for why marking this file is harmful. */

    /* output-type — 40001034:1189; its text run is 40001034:1190 */
    .output-type {
      flex: 1 0 0;                  /* 40001034:1189 flex-[1_0_0] */
      min-width: 1px;               /* 40001034:1189 min-w-px */
      font-family: 'Inter', system-ui, sans-serif;  /* 40001034:1190 Inter:Bold */
      font-size: 18px;              /* 40001034:1190 text-[18px] */
      font-weight: 700;             /* 40001034:1190 font-bold */
      line-height: normal;          /* 40001034:1190 leading-[normal] */
      color: #171717;               /* 40001034:1190 text-[#171717] */
      white-space: nowrap;          /* 40001034:1190 whitespace-nowrap */
    }

    /* chevron-blue-closed — 40000922:4875: 40x40, p-[7px], 14x13 Arrow_drop_down */
    .chevron {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      padding: 7px;                 /* 40000922:4875 p-[7px] */
      box-sizing: border-box;
      flex-shrink: 0;
    }
    .chevron img { display: block; width: 14px; height: 13px; }  /* 40000922:4872 */

    /* The model control is <model-selector-button>: the same published component
       (model-btn-label 40000973:24205) the prompt surface instantiates, and it
       already owns 171x40 + radius 6 + "Models". Nothing is restyled here. */

    /* output-area — 40000909:4165 */
    .output-area {
      display: flex;
      flex-direction: column;       /* 40000909:4165 flex-col */
      align-items: flex-start;      /* 40000909:4165 items-start */
      flex: 1 0 0;                  /* 40000909:4165 flex-[1_0_0] */
      width: 100%;                  /* 40000909:4165 w-full */
      min-height: 0;
      padding: 20px;                /* 40000909:4165 p-[20px] */
      background: #fff;             /* 40000909:4165 bg-white */
      border-radius: 6px;           /* 40000909:4165 rounded-[6px] */
      box-sizing: border-box;
    }

    /* the output text — 40000909:4168: Inter Medium 14px #171717, normal leading */
    .output-body {
      flex: 1 0 0;
      min-height: 0;
      width: 100%;
      overflow: auto;
      font-family: 'Inter', system-ui, sans-serif;  /* 40000909:4168 Inter:Medium */
      font-size: 14px;              /* 40000909:4168 text-[14px] */
      font-weight: 500;             /* 40000909:4168 font-medium */
      line-height: normal;          /* 40000909:4168 leading-[normal] */
      color: #171717;               /* 40000909:4168 text-[#171717] */
    }

    /* ── The §D5 placeholder strip ──────────────────────────────────────────
       NOT in the drawing. Four controls kept "left alone for now" by
       WHAT-THEY-BUILT-WHAT-WE-BUILT.md §D5, rendered in the body of the output
       area beneath the content — the region the drawing leaves empty — rather
       than inside output-vontrols, which has exactly two designed children.
       They keep the plain treatment they already had: restyling a placeholder
       would invent a design for it. */
    .canvas-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      width: 100%;
      margin-top: 12px;
      padding-top: 8px;
      border-top: 1px solid #e5e7eb;
      flex-shrink: 0;
    }
    .canvas-controls .meta {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      min-width: 0;
      font-size: 11px;
      color: #6b7280;
    }
    /* One row, as these four controls were before they moved — they are a
       placeholder, so their styling is carried over rather than re-invented. */
    .canvas-controls .actions {
      display: flex;
      align-items: center;
      flex-shrink: 0;
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
    /* raw view is not drawn in 40000914:4677; it keeps the pre-formatted
       treatment it already had, now sitting inside the drawn output area. */
    .raw {
      margin: 0;
      padding: 12px;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 6px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
      font-size: 13px;
      line-height: 1.5;
      white-space: pre-wrap;
    }

    /* ── vertical-tab-A ─────────────────────────────────────────────────────
       40001034:1035 (carries a left border — the one tabled in spec §3.11) and
       40001034:1775 (carries none). Both frames share data-name "vertical-tab-A"
       and differ in that one property, so the border is applied by class rather
       than by name. Both are 40px wide with a 5px 0 2px shadow. */
    .vertical-tab {
      display: flex;
      flex-direction: column;       /* flex-col */
      gap: 10px;                    /* gap-[10px] */
      align-items: center;          /* items-center */
      justify-content: center;      /* justify-center */
      width: 40px;
      height: 100%;
      background: #fff;             /* bg-white */
      box-shadow: 5px 0 2px rgba(0, 0, 0, 0.15);  /* drop-shadow-[5px_0px_2px_…] */
      box-sizing: border-box;
      flex-shrink: 0;
      overflow: hidden;
    }
    /* 40001034:1035 only — spec §3.11 / O5 */
    .vertical-tab.bordered { border-left: 1px solid #8b8b8b; }

    /* gripper — 40001034:1036 + 1044 (frame B), 1776 + 1784 (frame A), each a
       rotate-180 wrapper around the registry element <gripper-prompt-input>.
       The gripper's documented contract is the LEFT column's section reordering
       (component description 40000941:23074 — spec §5, O6); what it does in this
       column is not stated, so no handler is attached. Deliberately not marked as a
       behavior stub — see the note on _verticalTab for why marking is harmful. */
    .vt-gripper {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transform: rotate(180deg);
    }

    /* Every text run inside a vertical tab is -rotate-90: it reads bottom-to-top.
       vertical-rl plus rotate(180deg) is that rotation done with real text, so
       the glyphs stay upright and the run stays selectable. */
    .vt-run {
      writing-mode: vertical-rl;
      transform: rotate(180deg);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* vertical-tab-token-readout — 40001034:1038 + 1039 (B), 1778 + 1779 (A) */
    .vt-readout { flex-shrink: 0; display: flex; justify-content: center; width: 100%; }
    .vt-readout .vt-run {
      height: 197px;                /* 40001034:1039 h-[197px] */
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;              /* text-[12px] */
      font-weight: 600;             /* font-semibold (Inter:Semi_Bold) */
      line-height: 20px;            /* leading-[20px] */
      color: #767676;               /* text-[#767676] */
      text-align: right;            /* text-right */
    }

    /* vertical-tab-tab-description — 40001034:1040 + 1041 (B), 1780 + 1781 (A).
       This is the row that grows: flex-[1_0_0]. */
    .vt-description {
      flex: 1 0 0;
      min-height: 0;
      display: flex;
      justify-content: center;
      width: 100%;
    }
    .vt-description .vt-run {
      height: 169px;                /* 40001034:1041 h-[169px] */
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 16px;              /* text-[16px] */
      font-weight: 500;             /* font-medium (Inter:Medium) */
      line-height: normal;          /* leading-[normal] */
      color: #171717;               /* text-[#171717] */
    }

    /* horizontal-tab-label — 40001034:1042 + 1043 (B), 1782 + 1783 (A).
       whitespace-pre-wrap is load-bearing: the drawn literal carries TWO spaces
       between words ("Response  Format  A") and the node sets pre-wrap so they
       survive. Collapsing them would not be this design. */
    .vt-format { flex-shrink: 0; display: flex; justify-content: center; }
    .vt-format .vt-run {
      height: 169px;                /* 40001034:1043 h-[169px] */
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 16px;
      font-weight: 500;
      line-height: normal;
      color: #171717;
      white-space: pre-wrap;        /* 40001034:1043 whitespace-pre-wrap */
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
    .output-body::-webkit-scrollbar,
    .md::-webkit-scrollbar { width: 14px; }
    .output-body::-webkit-scrollbar-track,
    .md::-webkit-scrollbar-track { background: transparent; }
    .output-body::-webkit-scrollbar-thumb,
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

  /**
   * One vertical tab — the whole of a `vertical-tab-A` frame.
   *
   * The two frames are `40001034:1035` and `40001034:1775`. They share a
   * `data-name` and differ in exactly one drawn property: `1035` carries
   * `border-l: 1px solid #8b8b8b`, `1775` carries no border (spec §3.11/§3.12).
   * The border therefore arrives as an argument, not from the name — keying off
   * "vertical-tab-A" is what merges them.
   *
   * `1035` draws `Response  Format  B` and sits against the panel; `1775` draws
   * `Response  Format  A` and sits outside it (spec §1.2, O8).
   *
   * Neither frame's click behavior is drawn in 40000914:4677. They are labels in
   * the pull, so they render as labels and no handler is invented for them.
   *
   * DELIBERATE, do not "fix". catalog-check skips a component's unheard-event
   * findings when one marker string appears ANYWHERE in its source
   * (catalog-check.mjs, the event-unheard loop — a plain substring test). That
   * marker is TWO fragments: `TODO` and `(behavior)`. It is not written here, and
   * the two fragments must not be written adjacent — not even to talk about them.
   * Doing so also silences `copy-output` and `regenerate-requested`, which are
   * real open findings (OPEN-ITEMS.md `check:event-unheard`; AGENT_OPEN_GAPS.md
   * §event-unheard). The marker is per-event in intent, per-file in implementation.
   */
  private _verticalTab(format: 'A' | 'B', bordered: boolean) {
    // Child order is the drawn order: gripper, readout, description, label, gripper.
    return html`
      <div class="vertical-tab ${bordered ? 'bordered' : ''}">
        <span class="vt-gripper"><gripper-prompt-input></gripper-prompt-input></span>
        <!-- 40001034:1039 — the drawn literal is "Tokens: 2022 Cost: $0.00802 "
             (one space between the fields, one trailing space that HTML
             collapses; the spacing between the fields is the design). -->
        <div class="vt-readout">
          <span class="vt-run">Tokens: ${this.tokens || 0} Cost: $${this.cost}</span>
        </div>
        <!-- 40001034:1041 — literal "Figma designs" -->
        <div class="vt-description">
          <span class="vt-run">${this.outputDescription}</span>
        </div>
        <!-- 40001034:1043 / 40001034:1783 — literal "Response  Format  B"/"A",
             TWO spaces per gap, kept by white-space: pre-wrap. -->
        <div class="vt-format">
          <span class="vt-run">Response  Format  ${format}</span>
        </div>
        <span class="vt-gripper"><gripper-prompt-input></gripper-prompt-input></span>
      </div>
    `;
  }

  render() {
    /* output-vontrols — 40001034:1186. TWO children, exactly, as drawn: the
       selector tile and the model button. */
    const controls = html`
      <div class="controls">
        <button class="selector-tile" type="button" aria-haspopup="menu">
          <span class="output-type">${this.outputType}</span>
          <span class="chevron"><img src=${arrowDropDown} alt="" /></span>
        </button>
        <model-selector-button></model-selector-button>
      </div>
    `;

    // The progress indicator lives inline in the header meta row (above), in
    // the position the "running" pill used to occupy.
    const display = this.viewMode === 'raw'
      ? html`<pre class="raw">${this.content || '(no output yet)'}</pre>`
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

    /* The §D5 placeholder strip. It lives in the BODY of the output area,
       beneath the content — spec §4 — which is the region the drawing leaves
       empty. It is NOT inside output-vontrols, a frame with exactly two drawn
       children. These four controls are the same four that were here before:
       Rendered/Raw, Copy, Regenerate, Clear, kept "left alone for now" by §D5.
       AGENT_OPEN_GAPS.md §event-unheard still records that copy-output and
       regenerate-requested have no listener. */
    const canvasControls = html`
      <div class="canvas-controls">
        <div class="meta">
          <span>${this.model || '—'}</span>
          <span>${this.tokens || 0} tokens</span>
          ${this.isRunning
            ? html`<span class="progress" role="progressbar" aria-label="Running"
                    ><span class="progress-stripe"></span></span>
                  <span class="status running">Running… ${this.elapsed}s</span>`
            : this._finishedLine
              ? html`<span class="status">${this._finishedLine}</span>`
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

    /* The column: the panel, then the two vertical tabs. 451 + 40 + 40 = 531,
       which is the drawn width of 40000914:4677 (spec §1.2). The bordered tab
       (Format B, 40001034:1035) comes first because the table shows it against
       the panel — which is why it, and not the other, carries a LEFT border. */
    return html`
      <div class="panel">
        ${controls}
        <div class="output-area">
          <div class="output-body">${display}</div>
          ${canvasControls}
        </div>
      </div>
      ${this._verticalTab('B', true)}
      ${this._verticalTab('A', false)}
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