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
  /** The module text the ingest built in memory, as TypeScript: the record of every value. */
  module?: string;
  /** That module compiled to JavaScript. This is what a browser can parse and draw. */
  script?: string;
  /** The temporary file under PREVIEW_DIR, for a preview written before this change. */
  modulePath?: string;
  /** That same file, as the dev server serves it, for a preview written before this change. */
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
  // THE BROWSER CANNOT PARSE TYPESCRIPT. The source is carried for the record; the script is its
  // compiled form and is what the blob loads. A source with no script is refused in words rather
  // than loaded and failed at its first `export interface`.
  const moduleText = String(draft.script || '');
  // `<` becomes the JSON escape in the embedded source, so no string in the module can close this
  // document's script tag. It parses back to the same character and changes no value.
  const safeModule = JSON.stringify(moduleText).replace(/</g, '\\u003c');
  const label = moduleText ? 'the compiled module this ingest built in memory' : url;
  const loadCode = moduleText
    ? 'const moduleUrl = URL.createObjectURL(new Blob([' +
      safeModule +
      '], { type: "text/javascript" }));' +
      'await import(moduleUrl);'
    : 'await import(' + JSON.stringify(url) + " + '?t=' + Date.now());";
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
    "style-src 'unsafe-inline' 'self'; " +
    "font-src 'self'; " +
    'img-src data: blob:; ' +
    "connect-src 'none'; " +
    "frame-src 'none'; " +
    "base-uri 'none'; " +
    "form-action 'none'" +
    '">' +
    // The app uses the house weights only; a design's measured weight can be outside them (800 on
    // the first node tested), and /fonts/fonts.css carries the whole 100–900 range — SELF-HOSTED
    // (owner, 2026-10-06): this document reaches no other origin. The absolute URL is deliberate:
    // a srcdoc document's relative URLs do not resolve (see the import-map note below).
    '<link href="' + window.location.origin + '/fonts/fonts.css" rel="stylesheet">' +
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
    // THE DOCUMENT IS THE COMPONENT'S HEIGHT, NOT THE IFRAME'S. It used to be `min-height: 100vh`
    // with `overflow: auto`, which made the document a scroll box inside the panel: the panel
    // could never be shorter than the column, and a component taller than the frame scrolled
    // inside it. The frame now measures this document and takes its height (see the height
    // message below), so the document is only as tall as the caption plus the element.
    'body { padding: 16px; background: #fafafa; font-family: "IBM Plex Sans", system-ui, sans-serif; overflow: visible; }' +
    // AND IT IS CENTRED BY ITS OWN MARGIN (owner, 2026-09-30: *"center the component Vertically and
    // horizontally whenever it displays there"*). An auto margin is what centres it safely: a
    // component WIDER than the pane keeps its left edge reachable, because an auto margin resolves
    // to zero the moment there is no room, where `justify-content: center` would push half of it
    // out of reach. The size is untouched — this is still the component at the size the design
    // measured, not scaled to fit.
    'body > ' + tag + ' { display: block; margin: 8px auto; }' +
    '#preview-caption { font-family: IBM Plex Mono, Menlo, monospace; font-size: 10px; color: #8a9499; margin-bottom: 8px; }' +
    '#preview-status { display: none; max-width: 520px; font-size: 13px; color: #b91c1c; font-family: IBM Plex Mono, monospace; white-space: pre-wrap; text-align: left; }' +
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
    'contains: nothing is passed to it and nothing is substituted for it. The Figma canvas ' +
    'placement is not applied; this is the component at its own origin.' +
    (moduleText
      ? '<br>drawn from the module this ingest built in memory — nothing was written. The catalogue is not read here; approving is what writes it.'
      : file
        ? '<br>drawn from ' + file + ' — the temporary file this ingest wrote. The catalogue is not read here; approving is what writes it.'
        : '') +
    '</div>' +
    // ── NOTHING IS HANDED TO THE ELEMENT ────────────────────────────────────
    // Instantiated bare. The element that only draws when it is given data draws nothing, and that
    // is the finding, not a fault to paper over with invented props. THE VALUES IT WILL BE GIVEN ARE
    // NOT HIDDEN BY THAT — they are listed in the panel beside this frame (`component-preview`, from
    // the database rows), so the designer sees what the design draws AND what the component will be
    // handed, and neither is faked into the other.
    // ── THE STATE GOES ABOVE THE ELEMENT, WHERE THE READER IS LOOKING ───────
    // It used to sit BELOW the component inside a document that scrolls, so a preview that failed
    // to load and an element that drew nothing looked the same at the top of the pane — and the
    // reason could be scrolled out of sight. Owner, 2026-10-26: *"if there's an error reading the
    // file the report should be above it… you can't suppress errors."*
    '<div id="preview-status"></div>' +
    '<' + tag + '></' + tag + '>' +
    '<script type="module">' +
    "const status = document.getElementById('preview-status');" +
    "const say = (text, bad) => {" +
    "  status.style.display = 'block';" +
    "  status.style.color = bad ? '#b91c1c' : '#1f6f4a';" +
    '  status.textContent = text;' +
    '};' +
    'const load = async () => {' +
    // ── ONE ATTEMPT, AND THE FAILURE IS DRAWN ───────────────────────────────
    // The file is written before the pane can ask for it, so one attempt either loads it or says
    // what went wrong — in the pane, where the designer is looking.
    '  try {' +
    loadCode +
    '  } catch (err) {' +
    '    say(' +
    "      'I could not load ' + " +
    JSON.stringify(label) +
    "      + ' — ' + (err && err.message ? err.message : err), true);" +
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
    '    say(' +
    "      'I loaded ' + " +
    JSON.stringify(url) +
    "      + ' and nothing defined <' + " +
    JSON.stringify(tag) +
    "      + '>, so nothing was drawn. The file that answered is not the element this pane asked for.', true);" +
    '    return;' +
    '  }' +
    // ── AND WHEN IT DID DRAW, SAY SO WITH THE BOX IT OCCUPIES ───────────────
    // A green line is not a decoration: it is the only evidence in the pane that the file the
    // folder holds is the thing on screen. An element that loaded and drew nothing (a zero box, an
    // empty drawing) is reported as a failure here, because a blank box is not a success.
    '  const el = document.querySelector(' + JSON.stringify(tag) + ');' +
    '  if (el && el.updateComplete) { try { await el.updateComplete; } catch (e) {} }' +
    // ── THE COMPONENT'S OWN STYLES, APPLIED. Lit normally installs `static styles` on the shadow
    // root; if this document's CSP or engine skipped the adopted stylesheet, apply the class's own
    // cssText here so the drawing is never raw HTML.
    '  const ctor = el && el.constructor;' +
    '  const declared = ctor && ctor.styles;' +
    '  const cssText = declared ? (Array.isArray(declared) ? declared.map((s) => (s && s.cssText) || "").join("\\n") : (declared.cssText || "")) : "";' +
    '  const root = el && el.shadowRoot;' +
    // WHAT THE COMPONENT DREW, COUNTED BEFORE THE STYLE TAGS BELOW ARE ADDED. A style is an
    // element too; counting it would turn a component that rendered nothing into a "drawn" one.
    '  const renderedBefore = el && el.shadowRoot ? el.shadowRoot.childElementCount : 0;' +
    // THE RAW CSS IN THE IFRAME'S HEAD, as ordered. The head copy covers the document; the copy
    // below goes into the shadow root, where the component's own scoped selectors match.
    '  if (cssText) {' +
    '    const headStyle = document.createElement("style");' +
    '    headStyle.textContent = cssText;' +
    '    document.head.appendChild(headStyle);' +
    '  }' +
    '  if (root && cssText) {' +
    '    const style = document.createElement("style");' +
    '    style.textContent = cssText;' +
    '    root.appendChild(style);' +
    '  }' +
    '  const box = el ? el.getBoundingClientRect() : null;' +
    '  const drawn = renderedBefore;' +
    // A NON-ZERO BOX IS NOT A DRAWING. Measured on right-column-panel-container: the element
    // loaded, held 964x634, and sat at x = -602.5 — entirely outside this frame — because its
    // root transform was applied around the corner. The element's ORIGIN must be inside the
    // frame, or the pane says it drew nothing rather than claiming a success. A tall component
    // that starts at the top and scrolls is not a failure; an element whose left or top is
    // outside the frame is.
    '  const inFrame = !!(box && box.width && box.height && box.left >= -1 && box.top >= -1 && box.left < document.documentElement.clientWidth && box.top < document.documentElement.clientHeight);' +
    '  if (!box || !box.width || !box.height || !drawn || !inFrame) {' +
    '    say(' +
    "      'I loaded the file and defined <' + " +
    JSON.stringify(tag) +
    "      + '>, but the element drew nothing inside this frame — box ' + " +
    "      (box ? Math.round(box.width) + ' × ' + Math.round(box.height) : 'none') + " +
    "      ', ' + drawn + ' child element(s)' + " +
    "      (inFrame ? '' : ', left/top at ' + (box ? Math.round(box.left) + ', ' + Math.round(box.top) : 'none')) + " +
    "      '. Nothing is being shown as a success here.', true);" +
    '    return;' +
    '  }' +
    '  say(' +
    "    'Drawn: ' + Math.round(box.width) + ' × ' + Math.round(box.height) + ' — the element from ' + " +
    JSON.stringify(label) +
    "    + '.', false);" +
    '};' +
    /*
     * THE DOCUMENT ANNOUNCES ITS OWN HEIGHT. The frame above cannot read a height the document
     * never states — and `100%` only ever echoed the iframe, which is the box being sized. The
     * body's `scrollHeight` is the caption, the status line and the element, which is what the
     * panel must hug. A ResizeObserver keeps it honest when the status text wraps or a face
     * finishes loading; the two timers cover the first frames before layout has settled.
     */
    'const reportHeight = () => {' +
    '  try {' +
    '    parent.postMessage({ type: "draft-preview-height", height: Math.ceil(document.body.getBoundingClientRect().height) }, "*");' +
    '  } catch (e) {}' +
    '};' +
    'if (window.ResizeObserver) { try { new ResizeObserver(reportHeight).observe(document.body); } catch (e) {} }' +
    'setTimeout(reportHeight, 0); setTimeout(reportHeight, 120); setTimeout(reportHeight, 500);' +
    'load();' +
    '</script>' +
    '</body>' +
    '</html>'
  );
}

export class DraftPreview extends LitElement {
  static properties = {
    draft: { type: Object },
    /** The document's own height, reported from inside the frame — see the message below. */
    _height: { state: true },
  };

  /** The draft to draw, bound by the shell to `/session/preview/draft`. */
  declare draft: DraftPreviewState | undefined;

  /**
   * The last height the document announced; 0 until it answers. A DECLARED reactive field, not a
   * class-field initializer: a field of the same name would shadow Lit's accessor and the style
   * would never re-render when the message arrived (measured: `_height` 380, iframe still 320).
   */
  declare _height: number;

  constructor() {
    super();
    this.draft = undefined;
    this._height = 0;
  }

  /**
   * THE FRAME TAKES THE DOCUMENT'S HEIGHT. The document is the thing that knows how tall the
   * caption and the element are; the iframe is the box being sized, so asking it is circular.
   * The message is accepted only from this element's own iframe.
   */
  private _onHeight = (event: MessageEvent): void => {
    const iframe = this.renderRoot?.querySelector('iframe') as HTMLIFrameElement | null;
    if (!iframe || event.source !== iframe.contentWindow) return;
    const height = Number((event.data || {}).height);
    if (!Number.isFinite(height) || height <= 0) return;
    if (Math.abs(height - this._height) < 1) return;
    this._height = height;
  };

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('message', this._onHeight);
  }

  disconnectedCallback(): void {
    window.removeEventListener('message', this._onHeight);
    super.disconnectedCallback();
  }

  render() {
    const d = this.draft;
    // UNSET IS NOT EMPTY: no draft bound is "no ingest has produced one", said in words, because a
    // blank frame and a draft that draws nothing are different claims and only one of them is true.
    if (!d || (!d.script && !d.moduleUrl)) {
      return html`<p class="empty">No drawable module. ${d?.module ? 'The ingest returned its TypeScript source without a compiled script, so the browser cannot parse it.' : 'Submit a Figma node and its component is drawn here from the compiled module the ingest builds in memory.'}</p>`;
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
        style=${`height: ${this._height > 0 ? `${this._height}px` : '320px'}`}
        srcdoc=${draftDocument(d)}
      ></iframe>
    `;
  }

  static styles = [
    css`
      /* No backticks in this stylesheet: it is a tagged template literal. */
      :host {
        display: block;
        width: 100%;
        /* THE FRAME HUGS THE DOCUMENT. The iframe's height is the height the document reported
           (see _onHeight); this element adds nothing and clips nothing, so the panel around it is
           as tall as the drawing plus its caption. The page around the panel is what scrolls if
           the whole column is taller than the window — never this box. */
        height: auto;
        min-height: 0;
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
        display: block;
        width: 100%;
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
