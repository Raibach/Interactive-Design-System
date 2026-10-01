/**
 * <draft-preview> — the middle column's drawing of a DRAFT: the component an ingest just built,
 * loaded from the temporary file the backend wrote for it and from NOWHERE ELSE.
 *
 * WHY IT EXISTS. The room's preview drew THE CATALOGUE'S ELEMENT. On Submit the shell named the
 * draft's tag as the component to draw, and the renderer resolved that name through the catalogue —
 * so a re-ingest of a node the catalogue already holds (the ordinary case: the designer edited
 * Figma and submitted the same node again) drew the APPROVED component while the fresh draft sat
 * in the server untouched. The owner, 2026-09-30: *"when I go to preview a change, I'm not seeing a
 * change. I'm seeing the old lit component because it has the same name. It's just reloading it
 * from the lit catalog. I want to use the temporary folder."*
 *
 * THE TAG IS NOT AN ADDRESS. That is the whole defect in one line: a draft and an approved
 * component can share a name, so a client that is given the NAME has to guess which one is meant.
 * This element is given the FILE (`moduleUrl`, written by the ingest into `.preview/<jobId>/` and
 * carried on the ingest result — see `_preview_module` in backend/routes/figma.py), and it loads
 * exactly that. Nothing about the catalogue is read, asked for, or reached for by name: the element
 * tag below is the draft's own, taken verbatim, and the module is the one the server named.
 *
 * THE BLINDNESS IS STRUCTURAL, NOT A PROMISE. The sandboxed document is the mechanism: the same
 * document, byte for byte, that the ingest form's Preview pane builds (IngestModal.tsx) — the same
 * CSP, the same import map, the same one attempt at the same single module. The CSP is what makes a
 * preview unable to impersonate the catalogue: `img-src data: blob:` means an image can only be
 * bytes the ingest put in the draft (never `/assets/…`, never a path that shares a name with
 * something the repository holds), and `connect-src 'none'` means the document cannot fetch the
 * catalogue, the manifest, the record or the backend. `script-src` keeps the origin because the
 * component is written in Lit and the runtime is the framework, not the catalogue — a preview that
 * cannot load Lit draws nothing at all.
 *
 * IT DRAWS AND DECIDES NOTHING ELSE. No facts, no actions, no fetching: the identity and the two
 * buttons belong to `<component-preview>`, which is the frame this sits inside, and the state
 * arrives from the data model (`/session/preview/draft`) written by the shell from the answer the
 * ingest already returned. A second reader of the ingest here would be a second answer.
 *
 * THE DOCUMENT IS A PURE FUNCTION OF WHAT IS LOADED. The same draft produces the same string, and
 * Lit skips an attribute binding whose value is unchanged — so a later re-render of this element
 * (an approve, a note that changed) does NOT reload the frame, and what the designer is looking at
 * stays the thing they were looking at. A reload would also be a second chance to see something
 * other than the draft.
 */
import { LitElement, html, css } from 'lit';

/** The draft's identity, as the ingest result carries it and the shell writes it to the model. */
export interface DraftPreviewState {
  /** The job that built it. */
  jobId?: string;
  /** The tag the draft defines, e.g. f-40001207-3497 — used VERBATIM: it is the element's own tag. */
  tag?: string;
  /** The temporary file under PREVIEW_DIR that the backend wrote for this preview. */
  modulePath?: string;
  /** That same file, as the dev server serves it. This is what the document loads. */
  moduleUrl?: string;
}

/** A custom-element name: lowercase, with a hyphen. `f-40001207-3497` is one; `AgentFlow` is not. */
const ELEMENT_TAG_RE = /^[a-z][a-z0-9]*-[a-z0-9-]*$/;

/**
 * THE DOCUMENT. The ingest form's own preview document, and its comments are the reasons for every
 * line of it — see `previewSrcDoc` in IngestModal.tsx. What is written here is not a second design:
 * it is the same document, so the two panes cannot drift into showing two different things.
 *
 * NOT RESPONSIVE, on purpose: the component is drawn at the size it was designed at (775px is
 * 775px) and the pane scrolls when that is bigger than the space. Scaling it to fit is what made it
 * tiny and half of it disappear under the other column.
 */
function draftDocument(draft: DraftPreviewState): string {
  const tag = String(draft.tag || '');
  const url = String(draft.moduleUrl || '');
  const file = String(draft.modulePath || '');
  return (
    '<!DOCTYPE html>' +
    '<html>' +
    '<head>' +
    '<meta charset="UTF-8">' +
    // ── THE PREVIEW CANNOT REACH AN IMAGE, AND CANNOT ASK ANYTHING ANYWHERE ──
    // The rule made structural rather than promised. See this file's head for what each directive
    // is doing here; this string is the manifest's own document, unchanged.
    '<meta http-equiv="Content-Security-Policy" content="' +
    "default-src 'none'; " +
    "script-src 'self' blob: 'unsafe-inline'; " +
    "style-src 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src https://fonts.gstatic.com; " +
    'img-src data: blob:; ' +
    "connect-src 'none'; " +
    "frame-src 'none'; " +
    "base-uri 'none'; " +
    "form-action 'none'" +
    '">' +
    // The app loads Inter at 500-700 only; a design's measured weight can be outside that (800 on
    // the first node tested), so the preview loads the whole range and the measured weight actually
    // renders instead of being synthesised.
    '<link rel="preconnect" href="https://fonts.googleapis.com">' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">' +
    // THE CODE IS DRAWN EXACTLY AS THE INGEST WROTE IT, bare import and all. A blob module has no
    // hierarchy, so a root-relative specifier inside it cannot resolve ("Invalid relative url or
    // base scheme isn't hierarchical" — the error that named this). An import map resolves against
    // THE DOCUMENT instead, which does have an origin, so `from 'lit'` works untouched.
    '<script type="importmap">' +
    JSON.stringify({ imports: { lit: new URL('/@id/lit', window.location.origin).href } }) +
    '</script>' +
    '<style>' +
    'html, body { margin: 0; }' +
    '*, *::before, *::after { box-sizing: border-box; }' +
    // A COLUMN SO THE CAPTION KEEPS THE TOP AND THE COMPONENT GETS THE REST — the component is
    // centred in what is left, so the line naming the file stays where a reader looks first.
    'body { min-height: 100vh; padding: 16px; background: #fafafa; font-family: Inter, system-ui, sans-serif; overflow: auto; display: flex; flex-direction: column; }' +
    // THE ELEMENT'S OWN BOX, MADE VISIBLE — an element with no content draws no border, no
    // background and nothing else, so a container being a container looks exactly like a preview
    // that failed. What you are seeing IS the element: its box, at its size, drawing nothing
    // inside. An outline says where it is (and costs no layout — outlines never do).
    //
    // AND IT IS CENTRED BY ITS OWN MARGIN (owner, 2026-09-30: *"center the component Vertically and
    // horizontally whenever it displays there"*). An auto margin is what centres it safely: a
    // component WIDER than the pane keeps its left edge reachable, because an auto margin resolves
    // to zero the moment there is no room, where `justify-content: center` would push half of it
    // out of reach. The size is untouched — this is still the component at the size the design
    // measured, not scaled to fit.
    'body > ' + tag + ' { margin: auto; outline: 1px dashed rgba(31,172,194,0.55); outline-offset: 4px; }' +
    '#preview-caption { font-family: ui-monospace, Menlo, monospace; font-size: 10px; color: #8a9499; margin-bottom: 8px; }' +
    '#preview-status { display: none; max-width: 520px; font-size: 13px; color: #b91c1c; font-family: ui-monospace, monospace; white-space: pre-wrap; text-align: left; }' +
    '</style>' +
    '</head>' +
    '<body>' +
    // ── WHICH FILE IS BEING DRAWN, SAID IN THE DRAWING ──────────────────────
    // The tag alone cannot tell the two same-named things apart — that is the whole defect — so the
    // caption names the TEMPORARY FILE this document loaded, which is evidence a reader can check
    // against the folder. Nothing here is a claim about the catalogue: this document cannot read it.
    '<div id="preview-caption">' +
    '&lt;' +
    tag +
    '&gt; — the element itself, at the size the design measured. What it draws is what the design ' +
    'contains: nothing is passed to it and nothing is substituted for it.' +
    (file ? '<br>drawn from ' + file + ' — the temporary file this ingest wrote. The catalogue is not read here; approving is what writes it.' : '') +
    '</div>' +
    // ── NOTHING IS HANDED TO THE ELEMENT ────────────────────────────────────
    // Instantiated bare. The element that only draws when it is given data draws nothing, and that
    // is the finding, not a fault to paper over with invented props. THE VALUES IT WILL BE GIVEN ARE
    // NOT HIDDEN BY THAT — they are listed in the panel beside this frame (`component-preview`, from
    // the database rows), so the designer sees what the design draws AND what the component will be
    // handed, and neither is faked into the other.
    '<' + tag + '></' + tag + '>' +
    '<div id="preview-status"></div>' +
    '<script type="module">' +
    "const status = document.getElementById('preview-status');" +
    'const load = async () => {' +
    // ── ONE ATTEMPT, AND THE FAILURE IS DRAWN ───────────────────────────────
    // The file is written before the pane can ask for it, so one attempt either loads it or says
    // what went wrong — in the pane, where the designer is looking.
    '  try {' +
    '    await import(' +
    JSON.stringify(url) +
    " + '?t=' + Date.now());" +
    '  } catch (err) {' +
    "    status.style.display = 'block';" +
    "    status.textContent = 'Could not load ' + " +
    JSON.stringify(url) +
    "      + ' — ' + (err && err.message ? err.message : err);" +
    '    return;' +
    '  }' +
    // ── IT LOADED, AND NOTHING IS DEFINED UNDER THAT TAG — SAID, NOT LEFT AS A BLANK BOX ───
    // The failure this catches is the quiet one: the import resolves (so the `catch` above never
    // runs), the pane draws nothing, and a component that draws nothing looks exactly like a
    // component that failed. The dashed outline and the caption cannot tell the two apart, so the
    // pane states which one it is. It substitutes nothing: the answer is the reason, in words.
    '  if (!customElements.get(' +
    JSON.stringify(tag) +
    ')) {' +
    "    status.style.display = 'block';" +
    "    status.textContent = 'Loaded ' + " +
    JSON.stringify(url) +
    " + ' and nothing defined <' + " +
    JSON.stringify(tag) +
    " + '>, so nothing was drawn. The file that answered is not the element this pane asked for.';" +
    '  }' +
    '};' +
    'load();' +
    '</script>' +
    '</body>' +
    '</html>'
  );
}

export class DraftPreview extends LitElement {
  static properties = {
    draft: { type: Object },
  };

  /** The draft to draw, bound by the shell to `/session/preview/draft`. */
  declare draft: DraftPreviewState | undefined;

  constructor() {
    super();
    this.draft = undefined;
  }

  render() {
    const d = this.draft;
    // UNSET IS NOT EMPTY: no draft bound is "no ingest has produced one", said in words, because a
    // blank frame and a draft that draws nothing are different claims and only one of them is true.
    if (!d || !d.moduleUrl) {
      return html`<p class="empty">No draft to preview. Submit a Figma node and its component is drawn here from the temporary file the ingest writes.</p>`;
    }
    // A TAG THAT CANNOT BE AN ELEMENT IS NOT DRAWN AS ONE. The document would silently instantiate
    // an unknown element and the pane would read as a component that draws nothing; naming the
    // refusal is the honest version of the same outcome, and it is the document's own rule (it
    // refuses a missing module path in words rather than drawing a blank page).
    if (!ELEMENT_TAG_RE.test(String(d.tag || ''))) {
      return html`<p class="empty">Nothing to render: this draft's tag (${d.tag || 'none'}) is not a custom element name, so no element can be drawn for it.</p>`;
    }
    return html`
      <iframe
        title="Draft preview"
        sandbox="allow-scripts allow-same-origin"
        srcdoc=${draftDocument(d)}
      ></iframe>
    `;
  }

  static styles = [
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */
      :host {
        display: flex;
        width: 100%;
        /* THE PANE THE COMPONENT IS DRAWN IN. The component is not scaled to fit and this element
           does not clip it: the frame around this one scrolls (component-preview's .frame), and the
           document scrolls inside itself, which is the pane's own behaviour in the ingest form. */
        height: 100%;
        min-height: 320px;
      }
      /*
       * THE FRAME FILLS THIS ELEMENT WITHOUT A PERCENTAGE, and that is not a style preference.
       * It used a percentage height, which stopped resolving the moment the frame began centring its
       * child by an auto margin: the host's own height then comes from its min-height rather than
       * from a definite parent, a percentage against it falls back to auto, and the iframe
       * collapsed to the height of its content (measured 2026-09-30: host 320px, iframe 150px).
       * A stretched flex item asks the layout for the box it already has instead of re-deriving it,
       * so the pane is the host's height whatever the parent's height turned out to be.
       */
      iframe {
        flex: 1 1 auto;
        min-width: 0;
        border: 0;
        background: #fff;
      }
      .empty {
        margin: 0;
        padding: 16px;
        font-size: 13px;
        color: #6b7280;
        max-width: 46ch;
      }
    `,
  ];
}

if (!customElements.get('draft-preview')) customElements.define('draft-preview', DraftPreview);

declare global {
  interface HTMLElementTagNameMap {
    'draft-preview': DraftPreview;
  }
}
