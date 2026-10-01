import { unsafeCSS } from 'lit';
// The application's OWN sheet — the same one `main.tsx` loads into the document.
import appCss from '@/index.css?inline';

/**
 * THE APP'S STYLESHEET, AS SOMETHING A SHADOW ROOT CAN CARRY.
 *
 * WHY THIS EXISTS. The Design room's containers host the ingest tool's regions, and the room is
 * drawn by `<a2ui-renderer>` inside its OWN shadow root. That boundary is one fact with two
 * consequences, and the second one is this file:
 *
 *   1. the layout's pane logic reads its slots, so content must be loaded INSIDE an element that
 *      owns a hole (that is `design-left-panel` and its siblings);
 *   2. NO DOCUMENT STYLESHEET MATCHES ANYTHING IN THERE. The ingest is styled with Tailwind
 *      utilities, and a utility class is a selector in a document sheet — so inside the room the
 *      tool lost every one of them. Measured 2026-09-30 in the running room: the rail's own
 *      `overflow-y-auto` computed to `visible` while the rule `.overflow-y-auto { overflow-y:
 *      auto }` existed in the document, and its `flex flex-col gap-5` computed to `display: block`.
 *      The panel's contents were readable and unformatted — not the tool the owner built.
 *
 * WHAT FIXES IT IS A MOUNT, NOT A BIGGER SLOT. The container renders a plain div inside its shadow
 * tree, the region is rendered INTO that div (React portal), and the content's node tree is then
 * the shadow root — where a stylesheet adopted by that root does match it. So the container adopts
 * the app's sheet, and the tool keeps the look it has in the modal. That is the owner's own model
 * of this whole exercise: *"you don't replace, you inject… what you've got is unstyled, it has no
 * theme, it's just the application the way you built it. And we're just gonna port that into the
 * slots."* The tool keeps its look; the frame around it is the room's.
 *
 * ONE SHEET, SHARED. `unsafeCSS` of the same text in several elements is the same CSSResult, and
 * Lit adopts one CSSStyleSheet per class — so the document's sheet is parsed once and shared, not
 * copied per container.
 *
 * WHY `?inline` AND NOT A RUNTIME CLONE OF `document.styleSheets`. Cloning sheets at runtime has to
 * find the right ones (in dev the sheet arrives as a module-injected style tag), and a clone that
 * silently misses one fails as "the tool is unstyled again" — the fault this removes. The import
 * is the same text the document loads, resolved by the build. `agent-flow.ts` already imports a
 * stylesheet this way (`?inline`), which is where the pattern comes from.
 */
export const appStylesheet = unsafeCSS(appCss);
