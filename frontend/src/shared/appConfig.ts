/**
 * appConfig — the shell's mirror of the server's boot config (GET /api/config), read once at boot.
 *
 * TWO FACTS LIVE HERE, and they are the same fact's two halves — "which build am I standing in,
 * and where its tool lives":
 *
 * 1. THE DEMO FLAG, unchanged since 2026-10-02. On the deployed demo the server refuses
 *    destructive actions (backend/demo_policy.py), so a visible Delete button is a button that
 *    always errors. This flag lets the shell HIDE those affordances instead, so the demo never
 *    offers a door it will not open.
 *
 * 2. THE ROOMS' TOOL ADDRESSES (Product 2026-10-04; Development restored 2026-10-06 — the
 *    local workspace, run from this repo with its reporting channel stripped;
 *    development/CHANGELOG.md). Both embeds used to be hardcoded `http://localhost:…`, which
 *    on a deployed site means THE VISITOR'S OWN COMPUTER — the night the demo went remote,
 *    that is exactly what raised Chrome's local-network permission box. The server
 *    (env-driven on the app service) can now name the addresses at runtime; this module
 *    carries them to the rooms.
 *
 * THE DEFAULT IS THE LOCAL MACHINE, AND ONLY WHEN THE PAGE IS ON THE LOCAL MACHINE. With
 * nothing configured a local run keeps `http://localhost:3223` exactly as before. On any
 * DEPLOYED origin — where localhost would be the visitor's computer — an unset value becomes
 * the EMPTY STRING, and the room reads that as "not connected" and draws NOTHING (no
 * fallbacks — the owner's law: *"there is no fallback ever"*). So the room never branches on
 * demo-ness for its tool address; it asks this module for an address and renders either the
 * tool or nothing.
 *
 * IT ENFORCES NOTHING, and that is deliberate. A client that lies about any of this changes its
 * own buttons and nothing else — the gate is on the server and never consults these values.
 *
 * READ ONCE, STARTED BY THE ENTRY, AWAITED BY App. `appConfigReady()` is called at boot
 * (main.tsx, not awaited — the gate does not depend on it, so the round-trip rides beside the
 * entry's parse instead of blocking the first render) and returned to App, which awaits the same
 * promise before drawing the authenticated tree — by pin time it has long resolved. On any
 * failure — offline, old server, malformed body — the demo flag stays false and the tool
 * address stays local, which is the full-power local default: a missed hide is cosmetic, and
 * the server still refuses the action.
 */
let demoMode = false;

const LOCAL_DEVELOPMENT_TOOL = "http://localhost:8090/";
const LOCAL_BUILDER_TOOL = "http://localhost:3223";
// 2026-10-08: Langfuse (self-hosted in governance/langfuse-main) through the frame proxy.
// 2026-10-09 (owner): the address carries the PROJECT PATH — the app's bare root shows the
// project chooser whenever the browser has no remembered project, so the room always opens
// the project Home ("the homepage") instead. Same path the hosted room uses.
const LOCAL_GOVERNANCE_TOOL =
  "http://localhost:3100/project/51211b35-c875-4715-8040-33fccb624279";

let developmentTool = LOCAL_DEVELOPMENT_TOOL;
let builderTool = LOCAL_BUILDER_TOOL;
let governanceTool = LOCAL_GOVERNANCE_TOOL;

/** True on the deployed demo. False everywhere else, including every failure path. */
export const isDemoMode = (): boolean => demoMode;

/**
 * The Development room's workspace (the repo-run development tool). Empty string = not
 * connected — the room says so plainly instead of reaching anywhere.
 */
export const developmentToolUrl = (): string => developmentTool;

/**
 * The Product room's tool (the app builder). A project's workspace address is
 * `${builderToolUrl()}/project/<id>`. Empty string = not connected, same rule.
 */
export const builderToolUrl = (): string => builderTool;

/**
 * The Governance room's tool — Langfuse (self-hosted in governance/langfuse-main),
 * the LLM-observability platform, embedded since 2026-10-08. Empty string = not
 * connected, same rule. The loopback law below applies to it exactly as to the
 * other two: a deployed page may never reach a visitor's machine.
 */
export const governanceToolUrl = (): string => governanceTool;

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
      const governance = typeof body?.governance_tool_url === "string" ? body.governance_tool_url.trim() : "";
      // UNCONFIGURED MEANS LOCAL ONLY ON A LOOPBACK HOST, AND THIS IS THE SHIPPED PAGE'S LAW
      // (2026-10-06, late): a deployed page may never reach a visitor's loopback. The old
      // branch keyed this on the demo flag — when the demo went off, a deployed page with an
      // unset value fell to `http://localhost:…` (the visitor's machine). Unset on localhost →
      // the local ports; unset on any deployed origin → "" ("not connected"; the room draws
      // nothing).
      const onLocalhost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname);
      developmentTool = development || (onLocalhost ? LOCAL_DEVELOPMENT_TOOL : "");
      builderTool = builder || (onLocalhost ? LOCAL_BUILDER_TOOL : "");
      governanceTool = governance || (onLocalhost ? LOCAL_GOVERNANCE_TOOL : "");
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
