/**
 * Application Entry Point
 */
import "@/lib/sentry";
import { isSentryReady } from "@/lib/sentry";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./index.css";
// The composer's ground, preloaded below — before React renders, which is the point (see
// THE TWO GROUNDS). The drawing's ground is NOT preloaded here: it belongs to a column that
// does not exist until a Run, so it starts loading with the canvas code instead (below).
import composerBackground from "@/assets/composer-image-bg.jpg";

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
// The judged runs of one package, for the rail's Evals view. Same registration rule as
// the two above: an element that is never imported is never defined, and the surface
// would emit the name into an empty slot, silently.
import "@/components/lit/eval-feed";
// The repair list the console's chat panel draws in its "view" slot. It used to be
// registered as a side effect of chat-panel's own import; the panel no longer draws it,
// and an element that is never imported is never defined — the surface would emit the
// name and the slot would stay empty, silently.
import "@/components/lit/chat-repair-actions";
/*
 * <agent-flow> AND <agent-canvas> ARE NOT IMPORTED HERE, ON PURPOSE — and this is the one
 * place above that breaks the rule the comments state. They were imported here, and it cost
 * every page load the drawing's code and its artwork for a column that is not on screen: a
 * person opening a package sees two columns, the prompt and her, and the third appears when
 * a Run asks for it. The owner, 2026-09-23: "When the user opens a package, prompt package
 * or clicks composer, we don't need to load all of the code for the canvas at that same
 * time. We only load that once the run is clicked."
 *
 * The Run path fetches them BEFORE it swaps the column (loadCanvasElements, in
 * WritingAreaIndex), which is what keeps the rule the deleted comment was about: the surface
 * names AgentCanvas, and a tag nothing defines draws an empty middle column with no error
 * anywhere. The drawing's own ground is fetched at the same moment, so the image is
 * decoded before a person sees the pane (the anti-flash fix, kept — see below).
 */
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

/*
 * ── THE COMPOSER'S GROUND, FETCHED BEFORE ANYTHING IS DRAWN ────────────────────
 *
 * It is large (413 KB) and it is what a person sees the moment a section of the app that has
 * never been open becomes visible — Console to composer on the first card.
 *
 * FETCHED AT MODULE SCOPE, ON PURPOSE, and that is the whole of the fix. This used to run in
 * an effect inside WritingAreaIndex, which is after React has mounted and painted — measured
 * against the deployed site, 2026-09-23, where a person opening a card for the first time saw
 * the composer's fallback colour for as long as the image took to arrive, and called it "a very
 * ugly purple paint". On localhost the same image is a disk read and the flash never happens,
 * which is why it looked like a deployment difference and was really a network one. Here it
 * starts as soon as this bundle is parsed: before the app renders, in parallel with everything
 * else the first load does.
 *
 * `decode()` is what makes it ready rather than merely fetched, and it is deliberately not
 * awaited: a decode that fails is not a reason to hold up the app, and the worth of this is in
 * the fetch having started, not in a promise nobody is waiting on.
 *
 * THE DRAWING'S GROUND IS NOT HERE, and that is the same reasoning applied the other way: it
 * belongs to a column that does not exist until a Run, so 591 KB of texture would be paid for
 * by every person who opens a package and never runs one. It is fetched by the Run — see
 * `loadCanvasElements` in WritingAreaIndex, which starts it beside the code it belongs to and
 * well before the pane is drawn.
 */
{
  const img = new Image();
  img.src = composerBackground;
  if (img.decode) img.decode().catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
