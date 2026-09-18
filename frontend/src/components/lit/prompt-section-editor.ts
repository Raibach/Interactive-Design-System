/**
 * <prompt-section-editor> — assembly host for the prompt-input pattern.
 *
 * Figma source (single source of truth): READ-ME/PROMPT_INPUT_SECTION_SPEC.md
 *   - Container: node 40000746-6  → <prompt-container>
 *   - Section:   node 40000746-94 → <prompt-input-section> (composed of
 *     <gripper-prompt-input>, <role-tile>, functions, <status-bar-prompt-input>,
 *     <prompt-textarea> — individually named Lit components per the designer's
 *     Figma layers, registered in tag-registry.ts + component-catalog.json).
 *
 * DESIGN IS SKIN. CRUD IS STRUCTURE. This file owns ONLY the data flow:
 *   - Properties: sections (array) · session-id · is-running   (unchanged)
 *   - Emits: section-update · section-add · section-remove · section-reorder
 *     (canonical events consumed by WritingAreaIndex → /api/ai/save-surface
 *      → PostgreSQL → Zilliz — unchanged contract)
 *   - Window events consumed: set-left-column-text · force-set-section ·
 *     fill-field · add-prompt-role · remove-prompt-role · a2ui:usage
 *
 * A WRITE THAT LANDS NOWHERE IS REPORTED. Both text events name a seat, and both used
 * to compare that name to each section's name EXACTLY: a write addressed to the "User
 * Role" fell through against a repair prompt, whose seats are named "System" / "User" /
 * "Tool Call" / "Agent", and nothing was said about it — the column simply did not
 * change. The names are now resolved through @/shared/promptSections (label, id, and the
 * short legacy names are one seat), and a request the column cannot honour dispatches
 * `section-write-failed` with the seats it DOES have, so the chat can say so.
 *
 * `fill-field` is the same write, one level finer: a value that goes under ONE field's
 * label inside a named section — what a button in the chat presses. The field's text is
 * read and rewritten by @/shared/repairMaterial (`writeFieldValue`), the same module that
 * wrote it, so a value filed by hand and a value filed by a button are the same text.
 *
 * The format rail is NAMED, and its numbers are measured. The name is the panel's own (see
 * RAIL_LABEL — the design's text at the rail's label), and the line under it is the spend
 * the backend reported through `a2ui:usage`. Before any call there is no spend to report, so
 * that line is absent rather than invented — but the rail still says WHICH column it is,
 * which a bare strip with two grippers could not.
 *
 * Designer rules: System Role is sticky (first, never changes — no menu, no
 * drag, no delete); Arrow_drop_down opens/closes the selection menu (types +
 * "+ Add Section" + "Delete"); selecting a type updates the label; drag is
 * anchored to the gripper only; role-tile click collapses/expands the body.
 */
import { LitElement, html, css } from 'lit';
import './prompt-input/prompt-container';
import './prompt-input/prompt-input-section';
import { TYPE_LABELS, SECTION_MENU_TYPES } from './prompt-input/prompt-input-section';
import { normalizeSectionType, resolveSectionName } from '@/shared/promptSections';
import { writeFieldValue } from '@/shared/repairMaterial';

export interface PromptSection {
  name: string;
  content: string;
  type?: string;
  position?: number;
  visible?: boolean;
}

/**
 * WHAT THE FORMAT RAIL IS CALLED, written down its edge when the column is docked.
 *
 * THE DESIGN'S OWN WORDS at the rail's label (40000954:23869, "Agent Prompt" — Inter 500,
 * 16px, #171717), and the same node the rail's measurements were taken from. It was the
 * last LLM call's `mode` before, read from `a2ui:usage` — which meant a docked column
 * showed a bare strip with two grippers and no way to tell which column it was until
 * something had run, and nothing at all after a reload. A NAME is not a readout: the
 * design writes the panel's name here, and the next line carries the measured numbers.
 */
const RAIL_LABEL = 'Agent Prompt';

class PromptSectionEditor extends LitElement {
  static properties = {
    sessionId: { type: String, attribute: 'session-id' },
    /**
     * DECLARED, or the surface can never fill it. `sections` is a hand-written
     * accessor (see below), so Lit must not generate one — hence noAccessor — but the
     * declaration itself is what lets the payload reach this element at all.
     *
     * Both gates read `static properties`: the renderer's assignProps SKIPS any prop
     * the element does not declare (it warns to the console and carries on), and Lit's
     * own reactive check does the same. Without this line the surface's
     * `{"sections": {"path": "/session/left_column/sections"}}` was dropped on every
     * assignment — the model on screen held a package's four sections, one with 5,094
     * characters, and this element drew the three empty seats it seeds for itself.
     * Every saved package looked blank, and the only trace was a console warning.
     *
     * Measured 2026-09-17: /api/ai/assemble-surface render-session for
     * ef306805-defd-4f71-8e1c-ec2bba58d1e4 returned 4 sections (5,948 chars in
     * Postgres, version 1) and the editor drew 3 empty rows.
     */
    sections: { type: Array, noAccessor: true },
    isRunning: { type: Boolean, attribute: 'is-running' },
  };

  // sections is set imperatively (property, not attribute) by the React host
  private _sections: PromptSection[] = [];
  private _sessionId: string | null = null;
  private _isRunning = false;
  private _menu: { idx: number | null; kind: 'types' | 'functions' } = { idx: null, kind: 'types' };
  private _collapsed = new Set<number>();
  private _dragIndex: number | null = null;
  private _listenersBound = false;
  /**
   * The spend, as the backend measured it. `_countedCalls` is keyed on the
   * backend's `call_id` so a surface that gets applied twice cannot inflate the
   * total — the same guard the Console's tally uses.
   */
  private _countedCalls = new Set<number>();
  private _totalTokens = 0;
  private _calls = 0;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: #ffffff;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .sections-scroll {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      /* No TOP inset — the pane's title sits directly above, so a top pad here
         just reads as an empty band above the first prompt. The 15px between
         sections comes from each section's own bottom padding. */
      padding: 0 3px 15px;
      /* flex column so <prompt-container> can stretch down and snap its bottom
         edge to the bottom of the column. The sections inside it still hug. */
      display: flex;
      flex-direction: column;
    }
    .sections-scroll::-webkit-scrollbar { width: 14px; }
    .sections-scroll::-webkit-scrollbar-track { background: transparent; }
    .sections-scroll::-webkit-scrollbar-thumb { background: #dadee4; border-radius: 10px; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._bindOnce();
  }

  // External data ingestion (React host / AI) — canonical normalization
  set sections(value: unknown) {
    if (Array.isArray(value)) {
      const next = value.map((s: any) => this._normalizeSection(s));
      /*
       * IDENTICAL CONTENT IN, NOTHING OUT. This is the return leg of the Read/Write
       * contract (Handling-User-Actions.md): the host writes the model as the person
       * types, the model comes back here as a `sections` assignment, and without this
       * guard that round trip CLEARS the collapse state, resets the open menu and
       * re-renders the whole editor — on every keystroke. The textarea owns the caret;
       * a re-render mid-typing is how a person loses their place.
       *
       * Compared by name and content, which is all the two copies can differ by when the
       * host is echoing back what this element just reported.
       */
      const same = next.length === this._sections.length
        && next.every((s, i) => s.name === this._sections[i].name
          && s.content === this._sections[i].content);
      if (same) return;
      this._sections = next;
    } else {
      this._sections = [];
    }
    this._collapsed.clear();
    this._menu.idx = null;
    this.requestUpdate();
  }

  get sections(): PromptSection[] {
    return [...this._sections];
  }

  set sessionId(val: string | null) {
    this._sessionId = val;
    if (val) this.setAttribute('session-id', val);
    else this.removeAttribute('session-id');
  }
  get sessionId() { return this._sessionId; }

  set isRunning(val: boolean) {
    this._isRunning = !!val;
    if (val) this.setAttribute('is-running', '');
    else this.removeAttribute('is-running');
  }
  get isRunning() { return this._isRunning; }

  private _normalizeSection(s: any): PromptSection {
    if (!s || typeof s !== 'object') return { name: 'Section', content: '' };
    // Any spelling the server or an older save carries comes back canonical.
    // A value with no seat yet is preserved rather than guessed — see UNDECIDED
    // in @/shared/promptSections.
    const type = normalizeSectionType(s.type || s.role || 'custom');
    return {
      name: s.name || s.section || s.role || type,
      content: s.content || '',
      type,
      position: typeof s.position === 'number' ? s.position : undefined,
      visible: s.visible !== false,
    };
  }

  private _isSystem(s: PromptSection | undefined): boolean {
    // Identity, not a substring. This was `.includes('system')`, which is true of
    // `system-role` by luck and of "Systematic Review" by accident.
    return !!s && normalizeSectionType(s.type) === 'system-role';
  }

  private _bindOnce() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    // Seed the SEATS the design draws — System Role, User Role, Agent Role — and
    // NOTHING ELSE. The order matches the Figma container (node 40000746-6).
    //
    // The System seat used to be seeded with a sentence: "You are an expert in semantic
    // design systems and A2UI protocol." Nothing else in this repository contains that
    // string — not the database, not the assembler, not a prompt. It was invented here,
    // and it was drawn in the same place and the same style as a package's own content.
    // Measured 2026-09-17: opening a saved package whose System row is empty showed that
    // sentence, so a package's contents could not be told apart from this element's
    // filler. An empty seat is a state; a sentence nobody wrote is a fabrication.
    //
    // Types are the CANONICAL ids from @/shared/promptSections, not the short forms this
    // used to write ('system' / 'user' / 'agent'). Those matched nothing in the schema
    // enum, and `agent` had no seat there at all. The labels — and so the wire format,
    // which the Run path keys on — are unchanged.
    if (this._sections.length === 0) {
      this._sections = [
        { name: 'System Role', content: '', type: 'system-role' },
        { name: 'User Role', content: '', type: 'user-role' },
        { name: 'Agent Role', content: '', type: 'agent-role' },
      ];
    }

    const on = <T extends Event>(type: string, fn: (e: T) => void) =>
      this.addEventListener(type, fn as EventListener);

    on<CustomEvent>('section-content-input', (e) => {
      const idx = this._indexOfSectionEvent(e);
      if (idx < 0) return;
      this._sections[idx] = { ...this._sections[idx], content: (e.detail as { value: string }).value };
      this._emitUpdate(idx); // no re-render — the textarea owns its caret
    });

    on<CustomEvent>('section-collapse-toggle', (e) => {
      const idx = this._indexOfSectionEvent(e);
      if (idx < 0) return;
      if (this._collapsed.has(idx)) this._collapsed.delete(idx);
      else this._collapsed.add(idx);
      const host = this._sectionHost(e);
      if (this._collapsed.has(idx)) host.setAttribute('collapsed', '');
      else host.removeAttribute('collapsed');
    });

    on<CustomEvent>('section-menu-select', (e) => {
      const idx = this._indexOfSectionEvent(e);
      if (idx < 0) return;
      const { action, value } = (e.detail || {}) as { action: string; value?: string };
      this._menu.idx = null;

      if (action === 'type' && value) {
        const label = TYPE_LABELS[value] || value; // label updates automatically
        this._sections[idx] = { ...this._sections[idx], type: value, name: label };
        this._emitUpdate(idx);
        this.requestUpdate();
      } else if (action === 'add') {
        this._addSection();
      } else if (action === 'delete') {
        this._removeSection(idx);
      } else if (action === 'tool' && value) {
        const prev = this._sections[idx].content || '';
        this._sections[idx] = { ...this._sections[idx], content: prev ? `${prev} ${value}` : value };
        this._emitUpdate(idx);
        this.requestUpdate();
      }
    });

    // Window event surface — unchanged contract (AI can drive the editor)
    window.addEventListener('set-left-column-text', this._onSetText as EventListener);
    window.addEventListener('force-set-section', this._onForceSet as EventListener);
    window.addEventListener('fill-field', this._onFillField as EventListener);
    window.addEventListener('add-prompt-role', this._onAddRole as EventListener);
    window.addEventListener('remove-prompt-role', this._onRemoveRole as EventListener);
    // The rail title is where we are now — the last call.
    window.addEventListener('a2ui:usage', this._onUsage as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('set-left-column-text', this._onSetText as EventListener);
    window.removeEventListener('force-set-section', this._onForceSet as EventListener);
    window.removeEventListener('fill-field', this._onFillField as EventListener);
    window.removeEventListener('add-prompt-role', this._onAddRole as EventListener);
    window.removeEventListener('remove-prompt-role', this._onRemoveRole as EventListener);
    window.removeEventListener('a2ui:usage', this._onUsage as EventListener);
    super.disconnectedCallback();
  }

  private _indexOfSectionEvent(e: CustomEvent): number {
    const idxAttr = this._sectionHost(e).getAttribute('data-idx');
    return idxAttr !== null ? parseInt(idxAttr, 10) : -1;
  }

  /**
   * The <prompt-input-section> that originally dispatched a composed event.
   * Shadow DOM retargeting rewrites `e.target` to the nearest shadow host
   * (prompt-container, then prompt-section-editor), so `e.target` loses the
   * `data-idx` attribute. `composedPath()[0]` is always the real dispatcher.
   */
  private _sectionHost(e: CustomEvent): HTMLElement {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    return (path.length ? path[0] : e.target) as HTMLElement;
  }

  private _emitUpdate(index: number) {
    this.dispatchEvent(new CustomEvent('section-update', {
      bubbles: true, composed: true,
      detail: { index, section: this._sections[index] },
    }));
  }

  private _addSection() {
    // `type: 'custom'` has no seat in the schema enum and no twin in the menu
    // (the tile is "Custom Data" / `custom-data`) — it is listed in UNDECIDED in
    // @/shared/promptSections. Left as-is deliberately: the value is preserved
    // rather than quietly mapped onto a seat nobody has agreed it is.
    const newSection: PromptSection = {
      name: `Custom Role ${this._sections.length + 1}`,
      content: '', type: 'custom', position: this._sections.length,
    };
    this._sections.push(newSection);
    this.dispatchEvent(new CustomEvent('section-add', {
      bubbles: true, composed: true, detail: { section: newSection },
    }));
    this.requestUpdate();
  }

  private _removeSection(index: number) {
    const removed = this._sections[index];
    if (!removed) return;
    if (index === 0 && this._isSystem(removed)) return; // System Role is sticky
    this._sections.splice(index, 1);
    this.dispatchEvent(new CustomEvent('section-remove', {
      bubbles: true, composed: true, detail: { index, name: removed.name },
    }));
    this.requestUpdate();
  }

  private _moveSection(from: number, to: number) {
    if (from < 0 || to < 0 || from >= this._sections.length || to >= this._sections.length) return;
    if (this._isSystem(this._sections[0]) && (from === 0 || to === 0)) return; // sticky slot 0
    const [item] = this._sections.splice(from, 1);
    this._sections.splice(to, 0, item);
    this.dispatchEvent(new CustomEvent('section-reorder', {
      bubbles: true, composed: true, detail: { from, to },
    }));
    this.requestUpdate();
  }

  // ── AI / external event surface (unchanged) ────────────────────────────────

  /**
   * The section a name refers to, or -1. The three spellings of one seat are declared
   * in @/shared/promptSections (`resolveSectionName`) rather than compared here, where
   * the comparison used to be an exact string match and a repair prompt's shorter names
   * silently missed.
   */
  private _indexOfNamed(section: string): number {
    return resolveSectionName(section, this._sections.map((s) => s.name));
  }

  /**
   * A write the column could not place. Said out loud, with the seats that DO exist:
   * a request that lands nowhere is a request the person watched do nothing, and the
   * silence is what made this surface feel out of reach. The chat listens and reports.
   */
  private _writeFailed(target: string, why: string) {
    this.dispatchEvent(new CustomEvent('section-write-failed', {
      bubbles: true,
      composed: true,
      detail: { target, why, names: this._sections.map((s) => s.name) },
    }));
  }

  private _onSetText = (e: Event) => {
    const { content, target } = (e as CustomEvent).detail || {};
    if (!target || content === undefined) return;
    const idx = this._indexOfNamed(String(target));
    if (idx < 0) {
      this._writeFailed(String(target), 'no section by that name');
      return;
    }
    this._sections[idx] = { ...this._sections[idx], content };
    this._emitUpdate(idx);
    this.requestUpdate();
  };

  private _onForceSet = (e: Event) => {
    const { sectionName, content } = (e as CustomEvent).detail || {};
    if (!sectionName || content === undefined) return;
    const idx = this._indexOfNamed(String(sectionName));
    if (idx < 0) {
      this._writeFailed(String(sectionName), 'no section by that name');
      return;
    }
    this._sections[idx] = { ...this._sections[idx], content };
    this._emitUpdate(idx);
    this.requestUpdate();
  };

  /**
   * One value, under one field's label, in one named section — the write a chat button
   * makes. `writeFieldValue` returns null when the text holds no such field, and that is
   * reported rather than swallowed: a button that says "written" must not be able to lie.
   */
  private _onFillField = (e: Event) => {
    const { section, field, value } = (e as CustomEvent).detail || {};
    if (!section || !field || value === undefined) return;
    const idx = this._indexOfNamed(String(section));
    if (idx < 0) {
      this._writeFailed(String(section), 'no section by that name');
      return;
    }
    const next = writeFieldValue(this._sections[idx].content || '', String(field), String(value));
    if (next === null) {
      this._writeFailed(String(section), `no field named ${field}`);
      return;
    }
    this._sections[idx] = { ...this._sections[idx], content: next };
    this._emitUpdate(idx);
    this.requestUpdate();
  };

  private _onAddRole = (e: Event) => {
    const { roleName, placeholder } = (e as CustomEvent).detail || {};
    if (!roleName) return;
    const newSec: PromptSection = { name: roleName, content: placeholder || '', type: roleName, position: this._sections.length };
    this._sections.push(newSec);
    this.dispatchEvent(new CustomEvent('section-add', { bubbles: true, composed: true, detail: { section: newSec } }));
    this.requestUpdate();
  };

  private _onRemoveRole = (e: Event) => {
    const { roleName } = (e as CustomEvent).detail || {};
    if (!roleName) return;
    const idx = this._sections.findIndex(s => s.name === roleName);
    if (idx >= 0) this._removeSection(idx);
  };

  /**
   * `a2ui:usage` carries the provider's own measured usage for the last call, and the rail
   * reports the running spend. The call's `mode` is NOT the rail's title — the rail is
   * named (see RAIL_LABEL) — so only the numbers are read here.
   */
  private _onUsage = (e: Event) => {
    const detail = (e as CustomEvent).detail || {};

    // Strictly scoped to this rail's own conversation. A call's spend belongs to
    // the session it came from, so another conversation's call must not change
    // the title here — the contract scopes the panel to its conversationId.
    // An unscoped rail (the sandbox) still takes whatever arrives.
    if (this._sessionId && detail.sessionId !== this._sessionId) return;

    // The tally first. This has to run for EVERY call, including one that
    // repeats the previous mode — an early return on an unchanged title is
    // exactly how a running total silently stops adding up.
    const total = detail.total_tokens;
    if (typeof total === 'number') {
      if (typeof detail.call_id === 'number') {
        if (this._countedCalls.has(detail.call_id)) return; // already counted
        this._countedCalls.add(detail.call_id);
      }
      this._totalTokens += total;
      this._calls += 1;
    }

    this.requestUpdate();
  };

  /**
   * What the rail reports beneath the title.
   *
   * Measured, never estimated — the same rule the Console's tally follows.
   * There is no cost in the provider's payload, so none is shown: an invented
   * price above a real action is worse than no price. Before any call there is
   * nothing to report, so it stays empty rather than printing a placeholder.
   */
  private get _tokensLabel(): string {
    if (this._calls === 0) return '';
    const tokens = this._totalTokens.toLocaleString();
    return `Tokens: ${tokens} · ${this._calls} ${this._calls === 1 ? 'call' : 'calls'}`;
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  render() {
    const sectionsHtml = this._sections.map((sec, i) => {
      const sticky = i === 0 && this._isSystem(sec);
      const isRag = String(sec.type).toLowerCase().includes('context')
        || /\{\{\s*(retrieved_context|query|context)\s*\}\}/.test(sec.content || '');
      // Design receipt: textarea min-heights 45 / 145 / 120 by role family
      const minHeight = String(sec.type).toLowerCase().includes('system') ? 45 : isRag ? 145 : 45;
      const menuOpen = this._menu.idx === i ? this._menu.kind : '';

      return html`
        <prompt-input-section
          data-idx="${i}"
          data-section-container
          data-section-name="${sec.name}"
          .name=${sticky ? 'System Role' : (TYPE_LABELS[String(sec.type || '').toLowerCase()] || sec.name)}
          .type=${String(sec.type || 'custom')}
          .content=${sec.content || ''}
          .sticky=${sticky}
          .minHeight=${minHeight}
          .menuOpen=${menuOpen}
          ?collapsed=${this._collapsed.has(i)}
          ?draggable=${!sticky}
          @dragstart=${(ev: DragEvent) => this._onDragStart(ev, i)}
          @dragover=${(ev: DragEvent) => ev.preventDefault()}
          @drop=${(ev: DragEvent) => this._onDrop(ev, i)}
        ></prompt-input-section>
      `;
    });

    return html`
      <div class="sections-scroll">
        <prompt-container
          format-label=${RAIL_LABEL}
          tokens-label=${this._tokensLabel}
        >
          ${sectionsHtml}
        </prompt-container>
      </div>
    `;
  }

  private _onDragStart(ev: DragEvent, i: number) {
    this._dragIndex = i;
    ev.dataTransfer?.setData('text/plain', String(i));
  }

  private _onDrop(ev: DragEvent, i: number) {
    ev.preventDefault();
    const fromStr = ev.dataTransfer?.getData('text/plain');
    const from = fromStr !== undefined && fromStr !== '' ? parseInt(fromStr, 10) : this._dragIndex;
    if (from != null && from !== i) this._moveSection(from, i);
    this._dragIndex = null;
  }
}

customElements.define('prompt-section-editor', PromptSectionEditor);

declare global {
  interface HTMLElementTagNameMap {
    'prompt-section-editor': PromptSectionEditor;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'prompt-section-editor': React.DetailedHTMLProps<
        React.HTMLAttributes<PromptSectionEditor> & {
          sections?: any;
          'session-id'?: string;
          'is-running'?: '' | boolean;
        },
        PromptSectionEditor
      >;
    }
  }
}

// Re-export for downstream typing (menu types are the designer's vocabulary)
export { SECTION_MENU_TYPES, TYPE_LABELS };
