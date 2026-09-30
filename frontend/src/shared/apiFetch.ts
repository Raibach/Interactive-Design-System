/**
 * The authenticated API call — one definition, used by everything that reads the catalogue.
 *
 * MOVED HERE 2026-09-30 from `LeftVerticalMenu.tsx`, unchanged, because a second caller arrived:
 * the Design tab renders the ingest interface as a SECTION of the surface rather than as a modal
 * owned by the menu, so the helper is no longer the menu's own. It is a plain function in
 * `shared/` now, which is what it always was — the menu was simply the only caller.
 */
import { getStoredUserId } from "@/services/authService";

// Helper to make authenticated API calls with required X-User-ID header.
// Uses the stored user ID via getStoredUserId() — same pattern as every other file.
export const apiFetch = (url: string, options?: RequestInit): Promise<Response> => {
  const userId = getStoredUserId();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-ID': userId,
  };
  if (options?.headers) {
    const existingHeaders = options.headers as Record<string, string>;
    Object.assign(headers, existingHeaders);
  }
  // NO CACHE, ON EVERY READ. The owner's rule for this application: *"the whole application has to
  // be honest. Caching stuff is not allowed."* The server already sends `Cache-Control: no-store`
  // (see main.py), and this says the same thing from the request side — so a proxy, an interposed
  // cache or the browser's own store cannot answer a read with something older than the write that
  // preceded it. The reads this carries are exactly the ones where that matters: a component's
  // record, a design's layers, the activity. (A2UI's own contract is not the issue — its structure
  // is cacheable by design; the transport and the reads here are what must not be.)
  return fetch(url, { cache: "no-store", ...options, headers });
};
