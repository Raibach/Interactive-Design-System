/**
 * Application Entry Point
 *
 * ── THE ENTRY IS THE GATE, NOT THE APP (2026-10-02) ────────────────────────────
 * Measured on the deployed demo: the entry bundle carried the whole application —
 * every Lit registration, the surface, the pages — so the sign-in gate could not be
 * typed into until ~2.5 s of JavaScript had arrived (a 1.0 MB entry plus a 1.25 MB
 * vendor chunk, with the composer's 413 KB ground starting at the same moment on
 * the same pipe). The gate needs React and a card; it does not need the design room.
 *
 * So the app moved behind the pin: the registrations live in
 * `components/lit/register` (imported by the app's own page, still before any
 * surface assembles), the pages are lazy (App), and the composer's ground starts
 * with them. This file's whole job is Sentry, the first render, the demo flag
 * started without blocking, and the static twin's exit.
 */
import "@/lib/sentry";
import { isSentryReady } from "@/lib/sentry";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { demoModeReady } from "@/shared/demoMode";
import "./index.css";

// ── Production Sentry guard ──────────────────────────────────────────────────
if (import.meta.env.PROD && !isSentryReady()) {
  console.error(
    "[main] Sentry failed to initialize. Check VITE_SENTRY_DSN in .env.production. " +
      "Application will continue but errors will not be reported to Sentry.",
  );
  // Set a global flag so ErrorBoundary can show a subtle indicator
  (window as any).__SENTRY_DEGRADED__ = true;
}

/*
 * ── FIRST RENDER, AND THE READ THAT NO LONGER BLOCKS IT ────────────────────────
 *
 * `demoModeReady()` STARTS the /api/config read here and is deliberately not awaited:
 * the gate does not depend on the flag, so waiting for it before the first paint was
 * paying a round-trip (measured 0.47 s on the deployed demo) for nothing. App awaits
 * the same promise before it draws the authenticated tree — by pin time, long
 * resolved.
 */
void demoModeReady();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
/*
 * THE STATIC GATE'S EXIT — AND ONLY FOR A SIGNED-IN VISITOR. The card in index.html IS
 * the door (it checks the pin itself, before any bundle exists); while unauthenticated
 * it stays, because removing it would hand the screen to a `null` App — a door nobody
 * can knock on. A signed-in boot removes it one frame after React commits, and the page
 * behind it is the same #1a1625, so the swap cannot flash white.
 */
if (localStorage.getItem("grace_is_authenticated") === "true") {
  requestAnimationFrame(() => document.getElementById("splash")?.remove());
}
