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
import { demoModeReady } from "@/shared/demoMode";
import "./index.css";

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
 * behind it is the same #110E1F, so the swap cannot flash white.
 */
if (localStorage.getItem("grace_is_authenticated") === "true") {
  // SYNCHRONOUS, AND THAT IS A FIX — measured 2026-10-03, late: this removal was scheduled on
  // requestAnimationFrame, and rAF DOES NOT FIRE IN A HIDDEN PANE (the in-app browser behind
  // another window, a backgrounded tab). The splash then stayed over a fully-rendered app until
  // the pane was looked at again — "I can't read it… nothing works" from the other side of the
  // glass, and a driver's clicks timing out against a full-screen overlay. The one-frame delay
  // was only ever for the flash this comment's neighbours say cannot happen (#splash and the page
  // behind it are the same #110E1F); a synchronous remove has no such window at all.
  document.getElementById("splash")?.remove();
}
