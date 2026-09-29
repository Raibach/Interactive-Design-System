/**
 * <figma-layers-view> — the measured layer tree of a design, as plain text.
 *
 * WHAT THIS SHOWS. Two levels. THE CATALOGUE: every component it declares, the shape its entry
 * is written in, what it accepts — and, so the list can be read rather than interrogated, WHAT
 * DRAWS EACH ONE: the file, the renderer, or nothing. THE DESIGN: for each node that has been
 * through the ingest, the tree the ingest measured — every layer's name, its type, its node id,
 * nested the way the design nests them — read from `public/catalog-figma/<pipeline>.json`.
 * Three files and the element manifest, all read; Figma itself is never asked.
 *
 * WHY IT EXISTS. Until now the parent/child structure of a design lived only inside the
 * model call that measured it and was then discarded. The consequences were invisible by
 * construction: two layers with the same name in one frame — the two chevron-blue-closed,
 * 40001185:2170 and 40001185:2163 — could not be seen by anyone, because nothing that
 * outlived the call held the tree they were both in. Neither the id nor the label of a
 * duplicate is a thing you can test for in isolation; you have to be able to READ THE
 * TREE, which is what this element is for.
 *
 * SO A REPEATED LAYER NAME IS MARKED, and named as what it is: a second layer in the same
 * frame carrying a name already used in that frame. That is a statement about the design,
 * not about this screen — and it is deliberately the only judgement this element makes.
 *
 * PLAIN ON PURPOSE. This is a reader, not a design. The owner asked for it unwritten-up so
 * it can be looked at now and designed later; every row is a line of text and nothing here
 * needs to survive a redesign. The one thing that must survive is the reading: a row with
 * no name or no id says so rather than printing an empty gap.
 *
 * READ-ONLY. It fetches; it writes nothing. It raises one event — `open-component`, when a row
 * is clicked — because a tree is a navigation and a row you cannot go anywhere from is a label.
 *
 * A2UI Catalog ID: none. This is a reader of the ingest's record and is not assemblable —
 * do not declare it in any catalog.json.
 * Framework: Lit 3.x — no decorators, static properties + customElements.define()
 */

import { LitElement, html, css, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { loadDrawn, drawnBy, tagFor, type DrawnBy, type DrawnIndex } from '@/shared/component-drawn-by';
import { contractFor } from '@/shared/component-contract';
import { nodeIdentity, nodeLocation, describeNodeId } from '@/shared/node-id';

// ── The catalogue this pipeline's components live in ─────────────────────────
// The level ABOVE a component. A tree that starts at a component cannot say which
// catalogue that component belongs to — and there is more than one catalogue, so that
// is a fact the reader has to be able to see rather than assume. Read the same way
// <catalog-schema-view> reads it, from the same files, so the two cannot disagree.
const CATALOG_MODULES = import.meta.glob('../A2UI/catalogs/*/catalog.json');

// ── The Figma layer name behind a generated component ────────────────────────
// A component the ingest built is NAMED after its node — `f-<node id>` — so its catalogue key
// reads as an id because it is one. The human name it has is the Figma layer it was drawn
// from, and the map (registry.json) is where that pairing is recorded: `litComponent` →
// `figmaName`. Read here so the list can show names without inventing any.
const MAP_MODULES = import.meta.glob('../registry.json');

/** One component as catalog.json declares it — the name, its shape, and what it accepts. */
interface DeclaredComponent {
  name: string;
  /** "flat", or "allOf(3)" — the two shapes an entry is written in. */
  shape: string;
  props: string[];
  required: string[];
}

/** The catalogue's own head, as catalog.json declares it. */
interface CatalogHead {
  id: string;
  title: string;
  catalogId: string;
  components: number;
  /** Every name the catalogue allows, in file order. */
  declared: DeclaredComponent[];
}

/**
 * Read one component entry as the file writes it.
 *
 * THE TWO SHAPES ARE NOT THE SAME PLACE. A flat entry keeps its `description`, `properties`
 * and `required` at the top level; an allOf entry keeps them as the LAST element of `allOf`,
 * behind two shared $refs. Reading the wrong one for a given entry yields an empty property
 * list and no complaint — which is how one file gets described two different ways. So the
 * shape is detected first and the block is read from where that shape says it is.
 */
function readComponent(name: string, entry: any): DeclaredComponent {
  const allOf = Array.isArray(entry?.allOf) ? entry.allOf : null;
  const block = allOf && allOf.length ? allOf[allOf.length - 1] ?? {} : entry ?? {};
  const props = Object.keys(block?.properties ?? {});
  const required = Array.isArray(block?.required) ? block.required : [];
  return { name, shape: allOf ? `allOf(${allOf.length})` : 'flat', props, required };
}

/** A catalogue's head and its declared components, from the file itself. */
function headFrom(id: string, doc: any): CatalogHead {
  const components = doc?.components ?? {};
  return {
    id,
    title: String(doc?.title ?? '(untitled)'),
    catalogId: String(doc?.$id ?? doc?.catalogId ?? ''),
    components: Object.keys(components).length,
    declared: Object.entries(components).map(([name, entry]) => readComponent(name, entry)),
  };
}

/**
 * The short mark a row carries for what draws a component.
 *
 * The whole sentence is the row's title, so this is only ever the glance: a file, the
 * renderer, or nothing. `unknown` is deliberately its own word — a manifest that could not be
 * read must not present as "nothing draws this", because one of those is a reason to delete
 * the row and the other is a reason to go and look.
 */
function markFor(drawn: DrawnBy): string {
  if (drawn.kind === 'element') return `drawn by ${String(drawn.module).replace(/^src\/components\//, '')}`;
  if (drawn.kind === 'renderer') return 'drawn by the renderer';
  if (drawn.kind === 'unknown') return 'could not read';
  return 'nothing draws this';
}

/** One measured layer. Keys are exactly what _figma_spec_for_model writes. */
interface Layer {
  id?: string;
  name?: string;
  type?: string;
  size?: [number, number];
  text?: string;
  /** Set on an INSTANCE: the node id of the component it is an instance of. */
  componentId?: string;
  asset?: string;
  children?: Layer[];
  /** The rest of what was measured about it — shown when the layer itself is opened. */
  position?: [number, number];
  fill?: string;
  layout?: Record<string, string | number>;
  type_style?: Record<string, string | number>;
}

interface NodeRecord {
  tag?: string;
  nodeId?: string;
  /** Written by the approve step. The record exists only for approved components. */
  approvedAt?: string;
  layers?: number;
  tree?: Layer;
  /**
   * The artwork the design carried, vendored into this repository at approval.
   *
   * Written by the approve step since 2026-09-28. Before that the vectors were used for one
   * model call and dropped, so a component referenced them at Figma's local server and lost
   * them when Figma closed. Absent on older records, which is not the same as "the design had
   * none" — see how the caller reports it.
   */
  assets?: Array<{
    kind?: string;
    mime?: string;
    /** Where this repository serves it, e.g. /assets/figma-<hash>.svg. */
    file?: string | null;
    bytes?: number;
    source?: string;
    note?: string;
  }>;
}

interface LayersDocument {
  pipeline?: string;
  generatedAt?: string;
  nodes?: Record<string, NodeRecord>;
}

/**
 * What a repeated layer name actually means, which is two different things.
 *
 * A name used twice with the SAME componentId is ONE component used twice — the design
 * reusing a thing it already has, which is correct and is the whole point of a design
 * system. The two chevron-blue-closed in the System Role frame are exactly this: nodes
 * 40001185:2170 and 40001185:2163, both `Instance` of 40000922:4875.
 *
 * A name used twice WITHOUT that is two layers drawn separately under one name — which is
 * the thing worth seeing, because nothing downstream can tell them apart.
 *
 * So the count alone is not the finding. Reporting "duplicate" for the first case would be
 * a false alarm on correct work, and this element does not raise false alarms.
 */
interface NameUse {
  count: number;
  componentIds: Set<string>;
}

function analyseNames(layer: Layer | undefined, into: Map<string, NameUse> = new Map()): Map<string, NameUse> {
  for (const child of layer?.children ?? []) analyseNames(child, into);
  const name = layer?.name;
  if (!name) return into;
  const use = into.get(name) ?? { count: 0, componentIds: new Set<string>() };
  use.count += 1;
  if (layer?.componentId) use.componentIds.add(layer.componentId);
  into.set(name, use);
  return into;
}

export class FigmaLayersView extends LitElement {
  static properties = {
    pipeline: { type: String },
    /** Show one node's tree instead of every node recorded for the pipeline. */
    nodeId: { type: String, attribute: 'node-id' },
    /** Sit in the flow of a form rather than float over the screen. */
    inline: { type: Boolean },
    /** Bumped by the host to force a re-read — after an ingest lands, or a commit. */
    refresh: { type: Number },
    /** Bumped by the host to fold the tree back to its opening state — a Reset. */
    reset: { type: Number },
    /** The catalogue name of the component the host has open in the preview. */
    selected: { type: String },
    open: { type: Boolean },
  };

  declare pipeline: string;
  declare nodeId: string;
  declare inline: boolean;
  declare refresh: number;
  declare reset: number;
  declare selected: string;
  declare open: boolean;

  private _state: 'loading' | 'ready' | 'absent' | 'failed' = 'loading';
  private _reason = '';
  private _doc: LayersDocument | null = null;

  /** The catalogue above these components, and why it could not be read if it could not. */
  private _catalog: CatalogHead | null = null;
  private _catalogError = '';

  /**
   * EVERY catalogue in the repository — the level above the one being viewed.
   *
   * This level is not a container in any file. The catalogues are not nested in anything:
   * they are three separate documents that happen to live in one folder, and nothing declares
   * a parent. So this row is drawn as what it is — a list of the catalogues that exist, with
   * the one being viewed marked — rather than as a node the data says is above them.
   */
  private _catalogues: CatalogHead[] = [];
  private _cataloguesError = '';

  /** Where the catalogue on screen was read from — a stale answer must not pass for a fresh one. */
  private _catalogFrom = '';

  /**
   * Figma layer name by Lit tag, from the map. Used for generated components, whose catalogue
   * key is an id — a hand-built component is already named with a word, and the map can hold
   * several Figma origins for one of those (`chat-navigation-bar` has five), so its own key is
   * the better label and the map is not consulted for it.
   */
  private _figmaNames = new Map<string, string>();
  /** Figma node id by Lit tag, from the same map — what ties a component to its layer record. */
  private _figmaNodeIds = new Map<string, string>();
  /**
   * Node id -> tag, for the components this catalogue DECLARES, so a layer in a measured tree
   * can be marked as a component the design is already reusing. See `_loadFigmaNames`.
   */
  private _componentsByNode = new Map<string, string>();
  /**
   * IS ANYTHING USING IT? — the audit's own measurement, per catalogue name.
   *
   * DRAWABLE AND USED ARE DIFFERENT QUESTIONS and a tree that answers only the first misleads.
   * `agent-card` read "nothing draws this" while the console drew that card under a different
   * tag; a component can equally be drawable and wired to nothing. The audit measures both —
   * `sent` (a payload the app sends names it) and `renderedIn` (a module's template draws it) —
   * and writes them into the report this reads.
   *
   * Keyed by the catalogue's own name, not by tag, so a component listed under two names can
   * honestly read differently on its two rows: `TraceFeed` is sent by the app, `trace-feed` is
   * not, and they are the same element.
   */
  private _usage: Record<
    string,
    {
      sent?: string[];
      renderedIn?: string[];
      composes?: string[];
      dispatches?: string[];
      listens?: string[];
      behaviourMeasured?: boolean;
      drawable?: boolean;
    }
  > | null = null;
  private _usageError = '';
  /**
   * The audit's findings, per component — what the dot beside each row is made of.
   *
   * The dot is not a new judgement; it is the report's own verdict, collapsed. A reader who
   * wants the sentences opens the title, and the findings themselves are unchanged where they
   * live: this only makes them scannable, so a list of fifty can be looked at for trouble
   * instead of read for it.
   */
  private _findings: Record<string, { blocking: string[]; advisory: string[] }> | null = null;
  /** Where the map was read from — a stale answer must not pass for a fresh one. */
  private _mapFrom = '';
  private _figmaNamesError = '';

  /**
   * WHAT DRAWS EACH DECLARED COMPONENT — so a row can say whether it is there without being
   * clicked.
   *
   * A name is not a file name, and the row used to offer no way to tell a component that draws
   * from one that draws nothing until you opened it: the answer existed, one click away, on a
   * different readout. That is not a list anybody can clean up. Null until it has been read,
   * and `drawnBy` answers `unknown` rather than "nothing draws it" until then — the two are
   * different claims and only one of them is a reason to delete a row.
   */
  private _drawn: DrawnIndex | null = null;

  /**
   * The component the RECORD says was approved most recently — the only honest source for
   * "just added".
   *
   * THE CATALOGUE'S OWN ORDER WAS TRIED FIRST AND IT IS WRONG. The last key in catalog.json is
   * the last entry the writer APPENDED, which is the newest only until something is removed:
   * take the last entry out and the new last key is whatever was already sitting at the end, so
   * the mark lands on a component nobody touched and calls it just added. That is what it did.
   *
   * So this reads the activity record — an actual list of approvals with times — and takes the
   * newest approval whose component is STILL DECLARED, which is what makes it survive an
   * approve-then-remove.
   *
   * Empty when nothing has been approved here or the record could not be read, and EMPTY MEANS
   * NO MARK: a mark that guesses is worse than no mark, because it is believed.
   */
  private _lastApproved = '';
  private _lastApprovedNote = '';

  /** Whether the operator has toggled the panel, so `inline` can default it open only once. */
  private _toggled = false;

  /**
   * Which LAYER rows are rolled up, keyed "<record>/<layer id>".
   *
   * A COLLAPSED set, not an open one: the tree opens in full, which is what a reader wants the
   * first time they meet a design, and what they roll up is what they have already read. An
   * open-set would have to be pre-filled to show the same thing, and its default would be a
   * tree that hides everything.
   */
  private _collapsed = new Set<string>();

  /**
   * Which DECLARED components are opened — the opposite default from the layer tree, and
   * deliberately: this list is the whole allow-list, and every entry opened with its
   * properties is a wall rather than a tree.
   */
  private _expandedDeclared = new Set<string>();

  /** The first `updated` follows connectedCallback's own load — it must not load again. */
  private _firstUpdate = true;

  constructor() {
    super();
    this.pipeline = 'prompt-composer';
    this.nodeId = '';
    this.inline = false;
    this.refresh = 0;
    this.reset = 0;
    this.selected = '';
    // As an overlay, closed: an overlay that opens itself over the app is a thing nobody
    // asked to see. In a form, open: there the tree IS the thing being read.
    this.open = false;
  }

  /** The re-read attached to focus and visibility. See connectedCallback. */
  private _onWake: () => void = () => {};

  connectedCallback(): void {
    super.connectedCallback();
    if (this.inline && !this._toggled) this.open = true;
    void this._load();

    // A TAB YOU LOOKED AWAY FROM IS A TAB SHOWING SOMETHING THAT HAS MOVED ON.
    //
    // Every tab holds the last thing it read, and a refresh only ever reaches the tab that
    // performed the action — so with several open, approving in one leaves the rest showing a
    // count that is no longer true. Twelve tabs, twelve snapshots, five different answers. That
    // is what it looked like from the outside: readouts that disagreed with the actions.
    //
    // Re-reading when the tab is looked at again is what makes what you are LOOKING at current,
    // which is the only moment it has to be. Cheap, and it needs no polling and no server.
    this._onWake = () => {
      if (document.visibilityState === 'visible') void this._load();
    };
    window.addEventListener('focus', this._onWake);
    document.addEventListener('visibilitychange', this._onWake);
  }

  disconnectedCallback(): void {
    window.removeEventListener('focus', this._onWake);
    document.removeEventListener('visibilitychange', this._onWake);
    super.disconnectedCallback();
  }

  updated(changed: Map<string, unknown>): void {
    if (this._firstUpdate) {
      this._firstUpdate = false;
      return;
    }
    if (changed.has('refresh') || changed.has('pipeline')) void this._load();
    // A RESET FOLDS THE TREE BACK. What is open and what is rolled up are states this element
    // holds, so the host cannot clear them — it can only ask, which is what this counter is.
    // A Reset that left rows open and a source pane on screen was a Reset that did not happen:
    // the two most visible things it was supposed to put away stayed exactly where they were.
    if (changed.has('reset')) {
      this._collapsed = new Set();
      this._expandedDeclared = new Set();
      this.requestUpdate();
    }
    // WHICH ROW IS OPEN IS THE ONE FACT THIS LIST SHOULD FOLLOW, and a mark in a list longer
    // than its pane is only useful if the list brings it where it can be seen.
    if (changed.has('selected')) this._revealSelected();
    // A WRITE REGENERATES THE MANIFEST — every approve and every removal re-runs the element
    // analyser — so the cached index is stale exactly when the host says something landed.
    if (changed.has('refresh')) void this._loadDrawn(true);
  }

  /** Guards against a slow read for one pipeline landing after a faster one for another. */
  private _loadToken = 0;

  /**
   * Read the catalogue this pipeline's components live in — the level above them.
   *
   * A failure here is REPORTED, never omitted: dropping the top level silently would say
   * "there is no catalogue above these", which is a different claim from "it could not be
   * read", and the whole point of this view is that those two are never the same picture.
   */
  private async _loadCatalog(): Promise<void> {
    try {
      const doc = await this._readCatalog(this.pipeline);
      if (!doc) throw new Error(`no catalogue named "${this.pipeline}"`);
      this._catalog = headFrom(this.pipeline, doc);
      this._catalogError = '';
    } catch (error) {
      this._catalog = null;
      this._catalogError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Read a catalogue FRESH, rather than through a module import.
   *
   * THE IMPORT IS CACHED, AND THAT IS THE BUG THIS EXISTS TO FIX. The declared list was read
   * from an ES module, so every re-render reused the copy the browser already had: approving a
   * component changed the file on disk and the list went on showing the old count until the
   * page was reloaded. A reader that cannot see what was just written is worse than no reader.
   *
   * So it FETCHES the file the dev server serves, which is source and therefore current. The
   * import stays as the fallback for a build, where `/src/` is not a URL — and the fallback is
   * sound there because a build's bundle is the catalogue as of that build, not a stale cache.
   */
  private async _readCatalog(id: string): Promise<any | null> {
    try {
      const res = await fetch(
        `/src/components/A2UI/catalogs/${encodeURIComponent(id)}/catalog.json`,
        { cache: 'no-store' }
      );
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('json')) {
        this._catalogFrom = 'the live file';
        return await res.json();
      }
    } catch {
      // Not fatal, and not silent either: the bundled copy below is the answer, and the caller
      // is told which one it got through `_catalogFrom`.
    }
    const key = Object.keys(CATALOG_MODULES).find((p) => p.split('/').slice(-2)[0] === id);
    if (!key) return null;
    const mod: any = await CATALOG_MODULES[key]();
    this._catalogFrom = 'the bundled copy (the live file could not be fetched)';
    return mod?.default ?? mod;
  }

  /** Every catalogue that exists, read from the files themselves. Failures are listed. */
  private async _loadCatalogues(): Promise<void> {
    const heads: CatalogHead[] = [];
    const failures: string[] = [];
    for (const key of Object.keys(CATALOG_MODULES).sort()) {
      const id = key.split('/').slice(-2)[0];
      try {
        const doc = await this._readCatalog(id);
        if (doc) heads.push(headFrom(id, doc));
        else failures.push(`${id}: not found`);
      } catch (error) {
        failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    this._catalogues = heads;
    this._cataloguesError = failures.join('; ');
  }

  /**
   * Read the map — the Figma layer name, and the node, behind each tag.
   *
   * FETCHED FRESH, AND THAT IS THE FIX RATHER THAN AN OPTIMISATION. This read through the
   * module import, which the browser CACHES: a component approved in this session was absent
   * from the copy the page had loaded, so its row drew as `f-40001204-5752` — no layer name,
   * and no measured layers under it — while the map on disk had held `System_Role` and its
   * node the whole time. A reader that cannot see what was just written is worse than no
   * reader. (The catalogue had the same bug and the same fix.)
   *
   * The bundled import stays as the fallback for a build, where `/src/` is not a URL and the
   * bundle is the catalogue as of that build. A failure is REPORTED rather than swallowed: the
   * list would still draw, but it would draw ids where it says it draws names.
   */
  private async _readMap(): Promise<any | null> {
    try {
      const res = await fetch('/src/components/registry.json', { cache: 'no-store' });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('json')) {
        this._mapFrom = 'the live file';
        return await res.json();
      }
    } catch {
      // Not fatal, and not silent either: which copy answered is kept in `_mapFrom`.
    }
    const key = Object.keys(MAP_MODULES)[0];
    if (!key) return null;
    const mod: any = await MAP_MODULES[key]();
    this._mapFrom = 'the bundled copy (the live file could not be fetched)';
    return mod?.default ?? mod;
  }

  private async _loadFigmaNames(): Promise<void> {
    try {
      const doc = await this._readMap();
      if (!doc) throw new Error('registry.json was not found');
      const next = new Map<string, string>();
      const nextNodes = new Map<string, string>();
      const byNode = new Map<string, string>();
      const declared = new Set((this._catalog?.declared ?? []).map((c) => c.name));
      for (const entry of doc?.components ?? []) {
        const tag = entry?.litComponent;
        const name = entry?.figmaName;
        const nodeId = entry?.figmaNodeId;
        if (typeof tag === 'string' && tag && typeof name === 'string' && name) {
          next.set(tag, name);
        }
        if (typeof tag === 'string' && tag && typeof nodeId === 'string' && nodeId) {
          nextNodes.set(tag, nodeId);
          // A NODE IS A COMPONENT ONLY WHEN THE CATALOGUE DECLARES IT, and only then may a
          // layer be marked as a reuse of one. A name match would cry wolf on the design's
          // duplicate layer names — the one thing this view must never do.
          //
          // KEYED BY COMPONENT, not by the whole id: the map stores whichever instance the
          // component was ingested from, and every OTHER instance of it in any design must
          // resolve to that same entry. Keyed by the whole id, a second instance read as "not
          // a component this catalogue has", which is the opposite of the truth.
          if (declared.has(tag)) byNode.set(nodeIdentity(nodeId), tag);
        }
      }
      this._figmaNames = next;
      this._figmaNodeIds = nextNodes;
      this._componentsByNode = byNode;
      this._figmaNamesError = '';
    } catch (error) {
      this._figmaNames = new Map();
      this._figmaNodeIds = new Map();
      this._componentsByNode = new Map();
      this._figmaNamesError = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * What to call a component in the list.
   *
   * A GENERATED component is named after its node — `f-<node id>` — so it has no word of its
   * own and the map supplies the Figma layer it came from. A HAND-BUILT component is already
   * named with a word, and the map can hold several Figma origins for one of those, so it
   * keeps its own key. When neither yields a name the key is shown: a row with no label at all
   * would be worse than a row labelled with an id.
   */
  private _label(name: string): string {
    if (!name.startsWith('f-')) return name;
    return this._figmaNames.get(name) || name;
  }

  /**
   * Read the newest approval from the activity record. See `_lastApproved` for why the
   * catalogue's own order is not used.
   */
  private async _loadLastApproved(): Promise<void> {
    try {
      const res = await fetch('/api/figma/activity?limit=50&outcomes=true', { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = await res.json();
      const approved = (data?.entries ?? []).filter((e: any) => e?.kind === 'approved');
      // The endpoint returns newest first; sorted again here so the answer does not depend on
      // that staying true.
      approved.sort((a: any, b: any) => String(b?.at || '').localeCompare(String(a?.at || '')));
      const first = approved[0];
      const tag = first
        ? String((first.tags || first.written || [])[0] || '').replace(/\.ts$/, '')
        : '';
      this._lastApproved = tag;
      this._lastApprovedNote = '';
    } catch (error) {
      this._lastApproved = '';
      this._lastApprovedNote = error instanceof Error ? error.message : String(error);
    }
  }

  /**
   * Read what draws each component — the renderer's own name resolution, and the element
   * manifest's tag-to-file map. See `_drawn` for why the list cannot be honest without it.
   */
  private async _loadDrawn(force = false): Promise<void> {
    this._drawn = await loadDrawn(force);
    this.requestUpdate();
  }

  /**
   * Read the audit's usage measurement — see `_usage`. A report that is missing or unreadable is
   * REPORTED: "nothing uses it" and "nobody measured" are different claims, and only one of them
   * is about the components.
   */
  private async _loadUsage(): Promise<void> {
    try {
      const res = await fetch(`/api/catalog/audit/${encodeURIComponent(this.pipeline)}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const doc = await res.json();
      this._usage = doc?.usage ?? null;
      this._usageError = this._usage ? '' : 'the report carries no usage measurement';
      const byComponent: Record<string, { blocking: string[]; advisory: string[] }> = {};
      for (const finding of doc?.findings ?? []) {
        const name = String(finding?.component ?? '');
        if (!name) continue;
        const bucket = (byComponent[name] ??= { blocking: [], advisory: [] });
        const what = String(finding?.what ?? '');
        if (finding?.level === 'blocking') bucket.blocking.push(what);
        else bucket.advisory.push(what);
      }
      this._findings = byComponent;
    } catch (error) {
      this._usage = null;
      this._findings = null;
      this._usageError = error instanceof Error ? error.message : String(error);
    }
    this.requestUpdate();
  }

  /**
   * WHAT THE ELEMENT ACTUALLY DOES — or says that it does nothing.
   *
   * The level above this one is what the ENTRY declares; this is what the CODE contains. They
   * are different facts and the difference is the useful part: an element can be a static
   * drawing while the design it came from has a dropdown in it, and then the honest answer is
   * not an empty list — an empty list could equally mean nobody looked. It says "empty", which
   * is a statement about the element, and names what is missing: nothing wired yet.
   */
  private _renderBehaviour(name: string, depth: number): TemplateResult {
    const entry = this._usage?.[name];
    if (!entry) return html``;
    const dispatches = entry.dispatches ?? [];
    const listens = entry.listens ?? [];
    if (entry.behaviourMeasured === false) {
      return html`<div class="lrow" style="--d:${depth}">
        <span class="lchev"></span>
        <span class="lname">behaviour</span>
        <span class="lname quiet">not measured — the renderer draws this one, not a file</span>
      </div>`;
    }
    if (!dispatches.length && !listens.length) {
      return html`<div class="lrow" style="--d:${depth}">
        <span class="lchev"></span>
        <span class="lname">behaviour</span>
        <span
          class="lfempty"
          title="The element dispatches nothing and listens for nothing. Whatever the design shows — a dropdown, a data call — none of it is wired in the element yet."
          >empty — nothing implemented in the element yet</span
        >
      </div>`;
    }
    const detail = `dispatches: ${dispatches.join(', ') || 'none'} · listens for: ${listens.join(', ') || 'none'}`;
    return html`<div class="lrow" style="--d:${depth}">
      <span class="lchev"></span>
      <span class="lname">behaviour</span>
      <span class="lname quiet" title=${detail}
        >implemented — dispatches ${dispatches.length}, listens for ${listens.length}</span
      >
    </div>`;
  }

  /**
   * WHAT IT COMPOSES — the catalogue elements this component's own template draws, as children.
   *
   * THE THIRD KIND OF CHILD, and the only one most of this catalogue can have. A measured design
   * needs a Figma node, and a hand-built component has none recorded (`prompt-section-editor`'s
   * map entry says `figmaNodeId: null`), so no design can ever be measured under it and its row
   * was childless for good. What it does have is its own template, and every element in it is a
   * row a reader can open.
   *
   * LABELLED APART FROM THE MEASURED TREE ON PURPOSE. One is what the code draws, the other is
   * what the design drew, and the two disagree exactly when the code is stale — which is the
   * finding, not a mistake. Drawing them as one list would hide it.
   */
  private _renderComposes(name: string, depth: number): TemplateResult {
    const children = this._usage?.[name]?.composes ?? [];
    if (!children.length) return html``;
    return html`
      <div class="lrow subhead" style="--d:${depth}">
        <span class="lchev"></span>
        <span class="lname">composes — the elements its own template draws</span>
      </div>
      ${children.map((child) => {
        const drawn = drawnBy(child, this._drawn);
        const usage = this._usageMark(child);
        const health = this._healthMark(child);
        return html`<div
          class="lrow opens"
          style="--d:${depth + 1}"
          role="button"
          tabindex="0"
          title="Open ${this._label(child)} in the preview"
          @click=${() => this._openComponent(child)}
          @keydown=${(e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              this._openComponent(child);
            }
          }}
        >
          <span class="ldot ${health.tone}" title=${health.title}></span>
          ${usage?.tone === 'live'
            ? html`<span class="ldot used" title=${usage.title}></span>`
            : nothing}
          <span class="lchev"></span>
          <span class="lname">${this._label(child)}</span>
          ${this._label(child) !== child
            ? html`<span class="ltag" title="the catalogue's own key for it">${child}</span>`
            : nothing}
          <span class="ldrawn ${drawn.kind}" title=${drawn.note}>${markFor(drawn)}</span>
        </div>`;
      })}
    `;
  }

  /**
   * HOW A COMPONENT STANDS, as one dot: green when the audit finds nothing against it, amber
   * when it finds only advisories, red when it finds something blocking or when nothing draws
   * the component at all, grey when nobody has measured it yet.
   *
   * GREY IS ITS OWN STATE, and deliberately: a run that did not happen and a clean result must
   * never look alike — that pair is what this whole application keeps apart.
   */
  private _healthMark(name: string): { tone: string; title: string } {
    const found = this._findings?.[name];
    const blocking = found?.blocking ?? [];
    const advisory = found?.advisory ?? [];
    const drawable = this._usage?.[name]?.drawable;
    if (blocking.length || drawable === false) {
      const why = [...blocking];
      if (drawable === false) why.push('nothing draws it — no file defines its tag');
      return { tone: 'bad', title: `${name}: ${why.join(' · ')}` };
    }
    if (advisory.length) {
      return { tone: 'warn', title: `${name}: ${advisory.join(' · ')}` };
    }
    if (drawable === undefined) {
      return { tone: 'unknown', title: `${name}: the audit has not measured it yet — this is not a clean result` };
    }
    return { tone: 'ok', title: `${name}: the audit finds nothing against it` };
  }

  /**
   * Whether anything uses this component, in the audit's terms — or null when it was not
   * measured, so a row can say nothing rather than claim "not used".
   */
  private _usageMark(name: string): { text: string; title: string; tone: string } | null {
    const entry = this._usage?.[name];
    if (!entry) return null;
    const short = (p: string) => p.split('/').pop() || p;
    const sent = entry.sent ?? [];
    const renderedIn = entry.renderedIn ?? [];
    if (sent.length) {
      return {
        text: 'sent by the app',
        title: `In use — named as a component in a payload the app sends, from: ${sent.join(', ')}`,
        tone: 'live',
      };
    }
    if (renderedIn.length) {
      return {
        text: `drawn inside ${short(renderedIn[0])}`,
        title: `In use — its tag is drawn in the template of: ${renderedIn.join(', ')}`,
        tone: 'live',
      };
    }
    return {
      text: 'not in use',
      title:
        'Nothing the app sends names it and no template draws it: it is available to compose with, and nothing uses it today.',
      tone: 'idle',
    };
  }

  /**
   * The Figma layer a component was drawn from, as a chip beside its key: the layer name and
   * the node id, from the map.
   *
   * ASKED BY TAG, NOT BY NAME. The map is keyed by `litComponent`, which is the ELEMENT tag —
   * so `AgentFlow` misses and `<agent-flow>` hits, which is the same name-is-not-a-tag mistake
   * that made these rows unreadable in the first place.
   *
   * Null when the map holds nothing for it: an origin that is not recorded is said by the
   * absence of the chip, and a guessed one would be believed.
   */
  private _originFor(name: string): { text: string; title: string } | null {
    const tag = tagFor(name);
    const layer = this._figmaNames.get(tag);
    const node = this._figmaNodeIds.get(tag);
    if (!node) return null;
    const { identity, location } = describeNodeId(node);
    return {
      // THE NODE IS WHAT THE CHIP CARRIES, because the layer name IS the row's label now —
      // repeating it beside itself would be the row saying one thing twice.
      text: node,
      // THE TITLE SAYS WHICH HALF IS WHICH, because the two halves mean different things: the
      // component part under the semicolon is what this row IS, and the occurrence after it is
      // only where the instance that was ingested happened to sit.
      title:
        `From the Figma map: ${layer ? `layer "${layer}"` : 'a layer it does not name'}. ` +
        `Component ${identity}` +
        (location ? ` — this was the instance at ${location} (a location, not the component)` : '') +
        ` · full node ${node}`,
    };
  }

  /** Move to another catalogue. The host is told too, so a screen showing both can follow. */
  private _selectPipeline(id: string): void {
    if (id === this.pipeline) return;
    this.pipeline = id;
    // Both expansion sets are cleared: they are keyed by layer id and by component NAME, and a
    // name like "Text" exists in more than one catalogue — so a row opened here would come up
    // opened in a catalogue nobody opened it in.
    this._collapsed = new Set();
    this._expandedDeclared = new Set();
    void this._load();
    this.dispatchEvent(
      new CustomEvent('catalog-change', {
        detail: { catalogId: id },
        bubbles: true,
        composed: true,
      })
    );
  }

  private async _load(): Promise<void> {
    const token = ++this._loadToken;
    this._state = 'loading';
    this._reason = '';
    this.requestUpdate();

    await this._loadCatalogues();
    await this._loadCatalog();
    await this._loadFigmaNames();
    await this._loadLastApproved();
    await this._loadDrawn();
    await this._loadUsage();

    try {
      const res = await fetch(`/catalog-figma/${encodeURIComponent(this.pipeline)}.json`, { cache: 'no-store' });
      if (token !== this._loadToken) return; // a newer read won
      const contentType = res.headers.get('content-type') ?? '';

      // ABSENT IS NOT AN ERROR, AND IT IS NOT AN EMPTY TREE. A component's tree is written
      // when it is approved; before the first approval for a pipeline there is no record at
      // all, and showing "0 layers" would report "this design has no layers" instead.
      //
      // The dev server answers a request for a path that does not exist with the app's own
      // index.html rather than a 404 — so absence arrives as HTML with a 200. Checking the
      // content type is what catches that: a JSON file is JSON, and anything else here is
      // the fallback page standing in for a file that is not there.
      if (res.status === 404 || !contentType.includes('json')) {
        this._state = 'absent';
        this._doc = null;
        this.requestUpdate();
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const doc = (await res.json()) as LayersDocument;
      if (token !== this._loadToken) return; // a newer read won while this one parsed
      this._doc = doc;
      this._state = 'ready';
    } catch (error) {
      if (token !== this._loadToken) return;
      this._state = 'failed';
      this._reason = error instanceof Error ? error.message : String(error);
      this._doc = null;
    }
    this.requestUpdate();
  }

  private _renderLayer(
    layer: Layer,
    names: Map<string, NameUse>,
    flagged: Set<string>,
    depth: number,
    record: string
  ): TemplateResult {
    const name = layer?.name || '(no name)';
    const id = layer?.id || '(no id)';
    const type = layer?.type || '';
    const isFlagged = !!layer?.name && flagged.has(layer.name);
    const use = layer?.name ? names.get(layer.name) : undefined;
    const isReuse = !!use && use.count > 1 && use.componentIds.size === 1 && !!layer?.componentId;
    // A LAYER THAT IS A COMPONENT THIS CATALOGUE ALREADY HAS — the design reusing its own design
    // system, which is the one thing a designer has to be able to see here. An INSTANCE names
    // the component it is an instance OF; a layer can also BE that component's own node.
    //
    // MATCHED BY NODE, NEVER BY NAME. The design repeats layer names deliberately — two
    // chevron-blue-closed in one frame — so a name match would mark drawings that are not the
    // component at all, and a mark that cries wolf is not believed when it matters.
    //
    // AND MATCHED BY THE COMPONENT PART OF THE NODE (`nodeIdentity`), so an instance sitting in
    // any location resolves to the component it is an instance of: `I…;…` is the same component
    // as the reference before the semicolon, and the occurrence — the numbers that tell one
    // instance from another — is exactly what must NOT be compared here.
    const asComponent =
      this._componentsByNode.get(nodeIdentity(layer?.componentId)) ||
      this._componentsByNode.get(nodeIdentity(layer?.id)) ||
      '';

    const children = layer?.children ?? [];
    const hasChildren = children.length > 0;
    // Keyed by the record it is drawn under, so the same layer id appearing in two recorded
    // trees does not open and close in both at once.
    const key = `${record}/${id}`;
    const isOpen = !this._collapsed.has(key);

    return html`
      <div
        class="lrow ${isFlagged ? 'dup' : ''} ${hasChildren ? 'branch' : ''} opens"
        style="--d:${depth}"
        role="button"
        tabindex="0"
        title=${asComponent
          ? `Open ${asComponent} in the preview`
          : `Open ${name} — the layer itself, as it was measured`}
        @click=${(e: Event) => {
          e.stopPropagation();
          if (asComponent) this._openComponent(asComponent);
          else this._openLayer(layer, record, '');
        }}
        @keydown=${(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            if (asComponent) this._openComponent(asComponent);
            else this._openLayer(layer, record, '');
          }
        }}
      >
        ${/* THE CHEVRON IS THE ACCORDION, AND THE ROW IS THE THING YOU LOAD.
              The whole row used to toggle, so nothing in the design's tree could be selected —
              and the one part that looks like a control did nothing on its own. A chevron
              expands; anything that is a component in the catalogue opens in the preview. A
              layer that is neither has nothing to open, so its body is not a control at all and
              the chevron keeps the whole job. */ ''}
        <span
          class="lchev ${hasChildren ? 'clicky' : ''}"
          role=${hasChildren ? 'button' : nothing}
          tabindex=${hasChildren ? '0' : nothing}
          aria-label=${hasChildren ? (isOpen ? 'collapse' : 'expand') : nothing}
          @click=${hasChildren
            ? (e: Event) => {
                e.stopPropagation();
                this._toggleLayer(key);
              }
            : nothing}
          @keydown=${hasChildren
            ? (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  this._toggleLayer(key);
                }
              }
            : nothing}
          >${hasChildren ? (isOpen ? '▾' : '▸') : ''}</span
        >
        <span class="lname">${name}</span>
        ${asComponent
          ? html`<span
              class="lcatalog"
              title="this is a component the catalogue already has, reused in this design"
              >in the catalogue: ${asComponent}</span
            >`
          : nothing}
        <span class="ltype">${type}</span>
        ${layer?.componentId
          ? html`<span
              class="lcomp"
              title="this layer is an instance of that component — the reference before the semicolon says WHICH component, the part after it only says where this instance sits"
              >↳ ${nodeIdentity(layer.componentId)}</span
            >`
          : nothing}
        ${layer?.componentId && nodeLocation(layer.componentId)
          ? html`<span
              class="lloc"
              title="the occurrence — the location of this instance (the numbers after the colon), not part of the component's identity"
              >at ${nodeLocation(layer.componentId)}</span
            >`
          : nothing}
        ${isReuse ? html`<span class="lreuse">one of ${use!.count}</span>` : nothing}
        <span class="lid" title=${this._nodeTitle(String(id))}>${id}</span>
        ${layer?.text ? html`<span class="ltext">"${layer.text}"</span>` : nothing}
      </div>
      ${/* A LAYER THAT IS ONE OF OURS CARRIES ITS FUNCTIONS, one level down: this is where a
            designer sees what the thing they are reusing actually does. */ ''}
      ${asComponent ? this._renderFunctions(asComponent, depth + 1) : nothing}
      ${hasChildren && isOpen
        ? children.map((c) => this._renderLayer(c, names, flagged, depth + 1, record))
        : nothing}
    `;
  }

  /**
   * The measured layers of one record, and what is worth saying about them — WITHOUT the
   * record's own header. Split out because this belongs in two places: under the component it
   * belongs to (which is where a reader looks for it), and under a record whose component is
   * not in this catalogue at all.
   *
   * `depth` is the indent the tree starts at, so it can sit inside a component's expansion
   * rather than at the left edge.
   */
  private _renderLayerTree(rec: NodeRecord, depth: number): TemplateResult {
    const names = analyseNames(rec.tree);

    // THE ROOT OF A RECORD'S TREE IS THE NODE THAT WAS INGESTED — the component itself. Every
    // caller here already draws that node in the row above (its layer name, its tag, its node
    // id — that row IS the node), so drawing the tree from its root printed the component
    // twice, one line apart: the same name, the same id, the same frame, and a reader left
    // working out whether those two are one thing or a duplicate. The children are what the
    // row has not said yet.
    //
    // A node with nothing inside it is the exception: then it is all there is to show, and a
    // blank space under a header reads as a read that failed.
    const inside = rec.tree?.children ?? [];
    const layers = inside.length ? inside : rec.tree ? [rec.tree] : [];

    // Flagged: a name used more than once where the uses are NOT all instances of a single
    // component — i.e. separate drawings under one name.
    const flagged = new Set(
      [...names.entries()]
        .filter(([, use]) => use.count > 1 && use.componentIds.size !== 1)
        .map(([name]) => name)
    );

    // Reuse: a name used more than once where every use IS an instance of one component.
    const reuse = [...names.entries()].filter(
      ([, use]) => use.count > 1 && use.componentIds.size === 1
    );

    return html`
      ${reuse.length
        ? html`<div class="reusen">
            ${reuse.length} name${reuse.length === 1 ? '' : 's'} used more than once where every use is an
            instance of one component:
            ${reuse.map(
              ([name, use]) => html`<code>${name}</code> ×${use.count} of
                <code>${[...use.componentIds][0]}</code>`
            )}
            — the design reusing a component it already has. Correct; marked so it is not
            mistaken for a fault.
          </div>`
        : nothing}

      ${flagged.size
        ? html`<div class="dupn">
            ${flagged.size} layer name${flagged.size === 1 ? '' : 's'} drawn more than once
            <em>without</em> a shared component:
            ${[...flagged].map((name) => html`<code>${name}</code>`)} — marked below. These are
            separate drawings under one name, and nothing downstream can tell them apart.
          </div>`
        : nothing}

      ${rec.tree
        ? layers.map((l) => this._renderLayer(l, names, flagged, depth, rec.nodeId || rec.tag || ''))
        : html`<div class="lrow" style="--d:${depth}">(no tree recorded)</div>`}
    `;
  }

  private _renderNode(nodeId: string, rec: NodeRecord, justAdded: boolean): TemplateResult {
    return html`
      <div class="node ${justAdded ? 'just' : ''}">
        <div class="nhead">
          <span class="ntag">${rec.tag || '(no tag)'}</span>
          ${/* The tree below no longer draws its root, so a record's own layer name and text are
                kept here — this header is the only place they are said. */ ''}
          ${rec.tree?.name ? html`<span class="lname">${rec.tree.name}</span>` : nothing}
          <span class="nid">${nodeId}</span>
          ${rec.tree?.text ? html`<span class="ltext">"${rec.tree.text}"</span>` : nothing}
          ${justAdded ? html`<span class="newmark">just added</span>` : nothing}
          <span class="nmeta">${rec.layers ?? 0} layers · approved ${rec.approvedAt || 'at an unrecorded time'}</span>
        </div>
        ${this._renderLayerTree(rec, 0)}
      </div>
    `;
  }

  /**
   * The measured layers of one declared component, inside that component's own row.
   *
   * THIS IS WHY THE TWO TREES WERE MERGED. A component is two facts at once — what the
   * catalogue declares it accepts, and the design it was drawn from — and they were drawn in
   * two separate sections, so expanding a component showed only its properties while its
   * layers sat below with nothing tying them to it. One component, one row, both facts.
   */
  private _renderMeasuredFor(tag: string): TemplateResult {
    const nodeId = this._figmaNodeIds.get(tag);
    const rec = nodeId ? this._doc?.nodes?.[nodeId] : undefined;

    if (rec) {
      return html`
        <div class="lrow subhead" style="--d:1">
          <span class="lchev"></span>
          <span class="lname">measured from Figma — node ${nodeId} · ${rec.layers ?? 0} layers</span>
          ${/* THE ROOT IS NOT DRAWN BELOW (see _renderLayerTree), so the two facts it can carry
                that the row above does not already state are kept here rather than dropped. */ ''}
          ${rec.tree?.type ? html`<span class="ltype">${rec.tree.type}</span>` : nothing}
          ${rec.tree?.text ? html`<span class="ltext">"${rec.tree.text}"</span>` : nothing}
        </div>
        ${this._renderLayerTree(rec, 1)}
      `;
    }

    // A READ THAT FAILED IS NOT AN ABSENT RECORD, and this is the one place the two would
    // otherwise collapse into the same sentence: a failed read leaves no record in hand, so
    // saying nothing below would claim a design has no layers when the truth is that nobody
    // could look.
    if (this._state === 'failed') {
      return html`<div class="lrow" style="--d:1">
        <span class="lchev"></span>
        <span class="lname quiet">its layers could not be read: ${this._reason}</span>
      </div>`;
    }

    // NO LINE FOR A COMPONENT WITH NO RECORD. There was one — "layers not recorded yet" — and it
    // was true, but it sat exactly where the children belong and said a negative every time the
    // row was opened, which reads as the list being broken rather than as a design not having
    // been approved yet. A component with no measured design simply shows what it declares.
    return html``;
  }

  private _toggleLayer(key: string): void {
    if (this._collapsed.has(key)) this._collapsed.delete(key);
    else this._collapsed.add(key);
    this.requestUpdate();
  }

  /** Bring the row for the open component into view — see `updated`. */
  private _revealSelected(): void {
    const row = this.renderRoot.querySelector('.lrow.on');
    if (row) row.scrollIntoView({ block: 'nearest' });
  }

  /**
   * Tell the host to open this component in its preview.
   *
   * THE TREE IS A NAVIGATION — the most ordinary one there is. It lists what the catalogue
   * holds, one row per component, and clicking a row is how you get to that component. A tree
   * whose rows only expand is a list of names you cannot go anywhere from.
   *
   * The chevron keeps the expanding, with its own handler and `stopPropagation`, so one click
   * does one thing: the row goes there, the chevron opens it up. Both were the row before.
   */
  private _openComponent(tag: string): void {
    this.dispatchEvent(
      new CustomEvent('open-component', {
        detail: { tag },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Open a LAYER — the design's own node, when it is not a component of the catalogue.
   *
   * EVERY ROW IN THIS TREE CAN BE OPENED, or the tree is only half navigable: a designer clicks
   * `chevron-blue-closed` because it is a thing in the design they want to look at, and a row
   * that does nothing because "it isn't a component" answers a question they did not ask. What a
   * layer has is its MEASUREMENT — type, size, position, the layout it imposes, its text, the
   * component it is an instance of — and that is what the host can show for it. Whether it is
   * also a component of the catalogue is a separate fact, and it travels with it (`tag` empty
   * means nothing draws it).
   */
  private _openLayer(layer: Layer, record: string, tag: string): void {
    this.dispatchEvent(
      new CustomEvent('open-layer', {
        detail: {
          record,
          tag,
          id: layer?.id ?? '',
          name: layer?.name ?? '',
          type: layer?.type ?? '',
          size: layer?.size ?? null,
          text: layer?.text ?? '',
          componentId: layer?.componentId ?? '',
          fill: layer?.fill ?? '',
          layout: layer?.layout ?? null,
          typeStyle: layer?.type_style ?? null,
          // NO ARTWORK TRAVELS WITH THIS. The node's vendored pictures used to be sent here so the
          // pane could show a designer the vectors the design carried — which meant the pane drew
          // whatever the repository was holding rather than the design being previewed, and drew
          // a removed or superseded version of it back onto the screen. The pane reads nothing
          // now; see IngestModal's layer view.
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Open a FUNCTION in the preview: the component's own source, where that behaviour is written.
   *
   * A function is not something a tree can show — it has no children and no size. It is written
   * in a file, so clicking one opens the file, the same way clicking a component row opens its
   * element. `module` travels with it because the tree has already resolved which file draws
   * this tag, and the host must not resolve it a second time and possibly differently.
   */
  private _openFunction(tag: string, event: string, module: string): void {
    this.dispatchEvent(
      new CustomEvent('open-function', {
        detail: { tag, event, module },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * THE FUNCTIONS LEVEL — what the allowlist says this component does, directly under the
   * component itself, because that is the item the behaviour is tied to.
   *
   * THE ENTRY'S WORDS, NOT A SCAN OF THE CODE. The audit already searches the sources for
   * `dispatchEvent(...)` and reports where the two disagree — that is a finding, and it is
   * reported where findings live. What a person auditing a catalogue needs here is what the
   * entry DECLARES, so that the disagreement is visible at all.
   *
   * A component the allowlist does not hold gets that said rather than a blank: an empty level
   * and an absent entry look identical otherwise, and one of them is a gap worth fixing.
   */
  private _renderFunctions(name: string, depth: number): TemplateResult {
    const tag = tagFor(name);
    const contract = contractFor(tag);
    const drawn = drawnBy(name, this._drawn);
    if (!contract) {
      return html`<div class="lrow" style="--d:${depth}">
        <span class="lchev"></span>
        <span class="lname quiet">no entry in the allowlist — nothing declares what it does</span>
      </div>`;
    }
    return html`
      <div class="lrow" style="--d:${depth}">
        <span class="lchev"></span>
        <span class="lname">functions</span>
        ${contract.events.length
          ? contract.events.map(
              (e) => html`<button
                type="button"
                class="lfner"
                title="Open ${tag}'s source at ${e}"
                @click=${(ev: Event) => {
                  ev.stopPropagation();
                  if (drawn.module) this._openFunction(tag, e, drawn.module);
                }}
              >${e}</button>`
            )
          : html`<span class="lname quiet">none listed</span>`}
        ${/* THE FILE ITSELF, still one click away. The entry's DESCRIPTION is in the row's own
              column now rather than repeated here, but the source is not a description — it is the
              implementation, and a component with no events listed would otherwise have no way to
              reach it. */ ''}
        ${drawn.module
          ? html`<button
              type="button"
              class="lfner"
              title="Open ${drawn.module} in the preview"
              @click=${(ev: Event) => {
                ev.stopPropagation();
                this._openFunction(tag, '', drawn.module);
              }}
            >source</button>`
          : nothing}
      </div>
      ${this._renderBehaviour(name, depth)}
    `;
  }

  private _toggleDeclared(key: string): void {
    if (this._expandedDeclared.has(key)) this._expandedDeclared.delete(key);
    else this._expandedDeclared.add(key);
    this.requestUpdate();
  }

  /**
   * THE CATALOGUE'S OWN TREE — every component it declares, and what each one accepts.
   *
   * This level exists whether or not anything has been ingested into the catalogue. The
   * measured Figma layers are a record of APPROVED work, so they exist only for components
   * that have been through an ingest — and a catalogue nobody has ingested into would
   * otherwise show an empty box, which reads as "there is nothing here" rather than "nothing
   * has been measured here". Two trees, two files, and each section says which it is.
   */
  private _renderDeclared(): TemplateResult {
    const catalog = this._catalog;
    // Nothing to declare when the catalogue itself could not be read — the catalogue block
    // above already says so, and an empty tree here would be a second, quieter claim.
    if (!catalog) return html``;

    // THE LIST DOES NOT REORDER ITSELF. It used to float the most recently approved component
    // to the top, out of file order, marked "just added" — which made the list disagree with
    // what was open in the preview and put a fact about the PAST where a reader looks for the
    // present. "What did I just add" is answered by the record below; "what am I looking at" is
    // answered by marking the selected row, which is the only thing this list should move.

    const count = catalog.components;
    return html`<div class="sect">
      <div class="secthead">Declared in this catalogue — ${count} component${count === 1 ? '' : 's'}</div>
      <div class="sectnote">
        from <code>catalog.json</code>: every name this catalogue allows, the shape its entry is
        written in, and the values it accepts. The chip beside a name is what <em>draws</em> it —
        the renderer's own resolution and the element manifest's answer, not a guess from the
        name — the blue chip says whether anything <em>uses</em> it, and the quiet one is the
        Figma layer it came from.
        ${this._usageError
          ? html` Whether anything uses a component could not be read (${this._usageError}), so no
              row says.`
          : nothing}
        ${this._figmaNamesError
          ? html` Figma layer names could not be read from the map (${this._figmaNamesError}),
              so generated components below are shown under their ids.`
          : nothing}
        ${this._lastApprovedNote
          ? html` The record of what was approved could not be read (${this._lastApprovedNote}),
              so nothing here is marked as just added.`
          : nothing}
      </div>

      ${/* THE UPDATE, MADE VISIBLE. An approve or a removal changes this list, and the change
            has to be announced rather than just happen — the spinner is what says "the list is
            being re-read", so an unchanged list afterwards is understood as the answer rather
            than as nothing having happened. The rows stay on screen underneath while it spins:
            emptying the list to reload it would make every update a blank. */ ''}
      ${this._state === 'loading'
        ? html`<div class="lrow reloading" style="--d:0">
            <span class="spin" aria-hidden="true"></span>
            <span class="lname quiet">re-reading the list…</span>
          </div>`
        : nothing}

      ${catalog.declared.map((comp) => {
        const key = `declared/${comp.name}`;
        const isOpen = this._expandedDeclared.has(key);
        const isSelected = !!this.selected && comp.name === this.selected;
        const drawn = drawnBy(comp.name, this._drawn);
        const origin = this._originFor(comp.name);
        const usage = this._usageMark(comp.name);
        const health = this._healthMark(comp.name);
        return html`
          <div
            class="lrow branch ${isSelected ? 'on' : ''}"
            style="--d:0"
            role="button"
            tabindex="0"
            aria-expanded=${String(isOpen)}
            title="Open ${this._label(comp.name)} in the preview"
            @click=${() => this._openComponent(comp.name)}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this._openComponent(comp.name);
              }
            }}
          >
            ${/* TWO DOTS, TWO QUESTIONS, LEFT OF THE CHEVRON. The first is the audit's verdict —
                  green clean, amber advisory, red blocking or undrawable, grey unmeasured. The
                  second is only ever the one colour, and only when it is true: the purple says
                  the application's own interface uses this component today. A dot you have to
                  hunt for is a dot nobody reads, so both sit where the eye already goes. */ ''}
            <span class="ldot ${health.tone}" title=${health.title}></span>
            ${usage?.tone === 'live'
              ? html`<span class="ldot used" title=${usage.title}></span>`
              : nothing}
            <span
              class="lchev"
              role="button"
              tabindex="0"
              aria-label=${isOpen ? 'collapse' : 'expand'}
              @click=${(e: Event) => {
                e.stopPropagation();
                this._toggleDeclared(key);
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  this._toggleDeclared(key);
                }
              }}
              >${isOpen ? '▾' : '▸'}</span
            >
            ${/* BOTH NAMES, NOT ONE. The LABEL is what the designer calls it — the Figma layer —
                  and the TAG is what the tool addresses. Replacing one with the other lost
                  whichever was dropped: `f-40001204-5752` alone is unreadable, and `System_Role`
                  alone cannot be found in the catalogue. Beside each other they cross-reference,
                  which is the only way to tell that they are one thing. */ ''}
            <span class="lname">${this._label(comp.name)}</span>
            ${isSelected
              ? html`<span class="lonmark" title="this is the component the preview is showing"
                  >open in the preview</span
                >`
              : nothing}
            ${this._label(comp.name) !== comp.name
              ? html`<span class="ltag" title="the catalogue's own key for it">${comp.name}</span>`
              : nothing}
            ${origin ? html`<span class="lorigin" title=${origin.title}>${origin.text}</span>` : nothing}
            <span class="shape">${comp.shape}</span>
            ${/* WHETHER IT IS THERE, ON THE ROW. One click used to be the only way to find out,
                  and the answer on the other side was about the Figma map rather than the
                  file. This is the file's answer, and it is the same resolution the preview
                  loads from — so the row and the pane cannot disagree. */ ''}
            <span class="ldrawn ${drawn.kind}" title=${drawn.note}>${markFor(drawn)}</span>
            ${usage ? html`<span class="luse ${usage.tone}" title=${usage.title}>${usage.text}</span>` : nothing}
            <span class="lid">${comp.props.length} propert${comp.props.length === 1 ? 'y' : 'ies'}</span>
          </div>
          ${isOpen
            ? html`
                ${/* THE FUNCTIONS COME FIRST: what it does is what a person is auditing for, and
                      the declaration below it is the machine's contract. */ ''}
                ${this._renderFunctions(comp.name, 1)}
                ${comp.props.map(
                  (p) => html`<div class="lrow" style="--d:1">
                    <span class="lchev"></span>
                    <span class="lname">${p}</span>
                    ${comp.required.includes(p) ? html`<span class="lreuse">required</span>` : nothing}
                  </div>`
                )}
                ${this._renderComposes(comp.name, 1)}
                ${this._renderMeasuredFor(tagFor(comp.name))}
              `
            : nothing}
        `;
      })}
    </div>`;
  }

  /**
   * What a node id means, said in the row's own title.
   *
   * The two halves are different facts and the row shows them as one string, so the title is
   * where the split is stated: the component part is what this layer IS, and the occurrence is
   * only the location the instance sits in. A reader who takes the whole string for the
   * component's name is how a second instance came to look like a second component.
   */
  private _nodeTitle(id: string): string {
    const { identity, location } = describeNodeId(id);
    if (!location) return `${id} — this node IS the component (no occurrence: it is not an instance)`;
    return `${id} — component ${identity}, instance at ${location} (a location, not the component)`;
  }

  /**
   * THE LEVEL ABOVE THE CATALOGUE — the catalogues that exist, and which one is being read.
   *
   * Drawn as a list rather than as a parent node, because a list is what the data has: three
   * documents side by side with nothing holding them. The heading names the three fields every
   * catalogue carries, so the level says what identifies one.
   *
   * A catalogue that failed to read is REPORTED here, not dropped from the list: a list that
   * quietly loses one says "there are two", which is a different claim from "there are three
   * and one could not be read".
   */
  private _renderCatalogueSet(): TemplateResult {
    return html`<div class="set">
      <div class="settitle">Raibach IDS Catalogs</div>
      <div class="setmeta">
        the catalogues in this repository — no file holds them; three documents side by side,
        each carrying its own <code>$schema</code>, <code>$id</code> and <code>catalogId</code>
      </div>
      <div class="setlist">
        ${this._catalogues.map(
          (c) => html`<button
            type="button"
            class="setitem ${c.id === this.pipeline ? 'on' : ''}"
            title=${c.title}
            @click=${() => this._selectPipeline(c.id)}
          >
            <span class="setid">${c.id}</span>
            <span class="setcount">${c.components}</span>
          </button>`
        )}
      </div>
      ${this._cataloguesError
        ? html`<div class="setbad">Not read: ${this._cataloguesError}</div>`
        : nothing}
    </div>`;
  }

  /**
   * THE MEASURED LAYERS — the designs actually approved into this catalogue.
   *
   * Distinct from the declared list above and labelled as such: that section is what the
   * catalogue SAYS it allows, this one is what has been through an ingest and written down. A
   * catalogue with nothing ingested into it is not empty — it is a catalogue whose designs have
   * not been measured — and this says exactly that rather than showing a blank.
   */
  private _renderRecord(): TemplateResult {
    const doc = this._doc;
    const recorded = Object.keys(doc?.nodes ?? {});
    const declared = new Set((this._catalog?.declared ?? []).map((c) => c.name));
    // ONLY WHAT THE CATALOGUE DOES NOT ACCOUNT FOR. Every other record is drawn inside its own
    // component's row above — that is where a reader looks for a component's layers, and
    // keeping a second copy of them down here was two places for one fact to disagree.
    //
    // AND NOT WHAT WAS REMOVED. The record keeps the approval (who approved what, and when) and
    // it keeps the removal beside it (`removed[<node>]`), because a design that was measured,
    // approved and then deleted by hand is a fact about this catalogue and belongs in its
    // history. The FRONT is not where history is read: a component the owner deleted showing up
    // under a heading about what this catalogue holds reads as a claim that it is still here,
    // and the removal is not this screen's to remember. (Owner, 2026-09-29: *"There should be a
    // record of me deleting it — user removal… There's no point to show that on the front."*)
    const removed = new Set(Object.keys((doc as { removed?: Record<string, unknown> })?.removed ?? {}));
    const orphans = recorded.filter(
      (id) => !removed.has(id) && !declared.has(doc?.nodes?.[id]?.tag || id)
    );

    if (this._state === 'loading') {
      return html`<div class="sect"><div class="secthead">The layer record</div>
        <div class="empty">Reading it…</div>
      </div>`;
    }
    if (this._state === 'failed') {
      return html`<div class="sect"><div class="secthead">The layer record</div>
        <div class="empty bad">
          It could not be read: ${this._reason}. No component above has its layers until it can
          be — this is not "none of them do".
        </div>
      </div>`;
    }
    if (!orphans.length) return html``;

    const count = orphans.length;
    return html`<div class="sect">
      <div class="secthead">Recorded, not in this catalogue — ${count}</div>
      <div class="sectnote">
        these designs were measured and approved, and they are not declared here now. They are
        kept because a record the catalogue cannot account for is still a fact about what
        happened. A design that was removed is not among them: the removal is written into the
        same record (who, when, why) and is history rather than a row here.
      </div>
      ${orphans.map((id) => this._renderNode(id, doc!.nodes![id], false))}
    </div>`;
  }

  /**
   * The catalogue, as its own file declares it — the level these components sit under.
   *
   * It is drawn from catalog.json, not from the layer record, because the catalogue is the
   * authority on its own name and its own id. Two sources, two facts: the catalogue says what
   * it is, the layer record says what has been approved into it.
   */
  private _renderCatalog(): TemplateResult {
    if (!this._catalog) {
      return html`<div class="cat bad">
        <div class="cattitle">The catalogue above these components could not be read.</div>
        <div class="catmeta">${this._catalogError || 'no reason recorded'}</div>
      </div>`;
    }
    return html`<div class="cat">
      <div class="cattitle">${this._catalog.title}</div>
      <div class="catmeta">
        <span class="catcount">${this._catalog.components} components</span>
        <code>${this._catalog.catalogId}</code>
      </div>
    </div>`;
  }

  render() {
    const doc = this._doc;
    const recorded = Object.keys(doc?.nodes ?? {});
    // A form reads the node it just ingested; the overlay reads everything recorded.
    const nodeIds = this.nodeId ? recorded.filter((id) => id === this.nodeId) : recorded;

    return html`
      <div class="wrap ${this.open ? 'open' : ''} ${this.inline ? 'inline' : ''}">
        <button
          type="button"
          class="head"
          @click=${() => {
            this._toggled = true;
            this.open = !this.open;
          }}
        >
          <span class="htitle">Figma layers${this.nodeId ? '' : ` — ${this.pipeline}`}</span>
          <span class="hstate">
            ${this._state === 'loading'
              ? html`<span class="spin" aria-hidden="true"></span> reading…`
              : this._state === 'ready'
                ? `${nodeIds.length} node${nodeIds.length === 1 ? '' : 's'}`
                : this._state === 'absent'
                  ? 'no record yet'
                  : 'could not read'}
          </span>
          <span class="chev">${this.open ? '▾' : '▸'}</span>
        </button>

        ${this.open
          ? html`
              <div class="body">
                ${this._renderCatalogueSet()}
                ${this._renderCatalog()}
                ${this._renderDeclared()}
                ${this._renderRecord()}
              </div>
            `
          : nothing}
      </div>
    `;
  }

  static styles = css`
    :host {
      /* A column, so the one part meant to grow, .body, can. Harmless to the overlay, whose
         .wrap is fixed-positioned and therefore out of this flow. */
      display: flex;
      flex-direction: column;
      min-height: 0;
      font-family: 'Inter', system-ui, sans-serif;
    }
    .wrap {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 80;
      width: 520px;
      max-width: calc(100vw - 32px);
      background: #ffffff;
      border: 1px solid #cbd5d9;
      border-radius: 8px;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }
    .wrap.open { max-height: calc(100vh - 64px); }

    /* In the flow of a form, rather than floating over the screen: it takes the height its
       host gives it and scrolls its own body, so it fills the column instead of stopping at
       an arbitrary cap and leaving dead space under it. */
    .wrap.inline {
      position: static;
      right: auto;
      bottom: auto;
      width: auto;
      max-width: none;
      box-shadow: none;
      /* Grows into whatever height the host was given. A height of 100% here would need the
         host to have a resolved height, which a flex item does not promise; taking the space
         as a flex item does not depend on that. */
      flex: 1;
      min-height: 0;
    }
    .wrap.inline.open { max-height: none; }

    .head {
      font-family: inherit;
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 12px;
      background: #f2f7f8;
      border: none;
      border-bottom: 1px solid #e3e8ea;
      cursor: pointer;
      text-align: left;
    }
    .htitle { font-size: 12px; font-weight: 700; color: #171717; }
    .hstate { font-size: 11px; color: #2793a3; margin-left: auto; }

    /* The read in progress. A record that is being fetched must not look like one that came
       back empty — that is why there is a spinner here and not just the word "reading". */
    .spin {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 5px;
      vertical-align: -1px;
      border: 2px solid #cbe6e3;
      border-top-color: #1facc2;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    @media (prefers-reduced-motion: reduce) {
      .spin { animation-duration: 2.4s; }
    }
    .chev { font-size: 10px; color: #9aa6ad; }

    .body {
      /* The one part that grows: the header keeps its height, the tree takes the rest and
         scrolls inside itself. */
      flex: 1;
      min-height: 0;
      padding: 8px 0 12px;
      overflow: auto;
    }
    .empty { padding: 10px 12px; font-size: 12px; line-height: 1.5; color: #5b666e; }
    .empty.bad { color: #a3331f; }
    .empty code { font-family: ui-monospace, Menlo, monospace; }

    /* ── A SECTION OF THE TREE, and which file it came from ─────────────── */
    .sect { margin-bottom: 10px; }
    .secthead {
      padding: 3px 12px 1px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.02em;
      color: #2793a3;
    }
    .sectnote {
      padding: 0 12px 5px;
      font-size: 10.5px;
      line-height: 1.5;
      color: #8a9499;
      max-width: 90ch;
    }
    .sectnote code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #eef1f3;
      border-radius: 3px;
      padding: 0 3px;
    }
    .shape {
      flex-shrink: 0;
      font-size: 10px;
      color: #2793a3;
      background: #eef7f8;
      border-radius: 4px;
      padding: 0 5px;
    }

    /* ── WHAT DRAWS IT, AND WHERE IT CAME FROM ──────────────────────────────
       Two chips, two questions, both answered on the row. .lorigin is provenance — the Figma
       layer and node the map records. .ldrawn is existence — a file, the renderer, or nothing.
       They are separate because they are separate facts: the map says nothing about whether a
       component can be drawn, which is exactly how 33 drawable rows came to look like missing
       files. */
    .lorigin {
      flex-shrink: 0;
      font-size: 10px;
      color: #46535b;
      background: #f2f4f5;
      border-radius: 4px;
      padding: 0 5px;
      max-width: 24ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    /* THE CATALOGUE'S OWN KEY — f-40001204-5752 beside the layer a designer knows it as. */
    .ltag {
      flex-shrink: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      color: #171717;
      background: #eef1f3;
      border-radius: 4px;
      padding: 0 5px;
    }
    /* A LAYER THE CATALOGUE ALREADY DRAWS. Green, like every other "this exists" mark here,
       because that is the fact it carries: the design is reusing it, not redrawing it. */
    .lcatalog {
      flex-shrink: 0;
      font-size: 10px;
      color: #2f7d36;
      background: #eaf6ea;
      border-radius: 4px;
      padding: 0 5px;
      white-space: nowrap;
    }

    /* THE ONE OPEN IN THE PREVIEW — the only mark in this list about the PRESENT: which row the
       middle pane is showing. A bar rather than a border, so it costs the row no width and every
       line under it keeps its alignment. */
    .lrow.on {
      background: #eef4fb;
      box-shadow: inset 3px 0 0 0 #1f5f8b;
    }
    .lrow.on .lname { color: #17456b; font-weight: 700; }
    .lonmark {
      flex-shrink: 0;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #1f5f8b;
      background: #dbe9f6;
      border-radius: 4px;
      padding: 0 5px;
      white-space: nowrap;
    }

    /* ── THE FUNCTIONS LEVEL — what a component says it does ─────────────────
       A different kind of fact from everything above it: not where a component came from, but
       what it is for. So it is drawn in its own colour rather than in the teal used for
       structure and the green used for existence. Each event is a button because clicking one
       opens the code that writes it — a function has no children to expand. */
    .lfner {
      flex-shrink: 0;
      font-family: inherit;
      font-size: 10px;
      color: #6b3fa0;
      background: #f2eaf9;
      border: none;
      border-radius: 4px;
      padding: 0 5px;
      cursor: pointer;
      white-space: nowrap;
    }
    .lfner:hover { background: #e4d4f2; }
    /* A FUNCTION THAT IS DESIGNED AND NOT BUILT. Dashed, because it marks a place something is
       expected and nothing is there yet — not a fault and not a fact, a placeholder. */
    .lfempty {
      flex-shrink: 0;
      font-size: 10px;
      color: #8a5b12;
      background: #fdf3e0;
      border: 1px dashed #e0b96a;
      border-radius: 4px;
      padding: 0 5px;
    }
    .ldrawn {
      flex-shrink: 0;
      font-size: 10px;
      border-radius: 4px;
      padding: 0 5px;
      max-width: 34ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ldrawn.element { color: #2f7d36; background: #eaf6ea; }
    .ldrawn.renderer { color: #27707f; background: #eef7f8; }
    /* NOT THERE — the only mark here that is a reason to act, so it is the only one drawn as a
       warning rather than as an annotation. */
    .ldrawn.none { color: #a3331f; background: #fde8e4; }
    /* OR NOBODY COULD LOOK. Never the same claim as "nothing draws this". */
    .ldrawn.unknown { color: #8a5b12; background: #fdf3e0; font-style: italic; }

    /* ── IS ANYTHING USING IT? — a different question from whether it can be drawn ──────────
       Blue rather than green: green above says the component EXISTS, this says something
       depends on it. "not in use" is quiet grey on purpose — a component can be perfectly
       good and simply not wired yet, and a warning colour would call that a fault. */
    .luse {
      flex-shrink: 0;
      font-size: 10px;
      border-radius: 4px;
      padding: 0 5px;
      max-width: 34ch;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .luse.live { color: #1f5f8b; background: #e8f2fa; }
    .luse.idle { color: #8a9499; background: #f2f4f5; }

    /* ── THE CATALOGUES — the level above the one being read ─────────────── */
    .set {
      margin: 0 6px 8px;
      padding: 7px 9px;
      background: #f7f9fa;
      border: 1px solid #dfe6e9;
      border-radius: 5px;
    }
    .settitle { font-size: 12.5px; font-weight: 700; color: #171717; }
    .setmeta {
      margin-top: 3px;
      font-size: 10.5px;
      line-height: 1.5;
      color: #6b767d;
    }
    .setmeta code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      background: #eef1f3;
      border-radius: 3px;
      padding: 0 3px;
    }
    .setlist {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-top: 6px;
    }
    .setitem {
      font-family: inherit;
      display: flex;
      align-items: baseline;
      gap: 6px;
      padding: 3px 8px;
      background: #ffffff;
      border: 1px solid #cbe6e3;
      border-radius: 5px;
      cursor: pointer;
    }
    .setitem:hover { background: #cbe6e3; }
    /* The one being read: boxed as well as tinted, so it reads without relying on colour. */
    .setitem.on {
      background: #cbe6e3;
      border-color: #93cfc9;
      box-shadow: inset 2px 2px 3px rgba(0, 0, 0, 0.12);
    }
    .setid {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      color: #171717;
    }
    .setcount { font-size: 10px; font-weight: 700; color: #2793a3; }
    .setbad { margin-top: 5px; font-size: 10.5px; color: #a3331f; }

    /* ── THE CATALOGUE — the level above the components ─────────────────── */
    .cat {
      margin: 0 6px 8px;
      padding: 7px 9px;
      background: #f2f7f8;
      border-left: 3px solid #1facc2;
      border-radius: 4px;
    }
    .cat.bad { background: #fde8e4; border-left-color: #a3331f; }
    .cattitle { font-size: 12.5px; font-weight: 700; color: #171717; }
    .cat.bad .cattitle { color: #a3331f; }
    .catmeta {
      margin-top: 3px;
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
      font-size: 10.5px;
      color: #5b666e;
    }
    .catcount { font-weight: 700; color: #2793a3; }
    .catmeta code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      color: #6b767d;
      word-break: break-all;
    }

    .node { border-top: 1px solid #eef1f3; padding-top: 6px; }
    .node:first-child { border-top: none; }

    /* THE ONE JUST ADDED — outlined green, so it is findable in a list that only grows. */
    .node.just {
      border: 1px solid #86c98a;
      background: #f4fbf4;
      border-radius: 6px;
      margin: 4px 6px;
      padding: 6px 0 4px;
    }
    .node.just + .node { border-top: none; }
    .newmark {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #2f7d36;
      background: #dcf0dd;
      border-radius: 4px;
      padding: 0 5px;
    }
    .nhead {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 2px 12px 4px;
      flex-wrap: wrap;
    }
    .ntag { font-size: 12px; font-weight: 700; color: #171717; }
    .nid {
      font-family: ui-monospace, Menlo, monospace;
      font-size: 11px;
      color: #2793a3;
    }
    .nmeta { font-size: 11px; color: #8a9499; margin-left: auto; }

    .dupn {
      margin: 2px 12px 6px;
      padding: 6px 8px;
      background: #fdf3e0;
      border-radius: 5px;
      font-size: 11px;
      line-height: 1.5;
      color: #8a5b12;
    }
    .dupn code {
      font-family: ui-monospace, Menlo, monospace;
      background: #fff8e3;
      border-radius: 3px;
      padding: 0 3px;
    }

    .lrow {
      display: flex;
      align-items: baseline;
      gap: 8px;
      padding: 1px 12px 1px calc(12px + var(--d) * 14px);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11.5px;
      line-height: 1.6;
      white-space: nowrap;
    }
    .lrow.dup { background: #fffdf3; }

    /* THE DECLARED COMPONENT JUST ADDED — the same green as the record below it, so the two
       speak the same language: the row in the catalogue, and the design it was measured from.
       A box-shadow rather than a border: a border would change the row's width and shift every
       line under it, and this mark must cost the tree nothing. */
    .lrow.just {
      background: #f4fbf4;
      box-shadow: inset 3px 0 0 0 #86c98a;
    }
    .lrow.just .lname { color: #2f7d36; }

    /* The line that introduces a component's measured layers — a heading inside its expansion,       so the two halves of one component read as two halves rather than as more properties. */
    .lrow.subhead {
      margin-top: 3px;
      color: #2793a3;
    }
    .lrow.subhead .lname {
      font-size: 10.5px;
      font-weight: 700;
      letter-spacing: 0.02em;
    }
    /* A line that is standing in for something absent — dimmer than a fact, so it does not
       read as one. */
    .lname.quiet { color: #8a9499; font-style: italic; }

    /* The re-read, on its own line above the rows and using the same spinner as the header. */
    .lrow.reloading { padding-top: 3px; padding-bottom: 3px; align-items: center; }

    /* A row with children is a tile you can roll up. A leaf is not — it has nothing under
       it to hide, so it gets no chevron and no pointer. */
    .lrow.branch { cursor: pointer; }
    .lrow.branch:hover { background: #f2f7f8; }
    .lrow.branch:focus-visible {
      outline: 2px solid #1facc2;
      outline-offset: -2px;
    }
    /* A ROW THAT OPENS SOMETHING. Kept visually distinct from .branch so the two controls never
       look like one: the chevron is a small target you expand with, the row is the thing you
       open. Only these rows take the pointer; a layer with no component behind it is not a
       button and must not pretend to be one. */
    .lrow.opens { cursor: pointer; }
    .lrow.opens:hover .lname { color: #17456b; text-decoration: underline dotted #b9c2c7; }
    .lrow.opens:focus-visible {
      outline: 2px solid #1f5f8b;
      outline-offset: -2px;
    }
    .lchev.clicky { cursor: pointer; }
    .lchev.clicky:hover { color: #1f5f8b; }
    .lchev:focus-visible { outline: 1px solid #1facc2; outline-offset: 1px; }

    /* ── THE TWO DOTS, LEFT OF THE CHEVRON ──────────────────────────────────
       The first is the audit's verdict: green clean, amber advisories only, red blocking or
       undrawable, grey unmeasured. The second is purple and present ONLY when it is true — the
       application's own interface uses this component today. Both are small round marks you
       read at a glance; the sentence behind each one is its title, and neither invents a
       judgement the report does not already make. */
    .ldot {
      flex-shrink: 0;
      align-self: center;
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: #cbd5d9;
    }
    .ldot.ok { background: #42a34a; }
    .ldot.warn { background: #d99b1f; }
    .ldot.bad { background: #c0392b; }
    /* NOT MEASURED. Never green and never red: nobody looked, which is its own answer. */
    .ldot.unknown { background: #cbd5d9; }
    .ldot.used { background: #7a3ea3; }
    .lchev {
      flex-shrink: 0;
      width: 10px;
      color: #9aa6ad;
      font-size: 9px;
    }
    .lname { color: #171717; }
    .lrow.dup .lname { color: #a3331f; font-weight: 700; }
    .ltype { color: #9aa6ad; font-size: 10px; }
    .lcomp {
      font-size: 10px;
      color: #2793a3;
      background: #eef7f8;
      border-radius: 3px;
      padding: 0 4px;
      white-space: nowrap;
    }
    .lreuse {
      font-size: 10px;
      color: #5b666e;
      background: #eef1f3;
      border-radius: 3px;
      padding: 0 4px;
      white-space: nowrap;
    }
    /* The occurrence: drawn beside the component reference, and quieter than it, because it
       says where an instance sits and never what the component is. */
    .lloc {
      font-size: 10px;
      color: #8a949b;
      background: #f4f6f7;
      border-radius: 3px;
      padding: 0 4px;
      white-space: nowrap;
    }
    .lid { color: #46535b; margin-left: auto; padding-left: 10px; }
    .ltext { color: #2793a3; }

    .reusen {
      margin: 2px 12px 6px;
      padding: 6px 8px;
      background: #eef7f8;
      border-radius: 5px;
      font-size: 11px;
      line-height: 1.5;
      color: #27707f;
    }
    .reusen code {
      font-family: ui-monospace, Menlo, monospace;
      background: #dceff2;
      border-radius: 3px;
      padding: 0 3px;
    }
  `;
}

// ── Register custom element ──────────────────────────────────────────────────
if (!customElements.get('figma-layers-view')) customElements.define('figma-layers-view', FigmaLayersView);

// ── JSX type declaration for React/TypeScript consumers ─────────────────────
declare global {
  interface HTMLElementTagNameMap {
    'figma-layers-view': FigmaLayersView;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'figma-layers-view': React.DetailedHTMLProps<
        React.HTMLAttributes<FigmaLayersView> & {
          pipeline?: string;
          'node-id'?: string;
          /**
           * Lit declares this as `{ type: Boolean }`. React 19 sets the matching *property*
           * on the element, so a real boolean is correct here — never the string "false",
           * which Lit's boolean converter would read as true.
           */
          inline?: '' | boolean;
          refresh?: number;
          reset?: number;
          selected?: string;
          ref?: React.Ref<FigmaLayersView>;
        },
        FigmaLayersView
      >;
    }
  }
}
