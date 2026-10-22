/**
 * <ux-app-frame> — THE OBSERVABILITY APPLICATION, DRAWN INSIDE THE UX TAB.
 *
 * WHAT THIS IS. The Design seat's UX tab shows the running analytics application — its own
 * interface, its own navigation, its own screens — not a re-drawing of it. The application is
 * a separate server (default http://127.0.0.1:8200) and a separate origin, so the only
 * mechanism that shows its real interface is a frame. This element is that frame: one iframe,
 * filling the column the seat gives it.
 *
 * WHY NOT A LIT PORTAL, A PROXY, OR A REBUILD:
 *   - A portal cannot cross an origin.
 *   - Serving the application under a path of our own origin is the ONE way it is framed, and
 *     it is being done: the room points this frame at `posthogToolUrl()` — `/posthog` on our
 *     origin (the same door as /builder, /dev, /governance), and the application is mounted
 *     under that prefix in its own settings (owner, 2026-10-21: governance is the template).
 *     An earlier note claimed this was "ruled out" because PostHog's `STATIC_URL` is
 *     root-absolute — that treated the code we have taken over as untouchable; it is a setting.
 *   - Rebuilding its screens here would be a second implementation that drifts from the
 *     application it claims to show.
 *
 * WHAT IT DEPENDS ON, STATED PLAINLY. The framed application sends
 * `Content-Security-Policy: frame-ancestors`, which excludes our studio unless its own
 * environment names us. On this machine that allowance is `FRAME_ANCESTORS_EXTRA=http://localhost:5001`
 * in its compose web service. If that is absent the browser refuses the frame and this element
 * cannot report the reason — a cross-origin refusal is silent to the embedding page by design.
 * What it CAN report is that nothing loaded at all (the `error` event), which is a dead server,
 * not a policy refusal. The two are different failures and are not conflated here.
 *
 * IT OWNS NO DATA. There is no counter, no metric and no read in this file: everything shown is
 * the application's own.
 */
import { LitElement, html, css } from 'lit';

export class UxAppFrame extends LitElement {
  static properties = {
    /** The framed application's address. Attribute: src. */
    src: { type: String },
    /** True only when the frame reported that it could not load the document at all. */
    _unreachable: { state: true },
  };

  declare src: string;
  declare private _unreachable: boolean;

  constructor() {
    super();
    /*
     * NO DEFAULT ADDRESS — NOTHING LOADS UNTIL IT IS TOLD (owner, 2026-10-18: the browser asked
     * *"Access other apps and services on this device"* on the DEPLOYED site, because this
     * element defaulted to http://localhost:8200 and the room created it on every assembly —
     * the visitor's own machine was being probed from the live page. The address is set by the
     * room, and only when the page itself runs on localhost; everywhere else the column states
     * that the program is not served there.
     *
     * `localhost`, NOT `127.0.0.1`. Both reach the same published port, and only one of them
     * frames: measured in the studio's own browser, a frame to 127.0.0.1:8200 was answered
     * (200, full document) and then abandoned — the frame stayed on about:blank, with no CSP
     * or X-Frame-Options complaint anywhere, because the browser treats the loopback IP and
     * the page's own `localhost` as different local hosts. Same server, same page; the name
     * is what decides it. A different deployment writes its own address.
     */
    this.src = '';
    this._unreachable = false;
  }

  static styles = css`
    :host {
      display: block;
      height: 100%;
      min-height: 0;
      background: #ffffff;
    }
    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #ffffff;
    }
    /* NOT A FRIENDLY PLACEHOLDER: the one failure the embedder is told about, said in words.
       A policy refusal never reaches this branch — the browser draws its own blocked frame,
       which is the honest picture of that failure. */
    .unreachable {
      padding: 16px 20px;
      font: 13px/1.5 var(--ui-font, 'Inter', system-ui, sans-serif);
      color: #8a2b2b;
    }
  `;

  private _onError = () => {
    this._unreachable = true;
  };

  render() {
    /* NO ADDRESS, NO FRAME. An iframe with src="" resolves to the PAGE'S OWN address and would
       embed the room inside itself; until the room names a program, nothing is drawn. */
    if (!this.src) {
      return html``;
    }
    if (this._unreachable) {
      return html`<div class="unreachable">
        Nothing answered at ${this.src}. The application is not running, or it moved.
      </div>`;
    }
    return html`<iframe
      src=${this.src}
      title="UX observability application"
      @error=${this._onError}
    ></iframe>`;
  }
}

if (!customElements.get('ux-app-frame')) customElements.define('ux-app-frame', UxAppFrame);

declare global {
  interface HTMLElementTagNameMap {
    'ux-app-frame': UxAppFrame;
  }
}
