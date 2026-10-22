/**
 * THE PAGE'S LANDING HELPERS — pulled out of `pages/WritingAreaIndex.tsx` (2026-10-21).
 *
 * Owner, 2026-10-21: *"Everything is currently being loaded inside of a 12,000 line document and
 * that needs to change. We need to begin to systematically pull out that code and assign it to its
 * individual folder … it's only a navigation as it should be."*
 *
 * WHAT THIS FILE IS: the five module-scope helpers the page used for LANDING — fetching the
 * canvas elements on the first Run, warming the four room grounds, fetching the drafting view's
 * element, finding an element inside the renderer's shadow root, and reading a catalogue row's
 * preview values. None of them touch React state; all of them were declared above the component
 * and used inside it.
 *
 * WHAT IT IS NOT: no room's behaviour, no assembly, no gates. Those move to their own tab folders
 * (see `development/ops/WRITING-AREA-EXTRACTION-PLAN.md`, phase 2 onward).
 */
import productAssemblyBackground from "@/assets/product-assembly-bg.webp";
import designSectionBackground from "@/assets/design-section2-bkg.webp";
import developmentLabBackground from "@/assets/canvas-development-lab-bkg.webp";
import dataWave4Background from "@/assets/data-wave4-flipped.webp";
import canvasArt from "@/assets/room-embed-art.webp";

/**
 * THE CANVAS IS FETCHED WHEN A RUN ASKS FOR IT — and never before.
 *
 * `main.tsx` used to import the two canvas elements with the rest of the components, so every
 * person who opened a package paid for the drawing's code and its ground whether or not they ever
 * ran anything. The owner, 2026-09-23: "When the user opens a package, prompt package or clicks
 * composer, we don't need to load all of the code for the canvas at that same time. We only load
 * that once the run is clicked."
 *
 * TWO THINGS HAPPEN HERE, AND THE ORDER MATTERS:
 *   1. the ground starts fetching — it is the one part of the canvas that cannot arrive after the
 *      pane is on screen without a flash of the fallback colour, and a Run gives it the whole dock
 *      to arrive in;
 *   2. the elements are imported, and the caller swaps the column only once they are defined,
 *      because the surface names RoomEmbed and a tag nothing defines draws an empty box with no
 *      error anywhere.
 *
 * ONE PROMISE PER SESSION, held at module scope so a re-render cannot start a second fetch. A
 * failure clears it: the next Run tries again.
 */
let canvasElements: Promise<void> | null = null;

export function loadCanvasElements(): Promise<void> {
  if (canvasElements) return canvasElements;
  const ground = new Image();
  ground.src = canvasArt;
  if (ground.decode) ground.decode().catch(() => {});
  canvasElements = Promise.all([
    import("@/components/lit/agent-flow"),
    import("@/components/lit/room-embed"),
  ])
    .then(() => undefined)
    .catch((err: unknown) => {
      canvasElements = null;
      throw err;
    });
  return canvasElements;
}

/**
 * THE ROOM GROUNDS, WARMED AT LANDING (owner, 2026-10-05: *"an awful paint progressive JPEG effect
 * … load those backgrounds early somewhere else in the application, maybe after the user lands"*).
 * The Development room paints its lab tile the moment it opens, and the room-switch cover can wear
 * any room's own face: the lab tile (Development), the assembly image (Product), the wave
 * (Governance), the design sheet (Design). Fetched cold they visibly paint themselves in
 * mid-switch, so all four decode here — deliberately not awaited, and failure is nothing: every
 * room still fetches its own ground; this buys only that the usual path spends no time on it.
 */
let labGroundWarmed = false;

export function warmLabGrounds(): void {
  if (labGroundWarmed) return;
  labGroundWarmed = true;
  for (const ground of [
    developmentLabBackground,
    productAssemblyBackground,
    dataWave4Background,
    designSectionBackground,
  ]) {
    const img = new Image();
    img.src = ground;
    if (img.decode) img.decode().catch(() => {});
  }
}

/**
 * THE DRAFTING VIEW'S ELEMENT, loaded the same lazy way and for the same reason: the tree-write
 * that shows the draft CREATES `<draft-canvas>` by tag, and a tag whose module was never imported
 * is an unknown element — a blank column with no error anywhere. So the module is awaited before
 * the write, not after it.
 */
let draftElements: Promise<void> | null = null;

export function loadDraftElements(): Promise<void> {
  if (draftElements) return draftElements;
  draftElements = import("@/components/lit/draft-canvas")
    .then(() => undefined)
    .catch((err: unknown) => {
      draftElements = null;
      throw err;
    });
  return draftElements;
}

/**
 * FIND AN ELEMENT WHEREVER IT IS DRAWN — the shell draws the surface INSIDE the renderer's shadow
 * root, so `document.querySelector` reaches nothing here. That is not a theory: the save's
 * `workspace-layout` read and the restore's both came back null, and a null in either is silent —
 * the place simply never travelled, with no error anywhere. This walks the shadow roots the
 * surface is drawn into and returns the first match.
 */
export function deepFind<T extends Element>(selector: string): T | null {
  const walk = (root: ParentNode): Element | null => {
    const hit = root.querySelector(selector);
    if (hit) return hit;
    for (const el of root.querySelectorAll("*")) {
      const shadow = (el as HTMLElement).shadowRoot;
      if (!shadow) continue;
      const found = walk(shadow);
      if (found) return found;
    }
    return null;
  };
  return walk(document) as T | null;
}

/**
 * A TAG'S PREVIEW VALUES — what a preview may and may not know. It must not resolve, import or
 * read anything the application SHIPS (the catalogue's elements and behaviour), and it MAY know
 * the DATA its component will be given. A TAG WITH NO ROW YIELDS NOTHING — a component being
 * created for the first time has no data yet, and an empty list is that fact.
 */
export function previewValues(rows: any[], tag: string): Array<{ field: string; value: string }> {
  const row = rows.find((r) => r?.id === tag || r?.name === tag || r?.key === tag);
  if (!row) return [];
  const values: Array<{ field: string; value: string }> = [];
  if (row.name) values.push({ field: "name", value: String(row.name) });
  if (row.description) values.push({ field: "description", value: String(row.description) });
  // The address the row is known by, when it says something the name does not (the tree's own rule
  // for its second line): the catalogue key, which is `f-<node id>` for a generated component.
  if (row.key && row.key !== row.name) values.push({ field: "code", value: String(row.key) });
  return values;
}

/**
 * The Figma file the tool calls address. The same key the catalogs carry as
 * `x-figma-source.fileKey` and the registry records per component, so a tool call and the
 * component's provenance cannot drift apart.
 */
export const FIGMA_FILE_KEY = "20UPR2KQMsbAxlo5NJb1se";

/**
 * HOW LONG THE PROMPT TAKES TO FOLD — the pane's own `--dur-pane`, restated because the shell has
 * to WAIT for it before it shows what the fold was making room for. Two places, one number: if the
 * stylesheet's curve changes, this changes with it.
 */
export const RUN_DOCK_MS = 760;
