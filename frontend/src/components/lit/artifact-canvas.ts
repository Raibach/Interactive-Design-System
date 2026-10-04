/**
 * <artifact-canvas> — THE STAGE, IN THE ARTIFACT ERA (2026-10-03, late).
 *
 * THE OWNER'S SENTENCE IS THE WHOLE SPEC: *"I just wanna be able to ask the model to build a
 * webpage or wireframe or whatever and she will just start doing it."* The page Grace builds is
 * a real HTML document (POST /api/ai/build-artifact); this element is only the WINDOW onto it —
 * a sandboxed iframe that cannot run a line of anything (`sandbox` with no allow-scripts and no
 * allow-same-origin), so the model's document is displayed AS a document and never as code with
 * privileges. Scripts are dead by construction, not by trust.
 *
 * A VIEW, ONE PROPERTY: `artifact` — the document string, or null/empty for nothing built yet.
 * THE EMPTY STAGE IS SILENT (owner, 2026-10-03, on the canned copy that stood here: *"Why do you
 * have that in a canvas with a chat room open on the right hand side? Can she not speak?"*):
 * a blank stage draws NOTHING — no prompt, no instruction, no apology. The room talks; the
 * stage is the window, and a window with nothing behind it says nothing.
 * No fetch, no store: THE SANDBOX IS IN-SESSION (owner, 2026-10-03: nothing needs to reach the
 * database until the person is finished), so the host holds the page and writes this prop on
 * every build.
 *
 * THE RAIL keeps ONE control: "✕ Clear" while a page stands — a press announces
 * `artifact-cleared`, carrying nothing, and the HOST empties the sandbox (one fact, both hands:
 * the spoken "clear the stage" empties it through the same build route — an empty artifact).
 * With nothing built the button is not drawn: a control that cannot work is not drawn.
 *
 * NOT the node canvas: <draft-canvas> draws an assembled layout of catalogue components and
 * keeps its gestures and its tray in the Composer. This draws ONE PAGE, freely written; the
 * node-era stage is parked, unwired, until the owner says otherwise.
 */

import { LitElement, html, css, nothing } from 'lit';
import { designTokens } from '@/shared/design-tokens';

export class ArtifactCanvas extends LitElement {
  static properties = {
    /** The page Grace built — a full HTML document, or null/'' for nothing yet. */
    artifact: { type: String, attribute: false },
  };

  declare artifact: string | null;

  /** THE RAIL'S ACT — announces; the host writes the empty page (see the file note). */
  private _clear = (e: Event): void => {
    e.stopPropagation();
    this.dispatchEvent(new CustomEvent('artifact-cleared', { bubbles: true, composed: true }));
  };

  render() {
    const doc = (this.artifact ?? '').trim();
    return html`
      <div class="stage" role="region" aria-label="Built page">
        ${doc
          ? html`<iframe
              class="frame"
              sandbox=""
              title="The page Grace built"
              .srcdoc=${doc}
            ></iframe>`
          : nothing}
        ${doc
          ? html`
              <div class="rail" @pointerdown=${(e: PointerEvent) => e.stopPropagation()}>
                <button class="rail-btn" type="button" title="Clear the stage" @click=${this._clear}>
                  ✕ Clear
                </button>
              </div>`
          : nothing}
      </div>
    `;
  }

  static styles = [
    designTokens,
    css`
      /* No backticks in this stylesheet: it is a tagged template literal, and one raw
         backtick ends it. tsc will not say so; esbuild will. */

      :host { display: block; position: relative; width: 100%; height: 100%; min-height: 0; }
      .stage { position: relative; width: 100%; height: 100%; overflow: hidden; }

      /* THE WINDOW: the built page, as a document — a page is white (the model's page may
         paint its own ground over this). pointer events stay inside the page's own world. */
      .frame {
        position: absolute; inset: 0;
        width: 100%; height: 100%;
        border: 0; background: #ffffff;
      }

      .empty {
        position: absolute; inset: 0;
        display: flex; align-items: center; justify-content: center;
        color: var(--ds-muted); font-size: var(--ds-fs-md);
        pointer-events: none;
      }

      /* THE RAIL — the one control this element adds, and it is drawn ONLY while a page
         stands (see the render). Colors carry fallbacks: the tokens this app defines are used
         where they exist, and nothing here invents a variable the theme may not hold. */
      .rail { position: absolute; top: 12px; left: 12px; z-index: 4; display: flex; gap: 8px; }
      .rail-btn {
        font-family: 'Inter', system-ui, sans-serif;
        font-size: 13px; font-weight: 600;
        color: var(--ds-ink, #234354); background: var(--ds-surface);
        border: 1px solid var(--ds-rule); border-radius: var(--ds-radius);
        padding: 6px 12px; cursor: pointer;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.10);
      }
      .rail-btn:hover { background: rgba(0, 0, 0, 0.04); }
    `,
  ];
}

if (!customElements.get('artifact-canvas')) customElements.define('artifact-canvas', ArtifactCanvas);

declare global {
  interface HTMLElementTagNameMap {
    'artifact-canvas': ArtifactCanvas;
  }
}
