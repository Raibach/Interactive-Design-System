/**
 * <design-system-picker> — the Product room's context strip: WHICH DESIGN SYSTEM this
 * package's stage draws from.
 *
 * WHAT IT IS. One compact row at the top of her panel (the seat's own view slot): the
 * catalogues that exist — the server hands the list from the directory, so a partition that
 * does not exist cannot be offered — and the one this package chose. Choosing DISPATCHES
 * `design-system-chosen` and writes nothing: the host is the single writer (it persists
 * `metadata.design_system`, the key `design_system_of` reads) and re-assembles the room,
 * which re-hands the stage its `system` and its `palette` — the two values that live outside
 * the tree.
 *
 * NO FALLBACKS. With no list (a failed read, said by the server) it SAYS so instead of
 * drawing an empty select; with a package that never chose, it says none is chosen yet — the
 * same absent-is-a-real-answer the metadata itself carries. The room has no menus; this is
 * context, not a menu — one row that names the catalogue the stage is speaking.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

export interface CatalogueOption {
  system: string;
  count?: number | null;
}

export class DesignSystemPicker extends LitElement {
  static properties = {
    /** The partitions that exist, from the server: one {system, count} per catalogue. */
    catalogues: { type: Array, attribute: false },
    /** The one this package chose ('' = never chose — a real answer). */
    selected: { type: String, attribute: 'selected', reflect: true },
  };

  declare catalogues: CatalogueOption[];
  declare selected: string;

  constructor() {
    super();
    this.catalogues = [];
    this.selected = '';
  }

  private _choose = (e: Event): void => {
    const system = (e.target as HTMLSelectElement).value;
    if (!system || system === this.selected) return;
    this.dispatchEvent(new CustomEvent('design-system-chosen', {
      bubbles: true, composed: true, detail: { system },
    }));
  };

  render() {
    const hasList = Array.isArray(this.catalogues) && this.catalogues.length > 0;
    return html`
      <div class="strip" role="group" aria-label="Design system">
        <span class="label">Design system</span>
        ${hasList
          ? html`
              <select class="pick" @change=${this._choose} aria-label="The catalogue this stage draws from">
                <option value="" ?selected=${!this.selected}>None chosen yet</option>
                ${this.catalogues.map((c) => html`
                  <option value=${c.system} ?selected=${c.system === this.selected}>
                    ${c.system}${typeof c.count === 'number' ? ` (${c.count})` : ''}
                  </option>
                `)}
              </select>`
          : html`<span class="quiet">The catalogue list could not be read.</span>`}
        ${this.selected
          ? nothing
          : html`<span class="quiet">The stage draws from the app's own tables until one is chosen.</span>`}
      </div>
    `;
  }

  static styles = [
    designTokens,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */
      :host { display: block; }
      .strip {
        display: flex; align-items: center; gap: 8px;
        padding: 8px 12px;
        font-family: 'Inter', system-ui, sans-serif; font-size: 12px;
        border-bottom: 1px solid var(--ds-rule);
        background: var(--ds-surface);
      }
      .label { color: var(--ds-muted); white-space: nowrap; }
      .pick {
        flex: 1; min-width: 0;
        font: inherit; color: var(--ds-ink, #234354);
        background: var(--ds-surface);
        border: 1px solid var(--ds-rule); border-radius: var(--ds-radius);
        padding: 3px 6px;
      }
      .quiet { color: var(--ds-muted); font-size: 11px; }
    `,
  ];
}

if (!customElements.get('design-system-picker')) customElements.define('design-system-picker', DesignSystemPicker);

declare global {
  interface HTMLElementTagNameMap {
    'design-system-picker': DesignSystemPicker;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'design-system-picker': React.DetailedHTMLProps<
        React.HTMLAttributes<DesignSystemPicker> & { ref?: React.Ref<DesignSystemPicker> },
        DesignSystemPicker
      >;
    }
  }
}
