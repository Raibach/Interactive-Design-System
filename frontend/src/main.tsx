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
// The right column's seat. Registration is a side effect of this import, and no
// other element imports it transitively — without it <chat-panel> is an
// unregistered tag and the right column renders as an empty box.
import "@/components/lit/chat-panel";
import "@/components/lit/trace-feed";
// The repair list the console's chat panel draws in its "view" slot. It used to be
// registered as a side effect of chat-panel's own import; the panel no longer draws it,
// and an element that is never imported is never defined — the surface would emit the
// name and the slot would stay empty, silently.
import "@/components/lit/chat-repair-actions";

// ── Lit web component registry — side-effect imports auto-register custom elements ──
import "@/components/lit/agent-card-element";
import "@/components/lit/chat-navigation-bar";
import "@/components/lit/ai-surface-sandbox";
import "@/components/lit/control-bar";
// The error channel. Its tag was in the allowlist, granted to every role, and the
// backend's own prompt tells the model to report failures through it — with no
// element behind it, that envelope rendered as an empty box. Now it renders.
import "@/components/lit/error-banner";
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
