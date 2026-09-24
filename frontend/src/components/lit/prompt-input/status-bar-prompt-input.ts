/**
 * <status-bar-prompt-input> — Figma 40000746-94 / status-bar-prompt-input
 * 40px-wide vertical activity rail. Database_fill icons (40×27.5 cell,
 * 22×27.5 glyph) stacked with 12px gaps, first icon 10px from the top.
 * The rail grows as activity happens inside the prompt (designer's rule).
 *
 * It is also the prompt's NOTIFICATION column (owner's rule): a section that is
 * waiting on a person carries an `alert` cell — an exclamation in a circle, in
 * the flag's red — beneath the activity glyph. That cell is the one kind with no
 * Figma node behind it, and so the one kind that deliberately carries no
 * data-node-id (see NODE_OF_ICON).
 *
 * Property: icons — ordered list of rail kinds, e.g. ['database', 'database'],
 *           or ['lightning', 'alert'] while the prompt needs the person.
 */
import { LitElement, html, css, nothing } from 'lit';
import { databaseFillSvg, lightningAltFillLightSvg, lightningAltFillLight1Svg, alertCircleSvg } from './prompt-icons';

export class StatusBarPromptInput extends LitElement {
  static properties = { icons: { type: Array } };
  declare icons: string[];

  /** The rail's own Figma node — "status-bar-prompt-input" (registry.json). */
  static readonly NODE_ID = '40000878:239';

  /**
   * Figma node per activity kind. The design draws TWO cells in this rail:
   * Database_fill (40000746:98) and Subtract (40000746:99 — the lightning glyph).
   * Both lightning variants draw that same node's artwork.
   *
   * `alert` is deliberately NOT in this map: no such node exists in the file, and
   * an id for a node that is not there would be an invention wearing the
   * traceability the rest of the rail earns. The render falls through to no
   * attribute at all, which is what the test pins.
   */
  static readonly NODE_OF_ICON: Record<string, string> = {
    database: '40000746:98',
    lightning: '40000746:99',
    lightning1: '40000746:99',
    /*
     * THE RAIL'S ACTIVITY MAP — one cell per thing the row actually holds.
     *
     * The owner, 2026-09-24: "It's like a visual map of the activity on that left rail. It's very
     * high-level… just a quick icon, and they'll begin to associate the trigger with the icon."
     *
     * `trigger` and `tool` are the two attachments a row can carry (see shared/triggers.ts and the
     * seat's Functions | Tools menu). Both draw the same Figma node's artwork for now — 40000746:99,
     * the lightning this rail has always used — with the trigger taking the outlined variant so the
     * two read apart at a glance. THE TRIGGER'S OWN ICON IS THE OWNER'S TO DRAW: when it arrives it
     * is one more entry in prompt-icons.ts and, if it is a new Figma node, one id added here.
     * Nothing else in this element or in the row changes to carry it.
     */
    trigger: '40000746:99',
    tool: '40000746:99',
  };

  constructor() {
    super();
    this.icons = [];
  }

  connectedCallback() {
    super.connectedCallback();
    // The rail's own node id rides on the host: the host IS the drawn rail, so
    // this is the node → element mapping, not decoration. Without it the one
    // component in the rail carries no traceable node reference at all.
    if (!this.hasAttribute('data-node-id')) this.setAttribute('data-node-id', StatusBarPromptInput.NODE_ID);
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      width: 40px;
      flex-shrink: 0;
      padding-top: 10px;
      gap: 12px;
      box-sizing: border-box;
    }
    .icon-cell {
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #ffffff;
    }
    /*
     * THE TRIGGER'S PLACEHOLDER MARK — the same lightning, in the one colour this rail does not
     * otherwise use: the gradient bolt's own #7E72E3 (Figma 40000922-4822). The owner, 2026-09-24:
     * "you can use a fake, made up — reuse the lightning and just change the colour… I understand
     * these are fillers or placeholders."
     *
     * So a row that starts itself carries a violet bolt and a row that merely calls a tool carries
     * the dark one, which is enough to read apart at a glance until his own icon arrives. A CSS
     * rule, not a second SVG: the artwork is already in the file and only its stroke changes —
     * and a CSS declaration beats the presentation attribute the outlined bolt carries, so no
     * important flag is needed.
     */
    :host [data-icon-kind='trigger'] svg path { stroke: #7e72e3; }
  `;

  render() {
    return html`${this.icons.map((kind) => {
      // `alert` is a status, not an activity: the tooltip says what it means
      // (`needs your input`) because, unlike the other cells, there is no node id
      // to look it up by. The kinds' glyphs are picked here rather than in a map
      // so an unknown kind renders an empty cell instead of throwing.
      /*
       * THE TITLE SAYS WHAT THE ICON MEANS, because the map is learned by association — a person
       * who hovers the second cell should be told "what starts this row", not "trigger activity".
       * The two attachments read as sentences; the design's own `database` and `lightning` keep
       * their old wording, and `alert` keeps the one it had.
       */
      const title =
        kind === 'alert' ? 'needs your input'
          : kind === 'trigger' ? 'what starts this row'
            : kind === 'tool' ? 'a tool this row may use'
              : `${kind} activity`;
      const glyph =
        kind === 'alert' ? alertCircleSvg
          : kind === 'database' ? databaseFillSvg
            // The trigger takes the OUTLINED bolt and a tool the solid one, so a row that starts
            // itself does not look like a row that merely calls something.
            : kind === 'trigger' ? lightningAltFillLight1Svg
              : kind === 'tool' ? lightningAltFillLightSvg
                : kind === 'lightning1' ? lightningAltFillLight1Svg
                  : kind === 'lightning' ? lightningAltFillLightSvg
                    : '';
      return html`
        <span class="icon-cell" title=${title} data-icon-kind=${kind}
              data-node-id=${StatusBarPromptInput.NODE_OF_ICON[kind] ?? nothing}>
          ${glyph}
        </span>`;
    })}`;
  }
}

if (!customElements.get('status-bar-prompt-input')) {
  customElements.define('status-bar-prompt-input', StatusBarPromptInput);
}

declare global {
  interface HTMLElementTagNameMap {
    'status-bar-prompt-input': StatusBarPromptInput;
  }
}
