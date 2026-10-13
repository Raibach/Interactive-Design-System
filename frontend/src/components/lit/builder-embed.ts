/**
 * <builder-embed> — THE PRODUCT ROOM IS THE BUILDER NOW (2026-10-04).
 *
 * The whole app builder runs INSIDE this room — its own prompt box, the run's progression,
 * the live preview and the code panel — served by this machine's own engine
 * (`wireframe-lab/ai-app-builder-open/local-vcaas/server.mjs`, DeepSeek behind it, no
 * Totalum account).
 *
 * A PLAIN IFRAME, UNLIKE <artifact-canvas> — and the difference is the trust level, not a
 * detail to tidy away: the artifact stage draws a document the MODEL wrote, so it is dead by
 * construction (no allow-scripts, no allow-same-origin). This frame is our OWN application on
 * its own origin: it needs scripts and same-origin access to itself, and it is never handed
 * anything of this page. It carries no sandbox attribute for the same reason a mirror is not
 * kept in front of our own door.
 *
 * ONE PROPERTY: `src` — the builder's address, written by the room's tree (a literal there,
 * never a model invention).
 */

import { LitElement, html, css, nothing } from 'lit';

export class BuilderEmbed extends LitElement {
  static properties = {
    /** The builder's address — e.g. http://localhost:3223/ (observed as an attribute: the room
     *  mounts this element from JSX, and React writes an attribute, not a property). */
    src: { type: String },
  };

  declare src: string | null;

  /**
   * EVERY PAGE IS LOADED WITH `?embedded=console` — the header the builder's back arrow
   * reads to know it is standing inside the Product room, so the back control returns to
   * the console. Appended here, once, so the room's JSX carries plain addresses and the
   * contract lives in one place.
   */
  private _embeddedSrc(): string {
    const base = this.src ?? 'http://localhost:3223/';
    /* THE PARAMS ARE THE BUILDER'S, NOT EVERY FRAME'S (owner-approved F1a, 2026-10-09):
       `embedded=console` and `house_door` are read by the builder tool (its back arrow)
       and by Development's openhands-patch.sh (the onboarding door) — and by NOTHING in
       the Governance room's Langfuse build (grep-verified: no readers). Worse, that
       query string tripped a vendor route guard — PagedSettingsContainer judged
       "settings?embedded=..." as "not /settings" and 404'd every settings-subnav click
       (root-caused + fixed in the vendor source the same day). So the governance mount
       opts out with `no-embedded-params`; every other mount keeps the params
       byte-for-byte. This opt-out removes dead weight; it is not the bug fix. */
    if (this.hasAttribute('no-embedded-params')) return base;
    try {
      /* RELATIVE ADDRESSES RESOLVE AGAINST THIS PAGE (2026-10-10): under the door the
         room hands this element same-origin paths ("/builder", "/dev") — new URL(relative)
         alone would throw and silently drop the params below. Resolving against the page's
         own url keeps both the absolute (direct-port) and the relative (door) forms whole. */
      const url = new URL(base, window.location.href);
      url.searchParams.set('embedded', 'console');
      /* THE DOOR TRAVELS TO THE FRAME (2026-10-04). The Development room's tool decides what a
         first-time visitor sees — its onboarding wizard (the one with the model setup), or
         straight to the workspace — from a marker in its own address, because the frame cannot
         ask who came in. The shell knows which door was used: a person who signed up carries
         `grace_door = 'registered'` (App.tsx's onEnterWorkspace) and gets the wizard; the pin
         (dev@local) writes `grace_door = 'dev'` (index.html) and keeps the tool's current
         state — no wizard. The canvas's ground script (openhands-patch.sh) reads this. Same
         one-place contract as `embedded` above. A browser with no marker at all (older
         sessions) sends nothing and behaves exactly as it did before this existed. */
      let door: string | null = null;
      try {
        // Session-scoped with the sign-in itself (2026-10-04; src/shared/session.ts).
        door = sessionStorage.getItem('grace_door');
      } catch {
        /* no storage — send nothing, the pre-existing behavior */
      }
      if (door === 'registered' || door === 'dev') url.searchParams.set('house_door', door);
      return url.toString();
    } catch {
      return base;
    }
  }

  /**
   * THE BUILDER'S CALLS HOME (2026-10-04; the third added 2026-10-06): its back arrow
   * postMessages `builder-back` (leave the room), its Publish control `builder-published`
   * (the engine flag is set — the host's job is to sync the card), and — for the product
   * foot's dots — `ids:tool-state` (its Figma/GitHub/visual-editor states, mirrored home so
   * the room can show them without guessing). This element — the thing that owns the frame
   * and knows its origin — verifies the sender is the builder and re-announces the message
   * on `window`, which the room's host listens for (WritingAreaIndex): `builder-back` and
   * `builder-published` under their own names, the tool states as `builder-tool-state`.
   */
  private _onMessage = (event: MessageEvent): void => {
    const data = (event.data || {}) as { type?: string; [key: string]: unknown };
    const type = data.type;
    if (type !== 'builder-back' && type !== 'builder-published' && type !== 'ids:tool-state') return;
    let frameOrigin: string;
    try {
      frameOrigin = new URL(this._embeddedSrc()).origin;
    } catch {
      return;
    }
    if (event.origin !== frameOrigin) return;
    window.dispatchEvent(
      new CustomEvent(type === 'ids:tool-state' ? 'builder-tool-state' : type, { detail: data }),
    );
  };

  /**
   * THE HOST'S OWN CALL INTO THE BUILDER (2026-10-06) — one method, one direction.
   *
   * The product room's foot asks the builder to do what the builder's own tool row does:
   * open its Figma or GitHub modal, toggle its visual editor (`{type:'ids:product-tool',
   * tool}`). The room cannot reach into the frame; this element owns it, so the message
   * leaves from here, aimed at the frame's OWN origin — never `*`.
   */
  postToBuilder(message: Record<string, unknown>): void {
    const frame = this.renderRoot?.querySelector('iframe') as HTMLIFrameElement | null;
    if (!frame?.contentWindow) return;
    let origin: string;
    try {
      origin = new URL(this._embeddedSrc()).origin;
    } catch {
      return;
    }
    frame.contentWindow.postMessage(message, origin);
  }

  /**
   * NAVIGATE THE FRAME DIRECTLY (2026-10-09).
   *
   * A plain `src` write is a no-op when the target equals the current `src`
   * value — but the embedded app routes itself with the history API, which
   * moves the document WITHOUT rewriting the iframe's `src` attribute. The
   * shell's nav must be able to pull the frame back to a section even then
   * (measured in the room: after the app landed on its org chooser, clicking
   * Home set the SAME url again and the frame did not move).
   *
   * So this tells the window itself to navigate. Navigating a cross-origin
   * frame is allowed — reading its state is what the browser blocks.
   * `replace` swaps the current history entry instead of piling entries into
   * the frame. If a browser ever refused, the fallback rewrites `src` (which
   * re-uses the normal render path — but that fallback alone cannot force a
   * reload when `src` is unchanged, so it is only partial).
   */
  navigateTo(url: string): void {
    const frame = this.renderRoot?.querySelector('iframe') as HTMLIFrameElement | null;
    if (!frame?.contentWindow) {
      this.src = url;
      return;
    }
    try {
      frame.contentWindow.location.replace(url);
    } catch {
      this.src = url;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('message', this._onMessage);
  }

  /**
   * THE FRAME IS UP (2026-10-04): the development room's assembly gate holds until the
   * window inside has FINISHED loading, and it can only know that if this element says so —
   * the iframe lives in this element's own tree, out of the host's reach. A window event,
   * like every other cross-boundary announcement in this app.
   */
  private _onFrameLoaded = (): void => {
    window.dispatchEvent(new CustomEvent('builder-embed-loaded'));
  };

  disconnectedCallback() {
    window.removeEventListener('message', this._onMessage);
    super.disconnectedCallback();
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
    }

    /* THE FRAME IS A WINDOW, NOT A SHEET. This was background #ffffff — a white sheet
       behind every page the frame loads. Each room paints its own ground BEHIND this
       element (the Development room its lab tile, the Governance room its wave) and the
       embedded documents carry transparent grounds so that ground is the floor (the
       Development tool by openhands-patch.sh; OpenMetadata by the house patch §2). A white
       sheet here blocks all of it: transparent grounds would show #ffffff, not the room.
       Transparent: the room's ground is what the app stands on, and during a load it paints
       there too — never a white beat. */
    .frame {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: transparent;
    }
  `;

  render() {
    /**
     * NO DEFAULT ADDRESS (2026-10-04): the element used to fall back to the tool's
     * dashboard. The rule for the Product room — the applications dashboard is never shown
     * — makes that fallback a destination nobody may reach, so with no `src` this draws
     * NOTHING. A blank pane is honest; a project list is not.
     */
    if (!this.src) return nothing;
    return html`
      <iframe
        class="frame"
        title="App builder"
        src=${this._embeddedSrc()}
        @load=${this._onFrameLoaded}
      ></iframe>
    `;
  }
}

if (!customElements.get('builder-embed')) customElements.define('builder-embed', BuilderEmbed);

declare global {
  interface HTMLElementTagNameMap {
    'builder-embed': BuilderEmbed;
  }
}

/*
 * THE REACT DECLARATION — the room mounts this element from JSX (WritingAreaIndex's product
 * branch), and without it TypeScript refuses the tag: "Property 'builder-embed' does not exist
 * on type 'JSX.IntrinsicElements'". Same declaration every element that appears in JSX in this
 * repository carries.
 */
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'builder-embed': React.DetailedHTMLProps<
        React.HTMLAttributes<BuilderEmbed> & {
          src?: string;
          /** Opt-out (F1a, owner-approved 2026-10-09): the governance mount sets this
           *  so the dead `embedded`/`house_door` params stay off Langfuse's URL. The
           *  builder mounts (product, development) omit it and keep the params. */
          'no-embedded-params'?: boolean | string;
        },
        BuilderEmbed
      >;
    }
  }
}
