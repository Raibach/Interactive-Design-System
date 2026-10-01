/**
 * <figma-ingest-form> — the ingest rail's TOP HALF, as a catalogue element: the Figma URL field,
 * the Notes field and Submit.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A NEW DESIGN. The ingestion application is the TEMPLATE: its
 * left column is the Figma URL and the Notes over the catalogue tree, and the room's left column
 * is meant to hold that column. The tree half is `figma-layers-view` — the ingest's own element,
 * reused. The half above it is a FORM, and a form was the one thing the catalogue had no element
 * for: `prompt-textarea` is the composer's own section field, `role-dropdown` and
 * `model-selector-button` take no text. So the input the owner asked for twice —
 * *"where is the Figma input? … why would you leave out the most important part"* — could not be
 * named by any surface until something drew it, and this is that something. It is a TRANSLATION:
 * the same two fields, the same words, the same call, expressed as a catalogue element bound to
 * the surface instead of a React input inside a modal.
 *
 * IT DRAWS THE FORM AND NOTHING ELSE. It fetches nothing, parses nothing and ingests nothing. On
 * Submit it dispatches ONE event with what was typed, and the shell runs the ingest — the same
 * `POST /api/figma/ingest` the modal runs, with the same `{jobId, fileKey, nodeId, notes, …}`
 * body, because the parsing (`@/utils/figmaUrl`) and the endpoint both already exist and neither
 * is reimplemented here. A view that fetched would be a second implementation of the ingest; a
 * form that dispatched is the first half of the one that exists.
 *
 * THE EVENT, AND WHO ANSWERS IT. `ingest-submit`, composed and bubbling, detail `{ url, notes }` —
 * the raw text, exactly as typed, because deciding what a typed string means (a node tag, a layer
 * name, a URL) is the ingest's own logic (`IngestModal.handleIngest`) and not this element's.
 * The shell listens for it and calls the endpoint. Until the shell answers, Submit is a button
 * that reports the truth on the console rather than a button that lies.
 *
 * `busy` IS THE HOST'S, NOT OURS. While an ingest is in flight the host sets it: the fields lock
 * and Submit reads "Ingesting…". The element never decides that an ingest is running, because only
 * the caller that made the call knows when it finished.
 */
import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

export class FigmaIngestForm extends LitElement {
  static properties = {
    /** Prefilled URL, when the host has one. The field stays editable either way. */
    url: { type: String },
    /** Prefilled notes. */
    notes: { type: String },
    /** True while an ingest is in flight; set by the host that made the call. */
    busy: { type: Boolean },
    /** A message to draw under the fields — a refusal, or why Submit is blocked. */
    message: { type: String },
  };

  declare url: string;
  declare notes: string;
  declare busy: boolean;
  declare message: string;

  constructor() {
    super();
    this.url = '';
    this.notes = '';
    this.busy = false;
    this.message = '';
  }

  static styles = [
    designTokens,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */
      :host {
        display: block;
        /*
         * A FIXED BLOCK AT THE TOP OF THE RAIL, and this line is load-bearing. The column is a flex
         * column holding the form over the tree, and the frame deliberately sets no flex on its
         * children (see design-left-panel): each half states its own. This one is as tall as its
         * fields and NEVER TALLER (flex: 0 0 auto) because a form stretched to fill half the
         * column would push its own Notes field past its box and draw it over the tree, which is
         * exactly what happened when the frame stretched both halves (owner, on screen:
         * *"Form is covered."*). The tree below is the half that grows.
         */
        flex: 0 0 auto;
      }
      /* THE RAIL'S OWN BLOCK: a column with the two fields and the button, the way the ingest
         form stacks them. Nothing here restyles the field treatment — it is this catalogue's. */
      form {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 4px 12px 12px;
      }
      label {
        display: block;
        font-size: var(--ds-fs-sm);
        font-weight: var(--ds-weight);
        color: var(--ds-text-strong);
        margin-bottom: 4px;
      }
      .row { display: flex; gap: 8px; align-items: flex-start; }
      input {
        flex: 1 1 auto;
        min-width: 0;
        box-sizing: border-box;
        padding: 7px 10px;
        border: 1px solid var(--ds-rule);
        border-radius: var(--ds-radius);
        background: #fff;
        color: var(--ds-text);
        font: inherit;
        font-size: var(--ds-fs-sm);
      }
      input::placeholder { color: var(--ds-muted); }
      input:focus-visible { outline: 2px solid var(--ds-navy); outline-offset: -1px; }
      input:disabled { background: var(--ds-grey-tint); }
      button {
        flex: 0 0 auto;
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
      button:disabled { opacity: 0.4; cursor: not-allowed; }
      button:not(:disabled):hover { background: var(--ds-text-strong); }
      .message { margin: 0; font-size: var(--ds-fs-meta); color: var(--ds-amber); }
    `,
  ];

  private _onSubmit(e: Event) {
    e.preventDefault();
    const url = this.url.trim();
    if (!url || this.busy) return;
    /*
     * THE RAW TEXT GOES OUT, AND NOTHING IS DECIDED HERE. The field accepts a Figma URL, a node
     * tag (`f-1234-5678`) or a layer's name, and which of the three this is belongs to the ingest
     * — `handleIngest` is the one place that knows, and it is answered by the shell.
     */
    this.dispatchEvent(
      new CustomEvent('ingest-submit', {
        bubbles: true,
        composed: true,
        detail: { url, notes: this.notes.trim() },
      }),
    );
  }

  render() {
    return html`
      <!--
        NOVALIDATE, AND IT IS LOAD-BEARING (measured 2026-09-30). The URL field is type="url", so
        the BROWSER validates it on submit — and a value that is not a URL BLOCKS the submission
        before any handler runs. In a shadow root the validation bubble cannot be drawn either, so
        the whole thing fails in silence: measured in the running room, clicking Submit fired no
        submit event at all, the button simply did nothing, and the owner reported exactly that
        ("ingestion does not work"). The ingest's own logic is the validator here — the typed string
        may be a Figma link, a node tag or a layer's name, and the shell answers with a message —
        so the browser is told not to pre-empt it. The field keeps type="url" for the keyboard it
        brings up; it just no longer vetoes.
      -->
      <form novalidate @submit=${this._onSubmit}>
        <div>
          <label for="figma-url">Figma URL</label>
          <div class="row">
            <input
              id="figma-url"
              type="url"
              placeholder="https://www.figma.com/file/FILE_KEY/NAME?node-id=NODE_ID"
              .value=${this.url}
              ?disabled=${this.busy}
              @input=${(e: Event) => { this.url = (e.target as HTMLInputElement).value; }}
            />
            <button type="submit" ?disabled=${this.busy || !this.url.trim()}>
              ${this.busy ? 'Ingesting…' : 'Submit'}
            </button>
          </div>
        </div>
        <div>
          <input
            type="text"
            placeholder="Notes (optional)"
            .value=${this.notes}
            ?disabled=${this.busy}
            @input=${(e: Event) => { this.notes = (e.target as HTMLInputElement).value; }}
          />
        </div>
        ${this.message ? html`<p class="message">${this.message}</p>` : nothing}
      </form>
    `;
  }
}

if (!customElements.get('figma-ingest-form')) customElements.define('figma-ingest-form', FigmaIngestForm);

declare global {
  interface HTMLElementTagNameMap {
    'figma-ingest-form': FigmaIngestForm;
  }
}
