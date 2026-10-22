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
 * with them. This file's whole job is the first render, the demo flag started
 * without blocking, and the gate card's exit. (SENTRY IS OFF — owner, 2026-10-02:
 * nothing to initialize first any more; the whole configuration and its reasons are
 * in `lib/sentry.ts`.)
 */
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { appConfigReady } from "@/shared/appConfig";
import "./index.css";


/*
 * ── FIRST RENDER, AND THE READ THAT NO LONGER BLOCKS IT ────────────────────────
 *
 * `appConfigReady()` STARTS the /api/config read here and is deliberately not awaited:
 * the gate does not depend on the flag, so waiting for it before the first paint was
 * paying a round-trip (measured 0.47 s on the deployed demo) for nothing. App awaits
 * the same promise before it draws the authenticated tree — by pin time, long
 * resolved.
 */
void appConfigReady();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
/*
 * THE STATIC GATE'S EXIT MOVED TO THE REACT HOLD (2026-10-19). It used to be removed here,
 * synchronously after createRoot().render() — but render only SCHEDULES the commit, so the
 * static card could vanish before GateSplash existed and a bare #110E1F frame showed between
 * the two cards ("it disappears … it loads again"). GateSplash now removes it in its own
 * layout effect: after React commits, before the browser paints — one frame, one card. The
 * decision is unchanged: App renders GateSplash only for a signed-in session; an
 * unauthenticated visitor keeps this card, because removing it would hand the screen to a
 * null App. */
