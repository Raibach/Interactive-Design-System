/**
 * THE DATA HALF OF THE RESOLVER — a design system's tag map, fetched and cached.
 *
 * WHY THIS EXISTS. A bundle is built long before a design system is ingested, so the mapping from a
 * component NAME to a custom-element TAG cannot be a `.ts` file written at runtime: the browser can
 * never import it. It is DATA — one `registry.json` per partition, served by the server and fetched
 * here (wireframe-lab/ADD-A-DESIGN-SYSTEM.md §6).
 *
 * HOW IT IS CONSULTED — AND THE ORDER CHANGED ON 2026-10-03, BY THE OWNER'S WALL. `resolveTag(name,
 * system)` reads the CHOSEN system's own table FIRST: a design system's catalogue is the authority
 * for its own session, and its name→tag table is its own file — this is the "own resolver" that
 * PLANS.AGENT/multiple-catalogs.md §9 requires, so *"the registries"* stay walled. The app's
 * allowlist answers only after this map (it is the PROMPT-COMPOSER catalogue's own table; an
 * ingested system's names were never written into it). The map is what makes an ingested name draw
 * with an element that is already in the bundle — `{ "components": { "kor-button": "kor-button" } }`
 * — and a name that maps to nothing is a refusal on the tile, by name (never a blank frame).
 *
 * NO FALLBACKS. A fetch that fails THROWS, with the system and the status named — a map that could
 * not be read must not read as "this name does not exist", because those are different repairs. An
 * unknown system is a 404 for the same reason.
 */
import { API_BASE } from './apiHelper';

/** Loaded maps, by system — what `systemTagFor` (sync, for the resolver) reads. */
const LOADED = new Map<string, Record<string, string>>();
const IN_FLIGHT = new Map<string, Promise<Record<string, string>>>();

export async function loadSystemRegistry(system: string): Promise<Record<string, string>> {
  const already = LOADED.get(system);
  if (already) return already;
  const running = IN_FLIGHT.get(system);
  if (running) return running;
  const load = (async () => {
    const res = await fetch(`${API_BASE}/catalog/${encodeURIComponent(system)}/registry`);
    if (!res.ok) {
      throw new Error(
        `the registry for the design system '${system}' could not be read: HTTP ${res.status}`,
      );
    }
    const body = (await res.json()) as { components?: unknown };
    if (!body || typeof body.components !== 'object' || body.components === null) {
      throw new Error(`the registry for '${system}' came back without a components map`);
    }
    const mapping = body.components as Record<string, string>;
    LOADED.set(system, mapping);
    return mapping;
  })();
  IN_FLIGHT.set(system, load);
  try {
    return await load;
  } catch (err) {
    // A failed load is not cached: the next ask tries again, and the failure has already been said.
    IN_FLIGHT.delete(system);
    throw err;
  }
}

/** The tag a system's registry maps for a name — sync, for `resolveTag`. Unloaded means unknown. */
export function systemTagFor(name: string, system?: string | null): string | null {
  if (!system) return null;
  const map = LOADED.get(system);
  if (!map) return null;
  const tag = map[name];
  return typeof tag === 'string' && tag ? tag : null;
}
