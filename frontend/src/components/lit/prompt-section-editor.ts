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
 *     add-prompt-role · remove-prompt-role · a2ui:usage        (unchanged)
 *
 * The format rail's TITLE is the last call — whatever `mode` the most recent LLM
 * call reported through `a2ui:usage`. It is read from that event, never fixed
 * here: it names where the workspace IS right now, which is simply the last thing
 * that ran. Before any call there is no last call, so the title stays empty
 * rather than inventing one.
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

export interface PromptSection {
  name: string;
  content: string;
  type?: string;
  position?: number;
  visible?: boolean;
}

class PromptSectionEditor extends LitElement {
  static properties = {
    sessionId: { type: String, attribute: 'session-id' },
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
  /** Mode of the most recent LLM call — the rail title. '' until a call lands. */
  private _lastCallMode = '';

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
      this._sections = value.map((s: any) => this._normalizeSection(s));
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
    const type = s.type || s.role || 'custom';
    return {
      name: s.name || s.section || s.role || type,
      content: s.content || '',
      type,
      position: typeof s.position === 'number' ? s.position : undefined,
      visible: s.visible !== false,
    };
  }

  private _isSystem(s: PromptSection | undefined): boolean {
    return !!s && String(s.type || '').toLowerCase().includes('system');
  }

  private _bindOnce() {
    if (this._listenersBound) return;
    this._listenersBound = true;

    // Seed default sections so the left column is never empty.
    // Order matches the Figma container (node 40000746-6): System Role,
    // User Role, Agent Role — no invented sections.
    if (this._sections.length === 0) {
      this._sections = [
        { name: 'System Role', content: 'You are an expert in semantic design systems and A2UI protocol.', type: 'system' },
        { name: 'User Role', content: '', type: 'user' },
        { name: 'Agent Role', content: '', type: 'agent' },
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
    window.addEventListener('add-prompt-role', this._onAddRole as EventListener);
    window.addEventListener('remove-prompt-role', this._onRemoveRole as EventListener);
    // The rail title is where we are now — the last call.
    window.addEventListener('a2ui:usage', this._onUsage as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('set-left-column-text', this._onSetText as EventListener);
    window.removeEventListener('force-set-section', this._onForceSet as EventListener);
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

  private _onSetText = (e: Event) => {
    const { content, target } = (e as CustomEvent).detail || {};
    if (!target || content === undefined) return;
    const idx = this._sections.findIndex(s => s.name.toLowerCase() === String(target).toLowerCase());
    if (idx >= 0) {
      this._sections[idx] = { ...this._sections[idx], content };
      this._emitUpdate(idx);
      this.requestUpdate();
    }
  };

  private _onForceSet = (e: Event) => {
    const { sectionName, content } = (e as CustomEvent).detail || {};
    if (!sectionName || content === undefined) return;
    const idx = this._sections.findIndex(s => s.name === sectionName);
    if (idx >= 0) {
      this._sections[idx] = { ...this._sections[idx], content };
      this._emitUpdate(idx);
      this.requestUpdate();
    }
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
   * `a2ui:usage` carries the provider's own measured usage for the last call.
   * Its `mode` is the rail title: a person needs to know where they are, not
   * what the call did internally — the last call IS the header.
   */
  private _onUsage = (e: Event) => {
    const detail = (e as CustomEvent).detail || {};

    // Strictly scoped to this rail's own conversation. A call's spend belongs to
    // the session it came from, so another conversation's call must not change
    // the title here — the contract scopes the panel to its conversationId.
    // An unscoped rail (the sandbox) still takes whatever arrives.
    if (this._sessionId && detail.sessionId !== this._sessionId) return;

    const mode = detail.mode;
    if (typeof mode !== 'string' || !mode || mode === this._lastCallMode) return;
    this._lastCallMode = mode;
    this.requestUpdate();
  };

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
          format-label=${this._lastCallMode}
          tokens-label="Tokens: 2022 Cost: $0.00802"
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
