/**
 * <builder-embed> — THE PRODUCT ROOM IS THE BUILDER NOW (owner, 2026-10-04).
 *
 * THE OWNER'S SENTENCES: *"just load that inside of the product area … the product room will
 * just remove the grace chat."* The whole app builder runs INSIDE this room — its own prompt
 * box, the run's progression, the live preview and the code panel — served by this machine's
 * own engine (`wireframe-lab/ai-app-builder-open/local-vcaas/server.mjs`, DeepSeek behind it,
 * no Totalum account).
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
   * reads to know it is standing inside the Product room (owner, 2026-10-04: *"that back
   * button should go back to the console"*). Appended here, once, so the room's JSX carries
   * plain addresses and the contract lives in one place.
   */
  private _embeddedSrc(): string {
    const base = this.src ?? 'http://localhost:3223/';
    try {
      const url = new URL(base);
      url.searchParams.set('embedded', 'console');
      return url.toString();
    } catch {
      return base;
    }
  }

  /**
   * THE BUILDER'S TWO CALLS HOME (2026-10-04): its back arrow postMessages `builder-back`
   * (leave the room), and its Publish control `builder-published` (the engine flag is set —
   * the host's job is to sync the card). This element — the thing that owns the frame and
   * knows its origin — verifies the sender is the builder and re-announces the message on
   * `window` as a DOM event of the same name, which the room's host listens for
   * (WritingAreaIndex). Both messages are bare constants; nothing else crosses in this
   * direction.
   */
  private _onMessage = (event: MessageEvent): void => {
    const type = (event.data as { type?: string } | null)?.type;
    if (type !== 'builder-back' && type !== 'builder-published') return;
    let frameOrigin: string;
    try {
      frameOrigin = new URL(this._embeddedSrc()).origin;
    } catch {
      return;
    }
    if (event.origin !== frameOrigin) return;
    window.dispatchEvent(new CustomEvent(type));
  };

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

    .frame {
      display: block;
      width: 100%;
      height: 100%;
      border: 0;
      background: #ffffff;
    }
  `;

  render() {
    /**
     * NO DEFAULT ADDRESS (owner, 2026-10-04): the element used to fall back to the tool's
     * dashboard. The rule for the Product room — *"basically we never want to see the
     * applications dashboard ever"* — makes that fallback a destination nobody may reach,
     * so with no `src` this draws NOTHING. A blank pane is honest; a project list is not.
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
        },
        BuilderEmbed
      >;
    }
  }
}
