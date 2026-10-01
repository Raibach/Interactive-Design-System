/**
 * THE ONE SEAM A GENERATED ELEMENT CALLS.
 *
 * WHY THIS FILE EXISTS. An ingested component is WRITTEN WHOLE by `render_spec`
 * (backend/design_renderer.py) from what Figma measured, so a re-ingest replaces every byte of it.
 * Anything in such a file that the design cannot state is therefore deleted by the next ingest —
 * measured 2026-09-30: the catalogue row `<f-40001207-3497>` carried `name` / `code` /
 * `description` / `open`, a `status` slot and a `chevron-toggle` dispatch, an approve regenerated
 * the file, and all of it was gone while the registry and both catalogues went on declaring it. The
 * component drew Figma's sample words instead of the catalogue's own data, and nothing anywhere
 * reported a fault.
 *
 * SO THE LOGIC IS NOT IN THE GENERATED FILE. It is here, in a file the ingest never writes, and the
 * generated file carries exactly one seam that calls it — emitted by the generator's constant
 * template, the same bytes in every generated element:
 *
 *     import { attachBehaviour, detachBehaviour, behaviourProperties } from './behaviour/attach';
 *     …
 *     static properties = { ...behaviourProperties('<tag>'), <the design's Data: fields> };
 *     connectedCallback() { super.connectedCallback(); attachBehaviour(this, '<tag>'); }
 *     disconnectedCallback() { super.disconnectedCallback(); detachBehaviour(this, '<tag>'); }
 *
 * A COMPANION is one module per tag, `./<tag>.behaviour.ts`, exporting `tag`, `attach(el)`,
 * `detach(el)` and optionally `properties`. It owns everything that is not a drawing: extra props,
 * listeners, dispatched events, slot fills, keyboard handling, timers. A tag with no companion gets
 * a no-op — the element simply has no behaviour, which is a fact and not a failure.
 *
 * WHY THE `.behaviour.ts` SUFFIX IS LOAD-BEARING, and it is not decoration. Both catalog checkers
 * walk `src/components/lit` RECURSIVELY and identify a source by its BASENAME
 * (`scripts/catalog-check.mjs`, `litFiles()` + `srcOf()`; `frontend/scripts/catalog-check.mjs`,
 * `walk()`). A companion named `f-40001207-3497.ts` in this directory would therefore be read as
 * the element itself — the checker would measure the companion's props and dispatches as the
 * element's, and its findings would name the wrong file. A different basename makes that
 * impossible: no checker mistakes a helper module for an element.
 *
 * WHAT THIS FILE MUST NEVER DO: import a generated element. The generated file imports this loader
 * first, so a companion that imported its own element back would close a cycle at module-evaluation
 * time and read a half-initialised module. A companion is handed the instance; it never reaches for
 * the class.
 */
import type { LitElement, PropertyDeclarations } from 'lit';

/**
 * What a companion module looks like. `attach` is required — a module that has no attach is not a
 * companion and is ignored rather than half-registered.
 */
export interface CompanionModule {
  /** The tag this behaviour belongs to, e.g. `f-40001207-3497`. Defaults to the file's basename. */
  tag?: string;
  /** Props this companion adds, spread into the element's `static properties` — see the seam. */
  properties?: PropertyDeclarations;
  attach(el: LitElement): void;
  detach?(el: LitElement): void;
}

interface Companion {
  attach(el: LitElement): void;
  detach(el: LitElement): void;
}

/**
 * EVERY COMPANION IN THIS DIRECTORY, KEYED BY TAG — collected with the glob this repository already
 * uses for its generated elements (`ingested.ts` globs `./f-*.ts`) and for its catalogues
 * (`figma-layers-view.ts` globs the catalogs directory).
 *
 * EAGER, because the props of a companion must exist BEFORE the element that spreads them is
 * defined: `static properties` is read once, at `customElements.define`. A lazily loaded companion
 * would arrive after the class was already built and its props would never be reactive.
 *
 * ADDING A COMPANION NEEDS THIS MODULE RE-RESOLVED, measured 2026-09-30: the dev server caches the
 * glob's answer for as long as this file is unchanged, so a NEW `<tag>.behaviour.ts` is absent from
 * the map until the file changes (touch it, or restart the dev server) — and a companion that is
 * absent is a no-op, i.e. it would look like behaviour that does nothing. A production build always
 * sees every file, because the glob is resolved when it runs.
 */
const MODULES = import.meta.glob<CompanionModule>('./*.behaviour.ts', { eager: true });

const COMPANIONS = new Map<string, Companion>();
const PROPERTIES: Record<string, PropertyDeclarations> = {};

/** The tag a module claims: its own `tag`, or its filename with the suffix removed. */
const tagOf = (path: string, mod: CompanionModule): string =>
  (mod.tag || path.replace(/^\.\//, '').replace(/\.behaviour\.ts$/, '')).trim().toLowerCase();

for (const [path, mod] of Object.entries(MODULES)) {
  if (!mod || typeof mod.attach !== 'function') continue;
  const tag = tagOf(path, mod);
  COMPANIONS.set(tag, {
    attach: mod.attach,
    detach: typeof mod.detach === 'function' ? mod.detach : () => {},
  });
  if (mod.properties) PROPERTIES[tag] = mod.properties;
}

/**
 * The props a companion declares, spread into the element's own `static properties` by the
 * generated file. A tag with no companion returns `{}`, so the spread costs nothing and declares
 * nothing — an absent feature is absent, never a stand-in.
 */
export function behaviourProperties(tag: string): PropertyDeclarations {
  return PROPERTIES[String(tag).trim().toLowerCase()] ?? {};
}

/**
 * Attach the companion for `tag`, once. Called from the generated element's `connectedCallback`.
 *
 * IDEMPOTENT ON PURPOSE: an element can be connected, disconnected and connected again (moved in
 * the DOM), and a companion that added its listener twice would dispatch its event twice per click.
 * The mark lives on the instance, so it dies with it.
 */
export function attachBehaviour(el: LitElement, tag: string): void {
  const companion = COMPANIONS.get(String(tag).trim().toLowerCase());
  if (!companion) return;
  const marked = el as LitElement & { __behaviourAttached?: boolean };
  if (marked.__behaviourAttached) return;
  marked.__behaviourAttached = true;
  companion.attach(el);
}

/** Release the companion for `tag`. Called from the generated element's `disconnectedCallback`. */
export function detachBehaviour(el: LitElement, tag: string): void {
  const marked = el as LitElement & { __behaviourAttached?: boolean };
  if (!marked.__behaviourAttached) return;
  marked.__behaviourAttached = false;
  COMPANIONS.get(String(tag).trim().toLowerCase())?.detach(el);
}

/** Every tag this loader has a companion for — read by the catalog check, never by a component. */
export const COMPANION_TAGS: string[] = [...COMPANIONS.keys()].sort();
