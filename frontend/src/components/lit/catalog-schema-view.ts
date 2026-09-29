/**
 * <catalog-schema-view> — the catalogue as the JSON SCHEMA it actually is.
 *
 * WHAT THIS DRAWS, AND WHY IT IS NOT A TREE OF COMPONENTS. A catalog.json is a JSON
 * Schema document, not a containment tree. Its entries under `components` are siblings,
 * and the only nesting the file names is through property schemas — a `$ref` to ChildList
 * (Row, Column, DecisionDialog) or an inline `children` (AgentCanvas, workspace-layout,
 * prompt-container, chat-header). So the levels drawn here are the FILE'S OWN: the
 * document, its keys, `components`, each entry, that entry's schema block, its
 * `properties`, and each property's schema. Five levels of real structure, not five
 * levels of invention.
 *
 * AN ENTRY IS WRITTEN IN ONE OF TWO SHAPES, and the row says which one:
 *   flat       type/description/properties/required at the entry's top level   (24 of 57)
 *   allOf(3)   those same fields as the THIRD element of `allOf`, behind two
 *              shared $refs (ComponentCommon, CatalogComponentCommon)          (33 of 57)
 * Reading one shape as if it were the other is how a single file gets described two
 * different ways, which is why the shape is on the row rather than in a doc.
 *
 * AN ABSENT THING IS NAMED, NOT OMITTED. Every check below is a statement about the file,
 * and "the check could not run" must never render the same as "nothing wrong" — the rule
 * <chat-navigation-bar>'s health marker already carries:
 *   · a `#/…` $ref that resolves to nothing                  → DANGLING
 *   · a $ref to common_types.json                            → external (by design, not missing)
 *   · an entry whose schema block has no description         → no description
 *   · an entry carrying `deprecated`                         → deprecated
 *   · a file with no `$defs` whose allOf entries ref one      → absent
 * Nothing here is repaired, and nothing absent is filled with a plausible value.
 *
 * READS: the catalogues under src/components/A2UI/catalogs/, lazily — import.meta.glob, so
 * the main bundle never carries a catalogue nobody opened. That is the same reasoning that
 * keeps <agent-flow> and <agent-canvas> out of main.tsx until a Run asks for them.
 * WRITES: nothing. The element has no events, no setters for the data, and no path to disk.
 *
 * A2UI Catalog ID: none. This element is the catalogue's own READER; it is not itself a
 * renderable component and is deliberately not declared in any catalog.json. Nothing the
 * agent assembles should ever draw it.
 * Framework: Lit 3.x — no decorators, static properties + customElements.define()
 */

import { LitElement, html, css, nothing } from 'lit';
import type { TemplateResult } from 'lit';

// ── The catalogues, one lazy loader each ─────────────────────────────────────
// The keys are the paths Vite resolves at build time; the id is the directory name,
// so a fourth catalogue appears in this element's switcher the moment it has a file.
const MODULES = import.meta.glob('../A2UI/catalogs/*/catalog.json');

/** The catalogue ids, read off the glob keys rather than hardcoded. */
const CATALOG_IDS: string[] = Object.keys(MODULES)
  .map((p) => p.split('/').slice(-2)[0])
  .sort();

/** Where a $ref points when it leaves this file. */
const COMMON_TYPES = 'https://a2ui.org/specification/v0_9/common_types.json#/$defs/';

/** The document's own scalar fields, in the order the file writes them. */
const DOC_FIELDS = ['$schema', '$id', 'title', 'whatThisFileIs', 'description', 'catalogId'];

/** Entry-level keys that are facts about the entry rather than schema keywords. */
const ENTRY_ANNOTATIONS = [
  'type',
  'description',
  'annotation',
  'x-figma-source',
  'x-internal-instantiation',
  'x-layers',
  'deprecated',
  'x-deprecated-reason',
  'unevaluatedProperties',
];

/** How a row's honesty is drawn. `external` and `info` are facts, not faults. */
type MarkKind = 'dangling' | 'absent' | 'deprecated' | 'external' | 'info';

interface Row {
  /** Stable id for the expansion set — the path of real key names, never a label. */
  path: string;
  /** The file's own key name, or an index for an array member. */
  label: string;
  /** A leaf's value, printed as the file writes it. */
  value?: string;
  /** A shape summary for a branch: "allOf(3)", "flat", "oneOf[2]", "object(3)". */
  shape?: string;
  mark?: MarkKind;
  /** The words that make a mark mean something. A mark without a note is a shrug. */
  note?: string;
  children?: Row[];
}

/** The last segment of a $ref — the name a reader knows the definition by. */
function refName(ref: string): string {
  return ref.split('/').pop() ?? ref;
}

/** Print a scalar the way the file holds it. Long prose stays whole — it is the value. */
function scalar(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v === null) return 'null';
  if (Array.isArray(v)) return `[${v.map((x) => scalar(x)).join(', ')}]`;
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * An entry's schema block. A flat entry IS the block; an allOf entry keeps its block as
 * the last element of the array, behind the two shared $refs. Reading the wrong one of
 * these is the single most common way this file gets misquoted, so it is one function.
 */
function schemaBlock(entry: any): any {
  if (Array.isArray(entry?.allOf) && entry.allOf.length) {
    return entry.allOf[entry.allOf.length - 1] ?? {};
  }
  return entry ?? {};
}

/** Whether a `#/…` ref resolves inside this document. */
function localRef(doc: any, ref: string): boolean {
  if (!ref.startsWith('#/')) return true;
  let node: any = doc;
  for (const seg of ref.slice(2).split('/')) {
    if (node == null || typeof node !== 'object' || !(seg in node)) return false;
    node = node[seg];
  }
  return true;
}

/**
 * One property's schema, as a row. The five things a property can be here, in the order
 * the file uses them: a const (identity), a scalar type, a $ref (shared or local), a
 * oneOf (either/or), or an inline object/array (a real sub-shape).
 */
function buildProperty(path: string, name: string, schema: any, doc: any): Row {
  const row: Row = { path, label: name };

  if (schema == null || typeof schema !== 'object') {
    row.value = scalar(schema);
    return row;
  }

  if ('const' in schema) {
    row.value = `const ${scalar(schema.const)}`;
    return row;
  }

  if (typeof schema.$ref === 'string') {
    const name_ = refName(schema.$ref);
    row.value = `$ref ${name_}`;
    if (schema.$ref.startsWith('#/')) {
      if (!localRef(doc, schema.$ref)) {
        row.mark = 'dangling';
        row.note = `$ref "${schema.$ref}" — nothing at that path in this file. The reference points at a definition that does not exist here.`;
      }
    } else if (schema.$ref.startsWith(COMMON_TYPES)) {
      row.mark = 'external';
      row.note = `Defined outside this file, in ${COMMON_TYPES} — so its shape is not readable from here. That is by design, not a gap.`;
    } else {
      row.mark = 'external';
      row.note = `Defined outside this file: ${schema.$ref}`;
    }
    return row;
  }

  if (Array.isArray(schema.oneOf)) {
    row.shape = `oneOf[${schema.oneOf.length}]`;
    row.children = schema.oneOf.map((m: any, i: number) =>
      buildProperty(`${path}.oneOf[${i}]`, `[${i}]`, m, doc)
    );
    return row;
  }

  if (schema.properties && typeof schema.properties === 'object') {
    const keys = Object.keys(schema.properties);
    row.shape = `object(${keys.length})`;
    const kids: Row[] = keys.map((k) =>
      buildProperty(`${path}.${k}`, k, schema.properties[k], doc)
    );
    if (Array.isArray(schema.required) && schema.required.length) {
      kids.push({ path: `${path}.required`, label: 'required', value: scalar(schema.required) });
    }
    row.children = kids;
    return row;
  }

  if (schema.type === 'array' || schema.items) {
    row.shape = 'array';
    if (schema.items) row.children = [buildProperty(`${path}.items`, 'items', schema.items, doc)];
    return row;
  }

  row.value = typeof schema.type === 'string' ? schema.type : 'object';
  return row;
}

/** One entry under `components` — its write-shape, its annotations, its props, its required. */
function buildEntry(name: string, entry: any, doc: any): Row {
  const allOf = Array.isArray(entry?.allOf) ? entry.allOf : null;
  const block = schemaBlock(entry);
  const props = block.properties ?? {};
  const propNames = Object.keys(props);
  const required: string[] = Array.isArray(block.required) ? block.required : [];

  const row: Row = { path: `components.${name}`, label: name, shape: allOf ? `allOf(${allOf.length})` : 'flat' };

  const children: Row[] = [];

  // The two shared $refs, shown as the file writes them — they are the reason the
  // allOf form exists, and hiding them is what makes the form look arbitrary.
  if (allOf) {
    children.push({
      path: `components.${name}.allOf`,
      label: 'allOf',
      shape: `${allOf.length} members`,
      children: allOf.map((m: any, i: number) => {
        const r: Row = { path: `components.${name}.allOf[${i}]`, label: `[${i}]`, value: m?.$ref ? `$ref ${refName(m.$ref)}` : '(the entry block)' };
        if (m?.$ref && !m.$ref.startsWith('#/') && !m.$ref.startsWith(COMMON_TYPES)) {
          r.mark = 'external';
          r.note = `Defined outside this file: ${m.$ref}`;
        }
        return r;
      }),
    });
  }

  // The block's own annotations, in file order. A missing description is a fact.
  for (const k of ENTRY_ANNOTATIONS) {
    if (!(k in block)) continue;
    const r: Row = { path: `components.${name}.${k}`, label: k, value: scalar(block[k]) };
    if (k === 'deprecated') {
      r.mark = 'deprecated';
      r.note = `The file marks this component deprecated: ${scalar(block['x-deprecated-reason'] ?? '(no reason given)')}`;
    }
    children.push(r);
  }
  // `deprecated` can also sit on the entry itself, outside the block.
  if (!allOf && 'deprecated' in (entry ?? {}) && !('deprecated' in block)) {
    children.push({ path: `components.${name}.deprecated`, label: 'deprecated', value: scalar(entry.deprecated), mark: 'deprecated', note: 'The file marks this component deprecated.' });
  }

  if (!('description' in block)) {
    row.mark = row.mark ?? 'absent';
    children.unshift({
      path: `components.${name}.description`,
      label: 'description',
      value: 'absent',
      mark: 'absent',
      note: 'This entry carries no description anywhere — flat top level or allOf block. The name is the only thing the file says about it.',
    });
  } else if (block.deprecated) {
    row.mark = 'deprecated';
    row.note = `deprecated: ${scalar(block['x-deprecated-reason'] ?? '(no reason given)')}`;
  }

  children.push({
    path: `components.${name}.properties`,
    label: 'properties',
    shape: `${propNames.length}`,
    children: propNames.map((p) => buildProperty(`components.${name}.properties.${p}`, p, props[p], doc)),
  });

  children.push({
    path: `components.${name}.required`,
    label: 'required',
    value: required.length ? scalar(required) : 'absent',
    ...(required.length ? {} : { mark: 'absent' as MarkKind, note: 'No required array on this entry.' }),
  });

  row.children = children;
  return row;
}

/** One definition under `$defs`. `anyComponent` is the only one that can be checked. */
function buildDef(name: string, def: any, doc: any): Row {
  const row: Row = { path: `$defs.${name}`, label: name };

  if (name === 'anyComponent' && Array.isArray(def?.oneOf)) {
    const declared: string[] = Object.keys(doc?.components ?? {});
    const listed = def.oneOf
      .map((m: any) => (typeof m?.$ref === 'string' ? m.$ref.split('/').pop() : null))
      .filter(Boolean) as string[];
    const missing = declared.filter((n) => !listed.includes(n));

    row.shape = `oneOf[${def.oneOf.length}]`;
    if (missing.length) {
      row.mark = 'dangling';
      row.note =
        `This list holds ${listed.length} of the catalogue's ${declared.length} names. ` +
        `Absent: ${missing.join(', ')} — so the wildcard cannot accept ${
          missing.length === 1 ? 'it' : 'them'
        }, and a payload naming ${missing.length === 1 ? 'it' : 'them'} fails against this slot.`;
    } else {
      row.note = `All ${declared.length} names are listed.`;
    }

    const kids: Row[] = def.oneOf.map((m: any, i: number) => {
      const ref = typeof m?.$ref === 'string' ? m.$ref : '';
      const n = ref ? refName(ref) : `[${i}]`;
      const r: Row = { path: `$defs.anyComponent.oneOf[${i}]`, label: n, value: ref ? `$ref ${ref}` : scalar(m) };
      if (ref.startsWith('#/') && !localRef(doc, ref)) {
        r.mark = 'dangling';
        r.note = `$ref "${ref}" — nothing at that path in this file.`;
      }
      return r;
    });
    if (def.discriminator) {
      kids.push({ path: '$defs.anyComponent.discriminator', label: 'discriminator', value: scalar(def.discriminator) });
    }
    row.children = kids;
    return row;
  }

  const props = def?.properties;
  if (props && typeof props === 'object') {
    const keys = Object.keys(props);
    row.shape = `object(${keys.length})`;
    row.children = keys.map((k) => buildProperty(`$defs.${name}.${k}`, k, props[k], doc));
    return row;
  }

  row.value = def?.type ? scalar(def.type) : 'object';
  return row;
}

/** The whole document, as rows. */
function buildDocument(doc: any): Row[] {
  const rows: Row[] = [];

  for (const k of DOC_FIELDS) {
    if (k in doc) rows.push({ path: k, label: k, value: scalar(doc[k]) });
  }

  const comps = doc.components ?? {};
  const names = Object.keys(comps);
  rows.push({
    path: 'components',
    label: 'components',
    shape: `${names.length} entries`,
    children: names.map((n) => buildEntry(n, comps[n], doc)),
  });

  const defs = doc.$defs;
  if (defs && typeof defs === 'object' && Object.keys(defs).length) {
    const keys = Object.keys(defs);
    rows.push({
      path: '$defs',
      label: '$defs',
      shape: `${keys.length} definitions`,
      children: keys.map((k) => buildDef(k, defs[k], doc)),
    });
  } else {
    rows.push({
      path: '$defs',
      label: '$defs',
      value: 'absent',
      mark: 'absent',
      note:
        'This file has no $defs object, yet its entries $ref #/$defs/CatalogComponentCommon. ' +
        'That reference resolves to nothing here.',
    });
  }

  return rows;
}

export class CatalogSchemaView extends LitElement {
  // ── Reactive properties (static getter — no decorators) ──────────────────
  static properties = {
    catalogId: { type: String, attribute: 'catalog-id' },
  };

  declare catalogId: string;

  /** 'loading' | 'ready' | 'failed' — and a failure must never read as an empty catalogue. */
  private _state: 'loading' | 'ready' | 'failed' = 'loading';
  private _failureReason = '';
  private _doc: any = null;
  private _rows: Row[] = [];

  /**
   * Which rows are open, by path. NOT reactive: a toggle calls requestUpdate() itself, so
   * a Set (which Lit cannot diff) costs nothing per render.
   */
  private _open = new Set<string>();

  /** Guards against a slow load for one catalogue landing after a fast switch to another. */
  private _loadToken = 0;

  constructor() {
    super();
    this.catalogId = CATALOG_IDS.includes('prompt-composer') ? 'prompt-composer' : (CATALOG_IDS[0] ?? '');
  }

  connectedCallback(): void {
    super.connectedCallback();
    void this._load(this.catalogId);
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('catalogId') && this.catalogId && !this._open.size) void this._load(this.catalogId);
  }

  /** Load one catalogue and build its rows. A failure is stated with its reason. */
  private async _load(id: string): Promise<void> {
    const token = ++this._loadToken;
    const key = Object.keys(MODULES).find((p) => p.split('/').slice(-2)[0] === id);
    if (!key) {
      this._state = 'failed';
      this._failureReason = `No catalogue named "${id}". The switcher lists ${CATALOG_IDS.join(', ')}.`;
      this._doc = null;
      this._rows = [];
      this._open = new Set();
      this.requestUpdate();
      return;
    }

    this._state = 'loading';
    this._failureReason = '';
    this.requestUpdate();

    try {
      const mod: any = await MODULES[key]();
      if (token !== this._loadToken) return; // a newer selection won
      const doc = mod?.default ?? mod;
      this._doc = doc;
      this._rows = buildDocument(doc);
      // Open the two branches a reader comes for. Entries stay shut — 57 open rows is a wall.
      this._open = new Set(['components', '$defs']);
      this._state = 'ready';
    } catch (err) {
      if (token !== this._loadToken) return;
      this._state = 'failed';
      this._failureReason = err instanceof Error ? err.message : String(err);
      this._doc = null;
      this._rows = [];
    }
    // Announced on failure too: the SELECTION changed either way, and a reader following
    // this screen must not be left pointing at the catalogue the reader moved off.
    this._announce();
    this.requestUpdate();
  }

  private _select(id: string): void {
    if (id === this.catalogId) return;
    this.catalogId = id;
    this._open = new Set();
    void this._load(id);
  }

  /**
   * Announce which catalogue is on screen, so anything else reading the same repo can
   * follow it — the Figma layer overlay is the reader, and an overlay still showing one
   * pipeline's layers while a different catalogue is selected is a screen contradicting
   * itself. Bubbles and composes so a React host can listen on a wrapper div.
   */
  private _announce(): void {
    this.dispatchEvent(
      new CustomEvent('catalog-change', {
        detail: { catalogId: this.catalogId },
        bubbles: true,
        composed: true,
      })
    );
  }

  private _toggle(path: string): void {
    if (this._open.has(path)) this._open.delete(path);
    else this._open.add(path);
    this.requestUpdate();
  }

  // ── Render ───────────────────────────────────────────────────────────────

  private _renderRows(rows: Row[], depth: number): TemplateResult {
    return html`${rows.map((r) => this._renderRow(r, depth))}`;
  }

  private _renderRow(row: Row, depth: number): TemplateResult {
    const hasKids = !!row.children?.length;
    const isOpen = this._open.has(row.path);
    const mark = row.mark ? html`<span class="mk mk-${row.mark}" title=${row.note ?? ''}>${row.mark}</span>` : nothing;

    return html`
      <div class="rowWrap">
        <div
          class="row ${hasKids ? 'branch' : 'leaf'} ${row.mark ? 'marked' : ''}"
          style="--d:${depth}"
          @click=${hasKids ? () => this._toggle(row.path) : nothing}
          role=${hasKids ? 'button' : nothing}
          tabindex=${hasKids ? '0' : nothing}
          @keydown=${hasKids
            ? (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this._toggle(row.path);
                }
              }
            : nothing}
        >
          <span class="chev">${hasKids ? (isOpen ? '▾' : '▸') : ''}</span>
          <span class="key">${row.label}</span>
          ${row.shape ? html`<span class="shape">${row.shape}</span>` : nothing}
          ${row.value !== undefined ? html`<span class="val">${row.value}</span>` : nothing}
          ${mark}
        </div>
        ${row.note && row.mark
          ? html`<div class="note" style="--d:${depth}">${row.note}</div>`
          : nothing}
        ${hasKids && isOpen ? this._renderRows(row.children!, depth + 1) : nothing}
      </div>
    `;
  }

  render() {
    const doc = this._doc;

    return html`
      <div class="wrap">
        <div class="bar">
          <span class="barLabel">Catalogue</span>
          ${CATALOG_IDS.map(
            (id) => html`
              <button
                type="button"
                class="tab ${id === this.catalogId ? 'on' : ''}"
                @click=${() => this._select(id)}
              >
                ${id}
              </button>
            `
          )}
          <span class="grow"></span>
          <span class="src">${
            doc
              ? `${doc.$id ?? ''}`
              : this._state === 'loading'
                ? 'loading…'
                : 'not read'
          }</span>
        </div>

        <div class="head">
          <div class="title">${doc?.title ?? '—'}</div>
          ${doc?.whatThisFileIs ? html`<div class="sub">${doc.whatThisFileIs}</div>` : nothing}
        </div>

        <div class="body">
          ${this._state === 'failed'
            ? html`<div class="fail">
                <div class="failT">The catalogue could not be read.</div>
                <div class="failR">${this._failureReason}</div>
              </div>`
            : this._state === 'loading'
              ? html`<div class="fail"><div class="failT">Loading ${this.catalogId}…</div></div>`
              : html`<div class="rows">${this._renderRows(this._rows, 0)}</div>`}
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      overflow: hidden;
      background: #ffffff;
      color: #171717;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
    }

    /* ── The switcher ───────────────────────────────────────────────────── */
    .bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      border-bottom: 1px solid #e3e8ea;
      background: #f7f9fa;
      flex-shrink: 0;
    }
    .barLabel {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #2793a3;
      margin-right: 4px;
    }
    .grow { flex: 1; }
    .src {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #7a8790;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 46%;
    }
    .tab {
      font-family: inherit;
      font-size: 12px;
      font-weight: 600;
      color: #2793a3;
      background: #ffffff;
      border: 1px solid #cbe6e3;
      border-radius: 6px;
      padding: 5px 12px;
      cursor: pointer;
    }
    .tab:hover { background: #cbe6e3; }
    .tab.on {
      background: #cbe6e3;
      color: #171717;
      border-color: #93cfc9;
      box-shadow: inset 2px 2px 3px rgba(0, 0, 0, 0.12);
    }

    /* ── The document's own head ────────────────────────────────────────── */
    .head {
      padding: 14px 16px 12px;
      border-bottom: 1px solid #e3e8ea;
      flex-shrink: 0;
    }
    .title {
      font-size: 17px;
      font-weight: 700;
      line-height: 1.3;
    }
    .sub {
      margin-top: 6px;
      font-size: 12px;
      line-height: 1.5;
      color: #5b666e;
      max-width: 96ch;
    }

    /* ── The tree ───────────────────────────────────────────────────────── */
    .body {
      flex: 1;
      min-height: 0;
      overflow: auto;
      padding: 8px 0 40px;
    }
    .rows { min-width: min-content; }

    .rowWrap { display: block; }

    .row {
      display: flex;
      align-items: baseline;
      gap: 10px;
      padding: 2px 16px 2px calc(16px + var(--d) * 18px);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12.5px;
      line-height: 1.7;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .row.branch { cursor: pointer; }
    .row.branch:hover { background: #f2f7f8; }
    .row.leaf:hover { background: #fafcfc; }
    .row.marked { background: #fffdf3; }
    .row.marked:hover { background: #fff8e3; }
    .row:focus-visible {
      outline: 2px solid #1facc2;
      outline-offset: -2px;
    }

    .chev {
      flex-shrink: 0;
      width: 12px;
      color: #9aa6ad;
      font-size: 10px;
    }
    .key {
      flex-shrink: 0;
      font-weight: 700;
      color: #171717;
    }
    .shape {
      flex-shrink: 0;
      font-size: 11px;
      color: #2793a3;
      background: #eef7f8;
      border-radius: 4px;
      padding: 0 5px;
    }
    .val {
      color: #46535b;
      min-width: 0;
    }

    /* ── Marks — a fact about the file, never a decoration ──────────────── */
    .mk {
      flex-shrink: 0;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-radius: 4px;
      padding: 1px 6px;
      align-self: center;
      cursor: help;
    }
    .mk-dangling { background: #fde8e4; color: #a3331f; }
    .mk-absent { background: #fdf3e0; color: #8a5b12; }
    .mk-deprecated { background: #fdf3e0; color: #8a5b12; }
    .mk-external { background: #eef1f3; color: #5b666e; }
    .mk-info { background: #eef7f8; color: #2793a3; }

    .note {
      padding: 2px 16px 6px calc(16px + var(--d) * 18px + 22px);
      font-size: 11.5px;
      line-height: 1.55;
      color: #6b767d;
      max-width: 110ch;
    }

    /* ── A read that failed, said plainly ───────────────────────────────── */
    .fail { padding: 24px 16px; }
    .failT { font-size: 14px; font-weight: 700; color: #a3331f; }
    .failR {
      margin-top: 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      color: #6b767d;
      max-width: 100ch;
    }
  `;
}

// ── Register custom element ──────────────────────────────────────────────────
if (!customElements.get('catalog-schema-view')) customElements.define('catalog-schema-view', CatalogSchemaView);

// ── JSX type declaration for React/TypeScript consumers ─────────────────────
declare global {
  interface HTMLElementTagNameMap {
    'catalog-schema-view': CatalogSchemaView;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'catalog-schema-view': React.DetailedHTMLProps<
        React.HTMLAttributes<CatalogSchemaView> & {
          'catalog-id'?: string;
          ref?: React.Ref<CatalogSchemaView>;
        },
        CatalogSchemaView
      >;
    }
  }
}
