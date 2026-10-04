// ── COPIED IN FROM KOR, 2026-10-03 ──────────────────────────────────────────────────────────────
// Real upstream source (@kor-ui/kor v1.11.3, kor-ui.com — components/button, from the kor-develop
// archive kept at lit_design-catalogs/), taken under that project's MIT license through this app's
// design-system pipeline: manifest → ingest → accept (instance #2 of
// wireframe-lab/IMPORT-A-DESIGN-SYSTEM.md). ONE MECHANICAL ADAPTATION TO THIS REPO'S DECORATOR
// MODE, and nothing else was touched: lit 3 standard decorators require `accessor` fields, so
// `accessor` was inserted on every decorated member (the decorators themselves are untouched).
import { LitElement, css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { sharedStyles } from '../../shared-styles';
import '../icon';

/**
 * @prop {String} label - Defines the text label.
 * @prop {String} icon - If set, replaces the text label with a custom icon.
 * @prop {'primary'|'secondary'|'tertiary'} color - Defines the color. The possible values are `primary`, `secondary` and `tertiary`
 * @prop {Boolean} disabled - If set to true, disables mouse clicks and the style gets updated.
 */

export class korButton extends LitElement {
  @property({ type: String, reflect: true }) accessor label: string | undefined;
  @property({ type: String, reflect: true }) accessor icon: string | undefined;
  @property({ type: String, reflect: true }) accessor color:
    | 'primary'
    | 'secondary'
    | 'tertiary' = 'primary';
  @property({ type: Boolean, reflect: true }) accessor disabled: boolean | undefined;

  static get styles() {
    return [
      sharedStyles,
      css`
        :host {
          font: var(--header-2);
          color: var(--text-1);
          display: flex;
          gap: var(--spacing-xs);
          height: max-content;
          width: max-content;
          border-radius: var(--border-radius);
          cursor: pointer;
          transition: var(--transition-1);
          justify-content: center;
          user-select: none;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        :host([label]) {
          max-width: 160px;
          padding: var(--spacing-xs) var(--spacing-m);
        }
        :host([color='tertiary'][label]) {
          padding: 3px 11px;
        }
        :host(:not([label])) {
          padding: var(--spacing-xs);
        }
        :host([color='tertiary']:not([label])) {
          padding: 3px;
        }
        /* idle */
        :host([color='primary']) {
          background-color: rgb(var(--accent-1));
        }
        :host([color='secondary']) {
          background-color: rgba(var(--neutral-1), 0.1);
        }
        :host([color='tertiary']) {
          border-width: 1px;
          border-style: solid;
          border-color: rgba(var(--neutral-1), 0.25);
        }
        /* disabled */
        :host([disabled]) {
          pointer-events: none;
          opacity: 0.2;
        }
        /* text and icon colors */
        kor-icon {
          color: unset;
        }
        :host([color='primary']) {
          color: rgba(255, 255, 255, 0.9);
        }
        /* hover inputs */
        @media (hover: hover) {
          :host([color='primary']:not(:active):hover) {
            background-color: rgb(var(--accent-1b));
          }
          :host([color='secondary']:not(:active):hover) {
            background-color: rgba(var(--neutral-1), 0.15);
          }
          :host([color='tertiary']:not(:active):hover) {
            border-color: rgba(var(--neutral-1), 0.3);
            background-color: rgba(var(--neutral-1), 0.05);
          }
        }
        .center {
          display: flex;
          flex-direction: column;
          justify-content: center;
          overflow: hidden;
        }
        .label {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `,
    ];
  }

  render() {
    return html`
      <slot name="icon">
        ${this.icon ? html` <kor-icon icon="${this.icon}"></kor-icon> ` : ''}
      </slot>
      <slot>${this.label ?
              html`<div class="center"><label class="label">${this.label}</label></div>`
              : ''}</slot>
    `;
  }

  attributeChangedCallback(name: string, oldval: string, newval: string) {
    super.attributeChangedCallback(name, oldval, newval);
    this.dispatchEvent(new Event(`${name}-changed`));
  }
}

if (!window.customElements.get('kor-button')) {
  window.customElements.define('kor-button', korButton);
}
