/**
 * <error-banner> — Lit A2UI web component
 *
 * The system's error channel — and the one the backend ALREADY speaks through.
 * grace_gui.py instructs the model to report failures with
 * `<error-banner message="..."/>` and never to invent a debug page. Until this
 * element existed that tag was declared in the allowlist, granted to every role,
 * accepted by no schema and rendered by nothing: the model had a channel with
 * nobody on the other end. The catalog checker called it `tag-inert`.
 *
 * It is deliberately LOUD, because of what it carries here. A component that gets
 * generated without its annotation has not made a small mistake: every surface
 * that places it inherits invented behaviour, silently. The person who answers for
 * the catalogue needs to see that on arrival, not discover it in an audit next
 * week. Alert, don't block — the surface still renders; the banner rides on top.
 *
 * A2UI Catalog ID: error-banner  (allowlist: tag-registry.ts, surface 'both')
 * Events: error-dismiss, error-retry  (both bubble + compose, so a window
 *         listener hears them across the shadow boundary)
 * Framework: Lit 3.x — no decorators, static properties + customElements.define()
 */

import { LitElement, html, css } from 'lit';

export class ErrorBanner extends LitElement {
  static properties = {
    message: { type: String },
    code: { type: String },
    retry: { type: Boolean },
  };

  declare message: string;
  /** Short machine-ish label above the message, e.g. UNANNOTATED-IN-USE. */
  declare code: string;
  /** Offer a Retry button. Off unless the caller can actually retry something. */
  declare retry: boolean;

  constructor() {
    super();
    this.message = '';
    this.code = '';
    this.retry = false;
  }

  static styles = css`
    :host {
      display: block;
      font-family: 'Inter', system-ui, sans-serif;
    }
    /* A banner with no message is a red bar that reports nothing — and a red bar
       that reports nothing teaches people to ignore the shape. So: nothing to
       say, nothing on screen. */
    .banner {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px 14px;
      background: #fef2f2;
      border: 1px solid #fca5a5;
      /* The heavy left edge is what makes it read as an ALERT at a glance rather
         than as a styled paragraph. */
      border-left: 5px solid #dc2626;
      border-radius: 6px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
    .mark {
      font-size: 22px;
      line-height: 1;
      color: #dc2626;
      flex-shrink: 0;
    }
    .body {
      flex: 1;
      min-width: 0;
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #991b1b;
      margin-bottom: 3px;
    }
    .msg {
      font-size: 13px;
      font-weight: 600;
      line-height: 1.45;
      color: #7f1d1d;
      word-break: break-word;
    }
    .acts {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    button {
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid #fca5a5;
      background: #fff;
      color: #991b1b;
      cursor: pointer;
    }
    button:hover {
      background: #fee2e2;
    }
  `;

  private _emit(type: 'error-dismiss' | 'error-retry') {
    this.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true }));
  }

  render() {
    if (!this.message) return html``;
    return html`
      <div class="banner" role="alert" aria-live="assertive">
        <div class="mark" aria-hidden="true">&#9888;</div>
        <div class="body">
          ${this.code ? html`<div class="code">${this.code}</div>` : ''}
          <div class="msg">${this.message}</div>
        </div>
        <div class="acts">
          ${this.retry
            ? html`<button type="button" @click=${() => this._emit('error-retry')}>Retry</button>`
            : ''}
          <button
            type="button"
            @click=${() => this._emit('error-dismiss')}
            aria-label="Dismiss"
            title="Dismiss"
          >
            &#10005;
          </button>
        </div>
      </div>
    `;
  }
}

customElements.define('error-banner', ErrorBanner);

declare global {
  interface HTMLElementTagNameMap {
    'error-banner': ErrorBanner;
  }
}

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'error-banner': React.DetailedHTMLProps<
        React.HTMLAttributes<ErrorBanner> & {
          message?: string;
          code?: string;
          retry?: boolean;
          ref?: React.Ref<ErrorBanner>;
        },
        ErrorBanner
      >;
    }
  }
}
