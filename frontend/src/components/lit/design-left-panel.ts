/**
 * <design-left-panel> — the Design room's left column: the Composer's own panel frame
 * with a HOLE in it, so what belongs in that column is drawn INSIDE the panel instead of
 * underneath it. The hole is `<slot name="left">`, and the SURFACE fills it: `render-design`
 * names a child in `design-left-panel.children.left` and the renderer instantiates it there.
 * Today that child is `<figma-layers-view>` — the ingestion rail's own component tree, reused.
 *
 * WHAT WAS WRONG (measured on screen 2026-09-30, the owner): Design's left column drew the
 * Composer's prompt editor — the Agent Role tile, the "Functions | Tools" button and the empty
 * textarea — and the ingest's rail appeared BELOW that, loose in the pane. The owner: *"it is
 * loading underneath the container the design renderer has to render it inside of the
 * container."* Both halves of that are the fault this element removes.
 *
 * WHY THE FRAME IS REUSED AND NOT REDRAWN. The panel is the design's "center-panel-3rd-col"
 * (40001066:3888) and the owner calls it the left column's panel: *"it's the same panel that we
 * have the prompt / agent prompt inputs, and it's called left column."* It is part of the frame,
 * so it stays — and it stays BY REUSE: `<prompt-container>` is the Composer's own element for
 * that frame, instantiated here unchanged and never restyled. Its 1px #C0BDCF border, its
 * rounded top-left 10px and its 40px format rail are the drawing's numbers, and none of them is
 * restated here.
 *
 * WHAT THE HOLE IS TODAY: A SLOT, AND THE SURFACE FILLS IT. The panel renders
 * `<slot name="left">` and the room's children are projected by it — `render-design` puts a
 * component in `design-left-panel.children.left` and the renderer instantiates it there, so what
 * stands in this column is the envelope's child and nothing else. Today that child is
 * `<figma-layers-view>` (the ingestion rail's own tree, reused unchanged).
 *
 * THE MOUNT THIS ELEMENT ONCE CARRIED IS GONE, and it is worth keeping the measurement that
 * removed it. It used to hold a plain div inside its shadow tree (`data-ingest-mount`, still on
 * `design-middle-container`) and the ingestion tool's rail was rendered INTO it by React. Measured
 * 2026-09-30 in the running room: a slot leaves the content in ITS OWN tree, where this room's
 * boundary bites twice — the tool is styled with Tailwind utility classes, those are selectors in
 * a DOCUMENT stylesheet, and no document stylesheet matches inside the renderer's shadow root, so
 * the rail computed to `display: block` and `overflow-y: visible` while its own classes asked for
 * `flex` and `auto`. It arrived unformatted with a 153px URL field and a component list that could
 * not be scrolled. So a slot was NOT the host for the tool — but it is exactly the host for a
 * CATALOGUE ELEMENT, which carries its own styles inside its own shadow root and needs nothing
 * from this document. That is why the mount is not missed: the thing it was built for is no longer
 * loaded here at all, and the thing that IS loaded here does not need it.
 *
 * WHY THE TOOL IS NOT IN THE ROOM AT ALL. Mounting it was forbidden for a second, measured reason:
 * the rail is a React tree and the room's container is drawn by `<a2ui-renderer>` with lit-html,
 * which owns that container's child list. Nodes React appends to that same list are unmanaged by
 * lit — they are displaced when lit re-inserts its own children — and every change in a slot's
 * assignment makes workspace-layout re-baseline its split, which is a divider that moves while a
 * hand is on it. Measured on the live page: the layout sat at y = −129 with a 202px React block
 * below it. The ingest tool opens from the left menu, where a host mount belongs; inside the room
 * its function is carried by catalogue elements bound to the data model, which is what this column
 * now shows.
 *
 * WHAT IT DOES NOT DO. It never appears in the Composer: only Design's surface names it, and only
 * Design's renderer draws it (registered under `design`, and in
 * `catalogs/design-artifacts/catalog.json`). It draws no content of its own and invents no colour,
 * radius or shadow — every pixel in its shadow tree belongs to <prompt-container>.
 */
import { LitElement, html, css } from 'lit';
// The Composer's own left-column panel — the frame, reused and never restyled.
import './prompt-input/prompt-container';
// The application's own sheet, so the tool loaded into the hole keeps the look it has in the
// document. See that file for why a shadow root needs its own copy of it.
import { appStylesheet } from '@/shared/app-stylesheet';

export class DesignLeftPanel extends LitElement {
  static properties = {
    /**
     * Passed straight through to the frame's format rail, which shows both verbatim.
     *
     * BOTH DEFAULT TO EMPTY, AND THAT IS DELIBERATE. The rail's two texts are the design's
     * labels for the panel it drew — "Agent Prompt" and the token/cost readout — and neither is
     * true of this column: Design's left column holds the ingest's component tree, not a prompt,
     * and there is no spend to report. The rail draws no text at all while they are empty
     * (prompt-container skips an empty label), so nothing here says something untrue. The
     * text these should carry is the owner's to put there, and the props are how he would.
     */
    formatLabel: { type: String, attribute: 'format-label' },
    tokensLabel: { type: String, attribute: 'tokens-label' },
  };

  declare formatLabel: string;
  declare tokensLabel: string;

  constructor() {
    super();
    this.formatLabel = '';
    this.tokensLabel = '';
  }

  render() {
    return html`
      <prompt-container
        format-label=${this.formatLabel}
        tokens-label=${this.tokensLabel}
      ><div class="hole"><slot name="left"></slot></div></prompt-container>
    `;
  }

  static styles = [
    /*
     * THE APP'S OWN SHEET, ADOPTED HERE — the mechanism that gives the injected tool its look
     * back, and the reason the content is MOUNTED rather than slotted. See
     * `@/shared/app-stylesheet.ts` for the measurement and the reasoning; in one line: a document
     * stylesheet cannot match anything inside a shadow tree, so the container that hosts the tool
     * has to carry the sheet itself, and content can only be reached by it from inside that tree.
     *
     * IT COMES FIRST so the frame's own rules below win where they speak to the same box.
     */
    appStylesheet,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */

      :host {
        /* THE PANE IS A FLEX CONTAINER, so display:block alone is not enough: a flex child with
           no flex-basis and no width is sized to its CONTENT, and this element's content is a hole
           that has not been laid out yet — the same measurement that put design-middle-container at
           0 wide inside a pane that had a width (2026-09-30: drawn at x=643, width 0). width: 100%
           keeps it right in a block parent too, where flex is ignored. */
        flex: 1 1 auto;
        width: 100%;
        height: 100%;
        min-width: 0;
        min-height: 0;
        /* THE FRAME FILLS THE PANE. <prompt-container> carries its own flex: 1 1 auto on its host,
           and as a flex child that only matters once this host is a flex column — which is what
           makes the panel snap to the bottom edge in the Composer. */
        display: flex;
        flex-direction: column;
      }
      /*
       * THE HOLE IS A BOX, AND IT HAS TO BE. THE MEASUREMENT THAT PUT IT HERE (2026-09-30, the
       * running room): the rail was drawn 1545px tall inside a panel body 617px tall, so the rail's
       * own overflow-y never engaged — a rail taller than its frame scrolls the FRAME out of the
       * column instead of scrolling the rail inside it, which is the same fault the owner saw as
       * "it is loading underneath the container".
       *
       * A percentage height on the content is not enough to fix that, because a percentage resolves
       * against the containing block and a block-level parent sizes to its CONTENT. So the hole is
       * a flex column with a height taken from the panel body it fills, and the content is its flex
       * item: a definite height to scroll inside, whatever the content costs. min-height: 0 is the
       * half that lets a flex item be smaller than its content — without it the item grows to fit
       * and this element is back where it started.
       */
      .hole {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        min-width: 0;
        overflow: hidden;
      }
      /*
       * WHAT THE SLOT PROJECTS, AND THE ONE THING THE FRAME MUST NOT DO TO IT.
       *
       * A projected child of the envelope is a catalogue element, and a catalogue element carries
       * its own styles inside its own shadow root — so unlike the React tool that used to be loaded
       * here, it needs nothing from this document and arrives fully dressed. What it CANNOT know is
       * its own box: it is a light child of this panel, and only the panel knows the height the
       * frame's body gives it. So the box is stated here — and only min-width/min-height, the half
       * that lets an item be SMALLER than its content (without them a child grows to fit and the
       * FRAME scrolls out of the column instead, which the owner saw as "it is loading underneath
       * the container", measured 2026-09-30).
       *
       * NO flex ON A CHILD HERE, AND THAT IS A MEASURED CORRECTION (2026-09-30). This rule used to
       * stretch every child (flex: 1 1 auto on every slot child), which was right while the column
       * held ONE thing. The ingestion rail is TWO — the form over the tree — and stretching both
       * gave each half an equal box: the form is taller than half the column, so its lower field was
       * drawn over the tree while the tree's own header was clipped. The owner, looking at exactly
       * that: *"Form is covered."* Each half now states its own flex: the form is a fixed block that
       * never stretches, the tree takes what is left and scrolls inside it. The frame gives neither
       * one anything but permission to be small — and the ORDER is the slot's, which is the form
       * first, then the tree.
       */
      ::slotted(*) {
        min-height: 0;
        min-width: 0;
      }
      /*
       * THE TREE IS THE HALF THAT FILLS. The figma-layers-view element is the ingest's own, reused
       * unchanged and NOT restyled — so its flex is stated here, by name, because the alternative
       * would be editing that element, and reusing it means not touching it. It is the rail's
       * bottom half: it takes the height the form leaves and scrolls inside it, exactly as it does
       * in the ingest form's own left column. This is the only place the panel names a child, and
       * it names it for the one thing a frame owns — the box, not the drawing.
       */
      ::slotted(figma-layers-view) {
        flex: 1 1 auto;
      }
    `,
  ];
}

if (!customElements.get('design-left-panel')) {
  customElements.define('design-left-panel', DesignLeftPanel);
}

declare global {
  interface HTMLElementTagNameMap {
    'design-left-panel': DesignLeftPanel;
  }
}
