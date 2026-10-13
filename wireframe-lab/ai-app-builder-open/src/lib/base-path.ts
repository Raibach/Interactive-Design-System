/**
 * THE DOOR'S SECTION, FOR HAND-WRITTEN PATHS (Raibach IDS, 2026-10-10).
 *
 * Next's `basePath` (next.config.ts) covers routing, <Link>, and built assets — but not a
 * single raw `fetch("/api/...")`, iframe `src`, or inline `url(/...)`. Every such path in
 * this app goes through BASE_PATH so the tool works both directly (dev) and mounted under
 * the studio's single address (the door: <studio>/builder/... forwards here).
 *
 * The value comes from next.config.ts's `env` block (NEXT_PUBLIC_BUILDER_BASE_PATH) — the
 * same literal that drives `basePath` — with the same default as a safety net. Keep in sync
 * with frontend/vite.config.ts's '/builder' proxy entry.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BUILDER_BASE_PATH || "/builder";
