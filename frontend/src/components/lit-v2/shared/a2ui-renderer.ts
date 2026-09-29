/**
 * <a2ui-renderer> — the missing half of the A2UI contract.
 *
 * A2UI is a flat list of components, each naming its type and referring to its
 * children BY ID. Nothing in this repository turned that list into elements: the
 * payload was received, logged, stashed on `window.__lastA2UIComponents`, and
 * then discarded — the console was drawn by React branching on the shape of the
 * data model instead. So the model's declared components were decorative.
 *
 * This maps the list to real elements:
 *
 *   name  -> tag      the renderer's own tables first (COMPOSITE_MAP,
 *                     A2UI_PRIMITIVES, A2UI_STRUCTURAL), then the allowlist
 *                     (tag-registry.ts). The CATALOG cannot answer this: it is a
 *                     JSON Schema and carries no `tag` — and the allowlist is NOT
 *                     what the server validates against either. The server's gate
 *                     is the catalog itself (backend/deps.py::
 *                     validate_a2ui_components reads its `components` keys), a
 *                     different list from this one. Reading the two as one list is
 *                     how the catalog audit came to report ten renderable
 *                     components as "the gatekeeper rejects it".
 *   ids   -> tree     resolve each `children` entry through the flat list.
 *   props -> props    assigned as PROPERTIES, camelCase, coerced by the element's
 *                     own declared types. Not attributes: Lit declares
 *                     `conversationId` while the attribute is `conversation-id`,
 *                     and an attribute assignment would leave the property unset.
 *
 * FAIL LOUD: an unknown component name is reported, in the DOM and on the
 * console. A renderer that silently skips what it does not understand produces a
 * blank surface that looks like a successful assembly.
 */
import { LitElement, html, css, nothing } from 'lit';
import type { TemplateResult } from 'lit';
import { html as staticHtml, unsafeStatic } from 'lit/static-html.js';
import { ref } from 'lit/directives/ref.js';
import { A2UI_PRIMITIVES, A2UI_STRUCTURAL } from './a2ui-primitives';
import { TAG_REGISTRY } from '@/shared/tag-registry';

// ── the payload shape ───────────────────────────────────────────────────────

/** Keys that are structure, not props. Everything else is passed through. */
const STRUCTURAL = new Set(['id', 'component', 'children', 'props']);

export interface A2UIComponent {
  id: string;
  /** The discriminator. Named `component` in the spec and in the catalog schema. */
  component: string;
  /**
   * Ids of other entries in the same flat list — not nested objects.
   *
   * Either a flat array, or an object keyed by SLOT NAME whose value is one id or a
   * LIST of ids (the panel's one content hole holds both views). See childRefs().
   */
  children?: string[] | Record<string, string | string[]>;
  /** Literal props, siblings of `id` — NOT a nested `props` object. */
  [prop: string]: unknown;
}

/**
 * One child reference: the id, and the slot it was named for (null = default).
 *
 * WHY BOTH FORMS. A2UI's flat list specifies `children` as an array of ids, and
 * for a component that lays its children out wherever they fall, an array is
 * exactly right. But a container whose panes are NAMED — workspace-layout
 * projects <slot name="left">, <slot name="middle">, <slot name="right"> and
 * nothing else — cannot be filled by a flat array: the array carries no slot
 * name, this renderer writes no `slot` attribute for it, and every child is then
 * projected into no slot at all. The container draws its panes empty and the
 * children are in the DOM, unprojected and invisible. That is a blank surface
 * that looks like a successful assembly, which is the failure this renderer
 * exists to refuse.
 *
 * So a named-slot container declares its children as `{slotName: childId}` and
 * each child is built carrying `slot="slotName"`.
 *
 * A SLOT MAY HOLD MORE THAN ONE CHILD, which is why a slot's value may also be a
 * LIST: `{slotName: [idA, idB]}`. The design's answer for the chat column is ONE
 * generic hole — "chat-output-simple-slot-area" #40001085:2373, annotated "holds
 * plain text output and inserted functions", PLURAL — fed by the surface. The
 * trace view and the repair list are both inserted into that one hole, so one id
 * per slot was a limit of this extension and not of the design. A per-tab slot
 * scheme was tried and reverted; this is the shape the design asks for.
 *
 * Anything else contributes no children rather than throwing: a malformed
 * `children` is a bad payload, and it is reported by the per-entry validation,
 * not by a crash that takes the surface down.
 */
export function childRefs(comp: A2UIComponent): Array<{ id: string; slot: string | null }> {
  const raw = comp.children;
  if (Array.isArray(raw)) {
    return raw
      .filter((id): id is string => typeof id === 'string')
      .map((id) => ({ id, slot: null }));
  }
  if (raw && typeof raw === 'object') {
    const out: Array<{ id: string; slot: string | null }> = [];
    for (const [slot, value] of Object.entries(raw)) {
      if (typeof value === 'string') out.push({ id: value, slot });
      // A list in a named slot: every id in it is named for that same slot, in order.
      else if (Array.isArray(value)) {
        for (const id of value) if (typeof id === 'string') out.push({ id, slot });
      }
    }
    return out;
  }
  return [];
}

export interface RenderError {
  componentId: string;
  component: string;
  message: string;
}

// ── prop binding ────────────────────────────────────────────────────────────

/**
 * Assign props as PROPERTIES, not attributes.
 *
 * Lit declares `conversationId` while the DOM attribute is `conversation-id`.
 * Setting the attribute would leave the property unset and the component blank,
 * so props go on as properties. Values arrive as JSON, so a `"3"` that should be
 * a number is coerced using the element's OWN declared type — read from
 * `static properties`, the same declaration the element uses. An undeclared prop
 * is reported rather than assigned silently: it means the payload and the
 * component disagree about the contract.
 */
function assignProps(el: HTMLElement, props: Record<string, unknown>): string[] {
  const declared = declaredProperties(el);
  const unreported: string[] = [];

  for (const [key, raw] of Object.entries(props)) {
    const spec = declared[key];
    if (!spec) {
      unreported.push(key);
      continue;
    }
    const type = spec.type;
    const target = el as unknown as Record<string, unknown>;
    if (type === Number) target[key] = typeof raw === 'string' ? Number(raw) : raw;
    else if (type === Boolean) target[key] = typeof raw === 'string' ? raw !== 'false' : Boolean(raw);
    else if (type === Object || type === Array) {
      if (typeof raw === 'string') {
        try { target[key] = JSON.parse(raw); } catch { target[key] = raw; }
      } else target[key] = raw;
    } else target[key] = raw === null || raw === undefined ? '' : String(raw);
  }
  return unreported;
}

/** A custom element's own property declarations — the contract it publishes. */
function declaredProperties(el: HTMLElement): Record<string, { type?: unknown }> {
  return (el.constructor as unknown as { properties?: Record<string, { type?: unknown }> }).properties ?? {};
}

/**
 * The value each declared property had BEFORE this renderer ever wrote to it.
 * Captured once per tag, from the first instance — whose constructor defaults are
 * still intact at that moment, because this renderer is what creates it.
 */
const tagDefaults = new Map<string, Record<string, unknown>>();

/** The prop keys this renderer last ASSIGNED to each element. */
const assignedProps = new WeakMap<Element, string[]>();

/**
 * THE DEFAULTS ARE CAPTURED BEFORE ANY PAYLOAD IS WRITTEN, AND THE ORDER IS THE WHOLE POINT.
 *
 * This ran inside `releaseStaleProps` first, AFTER `assignProps` — so the "constructor
 * defaults" it recorded were the FIRST PAYLOAD'S VALUES, not the element's own. Every
 * prop a later surface then omitted was handed back to that first payload's value and
 * nothing else: measured 2026-09-18, the seat's `conversations` — assigned once by the
 * first package opened in a session — stayed on every fresh composer afterwards, a
 * conversation chip for a package that was not on screen, while the thread beside it was
 * correctly empty. The comment below always said "captured before the renderer ever wrote
 * to it"; the code has to do that, so the capture lives here and `_assign` calls it FIRST.
 */
function captureDefaults(el: HTMLElement): void {
  const tag = el.tagName.toLowerCase();
  if (tagDefaults.has(tag)) return;
  const target = el as unknown as Record<string, unknown>;
  const defaults: Record<string, unknown> = {};
  for (const key of Object.keys(declaredProperties(el))) defaults[key] = target[key];
  tagDefaults.set(tag, defaults);
}

/**
 * Give back the props this payload no longer carries.
 *
 * A surface has to be a pure function of the LAST emission. Lit reuses the
 * element it built — same id, same tag — so a prop assigned by the previous
 * assembly stays set when the next one simply omits it. The drawn surface then
 * depends on the history of assemblies rather than on the payload, and it is the
 * omitted flag that does the damage because omitting a flag reads as "default",
 * not as "keep what you had". Measured on the console 2026-09-17: two assemblies
 * earlier the payload said rightWidth: 75 and collapsed: true; the payload after
 * that said neither, the panel still carried collapsed="" and the layout still
 * carried rightWidth: 75, so the chat column stayed 75px wide with its body
 * hidden and the gripper dragged against a pane pinned to a fixed width — the
 * chat could not be opened or expanded at all.
 *
 * ONLY PROPS THIS RENDERER SET ARE GIVEN BACK. State the element owns — the rail
 * folding the panel away, anything a person toggled — was never assigned from a payload,
 * so it is never in the list below and is never touched. This restores the payload's
 * authority without taking the component's away.
 */
function releaseStaleProps(el: HTMLElement, props: Record<string, unknown>): string[] {
  const declared = declaredProperties(el);
  const target = el as unknown as Record<string, unknown>;

  captureDefaults(el);
  const defaults = tagDefaults.get(el.tagName.toLowerCase()) ?? {};

  const now = Object.keys(props).filter((key) => declared[key]);
  const before = assignedProps.get(el) ?? [];
  const released: string[] = [];
  for (const key of before) {
    if (now.includes(key)) continue;
    target[key] = defaults[key];
    released.push(key);
  }
  assignedProps.set(el, now);
  return released;
}

const pascalToKebab = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase();

/**
 * Catalog composites that are an EXISTING design-system element under a
 * different name.
 *
 * A mapping table, not a kebab guess. `SectionEditor` and
 * `prompt-section-editor` are the same thing, and only a person knows that —
 * folding the casing would have produced `section-editor`, which resolves to
 * nothing and looks like a missing component rather than a missing mapping.
 */
const COMPOSITE_MAP: Record<string, string> = {
  ChatPanel: 'chat-panel',            // defined in components/lit/chat-panel.ts (2026-09-15)
  SectionEditor: 'prompt-section-editor',
  CompiledOutput: 'compiled-output-viewer',
  TraceFeed: 'trace-feed',          // the rail's Trace view, injected into the panel's view slot
  EvalFeed: 'eval-feed',            // the rail's Evals view — judged runs, one row per run
  AgentFlow: 'agent-flow',          // the output column's flow canvas, swapped in on Run
  AgentCanvas: 'agent-canvas',      // the plug-in: that canvas and her seat, as one unit
  OutputControls: 'output-controls',  // the middle column's header row, drawn in every view of it
  CanvasFooter: 'canvas-footer',      // the canvas column's foot: the host's controls and the tone switch
  LeftColumnHeader: 'left-column-header', // the prompt's own bar — title, version, and what is known about it
};

/**
 * Resolve an A2UI component name to a custom-element tag.
 *
 * Order matters, and it is deliberate:
 *   1. explicit composites — a name that is really another element
 *   2. spec primitives     — A2UI's six, which the renderer owns
 *   3. structural composites — ours, which the renderer also owns
 *   4. the allowlist       — names that map to a real design-system element
 *
 * Returns null when nothing claims the name — the caller reports that rather
 * than inventing a tag from casing, because a guess produces `<row>` where the
 * element is called something else, and the failure then looks like a styling
 * problem instead of a missing component.
 */
export function resolveTag(name: string): string | null {
  if (COMPOSITE_MAP[name]) return COMPOSITE_MAP[name];
  if (A2UI_PRIMITIVES[name]) return A2UI_PRIMITIVES[name];
  if (A2UI_STRUCTURAL[name]) return A2UI_STRUCTURAL[name];
  const registry = TAG_REGISTRY as unknown as Record<string, { tag?: string } | undefined>;
  const entry = registry[pascalToKebab(name)];
  return entry?.tag ?? null;
}

/**
 * Resolve a binding against the data model.
 *
 * A2UI v0.9.1 keeps structure and content on two separate channels:
 * updateComponents describes the tree, updateDataModel carries the values. A prop
 * that is a binding — { path: "/cards/0/title" } — is a POINTER into that model,
 * not text. Rendering it literally is the failure this prevents: the surface shows
 * "[object Object]" or an empty cell while the value sits one channel away.
 *
 * Only the object form is treated as a binding. A bare string is never a path —
 * "/usr/bin" and "/v2/chat" are legitimate copy, and guessing would corrupt them.
 */
export function resolveBinding(value: unknown, dataModel: Record<string, unknown>): unknown {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
  const path = (value as { path?: unknown }).path;
  if (typeof path !== 'string') return value;

  let cursor: unknown = dataModel;
  for (const segment of path.split('/').filter(Boolean)) {
    if (cursor === null || typeof cursor !== 'object') {
      // A path that runs off the end of the model resolves to undefined rather
      // than throwing: one unresolvable field should read as absent, not blank
      // the surface around it.
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

/** The props carried by an entry: everything that is not structure, bound. */
export function componentProps(
  c: A2UIComponent,
  dataModel: Record<string, unknown> = {},
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(c)) {
    if (STRUCTURAL.has(k)) continue;
    out[k] = resolveBinding(v, dataModel);
  }
  return out;
}

// ── the renderer ────────────────────────────────────────────────────────────

class A2UIRenderer extends LitElement {
  static properties = {
    components: { type: Array },
    rootId: { type: String, attribute: 'root-id' },
    // The other channel of the envelope. updateComponents says what the surface
    // is; updateDataModel says what it says. Property-only, no attribute: it is a
    // structure, and serialising it through an attribute would be lossy.
    dataModel: { type: Object },
  };

  declare components: A2UIComponent[];
  declare rootId: string;
  declare dataModel: Record<string, unknown>;

  constructor() {
    super();
    this.components = [];
    this.rootId = 'root';
    this.dataModel = {};
  }

  /** Errors from the pass being rendered. Rebuilt every render, never accumulated. */
  private _errors: RenderError[] = [];

  static styles = css`
    /*
     * height: 100% IS LOAD-BEARING, not decoration.
     *
     * The tree this draws is usually a container that sizes itself with
     * height: 100% — workspace-layout does exactly that. A percentage height
     * resolves against the PARENT's height, and this host was display: block
     * with no height of its own, so the percentage resolved against an
     * auto-height box and collapsed to content height. Measured 2026-09-17 on the
     * console: the surface drew 1224x20899 inside a 906px window, the app grew a
     * scrollbar 20 screens long, and the chat column measured 0 wide inside it.
     *
     * No backticks in this comment, deliberately: this is a Lit css template
     * literal, and a backtick here ends the literal and breaks the build.
     */
    :host {
      display: block;
      height: 100%;
      min-width: 0;
      /*
       * flex: 1 1 auto IS LOAD-BEARING TOO. Both slots that mount this element are
       * display:flex wrappers in WritingAreaIndex, and this is their only child —
       * without a grow factor it is sized to its content's MAX width and never fills
       * the wrapper. Measured 2026-09-17 in a 1948px window: the wrapper was 1892 wide,
       * this element 1716.94, so the composer's surface stopped 175px short of the
       * browser's right edge with dead space after it. The console looked fine only
       * because its card grid's content is WIDER than the pane, which leaves shrink
       * doing the filling — narrower content exposes it. A flex parent fills it now,
       * and in a block parent flex is ignored while width: auto still fills.
       *
       * No backticks in this comment: this is a Lit css template literal. (Written after
       * breaking the build with exactly that, twice, both times in a comment.)
       */
      flex: 1 1 auto;
    }
    .a2ui-errors {
      border: 2px solid #ef4444;
      background: #fef2f2;
      color: #991b1b;
      padding: 8px 10px;
      border-radius: 6px;
      margin: 0 0 10px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 13px;
    }
    .a2ui-errors .hdr { font-weight: 700; margin-bottom: 4px; }
    .a2ui-errors code { font-size: 13px; }
    .a2ui-error {
      border: 1px dashed #ef4444;
      background: #fef2f2;
      color: #991b1b;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 13px;
    }
  `;

  /** A child's event goes up the tree, tagged with who raised it. */
  private _forward = (event: Event, sourceId: string) => {
    this.dispatchEvent(
      new CustomEvent('a2ui-event', {
        bubbles: true,
        composed: true,
        detail: { sourceId, type: event.type, payload: (event as CustomEvent).detail },
      }),
    );
  };

  private _report(componentId: string, component: string, message: string) {
    this._errors.push({ componentId, component, message });
    console.error(`[a2ui-renderer] ${componentId} <${component}>: ${message}`);
  }

  /**
   * Walk the tree the payload describes, collecting what is wrong with it.
   *
   * Runs BEFORE rendering so an error can be shown in the same pass as the tree
   * that caused it — collecting during render would mean rendering twice, and a
   * second pass that can also fail is a loop.
   */
  private _validate(id: string, byId: Map<string, A2UIComponent>, path: string[], depth: number) {
    const comp = byId.get(id);
    if (!comp) {
      this._report(id, '?', `No component with id "${id}". Referenced by ${path.join(' > ') || 'the surface root'}.`);
      return;
    }
    if (path.includes(id)) {
      this._report(id, comp.component, `Cycle: "${id}" already appears in this branch (${[...path, id].join(' > ')}).`);
      return;
    }
    if (depth > 64) {
      this._report(id, comp.component, `Depth exceeded 64 at "${id}" — refusing to recurse further.`);
      return;
    }
    const tag = resolveTag(comp.component);
    if (!tag) {
      this._report(
        id,
        comp.component,
        `Unknown component "${comp.component}". Not a spec primitive (${Object.keys(A2UI_PRIMITIVES).join(', ')}) and not in the allowlist.`,
      );
      // Reported, but its children are still walked: one unknown component must
      // not hide the rest of the surface's problems.
    } else if (!customElements.get(tag)) {
      // The name RESOLVED — it is in the catalog, and this shell's own tables
      // map it to a tag — but no element defines that tag, so it would render as
      // an unknown element: an empty box, silently. That is the case a
      // name-resolution check cannot see, and the one the audit called "blocked
      // on the server" while the server was accepting the name.
      this._report(
        id,
        comp.component,
        `Resolved to <${tag}>, which no element defines — nothing was drawn.`
        + ` No gate refuses the name (the catalog accepts it and this shell resolves it);`
        + ` the element itself does not exist yet.`,
      );
    }
    for (const { id: childId } of childRefs(comp)) {
      this._validate(childId, byId, [...path, id], depth + 1);
    }
  }

  /**
   * Build one node and its children.
   *
   * `unsafeStatic` takes a tag name into a template and is usually a way to get
   * hurt. Here it is fed ONLY the output of `resolveTag()`, which returns either
   * one of six hardcoded primitives or a tag read from the allowlist. The payload
   * never reaches it — a component name in the JSON cannot become a tag without
   * passing that lookup first, and a name that fails it is rendered as an error
   * block instead. That is why this is safe, and it is the only reason.
   *
   * (lit-html cannot do a dynamic tag name any other way: the tag is part of the
   * template, parsed once.)
   */
  private _build(
    comp: A2UIComponent,
    byId: Map<string, A2UIComponent>,
    path: string[],
    slot: string | null = null,
  ): TemplateResult {
    const tag = resolveTag(comp.component);
    // Resolved is not the same as defined: a name can map to a tag that no
    // element registers, and that tag draws an empty box with nothing to explain
    // it. _validate has already reported it; the same error block is drawn here
    // so the gap is visible where the component should have been drawn.
    const defined = tag ? Boolean(customElements.get(tag)) : false;

    if (!tag || !defined) {
      return html`<div class="a2ui-error" data-a2ui-missing=${comp.id}>
        <strong>${comp.component}</strong> (${comp.id}) — ${tag
          ? `resolved to <${tag}>, which no element defines`
          : 'not in the catalog'}
      </div>`;
    }

    const children = childRefs(comp).map(({ id: childId, slot: childSlot }) => {
      const child = byId.get(childId);
      if (!child || path.includes(childId)) return nothing; // already reported by _validate
      return this._build(child, byId, [...path, comp.id], childSlot);
    });

    const assign = (el: Element | undefined) => {
      if (el) this._assign(el as HTMLElement, comp);
    };

    return staticHtml`<${unsafeStatic(tag)}
      id=${comp.id}
      data-a2ui-id=${comp.id}
      slot=${slot ?? nothing}
      ${ref(assign)}
      @a2ui-action=${(e: Event) => this._forward(e, comp.id)}
      @message-sent=${(e: Event) => this._forward(e, comp.id)}
      @command-received=${(e: Event) => this._forward(e, comp.id)}
    >${children}</${unsafeStatic(tag)}>`;
  }

  /**
   * HAND ONE COMPONENT ITS PROPS, FROM THE CURRENT DATA MODEL.
   *
   * Called in two places: from the `ref` when a node is built, and again on every
   * data-model change by `updated()` below. It has to be both, and that is the defect
   * this comment is here for.
   *
   * Structure and content arrive on TWO channels: `components` describes the tree,
   * `dataModel` carries the values. An assembly replaces both, but a LATER write — the
   * shell writing /trace, a package landing, anything that only moves data — changes the
   * model and leaves the tree identical. The `ref` fires when an element is built, so on
   * a data-model-only change the markup re-rendered and the ELEMENTS WERE NEVER RE-GIVEN
   * THEIR VALUES: every component kept whatever it was constructed with.
   *
   * Measured 2026-09-17, and it cost the client his package contents. Opening a saved
   * package: the surface's model carried /session/left_column/sections as 4 rows with
   * 5,094 characters of real content, and <prompt-section-editor> still held the three
   * skeleton rows of the BLANK composer it had been built with — System Role 63 chars,
   * User Role empty, Agent Role empty. Re-assigning the model again by hand changed
   * nothing. The database was intact the whole time; the last metre was severed.
   */
  private _assign(el: HTMLElement, comp: A2UIComponent): void {
    const props = componentProps(comp, this.dataModel);
    try {
      // THE ELEMENT'S OWN DEFAULTS, BEFORE THIS PAYLOAD TOUCHES IT. Called here, first,
      // because releaseStaleProps below needs the values the element came with — not the
      // ones this assignment is about to write (see captureDefaults).
      captureDefaults(el);
      for (const unknown of assignProps(el, props)) {
        console.warn(
          `[a2ui-renderer] ${comp.id} <${comp.component}>: prop "${unknown}" is not declared by the element. ` +
          `It was not assigned. The payload and the component disagree about the contract.`,
        );
      }
      // Then give back whatever THIS payload dropped, so the element reflects
      // the model it was just handed and not the one before it.
      releaseStaleProps(el, props);
    } catch (err) {
      // A property setter can throw — a component that validates its own input
      // does it mid-assignment, inside Lit's update. Uncaught, that throw
      // aborts the update and takes down the React subtree that mounted us, so
      // one bad prop would cost the whole surface. Contained here: one bad
      // prop costs one component, and the pass still renders.
      console.error(
        `[a2ui-renderer] ${comp.id} <${comp.component}>: assigning props threw — ${(err as Error)?.message ?? String(err)}. ` +
        `The component was left unset; the rest of the surface rendered.`,
      );
    }
  }

  /**
   * A DATA-MODEL CHANGE RE-APPLIES EVERY PROP. The tree is untouched by such a change
   * — same components, same elements, new values — so the `ref` callbacks do not fire
   * and nothing would otherwise carry the new values down. This walks the nodes it
   * actually drew and re-hands each one its props.
   *
   * Skipped when `components` changed too: that rebuilds the tree and the refs assign
   * on construction, so doing it here would assign every prop twice.
   */
  protected updated(changed: Map<PropertyKey, unknown>): void {
    if (!changed.has('dataModel') || changed.has('components')) return;
    const byId = new Map(
      (Array.isArray(this.components) ? this.components : []).map((c) => [c.id, c]),
    );
    for (const el of this.renderRoot.querySelectorAll<HTMLElement>('[data-a2ui-id]')) {
      const comp = byId.get(el.getAttribute('data-a2ui-id') || '');
      if (comp) this._assign(el, comp);
    }
  }

  render() {
    // Guard the SHAPE before touching it. A host assigns `components` through a
    // ref, so nothing typechecks it at runtime, and the payload crossed a network
    // boundary on the way in. `this.components.length` on a non-array throws — and
    // a throw here takes down whatever React subtree mounted us, so a malformed
    // payload would present as a broken application rather than a bad surface.
    if (!Array.isArray(this.components)) {
      return html`<div class="a2ui-errors" role="alert">
        <div class="hdr">Malformed payload — nothing rendered</div>
        <div><code>components</code> must be an array; received <code>${typeof this.components}</code>.
          The surface was NOT drawn, because drawing part of an unreadable payload
          would look like a successful assembly.</div>
      </div>`;
    }
    if (!this.components.length) return nothing;

    // Rebuild the error list each pass. Validation runs FIRST so the block below
    // reflects the tree in this same render — no second pass, no loop.
    this._errors = [];

    const byId = new Map<string, A2UIComponent>();
    for (const entry of this.components) {
      // An entry that is not an object with a string id cannot be keyed. Skipped
      // and reported: keeping it would put `undefined` in the Map and render a
      // node whose id is the string "undefined".
      if (!entry || typeof entry !== 'object' || typeof (entry as A2UIComponent).id !== 'string') {
        this._report(
          '?',
          String((entry as A2UIComponent | null)?.component ?? '?'),
          `Malformed entry (${entry === null ? 'null' : typeof entry}): every entry must be an object with a string "id". Skipped.`,
        );
        continue;
      }
      const comp = entry as A2UIComponent;
      // A duplicate id is a protocol error, not a style choice: `children` refers
      // to entries BY ID, so a duplicate silently redirects every reference to
      // whichever copy won the Map — one component vanishes and the references
      // that meant it point at the other. Reported, then overwritten exactly as
      // before, so visibility is added without changing which node renders.
      if (byId.has(comp.id)) {
        this._report(
          comp.id,
          comp.component,
          `Duplicate id "${comp.id}" — ids are the join key for children, so the later entry replaced the earlier one.`,
        );
      }
      byId.set(comp.id, comp);
    }

    this._validate(this.rootId, byId, [], 0);

    const errorBlock = this._errors.length
      ? html`<div class="a2ui-errors" role="alert">
          <div class="hdr">
            Surface has ${this._errors.length} problem${this._errors.length === 1 ? '' : 's'} —
            these were NOT rendered as written.
          </div>
          ${this._errors.map(
            (e) => html`<div><code>${e.componentId}</code> ${e.component}: ${e.message}</div>`,
          )}
        </div>`
      : nothing;

    const root = byId.get(this.rootId);
    if (!root) {
      // Name the LIKELY root instead of only listing what is there. The A2UI spec
      // does not require the root to be called "root" — only this repository's
      // prompt does — so a well-formed tree that is still unrenderable is
      // expected, and the remedy is a single word. The failure stays loud: it
      // just also says which word.
      const referenced = new Set<string>();
      for (const c of byId.values()) for (const { id: childId } of childRefs(c)) referenced.add(childId);
      const candidates = [...byId.keys()].filter((id) => !referenced.has(id));
      return html`<div class="a2ui-errors" role="alert">
        <div class="hdr">No root component</div>
        <div>Nothing to render: no entry has id <code>${this.rootId}</code>. The list has ${this.components.length} entr${this.components.length === 1 ? 'y' : 'ies'}: ${[...byId.keys()].join(', ') || '(none)'}.</div>
        ${candidates.length
          ? html`<div>Entries nothing lists as a child — the root is normally one of these:
              ${candidates.map((id) => html`<code>${id}</code> `)}. Set <code>root-id</code> to the right one.</div>`
          : nothing}
      </div>`;
    }

    return html`${errorBlock}${this._build(root, byId, [])}`;
  }
}

if (!customElements.get('a2ui-renderer')) {
  customElements.define('a2ui-renderer', A2UIRenderer);
}

// JSX for React hosts, declared here per element — the pattern every Lit element
// in this repository follows (see ai-surface-sandbox.ts). Without it the tag is
// "Property 'a2ui-renderer' does not exist on type 'JSX.IntrinsicElements'" and
// React cannot mount it at all.
//
// Note what is NOT here: `components` and `dataModel`. They are properties, not
// attributes — React has no way to express that in JSX (its `.prop=` syntax is
// Preact, and is a syntax error here). A host assigns them through a ref, which
// is why the surface mount in WritingAreaIndex holds one.
declare global {
  interface HTMLElementTagNameMap {
    'a2ui-renderer': A2UIRenderer;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'a2ui-renderer': React.DetailedHTMLProps<
        React.HTMLAttributes<A2UIRenderer> & {
          'root-id'?: string;
          ref?: React.Ref<A2UIRenderer>;
        },
        A2UIRenderer
      >;
    }
  }
}
