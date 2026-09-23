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
// The role selector inside a prompt-input-section. Catalogued and allowlisted, and
// imported by NOTHING — so its guarded define never ran, the tag `role-dropdown` did
// not exist, and the surface's name for it resolved to an empty box with no error.
// Same rule as every import below: a tag nothing defines draws nothing and says nothing.
import "@/components/lit/prompt-input/role-dropdown";
import "@/components/lit/compiled-output-viewer";
import "@/components/lit/workspace-layout";
// The prompt's own bar — title, version label and package id, above the sections in the
// left column. It used to be row 2 of the React `LeftColumnHeader`, which meant the TITLE
// had no data path at all: it could only be changed through a callback the shell handed
// down, so nothing the AI could reach could read it or set it. Imported here for the same
// reason as every element below — a tag nothing defines draws an empty box and says
// nothing. (Row 1 of that file, the Console/Composer/Evaluation/Variables/Metadata tabs,
// is SHELL NAVIGATION and stays in the shell.)
import "@/components/lit/left-column-header";
// The right column's seat. Registration is a side effect of this import, and no
// other element imports it transitively — without it <chat-panel> is an
// unregistered tag and the right column renders as an empty box.
import "@/components/lit/chat-panel";
// The response row inside the panel's output card — v.4b's "user-response-bubble"
// (#40001119:6352). <chat-messages> imports it for the user's turns, but it is
// allowlisted and map'd, which means the surface can name it too; the import here is
// the one that guarantees the tag exists whether or not the thread ever draws one.
import "@/components/lit/user-response-bubble";
import "@/components/lit/trace-feed";
// The repair list the console's chat panel draws in its "view" slot. It used to be
// registered as a side effect of chat-panel's own import; the panel no longer draws it,
// and an element that is never imported is never defined — the surface would emit the
// name and the slot would stay empty, silently.
import "@/components/lit/chat-repair-actions";
// The flow canvas the output column swaps in on Run. Registration is a side effect
// of the import, like every element above: without it the surface's AgentFlow name
// resolves to a tag nothing defines, and the middle column draws an empty box with
// no error anywhere.
import "@/components/lit/agent-flow";
// THE PLUG-IN: the canvas and her seat as one element. Imported for the same reason —
// a tag nothing defines draws an empty box and says nothing — and it is what the surface
// mounts when the drawing and Grace are meant to arrive together. Importing it also
// defines <agent-flow> and <chat-panel>, which it composes.
import "@/components/lit/agent-canvas";
// The middle column's HEADER — the view selector and the model selector. It is its own
// element because the header belongs to the column, not to whatever body is under it: the
// flow view takes the column on Run, and the header has to survive the swap.
import "@/components/lit/output-controls";
// The canvas column's FOOT — the ControlBar master's bar, carried by any surface that
// draws the canvas. It was the playground's own chrome until the app needed it: a row of
// markup on one page is a row no other page can have, and the tone switch went with it.
import "@/components/lit/canvas-footer";

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
import "@/components/lit/output-header";
import "@/components/lit/output-footer-area";

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
