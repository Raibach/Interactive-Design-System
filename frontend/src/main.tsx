/**
 * Application Entry Point
 */
import "@/lib/sentry";
import { isSentryReady } from "@/lib/sentry";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";

/** A2UI v0.9.1 Lit workspace components (model-driven composer) */
import "@/components/lit/prompt-section-editor";
import "@/components/lit/compiled-output-viewer";
import "@/components/lit/workspace-layout";

// ── Lit web component registry — side-effect imports auto-register custom elements ──
import "@/components/lit/agent-card-element";
import "@/components/lit/chat-navigation-bar";
import "@/components/lit/ai-surface-sandbox";
import "@/components/lit/control-bar";
// The A2UI surface renderer. Registration is a side effect of the import, the
// same as every element above. It is what turns Grace's updateComponents payload
// into DOM — without this import the <a2ui-renderer> tag in WritingAreaIndex is
// an unknown element and renders as an empty inline box, silently.
import "@/components/lit/a2ui-renderer";

// ── Production Sentry guard ──────────────────────────────────────────────────
if (import.meta.env.PROD && !isSentryReady()) {
  console.error(
    "[main] Sentry failed to initialize. Check VITE_SENTRY_DSN in .env.production. " +
      "Application will continue but errors will not be reported to Sentry.",
  );
  // Set a global flag so ErrorBoundary can show a subtle indicator
  (window as any).__SENTRY_DEGRADED__ = true;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
