// ── COPIED IN FROM KOR, 2026-10-03 ──────────────────────────────────────────────────────────────
// Real upstream source (@kor-ui/kor v1.11.3, kor-ui.com — components/icon, from the kor-develop
// archive kept at lit_design-catalogs/), copied in as the dependency kor-button's closure needs
// (its template renders a real <kor-icon> when `icon` is set), under that project's MIT license.
// ONE MECHANICAL ADAPTATION TO THIS REPO'S DECORATOR MODE, and nothing else was touched: lit 3
// standard decorators require `accessor` fields, so `accessor` was inserted on every decorated
// member (the decorators themselves are untouched). Its glyph font (`md-icons`, fonts/ in the
// archive) is NOT loaded in this app yet — an icon draws as its ligature text until it lands.
import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { sharedStyles } from '../../shared-styles';

/**
 * @prop {String} icon - Defines the icon shown. Takes any string from the Material Design Library or custom url('') pointing to local or remote images or vectors.
 * @prop {'s'|'m'|'l'|'xl'} size - If set, defines the size of the icon. Possible values are `xl`(48px) `l`(32px), `m`(24px) and `s`(16px), but css font-size can be used to set custom sizes.
 * @prop {String} color -	If set, replaces the text label with a custom icon.
 * @prop {Boolean} button - If set to true, updates hover, click effects and cursors.
 * @prop {Boolean} disabled -	If set to true, disables mouse clicks and the style gets updated.
 */

export class korIcon extends LitElement {
  @property({ type: String, reflect: true }) accessor icon: string | undefined;
  @property({ type: String, reflect: true }) accessor color: string | undefined;
  @property({ type: String, reflect: true }) accessor size: 's' | 'm' | 'l' | 'xl' = 'm';
  @property({ type: Boolean, reflect: true }) accessor button: boolean | undefined;
  @property({ type: Boolean, reflect: true }) accessor disabled: boolean | undefined;

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          font-family: 'md-icons';
          line-height: 1;
          -webkit-font-smoothing: auto;
          text-rendering: optimizeLegibility;
          -moz-osx-font-smoothing: grayscale;
          font-feature-settings: 'liga';
          opacity: 0.9;
          color: var(--text-1);
          transition: var(--transition-1);
          height: max-content;
          width: max-content;
          min-height: max-content;
          min-width: max-content;
          overflow: hidden;
          background-repeat: no-repeat;
          background-position: center;
          background-size: contain;
        }
        :host([button]) {
          opacity: 0.6;
          cursor: pointer;
        }
        :host([disabled]) {
          pointer-events: none;
          opacity: 0.2;
        }
        /* size */
        :host([size='xl']) {
          height: 48px;
          width: 48px;
          font-size: 48px;
        }
        :host([size='l']) {
          height: 32px;
          width: 32px;
          font-size: 32px;
        }
        :host([size='m']) {
          height: 24px;
          width: 24px;
          font-size: 24px;
        }
        :host([size='s']) {
          height: 16px;
          width: 16px;
          font-size: 16px;
        }
        /* hover inputs */
        @media (hover: hover) {
          :host([button]:hover:not(:active)) {
            opacity: 0.9;
          }
        }
      `,
    ];
  }

  render() {
    return html` ${this.icon?.indexOf('url') ? html` ${this.icon} ` : ''}`;
  }

  attributeChangedCallback(name: string, oldval: string, newval: string) {
    super.attributeChangedCallback(name, oldval, newval);
    this.dispatchEvent(new Event(`${name}-changed`));
    if (name == 'color' && this.color) {
      this.style.color = this.color;
    } else if (name == 'icon' && newval.indexOf('url') > -1) {
      this.setBackgroundImage(newval);
    }
  }

  private setBackgroundImage(val: string): void {
    this.style.backgroundImage = val;
  }
}

if (!window.customElements.get('kor-icon')) {
  window.customElements.define('kor-icon', korIcon);
}
