/**
 * WHAT DRAWS A COMPONENT — the one question the tree, the preview and the record all ask,
 * answered in one place.
 *
 * A CATALOGUE NAME IS NOT A FILE NAME, and treating it as one is what made the tool say
 * "no file" about components that draw perfectly well. `AgentFlow` is drawn by <agent-flow>
 * in `lit/agent-flow.ts`; `Text` is drawn by the renderer itself, as <a2ui-text>; `role-tile`
 * is drawn from a subfolder. Inferring the file as `lit/<name>.ts` answered "no file" for
 * every component not named after its own file — measured 2026-09-28: of the 39 rows that
 * read "no file", 33 are drawn and 6 are not.
 *
 * SO NOTHING HERE GUESSES, and nothing here is a second declaration of anything:
 *
 *   1. the NAME is resolved by the renderer's own resolver — `resolveTag`, the same function
 *      the app renders surfaces with, so a name the app cannot draw is a name this cannot
 *      resolve, and the two can never disagree;
 *   2. the TAG is resolved to a file by the custom-elements manifest (`frontend/
 *      custom-elements.json`), which the element analyser writes from the files themselves —
 *      tag -> module — and which the approve and removal paths regenerate, so it is current
 *      whenever the catalogue is;
 *   3. the renderer's OWN tags need neither: it defines <a2ui-text>, <a2ui-row> and the rest
 *      in one table in `a2ui-primitives.ts`, under the `a2ui-` prefix it reserves. A spec
 *      primitive has no file of its own BY DESIGN, and saying "no file" about it claims
 *      something is missing when nothing is.
 *
 * WHAT CANNOT BE READ IS NOT A PASS. If the manifest cannot be read the answer is `unknown`,
 * never `none`: "nothing draws this" and "nobody could look" are different claims, and only
 * one of them justifies deleting a row.
 */
import { resolveTag } from '@/components/lit/a2ui-renderer';

/** Where the renderer defines its own elements, and the prefix it reserves for them. */
const RENDERER_MODULE = 'src/components/lit/a2ui-primitives.ts';
const RENDERER_PREFIX = 'a2ui-';

/** A build has no `/custom-elements.json` URL, so the file is also available as a chunk. */
const MANIFEST_MODULES = import.meta.glob('../../custom-elements.json');

export interface DrawnIndex {
  /** Tag -> the module that defines it, from the manifest. */
  modules: Map<string, string>;
  /** Why the manifest could not be read, when it could not. Empty when it could. */
  error: string;
  /** Where the manifest came from — a stale answer must not pass for a fresh one. */
  from: string;
}

export interface DrawnBy {
  /** The element tag that draws this component, when anything claims the name. */
  tag: string | null;
  /**
   * `element` — a source file defines the tag. `renderer` — the renderer's own table defines
   * it. `none` — nothing does. `unknown` — the manifest could not be read, so this is not a
   * verdict (see the header).
   */
  kind: 'element' | 'renderer' | 'none' | 'unknown';
  /** The module that draws it, relative to the frontend root, or null. */
  module: string | null;
  /** The answer in a sentence — what a row prints, so the reader is told rather than left to infer. */
  note: string;
}

let cached: DrawnIndex | null = null;
let inFlight: Promise<DrawnIndex> | null = null;

/**
 * Read the manifest, once per session unless forced.
 *
 * FETCHED RATHER THAN IMPORTED, for the reason `catalog.json` is fetched: an import is cached
 * by the browser, so a component approved or removed would go on being described by the copy
 * the page loaded. The bundled chunk below is only the fallback for a build, where `/src/` is
 * not a URL and the bundle is the catalogue as of that build.
 */
export async function loadDrawn(force = false): Promise<DrawnIndex> {
  if (cached && !force) return cached;
  if (inFlight && !force) return inFlight;
  inFlight = (async (): Promise<DrawnIndex> => {
    try {
      const res = await fetch('/custom-elements.json', { cache: 'no-store' });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.includes('json')) {
        const index = readManifest(await res.json(), 'the live file');
        cached = index;
        return index;
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      try {
        const key = Object.keys(MANIFEST_MODULES)[0];
        if (!key) throw new Error('no bundled copy');
        const mod: any = await MANIFEST_MODULES[key]();
        const index = readManifest(mod?.default ?? mod, 'the bundled copy (the live file could not be fetched)');
        cached = index;
        return index;
      } catch (fallbackError) {
        // Reported, never swallowed: every component then reads `unknown`, which says the
        // answer was not available rather than that nothing draws it.
        const index: DrawnIndex = {
          modules: new Map(),
          error: `${reason}; the bundled copy did not answer either (${
            fallbackError instanceof Error ? fallbackError.message : String(fallbackError)
          })`,
          from: '',
        };
        cached = index;
        return index;
      }
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Tag -> module, from a custom-elements manifest. */
function readManifest(doc: any, from: string): DrawnIndex {
  const modules = new Map<string, string>();
  for (const mod of doc?.modules ?? []) {
    const path = mod?.path;
    if (typeof path !== 'string' || !path) continue;
    for (const decl of mod?.declarations ?? []) {
      const tag = decl?.tagName;
      if (typeof tag === 'string' && tag) modules.set(tag, path);
    }
  }
  return { modules, error: '', from };
}

/** What draws a catalogue name, asked of the app's own resolver. Pure; pass the loaded index. */
export function drawnBy(name: string, index: DrawnIndex | null): DrawnBy {
  const tag = resolveTag(name);
  if (!tag) {
    return { tag: null, kind: 'none', module: null, note: `nothing claims the name "${name}"` };
  }
  if (tag.startsWith(RENDERER_PREFIX)) {
    return { tag, kind: 'renderer', module: RENDERER_MODULE, note: `drawn by the renderer as <${tag}>` };
  }
  if (!index || index.error) {
    return {
      tag,
      kind: 'unknown',
      module: null,
      note: `whether anything defines <${tag}> could not be read: ${index?.error || 'the manifest is not loaded'}`,
    };
  }
  const module = index.modules.get(tag) ?? null;
  if (!module) {
    return { tag, kind: 'none', module: null, note: `nothing defines <${tag}>, so nothing draws it` };
  }
  return { tag, kind: 'element', module, note: `drawn by <${tag}> in ${module}` };
}

/**
 * The tag to RENDER for a name — the resolved one, never the catalogue key.
 *
 * A payload cannot name `<AgentFlow>`: the element is `<agent-flow>`. This is the same
 * resolution the preview document and the row both need, so it lives here rather than in
 * either of them. A generated draft (`f-<node>`) resolves to itself, which is what the
 * dev server serves it under.
 */
export function tagFor(name: string): string {
  return resolveTag(name) ?? name;
}
