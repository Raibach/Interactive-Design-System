/**
 * demoMode — the shell's mirror of the server's DEMO_MODE, read once at boot.
 *
 * WHY THIS EXISTS: on the deployed demo the server refuses destructive actions
 * (backend/demo_policy.py), so a visible Delete button is a button that always
 * errors. This flag lets the shell HIDE those affordances instead, so the demo never
 * offers a door it will not open.
 *
 * IT ENFORCES NOTHING, and that is deliberate. A client that lies about this value
 * changes its own buttons and nothing else — the gate is on the server and never
 * consults this flag.
 *
 * READ ONCE, BEFORE THE FIRST RENDER (main.tsx awaits loadDemoMode), so no component
 * draws with the wrong answer and then flips. On any failure — offline, old server,
 * malformed body — the flag stays false, which is the local, full-power default: a
 * missed hide is cosmetic, and the server still refuses the action.
 */
let demoMode = false;

/** True on the deployed demo. False everywhere else, including every failure path. */
export const isDemoMode = (): boolean => demoMode;

/** Ask the server which build this is. Never throws; callers may await or ignore. */
export async function loadDemoMode(): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch("/api/config", { cache: "no-store", signal: controller.signal });
    if (!response.ok) return;
    const body = await response.json();
    demoMode = body?.demo_mode === true;
  } catch {
    // Leave demoMode false — see the header note.
  } finally {
    clearTimeout(timer);
  }
}

/** The one sentence every hidden-affordance message uses, so they read the same. */
export const DEMO_DISABLED_SENTENCE =
  "This is the demo — this action is disabled here, and nothing was changed.";
