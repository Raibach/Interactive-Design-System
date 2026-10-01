/**
 * <design-middle-container> — the Design experience's middle column.
 *
 * WHY IT EXISTS, AND WHY IT IS NOT A NEW DESIGN.
 *
 * The Design room's columns hold the ingest tool's three regions, and content has to load INSIDE
 * a column rather than beside it — the owner: *"you don't replace, you inject… port that into the
 * slots."* The Composer's middle column is `compiled-output-viewer`, which owns its whole body
 * and has NO slot: measured 2026-09-30, no `<slot>` appears anywhere in that element, so nothing
 * can be loaded inside it. The owner ruled on exactly this case: *"If you have to make a
 * different component because you can't figure out how to load something inside of it, then build
 * a different lit component for the design section."*
 *
 * SO THIS IS THE COMPOSER'S MIDDLE COLUMN WITH A HOLE IN IT, and nothing else:
 *   - the header row IS `<output-controls>`, the Composer's own element, instantiated here
 *     unchanged and never restyled. Its docstring gives the reason in its own words: *"the
 *     header belongs to the COLUMN, not to the body that happens to be under it."*
 *   - the body is a MOUNT — a plain div inside this element's shadow tree (`data-ingest-mount`)
 *     that the ingest's middle region is rendered into. The region is React and this surface is
 *     not, so it cannot arrive as a component; and it is rendered INTO the shadow tree rather than
 *     projected by a slot because that is where the application's stylesheet can reach it (the
 *     tool is styled with Tailwind utilities, and no document sheet matches inside the renderer's
 *     root). Measured 2026-09-30 — see `@/shared/app-stylesheet.ts` and design-left-panel.
 *   - the frame's geometry is the column's own: full height, a flex column, and a body with
 *     `min-height: 0` and `overflow: hidden` so a scrolling child scrolls inside it and never
 *     grows the room. NO colour, radius or shadow is invented here: the ground belongs to the
 *     room (workspace-layout) and to the content that is loaded.
 *
 * WHAT IT MUST NOT BECOME. It is not a second `compiled-output-viewer` and it draws no output:
 * the output container is the next element, and it goes in this one's hole. It never appears in
 * the Composer — the design's surface names it and only the design's renderer draws it.
 *
 * WHY THE CONTENT LIVES INSIDE AN ELEMENT AT ALL (measured 2026-09-30). The ingest's regions are
 * React; the room's container is drawn by `<a2ui-renderer>` with lit-html, which owns that
 * container's child list. Nodes React appends to that same light DOM are unmanaged by lit — they
 * are displaced when lit re-inserts its own children — and workspace-layout re-baselines its
 * split whenever its slot's assignment changes (`_onMiddleSlotChange`), which a re-rendering
 * React region causes. The owner felt both consequences: *"I can't close the container. I can't
 * grab a hold of the grippers. It's jerking away from me."* An element whose light DOM is ONLY
 * the content, and into whose shadow lit never writes a child, is what removes the fight.
 */
import { LitElement, html, css } from 'lit';
// (The Composer's header row is NOT imported: this column has no such row — see render.)
// The application's own sheet, so the preview loaded into the hole keeps the look it has in the
// document. See that file for why a shadow root needs its own copy of it.
import { appStylesheet } from '@/shared/app-stylesheet';

export class DesignMiddleContainer extends LitElement {

  constructor() {
    super();
  }

  render() {
    /*
     * NO HEADER ROW OF ITS OWN, AND THAT IS THE POINT (owner, 2026-09-30, looking at the column:
     * *"I don't understand why I'm seeing an agent flow and functions tool at the top of the third
     * column for output that doesn't exist in your react component, so why is it here? … It's one
     * for one."*
     *
     * It IS here because this element was built as "the Composer's middle column with a hole in
     * it", and it drew the Composer's own `<output-controls>` — the view selector reading "Agent
     * Flow" and the Models button. The ingest pane has NO such row: its column opens with "Preview"
     * and the component's name and tag, which is what `<component-preview>` draws as its own head.
     * So the Composer's row is gone and the column is chrome plus the preview — one for one with
     * the build this room is a translation of.
     */
    return html`
      <div class="column">
        <div class="body"><div class="hole"><slot name="middle"></slot></div></div>
      </div>
    `;
  }

  static styles = [
    /*
     * THE APP'S OWN SHEET, ADOPTED HERE — the same mechanism as design-left-panel's, for the same
     * measured reason: the tool's regions are styled with Tailwind utility classes, a utility class
     * is a selector in a DOCUMENT sheet, and this room is drawn inside the renderer's shadow root
     * where no document sheet matches. See `@/shared/app-stylesheet.ts`.
     *
     * IT COMES FIRST so the frame's own rules below win where they speak to the same box.
     */
    appStylesheet,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */

      :host {
        display: block;
        height: 100%;
        min-width: 0;
        min-height: 0;
        /*
         * THE PANE IS A FLEX CONTAINER, so display:block alone is not enough: a flex child with no
         * flex-basis and no width is sized to its CONTENT, and this element's content is a hole
         * that has not been laid out yet — so it measured 0 wide inside a pane that had a width
         * (measured 2026-09-30: the column drawn at x=643 with width 0). flex: 1 1 auto is what
         * <a2ui-renderer> puts on itself for exactly this reason, and width: 100% keeps it right in
         * a block parent too, where flex is ignored.
         */
        flex: 1 1 auto;
        width: 100%;
      }
      /*
       * THE COLUMN'S GROUND, DIMMED SO THE COMPONENT CAN BE SEEN (owner, 2026-09-30).
       *
       * The room paints the design section's canvas — the plum base and the design-section texture
       * — behind ALL THREE columns, and the columns are transparent so it shows through (the owner
       * asked for that when the containers were panels: *"there's backgrounds on the containers
       * inside of the third column, they should be transparent"*). In THIS column the drawing is the
       * content, and the canvas at full strength sat directly under it: *"give me about a 25 percent
       * opacity on that third output column. It's a little too yellow. I can't see the components."*
       *
       * SO THE COLUMN VEILS ITS OWN BOX RATHER THAN REPAINTING IT. There is no way to lower the
       * opacity of a background that belongs to an ancestor, and painting the same texture at 25%
       * here would only stack it on the 100% one behind it — so the column lays a white veil over
       * its own area instead, and the canvas behind it reads at the strength the owner asked for:
       * 0.75 white leaves 25% of what is underneath. The veil is on the COLUMN, not on the frame:
       * component-preview's frame stays transparent (background: transparent) for the reason it
       * states, so a white component on this ground still has its 1px edge to be seen against.
       *
       * ONE NUMBER, named so it can be tuned: the veil's alpha is 1 minus the ground's strength.
       */
      .column {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        min-width: 0;
        background: rgba(255, 255, 255, 0.75);
      }
      /* The hole. min-height:0 + overflow:hidden is what makes a tall child scroll inside the
         column instead of pushing the column past the room's height — the same reason
         workspace-layout gives its panes those two values. */
      .body {
        flex: 1 1 auto;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
        display: flex;
      }
      /*
       * THE HOLE, AND WHY IT IS A SLOT NOW (2026-09-30). It was a MOUNT — a div the ingest's React
       * Preview was rendered into — because a slot leaves content in its own tree where the tool's
       * Tailwind classes cannot match. That reason belonged to the React tool, and the tool is not
       * loaded into this room at all; what stands here now is a catalogue element,
       * component-preview, which carries its own styles in its own shadow root. So the hole is a
       * SLOT, the surface fills it by name, and the frame gives the child its BOX and nothing else —
       * the same arrangement as the left panel, for the same reason.
       */
      .hole {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }
      ::slotted(*) {
        min-height: 0;
        min-width: 0;
      }
    `,
  ];
}

if (!customElements.get('design-middle-container')) {
  customElements.define('design-middle-container', DesignMiddleContainer);
}

declare global {
  interface HTMLElementTagNameMap {
    'design-middle-container': DesignMiddleContainer;
  }
}
