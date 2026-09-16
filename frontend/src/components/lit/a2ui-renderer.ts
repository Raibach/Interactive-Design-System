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
  /** Ids of other entries in the same flat list — not nested objects. */
  children?: string[];
  /** Literal props, siblings of `id` — NOT a nested `props` object. */
  [prop: string]: unknown;
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
  const declared = (el.constructor as unknown as { properties?: Record<string, { type?: unknown }> })
    .properties ?? {};
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
    :host { display: block; }
    .a2ui-errors {
      border: 2px solid #ef4444;
      background: #fef2f2;
      color: #991b1b;
      padding: 8px 10px;
      border-radius: 6px;
      margin: 0 0 10px;
      font-family: 'Inter', system-ui, sans-serif;
      font-size: 12px;
    }
    .a2ui-errors .hdr { font-weight: 700; margin-bottom: 4px; }
    .a2ui-errors code { font-size: 11px; }
    .a2ui-error {
      border: 1px dashed #ef4444;
      background: #fef2f2;
      color: #991b1b;
      padding: 6px 8px;
      border-radius: 4px;
      font-size: 12px;
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
    for (const childId of comp.children ?? []) {
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
  private _build(comp: A2UIComponent, byId: Map<string, A2UIComponent>, path: string[]): TemplateResult {
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

    const children = (comp.children ?? []).map((childId) => {
      const child = byId.get(childId);
      if (!child || path.includes(childId)) return nothing; // already reported by _validate
      return this._build(child, byId, [...path, comp.id]);
    });

    const props = componentProps(comp, this.dataModel);
    const assign = (el: Element | undefined) => {
      if (!el) return;
      try {
        for (const unknown of assignProps(el as HTMLElement, props)) {
          console.warn(
            `[a2ui-renderer] ${comp.id} <${comp.component}>: prop "${unknown}" is not declared by the element. ` +
            `It was not assigned. The payload and the component disagree about the contract.`,
          );
        }
      } catch (err) {
        // A property setter can throw — a component that validates its own input
        // does it mid-assignment, inside Lit's update. Uncaught, that throw
        // aborts the update and takes down the React subtree that mounted us, so
        // one bad prop would cost the whole surface. Contained here: one bad
        // prop costs one component, and the pass still renders.
        //
        // This reports to the console only. _errors was already consumed by the
        // render that assigned this ref, and the list is rebuilt next pass — so
        // the DOM block cannot show it without a second render. Stated rather
        // than left to look like the report was forgotten.
        console.error(
          `[a2ui-renderer] ${comp.id} <${comp.component}>: assigning props threw — ${(err as Error)?.message ?? String(err)}. ` +
          `The component was left unset; the rest of the surface rendered.`,
        );
      }
    };

    return staticHtml`<${unsafeStatic(tag)}
      id=${comp.id}
      data-a2ui-id=${comp.id}
      ${ref(assign)}
      @a2ui-action=${(e: Event) => this._forward(e, comp.id)}
      @message-sent=${(e: Event) => this._forward(e, comp.id)}
      @command-received=${(e: Event) => this._forward(e, comp.id)}
    >${children}</${unsafeStatic(tag)}>`;
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
      for (const c of byId.values()) for (const childId of c.children ?? []) referenced.add(childId);
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
