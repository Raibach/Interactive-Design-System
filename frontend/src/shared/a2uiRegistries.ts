/**
 * THE DATA HALF OF THE RESOLVER — a design system's tag map, fetched and cached.
 *
 * WHY THIS EXISTS. A bundle is built long before a design system is ingested, so the mapping from a
 * component NAME to a custom-element TAG cannot be a `.ts` file written at runtime: the browser can
 * never import it. It is DATA — one `registry.json` per partition, served by the server and fetched
 * here (wireframe-lab/ADD-A-DESIGN-SYSTEM.md §6).
 *
 * HOW IT IS CONSULTED. `resolveTag(name, system)` tries the app's own tables first and this map
 * LAST: the bundle is the inventory of what the app can actually draw, and a partition's map must
 * never hijack a name the app already resolves. A system's NEW names exist only here — which is the
 * whole point: `{ "components": { "CarbonDropdown": "f-1a2b-3c4d" } }` makes an ingested name draw
 * with an element that is already in the bundle, and a name mapped to nothing the app draws is a
 * refusal on the tile, by name (never a blank frame).
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
