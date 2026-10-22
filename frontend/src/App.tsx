import { lazy, Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";
import { isDemoMode } from "@/shared/appConfig";
import "./global.css";

/*
 * ── THE PAGES ARE LAZY, ON PURPOSE (2026-10-02) ────────────────────────────────
 * The gate is the entry bundle's job and nothing else's. The application — the
 * surface, the workspace, the forty component registrations the surface's own page
 * imports (components/lit/register) — must not sit in front of the first paint.
 * Measured on the deployed demo before this split: 2.25 MB of JavaScript, about
 * 2.5 s, before the gate could be typed into. Whatever these names now import
 * arrives behind the pin — or behind the GateSplash card for a session that is
 * already signed in, which is the same card the static twin in index.html draws,
 * so the whole boot reads as one slow gate that becomes typeable, never a blank
 * page and never a bare spinner.
 */
const WritingAreaIndex = lazy(() => import("@/pages/WritingAreaIndex"));
const CommandCenter = lazy(() => import("@/pages/CommandCenter"));
// The catalogue inspector — the real structure of catalog.json on screen, read-only. Its own
// route because it is a reader of the catalogue, not a surface the AI assembles: no catalog
// entry names it, and nothing on `/` links to it except this route's own path.
const CatalogInspector = lazy(() => import("@/pages/CatalogInspector"));
// THE TRACE EXPERIENCE — its own page, its own file.
const TraceExperience = lazy(() => import("@/pages/TraceExperience"));

const queryClient = new QueryClient();

function App() {
  /* THE PIN GATE IS GONE (owner, 2026-10-21: *"if the code was properly clean … I didn't have a
     whole bunch of junk in it like authorization gates and stuff for these applications then it
     wouldn't be slow"*).

     What stood here: an `isAuthenticated` state read from `sessionStorage.grace_is_authenticated`,
     a `useGateSession()` listener for the static card's `grace-signed-in` event, and
     `if (!isAuthenticated) return null;`. That last line is why a browser with no flag saw a
     WHITE PAGE FOREVER — the card that was supposed to write the flag had been removed from
     index.html, so nothing could ever write it and the app returned null for the rest of the
     session. A door whose key is no longer minted is not a door, it is a blank screen.

     There is no login for this application: it is a local studio serving its own rooms. The
     shell renders, always. */

  /*
   * THE PIN-ENTRY TIME IS LOADING TIME (the owner's design, 2026-10-02). Nothing used
   * the seconds a person spends typing the pin — the app only began downloading after
   * Sign in, so the wait landed where it read as hesitation. This starts the console's
   * own chunk the moment the gate appears. Same specifier as the lazy() above, so it
   * warms exactly that chunk; a failed prefetch is nothing — the real import retries on
   * the way in.
   */
  useEffect(() => {
    void import("@/pages/WritingAreaIndex").catch(() => {});
  }, []);


  // Show main app
  try {
    return (
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <Sonner 
              position="top-center" 
              richColors 
              toastOptions={{
                style: {
                  background: '#166534',
                  color: '#fff',
                  border: '1px solid #15803d',
                  fontSize: '15px',
                  fontWeight: 600,
                  padding: '14px 20px',
                  minWidth: '320px',
                  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
                },
              }}
            />
            <div className="h-screen bg-grace-bg overflow-hidden">
              <SentryErrorBoundary
                scope="app-root"
                onError={(error, componentStack) => {
                  console.error("App-level error:", error.message);
                }}
              >
                {/* THE HOLD (owner, 2026-10-02): after Sign in, stay on the gate's own
                    card — a spinner and "Preparing…" — until the console has FINISHED
                    its first attempt (a surface drawn, or its error state showing), then
                    cross-fade away. No timer decides; the console's own state does. The
                    cap inside is a last-resort abort so a dead server cannot freeze the
                    tab. */}
                {/* THE SPLASH IS GONE (owner, 2026-10-21: *"We don't need the gate splash at all"*).
                    index.html hides its own card the moment the session is signed in, so there is
                    nothing left for this component to lift — and its amber ring could no longer
                    collide with a room's gate ring. The visitor gate in the same card is untouched:
                    a signed-out visitor still sees the form and never this shell. */}
                {/* THE TREE NO LONGER WAITS FOR THE CONFIG READ (owner, 2026-10-21: *"oh yes let's
                    take this out"*). It used to render only after `appConfigReady()` settled, which
                    measured 1.7 s between the gate lifting and the console's own standby showing —
                    time the person spent looking at an empty frame. The console slot draws its own
                    standby the moment the shell paints; the rooms read the tool URLs when they mount,
                    and the dev-only routes below appear once the config answers (the state change
                    below is what re-renders this tree). */}
                <Suspense fallback={null}>
                  <Routes>
                      {/* A2UI: Single root route - AI assembles all surfaces dynamically */}
                      <Route
                        path="/"
                        element={<WritingAreaIndex isAuthenticated={true} />}
                      />
                      {/* The debug centre and the catalogue inspector read infrastructure
                          and server files, and the demo refuses both at the gate
                          (demo_policy.py: /api/debug/, /api/files/) — so the demo does not
                          route to them either. Nothing on `/` links to them; a visitor
                          only meets them by typing the URL. */}
                      {!isDemoMode() && (
                        <Route
                          path="/debug/command-center"
                          element={<CommandCenter />}
                        />
                      )}
                      {/* The catalogue inspector. A fixed route rather than a redirect, and
                          additive: `/` and the debug route are untouched. */}
                      {!isDemoMode() && (
                        <Route
                          path="/catalogs"
                          element={<CatalogInspector />}
                        />
                      )}
                      {/* The Trace experience on its own route — the surface a host frames.
                          Read by its own fetch; the pick lives in its own address. */}
                      {!isDemoMode() && (
                        <Route
                          path="/trace-experience"
                          element={<TraceExperience />}
                        />
                      )}
                      {/* All other paths redirect to root - AI controls navigation */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                </Suspense>
              </SentryErrorBoundary>
            </div>
          </TooltipProvider>
        </QueryClientProvider>
      </BrowserRouter>
    );
  } catch (error) {
    console.error("App render error:", error);
    return (
      <div style={{ color: "red", padding: "20px" }}>
        Error: {String(error)}
      </div>
    );
  }
}

export { App };
export default App;
