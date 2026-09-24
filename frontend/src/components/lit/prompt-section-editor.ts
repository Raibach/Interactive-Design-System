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
import { normalizeSectionType, resolveSectionName, SECTION_TYPES, isUndecidedType } from '@/shared/promptSections';
import { writeFieldValue } from '@/shared/repairMaterial';
import { withTrigger } from '@/shared/triggers';
import { API_BASE } from '@/shared/apiHelper';

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

/**
 * THE SECTION A TOOL BELONGS TO WHEN NOTHING ELSE IS SAID.
 *
 * Tool Call is the seat that was always shared — the one the schema has carried
 * longest and the one a tool that reaches outward naturally lands in. A tool row
 * whose `sections` is empty is treated as belonging here rather than to nothing,
 * because a tool that appears nowhere is a tool nobody can reach.
 */
const DEFAULT_TOOL_SECTION = 'tool-call';

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
  /**
   * THE TOOLS THE SERVER OFFERS, in the shape the menu draws.
   *
   * Held here rather than fetched per section, because every section's functions
   * menu offers the same list and there may be eight sections on screen. Fetched
   * once when this editor connects and again after a tool is added, so the menu
   * reflects the table rather than a snapshot taken at build time.
   *
   * `undefined` means the server has not answered yet, which is a different thing
   * from an empty list and is drawn differently.
   */
  private _tools: Array<{ name: string; token: string; sections: string[] }> | undefined = undefined;

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
    void this._loadTools();
  }

  /**
   * ASK THE SERVER WHAT TOOLS THERE ARE.
   *
   * The list is a table row set, not a constant, so it is fetched rather than
   * compiled in — a tool added on the tools screen is in the menu on the next
   * open without a rebuild. A failure leaves `_tools` undefined and the menu
   * draws the wireframe's example; it does not announce itself here, because
   * the tools screen is where an unreadable table is worth reporting and this
   * is only the menu.
   */
  private async _loadTools(): Promise<void> {
    try {
      const res = await fetch(`${API_BASE}/ai/tools`);
      if (!res.ok) return;
      const body = await res.json();
      const rows = Array.isArray(body?.tools) ? body.tools : [];
      // `sections` is carried with each tool because the menu is drawn per
      // section: a section offers the tools that name it, and the ones that
      // belong everywhere. Fetching once and filtering per section keeps this
      // one request however many sections are on screen.
      this._tools = rows.map((t: { name: string; sections?: string[]; summary?: string }) => ({
        name: t.name,
        token: `{{tool:${t.name}}}`,
        sections: Array.isArray(t.sections) ? t.sections : [DEFAULT_TOOL_SECTION],
        // Carried so the menu can say what a tool is for. It is the same one line
        // the prompts carry and the same one the tools screen shows, so a person
        // reading it in three places is reading one sentence.
        summary: String(t.summary ?? ''),
      }));
      this.requestUpdate();
    } catch {
      // Left undefined on purpose: the fallback is drawn, and the reason a real
      // list is missing belongs on the tools screen rather than in this menu.
    }
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
       * TYPE IS COMPARED TOO, and it was the one field left out. The comment above
       * used to say name and content are "all the two copies can differ by" — but a
       * seat's type is a third thing a copy can carry, and changing it leaves the name
       * and the text alone. So a host echoing back the OLD type read as identical here
       * too, and the two guards agreed the seat had never changed: measured, a seat set
       * to `constraints` came back as `agent-role` on the next model-driven render.
       */
      const shape = (s: { type?: string; name?: string; content?: string }) =>
        `${s.type ?? ''}\u0000${s.name ?? ''}\u0000${s.content ?? ''}`;
      const same = next.length === this._sections.length
        && next.every((s, i) => shape(s) === shape(this._sections[i]));
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
        this._sayWhatTheSeatIsFor(value, label);
      } else if (action === 'add') {
        this._addSection();
      } else if (action === 'delete') {
        this._removeSection(idx);
      } else if (action === 'tool' && value) {
        void this._insertTool(idx, String(value));
      } else if (action === 'trigger' && value) {
        this._setTrigger(idx, String(value));
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
    /*
     * A BUTTON THAT EDITS THE PROMPT RATHER THAN ASKING ABOUT IT.
     *
     * `a2ui:write-seat` arrives when a chat button carried a `write-seat` action —
     * "add these rules to Constraints". It is dispatched by the chat panel instead
     * of being sent to the model, because the answer to it is a change to the
     * prompt, not a sentence. This element owns `_sections`, so this is the only
     * place that can make the change.
     */
    window.addEventListener('a2ui:write-seat', this._onWriteSeat as EventListener);
    /*
     * A TOOL, INSERTED BY ANYONE — the chat's `write-tool` button, and her tag.
     *
     * The seat's Functions / Tools menu has always been able to put a tool in, and it was the
     * ONLY way: the insertion lived inside `section-menu-select`'s own branch, so nothing but a
     * click on that menu could reach `_insertTool`. Measured 2026-09-23, on the assistant saying
     * a prompt had no tool and offering to add one: she had no path to it at all, so the offer
     * could not be kept — the prompt kept saying "search the news" with nothing named to do it.
     *
     * The name goes to the register and the seat gets the register's own text, which is the same
     * thing the menu writes. A name no row answers is reported, and nothing is written.
     */
    window.addEventListener('insert-tool', this._onInsertTool as EventListener);
    /*
     * TWO ROWS FOR ONE STEP, PUT BACK TOGETHER — the repair for the mistake a person makes by
     * typing. The assistant offers it; this performs it.
     *
     * THE WORDS ARE NOT RETYPED. She could clear a duplicate herself with a write and a removal,
     * and that route goes through a model: a 400-character identity comes back as 380 characters
     * of almost the same sentence. The person's text is theirs, so the move happens here, on the
     * strings, and both halves arrive exactly as they were typed.
     */
    window.addEventListener('merge-seat', this._onMergeSeat as EventListener);
    // A TOOL, MOVED TO THE STEP IT BELONGS IN — the repair she offers and could not perform.
    window.addEventListener('move-tool', this._onMoveTool as EventListener);
  }

  disconnectedCallback() {
    window.removeEventListener('set-left-column-text', this._onSetText as EventListener);
    window.removeEventListener('force-set-section', this._onForceSet as EventListener);
    window.removeEventListener('fill-field', this._onFillField as EventListener);
    window.removeEventListener('add-prompt-role', this._onAddRole as EventListener);
    window.removeEventListener('remove-prompt-role', this._onRemoveRole as EventListener);
    window.removeEventListener('a2ui:usage', this._onUsage as EventListener);
    window.removeEventListener('a2ui:write-seat', this._onWriteSeat as EventListener);
    window.removeEventListener('insert-tool', this._onInsertTool as EventListener);
    window.removeEventListener('merge-seat', this._onMergeSeat as EventListener);
    window.removeEventListener('move-tool', this._onMoveTool as EventListener);
    super.disconnectedCallback();
  }

  private _indexOfSectionEvent(e: CustomEvent): number {
    const idxAttr = this._sectionHost(e).getAttribute('data-idx');
    return idxAttr !== null ? parseInt(idxAttr, 10) : -1;
  }

  /**
   * The <prompt-input-section> that originally dispatched a composed event.
   *
   * Shadow DOM retargeting rewrites `e.target` to the nearest shadow host
   * (prompt-container, then prompt-section-editor), so `e.target` loses the
   * `data-idx` attribute — which is why this walks the composed path at all.
   *
   * BUT THE FIRST ENTRY IN THE PATH IS NOT THE SECTION. It is whatever actually
   * dispatched: a `<prompt-textarea>`, a `<role-tile>`'s arrow, or one of the
   * seat menu's `<button>`s. None of those carries `data-idx`, so reading the
   * attribute off `composedPath()[0]` returned null and every one of these
   * handlers took its `idx < 0` branch and returned. The seat menu looked alive —
   * the tile highlighted, the menu closed — and changed nothing: measured, the
   * model stayed `user-role` after choosing Constraints.
   *
   * So the path is searched instead of sampled: the section is the first node in
   * it that carries the index.
   */
  private _sectionHost(e: CustomEvent): HTMLElement {
    const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
    for (const node of path) {
      const el = node as HTMLElement | undefined;
      if (typeof el?.getAttribute === 'function' && el.hasAttribute('data-idx')) return el;
    }
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

  /**
   * THE SEAT A NAME REFERS TO — MADE, IF THIS PROMPT DOES NOT HAVE IT YET.
   *
   * A write used to land only in a seat that already existed on screen. Everything else was
   * refused, and the refusal was invisible (see `_writeFailed`), so the assistant could answer
   * "Done — I've added that constraint" over a prompt with no Constraints row, the tag gone
   * from her prose and nothing anywhere to show for it. The owner, 2026-09-23: "she should be
   * able to insert a section right into the prompt."
   *
   * AND THIS IS THE PERSON'S OWN PATH, not a second one invented for her. Making a row by hand
   * means choosing Custom in the seat menu — which writes a row with type 'custom' and a
   * generic name — and then renaming it to what you wanted. That is what this makes, with the
   * name already right: the same kind of row, findable by that name on the next write because
   * `_indexOfNamed` matches on names.
   *
   * A NAME THAT IS ONE OF THE DECLARED SEATS GETS THAT SEAT. "Add this to Constraints" makes a
   * Constraints row — label and type from the declaration, not from her spelling of it — so the
   * row reads exactly like one the menu makes and the diagram can name it.
   */
  private _seatFor(name: string, initialContent: string): number {
    const idx = this._indexOfNamed(name);
    if (idx >= 0) return idx;

    const seat = SECTION_TYPES.find((s) => s.id === normalizeSectionType(name));
    const created: PromptSection = seat
      ? { name: seat.label, type: seat.id, content: initialContent, position: this._sections.length }
      : { name: name.trim(), type: 'custom', content: initialContent, position: this._sections.length };
    this._sections.push(created);
    this.dispatchEvent(new CustomEvent('section-add', {
      bubbles: true, composed: true, detail: { section: created },
    }));
    this.requestUpdate();
    return this._sections.length - 1;
  }

  private _onSetText = (e: Event) => {
    const { content, target } = (e as CustomEvent).detail || {};
    if (!target || content === undefined) return;
    const idx = this._seatFor(String(target), String(content));
    this._sections[idx] = { ...this._sections[idx], content };
    this._emitUpdate(idx);
    this.requestUpdate();
  };

  private _onForceSet = (e: Event) => {
    const { sectionName, content } = (e as CustomEvent).detail || {};
    if (!sectionName || content === undefined) return;
    const idx = this._seatFor(String(sectionName), String(content));
    this._sections[idx] = { ...this._sections[idx], content };
    this._emitUpdate(idx);
    this.requestUpdate();
  };

  /**
   * One value, under one field's label, in one named section — the write a chat button
   * makes. `writeFieldValue` returns null when the text holds no such field, and that is
   * reported rather than swallowed: a button that says "written" must not be able to lie.
   *
   * A SEAT THAT IS NOT THERE IS NOT MADE HERE, and that is not the same rule as `_seatFor`.
   * A field is a LABEL INSIDE a row's text, so filling one into a row that has no such line is
   * not a write at all — there is nothing to put the value under. It is reported, and the
   * report now has somewhere to land (see the chat's `section-write-failed`).
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

  /**
   * A TOOL IS INSERTED AS ITS WORDS, NOT AS ITS NAME.
   *
   * The menu hands over a token — `{{tool:search-the-internet}}` — and until now
   * that token was the whole insertion: the prompt said a tool was there and
   * never said what the tool would do, so the words were never on screen and the
   * person could not read or change them.
   *
   * What goes in is the token line followed by the tool's text. The line stays so
   * it is visible that these words came from a tool rather than from typing, and
   * the text follows so the prompt is the whole truth about what will be sent.
   * That is the point of this system: no hidden layer, the prompt is what runs.
   *
   * A FAILURE WRITES NOTHING into the person's prompt — an error message is not a
   * tool's contribution and would be sent on the next run as if they had typed
   * it. It goes to the error channel, which has had a listener in
   * WritingAreaIndex and no sender until now.
   */
  /**
   * A TRIGGER IS WRITTEN INTO THE ROW IT STARTS — ONE per row, and the row keeps its text.
   *
   * Ported from the reference canvas's first step, where the question is "what triggers this
   * workflow?" and the answer is one of a list. Ours writes the answer as a token in the row, the
   * same shape a tool writes, so a row holds one kind of thing and the server reads one shape —
   * and so the row shows its own trigger without anything having to remember it separately.
   *
   * ONE, NOT MANY, AND REPLACED RATHER THAN ACCUMULATED. Two triggers on one module is a state
   * the interface should make impossible — "every morning" and "when a form arrives" are two
   * different prompts wearing one row — so choosing a trigger replaces the one already there, and
   * choosing the one that is already there clears it. Clearing is a real answer: it leaves the row
   * starting however the application starts it, which is how every prompt run by hand works.
   */
  private _setTrigger(idx: number, token: string): void {
    const row = this._sections[idx];
    if (!row) return;
    // The rule — one per row, replaced rather than accumulated, and a re-pick clears it — lives in
    // shared/triggers.ts, so the canvas's own menu gets the same behaviour by calling the same
    // function rather than by re-implementing it.
    this._sections[idx] = { ...row, content: withTrigger(String(row.content || ''), token) };
    // No re-render: the row's own element derives its badge, its rail mark and its menu ticks
    // from this text, and it already received the new value with the update below.
    this._emitUpdate(idx);
  }

  private async _insertTool(idx: number, token: string): Promise<void> {
    const name = token.replace(/^\{\{tool:/, '').replace(/\}\}$/, '').trim();
    if (!name) return;

    const report = (message: string) => {
      window.dispatchEvent(new CustomEvent('a2ui-update-error-banner', {
        detail: { props: { message, code: 'TOOL_UNREADABLE', intent: 'tool-insert' } },
      }));
    };

    let written: string;
    try {
      const res = await fetch(`${API_BASE}/ai/read-tool`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        report(`The tool "${name}" could not be read. ${body?.detail?.error?.message ?? res.statusText}`);
        return;
      }
      const tool = await res.json();
      written = `{{tool:${tool.name}}}\n${tool.body}`;
    } catch (error) {
      report(`The tool "${name}" could not be reached. ${String(error)}`);
      return;
    }

    const prev = String(this._sections[idx]?.content || '');
    const next = prev.trim() ? `${prev.trimEnd()}\n\n${written}` : written;
    this._sections[idx] = { ...this._sections[idx], content: next };
    this._emitUpdate(idx);
    this.requestUpdate();
  }

  /**
   * A SEAT WAS CHOSEN — ASK HER TO SAY WHAT IT MEANS.
   *
   * This used to DROP the seat's description into the thread as a fixed line. It
   * read as static text sitting in a live conversation: nothing was thinking, the
   * panel had printed a sentence it already knew. This chat column is never a
   * display surface — it is a conversation, and everything in it is an answer.
   *
   * So the seat is described TO her, along with what the person just did, and her
   * reply is what the thread gets. She says it in her own words, she can see the
   * prompt she is talking about, and the person gets an answer instead of a
   * caption.
   *
   * THE DESCRIPTION IS STILL HANDED OVER rather than left to her imagination: it
   * is the same sentence the fly-out showed, so the tile and the reply cannot
   * describe the seat differently. She is asked to say it plainly and to offer
   * next steps — not to repeat the description word for word.
   *
   * THE NEXT STEPS ARE HERS TO CHOOSE, AND THEY ARE BUTTONS THAT DO THE WORK. She
   * can see the prompt, the package and what the person came in with, so she is
   * the one who knows which moves make sense here.
   *
   * A STEP IS AN EDIT, NOT A QUESTION. Pressing "add these rules to Constraints"
   * must put those rules in the Constraints seat — the same column the person
   * would have got by typing them — so the action is `write-seat`, which the chat
   * hands to the editor instead of to her. A plain action would go back to her as
   * a message and the seat would never be written: measured, the prompt stayed
   * unchanged and the thread gained a paragraph.
   *
   * The format is written out because it is short and she has to get it exactly
   * right: a label in brackets, then `write-seat:`, then the seat, a `|`, and the
   * words. PARENTHESES ARE BANNED IN THE WORDS — a `)` ends the button early and
   * it stops being a button, which is why the instruction says so rather than
   * trusting the text to avoid them.
   */
  private _sayWhatTheSeatIsFor(type: string, label: string): void {
    const seat = SECTION_TYPES.find((s) => s.id === type);
    if (!seat) return;
    window.dispatchEvent(new CustomEvent('a2ui:ask-grace', {
      detail: {
        request: [
          `The person just changed one of the prompt seats to "${label}".`,
          `What that seat is for: ${seat.description}`,
          'Tell them in your own words, briefly, what this seat is for and what belongs in it.',
          'Say it for someone who has never heard the term.',
          `Then offer two or three concrete things you could write into that seat for them, as buttons.`,
          `Write each button EXACTLY like this: [short label](action:write-seat:${label}|the words to put in the seat)`,
          'Use no parentheses anywhere inside the button, and keep the label to a few words.',
          'Make the words complete and ready to use — they go straight into the prompt as written.',
          'Pick steps that fit the prompt in front of you rather than describing the seat generally.',
          'DO NOT WRITE INTO THE SEAT YOURSELF and do not use any update_ tag — nothing goes in',
          'until they press one of the buttons, so ask which one they want and wait.',
          'Finish with one more button, exactly [No thanks](action:no-advice), so they can',
          'dismiss what you offered and carry on without answering you.',
        ].join(' '),
      },
    }));
  }

  /**
   * PUT WORDS INTO A SEAT — MAKING THE SEAT IF IT IS NOT THERE.
   *
   * This is what a next-step button does. "Add exactness rules to Constraints" is
   * an edit to the prompt, and the honest result is the Constraints seat appearing
   * with those rules in it — the same column the person would have produced by
   * typing them.
   *
   * THE SEAT IS RESOLVED THROUGH THE SAME READER EVERYTHING ELSE USES, so she can
   * say "Constraints", "constraints" or "constraints" and land on one seat rather
   * than creating a second one beside it. `normalizeSectionType` knows every
   * spelling; a name nobody has decided (`custom`) is refused instead of guessed.
   *
   * AN EXISTING SEAT IS APPENDED TO, NOT REPLACED. The person may already have
   * written rules there, and a button that overwrote them would be destroying work
   * they cannot see while pressing it.
   */
  private _onWriteSeat = (e: Event) => {
    const { section, value } = ((e as CustomEvent).detail || {}) as {
      section?: string; value?: string;
    };
    if (!section || !value) return;

    /*
     * THE SEAT, MADE IF THIS PROMPT HAS NONE — see `_seatFor`. What used to be here was a
     * refusal for any name that was not one of the declared seats, on the reasoning that a row
     * the diagram cannot name should not be invented. The owner settled that question the other
     * way on 2026-09-23 — she may insert a section into the prompt, exactly as the person may by
     * choosing Custom and typing a name — so a name that is not a declared seat becomes a custom
     * row carrying that name.
     */
    const idx = this._seatFor(String(section), String(value));

    // A ROW THAT WAS JUST MADE ALREADY HOLDS THE WORDS. Appending them again would print the
    // same sentence twice in the row the person is about to read.
    const prev = String(this._sections[idx].content || '');
    if (prev === value) return;

    const next = prev.trim() ? `${prev.trimEnd()}\n\n${value}` : value;
    this._sections[idx] = { ...this._sections[idx], content: next };
    this._emitUpdate(idx);
    this.requestUpdate();
  };

  /**
   * A TOOL PUT IN FROM OUTSIDE — a chat button carrying `write-tool`, or her own tag.
   *
   * The seat comes from the caller when it names one, and from `_seatFor` otherwise, so a
   * prompt with no Tool Call row gets one rather than the write landing nowhere. What is
   * written is the register's own text, read by `_insertTool` — the same two things the
   * seat menu writes: the tool's name in a line of its own, and the words it stands for.
   */
  private _onInsertTool = (e: Event) => {
    const { name, section } = ((e as CustomEvent).detail || {}) as {
      name?: string; section?: string;
    };
    const wanted = String(name ?? '').trim();
    if (!wanted) return;
    const idx = this._seatFor(section ? String(section) : 'Tool Call', '');
    void this._insertTool(idx, `{{tool:${wanted}}}`);
  };

  /**
   * A TOOL MOVED FROM ONE STEP TO ANOTHER — the words travel, exactly as written.
   *
   * WHAT MOVES IS THE TOOL'S OWN BLOCK: the line naming it, and the lines under it. That is the
   * shape the seat's Tools menu writes (`{{tool:name}}` then the tool's text), so the block is the
   * token line through to the next token or the end — which is the same reading the run makes of
   * a seat when it decides what a prompt names.
   *
   * The person may move a tool anywhere it is wanted. A tool beside the agent that uses it is not
   * a mistake, so nothing here judges the destination; it only refuses to move one into the seat
   * it already sits in, and says so.
   */
  private _onMoveTool = (e: Event) => {
    const { name, into } = ((e as CustomEvent).detail || {}) as { name?: string; into?: string };
    const tool = String(name ?? '').trim();
    if (!tool) return;
    const token = `{{tool:${tool}}}`;
    const fromIdx = this._sections.findIndex((s) => String(s.content || '').includes(token));
    if (fromIdx < 0) {
      this._writeFailed(tool, 'no row in this prompt names that tool');
      return;
    }
    const targetIdx = this._seatFor(String(into || 'Tool Call'), '');
    if (fromIdx === targetIdx) {
      this._writeFailed(tool, 'it is already in that step');
      return;
    }

    const source = String(this._sections[fromIdx].content || '');
    const lines = source.split('\n');
    const at = lines.findIndex((l) => l.includes(token));
    let end = at + 1;
    while (end < lines.length && !lines[end].includes('{{tool:')) end++;
    const block = lines.slice(at, end).join('\n').trim();

    // OUT OF THE SOURCE FIRST — and if the block was all it held, the row keeps its place and
    // goes quiet rather than disappearing: removing a row is a separate act, and one the person
    // may not want.
    const left = [...lines.slice(0, at), ...lines.slice(end)].join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
    this._sections[fromIdx] = { ...this._sections[fromIdx], content: left };
    this._emitUpdate(fromIdx);

    const target = String(this._sections[targetIdx].content || '');
    this._sections[targetIdx] = {
      ...this._sections[targetIdx],
      content: target.trim() ? `${target.trimEnd()}\n\n${block}` : block,
    };
    this._emitUpdate(targetIdx);
    this.requestUpdate();
  };

  /**
   * A MERGE: the from-row's words go into the to-row, and the from-row goes.
   *
   * Both rows are found by the one matcher, so `agent_role`, `Agent Role` and `agent` all name
   * the same seat — which matters here more than anywhere: the duplicate this exists to repair is
   * USUALLY one row whose name is a different spelling of another row's.
   *
   * THE TARGET IS WRITTEN BEFORE THE SOURCE IS REMOVED, and that order is the whole reason this
   * is one method rather than two events: a removal first would leave the words nowhere to go if
   * the write then failed.
   */
  private _onMergeSeat = (e: Event) => {
    const { from, into } = ((e as CustomEvent).detail || {}) as { from?: string; into?: string };
    if (!from || !into) return;
    const fromIdx = this._indexOfNamed(String(from));
    const intoIdx = this._indexOfNamed(String(into));
    if (fromIdx < 0) {
      this._writeFailed(String(from), 'no row by that name');
      return;
    }
    if (intoIdx < 0) {
      this._writeFailed(String(into), 'no row by that name');
      return;
    }
    if (fromIdx === intoIdx) {
      // The two spellings name one row, so there is nothing to merge — and saying so beats
      // "done" over a prompt that did not change.
      this._writeFailed(String(from), 'that is the same row as the one it would merge into');
      return;
    }

    const body = String(this._sections[fromIdx].content || '').trim();
    const target = String(this._sections[intoIdx].content || '').trim();
    const merged = target && body ? `${target}\n\n${body}` : (target || body);
    this._sections[intoIdx] = { ...this._sections[intoIdx], content: merged };
    this._emitUpdate(intoIdx);
    this._removeSection(fromIdx);
    this.requestUpdate();
  };

  private _onRemoveRole = (e: Event) => {
    const { roleName } = (e as CustomEvent).detail || {};
    if (!roleName) return;
    /*
     * BY NAME, THROUGH THE ONE MATCHER. This compared `s.name === roleName` exactly, and a row's
     * name is whatever it was made with — a stray row called `agent_role` would not answer to
     * "Agent Role", so the assistant's own `<remove_role name="Agent Role"/>` matched nothing and
     * the row she was trying to clear stayed exactly where it was. Same spellings as every other
     * write: the label, the id, the legacy short names, and any of the three separators.
     */
    const idx = this._indexOfNamed(String(roleName));
    if (idx >= 0) this._removeSection(idx);
    else this._writeFailed(String(roleName), 'no row by that name');
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
          .tools=${this._tools}
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

if (!customElements.get('prompt-section-editor')) customElements.define('prompt-section-editor', PromptSectionEditor);

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
