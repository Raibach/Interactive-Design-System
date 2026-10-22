/**
 * <tools-tab> — THE TOOLS TAB AS ITS OWN FILE (owner, 2026-10-18).
 *
 * The directive, verbatim: *"You cannot repurpose pieces. You're going to have to build new ones.
 * You're going to have to build new TS files. You're gonna have to load the same components from
 * the catalogue in different TS files."*
 *
 * So nothing is lifted out of `chat-panel.ts` and nothing is reparented out of the design surface.
 * This is a NEW element that loads the SAME two catalogue components the tool has always used —
 * `figma-ingest-form` over `figma-layers-view` — by importing their own modules, which is what
 * registers them. The components are not edited, not copied, and not re-implemented here.
 *
 * WHOSE DATA IT READS: the same data the room already assembles. `pipeline` names the ingest
 * pipeline the tree draws, `refresh` re-reads it, `selected`/`open` mirror the room's selection.
 * The host passes those in; this element owns no fetching of its own, so there is exactly one
 * reader for that data — the host it belongs to.
 */
import { LitElement, html, css } from 'lit';

/* Importing the component modules is what registers them as custom elements. No code is taken
   from them; the import is the whole contract, exactly as the catalogue does it. */
import '../components/lit/figma-ingest-form';
import '../components/lit/figma-layers-view';

export class ToolsTab extends LitElement {
  static properties = {
    /** The ingest pipeline / catalogue the layers tree draws (as the room passes it). */
    pipeline: { type: String },
    /** The node the tree should focus, when the host has one. */
    nodeId: { type: String },
    /** Bumped by the host after an ingest so the tree re-reads the catalogue. */
    refresh: { type: Number },
    /** True while an ingest is in flight — the form's own busy state, passed through. */
    busy: { type: Boolean },
    /** The refusal the host's call returned, in the host's words. */
    message: { type: String },
    /** The tree's selected row, when the host holds one. */
    selected: { type: String },
    /** Draw the tree without its own head, for a tab that supplies the heading. */
    inline: { type: Boolean },
  };

  declare pipeline: string;
  declare nodeId: string;
  declare refresh: number;
  declare busy: boolean;
  declare message: string;
  declare selected: string;
  declare inline: boolean;

  constructor() {
    super();
    this.pipeline = '';
    this.nodeId = '';
    this.refresh = 0;
    this.busy = false;
    this.message = '';
    this.selected = '';
    this.inline = false;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      width: 100%;
      overflow: hidden;
    }
    figma-ingest-form {
      flex: 0 0 auto;
    }
    figma-layers-view {
      flex: 1 1 0%;
      min-height: 0;
    }
  `;

  render() {
    return html`
      <figma-ingest-form .busy=${this.busy} .message=${this.message}></figma-ingest-form>
      <figma-layers-view
        .pipeline=${this.pipeline}
        .nodeId=${this.nodeId}
        .refresh=${this.refresh}
        .selected=${this.selected}
        .inline=${this.inline}
      ></figma-layers-view>
    `;
  }
}

if (!customElements.get('tools-tab')) customElements.define('tools-tab', ToolsTab);

declare global {
  interface HTMLElementTagNameMap {
    'tools-tab': ToolsTab;
  }
}
