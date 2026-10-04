/**
 * EVERY CUSTOM ELEMENT THIS APP DRAWS WITH — one import list, registered by side effect.
 *
 * WHY THIS IS A MODULE OF ITS OWN (2026-10-02). These imports used to sit in main.tsx,
 * which meant the ENTRY bundle — the one the sign-in gate needs before it can be typed
 * into — carried every component the application can ever draw: 1.0 MB of entry plus a
 * 1.25 MB vendor chunk, measured on the deployed demo, ~2.5 s before the gate was
 * interactive. The gate needs React and a card; it does not need the design room. So the
 * registrations moved here, and the app's own page imports this module (`WritingAreaIndex`
 * lists it first): the app chunk arrives behind the pin (or behind the GateSplash card for
 * a session already signed in), and registration still happens before any surface
 * assembles — the rule the individual comments below defend.
 *
 * THE RULE THEY DEFEND, unchanged: a tag nothing defines draws an empty box and says
 * nothing, so every name the catalog can emit must have an element behind it, and the
 * registration is the import.
 */
/** A2UI v0.9.1 Lit workspace components (model-driven composer) */
import "@/components/lit/prompt-section-editor";
// The role selector inside a prompt-input-section. Catalogued and allowlisted, and
// imported by NOTHING — so its guarded define never ran, the tag `role-dropdown` did
// not exist, and the surface's name for it resolved to an empty box with no error.
// Same rule as every import below: a tag nothing defines draws nothing and says nothing.
import "@/components/lit/prompt-input/role-dropdown";
import "@/components/lit/compiled-output-viewer";
// The Design room's middle column — the Composer's middle column with a HOLE in it. It exists
// because `compiled-output-viewer` (the line above) owns its whole body and has no slot, so the
// ingest's Preview could not be loaded inside the column. Only the design surface names it
// (`render-design`); the Composer's own column is untouched by its existence.
import "@/components/lit/design-middle-container";
// The Design room's left column — the same idea one column over, and the fix for what the owner
// saw on screen: the ingest's rail was loading UNDERNEATH the Composer's panel, loose in the pane.
// The panel is the design's own "center-panel-3rd-col" and it stays (reused as <prompt-container>,
// never restyled); this element is that frame with a `<slot name="left">` inside it, because
// `prompt-container` has only its default slot and the ingest's left region carries `slot="left"`.
import "@/components/lit/design-left-panel";
// THE INGEST RAIL'S TOP HALF — the Figma URL field, the Notes field and Submit, as a catalogue
// element. It is the one part of that rail nothing drew: the tree half is `figma-layers-view`
// (reused, imported through IngestModal), but no catalogue element existed for a text field, so the
// input the owner asked for could not be named by any surface until this existed. Same registration
// rule as every import here — a tag nothing defines draws an empty box and says nothing.
import "@/components/lit/figma-ingest-form";
import "@/components/lit/catalog-ingest-form";
// THE MIDDLE COLUMN'S PREVIEW — what a RUN loaded. Same registration rule: without this import
// the surface names a tag nothing defines and the column draws an empty pane with no error.
import "@/components/lit/component-preview";
// AND THE DRAWING ITSELF WHEN THE RUN WAS AN INGEST. The frame above says what a run loaded; this
// element DRAWS a draft — from the temporary file the ingest wrote (`.preview/<jobId>/`), inside
// the same sandboxed, catalogue-blind document the ingest form's Preview pane builds. It exists
// because a draft and an approved component can share a NAME: given the name, the renderer resolves
// it through the catalogue, so re-ingesting a node the catalogue already holds drew the approved
// component while the fresh draft sat untouched. Given the FILE, it can only draw the draft.
import "@/components/lit/draft-preview";
// (THE PRODUCT ROOM'S CONTEXT STRIP WAS HERE — `design-system-picker`, registered 2026-10-03 and
// removed the same day on the owner's word: *"I don't want the user to be able to select a
// catalogue… I'm removing that feature."* The room's system is a server-side constant now;
// nothing selects, so nothing is registered. The element file is deleted with this import.)
// THE COPIED-IN DESIGN SYSTEMS (2026-10-03) — AgnosticUI's Select (instance #1) and Kor's
// button (instance #2), real upstream source walked through this app's catalogue pipeline
// (manifest → ingest → accept). EACH SYSTEM'S REGISTRATION IS ITS OWN FILE: these imports point
// at each system's registry module (components/lit/<system>/registry.ts), which registers that
// system's elements and carries its declarations — by the owner's wall (PLANS.AGENT/
// multiple-catalogs.md §10), an ingested system's registry lives in its own tree and never in
// shared/tag-registry.ts, and this list pulls it into the bundle the same way it pulls every
// other element of this app.
import "@/components/lit/agnosticui/registry";
import "@/components/lit/kor/registry";
// AND CARBON — IBM'S OWN (2026-10-03, late): the vendor package's own Lit components, used
// AS-IS (its registry module imports @carbon/web-components' modules — no copied source) plus
// Carbon's styles. The room's system is Carbon; Kor stays a partition, unseated.
import "@/components/lit/carbon/registry";
// THE GOVERNANCE ROOM'S FEED (2026-10-03) — the per-call cost ledger, drawn. Same registration
// rule as every import here: the room's tree names it, so a tag nothing defines would draw an
// empty box and say nothing.
import "@/components/lit/governance-usage-view";
// THE PRODUCT ROOM'S STAGE, IN ITS OWN ERA (2026-10-03, late): <artifact-canvas> is the window
// onto the PAGE Grace builds from the person's sentence (POST /api/ai/build-artifact) — a
// sandboxed iframe that cannot run a script, with the rail's one Clear. Same registration rule
// as every import here: the room's tree names it, so a tag nothing defines would draw an empty
// box and say nothing. (The node-era <draft-canvas> stage stays for the Composer; it is
// parked, unwired, in the Product room's tree.)
import "@/components/lit/artifact-canvas";
// THE PRODUCT ROOM IS THE BUILDER NOW (2026-10-04): <builder-embed> is the room's one pane —
// the whole app builder (prompt box, run progression, live preview, code) served by this
// machine's local engine, with Grace's seat removed from this room (owner: *"just load that
// inside of the product area … the product room will just remove the grace chat"*). Same
// registration rule as every import here: the room's tree names it, so a tag nothing defines
// would draw an empty box and say nothing.
import "@/components/lit/builder-embed";
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
// The judged runs of one package, for the rail's Evals view. Same registration rule as the two
// above: an element that is never imported is never defined, and the surface would emit the name
// into an empty slot, silently.
//
// REMOVED ONCE, AND RESTORED — 2026-09-28. This line was deleted when <eval-feed> was removed
// from the catalogue, and the package assembly still names EvalFeed (backend/routes/ai.py), so
// the surface went on asking for a component nothing could draw. The component is back; the
// prompt never changed. If the Evals view is ever retired for real, it comes out of the prompt
// first — removing the component while the prompt names it is a 503, not a cleanup.
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
// The components APPROVED THROUGH INGESTION. They were declared in the allowlist, in the
// catalogue and in the Figma map, and defined by NOTHING — so each of them drew the renderer's
// "resolved to <f-…>, which no element defines" block instead of itself. This import is the
// definition; the file it points at explains the measurement and why a glob rather than an
// entry above.
import "@/components/lit/ingested";
import composerBackground from "@/assets/composer-image-bg.jpg";

/*
 * ── THE COMPOSER'S GROUND, FETCHED BEFORE THE APP DRAWS ───────────────────────
 *
 * It is large (413 KB) and it is what a person sees the moment a section of the app that has
 * never been open becomes visible — Console to composer on the first card.
 *
 * IT MOVED HERE FROM main.tsx WITH THE REGISTRATIONS (2026-10-02), and for the same reason
 * the registrations moved: at module scope in the entry, it started a 413 KB download at the
 * same moment as the gate's own JavaScript, on the same pipe, before a person had typed
 * anything. Here it starts when the app chunk parses — still before React mounts the surface
 * that first shows it, which is the anti-flash property the original comment measured:
 * fetched ahead of the pane, so a person opening a card for the first time never sees the
 * composer's fallback colour. `decode()` is what makes it ready rather than merely fetched,
 * and it is deliberately not awaited: a decode that fails is not a reason to hold up the app,
 * and the worth of this is in the fetch having started, not in a promise nobody is waiting on.
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
