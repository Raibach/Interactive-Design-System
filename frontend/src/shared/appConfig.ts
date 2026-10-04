/**
 * appConfig — the shell's mirror of the server's boot config (GET /api/config), read once at boot.
 *
 * TWO FACTS LIVE HERE, and they are the same fact's two halves — "which build am I standing in,
 * and where do its tools live":
 *
 * 1. THE DEMO FLAG, unchanged since 2026-10-02. On the deployed demo the server refuses
 *    destructive actions (backend/demo_policy.py), so a visible Delete button is a button that
 *    always errors. This flag lets the shell HIDE those affordances instead, so the demo never
 *    offers a door it will not open.
 *
 * 2. THE ROOMS' TOOL ADDRESSES (2026-10-04 — wireframe-lab/HOST-THE-TOOLS.md). The Development
 *    room embeds OpenHands' Agent Canvas and the Product room embeds the app builder; both used
 *    to be hardcoded `http://localhost:…`, which on a deployed site means THE VISITOR'S OWN
 *    COMPUTER — the night the demo went remote, that is exactly what raised Chrome's
 *    local-network permission box. The server (env-driven on the app service) now names the
 *    addresses at runtime; this module carries them to the rooms.
 *
 * THE DEFAULT IS THE LOCAL MACHINE, AND THE DEFAULT LIVES HERE, ONCE. With nothing configured a
 * local run keeps `http://localhost:8090` / `http://localhost:3223` exactly as before. ONLY on
 * the demo — where localhost would be the visitor's computer — an unset value becomes the EMPTY
 * STRING, and the rooms read that as "not connected" and show their honest panel. So the rooms
 * never branch on demo-ness for their tool address; they ask this module for an address and
 * render either the tool or the fallback.
 *
 * IT ENFORCES NOTHING, and that is deliberate. A client that lies about any of this changes its
 * own buttons and nothing else — the gate is on the server and never consults these values.
 *
 * READ ONCE, STARTED BY THE ENTRY, AWAITED BY App. `appConfigReady()` is called at boot
 * (main.tsx, not awaited — the gate does not depend on it, so the round-trip rides beside the
 * entry's parse instead of blocking the first render) and returned to App, which awaits the same
 * promise before drawing the authenticated tree — by pin time it has long resolved. On any
 * failure — offline, old server, malformed body — the demo flag stays false and the tool
 * addresses stay local, which is the full-power local default: a missed hide is cosmetic, and
 * the server still refuses the action.
 */
let demoMode = false;

const LOCAL_DEVELOPMENT_TOOL = "http://localhost:8090/";
const LOCAL_BUILDER_TOOL = "http://localhost:3223";

let developmentTool = LOCAL_DEVELOPMENT_TOOL;
let builderTool = LOCAL_BUILDER_TOOL;

/** True on the deployed demo. False everywhere else, including every failure path. */
export const isDemoMode = (): boolean => demoMode;

/**
 * The Development room's tool (OpenHands Agent Canvas). Empty string = not connected —
 * the room shows its honest panel instead of reaching anywhere.
 */
export const developmentToolUrl = (): string => developmentTool;

/**
 * The Product room's tool (the app builder). A project's workspace address is
 * `${builderToolUrl()}/project/<id>`. Empty string = not connected, same rule.
 */
export const builderToolUrl = (): string => builderTool;

let started: Promise<void> | null = null;

/** Ask the server which build this is — once. Never rejects; callers may await or ignore. */
export function appConfigReady(): Promise<void> {
  started ??= (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch("/api/config", { cache: "no-store", signal: controller.signal });
      if (!response.ok) return;
      const body = await response.json();
      demoMode = body?.demo_mode === true;
      const development = typeof body?.development_tool_url === "string" ? body.development_tool_url.trim() : "";
      const builder = typeof body?.builder_tool_url === "string" ? body.builder_tool_url.trim() : "";
      // Unset is local localhost when this is a full run, and "not connected" on the demo —
      // see the header's "DEFAULT IS THE LOCAL MACHINE" note.
      developmentTool = development || (demoMode ? "" : LOCAL_DEVELOPMENT_TOOL);
      builderTool = builder || (demoMode ? "" : LOCAL_BUILDER_TOOL);
    } catch {
      // Leave the local defaults — see the header note.
    } finally {
      clearTimeout(timer);
    }
  })();
  return started;
}

/** The one sentence every hidden-affordance message uses, so they read the same. */
export const DEMO_DISABLED_SENTENCE =
  "This is the demo — this action is disabled here, and nothing was changed.";
