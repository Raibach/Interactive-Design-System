import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import GateSplash from "@/components/GateSplash";
import { SignUpWizard } from "@/components/SignUpWizard";
import { SentryErrorBoundary } from "@/components/SentryErrorBoundary";
import { appConfigReady, isDemoMode } from "@/shared/appConfig";
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

const queryClient = new QueryClient();

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("grace_is_authenticated") === "true";
  });
  // WHICH BUILD THIS IS, BEFORE THE TREE DRAWS. The read was STARTED by the entry
  // (main.tsx, not awaited — see there); this only waits for its answer, which for an
  // already-signed-in session is the only thing between the first frame and the app.
  const [demoSettled, setDemoSettled] = useState(false);
  useEffect(() => {
    let alive = true;
    void appConfigReady().then(() => {
      if (alive) setDemoSettled(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  /*
   * THE GATE IS THE HTML CARD (index.html) — the ONLY door. It checks the pin and writes
   * the flag itself, before any bundle exists; this component does not re-implement it
   * and renders NOTHING while the flag is absent (the card covers the screen). No
   * fallback login, no degraded path: one lock, one door.
   */
  /*
   * THE PIN-ENTRY TIME IS LOADING TIME (the owner's design, 2026-10-02). Nothing used
   * the seconds a person spends typing the pin — the app only began downloading after
   * Sign in, so the wait landed where it read as hesitation. This starts the console's
   * own chunk the moment the gate appears (and for an already-signed-in session, the
   * moment the app mounts — in parallel with the config read). By the time Enter is
   * pressed, the download is done; what remains is the console's own Standby while the
   * surface assembles, which is where a wait belongs. Same specifier as the lazy()
   * above, so it warms exactly that chunk; a failed prefetch is nothing — the real
   * import retries on the way in.
   */
  useEffect(() => {
    void import("@/pages/WritingAreaIndex").catch(() => {});
  }, []);

  /*
   * ── THE REGISTRATION DOOR (2026-10-04) ─────────────────────────────────────────────────────
   * `?signup` renders the sign-up wizard, and this is the real door — not a test one. The gate
   * in index.html carries the link that reaches it ("Register for beta testing", quieter than
   * the pin button on purpose): the pin is for the people who already have one, and this is for
   * the people who do not yet exist here. BESIDE the pin, not a way past it.
   *
   * THE TWO HALVES MOVE TOGETHER: index.html hides its card for this query (the `signup` class)
   * and this early return renders the wizard before the auth check. Deleting either leaves a
   * visitor staring at the gate with a door they cannot open.
   *
   * IT SITS BELOW THE HOOKS ON PURPOSE. Both returns below this point are EARLY returns, and a
   * hook after one of them would be a hook called on some renders and not others — which is the
   * one thing React does not forgive, and which this file was already doing before the door was
   * added (the prefetch above used to sit under the `!isAuthenticated` return). Moving the
   * returns down is the whole of that fix.
   */
  if (typeof window !== "undefined" && new URLSearchParams(window.location.search).has("signup")) {
    return (
      <SignUpWizard
        open
        onClose={() => { window.location.search = ""; }}
        /* THE REGISTERED GUEST COMES IN (2026-10-04). A person who just signed up and started a
           trial has no pin and never will — the gate is the door for people who already have
           one. So the success button opens the same session the pin opens (the flag
           index.html writes) and then leaves the door address behind; the reload lands in the
           console. Cancel keeps the old behavior: straight back to the gate. Measured before
           this existed: the success button reused onClose, and a fresh registrant met a pin
           card they could not answer. */
        onEnterWorkspace={() => {
          try {
            localStorage.setItem("grace_is_authenticated", "true");
            /* THIS DOOR IS 'registered' (2026-10-04) — the marker the Development room's frame
               carries (builder-embed.ts) so the tool's onboarding wizard appears for a
               signed-up person while dev@local keeps its current behavior. The pin login
               writes 'dev' over it; the two markers cannot both be true. */
            localStorage.setItem("grace_door", "registered");
          } catch {
            console.error("[signup] could not open the session — the gate will still show.");
          }
          /* AND THE LANDING IS THE CONSOLE (owner, 2026-10-04) — not the Development room: the
             room carries the registered door marker, so the onboarding wizard greets them
             there WHEN THEY GO THERE, and nothing drags them into it on arrival. */
          window.location.search = "";
        }}
      />
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  // Show main app if authenticated
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
                <GateSplash holdUntilDrawn />
                {demoSettled ? (
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
                      {/* All other paths redirect to root - AI controls navigation */}
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                ) : null}
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
