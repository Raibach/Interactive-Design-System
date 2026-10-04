/**
 * <catalog-ingest-form> — ADD DESIGN SYSTEM: a zip becomes a walled-off catalogue partition.
 *
 * IT DRAWS THE FORM AND NOTHING ELSE. It fetches nothing, unzips nothing, writes nothing. On Submit
 * it dispatches ONE event with what was chosen, and THE SHELL runs the ingest — the same
 * `POST /api/catalog/ingest` and the same body shape — the contract `<figma-ingest-form>` states one
 * field over: a view that fetched would be a second implementation of the ingest, and a form that
 * dispatches is the first half of the one that exists.
 *
 * WHAT IT SAYS OUT LOUD, because both are refusals the server WILL make and a person should not meet
 * them by being refused:
 *   · THE MANIFEST IS THE AUTHORITY. The zip carries `system.json` with the system's own label; the
 *     field here may be left empty to use it, or must MATCH it — a disagreement is refused (409)
 *     naming both, because two authorities on one name is how a catalogue gets titled one thing and
 *     referenced as another.
 *   · CREATING A NEW SYSTEM IS THE ACTION. An id that already exists is refused (409), and the
 *     system catalogues — the composer's and the design room's — are not ingest targets at all: no
 *     field here can name them, and nothing in this form writes into a catalogue that is there.
 *
 * `busy` and `message` are the HOST'S: it is the caller that learns what the server said, so only
 * it can say it. Same two props the Figma form takes, for the same reason.
 */
import { LitElement, html, css } from 'lit';
import { designTokens } from '@/shared/design-tokens';
import { DEMO_DISABLED_SENTENCE, isDemoMode } from '@/shared/appConfig';

export class CatalogIngestForm extends LitElement {
  static properties = {
    /** The label the person typed. Empty means "use the manifest's own label". */
    label: { type: String },
    /** True while the ingest is in flight; set by the host that made the call. */
    busy: { type: Boolean },
    /** What the server answered — the created id, or the refusal VERBATIM. Host-set. */
    message: { type: String },
  };

  declare label: string;
  declare busy: boolean;
  declare message: string;

  /** The chosen archive. Not a property: it belongs to this form until Submit hands it over. */
  private _file: File | null = null;

  constructor() {
    super();
    this.label = '';
    this.busy = false;
    this.message = '';
  }

  private _onFile = (e: Event): void => {
    const input = e.target as HTMLInputElement;
    this._file = input.files && input.files[0] ? input.files[0] : null;
    this.requestUpdate();
  };

  private _onSubmit = (e: Event): void => {
    e.preventDefault();
    if (this.busy || !this._file) return;
    // Never dispatch what the demo will refuse — the shell would post a 403.
    if (isDemoMode()) {
      this.message = DEMO_DISABLED_SENTENCE;
      return;
    }
    // ONE EVENT, WHAT WAS CHOSEN, NOTHING ELSE — the shell decides what a zip means.
    this.dispatchEvent(new CustomEvent('catalog-ingest-submit', {
      bubbles: true,
      composed: true,
      detail: { label: this.label.trim(), file: this._file },
    }));
  };

  render() {
    // THE DEMO INSTALLS NOTHING. /api/catalog/ingest writes a partition into the
    // running app's own vocabulary and the demo refuses it (demo_policy.py), so the
    // form is not drawn — a paragraph saying so takes its place.
    if (isDemoMode()) {
      return html`<p class="note">Installing a design system is disabled in the demo — nothing
        was changed.</p>`;
    }
    return html`
      <form @submit=${this._onSubmit}>
        <label for="system-label">Design system label</label>
        <input
          id="system-label"
          type="text"
          placeholder="Carbon"
          .value=${this.label}
          ?disabled=${this.busy}
          @input=${(e: Event) => { this.label = (e.target as HTMLInputElement).value; }}
        />
        <label for="system-zip">The packaged system (.zip)</label>
        <input
          id="system-zip"
          type="file"
          accept=".zip,application/zip"
          ?disabled=${this.busy}
          @change=${this._onFile}
        />
        <button type="submit" ?disabled=${this.busy || !this._file}>
          ${this.busy ? 'Ingesting…' : 'Add design system'}
        </button>
        ${this.message ? html`<p class="message" role="status">${this.message}</p>` : null}
        <p class="note">
          The archive carries <code>system.json</code> and <code>components.json</code>. The
          manifest's own label wins: leave the field empty, or type the same one — a disagreement is
          refused, naming both. Every component lands PROPOSED (<code>draft: false</code>) until a
          person accepts it, and an existing catalogue is never written into — creating a new one is
          the action.
        </p>
      </form>
    `;
  }

  static styles = [
    designTokens,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */

      /* A FIXED BLOCK IN THE RAIL, like the Figma form above it: as tall as its fields and never
         taller, because the tree below is the half that grows (the same line that form carries). */
      :host { display: block; flex: 0 0 auto; }
      form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 4px 12px 12px;
        margin: 10px 0 10px;
      }
      label {
        display: block;
        font-size: var(--ds-fs-sm);
        font-weight: var(--ds-weight);
        color: var(--ds-text-strong);
        margin-bottom: 4px;
      }
      input {
        box-sizing: border-box;
        width: 100%;
        padding: 7px 10px;
        border: 1px solid var(--ds-muted);
        border-radius: var(--ds-radius);
        background: #fff;
        color: var(--ds-text);
        font: inherit;
        font-size: var(--ds-fs-sm);
      }
      input::placeholder { color: var(--ds-muted); }
      input:focus-visible { outline: 2px solid var(--ds-navy); outline-offset: -1px; }
      input:disabled { background: var(--ds-grey-tint); }
      input[type='file'] { padding: 5px; }
      button {
        align-self: flex-start;
        padding: 7px 16px;
        border: none;
        border-radius: var(--ds-radius);
        background: var(--ds-navy);
        color: #fff;
        font: inherit;
        font-size: var(--ds-fs-sm);
        font-weight: var(--ds-weight);
        cursor: pointer;
      }
      button:disabled { opacity: 0.5; cursor: default; }
      .message {
        margin: 0;
        font-size: var(--ds-fs-sm);
        color: var(--ds-text);
      }
      .note {
        margin: 0;
        font-size: var(--ds-fs-xs);
        color: var(--ds-muted);
        line-height: 1.4;
      }
      code {
        font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 0.95em;
      }
    `,
  ];
}

if (!customElements.get('catalog-ingest-form')) customElements.define('catalog-ingest-form', CatalogIngestForm);

declare global {
  interface HTMLElementTagNameMap {
    'catalog-ingest-form': CatalogIngestForm;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'catalog-ingest-form': React.DetailedHTMLProps<
        React.HTMLAttributes<CatalogIngestForm> & { ref?: React.Ref<CatalogIngestForm> },
        CatalogIngestForm
      >;
    }
  }
}
